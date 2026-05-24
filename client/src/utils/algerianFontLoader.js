const ALGERIAN_FONT_URL = '/fonts/Algerian.ttf';
const VFS_NAME = 'Algerian.ttf';
const FONT_FAMILY = 'Algerian';

let fontBase64 = null;
let loadPromise = null;

const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};

/** Fetch Algerian.ttf from public folder (call on Packing List mount). */
export const preloadAlgerianFont = () => {
    if (fontBase64) {
        return Promise.resolve(fontBase64);
    }
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = fetch(ALGERIAN_FONT_URL)
        .then((res) => {
            if (!res.ok) {
                throw new Error(`Algerian font HTTP ${res.status}`);
            }
            return res.arrayBuffer();
        })
        .then((buffer) => {
            fontBase64 = arrayBufferToBase64(buffer);
            return fontBase64;
        })
        .catch((err) => {
            loadPromise = null;
            console.error('[TR PDF] Failed to load Algerian.ttf:', err);
            throw err;
        });

    return loadPromise;
};

/**
 * Register Algerian on the jsPDF document instance used for packing list PDFs.
 */
export const ensureAlgerianFont = (doc) => {
    if (!fontBase64) {
        return false;
    }
    if (doc.getFontList()?.[FONT_FAMILY]) {
        return true;
    }
    try {
        doc.addFileToVFS(VFS_NAME, fontBase64);
        doc.addFont(VFS_NAME, FONT_FAMILY, 'normal');
        return Boolean(doc.getFontList()?.[FONT_FAMILY]);
    } catch (err) {
        console.error('[TR PDF] Algerian font registration failed:', err);
        return false;
    }
};
