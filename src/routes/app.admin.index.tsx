import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Store, Building2, Users, ShoppingBasket, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice } from "@/lib/types";

export const Route = createFileRoute("/app/admin/")({
  head: () => ({ meta: [{ title: "FoodLoop — Admin" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [stats, setStats] = useState<{
    pendingProducers: number;
    totalProducers: number;
    totalHubs: number;
    totalUsers: number;
    totalOrders: number;
    gmvCents: number;
  } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    if (role !== "admin") {
      navigate({ to: "/app" });
      return;
    }
    (async () => {
      const [pending, producers, hubs, users, orders] = await Promise.all([
        supabase.from("producers").select("id", { count: "exact", head: true }).eq("kyc_status", "pending"),
        supabase.from("producers").select("id", { count: "exact", head: true }),
        supabase.from("hubs").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total_cents, status").neq("status", "cancelled"),
      ]);
      const gmv = (orders.data ?? []).reduce((s, o: { total_cents: number | null }) => s + (o.total_cents ?? 0), 0);
      setStats({
        pendingProducers: pending.count ?? 0,
        totalProducers: producers.count ?? 0,
        totalHubs: hubs.count ?? 0,
        totalUsers: users.count ?? 0,
        totalOrders: orders.data?.length ?? 0,
        gmvCents: gmv,
      });
    })();
  }, [loading, userId, role, navigate]);

  if (loading || !stats) {
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
      <div>
        <h1 className="font-display text-3xl font-black">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vue d'ensemble de la plateforme FoodLoop</p>
      </div>

      {stats.pendingProducers > 0 && (
        <Link
          to="/app/admin/producers"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 transition-colors hover:bg-amber-100"
        >
          <AlertCircle className="size-5 text-amber-700" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              {stats.pendingProducers} producteur(s) en attente de validation KYC
            </p>
            <p className="text-xs text-amber-700">Cliquez pour valider</p>
          </div>
        </Link>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={<Store />} label="Producteurs" value={stats.totalProducers} sub={`${stats.pendingProducers} en attente`} />
        <StatCard icon={<Building2 />} label="Hubs" value={stats.totalHubs} />
        <StatCard icon={<Users />} label="Utilisateurs" value={stats.totalUsers} />
        <StatCard icon={<ShoppingBasket />} label="Commandes" value={stats.totalOrders} />
        <StatCard icon={<ShoppingBasket />} label="Volume d'affaires (GMV)" value={formatPrice(stats.gmvCents)} />
      </div>
    </AppShell>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-citrus [&_svg]:size-4">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-black">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
