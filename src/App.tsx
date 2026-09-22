import { useEffect, useMemo } from "react";

import { FileDrop, useWindowDrop } from "./ui/FileDrop";
import { FilterControls, Toolbar } from "./ui/Toolbar";
import { SourceList } from "./ui/SourceList";
import { Export } from "./ui/Export";
import { NewEntity } from "./ui/NewEntity";
import { Autosave } from "./ui/Autosave";
import { Inspector } from "./ui/Inspector";
import { buildModel } from "./model/ontology";
import {
  clearLastEdit,
  quadStore,
  setFilters,
  setLoadError,
  setSelectedIri,
  useAppStore,
} from "./model/store";
import { project, READABLE_ELEMENT_LIMIT } from "./graph/elements";
import { useCytoscape } from "./graph/useCytoscape";

export default function App() {
  const sources = useAppStore((state) => state.sources);
  const revision = useAppStore((state) => state.revision);
  const filters = useAppStore((state) => state.filters);
  const selectedIri = useAppStore((state) => state.selectedIri);
  const loadError = useAppStore((state) => state.loadError);
  const lastEdit = useAppStore((state) => state.lastEdit);
  const drop = useWindowDrop();

  const visibleSourceIds = useMemo(
    () => new Set(sources.filter((source) => source.visible).map((source) => source.id)),
    [sources],
  );

  // Rebuilt wholesale whenever the quad store changes. See model/ontology.ts.
  const model = useMemo(
    () => buildModel(quadStore(), visibleSourceIds),
    // revision is the mutation signal for the store, which lives outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, visibleSourceIds],
  );

  const { elements, scope, candidateCount } = useMemo(
    () => project(model, sources, filters),
    [model, sources, filters],
  );

  const { containerRef, runLayout, layout, setLayout, focusOn } = useCytoscape({
    elements,
    onSelect: setSelectedIri,
  });

  // Centre the graph on whatever the inspector is showing, so navigating by
  // neighbour list moves the canvas too.
  useEffect(() => {
    if (selectedIri) focusOn(selectedIri);
  }, [selectedIri, focusOn]);

  const hasSources = sources.length > 0;
  const overLimit = elements.length > READABLE_ELEMENT_LIMIT;

  return (
    <div
      className={`shell${drop.over ? " shell--dropping" : ""}`}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
    >
      <Toolbar
        layout={layout}
        onLayout={(next) => {
          setLayout(next);
          runLayout(next);
        }}
        onRelayout={() => runLayout()}
      />

      <div className="shell__body">
        <aside className="panel panel--left">
          <div className="panel__header">
            <h2 className="panel__title">Sources</h2>
            {hasSources ? <span className="tag">{sources.length}</span> : null}
          </div>
          <div className="panel__body">
            <SourceList />
            {hasSources ? <NewEntity /> : null}
            {hasSources ? <FilterControls /> : null}
            {hasSources ? <Export /> : null}
            <Autosave />
          </div>
        </aside>

        <main className="shell__main">
          <div className="graph" ref={containerRef} />
          {hasSources ? null : <FileDrop variant="zone" />}

          {loadError ? (
            <div className="banner banner--error" role="alert">
              <span>{loadError}</span>
              <button className="button" type="button" onClick={() => setLoadError(null)}>
                Dismiss
              </button>
            </div>
          ) : lastEdit ? (
            <div className="banner banner--success" role="status">
              <span>{lastEdit}</span>
              <button className="button" type="button" onClick={clearLastEdit}>
                Dismiss
              </button>
            </div>
          ) : scope.kind !== "all" ? (
            <div className="banner">
              <span>
                {scopeSummary(scope.kind)} · showing{" "}
                {(candidateCount - scope.hidden).toLocaleString()} of{" "}
                {candidateCount.toLocaleString()} entities
              </span>
              <button
                className="button"
                type="button"
                onClick={() => setFilters({ focusIri: null, search: "", rootDepth: null })}
              >
                Show all
              </button>
            </div>
          ) : overLimit ? (
            <div className="banner banner--warning">
              <span>
                {elements.length.toLocaleString()} elements. Past roughly{" "}
                {READABLE_ELEMENT_LIMIT} a node-link view reads as texture rather
                than structure — search, focus on an entity, or limit the levels.
              </span>
              <button className="button" type="button" onClick={() => setFilters({ rootDepth: 2 })}>
                Top 2 levels
              </button>
            </div>
          ) : null}
        </main>

        <aside className="panel panel--right">
          <div className="panel__header">
            <h2 className="panel__title">Inspector</h2>
            {selectedIri ? (
              <span className="tag">{model.entities.get(selectedIri)?.kind ?? "unknown"}</span>
            ) : null}
          </div>
          <div className="panel__body">
            <Inspector model={model} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function scopeSummary(kind: string): string {
  switch (kind) {
    case "focus":
      return "Focused on one entity and its neighbourhood";
    case "search":
      return "Search matches and their immediate neighbours";
    default:
      return "Limited to the top levels of the hierarchy";
  }
}
