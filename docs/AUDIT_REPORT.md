# Cadence — Architecture Review & Code Audit

**Date:** 2026-02-18 | **Auditor:** Solar Pro4 (Upstage AI) | **Scope:** Full repository review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Application Architecture Overview](#2-application-architecture-overview)
3. [Strengths](#3-strengths)
4. [Critical & High-Priority Issues](#4-critical--high-priority-issues)
5. [Medium-Priority Issues](#5-medium-priority-issues)
6. [Code Smells & Architecture Concerns](#6-code-smells--architecture-concerns)
7. [Security Considerations](#7-security-considerations)
8. [SEO / PWA / Accessibility Findings](#8-seo--pwa--accessibility-findings)
9. [Translation Coverage Audit](#9-translation-coverage-audit)
10. [TypeScript / Build / Testing Concerns](#10-typescript--build--testing-concerns)
11. [Prioritized Actionable Roadmap](#11-prioritized-actionable-roadmap)
12. [File-by-File Notes](#12-file-by-file-notes)

---

## 1. Executive Summary

Cadence is a well-structured Next.js 15 + React 19 habit-tracking PWA with an ambitious feature set spanning daily habit tracking, weekly scheduling, goal milestones, routine chaining, a quit-addiction tracker with relapse analytics, PWA installation, and multi-language support (5 locales). The architecture is mostly sound: a Zustand store layered over IndexedDB via Dexie, service-layer date/schedule/stats utilities, and a rich component library built on shadcn/ui primitives.

**However, several defects prevent this from being production-ready in its current state.** The most urgent are:

| # | Issue | Severity | Section |
|---|-------|----------|---------|
| C1 | \useSound\ is **undefined** — the import path \@/hooks/use-sound\ does not resolve to a file that exports a usable hook; \src/lib/sound.ts\ is the real implementation but is never imported through the \@/hooks/use-sound\ alias. All sound feedback (completion chime, delete sound, toggle sound) silently fails. | **Critical** | §4.1 |
| C2 | Language switching is **non-functional** — \LanguageProvider\ hardcodes \language: "en"\, \setLanguage\ always stores \"en"\, and \settings-page.tsx\ calls \updateSettings({ language: "en" })\ with a hardcoded string. The UI has no language selector widget despite 5 locales existing. | **Critical** | §4.2 |
| C3 | Timezone label is hardcoded to \"America/New_York"\ in \	oday-page.tsx\ regardless of the user's locale. | **High** | §4.3 |
| C4 | \habit-form.tsx\ schedule editor updates local state but never calls \onSave\, so schedule changes (days of week, time) are silently lost when the sheet closes. | **High** | §4.4 |
| C5 | \icon-map.tsx: getColorStyle()\ throws \TypeError: Cannot read properties of undefined\ (or renders \undefined\ styles) when passed an unknown color string. | **High** | §4.5 |
| C6 | \soundEnabled\ field in \pp-store.ts\ and \DEFAULT_SETTINGS\ is never actually toggled by any UI action — only \isSoundEnabled\ and \isMuted\ are. | **High** | §4.6 |
| C7 | The Saved/Draft indicator in \	oday-page.tsx\ and \habit-form.tsx\ reads \localStorage\ directly during render, creating a hydration mismatch (SSR renders "All saved", client reads stale value and may flash or stay stuck). | **Medium** | §5.1 |
| C8 | \weeklyRecurrence()\ returns \
ull\ when no days are selected instead of \[]\ — causes downstream \ilter\ calls to silently skip the habit instead of scheduling it on no days (same behavioral result but inconsistent types). | **Medium** | §5.2 |

**Overall Assessment:** The codebase demonstrates strong individual component craftsmanship but has accumulated integration bugs (import paths, state propagation, localStorage-driven UI during SSR) and a fundamental gap in the i18n delivery mechanism. With the fixes in §11 applied, the app would be production-ready.

---

## 2. Application Architecture Overview

### 2.1 Stack & Key Dependencies

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Framework | Next.js 15 (App Router) | \
ext@^15.0.0-canary.107\ |
| UI Runtime | React 19 | \eact@^19.0.0-rc-8e865bd0-2024-09-25\ |
| Routing | @tanstack/router | File-based + manual root in \src/routes/__root.tsx\ |
| Styling | Tailwind CSS v4 | \	ailwindcss@^4.0.0\ (v4 beta) |
| UI Primitives | shadcn/ui | Button, Input, Label, Progress, Badge, Sheet, Dialog, Select, Switch, Toast, Collapsible, Card, Avatar, Calendar |
| Drawer/Sheet | Vaul | \aul\ — animated modal drawer |
| Toasts | Sonner | \sonner\ — toast notifications |
| Drag & Drop | @dnd-kit | Core + sortable + utilities |
| Icons | Lucide React | 30+ icons imported in \icon-map.tsx\ |
| Color Picker | react-colorful | \HexColorPicker\ in \ColorPicker.tsx\ |
| PWA | next-pwa | Configured in \
ext.config.mjs\ |
| Analytics | @vercel/analytics, @vercel/speed-insights | |
| i18n | Custom in-app (not next-intl) | 5 locale files in \src/i18n/locales/\ |
| State | Zustand | Single store: \src/stores/app-store.ts\ |
| Persistence | Dexie (IndexedDB) | \src/database/idb.ts\ |
| Date/Scheduling | Custom services | \dates.ts\, \schedule.ts\, \stats.ts\ |
| Testing | Vitest | Configured (\itest.config.ts\) — **zero tests exist** |
| Type Checking | TypeScript 5.x | \strict: true\, \
oUncheckedIndexedAccess: true\ |

### 2.2 Directory Structure

\\\
src/
  app/                    # Next.js App Router pages (mostly re-exports to /)
  components/
    archives/             # Archived habits sheet
    calendar/             # Calendar page component
    goals/                # Goals page
    habits/               # habit-form, habit-editor, habit-row
    icon-map/             # Icon resolution, color styling
    notifications/        # push-notification / reminder UI
    profile/              # Settings page
    quit-tracker/         # Quit tracker form, modals, cards
    routines/             # Routine form
    shared/               # ColorPicker, IconPicker, SortableCard
    stats/                # Stats page
    today/                # Today page (main view)
    ui/                   # shadcn/ui primitives
    layout.tsx            # Root layout (providers, header, footer)
  database/
    idb.ts                # Dexie schema + CRUD operations
    repository.ts         # Snapshot load/save, import/export, wipe
  hooks/
    use-online-status.ts  # navigator.onLine observer
    use-mobile.ts         # matchMedia mobile detection
  i18n/
    context.tsx           # LanguageProvider, useTranslation
    dictionaries.ts       # Records of locale=>key=>string
    types.ts              # LanguageCode, LanguageMeta
    locales/              # ar.ts, de.ts, en.ts, es.ts, fr.ts
  lib/
    sound.ts              # AudioContext-based sound synthesis (playSound, playCompleteHabitSound, etc.)
    utils.ts              # cn() (clsx+twMerge), hexToRgba
  routes/                 # TanStack Router __root.tsx
  services/
    dates.ts              # todayKey(), addDays(), rangeKeys()
    schedule.ts           # isScheduledOn(), weeklyRecurrence()
    stats.ts              # isCompleteOn(), dayCompletion(), streaks(), habitStats()
    md5.ts                # Simple hash utility
  stores/
    app-store.ts          # Zustand store — 900+ lines, all state + actions
  types/
    index.ts              # All shared TypeScript interfaces
public/
  manifest.json           # PWA manifest
  sw.js                   # Service worker (workbox custom)
  icons/                  # maskable.png, icon-192.png, icon-ios/icon-1024.png
  og/                     # og-image.png social preview
  pwa-badges/             # PWA installation prompt assets
\\\

### 2.3 Store Architecture

\pp-store.ts\ uses Zustand with a single store containing:
- **State:** \habits[]\, \goals[]\, \outines[]\, \adHabits[]\, \habitLogs[]\, \outineLogs[]\, \groups[]\, \	imer\, \settings\, \eminders\
- **Derived:** \logMap\ (Map<habitId, LogEntry[]>), \ctiveTimer\, \streaks\, \saved\ flag
- **Actions:** ~40 action functions covering CRUD for all entity types, timer management, sound toggle, reminders, import/export

The store uses \localStorage\ as a sync layer (via Zustand's \persist\ middleware with a custom rehydrate handler) and Dexie/IndexedDB for durable storage via the \epository.ts\ module.

### 2.4 Data Flow

\\\
User Action → UI Component → appStore.dispatch(action) → localStorage (sync)
                                                    → Dexie/IDB (async, via repository.ts)
                                                    → re-render subscribers
\\\

The \loadSnapshot()\ function in \epository.ts\ handles migration on startup: it reads from IDB, applies defaults for missing fields, and restores to the Zustand store. The \importSnapshot()\ function has a rollback mechanism (saves previous snapshot, wipes all, restores on failure).

---

## 3. Strengths

### 3.1 Overall Architecture

1. **Clear separation of concerns.** Services (\dates.ts\, \schedule.ts\, \stats.ts\) are pure, testable utility functions with no side effects. The UI components consume them without embedding scheduling logic inline.

2. **Dexie + Zustand coordination is well-designed.** The \loadSnapshot()\ / \importSnapshot()\ functions handle default-field migration (e.g., \reezesAllowedPerMonth ?? 3\, \	ype ?? "numeric"\), backward compatibility for legacy data shapes (e.g., old \eminder\ field → new \eminderTimes[]\), and type-safe assertions via TypeScript \sserts\.

3. **Import/Export with rollback.** \importSnapshot()\ saves the previous snapshot before wiping and restores on failure — a robust pattern for a destructive operation. The validation function uses \sserts\ for type narrowing.

4. **Responsive sheet pattern (Vaul)** used consistently for all "add/edit" forms gives a native mobile feel. The \esponsive-sheet.tsx\ wrapper handles open/close state properly.

5. **Color system is ambitious and well-implemented.** \getColorStyle()\ supports both named palette colors (oklch values) and raw HEX strings, using \color-mix(in srgb, …)\ for tinting. The \colorStyles()\ function falls back to teal for unknown colors. \hexToRgba()\ handles 3-digit and 6-digit hex correctly.

6. **Sound design is thoughtful.** Custom AudioContext-based synthesis (no external audio files needed) provides completion chimes (C5 → E5 two-tone), delete thuds, toggle sounds, and a freeze chime. \checkSoundEnabled()\ reads from multiple possible localStorage keys for backward compatibility.

7. **Offline-first PWA.** Service worker caches app shell + assets. IndexedDB holds all user data. The offline indicator banner explains the situation clearly to users.

8. **DND keyboard accessibility note.** The \	oday-page.tsx\ DragEnd handler has a good comment explaining that keyboard dragging is intentionally excluded (PointerSensor only, \distance: 8\ threshold), keeping click and scroll interactions clean.

### 3.2 Component Design

9. **Icon system with fallback chain.** \icon-map.tsx\ resolves: custom SVG icon ID → Lucide icon name (with alias mapping \ook\ → \BookOpen\) → kebab-case normalization → \Target\ default. \indCustomIcon()\ documentation explicitly warns that every render path must check custom icons first.

10. **Form patterns are consistent.** All form components (habit-form, routine-form, goal-form, quit-tracker-form) follow the same structure: local useState for fields, color/icon preview panel, \IconPicker\ + \ColorPicker\ shared sub-components, suggestions sidebar with search, submit handler with validation + toast feedback.

11. **Suggestions system.** Each form has curated suggestion cards (e.g., "Morning Setup" routine, "Smoking / Vaping" quit tracker) with one-tap apply. The suggestion search filters by name. This is a strong UX pattern.

12. **Accessible form labels.** All inputs have associated \<Label htmlFor>\ elements. Weekday selector buttons use \ria-pressed\ and \ria-labelledby\. Submit/cancel buttons are clearly differentiated.

13. **Sonner toasts** used consistently for all user actions (create, update, delete, import, export, errors).

14. **Habit row component** is well-designed with completion checkbox, streak badge, color-coded icon, and delete action. The checkbox uses proper \<input type="checkbox">\ with \ria-label\.

---

## 4. Critical & High-Priority Issues

### 4.1 [CRITICAL] \useSound\ is undefined — sound completely broken

**Files:** \src/stores/app-store.ts\, \src/lib/sound.ts\

**Problem:** \pp-store.ts\ imports:
\\\	s
import { useSound } from "@/hooks/use-sound";
\\\
But \src/hooks/use-sound.ts\ **does not exist**. The actual sound implementation lives at \src/lib/sound.ts\ which exports a plain function \useSound\ (not a React hook — it's a synchronous audio-state check function, despite its name). The import from \@/hooks/use-sound\ resolves to nothing (or a TypeScript error), making \useSound\ **undefined** at runtime.

**Consequences:**
- \pp-store.ts\ initializes: \const sound = useSound ?? false;\ — evaluates to \alse\
- The \	oggleSound()\ action only toggles \isSoundEnabled\ / \isMuted\ — but \sound\ is always \alse\
- The \isSoundEnabled\ flag in settings is decoupled from actual audio playback
- \playCompleteHabitSound\, \playDeleteHabitSound\, \playFreezeSound\ in various form handlers are never called because the import chain is broken

**Impact:** Sound feedback is completely non-functional for all users. The sound toggle in settings appears to work (updates store state) but no audio ever plays.

**Fix:** Change the import in \pp-store.ts\ to \import { useSound } from "@/lib/sound"\ (the file exists at \src/lib/sound.ts\). Also update all form files that import sound functions — they currently import from \@/hooks/use-sound\ which doesn't exist.

Additionally, the \useSound\ function in \src/lib/sound.ts\ is just \() => boolean\ — it checks localStorage. This is fine as a synchronous check. But the sound functions (\playCompleteHabitSound\, etc.) are separate exports and must be imported independently in the form files.

**Recommended fix (comprehensive):**
1. Fix import path in \pp-store.ts\: \@/lib/sound\
2. Fix import path in \habit-form.tsx\ (and other form files): import individual sound functions from \@/lib/sound\
3. Verify \useSound\ from \sound.ts\ returns boolean correctly — it does, but rename it to \isSoundEnabled\ to avoid confusion with React hooks.

### 4.2 [CRITICAL] Language switching is non-functional — fake i18n

**Files:** \src/i18n/context.tsx\, \src/app/layout.tsx\, \src/app/page.tsx\, \src/app/settings/page.tsx\, all locale files

**Problem:** The i18n system is wired up structurally (locale files exist, \LanguageProvider\ wraps the app, \useTranslation()\ hook exists, \	()\ function works) but the **runtime switching mechanism is completely non-functional**:

1. **\LanguageProvider\ hardcodes \language: "en"\:**
   \\\	s
   const language: LanguageCode = "en"; // Never reads from settings or browser
   \\\

2. **\setLanguage\ ignores its argument and always stores \"en"\:**
   \\\	s
   const setLanguage = (_lang: LanguageCode) => {
     updateSettings({ language: "en" }); // _lang is discarded
   };
   \\\

3. **\settings-page.tsx\ calls with hardcoded \"en"\:**
   \\\	s
   updateSettings({ language: "en" }); // Must use the selected language value
   \\\

4. **\useTranslation\ always reads from \dictionaries.en\:**
   \\\	s
   const enDict = dictionaries.en; // Always English
   \\\

5. **No language selector UI exists in settings.** The \LANGUAGES\ array is imported and exported from \context.tsx\ but the settings page doesn't render a \<select>\ or radio group for language selection.

6. **The \LanguageProvider\ overrides \document.documentElement.dir\ and \lang\** to \"ltr"\ and \"en"\ in a \useEffect\ — this should be dynamic based on the selected language.

**Impact:** Despite having 5 fully-translated locale files (Arabic, German, English, Spanish, French), the app is permanently locked to English. The settings page has no visible language selector. Users cannot switch languages.

**Fix:**
1. **\context.tsx\ — read actual language from store:**
   \\\	s
   export function LanguageProvider({ children }: { children: React.ReactNode }) {
     const { settings, updateSettings } = useApp();
     const [language, setLanguageState] = useState<LanguageCode>(
       (settings.language as LanguageCode) ?? "en"
     );

     useEffect(() => {
       // Sync with store changes
       setLanguageState(settings.language as LanguageCode ?? "en");
     }, [settings.language]);

     useEffect(() => {
       const langMeta = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];
       document.documentElement.dir = langMeta.dir;
       document.documentElement.lang = language;
     }, [language]);

     const setLanguage = (lang: LanguageCode) => {
       setLanguageState(lang);
       updateSettings({ language: lang });
     };

     const t = (key: string, fallback?: string): string => {
       const dict = dictionaries[language] ?? dictionaries.en;
       return (dict as Record<string, string>)[key] ?? fallback ?? key;
     };
   \\\
2. **\settings-page.tsx\ — add a language \<Select>\ widget** using the \LANGUAGES\ array and \useTranslation\.
3. **In \pp/page.tsx\** (and all server components), the hardcoded \"en"\ string in the settings trigger must be replaced with a dynamic selector.
4. **Verify \updateSettings\ in \pp-store.ts\ actually writes \language\ to the store.** The settings update merges shallowly — \language\ should be included in the merge.

### 4.3 [HIGH] Timezone label hardcoded to "America/New_York"

**File:** \src/app/page.tsx\ (TodayPage)

**Problem:**
\\\	sx
<p className="text-xs text-muted-foreground">
  Everything in <span className="font-medium">America/New_York</span>
</p>
\\\

This hardcodes the timezone label to \America/New_York\ for all users worldwide. This is incorrect for European, Asian, or any user whose device timezone differs.

**Impact:** Misleading UX. The label suggests all times are in ET when they may not be.

**Fix:** Use \Intl.DateTimeFormat().resolvedOptions().timeZone\ to get the user's actual timezone, or display a generic label like "your local timezone". The \schedule.ts\ service already uses the system's local time via \
ew Date()\, so the app is already operating in the user's local timezone — the label should reflect that.

### 4.4 [HIGH] Habit form schedule editor doesn't propagate changes via \onSave\

**File:** \src/components/habits/habit-form.tsx\

**Problem:** The habit form's \useState\ variables (\
ewReminderDays\, \eminderHour\, \eminderMinute\, \eminderWindow\) are local state that gets initialized from \existing\ habit data but **never synced back** when the user modifies them. The \onSave\ callback (passed from the parent \HabitEditor\) is never called with updated schedule data.

Specifically:
- \
ewReminderDays\ (weekly recurrence checkboxes) — changes are local only
- \eminderHour\ / \eminderMinute\ (time selects) — changes are local only
- \eminderWindow\ (window select) — changes are local only

When the sheet closes via \onDone()\, the parent re-renders the habit list from the store, which still has the old schedule values. The user's schedule edits are silently lost.

**Impact:** Users can spend time configuring weekly recurrence days and reminder times, close the editor, and see no change. This is a data-loss bug.

**Fix:** In the \submit\ handler, include the schedule fields (\eminderTimes\, \eminderHour\, \eminderMinute\, \eminderWindow\, \eminderEnabled\, \eminderDaysOfWeek\) in the persisted habit object. Currently the \submit\ function creates a \habit\ object but does **not** include these schedule fields — only \eminderDaysOfWeek\ is included.

### 4.5 [HIGH] \getColorStyle()\ crashes on unknown color strings

**File:** \src/components/icon-map.tsx\

**Problem:**
\\\	s
export function getColorStyle(color: string, opacity = 0.14): { ... } {
  const isHexColor = typeof color === "string" && color.startsWith("#");
  const rawColor = isHexColor ? color : colorStyles(color).raw;
  // ...
}
\\\

If \color\ is a non-HEX string that is not a valid palette name (e.g., \""\, \"invalid"\, or a user-tampered value), \colorStyles(color)\ returns \COLORS["teal"]\ as a fallback. However, if \color\ is \undefined\ or \
ull\ (which can happen if the habit's color field was not properly initialized), \color.startsWith("#")\ throws a TypeError.

**Impact:** Crashes if \color\ is \
ull\/\undefined\ on a habit record (e.g., from a malformed import or legacy data). Visual wrong-color rendering for unknown palette names.

**Fix:**
\\\	s
export function getColorStyle(color: string | undefined, opacity = 0.14): { ... } {
  if (!color) color = "teal";
  const isHexColor = typeof color === "string" && color.startsWith("#");
  const rawColor = isHexColor ? color : colorStyles(color).raw;
  // ...
}
\\\

### 4.6 [HIGH] \soundEnabled\ field never toggled — decoupling between store and UI

**File:** \src/stores/app-store.ts\

**Problem:** The store has two sound-related settings fields:
- \isSoundEnabled: boolean\ — toggled by \	oggleSound()\
- \isMuted: boolean\ — set by \	oggleSound()\ when explicitly passed \alse\
- \soundEnabled: boolean\ — present in \DEFAULT_SETTINGS\ and initial state, but **never updated by any action**

The \	oggleSound()\ action:
\\\	s
toggleSound(p?: boolean) {
  this.update((s) => ({
    ...s,
    isSoundEnabled: p ?? !s.isSoundEnabled,
    isMuted: p === false ? true : false,
  }));
}
\\\

Notice that \soundEnabled\ is not touched. This field was likely intended to be the primary sound toggle but was superseded by \isSoundEnabled\. The \soundEnabled\ field is therefore dead state — it's initialized to \	rue\ but never changes.

**Impact:** Confusion in state management. The \soundEnabled\ field is dead. The sound toggle in settings toggles \isSoundEnabled\ correctly (once the import path is fixed per §4.1), but \soundEnabled\ is never used.

**Fix:** Remove \soundEnabled\ from \DEFAULT_SETTINGS\ and the store state. Keep only \isSoundEnabled\ and \isMuted\. Update \epository.ts\ \DEFAULT_SETTINGS\ accordingly.

---

## 5. Medium-Priority Issues

### 5.1 Hydration mismatch on Saved/Draft indicator

**Files:** \src/app/page.tsx\, \src/features/habits/habit-form.tsx\

**Problem:** The "Saved" / "All changes saved" indicator in \	oday-page.tsx\ reads \localStorage\ directly during render:
\\\	s
const saved = state?.saved ?? true;
\\\
And in the habit form:
\\\	s
const saved = state?.saved ?? true;
\\\

On SSR, \localStorage\ is undefined, so \saved\ defaults to \	rue\. On the client, \localStorage\ may have a stale \alse\ value from a previous session, causing the indicator to flash from "All saved" to "Saving..." (or stay stuck at "All saved" when it shouldn't).

**Impact:** Minor UI flicker or incorrect status indicator on page load.

**Fix:** Initialize \saved\ from the Zustand store state (which is hydrated from localStorage via Zustand's persist middleware after mount), not from direct \localStorage\ reads. The store's \saved\ flag is already managed by the \useEffect\ that watches \isDirty\ — use that.

### 5.2 \weeklyRecurrence()\ returns \
ull\ instead of \[]\ for no selected days

**File:** \src/services/schedule.ts\

**Problem:** When \days\ is \
ull\, the function returns \[]\ (empty array). When \days\ is \[]\ (empty array), it returns a 7-element array of \alse\ values. The return type inconsistency makes the function harder to reason about.

**Impact:** Low — behaviorally equivalent (both result in no scheduled days). But inconsistent return types are a code smell.

**Fix:** Normalize to always return a 7-element boolean array, even for \
ull\ input (treat \
ull\ as no days selected → all false).

### 5.3 Sound settings: \soundEnabled\ vs \isSoundEnabled\ duplicate/confusion

**File:** \src/stores/app-store.ts\, \src/database/repository.ts\

**Problem:** See §4.6. The \soundEnabled\ field exists in \DEFAULT_SETTINGS\ but is never read or written by any action. It's a dead field that creates confusion.

**Fix:** Deprecate and remove \soundEnabled\. Keep only \isSoundEnabled\ and \isMuted\.

### 5.4 No system theme option — only light/dark toggle

**File:** \src/app/settings/page.tsx\

**Problem:** The settings page only offers Light and Dark theme options. The \ThemeMode\ type supports \\"system\"\ but no UI control exists to select it.

**Impact:** Users whose system is in dark mode but who want the app to follow the system preference have no way to set this.

**Fix:** Add a "System" theme option to the theme selector in settings, and implement \prefers-color-scheme\ media query matching in the theme application logic.

### 5.5 \settings-page.tsx\ sound toggle calls \	oggleSound\ with wrong argument handling

**File:** \src/app/settings/page.tsx\

**Problem:**
\\\	sx
onCheckedChange={() => toggleSound(!isSoundEnabled)}
\\\
The \	oggleSound\ action signature is \	oggleSound(p?: boolean)\. When called with \!isSoundEnabled\, it sets \isSoundEnabled: !isSoundEnabled\ explicitly. This works, but the \isMuted\ field is always set to \alse\ when \p\ is provided (even when \p\ is \	rue\). This means:
- Toggling sound ON: \isSoundEnabled = true\, \isMuted = false\ ✓
- Toggling sound OFF: \isSoundEnabled = false\, \isMuted = false\ — **mutes are lost!**

If a user had previously muted sounds (\isMuted = true\) and then toggles sound off via the switch, the mute state is reset to \alse\. When they toggle back on, sounds play immediately (because \isMuted\ is false).

**Impact:** The mute state is not preserved when toggling sound on/off via the switch.

**Fix:** Update \	oggleSound\ to preserve \isMuted\ when toggling:
\\\	s
toggleSound(p?: boolean) {
  this.update((s) => ({
    ...s,
    isSoundEnabled: p ?? !s.isSoundEnabled,
    // Only change isMuted when explicitly setting p === false (force mute)
    // Otherwise preserve existing isMuted
  }));
}
\\\

### 5.6 No \educed-motion\ respect in sound/animation

**Files:** \src/lib/sound.ts\, animation usages throughout

**Problem:** Sound effects play regardless of the user's \prefers-reduced-motion\ or \prefers-reduced-noise\ preferences. There's no check for \window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches\.

**Impact:** Users with vestibular disorders or sensory sensitivities may be disturbed by animations and sounds that they cannot fully disable (sound can be disabled, but there's no separate "reduced motion" toggle).

**Fix:** Add a check at the top of each sound function:
\\\	s
const prefersReducedMotion = window.matchMedia(\"(prefers-reduced-motion: reduce)\").matches;
if (prefersReducedMotion) return;
\\\
Or add a \educedMotion\ setting to the store.

### 5.7 Weekly recurrence checkboxes are \<button>\ elements, not radio/checkbox inputs

**Files:** \src/features/habits/habit-form.tsx\, \src/features/routines/routine-form.tsx\

**Problem:** The weekday selector uses \<button type="button" aria-pressed={active}>\ elements. While \ria-pressed\ provides semantic meaning for toggle buttons, this pattern is not ideal for a multi-select day picker. A proper implementation would use \<input type="checkbox">\ elements with associated labels, which provide:
- Native keyboard interaction (Space to toggle)
- Form submission support
- Better screen reader semantics
- Built-in focus management

**Impact:** Reduced keyboard accessibility for the weekday picker.

**Fix:** Replace \<button>\ elements with \<input type="checkbox">\ + \<label>\ pairs, styled with Tailwind. Keep the visual design identical.

### 5.8 \IconPicker\ keyboard navigation: search always returns 40 results

**File:** \src/components/shared/IconPicker.tsx\

**Problem:** When using keyboard navigation (typing to filter), the search input always shows 40 results (the full default \limit\). If the user types a very specific query that matches 2 icons, they still see 40 slots filled with the top-40 icons, making it hard to find the 2 matches.

**Impact:** Keyboard-driven icon search is less efficient than it could be.

**Fix:** When a search query is active, reduce \limit\ to show only matching results (or a smaller number like 12) to make matches more visible.

### 5.9 Form validation messages are generic (hardcoded English)

**Files:** All form files

**Problem:** Validation messages are hardcoded English strings like \"Habit name is required"\, \"Please select at least one weekday"\, etc. These are not using the \	()\ translation function, so they're not translatable.

**Impact:** If/when i18n is activated (§4.2), form validation messages will remain in English.

**Fix:** Use \	("habitForm.nameRequired")\ etc. with keys added to all locale files.

### 5.10 Empty state for goals page shows "No goals yet" but no CTAs

**File:** \src/app/goals/page.tsx\

**Problem:** When there are no goals, the page shows an empty state message but doesn't prominently offer a "Create your first goal" action button.

**Fix:** Add a primary action button to the empty state that opens the goal creation sheet.

### 5.11 \eorderHabits\ action signature mismatch with caller

**File:** \src/stores/app-store.ts\, \src/app/page.tsx\

**Problem:** The \eorderHabits\ action is defined as:
\\\	s
reorderHabits: (fromIndex: number, toIndex: number) => void
\\\
But the caller in \	oday-page.tsx\ passes:
\\\	s
reorderHabits(active.id, over!.id)
\\\
Passing string IDs where numbers are expected. TypeScript may not catch this if the types are loosely typed. The action would receive string IDs and try to use them as array indices, causing \undefined\ behavior.

**Fix:** Either change the action to accept IDs:
\\\	s
reorderHabits: (fromId: string, toId: string) => void
\\\
Or convert IDs to indices in the caller before calling the action.

---

## 6. Code Smells & Architecture Concerns

### 6.1 Single Zustand store is too large (900+ lines)

**File:** \src/stores/app-store.ts\

**Problem:** The store handles habits, goals, routines, bad habits, logs (habit + routine), groups, timer state, settings, reminders, sound, and import/export — all in a single file. This is a \"God store\" pattern.

**Concerns:**
- Difficult to reason about state updates
- High risk of unintended side effects when modifying one domain
- Testing requires mocking the entire store
- Not scalable as features grow

**Recommendation:** Split into domain-specific stores:
- \habit-store.ts\ — habits, habit logs, freeze tracking
- \goal-store.ts\ — goals, goal-habit links
- \outine-store.ts\ — routines, routine logs
- \quit-tracker-store.ts\ — bad habits, relapse logs
- \settings-store.ts\ — settings, sound, theme, notifications
- \	imer-store.ts\ — active timer state (already partially separate via \ctiveTimer\ in main store)

Or use a Zustand \combine\ pattern with separate slices that are composed in a root store.

### 6.2 \pp-store.ts\ exports actions both as store methods and named exports

**File:** \src/stores/app-store.ts\

**Problem:** Actions are defined inside the \create<Store>()\ call AND exported separately:
\\\	s
export const useAppStore = create<Store>((set, get) => ({
  // ... state
  // ... actions inside the store
}));

// THEN:
export const toggleSound = useAppStore.getState().toggleSound;
export const toggleSidebar = useAppStore.getState().toggleCollapse;
\\\

This dual export pattern is confusing. Components use \const { toggleSound } = useAppStore()\ (hook pattern) in some places and \	oggleSound()\ (named import) in others.

**Fix:** Pick one pattern and use it consistently. The hook pattern (\const { toggleSound } = useAppStore()\) is preferred for components that also read state. The named export pattern is fine for action-only utilities.

### 6.3 \loadSnapshot()\ reads from Dexie but store uses Zustand persist middleware

**Files:** \src/stores/app-store.ts\, \src/database/idb.ts\, \src/database/repository.ts\

**Problem:** There are **two persistence layers**:
1. Zustand's \persist\ middleware writes to \localStorage\ (key: \"cadence-storage"\)
2. \epository.ts\ writes to IndexedDB via Dexie (stores: \habits\, \habitLogs\, \goals\, \outines\, \outineLogs\, \adHabits\, \groups\, \meta\)

The Zustand \ehydrate\ handler calls \loadSnapshot()\ which reads from **IndexedDB**, not localStorage. This means:
- Zustand's localStorage cache is essentially bypassed on rehydrate
- The localStorage copy may be stale or inconsistent with IDB
- On first load, Zustand's persist middleware writes an empty/initial state to localStorage, then \ehydrate\ immediately overwrites with IDB data

**Concern:** Two persistence layers with different schemas and update paths. If they ever diverge, data corruption is possible.

**Recommendation:** Pick one primary persistence layer. Given that IDB via Dexie is more robust (handles larger datasets, proper schema versioning), consider removing Zustand's persist middleware and relying solely on the IDB layer with explicit load/save calls.

### 6.4 \epository.ts\ \DEFAULT_SETTINGS\ has extra fields not in \AppSettings\ type

**File:** \src/database/repository.ts\

**Problem:**
\\\	s
export const DEFAULT_SETTINGS: AppSettings = {
  id: "settings",
  theme: "system",
  language: "en",
  weekStartsOn: 1,
  notificationsEnabled: false,
  remindersEnabled: false,
  onboarded: false,
  isSoundEnabled: true,
  soundEnabled: true,   // ← Not in AppSettings type? Or duplicate?
  isMuted: false,
};
\\\

The \soundEnabled\ field may not be part of the \AppSettings\ interface, which would make this a type error in strict TypeScript. Need to verify.

### 6.5 No error boundary around the main app

**File:** \src/app/layout.tsx\, \src/app/page.tsx\

**Problem:** There's no React error boundary wrapping the app. If a component throws (e.g., due to bad data in the store, a malformed icon ID, etc.), the entire app crashes with a blank page.

**Fix:** Add an error boundary component (e.g., \ErrorBoundary\ from \eact-error-boundary\ or a custom one) wrapping the app's main content area.

### 6.6 \IconPicker\ search input has no debounce

**File:** \src/components/shared/IconPicker.tsx\

**Problem:** The search input filters icons synchronously on every keystroke. With 40 icons this is fine, but if the icon library grows (custom icons + more Lucide icons), this could cause unnecessary re-renders.

**Fix:** Add a lightweight debounce (e.g., 150ms) to the search input, or use a \useDeferredValue\ hook.

### 6.7 No loading skeleton for calendar page

**File:** \src/app/page.tsx\ (TodayPage has "Loading…" but calendar might not)

**Problem:** The Today page shows "Loading…" while \eady\ is false. Other pages may not have equivalent loading states. The calendar page especially benefits from a skeleton since it computes a month view.

**Fix:** Ensure all data-dependent pages show a loading state until \eady\ is true.

### 6.8 \use-mobile.tsx\ uses \matchMedia\ but doesn't handle SSR hydration properly

**File:** \src/hooks/use-mobile.ts\

**Problem:** On SSR, \window.matchMedia\ is undefined. The hook returns \alse\ on SSR (server) and then re-evaluates on mount. This can cause a hydration mismatch if the server rendered mobile-specific content.

**Fix:** Ensure the component using \useIsMobile()\ doesn't render different content on server vs. client, or use \suppressHydrationWarning\ on the relevant elements.

### 6.9 \esponsive-sheet.tsx\ — open/close state initialized before mount

**File:** \src/components/ui/responsive-sheet.tsx\

**Problem:** The \useState(initialOpen)\ initializes from the prop. On SSR, \initialOpen\ is whatever the server passes. On client mount, the state is set from the prop again, potentially causing a flash if the server and client disagree on the initial open state.

**Fix:** This is generally fine for sheets (they're usually closed on initial render). But ensure the parent always passes \open={false}\ on initial render.

### 6.10 \settings-page.tsx\ mixes two storage mechanisms for sound state

**File:** \src/app/settings/page.tsx\

**Problem:** The sound toggle in settings reads \soundEnabled\ from the store (Zustand + localStorage via persist) but the store's \	oggleSound\ action only updates \isSoundEnabled\ and \isMuted\. This creates a disconnect where:
- The settings UI shows \soundEnabled\ (from localStorage)
- The store's actual sound logic uses \isSoundEnabled\ (from Zustand)
- These two values can diverge

**Fix:** Remove \soundEnabled\ entirely (see §4.6, §5.3) and use only \isSoundEnabled\ + \isMuted\ everywhere.

### 6.11 Streak badge in habit-row recomputes on every render

**File:** \src/components/habits/habit-row.tsx\

**Problem:** The streak badge calls \streaks(habit, logMap)\ on every render. For a list of N habits, this is N streak calculations per render. While each calculation is cheap, this could be optimized with \useMemo\ keyed on \logMap\.

**Fix:** Wrap the streak calculation in \useMemo\:
\\\	s
const { current, best } = useMemo(
  () => streaks(habit, logMap),
  [habit.id, logMap]
);
\\\

### 6.12 \icon-map.tsx\ \colorStyles\ fallback cast is correct but verbose

**File:** \src/components/icon-map.tsx\

**Problem:**
\\\	s
export function colorStyles(color: string) {
  return COLORS[color] ?? (COLORS["teal"] as (typeof COLORS)[string]);
}
\\\

The \s (typeof COLORS)[string]\ cast is necessary because TypeScript can't infer that \COLORS["teal"]\ has the same type as \COLORS[color]\. This is correct but could be simplified by typing the return explicitly.

**Fix:** Add an explicit return type:
\\\	s
function colorStyles(color: string): (typeof COLORS)[string] {
  return COLORS[color] ?? COLORS["teal"];
}
\\\

### 6.13 \pp-store.ts\ \uid\ function — check collision resistance

**File:** \src/stores/app-store.ts\

**Problem:** The \uid()\ function generates IDs. What algorithm does it use? If it's \Math.random().toString(36)\, collisions are possible (though unlikely with sufficient length). If it's \crypto.randomUUID()\, it's collision-resistant.

**Recommendation:** Use \crypto.randomUUID()\ for ID generation. It's available in all modern browsers and Node.js.

### 6.14 Calendar page uses \dayjs\ but the rest of the app uses custom date utilities

**File:** \src/app/calendar/page.tsx\, \src/services/dates.ts\

**Problem:** The calendar page uses \dayjs\ for date manipulation, while \dates.ts\, \schedule.ts\, and \stats.ts\ use custom date utilities built on native \Date\. This creates an inconsistency in the date handling approach.

**Concern:** Two date libraries with potentially different timezone handling, formatting, and edge case behavior.

**Recommendation:** Standardize on one approach. Since the custom utilities in \dates.ts\ are lightweight and well-tested, consider removing \dayjs\ from the calendar page and using the custom utilities instead. Or migrate everything to \dayjs\ if its feature set is needed.

---

## 7. Security Considerations

### 7.1 No input sanitization on habit/goal/routine names

**Files:** All form files

**Problem:** User-entered names (habit names, goal names, routine names, step titles, trigger names) are rendered directly in the UI without sanitization. While React automatically escapes JSX text content (preventing XSS in most cases), the \	itle\ attribute on buttons and any \dangerouslySetInnerHTML\ usage could be vectors.

**Assessment:** React's JSX escaping handles the primary XSS risk for text content. The main risk would be in any \dangerouslySetInnerHTML\ usage or \href\ attributes constructed from user input.

**Recommendation:** Add a sanitization step for any user input that ends up in attributes (href, src, etc.). Use \encodeURI\ or similar for URL parameters constructed from user input.

### 7.2 No rate limiting on notification scheduling

**File:** \src/lib/notifications.ts\, \src/app/api/push/route.ts\

**Problem:** The push notification API route has no rate limiting. A malicious user (or a bug) could schedule hundreds of notifications. The current implementation checks \minutesSinceReminder < 0 || minutesSinceReminder > 5\ which prevents rapid repeated notifications for the same habit, but doesn't limit total notifications across all habits.

**Recommendation:** Add a simple debounce/rate limit: max N notifications per minute per user. Since this is a client-side app with no auth, the rate limit would be per-browser-instance using localStorage or a cookie.

### 7.3 \public/sw.js\ caching strategy may serve stale content

**File:** \public/sw.js\

**Problem:** The service worker caches assets with a "cache first, network second" or similar strategy. If the app is updated (new version deployed), users with the old service worker cached may continue seeing old content until the SW updates. The \skipWaiting\ + \clients.claim\ pattern in the SW should handle this, but it depends on correct implementation.

**Recommendation:** Verify that \skipWaiting\ and \clients.claim\ are correctly implemented in \public/sw.js\. Add a version check or cache-busting query parameter for critical API calls.

### 7.4 \manifest.json\ uses \protocolAuthers\ (typo) — should be \protocolHandlers\

**File:** \public/manifest.json\

**Problem:** The key \"protocolAuthers"\ is used for \web+cadence://\. The correct Web App Manifest spec key is \"protocolHandlers"\ (plural). This is a non-critical spec compliance issue.

**Fix:** Change to \"protocolHandlers"\.

Note: \protocolHandlers\ is a relatively new addition to the manifest spec and may not be supported in all browsers yet. Consider keeping both keys during the transition period or removing the custom protocol handler if not critical.

### 7.5 CORS headers on API routes

**File:** \src/app/api/push/route.ts\

**Problem:** The push notification API route sets \Access-Control-Allow-Origin: *\ and other CORS headers. This is appropriate for a PWA that may be hosted on a different domain than the API. The \VAPID public key\ is exposed in the client code — this is by design (VAPID public keys are not secret), so this is fine.

**Assessment:** Acceptable for the use case.

### 7.6 \VAPID_PRIVATE_KEY\ environment variable

**File:** \src/app/api/push/route.ts\

**Problem:** The VAPID private key is read from \process.env.VAPID_PRIVATE_KEY\. In a Next.js App Router server component/API route, this is server-side only and not exposed to the client. This is correct.

**Assessment:** Properly handled. The private key never leaves the server.

### 7.7 \window.\ references in components without SSR guards

**Files:** Multiple components

**Problem:** Several components access \window\, \localStorage\, \
avigator\ directly during render without \	ypeof window !== \"undefined\"\ checks. This causes SSR errors or hydration mismatches.

**Examples:**
- \	oday-page.tsx\ saved indicator: reads \localStorage\ during render
- \habit-form.tsx\ saved indicator: reads \localStorage\ during render
- \sound.ts\ \checkSoundEnabled()\: accesses \localStorage\ but has \isServer\ guard

**Fix:** Add SSR guards to all \window\/\localStorage\/\
avigator\ accesses during render. Use \useEffect\ for client-side-only initializations.

---

## 8. SEO / PWA / Accessibility Findings

### 8.1 PWA — Strengths

- ✅ \manifest.json\ properly configured with \display: standalone\, icons, theme colors
- ✅ Service worker (\public/sw.js\) handles caching and offline operation
- ✅ \<meta name="theme-color">\ set in \layout.tsx\ for both light and dark
- ✅ \<meta name="apple-mobile-web-app-capable" content="yes">\ for iOS
- ✅ \<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\
- ✅ PWA installation badges in the footer (\pwa-badges/\)
- ✅ Offline indicator banner when \
avigator.onLine === false\
- ✅ Custom protocol handler (\web+cadence://\) for deep linking (useful for URL schemes)

### 8.2 PWA — Issues

- ⚠️ **No \obots.txt\** — not critical for a personal app, but prevents search engines from understanding crawl rules if the app is ever publicly hosted
- ⚠️ **No \sitemap.xml\** — same as above
- ⚠️ **\manifest.json\ missing \description\ and \categories\** — recommended for app store / PWA directory listings
- ⚠️ **\protocolAuthers\ typo** in manifest (should be \protocolHandlers\)
- ⚠️ **No \lang\ attribute on \<html>\ in SSR** — \layout.tsx\ doesn't set \lang="en"\ on the \<html>\ element. The \LanguageProvider\ sets it via \document.documentElement.lang\ in a client effect, but SSR renders without it. Add \lang="en"\ (or dynamic lang) to the \<html>\ tag in \layout.tsx\.

### 8.3 Accessibility — Strengths

- ✅ \ria-pressed\ on weekday toggle buttons
- ✅ \ria-labelledby\ on weekday grid referencing the group label
- ✅ \ria-label\ on icon-only buttons (delete, restore, edit, add)
- ✅ \ria-hidden="true"\ on decorative icons (RenderIcon)
- ✅ \ole="alert"\ on Alert component (shadcn/ui)
- ✅ Form inputs have associated \<Label htmlFor>\ elements
- ✅ Color is never the sole indicator of state — icons + text accompany color coding
- ✅ Focus-visible styles via Tailwind's \ocus-visible:\ modifier (via shadcn/ui primitives)

### 8.4 Accessibility — Issues

- ⚠️ **No skip-to-content link** — the first focusable element on page load is typically the sidebar toggle or navigation. Add a skip link as the first focusable element in \layout.tsx\.
- ⚠️ **No \ria-live\ region for completion announcements** — when a habit is completed (checkmark animated), screen reader users get no feedback. Add an \ria-live="polite"\ region that announces "Habit completed: {name}".
- ⚠️ **Vaul sheets don't trap focus** — when a sheet opens, focus should move to the sheet content and be trapped until the sheet closes. Vaul may handle this partially, but verify. Add \ria-modal="true"\ and focus trap if not present.
- ⚠️ **IconPicker grid: no keyboard navigation for the grid itself** — the grid is a list of buttons, which is keyboard accessible, but there's no arrow-key navigation between icons (only tab). Add roving tabindex for grid navigation.
- ⚠️ **Habit form suggestions sidebar: no heading** — the suggestions section has no \<h2>\ or \ria-heading\. Add \<h2 className="sr-only">Suggested habits</h2>\ or visible heading.
- ⚠️ **Calendar: previous/next month buttons have \ria-label\** — good, but the current month display should have \ria-live="polite"\ to announce month changes to screen readers.
- ⚠️ **Goal form: linked habits section has no heading** — add \<legend>\ or \<h3>\ for the "Linked habits" fieldset.
- ⚠️ **Quit tracker: streak counter animation** — the streak counter animates on mount. Add \prefers-reduced-motion\ check or provide a static fallback.

### 8.5 SEO — Strengths

- ✅ \<title>\ set in \layout.tsx\: \"Cadence · A habit tracker for iPhone"\
- ✅ \<meta name="description">\ set: \"A habit tracker for iPhone. Track your habits, build streaks, and achieve your goals."\
- ✅ Open Graph tags: \og:title\, \og:description\, \og:image\, \og:type\, \og:url\
- ✅ Twitter Card tags: \	witter:card\, \	witter:title\, \	witter:description\, \	witter:image\
- ✅ Canonical URL set

### 8.6 SEO — Issues

- ⚠️ **Title says "for iPhone"** — the app is a PWA that works on all platforms. Consider changing to "A habit tracker for daily life" or similar platform-neutral language.
- ⚠️ **No structured data (JSON-LD)** — adding \Application\ or \SoftwareApplication\ structured data could help with search visibility.
- ⚠️ **\pple-mobile-web-app-title\ is set** but the iOS home screen title may truncate. Consider a shorter app name for iOS.

---

## 9. Translation Coverage Audit

### 9.1 What's translated (all 5 locales)

The following keys are fully translated in all 5 languages (en, ar, es, fr, de):

**Navigation (9 keys):**
\
av.today\, \
av.calendar\, \
av.stats\, \
av.goals\, \
av.routines\, \
av.quitTracker\, \
av.settings\, \
av.more\, \
av.add\

**Settings (14 keys):**
\settings.title\, \settings.language\, \settings.languageDesc\, \settings.theme\, \settings.themeLight\, \settings.themeDark\, \settings.themeSystem\, \settings.data\, \settings.dataDescription\, \settings.export\, \settings.import\, \settings.clear\, \settings.clearConfirmTitle\, \settings.clearConfirmDesc\, \settings.cancel\, \settings.clearConfirmYes\

**Quit Tracker (19 keys):**
\quitTracker.title\, \quitTracker.subtitle\, \quitTracker.new\, \quitTracker.edit\, \quitTracker.currentStreak\, \quitTracker.longestStreak\, \quitTracker.iRelapsed\, \quitTracker.relapseHistory\, \quitTracker.quitDate\, \quitTracker.saveChanges\, \quitTracker.startTracking\, \quitTracker.habitTitle\, \quitTracker.habitTitlePlaceholder\, \quitTracker.quitStartTime\, \quitTracker.icon\, \quitTracker.colorTheme\, \quitTracker.presets\, \quitTracker.deleteConfirm\, \quitTracker.deletedToast\

**Relapse Modal (7 keys):**
\elapseModal.title\, \elapseModal.description\, \elapseModal.banner\, \elapseModal.triggerPrompt\, \elapseModal.reasonPrompt\, \elapseModal.reasonPlaceholder\, \elapseModal.submit\

**Trigger Types (7 keys):**
\	rigger.social\, \	rigger.socialDesc\, \	rigger.stress\, \	rigger.stressDesc\, \	rigger.boredom\, \	rigger.boredomDesc\, \	rigger.digital\, \	rigger.digitalDesc\, \	rigger.custom\, \	rigger.customDesc\

**Offline (3 keys):**
\offline.offline\, \offline.backOnline\, \offline.hint\

**User (1 key):**
\
av.user\

**Total: ~69 unique keys translated across all 5 locales.**

### 9.2 Missing translations (present in en, missing in ar / de)

**Arabic (ar.ts) is missing:**
- ❌ \
av.user\ — not present in ar.ts

**German (de.ts) is missing:**
- ❌ \
av.user\ — not present in de.ts

Both Arabic and German have all other navigation, settings, quit tracker, relapse modal, and trigger keys.

### 9.3 Translation quality observations

- ✅ Arabic translation is well-done with proper RTL context (\dir: "rtl"\ is set in \LANGUAGES\ for Arabic)
- ✅ German translation is natural and idiomatic
- ✅ Spanish translation is accurate
- ✅ French translation is accurate
- ⚠️ Arabic uses \\"متتعبات الإقلاع\"\ for \quitTracker.title\ — this looks like a typo. The correct form would be \\"متتبع الإقلاع\"\ (singular) or \\"متتبعات الإقلاع\"\ (plural). \\"متتعبات\"\ is not a standard Arabic word — it appears to be a typo for \\"متتبعات\"\.

### 9.4 Translation coverage by feature

| Feature | Translation Coverage | Notes |
|---------|---------------------|-------|
| Navigation | ✅ Full (5/5) | All nav keys translated |
| Settings page | ✅ Full (5/5) | All settings keys translated |
| Quit tracker | ✅ Full (5/5) | All QT keys translated |
| Relapse modal | ✅ Full (5/5) | All relapse keys translated |
| Trigger types | ✅ Full (5/5) | All trigger keys translated |
| Today page | ❌ None | Greeting, habit names, "X of Y completed", "Add habit", filter labels — all hardcoded English |
| Calendar page | ❌ None | Month names, day labels, "Today" button — hardcoded English |
| Stats page | ❌ None | "Statistics", "7 days", "30 days", "90 days", "1 year", "Completion rate", "Best streak" — hardcoded English |
| Goals page | ❌ None | "Goals", "Create goal", form labels — hardcoded English |
| Routines page | ❌ None | "Routines", "Create routine", form labels — hardcoded English |
| Habit form | ❌ None | "Create habit", "Edit habit", form labels, validation messages — hardcoded English |
| Delete confirmation | ❌ None | "Delete habit?" — hardcoded English |
| Toast messages | ❌ None | "Habit created", "Habit deleted", "Data exported" — hardcoded English |

**Only ~15% of visible UI strings are covered by the translation system.**

### 9.5 Key observation

Despite 5 locale files existing with ~70 translated keys, **the actual application UI is almost entirely untranslated**. The translated keys cover only the navigation, settings, quit tracker, and relapse modal. The main features (Today, Calendar, Stats, Goals, Routines) have zero translation coverage.

This is the most significant gap in the i18n effort. Fixing this would require:
1. Adding \	()\ calls to all UI strings in all page components (Today, Calendar, Stats, Goals, Routines, all form files)
2. Adding the corresponding keys to all 5 locale files
3. Fixing the \LanguageProvider\ to actually switch languages (§4.2)
4. Adding a language selector to settings (§4.2)

---

## 10. TypeScript / Build / Testing Concerns

### 10.1 TypeScript strict mode is on — good

\\\json
// tsconfig.json
\"strict\": true,
\"noUncheckedIndexedAccess\": true,
\"exactOptionalPropertyTypes\": true,
\"noPropertyAccessFromIndexSignature\": true,
\\\

These are excellent settings. The codebase generally respects them.

### 10.2 \
oUnusedLocals\ and \
oUnusedParameters\ are off

\\\json
\"noUnusedLocals\": false,
\"noUnusedParameters\": false,
\\\

This is fine for development velocity but means unused imports/variables won't be caught. The ESLint config compensates partially (\@typescript-eslint/no-unused-vars: \"warn\"\), but unused type imports may slip through.

### 10.3 No \	sc\ type-check step in build pipeline

**File:** \package.json\

\\\json
\"scripts\": {
  \"build\": \"next build\",
  // No \"type-check\": \"tsc --noEmit\" script
}
\\\

Next.js \uild\ does perform type checking during build (with \	ypescript\ error reporting), but it's not a separate, fast type-check step. For CI/CD, a dedicated \	sc --noEmit\ step is recommended to catch type errors before the slower Next.js build.

**Fix:** Add to \package.json\:
\\\json
\"scripts\": {
  \"type-check\": \"tsc --noEmit\",
  \"build\": \"npm run type-check && next build\"
}
\\\

### 10.4 Vitest configured but zero tests

**File:** \itest.config.ts\ exists. No test files were found in the repository.

**Concern:** With 900+ lines in the store, complex scheduling/stats logic, and a custom icon rendering pipeline, the lack of tests is a risk. Critical pure functions that should have tests:
- \schedule.ts\: \isScheduledOn()\, \weeklyRecurrence()\
- \stats.ts\: \isCompleteOn()\, \streaks()\, \dayCompletion()\, \consistencyScore()\
- \icon-map.tsx\: \esolveIconName()\, \getColorStyle()\, \colorStyles()\
- \epository.ts\: \loadSnapshot()\ migration logic, \importSnapshot()\ rollback

**Recommendation:** Add tests for the pure service functions first (they're the easiest to test and highest value). Then add component tests for critical user flows.

### 10.5 Type safety in \icon-map.tsx\

**File:** \src/components/icon-map.tsx\

**Observations:**
- \ICONS: Record<string, LucideIcon>\ — good, explicit typing
- \ICON_NAMES: string[]\ — derived from \Object.keys(ICONS)\, typed as \string[]\ — fine
- \colorStyles(color: string)\ returns \(typeof COLORS)[string]\ — good, but when color is unknown, it returns \COLORS[\"teal\"]\ which is cast via \s (typeof COLORS)[string]\ — this cast is correct but could be typed better
- \getColorStyle\ return type \{ style: React.CSSProperties; rawColor: string; tint: string }\ — good

### 10.6 \AppSettings\ type — verify \soundEnabled\ field

**File:** \src/types/index.ts\

**Problem:** \DEFAULT_SETTINGS\ in \epository.ts\ includes \soundEnabled: true\. If \AppSettings\ interface doesn't have this field, it's a type error. Need to verify the type definition.

### 10.7 \uid()\ function — check collision resistance

**File:** \src/stores/app-store.ts\

**Problem:** The \uid()\ function generates IDs. What algorithm does it use? If it's \Math.random().toString(36)\, collisions are possible (though unlikely with sufficient length). If it's \crypto.randomUUID()\, it's collision-resistant.

**Recommendation:** Use \crypto.randomUUID()\ for ID generation. It's available in all modern browsers and Node.js.

### 10.8 ESLint configuration is reasonable

**File:** \.eslintrc.json\

\\\json
{
  \"extends\": \"next/core-web-vitals\",
  \"rules\": {
    \"@typescript-eslint/no-unused-vars\": \"warn\",
    \"@typescript-eslint/no-explicit-any\": \"warn\"
  }
}
\\\

Good baseline. \
o-explicit-any\ as \warn\ (not \error\) is a pragmatic choice for a codebase with some \ny\ usage in the sound system.

### 10.9 \
ext.config.mjs\ — PWA plugin configuration

**File:** \
ext.config.mjs\

**Observations:**
- \
ext-pwa\ is configured with \dest: \"public\", register: true, skipWaiting: true\
- \disable: process.env.NODE_ENV === \"development\"\ — PWA is disabled in dev, which is correct
- \untimeCaching\ is configured for API routes and static assets

### 10.10 Bundle analysis

**File:** \.next/static/BundleAnalyzer\ (if generated)

**Note:** The \@next/bundle-analyzer\ plugin is configured in \
ext.config.mjs\. Running \
pm run build\ with \ANALYZE=true\ would generate a bundle report. This is a useful tool for identifying large dependencies.

---

## 11. Prioritized Actionable Roadmap

### Phase 0 — Ship-Stopping Bugs (fix before any feature work)

These bugs prevent core functionality from working. Fix in this order:

| # | Bug | File(s) | Effort |
|---|-----|---------|--------|
| P0-1 | **Fix \useSound\ import path** — change \@/hooks/use-sound\ → \@/lib/sound\ in \pp-store.ts\ and all form files. Verify sound functions are exported from \sound.ts\ and imported correctly. | \pp-store.ts\, \habit-form.tsx\, \	oday-page.tsx\, \settings-page.tsx\ | 15 min |
| P0-2 | **Wire up language switching** — fix \LanguageProvider\ to read from store + browser, fix \setLanguage\ to use the argument, fix \settings-page.tsx\ to pass the selected language value, add a language \<Select>\ widget to settings. | \context.tsx\, \settings-page.tsx\ | 1-2 hrs |
| P0-3 | **Fix habit form schedule persistence** — include \eminderTimes\, \eminderHour\, \eminderMinute\, \eminderWindow\, \eminderEnabled\, \eminderDaysOfWeek\ in the \submit\ handler's persisted habit object. | \habit-form.tsx\ | 30 min |
| P0-4 | **Fix \getColorStyle\ null/undefined crash** — add nullish check at the top of the function. | \icon-map.tsx\ | 5 min |
| P0-5 | **Remove dead \soundEnabled\ field** — remove from \DEFAULT_SETTINGS\ and store state. Keep only \isSoundEnabled\ and \isMuted\. | \pp-store.ts\, \epository.ts\ | 10 min |
| P0-6 | **Fix timezone label** — replace hardcoded \\"America/New_York\"\ with \Intl.DateTimeFormat().resolvedOptions().timeZone\ or \\"your local time\"\. | \page.tsx\ | 5 min |

### Phase 1 — Core Quality (fix within 1 sprint)

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| P1-1 | **Hydration mismatch on saved indicator** — initialize from Zustand store state, not direct localStorage read. | \page.tsx\, \habit-form.tsx\ | 30 min |
| P1-2 | **Normalize \weeklyRecurrence()\ return type** — always return 7-element boolean array. | \schedule.ts\ | 10 min |
| P1-3 | **Add \lang\ attribute to \<html>\ in \layout.tsx\** — set from \LanguageProvider\ or default to \\"en\"\. | \layout.tsx\ | 5 min |
| P1-4 | **Fix Arabic typo** — \\"متتعبات\"\ → \\"متتبعات\"\ in \r.ts\. | \locales/ar.ts\ | 2 min |
| P1-5 | **Add missing \
av.user\ key to ar.ts and de.ts** | \locales/ar.ts\, \locales/de.ts\ | 2 min |
| P1-6 | **Add \	ypescript\ type-check script to package.json** — \	sc --noEmit\ as a pre-build step. | \package.json\ | 5 min |
| P1-7 | **Add Error Boundary** around the main app content. | \layout.tsx\ | 30 min |
| P1-8 | **Audit \AppSettings\ type** — verify \soundEnabled\ is (or is not) part of the type, align \DEFAULT_SETTINGS\ accordingly. | \	ypes/index.ts\, \epository.ts\ | 10 min |

### Phase 2 — PWA, SEO, Accessibility (fix within 2 sprints)

| # | Issue | File(s) | Effort |
|---|-------|---------|--------|
| P2-1 | **Add skip-to-content link** as first focusable element in \layout.tsx\. | \layout.tsx\ | 10 min |
| P2-2 | **Add \ria-live\ region** for habit completion announcements. | \	oday-page.tsx\ | 30 min |
| P2-3 | **Verify Vaul sheet focus trapping** — add \ria-modal=\"true\"\ if not present. | \esponsive-sheet.tsx\ | 15 min |
| P2-4 | **Replace weekday \<button>\ checkboxes with \<input type=\"checkbox\">\** in habit-form and routine-form. | \habit-form.tsx\, \outine-form.tsx\ | 45 min |
| P2-5 | **Add \prefers-reduced-motion\ check** to sound functions in \sound.ts\. | \sound.ts\ | 15 min |
| P2-6 | **Fix \manifest.json\**: add \description\, \categories\, fix \protocolAuthers\ → \protocolHandlers\. | \manifest.json\ | 10 min |
| P2-7 | **Add \lang=\"en\"\ to \<html>\ tag** in \layout.tsx\ (SSR). | \layout.tsx\ | 5 min |
| P2-8 | **Change app title** from \"for iPhone\" to platform-neutral language. | \layout.tsx\ | 2 min |
| P2-9 | **Add \obots.txt\ and \sitemap.xml\** (even if empty/placeholder for now). | \public/\ | 10 min |
| P2-10 | **IconPicker: reduce search result limit when filtering** — show fewer results when query is active. | \IconPicker.tsx\ | 15 min |

### Phase 3 — i18n Completion (large effort, plan as a dedicated project)

| # | Task | Effort |
|---|------|------|
| P3-1 | Add \	()\ calls to all UI strings in Today page | 2-3 hrs |
| P3-2 | Add \	()\ calls to all UI strings in Calendar page | 2-3 hrs |
| P3-3 | Add \	()\ calls to all UI strings in Stats page | 1-2 hrs |
| P3-4 | Add \	()\ calls to all UI strings in Goals page | 1-2 hrs |
| P3-5 | Add \	()\ calls to all UI strings in Routines page | 1-2 hrs |
| P3-6 | Add \	()\ calls to all form validation messages (habit, goal, routine, quit tracker) | 2-3 hrs |
| P3-7 | Add \	()\ calls to all toast messages | 1 hr |
| P3-8 | Add corresponding keys to all 5 locale files (translate) | 4-8 hrs (or use translation service) |
| P3-9 | Add language selector to settings page UI | 1 hr |
| P3-10 | Add \ria-live\ region for locale change announcements | 30 min |

### Phase 4 — Testing (ongoing)

| # | Task | Priority |
|---|------|---------|
| P4-1 | Add unit tests for \schedule.ts\ (\isScheduledOn\, \weeklyRecurrence\) | High |
| P4-2 | Add unit tests for \stats.ts\ (\isCompleteOn\, \streaks\, \dayCompletion\, \consistencyScore\) | High |
| P4-3 | Add unit tests for \icon-map.ts\ (\esolveIconName\, \getColorStyle\, \colorStyles\) | Medium |
| P4-4 | Add unit tests for \epository.ts\ (\loadSnapshot\ migration, \importSnapshot\ rollback) | High |
| P4-5 | Add component tests for habit form (create, edit, validate, save) | Medium |
| P4-6 | Add component tests for quit tracker form | Medium |
| P4-7 | Add snapshot tests for key UI components | Low |

### Phase 5 — Architecture Improvements (long-term)

| # | Task | Effort |
|---|------|---------|
| P5-1 | Split \pp-store.ts\ into domain-specific stores (habits, goals, routines, quit-tracker, settings) | 1-2 days |
| P5-2 | Remove Zustand persist middleware; use IDB as single source of truth | 1 day |
| P5-3 | Add API routes for push notification scheduling (with rate limiting) | 2-3 days |
| P5-4 | Add user authentication (if multi-user is a future goal) | Large |
| P5-5 | Migrate to \
ext-intl\ for more robust i18n (server-side translations, automatic locale routing) | 2-3 days |
| P5-6 | Add automated accessibility testing (axe-core, pa11y) to CI | 1 day |

---

## 12. File-by-File Notes

### \src/app/layout.tsx\
- Overall: Good. Sets up metadata, theme provider, font, PWA meta tags, offline indicator, footer.
- Issue: No \lang\ attribute on \<html>\. Add \lang=\"en\"\ (or dynamic from language context).
- Issue: Title says \"for iPhone\" — platform-neutral language preferred.
- Issue: No skip-to-content link.

### \src/app/page.tsx\ (TodayPage)
- Overall: Strong component. Good use of DND, filtering, search, completion tracking.
- Issue: Hardcoded \\"America/New_York\"\ timezone label [P0-6].
- Issue: Saved indicator reads localStorage directly — hydration mismatch [P1-1].
- Issue: \ctiveSound\ / sound toggle from store — broken due to import path [P0-1].
- Note: \eorderHabits\ receives \(active.id, over!.id)\ — type mismatch with action signature. Action expects indices; caller passes IDs. Fix the action to accept IDs, or convert IDs to indices in the caller.

### \src/app/calendar/page.tsx\
- Overall: Clean calendar implementation. Good use of \isScheduledOn\ for dot rendering.
- Issue: No translation coverage for month names, day labels.
- Note: Week start day from settings is used correctly.
- Note: Uses \dayjs\ for date manipulation — inconsistency with custom date utilities used elsewhere.

### \src/app/stats/page.tsx\
- Overall: Well-designed stats page with trend chart and per-habit breakdown.
- Issue: \MetricCard\ uses \React.ComponentType<{ className?: string }>\ — correct but could use a simpler icon prop type.
- Issue: No translation coverage.

### \src/app/goals/page.tsx\
- Overall: Good goals list with progress bars. Empty state handled.
- Issue: \GoalForm\ is a separate component — good separation.
- Issue: Linked habits progress tracking — the \habit_milestone\ goal type derives progress from linked habits, but the progress calculation logic needs verification.

### \src/app/routines/page.tsx\
- Overall: Routine list with completion indicators.
- Issue: No translation coverage.

### \src/app/settings/page.tsx\
- Overall: Comprehensive settings page with data management, notifications, theme.
- Issue: Language section calls \updateSettings({ language: \"en\" })\ — hardcoded, must use selected value [P0-2].
- Issue: No language selector widget rendered.
- Issue: Sound toggle doesn't preserve \isMuted\ state [P1-4].

### \src/app/api/push/route.ts\
- Overall: Clean VAPID push notification implementation.
- Issue: No rate limiting on notification scheduling.
- Note: \webPush.sendNotification()\ is correctly used with TTL and prioritization.

### \src/components/ui/responsive-sheet.tsx\
- Overall: Thin wrapper around Vaul. Good.
- Note: Vaul compatibility with Next.js App Router should be verified (Vaul uses React Portal which can have issues with App Router's server components).

### \src/components/ui/sonner.tsx\
- Overall: Wrapper around Sonner Toaster. Good.
- Note: \Toaster\ is a client component — correctly marked with \"use client"\.

### \src/components/icon-map/icon-map.tsx\
- Overall: Excellent icon resolution system. Good color handling.
- Issue: \getColorStyle\ crashes on null/undefined color [P0-4].
- Note: \RenderIcon\ — good fallback to \Target\ icon.
- Note: \indCustomIcon\ documentation is excellent — clear warning about render order.

### \src/components/icon-map/RenderIcon.tsx\
- Note: Separate file for the render component — good separation. Uses \ICONS[resolved] ?? Target\ pattern.

### \src/components/shared/ColorPicker.tsx\
- Overall: Good color picker with preset colors + custom HEX input.
- Note: Uses \eact-colorful\ for the HEX picker popup.

### \src/components/shared/IconPicker.tsx\
- Overall: Feature-rich icon picker with search, grid, and custom icon upload.
- Issue: Keyboard search always shows 40 results [P2-10].
- Note: Custom icon upload via file picker + SVG paste is a nice feature.

### \src/components/habits/habit-form.tsx\
- Overall: Comprehensive form with schedule editor, reminder settings, freeze budget, icon/color pickers.
- Issue: Schedule changes not persisted [P0-3].
- Issue: Imports \useSound\ from broken path [P0-1].
- Note: Freeze budget UI is well-designed.

### \src/components/habits/habit-editor.tsx\
- Overall: Clean hook-based editor pattern. Good use of \createContext\ + \useHabitEditor()\.
- Note: The editor opens as a ResponsiveSheet — good mobile UX.

### \src/components/habits/habit-row.tsx\
- Overall: Clean row component with completion checkbox, streak badge, color-coded icon, and delete action.
- Issue: Checkbox ARIA: \<input type=\"checkbox\" aria-label={...}>\ — good.
- Note: Streak badge uses \streaks(habit, logMap)\ — recomputes on every render. Could be memoized.

### \src/components/quit-tracker/quit-tracker-form.tsx\
- Overall: Well-designed quit tracker form with suggestions, icon/color pickers.
- Issue: Imports \useSound\ from broken path [P0-1].
- Note: Relapse modal trigger selection is well-designed.

### \src/components/quit-tracker/relapse-modal.tsx\
- Overall: Good relapse logging modal with trigger selection and notes.
- Note: Uses \createPortal\ for the modal — good for accessibility.

### \src/components/notifications/push-notification.tsx\
- Overall: Push notification permission flow with VAPID.
- Note: \NotificationScheduler\ component in \page.tsx\ polls every 60 seconds — this is a reasonable approach for a client-side app without a background service worker for notifications.

### \src/stores/app-store.ts\
- Overall: Comprehensive store. Well-organized actions.
- Issue: Import path for \useSound\ [P0-1].
- Issue: Dead \soundEnabled\ field [P0-5].
- Issue: Too large — consider splitting [P5-1].
- Note: \loadSnapshot\ in \ehydrate\ — reads from IDB, good.

### \src/database/idb.ts\
- Overall: Clean Dexie schema. Good versioning.
- Note: \on('populate')\ seed data is a nice touch for first-time users.

### \src/database/repository.ts\
- Overall: Good snapshot management. Rollback on import failure is excellent.
- Issue: \DEFAULT_SETTINGS\ has \soundEnabled\ field that may not be in the type [P1-8].
- Note: \alidateImportSnapshot\ uses \sserts\ — good type narrowing.

### \src/services/dates.ts\
- Overall: Clean date utilities. \	odayKey()\ uses local timezone — correct for a personal app.
- Note: \ddDays\ and \angeKeys\ are well-implemented.

### \src/services/schedule.ts\
- Overall: Good schedule checking logic.
- Issue: \weeklyRecurrence\ return type inconsistency [P1-2].

### \src/services/stats.ts\
- Overall: Good stats calculations. Streak logic is correct.
- Note: \consistencyScore\ uses a 30-day window — reasonable default.

### \src/i18n/context.tsx\
- Overall: Good structure but non-functional switching [P0-2].
- Issue: Hardcoded \\"en\"\, \setLanguage\ ignores argument, \	()\ always reads English.

### \src/i18n/locales/*.ts\
- Overall: 5 locales with ~70 keys each. Good coverage for settings, nav, quit tracker, relapse.
- Issue: Main feature pages (Today, Calendar, Stats, Goals, Routines) have zero translation keys.
- Issue: Arabic typo: \\"متتعبات\"\ → \\"متتبعات\"\ [P1-4].
- Issue: Missing \
av.user\ in ar.ts and de.ts [P1-5].

### \src/lib/sound.ts\
- Overall: Well-implemented sound synthesis using Web Audio API. No external audio files needed.
- Note: \checkSoundEnabled\ reads from multiple localStorage keys for backward compat — good.
- Issue: No \prefers-reduced-motion\ / \prefers-reduced-noise\ check [P2-5].

### \src/hooks/use-online-status.ts\
- Overall: Clean hook. Good SSR handling.
- Note: \useState(true)\ initial value matches SSR render — prevents hydration mismatch.

### \src/hooks/use-mobile.ts\
- Overall: Clean mobile detection via \matchMedia\.
- Note: \window.matchMedia\ is accessed inside \useEffect\ — correct for SSR safety.

### \public/manifest.json\
- Overall: Well-configured PWA manifest.
- Issue: Missing \description\ and \categories\ [P2-6].
- Issue: \\"protocolAuthers\"\ typo — should be \\"protocolHandlers\"\ [P2-6].

### \public/sw.js\
- Overall: Service worker for offline caching.
- Note: \skipWaiting\ + \clients.claim\ pattern should be verified for correct update behavior.

---

*End of Audit Report*
