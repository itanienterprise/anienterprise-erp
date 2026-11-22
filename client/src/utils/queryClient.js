import { QueryClient } from '@tanstack/react-query';

// Safely purge legacy encrypted IndexedDB cache from prior runs so it doesn't crash the browser
if (typeof window !== 'undefined' && 'indexedDB' in window) {
    try {
        window.indexedDB.deleteDatabase('erp_secure_cache_db');
    } catch (_) {}
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 3,     // 3 minutes fresh: instant navigation without refetch lag
            gcTime: 1000 * 60 * 15,       // 15 minutes garbage collection (frees memory)
            refetchOnWindowFocus: false,  // Avoid jarring refetches on window switch
            retry: 1,
        },
    },
});

/**
 * Invalidate query and trigger background refetch
 */
export const invalidateQueries = (queryKey) => {
    return queryClient.invalidateQueries({ queryKey });
};

/**
 * Update query data in memory cache
 */
export const setQueryData = (queryKey, updater) => {
    return queryClient.setQueryData(queryKey, updater);
};

/**
 * Get query data from in-memory cache
 */
export const getQueryData = (queryKey) => {
    return queryClient.getQueryData(queryKey);
};

/**
 * Safe no-op / cleanup helpers kept for backward compatibility with App.jsx
 */
export const hydrateQueryCache = async () => 0;

export const clearPersistentQueryCache = async () => {
    queryClient.clear();
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
        try {
            window.indexedDB.deleteDatabase('erp_secure_cache_db');
        } catch (_) {}
    }
};
