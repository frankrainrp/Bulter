import { dashboardCatalog } from './layout.js';

// A provider can disconnect after a layout change commits but before it acknowledges it.
// A retry of that same chat turn must not place a second copy of the card.
export function createDashboardTool(store) {
  let messageId = '';
  let mutations = new Map();
  return function forMessage(id) {
    if (messageId !== id) {
      messageId = id;
      mutations = new Map();
    }
    const ledger = mutations;
    const occurrences = new Map();
    return async function execute(args) {
      if (args.op === 'inspect') {
        if (Object.keys(args).length !== 1) throw new Error('Inspect takes only the op argument.');
        return { layout: await store.getDashboardLayout(), components: dashboardCatalog };
      }
      const signature = JSON.stringify(args, (_key, value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
          : value
      );
      const count = (occurrences.get(signature) ?? 0) + 1;
      occurrences.set(signature, count);
      const key = count + ':' + signature;
      const previous = ledger.get(key);
      if (previous) {
        await previous;
        return { layout: await store.getDashboardLayout(), alreadyApplied: true };
      }
      const saving = store.applyDashboardAction(args);
      ledger.set(key, saving);
      try {
        return { layout: await saving };
      } catch (error) {
        ledger.delete(key);
        throw error;
      }
    };
  };
}
