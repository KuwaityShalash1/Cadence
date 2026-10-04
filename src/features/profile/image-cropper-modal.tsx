import { useState, useCallback, useEffect } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Check, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getCroppedImg, type CropArea } from "@/lib/crop-image";
import { useTranslation } from "@/i18n/context";

interface ImageCropperModalProps {
  open: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropSave: (croppedDataUrl: string) => Promise<void> | void;
}

export function ImageCropperModal({ open, imageSrc, onClose, onCropSave }: ImageCropperModalProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Reset controls whenever a new image is loaded or modal opens
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setIsSaving(false);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      toast.error(t("cropper.waitImageLoad", "Please wait for the image to load completely"));
      return;
    }

    try {
      setIsSaving(true);
      const croppedDataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onCropSave(croppedDataUrl);
      onClose();
    } catch (err) {
      console.error("Error cropping image:", err);
      toast.error(t("cropper.cropFailed", "Failed to crop image. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isSaving && !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md p-6 overflow-hidden gap-5">
        <DialogHeader className="text-start space-y-1">
          <DialogTitle className="font-display text-xl font-semibold tracking-tight">
            {t("cropper.title", "Adjust Profile Picture")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("cropper.desc", "Drag to position your photo and use the slider to zoom in or out.")}
          </DialogDescription>
        </DialogHeader>

        {/* Cropper Container */}
        <div className="relative h-72 sm:h-80 w-full overflow-hidden rounded-2xl bg-neutral-950 border border-border shadow-inner">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              minZoom={1}
              maxZoom={3}
              zoomSpeed={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              classes={{
                cropAreaClassName: "border-2 border-white/80 shadow-2xl",
              }}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              {t("cropper.noImage", "No image selected")}
            </div>
          )}
        </div>

        {/* Zoom and Reset Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{t("cropper.zoom", "Zoom")}</span>
            <div className="flex items-center gap-2">
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={handleReset}
                disabled={zoom === 1 && crop.x === 0 && crop.y === 0}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                title={t("cropper.resetTitle", "Reset crop and zoom")}
              >
                <RotateCcw className="h-3 w-3" />
                {t("cropper.reset", "Reset")}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.2).toFixed(2)))}
              disabled={zoom <= 1}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none p-1"
              aria-label={t("cropper.zoomOut", "Zoom out")}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.02}
              onValueChange={([val]) => {
                if (val !== undefined) setZoom(val);
              }}
              className="flex-1"
              aria-label={t("cropper.zoomLevel", "Zoom level")}
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.2).toFixed(2)))}
              disabled={zoom >= 3}
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none p-1"
              aria-label={t("cropper.zoomIn", "Zoom in")}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !croppedAreaPixels}
            className="w-full sm:w-auto font-medium"
          >
            {isSaving ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("cropper.saving", "Saving…")}
              </>
            ) : (
              <>
                <Check className="me-2 h-4 w-4" />
                {t("cropper.cropAndSave", "Crop & Save")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
