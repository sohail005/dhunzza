"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";
import MiniPlayer from "@/components/player/MiniPlayer";

/**
 * Admin routes (/admin/*) render their own full-screen layouts and don't
 * need the public site's footer/mini-player chrome — keeping them out
 * avoids the admin login card being pushed below the fold on mobile.
 */
export default function RootChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  return (
    <>
      <main className={isAdmin ? "min-h-screen" : "min-h-[70vh]"}>{children}</main>
      {!isAdmin && <Footer />}
      {!isAdmin && <MiniPlayer />}
    </>
  );
}
