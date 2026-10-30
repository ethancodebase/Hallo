import type { NextRequest } from "next/server";
import { clientIp, isValidToken, publicIdFor, unauthorized } from "@/lib/session";
import { removeSessions } from "@/lib/connection";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { token }. Removes the caller's presence row and any
// pending signals to/from them. Called via navigator.sendBeacon on tab close,
// which can't set an Authorization header, so the secret rides in the body
// (never the URL) and the body may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  const limited = rateLimit("leave", clientIp(request));
  if (limited) return limited;

  let token: unknown;
  try {
    const text = await request.text();
    token = text ? JSON.parse(text)?.token : undefined;
  } catch {
    token = undefined;
  }

  if (!isValidToken(token)) return unauthorized();

  await removeSessions([publicIdFor(token)]);

  return Response.json({ ok: true });
}
