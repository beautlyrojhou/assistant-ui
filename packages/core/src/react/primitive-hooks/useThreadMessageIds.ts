import { useRef, useSyncExternalStore } from "react";
import { useAui } from "@assistant-ui/store";

export const useThreadMessageIds = (): readonly string[] => {
  const aui = useAui();
  const idsRef = useRef<readonly string[]>([]);

  return useSyncExternalStore(
    aui.subscribe,
    () => {
      const nextIds = aui
        .thread()
        .getState()
        .messages.map((message) => message.id);
      const previousIds = idsRef.current;

      const isSame =
        previousIds.length === nextIds.length &&
        previousIds.every((id, index) => id === nextIds[index]);

      if (isSame) return previousIds;

      idsRef.current = nextIds;
      return nextIds;
    },
    () => idsRef.current,
  );
};
