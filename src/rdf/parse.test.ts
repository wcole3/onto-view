import { describe, expect, it } from "vitest";

import { parseDocument, sniffFormat } from "./parse";

const TURTLE = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix pizza: <http://example.org/pizza#> .
pizza:Pizza a owl:Class .`;

const RDFXML = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#">
  <owl:Class rdf:about="http://example.org/pizza#Pizza"/>
</rdf:RDF>`;

const JSONLD = JSON.stringify({
  "@context": { rdfs: "http://www.w3.org/2000/01/rdf-schema#" },
  "@id": "http://example.org/pizza#Pizza",
  "rdfs:label": "Pizza",
});

describe("sniffFormat", () => {
  it("trusts the extension first", () => {
    expect(sniffFormat("cco.owl", "")).toBe("rdfxml");
    expect(sniffFormat("pizza.ttl", "")).toBe("turtle");
    expect(sniffFormat("doc.jsonld", "")).toBe("jsonld");
    expect(sniffFormat("data.nq", "")).toBe("nquads");
  });

  it("falls back to the content for an unknown extension", () => {
    expect(sniffFormat("download", '<?xml version="1.0"?>')).toBe("rdfxml");
    expect(sniffFormat("download", "{}")).toBe("jsonld");
    expect(sniffFormat("download", "@prefix a: <x> .")).toBe("turtle");
  });
});

const NQUADS = `<http://x/A> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> <urn:onto-view:source:1> .
<http://x/B> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> <urn:onto-view:source:2> .
<http://x/C> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .`;

describe("parseDocument", () => {
  it("tags every quad with the source id as its graph term", async () => {
    const { quads } = await parseDocument(TURTLE, "turtle", "urn:test:1");
    expect(quads).toHaveLength(1);
    expect(quads[0].graph.value).toBe("urn:test:1");
  });

  it("reports the document's own prefixes", async () => {
    const { prefixes } = await parseDocument(TURTLE, "turtle", "urn:test:1");
    expect(prefixes.pizza).toBe("http://example.org/pizza#");
  });

  it("parses RDF/XML and tags it", async () => {
    const { quads } = await parseDocument(RDFXML, "rdfxml", "urn:test:2");
    expect(quads).toHaveLength(1);
    expect(quads[0].graph.value).toBe("urn:test:2");
    expect(quads[0].subject.value).toBe("http://example.org/pizza#Pizza");
  });

  it("parses JSON-LD with a local context and tags it", async () => {
    const { quads } = await parseDocument(JSONLD, "jsonld", "urn:test:3");
    expect(quads).toHaveLength(1);
    expect(quads[0].graph.value).toBe("urn:test:3");
    expect(quads[0].object.value).toBe("Pizza");
  });

  it("rejects malformed input rather than returning nothing", async () => {
    await expect(parseDocument("this is not turtle {{{", "turtle", "urn:test:4")).rejects.toThrow();
  });
});

describe("parseDocument with keepGraph", () => {
  // The autosave snapshot is N-Quads written from the store, so its graph
  // terms are a whole session's source ids. Retagging them would merge every
  // source into whichever id the restore happened to pass.
  it("keeps the graph terms a snapshot already carries", async () => {
    const { quads } = await parseDocument(NQUADS, "nquads", "urn:onto-view:source:1", {
      keepGraph: true,
    });
    expect(quads.map((q) => q.graph.value)).toEqual([
      "urn:onto-view:source:1",
      "urn:onto-view:source:2",
      // A quad written without a graph still falls back to the source id.
      "urn:onto-view:source:1",
    ]);
  });

  it("retags everything without the option, as a loaded file should be", async () => {
    const { quads } = await parseDocument(NQUADS, "nquads", "urn:onto-view:source:9");
    expect(new Set(quads.map((q) => q.graph.value))).toEqual(new Set(["urn:onto-view:source:9"]));
  });
});
