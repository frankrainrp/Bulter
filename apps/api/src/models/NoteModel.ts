import mongoose, { Schema } from "mongoose";

export type NoteDoc = {
  ownerId: string;
  clientId: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  syncedTodos: string[];
  vaultPath?: string;
  createdAt: Date;
  updatedAt: Date;
};

const NoteSchema = new Schema<NoteDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    syncedTodos: { type: [String], default: [] },
    vaultPath: { type: String, default: undefined },
  },
  { timestamps: true },
);

NoteSchema.index({ ownerId: 1, pinned: 1, updatedAt: -1 });
NoteSchema.index({ title: "text", content: "text" });
NoteSchema.index({ ownerId: 1, clientId: 1 }, { unique: true });

export const NoteModel = mongoose.model<NoteDoc>("Note", NoteSchema);
