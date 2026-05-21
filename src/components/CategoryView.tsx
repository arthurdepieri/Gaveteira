import { BookOpen, Disc3, Film, Gamepad2, Library, ListChecks, Plus, Search, Sparkles, Tv } from "lucide-react";
import type { ElementType } from "react";
import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { getGenres, getPlayedHours, getRating, getTitle, getYear, isInProgress, isVisibleToFriends, isWishlist } from "../utils/itemHelpers";
import { ItemCard } from "./ItemCard";

type SortMode = "recent" | "titleAsc" | "yearDesc" | "ratingDesc" | "playedHoursDesc" | "playedHoursAsc";

export interface Filters {
  search: string;
  year: string;
  status: string;
  genre: string;
  minRating: string;
  visibility: string;
  sort: SortMode;
}

const emptyFilters: Filters = { search: "", year: "", status: "", genre: "", minRating: "", visibility: "", sort: "recent" };

const emptyStateByCategory: Record<Category, { title: string; text: string; action: string; icon: ElementType }> = {
  games: {
    title: "Sua gaveta de jogos ainda está vazia.",
    text: "Comece pelo jogo que você está jogando agora, um favorito antigo ou algo que quer jogar no futuro.",
    action: "Adicionar primeiro jogo",
    icon: Gamepad2,
  },
  books: {
    title: "Sua gaveta de livros está esperando a primeira ficha.",
    text: "Guarde o livro atual, um clássico da sua lista ou aquele PDF que vive aberto em alguma aba.",
    action: "Buscar livro",
    icon: BookOpen,
  },
  albums: {
    title: "Nenhum disco arquivado ainda.",
    text: "Registre um disco que você ouviu inteiro, quer ouvir com calma ou vive voltando.",
    action: "Adicionar primeiro disco",
    icon: Disc3,
  },
  movies: {
    title: "Sua gaveta de filmes ainda não tem pôster.",
    text: "Comece por um filme recente, um favorito ou algo que você quer assistir depois.",
    action: "Adicionar primeiro filme",
    icon: Film,
  },
  series: {
    title: "Nenhuma série acompanhada ainda.",
    text: "Crie uma ficha para controlar temporada, episódio e status de acompanhamento.",
    action: "Adicionar primeira série",
    icon: Tv,
  },
};

export function CategoryView({
  view,
  items,
  statuses,
  filters,
  onFiltersChange,
  onAdd,
  onOpen,
}: {
  view: Category | "wishlist" | "progress";
  items: CulturalItem[];
  statuses: Record<Category, string[]>;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onAdd: (category: Category) => void;
  onOpen: (item: CulturalItem) => void;
}) {
  const virtual = view === "wishlist" || view === "progress";
  const baseItems = items.filter((item) => {
    if (view === "wishlist") return isWishlist(item);
    if (view === "progress") return isInProgress(item);
    return item.category === view;
  });

  const category = virtual ? undefined : view;
  const title = view === "wishlist" ? "Wishlist" : view === "progress" ? "Em andamento" : categoryLabels[view];
  const genres = [...new Set(baseItems.flatMap(getGenres))].sort();
  const years = [...new Set(baseItems.map(getYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const statusOptions = category
    ? statuses[category]
    : [...new Set(baseItems.map((item) => item.status))].sort();

  const sortOptions = category === "games"
    ? [
      ["recent", "Mais recentes"],
      ["playedHoursDesc", "Mais horas jogadas"],
      ["playedHoursAsc", "Menos horas jogadas"],
      ["ratingDesc", "Maior nota"],
      ["yearDesc", "Ano mais recente"],
      ["titleAsc", "Título A-Z"],
    ] as Array<[SortMode, string]>
    : [
      ["recent", "Mais recentes"],
      ["ratingDesc", "Maior nota"],
      ["yearDesc", "Ano mais recente"],
      ["titleAsc", "Título A-Z"],
    ] as Array<[SortMode, string]>;

  const filtered = baseItems.filter((item) => {
    const search = filters.search.toLowerCase();
    const matchesSearch = !search || getTitle(item).toLowerCase().includes(search) || item.tags.some((tag) => tag.toLowerCase().includes(search));
    const matchesYear = !filters.year || String(getYear(item) ?? "") === filters.year;
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesGenre = !filters.genre || getGenres(item).includes(filters.genre);
    const matchesRating = !filters.minRating || getRating(item) >= Number(filters.minRating);
    const matchesVisibility = !filters.visibility
      || (filters.visibility === "private" ? !isVisibleToFriends(item) : isVisibleToFriends(item));
    return matchesSearch && matchesYear && matchesStatus && matchesGenre && matchesRating && matchesVisibility;
  }).sort((a, b) => sortItems(a, b, filters.sort));

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Gaveta</p>
          <h1>{title}</h1>
          <p>{filtered.length} de {baseItems.length} itens visíveis</p>
        </div>
        {category ? (
          <button className="primary" onClick={() => onAdd(category)}>
            <Plus size={18} />
            Adicionar
          </button>
        ) : null}
      </section>

      <section className="filters">
        <label className="search-field">
          <Search size={16} />
          <input value={filters.search} onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })} placeholder="Buscar por nome ou tag" />
        </label>
        <select value={filters.year} onChange={(event) => onFiltersChange({ ...filters, year: event.target.value })}>
          <option value="">Ano</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
        <select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}>
          <option value="">Status</option>
          {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={filters.genre} onChange={(event) => onFiltersChange({ ...filters, genre: event.target.value })}>
          <option value="">Gênero</option>
          {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
        </select>
        <select value={filters.minRating} onChange={(event) => onFiltersChange({ ...filters, minRating: event.target.value })}>
          <option value="">Nota mínima</option>
          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => <option key={rating} value={rating}>{rating}+</option>)}
        </select>
        <select value={filters.visibility} onChange={(event) => onFiltersChange({ ...filters, visibility: event.target.value })}>
          <option value="">Visibilidade</option>
          <option value="private">Privado</option>
          <option value="friends">Amigos</option>
        </select>
        <select value={filters.sort} onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value as SortMode })}>
          <option value="">Ordenar</option>
          {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="ghost" onClick={() => onFiltersChange(emptyFilters)}>Limpar</button>
      </section>

      <section className="card-grid">
        {filtered.length ? filtered.map((item) => <ItemCard key={item.id} item={item} onOpen={() => onOpen(item)} />) : (
          <EmptyCollectionState
            view={view}
            hasBaseItems={baseItems.length > 0}
            onAdd={onAdd}
            onClearFilters={() => onFiltersChange(emptyFilters)}
          />
        )}
      </section>
    </main>
  );
}

