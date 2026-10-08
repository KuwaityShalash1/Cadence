import { useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/auth-context";
import { useApp } from "@/stores/app-store";
import { deleteUserAccount } from "@/lib/account";
import { useTranslation } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface DeleteAccountDialogProps {
  /** Optional custom trigger button. Defaults to standard destructive button. */
  trigger?: ReactNode | undefined;
  /** Optional callback after deletion finishes. */
  onDeleted?: (() => void) | undefined;
}

const CONFIRMATION_PHRASE = "DELETE";

/**
 * Strict confirmation modal for permanent user account deletion.
 * Requires explicit typing of "DELETE" to prevent accidental data loss.
 */
export function DeleteAccountDialog({ trigger, onDeleted }: DeleteAccountDialogProps) {
  const { user, session } = useAuth();
  const { resetAll } = useApp();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Only authenticated users can delete their account
  if (!session || !user) {
    return null;
  }

  const isConfirmed = confirmInput.trim().toUpperCase() === CONFIRMATION_PHRASE;

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    try {
      const result = await deleteUserAccount(user);

      if (!result.success) {
        toast.error(result.error || t("deleteAccount.failed", "Failed to delete account. Please try again."));
        setIsDeleting(false);
        return;
      }

      // Clear local device data so no orphaned database records remain
      await resetAll();

      toast.success(t("deleteAccount.success", "Account and cloud data permanently deleted."));
      setIsOpen(false);

      if (onDeleted) {
        onDeleted();
      } else {
        // Redirect to homepage in clean guest state
        window.location.replace("/");
      }
    } catch (err) {
      console.error("Error executing account deletion:", err);
      toast.error(t("deleteAccount.unexpectedError", "An unexpected error occurred during account deletion."));
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting) return; // Prevent closing while in flight
    setIsOpen(nextOpen);
    if (!nextOpen) {
      setConfirmInput("");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            <span>{t("deleteAccount.trigger", "Delete Account")}</span>
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-xl">
            {t("deleteAccount.title", "Delete Account Permanently?")}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground text-start">
            <span>
              {t("deleteAccount.description", "This action is irreversible. All your synchronized cloud records, habit logs, completion streaks, and account settings will be permanently removed from the Supabase database.")}
            </span>
            <span className="block font-medium text-foreground pt-1">
              {t("deleteAccount.confirmPrompt", "To proceed, please type {phrase} below:", { phrase: CONFIRMATION_PHRASE })}{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-destructive font-bold">{CONFIRMATION_PHRASE}</code>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-account-confirm" className="sr-only">
            {t("deleteAccount.inputLabel", "Type DELETE to confirm")}
          </Label>
          <Input
            id="delete-account-confirm"
            placeholder={t("deleteAccount.inputPlaceholder", `Type "${CONFIRMATION_PHRASE}" to confirm`, { phrase: CONFIRMATION_PHRASE })}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={isDeleting}
            autoComplete="off"
            className="font-mono text-sm tracking-wider"
          />
        </div>

        <AlertDialogFooter className="gap-2 pt-2">
          <AlertDialogCancel disabled={isDeleting}>
            {t("deleteAccount.cancel", "Cancel")}
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={!isConfirmed || isDeleting}
            className="gap-2 font-medium"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("deleteAccount.deleting", "Deleting Account...")}</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>{t("deleteAccount.confirmButton", "Delete My Account")}</span>
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

