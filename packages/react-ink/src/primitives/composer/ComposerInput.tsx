import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";
import { Box, Text, useFocus, useInput } from "ink";
import { useAui, useAuiState } from "@assistant-ui/store";
import { textBufferReducer, useTextBuffer } from "./useTextBuffer";

export type ComposerInputProps = ComponentProps<typeof Box> & {
  /** Submit the message when Enter is pressed. @default false */
  submitOnEnter?: boolean | undefined;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string | undefined;
  /** Whether this input should receive focus automatically. @default true */
  autoFocus?: boolean | undefined;
  /** Allow multi-line editing. @default false */
  multiLine?: boolean | undefined;
  /** Override the default submit behavior. */
  onSubmit?: ((text: string) => void) | undefined;
};

export const ComposerInput = ({
  submitOnEnter = false,
  placeholder = "",
  autoFocus = true,
  multiLine = false,
  onSubmit,
  ...boxProps
}: ComposerInputProps) => {
  const aui = useAui();
  const storeText = useAuiState((s) => s.composer.text);
  const { isFocused } = useFocus({ autoFocus });
  const auiRef = useRef(aui);
  auiRef.current = aui;
  const { text, cursorOffset, preferredColumn, dispatchAction, setText } =
    useTextBuffer(storeText);
  const bufferStateRef = useRef({ text, cursorOffset, preferredColumn });
  const pendingLocalSyncTextsRef = useRef<string[]>([]);
  bufferStateRef.current = { text, cursorOffset, preferredColumn };

  useEffect(() => {
    const pendingLocalSyncIndex =
      pendingLocalSyncTextsRef.current.indexOf(storeText);
    if (pendingLocalSyncIndex !== -1) {
      pendingLocalSyncTextsRef.current = pendingLocalSyncTextsRef.current.slice(
        pendingLocalSyncIndex + 1,
      );
      return;
    }
    if (storeText === text) return;

    pendingLocalSyncTextsRef.current = [];
    setText(storeText);
    bufferStateRef.current = {
      text: storeText,
      cursorOffset: storeText.length,
      preferredColumn: undefined,
    };
  }, [setText, storeText, text]);

  const applyAction = (
    action: Parameters<typeof textBufferReducer>[1],
    options?: { syncText?: boolean },
  ) => {
    const currentState = bufferStateRef.current;
    const nextState = textBufferReducer(currentState, action);
    dispatchAction(action);
    bufferStateRef.current = nextState;

    if (options?.syncText !== false && nextState.text !== currentState.text) {
      pendingLocalSyncTextsRef.current = [
        ...pendingLocalSyncTextsRef.current,
        nextState.text,
      ];
      auiRef.current.composer().setText(nextState.text);
    }
  };

  const submit = () => {
    const submittedText = bufferStateRef.current.text;
    if (onSubmit) {
      onSubmit(submittedText);
      return;
    }

    auiRef.current.composer().send();
  };

  useInput(
    (input, key) => {
      const extendedKey = key as typeof key & {
        home?: boolean;
        end?: boolean;
        shift?: boolean;
      };
      const lowerInput = input.toLowerCase();

      if (key.ctrl) {
        if (lowerInput === "j" && multiLine) {
          applyAction({ type: "insert", text: "\n" });
          return;
        }
        if (lowerInput === "a") {
          applyAction({ type: "move-home", multiLine }, { syncText: false });
          return;
        }
        if (lowerInput === "e") {
          applyAction({ type: "move-end", multiLine }, { syncText: false });
          return;
        }
        if (lowerInput === "w") {
          applyAction({ type: "kill-word-backward" });
          return;
        }
        if (lowerInput === "u") {
          applyAction({ type: "kill-start", multiLine });
          return;
        }
        if (lowerInput === "k") {
          applyAction({ type: "kill-end", multiLine });
          return;
        }
      }

      if (key.meta) {
        if (lowerInput === "b") {
          applyAction({ type: "move-word-left" }, { syncText: false });
          return;
        }
        if (lowerInput === "f") {
          applyAction({ type: "move-word-right" }, { syncText: false });
          return;
        }
      }

      if (key.return) {
        const shouldInsertNewline =
          multiLine && (!submitOnEnter || extendedKey.shift);
        if (shouldInsertNewline) {
          applyAction({ type: "insert", text: "\n" });
          return;
        }

        if (submitOnEnter) {
          submit();
        }
        return;
      }

      if (key.leftArrow) {
        applyAction({ type: "move-left" }, { syncText: false });
        return;
      }

      if (key.rightArrow) {
        applyAction({ type: "move-right" }, { syncText: false });
        return;
      }

      if (multiLine && key.upArrow) {
        applyAction({ type: "move-up" }, { syncText: false });
        return;
      }

      if (multiLine && key.downArrow) {
        applyAction({ type: "move-down" }, { syncText: false });
        return;
      }

      if (extendedKey.home) {
        applyAction({ type: "move-home", multiLine }, { syncText: false });
        return;
      }

      if (extendedKey.end) {
        applyAction({ type: "move-end", multiLine }, { syncText: false });
        return;
      }

      if (key.backspace) {
        applyAction({ type: "delete-backward" });
        return;
      }

      if (key.delete) {
        applyAction({ type: "delete-forward" });
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        applyAction({ type: "insert", text: input });
      }
    },
    { isActive: isFocused },
  );

  const hasText = text.length > 0;
  const isShowingPlaceholder = !hasText && !!placeholder;
  const before = hasText ? text.slice(0, cursorOffset) : "";
  const atCursor = hasText ? (text[cursorOffset] ?? " ") : " ";
  const after = hasText
    ? text.slice(cursorOffset + (cursorOffset < text.length ? 1 : 0))
    : placeholder;

  return (
    <Box {...boxProps}>
      {!isFocused ? (
        <Text dimColor={isShowingPlaceholder}>
          {hasText ? text : placeholder}
        </Text>
      ) : (
        <Text dimColor={isShowingPlaceholder}>
          {hasText ? before : ""}
          <Text inverse>{atCursor}</Text>
          {after}
        </Text>
      )}
    </Box>
  );
};
