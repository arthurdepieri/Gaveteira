import { Archive, BookOpen, CheckCircle2, Circle, Clock3, Disc3, Film, Gamepad2, Heart, Library, Lightbulb, ListChecks, Sparkles, Tv, Users } from "lucide-react";
import type { ElementType } from "react";
import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getGenres, getPlayedHours, getRating, getTitle, getYear, isInProgress, isWishlist } from "../utils/itemHelpers";

const icons: Record<Category, ElementType> = {
  games: Gamepad2,
  books: BookOpen,
  albums: Disc3,
  movies: Film,
  series: Tv,
};

export function HomeDashboard({
  items,
  onOpenCategory,
  onOpenItem,
  onAddItem,
  onOpenFamily,
  connectedToFamily,
}: {
  items: CulturalItem[];
  onOpenCategory: (category: Category | "wishlist" | "progress") => void;
  onOpenItem: (item: CulturalItem) => void;
  onAddItem: (category: Category) => void;
  onOpenFamily: () => void;
  connectedToFamily: boolean;
}) {
  const stats = buildStats(items);
  const latestItems = [...items].sort((a, b) => dateTime(b.createdAt || b.updatedAt) - dateTime(a.createdAt || a.updatedAt)).slice(0, 5);
  const recentFavorites = [...items]
    .filter((item) => getRating(item) >= 4)
    .sort((a, b) => dateTime(b.updatedAt) - dateTime(a.updatedAt) || getRating(b) - getRating(a))
    .slice(0, 5);
  const suggestions = buildSuggestions(items);
  const checklist = buildOnboardingChecklist(items, connectedToFamily);
  const showOnboarding = checklist.some((entry) => !entry.done) || items.length < 3;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Arquivo pessoal de cultura</p>
          <h1>Gaveteira</h1>
          <p>Uma mesa de controle local para o que você jogou, leu, ouviu, assistiu, largou e ainda quer descobrir.</p>
        </div>
        <div className="hero-counters" aria-label="Resumo rapido">
          <strong>{items.length}</strong>
          <span>itens catalogados</span>
        </div>
      </section>

      <section className="quick-stats">
        <Metric label="Jogos zerados" value={stats.headline.gamesCompleted} />
        <Metric label="Livros lidos" value={stats.headline.booksRead} />
        <Metric label="Álbuns ouvidos" value={stats.headline.albumsHeard} />
        <Metric label="Filmes assistidos" value={stats.headline.moviesWatched} />
        <Metric label="Séries acompanhadas" value={stats.headline.seriesTracked} />
        <Metric label="Na wishlist" value={stats.wishlist.length} />
      </section>

      {showOnboarding ? (
        <section className="onboarding-grid" aria-label="Primeiros passos">
          <article className="onboarding-card onboarding-start">
            <div>
              <p className="eyebrow">Comece por uma ficha</p>
              <h2>Escolha uma gaveta para guardar o primeiro item</h2>
              <p>Depois de digitar o nome, a ficha pode buscar capa e dados automaticamente quando houver fonte disponível.</p>
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
              <h2>{connectedToFamily ? "Social conectado" : "Gaveteira com amigos"}</h2>
              <p>
                {connectedToFamily
                  ? "Você pode procurar pessoas, aceitar convites e visitar a gaveteira dos seus amigos."
                  : "Ao entrar, cada login guarda seus proprios itens e vocês conseguem visitar as gavetas uns dos outros."}
              </p>
            </div>
            <button type="button" className="ghost" onClick={onOpenFamily}>{connectedToFamily ? "Ver social" : "Conectar"}</button>
          </article>
        </section>
      ) : null}

      <section className="drawer-grid" aria-label="Gaveteira">
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
      </section>

      <section className="home-live-grid" aria-label="Movimento recente da Gaveteira">
        <HomeShelf
          title="Últimas adições"
          icon={Clock3}
          items={latestItems}
          empty="Nada novo por aqui ainda."
          onOpenItem={onOpenItem}
          metaFor={(item) => [categoryLabels[item.category], item.status].join(" / ")}
        />
        <HomeShelf
          title="Favoritos recentes"
          icon={Heart}
          items={recentFavorites}
          empty="Suas notas altas vão aparecer aqui."
          onOpenItem={onOpenItem}
          metaFor={(item) => [categoryLabels[item.category], item.rating ? `${item.rating}/5` : ""].filter(Boolean).join(" / ")}
        />
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
          <p className="empty">Quando houver wishlist, notas ou itens em andamento, a Gaveteira sugere o proximo passo.</p>
        )}
      </section>

      <section className="section">
        <div className="section-heading">
          <Archive size={20} />
          <h2>Em andamento</h2>
        </div>
        <div className="shelf-list">
          {stats.inProgress.length ? (
            stats.inProgress.map((item) => (
              <button key={item.id} className="shelf-item" onClick={() => onOpenItem(item)}>
                <Cover item={item} compact />
                <span>
                  <strong>{getTitle(item)}</strong>
                  <small>{item.status}</small>
                </span>
                <Stars value={item.rating} />
              </button>
            ))
          ) : (
            <p className="empty">Nada em andamento. Sua gaveta respirou fundo.</p>
          )}
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

function buildOnboardingChecklist(items: CulturalItem[], connectedToFamily: boolean) {
  return [
    {
      label: "Criar primeira ficha",
      done: items.length > 0,
      action: (addItem: (category: Category) => void) => addItem("games"),
    },
    {
      label: "Dar uma nota",
      done: items.some((item) => getRating(item) > 0),
      action: (_addItem: (category: Category) => void, _openFamily: () => void, openCategory: (category: Category | "wishlist" | "progress") => void) => openCategory("progress"),
    },
    {
      label: "Marcar algo na wishlist",
      done: items.some(isWishlist),
      action: (_addItem: (category: Category) => void, _openFamily: () => void, openCategory: (category: Category | "wishlist" | "progress") => void) => openCategory("wishlist"),
    },
    {
      label: "Conectar social",
      done: connectedToFamily,
      action: (_addItem: (category: Category) => void, openFamily: () => void) => openFamily(),
    },
    {
      label: "Acompanhar algo em andamento",
      done: items.some(isInProgress),
      action: (_addItem: (category: Category) => void, _openFamily: () => void, openCategory: (category: Category | "wishlist" | "progress") => void) => openCategory("progress"),
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

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
