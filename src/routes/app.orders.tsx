import { createFileRoute, Link, useNavigate, useRouterState, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/cart";

export const Route = createFileRoute("/app/orders")({
  head: () => ({ meta: [{ title: "FoodLoop — Mes commandes" }] }),
  component: OrdersRoute,
});

function OrdersRoute() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isList = pathname.replace(/\/+$/, "") === "/app/orders";
  return isList ? <OrdersList /> : <Outlet />;
}

type OrderRow = {
  id: string;
  status: string;
  total_cents: number;
  pickup_code: string;
  created_at: string;
  hubs: { name: string; city: string } | null;
};

function OrdersList() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, total_cents, pickup_code, created_at, hubs(name, city)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setOrders((data as OrderRow[]) ?? []);
      setBusy(false);
    })();

    const channel = supabase
      .channel("orders-mine")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from("orders")
            .select("id, status, total_cents, pickup_code, created_at, hubs(name, city)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .then(({ data }) => setOrders((data as OrderRow[]) ?? []));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loading, userId, navigate]);

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
      <h1 className="font-display text-3xl font-black">Mes commandes</h1>
      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Aucune commande pour l'instant.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/app/orders/$orderId"
              params={{ orderId: o.id }}
              className="block rounded-2xl border border-border bg-card p-4 hover:border-citrus/50 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold">Commande #{o.pickup_code}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("fr-FR")}
                    {o.hubs ? ` · ${o.hubs.name}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status={o.status} />
                  <p className="mt-1 font-display text-lg font-black text-amalfi">
                    {formatPrice(o.total_cents)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    paid: "bg-blue-100 text-blue-700",
    preparing: "bg-amber-100 text-amber-700",
    ready: "bg-emerald-100 text-emerald-700",
    picked_up: "bg-emerald-200 text-emerald-800",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold " +
        (colors[status] ?? "bg-gray-100 text-gray-700")
      }
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
