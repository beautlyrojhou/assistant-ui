import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Text } from "ink";
import { ScrollRoot } from "../primitives/scroll/ScrollRoot";
import { ScrollIndicator } from "../primitives/scroll/ScrollIndicator";

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

describe("ScrollIndicator", () => {
  it("renders the default [N/M] format", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const frame = await renderFrame(
      <ScrollRoot
        items={["one", "two", "three"]}
        height={2}
        initialScrollToBottom={false}
        renderItem={(item) => <Text>{item}</Text>}
      >
        <ScrollIndicator />
      </ScrollRoot>,
    );

    expect(frame).toContain("[2/3]");
  });

  it("passes the documented state to a custom formatter", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const frame = await renderFrame(
      <ScrollRoot
        items={["one", "two", "three"]}
        height={2}
        initialScrollToBottom={false}
        renderItem={(item) => <Text>{item}</Text>}
      >
        <ScrollIndicator
          format={({
            visibleFirstIndex,
            visibleLastIndex,
            itemCount,
            percent,
          }) =>
            `${visibleFirstIndex}-${visibleLastIndex}-${itemCount}-${percent}`
          }
        />
      </ScrollRoot>,
    );

    expect(frame).toContain("0-1-3-0");
  });
});
