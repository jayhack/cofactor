import crypto from "node:crypto";

import type { DenseVector, EmbeddingBackend, EmbeddingMetadata, IndexConfig } from "../types.js";
import { tokenize } from "./text.js";

export interface Embedder {
  metadata: EmbeddingMetadata;
  embedDocuments(texts: string[]): Promise<DenseVector[]>;
  embedQuery(text: string): Promise<DenseVector>;
  embedQueries(texts: string[]): Promise<DenseVector[]>;
}

type FeatureExtractionPipeline = (
  texts: string | string[],
  options: { normalize: boolean; pooling: "mean" },
) => Promise<{ data: Float32Array | number[]; dims: number[]; tolist?: () => number[] | number[][] }>;

const pipelineCache = new Map<string, Promise<FeatureExtractionPipeline>>();

export async function createEmbedder(config: IndexConfig): Promise<Embedder> {
  if (config.embeddingBackend === "hash") {
    return new HashEmbedder(config);
  }

  return new TransformersEmbedder(config);
}

export function denseCosine(a: DenseVector | undefined, b: DenseVector | undefined): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / Math.sqrt(normA * normB);
}

class TransformersEmbedder implements Embedder {
  readonly metadata: EmbeddingMetadata;

  constructor(private readonly config: IndexConfig) {
    this.metadata = {
      backend: "transformers",
      dimensions: 384,
      model: config.embeddingModel,
      normalize: true,
      passagePrefix: config.embeddingPassagePrefix,
      queryPrefix: config.embeddingQueryPrefix,
    };
  }

  async embedDocuments(texts: string[]): Promise<DenseVector[]> {
    return this.embed(texts.map((text) => `${this.config.embeddingPassagePrefix}${text}`));
  }

  async embedQuery(text: string): Promise<DenseVector> {
    return (await this.embedQueries([text]))[0] ?? [];
  }

  async embedQueries(texts: string[]): Promise<DenseVector[]> {
    return this.embed(texts.map((text) => `${this.config.embeddingQueryPrefix}${text}`));
  }

  private async embed(texts: string[]): Promise<DenseVector[]> {
    if (texts.length === 0) {
      return [];
    }

    const extractor = await loadPipeline(this.config.embeddingModel);
    const batchSize = Math.max(1, this.config.embeddingBatchSize);
    const vectors: DenseVector[] = [];

    for (let start = 0; start < texts.length; start += batchSize) {
      const batch = texts.slice(start, start + batchSize);
      const output = await extractor(batch, { pooling: "mean", normalize: true });
      this.metadata.dimensions = embeddingColumns(output, batch.length);
      vectors.push(...tensorToVectors(output, batch.length));
    }

    return vectors;
  }
}

class HashEmbedder implements Embedder {
  readonly metadata: EmbeddingMetadata;
  private readonly dimensions = 384;

  constructor(private readonly config: IndexConfig) {
    this.metadata = {
      backend: "hash",
      dimensions: this.dimensions,
      model: "cofactor-hash-384",
      normalize: true,
      passagePrefix: config.embeddingPassagePrefix,
      queryPrefix: config.embeddingQueryPrefix,
    };
  }

  async embedDocuments(texts: string[]): Promise<DenseVector[]> {
    return texts.map((text) => this.embedText(`${this.config.embeddingPassagePrefix}${text}`));
  }

  async embedQuery(text: string): Promise<DenseVector> {
    return (await this.embedQueries([text]))[0] ?? [];
  }

  async embedQueries(texts: string[]): Promise<DenseVector[]> {
    return texts.map((text) => this.embedText(`${this.config.embeddingQueryPrefix}${text}`));
  }

  private embedText(text: string): DenseVector {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    for (const token of tokenize(text)) {
      const hash = crypto.createHash("sha256").update(token).digest();
      const index = hash.readUInt32BE(0) % this.dimensions;
      const sign = hash[4]! % 2 === 0 ? 1 : -1;
      vector[index] = (vector[index] ?? 0) + sign;
    }

    return normalizeDense(vector);
  }
}

async function loadPipeline(model: string): Promise<FeatureExtractionPipeline> {
  const existing = pipelineCache.get(model);
  if (existing) {
    return existing;
  }

  const promise = import("@huggingface/transformers")
    .then(async ({ env, pipeline }) => {
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      return (await pipeline("feature-extraction", model)) as FeatureExtractionPipeline;
    })
    .catch((error: unknown) => {
      pipelineCache.delete(model);
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not load local embedding model "${model}". Cofactor downloads Transformers.js ONNX weights on first use and then reuses the local cache. ${detail}`,
      );
    });

  pipelineCache.set(model, promise);
  return promise;
}

function tensorToVectors(
  output: { data: Float32Array | number[]; dims: number[]; tolist?: () => number[] | number[][] },
  expectedRows: number,
): DenseVector[] {
  const rows = output.dims[0] ?? expectedRows;
  const columns = embeddingColumns(output, expectedRows);
  const vectors: DenseVector[] = [];

  for (let row = 0; row < rows; row += 1) {
    const start = row * columns;
    const end = start + columns;
    vectors.push(normalizeDense(Array.from(output.data.slice(start, end))));
  }

  return vectors;
}

function embeddingColumns(
  output: { data: Float32Array | number[]; dims: number[] },
  expectedRows: number,
): number {
  const rows = output.dims[0] ?? expectedRows;
  return output.dims[1] ?? Math.floor(output.data.length / Math.max(1, rows));
}

function normalizeDense(vector: DenseVector): DenseVector {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

export function isEmbeddingBackend(value: string): value is EmbeddingBackend {
  return value === "transformers" || value === "hash";
}
