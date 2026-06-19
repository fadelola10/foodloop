import { Star } from "lucide-react";

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            className={readOnly ? "cursor-default" : "cursor-pointer transition hover:scale-110"}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? "fill-citrus text-citrus" : "text-muted-foreground/40"}
            />
          </button>
        );
      })}
    </div>
  );
}

export function StarSummary({ avg, count }: { avg: number; count: number }) {
  if (!count) {
    return <span className="text-xs text-muted-foreground">Aucun avis</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <StarRating value={avg} readOnly size={14} />
      <span className="font-semibold">{avg.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </span>
  );
}
