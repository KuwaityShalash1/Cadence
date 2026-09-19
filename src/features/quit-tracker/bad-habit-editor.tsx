import { ResponsiveSheet } from "@/components/responsive-sheet";
import { useApp } from "@/stores/app-store";
import type { BadHabit } from "@/types";
import { QuitTrackerForm } from "@/features/quit-tracker/quit-tracker-form";

interface BadHabitEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: BadHabit;
}

export function BadHabitEditor({ open, onOpenChange, habit }: BadHabitEditorProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={habit ? "Edit Quit Tracker" : "New Quit Tracker"}
      description="Track abstinence and build unbreakable willpower."
    >
      <QuitTrackerForm habit={habit} onDone={() => onOpenChange(false)} />
    </ResponsiveSheet>
  );
}
