---
"@assistant-ui/core": patch
"@assistant-ui/react": patch
"@assistant-ui/react-native": patch
---

feat: add `<MessagePrimitive.PartGroups>` for hierarchical adjacent grouping of message parts

Introduces a new primitive that coalesces adjacent parts into groups via a user-supplied `groupBy(part) → string | string[] | null`. Adjacent parts sharing a key-path prefix coalesce up to that prefix; shorter paths form implicit leaf runs as siblings of named sub-groups at every depth. The children render function dispatches on `groupKey` — group cases wrap pre-rendered inner content, the `null` case renders `<MessagePrimitive.Parts>` for each leaf run (range scoped via internal context). Node keys are structural (`"0.1.0"`-style sibling-index paths), stable under append-only streaming.

`<MessagePrimitive.Parts>` gains no new public props; internally it reads its render range from `PartRangeContext` when nested under `<PartGroups>`.

Deprecates the legacy `components.ToolGroup`, `components.ReasoningGroup`, and `components.ChainOfThought` props on `<Parts>`, and `<MessagePrimitive.Unstable_PartsGrouped>` for adjacent grouping — all still work for backwards compatibility.
