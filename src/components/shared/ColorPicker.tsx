import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { COLOR_NAMES, colorStyles } from "@/components/icon-map";
import { useApp } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";

/** Matches user-entered HEX colours: `#abc`, `abc`, `#aabbcc`, `aabbcc`. */
const HEX_INPUT_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Expands `#abc` to `#AABBCC`; returns null when the string is not valid HEX. */
function normalizeHex(input: string): string | null {
  if (!HEX_INPUT_RE.test(input.trim())) return null;
  let hex = input.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return `#${hex.toUpperCase()}`;
}

/**
 * localStorage key used by the habit form before the picker was extracted.
 * Read once on mount and migrated into the global store so palettes saved by
 * an older build survive the refactor and sync across every form.
 */
const LEGACY_COLOR_STORAGE_KEY = "habit-custom-colors";

export interface ColorPickerProps {
  /** Active colour — a palette name (e.g. "teal") or a custom HEX string. */
  selectedColor: string;
  onChange: (color: string) => void;
}

/**
 * Shared colour picker (predefined palette + saved custom HEX swatches +
 * `react-colorful` popover). The saved palette lives in the global app store
 * (persisted to IndexedDB), so custom colours added on ANY form are available
 * on every other form.
 */
export function ColorPicker({ selectedColor: color, onChange: setColor }: ColorPickerProps) {
  const { customColors: savedCustomColors, setCustomColors } = useApp();
  const { t } = useTranslation();

  // Premium custom hex colour popover
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [customHexInput, setCustomHexInput] = useState("#FFFFFF");

  // Track which custom color is in "reveal to delete" mode (touch long-press)
  const [showDeleteForId, setShowDeleteForId] = useState<string | null>(null);
  // Ref to store the long-press timeout ID for cleanup
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to store touch start timestamp for long-press detection
  const touchStartTimeRef = useRef<number>(0);

  // Colors array for the picker UI (predefined colors)
  const colors = COLOR_NAMES.map((c) => ({
    id: c,
    value: colorStyles(c).dot, // Tailwind class for the dot background
  }));

  // Hide the revealed delete button when user taps anywhere else on the screen
  useEffect(() => {
    if (showDeleteForId === null) return;

    function handleGlobalClick() {
      setShowDeleteForId(null);
    }

    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [showDeleteForId]);

  // Cleanup long-press timeout on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handles the touch start event for long-press gesture detection.
   * Starts a ~500ms timer; if the touch is held long enough, reveals the
   * delete button for the specific color without deleting it.
   */
  function handleTouchStart(customHex: string, e: React.TouchEvent<HTMLDivElement>) {
    // Only handle single-finger touches
    if (e.touches.length !== 1) return;

    touchStartTimeRef.current = Date.now();

    // Set timeout to reveal delete button after ~500ms (long press)
    longPressTimeoutRef.current = setTimeout(() => {
      setShowDeleteForId(customHex);
    }, 500);
  }

  /**
   * Handles touch end/cancel events.
   * Clears the long-press timeout if the user lifts their finger before
   * the long-press threshold is reached.
   */
  function handleTouchEnd(customHex: string) {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    // Reset touch start time
    touchStartTimeRef.current = 0;
  }

  /**
   * Prevents the default context menu from appearing on long press.
   * This is essential for mobile devices where long-press typically
   * triggers a browser menu (copy, paste, etc.).
   */
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
  }

  // One-time migration from the legacy localStorage palette into the store.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(LEGACY_COLOR_STORAGE_KEY);
    if (!raw) return;
    window.localStorage.removeItem(LEGACY_COLOR_STORAGE_KEY);
    try {
      const legacy = JSON.parse(raw) as unknown;
      if (!Array.isArray(legacy)) return;
      const merged = [...savedCustomColors];
      for (const entry of legacy) {
        if (
          typeof entry === "string" &&
          !merged.some((c) => c.toLowerCase() === entry.toLowerCase())
        ) {
          merged.push(entry);
        }
      }
      setCustomColors(merged);
    } catch {
      // Corrupted legacy payload — the key is already gone; start fresh.
    }
    // Runs exactly once on mount; afterwards the store owns the palette.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed the hex field with the active colour each time the popover opens.
  useEffect(() => {
    if (!isColorPickerOpen) return;
    setCustomHexInput(color.startsWith("#") ? (normalizeHex(color) ?? "#FFFFFF") : "#FFFFFF");
    // `color` intentionally excluded: re-seeding mid-edit would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isColorPickerOpen]);

  // Validates the hex field, persists it to the saved palette (case-insensitive
  // de-dupe), and commits it as the selected colour.
  function saveAndApplyCustomHex() {
    const normalized = normalizeHex(customHexInput);
    if (!normalized) return;
    const alreadySaved = savedCustomColors.some(
      (c) => c.toLowerCase() === normalized.toLowerCase(),
    );
    if (!alreadySaved) {
      setCustomColors([...savedCustomColors, normalized]);
    }
    setColor(normalized);
    setIsColorPickerOpen(false);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t("colorPicker.legend")}</legend>
      <div className="flex flex-wrap items-center gap-3 pb-2">
        {/* 1. Predefined Colors */}
        {colors.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setColor(c.id)}
            /// Colour-only swatch: the palette name is the accessible label.
            aria-label={t("colorPicker.useColorAria", { color: c.id })}
            aria-pressed={color === c.id}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95 shrink-0 ${c.value}`}
          >
            {color === c.id && <Check className="w-4 h-4 text-white drop-shadow-md" />}
          </button>
        ))}

        {/* 2. Saved Custom Colors (with Hover Delete Badge for Desktop, Long-Press Reveal for Touch) */}
        {savedCustomColors.map((customHex) => (
          <div
            key={customHex}
            className="relative group shrink-0"
            // Prevent iOS Safari's default callout menu on long press
            style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
            onContextMenu={handleContextMenu}
            onTouchStart={(e) => handleTouchStart(customHex, e)}
            onTouchEnd={() => handleTouchEnd(customHex)}
            onTouchCancel={() => handleTouchEnd(customHex)}
          >
            <button
              type="button"
              onClick={() => setColor(customHex)}
              style={{ backgroundColor: customHex }}
              /// Swatch has no text, so the saved HEX value names the button.
              aria-label={t("colorPicker.useSavedColorAria", { hex: customHex })}
              aria-pressed={color === customHex}
              className="w-8 h-8 rounded-full flex items-center justify-center transition hover:scale-110 active:scale-95 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              {color === customHex && <Check className="w-4 h-4 text-white drop-shadow-md" />}
            </button>
            {/* Delete Button - Visible on Desktop via group-hover, Visible on Touch via showDeleteForId state */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Clear the reveal state when explicitly deleting
                setShowDeleteForId(null);
                setCustomColors(savedCustomColors.filter((c) => c !== customHex));
                if (color === customHex) setColor(colors[0]?.id ?? "teal"); // Reset if deleting active color
              }}
              // Show delete button when: (1) desktop hover OR (2) touch long-press revealed it
              className={`absolute -top-1.5 -end-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 hover:scale-110 ${
                showDeleteForId === customHex ? "opacity-100" : ""
              }`}
              title={t("colorPicker.deleteColor")}
              aria-label={t("colorPicker.deleteColorAria", { hex: customHex })}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}

        {/* 3. Premium Custom Hex Colour Popover (Portaled to body, auto-colliding & boundary-aware) */}
        <div className="shrink-0 flex items-center ms-1 ps-2 border-s border-slate-200 dark:border-slate-700">
          <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("colorPicker.addCustomColor")}
                className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-400 transition-colors bg-transparent"
                title={t("colorPicker.addCustomColor")}
              >
                <Plus className="w-4 h-4" />
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="top"
              align="center"
              sideOffset={8}
              collisionPadding={16}
              className="z-50 w-auto min-w-[240px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 fade-in duration-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t("colorPicker.pickAColor")}
                </span>
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(false)}
                  aria-label={t("colorPicker.closeColorPicker")}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Interactive Color Wheel */}
              <div className="flex justify-center">
                <HexColorPicker
                  className="habit-color-picker"
                  color={normalizeHex(customHexInput) ?? "#FFFFFF"}
                  onChange={setCustomHexInput}
                />
              </div>

              {/* Hex Text Input (Syncs automatically with Wheel) */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg shadow-inner border border-slate-200 dark:border-slate-700 shrink-0 transition-colors"
                  style={{ backgroundColor: normalizeHex(customHexInput) ?? customHexInput }}
                />
                <input
                  type="text"
                  value={customHexInput.toUpperCase()}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= 7) {
                      setCustomHexInput(val.startsWith("#") ? val : `#${val}`);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveAndApplyCustomHex();
                  }}
                  spellCheck={false}
                  maxLength={7}
                  aria-label={t("colorPicker.customHexColor")}
                  placeholder="#FF5733"
                  className="flex-1 w-full px-3 py-1.5 text-xs font-mono uppercase rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Save & Apply Button */}
              <button
                type="button"
                disabled={!normalizeHex(customHexInput)}
                onClick={saveAndApplyCustomHex}
                className="w-full py-2 text-xs font-bold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
              >
                {t("colorPicker.saveAndApply")}
              </button>

              {/* Popover Arrow */}
              <PopoverPrimitive.Arrow className="fill-white dark:fill-slate-900" />
            </PopoverContent>
          </Popover>
        </div>

        {/* 4. Save Button (Only shows when picking a new unsaved color) */}
        {color.startsWith("#") && !savedCustomColors.includes(color) && (
          <button
            type="button"
            onClick={() => setCustomColors([...savedCustomColors, color])}
            className="text-[10px] font-bold bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity shrink-0 ms-1"
          >
            {t("common.save", "Save")}
          </button>
        )}
      </div>
    </fieldset>
  );
}
