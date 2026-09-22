import { Store as N3Store } from "n3";
import type * as RDF from "@rdfjs/types";
import { create } from "zustand";

import { SOURCE_COLORS } from "../graph/palette";
import { DEFAULT_FILTERS, type Filters, type Source } from "./types";

/**
 * The quad store lives outside React.
 *
 * `N3.Store` is mutable and indexed by subject, predicate, object and graph.
 * Holding it in React state would mean cloning quad arrays on every keystroke,
 * so instead every mutation goes through this module and bumps a revision
 * counter. Components re-render on the counter and memoise their derivations on
 * it. That single contract is what keeps the rest of the application small.
 */
const quads = new N3Store();

export function quadStore(): N3Store {
  return quads;
}

interface AppState {
  sources: Source[];
  activeSourceId: string | null;
  selectedIri: string | null;
  filters: Filters;
  /** Incremented by every mutation of the quad store. */
  revision: number;
  loadError: string | null;
}

export const useAppStore = create<AppState>(() => ({
  sources: [],
  activeSourceId: null,
  selectedIri: null,
  filters: DEFAULT_FILTERS,
  revision: 0,
  loadError: null,
}));

const bumpRevision = () => useAppStore.setState((state) => ({ revision: state.revision + 1 }));

let sourceCounter = 0;

export function nextSourceId(): string {
  sourceCounter += 1;
  return `urn:onto-view:source:${sourceCounter}`;
}

export function sourceColor(index: number): string {
  return SOURCE_COLORS[index % SOURCE_COLORS.length];
}

/** Adds a parsed document's quads and registers it as a source. */
export function addSource(source: Omit<Source, "color" | "visible">, parsed: RDF.Quad[]): void {
  quads.addQuads(parsed);
  useAppStore.setState((state) => ({
    sources: [
      ...state.sources,
      { ...source, color: sourceColor(state.sources.length), visible: true },
    ],
    // A freshly loaded source becomes the edit target, matching the usual
    // "open a file, then change it" order of work.
    activeSourceId: source.id,
    loadError: null,
  }));
  bumpRevision();
}

export function removeSource(id: string): void {
  quads.deleteGraph(id);
  useAppStore.setState((state) => {
    const sources = state.sources.filter((source) => source.id !== id);
    return {
      sources,
      activeSourceId:
        state.activeSourceId === id ? (sources.at(-1)?.id ?? null) : state.activeSourceId,
      selectedIri: null,
    };
  });
  bumpRevision();
}

export function setSourceVisible(id: string, visible: boolean): void {
  useAppStore.setState((state) => ({
    sources: state.sources.map((source) =>
      source.id === id ? { ...source, visible } : source,
    ),
  }));
}

export function setActiveSource(id: string): void {
  useAppStore.setState({ activeSourceId: id });
}

export function setSelectedIri(iri: string | null): void {
  useAppStore.setState({ selectedIri: iri });
}

export function setFilters(partial: Partial<Filters>): void {
  useAppStore.setState((state) => ({ filters: { ...state.filters, ...partial } }));
}

export function setLoadError(message: string | null): void {
  useAppStore.setState({ loadError: message });
}

/** Applies an edit. Stage 5 routes every mutation through here. */
export function applyEdit(change: { add?: RDF.Quad[]; remove?: RDF.Quad[] }): void {
  if (change.remove?.length) quads.removeQuads(change.remove);
  if (change.add?.length) quads.addQuads(change.add);
  bumpRevision();
}

/** Test and development helper: drops every source and quad. */
export function resetStore(): void {
  for (const graph of quads.getGraphs(null, null, null)) {
    quads.deleteGraph(graph as RDF.Quad_Graph);
  }
  sourceCounter = 0;
  useAppStore.setState({
    sources: [],
    activeSourceId: null,
    selectedIri: null,
    revision: 0,
    loadError: null,
  });
}
