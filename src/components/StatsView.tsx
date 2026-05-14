import { BarChart3 } from "lucide-react";
import { Category, CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { getGenres, getRating, getTitle, isCompleted, isInProgress, isWishlist } from "../utils/itemHelpers";
import { Stars } from "./Rating";

const categories = Object.keys(categoryLabels) as Category[];

export function StatsView({ items }: { items: CulturalItem[] }) {
  const stats = buildStats(items);
  const averageEntries = Object.entries(stats.averages);
  const categoryStats = categories.map((category) => buildCategoryStats(category, items));

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Leituras da gaveteira</p>
          <h1>Estatisticas</h1>
          <p>Um retrato rapido do que voce concluiu, largou, favoritou e acumulou para depois.</p>
        </div>
        <BarChart3 size={36} />
      </section>

      <section className="quick-stats">
        <Stat label="Jogos zerados" value={stats.headline.gamesCompleted} />
        <Stat label="Jogos abandonados" value={stats.headline.gamesAbandoned} />
        <Stat label="Livros lidos" value={stats.headline.booksRead} />
        <Stat label="Albuns ouvidos" value={stats.headline.albumsHeard} />
        <Stat label="Filmes assistidos" value={stats.headline.moviesWatched} />
        <Stat label="Series acompanhadas" value={stats.headline.seriesTracked} />
        <Stat label="Em andamento" value={stats.inProgress.length} />
        <Stat label="Wishlist" value={stats.wishlist.length} />
      </section>

      <section className="stats-layout">
        <Panel title="Concluidos por ano" data={stats.completedByYear} />
        <Panel title="Concluidos por mes" data={stats.completedByMonth} />
        <Panel title="Tags mais usadas" data={stats.tags} />
      </section>

      <section className="section">
        <h2>Generos mais consumidos por categoria</h2>
        <div className="category-breakdown-grid">
          {categoryStats.map((entry) => (
            <section key={entry.category} className="category-breakdown-panel">
              <h3>{categoryLabels[entry.category]}</h3>
              {entry.genres.length ? entry.genres.map(([label, value]) => (
                <div className="bar-row" key={label}>
                  <span>{label}</span>
                  <div><i style={{ width: `${Math.max(12, value * 18)}%` }} /></div>
                  <strong>{value}</strong>
                </div>
              )) : <p className="empty">Sem generos ainda.</p>}
            </section>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Por categoria</h2>
        <div className="category-stats-grid">
          {categoryStats.map((entry) => (
            <article key={entry.category} className={`category-stat-card drawer-${entry.category}`}>
              <header>
                <div>
                  <small>Gaveta</small>
                  <h3>{categoryLabels[entry.category]}</h3>
                </div>
                <strong>{entry.total}</strong>
              </header>
              <div className="category-stat-metrics">
                <span><b>{entry.completed}</b> concluidos</span>
                <span><b>{entry.inProgress}</b> em andamento</span>
                <span><b>{entry.wishlist}</b> na wishlist</span>
                <span><b>{entry.abandoned}</b> abandonados</span>
              </div>
              <div className="category-stat-detail">
                <span>Media</span>
                <strong>{entry.average ? entry.average.toFixed(1) : "--"}</strong>
              </div>
              <MiniList title="Generos" entries={entry.genres} />
              <MiniList title="Tags" entries={entry.tags} />
              <div className="category-favorites">
                <span>Melhores avaliados</span>
                {entry.favorites.length ? entry.favorites.map((item) => (
                  <div key={item.id}>
                    <small>{getTitle(item)}</small>
                    <Stars value={item.rating} />
                  </div>
                )) : <small>Sem notas ainda.</small>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Media de notas por categoria</h2>
        <div className="meter-list">
          {averageEntries.map(([category, average]) => (
            <div className="meter" key={category}>
              <span>{categoryLabels[category as keyof typeof categoryLabels]}</span>
              <div><i style={{ width: `${Math.min(100, (Number(average) / 5) * 100)}%` }} /></div>
              <strong>{Number(average).toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Favoritos e melhores avaliados</h2>
        <div className="ranking">
          {stats.favorites.map((item, index) => (
            <div key={item.id} className="rank-row">
              <strong>{index + 1}</strong>
              <span>{getTitle(item)}</span>
              <Stars value={item.rating} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="metric"><strong>{value}</strong><span>{label}</span></div>;
}

function Panel({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <section className="stat-panel">
      <h2>{title}</h2>
      {entries.length ? entries.map(([label, value]) => (
        <div className="bar-row" key={label}>
          <span>{label}</span>
          <div><i style={{ width: `${Math.max(12, value * 18)}%` }} /></div>
          <strong>{value}</strong>
        </div>
      )) : <p className="empty">Sem dados ainda.</p>}
    </section>
  );
}

function MiniList({ title, entries }: { title: string; entries: Array<[string, number]> }) {
  return (
    <div className="category-mini-list">
      <span>{title}</span>
      {entries.length ? entries.map(([label, value]) => (
        <small key={label}>{label} <b>{value}</b></small>
      )) : <small>Sem dados.</small>}
    </div>
  );
}

function buildCategoryStats(category: Category, items: CulturalItem[]) {
  const categoryItems = items.filter((item) => item.category === category);
  const ratings: number[] = categoryItems.map(getRating).filter((rating) => rating > 0);
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;

  return {
    category,
    total: categoryItems.length,
    completed: categoryItems.filter(isCompleted).length,
    inProgress: categoryItems.filter(isInProgress).length,
    wishlist: categoryItems.filter(isWishlist).length,
    abandoned: categoryItems.filter((item) => item.status.toLowerCase().includes("abandon")).length,
    average,
    genres: topEntries(categoryItems.flatMap(getGenres)),
    tags: topEntries(categoryItems.flatMap((item) => item.tags)),
    favorites: [...categoryItems].filter((item) => getRating(item) > 0).sort((a, b) => getRating(b) - getRating(a)).slice(0, 3),
  };
}

function topEntries(values: string[]) {
  const counts = values.filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
}
