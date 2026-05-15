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
  const [bootstrappedCloudScope, setBootstrappedCloudScope] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>(() => loadPendingDeletes());
  const [familySwitcherOpen, setFamilySwitcherOpen] = useState(false);
  const [familyDraft, setFamilyDraft] = useState("");
  const [familySwitching, setFamilySwitching] = useState(false);
  const [familySwitchError, setFamilySwitchError] = useState("");
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncedKeyRef = useRef("");
  const pendingDeletesRef = useRef(pendingDeletes);
  const effectiveSettings = useMemo(() => withSharedCloudSettings(data.settings), [data.settings]);
  const cloudScopeKey = useMemo(() => JSON.stringify({
    userId: cloudSession?.user.id ?? "",
    familyCode: effectiveSettings.cloud?.familyCode ?? "",
  }), [cloudSession?.user.id, effectiveSettings.cloud?.familyCode]);
  const cloudBootstrapped = Boolean(cloudSession && bootstrappedCloudScope === cloudScopeKey);
  const syncPayloadKey = useMemo(() => JSON.stringify({
    userId: cloudSession?.user.id ?? "",
    familyCode: effectiveSettings.cloud?.familyCode ?? "",
    items: data.items.map((item) => [item.id, item.updatedAt]),
    deletes: pendingDeletes,
  }), [cloudSession?.user.id, data.items, effectiveSettings.cloud?.familyCode, pendingDeletes]);

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
      return;
    }
    if (cloudBootstrapped) return;

    let cancelled = false;
    setBootstrappedCloudScope("");
    setSessionMessage("Carregando itens da sua conta...");

    fetchMyItems(effectiveSettings, cloudSession)
      .then((cloudItems) => {
        if (cancelled) return;
        const pendingDeleteIds = new Set(pendingDeletesRef.current);
        const safeCloudItems = cloudItems.filter((item) => !pendingDeleteIds.has(item.id));
        if (safeCloudItems.length) {
          mergeItems(safeCloudItems);
        }
        setSessionMessage(safeCloudItems.length ? "Itens da sua conta foram mesclados neste navegador." : "Conta pronta para sincronizar.");
        setBootstrappedCloudScope(cloudScopeKey);
      })
      .catch((error) => {
        if (cancelled) return;
        setSessionMessage(error instanceof Error ? error.message : "Nao foi possivel carregar seus itens da nuvem.");
        setBootstrappedCloudScope("");
      });

    return () => {
      cancelled = true;
    };
  }, [cloudBootstrapped, cloudScopeKey, cloudSession, effectiveSettings, syncRetryTick]);

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
      const pendingDeleteIds = new Set(pendingDeletesRef.current);
      const byId = new Map(current.items.map((item) => [item.id, item]));
      items.forEach((item) => {
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
      return <HomeDashboard items={data.items} onOpenCategory={(next) => setView(next)} onOpenItem={openItemDetails} />;
    }

    if (view === "stats") return <StatsView items={data.items} />;
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

  async function authenticated(session: CloudSession) {
    setCloudSession(session);
    setSyncMessage("");
  }

  function logout() {
    setCloudSession(null);
    setBootstrappedCloudScope("");
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

      const pendingDeleteIds = new Set(pendingDeletes);
      const itemsToSync = pendingDeleteIds.size ? data.items.filter((item) => !pendingDeleteIds.has(item.id)) : data.items;

      await syncMyItems(effectiveSettings, cloudSession, itemsToSync);
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

  function openFamilySwitcher() {
    if (!cloudSession) return;

    const currentFamilyCode = effectiveSettings.cloud?.familyCode ?? "";
    setFamilyDraft(currentFamilyCode);
    setFamilySwitchError("");
    setFamilySwitcherOpen(true);
  }

  function closeFamilySwitcher() {
    if (familySwitching) return;
    setFamilySwitcherOpen(false);
    setFamilySwitchError("");
  }

  async function switchFamily() {
    if (!cloudSession) return;

    const currentFamilyCode = effectiveSettings.cloud?.familyCode ?? "";
    const nextFamilyCode = familyDraft.trim();

    if (!nextFamilyCode) {
      setFamilySwitchError("Digite o codigo da familia antes de continuar.");
      return;
    }

    if (nextFamilyCode === currentFamilyCode) {
      closeFamilySwitcher();
      return;
    }

    const nextSettings: AppSettings = {
      ...data.settings,
      cloud: {
        ...data.settings.cloud,
        familyCode: nextFamilyCode,
      },
    };
    const nextEffectiveSettings = withSharedCloudSettings(nextSettings);

    try {
      setFamilySwitching(true);
      setFamilySwitchError("");
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
      setFamilySwitcherOpen(false);
    } catch (error) {
      setFamilySwitchError(error instanceof Error ? error.message : "Nao foi possivel trocar de familia.");
    } finally {
      setFamilySwitching(false);
    }
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
        {!cloudSession ? <p className="sidebar-note">Modo local ativo. Seus dados ficam neste navegador.</p> : null}
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
        {cloudSession ? (
          <>
            <button className="sidebar-action" onClick={openFamilySwitcher}>
              <Repeat2 size={18} />
              <span>Trocar familia</span>
            </button>
            <button className="sidebar-logout" onClick={logout}>
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </>
        ) : (
          <button className="sidebar-action" onClick={() => setView("family")}>
            <Repeat2 size={18} />
            <span>Conectar/sincronizar</span>
          </button>
        )}
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
          cloudSession={cloudSession ?? undefined}
          onSave={upsertItem}
          onDelete={deleteItem}
          onClose={() => setActiveItemId(null)}
        />
      ) : null}
      {familySwitcherOpen && cloudSession ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="family-switch-title">
          <form className="modal family-switch-modal" onSubmit={(event) => { event.preventDefault(); switchFamily(); }}>
            <header className="modal-header">
              <div>
                <p className="eyebrow">Conexao familiar</p>
                <h2 id="family-switch-title">Trocar familia</h2>
              </div>
              <button className="ghost" type="button" onClick={closeFamilySwitcher} disabled={familySwitching}>Fechar</button>
            </header>

            <div className="family-switch-body">
              <div className="family-switch-current">
                <span>Familia atual</span>
                <strong>{effectiveSettings.cloud?.familyCode || "nenhuma familia configurada"}</strong>
              </div>
              <label>
                Novo codigo da familia
                <input
                  value={familyDraft}
                  onChange={(event) => setFamilyDraft(event.target.value)}
                  placeholder="primos-2026"
                  autoFocus
                />
              </label>
              <p className="family-switch-help">
                Ao trocar, seus itens locais continuam neste navegador. A aba Familia passa a mostrar os membros e itens do novo codigo.
              </p>
              {familySwitchError ? <p className="form-error">{familySwitchError}</p> : null}
            </div>

            <footer className="modal-footer">
              <button className="ghost" type="button" onClick={closeFamilySwitcher} disabled={familySwitching}>Cancelar</button>
              <button className="primary" type="submit" disabled={familySwitching || !familyDraft.trim()}>
                {familySwitching ? "Trocando..." : "Trocar familia"}
              </button>
            </footer>
          </form>
        </div>
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
