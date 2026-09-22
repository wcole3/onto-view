import { useEffect, useMemo, useState } from "react";
import type cytoscape from "cytoscape";

import { IconChevron } from "./icons";
import { buildTree, childrenFor, pathTo, type TreeIndex } from "../graph/tree";
import { setSelectedIri, useAppStore } from "../model/store";

/**
 * Rows above this are not expanded by "Expand all". Expanding a merged
 * ontology in full is both useless to read and slow to draw, and because the
 * hierarchy is a DAG a multi-parent term repeats under each parent, so the
 * count grows faster than the entity count suggests.
 */
const EXPAND_ALL_LIMIT = 2000;

/** A branch is identified by its whole path, since a term can sit under several parents. */
function keyOf(ancestors: readonly string[], iri: string): string {
  return [...ancestors, iri].join(">");
}

interface TreeViewProps {
  elements: readonly cytoscape.ElementDefinition[];
}

/**
 * The hierarchy as an outline, over exactly the elements the canvas is drawing.
 * Both views therefore answer to one set of filters: narrowing the search or
 * the levels narrows this too, with no second filtering path to keep in step.
 */
export function TreeView({ elements }: TreeViewProps) {
  const selectedIri = useAppStore((state) => state.selectedIri);
  const tree = useMemo(() => buildTree(elements), [elements]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  // Reveal whatever the inspector is showing, so a node picked on the canvas
  // is findable here rather than buried in a collapsed branch.
  useEffect(() => {
    if (!selectedIri) return;
    const path = pathTo(tree, selectedIri);
    if (!path) return;
    setExpanded((current) => {
      const next = new Set(current);
      // Every ancestor, but not the entry itself: revealing a row should not
      // also unfold its children.
      for (let depth = 1; depth < path.length; depth += 1) {
        next.add(keyOf(path.slice(0, depth - 1), path[depth - 1]));
      }
      return next;
    });
  }, [selectedIri, tree]);

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  if (tree.entries.size === 0) {
    return (
      <div className="tree">
        <p className="panel__empty">Nothing to show. Load a source, or widen the filters.</p>
      </div>
    );
  }

  return (
    <div className="tree">
      <div className="tree__header">
        <span className="tree__count">
          {tree.entries.size.toLocaleString()} entities · {tree.roots.length.toLocaleString()} roots
        </span>
        <div className="tree__actions">
          <button
            className="button"
            type="button"
            onClick={() => setExpanded(expandAll(tree))}
          >
            Expand all
          </button>
          <button className="button" type="button" onClick={() => setExpanded(new Set())}>
            Collapse all
          </button>
        </div>
      </div>

      <ul className="tree__list" role="tree" aria-label="Class hierarchy">
        <Branch
          tree={tree}
          iris={tree.roots}
          ancestors={[]}
          expanded={expanded}
          onToggle={toggle}
          selectedIri={selectedIri}
        />
      </ul>
    </div>
  );
}

interface BranchProps {
  tree: TreeIndex;
  iris: readonly string[];
  ancestors: readonly string[];
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  selectedIri: string | null;
}

/**
 * Children are resolved during render rather than materialised up front, so a
 * collapsed branch of a large ontology costs nothing.
 */
function Branch({ tree, iris, ancestors, expanded, onToggle, selectedIri }: BranchProps) {
  const ancestorSet = useMemo(() => new Set(ancestors), [ancestors]);

  return (
    <>
      {iris.map((iri) => {
        const entry = tree.entries.get(iri)!;
        const key = keyOf(ancestors, iri);
        const children = childrenFor(tree, iri, ancestorSet);
        const open = expanded.has(key);

        return (
          <li key={key} role="treeitem" aria-expanded={children.length ? open : undefined}>
            <div
              className={`tree__row${selectedIri === iri ? " tree__row--selected" : ""}`}
              style={{ paddingLeft: `calc(${ancestors.length} * var(--space-4))` }}
            >
              {children.length ? (
                <button
                  className="tree__toggle"
                  type="button"
                  aria-label={`${open ? "Collapse" : "Expand"} ${entry.label}`}
                  aria-expanded={open}
                  onClick={() => onToggle(key)}
                >
                  <IconChevron open={open} />
                </button>
              ) : (
                <span className="tree__toggle tree__toggle--leaf" aria-hidden />
              )}

              <button
                className="tree__label"
                type="button"
                // The compact IRI beside the name is a visual aid; leaving it
                // in the accessible name would make every row read as two.
                aria-label={entry.label}
                title={entry.iri}
                onClick={() => setSelectedIri(iri)}
              >
                <span className="tree__swatch" style={{ background: entry.color }} aria-hidden />
                <span className="tree__name">{entry.label}</span>
                <span className="tree__curie mono">{entry.curie}</span>
              </button>

              {children.length ? <span className="tag">{children.length}</span> : null}
            </div>

            {open && children.length ? (
              <ul role="group">
                <Branch
                  tree={tree}
                  iris={children}
                  ancestors={[...ancestors, iri]}
                  expanded={expanded}
                  onToggle={onToggle}
                  selectedIri={selectedIri}
                />
              </ul>
            ) : null}
          </li>
        );
      })}
    </>
  );
}

/** Every branch key, walked breadth-first and stopped at EXPAND_ALL_LIMIT rows. */
function expandAll(tree: TreeIndex): Set<string> {
  const keys = new Set<string>();
  const queue: { iri: string; ancestors: string[] }[] = tree.roots.map((iri) => ({
    iri,
    ancestors: [],
  }));

  for (let head = 0; head < queue.length && keys.size < EXPAND_ALL_LIMIT; head += 1) {
    const { iri, ancestors } = queue[head];
    const children = childrenFor(tree, iri, new Set(ancestors));
    if (children.length === 0) continue;
    keys.add(keyOf(ancestors, iri));
    for (const child of children) queue.push({ iri: child, ancestors: [...ancestors, iri] });
  }
  return keys;
}
