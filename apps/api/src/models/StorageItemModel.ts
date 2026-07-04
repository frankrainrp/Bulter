import mongoose, { Schema } from "mongoose";

export type StorageItemDoc = {
  ownerId: string;
  bucket: string;
  clientId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const StorageItemSchema = new Schema<StorageItemDoc>(
  {
    ownerId: { type: String, required: true, index: true },
    bucket: { type: String, required: true },
    clientId: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

StorageItemSchema.index({ ownerId: 1, bucket: 1, clientId: 1 }, { unique: true });

export const StorageItemModel = mongoose.model<StorageItemDoc>("StorageItem", StorageItemSchema);
