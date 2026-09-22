import type { Entity, Filters, OntologyModel, Rel, Scope } from "../model/types";

/**
 * Chooses which entities to draw.
 *
 * A real ontology defeats "draw everything": the merged Common Core Ontologies
 * produce 1,701 named classes, which renders as texture rather than structure.
 * So the visible set is narrowed by one of three scopes, in priority order —
 * an explicit focus, a search, or a depth limit from the hierarchy roots — and
 * the UI reports which one is in force and how much it hid.
 */
export function selectScope(
  entities: ReadonlyMap<string, Entity>,
  rels: readonly Rel[],
  filters: Filters,
): Scope {
  const adjacency = buildAdjacency(entities, rels);

  if (filters.focusIri && entities.has(filters.focusIri)) {
    const keep = expand(adjacency, [filters.focusIri], filters.focusDepth);
    return { kind: "focus", keep, hidden: entities.size - keep.size };
  }

  const query = filters.search.trim().toLowerCase();
  if (query) {
    const matches = [...entities.values()]
      .filter(
        (entity) =>
          (entity.label ?? "").toLowerCase().includes(query) ||
          entity.iri.toLowerCase().includes(query),
      )
      .map((entity) => entity.iri);
    // One hop of context, so a match is not shown floating on its own.
    const keep = expand(adjacency, matches, 1);
    return { kind: "search", keep, hidden: entities.size - keep.size };
  }

  if (filters.rootDepth !== null) {
    const keep = expand(adjacency, hierarchyRoots(entities, rels), filters.rootDepth, "down");
    return { kind: "rootDepth", keep, hidden: entities.size - keep.size };
  }

  return { kind: "all", keep: null, hidden: 0 };
}

interface Adjacency {
  /** Both directions, for neighbourhood expansion. */
  any: Map<string, Set<string>>;
  /** Subject to object along the hierarchy, for descending from a root. */
  down: Map<string, Set<string>>;
}

function buildAdjacency(
  entities: ReadonlyMap<string, Entity>,
  rels: readonly Rel[],
): Adjacency {
  const any = new Map<string, Set<string>>();
  const down = new Map<string, Set<string>>();
  const link = (map: Map<string, Set<string>>, from: string, to: string) => {
    let set = map.get(from);
    if (!set) map.set(from, (set = new Set()));
    set.add(to);
  };

  for (const rel of rels) {
    if (!entities.has(rel.from) || !entities.has(rel.to)) continue;
    link(any, rel.from, rel.to);
    link(any, rel.to, rel.from);
    // Hierarchy edges point from the specific term to the general one, so
    // descending from a root means following them backwards.
    if (rel.kind === "subClassOf" || rel.kind === "subPropertyOf") {
      link(down, rel.to, rel.from);
    }
  }
  return { any, down };
}

/** Entities that nothing more general sits above: the tops of the hierarchy. */
export function hierarchyRoots(
  entities: ReadonlyMap<string, Entity>,
  rels: readonly Rel[],
): string[] {
  const hasParent = new Set<string>();
  for (const rel of rels) {
    if (rel.kind === "subClassOf" || rel.kind === "subPropertyOf") hasParent.add(rel.from);
  }
  return [...entities.keys()].filter((iri) => !hasParent.has(iri));
}

function expand(
  adjacency: Adjacency,
  seeds: readonly string[],
  depth: number,
  direction: "any" | "down" = "any",
): Set<string> {
  const map = direction === "down" ? adjacency.down : adjacency.any;
  const keep = new Set(seeds);
  let frontier = [...seeds];
  for (let hop = 0; hop < depth; hop += 1) {
    const next: string[] = [];
    for (const iri of frontier) {
      for (const neighbour of map.get(iri) ?? []) {
        if (keep.has(neighbour)) continue;
        keep.add(neighbour);
        next.push(neighbour);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return keep;
}

/** The relationships touching one entity, grouped for the inspector. */
export function neighboursOf(model: OntologyModel, iri: string) {
  const parents: Rel[] = [];
  const children: Rel[] = [];
  const related: Rel[] = [];

  for (const rel of model.rels) {
    const hierarchy = rel.kind === "subClassOf" || rel.kind === "subPropertyOf";
    if (rel.from === iri) {
      (hierarchy ? parents : related).push(rel);
    } else if (rel.to === iri) {
      (hierarchy ? children : related).push(rel);
    }
  }
  return { parents, children, related };
}
