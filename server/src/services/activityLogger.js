const ActivityLog = require('../models/ActivityLog');
const { decryptData } = require('../utils/encryption');

/**
 * Maps API routes to human-friendly ERP Module names
 */
const MODULE_PATH_MAP = [
    { pattern: /^\/api\/sales/i, module: 'Sales' },
    { pattern: /^\/api\/orders/i, module: 'Order' },
    { pattern: /^\/api\/pi/i, module: 'PI' },
    { pattern: /^\/api\/ip-records/i, module: 'IP' },
    { pattern: /^\/api\/packing-lists/i, module: 'Packing List' },
    { pattern: /^\/api\/tr-setups/i, module: 'TR Setup' },
    { pattern: /^\/api\/margin-returns/i, module: 'Margin Return' },
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
    { pattern: /^\/api\/insurances?/i, module: 'Insurance' },
    { pattern: /^\/api\/lc-management/i, module: 'LC Management' },
    { pattern: /^\/api\/lc-expenses/i, module: 'LC Expense' },
    { pattern: /^\/api\/lc-(?:gp|gatepasses)/i, module: 'LC GatePass' },
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
    { pattern: /^\/api\/system-access/i, module: 'System Access' },
    { pattern: /^\/api\/metadata/i, module: 'Settings / Metadata' }
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

    let result = body;

    // Check if body.data is an encrypted ciphertext string
    if (typeof body.data === 'string' && isEncryptedString(body.data)) {
        try {
            const dec = decryptData(body.data);
            if (dec && typeof dec === 'object') {
                result = { ...dec };
                if (body.category) result.category = body.category;
            }
        } catch (e) {}
    } else if (typeof body.payload === 'string' && isEncryptedString(body.payload)) {
        try {
            const dec = decryptData(body.payload);
            if (dec && typeof dec === 'object') {
                result = { ...dec };
                if (body.category) result.category = body.category;
            }
        } catch (e) {}
    } else if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
        result = { ...body.data };
        if (body.category) result.category = body.category;
    }

    if (body.category && !result.category) {
        result.category = body.category;
    }

    return result;
};

