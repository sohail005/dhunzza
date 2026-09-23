"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
}

const DEFAULT_BUTTON_CLASSNAME =
  "rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-amber-400/60";

/** Custom-styled replacement for a native <select> — native option popups
 * can't be themed (fixed OS chrome), which clashed with the app's dark
 * liquid-glass look. Same click-outside/Escape pattern as EraSelector. */
export default function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  buttonClassName,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-2 text-left text-white outline-none ${
          buttonClassName ?? DEFAULT_BUTTON_CLASSNAME
        }`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="liquid-glass-card no-scrollbar absolute bottom-full left-0 z-20 mb-2 flex max-h-60 w-full flex-col gap-0.5 overflow-y-auto rounded-2xl bg-[rgba(15,8,6,0.96)] p-1.5 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`rounded-xl px-3 py-1.5 text-left text-sm font-medium text-white transition hover:bg-amber-400/20 ${
                option.value === value ? "bg-amber-400/15" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
