import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Code, Plus, Upload, X } from "lucide-react";

import { HabitIcon, ICON_NAMES, sanitizeSvgIcon } from "@/components/icon-map";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app-store";

export interface IconPickerProps {
  /** Active icon — a Lucide icon name or a saved custom icon id. */
  selectedIcon: string;
  onChange: (icon: string) => void;
  /**
   * Inline style applied to the SELECTED tile so it inherits the form's active
   * colour tint (mirrors the habit card). When omitted, the primary highlight
   * is used instead.
   */
  activeTileStyle?: React.CSSProperties;
}

/**
 * How many columns the responsive auto-fill grid renders at typical breakpoints.
 * Each tile is 44px wide with an 8px gap (gap-2).
 *
 * The collapsed state clamps the grid to exactly TWO rows via `max-height`.
 * Row height = tile-height (44px) + gap (8px) = 52px.
 * Two rows = 52 * 2 - 8 (no trailing gap on last row) = 96px.
 */
const COLLAPSED_MAX_H = "96px"; // 2 × (44 + 8) − 8px trailing gap

/**
 * Shared icon picker: predefined Lucide glyphs, user-uploaded custom SVGs
 * (with hover delete), and the consolidated upload / paste modal with
 * drag-and-drop.
 *
 * **Progressive Disclosure** — the grid starts collapsed (2 rows visible) and
 * expands into a scrollable panel on demand. The toggle state lives entirely
 * inside this component so parent modals never re-render on expand/collapse.
 *
 * Custom SVGs are sanitised via {@link sanitizeSvgIcon} and stored in the
 * global app store, so icons added on ANY form are available everywhere.
 */
