import { Download, X } from "lucide-react";
import { createPortal } from "react-dom";
import { CulturalItem } from "../types";
import { getTitle } from "../utils/itemHelpers";

export function CoverViewer({ item, onClose }: { item: CulturalItem; onClose: () => void }) {
  const title = getTitle(item);
  if (!item.coverUrl) return null;

  return createPortal(
    <div className="modal-backdrop cover-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Capa de ${title}`} onClick={onClose}>
      <article className="cover-viewer-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">Capa</p>
            <h2>{title}</h2>
          </div>
          <div className="modal-actions">
            <a className="ghost compact cover-viewer-download" href={item.coverUrl} target="_blank" rel="noreferrer">
              <Download size={16} />
              Abrir imagem
            </a>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar capa">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="cover-viewer-frame">
          <img src={item.coverUrl} alt={`Capa de ${title}`} />
        </div>
      </article>
    </div>,
    document.body,
  );
}
