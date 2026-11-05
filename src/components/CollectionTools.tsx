import { pomodoroEnd, settlePomodoro } from "../utils/pomodoro";
import { useEffect, useState } from "react";
import { Category, CulturalItem, Tier } from "../types";
import { categoryLabels, categorySingular } from "../data/catalog";
import { getTitle } from "../utils/itemHelpers";
import { contentTime, finishSession, formatDuration } from "../utils/contentTimer";
import { BookOpen, Disc3, Film, Gamepad2, Plus, Tv } from "lucide-react";

const drawerIcons = { games: Gamepad2, books: BookOpen, albums: Disc3, movies: Film, series: Tv };

const tiers: Tier[] = ["S", "A", "B", "C", "D"];
type Save = (item: CulturalItem) => void;

export function CollectionTools({ mode, items, onSave, onAdd }: { mode: "tiers" | "timer" | "pomodoro"; items: CulturalItem[]; onSave: Save; onAdd: (category: Category) => void }) {
  const [category, setCategory] = useState<Category>();
  const [selectedId, select] = useState("");
  const cards = items.filter(item => item.category === category);
  const selected = cards.find(item => item.id === selectedId);
  return <section className="collection-tools">
    <header><p className="eyebrow">Ferramentas</p><h1>{mode === "tiers" ? "Tier list" : mode === "timer" ? "Cronômetro" : "Pomodoro"}</h1></header>
    {category && <nav aria-label="Caminho"><button className="ghost" onClick={() => { setCategory(undefined); select(""); }}>‹ Gavetas</button>
      <button className="ghost" disabled={!selected} onClick={() => select("")}>{categoryLabels[category]}</button></nav>}
    {category && !selected && <div><button type="button" className="primary" onClick={() => onAdd(category)}>
      <Plus size={16} aria-hidden="true" /> Adicionar {categorySingular[category]}
    </button></div>}
    {!category ? <div className="tool-picker">{(Object.keys(categoryLabels) as Category[]).map(key => {
      const Icon = drawerIcons[key];
      return <button className="secondary drawer-tool" key={key} onClick={() => setCategory(key)}>
        <Icon size={48} aria-hidden="true" /><span>{categoryLabels[key]}</span>
      </button>;
    })}</div>
    : !cards.length ? <p>Esta gaveta ainda não tem cards.</p>
    : mode === "tiers" ? <TierBoard cards={cards} onSave={onSave} />
    : selected ? <Session pomodoro={mode === "pomodoro"} item={selected} onSave={onSave} />
    : <div className="tool-picker">{cards.map(item => <button className="photo-choice" key={item.id} onClick={() => select(item.id)}>
      <ToolPhoto item={item} />{(mode === "pomodoro" ? item.pomodoro : item.timerStartedAt) ? <small>Em andamento</small> : null}</button>)}</div>}
  </section>;
}

function ToolPhoto({ item }: { item: CulturalItem }) {
  const Icon = drawerIcons[item.category];
  return <span className="tool-photo">
    {item.coverUrl ? <img src={item.coverUrl} alt="" draggable={false} /> : <Icon size={32} aria-hidden="true" />}
    <span>{getTitle(item)}</span>
  </span>;
}

function TierBoard({ cards, onSave }: { cards: CulturalItem[]; onSave: Save }) {
  const [hover, setHover] = useState<string>();
  function move(item: CulturalItem, row: string) {
    const tier = tiers.find(value => value === row);
    if (tier !== item.tier) onSave({ ...item, tier, updatedAt: new Date().toISOString() });
  }
  function targetAt(x: number, y: number) {
    return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tier-row]")?.dataset.tierRow;
  }
  return <div className="tier-board">{[...tiers, undefined].map(tier => {
    const row = tier ?? "none";
    return <section className="tier-row" data-tier-row={row} data-over={hover === row} key={row}>
      <h2>{tier ?? "Sem classificação"}</h2><div>{cards.filter(item => item.tier === tier).map(item =>
        <div className="tier-entry" key={item.id}>
          <div className="tier-handle"
            onPointerDown={e => {
              if (!e.isPrimary || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              e.currentTarget.dataset.dragging = "true";
            }}
            onPointerMove={e => {
              const handle = e.currentTarget;
              if (!handle.hasPointerCapture(e.pointerId)) return;
              const rect = handle.getBoundingClientRect();
              handle.style.setProperty("--dx", (e.clientX - rect.left - rect.width / 2) + "px");
              handle.style.setProperty("--dy", (e.clientY - rect.top - rect.height / 2) + "px");
              setHover(targetAt(e.clientX, e.clientY));
            }}
            onPointerUp={e => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const target = targetAt(e.clientX, e.clientY);
              e.currentTarget.releasePointerCapture(e.pointerId);
              setHover(undefined);
              if (target) move(item, target);
            }}
            onLostPointerCapture={e => { delete e.currentTarget.dataset.dragging; setHover(undefined); }}>
            <ToolPhoto item={item} />
          </div>
          <select aria-label={"Mover " + getTitle(item)} value={row} onChange={e => move(item, e.target.value)}>
            <option value="none">Sem classificação</option>{tiers.map(value => <option key={value}>{value}</option>)}
          </select>
        </div>)}</div>
    </section>;
  })}</div>;
}

function Session({ item, onSave, pomodoro }: { item: CulturalItem; onSave: Save; pomodoro: boolean }) {
  const [now, setNow] = useState(Date.now);
  const running = pomodoro ? item.pomodoro?.start : item.timerStartedAt;
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [running]);
  const elapsed = item.timerStartedAt ? Math.max(0, now - item.timerStartedAt) : 0;
  const phase = item.pomodoro;
  const remaining = phase ? Math.max(0, pomodoroEnd(phase) - now) : 25 * 60_000;
  const display = pomodoro ? formatDuration(Math.ceil(remaining / 1000) * 1000).slice(3) : formatDuration(elapsed);
  const label = pomodoro ? phase?.phase === "break" ? "Pausa" : "Foco" : "Sessão atual";
  const action = pomodoro ? phase?.phase === "break" ? "Finalizar pausa" : phase ? "Encerrar foco e somar" : "Iniciar foco" : item.timerStartedAt ? "Encerrar e somar" : "Iniciar sessão";
  const conflict = pomodoro ? !!item.timerStartedAt : !!phase;
  function toggle() {
    const timestamp = Date.now();
    setNow(timestamp);
    if (pomodoro) {
      onSave(phase ? settlePomodoro(item, timestamp, true) :
        { ...item, pomodoro: { phase: "focus", start: timestamp }, updatedAt: new Date(timestamp).toISOString() });
      return;
    }
    onSave(item.timerStartedAt ? finishSession(item, timestamp) :
      { ...item, timerStartedAt: timestamp, updatedAt: new Date(timestamp).toISOString() });
  }
  return <article className="tool-session"><div className="timer-face">
    {item.coverUrl && <img src={item.coverUrl} alt="" />}
    <div><small>{label}</small><strong role="timer">{display}</strong></div>
  </div><div>
    <h2>{getTitle(item)}</h2>
    <p>Total no card: {formatDuration(contentTime(item) + (pomodoro ? phase?.phase === "focus" ? Math.max(0, Math.min(now, pomodoroEnd(phase)) - phase.start) : 0 : elapsed))}</p>
    {conflict && <p>Encerre a sessão da outra ferramenta neste card para começar.</p>}
    <button className="primary" disabled={conflict} onClick={toggle}>{action}</button>
  </div></article>;
}
