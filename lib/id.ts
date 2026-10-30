// The session's secret token: 256 random bits, base64url. It authenticates every
// API call and is never shown to other users (they only see a hash of it).
// getRandomValues works outside secure contexts too (plain-HTTP LAN testing),
// unlike crypto.randomUUID.
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
