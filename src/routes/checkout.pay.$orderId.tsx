import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { formatPrice } from "@/lib/types";

export const Route = createFileRoute("/checkout/pay/$orderId")({
  head: () => ({ meta: [{ title: "FoodLoop — Paiement" }] }),
  component: PayDemo,
});

function PayDemo() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const [order, setOrder] = useState<{ id: string; total_cents: number; status: string } | null>(null);
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total_cents, status")
        .eq("id", orderId)
        .maybeSingle();
      if (!data) {
        navigate({ to: "/catalogue" });
        return;
      }
      setOrder(data as any);
      if (data.status === "paid" || data.status !== "pending") setDone(true);
    })();
  }, [loading, userId, orderId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order || processing) return;
    setProcessing(true);
    setErrorMsg(null);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const { data, error } = await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", order.id)
        .select("id, status")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Commande introuvable ou mise à jour refusée (RLS).");
      setDone(true);
    } catch (err: any) {
      console.error("[pay] update failed:", err);
      setErrorMsg(err?.message ?? "Erreur inconnue lors du paiement.");
    } finally {
      setProcessing(false);
    }
  }

  if (loading || !order) {
    return (
      <AppShell role={role}>
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-citrus" />
        </div>
      </AppShell>
    );
  }

  if (done) {
    return (
      <AppShell role={role}>
        <div className="mx-auto max-w-md py-12 text-center">
          <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
          <h1 className="mt-4 font-display text-3xl font-black">Paiement réussi !</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre commande a été créée. Vous serez notifié quand elle sera prête à retirer.
          </p>
          <Link
            to="/app/orders/$orderId"
            params={{ orderId: order.id }}
            className="mt-6 inline-block rounded-xl bg-amalfi px-6 py-3 font-bold text-white"
          >
            Voir ma commande
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <div className="mx-auto max-w-md py-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Lock className="size-3.5" /> PAIEMENT SÉCURISÉ
            </div>
            <span className="rounded-md bg-[#635bff] px-2 py-1 text-xs font-bold text-white">
              stripe
            </span>
          </div>

          <h1 className="mt-4 font-display text-2xl font-black">
            {formatPrice(order.total_cents)}
          </h1>
          <p className="text-xs text-muted-foreground">Commande #{order.id.slice(0, 8)}</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Nom sur la carte
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jean Dupont"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Numéro de carte
              </label>
              <input
                value={card}
                onChange={(e) => setCard(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm tracking-wider"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Expiration
                </label>
                <input
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">CVC</label>
                <input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#635bff] py-3.5 font-bold text-white disabled:opacity-60"
            >
              {processing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Traitement…
                </>
              ) : (
                <>Payer {formatPrice(order.total_cents)}</>
              )}
            </button>
            {errorMsg && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMsg}
              </p>
            )}
          </form>

          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Démonstration — aucun débit réel. Carte test pré-remplie.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
