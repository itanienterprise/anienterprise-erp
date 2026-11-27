import { registerBlobFileName, isApkEnvironment } from './apkDownloadBridge';

/**
 * Sanitizes a string to make it safe for PDF titles and filenames.
 * Keeps letters, numbers, spaces, dots, dashes, and underscores.
 * Replaces slashes and other unsafe characters with dashes.
 */
export const sanitizePdfFileName = (rawName) => {
    if (!rawName) return 'Document';
    return String(rawName)
        .replace(/[\/\\?%*:|"<>]/g, '-')   // Replace slashes and forbidden characters with dashes
        .replace(/[\(\)]/g, '')            // Remove brackets
        .replace(/\s+/g, '_')              // Replace spaces with underscores
        .replace(/-+/g, '-')               // Replace multiple dashes with single dash
        .replace(/_+/g, '_')               // Replace multiple underscores with single underscore
        .replace(/^[-_.]+|[-_.]+$/g, '')   // Trim leading/trailing separators
        || 'Document';
};

/**
 * Previews or opens a PDF document in a new browser tab with clean metadata and filename:
 * 1. Sets doc.setProperties({ title: cleanName, subject: cleanName, author: 'ANI Enterprise ERP' })
 *    so Chrome, Edge, Firefox, and Safari display the title in the viewer toolbar and tab title.
 * 2. Routes via /api/pdf-preview/:token/:filename (intercepted by Service Worker or Express backend)
 *    so Chrome's "Save As" dialog and download button default to the EXACT related filename instead of a random UUID.
 * 3. In Android APK (via apkDownloadBridge), registers cleanName.pdf so native download saves it correctly.
 */
export const openPdfDocument = (doc, rawFileName = 'Document') => {
    if (!doc) return;
    const cleanName = sanitizePdfFileName(rawFileName);
    const pdfFileName = `${cleanName}.pdf`;

    try {
        doc.setProperties({
            title: cleanName,
            subject: cleanName,
            author: 'ANI Enterprise ERP',
            creator: 'ANI Enterprise ERP'
        });
    } catch (e) {
        console.warn('Failed to set PDF document properties:', e);
    }

    const pdfBlob = doc.output('blob');

    // If running in native Android APK, use the bridge
    if (isApkEnvironment()) {
        const blobURL = URL.createObjectURL(pdfBlob);
        registerBlobFileName(blobURL, pdfFileName);
        window.open(blobURL, '_blank');
        return blobURL;
    }

    const randomToken = Math.random().toString(36).substring(2, 10);
    const previewUrl = `/api/pdf-preview/${randomToken}/${encodeURIComponent(pdfFileName)}`;

    // 1. Cache in Service Worker Cache if supported
    let swCached = false;
    if (typeof window !== 'undefined' && 'caches' in window) {
        try {
            caches.open('pdf-preview-cache').then((cache) => {
                const swResponse = new Response(pdfBlob, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `inline; filename="${pdfFileName}"`,
                        'Cache-Control': 'no-cache'
                    }
                });
                cache.put(previewUrl, swResponse).catch(() => {});
            });
            swCached = true;
        } catch (_) {}
    }

    // 2. Open popup tab synchronously to prevent browser popup blockers
    let newTab = null;
    try {
        newTab = window.open('about:blank', '_blank');
        if (newTab) {
            newTab.document.title = cleanName;
        }
    } catch (_) {}

    // Helper: Register with backend as fallback
    const registerWithBackend = async () => {
        try {
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => {
                    const res = reader.result || '';
                    const base64 = res.includes(',') ? res.split(',')[1] : res;
                    resolve(base64);
                };
                reader.readAsDataURL(pdfBlob);
            });
            const pdfBase64 = await base64Promise;

            const regRes = await fetch('/api/pdf-preview/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: pdfFileName, pdfBase64 })
            });

            if (regRes.ok) {
                const { token } = await regRes.json();
                const serverUrl = `/api/pdf-preview/${token}/${encodeURIComponent(pdfFileName)}`;
                if (newTab && !newTab.closed) {
                    newTab.location.replace(serverUrl);
                } else if (!newTab) {
                    window.open(serverUrl, '_blank');
                }
                return serverUrl;
            }
        } catch (err) {
            console.warn('[PDF] Backend preview register failed, using blob fallback:', err);
        }

        // Fallback: Blob URL
        const blobURL = URL.createObjectURL(pdfBlob);
        registerBlobFileName(blobURL, pdfFileName);
        if (newTab && !newTab.closed) {
            newTab.location.href = blobURL;
        } else if (!newTab) {
            doc.save(pdfFileName);
        }
        return blobURL;
    };

    // If Service Worker is active and cached, navigate tab immediately
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller && swCached) {
        if (newTab && !newTab.closed) {
            newTab.location.replace(previewUrl);
        }
        // Also register with backend in background in case user reloads the new tab
        registerWithBackend().catch(() => {});
        return previewUrl;
    } else {
        // Otherwise wait for backend register and then navigate
        registerWithBackend();
        return previewUrl;
    }
};
