import { Router } from "express";
import { StorageItemModel } from "../models/StorageItemModel.js";
import { ReadOwnerId } from "../middleware/AuthMiddleware.js";
import { MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const StorageRoutes = Router();

StorageRoutes.get(
  "/:bucket",
  RunSafe(async (req, res) => {
    const ownerId = ReadOwnerId(req);
    const docs = await StorageItemModel.find({ ownerId, bucket: req.params.bucket }).sort({ updatedAt: -1 });
    res.json(MakeOk(docs.map((doc) => doc.data)));
  }),
);

StorageRoutes.get(
  "/:bucket/:id",
  RunSafe(async (req, res) => {
    const ownerId = ReadOwnerId(req);
    const doc = await StorageItemModel.findOne({ ownerId, bucket: req.params.bucket, clientId: req.params.id });
    res.json(MakeOk(doc?.data || null));
  }),
);

StorageRoutes.put(
  "/:bucket/:id",
  RunSafe(async (req, res) => {
    const ownerId = ReadOwnerId(req);
    const doc = await StorageItemModel.findOneAndUpdate(
      { ownerId, bucket: req.params.bucket, clientId: req.params.id },
      { ownerId, bucket: req.params.bucket, clientId: req.params.id, data: req.body },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json(MakeOk(doc.data));
  }),
);

StorageRoutes.delete(
  "/:bucket/:id",
  RunSafe(async (req, res) => {
    await StorageItemModel.deleteOne({ ownerId: ReadOwnerId(req), bucket: req.params.bucket, clientId: req.params.id });
    res.json(MakeOk({ deleted: true, id: req.params.id }));
  }),
);

StorageRoutes.post(
  "/:bucket/delete-many",
  RunSafe(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    await StorageItemModel.deleteMany({ ownerId: ReadOwnerId(req), bucket: req.params.bucket, clientId: { $in: ids } });
    res.json(MakeOk({ deleted: ids.length }));
  }),
);
