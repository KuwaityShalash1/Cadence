/**
 * Normalises the persisted quick-decrement configuration into a list of
 * positive step sizes (max 2). Legacy habits stored a single `number`, while
 * newer data stores a `number[]` — both are accepted so old snapshots keep
 * rendering their configured jump buttons. Only user-configured steps are
 * returned; an empty list means "no quick jumps configured" and callers must
 * not substitute their own defaults.
 */
export function normalizeQuickDecrements(value?: number | number[] | undefined): number[] {
  const list = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return list.filter((n) => Number.isFinite(n) && n > 0).slice(0, 2);
}

/**
 * Calculates a smart default step for quick increment / decrement buttons
 * based on the target value and unit.
 *
 * Rules:
 * - Hydration in liters (e.g. 2L, 3L): 0.5
 * - Large countable / volume values (>= 1000, e.g. 3000ml): 250
 * - Medium-large values (>= 100): 25
 * - Medium duration / rep values (>= 30): 10
 * - Moderate values (>= 15, e.g. 20 min reading, 20 pushups): 5
 * - Small multi-step habits (1 < targetValue <= 5, e.g. 5 daily prayers): 1
 * - Default / single-action habits (targetValue <= 1): 1
 */
export function calculateSmartDefaultStep(targetValue: number, unit?: string): number {
  const normUnit = (unit || "").toLowerCase().trim();
  // Hydration in Liters (e.g. 2L, 3L)
  if (
    normUnit === "l" ||
    normUnit === "liter" ||
    normUnit === "liters" ||
    normUnit === "لتر" ||
    normUnit === "لترات"
  ) {
    if (targetValue <= 5) return 0.5;
  }
  if (targetValue >= 1000) {
    return 250;
  }
  if (targetValue >= 100) {
    return 25;
  }
  if (targetValue >= 30) {
    return 10;
  }
  if (targetValue >= 15) {
    return 5;
  }
  if (targetValue > 1 && targetValue <= 5) {
    return 1;
  }
  return 1;
}
