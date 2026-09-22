import cytoscape from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";

import { graphStylesheet, token } from "./style";

export type LayoutName = "cose" | "breadthfirst" | "concentric" | "grid";

/** Below this, node labels stop being legible; above it, they look oversized. */
const MIN_READABLE_ZOOM = 0.55;
const MAX_FIT_ZOOM = 1;

/**
 * Hierarchy edges point from the more specific term to the more general one
 * (`rdfs:subClassOf` reads "subject is a subclass of object"), which is the
 * correct RDF direction but the opposite of how a tree should be drawn. So
 * `breadthfirst` is given the sinks as its roots and told to traverse
 * undirected, which puts the most general terms at the top.
 */
function layoutOptions(name: LayoutName, cy: cytoscape.Core): cytoscape.LayoutOptions {
  const options: Record<LayoutName, object> = {
    cose: {
      name: "cose",
      animate: false,
      nodeRepulsion: () => 12000,
      idealEdgeLength: () => 90,
    },
    breadthfirst: {
      name: "breadthfirst",
      animate: false,
      directed: false,
      spacingFactor: 0.85,
      roots: cy.nodes().filter((node) => node.outdegree(false) === 0),
    },
    concentric: { name: "concentric", animate: false, minNodeSpacing: 32 },
    grid: { name: "grid", animate: false, avoidOverlap: true },
  };
  return options[name] as cytoscape.LayoutOptions;
}

interface UseCytoscapeArgs {
  elements: cytoscape.ElementDefinition[];
  onSelect?: (id: string | null) => void;
}

/**
 * Owns the Cytoscape instance.
 *
 * Elements are diffed and patched rather than replaced: calling
 * `cy.elements().remove()` followed by `cy.add(all)` discards every node
 * position and forces a re-layout, which is both slow and visually jarring on a
 * graph of any size. A layout therefore runs only when the set of node ids
 * changes, never on a pure data change such as editing a label.
 */
export function useCytoscape({ elements, onSelect }: UseCytoscapeArgs) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const hashesRef = useRef(new Map<string, string>());
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState<LayoutName>("breadthfirst");

  const runLayout = useCallback(
    (name?: LayoutName) => {
      const cy = cyRef.current;
      if (!cy || cy.elements().length === 0) return;
      cy.layout(layoutOptions(name ?? layout, cy)).run();
      cy.fit(undefined, 40);
      // Fitting is only a starting point, and on its own it produces two bad
      // results: a small graph is magnified until the type looks oversized, and
      // a wide one is shrunk until the labels are illegible texture. BFO alone
      // has around two dozen hierarchy roots, so a plain fit lands near 0.35.
      // Clamp to a readable band and let the user pan for the rest.
      const zoom = cy.zoom();
      if (zoom > MAX_FIT_ZOOM || zoom < MIN_READABLE_ZOOM) {
        cy.zoom(Math.min(MAX_FIT_ZOOM, Math.max(MIN_READABLE_ZOOM, zoom)));
        cy.center();
      }
    },
    [layout],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: graphStylesheet(),
      minZoom: 0.1,
      maxZoom: 4,
      // Perf guards for large ontologies.
      hideEdgesOnViewport: true,
      textureOnViewport: true,
      motionBlur: false,
      pixelRatio: 1,
    });

    cy.on("select", "node", (event) => onSelect?.(event.target.id()));
    cy.on("unselect", "node", () => onSelect?.(null));

    cyRef.current = cy;
    // Cytoscape draws to a canvas, so its nodes are not addressable by CSS
    // selector and end-to-end tests cannot click them. Exposing the instance is
    // the accepted way to make a canvas renderer testable.
    window.__ontoView = { cy };
    setReady(true);

    return () => {
      delete window.__ontoView;
      cy.destroy();
      cyRef.current = null;
      hashesRef.current.clear();
      setReady(false);
    };
    // onSelect is intentionally read once; the graph is mounted for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;

    const previous = hashesRef.current;
    const next = new Map<string, string>();
    for (const element of elements) {
      const id = String(element.data.id);
      next.set(id, JSON.stringify(element.data));
    }

    const added: cytoscape.ElementDefinition[] = [];
    const removed: string[] = [];
    let nodeSetChanged = false;

    for (const element of elements) {
      const id = String(element.data.id);
      const before = previous.get(id);
      if (before === undefined) {
        added.push(element);
        if (!element.data.source) nodeSetChanged = true;
      } else if (before !== next.get(id)) {
        cy.$id(id).data(element.data);
      }
    }
    for (const id of previous.keys()) {
      if (!next.has(id)) {
        removed.push(id);
        if (!cy.$id(id).isEdge()) nodeSetChanged = true;
      }
    }

    if (added.length || removed.length) {
      cy.batch(() => {
        for (const id of removed) cy.$id(id).remove();
        if (added.length) cy.add(added);
      });
    }

    hashesRef.current = next;
    if (nodeSetChanged) runLayout();
  }, [elements, ready, runLayout]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.style(graphStylesheet());
    cy.container()?.style.setProperty("background", token("--graph-bg"));
  }, [ready]);

  return { containerRef, runLayout, layout, setLayout, cy: cyRef };
}
