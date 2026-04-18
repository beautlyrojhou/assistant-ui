import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { Text } from "ink";
import { ScrollRoot } from "../primitives/scroll/ScrollRoot";
import { ScrollScrollbar } from "../primitives/scroll/ScrollScrollbar";

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

describe("ScrollScrollbar", () => {
  it("renders a thumb and track when content overflows", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const frame = await renderFrame(
      <ScrollRoot
        items={["one", "two", "three", "four"]}
        height={2}
        initialScrollToBottom={false}
        scrollbar={<ScrollScrollbar />}
        renderItem={(item) => <Text>{item}</Text>}
      />,
    );

    expect(frame).toContain("|");
    expect(frame).toContain("#");
  });

  it("renders only the track when content fits in the viewport", async () => {
    mockUseBoxMetrics.mockReturnValue({
      height: 1,
      width: 10,
      left: 0,
      top: 0,
      hasMeasured: true,
    });

    const frame = await renderFrame(
      <ScrollRoot
        items={["one", "two"]}
        height={2}
        initialScrollToBottom={false}
        scrollbar={<ScrollScrollbar char={{ track: "." }} />}
        renderItem={(item) => <Text>{item}</Text>}
      />,
    );

    expect(frame).toContain(".");
    expect(frame).not.toContain("#");
  });
});
