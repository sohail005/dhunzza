"use client";

import Image from "next/image";

// Tiny + pre-downscaled: the blur-2xl filter destroys fine detail anyway,
// so a full-resolution source here would just waste bytes on invisible detail.
const DEFAULT_IMAGE = "/images/ambient-bg.webp";

export default function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <Image
        src={DEFAULT_IMAGE}
        alt=""
        fill
        sizes="100vw"
        className="scale-110 object-cover opacity-90 blur-2xl"
      />
      <div className="absolute inset-0 bg-[#0d0503]/60" />
    </div>
  );
}
