import type { CSSProperties } from "react";
import { Clipboard, Download, Eye, FileJson, Layers3, LayoutTemplate, Palette, Plus, Ruler, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CulturalItem, Rating } from "../types";
import { categoryLabels } from "../data/catalog";
import { ItemCard } from "./ItemCard";
import { ItemDetails } from "./ItemDetails";
import { Stars } from "./Rating";

const STORAGE_KEY = "gaveteira-canva-ficha-template:v1";

interface CanvaPalette {
  paper: string;
  surface: string;
  panel: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  green: string;
  red: string;
  brass: string;
  coverA: string;
  coverB: string;
  chip: string;
}

interface CanvaPreviewFields {
  title: string;
  creator: string;
  status: string;
  year: string;
  genre: string;
  rating: Rating;
  currentPage: string;
  pages: string;
  quote: string;
  summary: string;
  diaryNote: string;
}

interface CanvaTemplateDraft {
  id: string;
  label: string;
  cardWidth: number;
  cardHeight: number;
  cardCoverHeight: number;
  cardBodyPadding: number;
  sheetWidth: number;
  sheetHeight: number;
  sheetCoverWidth: number;
  sheetCoverHeight: number;
  sheetPadding: number;
  sheetGap: number;
  radius: number;
  safeMargin: number;
  titleFont: string;
  bodyFont: string;
  palette: CanvaPalette;
  seals: string[];
  layers: string[];
  notes: string;
  preview: CanvaPreviewFields;
  updatedAt: string;
}

const paletteLabels: Record<keyof CanvaPalette, string> = {
  paper: "Papel",
  surface: "Superficie",
  panel: "Painel",
  ink: "Texto",
  muted: "Texto leve",
  line: "Linha",
  accent: "Acento",
  green: "Verde",
  red: "Carimbo",
  brass: "Dourado",
  coverA: "Capa A",
  coverB: "Capa B",
  chip: "Selo",
};

