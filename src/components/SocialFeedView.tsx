import { BookmarkPlus, CheckCircle2, Cloud, Heart, Loader2, MessageSquare, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppSettings, CloudSession, CulturalItem, FamilyItem } from "../types";
import { categoryLabels, defaultStatuses } from "../data/catalog";
import { CloudSocialFeedEvent, fetchMyProfile, fetchSocialFeed, fetchSocialItems, upsertMyItem } from "../services/supabaseCloud";
import { getRating, getTitle, isCompleted, isWishlist, uid } from "../utils/itemHelpers";
import { AuthGate } from "./AuthGate";
import { ItemDetails } from "./ItemDetails";

const SOCIAL_REFRESH_INTERVAL_MS = 30_000;

export function SocialFeedView({
  settings,
  session,
  localItems,
  onMergeItems,
  onAuthenticated,
  onUpdateSettings,
}: {
  settings: AppSettings;
  session: CloudSession | null;
  localItems: CulturalItem[];
  onMergeItems: (items: CulturalItem[]) => void;
  onAuthenticated: (session: CloudSession) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}) {
  const [socialItems, setSocialItems] = useState<FamilyItem[]>([]);
  const [cloudFeedEvents, setCloudFeedEvents] = useState<FeedEvent[]>([]);
  const [savingEventId, setSavingEventId] = useState("");
  const [feedScope, setFeedScope] = useState<"friends" | "mine">("friends");
  const [activeEntry, setActiveEntry] = useState<FamilyItem | null>(null);
  const [activeDiaryId, setActiveDiaryId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedLoaded, setFeedLoaded] = useState(false);
  const feedLoadedRef = useRef(false);

  const socialFeed = useMemo(() => {
    const viewerId = session?.user.id ?? "";
    const feed = cloudFeedEvents.length ? cloudFeedEvents : buildSocialFeed(socialItems, viewerId);
    return dedupeFeedEvents(feed);
  }, [cloudFeedEvents, session?.user.id, socialItems]);
  const friendFeed = socialFeed.filter((event) => event.entry.ownerId !== session?.user.id);
  const myFeed = socialFeed.filter((event) => event.entry.ownerId === session?.user.id);
  const visibleFeed = (feedScope === "friends" ? friendFeed : myFeed).slice(0, 12);
  const savedWorkKeys = useMemo(() => {
    const viewerId = session?.user.id ?? "";
    const cloudItems = socialItems
      .filter((entry) => entry.ownerId === viewerId)
      .map((entry) => entry.item);
    return new Set([...localItems, ...cloudItems].map(comparableKey).filter(Boolean));
  }, [localItems, session?.user.id, socialItems]);

  useEffect(() => {
    if (!session) return;

    feedLoadedRef.current = false;
    setFeedLoaded(false);
    refreshFeed(true);
    const intervalId = window.setInterval(() => refreshFeed(true), SOCIAL_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [session?.user.id]);

  async function refreshFeed(silent = false) {
    if (!session) return;

    const showBusy = !silent || !feedLoadedRef.current;

    if (showBusy) {
      setLoading(true);
      setMessage("");
    }

    try {
      const [nextItems, freshProfile] = await Promise.all([
        fetchSocialItems(settings, session),
        fetchMyProfile(settings, session),
      ]);
      const backendFeed = await fetchSocialFeed(settings, session).catch(() => []);
      setSocialItems(nextItems);
      setCloudFeedEvents(backendFeed.map((event) => cloudFeedEventToFeedEvent(event, session.user.id)));
      if (JSON.stringify(freshProfile) !== JSON.stringify(session.profile)) {
        onAuthenticated({ ...session, profile: freshProfile });
      }
      feedLoadedRef.current = true;
      setFeedLoaded(true);
      if (!silent) setMessage("Feed conferido. O arquivo social está em dia.");
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "Não consegui abrir o Feed agora.");
      }
    } finally {
      if (showBusy) setLoading(false);
    }
  }

  async function saveFromFeed(event: FeedEvent) {
    if (!session || event.entry.ownerId === session.user.id || savedWorkKeys.has(comparableKey(event.entry.item))) return;

    const item = createWishlistCopy(event.entry.item);
    setSavingEventId(event.id);
    setMessage("");

    try {
      await upsertMyItem(settings, session, item);
      onMergeItems([item]);
      setSocialItems((current) => [{
        id: item.id,
        ownerId: session.user.id,
        ownerName: session.profile?.displayName || session.user.email || "Você",
        familyCode: "social",
        item,
        updatedAt: item.updatedAt,
      }, ...current]);
      setMessage(`${getTitle(item) || "Ficha"} entrou na sua wishlist.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui guardar essa ficha agora.");
    } finally {
      setSavingEventId("");
    }
  }

  if (!session) {
    return (
      <main className="page">
        <section className="list-header">
          <div>
            <p className="eyebrow">Movimento social</p>
            <h1>Feed</h1>
            <p>Entre para acompanhar atualizações e sinais leves da sua rede.</p>
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
          <p>Eventos simples da sua rede e notas públicas, sem transformar tudo em mural barulhento.</p>
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
          <span className="soft-label">movimento leve, sem placar</span>
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
          {loading && !feedLoaded ? <FeedSkeletonList /> : visibleFeed.length ? visibleFeed.map((event) => (
            <FeedEventCard
              key={event.id}
              event={event}
              saved={savedWorkKeys.has(comparableKey(event.entry.item))}
              saving={savingEventId === event.id}
              viewerId={session.user.id}
              onOpen={() => openFeedEvent(event)}
              onSave={() => saveFromFeed(event)}
            />
          )) : <p className="empty">{feedScope === "friends" ? "Quando seus amigos mexerem nas gavetas, o movimento aparece aqui." : "Suas próximas fichas e alterações ficam registradas aqui."}</p>}
        </div>
      </section>

      {activeEntry ? <ItemDetails item={activeEntry.item} ownerName={activeEntry.ownerName} focusDiaryId={activeDiaryId} onClose={() => { setActiveEntry(null); setActiveDiaryId(undefined); }} /> : null}
    </main>
  );

  function openFeedEvent(event: FeedEvent) {
    setActiveEntry(event.entry);
    setActiveDiaryId(event.diaryId);
  }
}

function FeedSkeletonList({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {[0, 1, 2].slice(0, compact ? 2 : 3).map((item) => (
        <article className="social-feed-event social-feed-skeleton" key={item} aria-label="Carregando movimento do feed">
          <div className="feed-event-icon skeleton-block" />
          <div>
            <span className="skeleton-line skeleton-line-title" />
            <span className="skeleton-line skeleton-line-long" />
            <span className="skeleton-pill-row">
              <i className="skeleton-pill" />
              <i className="skeleton-pill short" />
            </span>
          </div>
        </article>
      ))}
    </>
  );
}

function FeedEventCard({
  event,
  saved,
  saving,
  viewerId,
  onOpen,
  onSave,
}: {
  event: FeedEvent;
  saved: boolean;
  saving: boolean;
  viewerId: string;
  onOpen: () => void;
  onSave: () => void;
}) {
  const ownEvent = event.entry.ownerId === viewerId;

  return (
    <article className="social-feed-event">
      <div className={`feed-event-icon feed-event-${event.kind}`}>
        {event.kind === "finished" ? <ShieldCheck size={16} /> : event.kind === "favorite" ? <Heart size={16} /> : event.kind === "opinion" || event.kind === "diary" ? <MessageSquare size={16} /> : event.kind === "abandoned" ? <X size={16} /> : <Sparkles size={16} />}
      </div>
      <div>
        <button type="button" className="feed-open-button" onClick={onOpen}>
          <p>{event.text}</p>
          <small>{event.detail}</small>
          <span>Abrir ficha</span>
        </button>
        <div className="feed-action-row">
          {ownEvent ? (
            <span><CheckCircle2 size={13} /> Sua ficha</span>
          ) : saved ? (
            <span><CheckCircle2 size={13} /> Na sua gaveteira</span>
          ) : (
            <button type="button" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 size={13} /> : <BookmarkPlus size={13} />}
              Quero na minha gaveteira
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

type FeedKind = "added" | "finished" | "abandoned" | "favorite" | "opinion" | "wishlist" | "diary";

interface FeedEvent {
  id: string;
  kind: FeedKind;
  entry: FamilyItem;
  text: string;
  detail: string;
  updatedAt: string;
  diaryId?: string;
}

function dedupeFeedEvents(events: FeedEvent[]) {
  const seen = new Set<string>();

  return [...events]
    .sort((a, b) => (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      || feedKindPriority(b.kind) - feedKindPriority(a.kind)
      || a.text.localeCompare(b.text)
    ))
    .filter((event) => {
      const key = feedEventDedupeKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function feedEventDedupeKey(event: FeedEvent) {
  return `${event.entry.ownerId}:${comparableKey(event.entry.item) || event.entry.id}`;
}

function feedKindPriority(kind: FeedKind) {
  if (kind === "finished" || kind === "abandoned") return 7;
  if (kind === "favorite") return 6;
  if (kind === "wishlist") return 5;
  if (kind === "diary") return 4;
  if (kind === "opinion") return 3;
  return 2;
}

function buildSocialFeed(entries: FamilyItem[], viewerId: string): FeedEvent[] {
  return [...entries]
    .filter((entry) => entry.item.visibility !== "private")
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

function cloudFeedEventToFeedEvent(event: CloudSocialFeedEvent, viewerId: string): FeedEvent {
  const entry: FamilyItem = {
    id: event.itemId,
    ownerId: event.itemOwnerId,
    ownerName: event.actorId === viewerId ? "Você" : event.actorName,
    familyCode: "social",
    item: event.item,
    updatedAt: event.createdAt,
  };
  const actor = event.actorId === viewerId ? "Você" : event.actorName;
  const title = getTitle(event.item) || "uma ficha";
  const rating = getRating(event.item);
  const detailParts = [categoryLabels[event.item.category], event.item.status, rating ? `${rating} estrelas` : "", formatDate(event.createdAt)].filter(Boolean);

  return {
    id: `cloud-feed-${event.eventId}`,
    kind: event.eventType === "updated" ? "added" : event.eventType,
    entry,
    text: cloudFeedText(event.eventType, actor, title, rating),
    detail: event.eventType === "diary" ? "Entrada pública de diário" : detailParts.join(" / "),
    updatedAt: event.createdAt,
    diaryId: event.diaryId,
  };
}

function cloudFeedText(kind: CloudSocialFeedEvent["eventType"], actor: string, title: string, rating: number) {
  if (kind === "abandoned") return `${actor} abandonou ${title}.`;
  if (kind === "finished") return `${actor} terminou ${title}${rating ? ` e deu ${rating} estrelas` : ""}.`;
  if (kind === "favorite") return `${actor} colocou ${title} entre os favoritos.`;
  if (kind === "wishlist") return `${actor} quer consumir ${title}.`;
  if (kind === "diary") return `${actor} escreveu no diário de ${title}.`;
  if (kind === "updated") return `${actor} atualizou ${title}.`;
  return `${actor} adicionou ${title}.`;
}

function comparableKey(item: CulturalItem) {
  const title = getTitle(item);
  if (!title) return "";

  const normalizedTitle = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalizedTitle ? `${item.category}:${normalizedTitle}` : "";
}

function createWishlistCopy(source: CulturalItem): CulturalItem {
  const now = new Date().toISOString();
  const base = {
    id: uid(`feed-${source.category}`),
    category: source.category,
    status: defaultStatuses[source.category][0],
    visibility: "friends" as const,
    tags: [],
    coverUrl: source.coverUrl,
    links: [],
    timeline: [],
    diary: [],
    createdAt: now,
    updatedAt: now,
  };

  if (source.category === "games") {
    return {
      ...base,
      category: "games",
      name: source.name,
      platform: source.platform || "",
      developer: source.developer,
      publisher: source.publisher,
      releaseYear: source.releaseYear,
      genre: source.genre,
    };
  }

  if (source.category === "books") {
    return {
      ...base,
      category: "books",
      title: source.title,
      author: source.author,
      pages: source.pages,
      format: source.format,
      publisher: source.publisher,
      publicationYear: source.publicationYear,
      genre: source.genre,
    };
  }

  if (source.category === "albums") {
    return {
      ...base,
      category: "albums",
      name: source.name,
      artist: source.artist,
      releaseYear: source.releaseYear,
      genre: source.genre,
    };
  }

  if (source.category === "movies") {
    return {
      ...base,
      category: "movies",
      title: source.title,
      year: source.year,
      director: source.director,
      runtimeMinutes: source.runtimeMinutes,
      genre: source.genre,
    };
  }

  return {
    ...base,
    category: "series",
    title: source.title,
    year: source.year,
    genre: source.genre,
  };
}

function getFinalOpinion(item: CulturalItem) {
  if (item.category === "books") return item.finalOpinion || item.personalSummary || "";
  if (item.category === "albums") return item.comments || "";
  if (item.category === "movies" || item.category === "series") return item.comments || "";
  return item.notes || "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
