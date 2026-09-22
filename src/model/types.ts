import type { Format } from "../rdf/parse";

/** One loaded document. Its `id` is also the graph term of every quad it contributed. */
export interface Source {
  id: string;
  name: string;
  color: string;
  format: Format;
  quadCount: number;
  visible: boolean;
  prefixes: Record<string, string>;
  warnings: string[];
}

export type EntityKind =
  | "Class"
  | "ObjectProperty"
  | "DatatypeProperty"
  | "AnnotationProperty"
  | "Property"
  | "Individual"
  | "Ontology"
  | "Unknown";

export interface Entity {
  iri: string;
  kind: EntityKind;
  label?: string;
  comment?: string;
  /** Source ids that assert an `rdf:type` for this IRI. */
  declaredIn: string[];
  /** Source ids that reference this IRI at all. */
  mentionedIn: string[];
}

export type RelKind = "subClassOf" | "subPropertyOf" | "domain" | "range" | "type" | "imports";

export interface Rel {
  id: string;
  from: string;
  to: string;
  kind: RelKind;
  sourceId: string;
}

export interface OntologyModel {
  entities: Map<string, Entity>;
  rels: Rel[];
}

export interface Filters {
  hideIndividuals: boolean;
  hideTypeEdges: boolean;
  classesOnly: boolean;
}

export const DEFAULT_FILTERS: Filters = {
  hideIndividuals: true,
  hideTypeEdges: true,
  classesOnly: false,
};
