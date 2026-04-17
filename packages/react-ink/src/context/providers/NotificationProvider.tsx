import { createContext, type FC, type ReactNode, useContext } from "react";

export type OSCVariant = "osc9" | "osc99" | "osc777";

export type NotificationEvent =
  | {
      type: "task-complete";
      title: string;
      body?: string;
      threadId?: string;
      messageId?: string;
    }
  | {
      type: "task-incomplete";
      title: string;
      body?: string;
      threadId?: string;
      messageId?: string;
      reason?:
        | "cancelled"
        | "tool-calls"
        | "length"
        | "content-filter"
        | "other"
        | "error";
    }
  | {
      type: "needs-input";
      title: string;
      body?: string;
      threadId?: string;
      messageId?: string;
      reason?: "tool-calls" | "interrupt";
    };

export type NotificationHandlerConfig = {
  bell?: boolean;
  osc?:
    | boolean
    | {
        variant?: OSCVariant;
      };
  custom?: (event: NotificationEvent) => void;
};

export type NotificationConfig = {
  enabled?: boolean;
  onTaskComplete?: NotificationHandlerConfig;
  onTaskIncomplete?: NotificationHandlerConfig;
  onNeedsInput?: NotificationHandlerConfig;
};

const NotificationContext = createContext<NotificationConfig | undefined>(
  undefined,
);

export namespace NotificationProvider {
  export type Props = {
    children: ReactNode;
    config?: NotificationConfig;
  };
}

export const NotificationProvider: FC<NotificationProvider.Props> = ({
  children,
  config,
}) => {
  return (
    <NotificationContext.Provider value={config}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationConfig = () => {
  return useContext(NotificationContext);
};
