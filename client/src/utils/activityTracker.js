import axios from './api';

let actionQueue = [];
let flushTimeout = null;
let isInitialized = false;
let getCurrentUser = () => null;
let getCurrentView = () => 'General';
const recentClicks = new Map();
let pendingCreateModule = null;

const VIEW_MODULE_MAP = {
    'dashboard': 'Dashboard',
    'lc-entry-section': 'LC Entry',
    'lc-management-section': 'LC Management',
    'lc-section': 'LC Management',
    'lc': 'LC Management',
    'cnf-payment-section': 'C&F Payment',
    'ip-section': 'IP',
    'ip': 'IP',
    'pi-section': 'PI',
    'pi': 'PI',
    'packing-list-section': 'Packing List',
    'tr-setup-section': 'TR Setup',
    'tr-setup': 'TR Setup',
    'importer-section': 'Importer',
    'importer': 'Importer',
    'exporter-section': 'Exporter',
    'exporter': 'Exporter',
    'supplier-section': 'Supplier',
    'supplier': 'Supplier',
    'indian-cnf-section': 'Indian C&F',
    'indian-cnf': 'Indian C&F',
    'bd-cnf-section': 'BD C&F',
    'bd-cnf': 'BD C&F',
    'cnf-section': 'C&F',
    'cnf': 'C&F',
    'bank-section': 'Bank',
    'bank': 'Bank',
    'port-section': 'Port',
    'port': 'Port',
    'products-section': 'Product',
    'product-section': 'Product',
    'products': 'Product',
    'product': 'Product',
    'customer-section': 'Customer',
    'customer': 'Customer',
    'payment-collection-section': 'Payment Collection',
    'pay-to-customer-section': 'Pay to Customer',
    'warehouse-section': 'Warehouse',
    'warehouse': 'Warehouse',
    'damage-section': 'Damage',
    'damage': 'Damage',
    'transfer-section': 'Stock Transfer',
    'stock-transfer': 'Stock Transfer',
    'purchase-sale-section': 'Purchase',
    'purchase-section': 'Purchase',
    'purchase': 'Purchase',
    'purchase-receive-sale-section': 'Purchase Receive',
    'purchase-receive-section': 'Purchase Receive',
    'order-sale-section': 'Order Sale',
    'general-sale-section': 'General Sale',
    'border-sale-section': 'Border Sale',
    'employee-section': 'HRMS / Employee',
    'hrms-section': 'HRMS / Employee',
    'hrms': 'HRMS / Employee',
    'role-creation': 'Role Creation',
    'system-access': 'System Access',
    'insurance-section': 'Insurance',
    'insurance': 'Insurance',
    'insurance-payment-section': 'Insurance Payment',
    'lc-gp-section': 'LC Gate Pass',
    'lc-expense-section': 'LC Expense',
    'margin-return-section': 'Margin Return',
    'return-product-section': 'Return Product',
    'profit-loss-section': 'Profit Loss',
    'cost-of-goods-section': 'Cost of Goods',
    'cost-of-goods': 'Cost of Goods',
    'backup-restore-section': 'Backup & Restore',
    'log-section': 'Activity Log'
};

/**
 * Format view name to human friendly module name
 */
