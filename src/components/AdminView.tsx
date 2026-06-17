import { Award, Palette, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminAuditLog, AdminOverview, AppSettings, CloudSession, CuratedRecommendation, FamilyItem, SocialProfile } from "../types";
import { categoryLabels } from "../data/catalog";
import { deleteCuratedRecommendation, fetchAdminCuratableItems, fetchAdminLogs, fetchAdminOverview, fetchCuratedRecommendations, setProfileRole, upsertCuratedRecommendation } from "../services/supabaseCloud";
import { getTitle, getYear } from "../utils/itemHelpers";
import { Cover } from "./Cover";
import { ItemDetails } from "./ItemDetails";
import { Stars } from "./Rating";
import { SeasonalDesignLab } from "./SeasonalDesignLab";

export type AdminPage = "design" | "curation";

export function AdminView({
  settings,
  session,
  page,
  onPageChange,
}: {
  settings: AppSettings;
  session: CloudSession | null;
  page: AdminPage;
  onPageChange: (page: AdminPage) => void;
}) {
  const isAdmin = session?.profile?.role === "admin";
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminError, setAdminError] = useState("");
  const [adminItems, setAdminItems] = useState<FamilyItem[]>([]);
  const [curatedRecommendations, setCuratedRecommendations] = useState<CuratedRecommendation[]>([]);
  const [curationNotes, setCurationNotes] = useState<Record<string, string>>({});
  const [curationSearch, setCurationSearch] = useState("");
  const [curationBusyId, setCurationBusyId] = useState("");
  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>([]);
  const [adminRoleBusyId, setAdminRoleBusyId] = useState("");
  const [activeEntry, setActiveEntry] = useState<FamilyItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const recommendationsByKey = useMemo(() => new Map(curatedRecommendations.map((entry) => [curationKey(entry.ownerId, entry.id), entry])), [curatedRecommendations]);
  const curatableItems = useMemo(() => {
    const query = normalizeSearch(curationSearch);
    return adminItems
      .filter((entry) => entry.ownerId !== session?.user.id)
      .filter((entry) => entry.item.visibility !== "private")
      .filter((entry) => {
        if (!query) return true;
        return normalizeSearch(`${getTitle(entry.item)} ${entry.ownerName} ${categoryLabels[entry.item.category]} ${entry.item.status}`).includes(query);
      })
      .slice(0, 18);
  }, [adminItems, curationSearch, session?.user.id]);

  useEffect(() => {
    if (page !== "curation" || !session || !isAdmin) return;
    refreshAdmin();
  }, [session?.user.id, page, isAdmin]);

  async function refreshAdmin() {
    if (!session || !isAdmin) return;

    setLoading(true);
    setAdminError("");
    try {
      const [overview, items, recommendations, logs] = await Promise.all([
        fetchAdminOverview(settings, session),
        fetchAdminCuratableItems(settings, session),
        fetchCuratedRecommendations(settings, session),
        fetchAdminLogs(settings, session),
      ]);
      setAdminOverview(overview);
      setAdminItems(items);
      setCuratedRecommendations(recommendations);
      setAdminLogs(logs);
      setCurationNotes((current) => {
        const next = { ...current };
        recommendations.forEach((recommendation) => {
          next[curationKey(recommendation.ownerId, recommendation.id)] = recommendation.note || "";
        });
        return next;
      });
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Não consegui abrir o painel administrativo.");
    } finally {
      setLoading(false);
    }
  }

  async function changeProfileRole(profile: SocialProfile, role: "user" | "admin") {
    if (!session || !isAdmin) return;

    if (profile.id === session.user.id && role !== "admin") {
      setAdminError("Você não pode remover seu próprio papel de administrador.");
      return;
    }

    const nextLabel = role === "admin" ? "promover para admin" : "remover admin";
    const confirmed = window.confirm(`Deseja ${nextLabel} de ${profile.displayName}?`);
    if (!confirmed) return;

    setAdminRoleBusyId(profile.id);
    setAdminError("");
    setMessage("");

    try {
      await setProfileRole(settings, session, profile.id, role);
      setAdminOverview((current) => current ? {
        ...current,
        profiles: current.profiles.map((entry) => entry.profile.id === profile.id
          ? { ...entry, profile: { ...entry.profile, role } }
          : entry),
      } : current);
      setMessage(role === "admin" ? `${profile.displayName} agora é admin.` : `${profile.displayName} voltou a ser usuário.`);
      await refreshAdmin();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Não consegui alterar o papel desse perfil.");
    } finally {
      setAdminRoleBusyId("");
    }
  }

  async function curateItem(entry: FamilyItem) {
    if (!session || !isAdmin) return;

    const key = curationKey(entry.ownerId, entry.id);
    setCurationBusyId(key);
    setAdminError("");
    setMessage("");

    try {
      const recommendation = await upsertCuratedRecommendation(settings, session, entry, curationNotes[key] ?? "");
      setCuratedRecommendations((current) => [
        recommendation,
        ...current.filter((candidate) => candidate.recommendationId !== recommendation.recommendationId),
      ]);
      setMessage(`${getTitle(entry.item)} entrou na curadoria.`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Não consegui destacar essa ficha.");
    } finally {
      setCurationBusyId("");
    }
  }

  async function removeRecommendation(recommendation: CuratedRecommendation) {
    if (!session || !isAdmin) return;

    setCurationBusyId(curationKey(recommendation.ownerId, recommendation.id));
    setAdminError("");
    setMessage("");

    try {
      await deleteCuratedRecommendation(settings, session, recommendation.recommendationId);
      setCuratedRecommendations((current) => current.filter((entry) => entry.recommendationId !== recommendation.recommendationId));
      setMessage(`${getTitle(recommendation.item)} saiu da curadoria.`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Não consegui remover esse destaque.");
    } finally {
      setCurationBusyId("");
    }
  }

  if (!isAdmin) {
    return (
      <main className="page">
        <section className="list-header">
          <div>
            <p className="eyebrow">Administração</p>
            <h1>Admin</h1>
            <p>Esta área aparece apenas para perfis com papel de administrador.</p>
          </div>
          <ShieldCheck size={38} />
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="list-header">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>{page === "design" ? "Design sazonal" : "Membros e curadoria"}</h1>
          <p>
            {page === "design"
              ? "Ferramenta experimental para montar modelos sazonais de fichas sem publicar no catálogo."
              : "Visualize perfis, promova administradores e transforme fichas em recomendações da Gaveteira."}
          </p>
        </div>
        {page === "design" ? <Palette size={38} /> : <ShieldCheck size={38} />}
      </section>

      <nav className="social-mobile-switch admin-page-switch" aria-label="Alternar área admin">
        <button type="button" className={page === "design" ? "active" : ""} onClick={() => onPageChange("design")}>
          <Palette size={17} />
          Design sazonal
        </button>
        <button type="button" className={page === "curation" ? "active" : ""} onClick={() => onPageChange("curation")}>
          <Award size={17} />
          Membros e curadoria
        </button>
      </nav>

      {page === "design" ? <SeasonalDesignLab /> : (
        <section className="setting-panel admin-panel">
          <div className="section-heading split">
            <div className="section-heading">
              <ShieldCheck size={20} />
              <h2>Membros e curadoria</h2>
            </div>
            <button className="ghost compact" type="button" onClick={refreshAdmin} disabled={loading}>
              <RefreshCw size={15} />
              Atualizar
            </button>
          </div>
          <p className="admin-note">
            Reconheça fichas de outras pessoas e transforme bons registros em recomendações destacadas para a rede.
          </p>
          {message ? <p className="form-note">{message}</p> : null}
          {adminError ? <p className="form-error">{adminError}</p> : null}
          <div className="admin-metrics">
            <ProfileMetric label="Perfis cadastrados" value={adminOverview?.totalProfiles ?? "--"} />
            <ProfileMetric label="Fichas acessíveis" value={adminOverview?.totalItems ?? "--"} />
            <ProfileMetric label="Seu papel" value="admin" />
          </div>
          <div className="admin-user-list">
            <h3>Perfis</h3>
            {adminOverview?.profiles.length ? adminOverview.profiles.map((entry) => (
              <div key={entry.profile.id} className="admin-user-row">
                <PersonIdentity profile={entry.profile} />
                <span>{entry.itemCount} fichas</span>
                <small>{entry.profile.role === "admin" ? "admin" : "user"}</small>
                <div className="admin-user-actions">
                  {entry.profile.role === "admin" ? (
                    <button
                      className="ghost compact"
                      type="button"
                      onClick={() => changeProfileRole(entry.profile, "user")}
                      disabled={loading || adminRoleBusyId === entry.profile.id || entry.profile.id === session?.user.id}
                    >
                      Remover admin
                    </button>
                  ) : (
                    <button
                      className="primary compact"
                      type="button"
                      onClick={() => changeProfileRole(entry.profile, "admin")}
                      disabled={loading || adminRoleBusyId === entry.profile.id}
                    >
                      Promover admin
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <p className="empty">{loading ? "Carregando perfis..." : "Nenhum perfil carregado ainda."}</p>
            )}
          </div>
          <div className="admin-log-list">
            <h3>Logs administrativos</h3>
            {adminLogs.length ? adminLogs.slice(0, 8).map((log) => (
              <article key={log.id} className="admin-log-row">
                <strong>{adminLogLabel(log.action)}</strong>
                <span>
                  {log.actorName}
                  {log.targetName ? ` -> ${log.targetName}` : ""}
                </span>
                <small>{formatLogDate(log.createdAt)}</small>
              </article>
            )) : (
              <p className="empty">{loading ? "Carregando logs..." : "Nenhuma ação administrativa registrada ainda."}</p>
            )}
          </div>
          <section className="admin-curation">
            <div className="section-heading split">
              <div className="section-heading">
                <Award size={20} />
                <h3>Curadoria de recomendações</h3>
              </div>
              <span className="soft-label">{curatedRecommendations.length} destaques</span>
            </div>
            <p className="admin-note">
              Destaques aparecem no Feed como recomendações da Gaveteira, sempre mostrando quem criou a ficha original.
            </p>
            <div className="curation-search-row">
              <input value={curationSearch} onChange={(event) => setCurationSearch(event.target.value)} placeholder="Buscar por título, autor ou gaveta" />
            </div>
            {curatedRecommendations.length ? (
              <div className="curation-featured-list">
                {curatedRecommendations.slice(0, 6).map((recommendation) => (
                  <button key={recommendation.recommendationId} type="button" className="curation-featured-card" onClick={() => setActiveEntry(recommendation)}>
                    <Award size={16} />
                    <span>
                      <strong>{getTitle(recommendation.item)}</strong>
                      <small>Ficha de {recommendation.ownerName} / curadoria de {recommendation.curatorName}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="curation-list">
              {curatableItems.length ? curatableItems.map((entry) => {
                const key = curationKey(entry.ownerId, entry.id);
                const recommendation = recommendationsByKey.get(key);
                return (
                  <article key={key} className={`curation-card${recommendation ? " is-curated" : ""}`}>
                    <button type="button" className="curation-card-open" onClick={() => setActiveEntry(entry)}>
                      <Cover item={entry.item} compact />
                      <span>
                        <small>{categoryLabels[entry.item.category]} de {entry.ownerName}</small>
                        <strong>{getTitle(entry.item)}</strong>
                        <em>{entry.item.status}{getYear(entry.item) ? ` / ${getYear(entry.item)}` : ""}</em>
                        <Stars value={entry.item.rating} />
                      </span>
                    </button>
                    <label>
                      <span>Nota da curadoria</span>
                      <textarea
                        value={curationNotes[key] ?? ""}
                        onChange={(event) => setCurationNotes((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder="Por que este card merece destaque?"
                      />
                    </label>
                    <div className="curation-card-actions">
                      <button className="primary compact" type="button" onClick={() => curateItem(entry)} disabled={loading || curationBusyId === key}>
                        <Award size={15} />
                        {recommendation ? "Atualizar destaque" : "Destacar"}
                      </button>
                      {recommendation ? (
                        <button className="ghost compact" type="button" onClick={() => removeRecommendation(recommendation)} disabled={loading || curationBusyId === key}>
                          Remover
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              }) : (
                <p className="empty">{loading ? "Carregando fichas para curadoria..." : "Nenhuma ficha de outros usuários encontrada para destacar."}</p>
              )}
            </div>
          </section>
        </section>
      )}

      {activeEntry ? (
        <ItemDetails
          item={activeEntry.item}
          ownerName={activeEntry.ownerName}
          onClose={() => setActiveEntry(null)}
        />
      ) : null}
    </main>
  );
}

function PersonIdentity({ profile }: { profile: SocialProfile }) {
  return (
    <div className="social-person-identity">
      <AdminAvatar name={profile.displayName} avatarUrl={profile.avatarUrl} />
      <span>
        <strong>{profile.displayName}</strong>
        <small>{profile.username ? `@${profile.username}` : profile.inviteCode ? `código ${profile.inviteCode}` : profile.email || "perfil Gaveteira"}</small>
      </span>
    </div>
  );
}

function AdminAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "G";

  return (
    <span className="avatar">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
    </span>
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

function formatLogDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function adminLogLabel(action: string) {
  const labels: Record<string, string> = {
    promote_admin: "Promoveu administrador",
    demote_admin: "Removeu administrador",
    curate_item: "Destacou uma ficha",
    remove_curation: "Removeu um destaque",
  };

  return labels[action] || "Ação administrativa";
}

function curationKey(ownerId: string, itemId: string) {
  return `${ownerId}:${itemId}`;
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
