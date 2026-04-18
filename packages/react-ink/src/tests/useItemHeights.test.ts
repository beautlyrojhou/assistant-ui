import { describe, expect, it } from "vitest";
import {
  createInitialItemHeights,
  reconcileItemHeights,
} from "../primitives/scroll/useItemHeights";

describe("useItemHeights", () => {
  it("initializes new keys with an estimated height", () => {
    const heights = createInitialItemHeights(["a", "b"], 2);

    expect(heights.get("a")).toBe(2);
    expect(heights.get("b")).toBe(2);
  });

  it("replaces estimated heights with measured heights", () => {
    const next = reconcileItemHeights({
      previousHeights: createInitialItemHeights(["a"], 1),
      nextKeys: ["a"],
      estimatedHeight: 1,
      measuredHeights: new Map([["a", 4]]),
    });

    expect(next.heights.get("a")).toBe(4);
  });

  it("evicts removed keys and preserves surviving ones across replacement", () => {
    const next = reconcileItemHeights({
      previousHeights: new Map([
        ["a", 3],
        ["b", 2],
      ]),
      nextKeys: ["b", "c"],
      estimatedHeight: 1,
      measuredHeights: new Map(),
    });

    expect(next.heights.has("a")).toBe(false);
    expect(next.heights.get("b")).toBe(2);
    expect(next.heights.get("c")).toBe(1);
    expect(next.keyOrder).toEqual(["b", "c"]);
  });

  it("applies streaming height growth for an existing key", () => {
    const next = reconcileItemHeights({
      previousHeights: new Map([["stream", 2]]),
      nextKeys: ["stream"],
      estimatedHeight: 1,
      measuredHeights: new Map([["stream", 5]]),
    });

    expect(next.heights.get("stream")).toBe(5);
  });
});
