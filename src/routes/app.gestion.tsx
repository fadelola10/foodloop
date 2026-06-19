import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, ShoppingBag, Wallet, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";

export const Route = createFileRoute("/app/gestion")({
  head: () => ({ meta: [{ title: "FoodLoop — Gestion" }] }),
  component: Gestion,
});

type Row = {
  quantity: number;
  unit_price_cents: number;
  order_id: string;
  orders: { status: string; created_at: string } | null;
};

const COUNTED: ReadonlySet<string> = new Set(["paid", "preparing", "ready", "picked_up"]);

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function Gestion() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [busy, setBusy] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!userId) return void navigate({ to: "/" });
    if (role !== "producer") return void navigate({ to: "/app" });
    (async () => {
      const { data: prod } = await supabase
        .from("producers").select("id").eq("user_id", userId).maybeSingle();
      if (!prod) { setBusy(false); return; }
      const { data } = await supabase
        .from("order_items")
        .select("quantity, unit_price_cents, order_id, orders!inner(status, created_at)")
        .eq("producer_id", prod.id);
      setRows((data ?? []) as unknown as Row[]);
      setBusy(false);
    })();
  }, [loading, userId, role, navigate]);

  const stats = useMemo(() => {
    const valid = rows.filter((r) => r.orders && COUNTED.has(r.orders.status));
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const start7 = new Date(now); start7.setDate(now.getDate() - 7);
    const start30 = new Date(now); start30.setDate(now.getDate() - 30);
    const start365 = new Date(now); start365.setFullYear(now.getFullYear() - 1);

    const sum = (arr: Row[]) =>
      arr.reduce((s, r) => s + r.unit_price_cents * r.quantity, 0);
    const orderIds = (arr: Row[]) => new Set(arr.map((r) => r.order_id)).size;
    const inRange = (from: Date) =>
      valid.filter((r) => new Date(r.orders!.created_at) >= from);

    const monthly: { label: string; cents: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const m = valid.filter((r) => {
        const c = new Date(r.orders!.created_at);
        return c >= d && c < end;
      });
      monthly.push({
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        cents: sum(m),
      });
    }
    const maxMonthly = Math.max(1, ...monthly.map((m) => m.cents));

    return {
      caTotal: sum(valid),
      nbOrders: orderIds(valid),
      caMonth: sum(inRange(startOfMonth)),
      ca7: sum(inRange(start7)),
      ca30: sum(inRange(start30)),
      ca365: sum(inRange(start365)),
      nbMonth: orderIds(inRange(startOfMonth)),
      monthly,
      maxMonthly,
    };
  }, [rows]);

  if (loading || busy) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-citrus" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <h1 className="font-display text-3xl font-black">Gestion</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suivi de votre activité (commandes payées et au-delà).
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Wallet className="size-5" />} label="CA total" value={fmt(stats.caTotal)} />
        <Stat icon={<ShoppingBag className="size-5" />} label="Commandes" value={String(stats.nbOrders)} />
        <Stat icon={<Calendar className="size-5" />} label="CA ce mois" value={fmt(stats.caMonth)} sub={`${stats.nbMonth} commande${stats.nbMonth > 1 ? "s" : ""}`} />
        <Stat icon={<TrendingUp className="size-5" />} label="CA 30 j" value={fmt(stats.ca30)} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="7 derniers jours" value={fmt(stats.ca7)} />
        <Stat label="30 derniers jours" value={fmt(stats.ca30)} />
        <Stat label="12 derniers mois" value={fmt(stats.ca365)} />
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">CA par mois (12 derniers mois)</h2>
        {stats.caTotal === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucune commande encaissée pour l'instant.
          </p>
        ) : (
          <div className="mt-5 flex h-48 items-end gap-2">
            {stats.monthly.map((m, i) => {
              const h = Math.max(2, Math.round((m.cents / stats.maxMonthly) * 100));
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full text-center text-[10px] font-semibold text-muted-foreground">
                    {m.cents > 0 ? fmt(m.cents) : ""}
                  </div>
                  <div
                    className="w-full rounded-t-md bg-citrus/80"
                    style={{ height: `${h}%` }}
                    title={`${m.label}: ${fmt(m.cents)}`}
                  />
                  <div className="text-[11px] font-semibold capitalize text-muted-foreground">{m.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-black">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
