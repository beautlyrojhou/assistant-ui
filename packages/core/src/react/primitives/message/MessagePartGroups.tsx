"use client";

import { type FC, type ReactNode, useMemo } from "react";
import { useAuiState } from "@assistant-ui/store";
import { useShallow } from "zustand/shallow";
import type { PartState } from "../../../store/scopes/part";
import type { MessagePartStatus } from "../../../types/message";
import {
  buildGroupTree,
  type GroupKey,
  type GroupNode,
  normalizeGroupKey,
} from "../../utils/groupParts";
import { PartRangeContext } from "./PartRangeContext";

export namespace MessagePrimitivePartGroups {
  export type GroupInfo = {
    /** Group key of this level; `null` for implicit leaf runs. */
    readonly groupKey: string | null;
    /** Full path from the root down to this node (empty for root-level leaves). */
    readonly keyPath: readonly string[];
    /** 1-indexed nesting depth (0 for root-level leaves). */
    readonly depth: number;
    /** Part indices contained in this node, in order. */
    readonly indices: readonly number[];
    /** Snapshot of the parts contained in this node. */
    readonly parts: readonly PartState[];
    /** True iff the last contained part is still streaming. */
    readonly isStreaming: boolean;
    /** Status of the last contained part. */
    readonly status: MessagePartStatus;
    /**
     * For groups: the recursively-rendered inner content.
     * For leaf runs (groupKey === null): a sentinel element that throws on
     * render — you must render `<MessagePrimitive.Parts>` instead.
     */
    readonly children: ReactNode;
  };

  export type Props = {
    /**
     * Maps each part to its group key path. Adjacent parts sharing a prefix
     * coalesce up to that prefix. Return `null`, `undefined`, or `[]` to leave
     * a part ungrouped (it lands in `case null:` in your render switch).
     *
     * @example
     * ```ts
     * groupBy={(part) =>
     *   part.type === "reasoning" ? ["thought", "reasoning"] :
     *   part.type === "tool-call" ? ["thought", "tool"] :
     *   null
     * }
     * ```
     */
    readonly groupBy: (
      part: PartState,
      index: number,
      parts: readonly PartState[],
    ) => GroupKey;

    /**
     * Render function called once per group node and once per implicit leaf
     * run. Switch on `groupKey` to wrap each named group; in the `null` case,
     * render `<MessagePrimitive.Parts>` to provide per-part UI for the leaf run.
     */
    readonly children: (info: GroupInfo) => ReactNode;
  };
}

const LeafChildrenSentinel: FC = () => {
  throw new Error(
    "MessagePrimitive.PartGroups: cannot return `children` for the null (leaf) case — render <MessagePrimitive.Parts> to provide per-part UI.",
  );
};

const COMPLETE_STATUS: MessagePartStatus = Object.freeze({ type: "complete" });

const renderNode = (
  node: GroupNode,
  parts: readonly PartState[],
  render: (info: MessagePrimitivePartGroups.GroupInfo) => ReactNode,
): ReactNode => {
  const status = (parts[node.indices.at(-1)!]?.status ??
    COMPLETE_STATUS) as MessagePartStatus;

  const info: MessagePrimitivePartGroups.GroupInfo = {
    keyPath: node.keyPath,
    depth: node.depth,
    indices: node.indices,
    parts: node.indices.map((i) => parts[i]!),
    isStreaming: status.type === "running",
    status,
    ...(node.type === "leaf"
      ? { groupKey: null, children: <LeafChildrenSentinel /> }
      : {
          groupKey: node.key,
          children: (
            <>
              {node.children.map((child) => renderNode(child, parts, render))}
            </>
          ),
        }),
  };

  return (
    <PartRangeContext.Provider key={node.nodeKey} value={node.indices}>
      {render(info)}
    </PartRangeContext.Provider>
  );
};

/**
 * Groups adjacent message parts into a tree of coalesced runs.
 *
 * The children render function is called once per group node and once per
 * implicit leaf run (siblings at every depth). Leaf runs dispatch to
 * `case null:` and must be rendered via `<MessagePrimitive.Parts>` — returning
 * `children` directly throws at render time.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.PartGroups
 *   groupBy={(part) =>
 *     part.type === "reasoning" ? ["thought", "reasoning"] :
 *     part.type === "tool-call" ? ["thought", "tool"] :
 *     null
 *   }
 * >
 *   {({ groupKey, isStreaming, children }) => {
 *     switch (groupKey) {
 *       case "thought": return <ChainOfThought>{children}</ChainOfThought>;
 *       case "reasoning": return <Reasoning.Root defaultOpen={isStreaming}>{children}</Reasoning.Root>;
 *       case "tool": return <ToolStack>{children}</ToolStack>;
 *       case null:
 *         return (
 *           <MessagePrimitive.Parts>
 *             {({ part }) => renderLeafPart(part)}
 *           </MessagePrimitive.Parts>
 *         );
 *     }
 *   }}
 * </MessagePrimitive.PartGroups>
 * ```
 */
export const MessagePrimitivePartGroups: FC<
  MessagePrimitivePartGroups.Props
> = ({ groupBy, children }) => {
  const parts = useAuiState(useShallow((s) => s.message.parts));

  const tree = useMemo(
    () =>
      buildGroupTree(
        parts.map((part, i) => normalizeGroupKey(groupBy(part, i, parts))),
      ),
    [parts, groupBy],
  );

  return <>{tree.map((node) => renderNode(node, parts, children))}</>;
};

MessagePrimitivePartGroups.displayName = "MessagePrimitive.PartGroups";
