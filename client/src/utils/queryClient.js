import { QueryClient } from '@tanstack/react-query';
import { setSecureItem, getSecureItem, removeSecureItem, clearSecureStorage, getAllSecureItems } from './secureStorage';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5,     // 5 minutes fresh: instant navigation & instant reload without refetch lag
            gcTime: 1000 * 60 * 60 * 24,  // 24 hours in cache
            refetchOnWindowFocus: false,  // Avoid jarring refetches on window switch
            retry: 1,
        },
    },
});

const QUERY_PREFIX = 'query:';

const serializeKey = (queryKey) => {
    return QUERY_PREFIX + JSON.stringify(queryKey);
};

const deserializeKey = (storageKey) => {
    if (!storageKey.startsWith(QUERY_PREFIX)) return null;
    try {
        return JSON.parse(storageKey.slice(QUERY_PREFIX.length));
    } catch {
        return null;
    }
};

// Debounce map for persisting query data to prevent disk write thrashing
const persistTimers = new Map();

const persistQueryDataDebounced = (storageKey, data) => {
    if (persistTimers.has(storageKey)) {
        clearTimeout(persistTimers.get(storageKey));
    }
    const timer = setTimeout(() => {
        persistTimers.delete(storageKey);
        setSecureItem(storageKey, data).catch(err => {
            console.warn('[QueryClient] Secure persist error:', err);
        });
    }, 250);
    persistTimers.set(storageKey, timer);
};

// Automatically subscribe to TanStack Query Cache updates to persist data encrypted in IndexedDB
queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated') {
        const query = event.query;
        if (query && query.queryKey && query.state.status === 'success' && query.state.data !== undefined) {
            const storageKey = serializeKey(query.queryKey);
            persistQueryDataDebounced(storageKey, query.state.data);
        }
    } else if (event.type === 'removed') {
        const query = event.query;
        if (query && query.queryKey) {
            const storageKey = serializeKey(query.queryKey);
            removeSecureItem(storageKey);
        }
    }
});

let hydrationPromise = null;

/**
 * Rehydrates all cached queries from encrypted IndexedDB into QueryClient memory.
 * Runs instantly on page load/refresh.
 */
export const hydrateQueryCache = () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
        try {
            const allItems = await getAllSecureItems();
            let count = 0;
            for (const [sKey, data] of Object.entries(allItems)) {
                if (sKey.startsWith(QUERY_PREFIX) && data !== undefined && data !== null) {
                    const qKey = deserializeKey(sKey);
                    if (qKey) {
                        queryClient.setQueryData(qKey, data);
                        count++;
                    }
                }
            }
            if (count > 0) {
                console.log(`[QueryClient] Successfully rehydrated ${count} cached datasets instantly from secure storage.`);
            }
            return count;
        } catch (err) {
            console.error('[QueryClient] Hydration error:', err);
            return 0;
        }
    })();

    return hydrationPromise;
};

// Start hydration immediately upon module evaluation
hydrateQueryCache();

/**
 * Invalidate query and trigger background refetch
 */
export const invalidateQueries = (queryKey) => {
    return queryClient.invalidateQueries({ queryKey });
};

/**
 * Update query data both in memory and persistent secure storage
 */
export const setQueryData = (queryKey, updater) => {
    const result = queryClient.setQueryData(queryKey, updater);
    if (result !== undefined) {
        const storageKey = serializeKey(queryKey);
        persistQueryDataDebounced(storageKey, result);
    }
    return result;
};

/**
 * Get query data from in-memory cache
 */
export const getQueryData = (queryKey) => {
    return queryClient.getQueryData(queryKey);
};

/**
 * Purges all persistent queries from IndexedDB and clears QueryClient in memory.
 * Must be executed upon user logout or session termination.
 */
export const clearPersistentQueryCache = async () => {
    persistTimers.forEach(timer => clearTimeout(timer));
    persistTimers.clear();
    queryClient.clear();
    await clearSecureStorage();
    hydrationPromise = null;
    console.log('[QueryClient] Secure cache completely cleared.');
};
