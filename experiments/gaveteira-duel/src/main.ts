import "./styles.css";

type Attribute = "memory" | "depth" | "rarity" | "affection" | "completion";
type Category = "Jogo" | "Livro" | "Disco" | "Filme" | "Série";
type StrategyType = "bonus" | "field" | "shield";

interface QualitySignals {
  hasCover: boolean;
  hasRating: boolean;
  completed: boolean;
  usefulDiaryEntries: number;
  diaryDays: number;
  historyEvents: number;
  revisitCount: number;
  hasFinalOpinion: boolean;
  finalOpinionChars: number;
  notesChars: number;
  externalLinks: number;
  technicalFields: number;
  rareInNetwork: boolean;
  tagsCount: number;
}

interface CultureCard {
  id: string;
  title: string;
  category: Category;
  owner: "Arthur" | "Codex";
  cover: string;
  status: string;
  tags: string[];
  favorite: boolean;
  journalEntries: number;
  attributes: Record<Attribute, number>;
  quality: QualitySignals;
  notes: string;
}

interface Situation {
  id: string;
  name: string;
  description: string;
  attributes: Attribute[];
}

interface StrategyCard {
  id: string;
  name: string;
  type: StrategyType;
  trigger: string;
  description: string;
  attribute?: Attribute;
  amount?: number;
}

interface RoundResult {
  round: number;
  situation: Situation;
  playerCard: CultureCard;
  rivalCard: CultureCard;
  strategy?: StrategyCard;
  playerScore: number;
  rivalScore: number;
  winner: "player" | "rival" | "draw";
}

type GamePhase = "deckbuilding" | "duel";

const attributeLabels: Record<Attribute, string> = {
  memory: "Memória",
  depth: "Profundidade",
  rarity: "Raridade",
  affection: "Afeto",
  completion: "Conclusão",
};

const categoryColors: Record<Category, string> = {
  Jogo: "#346b5d",
  Livro: "#b88737",
  Disco: "#315f84",
  Filme: "#9f473d",
  Série: "#5e3c27",
};

const situations: Situation[] = [
  {
    id: "nostalgia",
    name: "Nostalgia",
    description: "Memória + Afeto",
    attributes: ["memory", "affection"],
  },
  {
    id: "arquivo",
    name: "Arquivo completo",
    description: "Profundidade + Conclusão",
    attributes: ["depth", "completion"],
  },
  {
    id: "cult",
    name: "Cult secreto",
    description: "Raridade + Afeto",
    attributes: ["rarity", "affection"],
  },
  {
    id: "maratona",
    name: "Maratona",
    description: "Conclusão + Memória",
    attributes: ["completion", "memory"],
  },
  {
    id: "debate",
    name: "Debate de mesa",
    description: "Profundidade + Afeto",
    attributes: ["depth", "affection"],
  },
];

