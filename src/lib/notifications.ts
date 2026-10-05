import { isScheduledOn } from "@/services/schedule";
import { isCompleteOn, streaks, type LogMap } from "@/services/stats";
import type { Habit } from "@/types";
import { dictionaries } from "@/i18n/dictionaries";
import type { LanguageCode } from "@/i18n/types";

function getActiveLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem("cadence_language");
    if (stored === "ar" || stored === "en") {
      return stored;
    }
  } catch {
    // fallback
  }
  return "en";
}

function getNotificationText(key: string, values?: Record<string, string | number>): string {
  const lang = getActiveLanguage();
  const dict = dictionaries[lang] || dictionaries.en;
  let text = dict[key] || dictionaries.en[key] || key;
  if (values) {
    for (const [placeholder, val] of Object.entries(values)) {
      text = text.replace(new RegExp(`\\{${placeholder}\\}`, "g"), String(val));
    }
  }
  return text;
}

export type NotificationPermissionState = NotificationPermission | "unsupported";

function hasNotificationSupport(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!hasNotificationSupport()) return "unsupported";
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!hasNotificationSupport()) return "unsupported";
  return window.Notification.requestPermission();
}

function canSendNotification(): boolean {
  return hasNotificationSupport() && window.Notification.permission === "granted";
}

export async function dispatchNotification(
  title: string,
  options: NotificationOptions,
): Promise<void> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  // 1. Mobile browsers prefer ServiceWorker showNotification (avoids Illegal Constructor error)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(title, {
          ...options,
          badge: options.badge || "/pwa-192x192.png?v=2",
          data: { url: "/" },
        });
        console.log(
          "[NotificationScheduler] Dispatched via ServiceWorkerRegistration.showNotification",
          { title },
        );
        return;
      }
    } catch (err) {
      console.warn(
        "[NotificationScheduler] ServiceWorker showNotification failed, trying window fallback",
        err,
      );
    }
  }

  // 2. Desktop fallback
  try {
    new Notification(title, options);
    console.log("[NotificationScheduler] Dispatched via window.Notification", { title });
  } catch (error) {
    console.warn("[NotificationScheduler] Window notification failed", error);
  }
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Maximum delay in minutes after a scheduled reminder time that a notification
 * is still considered relevant to fire. Mobile browsers throttle or freeze
 * background tabs, so an interval can wake up 10-30 minutes late.
 */
const MAX_REMINDER_DELAY_MINUTES = 60;

export async function checkDailyHabitReminder(
  habits: Habit[],
  logs: LogMap,
  now = new Date(),
): Promise<boolean> {
  const permission = getNotificationPermission();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  console.log("[NotificationScheduler] Evaluating", { permission, currentTime });
  if (!canSendNotification()) {
    console.log("[NotificationScheduler] Skipped: browser permission is not granted");
    return false;
  }

  const dateKey = getDateKey(now);
  let sent = false;

  try {
    for (const habit of habits) {
      if (habit.archived || !isScheduledOn(habit, dateKey) || isCompleteOn(habit, logs, dateKey)) {
        continue;
      }

      const reminderTimes = habit.reminderTimes?.length
        ? habit.reminderTimes
        : habit.reminder
          ? [habit.reminder]
          : [];
      for (const reminderTime of reminderTimes) {
        const [hours, minutes] = reminderTime.split(":").map(Number);
        if (hours === undefined || minutes === undefined) continue;
        const reminderMinutes = hours * 60 + minutes;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const minutesSinceReminder = currentMinutes - reminderMinutes;

        // Tolerant window: 0 to MAX_REMINDER_DELAY_MINUTES to accommodate background tab throttling
        if (minutesSinceReminder < 0 || minutesSinceReminder > MAX_REMINDER_DELAY_MINUTES) {
          continue;
        }
        const sentKey = `cadence-reminder-sent:${dateKey}:${habit.id}:${reminderTime}`;
        if (window.localStorage.getItem(sentKey) === "1") {
          continue;
        }

        console.log("[NotificationScheduler] Matched habit reminder", {
          habit: habit.name,
          reminderTime,
          currentTime,
        });
        const currentStreak = streaks(habit, logs).current;
        const unit =
          currentStreak === 1
            ? getNotificationText("common.day")
            : getNotificationText("common.days");
        await dispatchNotification(habit.name, {
          body: getNotificationText("notification.streakBody", { streak: currentStreak, unit }),
          icon: "/pwa-192x192.png?v=2",
          tag: `cadence-reminder-${habit.id}-${dateKey}-${reminderTime}`,
        });
        window.localStorage.setItem(sentKey, "1");
        sent = true;
      }
    }
    return sent;
  } catch (error) {
    console.warn("[NotificationScheduler] Failed while evaluating reminders", error);
    return false;
  }
}

