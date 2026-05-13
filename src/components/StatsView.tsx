import { BarChart3 } from "lucide-react";
import { CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { buildStats } from "../utils/stats";
import { getTitle } from "../utils/itemHelpers";
import { Stars } from "./Rating";

export function StatsView({ items }: { items: CulturalItem[] }) {
  const stats = buildStats(items);
  const averageEntries = Object.entries(stats.averages);

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
        <Panel title="Generos mais consumidos" data={stats.genres} />
        <Panel title="Tags mais usadas" data={stats.tags} />
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
