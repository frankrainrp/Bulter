// The six module types and bindings follow Bulter's CustomPanelView and panel-data
// at fb87792074a6136ab5b87e69657c8b24a9d831f8 (my-app/apps/web/src).
import { validDate } from '../model.js';

export const dashboardCatalog = [
  {
    type: 'stat',
    label: 'Statistic',
    description: 'A live task or note count.',
    metrics: ['tasks-active', 'tasks-total', 'tasks-done', 'tasks-today', 'notes-total'],
  },
  {
    type: 'countdown',
    label: 'Deadline countdown',
    description: 'Days until a chosen date or the nearest active deadline.',
  },
  {
    type: 'tasklist',
    label: 'Task list',
    description: 'Tasks sorted by due date.',
    filters: ['active', 'today', 'upcoming', 'completed', 'all'],
  },
  {
    type: 'pie',
    label: 'Pie chart',
    description: 'Task counts by status or priority.',
    metrics: ['tasks-by-status', 'tasks-by-priority'],
  },
  {
    type: 'bar',
    label: 'Bar chart',
    description: 'Task counts by date, status or priority.',
    metrics: ['completion-7d', 'tasks-by-status', 'tasks-by-priority'],
  },
  { type: 'heatmap', label: 'Deadline heatmap', description: 'Seven weeks of daily deadline counts.' },
];

export const defaultDashboard = {
  version: 1,
  modules: [
    { id: 'active-count', type: 'stat', title: 'Active tasks', span: 1, config: { metric: 'tasks-active' } },
    { id: 'next-deadline', type: 'countdown', title: 'Next deadline', span: 1, config: {} },
    {
      id: 'upcoming-tasks',
      type: 'tasklist',
      title: 'Upcoming tasks',
      span: 1,
      config: { filter: 'upcoming', limit: 6 },
    },
    {
      id: 'week-load',
      type: 'bar',
      title: 'Deadlines in the last 7 days',
      span: 1,
      config: { metric: 'completion-7d' },
    },
  ],
};

function fields(raw, allowed, label) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).some((key) => !allowed.includes(key))
  ) {
    throw new Error('Invalid ' + label + ' fields.');
  }
  return raw;
}

export function moduleDefinition(type) {
  const entry = dashboardCatalog.find((m) => m.type === type);
  if (!entry) throw new Error('Choose an available dashboard module type.');
  return entry;
}

function titleValue(title) {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 80)
    throw new Error('Use a title between 1 and 80 characters.');
  return title.trim();
}

function validatedConfig(type, raw) {
  const def = moduleDefinition(type);
  const allowed =
    'metrics' in def
      ? ['metric']
      : type === 'tasklist'
        ? ['filter', 'limit']
        : type === 'countdown'
          ? ['targetDate']
          : [];
  const cfg = fields(raw, allowed, 'configuration');
  if ('metrics' in def) {
    const metric = cfg.metric === undefined ? def.metrics[0] : cfg.metric;
    if (!def.metrics.some((m) => m === metric)) throw new Error('Choose an available metric for this module.');
    return { metric: metric };
  }
  if ('filters' in def) {
    const filter = cfg.filter === undefined ? 'active' : cfg.filter;
    if (!def.filters.some((f) => f === filter)) throw new Error('Choose an available task filter.');
    const limit = cfg.limit === undefined ? 6 : cfg.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 30)
      throw new Error('Choose a task limit from 1 to 30.');
    return { filter: filter, limit };
  }
  if (type === 'countdown' && cfg.targetDate !== undefined && cfg.targetDate !== '') {
    if (typeof cfg.targetDate !== 'string' || !validDate(cfg.targetDate))
      throw new Error('Choose a real target date in YYYY-MM-DD format.');
    return { targetDate: cfg.targetDate };
  }
  return {};
}

function spanValue(span) {
  if (span !== 1 && span !== 2) throw new Error('Card width must be 1 or 2 columns.');
  return span;
}

function indexValue(index, maximum) {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index > maximum)
    throw new Error('Choose an available card position.');
  return index;
}

export function decodeDashboard(value) {
  if (value === undefined)
    return { version: 1, modules: defaultDashboard.modules.map((m) => ({ ...m, config: { ...m.config } })) };
  const record = fields(value, ['version', 'modules'], 'saved dashboard');
  if (record.version !== 1 || !Array.isArray(record.modules) || record.modules.length > 50)
    throw new Error('The saved dashboard layout could not be read.');
  const ids = new Set();
  const modules = record.modules.map((entry) => {
    const m = fields(entry, ['id', 'type', 'title', 'span', 'config'], 'saved module');
    if (typeof m.id !== 'string' || !m.id || m.id.length > 100 || ids.has(m.id))
      throw new Error('Invalid saved module identifier.');
    ids.add(m.id);
    const { type } = moduleDefinition(m.type);
    return {
      id: m.id,
      type,
      title: titleValue(m.title),
      span: spanValue(m.span),
      config: validatedConfig(type, m.config),
    };
  });
  return { version: 1, modules };
}

export function changeDashboard(current, raw, newId) {
  const op = raw?.op;
  const modules = [...current.modules];
  if (op === 'add') {
    const req = fields(raw, ['op', 'type', 'title', 'span', 'config', 'index'], 'add action');
    if (modules.length >= 50) throw new Error('A dashboard holds up to 50 modules.');
    const def = moduleDefinition(req.type);
    const index = req.index === undefined ? modules.length : indexValue(req.index, modules.length);
    modules.splice(index, 0, {
      id: newId(),
      type: def.type,
      title: titleValue(req.title ?? def.label),
      span: spanValue(req.span ?? 1),
      config: validatedConfig(def.type, req.config ?? {}),
    });
  } else {
    if (op !== 'remove' && op !== 'move' && op !== 'update') throw new Error('Unknown dashboard action.');
    const req = fields(
      raw,
      op === 'update'
        ? ['op', 'id', 'title', 'span', 'config']
        : op === 'move'
          ? ['op', 'id', 'index']
          : ['op', 'id'],
      'dashboard action'
    );
    const index = modules.findIndex((m) => m.id === req.id);
    if (index < 0) throw new Error('This module is no longer on the dashboard.');
    const card = modules[index];
    if (op === 'remove') modules.splice(index, 1);
    if (op === 'move') {
      const next = indexValue(req.index, modules.length - 1);
      modules.splice(index, 1);
      modules.splice(next, 0, card);
    }
    if (op === 'update') {
      if (Object.keys(req).length === 2) throw new Error('Choose a module setting to update.');
      modules[index] = {
        ...card,
        title: req.title === undefined ? card.title : titleValue(req.title),
        span: req.span === undefined ? card.span : spanValue(req.span),
        config:
          req.config === undefined
            ? card.config
            : validatedConfig(card.type, {
                ...card.config,
                ...fields(req.config, ['metric', 'filter', 'limit', 'targetDate'], 'configuration'),
              }),
      };
    }
  }
  return { version: 1, modules };
}
