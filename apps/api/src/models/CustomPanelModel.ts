import mongoose, { Schema } from "mongoose";

export type CustomPanelDoc = {
  ownerId: string;
  clientId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const CustomPanelSchema = new Schema<CustomPanelDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

CustomPanelSchema.index({ ownerId: 1, clientId: 1 }, { unique: true });

export const CustomPanelModel = mongoose.model<CustomPanelDoc>("CustomPanel", CustomPanelSchema);
