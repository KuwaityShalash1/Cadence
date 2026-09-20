/**
 * Lightweight haptic feedback helper.
 *
 * The Vibration API is only implemented on mobile browsers (notably Chrome on
 * Android); desktop browsers and iOS Safari silently ignore it. Every call is
 * SSR-guarded and feature-detected, so it is always safe to fire from an event
 * handler and never throws on unsupported platforms.
 */

/** Default pulse length (ms) — short enough to read as a subtle "picked up" tick. */
export const HAPTIC_TICK_MS = 30;

/**
 * Fire a single short vibration pulse.
 *
 * `typeof window !== "undefined"` covers server rendering and
 * `"vibrate" in navigator` covers browsers without haptic hardware, so callers
 * never need their own guards.
 */
export function triggerHaptic(durationMs: number = HAPTIC_TICK_MS): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(durationMs);
}
