import mongoose, { Schema } from "mongoose";

export type ApiDailyUsageDoc = {
  ownerId: string;
  day: string;
  scope: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const ApiDailyUsageSchema = new Schema<ApiDailyUsageDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    day: { type: String, required: true },
    scope: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

ApiDailyUsageSchema.index({ ownerId: 1, day: 1, scope: 1 }, { unique: true });
ApiDailyUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ApiDailyUsageModel = mongoose.model<ApiDailyUsageDoc>("ApiDailyUsage", ApiDailyUsageSchema);
