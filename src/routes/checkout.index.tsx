import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, CreditCard, Truck, Store, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import { getCartItems } from "@/lib/cart";
import { formatPrice, type Hub } from "@/lib/types";
import { getStuartQuote } from "@/lib/stuart.functions";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const Route = createFileRoute("/checkout/")({
  head: () => ({ meta: [{ title: "FoodLoop — Commande" }] }),
  component: Checkout,
});

function Checkout() {
  const navigate = useNavigate();
  const { loading, userId, role } = useCurrentUser();
  const quoteFn = useServerFn(getStuartQuote);
  const [items, setItems] = useState<Awaited<ReturnType<typeof getCartItems>>>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubId, setHubId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(true);
  const [paying, setPaying] = useState(false);

  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "stuart">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [quoteCents, setQuoteCents] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function locateMe() {
    if (!navigator.geolocation) {
      setGeoError("Géolocalisation non supportée par ce navigateur.");
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        const withCoords = hubs.filter((h) => h.lat != null && h.lng != null);
        if (withCoords.length > 0) {
          const nearest = withCoords
            .map((h) => ({ h, d: haversineKm(p, { lat: h.lat as number, lng: h.lng as number }) }))
            .sort((a, b) => a.d - b.d)[0];
          setHubId(nearest.h.id);
        }
        setGeoBusy(false);
      },
      (err) => {
        setGeoError(err.message || "Impossible d'obtenir votre position.");
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const sortedHubs = useMemo(() => {
    if (!userPos) return hubs;
    return [...hubs].sort((a, b) => {
      const da =
        a.lat != null && a.lng != null
          ? haversineKm(userPos, { lat: a.lat, lng: a.lng })
          : Infinity;
      const db =
        b.lat != null && b.lng != null
          ? haversineKm(userPos, { lat: b.lat, lng: b.lng })
          : Infinity;
      return da - db;
    });
  }, [hubs, userPos]);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      const [cart, hubsRes] = await Promise.all([
        getCartItems(userId),
        supabase.from("hubs").select("*").eq("is_active", true).order("name"),
      ]);
      setItems(cart);
      const h = (hubsRes.data as Hub[]) ?? [];
      setHubs(h);
      if (h[0]) setHubId(h[0].id);
      setBusy(false);
    })();
  }, [loading, navigate, userId]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.products.price_cents, 0);
  const deliveryFee = deliveryMode === "stuart" ? (quoteCents ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const hub = hubs.find((h) => h.id === hubId);

  async function fetchQuote() {
    if (!hub || !deliveryAddress.trim()) return;
    setQuoting(true);
    setQuoteError(null);
    setQuoteCents(null);
    try {
      const res = await quoteFn({
        data: {
          pickupAddress: `${hub.address}, ${hub.city}`,
          dropoffAddress: deliveryAddress.trim(),
        },
      });
      if (res.ok) setQuoteCents(res.amountCents);
      else setQuoteError(res.error);
    } catch (e) {
      setQuoteError((e as Error).message);
    } finally {
      setQuoting(false);
    }
  }

  async function pay() {
    if (!userId || items.length === 0 || !hubId) return;
    if (deliveryMode === "stuart" && (!deliveryAddress.trim() || quoteCents == null)) {
      alert("Renseigne ton adresse et obtiens un devis Stuart avant de payer.");
      return;
    }
    setPaying(true);
    try {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          hub_id: hubId,
          total_cents: total,
          notes: notes || null,
          status: "pending",
          delivery_mode: deliveryMode,
          delivery_address: deliveryMode === "stuart" ? deliveryAddress.trim() : null,
          delivery_fee_cents: deliveryFee,
        })
        .select("id")
        .single();
      if (oErr) throw new Error("orders.insert: " + oErr.message);

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.products.id,
        product_name: i.products.name,
        unit_price_cents: i.products.price_cents,
        quantity: i.quantity,
        producer_id: i.products.producer_id,
      }));
      const { error: iErr } = await supabase.from("order_items").insert(orderItems);
      if (iErr) throw new Error("order_items.insert: " + iErr.message);

      const ids = items.map((i) => i.id);
      await supabase.from("cart_items").delete().in("id", ids);

      navigate({ to: "/checkout/pay/$orderId", params: { orderId: order.id } });
    } catch (e) {
      console.error("[checkout] pay() error:", e);
      alert("Erreur : " + (e as Error).message);
      setPaying(false);
    }
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

  if (items.length === 0) {
    return (
      <AppShell role={role}>
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">Votre panier est vide.</p>
          <Link
            to="/catalogue"
            className="mt-4 inline-block rounded-xl bg-citrus px-5 py-2.5 text-sm font-bold text-white"
          >
            Voir le catalogue
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role}>
      <h1 className="font-display text-3xl font-black">Commande</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Hub de retrait</h2>
              <button
                type="button"
                onClick={locateMe}
                disabled={geoBusy}
                className="flex items-center gap-1.5 rounded-lg border border-citrus bg-card px-3 py-1.5 text-xs font-semibold text-citrus disabled:opacity-60"
              >
                {geoBusy ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
                Me localiser
              </button>
            </div>
            {geoError && <p className="mt-1 text-xs text-red-600">{geoError}</p>}
            {userPos && (
              <p className="mt-1 text-xs text-muted-foreground">
                Position détectée — hubs triés par proximité.
              </p>
            )}
            {hubs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Aucun hub disponible.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {sortedHubs.map((h) => {
                  const dist =
                    userPos && h.lat != null && h.lng != null
                      ? haversineKm(userPos, { lat: h.lat, lng: h.lng })
                      : null;
                  return (
                    <label
                      key={h.id}
                      className={
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 " +
                        (hubId === h.id
                          ? "border-citrus bg-citrus/10"
                          : "border-border bg-card hover:bg-muted")
                      }
                    >
                      <input
                        type="radio"
                        checked={hubId === h.id}
                        onChange={() => setHubId(h.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold">{h.name}</p>
                          {dist != null && (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {h.address} · {h.city}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display text-lg font-bold">Mode de livraison</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("pickup")}
                className={
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold " +
                  (deliveryMode === "pickup"
                    ? "border-citrus bg-citrus/10"
                    : "border-border bg-card hover:bg-muted")
                }
              >
                <Store className="size-4" /> Retrait au hub
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("stuart")}
                className={
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold " +
                  (deliveryMode === "stuart"
                    ? "border-citrus bg-citrus/10"
                    : "border-border bg-card hover:bg-muted")
                }
              >
                <Truck className="size-4" /> Livraison Stuart
              </button>
            </div>

            {deliveryMode === "stuart" && (
              <div className="mt-3 space-y-2">
                <input
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    setQuoteCents(null);
                  }}
                  placeholder="Adresse de livraison complète"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={fetchQuote}
                  disabled={quoting || !deliveryAddress.trim() || !hub}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-citrus bg-card py-2 text-sm font-semibold text-citrus disabled:opacity-60"
                >
                  {quoting && <Loader2 className="size-4 animate-spin" />}
                  Obtenir un devis Stuart
                </button>
                {quoteCents != null && (
                  <p className="text-sm text-emerald-600">
                    Frais de livraison estimés : {formatPrice(quoteCents)}
                  </p>
                )}
                {quoteError && (
                  <p className="text-xs text-red-600">{quoteError}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="font-display text-lg font-bold">Notes (optionnel)</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Préférences, allergies…"
              className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </section>

        <section>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg font-bold">Récapitulatif</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span className="truncate">
                    {i.quantity} × {i.products.name}
                  </span>
                  <span className="font-semibold">
                    {formatPrice(i.quantity * i.products.price_cents)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
              <span>Sous-total</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            {deliveryMode === "stuart" && (
              <div className="mt-1 flex justify-between text-sm">
                <span>Livraison Stuart</span>
                <span className="font-semibold">
                  {quoteCents != null ? formatPrice(quoteCents) : "—"}
                </span>
              </div>
            )}
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-bold">Total</span>
              <span className="font-display text-2xl font-black text-amalfi">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          <button
            onClick={pay}
            disabled={paying || !hubId || (deliveryMode === "stuart" && quoteCents == null)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-citrus py-3.5 font-bold text-white disabled:opacity-60"
          >
            {paying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            Payer (démo) — {formatPrice(total)}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Paiement fictif pour démonstration. Aucun débit réel.
          </p>
        </section>
      </div>
    </AppShell>
  );
}