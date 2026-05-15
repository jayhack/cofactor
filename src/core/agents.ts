import { promises as fs } from "node:fs";
import path from "node:path";

import { STORE_DIR } from "./defaults.js";

export type AgentName = "codex" | "claude";

const startMarker = "<!-- enzyme-garden:start -->";
const endMarker = "<!-- enzyme-garden:end -->";

export async function installAgentInstructions(
  vaultPathInput: string,
  agent: AgentName,
): Promise<{ files: string[] }> {
  const vaultPath = path.resolve(vaultPathInput);
  const files: string[] = [];

  if (agent === "codex") {
    const agentsFile = path.join(vaultPath, "AGENTS.md");
    await upsertBlock(agentsFile, codexBlock());
    files.push(agentsFile);

    const skillDir = path.join(vaultPath, ".agents", "skills", "enzyme-garden");
    await fs.mkdir(skillDir, { recursive: true });
    const skillFile = path.join(skillDir, "SKILL.md");
    await fs.writeFile(skillFile, codexSkill());
    files.push(skillFile);
    return { files };
  }

  const claudeFile = path.join(vaultPath, "CLAUDE.md");
  await upsertBlock(claudeFile, claudeBlock());
  files.push(claudeFile);
  return { files };
}

async function upsertBlock(filePath: string, block: string): Promise<void> {
  let existing = "";
  try {
    existing = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  const wrapped = `${startMarker}\n${block.trim()}\n${endMarker}`;
  const markerPattern = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`);
  const next = markerPattern.test(existing)
    ? existing.replace(markerPattern, wrapped)
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${wrapped}\n`;
  await fs.writeFile(filePath, next);
}

function codexBlock(): string {
  return `
## Enzyme Garden Memory

Use \`enzyme-garden petri --json\` before broad research or implementation work in this repository to load the local knowledge graph. Use \`enzyme-garden catalyze "<question>" --json\` when the current task needs relevant notes, decisions, or cross-corpus context. The same tools are exposed over stdio with \`enzyme-garden mcp\`. The index lives in \`${STORE_DIR}/\`; refresh it with \`enzyme-garden init\` after substantial note changes.
`;
}

function claudeBlock(): string {
  return `
## Enzyme Garden Memory

Before broad reasoning tasks, run \`enzyme-garden petri --json\` to inspect local entities and catalysts. For a specific question, run \`enzyme-garden catalyze "<question>" --json\` and use the returned catalysts plus documents as working memory. Claude Desktop can also run \`enzyme-garden mcp\` as a stdio MCP server. Refresh the index with \`enzyme-garden init\` when notes change.
`;
}

function codexSkill(): string {
  return `---
name: enzyme-garden
description: Use local Enzyme Garden memory before repository research, planning, or implementation tasks.
---

Run \`enzyme-garden petri --json\` to inspect indexed entities and catalysts for the current repository. Run \`enzyme-garden catalyze "<question>" --json\` to retrieve the most relevant indexed notes for a specific task. Use \`enzyme-garden mcp\` when a client supports Model Context Protocol tools over stdio.
`;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
