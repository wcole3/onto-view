import { beforeEach, describe, expect, it } from "vitest";
import { Store as N3Store } from "n3";

import { parseDocument } from "../rdf/parse";
import { buildModel } from "./ontology";

const A = "urn:test:a";
const B = "urn:test:b";

const DOC_A = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix p: <http://example.org/pizza#> .

p:Food a owl:Class ; rdfs:label "Food" .
p:Pizza a owl:Class ; rdfs:subClassOf p:Food ; rdfs:label "Pizza" ; rdfs:comment "Baked." .
p:Margherita a owl:Class ; rdfs:subClassOf p:Pizza .
p:hasTopping a owl:ObjectProperty ; rdfs:domain p:Pizza ; rdfs:range p:Topping .
p:aMargherita a owl:NamedIndividual, p:Margherita .`;

// Declares Pizza again, so it becomes a shared node, and references an
// undeclared class from an ontology that was never loaded.
const DOC_B = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix p: <http://example.org/pizza#> .
@prefix q: <http://example.org/other#> .

p:Pizza a owl:Class .
p:Calzone a owl:Class ; rdfs:subClassOf q:FoldedFood .`;

let store: N3Store;

beforeEach(async () => {
  store = new N3Store();
  store.addQuads((await parseDocument(DOC_A, "turtle", A)).quads);
  store.addQuads((await parseDocument(DOC_B, "turtle", B)).quads);
});

describe("buildModel", () => {
  it("classifies entities by their declared type", () => {
    const { entities } = buildModel(store, new Set([A, B]));
    expect(entities.get("http://example.org/pizza#Pizza")?.kind).toBe("Class");
    expect(entities.get("http://example.org/pizza#hasTopping")?.kind).toBe("ObjectProperty");
  });

  it("prefers the more specific of several declared types", () => {
    // aMargherita is typed as both owl:NamedIndividual and p:Margherita.
    const { entities } = buildModel(store, new Set([A]));
    expect(entities.get("http://example.org/pizza#aMargherita")?.kind).toBe("Individual");
  });

  it("carries labels and comments", () => {
    const { entities } = buildModel(store, new Set([A]));
    const pizza = entities.get("http://example.org/pizza#Pizza");
    expect(pizza?.label).toBe("Pizza");
    expect(pizza?.comment).toBe("Baked.");
  });

  it("projects the hierarchy and the property axioms as relationships", () => {
    const { rels } = buildModel(store, new Set([A]));
    const kinds = rels.map((rel) => rel.kind);
    expect(kinds).toContain("subClassOf");
    expect(kinds).toContain("domain");
    expect(kinds).toContain("range");
  });

  it("records one source for a singly declared entity", () => {
    const { entities } = buildModel(store, new Set([A, B]));
    expect(entities.get("http://example.org/pizza#Food")?.declaredIn).toEqual([A]);
  });

  it("records both sources for an entity declared twice", () => {
    const { entities } = buildModel(store, new Set([A, B]));
    expect(entities.get("http://example.org/pizza#Pizza")?.declaredIn).toEqual([A, B]);
  });

  it("keeps an entity that is referenced but never declared", () => {
    const { entities } = buildModel(store, new Set([A, B]));
    const folded = entities.get("http://example.org/other#FoldedFood");
    expect(folded).toBeDefined();
    expect(folded?.declaredIn).toEqual([]);
    expect(folded?.mentionedIn).toEqual([B]);
  });

  it("omits a hidden source entirely, including its contribution to a shared entity", () => {
    const { entities } = buildModel(store, new Set([A]));
    expect(entities.get("http://example.org/pizza#Pizza")?.declaredIn).toEqual([A]);
    expect(entities.has("http://example.org/pizza#Calzone")).toBe(false);
    expect(entities.has("http://example.org/other#FoldedFood")).toBe(false);
  });

  it("returns an empty model when nothing is visible", () => {
    const model = buildModel(store, new Set());
    expect(model.entities.size).toBe(0);
    expect(model.rels).toHaveLength(0);
  });
});
