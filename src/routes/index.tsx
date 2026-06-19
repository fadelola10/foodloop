import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Apple, Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoodLoop — Connexion" },
      {
        name: "description",
        content:
          "Connectez-vous à FoodLoop pour découvrir les producteurs méditerranéens près de chez vous.",
      },
    ],
  }),
  component: AuthScreen,
});

type Tab = "login" | "signup";
type Role = "consumer" | "producer";

function AuthScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("login");
  const [showPwd, setShowPwd] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("consumer");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/app" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      if (tab === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg({ type: "success", text: "Connecté ! Redirection…" });
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        setMsg({
          type: "success",
          text: "Compte créé ! Vérifie ta boîte mail pour confirmer.",
        });
      }
    } catch (err) {
      setMsg({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setMsg({ type: "error", text: error.message });
  }

  async function handleForgotPwd() {
    if (!email) {
      setMsg({ type: "error", text: "Entre ton e-mail d'abord." });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMsg(
      error
        ? { type: "error", text: error.message }
        : { type: "success", text: "Un e-mail de réinitialisation a été envoyé." },
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-cream)_0%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 top-24 h-40 w-40 rounded-full bg-sea/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-56 h-44 w-44 rounded-full bg-citrus/30 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-12">
        <header className="flex flex-col items-center text-center">
          <h1 className="font-display text-4xl font-black tracking-tight">
            <span className="text-amalfi">Food</span>
            <span className="text-citrus">Loop</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Le circuit court à portée de main
          </p>
          <div className="mt-4 h-[2px] w-16 rounded-full bg-citrus/60" />
        </header>

        <div className="mt-8 rounded-2xl bg-muted/70 p-1">
          <div className="grid grid-cols-2 gap-1">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTab(t);
                  setMsg(null);
                }}
                className={
                  "rounded-xl py-2.5 text-sm font-semibold transition-all " +
                  (tab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {tab === "signup" && (
            <>
              <Field label="Nom complet">
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="Marie Dupont"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="auth-input"
                />
              </Field>

              <Field label="Je suis">
                <div className="grid grid-cols-2 gap-2">
                  {(["consumer", "producer"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={
                        "h-12 rounded-xl border text-sm font-semibold transition-all " +
                        (role === r
                          ? "border-citrus bg-citrus/10 text-amalfi"
                          : "border-border bg-card text-muted-foreground hover:bg-muted")
                      }
                    >
                      {r === "consumer" ? "Consommateur" : "Producteur"}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label="Adresse e-mail">
            <input
              type="email"
              autoComplete="email"
              placeholder="marie@email.fr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
          </Field>

          <Field label="Mot de passe">
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-11"
              />
              <button
                type="button"
                aria-label={showPwd ? "Masquer" : "Afficher"}
                onClick={() => setShowPwd((s) => !s)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          {tab === "login" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPwd}
                className="text-xs font-semibold text-amalfi hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

          {msg && (
            <div
              className={
                "rounded-xl px-3 py-2.5 text-xs font-medium " +
                (msg.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200")
              }
            >
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-citrus py-3.5 text-base font-bold text-white shadow-[0_8px_20px_-8px_var(--color-citrus)] transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {tab === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          ou continuer avec
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SocialBtn label="Google" icon={<GoogleIcon />} onClick={() => handleOAuth("google")} />
          <SocialBtn label="Apple" icon={<Apple className="size-4" />} onClick={() => handleOAuth("apple")} />
        </div>

        <div className="mt-8 rounded-2xl border border-sea/40 bg-sea/15 p-4 text-sm">
          <p className="text-amalfi">
            Vous êtes producteur ?{" "}
            <button
              type="button"
              onClick={() => {
                setTab("signup");
                setRole("producer");
              }}
              className="inline-flex items-center gap-1 font-bold underline-offset-2 hover:underline"
            >
              Accéder à l'espace producteur
              <ChevronRight className="size-4" />
            </button>
          </p>
        </div>

        <div className="mt-auto pt-10">
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-amalfi/95 px-4 py-5 text-center text-white">
            <Stat value="140+" label="Producteurs" />
            <Stat value="32" label="Hubs" />
            <Stat value="5k+" label="Membres" />
          </div>
        </div>
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          height: 3rem;
          border-radius: 0.875rem;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          padding: 0 1rem;
          font-size: 0.95rem;
          color: var(--color-foreground);
          transition: border-color .15s, box-shadow .15s;
        }
        .auth-input::placeholder { color: color-mix(in oklab, var(--color-muted-foreground) 80%, transparent); }
        .auth-input:focus {
          outline: none;
          border-color: var(--color-citrus);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-citrus) 25%, transparent);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

function SocialBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-muted"
    >
      {icon}
      {label}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-black text-citrus">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-white/75">{label}</div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.07-1.1-.16-1.6H12z"
      />
    </svg>
  );
}
