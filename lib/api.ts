// Client-side helpers for talking to the coordination API. `token` is the
// session's secret; it goes in the Authorization header (never the URL).
import type { PollResponse, SignalType } from "@/lib/types";

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function join(
  token: string,
  lat: number,
  lng: number,
): Promise<void> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
}

export async function poll(token: string): Promise<PollResponse> {
  const res = await fetch("/api/poll", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

export async function fetchIceConfig(
  token: string,
): Promise<{ iceServers: RTCIceServer[]; expiresAt: number }> {
  const res = await fetch("/api/ice", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ice failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  token: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  const res = await fetch("/api/signal", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ toId, type, payload }),
  });
  if (!res.ok) throw new Error(`signal failed: ${res.status}`);
}

// Fire-and-forget leave that survives the tab closing. sendBeacon can't set
// headers, so the token travels in the body.
export function leave(token: string): void {
  const body = JSON.stringify({ token });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
