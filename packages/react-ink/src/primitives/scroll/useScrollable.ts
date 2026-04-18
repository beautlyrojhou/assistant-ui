import { useMemo } from "react";
import { useScrollContext } from "./ScrollContext";

export type UseScrollableResult = {
  scrollOffset: number;
  maxScrollOffset: number;
  viewportHeight: number;
  contentHeight: number;
  itemCount: number;
  visibleFirstIndex: number;
  visibleLastIndex: number;
  isAtBottom: boolean;
  autoScroll: boolean;
  scrollBy: (rows: number) => void;
  scrollByPage: (direction: "up" | "down") => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  scrollToItem: (index: number, align?: "top" | "bottom") => void;
  setAutoScroll: (enabled: boolean) => void;
};

export const useScrollable = (): UseScrollableResult => {
  const { state, derived, actions } = useScrollContext();

  return useMemo(
    () => ({
      scrollOffset: state.scrollOffset,
      maxScrollOffset: derived.maxScrollOffset,
      viewportHeight: state.viewportHeight,
      contentHeight: derived.contentHeight,
      itemCount: state.itemCount,
      visibleFirstIndex: derived.visibleFirstIndex,
      visibleLastIndex: derived.visibleLastIndex,
      isAtBottom: derived.isAtBottom,
      autoScroll: state.autoScroll,
      ...actions,
    }),
    [actions, derived, state],
  );
};
