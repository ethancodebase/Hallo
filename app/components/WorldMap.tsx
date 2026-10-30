"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";
import { wispColor, wispName } from "@/lib/wisps";
import WanderersLedger, { ME_ID } from "./WanderersLedger";
import { ME_SIGIL_SVG } from "./sigil";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// Recolors the vector-only outdoors style to read like Earth from orbit.
// Satellite imagery is avoided because it needs raster tiles, which some
// Mapbox tokens (e.g. accounts without billing) aren't allowed to load.
function paintEarth(map: MapboxMap) {
  type SetPaint = Parameters<MapboxMap["setPaintProperty"]>;
  const set = (layer: string, prop: SetPaint[1], value: SetPaint[2]) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };

  set("land", "background-color", "hsl(36, 16%, 58%)");
  set("landcover", "fill-color", [
    "match",
    ["get", "class"],
    "wood", "hsl(105, 18%, 36%)",
    "scrub", "hsl(80, 14%, 46%)",
    "crop", "hsl(66, 14%, 52%)",
    "grass", "hsl(84, 15%, 48%)",
    "snow", "hsl(210, 18%, 90%)",
    "hsl(95, 14%, 42%)",
  ]);
  set("landcover", "fill-opacity", [
    "interpolate", ["linear"], ["zoom"],
    0, 0.8,
    8, 0.7,
    12, 0,
  ]);
  set("water", "fill-color", "hsl(216, 34%, 27%)");
  set("water-depth", "fill-color", [
    "interpolate", ["linear"], ["get", "min_depth"],
    0, "hsla(198, 32%, 44%, 0.5)",
    200, "hsla(206, 32%, 35%, 0.45)",
    3000, "hsla(215, 34%, 26%, 0.45)",
    7000, "hsla(224, 38%, 18%, 0.5)",
  ]);
  set("hillshade", "fill-color", [
    "match",
    ["get", "class"],
    "shadow", "hsla(30, 25%, 12%, 0.1)",
    "hsla(45, 20%, 95%, 0.07)",
  ]);
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function seek(id: string, lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    setActiveId(id);
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), id === ME_ID ? 12 : 11),
      speed: 1.2,
      curve: 1.6,
      essential: true,
    });

    // Briefly flare the marker we flew to so the eye can find it.
    document
      .querySelectorAll(".is-sought")
      .forEach((n) => n.classList.remove("is-sought"));
    const el =
      id === ME_ID
        ? meMarkerRef.current?.getElement()
        : markersRef.current.get(id)?.getElement();
    if (!el) return;
    el.classList.add("is-sought");
    if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
    seekTimerRef.current = setTimeout(() => {
      el.classList.remove("is-sought");
    }, 4500);
  }

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/outdoors-v12",
        projection: "globe",
        // Open centered on the user if we know where they are, else world view.
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 4 : 1.4,
        attributionControl: true,
      });
      // Paint and fog must be (re)applied after each style load.
      map.on("style.load", () => {
        paintEarth(map);
        map.setFog({
          color: "rgb(160, 188, 228)",
          "high-color": "rgb(62, 92, 170)",
          "horizon-blend": 0.06,
          "space-color": "rgb(5, 10, 30)",
          "star-intensity": 0.7,
        });
      });
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own "you are here" pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title =
          "Your true place — seen only by you. Others see your light veiled in mist, 1–3 km away.";
        el.innerHTML = `<span class="pulse-me-beacon"></span><span class="pulse-me-veil"></span>${ME_SIGIL_SVG}<span class="pulse-me-label">Me</span>`;
        // The sigil's center sits on the exact coordinate.
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.setProperty("--wisp", wispColor(peer.id));
          // Desync the drift so nearby wisps don't move in lockstep.
          el.innerHTML = `<span class="pulse-wisp" style="animation-delay:-${(Math.random() * 7).toFixed(2)}s"></span>`;
          const name = wispName(peer.id);
          el.title = `${name} — veiled in mist, somewhere within 1–3 km of here. Tap to connect.`;
          el.setAttribute("aria-label", `${name}, approximate location. Connect.`);
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        } else {
          marker.setLngLat([peer.lng, peer.lat]);
        }
        marker.getElement().style.opacity = peer.busy ? "0.35" : "1";
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-[#050a1e]" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-lg bg-zinc-800 p-4 text-sm text-zinc-200">
            Set{" "}
            <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-16 left-4 top-4 z-10 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3">
        <VeilLegend />
        <WanderersLedger
          peers={peers}
          me={me}
          token={TOKEN}
          activeId={activeId}
          onSeek={seek}
        />
      </div>

      {/* Online count */}
      <div className="absolute bottom-4 left-4 rounded-full border border-violet-300/20 bg-[#140c28]/80 px-3 py-1.5 font-fantasy text-xs tracking-wide text-violet-100 backdrop-blur">
        ✦ {peers.length} {peers.length === 1 ? "light" : "lights"} wandering
      </div>
    </div>
  );
}

function VeilLegend() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto shrink-0 self-start rounded-full border border-amber-200/30 bg-[#140c28]/80 px-3 py-1.5 font-fantasy text-xs tracking-wide text-amber-100 shadow-[0_0_20px_rgba(196,161,255,0.25)] backdrop-blur transition hover:border-amber-200/60"
      >
        ✦ The Veil of Mists
      </button>
    );
  }

  return (
    <aside className="pointer-events-auto shrink-0 rounded-2xl border border-amber-200/25 bg-gradient-to-b from-[#1c1238]/90 to-[#0b0820]/90 p-4 text-violet-100 shadow-[0_0_40px_rgba(196,161,255,0.25)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-fantasy text-sm font-bold tracking-[0.12em] text-amber-100">
          ✦ The Veil of Mists
        </h2>
        <button
          onClick={() => setOpen(false)}
          aria-label="Fold the legend"
          className="-mr-1 -mt-1 rounded-full px-2 text-violet-300 transition hover:text-amber-100"
        >
          ×
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-violet-200/90">
        Every light is a wandering soul cloaked in mist — its true hearth lies
        somewhere within{" "}
        <span className="font-semibold text-amber-100">1–3 km</span>, never the
        exact spot.
      </p>
      <ul className="mt-3 space-y-2 text-xs text-violet-200/90">
        <li className="flex items-center gap-3">
          <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-cyan-200/60 bg-cyan-300/15">
            <span className="h-2 w-2 rounded-full bg-cyan-100 shadow-[0_0_8px_2px_#8be9ff]" />
          </span>
          A stranger&apos;s veiled light — tap to reach out
        </li>
        <li className="flex items-center gap-3">
          <span
            className="ledger-sigil h-6 w-6 shrink-0"
            dangerouslySetInnerHTML={{ __html: ME_SIGIL_SVG }}
          />
          Your true place — seen by your eyes alone
        </li>
      </ul>
    </aside>
  );
}
