"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, isAdmin, loading, signIn, bootstrapAdminClaim, signOut } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) router.replace("/admin");
  }, [loading, isAdmin, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const signedInUser = await signIn(email.trim(), password);
      const granted = await bootstrapAdminClaim(signedInUser);
      if (!granted) {
        await signOut();
        setError("This account isn't authorized for admin access.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || (user && isAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-white/60">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="liquid-glass-card w-full max-w-sm rounded-2xl p-5 text-white sm:p-6"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span className="liquid-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-accent">
            <Lock size={17} />
          </span>
          <h1 className="text-lg font-semibold sm:text-xl">Admin Login</h1>
        </div>

        <label className="mb-4 block text-sm">
          <span className="mb-1.5 block text-white/60">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base text-white outline-none focus:border-amber-400/60 sm:py-2.5 sm:text-sm"
          />
        </label>

        <label className="mb-5 block text-sm">
          <span className="mb-1.5 block text-white/60">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base text-white outline-none focus:border-amber-400/60 sm:py-2.5 sm:text-sm"
          />
        </label>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="liquid-glass liquid-glass-accent w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60 sm:py-2.5"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>

        <Link
          href="/"
          className="liquid-glass mt-3 block w-full rounded-xl py-3 text-center text-sm font-semibold text-white sm:py-2.5"
        >
          User Mode
        </Link>
      </form>
    </div>
  );
}
