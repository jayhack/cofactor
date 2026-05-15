import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { IndexConfig } from "../src/types.js";

export const testConfig = {
  embeddingBackend: "hash",
  embeddingBatchSize: 8,
} satisfies Partial<IndexConfig>;

export async function tempDir(name: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `cofactor-${name}-`));
}

export async function writeNote(root: string, relativePath: string, content: string): Promise<void> {
  const absolute = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, `${content.trim()}\n`);
}

export async function readText(root: string, relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), "utf8");
}

export async function seedVault(root: string): Promise<void> {
  await writeNote(
    root,
    "projects/auth/decision.md",
    `---
tags: [architecture, auth]
created: 2025-02-10
---
# Auth Session Rewrite

We chose a session-backed authentication rewrite after the old token path made rollback and user trust harder. The decision trades implementation speed for durable identity recovery and clearer audit trails.

Related: [[Identity Map]] and [[Rollback Plan]].
`,
  );

  await writeNote(
    root,
    "projects/auth/retro.md",
    `---
tags:
  - auth
  - retrospectives
created: 2025-04-02
---
# Authentication Retro

#auth stayed risky because the team changed direction late in the project. Session recovery, trust, audit logs, and rollback ownership became the blockers that mattered more than passwordless polish.
`,
  );

  await writeNote(
    root,
    "research/search.md",
    `---
tags: [retrieval, agents]
created: 2025-03-01
---
# Agent Memory Search

Agents need local recall over notes. A catalyst question can connect old decisions to new implementation work without sending private documents to a model at query time.
`,
  );
}
