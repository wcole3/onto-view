import { describe, expect, it } from "vitest";

import { hierarchyRoots, neighboursOf, selectScope } from "./subgraph";
import { DEFAULT_FILTERS, type Entity, type OntologyModel, type Rel } from "../model/types";

/** A chain A <- B <- C <- D, plus an unrelated X related to A. */
const IRIS = ["A", "B", "C", "D", "X"].map((n) => `http://x/${n}`);

const entities = new Map<string, Entity>(
  IRIS.map((iri) => [
    iri,
    { iri, kind: "Class", label: iri.endsWith("X") ? "Something else" : undefined, declaredIn: ["s1"], mentionedIn: ["s1"] },
  ]),
);

const rel = (from: string, to: string, kind: Rel["kind"] = "subClassOf"): Rel => ({
  id: `${kind}|${from}|${to}`,
  from: `http://x/${from}`,
  to: `http://x/${to}`,
  kind,
  sourceId: "s1",
});

const rels: Rel[] = [rel("B", "A"), rel("C", "B"), rel("D", "C"), rel("X", "A", "domain")];

const model: OntologyModel = { entities, rels };

describe("hierarchyRoots", () => {
  it("returns entities with nothing more general above them", () => {
    // A has no parent. X has only a non-hierarchy relationship, so it is also a root.
    expect(hierarchyRoots(entities, rels).sort()).toEqual(["http://x/A", "http://x/X"]);
  });
});

describe("selectScope", () => {
  it("keeps everything when no scope is set", () => {
    const scope = selectScope(entities, rels, DEFAULT_FILTERS);
    expect(scope.kind).toBe("all");
    expect(scope.keep).toBeNull();
  });

  it("expands a focus by the requested number of hops", () => {
    const scope = selectScope(entities, rels, {
      ...DEFAULT_FILTERS,
      focusIri: "http://x/C",
      focusDepth: 1,
    });
    expect(scope.kind).toBe("focus");
    expect([...scope.keep!].sort()).toEqual(["http://x/B", "http://x/C", "http://x/D"]);
  });

  it("follows relationships in both directions from the focus", () => {
    const scope = selectScope(entities, rels, {
      ...DEFAULT_FILTERS,
      focusIri: "http://x/A",
      focusDepth: 1,
    });
    // B is below A in the hierarchy, X points at A through a domain axiom.
    expect([...scope.keep!].sort()).toEqual(["http://x/A", "http://x/B", "http://x/X"]);
  });

  it("ignores a focus on an entity that is not present", () => {
    const scope = selectScope(entities, rels, {
      ...DEFAULT_FILTERS,
      focusIri: "http://x/missing",
    });
    expect(scope.kind).toBe("all");
  });

  it("matches a search against the label", () => {
    const scope = selectScope(entities, rels, { ...DEFAULT_FILTERS, search: "something" });
    expect(scope.kind).toBe("search");
    // The match plus one hop of context.
    expect([...scope.keep!].sort()).toEqual(["http://x/A", "http://x/X"]);
  });

  it("matches a search against the IRI and ignores case", () => {
    const scope = selectScope(entities, rels, { ...DEFAULT_FILTERS, search: "/d" });
    expect([...scope.keep!]).toContain("http://x/D");
  });

  it("returns an empty set for a search that matches nothing", () => {
    const scope = selectScope(entities, rels, { ...DEFAULT_FILTERS, search: "zzz" });
    expect(scope.keep!.size).toBe(0);
    expect(scope.hidden).toBe(entities.size);
  });

  it("descends the hierarchy from the roots by the requested depth", () => {
    const scope = selectScope(entities, rels, { ...DEFAULT_FILTERS, rootDepth: 1 });
    expect(scope.kind).toBe("rootDepth");
    // Roots A and X, plus A's immediate subclass B. C and D are deeper.
    expect([...scope.keep!].sort()).toEqual(["http://x/A", "http://x/B", "http://x/X"]);
  });

  it("prefers a focus over a search over a depth limit", () => {
    const scope = selectScope(entities, rels, {
      ...DEFAULT_FILTERS,
      focusIri: "http://x/D",
      search: "something",
      rootDepth: 1,
    });
    expect(scope.kind).toBe("focus");
  });
});

describe("neighboursOf", () => {
  it("separates broader, narrower and other relationships", () => {
    const { parents, children, related } = neighboursOf(model, "http://x/A");
    expect(parents).toHaveLength(0);
    expect(children.map((r) => r.from)).toEqual(["http://x/B"]);
    expect(related.map((r) => r.from)).toEqual(["http://x/X"]);
  });

  it("reports the parent of a nested entity", () => {
    const { parents, children } = neighboursOf(model, "http://x/C");
    expect(parents.map((r) => r.to)).toEqual(["http://x/B"]);
    expect(children.map((r) => r.from)).toEqual(["http://x/D"]);
  });
});