const playerPool: CultureCard[] = [
  {
    id: "hades",
    title: "Hades",
    category: "Jogo",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #191d2b, #9f473d)",
    status: "Zerado",
    tags: ["Roguelike", "Mitologia", "Favorito"],
    favorite: true,
    journalEntries: 6,
    attributes: { memory: 8, depth: 7, rarity: 5, affection: 10, completion: 9 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 5,
      diaryDays: 4,
      historyEvents: 5,
      revisitCount: 2,
      hasFinalOpinion: true,
      finalOpinionChars: 520,
      notesChars: 260,
      externalLinks: 3,
      technicalFields: 5,
      rareInNetwork: false,
      tagsCount: 5,
    },
    notes: "Afeto alto por diário, revisitas e opinião final.",
  },
  {
    id: "duna",
    title: "Duna",
    category: "Livro",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #d2a852, #5e3c27)",
    status: "Lido",
    tags: ["Ficção", "Política", "Clássico"],
    favorite: false,
    journalEntries: 4,
    attributes: { memory: 7, depth: 9, rarity: 4, affection: 8, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 4,
      diaryDays: 3,
      historyEvents: 4,
      revisitCount: 0,
      hasFinalOpinion: true,
      finalOpinionChars: 740,
      notesChars: 310,
      externalLinks: 2,
      technicalFields: 6,
      rareInNetwork: false,
      tagsCount: 4,
    },
    notes: "Profundidade forte para rodadas de arquivo.",
  },
  {
    id: "kind-of-blue",
    title: "Kind of Blue",
    category: "Disco",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #132b3d, #d7cdbc)",
    status: "Ouvido",
    tags: ["Jazz", "Noite", "Essencial"],
    favorite: true,
    journalEntries: 2,
    attributes: { memory: 6, depth: 6, rarity: 6, affection: 9, completion: 8 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 2,
      diaryDays: 2,
      historyEvents: 2,
      revisitCount: 1,
      hasFinalOpinion: false,
      finalOpinionChars: 0,
      notesChars: 140,
      externalLinks: 1,
      technicalFields: 3,
      rareInNetwork: true,
      tagsCount: 3,
    },
    notes: "Boa carta de Afeto e Raridade.",
  },
  {
    id: "parasita",
    title: "Parasita",
    category: "Filme",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #211d18, #f4f0e8)",
    status: "Assistido",
    tags: ["Cinema", "Suspense", "Crítica social"],
    favorite: true,
    journalEntries: 3,
    attributes: { memory: 7, depth: 10, rarity: 5, affection: 8, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 3,
      diaryDays: 2,
      historyEvents: 3,
      revisitCount: 0,
      hasFinalOpinion: true,
      finalOpinionChars: 680,
      notesChars: 280,
      externalLinks: 2,
      technicalFields: 5,
      rareInNetwork: false,
      tagsCount: 4,
    },
    notes: "Ótima em Profundidade.",
  },
  {
    id: "dark",
    title: "Dark",
    category: "Série",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #0b1724, #315f84)",
    status: "Finalizada",
    tags: ["Tempo", "Mistério", "Mapa mental"],
    favorite: false,
    journalEntries: 7,
    attributes: { memory: 9, depth: 8, rarity: 6, affection: 7, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 5,
      diaryDays: 5,
      historyEvents: 6,
      revisitCount: 0,
      hasFinalOpinion: true,
      finalOpinionChars: 450,
      notesChars: 380,
      externalLinks: 1,
      technicalFields: 4,
      rareInNetwork: true,
      tagsCount: 6,
    },
    notes: "Memória alta por teorias e histórico.",
  },
  {
    id: "akira",
    title: "Akira",
    category: "Filme",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #9f473d, #211d18)",
    status: "Reassistido",
    tags: ["Anime", "Cyberpunk", "Clássico"],
    favorite: true,
    journalEntries: 2,
    attributes: { memory: 6, depth: 8, rarity: 7, affection: 8, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 2,
      diaryDays: 2,
      historyEvents: 3,
      revisitCount: 2,
      hasFinalOpinion: true,
      finalOpinionChars: 360,
      notesChars: 220,
      externalLinks: 1,
      technicalFields: 5,
      rareInNetwork: true,
      tagsCount: 4,
    },
    notes: "Revisita dá corpo para Afeto e Memória.",
  },
  {
    id: "disco-elysium",
    title: "Disco Elysium",
    category: "Jogo",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #315f84, #b88737)",
    status: "Jogando",
    tags: ["RPG", "Texto", "Estranho"],
    favorite: false,
    journalEntries: 8,
    attributes: { memory: 8, depth: 10, rarity: 7, affection: 8, completion: 5 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: false,
      usefulDiaryEntries: 5,
      diaryDays: 5,
      historyEvents: 4,
      revisitCount: 0,
      hasFinalOpinion: false,
      finalOpinionChars: 0,
      notesChars: 420,
      externalLinks: 2,
      technicalFields: 4,
      rareInNetwork: true,
      tagsCount: 5,
    },
    notes: "Profunda, mas ainda perde pontos em Conclusão.",
  },
  {
    id: "clarice",
    title: "A Hora da Estrela",
    category: "Livro",
    owner: "Arthur",
    cover: "linear-gradient(145deg, #fffaf1, #b88737)",
    status: "Lido",
    tags: ["Brasil", "Literatura", "Curto"],
    favorite: true,
    journalEntries: 3,
    attributes: { memory: 7, depth: 8, rarity: 6, affection: 9, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 3,
      diaryDays: 3,
      historyEvents: 3,
      revisitCount: 1,
      hasFinalOpinion: true,
      finalOpinionChars: 520,
      notesChars: 260,
      externalLinks: 1,
      technicalFields: 5,
      rareInNetwork: false,
      tagsCount: 4,
    },
    notes: "Carta compacta, mas muito cuidada.",
  },
];

