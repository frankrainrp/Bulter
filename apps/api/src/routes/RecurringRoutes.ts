import { Router } from "express";
import { RecurringTaskModel } from "../models/RecurringTaskModel.js";
import { DeleteGenericItem, GetGenericList, PutGenericItem, ReplaceGenericList } from "../services/GenericDataService.js";
import { MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const RecurringRoutes = Router();

RecurringRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await GetGenericList(RecurringTaskModel)));
  }),
);

RecurringRoutes.put(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await PutGenericItem(RecurringTaskModel, { ...req.body, id: req.params.id })));
  }),
);

RecurringRoutes.put(
  "/replace/all",
  RunSafe(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    res.json(MakeOk(await ReplaceGenericList(RecurringTaskModel, items)));
  }),
);

RecurringRoutes.delete(
  "/:id",
  RunSafe(async (req, res) => {
    res.json(MakeOk(await DeleteGenericItem(RecurringTaskModel, req.params.id)));
  }),
);

