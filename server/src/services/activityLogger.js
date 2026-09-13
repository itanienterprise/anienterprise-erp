const ActivityLog = require('../models/ActivityLog');
const { decryptData } = require('../utils/encryption');

/**
 * Maps API routes to human-friendly ERP Module names
 */
const MODULE_PATH_MAP = [
    { pattern: /^\/api\/notifications/i, module: 'Notification' },
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

const IGNORED_KEYS = new Set([
    '_id', '__v', 'id', 'password', 'confirmPassword', 'token', 'secret',
    'signature', 'createdAt', 'updatedAt', 'user', 'userId', 'createdBy',
    'updatedBy', 'payload', 'data', 'ciphertext', 'readbyusers'
]);

const isEncryptedString = (val) => {
    if (typeof val !== 'string') return false;
    if (val.startsWith('U2FsdGVkX1')) return true;
    if (val.length > 50 && /^[A-Za-z0-9+/=]+$/.test(val) && !val.includes(' ')) return true;
    return false;
};

const FIELD_LABEL_MAP = {
    customerName: 'Customer Name',
    companyName: 'Company Name',
    productName: 'Product Name',
    employeeName: 'Employee Name',
    supplierName: 'Supplier Name',
    importerName: 'Importer Name',
    exporterName: 'Exporter Name',
    contactPerson: 'Contact Person',
    name: 'Name',
    phone: 'Phone',
    mobile: 'Mobile',
    email: 'Email',
    address: 'Address',
    location: 'Location',
    customerType: 'Customer Type',
    role: 'Role',
    designation: 'Designation',
    department: 'Department',
    salary: 'Salary',
    status: 'Status',
    rate: 'Rate',
    price: 'Price',
    unitPrice: 'Unit Price',
    totalPrice: 'Total Price',
    totalAmount: 'Total Amount',
    paidAmount: 'Paid Amount',
    dueAmount: 'Due Amount',
    balance: 'Balance',
    openingBalance: 'Opening Balance',
    quantity: 'Quantity',
    qty: 'Quantity',
    stock: 'Stock',
    warehouse: 'Warehouse',
    lcNo: 'LC No',
    piNo: 'PI No',
    invoiceNo: 'Invoice No',
    orderNo: 'Order No',
    challanNo: 'Challan No',
    truckNo: 'Truck No',
    gatePassNo: 'Gate Pass No',
    importer: 'Importer',
    exporter: 'Exporter',
    supplier: 'Supplier',
    customer: 'Customer',
    bank: 'Bank',
    bankName: 'Bank Name',
    branch: 'Branch',
    accountNo: 'Account No',
    accountType: 'Account Type',
    paymentMethod: 'Payment Method',
    paymentType: 'Payment Type',
    amount: 'Amount',
    remarks: 'Remarks',
    description: 'Description',
    note: 'Note',
    uom: 'UOM',
    category: 'Category',
    date: 'Date',
    title: 'Title',
    message: 'Message'
};

const formatFieldLabel = (key) => {
    if (FIELD_LABEL_MAP[key]) return FIELD_LABEL_MAP[key];
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^./, s => s.toUpperCase())
        .trim();
};

const formatFieldValue = (val) => {
    if (val === null || val === undefined) return '';
    if (isEncryptedString(val)) return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return val.toLocaleString();
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
        if (val.length === 0) return '';
        if (typeof val[0] === 'object') {
            return `${val.length} item${val.length > 1 ? 's' : ''}`;
        }
        return val.join(', ');
    }
    if (typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length === 0) return '';
        return JSON.stringify(val);
    }
    return String(val);
};

const resolvePayloadObject = (body) => {
    if (!body || typeof body !== 'object') return {};

    // Check if body.data is an encrypted ciphertext string
    if (typeof body.data === 'string' && isEncryptedString(body.data)) {
        try {
            const dec = decryptData(body.data);
            if (dec && typeof dec === 'object') return dec;
        } catch (e) {}
    }

    // Check if body.payload is an encrypted ciphertext string
    if (typeof body.payload === 'string' && isEncryptedString(body.payload)) {
        try {
            const dec = decryptData(body.payload);
            if (dec && typeof dec === 'object') return dec;
        } catch (e) {}
    }

    // Check if body.data is a nested object
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
        return body.data;
    }

    return body;
};

const extractFilledFields = (body) => {
    if (!body || typeof body !== 'object') return [];
    
    const targetObj = resolvePayloadObject(body);

    const list = [];
    for (const [key, val] of Object.entries(targetObj)) {
        if (key.startsWith('_')) continue;
        if (IGNORED_KEYS.has(key.toLowerCase())) continue;
        if (val === null || val === undefined || val === '') continue;
        if (isEncryptedString(val)) continue;

        const formattedVal = formatFieldValue(val);
        if (!formattedVal) continue;
        if (isEncryptedString(formattedVal)) continue;

        list.push({
            field: key,
            label: formatFieldLabel(key),
            value: formattedVal
        });
    }
    return list;
};

/**
 * Generate human-friendly description of the operation with full field details
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
    if (lowerPath.includes('/notifications')) {
        if (lowerPath.includes('/clear')) {
            return `${errorPrefix}Cleared all notifications`;
        }
        if (method.toUpperCase() === 'PUT') {
            return `${errorPrefix}Marked notification as read ${targetId ? `(#${targetId.slice(-6)})` : ''}`.trim();
        }
        if (method.toUpperCase() === 'POST') {
            const targetObj = resolvePayloadObject(body);
            const notifTitle = targetObj?.title || targetObj?.message || 'Notification';
            return `${errorPrefix}Created notification: "${notifTitle}"`;
        }
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

    const targetObj = resolvePayloadObject(body);

    const filledFields = extractFilledFields(body);
    const nameIdentifier = targetObj.name || targetObj.customerName || targetObj.companyName || 
        targetObj.productName || targetObj.employeeName || targetObj.supplierName || targetObj.importerName || 
        targetObj.exporterName || targetObj.bankName || targetObj.title || targetObj.invoiceNo || 
        targetObj.lcNo || targetObj.orderNo || targetObj.challanNo || targetObj.piNo || targetObj.truckNo;

    // Build human-friendly string of filled fields
    const filledSummary = filledFields
        .filter(f => f.value !== nameIdentifier && f.field !== 'password' && !isEncryptedString(f.value))
        .slice(0, 6)
        .map(f => `${f.label}: "${f.value}"`)
        .join(', ');

    switch (method.toUpperCase()) {
        case 'POST': {
            let desc = `${errorPrefix}Created new ${module}`;
            if (nameIdentifier) {
                desc += `: "${nameIdentifier}"`;
            }
            if (filledSummary) {
                desc += ` (Filled: ${filledSummary})`;
            }
            return desc;
        }
        case 'PUT':
        case 'PATCH': {
            let desc = `${errorPrefix}Updated ${module}`;
            if (nameIdentifier) {
                desc += `: "${nameIdentifier}"`;
            } else if (targetId) {
                desc += ` (#${targetId.slice(-6)})`;
            }
            if (filledSummary) {
                desc += ` (Updated: ${filledSummary})`;
            }
            return desc;
        }
        case 'DELETE': {
            const idHint = nameIdentifier ? `"${nameIdentifier}"` : targetId ? `(#${targetId.slice(-6)})` : '';
            return `${errorPrefix}Deleted ${module} record ${idHint}`.trim();
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
    resolveActionDetails,
    extractFilledFields
};
