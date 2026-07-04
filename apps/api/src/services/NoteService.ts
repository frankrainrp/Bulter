import { z } from "zod";
import { NoteModel } from "../models/NoteModel.js";

export const NoteInputSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().optional(),
  title: z.string().min(1, "title is required."),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
  syncedTodos: z.array(z.string()).optional(),
  vaultPath: z.string().optional(),
});

export const NoteUpdateSchema = NoteInputSchema.partial();

export type NoteInput = z.infer<typeof NoteInputSchema>;
export type NoteUpdate = z.infer<typeof NoteUpdateSchema>;

export async function AddNote(ownerId: string, input: NoteInput) {
  const data = NoteInputSchema.parse(input);
  const note = await NoteModel.create({ ...data, ownerId, clientId: data.clientId || data.id || NewClientId() });
  return ReadNoteDto(note);
}

export async function GetNoteList(ownerId: string) {
  const notes = await NoteModel.find({ ownerId }).sort({ pinned: -1, updatedAt: -1 });
  return notes.map(ReadNoteDto);
}

export async function GetNoteById(ownerId: string, id: string) {
  const note = await NoteModel.findOne({ ownerId, clientId: id });
  return note ? ReadNoteDto(note) : null;
}

export async function UpdateNote(ownerId: string, id: string, input: NoteUpdate) {
  const data = NoteUpdateSchema.parse(input);
  const note = await NoteModel.findOneAndUpdate({ ownerId, clientId: id }, data, { new: true });
  return note ? ReadNoteDto(note) : null;
}

export async function DeleteNote(ownerId: string, id: string) {
  const note = await NoteModel.findOneAndDelete({ ownerId, clientId: id });
  return note ? ReadNoteDto(note) : null;
}

export async function ReplaceNoteList(ownerId: string, inputs: NoteInput[]) {
  const items = z.array(NoteInputSchema).parse(inputs);
  await NoteModel.deleteMany({ ownerId });
  if (items.length === 0) return [];

  const docs = await NoteModel.insertMany(
    items.map((item) => ({
      ...item,
      ownerId,
      clientId: item.clientId || item.id || NewClientId(),
    })),
  );
  return docs.map(ReadNoteDto);
}

function ReadNoteDto(note: { toObject: () => Record<string, unknown> }) {
  const raw = note.toObject();
  const { _id, __v, ownerId, clientId, ...rest } = raw;
  return {
    id: String(clientId),
    ...rest,
  };
}

function NewClientId() {
  return `note-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
