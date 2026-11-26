export const taskFieldNames = {
  taskName: 'Task title',
  description: 'Description',
  dueDate: 'Due date',
  dueTime: 'Due time',
  status: 'Status',
  priority: 'Priority',
  tags: 'Tags',
  goalId: 'Goal',
};

const fields = Object.keys(taskFieldNames);

function same(left, right) {
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((tag, i) => tag === right[i]);
  return left === right;
}

function copyField(into, source, field) {
  into[field] = source[field];
}

export function withSavedFields(draft, saved, chosen) {
  const result = { ...draft };
  chosen.forEach((field) => copyField(result, saved, field));
  return result;
}

export function reviseTasks(tasks, request) {
  const { base } = request;
  const latest = tasks.find((task) => task.id === base.id);
  if (!latest) return { tasks, conflict: { kind: 'deleted' } };
  const updated = fields.filter((field) => !same(base[field], latest[field]));
  if (request.kind === 'delete') {
    if (updated.length) return { tasks, conflict: { kind: 'deleteChanged', latest, fields: updated } };
    return { tasks: tasks.filter((item) => item !== latest) };
  }
  const { draft } = request;
  const edited = fields.filter((field) => !same(base[field], draft[field]));
  const merged = withSavedFields(latest, draft, edited);
  let conflicts = edited.filter((field) => updated.includes(field) && !same(latest[field], draft[field]));
  if (merged.dueTime && !merged.dueDate) {
    // A time and its date must stay valid even when the two tabs edit different fields.
    merged.dueDate = draft.dueDate;
    merged.dueTime = draft.dueTime;
    conflicts = [...new Set([...conflicts, 'dueDate', 'dueTime'])];
  }
  if (conflicts.length) return { tasks, conflict: { kind: 'changed', latest, merged, fields: conflicts } };
  if (fields.every((field) => same(latest[field], merged[field]))) return { tasks };
  return { tasks: tasks.map((item) => (item === latest ? merged : item)) };
}
