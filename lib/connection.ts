import { prisma } from "@/lib/prisma";

// Remove sessions and everything that points at them: their mailbox traffic,
// partners' busy state, and requests aimed at them. Without the partner reset
// a vanished peer would leave the other dot "busy" and unconnectable.
export async function removeSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: { in: ids } }, { fromId: { in: ids } }] },
  });
  await prisma.presence.deleteMany({ where: { id: { in: ids } } });
  await prisma.presence.updateMany({
    where: { peerId: { in: ids } },
    data: { busy: false, peerId: null },
  });
  await prisma.presence.updateMany({
    where: { requestTo: { in: ids } },
    data: { requestTo: null },
  });
}
