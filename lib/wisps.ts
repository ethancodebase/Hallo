// Deterministic, per-session cosmetics for the anonymous "wisps" on the map.
// Everything is derived from the session id, so a stranger keeps the same
// color and name for as long as they're online, and a new one next visit.

const WISP_COLORS = [
  "#8be9ff", // spirit cyan
  "#c4a1ff", // arcane violet
  "#7dffc8", // fae green
  "#ffb3e6", // moon-rose
  "#a8c8ff", // frost blue
  "#ffe08a", // ember gold
];

const EPITHETS = [
  "Silver", "Amber", "Moonlit", "Starborn", "Misty",
  "Ember", "Hollow", "Velvet", "Frost", "Gloaming",
];

const CREATURES = [
  "Fox", "Lantern", "Wisp", "Owl", "Comet",
  "Willow", "Raven", "Moth", "Sparrow", "Stag",
];

function hash(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function wispColor(id: string): string {
  return WISP_COLORS[hash(id, 0) % WISP_COLORS.length];
}

export function wispName(id: string): string {
  const epithet = EPITHETS[hash(id, 7) % EPITHETS.length];
  const creature = CREATURES[hash(id, 13) % CREATURES.length];
  return `${epithet} ${creature}`;
}
