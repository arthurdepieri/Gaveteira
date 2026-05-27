import { AppData } from "../types";

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

export function loadSafetySnapshots(): SafetySnapshot[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isSafetySnapshot)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, SNAPSHOT_RETENTION);
  } catch {
    return [];
  }
}

export function createSafetySnapshot(
  data: AppData,
  reason: SnapshotReason,
  options: { label?: string; appVersion?: string; schemaVersion?: number } = {},
) {
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

  const snapshots = [snapshot, ...loadSafetySnapshots()].slice(0, SNAPSHOT_RETENTION);
  saveSafetySnapshots(snapshots);
  return snapshot;
}

export function removeSafetySnapshot(snapshotId: string) {
  const snapshots = loadSafetySnapshots().filter((snapshot) => snapshot.id !== snapshotId);
  saveSafetySnapshots(snapshots);
  return snapshots;
}

export function snapshotIfRuntimeChanged(data: AppData, appVersion: string) {
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

function saveSafetySnapshots(snapshots: SafetySnapshot[]) {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots.slice(0, SNAPSHOT_RETENTION)));
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
