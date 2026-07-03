"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Database, Languages, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { CheckAuthByApi, LoginByApi, LogoutByApi, SignupByApi, type ApiAuthUser } from "@/lib/backend-api";
import { useT } from "@/lib/i18n";

export type AuthProfile = {
  name: string;
  email: string;
  imageUrl?: string;
  mode: "database";
  signOut?: () => void;
};

type AuthMode = "login" | "signup";

const AuthProfileContext = createContext<AuthProfile>({
  name: "Student",
  email: "student@example.com",
  mode: "database",
});

export function useAuthProfile() {
  return useContext(AuthProfileContext);
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<ApiAuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    CheckAuthByApi()
      .then(async (res) => {
        if (!alive) return;
        setUser(res.user ?? null);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mounted]);

  const profile = useMemo<AuthProfile | null>(() => {
    if (!user) return null;
    return {
      name: user.name,
      email: user.email,
      mode: "database",
      signOut: async () => {
        await LogoutByApi().catch(() => null);
        setUser(null);
      },
    };
  }, [user]);

  if (!mounted || loading) return <AuthLoadingScreen />;

  if (!profile) {
    return <DatabaseLoginScreen onAuthenticated={setUser} />;
  }

  return <AuthProfileContext.Provider value={profile}>{children}</AuthProfileContext.Provider>;
}

function AuthLoadingScreen() {
  const { t } = useT();
  return (
    <main className="auth-paper-shell auth-paper-loading" aria-busy="true">
      <Loader2 size={22} className="auth-spin" />
      <span>{t("auth.loading")}</span>
      <AuthStyles />
    </main>
  );
}

