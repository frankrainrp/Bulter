import { Router } from "express";
import { AddTask, DeleteTask, GetTaskById, GetTaskList, ReplaceTaskList, UpdateTask } from "../services/TaskService.js";
import { MakeFail, MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const TaskRoutes = Router();

TaskRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    const tasks = await GetTaskList();
    res.json(MakeOk(tasks));
  }),
);

TaskRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    const task = await AddTask(req.body);
    res.status(201).json(MakeOk(task));
  }),
);

TaskRoutes.put(
  "/replace",
  RunSafe(async (req, res) => {
    const tasks = await ReplaceTaskList(Array.isArray(req.body?.items) ? req.body.items : []);
    res.json(MakeOk(tasks));
  }),
);

TaskRoutes.get(
  "/:id",
  RunSafe(async (req, res) => {
    const task = await GetTaskById(req.params.id);
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
    const task = await UpdateTask(req.params.id, req.body);
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
    const task = await DeleteTask(req.params.id);
    if (!task) {
      res.status(404).json(MakeFail("Task not found."));
      return;
    }
    res.json(MakeOk({ deleted: true, id: req.params.id }));
  }),
);
