import { CulturalItem } from "../types";
import { getTitle } from "../utils/itemHelpers";

export function Cover({ item, compact = false }: { item: CulturalItem; compact?: boolean }) {
  const title = getTitle(item);
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`cover cover-${item.category} ${compact ? "cover-compact" : ""}`}>
      {item.coverUrl ? <img src={item.coverUrl} alt={`Capa de ${title}`} /> : <span>{initials}</span>}
    </div>
  );
}
