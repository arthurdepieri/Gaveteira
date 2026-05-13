import { Archive, BookOpen, Disc3, Film, Gamepad2, Library, ListChecks, Tv } from "lucide-react";
import type { ElementType } from "react";
import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getTitle } from "../utils/itemHelpers";

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
}: {
  items: CulturalItem[];
  onOpenCategory: (category: Category | "wishlist" | "progress") => void;
  onOpenItem: (item: CulturalItem) => void;
}) {
  const stats = buildStats(items);

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
