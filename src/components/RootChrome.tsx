"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import MiniPlayer from "@/components/player/MiniPlayer";
import RecentlyAddedNotification from "@/components/player/RecentlyAddedNotification";

/**
 * Admin routes (/admin/*) render their own full-screen layouts and don't
 * need the public site's footer/mini-player chrome — keeping them out
 * avoids the admin login card being pushed below the fold on mobile. The
 * "Recently Added" toast still renders everywhere, admin included, so an
 * admin who just uploaded a song sees the same live confirmation as
 * everyone else.
 */
export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  return (
    <>
      <main className={isAdmin ? "min-h-screen" : "min-h-[70vh]"}>{children}</main>
      {!isAdmin && <Footer />}
      <div className="site-chrome-stack fixed top-20 inset-x-3 z-40 flex flex-col items-stretch gap-3">
        {!isAdmin && <MiniPlayer />}
        {/* On public routes the mobile toast is Hero's in-flow copy (it needs
            Hero's stacking context to sit correctly above the hero content);
            this one covers desktop there and both breakpoints on /admin,
            which has no Hero. */}
        <div className={isAdmin ? "" : "notification-desktop-slot"}>
          <RecentlyAddedNotification portalOverlay />
        </div>
      </div>
    </>
  );
}
