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

function dispatchNotification(title: string, options: NotificationOptions): void {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  try {
    new Notification(title, options);
    console.log("[NotificationScheduler] Dispatched via window.Notification", { title });
  } catch (error) {
    console.warn("[NotificationScheduler] Window notification failed", error);
    throw error;
  }
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
        if (minutesSinceReminder < 0 || minutesSinceReminder > 5) {
          console.log("[NotificationScheduler] Skipped reminder outside matching window", {
            habit: habit.name,
            reminderTime,
            currentTime,
          });
          continue;
        }
        const sentKey = `cadence-reminder-sent:${dateKey}:${habit.id}:${reminderTime}`;
        if (window.localStorage.getItem(sentKey) === "1") {
          console.log("[NotificationScheduler] Skipped duplicate reminder", {
            habit: habit.name,
            reminderTime,
          });
          continue;
        }

        console.log("[NotificationScheduler] Matched habit reminder", {
          habit: habit.name,
          reminderTime,
          currentTime,
        });
        const currentStreak = streaks(habit, logs).current;
        const unit = currentStreak === 1 ? getNotificationText("common.day") : getNotificationText("common.days");
        dispatchNotification(habit.name, {
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

export async function sendTestNotification(): Promise<boolean> {
  const permission = getNotificationPermission();
  console.log("[NotificationScheduler] Test notification requested", { permission });
  if (!canSendNotification()) {
    console.warn("[NotificationScheduler] Test notification skipped: permission is not granted");
    return false;
  }

  try {
    dispatchNotification(getNotificationText("notification.testTitle"), {
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
