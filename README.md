# BiTo Study Workspace

C304 Cloud App Development · CA1 Frontend Solution Proposal and Prototype

## Problem and users

A student preparing for a project review often has a deadline in one calendar, a checklist in a message and revision notes in a separate file. Moving the review date can leave the checklist out of date. BiTo gives students one browser workspace for planning study sessions, keeping related notes and checking progress. A task has one record, so changing its date or completion state updates every view that uses it.

## Run the prototype

Install Node.js 22.13 or later. Run these commands in the project folder.

```sh
npm ci
npm start
```

Open the local address printed by Vite. Use `npm test` for the regression suite, `npm run build` for a production build and `npm run preview` to serve that build locally.

The browser entry uses React DOM. Application files use JavaScript and JSX. Selected shared controls use React Native Web for their browser presentation. The project uses Vite and ordinary browser storage. Tasks, Calendar, Notes and Dashboard work without an account or a model key.

## Pages and navigation

| View | Student action | Result |
| --- | --- | --- |
| Tasks | Create a task with a title, due date, time and priority. Change its status or edit its details. | Validation keeps an incomplete form open. Saved changes update the list and the completion summary. |
| Calendar | Choose a day and add a study session. On desktop, switch between month, week and day views. | The session uses the selected date and also appears in Tasks. Selecting an existing entry opens its task editor. |
| Notes | Create a revision note, edit Markdown or open a link between notes. | The desktop file tree, reading view and backlinks use the saved notes. Markdown files can be imported and exported. |
| Dashboard | Use **Customize** to add, edit, move or remove a card. | Statistics, countdowns, task lists, pie charts, bar charts and heatmaps use the current workspace. Card settings survive a reload. |
| Agent | Open Settings to select a provider and model, then ask a question. | An optional provider connection enables chat and supported image models. A model with tool calling can arrange dashboard cards. Reading task, calendar or note content requires the corresponding plugin. |

For a walkthrough, open **Calendar**, add a study session, then find it in **Tasks** and mark it complete. Open **Dashboard** and add a Statistic card using **Completed tasks**. Its value comes from the same task list. On desktop the five views share the top navigation and search. On narrow screens they share the bottom navigation.

[Desktop tasks](docs/screenshots/desktop-tasks.png) · [Desktop dashboard](docs/screenshots/desktop-dashboard.png) · [Mobile calendar](docs/screenshots/mobile-calendar.png)

## Page component tree

```text
App
└── StudyPlanner
    ├── TabBar / DesktopSearch
    ├── AssistantScreen
    │   ├── AssistantChat
    │   └── SettingsPanel → Models / Plugins / Agent Icons
    ├── DesktopTasks or TasksScreen → task rows / completion summary
    ├── CalendarScreen → MonthGrid / agenda / DesktopCalendar
    ├── DesktopNotes or NotesScreen → note list / editor / reading view
    ├── DesktopDashboard → CardForm / DashboardContent
    └── EditorSurface → TaskEditor or TextEditor
```

`StudyPlanner` passes the shared records and update callbacks to each view through props. `TaskEditor` holds its form draft in React state and validates it before saving. Lists render arrays of task or note objects. Conditional rendering handles empty lists, validation messages, storage errors and desktop or narrow layouts.

## Data and CA2 design

On first use the app seeds six fictional study tasks and three linked notes. Dates are relative to the first launch, so the sample includes a missed deadline, work due today and work planned for next week. Refreshing opens the saved records, including an intentionally empty workspace. Tasks and notes persist on the current browser origin. Dashboard layout uses IndexedDB. Chat history stays in memory.

| Planned entity | Fields and relationships |
| --- | --- |
| Workspace and membership | A workspace ID identifies a student's collection. Membership associates an authenticated user with that workspace in CA2. |
| Task | ID, workspace ID, title, description, local due date and time, status, priority and tags. Dates drive Calendar and the dashboard deadline cards. |
| Note | ID, workspace ID, title or vault path, Markdown content and update time. Note links and backlinks are derived from the content. |
| Dashboard card | ID, workspace ID, component type, title, width, order and validated card settings. Cards reference a metric or filter rather than copying a task list. |

The following endpoints are proposed for the Node.js backend in CA2. CA1 reads and updates the local browser workspace.

| Method | Path | Purpose | Expected input and output |
| --- | --- | --- | --- |
| GET | `/api/workspaces/:wid/tasks` | Load the task list or one day of the calendar. | Optional date and status filters. Returns an array of task records. |
| POST | `/api/workspaces/:wid/tasks` | Add a study task. | Title, date, time, status, priority, description and tags. Returns the saved task with its ID. |
| PATCH / DELETE | `/api/workspaces/:wid/tasks/:id` | Reschedule, complete or remove a task. | PATCH accepts changed fields and a revision and returns the updated task. DELETE takes the ID and returns an empty success response. |
| GET / POST | `/api/workspaces/:wid/notes` | List notes or create a note. | GET returns note records. POST accepts a title and Markdown body and returns the new record. |
| PATCH / DELETE | `/api/workspaces/:wid/notes/:id` | Edit or remove a note. | PATCH accepts title or body changes and a revision and returns the saved note. DELETE returns an empty success response. |
| GET | `/api/workspaces/:wid/dashboard` | Load the dashboard layout. | Returns the ordered array of configured cards and a revision. |
| POST | `/api/workspaces/:wid/dashboard/actions` | Apply one layout change. | An add, update, move or remove action with its card settings and revision. Returns the committed layout. |

CA2 should validate membership, task and card fields on the server. A stale revision should return a conflict so that editing a task in one browser does not silently replace changes made in another.

## Project provenance

This prototype adapts the existing BiTo study workspace into a standalone React DOM project. OpenAI Codex assisted with the JavaScript migration, browser adapters, fictional study data and regression verification. Individual student contributions can be traced through each member’s own changes and code explanation.

[C304 project repository](https://github.com/frankrainrp/C304) · [Contributor history](https://github.com/frankrainrp/C304/graphs/contributors)
