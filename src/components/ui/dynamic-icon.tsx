import * as React from "react";
import * as LucideIcons from "lucide-react";
import { Target, type LucideIcon, type LucideProps } from "lucide-react";

/**
 * Common alias map to resolve informal shorthand names to canonical Lucide PascalCase names.
 */
const ICON_ALIASES: Record<string, string> = {
  book: "BookOpen",
  reading: "BookOpen",
  workout: "Dumbbell",
  gym: "Dumbbell",
  fitness: "Dumbbell",
  water: "Droplet",
  hydration: "Droplet",
  meditation: "Brain",
  mindfulness: "Brain",
  work: "Briefcase",
  career: "Briefcase",
  sleep: "Moon",
  bedtime: "Moon",
  medicine: "Pill",
  vitamins: "Pill",
  walk: "Footprints",
  walking: "Footprints",
  running: "Activity",
  coding: "Code2",
  code: "Code2",
  study: "GraduationCap",
  journal: "NotebookPen",
  journaling: "NotebookPen",
};

/**
 * Converts kebab-case, snake_case, or space-separated icon names into PascalCase.
 * e.g., 'book-open' -> 'BookOpen', 'drink_water' -> 'DrinkWater'.
 */
export function toPascalCase(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .replace(/[-_\s]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (c: string) => c.toUpperCase());
}

/**
 * Type guard verifying if an export from lucide-react is an actual renderable React component.
 */
export function isValidLucideIcon(component: unknown): component is LucideIcon {
  if (!component) return false;
  // React forwardRef components are objects with $$typeof and render function
  if (typeof component === "object" && "$$typeof" in component) return true;
  // Standard functional components
  if (
    typeof component === "function" &&
    Boolean((component as { displayName?: string }).displayName)
  ) {
    return true;
  }
  return false;
}

/**
 * Dynamically resolves any Lucide icon component by name, supporting PascalCase,
 * kebab-case, snake_case, and aliases. Falls back safely if the icon does not exist.
 */
export function getLucideIcon(
  iconName: string | undefined | null,
  fallback: LucideIcon = Target,
): LucideIcon {
  if (!iconName || typeof iconName !== "string") {
    return fallback;
  }

  const trimmed = iconName.trim();
  if (!trimmed) return fallback;

  // 1. Direct PascalCase lookup
  const directMatch = (LucideIcons as Record<string, unknown>)[trimmed];
  if (isValidLucideIcon(directMatch)) {
    return directMatch;
  }

  // 2. Alias lookup
  const aliasMatch = ICON_ALIASES[trimmed.toLowerCase()];
  if (aliasMatch) {
    const aliasedComponent = (LucideIcons as Record<string, unknown>)[aliasMatch];
    if (isValidLucideIcon(aliasedComponent)) {
      return aliasedComponent;
    }
  }

  // 3. PascalCase conversion (e.g., 'book-open' -> 'BookOpen', 'briefcase' -> 'Briefcase')
  const pascalName = toPascalCase(trimmed);
  const pascalMatch = (LucideIcons as Record<string, unknown>)[pascalName];
  if (isValidLucideIcon(pascalMatch)) {
    return pascalMatch;
  }

  // 4. Case-insensitive search across all Lucide export names
  const lowerTarget = trimmed.toLowerCase().replace(/[-_\s]/g, "");
  const allKeys = Object.keys(LucideIcons);
  for (const key of allKeys) {
    if (key.toLowerCase() === lowerTarget) {
      const candidate = (LucideIcons as Record<string, unknown>)[key];
      if (isValidLucideIcon(candidate)) {
        return candidate;
      }
    }
  }

  // 5. Fallback if icon name cannot be resolved
  return fallback;
}

/**
 * Checks whether an icon name exists in the Lucide icon library (or recognized aliases).
 */
export function hasLucideIcon(iconName: string | undefined | null): boolean {
  if (!iconName || typeof iconName !== "string") return false;
  const trimmed = iconName.trim();
  if (!trimmed) return false;
  if (isValidLucideIcon((LucideIcons as Record<string, unknown>)[trimmed])) return true;
  const alias = ICON_ALIASES[trimmed.toLowerCase()];
  if (alias && isValidLucideIcon((LucideIcons as Record<string, unknown>)[alias])) return true;
  const pascal = toPascalCase(trimmed);
  if (isValidLucideIcon((LucideIcons as Record<string, unknown>)[pascal])) return true;
  const lowerTarget = trimmed.toLowerCase().replace(/[-_\s]/g, "");
  return Object.keys(LucideIcons).some(
    (k) =>
      k.toLowerCase() === lowerTarget &&
      isValidLucideIcon((LucideIcons as Record<string, unknown>)[k]),
  );
}

export interface DynamicIconProps extends LucideProps {
  /** The PascalCase or kebab-case name of the icon in lucide-react. */
  name: string;
  /** Fallback component if the name is invalid or not found. Defaults to `Target`. */
  fallback?: LucideIcon | undefined;
}

/**
 * Dynamic icon component wrapper that safely renders any Lucide icon by component name,
 * with graceful fallback to a default icon.
 */
export function DynamicIcon({
  name,
  fallback = Target,
  ...props
}: DynamicIconProps): React.JSX.Element {
  const IconComponent = getLucideIcon(name, fallback);
  return <IconComponent {...props} />;
}
