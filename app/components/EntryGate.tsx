"use client";

import { useState } from "react";

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
      fail("Couldn't reach Pulse. Check your connection and try again.");
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
        "Pulse needs a secure connection for location and camera. Open it via https:// or http://localhost.",
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

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 bg-zinc-950 p-6 text-zinc-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Pulse</h1>
        <p className="mt-2 max-w-sm text-zinc-400">
          A living globe of anonymous strangers. Drop onto the map and connect.
        </p>
      </div>

      <button
        onClick={enter}
        disabled={status === "locating"}
        className="rounded-full bg-emerald-400 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-60"
      >
        {status === "locating" ? "Locating…" : "Enter Pulse"}
      </button>

      {status === "error" && (
        <p className="max-w-sm text-center text-sm text-red-400">{error}</p>
      )}

      <p className="max-w-sm text-center text-xs text-zinc-500">
        No sign-up. Your dot is placed 1–3&nbsp;km from your real location.
        Nothing is stored — closing the tab ends everything.
      </p>
    </div>
  );
}
