import { z } from "zod";
import { TaskModel } from "../models/TaskModel.js";

export const TaskInputSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().optional(),
  taskName: z.string().min(1, "taskName is required."),
  weight: z.number().nullable().optional(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  description: z.string().optional(),
  isGroupWork: z.boolean().optional(),
  source: z.string().optional(),
  completed: z.boolean().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(["low", "med", "high"]).optional(),
  notes: z.string().optional(),
  noteId: z.string().nullable().optional(),
});

export const TaskUpdateSchema = TaskInputSchema.partial();

export type TaskInput = z.infer<typeof TaskInputSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

export async function AddTask(input: TaskInput) {
  const data = TaskInputSchema.parse(input);
  const task = await TaskModel.create({ ...data, clientId: data.clientId || data.id || NewClientId() });
  return ReadTaskDto(task);
}

export async function GetTaskList() {
  const tasks = await TaskModel.find().sort({ dueDate: 1, dueTime: 1, createdAt: -1 });
  return tasks.map(ReadTaskDto);
}

export async function GetTaskById(id: string) {
  const task = await TaskModel.findOne({ clientId: id });
  return task ? ReadTaskDto(task) : null;
}

export async function UpdateTask(id: string, input: TaskUpdate) {
  const data = TaskUpdateSchema.parse(input);
  const task = await TaskModel.findOneAndUpdate({ clientId: id }, data, { new: true });
  return task ? ReadTaskDto(task) : null;
}

export async function DeleteTask(id: string) {
  const task = await TaskModel.findOneAndDelete({ clientId: id });
  return task ? ReadTaskDto(task) : null;
}

export async function ReplaceTaskList(inputs: TaskInput[]) {
  const items = z.array(TaskInputSchema).parse(inputs);
  await TaskModel.deleteMany({});
  if (items.length === 0) return [];

  const docs = await TaskModel.insertMany(
    items.map((item) => ({
      ...item,
      clientId: item.clientId || item.id || NewClientId(),
    })),
  );
  return docs.map(ReadTaskDto);
}

function ReadTaskDto(task: { toObject: () => Record<string, unknown> }) {
  const raw = task.toObject();
  const { _id, __v, clientId, ...rest } = raw;
  return {
    id: String(clientId),
    ...rest,
  };
}

function NewClientId() {
  return `task-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
