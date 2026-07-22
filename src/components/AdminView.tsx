import { Palette, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminAuditLog, AdminOverview, AppSettings, CloudSession, SocialProfile } from "../types";
import { fetchAdminLogs, fetchAdminOverview, setProfileRole } from "../services/supabaseCloud";
import { SeasonalDesignLab } from "./SeasonalDesignLab";

export type AdminPage = "design" | "members";

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
  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>([]);
  const [adminRoleBusyId, setAdminRoleBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (page !== "members" || !session || !isAdmin) return;
    refreshAdmin();
  }, [session?.user.id, page, isAdmin]);

  async function refreshAdmin() {
    if (!session || !isAdmin) return;

    setLoading(true);
    setAdminError("");
    try {
      const [overview, logs] = await Promise.all([
        fetchAdminOverview(settings, session),
        fetchAdminLogs(settings, session),
      ]);
      setAdminOverview(overview);
      setAdminLogs(logs);
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
          <h1>{page === "design" ? "Design sazonal" : "Membros"}</h1>
          <p>
            {page === "design"
              ? "Ferramenta experimental para montar modelos sazonais de fichas sem publicar no catálogo."
              : "Visualize perfis e promova administradores da Gaveteira."}
          </p>
        </div>
        {page === "design" ? <Palette size={38} /> : <ShieldCheck size={38} />}
      </section>

      <nav className="social-mobile-switch admin-page-switch" aria-label="Alternar área admin">
        <button type="button" className={page === "design" ? "active" : ""} onClick={() => onPageChange("design")}>
          <Palette size={17} />
          Design sazonal
        </button>
        <button type="button" className={page === "members" ? "active" : ""} onClick={() => onPageChange("members")}>
          <ShieldCheck size={17} />
          Membros
        </button>
      </nav>

      {page === "design" ? <SeasonalDesignLab /> : (
        <section className="setting-panel admin-panel">
          <div className="section-heading split">
            <div className="section-heading">
              <ShieldCheck size={20} />
              <h2>Membros</h2>
            </div>
            <button className="ghost compact" type="button" onClick={refreshAdmin} disabled={loading}>
              <RefreshCw size={15} />
              Atualizar
            </button>
          </div>
          <p className="admin-note">
            Acompanhe perfis cadastrados e ajuste quem pode acessar a área administrativa.
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
        </section>
      )}
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
  };

  return labels[action] || "Ação administrativa";
}
