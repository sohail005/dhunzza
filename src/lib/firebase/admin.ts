import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";

/**
 * Server-only Firebase Admin SDK. Never import this from a "use client"
 * component — it holds service-account credentials that must not reach
 * the browser bundle. Only used from Route Handlers (e.g.
 * src/app/api/admin/bootstrap-claim/route.ts).
 */
// Named (not default) app — a default app may already exist in this process
// without databaseURL configured (e.g. hot-reloaded module state), and
// silently reusing it here would misconfigure Realtime Database access.
const ADMIN_APP_NAME = "dhunzza-admin";

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) {
    adminApp = existing;
    return adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars (FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY)."
    );
  }

  adminApp = initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      // Not secret — same value shipped to the client via
      // NEXT_PUBLIC_FIREBASE_DATABASE_URL. Reused here so the Admin SDK talks
      // to the same Realtime Database instance without a second env var.
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    },
    ADMIN_APP_NAME
  );
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDatabase(): Database {
  return getDatabase(getAdminApp());
}
