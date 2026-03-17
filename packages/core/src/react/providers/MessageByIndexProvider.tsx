import { type FC, type PropsWithChildren } from "react";
import { useAui, AuiProvider, Derived, useAuiState } from "@assistant-ui/store";

export const MessageByIdProvider: FC<
  PropsWithChildren<{
    messageId: string;
  }>
> = ({ messageId, children }) => {
  const aui = useAui({
    message: Derived({
      source: "thread",
      query: { type: "id", id: messageId },
      get: (aui) => aui.thread().message({ id: messageId }),
    }),
    composer: Derived({
      source: "message",
      query: {},
      get: (aui) => aui.thread().message({ id: messageId }).composer(),
    }),
  });

  return <AuiProvider value={aui}>{children}</AuiProvider>;
};

export const MessageByIndexProvider: FC<
  PropsWithChildren<{
    index: number;
  }>
> = ({ index, children }) => {
  const messageId = useAuiState((s) => s.thread.messages[index]?.id ?? null);

  const aui = useAui({
    message: Derived({
      source: "thread",
      query: { type: "index", index },
      get: (aui) => aui.thread().message({ index }),
    }),
    composer: Derived({
      source: "message",
      query: {},
      get: (aui) => aui.thread().message({ index }).composer(),
    }),
  });

  if (messageId == null) return null;

  return <AuiProvider value={aui}>{children}</AuiProvider>;
};
