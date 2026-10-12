import {
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type MouseSensorOptions,
  type PointerSensorOptions,
  type TouchSensorOptions,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import type { MouseEvent, PointerEvent, TouchEvent } from "react";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Touch hold time (ms) required before a reorderable card can be picked up.
 *
 * 250ms press-and-hold delay ensures quick swipes scroll the page normally.
 */
export const TOUCH_REORDER_DELAY_MS = 250;

/**
 * Finger drift (px) tolerated during the hold window.
 *
 * Moving further than this cancels the pending drag before it starts, which
 * hands the gesture straight back to the browser so the page keeps scrolling.
 */
export const TOUCH_REORDER_TOLERANCE_PX = 5;

/** Pointer travel (px) required before a desktop mouse / pen drag starts. */
export const POINTER_REORDER_DISTANCE_PX = 5;

/**
 * Detects whether an event target is an interactive element (button, input, select,
 * or marked with data-no-drag="true") while stopping traversal at the main sortable card wrapper.
 * Used by custom DnD sensors to ignore drag activations on interactive controls.
 */
export const isInteractiveElement = (target: EventTarget | HTMLElement | null): boolean => {
  let current: HTMLElement | null =
    target instanceof HTMLElement
      ? target
      : target instanceof Element
        ? (target.closest(
            "button, input, select, a, [role='button'], [data-no-drag], [data-sortable-card]",
          ) as HTMLElement | null)
        : null;

  while (current) {
    // Stop traversing if we hit the main sortable card wrapper
    if (
      current.dataset &&
      (current.dataset["sortableCard"] === "true" || current.hasAttribute("data-sortable-card"))
    ) {
      return false; // Safe to drag!
    }

    // Block drag ONLY if it's explicitly an interactive element or flagged
    if (
      current.tagName === "BUTTON" ||
      current.tagName === "INPUT" ||
      current.tagName === "SELECT" ||
      current.tagName === "A" ||
      current.getAttribute("role") === "button" ||
      (current.dataset &&
        (current.dataset["noDrag"] === "true" || current.hasAttribute("data-no-drag")))
    ) {
      return true; // Block drag!
    }
    current = current.parentElement;
  }
  return false;
};

/**
 * Custom PointerSensor that intercepts pointerdown events and ignores
 * drag activations originating from interactive children. Excludes touch
 * pointers so SmartTouchSensor can manage mobile gestures with the delay constraint.
 */
export class SmartPointerSensor extends PointerSensor {
  static override activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: PointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0) {
          return false;
        }
        // Let SmartTouchSensor handle touch interactions with long-press constraint
        if (event.pointerType === "touch") {
          return false;
        }
        if (isInteractiveElement(event.target)) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/**
 * Custom MouseSensor that intercepts mousedown events and ignores
 * drag activations originating from interactive children.
 */
export class SmartMouseSensor extends MouseSensor {
  static override activators = [
    {
      eventName: "onMouseDown" as const,
      handler: ({ nativeEvent: event }: MouseEvent, { onActivation }: MouseSensorOptions) => {
        if (event.button !== 0) {
          return false;
        }
        if (isInteractiveElement(event.target)) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/**
 * Custom TouchSensor that intercepts touchstart events and ignores
 * drag activations originating from interactive children.
 */
export class SmartTouchSensor extends TouchSensor {
  static override activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent: event }: TouchEvent, { onActivation }: TouchSensorOptions) => {
        if (event.touches.length > 1) {
          return false;
        }
        if (isInteractiveElement(event.target)) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/**
 * Sensors shared by every reorderable card list (Today, Routines, Goals, Quit Tracker).
 *
 * - `SmartPointerSensor` keeps desktop mouse dragging exactly as it was: a drag only
 *   begins after a 5px pointer move, so clicks stay clicks, while rejecting activations on buttons.
 * - `SmartMouseSensor` provides mouse fallback and ignores interactive children.
 * - `SmartTouchSensor` waits for a 400ms hold with at most 8px of drift, while ignoring interactive children.
 * - `KeyboardSensor` keeps the accessible arrow-key reordering untouched.
 */
export function useSortableSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(SmartPointerSensor, {
      activationConstraint: { distance: POINTER_REORDER_DISTANCE_PX },
    }),
    useSensor(SmartMouseSensor, {
      activationConstraint: { distance: POINTER_REORDER_DISTANCE_PX },
    }),
    useSensor(SmartTouchSensor, {
      activationConstraint: {
        delay: TOUCH_REORDER_DELAY_MS,
        tolerance: TOUCH_REORDER_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
