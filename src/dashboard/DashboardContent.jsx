import { dateFromKey, dateKey, priorities, sortTasks, statuses } from '../model.js';

export const bindingLabels = {
  'tasks-active': 'Active tasks',
  'tasks-total': 'Total tasks',
  'tasks-done': 'Completed tasks',
  'tasks-today': 'Due today',
  'notes-total': 'Total notes',
  'tasks-by-status': 'Task status',
  'tasks-by-priority': 'Task priority',
  'completion-7d': 'Deadlines over the last seven days',
  active: 'Active',
  today: 'Due today',
  upcoming: 'Upcoming',
  completed: 'Completed',
  all: 'All tasks',
};

const colors = ['#18364c', '#437694', '#91b3c5', '#36556a', '#577788', '#7596a8', '#a5bdc8'];

function dailyDeadlines(workspace, today, start, length) {
  const counts = new Map();
  for (const t of workspace.tasks) counts.set(t.dueDate, (counts.get(t.dueDate) ?? 0) + 1);
  const day = dateFromKey(today);
  day.setDate(day.getDate() + start);
  return Array.from({ length }, () => {
    const date = dateKey(day);
    const label = day.toLocaleDateString('en-SG', { weekday: 'short' });
    day.setDate(day.getDate() + 1);
    return { date, label, value: counts.get(date) ?? 0 };
  });
}

function series(metric, workspace, today) {
  if (metric === 'completion-7d') return dailyDeadlines(workspace, today, -6, 7);
  const groupedBy = metric === 'tasks-by-priority' ? 'priority' : 'status';
  const labels = groupedBy === 'priority' ? priorities : statuses;
  return Object.entries(labels).map(([key, label]) => ({
    label,
    value: workspace.tasks.filter((t) => t[groupedBy] === key).length,
  }));
}

// Adapted from Bulter's panel-modules/Charts: the original polar sectors and normalized bar lengths.
function Chart({ data, pie }) {
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const max = Math.max(1, ...data.map((p) => p.value));
  let used = 0;
  const describe = data.map((p) => p.label + ' ' + p.value).join(', ');
  if (!total) return <p className="dashboard-empty">No tasks in this view.</p>;
  return pie ? (
    <div className="dashboard-series">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={describe}>
        {data.map((p, i) => {
          if (!p.value) return null;
          if (p.value === total) return <circle key={p.label} cx="60" cy="60" r="54" fill={colors[i]} />;
          const angle = (value) => (value / total) * 2 * Math.PI - Math.PI / 2;
          const start = angle(used);
          used += p.value;
          const end = angle(used);
          const point = (a) => 60 + 54 * Math.cos(a) + ',' + (60 + 54 * Math.sin(a));
          const arc =
            'M60,60 L' + point(start) + ' A54,54 0 ' + (p.value > total / 2 ? 1 : 0) + ' 1 ' + point(end) + ' Z';
          return <path key={p.label} d={arc} fill={colors[i]} />;
        })}
      </svg>
      <ul>
        {data
          .filter((p) => p.value > 0)
          .map((p) => (
            <li key={p.label}>
              {p.label}{' '}
              <strong>
                {p.value} · {Math.round((100 * p.value) / total)}%
              </strong>
            </li>
          ))}
      </ul>
    </div>
  ) : (
    <svg className="dashboard-bars" viewBox="0 0 320 140" role="img" aria-label={describe}>
      <path d="M22 118H298" stroke="#bbcbd4" fill="none" />
      {data.map((p, i) => {
        const w = (276 - 8 * (data.length - 1)) / data.length,
          x = 22 + i * (w + 8),
          h = (96 * p.value) / max;
        return (
          <g key={i}>
            <rect x={x} y={118 - h} width={w} height={h} fill={colors[i % colors.length]} />
            <text x={x + w / 2} y={114 - h} textAnchor="middle">
              {p.value}
            </text>
            <text x={x + w / 2} y={133} textAnchor="middle">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function DashboardContent({ card, workspace, today }) {
  const { tasks, notes } = workspace;
  const { config } = card;
  switch (card.type) {
    case 'stat': {
      const metric = config.metric ?? 'tasks-active';
      const value =
        metric === 'notes-total'
          ? notes.length
          : metric === 'tasks-total'
            ? tasks.length
            : tasks.filter((t) =>
                metric === 'tasks-done'
                  ? t.status === 'done'
                  : t.status !== 'done' && (metric !== 'tasks-today' || t.dueDate === today)
              ).length;
      return (
        <>
          <strong className="dashboard-number">{value}</strong>
          {card.title !== bindingLabels[metric] && <p>{bindingLabels[metric]}</p>}
        </>
      );
    }
    case 'countdown': {
      const upcoming = !config.targetDate
        ? sortTasks(tasks).find((t) => t.status !== 'done' && t.dueDate >= today)
        : undefined;
      const due = config.targetDate || upcoming?.dueDate;
      if (!due) return <p className="dashboard-empty">No upcoming deadline.</p>;
      const days = (Date.parse(due) - Date.parse(today)) / 86_400_000;
      return (
        <>
          <div className="dashboard-value">
            <strong className="dashboard-number">{Math.abs(days)}</strong>
            <span>
              {days < 0 ? 'days overdue' : days === 0 ? 'due today' : days === 1 ? 'day left' : 'days left'}
            </span>
          </div>
          <p>
            {upcoming && upcoming.taskName + ' · '}
            {due}
          </p>
        </>
      );
    }
    case 'tasklist': {
      const rows = sortTasks(tasks)
        .filter((t) => {
          if (config.filter === 'all') return true;
          if (config.filter === 'completed') return t.status === 'done';
          return (
            t.status !== 'done' &&
            (config.filter === 'today'
              ? t.dueDate === today
              : config.filter === 'upcoming'
                ? t.dueDate >= today
                : true)
          );
        })
        .slice(0, config.limit ?? 6);
      return rows.length ? (
        <ul className="dashboard-list">
          {rows.map((t) => (
            <li key={t.id}>
              <span>{t.taskName}</span>
              <time>{t.dueDate || 'Unscheduled'}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-empty">No matching tasks.</p>
      );
    }
    case 'bar':
    case 'pie':
      return <Chart data={series(config.metric, workspace, today)} pie={card.type === 'pie'} />;
    case 'heatmap': {
      const days = dailyDeadlines(workspace, today, -35, 49),
        max = Math.max(1, ...days.map((d) => d.value));
      return (
        <>
          <div
            className="dashboard-heatmap"
            role="img"
            aria-label={
              days
                .filter((d) => d.value)
                .map((d) => d.date + ' ' + d.value)
                .join(', ') || 'No deadlines during this period'
            }
          >
            {days.map((d) => (
              <span
                key={d.date}
                title={d.date + ' · ' + d.value + ' due'}
                style={{
                  backgroundColor: d.value ? 'rgba(24,54,76,' + (0.25 + (0.75 * d.value) / max) + ')' : '#e4eef3',
                }}
              />
            ))}
          </div>
          <p>
            {days[0].date} – {days[48].date}
          </p>
        </>
      );
    }
  }
}
