import { BookOpenText, Edit3, ExternalLink, ImageIcon, Lock, Megaphone, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { AppSettings, CloudSession, CulturalItem, DiaryEntry, Rating, SocialVisibility } from "../types";
import { categoryLabels } from "../data/catalog";
import { getItemVisibility, getItemVisibilityLabel, getTitle, getYear, isCompleted, uid } from "../utils/itemHelpers";
import { MetadataResult, searchMetadata } from "../services/metadata";
import { uploadStoredImage } from "../services/storage";
import { Cover } from "./Cover";
import { Stars } from "./Rating";

const DIARY_VISIBILITY_KEY = "gaveteira-diary-default-visibility:v1";
const diaryTypes: NonNullable<DiaryEntry["type"]>[] = ["Impressão", "Citação", "Teoria", "Progresso", "Memória", "Revisita", "Opinião final"];
const diaryPrompts = [
  "O que te chamou atenção hoje?",
  "Você continuaria ou pausaria?",
  "Uma cena, frase ou música que ficou.",
  "O que mudou desde a última entrada?",
];

export function ItemDetails({
  item,
  ownerName,
  focusDiaryId,
  settings,
  cloudSession,
  statuses = [],
  onEdit,
  onUpdateItem,
  onDelete,
  onClose,
}: {
  item: CulturalItem;
  ownerName?: string;
  focusDiaryId?: string;
  settings?: AppSettings;
  cloudSession?: CloudSession;
  statuses?: string[];
  onEdit?: () => void;
  onUpdateItem?: (item: CulturalItem) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const sections = detailSections(item);
  const visibleSections = sections.filter((section) => section.fields.length);
  const year = getYear(item);
  const [activeMobileSection, setActiveMobileSection] = useState(focusDiaryId ? "Diário" : "Resumo");
  const [diaryOpen, setDiaryOpen] = useState(Boolean(focusDiaryId));
  const [coverSearchOpen, setCoverSearchOpen] = useState(false);
  const mobileSections = ["Resumo", ...visibleSections.map((section) => section.title), "Histórico", "Diário"];
  const canEditDiary = Boolean(onUpdateItem);
  const canChangeCover = Boolean(settings && onUpdateItem);
  const canQuickEdit = Boolean(onUpdateItem && !ownerName);
  const visibleDiary = ownerName && !canEditDiary
    ? item.diary.filter((entry) => entry.visibility === "friends")
    : item.diary;
  const timelineEntries = buildStoryTimeline(item, visibleDiary);
  const summaryFields = buildDetailSummaryFields(item, visibleDiary, timelineEntries);
  const finalSummary = buildFinalSummarySuggestion(item);
  const itemVisibility = getItemVisibility(item);

  function updateDiary(diary: DiaryEntry[]) {
    onUpdateItem?.({ ...item, diary, updatedAt: new Date().toISOString() } as CulturalItem);
  }

  function updateVisibility(visibility: SocialVisibility) {
    onUpdateItem?.({ ...item, visibility, updatedAt: new Date().toISOString() } as CulturalItem);
  }

  function updateStatus(status: string) {
    onUpdateItem?.({ ...item, status, updatedAt: new Date().toISOString() } as CulturalItem);
  }

  function updateRating(rating: Rating | undefined) {
    onUpdateItem?.({ ...item, rating, updatedAt: new Date().toISOString() } as CulturalItem);
  }

  function deleteFromDetails() {
    if (!onDelete) return;
    const title = getTitle(item);
    const confirmed = window.confirm(`Apagar "${title}" da sua Gaveteira?`);
    if (!confirmed) return;
    onDelete(item.id);
    onClose();
  }

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <article className="modal detail-modal archive-sheet">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{categoryLabels[item.category]}{ownerName ? ` / ${ownerName}` : ""}</p>
            <h2>{getTitle(item)}</h2>
          </div>
          <div className="modal-actions">
            {canEditDiary ? (
              <button type="button" className="ghost compact" onClick={() => setDiaryOpen((current) => !current)}>
                <BookOpenText size={16} />
                Diário
              </button>
            ) : null}
            {canChangeCover ? (
              <button type="button" className="ghost compact" onClick={() => setCoverSearchOpen((current) => !current)}>
                <ImageIcon size={16} />
                Trocar capa
              </button>
            ) : null}
            {canQuickEdit && onDelete ? (
              <button type="button" className="ghost compact danger-soft" onClick={deleteFromDetails}>
                <Trash2 size={16} />
                Apagar
              </button>
            ) : null}
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

        {diaryOpen ? <DiaryFocusPanel entries={item.diary} itemVisibility={itemVisibility} onChange={updateDiary} onClose={() => setDiaryOpen(false)} /> : null}
        {coverSearchOpen && settings ? (
          <CoverSearchPanel
            item={item}
            settings={settings}
            cloudSession={cloudSession}
            onApply={(result) => {
              if (!result.coverUrl) return;
              onUpdateItem?.({ ...item, coverUrl: result.coverUrl, updatedAt: new Date().toISOString() } as CulturalItem);
              setCoverSearchOpen(false);
            }}
            onClose={() => setCoverSearchOpen(false)}
          />
        ) : null}

        <section className="detail-hero">
          <Cover item={item} />
          <div className="detail-identity">
            <span className="archive-stamp">{item.status}</span>
            <h1>{getTitle(item)}</h1>
            <div className="detail-summary">
              {year ? <span>{year}</span> : null}
              {item.genre ? <span>{item.genre}</span> : null}
              {ownerName ? <span>{ownerName}</span> : null}
              <span className={`visibility-pill visibility-${itemVisibility}`}>
                {getItemVisibilityLabel(item)}
              </span>
            </div>
            <div className="detail-rating-line">
              <Stars value={item.rating} />
              <strong>{item.rating ? `${item.rating}/5` : "Sem nota arquivada"}</strong>
            </div>
            {canQuickEdit ? (
              <div className="detail-live-controls" aria-label="Edição rápida da ficha">
                <label>
                  <span>Status</span>
                  <select value={item.status} onChange={(event) => updateStatus(event.target.value)}>
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                <div>
                  <span>Nota</span>
                  <QuickStarRating value={item.rating as Rating | undefined} onChange={updateRating} />
                </div>
                {onDelete ? (
                  <button type="button" className="danger compact" onClick={deleteFromDetails}>
                    <Trash2 size={15} />
                    Apagar ficha
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="detail-quick-actions" aria-label="Atalhos da ficha">
              <button type="button" className="ghost compact" onClick={() => setActiveMobileSection("Histórico")}>
                Histórico
                <span>{timelineEntries.length}</span>
              </button>
              <button type="button" className="ghost compact" onClick={() => setActiveMobileSection("Diário")}>
                Diário
                <span>{visibleDiary.filter((entry) => entry.text.trim()).length}</span>
              </button>
              {canEditDiary ? (
                <button
                  type="button"
                  className="primary compact"
                  onClick={() => {
                    setActiveMobileSection("Diário");
                    setDiaryOpen(true);
                  }}
                >
                  <BookOpenText size={15} />
                  Escrever
                </button>
              ) : null}
            </div>
            {!ownerName ? (
              <div className={`privacy-note privacy-note-${itemVisibility}`}>
                <p>
                  {itemVisibility === "private"
                    ? "Esta ficha está privada e não aparece para amigos, no Feed ou nas comparações sociais."
                    : "Esta ficha está visível para amigos. Entradas privadas do diário continuam ocultas."}
                </p>
                {onUpdateItem ? (
                  <label className="detail-privacy-control">
                    <span>Privacidade da ficha</span>
                    <select value={itemVisibility === "private" ? "private" : "friends"} onChange={(event) => updateVisibility(event.target.value as SocialVisibility)}>
                      <option value="friends">Visível para amigos</option>
                      <option value="private">Privado</option>
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
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

        <nav className="detail-mobile-tabs" aria-label="Seções da ficha">
          {mobileSections.map((section) => (
            <button
              key={section}
              type="button"
              className={activeMobileSection === section ? "active" : ""}
              onClick={() => setActiveMobileSection(section)}
            >
              {section}
            </button>
          ))}
        </nav>

        <section className={`archive-block detail-summary-panel detail-mobile-panel ${activeMobileSection === "Resumo" ? "active" : ""}`}>
          <div className="archive-block-heading">
            <h3>Resumo</h3>
            <span>{categoryLabels[item.category]}</span>
          </div>
          <div className="detail-summary-grid">
            {summaryFields.map(([label, value]) => (
              <div key={label} className="detail-summary-tile">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section-grid">
          {visibleSections.map((section) => (
            <section key={section.title} className={`archive-block detail-mobile-panel ${activeMobileSection === section.title ? "active" : ""}`}>
              <h3>{section.title}</h3>
              <div className="detail-grid">
                {section.fields.map(([label, value]) => (
                  <div key={label} className="detail-field">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>

        <section className={`archive-block detail-mobile-panel ${activeMobileSection === "Histórico" ? "active" : ""}`}>
          <h3>Histórico</h3>
          {timelineEntries.length ? (
            <div className="timeline-list">
              {timelineEntries.map((event) => (
                <div className={`timeline-entry ${event.kind === "diary" ? "timeline-entry-diary" : ""}`} key={event.id}>
                  <span>{event.date || "Data não registrada"}</span>
                  <strong>{event.label}</strong>
                  {event.text ? <p>{event.text}</p> : null}
                </div>
              ))}
            </div>
          ) : <p className="empty">O histórico desta ficha ainda está em branco.</p>}
        </section>

        <section className={`archive-block detail-mobile-panel ${activeMobileSection === "Diário" ? "active" : ""}`}>
          <div className="archive-block-heading">
            <h3>Diário</h3>
            {canEditDiary ? (
              <button type="button" className="ghost compact" onClick={() => setDiaryOpen(true)}>
                <BookOpenText size={15} />
                Escrever
              </button>
            ) : null}
          </div>
          {visibleDiary.length ? (
            <div className="diary-note-grid">
              {visibleDiary.map((entry) => (
                <article key={entry.id} className={`diary-note-card diary-note-${entry.visibility === "friends" ? "friends" : "private"} ${focusDiaryId === entry.id ? "diary-note-highlight" : ""}`}>
                  <strong>{entry.date || "Data não registrada"}</strong>
                  <em>{entry.type ?? "Impressão"}</em>
                  <span className="diary-visibility-badge">
                    {entry.visibility === "friends" ? <Megaphone size={13} /> : <Lock size={13} />}
                    {entry.visibility === "friends" ? "Público" : "Privado"}
                  </span>
                  <p>{entry.text}</p>
                </article>
              ))}
            </div>
          ) : <p className="empty">{ownerName ? "Nenhuma página pública de diário por aqui." : "O diário desta ficha ainda está esperando a primeira nota."}</p>}
          {finalSummary && canEditDiary ? (
            <div className="diary-summary-assist">
              <strong>{finalSummary.title}</strong>
              <p>{finalSummary.text}</p>
              <button type="button" className="ghost compact" onClick={() => onUpdateItem?.(applyFinalSummary(item, finalSummary.summary))}>Transformar em opinião final</button>
            </div>
          ) : null}
        </section>
      </article>
    </div>,
    document.body,
  );
}

function DiaryFocusPanel({
  entries,
  itemVisibility,
  onChange,
  onClose,
}: {
  entries: DiaryEntry[];
  itemVisibility: ReturnType<typeof getItemVisibility>;
  onChange: (entries: DiaryEntry[]) => void;
  onClose: () => void;
}) {
  const [defaultVisibility, setDefaultVisibility] = useState<DiaryEntry["visibility"]>(() => loadDiaryVisibility());
  const update = (id: string, patch: Partial<DiaryEntry>) => {
    if (patch.visibility) {
      localStorage.setItem(DIARY_VISIBILITY_KEY, patch.visibility);
      setDefaultVisibility(patch.visibility);
    }
    onChange(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };

  function addEntry() {
    onChange([
      {
        id: uid("diary"),
        date: new Date().toISOString().slice(0, 10),
        text: "",
        visibility: defaultVisibility,
        type: "Impressão",
      },
      ...entries,
    ]);
  }

  return (
    <section className="diary-focus-panel">
      <div className="section-heading split">
        <div className="section-heading">
          <BookOpenText size={20} />
          <h3>Diário do item</h3>
        </div>
        <button type="button" className="ghost compact" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p className="diary-focus-note">
        {itemVisibility === "private"
          ? "Esta ficha está privada. Mesmo uma entrada marcada como visível para amigos só aparecerá quando a ficha também estiver visível."
          : "Entradas visíveis para amigos aparecem no Feed. Entradas privadas ficam guardadas só nesta ficha. Ao mudar a privacidade, as próximas entradas seguem essa escolha."}
      </p>
      <div className="diary-prompt-row" aria-label="Sugestões de escrita">
        {diaryPrompts.map((prompt) => <span key={prompt}>{prompt}</span>)}
      </div>
      <div className="diary-focus-list">
        {entries.map((entry) => (
          <article key={entry.id} className="diary-focus-entry">
            <div className="diary-focus-meta">
              <input type="date" value={entry.date} onChange={(event) => update(entry.id, { date: event.target.value })} />
              <select value={entry.type ?? "Impressão"} onChange={(event) => update(entry.id, { type: event.target.value as DiaryEntry["type"] })}>
                {diaryTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
              <select value={entry.visibility ?? "private"} onChange={(event) => update(entry.id, { visibility: event.target.value as DiaryEntry["visibility"] })}>
                <option value="private">Privado</option>
                <option value="friends">Visível para amigos</option>
              </select>
              <button type="button" className="icon-button" onClick={() => onChange(entries.filter((item) => item.id !== entry.id))} aria-label="Remover entrada">
                <X size={16} />
              </button>
            </div>
            <textarea value={entry.text} onChange={(event) => update(entry.id, { text: event.target.value })} placeholder={diaryPrompts[0]} />
          </article>
        ))}
        {!entries.length ? <p className="empty">Abra a primeira página para guardar uma impressão, citação ou memória.</p> : null}
      </div>
      <button type="button" className="primary" onClick={addEntry}>
        <Plus size={16} />
        Nova entrada
      </button>
    </section>
  );
}

function CoverSearchPanel({
  item,
  settings,
  cloudSession,
  onApply,
  onClose,
}: {
  item: CulturalItem;
  settings: AppSettings;
  cloudSession?: CloudSession;
  onApply: (result: MetadataResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(getTitle(item));
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runSearch() {
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const found = await searchMetadata(item, settings, query, cloudSession);
      const covers = found.filter((result) => result.coverUrl);
      setResults(covers);
      if (!covers.length) {
        setError("Não encontrei uma capa boa para essa ficha. Tente título, autor, ano ou ISBN.");
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Não consegui procurar capas agora. A ficha continua editável manualmente.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadCover(file?: File) {
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const coverUrl = await uploadStoredImage(settings, cloudSession, file, "covers", item.id);
      onApply({
        id: `local-cover-${item.id}`,
        provider: "Arquivo local",
        title: getTitle(item),
        coverUrl,
        patch: { coverUrl },
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não consegui enviar essa capa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="cover-search-panel">
      <div className="section-heading split">
        <div className="section-heading">
          <ImageIcon size={20} />
          <h3>Trocar capa</h3>
        </div>
        <button type="button" className="ghost compact" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="cover-search-row">
        <label className="search-field">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? runSearch() : undefined} placeholder={item.category === "books" ? "Buscar capa por título, autor ou ISBN" : "Buscar capas por título"} />
        </label>
        <button type="button" className="primary" onClick={runSearch} disabled={loading || !query.trim()}>
          <Sparkles size={16} />
          {loading ? "Buscando..." : "Buscar capas"}
        </button>
      </div>
      <label className="local-image-upload cover-local-upload">
        <span>{loading ? "Preparando imagem..." : "Enviar capa própria"}</span>
        <input type="file" accept="image/*" disabled={loading} onChange={(event) => uploadCover(event.target.files?.[0])} />
        <small>Arquivos locais vão para o Storage quando você está conectado.</small>
      </label>
      {error ? <p className="metadata-error">{error}</p> : null}
      {loading ? <CoverSearchSkeleton /> : null}
      {results.length ? (
        <div className="cover-search-results">
          {results.map((result) => (
            <button type="button" key={`cover-${result.id}`} className="cover-search-result" onClick={() => onApply(result)}>
              <span>{result.coverUrl ? <img src={result.coverUrl} alt="" /> : <ImageIcon size={18} />}</span>
              <strong>{result.title}</strong>
              <small>{[result.provider, result.subtitle].filter(Boolean).join(" / ")}</small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CoverSearchSkeleton() {
  return (
    <div className="cover-search-results cover-search-skeleton-list" aria-label="Buscando capas">
      {[0, 1, 2, 3].map((item) => (
        <div className="cover-search-result cover-search-skeleton-card" key={item}>
          <span className="skeleton-block" />
          <strong className="skeleton-line skeleton-line-title" />
          <small className="skeleton-line skeleton-line-short" />
        </div>
      ))}
    </div>
  );
}

function loadDiaryVisibility(): DiaryEntry["visibility"] {
  const saved = localStorage.getItem(DIARY_VISIBILITY_KEY);
  return saved === "friends" ? "friends" : "private";
}

function QuickStarRating({
  value,
  onChange,
}: {
  value?: Rating;
  onChange: (rating: Rating | undefined) => void;
}) {
  const options = [1, 2, 3, 4, 5] as const;

  return (
    <div className="quick-star-rating" role="group" aria-label="Alterar nota">
      <button type="button" className="quick-star-clear" onClick={() => onChange(undefined)}>
        Sem nota
      </button>
      <div className="quick-star-buttons">
        {options.map((star) => (
          <span key={star} className="quick-star-wrap">
            <button
              type="button"
              className={`quick-star-hit quick-star-left${value === star - 0.5 ? " active" : ""}`}
              onClick={() => onChange((star - 0.5) as Rating)}
              aria-label={`${star - 0.5} estrela${star - 0.5 === 1 ? "" : "s"}`}
            />
            <button
              type="button"
              className={`quick-star-hit quick-star-right${value === star ? " active" : ""}`}
              onClick={() => onChange(star as Rating)}
              aria-label={`${star} estrela${star === 1 ? "" : "s"}`}
            />
            <span aria-hidden="true" className={value && value >= star ? "filled" : value && value >= star - 0.5 ? "half" : ""}>★</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function buildStoryTimeline(item: CulturalItem, diary: DiaryEntry[]) {
  return [
    ...item.timeline.map((event) => ({
      id: event.id,
      date: event.date,
      label: event.type,
      text: event.note ?? "",
      kind: "event" as const,
    })),
    ...diary.filter((entry) => entry.text.trim()).map((entry) => ({
      id: `diary-${entry.id}`,
      date: entry.date,
      label: `Escrevi uma nota / ${entry.type ?? "Impressão"}`,
      text: entry.text.length > 140 ? `${entry.text.slice(0, 140)}...` : entry.text,
      kind: "diary" as const,
    })),
  ].sort((a, b) => new Date(a.date || "1900-01-01").getTime() - new Date(b.date || "1900-01-01").getTime());
}

function buildFinalSummarySuggestion(item: CulturalItem) {
  const notes = item.diary.filter((entry) => entry.text.trim());
  if (!isCompleted(item) || notes.length < 5 || hasFinalOpinion(item)) return null;

  const summary = notes
    .slice()
    .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime())
    .map((entry) => `${entry.type ?? "Impressão"}: ${entry.text.trim()}`)
    .join("\n\n");

  return {
    title: `Você escreveu ${notes.length} notas sobre este item.`,
    text: "Quer transformar essas entradas em uma opinião final para a ficha?",
    summary,
  };
}

function hasFinalOpinion(item: CulturalItem) {
  if (item.category === "books") return Boolean(item.finalOpinion?.trim());
  if (item.category === "albums") return Boolean(item.comments?.trim());
  if (item.category === "movies" || item.category === "series") return Boolean(item.comments?.trim());
  return Boolean(item.notes?.trim());
}

function applyFinalSummary(item: CulturalItem, summary: string): CulturalItem {
  const updatedAt = new Date().toISOString();
  if (item.category === "books") return { ...item, finalOpinion: summary, updatedAt };
  if (item.category === "albums") return { ...item, comments: summary, updatedAt };
  if (item.category === "movies" || item.category === "series") return { ...item, comments: summary, updatedAt };
  return { ...item, notes: summary, updatedAt };
}

function buildDetailSummaryFields(item: CulturalItem, diary: DiaryEntry[], timelineEntries: ReturnType<typeof buildStoryTimeline>): Array<[string, string]> {
  const diaryCount = diary.filter((entry) => entry.text.trim()).length;
  return visibleFields([
    ["Status", item.status],
    ["Nota", item.rating ? `${item.rating}/5` : "Sem nota arquivada"],
    ["Ano", getYear(item)],
    ["Gênero", item.genre],
    ["Progresso", getProgressSnapshot(item)],
    ["Diário", diaryCount ? `${diaryCount} ${diaryCount === 1 ? "entrada" : "entradas"}` : "Nenhuma nota"],
    ["Histórico", timelineEntries.length ? `${timelineEntries.length} ${timelineEntries.length === 1 ? "evento" : "eventos"}` : "Ainda em branco"],
    ["Visibilidade", getItemVisibilityLabel(item)],
  ]);
}

function getProgressSnapshot(item: CulturalItem) {
  if (item.category === "games") {
    return item.timePlayed || item.completionType || item.platform || "";
  }

  if (item.category === "books") {
    if (item.currentPage && item.pages) return `${item.currentPage}/${item.pages} páginas`;
    if (item.currentPage) return `Página ${item.currentPage}`;
    if (item.pages) return `${item.pages} páginas`;
    return item.format || "";
  }

  if (item.category === "albums") {
    if (item.listenCount) return `${item.listenCount} ${Number(item.listenCount) === 1 ? "escuta" : "escutas"}`;
    return item.listenMode || item.listenedDate || "";
  }

  if (item.category === "movies") {
    return item.runtimeMinutes ? `${item.runtimeMinutes} min` : item.endDate || item.startDate || "";
  }

  return [item.currentSeason ? `T${item.currentSeason}` : "", item.currentEpisode ? `E${item.currentEpisode}` : ""].filter(Boolean).join(" / ") || item.trackingStatus || "";
}

function detailSections(item: CulturalItem): Array<{ title: string; fields: Array<[string, string]> }> {
  if (item.category === "games") {
    return [
      { title: "Ficha técnica", fields: visibleFields([["Plataforma", item.platform], ["Desenvolvedora", item.developer], ["Publicadora", item.publisher], ["Ano de lançamento", item.releaseYear], ["Gênero", item.genre]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Início", item.startDate], ["Conclusão/abandono", item.endDate], ["Tempo jogado", item.timePlayed], ["Conclusão", item.completionType]]) },
      { title: "Avaliação", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""], ["Dificuldade percebida", item.perceivedDifficulty]]) },
      { title: "Notas pessoais", fields: visibleFields([["Comentários/anotações", item.notes], ["Motivo de abandono", item.abandonmentReason]]) },
    ];
  }

  if (item.category === "books") {
    return [
      { title: "Ficha técnica", fields: visibleFields([["Autor", item.author], ["Editora", item.publisher], ["Ano de publicação", item.publicationYear], ["Gênero", item.genre], ["Formato", item.format], ["Páginas", item.pages]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Início", item.startDate], ["Conclusão/abandono", item.endDate], ["Página atual", item.currentPage]]) },
      { title: "Avaliação", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""], ["Opinião final", item.finalOpinion]]) },
      { title: "Notas pessoais", fields: visibleFields([["Frases favoritas", item.favoriteQuotes], ["Resumo pessoal", item.personalSummary], ["Motivo de abandono", item.abandonmentReason]]) },
    ];
  }

  if (item.category === "albums") {
    return [
      { title: "Ficha técnica", fields: visibleFields([["Artista", item.artist], ["Ano de lançamento", item.releaseYear], ["Gênero", item.genre]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Data em que ouvi", item.listenedDate], ["Vezes ouvido", item.listenCount], ["Escuta", item.listenMode]]) },
      { title: "Avaliação", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""], ["Músicas favoritas", item.favoriteTracks], ["Músicas puladas", item.skippedTracks]]) },
      { title: "Notas pessoais", fields: visibleFields([["Comentários", item.comments]]) },
    ];
  }

  if (item.category === "movies") {
    return [
      { title: "Ficha técnica", fields: visibleFields([["Ano", item.year], ["Gênero", item.genre], ["Direção", item.director], ["Duração", item.runtimeMinutes ? `${item.runtimeMinutes} min` : ""]]) },
      { title: "Progresso", fields: visibleFields([["Status", item.status], ["Início", item.startDate], ["Conclusão", item.endDate]]) },
      { title: "Avaliação", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""]]) },
      { title: "Notas pessoais", fields: visibleFields([["Comentários", item.comments]]) },
    ];
  }

  return [
    { title: "Ficha técnica", fields: visibleFields([["Ano", item.year], ["Gênero", item.genre]]) },
    { title: "Progresso", fields: visibleFields([["Status", item.status], ["Início", item.startDate], ["Conclusão", item.endDate], ["Temporada atual", item.currentSeason], ["Episódio atual", item.currentEpisode], ["Acompanhamento", item.trackingStatus]]) },
    { title: "Avaliação", fields: visibleFields([["Nota", item.rating ? `${item.rating}/5` : ""]]) },
    { title: "Notas pessoais", fields: visibleFields([["Sinopse", item.comments]]) },
  ];
}

function visibleFields(fields: Array<[string, unknown]>): Array<[string, string]> {
  return fields
    .map(([label, value]) => [label, value === undefined || value === null ? "" : String(value)] as [string, string])
    .filter(([, value]) => value.trim());
}
