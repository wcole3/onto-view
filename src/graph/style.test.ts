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

describe("graphStylesheet", () => {
  it("styles nodes and edges in both states", () => {
    const selectors = graphStylesheet().map((block) => ("selector" in block ? block.selector : ""));
    expect(selectors).toEqual([
      "node",
      "node:selected",
      "edge",
      'edge[kind = "subClassOf"]',
      "edge:selected",
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