const resolveModuleFromPath = (path, body) => {
    if (!path) return 'System';
    const targetObj = resolvePayloadObject(body);

    // C&F Commission update vs Border Sale vs Sales
    if (targetObj.isCnfCommissionUpdate === true || targetObj.cnfName) {
        return 'C&F';
    }
    if (/^\/api\/sales/i.test(path)) {
        if (targetObj.saleType === 'Border' || targetObj.isBorderSale === true) {
            return 'Border Sale';
        }
        if (targetObj.saleType === 'General') {
            return 'General Sale';
        }
        if (targetObj.saleType === 'Order') {
            return 'Order Sale';
        }
        if (typeof targetObj.invoiceNo === 'string') {
            if (targetObj.invoiceNo.startsWith('BS')) return 'Border Sale';
            if (targetObj.invoiceNo.startsWith('GS')) return 'General Sale';
            if (targetObj.invoiceNo.startsWith('ORD')) return 'Order Sale';
        }
        if (typeof targetObj.orderNo === 'string' && targetObj.orderNo.length > 0) {
            return 'Order Sale';
        }
        return 'General Sale';
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
    'base64', 'file', 'attachments', 'attachment', 'ipattachment', 'filedata',
    'filecontent', 'pdf', 'document', 'doc', 'avatar', 'receiptfile'
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
    lcNumber: 'LC No',
    piNo: 'PI No',
    piNumber: 'PI No',
    piNumbers: 'PI No',
    invoiceNo: 'Invoice No',
    invoiceNumber: 'Invoice No',
    orderNo: 'Order No',
    orderNumber: 'Order No',
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
    accountName: 'Account Name',
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
    closedBy: 'Closed By',
    productsList: 'Products',
    ipNumbers: 'IP Numbers',
    ipNumber: 'IP Number',
    referenceNo: 'Reference No',
    ipParty: 'IP Party / Importer',
    openingDate: 'Opening Date',
    closeDate: 'Expiry Date',
    remainingQuantity: 'Remaining Qty',
    isExtended: 'Extended',
    ipAttachmentName: 'Attachment',
    grandTotalQuantity: 'Grand Total Quantity',
    grandTotal: 'Grand Total',
    piRevision: 'Revision',
    reviseNo: 'Revise No',
    reviseDate: 'Revise Date',
    revisions: 'Revisions',
    indCommissionRate: 'Indian Commission Rate',
    indCommissionUom: 'Indian Commission UOM',
    indCommissionTotal: 'Indian Commission Total',
    bdCommissionRate: 'BD Commission Rate',
    bdCommissionUom: 'BD Commission UOM',
    bdCommissionTotal: 'BD Commission Total',
    indCnFComm: 'Indian C&F Rate',
    indCnFCost: 'Indian C&F Total',
    indCnFUom: 'Indian C&F UOM',
    bdCnFComm: 'BD C&F Rate',
    bdCnFCost: 'BD C&F Total',
    bdCnFUom: 'BD C&F UOM'
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

    // For DELETE actions, provide focused identification fields of the deleted record
    if (action === 'DELETE') {
        const list = [];
        if (targetObj.invoiceNo) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(targetObj.invoiceNo) });
        if (targetObj.orderNo) list.push({ field: 'orderNo', label: 'Order No', value: String(targetObj.orderNo) });
        if (targetObj.lcNo) list.push({ field: 'lcNo', label: 'LC No', value: String(targetObj.lcNo) });
        if (targetObj.ipNumber || targetObj.ipNo) list.push({ field: 'ipNumber', label: 'IP Number', value: String(targetObj.ipNumber || targetObj.ipNo) });
        if (targetObj.employeeId) list.push({ field: 'employeeId', label: 'Employee ID', value: String(targetObj.employeeId) });
        if (targetObj.customerId) list.push({ field: 'customerId', label: 'Customer ID', value: String(targetObj.customerId) });
        if (targetObj.productId) list.push({ field: 'productId', label: 'Product Code', value: String(targetObj.productId) });
        if (targetObj.accountNumber || targetObj.accountNo) list.push({ field: 'accountNumber', label: 'Account No', value: String(targetObj.accountNumber || targetObj.accountNo) });
        if (targetObj.warehouse) list.push({ field: 'warehouse', label: 'Warehouse', value: String(targetObj.warehouse) });
        if (targetObj.damageNo) list.push({ field: 'damageNo', label: 'Damage No', value: String(targetObj.damageNo) });

        const nameVal = targetObj.name || targetObj.customerName || targetObj.supplierName || targetObj.importerName || targetObj.exporterName || targetObj.bankName || targetObj.employeeName || targetObj.companyName || targetObj.productName || targetObj.value || targetObj.label;
        if (nameVal) list.push({ field: 'name', label: targetObj.value ? 'Item / Value' : 'Name', value: String(nameVal) });

        if (targetObj.category) list.push({ field: 'category', label: 'Category', value: String(targetObj.category) });
        if (targetObj.designation) list.push({ field: 'designation', label: 'Designation', value: String(targetObj.designation) });
        if (targetObj.department) list.push({ field: 'department', label: 'Department', value: String(targetObj.department) });
        if (targetObj.phone) list.push({ field: 'phone', label: 'Phone', value: String(targetObj.phone) });
        if (targetObj.role) list.push({ field: 'role', label: 'Role', value: String(targetObj.role) });
        if (targetObj.totalAmount) list.push({ field: 'totalAmount', label: 'Total Amount', value: formatFieldValue(targetObj.totalAmount) });
        return list;
    }

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
const resolveActionDetails = (method, path, body, previousDocSnapshot) => {
    const lowerPath = (path || '').toLowerCase();
    const m = (method || '').toUpperCase();
    const targetObj = resolvePayloadObject(body);
    const prevObj = resolvePayloadObject(previousDocSnapshot);

    // Explicit UPDATE override (e.g. C&F commission update, or explicit actionType)
    if (
        targetObj.isCnfCommissionUpdate === true ||
        targetObj.actionType === 'UPDATE' ||
        targetObj.action === 'UPDATE'
    ) {
        return { action: 'UPDATE', category: 'MUTATION' };
    }

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

    // Accept Check: Genuine accept transition only
    const wasAlreadyAccepted = prevObj && (
        (typeof prevObj.status === 'string' && prevObj.status.toLowerCase().includes('accept')) ||
        prevObj.acceptedBy ||
        prevObj.acceptedByUsername
    );
    const isExplicitAccept = lowerPath.includes('/accept') || targetObj.actionType === 'ACCEPT' || targetObj.action === 'ACCEPT';
    const isTransitionToAccept = !wasAlreadyAccepted && (
        (typeof targetObj.status === 'string' && targetObj.status.toLowerCase().includes('accept')) ||
        (targetObj.acceptedBy && !prevObj?.acceptedBy) ||
        (targetObj.acceptedByUsername && !prevObj?.acceptedByUsername)
    );

    if (isExplicitAccept || isTransitionToAccept) {
        return { action: 'ACCEPT', category: 'APPROVAL' };
    }

    // Rejection Check
    const wasAlreadyRejected = prevObj && (
        (typeof prevObj.status === 'string' && prevObj.status.toLowerCase().includes('reject')) ||
        prevObj.rejectedBy
    );
    const isExplicitReject = lowerPath.includes('/reject') || targetObj.actionType === 'REJECT' || targetObj.action === 'REJECT';
    const isTransitionToReject = !wasAlreadyRejected && (
        (typeof targetObj.status === 'string' && targetObj.status.toLowerCase().includes('reject')) ||
        (targetObj.rejectedBy && !prevObj?.rejectedBy) ||
        (targetObj.rejectionReason && !prevObj?.rejectionReason)
    );

    if (isExplicitReject || isTransitionToReject) {
        return { action: 'REJECT', category: 'APPROVAL' };
    }

    // Approval Check
    const wasAlreadyApproved = prevObj && (
        (typeof prevObj.status === 'string' && prevObj.status.toLowerCase().includes('approve')) ||
        prevObj.approvedBy ||
        prevObj.approvedByName
    );
    const isExplicitApprove = lowerPath.includes('/approve') || lowerPath.includes('/1st-approve') || lowerPath.includes('/2nd-approve') || targetObj.actionType === 'APPROVE' || targetObj.action === 'APPROVE';
    const isTransitionToApprove = !wasAlreadyApproved && (
        (targetObj.approvedBy && !prevObj?.approvedBy) ||
        (targetObj.approvedByName && !prevObj?.approvedByName) ||
        (targetObj.firstApprovedBy && !prevObj?.firstApprovedBy) ||
        (targetObj.secondApprovedBy && !prevObj?.secondApprovedBy) ||
        (targetObj.editApprovedBy && !prevObj?.editApprovedBy)
    );

    if (isExplicitApprove || isTransitionToApprove) {
        return { action: 'APPROVE', category: 'APPROVAL' };
    }

    // Close Check
    const wasAlreadyClosed = prevObj && (
        prevObj.closedBy ||
        prevObj.isClosed === true ||
        (typeof prevObj.status === 'string' && ['closed', 'close'].includes(prevObj.status.toLowerCase()))
    );
    const isExplicitClose = lowerPath.includes('/close') || targetObj.actionType === 'CLOSE' || targetObj.action === 'CLOSE';
    const isTransitionToClose = !wasAlreadyClosed && (
        (targetObj.closedBy && !prevObj?.closedBy) ||
        targetObj.isClosed === true ||
        (typeof targetObj.status === 'string' && ['closed', 'close'].includes(targetObj.status.toLowerCase()))
    );

    if (isExplicitClose || isTransitionToClose) {
        return { action: 'CLOSE', category: 'OPERATION' };
    }

    // Revision Delete Check
    if (targetObj.isRevisionDelete === true || targetObj.actionType === 'DELETE_REVISION') {
        return { action: 'DELETE_REVISION', category: 'MUTATION' };
    }

    // Revision Check
    if (
        lowerPath.includes('/revise') ||
        lowerPath.includes('/revision') ||
        targetObj.isRevision === true ||
        targetObj.actionType === 'REVISE' ||
        targetObj.actionType === 'UPDATE_REVISION' ||
        (m === 'PUT' && (lowerPath.includes('/pi') || targetObj.piNumber || targetObj.piNo) && (targetObj.piRevision || targetObj.lastRevisedAt || targetObj.reviseNo || targetObj.currentReviseNo))
    ) {
        return { action: 'REVISE', category: 'MUTATION' };
    }

    // Original PI Edit Check
    if (
        (m === 'PUT' || m === 'PATCH') &&
        (lowerPath.includes('/pi') || targetObj.piNumber || targetObj.piNo) &&
        (targetObj.isOriginalPi === true || targetObj.actionType === 'UPDATE_ORIGINAL' || targetObj.piTargetType === 'Original PI')
    ) {
        return { action: 'UPDATE_ORIGINAL', category: 'MUTATION' };
    }

    if (m === 'POST') return { action: 'CREATE', category: 'MUTATION' };
    if (m === 'PUT' || m === 'PATCH') return { action: 'UPDATE', category: 'MUTATION' };
    if (m === 'DELETE') return { action: 'DELETE', category: 'MUTATION' };

    return { action: m, category: 'GENERAL' };
};

