import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScrollKey } from "./useScrollState";
import { arraysEqual, mapsEqual } from "./utils";

export type ItemHeightsState = {
  heights: Map<ScrollKey, number>;
  keyOrder: ScrollKey[];
};

export const createInitialItemHeights = (
  keys: readonly ScrollKey[],
  estimatedHeight: number,
) => {
  return new Map(keys.map((key) => [key, estimatedHeight]));
};

export const reconcileItemHeights = ({
  previousHeights,
  nextKeys,
  estimatedHeight,
  measuredHeights,
}: {
  previousHeights: Map<ScrollKey, number>;
  nextKeys: readonly ScrollKey[];
  estimatedHeight: number;
  measuredHeights: Map<ScrollKey, number>;
}): ItemHeightsState => {
  const heights = new Map<ScrollKey, number>();

  for (const key of nextKeys) {
    heights.set(
      key,
      measuredHeights.get(key) ??
        previousHeights.get(key) ??
        Math.max(1, estimatedHeight),
    );
  }

  return {
    heights,
    keyOrder: [...nextKeys],
  };
};

export const useItemHeights = ({
  itemKeys,
  estimatedHeight = 1,
}: {
  itemKeys: readonly ScrollKey[];
  estimatedHeight?: number;
}) => {
  const [measuredHeights, setMeasuredHeights] = useState<
    Map<ScrollKey, number>
  >(() => createInitialItemHeights(itemKeys, estimatedHeight));
  const [state, setState] = useState<ItemHeightsState>(() => ({
    heights: createInitialItemHeights(itemKeys, estimatedHeight),
    keyOrder: [...itemKeys],
  }));

  useEffect(() => {
    setMeasuredHeights((previous) => {
      const next = new Map<ScrollKey, number>();

      for (const key of itemKeys) {
        const value = previous.get(key);
        if (value !== undefined) {
          next.set(key, value);
        }
      }

      return mapsEqual(previous, next) ? previous : next;
    });
  }, [itemKeys]);

  useEffect(() => {
    setState((previous) => {
      const next = reconcileItemHeights({
        previousHeights: previous.heights,
        nextKeys: itemKeys,
        estimatedHeight,
        measuredHeights,
      });

      return mapsEqual(previous.heights, next.heights) &&
        arraysEqual(previous.keyOrder, next.keyOrder)
        ? previous
        : next;
    });
  }, [estimatedHeight, itemKeys, measuredHeights]);

  const updateItemHeight = useCallback((itemKey: ScrollKey, height: number) => {
    setMeasuredHeights((previous) => {
      if (previous.get(itemKey) === height) {
        return previous;
      }
      const next = new Map(previous);
      next.set(itemKey, Math.max(1, height));
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      itemHeights: state.heights,
      itemKeyOrder: state.keyOrder,
      updateItemHeight,
    }),
    [state, updateItemHeight],
  );
};
