import type cytoscape from "cytoscape";

/**
 * The Cytoscape stylesheet is built from the same CSS custom properties that
 * style the DOM chrome (src/styles/tokens.css), so the canvas cannot drift away
 * from the rest of the UI. Fallbacks exist only for environments with no
 * computed style, such as jsdom under Vitest.
 *
 * Two visual channels, kept independent:
 *
 * - **shape** encodes what kind of thing a node is
 * - **border colour** encodes which source declares it
 *
 * Provenance is carried by the border rather than the fill. The source palette
 * is mid-dark so that it stays separable at small sizes, and filling nodes with
 * it would both shout on a bone canvas and force white label text. A 2.5px
 * border reads clearly while leaving labels in off-black.
 */

const FALLBACKS: Record<string, string> = {
  "--graph-bg": "#fbfbfa",
  "--graph-node-fill": "#ffffff",
  "--graph-node-border": "#787774",
  "--graph-node-label": "#111111",
  "--graph-node-shared-fill": "#ececeb",
  "--graph-edge": "#c9c9c6",
  "--graph-edge-label": "#787774",
  "--graph-selected": "#1f6c9f",
  "--border": "#eaeaea",
  "--font-sans": "sans-serif",
  "--font-mono": "monospace",
  "--text-sm": "12px",
  "--text-xs": "11px",
};

export function token(name: string): string {
  if (typeof window !== "undefined" && document.documentElement) {
    const value = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (value) return value;
  }
  return FALLBACKS[name] ?? "";
}

export function graphStylesheet(): cytoscape.StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        "background-color": token("--graph-node-fill"),
        "border-color": token("--graph-node-border"),
        "border-width": 1,
        shape: "round-rectangle",
        // `width: "label"` is deprecated in Cytoscape 3.34, so size from the
        // label with a mapper instead. 6.6px per character approximates the
        // 12px UI sans at this weight; the floor keeps short labels readable.
        width: (ele: cytoscape.NodeSingular) =>
          Math.max(72, String(ele.data("label") ?? "").length * 6.6 + 20),
        height: 26,
        label: "data(label)",
        color: token("--graph-node-label"),
        "font-family": token("--font-sans"),
        "font-size": token("--text-sm"),
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "none",
      },
    },

    // Shape by entity kind.
    { selector: 'node[kind = "ObjectProperty"]', style: { shape: "round-diamond", height: 34 } },
    { selector: 'node[kind = "DatatypeProperty"]', style: { shape: "round-tag", height: 30 } },
    { selector: 'node[kind = "AnnotationProperty"]', style: { shape: "round-tag", height: 30 } },
    { selector: 'node[kind = "Property"]', style: { shape: "round-tag", height: 30 } },
    { selector: 'node[kind = "Individual"]', style: { shape: "ellipse", height: 30 } },

    // Border colour by provenance. Exactly three states.
    {
      selector: 'node[state = "single"]',
      style: { "border-color": "data(color)", "border-width": 2.5 },
    },
    {
      selector: 'node[state = "shared"]',
      style: {
        "background-color": token("--graph-node-shared-fill"),
        "border-color": "data(color)",
        "border-width": 2.5,
      },
    },
    {
      // Referenced but never declared in anything loaded — typically a class
      // from an ontology that was imported but not opened.
      selector: 'node[state = "undeclared"]',
      style: {
        "background-color": token("--graph-node-fill"),
        "border-color": token("--graph-node-border"),
        "border-width": 1,
        "border-style": "dashed",
        color: token("--graph-edge-label"),
      },
    },

    {
      selector: "node:selected",
      style: {
        "border-color": token("--graph-selected"),
        "border-width": 3,
        "border-style": "solid",
      },
    },

    {
      selector: "edge",
      style: {
        width: 1,
        "line-color": token("--graph-edge"),
        "target-arrow-color": token("--graph-edge"),
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.7,
        "curve-style": "bezier",
        label: "data(label)",
        color: token("--graph-edge-label"),
        "font-family": token("--font-mono"),
        "font-size": token("--text-xs"),
        "text-background-color": token("--graph-bg"),
        "text-background-opacity": 1,
        "text-background-padding": "2px",
      },
    },
    {
      // A hierarchy arrow already says "subClassOf", so labelling every one of
      // them is noise that collides on parallel edges. The label comes back on
      // selection, where it is actually being read.
      selector: "edge[?hierarchy]",
      style: { label: "" },
    },
    {
      selector: "edge:selected",
      style: {
        label: "data(label)",
        "line-color": token("--graph-selected"),
        "target-arrow-color": token("--graph-selected"),
        color: token("--graph-selected"),
        width: 2,
      },
    },
  ];
}
