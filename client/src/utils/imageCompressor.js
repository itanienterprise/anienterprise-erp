/**
 * Compresses an image file or DataURL to high-definition portrait dimensions (max 1600px)
 * with optimal JPEG quality (0.90) and high-quality stepped bicubic downscaling.
 * Ensures crystal-clear retina display quality while keeping base64 payload lightweight (~150-350KB).
 *
 * @param {File|Blob|string} fileOrDataUrl - The image input
 * @param {number} maxDimension - Max width or height in px (default 1600)
 * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default 0.90)
 * @returns {Promise<string>} Compressed Base64 DataURL
 */
export async function compressImage(fileOrDataUrl, maxDimension = 1600, quality = 0.90) {
    if (!fileOrDataUrl) return null;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                if (!width || !height || width <= 0 || height <= 0) {
                    return resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : null);
                }

                let targetWidth = width;
                let targetHeight = height;

                if (targetWidth > maxDimension || targetHeight > maxDimension) {
                    if (targetWidth > targetHeight) {
                        targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
                        targetWidth = maxDimension;
                    } else {
                        targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
                        targetHeight = maxDimension;
                    }
                }

                // If original image is already within maxDimension and reasonable quality,
                // still process through high-quality canvas to standardize format and compress.
                let curCanvas = document.createElement('canvas');
                let curCtx = curCanvas.getContext('2d');
                curCanvas.width = width;
                curCanvas.height = height;
                curCtx.imageSmoothingEnabled = true;
                curCtx.imageSmoothingQuality = 'high';
                curCtx.drawImage(img, 0, 0, width, height);

                let curWidth = width;
                let curHeight = height;

                // High-quality stepped downscaling: halve canvas dimensions in steps
                // if resizing down by more than a factor of 2 to preserve sharpness and avoid aliasing
                while (curWidth * 0.5 > targetWidth && curHeight * 0.5 > targetHeight) {
                    const nextWidth = Math.round(curWidth * 0.5);
                    const nextHeight = Math.round(curHeight * 0.5);
                    const stepCanvas = document.createElement('canvas');
                    stepCanvas.width = nextWidth;
                    stepCanvas.height = nextHeight;
                    const stepCtx = stepCanvas.getContext('2d');
                    stepCtx.imageSmoothingEnabled = true;
                    stepCtx.imageSmoothingQuality = 'high';
                    stepCtx.drawImage(curCanvas, 0, 0, curWidth, curHeight, 0, 0, nextWidth, nextHeight);

                    curCanvas = stepCanvas;
                    curWidth = nextWidth;
                    curHeight = nextHeight;
                }

                // Final target canvas
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = targetWidth;
                finalCanvas.height = targetHeight;
                const finalCtx = finalCanvas.getContext('2d');
                finalCtx.imageSmoothingEnabled = true;
                finalCtx.imageSmoothingQuality = 'high';

                // Fill background with slate dark tone matching portrait card in case image has alpha/transparency
                finalCtx.fillStyle = '#0f172a';
                finalCtx.fillRect(0, 0, targetWidth, targetHeight);

                finalCtx.drawImage(curCanvas, 0, 0, curWidth, curHeight, 0, 0, targetWidth, targetHeight);

                const compressed = finalCanvas.toDataURL('image/jpeg', quality);
                resolve(compressed);
            } catch (err) {
                console.warn('[imageCompressor] Canvas compression failed, falling back to original:', err);
                resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : null);
            }
        };

        img.onerror = () => {
            resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : null);
        };

        if (typeof fileOrDataUrl === 'string') {
            img.src = fileOrDataUrl;
        } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(fileOrDataUrl);
        } else {
            resolve(null);
        }
    });
}
