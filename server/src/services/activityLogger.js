const ActivityLog = require('../models/ActivityLog');
const { decryptData } = require('../utils/encryption');

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
 * Determine module from URL path and payload
 */
const isEncryptedString = (val) => {
    if (typeof val !== 'string') return false;
    if (val.startsWith('U2FsdGVkX1')) return true;
    if (val.length > 50 && /^[A-Za-z0-9+/=]+$/.test(val) && !val.includes(' ')) return true;
    return false;
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

const resolveModuleFromPath = (path, body) => {
    if (!path) return 'System';
    const targetObj = resolvePayloadObject(body);

    // Border Sale vs Sales
    if (/^\/api\/sales/i.test(path)) {
        if (
            targetObj.saleType === 'Border' ||
            targetObj.isBorderSale === true ||
            (typeof targetObj.invoiceNo === 'string' && targetObj.invoiceNo.startsWith('BS'))
        ) {
            return 'Border Sale';
        }
        return 'Sales';
    }

    for (const item of MODULE_PATH_MAP) {
        if (item.pattern.test(path)) {
            return item.module;
        }
    }
    return 'System';
};

const HEAVY_KEYS = new Set([
    'saleshistory', 'paymenthistory', 'history', 'collections', 'backupdata',
    'data', 'allrecords', 'allsalesrecords', 'raw', 'buffer', 'image', 'photo',
    'base64', 'file', 'attachments'
]);

/**
 * Sanitize body so passwords, heavy collections, and giant data are not stored in logs
 */
const sanitizePayload = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    try {
        const copy = JSON.parse(JSON.stringify(obj));
        const sensitiveKeys = ['password', 'confirmPassword', 'token', 'secret', 'signature'];
        
        const clean = (item) => {
            if (!item || typeof item !== 'object') return;
            for (const key of Object.keys(item)) {
                const lowerKey = key.toLowerCase();
                if (sensitiveKeys.includes(lowerKey)) {
                    item[key] = '******';
                } else if (HEAVY_KEYS.has(lowerKey)) {
                    delete item[key];
                } else if (typeof item[key] === 'string' && item[key].length > 150) {
                    item[key] = item[key].substring(0, 100) + '... [truncated]';
                } else if (Array.isArray(item[key])) {
                    if (item[key].length > 4) {
                        item[key] = item[key].slice(0, 4);
                    }
                    for (const sub of item[key]) {
                        if (typeof sub === 'object') clean(sub);
                    }
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
    'updatedBy', 'payload', 'data', 'ciphertext', 'readbyusers', '_filledfields',
    'tag', 'view', 'targetid', 'targetname', 'targetroles', 'targetusers', 'isedited'
]);

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
    message: 'Message',
    approvedBy: 'Approved By',
    rejectedBy: 'Rejected By',
    closedBy: 'Closed By'
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
    if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) return '';
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

const extractFilledFields = (body, action) => {
    if (!body || typeof body !== 'object') return [];
    if (action === 'CLICK') return [];

    const targetObj = resolvePayloadObject(body);

    // For Accept and Approval actions, provide focused summary fields rather than dumping 35 database fields
    if (action === 'ACCEPT' || action === 'APPROVE') {
        const list = [];
        if (targetObj.invoiceNo) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(targetObj.invoiceNo) });
        const cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });
        if (targetObj.status) list.push({ field: 'status', label: 'Status', value: String(targetObj.status) });
        const by = targetObj.acceptedBy || targetObj.approvedByName || targetObj.approvedBy;
        if (by) list.push({ field: action === 'ACCEPT' ? 'acceptedBy' : 'approvedBy', label: action === 'ACCEPT' ? 'Accepted By' : 'Approved By', value: String(by) });
        if (targetObj.totalAmount) list.push({ field: 'totalAmount', label: 'Total Amount', value: formatFieldValue(targetObj.totalAmount) });
        return list;
    }

    // For Rejection actions
    if (action === 'REJECT') {
        const list = [];
        if (targetObj.invoiceNo) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(targetObj.invoiceNo) });
        if (targetObj.orderNo) list.push({ field: 'orderNo', label: 'Order No', value: String(targetObj.orderNo) });
        const cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });
        list.push({ field: 'status', label: 'Status', value: 'Rejected' });
        if (targetObj.rejectedBy) list.push({ field: 'rejectedBy', label: 'Rejected By', value: String(targetObj.rejectedBy) });
        if (targetObj.rejectionReason) list.push({ field: 'rejectionReason', label: 'Reason', value: String(targetObj.rejectionReason) });
        return list;
    }

    // For Card Open and Close actions
    if (action === 'CARD OPEN' || action === 'CARD CLOSE') {
        const list = [];
        if (targetObj.invoiceNo) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(targetObj.invoiceNo) });
        if (targetObj.orderNo) list.push({ field: 'orderNo', label: 'Order No', value: String(targetObj.orderNo) });
        const cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });
        list.push({ field: 'cardState', label: 'Card State', value: action === 'CARD OPEN' ? 'Opened' : 'Closed' });
        return list;
    }

    // For Close actions
    if (action === 'CLOSE') {
        const list = [];
        if (targetObj.invoiceNo || targetObj.orderNo || targetObj.lcNo) {
            list.push({ field: 'referenceNo', label: 'Reference No', value: String(targetObj.invoiceNo || targetObj.orderNo || targetObj.lcNo) });
        }
        list.push({ field: 'status', label: 'Status', value: 'Closed' });
        if (targetObj.closedBy) list.push({ field: 'closedBy', label: 'Closed By', value: String(targetObj.closedBy) });
        return list;
    }

    const list = [];
    for (const [key, val] of Object.entries(targetObj)) {
        if (key.startsWith('_')) continue;
        if (IGNORED_KEYS.has(key.toLowerCase())) continue;
        if (val === null || val === undefined || val === '') continue;
        if (isEncryptedString(val)) continue;
        if (typeof val === 'string' && /^[a-f0-9]{24}$/i.test(val)) continue;

        const formattedVal = formatFieldValue(val);
        if (!formattedVal) continue;
        if (isEncryptedString(formattedVal)) continue;
        if (/^[a-f0-9]{24}$/i.test(formattedVal)) continue;

        list.push({
            field: key,
            label: formatFieldLabel(key),
            value: formattedVal
        });
    }
    return list;
};

