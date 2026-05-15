import { promises as fs } from "node:fs";
import path from "node:path";

import type { GardenDocument, IndexConfig } from "../types.js";
import { extractEntities } from "./entities.js";
import {
  extractFrontmatter,
  frontmatterDate,
  markdownTitle,
  splitWords,
  stripMarkdown,
} from "./text.js";

export async function discoverDocuments(rootPath: string, config: IndexConfig): Promise<GardenDocument[]> {
  const root = path.resolve(rootPath);
  const files = await walk(root, config);
  const sortedFiles = files.sort((a, b) => a.localeCompare(b)).slice(0, config.maxFiles);
  const documents = await Promise.all(
    sortedFiles.map(async (filePath) => readDocument(root, filePath)),
  );

  return documents.filter((document) => document.wordCount > 0);
}

async function readDocument(root: string, filePath: string): Promise<GardenDocument> {
  const content = await fs.readFile(filePath, "utf8");
  const stat = await fs.stat(filePath);
  const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
  const { frontmatter, body } = extractFrontmatter(content);
  const cleanText = stripMarkdown(body);
  const fallbackCreated = stat.birthtimeMs > 0 ? stat.birthtime : stat.mtime;
  const createdAt =
    frontmatterDate(frontmatter, ["created", "created_at", "date"]) ?? fallbackCreated.toISOString();
  const modifiedAt =
    frontmatterDate(frontmatter, ["modified", "updated", "updated_at"]) ?? stat.mtime.toISOString();
  const extracted = extractEntities(body, frontmatter, relativePath);

  return {
    content: body,
    createdAt,
    entities: extracted.entityIds,
    folders: extracted.folders,
    frontmatter,
    id: stableFileId(relativePath),
    links: extracted.links,
    modifiedAt,
    path: filePath,
    relativePath,
    tags: extracted.tags,
    title: markdownTitle(body, path.basename(filePath)),
    wordCount: splitWords(cleanText).length,
  };
}

async function walk(root: string, config: IndexConfig): Promise<string[]> {
  const files: string[] = [];
  const excluded = new Set(config.excludedDirs);
  const extensions = new Set(config.extensions.map((extension) => extension.toLowerCase()));

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) {
          await visit(absolutePath);
        }
        continue;
      }

      if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(absolutePath);
      }
    }
  }

  await visit(root);
  return files;
}

function stableFileId(relativePath: string): string {
  return Buffer.from(relativePath).toString("base64url");
}
