import { Cloud, Eye, GitCompare, Heart, MessageSquare, RefreshCw, ShieldCheck, Sparkles, ThumbsUp, TrendingUp, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppSettings, CloudSession, CulturalItem, FamilyItem, Friendship, SocialProfile } from "../types";
import { categoryLabels } from "../data/catalog";
import { fetchFriendships, fetchSocialItems } from "../services/supabaseCloud";
import { getGenres, getRating, getTitle, isCompleted, isInProgress, isWishlist } from "../utils/itemHelpers";
import { AuthGate } from "./AuthGate";
import { ItemDetails } from "./ItemDetails";

interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  profile?: SocialProfile;
  entries: FamilyItem[];
}

const SOCIAL_REFRESH_INTERVAL_MS = 30_000;

export function SocialFeedView({
  settings,
  session,
  onAuthenticated,
  onUpdateSettings,
}: {
  settings: AppSettings;
  session: CloudSession | null;
  onAuthenticated: (session: CloudSession) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}) {
  const [socialItems, setSocialItems] = useState<FamilyItem[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [feedReactions, setFeedReactions] = useState<Record<string, string>>({});
  const [feedScope, setFeedScope] = useState<"friends" | "mine">("friends");
  const [activeEntry, setActiveEntry] = useState<FamilyItem | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const acceptedFriends = friendships.filter((friendship) => friendship.status === "accepted");
  const groups = useMemo<OwnerGroup[]>(() => {
    if (!session) return [];

    const byOwner = socialItems.reduce<Record<string, OwnerGroup>>((acc, item) => {
      acc[item.ownerId] = acc[item.ownerId] ?? {
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        profile: item.ownerId === session.user.id ? session.profile : acceptedFriends.find((friendship) => friendship.profile.id === item.ownerId)?.profile,
        entries: [],
      };
      acc[item.ownerId].entries.push(item);
      return acc;
    }, {});

    byOwner[session.user.id] = byOwner[session.user.id] ?? {
      ownerId: session.user.id,
      ownerName: session.profile?.displayName || session.user.email || "Você",
      profile: session.profile,
      entries: [],
    };

    acceptedFriends.forEach((friendship) => {
      byOwner[friendship.profile.id] = byOwner[friendship.profile.id] ?? {
        ownerId: friendship.profile.id,
        ownerName: friendship.profile.displayName,
        profile: friendship.profile,
        entries: [],
      };
    });

    return Object.values(byOwner);
  }, [acceptedFriends, session, socialItems]);

  const socialFeed = useMemo(() => buildSocialFeed(socialItems, session?.user.id ?? ""), [session?.user.id, socialItems]);
  const friendFeed = socialFeed.filter((event) => event.entry.ownerId !== session?.user.id);
  const myFeed = socialFeed.filter((event) => event.entry.ownerId === session?.user.id);
  const visibleFeed = (feedScope === "friends" ? friendFeed : myFeed).slice(0, 12);
  const socialComparisons = useMemo(() => buildSocialComparisons(groups, session?.user.id ?? ""), [groups, session?.user.id]);

  useEffect(() => {
    if (!session) return;

    refreshFeed(true);
    const intervalId = window.setInterval(() => refreshFeed(true), SOCIAL_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [session?.user.id]);

  async function refreshFeed(silent = false) {
    if (!session) return;

    if (!silent) {
      setLoading(true);
      setMessage("");
    }

    try {
      const [nextFriendships, nextItems] = await Promise.all([
        fetchFriendships(settings, session),
        fetchSocialItems(settings, session),
      ]);
      setFriendships(nextFriendships);
      setSocialItems(nextItems);
      if (!silent) setMessage("Feed atualizado.");
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "Não foi possível carregar o feed.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  if (!session) {
    return (
      <main className="page">
        <section className="list-header">
          <div>
            <p className="eyebrow">Movimento social</p>
            <h1>Feed</h1>
            <p>Entre para acompanhar atualizações, comparações e sinais leves da sua rede.</p>
          </div>
          <Cloud size={38} />
        </section>
        <AuthGate settings={settings} onUpdateSettings={onUpdateSettings} onAuthenticated={onAuthenticated} layout="panel" />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Movimento social</p>
          <h1>Feed</h1>
          <p>Eventos simples da sua rede e comparações entre gaveteiras, sem transformar tudo em mural barulhento.</p>
        </div>
        <MessageSquare size={38} />
      </section>

      <section className="setting-panel cloud-toolbar">
        <div>
          <h2>{session.profile?.displayName || session.user.email}</h2>
          <p>{socialItems.length} fichas visíveis no seu feed.</p>
        </div>
        <div className="button-row">
          <button className="ghost" onClick={() => refreshFeed()} disabled={loading}><RefreshCw size={16} /> Atualizar feed</button>
        </div>
        {message ? <p className="form-note">{message}</p> : null}
      </section>

      <section className="setting-panel social-feed-panel">
        <div className="section-heading split">
          <div className="section-heading">
            <MessageSquare size={20} />
            <h2>Feed</h2>
          </div>
          <span className="soft-label">sem comentários por enquanto</span>
        </div>
        <div className="feed-scope-tabs" aria-label="Filtrar feed">
          <button
            type="button"
            className={feedScope === "friends" ? "active" : ""}
            onClick={() => setFeedScope("friends")}
          >
            Amigos <span>{friendFeed.length}</span>
          </button>
          <button
            type="button"
            className={feedScope === "mine" ? "active" : ""}
            onClick={() => setFeedScope("mine")}
          >
            Meu movimento <span>{myFeed.length}</span>
          </button>
        </div>
        <div className="social-feed-list">
          {visibleFeed.length ? visibleFeed.map((event) => (
            <article key={event.id} className="social-feed-event">
              <div className={`feed-event-icon feed-event-${event.kind}`}>
                {event.kind === "finished" ? <ShieldCheck size={16} /> : event.kind === "favorite" ? <Heart size={16} /> : event.kind === "opinion" ? <MessageSquare size={16} /> : event.kind === "abandoned" ? <X size={16} /> : <Sparkles size={16} />}
              </div>
              <div>
                <button type="button" className="feed-open-button" onClick={() => setActiveEntry(event.entry)}>
                  <p>{event.text}</p>
                  <small>{event.detail}</small>
                  <span>Abrir ficha</span>
                </button>
                <div className="reaction-row" aria-label="Reações">
                  {["curti", "também quero", "já vi"].map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      className={feedReactions[event.id] === reaction ? "active" : ""}
                      onClick={() => setFeedReactions((current) => ({ ...current, [event.id]: current[event.id] === reaction ? "" : reaction }))}
                    >
                      <ThumbsUp size={13} />
                      {reaction}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          )) : <p className="empty">{feedScope === "friends" ? "Quando seus amigos atualizarem fichas, o movimento aparece aqui." : "Suas próximas alterações aparecem aqui como um histórico leve."}</p>}
        </div>
      </section>

      <section className="setting-panel social-comparison-panel">
        <div className="section-heading">
          <GitCompare size={20} />
          <h2>Comparações</h2>
        </div>
        <div className="comparison-grid">
          <InsightList title="Itens em comum" icon={<Eye size={17} />} items={socialComparisons.commonItems} />
          <InsightList title="Notas diferentes" icon={<GitCompare size={17} />} items={socialComparisons.ratingDifferences} />
          <InsightList title="Wishlist compartilhada" icon={<Sparkles size={17} />} items={socialComparisons.sharedWishlist} />
          <InsightList title="Favoritos do grupo" icon={<Heart size={17} />} items={socialComparisons.favoriteRanking} />
          <InsightList title="Gêneros da galera" icon={<TrendingUp size={17} />} items={socialComparisons.topGenres} />
          <InsightList title="Ativos agora" icon={<Users size={17} />} items={socialComparisons.activePeople} />
        </div>
      </section>

      {activeEntry ? <ItemDetails item={activeEntry.item} ownerName={activeEntry.ownerName} onClose={() => setActiveEntry(null)} /> : null}
    </main>
  );
}

function InsightList({ title, icon, items }: { title: string; icon: ReactNode; items: string[] }) {
  return (
    <section className="comparison-card">
      <h3>{icon}{title}</h3>
      <div className="comparison-list">
        {items.length ? items.map((item) => <span key={item}>{item}</span>) : <p className="empty">Ainda sem sinais suficientes.</p>}
      </div>
    </section>
  );
}

type FeedKind = "added" | "finished" | "abandoned" | "favorite" | "opinion" | "wishlist";

interface FeedEvent {
  id: string;
  kind: FeedKind;
  entry: FamilyItem;
  text: string;
  detail: string;
  updatedAt: string;
}

function buildSocialFeed(entries: FamilyItem[], viewerId: string): FeedEvent[] {
  return [...entries]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((entry) => {
      const actor = entry.ownerId === viewerId ? "Você" : entry.ownerName;
      const title = getTitle(entry.item) || "uma ficha";
      const rating = getRating(entry.item);
      const category = categoryLabels[entry.item.category];
      const opinion = getFinalOpinion(entry.item);
      const abandoned = entry.item.status.toLowerCase().includes("abandon");
      const detailParts = [category, entry.item.status, rating ? `${rating} estrelas` : "", formatDate(entry.updatedAt)].filter(Boolean);

      if (abandoned) {
        return { id: `feed-${entry.ownerId}-${entry.id}-abandoned`, kind: "abandoned" as FeedKind, entry, text: `${actor} abandonou ${title}.`, detail: detailParts.join(" / "), updatedAt: entry.updatedAt };
      }

      if (isCompleted(entry.item)) {
        return { id: `feed-${entry.ownerId}-${entry.id}-finished`, kind: "finished" as FeedKind, entry, text: `${actor} terminou ${title}${rating ? ` e deu ${rating} estrelas` : ""}.`, detail: detailParts.join(" / "), updatedAt: entry.updatedAt };
      }

      if (rating >= 4.5) {
        return { id: `feed-${entry.ownerId}-${entry.id}-favorite`, kind: "favorite" as FeedKind, entry, text: `${actor} colocou ${title} entre os favoritos.`, detail: detailParts.join(" / "), updatedAt: entry.updatedAt };
      }

      if (isWishlist(entry.item)) {
        return { id: `feed-${entry.ownerId}-${entry.id}-wishlist`, kind: "wishlist" as FeedKind, entry, text: `${actor} quer consumir ${title}.`, detail: detailParts.join(" / "), updatedAt: entry.updatedAt };
      }

      if (opinion) {
        return { id: `feed-${entry.ownerId}-${entry.id}-opinion`, kind: "opinion" as FeedKind, entry, text: `${actor} escreveu uma opinião sobre ${title}.`, detail: opinion.length > 90 ? `${opinion.slice(0, 90)}...` : opinion, updatedAt: entry.updatedAt };
      }

      return { id: `feed-${entry.ownerId}-${entry.id}-added`, kind: "added" as FeedKind, entry, text: `${actor} adicionou ${title}.`, detail: detailParts.join(" / "), updatedAt: entry.updatedAt };
    });
}

function buildSocialComparisons(groups: OwnerGroup[], viewerId: string) {
  const entries = groups.flatMap((group) => group.entries);
  const byWork = groupComparableEntries(entries);
  const commonItems = byWork
    .filter(([, workEntries]) => new Set(workEntries.map((entry) => entry.ownerId)).size > 1)
    .slice(0, 6)
    .map(([, workEntries]) => `${getTitle(workEntries[0].item)}: ${ownerNames(workEntries, viewerId).join(", ")}`);

  const ratingDifferences = byWork
    .map(([, workEntries]) => {
      const rated = workEntries.filter((entry) => getRating(entry.item) > 0);
      const owners = new Set(rated.map((entry) => entry.ownerId));
      if (owners.size < 2) return "";
      const ratings = rated.map((entry) => getRating(entry.item));
      const spread = Math.max(...ratings) - Math.min(...ratings);
      if (spread < 1) return "";
      return `${getTitle(rated[0].item)}: ${rated.map((entry) => `${entry.ownerId === viewerId ? "você" : entry.ownerName} ${getRating(entry.item)}`).join(" x ")}`;
    })
    .filter(Boolean)
    .slice(0, 6);

  const sharedWishlist = byWork
    .filter(([, workEntries]) => workEntries.filter((entry) => isWishlist(entry.item)).length > 1)
    .slice(0, 6)
    .map(([, workEntries]) => `${ownerNames(workEntries.filter((entry) => isWishlist(entry.item)), viewerId).join(" e ")} querem ${getTitle(workEntries[0].item)}`);

  const favoriteRanking = [...entries]
    .filter((entry) => getRating(entry.item) >= 4.5)
    .sort((a, b) => getRating(b.item) - getRating(a.item))
    .slice(0, 6)
    .map((entry) => `${getTitle(entry.item)} (${entry.ownerId === viewerId ? "você" : entry.ownerName}, ${getRating(entry.item)})`);

  const topGenres = topEntries(entries.flatMap((entry) => getGenres(entry.item)), 6);
  const activePeople = groups
    .map((group) => {
      const count = group.entries.filter((entry) => isInProgress(entry.item)).length;
      return count ? `${group.ownerId === viewerId ? "Você" : group.ownerName}: ${count} em andamento` : "";
    })
    .filter(Boolean)
    .slice(0, 6);

  return { commonItems, ratingDifferences, sharedWishlist, favoriteRanking, topGenres, activePeople };
}

function groupComparableEntries(entries: FamilyItem[]) {
  const groups = entries.reduce<Record<string, FamilyItem[]>>((acc, entry) => {
    const key = comparableKey(entry.item);
    if (!key) return acc;
    acc[key] = acc[key] ?? [];
    acc[key].push(entry);
    return acc;
  }, {});

  return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
}

function comparableKey(item: CulturalItem) {
  const title = getTitle(item)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return title ? `${item.category}:${title}` : "";
}

function ownerNames(entries: FamilyItem[], viewerId: string) {
  return [...new Set(entries.map((entry) => entry.ownerId === viewerId ? "você" : entry.ownerName))];
}

function getFinalOpinion(item: CulturalItem) {
  if (item.category === "books") return item.finalOpinion || item.personalSummary || "";
  if (item.category === "albums") return item.comments || "";
  if (item.category === "movies" || item.category === "series") return item.comments || "";
  return item.notes || "";
}

function topEntries(values: string[], limit: number) {
  const counts = values.filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
