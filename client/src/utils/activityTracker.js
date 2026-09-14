import axios from './api';

let actionQueue = [];
let flushTimeout = null;
let isInitialized = false;
let getCurrentUser = () => null;
let getCurrentView = () => 'General';
const recentClicks = new Map();
let pendingCreateModule = null;

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

    let action = details.action || 'CLICK';
    let actionCategory = details.actionCategory || 'UI_CLICK';
    let description = details.description;

    const lowerName = (actionName || '').toLowerCase();
    if (lowerName === 'accept' || details.actionType === 'ACCEPT' || details.action === 'ACCEPT') {
        action = 'ACCEPT';
        actionCategory = 'APPROVAL';
        const inv = details.invoiceNo ? `Invoice #${details.invoiceNo}` : '';
        const name = details.customerName || details.companyName || '';
        const namePart = name ? `("${name}")` : '';
        description = description || `Accepted ${resolvedModule}: ${inv} ${namePart}`.replace(/\s+/g, ' ').trim();
    } else if (lowerName === 'reject' || details.actionType === 'REJECT' || details.action === 'REJECT') {
        action = 'REJECT';
        actionCategory = 'APPROVAL';
        const inv = details.invoiceNo ? `Invoice #${details.invoiceNo}` : '';
        const name = details.customerName || details.companyName || '';
        const namePart = name ? `("${name}")` : '';
        description = description || `Rejected ${resolvedModule}: ${inv} ${namePart}`.replace(/\s+/g, ' ').trim();
    } else if (
        details.actionType === 'DISCARD_ENTRY' ||
        details.action === 'CARD CLOSE (NO SAVE)' ||
        details.wasCreated === false ||
        lowerName === 'discard' ||
        (details.cardType === 'create' && ['close', 'cancel'].includes(lowerName))
    ) {
        action = 'CARD CLOSE (NO SAVE)';
        actionCategory = 'UI_INTERACTION';
        description = details.description || `Closed card without creating in ${resolvedModule}`;
    } else if (
        details.actionType === 'OPEN_CREATE_FORM' ||
        (details.cardType === 'create' && ['open', 'add', 'new', 'create'].some(k => lowerName.includes(k)))
    ) {
        action = 'CARD OPEN';
        actionCategory = 'UI_INTERACTION';
        description = details.description || `Opened new entry card in ${resolvedModule}`;
    } else if (lowerName === 'card open' || lowerName.includes('open card') || details.actionType === 'CARD_OPEN' || details.action === 'CARD OPEN') {
        action = 'CARD OPEN';
        actionCategory = 'UI_INTERACTION';
        const inv = details.invoiceNo ? `Invoice #${details.invoiceNo}` : '';
        const name = details.customerName || details.companyName || '';
        const namePart = name ? `("${name}")` : '';
        description = description || `Opened card: ${inv} ${namePart} in ${resolvedModule}`.replace(/\s+/g, ' ').trim();
    } else if (lowerName === 'card close' || lowerName.includes('close card') || details.actionType === 'CARD_CLOSE' || details.action === 'CARD CLOSE') {
        action = 'CARD CLOSE';
        actionCategory = 'UI_INTERACTION';
        const inv = details.invoiceNo ? `Invoice #${details.invoiceNo}` : '';
        const name = details.customerName || details.companyName || '';
        const namePart = name ? `("${name}")` : '';
        description = description || `Closed card: ${inv} ${namePart} in ${resolvedModule}`.replace(/\s+/g, ' ').trim();
    }

    if (!description) {
        description = `User clicked "${actionName}" in ${resolvedModule}`;
    }

    actionQueue.push({
        actionName: actionName || 'User Action',
        module: resolvedModule,
        action,
        actionCategory,
        description,
        details: {
            ...details,
            view: getCurrentView()
        },
        path: window.location.pathname || '',
        timestamp: new Date().toISOString()
    });

    if (
        action === 'ACCEPT' ||
        action === 'REJECT' ||
        action === 'CARD OPEN' ||
        action === 'CARD CLOSE' ||
        action === 'CARD CLOSE (NO SAVE)' ||
        actionQueue.length >= 5
    ) {
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

            // Extract readable label (avoiding raw CSS utility class dumps)
            let label = clickable.getAttribute('data-action') ||
                clickable.getAttribute('title') ||
                clickable.getAttribute('aria-label') ||
                clickable.innerText?.trim() ||
                clickable.name ||
                clickable.id;

            if (!label || typeof label !== 'string') {
                if (clickable.className && typeof clickable.className === 'string' && clickable.className.includes('close')) {
                    label = 'Close';
                } else {
                    return;
                }
            }

            // Trim label and sanitize
            label = label.split('\n')[0].trim();
            if (label.length > 50) label = label.substring(0, 50) + '...';
            if (!label) return;

            // Skip trivial elements like generic empty spans or raw numbers
            if (/^(\d+|[.\-_]+)$/.test(label)) return;
            // Skip raw CSS class strings if any leaked through
            if (label.includes('bg-') || label.includes('text-') || label.includes('p-1') || label.includes('rounded')) return;

            // Debounce identical clicks within 2.5 seconds to prevent spam
            const clickKey = `${curView}:${label}`;
            const now = Date.now();
            if (recentClicks.has(clickKey) && (now - recentClicks.get(clickKey) < 2500)) {
                return;
            }
            recentClicks.set(clickKey, now);
            if (recentClicks.size > 100) {
                // Keep recentClicks map bounded
                const oldestKeys = Array.from(recentClicks.keys()).slice(0, 30);
                oldestKeys.forEach(k => recentClicks.delete(k));
            }

            const modName = viewToModuleName(curView);
            const isAddButton = /^(add|new|create)\b/i.test(label) || clickable.getAttribute('data-action') === 'create';
            const isCloseButton = /^(close|cancel|discard)\b/i.test(label) || clickable.className?.includes('close') || clickable.getAttribute('aria-label') === 'Close';
            const isSaveButton = /^(save|submit|confirm|update|create)\b/i.test(label);

            if (isAddButton) {
                pendingCreateModule = modName;
                trackUserAction(label, modName, {
                    action: 'CARD OPEN',
                    actionCategory: 'UI_INTERACTION',
                    actionType: 'OPEN_CREATE_FORM',
                    cardType: 'create',
                    description: `Opened new entry card in ${modName}`,
                    tag: clickable.tagName.toLowerCase(),
                    targetId: clickable.id || undefined
                });
                return;
            }

            if (isCloseButton && pendingCreateModule) {
                const targetMod = pendingCreateModule;
                pendingCreateModule = null;
                trackUserAction('Close', targetMod, {
                    action: 'CARD CLOSE (NO SAVE)',
                    actionCategory: 'UI_INTERACTION',
                    actionType: 'DISCARD_ENTRY',
                    cardType: 'create',
                    wasCreated: false,
                    description: `Closed card without creating in ${targetMod}`,
                    tag: clickable.tagName.toLowerCase(),
                    targetId: clickable.id || undefined
                });
                return;
            }

            if (isSaveButton) {
                pendingCreateModule = null;
            }

            trackUserAction(label, modName, {
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