export function IconPicker({
  selectedIcon: icon,
  onChange: setIcon,
  activeTileStyle,
}: IconPickerProps) {
  const { customIcons, addCustomIcon, removeCustomIcon } = useApp();

  // ─── Progressive Disclosure ────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);

  // When the selected icon sits outside the visible two rows we auto-expand
  // so the user always sees which icon is active without confusion.
  const selectedIsCustom = useMemo(
    () => customIcons.some((c) => c.id === icon),
    [customIcons, icon],
  );

  // ─── SVG upload & paste (consolidated premium modal) ──────────────────────
  const [isIconModalOpen, setIsIconModalOpen] = useState(false);
  const [svgCodeInput, setSvgCodeInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const iconUploadRef = useRef<HTMLInputElement>(null);

  // Track which custom icon is in reveal-to-delete mode on touch devices.
  const [showDeleteForId, setShowDeleteForId] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide the revealed delete button when the user taps elsewhere.
  useEffect(() => {
    if (showDeleteForId === null) return;

    function handleGlobalClick() {
      setShowDeleteForId(null);
    }

    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [showDeleteForId]);

  // Clean up a pending long-press timer when the picker unmounts.
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    };
  }, []);

  function handleTouchStart(customIconId: string, e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) return;

    longPressTimeoutRef.current = setTimeout(() => {
      setShowDeleteForId(customIconId);
    }, 500);
  }

  function handleTouchEnd() {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
  }

  /** Tile classes for the selected state — inline tint when provided. */
  const selectedTileClass = activeTileStyle
    ? "border-transparent"
    : "border-primary bg-primary/10 text-primary";

  function handleIconModalChange(open: boolean) {
    setIsIconModalOpen(open);
    if (!open) {
      setSvgCodeInput("");
      setIsDragging(false);
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const fakeEvent = {
        target: { files: e.dataTransfer.files },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleSvgUpload(fakeEvent);
    }
  };

  /**
   * Single entry point for BOTH the file-upload and the paste-code flows, so
   * the two can never diverge again (the file path previously produced a
   * clipped, opaque icon because uploaded documents keep DOCTYPE/comments and
   * usually have no `viewBox`).
   *
   * Sizing and colour are both normalised by `sanitizeSvgIcon` (viewBox fix +
   * `currentColor` inheritance), and the new icon is saved + selected.
   */
  function processAndSaveCustomSvg(rawSvg: string) {
    const sanitizedSvg = sanitizeSvgIcon(rawSvg);
    const newIconId = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    // Save to global customIcons state
    addCustomIcon({ id: newIconId, svgContent: sanitizedSvg });

    // Select the new id in the owning form
    setIcon(newIconId);

    // Auto-expand so the newly-added custom icon is immediately visible.
    setIsExpanded(true);

    return newIconId;
  }

  // Handle SVG file upload — delegates to the shared pipeline.
  function handleSvgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".svg")) {
      toast.error("Please upload an SVG file");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const svgContent = event.target?.result as string;
      if (!svgContent) return;

      processAndSaveCustomSvg(svgContent);

      handleIconModalChange(false);
      toast.success("Custom icon added");
    };
    reader.onerror = () => toast.error("Could not read the SVG file");
    reader.readAsText(file);

    // Reset the input so the same file can be selected again
    e.target.value = "";
  }

  // Handle pasting SVG code — identical pipeline to file upload.
  function handleUseSvgCode() {
    const svgContent = svgCodeInput.trim();
    if (!svgContent) {
      toast.error("Please paste some SVG code");
      return;
    }

    // Basic validation - check if it looks like SVG
    if (!svgContent.includes("<svg") && !svgContent.includes("<?xml")) {
      toast.error("Invalid SVG code - must contain <svg> element");
      return;
    }

    processAndSaveCustomSvg(svgContent);

    // Close the modal and reset its inputs.
    handleIconModalChange(false);

    toast.success("Custom icon added");
  }

  // Stable toggle callback — does NOT cause parent re-renders.
  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* ── Icon grid ─────────────────────────────────────────────────────── */}
      {/*
       * Outer wrapper clips the grid to 2 rows when collapsed.
       * `overflow-hidden` on the collapsed wrapper prevents layout shift —
       * the grid DOM is always fully rendered so there is zero cost to toggling
       * (no mount/unmount of icon buttons, no heavy re-render for the parent).
       *
       * When expanded the wrapper becomes a scrollable container with a
       * max-height that comfortably fits most viewport heights inside a modal.
       */}
      <div
        className={cn(
          "transition-[max-height] duration-300 ease-in-out",
          isExpanded
            ? // Expanded: scrollable panel, themed scrollbar
              "max-h-56 overflow-y-auto rounded-xl scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-500"
            : // Collapsed: clip to exactly 2 rows, hide overflow
              "overflow-hidden",
        )}
        style={isExpanded ? undefined : { maxHeight: COLLAPSED_MAX_H }}
        aria-label="Icon grid"
      >
        {/*
         * Responsive auto-fill grid: tiles are 44px wide, gap is 8px (gap-2).
         * `auto-fill` + `minmax(44px, 1fr)` packs as many columns as fit —
         * zero horizontal scroll on narrow or wide viewports.
         */}
        <div
          className="grid gap-2 pb-1"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}
        >
          {/* ── Upload custom SVG button ─────────────────────────────────── */}
          <Dialog open={isIconModalOpen} onOpenChange={handleIconModalChange}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500 dark:border-slate-600 dark:hover:bg-emerald-900/20"
                aria-label="Add custom SVG icon"
                title="Upload or paste SVG"
              >
                <Plus className="h-5 w-5" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <DialogHeader>
                <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <Code className="h-6 w-6" aria-hidden="true" />
                </div>
                <DialogTitle>Add a custom icon</DialogTitle>
                <DialogDescription>
                  Upload an SVG file or paste its code to personalize.
                </DialogDescription>
              </DialogHeader>

              <button
                type="button"
                onClick={() => iconUploadRef.current?.click()}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  "flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  isDragging
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : "border-slate-300 bg-slate-50 text-slate-500 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400",
                )}
              >
                <Upload className="pointer-events-none h-7 w-7" aria-hidden="true" />
                <span className="pointer-events-none text-sm font-medium">
                  {isDragging ? "Drop your SVG here" : "Drop an SVG or click to browse"}
                </span>
                <span className="pointer-events-none text-xs">SVG files only</span>
              </button>
              <input
                ref={iconUploadRef}
                type="file"
                accept=".svg,image/svg+xml"
                className="hidden"
                aria-label="Upload SVG file"
                onChange={handleSvgUpload}
              />

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>or paste code</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-icon-svg-code">SVG code</Label>
                <Textarea
                  id="custom-icon-svg-code"
                  value={svgCodeInput}
                  onChange={(e) => setSvgCodeInput(e.target.value)}
                  placeholder="Paste raw &lt;svg&gt;...&lt;/svg&gt; code here..."
                  rows={5}
                  spellCheck={false}
                  className="resize-y rounded-xl bg-slate-50 font-mono text-xs dark:bg-slate-900/50"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => handleIconModalChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleUseSvgCode}
                  disabled={!svgCodeInput.trim()}
                  className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Add Icon
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Custom SVG Icons with hover delete & touch long-press ──────── */}
          {customIcons.map((customIcon) => (
            <div
              key={customIcon.id}
              className="relative group shrink-0"
              style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
              onContextMenu={handleContextMenu}
              onTouchStart={(e) => handleTouchStart(customIcon.id, e)}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <button
                type="button"
                aria-label={`Custom icon ${customIcon.id}`}
                aria-pressed={icon === customIcon.id}
                onClick={() => setIcon(customIcon.id)}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl border transition-colors overflow-hidden",
                  icon === customIcon.id
                    ? selectedTileClass
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
                style={icon === customIcon.id ? activeTileStyle : undefined}
              >
                <HabitIcon name={customIcon.id} customIcons={customIcons} className="h-5 w-5" />
              </button>
              {/* Delete button is revealed by hover on desktop or long press on touch. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteForId(null);
                  removeCustomIcon(customIcon.id);
                  if (icon === customIcon.id) setIcon(ICON_NAMES[0] ?? "Target");
                  toast.success("Custom icon deleted");
                }}
                className={cn(
                  "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:scale-110",
                  showDeleteForId === customIcon.id && "opacity-100",
                )}
                aria-label={`Delete custom icon ${customIcon.id}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}

          {/* ── Predefined Lucide Icons ──────────────────────────────────── */}
          {ICON_NAMES.map((n) => (
            <button
              key={n}
              type="button"
              aria-label={n}
              aria-pressed={icon === n}
              onClick={() => setIcon(n)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl border transition-colors",
                icon === n ? selectedTileClass : "border-border text-muted-foreground hover:bg-muted",
              )}
              style={icon === n ? activeTileStyle : undefined}
            >
              <HabitIcon name={n} customIcons={customIcons} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {/* ── See more / Show less toggle ──────────────────────────────────── */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Show fewer icons" : "Show all icons"}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium",
          "text-gray-600 dark:text-gray-300",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "transition-colors duration-150",
          // Subtle selected-icon indicator: when the active icon is a custom one,
          // the button tint draws attention to the expanded section.
          selectedIsCustom && !isExpanded && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isExpanded ? "rotate-180" : "rotate-0",
          )}
          aria-hidden="true"
        />
        <span>{isExpanded ? "Show less" : "See more icons"}</span>
      </button>
    </div>
  );
}
