/**
 * Hierarchical adjacent-coalescing grouping for message parts.
 *
 * Given a group path per part (from `groupBy`), builds a tree of nodes where:
 *  - adjacent parts sharing a prefix path are coalesced up to that prefix,
 *  - parts with shorter paths form an *implicit leaf group* alongside named
 *    sub-groups at every depth,
 *  - each node gets a structural `nodeKey` built from its sibling indices
 *    (`"0.1.2"`), stable under append-only streaming.
 *
 * See `PARTS_GROUPING_DESIGN_V3.md` for the full semantics.
 */

export type GroupKey = string | readonly string[] | null | undefined;

export type GroupNode = GroupNodeGroup | GroupNodeLeaf;

export interface GroupNodeGroup {
  readonly type: "group";
  /** Current-level group key (last segment of keyPath). */
  readonly key: string;
  /** Full path from root to this node. */
  readonly keyPath: readonly string[];
  /** 1-indexed nesting depth (root children are depth 1). */
  readonly depth: number;
  /** Structural React key: sibling-index path, e.g. "0.1.0". */
  readonly nodeKey: string;
  /** Every part index inside this subtree, in order. */
  readonly indices: readonly number[];
  readonly children: readonly GroupNode[];
}

export interface GroupNodeLeaf {
  readonly type: "leaf";
  /** Parent's keyPath (leaves have no key of their own). */
  readonly keyPath: readonly string[];
  /** Depth of the parent group (0 for root-level leaves). */
  readonly depth: number;
  /** Structural React key. */
  readonly nodeKey: string;
  /** Part indices in this leaf run. Always non-empty. */
  readonly indices: readonly number[];
}

const EMPTY_PATH: readonly string[] = Object.freeze([]);

/**
 * Normalize a `groupBy` return value to a path array.
 * null/undefined/[] → [] (ungrouped)
 * "foo" → ["foo"]
 * ["a", "b"] → ["a", "b"] (as-is)
 */
export const normalizeGroupKey = (key: GroupKey): readonly string[] => {
  if (key == null) return EMPTY_PATH;
  if (typeof key === "string") return [key];
  return key;
};

interface BuildFrame {
  key: string;
  keyPath: readonly string[];
  depth: number;
  nodeKey: string;
  indices: number[];
  children: GroupNode[];
  nextChildIdx: number;
  pendingLeaf: { nodeKey: string; indices: number[] } | null;
}

const makeChildNodeKey = (parent: BuildFrame): string => {
  const idx = parent.nextChildIdx++;
  return parent.nodeKey === "" ? String(idx) : `${parent.nodeKey}.${idx}`;
};

/**
 * Build the group tree from an array of normalized group paths.
 * `paths[i]` is the path for part `i`.
 */
export const buildGroupTree = (
  paths: readonly (readonly string[])[],
): readonly GroupNode[] => {
  const root: BuildFrame = {
    key: "",
    keyPath: EMPTY_PATH,
    depth: 0,
    nodeKey: "",
    indices: [],
    children: [],
    nextChildIdx: 0,
    pendingLeaf: null,
  };
  const stack: BuildFrame[] = [root];

  const commitPendingLeaf = (frame: BuildFrame): void => {
    if (!frame.pendingLeaf) return;
    frame.children.push({
      type: "leaf",
      keyPath: frame.keyPath,
      depth: frame.depth,
      nodeKey: frame.pendingLeaf.nodeKey,
      indices: frame.pendingLeaf.indices,
    });
    frame.pendingLeaf = null;
  };

  const closeTop = (): void => {
    const closing = stack.pop()!;
    commitPendingLeaf(closing);
    const parent = stack[stack.length - 1]!;
    parent.children.push({
      type: "group",
      key: closing.key,
      keyPath: closing.keyPath,
      depth: closing.depth,
      nodeKey: closing.nodeKey,
      indices: closing.indices,
      children: closing.children,
    });
  };

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const activeDepth = stack.length - 1;

    let common = 0;
    while (
      common < activeDepth &&
      common < path.length &&
      stack[common + 1]!.key === path[common]
    ) {
      common++;
    }

    const opensNewNamedGroup = path.length > common;

    while (stack.length - 1 > common) {
      closeTop();
    }

    if (opensNewNamedGroup) {
      commitPendingLeaf(stack[stack.length - 1]!);
    }

    while (stack.length - 1 < path.length) {
      const parent = stack[stack.length - 1]!;
      const key = path[parent.depth]!;
      stack.push({
        key,
        keyPath: [...parent.keyPath, key],
        depth: parent.depth + 1,
        nodeKey: makeChildNodeKey(parent),
        indices: [],
        children: [],
        nextChildIdx: 0,
        pendingLeaf: null,
      });
    }

    const top = stack[stack.length - 1]!;
    if (!top.pendingLeaf) {
      top.pendingLeaf = { nodeKey: makeChildNodeKey(top), indices: [] };
    }
    top.pendingLeaf.indices.push(i);

    for (let s = 1; s < stack.length; s++) {
      stack[s]!.indices.push(i);
    }
  }

  while (stack.length > 1) {
    closeTop();
  }
  commitPendingLeaf(root);

  return root.children;
};
