import { ImageIcon, Search, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { AppSettings, Category, CloudSession, CulturalItem, DiaryEntry, ExternalLink, Rating, SocialVisibility } from "../types";
import { categoryLabels } from "../data/catalog";
import { createSeasonalThemeStamp } from "../data/seasonalThemes";
import { getProviderHint, MetadataResult, searchMetadata } from "../services/metadata";
import { uploadStoredImage } from "../services/storage";
import { getTitle, uid } from "../utils/itemHelpers";
import { RatingInput } from "./Rating";

type MutableItem = CulturalItem & Record<string, unknown>;
const DIARY_VISIBILITY_KEY = "gaveteira-diary-default-visibility:v1";
type DiaryType = NonNullable<DiaryEntry["type"]>;
const baseDiaryTypes: DiaryType[] = ["Impressão", "Citação", "Teoria", "Progresso", "Memória", "Revisita", "Opinião final"];
const diaryPrompts = [
  "O que te chamou atenção hoje?",
  "Você continuaria ou pausaria?",
  "Uma cena, frase ou música que ficou.",
  "O que mudou desde a última entrada?",
];

export function createBlankItem(category: Category, status: string): CulturalItem {
  const now = new Date();
  const seasonalTheme = createSeasonalThemeStamp(now);
  const base = {
    id: uid(category),
    category,
    status,
    visibility: "friends" as SocialVisibility,
    tags: [],
    links: [],
    timeline: [],
    diary: [],
    ...(seasonalTheme ? { seasonalTheme } : {}),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
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
  showFirstCardTutorial = false,
  onSave,
  onDelete,
  onClose,
}: {
  item: CulturalItem;
  statuses: string[];
  settings: AppSettings;
  cloudSession?: CloudSession;
  showFirstCardTutorial?: boolean;
  onSave: (item: CulturalItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const draft = item as MutableItem;
  const [tutorialStep, setTutorialStep] = useState(0);
  const [formStep, setFormStep] = useState(0);
  const update = (patch: Record<string, unknown>) => onSave({ ...item, ...patch, updatedAt: new Date().toISOString() } as CulturalItem);
  const tutorialActive = showFirstCardTutorial;
  const activeStep = tutorialActive ? tutorialStep : formStep;
  const tutorialComplete = !tutorialActive || tutorialStep === firstCardTutorialSteps.length - 1;
  const formComplete = formStep === cardFormSteps.length - 1;
  const canClose = tutorialActive ? tutorialComplete : true;
  const advanceFirstCardTutorial = () => {
    if (tutorialStep === 1 && !item.diary.length) {
      update({ diary: [createBlankDiaryEntry(loadDiaryVisibility())] });
    }
    setTutorialStep((current) => Math.min(firstCardTutorialSteps.length - 1, current + 1));
  };
  const advanceFormStep = () => {
    if (formStep === 1 && !item.diary.length) {
      update({ diary: [createBlankDiaryEntry(loadDiaryVisibility())] });
    }
    setFormStep((current) => Math.min(cardFormSteps.length - 1, current + 1));
  };
  const finishOrAdvance = () => {
    if (tutorialActive) {
      if (tutorialComplete) onClose();
      else advanceFirstCardTutorial();
      return;
    }

    if (formComplete) onClose();
    else advanceFormStep();
  };
  const categoryFields = (
    <>
      {item.category === "games" ? <GameFields item={draft} update={update} /> : null}
      {item.category === "books" ? <BookFields item={draft} update={update} /> : null}
      {item.category === "albums" ? <AlbumFields item={draft} update={update} /> : null}
      {item.category === "movies" ? <MovieFields item={draft} update={update} /> : null}
      {item.category === "series" ? <SeriesFields item={draft} update={update} /> : null}
    </>
  );
  const statusRatingFields = (
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
  );
  const visibilityField = (
    <Field label="Visibilidade">
      <select value={item.visibility === "private" ? "private" : "friends"} onChange={(event) => update({ visibility: event.target.value as SocialVisibility })}>
        <option value="private">Privado</option>
        <option value="friends">Visível para amigos</option>
      </select>
      <small>{item.visibility === "private" ? "Só você vê esta ficha na área social." : "Amigos podem ver a ficha; o diário ainda respeita a privacidade de cada entrada."}</small>
    </Field>
  );
  const coverField = (
    <MobileFieldGroup title="Capa">
      <Field label="Capa ou poster">
        <input value={item.coverUrl ?? ""} onChange={(event) => update({ coverUrl: event.target.value })} placeholder="URL da imagem" />
        <CoverUploadInput
          item={item}
          settings={settings}
          cloudSession={cloudSession}
          onUploaded={(coverUrl) => update({ coverUrl })}
        />
      </Field>
    </MobileFieldGroup>
  );
  const metadataLookup = (
    <MetadataLookup
      item={item}
      settings={settings}
      cloudSession={cloudSession}
      onApply={(result) => updateMetadataResult(item, result, update)}
      onApplyCover={(result) => updateCoverResult(item, result, update)}
    />
  );

  return (
    <div className={`modal-backdrop${tutorialActive ? " first-card-form-backdrop" : ""}`} role="dialog" aria-modal="true">
      <form className={`modal${tutorialActive ? " first-card-form-modal" : ""}`} onSubmit={(event) => event.preventDefault()}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">{categoryLabels[item.category]}</p>
            <h2>{getTitle(item) || "Nova ficha"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar" disabled={!canClose}>
            <X size={20} />
          </button>
        </header>

        {showFirstCardTutorial ? (
          <>
            <FirstCardTutorial
              step={tutorialStep}
              onBack={() => setTutorialStep((current) => Math.max(0, current - 1))}
              onNext={advanceFirstCardTutorial}
            />

            {tutorialStep === 0 ? (
              <MobileFormSection title="Completar ficha" open>
                {metadataLookup}
                <div className="form-grid first-card-tutorial-grid">
                  {categoryFields}
                </div>
              </MobileFormSection>
            ) : null}

            {tutorialStep === 1 ? (
              <MobileFormSection title="Status, nota e visibilidade" open>
                <div className="form-grid first-card-tutorial-grid">
                  {statusRatingFields}
                  <MobileFieldGroup title="Visibilidade">
                    {visibilityField}
                  </MobileFieldGroup>
                </div>
              </MobileFormSection>
            ) : null}

            {tutorialStep === 2 ? (
              <MobileFormSection title="Diário" open>
                <section className="form-section first-card-diary-step">
                  <h3>Primeiro diário</h3>
                  <DiaryEditor category={item.category} entries={item.diary} onChange={(diary) => update({ diary })} />
                </section>
              </MobileFormSection>
            ) : null}
          </>
        ) : (
          <>
            <CardFormStepper step={formStep} onSelect={setFormStep} />

            {formStep === 0 ? (
              <MobileFormSection title="Ficha" open>
                {metadataLookup}

                <div className="form-grid">
                  {categoryFields}
                  {coverField}
                </div>

                <section className="form-section">
                  <h3>Links externos</h3>
                  <RepeatingLinks links={item.links} onChange={(links) => update({ links })} />
                </section>
              </MobileFormSection>
            ) : null}

            {formStep === 1 ? (
              <MobileFormSection title="Status e visibilidade" open>
                <div className="form-grid">
                  {statusRatingFields}
                  <MobileFieldGroup title="Visibilidade">
                    {visibilityField}
                  </MobileFieldGroup>
                </div>
              </MobileFormSection>
            ) : null}

            {formStep === 2 ? (
              <MobileFormSection title="Diário" open>
                <section className="form-section">
                  <h3>Diário</h3>
                  <DiaryEditor category={item.category} entries={item.diary} onChange={(diary) => update({ diary })} />
                </section>
              </MobileFormSection>
            ) : null}
          </>
        )}

        <footer className="modal-footer">
          <button type="button" className="danger" onClick={() => onDelete(item.id)}>
            <Trash2 size={16} />
            Remover ficha
          </button>
          <div className="modal-footer-actions">
            {!tutorialActive && activeStep > 0 ? (
              <button type="button" className="ghost" onClick={() => setFormStep((current) => Math.max(0, current - 1))}>
                Voltar
              </button>
            ) : null}
            <button type="button" className="primary" onClick={finishOrAdvance}>
              {(tutorialActive ? tutorialComplete : formComplete) ? "Concluir" : "Próxima etapa"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

const firstCardTutorialSteps = [
  {
    eyebrow: "Etapa 1 de 3",
    title: "Complete do seu jeito",
    description: "É possível completar automaticamente ou manualmente. Nem todas as databases detêm todas as informações, então qualquer campo pode ser ajustado com calma.",
  },
  {
    eyebrow: "Etapa 2 de 3",
    title: "Status, nota e visibilidade",
    description: "Nesta página você define o status da ficha, a nota e quem pode ver esse card.",
  },
  {
    eyebrow: "Etapa 3 de 3",
    title: "Registre o primeiro diário",
    description: "Abra uma primeira entrada para guardar uma impressão, citação, memória ou opinião inicial.",
  },
];

const cardFormSteps = [
  { eyebrow: "Etapa 1 de 3", title: "Ficha" },
  { eyebrow: "Etapa 2 de 3", title: "Status e visibilidade" },
  { eyebrow: "Etapa 3 de 3", title: "Diário" },
];

function CardFormStepper({ step, onSelect }: { step: number; onSelect: (step: number) => void }) {
  const current = cardFormSteps[step];

  return (
    <section className="card-form-stepper" aria-label="Etapas da ficha">
      <div className="card-form-stepper-copy">
        <p className="eyebrow">{current.eyebrow}</p>
        <strong>{current.title}</strong>
      </div>
      <div className="card-form-stepper-tabs" role="tablist" aria-label="Etapas da ficha">
        {cardFormSteps.map((entry, index) => (
          <button
            key={entry.title}
            type="button"
            className={index === step ? "active" : index < step ? "done" : ""}
            onClick={() => onSelect(index)}
            role="tab"
            aria-selected={index === step}
          >
            <span>{index + 1}</span>
            {entry.title}
          </button>
        ))}
      </div>
    </section>
  );
}

function FirstCardTutorial({
  step,
  onBack,
  onNext,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const current = firstCardTutorialSteps[step];

  return (
    <section className="first-card-tutorial" aria-label="Tutorial da primeira ficha">
      <div className="first-card-tutorial-copy" key={current.title}>
        <p className="eyebrow">{current.eyebrow}</p>
        <strong>{current.title}</strong>
        <span>{current.description}</span>
      </div>
      <div className="first-card-tutorial-steps" aria-hidden="true">
        {firstCardTutorialSteps.map((entry, index) => (
          <span key={entry.title} className={index === step ? "active" : index < step ? "done" : ""} />
        ))}
      </div>
      <div className="first-card-tutorial-actions">
        <button type="button" className="ghost" onClick={onBack} disabled={step === 0}>Voltar</button>
        <button type="button" className="primary" onClick={onNext} disabled={step === firstCardTutorialSteps.length - 1}>Próxima etapa</button>
      </div>
    </section>
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
  const cloudMetadataActive = Boolean(settings.cloud?.supabaseUrl && settings.cloud?.supabaseAnonKey && cloudSession?.accessToken);

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
          <span>{getProviderHint(item.category)}. {cloudMetadataActive ? "Busca segura pela nuvem ativa." : `Chaves configuradas: ${configuredKeys}.`} Cadastro manual segue livre.</span>
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
      {loading ? <MetadataSkeletonList mode={mode} /> : null}
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

function CoverUploadInput({
  item,
  settings,
  cloudSession,
  onUploaded,
}: {
  item: CulturalItem;
  settings: AppSettings;
  cloudSession?: CloudSession;
  onUploaded: (coverUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadCover(file?: File) {
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const coverUrl = await uploadStoredImage(settings, cloudSession, file, "covers", item.id);
      onUploaded(coverUrl);
      setMessage(cloudSession ? "Capa enviada para o Storage." : "Capa carregada neste navegador.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui enviar essa capa.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <label className="local-image-upload">
      <span>{uploading ? "Enviando capa..." : "Enviar imagem local"}</span>
      <input type="file" accept="image/*" disabled={uploading} onChange={(event) => uploadCover(event.target.files?.[0])} />
      {message ? <small>{message}</small> : <small>Usa Supabase Storage quando sua conta está conectada.</small>}
    </label>
  );
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

function MetadataSkeletonList({ mode }: { mode: "data" | "cover" }) {
  return (
    <div className={`metadata-results metadata-skeleton-list metadata-skeleton-${mode}`} aria-label="Buscando opções">
      {[0, 1, 2].map((item) => (
        <div className="metadata-result metadata-skeleton-card" key={item}>
          <span className="metadata-cover skeleton-block" />
          <span>
            <strong className="skeleton-line skeleton-line-title" />
            <small className="skeleton-line skeleton-line-short" />
          </span>
        </div>
      ))}
    </div>
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

function DiaryEditor({ category, entries, onChange }: { category: Category; entries: DiaryEntry[]; onChange: (entries: DiaryEntry[]) => void }) {
  const [defaultVisibility, setDefaultVisibility] = useState<DiaryEntry["visibility"]>(() => loadDiaryVisibility());
  const availableDiaryTypes = getDiaryTypesForCategory(category);
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
            {withCurrentDiaryType(availableDiaryTypes, entry.type).map((type) => <option key={type}>{type}</option>)}
          </select>
          <select value={entry.visibility ?? "private"} onChange={(e) => update(entry.id, { visibility: e.target.value as DiaryEntry["visibility"] })}>
            <option value="private">Privado</option>
            <option value="friends">Visível para amigos</option>
          </select>
          <textarea value={entry.text} onChange={(e) => update(entry.id, { text: e.target.value })} placeholder={diaryPrompts[0]} />
          <button type="button" className="icon-button" onClick={() => onChange(entries.filter((item) => item.id !== entry.id))}><X size={16} /></button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => onChange([...entries, createBlankDiaryEntry(defaultVisibility)])}>Nova entrada</button>
    </div>
  );
}

function getDiaryTypesForCategory(category: Category): DiaryType[] {
  const categoryTypes: Record<Category, DiaryType[]> = {
    games: ["Dificuldade percebida", "Motivo de abandono", "Comentário"],
    books: ["Frases favoritas", "Resumo pessoal", "Opinião final", "Motivo de abandono"],
    albums: ["Músicas favoritas", "Músicas puladas", "Comentário"],
    movies: ["Comentário", "Opinião final"],
    series: ["Comentário", "Sinopse", "Opinião final"],
  };

  return [...new Set([...baseDiaryTypes, ...categoryTypes[category]])];
}

function withCurrentDiaryType(types: DiaryType[], current?: DiaryEntry["type"]) {
  return current && !types.includes(current) ? [current, ...types] : types;
}

function createBlankDiaryEntry(visibility: DiaryEntry["visibility"]): DiaryEntry {
  return {
    id: uid("diary"),
    date: new Date().toISOString().slice(0, 10),
    text: "",
    visibility,
    type: "Impressão",
  };
}

function loadDiaryVisibility(): DiaryEntry["visibility"] {
  const saved = localStorage.getItem(DIARY_VISIBILITY_KEY);
  return saved === "friends" ? "friends" : "private";
}
