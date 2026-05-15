import path from "node:path";

import type { GardenIndex, IndexOptions } from "./types.js";
import { createIndex } from "./core/indexer.js";
import { readConfig, readIndex, writeConfig, writeIndex } from "./core/store.js";

export * from "./types.js";
export { applyCorpus } from "./core/apply.js";
export { installAgentInstructions } from "./core/agents.js";
export { createIndex } from "./core/indexer.js";
export { runMcpServer } from "./core/mcp.js";
export { catalyze, formatPetri, formatSearchResults, petri, searchIndex } from "./core/search.js";
export { readConfig, readIndex, readTargetIndex } from "./core/store.js";

export async function indexVault(
  vaultPathInput = process.cwd(),
  options: IndexOptions = {},
): Promise<GardenIndex> {
  const vaultPath = path.resolve(vaultPathInput);
  const previousConfig = await readConfig(vaultPath);
  const config = options.config ? { ...previousConfig, ...options.config } : previousConfig;
  const index = await createIndex(vaultPath, { ...options, config });

  await writeConfig(vaultPath, config);
  await writeIndex(vaultPath, index);
  return index;
}

export async function loadIndex(vaultPathInput = process.cwd()): Promise<GardenIndex> {
  return readIndex(path.resolve(vaultPathInput));
}

export async function refreshVault(
  vaultPathInput = process.cwd(),
  options: IndexOptions = {},
): Promise<GardenIndex> {
  return indexVault(vaultPathInput, options);
}
