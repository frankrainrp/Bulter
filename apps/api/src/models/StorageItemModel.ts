import mongoose, { Schema } from "mongoose";

export type StorageItemDoc = {
  bucket: string;
  clientId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const StorageItemSchema = new Schema<StorageItemDoc>(
  {
    bucket: { type: String, required: true },
    clientId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

StorageItemSchema.index({ bucket: 1, clientId: 1 }, { unique: true });

export const StorageItemModel = mongoose.model<StorageItemDoc>("StorageItem", StorageItemSchema);

