import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { CulturalItem } from "../types";
import { getTitle } from "../utils/itemHelpers";

export function CoverViewer({ item, onClose }: { item: CulturalItem; onClose: () => void }) {
  const title = getTitle(item);
  if (!item.coverUrl) return null;

  return createPortal(
    <div className="modal-backdrop cover-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Capa de ${title}`} onClick={onClose}>
      <article className="cover-viewer-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="cover-viewer-close" onClick={onClose} aria-label="Fechar capa">
          <X size={20} />
        </button>
        <img src={item.coverUrl} alt={`Capa de ${title}`} />
      </article>
    </div>,
    document.body,
  );
}
