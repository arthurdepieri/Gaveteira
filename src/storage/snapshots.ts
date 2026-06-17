import { AppData } from "../types";
import { migrateLocalJsonToIndexedDb, readIndexedJson, readLocalJson, writeStoredJson } from "./browserStore";

export type SnapshotReason = "before-restore" | "version-change" | "manual";

export interface SafetySnapshot {
  id: string;
  createdAt: string;
  reason: SnapshotReason;
  label: string;
  appVersion: string;
  schemaVersion: number;
  itemCount: number;
  data: AppData;
}

interface RuntimeSignature {
  appVersion: string;
  schemaVersion: number;
}

const SNAPSHOTS_KEY = "gaveteira-safety-snapshots:v1";
const RUNTIME_SIGNATURE_KEY = "gaveteira-runtime-signature:v1";
const SNAPSHOT_RETENTION = 5;
export const CURRENT_SCHEMA_VERSION = 1;

export async function loadSafetySnapshots(): Promise<SafetySnapshot[]> {
  try {
    const indexed = await readIndexedJson<SafetySnapshot[]>(SNAPSHOTS_KEY);
    if (indexed) return normalizeSnapshots(indexed);
  } catch {
    return normalizeSnapshots(readLocalJson<SafetySnapshot[]>(SNAPSHOTS_KEY));
  }

  try {
    const migrated = await migrateLocalJsonToIndexedDb<SafetySnapshot[]>(SNAPSHOTS_KEY, normalizeSnapshots);
    if (migrated) return migrated;
  } catch {
    return normalizeSnapshots(readLocalJson<SafetySnapshot[]>(SNAPSHOTS_KEY));
  }

  return [];
}

export async function createSafetySnapshot(
  data: AppData,
  reason: SnapshotReason,
  options: { label?: string; appVersion?: string; schemaVersion?: number } = {},
): Promise<SafetySnapshot> {
  const snapshot: SafetySnapshot = {
    id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    reason,
    label: options.label || snapshotReasonLabel(reason),
    appVersion: options.appVersion || currentStoredSignature()?.appVersion || "local",
    schemaVersion: options.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    itemCount: data.items.length,
    data: cloneData(data),
  };

  const snapshots = [snapshot, ...await loadSafetySnapshots()].slice(0, SNAPSHOT_RETENTION);
  await saveSafetySnapshots(snapshots);
  return snapshot;
}

export async function removeSafetySnapshot(snapshotId: string) {
  const snapshots = (await loadSafetySnapshots()).filter((snapshot) => snapshot.id !== snapshotId);
  await saveSafetySnapshots(snapshots);
  return snapshots;
}

export async function snapshotIfRuntimeChanged(data: AppData, appVersion: string) {
  const nextSignature: RuntimeSignature = {
    appVersion: appVersion || "local",
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  const previousSignature = currentStoredSignature();

  localStorage.setItem(RUNTIME_SIGNATURE_KEY, JSON.stringify(nextSignature));

  if (!previousSignature) {
    return null;
  }

  const changed = previousSignature.appVersion !== nextSignature.appVersion
    || previousSignature.schemaVersion !== nextSignature.schemaVersion;

  if (!changed) return null;

  const previousLabel = `${previousSignature.appVersion} / schema ${previousSignature.schemaVersion}`;
  const nextLabel = `${nextSignature.appVersion} / schema ${nextSignature.schemaVersion}`;

  return createSafetySnapshot(data, "version-change", {
    appVersion: nextSignature.appVersion,
    schemaVersion: nextSignature.schemaVersion,
    label: `Antes de atualizar de ${previousLabel} para ${nextLabel}`,
  });
}

export function snapshotReasonLabel(reason: SnapshotReason) {
  if (reason === "before-restore") return "Antes de restaurar backup";
  if (reason === "version-change") return "Antes de atualizar versão/schema";
  return "Snapshot manual";
}

async function saveSafetySnapshots(snapshots: SafetySnapshot[]) {
  await writeStoredJson(SNAPSHOTS_KEY, normalizeSnapshots(snapshots));
}

function currentStoredSignature(): RuntimeSignature | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUNTIME_SIGNATURE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.appVersion !== "string" || typeof parsed.schemaVersion !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isSafetySnapshot(value: unknown): value is SafetySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SafetySnapshot>;
  return typeof candidate.id === "string"
    && typeof candidate.createdAt === "string"
    && typeof candidate.label === "string"
    && typeof candidate.itemCount === "number"
    && Boolean(candidate.data)
    && Array.isArray(candidate.data?.items);
}

function cloneData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}

function normalizeSnapshots(value: SafetySnapshot[] | null): SafetySnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isSafetySnapshot)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, SNAPSHOT_RETENTION);
}
