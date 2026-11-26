export const resultPageSize = 24;

function titleRank(title, needle) {
  const text = title.toLowerCase();
  if (text === needle) return 0;
  if (text.startsWith(needle)) return 1;
  return text.includes(needle) ? 2 : 3;
}

export function searchWorkspace(tasks, notes, messages, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const buckets = [[], [], [], []];
  for (const item of tasks) {
    const rank = titleRank(item.taskName, needle);
    if (
      rank < 3 ||
      item.description.toLowerCase().includes(needle) ||
      item.tags.some((tag) => tag.toLowerCase().includes(needle))
    ) {
      buckets[rank].push({
        kind: 'Task',
        item,
        title: item.taskName,
        detail: [item.dueDate, item.dueTime, item.description, ...item.tags].filter(Boolean).join(' · '),
      });
    }
  }
  for (const item of notes) {
    const filename = item.title.slice(item.title.lastIndexOf('/') + 1);
    const rank = Math.min(titleRank(item.title, needle), titleRank(filename, needle));
    if (rank < 3 || item.content.toLowerCase().includes(needle)) {
      buckets[rank].push({ kind: 'Note', item, title: item.title || 'Untitled note', detail: item.content });
    }
  }
  for (const item of messages) {
    if (item.content.toLowerCase().includes(needle)) {
      buckets[3].push({ kind: 'Chat', item, title: item.role === 'user' ? 'You' : 'Agent', detail: item.content });
    }
  }
  return buckets.flat();
}
