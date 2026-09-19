import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { HabitForm } from "@/features/habits/habit-form";
import { ResponsiveSheet } from "@/components/responsive-sheet";
import type { Habit } from "@/types";

interface EditorApi {
  open: (habit?: Habit) => void;
}

const EditorContext = createContext<EditorApi | null>(null);

export function HabitEditorProvider({ children }: { children: ReactNode }) {
  const [habit, setHabit] = useState<Habit | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((next?: Habit) => {
    setHabit(next);
    setIsOpen(true);
  }, []);

  const api = useMemo(() => ({ open }), [open]);

  return (
    <EditorContext.Provider value={api}>
      {children}
      <ResponsiveSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title={habit ? "Edit habit" : "New habit"}
        description={
          habit
            ? "Changes apply from today onward. Past records stay untouched."
            : "Set the target and schedule — you can change it later."
        }
      >
        <HabitForm
          key={habit?.id ?? "new"}
          habit={habit}
          onDone={() => {
            setIsOpen(false);
          }}
        />
      </ResponsiveSheet>
    </EditorContext.Provider>
  );
}

export function useHabitEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useHabitEditor must be used inside HabitEditorProvider");
  return ctx;
}
