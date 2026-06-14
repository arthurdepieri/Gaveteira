import { Chrome, KeyRound, LogIn, MailCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppSettings, CloudSession } from "../types";
import { isCloudConfigured, requestPasswordRecovery, signIn, signUp, startGoogleSignIn, updatePasswordAfterRecovery } from "../services/supabaseCloud";

export function AuthGate({
  settings,
  onUpdateSettings,
  onAuthenticated,
  passwordRecoverySession,
  onPasswordRecoveryCancel,
  initialMessage = "",
  layout = "shell",
}: {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onAuthenticated: (session: CloudSession) => void;
  passwordRecoverySession?: CloudSession | null;
  onPasswordRecoveryCancel?: () => void;
  initialMessage?: string;
  layout?: "shell" | "panel";
}) {
  void onUpdateSettings;

  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const configured = isCloudConfigured(settings);
  const isResetMode = Boolean(passwordRecoverySession);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  async function submitAuth() {
    setLoading(true);
    setMessage("");

    try {
      const session = mode === "signup"
        ? await signUp(settings, email, password, displayName || email.split("@")[0])
        : await signIn(settings, email, password);
      onAuthenticated(session);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui abrir sua conta agora.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordRecovery() {
    const requestedEmail = email.trim();
    if (!requestedEmail) {
      setMessage("Informe seu email para receber o link de recuperação.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await requestPasswordRecovery(settings, requestedEmail);
      setMessage("Se esse email estiver cadastrado, você receberá um link para criar uma nova senha.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui enviar o email de recuperação.");
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword() {
    if (!passwordRecoverySession) return;
    if (password.length < 6) {
      setMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("As senhas não conferem.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const session = await updatePasswordAfterRecovery(settings, passwordRecoverySession, password);
      onAuthenticated(session);
      onPasswordRecoveryCancel?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui salvar a nova senha.");
    } finally {
      setLoading(false);
    }
  }

  function submitGoogleAuth() {
    setMessage("");

    try {
      startGoogleSignIn(settings);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui iniciar o login com Google.");
    }
  }

  function selectMode(nextMode: "login" | "signup" | "forgot") {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setPasswordConfirm("");
  }

  const content = (
    <>
      <div className="brand login-brand">
        <span className="brand-mark">G</span>
        <div>
          <strong>Gaveteira</strong>
          <small>entre para abrir seu arquivo cultural</small>
        </div>
      </div>

      <div className="login-grid">
        <section className="setting-panel">
          <div className="section-heading">
            <Users size={20} />
            <h2>Comece pela sua conta</h2>
          </div>
          <p>Registre com email ou Google. Depois você cria o primeiro card com um tutorial por etapas dentro da ficha.</p>
          <p className="empty">A Gaveteira abre o conteúdo só depois do login, para cada pessoa manter seu próprio arquivo.</p>
        </section>

        <section className="setting-panel auth-panel">
          {isResetMode ? (
            <>
              <div className="section-heading">
                <KeyRound size={20} />
                <h2>Crie uma nova senha</h2>
              </div>
              <p className="empty">Depois de salvar, você entra direto na Gaveteira com a sessão recuperada.</p>
              <div className="form-grid">
                <label className="field">
                  <span>Nova senha</span>
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="mínimo 6 caracteres" autoComplete="new-password" />
                </label>
                <label className="field">
                  <span>Confirmar senha</span>
                  <input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} type="password" placeholder="repita a nova senha" autoComplete="new-password" />
                </label>
              </div>
              <button className="primary" onClick={submitNewPassword} disabled={loading || !configured}>
                <KeyRound size={16} />
                {loading ? "Salvando..." : "Salvar senha e entrar"}
              </button>
              <button className="secondary auth-google-button" onClick={onPasswordRecoveryCancel} disabled={loading}>
                Voltar para o login
              </button>
            </>
          ) : (
            <>
              <div className="segmented">
                <button className={mode === "login" ? "active" : ""} onClick={() => selectMode("login")}>Entrar</button>
                <button className={mode === "signup" ? "active" : ""} onClick={() => selectMode("signup")}>Criar conta</button>
              </div>
              <div className="form-grid">
                {mode === "signup" ? (
                  <label className="field">
                    <span>Nome público</span>
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Maria" />
                  </label>
                ) : null}
                <label className="field">
                  <span>Email</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="seu@email.com" autoComplete="email" />
                </label>
                {mode !== "forgot" ? (
                  <label className="field">
                    <span>Senha</span>
                    <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="mínimo 6 caracteres" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                  </label>
                ) : null}
              </div>
              {mode === "forgot" ? (
                <>
                  <button className="primary" onClick={submitPasswordRecovery} disabled={loading || !configured}>
                    <MailCheck size={16} />
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                  </button>
                  <button className="secondary auth-google-button" onClick={() => selectMode("login")} disabled={loading}>
                    Voltar para entrar
                  </button>
                </>
              ) : (
                <>
                  <button className="primary" onClick={submitAuth} disabled={loading || !configured}>
                    {mode === "signup" ? <UserPlus size={16} /> : <LogIn size={16} />}
                    {loading ? "Conectando..." : mode === "signup" ? "Registrar e começar" : "Entrar"}
                  </button>
                  {mode === "login" ? (
                    <button className="auth-link-button" type="button" onClick={() => selectMode("forgot")}>
                      Esqueci minha senha
                    </button>
                  ) : null}
                  <div className="auth-divider"><span>ou</span></div>
                  <button className="secondary auth-google-button" onClick={submitGoogleAuth} disabled={!configured}>
                    <Chrome size={16} />
                    Entrar ou registrar com Google
                  </button>
                </>
              )}
            </>
          )}
          {!configured ? <p className="form-error">A Gaveteira ainda não recebeu as credenciais da nuvem.</p> : null}
          {message ? <p className={mode === "forgot" && message.includes("receberá") ? "form-note" : "form-error"}>{message}</p> : null}
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
