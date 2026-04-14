import type {
  Unstable_TriggerCategory,
  Unstable_TriggerItem,
} from "../types/trigger";

// =============================================================================
// Trigger Adapter — generic adapter for any trigger-based popover
// =============================================================================

/**
 * Adapter for providing categories and items to a trigger popover.
 *
 * All methods are synchronous by design — the adapter drives UI display and
 * must return data immediately. Use external state management (e.g. React
 * Query, SWR, or local state) to handle async data fetching, then expose
 * the loaded results synchronously through this adapter.
 */
export type Unstable_TriggerAdapter = {
  /** Return the top-level categories for the trigger popover. */
  categories(): readonly Unstable_TriggerCategory[];

  /** Return items within a category. */
  categoryItems(categoryId: string): readonly Unstable_TriggerItem[];

  /** Global search across all categories (optional). */
  search?(query: string): readonly Unstable_TriggerItem[];
};

// =============================================================================
// Slash Command Item — extends TriggerItem with a kind discriminator
// =============================================================================

export type Unstable_SlashCommandItem = Unstable_TriggerItem & {
  /** `"message"` (default): sends as a chat message. `"command"`: intercepts submit, runs client-side. */
  readonly kind?: Unstable_SlashCommandKind | undefined;
  /** Fires on submit with the text typed after `/command `. */
  readonly onSubmit?: ((args: string) => void | Promise<void>) | undefined;
};

export type Unstable_SlashCommandKind = "message" | "command";

// =============================================================================
// Slash Command Adapter — extends TriggerAdapter with narrower return types
// so consumers get SlashCommandItem directly without casting.
// =============================================================================

export type Unstable_SlashCommandAdapter = Omit<
  Unstable_TriggerAdapter,
  "categoryItems" | "search"
> & {
  /** Return commands within a category. */
  categoryItems(categoryId: string): readonly Unstable_SlashCommandItem[];

  /** Global search across all categories (optional). */
  search?(query: string): readonly Unstable_SlashCommandItem[];
};
