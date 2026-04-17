import { useCallback, useReducer } from "react";

export type TextBufferState = {
  text: string;
  cursorOffset: number;
  preferredColumn: number | undefined;
};

export type TextBufferAction =
  | { type: "insert"; text: string }
  | { type: "delete-backward" }
  | { type: "delete-forward" }
  | { type: "move-left" }
  | { type: "move-right" }
  | { type: "move-up" }
  | { type: "move-down" }
  | { type: "move-home"; multiLine: boolean }
  | { type: "move-end"; multiLine: boolean }
  | { type: "move-word-left" }
  | { type: "move-word-right" }
  | { type: "kill-word-backward" }
  | { type: "kill-start"; multiLine: boolean }
  | { type: "kill-end"; multiLine: boolean }
  | { type: "set-text"; text: string }
  | { type: "set-cursor"; cursorOffset: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getLineStart = (text: string, cursorOffset: number) => {
  const lineBreakIndex = text.lastIndexOf("\n", Math.max(0, cursorOffset - 1));
  return lineBreakIndex === -1 ? 0 : lineBreakIndex + 1;
};

const getLineEnd = (text: string, cursorOffset: number) => {
  const lineBreakIndex = text.indexOf("\n", cursorOffset);
  return lineBreakIndex === -1 ? text.length : lineBreakIndex;
};

const getLineRange = (text: string, cursorOffset: number) => {
  const start = getLineStart(text, cursorOffset);
  const end = getLineEnd(text, cursorOffset);
  return { start, end };
};

const getPreviousWordOffset = (text: string, cursorOffset: number) => {
  let nextOffset = cursorOffset;

  while (nextOffset > 0 && /\s/.test(text[nextOffset - 1]!)) {
    nextOffset -= 1;
  }

  while (nextOffset > 0 && !/\s/.test(text[nextOffset - 1]!)) {
    nextOffset -= 1;
  }

  return nextOffset;
};

const getNextWordOffset = (text: string, cursorOffset: number) => {
  let nextOffset = cursorOffset;

  while (nextOffset < text.length && /\s/.test(text[nextOffset]!)) {
    nextOffset += 1;
  }

  while (nextOffset < text.length && !/\s/.test(text[nextOffset]!)) {
    nextOffset += 1;
  }

  return nextOffset;
};

const moveVertical = (
  text: string,
  cursorOffset: number,
  preferredColumn: number | undefined,
  direction: -1 | 1,
) => {
  const { start, end } = getLineRange(text, cursorOffset);
  const currentColumn = preferredColumn ?? cursorOffset - start;
  const adjacentBreakIndex = direction === -1 ? start - 1 : end;

  if (adjacentBreakIndex < 0 || adjacentBreakIndex >= text.length) {
    return { cursorOffset, preferredColumn: currentColumn };
  }

  const adjacentCursorBase =
    direction === -1 ? adjacentBreakIndex : adjacentBreakIndex + 1;
  const adjacentRange = getLineRange(text, adjacentCursorBase);
  const nextCursorOffset = clamp(
    adjacentRange.start + currentColumn,
    adjacentRange.start,
    adjacentRange.end,
  );

  return {
    cursorOffset: nextCursorOffset,
    preferredColumn: currentColumn,
  };
};

const clearPreferredColumn = (
  state: TextBufferState,
  cursorOffset: number,
) => ({
  ...state,
  cursorOffset,
  preferredColumn: undefined,
});

export const textBufferReducer = (
  state: TextBufferState,
  action: TextBufferAction,
): TextBufferState => {
  switch (action.type) {
    case "insert": {
      if (!action.text) return state;

      const nextText =
        state.text.slice(0, state.cursorOffset) +
        action.text +
        state.text.slice(state.cursorOffset);
      const nextCursorOffset = state.cursorOffset + action.text.length;
      return clearPreferredColumn(
        { ...state, text: nextText },
        nextCursorOffset,
      );
    }

    case "delete-backward": {
      if (state.cursorOffset === 0) return state;

      const nextText =
        state.text.slice(0, state.cursorOffset - 1) +
        state.text.slice(state.cursorOffset);
      return clearPreferredColumn(
        { ...state, text: nextText },
        state.cursorOffset - 1,
      );
    }

    case "delete-forward": {
      if (state.cursorOffset >= state.text.length) return state;

      const nextText =
        state.text.slice(0, state.cursorOffset) +
        state.text.slice(state.cursorOffset + 1);
      return clearPreferredColumn(
        { ...state, text: nextText },
        state.cursorOffset,
      );
    }

    case "move-left":
      return clearPreferredColumn(state, Math.max(0, state.cursorOffset - 1));

    case "move-right":
      return clearPreferredColumn(
        state,
        Math.min(state.text.length, state.cursorOffset + 1),
      );

    case "move-up": {
      const next = moveVertical(
        state.text,
        state.cursorOffset,
        state.preferredColumn,
        -1,
      );
      return { ...state, ...next };
    }

    case "move-down": {
      const next = moveVertical(
        state.text,
        state.cursorOffset,
        state.preferredColumn,
        1,
      );
      return { ...state, ...next };
    }

    case "move-home": {
      const nextCursorOffset = action.multiLine
        ? getLineStart(state.text, state.cursorOffset)
        : 0;
      return clearPreferredColumn(state, nextCursorOffset);
    }

    case "move-end": {
      const nextCursorOffset = action.multiLine
        ? getLineEnd(state.text, state.cursorOffset)
        : state.text.length;
      return clearPreferredColumn(state, nextCursorOffset);
    }

    case "move-word-left":
      return clearPreferredColumn(
        state,
        getPreviousWordOffset(state.text, state.cursorOffset),
      );

    case "move-word-right":
      return clearPreferredColumn(
        state,
        getNextWordOffset(state.text, state.cursorOffset),
      );

    case "kill-word-backward": {
      const nextCursorOffset = getPreviousWordOffset(
        state.text,
        state.cursorOffset,
      );
      if (nextCursorOffset === state.cursorOffset) return state;

      const nextText =
        state.text.slice(0, nextCursorOffset) +
        state.text.slice(state.cursorOffset);
      return clearPreferredColumn(
        { ...state, text: nextText },
        nextCursorOffset,
      );
    }

    case "kill-start": {
      const rangeStart = action.multiLine
        ? getLineStart(state.text, state.cursorOffset)
        : 0;
      if (rangeStart === state.cursorOffset) return state;

      const nextText =
        state.text.slice(0, rangeStart) + state.text.slice(state.cursorOffset);
      return clearPreferredColumn({ ...state, text: nextText }, rangeStart);
    }

    case "kill-end": {
      const rangeEnd = action.multiLine
        ? getLineEnd(state.text, state.cursorOffset)
        : state.text.length;
      if (rangeEnd === state.cursorOffset) return state;

      const nextText =
        state.text.slice(0, state.cursorOffset) + state.text.slice(rangeEnd);
      return clearPreferredColumn(
        { ...state, text: nextText },
        state.cursorOffset,
      );
    }

    case "set-text":
      return {
        text: action.text,
        cursorOffset: action.text.length,
        preferredColumn: undefined,
      };

    case "set-cursor":
      return clearPreferredColumn(
        state,
        clamp(action.cursorOffset, 0, state.text.length),
      );
  }
};

export const createTextBufferState = (text = ""): TextBufferState => ({
  text,
  cursorOffset: text.length,
  preferredColumn: undefined,
});

export const useTextBuffer = (text = "") => {
  const [state, dispatch] = useReducer(
    textBufferReducer,
    createTextBufferState(text),
  );
  const dispatchAction = useCallback(
    (action: TextBufferAction) => dispatch(action),
    [],
  );

  return {
    ...state,
    dispatchAction,
    insertText: useCallback(
      (nextText: string) => dispatch({ type: "insert", text: nextText }),
      [],
    ),
    deleteBackward: useCallback(
      () => dispatch({ type: "delete-backward" }),
      [],
    ),
    deleteForward: useCallback(() => dispatch({ type: "delete-forward" }), []),
    moveLeft: useCallback(() => dispatch({ type: "move-left" }), []),
    moveRight: useCallback(() => dispatch({ type: "move-right" }), []),
    moveUp: useCallback(() => dispatch({ type: "move-up" }), []),
    moveDown: useCallback(() => dispatch({ type: "move-down" }), []),
    moveHome: useCallback(
      (multiLine: boolean) => dispatch({ type: "move-home", multiLine }),
      [],
    ),
    moveEnd: useCallback(
      (multiLine: boolean) => dispatch({ type: "move-end", multiLine }),
      [],
    ),
    moveWordLeft: useCallback(() => dispatch({ type: "move-word-left" }), []),
    moveWordRight: useCallback(() => dispatch({ type: "move-word-right" }), []),
    killWordBackward: useCallback(
      () => dispatch({ type: "kill-word-backward" }),
      [],
    ),
    killStart: useCallback(
      (multiLine: boolean) => dispatch({ type: "kill-start", multiLine }),
      [],
    ),
    killEnd: useCallback(
      (multiLine: boolean) => dispatch({ type: "kill-end", multiLine }),
      [],
    ),
    setText: useCallback(
      (nextText: string) => dispatch({ type: "set-text", text: nextText }),
      [],
    ),
    setCursorOffset: useCallback(
      (cursorOffset: number) => dispatch({ type: "set-cursor", cursorOffset }),
      [],
    ),
  };
};
