"use client";

import Image from "next/image";

const DEFAULT_IMAGE = "/images/desimahol3.webp";

export default function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <Image
        src={DEFAULT_IMAGE}
        alt=""
        fill
        sizes="100vw"
        priority
        className="scale-110 object-cover opacity-90 blur-2xl"
      />
      <div className="absolute inset-0 bg-[#0d0503]/60" />
    </div>
  );
}
