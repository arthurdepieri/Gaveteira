import { Archive, BookOpen, CheckCircle2, Circle, Clock3, Disc3, Film, Gamepad2, Heart, Library, Lightbulb, ListChecks, MessageSquare, RefreshCw, Sparkles, Tv, Users } from "lucide-react";
import type { ElementType } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppSettings, Category, CloudSession, CulturalItem, FamilyItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getGenres, getPlayedHours, getRating, getTitle, getYear, isInProgress, isWishlist } from "../utils/itemHelpers";
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
  onOpenFeed,
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
  onOpenFeed: () => void;
  connectedToFamily: boolean;
  profileReady: boolean;
  favoriteDrawersReady: boolean;
}) {
  const [syncSkipped, setSyncSkipped] = useState(() => localStorage.getItem(ONBOARDING_SYNC_SKIP_KEY) === "true");
  const [socialItems, setSocialItems] = useState<FamilyItem[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState("");
  const stats = buildStats(items);
  const latestItems = [...items].sort((a, b) => dateTime(b.createdAt || b.updatedAt) - dateTime(a.createdAt || a.updatedAt)).slice(0, 5);
  const recentFavorites = [...items]
    .filter((item) => getRating(item) >= 4)
    .sort((a, b) => dateTime(b.updatedAt) - dateTime(a.updatedAt) || getRating(b) - getRating(a))
    .slice(0, 5);
  const suggestions = buildSuggestions(items);
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
        <HomeShelf
          title="Favoritos recentes"
          icon={Heart}
          items={recentFavorites}
          empty="Suas fichas mais queridas vão aparecer aqui."
          onOpenItem={onOpenItem}
          metaFor={(item) => [categoryLabels[item.category], item.rating ? `${item.rating}/5` : ""].filter(Boolean).join(" / ")}
        />
        <FriendActivityShelf
          connected={connectedToFamily}
          loading={socialLoading}
          error={socialError}
          activity={friendActivity}
          onOpenFamily={onOpenFamily}
          onOpenFeed={onOpenFeed}
          onRefresh={refreshSocial}
        />
        </div>
      </section>

      <section className="section home-suggestions">
        <div className="section-heading">
          <Lightbulb size={20} />
          <h2>Sugestões da Gaveteira</h2>
        </div>
        {suggestions.length ? (
          <div className="suggestion-grid">
            {suggestions.map((suggestion) => (
              <button key={`${suggestion.reason}-${suggestion.item.id}`} className="suggestion-card" onClick={() => onOpenItem(suggestion.item)}>
                <Cover item={suggestion.item} compact />
                <span className="suggestion-copy">
                  <small>{suggestion.reason}</small>
                  <strong>{getTitle(suggestion.item)}</strong>
                  <em>{suggestion.detail}</em>
                  <span className="suggestion-reasons" aria-label="Motivos da sugestão">
                    {suggestion.reasons.map((reason) => <b key={reason}>{reason}</b>)}
                  </span>
                </span>
                <Sparkles size={18} />
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">Quando houver wishlist, notas ou fichas abertas, a Gaveteira separa algumas sugestões para você.</p>
        )}
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
  onOpenFeed,
  onRefresh,
}: {
  connected: boolean;
  loading: boolean;
  error: string;
  activity: FriendActivity[];
  onOpenFamily: () => void;
  onOpenFeed: () => void;
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
            <button type="button" className="ghost compact" onClick={onOpenFeed}>Ver Feed</button>
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
        <p className="home-social-hint">Movimento completo, diário público e comparações ficam no Feed.</p>
        </>
      ) : (
        <p className="empty">{loading ? "Abrindo o arquivo social..." : "Quando seus amigos movimentarem fichas, esse canto ganha vida."}</p>
      )}
    </section>
  );
}

type Suggestion = {
  item: CulturalItem;
  reason: string;
  detail: string;
  reasons: string[];
  score: number;
};

type SuggestionSignal = {
  label: string;
  score: number;
  kind: "status" | "favorite" | "genre" | "age" | "progress" | "stale";
};

type PreferenceProfile = {
  genres: Map<string, { label: string; weight: number }>;
  categoryWeights: Map<Category, number>;
  maxGenreWeight: number;
  maxCategoryWeight: number;
};

const DAY_MS = 86_400_000;

const suggestionWeights = {
  wishlist: 16,
  inProgress: 22,
  favorite: 10,
  genreAffinity: 24,
  categoryAffinity: 10,
  backlogAge: 18,
  currentProgress: 18,
  staleInProgress: 26,
};

function buildSuggestions(items: CulturalItem[]): Suggestion[] {
  const profile = buildPreferenceProfile(items);

  return items
    .filter((item) => isWishlist(item) || isInProgress(item))
    .map((item) => scoreSuggestion(item, profile))
    .filter((suggestion) => suggestion.score > 0)
    .sort((a, b) => (
      b.score - a.score
      || latestInteractionTime(a.item) - latestInteractionTime(b.item)
      || getTitle(a.item).localeCompare(getTitle(b.item))
    ))
    .slice(0, 3);
}

function suggestionMeta(item: CulturalItem) {
  return [categoryLabels[item.category], getYear(item), item.status].filter(Boolean).join(" / ");
}

function scoreSuggestion(item: CulturalItem, profile: PreferenceProfile): Suggestion {
  const signals = [
    statusSignal(item),
    favoriteSignal(item),
    genreAffinitySignal(item, profile),
    categoryAffinitySignal(item, profile),
    backlogAgeSignal(item),
    progressSignal(item),
    staleSignal(item),
  ].filter(Boolean) as SuggestionSignal[];
  const orderedSignals = signals.sort((a, b) => b.score - a.score);
  const score = orderedSignals.reduce((total, signal) => total + signal.score, 0);

  return {
    item,
    score,
    reason: primarySuggestionReason(orderedSignals[0]?.kind, item),
    detail: suggestionMeta(item),
    reasons: orderedSignals
      .filter((signal) => signal.kind !== "status" || orderedSignals.length < 3)
      .slice(0, 4)
      .map((signal) => signal.label),
  };
}

function statusSignal(item: CulturalItem): SuggestionSignal | undefined {
  if (isInProgress(item)) {
    return { kind: "status", label: "Em andamento", score: suggestionWeights.inProgress };
  }

  if (isWishlist(item)) {
    return { kind: "status", label: "Na wishlist", score: suggestionWeights.wishlist };
  }

  return undefined;
}

function favoriteSignal(item: CulturalItem): SuggestionSignal | undefined {
  const rating = getRating(item);
  if (rating < 4) return undefined;
  return {
    kind: "favorite",
    label: `Você já marcou ${rating}/5`,
    score: suggestionWeights.favorite,
  };
}

function genreAffinitySignal(item: CulturalItem, profile: PreferenceProfile): SuggestionSignal | undefined {
  if (!profile.maxGenreWeight) return undefined;

  const matches = getGenres(item)
    .map((genre) => profile.genres.get(normalizeAffinityKey(genre)))
    .filter(Boolean) as Array<{ label: string; weight: number }>;
  if (!matches.length) return undefined;

  const rawWeight = matches.reduce((total, match) => total + match.weight, 0);
  const score = Math.round(Math.min(1, rawWeight / profile.maxGenreWeight) * suggestionWeights.genreAffinity);
  return {
    kind: "genre",
    label: `Gênero favorito: ${matches.map((match) => match.label).slice(0, 2).join(", ")}`,
    score,
  };
}

function categoryAffinitySignal(item: CulturalItem, profile: PreferenceProfile): SuggestionSignal | undefined {
  if (!profile.maxCategoryWeight) return undefined;

  const rawWeight = profile.categoryWeights.get(item.category) ?? 0;
  if (!rawWeight) return undefined;

  return {
    kind: "favorite",
    label: `Categoria forte: ${categoryLabels[item.category]}`,
    score: Math.round(Math.min(1, rawWeight / profile.maxCategoryWeight) * suggestionWeights.categoryAffinity),
  };
}

function backlogAgeSignal(item: CulturalItem): SuggestionSignal | undefined {
  if (!isWishlist(item)) return undefined;

  const days = ageInDays(item.createdAt || item.updatedAt);
  if (days < 7) return undefined;

  return {
    kind: "age",
    label: `Na fila ${formatAge(days)}`,
    score: Math.min(suggestionWeights.backlogAge, Math.max(4, Math.round(days / 7 * 1.5))),
  };
}

function progressSignal(item: CulturalItem): SuggestionSignal | undefined {
  if (!isInProgress(item)) return undefined;

  const label = progressLabel(item);
  if (!label) return undefined;

  return {
    kind: "progress",
    label,
    score: progressScore(item),
  };
}

function staleSignal(item: CulturalItem): SuggestionSignal | undefined {
  if (!isInProgress(item)) return undefined;

  const days = Math.floor(Math.max(0, Date.now() - latestInteractionTime(item)) / DAY_MS);
  if (days < 21) return undefined;

  return {
    kind: "stale",
    label: `Parado ${formatAge(days)}`,
    score: Math.min(suggestionWeights.staleInProgress, 12 + Math.round((days - 21) / 7 * 3)),
  };
}

function primarySuggestionReason(kind: SuggestionSignal["kind"] | undefined, item: CulturalItem) {
  if (kind === "stale") return "Retomar antes de esfriar";
  if (kind === "progress") return "Continuar de onde parou";
  if (kind === "genre" || kind === "favorite") return "Combina com seus favoritos";
  if (kind === "age") return "Resgatar da wishlist";
  if (isInProgress(item)) return "Retomar andamento";
  if (isWishlist(item)) return "Tirar da wishlist";
  return "Próximo bom candidato";
}

function buildPreferenceProfile(items: CulturalItem[]): PreferenceProfile {
  const genres = new Map<string, { label: string; weight: number }>();
  const categoryWeights = new Map<Category, number>();

  items.filter((item) => getRating(item) >= 4).forEach((item) => {
    const ratingWeight = getRating(item);
    categoryWeights.set(item.category, (categoryWeights.get(item.category) ?? 0) + ratingWeight);

    getGenres(item).forEach((genre) => {
      const key = normalizeAffinityKey(genre);
      const current = genres.get(key);
      genres.set(key, {
        label: current?.label ?? genre,
        weight: (current?.weight ?? 0) + ratingWeight,
      });
    });
  });

  return {
    genres,
    categoryWeights,
    maxGenreWeight: Math.max(0, ...[...genres.values()].map((genre) => genre.weight)),
    maxCategoryWeight: Math.max(0, ...categoryWeights.values()),
  };
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

function progressScore(item: CulturalItem) {
  if (item.category === "books" && item.currentPage) {
    const pageProgress = item.pages ? Math.min(1, item.currentPage / item.pages) : 0.5;
    return Math.round(8 + pageProgress * (suggestionWeights.currentProgress - 8));
  }

  if (item.category === "games") {
    return Math.min(suggestionWeights.currentProgress, 8 + Math.round(getPlayedHours(item) / 6));
  }

  if (item.category === "series") {
    return Math.min(suggestionWeights.currentProgress, 8 + (item.currentSeason ?? 0) * 2 + (item.currentEpisode ? 2 : 0));
  }

  if (item.category === "albums") {
    return item.listenMode === "Parcialmente" ? 12 : 10;
  }

  return 8;
}

function latestInteractionTime(item: CulturalItem) {
  return Math.max(
    dateTime(item.updatedAt),
    ...item.timeline.map((event) => dateTime(event.date)),
    ...item.diary.map((entry) => dateTime(entry.date)),
  );
}

function ageInDays(value: string) {
  const timestamp = dateTime(value);
  if (!timestamp) return 0;
  return Math.floor(Math.max(0, Date.now() - timestamp) / DAY_MS);
}

function formatAge(days: number) {
  if (days === 1) return "há 1 dia";
  if (days < 60) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

function formatHours(hours: number) {
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1).replace(".", ",")}h`;
}

function normalizeAffinityKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildFriendActivity(entries: FamilyItem[], viewerId: string): FriendActivity[] {
  return entries
    .filter((entry) => entry.ownerId !== viewerId && entry.item.visibility !== "private")
    .sort((a, b) => dateTime(b.updatedAt) - dateTime(a.updatedAt))
    .slice(0, 5)
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
