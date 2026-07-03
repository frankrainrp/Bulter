import mongoose, { Schema } from "mongoose";

export type AgentLogDoc = {
  actionName: string;
  input: unknown;
  result: unknown;
  ok: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const AgentLogSchema = new Schema<AgentLogDoc>(
  {
    actionName: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: {} },
    ok: { type: Boolean, required: true },
  },
  { timestamps: true },
);

AgentLogSchema.index({ actionName: 1, createdAt: -1 });

export const AgentLogModel = mongoose.model<AgentLogDoc>("AgentLog", AgentLogSchema);

