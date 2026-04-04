// ─────────────────────────────────────────────────────────
// src/realtime/events.js — Socket.io event constants
// ─────────────────────────────────────────────────────────
//
// Client → Server          Server → Client
// ─────────────────────    ─────────────────────────
// join_room                room_joined
//                          room_update
// leave_room               player_left
// player_ready             player_ready
//                          all_ready
//                          countdown_tick
//                          race_start
// player_progress          player_progress
// player_finish            player_finish
//                          race_end
//                          error
// ─────────────────────────────────────────────────────────

export const EVENTS = {
  // Client → Server
  JOIN_ROOM:       "join_room",
  LEAVE_ROOM:      "leave_room",
  PLAYER_READY:    "player_ready",
  PLAYER_PROGRESS: "player_progress",
  PLAYER_FINISH:   "player_finish",

  // Server → Client
  ROOM_JOINED:     "room_joined",
  ROOM_UPDATE:     "room_update",
  PLAYER_LEFT:     "player_left",
  PLAYER_READY_ACK: "player_ready",
  ALL_READY:       "all_ready",
  COUNTDOWN_TICK:  "countdown_tick",
  RACE_START:      "race_start",
  PLAYER_PROGRESS_ACK: "player_progress",
  PLAYER_FINISH_ACK: "player_finish",
  RACE_END:        "race_end",
  ERROR:           "error",
};
