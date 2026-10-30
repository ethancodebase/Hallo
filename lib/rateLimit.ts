// Fixed-window, in-memory rate limiter keyed by bucket + client IP.
//
// On serverless this is per warm instance, so it's a speed bump against
// scripted floods rather than a hard global quota — a shared store (Upstash
// Redis / Vercel KV) would be needed for that. The DB-side caps in the routes
// (mailbox size, one outgoing request per session) are the hard backstop.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = 0;

export const LIMITS = {
  join: { max: 20, windowMs: 60_000 },
  poll: { max: 240, windowMs: 60_000 },
  signal: { max: 600, windowMs: 60_000 },
  leave: { max: 30, windowMs: 60_000 },
} as const;

export function rateLimit(
  bucket: keyof typeof LIMITS,
  ip: string,
): Response | null {
  const { max, windowMs } = LIMITS[bucket];
  const now = Date.now();

  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const key = `${bucket}:${ip}`;
  let w = windows.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    windows.set(key, w);
  }
  w.count++;
  if (w.count <= max) return null;

  return Response.json(
    { error: "rate limited" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((w.resetAt - now) / 1000)) },
    },
  );
}
