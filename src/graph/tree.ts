import type cytoscape from "cytoscape";

/** One row of the tree, carrying exactly what the graph node carries. */
export interface TreeEntry {
  iri: string;
  label: string;
  curie: string;
  kind: string;
  color: string;
}

/**
 * A lazily-walkable index of the hierarchy, built from the very same elements
 * the canvas draws so that both views answer to one set of filters.
 *
 * It is an index rather than a materialised tree on purpose. A class hierarchy
 * is a DAG, not a tree: a term with three parents appears under each of them,
 * and materialising that eagerly multiplies out into millions of rows on a
 * merged ontology. Rendering walks `childrenOf` only for expanded rows, so the
 * cost is proportional to what is on screen.
 */
export interface TreeIndex {
  /** Entries with no visible parent, in display order. */
  roots: string[];
  /** Parent IRI to its children, in display order. */
  childrenOf: Map<string, string[]>;
  entries: Map<string, TreeEntry>;
}

export function buildTree(elements: readonly cytoscape.ElementDefinition[]): TreeIndex {
  const entries = new Map<string, TreeEntry>();
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const element of elements) {
    const data = element.data as Record<string, unknown>;
    if (data.source !== undefined) continue;
    const iri = String(data.id);
    entries.set(iri, {
      iri,
      label: String(data.label ?? iri),
      curie: String(data.curie ?? iri),
      kind: String(data.kind ?? "Unknown"),
      color: String(data.color ?? ""),
    });
  }

  for (const element of elements) {
    const data = element.data as Record<string, unknown>;
    // Hierarchy edges run from the specific term to the general one, so the
    // edge's target is the parent row and its source is the child.
    if (!data.hierarchy) continue;
    const child = String(data.source);
    const parent = String(data.target);
    if (child === parent) continue;
    if (!entries.has(child) || !entries.has(parent)) continue;

    const siblings = childrenOf.get(parent);
    if (siblings) {
      if (!siblings.includes(child)) siblings.push(child);
    } else {
      childrenOf.set(parent, [child]);
    }
    hasParent.add(child);
  }

  const roots = [...entries.keys()].filter((iri) => !hasParent.has(iri));
  const byLabel = (a: string, b: string) =>
    entries.get(a)!.label.localeCompare(entries.get(b)!.label);

  roots.sort(byLabel);
  for (const siblings of childrenOf.values()) siblings.sort(byLabel);

  return { roots, childrenOf, entries };
}

/**
 * Children of `iri` that are safe to draw beneath `ancestors`.
 *
 * Nothing forbids a cycle in `rdfs:subClassOf`, and one in the data would
 * otherwise make the tree infinitely deep, so an entry already on the path
 * from the root is dropped rather than repeated.
 */
export function childrenFor(
  tree: TreeIndex,
  iri: string,
  ancestors: ReadonlySet<string>,
): string[] {
  const children = tree.childrenOf.get(iri);
  if (!children) return [];
  return children.filter((child) => !ancestors.has(child));
}

/**
 * The shortest chain of parents from a root down to `iri`, or null when the
 * entry is not in the index. Used to reveal a row selected on the canvas: the
 * tree opens the branch it sits in rather than leaving the user to hunt.
 */
export function pathTo(tree: TreeIndex, iri: string): string[] | null {
  if (!tree.entries.has(iri)) return null;
  if (tree.roots.includes(iri)) return [iri];

  const parentOf = new Map<string, string>();
  const queue = [...tree.roots];
  const seen = new Set(queue);

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const child of tree.childrenOf.get(current) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      parentOf.set(child, current);
      if (child === iri) {
        const path = [child];
        for (let step = current; step !== undefined; step = parentOf.get(step)!) {
          path.unshift(step);
          if (!parentOf.has(step)) break;
        }
        return path;
      }
      queue.push(child);
    }
  }
  return null;
}
