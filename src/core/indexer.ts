import path from "node:path";

import type {
  EntitySummary,
  GardenChunk,
  GardenDocument,
  GardenIndex,
  IndexOptions,
  Vector,
} from "../types.js";
import { buildCatalysts } from "./catalysts.js";
import { discoverDocuments } from "./discover.js";
import { INDEX_VERSION, mergeConfig } from "./defaults.js";
import { entityNameFromId, entityTypeFromId } from "./entities.js";
import { chunkByWords, tokenize, topTerms } from "./text.js";
import { frequencyInLastYear, inferTrend, maxIso, minIso, recencyScore } from "./time.js";
import { buildIdf, vectorizeTokens } from "./vector.js";

export async function createIndex(
  vaultPath: string,
  options: IndexOptions = {},
  kind: "vault" | "target" = "vault",
  sourceVaultPath?: string,
): Promise<GardenIndex> {
  const config = mergeConfig(options.config);
  const root = path.resolve(vaultPath);
  const documents = await discoverDocuments(root, config);
  const chunkShells = documents.flatMap((document) => documentChunks(document, config));
  const tokenSets = chunkShells.map((chunk) => chunk.tokens);
  const idf = buildIdf(tokenSets);
  const chunks = chunkShells.map((chunk) => ({
    ...chunk,
    vector: vectorizeTokens(chunk.tokens, idf),
  }));
  const entities = selectEntities(documents, chunks, idf, config.selectedEntityLimit);
  const catalysts = buildCatalysts(entities, documents, chunks, idf);
  const entityCatalystIds = new Map<string, string[]>();
  for (const catalyst of catalysts) {
    const list = entityCatalystIds.get(catalyst.entityId) ?? [];
    list.push(catalyst.id);
    entityCatalystIds.set(catalyst.entityId, list);
  }

  return {
    appliedTargets: [],
    catalysts,
    chunks,
    config,
    documents,
    entities: entities.map((entity) => ({
      ...entity,
      catalystIds: entityCatalystIds.get(entity.id) ?? [],
    })),
    generatedAt: new Date().toISOString(),
    idf,
    kind,
    sourceVaultPath,
    stats: {
      catalystCount: catalysts.length,
      chunkCount: chunks.length,
      documentCount: documents.length,
      entityCount: entities.length,
    },
    targetPath: kind === "target" ? root : undefined,
    vaultPath: root,
    version: INDEX_VERSION,
  };
}

function documentChunks(
  document: GardenDocument,
  config: ReturnType<typeof mergeConfig>,
): Array<Omit<GardenChunk, "vector">> {
  return chunkByWords(document.content, config.chunkSizeWords, config.chunkOverlapWords).map(
    (content, ordinal) => ({
      content,
      createdAt: document.createdAt,
      docId: document.id,
      entities: document.entities,
      filePath: document.path,
      id: `${document.id}:${ordinal}`,
      modifiedAt: document.modifiedAt,
      ordinal,
      relativePath: document.relativePath,
      title: document.title,
      tokens: tokenize(`${document.title} ${content}`),
    }),
  );
}

function selectEntities(
  documents: GardenDocument[],
  chunks: GardenChunk[],
  idf: Vector,
  limit: number,
): EntitySummary[] {
  const docsByEntity = new Map<string, GardenDocument[]>();
  const chunksByEntity = new Map<string, GardenChunk[]>();
  for (const document of documents) {
    for (const entity of document.entities) {
      const list = docsByEntity.get(entity) ?? [];
      list.push(document);
      docsByEntity.set(entity, list);
    }
  }
  for (const chunk of chunks) {
    for (const entity of chunk.entities) {
      const list = chunksByEntity.get(entity) ?? [];
      list.push(chunk);
      chunksByEntity.set(entity, list);
    }
  }

  const candidates: EntitySummary[] = [];
  for (const [id, entityDocuments] of docsByEntity.entries()) {
    const entityChunks = chunksByEntity.get(id) ?? [];
    const dates = entityDocuments.map((document) => document.createdAt);
    const type = entityTypeFromId(id);
    const name = entityNameFromId(id);
    const entityText = entityChunks.map((chunk) => chunk.content).join("\n");
    const terms = weightedTerms(entityText, idf);
    const score =
      entityDocuments.length * 2 +
      entityChunks.length +
      frequencyInLastYear(dates) * 1.5 +
      recencyScore(maxIso(dates), 180) * 2;

    candidates.push({
      activityTrend: inferTrend(dates),
      catalystIds: [],
      chunkCount: entityChunks.length,
      documentCount: entityDocuments.length,
      firstSeen: minIso(dates),
      frequency12m: frequencyInLastYear(dates),
      id,
      lastSeen: maxIso(dates),
      name,
      score,
      topTerms: terms,
      type,
    });
  }

  return candidates.sort((left, right) => right.score - left.score).slice(0, limit);
}

function weightedTerms(text: string, idf: Vector): string[] {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const scored = [...counts.entries()]
    .map(([token, count]) => [token, count * (idf[token] ?? 1)] as const)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([token]) => token);

  return scored.length ? scored : topTerms(tokens, 8);
}
