# enzyme-garden

`enzyme-garden` is a local-first memory index for Markdown corpora and AI agents. It scans notes, extracts structural signals, precomputes catalyst questions, and searches documents through those catalysts without sending private text to a model at query time.

This package is an independent JavaScript/TypeScript implementation inspired by the public behavior of [enzyme.garden](https://www.enzyme.garden/). It is not the original Enzyme CLI.

## Install

```sh
npm install -g enzyme-garden
```

For one-off use:

```sh
npx enzyme-garden init ./notes
```

## CLI

Index a Markdown corpus:

```sh
enzyme-garden init ./notes
```

Inspect the local petri dish of entities and catalysts:

```sh
enzyme-garden petri ./notes --json
```

Ask a search question:

```sh
enzyme-garden catalyze "why did auth change direction around rollback?" --vault ./notes --json
```

Apply one corpus's catalysts to another local corpus:

```sh
enzyme-garden apply ../project-docs --vault ./notes
enzyme-garden catalyze "session recovery tradeoffs" --vault ./notes --target project-docs --json
```

Install agent instructions:

```sh
enzyme-garden agents codex .
enzyme-garden agents claude .
```

Run an MCP stdio server:

```sh
enzyme-garden mcp ./notes
```

## What It Indexes

`enzyme-garden` extracts local structure from Markdown, MDX, and text files:

- frontmatter tags, inline hashtags, folders, and wiki links
- creation/update timestamps from frontmatter or file metadata
- document chunks and sparse TF-IDF vectors
- deterministic catalyst questions for each salient entity
- precomputed catalyst-to-document links

The index is stored under `.enzyme-garden/` in the corpus root. Add that directory to `.gitignore` unless you intentionally want to version the generated memory.

## SDK

```ts
import { catalyze, indexVault, petri } from "enzyme-garden";

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
| `init [vault]` | scan a corpus and write `.enzyme-garden/index.json` |
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

Publishing will require an npm account with permission to publish `enzyme-garden`.
