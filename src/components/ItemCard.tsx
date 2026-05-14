import { CulturalItem } from "../types";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getGenre, getTitle, getYear } from "../utils/itemHelpers";

export function ItemCard({ item, onOpen }: { item: CulturalItem; onOpen: () => void }) {
  const gameTime = item.category === "games" ? item.timePlayed?.trim() || "--:--" : "";

  return (
    <button className="item-card" onClick={onOpen}>
      <Cover item={item} />
      <div className="item-card-body">
        <div className="item-card-kicker">
          <span>{item.status}</span>
          {getYear(item) ? <span>{getYear(item)}</span> : null}
        </div>
        <h3>{getTitle(item)}</h3>
        <p>{getGenre(item) || "Sem genero"}</p>
        {item.category === "games" ? <p className="item-card-playtime">Tempo jogado: {gameTime}</p> : null}
        <Stars value={item.rating} />
        <div className="tag-row">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </button>
  );
}
