import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import { Archive, BarChart3, BookOpen, ChevronDown, Disc3, Film, Gamepad2, Home, Library, ListChecks, LogOut, Repeat2, Settings, Tv, Users } from "lucide-react";
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
import { AuthGate } from "./components/AuthGate";
import { changeFamilyCode, deleteMyItem, fetchMyItems, loadCloudSession, saveCloudSession, syncMyItems } from "./services/supabaseCloud";
import { withSharedCloudSettings } from "./config/sharedCloud";

const PENDING_DELETES_KEY = "gaveteira-pending-deletes:v1";
const AUTO_SYNC_DELAY_MS = 900;
const AUTO_SYNC_RETRY_MS = 30_000;

const navItems: Array<{ key: ViewKey; label: string; icon: ElementType }> = [
  { key: "home", label: "Inicio", icon: Home },
  { key: "wishlist", label: "Wishlist", icon: Library },
  { key: "progress", label: "Em andamento", icon: ListChecks },
  { key: "stats", label: "Estatisticas", icon: BarChart3 },
  { key: "family", label: "Familia", icon: Users },
  { key: "settings", label: "Configuracoes", icon: Settings },
];

const drawerItems: Array<{ key: Category; label: string; icon: ElementType }> = [
  { key: "games", label: "Jogos", icon: Gamepad2 },
  { key: "books", label: "Livros", icon: BookOpen },
  { key: "albums", label: "Albuns", icon: Disc3 },
  { key: "movies", label: "Filmes", icon: Film },
  { key: "series", label: "Series", icon: Tv },
];

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<ViewKey>("home");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeItemMode, setActiveItemMode] = useState<"details" | "edit">("details");
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => loadCloudSession());
  const [cloudBootstrapped, setCloudBootstrapped] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>(() => loadPendingDeletes());
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncedKeyRef = useRef("");
  const effectiveSettings = useMemo(() => withSharedCloudSettings(data.settings), [data.settings]);
  const syncPayloadKey = useMemo(() => JSON.stringify({
    items: data.items.map((item) => [item.id, item.updatedAt]),
    deletes: pendingDeletes,
  }), [data.items, pendingDeletes]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    saveCloudSession(cloudSession);
  }, [cloudSession]);

  useEffect(() => {
    savePendingDeletes(pendingDeletes);
  }, [pendingDeletes]);

  useEffect(() => {
    if (!cloudSession) {
      setCloudBootstrapped(false);
      return;
    }

    let cancelled = false;
    setCloudBootstrapped(false);
    setSessionMessage("Carregando itens da sua conta...");

    fetchMyItems(effectiveSettings, cloudSession)
      .then((cloudItems) => {
        if (cancelled) return;
        if (cloudItems.length) {
          mergeItems(cloudItems);
        }
        setSessionMessage(cloudItems.length ? "Itens da sua conta foram mesclados neste navegador." : "Conta pronta para sincronizar.");
        setCloudBootstrapped(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setSessionMessage(error instanceof Error ? error.message : "Nao foi possivel carregar seus itens da nuvem.");
        setCloudBootstrapped(true);
      });

    return () => {
      cancelled = true;
    };
  }, [cloudSession?.user.id, effectiveSettings.cloud?.familyCode]);

  useEffect(() => {
    if (!cloudSession || !cloudBootstrapped) return;

    const timeoutId = window.setTimeout(() => {
      autoSync();
    }, AUTO_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [cloudSession, cloudBootstrapped, syncPayloadKey, syncRetryTick, effectiveSettings.cloud?.familyCode]);

  useEffect(() => {
    function retrySync() {
      setSyncRetryTick((current) => current + 1);
    }

    window.addEventListener("online", retrySync);
    const intervalId = window.setInterval(retrySync, AUTO_SYNC_RETRY_MS);

    return () => {
      window.removeEventListener("online", retrySync);
      window.clearInterval(intervalId);
    };
  }, []);

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
      const byId = new Map(current.items.map((item) => [item.id, item]));
      items.forEach((item) => {
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
      return <HomeDashboard items={data.items} onOpenCategory={(next) => setView(next)} onOpenItem={openItemDetails} />;
    }

    if (view === "stats") return <StatsView items={data.items} />;
    if (view === "family") return <FamilyView settings={effectiveSettings} session={cloudSession!} localItems={data.items} onMergeItems={mergeItems} onLogout={logout} />;
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

  async function authenticated(session: CloudSession) {
    setCloudSession(session);
    setSyncMessage("");
  }

  function logout() {
    setCloudSession(null);
    setCloudBootstrapped(false);
    setView("home");
    setActiveItemId(null);
    setActiveItemMode("details");
    setSessionMessage("Sessao encerrada.");
    setSyncMessage("");
  }

  async function autoSync() {
    if (!cloudSession || !cloudBootstrapped) return;
    if (lastSyncedKeyRef.current === syncPayloadKey) return;

    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    setSyncMessage("Sincronizando alteracoes...");

    try {
      for (const itemId of pendingDeletes) {
        await deleteMyItem(effectiveSettings, cloudSession, itemId);
      }

      await syncMyItems(effectiveSettings, cloudSession, data.items);
      lastSyncedKeyRef.current = syncPayloadKey;
      if (pendingDeletes.length) {
        setPendingDeletes([]);
      }
      setSyncMessage("Tudo sincronizado.");
    } catch (error) {
      setSyncMessage(error instanceof Error ? `Pendente de sincronizacao: ${error.message}` : "Pendente de sincronizacao.");
    } finally {
      syncInFlightRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        setSyncRetryTick((current) => current + 1);
      }
    }
  }

  async function switchFamily() {
    if (!cloudSession) return;

    const currentFamilyCode = effectiveSettings.cloud?.familyCode ?? "";
    const nextFamilyCode = window.prompt("Digite o novo codigo da familia:", currentFamilyCode)?.trim();

    if (!nextFamilyCode || nextFamilyCode === currentFamilyCode) return;

    const nextSettings: AppSettings = {
      ...data.settings,
      cloud: {
        ...data.settings.cloud,
        familyCode: nextFamilyCode,
      },
    };
    const nextEffectiveSettings = withSharedCloudSettings(nextSettings);

    try {
      const profile = await changeFamilyCode(nextEffectiveSettings, cloudSession, nextFamilyCode);
      setData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          cloud: {
            ...current.settings.cloud,
            familyCode: nextFamilyCode,
          },
        },
      }));
      setCloudSession((current) => current ? { ...current, profile } : current);
      setView("family");
      setSessionMessage(`Familia alterada para ${nextFamilyCode}.`);
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "Nao foi possivel trocar de familia.");
    }
  }

  if (!cloudSession) {
    return <AuthGate settings={effectiveSettings} onUpdateSettings={updateSettings} onAuthenticated={authenticated} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>Gaveteira</strong>
            <small>{cloudSession.profile?.displayName || cloudSession.user.email || "minha conta"}</small>
          </div>
        </div>
        {sessionMessage ? <p className="sidebar-note">{sessionMessage}</p> : null}
        {syncMessage ? <p className="sidebar-note sync-note">{syncMessage}</p> : null}
        <nav>
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
                  <button key={item.key} className={active ? "active" : ""} onClick={() => setView(item.key)}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button key={item.key} className={active ? "active" : ""} onClick={() => setView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="sidebar-action" onClick={switchFamily}>
          <Repeat2 size={18} />
          <span>Trocar familia</span>
        </button>
        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </aside>
      {mainView()}
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
          cloudSession={cloudSession}
          onSave={upsertItem}
          onDelete={deleteItem}
          onClose={() => setActiveItemId(null)}
        />
      ) : null}
    </div>
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
