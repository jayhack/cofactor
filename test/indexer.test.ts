import { describe, expect, it } from "vitest";

import { indexVault, loadIndex } from "../src/index.js";
import { seedVault, tempDir, testConfig } from "./helpers.js";

describe("indexVault", () => {
  it("builds a persistent local index with entities and catalysts", async () => {
    const root = await tempDir("index");
    await seedVault(root);

    const index = await indexVault(root, { config: testConfig });
    const loaded = await loadIndex(root);

    expect(index.stats.documentCount).toBe(3);
    expect(index.stats.chunkCount).toBeGreaterThan(0);
    expect(index.embedding.backend).toBe("hash");
    expect(index.chunks[0]!.embedding).toHaveLength(384);
    expect(index.entities.some((entity) => entity.id === "tag:auth")).toBe(true);
    expect(index.catalysts.length).toBeGreaterThan(0);
    expect(loaded.generatedAt).toBe(index.generatedAt);
  });
});
