import { describe, expect, it } from "vitest";

import { extractEntities, entityId } from "../src/core/entities.js";
import { extractFrontmatter } from "../src/core/text.js";

describe("entity extraction", () => {
  it("extracts frontmatter tags, inline tags, wiki links, and folder entities", () => {
    const raw = `---
tags: [Research, agent-memory]
---
# Note

This connects #LocalFirst with [[Catalyst Question|catalysts]] and [[Agent Memory]].
`;
    const { body, frontmatter } = extractFrontmatter(raw);
    const result = extractEntities(body, frontmatter, "projects/memory/note.md");

    expect(result.tags).toEqual(["agent-memory", "localfirst", "research"]);
    expect(result.links).toEqual(["Agent Memory", "Catalyst Question"]);
    expect(result.folders).toEqual([".", "projects", "projects/memory"]);
    expect(result.entityIds).toContain(entityId("tag", "research"));
    expect(result.entityIds).toContain(entityId("link", "Agent Memory"));
    expect(result.entityIds).toContain(entityId("folder", "projects/memory"));
  });
});
