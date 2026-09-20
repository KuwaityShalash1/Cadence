import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SortableCardProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function SortableCard({ id, children, className }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  /**
   * `touch-pan-y` (`touch-action: pan-y`) keeps native vertical page scrolling
   * completely unblocked on mobile: the browser owns the vertical gesture and
   * the touch sensor above only claims it once the 400ms hold completes.
   * Never switch this back to `touch-none`, which freezes the page while the
   * user drags a finger across a card.
   */
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
      {...attributes}
      {...listeners}
      className={cn("touch-pan-y select-none", isDragging && "opacity-30", className)}
    >
      {children}
    </div>
  );
}

export function SortableCardOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="z-50 scale-[1.02] cursor-grabbing rounded-2xl bg-white shadow-2xl ring-1 ring-primary/20 dark:bg-slate-900">
      {children}
    </div>
  );
}
