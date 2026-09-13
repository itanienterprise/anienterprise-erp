import axios from './api';

let actionQueue = [];
let flushTimeout = null;
let isInitialized = false;
let getCurrentUser = () => null;
let getCurrentView = () => 'General';

/**
 * Format view name to human friendly module name
 */
const viewToModuleName = (view) => {
    if (!view) return 'System';
    const clean = view.replace(/-section$/, '').replace(/-/g, ' ');
    return clean.replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Send queued actions to the backend
 */
const flushQueue = async () => {
    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    if (actionQueue.length === 0) return;

    const user = getCurrentUser();
    // Only send if a user is logged in
    if (!user) {
        actionQueue = [];
        return;
    }

    const payload = [...actionQueue];
    actionQueue = [];

    try {
        await axios.post('/api/logs/client-action', { actions: payload });
    } catch (err) {
        // Silently fail to never disrupt user experience
        console.warn('[ActivityTracker] Failed to record actions:', err.message);
    }
};

/**
 * Queue an action to be logged
 */
export const trackUserAction = (actionName, moduleName, details = {}) => {
    const user = getCurrentUser();
    if (!user) return;

    const resolvedModule = moduleName || viewToModuleName(getCurrentView());

    actionQueue.push({
        actionName: actionName || 'User Action',
        module: resolvedModule,
        action: 'CLICK',
        actionCategory: 'UI_CLICK',
        description: `User clicked "${actionName}" in ${resolvedModule}`,
        details: {
            ...details,
            view: getCurrentView()
        },
        path: window.location.pathname || '',
        timestamp: new Date().toISOString()
    });

    if (actionQueue.length >= 5) {
        flushQueue();
    } else if (!flushTimeout) {
        flushTimeout = setTimeout(flushQueue, 3000);
    }
};

/**
 * Initialize automatic click listener
 */
export const initActivityTracker = (userGetter, viewGetter) => {
    if (isInitialized) {
        getCurrentUser = userGetter || getCurrentUser;
        getCurrentView = viewGetter || getCurrentView;
        return;
    }

    getCurrentUser = userGetter || (() => null);
    getCurrentView = viewGetter || (() => 'General');
    isInitialized = true;

    // Global click listener capturing meaningful user button clicks
    document.addEventListener('click', (e) => {
        try {
            const user = getCurrentUser();
            if (!user) return;

            // Find closest clickable element
            const clickable = e.target.closest('button, a, [role="button"], input[type="submit"], input[type="checkbox"]');
            if (!clickable) return;

            // Ignore clicks within the Log module itself to prevent feedback loop
            const curView = getCurrentView();
            if (curView === 'log-section') return;

            // Extract readable label
            let label = clickable.getAttribute('title') ||
                clickable.getAttribute('aria-label') ||
                clickable.innerText?.trim() ||
                clickable.name ||
                clickable.id ||
                clickable.getAttribute('data-action') ||
                clickable.className;

            if (!label || typeof label !== 'string') return;

            // Trim label and sanitize
            label = label.split('\n')[0].trim();
            if (label.length > 50) label = label.substring(0, 50) + '...';
            if (!label) return;

            // Skip trivial elements like generic empty spans or raw numbers
            if (/^(\d+|[.\-_]+)$/.test(label)) return;

            trackUserAction(label, viewToModuleName(curView), {
                tag: clickable.tagName.toLowerCase(),
                targetId: clickable.id || undefined,
                targetName: clickable.name || undefined
            });
        } catch (err) {
            // Ignore click tracker errors
        }
    }, true);

    // Flush on unload
    window.addEventListener('beforeunload', () => {
        if (actionQueue.length > 0) {
            flushQueue();
        }
    });
};
