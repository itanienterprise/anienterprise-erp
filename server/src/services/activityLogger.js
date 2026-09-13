const ActivityLog = require('../models/ActivityLog');

/**
 * Maps API routes to human-friendly ERP Module names
 */
const MODULE_PATH_MAP = [
    { pattern: /^\/api\/sales/i, module: 'Sales' },
    { pattern: /^\/api\/orders/i, module: 'Order' },
    { pattern: /^\/api\/pi/i, module: 'PI' },
    { pattern: /^\/api\/purchase-receives/i, module: 'Purchase Receive' },
    { pattern: /^\/api\/purchase/i, module: 'Purchase' },
    { pattern: /^\/api\/stock-baseline/i, module: 'Stock Baseline' },
    { pattern: /^\/api\/stock/i, module: 'Stock' },
    { pattern: /^\/api\/customers/i, module: 'Customer' },
    { pattern: /^\/api\/products/i, module: 'Product' },
    { pattern: /^\/api\/importers/i, module: 'Importer' },
    { pattern: /^\/api\/exporters/i, module: 'Exporter' },
    { pattern: /^\/api\/suppliers/i, module: 'Supplier' },
    { pattern: /^\/api\/ports/i, module: 'Port' },
    { pattern: /^\/api\/cnf-payments/i, module: 'C&F Payment' },
    { pattern: /^\/api\/cnfs/i, module: 'C&F' },
    { pattern: /^\/api\/warehouses/i, module: 'Warehouse' },
    { pattern: /^\/api\/damages/i, module: 'Damage' },
    { pattern: /^\/api\/banks/i, module: 'Bank' },
    { pattern: /^\/api\/insurance-payments/i, module: 'Insurance Payment' },
    { pattern: /^\/api\/insurances/i, module: 'Insurance' },
    { pattern: /^\/api\/lc-management/i, module: 'LC Management' },
    { pattern: /^\/api\/lc-expenses/i, module: 'LC Expense' },
    { pattern: /^\/api\/lc-gatepasses/i, module: 'LC GatePass' },
    { pattern: /^\/api\/returns/i, module: 'Return Product' },
    { pattern: /^\/api\/transfers/i, module: 'Stock Transfer' },
    { pattern: /^\/api\/cost-of-goods/i, module: 'Cost of Goods' },
    { pattern: /^\/api\/employees/i, module: 'HRMS / Employee' },
    { pattern: /^\/api\/users/i, module: 'User Management' },
    { pattern: /^\/api\/roles/i, module: 'Role Management' },
    { pattern: /^\/api\/login/i, module: 'Authentication' },
    { pattern: /^\/api\/logout/i, module: 'Authentication' },
    { pattern: /^\/api\/backup/i, module: 'Backup & Restore' },
    { pattern: /^\/api\/restore/i, module: 'Backup & Restore' },
    { pattern: /^\/api\/system-access/i, module: 'System Access' }
];

/**
 * Determine module from URL path
 */
const resolveModuleFromPath = (path) => {
    if (!path) return 'System';
    for (const item of MODULE_PATH_MAP) {
        if (item.pattern.test(path)) {
            return item.module;
        }
    }
    return 'System';
};

/**
 * Sanitize body so passwords and giant data are not stored in logs
 */
const sanitizePayload = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    try {
        const copy = JSON.parse(JSON.stringify(obj));
        const sensitiveKeys = ['password', 'confirmPassword', 'token', 'secret', 'signature'];
        
        const clean = (item) => {
            if (!item || typeof item !== 'object') return;
            for (const key of Object.keys(item)) {
                if (sensitiveKeys.includes(key.toLowerCase())) {
                    item[key] = '******';
                } else if (typeof item[key] === 'string' && item[key].length > 1000) {
                    item[key] = item[key].substring(0, 100) + '... [truncated]';
                } else if (typeof item[key] === 'object') {
                    clean(item[key]);
                }
            }
        };
        clean(copy);
        return copy;
    } catch (e) {
        return {};
    }
};

/**
 * Generate human-friendly description of the operation
 */
