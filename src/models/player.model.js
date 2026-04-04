// ─────────────────────────────────────────────────────────
// src/models/player.model.js — Player data store
// ─────────────────────────────────────────────────────────
//
// Schema:
//   id:       string  (e.g. "P001")
//   pin:      string  (4-digit)
//   name:     string  (Arabic full name)
//   school:   string
//   avatar:   string  (emoji)
//   score:    number  (cumulative best score)
//   races:    number  (total races completed)
//   wpm:      number  (best WPM)
//   accuracy: number  (best accuracy %)
//   joinedAt: ISO string
// ─────────────────────────────────────────────────────────

const players = new Map();

export function createPlayer({ id, pin, name, school, avatar = "🧑‍🎓" }) {
  if (players.has(id)) {
    throw new Error("PLAYER_EXISTS");
  }

  const player = {
    id,
    pin,
    name,
    school,
    avatar,
    score: 0,
    races: 0,
    wpm: 0,
    accuracy: 0,
    joinedAt: new Date().toISOString(),
  };

  players.set(id, player);
  return player;
}

export function getPlayer(id) {
  return players.get(id) || null;
}

export function getAllPlayers() {
  return Array.from(players.values());
}

export function verifyPlayer(id, pin) {
  const player = players.get(id);
  if (!player) return null;
  if (player.pin !== pin) return null;
  return player;
}


export function updatePlayer(id, updates) {
  const player = players.get(id);
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  const nextId = (updates.id || id).trim().toUpperCase();
  if (nextId !== id && players.has(nextId)) {
    throw new Error("PLAYER_EXISTS");
  }

  const updated = {
    ...player,
    id: nextId,
    pin: (updates.pin ?? player.pin)?.trim?.() ?? player.pin,
    name: updates.name ?? player.name,
    school: updates.school ?? player.school,
    avatar: updates.avatar ?? player.avatar,
  };

  if (nextId !== id) players.delete(id);
  players.set(nextId, updated);
  return updated;
}

export function updatePlayerStats(id, { score, wpm, accuracy }) {
  const player = players.get(id);
  if (!player) throw new Error("PLAYER_NOT_FOUND");

  player.races += 1;
  if (score > player.score) player.score = score;
  if (wpm > player.wpm) player.wpm = wpm;
  if (accuracy > player.accuracy) player.accuracy = accuracy;

  return player;
}

export function deletePlayer(id) {
  return players.delete(id);
}

export function playerCount() {
  return players.size;
}

// ── Reset (for testing) ──
export function resetAllPlayers() {
  players.clear();
}
