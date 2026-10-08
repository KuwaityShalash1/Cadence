import confetti from "canvas-confetti";
import type { BadgeRarity } from "@/services/gamification";
import { playBadgeUnlockSound, playLevelUpSound } from "@/lib/sound";

/**
 * Check if the browser or user prefers reduced motion to respect accessibility.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Basic celebratory confetti burst.
 */
export function triggerConfetti(options?: confetti.Options): void {
  if (prefersReducedMotion() || typeof window === "undefined") return;

  void confetti({
    particleCount: 60,
    spread: 70,
    origin: { y: 0.7 },
    disableForReducedMotion: true,
    ...options,
  });
}

/**
 * High-impact celebration animation for leveling up.
 * Fires a dual-cannon golden burst with fireworks effect.
 */
export function triggerLevelUpCelebration(level?: number): void {
  playLevelUpSound();

  if (prefersReducedMotion() || typeof window === "undefined") return;

  const count = 200;
  const defaults: confetti.Options = {
    origin: { y: 0.7 },
    disableForReducedMotion: true,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    void confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Multi-tier fireworks explosion with rich gold, amber, and celebratory colors
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ["#f59e0b", "#fbbf24", "#eab308"],
  });
  fire(0.2, {
    spread: 60,
    colors: ["#6366f1", "#a855f7", "#ec4899"],
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ["#10b981", "#06b6d4", "#f59e0b"],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ["#ffffff", "#fef08a", "#fbcfe8"],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ["#f59e0b", "#d97706", "#b45309"],
  });

  // Secondary side cannons
  setTimeout(() => {
    void confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.75 },
      colors: ["#f59e0b", "#a855f7", "#06b6d4"],
    });
    void confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.75 },
      colors: ["#f59e0b", "#ec4899", "#10b981"],
    });
  }, 250);
}

/**
 * Themed celebration animation when a badge milestone is unlocked.
 * Distinct palette matching the badge rarity tier.
 */
export function triggerBadgeUnlockCelebration(rarity: BadgeRarity): void {
  playBadgeUnlockSound();

  if (prefersReducedMotion() || typeof window === "undefined") return;

  switch (rarity) {
    case "bronze":
      void confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.65 },
        colors: ["#d97706", "#b45309", "#92400e", "#78350f", "#fcd34d"],
      });
      break;

    case "silver":
      void confetti({
        particleCount: 85,
        spread: 70,
        origin: { y: 0.65 },
        colors: ["#94a3b8", "#cbd5e1", "#e2e8f0", "#64748b", "#38bdf8"],
      });
      break;

    case "gold":
      void confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.65 },
        colors: ["#f59e0b", "#fbbf24", "#eab308", "#fef08a", "#ca8a04"],
      });
      break;

    case "diamond": // Legendary / Holographic Tier
    default:
      // Multi-phase prismatic holographic rainbow burst
      void confetti({
        particleCount: 140,
        spread: 100,
        origin: { y: 0.6 },
        colors: ["#06b6d4", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ffffff"],
        shapes: ["circle", "square"],
      });

      // Side fireworks burst for legendary
      setTimeout(() => {
        void confetti({
          particleCount: 40,
          angle: 60,
          spread: 45,
          origin: { x: 0.1, y: 0.7 },
          colors: ["#06b6d4", "#a855f7", "#ffffff"],
        });
        void confetti({
          particleCount: 40,
          angle: 120,
          spread: 45,
          origin: { x: 0.9, y: 0.7 },
          colors: ["#ec4899", "#f59e0b", "#ffffff"],
        });
      }, 200);
      break;
  }
}

