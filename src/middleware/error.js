// ─────────────────────────────────────────────────────────
// src/middleware/error.js — Global error handler
// ─────────────────────────────────────────────────────────

export function errorHandler(err, req, res, _next) {
  // Known business errors
  const ERROR_MAP = {
    PLAYER_EXISTS:    { status: 409, message: "اللاعب موجود مسبقاً" },
    PLAYER_NOT_FOUND: { status: 404, message: "اللاعب غير موجود" },
    TOURNAMENT_NOT_FOUND:   { status: 404, message: "البطولة غير موجودة" },
    TOURNAMENT_ALREADY_STARTED: { status: 409, message: "البطولة بدأت بالفعل" },
    MIN_3_PLAYERS:    { status: 400, message: "يجب وجود 3 لاعبين على الأقل" },
    MAX_10_PLAYERS:   { status: 400, message: "الحد الأقصى 10 لاعبين" },
    NO_ACTIVE_ROUND:  { status: 400, message: "لا توجد جولة نشطة" },
  };

  const known = ERROR_MAP[err.message];
  if (known) {
    return res.status(known.status).json({
      error: err.message,
      message: known.message,
    });
  }

  // Unknown error
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "INTERNAL",
    message: "حدث خطأ غير متوقع",
  });
}
