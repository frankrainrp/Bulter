import { Router } from "express";
import multer from "multer";
import { RunOcr } from "../services/OcrService.js";
import { RunSafe } from "../utils/RunSafe.js";

const Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const OcrRoutes = Router();

OcrRoutes.post(
  "/",
  Upload.single("file"),
  RunSafe(async (req, res) => {
    const result = await RunOcr(req.file);
    res.status(result.status).json(result);
  }),
);