function EmptyCollectionState({
  view,
  hasBaseItems,
  onAdd,
  onClearFilters,
}: {
  view: Category | "wishlist" | "progress";
  hasBaseItems: boolean;
  onAdd: (category: Category) => void;
  onClearFilters: () => void;
}) {
  if (hasBaseItems) {
    return (
      <article className="empty-state-card">
        <span className="empty-state-icon"><Search size={22} /></span>
        <div>
          <h2>Nenhuma ficha apareceu com esses filtros.</h2>
          <p>Afrouxe a busca para reencontrar o que já está arquivado nesta gaveta.</p>
        </div>
        <button type="button" className="ghost" onClick={onClearFilters}>Limpar filtros</button>
      </article>
    );
  }

  if (view === "wishlist") {
    return (
      <article className="empty-state-card">
        <span className="empty-state-icon"><Library size={22} /></span>
        <div>
          <h2>Sua wishlist ainda está vazia.</h2>
          <p>Crie uma ficha em qualquer gaveta usando um status de desejo: quero jogar, quero ler, quero ouvir ou quero assistir.</p>
        </div>
        <div className="empty-state-actions">
          <button type="button" className="primary" onClick={() => onAdd("games")}><Plus size={16} /> Criar wishlist</button>
          <button type="button" className="ghost" onClick={() => onAdd("books")}>Buscar livro</button>
        </div>
      </article>
    );
  }

  if (view === "progress") {
    return (
      <article className="empty-state-card">
        <span className="empty-state-icon"><ListChecks size={22} /></span>
        <div>
          <h2>Nenhuma ficha aberta agora.</h2>
          <p>Quando algo estiver em consumo, ele aparece aqui como uma pilha de fichas na mesa.</p>
        </div>
        <div className="empty-state-actions">
          <button type="button" className="primary" onClick={() => onAdd("games")}><Plus size={16} /> Começar por jogo</button>
          <button type="button" className="ghost" onClick={() => onAdd("series")}>Adicionar série</button>
        </div>
      </article>
    );
  }

  const state = emptyStateByCategory[view];
  const Icon = state.icon;
  return (
    <article className="empty-state-card">
      <span className="empty-state-icon"><Icon size={22} /></span>
      <div>
        <h2>{state.title}</h2>
        <p>{state.text}</p>
      </div>
      <button type="button" className="primary" onClick={() => onAdd(view)}>
        <Sparkles size={16} />
        {state.action}
      </button>
    </article>
  );
}

function sortItems(a: CulturalItem, b: CulturalItem, sort: SortMode) {
  if (sort === "playedHoursDesc") return getPlayedHours(b) - getPlayedHours(a) || getTitle(a).localeCompare(getTitle(b));
  if (sort === "playedHoursAsc") return getPlayedHours(a) - getPlayedHours(b) || getTitle(a).localeCompare(getTitle(b));
  if (sort === "ratingDesc") return getRating(b) - getRating(a) || getTitle(a).localeCompare(getTitle(b));
  if (sort === "yearDesc") return Number(getYear(b) ?? 0) - Number(getYear(a) ?? 0) || getTitle(a).localeCompare(getTitle(b));
  if (sort === "titleAsc") return getTitle(a).localeCompare(getTitle(b));
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export { emptyFilters };
