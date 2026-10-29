# Butler demo walkthrough

[Download source from main](https://github.com/frankrainrp/Bulter/archive/refs/heads/main.zip)

## Start the application

Use Node.js 20 or newer and pnpm 9, as specified by the workspace. After extracting the ZIP, open a terminal in `Bulter-main/my-app`:

```sh
corepack enable
corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by the development server. Create a local demo account, then choose English in the language control or Preferences.

The application workspace is `my-app/`. The separate MCP server is in `butler-mcp/`; it is not required for this walkthrough.

## Follow one study task

Use fictional records in a fresh browser profile or a separate local origin.

1. Open **Tasks** and select **New Task**.
2. Enter **Review SQLite transactions** as the title, add a short description, and choose a due date.
3. Save the task and open it from the list to check its details.
4. Open **Calendar** and find the same task on its due date.
5. Return to **Tasks**, complete the task, and open **Completed** to see its final state.
6. Reload the page and check that the task is still completed.

This sequence demonstrates manual task planning, the calendar view, and browser persistence. It does not require a generated AI reply.

## Optional features

The current main routes chat through the OpenAI SDK to a configured DeepSeek endpoint. Model-backed chat, extraction, and research require their service configuration; OCR also has a separate provider configuration. This walkthrough does not include an inference result.

The standalone MCP server exposes tools through a separate JSON vault. Connecting it does not automatically turn the browser's IndexedDB records into shared live server data.

## Where records are stored

SQLite stores login accounts and sessions. Tasks, notes, and workspace records in this version are held in browser IndexedDB. Use the same browser origin to follow the saved task after reloading.

## Source references

- [Application workspace and setup](https://github.com/frankrainrp/Bulter/tree/main/my-app)
- [Tasks panel](https://github.com/frankrainrp/Bulter/blob/main/my-app/apps/web/src/components/TasksPanel.tsx)
- [Calendar panel](https://github.com/frankrainrp/Bulter/blob/main/my-app/apps/web/src/components/CalendarPanel.tsx)
- [Browser storage](https://github.com/frankrainrp/Bulter/blob/main/my-app/apps/web/src/lib/db.ts)
- [Chat route](https://github.com/frankrainrp/Bulter/blob/main/my-app/apps/web/src/app/api/chat/route.ts)
- [Separate MCP server](https://github.com/frankrainrp/Bulter/tree/main/butler-mcp)
