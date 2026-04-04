// ─────────────────────────────────────────────────────────
// src/routes/player.routes.js — Player CRUD
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import {
  listPlayers,
  getPlayerProfile,
  registerPlayer,
  editPlayer,
} from "../controllers/player.controller.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/players
router.get("/", listPlayers);

// GET /api/players/:id
router.get("/:id", getPlayerProfile);

// POST /api/players  (admin)
router.post("/", requireAdmin, registerPlayer);

// PATCH /api/players/:id  (admin)
router.patch("/:id", requireAdmin, editPlayer);

export default router;
