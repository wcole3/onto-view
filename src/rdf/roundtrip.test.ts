import { describe, expect, it } from "vitest";
import type * as RDF from "@rdfjs/types";

import { parseDocument, type Format } from "./parse";
import { serialize, type WriteFormat } from "./serialize";
import { termKey } from "./terms";

const DOC = `@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix p:     <http://example.org/pizza#> .

p:Pizza a owl:Class ;
    rdfs:label "Pizza" ;
    rdfs:label "Pizza"@en ;
    rdfs:label "Pizza"@it ;
    rdfs:comment "A flat bread base with toppings, baked." .

p:Margherita a owl:Class ;
    rdfs:subClassOf p:Pizza ;
    rdfs:label "Margherita" .

p:priceInPence a owl:DatatypeProperty ;
    rdfs:domain p:Pizza ;
    rdfs:range xsd:integer .

p:aMargherita a owl:NamedIndividual, p:Margherita ;
    p:priceInPence "895"^^xsd:integer .`;

/**
 * A quad set is compared by the sorted keys of its terms. Blank-node labels are
 * not stable across a serialize/reparse cycle, so a blank node contributes its
 * position rather than its identity.
 */
function signature(quads: readonly RDF.Quad[]): string[] {
  return quads
    .map((quad) =>
      [quad.subject, quad.predicate, quad.object]
        .map((term) => (term.termType === "BlankNode" ? "_:blank" : termKey(term)))
        .join(" "),
    )
    .sort();
}

const CASES: Array<{ write: WriteFormat; read: Format }> = [
  { write: "turtle", read: "turtle" },
  { write: "ntriples", read: "ntriples" },
  { write: "nquads", read: "nquads" },
  { write: "jsonld", read: "jsonld" },
];

describe("round trip", () => {
  it.each(CASES)("survives $write", async ({ write, read }) => {
    const original = await parseDocument(DOC, "turtle", "urn:test:1");
    const text = await serialize(original.quads, write, original.prefixes);
    const reparsed = await parseDocument(text, read, "urn:test:2");

    expect(signature(reparsed.quads)).toEqual(signature(original.quads));
  });

  it("preserves language tags and datatypes through Turtle", async () => {
    const original = await parseDocument(DOC, "turtle", "urn:test:1");
    const text = await serialize(original.quads, "turtle", original.prefixes);

    expect(text).toContain('"Pizza"@it');
    expect(text).toContain("xsd:integer");
  });

  it("drops the provenance graph term for every format but N-Quads", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:secret");

    for (const format of ["turtle", "ntriples", "jsonld"] as const) {
      const text = await serialize(quads, format, prefixes);
      expect(text, format).not.toContain("urn:test:secret");
    }
    // Asking for N-Quads is asking to keep the graph column.
    expect(await serialize(quads, "nquads", prefixes)).toContain("urn:test:secret");
  });

  it("writes Turtle rather than TriG even though the quads carry a graph", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:1");
    const text = await serialize(quads, "turtle", prefixes);

    // TriG wraps statements in a graph block; Turtle must not.
    expect(text).not.toMatch(/\{/);
    expect(text).toContain("@prefix");
  });

  it("emits a usable context in JSON-LD", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:1");
    const parsed = JSON.parse(await serialize(quads, "jsonld", prefixes)) as {
      "@context": Record<string, string>;
      "@graph": Array<Record<string, unknown>>;
    };

    expect(parsed["@context"].p).toBe("http://example.org/pizza#");
    expect(parsed["@graph"].length).toBe(4);
    const pizza = parsed["@graph"].find((node) => node["@id"] === "p:Pizza");
    expect(pizza?.["@type"]).toBe("owl:Class");
  });
});

describe("prefix hygiene", () => {
  it("declares only the prefixes the document uses", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:1");
    const text = await serialize(quads, "turtle", prefixes);

    expect(text).toContain("@prefix owl:");
    expect(text).toContain("@prefix p:");
    // Built-in prefixes that this document never touches.
    expect(text).not.toContain("@prefix foaf:");
    expect(text).not.toContain("@prefix obo:");
    expect(text).not.toContain("@prefix skos:");
  });

  it("keeps a prefix that is only used by a literal's datatype", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:1");
    const text = await serialize(quads, "turtle", prefixes);
    expect(text).toContain("@prefix xsd:");
  });
});