const rivalDeck: CultureCard[] = [
  {
    id: "elden-ring",
    title: "Elden Ring",
    category: "Jogo",
    owner: "Codex",
    cover: "linear-gradient(145deg, #2f3321, #b88737)",
    status: "Platinado",
    tags: ["RPG", "Exploração", "Bosses"],
    favorite: true,
    journalEntries: 3,
    attributes: { memory: 6, depth: 8, rarity: 5, affection: 9, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 3,
      diaryDays: 2,
      historyEvents: 5,
      revisitCount: 1,
      hasFinalOpinion: true,
      finalOpinionChars: 320,
      notesChars: 180,
      externalLinks: 2,
      technicalFields: 5,
      rareInNetwork: false,
      tagsCount: 5,
    },
    notes: "Conclusão altíssima e Afeto forte.",
  },
  {
    id: "solaris",
    title: "Solaris",
    category: "Livro",
    owner: "Codex",
    cover: "linear-gradient(145deg, #efe5d5, #315f84)",
    status: "Lido",
    tags: ["Ficção", "Memória", "Estranho"],
    favorite: true,
    journalEntries: 5,
    attributes: { memory: 8, depth: 9, rarity: 7, affection: 8, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 5,
      diaryDays: 4,
      historyEvents: 4,
      revisitCount: 0,
      hasFinalOpinion: true,
      finalOpinionChars: 620,
      notesChars: 340,
      externalLinks: 2,
      technicalFields: 6,
      rareInNetwork: true,
      tagsCount: 4,
    },
    notes: "Equilibrada e difícil de derrubar.",
  },
  {
    id: "dummy",
    title: "Dummy",
    category: "Disco",
    owner: "Codex",
    cover: "linear-gradient(145deg, #332b3a, #9f473d)",
    status: "Ouvido",
    tags: ["Trip-hop", "Atmosfera", "Noite"],
    favorite: false,
    journalEntries: 2,
    attributes: { memory: 6, depth: 7, rarity: 8, affection: 7, completion: 9 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 2,
      diaryDays: 1,
      historyEvents: 2,
      revisitCount: 0,
      hasFinalOpinion: false,
      finalOpinionChars: 0,
      notesChars: 120,
      externalLinks: 1,
      technicalFields: 4,
      rareInNetwork: true,
      tagsCount: 3,
    },
    notes: "Valor alto quando a mesa pede Raridade.",
  },
  {
    id: "yi-yi",
    title: "Yi Yi",
    category: "Filme",
    owner: "Codex",
    cover: "linear-gradient(145deg, #d7cdbc, #5e3c27)",
    status: "Assistido",
    tags: ["Família", "Cotidiano", "Cinema"],
    favorite: true,
    journalEntries: 4,
    attributes: { memory: 9, depth: 9, rarity: 8, affection: 9, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 4,
      diaryDays: 4,
      historyEvents: 4,
      revisitCount: 1,
      hasFinalOpinion: true,
      finalOpinionChars: 760,
      notesChars: 360,
      externalLinks: 2,
      technicalFields: 5,
      rareInNetwork: true,
      tagsCount: 4,
    },
    notes: "Rara, profunda e muito afetiva.",
  },
  {
    id: "atlanta",
    title: "Atlanta",
    category: "Série",
    owner: "Codex",
    cover: "linear-gradient(145deg, #211d18, #b88737)",
    status: "Finalizada",
    tags: ["Surreal", "Comédia", "Música"],
    favorite: false,
    journalEntries: 3,
    attributes: { memory: 7, depth: 8, rarity: 9, affection: 8, completion: 10 },
    quality: {
      hasCover: true,
      hasRating: true,
      completed: true,
      usefulDiaryEntries: 3,
      diaryDays: 2,
      historyEvents: 3,
      revisitCount: 0,
      hasFinalOpinion: true,
      finalOpinionChars: 410,
      notesChars: 220,
      externalLinks: 1,
      technicalFields: 4,
      rareInNetwork: true,
      tagsCount: 4,
    },
    notes: "Excelente para Cult secreto.",
  },
];

