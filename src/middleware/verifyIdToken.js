import admin from "firebase-admin";

export async function verifyIdToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      });
    }

    const idToken = authHeader.split("Bearer ")[1]?.trim();

    if (!idToken) {
      return res.status(401).json({
        ok: false,
        error: "UNAUTHORIZED",
        message: "Missing Firebase ID token",
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Invalid or expired token",
    });
  }
}