const extractReferenceNumber = (targetObj) => {
    if (!targetObj || typeof targetObj !== 'object') return null;
    const inv = targetObj.invoiceNo || targetObj.invoiceNumber;
    const ord = targetObj.orderNo || targetObj.orderNumber;
    if (ord && inv && ord !== inv) return `Order #${ord} (Invoice #${inv})`;
    if (inv) return `Invoice #${inv}`;
    const pi = targetObj.piNumber || targetObj.piNo || targetObj.piNumbers;
    if (pi) return `PI #${pi}`;
    const lc = targetObj.lcNo || targetObj.lcNumber;
    if (lc) return `LC #${lc}`;
    if (ord) return `Order #${ord}`;
    const challan = targetObj.challanNo || targetObj.challanNumber;
    if (challan) return `Challan #${challan}`;
    const ip = targetObj.ipNumber || targetObj.ipNo;
    if (ip) return `IP #${ip}`;
    const gatePass = targetObj.gatePassNo || targetObj.gatePassNumber;
    if (gatePass) return `Gate Pass #${gatePass}`;
    const truck = targetObj.truckNo || targetObj.truckNumber;
    if (truck) return `Truck #${truck}`;
    const po = targetObj.poNumber || targetObj.poNo;
    if (po) return `PO #${po}`;
    const pr = targetObj.prNumber || targetObj.prNo;
    if (pr) return `PR #${pr}`;
    const ret = targetObj.returnNo || targetObj.returnNumber;
    if (ret) return `Return #${ret}`;
    const dmg = targetObj.damageNo || targetObj.damageNumber;
    if (dmg) return `Damage #${dmg}`;
    const vch = targetObj.voucherNo || targetObj.voucherNumber;
    if (vch) return `Voucher #${vch}`;
    const rec = targetObj.receiptNo || targetObj.receiptNumber;
    if (rec) return `Receipt #${rec}`;
    const acc = targetObj.accountNumber || targetObj.accountNo;
    if (acc) return `A/C #${acc}`;
    const ref = targetObj.referenceNo || targetObj.referenceNumber;
    if (ref) return `Ref #${ref}`;
    return null;
};