const strategyCards: StrategyCard[] = [
  {
    id: "caderno-aberto",
    name: "Caderno Aberto",
    type: "bonus",
    trigger: "5 diários úteis",
    description: "+2 Memória",
    attribute: "memory",
    amount: 2,
  },
  {
    id: "ficha-tecnica",
    name: "Ficha Técnica",
    type: "bonus",
    trigger: "dados técnicos cheios",
    description: "+2 Profundidade",
    attribute: "depth",
    amount: 2,
  },
  {
    id: "achado-raro",
    name: "Achado Raro",
    type: "bonus",
    trigger: "item incomum",
    description: "+2 Raridade",
    attribute: "rarity",
    amount: 2,
  },
  {
    id: "revisita",
    name: "Revisita",
    type: "bonus",
    trigger: "rever/rejogar/reouvir",
    description: "+1 Afeto",
    attribute: "affection",
    amount: 1,
  },
];

let phase: GamePhase = "deckbuilding";
let selectedDeckIds = playerPool.slice(0, 5).map((card) => card.id);
let selectedHandCardId = selectedDeckIds[0];
let selectedStrategyId = strategyCards[0].id;
let inspectedCardId: string | null = null;
let currentRound = 0;
let usedPlayerIds: string[] = [];
let usedStrategyIds: string[] = [];
let roundLog: RoundResult[] = [];

function capScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value)));
}

function qualityAttributes(card: CultureCard): Record<Attribute, number> {
  const quality = card.quality;
  const diaryScore = Math.min(quality.usefulDiaryEntries, 5);
  const historyScore = Math.min(quality.historyEvents, 3);
  const revisitMemory = Math.min(quality.revisitCount * 2, 2);
  const variedDiaryBonus = quality.diaryDays >= 3 ? 1 : 0;
  const finalOpinionBonus = quality.hasFinalOpinion ? 2 : 0;
  const longOpinionBonus = quality.finalOpinionChars >= 180 ? 1 : 0;
  const notesBonus = quality.notesChars >= 120 ? 1 : 0;
  const linkScore = Math.min(quality.externalLinks, 2);
  const technicalScore = Math.min(quality.technicalFields, 4);
  const tagPenalty = quality.tagsCount > 8 ? 1 : 0;

  return {
    memory: capScore(diaryScore + historyScore + revisitMemory + variedDiaryBonus),
    depth: capScore(technicalScore + finalOpinionBonus + longOpinionBonus + linkScore + notesBonus),
    rarity: capScore(card.attributes.rarity + (quality.rareInNetwork ? 2 : 0) - tagPenalty),
    affection: capScore((card.favorite ? 3 : 0) + (quality.hasRating ? 2 : 0) + Math.min(quality.revisitCount, 2) + finalOpinionBonus + (diaryScore >= 3 ? 1 : 0)),
    completion: capScore((quality.completed ? 5 : 1) + (quality.hasCover ? 1 : 0) + (quality.hasRating ? 1 : 0) + Math.min(quality.technicalFields, 2) + (quality.hasFinalOpinion ? 1 : 0)),
  };
}

