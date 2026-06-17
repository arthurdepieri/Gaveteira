import { Archive, BookOpen, CheckCircle2, Circle, Clock3, Disc3, Film, Gamepad2, Library, ListChecks, MessageSquare, RefreshCw, Sparkles, Tv, Users } from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppSettings, Category, CloudSession, CulturalItem, FamilyItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getPlayedHours, getRating, getTitle, isInProgress, isWishlist } from "../utils/itemHelpers";
import { fetchSocialItems } from "../services/supabaseCloud";

const icons: Record<Category, ElementType> = {
  games: Gamepad2,
  books: BookOpen,
  albums: Disc3,
  movies: Film,
  series: Tv,
};

const ONBOARDING_SYNC_SKIP_KEY = "gaveteira-onboarding-sync-skipped:v1";

export function HomeDashboard({
  items,
  settings,
  session,
  onOpenCategory,
  onOpenItem,
  onAddItem,
  onOpenFamily,
  connectedToFamily,
  profileReady,
  favoriteDrawersReady,
}: {
  items: CulturalItem[];
  settings: AppSettings;
  session: CloudSession | null;
  onOpenCategory: (category: Category | "wishlist" | "progress") => void;
  onOpenItem: (item: CulturalItem) => void;
  onAddItem: (category?: Category) => void;
  onOpenFamily: () => void;
  connectedToFamily: boolean;
  profileReady: boolean;
  favoriteDrawersReady: boolean;
}) {
  const [syncSkipped, setSyncSkipped] = useState(() => localStorage.getItem(ONBOARDING_SYNC_SKIP_KEY) === "true");
  const [socialItems, setSocialItems] = useState<FamilyItem[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const stats = buildStats(items);
  const latestItems = [...items].sort((a, b) => dateTime(b.createdAt || b.updatedAt) - dateTime(a.createdAt || a.updatedAt)).slice(0, 3);
  const friendActivity = useMemo(() => buildFriendActivity(socialItems, session?.user.id ?? ""), [socialItems, session?.user.id]);
  const checklist = buildOnboardingChecklist({ items, connectedToFamily, profileReady, favoriteDrawersReady, syncSkipped });
  const showOnboarding = checklist.some((entry) => !entry.done) || items.length < 2;

  useEffect(() => {
    if (!session) {
      setSocialItems([]);
      return;
    }

    let cancelled = false;
    const currentSession = session;
    refreshSocialSilently();
    const intervalId = window.setInterval(refreshSocialSilently, 45_000);

    async function refreshSocialSilently() {
      setSocialError("");
      try {
        const nextItems = await fetchSocialItems(settings, currentSession);
        if (!cancelled) setSocialItems(nextItems);
      } catch (error) {
        if (!cancelled) setSocialError(error instanceof Error ? error.message : "Não consegui abrir o movimento dos amigos.");
      }
    }

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.user.id, settings]);

  function skipSync() {
    localStorage.setItem(ONBOARDING_SYNC_SKIP_KEY, "true");
    setSyncSkipped(true);
  }

  async function refreshSocial() {
    if (!session) return;
    setSocialLoading(true);
    setSocialError("");
    try {
      setSocialItems(await fetchSocialItems(settings, session));
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "Não consegui abrir o movimento dos amigos.");
    } finally {
      setSocialLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Arquivo pessoal de cultura</p>
          <h1>Gaveteira</h1>
          <p>Uma mesa de controle local para o que você jogou, leu, ouviu, assistiu, largou e ainda quer descobrir.</p>
        </div>
        <div className="hero-counters" aria-label="Resumo rápido">
          <strong>{items.length}</strong>
          <span>itens catalogados</span>
        </div>
      </section>

      <section className="quick-stats">
        <Metric label="Jogos zerados" value={stats.headline.gamesCompleted} />
        <Metric label="Livros lidos" value={stats.headline.booksRead} />
        <Metric label="Discos ouvidos" value={stats.headline.albumsHeard} />
        <Metric label="Filmes assistidos" value={stats.headline.moviesWatched} />
        <Metric label="Séries acompanhadas" value={stats.headline.seriesTracked} />
        <Metric label="Na wishlist" value={stats.wishlist.length} />
      </section>

      {showOnboarding ? (
        <section className="onboarding-grid" aria-label="Primeiros passos">
          <article className="onboarding-card onboarding-start">
            <div>
              <p className="eyebrow">Primeiros passos</p>
              <h2>Monte sua Gaveteira sem encarar uma tela vazia</h2>
              <p>Crie seu perfil, escolha gavetas favoritas e guarde a primeira ficha. A nuvem pode vir agora ou depois.</p>
            </div>
            <div className="quick-add-grid">
              {(Object.keys(categoryLabels) as Category[]).map((category) => {
                const Icon = icons[category];
                return (
                  <button key={category} type="button" onClick={() => onAddItem(category)}>
                    <Icon size={18} />
                    <span>{categoryLabels[category]}</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="onboarding-card">
            <div className="section-heading">
              <CheckCircle2 size={20} />
              <h2>Checklist inicial</h2>
            </div>
            <div className="onboarding-checklist">
              {checklist.map((entry) => (
                <button key={entry.label} type="button" className={entry.done ? "done" : ""} onClick={() => entry.action(onAddItem, onOpenFamily, onOpenCategory)}>
                  {entry.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="onboarding-card family-onboarding">
            <Users size={22} />
            <div>
              <h2>{connectedToFamily ? "Social conectado" : syncSkipped ? "Sincronização pulada por enquanto" : "Conectar ou pular"}</h2>
              <p>
                {connectedToFamily
                  ? "Você pode procurar pessoas, aceitar convites e visitar a gaveteira dos seus amigos."
                  : syncSkipped
                    ? "Tudo continua salvo neste navegador. Quando quiser, abra Social para conectar."
                    : "Entre para salvar na nuvem e ver amigos, ou pule para começar só no aparelho."}
              </p>
            </div>
            <div className="onboarding-sync-actions">
              <button type="button" className="ghost" onClick={onOpenFamily}>{connectedToFamily ? "Ver social" : "Conectar"}</button>
              {!connectedToFamily && !syncSkipped ? (
                <button type="button" className="ghost subtle" onClick={skipSync}>Pular por agora</button>
              ) : null}
            </div>
          </article>

          <article className="onboarding-card social-onboarding-card">
            <MessageSquare size={22} />
            <div>
              <p className="eyebrow">Primeiro círculo</p>
              <h2>Convide amigos quando quiser comparar gavetas</h2>
              <p>O social funciona por amizade aceita: fichas visíveis aparecem para amigos; fichas privadas e diários privados continuam guardados.</p>
            </div>
            <div className="social-onboarding-actions">
              <button type="button" className="ghost" onClick={onOpenFamily}>Abrir Social</button>
            </div>
          </article>
        </section>
      ) : null}

      <section className="section home-continue-panel">
        <div className="section-heading split">
          <div className="section-heading">
            <Archive size={20} />
            <h2>Continue de onde parou</h2>
          </div>
          <button type="button" className="ghost compact" onClick={() => onOpenCategory("progress")}>Ver tudo</button>
        </div>
        {stats.inProgress.length ? (
          <div className="continue-grid">
            <button className="continue-featured" onClick={() => onOpenItem(stats.inProgress[0])}>
              <Cover item={stats.inProgress[0]} />
              <span>
                <small>{categoryLabels[stats.inProgress[0].category]} / {stats.inProgress[0].status}</small>
                <strong>{getTitle(stats.inProgress[0])}</strong>
                <em>{continueDetail(stats.inProgress[0])}</em>
                <Stars value={stats.inProgress[0].rating} />
              </span>
            </button>
            <div className="continue-list">
              {stats.inProgress.slice(1, 5).map((item) => (
                <button key={item.id} className="shelf-item" onClick={() => onOpenItem(item)}>
                  <Cover item={item} compact />
                  <span>
                    <strong>{getTitle(item)}</strong>
                    <small>{categoryLabels[item.category]} / {continueDetail(item)}</small>
                  </span>
                  <Stars value={item.rating} />
                </button>
              ))}
              {stats.inProgress.length === 1 ? <p className="empty">Só uma ficha aberta na mesa por enquanto.</p> : null}
            </div>
          </div>
        ) : (
          <div className="home-empty-action">
            <p>Nenhuma ficha aberta agora. Escolha algo para abrir uma nova trilha cultural.</p>
            <div className="button-row">
              <button type="button" className="primary" onClick={() => onOpenCategory("wishlist")}>Abrir wishlist</button>
              <button type="button" className="ghost" onClick={() => onAddItem()}>Abrir nova ficha</button>
            </div>
          </div>
        )}
      </section>

      <section className="section home-life-panel" aria-label="Painel da vida cultural">
        <div className="section-heading split">
          <div className="section-heading">
            <Sparkles size={20} />
            <h2>Movimento recente</h2>
          </div>
          <span className="soft-label">{connectedToFamily ? "local + amigos" : "local"}</span>
        </div>
        <div className="home-live-grid" aria-label="Movimento recente da Gaveteira">
        <HomeShelf
          title="Últimas adições"
          icon={Clock3}
          items={latestItems}
          empty="Nenhuma ficha nova na mesa ainda."
          onOpenItem={onOpenItem}
          metaFor={(item) => [categoryLabels[item.category], item.status].join(" / ")}
        />
        <FriendActivityShelf
          connected={connectedToFamily}
          loading={socialLoading}
          error={socialError}
          activity={friendActivity}
          onOpenFamily={onOpenFamily}
          onRefresh={refreshSocial}
        />
        </div>
      </section>

      <section className="section home-drawers-panel" aria-label="Gaveteira">
        <div className="section-heading split">
          <div className="section-heading">
            <Library size={20} />
            <h2>Gavetas</h2>
          </div>
          <span className="soft-label">{items.length} fichas</span>
        </div>
        <div className="drawer-grid">
          {(Object.keys(categoryLabels) as Category[]).map((category) => {
            const Icon = icons[category];
            return (
              <button className={`drawer drawer-${category}`} key={category} onClick={() => onOpenCategory(category)}>
                <span className="drawer-handle">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{categoryLabels[category]}</strong>
                  <small>{stats.categoryTotals[category]} itens</small>
                </span>
              </button>
            );
          })}
          <button className="drawer drawer-wishlist" onClick={() => onOpenCategory("wishlist")}>
            <span className="drawer-handle">
              <Library size={18} />
            </span>
            <span>
              <strong>Wishlist</strong>
              <small>{stats.wishlist.length} desejos guardados</small>
            </span>
          </button>
          <button className="drawer drawer-progress" onClick={() => onOpenCategory("progress")}>
            <span className="drawer-handle">
              <ListChecks size={18} />
            </span>
            <span>
              <strong>Em andamento</strong>
              <small>{stats.inProgress.length} abertos agora</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

type OnboardingStep = {
  label: string;
  done: boolean;
  action: (
    addItem: (category?: Category) => void,
    openFamily: () => void,
    openCategory: (category: Category | "wishlist" | "progress") => void,
  ) => void;
};

function buildOnboardingChecklist({
  items,
  connectedToFamily,
  profileReady,
  favoriteDrawersReady,
  syncSkipped,
}: {
  items: CulturalItem[];
  connectedToFamily: boolean;
  profileReady: boolean;
  favoriteDrawersReady: boolean;
  syncSkipped: boolean;
}): OnboardingStep[] {
  return [
    {
      label: "Criar perfil",
      done: profileReady,
      action: (_addItem: (category?: Category) => void, openFamily: () => void) => openFamily(),
    },
    {
      label: "Escolher gavetas favoritas",
      done: favoriteDrawersReady,
      action: (_addItem: (category?: Category) => void, openFamily: () => void) => openFamily(),
    },
    {
      label: "Arquivar primeira ficha",
      done: items.length > 0,
      action: (addItem: (category?: Category) => void) => addItem(),
    },
    {
      label: connectedToFamily ? "Sincronização conectada" : syncSkipped ? "Sincronização pulada" : "Conectar ou pular sincronização",
      done: connectedToFamily || syncSkipped,
      action: (_addItem: (category?: Category) => void, openFamily: () => void) => openFamily(),
    },
  ];
}

function HomeShelf({
  title,
  icon: Icon,
  items,
  empty,
  onOpenItem,
  metaFor,
}: {
  title: string;
  icon: ElementType;
  items: CulturalItem[];
  empty: string;
  onOpenItem: (item: CulturalItem) => void;
  metaFor: (item: CulturalItem) => string;
}) {
  return (
    <section className="section home-shelf">
      <div className="section-heading">
        <Icon size={20} />
        <h2>{title}</h2>
      </div>
      <div className="home-shelf-list">
        {items.length ? items.map((item) => (
          <button key={item.id} className="home-shelf-item" onClick={() => onOpenItem(item)}>
            <Cover item={item} compact />
            <span>
              <strong>{getTitle(item)}</strong>
              <small>{metaFor(item)}</small>
            </span>
            <Stars value={item.rating} />
          </button>
        )) : <p className="empty">{empty}</p>}
      </div>
    </section>
  );
}

type FriendActivity = {
  entry: FamilyItem;
  text: string;
  detail: string;
};

function FriendActivityShelf({
  connected,
  loading,
  error,
  activity,
  onOpenFamily,
  onRefresh,
}: {
  connected: boolean;
  loading: boolean;
  error: string;
  activity: FriendActivity[];
  onOpenFamily: () => void;
  onRefresh: () => void;
}) {
  const preview = activity.slice(0, 3);

  return (
    <section className="section home-shelf home-friend-activity">
      <div className="section-heading split">
        <div className="section-heading">
          <MessageSquare size={20} />
          <h2>Resumo social</h2>
        </div>
        {connected ? (
          <div className="home-social-actions">
            <button type="button" className="ghost compact" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={14} />
              Atualizar
            </button>
          </div>
        ) : null}
      </div>
      {!connected ? (
        <div className="home-social-empty">
          <p>Conecte a Gaveteira para ver, sem barulho, o movimento dos seus amigos.</p>
          <button type="button" className="primary" onClick={onOpenFamily}>Abrir Amigos</button>
        </div>
      ) : error ? (
        <div className="home-social-empty">
          <p>{error}</p>
          <button type="button" className="ghost" onClick={onRefresh}>Tentar de novo</button>
        </div>
      ) : activity.length ? (
        <>
        <div className="home-shelf-list">
          {preview.map((event) => (
            <div key={`${event.entry.ownerId}-${event.entry.id}-${event.entry.updatedAt}`} className="home-shelf-item home-activity-item">
              <Cover item={event.entry.item} compact />
              <span>
                <strong>{event.text}</strong>
                <small>{event.detail}</small>
              </span>
              <MessageSquare size={16} />
            </div>
          ))}
        </div>
        </>
      ) : (
        <p className="empty">{loading ? "Abrindo o arquivo social..." : "Quando seus amigos movimentarem fichas, esse canto ganha vida."}</p>
      )}
    </section>
  );
}

function progressLabel(item: CulturalItem) {
  if (item.category === "books" && item.currentPage) {
    return `Progresso: pág. ${item.currentPage}`;
  }

  if (item.category === "games") {
    const hours = getPlayedHours(item);
    if (hours > 0) return `Progresso: ${formatHours(hours)} registradas`;
  }

  if (item.category === "series" && (item.currentSeason || item.currentEpisode)) {
    const season = item.currentSeason ? `T${item.currentSeason}` : "";
    const episode = item.currentEpisode ? `E${item.currentEpisode}` : "";
    return `Progresso: ${[season, episode].filter(Boolean).join(" ")}`;
  }

  if (item.category === "albums") {
    if (item.listenMode === "Parcialmente") return "Escuta parcial registrada";
    if (item.listenCount) return `${item.listenCount} escuta${item.listenCount === 1 ? "" : "s"} registrada${item.listenCount === 1 ? "" : "s"}`;
  }

  if (item.category === "movies" && item.startDate) {
    return "Filme já iniciado";
  }

  return "";
}

function continueDetail(item: CulturalItem) {
  return progressLabel(item) || item.status || categoryLabels[item.category];
}

function formatHours(hours: number) {
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1).replace(".", ",")}h`;
}

function buildFriendActivity(entries: FamilyItem[], viewerId: string): FriendActivity[] {
  return entries
    .filter((entry) => entry.ownerId !== viewerId && entry.item.visibility !== "private")
    .sort((a, b) => dateTime(b.updatedAt) - dateTime(a.updatedAt))
    .slice(0, 3)
    .map((entry) => ({
      entry,
      text: friendActivityText(entry),
      detail: [categoryLabels[entry.item.category], entry.item.status, formatActivityDate(entry.updatedAt)].filter(Boolean).join(" / "),
    }));
}

function friendActivityText(entry: FamilyItem) {
  const title = getTitle(entry.item) || "uma ficha";
  const rating = getRating(entry.item);
  const name = entry.ownerName;

  if (entry.item.status.toLowerCase().includes("abandon")) return `${name} abandonou ${title}`;
  if (rating >= 4.5) return `${name} favoritou ${title}`;
  if (isInProgress(entry.item)) return `${name} está consumindo ${title}`;
  if (isWishlist(entry.item)) return `${name} quer consumir ${title}`;
  return `${name} adicionou ${title}`;
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
