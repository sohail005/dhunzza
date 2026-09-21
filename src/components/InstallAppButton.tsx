"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

interface InstallAppButtonProps {
  className?: string;
  iconSize?: number;
  onInstall?: () => void;
}

export default function InstallAppButton({
  className = "",
  iconSize = 13,
  onInstall,
}: InstallAppButtonProps) {
  const { canInstall, canShowIosInstructions, promptInstall } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  if (!canInstall && !canShowIosInstructions) return null;

  async function handleClick() {
    if (canInstall) {
      await promptInstall();
      onInstall?.();
    } else {
      setShowIosHint((prev) => !prev);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleClick} className={className}>
        <Download size={iconSize} />
        Add to Home Screen
      </button>

      {showIosHint && (
        <div className="liquid-glass-card absolute top-full left-1/2 z-40 mt-2 w-64 -translate-x-1/2 rounded-xl p-3 text-left text-xs leading-relaxed text-white">
          Tap the Share button in Safari&rsquo;s toolbar, then choose &ldquo;Add to Home
          Screen&rdquo;.
        </div>
      )}
    </div>
  );
}
