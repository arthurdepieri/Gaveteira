import { Clipboard, Download, Eye, FileUp, Layers3, Plus, Ruler, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { CulturalItem } from "../types";
import { defaultStatuses } from "../data/catalog";
import { getGenre, getItemVisibilityLabel, getTitle, getYear } from "../utils/itemHelpers";
import { ItemCard } from "./ItemCard";
import { ItemDetails } from "./ItemDetails";

const STORAGE_KEY = "gaveteira-canva-ficha-template:v2";

const cardSpec = [
  { label: "Grid das gavetas", value: "auto-fill, minmax(210px, 1fr)" },
  { label: "Referência Canva", value: "342 x 520 px" },
  { label: "Capa externa", value: "100% x 220 px" },
  { label: "Corpo do card", value: "padding 14 px" },
  { label: "Borda", value: "1 px / raio 8 px" },
  { label: "Sombra", value: "0 10 24 rgba(47,35,24,.10)" },
];

const sheetSpec = [
  { label: "Modal interno", value: "min(1120px, 100vw - 28px)" },
  { label: "Referência Canva", value: "1120 x 900 px" },
  { label: "Hero", value: "capa 220 px + conteúdo" },
  { label: "Capa interna", value: "220 x 292 px" },
  { label: "Padding hero", value: "16 px" },
  { label: "Blocos", value: "grid auto-fit minmax(180px, 1fr)" },
];

const canvaPalette = {
  paper: "#fffaf1",
  surface: "#fffdf8",
  panel: "#fff4da",
  ink: "#211d18",
  muted: "#6f6255",
  line: "#d8c7ad",
  green: "#346b5d",
  red: "#9f473d",
  brass: "#c38625",
};

interface ImportedCanvaFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  importedAt: string;
}

interface CanvaTemplateState {
  seals: string[];
  layers: string[];
  imports: ImportedCanvaFile[];
}

