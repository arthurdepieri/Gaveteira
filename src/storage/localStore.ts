import { AppData } from "../types";
import { defaultStatuses } from "../data/catalog";
import { initialData } from "../data/mockData";

const STORAGE_KEY = "gaveteira-da-vida:v1";
const DEFAULT_SETTINGS = { apiKeys: {}, cloud: {} };

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    saveData(initialData);
    return initialData;
  }

  try {
    const parsed = JSON.parse(raw) as AppData;
    return {
      version: parsed.version ?? 1,
      items: parsed.items ?? [],
      statuses: { ...defaultStatuses, ...(parsed.statuses ?? {}) },
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}), apiKeys: parsed.settings?.apiKeys ?? {}, cloud: parsed.settings?.cloud ?? {} },
    };
  } catch {
    saveData(initialData);
    return initialData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportData(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gaveteira-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseImportedData(text: string): AppData {
  const parsed = JSON.parse(text) as AppData;
  if (!Array.isArray(parsed.items) || !parsed.statuses) {
    throw new Error("Arquivo JSON invalido para a Gaveteira.");
  }

  return {
    version: parsed.version ?? 1,
    items: parsed.items,
    statuses: { ...defaultStatuses, ...parsed.statuses },
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}), apiKeys: parsed.settings?.apiKeys ?? {}, cloud: parsed.settings?.cloud ?? {} },
  };
}
