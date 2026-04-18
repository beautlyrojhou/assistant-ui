import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Text } from "ink";
import { assertScrollContext } from "../primitives/scroll/ScrollContext";
import { ScrollRoot } from "../primitives/scroll/ScrollRoot";
import { useScrollable } from "../primitives/scroll/useScrollable";

const mockUseBoxMetrics = vi.fn();

vi.mock("ink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ink")>();
  return {
    ...actual,
    useBoxMetrics: (...args: Parameters<typeof actual.useBoxMetrics>) =>
      mockUseBoxMetrics(...args),
  };
});

const renderFrame = async (node: ReactElement) => {
  const instance = render(node);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return instance;
};

const ScrollReader = () => {
  const scroll = useScrollable();
  return (
    <Text>
      {`${scroll.visibleFirstIndex}-${scroll.visibleLastIndex}-${scroll.itemCount}-${scroll.isAtBottom ? "bottom" : "middle"}`}
    </Text>
  );
};

const ScrollDriver = () => {
  const scroll = useScrollable();
  return (
    <Text>{`${scroll.scrollOffset}:${scroll.maxScrollOffset}:${scroll.autoScroll}`}</Text>
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useScrollable", () => {
  it("throws outside ScrollPrimitive.Root", () => {
    expect(() => assertScrollContext(null)).toThrowError(
      "useScrollable must be used within ScrollPrimitive.Root.",
    );
  });

  it("returns derived state inside ScrollPrimitive.Root", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const rendered = await renderFrame(
      <ScrollRoot
        items={["one", "two", "three"]}
        height={2}
        initialScrollToBottom={false}
        renderItem={(item) => <Text>{item}</Text>}
      >
        <ScrollReader />
      </ScrollRoot>,
    );

    expect(rendered.lastFrame() ?? "").toContain("0-1-3-bottom");
  });

  it("exposes actions that update scroll state", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    let latest: ReturnType<typeof useScrollable> | undefined;

    const ActionProbe = () => {
      latest = useScrollable();
      return <ScrollDriver />;
    };

    const rendered = await renderFrame(
      <ScrollRoot
        items={["one", "two", "three", "four"]}
        height={2}
        initialScrollToBottom={false}
        stickToBottomThreshold={0}
        renderItem={(item) => <Text>{item}</Text>}
      >
        <ActionProbe />
      </ScrollRoot>,
    );

    expect(rendered.lastFrame() ?? "").toContain("0:2:false");

    latest?.scrollToBottom();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(rendered.lastFrame() ?? "").toContain("2:2:true");
  });

  it("applies back-to-back actions without dropping updates", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    let latest: ReturnType<typeof useScrollable> | undefined;

    const ActionProbe = () => {
      latest = useScrollable();
      return <ScrollDriver />;
    };

    const rendered = await renderFrame(
      <ScrollRoot
        items={["one", "two", "three", "four", "five", "six"]}
        height={2}
        initialScrollToBottom={false}
        stickToBottomThreshold={0}
        renderItem={(item) => <Text>{item}</Text>}
      >
        <ActionProbe />
      </ScrollRoot>,
    );

    latest?.scrollBy(1);
    latest?.scrollBy(1);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(rendered.lastFrame() ?? "").toContain("2:4:false");
  });
});
