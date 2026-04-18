import { ScrollIndicator } from "./ScrollIndicator";
import { ScrollRoot, type ScrollRootProps } from "./ScrollRoot";

export type ScrollableViewProps<T> = ScrollRootProps<T>;

/**
 * Convenience wrapper with a fixed render order:
 * viewport, paused hint, default indicator.
 */
export const ScrollableView = <T,>({
  children,
  ...props
}: ScrollableViewProps<T>) => {
  return (
    <ScrollRoot {...props}>
      <ScrollIndicator />
      {children}
    </ScrollRoot>
  );
};

ScrollableView.displayName = "ScrollableView";

export namespace ScrollableView {
  export type Props<T> = ScrollableViewProps<T>;
}
