import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { AlertTriangle, Archive, BarChart3, BookOpen, CheckCircle2, ChevronDown, CloudOff, Disc3, Download, Film, Gamepad2, Home, Library, ListChecks, Loader2, LogIn, LogOut, MessageSquare, Settings, Share, Tv, UserCheck, UserPlus, Users, WifiOff, X } from "lucide-react";
import { AppData, AppSettings, Category, CloudSession, CulturalItem, ViewKey } from "./types";
import { loadData, saveData } from "./storage/localStore";
import { categoryLabels } from "./data/catalog";
import { HomeDashboard } from "./components/HomeDashboard";
import { CategoryView, emptyFilters, Filters } from "./components/CategoryView";
import { ItemForm, createBlankItem } from "./components/ItemForm";
import { ItemDetails } from "./components/ItemDetails";
import { StatsView } from "./components/StatsView";
import { SettingsView } from "./components/SettingsView";
import { FamilyView } from "./components/FamilyView";
import { SocialFeedView } from "./components/SocialFeedView";
import { deleteMyItem, fetchMyItems, fetchMyProfile, isSessionExpiredError, loadCloudSession, saveCloudSession, upsertMyItem } from "./services/supabaseCloud";
import { withSharedCloudSettings } from "./config/sharedCloud";
import { withoutLegacyDemoItems } from "./utils/legacyDemoItems";
import { getTitle, getWorkKey, isEmptyCulturalItem } from "./utils/itemHelpers";

const PENDING_DELETES_KEY = "gaveteira-pending-deletes:v1";
const SYNC_QUEUE_KEY = "gaveteira-sync-queue:v1";
const INSTALL_DISMISSED_KEY = "gaveteira-install-dismissed:v1";
const AUTO_SYNC_DELAY_MS = 900;
const AUTO_SYNC_RETRY_MS = 30_000;

type SyncKind = "local" | "loading" | "pending" | "syncing" | "synced" | "offline" | "expired" | "error";
type SyncQueueAction = "upsert" | "delete";
type SyncQueueStatus = "pending" | "syncing" | "failed";

interface SyncQueueEntry {
  id: string;
  itemId: string;
  action: SyncQueueAction;
  status: SyncQueueStatus;
  title: string;
  category?: Category;
  updatedAt: string;
  attempts: number;
  lastError?: string;
}

