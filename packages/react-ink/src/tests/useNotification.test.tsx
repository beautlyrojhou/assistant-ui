import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import type { MessageState } from "@assistant-ui/core/store";
import type { ComposerState } from "@assistant-ui/core/store";

const mockUseAui = vi.fn();
const mockUseAuiState = vi.fn();
const mockUseAuiEvent = vi.fn();

type UseAuiStateSelector = Parameters<
  typeof import("@assistant-ui/store")["useAuiState"]
>[0];

vi.mock("@assistant-ui/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@assistant-ui/store")>();
  return {
    ...actual,
    useAui: () => mockUseAui(),
    useAuiState: (selector: UseAuiStateSelector) => mockUseAuiState(selector),
    useAuiEvent: (selector: string, callback: (...args: unknown[]) => void) =>
      mockUseAuiEvent(selector, callback),
  };
});

import {
  NotificationProvider,
  ringBell,
  sendOSCNotification,
  useNotification,
} from "../index";

type ThreadState = {
  isRunning: boolean;
  messages: MessageState[];
};

let threadState: ThreadState;
let runStartCallback: ((payload: { threadId: string }) => void) | undefined;
let runEndCallback: ((payload: { threadId: string }) => void) | undefined;

beforeEach(() => {
  threadState = { isRunning: false, messages: [] };
  runStartCallback = undefined;
  runEndCallback = undefined;
});

const createAssistantMessage = (
  overrides: Omit<Partial<MessageState>, "id" | "status"> & {
    id: string;
    status: MessageState["status"];
  },
): MessageState => {
  const { id, status, ...rest } = overrides;
  const composer: ComposerState = {
    text: "",
    role: "user",
    attachments: [],
    runConfig: {},
    isEditing: false,
    canCancel: false,
    attachmentAccept: "",
    isEmpty: true,
    type: "thread",
    dictation: undefined,
    quote: undefined,
    queue: [],
  };

  return {
    role: "assistant",
    createdAt: new Date(0),
    parentId: null,
    isLast: true,
    branchNumber: 0,
    branchCount: 1,
    speech: undefined,
    submittedFeedback: undefined,
    composer,
    parts: [],
    isCopied: false,
    isHovering: false,
    index: 0,
    content: [],
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
    id,
    status,
    ...rest,
  } as MessageState;
};

const TestNotifier = ({
  config,
  children,
}: {
  config?: Parameters<typeof useNotification>[0];
  children?: ReactNode;
}) => {
  useNotification(config);
  return <>{children}</>;
};

const renderNotifier = (node: ReactNode = <TestNotifier />) => {
  return render(node);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  threadState = { isRunning: false, messages: [] };
  runStartCallback = undefined;
  runEndCallback = undefined;
});

describe("notification channels", () => {
  it("ringBell writes bell character", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    ringBell();

    expect(writeSpy).toHaveBeenCalledWith("\x07");
    writeSpy.mockRestore();
  });

  it("sendOSCNotification writes osc9 sequence", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    sendOSCNotification("AI Agent", "Task completed");

    expect(writeSpy).toHaveBeenCalledWith("\x1b]9;Task completed\x07");
    writeSpy.mockRestore();
  });

  it("sendOSCNotification writes osc99 sequence", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    sendOSCNotification("AI Agent", "Task completed", "osc99");

    expect(writeSpy).toHaveBeenCalledWith(
      "\x1b]99;i=1:d=0;Task completed\x1b\\",
    );
    writeSpy.mockRestore();
  });

  it("sendOSCNotification writes osc777 sequence", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    sendOSCNotification("AI Agent", "Task completed", "osc777");

    expect(writeSpy).toHaveBeenCalledWith(
      "\x1b]777;notify;AI Agent;Task completed\x07",
    );
    writeSpy.mockRestore();
  });

  it("sendOSCNotification sanitizes escape characters", () => {
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    sendOSCNotification("AI\x1bAgent", "Task\x07completed\x1b", "osc777");

    expect(writeSpy).toHaveBeenCalledWith(
      "\x1b]777;notify;AIAgent;Taskcompleted\x07",
    );
    writeSpy.mockRestore();
  });
});

