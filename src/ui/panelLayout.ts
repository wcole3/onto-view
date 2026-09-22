import { create } from "zustand";

/**
 * Geometry of the two side panels.
 *
 * Kept out of the app store because it is chrome state rather than ontology
 * state: it survives reloads through localStorage, is never part of an edit or
 * an undo, and resetting the store must not move the furniture.
 */
export type PanelSide = "left" | "right";

/** Below this a panel's own controls stop fitting; above it, it eats the canvas. */
export const MIN_PANEL_WIDTH = 180;
export const MAX_PANEL_WIDTH = 560;

/** A collapsed panel keeps a rail, so it can be reopened where it stood. */
export const RAIL_WIDTH = 32;

export const DEFAULT_WIDTHS: Record<PanelSide, number> = { left: 220, right: 320 };

export interface PanelLayout {
  widths: Record<PanelSide, number>;
  collapsed: Record<PanelSide, boolean>;
}

export const DEFAULT_LAYOUT: PanelLayout = {
  widths: { ...DEFAULT_WIDTHS },
  collapsed: { left: false, right: false },
};

const STORAGE_KEY = "onto-view:panels";

export function clampWidth(px: number): number {
  if (!Number.isFinite(px)) return MIN_PANEL_WIDTH;
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(px)));
}

/** What the grid column measures: a collapsed panel is the rail, nothing more. */
export function columnWidth(layout: PanelLayout, side: PanelSide): number {
  return layout.collapsed[side] ? RAIL_WIDTH : clampWidth(layout.widths[side]);
}

/**
 * Reads a saved layout, falling back field by field. Anything stored could
 * have come from an older version or another tab, so a bad value costs that
 * one field rather than the whole layout.
 */
export function readLayout(storage: Pick<Storage, "getItem"> | undefined): PanelLayout {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return DEFAULT_LAYOUT;
  }
  if (!raw) return DEFAULT_LAYOUT;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_LAYOUT;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_LAYOUT;

  const widths = (parsed as { widths?: Record<string, unknown> }).widths ?? {};
  const collapsed = (parsed as { collapsed?: Record<string, unknown> }).collapsed ?? {};
  const width = (side: PanelSide) =>
    typeof widths[side] === "number" ? clampWidth(widths[side]) : DEFAULT_WIDTHS[side];

  return {
    widths: { left: width("left"), right: width("right") },
    collapsed: {
      left: collapsed.left === true,
      right: collapsed.right === true,
    },
  };
}

export function writeLayout(
  storage: Pick<Storage, "setItem"> | undefined,
  layout: PanelLayout,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // A full or blocked store costs the preference, not the session.
  }
}

const browserStorage = typeof window === "undefined" ? undefined : window.localStorage;

export const usePanelLayout = create<PanelLayout>(() => readLayout(browserStorage));

function persist(next: PanelLayout): PanelLayout {
  writeLayout(browserStorage, next);
  return next;
}

export function setPanelWidth(side: PanelSide, px: number): void {
  usePanelLayout.setState((state) =>
    persist({ ...state, widths: { ...state.widths, [side]: clampWidth(px) } }),
  );
}

export function togglePanel(side: PanelSide): void {
  usePanelLayout.setState((state) =>
    persist({ ...state, collapsed: { ...state.collapsed, [side]: !state.collapsed[side] } }),
  );
}

export function resetPanelWidth(side: PanelSide): void {
  setPanelWidth(side, DEFAULT_WIDTHS[side]);
}
