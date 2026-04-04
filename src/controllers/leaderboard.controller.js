// ─────────────────────────────────────────────────────────
// src/controllers/leaderboard.controller.js
// ─────────────────────────────────────────────────────────

import { getTopResults } from "../models/result.model.js";
import { getAllPlayers, getPlayer } from "../models/player.model.js";

/**
 * GET /api/leaderboard
 * Query: ?limit=20&sort=score|wpm|accuracy
 * Returns: ranked leaderboard with player info
 */
export async function getLeaderboard(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const sort = req.query.sort || "score";

  // Get all players and build leaderboard from their best stats
  const players = (await getAllPlayers())
    .filter((p) => p.races > 0) // only players who have raced
    .map(({ pin, ...p }) => p);

  // Sort by requested metric
  const sorted = players.sort((a, b) => {
    if (sort === "wpm") return b.wpm - a.wpm;
    if (sort === "accuracy") return b.accuracy - a.accuracy;
    return b.score - a.score; // default: score
  });

  const leaderboard = sorted.slice(0, limit).map((p, i) => ({
    rank: i + 1,
    playerId: p.id,
    name: p.name,
    school: p.school,
    avatar: p.avatar,
    score: p.score,
    wpm: p.wpm,
    accuracy: p.accuracy,
    races: p.races,
  }));

  res.json({
    sort,
    total: leaderboard.length,
    leaderboard,
  });
}

/**
 * GET /api/leaderboard/recent
 * Query: ?limit=10
 * Returns: most recent race results (global feed)
 */
export async function getRecentRaces(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const results = getTopResults(200); // get a pool

  // Sort by date descending, take limit
  const recent = await Promise.all(results
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map(async (r) => {
      const player = await getPlayer(r.playerId);
      return {
        ...r,
        playerName: player?.name || "Unknown",
        playerAvatar: player?.avatar || "🧑‍🎓",
        playerSchool: player?.school || "",
      };
    }));

  res.json({ count: recent.length, results: recent });
}

/**
 * GET /api/leaderboard/player/:id/rank
 * Returns: a specific player's rank across all metrics
 */
export async function getPlayerRank(req, res) {
  const player = await getPlayer(req.params.id);
  if (!player) {
    return res.status(404).json({
      error: "PLAYER_NOT_FOUND",
      message: "اللاعب غير موجود",
    });
  }

  const players = (await getAllPlayers())
    .filter((p) => p.races > 0)
    .map(({ pin, ...p }) => p);

  const byScore = [...players].sort((a, b) => b.score - a.score);
  const byWPM = [...players].sort((a, b) => b.wpm - a.wpm);
  const byAccuracy = [...players].sort((a, b) => b.accuracy - a.accuracy);

  const scoreRank = byScore.findIndex((p) => p.id === player.id) + 1;
  const wpmRank = byWPM.findIndex((p) => p.id === player.id) + 1;
  const accuracyRank = byAccuracy.findIndex((p) => p.id === player.id) + 1;

  res.json({
    playerId: player.id,
    name: player.name,
    ranks: {
      score: { rank: scoreRank || null, value: player.score, total: byScore.length },
      wpm: { rank: wpmRank || null, value: player.wpm, total: byWPM.length },
      accuracy: { rank: accuracyRank || null, value: player.accuracy, total: byAccuracy.length },
    },
  });
}