export function SeasonalDesignLab({ items }: { items: CulturalItem[] }) {
  const [state, setState] = useState<CanvaTemplateState>(() => loadState());
  const [newSeal, setNewSeal] = useState("");
  const [newLayer, setNewLayer] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewItem = useMemo(() => pickPreviewItem(items), [items]);
  const brief = useMemo(() => buildCanvaBrief(previewItem, state), [previewItem, state]);

  function updateState(patch: Partial<CanvaTemplateState>) {
    const nextState = { ...state, ...patch };
    setState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  function addSeal() {
    const value = newSeal.trim();
    if (!value) return;
    updateState({ seals: [...state.seals, value].slice(0, 8) });
    setNewSeal("");
  }

  function addLayer() {
    const value = newLayer.trim();
    if (!value) return;
    updateState({ layers: [...state.layers, value].slice(0, 14) });
    setNewLayer("");
  }

  async function copyBrief() {
    await navigator.clipboard?.writeText(brief).catch(() => undefined);
  }

  async function importCanvaFiles(files: FileList | null) {
    if (!files?.length) return;
    const imported = await Promise.all(Array.from(files).map(readImportedFile));
    updateState({ imports: [...imported, ...state.imports].slice(0, 12) });
  }

  return (
    <section className="canva-lab" aria-label="Gabarito Canva das fichas">
      <section className="canva-preview-panel">
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

        <div className="canva-single-preview">
          <div className="canva-original-card-frame">
            <ItemCard item={previewItem} onOpen={() => setPreviewOpen(true)} />
          </div>
        </div>
      </section>

      <section className="canva-export-panel">
        <div className="section-heading split">
          <div className="section-heading">
            <Download size={20} />
            <h3>Arquivo para Canva</h3>
          </div>
          <details className="canva-download-menu">
            <summary>
              <Download size={15} />
              Baixar
            </summary>
            <button type="button" onClick={() => downloadText("gaveteira-card-canva.svg", buildCardSvg(previewItem))}>Card em SVG</button>
            <button type="button" onClick={() => downloadText("gaveteira-ficha-interna-canva.svg", buildSheetSvg(previewItem, state))}>Ficha interna em SVG</button>
            <button type="button" onClick={() => downloadSvgAsPng(buildCardSvg(previewItem), "gaveteira-card-canva.png", 342, 520)}>Card em PNG</button>
            <button type="button" onClick={() => downloadSvgAsPng(buildSheetSvg(previewItem, state), "gaveteira-ficha-interna-canva.png", 1120, 900)}>Ficha interna em PNG</button>
          </details>
        </div>
        <div className="canva-export-actions">
          <button type="button" className="ghost compact" onClick={copyBrief}><Clipboard size={15} /> Copiar briefing</button>
          <label className="file-button compact">
            <FileUp size={15} />
            Importar do Canva
            <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" multiple onChange={(event) => importCanvaFiles(event.target.files)} />
          </label>
        </div>
        <pre className="canva-brief-preview">{brief}</pre>
      </section>

      <div className="canva-lab-grid">
        <section className="canva-editor-panel">
          <div className="section-heading">
            <Ruler size={20} />
            <h3>Medidas de referência</h3>
          </div>
          <div className="canva-reference-grid">
            <SpecGroup title="Card externo" specs={cardSpec} />
            <SpecGroup title="Ficha interna" specs={sheetSpec} />
          </div>
        </section>

        <section className="canva-editor-panel">
          <div className="section-heading">
            <FileUp size={20} />
            <h3>Arquivos importados</h3>
          </div>
          <div className="canva-import-list">
            {state.imports.length ? state.imports.map((file) => (
              <article key={file.id} className="canva-import-row">
                <span>{file.dataUrl ? <img src={file.dataUrl} alt="" /> : null}</span>
                <div>
                  <strong>{file.name}</strong>
                  <small>{file.type || "arquivo Canva"} / {formatBytes(file.size)}</small>
                </div>
                <button type="button" className="icon-button" onClick={() => updateState({ imports: state.imports.filter((entry) => entry.id !== file.id) })} aria-label="Remover arquivo importado">
                  <Trash2 size={15} />
                </button>
              </article>
            )) : <p className="empty">Importe SVG, PNG, JPG ou WEBP exportado do Canva para manter os materiais junto do gabarito.</p>}
          </div>
        </section>

        <section className="canva-editor-panel canva-wide-panel">
          <div className="section-heading">
            <Layers3 size={20} />
            <h3>Selos</h3>
          </div>
          <div className="canva-add-row">
            <input value={newSeal} onChange={(event) => setNewSeal(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? addSeal() : undefined} placeholder="Novo selo" />
            <button type="button" className="primary compact" onClick={addSeal}><Plus size={15} /> Selo</button>
          </div>
          <div className="canva-seal-list">
            {state.seals.map((seal, index) => (
              <button type="button" key={`${seal}-${index}`} onClick={() => updateState({ seals: state.seals.filter((_, itemIndex) => itemIndex !== index) })}>
                {seal}
                <Trash2 size={12} />
              </button>
            ))}
          </div>
        </section>

        <section className="canva-editor-panel canva-wide-panel">
          <div className="section-heading">
            <Layers3 size={20} />
            <h3>Camadas para montar no Canva</h3>
          </div>
          <div className="canva-add-row">
            <input value={newLayer} onChange={(event) => setNewLayer(event.target.value)} onKeyDown={(event) => event.key === "Enter" ? addLayer() : undefined} placeholder="Nova camada ou instrução" />
            <button type="button" className="primary compact" onClick={addLayer}><Plus size={15} /> Camada</button>
          </div>
          <div className="canva-layer-list">
            {state.layers.map((layer, index) => (
              <article key={`${layer}-${index}`} className="canva-layer-row">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <input value={layer} onChange={(event) => updateState({ layers: state.layers.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry) })} />
                <button type="button" className="icon-button" onClick={() => updateState({ layers: state.layers.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Remover camada">
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="canva-editor-panel canva-wide-panel">
          <div className="section-heading">
            <Ruler size={20} />
            <h3>Partes da ficha</h3>
          </div>
          <div className="canva-parts-grid">
            {fichaParts.map((part) => (
              <article key={part.title}>
                <strong>{part.title}</strong>
                <p>{part.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {previewOpen ? (
        <ItemDetails
          item={previewItem}
          statuses={defaultStatuses[previewItem.category]}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </section>
  );
}

function SpecGroup({ title, specs }: { title: string; specs: Array<{ label: string; value: string }> }) {
  return (
    <article className="canva-spec-group">
      <h4>{title}</h4>
      <div>
        {specs.map((spec) => (
          <span key={spec.label}>
            <small>{spec.label}</small>
            <strong>{spec.value}</strong>
          </span>
        ))}
      </div>
    </article>
  );
}

function loadState(): CanvaTemplateState {
  const defaults = createDefaultState();
  if (typeof localStorage === "undefined") return defaults;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<CanvaTemplateState>;
    return {
      seals: Array.isArray(parsed.seals) ? parsed.seals : defaults.seals,
      layers: Array.isArray(parsed.layers) ? parsed.layers : defaults.layers,
      imports: Array.isArray(parsed.imports) ? parsed.imports : defaults.imports,
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return defaults;
  }
}

function createDefaultState(): CanvaTemplateState {
  return {
    seals: ["Gaveteira", "Privado/amigos", "Diário"],
    layers: [
      "Fundo: papel do arquivo com grade sutil.",
      "Card: capa vertical, corpo, status, visibilidade, gênero, diário e nota.",
      "Interior: modal original com header, hero, capa, título, metadados e blocos.",
      "Hero: capa à esquerda e identidade da ficha à direita.",
      "Blocos: detalhes, progresso, links, linha do tempo e diário.",
      "Selos: chips pequenos para marcações opcionais no arquivo Canva.",
    ],
    imports: [],
  };
}

function pickPreviewItem(items: CulturalItem[]) {
  return items.find((item) => item.coverUrl) ?? items[0] ?? createFallbackItem();
}

function createFallbackItem(): CulturalItem {
  const now = new Date().toISOString();
  return {
    id: "canva-template-preview-book",
    category: "books",
    title: "O Atlas das Gavetas",
    author: "Modelo Admin",
    status: "Lendo",
    startDate: "2026-01-01",
    pages: 320,
    currentPage: 144,
    format: "Outro",
    rating: 4.5,
    genre: "Fantasia documental",
    publisher: "Gaveteira Admin",
    publicationYear: 2026,
    favoriteQuotes: "Um modelo bom deixa a ficha clara sem esconder o arquivo.",
    personalSummary: "Ficha de referência para montar variações no Canva preservando a estrutura real da Gaveteira.",
    finalOpinion: "",
    coverUrl: "",
    visibility: "friends",
    tags: ["modelo", "canva", "admin"],
    links: [{ id: "canva-doc", label: "Gabarito Canva", url: "https://www.canva.com/" }],
    timeline: [
      { id: "canva-start", date: "2026-01-01", type: "Comecei", note: "Modelo criado para edição no Canva." },
      { id: "canva-review", date: now.slice(0, 10), type: "Outro", note: "Revisar proporção, arquivo e camadas." },
    ],
    diary: [
      { id: "canva-diary-1", date: now.slice(0, 10), type: "Progresso", visibility: "friends", text: "Validar card externo e ficha interna antes de aplicar qualquer imagem final." },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

const fichaParts = [
  {
    title: "Fundo",
    text: "Camada base da ficha. Na Gaveteira ela usa textura clara de arquivo, linhas sutis e contraste baixo para não competir com capa, título e blocos.",
  },
  {
    title: "Capa",
    text: "Imagem vertical da obra. No card ela ocupa o topo; no interior aparece no hero. A capa continua pertencendo às gavetas, não ao gabarito.",
  },
  {
    title: "Card",
    text: "Versão externa e vertical da ficha. Mostra capa, status, ano, visibilidade, título, gênero, marcadores de diário, nota e progresso.",
  },
  {
    title: "Hero",
    text: "Primeiro bloco da ficha interna. Junta capa, carimbo de status, título grande, metadados, nota e ações rápidas.",
  },
  {
    title: "Corpo",
    text: "Área interna abaixo do hero. Organiza resumo, detalhes, progresso, links, linha do tempo e diário em blocos de arquivo.",
  },
  {
    title: "Selos",
    text: "Chips opcionais para marcar estados ou campanhas no Canva. Eles não substituem status, nota, visibilidade nem dados reais da ficha.",
  },
  {
    title: "Camadas",
    text: "Ordem recomendada para montar no Canva: fundo, capa, corpo, textos, blocos, selos e detalhes finais.",
  },
];

function buildCanvaBrief(item: CulturalItem, state: CanvaTemplateState) {
  const layers = state.layers.map((layer) => `- ${layer}`).join("\n");
  const seals = state.seals.join(", ");

  return [
    `Ficha usada como referência: ${getTitle(item)}`,
    "",
    "CARD EXTERNO",
    "Grid real: auto-fill, minmax(210px, 1fr)",
    "Referência Canva: 342 x 520 px",
    "Capa: 100% x 220 px",
    "Corpo: padding 14 px; borda 1 px; raio 8 px",
    "",
    "FICHA INTERNA",
    "Modal real: min(1120px, calc(100vw - 28px))",
    "Referência Canva: 1120 x 900 px",
    "Hero: capa 220 x 292 px, gap 18 px, padding 16 px",
    "Blocos: grid auto-fit com mínimo de 180 px",
    "",
    "SELOS",
    seals || "Sem selos",
    "",
    "CAMADAS",
    layers,
    "",
    "OBSERVAÇÃO",
    "A visualização acima usa o componente real das gavetas. O arquivo Canva serve como gabarito de montagem, não como publicação automática.",
  ].join("\n");
}

function buildCardSvg(item: CulturalItem) {
  const title = escapeXml(getTitle(item));
  const genre = escapeXml(getGenre(item) || "Gênero não arquivado");
  const year = escapeXml(getYear(item) || "Ano");
  const status = escapeXml(item.status);
  const visibility = escapeXml(getItemVisibilityLabel(item));

  return svgDoc(342, 520, `
    <rect id="fundo-card" width="342" height="520" rx="8" fill="${canvaPalette.paper}" stroke="${canvaPalette.line}" />
    <rect id="capa" x="0" y="0" width="342" height="220" fill="#78644b" />
    <text id="capa-placeholder" x="171" y="120" text-anchor="middle" fill="#fffaf1" font-size="46" font-weight="800" font-family="Inter, Arial">CAPA</text>
    <rect id="corpo-card" x="0" y="220" width="342" height="300" fill="${canvaPalette.surface}" />
    <text id="status-ano" x="14" y="248" fill="${canvaPalette.muted}" font-size="14" font-family="Inter, Arial">${status} / ${year}</text>
    <rect id="visibilidade" x="14" y="264" width="128" height="28" rx="14" fill="${canvaPalette.panel}" stroke="${canvaPalette.line}" />
    <text x="28" y="283" fill="${canvaPalette.green}" font-size="11" font-weight="800" font-family="Inter, Arial">${visibility.toUpperCase()}</text>
    <text id="titulo" x="14" y="328" fill="${canvaPalette.ink}" font-size="26" font-weight="800" font-family="Georgia, serif">${title}</text>
    <text id="genero" x="14" y="360" fill="${canvaPalette.muted}" font-size="16" font-family="Inter, Arial">${genre}</text>
    <rect id="diario" x="14" y="384" width="120" height="26" rx="13" fill="${canvaPalette.panel}" stroke="${canvaPalette.line}" />
    <text x="26" y="402" fill="${canvaPalette.green}" font-size="11" font-weight="800" font-family="Inter, Arial">possui diário</text>
    <text id="nota" x="14" y="488" fill="${canvaPalette.brass}" font-size="20" font-family="Inter, Arial">Nota ${item.rating ?? " -"}/5</text>
  `);
}

function buildSheetSvg(item: CulturalItem, state: CanvaTemplateState) {
  const title = escapeXml(getTitle(item));
  const meta = escapeXml([getYear(item), getGenre(item)].filter(Boolean).join(" / ") || "Metadados");
  const summary = escapeXml(getSummary(item));
  const seals = state.seals.slice(0, 4).map((seal, index) => {
    const x = 892 + (index % 2) * 100;
    const y = 790 + Math.floor(index / 2) * 38;
    return `<rect x="${x}" y="${y}" width="88" height="26" rx="13" fill="${canvaPalette.panel}" stroke="${canvaPalette.line}" /><text x="${x + 44}" y="${y + 17}" text-anchor="middle" fill="${canvaPalette.green}" font-size="10" font-weight="800" font-family="Inter, Arial">${escapeXml(seal)}</text>`;
  }).join("");

  return svgDoc(1120, 900, `
    <rect id="fundo" width="1120" height="900" rx="8" fill="${canvaPalette.paper}" stroke="${canvaPalette.line}" />
    <path id="grade" d="${gridPath(1120, 900, 34)}" stroke="${canvaPalette.line}" stroke-width="1" opacity=".38" />
    <rect id="hero" x="16" y="16" width="1088" height="330" rx="8" fill="${canvaPalette.surface}" stroke="${canvaPalette.line}" />
    <rect id="capa" x="32" y="32" width="220" height="292" rx="8" fill="#78644b" stroke="${canvaPalette.surface}" stroke-width="6" />
    <text x="142" y="188" text-anchor="middle" fill="#fffaf1" font-size="42" font-weight="800" font-family="Inter, Arial">CAPA</text>
    <rect id="carimbo-status" x="270" y="42" width="130" height="34" rx="4" fill="${canvaPalette.red}" />
    <text x="335" y="64" text-anchor="middle" fill="#fffaf1" font-size="13" font-weight="800" font-family="Inter, Arial">${escapeXml(item.status.toUpperCase())}</text>
    <text id="titulo" x="270" y="136" fill="${canvaPalette.ink}" font-size="56" font-weight="800" font-family="Georgia, serif">${title}</text>
    <text id="metadados" x="270" y="178" fill="${canvaPalette.muted}" font-size="20" font-family="Inter, Arial">${meta}</text>
    <text id="nota" x="270" y="224" fill="${canvaPalette.brass}" font-size="26" font-family="Inter, Arial">Nota ${item.rating ?? " -"}/5</text>
    <rect id="resumo" x="16" y="370" width="528" height="180" rx="8" fill="${canvaPalette.surface}" stroke="${canvaPalette.line}" />
    <text x="36" y="414" fill="${canvaPalette.ink}" font-size="24" font-weight="800" font-family="Georgia, serif">Resumo</text>
    <text x="36" y="454" fill="${canvaPalette.muted}" font-size="18" font-family="Inter, Arial">${summary}</text>
    <rect id="detalhes" x="576" y="370" width="528" height="180" rx="8" fill="${canvaPalette.surface}" stroke="${canvaPalette.line}" />
    <text x="596" y="414" fill="${canvaPalette.ink}" font-size="24" font-weight="800" font-family="Georgia, serif">Detalhes</text>
    <text x="596" y="454" fill="${canvaPalette.muted}" font-size="18" font-family="Inter, Arial">Blocos internos da ficha original</text>
    <rect id="diario" x="16" y="580" width="1088" height="280" rx="8" fill="${canvaPalette.panel}" stroke="${canvaPalette.line}" />
    <text x="36" y="626" fill="${canvaPalette.ink}" font-size="24" font-weight="800" font-family="Georgia, serif">Diário e linha do tempo</text>
    <text x="36" y="668" fill="${canvaPalette.muted}" font-size="18" font-family="Inter, Arial">Área para notas, progresso e eventos da ficha.</text>
    ${seals}
  `);
}

function getSummary(item: CulturalItem) {
  if (item.category === "books") return item.personalSummary || item.favoriteQuotes || "Resumo interno";
  if (item.category === "games") return item.notes || item.perceivedDifficulty || "Resumo interno";
  if (item.category === "albums") return item.comments || item.favoriteTracks || "Resumo interno";
  if (item.category === "movies") return item.comments || "Resumo interno";
  return item.comments || "Resumo interno";
}

function svgDoc(width: number, height: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">${body}</svg>`;
}

function gridPath(width: number, height: number, step: number) {
  const lines: string[] = [];
  for (let x = step; x < width; x += step) lines.push(`M${x} 0V${height}`);
  for (let y = step; y < height; y += step) lines.push(`M0 ${y}H${width}`);
  return lines.join(" ");
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

function downloadSvgAsPng(svg: string, filename: string, width: number, height: number) {
  const image = new Image();
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(svgUrl);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    link.click();
  };
  image.src = svgUrl;
}

function readImportedFile(file: File) {
  return new Promise<ImportedCanvaFile>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `canva-import-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: String(reader.result ?? ""),
      importedAt: new Date().toISOString(),
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
