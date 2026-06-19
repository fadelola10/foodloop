import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Loader2, MapPin, Package, ShoppingBasket, Store, ShieldCheck, Building2, Users } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { AppShell, useCurrentUser } from "@/components/AppShell";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "FoodLoop — Accueil" }] }),
  component: AppRoute,
});

function AppRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return pathname === "/app" ? <AppHome /> : <Outlet />;
}

function AppHome() {
  const navigate = useNavigate();
  const { loading, userId, email, role } = useCurrentUser();

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/" });
  }, [loading, userId, navigate]);

  if (loading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-citrus" />
      </div>
    );
  }

  return (
    <AppShell role={role}>
      <section className="rounded-2xl bg-amalfi p-6 text-white sm:p-8">
        <p className="text-sm opacity-80">Bienvenue</p>
        <h1 className="font-display text-3xl font-black sm:text-4xl">{email}</h1>
        <p className="mt-2 text-sm opacity-80">
          Espace <span className="font-semibold text-citrus">{role}</span>
        </p>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {role === "admin" ? (
          <>
            <ActionCard to="/app/admin" icon={<ShieldCheck className="size-5" />} title="Tableau de bord" desc="Vue d'ensemble de la plateforme" />
            <ActionCard to="/app/admin/producers" icon={<Store className="size-5" />} title="Validation KYC" desc="Valider les fiches producteurs en attente" />
            <ActionCard to="/app/admin/hubs" icon={<Building2 className="size-5" />} title="Gérer les hubs" desc="Créer et configurer les points de retrait" />
            <ActionCard to="/app/admin/users" icon={<Users className="size-5" />} title="Utilisateurs" desc="Gérer les rôles des utilisateurs" />
          </>
        ) : role === "producer" ? (
          <>
            <ActionCard to="/app/products" icon={<Package className="size-5" />} title="Mes produits" desc="Ajouter, modifier, gérer les stocks de votre catalogue" />
            <ActionCard to="/app/producer" icon={<Store className="size-5" />} title="Ma ferme" desc="Compléter la fiche de votre exploitation" />
            <ActionCard to="/app/orders-received" icon={<ShoppingBasket className="size-5" />} title="Commandes reçues" desc="Gérer les commandes de vos clients" />
            <ActionCard to="/hubs" icon={<MapPin className="size-5" />} title="Hubs de retrait" desc="Les points où vos clients récupèrent leurs commandes" />
          </>
        ) : (
          <>
            <ActionCard to="/catalogue" icon={<ShoppingBasket className="size-5" />} title="Explorer le catalogue" desc="Découvrir les producteurs et produits près de chez vous" />
            <ActionCard to="/app/orders" icon={<Package className="size-5" />} title="Mes commandes" desc="Suivre l'état de vos commandes" />
            <ActionCard to="/hubs" icon={<MapPin className="size-5" />} title="Trouver un hub" desc="Choisir votre point de retrait" />
          </>
        )}
      </div>
    </AppShell>
  );
}

function ActionCard({ to, icon, title, desc }: { to: string; icon: ReactNode; title: string; desc: string }) {
  return (
    <Link to={to} className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-citrus/50 hover:shadow-md">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-citrus/15 text-amalfi">{icon}</div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-amalfi" />
    </Link>
  );
}
