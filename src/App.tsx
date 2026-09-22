import { useMemo } from "react";

import { FileDrop, useWindowDrop } from "./ui/FileDrop";
import { IconGraph, IconLayout } from "./ui/icons";
import { buildModel } from "./model/ontology";
import { quadStore, setLoadError, setSelectedIri, useAppStore } from "./model/store";
import { READABLE_ELEMENT_LIMIT, toElements } from "./graph/elements";
import { useCytoscape, type LayoutName } from "./graph/useCytoscape";
import { displayName, iriToCurie } from "./rdf/terms";
import { FORMAT_LABELS } from "./rdf/parse";
import { DEFAULT_PREFIXES } from "./rdf/vocab";

const LAYOUTS: LayoutName[] = ["breadthfirst", "cose", "concentric", "grid"];

export default function App() {
  const sources = useAppStore((state) => state.sources);
  const revision = useAppStore((state) => state.revision);
  const filters = useAppStore((state) => state.filters);
  const selectedIri = useAppStore((state) => state.selectedIri);
  const loadError = useAppStore((state) => state.loadError);
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

  const elements = useMemo(() => toElements(model, sources, filters), [model, sources, filters]);

  const { containerRef, runLayout, layout, setLayout } = useCytoscape({
    elements,
    onSelect: setSelectedIri,
  });

  const tooDense = elements.length > READABLE_ELEMENT_LIMIT;
  const selected = selectedIri ? model.entities.get(selectedIri) : undefined;
  // Built-in prefixes underneath, each document's own prefixes over the top.
  // The RDF/XML parser emits no prefix events, so without the defaults an
  // OBO-style IRI would have no compact form to show at all.
  const prefixes = useMemo(
    () =>
      Object.assign(
        {},
        DEFAULT_PREFIXES,
        ...sources.map((source) => source.prefixes),
      ) as Record<string, string>,
    [sources],
  );
  const hasSources = sources.length > 0;

  return (
    <div
      className={`shell${drop.over ? " shell--dropping" : ""}`}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
    >
      <header className="toolbar">
        <div className="toolbar__brand">
          <IconGraph />
          <span>onto-view</span>
        </div>

        <div className="toolbar__spacer" />

        <div className="toolbar__group">
          <IconLayout />
          <select
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
          <FileDrop variant="button" />
        </div>
      </header>

      <div className="shell__body">
        <aside className="panel panel--left">
          <div className="panel__header">
            <h2 className="panel__title">Sources</h2>
            {hasSources ? <span className="tag">{sources.length}</span> : null}
          </div>
          <div className="panel__body">
            {hasSources ? (
              <ul className="sources">
                {sources.map((source) => (
                  <li className="sources__item" key={source.id}>
                    <span
                      className="sources__swatch"
                      style={{ background: source.color }}
                      aria-hidden
                    />
                    <span className="sources__name" title={source.name}>
                      {source.name}
                    </span>
                    <span className="sources__meta mono">
                      {FORMAT_LABELS[source.format]} · {source.quadCount}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel__empty">
                No files loaded. Drop one anywhere, or use Load file.
              </p>
            )}
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
          ) : tooDense ? (
            <div className="banner banner--warning">
              <span>
                {elements.length.toLocaleString()} elements on screen. Past
                roughly {READABLE_ELEMENT_LIMIT} a node-link view reads as
                texture rather than structure — hide a source to narrow it.
                Search and hierarchy filters arrive in stage 4.
              </span>
            </div>
          ) : null}
        </main>

        <aside className="panel panel--right">
          <div className="panel__header">
            <h2 className="panel__title">Inspector</h2>
            {selected ? <span className="tag">{selected.kind}</span> : null}
          </div>
          <div className="panel__body">
            {selected ? (
              <dl className="details">
                <dt>Name</dt>
                <dd>{displayName(selected.iri, selected.label)}</dd>

                <dt>IRI</dt>
                <dd className="mono details__iri">{selected.iri}</dd>

                <dt>Compact</dt>
                <dd className="mono">{iriToCurie(selected.iri, prefixes)}</dd>

                {selected.comment ? (
                  <>
                    <dt>Comment</dt>
                    <dd>{selected.comment}</dd>
                  </>
                ) : null}

                <dt>Declared in</dt>
                <dd>
                  {selected.declaredIn.length === 0 ? (
                    <span className="panel__empty">
                      Referenced but not declared in anything loaded.
                    </span>
                  ) : (
                    <span className="chips">
                      {selected.declaredIn.map((id) => {
                        const source = sources.find((candidate) => candidate.id === id);
                        return (
                          <span className="chip" key={id}>
                            <span
                              className="sources__swatch"
                              style={{ background: source?.color }}
                              aria-hidden
                            />
                            {source?.name ?? id}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </dd>
              </dl>
            ) : (
              <p className="panel__empty">Select a node to see its details.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
