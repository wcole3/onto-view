import { FileDrop } from "./FileDrop";
import { IconGraph, IconLayout, IconSearch, IconTree, IconUndo } from "./icons";
import { setFilters, setView, undoEdit, useAppStore } from "../model/store";
import type { LayoutName } from "../graph/useCytoscape";

const LAYOUTS: LayoutName[] = ["breadthfirst", "cose", "concentric", "grid"];
/**
 * Depth limits offered by the Levels filter. The default is "all": a depth is
 * a way out of a hairball, not something to impose up front. Ten covers real
 * hierarchies — BFO bottoms out around six levels and CCO around nine — so the
 * list stops where a deeper limit would be indistinguishable from all.
 */
const ROOT_DEPTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface ToolbarProps {
  layout: LayoutName;
  onLayout: (layout: LayoutName) => void;
  onRelayout: () => void;
}

export function Toolbar({ layout, onLayout, onRelayout }: ToolbarProps) {
  const filters = useAppStore((state) => state.filters);
  const hasSources = useAppStore((state) => state.sources.length > 0);
  // Layout only means something on the canvas; the tree lays itself out.
  const isGraph = useAppStore((state) => state.view === "graph");

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <IconGraph />
        <span>onto-view</span>
      </div>

      <label className="search">
        <IconSearch />
        <input
          className="search__input"
          type="search"
          placeholder="Search labels and IRIs"
          aria-label="Search labels and IRIs"
          value={filters.search}
          disabled={!hasSources}
          onChange={(event) =>
            // Searching and focusing are alternative scopes, so starting a
            // search clears the focus rather than compounding with it.
            setFilters({ search: event.target.value, focusIri: null })
          }
        />
      </label>

      <div className="toolbar__spacer" />

      <div className="toolbar__group">
        <ViewToggle />

        <label className="field">
          <span className="field__label">Levels</span>
          <select
            className="button"
            aria-label="Levels from the hierarchy roots"
            value={filters.rootDepth ?? "all"}
            disabled={!hasSources}
            onChange={(event) =>
              setFilters({
                rootDepth: event.target.value === "all" ? null : Number(event.target.value),
                focusIri: null,
              })
            }
          >
            <option value="all">all</option>
            {ROOT_DEPTHS.map((depth) => (
              <option key={depth} value={depth}>
                {depth}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <IconLayout />
          <select
            className="button"
            aria-label="Graph layout"
            value={layout}
            disabled={!isGraph}
            onChange={(event) => onLayout(event.target.value as LayoutName)}
          >
            {LAYOUTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button className="button" type="button" onClick={onRelayout} disabled={!hasSources || !isGraph}>
          Re-layout
        </button>

        <UndoButton />

        <FileDrop variant="button" />
      </div>
    </header>
  );
}

/**
 * Graph or tree. The two are renderings of one filtered subgraph rather than
 * two modes, so this switches what the main pane draws and nothing else.
 */
function ViewToggle() {
  const view = useAppStore((state) => state.view);

  return (
    <div className="segmented" role="group" aria-label="View">
      <button
        className="button"
        type="button"
        aria-pressed={view === "graph"}
        onClick={() => setView("graph")}
      >
        <IconGraph />
        Graph
      </button>
      <button
        className="button"
        type="button"
        aria-pressed={view === "tree"}
        onClick={() => setView("tree")}
      >
        <IconTree />
        Tree
      </button>
    </div>
  );
}

function UndoButton() {
  const history = useAppStore((state) => state.history);
  const last = history.at(-1);

  return (
    <button
      className="button"
      type="button"
      onClick={undoEdit}
      disabled={!last}
      title={last ? last.description : "Nothing to undo"}
    >
      <IconUndo />
      Undo
      {history.length > 1 ? <span className="tag">{history.length}</span> : null}
    </button>
  );
}

/** Kind filters, shown under the source list rather than crowding the toolbar. */
export function FilterControls() {
  const filters = useAppStore((state) => state.filters);

  return (
    <div className="checks">
      <label className="check">
        <input
          type="checkbox"
          checked={filters.classesOnly}
          onChange={(event) => setFilters({ classesOnly: event.target.checked })}
        />
        Classes only
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={filters.hideIndividuals}
          disabled={filters.classesOnly}
          onChange={(event) => setFilters({ hideIndividuals: event.target.checked })}
        />
        Hide individuals
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={filters.hideTypeEdges}
          onChange={(event) => setFilters({ hideTypeEdges: event.target.checked })}
        />
        Hide rdf:type edges
      </label>
    </div>
  );
}
