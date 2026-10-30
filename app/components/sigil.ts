// The current user's "you are here" sigil: a golden rune circle around a
// four-pointed star. Kept as a static SVG string because the map marker is a
// plain DOM node (Mapbox), and the React UI reuses the same markup.
// Solid fills only (no <defs> ids) so multiple copies can coexist on a page.

const RUNE_TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const r1 = i % 3 === 0 ? 16.2 : 17.4;
  const r2 = 20;
  const p = (r: number) =>
    `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
  return `<path d="M${p(r1)} L${p(r2)}"/>`;
}).join("");

const STAR = "M0 -13 L2.6 -2.6 L13 0 L2.6 2.6 L0 13 L-2.6 2.6 L-13 0 L-2.6 -2.6Z";

export const ME_SIGIL_SVG = `<svg class="sigil" viewBox="-24 -24 48 48" aria-hidden="true">
  <g class="sigil-runes" fill="none" stroke="#fde3a7">
    <circle r="21.5" stroke-opacity="0.35" stroke-width="0.6" stroke-dasharray="1.5 2.5"/>
    <circle r="18.5" stroke-opacity="0.8" stroke-width="0.9"/>
    <g stroke-width="1" stroke-linecap="round" stroke-opacity="0.9">${RUNE_TICKS}</g>
    <path d="M0 -24 L1.6 -21.5 L0 -19 L-1.6 -21.5Z M0 24 L1.6 21.5 L0 19 L-1.6 21.5Z M24 0 L21.5 1.6 L19 0 L21.5 -1.6Z M-24 0 L-21.5 1.6 L-19 0 L-21.5 -1.6Z" fill="#fde3a7" stroke="none"/>
  </g>
  <g class="sigil-star">
    <path d="${STAR}" fill="#f6c560" transform="rotate(45) scale(0.62)" opacity="0.75"/>
    <path d="${STAR}" fill="#ffe6a8" stroke="#fff6dc" stroke-width="0.6"/>
  </g>
  <circle class="sigil-core" r="3" fill="#fffaf0"/>
</svg>`;
