"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import type { Category } from "@/types/music";

interface CategoryManagerProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  onCreateCategory: (name: string) => Promise<void>;
}

export default function CategoryManager({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
}: CategoryManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? null;

  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDropdownOpen]);

  async function handleCreate() {
    setError(null);
    setIsSaving(true);
    try {
      await onCreateCategory(name);
      setName("");
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create category.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-white/60 uppercase">Category</span>
      <div className="flex items-center gap-2">
        <div ref={dropdownRef} className="relative flex-1">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            className="flex w-full items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-left text-sm text-white outline-none focus:border-amber-400/60"
          >
            <span className={selectedCategory ? "text-white" : "text-white/50"}>
              {selectedCategory ? selectedCategory.name : "Select a category"}
            </span>
            <ChevronDown
              size={14}
              className={`ml-auto shrink-0 text-white/60 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isDropdownOpen && (
            <div
              role="listbox"
              className="liquid-glass-card no-scrollbar absolute bottom-full left-0 z-40 mb-2 flex max-h-60 w-full flex-col gap-0.5 overflow-y-auto rounded-2xl bg-black/90 p-1.5"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="option"
                  aria-selected={category.id === selectedCategoryId}
                  onClick={() => {
                    onSelectCategory(category.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`rounded-xl px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-amber-400/25 ${
                    category.id === selectedCategoryId ? "bg-amber-400/15" : ""
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          aria-label="Create category"
          className="liquid-glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
        >
          <Plus size={16} />
        </button>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="liquid-glass-card relative w-full max-w-xs rounded-2xl p-5 text-white"
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 text-white/50 hover:text-white"
            >
              <X size={16} />
            </button>
            <h3 className="mb-3 text-sm font-semibold">New category</h3>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="e.g. Happy"
              className="mb-3 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60"
            />
            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving}
              className="liquid-glass liquid-glass-accent w-full rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isSaving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
