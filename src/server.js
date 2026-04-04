// ─────────────────────────────────────────────
// CLEAN SERVER + FIRESTORE TEST
// ─────────────────────────────────────────────

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";

import { db } from "./config/firebaseAdmin.js";
import { verifyIdToken } from "./middleware/verifyIdToken.js";

// ── Setup ──
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

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

// ── 404 ──
app.use((_req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "المسار غير موجود"
  });
});

// ── Start ──
httpServer.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING");
  console.log(`http://localhost:${PORT}`);
});