import { CulturalItem } from "../types";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { getSeasonalThemeClassName, getSeasonalThemeId } from "../data/seasonalThemes";
import { getGenre, getItemVisibility, getItemVisibilityLabel, getTitle, getYear } from "../utils/itemHelpers";

export function ItemCard({ item, onOpen }: { item: CulturalItem; onOpen: () => void }) {
  const gameTime = item.category === "games" ? item.timePlayed?.trim() || "--:--" : "";
  const progress = getProgressLabel(item);
  const diaryBadges = getDiaryBadges(item);
  const visibility = getItemVisibility(item);

  return (
    <button className={getSeasonalThemeClassName(item, "item-card")} data-season-theme={getSeasonalThemeId(item)} onClick={onOpen}>
      <Cover item={item} />
      <div className="item-card-body">
        <div className="item-card-main">
          <div className="item-card-kicker">
            <span>{item.status}</span>
            {getYear(item) ? <span>{getYear(item)}</span> : null}
          </div>
          <span className={`visibility-pill visibility-${visibility}`}>
            {getItemVisibilityLabel(item)}
          </span>
          <h3>{getTitle(item)}</h3>
          <p>{getGenre(item) || "Gênero não arquivado"}</p>
          {item.category === "games" ? <p className="item-card-playtime">Tempo jogado: {gameTime}</p> : null}
          <div className={`diary-marker-row${diaryBadges.length ? "" : " is-empty"}`} aria-hidden={!diaryBadges.length}>
            {diaryBadges.map((badge) => <span key={badge}>{badge}</span>)}
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

function getDiaryBadges(item: CulturalItem) {
  const entries = item.diary.filter((entry) => entry.text.trim());
  if (!entries.length) return [];

  const latest = entries
    .slice()
    .sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime())[0];
  const typeBadges = [...new Set(entries.map((entry) => entry.type ?? "Impressão"))]
    .slice(0, 3)
    .map((type) => `possui ${type.toLowerCase()}`);

  return [
    `${entries.length} ${entries.length === 1 ? "nota" : "notas"}`,
    latest?.date ? `última impressão: ${formatShortDate(latest.date)}` : "",
    ...typeBadges,
  ].filter(Boolean);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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
