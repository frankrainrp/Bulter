import mongoose, { Schema } from "mongoose";

export type CustomPanelDoc = {
  clientId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const CustomPanelSchema = new Schema<CustomPanelDoc>(
  {
    clientId: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const CustomPanelModel = mongoose.model<CustomPanelDoc>("CustomPanel", CustomPanelSchema);
