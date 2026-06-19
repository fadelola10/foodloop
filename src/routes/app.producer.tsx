import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import type { Producer } from "@/lib/types";

export const Route = createFileRoute("/app/producer")({
  head: () => ({ meta: [{ title: "FoodLoop — Ma ferme" }] }),
  component: ProducerForm,
});

function ProducerForm() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [producer, setProducer] = useState<Partial<Producer>>({
    farm_name: "",
    description: "",
    city: "",
  });
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    if (role !== "producer") {
      navigate({ to: "/app" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("producers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setProducer(data as Producer);
      setBusy(false);
    })();
  }, [loading, userId, role, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    setMsg(null);
    const payload = {
      user_id: userId,
      farm_name: producer.farm_name ?? "",
      description: producer.description ?? null,
      city: producer.city ?? null,
    };
    const { error } = producer.id
      ? await supabase.from("producers").update(payload).eq("id", producer.id)
      : await supabase.from("producers").insert(payload);
    setBusy(false);
    setMsg(error ? { t: "err", m: error.message } : { t: "ok", m: "Enregistré ✓" });
    if (!error && !producer.id) {
      const { data } = await supabase
        .from("producers")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setProducer(data as Producer);
    }
  }

  if (loading || busy) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-citrus" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <h1 className="font-display text-3xl font-black">Ma ferme</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cette fiche apparaît à côté de vos produits dans le catalogue.
      </p>

      <form onSubmit={save} className="mt-6 max-w-xl space-y-4">
        <Field label="Nom de l'exploitation *">
          <input
            required
            value={producer.farm_name ?? ""}
            onChange={(e) => setProducer((p) => ({ ...p, farm_name: e.target.value }))}
            className="form-input"
            placeholder="La ferme du soleil"
          />
        </Field>
        <Field label="Ville">
          <input
            value={producer.city ?? ""}
            onChange={(e) => setProducer((p) => ({ ...p, city: e.target.value }))}
            className="form-input"
            placeholder="Aix-en-Provence"
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={5}
            value={producer.description ?? ""}
            onChange={(e) => setProducer((p) => ({ ...p, description: e.target.value }))}
            className="form-input resize-y"
            placeholder="Présentez votre exploitation, vos méthodes, vos valeurs…"
          />
        </Field>

        {msg && (
          <div
            className={
              "rounded-xl px-3 py-2 text-xs font-medium " +
              (msg.t === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700")
            }
          >
            {msg.m}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-citrus px-5 py-3 font-bold text-white disabled:opacity-60"
        >
          <Save className="size-4" /> Enregistrer
        </button>
      </form>

      <style>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
        }
        .form-input:focus { outline: none; border-color: var(--color-citrus); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-citrus) 25%, transparent); }
      `}</style>
    </AppShell>
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