/**
 * Determine action and actionCategory with full payload context
 */
const resolveActionDetails = (method, path, body) => {
    const lowerPath = (path || '').toLowerCase();
    const m = (method || '').toUpperCase();
    const targetObj = resolvePayloadObject(body);

    if (lowerPath.includes('/login')) {
        return { action: 'LOGIN', category: 'AUTH' };
    }
    if (lowerPath.includes('/logout')) {
        return { action: 'LOGOUT', category: 'AUTH' };
    }
    if (lowerPath.includes('/backup')) {
        return { action: 'BACKUP', category: 'SYSTEM' };
    }
    if (lowerPath.includes('/restore')) {
        return { action: 'RESTORE', category: 'SYSTEM' };
    }

    // Accept Check
    if (
        lowerPath.includes('/accept') ||
        (typeof targetObj.status === 'string' && targetObj.status.toLowerCase().includes('accept')) ||
        targetObj.acceptedBy ||
        targetObj.acceptedByUsername
    ) {
        return { action: 'ACCEPT', category: 'APPROVAL' };
    }

    // Rejection Check
    if (
        lowerPath.includes('/reject') ||
        targetObj.rejectedBy ||
        targetObj.rejectionReason ||
        (typeof targetObj.status === 'string' && targetObj.status.toLowerCase().includes('reject'))
    ) {
        return { action: 'REJECT', category: 'APPROVAL' };
    }

    // Approval Check
    if (
        lowerPath.includes('/approve') ||
        lowerPath.includes('/1st-approve') ||
        lowerPath.includes('/2nd-approve') ||
        targetObj.approvedBy ||
        targetObj.approvedByName ||
        targetObj.firstApprovedBy ||
        targetObj.secondApprovedBy ||
        targetObj.smApprovedBy ||
        targetObj.editApprovedBy
    ) {
        return { action: 'APPROVE', category: 'APPROVAL' };
    }

    // Close Check
    if (
        lowerPath.includes('/close') ||
        targetObj.closedBy ||
        targetObj.isClosed === true ||
        (typeof targetObj.status === 'string' && ['closed', 'close'].includes(targetObj.status.toLowerCase()))
    ) {
        return { action: 'CLOSE', category: 'OPERATION' };
    }

    if (m === 'POST') return { action: 'CREATE', category: 'MUTATION' };
    if (m === 'PUT' || m === 'PATCH') return { action: 'UPDATE', category: 'MUTATION' };
    if (m === 'DELETE') return { action: 'DELETE', category: 'MUTATION' };

    return { action: m, category: 'GENERAL' };
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
    if (lowerPath.includes('/restore')) {
        return `${errorPrefix}Restored database / ${module} backup`;
    }
    if (lowerPath.includes('/backup')) {
        return `${errorPrefix}Generated system database backup`;
    }

    const targetObj = resolvePayloadObject(body);
    const { action } = resolveActionDetails(method, path, body);

    const nameIdentifier = targetObj.customerName || targetObj.name || targetObj.companyName || 
        targetObj.productName || targetObj.employeeName || targetObj.supplierName || targetObj.importerName || 
        targetObj.exporterName || targetObj.bankName || targetObj.title || targetObj.invoiceNo || 
        targetObj.lcNo || targetObj.orderNo || targetObj.challanNo || targetObj.piNo || targetObj.truckNo;

    // ACCEPT
    if (action === 'ACCEPT') {
        const inv = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` : targetObj.orderNo ? `Order #${targetObj.orderNo}` : (targetId ? `(#${targetId.slice(-6)})` : '');
        const namePart = nameIdentifier && nameIdentifier !== targetObj.invoiceNo ? `("${nameIdentifier}")` : '';
        const by = targetObj.acceptedBy || targetObj.approvedByName || targetObj.approvedBy;
        const byPart = by ? ` by ${by}` : '';
        return `${errorPrefix}Accepted ${module}: ${inv} ${namePart}${byPart}`.replace(/\s+/g, ' ').trim();
    }

    // APPROVE
    if (action === 'APPROVE') {
        const inv = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` : targetObj.orderNo ? `Order #${targetObj.orderNo}` : targetObj.lcNo ? `LC #${targetObj.lcNo}` : (targetId ? `(#${targetId.slice(-6)})` : '');
        const namePart = nameIdentifier && nameIdentifier !== targetObj.invoiceNo ? `("${nameIdentifier}")` : '';
        const by = targetObj.approvedByName || targetObj.approvedBy || targetObj.acceptedBy;
        const byPart = by ? ` by ${by}` : '';
        return `${errorPrefix}Approved ${module}: ${inv} ${namePart}${byPart}`.replace(/\s+/g, ' ').trim();
    }

    // REJECT
    if (action === 'REJECT') {
        const inv = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` : targetObj.orderNo ? `Order #${targetObj.orderNo}` : (targetId ? `(#${targetId.slice(-6)})` : '');
        const namePart = nameIdentifier && nameIdentifier !== targetObj.invoiceNo ? `("${nameIdentifier}")` : '';
        const reason = targetObj.rejectionReason ? ` (Reason: "${targetObj.rejectionReason}")` : '';
        const by = targetObj.rejectedBy;
        const byPart = by ? ` by ${by}` : '';
        return `${errorPrefix}Rejected ${module}: ${inv} ${namePart}${reason}${byPart}`.replace(/\s+/g, ' ').trim();
    }

    // CARD OPEN
    if (action === 'CARD OPEN') {
        const inv = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` : '';
        const namePart = nameIdentifier ? `("${nameIdentifier}")` : '';
        return `${errorPrefix}Opened card: ${inv} ${namePart} in ${module}`.replace(/\s+/g, ' ').trim();
    }

    // CARD CLOSE
    if (action === 'CARD CLOSE') {
        const inv = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` : '';
        const namePart = nameIdentifier ? `("${nameIdentifier}")` : '';
        return `${errorPrefix}Closed card: ${inv} ${namePart} in ${module}`.replace(/\s+/g, ' ').trim();
    }

    // CLOSE
    if (action === 'CLOSE') {
        const inv = targetObj.invoiceNo || targetObj.orderNo || targetObj.lcNo ? `#${targetObj.invoiceNo || targetObj.orderNo || targetObj.lcNo}` : (targetId ? `(#${targetId.slice(-6)})` : '');
        const namePart = nameIdentifier ? `("${nameIdentifier}")` : '';
        return `${errorPrefix}Closed ${module} ${inv} ${namePart}`.trim();
    }

    const filledFields = extractFilledFields(body, action);

    // Build human-friendly string of filled fields
    const filledSummary = filledFields
        .filter(f => f.value !== nameIdentifier && f.field !== 'password' && !isEncryptedString(f.value))
        .slice(0, 6)
        .map(f => `${f.label}: "${f.value}"`)
        .join(', ');

    switch (method.toUpperCase()) {
        case 'POST': {
            let desc = `${errorPrefix}Created new ${module}`;
            const refNo = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` :
                targetObj.orderNo ? `Order #${targetObj.orderNo}` :
                targetObj.lcNo ? `LC #${targetObj.lcNo}` :
                targetObj.piNo ? `PI #${targetObj.piNo}` :
                targetObj.challanNo ? `Challan #${targetObj.challanNo}` : null;
            const entityName = targetObj.customerName || targetObj.companyName || targetObj.name || 
                targetObj.productName || targetObj.employeeName || targetObj.supplierName || 
                targetObj.importerName || targetObj.exporterName || targetObj.bankName;
            const codeId = targetObj.customerId ? `ID: ${targetObj.customerId}` :
                targetObj.employeeId ? `ID: ${targetObj.employeeId}` :
                targetObj.productId ? `Code: ${targetObj.productId}` : null;

            if (refNo && entityName) {
                desc += `: ${refNo} ("${entityName}")`;
            } else if (refNo) {
                desc += `: ${refNo}`;
            } else if (entityName && codeId) {
                desc += `: "${entityName}" (${codeId})`;
            } else if (entityName) {
                desc += `: "${entityName}"`;
            } else if (nameIdentifier) {
                desc += `: "${nameIdentifier}"`;
            }
            return desc;
        }
        case 'PUT':
        case 'PATCH': {
            let desc = `${errorPrefix}Updated ${module}`;
            const refNo = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` :
                targetObj.orderNo ? `Order #${targetObj.orderNo}` :
                targetObj.lcNo ? `LC #${targetObj.lcNo}` :
                targetObj.piNo ? `PI #${targetObj.piNo}` :
                targetObj.challanNo ? `Challan #${targetObj.challanNo}` : null;
            const entityName = targetObj.customerName || targetObj.companyName || targetObj.name || 
                targetObj.productName || targetObj.employeeName || targetObj.supplierName || 
                targetObj.importerName || targetObj.exporterName || targetObj.bankName;
            const codeId = targetObj.customerId ? `ID: ${targetObj.customerId}` :
                targetObj.employeeId ? `ID: ${targetObj.employeeId}` :
                targetObj.productId ? `Code: ${targetObj.productId}` : null;

            if (refNo && entityName) {
                desc += `: ${refNo} ("${entityName}")`;
            } else if (refNo) {
                desc += `: ${refNo}`;
            } else if (entityName && codeId) {
                desc += `: "${entityName}" (${codeId})`;
            } else if (entityName) {
                desc += `: "${entityName}"`;
            } else if (nameIdentifier) {
                desc += `: "${nameIdentifier}"`;
            } else if (targetId) {
                desc += ` (#${targetId.slice(-6)})`;
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
 * Log an activity to MongoDB asynchronously
 */
const logActivity = async (entry) => {
    try {
        if (!entry) return;
        // Never log notifications
        if (
            entry.module === 'Notification' ||
            (entry.path && entry.path.includes('/notifications')) ||
            (entry.description && /notification/i.test(entry.description))
        ) {
            return;
        }

        let cleanDetails = sanitizePayload(entry.details || {});

        // Strict storage size guard: if serialized details exceed 2500 bytes, prune down to essentials
        try {
            const rawStr = JSON.stringify(cleanDetails);
            if (rawStr.length > 2500) {
                const essentialKeys = [
                    '_id', 'id', 'invoiceNo', 'orderNo', 'lcNo', 'billNo', 'challanNo',
                    'customerName', 'companyName', 'supplierName', 'employeeName', 'productName',
                    'name', 'phone', 'totalAmount', 'grandTotal', 'amount', 'paidAmount', 'dueAmount',
                    'status', 'view', 'tag', '_filledFields', '_updatedFields'
                ];
                const pruned = {};
                for (const key of essentialKeys) {
                    if (cleanDetails[key] !== undefined) {
                        pruned[key] = cleanDetails[key];
                    }
                }
                pruned._truncated = true;
                cleanDetails = pruned;
            }
        } catch (e) {
            cleanDetails = {};
        }

        // Limit filled/updated field diffs to max 15 to avoid massive arrays
        if (Array.isArray(cleanDetails._filledFields) && cleanDetails._filledFields.length > 15) {
            cleanDetails._filledFields = cleanDetails._filledFields.slice(0, 15);
            cleanDetails._filledFields.push({ field: 'more', label: '...and more items', value: '' });
        }
        if (Array.isArray(cleanDetails._updatedFields) && cleanDetails._updatedFields.length > 15) {
            cleanDetails._updatedFields = cleanDetails._updatedFields.slice(0, 15);
            cleanDetails._updatedFields.push({ field: 'more', label: '...and more changes', value: '' });
        }

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
            details: cleanDetails,
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

/**
 * Compare previous document against new updated payload to extract ONLY changed fields
 */
const computeUpdatedFields = (oldDoc, newDoc) => {
    if (!newDoc || typeof newDoc !== 'object') return [];
    if (!oldDoc || typeof oldDoc !== 'object') return [];

    const resolvedOld = resolvePayloadObject(oldDoc);
    const resolvedNew = resolvePayloadObject(newDoc);

    const ignoreKeys = new Set([
        '_id', '__v', 'id', 'createdat', 'updatedat', 'user', 'userid',
        'createdby', 'updatedby', 'payload', 'data', 'ciphertext',
        'token', 'secret', 'signature', '_filledfields', '_updatedfields',
        'isedited', 'editedby', 'editedbyname', 'editedbyusername',
        'requestedby', 'requestedbyusername', 'status', 'saletype', 'view', 'targetid'
    ]);

    const changes = [];

    for (const [key, newVal] of Object.entries(resolvedNew)) {
        if (key.startsWith('_')) continue;
        if (ignoreKeys.has(key.toLowerCase())) continue;
        if (isEncryptedString(newVal)) continue;
        if (typeof newVal === 'string' && /^[a-f0-9]{24}$/i.test(newVal)) continue;

        const oldVal = resolvedOld[key];

        // Items array comparison (for Sales, Purchases, Orders, etc.)
        if (key === 'items' && Array.isArray(newVal)) {
            const oldItems = Array.isArray(oldVal) ? oldVal : [];
            let qtyChanged = false;
            let rateChanged = false;
            let itemsChanged = false;
            let newRateVal = null;
            let newQtyVal = null;

            if (newVal.length !== oldItems.length) {
                itemsChanged = true;
            } else {
                for (let i = 0; i < newVal.length; i++) {
                    const ni = newVal[i] || {};
                    const oi = oldItems[i] || {};
                    if (ni.productName !== oi.productName) itemsChanged = true;

                    const nBrands = ni.brandEntries || [];
                    const oBrands = oi.brandEntries || [];
                    if (nBrands.length !== oBrands.length) itemsChanged = true;

                    for (let b = 0; b < nBrands.length; b++) {
                        const nb = nBrands[b] || {};
                        const ob = oBrands[b] || {};
                        const nP = nb.unitPrice ?? nb.rate;
                        const oP = ob.unitPrice ?? ob.rate;
                        if (nP !== undefined && String(nP).trim() !== String(oP ?? '').trim()) {
                            rateChanged = true;
                            newRateVal = nP;
                        }
                        if (nb.quantity !== undefined && String(nb.quantity).trim() !== String(ob.quantity ?? '').trim()) {
                            qtyChanged = true;
                            newQtyVal = nb.quantity;
                        }
                        if (nb.brand !== ob.brand || nb.warehouseName !== ob.warehouseName) itemsChanged = true;
                    }
                }
            }

            if (rateChanged) {
                changes.push({
                    field: 'unitPrice',
                    label: 'Price',
                    value: `৳${parseFloat(newRateVal || 0).toLocaleString('en-IN')}`
                });
            }
            if (qtyChanged) {
                changes.push({
                    field: 'quantity',
                    label: 'Quantity',
                    value: parseFloat(newQtyVal || 0).toLocaleString()
                });
            }
            if (itemsChanged && !qtyChanged && !rateChanged) {
                changes.push({ field: 'items', label: 'Products', value: `${newVal.length} item${newVal.length > 1 ? 's' : ''}` });
            }
            continue;
        }

        // Generic Array comparison
        if (Array.isArray(newVal)) {
            const oldArr = Array.isArray(oldVal) ? oldVal : [];
            if (JSON.stringify(newVal) !== JSON.stringify(oldArr)) {
                changes.push({
                    field: key,
                    label: formatFieldLabel(key),
                    value: `${newVal.length} item${newVal.length !== 1 ? 's' : ''}`
                });
            }
            continue;
        }

        // Generic Object comparison
        if (typeof newVal === 'object' && newVal !== null) {
            if (JSON.stringify(newVal) !== JSON.stringify(oldVal || {})) {
                changes.push({
                    field: key,
                    label: formatFieldLabel(key),
                    value: formatFieldValue(newVal)
                });
            }
            continue;
        }

        // Primitive comparison
        const strOld = (oldVal === null || oldVal === undefined) ? '' : String(oldVal).trim();
        const strNew = (newVal === null || newVal === undefined) ? '' : String(newVal).trim();

        if (strOld !== strNew) {
            const formatted = formatFieldValue(newVal);
            if (formatted) {
                changes.push({
                    field: key,
                    label: formatFieldLabel(key),
                    value: formatted
                });
            }
        }
    }

    return changes;
};

module.exports = {
    logActivity,
    resolveModuleFromPath,
    sanitizePayload,
    generateOperationDescription,
    resolveActionDetails,
    extractFilledFields,
    computeUpdatedFields
};
