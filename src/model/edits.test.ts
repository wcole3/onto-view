import { beforeEach, describe, expect, it } from "vitest";
import { DataFactory, Store as N3Store } from "n3";

import { parseDocument } from "../rdf/parse";
import { rdfs } from "../rdf/vocab";
import {
  addRelation,
  affectedGraphs,
  createEntity,
  deleteEntity,
  invert,
  removeRelation,
  renameEntity,
  setComment,
  setLabel,
} from "./edits";

const { namedNode } = DataFactory;
const A = "urn:test:a";
const B = "urn:test:b";
const P = "http://example.org/pizza#";

const DOC_A = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix p: <${P}> .
p:Food a owl:Class ; rdfs:label "Food" .
p:Pizza a owl:Class ; rdfs:subClassOf p:Food ; rdfs:label "Pizza" .
p:Margherita a owl:Class ; rdfs:subClassOf p:Pizza .`;

// A second source that also points at Pizza, so removals have to reach it.
const DOC_B = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix p: <${P}> .
p:Calzone a owl:Class ; rdfs:subClassOf p:Pizza .`;

let store: N3Store;
/** Applies an edit the way the store does: removals first. */
const apply = (edit: { add: never[] | unknown[]; remove: never[] | unknown[] }) => {
  store.removeQuads(edit.remove as never[]);
  store.addQuads(edit.add as never[]);
};

beforeEach(async () => {
  store = new N3Store();
  store.addQuads((await parseDocument(DOC_A, "turtle", A)).quads);
  store.addQuads((await parseDocument(DOC_B, "turtle", B)).quads);
});

describe("setLabel", () => {
  it("replaces the existing value rather than adding a second one", () => {
    apply(setLabel(store, `${P}Pizza`, "Pizza pie", A));
    const labels = store.getQuads(namedNode(`${P}Pizza`), rdfs.label, null, null);
    expect(labels).toHaveLength(1);
    expect(labels[0].object.value).toBe("Pizza pie");
  });

  it("writes into the active source's graph", () => {
    const edit = setLabel(store, `${P}Pizza`, "Pizza pie", B);
    expect(edit.add[0].graph.value).toBe(B);
  });

  it("trims whitespace", () => {
    apply(setLabel(store, `${P}Pizza`, "  Pizza pie  ", A));
    expect(store.getQuads(namedNode(`${P}Pizza`), rdfs.label, null, null)[0].object.value).toBe(
      "Pizza pie",
    );
  });

  it("clears the value when given an empty string", () => {
    apply(setLabel(store, `${P}Pizza`, "   ", A));
    expect(store.getQuads(namedNode(`${P}Pizza`), rdfs.label, null, null)).toHaveLength(0);
  });
});

describe("createEntity", () => {
  it("declares the type and the label", () => {
    apply(createEntity(store, `${P}Calzone2`, "Class", "Calzone", A));
    expect(store.getQuads(namedNode(`${P}Calzone2`), null, null, null)).toHaveLength(2);
  });

  it("refuses a relative IRI", () => {
    expect(() => createEntity(store, "Calzone", "Class", "", A)).toThrow(/absolute IRI/);
  });

  it("refuses to redeclare an existing entity", () => {
    expect(() => createEntity(store, `${P}Pizza`, "Class", "", A)).toThrow(/already declared/);
  });

  it("refuses a kind that cannot be declared", () => {
    expect(() => createEntity(store, `${P}X`, "Unknown", "", A)).toThrow(/cannot be declared/);
  });
});

