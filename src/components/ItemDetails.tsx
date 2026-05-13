import { X } from "lucide-react";
import { CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { getTitle, getYear } from "../utils/itemHelpers";
import { Cover } from "./Cover";
import { Stars } from "./Rating";

export function ItemDetails({
  item,
  ownerName,
  onClose,
}: {
  item: CulturalItem;
  ownerName?: string;
  onClose: () => void;
}) {
  const fields = detailFields(item);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <article className="modal detail-modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{categoryLabels[item.category]}{ownerName ? ` / ${ownerName}` : ""}</p>
            <h2>{getTitle(item)}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <section className="detail-hero">
          <Cover item={item} />
          <div>
            <div className="detail-summary">
              <span>{item.status}</span>
              {getYear(item) ? <span>{getYear(item)}</span> : null}
              {item.genre ? <span>{item.genre}</span> : null}
            </div>
            <Stars value={item.rating} />
            {item.tags.length ? (
              <div className="tag-row">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            ) : null}
          </div>
        </section>

        <section className="detail-grid">
          {fields.map(([label, value]) => (
            <div key={label} className="detail-field">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        {item.links.length ? (
          <section className="form-section">
            <h3>Links</h3>
            <div className="detail-links">
              {item.links.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noreferrer">{link.label || link.url}</a>
              ))}
            </div>
          </section>
        ) : null}

        {item.timeline.length ? (
          <section className="form-section">
            <h3>Historico</h3>
            <div className="detail-list">
              {item.timeline.map((event) => (
                <div key={event.id}>
                  <strong>{event.date} / {event.type}</strong>
                  {event.note ? <p>{event.note}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {item.diary.length ? (
          <section className="form-section">
            <h3>Diario</h3>
            <div className="detail-list">
              {item.diary.map((entry) => (
                <div key={entry.id}>
                  <strong>{entry.date}</strong>
                  <p>{entry.text}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </div>
  );
}

function detailFields(item: CulturalItem): Array<[string, string]> {
  const common: Array<[string, unknown]> = [["Status", item.status], ["Nota", item.rating ? `${item.rating}/5` : ""]];

  if (item.category === "games") {
    return visibleFields([
      ...common,
      ["Plataforma", item.platform],
      ["Inicio", item.startDate],
      ["Conclusao/abandono", item.endDate],
      ["Tempo jogado", item.timePlayed],
      ["Desenvolvedora", item.developer],
      ["Publicadora", item.publisher],
      ["Ano", item.releaseYear],
      ["Genero", item.genre],
      ["Dificuldade", item.perceivedDifficulty],
      ["Conclusao", item.completionType],
      ["Motivo de abandono", item.abandonmentReason],
      ["Comentarios", item.notes],
    ]);
  }

  if (item.category === "books") {
    return visibleFields([
      ...common,
      ["Autor", item.author],
      ["Inicio", item.startDate],
      ["Conclusao/abandono", item.endDate],
      ["Paginas", item.pages],
      ["Pagina atual", item.currentPage],
      ["Formato", item.format],
      ["Genero", item.genre],
      ["Editora", item.publisher],
      ["Ano", item.publicationYear],
      ["Frases favoritas", item.favoriteQuotes],
      ["Resumo pessoal", item.personalSummary],
      ["Opiniao final", item.finalOpinion],
      ["Motivo de abandono", item.abandonmentReason],
    ]);
  }

  if (item.category === "albums") {
    return visibleFields([
      ...common,
      ["Artista", item.artist],
      ["Ano", item.releaseYear],
      ["Genero", item.genre],
      ["Data em que ouvi", item.listenedDate],
      ["Musicas favoritas", item.favoriteTracks],
      ["Musicas puladas", item.skippedTracks],
      ["Vezes ouvido", item.listenCount],
      ["Escuta", item.listenMode],
      ["Comentarios", item.comments],
    ]);
  }

  if (item.category === "movies") {
    return visibleFields([
      ...common,
      ["Ano", item.year],
      ["Genero", item.genre],
      ["Inicio", item.startDate],
      ["Conclusao", item.endDate],
      ["Direcao", item.director],
      ["Duracao", item.runtimeMinutes ? `${item.runtimeMinutes} min` : ""],
      ["Comentarios", item.comments],
    ]);
  }

  return visibleFields([
    ...common,
    ["Ano", item.year],
    ["Genero", item.genre],
    ["Inicio", item.startDate],
    ["Conclusao", item.endDate],
    ["Temporada atual", item.currentSeason],
    ["Episodio atual", item.currentEpisode],
    ["Acompanhamento", item.trackingStatus],
    ["Comentarios", item.comments],
  ]);
}

function visibleFields(fields: Array<[string, unknown]>): Array<[string, string]> {
  return fields
    .map(([label, value]) => [label, value === undefined || value === null ? "" : String(value)] as [string, string])
    .filter(([, value]) => value.trim());
}
