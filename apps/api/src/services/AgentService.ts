import { z } from "zod";
import { AddNote, DeleteNote, GetNoteById, GetNoteList, UpdateNote } from "./NoteService.js";
import { AddTask, GetTaskList } from "./TaskService.js";
import { SaveAgentLog } from "./AgentLogService.js";

// Public action whitelist for backend agent execution. Callers can submit only
// these action names, not arbitrary service or function names.
export const AgentActionSchema = z.object({
  actionName: z.enum(["AddTask", "ListTasks", "AddNote", "ListNotes", "GetNote", "UpdateNote", "DeleteNote"]),
  data: z.unknown().optional(),
  confirmed: z.boolean().optional().default(false),
});

export type AgentActionInput = z.infer<typeof AgentActionSchema>;

// Single backend entry point for agent actions:
// 1. validate that the action is whitelisted,
// 2. require confirmation for write actions,
// 3. dispatch to the owner-scoped task/note service,
// 4. log both successful and failed attempts for audit/debugging.
export async function RunAgentAction(ownerId: string, input: AgentActionInput) {
  const action = AgentActionSchema.parse(input);

  try {
    if (NeedsConfirmation(action.actionName) && !action.confirmed) {
      const result = {
        ok: false,
        requiresConfirmation: true,
        actionName: action.actionName,
        message: "This agent write action requires explicit confirmation before it can change saved data.",
        proposedInput: action.data || {},
      };
      await SaveAgentLog(ownerId, action.actionName, action.data || {}, result, false);
      return result;
    }

    const result = await RunAgentActionByName(ownerId, action.actionName, action.data);
    await SaveAgentLog(ownerId, action.actionName, action.data || {}, result, true);
    return result;
  } catch (error) {
    await SaveAgentLog(ownerId, action.actionName, action.data || {}, ReadErrorMessage(error), false);
    throw error;
  }
}

// Keep this layer as a small dispatch bridge. Field-level validation and
// owner-scoped persistence stay inside the concrete task/note services.
async function RunAgentActionByName(ownerId: string, actionName: AgentActionInput["actionName"], data: unknown) {
  switch (actionName) {
    case "AddTask":
      return AddTask(ownerId, data as never);
    case "ListTasks":
      return GetTaskList(ownerId);
    case "AddNote":
      return AddNote(ownerId, data as never);
    case "ListNotes":
      return GetNoteList(ownerId);
    case "GetNote":
      return GetNoteById(ownerId, ReadId(data));
    case "UpdateNote": {
      const { id, patch } = ReadIdAndPatch(data);
      return UpdateNote(ownerId, id, patch as never);
    }
    case "DeleteNote":
      return DeleteNote(ownerId, ReadId(data));
    default:
      throw new Error(`Unsupported agent action: ${actionName}`);
  }
}

function NeedsConfirmation(actionName: AgentActionInput["actionName"]) {
  return actionName === "AddTask" || actionName === "AddNote" || actionName === "UpdateNote" || actionName === "DeleteNote";
}

// GetNote/DeleteNote need only a stable note id, so use a tiny helper for a
// consistent validation error shape.
function ReadId(data: unknown) {
  const parsed = z.object({ id: z.string().min(1) }).parse(data);
  return parsed.id;
}

// UpdateNote needs an id plus an optional patch object. Concrete service
// validation decides which patch fields are actually writable.
function ReadIdAndPatch(data: unknown) {
  return z.object({
    id: z.string().min(1),
    patch: z.record(z.string(), z.unknown()).default({}),
  }).parse(data);
}

function ReadErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown agent error.";
}
