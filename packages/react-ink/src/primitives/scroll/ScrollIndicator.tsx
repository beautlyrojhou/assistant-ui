import { Text } from "ink";
import { useScrollable } from "./useScrollable";

export type ScrollIndicatorState = Pick<
  ReturnType<typeof useScrollable>,
  | "visibleFirstIndex"
  | "visibleLastIndex"
  | "itemCount"
  | "scrollOffset"
  | "maxScrollOffset"
  | "isAtBottom"
> & {
  percent: number;
};

export type ScrollIndicatorProps = {
  format?: ((state: ScrollIndicatorState) => string) | undefined;
};

const defaultFormat = ({
  visibleLastIndex,
  itemCount,
}: ScrollIndicatorState) => {
  return `[${itemCount === 0 ? 0 : visibleLastIndex + 1}/${itemCount}]`;
};

export const ScrollIndicator = ({
  format = defaultFormat,
}: ScrollIndicatorProps) => {
  const {
    visibleFirstIndex,
    visibleLastIndex,
    itemCount,
    scrollOffset,
    maxScrollOffset,
    isAtBottom,
  } = useScrollable();
  const percent =
    maxScrollOffset === 0
      ? 100
      : Math.round((scrollOffset / maxScrollOffset) * 100);

  return (
    <Text>
      {format({
        visibleFirstIndex,
        visibleLastIndex,
        itemCount,
        scrollOffset,
        maxScrollOffset,
        percent,
        isAtBottom,
      })}
    </Text>
  );
};

ScrollIndicator.displayName = "ScrollPrimitive.Indicator";

export namespace ScrollIndicator {
  export type Props = ScrollIndicatorProps;
  export type State = ScrollIndicatorState;
}
