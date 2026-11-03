"use client";

import { useState } from "react";
import { ME_SIGIL_SVG } from "./sigil";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function fail(message: string) {
    setStatus("error");
    setError(message);
  }

  async function located(pos: GeolocationPosition) {
    try {
      await onReady(pos.coords.latitude, pos.coords.longitude);
    } catch {
      fail("Couldn't reach Hallo. Check your connection and try again.");
    }
  }

  function locate(highAccuracy: boolean) {
    navigator.geolocation.getCurrentPosition(
      (pos) => void located(pos),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          fail("Location permission is required to place you on the map.");
        } else if (highAccuracy) {
          // No GPS/Wi-Fi fix in time (typical on desktops) — a coarse fix is
          // plenty, since the dot is offset by 1–3 km anyway.
          locate(false);
        } else {
          fail("Couldn't get your location. Please try again.");
        }
      },
      highAccuracy
        ? { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
        : { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }

  function enter() {
    if (!window.isSecureContext) {
      fail(
        "Hallo needs a secure connection for location and camera. Open it via https:// or http://localhost.",
      );
      return;
    }
    if (!("geolocation" in navigator)) {
      fail("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    locate(true);
  }

  const locating = status === "locating";

  return (
    <div className="starfield relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden p-6 text-violet-100">
      <div aria-hidden className="nebula pointer-events-none absolute inset-0" />

      <div className="relative flex flex-col items-center gap-8">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <span aria-hidden className="gate-halo absolute inset-0 rounded-full" />
          <span
            aria-hidden
            className={`gate-sigil absolute inset-4 ${locating ? "is-seeking" : ""}`}
            dangerouslySetInnerHTML={{ __html: ME_SIGIL_SVG }}
          />
        </div>

        <div className="text-center">
          <h1 className="gate-title font-fantasy text-5xl font-bold tracking-[0.2em] sm:text-6xl">
            PULSE
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-violet-200/85 sm:text-base">
            A living globe of wandering souls. Step through the veil, find a
            light in the dark, and speak with a stranger.
          </p>
        </div>

        <button
          onClick={enter}
          disabled={locating}
          className="gate-button rounded-full px-9 py-3.5 font-fantasy text-sm font-bold tracking-[0.18em] text-[#2a1846] transition disabled:cursor-wait"
        >
          {locating ? "Seeking your place among the stars…" : "✦ Step Through the Veil"}
        </button>

        {status === "error" && (
          <p
            role="alert"
            className="max-w-sm rounded-xl border border-rose-300/30 bg-rose-950/40 px-4 py-2.5 text-center text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        <ul className="flex flex-wrap justify-center gap-2 text-[11px] tracking-wide text-violet-200/80">
          {["No names, no sign-up", "Veiled 1–3 km in mist", "Nothing is kept"].map(
            (t) => (
              <li
                key={t}
                className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-1"
              >
                ✧ {t}
              </li>
            ),
          )}
        </ul>

        <p className="max-w-sm text-center text-xs leading-relaxed text-violet-300/70">
          Your light is cloaked in mist — others see it 1–3&nbsp;km from where
          you truly stand, never your exact spot. Close the tab and the spell
          ends.
        </p>
      </div>
    </div>
  );
}
