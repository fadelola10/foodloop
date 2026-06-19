import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import type { Hub } from "@/lib/types";

export const Route = createFileRoute("/app/admin/hubs")({
  head: () => ({ meta: [{ title: "FoodLoop — Admin · Hubs" }] }),
  component: AdminHubs,
});

const empty: Partial<Hub> = { name: "", address: "", city: "", description: "", is_active: true };

function AdminHubs() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState<Partial<Hub>>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function reload() {
    const { data } = await supabase.from("hubs").select("*").order("name");
    setHubs((data ?? []) as Hub[]);
    setBusy(false);
  }

  useEffect(() => {
    if (loading) return;
    if (!userId) return void navigate({ to: "/" });
    if (role !== "admin") return void navigate({ to: "/app" });
    void reload();
  }, [loading, userId, role, navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: draft.name ?? "",
      address: draft.address ?? "",
      city: draft.city ?? "",
      description: draft.description ?? null,
      lat: draft.lat ?? null,
      lng: draft.lng ?? null,
      is_active: draft.is_active ?? true,
    };
    const res = editingId
      ? await supabase.from("hubs").update(payload).eq("id", editingId).select("id")
      : await supabase.from("hubs").insert(payload).select("id");
    if (res.error) { toast.error("Échec: " + res.error.message); return; }
    if (!res.data || res.data.length === 0) {
      toast.error("Aucune ligne affectée (droits admin manquants ?)");
      return;
    }
    toast.success(editingId ? "Hub mis à jour" : "Hub créé");
    setDraft(empty);
    setEditingId(null);
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce hub ?")) return;
    const { error } = await supabase.from("hubs").delete().eq("id", id);
    if (error) { toast.error("Échec suppression: " + error.message); return; }
    toast.success("Hub supprimé");
    await reload();
  }

  function edit(h: Hub) {
    setDraft(h);
    setEditingId(h.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading || busy) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-citrus" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <h1 className="font-display text-3xl font-black">Hubs de retrait</h1>
      <p className="mt-1 text-sm text-muted-foreground">Créez et configurez les points où les clients récupèrent leurs commandes.</p>

      <form onSubmit={save} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <h2 className="sm:col-span-2 flex items-center gap-2 font-display font-bold">
          <Plus className="size-4" /> {editingId ? "Modifier le hub" : "Nouveau hub"}
        </h2>
        <Field label="Nom *">
          <input required className="form-input" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Ville *">
          <input required className="form-input" value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
        </Field>
        <Field label="Adresse *">
          <input required className="form-input" value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
        </Field>
        <Field label="Description">
          <input className="form-input" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <Field label="Latitude">
          <input type="number" step="any" className="form-input" value={draft.lat ?? ""} onChange={(e) => setDraft({ ...draft, lat: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>
        <Field label="Longitude">
          <input type="number" step="any" className="form-input" value={draft.lng ?? ""} onChange={(e) => setDraft({ ...draft, lng: e.target.value === "" ? null : Number(e.target.value) })} />
        </Field>
        <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.is_active ?? true} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
          Hub actif (visible aux clients)
        </label>
        <div className="sm:col-span-2 flex gap-2">
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-citrus px-5 py-3 font-bold text-white">
            <Save className="size-4" /> {editingId ? "Enregistrer" : "Créer"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setDraft(empty); setEditingId(null); }} className="rounded-xl border border-border bg-card px-5 py-3 font-bold">
              Annuler
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-8 font-display text-xl font-bold">{hubs.length} hub(s)</h2>
      {hubs.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun hub pour l'instant.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {hubs.map((h, i) => (
            <div key={h.id} className={"flex items-center gap-4 p-4 " + (i > 0 ? "border-t border-border" : "")}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-citrus/15 text-amalfi">
                <Building2 className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold truncate">{h.name}</h3>
                  {!h.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Inactif</span>}
                </div>
                <p className="text-xs text-muted-foreground">{h.address} · {h.city}</p>
              </div>
              <button onClick={() => edit(h)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">Modifier</button>
              <button onClick={() => remove(h.id)} className="rounded-lg border border-red-200 bg-white p-2 text-red-700 hover:bg-red-50" aria-label="Supprimer">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .form-input { width: 100%; border-radius: 0.75rem; border: 1px solid var(--color-border); background: var(--color-card); padding: 0.6rem 0.9rem; font-size: 0.9rem; }
        .form-input:focus { outline: none; border-color: var(--color-citrus); }
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
