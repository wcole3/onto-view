/**
 * Hand-drawn SVG primitives at a uniform 1.75px stroke. No icon library: the
 * app needs a handful of glyphs and the generic thin-line sets do not match the
 * slightly heavier, technical weight this UI is built around.
 */

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconGraph() {
  return (
    <svg {...base}>
      <circle cx="8" cy="3" r="2" />
      <circle cx="3.5" cy="12.5" r="2" />
      <circle cx="12.5" cy="12.5" r="2" />
      <path d="M7 4.7 4.6 10.8M9 4.7l2.4 6.1" />
    </svg>
  );
}

export function IconUpload() {
  return (
    <svg {...base}>
      <path d="M8 10.5V2.5M5 5.5 8 2.5l3 3" />
      <path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
    </svg>
  );
}

export function IconLayout() {
  return (
    <svg {...base}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1" />
      <path d="M2.5 6.5h11M6.5 6.5v7" />
    </svg>
  );
}
