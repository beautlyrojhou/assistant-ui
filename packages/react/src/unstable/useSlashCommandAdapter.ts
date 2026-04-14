"use client";

import { useMemo, useRef } from "react";
import type {
  Unstable_SlashCommandAdapter,
  Unstable_SlashCommandItem,
  Unstable_SlashCommandKind,
  Unstable_TriggerCategory,
} from "@assistant-ui/core";

export type Unstable_SlashCommandDefinition = {
  /** Unique command name (e.g. "summarize"). */
  readonly name: string;
  /** Display label (e.g. "/summarize"). */
  readonly label?: string | undefined;
  /** Short description shown in the popover. */
  readonly description?: string | undefined;
  /** Icon identifier. */
  readonly icon?: string | undefined;
  /** `"message"` (default): sends as a chat message. `"command"`: intercepts submit, runs client-side. */
  readonly kind?: Unstable_SlashCommandKind | undefined;
  /** Fires on submit with the text typed after `/command `. */
  readonly onSubmit?: ((args: string) => void | Promise<void>) | undefined;
};

export type Unstable_UseSlashCommandAdapterOptions = {
  /** List of available slash commands. */
  commands: readonly Unstable_SlashCommandDefinition[];
};

/**
 * @deprecated This API is still under active development and might change without notice.
 *
 * Creates a SlashCommandAdapter from a list of command definitions.
 *
 * @example
 * ```tsx
 * unstable_useSlashCommandAdapter({
 *   commands: [
 *     { name: "summarize", description: "Summarize the conversation" },
 *     { name: "translate", description: "Translate text", onSubmit: (args) => track(args) },
 *     { name: "rename", kind: "command", description: "Rename thread", onSubmit: (n) => rename(n) },
 *     { name: "help", kind: "command", description: "Show help", onSubmit: () => openHelp() },
 *   ],
 * });
 * ```
 */
function useSlashCommandAdapter(
  options: Unstable_UseSlashCommandAdapterOptions,
): Unstable_SlashCommandAdapter {
  // Ref keeps adapter identity stable so tap memos don't reset the popover highlight on every render.
  const commandsRef = useRef(options.commands);
  commandsRef.current = options.commands;

  return useMemo<Unstable_SlashCommandAdapter>(() => {
    const getItems = (): Unstable_SlashCommandItem[] =>
      commandsRef.current.map((cmd) => ({
        id: cmd.name,
        type: "command",
        label: cmd.label ?? `/${cmd.name}`,
        description: cmd.description,
        icon: cmd.icon,
        kind: cmd.kind,
        onSubmit: cmd.onSubmit,
      }));

    return {
      // No categories — slash commands show items directly via search mode
      categories(): Unstable_TriggerCategory[] {
        return [];
      },

      categoryItems(): Unstable_SlashCommandItem[] {
        return [];
      },

      search(query: string): Unstable_SlashCommandItem[] {
        const items = getItems();
        if (!query) return items;
        const lower = query.toLowerCase();
        return items.filter(
          (item) =>
            item.id.toLowerCase().includes(lower) ||
            item.label.toLowerCase().includes(lower) ||
            item.description?.toLowerCase().includes(lower),
        );
      },
    };
  }, []);
}

export { useSlashCommandAdapter as unstable_useSlashCommandAdapter };
