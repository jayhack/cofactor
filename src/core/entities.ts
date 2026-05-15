import path from "node:path";

import type { EntityType } from "../types.js";
import { frontmatterList, normalizeTag } from "./text.js";
import type { Frontmatter } from "../types.js";

export function entityId(type: EntityType, name: string): string {
  return `${type}:${normalizeEntityName(type, name)}`;
}

export function normalizeEntityName(type: EntityType, name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (type === "tag") {
    return normalizeTag(clean);
  }
  if (type === "folder") {
    return clean.replace(/^\/+|\/+$/g, "");
  }

  return clean;
}

export function entityDisplayName(type: EntityType, name: string): string {
  if (type === "tag") {
    return `#${name}`;
  }
  if (type === "link") {
    return `[[${name}]]`;
  }

  if (name === ".") {
    return "root folder";
  }

  return name ? `folder:${name}` : "folder:.";
}

export function entityTypeFromId(id: string): EntityType {
  const type = id.split(":", 1)[0];
  if (type === "tag" || type === "link" || type === "folder") {
    return type;
  }

  throw new Error(`Unknown entity type in id: ${id}`);
}

export function entityNameFromId(id: string): string {
  const separator = id.indexOf(":");
  return separator === -1 ? id : id.slice(separator + 1);
}

export function extractEntities(
  body: string,
  frontmatter: Frontmatter,
  relativePath: string,
): {
  entityIds: string[];
  folders: string[];
  links: string[];
  tags: string[];
} {
  const tags = new Set(frontmatterList(frontmatter, "tags"));
  const links = new Set<string>();
  const folders = new Set<string>(["."]);

  for (const match of body.matchAll(/(^|[\s([{>])#([A-Za-z][A-Za-z0-9_/-]{1,64})\b/g)) {
    const tag = normalizeTag(match[2] ?? "");
    if (tag) {
      tags.add(tag);
    }
  }

  for (const match of body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?]]/g)) {
    const link = normalizeEntityName("link", match[1] ?? "");
    if (link) {
      links.add(link);
    }
  }

  const dirname = path.dirname(relativePath).replace(/\\/g, "/");
  if (dirname !== ".") {
    const parts = dirname.split("/").filter(Boolean);
    for (let index = 0; index < parts.length; index += 1) {
      folders.add(parts.slice(0, index + 1).join("/"));
    }
  }

  const entityIds = [
    ...[...tags].map((name) => entityId("tag", name)),
    ...[...links].map((name) => entityId("link", name)),
    ...[...folders].map((name) => entityId("folder", name)),
  ];

  return {
    entityIds: [...new Set(entityIds)].sort(),
    folders: [...folders].sort(),
    links: [...links].sort(),
    tags: [...tags].sort(),
  };
}