describe("useNotification", () => {
  const writeSpy = () =>
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  const setupStoreMocks = () => {
    mockUseAui.mockImplementation(() => ({
      thread: () => ({
        getState: () => threadState,
      }),
    }));

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector({ thread: threadState } as never),
    );

    mockUseAuiEvent.mockImplementation(
      (selector: string, callback: (...args: unknown[]) => void) => {
        if (selector === "thread.runStart") {
          runStartCallback = callback as typeof runStartCallback;
        }
        if (selector === "thread.runEnd") {
          runEndCallback = callback as typeof runEndCallback;
        }
      },
    );
  };

  it("emits task-complete after a started run settles as complete", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    runStartCallback?.({ threadId: "thread-1" } as never);
    runEndCallback?.({ threadId: "thread-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "complete", reason: "stop" },
      }),
    ];
    threadState.isRunning = false;
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, "\x07");
    expect(stdoutSpy).toHaveBeenNthCalledWith(
      2,
      "\x1b]9;The assistant finished its run.\x07",
    );
    stdoutSpy.mockRestore();
  });

  it("emits task-incomplete after a started run settles as incomplete", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    runStartCallback?.({ threadId: "thread-1" } as never);
    runEndCallback?.({ threadId: "thread-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "incomplete", reason: "error", error: "boom" },
      }),
    ];
    threadState.isRunning = false;
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).toHaveBeenCalledWith("\x07");
    stdoutSpy.mockRestore();
  });

  it("does not emit task-complete when a started run settles in requires-action", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    runStartCallback?.({ threadId: "thread-1" } as never);
    runEndCallback?.({ threadId: "thread-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    stdoutSpy.mockClear();
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it("emits needs-input when latest assistant message transitions into requires-action", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).toHaveBeenCalledWith("\x07");
    stdoutSpy.mockRestore();
  });

  it("does not emit needs-input for tool-calls requires-action and still emits completion", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    runStartCallback?.({ threadId: "thread-1" } as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "tool-calls" },
      }),
    ];
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).not.toHaveBeenCalled();

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "complete", reason: "stop" },
      }),
    ];
    threadState.isRunning = false;
    runEndCallback?.({ threadId: "thread-1" });
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, "\x07");
    expect(stdoutSpy).toHaveBeenNthCalledWith(
      2,
      "\x1b]9;The assistant finished its run.\x07",
    );
    stdoutSpy.mockRestore();
  });

  it("does not re-notify on rerender with the same requires-action message", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    await new Promise((resolve) => setTimeout(resolve, 0));

    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    stdoutSpy.mockRestore();
  });

  it("notifies again for a new requires-action message id", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m2",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    stdoutSpy.mockRestore();
  });

  it("notifies again when the same message re-enters interrupt requires-action", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    stdoutSpy.mockRestore();
  });

  it("disables notifications when enabled is false", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "requires-action", reason: "interrupt" },
      }),
    ];
    const stdoutSpy = writeSpy();

    const instance = renderNotifier(
      <TestNotifier config={{ enabled: false }} />,
    );
    runStartCallback?.({ threadId: "thread-1" } as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rerender(<TestNotifier config={{ enabled: false }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it("does not emit a stale completion notification after re-enabling notifications", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const stdoutSpy = writeSpy();

    const instance = renderNotifier(
      <TestNotifier config={{ enabled: false }} />,
    );
    runStartCallback?.({ threadId: "thread-1" } as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "complete", reason: "stop" },
      }),
    ];
    threadState.isRunning = false;
    instance.rerender(<TestNotifier config={{ enabled: false }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    instance.rerender(<TestNotifier config={{ enabled: true }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it("emits completion when the hook mounts during an already-running run", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const stdoutSpy = writeSpy();

    const instance = renderNotifier();
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "complete", reason: "stop" },
      }),
    ];
    threadState.isRunning = false;
    runEndCallback?.({ threadId: "thread-1" });
    instance.rerender(<TestNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, "\x07");
    expect(stdoutSpy).toHaveBeenNthCalledWith(
      2,
      "\x1b]9;The assistant finished its run.\x07",
    );
    stdoutSpy.mockRestore();
  });

  it("uses provider defaults when hook config is omitted", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const custom = vi.fn();

    const instance = renderNotifier(
      <NotificationProvider
        config={{
          onTaskComplete: {
            bell: false,
            custom,
          },
        }}
      >
        <TestNotifier />
      </NotificationProvider>,
    );

    runStartCallback?.({ threadId: "thread-1" } as never);
    runEndCallback?.({ threadId: "thread-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "complete", reason: "stop" },
      }),
    ];
    threadState.isRunning = false;
    instance.rerender(
      <NotificationProvider
        config={{
          onTaskComplete: {
            bell: false,
            custom,
          },
        }}
      >
        <TestNotifier />
      </NotificationProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(custom).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task-complete",
        messageId: "m1",
      }),
    );
  });

  it("allows local hook config to override provider defaults", async () => {
    setupStoreMocks();
    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "running" },
      }),
    ];
    threadState.isRunning = true;
    const providerCustom = vi.fn();
    const localCustom = vi.fn();

    const instance = renderNotifier(
      <NotificationProvider
        config={{
          onTaskComplete: {
            bell: false,
            custom: providerCustom,
          },
        }}
      >
        <TestNotifier
          config={{
            onTaskComplete: {
              custom: localCustom,
            },
          }}
        />
      </NotificationProvider>,
    );

    runStartCallback?.({ threadId: "thread-1" } as never);
    runEndCallback?.({ threadId: "thread-1" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    threadState.messages = [
      createAssistantMessage({
        id: "m1",
        status: { type: "complete", reason: "stop" },
      }),
    ];
    threadState.isRunning = false;
    instance.rerender(
      <NotificationProvider
        config={{
          onTaskComplete: {
            bell: false,
            custom: providerCustom,
          },
        }}
      >
        <TestNotifier
          config={{
            onTaskComplete: {
              custom: localCustom,
            },
          }}
        />
      </NotificationProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(providerCustom).not.toHaveBeenCalled();
    expect(localCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "task-complete",
        messageId: "m1",
      }),
    );
  });
});
