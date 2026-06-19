import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Search, MapPin, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { addToCart } from "@/lib/cart";
import { formatPrice, UNIT_LABELS, type Category, type Label, type Product } from "@/lib/types";

export const Route = createFileRoute("/catalogue")({
  head: () => ({ meta: [{ title: "FoodLoop — Catalogue" }] }),
  component: Catalogue,
});

type ProductWithProducer = Product & {
  producers: { id: string; farm_name: string; city: string | null } | null;
  product_labels: { label_id: string }[];
};

function Catalogue() {
  const { role, userId } = useCurrentUser();
  const navigate = useNavigate();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [products, setProducts] = useState<ProductWithProducer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [lab, setLab] = useState<string | null>(null);
  const [city, setCity] = useState("");

  useEffect(() => {
    (async () => {
      const [c, l] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("labels").select("*").order("name"),
      ]);
      setCategories((c.data as Category[]) ?? []);
      setLabels((l.data as Label[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("*, producers(id,farm_name,city), product_labels(label_id)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cat) query = query.eq("category_id", cat);
      if (q.trim()) query = query.ilike("name", `%${q.trim()}%`);
      const { data } = await query;
      if (!active) return;
      let list = (data as ProductWithProducer[]) ?? [];
      if (lab) list = list.filter((p) => p.product_labels.some((x) => x.label_id === lab));
      if (city.trim()) {
        const c = city.trim().toLowerCase();
        list = list.filter((p) => p.producers?.city?.toLowerCase().includes(c));
      }
      setProducts(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [q, cat, lab, city]);

  return (
    <AppShell role={role}>
      <h1 className="font-display text-3xl font-black">Catalogue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {products.length} produit{products.length > 1 ? "s" : ""} de nos producteurs locaux
      </p>

      <div className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un produit…"
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm focus:border-citrus focus:outline-none"
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ville (ex: Marseille)"
              className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm focus:border-citrus focus:outline-none"
            />
          </div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={!cat} onClick={() => setCat(null)}>Toutes</Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.icon} {c.name}
            </Chip>
          ))}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip small active={!lab} onClick={() => setLab(null)}>Tous labels</Chip>
          {labels.map((l) => (
            <Chip key={l.id} small active={lab === l.id} onClick={() => setLab(l.id)}>
              {l.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-citrus" />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
            Aucun produit ne correspond à vos critères.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <Link
                  to="/catalogue/$productId"
                  params={{ productId: p.id }}
                  className="block"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-4xl">🥬</div>
                    )}
                  </div>
                  <div className="p-4 pb-2">
                    <h3 className="font-display text-lg font-bold leading-tight">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.producers?.farm_name}
                      {p.producers?.city ? ` · ${p.producers.city}` : ""}
                    </p>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-display text-xl font-black text-amalfi">
                        {formatPrice(p.price_cents)}
                      </span>
                      <span className="text-xs text-muted-foreground">/ {UNIT_LABELS[p.unit]}</span>
                    </div>
                  </div>
                </Link>
                <div className="px-4 pb-4">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!userId) {
                        navigate({ to: "/" });
                        return;
                      }
                      if (p.stock <= 0) return;
                      setAddingId(p.id);
                      try {
                        await addToCart(userId, p.id, 1);
                        toast.success("Ajouté au panier");
                      } catch (err) {
                        toast.error("Erreur : " + (err as Error).message);
                      } finally {
                        setAddingId(null);
                      }
                    }}
                    disabled={addingId === p.id || p.stock <= 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-citrus py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {addingId === p.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="size-4" />
                    )}
                    {p.stock <= 0 ? "Rupture" : "Ajouter au panier"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 whitespace-nowrap rounded-full border font-semibold transition-colors " +
        (small ? "px-3 py-1 text-xs " : "px-4 py-2 text-sm ") +
        (active
          ? "border-citrus bg-citrus text-white"
          : "border-border bg-card text-muted-foreground hover:bg-muted")
      }
    >
      {children}
    </button>
  );
}
