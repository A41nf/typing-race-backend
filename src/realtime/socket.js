// ─────────────────────────────────────────────────────────
// src/realtime/socket.js — Socket.io server setup + handlers
// ─────────────────────────────────────────────────────────

import { Server } from "socket.io";
import { EVENTS } from "./events.js";
import {
  getOrCreateDefaultRoom,
  getPlayerRoom,
  setPlayerRoom,
  clearPlayerRoom,
  deleteRoom,
  getRoom,
} from "./raceRoom.js";

const connectedPlayers = new Map();
const ADMIN_ROOM = "admin-room";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "shams-admin-2026";
const ADMIN_COUNTDOWN_STEPS = Array.from({ length: 11 }, (_, index) => 10 - index);

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  const raceNs = io.of("/race");

  raceNs.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on(EVENTS.ADMIN_CONNECT, (data = {}, ack) => {
      try {
        if (data.token !== ADMIN_SECRET) {
          throw new Error("ADMIN_REQUIRED");
        }

        socket.join(ADMIN_ROOM);
        const room = getOrCreateDefaultRoom();

        if (ack) {
          ack({
            success: true,
            roomId: room.roomId,
            status: room.status,
            players: room.getPlayerList(),
          });
        }
      } catch (err) {
        const error = { error: err.message, message: getErrorMessage(err.message) };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    socket.on(EVENTS.JOIN_ROOM, (data, ack) => {
      try {
        const { playerId, playerName, school, avatar, roomId } = data;

        if (!playerId || !playerName) {
          const err = { error: "INVALID_DATA", message: "بيانات اللاعب مطلوبة" };
          if (ack) ack(err);
          socket.emit(EVENTS.ERROR, err);
          return;
        }

        const playerData = {
          id: playerId,
          name: playerName,
          school: school || "",
          avatar: avatar || "🧑‍🎓",
        };
        connectedPlayers.set(socket.id, playerData);

        const room = roomId ? getRoom(roomId) : getOrCreateDefaultRoom();
        if (!room) {
          const err = { error: "ROOM_NOT_FOUND", message: "الغرفة غير موجودة" };
          if (ack) ack(err);
          socket.emit(EVENTS.ERROR, err);
          return;
        }

        const players = room.addPlayer(socket.id, playerData);
        setPlayerRoom(socket.id, room.roomId);
        socket.join(room.roomId);

        const response = {
          success: true,
          roomId: room.roomId,
          text: room.text,
          textLength: room.text.length,
          maxDuration: room.maxDuration,
          players,
          status: room.status,
        };

        if (ack) ack(response);
        socket.emit(EVENTS.ROOM_JOINED, response);

        const roomUpdate = {
          roomId: room.roomId,
          status: room.status,
          players: room.getPlayerList(),
          playerCount: room.players.size,
        };
        raceNs.to(room.roomId).emit(EVENTS.ROOM_UPDATE, roomUpdate);
        raceNs.to(ADMIN_ROOM).emit(EVENTS.ADMIN_PLAYER_JOINED, {
          ...roomUpdate,
          player: roomUpdate.players.find((entry) => entry.playerId === playerId) || null,
        });

        console.log(`👤 ${playerName} (${playerId}) joined room ${room.roomId} [${room.players.size} players]`);
      } catch (err) {
        const error = { error: err.message, message: getErrorMessage(err.message) };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    socket.on(EVENTS.PLAYER_READY, (_data, ack) => {
      try {
        const room = getPlayerRoom(socket.id);
        if (!room) throw new Error("NOT_IN_ROOM");

        const result = room.setReady(socket.id);
        const player = connectedPlayers.get(socket.id);

        if (ack) ack({ success: true, ready: true });

        raceNs.to(room.roomId).emit(EVENTS.PLAYER_READY_ACK, {
          playerId: result.playerId,
          playerName: player?.name,
          players: result.players,
        });

        raceNs.to(ADMIN_ROOM).emit(EVENTS.ADMIN_PLAYER_READY, {
          roomId: room.roomId,
          playerId: result.playerId,
          playerName: player?.name,
          players: result.players,
          status: room.status,
        });

        console.log(`✅ ${player?.name} ready in ${room.roomId}`);

        if (result.allReady) {
          raceNs.to(room.roomId).emit(EVENTS.ALL_READY, {
            roomId: room.roomId,
            message: "الجميع جاهز! في انتظار بدء المشرف...",
          });
        }
      } catch (err) {
        const error = { error: err.message, message: getErrorMessage(err.message) };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    socket.on(EVENTS.ADMIN_START_RACE, (data = {}, ack) => {
      try {
        if (data.adminToken !== ADMIN_SECRET) {
          throw new Error("ADMIN_REQUIRED");
        }

        const room = getOrCreateDefaultRoom();

        room.startCountdown(
          (value, step) => {
            raceNs.to(room.roomId).emit(EVENTS.COUNTDOWN_TICK, {
              value,
              step: step + 1,
              totalSteps: ADMIN_COUNTDOWN_STEPS.length,
            });
          },
          () => {
            const payload = {
              roomId: room.roomId,
              text: room.text,
              textLength: room.text.length,
              textId: room.textId,
              maxDuration: room.maxDuration,
              startedAt: room.startedAt,
              players: room.getPlayerList(),
            };
            raceNs.to(room.roomId).emit(EVENTS.RACE_START, payload);
            raceNs.to(ADMIN_ROOM).emit(EVENTS.ROOM_UPDATE, {
              roomId: room.roomId,
              status: room.status,
              players: room.getPlayerList(),
              playerCount: room.players.size,
            });
            console.log(`🚀 Race started in ${room.roomId}`);
          },
          ADMIN_COUNTDOWN_STEPS
        );

        if (ack) ack({ success: true, roomId: room.roomId });
      } catch (err) {
        const error = { error: err.message, message: getErrorMessage(err.message) };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

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

        const progressPayload = {
          playerId: result.playerId,
          progress: result.progress,
          wpm: result.wpm,
          accuracy: result.accuracy,
          score: result.score,
          finished: result.finished,
        };

        raceNs.to(room.roomId).emit(EVENTS.PLAYER_PROGRESS_ACK, progressPayload);
        raceNs.to(ADMIN_ROOM).emit(EVENTS.PLAYER_PROGRESS_ACK, progressPayload);
      } catch (_err) {
        // Ignore stale progress after race end.
      }
    });

    socket.on(EVENTS.PLAYER_FINISH, (data, ack) => {
      try {
        const room = getPlayerRoom(socket.id);
        if (!room) throw new Error("NOT_IN_ROOM");

        const result = room.finishPlayer(socket.id, data);
        const player = connectedPlayers.get(socket.id);

        if (ack) ack({ success: true, stats: result.stats });

        const finishPayload = {
          playerId: result.playerId,
          playerName: player?.name,
          stats: result.stats,
          finished: true,
        };

        raceNs.to(room.roomId).emit(EVENTS.PLAYER_FINISH_ACK, finishPayload);
        raceNs.to(ADMIN_ROOM).emit(EVENTS.PLAYER_FINISH_ACK, finishPayload);

        console.log(`🏆 ${player?.name} finished: ${result.stats.wpm}WPM ${result.stats.accuracy}% score:${result.stats.score}`);

        if (result.allFinished) {
          endRace(io, room);
        }
      } catch (err) {
        const error = { error: err.message };
        if (ack) ack(error);
        socket.emit(EVENTS.ERROR, error);
      }
    });

    socket.on(EVENTS.LEAVE_ROOM, () => {
      handleDisconnect(socket);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
      handleDisconnect(socket);
    });
  });

  return io;
}

function handleDisconnect(socket) {
  const room = getPlayerRoom(socket.id);
  const player = connectedPlayers.get(socket.id);

  if (room) {
    const result = room.removePlayer(socket.id);
    clearPlayerRoom(socket.id);

    if (!result.empty) {
      raceNs_to(socket).emit(EVENTS.PLAYER_LEFT, {
        playerId: player?.id,
        playerName: player?.name,
        players: result.players,
        roomStatus: room.status,
      });

      raceNs_to(socket).to(ADMIN_ROOM).emit(EVENTS.ADMIN_PLAYER_JOINED, {
        roomId: room.roomId,
        status: room.status,
        player: null,
        players: result.players,
        playerCount: result.players.length,
      });
    }

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
  const payload = {
    roomId: room.roomId,
    standings: result.standings,
    text: result.text,
    textId: result.textId,
    duration: result.duration,
  };

  io.of("/race").to(room.roomId).emit(EVENTS.RACE_END, payload);
  io.of("/race").to(ADMIN_ROOM).emit(EVENTS.RACE_END, payload);

  console.log(`🏁 Race ended in ${room.roomId} — Winner: ${result.standings[0]?.name} (${result.standings[0]?.stats.wpm}WPM)`);
}

function getErrorMessage(code) {
  const MSG = {
    ADMIN_REQUIRED: "صلاحية المشرف مطلوبة",
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

function raceNs_to(socket) {
  return socket.nsp;
}
