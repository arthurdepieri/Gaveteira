import { LogIn, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { AppSettings, CloudSession } from "../types";
import { isCloudConfigured, signIn, signUp } from "../services/supabaseCloud";

export function AuthGate({
  settings,
  onUpdateSettings,
  onAuthenticated,
  layout = "shell",
}: {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onAuthenticated: (session: CloudSession) => void;
  layout?: "shell" | "panel";
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = isCloudConfigured(settings);

  async function submitAuth() {
    setLoading(true);
    setMessage("");

    try {
      const session = mode === "signup"
        ? await signUp(settings, email, password, displayName || email.split("@")[0])
        : await signIn(settings, email, password);
      onAuthenticated(session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel entrar.");
    } finally {
      setLoading(false);
    }
  }

  const content = (
    <>
        <div className="brand login-brand">
          <span className="brand-mark">G</span>
          <div>
            <strong>Gaveteira</strong>
            <small>conecte para sincronizar e adicionar amigos</small>
          </div>
        </div>

        <div className="login-grid">
          <section className="setting-panel">
            <div className="section-heading">
              <Users size={20} />
              <h2>Social</h2>
            </div>
            <p>Entre para salvar sua gaveteira na nuvem, criar seu perfil e adicionar amigos por busca, email ou codigo de convite.</p>
            <p className="empty">Sem login, tudo continua funcionando no modo local deste navegador.</p>
          </section>

          <section className="setting-panel auth-panel">
            <div className="segmented">
              <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Entrar</button>
              <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Criar conta</button>
            </div>
            <div className="form-grid">
              {mode === "signup" ? (
                <label className="field">
                  <span>Nome publico</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Arthur" />
                </label>
              ) : null}
              <label className="field">
                <span>Email</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="voce@email.com" />
              </label>
              <label className="field">
                <span>Senha</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="minimo 6 caracteres" />
              </label>
            </div>
            <button className="primary" onClick={submitAuth} disabled={loading || !configured}>
              {mode === "signup" ? <UserPlus size={16} /> : <LogIn size={16} />}
              {loading ? "Conectando..." : mode === "signup" ? "Criar e sincronizar" : "Entrar e sincronizar"}
            </button>
            {!configured ? <p className="form-error">A conexao tecnica com o Supabase ainda nao foi configurada no app.</p> : null}
            {message ? <p className="form-error">{message}</p> : null}
          </section>
        </div>
    </>
  );

  if (layout === "panel") {
    return <div className="auth-inline">{content}</div>;
  }

  return (
    <main className="login-shell">
      <section className="login-card compact-login">
        {content}
      </section>
    </main>
  );
}
