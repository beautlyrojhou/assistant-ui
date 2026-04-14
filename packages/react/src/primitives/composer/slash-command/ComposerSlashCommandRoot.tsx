"use client";

import {
  type ReactNode,
  type FC,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import type {
  Unstable_SlashCommandAdapter,
  Unstable_SlashCommandItem,
} from "@assistant-ui/core";
import { useAui } from "@assistant-ui/store";
import { ComposerPrimitiveTriggerPopoverRoot } from "../trigger/TriggerPopoverContext";
import type { OnSelectBehavior } from "../trigger/TriggerPopoverResource";
import {
  useComposerInputPluginRegistryOptional,
  type ComposerInputPlugin,
} from "../ComposerInputPluginContext";

// =============================================================================
// SlashCommandRoot — convenience wrapper around TriggerPopoverRoot
// =============================================================================

export namespace ComposerPrimitiveSlashCommandRoot {
  export type Props = {
    children: ReactNode;
    /** The adapter providing slash command categories and items. */
    adapter: Unstable_SlashCommandAdapter;
    /** Character(s) that trigger the popover. @default "/" */
    trigger?: string | undefined;
  };
}

/**
 * `TriggerPopoverRoot` pre-configured for `/` slash commands.
 *
 * Selecting a command inserts `/command ` into the composer. On submit,
 * `onSubmit(args)` fires. `kind: "command"` items intercept the submit and
 * clear the composer; `kind: "message"` (default) proceeds through the normal
 * send path. See {@link Unstable_SlashCommandItem}.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Unstable_SlashCommandRoot adapter={slashAdapter}>
 *   <ComposerPrimitive.Input />
 *   <ComposerPrimitive.Unstable_TriggerPopoverPopover>
 *     <ComposerPrimitive.Unstable_TriggerPopoverItems>
 *       {(items) => items.map((item, index) => (
 *         <ComposerPrimitive.Unstable_TriggerPopoverItem key={item.id} item={item} index={index}>
 *           {item.label}
 *         </ComposerPrimitive.Unstable_TriggerPopoverItem>
 *       ))}
 *     </ComposerPrimitive.Unstable_TriggerPopoverItems>
 *   </ComposerPrimitive.Unstable_TriggerPopoverPopover>
 * </ComposerPrimitive.Unstable_SlashCommandRoot>
 * ```
 */
export const ComposerPrimitiveSlashCommandRoot: FC<
  ComposerPrimitiveSlashCommandRoot.Props
> = ({ children, adapter, trigger = "/" }) => {
  const aui = useAui();
  const pluginRegistry = useComposerInputPluginRegistryOptional();

  const activeCommandRef = useRef<{
    item: Unstable_SlashCommandItem;
    prefix: string;
  } | null>(null);

  // Clear the active command if the user deletes the `/command ` prefix.
  useEffect(() => {
    return aui.subscribe(() => {
      const active = activeCommandRef.current;
      if (!active) return;

      const text = aui.composer().getState().text;
      if (!text.startsWith(active.prefix)) {
        activeCommandRef.current = null;
      }
    });
  }, [aui]);

  const sendPlugin = useMemo<ComposerInputPlugin>(
    () => ({
      handleKeyDown(e) {
        const active = activeCommandRef.current;
        if (!active) return false;

        if (e.key === "Enter" && !e.shiftKey) {
          const text = aui.composer().getState().text;
          const args = text.slice(active.prefix.length).trim();
          const kind = active.item.kind ?? "message";

          active.item.onSubmit?.(args);
          activeCommandRef.current = null;

          if (kind === "command") {
            e.preventDefault();
            aui.composer().setText("");
            return true;
          }
          return false;
        }

        return false;
      },
      setCursorPosition() {},
    }),
    [aui],
  );

  useEffect(() => {
    if (!pluginRegistry) return undefined;
    return pluginRegistry.register(sendPlugin);
  }, [sendPlugin, pluginRegistry]);

  const handler = useCallback(
    (item: Unstable_SlashCommandItem) => {
      const prefix = `${trigger}${item.id} `;
      aui.composer().setText(prefix);
      activeCommandRef.current = { item, prefix };
    },
    [trigger, aui],
  );

  const onSelect = useMemo<OnSelectBehavior>(
    () => ({ type: "action", handler }),
    [handler],
  );

  return (
    <ComposerPrimitiveTriggerPopoverRoot
      adapter={adapter}
      trigger={trigger}
      onSelect={onSelect}
    >
      {children}
    </ComposerPrimitiveTriggerPopoverRoot>
  );
};

ComposerPrimitiveSlashCommandRoot.displayName =
  "ComposerPrimitive.SlashCommandRoot";
