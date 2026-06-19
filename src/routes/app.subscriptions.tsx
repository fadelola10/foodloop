import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Trash2, Repeat, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice } from "@/lib/types";

export const Route = createFileRoute("/app/subscriptions")({
  head: () => ({ meta: [{ title: "FoodLoop — Mes abonnements" }] }),
  component: SubscriptionsPage,
});

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

type Sub = {
  id: string;
  status: "active" | "paused" | "cancelled";
  day_of_week: number;
  next_run_at: string;
  hub_id: string | null;
  plan_id: string | null;
  producers: { id: string; farm_name: string; city: string | null } | null;
  hubs: { id: string; name: string; city: string } | null;
  subscription_plans: { id: string; name: string; basket_type: string; price_cents: number } | null;
  subscription_items: {
    id: string;
    quantity: number;
    products: { id: string; name: string; price_cents: number } | null;
  }[];
};

type Hub = { id: string; name: string; city: string };

const BASKET_LABELS: Record<string, { label: string; emoji: string }> = {
  fruits: { label: "Fruits de saison", emoji: "🍑" },
  legumes: { label: "Légumes de saison", emoji: "🥬" },
  mix: { label: "Mix fruits & légumes", emoji: "🧺" },
  autre: { label: "Autre", emoji: "📦" },
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  basket_type: keyof typeof BASKET_LABELS;
  price_cents: number;
  producers: { id: string; farm_name: string; city: string | null } | null;
};