/**
 * Syncs today's pending reminders with the Service Worker so background
 * worker wakeups (Periodic Sync, Background Sync) can evaluate and display them
 * even when the main web app tab is suspended.
 */
export async function syncRemindersToServiceWorker(
  habits: Habit[],
  logs: LogMap,
  now = new Date(),
): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active || navigator.serviceWorker.controller;
    if (!worker) return;

    const dateKey = getDateKey(now);
    const pendingReminders = [];

    for (const habit of habits) {
      if (habit.archived || !isScheduledOn(habit, dateKey) || isCompleteOn(habit, logs, dateKey)) {
        continue;
      }
      const reminderTimes = habit.reminderTimes?.length
        ? habit.reminderTimes
        : habit.reminder
          ? [habit.reminder]
          : [];

      const currentStreak = streaks(habit, logs).current;
      const unit =
        currentStreak === 1
          ? getNotificationText("common.day")
          : getNotificationText("common.days");
      const body = getNotificationText("notification.streakBody", { streak: currentStreak, unit });

      for (const reminderTime of reminderTimes) {
        const sentKey = `cadence-reminder-sent:${dateKey}:${habit.id}:${reminderTime}`;
        if (window.localStorage.getItem(sentKey) === "1") {
          continue;
        }

        pendingReminders.push({
          id: `cadence-reminder-${habit.id}-${dateKey}-${reminderTime}`,
          habitId: habit.id,
          habitName: habit.name,
          reminderTime,
          dateKey,
          title: habit.name,
          body,
          icon: "/pwa-192x192.png?v=2",
          tag: `cadence-reminder-${habit.id}-${dateKey}-${reminderTime}`,
        });
      }
    }

    worker.postMessage({
      type: "SYNC_REMINDERS",
      reminders: pendingReminders,
    });
  } catch (err) {
    console.warn("[NotificationScheduler] Failed to sync reminders to Service Worker", err);
  }
}

/**
 * Triggers an immediate reminder check via the Service Worker.
 */
export async function triggerServiceWorkerNotificationCheck(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active || navigator.serviceWorker.controller;
    if (worker) {
      worker.postMessage({
        type: "CHECK_NOTIFICATIONS",
        timestamp: Date.now(),
      });
    }
  } catch (err) {
    console.warn("[NotificationScheduler] Failed to trigger SW notification check", err);
  }
}

interface PeriodicSyncManager {
  getTags(): Promise<string[]>;
  register(tag: string, options?: { minInterval?: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}

interface ServiceWorkerRegistrationWithPeriodicSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManager;
}

/**
 * Registers Periodic Background Sync if supported by the browser (Chromium Android).
 */
export async function registerPeriodicSync(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistrationWithPeriodicSync;
    if (reg.periodicSync) {
      const tags = await reg.periodicSync.getTags();
      if (!tags.includes("check-notifications")) {
        await reg.periodicSync.register("check-notifications", {
          minInterval: 15 * 60 * 1000, // 15 minutes minimum supported by Chromium
        });
        console.log("[NotificationScheduler] Periodic Background Sync registered");
      }
      return true;
    }
  } catch (err) {
    console.debug("[NotificationScheduler] PeriodicSync registration skipped/unsupported", err);
  }
  return false;
}

export async function sendTestNotification(): Promise<boolean> {
  const permission = getNotificationPermission();
  console.log("[NotificationScheduler] Test notification requested", { permission });
  if (!canSendNotification()) {
    console.warn("[NotificationScheduler] Test notification skipped: permission is not granted");
    return false;
  }

  try {
    await dispatchNotification(getNotificationText("notification.testTitle"), {
      body: getNotificationText("notification.testBody"),
      icon: "/pwa-192x192.png?v=2",
      tag: "cadence-test-notification",
    });
    return true;
  } catch (error) {
    console.warn("[NotificationScheduler] Test notification failed", error);
    return false;
  }
}
