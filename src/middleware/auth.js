// ─────────────────────────────────────────────────────────
// src/middleware/auth.js — Simple auth middleware
// ─────────────────────────────────────────────────────────
//
// Strategy: Player ID + PIN in headers.
//   X-Player-Id: P001
//   X-Player-Pin: 1234
//
// For admin routes:
//   X-Admin-Token: <ADMIN_SECRET env var>
// ─────────────────────────────────────────────────────────

import { verifyPlayer } from "../models/player.model.js";

/**
 * Require a valid player session.
 * Attaches req.player on success.
 */
export async function requirePlayer(req, res, next) {
  const playerId = req.headers["x-player-id"];
  const playerPin = req.headers["x-player-pin"];

  if (!playerId || !playerPin) {
    return res.status(401).json({
      error: "AUTH_REQUIRED",
      message: "يرجى تسجيل الدخول أولاً",
    });
  }

  const player = await verifyPlayer(playerId, playerPin);
  if (!player) {
    return res.status(401).json({
      error: "AUTH_INVALID",
      message: "رقم اللاعب أو الرمز السري غير صحيح",
    });
  }

  req.player = player;
  next();
}

/**
 * Require admin token for sensitive operations.
 */
export function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  const secret = process.env.ADMIN_SECRET || "shams-admin-2026";

  if (!token || token !== secret) {
    return res.status(403).json({
      error: "ADMIN_REQUIRED",
      message: "صلاحية المشرف مطلوبة",
    });
  }

  next();
}
