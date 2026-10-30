import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

// Identity model (server-only).
//
// The browser generates a high-entropy secret *token* and never shares it with
// other users. Everything public — the dot id on the map, `fromId`/`toId` on
// signals — is a one-way hash of that token. Knowing someone's public id
// therefore grants nothing: every authenticated call must present the token,
// and the acting identity is always derived from it, never taken from the body.

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const PUBLIC_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export function isValidToken(v: unknown): v is string {
  return typeof v === "string" && TOKEN_RE.test(v);
}

export function isValidPublicId(v: unknown): v is string {
  return typeof v === "string" && PUBLIC_ID_RE.test(v);
}

function digest(domain: string, token: string): Buffer {
  return createHash("sha256").update(`pulse:${domain}:${token}`).digest();
}

export function publicIdFor(token: string): string {
  return digest("id", token).toString("base64url").slice(0, 22);
}

// Two uniform [0, 1) values bound to the token. Re-joining with the same token
// (e.g. after being reaped while backgrounded) yields the exact same offset, so
// an observer can't average many fresh offsets to triangulate the real spot.
export function offsetSeedFor(token: string): [number, number] {
  const d = digest("geo", token);
  return [d.readUInt32BE(0) / 2 ** 32, d.readUInt32BE(4) / 2 ** 32];
}

export function bearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return isValidToken(token) ? token : null;
}

export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
