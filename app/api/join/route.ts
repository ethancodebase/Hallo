import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import {
  bearerToken,
  clientIp,
  offsetSeedFor,
  publicIdFor,
  unauthorized,
} from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — Authorization: Bearer <token>, body { lat, lng } (raw coords).
// Applies a 1–3 km privacy offset and upserts the presence row. Raw
// coordinates are never stored. Returns the caller's public id.
export async function POST(request: NextRequest) {
  const limited = rateLimit("join", clientIp(request));
  if (limited) return limited;

  const token = bearerToken(request);
  if (!token) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { lat, lng } = (body ?? {}) as Record<string, unknown>;
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const id = publicIdFor(token);
  const offset = applyPrivacyOffset(
    lat as number,
    lng as number,
    offsetSeedFor(token),
  );

  await prisma.presence.upsert({
    where: { id },
    create: {
      id,
      lat: offset.lat,
      lng: offset.lng,
      busy: false,
      lastSeen: new Date(),
    },
    update: {
      lat: offset.lat,
      lng: offset.lng,
      lastSeen: new Date(),
    },
  });

  return Response.json({ ok: true, id });
}
