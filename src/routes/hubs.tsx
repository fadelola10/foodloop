import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, LocateFixed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentUser } from "@/components/AppShell";
import type { Hub } from "@/lib/types";

export const Route = createFileRoute("/hubs")({
  head: () => ({ meta: [{ title: "FoodLoop — Hubs à proximité" }] }),
  component: HubsPage,
});

type HubWithDistance = Hub & { distanceKm?: number };

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

let mapsLoading: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject();
  if ((window as any).google?.maps) return Promise.resolve();
  if (mapsLoading) return mapsLoading;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  mapsLoading = new Promise((resolve, reject) => {
    (window as any).__initFoodloopMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initFoodloopMap${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return mapsLoading;
}

function HubsPage() {
  const { role } = useCurrentUser();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("hubs")
        .select("*")
        .eq("is_active", true)
        .order("city");
      setHubs((data as Hub[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setGeoError("Géolocalisation non supportée par votre navigateur.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || "Impossible de récupérer votre position.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (loading || !mapRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const google = (window as any).google;
        const center = userPos ?? { lat: 46.6, lng: 2.5 }; // France centroid
        mapInstance.current = new google.maps.Map(mapRef.current, {
          center,
          zoom: userPos ? 10 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading]);

  const hubsWithDist: HubWithDistance[] = userPos
    ? hubs
        .filter((h) => h.lat != null && h.lng != null)
        .map((h) => ({ ...h, distanceKm: haversine(userPos.lat, userPos.lng, h.lat!, h.lng!) }))
        .filter((h) => h.distanceKm! <= radiusKm)
        .sort((a, b) => a.distanceKm! - b.distanceKm!)
    : hubs;

  useEffect(() => {
    const google = (window as any).google;
    if (!mapInstance.current || !google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;
    hubsWithDist.forEach((h) => {
      if (h.lat == null || h.lng == null) return;
      const m = new google.maps.Marker({
        position: { lat: h.lat, lng: h.lng },
        map: mapInstance.current,
        title: h.name,
      });
      const info = new google.maps.InfoWindow({
        content: `<div style="font-family:system-ui;font-size:13px"><strong>${h.name}</strong><br/>${h.address}${h.distanceKm != null ? `<br/><em>${h.distanceKm.toFixed(1)} km</em>` : ""}</div>`,
      });
      m.addListener("click", () => info.open({ anchor: m, map: mapInstance.current }));
      markersRef.current.push(m);
      bounds.extend({ lat: h.lat, lng: h.lng });
      hasPoint = true;
    });
    if (userPos) {
      const me = new google.maps.Marker({
        position: userPos,
        map: mapInstance.current,
        title: "Ma position",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(me);
      bounds.extend(userPos);
      hasPoint = true;
      new google.maps.Circle({
        map: mapInstance.current,
        center: userPos,
        radius: radiusKm * 1000,
        fillColor: "#22c55e",
        fillOpacity: 0.08,
        strokeColor: "#22c55e",
        strokeOpacity: 0.4,
        strokeWeight: 1,
      }).bindTo("map", mapInstance.current);
    }
    if (hasPoint) mapInstance.current.fitBounds(bounds, 60);
  }, [hubsWithDist, userPos, radiusKm]);

  return (
    <AppShell role={role}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black">Hubs à proximité</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trouvez le hub de retrait le plus proche dans un rayon de {radiusKm} km.
          </p>
        </div>
        <button
          onClick={locate}
          disabled={geoLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-amalfi px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
        >
          {geoLoading ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
          Me géolocaliser
        </button>
      </div>

      {userPos && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <label className="text-sm font-semibold">Rayon : {radiusKm} km</label>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="flex-1 accent-amalfi"
          />
        </div>
      )}

      {geoError && (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {geoError}
        </div>
      )}

      <div
        ref={mapRef}
        className="mt-4 h-[360px] w-full overflow-hidden rounded-2xl border border-border bg-muted"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-citrus" />
        </div>
      ) : hubsWithDist.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {userPos
            ? `Aucun hub dans un rayon de ${radiusKm} km. Élargissez la recherche.`
            : "Aucun hub disponible pour le moment."}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {hubsWithDist.map((h) => (
            <div
              key={h.id}
              className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-citrus/15 text-amalfi">
                  <MapPin className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-bold">{h.name}</h3>
                    {h.distanceKm != null && (
                      <span className="rounded-full bg-citrus/15 px-2 py-0.5 text-xs font-bold text-amalfi">
                        {h.distanceKm.toFixed(1)} km
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-citrus">
                    {h.city}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{h.address}</p>
                  {h.description && (
                    <p className="mt-2 text-xs text-muted-foreground">{h.description}</p>
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
