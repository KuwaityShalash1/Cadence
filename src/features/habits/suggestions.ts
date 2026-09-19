import type { HabitType, Schedule } from "@/types";

export interface HabitSuggestion {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: HabitType;
  target: number;
  unit: string;
  schedule: Schedule;
  quickIncrements?: number[];
  quickDecrement?: number;
}

/** Ready-made habits tuned for a student preparing for the Egyptian Baccalaureate. */
export const HABIT_SUGGESTIONS: HabitSuggestion[] = [
  {
    id: "study",
    name: "Study session",
    description: "Focused study block for one subject",
    icon: "Brain",
    color: "teal",
    type: "duration",
    target: 60,
    unit: "min",
    schedule: { type: "daily" },
    quickIncrements: [15, 30],
    quickDecrement: 15,
  },
  {
    id: "review",
    name: "Review",
    description: "Revise what you studied earlier",
    icon: "NotebookPen",
    color: "violet",
    type: "duration",
    target: 30,
    unit: "min",
    schedule: { type: "daily" },
    quickIncrements: [5, 10],
    quickDecrement: 5,
  },
  {
    id: "practice",
    name: "Solve practice questions",
    description: "Work through exam-style questions",
    icon: "PenTool",
    color: "amber",
    type: "counter",
    target: 20,
    unit: "questions",
    schedule: { type: "daily" },
    quickIncrements: [1, 5],
    quickDecrement: 1,
  },
  {
    id: "read",
    name: "Read Book",
    description: "Read a book or article",
    icon: "BookOpen",
    color: "violet",
    type: "duration",
    target: 30,
    unit: "min",
    schedule: { type: "daily" },
    quickIncrements: [5, 10],
    quickDecrement: 1,
  },
  {
    id: "pushups",
    name: "Pushups",
    description: "Strength training",
    icon: "Dumbbell",
    color: "rose",
    type: "counter",
    target: 50,
    unit: "reps",
    schedule: { type: "daily" },
    quickIncrements: [5, 10],
    quickDecrement: 5,
  },
  {
    id: "sleep",
    name: "Sleep",
    description: "Get a full night of rest",
    icon: "Moon",
    color: "slate",
    type: "duration",
    target: 480,
    unit: "min",
    schedule: { type: "daily" },
    quickIncrements: [30, 60],
    quickDecrement: 30,
  },
  {
    id: "water",
    name: "Drink Water",
    description: "Stay hydrated through the day",
    icon: "Droplets",
    color: "teal",
    type: "numeric",
    target: 2000,
    unit: "ml",
    schedule: { type: "daily" },
    quickIncrements: [250, 500],
    quickDecrement: 250,
  },
  {
    id: "break",
    name: "Take a break",
    description: "Short breaks between study blocks",
    icon: "Coffee",
    color: "emerald",
    type: "counter",
    target: 4,
    unit: "breaks",
    schedule: { type: "daily" },
    quickIncrements: [1, 2],
    quickDecrement: 1,
  },
];
