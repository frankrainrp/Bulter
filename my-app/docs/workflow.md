# Development workflow

1. Read the current status and the reference for the component being changed.
2. Inspect the affected implementation and preserve unrelated working changes.
3. Implement the requested behavior using the existing component and storage boundaries.
4. Verify the affected behavior with synthetic data. Build the web application for web code changes; run MCP smoke checks for MCP changes.
5. Update the relevant English technical reference and the current-status record.
6. Review the diff for accidental data, generated dependencies, credentials and unsupported feature claims before committing.

For inference changes, keep conversation context bounded, assemble streamed tool calls by index, and preserve confirmation before web writes. Test endpoint/model overrides and failures using a controlled transport before making live model requests.

Keep historical implementation details in Git history. `PROGRESS.md` describes the current state and recent release changes; it is not an accumulating transcript. Architecture decisions belong in `architecture.md`, setup belongs in `setup.md`, and integration failures belong in `pitfalls.md`.
