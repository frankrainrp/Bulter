import mongoose, { Schema } from "mongoose";

export type AgentLogDoc = {
  ownerId: string;
  actionName: string;
  input: unknown;
  result: unknown;
  ok: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const AgentLogSchema = new Schema<AgentLogDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    actionName: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed, default: {} },
    ok: { type: Boolean, required: true },
  },
  { timestamps: true },
);

AgentLogSchema.index({ ownerId: 1, actionName: 1, createdAt: -1 });

export const AgentLogModel = mongoose.model<AgentLogDoc>("AgentLog", AgentLogSchema);
