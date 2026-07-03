import { z } from "zod";
import { AddNote, DeleteNote, GetNoteById, GetNoteList, UpdateNote } from "./NoteService.js";
import { AddTask, GetTaskList } from "./TaskService.js";
import { SaveAgentLog } from "./AgentLogService.js";

// AgentActionSchema 是后端 agent flow 的动作白名单。
// 外部调用者只能提交这里列出的 actionName，不能传任意 service/function 名称。
// data 保持 unknown，由每个具体动作再做自己的参数解析，避免一套 schema 硬塞所有动作。
export const AgentActionSchema = z.object({
  actionName: z.enum(["AddTask", "ListTasks", "AddNote", "ListNotes", "GetNote", "UpdateNote", "DeleteNote"]),
  data: z.unknown().optional(),
});

export type AgentActionInput = z.infer<typeof AgentActionSchema>;

// RunAgentAction 是 agent flow 的统一入口。
// 它负责三件事：
// 1. 用 zod 校验 actionName 是否在白名单里；
// 2. 分发到任务/笔记等具体 service；
// 3. 无论成功或失败都写 AgentLog，方便之后审计 AI 做过什么。
export async function RunAgentAction(input: AgentActionInput) {
  // parse 会拒绝未知 actionName，避免 prompt/tool 注入直接调用内部函数。
  const action = AgentActionSchema.parse(input);

  try {
    const result = await RunAgentActionByName(action.actionName, action.data);
    // 成功日志保存原始入参和 service 返回值，便于复盘 agent 操作结果。
    await SaveAgentLog(action.actionName, action.data || {}, result, true);
    return result;
  } catch (error) {
    // 失败也必须落日志；否则排查 agent 自动化问题时只能看到前端报错，看不到后端动作。
    await SaveAgentLog(action.actionName, action.data || {}, ReadErrorMessage(error), false);
    throw error;
  }
}

// 根据 actionName 分发到具体业务 service。
// 这里不做复杂业务逻辑，只做“动作名 -> service 函数”的桥接，降低 agent 层耦合。
async function RunAgentActionByName(actionName: AgentActionInput["actionName"], data: unknown) {
  switch (actionName) {
    case "AddTask":
      // AddTask 自己负责校验任务字段；这里的 never cast 只是把 unknown 交给下游 schema。
      return AddTask(data as never);
    case "ListTasks":
      return GetTaskList();
    case "AddNote":
      return AddNote(data as never);
    case "ListNotes":
      return GetNoteList();
    case "GetNote":
      return GetNoteById(ReadId(data));
    case "UpdateNote": {
      const { id, patch } = ReadIdAndPatch(data);
      return UpdateNote(id, patch as never);
    }
    case "DeleteNote":
      return DeleteNote(ReadId(data));
    default:
      // 理论上 parse 后不会进入 default；保留它是为了类型收窄和未来扩展时的防御兜底。
      throw new Error(`Unsupported agent action: ${actionName}`);
  }
}

// 从 data 中读取单个 id。
// GetNote/DeleteNote 这类动作只需要 id，因此用专门 helper 保持错误信息一致。
function ReadId(data: unknown) {
  const parsed = z.object({ id: z.string().min(1) }).parse(data);
  return parsed.id;
}

// 从 data 中读取 id + patch。
// UpdateNote 需要明确目标 id，并允许 patch 为空对象交给下游 service 再判断具体修改字段。
function ReadIdAndPatch(data: unknown) {
  return z.object({
    id: z.string().min(1),
    patch: z.record(z.string(), z.unknown()).default({}),
  }).parse(data);
}

// 把任意抛出值规整为可写日志的字符串。
// JavaScript 允许 throw 非 Error 值，所以不能只读 error.message。
function ReadErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown agent error.";
}
