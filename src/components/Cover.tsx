import { CulturalItem } from "../types";
import { getTitle } from "../utils/itemHelpers";

export function Cover({
  item,
  compact = false,
  onViewCover,
}: {
  item: CulturalItem;
  compact?: boolean;
  onViewCover?: () => void;
}) {
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
      {item.coverUrl && onViewCover ? (
        <button
          type="button"
          className="cover-view-button"
          onClick={(event) => {
            event.stopPropagation();
            onViewCover();
          }}
        >
          Ver capa
        </button>
      ) : null}
    </div>
  );
}