interface SyncStatus {
  kind: SyncKind;
  message: string;
  detail?: string;
  savedAt?: string;
  pendingItems?: number;
  pendingDeletes?: number;
  failedItems?: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const navItems: Array<{ key: ViewKey; label: string; icon: ElementType }> = [
  { key: "home", label: "Início", icon: Home },
  { key: "feed", label: "Feed", icon: MessageSquare },
  { key: "wishlist", label: "Wishlist", icon: Library },
  { key: "progress", label: "Em andamento", icon: ListChecks },
  { key: "stats", label: "Estatísticas", icon: BarChart3 },
  { key: "settings", label: "Configurações", icon: Settings },
];

const topNavItems = navItems.filter((item) => item.key === "home" || item.key === "feed");
const secondaryNavItems = navItems.filter((item) => item.key !== "home" && item.key !== "feed");

const drawerItems: Array<{ key: Category; label: string; icon: ElementType }> = [
  { key: "games", label: "Jogos", icon: Gamepad2 },
  { key: "books", label: "Livros", icon: BookOpen },
  { key: "albums", label: "Discos", icon: Disc3 },
  { key: "movies", label: "Filmes", icon: Film },
  { key: "series", label: "Séries", icon: Tv },
];

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<ViewKey>("home");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeItemMode, setActiveItemMode] = useState<"details" | "edit">("details");
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => loadCloudSession());
  const [bootstrappedCloudScope, setBootstrappedCloudScope] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => ({
    kind: loadCloudSession() ? "loading" : "local",
    message: loadCloudSession() ? "Preparando sincronização..." : "Modo local ativo.",
    detail: loadCloudSession() ? "Conferindo sua sessão salva." : "Seus dados ficam neste navegador até você conectar uma conta.",
  }));
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<SyncQueueEntry[]>(() => loadSyncQueue(loadPendingDeletes()));
  const [socialSection, setSocialSection] = useState<"profile" | "friends" | "admin">("profile");
  const [mobileDrawersOpen, setMobileDrawersOpen] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [standaloneMode, setStandaloneMode] = useState(() => isStandaloneApp());
  const [showStartupSplash, setShowStartupSplash] = useState(true);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncedKeyRef = useRef("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncQueueRef = useRef(syncQueue);
  const dataRef = useRef(data);
  const effectiveSettings = useMemo(() => withSharedCloudSettings(data.settings), [data.settings]);
  const cloudScopeKey = useMemo(() => JSON.stringify({
    userId: cloudSession?.user.id ?? "",
  }), [cloudSession?.user.id]);
  const cloudBootstrapped = Boolean(cloudSession && bootstrappedCloudScope === cloudScopeKey);
  const syncPayloadKey = useMemo(() => JSON.stringify({
    userId: cloudSession?.user.id ?? "",
    queue: syncQueue.map((entry) => [entry.id, entry.action, entry.status, entry.updatedAt, entry.attempts]),
  }), [cloudSession?.user.id, syncQueue]);
  const queueCounts = useMemo(() => getSyncQueueCounts(syncQueue), [syncQueue]);

  useEffect(() => {
    dataRef.current = data;
    saveData(data);
  }, [data]);

  useEffect(() => {
    const timerId = window.setTimeout(() => setShowStartupSplash(false), 1500);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (isStandaloneApp() || localStorage.getItem(INSTALL_DISMISSED_KEY) === "true") return;

    let iosTimer: number | undefined;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setShowInstallPrompt(false);
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isIosSafari()) {
      iosTimer = window.setTimeout(() => setShowInstallPrompt(true), 1600);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  useEffect(() => {
    saveCloudSession(cloudSession);
  }, [cloudSession]);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneMode = () => setStandaloneMode(isStandaloneApp());

    updateStandaloneMode();
    standaloneQuery.addEventListener("change", updateStandaloneMode);

    return () => standaloneQuery.removeEventListener("change", updateStandaloneMode);
  }, []);

  useEffect(() => {
    if (!standaloneMode) return;
    lockPortraitOrientation();
  }, [standaloneMode]);

  useEffect(() => {
    syncQueueRef.current = syncQueue;
    saveSyncQueue(syncQueue);
    savePendingDeletes(syncQueue.filter((entry) => entry.action === "delete").map((entry) => entry.itemId));
  }, [syncQueue]);

  useEffect(() => {
    if (!cloudSession) {
      setBootstrappedCloudScope("");
      if (syncStatus.kind !== "expired") {
        setSyncStatus({
          kind: "local",
          message: "Modo local ativo.",
          detail: "Seus dados ficam neste navegador até você conectar uma conta.",
        });
      }
      return;
    }
    if (cloudBootstrapped) return;

    let cancelled = false;
    setBootstrappedCloudScope("");
    setSyncStatus({
      kind: "loading",
      message: "Carregando sua conta...",
      detail: "Buscando os itens salvos na nuvem antes de sincronizar novas alterações.",
    });

    Promise.all([fetchMyItems(effectiveSettings, cloudSession), fetchMyProfile(effectiveSettings, cloudSession)])
      .then(([cloudItems, freshProfile]) => {
        if (cancelled) return;
        setCloudSession({ ...cloudSession, profile: freshProfile });
        const pendingDeleteIds = new Set(syncQueueRef.current.filter((entry) => entry.action === "delete").map((entry) => entry.itemId));
        const safeCloudItems = withoutLegacyDemoItems(cloudItems).filter((item) => !pendingDeleteIds.has(item.id));
        if (safeCloudItems.length) {
          mergeItems(safeCloudItems);
        }
        setSyncStatus({
          kind: "synced",
          message: safeCloudItems.length ? "Arquivo da nuvem carregado." : "Conta pronta.",
          detail: safeCloudItems.length ? "As fichas da nuvem foram mescladas neste navegador." : "As próximas fichas serão sincronizadas automaticamente.",
          savedAt: new Date().toISOString(),
        });
        setLastSyncedAt(new Date().toISOString());
        setBootstrappedCloudScope(cloudScopeKey);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isSessionExpiredError(error)) {
          expireSession(error);
          return;
        }

        setSyncStatus({
          kind: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error",
          message: "Não consegui abrir o arquivo da nuvem.",
          detail: error instanceof Error ? error.message : "Tente novamente em instantes.",
        });
        setBootstrappedCloudScope("");
      });

    return () => {
      cancelled = true;
    };
  }, [cloudBootstrapped, cloudScopeKey, cloudSession, effectiveSettings, syncRetryTick]);

  useEffect(() => {
    if (!cloudSession || !cloudBootstrapped) return;
    if (!syncQueue.length) return;

    if (lastSyncedKeyRef.current !== syncPayloadKey && syncStatus.kind !== "syncing") {
      setSyncStatus({
        kind: isOnline ? "pending" : "offline",
        message: isOnline ? "Fichas aguardando sincronização." : "Sem conexão.",
        detail: isOnline ? "Vou enviar automaticamente em alguns instantes." : "Elas ficam salvas aqui e serão reenviadas quando a internet voltar.",
        savedAt: lastSyncedAt ?? undefined,
        pendingItems: queueCounts.upserts,
        pendingDeletes: queueCounts.deletes,
        failedItems: queueCounts.failed,
      });
    }

    const timeoutId = window.setTimeout(() => {
      autoSync();
    }, AUTO_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cloudSession, cloudBootstrapped, syncPayloadKey, syncRetryTick, syncQueue.length, syncStatus.kind, queueCounts, isOnline, lastSyncedAt]);

  useEffect(() => {
    function retrySync() {
      setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
      setSyncRetryTick((current) => current + 1);
    }

    function markOffline() {
      setIsOnline(false);
      if (cloudSession) {
        setSyncStatus({
          kind: "offline",
          message: "Sem conexão.",
          detail: "Suas fichas continuam salvas neste navegador e serão reenviadas quando a conexão voltar.",
          savedAt: lastSyncedAt ?? undefined,
          pendingItems: getSyncQueueCounts(syncQueueRef.current).upserts,
          pendingDeletes: getSyncQueueCounts(syncQueueRef.current).deletes,
          failedItems: getSyncQueueCounts(syncQueueRef.current).failed,
        });
      }
    }

    window.addEventListener("online", retrySync);
    window.addEventListener("offline", markOffline);
    const intervalId = window.setInterval(retrySync, AUTO_SYNC_RETRY_MS);

    return () => {
      window.removeEventListener("online", retrySync);
      window.removeEventListener("offline", markOffline);
      window.clearInterval(intervalId);
    };
  }, [cloudSession, lastSyncedAt]);

  const activeItem = useMemo(() => data.items.find((item) => item.id === activeItemId) ?? null, [activeItemId, data.items]);

  function enqueueUpsert(item: CulturalItem) {
    const entry = createSyncQueueEntry("upsert", item.id, item);
    setSyncQueue((current) => upsertQueueEntry(current, entry));
  }

  function enqueueDelete(itemId: string, item?: CulturalItem) {
    const entry = createSyncQueueEntry("delete", itemId, item);
    setSyncQueue((current) => upsertQueueEntry(
      current.filter((queueItem) => !(queueItem.itemId === itemId && queueItem.action === "upsert")),
      entry,
    ));
  }

  function upsertItem(item: CulturalItem) {
    setData((current) => ({
      ...current,
      items: current.items.some((entry) => entry.id === item.id)
        ? current.items.map((entry) => entry.id === item.id ? item : entry)
        : [item, ...current.items],
    }));
    enqueueUpsert(item);
    setActiveItemId(item.id);
  }

  function addItem(category: Category) {
    const item = createBlankItem(category, data.statuses[category][0]);
    upsertItem(item);
    setActiveItemMode("edit");
  }

  function requestAddItem(category?: Category) {
    if (category) {
      addItem(category);
      return;
    }

    setAddPickerOpen(true);
  }

  function chooseAddItem(category: Category) {
    setAddPickerOpen(false);
    addItem(category);
  }

  function deleteItem(id: string, enqueue = true) {
    const item = dataRef.current.items.find((entry) => entry.id === id);
    setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    if (enqueue) {
      enqueueDelete(id, item);
    }
    setActiveItemId(null);
  }

  function closeItemForm() {
    if (activeItem && isEmptyCulturalItem(activeItem)) {
      deleteItem(activeItem.id, false);
      return;
    }

    setActiveItemId(null);
    setActiveItemMode("details");
  }

  function updateData(patch: Partial<AppData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  function updateSettings(settings: AppSettings) {
    setData((current) => ({ ...current, settings }));
  }

  function mergeItems(items: CulturalItem[]) {
    setData((current) => {
      const pendingDeleteIds = new Set(syncQueueRef.current.filter((entry) => entry.action === "delete").map((entry) => entry.itemId));
      const byId = new Map(withoutLegacyDemoItems(current.items).map((item) => [item.id, item]));
      withoutLegacyDemoItems(items).forEach((item) => {
        if (pendingDeleteIds.has(item.id)) return;
        const existing = byId.get(item.id);
        if (!existing || new Date(item.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
          byId.set(item.id, item);
        }
      });

      return { ...current, items: dedupeItemsByWork([...byId.values()]) };
    });
  }

  const mainView = () => {
    if (view === "home") {
      return (
        <HomeDashboard
          items={data.items}
          settings={effectiveSettings}
          session={cloudSession}
          onOpenCategory={(next) => selectView(next)}
          onOpenItem={openItemDetails}
          onAddItem={requestAddItem}
          onOpenFamily={() => selectView("family")}
          onOpenFeed={() => selectView("feed")}
          connectedToFamily={Boolean(cloudSession)}
          profileReady={Boolean(cloudSession?.profile?.displayName)}
          favoriteDrawersReady={Boolean(cloudSession?.profile?.favoriteCategories?.length)}
        />
      );
    }

    if (view === "stats") return <StatsView items={data.items} />;
    if (view === "feed") {
      return (
        <SocialFeedView
          settings={effectiveSettings}
          session={cloudSession}
          localItems={data.items}
          onMergeItems={mergeItems}
          onAuthenticated={authenticated}
          onUpdateSettings={updateSettings}
        />
      );
    }
    if (view === "family") {
      return (
        <FamilyView
          settings={effectiveSettings}
          session={cloudSession}
          localItems={data.items}
          onMergeItems={mergeItems}
          onLogout={logout}
          onAuthenticated={authenticated}
          onUpdateSettings={updateSettings}
          socialTab={socialSection}
          onSocialTabChange={setSocialSection}
        />
      );
    }
    if (view === "settings") {
      return (
        <SettingsView
          data={data}
          settings={effectiveSettings}
          session={cloudSession}
          onReplaceData={setData}
          onUpdateData={updateData}
        />
      );
    }

    return (
      <CategoryView
        view={view}
        items={data.items}
        statuses={data.statuses}
        filters={filters}
        onFiltersChange={setFilters}
        onAdd={addItem}
        onAddAny={() => setAddPickerOpen(true)}
        onOpen={openItemDetails}
      />
    );
  };

  function openItemDetails(item: CulturalItem) {
    setActiveItemId(item.id);
    setActiveItemMode("details");
  }

  function selectView(nextView: ViewKey) {
    setView(nextView);
    setMobileDrawersOpen(false);
  }

  function selectSocial(nextSection: "profile" | "friends" | "admin") {
    if (nextSection === "admin" && cloudSession?.profile?.role !== "admin") {
      nextSection = "profile";
    }
    setSocialSection(nextSection);
    selectView("family");
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      setInstallPrompt(null);
      setShowInstallPrompt(false);
      localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    }
  }

  function dismissInstallPrompt() {
    setShowInstallPrompt(false);
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
  }

  function categoryCount(category: Category) {
    return data.items.filter((entry) => entry.category === category).length;
  }

  async function authenticated(session: CloudSession) {
    const sameUserAlreadyLoaded = cloudSession?.user.id === session.user.id && cloudBootstrapped;
    setCloudSession(session);
    setSyncStatus(sameUserAlreadyLoaded
      ? {
        kind: "synced",
        message: "Perfil atualizado.",
        detail: "Suas informacoes sociais foram salvas.",
      }
      : {
        kind: "loading",
        message: "Conta conectada.",
        detail: "Carregando seus itens antes de ativar o auto-sync.",
      });
  }

  function logout() {
    const clearedData = { ...dataRef.current, items: [] };
    dataRef.current = clearedData;
    saveData(clearedData);
    setData(clearedData);
    syncQueueRef.current = [];
    saveSyncQueue([]);
    savePendingDeletes([]);
    lastSyncedKeyRef.current = "";
    setSyncQueue([]);
    setLastSyncedAt(null);
    setCloudSession(null);
    setBootstrappedCloudScope("");
    selectView("home");
    setActiveItemId(null);
    setActiveItemMode("details");
    setSyncStatus({
      kind: "local",
      message: "Sessão encerrada.",
      detail: "As fichas locais desta conta foram retiradas deste navegador.",
    });
  }

  function retrySyncNow() {
    setSyncQueue((current) => current.map((entry) => entry.status === "failed" ? { ...entry, status: "pending", lastError: undefined } : entry));
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setSyncRetryTick((current) => current + 1);
  }

  function retrySyncEntry(entryId: string) {
    setSyncQueue((current) => current.map((entry) => entry.id === entryId ? { ...entry, status: "pending", lastError: undefined } : entry));
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setSyncRetryTick((current) => current + 1);
  }

  function markQueueEntrySyncing(entryId: string) {
    setSyncQueue((current) => {
      const next = current.map((entry) => entry.id === entryId ? { ...entry, status: "syncing" as const } : entry);
      syncQueueRef.current = next;
      saveSyncQueue(next);
      return next;
    });
  }

  function markQueueEntryFailed(entryId: string, error: unknown) {
    const lastError = error instanceof Error ? error.message : "Erro desconhecido.";
    setSyncQueue((current) => {
      const next = current.map((entry) => entry.id === entryId
        ? { ...entry, status: "failed" as const, attempts: entry.attempts + 1, lastError }
        : entry);
      syncQueueRef.current = next;
      saveSyncQueue(next);
      return next;
    });
  }

  function removeQueueEntry(entryId: string) {
    setSyncQueue((current) => {
      const next = current.filter((entry) => entry.id !== entryId);
      syncQueueRef.current = next;
      saveSyncQueue(next);
      return next;
    });
  }

  async function autoSync() {
    if (!cloudSession || !cloudBootstrapped) return;
    const queueToSync = syncQueueRef.current.filter((entry) => entry.status !== "syncing");
    if (!queueToSync.length || lastSyncedKeyRef.current === syncPayloadKey) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const counts = getSyncQueueCounts(syncQueueRef.current);
      setSyncStatus({
        kind: "offline",
        message: "Sem conexão.",
        detail: "Suas fichas ficaram salvas aqui e serão reenviadas quando a internet voltar.",
        savedAt: lastSyncedAt ?? undefined,
        pendingItems: counts.upserts,
        pendingDeletes: counts.deletes,
        failedItems: counts.failed,
      });
      return;
    }

    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    const counts = getSyncQueueCounts(syncQueueRef.current);
    const pendingDeletes = queueToSync.filter((entry) => entry.action === "delete");
    setSyncStatus({
      kind: "syncing",
      message: "Enviando fichas para a nuvem...",
      detail: pendingDeletes.length ? "Enviando alterações e retirando fichas apagadas da nuvem." : "Enviando as últimas fichas para a nuvem.",
      savedAt: lastSyncedAt ?? undefined,
      pendingItems: counts.upserts,
      pendingDeletes: counts.deletes,
      failedItems: counts.failed,
    });

    try {
      for (const entry of queueToSync) {
        markQueueEntrySyncing(entry.id);

        try {
          if (entry.action === "delete") {
            await deleteMyItem(effectiveSettings, cloudSession, entry.itemId);
          } else {
            const item = dataRef.current.items.find((candidate) => candidate.id === entry.itemId);
            if (item) {
              await upsertMyItem(effectiveSettings, cloudSession, item);
            }
          }

          removeQueueEntry(entry.id);
        } catch (error) {
          if (isSessionExpiredError(error)) throw error;
          markQueueEntryFailed(entry.id, error);
        }
      }
      lastSyncedKeyRef.current = syncPayloadKey;
      const remainingQueue = syncQueueRef.current.filter((entry) => entry.status !== "syncing");
      if (remainingQueue.length) {
        const remainingCounts = getSyncQueueCounts(remainingQueue);
        setSyncStatus({
          kind: "error",
          message: "Algumas fichas não foram enviadas.",
          detail: "A fila foi preservada. Você pode reenviar apenas o que falhou.",
          savedAt: lastSyncedAt ?? undefined,
          pendingItems: remainingCounts.upserts,
          pendingDeletes: remainingCounts.deletes,
          failedItems: remainingCounts.failed,
        });
        return;
      }
      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      setSyncStatus({
        kind: "synced",
        message: "Tudo sincronizado.",
        detail: "Suas fichas já estão na nuvem.",
        savedAt: syncedAt,
      });
    } catch (error) {
      if (isSessionExpiredError(error)) {
        expireSession(error);
      } else {
        const counts = getSyncQueueCounts(syncQueueRef.current);
        setSyncStatus({
          kind: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error",
          message: typeof navigator !== "undefined" && !navigator.onLine ? "Sem conexão." : "Não consegui enviar agora.",
          detail: error instanceof Error ? `${error.message} Vou tentar de novo automaticamente.` : "Vou tentar de novo automaticamente.",
          savedAt: lastSyncedAt ?? undefined,
          pendingItems: counts.upserts,
          pendingDeletes: counts.deletes,
          failedItems: counts.failed,
        });
      }
    } finally {
      syncInFlightRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        setSyncRetryTick((current) => current + 1);
      }
    }
  }

  function expireSession(error: unknown) {
    const counts = getSyncQueueCounts(syncQueueRef.current);
    setCloudSession(null);
    setBootstrappedCloudScope("");
    setSyncStatus({
      kind: "expired",
      message: "Sessão expirada.",
      detail: error instanceof Error ? error.message : "Entre novamente para continuar sincronizando. Suas fichas locais foram preservadas.",
      savedAt: lastSyncedAt ?? undefined,
      pendingItems: counts.upserts,
      pendingDeletes: counts.deletes,
      failedItems: counts.failed,
    });
  }

  if (showStartupSplash) {
    return (
      <main className="startup-splash" aria-label="Abrindo Gaveteira">
        <img src="/gaveteira-splash.png" alt="Gaveteira" />
      </main>
    );
  }

  return (
    <div className={`app-shell${standaloneMode ? " app-shell-standalone" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>Gaveteira</strong>
            <small>{cloudSession ? cloudSession.profile?.displayName || cloudSession.user.email || "minha conta" : "modo local"}</small>
          </div>
        </div>
        <SyncStatusCard status={syncStatus} queue={syncQueue} onReconnect={() => selectView("family")} onRetry={retrySyncNow} onRetryEntry={retrySyncEntry} />
        <nav>
          {topNavItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button key={item.key} className={active ? "active" : ""} onClick={() => selectView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className={`drawer-nav ${view in categoryLabels ? "active" : ""}`}>
            <button className="drawer-nav-trigger" type="button">
              <Archive size={18} />
              <span>Gavetas</span>
              <ChevronDown size={16} />
            </button>
            <div className="drawer-nav-menu">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                const active = view === item.key;
                const count = data.items.filter((entry) => entry.category === item.key).length;
                return (
                  <button key={item.key} className={active ? "active" : ""} onClick={() => selectView(item.key)}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div className={`drawer-nav ${view === "family" ? "active" : ""}`}>
            <button className="drawer-nav-trigger" type="button" onClick={() => selectSocial(socialSection)}>
              <Users size={18} />
              <span>Social</span>
              <ChevronDown size={16} />
            </button>
            <div className="drawer-nav-menu">
              <button className={view === "family" && socialSection === "profile" ? "active" : ""} onClick={() => selectSocial("profile")}>
                <UserCheck size={18} />
                <span>Meu perfil</span>
              </button>
              <button className={view === "family" && socialSection === "friends" ? "active" : ""} onClick={() => selectSocial("friends")}>
                <UserPlus size={18} />
                <span>Amigos</span>
              </button>
              {cloudSession?.profile?.role === "admin" ? (
                <button className={view === "family" && socialSection === "admin" ? "active" : ""} onClick={() => selectSocial("admin")}>
                  <UserCheck size={18} />
                  <span>Admin</span>
                </button>
              ) : null}
            </div>
          </div>
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button key={item.key} className={active ? "active" : ""} onClick={() => selectView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {cloudSession ? (
          <>
            <button className="sidebar-logout" onClick={logout}>
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </>
        ) : (
          <button className="sidebar-action" onClick={() => selectView("family")}>
            <LogIn size={18} />
            <span>Conectar/sincronizar</span>
          </button>
        )}
      </aside>
      {mainView()}
      <SyncStatusCard status={syncStatus} queue={syncQueue} onReconnect={() => selectView("family")} onRetry={retrySyncNow} onRetryEntry={retrySyncEntry} compact />
      <nav className="mobile-bottom-nav" aria-label="Navegação principal mobile">
        <button type="button" className={view === "home" ? "active" : ""} onClick={() => selectView("home")}>
          <Home size={20} />
          <span>Início</span>
        </button>
        <button type="button" className={view in categoryLabels ? "active" : ""} onClick={() => setMobileDrawersOpen(true)}>
          <Archive size={20} />
          <span>Gavetas</span>
        </button>
        <button type="button" className={view === "feed" ? "active" : ""} onClick={() => selectView("feed")}>
          <MessageSquare size={20} />
          <span>Feed</span>
        </button>
        <button type="button" className={view === "family" ? "active" : ""} onClick={() => selectSocial(socialSection)}>
          <Users size={20} />
          <span>Social</span>
        </button>
        <button type="button" className={view === "settings" ? "active" : ""} onClick={() => selectView("settings")}>
          <Settings size={20} />
          <span>Config</span>
        </button>
      </nav>
      {mobileDrawersOpen ? (
        <div className="mobile-drawer-backdrop" role="presentation" onClick={() => setMobileDrawersOpen(false)}>
          <section className="mobile-drawer-panel" role="dialog" aria-modal="true" aria-label="Escolher gaveta" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-drawer-handle" />
            <header>
              <div>
                <p className="eyebrow">Gavetas</p>
                <h2>Escolha uma categoria</h2>
              </div>
              <button type="button" className="ghost compact" onClick={() => setMobileDrawersOpen(false)}>Fechar</button>
            </header>
            <div className="mobile-drawer-list">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.key} type="button" className={view === item.key ? "active" : ""} onClick={() => selectView(item.key)}>
                    <Icon size={20} />
                    <span>{item.label}</span>
                    <strong>{categoryCount(item.key)}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
      {showInstallPrompt ? (
        <InstallAppPrompt
          canInstall={Boolean(installPrompt)}
          isIos={isIosSafari()}
          onInstall={installApp}
          onDismiss={dismissInstallPrompt}
        />
      ) : null}
      {addPickerOpen ? (
        <CategoryChoiceModal
          onChoose={chooseAddItem}
          onClose={() => setAddPickerOpen(false)}
        />
      ) : null}
      {activeItem && activeItemMode === "details" ? (
        <ItemDetails
          item={activeItem}
          settings={effectiveSettings}
          cloudSession={cloudSession ?? undefined}
          onUpdateItem={upsertItem}
          onEdit={() => setActiveItemMode("edit")}
          onClose={() => setActiveItemId(null)}
        />
      ) : null}
      {activeItem && activeItemMode === "edit" ? (
        <ItemForm
          item={activeItem}
          statuses={data.statuses[activeItem.category]}
          settings={effectiveSettings}
          cloudSession={cloudSession ?? undefined}
          onSave={upsertItem}
          onDelete={deleteItem}
          onClose={closeItemForm}
        />
      ) : null}
    </div>
  );
}

function CategoryChoiceModal({
  onChoose,
  onClose,
}: {
  onChoose: (category: Category) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="modal category-choice-modal" role="dialog" aria-modal="true" aria-label="Escolher tipo de ficha" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Nova ficha</p>
            <h2>Escolha uma gaveta</h2>
            <p>Você pode começar por qualquer tipo de consumo cultural.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar seletor de gaveta">
            <X size={18} />
          </button>
        </header>
        <div className="category-choice-grid">
          {drawerItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className={`category-choice-card drawer-${item.key}`} onClick={() => onChoose(item.key)}>
                <span className="drawer-handle">
                  <Icon size={20} />
                </span>
                <strong>{item.label}</strong>
                <small>Criar ficha</small>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InstallAppPrompt({
  canInstall,
  isIos,
  onInstall,
  onDismiss,
}: {
  canInstall: boolean;
  isIos: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const installText = canInstall
    ? "Abra em tela cheia, com ícone próprio e navegação mais limpa no celular."
    : isIos
      ? "No iPhone, a instalação é feita pelo botão de compartilhar do Safari."
      : "Use o menu do navegador para adicionar a Gaveteira à tela inicial.";

  return (
    <section className={`install-card${isIos && !canInstall ? " install-card-ios" : " install-card-native"}`} aria-live="polite">
      <div className="install-card-icon">
        <span>G</span>
      </div>
      <div className="install-card-copy">
        <small>Modo app</small>
        <strong>Instalar Gaveteira</strong>
        <span>{installText}</span>
        {isIos && !canInstall ? (
          <ol className="install-steps">
            <li><Share size={14} /> Compartilhar</li>
            <li>Adicionar à Tela de Início</li>
          </ol>
        ) : (
          <div className="install-perks">
            <span>sem barra do navegador</span>
            <span>atalho rápido</span>
          </div>
        )}
      </div>
      <div className="install-card-actions">
        {canInstall ? <button type="button" onClick={onInstall}><Download size={15} /> Instalar</button> : null}
        <button className="install-card-close" type="button" onClick={onDismiss} aria-label="Fechar aviso de instalação">
          <X size={16} />
        </button>
      </div>
    </section>
  );
}

function SyncStatusCard({
  status,
  queue,
  onReconnect,
  onRetry,
  onRetryEntry,
  compact = false,
}: {
  status: SyncStatus;
  queue: SyncQueueEntry[];
  onReconnect: () => void;
  onRetry: () => void;
  onRetryEntry: (entryId: string) => void;
  compact?: boolean;
}) {
  const [queueOpen, setQueueOpen] = useState(false);
  const Icon = status.kind === "synced" ? CheckCircle2
    : status.kind === "syncing" || status.kind === "loading" ? Loader2
      : status.kind === "offline" ? WifiOff
        : status.kind === "expired" ? LogIn
          : status.kind === "local" ? CloudOff
            : AlertTriangle;
  const action = syncAction(status.kind);
  const meta = syncMeta(status);
  const hasQueue = queue.length > 0;
  const failedCount = queue.filter((entry) => entry.status === "failed").length;
  const shouldOpenQueue = hasQueue && (queueOpen || (!compact && (status.kind === "error" || failedCount > 0)));
  const canToggleQueue = hasQueue && (compact || status.kind === "pending" || status.kind === "offline" || status.kind === "expired" || status.kind === "error" || failedCount > 0);

  return (
    <section className={`sync-card sync-card-${status.kind}${compact ? " sync-card-compact" : ""}`} aria-live="polite">
      <div className="sync-card-icon">
        <Icon size={compact ? 16 : 18} />
      </div>
      <div>
        <span className="sync-card-label">{syncLabel(status.kind)}</span>
        <strong>{compact ? syncCompactMessage(status) : status.message}</strong>
        {status.detail && !compact ? <span>{status.detail}</span> : null}
        {!compact && meta.length ? (
          <div className="sync-card-meta">
            {meta.map((entry) => <small key={entry}>{entry}</small>)}
          </div>
        ) : null}
        {canToggleQueue ? (
          <button type="button" className="sync-queue-toggle" onClick={() => setQueueOpen((current) => !current)}>
            {shouldOpenQueue ? "Ocultar pendências" : `Ver pendências (${queue.length})`}
          </button>
        ) : null}
        {shouldOpenQueue ? (
          <div className="sync-queue-list">
            <div className="sync-queue-heading">
              <strong>Pendências da nuvem</strong>
              <small>{failedCount ? `${failedCount} ${failedCount === 1 ? "ficha precisa" : "fichas precisam"} de reenvio.` : "A Gaveteira está cuidando da fila."}</small>
            </div>
            {queue.slice(0, 5).map((entry) => (
              <div className={`sync-queue-item sync-queue-item-${entry.status}`} key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <small>{syncQueueLabel(entry)} {entry.category ? `- ${categoryLabels[entry.category]}` : ""}</small>
                  {entry.lastError ? <small className="sync-queue-error">{entry.lastError}</small> : null}
                </div>
                {entry.status === "failed" ? (
                  <button type="button" onClick={() => onRetryEntry(entry.id)}>Reenviar</button>
                ) : (
                  <span>{syncQueueStatusLabel(entry.status)}</span>
                )}
              </div>
            ))}
            {queue.length > 5 ? <small className="sync-queue-more">+{queue.length - 5} pendências na fila</small> : null}
          </div>
        ) : null}
      </div>
      {action && !compact ? (
        <button type="button" onClick={action.kind === "reconnect" ? onReconnect : onRetry}>
          {action.label}
        </button>
      ) : null}
    </section>
  );
}

function syncLabel(kind: SyncKind) {
  const labels: Record<SyncKind, string> = {
    local: "Salvo localmente",
    loading: "Carregando nuvem",
    pending: "Na fila",
    syncing: "Enviando",
    synced: "Enviado",
    offline: "Sem conexão",
    expired: "Sessão expirada",
    error: "Precisa de atenção",
  };

  return labels[kind];
}

function syncCompactMessage(status: SyncStatus) {
  if (status.kind === "pending") return "Fichas na fila.";
  if (status.kind === "syncing") return "Enviando para a nuvem...";
  if (status.kind === "offline") return "Sem conexão. Tudo ficou salvo.";
  if (status.kind === "expired") return "Sessão expirada. Entre de novo.";
  if (status.kind === "error") return "Alguma ficha não subiu. Tentarei de novo.";
  return status.message;
}

function syncAction(kind: SyncKind): { kind: "reconnect" | "retry"; label: string } | null {
  if (kind === "local") return { kind: "reconnect", label: "Conectar nuvem" };
  if (kind === "expired") return { kind: "reconnect", label: "Entrar novamente" };
  if (kind === "error") return { kind: "retry", label: "Tentar agora" };
  if (kind === "pending") return { kind: "retry", label: "Enviar agora" };
  if (kind === "offline") return { kind: "retry", label: "Verificar conexão" };
  return null;
}

function syncMeta(status: SyncStatus) {
  const meta: string[] = [];

  if (status.savedAt) {
    meta.push(`Último envio bem-sucedido às ${formatSyncTime(status.savedAt)}`);
  }

  if (status.kind === "pending" || status.kind === "syncing" || status.kind === "offline" || status.kind === "error" || status.kind === "expired") {
    if (status.pendingItems) {
      meta.push(`${status.pendingItems} fichas no lote`);
    }
    if (status.pendingDeletes) {
      meta.push(`${status.pendingDeletes} exclusões pendentes`);
    }
  }

  if (status.failedItems) {
    meta.push(`${status.failedItems} falhas`);
  }

  return meta;
}

function syncQueueLabel(entry: SyncQueueEntry) {
  return entry.action === "delete" ? "Exclusão" : "Alteração";
}

function syncQueueStatusLabel(status: SyncQueueStatus) {
  const labels: Record<SyncQueueStatus, string> = {
    pending: "Na fila",
    syncing: "Enviando",
    failed: "Não enviado",
  };

  return labels[status];
}

function formatSyncTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadSyncQueue(legacyDeletes: string[] = []): SyncQueueEntry[] {
  const raw = localStorage.getItem(SYNC_QUEUE_KEY);
  const legacyEntries = legacyDeletes.map((itemId) => createSyncQueueEntry("delete", itemId));

  if (!raw) return legacyEntries;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return legacyEntries;

    const entries: SyncQueueEntry[] = parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<SyncQueueEntry>;
      if (typeof candidate.id !== "string" || typeof candidate.itemId !== "string") return [];
      if (candidate.action !== "upsert" && candidate.action !== "delete") return [];

      return [{
        id: candidate.id,
        itemId: candidate.itemId,
        action: candidate.action,
        status: candidate.status === "failed" ? "failed" as const : "pending" as const,
        title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title : "Ficha sem título",
        category: candidate.category,
        updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
        attempts: typeof candidate.attempts === "number" ? candidate.attempts : 0,
        lastError: typeof candidate.lastError === "string" ? candidate.lastError : undefined,
      }];
    });

    return mergeQueueEntries([...legacyEntries, ...entries]);
  } catch {
    localStorage.removeItem(SYNC_QUEUE_KEY);
    return legacyEntries;
  }
}

function saveSyncQueue(entries: SyncQueueEntry[]) {
  if (!entries.length) {
    localStorage.removeItem(SYNC_QUEUE_KEY);
    return;
  }

  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(entries));
}

function createSyncQueueEntry(action: SyncQueueAction, itemId: string, item?: CulturalItem): SyncQueueEntry {
  return {
    id: `${action}:${itemId}`,
    itemId,
    action,
    status: "pending",
    title: item ? getTitle(item) || "Ficha sem título" : "Ficha removida",
    category: item?.category,
    updatedAt: item?.updatedAt ?? new Date().toISOString(),
    attempts: 0,
  };
}

function upsertQueueEntry(entries: SyncQueueEntry[], entry: SyncQueueEntry) {
  const existing = entries.find((candidate) => candidate.id === entry.id);
  const nextEntry = existing ? {
    ...existing,
    ...entry,
    attempts: existing.attempts,
    status: "pending" as const,
    lastError: undefined,
  } : entry;

  return mergeQueueEntries([nextEntry, ...entries.filter((candidate) => candidate.id !== entry.id)]);
}

function mergeQueueEntries(entries: SyncQueueEntry[]) {
  const byId = new Map<string, SyncQueueEntry>();
  entries.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function getSyncQueueCounts(entries: SyncQueueEntry[]) {
  return {
    total: entries.length,
    upserts: entries.filter((entry) => entry.action === "upsert").length,
    deletes: entries.filter((entry) => entry.action === "delete").length,
    failed: entries.filter((entry) => entry.status === "failed").length,
  };
}

function dedupeItemsByWork(items: CulturalItem[]) {
  const byWork = new Map<string, CulturalItem>();
  const withoutKey: CulturalItem[] = [];

  items.forEach((item) => {
    const key = getWorkKey(item);
    if (!key) {
      withoutKey.push(item);
      return;
    }

    const existing = byWork.get(key);
    byWork.set(key, existing ? mergeDuplicateItems(existing, item) : item);
  });

  return [...byWork.values(), ...withoutKey].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function mergeDuplicateItems(left: CulturalItem, right: CulturalItem) {
  const newest = new Date(right.updatedAt).getTime() >= new Date(left.updatedAt).getTime() ? right : left;
  const oldest = newest === right ? left : right;

  return {
    ...oldest,
    ...newest,
    tags: [...new Set([...oldest.tags, ...newest.tags])],
    links: mergeById(oldest.links, newest.links),
    timeline: mergeById(oldest.timeline, newest.timeline),
    diary: mergeById(oldest.diary, newest.diary),
    coverUrl: newest.coverUrl || oldest.coverUrl,
    updatedAt: newest.updatedAt,
  } as CulturalItem;
}

function mergeById<T extends { id: string }>(left: T[], right: T[]) {
  const byId = new Map<string, T>();
  [...left, ...right].forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()];
}

function loadPendingDeletes() {
  const raw = localStorage.getItem(PENDING_DELETES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    localStorage.removeItem(PENDING_DELETES_KEY);
    return [];
  }
}

function savePendingDeletes(ids: string[]) {
  if (!ids.length) {
    localStorage.removeItem(PENDING_DELETES_KEY);
    return;
  }

  localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids));
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function lockPortraitOrientation() {
  type OrientationLock = "any" | "natural" | "landscape" | "portrait" | "portrait-primary" | "portrait-secondary" | "landscape-primary" | "landscape-secondary";
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: OrientationLock) => Promise<void>;
  };

  if (!orientation?.lock) return;
  orientation.lock("portrait-primary").catch(() => {
    // Alguns navegadores só permitem travar orientação em PWA instalado ou tela cheia.
  });
}

function isIosSafari() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos && !isStandaloneApp();
}

export default App;
