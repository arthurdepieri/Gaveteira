import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { BarChart3, BookOpen, Disc3, Film, Gamepad2, Home, Library, ListChecks, LogOut, Repeat2, Settings, Tv, Users } from "lucide-react";
import { AppData, AppSettings, Category, CloudSession, CulturalItem, ViewKey } from "./types";
import { loadData, saveData } from "./storage/localStore";
import { categoryLabels } from "./data/catalog";
import { HomeDashboard } from "./components/HomeDashboard";
import { CategoryView, emptyFilters, Filters } from "./components/CategoryView";
import { ItemForm, createBlankItem } from "./components/ItemForm";
import { StatsView } from "./components/StatsView";
import { SettingsView } from "./components/SettingsView";
import { FamilyView } from "./components/FamilyView";
import { AuthGate } from "./components/AuthGate";
import { changeFamilyCode, fetchMyItems, loadCloudSession, saveCloudSession } from "./services/supabaseCloud";
import { withSharedCloudSettings } from "./config/sharedCloud";

const navItems: Array<{ key: ViewKey; label: string; icon: ElementType }> = [
  { key: "home", label: "Inicio", icon: Home },
  { key: "games", label: "Jogos", icon: Gamepad2 },
  { key: "books", label: "Livros", icon: BookOpen },
  { key: "albums", label: "Albuns", icon: Disc3 },
  { key: "movies", label: "Filmes", icon: Film },
  { key: "series", label: "Series", icon: Tv },
  { key: "wishlist", label: "Wishlist", icon: Library },
  { key: "progress", label: "Em andamento", icon: ListChecks },
  { key: "stats", label: "Estatisticas", icon: BarChart3 },
  { key: "family", label: "Familia", icon: Users },
  { key: "settings", label: "Configuracoes", icon: Settings },
];

function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [view, setView] = useState<ViewKey>("home");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => loadCloudSession());
  const [sessionMessage, setSessionMessage] = useState("");
  const effectiveSettings = useMemo(() => withSharedCloudSettings(data.settings), [data.settings]);

  useEffect(() => {
    saveData(data);
  }, [data]);

  useEffect(() => {
    saveCloudSession(cloudSession);
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
  }

  function deleteItem(id: string) {
    setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
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
      return <HomeDashboard items={data.items} onOpenCategory={(next) => setView(next)} onOpenItem={(item) => setActiveItemId(item.id)} />;
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
        onOpen={(item) => setActiveItemId(item.id)}
      />
    );
  };

  async function authenticated(session: CloudSession) {
    setCloudSession(session);
    setSessionMessage("");

    try {
      const cloudItems = await fetchMyItems(effectiveSettings, session);
      if (cloudItems.length) {
        mergeItems(cloudItems);
        setSessionMessage("Itens da sua conta foram mesclados neste navegador.");
      }
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : "Nao foi possivel carregar seus itens da nuvem.");
    }
  }

  function logout() {
    setCloudSession(null);
    setView("home");
    setActiveItemId(null);
    setSessionMessage("Sessao encerrada.");
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
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            const count = item.key in categoryLabels ? data.items.filter((entry) => entry.category === item.key).length : undefined;
            return (
              <button key={item.key} className={active ? "active" : ""} onClick={() => setView(item.key)}>
                <Icon size={18} />
                <span>{item.label}</span>
                {count !== undefined ? <small>{count}</small> : null}
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
      {activeItem ? (
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

export default App;