function SubscriptionsPage() {
  const { role, userId, loading: authLoading } = useCurrentUser() as any;
  const [subs, setSubs] = useState<Sub[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    const [s, h, p] = await Promise.all([
      (supabase.from as any)("subscriptions")
        .select(
          "id,status,day_of_week,next_run_at,hub_id,plan_id,producers(id,farm_name,city),hubs(id,name,city),subscription_plans(id,name,basket_type,price_cents),subscription_items(id,quantity,products(id,name,price_cents))",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("hubs").select("id,name,city").eq("is_active", true),
      (supabase.from as any)("subscription_plans")
        .select("id,name,description,basket_type,price_cents,producers(id,farm_name,city)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);
    setSubs((s.data ?? []) as Sub[]);
    setHubs((h.data ?? []) as Hub[]);
    setPlans((p.data ?? []) as Plan[]);
    setLoading(false);
  }

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  async function subscribeToPlan(plan: Plan) {
    if (!userId || !plan.producers) return;
    setSubscribingTo(plan.id);
    const { error } = await (supabase.from as any)("subscriptions").insert({
      user_id: userId,
      producer_id: plan.producers.id,
      plan_id: plan.id,
    });
    setSubscribingTo(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Abonnement créé !");
    load();
  }

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await (supabase.from as any)("subscriptions").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Abonnement mis à jour");
    load();
  }

  async function cancel(id: string) {
    if (!confirm("Supprimer cet abonnement ?")) return;
    const { error } = await (supabase.from as any)("subscriptions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Abonnement supprimé");
    load();
  }

  async function removeItem(itemId: string) {
    const { error } = await (supabase.from as any)("subscription_items").delete().eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  async function changeQty(itemId: string, qty: number) {
    if (qty < 1) return;
    const { error } = await (supabase.from as any)("subscription_items").update({ quantity: qty }).eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  if (authLoading || loading) {
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
      <h1 className="font-display text-3xl font-black">Mes abonnements</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Recevez chaque semaine un panier de votre ferme préférée.
      </p>

      {subs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Repeat className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucun abonnement actif</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Abonnez-vous depuis la fiche d'un produit.
          </p>
          <Link
            to="/catalogue"
            className="mt-4 inline-flex rounded-xl bg-citrus px-4 py-2 text-sm font-bold text-white"
          >
            Parcourir le catalogue
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {subs.map((s) => {
            const isPlan = !!s.plan_id;
            const total = isPlan
              ? s.subscription_plans?.price_cents ?? 0
              : s.subscription_items.reduce(
                  (sum, i) => sum + (i.products?.price_cents ?? 0) * i.quantity,
                  0,
                );
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold">
                      {isPlan
                        ? `${BASKET_LABELS[s.subscription_plans?.basket_type ?? "autre"]?.emoji ?? ""} ${s.subscription_plans?.name}`
                        : s.producers?.farm_name ?? "Producteur"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {s.producers?.farm_name}
                      {s.producers?.city ? ` · ${s.producers.city}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      s.status === "active"
                        ? "bg-citrus/15 text-amalfi"
                        : s.status === "paused"
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {s.status === "active" ? "Actif" : s.status === "paused" ? "En pause" : "Annulé"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs">
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="mr-1 inline size-3" /> Jour de livraison
                    </span>
                    <select
                      value={s.day_of_week}
                      onChange={(e) => update(s.id, { day_of_week: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {DAYS.map((d, i) => (
                        <option key={i} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                      <MapPin className="mr-1 inline size-3" /> Hub de retrait
                    </span>
                    <select
                      value={s.hub_id ?? ""}
                      onChange={(e) => update(s.id, { hub_id: e.target.value || null })}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— Aucun —</option>
                      {hubs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.city})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Prochaine commande : {new Date(s.next_run_at).toLocaleDateString("fr-FR")}
                </p>

                {!isPlan && (
                  <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
                    {s.subscription_items.length === 0 ? (
                      <li className="p-3 text-sm text-muted-foreground">Aucun produit</li>
                    ) : (
                      s.subscription_items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <span className="flex-1">{it.products?.name}</span>
                          <input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => changeQty(it.id, Number(e.target.value))}
                            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-sm"
                          />
                          <span className="w-20 text-right font-semibold">
                            {formatPrice((it.products?.price_cents ?? 0) * it.quantity)}
                          </span>
                          <button
                            onClick={() => removeItem(it.id)}
                            className="text-destructive hover:opacity-70"
                            aria-label="Retirer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
                {isPlan && (
                  <p className="mt-3 text-xs italic text-muted-foreground">
                    Le contenu du panier est composé chaque semaine par le producteur selon la saison.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-lg font-black text-amalfi">
                    {formatPrice(total)} / semaine
                  </span>
                  <div className="flex gap-2">
                    {s.status === "active" ? (
                      <button
                        onClick={() => update(s.id, { status: "paused" })}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                      >
                        <Pause className="size-3" /> Mettre en pause
                      </button>
                    ) : s.status === "paused" ? (
                      <button
                        onClick={() => update(s.id, { status: "active" })}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                      >
                        <Play className="size-3" /> Reprendre
                      </button>
                    ) : null}
                    <button
                      onClick={() => cancel(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" /> Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-black">Découvrir des paniers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les producteurs proposent plusieurs formules hebdomadaires. Choisissez la vôtre.
        </p>
        {plans.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucun panier disponible pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const meta = BASKET_LABELS[plan.basket_type] ?? BASKET_LABELS.autre;
              return (
                <div key={plan.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                  <div className="text-3xl">{meta.emoji}</div>
                  <h3 className="mt-2 font-display text-lg font-bold">{plan.name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-citrus">
                    {meta.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.producers?.farm_name}
                    {plan.producers?.city ? ` · ${plan.producers.city}` : ""}
                  </p>
                  {plan.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="mt-auto flex items-end justify-between pt-4">
                    <span className="font-display text-2xl font-black text-amalfi">
                      {formatPrice(plan.price_cents)}
                      <span className="text-xs font-normal text-muted-foreground"> / sem.</span>
                    </span>
                    <button
                      onClick={() => subscribeToPlan(plan)}
                      disabled={subscribingTo === plan.id}
                      className="inline-flex items-center gap-1 rounded-xl bg-citrus px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {subscribingTo === plan.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Repeat className="size-3" />
                      )}
                      S'abonner
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
