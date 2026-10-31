import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter. We pass the (pooled) Postgres
// connection string to the pg adapter.
//
// Reuse a single PrismaClient across hot reloads (dev) and warm serverless
// invocations to avoid exhausting Postgres connections. Use a *pooled*
// connection string for DATABASE_URL in production (PgBouncer / Neon pooler).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// pg currently treats sslmode=prefer/require/verify-ca as verify-full but warns
// that its next major will downgrade them to libpq semantics (no cert check).
// Pin verify-full explicitly, unless libpq compatibility was opted into.
function withExplicitSslMode(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const mode = url.searchParams.get("sslmode");
    if (
      mode &&
      ["prefer", "require", "verify-ca"].includes(mode) &&
      url.searchParams.get("uselibpqcompat") !== "true"
    ) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    // Not URL-shaped; hand it to pg unchanged.
  }
  return connectionString;
}

function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString: withExplicitSslMode(raw) });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
