export type EntityType = "tag" | "link" | "folder";

export type ActivityTrend = "rising" | "active" | "stable" | "dormant";

export type Vector = Record<string, number>;

export interface IndexConfig {
  chunkOverlapWords: number;
  chunkSizeWords: number;
  excludedDirs: string[];
  extensions: string[];
  maxFiles: number;
  maxResults: number;
  minEntityDocuments: number;
  recencyHalfLifeDays: number;
  selectedEntityLimit: number;
}

export interface Frontmatter {
  [key: string]: string | string[] | undefined;
}

export interface GardenDocument {
  content: string;
  createdAt: string;
  entities: string[];
  folders: string[];
  frontmatter: Frontmatter;
  id: string;
  links: string[];
  modifiedAt: string;
  path: string;
  relativePath: string;
  tags: string[];
  title: string;
  wordCount: number;
}

export interface GardenChunk {
  content: string;
  createdAt: string;
  docId: string;
  entities: string[];
  filePath: string;
  id: string;
  modifiedAt: string;
  ordinal: number;
  relativePath: string;
  title: string;
  tokens: string[];
  vector: Vector;
}

export interface EntitySummary {
  activityTrend: ActivityTrend;
  catalystIds: string[];
  chunkCount: number;
  documentCount: number;
  firstSeen: string;
  frequency12m: number;
  id: string;
  lastSeen: string;
  name: string;
  score: number;
  topTerms: string[];
  type: EntityType;
}

export interface Catalyst {
  context: string;
  entityId: string;
  entityName: string;
  entityType: EntityType;
  era: string;
  id: string;
  terms: string[];
  text: string;
  topChunks: Array<{ chunkId: string; score: number }>;
  vector: Vector;
}

export interface AppliedTarget {
  appliedAt: string;
  docCount: number;
  id: string;
  indexPath: string;
  path: string;
}

export interface IndexStats {
  catalystCount: number;
  chunkCount: number;
  documentCount: number;
  entityCount: number;
}

export interface GardenIndex {
  appliedTargets: AppliedTarget[];
  catalysts: Catalyst[];
  chunks: GardenChunk[];
  config: IndexConfig;
  documents: GardenDocument[];
  entities: EntitySummary[];
  generatedAt: string;
  idf: Vector;
  kind: "vault" | "target";
  sourceVaultPath?: string;
  stats: IndexStats;
  targetPath?: string;
  vaultPath: string;
  version: string;
}

export interface IndexOptions {
  config?: Partial<IndexConfig>;
  quiet?: boolean;
}

export interface SearchOptions {
  limit?: number;
  target?: string;
  vaultPath?: string;
}

export interface CatalystMatch {
  catalyst: Catalyst;
  score: number;
}

export interface SearchResult {
  catalystIds: string[];
  content: string;
  filePath: string;
  score: number;
  title: string;
}

export interface SearchResponse {
  catalysts: CatalystMatch[];
  query: string;
  results: SearchResult[];
  target?: string;
  vaultPath: string;
}

export interface PetriResponse {
  appliedTargets: AppliedTarget[];
  catalysts: Catalyst[];
  entities: EntitySummary[];
  query?: string;
  stats: IndexStats;
  vaultPath: string;
}

export interface ApplyResponse {
  target: AppliedTarget;
  targetIndex: GardenIndex;
  vaultIndex: GardenIndex;
}
