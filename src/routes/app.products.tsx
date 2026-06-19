import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice, UNIT_LABELS, type Product } from "@/lib/types";

export const Route = createFileRoute("/app/products")({
  head: () => ({ meta: [{ title: "FoodLoop — Mes produits" }] }),
  component: AppProductsRoute,
});

function AppProductsRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isProductsIndex = pathname.replace(/\/+$/, "") === "/app/products";

  return isProductsIndex ? <ProductsList /> : <Outlet />;
}

function ProductsList() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [items, setItems] = useState<Product[]>([]);
  const [busy, setBusy] = useState(true);
  const [hasProducer, setHasProducer] = useState<boolean | null>(null);

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
      const { data: prod } = await supabase
        .from("producers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!prod) {
        setHasProducer(false);
        setBusy(false);
        return;
      }
      setHasProducer(true);
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("producer_id", prod.id)
        .order("created_at", { ascending: false });
      setItems((data as Product[]) ?? []);
      setBusy(false);
    })();
  }, [loading, userId, role, navigate]);

  if (loading || busy) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-citrus" />
        </div>
      </AppShell>
    );
  }

  if (!hasProducer) {
    return (
      <AppShell role={role}>
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Package className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-3 font-display text-xl font-bold">Créez d'abord votre ferme</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Renseignez la fiche de votre exploitation avant d'ajouter des produits.
          </p>
          <Link
            to="/app/producer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-citrus px-4 py-2 font-bold text-white"
          >
            Compléter ma ferme
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black">Mes produits</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} produit(s)</p>
        </div>
        <Link
          to="/app/products/new"
          className="inline-flex items-center gap-2 rounded-xl bg-citrus px-4 py-2 font-bold text-white"
        >
          <Plus className="size-4" /> Ajouter
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun produit pour l'instant. Cliquez sur « Ajouter » pour commencer.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((p, i) => (
            <Link
              key={p.id}
              to="/app/products/$productId"
              params={{ productId: p.id }}
              className={
                "flex items-center gap-4 p-4 transition-colors hover:bg-muted " +
                (i > 0 ? "border-t border-border" : "")
              }
            >
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-xl">🥬</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold truncate">{p.name}</h3>
                  {!p.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Inactif
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(p.price_cents)} / {UNIT_LABELS[p.unit]} · Stock {p.stock}
                </p>
              </div>
              <Pencil className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
