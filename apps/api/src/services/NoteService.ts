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
});

export const NoteUpdateSchema = NoteInputSchema.partial();

export type NoteInput = z.infer<typeof NoteInputSchema>;
export type NoteUpdate = z.infer<typeof NoteUpdateSchema>;

export async function AddNote(input: NoteInput) {
  const data = NoteInputSchema.parse(input);
  const note = await NoteModel.create({ ...data, clientId: data.clientId || data.id || NewClientId() });
  return ReadNoteDto(note);
}

export async function GetNoteList() {
  const notes = await NoteModel.find().sort({ pinned: -1, updatedAt: -1 });
  return notes.map(ReadNoteDto);
}

export async function GetNoteById(id: string) {
  const note = await NoteModel.findOne({ clientId: id });
  return note ? ReadNoteDto(note) : null;
}

export async function UpdateNote(id: string, input: NoteUpdate) {
  const data = NoteUpdateSchema.parse(input);
  const note = await NoteModel.findOneAndUpdate({ clientId: id }, data, { new: true });
  return note ? ReadNoteDto(note) : null;
}

export async function DeleteNote(id: string) {
  const note = await NoteModel.findOneAndDelete({ clientId: id });
  return note ? ReadNoteDto(note) : null;
}

export async function ReplaceNoteList(inputs: NoteInput[]) {
  const items = z.array(NoteInputSchema).parse(inputs);
  await NoteModel.deleteMany({});
  if (items.length === 0) return [];

  const docs = await NoteModel.insertMany(
    items.map((item) => ({
      ...item,
      clientId: item.clientId || item.id || NewClientId(),
    })),
  );
  return docs.map(ReadNoteDto);
}

function ReadNoteDto(note: { toObject: () => Record<string, unknown> }) {
  const raw = note.toObject();
  const { _id, __v, clientId, ...rest } = raw;
  return {
    id: String(clientId),
    ...rest,
  };
}

function NewClientId() {
  return `note-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
