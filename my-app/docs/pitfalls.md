# Integration notes

| Area | Constraint and implementation guidance |
|---|---|
| MiniLM loading | `semantic-filter.ts` loads the transformer runtime dynamically. Preserve its browser-loading path when changing bundler configuration. |
| PDF parsing | Use the installed `unpdf` API. Preserve paragraph splitting and the sliding-window fallback when source text contains few line breaks. |
| State hydration | Wait for IndexedDB hydration before synchronizing state, so initial empty React state cannot overwrite saved records. |
| IndexedDB upgrades | Add a schema version and migration; preserve earlier upgrade steps and normalize serialized date values. |
| Streamed tools | Accumulate tool-call fragments by index before parsing arguments. Preserve the bounded round count. |
| Model identities | Saved route IDs are compatibility keys. The configured endpoint and model determine actual inference. |
| Confirmation | Web proposals use confirmation cards. MCP approvals are controlled by the external client. |
| React rendering | Derive hover and selected styles from state instead of mutating DOM styles that compete with rendering. |
| Empty input | Normalize transient undefined values before calling string methods during development reloads. |
| Typed responses | Use explicit discriminant checks when narrowing OCR success/error unions. |
| Windows | Set the working directory explicitly; PowerShell 5.1 does not support shell `&&`. Stop only the process started for the current task. |
| Assets | Preserve original artwork and use the existing cropped runtime images for layout. |

If an endpoint rejects a model-specific option, inspect the actual provider's request contract. Avoid adding provider-specific parameters merely because a compatibility route ID contains a provider name.
