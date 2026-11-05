import { Diamond, Medal, Monitor } from "lucide-react";
import { CulturalItem } from "../types";
import { isCompleted } from "../utils/itemHelpers";
import { getGamePlatform } from "../utils/gameFields";

export function CompletionBadges({ item }: { item: CulturalItem }) {
  const platinum = item.category === "games" && (item.status.toLowerCase() === "platinado" || item.completionType === "Platinou");
  const completed = isCompleted(item) || (item.category === "games" && ["Zerou", "Platinou", "Terminou a história"].includes(item.completionType ?? ""));
  if (!completed && !platinum) return null;
  return <div className="completion-badges">
    {completed ? <span className="completion-badge medal-badge" role="img" aria-label="Finalizado" title="Finalizado"><Medal size={16} aria-hidden="true" /></span> : null}
    {platinum ? <span className="completion-badge platinum-badge" role="img" aria-label="Platinado" title="Platinado"><Diamond size={16} aria-hidden="true" /></span> : null}
  </div>;
}

export function PlatformIndicator({ item }: { item: CulturalItem }) {
  if (item.category !== "games") return null;
  const platform = getGamePlatform(item);
  if (!platform) return null;
  return <span className="platform-indicator" title={`Jogado em ${platform}`}>
    {platform === "Computador" ? <Monitor size={18} aria-hidden="true" /> : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      {platform === "PlayStation" ? <path d="M8 2v17l4 1.3V6.1c0-1.3.5-1.7 1.3-1.4 1 .3 1.2 1.3 1.2 2.5v5.5c3.3 1.6 5.9 0 5.9-4.2 0-4.3-4.6-5.4-12.4-6.5ZM6.5 15l-4.2 1.5c-2.2.8-2.6 2.1-.6 2.8 1.8.7 3.4.8 5.2.5v-2l-1.8.6c-.7.2-1.2-.1-.5-.4l1.9-.7Zm7 3.1 5.3-1.9c.8-.3 1.4 0 .6.3l-5.9 2.2v2.1l8.3-3c2.3-.8 2.5-2.1.4-2.8-2.4-.8-5.1-.6-8.7.7Z" /> : null}
      {platform === "Xbox" ? <><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5 4c3 0 5 1.3 7 3 2-1.7 4-3 7-3l-5 5c3 3.5 5 7 5 10-2-4-4.5-7-7-9-2.5 2-5 5-7 9 0-3 2-6.5 5-10Z" /></> : null}
      {platform === "Nintendo Switch" ? <><rect x="2" y="2" width="9" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="14" y="2" width="8" height="20" rx="4" /><circle cx="6.5" cy="8" r="2" /><circle cx="18" cy="15" r="2" fill="var(--platform-icon-cutout, #fffaf1)" /></> : null}
    </svg>}
    <span>{platform}</span>
  </span>;
}
