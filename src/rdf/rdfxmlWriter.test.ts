import { describe, expect, it } from "vitest";
import { DataFactory } from "n3";

import { parseDocument } from "./parse";
import { serialize } from "./serialize";
import { writeRdfXml } from "./rdfxmlWriter";
import { termKey } from "./terms";

const { namedNode, literal, blankNode, quad } = DataFactory;

const DOC = `@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix p:     <http://example.org/pizza#> .

p:Pizza a owl:Class ;
    rdfs:label "Pizza" ;
    rdfs:label "Pizza"@it ;
    rdfs:comment "Tomato & <cheese>, \\"baked\\"." .

p:Margherita a owl:Class ; rdfs:subClassOf p:Pizza .
p:priceInPence a owl:DatatypeProperty ; rdfs:range xsd:integer .
p:aMargherita a p:Margherita ; p:priceInPence "895"^^xsd:integer .`;

describe("writeRdfXml", () => {
  it("round trips through the RDF/XML parser", async () => {
    const original = await parseDocument(DOC, "turtle", "urn:test:1");
    const xml = await serialize(original.quads, "rdfxml", original.prefixes);
    const reparsed = await parseDocument(xml, "rdfxml", "urn:test:2");

    const signature = (quads: readonly import("@rdfjs/types").Quad[]) =>
      quads
        .map((q) => [q.subject, q.predicate, q.object].map((t) => termKey(t)).join(" "))
        .sort();

    expect(signature(reparsed.quads)).toEqual(signature(original.quads));
  });

  it("escapes markup and quotes in literals", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:1");
    const xml = await serialize(quads, "rdfxml", prefixes);
    expect(xml).toContain("Tomato &amp; &lt;cheese&gt;");
    expect(xml).not.toMatch(/<cheese>/);
  });

  it("keeps language tags and datatypes", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:1");
    const xml = await serialize(quads, "rdfxml", prefixes);
    expect(xml).toContain('xml:lang="it"');
    expect(xml).toContain('rdf:datatype="http://www.w3.org/2001/XMLSchema#integer"');
  });

  it("uses rdf:nodeID for blank nodes on both ends", () => {
    const { xml } = writeRdfXml([
      quad(blankNode("b0"), namedNode("http://example.org/p#q"), blankNode("b1")),
    ]);
    expect(xml).toContain('rdf:nodeID="b0"');
    expect(xml).toContain('rdf:nodeID="b1"');
  });

  it("mints a prefix for a namespace it was not given", () => {
    const { xml, skipped } = writeRdfXml([
      quad(namedNode("http://a/s"), namedNode("http://unknown.example/vocab#p"), literal("v")),
    ]);
    expect(skipped).toHaveLength(0);
    expect(xml).toContain('xmlns:ns0="http://unknown.example/vocab#"');
    expect(xml).toContain("<ns0:p>v</ns0:p>");
  });

  it("reports a predicate that cannot become an XML name instead of writing invalid XML", () => {
    const { xml, skipped } = writeRdfXml([
      // A local part starting with a digit is not a valid NCName.
      quad(namedNode("http://a/s"), namedNode("http://a/vocab#9bad"), literal("v")),
    ]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].predicate).toBe("http://a/vocab#9bad");
    expect(xml).not.toContain("9bad");
  });

  it("produces no empty description for a subject whose only predicate was skipped", () => {
    const { xml } = writeRdfXml([
      quad(namedNode("http://a/s"), namedNode("http://a/vocab#9bad"), literal("v")),
    ]);
    expect(xml).not.toContain("rdf:Description");
  });

  it("drops the provenance graph term", async () => {
    const { quads, prefixes } = await parseDocument(DOC, "turtle", "urn:test:secret");
    const xml = await serialize(quads, "rdfxml", prefixes);
    expect(xml).not.toContain("urn:test:secret");
  });
});
