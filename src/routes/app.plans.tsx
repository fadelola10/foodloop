import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice } from "@/lib/types";

export const Route = createFileRoute("/app/plans")({
  head: () => ({ meta: [{ title: "FoodLoop — Paniers d'abonnement" }] }),
  component: PlansPage,
});

const TYPES: { v: "fruits" | "legumes" | "mix" | "autre"; label: string; emoji: string }[] = [
  { v: "fruits", label: "Fruits de saison", emoji: "🍑" },
  { v: "legumes", label: "Légumes de saison", emoji: "🥬" },
  { v: "mix", label: "Mix fruits & légumes", emoji: "🧺" },
  { v: "autre", label: "Autre", emoji: "📦" },
];

type Product = { id: string; name: string; price_cents: number };
type PlanItem = { id: string; quantity: number; products: Product | null };
type Plan = {
  id: string;
  name: string;
  description: string | null;
  basket_type: "fruits" | "legumes" | "mix" | "autre";
  price_cents: number;
  is_active: boolean;
  subscription_plan_items: PlanItem[];
};

function PlansPage() {
  const navigate = useNavigate();
  const { loading: authLoading, userId, role } = useCurrentUser();
  const [producerId, setProducerId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    basket_type: "legumes" as Plan["basket_type"],
    price_cents: 2500,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    if (role !== "producer") {
      navigate({ to: "/app" });
      return;
    }
    (async () => {
      const { data: pr } = await supabase
        .from("producers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!pr) {
        setLoading(false);
        return;
      }
      setProducerId(pr.id);
      await reload(pr.id);
    })();
  }, [authLoading, userId, role]);

  async function reload(pid: string) {
    setLoading(true);
    const [p, prods] = await Promise.all([
      (supabase.from as any)("subscription_plans")
        .select("*, subscription_plan_items(id,quantity,products(id,name,price_cents))")
        .eq("producer_id", pid)
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id,name,price_cents")
        .eq("producer_id", pid)
        .eq("is_active", true)
        .order("name"),
    ]);
    setPlans((p.data ?? []) as Plan[]);
    setProducts((prods.data ?? []) as Product[]);
    setLoading(false);
  }

  async function createPlan() {
    if (!producerId || !draft.name.trim()) return;
    setCreating(true);
    const { error } = await (supabase.from as any)("subscription_plans").insert({
      producer_id: producerId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      basket_type: draft.basket_type,
      price_cents: draft.price_cents,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Panier créé");
    setDraft({ name: "", description: "", basket_type: "legumes", price_cents: 2500 });
    reload(producerId);
  }

  async function updatePlan(id: string, patch: Partial<Plan>) {
    const { error } = await (supabase.from as any)("subscription_plans").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (producerId) reload(producerId);
  }

  async function deletePlan(id: string) {
    if (!confirm("Supprimer ce panier ?")) return;
    const { error } = await (supabase.from as any)("subscription_plans").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Panier supprimé");
    if (producerId) reload(producerId);
  }

  async function addItem(planId: string, productId: string) {
    if (!productId) return;
    const { error } = await (supabase.from as any)("subscription_plan_items").insert({
      plan_id: planId,
      product_id: productId,
      quantity: 1,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (producerId) reload(producerId);
  }

  async function removeItem(itemId: string) {
    const { error } = await (supabase.from as any)("subscription_plan_items").delete().eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (producerId) reload(producerId);
  }

  async function changeQty(itemId: string, qty: number) {
    if (qty < 1) return;
    const { error } = await (supabase.from as any)("subscription_plan_items").update({ quantity: qty }).eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (producerId) reload(producerId);
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
      <h1 className="font-display text-3xl font-black">Paniers d'abonnement</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Composez plusieurs formules hebdomadaires (fruits, légumes, mix…) que vos clients pourront choisir.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Nouveau panier</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Ex : Panier hebdo légumes de saison"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={draft.basket_type}
            onChange={(e) => setDraft({ ...draft, basket_type: e.target.value as Plan["basket_type"] })}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.emoji} {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={50}
            value={draft.price_cents}
            onChange={(e) => setDraft({ ...draft, price_cents: Number(e.target.value) })}
            placeholder="Prix en centimes"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description (optionnel)"
            rows={2}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <button
          onClick={createPlan}
          disabled={creating || !draft.name.trim()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-citrus px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Créer le panier
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Aucun panier pour le moment.
          </p>
        ) : (
          plans.map((plan) => {
            const total = plan.subscription_plan_items.reduce(
              (s, i) => s + (i.products?.price_cents ?? 0) * i.quantity,
              0,
            );
            return (
              <div key={plan.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <input
                      value={plan.name}
                      onChange={(e) =>
                        setPlans((arr) => arr.map((p) => (p.id === plan.id ? { ...p, name: e.target.value } : p)))
                      }
                      onBlur={(e) => updatePlan(plan.id, { name: e.target.value } as any)}
                      className="w-full bg-transparent font-display text-xl font-bold outline-none"
                    />
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <select
                        value={plan.basket_type}
                        onChange={(e) => updatePlan(plan.id, { basket_type: e.target.value } as any)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      >
                        {TYPES.map((t) => (
                          <option key={t.v} value={t.v}>
                            {t.emoji} {t.label}
                          </option>
                        ))}
                      </select>
                      <label className="inline-flex items-center gap-1 text-xs">
                        Prix affiché :
                        <input
                          type="number"
                          min={0}
                          step={50}
                          defaultValue={plan.price_cents}
                          onBlur={(e) => updatePlan(plan.id, { price_cents: Number(e.target.value) } as any)}
                          className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={plan.is_active}
                          onChange={(e) => updatePlan(plan.id, { is_active: e.target.checked } as any)}
                        />
                        Actif
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="text-destructive hover:opacity-70"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <textarea
                  defaultValue={plan.description ?? ""}
                  onBlur={(e) => updatePlan(plan.id, { description: e.target.value || null } as any)}
                  placeholder="Description"
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />

                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contenu du panier (modifiable chaque semaine)
                  </h3>
                  <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                    {plan.subscription_plan_items.length === 0 ? (
                      <li className="p-3 text-sm text-muted-foreground">Aucun produit</li>
                    ) : (
                      plan.subscription_plan_items.map((it) => (
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
                  <div className="mt-2 flex gap-2">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        addItem(plan.id, e.target.value);
                        e.target.value = "";
                      }}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">+ Ajouter un produit…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({formatPrice(p.price_cents)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    Coût réel du contenu : {formatPrice(total)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
