export interface TriggerOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  emoji: string;
}

export const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    id: "social",
    label: "Social Environment / Peer Pressure",
    description: "Was around people doing it or in a social gathering",
    icon: "Users",
    emoji: "👥",
  },
  {
    id: "stress",
    label: "Stress / Work & Study Pressure",
    description: "High anxiety, deadlines, or stressful workload",
    icon: "Zap",
    emoji: "⚡",
  },
  {
    id: "boredom",
    label: "Late-night Isolation / Boredom",
    description: "Alone, unstructured time, or late night fatigue",
    icon: "Moon",
    emoji: "🌙",
  },
  {
    id: "digital",
    label: "Digital Triggers / Social Media",
    description: "Saw ads, scrolling feeds, or digital cues",
    icon: "Smartphone",
    emoji: "📱",
  },
  {
    id: "custom",
    label: "Custom Specific Reason",
    description: "Detailed notes or specific triggers not listed above",
    icon: "NotebookPen",
    emoji: "✍️",
  },
];
