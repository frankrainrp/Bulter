import mongoose, { Schema } from "mongoose";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "med" | "high";

export type TaskAttachmentDoc = {
  id: string;
  kind: "url" | "filepath" | "blob";
  label: string;
  ref: string;
  mime?: string;
  size?: number;
};

export type TaskDoc = {
  clientId: string;
  taskName: string;
  weight: number | null;
  dueDate: string;
  dueTime: string;
  description: string;
  isGroupWork: boolean;
  source: string;
  completed: boolean;
  status: TaskStatus;
  tags: string[];
  priority: TaskPriority;
  notes: string;
  attachments: TaskAttachmentDoc[];
  noteId: string | null;
  recurringId?: string;
  createdAt: Date;
  updatedAt: Date;
};

const TaskAttachmentSchema = new Schema<TaskAttachmentDoc>(
  {
    id: { type: String, required: true },
    kind: { type: String, enum: ["url", "filepath", "blob"], required: true },
    label: { type: String, required: true, trim: true },
    ref: { type: String, required: true },
    mime: { type: String, default: undefined },
    size: { type: Number, default: undefined },
  },
  { _id: false },
);

const TaskSchema = new Schema<TaskDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    taskName: { type: String, required: true, trim: true },
    weight: { type: Number, default: null },
    dueDate: { type: String, default: "" },
    dueTime: { type: String, default: "" },
    description: { type: String, default: "" },
    isGroupWork: { type: Boolean, default: false },
    source: { type: String, default: "agent-api" },
    completed: { type: Boolean, default: false },
    status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
    tags: { type: [String], default: [] },
    priority: { type: String, enum: ["low", "med", "high"], default: "med" },
    notes: { type: String, default: "" },
    attachments: { type: [TaskAttachmentSchema], default: [] },
    noteId: { type: String, default: null },
    recurringId: { type: String, default: undefined },
  },
  { timestamps: true },
);

TaskSchema.index({ dueDate: 1, status: 1 });
TaskSchema.index({ taskName: "text", description: "text", notes: "text" });

export const TaskModel = mongoose.model<TaskDoc>("Task", TaskSchema);
