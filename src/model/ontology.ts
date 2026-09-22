import type { Store as N3Store } from "n3";
import type * as RDF from "@rdfjs/types";

import { pickLiteral } from "../rdf/terms";
import { COMMENT_PREDICATES, LABEL_PREDICATES, owl, rdf, rdfs } from "../rdf/vocab";
import type { Entity, EntityKind, OntologyModel, Rel, RelKind } from "./types";

/** `rdf:type` objects that declare what kind of thing an IRI is. */
const KIND_BY_TYPE: Array<[RDF.NamedNode, EntityKind]> = [
  [owl.Class, "Class"],
  [rdfs.Class, "Class"],
  [owl.ObjectProperty, "ObjectProperty"],
  [owl.DatatypeProperty, "DatatypeProperty"],
  [owl.AnnotationProperty, "AnnotationProperty"],
  [rdf.Property, "Property"],
  [owl.NamedIndividual, "Individual"],
  [owl.Ontology, "Ontology"],
];

/** Predicates projected as graph edges, in the order they are collected. */
const REL_PREDICATES: Array<[RDF.NamedNode, RelKind]> = [
  [rdfs.subClassOf, "subClassOf"],
  [rdfs.subPropertyOf, "subPropertyOf"],
  [rdfs.domain, "domain"],
  [rdfs.range, "range"],
  [owl.imports, "imports"],
];

/**
 * A more specific declaration wins when an IRI carries several types, which is
 * common: OWL files routinely type a property as both `owl:ObjectProperty` and
 * `rdf:Property`, and individuals as both `owl:NamedIndividual` and their class.
 */
const KIND_PRECEDENCE: EntityKind[] = [
  "Class",
  "ObjectProperty",
  "DatatypeProperty",
  "AnnotationProperty",
  "Property",
  "Ontology",
  "Individual",
  "Unknown",
];

function moreSpecific(a: EntityKind, b: EntityKind): EntityKind {
  return KIND_PRECEDENCE.indexOf(a) <= KIND_PRECEDENCE.indexOf(b) ? a : b;
}

/**
 * Projects the quad store into the model the UI renders.
 *
 * Rebuilt wholesale on every revision. At a few thousand entities this is a
 * handful of milliseconds because every pass is an indexed lookup, and it
 * avoids the dependency tracking that incremental invalidation would need —
 * which is where the subtle bugs in a derived model live.
 *
 * Blank nodes are skipped. They carry OWL class expressions and RDF list
 * plumbing, which produce an unreadable hairball in a node-link view; the
 * structures that reference them stay visible, but the anonymous interior does
 * not become nodes.
 */
export function buildModel(store: N3Store, visibleSourceIds: ReadonlySet<string>): OntologyModel {
  const entities = new Map<string, Entity>();
  const rels: Rel[] = [];

  const visible = (quad: RDF.Quad) => visibleSourceIds.has(quad.graph.value);

  const touch = (iri: string): Entity => {
    let entity = entities.get(iri);
    if (!entity) {
      entity = { iri, kind: "Unknown", declaredIn: [], mentionedIn: [] };
      entities.set(iri, entity);
    }
    return entity;
  };

  const mention = (iri: string, sourceId: string) => {
    const entity = touch(iri);
    if (!entity.mentionedIn.includes(sourceId)) entity.mentionedIn.push(sourceId);
    return entity;
  };

  // Pass 1: type declarations.
  for (const [type, kind] of KIND_BY_TYPE) {
    for (const quad of store.getQuads(null, rdf.type, type, null)) {
      if (!visible(quad) || quad.subject.termType !== "NamedNode") continue;
      const entity = mention(quad.subject.value, quad.graph.value);
      entity.kind = moreSpecific(entity.kind, kind);
      if (!entity.declaredIn.includes(quad.graph.value)) {
        entity.declaredIn.push(quad.graph.value);
      }
    }
  }

  // Pass 2: relationships.
  for (const [predicate, kind] of REL_PREDICATES) {
    for (const quad of store.getQuads(null, predicate, null, null)) {
      if (!visible(quad)) continue;
      if (quad.subject.termType !== "NamedNode" || quad.object.termType !== "NamedNode") continue;
      const from = mention(quad.subject.value, quad.graph.value).iri;
      const to = mention(quad.object.value, quad.graph.value).iri;
      rels.push({
        id: `${kind}|${from}|${to}|${quad.graph.value}`,
        from,
        to,
        kind,
        sourceId: quad.graph.value,
      });
    }
  }

  // Pass 3: `rdf:type` edges to classes, for individuals.
  for (const quad of store.getQuads(null, rdf.type, null, null)) {
    if (!visible(quad)) continue;
    if (quad.subject.termType !== "NamedNode" || quad.object.termType !== "NamedNode") continue;
    if (KIND_BY_TYPE.some(([type]) => type.value === quad.object.value)) continue;
    const from = mention(quad.subject.value, quad.graph.value).iri;
    const to = mention(quad.object.value, quad.graph.value).iri;
    if (entities.get(from)?.kind === "Unknown") {
      entities.get(from)!.kind = "Individual";
    }
    rels.push({
      id: `type|${from}|${to}|${quad.graph.value}`,
      from,
      to,
      kind: "type",
      sourceId: quad.graph.value,
    });
  }

  // Pass 4: display labels and comments.
  assignLiterals(store, entities, visible, LABEL_PREDICATES, "label");
  assignLiterals(store, entities, visible, COMMENT_PREDICATES, "comment");

  return { entities, rels };
}

function assignLiterals(
  store: N3Store,
  entities: Map<string, Entity>,
  visible: (quad: RDF.Quad) => boolean,
  predicates: readonly RDF.NamedNode[],
  field: "label" | "comment",
): void {
  // Predicates are in preference order, so the first one that yields a literal
  // for an entity wins and later passes leave it alone.
  for (const predicate of predicates) {
    const collected = new Map<string, RDF.Literal[]>();
    for (const quad of store.getQuads(null, predicate, null, null)) {
      if (!visible(quad) || quad.object.termType !== "Literal") continue;
      if (quad.subject.termType !== "NamedNode") continue;
      const entity = entities.get(quad.subject.value);
      if (!entity || entity[field] !== undefined) continue;
      const list = collected.get(quad.subject.value) ?? [];
      list.push(quad.object);
      collected.set(quad.subject.value, list);
    }
    for (const [iri, literals] of collected) {
      const value = pickLiteral(literals);
      if (value) entities.get(iri)![field] = value;
    }
  }
}
