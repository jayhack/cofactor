import path from "node:path";

import type {
  Catalyst,
  CatalystMatch,
  DenseVector,
  GardenChunk,
  GardenIndex,
  PetriResponse,
  SearchOptions,
  SearchResponse,
  SearchResult,
} from "../types.js";
import { createEmbedder, denseCosine } from "./embeddings.js";
import { snippet } from "./text.js";
import { recencyScore } from "./time.js";
import { readIndex, readTargetIndex } from "./store.js";
import { cosine, vectorizeText } from "./vector.js";

export async function catalyze(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const vaultPath = path.resolve(options.vaultPath ?? process.cwd());
  const index = options.target ? await readTargetIndex(vaultPath, options.target) : await readIndex(vaultPath);
  return searchIndex(index, query, {
    limit: options.limit ?? index.config.maxResults,
    target: options.target,
    vaultPath,
  });
}

export async function searchIndex(
  index: GardenIndex,
  query: string,
  options: Required<Pick<SearchOptions, "limit">> & Pick<SearchOptions, "target" | "vaultPath">,
): Promise<SearchResponse> {
  const queryVector = vectorizeText(query, index.idf);
  const queryEmbedding = await embedQuery(index, query);
  const catalystMatches = rankCatalysts(index.catalysts, queryVector, queryEmbedding).slice(0, 10);
  const catalystChunkScores = new Map<string, Array<{ catalyst: Catalyst; score: number }>>();

  for (const match of catalystMatches) {
    for (const linkedChunk of match.catalyst.topChunks) {
      const weightedScore = linkedChunk.score * match.score;
      const list = catalystChunkScores.get(linkedChunk.chunkId) ?? [];
      list.push({ catalyst: match.catalyst, score: weightedScore });
      catalystChunkScores.set(linkedChunk.chunkId, list);
    }
  }

  const scored = index.chunks
    .map((chunk) =>
      scoreChunk(chunk, queryVector, queryEmbedding, catalystChunkScores.get(chunk.id) ?? [], index),
    )
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit);

  return {
    catalysts: catalystMatches.slice(0, 5),
    query,
    results: scored.map((result) => ({
      catalystIds: result.catalystIds,
      content: snippet(result.chunk.content),
      filePath: result.chunk.filePath,
      score: Number(result.score.toFixed(6)),
      title: result.chunk.title,
    })),
    target: options.target,
    vaultPath: options.vaultPath ?? index.vaultPath,
  };
}

export async function petri(vaultPathInput = process.cwd(), query?: string): Promise<PetriResponse> {
  const vaultPath = path.resolve(vaultPathInput);
  const index = await readIndex(vaultPath);
  if (!query) {
    return {
      appliedTargets: index.appliedTargets,
      catalysts: index.catalysts.slice(0, 24),
      entities: index.entities,
      stats: index.stats,
      vaultPath,
    };
  }

  const queryVector = vectorizeText(query, index.idf);
  const queryEmbedding = await embedQuery(index, query);
  const catalystMatches = rankCatalysts(index.catalysts, queryVector, queryEmbedding).slice(0, 20);
  const catalystIds = new Set(catalystMatches.map((match) => match.catalyst.id));
  const entityIds = new Set(catalystMatches.map((match) => match.catalyst.entityId));

  return {
    appliedTargets: index.appliedTargets,
    catalysts: index.catalysts.filter((catalyst) => catalystIds.has(catalyst.id)).slice(0, 20),
    entities: index.entities.filter((entity) => entityIds.has(entity.id)).slice(0, 12),
    query,
    stats: index.stats,
    vaultPath,
  };
}

async function embedQuery(index: GardenIndex, query: string): Promise<DenseVector> {
  if (index.embedding) {
    const embedder = await createEmbedder(index.config);
    return embedder.embedQuery(query);
  }

  return [];
}

function rankCatalysts(
  catalysts: Catalyst[],
  queryVector: Record<string, number>,
  queryEmbedding: DenseVector,
): CatalystMatch[] {
  return catalysts
    .map((catalyst) => ({
      catalyst,
      score: combinedScore(denseCosine(queryEmbedding, catalyst.embedding), cosine(queryVector, catalyst.vector)),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreChunk(
  chunk: GardenChunk,
  queryVector: Record<string, number>,
  queryEmbedding: DenseVector,
  catalystMatches: Array<{ catalyst: Catalyst; score: number }>,
  index: GardenIndex,
): { catalystIds: string[]; chunk: GardenChunk; score: number } {
  const directSparseScore = cosine(queryVector, chunk.vector);
  const directDenseScore = denseCosine(queryEmbedding, chunk.embedding);
  const directScore = combinedScore(directDenseScore, directSparseScore);
  const catalystScore = catalystMatches.reduce((max, match) => Math.max(max, match.score), 0);
  const recency = recencyScore(chunk.modifiedAt, index.config.recencyHalfLifeDays);
  const relevance = directScore + catalystScore;
  const score = relevance > 0 ? directScore * 0.72 + catalystScore * 0.82 + recency * 0.03 : 0;
  const catalystIds = [...new Set(catalystMatches.map((match) => match.catalyst.id))].slice(0, 5);

  return {
    catalystIds,
    chunk,
    score,
  };
}

function combinedScore(denseScore: number, sparseScore: number): number {
  const dense = Math.max(0, denseScore);
  const sparse = Math.max(0, sparseScore);
  if (dense > 0) {
    return dense * 0.84 + sparse * 0.16;
  }

  return sparse;
}

export function formatSearchResults(response: SearchResponse): string {
  const payload = {
    catalysts: response.catalysts.map((match) => ({
      entity: match.catalyst.entityName,
      id: match.catalyst.id,
      score: Number(match.score.toFixed(6)),
      text: match.catalyst.text,
    })),
    query: response.query,
    results: response.results,
    target: response.target,
    vaultPath: response.vaultPath,
  };

  return JSON.stringify(payload, null, 2);
}

export function formatPetri(response: PetriResponse): string {
  return JSON.stringify(response, null, 2);
}

export function summarizeResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No matching documents found.";
  }

  return results
    .map((result, index) => {
      const relative = path.relative(process.cwd(), result.filePath);
      return `${index + 1}. ${result.title} (${relative}) score=${result.score}`;
    })
    .join("\n");
}
