import { describe, expect, it } from "vitest";

import {
  clampWidth,
  columnWidth,
  DEFAULT_LAYOUT,
  DEFAULT_WIDTHS,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  RAIL_WIDTH,
  readLayout,
  writeLayout,
  type PanelLayout,
} from "./panelLayout";

function fakeStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    read: () => value,
  };
}

describe("clampWidth", () => {
  it("keeps a panel between its bounds", () => {
    expect(clampWidth(10)).toBe(MIN_PANEL_WIDTH);
    expect(clampWidth(9999)).toBe(MAX_PANEL_WIDTH);
    expect(clampWidth(240.4)).toBe(240);
  });

  it("falls back rather than producing NaN geometry", () => {
    expect(clampWidth(Number.NaN)).toBe(MIN_PANEL_WIDTH);
  });
});

describe("columnWidth", () => {
  const layout: PanelLayout = {
    widths: { left: 300, right: 300 },
    collapsed: { left: true, right: false },
  };

  it("measures a collapsed panel as its rail", () => {
    expect(columnWidth(layout, "left")).toBe(RAIL_WIDTH);
    expect(columnWidth(layout, "right")).toBe(300);
  });
});

describe("readLayout", () => {
  it("returns defaults with no storage or no saved value", () => {
    expect(readLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(fakeStorage())).toEqual(DEFAULT_LAYOUT);
  });

  it("round-trips a written layout", () => {
    const storage = fakeStorage();
    const layout: PanelLayout = {
      widths: { left: 260, right: 400 },
      collapsed: { left: false, right: true },
    };
    writeLayout(storage, layout);
    expect(readLayout(storage)).toEqual(layout);
  });

  it("repairs a saved value field by field", () => {
    const storage = fakeStorage(
      JSON.stringify({ widths: { left: 9999, right: "wide" }, collapsed: { left: "yes" } }),
    );
    expect(readLayout(storage)).toEqual({
      widths: { left: MAX_PANEL_WIDTH, right: DEFAULT_WIDTHS.right },
      collapsed: { left: false, right: false },
    });
  });

  it("ignores a value that is not a layout at all", () => {
    expect(readLayout(fakeStorage("not json"))).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(fakeStorage("42"))).toEqual(DEFAULT_LAYOUT);
  });

  it("survives a storage that throws, as a blocked one does", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readLayout(blocked)).toEqual(DEFAULT_LAYOUT);
  });
});
