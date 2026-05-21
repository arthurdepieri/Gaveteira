import { Cloud, Download, GitMerge, KeyRound, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { AppData, AppSettings, Category, CloudSession, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { parseImportedData } from "../storage/localStore";
import { getMetadataProviders } from "../services/metadata";
import { fetchMyItems } from "../services/supabaseCloud";
import { getWorkKey } from "../utils/itemHelpers";
import { withoutLegacyDemoItems } from "../utils/legacyDemoItems";

type BackupScope = "local" | "cloud" | "merged";

interface BackupHistoryEntry {
  fileName: string;
  scope: BackupScope;
  itemCount: number;
  createdAt: string;
}

interface BackupPreview {
  fileName: string;
  data: AppData;
  items: CulturalItem[];
  added: CulturalItem[];
  updated: Array<{ incoming: CulturalItem; current: CulturalItem }>;
  ignored: CulturalItem[];
}

const BACKUP_HISTORY_KEY = "gaveteira-backup-history:v1";

export function SettingsView({
  data,
  settings,
  session,
  onReplaceData,
  onUpdateData,
}: {
  data: AppData;
  settings: AppSettings;
  session: CloudSession | null;
  onReplaceData: (data: AppData) => void;
  onUpdateData: (patch: Partial<AppData>) => void;
}) {
  const [importError, setImportError] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [backupScope, setBackupScope] = useState<BackupScope>("local");
  const [cloudItems, setCloudItems] = useState<CulturalItem[] | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [importPreview, setImportPreview] = useState<BackupPreview | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>(() => loadBackupHistory());
  const providers = getMetadataProviders(data.settings);
  const accountName = useMemo(() => backupAccountName(session), [session]);
  const exportItemCount = backupScope === "local"
    ? data.items.length
    : backupScope === "cloud"
      ? cloudItems?.length ?? 0
      : mergeBackupItems(data.items, cloudItems ?? []).length;

  function importFile(file?: File) {
    if (!file) return;
    setImportError("");
    setBackupMessage("");
    setImportPreview(null);
    file.text()
      .then((text) => {
        const imported = parseImportedData(text);
        const items = withoutLegacyDemoItems(imported.items ?? []);
        setImportPreview(buildBackupPreview(file.name, imported, data.items, items));
      })
      .catch((error) => setImportError(error.message));
  }

  async function loadCloudItems() {
    if (!session) {
      setBackupMessage("Entre na sua conta para baixar fichas da nuvem.");
      return null;
    }

    setLoadingCloud(true);
    setImportError("");
    setBackupMessage("");

    try {
      const items = await fetchMyItems(settings, session);
      setCloudItems(items);
      setBackupMessage(`${items.length} fichas baixadas da nuvem para preparar backup ou restauração.`);
      return items;
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Não consegui baixar suas fichas da nuvem.");
      return null;
    } finally {
      setLoadingCloud(false);
    }
  }

  async function exportBackup() {
    setImportError("");
    setBackupMessage("");

    let items: CulturalItem[];
    if (backupScope === "cloud") {
      const nextCloudItems = cloudItems ?? await loadCloudItems();
      if (!nextCloudItems) return;
      items = nextCloudItems;
    } else if (backupScope === "merged") {
      const freshCloudItems = cloudItems ?? await loadCloudItems();
      items = mergeBackupItems(data.items, freshCloudItems ?? []);
    } else {
      items = data.items;
    }

    const safeItems = withoutLegacyDemoItems(items);
    const fileName = backupFileName(accountName, backupScope);
    const payload = {
      exportedAt: new Date().toISOString(),
      account: session ? {
        id: session.user.id,
        email: session.user.email,
        displayName: session.profile?.displayName,
        username: session.profile?.username,
      } : null,
      scope: backupScope,
      data: {
        ...data,
        items: safeItems,
      },
    };

    downloadJson(payload, fileName);
    const historyEntry = {
      fileName,
      scope: backupScope,
      itemCount: safeItems.length,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [historyEntry, ...backupHistory].slice(0, 5);
    setBackupHistory(nextHistory);
    saveBackupHistory(nextHistory);
    setBackupMessage(`Backup exportado: ${fileName}.`);
  }

  function restorePreview() {
    if (!importPreview) return;
    const restored = restoreBackupData(data, importPreview);
    onReplaceData(restored);
    setBackupMessage(`Backup restaurado: ${importPreview.added.length} adicionados, ${importPreview.updated.length} atualizados e ${importPreview.ignored.length} ignorados.`);
    setImportPreview(null);
  }

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Preferências locais</p>
          <h1>Configurações</h1>
          <p>Status, backup JSON e chaves para buscas automáticas futuras.</p>
        </div>
      </section>

      <section className="settings-grid">
        <div className="setting-panel">
          <h2>Backup</h2>
          <p>Exporte por escopo, confira antes de restaurar e evite duplicar fichas que já existem.</p>
          <div className="backup-toolbar">
            <label className="field">
              <span>Exportar</span>
              <select value={backupScope} onChange={(event) => setBackupScope(event.target.value as BackupScope)}>
                <option value="local">Somente local</option>
                <option value="cloud">Somente nuvem</option>
                <option value="merged">Local + nuvem mesclado</option>
              </select>
              <small>{exportItemCount} fichas neste escopo.</small>
            </label>
            <button className="ghost" type="button" onClick={loadCloudItems} disabled={loadingCloud || !session}>
              <Cloud size={16} />
              {loadingCloud ? "Baixando..." : "Baixar fichas da nuvem"}
            </button>
            <button className="primary" type="button" onClick={exportBackup}>
              <Download size={16} />
              Exportar backup
            </button>
          </div>
          <div className="button-row">
            <label className="file-button">
              <Upload size={16} />
              Selecionar backup
              <input type="file" accept="application/json" onChange={(event) => importFile(event.target.files?.[0])} />
            </label>
          </div>
          {importPreview ? (
            <div className="backup-preview">
              <div>
                <strong>{importPreview.fileName}</strong>
                <span>{importPreview.items.length} fichas no arquivo</span>
              </div>
              <div className="backup-preview-stats">
                <span><b>{importPreview.added.length}</b> adicionar</span>
                <span><b>{importPreview.updated.length}</b> atualizar</span>
                <span><b>{importPreview.ignored.length}</b> ignorar</span>
              </div>
              <p>Itens iguais são comparados por ID ou por obra: categoria, título e ano. Se a ficha importada for mais nova, ela atualiza a existente; se for igual ou antiga, é ignorada.</p>
              <button className="primary" type="button" onClick={restorePreview}>
                <GitMerge size={16} />
                Restaurar backup
              </button>
            </div>
          ) : null}
          {backupHistory.length ? (
            <div className="backup-history">
              <h3>Histórico recente</h3>
              {backupHistory.map((entry) => (
                <span key={`${entry.fileName}-${entry.createdAt}`}>
                  <strong>{entry.fileName}</strong>
                  <small>{entry.itemCount} fichas / {scopeLabel(entry.scope)} / {formatDateTime(entry.createdAt)}</small>
                </span>
              ))}
            </div>
          ) : null}
          {backupMessage ? <p className="form-note">{backupMessage}</p> : null}
          {importError ? <p className="form-error">{importError}</p> : null}
        </div>

        <div className="setting-panel">
          <h2>Chaves de APIs</h2>
          <p>Quando as integrações forem ativadas, estas chaves serão usadas apenas localmente no seu navegador.</p>
          <div className="api-key-grid">
            {Object.keys(data.settings.apiKeys).concat(["igdb", "steam", "rawg", "googleBooks", "spotify", "lastfm", "tmdb", "omdb"])
              .filter((key, index, keys) => keys.indexOf(key) === index)
              .map((key) => (
                <label className="field" key={key}>
                  <span>{key}</span>
                  <input
                    value={String(data.settings.apiKeys[key as keyof typeof data.settings.apiKeys] ?? "")}
                    onChange={(event) => onUpdateData({ settings: { apiKeys: { ...data.settings.apiKeys, [key]: event.target.value } } })}
                    placeholder="Opcional"
                  />
                </label>
              ))}
          </div>
          <div className="provider-list">
            {providers.map((provider) => (
              <span key={provider.id} className={provider.configured ? "provider-ok" : "provider-pending"}>
                <KeyRound size={14} /> {provider.name} / {categoryLabels[provider.category]}
              </span>
            ))}
          </div>
        </div>

        <StatusManager data={data} onUpdateData={onUpdateData} />
      </section>
    </main>
  );
}

function StatusManager({ data, onUpdateData }: { data: AppData; onUpdateData: (patch: Partial<AppData>) => void }) {
  function updateCategory(category: Category, statuses: string[]) {
    onUpdateData({ statuses: { ...data.statuses, [category]: statuses.filter(Boolean) } });
  }

  return (
    <div className="setting-panel wide">
      <h2>Status personalizados</h2>
      <div className="status-columns">
        {(Object.keys(categoryLabels) as Category[]).map((category) => (
          <section key={category} className="status-box">
            <h3>{categoryLabels[category]}</h3>
            {data.statuses[category].map((status, index) => (
              <div className="repeat-row" key={`${category}-${index}`}>
                <input
                  value={status}
                  onChange={(event) => updateCategory(category, data.statuses[category].map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                />
                <button className="ghost compact" onClick={() => updateCategory(category, data.statuses[category].filter((_, itemIndex) => itemIndex !== index))}>Remover</button>
              </div>
            ))}
            <button className="ghost" onClick={() => updateCategory(category, [...data.statuses[category], "Novo status"])}>Criar status</button>
          </section>
        ))}
      </div>
    </div>
  );
}

function buildBackupPreview(fileName: string, imported: AppData, currentItems: CulturalItem[], incomingItems: CulturalItem[]): BackupPreview {
  const currentIndex = buildItemIndex(currentItems);
  const added: CulturalItem[] = [];
  const updated: Array<{ incoming: CulturalItem; current: CulturalItem }> = [];
  const ignored: CulturalItem[] = [];

  incomingItems.forEach((incoming) => {
    const current = currentIndex.get(incoming.id) || currentIndex.get(getWorkKey(incoming));
    if (!current) {
      added.push(incoming);
      return;
    }

    if (isIncomingNewer(incoming, current)) {
      updated.push({ incoming, current });
      return;
    }

    ignored.push(incoming);
  });

  return { fileName, data: imported, items: incomingItems, added, updated, ignored };
}

function restoreBackupData(current: AppData, preview: BackupPreview): AppData {
  const currentIndex = buildItemIndex(current.items);
  const byId = new Map(current.items.map((item) => [item.id, item]));

  preview.added.forEach((item) => {
    byId.set(item.id, item);
  });

  preview.updated.forEach(({ incoming, current: existing }) => {
    const merged = mergeRestoredItem(existing, incoming);
    byId.set(existing.id, merged);
    currentIndex.set(existing.id, merged);
    const workKey = getWorkKey(merged);
    if (workKey) currentIndex.set(workKey, merged);
  });

  return {
    ...current,
    version: Math.max(current.version ?? 1, preview.data.version ?? 1),
    items: [...byId.values()].sort((a, b) => dateTime(b.updatedAt) - dateTime(a.updatedAt)),
    statuses: {
      ...current.statuses,
      ...preview.data.statuses,
    },
    settings: {
      ...current.settings,
      apiKeys: {
        ...current.settings.apiKeys,
        ...(preview.data.settings?.apiKeys ?? {}),
      },
      cloud: {
        ...current.settings.cloud,
        ...(preview.data.settings?.cloud ?? {}),
      },
    },
  };
}

function mergeBackupItems(localItems: CulturalItem[], cloudItems: CulturalItem[]) {
  const byKey = new Map<string, CulturalItem>();
  const loose: CulturalItem[] = [];

  [...localItems, ...cloudItems].forEach((item) => {
    const workKey = getWorkKey(item);
    const key = workKey || item.id;
    if (!key) {
      loose.push(item);
      return;
    }

    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeRestoredItem(existing, item) : item);
  });

  return [...byKey.values(), ...loose].sort((a, b) => dateTime(b.updatedAt) - dateTime(a.updatedAt));
}

function mergeRestoredItem(current: CulturalItem, incoming: CulturalItem) {
  const newest = isIncomingNewer(incoming, current) ? incoming : current;
  const oldest = newest === incoming ? current : incoming;

  return {
    ...oldest,
    ...newest,
    id: current.id,
    tags: uniqueStrings([...oldest.tags, ...newest.tags]),
    links: mergeById(oldest.links, newest.links),
    timeline: mergeById(oldest.timeline, newest.timeline),
    diary: mergeById(oldest.diary, newest.diary),
    coverUrl: newest.coverUrl || oldest.coverUrl,
    updatedAt: newest.updatedAt,
  } as CulturalItem;
}

function buildItemIndex(items: CulturalItem[]) {
  const index = new Map<string, CulturalItem>();
  withoutLegacyDemoItems(items).forEach((item) => {
    index.set(item.id, item);
    const workKey = getWorkKey(item);
    if (workKey && !index.has(workKey)) index.set(workKey, item);
  });
  return index;
}

function isIncomingNewer(incoming: CulturalItem, current: CulturalItem) {
  return dateTime(incoming.updatedAt) > dateTime(current.updatedAt);
}

function dateTime(value?: string) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function mergeById<T extends { id: string }>(left: T[] = [], right: T[] = []) {
  const byId = new Map<string, T>();
  [...left, ...right].forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function backupAccountName(session: CloudSession | null) {
  const raw = session?.profile?.username || session?.profile?.displayName || session?.user.email?.split("@")[0] || "local";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "local";
}

function backupFileName(accountName: string, scope: BackupScope) {
  const date = new Date().toISOString().slice(0, 10);
  return `gaveteira-${accountName}-${scope}-${date}.json`;
}

function downloadJson(payload: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function loadBackupHistory(): BackupHistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveBackupHistory(history: BackupHistoryEntry[]) {
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
}

function scopeLabel(scope: BackupScope) {
  if (scope === "cloud") return "nuvem";
  if (scope === "merged") return "local + nuvem";
  return "local";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
