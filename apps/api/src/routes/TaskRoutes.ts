import { Router } from "express";
import { AddTask, DeleteTask, GetTaskById, GetTaskList, ReplaceTaskList, UpdateTask } from "../services/TaskService.js";
import { ReadOwnerId } from "../middleware/AuthMiddleware.js";
import { MakeFail, MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const TaskRoutes = Router();

TaskRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    const tasks = await GetTaskList(ReadOwnerId(req));
    res.json(MakeOk(tasks));
  }),
);

TaskRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    const task = await AddTask(ReadOwnerId(req), req.body);
    res.status(201).json(MakeOk(task));
  }),
);

TaskRoutes.put(
  "/replace",
  RunSafe(async (req, res) => {
    const tasks = await ReplaceTaskList(ReadOwnerId(req), Array.isArray(req.body?.items) ? req.body.items : []);
    res.json(MakeOk(tasks));
  }),
);

TaskRoutes.get(
  "/:id",
  RunSafe(async (req, res) => {
    const task = await GetTaskById(ReadOwnerId(req), req.params.id);
    if (!task) {
      res.status(404).json(MakeFail("Task not found."));
      return;
    }
    res.json(MakeOk(task));
  }),
);

TaskRoutes.patch(
  "/:id",
  RunSafe(async (req, res) => {
    const task = await UpdateTask(ReadOwnerId(req), req.params.id, req.body);
    if (!task) {
      res.status(404).json(MakeFail("Task not found."));
      return;
    }
    res.json(MakeOk(task));
  }),
);

TaskRoutes.delete(
  "/:id",
  RunSafe(async (req, res) => {
    const task = await DeleteTask(ReadOwnerId(req), req.params.id);
    if (!task) {
      res.status(404).json(MakeFail("Task not found."));
      return;
    }
    res.json(MakeOk({ deleted: true, id: req.params.id }));
  }),
);
