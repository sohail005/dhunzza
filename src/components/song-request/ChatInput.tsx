"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  placeholder: string;
  buttonLabel: string;
  minLength: number;
  maxLength: number;
  initialValue?: string;
  suggestions?: string[];
  disabled?: boolean;
  onSubmit: (value: string) => void;
}

export default function ChatInput({
  placeholder,
  buttonLabel,
  minLength,
  maxLength,
  initialValue = "",
  suggestions,
  disabled,
  onSubmit,
}: ChatInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = value.trim();
  const isValid = trimmed.length >= minLength && trimmed.length <= maxLength;

  function submit() {
    if (!isValid || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <div>
      {suggestions && suggestions.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          <span className="text-[11px] font-medium text-white/70">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setValue(suggestion)}
              className="liquid-glass rounded-full px-2.5 py-1 text-[11px] font-medium text-white transition hover:border-white/40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="liquid-glass flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4 focus-within:border-(--accent)/60">
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hintId}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!isValid || disabled}
          aria-label={buttonLabel}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-dark text-background transition disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
      <p id={hintId} className="sr-only">
        {buttonLabel}, minimum {minLength} characters, maximum {maxLength} characters.
      </p>
    </div>
  );
}