function DatabaseLoginScreen({ onAuthenticated }: { onAuthenticated: (user: ApiAuthUser) => void }) {
  const { t, lang, setLang } = useT();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const data = isSignup ? await SignupByApi({ name, email, password }) : await LoginByApi({ email, password });
      onAuthenticated(data.user);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("auth.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-paper-shell">
      <section className="auth-paper-hero" aria-label="Butler">
        <div className="auth-paper-brand">
          <span className="auth-paper-logo" aria-hidden="true" />
          <div>
            <strong>Butler</strong>
            <span>{t("auth.eyebrow")}</span>
          </div>
        </div>
        <div className="auth-paper-copy">
          <p>{t("auth.paperKicker")}</p>
          <h1>{t("auth.paperTitle")}</h1>
          <p>{t("auth.paperSubtitle")}</p>
        </div>
        <div className="auth-paper-benefits" aria-label={t("auth.benefits")}>
          <Benefit icon={<BookOpen size={17} />} label={t("auth.benefit.workspace")} />
          <Benefit icon={<Database size={17} />} label={t("auth.benefit.database")} />
          <Benefit icon={<LockKeyhole size={17} />} label={t("auth.benefit.private")} />
        </div>
      </section>

      <section className="auth-paper-panel" aria-label={isSignup ? t("auth.signupTitle") : t("auth.title")}>
        <div className="auth-lang-row">
          <button type="button" className="auth-lang-button" onClick={() => setLang(lang === "en" ? "zh" : "en")}>
            <Languages size={16} />
            {lang === "en" ? "English" : "Chinese"}
          </button>
        </div>

        <div className="auth-form-head">
          <p>{isSignup ? t("auth.signupEyebrow") : t("auth.loginEyebrow")}</p>
          <h2>{isSignup ? t("auth.signupTitle") : t("auth.title")}</h2>
          <span>{isSignup ? t("auth.signupSubtitle") : t("auth.subtitle")}</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <Field
              icon={<UserRound size={17} />}
              label={t("auth.name")}
              value={name}
              onChange={setName}
              autoComplete="name"
            />
          )}
          <Field
            icon={<Mail size={17} />}
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <Field
            icon={<LockKeyhole size={17} />}
            label={t("auth.password")}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : 6}
            required
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting && <Loader2 size={17} className="auth-spin" />}
            {isSignup ? t("auth.signupCta") : t("auth.loginCta")}
          </button>
        </form>

        <div className="auth-switch">
          <span>{isSignup ? t("auth.hasAccount") : t("auth.noAccount")}</span>
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError(null);
            }}
          >
            {isSignup ? t("auth.switchLogin") : t("auth.switchSignup")}
          </button>
        </div>

        <p className="auth-note">{t("auth.databaseHint")}</p>
      </section>
      <AuthStyles />
    </main>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  minLength,
  required,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const id = `auth-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <div className="auth-input-wrap">
        {icon}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
      </div>
    </label>
  );
}

function Benefit({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="auth-benefit">
      <span>{icon}</span>
      <p>{label}</p>
    </div>
  );
}

function AuthStyles() {
  return (
    <style suppressHydrationWarning>{`
      .auth-paper-shell {
        min-height: 100dvh;
        display: grid;
        grid-template-columns: minmax(360px, 0.92fr) minmax(360px, 1fr);
        background:
          var(--bg-glow),
          var(--bg-grid),
          var(--color-bg);
        color: var(--color-text);
        font-family: var(--font-body);
      }

      .auth-paper-loading {
        grid-template-columns: 1fr;
        place-items: center;
        align-content: center;
        gap: 10px;
        color: var(--color-text-muted);
      }

      .auth-paper-hero {
        position: relative;
        min-height: 100dvh;
        padding: clamp(32px, 6vw, 78px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        border-right: 1px solid var(--color-border);
      }

      .auth-paper-hero::before {
        content: "";
        position: absolute;
        inset: 28px;
        border: 1px solid color-mix(in srgb, var(--color-primary) 24%, transparent);
        border-radius: var(--radius-card);
        pointer-events: none;
      }

      .auth-paper-hero::after {
        content: "";
        position: absolute;
        width: 300px;
        height: 300px;
        right: -80px;
        bottom: -100px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--color-accent) 16%, transparent);
        filter: blur(8px);
        pointer-events: none;
      }

      .auth-paper-brand,
      .auth-paper-copy,
      .auth-paper-benefits {
        position: relative;
        z-index: 1;
      }

      .auth-paper-brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
      }

      .auth-paper-logo {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background: url('/assets/logo.png') center / contain no-repeat;
        box-shadow: var(--shadow-card);
      }

      .auth-paper-brand strong {
        display: block;
        font-family: var(--font-display);
        font-size: 18px;
        letter-spacing: 0;
      }

      .auth-paper-brand span {
        display: block;
        margin-top: 2px;
        color: var(--color-text-muted);
        font-size: 13px;
      }

      .auth-paper-copy {
        max-width: 580px;
        margin: auto 0;
      }

      .auth-paper-copy p:first-child {
        margin: 0 0 14px;
        color: var(--color-primary);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .auth-paper-copy h1 {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(42px, 6vw, 74px);
        line-height: 0.98;
        letter-spacing: 0;
        font-weight: 600;
      }

      .auth-paper-copy p:last-child {
        margin: 22px 0 0;
        max-width: 520px;
        color: var(--color-text-muted);
        font-size: 18px;
        line-height: 1.62;
      }

      .auth-paper-benefits {
        display: grid;
        gap: 10px;
        max-width: 540px;
      }

      .auth-benefit {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--color-text-muted);
        font-size: 14px;
      }

      .auth-benefit span {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--color-primary);
        background: var(--color-primary-soft);
        flex: 0 0 auto;
      }

      .auth-benefit p {
        margin: 0;
      }

      .auth-paper-panel {
        min-height: 100dvh;
        padding: clamp(24px, 6vw, 86px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        background: color-mix(in srgb, var(--color-surface) 74%, transparent);
      }

      .auth-lang-row {
        display: flex;
        justify-content: flex-end;
        margin-bottom: clamp(28px, 7vh, 76px);
      }

      .auth-lang-button {
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill);
        background: var(--glass-bg-strong);
        color: var(--color-text-muted);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
      }

      .auth-form-head {
        max-width: 520px;
      }

      .auth-form-head p {
        margin: 0 0 10px;
        color: var(--color-primary);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .auth-form-head h2 {
        margin: 0;
        font-size: clamp(32px, 4vw, 44px);
        line-height: 1.05;
        letter-spacing: 0;
        font-weight: 700;
      }

      .auth-form-head span {
        display: block;
        margin-top: 10px;
        color: var(--color-text-muted);
        font-size: 16px;
        line-height: 1.55;
      }

      .auth-form {
        width: min(100%, 520px);
        display: grid;
        gap: 16px;
        margin-top: 34px;
      }

      .auth-field {
        display: grid;
        gap: 8px;
        color: var(--color-text);
        font-size: 14px;
        font-weight: 650;
      }

      .auth-input-wrap {
        min-height: 52px;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        padding: 0 14px;
        color: var(--color-text-muted);
        box-shadow: var(--shadow-card);
      }

      .auth-input-wrap:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 16%, transparent);
      }

      .auth-input-wrap input {
        width: 100%;
        min-width: 0;
        height: 50px;
        border: none;
        outline: none;
        background: transparent;
        color: var(--color-text);
        font: inherit;
        font-size: 16px;
      }

      .auth-error {
        margin: 0;
        border: 1px solid color-mix(in srgb, var(--color-danger) 34%, transparent);
        border-radius: var(--radius-md);
        padding: 11px 13px;
        background: var(--color-danger-soft);
        color: var(--color-danger);
        font-size: 13px;
        line-height: 1.45;
      }

      .auth-submit {
        min-height: 52px;
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-md);
        background: var(--color-primary);
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;
        font: inherit;
        font-weight: 750;
        box-shadow: var(--shadow-card);
      }

      .auth-submit:disabled {
        cursor: wait;
        opacity: 0.72;
      }

      .auth-switch {
        width: min(100%, 520px);
        min-height: 62px;
        margin-top: 22px;
        padding: 12px 16px;
        border: 1px solid var(--color-border-soft);
        border-radius: var(--radius-md);
        background: color-mix(in srgb, var(--color-bg) 62%, transparent);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: var(--color-text-muted);
        font-size: 14px;
      }

      .auth-switch button {
        min-height: 40px;
        border: none;
        background: transparent;
        color: var(--color-primary);
        cursor: pointer;
        font: inherit;
        font-weight: 750;
      }

      .auth-note {
        width: min(100%, 520px);
        margin: 16px 0 0;
        color: var(--color-text-faint);
        font-size: 12px;
        line-height: 1.5;
      }

      @keyframes auth-spin { to { transform: rotate(360deg); } }
      .auth-spin { animation: auth-spin 0.8s linear infinite; }

      @media (max-width: 860px) {
        .auth-paper-shell {
          grid-template-columns: 1fr;
        }

        .auth-paper-hero {
          min-height: auto;
          padding: 28px 22px 18px;
          border-right: none;
          border-bottom: 1px solid var(--color-border);
        }

        .auth-paper-hero::before,
        .auth-paper-hero::after,
        .auth-paper-benefits {
          display: none;
        }

        .auth-paper-copy {
          margin: 34px 0 0;
        }

        .auth-paper-copy h1 {
          font-size: 38px;
        }

        .auth-paper-copy p:last-child {
          font-size: 15px;
        }

        .auth-paper-panel {
          min-height: auto;
          padding: 24px 22px 40px;
        }

        .auth-lang-row {
          justify-content: flex-start;
          margin-bottom: 28px;
        }

        .auth-switch {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `}</style>
  );
}
