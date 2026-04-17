import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";

const mockUseAui = vi.fn();
const mockUseAuiState = vi.fn();
const mockUseFocus = vi.fn();
const mockUseTextBuffer = vi.fn();

type UseAuiStateSelector = Parameters<
  typeof import("@assistant-ui/store")["useAuiState"]
>[0];

type InputHandler = (
  input: string,
  key: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    return?: boolean;
    backspace?: boolean;
    delete?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    upArrow?: boolean;
    downArrow?: boolean;
    home?: boolean;
    end?: boolean;
  },
) => void;

let inputHandler: InputHandler | undefined;

vi.mock("@assistant-ui/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@assistant-ui/store")>();
  return {
    ...actual,
    useAui: () => mockUseAui(),
    useAuiState: (selector: UseAuiStateSelector) => mockUseAuiState(selector),
  };
});

vi.mock("../primitives/composer/useTextBuffer", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../primitives/composer/useTextBuffer")
    >();
  return {
    ...actual,
    useTextBuffer: (text: string) => mockUseTextBuffer(text),
  };
});

vi.mock("ink", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ink")>();
  return {
    ...actual,
    useFocus: () => mockUseFocus(),
    useInput: (handler: InputHandler) => {
      inputHandler = handler;
    },
  };
});

import { ComposerInput } from "../primitives/composer/ComposerInput";

const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  inputHandler = undefined;
});

describe("ComposerInput", () => {
  const createBuffer = (text: string, cursorOffset = text.length) => ({
    text,
    cursorOffset,
    preferredColumn: undefined,
    dispatchAction: vi.fn(),
    insertText: vi.fn(),
    deleteBackward: vi.fn(),
    deleteForward: vi.fn(),
    moveLeft: vi.fn(),
    moveRight: vi.fn(),
    moveUp: vi.fn(),
    moveDown: vi.fn(),
    moveHome: vi.fn(),
    moveEnd: vi.fn(),
    moveWordLeft: vi.fn(),
    moveWordRight: vi.fn(),
    killWordBackward: vi.fn(),
    killStart: vi.fn(),
    killEnd: vi.fn(),
    setText: vi.fn(),
    setCursorOffset: vi.fn(),
  });

  it("maps navigation and insert keys to the text buffer", async () => {
    const state = { composer: { text: "hello" } };
    const buffer = createBuffer("hello", 3);
    const setText = vi.fn();

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector(state as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send: vi.fn(),
        setText,
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput />);
    await flush();

    inputHandler?.("", { leftArrow: true });
    inputHandler?.("X", {});
    inputHandler?.("", { backspace: true });
    inputHandler?.("", { delete: true });
    await flush();

    expect(buffer.dispatchAction).toHaveBeenNthCalledWith(1, {
      type: "move-left",
    });
    expect(buffer.dispatchAction).toHaveBeenNthCalledWith(2, {
      type: "insert",
      text: "X",
    });
    expect(buffer.dispatchAction).toHaveBeenNthCalledWith(3, {
      type: "delete-backward",
    });
    expect(buffer.dispatchAction).toHaveBeenNthCalledWith(4, {
      type: "delete-forward",
    });
    expect(setText).toHaveBeenNthCalledWith(1, "heXllo");
    expect(setText).toHaveBeenNthCalledWith(2, "hello");
    expect(setText).toHaveBeenNthCalledWith(3, "helo");
  });

  it("submits on enter when submitOnEnter is enabled", async () => {
    const send = vi.fn(() => undefined);
    const buffer = createBuffer("hello");

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector({ composer: { text: "hello" } } as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send,
        setText: vi.fn(),
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput submitOnEnter />);
    await flush();

    inputHandler?.("", { return: true });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("uses onSubmit instead of the default send path", async () => {
    const onSubmit = vi.fn();
    const send = vi.fn();
    const buffer = createBuffer("hello");

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector({ composer: { text: "hello" } } as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send,
        setText: vi.fn(),
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput submitOnEnter onSubmit={onSubmit} />);
    await flush();

    inputHandler?.("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(send).not.toHaveBeenCalled();
  });

  it("submits the latest local text after an immediate edit", async () => {
    const onSubmit = vi.fn();
    const buffer = createBuffer("hell", 4);

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector({ composer: { text: "hell" } } as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send: vi.fn(),
        setText: vi.fn(),
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput submitOnEnter onSubmit={onSubmit} />);
    await flush();

    inputHandler?.("o", {});
    inputHandler?.("", { return: true });

    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("inserts a newline in multi-line mode", async () => {
    const state = { composer: { text: "hello" } };
    const buffer = createBuffer("hello");
    const setText = vi.fn();

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector(state as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send: vi.fn(),
        setText,
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput multiLine />);
    await flush();

    inputHandler?.("", { return: true });
    await flush();

    expect(buffer.dispatchAction).toHaveBeenCalledWith({
      type: "insert",
      text: "\n",
    });
    expect(setText).toHaveBeenCalledWith("hello\n");
  });

  it("inserts a newline on ctrl-j in multi-line mode", async () => {
    const state = { composer: { text: "hello" } };
    const buffer = createBuffer("hello");
    const setText = vi.fn();

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector(state as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send: vi.fn(),
        setText,
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput multiLine submitOnEnter />);
    await flush();

    inputHandler?.("j", { ctrl: true });
    await flush();

    expect(buffer.dispatchAction).toHaveBeenCalledWith({
      type: "insert",
      text: "\n",
    });
    expect(setText).toHaveBeenCalledWith("hello\n");
  });

  it("inserts a newline on shift-enter in multi-line submit mode", async () => {
    const state = { composer: { text: "hello" } };
    const buffer = createBuffer("hello");
    const send = vi.fn();
    const setText = vi.fn();

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector(state as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send,
        setText,
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    render(<ComposerInput multiLine submitOnEnter />);
    await flush();

    inputHandler?.("", { return: true, shift: true });
    await flush();

    expect(buffer.dispatchAction).toHaveBeenCalledWith({
      type: "insert",
      text: "\n",
    });
    expect(setText).toHaveBeenCalledWith("hello\n");
    expect(send).not.toHaveBeenCalled();
  });

  it("syncs external store resets back into the local buffer", async () => {
    const state = { composer: { text: "hello" } };
    const buffer = createBuffer("hello");

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector(state as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send: vi.fn(),
        setText: vi.fn(),
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    const instance = render(<ComposerInput placeholder="Type a message..." />);
    await flush();

    state.composer.text = "";
    instance.rerender(<ComposerInput placeholder="Type a message..." />);
    await flush();

    expect(buffer.setText).toHaveBeenCalledWith("");
  });

  it("does not treat local store echoes as external resets", async () => {
    const state = { composer: { text: "hello" } };
    const buffer = createBuffer("hello", 2);
    const setStoreText = vi.fn((text: string) => {
      state.composer.text = text;
    });

    mockUseAuiState.mockImplementation((selector: UseAuiStateSelector) =>
      selector(state as never),
    );
    mockUseTextBuffer.mockReturnValue(buffer);
    mockUseAui.mockReturnValue({
      composer: () => ({
        send: vi.fn(),
        setText: setStoreText,
      }),
    });
    mockUseFocus.mockReturnValue({ isFocused: true });

    const instance = render(<ComposerInput />);
    await flush();

    inputHandler?.("", { delete: true });
    await flush();

    instance.rerender(<ComposerInput />);
    await flush();

    expect(setStoreText).toHaveBeenCalledWith("helo");
    expect(buffer.setText).not.toHaveBeenCalled();
  });
});
