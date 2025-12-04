/**
 * Image Utilities
 * Helper functions for image processing
 */

/**
 * Convert image file to base64
 */
export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Enhance image for better OCR recognition
 * Applies contrast, brightness, and sharpening
 */
function enhanceImageForOCR(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Apply contrast and brightness adjustments
  const contrast = 1.5; // Increase contrast
  const brightness = 10; // Slight brightness increase

  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast
    data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));
    data[i + 1] = Math.min(
      255,
      Math.max(0, (data[i + 1] - 128) * contrast + 128)
    );
    data[i + 2] = Math.min(
      255,
      Math.max(0, (data[i + 2] - 128) * contrast + 128)
    );

    // Apply brightness
    data[i] = Math.min(255, Math.max(0, data[i] + brightness));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness));

    // Convert to grayscale for better OCR (optional, but often helps)
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Compress and enhance image for OCR
 */
export function compressImage(
  base64Image: string,
  maxWidth: number = 1920,
  maxHeight: number = 1920,
  quality: number = 0.8,
  enhanceForOCR: boolean = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // For OCR, we want higher resolution - don't compress too much
      // But still limit to reasonable size
      const ocrMaxWidth = enhanceForOCR ? 2400 : maxWidth;
      const ocrMaxHeight = enhanceForOCR ? 2400 : maxHeight;

      // Calculate new dimensions
      if (width > height) {
        if (width > ocrMaxWidth) {
          height = (height * ocrMaxWidth) / width;
          width = ocrMaxWidth;
        }
      } else {
        if (height > ocrMaxHeight) {
          width = (width * ocrMaxHeight) / height;
          height = ocrMaxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Use better image rendering for OCR
      ctx.imageSmoothingEnabled = false; // Disable smoothing for sharper text
      ctx.drawImage(img, 0, 0, width, height);

      // Enhance image for OCR if requested
      if (enhanceForOCR) {
        enhanceImageForOCR(canvas, ctx);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not compress image'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = reject;
    img.src = base64Image;
  });
}
