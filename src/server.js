// ─────────────────────────────────────────────
// CLEAN SERVER + FIRESTORE TEST
// ─────────────────────────────────────────────

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import { existsSync } from "fs";

import { db } from "./config/firebaseAdmin.js";
import { verifyIdToken } from "./middleware/verifyIdToken.js";
import router from "./routes/index.js";

// ── Setup ──
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
let setupSocket = null;

if (existsSync(new URL("./realtime/socket.js", import.meta.url))) {
  ({ setupSocket } = await import("./realtime/socket.js"));
}

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── TEST ROUTE (server verification) ──
app.get("/test-direct", (_req, res) => {
  res.json({
    ok: true,
    message: "ZZZ_TEST_123"
  });
});

// ── Health ──
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ── 🔥 Firestore Test ──
app.get("/api/firebase-test", async (_req, res) => {
  try {
    const ref = db.collection("healthchecks").doc("backend");
    const now = new Date().toISOString();

    await ref.set(
      {
        status: "ok",
        updatedAt: now,
      },
      { merge: true }
    );

    const snap = await ref.get();

    res.json({
      ok: true,
      firestoreConnected: snap.exists,
      data: snap.data(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// ── 🔒 Protected Route Test ──
app.get("/api/protected", verifyIdToken, (req, res) => {
  res.json({
    ok: true,
    message: "Protected route works",
    user: req.user,
  });
});

// ── API Routes ──
app.use("/api", router);

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "المسار غير موجود"
  });
});

// ── Start ──
if (typeof setupSocket === "function") {
  setupSocket(httpServer);
}

httpServer.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING");
  console.log(`http://localhost:${PORT}`);
});
