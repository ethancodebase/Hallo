// ICE server configuration (server-only).
//
// Direct peer-to-peer connections fail behind symmetric NATs, VPNs and
// firewalls that block UDP. A TURN relay fixes that by forwarding the encrypted
// WebRTC traffic, including over TLS on port 443, which almost every network
// allows. Provider secrets stay on the server; browsers only ever receive
// short-lived (or provider-issued) credentials.
//
// Configure ONE provider via env vars:
//   Cloudflare:  CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
//   Metered:     METERED_TURN_DOMAIN (e.g. myapp.metered.live) + METERED_TURN_API_KEY
//   Any TURN:    TURN_URLS (comma-separated) + TURN_USERNAME + TURN_CREDENTIAL
// With none set, peers fall back to STUN only (direct connections).

export interface IceConfig {
  iceServers: RTCIceServer[];
  /** Epoch ms after which the client should fetch fresh credentials. */
  expiresAt: number;
}

const STUN_ONLY: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

// Longer than any expected call: TURN credentials expiring mid-call drop the relay.
const CREDENTIAL_TTL_S = 6 * 60 * 60;
// Clients refresh well before expiry so a call never starts on stale credentials.
const CLIENT_REFRESH_S = 60 * 60;
const PROVIDER_TIMEOUT_MS = 5_000;

export function turnProvider(): "cloudflare" | "metered" | "static" | null {
  const e = process.env;
  if (e.CLOUDFLARE_TURN_KEY_ID && e.CLOUDFLARE_TURN_API_TOKEN) return "cloudflare";
  if (e.METERED_TURN_DOMAIN && e.METERED_TURN_API_KEY) return "metered";
  if (e.TURN_URLS && e.TURN_USERNAME && e.TURN_CREDENTIAL) return "static";
  return null;
}

export async function getIceConfig(): Promise<IceConfig> {
  const expiresAt = Date.now() + CLIENT_REFRESH_S * 1000;
  try {
    switch (turnProvider()) {
      case "cloudflare":
        return { iceServers: await cloudflare(), expiresAt };
      case "metered":
        return { iceServers: await metered(), expiresAt };
      case "static":
        return { iceServers: staticTurn(), expiresAt };
    }
  } catch (err) {
    console.error("TURN credential fetch failed; falling back to STUN only:", err);
  }
  // Retry soon rather than pinning a STUN-only config for an hour.
  return { iceServers: STUN_ONLY, expiresAt: Date.now() + 60_000 };
}

async function cloudflare(): Promise<RTCIceServer[]> {
  const keyId = encodeURIComponent(process.env.CLOUDFLARE_TURN_KEY_ID!);
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_TURN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_S }),
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const data = (await res.json()) as { iceServers?: RTCIceServer[] };
  return sanitize(data.iceServers);
}

async function metered(): Promise<RTCIceServer[]> {
  const domain = process.env.METERED_TURN_DOMAIN!.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const key = encodeURIComponent(process.env.METERED_TURN_API_KEY!);
  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${key}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Metered TURN responded ${res.status}`);
  return sanitize((await res.json()) as RTCIceServer[]);
}

function staticTurn(): RTCIceServer[] {
  const urls = process.env
    .TURN_URLS!.split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return sanitize([
    ...STUN_ONLY,
    {
      urls,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    },
  ]);
}

// Keep only well-formed stun/turn entries. Browsers block port 53, so those
// URLs would only stall ICE gathering until they time out.
function sanitize(servers: RTCIceServer[] | undefined): RTCIceServer[] {
  if (!Array.isArray(servers)) throw new Error("malformed ICE server list");
  const out: RTCIceServer[] = [];
  for (const s of servers) {
    const urls = (Array.isArray(s?.urls) ? s.urls : [s?.urls])
      .filter((u): u is string => typeof u === "string")
      .filter((u) => /^(stun|turns?):/.test(u) && !/:53(\?|$)/.test(u));
    if (urls.length === 0) continue;
    const isTurn = urls.some((u) => u.startsWith("turn"));
    if (isTurn && (typeof s.username !== "string" || typeof s.credential !== "string")) {
      continue;
    }
    out.push(isTurn ? { urls, username: s.username, credential: s.credential } : { urls });
  }
  if (out.length === 0) throw new Error("no usable ICE servers");
  return out;
}
