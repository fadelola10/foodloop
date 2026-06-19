import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StarRating, StarSummary } from "./StarRating";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  order_id: string | null;
};

export function ProducerReviews({
  producerId,
  userId,
  orderId,
  canReview = false,
  compact = false,
}: {
  producerId: string;
  userId?: string | null;
  orderId?: string;
  canReview?: boolean;
  compact?: boolean;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("producer_reviews")
      .select("id,user_id,rating,comment,created_at,order_id")
      .eq("producer_id", producerId)
      .order("created_at", { ascending: false });
    setReviews((data ?? []) as Review[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [producerId]);

  const existing = userId
    ? reviews.find((r) => r.user_id === userId && (orderId ? r.order_id === orderId : !r.order_id))
    : null;

  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment ?? "");
    }
  }, [existing?.id]);

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  async function submit() {
    if (!userId || !rating) return;
    setSaving(true);
    const payload = {
      producer_id: producerId,
      user_id: userId,
      order_id: orderId ?? null,
      rating,
      comment: comment.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("producer_reviews").update(payload).eq("id", existing.id)
      : await supabase.from("producer_reviews").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success(existing ? "Avis mis à jour" : "Merci pour votre avis !");
    load();
  }

  if (compact) {
    return loading ? null : <StarSummary avg={avg} count={count} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">Avis clients</h3>
        {!loading && <StarSummary avg={avg} count={count} />}
      </div>

      {canReview && userId && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            {existing ? "Modifier votre avis" : "Notez ce producteur"}
          </p>
          <div className="mt-2">
            <StarRating value={rating} onChange={setRating} size={28} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Votre commentaire (optionnel)"
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={submit}
            disabled={!rating || saving}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-citrus px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {existing ? "Mettre à jour" : "Publier l'avis"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-citrus" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun avis pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {reviews.slice(0, 10).map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <StarRating value={r.rating} readOnly size={14} />
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
