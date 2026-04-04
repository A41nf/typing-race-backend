// ─────────────────────────────────────────────────────────
// src/models/result.model.js — Race result store
// ─────────────────────────────────────────────────────────
//
// Schema:
//   id:           string  (nanoid)
//   playerId:     string
//   tournamentId: string | null
//   round:        number  (1=quarter, 2=semi, 3=final)
//   wpm:          number
//   accuracy:     number  (0–100)
//   score:        number
//   time:         number  (seconds)
//   correctChars: number
//   totalKeys:    number
//   textId:       string  (index into race texts)
//   createdAt:    ISO string
// ─────────────────────────────────────────────────────────

import { nanoid } from "nanoid";

const results = [];

export function createResult({
  playerId,
  tournamentId = null,
  round = null,
  wpm,
  accuracy,
  score,
  time,
  correctChars,
  totalKeys,
  textId = null,
}) {
  const result = {
    id: nanoid(12),
    playerId,
    tournamentId,
    round,
    wpm: Math.round(wpm),
    accuracy: Math.round(accuracy),
    score: Math.round(score),
    time: Math.round(time * 10) / 10,
    correctChars,
    totalKeys,
    textId,
    createdAt: new Date().toISOString(),
  };

  results.push(result);
  return result;
}

export function getResultsByPlayer(playerId) {
  return results
    .filter((r) => r.playerId === playerId)
    .sort((a, b) => b.score - a.score);
}

export function getResultsByTournament(tournamentId) {
  return results
    .filter((r) => r.tournamentId === tournamentId)
    .sort((a, b) => b.score - a.score);
}

export function getResultsByRound(tournamentId, round) {
  return results
    .filter((r) => r.tournamentId === tournamentId && r.round === round)
    .sort((a, b) => b.score - a.score);
}

export function getTopResults(limit = 50) {
  return [...results].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getAllResults() {
  return [...results];
}

export function resetAllResults() {
  results.length = 0;
}
