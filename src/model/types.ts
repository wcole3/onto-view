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
  /** Case-insensitive substring match against label and IRI. */
  search: string;
  /** When set, show only this entity's neighbourhood. */
  focusIri: string | null;
  /** Hops from the focus entity, following relationships in either direction. */
  focusDepth: number;
  /** When set, show only this many levels down from the hierarchy roots. */
  rootDepth: number | null;
}

export const DEFAULT_FILTERS: Filters = {
  hideIndividuals: true,
  hideTypeEdges: true,
  classesOnly: false,
  search: "",
  focusIri: null,
  focusDepth: 2,
  rootDepth: null,
};

/** How the visible subgraph was chosen, so the UI can say so. */
export type ScopeKind = "all" | "search" | "focus" | "rootDepth";

export interface Scope {
  kind: ScopeKind;
  /** Entities kept, or null for "everything that passed the kind filters". */
  keep: Set<string> | null;
  /** Entities dropped by the scope, for reporting. */
  hidden: number;
}
