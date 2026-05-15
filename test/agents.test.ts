import { describe, expect, it } from "vitest";

import { installAgentInstructions } from "../src/index.js";
import { readText, tempDir } from "./helpers.js";

describe("installAgentInstructions", () => {
  it("writes codex instructions idempotently", async () => {
    const root = await tempDir("agents");

    await installAgentInstructions(root, "codex");
    await installAgentInstructions(root, "codex");
    const agents = await readText(root, "AGENTS.md");
    const skill = await readText(root, ".agents/skills/cofactor/SKILL.md");

    expect((agents.match(/cofactor:start/g) ?? []).length).toBe(1);
    expect(agents).toContain("cofactor petri");
    expect(skill).toContain("cofactor catalyze");
  });
});
