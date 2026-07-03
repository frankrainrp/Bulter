import { Router } from "express";
import { CustomPanelModel } from "../models/CustomPanelModel.js";
import { DeleteGenericItem, GetGenericList, PatchGenericItem, PutGenericItem } from "../services/GenericDataService.js";
import { MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const CustomPanelRoutes = Router();

CustomPanelRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await GetGenericList(CustomPanelModel)));
  }),
);

CustomPanelRoutes.put(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await PutGenericItem(CustomPanelModel, { ...req.body, id: req.params.id })));
  }),
);

CustomPanelRoutes.patch(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await PatchGenericItem(CustomPanelModel, req.params.id, req.body || {})));
  }),
);

CustomPanelRoutes.delete(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await DeleteGenericItem(CustomPanelModel, req.params.id)));
  }),
);

