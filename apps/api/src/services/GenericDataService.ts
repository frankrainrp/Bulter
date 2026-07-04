import type { Model } from "mongoose";

type GenericDataDoc = {
  ownerId: string;
  clientId: string;
  data: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

type GenericModel<T extends GenericDataDoc> = Model<T>;

export async function GetGenericList<T extends GenericDataDoc>(model: GenericModel<T>, ownerId: string) {
  const docs = await model.find({ ownerId }).sort({ updatedAt: -1 });
  return docs.map((doc: { data: unknown }) => doc.data);
}

export async function PutGenericItem<T extends GenericDataDoc>(model: GenericModel<T>, ownerId: string, item: { id?: string }) {
  const clientId = ReadClientId(item);
  const doc = await model.findOneAndUpdate(
    { ownerId, clientId },
    { ownerId, clientId, data: item },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc?.data || item;
}

export async function PatchGenericItem<T extends GenericDataDoc>(model: GenericModel<T>, ownerId: string, id: string, patch: Record<string, unknown>) {
  const existing = await model.findOne({ ownerId, clientId: id });
  const current = existing?.data && typeof existing.data === "object" ? existing.data : {};
  const next = { ...(current as Record<string, unknown>), ...patch, id, updatedAt: Date.now() };
  return PutGenericItem(model, ownerId, next);
}

export async function DeleteGenericItem<T extends GenericDataDoc>(model: GenericModel<T>, ownerId: string, id: string) {
  await model.deleteOne({ ownerId, clientId: id });
  return { deleted: true, id };
}

export async function ReplaceGenericList<T extends GenericDataDoc>(model: GenericModel<T>, ownerId: string, items: Array<{ id?: string }>) {
  await model.deleteMany({ ownerId });
  if (items.length === 0) return [];
  const docs = await model.insertMany(items.map((item) => ({ ownerId, clientId: ReadClientId(item), data: item })));
  return docs.map((doc: { data: unknown }) => doc.data);
}

function ReadClientId(item: { id?: string }) {
  if (item.id && typeof item.id === "string") return item.id;
  return `item-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
