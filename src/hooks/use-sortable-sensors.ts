import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Touch hold time (ms) required before a reorderable card can be picked up.
 *
 * 400ms matches the native mobile long-press threshold, so entering drag mode
 * feels like an operating-system gesture instead of an accidental one.
 */
export const TOUCH_REORDER_DELAY_MS = 400;

/**
 * Finger drift (px) tolerated during the hold window.
 *
 * Moving further than this cancels the pending drag *before* it starts, which
 * hands the gesture straight back to the browser so the page keeps scrolling.
 */
export const TOUCH_REORDER_TOLERANCE_PX = 8;

/** Pointer travel (px) required before a desktop mouse / pen drag starts. */
export const POINTER_REORDER_DISTANCE_PX = 5;

/**
 * Sensors shared by every reorderable card list (Routines, Goals, Quit Tracker).
 *
 * - `PointerSensor` keeps desktop mouse dragging exactly as it was: a drag only
 *   begins after a 5px pointer move, so clicks stay clicks.
 * - `TouchSensor` waits for a 400ms hold with at most 8px of drift, so quick
 *   vertical swipes scroll the page and only a deliberate long-press reorders.
 *   Pair it with a `touch-action: pan-y` container (`SortableCard`) so native
 *   vertical scrolling is never blocked while the finger is down.
 * - `KeyboardSensor` keeps the accessible arrow-key reordering untouched.
 */
export function useSortableSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: POINTER_REORDER_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_REORDER_DELAY_MS,
        tolerance: TOUCH_REORDER_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