function cardTotal(card: CultureCard) {
  return Object.values(qualityAttributes(card)).reduce((total, value) => total + value, 0);
}

function scoreCard(card: CultureCard, situation: Situation, strategy?: StrategyCard) {
  const playableAttributes = qualityAttributes(card);
  const base = situation.attributes.reduce((total, attr) => total + playableAttributes[attr], 0);
  if (!strategy || !strategy.attribute || !strategy.amount) return base;
  return situation.attributes.includes(strategy.attribute) ? base + strategy.amount : base;
}

function getSelectedDeck() {
  return selectedDeckIds.map((id) => playerPool.find((card) => card.id === id)).filter(Boolean) as CultureCard[];
}

function getAvailableHand() {
  return getSelectedDeck().filter((card) => !usedPlayerIds.includes(card.id));
}

function getCurrentSituation() {
  return situations[currentRound % situations.length];
}

function getCurrentRivalCard() {
  return rivalDeck[currentRound % rivalDeck.length];
}

function getSelectedCard() {
  return getAvailableHand().find((card) => card.id === selectedHandCardId) ?? getAvailableHand()[0];
}

function getSelectedStrategy() {
  return strategyCards.find((card) => card.id === selectedStrategyId && !usedStrategyIds.includes(card.id));
}

function findCardById(cardId: string) {
  return [...playerPool, ...rivalDeck].find((card) => card.id === cardId);
}

function toggleDeckCard(cardId: string) {
  if (selectedDeckIds.includes(cardId)) {
    selectedDeckIds = selectedDeckIds.filter((id) => id !== cardId);
  } else if (selectedDeckIds.length < 5) {
    selectedDeckIds = [...selectedDeckIds, cardId];
  }
  render();
}

function startDuel() {
  if (selectedDeckIds.length !== 5) return;
  phase = "duel";
  currentRound = 0;
  roundLog = [];
  usedPlayerIds = [];
  usedStrategyIds = [];
  selectedHandCardId = selectedDeckIds[0];
  selectedStrategyId = strategyCards[0].id;
  render();
}

function resetAll() {
  phase = "deckbuilding";
  currentRound = 0;
  roundLog = [];
  usedPlayerIds = [];
  usedStrategyIds = [];
  selectedHandCardId = selectedDeckIds[0];
  render();
}

function resolveRound() {
  const playerCard = getSelectedCard();
  if (!playerCard || currentRound >= 5) return;

  const strategy = getSelectedStrategy();
  const situation = getCurrentSituation();
  const rivalCard = getCurrentRivalCard();
  const playerScore = scoreCard(playerCard, situation, strategy);
  const rivalScore = scoreCard(rivalCard, situation);
  const winner = playerScore > rivalScore ? "player" : rivalScore > playerScore ? "rival" : "draw";

  roundLog = [
    ...roundLog,
    {
      round: currentRound + 1,
      situation,
      playerCard,
      rivalCard,
      strategy,
      playerScore,
      rivalScore,
      winner,
    },
  ];

  usedPlayerIds = [...usedPlayerIds, playerCard.id];
  if (strategy) usedStrategyIds = [...usedStrategyIds, strategy.id];
  currentRound += 1;
  selectedHandCardId = getAvailableHand().find((card) => card.id !== playerCard.id)?.id ?? "";
  selectedStrategyId = strategyCards.find((card) => !usedStrategyIds.includes(card.id))?.id ?? "";
  render();
}

