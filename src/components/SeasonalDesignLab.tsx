import type { CSSProperties } from "react";
import { CalendarDays, Copy, Eye, ImagePlus, Layers3, LayoutTemplate, Palette, Plus, Save, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CulturalItem, Rating } from "../types";
import { categoryLabels } from "../data/catalog";
import { Cover } from "./Cover";
import { ItemCard } from "./ItemCard";
import { ItemDetails } from "./ItemDetails";
import { Stars } from "./Rating";

const STORAGE_KEY = "gaveteira-seasonal-design-lab:v1";

type SeasonalDraftState = "draft" | "ready" | "retired";
type SeasonalPattern = "pitch" | "rays" | "paper";
type SeasonalSheetLayout = "split" | "poster" | "editorial";
type SeasonalSealPlacement = "bottom-left" | "bottom-right" | "top-left" | "top-right";

interface SeasonalDesignDetail {
  id: string;
  label: string;
  value: string;
}

interface SeasonalPreviewFields {
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

interface SeasonalDesignDraft {
  id: string;
  label: string;
  themeLine: string;
  startsAt: string;
  endsAt: string;
  state: SeasonalDraftState;
  cardBackground: string;
  sheetBackground: string;
  accentColor: string;
  secondaryColor: string;
  titleColor: string;
  mutedColor: string;
  cardTitleColor: string;
  cardTextColor: string;
  sheetTextColor: string;
  sheetPanelColor: string;
  coverStart: string;
  coverEnd: string;
  badgeLabel: string;
  imageUrl: string;
  detailImageUrl: string;
  pattern: SeasonalPattern;
  sheetLayout: SeasonalSheetLayout;
  sealPlacement: SeasonalSealPlacement;
  cardImageOpacity: number;
  cardImageSize: number;
  cardImagePositionX: number;
  cardImagePositionY: number;
  cardOrnamentSize: number;
  cardBodyContrast: number;
  sheetImageOpacity: number;
  sheetImageSize: number;
  sheetImagePositionX: number;
  sheetImagePositionY: number;
  sheetCoverWidth: number;
  sheetPanelOpacity: number;
  sheetTitleScale: number;
  sheetDetailDensity: number;
  cornerRadius: number;
  seals: string[];
  details: SeasonalDesignDetail[];
  notes: string;
  preview: SeasonalPreviewFields;
  updatedAt: string;
}

const stateLabels: Record<SeasonalDraftState, string> = {
  draft: "Rascunho",
  ready: "Pronto local",
  retired: "Fora de linha",
};

const patternLabels: Record<SeasonalPattern, string> = {
  pitch: "Campo",
  rays: "Raios",
  paper: "Arquivo",
};

const sheetLayoutLabels: Record<SeasonalSheetLayout, string> = {
  split: "Capa lateral",
  poster: "Poster",
  editorial: "Editorial",
};

const sealPlacementLabels: Record<SeasonalSealPlacement, string> = {
  "bottom-left": "Baixo esquerda",
  "bottom-right": "Baixo direita",
  "top-left": "Topo esquerda",
  "top-right": "Topo direita",
};

export function SeasonalDesignLab() {
  const [drafts, setDrafts] = useState<SeasonalDesignDraft[]>(() => loadDrafts());
  const [activeDraftId, setActiveDraftId] = useState(() => drafts[0]?.id ?? "");
  const [newSeal, setNewSeal] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) ?? drafts[0] ?? createDefaultDraft();
  const previewItem = useMemo(() => createPreviewItem(activeDraft), [activeDraft]);
  const previewStyle = useMemo(() => seasonalStyle(activeDraft), [activeDraft]);
  const status = scheduleStatus(activeDraft);

