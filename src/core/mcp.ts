import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { catalyze, petri } from "./search.js";

export async function runMcpServer(defaultVaultPath = process.cwd()): Promise<void> {
  const server = new McpServer({
    name: "cofactor",
    version: "0.1.0",
  });

  server.registerTool(
    "petri",
    {
      description:
        "Inspect the local Cofactor entity/catalyst graph for working memory before broad reasoning tasks.",
      inputSchema: {
        query: z.string().optional().describe("Optional query for narrowing entities and catalysts."),
        vaultPath: z.string().optional().describe("Path to the indexed vault. Defaults to the server cwd."),
      },
    },
    async ({ query, vaultPath }) => {
      const response = await petri(vaultPath ?? defaultVaultPath, query);
      return {
        content: [
          {
            text: JSON.stringify(response, null, 2),
            type: "text",
          },
        ],
      };
    },
  );

  server.registerTool(
    "catalyze",
    {
      description:
        "Search an indexed local corpus through precomputed catalyst questions and return relevant documents.",
      inputSchema: {
        limit: z.number().int().positive().optional().describe("Maximum number of results."),
        query: z.string().min(1).describe("Search question."),
        target: z.string().optional().describe("Optional applied target id, path, or basename."),
        vaultPath: z.string().optional().describe("Path to the indexed vault. Defaults to the server cwd."),
      },
    },
    async ({ limit, query, target, vaultPath }) => {
      const response = await catalyze(query, {
        limit,
        target,
        vaultPath: vaultPath ?? defaultVaultPath,
      });
      return {
        content: [
          {
            text: JSON.stringify(response, null, 2),
            type: "text",
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
