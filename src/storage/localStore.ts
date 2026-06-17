import { AppData } from "../types";
import { defaultStatuses } from "../data/catalog";
import { withoutLegacyDemoItems } from "../utils/legacyDemoItems";
import { migrateLocalJsonToIndexedDb, readIndexedJson, readLocalJson, writeStoredJson } from "./browserStore";

const STORAGE_KEY = "gaveteira-da-vida:v1";
const DEFAULT_SETTINGS = { theme: "system" as const, apiKeys: {}, cloud: {} };

export function createEmptyData(): AppData {
  return {
    version: 1,
    items: [],
    statuses: defaultStatuses,
    settings: DEFAULT_SETTINGS,
  };
}

export async function loadData(): Promise<AppData> {
  let indexedReadFailed = false;

  if (typeof indexedDB !== "undefined") {
    try {
      const indexedData = await readIndexedJson<AppData>(STORAGE_KEY);
      if (indexedData) return normalizeData(indexedData);
    } catch {
      indexedReadFailed = true;
      const fallbackData = readLocalJson<AppData>(STORAGE_KEY);
      if (fallbackData) return normalizeData(fallbackData);
    }
  }

  try {
    const migrated = await migrateLocalJsonToIndexedDb<AppData>(STORAGE_KEY, normalizeData);
    if (migrated) return migrated;
  } catch {
    const legacyData = readLocalJson<AppData>(STORAGE_KEY);
    if (legacyData) return normalizeData(legacyData);
  }

  if (indexedReadFailed) {
    throw new Error("Nao consegui abrir o armazenamento local da Gaveteira neste navegador.");
  }

  const data = createEmptyData();
  await saveData(data);
  return data;
}

export async function saveData(data: AppData) {
  await writeStoredJson(STORAGE_KEY, normalizeData(data));
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
  const parsed = JSON.parse(text) as AppData | { data?: AppData };
  const source = "data" in parsed && parsed.data ? parsed.data : parsed as AppData;

  if (!Array.isArray(source.items) || !source.statuses) {
    throw new Error("Este JSON não parece ser um backup válido da Gaveteira.");
  }

  return normalizeData(source);
}

function normalizeData(data: AppData): AppData {
  return {
    version: data.version ?? 1,
    items: withoutLegacyDemoItems(data.items ?? []),
    statuses: { ...defaultStatuses, ...(data.statuses ?? {}) },
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data.settings ?? {}),
      apiKeys: data.settings?.apiKeys ?? {},
      cloud: data.settings?.cloud ?? {},
    },
  };
}
