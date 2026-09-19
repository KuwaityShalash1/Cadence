import {
  Bell,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  Monitor,
  Moon,
  Sun,
  Trash2,
  Upload,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { useApp } from "@/stores/app-store";
import { useTranslation } from "@/i18n/context";
import type { ThemeMode } from "@/types";

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const AVATAR_EMOJIS = ["😀", "😎", "🦊", "🐱", "🌟", "🚀", "📚", "💪", "🎯", "🔥", "🌱", "⚡"];

// Max image size before compression (256px square)
const MAX_AVATAR_DIM = 256;

function fileToCompressedDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const { settings, ready, updateSettings, toggleSoundSettings, exportData, importData, resetAll } =
    useApp();
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(settings.displayName ?? "");
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("unsupported");
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  if (!ready) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  function handleExport() {
    const json = exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadence-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(text);
      toast.success("Data imported");
    } catch {
      toast.error("Could not import — invalid file");
    }
    if (importRef.current) importRef.current.value = "";
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataURL(file);
      updateSettings({ avatar: dataUrl });
      toast.success("Profile picture updated");
    } catch {
      toast.error("Could not process the image");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleReset() {
    await resetAll();
    setDisplayName("");
    toast.success("All data cleared");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, theme, and data.</p>
      </header>

      {/* Profile */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User className="h-4 w-4 text-muted-foreground" />
          Profile
        </div>

        {/* Avatar + upload */}
        <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-border">
              {settings.avatar ? (
                settings.avatar.startsWith("data:") ? (
                  <img src={settings.avatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl">{settings.avatar}</span>
                )
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            {/* Upload button overlay */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
              aria-label="Upload profile picture"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs text-muted-foreground">
              Click the camera icon to upload a photo, or pick an emoji below.
            </p>
            {settings.avatar && settings.avatar.startsWith("data:") ? (
              <button
                type="button"
                onClick={() => updateSettings({ avatar: undefined })}
                className="mt-2 text-xs text-destructive hover:underline"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>

        {/* Emoji picker */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Or choose an emoji</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Use ${emoji}`}
                onClick={() => updateSettings({ avatar: emoji })}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-lg border text-lg transition-colors",
                  settings.avatar === emoji
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Display name */}
        <div className="mt-5 space-y-2">
          <Label htmlFor="display-name" className="mb-2 block font-medium">
            Display name
          </Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-11"
            />
            <Button
              className="h-11 shrink-0"
              onClick={() => {
                updateSettings({ displayName: displayName.trim() || undefined });
                toast.success("Name saved");
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </section>

      {/* Theme */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sun className="h-4 w-4 text-muted-foreground" />
          Theme
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={settings.theme === opt.value}
              onClick={() => updateSettings({ theme: opt.value })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors",
                settings.theme === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <opt.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>
      {/* Sound */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {(settings.soundEnabled ?? settings.isSoundEnabled ?? !(settings.isMuted ?? false)) ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            Sound Effects
          </div>
          <Switch
            checked={Boolean(
              settings.soundEnabled ?? settings.isSoundEnabled ?? !(settings.isMuted ?? false),
            )}
            onCheckedChange={(checked) => {
              updateSettings({
                soundEnabled: checked,
                isSoundEnabled: checked,
                isMuted: !checked,
              });
            }}
            aria-label="Toggle sound effects"
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Enable or disable audio feedback and chimes across the app.
        </p>
      </section>

      {/* Notifications and reminders */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Notifications &amp; Reminders
          </div>
          <Switch
            checked={settings.notificationsEnabled}
            onCheckedChange={async (checked) => {
              if (!checked) {
                updateSettings({ notificationsEnabled: false, remindersEnabled: false });
                return;
              }

              const permission = await requestNotificationPermission();
              setNotificationPermission(permission);
              if (permission === "granted") {
                updateSettings({ notificationsEnabled: true, remindersEnabled: true });
                toast.success("Notifications enabled");
              } else if (permission === "denied") {
                updateSettings({ notificationsEnabled: false, remindersEnabled: false });
                toast.error("Notifications are blocked in your browser settings");
              } else {
                updateSettings({ notificationsEnabled: false, remindersEnabled: false });
                toast.error("Notifications are not supported in this browser");
              }
            }}
            aria-label="Toggle notifications and reminders"
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Control all scheduled habit reminders from one place.
        </p>
        <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
          <div className="flex items-start gap-3">
            {notificationPermission === "granted" ? (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Browser permission:{" "}
                {notificationPermission === "unsupported"
                  ? "Not supported"
                  : notificationPermission}
              </p>
              {notificationPermission === "default" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    const permission = await requestNotificationPermission();
                    setNotificationPermission(permission);
                    if (permission === "granted") toast.success("Browser permission granted");
                  }}
                >
                  <Bell className="mr-2 h-4 w-4" /> Request Browser Permission
                </Button>
              ) : notificationPermission === "denied" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Notifications are blocked. Allow them for Cadence in your browser or device
                  settings, then reload the app.
                </p>
              ) : notificationPermission === "granted" ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  Notifications are ready to use.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  This browser does not provide web notifications.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full sm:w-auto"
            disabled={notificationPermission !== "granted"}
            onClick={async () => {
              const sent = await sendTestNotification();
              if (sent) toast.success("Test notification sent");
              else toast.error("Test notification could not be sent");
            }}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Send Test Notification
          </Button>
        </div>
      </section>

      {/* Data */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Download className="h-4 w-4 text-muted-foreground" />
          Data
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Export your data as a JSON file, import a previous backup, or clear everything to start
          fresh.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="h-11 flex-1" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export data
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => importRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" /> Import data
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="h-11 flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Clear all data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all habits, logs, goals, routines, and settings. This
                  cannot be undone. Consider exporting a backup first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, clear everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </section>
    </div>
  );
}
