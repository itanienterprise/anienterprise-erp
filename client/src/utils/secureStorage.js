import { encryptData, decryptData, clearDecryptionCache } from './encryption';

const DB_NAME = 'erp_secure_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'cache_store';

// In-memory fallback in case IndexedDB is blocked or unavailable
const memoryFallback = new Map();

const isIndexedDBSupported = () => {
    return typeof window !== 'undefined' && 'indexedDB' in window;
};

let dbPromise = null;

const getDb = () => {
    if (!isIndexedDBSupported()) {
        return Promise.resolve(null);
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (err) => {
                console.warn('[SecureStorage] IndexedDB open error:', err);
                resolve(null);
            };
        } catch (e) {
            console.warn('[SecureStorage] IndexedDB initialization failed:', e);
            resolve(null);
        }
    });

    return dbPromise;
};

/**
 * Stores data encrypted with AES-256 into IndexedDB.
 * Zero plaintext business data is stored on disk.
 */
export const setSecureItem = async (key, data) => {
    if (!key || data === undefined) return false;

    try {
        const encrypted = encryptData(data);
        if (!encrypted) return false;

        const record = {
            key,
            payload: encrypted,
            timestamp: Date.now()
        };

        const db = await getDb();
        if (!db) {
            memoryFallback.set(key, record);
            return true;
        }

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(record);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => {
                    memoryFallback.set(key, record);
                    resolve(true);
                };
            } catch (err) {
                memoryFallback.set(key, record);
                resolve(true);
            }
        });
    } catch (e) {
        console.error('[SecureStorage] Error setting secure item:', e);
        return false;
    }
};

/**
 * Reads encrypted data from IndexedDB, decrypts it, and returns the data.
 * @param {string} key
 * @param {number|null} maxAgeMs - Optional expiration in milliseconds (e.g. 24 hours)
 */
export const getSecureItem = async (key, maxAgeMs = null) => {
    if (!key) return null;

    try {
        const db = await getDb();
        let record = null;

        if (db) {
            record = await new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const getReq = store.get(key);
                    getReq.onsuccess = () => resolve(getReq.result || null);
                    getReq.onerror = () => resolve(null);
                } catch (e) {
                    resolve(null);
                }
            });
        }

        if (!record && memoryFallback.has(key)) {
            record = memoryFallback.get(key);
        }

        if (!record || !record.payload) return null;

        // Check age if maxAgeMs is specified
        if (maxAgeMs && typeof maxAgeMs === 'number') {
            const age = Date.now() - (record.timestamp || 0);
            if (age > maxAgeMs) {
                removeSecureItem(key);
                return null;
            }
        }

        const decrypted = decryptData(record.payload);
        return decrypted;
    } catch (e) {
        console.error('[SecureStorage] Error getting secure item:', e);
        return null;
    }
};

/**
 * Deletes a secure item by key.
 */
export const removeSecureItem = async (key) => {
    if (!key) return;

    memoryFallback.delete(key);

    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch (_) {
            resolve();
        }
    });
};

/**
 * Clears all cached items from IndexedDB and memory.
 * Should be called immediately on user logout or session expiration.
 */
export const clearSecureStorage = async () => {
    memoryFallback.clear();
    clearDecryptionCache();

    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch (_) {
            resolve();
        }
    });
};

/**
 * Retrieves all stored entries, decrypts them, and returns a key -> value map.
 * Used for instant batch hydration on application startup.
 */
export const getAllSecureItems = async () => {
    const result = {};

    try {
        const db = await getDb();
        if (!db) {
            for (const [k, v] of memoryFallback.entries()) {
                if (v && v.payload) {
                    const decrypted = decryptData(v.payload);
                    if (decrypted !== null && decrypted !== undefined) {
                        result[k] = decrypted;
                    }
                }
            }
            return result;
        }

        const records = await new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch (_) {
                resolve([]);
            }
        });

        for (const record of records) {
            if (record && record.key && record.payload) {
                const decrypted = decryptData(record.payload);
                if (decrypted !== null && decrypted !== undefined) {
                    result[record.key] = decrypted;
                }
            }
        }
    } catch (e) {
        console.error('[SecureStorage] Error loading all items:', e);
    }

    return result;
};
