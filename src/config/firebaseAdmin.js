import admin from "firebase-admin";

const getPrivateKeyCandidates = (privateKey) => {
  if (!privateKey) {
    return [privateKey];
  }

  const normalizedCandidates = [
    privateKey,
    privateKey.replace(/\\n/g, "\n"),
    privateKey.replace(/\\\\n/g, "\\n").replace(/\\n/g, "\n"),
  ];

  return [...new Set(normalizedCandidates)];
};

const createServiceAccount = (privateKey) => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey,
});

if (!admin.apps.length) {
  const privateKeyCandidates = getPrivateKeyCandidates(
    process.env.FIREBASE_PRIVATE_KEY
  );

  let lastError;

  for (const privateKey of privateKeyCandidates) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(createServiceAccount(privateKey)),
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

export const db = admin.firestore();
