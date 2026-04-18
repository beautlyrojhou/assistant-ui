import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Text } from "ink";
import { ScrollableView } from "../primitives/scroll/ScrollableView";

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
  return instance.lastFrame() ?? "";
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ScrollableView", () => {
  it("renders the root viewport with the default indicator", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const frame = await renderFrame(
      <ScrollableView
        items={["one", "two", "three"]}
        height={2}
        initialScrollToBottom={false}
        renderItem={(item) => <Text>{item}</Text>}
      />,
    );

    expect(frame).toContain("one");
    expect(frame).toContain("[2/3]");
  });

  it("renders children after the default indicator", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const frame = await renderFrame(
      <ScrollableView
        items={[]}
        height={2}
        initialScrollToBottom={false}
        renderItem={(item) => <Text>{item}</Text>}
      >
        <Text>custom child</Text>
      </ScrollableView>,
    );

    expect(frame).toContain("[0/0]");
    expect(frame).toContain("custom child");
  });
});
