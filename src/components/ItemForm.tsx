import { ImageIcon, Search, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { AppSettings, Category, CloudSession, CulturalItem, DiaryEntry, ExternalLink, Rating, SocialVisibility, TimelineEvent } from "../types";
import { categoryLabels } from "../data/catalog";
import { getProviderHint, MetadataResult, searchMetadata } from "../services/metadata";
import { getTitle, uid } from "../utils/itemHelpers";
import { RatingInput } from "./Rating";
import { TagInput } from "./TagInput";

type MutableItem = CulturalItem & Record<string, unknown>;
const DIARY_VISIBILITY_KEY = "gaveteira-diary-default-visibility:v1";
const diaryTypes: NonNullable<DiaryEntry["type"]>[] = ["Impressão", "Citação", "Teoria", "Progresso", "Memória", "Revisita", "Opinião final"];
const diaryPrompts = [
  "O que te chamou atenção hoje?",
  "Você continuaria ou pausaria?",
  "Uma cena, frase ou música que ficou.",
  "O que mudou desde a última entrada?",
];

export function createBlankItem(category: Category, status: string): CulturalItem {
  const base = {
    id: uid(category),
    category,
    status,
    visibility: "friends" as SocialVisibility,
    tags: [],
    links: [],
    timeline: [],
    diary: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (category === "games") return { ...base, category, name: "", platform: "", status };
  if (category === "books") return { ...base, category, title: "", status };
  if (category === "albums") return { ...base, category, name: "", status };
  if (category === "movies") return { ...base, category, title: "", status };
  return { ...base, category, title: "", status };
}

export function ItemForm({
  item,
  statuses,
  settings,
  cloudSession,
  onSave,
  onDelete,
  onClose,
}: {
  item: CulturalItem;
  statuses: string[];
  settings: AppSettings;
  cloudSession?: CloudSession;
  onSave: (item: CulturalItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const draft = item as MutableItem;
  const update = (patch: Record<string, unknown>) => onSave({ ...item, ...patch, updatedAt: new Date().toISOString() } as CulturalItem);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={(event) => event.preventDefault()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">{categoryLabels[item.category]}</p>
            <h2>{getTitle(item) || "Nova ficha"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <MobileFormSection title="Dados básicos" open>
          <MetadataLookup
            item={item}
            settings={settings}
            cloudSession={cloudSession}
            onApply={(result) => updateMetadataResult(item, result, update)}
            onApplyCover={(result) => updateCoverResult(item, result, update)}
          />

          <div className="form-grid">
            {item.category === "games" ? <GameFields item={draft} update={update} /> : null}
            {item.category === "books" ? <BookFields item={draft} update={update} /> : null}
            {item.category === "albums" ? <AlbumFields item={draft} update={update} /> : null}
            {item.category === "movies" ? <MovieFields item={draft} update={update} /> : null}
            {item.category === "series" ? <SeriesFields item={draft} update={update} /> : null}

            <MobileFieldGroup title="Status e avaliação">
              <Field label="Status">
                <select value={item.status} onChange={(event) => update({ status: event.target.value })}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Nota">
                <RatingInput value={item.rating as Rating | undefined} onChange={(rating) => update({ rating })} />
              </Field>
            </MobileFieldGroup>
            <MobileFieldGroup title="Capa e tags">
              <Field label="Visibilidade">
                <select value={item.visibility === "private" ? "private" : "friends"} onChange={(event) => update({ visibility: event.target.value as SocialVisibility })}>
                  <option value="private">Privado</option>
                  <option value="friends">Visível para amigos</option>
                </select>
                <small>{item.visibility === "private" ? "Só você vê esta ficha na área social." : "Amigos podem ver a ficha; o diário ainda respeita a privacidade de cada entrada."}</small>
              </Field>
              <Field label="Capa ou poster">
                <input value={item.coverUrl ?? ""} onChange={(event) => update({ coverUrl: event.target.value })} placeholder="URL da imagem" />
              </Field>
              <Field label="Tags">
                <TagInput value={item.tags} onChange={(tags) => update({ tags })} />
              </Field>
            </MobileFieldGroup>
          </div>
        </MobileFormSection>

        <MobileFormSection title="Links">
          <section className="form-section">
            <h3>Links externos</h3>
            <RepeatingLinks links={item.links} onChange={(links) => update({ links })} />
          </section>
        </MobileFormSection>

        <MobileFormSection title="Histórico">
          <section className="form-section">
            <h3>Histórico</h3>
            <TimelineEditor events={item.timeline} onChange={(timeline) => update({ timeline })} />
          </section>
        </MobileFormSection>

        <MobileFormSection title="Diário">
          <section className="form-section">
            <h3>Diário</h3>
            <DiaryEditor entries={item.diary} onChange={(diary) => update({ diary })} />
          </section>
        </MobileFormSection>

        <footer className="modal-footer">
          <button type="button" className="danger" onClick={() => onDelete(item.id)}>
            <Trash2 size={16} />
            Remover ficha
          </button>
          <button type="button" className="primary" onClick={onClose}>Concluir</button>
        </footer>
      </form>
    </div>
  );
}

function MetadataLookup({
  item,
  settings,
  cloudSession,
  onApply,
  onApplyCover,
}: {
  item: CulturalItem;
  settings: AppSettings;
  cloudSession?: CloudSession;
  onApply: (result: MetadataResult) => void;
  onApplyCover: (result: MetadataResult) => void;
}) {
  const [query, setQuery] = useState(getTitle(item));
  const [results, setResults] = useState<MetadataResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"data" | "cover">("data");
  const [error, setError] = useState("");
  const configuredKeys = Object.values(settings.apiKeys).filter(Boolean).length;

  async function runSearch(nextMode: "data" | "cover") {
    setLoading(true);
    setMode(nextMode);
    setError("");
    setResults([]);

    try {
      const found = await searchMetadata(item, settings, query, cloudSession);
      const visibleResults = nextMode === "cover" ? found.filter((result) => result.coverUrl) : found;
      setResults(visibleResults);
      if (!visibleResults.length) {
        setError(nextMode === "cover"
          ? "Não encontrei uma capa boa para essa ficha. Tente título, autor, ano ou ISBN, ou cole uma URL manualmente."
          : "Não encontrei dados confiáveis para essa ficha. Tente um nome mais específico ou preencha manualmente.");
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Não consegui buscar dados agora. A ficha continua editável manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="api-ready">
      <div className="metadata-header">
        <div>
          <strong>Completar automaticamente</strong>
          <span>{getProviderHint(item.category)}. Chaves configuradas: {configuredKeys}. Cadastro manual segue livre.</span>
        </div>
      </div>
      <div className="metadata-search">
        <label className="search-field">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={item.category === "books" ? "Digite título, autor ou ISBN" : "Digite o nome para procurar a ficha"} />
        </label>
        <button type="button" className="primary" onClick={() => runSearch("data")} disabled={loading}>
          <Sparkles size={16} />
          {loading && mode === "data" ? "Buscando..." : "Buscar dados"}
        </button>
        <button type="button" className="secondary" onClick={() => runSearch("cover")} disabled={loading}>
          <ImageIcon size={16} />
          {loading && mode === "cover" ? "Buscando..." : "Buscar capas"}
        </button>
      </div>
      {error ? <p className="metadata-error">{error}</p> : null}
      {results.length ? (
        <div className="metadata-results">
          {results.map((result) => (
            <button
              type="button"
              key={`${mode}-${result.id}`}
              className="metadata-result"
              onClick={() => mode === "cover" ? onApplyCover(result) : onApply(result)}
            >
              <span className="metadata-cover">
                {result.coverUrl ? <img src={result.coverUrl} alt="" /> : <Sparkles size={18} />}
              </span>
              <span>
                <strong>{result.title}</strong>
                <small>{[result.provider, result.subtitle, mode === "cover" ? "usar apenas capa" : undefined].filter(Boolean).join(" / ")}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function updateCoverResult(item: CulturalItem, result: MetadataResult, update: (patch: Record<string, unknown>) => void) {
  if (!result.coverUrl) return;

  update({
    coverUrl: result.coverUrl,
    links: mergeLinks(item.links, result.links ?? []),
  });
}

function updateMetadataResult(item: CulturalItem, result: MetadataResult, update: (patch: Record<string, unknown>) => void) {
  update({
    ...result.patch,
    links: mergeLinks(item.links, result.links ?? []),
  });
}

function mergeLinks(existing: ExternalLink[], incoming: ExternalLink[]) {
  const seen = new Set(existing.map((link) => `${link.label}:${link.url}`.toLowerCase()));
  const merged = [...existing];

  for (const link of incoming) {
    const key = `${link.label}:${link.url}`.toLowerCase();
    if (!seen.has(key)) {
      merged.push(link);
      seen.add(key);
    }
  }

  return merged;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function MobileFormSection({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="form-mobile-section" open={open ?? true}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

function MobileFieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="mobile-field-group" open>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value?: unknown; onChange: (value: string) => void }) {
  return <Field label={label}><textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function numberValue(value: FormDataEntryValue | null) {
  return value === "" || value === null ? undefined : Number(value);
}

function GameFields({ item, update }: { item: MutableItem; update: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      <MobileFieldGroup title="Dados básicos">
        <Field label="Nome do jogo"><input value={String(item.name ?? "")} onChange={(e) => update({ name: e.target.value })} /></Field>
        <Field label="Plataforma"><input value={String(item.platform ?? "")} onChange={(e) => update({ platform: e.target.value })} /></Field>
        <Field label="Desenvolvedora"><input value={String(item.developer ?? "")} onChange={(e) => update({ developer: e.target.value })} /></Field>
        <Field label="Publicadora"><input value={String(item.publisher ?? "")} onChange={(e) => update({ publisher: e.target.value })} /></Field>
        <Field label="Ano de lançamento"><input type="number" value={String(item.releaseYear ?? "")} onChange={(e) => update({ releaseYear: numberValue(e.target.value) })} /></Field>
        <Field label="Gênero"><input value={String(item.genre ?? "")} onChange={(e) => update({ genre: e.target.value })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Progresso">
        <Field label="Início"><input type="date" value={String(item.startDate ?? "")} onChange={(e) => update({ startDate: e.target.value })} /></Field>
        <Field label="Conclusão ou abandono"><input type="date" value={String(item.endDate ?? "")} onChange={(e) => update({ endDate: e.target.value })} /></Field>
        <Field label="Tempo jogado"><input value={String(item.timePlayed ?? "")} onChange={(e) => update({ timePlayed: e.target.value })} /></Field>
        <Field label="Conclusão"><select value={String(item.completionType ?? "")} onChange={(e) => update({ completionType: e.target.value })}><option value="">Selecione</option><option>Zerou</option><option>Platinou</option><option>Terminou a história</option><option>Não terminou</option></select></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Avaliação e notas">
        <Field label="Dificuldade percebida"><input value={String(item.perceivedDifficulty ?? "")} onChange={(e) => update({ perceivedDifficulty: e.target.value })} /></Field>
        <TextareaField label="Motivo de abandono" value={item.abandonmentReason} onChange={(value) => update({ abandonmentReason: value })} />
        <TextareaField label="Comentários/anotações" value={item.notes} onChange={(value) => update({ notes: value })} />
      </MobileFieldGroup>
    </>
  );
}

function BookFields({ item, update }: { item: MutableItem; update: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      <MobileFieldGroup title="Dados básicos">
        <Field label="Título"><input value={String(item.title ?? "")} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label="Autor"><input value={String(item.author ?? "")} onChange={(e) => update({ author: e.target.value })} /></Field>
        <Field label="Formato"><select value={String(item.format ?? "")} onChange={(e) => update({ format: e.target.value })}><option value="">Selecione</option><option>Físico</option><option>Kindle</option><option>Audiobook</option><option>PDF</option><option>Outro</option></select></Field>
        <Field label="Gênero"><input value={String(item.genre ?? "")} onChange={(e) => update({ genre: e.target.value })} /></Field>
        <Field label="Editora"><input value={String(item.publisher ?? "")} onChange={(e) => update({ publisher: e.target.value })} /></Field>
        <Field label="Ano de publicação"><input type="number" value={String(item.publicationYear ?? "")} onChange={(e) => update({ publicationYear: numberValue(e.target.value) })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Progresso">
        <Field label="Início"><input type="date" value={String(item.startDate ?? "")} onChange={(e) => update({ startDate: e.target.value })} /></Field>
        <Field label="Conclusão ou abandono"><input type="date" value={String(item.endDate ?? "")} onChange={(e) => update({ endDate: e.target.value })} /></Field>
        <Field label="Número de páginas"><input type="number" value={String(item.pages ?? "")} onChange={(e) => update({ pages: numberValue(e.target.value) })} /></Field>
        <Field label="Página atual"><input type="number" value={String(item.currentPage ?? "")} onChange={(e) => update({ currentPage: numberValue(e.target.value) })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Notas">
        <TextareaField label="Frases favoritas" value={item.favoriteQuotes} onChange={(value) => update({ favoriteQuotes: value })} />
        <TextareaField label="Resumo pessoal" value={item.personalSummary} onChange={(value) => update({ personalSummary: value })} />
        <TextareaField label="Opinião final" value={item.finalOpinion} onChange={(value) => update({ finalOpinion: value })} />
        <TextareaField label="Motivo de abandono" value={item.abandonmentReason} onChange={(value) => update({ abandonmentReason: value })} />
      </MobileFieldGroup>
    </>
  );
}

function AlbumFields({ item, update }: { item: MutableItem; update: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      <MobileFieldGroup title="Dados básicos">
        <Field label="Nome do disco"><input value={String(item.name ?? "")} onChange={(e) => update({ name: e.target.value })} /></Field>
        <Field label="Artista"><input value={String(item.artist ?? "")} onChange={(e) => update({ artist: e.target.value })} /></Field>
        <Field label="Ano de lançamento"><input type="number" value={String(item.releaseYear ?? "")} onChange={(e) => update({ releaseYear: numberValue(e.target.value) })} /></Field>
        <Field label="Gênero"><input value={String(item.genre ?? "")} onChange={(e) => update({ genre: e.target.value })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Progresso">
        <Field label="Data em que ouvi"><input type="date" value={String(item.listenedDate ?? "")} onChange={(e) => update({ listenedDate: e.target.value })} /></Field>
        <Field label="Vezes ouvido"><input type="number" value={String(item.listenCount ?? "")} onChange={(e) => update({ listenCount: numberValue(e.target.value) })} /></Field>
        <Field label="Escuta"><select value={String(item.listenMode ?? "")} onChange={(e) => update({ listenMode: e.target.value })}><option value="">Selecione</option><option>Inteiro</option><option>Parcialmente</option></select></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Notas">
        <TextareaField label="Músicas favoritas" value={item.favoriteTracks} onChange={(value) => update({ favoriteTracks: value })} />
        <TextareaField label="Músicas puladas" value={item.skippedTracks} onChange={(value) => update({ skippedTracks: value })} />
        <TextareaField label="Comentários" value={item.comments} onChange={(value) => update({ comments: value })} />
      </MobileFieldGroup>
    </>
  );
}

function MovieFields({ item, update }: { item: MutableItem; update: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      <MobileFieldGroup title="Dados básicos">
        <Field label="Título"><input value={String(item.title ?? "")} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label="Ano"><input type="number" value={String(item.year ?? "")} onChange={(e) => update({ year: numberValue(e.target.value) })} /></Field>
        <Field label="Gênero"><input value={String(item.genre ?? "")} onChange={(e) => update({ genre: e.target.value })} /></Field>
        <Field label="Direção"><input value={String(item.director ?? "")} onChange={(e) => update({ director: e.target.value })} /></Field>
        <Field label="Duração em minutos"><input type="number" value={String(item.runtimeMinutes ?? "")} onChange={(e) => update({ runtimeMinutes: numberValue(e.target.value) })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Progresso">
        <Field label="Início"><input type="date" value={String(item.startDate ?? "")} onChange={(e) => update({ startDate: e.target.value })} /></Field>
        <Field label="Conclusão"><input type="date" value={String(item.endDate ?? "")} onChange={(e) => update({ endDate: e.target.value })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Notas">
        <TextareaField label="Comentários" value={item.comments} onChange={(value) => update({ comments: value })} />
      </MobileFieldGroup>
    </>
  );
}

function SeriesFields({ item, update }: { item: MutableItem; update: (patch: Record<string, unknown>) => void }) {
  return (
    <>
      <MobileFieldGroup title="Dados básicos">
        <Field label="Título"><input value={String(item.title ?? "")} onChange={(e) => update({ title: e.target.value })} /></Field>
        <Field label="Ano"><input type="number" value={String(item.year ?? "")} onChange={(e) => update({ year: numberValue(e.target.value) })} /></Field>
        <Field label="Gênero"><input value={String(item.genre ?? "")} onChange={(e) => update({ genre: e.target.value })} /></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Progresso">
        <Field label="Início"><input type="date" value={String(item.startDate ?? "")} onChange={(e) => update({ startDate: e.target.value })} /></Field>
        <Field label="Conclusão"><input type="date" value={String(item.endDate ?? "")} onChange={(e) => update({ endDate: e.target.value })} /></Field>
        <Field label="Temporada atual"><input type="number" value={String(item.currentSeason ?? "")} onChange={(e) => update({ currentSeason: numberValue(e.target.value) })} /></Field>
        <Field label="Episódio atual"><input type="number" value={String(item.currentEpisode ?? "")} onChange={(e) => update({ currentEpisode: numberValue(e.target.value) })} /></Field>
        <Field label="Acompanhamento"><select value={String(item.trackingStatus ?? "")} onChange={(e) => update({ trackingStatus: e.target.value })}><option value="">Selecione</option><option>Em dia</option><option>Atrasado</option><option>Pausado</option><option>Finalizada</option></select></Field>
      </MobileFieldGroup>
      <MobileFieldGroup title="Notas">
        <TextareaField label="Comentários" value={item.comments} onChange={(value) => update({ comments: value })} />
      </MobileFieldGroup>
    </>
  );
}

function RepeatingLinks({ links, onChange }: { links: ExternalLink[]; onChange: (links: ExternalLink[]) => void }) {
  const update = (id: string, patch: Partial<ExternalLink>) => onChange(links.map((link) => link.id === id ? { ...link, ...patch } : link));
  return (
    <div className="repeat-list">
      {links.map((link) => (
        <div className="repeat-row" key={link.id}>
          <input value={link.label} onChange={(e) => update(link.id, { label: e.target.value })} placeholder="Steam, Spotify..." />
          <input value={link.url} onChange={(e) => update(link.id, { url: e.target.value })} placeholder="https://" />
          <button type="button" className="icon-button" onClick={() => onChange(links.filter((entry) => entry.id !== link.id))}><X size={16} /></button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => onChange([...links, { id: uid("link"), label: "", url: "" }])}>Adicionar link</button>
    </div>
  );
}

function TimelineEditor({ events, onChange }: { events: TimelineEvent[]; onChange: (events: TimelineEvent[]) => void }) {
  const update = (id: string, patch: Partial<TimelineEvent>) => onChange(events.map((event) => event.id === id ? { ...event, ...patch } : event));
  return (
    <div className="repeat-list">
      {events.map((entry) => (
        <div className="repeat-row timeline-row" key={entry.id}>
          <input type="date" value={entry.date} onChange={(e) => update(entry.id, { date: e.target.value })} />
          <select value={entry.type} onChange={(e) => update(entry.id, { type: e.target.value as TimelineEvent["type"] })}>
            {["Comecei", "Pausei", "Voltei", "Terminei", "Abandonei", "Revi", "Reli", "Rejoguei", "Reouvi", "Outro"].map((type) => <option key={type}>{type}</option>)}
          </select>
          <input value={entry.note ?? ""} onChange={(e) => update(entry.id, { note: e.target.value })} placeholder="Observação" />
          <button type="button" className="icon-button" onClick={() => onChange(events.filter((event) => event.id !== entry.id))}><X size={16} /></button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => onChange([...events, { id: uid("event"), date: new Date().toISOString().slice(0, 10), type: "Outro" }])}>Registrar evento</button>
    </div>
  );
}

function DiaryEditor({ entries, onChange }: { entries: DiaryEntry[]; onChange: (entries: DiaryEntry[]) => void }) {
  const [defaultVisibility, setDefaultVisibility] = useState<DiaryEntry["visibility"]>(() => loadDiaryVisibility());
  const update = (id: string, patch: Partial<DiaryEntry>) => {
    if (patch.visibility) {
      localStorage.setItem(DIARY_VISIBILITY_KEY, patch.visibility);
      setDefaultVisibility(patch.visibility);
    }
    onChange(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  };
  return (
    <div className="repeat-list">
      <div className="diary-prompt-row" aria-label="Sugestões de escrita">
        {diaryPrompts.map((prompt) => <span key={prompt}>{prompt}</span>)}
      </div>
      {entries.map((entry) => (
        <div className="diary-row" key={entry.id}>
          <input type="date" value={entry.date} onChange={(e) => update(entry.id, { date: e.target.value })} />
          <select value={entry.type ?? "Impressão"} onChange={(e) => update(entry.id, { type: e.target.value as DiaryEntry["type"] })}>
            {diaryTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <select value={entry.visibility ?? "private"} onChange={(e) => update(entry.id, { visibility: e.target.value as DiaryEntry["visibility"] })}>
            <option value="private">Privado</option>
            <option value="friends">Visível para amigos</option>
          </select>
          <textarea value={entry.text} onChange={(e) => update(entry.id, { text: e.target.value })} placeholder={diaryPrompts[0]} />
          <button type="button" className="icon-button" onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}><X size={16} /></button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => onChange([...entries, { id: uid("diary"), date: new Date().toISOString().slice(0, 10), text: "", visibility: defaultVisibility, type: "Impressão" }])}>Nova entrada</button>
    </div>
  );
}

function loadDiaryVisibility(): DiaryEntry["visibility"] {
  const saved = localStorage.getItem(DIARY_VISIBILITY_KEY);
  return saved === "friends" ? "friends" : "private";
}