function attributeLine(card: CultureCard, dense = false) {
  const attributes = qualityAttributes(card);
  const keys: Attribute[] = ["memory", "depth", "rarity", "affection", "completion"];
  return `
    <div class="${dense ? "tiny-stats" : "card-stats"}">
      ${keys.map((key) => `<span><b>${attributeLabels[key].slice(0, 3)}</b>${attributes[key]}</span>`).join("")}
    </div>
  `;
}

function miniCardTemplate(card: CultureCard, options: { selected?: boolean; used?: boolean; mode: "pick" | "hand" | "rival" }) {
  const selected = options.selected ? "is-selected" : "";
  const used = options.used ? "is-used" : "";
  const disabled = options.used ? "disabled" : "";
  return `
    <button class="tcg-mini-card ${selected} ${used}" data-${options.mode}="${card.id}" ${disabled}>
      <span class="mini-art" style="background: ${card.cover}"></span>
      <span class="mini-meta">
        <strong>${card.title}</strong>
        <small>${card.category} • ${cardTotal(card)} pts</small>
      </span>
      ${attributeLine(card, true)}
    </button>
  `;
}

function interactiveMiniCardTemplate(card: CultureCard, options: { selected?: boolean; used?: boolean; mode: "pick" | "hand" | "rival" }) {
  const selected = options.selected ? "is-selected" : "";
  const used = options.used ? "is-used" : "";
  const disabled = options.used ? "disabled" : "";
  const actionAttribute = `data-${options.mode}="${card.id}"`;

  return `
    <article class="tcg-mini-card ${selected} ${used}">
      <button class="mini-main" ${actionAttribute} ${disabled}>
        <span class="mini-art" style="background: ${card.cover}"></span>
        <span class="mini-meta">
          <strong>${card.title}</strong>
          <small>${card.category} • ${cardTotal(card)} pts</small>
        </span>
        ${attributeLine(card, true)}
      </button>
      <button class="inspect-button" data-inspect="${card.id}">Ficha</button>
    </article>
  `;
}

function battlefieldCardTemplate(card: CultureCard | undefined, label: string, score?: number) {
  if (!card) {
    return `
      <article class="battle-card is-empty">
        <span>${label}</span>
        <strong>Escolha uma carta</strong>
      </article>
    `;
  }

  return `
    <article class="battle-card">
      <div class="battle-art" style="background: ${card.cover}">
        <span>${card.category}</span>
      </div>
      <div class="battle-body">
        <span>${label}</span>
        <h2>${card.title}</h2>
        <p>${card.notes}</p>
        ${attributeLine(card)}
        <footer>
          <b>${cardTotal(card)} pts</b>
          <button class="inspect-link" data-inspect="${card.id}">Ficha</button>
          ${typeof score === "number" ? `<strong>${score}</strong>` : ""}
        </footer>
      </div>
    </article>
  `;
}

function strategyTemplate(card: StrategyCard) {
  const used = usedStrategyIds.includes(card.id);
  const selected = selectedStrategyId === card.id && !used;
  return `
    <button class="strategy-chip ${selected ? "is-selected" : ""} ${used ? "is-used" : ""}" data-strategy="${card.id}" ${used ? "disabled" : ""}>
      <strong>${card.name}</strong>
      <span>${card.description}</span>
    </button>
  `;
}

