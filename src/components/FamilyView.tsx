import { CalendarDays, Cloud, Heart, LogOut, RefreshCw, Sparkles, UploadCloud, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppSettings, CloudSession, CulturalItem, FamilyItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { fetchFamilyItems, fetchMyItems, syncMyItems } from "../services/supabaseCloud";
import { getGenres, getRating, getTitle, getYear, isCompleted, isInProgress, isWishlist } from "../utils/itemHelpers";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { ItemDetails } from "./ItemDetails";
import { Category } from "../types";
import { AuthGate } from "./AuthGate";

interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  entries: FamilyItem[];
}

const FAMILY_REFRESH_INTERVAL_MS = 30_000;

export function FamilyView({
  settings,
  session,
  localItems,
  onMergeItems,
  onLogout,
  onAuthenticated,
  onUpdateSettings,
}: {
  settings: AppSettings;
  session: CloudSession | null;
  localItems: CulturalItem[];
  onMergeItems: (items: CulturalItem[]) => void;
  onLogout: () => void;
  onAuthenticated: (session: CloudSession) => void;
  onUpdateSettings: (settings: AppSettings) => void;
}) {
  const [familyItems, setFamilyItems] = useState<FamilyItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [sortMode, setSortMode] = useState<"ratingDesc" | "ratingAsc" | "recent">("ratingDesc");
  const [activeEntry, setActiveEntry] = useState<FamilyItem | null>(null);

  const groups = useMemo<OwnerGroup[]>(() => {
    const byOwner = familyItems.reduce<Record<string, OwnerGroup>>((acc, item) => {
      acc[item.ownerId] = acc[item.ownerId] ?? {
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        entries: [],
      };
      acc[item.ownerId].entries.push(item);
      return acc;
    }, {});

    return Object.values(byOwner).sort((a, b) => {
      if (a.ownerId === session?.user.id) return -1;
      if (b.ownerId === session?.user.id) return 1;
      return a.ownerName.localeCompare(b.ownerName);
    });
  }, [familyItems, session?.user.id]);

  const selectedGroup = groups.find((group) => group.ownerId === selectedOwnerId) ?? groups[0];
  const selectedProfile = selectedGroup ? buildMemberProfile(selectedGroup) : null;
  const groupedByCategory = selectedGroup ? groupEntriesByCategory(selectedGroup.entries, sortMode) : [];

  useEffect(() => {
    if (!groups.length && selectedOwnerId) {
      setSelectedOwnerId("");
    }

    if (groups.length && !groups.some((group) => group.ownerId === selectedOwnerId)) {
      setSelectedOwnerId(groups[0].ownerId);
    }
  }, [groups, selectedOwnerId]);

  useEffect(() => {
    if (!session) return;

    refreshFamily(true);
    const intervalId = window.setInterval(() => refreshFamily(true), FAMILY_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [settings.cloud?.familyCode, session?.user.id]);

  async function uploadLocal() {
    if (!session) {
      setMessage("Entre para enviar seus itens para a familia.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await syncMyItems(settings, session, localItems);
      setMessage("Sua gaveteira foi enviada para a nuvem.");
      await refreshFamily(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar seus itens.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadMine() {
    if (!session) {
      setMessage("Entre para baixar os itens da sua conta.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const items = await fetchMyItems(settings, session);
      onMergeItems(items);
      setMessage("Itens da sua conta foram mesclados neste navegador.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel baixar seus itens.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshFamily(silent = false) {
    if (!session) return;

    if (!silent) {
      setLoading(true);
      setMessage("");
    }

    try {
      setFamilyItems(await fetchFamilyItems(settings, session));
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar a familia.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  if (!session) {
    return (
      <main className="page">
        <section className="list-header">
          <div>
            <p className="eyebrow">Opcional</p>
            <h1>Familia</h1>
            <p>Voce pode usar a Gaveteira inteira no modo local. Conecte uma conta apenas quando quiser sincronizar e comparar gavetas com outras pessoas.</p>
          </div>
          <Cloud size={38} />
        </section>

        <section className="setting-panel cloud-toolbar">
          <div>
            <h2>Modo local ativo</h2>
            <p>{localItems.length} itens salvos neste navegador. Nada sera enviado para o Supabase ate voce entrar.</p>
          </div>
        </section>

        <AuthGate settings={settings} onUpdateSettings={onUpdateSettings} onAuthenticated={onAuthenticated} layout="panel" />
      </main>
    );
  }

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Gaveteira compartilhada</p>
          <h1>Familia</h1>
          <p>Cada login guarda a propria gaveteira. Voce pode abrir a lista de cada pessoa separadamente.</p>
        </div>
        <Users size={38} />
      </section>

      <>
          <section className="setting-panel cloud-toolbar">
            <div>
              <h2>{session.profile?.displayName || session.user.email}</h2>
              <p>Familia: <strong>{settings.cloud?.familyCode}</strong></p>
            </div>
            <div className="button-row">
              <button className="primary" onClick={uploadLocal} disabled={loading}><UploadCloud size={16} /> Enviar meus itens</button>
              <button className="ghost" onClick={downloadMine} disabled={loading}><Cloud size={16} /> Baixar minha conta</button>
              <button className="ghost" onClick={() => refreshFamily()} disabled={loading}><RefreshCw size={16} /> Atualizar familia</button>
              <button className="danger" onClick={onLogout}><LogOut size={16} /> Sair</button>
            </div>
            {message ? <p className="form-note">{message}</p> : null}
          </section>

          <section className="section">
            <h2>Gaveteiras da familia</h2>
            {groups.length ? (
              <>
                <div className="family-owners">
                  {groups.map((group) => (
                    <button
                      key={group.ownerId}
                      className={group.ownerId === selectedGroup?.ownerId ? "active" : ""}
                      onClick={() => setSelectedOwnerId(group.ownerId)}
                    >
                      <strong>{group.ownerId === session.user.id ? "Minha gaveteira" : group.ownerName}</strong>
                      <small>{group.entries.length} itens</small>
                    </button>
                  ))}
                </div>

                {selectedGroup ? (
                  <div className="family-group">
                    <div className="section-heading split">
                      <div>
                        <h3>{selectedGroup.ownerId === session.user.id ? "Minha gaveteira" : `Gaveteira de ${selectedGroup.ownerName}`}</h3>
                        <p className="empty">Lista separada desta conta.</p>
                      </div>
                      <div className="family-sort">
                        <span>Ordenar</span>
                        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                          <option value="ratingDesc">Maior nota</option>
                          <option value="ratingAsc">Menor nota</option>
                          <option value="recent">Mais recentes</option>
                        </select>
                      </div>
                      <div className="family-mini-stats">
                        {Object.entries(categoryLabels).map(([category, label]) => (
                          <span key={category}>
                            <strong>{selectedGroup.entries.filter((entry) => entry.item.category === category).length}</strong>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {selectedProfile ? (
                      <section className="member-profile-card">
                        <div className="member-profile-header">
                          <div>
                            <p className="eyebrow">Perfil-gaveteira</p>
                            <h2>Arquivo de {selectedGroup.ownerId === session.user.id ? "voce" : selectedGroup.ownerName}</h2>
                            <p>{selectedProfile.summary}</p>
                          </div>
                          <div className="member-profile-stamp">
                            <strong>{selectedProfile.total}</strong>
                            <span>itens</span>
                          </div>
                        </div>

                        <div className="member-profile-metrics">
                          <ProfileMetric label="Media geral" value={selectedProfile.average ? selectedProfile.average.toFixed(1) : "--"} />
                          <ProfileMetric label="Concluidos" value={selectedProfile.completed} />
                          <ProfileMetric label="Em andamento" value={selectedProfile.inProgress} />
                          <ProfileMetric label="Wishlist" value={selectedProfile.wishlist} />
                          <ProfileMetric label="Categoria dominante" value={selectedProfile.topCategory} />
                          <ProfileMetric label="Genero mais comum" value={selectedProfile.topGenre || "--"} />
                        </div>

                        <div className="member-category-row">
                          {selectedProfile.categoryCards.map((card) => (
                            <span key={card.category}>
                              <strong>{card.count}</strong>
                              {categoryLabels[card.category]}
                            </span>
                          ))}
                        </div>

                        <div className="member-profile-sections">
                          <section>
                            <h3><Heart size={18} /> Favoritos</h3>
                            <div className="member-highlight-list">
                              {selectedProfile.favorites.length ? selectedProfile.favorites.map((entry) => (
                                <button key={`fav-${entry.ownerId}-${entry.id}`} className="member-highlight-item" onClick={() => setActiveEntry(entry)}>
                                  <Cover item={entry.item} compact />
                                  <span>
                                    <strong>{getTitle(entry.item)}</strong>
                                    <small>{categoryLabels[entry.item.category]} / {entry.item.status}</small>
                                    <Stars value={entry.item.rating} />
                                  </span>
                                </button>
                              )) : <p className="empty">Sem itens avaliados ainda.</p>}
                            </div>
                          </section>

                          <section>
                            <h3><CalendarDays size={18} /> Ultimas adicoes</h3>
                            <div className="member-recent-list">
                              {selectedProfile.recent.length ? selectedProfile.recent.map((entry) => (
                                <button key={`recent-${entry.ownerId}-${entry.id}`} className="member-recent-item" onClick={() => setActiveEntry(entry)}>
                                  <Sparkles size={16} />
                                  <span>
                                    <strong>{getTitle(entry.item)}</strong>
                                    <small>{categoryLabels[entry.item.category]} / {formatDate(entry.updatedAt)}</small>
                                  </span>
                                </button>
                              )) : <p className="empty">Nada sincronizado ainda.</p>}
                            </div>
                          </section>
                        </div>
                      </section>
                    ) : null}

                    <div className="family-category-stack">
                      {groupedByCategory.map(([category, entries]) => (
                        <section key={category} className={`family-category family-category-${category}`}>
                          <h4>{categoryLabels[category]}</h4>
                          <div className="family-grid">
                            {entries.map((entry) => (
                              <button key={`${entry.ownerId}-${entry.id}`} className="family-card" onClick={() => setActiveEntry(entry)}>
                                <Cover item={entry.item} compact />
                                <div>
                                  <strong>{getTitle(entry.item)}</strong>
                                  <small>{entry.item.status}{getYear(entry.item) ? ` / ${getYear(entry.item)}` : ""}</small>
                                  <Stars value={entry.item.rating} />
                                </div>
                              </button>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : <p className="empty">Sincronize seus itens ou atualize a familia para preencher as gaveteiras.</p>}
          </section>
        </>
      {activeEntry ? <ItemDetails item={activeEntry.item} ownerName={activeEntry.ownerName} onClose={() => setActiveEntry(null)} /> : null}
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function groupEntriesByCategory(entries: FamilyItem[], sortMode: "ratingDesc" | "ratingAsc" | "recent"): Array<[Category, FamilyItem[]]> {
  const categories = Object.keys(categoryLabels) as Category[];
  return categories
    .map((category) => [
      category,
      entries
        .filter((entry) => entry.item.category === category)
        .sort((a, b) => sortEntries(a, b, sortMode)),
    ] as [Category, FamilyItem[]])
    .filter(([, categoryEntries]) => categoryEntries.length);
}

function sortEntries(a: FamilyItem, b: FamilyItem, sortMode: "ratingDesc" | "ratingAsc" | "recent") {
  if (sortMode === "recent") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  const diff = getRating(a.item) - getRating(b.item);
  if (sortMode === "ratingAsc") return diff || getTitle(a.item).localeCompare(getTitle(b.item));
  return -diff || getTitle(a.item).localeCompare(getTitle(b.item));
}

function buildMemberProfile(group: OwnerGroup) {
  const entries = group.entries;
  const total = entries.length;
  const ratings: number[] = entries.map((entry) => getRating(entry.item)).filter((rating) => rating > 0);
  const average = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
  const categoryCards = (Object.keys(categoryLabels) as Category[]).map((category) => ({
    category,
    count: entries.filter((entry) => entry.item.category === category).length,
  }));
  const topCategoryEntry = [...categoryCards].sort((a, b) => b.count - a.count)[0];
  const topGenre = topEntry(entries.flatMap((entry) => getGenres(entry.item)));
  const completed = entries.filter((entry) => isCompleted(entry.item)).length;
  const inProgress = entries.filter((entry) => isInProgress(entry.item)).length;
  const wishlist = entries.filter((entry) => isWishlist(entry.item)).length;
  const favorites = [...entries]
    .filter((entry) => getRating(entry.item) > 0)
    .sort((a, b) => getRating(b.item) - getRating(a.item) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const recent = [...entries]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  const topCategory = topCategoryEntry?.count ? categoryLabels[topCategoryEntry.category] : "--";
  const summaryParts = [
    topCategoryEntry?.count ? `mais presente em ${categoryLabels[topCategoryEntry.category]}` : "",
    topGenre ? `genero recorrente: ${topGenre}` : "",
    inProgress ? `${inProgress} em andamento` : "",
  ].filter(Boolean);

  return {
    total,
    average,
    completed,
    inProgress,
    wishlist,
    topCategory,
    topGenre,
    categoryCards,
    favorites,
    recent,
    summary: summaryParts.length ? summaryParts.join(" / ") : "Um resumo aparece aqui conforme a gaveteira ganha novas fichas.",
  };
}

function topEntry(values: string[]) {
  const counts = values.filter(Boolean).reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
