import {
  Bell,
  Bug,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Monitor,
  Moon,
  Share2,
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
import { ImageCropperModal } from "./image-cropper-modal";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/notifications";
import { buildBackupFileName, downloadJsonBackup, markBackupComplete } from "@/lib/backup";
import { BackupReminder } from "@/components/backup-reminder";
import { useWeeklyBackupReminder } from "@/hooks/use-weekly-backup";
import { usePWA } from "@/hooks/use-pwa";
import { useApp } from "@/stores/app-store";
import { useTranslation, LANGUAGES } from "@/i18n/context";
import { LanguageFlag } from "@/components/language-flag";
import type { ThemeMode } from "@/types";

const THEME_OPTIONS: {
  value: ThemeMode;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "light", labelKey: "settings.themeLight", icon: Sun },
  { value: "dark", labelKey: "settings.themeDark", icon: Moon },
  { value: "system", labelKey: "settings.themeSystem", icon: Monitor },
];

const AVATAR_EMOJIS = ["😀", "😎", "🦊", "🐱", "🌟", "🚀", "📚", "💪", "🎯", "🔥", "🌱", "⚡"];

export function SettingsPage() {
  const { settings, ready, updateSettings, toggleSoundSettings, exportData, importData, resetAll } =
    useApp();
  const {
    isDue: isBackupDue,
    snoozeReminder,
    dismissReminder,
  } = useWeeklyBackupReminder(exportData);
  const { shareApp, isInstallAvailable, triggerInstall } = usePWA();
  const { t, language, setLanguage, isRtl } = useTranslation();
  const [displayName, setDisplayName] = useState(settings.displayName ?? "");
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  if (!ready) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        {t("common.loading", "Loading…")}
      </div>
    );
  }

  function handleExport() {
    // Reuse the shared backup helper so manual exports and the weekly Toast
    // reminder produce the same file and both refresh the reminder timestamp.
    const json = exportData();
    downloadJsonBackup(json, buildBackupFileName());
    markBackupComplete();
    toast.success(t("settings.dataExported"));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importData(text);
      toast.success(t("settings.dataImported"));
    } catch {
      toast.error(t("settings.importError"));
    }
    if (importRef.current) importRef.current.value = "";
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.selectImageError"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("settings.imageSizeError"));
      return;
    }

    // Intercept image selection: read as data URL and open cropper modal without saving yet
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setIsCropperOpen(true);
    };
    reader.onerror = () => {
      toast.error(t("settings.imageReadError"));
    };
    reader.readAsDataURL(file);

    // Reset input so re-selecting the same file works
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSaveCroppedAvatar(croppedDataUrl: string) {
    updateSettings({ avatar: croppedDataUrl });
    toast.success(t("settings.avatarUpdated"));
  }

  async function handleReset() {
    await resetAll();
    setDisplayName("");
    toast.success(t("settings.allDataCleared"));
  }

  async function handleShareApp() {
    const outcome = await shareApp();
    if (outcome === "copied") toast.success(t("settings.shareCopied"));
    else if (outcome === "failed") toast.error(t("settings.shareFailed"));
  }

  async function handleInstallApp() {
    const outcome = await triggerInstall();
    if (outcome === "accepted") toast.success(t("settings.installingApp"));
    else if (outcome === "unavailable") toast.error(t("settings.installUnavailable"));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      {/* Inline Backup Reminder — rendered exclusively here and never overlaps or blocks interactions */}
      {isBackupDue && (
        <BackupReminder
          visible={isBackupDue}
          onExport={handleExport}
          onSnooze={snoozeReminder}
          onDismiss={dismissReminder}
        />
      )}

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User className="h-4 w-4 text-muted-foreground" />
          {t("settings.profile")}
        </div>

        {/* Avatar + upload */}
        <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-primary/10 ring-2 ring-border">
              {settings.avatar ? (
                settings.avatar.startsWith("data:") ? (
                  <img
                    src={settings.avatar}
                    alt={t("settings.profile")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">{settings.avatar}</span>
                )
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            {/* Upload button overlay — positioned at bottom-end for RTL awareness */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -end-1 grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105"
              aria-label={t("settings.uploadPhotoAria")}
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

          <div className="flex-1 text-center sm:text-start">
            <p className="text-xs text-muted-foreground">{t("settings.photoHint")}</p>
            {settings.avatar && settings.avatar.startsWith("data:") ? (
              <button
                type="button"
                onClick={() => updateSettings({ avatar: undefined })}
                className="mt-2 text-xs text-destructive hover:underline"
              >
                {t("settings.removePhoto")}
              </button>
            ) : null}
          </div>
        </div>

        {/* Emoji picker */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("settings.chooseEmoji")}
          </p>
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
            {t("settings.displayName")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("settings.displayNamePlaceholder")}
              className="h-11"
              maxLength={60}
            />
            <Button
              className="h-11 shrink-0"
              onClick={() => {
                updateSettings({ displayName: displayName.trim() || undefined });
                toast.success(t("settings.nameSaved"));
              }}
            >
              {t("settings.save")}
            </Button>
          </div>
        </div>
      </section>

      {/* ── Language ─────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {t("settings.language")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
        <div className="mt-4 w-full">
          <Select
            value={language}
            onValueChange={(val) => setLanguage(val as typeof language)}
            dir={isRtl ? "rtl" : "ltr"}
          >
            <SelectTrigger className="h-11 w-full text-start">
              <div className="flex items-center gap-2.5">
                <LanguageFlag code={language} />
                <span>{LANGUAGES.find((l) => l.code === language)?.nativeName}</span>
                {LANGUAGES.find((l) => l.code === language)?.dir === "rtl" && (
                  <span className="text-xs text-muted-foreground">(RTL)</span>
                )}
              </div>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code} className="text-start">
                  <div className="flex items-center gap-2.5">
                    <LanguageFlag code={lang.code} />
                    <span>{lang.nativeName}</span>
                    {lang.dir === "rtl" && (
                      <span className="text-xs text-muted-foreground">(RTL)</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── Theme ────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sun className="h-4 w-4 text-muted-foreground" />
          {t("settings.theme")}
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
              <span className="text-sm font-medium">{t(opt.labelKey)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Sound ────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {settings.isSoundEnabled && !settings.isMuted ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            {t("settings.sound")}
          </div>
          <Switch
            checked={Boolean(settings.isSoundEnabled && !settings.isMuted)}
            onCheckedChange={(checked) => {
              updateSettings({
                isSoundEnabled: checked,
                isMuted: !checked,
              });
            }}
            aria-label={t("settings.toggleSoundAria")}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.soundDesc")}</p>
      </section>

      {/* ── Notifications and reminders ───────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4 text-muted-foreground" />
            {t("settings.notifications")}
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
                toast.success(t("settings.notificationsEnabledToast"));
              } else if (permission === "denied") {
                updateSettings({ notificationsEnabled: false, remindersEnabled: false });
                toast.error(t("settings.permissionDeniedToast"));
              } else {
                updateSettings({ notificationsEnabled: false, remindersEnabled: false });
                toast.error(t("settings.permissionUnsupportedToast"));
              }
            }}
            aria-label={t("settings.toggleNotificationsAria")}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.notificationsDesc")}</p>
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
                {t("settings.browserPermission")}{" "}
                {notificationPermission === "unsupported"
                  ? t("settings.permissionNotSupported")
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
                    if (permission === "granted")
                      toast.success(t("settings.permissionGrantedToast"));
                  }}
                >
                  <Bell className="me-2 h-4 w-4" /> {t("settings.requestPermission")}
                </Button>
              ) : notificationPermission === "denied" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.permissionBlocked")}
                </p>
              ) : notificationPermission === "granted" ? (
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  {t("settings.permissionGranted")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.permissionUnsupported")}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            disabled={notificationPermission !== "granted"}
            onClick={async () => {
              const sent = await sendTestNotification();
              if (sent) toast.success(t("settings.testNotificationSent"));
              else toast.error(t("settings.testNotificationFailed"));
            }}
          >
            <ExternalLink className="me-2 h-4 w-4" /> {t("settings.sendTestNotification")}
          </Button>
        </div>
      </section>

      {/* ── App ──────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          {t("settings.app")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.appDesc")}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="h-11 flex-1" onClick={handleShareApp}>
            <Share2 className="me-2 h-4 w-4" /> {t("settings.shareCadence")}
          </Button>
          {isInstallAvailable ? (
            <Button variant="outline" className="h-11 flex-1" onClick={handleInstallApp}>
              <Download className="me-2 h-4 w-4" /> {t("settings.installApp")}
            </Button>
          ) : null}
        </div>
      </section>

      {/* ── Data ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Download className="h-4 w-4 text-muted-foreground" />
          {t("settings.data")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.dataDescription")}</p>

        <Alert className="mt-4 border-amber-200/50 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800/40">
          <AlertTitle className="text-amber-800 dark:text-amber-300">
            {t("settings.dataAlert")}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {t("settings.dataAlertDesc")}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="h-11 flex-1" onClick={handleExport}>
            <Download className="me-2 h-4 w-4" /> {t("settings.export")}
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => importRef.current?.click()}
          >
            <Upload className="me-2 h-4 w-4" /> {t("settings.import")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="h-11 flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="me-2 h-4 w-4" /> {t("settings.clear")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.clearConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("settings.clearConfirmDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("settings.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReset}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("settings.clearConfirmYes")}
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

      {/* ── Help & Support ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bug className="h-4 w-4 text-muted-foreground" />
          {t("settings.help")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("settings.helpDesc")}</p>
        <div className="mt-4">
          <a
            href="https://tally.so/r/VLgMGy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bug className="h-4 w-4 shrink-0" />
            {t("settings.reportBug")}
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </section>

      {/* Cropper Modal */}
      <ImageCropperModal
        open={isCropperOpen}
        imageSrc={selectedImage}
        onClose={() => {
          setIsCropperOpen(false);
          setSelectedImage(null);
        }}
        onCropSave={handleSaveCroppedAvatar}
      />
    </div>
  );
}