function inspectModalTemplate() {
  if (!inspectedCardId) return "";
  const card = findCardById(inspectedCardId);
  if (!card) return "";
  const attributes = qualityAttributes(card);
  const badges = [
    `${card.quality.usefulDiaryEntries}/${card.journalEntries} diários úteis`,
    `${Math.min(card.quality.historyEvents, 3)}/3 histórico`,
    `${Math.min(card.quality.technicalFields, 4)}/4 técnica`,
    `${Math.min(card.quality.externalLinks, 2)}/2 links`,
    card.quality.hasFinalOpinion ? "opinião final" : "sem opinião final",
    card.quality.rareInNetwork ? "raro na rede" : "comum na rede",
  ];

  return `
    <div class="card-modal-backdrop" role="dialog" aria-modal="true">
      <article class="card-modal">
        <button class="modal-close" data-close-modal>Fechar</button>
        <div class="modal-art" style="background: ${card.cover}">
          <span>${card.category}</span>
        </div>
        <div class="modal-body">
          <span class="eyebrow">${card.owner} • ${card.status}</span>
          <h2>${card.title}</h2>
          <p>${card.notes}</p>
          <div class="modal-stats">
            ${Object.entries(attributes).map(([key, value]) => `<span><b>${attributeLabels[key as Attribute]}</b>${value}</span>`).join("")}
          </div>
          <div class="modal-tags">
            ${card.tags.map((tag) => `<span>${tag}</span>`).join("")}
          </div>
          <div class="modal-audit">
            ${badges.map((badge) => `<span>${badge}</span>`).join("")}
          </div>
        </div>
      </article>
    </div>
  `;
}

function scoreSummaryTemplate() {
  const playerWins = roundLog.filter((round) => round.winner === "player").length;
  const rivalWins = roundLog.filter((round) => round.winner === "rival").length;
  const draws = roundLog.filter((round) => round.winner === "draw").length;
  return `
    <div class="tcg-score">
      <span>Você <b>${playerWins}</b></span>
      <span>Empates <b>${draws}</b></span>
      <span>Rival <b>${rivalWins}</b></span>
    </div>
  `;
}

function logTemplate() {
  if (!roundLog.length) return `<div class="tcg-empty-log">A mesa ainda está limpa.</div>`;
  return roundLog
    .slice()
    .reverse()
    .map(
      (round) => `
        <article class="tcg-log-row">
          <b>R${round.round}</b>
          <span>${round.playerCard.title} ${round.playerScore} x ${round.rivalScore} ${round.rivalCard.title}</span>
          <strong>${round.winner === "player" ? "Vitória" : round.winner === "rival" ? "Derrota" : "Empate"}</strong>
        </article>
      `,
    )
    .join("");
}

function deckbuildingTemplate() {
  return `
    <section class="tcg-shell deckbuilding-shell">
      <header class="tcg-topbar">
        <div>
          <span class="eyebrow">Experimento isolado</span>
          <h1>Gaveteira Duel</h1>
        </div>
        <div class="deck-counter">
          <span>Escolha 5 cartas</span>
          <strong>${selectedDeckIds.length}/5</strong>
        </div>
        <button class="primary-button" id="start-duel" ${selectedDeckIds.length === 5 ? "" : "disabled"}>Começar duelo</button>
      </header>

      <section class="deckbuilder-board">
        <div class="pool-panel">
          <div class="panel-title">
            <span>Seu arquivo</span>
            <strong>Pool de cartas</strong>
          </div>
          <div class="pick-grid">
            ${playerPool.map((card) => interactiveMiniCardTemplate(card, { selected: selectedDeckIds.includes(card.id), mode: "pick" })).join("")}
          </div>
        </div>

        <aside class="selected-panel">
          <div class="panel-title">
            <span>Baralho</span>
            <strong>5 rodadas, 5 cartas</strong>
          </div>
          <div class="selected-slots">
            ${Array.from({ length: 5 }, (_, index) => {
              const card = playerPool.find((item) => item.id === selectedDeckIds[index]);
              return card ? interactiveMiniCardTemplate(card, { selected: true, mode: "pick" }) : `<div class="empty-slot">Slot ${index + 1}</div>`;
            }).join("")}
          </div>
          <p>O duelo usa uma carta por rodada. Cada carta só pode ser jogada uma vez.</p>
        </aside>
      </section>
    </section>
  `;
}

