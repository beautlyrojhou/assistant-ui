import { describe, expect, it } from "vitest";
import {
  buildGroupTree,
  normalizeGroupKey,
  type GroupNode,
} from "../react/utils/groupParts";

const asPaths = (keys: readonly (string | readonly string[] | null)[]) =>
  keys.map((k) => normalizeGroupKey(k));

// Compact tree dump: "G:key#nodeKey[i,j]{...}" | "L:#nodeKey[i,j]"
const dump = (nodes: readonly GroupNode[]): string =>
  nodes
    .map((n) => {
      if (n.type === "leaf") {
        return `L:#${n.nodeKey}[${n.indices.join(",")}]`;
      }
      const inner = dump(n.children);
      return `G:${n.key}#${n.nodeKey}[${n.indices.join(",")}]{${inner}}`;
    })
    .join(",");

describe("normalizeGroupKey", () => {
  it("maps null/undefined/[] to []", () => {
    expect(normalizeGroupKey(null)).toEqual([]);
    expect(normalizeGroupKey(undefined)).toEqual([]);
    expect(normalizeGroupKey([])).toEqual([]);
  });

  it("wraps a string into a single-element array", () => {
    expect(normalizeGroupKey("foo")).toEqual(["foo"]);
  });

  it("passes arrays through", () => {
    expect(normalizeGroupKey(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("buildGroupTree", () => {
  it("returns an empty list for no parts", () => {
    expect(buildGroupTree([])).toEqual([]);
  });

  it("treats a single null-path part as one root leaf", () => {
    const tree = buildGroupTree(asPaths([null]));
    expect(dump(tree)).toBe("L:#0[0]");
  });

  it("coalesces adjacent null-path parts into one leaf run", () => {
    const tree = buildGroupTree(asPaths([null, null, null]));
    expect(dump(tree)).toBe("L:#0[0,1,2]");
  });

  it("wraps a single-path run in one group with a single leaf child", () => {
    const tree = buildGroupTree(asPaths(["a", "a", "a"]));
    expect(dump(tree)).toBe("G:a#0[0,1,2]{L:#0.0[0,1,2]}");
  });

  it("splits non-adjacent runs of the same key into separate groups", () => {
    const tree = buildGroupTree(asPaths(["a", null, "a"]));
    expect(dump(tree)).toBe("G:a#0[0]{L:#0.0[0]},L:#1[1],G:a#2[2]{L:#2.0[2]}");
  });

  it("builds a two-level tree where inner groups and leaf runs are siblings", () => {
    // The canonical ["A","B"] then two ["A"] case from §3.2.
    const tree = buildGroupTree(
      asPaths([["A", "B"], ["A", "B"], ["A"], ["A"], ["A", "C"]]),
    );
    expect(dump(tree)).toBe(
      "G:A#0[0,1,2,3,4]{G:B#0.0[0,1]{L:#0.0.0[0,1]},L:#0.1[2,3],G:C#0.2[4]{L:#0.2.0[4]}}",
    );
  });

  it("matches the V3 §3.2 worked example", () => {
    const paths = asPaths([
      ["thought", "reasoning"],
      ["thought", "reasoning"],
      ["thought", "tool"],
      ["thought", "tool"],
      null,
      ["thought"],
      ["thought", "reasoning"],
      null,
      null,
    ]);
    const tree = buildGroupTree(paths);
    expect(dump(tree)).toBe(
      [
        "G:thought#0[0,1,2,3]{",
        "G:reasoning#0.0[0,1]{L:#0.0.0[0,1]},",
        "G:tool#0.1[2,3]{L:#0.1.0[2,3]}",
        "},",
        "L:#1[4],",
        "G:thought#2[5,6]{",
        "L:#2.0[5],",
        "G:reasoning#2.1[6]{L:#2.1.0[6]}",
        "},",
        "L:#3[7,8]",
      ].join(""),
    );
  });

  it("keeps sibling-index counters per parent scope", () => {
    // Siblings: leaf(0), A(1), leaf(2). Inside A: leaf(0), B(1), leaf(2).
    const tree = buildGroupTree(
      asPaths([null, ["A"], ["A", "B"], ["A"], null]),
    );
    expect(dump(tree)).toBe(
      "L:#0[0],G:A#1[1,2,3]{L:#1.0[1],G:B#1.1[2]{L:#1.1.0[2]},L:#1.2[3]},L:#2[4]",
    );
  });

  it("treats longer prefix changes as group close+open", () => {
    // ["A","B"], then ["A","B","C"] opens C under the same A>B.
    const tree = buildGroupTree(
      asPaths([
        ["A", "B"],
        ["A", "B", "C"],
        ["A", "B"],
      ]),
    );
    expect(dump(tree)).toBe(
      "G:A#0[0,1,2]{G:B#0.0[0,1,2]{L:#0.0.0[0],G:C#0.0.1[1]{L:#0.0.1.0[1]},L:#0.0.2[2]}}",
    );
  });

  it("does not coalesce same-keyed groups separated by a divergent sibling", () => {
    // ["A","B"], ["A","C"], ["A","B"]: all inside one A, but B and B do not merge.
    const tree = buildGroupTree(
      asPaths([
        ["A", "B"],
        ["A", "C"],
        ["A", "B"],
      ]),
    );
    expect(dump(tree)).toBe(
      "G:A#0[0,1,2]{G:B#0.0[0]{L:#0.0.0[0]},G:C#0.1[1]{L:#0.1.0[1]},G:B#0.2[2]{L:#0.2.0[2]}}",
    );
  });

  it("accepts strings and arrays interchangeably via normalizeGroupKey", () => {
    const tree = buildGroupTree([
      normalizeGroupKey("A"),
      normalizeGroupKey(["A"]),
    ]);
    expect(dump(tree)).toBe("G:A#0[0,1]{L:#0.0[0,1]}");
  });

  it("assigns stable nodeKeys regardless of subtree depth (append-only safety)", () => {
    // Appending a new part at the end must not shift existing nodeKeys.
    const before = buildGroupTree(asPaths([["A"], null]));
    const after = buildGroupTree(asPaths([["A"], null, ["B"]]));

    // First two nodes' keys are identical across the two builds.
    expect(before[0]!.nodeKey).toBe(after[0]!.nodeKey);
    expect(before[1]!.nodeKey).toBe(after[1]!.nodeKey);
    // The new node gets a fresh index.
    expect(after[2]!.nodeKey).toBe("2");
  });

  it("records correct depth and keyPath for leaves inside nested groups", () => {
    const tree = buildGroupTree(asPaths([["A", "B"]]));
    const a = tree[0] as Extract<GroupNode, { type: "group" }>;
    expect(a.depth).toBe(1);
    expect(a.keyPath).toEqual(["A"]);
    const b = a.children[0] as Extract<GroupNode, { type: "group" }>;
    expect(b.depth).toBe(2);
    expect(b.keyPath).toEqual(["A", "B"]);
    const leaf = b.children[0] as Extract<GroupNode, { type: "leaf" }>;
    expect(leaf.depth).toBe(2);
    expect(leaf.keyPath).toEqual(["A", "B"]);
  });
});
