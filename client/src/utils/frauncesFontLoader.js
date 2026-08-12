const FRAUNCES_FONT_URL = '/fonts/Fraunces.ttf';
const VFS_NAME = 'Fraunces.ttf';
const FONT_FAMILY = 'Fraunces';

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

export const preloadFrauncesFont = () => {
    if (fontBase64) {
        return Promise.resolve(fontBase64);
    }
    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = fetch(FRAUNCES_FONT_URL)
        .then((res) => {
            if (!res.ok) {
                throw new Error(`Fraunces font HTTP ${res.status}`);
            }
            return res.arrayBuffer();
        })
        .then((buffer) => {
            fontBase64 = arrayBufferToBase64(buffer);
            return fontBase64;
        })
        .catch((err) => {
            loadPromise = null;
            console.error('[PDF] Failed to load Fraunces.ttf:', err);
            throw err;
        });

    return loadPromise;
};

export const ensureFrauncesFont = (doc) => {
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
        console.error('[PDF] Fraunces font registration failed:', err);
        return false;
    }
};
