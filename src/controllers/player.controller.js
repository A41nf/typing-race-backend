// ─────────────────────────────────────────────────────────
// src/controllers/player.controller.js
// ─────────────────────────────────────────────────────────

import {
  verifyPlayer,
  getPlayer,
  getAllPlayers,
  createPlayer,
  updatePlayerStats,
  updatePlayer,
} from "../models/player.model.js";

/**
 * POST /api/auth/login
 * Body: { id, pin }
 * Returns: player profile + token-like headers
 */
export function login(req, res) {
  const { id, pin } = req.body;

  const player = verifyPlayer(id.trim().toUpperCase(), pin);
  if (!player) {
    return res.status(401).json({
      error: "AUTH_INVALID",
      message: "رقم اللاعب أو الرمز السري غير صحيح",
    });
  }

  // Return player (without PIN)
  const { pin: _, ...safe } = player;
  res.json({
    success: true,
    player: safe,
    headers: {
      "X-Player-Id": player.id,
      "X-Player-Pin": player.pin,
    },
  });
}

/**
 * GET /api/players
 * Returns: all players (public info)
 */
export function listPlayers(_req, res) {
  const players = getAllPlayers().map(({ pin, ...p }) => p);
  res.json({ players });
}

/**
 * GET /api/players/:id
 * Returns: single player profile
 */
export function getPlayerProfile(req, res) {
  const player = getPlayer(req.params.id);
  if (!player) {
    return res.status(404).json({
      error: "PLAYER_NOT_FOUND",
      message: "اللاعب غير موجود",
    });
  }

  const { pin, ...safe } = player;
  res.json({ player: safe });
}

/**
 * POST /api/players
 * Body: { id, pin, name, school, avatar? }
 * Admin only — register a new player.
 */
export function registerPlayer(req, res) {
  const { id, pin, name, school, avatar } = req.body;

  try {
    const player = createPlayer({
      id: id.trim().toUpperCase(),
      pin,
      name,
      school,
      avatar: avatar || "🧑‍🎓",
    });

    const { pin: _, ...safe } = player;
    res.status(201).json({ success: true, player: safe });
  } catch (err) {
    if (err.message === "PLAYER_EXISTS") {
      return res.status(409).json({
        error: "PLAYER_EXISTS",
        message: "رقم اللاعب مستخدم مسبقاً",
      });
    }
    throw err;
  }
}


/**
 * PATCH /api/players/:id
 * Body: { id?, pin?, name?, school?, avatar? }
 * Admin only — edit an existing player.
 */
export function editPlayer(req, res) {
  const currentId = req.params.id?.trim()?.toUpperCase();
  const { id, pin, name, school, avatar } = req.body || {};

  try {
    const player = updatePlayer(currentId, { id, pin, name, school, avatar });
    const { pin: _, ...safe } = player;
    res.json({ success: true, player: safe });
  } catch (err) {
    if (err.message === "PLAYER_NOT_FOUND") {
      return res.status(404).json({
        error: "PLAYER_NOT_FOUND",
        message: "اللاعب غير موجود",
      });
    }

    if (err.message === "PLAYER_EXISTS") {
      return res.status(409).json({
        error: "PLAYER_EXISTS",
        message: "رقم اللاعب مستخدم مسبقاً",
      });
    }

    throw err;
  }
}
