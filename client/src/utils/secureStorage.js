import { clearDecryptionCache } from './encryption';

const DB_NAME = 'erp_secure_cache_db';

/**
 * Safe cleanup of IndexedDB cache database
 */
export const clearSecureStorage = async () => {
    clearDecryptionCache();
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
        try {
            window.indexedDB.deleteDatabase(DB_NAME);
        } catch (_) {}
    }
};

export const setSecureItem = async () => false;
export const getSecureItem = async () => null;
export const removeSecureItem = async () => {};
export const getAllSecureItems = async () => ({});
