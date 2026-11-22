import { clearDecryptionCache } from './encryption';

const DB_NAME = 'erp_secure_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'cache_store';

let cachedCryptoKey = null;

const getCryptoKey = async () => {
    if (cachedCryptoKey) return cachedCryptoKey;
    const keyStr = import.meta.env.VITE_SECRET_KEY || 'ani1820';
    const encoder = new TextEncoder();
    const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(keyStr));
    cachedCryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
    return cachedCryptoKey;
};

const isIndexedDBSupported = () => {
    return typeof window !== 'undefined' && 'indexedDB' in window && 'crypto' in window && 'subtle' in window.crypto;
};

let dbPromise = null;

const getDb = () => {
    if (!isIndexedDBSupported()) return Promise.resolve(null);
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
 * Encrypts data using native hardware-accelerated AES-256-GCM.
 * Executed in C++ native code in 1-2 ms without blocking JavaScript UI thread.
 */
export const setSecureItem = async (key, data) => {
    if (!key || data === undefined || !isIndexedDBSupported()) return false;

    try {
        const keyObj = await getCryptoKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const plaintext = encoder.encode(JSON.stringify(data));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyObj, plaintext);

        const record = {
            key,
            iv,
            ciphertext,
            timestamp: Date.now()
        };

        const db = await getDb();
        if (!db) return false;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put(record);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch (_) {
                resolve(false);
            }
        });
    } catch (e) {
        console.warn('[SecureStorage] Error setting secure item:', e);
        return false;
    }
};

/**
 * Reads encrypted data from IndexedDB, decrypts it via native AES-256-GCM, and returns parsed data.
 */
export const getSecureItem = async (key, maxAgeMs = null) => {
    if (!key || !isIndexedDBSupported()) return null;

    try {
        const db = await getDb();
        if (!db) return null;

        const record = await new Promise((resolve) => {
            try {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });

        if (!record || !record.ciphertext || !record.iv) return null;

        if (maxAgeMs && typeof maxAgeMs === 'number') {
            const age = Date.now() - (record.timestamp || 0);
            if (age > maxAgeMs) {
                removeSecureItem(key);
                return null;
            }
        }

        const keyObj = await getCryptoKey();
        const decryptedBytes = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: record.iv },
            keyObj,
            record.ciphertext
        );
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedBytes));
    } catch (e) {
        console.warn('[SecureStorage] Error getting secure item:', e);
        return null;
    }
};

/**
 * Removes a single item by key from the encrypted store.
 */
export const removeSecureItem = async (key) => {
    if (!key || !isIndexedDBSupported()) return;

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
 * Retrieves all stored entries, decrypts them asynchronously, and returns a key -> value map.
 * Fast native AES-GCM allows bulk decryption of all datasets in under 10 ms.
 */
export const getAllSecureItems = async () => {
    const result = {};
    if (!isIndexedDBSupported()) return result;

    try {
        const db = await getDb();
        if (!db) return result;

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

        if (!records || records.length === 0) return result;

        const keyObj = await getCryptoKey();
        const decoder = new TextDecoder();

        await Promise.all(records.map(async (record) => {
            if (record && record.key && record.ciphertext && record.iv) {
                try {
                    const decryptedBytes = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: record.iv },
                        keyObj,
                        record.ciphertext
                    );
                    result[record.key] = JSON.parse(decoder.decode(decryptedBytes));
                } catch (_) {}
            }
        }));
    } catch (e) {
        console.warn('[SecureStorage] Error loading all secure items:', e);
    }

    return result;
};

/**
 * Purges all cached items from IndexedDB and clears memory.
 * Executed upon user logout.
 */
export const clearSecureStorage = async () => {
    clearDecryptionCache();
    cachedCryptoKey = null;

    if (!isIndexedDBSupported()) return;

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
