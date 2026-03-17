// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import type { ThreadMessage } from "@assistant-ui/core";
import { describe, expect, it, vi, afterEach } from "vitest";
import { useAuiState } from "@assistant-ui/store";
import { ReadonlyThreadProvider } from "../../context";
import {
  ThreadPrimitiveMessageByIndex,
  ThreadPrimitiveMessages,
} from "./ThreadMessages";

const createUserMessage = (id: string): ThreadMessage => ({
  id,
  role: "user",
  content: [{ type: "text", text: `message-${id}` }],
  attachments: [],
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  metadata: {
    custom: {},
  },
});

const getConsoleErrorText = (spy: ReturnType<typeof vi.spyOn>) => {
  return spy.mock.calls
    .flatMap((args) =>
      args.map((arg) => {
        if (arg instanceof Error) return arg.message;
        return String(arg);
      }),
    )
    .join("\n");
};

const RoleMessage = () => {
  const role = useAuiState((s) => s.message.role);
  return <div data-testid="message-role">{role}</div>;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThreadPrimitive.Messages thread switching", () => {
  it("updates when thread messages change but the length stays the same", async () => {
    const { rerender } = render(
      <ReadonlyThreadProvider messages={[createUserMessage("m-1")]}>
        <ThreadPrimitiveMessages>
          {({ message }) => <div data-testid="message-id">{message.id}</div>}
        </ThreadPrimitiveMessages>
      </ReadonlyThreadProvider>,
    );

    expect(screen.getByTestId("message-id").textContent).toBe("m-1");

    rerender(
      <ReadonlyThreadProvider messages={[createUserMessage("m-2")]}>
        <ThreadPrimitiveMessages>
          {({ message }) => <div data-testid="message-id">{message.id}</div>}
        </ThreadPrimitiveMessages>
      </ReadonlyThreadProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("message-id").textContent).toBe("m-2");
    });
  });

  it("does not log a tapClientLookup crash when component-based messages are cleared", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ReadonlyThreadProvider messages={[createUserMessage("m-1")]}>
        <ThreadPrimitiveMessages components={{ Message: RoleMessage }} />
      </ReadonlyThreadProvider>,
    );

    expect(screen.getByTestId("message-role").textContent).toBe("user");

    rerender(
      <ReadonlyThreadProvider messages={[]}>
        <ThreadPrimitiveMessages components={{ Message: RoleMessage }} />
      </ReadonlyThreadProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("message-role")).toBeNull();
    });

    expect(getConsoleErrorText(errorSpy)).not.toContain(
      "tapClientLookup: Index",
    );
  });

  it("does not log a tapClientLookup crash when render-function messages are cleared", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ReadonlyThreadProvider messages={[createUserMessage("m-1")]}>
        <ThreadPrimitiveMessages>
          {({ message }) => <div data-testid="message-id">{message.id}</div>}
        </ThreadPrimitiveMessages>
      </ReadonlyThreadProvider>,
    );

    expect(screen.getByTestId("message-id").textContent).toBe("m-1");

    rerender(
      <ReadonlyThreadProvider messages={[]}>
        <ThreadPrimitiveMessages>
          {({ message }) => <div data-testid="message-id">{message.id}</div>}
        </ThreadPrimitiveMessages>
      </ReadonlyThreadProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("message-id")).toBeNull();
    });

    expect(getConsoleErrorText(errorSpy)).not.toContain(
      "tapClientLookup: Index",
    );
  });

  it("does not log a tapClientLookup crash when MessageByIndex is cleared", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ReadonlyThreadProvider messages={[createUserMessage("m-1")]}>
        <ThreadPrimitiveMessageByIndex
          index={0}
          components={{ Message: RoleMessage }}
        />
      </ReadonlyThreadProvider>,
    );

    expect(screen.getByTestId("message-role").textContent).toBe("user");

    rerender(
      <ReadonlyThreadProvider messages={[]}>
        <ThreadPrimitiveMessageByIndex
          index={0}
          components={{ Message: RoleMessage }}
        />
      </ReadonlyThreadProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("message-role")).toBeNull();
    });

    expect(getConsoleErrorText(errorSpy)).not.toContain(
      "tapClientLookup: Index",
    );
  });
});
