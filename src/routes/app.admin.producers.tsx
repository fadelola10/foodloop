import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";

export const Route = createFileRoute("/app/admin/producers")({
  head: () => ({ meta: [{ title: "FoodLoop — Admin · Producteurs" }] }),
  component: AdminProducers,
});

type Row = {
  id: string;
  user_id: string;
  farm_name: string;
  city: string | null;
  description: string | null;
  kyc_status: "pending" | "validated" | "rejected";
  kyc_submitted_at: string | null;
  kyc_rejection_reason: string | null;
  is_active: boolean;
  created_at: string;
};

function AdminProducers() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<"pending" | "validated" | "rejected" | "all">("pending");

  async function reload() {
    let q = supabase.from("producers").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("kyc_status", filter);
    const { data } = await q;
    setRows((data ?? []) as Row[]);
    setBusy(false);
  }

  useEffect(() => {
    if (loading) return;
    if (!userId) return void navigate({ to: "/" });
    if (role !== "admin") return void navigate({ to: "/app" });
    setBusy(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, role, filter]);

  async function validate(p: Row) {
    const { data, error } = await supabase
      .from("producers")
      .update({
        kyc_status: "validated",
        kyc_reviewed_at: new Date().toISOString(),
        kyc_reviewed_by: userId,
        kyc_rejection_reason: null,
        is_active: true,
      })
      .eq("id", p.id)
      .select("id");
    if (error) { toast.error("Échec validation: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Aucune ligne mise à jour (droits admin manquants ?)");
      return;
    }
    toast.success(`${p.farm_name} validé`);
    await reload();
  }

  async function reject(p: Row) {
    const reason = prompt("Motif du refus :", p.kyc_rejection_reason ?? "");
    if (reason === null) return;
    const { data, error } = await supabase
      .from("producers")
      .update({
        kyc_status: "rejected",
        kyc_reviewed_at: new Date().toISOString(),
        kyc_reviewed_by: userId,
        kyc_rejection_reason: reason,
        is_active: false,
      })
      .eq("id", p.id)
      .select("id");
    if (error) { toast.error("Échec refus: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Aucune ligne mise à jour (droits admin manquants ?)");
      return;
    }
    toast.success(`${p.farm_name} refusé`);
    await reload();
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
      <h1 className="font-display text-3xl font-black">Validation KYC producteurs</h1>
      <p className="mt-1 text-sm text-muted-foreground">Examinez les fiches et validez ou refusez chaque producteur.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["pending", "validated", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors " +
              (filter === f ? "bg-amalfi text-white" : "border border-border bg-card text-muted-foreground hover:bg-muted")
            }
          >
            {f === "pending" ? "En attente" : f === "validated" ? "Validés" : f === "rejected" ? "Refusés" : "Tous"}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun producteur dans cette catégorie.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{p.farm_name}</h3>
                    <StatusBadge status={p.kyc_status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.city ?? "—"} · Inscrit le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </p>
                  {p.description && <p className="mt-2 text-sm">{p.description}</p>}
                  {p.kyc_rejection_reason && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      Motif de refus : {p.kyc_rejection_reason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {p.kyc_status !== "validated" && (
                    <button
                      onClick={() => validate(p)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="size-4" /> Valider
                    </button>
                  )}
                  {p.kyc_status !== "rejected" && (
                    <button
                      onClick={() => reject(p)}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                    >
                      <XCircle className="size-4" /> Refuser
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function StatusBadge({ status }: { status: "pending" | "validated" | "rejected" }) {
  const cfg = {
    pending: { c: "bg-amber-100 text-amber-800", i: <Clock className="size-3" />, t: "En attente" },
    validated: { c: "bg-emerald-100 text-emerald-800", i: <CheckCircle2 className="size-3" />, t: "Validé" },
    rejected: { c: "bg-red-100 text-red-800", i: <XCircle className="size-3" />, t: "Refusé" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cfg.c}`}>
      {cfg.i}{cfg.t}
    </span>
  );
}
