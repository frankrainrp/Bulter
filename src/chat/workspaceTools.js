import { dashboardCatalog } from '../dashboard/layout.js';

const filters = ['all', 'today', 'thisWeek', 'later', 'completed', 'active'];
export const workspaceTools = [
  {
    name: 'list_items',
    label: 'Task list',
    hint: 'Share matching task titles, dates, times and completion status.',
    description:
      'List up to eight local tasks. today, thisWeek (today through seven days from now) and later return unfinished tasks.',
    parameters: {
      type: 'object',
      properties: { filter: { type: 'string', enum: filters } },
      additionalProperties: false,
    },
  },
  {
    name: 'list_calendar',
    label: 'Calendar day',
    hint: 'Share scheduled task titles, times and completion status for one date.',
    description: 'Read up to eight local scheduled tasks for one date. Omit date to read today.',
    parameters: {
      type: 'object',
      properties: { date: { type: 'string', description: 'A local date in YYYY-MM-DD format.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'search_notes',
    label: 'Note search',
    hint: 'Share up to five matching note titles and short excerpts.',
    description:
      'Find local notes containing a literal search term. Returns at most five matching titles and short excerpts.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', minLength: 1, maxLength: 100 } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'customize_dashboard',
    label: 'Dashboard layout',
    hint: 'Arrange Detroit UI cards on your local dashboard.',
    description:
      'Customize the dashboard using its built-in Detroit UI components when the user asks to change their dashboard. Inspect first for the current layout, supported components and settings. Add a component by type, or update, remove or move it by its existing id. index is zero-based, span is 1 or 2 columns. Layout actions change only the arrangement and settings of cards.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['inspect', 'add', 'update', 'remove', 'move'] },
        type: { type: 'string', enum: dashboardCatalog.map((component) => component.type) },
        id: { type: 'string' },
        title: { type: 'string' },
        span: { type: 'integer', enum: [1, 2] },
        index: { type: 'integer', minimum: 0 },
        config: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            filter: { type: 'string' },
            targetDate: { type: 'string' },
            limit: { type: 'integer' },
          },
          additionalProperties: false,
        },
      },
      required: ['op'],
      additionalProperties: false,
    },
  },
];

export const toolsOff = {
  list_items: false,
  list_calendar: false,
  search_notes: false,
  customize_dashboard: false,
};

export function supportsWorkspaceTool(connection, name) {
  return connection === 'model' || (connection === 'server' && name === 'list_items');
}

export function createWorkspaceTools(workspace, permissions, connection, today, weekEnd, dashboard) {
  const definitions = workspaceTools.filter(
    (tool) =>
      permissions[tool.name] &&
      supportsWorkspaceTool(connection, tool.name) &&
      (tool.name !== 'customize_dashboard' || dashboard)
  );
  function execute(name, args) {
    if (!definitions.some((tool) => tool.name === name))
      return { ok: false, message: 'That tool is unavailable in this workspace.' };
    if (!args || typeof args !== 'object' || Array.isArray(args))
      return { ok: false, message: 'Expected an argument object.' };
    const input = args;
    if (name === 'customize_dashboard' && dashboard) {
      return dashboard(input).then(
        (data) => ({ ok: true, message: 'Current dashboard layout.', data: [data] }),
        (error) => ({
          ok: false,
          message: error instanceof Error ? error.message : 'The dashboard could not be updated.',
        })
      );
    }
    const key = name === 'search_notes' ? 'query' : name === 'list_items' ? 'filter' : 'date';
    if (Object.keys(input).some((k) => k !== key)) return { ok: false, message: 'Unexpected tool argument.' };
    if (name === 'search_notes') {
      if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 100)
        return { ok: false, message: 'Supply a search term of 1–100 characters.' };
      const term = input.query.trim().toLowerCase();
      const data = [];
      for (const note of workspace.notes) {
        const at = note.content.toLowerCase().indexOf(term);
        if (at < 0 && !note.title.toLowerCase().includes(term)) continue;
        const start = Math.max(0, at - 40);
        data.push({
          title: note.title.slice(0, 120),
          ...(at >= 0 ? { excerpt: note.content.slice(start, start + 160) } : {}),
        });
        if (data.length === 5) break;
      }
      return { ok: true, message: 'Up to five matching notes.', data };
    }
    const date = input.date === undefined ? today : input.date;
    const filter = input.filter === undefined ? 'all' : input.filter;
    if (typeof filter !== 'string' || !filters.includes(filter))
      return { ok: false, message: 'Unknown task filter.' };
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d\d-\d\d$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      return { ok: false, message: 'Use a real YYYY-MM-DD date.' };
    const matches = workspace.tasks
      .filter((task) => {
        if (name === 'list_calendar') return task.dueDate === date;
        if (filter === 'all') return true;
        if (filter === 'completed') return task.status === 'done';
        if (task.status === 'done') return false;
        if (filter === 'active') return true;
        if (filter === 'today') return task.dueDate === today;
        if (filter === 'thisWeek') return task.dueDate >= today && task.dueDate <= weekEnd;
        return task.dueDate > weekEnd;
      })
      .sort(
        (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.dueTime.localeCompare(b.dueTime)
      );
    const data = matches
      .slice(0, 8)
      .map((task) => ({
        taskName: task.taskName.slice(0, 120),
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        completed: task.status === 'done',
      }));
    return { ok: true, message: `Showing ${data.length} of ${matches.length} matching items.`, data };
  }
  return { definitions, execute, today };
}
