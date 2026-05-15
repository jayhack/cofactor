#!/usr/bin/env node

import { Command } from "commander";

import { applyCorpus, indexVault, installAgentInstructions, loadIndex, runMcpServer } from "./index.js";
import type { AgentName } from "./core/agents.js";
import { isEmbeddingBackend } from "./core/embeddings.js";
import { formatPetri, formatSearchResults, petri, catalyze } from "./core/search.js";

const program = new Command();

program
  .name("cofactor")
  .description("Local-first catalytic memory for Markdown corpora and AI agents.")
  .version("0.1.1");

program
  .command("init")
  .argument("[vault]", "Markdown corpus to index", process.cwd())
  .option("--embedding-backend <backend>", "embedding backend: transformers or hash", embeddingBackendOption)
  .option("--embedding-batch-size <count>", "embedding batch size", integerOption)
  .option("--embedding-model <model>", "Transformers.js feature-extraction model")
  .option("--max-files <count>", "maximum files to index", integerOption)
  .option("--json", "print machine-readable output")
  .description("Scan a corpus and write .cofactor/index.json.")
  .action(
    async (
      vault: string,
      options: {
        embeddingBackend?: "transformers" | "hash";
        embeddingBatchSize?: number;
        embeddingModel?: string;
        json?: boolean;
        maxFiles?: number;
      },
    ) => {
      const config = {
        ...(options.embeddingBackend ? { embeddingBackend: options.embeddingBackend } : {}),
        ...(options.embeddingBatchSize ? { embeddingBatchSize: options.embeddingBatchSize } : {}),
        ...(options.embeddingModel ? { embeddingModel: options.embeddingModel } : {}),
        ...(options.maxFiles ? { maxFiles: options.maxFiles } : {}),
      };
      const index = await indexVault(vault, {
        config,
      });
      print(
        {
          embedding: index.embedding,
          generatedAt: index.generatedAt,
          path: index.vaultPath,
          stats: index.stats,
        },
        options.json,
      );
    },
  );

program
  .command("refresh")
  .argument("[vault]", "Markdown corpus to refresh", process.cwd())
  .option("--json", "print machine-readable output")
  .description("Alias for init.")
  .action(async (vault: string, options: { json?: boolean }) => {
    const index = await indexVault(vault);
    print(
      {
        generatedAt: index.generatedAt,
        path: index.vaultPath,
        stats: index.stats,
      },
      options.json,
    );
  });

program
  .command("petri")
  .argument("[vault]", "Indexed corpus", process.cwd())
  .option("-q, --query <query>", "filter catalysts by query")
  .option("--json", "print machine-readable output")
  .description("Show the local entity/catalyst graph that agents should keep in working memory.")
  .action(async (vault: string, options: { json?: boolean; query?: string }) => {
    const response = await petri(vault, options.query);
    if (options.json) {
      console.log(formatPetri(response));
      return;
    }

    printPetriSummary(response);
  });

program
  .command("catalyze")
  .argument("<query>", "search question")
  .option("-v, --vault <vault>", "indexed corpus", process.cwd())
  .option("-t, --target <target>", "applied target id, path, or basename")
  .option("-l, --limit <count>", "number of results", integerOption)
  .option("--json", "print machine-readable output")
  .option("--register", "accepted for compatibility; results are always returned on stdout")
  .description("Search through catalysts and return relevant local documents.")
  .action(
    async (
      query: string,
      options: { json?: boolean; limit?: number; register?: boolean; target?: string; vault: string },
    ) => {
      const response = await catalyze(query, {
        limit: options.limit,
        target: options.target,
        vaultPath: options.vault,
      });
      if (options.json) {
        console.log(formatSearchResults(response));
        return;
      }

      printSearchSummary(response);
    },
  );

