import { ResponsiveSheet } from "@/components/responsive-sheet";
import { useTranslation } from "@/i18n/context";
import type { BadHabit } from "@/types";
import { QuitTrackerForm } from "@/features/quit-tracker/quit-tracker-form";

interface BadHabitEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: BadHabit;
}

export function BadHabitEditor({ open, onOpenChange, habit }: BadHabitEditorProps) {
  const { t } = useTranslation();

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={habit ? t("quitTracker.edit") : t("quitTracker.new")}
      description={t("quitTracker.editorDesc")}
    >
      <QuitTrackerForm habit={habit} onDone={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}
