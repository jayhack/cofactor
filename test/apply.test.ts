import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyCorpus, catalyze, indexVault, loadIndex } from "../src/index.js";
import { seedVault, tempDir, testConfig, writeNote } from "./helpers.js";

describe("applyCorpus", () => {
  it("projects source catalysts onto an external corpus", async () => {
    const source = await tempDir("source");
    const target = await tempDir("target");
    await seedVault(source);
    await writeNote(
      target,
      "incoming/auth-plan.md",
      `---
created: 2025-05-01
---
# Incoming Auth Plan

The migration plan focuses on session recovery, audit log coverage, and rollback ownership before login polish.
`,
    );

    await indexVault(source, { config: testConfig });
    const applied = await applyCorpus(source, target);
    const refreshed = await loadIndex(source);
    const response = await catalyze("session recovery rollback ownership", {
      target: path.basename(target),
      vaultPath: source,
    });

    expect(applied.target.docCount).toBe(1);
    expect(refreshed.appliedTargets).toHaveLength(1);
    expect(response.results[0]!.title).toBe("Incoming Auth Plan");
  });
});
