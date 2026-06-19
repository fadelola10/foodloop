import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/cart";
import { StatusBadge } from "./app.orders";

export const Route = createFileRoute("/app/orders-received")({
  head: () => ({ meta: [{ title: "FoodLoop — Commandes reçues" }] }),
  component: OrdersReceived,
});

type Row = {
  id: string;
  status: string;
  total_cents: number;
  pickup_code: string;
  created_at: string;
  notes: string | null;
  hubs: { name: string; city: string } | null;
  order_items: { id: string; product_name: string; quantity: number; producer_id: string }[];
};

const STATUS_FLOW: Record<string, string> = {
  paid: "preparing",
  preparing: "ready",
  ready: "picked_up",
};

function OrdersReceived() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [producerId, setProducerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

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
        setBusy(false);
        return;
      }
      setProducerId(prod.id);
      const { data } = await supabase
        .from("orders")
        .select(
          "id, status, total_cents, pickup_code, created_at, notes, hubs(name, city), order_items(id, product_name, quantity, producer_id)",
        )
        .order("created_at", { ascending: false });
      const filtered = ((data as Row[]) ?? []).filter((o) =>
        o.order_items.some((i) => i.producer_id === prod.id),
      );
      setRows(filtered);
      setBusy(false);
    })();
  }, [loading, userId, role, navigate]);

  async function advance(id: string, current: string) {
    const next = STATUS_FLOW[current] as
      | "preparing"
      | "ready"
      | "picked_up"
      | undefined;
    if (!next) return;
    await supabase.from("orders").update({ status: next }).eq("id", id);
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status: next } : o)));
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
      <h1 className="font-display text-3xl font-black">Commandes reçues</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {rows.length} commande{rows.length > 1 ? "s" : ""}
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Aucune commande reçue pour le moment.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((o) => {
            const mine = o.order_items.filter((i) => i.producer_id === producerId);
            const nextStatus = STATUS_FLOW[o.status];
            return (
              <div
                key={o.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold">Commande #{o.pickup_code}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("fr-FR")}
                      {o.hubs ? ` · ${o.hubs.name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {mine.map((i) => (
                    <li key={i.id} className="flex justify-between">
                      <span>
                        {i.quantity} × {i.product_name}
                      </span>
                    </li>
                  ))}
                </ul>
                {o.notes && (
                  <p className="mt-2 rounded-lg bg-muted p-2 text-xs italic">{o.notes}</p>
                )}
                {nextStatus && (
                  <button
                    onClick={() => advance(o.id, o.status)}
                    className="mt-3 w-full rounded-xl bg-citrus py-2 text-sm font-bold text-white"
                  >
                    Passer à : {ORDER_STATUS_LABELS[nextStatus]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
