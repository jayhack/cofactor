import type { Vector } from "../types.js";
import { tokenize } from "./text.js";

export function buildIdf(tokenSets: string[][]): Vector {
  const docFrequency = new Map<string, number>();
  for (const tokens of tokenSets) {
    for (const token of new Set(tokens)) {
      docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
  }

  const count = Math.max(1, tokenSets.length);
  const idf: Vector = {};
  for (const [token, frequency] of docFrequency.entries()) {
    idf[token] = Math.log((count + 1) / (frequency + 1)) + 1;
  }

  return idf;
}

export function vectorizeText(text: string, idf: Vector): Vector {
  return vectorizeTokens(tokenize(text), idf);
}

export function vectorizeTokens(tokens: string[], idf: Vector): Vector {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const vector: Vector = {};
  const defaultIdf = Object.keys(idf).length > 0 ? Math.max(...Object.values(idf)) : 1;
  for (const [token, count] of counts.entries()) {
    vector[token] = (1 + Math.log(count)) * (idf[token] ?? defaultIdf);
  }

  return normalizeVector(vector);
}

export function normalizeVector(vector: Vector): Vector {
  const norm = Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0));
  if (!norm) {
    return vector;
  }

  const normalized: Vector = {};
  for (const [term, value] of Object.entries(vector)) {
    normalized[term] = value / norm;
  }

  return normalized;
}

export function cosine(a: Vector, b: Vector): number {
  let score = 0;
  const [small, large] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const [term, value] of Object.entries(small)) {
    score += value * (large[term] ?? 0);
  }

  return score;
}

export function topVectorTerms(vector: Vector, limit = 8): string[] {
  return Object.entries(vector)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}