const generateOperationDescription = (method, path, module, body, statusCode) => {
    const isError = statusCode >= 400;
    const errorPrefix = isError ? '[FAILED] ' : '';

    const lowerPath = (path || '').toLowerCase();
    const idMatch = path ? path.match(/\/([a-f0-9]{24}|\d+)(?:[/?]|$)/i) : null;
    const targetId = idMatch ? idMatch[1] : null;

    // Check specific actions first
    if (lowerPath.includes('/login')) {
        const uname = body?.username || 'User';
        return isError ? `${errorPrefix}Failed login attempt for username "${uname}"` : `User "${uname}" logged in successfully`;
    }
    if (lowerPath.includes('/logout')) {
        return `User logged out`;
    }
    if (lowerPath.includes('/approve')) {
        return `${errorPrefix}Approved ${module} record ${targetId ? `(#${targetId.slice(-6)})` : ''}`.trim();
    }
    if (lowerPath.includes('/reject')) {
        return `${errorPrefix}Rejected ${module} request ${targetId ? `(#${targetId.slice(-6)})` : ''}`.trim();
    }
    if (lowerPath.includes('/restore')) {
        return `${errorPrefix}Restored database / ${module} backup`;
    }
    if (lowerPath.includes('/backup')) {
        return `${errorPrefix}Generated system database backup`;
    }

    // Identify useful fields from body
    const nameIdentifier = body?.name || body?.customerName || body?.productName || body?.employeeName || body?.title || body?.invoiceNo || body?.lcNo || body?.orderNo;

    switch (method.toUpperCase()) {
        case 'POST': {
            if (nameIdentifier) {
                return `${errorPrefix}Created new ${module}: "${nameIdentifier}"`;
            }
            return `${errorPrefix}Created new ${module} record`;
        }
        case 'PUT':
        case 'PATCH': {
            if (nameIdentifier) {
                return `${errorPrefix}Updated ${module}: "${nameIdentifier}" ${targetId ? `(#${targetId.slice(-6)})` : ''}`.trim();
            }
            return `${errorPrefix}Updated ${module} record ${targetId ? `(#${targetId.slice(-6)})` : ''}`.trim();
        }
        case 'DELETE': {
            return `${errorPrefix}Deleted ${module} record ${targetId ? `(#${targetId.slice(-6)})` : ''}`.trim();
        }
        default:
            return `${errorPrefix}Performed ${method} on ${module}`;
    }
};

/**
 * Determine action and actionCategory
 */
const resolveActionDetails = (method, path) => {
    const lowerPath = (path || '').toLowerCase();
    const m = (method || '').toUpperCase();

    if (lowerPath.includes('/login')) {
        return { action: 'LOGIN', category: 'AUTH' };
    }
    if (lowerPath.includes('/logout')) {
        return { action: 'LOGOUT', category: 'AUTH' };
    }
    if (lowerPath.includes('/approve') || lowerPath.includes('/1st-approve') || lowerPath.includes('/2nd-approve')) {
        return { action: 'APPROVE', category: 'APPROVAL' };
    }
    if (lowerPath.includes('/reject')) {
        return { action: 'REJECT', category: 'APPROVAL' };
    }
    if (lowerPath.includes('/request')) {
        return { action: 'REQUEST', category: 'APPROVAL' };
    }
    if (lowerPath.includes('/backup')) {
        return { action: 'BACKUP', category: 'SYSTEM' };
    }
    if (lowerPath.includes('/restore')) {
        return { action: 'RESTORE', category: 'MUTATION' };
    }

    if (m === 'POST') return { action: 'CREATE', category: 'MUTATION' };
    if (m === 'PUT' || m === 'PATCH') return { action: 'UPDATE', category: 'MUTATION' };
    if (m === 'DELETE') return { action: 'DELETE', category: 'MUTATION' };

    return { action: m, category: 'SYSTEM' };
};

/**
 * Log an activity to MongoDB asynchronously
 */
const logActivity = async (entry) => {
    try {
        const logDoc = new ActivityLog({
            timestamp: entry.timestamp || new Date(),
            userId: entry.userId || '',
            username: entry.username || 'System',
            userRole: entry.userRole || '',
            displayName: entry.displayName || '',
            module: entry.module || 'System',
            action: entry.action || 'OPERATION',
            actionCategory: entry.actionCategory || 'MUTATION',
            description: entry.description || 'System operation performed',
            details: entry.details || {},
            ip: entry.ip || '',
            userAgent: entry.userAgent || '',
            method: entry.method || '',
            path: entry.path || '',
            status: entry.status || 'SUCCESS'
        });

        await logDoc.save();
    } catch (err) {
        console.error('[ActivityLogger] Error saving log:', err.message);
    }
};

module.exports = {
    logActivity,
    resolveModuleFromPath,
    sanitizePayload,
    generateOperationDescription,
    resolveActionDetails
};
