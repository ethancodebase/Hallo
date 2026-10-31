// Checks whether a deployed Pulse instance hands out TURN relay servers.
//   node scripts/check-turn.mjs https://hallo-olive.vercel.app
// Joins as a throwaway session, reads /api/ice, then leaves again.
import { randomBytes } from "node:crypto";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const token = randomBytes(32).toString("base64url");
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

try {
  const join = await fetch(`${base}/api/join`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ lat: 0, lng: 0 }),
  });
  if (!join.ok) throw new Error(`join failed: HTTP ${join.status}`);

  const res = await fetch(`${base}/api/ice`, { headers: auth });
  if (!res.ok) throw new Error(`/api/ice failed: HTTP ${res.status}`);
  const { iceServers, relay } = await res.json();

  const urls = iceServers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
  const turn = urls.filter((u) => u.startsWith("turn"));
  const tls443 = turn.filter((u) => u.startsWith("turns:") && u.includes(":443"));

  console.log(`ICE servers from ${base}:`);
  for (const u of urls) console.log(`  ${u}`);
  console.log("");
  if (turn.length === 0) {
    if (relay === "error") {
      console.log("✗ TURN env vars are set, but the provider request failed.");
      console.log("  Check the server logs, the domain and the API key.");
    } else {
      console.log("✗ No TURN relay configured — VPN/firewall users may fail to connect.");
      console.log("  Set the TURN env vars in Vercel and redeploy (see .env.example).");
    }
    process.exitCode = 1;
  } else {
    console.log(`✓ TURN relay configured (${turn.length} URLs).`);
    console.log(
      tls443.length
        ? "✓ Includes TURN over TLS on port 443 — works through strict firewalls."
        : "! No turns:…:443 URL — networks that only allow HTTPS may still fail.",
    );
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
} finally {
  await fetch(`${base}/api/leave`, {
    method: "POST",
    body: JSON.stringify({ token }),
  }).catch(() => {});
}
