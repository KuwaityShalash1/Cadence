/**
 * Keyboard normalization and input detection utilities for Cadence.
 *
 * Provides physical key layout priority (via `event.code`) with fallback
 * translation for Arabic and other non-Latin layouts (via `event.key`).
 * Also provides robust detection of active input/editable targets to prevent
 * accidental shortcut invocation while typing.
 */

/**
 * Mapping of physical keyboard key codes (`event.code`) on a standard US QWERTY layout
 * to their normalized lowercase key representations.
 */
export const CODE_TO_KEY_MAP: Record<string, string> = {
  KeyA: "a",
  KeyB: "b",
  KeyC: "c",
  KeyD: "d",
  KeyE: "e",
  KeyF: "f",
  KeyG: "g",
  KeyH: "h",
  KeyI: "i",
  KeyJ: "j",
  KeyK: "k",
  KeyL: "l",
  KeyM: "m",
  KeyN: "n",
  KeyO: "o",
  KeyP: "p",
  KeyQ: "q",
  KeyR: "r",
  KeyS: "s",
  KeyT: "t",
  KeyU: "u",
  KeyV: "v",
  KeyW: "w",
  KeyX: "x",
  KeyY: "y",
  KeyZ: "z",
  Slash: "/",
  NumpadDivide: "/",
};

/**
 * Arabic to English QWERTY keyboard character mapping.
 * Used as a secondary translation layer when `event.code` is absent or unmapped,
 * and `event.key` outputs Arabic characters.
 */
export const ARABIC_TO_KEY_MAP: Record<string, string> = {
  // Top row
  ض: "q",
  ص: "w",
  ث: "e",
  ق: "r",
  ف: "t",
  غ: "y",
  ع: "u",
  ه: "i",
  خ: "o",
  ح: "p",
  ج: "[",
  د: "]",
  // Home row
  ش: "a",
  س: "s",
  ي: "d",
  ب: "f",
  ل: "g",
  ا: "h",
  ت: "j",
  ن: "k",
  م: "l",
  ك: ";",
  ط: "k", // Supported mapping alias requested in spec alongside 'ن' -> 'k'
  // Bottom row
  ئ: "z",
  ء: "x",
  ؤ: "c",
  ر: "v",
  لا: "b",
  ى: "n",
  ة: "m",
  و: ",",
  ز: ".",
  ظ: "/",
  // Question marks and symbols
  "؟": "?",
  ـ: "-",
  "،": ",",
  "؛": ";",
  آ: "h",
  إ: "y",
  أ: "h",
};

/**
 * Normalizes a KeyboardEvent into a canonical key representation.
 *
 * 1. Prioritizes `event.code` (representing the physical key on a standard US layout)
 *    so shortcuts work identically regardless of active system language (Arabic, English, etc.).
 * 2. Recognizes Shift+Slash / Arabic question mark as '?'.
 * 3. Falls back to translating `event.key` through `ARABIC_TO_KEY_MAP` if `event.code` is unmapped.
 * 4. Defaults to `event.key.toLowerCase()`.
 */
export function getNormalizedKey(event: KeyboardEvent): string {
  // Handle Shift + Slash physical key as '?'
  if (event.code === "Slash" && event.shiftKey) {
    return "?";
  }

  // 1. Prioritize physical key code
  if (event.code) {
    const codeKey = CODE_TO_KEY_MAP[event.code];
    if (codeKey) {
      return codeKey;
    }
  }

  // 2. Fallback to event.key translation
  const rawKey = event.key;
  if (!rawKey) return "";

  if (rawKey === "?" || rawKey === "؟") {
    return "?";
  }

  const mapped = ARABIC_TO_KEY_MAP[rawKey];
  if (mapped) {
    return mapped;
  }

  return rawKey.toLowerCase();
}

/**
 * Determines whether the keyboard event originated from or is active within
 * an editable text context where global single-key shortcuts must NOT be triggered.
 *
 * Checks:
 * - `<input>` elements
 * - `<textarea>` elements
 * - `<select>` elements
 * - `isContentEditable` nodes (e.g. rich text editors or contenteditable div/span)
 * - Ancestors matching editable form elements
 */
export function isTypingTarget(
  target: EventTarget | null,
  activeElement: Element | null = typeof document !== "undefined" ? document.activeElement : null,
): boolean {
  const elements = [target, activeElement];

  for (const item of elements) {
    if (!item) continue;

    // Resolve element if target is a text node
    const el =
      item instanceof HTMLElement
        ? item
        : "parentElement" in item && (item as Node).parentElement instanceof HTMLElement
          ? (item as Node).parentElement
          : null;

    if (!el) continue;

    const tagName = el.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return true;
    }

    if (el.isContentEditable) {
      return true;
    }

    if (el.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']")) {
      return true;
    }
  }

  return false;
}
