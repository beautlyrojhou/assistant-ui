import { useEffect, useMemo, useRef } from "react";
import type { MessageState } from "@assistant-ui/core/store";
import { useAuiEvent, useAuiState } from "@assistant-ui/store";
import {
  useNotificationConfig,
  type NotificationConfig,
  type NotificationEvent,
  type NotificationHandlerConfig,
  type OSCVariant,
} from "../context/providers/NotificationProvider";
import { ringBell, sendOSCNotification } from "./notification-channels";

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: true,
  onTaskComplete: {
    bell: true,
    osc: { variant: "osc9" },
  },
  onTaskIncomplete: {
    bell: true,
  },
  onNeedsInput: {
    bell: true,
  },
};

const mergeHandlerConfig = (
  base: NotificationHandlerConfig | undefined,
  override: NotificationHandlerConfig | undefined,
): NotificationHandlerConfig | undefined => {
  if (!base) return override;
  if (!override) return base;

  const bell = override.bell ?? base.bell;
  const osc = override.osc ?? base.osc;
  const custom = override.custom ?? base.custom;

  return {
    ...(bell !== undefined ? { bell } : {}),
    ...(osc !== undefined ? { osc } : {}),
    ...(custom !== undefined ? { custom } : {}),
  };
};

const mergeConfig = (
  base: NotificationConfig | undefined,
  override: NotificationConfig | undefined,
): NotificationConfig => {
  const onTaskComplete = mergeHandlerConfig(
    base?.onTaskComplete,
    override?.onTaskComplete,
  );
  const onTaskIncomplete = mergeHandlerConfig(
    base?.onTaskIncomplete,
    override?.onTaskIncomplete,
  );
  const onNeedsInput = mergeHandlerConfig(
    base?.onNeedsInput,
    override?.onNeedsInput,
  );

  return {
    enabled: override?.enabled ?? base?.enabled ?? true,
    ...(onTaskComplete !== undefined ? { onTaskComplete } : {}),
    ...(onTaskIncomplete !== undefined ? { onTaskIncomplete } : {}),
    ...(onNeedsInput !== undefined ? { onNeedsInput } : {}),
  };
};

const findLatestAssistantMessage = (
  messages: readonly MessageState[],
): MessageState | undefined => {
  return messages.findLast((message) => message.role === "assistant");
};

const getNotificationKey = (
  threadId: string | undefined,
  message: Pick<MessageState, "id" | "status"> | undefined,
) =>
  `${threadId ?? "unknown"}:${message?.id ?? "none"}:${message?.status?.type ?? "none"}`;

const getNeedsInputKey = (
  threadId: string | undefined,
  message: Pick<MessageState, "id" | "status">,
) =>
  `${getNotificationKey(threadId, message)}:${message.status?.type === "requires-action" ? message.status.reason : "none"}`;

const threadIdProps = (threadId: string | undefined) =>
  threadId !== undefined ? { threadId } : {};

const notifyWithConfig = (
  handler: NotificationHandlerConfig | undefined,
  event: NotificationEvent,
) => {
  if (!handler) return;

  if (handler.bell) {
    ringBell();
  }

  if (handler.osc) {
    const variant: OSCVariant =
      typeof handler.osc === "object"
        ? (handler.osc.variant ?? "osc9")
        : "osc9";
    sendOSCNotification(event.title, event.body, variant);
  }

  handler.custom?.(event);
};
const createRunEndEvent = (
  threadId: string | undefined,
  message: MessageState | undefined,
): NotificationEvent | undefined => {
  if (!message || message.role !== "assistant" || !message.status)
    return undefined;

  switch (message.status.type) {
    case "complete":
      return {
        type: "task-complete",
        title: "AI task complete",
        body: "The assistant finished its run.",
        messageId: message.id,
        ...threadIdProps(threadId),
      };
    case "incomplete":
      return {
        type: "task-incomplete",
        title: "AI task stopped",
        body: `The assistant stopped with reason: ${message.status.reason}.`,
        messageId: message.id,
        reason: message.status.reason,
        ...threadIdProps(threadId),
      };
    default:
      return undefined;
  }
};

