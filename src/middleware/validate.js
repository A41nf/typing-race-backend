// ─────────────────────────────────────────────────────────
// src/middleware/validate.js — Request validation
// ─────────────────────────────────────────────────────────

/**
 * Validate login body: { id, pin }
 */
export function validateLogin(req, res, next) {
  const { id, pin } = req.body;

  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return res.status(400).json({
      error: "INVALID_ID",
      message: "رقم اللاعب مطلوب",
    });
  }

  if (!pin || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({
      error: "INVALID_PIN",
      message: "الرمز السري يجب أن يكون 4 أرقام",
    });
  }

  next();
}

/**
 * Validate result submission body.
 */
export function validateResult(req, res, next) {
  const { wpm, accuracy, score, time, correctChars, totalKeys } = req.body;

  const checks = [
    { field: "wpm", value: wpm, min: 0, max: 300 },
    { field: "accuracy", value: accuracy, min: 0, max: 100 },
    { field: "score", value: score, min: 0, max: 10000 },
    { field: "time", value: time, min: 0, max: 300 },
    { field: "correctChars", value: correctChars, min: 0, max: 10000 },
    { field: "totalKeys", value: totalKeys, min: 0, max: 20000 },
  ];

  for (const check of checks) {
    if (typeof check.value !== "number" || isNaN(check.value)) {
      return res.status(400).json({
        error: "INVALID_FIELD",
        message: `حقل ${check.field} يجب أن يكون رقماً`,
      });
    }
    if (check.value < check.min || check.value > check.max) {
      return res.status(400).json({
        error: "OUT_OF_RANGE",
        message: `حقل ${check.field} خارج النطاق المسموح`,
      });
    }
  }

  // Accuracy cannot exceed 100
  if (accuracy > 100) {
    return res.status(400).json({
      error: "INVALID_ACCURACY",
      message: "الدقة لا يمكن أن تتجاوز 100%",
    });
  }

  next();
}

/**
 * Validate tournament creation body.
 */
export function validateTournamentCreate(req, res, next) {
  const { name, playerIds } = req.body;

  if (name && typeof name !== "string") {
    return res.status(400).json({
      error: "INVALID_NAME",
      message: "اسم البطولة يجب أن يكون نصاً",
    });
  }

  if (playerIds) {
    if (!Array.isArray(playerIds)) {
      return res.status(400).json({
        error: "INVALID_PLAYER_IDS",
        message: "قائمة اللاعبين يجب أن تكون مصفوفة",
      });
    }
    if (playerIds.length < 3 || playerIds.length > 10) {
      return res.status(400).json({
        error: "INVALID_PLAYER_COUNT",
        message: "عدد اللاعبين يجب أن يكون بين 3 و 10",
      });
    }
  }

  next();
}
