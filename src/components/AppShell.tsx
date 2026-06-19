import { Link } from "@tanstack/react-router";
import { LogOut, Home, Store, ShoppingBasket, MapPin, Package, ShoppingCart, ClipboardList, Inbox, ShieldCheck, Users, Building2, BarChart3, Repeat } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { NotificationBell } from "@/components/NotificationBell";

type NavItem = { to: string; label: string; icon: ReactNode };

const consumerNav: NavItem[] = [
  { to: "/app", label: "Accueil", icon: <Home className="size-4" /> },
  { to: "/catalogue", label: "Catalogue", icon: <ShoppingBasket className="size-4" /> },
  { to: "/panier", label: "Panier", icon: <ShoppingCart className="size-4" /> },
  { to: "/app/orders", label: "Commandes", icon: <ClipboardList className="size-4" /> },
  { to: "/app/subscriptions", label: "Abonnements", icon: <Repeat className="size-4" /> },
  { to: "/hubs", label: "Hubs", icon: <MapPin className="size-4" /> },
];

const producerNav: NavItem[] = [
  { to: "/app", label: "Accueil", icon: <Home className="size-4" /> },
  { to: "/app/products", label: "Mes produits", icon: <Package className="size-4" /> },
  { to: "/app/plans", label: "Paniers", icon: <Repeat className="size-4" /> },
  { to: "/app/orders-received", label: "Commandes reçues", icon: <Inbox className="size-4" /> },
  { to: "/app/gestion", label: "Gestion", icon: <BarChart3 className="size-4" /> },
  { to: "/app/producer", label: "Ma ferme", icon: <Store className="size-4" /> },
  { to: "/catalogue", label: "Catalogue", icon: <ShoppingBasket className="size-4" /> },
];

const adminNav: NavItem[] = [
  { to: "/app/admin", label: "Tableau de bord", icon: <ShieldCheck className="size-4" /> },
  { to: "/app/admin/producers", label: "Producteurs (KYC)", icon: <Store className="size-4" /> },
  { to: "/app/admin/hubs", label: "Hubs", icon: <Building2 className="size-4" /> },
  { to: "/app/admin/users", label: "Utilisateurs", icon: <Users className="size-4" /> },
  { to: "/catalogue", label: "Catalogue", icon: <ShoppingBasket className="size-4" /> },
];

export function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: "consumer" | "producer" | "admin" | null;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const nav = role === "admin" ? adminNav : role === "producer" ? producerNav : consumerNav;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/app" className="font-display text-2xl font-black">
            <span className="text-amalfi">Food</span>
            <span className="text-citrus">Loop</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeProps={{ className: "bg-citrus/15 text-amalfi" }}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.icon}
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} />
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-muted"
              aria-label="Déconnexion"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border bg-card px-2 py-2 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "bg-citrus/15 text-amalfi" }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export function useCurrentUser() {
  const [state, setState] = useState<{
    loading: boolean;
    userId: string | null;
    email: string | null;
    role: "consumer" | "producer" | "admin" | null;
  }>({ loading: true, userId: null, email: null, role: null });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (active) setState({ loading: false, userId: null, email: null, role: null });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (!active) return;
      const rolesList = (roles ?? []).map((r) => r.role as "consumer" | "producer" | "admin");
      const role = rolesList.includes("admin")
        ? "admin"
        : rolesList.includes("producer")
        ? "producer"
        : rolesList[0] ?? "consumer";
      setState({
        loading: false,
        userId: data.user.id,
        email: data.user.email ?? null,
        role,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
