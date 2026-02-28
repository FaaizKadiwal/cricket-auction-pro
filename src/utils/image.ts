/**
 * Resize an image File and return a compressed base64 data URL.
 *
 * Behaviour:
 * - Scans pixel alpha channel to auto-detect whether the image has a transparent
 *   background (logos, art, cutouts) or is fully opaque (photos, portraits).
 * - Transparent images: never cropped; full aspect ratio preserved; output as PNG.
 * - Opaque images + smartCrop=true: square-cropped before resizing, with a
 *   top-biased vertical crop for portrait images so the subject stays in frame.
 * - Opaque images + smartCrop=false: aspect ratio preserved; output as JPEG.
 * - Never upscales — only downscales to fit within maxDim × maxDim.
 *
 * Uses the canvas API. Should only be called in a browser context.
 */
export function resizeImage(
  file: File,
  maxDim = 200,
  quality = 0.85,
  smartCrop = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        // ── Step 1: Detect transparency via pixel scan ────────────────────────
        // Only PNG / WebP / GIF can carry an alpha channel.
        const canHaveAlpha =
          file.type === 'image/png' ||
          file.type === 'image/webp' ||
          file.type === 'image/gif';

        let isTransparent = false;

        if (canHaveAlpha) {
          // Sample at ≤ 400 px for performance on large images
          const sW = Math.min(img.width,  400);
          const sH = Math.min(img.height, 400);
          const probe = document.createElement('canvas');
          probe.width  = sW;
          probe.height = sH;
          const pCtx = probe.getContext('2d');
          if (pCtx) {
            pCtx.drawImage(img, 0, 0, sW, sH);
            const pixels = pCtx.getImageData(0, 0, sW, sH).data;
            // alpha byte is index 3 of every RGBA group
            for (let i = 3; i < pixels.length; i += 4) {
              if (pixels[i] < 240) { isTransparent = true; break; }
            }
          }
        }

        // ── Step 2: Determine source crop rectangle ───────────────────────────
        // Transparent images → never crop; keep original aspect ratio.
        // Opaque images + smartCrop → square-crop with face-friendly bias.
        let sx = 0, sy = 0, sw = img.width, sh = img.height;

        if (!isTransparent && smartCrop) {
          const minSide = Math.min(img.width, img.height);
          sw = minSide;
          sh = minSide;
          // Horizontal centre always
          sx = Math.floor((img.width - minSide) / 2);
          // Vertical: portrait → bias 25 % from top (subject/face in upper portion)
          //           landscape → exact centre
          sy = img.height > img.width
            ? Math.floor((img.height - minSide) * 0.25)
            : Math.floor((img.height - minSide) / 2);
        }

        // ── Step 3: Scale to fit within maxDim (never upscale) ───────────────
        const scale = Math.min(maxDim / sw, maxDim / sh, 1);
        const w = Math.round(sw * scale);
        const h = Math.round(sh * scale);

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

        // ── Step 4: Encode — PNG for transparency, JPEG for opaque ───────────
        resolve(canvas.toDataURL(
          isTransparent ? 'image/png'  : 'image/jpeg',
          isTransparent ? undefined    : quality,
        ));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Return the initials (up to 2 chars) from a name string */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
