import mongoose, { Schema } from "mongoose";

export type ChatSessionDoc = {
  ownerId: string;
  clientId: string;
  title: string;
  createdAtMs: number;
  updatedAtMs: number;
  createdAt: Date;
  updatedAt: Date;
};

const ChatSessionSchema = new Schema<ChatSessionDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    title: { type: String, default: "" },
    createdAtMs: { type: Number, required: true },
    updatedAtMs: { type: Number, required: true },
  },
  { timestamps: true },
);

ChatSessionSchema.index({ ownerId: 1, updatedAtMs: -1 });
ChatSessionSchema.index({ ownerId: 1, clientId: 1 }, { unique: true });

export const ChatSessionModel = mongoose.model<ChatSessionDoc>("ChatSession", ChatSessionSchema);
