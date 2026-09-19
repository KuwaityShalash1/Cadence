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
