"use client";

import { useEffect, useMemo, useState } from "react";
import type { PeerDot } from "@/lib/types";
import { wispColor, wispName } from "@/lib/wisps";
import { distanceKm, formatCoords, lookupPlace, placeKey } from "@/lib/places";
import { ME_SIGIL_SVG } from "./sigil";

export const ME_ID = "me";

type LatLng = { lat: number; lng: number };

type Wanderer = LatLng & {
  id: string;
  name: string;
  isMe: boolean;
  busy: boolean;
};

function formatDistance(km: number): string {
  if (km < 10) return "a short walk through the mist";
  if (km < 1000) return `${Math.round(km)} km away`;
  return `${(km / 1000).toFixed(1)}k km away`;
}

function WandererIcon({ w, size }: { w: Wanderer; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  if (w.isMe) {
    return (
      <span
        className={`ledger-sigil shrink-0 ${box}`}
        dangerouslySetInnerHTML={{ __html: ME_SIGIL_SVG }}
      />
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center ${box}`}>
      <span
        className={`ledger-wisp ${size === "lg" ? "scale-150" : ""}`}
        style={{ "--wisp": wispColor(w.id) } as React.CSSProperties}
      />
    </span>
  );
}

export default function WanderersLedger({
  peers,
  me,
  token,
  activeId,
  onSeek,
}: {
  peers: PeerDot[];
  me: LatLng | null;
  token: string;
  activeId: string | null;
  onSeek: (id: string, lat: number, lng: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Missing key = still divining, null = no named place (open sea, etc.)
  const [places, setPlaces] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!token) return;
    const points = me ? [me, ...peers] : peers;
    let active = true;
    for (const p of points) {
      const key = placeKey(p.lat, p.lng);
      void lookupPlace(p.lat, p.lng, token).then((name) => {
        if (active) setPlaces((prev) => (key in prev ? prev : { ...prev, [key]: name }));
      });
    }
    return () => {
      active = false;
    };
  }, [peers, me, token]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const wanderers = useMemo<Wanderer[]>(() => {
    const others = peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      name: wispName(p.id),
      isMe: false,
      busy: p.busy,
    }));
    if (me) others.sort((a, b) => distanceKm(me, a) - distanceKm(me, b));
    return me
      ? [{ id: ME_ID, ...me, name: "You", isMe: true, busy: false }, ...others]
      : others;
  }, [peers, me]);

  // Derived from live data, so the window tracks the wanderer as they move
  // and quietly closes if they leave.
  const selected = wanderers.find((w) => w.id === selectedId) ?? null;

  function placeLabel(p: LatLng): string {
    const key = placeKey(p.lat, p.lng);
    if (!(key in places)) return "Divining the place…";
    return places[key] ?? "Uncharted wilds";
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto self-start rounded-full border border-amber-200/30 bg-[#140c28]/80 px-3 py-1.5 font-fantasy text-xs tracking-wide text-amber-100 shadow-[0_0_20px_rgba(196,161,255,0.25)] backdrop-blur transition hover:border-amber-200/60"
      >
        ✦ Wanderers&apos; Ledger · {wanderers.length}
      </button>
    );
  }

  return (
    <>
      <section className="pointer-events-auto flex min-h-0 flex-col rounded-2xl border border-amber-200/25 bg-gradient-to-b from-[#1c1238]/90 to-[#0b0820]/90 text-violet-100 shadow-[0_0_40px_rgba(196,161,255,0.2)] backdrop-blur-md">
        <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <h2 className="font-fantasy text-sm font-bold tracking-[0.12em] text-amber-100">
            ✦ Wanderers&apos; Ledger
          </h2>
          <button
            onClick={() => {
              setOpen(false);
              setSelectedId(null);
            }}
            aria-label="Fold the ledger"
            className="-mr-1 rounded-full px-2 text-violet-300 transition hover:text-amber-100"
          >
            ×
          </button>
        </header>

        <ul className="ledger-scroll min-h-0 space-y-1.5 overflow-y-auto px-2 pb-2">
          {wanderers.map((w) => {
            const isSelected = selectedId === w.id;
            const isActive = isSelected || activeId === w.id;
            const accent = w.isMe
              ? "border-amber-200/30 hover:border-amber-200/60 hover:bg-amber-200/10"
              : "border-violet-300/20 hover:border-violet-300/50 hover:bg-violet-300/10";
            const activeRing = w.isMe
              ? "border-amber-200/70 bg-amber-200/10 shadow-[0_0_16px_rgba(253,227,167,0.25)]"
              : "border-violet-200/60 bg-violet-300/10 shadow-[0_0_16px_rgba(196,161,255,0.25)]";
            return (
              <li key={w.id}>
                <button
                  onClick={() => setSelectedId(isSelected ? null : w.id)}
                  aria-pressed={isSelected}
                  aria-label={`Show where ${w.name} is`}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-white/[0.02] px-2.5 py-2 text-left transition ${
                    isActive ? activeRing : accent
                  } ${w.busy ? "opacity-60" : ""}`}
                >
                  <WandererIcon w={w} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-fantasy text-[13px] font-semibold tracking-wide ${
                        w.isMe ? "text-amber-100" : "text-violet-50"
                      }`}
                    >
                      {w.name}
                    </span>
                    <span className="block truncate text-xs text-violet-200/80">
                      {placeLabel(w)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`text-xs transition ${
                      isSelected ? "rotate-90 text-amber-100" : "text-violet-300/60"
                    }`}
                  >
                    ❯
                  </span>
                </button>
              </li>
            );
          })}

          {peers.length === 0 && (
            <li className="px-3 py-3 text-xs italic leading-relaxed text-violet-300/80">
              No other lights wander yet. Open Hallo in a second window to
              summon one.
            </li>
          )}
        </ul>
      </section>

      {selected && (
        <WhereaboutsWindow
          w={selected}
          me={me}
          place={placeLabel(selected)}
          onTravel={() => onSeek(selected.id, selected.lat, selected.lng)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function WhereaboutsWindow({
  w,
  me,
  place,
  onTravel,
  onClose,
}: {
  w: Wanderer;
  me: LatLng | null;
  place: string;
  onTravel: () => void;
  onClose: () => void;
}) {
  const coords = w.isMe
    ? `${formatCoords(w.lat, w.lng)}`
    : `≈ ${formatCoords(w.lat, w.lng)}`;

  return (
    <div
      role="dialog"
      aria-label={`Whereabouts of ${w.name}`}
      className="whereabouts-in pointer-events-auto absolute left-0 top-0 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-amber-200/35 bg-gradient-to-b from-[#241645]/95 to-[#0d0a24]/95 p-4 text-violet-100 shadow-[0_0_50px_rgba(196,161,255,0.3)] backdrop-blur-md sm:left-[calc(100%+0.75rem)]"
    >
      <div className="flex items-start gap-3">
        <WandererIcon w={w} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300/70">
            {w.isMe ? "Your whereabouts" : "Whereabouts of"}
          </p>
          <h3
            className={`truncate font-fantasy text-base font-bold tracking-wide ${
              w.isMe ? "text-amber-100" : "text-violet-50"
            }`}
          >
            {w.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 rounded-full px-2 text-violet-300 transition hover:text-amber-100"
        >
          ×
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-violet-300/15 bg-black/20 p-3">
        <p className="font-fantasy text-sm font-semibold tracking-wide text-amber-50">
          {place}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-violet-300/80">{coords}</p>

        <dl className="mt-3 space-y-1.5 text-xs">
          {!w.isMe && me && (
            <div className="flex justify-between gap-3">
              <dt className="text-violet-300/70">Distance</dt>
              <dd className="text-right text-violet-100">
                {formatDistance(distanceKm(me, w))}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-violet-300/70">Status</dt>
            <dd className="text-right text-violet-100">
              {w.isMe
                ? "Present"
                : w.busy
                  ? "Entranced in a conversation"
                  : "Free to be reached"}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-3 text-[11px] italic leading-relaxed text-violet-300/80">
        {w.isMe
          ? "Your true place — seen by your eyes alone. Others see your light veiled 1–3 km away."
          : "This light is veiled in mist — the true hearth lies somewhere within 1–3 km."}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onTravel}
          className="flex-1 rounded-full bg-gradient-to-r from-amber-200 to-amber-300 px-4 py-2 font-fantasy text-xs font-bold tracking-[0.1em] text-[#2a1846] shadow-[0_0_20px_rgba(253,227,167,0.45)] transition hover:from-amber-100 hover:to-amber-200"
        >
          ✦ Travel there
        </button>
        <button
          onClick={onClose}
          className="rounded-full border border-violet-300/30 px-4 py-2 text-xs text-violet-200 transition hover:border-violet-200/60 hover:text-violet-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
