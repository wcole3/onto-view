import { Store as N3Store } from "n3";
import type * as RDF from "@rdfjs/types";
import { create } from "zustand";

import { SOURCE_COLORS } from "../graph/palette";
import { affectedGraphs, invert, type EditResult } from "./edits";
import { DEFAULT_FILTERS, type Filters, type Source, type ViewName } from "./types";

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
  /** Which rendering of the filtered subgraph the main pane shows. */
  view: ViewName;
  /** Incremented by every mutation of the quad store. */
  revision: number;
  loadError: string | null;
  /** Applied edits, most recent last. Undo pops from the end. */
  history: EditResult[];
  /** Outcome of the last edit, shown briefly in the inspector. */
  lastEdit: string | null;
}

export const useAppStore = create<AppState>(() => ({
  sources: [],
  activeSourceId: null,
  selectedIri: null,
  filters: DEFAULT_FILTERS,
  view: "graph",
  revision: 0,
  loadError: null,
  history: [],
  lastEdit: null,
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

/**
 * Reinstates a saved session. Source ids, colours and visibility come back
 * unchanged, because the ids are the graph terms the restored quads carry.
 */
export function restoreSources(sources: Source[], parsed: RDF.Quad[]): void {
  quads.addQuads(parsed);
  // Keep minting ids above anything restored, so a newly loaded file cannot
  // collide with a restored source's graph.
  sourceCounter = Math.max(
    sourceCounter,
    ...sources.map((source) => Number(source.id.split(":").pop()) || 0),
  );
  useAppStore.setState({
    sources,
    activeSourceId: sources.at(-1)?.id ?? null,
    loadError: null,
  });
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

export function setView(view: ViewName): void {
  useAppStore.setState({ view });
}

export function setLoadError(message: string | null): void {
  useAppStore.setState({ loadError: message });
}

/**
 * Applies an edit and records it for undo.
 *
 * Removals run before additions so that replacing a value — which removes the
 * old statement and adds a new one for the same subject and predicate — cannot
 * remove what it just wrote.
 */
export function applyEdit(edit: EditResult, { record = true } = {}): void {
  if (edit.remove.length === 0 && edit.add.length === 0) return;

  quads.removeQuads(edit.remove);
  quads.addQuads(edit.add);

  const touched = affectedGraphs(edit);
  useAppStore.setState((state) => ({
    history: record ? [...state.history, edit] : state.history,
    lastEdit: summarise(edit, touched, state.sources),
    // A source's triple count is part of what the panel shows, so it has to
    // follow the edit rather than stay at its load-time value.
    sources: state.sources.map((source) => ({
      ...source,
      quadCount: touched.includes(source.id)
        ? quads.countQuads(null, null, null, source.id)
        : source.quadCount,
    })),
  }));
  bumpRevision();
}

/** Reverses the most recent edit. */
export function undoEdit(): void {
  const { history } = useAppStore.getState();
  const last = history.at(-1);
  if (!last) return;
  useAppStore.setState({ history: history.slice(0, -1) });
  applyEdit(invert(last), { record: false });
}

export function clearLastEdit(): void {
  useAppStore.setState({ lastEdit: null });
}

function summarise(edit: EditResult, touched: string[], sources: Source[]): string {
  const names = touched
    .map((id) => sources.find((source) => source.id === id)?.name ?? id)
    .join(", ");
  return names ? `${edit.description} in ${names}` : edit.description;
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
    view: "graph",
    revision: 0,
    loadError: null,
    history: [],
    lastEdit: null,
  });
}
