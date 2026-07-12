import { Router } from "express";
import { CustomPanelModel } from "../models/CustomPanelModel.js";
import { DeleteGenericItem, GetGenericList, PatchGenericItem, PutGenericItem } from "../services/GenericDataService.js";
import { ReadOwnerId } from "../middleware/AuthMiddleware.js";
import { MakeFail, MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const CustomPanelRoutes = Router();

CustomPanelRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    const ownerId = ReadOwnerId(req);
    // Remove the retired schema-driven App panels instead of rendering their
    // old cryptocurrency sample fallback.
    await CustomPanelModel.deleteMany({
      ownerId,
      $or: [{ "data.kind": "generated" }, { "data.spec": { $exists: true } }],
    });
    res.json(MakeOk(await GetGenericList(CustomPanelModel, ownerId)));
  }),
);

CustomPanelRoutes.put(
  "/:id",
  RunSafe(async (req, res) => {
    if (IsLegacyAppPanel(req.body)) {
      res.status(400).json(MakeFail("The retired App panel format is no longer supported."));
      return;
    }
    res.json(MakeOk(await PutGenericItem(CustomPanelModel, ReadOwnerId(req), { ...req.body, id: req.params.id })));
  }),
);

CustomPanelRoutes.patch(
  "/:id",
  RunSafe(async (req, res) => {
    if (IsLegacyAppPanel(req.body)) {
      res.status(400).json(MakeFail("The retired App panel format is no longer supported."));
      return;
    }
    res.json(MakeOk(await PatchGenericItem(CustomPanelModel, ReadOwnerId(req), req.params.id, req.body || {})));
  }),
);

function IsLegacyAppPanel(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === "generated" || Object.prototype.hasOwnProperty.call(record, "spec");
}

CustomPanelRoutes.delete(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await DeleteGenericItem(CustomPanelModel, ReadOwnerId(req), req.params.id)));
  }),
);