describe("renameEntity", () => {
  it("rewrites inbound references in other sources too", () => {
    apply(renameEntity(store, `${P}Pizza`, `${P}Pie`));
    // Calzone's subClassOf came from source B and must now point at Pie.
    const calzone = store.getQuads(namedNode(`${P}Calzone`), rdfs.subClassOf, null, null);
    expect(calzone[0].object.value).toBe(`${P}Pie`);
    expect(store.getQuads(namedNode(`${P}Pizza`), null, null, null)).toHaveLength(0);
    expect(store.getQuads(null, null, namedNode(`${P}Pizza`), null)).toHaveLength(0);
  });

  it("preserves each statement's original graph", () => {
    const edit = renameEntity(store, `${P}Pizza`, `${P}Pie`);
    expect(new Set(edit.add.map((q) => q.graph.value))).toEqual(new Set([A, B]));
    apply(edit);
    expect(
      store.getQuads(namedNode(`${P}Calzone`), rdfs.subClassOf, null, namedNode(B)),
    ).toHaveLength(1);
  });

  it("refuses an IRI that is already in use", () => {
    expect(() => renameEntity(store, `${P}Pizza`, `${P}Food`)).toThrow(/already in use/);
  });

  it("is a no-op when the IRI is unchanged", () => {
    expect(renameEntity(store, `${P}Pizza`, `${P}Pizza`).add).toHaveLength(0);
  });
});

describe("deleteEntity", () => {
  it("removes inbound references so nothing is left dangling", () => {
    apply(deleteEntity(store, `${P}Pizza`));
    expect(store.getQuads(null, null, namedNode(`${P}Pizza`), null)).toHaveLength(0);
    expect(store.getQuads(namedNode(`${P}Calzone`), rdfs.subClassOf, null, null)).toHaveLength(0);
  });

  it("does not report the same statement twice", () => {
    // A self-referencing statement would otherwise be collected by both the
    // subject and the object query.
    store.addQuads([
      DataFactory.quad(
        namedNode(`${P}Pizza`),
        rdfs.subClassOf,
        namedNode(`${P}Pizza`),
        namedNode(A),
      ),
    ]);
    const edit = deleteEntity(store, `${P}Pizza`);
    const keys = edit.remove.map((q) =>
      [q.subject.value, q.predicate.value, q.object.value, q.graph.value].join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("relations", () => {
  it("adds into the active source", () => {
    const edit = addRelation(`${P}Food`, `${P}Pizza`, "domain", B);
    expect(edit.add[0].graph.value).toBe(B);
  });

  it("refuses a self-relation", () => {
    expect(() => addRelation(`${P}Food`, `${P}Food`, "subClassOf", A)).toThrow(/itself/);
  });

  it("removes an assertion from whichever source made it", () => {
    const edit = removeRelation(store, `${P}Calzone`, `${P}Pizza`, "subClassOf");
    expect(edit.remove).toHaveLength(1);
    expect(edit.remove[0].graph.value).toBe(B);
  });
});

describe("invert", () => {
  it("restores the exact prior state of a replaced value", () => {
    const before = store.getQuads(namedNode(`${P}Pizza`), rdfs.label, null, null);
    const edit = setLabel(store, `${P}Pizza`, "Pizza pie", A);
    apply(edit);
    apply(invert(edit));

    const after = store.getQuads(namedNode(`${P}Pizza`), rdfs.label, null, null);
    expect(after).toHaveLength(before.length);
    expect(after[0].object.value).toBe("Pizza");
  });

  it("restores a rename across every affected source", () => {
    const edit = renameEntity(store, `${P}Pizza`, `${P}Pie`);
    apply(edit);
    apply(invert(edit));
    expect(
      store.getQuads(namedNode(`${P}Calzone`), rdfs.subClassOf, null, namedNode(B)),
    ).toHaveLength(1);
    expect(store.getQuads(namedNode(`${P}Pie`), null, null, null)).toHaveLength(0);
  });

  it("restores a deletion in full", () => {
    const countBefore = store.countQuads(null, null, null, null);
    const edit = deleteEntity(store, `${P}Pizza`);
    apply(edit);
    apply(invert(edit));
    expect(store.countQuads(null, null, null, null)).toBe(countBefore);
  });
});

describe("affectedGraphs", () => {
  it("names every source an edit touched", () => {
    expect(affectedGraphs(renameEntity(store, `${P}Pizza`, `${P}Pie`)).sort()).toEqual([A, B]);
  });

  it("names one source for a confined edit", () => {
    expect(affectedGraphs(setComment(store, `${P}Food`, "Edible.", A))).toEqual([A]);
  });
});
