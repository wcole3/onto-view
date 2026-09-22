import { DataFactory } from "n3";

const { namedNode } = DataFactory;

export const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
export const OWL_NS = "http://www.w3.org/2002/07/owl#";
export const SKOS_NS = "http://www.w3.org/2004/02/skos/core#";
export const XSD_NS = "http://www.w3.org/2001/XMLSchema#";
export const DCTERMS_NS = "http://purl.org/dc/terms/";

export const rdf = {
  type: namedNode(`${RDF_NS}type`),
  Property: namedNode(`${RDF_NS}Property`),
  first: namedNode(`${RDF_NS}first`),
  rest: namedNode(`${RDF_NS}rest`),
  nil: namedNode(`${RDF_NS}nil`),
};

export const rdfs = {
  Class: namedNode(`${RDFS_NS}Class`),
  subClassOf: namedNode(`${RDFS_NS}subClassOf`),
  subPropertyOf: namedNode(`${RDFS_NS}subPropertyOf`),
  domain: namedNode(`${RDFS_NS}domain`),
  range: namedNode(`${RDFS_NS}range`),
  label: namedNode(`${RDFS_NS}label`),
  comment: namedNode(`${RDFS_NS}comment`),
  isDefinedBy: namedNode(`${RDFS_NS}isDefinedBy`),
};

export const owl = {
  Ontology: namedNode(`${OWL_NS}Ontology`),
  Class: namedNode(`${OWL_NS}Class`),
  ObjectProperty: namedNode(`${OWL_NS}ObjectProperty`),
  DatatypeProperty: namedNode(`${OWL_NS}DatatypeProperty`),
  AnnotationProperty: namedNode(`${OWL_NS}AnnotationProperty`),
  NamedIndividual: namedNode(`${OWL_NS}NamedIndividual`),
  Restriction: namedNode(`${OWL_NS}Restriction`),
  imports: namedNode(`${OWL_NS}imports`),
  equivalentClass: namedNode(`${OWL_NS}equivalentClass`),
  disjointWith: namedNode(`${OWL_NS}disjointWith`),
  inverseOf: namedNode(`${OWL_NS}inverseOf`),
  onProperty: namedNode(`${OWL_NS}onProperty`),
};

export const skos = {
  prefLabel: namedNode(`${SKOS_NS}prefLabel`),
  altLabel: namedNode(`${SKOS_NS}altLabel`),
  definition: namedNode(`${SKOS_NS}definition`),
};

export const dcterms = {
  title: namedNode(`${DCTERMS_NS}title`),
  description: namedNode(`${DCTERMS_NS}description`),
};

/**
 * Prefixes offered to the serializer and used to shorten IRIs for display.
 * A loaded file's own prefixes are merged over these.
 */
export const DEFAULT_PREFIXES: Record<string, string> = {
  rdf: RDF_NS,
  rdfs: RDFS_NS,
  owl: OWL_NS,
  skos: SKOS_NS,
  xsd: XSD_NS,
  dcterms: DCTERMS_NS,
  foaf: "http://xmlns.com/foaf/0.1/",
  obo: "http://purl.obolibrary.org/obo/",
  bfo: "http://purl.obolibrary.org/obo/bfo.owl#",
};

/**
 * Predicates preferred for a human-readable display name, most preferred
 * first. `skos:prefLabel` is included because the Common Core Ontologies and
 * much of OBO rely on it alongside `rdfs:label`.
 */
export const LABEL_PREDICATES = [rdfs.label, skos.prefLabel, dcterms.title];

/** Predicates preferred for a description, most preferred first. */
export const COMMENT_PREDICATES = [rdfs.comment, skos.definition, dcterms.description];
