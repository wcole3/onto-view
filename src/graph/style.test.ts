import { describe, expect, it } from "vitest";

import { graphStylesheet, token } from "./style";

describe("token", () => {
  it("falls back when the custom property is not resolvable", () => {
    // jsdom loads no stylesheet, so every lookup takes the fallback path.
    expect(token("--graph-bg")).toBe("#fbfbfa");
  });

  it("returns an empty string for an unknown property", () => {
    expect(token("--not-a-token")).toBe("");
  });
});

describe("graphStylesheet edge labels", () => {
  const labelOf = (sheet: ReturnType<typeof graphStylesheet>) => {
    const edge = sheet.find((block) => "selector" in block && block.selector === "edge");
    if (!edge || !("style" in edge)) throw new Error("expected an edge block");
    return (edge.style as Record<string, unknown>).label;
  };

  it("labels edges on a sparse graph", () => {
    expect(labelOf(graphStylesheet(true))).toBe("data(label)");
  });

  it("drops edge labels on a dense graph, leaving selection to reveal them", () => {
    expect(labelOf(graphStylesheet(false))).toBe("");
    const selected = graphStylesheet(false).find(
      (block) => "selector" in block && block.selector === "edge:selected",
    );
    expect(selected && "style" in selected && (selected.style as Record<string, unknown>).label).toBe(
      "data(label)",
    );
  });
});

describe("graphStylesheet", () => {
  it("styles nodes and edges, with three provenance states", () => {
    const selectors = graphStylesheet().map((block) => ("selector" in block ? block.selector : ""));
    expect(selectors).toContain("node");
    expect(selectors).toContain("edge");
    expect(selectors).toContain("node:selected");
    expect(selectors).toContain("edge:selected");
    // The three provenance states, and nothing more elaborate.
    expect(selectors.filter((s) => s.includes("state ="))).toEqual([
      'node[state = "single"]',
      'node[state = "shared"]',
      'node[state = "undeclared"]',
    ]);
  });

  it("takes every colour from a token rather than a literal", () => {
    const [node] = graphStylesheet();
    if (!("style" in node)) throw new Error("expected a style block");
    const style = node.style as Record<string, unknown>;
    expect(style["background-color"]).toBe(token("--graph-node-fill"));
    expect(style["border-color"]).toBe(token("--graph-node-border"));
  });
});
