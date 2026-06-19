import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { ProducerReviews } from "@/components/ProducerReviews";
import { formatPrice } from "@/lib/types";
import { StatusBadge } from "./app.orders";

export const Route = createFileRoute("/app/orders/$orderId")({
  head: () => ({ meta: [{ title: "FoodLoop — Commande" }] }),
  component: OrderDetail,
});

type OrderFull = {
  id: string;
  status: string;
  total_cents: number;
  pickup_code: string;
  notes: string | null;
  created_at: string;
  hubs: { name: string; address: string; city: string } | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price_cents: number;
    products: { producer_id: string; producers: { id: string; farm_name: string } | null } | null;
  }[];
};

function OrderDetail() {
  const { orderId } = useParams({ from: "/app/orders/$orderId" });
  const { role, userId } = useCurrentUser();
  const [o, setO] = useState<OrderFull | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, status, total_cents, pickup_code, notes, created_at, hubs(name,address,city), order_items(id, product_name, quantity, unit_price_cents, products(producer_id, producers(id, farm_name)))",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (!active) return;
      setO(data as OrderFull | null);
      setBusy(false);
    }
    load();
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (busy) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-citrus" />
        </div>
      </AppShell>
    );
  }

  if (!o) {
    return (
      <AppShell role={role}>
        <div className="mt-8 text-center text-sm text-muted-foreground">Commande introuvable.</div>
      </AppShell>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    `FOODLOOP:${o.id}:${o.pickup_code}`,
  )}`;

  return (
    <AppShell role={role}>
      <Link
        to="/app/orders"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes commandes
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-black">Commande #{o.pickup_code}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(o.created_at).toLocaleString("fr-FR")}
          </p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 text-center">
          <h2 className="font-display text-lg font-bold">Code de retrait</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Présentez ce QR code au hub de retrait
          </p>
          <img src={qrUrl} alt="QR code" className="mx-auto mt-4 size-48" />
          <p className="mt-3 font-display text-3xl font-black tracking-widest text-amalfi">
            {o.pickup_code}
          </p>
        </section>

        <section className="space-y-4">
          {o.hubs && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="mr-1 inline size-3" /> Hub de retrait
              </h3>
              <p className="mt-1 font-bold">{o.hubs.name}</p>
              <p className="text-sm text-muted-foreground">
                {o.hubs.address} · {o.hubs.city}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Articles
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {o.order_items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>
                    {i.quantity} × {i.product_name}
                  </span>
                  <span className="font-semibold">
                    {formatPrice(i.quantity * i.unit_price_cents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3">
              <span className="font-bold">Total</span>
              <span className="font-display text-xl font-black text-amalfi">
                {formatPrice(o.total_cents)}
              </span>
            </div>
          </div>

          {o.notes && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </h3>
              <p className="mt-1 text-sm">{o.notes}</p>
            </div>
          )}
        </section>
      </div>

      {(() => {
        const seen = new Set<string>();
        const producers: { id: string; farm_name: string }[] = [];
        for (const it of o.order_items) {
          const pr = it.products?.producers;
          if (pr && !seen.has(pr.id)) {
            seen.add(pr.id);
            producers.push(pr);
          }
        }
        if (!producers.length) return null;
        return (
          <div className="mt-8 space-y-6">
            <h2 className="font-display text-2xl font-black">Noter vos producteurs</h2>
            {producers.map((pr) => (
              <div key={pr.id} className="rounded-2xl border border-border bg-card p-5">
                <p className="mb-3 font-semibold">{pr.farm_name}</p>
                <ProducerReviews
                  producerId={pr.id}
                  userId={userId ?? undefined}
                  orderId={o.id}
                  canReview
                />
              </div>
            ))}
          </div>
        );
      })()}
    </AppShell>
  );
}