program
  .command("apply")
  .argument("<target>", "external corpus to search with this vault's catalysts")
  .option("-v, --vault <vault>", "source indexed corpus", process.cwd())
  .option("--json", "print machine-readable output")
  .description("Project this vault's catalysts onto another local corpus.")
  .action(async (target: string, options: { json?: boolean; vault: string }) => {
    const response = await applyCorpus(options.vault, target);
    print(
      {
        source: response.vaultIndex.vaultPath,
        target: response.target,
        targetStats: response.targetIndex.stats,
      },
      options.json,
    );
  });

program
  .command("agents")
  .argument("<agent>", "codex or claude")
  .argument("[vault]", "repository/corpus root", process.cwd())
  .option("--json", "print machine-readable output")
  .description("Install agent instructions that teach tools to call cofactor.")
  .action(async (agent: string, vault: string, options: { json?: boolean }) => {
    if (agent !== "codex" && agent !== "claude") {
      throw new Error(`Unsupported agent "${agent}". Expected "codex" or "claude".`);
    }

    const response = await installAgentInstructions(vault, agent as AgentName);
    print(response, options.json);
  });

program
  .command("mcp")
  .argument("[vault]", "default indexed corpus for MCP tools", process.cwd())
  .description("Run an MCP stdio server exposing petri and catalyze tools.")
  .action(async (vault: string) => {
    await runMcpServer(vault);
  });

program
  .command("status")
  .argument("[vault]", "indexed corpus", process.cwd())
  .option("--json", "print machine-readable output")
  .description("Report whether the corpus has a Cofactor index.")
  .action(async (vault: string, options: { json?: boolean }) => {
    const index = await loadIndex(vault);
    print(
      {
        appliedTargets: index.appliedTargets,
        generatedAt: index.generatedAt,
        path: index.vaultPath,
        stats: index.stats,
        version: index.version,
      },
      options.json,
    );
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`cofactor: ${message}`);
  process.exitCode = 1;
});

function integerOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received "${value}"`);
  }

  return parsed;
}

function embeddingBackendOption(value: string): "transformers" | "hash" {
  if (!isEmbeddingBackend(value)) {
    throw new Error(`Expected embedding backend "transformers" or "hash", received "${value}"`);
  }

  return value;
}

function print(value: unknown, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  console.log(JSON.stringify(value, null, 2));
}

function printPetriSummary(response: Awaited<ReturnType<typeof petri>>): void {
  console.log(`Vault: ${response.vaultPath}`);
  console.log(
    `Documents: ${response.stats.documentCount}  Chunks: ${response.stats.chunkCount}  Entities: ${response.stats.entityCount}  Catalysts: ${response.stats.catalystCount}`,
  );
  if (response.appliedTargets.length > 0) {
    console.log(`Applied targets: ${response.appliedTargets.map((target) => target.path).join(", ")}`);
  }
  console.log("");
  console.log("Top entities:");
  for (const entity of response.entities.slice(0, 12)) {
    console.log(
      `- ${entity.name} (${entity.type}, ${entity.activityTrend}, docs=${entity.documentCount})`,
    );
  }
  console.log("");
  console.log("Catalysts:");
  for (const catalyst of response.catalysts.slice(0, 10)) {
    console.log(`- [${catalyst.id}] ${catalyst.text}`);
  }
}

function printSearchSummary(response: Awaited<ReturnType<typeof catalyze>>): void {
  console.log(`Query: ${response.query}`);
  if (response.target) {
    console.log(`Target: ${response.target}`);
  }
  console.log("");
  console.log("Catalysts:");
  for (const match of response.catalysts) {
    console.log(`- ${match.catalyst.text} (${match.score.toFixed(3)})`);
  }
  console.log("");
  console.log("Results:");
  for (const [index, result] of response.results.entries()) {
    console.log(`${index + 1}. ${result.title} (${result.filePath}) score=${result.score}`);
    console.log(`   ${result.content.slice(0, 220)}${result.content.length > 220 ? "..." : ""}`);
  }
}
