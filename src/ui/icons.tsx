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

export function IconEye() {
  return (
    <svg {...base}>
      <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="1.6" />
    </svg>
  );
}

export function IconEyeOff() {
  return (
    <svg {...base}>
      <path d="M6.2 4.2A6.9 6.9 0 0 1 8 4c4.1 0 6.5 4 6.5 4a12 12 0 0 1-1.9 2.2M9.9 11.8A7 7 0 0 1 8 12c-4.1 0-6.5-4-6.5-4a12 12 0 0 1 2.7-2.8" />
      <path d="M2.5 2.5l11 11" />
    </svg>
  );
}

export function IconClose() {
  return (
    <svg {...base}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg {...base}>
      <circle cx="7" cy="7" r="4.2" />
      <path d="M10.2 10.2 13.5 13.5" />
    </svg>
  );
}

export function IconFocus() {
  return (
    <svg {...base}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2" />
    </svg>
  );
}

export function IconDownload() {
  return (
    <svg {...base}>
      <path d="M8 2.5v8M5 7.5 8 10.5l3-3" />
      <path d="M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg {...base}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function IconUndo() {
  return (
    <svg {...base}>
      <path d="M4 6.5H9.5a3.5 3.5 0 0 1 0 7H6" />
      <path d="M6.5 4 4 6.5 6.5 9" />
    </svg>
  );
}

export function IconTree() {
  return (
    <svg {...base}>
      <path d="M3 2.5v9a1 1 0 0 0 1 1h2.5" />
      <path d="M3 7h3.5" />
      <path d="M8 1.5h5.5M8 6h5.5M8 11h5.5" />
    </svg>
  );
}

export function IconChevron({ open }: { open: boolean }) {
  return (
    <svg {...base} style={{ transform: open ? "rotate(90deg)" : undefined }}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

export function IconCaret({ direction }: { direction: "left" | "right" }) {
  return (
    <svg {...base} style={{ transform: direction === "left" ? "rotate(180deg)" : undefined }}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}
