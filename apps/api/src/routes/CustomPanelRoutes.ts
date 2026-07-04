import { Router } from "express";
import { CustomPanelModel } from "../models/CustomPanelModel.js";
import { DeleteGenericItem, GetGenericList, PatchGenericItem, PutGenericItem } from "../services/GenericDataService.js";
import { ReadOwnerId } from "../middleware/AuthMiddleware.js";
import { MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const CustomPanelRoutes = Router();

CustomPanelRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await GetGenericList(CustomPanelModel, ReadOwnerId(req))));
  }),
);

CustomPanelRoutes.put(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await PutGenericItem(CustomPanelModel, ReadOwnerId(req), { ...req.body, id: req.params.id })));
  }),
);

CustomPanelRoutes.patch(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await PatchGenericItem(CustomPanelModel, ReadOwnerId(req), req.params.id, req.body || {})));
  }),
);

CustomPanelRoutes.delete(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await DeleteGenericItem(CustomPanelModel, ReadOwnerId(req), req.params.id)));
  }),
);
