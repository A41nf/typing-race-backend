// ─────────────────────────────────────────────────────────
// src/routes/leaderboard.routes.js — Rankings
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import {
  getLeaderboard,
  getRecentRaces,
  getPlayerRank,
} from "../controllers/leaderboard.controller.js";

const router = Router();

// GET /api/leaderboard?sort=score|wpm|accuracy&limit=20
router.get("/", getLeaderboard);

// GET /api/leaderboard/recent?limit=10
router.get("/recent", getRecentRaces);

// GET /api/leaderboard/player/:id/rank
router.get("/player/:id/rank", getPlayerRank);

export default router;
