import crypto from "node:crypto";
import path from "node:path";

import type { AppliedTarget, ApplyResponse, GardenIndex, IndexOptions } from "../types.js";
import { refreshCatalystTopChunks } from "./catalysts.js";
import { createIndex } from "./indexer.js";
import { readConfig, readIndex, writeIndex, writeTargetIndex } from "./store.js";
import { vectorizeTokens } from "./vector.js";

export async function applyCorpus(
  vaultPath: string,
  targetPathInput: string,
  options: IndexOptions = {},
): Promise<ApplyResponse> {
  const targetPath = path.resolve(targetPathInput);
  const vaultIndex = await readIndex(vaultPath);
  const config = options.config ? { ...vaultIndex.config, ...options.config } : await readConfig(vaultPath);
  const targetIndex = await createIndex(targetPath, { config }, "target", path.resolve(vaultPath));
  targetIndex.idf = vaultIndex.idf;
  targetIndex.chunks = targetIndex.chunks.map((chunk) => ({
    ...chunk,
    vector: vectorizeTokens(chunk.tokens, vaultIndex.idf),
  }));
  targetIndex.catalysts = refreshCatalystTopChunks(vaultIndex.catalysts, targetIndex.chunks);
  targetIndex.entities = [];
  targetIndex.stats = {
    ...targetIndex.stats,
    catalystCount: targetIndex.catalysts.length,
    entityCount: 0,
  };

  const id = targetId(targetPath);
  const indexFilePath = await writeTargetIndex(vaultPath, id, targetIndex);
  const appliedTarget: AppliedTarget = {
    appliedAt: new Date().toISOString(),
    docCount: targetIndex.documents.length,
    id,
    indexPath: indexFilePath,
    path: targetPath,
  };
  const remainingTargets = vaultIndex.appliedTargets.filter((target) => target.id !== id);
  const nextVaultIndex: GardenIndex = {
    ...vaultIndex,
    appliedTargets: [...remainingTargets, appliedTarget].sort((a, b) => a.path.localeCompare(b.path)),
  };
  await writeIndex(vaultPath, nextVaultIndex);

  return {
    target: appliedTarget,
    targetIndex,
    vaultIndex: nextVaultIndex,
  };
}

function targetId(targetPath: string): string {
  return crypto.createHash("sha1").update(path.resolve(targetPath)).digest("hex").slice(0, 12);
}
