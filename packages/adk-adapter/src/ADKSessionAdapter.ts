/**
 * ADK Session Adapter
 *
 * Provides integration between assistant-ui and Google Agent Development Kit (ADK)
 * session management, handling connection lifecycle, message history,
 * streaming responses, and tool call/result handling.
 */

import type {
  ThreadMessage,
  AppendMessage,
  TextContentPart,
  ToolCallContentPart,
  ToolResultContentPart,
} from "@assistant-ui/react";

export interface ADKSessionConfig {
  /** Base URL for the ADK backend */
  baseUrl: string;
  /** Agent name or ID to connect to */
  agentName: string;
  /** Optional user ID for session scoping */
  userId?: string;
  /** Optional remote session ID to reconnect to */
  remoteSessionId?: string;
  /** Timeout in ms for requests (default: 30000) */
  timeoutMs?: number;
}

export interface ADKSessionState {
  sessionId: string | null;
  isConnected: boolean;
  isReconnecting: boolean;
}

export type ADKEventType =
  | "text"
  | "tool_call"
  | "tool_result"
  | "error"
  | "done";

export interface ADKStreamEvent {
  type: ADKEventType;
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
}

/**
 * Normalizes an ADK stream event into assistant-ui content parts.
 */
export function normalizeADKEventToContentParts(
  event: ADKStreamEvent
): Array<TextContentPart | ToolCallContentPart | ToolResultContentPart> {
  switch (event.type) {
    case "text":
      return [
        {
          type: "text" as const,
          text: event.content ?? "",
        },
      ];

    case "tool_call":
      if (!event.toolCallId || !event.toolName) return [];
      return [
        {
          type: "tool-call" as const,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.toolArgs ?? {},
        },
      ];

    case "tool_result":
      if (!event.toolCallId) return [];
      return [
        {
          type: "tool-result" as const,
          toolCallId: event.toolCallId,
          toolName: event.toolName ?? "",
          result: event.toolResult,
          isError: false,
        },
      ];

    default:
      return [];
  }
}

/**
 * Builds the message history payload expected by the ADK backend
 * from assistant-ui ThreadMessages.
 *
 * Note: tool-call and tool-result parts are intentionally excluded here
 * since ADK manages tool state server-side.
 *
 * Note: empty messages are filtered out to avoid sending noise to the backend.
 */
export function buildADKMessageHistory(
  messages: readonly ThreadMessage[]
): Array<{ role: string; content: string }> {
  return messages
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => {
      const textParts = msg.content
        .filter((part): part is TextContentPart => part.type === "text")
        .map((part) => part.text)
        .join("\n");

      return {
        role: msg.role === "user" ? "user" : "model",
        content: textParts,
      };
    })
    .filter((entry) => entry.content.trim().length > 0);
}

/**
 * Extracts the text 