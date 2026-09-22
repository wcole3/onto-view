import { describe, expect, it } from "vitest";

import { project, READABLE_ELEMENT_LIMIT } from "./elements";
import { DEFAULT_FILTERS, type Entity, type OntologyModel, type Source } from "../model/types";

function entity(iri: string, partial: Partial<Entity> = {}): Entity {
  return { iri, kind: "Class", declaredIn: [], mentionedIn: [], ...partial };
}

function source(id: string, color: string): Source {
  return {
    id,
    name: id,
    color,
    format: "turtle",
    quadCount: 1,
    visible: true,
    prefixes: {},
    warnings: [],
  };
}

const SOURCES = [source("s1", "#1f6c9f"), source("s2", "#9f2f2d")];

function model(entities: Entity[], rels: OntologyModel["rels"] = []): OntologyModel {
  return { entities: new Map(entities.map((e) => [e.iri, e])), rels };
}

describe("toElements provenance state", () => {
  it("marks a singly declared entity and gives it that source's colour", () => {
    const [node] = project(
      model([entity("http://x/A", { declaredIn: ["s1"], mentionedIn: ["s1"] })]),
      SOURCES,
      DEFAULT_FILTERS,
    ).elements;
    expect(node.data.state).toBe("single");
    expect(node.data.color).toBe("#1f6c9f");
  });

  it("marks an entity declared by two sources as shared", () => {
    const [node] = project(
      model([entity("http://x/A", { declaredIn: ["s1", "s2"], mentionedIn: ["s1", "s2"] })]),
      SOURCES,
      DEFAULT_FILTERS,
    ).elements;
    expect(node.data.state).toBe("shared");
  });

  it("marks a referenced but undeclared entity", () => {
    const [node] = project(
      model([entity("http://x/A", { mentionedIn: ["s2"] })]),
      SOURCES,
      DEFAULT_FILTERS,
    ).elements;
    expect(node.data.state).toBe("undeclared");
  });
});

describe("toElements filtering", () => {
  const entities = [
    entity("http://x/C", { kind: "Class", declaredIn: ["s1"] }),
    entity("http://x/i", { kind: "Individual", declaredIn: ["s1"] }),
    entity("http://x/p", { kind: "ObjectProperty", declaredIn: ["s1"] }),
    entity("http://x/Onto", { kind: "Ontology", declaredIn: ["s1"] }),
  ];

  it("hides individuals by default", () => {
    const ids = project(model(entities), SOURCES, DEFAULT_FILTERS).elements.map(
      (e) => e.data.id,
    );
    expect(ids).not.toContain("http://x/i");
    expect(ids).toContain("http://x/p");
  });

  it("always omits the ontology header, which is metadata not a term", () => {
    const ids = project(model(entities), SOURCES, {
      ...DEFAULT_FILTERS,
      hideIndividuals: false,
    }).elements.map((e) => e.data.id);
    expect(ids).not.toContain("http://x/Onto");
    expect(ids).toContain("http://x/i");
  });

  it("keeps only classes when asked", () => {
    const ids = project(model(entities), SOURCES, {
      ...DEFAULT_FILTERS,
      classesOnly: true,
    }).elements.map((e) => e.data.id);
    expect(ids).toEqual(["http://x/C"]);
  });

  it("drops an edge whose endpoint was filtered out", () => {
    const rels: OntologyModel["rels"] = [
      { id: "r1", from: "http://x/i", to: "http://x/C", kind: "type", sourceId: "s1" },
    ];
    const { elements } = project(model(entities, rels), SOURCES, {
      ...DEFAULT_FILTERS,
      hideTypeEdges: false,
    });
    expect(elements.filter((e) => e.data.source)).toHaveLength(0);
  });

  it("collapses the same axiom asserted by two sources into one edge", () => {
    const shared = [
      entity("http://x/A", { declaredIn: ["s1"] }),
      entity("http://x/B", { declaredIn: ["s2"] }),
    ];
    const rels: OntologyModel["rels"] = [
      { id: "r1", from: "http://x/A", to: "http://x/B", kind: "subClassOf", sourceId: "s1" },
      { id: "r2", from: "http://x/A", to: "http://x/B", kind: "subClassOf", sourceId: "s2" },
    ];
    const edges = project(model(shared, rels), SOURCES, DEFAULT_FILTERS).elements.filter(
      (e) => e.data.source,
    );
    expect(edges).toHaveLength(1);
  });
});

describe("READABLE_ELEMENT_LIMIT", () => {
  it("sits below the element count a real ontology suite produces", () => {
    // CCO merged yields 1,701 nodes and 1,888 edges of named classes alone.
    expect(READABLE_ELEMENT_LIMIT).toBeLessThan(1701);
  });
});