/**
 * Generate human-friendly description of the operation with full field details
 */
const generateOperationDescription = (method, path, module, body, statusCode, updatedFields = [], explicitAction = null, previousDocSnapshot = null) => {
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
    const { action } = explicitAction ? { action: explicitAction } : resolveActionDetails(method, path, body, previousDocSnapshot);

    const nameIdentifier = targetObj.customerName || targetObj.companyName || targetObj.name || 
        targetObj.productName || targetObj.employeeName || targetObj.supplierName || targetObj.importerName || 
        targetObj.exporterName || targetObj.ipParty || targetObj.bankName || targetObj.title || targetObj.value || targetObj.label ||
        targetObj.piNumber || targetObj.piNo || targetObj.piNumbers || targetObj.invoiceNo || targetObj.lcNo || 
        targetObj.orderNo || targetObj.challanNo || targetObj.truckNo || targetObj.ipNumber;

    // ACCEPT
    if (action === 'ACCEPT') {
        let inv = '';
        if (targetObj.orderNo && targetObj.invoiceNo) {
            inv = `Order #${targetObj.orderNo} (Invoice #${targetObj.invoiceNo})`;
        } else if (targetObj.orderNo) {
            inv = `Order #${targetObj.orderNo}`;
        } else if (targetObj.invoiceNo) {
            inv = `Invoice #${targetObj.invoiceNo}`;
        } else if (targetId) {
            inv = `(#${targetId.slice(-6)})`;
        }
        const namePart = nameIdentifier && nameIdentifier !== targetObj.invoiceNo && nameIdentifier !== targetObj.orderNo ? `("${nameIdentifier}")` : '';
        const by = targetObj.acceptedBy || targetObj.approvedByName || targetObj.approvedBy;
        const byPart = by ? ` by ${by}` : '';
        const colon = (inv || namePart) ? ': ' : ' ';
        return `${errorPrefix}Accepted ${module}${colon}${inv} ${namePart}${byPart}`.replace(/\s+/g, ' ').trim();
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
        let inv = '';
        if (targetObj.orderNo && targetObj.invoiceNo) {
            inv = `Order #${targetObj.orderNo} (Invoice #${targetObj.invoiceNo})`;
        } else if (targetObj.orderNo) {
            inv = `Order #${targetObj.orderNo}`;
        } else if (targetObj.invoiceNo) {
            inv = `Invoice #${targetObj.invoiceNo}`;
        } else if (targetId) {
            inv = `(#${targetId.slice(-6)})`;
        }
        const namePart = nameIdentifier && nameIdentifier !== targetObj.invoiceNo && nameIdentifier !== targetObj.orderNo ? `("${nameIdentifier}")` : '';
        const reason = targetObj.rejectionReason ? ` (Reason: "${targetObj.rejectionReason}")` : '';
        const by = targetObj.rejectedBy;
        const byPart = by ? ` by ${by}` : '';
        const colon = (inv || namePart) ? ': ' : ' ';
        return `${errorPrefix}Rejected ${module}${colon}${inv} ${namePart}${reason}${byPart}`.replace(/\s+/g, ' ').trim();
    }

    // CARD OPEN
    if (action === 'CARD OPEN') {
        if (targetObj.cardType === 'create' || targetObj.actionType === 'OPEN_CREATE_FORM' || (!targetObj.invoiceNo && !nameIdentifier)) {
            return `${errorPrefix}Opened new entry card in ${module}`.trim();
        }
        const inv = targetObj.invoiceNo ? `Invoice #${targetObj.invoiceNo}` : '';
        const namePart = nameIdentifier ? `("${nameIdentifier}")` : '';
        return `${errorPrefix}Opened card: ${inv} ${namePart} in ${module}`.replace(/\s+/g, ' ').trim();
    }

    // CARD CLOSE
    if (action === 'CARD CLOSE') {
        if (targetObj.cardType === 'create' || targetObj.actionType === 'DISCARD_ENTRY' || targetObj.wasCreated === false || targetObj.saved === false) {
            return `${errorPrefix}Closed card without creating in ${module}`.trim();
        }
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

    // REVISE
    if (action === 'REVISE') {
        const refNo = extractReferenceNumber(targetObj);
        const entityName = targetObj.customerName || targetObj.companyName || targetObj.name || 
            targetObj.productName || targetObj.employeeName || targetObj.supplierName || 
            targetObj.importerName || targetObj.exporterName || targetObj.partyName;
        const revNo = targetObj.currentReviseNo || targetObj.reviseNo || (typeof targetObj.piRevision === 'string' ? targetObj.piRevision.split('DATE:')[0].trim() : '') || (Array.isArray(targetObj.revisions) && targetObj.revisions.length > 0 ? targetObj.revisions[targetObj.revisions.length - 1]?.reviseNo : '');
        const revPart = revNo && revNo !== 'Original PI' ? ` (${revNo.toLowerCase().startsWith('revise') ? revNo : `Revise: ${revNo}`})` : '';

        const isRevisionEdit = targetObj.actionType === 'UPDATE_REVISION' || Boolean(targetObj.editingRevisionNo);
        let desc = isRevisionEdit ? `${errorPrefix}Updated Revised ${module}` : `${errorPrefix}Revised ${module}`;
        if (refNo && entityName) {
            desc += `: ${refNo} ("${entityName}")${revPart}`;
        } else if (refNo) {
            desc += `: ${refNo}${revPart}`;
        } else if (entityName) {
            desc += `: "${entityName}"${revPart}`;
        } else if (nameIdentifier) {
            desc += `: "${nameIdentifier}"${revPart}`;
        } else if (targetId) {
            desc += ` (#${targetId.slice(-6)})${revPart}`;
        }

        if (Array.isArray(updatedFields) && updatedFields.length > 0) {
            const meaningfulFields = updatedFields.filter(f => !['id', '_id', 'updatedat', 'revisions', 'lastrevisedat', 'pirevision', 'isrevision', 'currentreviseno', 'actiontype', 'editingrevisionno'].includes((f.field || '').toLowerCase()));
            if (meaningfulFields.length === 1) {
                const f = meaningfulFields[0];
                desc += ` • Changed ${f.label}: ${f.oldValue ? `${f.oldValue} ➔ ` : ''}${f.value}`;
            } else if (meaningfulFields.length <= 3) {
                desc += ` • Changed: ${meaningfulFields.map(f => `${f.label} (${f.value})`).join(', ')}`;
            } else {
                desc += ` • Changed ${meaningfulFields.slice(0, 2).map(f => f.label).join(', ')} and ${meaningfulFields.length - 2} other fields`;
            }
        }
        return desc;
    }

    // DELETE_REVISION
    if (action === 'DELETE_REVISION') {
        const refNo = extractReferenceNumber(targetObj);
        const revNo = targetObj.deletedRevisionNo || 'Revision';
        return `${errorPrefix}Deleted ${revNo} of ${module}${refNo ? `: ${refNo}` : ''}`.trim();
    }

    const filledFields = Array.isArray(updatedFields) && updatedFields.length > 0 
        ? updatedFields 
        : extractFilledFields(body, action);

    const resolveEntityName = (obj, isCnf) => {
        if (!obj || typeof obj !== 'object') return null;
        if (isCnf) {
            return obj.cnfName || obj.indianCnF || obj.bdCnf || obj.customerName || obj.name || null;
        }
        return obj.customerName || obj.companyName || obj.name || 
            obj.productName || obj.employeeName || obj.supplierName || 
            obj.importerName || obj.exporterName || obj.ipParty || obj.bankName ||
            obj.warehouseName || obj.warehouse || obj.portName || obj.port ||
            obj.insuranceCompany || obj.reason || null;
    };

    const resolveCodeId = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.customerId) return `ID: ${obj.customerId}`;
        if (obj.employeeId) return `ID: ${obj.employeeId}`;
        if (obj.productId) return `Code: ${obj.productId}`;
        if (obj.accountNumber || obj.accountNo) return `A/C: ${obj.accountNumber || obj.accountNo}`;
        if (obj.warehouse && obj.warehouse !== obj.name) return `Warehouse: ${obj.warehouse}`;
        if (obj.category) return `Category: ${obj.category}`;
        return null;
    };

    switch (method.toUpperCase()) {
        case 'POST': {
            let desc = `${errorPrefix}Created new ${module}`;
            const refNo = extractReferenceNumber(targetObj);
            const entityName = resolveEntityName(targetObj, false);
            const codeId = resolveCodeId(targetObj);

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

            const total = targetObj.totalAmount || targetObj.grandTotal || targetObj.amount;
            if (total && !isNaN(Number(total))) {
                desc += ` • Total: ৳${parseFloat(total).toLocaleString('en-IN')}`;
            }
            return desc;
        }
        case 'PUT':
        case 'PATCH': {
            const isOriginalPi = (module === 'PI') && (action === 'UPDATE_ORIGINAL' || targetObj.isOriginalPi || targetObj.piTargetType === 'Original PI' || (!targetObj.isRevision && !targetObj.piRevision && (!targetObj.revisions || targetObj.revisions.length <= 1)));
            const isCnfComm = targetObj.isCnfCommissionUpdate === true || module === 'C&F' || Boolean(targetObj.cnfName);
            let desc = isOriginalPi ? `${errorPrefix}Updated Original ${module}` : isCnfComm ? `${errorPrefix}Updated C&F Commission` : `${errorPrefix}Updated ${module}`;
            const refNo = extractReferenceNumber(targetObj);
            const entityName = resolveEntityName(targetObj, isCnfComm);
            const codeId = resolveCodeId(targetObj);

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

            // Append specific edited fields directly to description for immediate clarity
            if (Array.isArray(updatedFields) && updatedFields.length > 0) {
                const meaningfulFields = updatedFields.filter(f => !['id', '_id', 'updatedat'].includes((f.field || '').toLowerCase()));
                if (meaningfulFields.length === 1) {
                    const f = meaningfulFields[0];
                    desc += ` • Changed ${f.label}: ${f.oldValue ? `${f.oldValue} ➔ ` : ''}${f.value}`;
                } else if (meaningfulFields.length <= 3) {
                    desc += ` • Changed: ${meaningfulFields.map(f => `${f.label} (${f.value})`).join(', ')}`;
                } else {
                    desc += ` • Changed ${meaningfulFields.slice(0, 2).map(f => f.label).join(', ')} and ${meaningfulFields.length - 2} more fields`;
                }
            }

            return desc;
        }
        case 'DELETE': {
            let desc = `${errorPrefix}Deleted ${module}`;
            const refNo = extractReferenceNumber(targetObj);
            const entityName = resolveEntityName(targetObj, false) || targetObj.value || targetObj.label;
            const codeId = resolveCodeId(targetObj);

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
                desc += ` record (#${targetId.slice(-6)})`;
            }
            return desc.trim();
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
                    '_id', 'id', 'invoiceNo', 'invoiceNumber', 'orderNo', 'orderNumber',
                    'lcNo', 'lcNumber', 'piNo', 'piNumber', 'piNumbers', 'billNo', 'challanNo',
                    'customerName', 'companyName', 'supplierName', 'employeeName', 'productName',
                    'name', 'phone', 'totalAmount', 'grandTotal', 'amount', 'paidAmount', 'dueAmount',
                    'status', 'view', 'tag', '_filledFields', '_updatedFields',
                    'isRevision', 'reviseNo', 'currentReviseNo', 'piRevision', 'actionType',
                    'deletedRevisionNo', 'isRevisionDelete', 'lastRevisedAt'
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

        // Clean empty/null/undefined keys to heavily compress payload
        for (const [k, v] of Object.entries(cleanDetails)) {
            if (v === '' || v === null || v === undefined) {
                delete cleanDetails[k];
            }
        }
        delete cleanDetails.__v;
        if (cleanDetails._id) delete cleanDetails._id;

        // Limit filled/updated field diffs to max 6 to avoid massive arrays
        if (Array.isArray(cleanDetails._filledFields) && cleanDetails._filledFields.length > 6) {
            cleanDetails._filledFields = cleanDetails._filledFields.slice(0, 6);
        }
        if (Array.isArray(cleanDetails._updatedFields) && cleanDetails._updatedFields.length > 8) {
            cleanDetails._updatedFields = cleanDetails._updatedFields.slice(0, 8);
        }

        // Simplify user agent to compact string (e.g. "Chrome (macOS)")
        let compactUserAgent = entry.userAgent || '';
        if (compactUserAgent.length > 25) {
            let browser = 'Browser';
            if (compactUserAgent.includes('Firefox/')) browser = 'Firefox';
            else if (compactUserAgent.includes('Edg/')) browser = 'Edge';
            else if (compactUserAgent.includes('Chrome/') && !compactUserAgent.includes('Edg/')) browser = 'Chrome';
            else if (compactUserAgent.includes('Safari/') && !compactUserAgent.includes('Chrome/')) browser = 'Safari';
            else if (compactUserAgent.includes('Opera/') || compactUserAgent.includes('OPR/')) browser = 'Opera';

            let os = 'Device';
            if (compactUserAgent.includes('Macintosh') || compactUserAgent.includes('Mac OS X')) os = 'macOS';
            else if (compactUserAgent.includes('Windows NT')) os = 'Windows';
            else if (compactUserAgent.includes('iPhone') || compactUserAgent.includes('iPad')) os = 'iOS';
            else if (compactUserAgent.includes('Android')) os = 'Android';
            else if (compactUserAgent.includes('Linux')) os = 'Linux';

            compactUserAgent = `${browser} (${os})`;
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
            userAgent: compactUserAgent,
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
        'requestedby', 'requestedbyusername', 'saletype', 'view', 'targetid',
        'revisions', 'pirevision', 'lastrevisedat', 'revisedby', 'revisedbyname',
        'isrevision', 'currentreviseno', 'actiontype', 'isrevisiondelete', 'deletedrevisionno',
        'iscnfcommissionupdate', 'indcommissionedited', 'bdcommissionedited', 'indcnfedited', 'indcnfbulkedited', 'cnfname',
        'currenttotalqty', 'currenttotaltrucks', 'totaltrucks', 'totalqty'
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
            let oldRateVal = null;
            let newQtyVal = null;
            let oldQtyVal = null;

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
                            oldRateVal = oP;
                        }
                        if (nb.quantity !== undefined && String(nb.quantity).trim() !== String(ob.quantity ?? '').trim()) {
                            qtyChanged = true;
                            newQtyVal = nb.quantity;
                            oldQtyVal = ob.quantity;
                        }
                        if (nb.brand !== ob.brand || nb.warehouseName !== ob.warehouseName) itemsChanged = true;
                    }
                }
            }

            if (rateChanged) {
                changes.push({
                    field: 'unitPrice',
                    label: 'Price',
                    value: `৳${parseFloat(newRateVal || 0).toLocaleString('en-IN')}`,
                    oldValue: oldRateVal !== null && oldRateVal !== undefined ? `৳${parseFloat(oldRateVal || 0).toLocaleString('en-IN')}` : undefined
                });
            }
            if (qtyChanged) {
                changes.push({
                    field: 'quantity',
                    label: 'Quantity',
                    value: parseFloat(newQtyVal || 0).toLocaleString(),
                    oldValue: oldQtyVal !== null && oldQtyVal !== undefined ? parseFloat(oldQtyVal || 0).toLocaleString() : undefined
                });
            }
            if (itemsChanged && !qtyChanged && !rateChanged) {
                changes.push({ field: 'items', label: 'Products', value: `${newVal.length} item${newVal.length > 1 ? 's' : ''}` });
            }
            continue;
        }

        // productsList comparison (for PI)
        if (key === 'productsList' && Array.isArray(newVal)) {
            const oldList = Array.isArray(oldVal) ? oldVal : [];
            let listChanged = false;
            if (newVal.length !== oldList.length) {
                listChanged = true;
            } else {
                for (let i = 0; i < newVal.length; i++) {
                    const np = newVal[i] || {};
                    const op = oldList[i] || {};
                    if (np.productName !== op.productName || String(np.quantity) !== String(op.quantity) || String(np.rate) !== String(op.rate)) {
                        listChanged = true;
                        break;
                    }
                }
            }

            if (listChanged) {
                changes.push({
                    field: 'productsList',
                    label: 'Products',
                    value: `${newVal.length} item${newVal.length !== 1 ? 's' : ''}`,
                    oldValue: oldList.length > 0 ? `${oldList.length} item${oldList.length !== 1 ? 's' : ''}` : undefined
                });
            }
            continue;
        }

        // ipNumbers array comparison (for PI)
        if (key === 'ipNumbers' && Array.isArray(newVal)) {
            const oldArr = Array.isArray(oldVal) ? oldVal : [];
            if (JSON.stringify(newVal) !== JSON.stringify(oldArr)) {
                const strNew = newVal.every(x => typeof x === 'string');
                if (strNew && newVal.length <= 3) {
                    changes.push({
                        field: 'ipNumbers',
                        label: 'IP Numbers',
                        value: newVal.join(', '),
                        oldValue: oldArr.length > 0 ? oldArr.join(', ') : undefined
                    });
                } else {
                    changes.push({
                        field: 'ipNumbers',
                        label: 'IP Numbers',
                        value: `${newVal.length} item${newVal.length !== 1 ? 's' : ''}`,
                        oldValue: `${oldArr.length} item${oldArr.length !== 1 ? 's' : ''}`
                    });
                }
            }
            continue;
        }

        // branches array comparison (for Bank)
        if (key === 'branches' && Array.isArray(newVal)) {
            const oldBranches = Array.isArray(oldVal) ? oldVal : [];
            const branchChanges = [];

            // Compare existing branches
            const commonLength = Math.min(newVal.length, oldBranches.length);
            for (let i = 0; i < commonLength; i++) {
                const nb = newVal[i] || {};
                const ob = oldBranches[i] || {};
                const bName = nb.branch || ob.branch || (newVal.length > 1 ? `Branch #${i + 1}` : '');
                const bSuffix = bName ? ` (${bName})` : '';

                const branchFieldKeys = [
                    { key: 'accountNo', label: `Account No${bSuffix}` },
                    { key: 'accountName', label: `Account Name${bSuffix}` },
                    { key: 'branch', label: 'Branch Name' },
                    { key: 'lcCommission', label: `LC Commission${bSuffix}` },
                    { key: 'vatOnCommission', label: `VAT on Commission${bSuffix}` },
                    { key: 'swiftCharge', label: `SWIFT Charge${bSuffix}` },
                    { key: 'vatOnSwiftCharge', label: `VAT on SWIFT${bSuffix}` },
                    { key: 'lcApplicationForm', label: `LC App Form${bSuffix}` },
                    { key: 'mpCharge', label: `MP Charge${bSuffix}` },
                    { key: 'stampCharge', label: `Stamp Charge${bSuffix}` },
                    { key: 'amendmentCommission', label: `Amendment Commission${bSuffix}` },
                    { key: 'amendmentVatOnCommission', label: `Amendment VAT on Commission${bSuffix}` },
                    { key: 'amendmentSwiftCharge', label: `Amendment SWIFT${bSuffix}` },
                    { key: 'amendmentVatOnSwift', label: `Amendment VAT on SWIFT${bSuffix}` }
                ];

                for (const { key: fk, label: fl } of branchFieldKeys) {
                    const nV = (nb[fk] === null || nb[fk] === undefined) ? '' : String(nb[fk]).trim();
                    const oV = (ob[fk] === null || ob[fk] === undefined) ? '' : String(ob[fk]).trim();
                    if (nV !== oV) {
                        branchChanges.push({
                            field: fk,
                            label: fl,
                            value: nV || '(Empty)',
                            oldValue: oV || '(Empty)'
                        });
                    }
                }
            }

            // Branches added
            if (newVal.length > oldBranches.length) {
                for (let i = oldBranches.length; i < newVal.length; i++) {
                    const nb = newVal[i] || {};
                    branchChanges.push({
                        field: 'branches',
                        label: 'Added Branch',
                        value: `${nb.branch || 'New Branch'}${nb.accountNo ? ` (A/C: ${nb.accountNo})` : ''}`
                    });
                }
            }

            // Branches removed
            if (newVal.length < oldBranches.length) {
                for (let i = newVal.length; i < oldBranches.length; i++) {
                    const ob = oldBranches[i] || {};
                    branchChanges.push({
                        field: 'branches',
                        label: 'Removed Branch',
                        value: `${ob.branch || 'Branch'}${ob.accountNo ? ` (A/C: ${ob.accountNo})` : ''}`
                    });
                }
            }

            if (branchChanges.length > 0) {
                changes.push(...branchChanges);
            }
            continue;
        }

        // Generic Array comparison
        if (Array.isArray(newVal)) {
            const oldArr = Array.isArray(oldVal) ? oldVal : [];
            if (JSON.stringify(newVal) !== JSON.stringify(oldArr)) {
                // If it's an array of objects and lengths are equal, extract object-level diffs
                if (newVal.length > 0 && newVal.length === oldArr.length && typeof newVal[0] === 'object' && newVal[0] !== null) {
                    const objDiffs = [];
                    for (let i = 0; i < newVal.length; i++) {
                        const nObj = newVal[i] || {};
                        const oObj = oldArr[i] || {};
                        const allKeys = new Set([...Object.keys(nObj), ...Object.keys(oObj)]);
                        for (const subKey of allKeys) {
                            if (subKey.startsWith('_') || ignoreKeys.has(subKey.toLowerCase())) continue;
                            const nV = (nObj[subKey] === null || nObj[subKey] === undefined) ? '' : String(nObj[subKey]).trim();
                            const oV = (oObj[subKey] === null || oObj[subKey] === undefined) ? '' : String(oObj[subKey]).trim();
                            if (nV !== oV) {
                                const itemLabel = nObj.name || nObj.title || nObj.branch || nObj.label || (newVal.length > 1 ? `#${i + 1}` : '');
                                const itemSuffix = itemLabel ? ` (${itemLabel})` : '';
                                objDiffs.push({
                                    field: subKey,
                                    label: `${formatFieldLabel(subKey)}${itemSuffix}`,
                                    value: nV || '(Empty)',
                                    oldValue: oV || '(Empty)'
                                });
                            }
                        }
                    }
                    if (objDiffs.length > 0 && objDiffs.length <= 10) {
                        changes.push(...objDiffs);
                        continue;
                    }
                }

                changes.push({
                    field: key,
                    label: formatFieldLabel(key),
                    value: `${newVal.length} item${newVal.length !== 1 ? 's' : ''}`,
                    oldValue: `${oldArr.length} item${oldArr.length !== 1 ? 's' : ''}`
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
                    value: formatFieldValue(newVal),
                    oldValue: formatFieldValue(oldVal) || undefined
                });
            }
            continue;
        }

        // Primitive comparison
        const strOld = (oldVal === null || oldVal === undefined) ? '' : String(oldVal).trim();
        const strNew = (newVal === null || newVal === undefined) ? '' : String(newVal).trim();

        if (strOld !== strNew) {
            let formatted = formatFieldValue(newVal);
            let formattedOld = formatFieldValue(oldVal);
            if (['indcommissiontotal', 'bdcommissiontotal', 'indcnfcost', 'bdcnfcost'].includes(key.toLowerCase())) {
                const numNew = parseFloat(newVal);
                const numOld = parseFloat(oldVal);
                if (!isNaN(numNew)) formatted = `৳${numNew.toLocaleString('en-IN')}`;
                if (!isNaN(numOld)) formattedOld = `৳${numOld.toLocaleString('en-IN')}`;
            }
            if (formatted) {
                changes.push({
                    field: key,
                    label: formatFieldLabel(key),
                    value: formatted,
                    oldValue: formattedOld || undefined
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
    computeUpdatedFields,
    resolvePayloadObject
};
