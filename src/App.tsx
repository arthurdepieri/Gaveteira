import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { AlertTriangle, Archive, BarChart3, BookOpen, CheckCircle2, ChevronDown, CloudOff, Disc3, Film, Gamepad2, Home, Library, ListChecks, Loader2, LogIn, LogOut, MessageSquare, Settings, Tv, UserCheck, UserPlus, Users, WifiOff } from "lucide-react";
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
import { deleteMyItem, fetchMyItems, isSessionExpiredError, loadCloudSession, saveCloudSession, syncMyItems } from "./services/supabaseCloud";
import { withSharedCloudSettings } from "./config/sharedCloud";
import { withoutLegacyDemoItems } from "./utils/legacyDemoItems";

const PENDING_DELETES_KEY = "gaveteira-pending-deletes:v1";
const AUTO_SYNC_DELAY_MS = 900;
const AUTO_SYNC_RETRY_MS = 30_000;

type SyncKind = "local" | "loading" | "pending" | "syncing" | "synced" | "offline" | "expired" | "error";

interface SyncStatus {
  kind: SyncKind;
  message: string;
  detail?: string;
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
  { key: "albums", label: "Álbuns", icon: Disc3 },
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
  const [pendingDeletes, setPendingDeletes] = useState<string[]>(() => loadPendingDeletes());
  const [socialSection, setSocialSection] = useState<"profile" | "friends">("profile");
  const [mobileDrawersOpen, setMobileDrawersOpen] = useState(false);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncedKeyRef = useRef("");
  const pendingDeletesRef = useRef(pendingDeletes);
  const effectiveSettings = useMemo(() => withSharedCloudSettings(data.settings), [data.settings]);
  const cloudScopeKey = useMemo(() => JSON.stringify({
    userId: cloudSession?.user.id ?? "",
  }), [cloudSession?.user.id]);
  const cloudBootstrapped = Boolean(cloudSession && bootstrappedCloudScope === cloudScopeKey);
  const syncPayloadKey = useMemo(() => JSON.stringify({
    userId: cloudSession?.user.id ?? "",
    items: data.items.map((item) => [item.id, item.updatedAt]),
    deletes: pendingDeletes,
  }), [cloudSession?.user.id, data.items, pendingDeletes]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    saveCloudSession(cloudSession);
  }, [cloudSession]);

  useEffect(() => {
    pendingDeletesRef.current = pendingDeletes;
    savePendingDeletes(pendingDeletes);
  }, [pendingDeletes]);

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

    fetchMyItems(effectiveSettings, cloudSession)
      .then((cloudItems) => {
        if (cancelled) return;
        const pendingDeleteIds = new Set(pendingDeletesRef.current);
        const safeCloudItems = withoutLegacyDemoItems(cloudItems).filter((item) => !pendingDeleteIds.has(item.id));
        if (safeCloudItems.length) {
          mergeItems(safeCloudItems);
        }
        setSyncStatus({
          kind: "synced",
          message: safeCloudItems.length ? "Conta carregada." : "Conta pronta.",
          detail: safeCloudItems.length ? "Itens da nuvem foram mesclados neste navegador." : "As próximas alterações serão sincronizadas automaticamente.",
        });
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
          message: "Não foi possível carregar a nuvem.",
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

    if (lastSyncedKeyRef.current !== syncPayloadKey && syncStatus.kind !== "syncing") {
      setSyncStatus({
        kind: isOnline ? "pending" : "offline",
        message: isOnline ? "Alterações aguardando sincronização." : "Sem conexão.",
        detail: isOnline ? "Vou enviar automaticamente em alguns instantes." : "Elas ficam salvas aqui e serão reenviadas quando a internet voltar.",
      });
    }

    const timeoutId = window.setTimeout(() => {
      autoSync();
    }, AUTO_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cloudSession, cloudBootstrapped, syncPayloadKey, syncRetryTick]);

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
          detail: "Suas alterações continuam salvas neste navegador e serão reenviadas quando a conexão voltar.",
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
  }, [cloudSession]);

  const activeItem = useMemo(() => data.items.find((item) => item.id === activeItemId) ?? null, [activeItemId, data.items]);

  function upsertItem(item: CulturalItem) {
    setData((current) => ({
      ...current,
      items: current.items.some((entry) => entry.id === item.id)
        ? current.items.map((entry) => entry.id === item.id ? item : entry)
        : [item, ...current.items],
    }));
    setActiveItemId(item.id);
  }

  function addItem(category: Category) {
    const item = createBlankItem(category, data.statuses[category][0]);
    upsertItem(item);
    setActiveItemMode("edit");
  }

  function deleteItem(id: string) {
    setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    if (cloudSession) {
      setPendingDeletes((current) => current.includes(id) ? current : [...current, id]);
    }
    setActiveItemId(null);
  }

  function updateData(patch: Partial<AppData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  function updateSettings(settings: AppSettings) {
    setData((current) => ({ ...current, settings }));
  }

  function mergeItems(items: CulturalItem[]) {
    setData((current) => {
      const pendingDeleteIds = new Set(pendingDeletesRef.current);
      const byId = new Map(withoutLegacyDemoItems(current.items).map((item) => [item.id, item]));
      withoutLegacyDemoItems(items).forEach((item) => {
        if (pendingDeleteIds.has(item.id)) return;
        const existing = byId.get(item.id);
        if (!existing || new Date(item.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
          byId.set(item.id, item);
        }
      });

      return { ...current, items: [...byId.values()] };
    });
  }

  const mainView = () => {
    if (view === "home") {
      return (
        <HomeDashboard
          items={data.items}
          onOpenCategory={(next) => selectView(next)}
          onOpenItem={openItemDetails}
          onAddItem={addItem}
          onOpenFamily={() => selectView("family")}
          connectedToFamily={Boolean(cloudSession)}
        />
      );
    }

    if (view === "stats") return <StatsView items={data.items} />;
    if (view === "feed") {
      return (
        <SocialFeedView
          settings={effectiveSettings}
          session={cloudSession}
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
        />
      );
    }
    if (view === "settings") return <SettingsView data={data} onReplaceData={setData} onUpdateData={updateData} />;

    return (
      <CategoryView
        view={view}
        items={data.items}
        statuses={data.statuses}
        filters={filters}
        onFiltersChange={setFilters}
        onAdd={addItem}
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

  function selectSocial(nextSection: "profile" | "friends") {
    setSocialSection(nextSection);
    selectView("family");
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
    setCloudSession(null);
    setBootstrappedCloudScope("");
    selectView("home");
    setActiveItemId(null);
    setActiveItemMode("details");
    setSyncStatus({
      kind: "local",
      message: "Sessão encerrada.",
      detail: "A Gaveteira continua funcionando localmente neste navegador.",
    });
  }

  async function autoSync() {
    if (!cloudSession || !cloudBootstrapped) return;
    if (lastSyncedKeyRef.current === syncPayloadKey) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus({
        kind: "offline",
        message: "Sem conexão.",
        detail: "Suas alterações ficaram salvas aqui e serão reenviadas quando a internet voltar.",
      });
      return;
    }

    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    setSyncStatus({
      kind: "syncing",
      message: "Sincronizando...",
      detail: pendingDeletes.length ? "Enviando alterações e removendo itens apagados da nuvem." : "Enviando as últimas alterações para a nuvem.",
    });

    try {
      for (const itemId of pendingDeletes) {
        await deleteMyItem(effectiveSettings, cloudSession, itemId);
      }

      const pendingDeleteIds = new Set(pendingDeletes);
      const itemsToSync = pendingDeleteIds.size ? data.items.filter((item) => !pendingDeleteIds.has(item.id)) : data.items;

      await syncMyItems(effectiveSettings, cloudSession, itemsToSync);
      lastSyncedKeyRef.current = syncPayloadKey;
      if (pendingDeletes.length) {
        setPendingDeletes([]);
      }
      setSyncStatus({
        kind: "synced",
        message: "Tudo sincronizado.",
        detail: "Suas alterações já estão na nuvem.",
      });
    } catch (error) {
      if (isSessionExpiredError(error)) {
        expireSession(error);
      } else {
        setSyncStatus({
          kind: typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending",
          message: "Sincronização pendente.",
          detail: error instanceof Error ? error.message : "Vou tentar de novo automaticamente.",
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
    setCloudSession(null);
    setBootstrappedCloudScope("");
    setSyncStatus({
      kind: "expired",
      message: "Sessão expirada.",
      detail: error instanceof Error ? error.message : "Entre novamente para continuar sincronizando. Seus itens locais foram preservados.",
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>Gaveteira</strong>
            <small>{cloudSession ? cloudSession.profile?.displayName || cloudSession.user.email || "minha conta" : "modo local"}</small>
          </div>
        </div>
        <SyncStatusCard status={syncStatus} onReconnect={() => selectView("family")} />
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
      <SyncStatusCard status={syncStatus} onReconnect={() => selectView("family")} compact />
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
      {activeItem && activeItemMode === "details" ? (
        <ItemDetails
          item={activeItem}
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
          onClose={() => setActiveItemId(null)}
        />
      ) : null}
    </div>
  );
}

function SyncStatusCard({
  status,
  onReconnect,
  compact = false,
}: {
  status: SyncStatus;
  onReconnect: () => void;
  compact?: boolean;
}) {
  const Icon = status.kind === "synced" ? CheckCircle2
    : status.kind === "syncing" || status.kind === "loading" ? Loader2
      : status.kind === "offline" ? WifiOff
        : status.kind === "expired" ? LogIn
          : status.kind === "local" ? CloudOff
            : AlertTriangle;
  const actionable = status.kind === "expired" || status.kind === "local";

  return (
    <section className={`sync-card sync-card-${status.kind}${compact ? " sync-card-compact" : ""}`} aria-live="polite">
      <div className="sync-card-icon">
        <Icon size={compact ? 16 : 18} />
      </div>
      <div>
        <strong>{status.message}</strong>
        {status.detail && !compact ? <span>{status.detail}</span> : null}
      </div>
      {actionable && !compact ? (
        <button type="button" onClick={onReconnect}>
          {status.kind === "expired" ? "Entrar" : "Conectar"}
        </button>
      ) : null}
    </section>
  );
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

export default App;
