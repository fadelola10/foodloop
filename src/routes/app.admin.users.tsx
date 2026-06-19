import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Shield, Store, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";

export const Route = createFileRoute("/app/admin/users")({
  head: () => ({ meta: [{ title: "FoodLoop — Admin · Utilisateurs" }] }),
  component: AdminUsers,
});

type Row = {
  id: string;
  full_name: string | null;
  roles: ("consumer" | "producer" | "admin")[];
};

function AdminUsers() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState("");

  async function reload() {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").order("full_name");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const byUser = new Map<string, ("consumer" | "producer" | "admin")[]>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as "consumer" | "producer" | "admin");
      byUser.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => ({
        id: p.id,
        full_name: p.full_name,
        roles: byUser.get(p.id) ?? [],
      })),
    );
    setBusy(false);
  }

  useEffect(() => {
    if (loading) return;
    if (!userId) return void navigate({ to: "/" });
    if (role !== "admin") return void navigate({ to: "/app" });
    void reload();
  }, [loading, userId, role, navigate]);

  async function toggleRole(target: Row, r: "consumer" | "producer" | "admin") {
    const has = target.roles.includes(r);
    if (has) {
      if (r === "admin" && target.id === userId) {
        toast.error("Vous ne pouvez pas retirer votre propre rôle admin.");
        return;
      }
      const { error } = await supabase.from("user_roles").delete().eq("user_id", target.id).eq("role", r);
      if (error) { toast.error("Échec retrait rôle: " + error.message); return; }
      toast.success(`Rôle ${r} retiré`);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: target.id, role: r });
      if (error) { toast.error("Échec ajout rôle: " + error.message); return; }
      toast.success(`Rôle ${r} ajouté`);
    }
    await reload();
  }

  if (loading || busy) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-citrus" /></div>
      </AppShell>
    );
  }

  const filtered = rows.filter((r) =>
    !query.trim() ? true : (r.full_name ?? "").toLowerCase().includes(query.toLowerCase()) || r.id.includes(query),
  );

  return (
    <AppShell role={role}>
      <h1 className="font-display text-3xl font-black">Utilisateurs</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gérez les rôles attribués à chaque utilisateur.</p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par nom ou ID…"
        className="mt-4 w-full max-w-md rounded-xl border border-border bg-card px-4 py-2 text-sm"
      />

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucun utilisateur.</div>
        ) : (
          filtered.map((r, i) => (
            <div key={r.id} className={"flex flex-wrap items-center gap-4 p-4 " + (i > 0 ? "border-t border-border" : "")}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <UserIcon className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{r.full_name || <span className="text-muted-foreground">(sans nom)</span>}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{r.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["consumer", "producer", "admin"] as const).map((rr) => {
                  const active = r.roles.includes(rr);
                  return (
                    <button
                      key={rr}
                      onClick={() => toggleRole(r, rr)}
                      className={
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                        (active
                          ? rr === "admin" ? "bg-amalfi text-white" : rr === "producer" ? "bg-citrus text-white" : "bg-emerald-600 text-white"
                          : "border border-border bg-card text-muted-foreground hover:bg-muted")
                      }
                    >
                      {rr === "admin" ? <Shield className="size-3" /> : rr === "producer" ? <Store className="size-3" /> : <UserIcon className="size-3" />}
                      {rr}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
