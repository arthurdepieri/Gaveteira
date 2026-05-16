import { Archive, BookOpen, CheckCircle2, Circle, Clock3, Disc3, Film, Gamepad2, Heart, Library, Lightbulb, ListChecks, Sparkles, Tv, Users } from "lucide-react";
import type { ElementType } from "react";
import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getGenres, getRating, getTitle, getYear, isInProgress, isWishlist } from "../utils/itemHelpers";

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
  familyCode,
}: {
  items: CulturalItem[];
  onOpenCategory: (category: Category | "wishlist" | "progress") => void;
  onOpenItem: (item: CulturalItem) => void;
  onAddItem: (category: Category) => void;
  onOpenFamily: () => void;
  connectedToFamily: boolean;
  familyCode?: string;
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
          <p>Uma mesa de controle local para o que voce jogou, leu, ouviu, assistiu, largou e ainda quer descobrir.</p>
        </div>
        <div className="hero-counters" aria-label="Resumo rapido">
          <strong>{items.length}</strong>
          <span>itens catalogados</span>
        </div>
      </section>

      <section className="quick-stats">
        <Metric label="Jogos zerados" value={stats.headline.gamesCompleted} />
        <Metric label="Livros lidos" value={stats.headline.booksRead} />
        <Metric label="Albuns ouvidos" value={stats.headline.albumsHeard} />
        <Metric label="Filmes assistidos" value={stats.headline.moviesWatched} />
        <Metric label="Series acompanhadas" value={stats.headline.seriesTracked} />
        <Metric label="Na wishlist" value={stats.wishlist.length} />
      </section>

      {showOnboarding ? (
        <section className="onboarding-grid" aria-label="Primeiros passos">
          <article className="onboarding-card onboarding-start">
            <div>
              <p className="eyebrow">Comece por uma ficha</p>
              <h2>Escolha uma gaveta para guardar o primeiro item</h2>
              <p>Depois de digitar o nome, a ficha pode buscar capa e dados automaticamente quando houver fonte disponivel.</p>
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
              <h2>{connectedToFamily ? "Familia conectada" : "Gaveteira em familia"}</h2>
              <p>
                {connectedToFamily
                  ? `Voce esta na familia ${familyCode || "configurada"}. Cada pessoa mantem a propria lista e a aba Familia mostra tudo separado.`
                  : "Ao entrar em uma familia, cada login guarda seus proprios itens e voces conseguem visitar as gavetas uns dos outros."}
              </p>
            </div>
            <button type="button" className="ghost" onClick={onOpenFamily}>{connectedToFamily ? "Ver familia" : "Conectar"}</button>
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
          title="Ultimas adicoes"
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
          empty="Suas notas altas vao aparecer aqui."
          onOpenItem={onOpenItem}
          metaFor={(item) => [categoryLabels[item.category], item.rating ? `${item.rating}/5` : ""].filter(Boolean).join(" / ")}
        />
      </section>

      <section className="section home-suggestions">
        <div className="section-heading">
          <Lightbulb size={20} />
          <h2>Sugestoes da Gaveteira</h2>
        </div>
        {suggestions.length ? (
          <div className="suggestion-grid">
            {suggestions.map((suggestion) => (
              <button key={`${suggestion.reason}-${suggestion.item.id}`} className="suggestion-card" onClick={() => onOpenItem(suggestion.item)}>
                <Cover item={suggestion.item} compact />
                <span>
                  <small>{suggestion.reason}</small>
                  <strong>{getTitle(suggestion.item)}</strong>
                  <em>{suggestion.detail}</em>
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
      label: "Entrar na familia",
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

function buildSuggestions(items: CulturalItem[]) {
  const wishlist = items.filter(isWishlist);
  const inProgress = items.filter(isInProgress);
  const highlyRatedGenres = topGenres(items.filter((item) => getRating(item) >= 4));
  const suggestions: Array<{ item: CulturalItem; reason: string; detail: string }> = [];
  const wishlistPick = pickRotating(wishlist);
  const progressPick = pickOldestTouched(inProgress);
  const genrePick = highlyRatedGenres.length
    ? pickRotating(items.filter((item) => isWishlist(item) && getGenres(item).some((genre) => highlyRatedGenres.includes(genre))))
    : undefined;

  if (wishlistPick) {
    suggestions.push({
      item: wishlistPick,
      reason: "Tirar da wishlist",
      detail: suggestionMeta(wishlistPick),
    });
  }

  if (progressPick && progressPick.id !== wishlistPick?.id) {
    suggestions.push({
      item: progressPick,
      reason: "Retomar andamento",
      detail: suggestionMeta(progressPick),
    });
  }

  if (genrePick && !suggestions.some((suggestion) => suggestion.item.id === genrePick.id)) {
    suggestions.push({
      item: genrePick,
      reason: "Combina com seus favoritos",
      detail: getGenres(genrePick).filter((genre) => highlyRatedGenres.includes(genre)).slice(0, 2).join(", ") || suggestionMeta(genrePick),
    });
  }

  return suggestions.slice(0, 3);
}

function suggestionMeta(item: CulturalItem) {
  return [categoryLabels[item.category], getYear(item), item.status].filter(Boolean).join(" / ");
}

function pickRotating(items: CulturalItem[]) {
  if (!items.length) return undefined;
  const sorted = [...items].sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
  const day = Math.floor(Date.now() / 86_400_000);
  return sorted[day % sorted.length];
}

function pickOldestTouched(items: CulturalItem[]) {
  return [...items].sort((a, b) => dateTime(a.updatedAt) - dateTime(b.updatedAt))[0];
}

function topGenres(items: CulturalItem[]) {
  const counts = items.flatMap(getGenres).reduce<Record<string, number>>((acc, genre) => {
    acc[genre] = (acc[genre] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
