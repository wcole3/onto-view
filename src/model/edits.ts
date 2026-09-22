import { DataFactory } from "n3";
import type { Store as N3Store } from "n3";
import type * as RDF from "@rdfjs/types";

import { owl, rdf, rdfs } from "../rdf/vocab";
import type { EntityKind, RelKind } from "./types";

const { namedNode, literal, quad: makeQuad } = DataFactory;

/**
 * Every edit is a pure function from the current store to a set of quads to add
 * and remove. Nothing here touches the store, which makes each operation
 * trivially invertible — swapping `add` and `remove` is a complete undo — and
 * testable without a running application.
 *
 * Two rules, applied consistently:
 *
 * - **Additions** go into the active source's graph, so each source stays
 *   independently exportable and "the file I edited" stays meaningful.
 * - **Removals and renames** act wherever the statements actually are. A
 *   rename confined to one source would leave stale references behind in the
 *   others, which corrupts the graph rather than editing it. The UI reports
 *   which sources an edit touched.
 */
export interface EditResult {
  add: RDF.Quad[];
  remove: RDF.Quad[];
  /** Human-readable summary, shown after the edit and in the undo control. */
  description: string;
}

export const NO_EDIT: EditResult = { add: [], remove: [], description: "" };

const TYPE_BY_KIND: Partial<Record<EntityKind, RDF.NamedNode>> = {
  Class: owl.Class,
  ObjectProperty: owl.ObjectProperty,
  DatatypeProperty: owl.DatatypeProperty,
  AnnotationProperty: owl.AnnotationProperty,
  Property: rdf.Property,
  Individual: owl.NamedIndividual,
};

const PREDICATE_BY_REL: Record<RelKind, RDF.NamedNode> = {
  subClassOf: rdfs.subClassOf,
  subPropertyOf: rdfs.subPropertyOf,
  domain: rdfs.domain,
  range: rdfs.range,
  type: rdf.type,
  imports: owl.imports,
};

/** Replaces every value of a single-valued annotation, across all sources. */
export function setAnnotation(
  store: N3Store,
  iri: string,
  predicate: RDF.NamedNode,
  value: string,
  graph: string,
  label = "annotation",
): EditResult {
  const subject = namedNode(iri);
  const remove = store.getQuads(subject, predicate, null, null) as unknown as RDF.Quad[];
  const trimmed = value.trim();
  const add = trimmed
    ? [makeQuad(subject, predicate, literal(trimmed), namedNode(graph))]
    : [];

  return {
    add,
    remove,
    description: trimmed ? `Set ${label}` : `Cleared ${label}`,
  };
}

export function setLabel(store: N3Store, iri: string, value: string, graph: string): EditResult {
  return setAnnotation(store, iri, rdfs.label, value, graph, "label");
}

export function setComment(store: N3Store, iri: string, value: string, graph: string): EditResult {
  return setAnnotation(store, iri, rdfs.comment, value, graph, "comment");
}

/** Declares a new entity. Fails loudly rather than silently merging. */
export function createEntity(
  store: N3Store,
  iri: string,
  kind: EntityKind,
  label: string,
  graph: string,
): EditResult {
  const type = TYPE_BY_KIND[kind];
  if (!type) throw new Error(`${kind} cannot be declared directly.`);
  if (!isAbsoluteIri(iri)) throw new Error(`"${iri}" is not an absolute IRI.`);
  if (store.getQuads(namedNode(iri), rdf.type, null, null).length > 0) {
    throw new Error(`${iri} is already declared.`);
  }

  const subject = namedNode(iri);
  const target = namedNode(graph);
  const add = [makeQuad(subject, rdf.type, type, target)];
  if (label.trim()) add.push(makeQuad(subject, rdfs.label, literal(label.trim()), target));

  return { add, remove: [], description: `Created ${kind} ${iri}` };
}

/**
 * Changes an entity's IRI everywhere it appears, as subject or as object,
 * preserving each statement's original graph so provenance is not rewritten
 * along with the identifier.
 */
export function renameEntity(store: N3Store, from: string, to: string): EditResult {
  if (!isAbsoluteIri(to)) throw new Error(`"${to}" is not an absolute IRI.`);
  if (from === to) return NO_EDIT;
  if (store.getQuads(namedNode(to), null, null, null).length > 0) {
    throw new Error(`${to} is already in use.`);
  }

  const before = namedNode(from);
  const after = namedNode(to);
  const remove = [
    ...(store.getQuads(before, null, null, null) as unknown as RDF.Quad[]),
    ...(store.getQuads(null, null, before, null) as unknown as RDF.Quad[]),
  ];
  const add = remove.map((quad) =>
    makeQuad(
      quad.subject.equals(before) ? after : quad.subject,
      quad.predicate,
      quad.object.equals(before) ? after : quad.object,
      quad.graph,
    ),
  );

  return { add, remove, description: `Renamed to ${to}` };
}

/**
 * Removes an entity and every statement about it or pointing at it. Leaving
 * the inbound references would turn them into dangling pointers, which reads
 * as corruption rather than deletion.
 */
export function deleteEntity(store: N3Store, iri: string): EditResult {
  const term = namedNode(iri);
  const remove = dedupeQuads([
    ...(store.getQuads(term, null, null, null) as unknown as RDF.Quad[]),
    ...(store.getQuads(null, null, term, null) as unknown as RDF.Quad[]),
  ]);
  return { add: [], remove, description: `Deleted ${iri} and ${remove.length} statements` };
}

export function addRelation(
  from: string,
  to: string,
  kind: RelKind,
  graph: string,
): EditResult {
  if (!isAbsoluteIri(to)) throw new Error(`"${to}" is not an absolute IRI.`);
  if (from === to) throw new Error("An entity cannot be related to itself.");

  return {
    add: [
      makeQuad(namedNode(from), PREDICATE_BY_REL[kind], namedNode(to), namedNode(graph)),
    ],
    remove: [],
    description: `Added ${kind}`,
  };
}

export function removeRelation(
  store: N3Store,
  from: string,
  to: string,
  kind: RelKind,
): EditResult {
  const remove = store.getQuads(
    namedNode(from),
    PREDICATE_BY_REL[kind],
    namedNode(to),
    null,
  ) as unknown as RDF.Quad[];
  return { add: [], remove, description: `Removed ${kind}` };
}

/** Inverts an edit. Undo is exactly this, which is why edits stay pure. */
export function invert(edit: EditResult): EditResult {
  return {
    add: edit.remove,
    remove: edit.add,
    description: `Undo: ${edit.description}`,
  };
}

/** Which sources an edit touched, so the UI can say so. */
export function affectedGraphs(edit: EditResult): string[] {
  const graphs = new Set<string>();
  for (const quad of [...edit.add, ...edit.remove]) {
    if (quad.graph.value) graphs.add(quad.graph.value);
  }
  return [...graphs];
}

function isAbsoluteIri(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(value.trim());
}

function dedupeQuads(quads: RDF.Quad[]): RDF.Quad[] {
  const seen = new Set<string>();
  const out: RDF.Quad[] = [];
  for (const quad of quads) {
    const key = [quad.subject.value, quad.predicate.value, quad.object.value, quad.graph.value].join(
      "\u0000",
    );
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(quad);
  }
  return out;
}
