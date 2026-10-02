export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Creates an Image element from a source URL and waits for it to load.
 */
export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

/**
 * Crops an image based on cropped area pixel coordinates using the HTML Canvas API.
 * Returns the cropped image as a base64 data URL.
 *
 * @param imageSrc Data URL or image source URL
 * @param pixelCrop The crop coordinates in natural image pixels
 * @param maxOutputSize Maximum width/height of the output (defaults to 384px for crisp, lightweight avatars)
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: CropArea,
  maxOutputSize = 384,
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create canvas 2D context");
  }

  // Round pixel coordinates to avoid sub-pixel anti-aliasing artifacts
  const cropX = Math.round(pixelCrop.x);
  const cropY = Math.round(pixelCrop.y);
  const cropWidth = Math.round(pixelCrop.width);
  const cropHeight = Math.round(pixelCrop.height);

  // Target output dimension (square for avatar)
  const targetSize = Math.min(
    maxOutputSize,
    Math.max(64, Math.round(Math.max(cropWidth, cropHeight))),
  );

  canvas.width = targetSize;
  canvas.height = targetSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Check if source is PNG with potential transparency
  const isPng = imageSrc.startsWith("data:image/png");
  if (!isPng) {
    // Fill with white background to prevent transparent regions rendering black in JPEG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetSize, targetSize);
  }

  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, targetSize, targetSize);

  return isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Crops an image based on cropped area pixel coordinates and returns a Blob.
 */
export async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: CropArea,
  maxOutputSize = 384,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create canvas 2D context");
  }

  const cropX = Math.round(pixelCrop.x);
  const cropY = Math.round(pixelCrop.y);
  const cropWidth = Math.round(pixelCrop.width);
  const cropHeight = Math.round(pixelCrop.height);

  const targetSize = Math.min(
    maxOutputSize,
    Math.max(64, Math.round(Math.max(cropWidth, cropHeight))),
  );

  canvas.width = targetSize;
  canvas.height = targetSize;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const isPng = imageSrc.startsWith("data:image/png");
  if (!isPng) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetSize, targetSize);
  }

  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, targetSize, targetSize);

  const mimeType = isPng ? "image/png" : "image/jpeg";
  const quality = isPng ? undefined : 0.9;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas to Blob conversion failed"));
      },
      mimeType,
      quality,
    );
  });
}
