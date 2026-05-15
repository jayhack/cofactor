import { promises as fs } from "node:fs";
import path from "node:path";

import type { AppliedTarget, GardenIndex, IndexConfig } from "../types.js";
import { CONFIG_FILE, INDEX_FILE, STORE_DIR, TARGETS_DIR, mergeConfig } from "./defaults.js";

export function storePath(vaultPath: string): string {
  return path.join(path.resolve(vaultPath), STORE_DIR);
}

export function indexPath(vaultPath: string): string {
  return path.join(storePath(vaultPath), INDEX_FILE);
}

export function configPath(vaultPath: string): string {
  return path.join(storePath(vaultPath), CONFIG_FILE);
}

export function targetsPath(vaultPath: string): string {
  return path.join(storePath(vaultPath), TARGETS_DIR);
}

export function targetIndexPath(vaultPath: string, targetId: string): string {
  return path.join(targetsPath(vaultPath), `${targetId}.json`);
}

export async function readConfig(vaultPath: string): Promise<IndexConfig> {
  try {
    const raw = await fs.readFile(configPath(vaultPath), "utf8");
    return mergeConfig(JSON.parse(raw) as Partial<IndexConfig>);
  } catch (error) {
    if (isNotFound(error)) {
      return mergeConfig();
    }
    throw error;
  }
}

export async function writeConfig(vaultPath: string, config: IndexConfig): Promise<void> {
  await fs.mkdir(storePath(vaultPath), { recursive: true });
  await fs.writeFile(configPath(vaultPath), `${JSON.stringify(config, null, 2)}\n`);
}

export async function readIndex(vaultPath: string): Promise<GardenIndex> {
  const raw = await fs.readFile(indexPath(vaultPath), "utf8");
  return JSON.parse(raw) as GardenIndex;
}

export async function writeIndex(vaultPath: string, index: GardenIndex): Promise<void> {
  await fs.mkdir(storePath(vaultPath), { recursive: true });
  await fs.writeFile(indexPath(vaultPath), `${JSON.stringify(index, null, 2)}\n`);
}

export async function readTargetIndex(vaultPath: string, target: string): Promise<GardenIndex> {
  const baseIndex = await readIndex(vaultPath);
  const appliedTarget = resolveAppliedTarget(baseIndex.appliedTargets, target);
  if (!appliedTarget) {
    throw new Error(`No applied target matches "${target}". Run enzyme-garden apply ${target} first.`);
  }

  const raw = await fs.readFile(appliedTarget.indexPath, "utf8");
  return JSON.parse(raw) as GardenIndex;
}

export async function writeTargetIndex(vaultPath: string, targetId: string, index: GardenIndex): Promise<string> {
  await fs.mkdir(targetsPath(vaultPath), { recursive: true });
  const filePath = targetIndexPath(vaultPath, targetId);
  await fs.writeFile(filePath, `${JSON.stringify(index, null, 2)}\n`);
  return filePath;
}

export function resolveAppliedTarget(
  targets: AppliedTarget[],
  requested: string,
): AppliedTarget | undefined {
  const absolute = path.resolve(requested);
  return targets.find(
    (target) =>
      target.id === requested ||
      target.path === requested ||
      target.path === absolute ||
      path.basename(target.path) === requested,
  );
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
