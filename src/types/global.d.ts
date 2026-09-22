import type cytoscape from "cytoscape";

declare global {
  interface Window {
    /**
     * Test hook. Cytoscape renders to a canvas, so end-to-end tests need the
     * instance to resolve a node's screen position before clicking it.
     */
    __ontoView?: { cy: cytoscape.Core };
  }
}
