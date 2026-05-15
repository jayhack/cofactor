import type { IndexConfig } from "../types.js";

export const INDEX_VERSION = "0.1";

export const STORE_DIR = ".cofactor";

export const INDEX_FILE = "index.json";

export const CONFIG_FILE = "config.json";

export const TARGETS_DIR = "targets";

export const defaultConfig: IndexConfig = {
  chunkOverlapWords: 48,
  chunkSizeWords: 260,
  excludedDirs: [
    ".git",
    ".hg",
    ".svn",
    ".cofactor",
    ".obsidian",
    ".trash",
    ".venv",
    "coverage",
    "dist",
    "node_modules",
  ],
  extensions: [".md", ".mdx", ".txt"],
  maxFiles: 1024,
  maxResults: 8,
  minEntityDocuments: 1,
  recencyHalfLifeDays: 180,
  selectedEntityLimit: 48,
};

export function mergeConfig(overrides?: Partial<IndexConfig>): IndexConfig {
  if (!overrides) {
    return { ...defaultConfig, excludedDirs: [...defaultConfig.excludedDirs] };
  }

  return {
    ...defaultConfig,
    ...overrides,
    excludedDirs: overrides.excludedDirs ?? [...defaultConfig.excludedDirs],
    extensions: overrides.extensions ?? [...defaultConfig.extensions],
  };
}
