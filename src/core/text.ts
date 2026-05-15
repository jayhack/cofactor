import type { Frontmatter } from "../types.js";

const stopwords = new Set([
  "a",
  "about",
  "above",
  "after",
  "again",
  "against",
  "all",
  "also",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "me",
  "more",
  "most",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "now",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
]);

const aliases: Record<string, string[]> = {
  auth: ["authentication", "identity", "login", "session"],
  authentication: ["auth", "identity", "login", "session"],
  build: ["ship", "implement", "create", "make"],
  changed: ["shift", "pivot", "direction", "rewrite"],
  change: ["shift", "pivot", "direction", "rewrite"],
  complexity: ["risk", "friction", "maintenance", "tradeoff"],
  cost: ["budget", "price", "expense", "tradeoff"],
  decision: ["choice", "adr", "direction", "tradeoff"],
  direction: ["change", "shift", "strategy", "decision"],
  memory: ["recall", "context", "knowledge", "notes"],
  notes: ["memory", "knowledge", "writing", "docs"],
  problem: ["issue", "risk", "blocker", "challenge"],
  search: ["retrieval", "recall", "find", "lookup"],
  session: ["auth", "authentication", "identity", "login"],
  tension: ["tradeoff", "conflict", "risk", "constraint"],
  user: ["customer", "person", "people", "reader"],
};

export function extractFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    return { frontmatter: {}, body: raw };
  }

  const normalized = raw.replace(/\r\n/g, "\n");
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    return { frontmatter: {}, body: raw };
  }

  const block = normalized.slice(4, end);
  const body = normalized.slice(end + "\n---\n".length);
  return { frontmatter: parseSimpleYaml(block), body };
}

export function parseSimpleYaml(block: string): Frontmatter {
  const data: Frontmatter = {};
  const lines = block.split("\n");
  let activeArrayKey: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }

    const itemMatch = line.match(/^\s*-\s+(.+)$/);
    if (itemMatch && activeArrayKey) {
      const current = data[activeArrayKey];
      const values = Array.isArray(current) ? current : [];
      values.push(cleanYamlValue(itemMatch[1] ?? ""));
      data[activeArrayKey] = values;
      continue;
    }

    activeArrayKey = undefined;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1]!.toLowerCase();
    const value = match[2] ?? "";
    if (!value.trim()) {
      data[key] = [];
      activeArrayKey = key;
      continue;
    }

    const arrayMatch = value.trim().match(/^\[(.*)]$/);
    if (arrayMatch) {
      data[key] = arrayMatch[1]!
        .split(",")
        .map(cleanYamlValue)
        .filter(Boolean);
      continue;
    }

    data[key] = cleanYamlValue(value);
  }

  return data;
}

export function cleanYamlValue(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function frontmatterDate(frontmatter: Frontmatter, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = frontmatter[key];
    if (typeof value === "string" && value.trim()) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  return undefined;
}

export function frontmatterList(frontmatter: Frontmatter, key: string): string[] {
  const value = frontmatter[key];
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(normalizeTag).filter(Boolean);
  }

  return value
    .split(",")
    .map(normalizeTag)
    .filter(Boolean);
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

export function markdownTitle(body: string, fallback: string): string {
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading?.[1]) {
    return heading[1].trim();
  }

  return fallback.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

export function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?]]/g, "$2 $1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string, includeAliases = true): string[] {
  const normalized = stripMarkdown(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
  const base = normalized
    .split(/\s+/)
    .map(stem)
    .filter((token) => token.length > 1 && !stopwords.has(token));

  if (!includeAliases) {
    return base;
  }

  const expanded: string[] = [];
  for (const token of base) {
    expanded.push(token);
    const synonymSet = aliases[token];
    if (synonymSet) {
      expanded.push(...synonymSet.map(stem));
    }
  }

  return expanded;
}

export function topTerms(tokens: string[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

export function phraseTerms(text: string, limit = 8): string[] {
  const tokens = tokenize(text, false);
  const counts = new Map<string, number>();
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      const phrase = tokens.slice(index, index + size).join(" ");
      if (phrase.length > 4) {
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

export function splitWords(text: string): string[] {
  return stripMarkdown(text).split(/\s+/).filter(Boolean);
}

export function chunkByWords(text: string, chunkSize: number, overlap: number): string[] {
  const words = splitWords(text);
  if (words.length <= chunkSize) {
    return [words.join(" ")];
  }

  const chunks: string[] = [];
  const step = Math.max(1, chunkSize - overlap);
  for (let start = 0; start < words.length; start += step) {
    const chunk = words.slice(start, start + chunkSize).join(" ");
    if (chunk.trim()) {
      chunks.push(chunk);
    }
    if (start + chunkSize >= words.length) {
      break;
    }
  }

  return chunks;
}

export function snippet(text: string, maxChars = 900): string {
  const clean = stripMarkdown(text);
  if (clean.length <= maxChars) {
    return clean;
  }

  return `${clean.slice(0, maxChars - 1).trim()}...`;
}

function stem(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }
  if (token.length > 4 && token.endsWith("ied")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 4 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }
  if (token.length > 4 && token.endsWith("es")) {
    return token.slice(0, -2);
  }
  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
}