export function SeasonalDesignLab() {
  const [drafts, setDrafts] = useState<CanvaTemplateDraft[]>(() => loadDrafts());
  const [activeDraftId, setActiveDraftId] = useState(() => drafts[0]?.id ?? "");
  const [newSeal, setNewSeal] = useState("");
  const [newLayer, setNewLayer] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? createDefaultDraft();
  const previewItem = useMemo(() => createPreviewItem(activeDraft), [activeDraft]);
  const previewStyle = useMemo(() => canvaPreviewStyle(activeDraft), [activeDraft]);
  const brief = useMemo(() => buildCanvaBrief(activeDraft), [activeDraft]);

  function persist(nextDrafts: CanvaTemplateDraft[], nextActiveId = activeDraft.id) {
    setDrafts(nextDrafts);
    setActiveDraftId(nextActiveId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrafts));
  }

  function updateDraft(patch: Partial<CanvaTemplateDraft>) {
    const nextDraft = { ...activeDraft, ...patch, updatedAt: new Date().toISOString() };
    persist(drafts.map((draft) => draft.id === activeDraft.id ? nextDraft : draft), nextDraft.id);
  }

  function updatePalette(key: keyof CanvaPalette, value: string) {
    updateDraft({ palette: { ...activeDraft.palette, [key]: value } });
  }

  function updatePreview(patch: Partial<CanvaPreviewFields>) {
    updateDraft({ preview: { ...activeDraft.preview, ...patch } });
  }

  function addDraft() {
    const draft = createDefaultDraft(`canva-ficha-${Date.now()}`);
    persist([draft, ...drafts], draft.id);
  }

  function duplicateDraft() {
    const draft = {
      ...activeDraft,
      id: `${activeDraft.id}-copia-${Date.now()}`,
      label: `${activeDraft.label} copia`,
      updatedAt: new Date().toISOString(),
    };
    persist([draft, ...drafts], draft.id);
  }

  function removeDraft() {
    if (drafts.length <= 1) return;
    const confirmed = window.confirm(`Remover o gabarito "${activeDraft.label}"?`);
    if (!confirmed) return;
    const nextDrafts = drafts.filter((draft) => draft.id !== activeDraft.id);
    persist(nextDrafts, nextDrafts[0]?.id ?? "");
  }

  function addSeal() {
    const value = newSeal.trim();
    if (!value) return;
    updateDraft({ seals: [...activeDraft.seals, value].slice(0, 6) });
    setNewSeal("");
  }

  function addLayer() {
    const value = newLayer.trim();
    if (!value) return;
    updateDraft({ layers: [...activeDraft.layers, value].slice(0, 12) });
    setNewLayer("");
  }

  async function copyBrief() {
    await navigator.clipboard?.writeText(brief).catch(() => undefined);
  }

  async function copyJson() {
    await navigator.clipboard?.writeText(JSON.stringify(activeDraft, null, 2)).catch(() => undefined);
  }

  return (
    <section className="canva-lab" aria-label="Gabarito Canva das fichas">
      <section className="canva-preview-panel" style={previewStyle}>
        <div className="section-heading split">
          <div className="section-heading">
            <Eye size={20} />
            <h3>Ficha isolada para visualização</h3>
          </div>
          <button type="button" className="primary compact" onClick={() => setPreviewOpen(true)}>
            <Eye size={15} />
            Abrir ficha completa
          </button>
        </div>
        <div className="canva-preview-grid">
          <div className="canva-card-stage">
            <div className="canva-measure-label">{activeDraft.cardWidth} x {activeDraft.cardHeight}px</div>
            <div className="canva-card-frame">
              <ItemCard item={previewItem} onOpen={() => setPreviewOpen(true)} seasonalStyle={previewStyle} />
              <TemplateOverlay draft={activeDraft} compact />
            </div>
          </div>
          <article className="canva-sheet-preview">
            <div className="canva-measure-label">{activeDraft.sheetWidth} x {activeDraft.sheetHeight}px</div>
            <div className="canva-sheet-media">
              <div className="canva-cover-placeholder" />
              <span>{activeDraft.seals[0] ?? "Selo"}</span>
            </div>
            <div className="canva-sheet-body">
              <p className="eyebrow">{categoryLabels[previewItem.category]} / modelo interno</p>
              <h3>{activeDraft.preview.title}</h3>
              <div className="detail-summary canva-sheet-summary">
                <span>{previewItem.status}</span>
                <span>{activeDraft.preview.creator}</span>
                <span>{activeDraft.preview.year}</span>
              </div>
              <Stars value={activeDraft.preview.rating} />
              <div className="canva-sheet-details">
                <span><small>Capa</small><strong>{activeDraft.sheetCoverWidth} x {activeDraft.sheetCoverHeight}px</strong></span>
                <span><small>Margem segura</small><strong>{activeDraft.safeMargin}px</strong></span>
                <span><small>Tipografia</small><strong>{activeDraft.titleFont}</strong></span>
                <span><small>Camadas</small><strong>{activeDraft.layers.length} grupos</strong></span>
              </div>
              <div className="canva-seal-list preview">
                {activeDraft.seals.map((seal) => <span key={seal}>{seal}</span>)}
              </div>
            </div>
            <TemplateOverlay draft={activeDraft} />
          </article>
        </div>
      </section>

      <div className="canva-lab-toolbar">
        <label className="canva-model-picker">
          <span>Gabarito</span>
          <select value={activeDraft.id} onChange={(event) => setActiveDraftId(event.target.value)}>
            {drafts.map((draft) => <option value={draft.id} key={draft.id}>{draft.label}</option>)}
          </select>
        </label>
        <div className="button-row">
          <button type="button" className="primary compact" onClick={addDraft}><Plus size={15} /> Novo</button>
          <button type="button" className="ghost compact" onClick={duplicateDraft}><Clipboard size={15} /> Duplicar</button>
          <button type="button" className="ghost compact" onClick={copyJson}><FileJson size={15} /> JSON</button>
          <button type="button" className="ghost compact danger-soft" onClick={removeDraft} disabled={drafts.length <= 1}><Trash2 size={15} /> Remover</button>
        </div>
      </div>

      <section className="canva-export-panel">
        <div className="section-heading">
          <Download size={20} />
          <h3>Arquivos para Canva</h3>
        </div>
        <div className="canva-export-actions">
          <button type="button" className="primary compact" onClick={copyBrief}><Clipboard size={15} /> Copiar briefing</button>
          <button type="button" className="ghost compact" onClick={() => downloadText(`${activeDraft.id}-card.svg`, buildCardSvg(activeDraft))}><Download size={15} /> SVG card</button>
          <button type="button" className="ghost compact" onClick={() => downloadText(`${activeDraft.id}-ficha-interna.svg`, buildSheetSvg(activeDraft))}><Download size={15} /> SVG ficha</button>
        </div>
        <pre className="canva-brief-preview">{brief}</pre>
      </section>

      <div className="canva-lab-grid">
        <section className="canva-editor-panel">
          <div className="section-heading">
            <Ruler size={20} />
            <h3>Medidas</h3>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Nome</span>
              <input value={activeDraft.label} onChange={(event) => updateDraft({ label: event.target.value })} />
            </label>
            <label className="field">
              <span>ID técnico</span>
              <input value={activeDraft.id} onChange={(event) => updateDraft({ id: slugify(event.target.value) })} />
            </label>
          </div>
          <div className="canva-control-grid">
            <NumberField label="Card largura" value={activeDraft.cardWidth} min={210} max={720} onChange={(value) => updateDraft({ cardWidth: value })} />
            <NumberField label="Card altura" value={activeDraft.cardHeight} min={320} max={900} onChange={(value) => updateDraft({ cardHeight: value })} />
            <NumberField label="Capa card" value={activeDraft.cardCoverHeight} min={120} max={520} onChange={(value) => updateDraft({ cardCoverHeight: value })} />
            <NumberField label="Padding card" value={activeDraft.cardBodyPadding} min={8} max={40} onChange={(value) => updateDraft({ cardBodyPadding: value })} />
            <NumberField label="Ficha largura" value={activeDraft.sheetWidth} min={720} max={1600} onChange={(value) => updateDraft({ sheetWidth: value })} />
            <NumberField label="Ficha altura" value={activeDraft.sheetHeight} min={640} max={1800} onChange={(value) => updateDraft({ sheetHeight: value })} />
            <NumberField label="Capa interna L" value={activeDraft.sheetCoverWidth} min={120} max={420} onChange={(value) => updateDraft({ sheetCoverWidth: value })} />
            <NumberField label="Capa interna A" value={activeDraft.sheetCoverHeight} min={180} max={680} onChange={(value) => updateDraft({ sheetCoverHeight: value })} />
            <NumberField label="Padding ficha" value={activeDraft.sheetPadding} min={12} max={80} onChange={(value) => updateDraft({ sheetPadding: value })} />
            <NumberField label="Vão interno" value={activeDraft.sheetGap} min={8} max={64} onChange={(value) => updateDraft({ sheetGap: value })} />
            <NumberField label="Raio" value={activeDraft.radius} min={0} max={24} onChange={(value) => updateDraft({ radius: value })} />
            <NumberField label="Margem segura" value={activeDraft.safeMargin} min={8} max={80} onChange={(value) => updateDraft({ safeMargin: value })} />
          </div>
        </section>

        <section className="canva-editor-panel">
          <div className="section-heading">
            <Palette size={20} />
            <h3>Paleta</h3>
          </div>
          <div className="canva-color-grid">
            {(Object.keys(activeDraft.palette) as Array<keyof CanvaPalette>).map((key) => (
              <ColorField key={key} label={paletteLabels[key]} value={activeDraft.palette[key]} onChange={(value) => updatePalette(key, value)} />
            ))}
          </div>
        </section>

        <section className="canva-editor-panel">
          <div className="section-heading">
            <SlidersHorizontal size={20} />
            <h3>Tipografia e selos</h3>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Fonte título Canva</span>
              <input value={activeDraft.titleFont} onChange={(event) => updateDraft({ titleFont: event.target.value })} />
            </label>
            <label className="field">
              <span>Fonte texto Canva</span>
              <input value={activeDraft.bodyFont} onChange={(event) => updateDraft({ bodyFont: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Notas de edição</span>
              <textarea value={activeDraft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
            </label>
          </div>
          <div className="canva-add-row">
            <input value={newSeal} onChange={(event) => setNewSeal(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? addSeal() : undefined} placeholder="Novo selo" />
            <button type="button" className="primary compact" onClick={addSeal}><Plus size={15} /> Selo</button>
          </div>
          <div className="canva-seal-list">
            {activeDraft.seals.map((seal, index) => (
              <button type="button" key={`${seal}-${index}`} onClick={() => updateDraft({ seals: activeDraft.seals.filter((_, itemIndex) => itemIndex !== index) })}>
                {seal}
                <Trash2 size={12} />
              </button>
            ))}
          </div>
        </section>

        <section className="canva-editor-panel canva-wide-panel">
          <div className="section-heading split">
            <div className="section-heading">
              <Layers3 size={20} />
              <h3>Camadas para montar no Canva</h3>
            </div>
          </div>
          <div className="canva-add-row">
            <input value={newLayer} onChange={(event) => setNewLayer(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? addLayer() : undefined} placeholder="Nova camada ou instrução" />
            <button type="button" className="primary compact" onClick={addLayer}><Plus size={15} /> Camada</button>
          </div>
          <div className="canva-layer-list">
            {activeDraft.layers.map((layer, index) => (
              <article key={`${layer}-${index}`} className="canva-layer-row">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input value={layer} onChange={(event) => updateDraft({ layers: activeDraft.layers.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry) })} />
                <button type="button" className="icon-button" onClick={() => updateDraft({ layers: activeDraft.layers.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Remover camada">
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="canva-editor-panel canva-wide-panel">
          <div className="section-heading">
            <LayoutTemplate size={20} />
            <h3>Ficha-modelo</h3>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Título</span>
              <input value={activeDraft.preview.title} onChange={(event) => updatePreview({ title: event.target.value })} />
            </label>
            <label className="field">
              <span>Autor/criador</span>
              <input value={activeDraft.preview.creator} onChange={(event) => updatePreview({ creator: event.target.value })} />
            </label>
            <label className="field">
              <span>Status</span>
              <input value={activeDraft.preview.status} onChange={(event) => updatePreview({ status: event.target.value })} />
            </label>
            <label className="field">
              <span>Ano</span>
              <input value={activeDraft.preview.year} onChange={(event) => updatePreview({ year: event.target.value })} />
            </label>
            <label className="field">
              <span>Gênero</span>
              <input value={activeDraft.preview.genre} onChange={(event) => updatePreview({ genre: event.target.value })} />
            </label>
            <label className="field">
              <span>Nota</span>
              <select value={activeDraft.preview.rating} onChange={(event) => updatePreview({ rating: Number(event.target.value) as Rating })}>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => <option value={rating} key={rating}>{rating}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Página atual</span>
              <input value={activeDraft.preview.currentPage} onChange={(event) => updatePreview({ currentPage: event.target.value })} />
            </label>
            <label className="field">
              <span>Total páginas</span>
              <input value={activeDraft.preview.pages} onChange={(event) => updatePreview({ pages: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Frase/citação</span>
              <textarea value={activeDraft.preview.quote} onChange={(event) => updatePreview({ quote: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Resumo interno</span>
              <textarea value={activeDraft.preview.summary} onChange={(event) => updatePreview({ summary: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Diário da ficha</span>
              <textarea value={activeDraft.preview.diaryNote} onChange={(event) => updatePreview({ diaryNote: event.target.value })} />
            </label>
          </div>
        </section>
      </div>

      {previewOpen ? (
        <ItemDetails
          item={previewItem}
          statuses={["Quero ler", "Lendo", "Lido", "Abandonado"]}
          seasonalStyle={previewStyle}
          seasonalClassName="canva-template-modal"
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="canva-color-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="canva-number-field">
      <span>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(numberValue(event.target.value, min, max))} />
    </label>
  );
}

function TemplateOverlay({ draft, compact = false }: { draft: CanvaTemplateDraft; compact?: boolean }) {
  return (
    <div className={`canva-template-overlay${compact ? " compact" : ""}`} aria-hidden="true">
      <span className="canva-safe-margin" />
      <div className="canva-template-seals">
        {draft.seals.slice(0, compact ? 3 : 6).map((seal) => <span key={seal}>{seal}</span>)}
      </div>
    </div>
  );
}

function createDefaultDraft(id = "modelo-canva-ficha-gaveteira"): CanvaTemplateDraft {
  const now = new Date().toISOString();
  return {
    id,
    label: "Ficha Gaveteira para Canva",
    cardWidth: 342,
    cardHeight: 520,
    cardCoverHeight: 220,
    cardBodyPadding: 14,
    sheetWidth: 1120,
    sheetHeight: 900,
    sheetCoverWidth: 220,
    sheetCoverHeight: 292,
    sheetPadding: 16,
    sheetGap: 18,
    radius: 8,
    safeMargin: 24,
    titleFont: "Fraunces ou Playfair Display",
    bodyFont: "Inter ou Lato",
    palette: {
      paper: "#fffaf1",
      surface: "#fffdf8",
      panel: "#fff4da",
      ink: "#211d18",
      muted: "#6f6255",
      line: "#d8c7ad",
      accent: "#b88737",
      green: "#346b5d",
      red: "#9f473d",
      brass: "#c38625",
      coverA: "#78644b",
      coverB: "#9f473d",
      chip: "#fff4da",
    },
    seals: ["Gaveteira", "Privado/amigos", "Diário"],
    layers: [
      "01 Fundo: papel #fffaf1 com grade sutil de arquivo.",
      "02 Capa: área em branco; a capa real continua vindo da gaveta.",
      "03 Corpo do card: título, status, ano, visibilidade, gênero, diário e nota.",
      "04 Ficha interna: hero com capa, carimbo de status, título grande e metadados.",
      "05 Blocos internos: detalhes, progresso, links, linha do tempo e diário.",
      "06 Selos: chips pequenos com raio alto e contraste suficiente.",
    ],
    notes: "Use este gabarito como base no Canva. Exporte o resultado final como imagem e aplique pelas gavetas quando quiser trocar capas ou peças visuais.",
    preview: {
      title: "O Atlas das Gavetas",
      creator: "Modelo Admin",
      status: "Lendo",
      year: "2026",
      genre: "Fantasia documental",
      rating: 4.5,
      currentPage: "144",
      pages: "320",
      quote: "Um modelo bom deixa a ficha clara sem esconder o arquivo.",
      summary: "Ficha de referência para montar variações no Canva preservando a estrutura da Gaveteira.",
      diaryNote: "Validar card externo e ficha interna antes de aplicar qualquer imagem final.",
    },
    updatedAt: now,
  };
}

function loadDrafts() {
  if (typeof localStorage === "undefined") return [createDefaultDraft()];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [createDefaultDraft()];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [createDefaultDraft()];
    return parsed.map((draft) => normalizeDraft(draft)) as CanvaTemplateDraft[];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [createDefaultDraft()];
  }
}

function normalizeDraft(draft: Partial<CanvaTemplateDraft>) {
  const defaults = createDefaultDraft();
  return {
    ...defaults,
    ...draft,
    palette: {
      ...defaults.palette,
      ...(draft.palette ?? {}),
    },
    preview: {
      ...defaults.preview,
      ...(draft.preview ?? {}),
    },
    seals: Array.isArray(draft.seals) ? draft.seals : defaults.seals,
    layers: Array.isArray(draft.layers) ? draft.layers : defaults.layers,
  };
}

function createPreviewItem(draft: CanvaTemplateDraft): CulturalItem {
  const now = new Date().toISOString();
  return {
    id: "canva-template-preview-book",
    category: "books",
    title: draft.preview.title,
    author: draft.preview.creator,
    status: draft.preview.status,
    startDate: "2026-01-01",
    endDate: "",
    pages: numberValue(draft.preview.pages, 1, 9999),
    currentPage: numberValue(draft.preview.currentPage, 0, 9999),
    format: "Outro",
    rating: draft.preview.rating,
    genre: draft.preview.genre,
    publisher: "Gaveteira Admin",
    publicationYear: numberValue(draft.preview.year, 0, 9999),
    favoriteQuotes: draft.preview.quote,
    personalSummary: draft.preview.summary,
    finalOpinion: "",
    coverUrl: "",
    visibility: "friends",
    tags: ["modelo", "canva", "admin"],
    links: [{ id: "canva-doc", label: "Gabarito Canva", url: "https://www.canva.com/" }],
    timeline: [
      { id: "canva-start", date: "2026-01-01", type: "Comecei", note: "Modelo criado para edição no Canva." },
      { id: "canva-review", date: now.slice(0, 10), type: "Outro", note: "Revisar proporção, paleta e camadas." },
    ],
    diary: [
      { id: "canva-diary-1", date: now.slice(0, 10), type: "Progresso", visibility: "friends", text: draft.notes },
      { id: "canva-diary-2", date: now.slice(0, 10), type: "Progresso", visibility: "private", text: draft.preview.diaryNote },
    ],
    seasonalTheme: {
      id: draft.id,
      label: draft.label,
      assignedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function canvaPreviewStyle(draft: CanvaTemplateDraft) {
  const palette = draft.palette;
  return {
    "--card-bg": palette.paper,
    "--card-body-bg": palette.surface,
    "--card-text": palette.ink,
    "--card-title": palette.ink,
    "--card-muted": palette.muted,
    "--card-border": palette.line,
    "--card-accent": palette.accent,
    "--card-kicker": palette.green,
    "--card-tag-bg": palette.chip,
    "--card-cover-a": palette.coverA,
    "--card-cover-b": palette.coverB,
    "--card-open-bg": palette.green,
    "--sheet-bg": palette.paper,
    "--sheet-panel": palette.surface,
    "--sheet-text": palette.ink,
    "--sheet-title": palette.ink,
    "--sheet-muted": palette.muted,
    "--sheet-border": palette.line,
    "--sheet-section-bg": palette.panel,
    "--sheet-accent": palette.accent,
    "--sheet-warning": palette.red,
    "--sheet-chip-bg": palette.chip,
    "--sheet-cover-a": palette.coverA,
    "--sheet-cover-b": palette.coverB,
    "--lab-detail-image": "none",
    "--lab-sheet-image-opacity": 0,
    "--lab-sheet-cover-width": `${draft.sheetCoverWidth}px`,
    "--lab-sheet-panel-bg": palette.surface,
    "--lab-sheet-title-scale": 1,
    "--lab-sheet-density": 1,
    "--lab-radius": `${draft.radius}px`,
    "--canva-card-width": `${draft.cardWidth}px`,
    "--canva-card-height": `${draft.cardHeight}px`,
    "--canva-card-cover-height": `${draft.cardCoverHeight}px`,
    "--canva-card-body-padding": `${draft.cardBodyPadding}px`,
    "--canva-sheet-height": `${draft.sheetHeight}px`,
    "--canva-sheet-cover-height": `${draft.sheetCoverHeight}px`,
    "--canva-sheet-padding": `${draft.sheetPadding}px`,
    "--canva-sheet-gap": `${draft.sheetGap}px`,
    "--canva-safe-margin": `${draft.safeMargin}px`,
  } as CSSProperties;
}

function buildCanvaBrief(draft: CanvaTemplateDraft) {
  const palette = Object.entries(draft.palette)
    .map(([key, value]) => `${paletteLabels[key as keyof CanvaPalette]}: ${value}`)
    .join("\n");
  const layers = draft.layers.map((layer) => `- ${layer}`).join("\n");
  const seals = draft.seals.join(", ");

  return [
    `Gabarito Canva: ${draft.label}`,
    "",
    "CARD EXTERNO",
    `Tamanho: ${draft.cardWidth} x ${draft.cardHeight}px`,
    `Capa em branco: ${draft.cardWidth} x ${draft.cardCoverHeight}px`,
    `Corpo: padding ${draft.cardBodyPadding}px, raio ${draft.radius}px`,
    "",
    "FICHA INTERNA",
    `Tamanho: ${draft.sheetWidth} x ${draft.sheetHeight}px`,
    `Capa interna: ${draft.sheetCoverWidth} x ${draft.sheetCoverHeight}px`,
    `Padding: ${draft.sheetPadding}px; vão entre capa e conteúdo: ${draft.sheetGap}px`,
    `Margem segura: ${draft.safeMargin}px`,
    "",
    "TIPOGRAFIA",
    `Título: ${draft.titleFont}`,
    `Texto: ${draft.bodyFont}`,
    "",
    "PALETA",
    palette,
    "",
    "SELOS",
    seals || "Sem selos",
    "",
    "CAMADAS",
    layers,
    "",
    "NOTAS",
    draft.notes,
  ].join("\n");
}

function buildCardSvg(draft: CanvaTemplateDraft) {
  const p = draft.palette;
  const bodyY = draft.cardCoverHeight;
  const bodyHeight = Math.max(0, draft.cardHeight - draft.cardCoverHeight);
  const titleY = bodyY + draft.cardBodyPadding + 46;
  return svgDoc(draft.cardWidth, draft.cardHeight, `
    <rect id="fundo-card" width="100%" height="100%" rx="${draft.radius}" fill="${p.paper}" stroke="${p.line}" />
    <rect id="capa-em-branco" x="0" y="0" width="${draft.cardWidth}" height="${draft.cardCoverHeight}" fill="${p.surface}" stroke="${p.line}" stroke-dasharray="10 8" />
    <rect id="corpo-card" x="0" y="${bodyY}" width="${draft.cardWidth}" height="${bodyHeight}" fill="${p.surface}" />
    <text id="status-ano" x="${draft.cardBodyPadding}" y="${bodyY + draft.cardBodyPadding + 14}" fill="${p.muted}" font-size="14" font-family="${escapeXml(draft.bodyFont)}">${escapeXml(draft.preview.status)} / ${escapeXml(draft.preview.year)}</text>
    <text id="titulo-card" x="${draft.cardBodyPadding}" y="${titleY}" fill="${p.ink}" font-size="28" font-weight="700" font-family="${escapeXml(draft.titleFont)}">${escapeXml(draft.preview.title)}</text>
    <text id="genero-card" x="${draft.cardBodyPadding}" y="${titleY + 34}" fill="${p.muted}" font-size="17" font-family="${escapeXml(draft.bodyFont)}">${escapeXml(draft.preview.genre)}</text>
    <rect id="selo-visibilidade" x="${draft.cardBodyPadding}" y="${titleY + 60}" width="112" height="30" rx="15" fill="${p.chip}" stroke="${p.line}" />
    <text x="${draft.cardBodyPadding + 14}" y="${titleY + 80}" fill="${p.green}" font-size="12" font-weight="700" font-family="${escapeXml(draft.bodyFont)}">AMIGOS</text>
    <text id="nota" x="${draft.cardBodyPadding}" y="${draft.cardHeight - draft.cardBodyPadding - 16}" fill="${p.brass}" font-size="20" font-family="${escapeXml(draft.bodyFont)}">Nota ${draft.preview.rating}/5</text>
  `);
}

function buildSheetSvg(draft: CanvaTemplateDraft) {
  const p = draft.palette;
  const contentX = draft.sheetPadding + draft.sheetCoverWidth + draft.sheetGap;
  const contentWidth = draft.sheetWidth - contentX - draft.sheetPadding;
  return svgDoc(draft.sheetWidth, draft.sheetHeight, `
    <rect id="fundo-ficha" width="100%" height="100%" rx="${draft.radius}" fill="${p.paper}" stroke="${p.line}" />
    <rect id="margem-segura" x="${draft.safeMargin}" y="${draft.safeMargin}" width="${draft.sheetWidth - draft.safeMargin * 2}" height="${draft.sheetHeight - draft.safeMargin * 2}" fill="none" stroke="${p.accent}" stroke-dasharray="12 10" opacity="0.55" />
    <rect id="capa-em-branco" x="${draft.sheetPadding}" y="${draft.sheetPadding}" width="${draft.sheetCoverWidth}" height="${draft.sheetCoverHeight}" rx="${draft.radius}" fill="${p.surface}" stroke="${p.line}" stroke-dasharray="10 8" />
    <rect id="carimbo-status" x="${contentX}" y="${draft.sheetPadding}" width="124" height="34" rx="4" fill="${p.red}" />
    <text x="${contentX + 13}" y="${draft.sheetPadding + 23}" fill="#fffaf1" font-size="13" font-weight="700" font-family="${escapeXml(draft.bodyFont)}">${escapeXml(draft.preview.status.toUpperCase())}</text>
    <text id="titulo-ficha" x="${contentX}" y="${draft.sheetPadding + 96}" fill="${p.ink}" font-size="54" font-weight="700" font-family="${escapeXml(draft.titleFont)}">${escapeXml(draft.preview.title)}</text>
    <text id="metadados" x="${contentX}" y="${draft.sheetPadding + 136}" fill="${p.muted}" font-size="20" font-family="${escapeXml(draft.bodyFont)}">${escapeXml(draft.preview.creator)} / ${escapeXml(draft.preview.year)} / ${escapeXml(draft.preview.genre)}</text>
    <rect id="painel-resumo" x="${contentX}" y="${draft.sheetPadding + 172}" width="${contentWidth}" height="150" rx="${draft.radius}" fill="${p.surface}" stroke="${p.line}" />
    <text x="${contentX + 18}" y="${draft.sheetPadding + 214}" fill="${p.ink}" font-size="24" font-weight="700" font-family="${escapeXml(draft.titleFont)}">Resumo interno</text>
    <text x="${contentX + 18}" y="${draft.sheetPadding + 252}" fill="${p.muted}" font-size="18" font-family="${escapeXml(draft.bodyFont)}">${escapeXml(draft.preview.summary)}</text>
    <rect id="painel-diario" x="${draft.sheetPadding}" y="${draft.sheetPadding + draft.sheetCoverHeight + draft.sheetGap}" width="${draft.sheetWidth - draft.sheetPadding * 2}" height="180" rx="${draft.radius}" fill="${p.panel}" stroke="${p.line}" />
    <text x="${draft.sheetPadding + 18}" y="${draft.sheetPadding + draft.sheetCoverHeight + draft.sheetGap + 44}" fill="${p.ink}" font-size="24" font-weight="700" font-family="${escapeXml(draft.titleFont)}">Diário e linha do tempo</text>
  `);
}

function svgDoc(width: number, height: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${body}</svg>`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "modelo-canva-ficha";
}

function numberValue(value: string | number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
