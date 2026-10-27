import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'ani1820'; // Fallback for safety, but should be in .env

export const encryptData = (data) => {
    if (!data) return data;
    try {
        const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
        return ciphertext;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
};

// High-performance bounded in-memory cache for decrypted payloads
// Eliminates repetitive synchronous CryptoJS.AES.decrypt execution across thousands of records
const decryptionCache = new Map();
const MAX_DECRYPTION_CACHE_SIZE = 6000;

export const clearDecryptionCache = () => {
    decryptionCache.clear();
};

export const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    if (typeof ciphertext !== 'string') return ciphertext;

    // Check high-speed in-memory cache
    if (decryptionCache.has(ciphertext)) {
        const cached = decryptionCache.get(ciphertext);
        if (cached && typeof cached === 'object') {
            return Array.isArray(cached) ? cached.slice() : { ...cached };
        }
        return cached;
    }

    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const utf8Str = bytes.toString(CryptoJS.enc.Utf8);
        if (!utf8Str) return null;
        const decryptedData = JSON.parse(utf8Str);

        // Bounded cache maintenance (FIFO pruning of oldest entries)
        if (decryptionCache.size >= MAX_DECRYPTION_CACHE_SIZE) {
            const keysToDelete = [];
            let pruned = 0;
            for (const key of decryptionCache.keys()) {
                keysToDelete.push(key);
                pruned++;
                if (pruned >= 600) break;
            }
            for (const k of keysToDelete) {
                decryptionCache.delete(k);
            }
        }

        decryptionCache.set(ciphertext, decryptedData);
        if (decryptedData && typeof decryptedData === 'object') {
            return Array.isArray(decryptedData) ? decryptedData.slice() : { ...decryptedData };
        }
        return decryptedData;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
};

/**
 * Generates an HMAC signature for a payload and timestamp.
 * This ensures request integrity and prevents tampering in Burp Suite.
 */
export const generateSignature = (payload, timestamp) => {
    try {
        const dataToSign = `${JSON.stringify(payload)}|${timestamp}`;
        return CryptoJS.HmacSHA256(dataToSign, SECRET_KEY).toString();
    } catch (error) {
        console.error('Signature generation error:', error);
        return null;
    }
};
