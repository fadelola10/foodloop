import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { getCartItems, updateCartItem } from "@/lib/cart";
import { formatPrice } from "@/lib/types";

export const Route = createFileRoute("/panier")({
  head: () => ({ meta: [{ title: "FoodLoop — Panier" }] }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [items, setItems] = useState<Awaited<ReturnType<typeof getCartItems>>>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    reload();
  }, [loading, userId]);

  async function reload() {
    if (!userId) return;
    setBusy(true);
    const data = await getCartItems(userId);
    setItems(data);
    setBusy(false);
  }

  async function setQty(id: string, q: number) {
    await updateCartItem(id, q);
    await reload();
  }

  const total = items.reduce((s, i) => s + i.quantity * i.products.price_cents, 0);

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
      <h1 className="font-display text-3xl font-black">Mon panier</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {items.length} article{items.length > 1 ? "s" : ""}
      </p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
          <Link
            to="/catalogue"
            className="mt-4 inline-block rounded-xl bg-citrus px-5 py-2.5 text-sm font-bold text-white"
          >
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {it.products.image_url ? (
                    <img
                      src={it.products.image_url}
                      alt={it.products.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-2xl">🥬</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display font-bold">{it.products.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(it.products.price_cents)} / {it.products.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setQty(it.id, it.quantity - 1)}
                    className="grid size-8 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{it.quantity}</span>
                  <button
                    onClick={() => setQty(it.id, Math.min(it.products.stock, it.quantity + 1))}
                    className="grid size-8 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setQty(it.id, 0)}
                    className="ml-1 grid size-8 place-items-center rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-amalfi p-5 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-sm opacity-80">Total</span>
              <span className="font-display text-3xl font-black">{formatPrice(total)}</span>
            </div>
            <Link
              to="/checkout"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-citrus py-3 font-bold text-white"
            >
              Commander <ArrowRight className="size-4" />
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
