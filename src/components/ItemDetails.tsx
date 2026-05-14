import { Edit3, ExternalLink, X } from "lucide-react";
import { CulturalItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { getTitle, getYear } from "../utils/itemHelpers";
import { Cover } from "./Cover";
import { Stars } from "./Rating";

export function ItemDetails({
  item,
  ownerName,
  onEdit,
  onClose,
}: {
  item: CulturalItem;
  ownerName?: string;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const sections = detailSections(item);
  const year = getYear(item);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <article className="modal detail-modal archive-sheet">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{categoryLabels[item.category]}{ownerName ? ` / ${ownerName}` : ""}</p>
            <h2>{getTitle(item)}</h2>
          </div>
          <div className="modal-actions">
            {onEdit ? (
              <button type="button" className="ghost compact" onClick={onEdit}>
                <Edit3 size={16} />
                Editar
              </button>
            ) : null}
            <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        </header>

        <section className="detail-hero">
          <Cover item={item} />
          <div className="detail-identity">
            <span className="archive-stamp">{item.status}</span>
            <h1>{getTitle(item)}</h1>
            <div className="detail-summary">
              {year ? <span>{year}</span> : null}
              {item.genre ? <span>{item.genre}</span> : null}
              {ownerName ? <span>{ownerName}</span> : null}
            </div>
            <div className="detail-rating-line">
              <Stars value={item.rating} />
              <strong>{item.rating ? `${item.rating}/5` : "Sem nota"}</strong>
            </div>
            {item.tags.length ? (
              <div className="tag-row">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            ) : null}
            {item.links.length ? (
              <div className="detail-links">
                {item.links.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="detail-section-grid">
          {sections.map((section) => (
            <section key={section.title} className="archive-block">
              <h3>{section.title}</h3>
              {section.fields.length ? (
                <div className="detail-grid">
                  {section.fields.map(([label, value]) => (
                    <div key={label} className="detail-field">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="empty">Sem dados registrados.</p>}
            </section>
          ))}
        </section>

        <section className="archive-block">
          <h3>Historico</h3>
          {item.timeline.length ? (
            <div className="timeline-list">
              {item.timeline.map((event) => (
                <div className="timeline-entry" key={event.id}>
                  <span>{event.date || "Sem data"}</span>
                  <strong>{event.type}</strong>
                  {event.note ? <p>{event.note}</p> : null}
                </div>
              ))}
            </div>
          ) : <p className="empty">Nenhum evento registrado ainda.</p>}
        </section>

        <section className="archive-block">
          <h3>Diario</h3>
          {item.diary.length ? (
            <div className="diary-note-grid">
              {item.diary.map((entry) => (
                <article key={entry.id} className="diary-note-card">
                  <strong>{entry.date || "Sem data"}</strong>
                  <p>{entry.text}</p>
                </article>
              ))}
            </div>
          ) : <p className="empty">Nenhuma entrada de diario ainda.</p>}
        </section>
      </article>
    </div>
  );
}

function detailSections(item: CulturalItem): Array<{ title: string; fields: Array<[string, string]> }> {
  if (item.category === "games") {
    return [
      { title: "Ficha tecnica", fields: visibleFields([["Plataforma", item.platform], ["Desenvolvedora", item.developer], ["Publicadora", item.publisher], ["Ano de lancamento", item.releaseYear], ["Genero", item.genre]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Inicio", item.startDate], ["Conclusao/abandono", item.endDate], ["Tempo jogado", item.timePlayed], ["Conclusao", item.completionType]]) },
      { title: "Avaliacao", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""], ["Dificuldade percebida", item.perceivedDifficulty]]) },
      { title: "Notas pessoais", fields: visibleFields([["Comentarios/anotacoes", item.notes], ["Motivo de abandono", item.abandonmentReason]]) },
    ];
  }

  if (item.category === "books") {
    return [
      { title: "Ficha tecnica", fields: visibleFields([["Autor", item.author], ["Editora", item.publisher], ["Ano de publicacao", item.publicationYear], ["Genero", item.genre], ["Formato", item.format], ["Paginas", item.pages]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Inicio", item.startDate], ["Conclusao/abandono", item.endDate], ["Pagina atual", item.currentPage]]) },
      { title: "Avaliacao", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""], ["Opiniao final", item.finalOpinion]]) },
      { title: "Notas pessoais", fields: visibleFields([["Frases favoritas", item.favoriteQuotes], ["Resumo pessoal", item.personalSummary], ["Motivo de abandono", item.abandonmentReason]]) },
    ];
  }

  if (item.category === "albums") {
    return [
      { title: "Ficha tecnica", fields: visibleFields([["Artista", item.artist], ["Ano de lancamento", item.releaseYear], ["Genero", item.genre]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Data em que ouvi", item.listenedDate], ["Vezes ouvido", item.listenCount], ["Escuta", item.listenMode]]) },
      { title: "Avaliacao", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""], ["Musicas favoritas", item.favoriteTracks], ["Musicas puladas", item.skippedTracks]]) },
      { title: "Notas pessoais", fields: visibleFields([["Comentarios", item.comments]]) },
    ];
  }

  if (item.category === "movies") {
    return [
      { title: "Ficha tecnica", fields: visibleFields([["Ano", item.year], ["Genero", item.genre], ["Direcao", item.director], ["Duracao", item.runtimeMinutes ? `${item.runtimeMinutes} min` : ""]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Inicio", item.startDate], ["Conclusao", item.endDate]]) },
      { title: "Avaliacao", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""]]) },
      { title: "Notas pessoais", fields: visibleFields([["Comentarios", item.comments]]) },
    ];
  }

  return [
    { title: "Ficha tecnica", fields: visibleFields([["Ano", item.year], ["Genero", item.genre]]) },
    { title: "Progresso", fields: visibleFields([["Status", item.status], ["Inicio", item.startDate], ["Conclusao", item.endDate], ["Temporada atual", item.currentSeason], ["Episodio atual", item.currentEpisode], ["Acompanhamento", item.trackingStatus]]) },
    { title: "Avaliacao", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""]]) },
    { title: "Notas pessoais", fields: visibleFields([["Comentarios", item.comments]]) },
  ];
}

function visibleFields(fields: Array<[string, unknown]>): Array<[string, string]> {
  return fields
    .map(([label, value]) => [label, value === undefined || value === null ? "" : String(value)] as [string, string])
    .filter(([, value]) => value.trim());
}
