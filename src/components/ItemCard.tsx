import { CulturalItem } from "../types";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getGenre, getTitle, getYear } from "../utils/itemHelpers";

export function ItemCard({ item, onOpen }: { item: CulturalItem; onOpen: () => void }) {
  const gameTime = item.category === "games" ? item.timePlayed?.trim() || "--:--" : "";
  const progress = getProgressLabel(item);

  return (
    <button className="item-card" onClick={onOpen}>
      <Cover item={item} />
      <div className="item-card-body">
        <div className="item-card-main">
          <div className="item-card-kicker">
            <span>{item.status}</span>
            {getYear(item) ? <span>{getYear(item)}</span> : null}
          </div>
          <h3>{getTitle(item)}</h3>
          <p>{getGenre(item) || "Sem genero"}</p>
          {item.category === "games" ? <p className="item-card-playtime">Tempo jogado: {gameTime}</p> : null}
          <div className="tag-row">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="item-card-meta">
          <Stars value={item.rating} />
          {progress ? <small>{progress}</small> : null}
        </div>
      </div>
    </button>
  );
}

function getProgressLabel(item: CulturalItem) {
  if (item.category === "games") return item.timePlayed?.trim() || "--:--";
  if (item.category === "books") return item.currentPage ? `pag. ${item.currentPage}` : "";
  if (item.category === "series") {
    const season = item.currentSeason ? `T${item.currentSeason}` : "";
    const episode = item.currentEpisode ? `E${item.currentEpisode}` : "";
    return [season, episode].filter(Boolean).join(" ");
  }
  if (item.category === "albums") return item.listenCount ? `${item.listenCount}x` : "";
  if (item.category === "movies") return item.runtimeMinutes ? `${item.runtimeMinutes} min` : "";
  return "";
}
