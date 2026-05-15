import { describe, expect, it } from "vitest";

import { catalyze, indexVault } from "../src/index.js";
import { seedVault, tempDir } from "./helpers.js";

describe("catalyze", () => {
  it("returns relevant notes with contributing catalyst ids", async () => {
    const root = await tempDir("search");
    await seedVault(root);
    await indexVault(root);

    const response = await catalyze("why did auth change direction around rollback and trust?", {
      limit: 2,
      vaultPath: root,
    });

    expect(response.catalysts.length).toBeGreaterThan(0);
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]!.title).toMatch(/Auth|Authentication/);
    expect(response.results[0]!.catalystIds.length).toBeGreaterThan(0);
  });
});
