import { Cloud, LogOut, RefreshCw, UploadCloud, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppSettings, CloudSession, CulturalItem, FamilyItem } from "../types";
import { categoryLabels } from "../data/catalog";
import { fetchFamilyItems, fetchMyItems, syncMyItems } from "../services/supabaseCloud";
import { getRating, getTitle, getYear } from "../utils/itemHelpers";
import { Cover } from "./Cover";
import { Stars } from "./Rating";
import { ItemDetails } from "./ItemDetails";
import { Category } from "../types";

interface OwnerGroup {
  ownerId: string;
  ownerName: string;
  entries: FamilyItem[];
}

export function FamilyView({
  settings,
  session,
  localItems,
  onMergeItems,
  onLogout,
}: {
  settings: AppSettings;
  session: CloudSession;
  localItems: CulturalItem[];
  onMergeItems: (items: CulturalItem[]) => void;
  onLogout: () => void;
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
  const groupedByCategory = selectedGroup ? groupEntriesByCategory(selectedGroup.entries, sortMode) : [];

  useEffect(() => {
    if (!groups.length && selectedOwnerId) {
      setSelectedOwnerId("");
    }

    if (groups.length && !groups.some((group) => group.ownerId === selectedOwnerId)) {
      setSelectedOwnerId(groups[0].ownerId);
    }
  }, [groups, selectedOwnerId]);

  async function uploadLocal() {
    setLoading(true);
    setMessage("");

    try {
      await syncMyItems(settings, session, localItems);
      setMessage("Sua gaveteira foi enviada para a nuvem.");
      await refreshFamily();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar seus itens.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadMine() {
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

  async function refreshFamily() {
    setLoading(true);
    setMessage("");

    try {
      setFamilyItems(await fetchFamilyItems(settings, session));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar a familia.");
    } finally {
      setLoading(false);
    }
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
              <button className="ghost" onClick={refreshFamily} disabled={loading}><RefreshCw size={16} /> Atualizar familia</button>
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
