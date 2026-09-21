"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface SupportModalProps {
  onClose: () => void;
}

export default function SupportModal({ onClose }: SupportModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Support Desi Mahol"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="liquid-glass-card relative w-full max-w-md rounded-2xl p-6 pt-8 text-center shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="liquid-glass absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:scale-105"
        >
          <X size={15} />
        </button>

        <h3 className="font-[family-name:var(--font-devanagari)] px-2 text-[22px] font-semibold text-white sm:text-[26px]">
          No ads — just memories. Support the platform to stay forever.
        </h3>
        <p className="mt-3 text-[18px] leading-relaxed text-white/60">
          We promise never to put ads and ruin your experience. But web server costs are
          high to keep this website smooth — please send any amount you wish. Thank you
          in advance! ❤️
        </p>

        <div className="mx-auto mt-5 flex h-44 w-44 items-center justify-center overflow-hidden rounded-xl border border-amber-500/30 bg-white p-2">
          <Image
            src="/images/desimaholqr.webp"
            alt="Desi Mahol UPI QR code"
            width={200}
            height={200}
            className="h-full w-full object-contain"
          />
        </div>
        <p className="mt-2 text-[16px] text-white/40">QR code to support Desi Mahol</p>

        <a
          href="/images/desimaholqr.webp"
          download="desi-mahol-qr.jpg"
          className="mt-4 inline-block text-[16px] font-semibold text-amber-400 underline decoration-amber-500/40 hover:text-amber-300"
        >
          Download QR Code
        </a>
        <p className="mt-1 text-[14px] text-white/40">Save it and scan with any UPI app.</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 text-[16px] text-white/50 underline hover:text-white/80"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
