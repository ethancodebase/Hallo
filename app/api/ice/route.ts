import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIceConfig } from "@/lib/ice";
import { bearerToken, clientIp, publicIdFor, unauthorized } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ice — Authorization: Bearer <token>. Returns the STUN/TURN servers
// the browser should use for its peer connection. Only sessions that are on
// the map get relay credentials, so the TURN quota can't be farmed anonymously.
export async function GET(request: NextRequest) {
  const limited = rateLimit("ice", clientIp(request));
  if (limited) return limited;

  const token = bearerToken(request);
  if (!token) return unauthorized();

  const joined = await prisma.presence.findUnique({
    where: { id: publicIdFor(token) },
    select: { id: true },
  });
  if (!joined) return Response.json({ error: "not joined" }, { status: 409 });

  return Response.json(await getIceConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
