/**
 * Compresses an image file or DataURL down to reasonable avatar dimensions and JPEG quality.
 * Prevents bloated multi-megabyte base64 strings from filling MongoDB, memory, and backup files.
 *
 * @param {File|Blob|string} fileOrDataUrl - The image input
 * @param {number} maxDimension - Max width or height in px (default 400)
 * @param {number} quality - JPEG compression quality 0.0 - 1.0 (default 0.8)
 * @returns {Promise<string>} Compressed Base64 DataURL
 */
export async function compressImage(fileOrDataUrl, maxDimension = 400, quality = 0.8) {
    if (!fileOrDataUrl) return null;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                let { width, height } = img;
                if (width <= 0 || height <= 0) {
                    return resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : null);
                }

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const compressed = canvas.toDataURL('image/jpeg', quality);
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
