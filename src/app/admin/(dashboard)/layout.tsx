"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/**
 * Route-group guard for everything under /admin except /admin/login (which
 * lives outside this group so it isn't itself guarded — that would create
 * a redirect loop). This is a UX convenience only; the actual security
 * boundary is the Firestore/Storage rules checking the `admin` claim.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAdmin, loading } = useAdminAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.replace("/admin/login");
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent text-white/60">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
