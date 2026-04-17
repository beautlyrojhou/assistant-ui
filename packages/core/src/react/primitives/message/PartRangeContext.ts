import { createContext } from "react";

/**
 * Internal context that scopes `<MessagePrimitive.Parts>` to a subset of the
 * message's parts. Set by `<MessagePrimitive.PartGroups>` when rendering each
 * group node; a `<Parts>` rendered outside any `<PartGroups>` sees `null` and
 * falls back to rendering the whole message.
 *
 * The value is an ordered list of part indices into `message.parts`.
 */
export const PartRangeContext = createContext<readonly number[] | null>(null);
