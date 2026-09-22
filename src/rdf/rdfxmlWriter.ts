import type * as RDF from "@rdfjs/types";

import { RDF_NS } from "./vocab";

/**
 * A best-effort RDF/XML writer.
 *
 * No RDF/XML serialiser exists for JavaScript. `rdfxml-streaming-writer` and
 * `rdf-serialize-rdfxml` do not exist; `rdf-serialize` handles JSON-LD, N3 and
 * SHACLC only; and N3's writer emits Turtle or TriG and nothing else. So this
 * is hand-written, and deliberately covers one shape:
 *
 * - `rdf:Description` per subject, in the striped form
 * - `rdf:resource` for IRI objects, `rdf:nodeID` for blank nodes
 * - `rdf:datatype` or `xml:lang` for literals
 *
 * It does not emit RDF collections, reification, or `rdf:parseType`. Everything
 * it writes is valid RDF/XML and reparses to the same triples, but it is not
 * the compact idiomatic form a dedicated tool would produce.
 *
 * The genuinely fiddly part is that every predicate IRI must become an XML
 * qualified name. A predicate whose local part is not a valid NCName cannot be
 * expressed at all, so those triples are reported rather than written as
 * invalid XML.
 */
export interface RdfXmlResult {
  xml: string;
  /** Triples that could not be expressed, with the reason. */
  skipped: Array<{ predicate: string; reason: string }>;
}

/** XML NCName, simplified to the ASCII range that predicate locals use. */
const NCNAME = /^[A-Za-z_][A-Za-z0-9._-]*$/;

export function writeRdfXml(
  quads: readonly RDF.Quad[],
  prefixes: Record<string, string> = {},
): RdfXmlResult {
  const namespaces = new Map<string, string>([["rdf", RDF_NS]]);
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (prefix && namespace !== RDF_NS) namespaces.set(prefix, namespace);
  }

  const skipped: RdfXmlResult["skipped"] = [];
  const bySubject = new Map<string, RDF.Quad[]>();
  let minted = 0;

  /** Splits a predicate IRI into a namespace and an NCName local part. */
  const qname = (iri: string): string | null => {
    const cut = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
    if (cut < 0 || cut === iri.length - 1) return null;
    const namespace = iri.slice(0, cut + 1);
    const local = iri.slice(cut + 1);
    if (!NCNAME.test(local)) return null;

    let prefix = [...namespaces].find(([, value]) => value === namespace)?.[0];
    if (!prefix) {
      prefix = `ns${minted++}`;
      namespaces.set(prefix, namespace);
    }
    return `${prefix}:${local}`;
  };

  // Group first, so a subject with only unwritable predicates produces no
  // empty rdf:Description.
  for (const quad of quads) {
    if (qname(quad.predicate.value) === null) {
      skipped.push({
        predicate: quad.predicate.value,
        reason: "no XML qualified name can be formed from this IRI",
      });
      continue;
    }
    const key = subjectKey(quad.subject);
    const group = bySubject.get(key);
    if (group) group.push(quad);
    else bySubject.set(key, [quad]);
  }

  const body: string[] = [];
  for (const group of bySubject.values()) {
    const subject = group[0].subject;
    const attribute =
      subject.termType === "BlankNode"
        ? `rdf:nodeID="${escapeAttribute(subject.value)}"`
        : `rdf:about="${escapeAttribute(subject.value)}"`;

    body.push(`  <rdf:Description ${attribute}>`);
    for (const quad of group) {
      body.push(`    ${property(qname(quad.predicate.value)!, quad.object)}`);
    }
    body.push(`  </rdf:Description>`);
  }

  const declarations = [...namespaces]
    .map(([prefix, namespace]) => `         xmlns:${prefix}="${escapeAttribute(namespace)}"`)
    .join("\n")
    .replace(/^\s+/, "");

  const xml = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<rdf:RDF ${declarations}>`,
    ...body,
    `</rdf:RDF>`,
    ``,
  ].join("\n");

  return { xml, skipped };
}

function property(name: string, object: RDF.Term): string {
  if (object.termType === "NamedNode") {
    return `<${name} rdf:resource="${escapeAttribute(object.value)}"/>`;
  }
  if (object.termType === "BlankNode") {
    return `<${name} rdf:nodeID="${escapeAttribute(object.value)}"/>`;
  }
  if (object.termType === "Literal") {
    const qualifier = object.language
      ? ` xml:lang="${escapeAttribute(object.language)}"`
      : object.datatype && object.datatype.value !== `${XSD}string`
        ? ` rdf:datatype="${escapeAttribute(object.datatype.value)}"`
        : "";
    return `<${name}${qualifier}>${escapeText(object.value)}</${name}>`;
  }
  return `<${name}>${escapeText(object.value)}</${name}>`;
}

const XSD = "http://www.w3.org/2001/XMLSchema#";

function subjectKey(term: RDF.Term): string {
  return term.termType === "BlankNode" ? `_:${term.value}` : term.value;
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
