import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MapPin, Repeat, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { ProducerReviews } from "@/components/ProducerReviews";
import { addToCart } from "@/lib/cart";
import { formatPrice, UNIT_LABELS, type Product, type Label } from "@/lib/types";

export const Route = createFileRoute("/catalogue/$productId")({
  head: () => ({ meta: [{ title: "FoodLoop — Produit" }] }),
  component: ProductDetail,
});

type Full = Product & {
  producers: { id: string; farm_name: string; city: string | null; description: string | null } | null;
  categories: { name: string } | null;
  product_labels: { labels: Label }[];
};

function ProductDetail() {
  const { productId } = useParams({ from: "/catalogue/$productId" });
  const navigate = useNavigate();
  const { role, userId } = useCurrentUser();
  const [p, setP] = useState<Full | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  async function handleSubscribe() {
    if (!p || !p.producers) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    setSubscribing(true);
    try {
      const { data: existing } = await (supabase.from as any)("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("producer_id", p.producers.id)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle();

      let subId: string | undefined = existing?.id;
      if (!subId) {
        const { data: created, error } = await (supabase.from as any)("subscriptions")
          .insert({ user_id: userId, producer_id: p.producers.id })
          .select("id")
          .single();
        if (error) throw error;
        subId = created.id;
      }

      const { data: itemExisting } = await (supabase.from as any)("subscription_items")
        .select("id,quantity")
        .eq("subscription_id", subId)
        .eq("product_id", p.id)
        .maybeSingle();

      if (itemExisting) {
        await (supabase.from as any)("subscription_items")
          .update({ quantity: itemExisting.quantity + 1 })
          .eq("id", itemExisting.id);
      } else {
        const { error } = await (supabase.from as any)("subscription_items")
          .insert({ subscription_id: subId, product_id: p.id, quantity: 1 });
        if (error) throw error;
      }

      toast.success("Abonnement hebdomadaire mis à jour");
      navigate({ to: "/app/subscriptions" });
    } catch (e) {
      toast.error("Erreur : " + (e as Error).message);
    } finally {
      setSubscribing(false);
    }
  }

  async function handleAdd() {
    if (!p) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    setAdding(true);
    try {
      await addToCart(userId, p.id, 1);
      toast.success("Ajouté au panier");
    } catch (e) {
      toast.error("Erreur : " + (e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "*, producers(id,farm_name,city,description), categories(name), product_labels(labels(*))",
        )
        .eq("id", productId)
        .maybeSingle();
      setP(data as Full | null);
      setLoading(false);
    })();
  }, [productId]);

  return (
    <AppShell role={role}>
      <Link
        to="/catalogue"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Catalogue
      </Link>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-citrus" />
        </div>
      ) : !p ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Produit introuvable.
        </div>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-7xl">🥬</div>
            )}
          </div>

          <div>
            {p.categories?.name && (
              <span className="text-xs font-semibold uppercase tracking-wider text-citrus">
                {p.categories.name}
              </span>
            )}
            <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">{p.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              <MapPin className="mr-1 inline size-3" />
              {p.producers?.farm_name}
              {p.producers?.city ? ` · ${p.producers.city}` : ""}
            </p>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-4xl font-black text-amalfi">
                {formatPrice(p.price_cents)}
              </span>
              <span className="text-sm text-muted-foreground">/ {UNIT_LABELS[p.unit]}</span>
            </div>

            {p.product_labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.product_labels.map(({ labels }) => (
                  <span
                    key={labels.id}
                    className="rounded-full bg-citrus/15 px-3 py-1 text-xs font-semibold text-amalfi"
                  >
                    {labels.name}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              {p.stock > 0 ? `${p.stock} en stock` : "Rupture"}
            </p>

            {p.description && (
              <div className="mt-6 rounded-2xl bg-muted/50 p-4">
                <h2 className="font-display font-bold">Description</h2>
                <p className="mt-1 whitespace-pre-line text-sm">{p.description}</p>
              </div>
            )}

            {p.producers?.description && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <h2 className="font-display font-bold">À propos du producteur</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.producers.description}</p>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={adding || p.stock <= 0}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-citrus py-3.5 text-base font-bold text-white disabled:opacity-60"
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShoppingCart className="size-4" />
              )}
              {p.stock <= 0 ? "Rupture de stock" : "Ajouter au panier"}
            </button>

            <button
              onClick={handleSubscribe}
              disabled={subscribing || p.stock <= 0}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-citrus py-3 text-sm font-bold text-amalfi hover:bg-citrus/10 disabled:opacity-60"
            >
              {subscribing ? <Loader2 className="size-4 animate-spin" /> : <Repeat className="size-4" />}
              S'abonner (panier hebdo)
            </button>
          </div>
        </div>
      )}

      {p?.producers?.id && (
        <div className="mt-10">
          <ProducerReviews producerId={p.producers.id} userId={userId ?? undefined} />
        </div>
      )}
    </AppShell>
  );
}
