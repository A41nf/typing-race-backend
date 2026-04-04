// ─────────────────────────────────────────────────────────
// src/realtime/socket.js — Socket.io server setup + handlers
// ─────────────────────────────────────────────────────────
//
// Event flow:
//
//   Client                    Server                    Room
//     │                         │                        │
//     ├── join_room ──────────→ │ ── addPlayer() ──────→ │
//     │ ← room_joined ─────────┤ ← getPlayerList() ──── │
//     │ ← room_update ─────────┤ (broadcast)             │
//     │                         │                        │
//     ├── player_ready ───────→ │ ── setReady() ───────→ │
//     │ ← player_ready ────────┤ (broadcast)             │
//     │                         │                        │
//     │    [all ready]          │                        │
//     │ ← all_ready ───────────┤                        │
//     │ ← countdown_tick(3) ───┤ ── startCountdown() ─→ │
//     │ ← countdown_tick(2) ───┤                        │
//     │ ← countdown_tick(1) ───┤                        │
//     │ ← race_start ──────────┤    (text included)      │
//     │                         │                        │
//     ├── player_progress ───→ │ ── updateProgress() ──→ │
//     │ ← player_progress ─────┤ (broadcast to all)      │
//     │                         │                        │
//     ├── player_finish ─────→ │ ── finishPlayer() ────→ │
//     │ ← player_finish ───────┤ (broadcast)             │
//     │                         │                        │
//     │    [all finished]       │ ── finishRace() ─────→ │
//     │ ← race_end ────────────┤    (standings)          │
//     │                         │                        │
//     ├── disconnect ─────────→ │ ── removePlayer() ───→ │
//     │ ← player_left ─────────┤ (broadcast)             │
// ─────────────────────────────────────────────────────────

import { Server } from "socket.io";
import { EVENTS } from "./events.js";
import {
  getOrCreateDefaultRoom,
  getRoom,
  getPlayerRoom,
  setPlayerRoom,
  clearPlayerRoom,
  deleteRoom,
  getAllRooms,
} from "./raceRoom.js";

