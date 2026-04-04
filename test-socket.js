// ─────────────────────────────────────────────────────────
// test-socket.js — Simplified race flow test
// ─────────────────────────────────────────────────────────

import { io } from "socket.io-client";

const URL = "http://localhost:3001/race";

const players = [
  { playerId: "P001", playerName: "أحمد محمد", school: "شمس المعارف", avatar: "🧑‍🎓" },
  { playerId: "P002", playerName: "سارة علي", school: "شمس المعارف", avatar: "👩‍🎓" },
  { playerId: "P003", playerName: "يوسف حسن", school: "شمس المعارف", avatar: "🧑‍🎓" },
];

const sockets = [];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("\n🏁 Race Test — 3 Players\n");

  // Step 1: Connect all players
  for (const p of players) {
    const socket = io(URL, { transports: ["websocket"] });

    await new Promise((resolve) => {
      socket.on("connect", () => {
        console.log(`  ✅ ${p.playerName} connected`);
        resolve();
      });
    });

    await new Promise((resolve) => {
      socket.emit("join_room", p, (res) => {
        if (res.error) {
          console.log(`  ❌ ${p.playerName} join error: ${res.message}`);
        } else {
          console.log(`  📥 ${p.playerName} joined room ${res.roomId} (${res.players.length} players)`);
        }
        resolve();
      });
    });

    sockets.push(socket);
    await sleep(200);
  }

  // Step 2: Listen for events on first socket
  const mainSocket = sockets[0];

  mainSocket.on("all_ready", (data) => {
    console.log(`\n  🏁 ALL READY!\n`);
  });

  mainSocket.on("countdown_tick", (data) => {
    console.log(`  ⏱️  ${data.value}...`);
  });

  mainSocket.on("race_start", (data) => {
    console.log(`\n  🚀 RACE START! Text: ${data.textLength} chars\n`);
    simulateTyping(sockets, players, data.text);
  });

  mainSocket.on("player_progress", (data) => {
    if (data.progress % 25 === 0) {
      console.log(`  📈 ${data.playerId}: ${data.progress}% (${data.wpm}WPM)`);
    }
  });

  mainSocket.on("player_finish", (data) => {
    console.log(`  🏆 ${data.playerName} finished! Score: ${data.stats.score}`);
  });

  mainSocket.on("race_end", (data) => {
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  🏁 RACE COMPLETE — Final Standings:\n`);
    data.standings.forEach((s, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      console.log(
        `  ${medal} #${s.rank} ${s.name.padEnd(12)} ${String(s.stats.wpm).padStart(3)}WPM  ${String(s.stats.accuracy).padStart(3)}%  score:${s.stats.score}`
      );
    });
    console.log(`${"═".repeat(50)}\n`);

    sockets.forEach((s) => s.disconnect());
    process.exit(0);
  });

  // Step 3: All players ready (staggered)
  console.log(`\n  ⏳ Setting players ready...\n`);
  for (let i = 0; i < sockets.length; i++) {
    await sleep(500);
    sockets[i].emit("player_ready", {}, (res) => {
      console.log(`  ✅ ${players[i].playerName} ready`);
    });
  }
}

function simulateTyping(sockets, players, text) {
  sockets.forEach((socket, idx) => {
    let typed = "";
    let totalKeys = 0;
    let correctChars = 0;
    const startTime = Date.now();

    // Each player types at different speed
    const baseSpeed = 40 + idx * 20; // P001 fastest

    const typeNext = () => {
      if (typed.length >= text.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const wpm = Math.round((correctChars / 5 / elapsed) * 60);
        const accuracy = Math.round((correctChars / totalKeys) * 100);
        const score = Math.round(wpm * (accuracy / 100) * 10);

        socket.emit("player_finish", { wpm, accuracy, score, time: elapsed, correctChars, totalKeystrokes: totalKeys });
        console.log(`  ✅ ${players[idx].playerName} typed all ${text.length} chars`);
        return;
      }

      // Occasional mistake (3%)
      if (Math.random() < 0.03 && typed.length > 0) {
        typed = typed.slice(0, -1); // backspace
        setTimeout(typeNext, 20);
        return;
      }

      typed += text[typed.length];
      totalKeys++;
      if (typed[typed.length - 1] === text[typed.length - 1]) {
        correctChars++;
      }

      const elapsed = (Date.now() - startTime) / 1000;
      socket.emit("player_progress", { typed, correctChars, totalKeystrokes: totalKeys, elapsed });

      setTimeout(typeNext, baseSpeed + Math.random() * 20);
    };

    setTimeout(typeNext, idx * 300); // stagger start
  });
}

main().catch(console.error);
