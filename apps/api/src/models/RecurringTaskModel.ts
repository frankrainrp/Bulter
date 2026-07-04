import mongoose, { Schema } from "mongoose";

export type RecurringTaskDoc = {
  ownerId: string;
  clientId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const RecurringTaskSchema = new Schema<RecurringTaskDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

RecurringTaskSchema.index({ ownerId: 1, clientId: 1 }, { unique: true });

export const RecurringTaskModel = mongoose.model<RecurringTaskDoc>("RecurringTask", RecurringTaskSchema);