// Player registry: socketId → player data (from auth)
const connectedPlayers = new Map();

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // ── Namespace: /race ──
  const raceNs = io.of("/race");

  raceNs.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ─── JOIN ROOM ───
    socket.on(EVENTS.JOIN_ROOM, (data, ack) => {
      try {
        const { playerId, playerName, school, avatar, roomId } = data;

        if (!playerId || !playerName) {
          const err = { error: "INVALID_DATA", message: "بيانات اللاعب مطلوبة" };
          if (ack) ack(err);
          socket.emit(EVENTS.ERROR, err);
          return;
        }

        // Store player data on socket
        const playerData = {
          id: playerId,
          name: playerName,
          school: school || "",
          avatar: avatar || "🧑‍🎓",
        };
        connectedPlayers.set(socket.id, playerData);

        // Get or create room
        const room = roomId ? getRoom(roomId) : getOrCreateDefaultRoom();
        if (!room) {
          const err = { error: "ROOM_NOT_FOUND", message: "الغرفة غير موجودة" };
          if (ack) ack(err);
          socket.emit(EVENTS.ERROR, err);
          return;
        }

        // Add player to room
        const players = room.addPlayer(socket.id, playerData);
        setPlayerRoom(socket.id, room.roomId);

        // Join the Socket.io room
        socket.join(room.roomId);

        // Send success to joining player
        const response = {
          success: true,
          roomId: room.roomId,
          text: room.text,       // empty until countdown
          textLength: room.text.length,
          maxDuration: room.maxDuration,
          players,
          status: room.status,
        };

        if (ack) ack(response);
        socket.emit(EVENTS.ROOM_JOINED, response);

        // Broadcast room update to all
        raceNs.to(room.roomId).emit(EVENTS.ROOM_UPDATE, {
          roomId: room.roomId,
          status: room.status,
          players: room.getPlayerList(),
          playerCount: room.players.size,
        });

        console.log(
          `👤 ${playerName} (${playerId}) joined room ${room.roomId} [${room.players.size} players]`
        );
      } catch (err) {
        const error = { error: err.message, message: getErrorMessage(err.message) };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    // ─── PLAYER READY ───
    socket.on(EVENTS.PLAYER_READY, (_data, ack) => {
      try {
        const room = getPlayerRoom(socket.id);
        if (!room) throw new Error("NOT_IN_ROOM");

        const result = room.setReady(socket.id);
        const player = connectedPlayers.get(socket.id);

        // Acknowledge to sender
        if (ack) ack({ success: true, ready: true });

        // Broadcast ready state
        raceNs.to(room.roomId).emit(EVENTS.PLAYER_READY_ACK, {
          playerId: result.playerId,
          playerName: player?.name,
          players: result.players,
        });

        console.log(`✅ ${player?.name} ready in ${room.roomId}`);

        // If all ready → trigger countdown
        if (result.allReady) {
          console.log(`🏁 All ready in ${room.roomId} — starting countdown`);

          raceNs.to(room.roomId).emit(EVENTS.ALL_READY, {
            roomId: room.roomId,
            message: "الجميع جاهز! الاستعداد...",
          });

          // Server-controlled countdown
          room.startCountdown(
            // onCountdown
            (value, step) => {
              raceNs.to(room.roomId).emit(EVENTS.COUNTDOWN_TICK, {
                value,
                step: step + 1,
                totalSteps: 3,
              });
            },
            // onStart
            () => {
              raceNs.to(room.roomId).emit(EVENTS.RACE_START, {
                roomId: room.roomId,
                text: room.text,
                textLength: room.text.length,
                textId: room.textId,
                maxDuration: room.maxDuration,
                startedAt: room.startedAt,
                players: room.getPlayerList(),
              });
              console.log(`🚀 Race started in ${room.roomId}`);
            }
          );
        }
      } catch (err) {
        const error = { error: err.message, message: getErrorMessage(err.message) };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    // ─── PLAYER PROGRESS ───
    socket.on(EVENTS.PLAYER_PROGRESS, (data) => {
      try {
        const room = getPlayerRoom(socket.id);
        if (!room || room.status !== "racing") return;

        const { typed, correctChars, totalKeystrokes, elapsed } = data;

        const result = room.updateProgress(socket.id, {
          typed,
          correctChars,
          totalKeystrokes,
          elapsed,
        });

        // Broadcast progress to all players in room
        raceNs.to(room.roomId).emit(EVENTS.PLAYER_PROGRESS_ACK, {
          playerId: result.playerId,
          progress: result.progress,
          wpm: result.wpm,
          accuracy: result.accuracy,
          score: result.score,
          finished: result.finished,
        });
      } catch (err) {
        // Silently ignore progress errors (race ended, etc.)
      }
    });

    // ─── PLAYER FINISH ───
    socket.on(EVENTS.PLAYER_FINISH, (data, ack) => {
      try {
        const room = getPlayerRoom(socket.id);
        if (!room) throw new Error("NOT_IN_ROOM");

        const result = room.finishPlayer(socket.id, data);
        const player = connectedPlayers.get(socket.id);

        if (ack) ack({ success: true, stats: result.stats });

        // Broadcast finish
        raceNs.to(room.roomId).emit(EVENTS.PLAYER_FINISH_ACK, {
          playerId: result.playerId,
          playerName: player?.name,
          stats: result.stats,
          finished: true,
        });

        console.log(
          `🏆 ${player?.name} finished: ${result.stats.wpm}WPM ${result.stats.accuracy}% score:${result.stats.score}`
        );

        // If all finished → end race
        if (result.allFinished) {
          endRace(io, room);
        }
      } catch (err) {
        const error = { error: err.message };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    // ─── LEAVE ROOM ───
    socket.on(EVENTS.LEAVE_ROOM, () => {
      handleDisconnect(socket);
    });

    // ─── DISCONNECT ───
    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
      handleDisconnect(socket);
    });
  });

  return io;
}

// ── Helpers ──

function handleDisconnect(socket) {
  const room = getPlayerRoom(socket.id);
  const player = connectedPlayers.get(socket.id);

  if (room) {
    const result = room.removePlayer(socket.id);
    clearPlayerRoom(socket.id);

    if (!result.empty) {
      // Notify remaining players
      raceNs_to(socket).emit(EVENTS.PLAYER_LEFT, {
        playerId: player?.id,
        playerName: player?.name,
        players: result.players,
        roomStatus: room.status,
      });
    }

    // If room is empty and finished/waiting, clean up
    if (result.empty) {
      deleteRoom(room.roomId);
      console.log(`🗑️ Room ${room.roomId} deleted (empty)`);
    }

    console.log(`👋 ${player?.name || socket.id} left room ${room.roomId}`);
  }

  connectedPlayers.delete(socket.id);
}

function endRace(io, room) {
  const result = room.finishRace();

  io.of("/race").to(room.roomId).emit(EVENTS.RACE_END, {
    roomId: room.roomId,
    standings: result.standings,
    text: result.text,
    textId: result.textId,
    duration: result.duration,
  });

  console.log(
    `🏁 Race ended in ${room.roomId} — Winner: ${result.standings[0]?.name} (${result.standings[0]?.stats.wpm}WPM)`
  );
}

function getErrorMessage(code) {
  const MSG = {
    RACE_ALREADY_STARTED: "السباق بدأ بالفعل",
    ROOM_FULL: "الغرفة ممتلئة",
    PLAYER_ALREADY_IN_ROOM: "اللاعب موجود بالفعل",
    NOT_IN_WAITING: "لا يمكن التغيير الآن",
    RACE_NOT_ACTIVE: "السباق غير نشط",
    ALREADY_FINISHED: "انتهيت بالفعل",
    NOT_IN_ROOM: "لست في غرفة",
    PLAYER_NOT_IN_ROOM: "اللاعب غير موجود في الغرفة",
    NOT_ALL_READY: "ليس الجميع جاهزاً",
    INVALID_STATE: "حالة غير صالحة",
    ROOM_NOT_FOUND: "الغرفة غير موجودة",
    INVALID_DATA: "بيانات غير صالحة",
  };
  return MSG[code] || "حدث خطأ";
}

// Helper to get namespace from socket
function raceNs_to(socket) {
  return socket.nsp;
}
