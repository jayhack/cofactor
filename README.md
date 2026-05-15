# Cofactor

Cofactor is a local-first memory index for Markdown corpora and AI agents. It scans notes, extracts structural signals, precomputes catalyst-style questions, and searches documents through those questions without sending private text to a model at query time.

Landing page: [Cofactor](https://jayhack.github.io/cofactor/)

## Install

```sh
npm install -g cofactor-memory
```

For one-off use:

```sh
npx cofactor-memory init ./notes
```

## CLI

Index a Markdown corpus:

```sh
cofactor init ./notes
```

Inspect the local petri dish of entities and catalysts:

```sh
cofactor petri ./notes --json
```

Ask a search question:

```sh
cofactor catalyze "why did auth change direction around rollback?" --vault ./notes --json
```

Apply one corpus's catalysts to another local corpus:

```sh
cofactor apply ../project-docs --vault ./notes
cofactor catalyze "session recovery tradeoffs" --vault ./notes --target project-docs --json
```

Install agent instructions:

```sh
cofactor agents codex .
cofactor agents claude .
```

Run an MCP stdio server:

```sh
cofactor mcp ./notes
```

## What It Indexes

Cofactor extracts local structure from Markdown, MDX, and text files:

- frontmatter tags, inline hashtags, folders, and wiki links
- creation/update timestamps from frontmatter or file metadata
- document chunks and sparse TF-IDF vectors
- deterministic catalyst-style questions for each salient entity
- precomputed question-to-document links

The index is stored under `.cofactor/` in the corpus root. Add that directory to `.gitignore` unless you intentionally want to version the generated memory.

## SDK

```ts
import { catalyze, indexVault, petri } from "cofactor-memory";

await indexVault("./notes");

const graph = await petri("./notes");
const results = await catalyze("where did we decide to rewrite auth?", {
  vaultPath: "./notes",
  limit: 5,
});

console.log(graph.entities);
console.log(results.results);
```

## Commands

| Command | Purpose |
| --- | --- |
| `init [vault]` | scan a corpus and write `.cofactor/index.json` |
| `refresh [vault]` | alias for `init` |
| `petri [vault]` | print entity and catalyst working memory |
| `catalyze <query>` | search through catalysts and return relevant notes |
| `apply <target>` | project current vault catalysts onto another corpus |
| `agents <codex\|claude>` | install agent instructions |
| `mcp [vault]` | expose `petri` and `catalyze` as MCP stdio tools |
| `status [vault]` | report index metadata |

## Development

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm publish --dry-run
```

Publishing will require an npm account with permission to publish `cofactor-memory`.
