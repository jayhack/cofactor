import crypto from "node:crypto";

import type {
  Catalyst,
  EntitySummary,
  EntityType,
  GardenChunk,
  GardenDocument,
  Vector,
} from "../types.js";
import type { Embedder } from "./embeddings.js";
import { denseCosine } from "./embeddings.js";
import { entityDisplayName, entityNameFromId, entityTypeFromId } from "./entities.js";
import { phraseTerms, tokenize, topTerms } from "./text.js";
import { maxIso, minIso, quarterLabel } from "./time.js";
import { cosine, vectorizeText } from "./vector.js";

type CatalystDraft = Omit<Catalyst, "embedding" | "topChunks"> & { entityChunkIds: string[] };

export async function buildCatalysts(
  entities: EntitySummary[],
  documents: GardenDocument[],
  chunks: GardenChunk[],
  idf: Vector,
  embedder: Embedder,
): Promise<Catalyst[]> {
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const drafts: CatalystDraft[] = [];

  for (const entity of entities) {
    const entityChunks = chunks.filter((chunk) => chunk.entities.includes(entity.id));
    if (entityChunks.length === 0) {
      continue;
    }

    const entityDocuments = [
      ...new Map(
        entityChunks
          .map((chunk) => documentById.get(chunk.docId))
          .filter((document): document is GardenDocument => Boolean(document))
          .map((document) => [document.id, document]),
      ).values(),
    ];
    const texts = entityChunks.map((chunk) => chunk.content).join("\n");
    const terms = pickTerms(texts, entity.topTerms);
    const timeline = entityDocuments.map((document) => document.createdAt).sort();
    const era = eraLabel(timeline);
    const displayName = entityDisplayName(entity.type, entity.name);
    const candidates = catalystTexts(displayName, entity.type, era, terms, entityChunks);

    for (const text of candidates) {
      const vector = vectorizeText(`${displayName} ${text} ${terms.join(" ")}`, idf);
      drafts.push({
        context: terms.slice(0, 5).join(" / "),
        entityChunkIds: entityChunks.map((chunk) => chunk.id),
        entityId: entity.id,
        entityName: entity.name,
        entityType: entity.type,
        era,
        id: catalystId(entity.id, text),
        terms,
        text,
        vector,
      });
    }
  }

  const embeddings = await embedder.embedQueries(
    drafts.map((draft) => `${draft.entityName} ${draft.text} ${draft.terms.join(" ")}`),
  );
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  return drafts.map((draft, index) => {
    const embedding = embeddings[index] ?? [];
    const entityChunks = draft.entityChunkIds
      .map((chunkId) => chunkById.get(chunkId))
      .filter((chunk): chunk is GardenChunk => Boolean(chunk));

    return {
      ...withoutEntityChunkIds(draft),
      embedding,
      topChunks: topChunksForCatalyst({ ...withoutEntityChunkIds(draft), embedding }, entityChunks),
    };
  });
}

export function refreshCatalystTopChunks(catalysts: Catalyst[], chunks: GardenChunk[]): Catalyst[] {
  return catalysts.map((catalyst) => ({
    ...catalyst,
    topChunks: topChunksForCatalyst(catalyst, chunks, 32),
  }));
}

function topChunksForCatalyst(
  catalyst: Pick<Catalyst, "embedding" | "vector">,
  chunks: GardenChunk[],
  limit = 24,
): Array<{ chunkId: string; score: number }> {
  return chunks
    .map((chunk) => ({
      chunkId: chunk.id,
      score: denseCosine(catalyst.embedding, chunk.embedding) || cosine(catalyst.vector, chunk.vector),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function withoutEntityChunkIds(draft: CatalystDraft): Omit<Catalyst, "embedding" | "topChunks"> {
  const { entityChunkIds, ...catalyst } = draft;
  void entityChunkIds;
  return catalyst;
}

function pickTerms(text: string, seedTerms: string[]): string[] {
  const phrases = phraseTerms(text, 6).map((term) => term.replace(/\s+/g, "_"));
  const words = topTerms(tokenize(text), 12);
  return [...new Set([...seedTerms, ...phrases, ...words])].slice(0, 10);
}

function catalystTexts(
  displayName: string,
  type: EntityType,
  era: string,
  terms: string[],
  chunks: GardenChunk[],
): string[] {
  const [a = "this thread", b = "nearby ideas", c = "older context", d = "new evidence"] = terms;
  const scope = type === "folder" ? displayName : `the ${displayName} material`;
  const sorted = [...chunks].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const earlyTerm = sorted.length > 1 ? topTerms(tokenize(sorted[0]!.content), 1)[0] ?? a : a;
  const recentTerm =
    sorted.length > 1 ? topTerms(tokenize(sorted[sorted.length - 1]!.content), 1)[0] ?? b : b;

  return [
    `What keeps connecting ${readable(a)} with ${readable(b)} across ${scope}?`,
    `Where does ${scope} show tension between ${readable(a)} and ${readable(c)}?`,
    `How did ${scope} shift from ${readable(earlyTerm)} toward ${readable(recentTerm)} during ${era}?`,
    `Which older notes about ${readable(c)} still matter when ${readable(d)} appears?`,
  ].filter((text, index, all) => all.indexOf(text) === index);
}

function eraLabel(dates: string[]): string {
  if (dates.length === 0) {
    return "unknown";
  }

  const first = quarterLabel(minIso(dates));
  const last = quarterLabel(maxIso(dates));
  return first === last ? first : `${first} to ${last}`;
}

function readable(term: string): string {
  return term.replace(/_/g, " ");
}

function catalystId(entityId: string, text: string): string {
  const hash = crypto.createHash("sha1").update(`${entityId}\n${text}`).digest("hex").slice(0, 12);
  return `cat_${hash}`;
}

export function hydrateCatalystEntities(catalysts: Catalyst[]): Catalyst[] {
  return catalysts.map((catalyst) => ({
    ...catalyst,
    entityName: catalyst.entityName || entityNameFromId(catalyst.entityId),
    entityType: catalyst.entityType || entityTypeFromId(catalyst.entityId),
  }));
}
