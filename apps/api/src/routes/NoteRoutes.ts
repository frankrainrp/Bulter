import { Router } from "express";
import { AddNote, DeleteNote, GetNoteById, GetNoteList, ReplaceNoteList, UpdateNote } from "../services/NoteService.js";
import { ReadOwnerId } from "../middleware/AuthMiddleware.js";
import { MakeFail, MakeOk } from "../utils/ApiResponse.js";
import { RunSafe } from "../utils/RunSafe.js";

export const NoteRoutes = Router();

NoteRoutes.get(
  "/",
  RunSafe(async (req, res) => {
    const notes = await GetNoteList(ReadOwnerId(req));
    res.json(MakeOk(notes));
  }),
);

NoteRoutes.post(
  "/",
  RunSafe(async (req, res) => {
    const note = await AddNote(ReadOwnerId(req), req.body);
    res.status(201).json(MakeOk(note));
  }),
);

NoteRoutes.put(
  "/replace",
  RunSafe(async (req, res) => {
    const notes = await ReplaceNoteList(ReadOwnerId(req), Array.isArray(req.body?.items) ? req.body.items : []);
    res.json(MakeOk(notes));
  }),
);

NoteRoutes.get(
  "/:id",
  RunSafe(async (req, res) => {
    const note = await GetNoteById(ReadOwnerId(req), req.params.id);
    if (!note) {
      res.status(404).json(MakeFail("Note not found."));
      return;
    }
    res.json(MakeOk(note));
  }),
);

NoteRoutes.patch(
  "/:id",
  RunSafe(async (req, res) => {
    const note = await UpdateNote(ReadOwnerId(req), req.params.id, req.body);
    if (!note) {
      res.status(404).json(MakeFail("Note not found."));
      return;
    }
    res.json(MakeOk(note));
  }),
);

NoteRoutes.delete(
  "/:id",
  RunSafe(async (req, res) => {
    const note = await DeleteNote(ReadOwnerId(req), req.params.id);
    if (!note) {
      res.status(404).json(MakeFail("Note not found."));
      return;
    }
    res.json(MakeOk({ deleted: true, id: req.params.id }));
  }),
);
