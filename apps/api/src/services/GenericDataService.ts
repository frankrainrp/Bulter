type GenericModel = any;

export async function GetGenericList(model: GenericModel) {
  const docs = await model.find().sort({ updatedAt: -1 });
  return docs.map((doc: { data: unknown }) => doc.data);
}

export async function PutGenericItem(model: GenericModel, item: { id?: string }) {
  const clientId = ReadClientId(item);
  const doc = await model.findOneAndUpdate(
    { clientId },
    { clientId, data: item },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc?.data || item;
}

export async function PatchGenericItem(model: GenericModel, id: string, patch: Record<string, unknown>) {
  const existing = await model.findOne({ clientId: id });
  const current = existing?.data && typeof existing.data === "object" ? existing.data : {};
  const next = { ...(current as Record<string, unknown>), ...patch, id, updatedAt: Date.now() };
  return PutGenericItem(model, next);
}

export async function DeleteGenericItem(model: GenericModel, id: string) {
  await model.deleteOne({ clientId: id });
  return { deleted: true, id };
}

export async function ReplaceGenericList(model: GenericModel, items: Array<{ id?: string }>) {
  await model.deleteMany({});
  if (items.length === 0) return [];
  const docs = await model.insertMany(items.map((item) => ({ clientId: ReadClientId(item), data: item })));
  return docs.map((doc: { data: unknown }) => doc.data);
}

function ReadClientId(item: { id?: string }) {
  if (item.id && typeof item.id === "string") return item.id;
  return `item-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
