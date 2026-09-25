import { useState } from "react";

/**
 * Manages the expand/collapse state for a progressively-disclosed list
 * (e.g. the Quick Suggestions panel present on every creation form).
 *
 * Default behaviour: collapsed, showing only the preview strip.
 * Expanding also enables the search input; collapsing resets the query so
 * the panel is always clean when it is reopened.
 *
 * @param initialExpanded - Pass `true` only in contexts where the full list
 *   should be visible immediately (rare). Defaults to `false`.
 */
export function useProgressiveDisclosure(initialExpanded = false) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [query, setQuery] = useState("");

  function toggle() {
    setIsExpanded((prev) => {
      // Clear the search query whenever we collapse so the next open starts fresh.
      if (prev) setQuery("");
      return !prev;
    });
  }

  return { isExpanded, toggle, query, setQuery };
}
