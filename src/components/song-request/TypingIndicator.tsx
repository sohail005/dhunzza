"use client";

import { motion } from "motion/react";

export default function TypingIndicator() {
  return (
    <div
      className="liquid-glass flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm px-4 py-3"
      role="status"
      aria-label="Dhunzza is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-white/60"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
