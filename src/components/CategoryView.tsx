import { Plus, Search } from "lucide-react";
import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { getGenres, getRating, getTitle, getYear, isInProgress, isWishlist } from "../utils/itemHelpers";
import { ItemCard } from "./ItemCard";

export interface Filters {
  search: string;
  year: string;
  status: string;
  genre: string;
  minRating: string;
}

const emptyFilters: Filters = { search: "", year: "", status: "", genre: "", minRating: "", };

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

  const filtered = baseItems.filter((item) => {
    const search = filters.search.toLowerCase();
    const matchesSearch = !search || getTitle(item).toLowerCase().includes(search) || item.tags.some((tag) => tag.toLowerCase().includes(search));
    const matchesYear = !filters.year || String(getYear(item) ?? "") === filters.year;
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesGenre = !filters.genre || getGenres(item).includes(filters.genre);
    const matchesRating = !filters.minRating || getRating(item) >= Number(filters.minRating);
    return matchesSearch && matchesYear && matchesStatus && matchesGenre && matchesRating;
  });

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Gaveta</p>
          <h1>{title}</h1>
          <p>{filtered.length} de {baseItems.length} itens visiveis</p>
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
          <option value="">Genero</option>
          {genres.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
        </select>
        <select value={filters.minRating} onChange={(event) => onFiltersChange({ ...filters, minRating: event.target.value })}>
          <option value="">Nota minima</option>
          {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => <option key={rating} value={rating}>{rating}+</option>)}
        </select>
        <button className="ghost" onClick={() => onFiltersChange(emptyFilters)}>Limpar</button>
      </section>

      <section className="card-grid">
        {filtered.length ? filtered.map((item) => <ItemCard key={item.id} item={item} onOpen={() => onOpen(item)} />) : <p className="empty">Nenhuma ficha encontrou essa combinacao.</p>}
      </section>
    </main>
  );
}

export { emptyFilters };
