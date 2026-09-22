import { describe, expect, it } from "vitest";
import type cytoscape from "cytoscape";

import { buildTree, childrenFor, pathTo } from "./tree";

const node = (id: string, label = id): cytoscape.ElementDefinition => ({
  data: { id, label, curie: `x:${id}`, kind: "Class", color: "#000" },
});

const edge = (
  child: string,
  parent: string,
  hierarchy = true,
): cytoscape.ElementDefinition => ({
  data: {
    id: `subClassOf|${child}|${parent}`,
    source: child,
    target: parent,
    hierarchy,
    kind: hierarchy ? "subClassOf" : "domain",
  },
});

describe("buildTree", () => {
  it("nests children under the general term and sorts by label", () => {
    const tree = buildTree([node("A"), node("C"), node("B"), edge("B", "A"), edge("C", "A")]);

    expect(tree.roots).toEqual(["A"]);
    expect(tree.childrenOf.get("A")).toEqual(["B", "C"]);
    expect(tree.entries.get("B")?.curie).toBe("x:B");
  });

  it("treats a term with no visible parent as a root", () => {
    const tree = buildTree([node("A"), node("X"), edge("X", "A", false)]);
    expect(tree.roots).toEqual(["A", "X"]);
  });

  it("ignores hierarchy edges whose other end was filtered out", () => {
    const tree = buildTree([node("B"), edge("B", "A")]);
    expect(tree.roots).toEqual(["B"]);
    expect(tree.childrenOf.size).toBe(0);
  });

  it("lists a multi-parent term under each parent", () => {
    const tree = buildTree([node("A"), node("B"), node("C"), edge("C", "A"), edge("C", "B")]);
    expect(tree.roots).toEqual(["A", "B"]);
    expect(tree.childrenOf.get("A")).toEqual(["C"]);
    expect(tree.childrenOf.get("B")).toEqual(["C"]);
  });

  it("collapses the same axiom asserted twice into one child", () => {
    const tree = buildTree([node("A"), node("B"), edge("B", "A"), edge("B", "A")]);
    expect(tree.childrenOf.get("A")).toEqual(["B"]);
  });
});

describe("childrenFor", () => {
  it("drops a child that is already an ancestor, so a cycle terminates", () => {
    // A <- B <- A: both are roots of nothing, and the walk must still end.
    const tree = buildTree([node("A"), node("B"), edge("B", "A"), edge("A", "B")]);
    expect(childrenFor(tree, "A", new Set())).toEqual(["B"]);
    expect(childrenFor(tree, "B", new Set(["A", "B"]))).toEqual([]);
  });
});

describe("pathTo", () => {
  const tree = buildTree([
    node("A"),
    node("B"),
    node("C"),
    node("Z"),
    edge("B", "A"),
    edge("C", "B"),
  ]);

  it("returns the chain from a root down to the entry", () => {
    expect(pathTo(tree, "C")).toEqual(["A", "B", "C"]);
  });

  it("returns a root as its own path", () => {
    expect(pathTo(tree, "A")).toEqual(["A"]);
    expect(pathTo(tree, "Z")).toEqual(["Z"]);
  });

  it("returns null for an entry the filters removed", () => {
    expect(pathTo(tree, "nope")).toBeNull();
  });
});
