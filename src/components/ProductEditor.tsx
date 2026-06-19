import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Save, Trash2, Upload, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import type { Category, Label, Product, ProductUnit } from "@/lib/types";

const UNITS: ProductUnit[] = ["piece", "kg", "g", "litre", "botte", "douzaine"];

export function ProductEditor({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [producerId, setProducerId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [p, setP] = useState<Partial<Product>>({
    name: "",
    description: "",
    price_cents: 0,
    unit: "piece",
    stock: 0,
    is_active: true,
    category_id: null,
  });
  const [priceEuros, setPriceEuros] = useState("0");
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

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
      const [prod, cats, labs] = await Promise.all([
        supabase.from("producers").select("id").eq("user_id", userId).maybeSingle(),
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("labels").select("*").order("name"),
      ]);
      if (!prod.data) { navigate({ to: "/app/producer" }); return; }
      setProducerId(prod.data.id);
      setCategories((cats.data as Category[]) ?? []);
      setLabels((labs.data as Label[]) ?? []);

      if (productId) {
        const { data } = await supabase
          .from("products")
          .select("*, product_labels(label_id)")
          .eq("id", productId)
          .maybeSingle();
        if (data) {
          setP(data as Product);
          setPriceEuros((data.price_cents / 100).toString());
          setSelectedLabels(
            new Set((data as { product_labels: { label_id: string }[] }).product_labels.map((x) => x.label_id)),
          );
        }
      }
      setBusy(false);
    })();
  }, [loading, userId, role, productId, navigate]);

  async function uploadImage(file: File) {
    if (!userId) return;
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ t: "err", m: "Image trop lourde (max 10 Mo)." });
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setMsg({ t: "err", m: error.message });
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setP((prev) => ({ ...prev, image_url: data.publicUrl }));
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!producerId) return;
    setBusy(true);
    setMsg(null);
    const cents = Math.round(parseFloat(priceEuros.replace(",", ".") || "0") * 100);
    const payload = {
      producer_id: producerId,
      name: p.name ?? "",
      description: p.description ?? null,
      price_cents: cents,
      unit: p.unit ?? "piece",
      stock: p.stock ?? 0,
      category_id: p.category_id ?? null,
      image_url: p.image_url ?? null,
      is_active: p.is_active ?? true,
    };
    const res = productId
      ? await supabase.from("products").update(payload).eq("id", productId).select().maybeSingle()
      : await supabase.from("products").insert(payload).select().maybeSingle();
    if (res.error || !res.data) {
      setBusy(false);
      setMsg({ t: "err", m: res.error?.message ?? "Erreur" });
      return;
    }
    const savedId = (res.data as Product).id;
    await supabase.from("product_labels").delete().eq("product_id", savedId);
    if (selectedLabels.size > 0) {
      await supabase
        .from("product_labels")
        .insert([...selectedLabels].map((label_id) => ({ product_id: savedId, label_id })));
    }
    setBusy(false);
    navigate({ to: "/app/products" });
  }

  async function remove() {
    if (!productId) return;
    if (!confirm("Supprimer ce produit ?")) return;
    setBusy(true);
    const { error } = await supabase.from("products").delete().eq("id", productId);
    setBusy(false);
    if (error) setMsg({ t: "err", m: error.message });
    else navigate({ to: "/app/products" });
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
      <Link
        to="/app/products"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mes produits
      </Link>

      <h1 className="mt-2 font-display text-3xl font-black">
        {productId ? "Modifier" : "Nouveau produit"}
      </h1>

      <form onSubmit={save} className="mt-6 max-w-2xl space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-2xl">🥬</div>
              )}
            </div>
            <div className="flex-1">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted">
                <Upload className="size-4" />
                {p.image_url ? "Changer la photo" : "Ajouter une photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">JPG/PNG, &lt; 10 Mo</p>
            </div>
          </div>
        </div>

        <Field label="Nom *">
          <input
            required
            value={p.name ?? ""}
            onChange={(e) => setP((s) => ({ ...s, name: e.target.value }))}
            className="form-input"
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={4}
            value={p.description ?? ""}
            onChange={(e) => setP((s) => ({ ...s, description: e.target.value }))}
            className="form-input resize-y"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix (€) *">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={priceEuros}
              onChange={(e) => setPriceEuros(e.target.value)}
              className="form-input"
            />
          </Field>
          <Field label="Unité">
            <select
              value={p.unit}
              onChange={(e) => setP((s) => ({ ...s, unit: e.target.value as ProductUnit }))}
              className="form-input"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock">
            <input
              type="number"
              min="0"
              value={p.stock ?? 0}
              onChange={(e) => setP((s) => ({ ...s, stock: parseInt(e.target.value || "0") }))}
              className="form-input"
            />
          </Field>
          <Field label="Catégorie">
            <select
              value={p.category_id ?? ""}
              onChange={(e) =>
                setP((s) => ({ ...s, category_id: e.target.value || null }))
              }
              className="form-input"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Labels">
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => {
              const on = selectedLabels.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedLabels);
                    if (on) next.delete(l.id);
                    else next.add(l.id);
                    setSelectedLabels(next);
                  }}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
                    (on
                      ? "border-citrus bg-citrus text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted")
                  }
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.is_active ?? true}
            onChange={(e) => setP((s) => ({ ...s, is_active: e.target.checked }))}
            className="size-4"
          />
          Produit visible dans le catalogue
        </label>

        {msg && (
          <div
            className={
              "rounded-xl px-3 py-2 text-xs font-medium " +
              (msg.t === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700")
            }
          >
            {msg.m}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-citrus px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            <Save className="size-4" /> Enregistrer
          </button>
          {productId && (
            <button
              type="button"
              onClick={remove}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="size-4" /> Supprimer
            </button>
          )}
        </div>
      </form>

      <style>{`
        .form-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-border);
          background: var(--color-card);
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
        }
        .form-input:focus { outline: none; border-color: var(--color-citrus); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-citrus) 25%, transparent); }
      `}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground/80">{label}</span>
      {children}
    </label>
  );
}
