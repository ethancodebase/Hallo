import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  bearerToken,
  clientIp,
  isValidPublicId,
  publicIdFor,
  unauthorized,
} from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTROL_TYPES: SignalType[] = ["request", "accept", "decline", "end"];
const RTC_TYPES: SignalType[] = ["offer", "answer", "ice"];

const MAX_PAYLOAD = 16 * 1024; // SDP is a few KB, ICE candidates far less.
// Undrained messages a single mailbox may hold. A live client drains every
// poll, so this only bites when someone floods a target (or a dead tab).
const MAX_MAILBOX = 200;

// POST /api/signal — Authorization: Bearer <token>, body { toId, type, payload? }
// Drops one message into the recipient's mailbox. The sender is always the
// token's owner, and the server enforces the connection lifecycle:
//   request → (accept | decline | end) → offer/answer/ice … → end
// so nobody can forge an accept, inject SDP into someone else's call, hang up
// a call they're not in, or mark arbitrary users busy.
export async function POST(request: NextRequest) {
  const limited = rateLimit("signal", clientIp(request));
  if (limited) return limited;

  const token = bearerToken(request);
  if (!token) return unauthorized();
  const fromId = publicIdFor(token);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { toId, type, payload } = (body ?? {}) as Record<string, unknown>;

  if (!isValidPublicId(toId) || toId === fromId) {
    return Response.json({ error: "invalid recipient" }, { status: 400 });
  }
  const signalType = type as SignalType;
  const isControl = CONTROL_TYPES.includes(signalType);
  const isRtc = RTC_TYPES.includes(signalType);
  if (!isControl && !isRtc) {
    return Response.json({ error: "invalid type" }, { status: 400 });
  }

  let payloadStr: string | null = null;
  if (isRtc) {
    if (typeof payload !== "string" || payload.length > MAX_PAYLOAD) {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
    } catch {
      return Response.json({ error: "invalid payload" }, { status: 400 });
    }
    payloadStr = payload;
  } else if (payload !== undefined && payload !== null) {
    return Response.json({ error: "unexpected payload" }, { status: 400 });
  }

  const sender = await prisma.presence.findUnique({
    where: { id: fromId },
    select: { busy: true, peerId: true, requestTo: true },
  });
  if (!sender) {
    return Response.json({ error: "not joined" }, { status: 409 });
  }

  const pending = await prisma.signal.count({ where: { toId } });
  if (pending >= MAX_MAILBOX) {
    return Response.json({ error: "recipient mailbox full" }, { status: 429 });
  }

  switch (signalType) {
    case "request": {
      if (sender.busy) return conflict("already in a connection");
      const target = await prisma.presence.findUnique({
        where: { id: toId },
        select: { busy: true },
      });
      // Offline or busy (one connection at a time): auto-decline instead of
      // delivering, so the initiator is told and the target isn't disturbed.
      if (!target || target.busy) {
        await deliver(toId, fromId, "decline");
        return Response.json({ ok: true, autoDeclined: true });
      }
      // One outstanding request per sender; a new tap replaces the old one.
      await prisma.presence.update({
        where: { id: fromId },
        data: { requestTo: toId },
      });
      break;
    }

    case "accept": {
      // Only the target of a live request may accept it, and only while both
      // sides are free. Claim ourselves first, then the requester, and roll
      // back if the requester cancelled or got claimed meanwhile.
      const claimed = await prisma.presence.updateMany({
        where: { id: fromId, busy: false },
        data: { busy: true, peerId: toId, requestTo: null },
      });
      if (claimed.count === 0) return conflict("already in a connection");
      const paired = await prisma.presence.updateMany({
        where: { id: toId, requestTo: fromId, busy: false },
        data: { busy: true, peerId: fromId, requestTo: null },
      });
      if (paired.count === 0) {
        await prisma.presence.updateMany({
          where: { id: fromId, peerId: toId },
          data: { busy: false, peerId: null },
        });
        // Release the accepter's UI instead of leaving it "Connecting…".
        await deliver(toId, fromId, "end");
        return conflict("no pending request");
      }
      break;
    }

    case "decline": {
      const cleared = await prisma.presence.updateMany({
        where: { id: toId, requestTo: fromId },
        data: { requestTo: null },
      });
      if (cleared.count === 0) return conflict("no pending request");
      break;
    }

    case "offer":
    case "answer":
    case "ice": {
      if (sender.peerId !== toId) return conflict("not connected to recipient");
      break;
    }

    case "end": {
      if (sender.peerId === toId) {
        // Hang up: free both sides of exactly this pair.
        await prisma.presence.updateMany({
          where: {
            OR: [
              { id: fromId, peerId: toId },
              { id: toId, peerId: fromId },
            ],
          },
          data: { busy: false, peerId: null },
        });
      } else if (sender.requestTo === toId) {
        // Initiator cancelled / timed out its request.
        await prisma.presence.update({
          where: { id: fromId },
          data: { requestTo: null },
        });
      } else {
        // Recipient dismissing an incoming request.
        const cleared = await prisma.presence.updateMany({
          where: { id: toId, requestTo: fromId },
          data: { requestTo: null },
        });
        if (cleared.count === 0) return conflict("no relationship");
      }
      break;
    }
  }

  await deliver(fromId, toId, signalType, payloadStr);
  return Response.json({ ok: true });
}

function conflict(error: string) {
  return Response.json({ error }, { status: 409 });
}

async function deliver(
  fromId: string,
  toId: string,
  type: SignalType,
  payload: string | null = null,
) {
  await prisma.signal.create({ data: { fromId, toId, type, payload } });
}
