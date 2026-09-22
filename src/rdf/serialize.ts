import { DataFactory, Writer as N3Writer } from "n3";
import type * as RDF from "@rdfjs/types";

import { writeRdfXml } from "./rdfxmlWriter";
import { iriToCurie } from "./terms";
import { DEFAULT_PREFIXES } from "./vocab";

const { quad: makeQuad, defaultGraph } = DataFactory;

export type WriteFormat = "turtle" | "ntriples" | "nquads" | "jsonld" | "rdfxml";

export const WRITE_FORMAT_LABELS: Record<WriteFormat, string> = {
  turtle: "Turtle",
  ntriples: "N-Triples",
  nquads: "N-Quads",
  jsonld: "JSON-LD",
  rdfxml: "RDF/XML (best effort)",
};

export const WRITE_FORMAT_EXTENSIONS: Record<WriteFormat, string> = {
  turtle: "ttl",
  ntriples: "nt",
  nquads: "nq",
  jsonld: "jsonld",
  rdfxml: "rdf",
};

const N3_FORMATS: Partial<Record<WriteFormat, string>> = {
  turtle: "Turtle",
  ntriples: "N-Triples",
  nquads: "N-Quads",
};

/**
 * Provenance is carried by each quad's graph term, which is an internal source
 * id and has no business in an exported document. Dropping it also keeps N3
 * from deciding the data is quads and emitting TriG when Turtle was asked for.
 *
 * N-Quads is the exception: asking for it is asking to keep the graph column,
 * so those quads pass through untouched.
 */
function stripGraph(quads: readonly RDF.Quad[], format: WriteFormat): RDF.Quad[] {
  if (format === "nquads") return [...quads];
  return quads.map((q) => makeQuad(q.subject, q.predicate, q.object, defaultGraph()));
}

/**
 * Keeps only the prefixes a document actually uses. N3's writer emits every
 * prefix it is handed, so passing the built-in set unfiltered would top each
 * export with declarations for FOAF, OBO and BFO that never appear in it.
 */
function usedPrefixes(
  quads: readonly RDF.Quad[],
  prefixes: Record<string, string>,
): Record<string, string> {
  const iris = new Set<string>();
  for (const quad of quads) {
    for (const term of [quad.subject, quad.predicate, quad.object]) {
      if (term.termType === "NamedNode") iris.add(term.value);
      else if (term.termType === "Literal" && term.datatype) iris.add(term.datatype.value);
    }
  }
  const used: Record<string, string> = {};
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    for (const iri of iris) {
      if (iri.startsWith(namespace)) {
        used[prefix] = namespace;
        break;
      }
    }
  }
  return used;
}

/**
 * Triples an RDF/XML export cannot express, so the UI can say how many before
 * the user commits to the format.
 */
export function rdfXmlLosses(
  quads: readonly RDF.Quad[],
  prefixes: Record<string, string> = {},
): number {
  const prepared = stripGraph(quads, "rdfxml");
  return writeRdfXml(prepared, usedPrefixes(prepared, { ...DEFAULT_PREFIXES, ...prefixes }))
    .skipped.length;
}

export async function serialize(
  quads: readonly RDF.Quad[],
  format: WriteFormat,
  prefixes: Record<string, string> = {},
): Promise<string> {
  const prepared = stripGraph(quads, format);
  const context = usedPrefixes(prepared, { ...DEFAULT_PREFIXES, ...prefixes });
  if (format === "jsonld") return writeJsonLd(prepared, context);
  if (format === "rdfxml") return writeRdfXml(prepared, context).xml;

  // Constructing a Writer with no output stream makes it buffer internally and
  // hand back the whole document through end().
  const writer = new N3Writer({
    format: N3_FORMATS[format],
    // N-Triples and N-Quads have no prefix syntax, so offering prefixes there
    // would be ignored at best.
    prefixes: format === "turtle" ? context : undefined,
  });
  writer.addQuads(prepared as RDF.Quad[]);

  return new Promise((resolve, reject) => {
    writer.end((error: Error | null, result: string) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/**
 * A small JSON-LD writer.
 *
 * The established libraries are rejected on size: digitalbazaar `jsonld` is
 * 2.1 MB unpacked and `rdf-serialize` drags in the whole Comunica actor stack.
 * Compacted node objects with a context covers what this application produces,
 * in far less code than either dependency costs.
 */
function writeJsonLd(quads: readonly RDF.Quad[], context: Record<string, string>): string {
  const bySubject = new Map<string, Record<string, unknown>>();

  const shorten = (iri: string) => iriToCurie(iri, context);

  for (const quad of quads) {
    const subject =
      quad.subject.termType === "BlankNode" ? `_:${quad.subject.value}` : quad.subject.value;

    let node = bySubject.get(subject);
    if (!node) bySubject.set(subject, (node = { "@id": shorten(subject) }));

    const key = quad.predicate.value === RDF_TYPE ? "@type" : shorten(quad.predicate.value);
    const value = objectToJson(quad.object, shorten, key === "@type");

    const existing = node[key];
    if (existing === undefined) node[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else node[key] = [existing, value];
  }

  return `${JSON.stringify({ "@context": context, "@graph": [...bySubject.values()] }, null, 2)}\n`;
}

function objectToJson(
  term: RDF.Term,
  shorten: (iri: string) => string,
  isType: boolean,
): unknown {
  if (term.termType === "NamedNode") {
    return isType ? shorten(term.value) : { "@id": shorten(term.value) };
  }
  if (term.termType === "BlankNode") return { "@id": `_:${term.value}` };
  if (term.termType === "Literal") {
    if (term.language) return { "@value": term.value, "@language": term.language };
    // xsd:string is the default for a plain literal, so stating it adds noise.
    if (term.datatype && term.datatype.value !== "http://www.w3.org/2001/XMLSchema#string") {
      return { "@value": term.value, "@type": shorten(term.datatype.value) };
    }
    return term.value;
  }
  return term.value;
}