function duelTemplate() {
  const situation = getCurrentSituation();
  const selectedCard = getSelectedCard();
  const rivalCard = getCurrentRivalCard();
  const strategy = getSelectedStrategy();
  const previewPlayerScore = selectedCard ? scoreCard(selectedCard, situation, strategy) : 0;
  const previewRivalScore = currentRound < 5 ? scoreCard(rivalCard, situation) : 0;
  const finished = currentRound >= 5;

  return `
    <section class="tcg-shell duel-shell">
      <header class="tcg-topbar">
        <div>
          <span class="eyebrow">Campo TCG</span>
          <h1>Gaveteira Duel</h1>
        </div>
        ${scoreSummaryTemplate()}
        <div class="round-badge">
          <span>Rodada</span>
          <strong>${Math.min(currentRound + 1, 5)}/5</strong>
        </div>
        <button class="ghost-button" id="reset-duel">Trocar baralho</button>
      </header>

      <main class="tcg-field">
        <aside class="hand-zone">
          <div class="zone-title"><span>Sua mão</span><strong>${getAvailableHand().length} cartas</strong></div>
          <div class="hand-list">
            ${getSelectedDeck().map((card) => interactiveMiniCardTemplate(card, { selected: selectedHandCardId === card.id, used: usedPlayerIds.includes(card.id), mode: "hand" })).join("")}
          </div>
        </aside>

        <section class="arena-zone">
          <div class="situation-strip">
            <span>${finished ? "Fim da partida" : situation.name}</span>
            <strong>${finished ? "Duelo encerrado" : situation.description}</strong>
          </div>
          <div class="battle-line">
            ${battlefieldCardTemplate(selectedCard, "Sua carta", finished ? undefined : previewPlayerScore)}
            <div class="vs-token">VS</div>
            ${battlefieldCardTemplate(finished ? roundLog[roundLog.length - 1]?.rivalCard : rivalCard, "Carta rival", finished ? undefined : previewRivalScore)}
          </div>
          <div class="action-row">
            <button class="primary-button" id="resolve-round" ${finished || !selectedCard ? "disabled" : ""}>Resolver rodada</button>
            <span>${finished ? "Partida concluída." : "Escolha sua carta, aplique uma estratégia e resolva a mesa."}</span>
          </div>
        </section>

        <aside class="side-zone">
          <div class="strategy-zone">
            <div class="zone-title"><span>Estratégias</span><strong>1 por rodada</strong></div>
            <div class="strategy-list">
              ${strategyCards.map(strategyTemplate).join("")}
            </div>
          </div>
          <div class="log-zone">
            <div class="zone-title"><span>Registro</span><strong>${roundLog.length}/5</strong></div>
            <div class="tcg-log">${logTemplate()}</div>
          </div>
        </aside>
      </main>
    </section>
  `;
}

function bindDeckbuilding() {
  document.querySelector("#start-duel")?.addEventListener("click", startDuel);
  document.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => toggleDeckCard(button.dataset.pick ?? ""));
  });
  bindInspectButtons();
}

function bindDuel() {
  document.querySelector("#reset-duel")?.addEventListener("click", resetAll);
  document.querySelector("#resolve-round")?.addEventListener("click", resolveRound);
  document.querySelectorAll<HTMLButtonElement>("[data-hand]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedHandCardId = button.dataset.hand ?? "";
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-strategy]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedStrategyId = button.dataset.strategy ?? "";
      render();
    });
  });
  bindInspectButtons();
}

function bindInspectButtons() {
  document.querySelectorAll<HTMLButtonElement>("[data-inspect]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      inspectedCardId = button.dataset.inspect ?? null;
      render();
    });
  });
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    inspectedCardId = null;
    render();
  });
  document.querySelector(".card-modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      inspectedCardId = null;
      render();
    }
  });
}

function render() {
  const root = document.querySelector<HTMLDivElement>("#duel-root");
  if (!root) return;

  root.innerHTML = `${phase === "deckbuilding" ? deckbuildingTemplate() : duelTemplate()}${inspectModalTemplate()}`;
  if (phase === "deckbuilding") {
    bindDeckbuilding();
  } else {
    bindDuel();
  }
}

render();
