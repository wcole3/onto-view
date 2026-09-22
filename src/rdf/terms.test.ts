import { describe, expect, it } from "vitest";
import { DataFactory } from "n3";

import { displayName, iriToCurie, localName, pickLiteral, termKey } from "./terms";

const { literal } = DataFactory;

describe("localName", () => {
  it("splits on a hash", () => {
    expect(localName("http://example.org/pizza#Margherita")).toBe("Margherita");
  });

  it("splits on the last slash", () => {
    expect(localName("http://purl.obolibrary.org/obo/BFO_0000004")).toBe("BFO_0000004");
  });

  it("returns the input when there is nothing to split on", () => {
    expect(localName("Margherita")).toBe("Margherita");
  });

  it("does not mistake a URI scheme colon for a separator", () => {
    expect(localName("http://example.org/pizza#")).toBe("http://example.org/pizza#");
  });

  it("splits a CURIE on its colon", () => {
    expect(localName("pizza:Margherita")).toBe("Margherita");
  });
});

describe("iriToCurie", () => {
  it("uses a known prefix", () => {
    expect(iriToCurie("http://www.w3.org/2000/01/rdf-schema#label")).toBe("rdfs:label");
  });

  it("prefers the longest matching namespace", () => {
    const prefixes = {
      obo: "http://purl.obolibrary.org/obo/",
      bfo: "http://purl.obolibrary.org/obo/bfo.owl#",
    };
    expect(iriToCurie("http://purl.obolibrary.org/obo/bfo.owl#Entity", prefixes)).toBe(
      "bfo:Entity",
    );
  });

  it("returns the IRI unchanged when nothing matches", () => {
    expect(iriToCurie("http://example.org/x#Y", {})).toBe("http://example.org/x#Y");
  });
});

describe("displayName", () => {
  it("prefers an asserted label", () => {
    expect(displayName("http://example.org/p#M", "Margherita")).toBe("Margherita");
  });

  it("falls back to the local name for an opaque IRI", () => {
    expect(displayName("http://purl.obolibrary.org/obo/BFO_0000004")).toBe("BFO_0000004");
  });

  it("treats a whitespace-only label as absent", () => {
    expect(displayName("http://example.org/p#M", "   ")).toBe("M");
  });
});

describe("pickLiteral", () => {
  it("prefers the requested language", () => {
    const value = pickLiteral([literal("Pizza", "it"), literal("Pizza pie", "en")], ["en"]);
    expect(value).toBe("Pizza pie");
  });

  it("falls back to a plain literal", () => {
    expect(pickLiteral([literal("Pizza", "it"), literal("Pizza")], ["en"])).toBe("Pizza");
  });

  it("returns undefined for no candidates", () => {
    expect(pickLiteral([])).toBeUndefined();
  });
});

describe("termKey", () => {
  it("distinguishes literals by language", () => {
    expect(termKey(literal("Pizza", "en"))).not.toBe(termKey(literal("Pizza", "it")));
  });
});