const viewToModuleName = (view) => {
    if (!view) return 'System';
    if (VIEW_MODULE_MAP[view]) return VIEW_MODULE_MAP[view];
    const clean = view.replace(/-section$/, '').replace(/-/g, ' ');
    return clean.replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Extract context identifier or name from row element
 */
const extractContextFromRow = (clickable, row) => {
    if (!row) return null;
    
    // Check explicit data attributes first
    const explicitId = row.getAttribute('data-identifier') || 
                       row.getAttribute('data-name') || 
                       row.getAttribute('data-ref') || 
                       row.getAttribute('data-id') || 
                       row.getAttribute('data-title') ||
                       clickable.getAttribute('data-context-id');
    if (explicitId && typeof explicitId === 'string' && explicitId.trim().length > 1) {
        return explicitId.trim();
    }

    // Patterns for business reference codes
    const refRegex = /\b(?:GS|BS|ORD|INV|SI|PI|LC|PO|PR|CH|GP|DMG|RET|TR|TP|IP|PL)[-0-9A-Z/]+\b/i;
    let foundRef = null;
    let foundOrd = null;
    let foundInv = null;
    let foundName = null;

    // Scan cells for prominent text
    const cells = Array.from(row.querySelectorAll('td, th, [role="cell"]'));
    for (const cell of cells) {
        // Skip cell that contains the clickable button itself
        if (cell.contains(clickable)) continue;

        const cellText = cell.innerText?.trim() || '';
        if (!cellText || cellText.length < 2 || cellText.length > 80) continue;

        // Check reference code
        const m = cellText.match(refRegex);
        if (m) {
            const code = m[0].trim();
            if (code.toUpperCase().startsWith('ORD')) {
                if (!foundOrd) foundOrd = code;
            } else if (code.toUpperCase().startsWith('GS') || code.toUpperCase().startsWith('BS') || code.toUpperCase().startsWith('INV')) {
                if (!foundInv) foundInv = code;
            } else if (!foundRef) {
                foundRef = code;
            }
        }

        // Look for prominent entity text (.font-bold, .font-semibold, .font-medium, strong, etc.)
        if (!foundName) {
            const strongEl = cell.querySelector('.font-bold, .font-semibold, .font-medium, strong, b, h3, h4, .text-gray-900, .text-slate-900');
            const candidate = strongEl ? strongEl.innerText?.trim() : cellText;
            if (
                candidate &&
                candidate.length >= 2 &&
                candidate.length <= 50 &&
                !/^\d+$/.test(candidate) &&
                !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(candidate) &&
                !/^(active|inactive|pending|approved|rejected|completed|broken|paid|unpaid|due|edit|delete|view|action|actions|details|-|n\/a)$/i.test(candidate) &&
                !candidate.startsWith('৳') &&
                !candidate.startsWith('$')
            ) {
                foundName = candidate;
            }
        }
    }

    if (foundOrd && foundInv) {
        return foundName ? `${foundOrd} - ${foundInv} - ${foundName}` : `${foundOrd} - ${foundInv}`;
    }
    const bestRef = foundInv || foundOrd || foundRef;
    if (foundName && bestRef && foundName !== bestRef) {
        return `${foundName} (${bestRef})`;
    }
    if (bestRef) return bestRef;
    if (foundName) return foundName;

    return null;
};

/**
 * Extract structured field details from row element for rich action inspection
 */
const extractRowDetails = (clickable, row) => {
    if (!row && !clickable) return {};
    const details = {};

    // 1. Explicit data attributes on clickable or row
    const getAttr = (attr) => clickable?.getAttribute(attr) || row?.getAttribute(attr);

    const orderNo = getAttr('data-order-no');
    if (orderNo) details.orderNo = orderNo.trim();

    const invoiceNo = getAttr('data-invoice-no');
    if (invoiceNo) details.invoiceNo = invoiceNo.trim();

    const customerName = getAttr('data-customer-name') || getAttr('data-customer') || getAttr('data-party-name');
    if (customerName) details.customerName = customerName.trim();

    const totalAmount = getAttr('data-total-amount') || getAttr('data-amount') || getAttr('data-total');
    if (totalAmount) details.totalAmount = totalAmount.trim();

    const saleType = getAttr('data-sale-type');
    if (saleType) details.saleType = saleType.trim();

    const status = getAttr('data-status');
    if (status) details.status = status.trim();

    // 2. Scan row cells if missing any fields
    if (row) {
        const refRegex = /\b(?:GS|BS|ORD|INV|SI|PI|LC|PO|PR|CH|GP|DMG|RET|TR|TP|IP|PL)[-0-9A-Z/]+\b/i;
        const cells = Array.from(row.querySelectorAll('td, th, [role="cell"]'));
        for (const cell of cells) {
            if (clickable && cell.contains(clickable)) continue;
            const txt = cell.innerText?.trim() || '';
            if (!txt) continue;

            const m = txt.match(refRegex);
            if (m) {
                const code = m[0].trim();
                if (code.toUpperCase().startsWith('ORD') && !details.orderNo) {
                    details.orderNo = code;
                } else if ((code.toUpperCase().startsWith('GS') || code.toUpperCase().startsWith('BS') || code.toUpperCase().startsWith('INV')) && !details.invoiceNo) {
                    details.invoiceNo = code;
                }
            }

            if (!details.totalAmount) {
                const amtMatch = txt.match(/[৳$]([\d,]+(?:\.\d{2})?)/);
                if (amtMatch) {
                    details.totalAmount = amtMatch[1].replace(/,/g, '');
                }
            }

            if (!details.customerName) {
                const strongEl = cell.querySelector('.font-bold, .font-semibold, .font-medium, strong, b, h3, h4, .text-gray-900, .text-slate-900');
                const candidate = strongEl ? strongEl.innerText?.trim() : txt;
                if (
                    candidate &&
                    candidate.length >= 2 &&
                    candidate.length <= 50 &&
                    !/^\d+$/.test(candidate) &&
                    !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(candidate) &&
                    !/^(active|inactive|pending|approved|rejected|completed|broken|paid|unpaid|due|edit|delete|view|action|actions|details|-|n\/a)$/i.test(candidate) &&
                    !candidate.startsWith('৳') &&
                    !candidate.startsWith('$') &&
                    !candidate.match(refRegex)
                ) {
                    details.customerName = candidate;
                }
            }
        }
    }

    return details;
};

/**
 * Extract context identifier or name from modal / form element
 */
const extractContextFromModal = (modal) => {
    if (!modal) return null;

    // Check modal heading
    const heading = modal.querySelector('h1, h2, h3, h4, .modal-title, [data-modal-title]');
    if (heading) {
        const text = heading.innerText?.trim() || '';
        const match = text.match(/(?:Edit|Update|Delete)\s+[^:]+:\s*(.+)/i) || 
                      text.match(/(?:Edit|Update|Delete)\s+(.+)/i);
        if (match && match[1] && match[1].trim().length > 1) {
            const candidate = match[1].trim();
            if (!/^(record|entry|item|details)$/i.test(candidate)) {
                return candidate;
            }
        }
    }

    // Check relevant inputs
    const selector = 'input[name="name"], input[name="customerName"], input[name="supplierName"], input[name="importerName"], input[name="exporterName"], input[name="bankName"], input[name="productName"], input[name="warehouse"], input[name="accountNumber"], input[name="invoiceNo"], input[name="lcNo"], input[name="ipNumber"], input[name="poNumber"]';
    const namedInput = modal.querySelector(selector);
    if (namedInput && namedInput.value && namedInput.value.trim().length > 1) {
        return namedInput.value.trim();
    }

    // Fallback: first non-empty text input
    const textInputs = Array.from(modal.querySelectorAll('input[type="text"], input:not([type])'));
    for (const inp of textInputs) {
        if (inp.name === 'date' || inp.name === 'search' || inp.id?.includes('search')) continue;
        const val = inp.value?.trim();
        if (val && val.length >= 2 && val.length <= 50 && !/^\d+$/.test(val)) {
            return val;
        }
    }

    return null;
};

/**
 * Extract structured details from modal or form element
 */
const extractModalDetails = (clickable, modal) => {
    if (!modal && !clickable) return {};
    const details = {};

    const getAttr = (attr) => clickable?.getAttribute(attr) || modal?.getAttribute(attr);

    const customerName = getAttr('data-customer-name') || getAttr('data-customer') || getAttr('data-party-name');
    if (customerName) details.customerName = customerName.trim();

    const totalAmount = getAttr('data-total-amount') || getAttr('data-amount') || getAttr('data-total');
    if (totalAmount) details.totalAmount = totalAmount.trim();

    const invoiceNo = getAttr('data-invoice-no');
    if (invoiceNo) details.invoiceNo = invoiceNo.trim();

    const orderNo = getAttr('data-order-no');
    if (orderNo) details.orderNo = orderNo.trim();

    const receiptNo = getAttr('data-receipt-no') || getAttr('data-receipt');
    if (receiptNo) details.receiptNo = receiptNo.trim();

    const date = getAttr('data-date');
    if (date) details.date = date.trim();

    if (modal) {
        if (!details.customerName) {
            const custInput = modal.querySelector('input[name*="customer" i], input[name*="party" i], select[name*="customer" i]');
            if (custInput && custInput.value && custInput.value.trim().length > 1) {
                details.customerName = custInput.value.trim();
            } else if (custInput?.placeholder && !custInput.placeholder.includes('Search') && custInput.placeholder.trim().length > 1) {
                details.customerName = custInput.placeholder.trim();
            }
        }

        if (!details.totalAmount) {
            const amtInputs = Array.from(modal.querySelectorAll('input[name*="amount" i], input[name*="total" i], input[name*="paid" i], input[id*="amount" i], input[id*="total" i]'));
            let sumAmt = 0;
            let foundAny = false;
            for (const inp of amtInputs) {
                const val = parseFloat(inp.value);
                if (!isNaN(val) && val > 0) {
                    sumAmt += val;
                    foundAny = true;
                }
            }
            if (foundAny && sumAmt > 0) {
                details.totalAmount = String(sumAmt);
            }
        }

        if (!details.totalAmount) {
            const allText = modal.innerText || '';
            const match = allText.match(/(?:Total|Collection|Grand Total)[\s:]*[৳$]?\s*([\d,]+(?:\.\d{2})?)/i) ||
                          allText.match(/[৳$]\s*([\d,]+(?:\.\d{2})?)/);
            if (match) {
                const parsed = match[1].replace(/,/g, '');
                if (parseFloat(parsed) > 0) {
                    details.totalAmount = parsed;
                }
            }
        }
    }

    return details;
};

/**
 * Identify canonical action verb from element attributes or SVG icon
 */
const detectButtonVerb = (clickable, rawLabel) => {
    const l = (rawLabel || '').toLowerCase();
    
    // Explicit label matches
    if (/^(edit|edit record|edit original|revise)\b/i.test(l)) return 'Edit';
    if (/^(delete|trash|remove)\b/i.test(l)) return 'Delete';
    if (/^(view|preview|view details)\b/i.test(l)) return 'View';
    if (/^(save|save record|save changes)\b/i.test(l)) return 'Save';
    if (/^(update|update record)\b/i.test(l)) return 'Update';
    if (/^(submit|confirm)\b/i.test(l)) return 'Submit';
    if (/^(\+ new|\+ add|\+|new|add)\b/i.test(l)) return 'Create New';
    if (/^(accept|approve)\b/i.test(l)) return 'Accept';
    if (/^(reject|decline)\b/i.test(l)) return 'Reject';
    if (/^(download|export|excel|pdf)\b/i.test(l)) return 'Download';
    if (/^(print)\b/i.test(l)) return 'Print';

    // SVG Icon inspection (handles empty or icon-only buttons)
    const html = clickable.innerHTML || '';
    if (html.includes('16.5 3.5') || html.includes('M12 20h9') || clickable.querySelector('.lucide-pencil, .lucide-edit')) {
        return 'Edit';
    }
    if (html.includes('3 6 5 6 21 6') || html.includes('M19 6v14') || clickable.querySelector('.lucide-trash, .lucide-trash-2')) {
        return 'Delete';
    }
    if (html.includes('1 12s4-8') || clickable.querySelector('.lucide-eye')) {
        return 'View';
    }
    if (html.includes('x1="12" y1="5" x2="12" y2="19"') || clickable.querySelector('.lucide-plus')) {
        return 'Create New';
    }
    if (html.includes('20 6 9 17 4 12') || clickable.querySelector('.lucide-check')) {
        return 'Accept';
    }
    if (html.includes('18 6 6 18') || clickable.querySelector('.lucide-x')) {
        return 'Reject';
    }

    return null;
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
    // Only genuine programmatic APPROVAL calls with explicit action should become APPROVAL
    if (details.actionType === 'ACCEPT' || (details.action === 'ACCEPT' && details.actionCategory !== 'UI_CLICK')) {
        action = 'ACCEPT';
        actionCategory = 'APPROVAL';
        const inv = details.invoiceNo ? `Invoice #${details.invoiceNo}` : (details.orderNo ? `Order #${details.orderNo}` : '');
        const name = details.customerName || details.companyName || details.entityName || '';
        const namePart = name ? `("${name}")` : '';
        const refPart = inv ? `${inv} ` : '';
        description = description || `Accepted ${resolvedModule}: ${refPart}${namePart}`.replace(/:\s*$/, '').trim();
    } else if (details.actionType === 'REJECT' || (details.action === 'REJECT' && details.actionCategory !== 'UI_CLICK')) {
        action = 'REJECT';
        actionCategory = 'APPROVAL';
        const inv = details.invoiceNo ? `Invoice #${details.invoiceNo}` : (details.orderNo ? `Order #${details.orderNo}` : '');
        const name = details.customerName || details.companyName || details.entityName || '';
        const namePart = name ? `("${name}")` : '';
        const refPart = inv ? `${inv} ` : '';
        description = description || `Rejected ${resolvedModule}: ${refPart}${namePart}`.replace(/:\s*$/, '').trim();
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
        if (actionName && actionName.startsWith('User clicked')) {
            description = actionName.includes(' in ') ? actionName : `${actionName} in ${resolvedModule}`;
        } else {
            description = `User clicked "${actionName}" in ${resolvedModule}`;
        }
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
    getCurrentUser = userGetter || getCurrentUser;
    getCurrentView = viewGetter || getCurrentView;

    if (typeof window !== 'undefined' && window.__activityTrackerClickListener) {
        document.removeEventListener('click', window.__activityTrackerClickListener, true);
        window.__activityTrackerClickListener = null;
    }

    // Global click listener capturing meaningful user button clicks
    const clickHandler = (e) => {
        try {
            const user = getCurrentUser();
            if (!user) return;

            // Find closest clickable element
            const clickable = e.target.closest('button, a, [role="button"], input[type="submit"], input[type="checkbox"]');
            if (!clickable) return;

            // Ignore clicks inside sidebar navigation, main navigation bar, or header menus
            if (clickable.closest('aside, nav, [role="navigation"], header, .sidebar, #sidebar')) {
                return;
            }

            // Ignore clicks with data-ignore-action or inside option dropdowns/listboxes
            if (
                clickable.getAttribute('data-ignore-action') === 'true' ||
                clickable.closest('[data-dropdown], [data-ignore-action="true"], .dropdown-options, [role="listbox"], [role="option"]')
            ) {
                return;
            }

            // Ignore tab bar and filter toggles
            if (clickable.closest('[role="tab"], [role="tablist"], .tabs, .tab-buttons, .tab-nav')) {
                return;
            }

            // Read active view directly from closest DOM container if present
            const domView = clickable.closest('[data-current-view]')?.getAttribute('data-current-view');
            const curView = domView || getCurrentView();
            if (curView === 'log-section') return;

            const modName = viewToModuleName(curView);

            // Filter keywords for navigation and local view tabs
            const NAV_FILTER_KEYWORDS = new Set([
                'log', 'logs', 'activity log', 'requested', 'edit requested', 'all', 'stock', 'sale', 'sales',
                'general sale', 'border sale', 'order sale', 'payment collection', 'pay to customer',
                'collection & pay', 'customer', 'customers', 'supplier', 'suppliers', 'warehouse', 'damage', 'purchase',
                'purchase receive', 'hrms', 'employee', 'insurance', 'c&f', 'lc gate pass', 'lc expense',
                'margin return', 'return product', 'profit loss', 'cost of goods', 'backup & restore',
                'dashboard', 'settings', 'system access', 'role creation', 'notifications',
                'pending', 'complete', 'completed', 'active', 'inactive', 'approved', 'rejected',
                'summary', 'history', 'daily', 'monthly', 'yearly', 'today', 'sale request',
                'next', 'prev', 'previous'
            ]);

            const row = clickable.closest('tr, [data-row], [role="row"], li, .sale-mgmt-mobile-card');
            const rowDetails = extractRowDetails(clickable, row);

            const modal = clickable.closest('.modal, [role="dialog"], form, .fixed, .drawer, .card');
            const modalDetails = extractModalDetails(clickable, modal);
            const combinedDetails = { ...rowDetails, ...modalDetails };

            // Extract explicit data-action if set
            let label = clickable.getAttribute('data-action');

            // If not explicit, identify canonical verb & context
            if (!label) {
                const rawLabel = clickable.getAttribute('title') ||
                    clickable.getAttribute('aria-label') ||
                    clickable.innerText?.trim() ||
                    clickable.name ||
                    clickable.id || '';

                const cleanRaw = rawLabel.trim().toLowerCase();
                if (NAV_FILTER_KEYWORDS.has(cleanRaw) || /^(requested|edit requested)(\s+\d+)?$/i.test(cleanRaw)) {
                    return;
                }

                const verb = detectButtonVerb(clickable, rawLabel);

                if (verb === 'Edit' || verb === 'Delete' || verb === 'View' || verb === 'Accept' || verb === 'Reject') {
                    const context = extractContextFromRow(clickable, row);
                    label = context ? `${verb} ${modName} (${context})` : `${verb} ${modName}`;
                } else if (verb === 'Create New') {
                    label = `Create New ${modName}`;
                } else if (verb === 'Save' || verb === 'Update' || verb === 'Submit') {
                    const context = extractContextFromModal(modal);
                    let prefix = context ? `${verb} ${modName} (${context})` : `${verb} ${modName}`;
                    if (combinedDetails.totalAmount && !prefix.includes('৳')) {
                        const custPart = combinedDetails.customerName && !prefix.includes(combinedDetails.customerName) ? ` ("${combinedDetails.customerName}")` : '';
                        prefix = `${prefix}${custPart} • ৳${Number(combinedDetails.totalAmount).toLocaleString('en-IN')}`;
                    }
                    label = prefix;
                } else if (rawLabel) {
                    label = rawLabel;
                } else if (clickable.className && typeof clickable.className === 'string' && clickable.className.includes('close')) {
                    label = 'Close';
                }
            }

            if (!label || typeof label !== 'string') return;

            // Trim label and sanitize
            label = label.split('\n')[0].trim();
            const cleanLower = label.toLowerCase();
            if (NAV_FILTER_KEYWORDS.has(cleanLower) || /^(requested|edit requested)(\s+\d+)?$/i.test(cleanLower)) {
                return;
            }

            // Suppress redundant click tracking for Accept/Reject actions (the backend logs authoritative ACCEPT/REJECT mutation records)
            if (/^(Accept|Reject|Bulk Accept|Bulk Reject)\b/i.test(label) || label.includes('Accept Sale Request') || label.includes('Reject Sale Request')) {
                return;
            }

            if (label.length > 70) label = label.substring(0, 70) + '...';
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

            const isAddButton = /^(add|new|create)\b/i.test(label) || label.includes('Create New');
            const isCloseButton = /^(close|cancel|discard)\b/i.test(label) || clickable.className?.includes('close') || clickable.getAttribute('aria-label') === 'Close';
            const isSaveButton = /^(save|submit|confirm|update)\b/i.test(label) || label.includes('Save') || label.includes('Update');

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
                ...combinedDetails,
                tag: clickable.tagName.toLowerCase(),
                targetId: clickable.id || undefined,
                targetName: clickable.name || undefined
            });
        } catch (_err) {
            // Ignore click tracker errors
        }
    };

    window.__activityTrackerClickListener = clickHandler;
    document.addEventListener('click', clickHandler, true);

    // Flush on unload
    window.addEventListener('beforeunload', () => {
        if (actionQueue.length > 0) {
            flushQueue();
        }
    });
};
