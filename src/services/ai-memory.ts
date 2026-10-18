/**
 * Persistent Long-Term Memory Service for Cadence AI Coach.
 *
 * Stores concise personal facts about the user (e.g. study schedules, wake-up times,
 * fitness preferences, personal struggles, constraints) in local storage so that
 * the AI retains context across chat sessions and device visits.
 */

export const AI_MEMORIES_STORAGE_KEY = "cadence_ai_user_memories_v1";
export const AI_MEMORIES_UPDATED_EVENT = "cadence:ai-memories-updated";

const MAX_MEMORIES_COUNT = 60;

/**
 * Loads the current array of persistent user memories from localStorage.
 */
export function loadAiMemories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_MEMORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return [];
  }
}

/**
 * Dispatches an event to notify listeners of memory changes.
 */
function notifyMemoryUpdate(memories: string[]): void {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(AI_MEMORIES_UPDATED_EVENT, { detail: memories }));
    } catch {
      // Ignore errors in environments where CustomEvent might be restricted
    }
  }
}

/**
 * Saves a new concise personal fact into memory.
 * Ignores empty or duplicate entries (case-insensitive check).
 * Retains up to MAX_MEMORIES_COUNT entries.
 */
export function saveAiMemory(fact: string): string[] {
  const trimmed = fact.trim();
  if (!trimmed) return loadAiMemories();

  const current = loadAiMemories();
  const lower = trimmed.toLowerCase();

  // Avoid duplicates
  const exists = current.some((m) => m.toLowerCase() === lower);
  if (exists) {
    return current;
  }

  const updated = [...current, trimmed].slice(-MAX_MEMORIES_COUNT);
  try {
    localStorage.setItem(AI_MEMORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota errors
  }

  notifyMemoryUpdate(updated);
  return updated;
}

/**
 * Removes an existing personal fact from memory (case-insensitive match or exact substring).
 */
export function removeAiMemory(fact: string): string[] {
  const trimmed = fact.trim().toLowerCase();
  if (!trimmed) return loadAiMemories();

  const current = loadAiMemories();
  const updated = current.filter(
    (m) => m.trim().toLowerCase() !== trimmed && !m.toLowerCase().includes(trimmed),
  );

  try {
    localStorage.setItem(AI_MEMORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota errors
  }

  notifyMemoryUpdate(updated);
  return updated;
}

/**
 * Clears all persistent AI memories.
 */
export function clearAiMemories(): void {
  try {
    localStorage.removeItem(AI_MEMORIES_STORAGE_KEY);
  } catch {
    // Ignore
  }
  notifyMemoryUpdate([]);
}
