import { useMemo, useState } from "react";
import type cytoscape from "cytoscape";

import { IconGraph, IconLayout, IconUpload } from "./ui/icons";
import { useCytoscape, type LayoutName } from "./graph/useCytoscape";

/**
 * Stage 1 placeholder graph: a fragment of the BFO continuant hierarchy, used to
 * prove the renderer and the design tokens before any parsing exists. Stage 2
 * replaces it with elements derived from loaded files.
 */
const DEMO_ELEMENTS: cytoscape.ElementDefinition[] = [
  { data: { id: "bfo:Continuant", label: "Continuant" } },
  { data: { id: "bfo:IndependentContinuant", label: "Independent Continuant" } },
  { data: { id: "bfo:MaterialEntity", label: "Material Entity" } },
  { data: { id: "bfo:Object", label: "Object" } },
  { data: { id: "bfo:ObjectAggregate", label: "Object Aggregate" } },
  {
    data: {
      id: "e1",
      source: "bfo:IndependentContinuant",
      target: "bfo:Continuant",
      label: "rdfs:subClassOf",
      kind: "subClassOf",
    },
  },
  {
    data: {
      id: "e2",
      source: "bfo:MaterialEntity",
      target: "bfo:IndependentContinuant",
      label: "rdfs:subClassOf",
      kind: "subClassOf",
    },
  },
  {
    data: {
      id: "e3",
      source: "bfo:Object",
      target: "bfo:MaterialEntity",
      label: "rdfs:subClassOf",
      kind: "subClassOf",
    },
  },
  {
    data: {
      id: "e4",
      source: "bfo:ObjectAggregate",
      target: "bfo:MaterialEntity",
      label: "rdfs:subClassOf",
      kind: "subClassOf",
    },
  },
];

const LAYOUTS: LayoutName[] = ["breadthfirst", "cose", "concentric", "grid"];

export default function App() {
  const [layout, setLayout] = useState<LayoutName>("breadthfirst");
  const [selected, setSelected] = useState<string | null>(null);
  const elements = useMemo(() => DEMO_ELEMENTS, []);

  const { containerRef, runLayout } = useCytoscape({
    elements,
    layout,
    onSelect: setSelected,
  });

  return (
    <div className="shell">
      <header className="toolbar">
        <div className="toolbar__brand">
          <IconGraph />
          <span>onto-view</span>
          <em>stage 1</em>
        </div>

        <div className="toolbar__spacer" />

        <div className="toolbar__group">
          <IconLayout />
          <select
            id="layout"
            className="button"
            aria-label="Graph layout"
            value={layout}
            onChange={(event) => {
              const next = event.target.value as LayoutName;
              setLayout(next);
              runLayout(next);
            }}
          >
            {LAYOUTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button className="button button--primary" type="button" disabled>
            <IconUpload />
            Load file
          </button>
        </div>
      </header>

      <div className="shell__body">
        <aside className="panel panel--left">
          <div className="panel__header">
            <h2 className="panel__title">Sources</h2>
          </div>
          <div className="panel__body">
            <p className="panel__empty">
              No files loaded. File loading arrives in stage 2; the graph is a
              fixed fragment of the BFO continuant hierarchy.
            </p>
            <p className="panel__empty">
              Scroll to zoom, drag to pan, click a node to inspect it.
            </p>
          </div>
        </aside>

        <main className="shell__main">
          <div className="graph" ref={containerRef} />
        </main>

        <aside className="panel panel--right">
          <div className="panel__header">
            <h2 className="panel__title">Inspector</h2>
            {selected ? <span className="tag">class</span> : null}
          </div>
          <div className="panel__body">
            {selected ? (
              <p className="mono">{selected}</p>
            ) : (
              <p className="panel__empty">Select a node to see its details.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
