import type cytoscape from "cytoscape";

import { displayName, iriToCurie } from "../rdf/terms";
import { DEFAULT_PREFIXES } from "../rdf/vocab";
import type { Filters, OntologyModel, Source } from "../model/types";

/**
 * Provenance state of a node, which selects one of exactly three colour rules
 * in the stylesheet:
 *
 * - `single`      declared by one source, filled in that source's colour
 * - `shared`      declared by several, neutral fill with the first source's border
 * - `undeclared`  referenced but never typed here, hollow with a dashed border
 *
 * The third case is the common one when a file references an imported ontology
 * whose own definitions have not been loaded.
 */
export type NodeState = "single" | "shared" | "undeclared";

const HIERARCHY_KINDS = new Set(["subClassOf", "subPropertyOf"]);

/**
 * Above this many elements a node-link view stops being readable: labels
 * collapse into bands and the graph reads as texture rather than structure.
 *
 * Measured rather than guessed. The Common Core Ontologies merged file yields
 * 1,701 nodes and 1,888 edges of named classes alone — already well past
 * legible, with no annotation assertions or blank nodes included. So the
 * threshold sits low, and crossing it surfaces a banner rather than silently
 * rendering a hairball.
 */
export const READABLE_ELEMENT_LIMIT = 600;

export function toElements(
  model: OntologyModel,
  sources: readonly Source[],
  filters: Filters,
): cytoscape.ElementDefinition[] {
  const colorBySource = new Map(sources.map((source) => [source.id, source.color]));
  const prefixes = Object.assign(
    {},
    DEFAULT_PREFIXES,
    ...sources.map((source) => source.prefixes),
  ) as Record<string, string>;

  const keep = (kind: string) => {
    if (filters.classesOnly) return kind === "Class";
    if (filters.hideIndividuals && kind === "Individual") return false;
    return true;
  };

  const nodes: cytoscape.ElementDefinition[] = [];
  const included = new Set<string>();

  for (const entity of model.entities.values()) {
    if (!keep(entity.kind)) continue;
    // An ontology header is metadata about the document, not a term in it.
    if (entity.kind === "Ontology") continue;
    included.add(entity.iri);

    const declaredCount = entity.declaredIn.length;
    const state: NodeState =
      declaredCount === 0 ? "undeclared" : declaredCount === 1 ? "single" : "shared";
    const owner = entity.declaredIn[0] ?? entity.mentionedIn[0];

    nodes.push({
      data: {
        id: entity.iri,
        label: displayName(entity.iri, entity.label),
        curie: iriToCurie(entity.iri, prefixes),
        kind: entity.kind,
        state,
        color: colorBySource.get(owner ?? "") ?? "#5c6470",
      },
    });
  }

  const edges: cytoscape.ElementDefinition[] = [];
  const seen = new Set<string>();

  for (const rel of model.rels) {
    if (filters.hideTypeEdges && rel.kind === "type") continue;
    if (!included.has(rel.from) || !included.has(rel.to)) continue;
    // The same axiom asserted by two sources is one edge on screen.
    const id = `${rel.kind}|${rel.from}|${rel.to}`;
    if (seen.has(id)) continue;
    seen.add(id);

    edges.push({
      data: {
        id,
        source: rel.from,
        target: rel.to,
        label: relLabel(rel.kind),
        kind: rel.kind,
        hierarchy: HIERARCHY_KINDS.has(rel.kind),
        color: colorBySource.get(rel.sourceId) ?? "#c9c9c6",
      },
    });
  }

  return [...nodes, ...edges];
}

function relLabel(kind: string): string {
  switch (kind) {
    case "subClassOf":
      return "rdfs:subClassOf";
    case "subPropertyOf":
      return "rdfs:subPropertyOf";
    case "domain":
      return "rdfs:domain";
    case "range":
      return "rdfs:range";
    case "imports":
      return "owl:imports";
    default:
      return "rdf:type";
  }
}
