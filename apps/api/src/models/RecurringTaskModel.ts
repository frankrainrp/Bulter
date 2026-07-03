import mongoose, { Schema } from "mongoose";

export type RecurringTaskDoc = {
  clientId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const RecurringTaskSchema = new Schema<RecurringTaskDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const RecurringTaskModel = mongoose.model<RecurringTaskDoc>("RecurringTask", RecurringTaskSchema);
