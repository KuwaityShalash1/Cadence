import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a HEX color string to an RGBA string with the specified opacity.
 * @param hex - The HEX color string (e.g., "#FF5733" or "FF5733")
 * @param opacity - The opacity value between 0 and 1
 * @returns The RGBA color string (e.g., "rgba(255, 87, 51, 0.2)")
 */
export function hexToRgba(hex: string, opacity: number): string {
  // Remove the # if present
  const cleanHex = hex.replace(/^#/, "");

  // Validate hex length
  if (cleanHex.length !== 6 && cleanHex.length !== 3) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  // Expand shorthand hex (e.g., "03F" -> "0033FF")
  let expandedHex = cleanHex;
  if (cleanHex.length === 3) {
    expandedHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Parse RGB values
  const r = parseInt(expandedHex.slice(0, 2), 16);
  const g = parseInt(expandedHex.slice(2, 4), 16);
  const b = parseInt(expandedHex.slice(4, 6), 16);

  // Validate parsed values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
