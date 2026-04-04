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

import { db } from "../config/firebaseAdmin.js";

const playersCollection = db.collection("players");

export async function createPlayer({ id, pin, name, school, avatar = "🧑‍🎓" }) {
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

  const playerRef = playersCollection.doc(id);
  const snapshot = await playerRef.get();
  if (snapshot.exists) {
    throw new Error("PLAYER_EXISTS");
  }

  await playerRef.set(player);
  return player;
}

export async function getPlayer(id) {
  const snapshot = await playersCollection.doc(id).get();
  return snapshot.exists ? snapshot.data() : null;
}

export async function getAllPlayers() {
  const snapshot = await playersCollection.get();
  return snapshot.docs.map((doc) => doc.data());
}

export async function verifyPlayer(id, pin) {
  const player = await getPlayer(id);
  if (!player) return null;
  if (player.pin !== pin) return null;
  return player;
}


export async function updatePlayer(id, updates) {
  return db.runTransaction(async (transaction) => {
    const currentRef = playersCollection.doc(id);
    const currentSnap = await transaction.get(currentRef);

    if (!currentSnap.exists) {
      throw new Error("PLAYER_NOT_FOUND");
    }

    const player = currentSnap.data();
    const nextId = (updates.id || id).trim().toUpperCase();

    if (nextId !== id) {
      const nextRef = playersCollection.doc(nextId);
      const nextSnap = await transaction.get(nextRef);
      if (nextSnap.exists) {
        throw new Error("PLAYER_EXISTS");
      }
    }

    const updated = {
      ...player,
      id: nextId,
      pin: (updates.pin ?? player.pin)?.trim?.() ?? player.pin,
      name: updates.name ?? player.name,
      school: updates.school ?? player.school,
      avatar: updates.avatar ?? player.avatar,
    };

    if (nextId !== id) {
      transaction.set(playersCollection.doc(nextId), updated);
      transaction.delete(currentRef);
    } else {
      transaction.set(currentRef, updated);
    }

    return updated;
  });
}

export async function updatePlayerStats(id, { score, wpm, accuracy }) {
  return db.runTransaction(async (transaction) => {
    const playerRef = playersCollection.doc(id);
    const snapshot = await transaction.get(playerRef);
    if (!snapshot.exists) throw new Error("PLAYER_NOT_FOUND");

    const player = snapshot.data();
    const updated = {
      ...player,
      races: player.races + 1,
      score: score > player.score ? score : player.score,
      wpm: wpm > player.wpm ? wpm : player.wpm,
      accuracy: accuracy > player.accuracy ? accuracy : player.accuracy,
    };

    transaction.set(playerRef, updated);
    return updated;
  });
}

export async function deletePlayer(id) {
  const playerRef = playersCollection.doc(id);
  const snapshot = await playerRef.get();
  if (!snapshot.exists) return false;

  await playerRef.delete();
  return true;
}

export async function playerCount() {
  const snapshot = await playersCollection.count().get();
  return snapshot.data().count;
}

// ── Reset (for testing) ──
export async function resetAllPlayers() {
  const snapshot = await playersCollection.get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}