const createNeedsInputEvent = (
  threadId: string | undefined,
  message: MessageState,
): NotificationEvent | undefined => {
  if (
    message.role !== "assistant" ||
    message.status?.type !== "requires-action" ||
    message.status.reason !== "interrupt"
  ) {
    return undefined;
  }

  return {
    type: "needs-input",
    title: "AI needs input",
    body: "The assistant is waiting for approval or external input.",
    messageId: message.id,
    reason: message.status.reason,
    ...threadIdProps(threadId),
  };
};

export const useNotification = (config?: NotificationConfig) => {
  const providerConfig = useNotificationConfig();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const latestAssistantMessage = useAuiState((s) =>
    findLatestAssistantMessage(s.thread.messages),
  );

  const resolvedConfig = useMemo(
    () => mergeConfig(mergeConfig(DEFAULT_CONFIG, providerConfig), config),
    [providerConfig, config],
  );

  const lastRunEndKeyRef = useRef<string | undefined>(undefined);
  const lastNeedsInputKeyRef = useRef<string | undefined>(undefined);
  const latestThreadIdRef = useRef<string | undefined>(undefined);
  const pendingRunRef = useRef(isRunning);

  useEffect(() => {
    if (resolvedConfig.enabled === false) {
      pendingRunRef.current = false;
      return;
    }

    if (isRunning) {
      pendingRunRef.current = true;
    }
  }, [isRunning, resolvedConfig.enabled]);

  useAuiEvent("thread.runStart", ({ threadId }) => {
    latestThreadIdRef.current = threadId;
    if (resolvedConfig.enabled === false) return;
    pendingRunRef.current = true;
  });

  useAuiEvent("thread.runEnd", ({ threadId }) => {
    latestThreadIdRef.current = threadId;
  });

  useEffect(() => {
    const statusType = latestAssistantMessage?.status?.type;

    if (resolvedConfig.enabled === false) return;
    if (!latestAssistantMessage) return;
    if (!pendingRunRef.current) return;
    if (statusType !== "complete" && statusType !== "incomplete") return;

    const threadId = latestThreadIdRef.current;
    const event = createRunEndEvent(threadId, latestAssistantMessage);
    if (!event) return;

    const key = getNotificationKey(threadId, latestAssistantMessage);
    if (lastRunEndKeyRef.current === key) return;

    lastRunEndKeyRef.current = key;
    pendingRunRef.current = false;
    const handler =
      event.type === "task-complete"
        ? resolvedConfig.onTaskComplete
        : resolvedConfig.onTaskIncomplete;
    notifyWithConfig(handler, event);
  }, [latestAssistantMessage, resolvedConfig]);

  useEffect(() => {
    if (resolvedConfig.enabled === false) return;
    if (!latestAssistantMessage) {
      lastNeedsInputKeyRef.current = undefined;
      return;
    }
    if (latestAssistantMessage.status?.type !== "requires-action") {
      lastNeedsInputKeyRef.current = undefined;
      return;
    }

    const key = getNeedsInputKey(
      latestThreadIdRef.current,
      latestAssistantMessage,
    );
    if (lastNeedsInputKeyRef.current === key) return;

    const event = createNeedsInputEvent(
      latestThreadIdRef.current,
      latestAssistantMessage,
    );
    if (!event) return;

    pendingRunRef.current = false;
    lastNeedsInputKeyRef.current = key;
    notifyWithConfig(resolvedConfig.onNeedsInput, event);
  }, [latestAssistantMessage, resolvedConfig]);
};

export type {
  NotificationConfig,
  NotificationEvent,
  NotificationHandlerConfig,
  OSCVariant,
};
