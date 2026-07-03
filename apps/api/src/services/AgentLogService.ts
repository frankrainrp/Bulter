import { AgentLogModel } from "../models/AgentLogModel.js";

// 保存 agent 自动动作的审计日志。
// 每一次 RunAgentAction 都会调用这里：
// - ok=true：result 是真实业务 service 的返回值；
// - ok=false：result 是规整后的错误信息。
// 这样即使前端只看到“失败”，后端仍保留 actionName/input/result 的完整排查线索。
export async function SaveAgentLog(actionName: string, input: unknown, result: unknown, ok: boolean) {
  return AgentLogModel.create({
    actionName,
    input,
    result,
    ok,
  });
}