  function persist(nextDrafts: SeasonalDesignDraft[], nextActiveId = activeDraft.id) {
    setDrafts(nextDrafts);
    setActiveDraftId(nextActiveId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrafts));
  }

  function updateDraft(patch: Partial<SeasonalDesignDraft>) {
    const nextDraft = { ...activeDraft, ...patch, updatedAt: new Date().toISOString() };
    persist(drafts.map((draft) => draft.id === activeDraft.id ? nextDraft : draft), nextDraft.id);
  }

  function addDraft() {
    const draft = createDefaultDraft(`seasonal-${Date.now()}`);
    persist([draft, ...drafts], draft.id);
  }

  function duplicateDraft() {
    const draft = {
      ...activeDraft,
      id: `${activeDraft.id}-copia-${Date.now()}`,
      label: `${activeDraft.label} copia`,
      state: "draft" as const,
      updatedAt: new Date().toISOString(),
    };
    persist([draft, ...drafts], draft.id);
  }

  function removeDraft() {
    if (drafts.length <= 1) return;
    const confirmed = window.confirm(`Remover o modelo "${activeDraft.label}" deste laboratorio?`);
    if (!confirmed) return;
    const nextDrafts = drafts.filter((draft) => draft.id !== activeDraft.id);
    persist(nextDrafts, nextDrafts[0]?.id ?? "");
  }

  function addSeal() {
    const value = newSeal.trim();
    if (!value) return;
    updateDraft({ seals: [...activeDraft.seals, value].slice(0, 5) });
    setNewSeal("");
  }

  function updateDetail(id: string, patch: Partial<SeasonalDesignDetail>) {
    updateDraft({
      details: activeDraft.details.map((detail) => detail.id === id ? { ...detail, ...patch } : detail),
    });
  }

  function updatePreview(patch: Partial<SeasonalPreviewFields>) {
    updateDraft({ preview: { ...activeDraft.preview, ...patch } });
  }

  function addDetail() {
    updateDraft({
      details: [
        ...activeDraft.details,
        { id: `detail-${Date.now()}`, label: "Detalhe", value: "Novo elemento" },
      ].slice(0, 8),
    });
  }

  async function copyJson() {
    const payload = JSON.stringify(activeDraft, null, 2);
    await navigator.clipboard?.writeText(payload).catch(() => undefined);
  }

  async function uploadImage(file: File | undefined, target: "imageUrl" | "detailImageUrl") {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    updateDraft({ [target]: dataUrl } as Pick<SeasonalDesignDraft, typeof target>);
  }

  return (
    <section className="seasonal-lab" aria-label="Laboratorio sazonal de fichas">
      <section className={`seasonal-preview-panel pattern-${activeDraft.pattern}`} style={previewStyle}>
        <div className="section-heading split">
          <div className="section-heading">
            <Eye size={20} />
            <h3>Ficha isolada</h3>
          </div>
          <button type="button" className="primary compact" onClick={() => setPreviewOpen(true)}>
            <Sparkles size={15} />
            Abrir ficha completa
          </button>
        </div>
        <div className="seasonal-preview-grid">
          <div className="seasonal-card-stage">
            <div className="seasonal-card-frame">
              <ItemCard item={previewItem} onOpen={() => setPreviewOpen(true)} seasonalStyle={previewStyle} />
              <SeasonalOverlay draft={activeDraft} compact placement={activeDraft.sealPlacement} />
            </div>
          </div>
          <article className={`seasonal-sheet-preview season-theme season-theme-${slugify(activeDraft.id)} sheet-layout-${activeDraft.sheetLayout} seal-placement-${activeDraft.sealPlacement}`}>
            <div className="seasonal-sheet-media">
              <Cover item={previewItem} />
              <span>{activeDraft.badgeLabel}</span>
            </div>
            <div className="seasonal-sheet-body">
              <p className="eyebrow">{categoryLabels[previewItem.category]} / modelo original</p>
              <h3>{activeDraft.preview.title}</h3>
              <div className="detail-summary seasonal-sheet-summary">
                <span>{previewItem.status}</span>
                <span>{activeDraft.preview.creator}</span>
                <span>{activeDraft.preview.year}</span>
              </div>
              <Stars value={activeDraft.preview.rating} />
              <div className="seasonal-sheet-details">
                {activeDraft.details.map((detail) => (
                  <span key={detail.id}>
                    <small>{detail.label}</small>
                    <strong>{detail.value}</strong>
                  </span>
                ))}
              </div>
              <div className="seasonal-seal-list preview">
                {activeDraft.seals.map((seal) => <span key={seal}>{seal}</span>)}
              </div>
            </div>
            <SeasonalOverlay draft={activeDraft} placement={activeDraft.sealPlacement} />
          </article>
        </div>
      </section>

      <div className="seasonal-lab-hero">
        <div>
          <p className="eyebrow">Experimento admin</p>
          <h2>Design sazonal das fichas</h2>
          <p>Modelos locais para campanhas, com datas de funcionamento, selos, imagens e previsualizacao da ficha antes de qualquer publicacao.</p>
        </div>
        <div className="seasonal-lab-status">
          <span>{stateLabels[activeDraft.state]}</span>
          <strong>{status.label}</strong>
          <small>{status.detail}</small>
        </div>
      </div>

      <div className="seasonal-lab-toolbar">
        <label className="seasonal-model-picker">
          <span>Modelo</span>
          <select value={activeDraft.id} onChange={(event) => setActiveDraftId(event.target.value)}>
            {drafts.map((draft) => <option value={draft.id} key={draft.id}>{draft.label}</option>)}
          </select>
        </label>
        <div className="button-row">
          <button type="button" className="primary compact" onClick={addDraft}><Plus size={15} /> Novo</button>
          <button type="button" className="ghost compact" onClick={duplicateDraft}><Copy size={15} /> Duplicar</button>
          <button type="button" className="ghost compact" onClick={copyJson}><Save size={15} /> JSON</button>
          <button type="button" className="ghost compact danger-soft" onClick={removeDraft} disabled={drafts.length <= 1}><Trash2 size={15} /> Remover</button>
        </div>
      </div>

      <div className="seasonal-lab-grid">
        <section className="seasonal-editor-panel">
          <div className="section-heading">
            <Palette size={20} />
            <h3>Modelo</h3>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Nome</span>
              <input value={activeDraft.label} onChange={(event) => updateDraft({ label: event.target.value })} />
            </label>
            <label className="field">
              <span>ID tecnico</span>
              <input value={activeDraft.id} onChange={(event) => updateDraft({ id: slugify(event.target.value) })} />
            </label>
            <label className="field wide">
              <span>Linha visual</span>
              <input value={activeDraft.themeLine} onChange={(event) => updateDraft({ themeLine: event.target.value })} />
            </label>
            <label className="field">
              <span>Inicio</span>
              <input type="date" value={activeDraft.startsAt} onChange={(event) => updateDraft({ startsAt: event.target.value })} />
            </label>
            <label className="field">
              <span>Saida de linha</span>
              <input type="date" value={activeDraft.endsAt} onChange={(event) => updateDraft({ endsAt: event.target.value })} />
            </label>
            <label className="field">
              <span>Estado</span>
              <select value={activeDraft.state} onChange={(event) => updateDraft({ state: event.target.value as SeasonalDraftState })}>
                {Object.entries(stateLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Padrao</span>
              <select value={activeDraft.pattern} onChange={(event) => updateDraft({ pattern: event.target.value as SeasonalPattern })}>
                {Object.entries(patternLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Cantos</span>
              <input type="number" min="0" max="16" value={activeDraft.cornerRadius} onChange={(event) => updateDraft({ cornerRadius: numberValue(event.target.value, 0, 16) })} />
            </label>
          </div>

          <div className="seasonal-color-grid">
            <ColorField label="Card" value={activeDraft.cardBackground} onChange={(value) => updateDraft({ cardBackground: value })} />
            <ColorField label="Ficha" value={activeDraft.sheetBackground} onChange={(value) => updateDraft({ sheetBackground: value })} />
            <ColorField label="Acento" value={activeDraft.accentColor} onChange={(value) => updateDraft({ accentColor: value })} />
            <ColorField label="Secundaria" value={activeDraft.secondaryColor} onChange={(value) => updateDraft({ secondaryColor: value })} />
            <ColorField label="Titulo ficha" value={activeDraft.titleColor} onChange={(value) => updateDraft({ titleColor: value })} />
            <ColorField label="Texto leve" value={activeDraft.mutedColor} onChange={(value) => updateDraft({ mutedColor: value })} />
            <ColorField label="Titulo card" value={activeDraft.cardTitleColor} onChange={(value) => updateDraft({ cardTitleColor: value })} />
            <ColorField label="Texto card" value={activeDraft.cardTextColor} onChange={(value) => updateDraft({ cardTextColor: value })} />
            <ColorField label="Texto ficha" value={activeDraft.sheetTextColor} onChange={(value) => updateDraft({ sheetTextColor: value })} />
            <ColorField label="Painel ficha" value={activeDraft.sheetPanelColor} onChange={(value) => updateDraft({ sheetPanelColor: value })} />
          </div>
        </section>

        <section className="seasonal-editor-panel">
          <div className="section-heading">
            <ImagePlus size={20} />
            <h3>Imagens e selos</h3>
          </div>
          <div className="form-grid">
            <label className="field wide">
              <span>Imagem decorativa do card</span>
              <input value={activeDraft.imageUrl} onChange={(event) => updateDraft({ imageUrl: event.target.value })} placeholder="/seasonal-elements/..." />
            </label>
            <label className="field wide seasonal-file-field">
              <span>Enviar decoracao do card</span>
              <input type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0], "imageUrl")} />
            </label>
            <label className="field wide">
              <span>Imagem da ficha</span>
              <input value={activeDraft.detailImageUrl} onChange={(event) => updateDraft({ detailImageUrl: event.target.value })} placeholder="/seasonal-elements/..." />
            </label>
            <label className="field wide seasonal-file-field">
              <span>Enviar imagem da ficha</span>
              <input type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0], "detailImageUrl")} />
            </label>
            <label className="field">
              <span>Selo principal</span>
              <input value={activeDraft.badgeLabel} onChange={(event) => updateDraft({ badgeLabel: event.target.value })} />
            </label>
          </div>
          <div className="seasonal-seal-editor">
            <div className="seasonal-add-row">
              <input value={newSeal} onChange={(event) => setNewSeal(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? addSeal() : undefined} placeholder="Novo selo" />
              <button type="button" className="primary compact" onClick={addSeal}><Plus size={15} /> Selo</button>
            </div>
            <div className="seasonal-seal-list">
              {activeDraft.seals.map((seal, index) => (
                <button type="button" key={`${seal}-${index}`} onClick={() => updateDraft({ seals: activeDraft.seals.filter((_, itemIndex) => itemIndex !== index) })}>
                  {seal}
                  <Trash2 size={12} />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="seasonal-editor-panel">
          <div className="section-heading">
            <SlidersHorizontal size={20} />
            <h3>Card</h3>
          </div>
          <div className="seasonal-control-grid">
            <RangeField label="Decoracao" value={activeDraft.cardImageOpacity} min={0} max={1} step={0.05} suffix="opacidade" onChange={(value) => updateDraft({ cardImageOpacity: value })} />
            <RangeField label="Tam. decor." value={activeDraft.cardImageSize} min={70} max={180} step={5} suffix="%" onChange={(value) => updateDraft({ cardImageSize: value })} />
            <RangeField label="Decor. X" value={activeDraft.cardImagePositionX} min={0} max={100} step={1} suffix="%" onChange={(value) => updateDraft({ cardImagePositionX: value })} />
            <RangeField label="Decor. Y" value={activeDraft.cardImagePositionY} min={0} max={100} step={1} suffix="%" onChange={(value) => updateDraft({ cardImagePositionY: value })} />
            <RangeField label="Ornamento" value={activeDraft.cardOrnamentSize} min={32} max={120} step={2} suffix="px" onChange={(value) => updateDraft({ cardOrnamentSize: value })} />
            <RangeField label="Contraste" value={activeDraft.cardBodyContrast} min={0.2} max={0.95} step={0.05} suffix="" onChange={(value) => updateDraft({ cardBodyContrast: value })} />
          </div>
          <label className="field">
            <span>Posicao dos selos</span>
            <select value={activeDraft.sealPlacement} onChange={(event) => updateDraft({ sealPlacement: event.target.value as SeasonalSealPlacement })}>
              {Object.entries(sealPlacementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </section>

        <section className="seasonal-editor-panel">
          <div className="section-heading">
            <LayoutTemplate size={20} />
            <h3>Interior da ficha</h3>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Layout interno</span>
              <select value={activeDraft.sheetLayout} onChange={(event) => updateDraft({ sheetLayout: event.target.value as SeasonalSheetLayout })}>
                {Object.entries(sheetLayoutLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Selos internos</span>
              <select value={activeDraft.sealPlacement} onChange={(event) => updateDraft({ sealPlacement: event.target.value as SeasonalSealPlacement })}>
                {Object.entries(sealPlacementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <div className="seasonal-control-grid">
            <RangeField label="Fundo" value={activeDraft.sheetImageOpacity} min={0} max={1} step={0.05} suffix="opacidade" onChange={(value) => updateDraft({ sheetImageOpacity: value })} />
            <RangeField label="Tamanho fundo" value={activeDraft.sheetImageSize} min={80} max={180} step={5} suffix="%" onChange={(value) => updateDraft({ sheetImageSize: value })} />
            <RangeField label="Fundo X" value={activeDraft.sheetImagePositionX} min={0} max={100} step={1} suffix="%" onChange={(value) => updateDraft({ sheetImagePositionX: value })} />
            <RangeField label="Fundo Y" value={activeDraft.sheetImagePositionY} min={0} max={100} step={1} suffix="%" onChange={(value) => updateDraft({ sheetImagePositionY: value })} />
            <RangeField label="Capa" value={activeDraft.sheetCoverWidth} min={120} max={260} step={5} suffix="px" onChange={(value) => updateDraft({ sheetCoverWidth: value })} />
            <RangeField label="Painel" value={activeDraft.sheetPanelOpacity} min={0.35} max={1} step={0.05} suffix="opacidade" onChange={(value) => updateDraft({ sheetPanelOpacity: value })} />
            <RangeField label="Titulo" value={activeDraft.sheetTitleScale} min={0.8} max={1.35} step={0.05} suffix="escala" onChange={(value) => updateDraft({ sheetTitleScale: value })} />
            <RangeField label="Densidade" value={activeDraft.sheetDetailDensity} min={0.75} max={1.35} step={0.05} suffix="espaco" onChange={(value) => updateDraft({ sheetDetailDensity: value })} />
          </div>
        </section>

        <section className="seasonal-editor-panel seasonal-detail-editor">
          <div className="section-heading split">
            <div className="section-heading">
              <Layers3 size={20} />
              <h3>Detalhes</h3>
            </div>
            <button type="button" className="ghost compact" onClick={addDetail}><Plus size={15} /> Detalhe</button>
          </div>
          <div className="seasonal-detail-list">
            {activeDraft.details.map((detail) => (
              <article key={detail.id} className="seasonal-detail-row">
                <input value={detail.label} onChange={(event) => updateDetail(detail.id, { label: event.target.value })} />
                <input value={detail.value} onChange={(event) => updateDetail(detail.id, { value: event.target.value })} />
                <button type="button" className="icon-button" onClick={() => updateDraft({ details: activeDraft.details.filter((entry) => entry.id !== detail.id) })} aria-label="Remover detalhe">
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
          <label className="field wide">
            <span>Notas internas</span>
            <textarea value={activeDraft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
          </label>
        </section>

        <section className="seasonal-editor-panel seasonal-detail-editor">
          <div className="section-heading">
            <CalendarDays size={20} />
            <h3>Ficha-modelo</h3>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Titulo</span>
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
              <span>Genero</span>
              <input value={activeDraft.preview.genre} onChange={(event) => updatePreview({ genre: event.target.value })} />
            </label>
            <label className="field">
              <span>Nota</span>
              <select value={activeDraft.preview.rating} onChange={(event) => updatePreview({ rating: Number(event.target.value) as Rating })}>
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => <option value={rating} key={rating}>{rating}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Pagina atual</span>
              <input value={activeDraft.preview.currentPage} onChange={(event) => updatePreview({ currentPage: event.target.value })} />
            </label>
            <label className="field">
              <span>Total paginas</span>
              <input value={activeDraft.preview.pages} onChange={(event) => updatePreview({ pages: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Frase/citacao</span>
              <textarea value={activeDraft.preview.quote} onChange={(event) => updatePreview({ quote: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Resumo interno</span>
              <textarea value={activeDraft.preview.summary} onChange={(event) => updatePreview({ summary: event.target.value })} />
            </label>
            <label className="field wide">
              <span>Diario da ficha</span>
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
          seasonalClassName={`sheet-layout-${activeDraft.sheetLayout} seal-placement-${activeDraft.sealPlacement} pattern-${activeDraft.pattern}`}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="seasonal-color-field">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="seasonal-range-field">
      <span>
        {label}
        <strong>{formatControlValue(value, suffix)}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SeasonalOverlay({ draft, compact = false, placement }: { draft: SeasonalDesignDraft; compact?: boolean; placement?: SeasonalSealPlacement }) {
  return (
    <div className={`seasonal-overlay${compact ? " compact" : ""} seal-placement-${placement ?? draft.sealPlacement}`} aria-hidden="true">
      <div className="seasonal-overlay-image" />
      <div className="seasonal-overlay-seals">
        {[draft.badgeLabel, ...draft.seals].filter(Boolean).slice(0, compact ? 3 : 5).map((seal) => <span key={seal}>{seal}</span>)}
      </div>
    </div>
  );
}

function createDefaultDraft(id = "copa-do-mundo-2026-lab"): SeasonalDesignDraft {
  const now = new Date().toISOString();
  return {
    id,
    label: "Copa do Mundo 2026",
    themeLine: "Arquivo esportivo, campo vivo e selos de campanha.",
    startsAt: "2026-06-14",
    endsAt: "2026-07-20",
    state: "draft",
    cardBackground: "#1f6fb2",
    sheetBackground: "#fff8d8",
    accentColor: "#f2c94c",
    secondaryColor: "#188a4a",
    titleColor: "#174a2e",
    mutedColor: "#68684f",
    cardTitleColor: "#fffdf2",
    cardTextColor: "#fff1a8",
    sheetTextColor: "#20231a",
    sheetPanelColor: "#fffdf2",
    coverStart: "#1f6fb2",
    coverEnd: "#188a4a",
    badgeLabel: "Edicao limitada",
    imageUrl: "/seasonal-elements/promocoes/copa-do-mundo-2026/elementos/soccer-ball-svgrepo-com.svg",
    detailImageUrl: "/seasonal-elements/promocoes/copa-do-mundo-2026/elementos/campo-de-futebol.jpg",
    pattern: "pitch",
    sheetLayout: "split",
    sealPlacement: "bottom-left",
    cardImageOpacity: 0.78,
    cardImageSize: 110,
    cardImagePositionX: 50,
    cardImagePositionY: 68,
    cardOrnamentSize: 64,
    cardBodyContrast: 0.74,
    sheetImageOpacity: 0.36,
    sheetImageSize: 110,
    sheetImagePositionX: 50,
    sheetImagePositionY: 30,
    sheetCoverWidth: 180,
    sheetPanelOpacity: 0.86,
    sheetTitleScale: 1,
    sheetDetailDensity: 1,
    cornerRadius: 8,
    seals: ["Campanha 2026", "Ativo por periodo", "Nao publicado"],
    details: [
      { id: "detail-card", label: "Card", value: "decoracao sazonal; capa vem da gaveta" },
      { id: "detail-sheet", label: "Ficha", value: "folha clara com fundo de estadio" },
      { id: "detail-exit", label: "Saida", value: "retirar apos a final" },
    ],
    notes: "Rascunho local para avaliar card e ficha completa antes de registrar como tema sazonal.",
    preview: {
      title: "O Atlas das Gavetas",
      creator: "Modelo Admin",
      status: "Lendo",
      year: "2026",
      genre: "Fantasia documental",
      rating: 4.5,
      currentPage: "144",
      pages: "320",
      quote: "Um modelo bom faz a ficha respirar sem esconder o arquivo.",
      summary: "Arquivo esportivo, campo vivo e selos de campanha.",
      diaryNote: "Validar card, ficha completa, imagens e selos antes da publicacao.",
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
    return parsed.map((draft) => normalizeDraft(draft)) as SeasonalDesignDraft[];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [createDefaultDraft()];
  }
}

function normalizeDraft(draft: Partial<SeasonalDesignDraft>) {
  const defaults = createDefaultDraft();
  return {
    ...defaults,
    ...draft,
    preview: {
      ...defaults.preview,
      ...(draft.preview ?? {}),
    },
    details: Array.isArray(draft.details) ? draft.details : defaults.details,
    seals: Array.isArray(draft.seals) ? draft.seals : defaults.seals,
  };
}

function createPreviewItem(draft: SeasonalDesignDraft): CulturalItem {
  const now = new Date().toISOString();
  return {
    id: "seasonal-design-preview-book",
    category: "books",
    title: draft.preview.title,
    author: draft.preview.creator,
    status: draft.preview.status,
    startDate: draft.startsAt,
    endDate: draft.endsAt,
    pages: numberValue(draft.preview.pages, 1, 9999),
    currentPage: numberValue(draft.preview.currentPage, 0, 9999),
    format: "Outro",
    rating: draft.preview.rating,
    genre: draft.preview.genre,
    publisher: "Gaveteira Experiments",
    publicationYear: numberValue(draft.preview.year, 0, 9999),
    favoriteQuotes: draft.preview.quote,
    personalSummary: draft.preview.summary || draft.themeLine,
    finalOpinion: "",
    coverUrl: "",
    visibility: "friends",
    tags: ["modelo", "sazonal", "admin"],
    links: [{ id: "seasonal-doc", label: "Especificacao local", url: "/seasonal-elements/promocoes/_modelo/" }],
    timeline: [
      { id: "seasonal-start", date: draft.startsAt, type: "Comecei", note: "Entrada programada do modelo." },
      { id: "seasonal-end", date: draft.endsAt, type: "Outro", note: "Saida de linha prevista." },
    ],
    diary: [
      { id: "seasonal-diary-1", date: draft.startsAt, type: "Progresso", visibility: "friends", text: draft.notes },
      { id: "seasonal-diary-2", date: draft.endsAt, type: "Progresso", visibility: "private", text: draft.preview.diaryNote },
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

function seasonalStyle(draft: SeasonalDesignDraft) {
  return {
    "--card-bg": draft.cardBackground,
    "--card-body-bg": draft.secondaryColor,
    "--card-text": draft.cardTextColor,
    "--card-title": draft.cardTitleColor,
    "--card-muted": draft.cardTextColor,
    "--card-border": draft.accentColor,
    "--card-accent": draft.accentColor,
    "--card-kicker": draft.accentColor,
    "--card-tag-bg": colorMix(draft.sheetBackground, "#ffffff", 0.78),
    "--card-cover-a": draft.coverStart,
    "--card-cover-b": draft.coverEnd,
    "--card-open-bg": draft.accentColor,
    "--sheet-bg": draft.sheetBackground,
    "--sheet-panel": draft.sheetPanelColor,
    "--sheet-text": draft.sheetTextColor,
    "--sheet-title": draft.titleColor,
    "--sheet-muted": draft.mutedColor,
    "--sheet-border": draft.accentColor,
    "--sheet-section-bg": colorMix(draft.sheetBackground, draft.accentColor, 0.16),
    "--sheet-accent": draft.accentColor,
    "--sheet-warning": draft.secondaryColor,
    "--sheet-chip-bg": colorMix(draft.sheetBackground, draft.accentColor, 0.2),
    "--sheet-cover-a": draft.coverStart,
    "--sheet-cover-b": draft.coverEnd,
    "--lab-card-image": draft.imageUrl ? `url("${cssEscapeUrl(draft.imageUrl)}")` : "none",
    "--lab-detail-image": draft.detailImageUrl ? `url("${cssEscapeUrl(draft.detailImageUrl)}")` : "none",
    "--lab-card-image-opacity": draft.cardImageOpacity,
    "--lab-card-image-size": `${draft.cardImageSize}%`,
    "--lab-card-image-position": `${draft.cardImagePositionX}% ${draft.cardImagePositionY}%`,
    "--lab-card-ornament-size": `${draft.cardOrnamentSize}px`,
    "--lab-card-body-contrast": draft.cardBodyContrast,
    "--lab-sheet-image-opacity": draft.sheetImageOpacity,
    "--lab-sheet-image-size": `${draft.sheetImageSize}%`,
    "--lab-sheet-image-position": `${draft.sheetImagePositionX}% ${draft.sheetImagePositionY}%`,
    "--lab-sheet-cover-width": `${draft.sheetCoverWidth}px`,
    "--lab-sheet-panel-alpha": draft.sheetPanelOpacity,
    "--lab-sheet-panel-bg": rgbaFromHex(draft.sheetPanelColor, draft.sheetPanelOpacity),
    "--lab-sheet-title-scale": draft.sheetTitleScale,
    "--lab-sheet-density": draft.sheetDetailDensity,
    "--lab-radius": `${draft.cornerRadius}px`,
    "--lab-pattern": draft.pattern,
  } as CSSProperties;
}

function scheduleStatus(draft: SeasonalDesignDraft) {
  if (draft.state === "retired") {
    return { label: "Fora de linha", detail: "O modelo continua no laboratorio." };
  }

  const today = startOfDay(new Date()).getTime();
  const start = startOfDay(new Date(`${draft.startsAt}T00:00:00`)).getTime();
  const end = startOfDay(new Date(`${draft.endsAt}T00:00:00`)).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) return { label: "Datas incompletas", detail: "Defina inicio e saida." };
  if (today < start) return { label: "Agendado", detail: `Entra em ${formatDate(draft.startsAt)}.` };
  if (today > end) return { label: "Encerrado", detail: `Saiu em ${formatDate(draft.endsAt)}.` };
  return { label: "Na janela", detail: `Funciona ate ${formatDate(draft.endsAt)}.` };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seasonal-model";
}

function cssEscapeUrl(value: string) {
  return value.replace(/"/g, "%22").replace(/\n/g, "");
}

function numberValue(value: string | number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function formatControlValue(value: number, suffix: string) {
  if (!suffix) return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (suffix === "opacidade" || suffix === "escala" || suffix === "espaco") return `${value.toFixed(2)} ${suffix}`;
  return `${value}${suffix}`;
}

function colorMix(base: string, blend: string, amount: number) {
  const left = parseHex(base);
  const right = parseHex(blend);
  if (!left || !right) return base;
  const mix = left.map((channel, index) => Math.round(channel * (1 - amount) + right[index] * amount));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function parseHex(value: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value.trim());
  if (!match) return null;
  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)] as const;
}

function rgbaFromHex(value: string, alpha: number) {
  const channels = parseHex(value);
  if (!channels) return value;
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Math.min(1, Math.max(0, alpha))})`;
}
