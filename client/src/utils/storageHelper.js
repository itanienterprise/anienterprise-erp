/**
 * Safe Storage & Quota Management Helper
 *
 * Prevents QuotaExceededError crashes when saving session or state to localStorage/sessionStorage.
 * Specifically prevents huge base64 images (profilePhoto, etc.) from filling up the browser's 5MB quota,
 * automatically purges disposable cache keys if quota is ever reached, and provides safe wrappers
 * that never throw unhandled exceptions during login or session checks.
 */

export const sanitizeUserForStorage = (user) => {
    if (!user || typeof user !== 'object') return user;
    // Strip heavy base64 profilePhoto from persistent storage
    const { profilePhoto, ...safeUser } = user;
    // If avatarPhoto is unusually large (> 100KB), omit it from storage to guarantee quota safety
    if (safeUser.avatarPhoto && typeof safeUser.avatarPhoto === 'string' && safeUser.avatarPhoto.length > 100000) {
        safeUser.avatarPhoto = null;
    }
    return safeUser;
};

export const cleanStorageQuota = () => {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
        const disposablePrefixes = [
            'dashboard_user_profile_',
            'dashboard_stats_cache_',
            'erp_fund_transfers_cache',
            'erp_deposits_cache',
            'erp_withdrawals_cache',
            'bank_dollar_rates_cache',
            'downloaded_backup_files'
        ];

        const keysToRemove = [];
        let hasLargeCurrentUser = false;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            // Check disposable cache keys
            if (disposablePrefixes.some(prefix => key.startsWith(prefix))) {
                keysToRemove.push(key);
                continue;
            }

            // Check if any key is taking over 100KB of storage
            try {
                const val = localStorage.getItem(key);
                if (val && val.length > 100000) {
                    if (key === 'currentUser') {
                        hasLargeCurrentUser = true;
                    } else if (key !== 'erp_session_token' && key !== 'erp_session_id') {
                        keysToRemove.push(key);
                    }
                }
            } catch (_) { }
        }

        // Remove non-essential bloated cache entries
        keysToRemove.forEach(k => {
            try { localStorage.removeItem(k); } catch (_) { }
        });

        // Clean up currentUser if it was bloated with profilePhoto
        if (hasLargeCurrentUser) {
            try {
                const rawUser = localStorage.getItem('currentUser');
                if (rawUser) {
                    const parsed = JSON.parse(rawUser);
                    const safe = sanitizeUserForStorage(parsed);
                    localStorage.setItem('currentUser', JSON.stringify(safe));
                }
            } catch (_) { }
        }

        // Also check sessionStorage for oversized currentUser
        try {
            if (window.sessionStorage) {
                const rawSessionUser = sessionStorage.getItem('currentUser');
                if (rawSessionUser && rawSessionUser.length > 100000) {
                    const parsed = JSON.parse(rawSessionUser);
                    const safe = sanitizeUserForStorage(parsed);
                    sessionStorage.setItem('currentUser', JSON.stringify(safe));
                }
            }
        } catch (_) { }
    } catch (err) {
        console.warn('[storageHelper] Error while cleaning storage quota:', err);
    }
};

export const safeStorage = {
    setItem: (storage, key, value) => {
        if (!storage) return false;

        let processedValue = value;
        if (key === 'currentUser' && typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                const safe = sanitizeUserForStorage(parsed);
                processedValue = JSON.stringify(safe);
            } catch (_) { }
        }

        try {
            storage.setItem(key, processedValue);
            return true;
        } catch (e) {
            // Check for quota exceeded error across browsers
            const isQuotaError = e && (
                e.name === 'QuotaExceededError' ||
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                e.code === 22 ||
                e.code === 1014 ||
                (e.message && e.message.toLowerCase().includes('quota'))
            );

            if (isQuotaError) {
                console.warn(`[storageHelper] Storage quota exceeded when writing "${key}". Cleaning disposable cache...`);
                cleanStorageQuota();
                try {
                    storage.setItem(key, processedValue);
                    return true;
                } catch (retryErr) {
                    console.error(`[storageHelper] Storage still full after cleanup when writing "${key}".`, retryErr);
                    return false;
                }
            }
            console.warn(`[storageHelper] Failed to set item "${key}":`, e);
            return false;
        }
    },

    getItem: (storage, key) => {
        if (!storage) return null;
        try {
            return storage.getItem(key);
        } catch (e) {
            console.warn(`[storageHelper] Failed to get item "${key}":`, e);
            return null;
        }
    },

    removeItem: (storage, key) => {
        if (!storage) return false;
        try {
            storage.removeItem(key);
            return true;
        } catch (e) {
            console.warn(`[storageHelper] Failed to remove item "${key}":`, e);
            return false;
        }
    }
};

// Automatically run cleanup on module load to purge any existing bloated items in the browser
if (typeof window !== 'undefined') {
    cleanStorageQuota();
}
