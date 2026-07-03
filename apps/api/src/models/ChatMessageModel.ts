import mongoose, { Schema } from "mongoose";

export type StoredUploadedFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
};

export type ChatMessageDoc = {
  clientId: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  files: StoredUploadedFile[];
  reasoning: string;
  isError: boolean;
  timestampMs: number;
  createdAt: Date;
  updatedAt: Date;
};

const StoredUploadedFileSchema = new Schema<StoredUploadedFile>(
  {
    id: { type: String, required: true },
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    mime: { type: String, default: "application/octet-stream" },
  },
  { _id: false },
);

const ChatMessageSchema = new Schema<ChatMessageDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    files: { type: [StoredUploadedFileSchema], default: [] },
    reasoning: { type: String, default: "" },
    isError: { type: Boolean, default: false },
    timestampMs: { type: Number, required: true },
  },
  { timestamps: true },
);

ChatMessageSchema.index({ sessionId: 1, timestampMs: 1 });

export const ChatMessageModel = mongoose.model<ChatMessageDoc>("ChatMessage", ChatMessageSchema);
