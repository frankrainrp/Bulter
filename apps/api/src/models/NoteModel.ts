import mongoose, { Schema } from "mongoose";

export type NoteDoc = {
  clientId: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  syncedTodos: string[];
  createdAt: Date;
  updatedAt: Date;
};

const NoteSchema = new Schema<NoteDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    syncedTodos: { type: [String], default: [] },
  },
  { timestamps: true },
);

NoteSchema.index({ pinned: 1, updatedAt: -1 });
NoteSchema.index({ title: "text", content: "text" });

export const NoteModel = mongoose.model<NoteDoc>("Note", NoteSchema);
