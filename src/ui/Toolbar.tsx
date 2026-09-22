import { FileDrop } from "./FileDrop";
import { IconGraph, IconLayout, IconSearch, IconUndo } from "./icons";
import { setFilters, undoEdit, useAppStore } from "../model/store";
import type { LayoutName } from "../graph/useCytoscape";

const LAYOUTS: LayoutName[] = ["breadthfirst", "cose", "concentric", "grid"];
const ROOT_DEPTHS = [1, 2, 3, 4] as const;

interface ToolbarProps {
  layout: LayoutName;
  onLayout: (layout: LayoutName) => void;
  onRelayout: () => void;
}

export function Toolbar({ layout, onLayout, onRelayout }: ToolbarProps) {
  const filters = useAppStore((state) => state.filters);
  const hasSources = useAppStore((state) => state.sources.length > 0);

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
            onChange={(event) => onLayout(event.target.value as LayoutName)}
          >
            {LAYOUTS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button className="button" type="button" onClick={onRelayout} disabled={!hasSources}>
          Re-layout
        </button>

        <UndoButton />

        <FileDrop variant="button" />
      </div>
    </header>
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
