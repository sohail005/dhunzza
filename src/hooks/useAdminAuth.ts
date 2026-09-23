"use client";

import { useCallback, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/config";

const auth = getFirebaseAuth();

interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

async function checkIsAdmin(user: User): Promise<boolean> {
  const tokenResult = await user.getIdTokenResult();
  return tokenResult.claims.admin === true;
}

/**
 * Wraps Firebase Auth state + the `admin` custom claim (set server-side by
 * src/app/api/admin/bootstrap-claim/route.ts). `isAdmin` is the real
 * authorization signal — being signed in alone does not grant access.
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, loading: false });
        return;
      }
      const isAdmin = await checkIsAdmin(user);
      setState({ user, isAdmin, loading: false });
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  }, []);

  const bootstrapAdminClaim = useCallback(async (user: User): Promise<boolean> => {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/admin/bootstrap-claim", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) return false;
    const data: { isAdmin: boolean } = await response.json();
    if (data.isAdmin) {
      await user.getIdToken(true); // force-refresh to pick up the new claim
    }
    return data.isAdmin;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  return { ...state, signIn, bootstrapAdminClaim, signOut };
}
