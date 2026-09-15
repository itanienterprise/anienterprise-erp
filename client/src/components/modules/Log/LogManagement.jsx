import React, { useState, useEffect, useRef } from 'react';
import axios from '../../../utils/api';
import { decryptData } from '../../../utils/encryption';
import {
    SearchIcon,
    RefreshIcon,
    DownloadIcon,
    TrashIcon,
    EyeIcon,
    ActivityLogIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronDownIcon,
    CalendarIcon,
    FunnelIcon,
    XIcon,
    CheckIcon,
    ShieldIcon,
    UserIcon,
    ClipboardIcon,
    FileTextIcon
} from '../../Icons';

const IGNORED_KEYS = new Set([
    '_id', '__v', 'id', 'password', 'confirmPassword', 'token', 'secret',
    'signature', 'createdAt', 'updatedAt', 'user', 'userId', 'createdBy',
    'updatedBy', 'payload', 'data', 'ciphertext', 'readbyusers', '_filledfields',
    'tag', 'view', 'targetid', 'targetname', 'targetroles', 'targetusers', 'isedited'
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
    grandTotalQuantity: 'Total Quantity',
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
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (typeof val === 'number') return val.toLocaleString();
    if (typeof val === 'string') {
        if (/^[a-f0-9]{24}$/i.test(val)) return '';
        return val;
    }
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

const getLogModule = (log) => {
    if (!log) return 'System';
    if (log.path?.includes('/notifications')) return 'Notification';
    if (log.path?.includes('/metadata')) return 'Settings / Metadata';
    
    let details = log.details || {};
    if (details.data && typeof details.data === 'object' && !Array.isArray(details.data)) {
        details = details.data;
    }

    if (
        details.isCnfCommissionUpdate === true ||
        Boolean(details.cnfName) ||
        log.module === 'C&F' ||
        (typeof log.description === 'string' && log.description.toLowerCase().includes('c&f commission'))
    ) {
        return 'C&F';
    }

    // Check if Border Sale
    const isBorder = (log.module === 'Border Sale') ||
        details.saleType === 'Border' ||
        details.isBorderSale === true ||
        (typeof details.invoiceNo === 'string' && details.invoiceNo.startsWith('BS')) ||
        (typeof log.description === 'string' && (log.description.includes('BS') || log.description.toLowerCase().includes('border sale')));
    
    if (isBorder) return 'Border Sale';

    // IP module normalization
    if (
        log.module === 'Ip' ||
        log.module === 'ip' ||
        log.module === 'IP' ||
        log.path?.includes('/ip-records') ||
        (typeof details.view === 'string' && details.view.includes('ip')) ||
        (typeof log.description === 'string' && /in ip\b/i.test(log.description))
    ) {
        return 'IP';
    }

    return log.module || 'System';
};

const getLogAction = (log) => {
    if (!log) return 'UNKNOWN';
    let act = (log.action || '').toUpperCase().trim();
    if (act === 'CARD_OPEN') act = 'CARD OPEN';
    if (act === 'CARD_CLOSE') act = 'CARD CLOSE';

    let details = log.details || {};
    if (details.data && typeof details.data === 'object' && !Array.isArray(details.data)) {
        details = details.data;
    }

    // Explicit override for C&F commission edits
    if (
        details.isCnfCommissionUpdate === true ||
        (typeof log.description === 'string' && log.description.toLowerCase().includes('c&f commission'))
    ) {
        return 'UPDATE';
    }

    if (act === 'ACCEPT' || act === 'REJECT' || act === 'APPROVE' || act === 'CLOSE' || act === 'CARD OPEN' || act === 'CARD CLOSE') return act;
    const path = (log.path || '').toLowerCase();
    const desc = (log.description || '').toLowerCase();

    // Check Card Open / Close / Discard
    if (
        details.actionType === 'DISCARD_ENTRY' ||
        act === 'CARD CLOSE (NO SAVE)' ||
        details.wasCreated === false ||
        desc.includes('without creating') ||
        desc.includes('without save')
    ) {
        return 'CARD CLOSE (NO SAVE)';
    }
    if (
        details.actionType === 'OPEN_CREATE_FORM' ||
        desc.includes('opened new entry card')
    ) {
        return 'CARD OPEN';
    }
    if (
        details.actionType === 'CARD_OPEN' ||
        act === 'CARD OPEN' ||
        desc.includes('opened card') ||
        desc.includes('card open')
    ) {
        return 'CARD OPEN';
    }
    if (
        details.actionType === 'CARD_CLOSE' ||
        act === 'CARD CLOSE' ||
        desc.includes('closed card') ||
        desc.includes('card close')
    ) {
        return 'CARD CLOSE';
    }

    // Check revision delete
    if (
        act === 'DELETE_REVISION' ||
        details.isRevisionDelete === true ||
        details.actionType === 'DELETE_REVISION' ||
        desc.toLowerCase().includes('deleted revision')
    ) {
        return 'DELETE_REVISION';
    }

    // Check revision
    if (
        act === 'REVISE' ||
        act === 'REVISED' ||
        details.isRevision === true ||
        details.actionType === 'REVISE' ||
        details.actionType === 'UPDATE_REVISION' ||
        Boolean(details.piRevision) ||
        Boolean(details.reviseNo) ||
        Boolean(details.currentReviseNo) ||
        (details.lastRevisedAt && log?.method === 'PUT') ||
        (Array.isArray(details.revisions) && details.revisions.length > 0 && (path.includes('/pi') || details.piNumber || details.piNo)) ||
        desc.toLowerCase().startsWith('revised ') ||
        desc.toLowerCase().includes('revised pi')
    ) {
        return 'REVISED';
    }

    // Check Original PI Edit
    if (
        act === 'UPDATE_ORIGINAL' ||
        (details.isOriginalPi && act === 'UPDATE') ||
        (details.piTargetType === 'Original PI') ||
        (path.includes('/pi') && act === 'UPDATE' && !details.isRevision && !details.piRevision && (desc.toLowerCase().includes('original') || (!details.revisions || details.revisions.length <= 1)))
    ) {
        return 'UPDATE_ORIGINAL';
    }

    // Authoritative Mutation Actions: Never convert UPDATE, CREATE, or DELETE to approval/accept
    if (act === 'UPDATE' || desc.startsWith('updated ')) {
        return 'UPDATE';
    }
    if (act === 'CREATE' || desc.startsWith('created ')) {
        return 'CREATE';
    }
    if (act === 'DELETE' || desc.startsWith('deleted ')) {
        return 'DELETE';
    }

    // Check rejection (explicit action, path, or transition in updatedFields only)
    if (
        path.includes('/reject') ||
        details.actionType === 'REJECT' ||
        details.action === 'REJECT' ||
        desc.startsWith('rejected ') ||
        (Array.isArray(details._updatedFields) && details._updatedFields.some(f => f.field === 'status' && String(f.value).toLowerCase().includes('reject')))
    ) {
        return 'REJECT';
    }

    // Check accept (explicit action, path, or transition in updatedFields only)
    if (
        path.includes('/accept') ||
        details.actionType === 'ACCEPT' ||
        details.action === 'ACCEPT' ||
        desc.startsWith('accepted ') ||
        (Array.isArray(details._updatedFields) && details._updatedFields.some(f => f.field === 'acceptedBy' || (f.field === 'status' && String(f.value).toLowerCase().includes('accept'))))
    ) {
        return 'ACCEPT';
    }

    // Check approval (explicit action, path, or transition in updatedFields only)
    if (
        path.includes('/approve') ||
        path.includes('/1st-approve') ||
        path.includes('/2nd-approve') ||
        details.actionType === 'APPROVE' ||
        details.action === 'APPROVE' ||
        desc.startsWith('approved ') ||
        (Array.isArray(details._updatedFields) && details._updatedFields.some(f => f.field?.toLowerCase().includes('approv')))
    ) {
        return 'APPROVE';
    }

    // Check close
    if (
        path.includes('/close') ||
        details.actionType === 'CLOSE' ||
        details.action === 'CLOSE' ||
        desc.startsWith('closed ')
    ) {
        return 'CLOSE';
    }

    return act;
};

const formatLogDescription = (desc, log) => {
    if (!desc) return 'Performed action';
    let details = log?.details || {};
    if (typeof details.data === 'string' && isEncryptedString(details.data)) {
        try {
            const dec = decryptData(details.data);
            if (dec && typeof dec === 'object') details = dec;
        } catch (e) {}
    } else if (typeof details.payload === 'string' && isEncryptedString(details.payload)) {
        try {
            const dec = decryptData(details.payload);
            if (dec && typeof dec === 'object') details = dec;
        } catch (e) {}
    } else if (details.data && typeof details.data === 'object' && !Array.isArray(details.data)) {
        details = details.data;
    }

    const mod = getLogModule(log);
    const action = getLogAction(log);

    // Notifications route handling
    if (log?.path?.includes('/notifications')) {
        const idMatch = log.path.match(/([a-f0-9]{24}|\d+)/i);
        const idHint = idMatch ? `(#${idMatch[1].slice(-6)})` : '';
        if (log.method === 'DELETE' || log.path.includes('/clear')) {
            return 'Cleared all notifications';
        }
        if (log.method === 'POST') {
            return 'Created new notification';
        }
        return `Marked notification as read ${idHint}`.trim();
    }

    // Accept
    if (action === 'ACCEPT' || desc.startsWith('accepted ') || desc.startsWith('Accepted ')) {
        // If this record came from a UI click, render it as a button click
        if (log.method === 'CLICK' || log.actionCategory === 'UI_CLICK') {
            const raw = desc.replace(/^Accepted\s+[A-Za-z0-9\s/&]+:\s*/i, '').trim();
            const targetPart = raw ? ` "${raw}"` : (details.orderNo ? ` "Accept Sale Request (${details.orderNo})"` : ' "Accept Sale Request"');
            return `User clicked${targetPart} in ${mod}`.replace(/\s+/g, ' ').trim();
        }

        let ref = details.invoiceNo ? `Invoice #${details.invoiceNo}` : (details.orderNo ? `Order #${details.orderNo}` : '');
        if (!ref) {
            const invMatch = desc.match(/Invoice #?([A-Z0-9_-]+)/i) || desc.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i);
            if (invMatch) ref = `Invoice #${invMatch[1].trim()}`;
            else {
                const ordMatch = desc.match(/Order #?([A-Z0-9_-]+)/i);
                if (ordMatch) ref = `Order #${ordMatch[1].trim()}`;
            }
        }
        let name = details.customerName || details.companyName || details.name || '';
        if (!name) {
            const nameMatch = desc.match(/\("([^"]+)"\)/) || desc.match(/Updated\s+(?:Sales|Customer|PI):\s*"([^"]+)"/i) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';
        const by = details.acceptedByName || details.acceptedBy || log.displayName || log.username;
        const byPart = by ? ` by ${by}` : '';
        const colon = (ref || namePart) ? ': ' : ' ';
        return `Accepted ${mod}${colon}${ref} ${namePart}${byPart}`.replace(/\s+/g, ' ').trim();
    }

    // Approvals
    if (action === 'APPROVE') {
        let inv = details.invoiceNo;
        if (!inv) {
            const invMatch = desc.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i);
            if (invMatch) inv = invMatch[1].trim();
        }
        const invPart = inv ? `Invoice #${inv}` : '';
        let name = details.customerName || details.companyName || details.name || '';
        if (!name) {
            const nameMatch = desc.match(/Updated\s+(?:Sales|Customer|PI):\s*"([^"]+)"/i) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';
        const by = details.approvedByName || details.approvedBy || details.acceptedBy || log.displayName || log.username;
        const byPart = by ? ` by ${by}` : '';
        return `Approved ${mod}: ${invPart} ${namePart}${byPart}`.replace(/\s+/g, ' ').trim();
    }

    // Rejections
    if (action === 'REJECT') {
        let inv = details.invoiceNo;
        if (!inv) {
            const invMatch = desc.match(/Invoice #?([A-Z0-9_-]+)/i) || desc.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i);
            if (invMatch) inv = invMatch[1].trim();
        }
        const invPart = inv ? `Invoice #${inv}` : '';
        let name = details.customerName || details.companyName || details.name || '';
        if (!name) {
            const nameMatch = desc.match(/\("([^"]+)"\)/) || desc.match(/Updated\s+(?:Sales|Customer|PI):\s*"([^"]+)"/i) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';
        let reason = details.rejectionReason;
        if (!reason) {
            const reasonMatch = desc.match(/Reason:\s*"([^"]+)"/i);
            if (reasonMatch) reason = reasonMatch[1].trim();
        }
        const reasonPart = reason ? ` (Reason: "${reason}")` : '';
        return `Rejected ${mod}: ${invPart} ${namePart}${reasonPart}`.replace(/\s+/g, ' ').trim();
    }

    // Card Open
    if (action === 'CARD OPEN' || desc.includes('opened card') || desc.includes('card open')) {
        if (details.cardType === 'create' || details.actionType === 'OPEN_CREATE_FORM' || desc.includes('new entry card') || (!details.invoiceNo && !details.customerName && !details.name)) {
            return `Opened new entry card in ${mod}`;
        }
        let inv = details.invoiceNo;
        if (!inv) {
            const invMatch = desc.match(/Invoice #?([A-Z0-9_-]+)/i) || desc.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i);
            if (invMatch) inv = invMatch[1].trim();
        }
        const invPart = inv ? `Invoice #${inv}` : '';
        let name = details.customerName || details.companyName || details.name || '';
        if (!name) {
            const nameMatch = desc.match(/\("([^"]+)"\)/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';
        return `Opened card: ${invPart} ${namePart} in ${mod}`.replace(/\s+/g, ' ').trim();
    }

    // Card Close / Discard
    if (action === 'CARD CLOSE' || action === 'CARD CLOSE (NO SAVE)' || desc.includes('closed card') || desc.includes('card close')) {
        if (details.cardType === 'create' || details.actionType === 'DISCARD_ENTRY' || details.wasCreated === false || details.saved === false || desc.includes('without creating')) {
            return `Closed card without creating in ${mod}`;
        }
        let inv = details.invoiceNo;
        if (!inv) {
            const invMatch = desc.match(/Invoice #?([A-Z0-9_-]+)/i) || desc.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i);
            if (invMatch) inv = invMatch[1].trim();
        }
        const invPart = inv ? `Invoice #${inv}` : '';
        let name = details.customerName || details.companyName || details.name || '';
        if (!name) {
            const nameMatch = desc.match(/\("([^"]+)"\)/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';
        return `Closed card: ${invPart} ${namePart} in ${mod}`.replace(/\s+/g, ' ').trim();
    }

    // New Entry / Creation
    if (action === 'CREATE' || desc.startsWith('Created ')) {
        const ipVal = details.ipNumber || details.ipNo;
        const piVal = details.piNumber || details.piNo || details.piNumbers;
        const lcVal = details.lcNo || details.lcNumber;
        const invVal = details.invoiceNo || details.invoiceNumber;
        const ordVal = details.orderNo || details.orderNumber;
        const chVal = details.challanNo || details.challanNumber;

        let ref = '';
        if (ipVal) ref = `IP #${ipVal}`;
        else if (piVal) ref = `PI #${piVal}`;
        else if (lcVal) ref = `LC #${lcVal}`;
        else if (ordVal && invVal && ordVal !== invVal) ref = `Order #${ordVal} (Invoice #${invVal})`;
        else if (invVal) ref = `Invoice #${invVal}`;
        else if (ordVal) ref = `Order #${ordVal}`;
        else if (chVal) ref = `Challan #${chVal}`;
        else {
            const match = desc.match(/(?:IP|Invoice|Order|LC|PI|Challan)\s*#([A-Za-z0-9_-]+)/i) || desc.match(/(?:IP|Invoice|Order|LC|PI|Challan)\s*#?\s*["']?([^"',\]()]+)["']?/i);
            if (match) ref = match[0].trim();
        }

        const invPart = ref;
        let name = details.ipParty || details.customerName || details.companyName || details.name || details.productName || details.employeeName || details.supplierName || '';
        if (!name) {
            const nameMatch = desc.match(/\("([^"]+)"\)/) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';
        let base = invPart && namePart ? `Created new ${mod}: ${invPart} ${namePart}` :
            invPart ? `Created new ${mod}: ${invPart}` :
            namePart ? `Created new ${mod}: ${namePart}` : `Created new ${mod}`;
        const total = details.totalAmount || details.grandTotal || details.amount;
        if (total && !isNaN(Number(total))) {
            base += ` • Total: ৳${parseFloat(total).toLocaleString('en-IN')}`;
        }
        return base;
    }

    // Close
    if (action === 'CLOSE') {
        const inv = details.invoiceNo || details.orderNo || details.lcNo ? `#${details.invoiceNo || details.orderNo || details.lcNo}` : '';
        const name = details.customerName || details.name || details.companyName || '';
        const namePart = name ? `("${name}")` : '';
        return `Closed ${mod} ${inv} ${namePart}`.replace(/\s+/g, ' ').trim();
    }

    // Clicks
    if (action === 'CLICK' || log?.actionCategory === 'UI_CLICK') {
        if (desc.includes('clicked "Edit PI"') && mod === 'PI') {
            return `User clicked "Edit Original PI" in PI`;
        }
        if (/clicked "(Edit|Save|Update|Delete) Record"/i.test(desc) || /clicked "(Edit|Save|Update|Delete)" in/i.test(desc)) {
            const verbMatch = desc.match(/clicked "(Edit|Save|Update|Delete)(?:\s+Record)?"/i);
            const verb = verbMatch ? verbMatch[1] : 'Action';
            const isCnf = /cnf|c&f/i.test(mod) || (typeof details.view === 'string' && /cnf/i.test(details.view));
            if (isCnf) {
                return `User clicked "${verb} C&F Commission" in ${mod}`;
            }
            if (/^ip$/i.test(mod) || (typeof details.view === 'string' && /ip/i.test(details.view))) {
                return `User clicked "${verb} IP Record" in IP`;
            }
            return `User clicked "${verb} ${mod}" in ${mod}`;
        }
        if (/clicked "Save IP Record" in (Ip|IP)/i.test(desc)) {
            return `User clicked "Save IP Record" in IP`;
        }
        if (/clicked "Edit Record" in (Ip|IP)/i.test(desc)) {
            return `User clicked "Edit IP Record" in IP`;
        }
        if (desc.includes('clicked "+"') || desc.includes('clicked "+ Add"') || desc.includes('clicked "+ New"')) {
            return `User clicked "Create New ${mod}" in ${mod}`;
        }
        if (desc.endsWith(' in Ip')) {
            return desc.replace(/ in Ip$/, ' in IP');
        }
    }

    // Revision Delete
    if (action === 'DELETE_REVISION' || desc.toLowerCase().includes('deleted revision')) {
        let piVal = details.piNumber || details.piNo || details.piNumbers;
        let refPart = piVal ? `PI #${piVal}` : '';
        const revNo = details.deletedRevisionNo || 'Revision';
        return `Deleted ${revNo} of ${mod}${refPart ? `: ${refPart}` : ''}`.trim();
    }

    // Revision
    if (action === 'REVISED' || desc.startsWith('Revised ') || desc.startsWith('Updated Revised ')) {
        const piVal = details.piNumber || details.piNo || details.piNumbers;
        let refPart = '';
        if (piVal) refPart = `PI #${piVal}`;
        else {
            const match = desc.match(/(?:PI)\s*#?\s*["']?([^"',\]()]+)["']?/i);
            if (match) refPart = match[0].trim();
        }

        let name = details.customerName || details.companyName || details.name || details.productName || '';
        if (!name) {
            const nameMatch = desc.match(/\("([^"]+)"\)/) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';

        const revNo = details.currentReviseNo || details.reviseNo || (typeof details.piRevision === 'string' ? details.piRevision.split('DATE:')[0].trim() : '') || (Array.isArray(details.revisions) && details.revisions.length > 0 ? details.revisions[details.revisions.length - 1]?.reviseNo : '');
        const revPart = revNo && revNo !== 'Original PI' ? ` (${revNo.toLowerCase().startsWith('revise') ? revNo : `Revise: ${revNo}`})` : '';

        const isRevisionEdit = details.actionType === 'UPDATE_REVISION' || Boolean(details.editingRevisionNo) || desc.startsWith('Updated Revised');
        const revisePrefix = isRevisionEdit ? 'Updated Revised' : 'Revised';
        let baseDesc = refPart && namePart ? `${revisePrefix} ${mod}: ${refPart} ${namePart}${revPart}` :
            refPart ? `${revisePrefix} ${mod}: ${refPart}${revPart}` :
            namePart ? `${revisePrefix} ${mod}: ${namePart}${revPart}` : `${revisePrefix} ${mod}${revPart}`;

        // Append specific changed fields if recorded in details._updatedFields
        const upd = Array.isArray(details._updatedFields) && details._updatedFields.length > 0 ? details._updatedFields : [];
        if (upd.length > 0) {
            const meaningful = upd.filter(f => !['id', '_id', 'updatedat', 'revisions', 'lastrevisedat', 'pirevision', 'isrevision', 'currentreviseno', 'actiontype', 'editingrevisionno'].includes((f.field || '').toLowerCase()));
            if (meaningful.length === 1) {
                const f = meaningful[0];
                const lbl = FIELD_LABEL_MAP[f.field] || (f.label === 'Products List' ? 'Products' : f.label === 'Ip Numbers' ? 'IP Numbers' : f.label);
                return `${baseDesc} • Changed ${lbl}: ${f.oldValue ? `${f.oldValue} ➔ ` : ''}${f.value}`.trim();
            } else if (meaningful.length <= 3) {
                return `${baseDesc} • Changed: ${meaningful.map(f => {
                    const lbl = FIELD_LABEL_MAP[f.field] || (f.label === 'Products List' ? 'Products' : f.label === 'Ip Numbers' ? 'IP Numbers' : f.label);
                    return `${lbl} (${f.value})`;
                }).join(', ')}`.trim();
            } else {
                const firstTwo = meaningful.slice(0, 2).map(f => FIELD_LABEL_MAP[f.field] || (f.label === 'Products List' ? 'Products' : f.label === 'Ip Numbers' ? 'IP Numbers' : f.label)).join(', ');
                return `${baseDesc} • Changed ${firstTwo} and ${meaningful.length - 2} other fields`.trim();
            }
        }
        return baseDesc;
    }

    // Edits and Updates
    if (action === 'UPDATE' || action === 'UPDATE_ORIGINAL' || desc.startsWith('Updated ')) {
        const piVal = details.piNumber || details.piNo || details.piNumbers;
        const lcVal = details.lcNo || details.lcNumber;
        const invVal = details.invoiceNo || details.invoiceNumber;
        const ordVal = details.orderNo || details.orderNumber;
        const chVal = details.challanNo || details.challanNumber;

        let refPart = '';
        if (piVal) refPart = `PI #${piVal}`;
        else if (lcVal) refPart = `LC #${lcVal}`;
        else if (ordVal && invVal && ordVal !== invVal) refPart = `Order #${ordVal} (Invoice #${invVal})`;
        else if (invVal) refPart = `Invoice #${invVal}`;
        else if (ordVal) refPart = `Order #${ordVal}`;
        else if (chVal) refPart = `Challan #${chVal}`;
        else {
            const ordInvMatch = desc.match(/Order\s*#?([A-Za-z0-9_-]+)\s*\(\s*Invoice\s*#?([A-Za-z0-9_-]+)\s*\)/i);
            if (ordInvMatch) {
                refPart = `Order #${ordInvMatch[1].trim()} (Invoice #${ordInvMatch[2].trim()})`;
            } else {
                const match = desc.match(/(?:Invoice|Order|LC|PI|Challan)\s*#?\s*["']?([^"',\]()]+)["']?/i);
                if (match) refPart = match[0].trim();
            }
        }

        let name = details.customerName || details.companyName || details.name || details.productName || details.employeeName || details.supplierName || details.bankName || '';
        if (!name) {
            const nameMatch = desc.match(/Updated\s+[^:]+:\s*(?:[^#]+#\S+\s+)?\("([^"]+)"\)/i) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';

        let code = details.customerId ? `ID: ${details.customerId}` :
            details.employeeId ? `ID: ${details.employeeId}` :
            details.productId ? `Code: ${details.productId}` : null;

        if (!code) {
            const codeMatch = desc.match(/(?:Customer|Employee)\s*Id:?\s*["']?([^"',\]]+)["']?/i);
            if (codeMatch && !/^[a-f0-9]{24}$/i.test(codeMatch[1].trim())) {
                code = `ID: ${codeMatch[1].trim()}`;
            }
        }

        const isOrigPi = (mod === 'PI') && (action === 'UPDATE_ORIGINAL' || details.isOriginalPi || details.piTargetType === 'Original PI' || !details.isRevision);
        const isCnfComm = details.isCnfCommissionUpdate === true || mod === 'C&F' || (typeof desc === 'string' && desc.toLowerCase().includes('c&f commission')) || Boolean(details.cnfName);
        const updatePrefix = isOrigPi ? 'Updated Original' : 'Updated';
        let baseDesc = '';
        if (isCnfComm) {
            const cName = details.cnfName || details.indianCnF || details.bdCnf || name;
            const cPart = cName ? ` ("${cName}")` : '';
            baseDesc = `Updated C&F Commission${refPart ? `: ${refPart}` : ''}${cPart}`;
        } else if (refPart && namePart) {
            baseDesc = `${updatePrefix} ${mod}: ${refPart} ${namePart}`;
        } else if (refPart) {
            baseDesc = `${updatePrefix} ${mod}: ${refPart}`;
        } else if (namePart && code) {
            baseDesc = `${updatePrefix} ${mod}: ${namePart} (${code})`;
        } else if (namePart) {
            baseDesc = `${updatePrefix} ${mod}: ${namePart}`;
        } else {
            baseDesc = `${updatePrefix} ${mod}`;
        }

        // Append specific changed fields if recorded in details._updatedFields
        const ignoredDiffKeys = new Set(['id', '_id', 'updatedat', 'revisions', 'lastrevisedat', 'pirevision', 'isrevision', 'currentreviseno', 'actiontype', 'editingrevisionno', 'currenttotalqty', 'currenttotaltrucks', 'totaltrucks', 'totalqty']);
        const rawUpd = Array.isArray(details._updatedFields) && details._updatedFields.length > 0 ? details._updatedFields : [];
        const upd = rawUpd.filter(f => !ignoredDiffKeys.has((f.field || '').toLowerCase()));
        if (upd.length > 0) {
            if (upd.length === 1) {
                const f = upd[0];
                return `${baseDesc} • Changed ${f.label}: ${f.oldValue ? `${f.oldValue} ➔ ` : ''}${f.value}`.trim();
            } else if (upd.length <= 3) {
                return `${baseDesc} • Changed: ${upd.map(f => `${f.label} (${f.value})`).join(', ')}`.trim();
            } else {
                return `${baseDesc} • Changed ${upd.slice(0, 2).map(f => f.label).join(', ')} and ${upd.length - 2} other fields`.trim();
            }
        }
        return baseDesc;
    }

    // Deletes
    if (action === 'DELETE' || desc.startsWith('Deleted ')) {
        let inv = details.invoiceNo;
        if (!inv) {
            const invMatch = desc.match(/(?:Invoice|Order|LC|PI|Challan)\s*No:?\s*["']?([^"',\]]+)["']?/i);
            if (invMatch) inv = invMatch[1].trim();
        }
        const invPart = inv ? `Invoice #${inv}` : '';

        let name = details.customerName || details.companyName || details.name || details.productName || details.employeeName || details.supplierName || details.value || details.label || '';
        if (!name) {
            const nameMatch = desc.match(/Deleted\s+[^:]+:\s*(?:[^#]+#\S+\s+)?\("([^"]+)"\)/i) || desc.match(/"([^"]+)"/);
            if (nameMatch) name = nameMatch[1].trim();
        }
        const namePart = name ? `("${name}")` : '';

        let code = details.customerId ? `ID: ${details.customerId}` :
            details.employeeId ? `ID: ${details.employeeId}` :
            details.productId ? `Code: ${details.productId}` :
            details.category ? `Category: ${details.category}` : null;

        if (invPart && namePart) {
            return `Deleted ${mod}: ${invPart} (${namePart})`;
        } else if (invPart) {
            return `Deleted ${mod}: ${invPart}`;
        } else if (namePart && code) {
            return `Deleted ${mod}: "${name}" (${code})`;
        } else if (namePart) {
            return `Deleted ${mod}: "${name}"`;
        } else if (code) {
            return `Deleted ${mod} (${code})`;
        }
        return desc;
    }

    // Strip bracket dumps: [Updated: ...] or (Updated: ...) or (Filled: ...)
    let cleaned = desc
        .replace(/\s*\[Updated:\s*[^\]]*\]/gi, '')
        .replace(/\s*\(Updated:\s*[^)]*\)/gi, '')
        .replace(/\s*\(Filled:\s*[^)]*\)/gi, '')
        .replace(/\s*\((?:Filled|Updated):\s*Data:\s*"U2FsdGVkX1[^"]*"\)/gi, '')
        .replace(/"U2FsdGVkX1[^"]*"/gi, '');

    return cleaned.trim();
};

const getLogFilledFields = (log) => {
    if (!log) return [];
    const action = getLogAction(log);
    const details = log.details;
    let targetObj = (details && typeof details === 'object') ? details : {};

    // Check if payload is encrypted
    if (typeof targetObj.data === 'string' && isEncryptedString(targetObj.data)) {
        try {
            const dec = decryptData(targetObj.data);
            if (dec && typeof dec === 'object') targetObj = dec;
        } catch (e) {}
    } else if (typeof targetObj.payload === 'string' && isEncryptedString(targetObj.payload)) {
        try {
            const dec = decryptData(targetObj.payload);
            if (dec && typeof dec === 'object') targetObj = dec;
        } catch (e) {}
    } else if (targetObj.data && typeof targetObj.data === 'object' && !Array.isArray(targetObj.data)) {
        targetObj = targetObj.data;
    }

    // For UI Click actions, extract contextual references and metadata
    if (action === 'CLICK' || log.actionCategory === 'UI_CLICK') {
        const list = [];
        const desc = typeof log.description === 'string' ? log.description : '';

        // Receipt No
        let rc = targetObj.receiptNo || targetObj.receipt;
        if (!rc && desc) {
            const m = desc.match(/(RC-\d+)/i) || desc.match(/Receipt #?([A-Z0-9_-]+)/i);
            if (m) rc = m[1].trim();
        }
        if (rc) list.push({ field: 'receiptNo', label: 'Receipt No', value: String(rc) });

        // Order No
        let ord = targetObj.orderNo;
        if (!ord && desc) {
            const m = desc.match(/Order #?([A-Z0-9_-]+)/i) || desc.match(/\((ORD[0-9]+)\s*[-–]/i);
            if (m) ord = m[1].trim();
        }
        if (ord) list.push({ field: 'orderNo', label: 'Order No', value: String(ord) });

        // Invoice No
        let inv = targetObj.invoiceNo;
        if (!inv && desc) {
            const m = desc.match(/Invoice #?([A-Z0-9_-]+)/i) ||
                      desc.match(/[-–]\s*(GS[0-9]+|BS[0-9]+|INV[0-9]+)/i) ||
                      desc.match(/\((GS[0-9]+|BS[0-9]+|INV[0-9]+)\)/i);
            if (m) inv = m[1].trim();
        }
        if (inv) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(inv) });

        // Customer / Party Name
        let cust = targetObj.customerName || targetObj.companyName || targetObj.partyName || targetObj.name;
        if (!cust && desc) {
            const m = desc.match(/\("([^"]+)"\)/) || desc.match(/[-–]\s*([A-Z\s]{3,})\)/i);
            if (m && !/^(GS|BS|ORD|INV)/i.test(m[1].trim())) {
                cust = m[1].trim();
            } else {
                const clickMatch = desc.match(/User clicked "([^"]+)"/i);
                if (clickMatch && !/^(Save|Edit|Delete|View|Create|Accept|Reject|\+|Card)/i.test(clickMatch[1].trim()) && !/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(clickMatch[1].trim())) {
                    cust = clickMatch[1].trim();
                }
            }
        }
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });

        // Total Amount
        let amt = targetObj.totalAmount || targetObj.amount;
        if (!amt && desc) {
            const m = desc.match(/[৳$]([\d,]+(?:\.\d{2})?)/) ||
                      desc.match(/(?:Total|Amount)[\s:]*([৳$]?[\d,]+(?:\.\d{2})?)/i);
            if (m) amt = m[1].replace(/,/g, '');
        }
        if (amt && !isNaN(Number(amt))) {
            list.push({ field: 'totalAmount', label: 'Total Amount', value: `৳${Number(amt).toLocaleString('en-IN')}` });
        } else if (amt) {
            list.push({ field: 'totalAmount', label: 'Total Amount', value: String(amt) });
        }

        // Date
        let dVal = targetObj.date;
        if (!dVal && desc) {
            const m = desc.match(/[\[\(](\d{1,2}[/-]\d{1,2}[/-]\d{2,4})[\]\)]/);
            if (m) dVal = m[1];
        }
        if (dVal) list.push({ field: 'date', label: 'Date', value: String(dVal) });

        // Sale Type
        const sType = targetObj.saleType || (desc.includes('Border Sale') ? 'Border' : desc.includes('General Sale') ? 'General' : null);
        if (sType) list.push({ field: 'saleType', label: 'Sale Type', value: `${sType} Sale` });

        // Status
        if (targetObj.status) list.push({ field: 'status', label: 'Status', value: String(targetObj.status) });

        // View / Section
        if (targetObj.view && typeof targetObj.view === 'string') {
            const formatted = targetObj.view.replace(/-section$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            list.push({ field: 'moduleSection', label: 'Section', value: formatted });
        }

        return list;
    }

    // For Accept actions
    if (action === 'ACCEPT') {
        const list = [];
        let inv = targetObj.invoiceNo;
        if (!inv && typeof log.description === 'string') {
            const m = log.description.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i) || log.description.match(/Invoice #?([A-Z0-9_-]+)/i);
            if (m) inv = m[1].trim();
        }
        if (inv) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(inv) });

        let ord = targetObj.orderNo;
        if (!ord && typeof log.description === 'string') {
            const m = log.description.match(/Order #?([A-Z0-9_-]+)/i);
            if (m) ord = m[1].trim();
        }
        if (ord) list.push({ field: 'orderNo', label: 'Order No', value: String(ord) });

        let cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (!cust && typeof log.description === 'string') {
            const m = log.description.match(/Updated\s+(?:Sales|Customer|PI):\s*"([^"]+)"/i) || log.description.match(/\("([^"]+)"\)/);
            if (m) cust = m[1].trim();
        }
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });

        list.push({ field: 'status', label: 'Status', value: targetObj.status || 'Accepted' });
        const by = targetObj.acceptedBy || targetObj.acceptedByName || log.displayName || log.username;
        if (by) list.push({ field: 'acceptedBy', label: 'Accepted By', value: String(by) });
        if (targetObj.totalAmount) list.push({ field: 'totalAmount', label: 'Total Amount', value: formatFieldValue(targetObj.totalAmount) });
        return list;
    }

    // For Approval actions, provide focused summary fields rather than dumping 35 database fields
    if (action === 'APPROVE') {
        const list = [];
        let inv = targetObj.invoiceNo;
        if (!inv && typeof log.description === 'string') {
            const m = log.description.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i) || log.description.match(/Invoice #?([A-Z0-9_-]+)/i);
            if (m) inv = m[1].trim();
        }
        if (inv) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(inv) });

        let cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (!cust && typeof log.description === 'string') {
            const m = log.description.match(/Updated\s+(?:Sales|Customer|PI):\s*"([^"]+)"/i) || log.description.match(/"([^"]+)"/);
            if (m) cust = m[1].trim();
        }
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });

        if (targetObj.status) list.push({ field: 'status', label: 'Status', value: String(targetObj.status) });
        const by = targetObj.approvedByName || targetObj.approvedBy || targetObj.acceptedBy || log.displayName || log.username;
        if (by) list.push({ field: 'approvedBy', label: 'Approved By', value: String(by) });
        if (targetObj.totalAmount) list.push({ field: 'totalAmount', label: 'Total Amount', value: formatFieldValue(targetObj.totalAmount) });
        return list;
    }

    // For Rejection actions
    if (action === 'REJECT') {
        const list = [];
        let inv = targetObj.invoiceNo;
        if (!inv && typeof log.description === 'string') {
            const m = log.description.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i) || log.description.match(/Invoice #?([A-Z0-9_-]+)/i);
            if (m) inv = m[1].trim();
        }
        if (inv) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(inv) });

        let cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (!cust && typeof log.description === 'string') {
            const m = log.description.match(/\("([^"]+)"\)/) || log.description.match(/Updated\s+(?:Sales|Customer|PI):\s*"([^"]+)"/i);
            if (m) cust = m[1].trim();
        }
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });

        list.push({ field: 'status', label: 'Status', value: 'Rejected' });
        const by = targetObj.rejectedBy || log.displayName || log.username;
        if (by) list.push({ field: 'rejectedBy', label: 'Rejected By', value: String(by) });
        let reason = targetObj.rejectionReason;
        if (!reason && typeof log.description === 'string') {
            const m = log.description.match(/Reason:\s*"([^"]+)"/i);
            if (m) reason = m[1].trim();
        }
        if (reason) list.push({ field: 'rejectionReason', label: 'Reason', value: String(reason) });
        return list;
    }

    // For Card Open, Close, and Discard actions
    if (action === 'CARD OPEN' || action === 'CARD CLOSE' || action === 'CARD CLOSE (NO SAVE)' || action === 'DISCARD') {
        const list = [];
        let inv = targetObj.invoiceNo;
        if (!inv && typeof log.description === 'string') {
            const m = log.description.match(/Invoice #?([A-Z0-9_-]+)/i) || log.description.match(/Invoice No:?\s*["']?([^"',\]]+)["']?/i);
            if (m) inv = m[1].trim();
        }
        if (inv) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(inv) });

        let cust = targetObj.customerName || targetObj.companyName || targetObj.name;
        if (!cust && typeof log.description === 'string') {
            const m = log.description.match(/\("([^"]+)"\)/);
            if (m) cust = m[1].trim();
        }
        if (cust) list.push({ field: 'customerName', label: 'Customer', value: String(cust) });

        if (action === 'CARD CLOSE (NO SAVE)' || targetObj.actionType === 'DISCARD_ENTRY' || targetObj.wasCreated === false || log.description?.includes('without creating')) {
            list.push({ field: 'cardState', label: 'Card State', value: 'Closed Without Save' });
            list.push({ field: 'result', label: 'Result', value: 'Discarded without creating' });
        } else if (targetObj.actionType === 'OPEN_CREATE_FORM' || targetObj.cardType === 'create' || log.description?.includes('new entry card')) {
            list.push({ field: 'cardState', label: 'Card State', value: 'Opened For New Entry' });
        } else {
            list.push({ field: 'cardState', label: 'Card State', value: action === 'CARD OPEN' ? 'Opened' : 'Closed' });
        }
        return list;
    }

    // For Create actions, extract clean summary fields
    if (action === 'CREATE') {
        const list = [];
        const ip = targetObj.ipNumber || targetObj.ipNo;
        if (ip) list.push({ field: 'ipNumber', label: 'IP Number', value: String(ip) });
        const refNo = targetObj.referenceNo;
        if (refNo) list.push({ field: 'referenceNo', label: 'Reference No', value: String(refNo) });
        const party = targetObj.ipParty || targetObj.importerName;
        if (party) list.push({ field: 'ipParty', label: 'IP Party / Importer', value: String(party) });
        const prod = targetObj.productName;
        if (prod) list.push({ field: 'productName', label: 'Product', value: String(prod) });
        const port = targetObj.port;
        if (port) list.push({ field: 'port', label: 'Port', value: String(port) });
        const qty = targetObj.quantity;
        if (qty) list.push({ field: 'quantity', label: 'Quantity', value: formatFieldValue(qty) });
        const openD = targetObj.openingDate;
        if (openD) list.push({ field: 'openingDate', label: 'Opening Date', value: String(openD) });
        const closeD = targetObj.closeDate;
        if (closeD) list.push({ field: 'closeDate', label: 'Expiry Date', value: String(closeD) });
        const pi = targetObj.piNumber || targetObj.piNo || targetObj.piNumbers;
        if (pi) list.push({ field: 'piNumber', label: 'PI No', value: String(pi) });
        const lc = targetObj.lcNo || targetObj.lcNumber;
        if (lc) list.push({ field: 'lcNo', label: 'LC No', value: String(lc) });
        const inv = targetObj.invoiceNo || targetObj.invoiceNumber;
        if (inv) list.push({ field: 'invoiceNo', label: 'Invoice No', value: String(inv) });
        const ord = targetObj.orderNo || targetObj.orderNumber;
        if (ord) list.push({ field: 'orderNo', label: 'Order No', value: String(ord) });
        const challan = targetObj.challanNo || targetObj.challanNumber;
        if (challan) list.push({ field: 'challanNo', label: 'Challan No', value: String(challan) });

        const name = targetObj.customerName || targetObj.companyName || targetObj.name || targetObj.supplierName || targetObj.importerName || targetObj.exporterName || targetObj.employeeName || targetObj.bankName || targetObj.warehouseName || targetObj.warehouse;
        if (name && !party && !prod) list.push({ field: 'name', label: 'Entity / Name', value: String(name) });
        if (targetObj.accountNumber || targetObj.accountNo) list.push({ field: 'accountNumber', label: 'Account No', value: String(targetObj.accountNumber || targetObj.accountNo) });
        if (targetObj.accountName) list.push({ field: 'accountName', label: 'Account Name', value: String(targetObj.accountName) });
        if (targetObj.branch) list.push({ field: 'branch', label: 'Branch', value: String(targetObj.branch) });
        if (targetObj.reason) list.push({ field: 'reason', label: 'Reason', value: String(targetObj.reason) });
        if (targetObj.damageNo) list.push({ field: 'damageNo', label: 'Damage No', value: String(targetObj.damageNo) });
        if (targetObj.warehouse && targetObj.warehouse !== name) list.push({ field: 'warehouse', label: 'Warehouse', value: String(targetObj.warehouse) });
        if (targetObj.totalAmount || targetObj.grandTotal || targetObj.amount) {
            list.push({ field: 'totalAmount', label: 'Total Amount', value: formatFieldValue(targetObj.totalAmount || targetObj.grandTotal || targetObj.amount) });
        }
        if (targetObj.paidAmount !== undefined && targetObj.paidAmount !== null && targetObj.paidAmount !== '') {
            list.push({ field: 'paidAmount', label: 'Paid Amount', value: formatFieldValue(targetObj.paidAmount) });
        }
        if (targetObj.status) list.push({ field: 'status', label: 'Status', value: String(targetObj.status) });

        // Fallback for IP creation if details were minimal
        if (list.length === 0 && (log.module === 'IP' || log.path?.includes('/ip-records'))) {
            const desc = log.description || '';
            const ipMatch = desc.match(/IP\s*#?([A-Za-z0-9_-]+)/i);
            if (ipMatch) list.push({ field: 'ipNumber', label: 'IP Number', value: ipMatch[1].trim() });
            const partyMatch = desc.match(/\("([^"]+)"\)/) || desc.match(/"([^"]+)"/);
            if (partyMatch) list.push({ field: 'ipParty', label: 'IP Party / Importer', value: partyMatch[1].trim() });
        }

        if (list.length > 0) return list;
    }

    // For Close actions
    if (action === 'CLOSE') {
        const list = [];
        if (targetObj.invoiceNo || targetObj.orderNo || targetObj.lcNo) {
            list.push({ field: 'referenceNo', label: 'Reference No', value: String(targetObj.invoiceNo || targetObj.orderNo || targetObj.lcNo) });
        }
        list.push({ field: 'status', label: 'Status', value: 'Closed' });
        const by = targetObj.closedBy || log.displayName || log.username;
        if (by) list.push({ field: 'closedBy', label: 'Closed By', value: String(by) });
        return list;
    }

    // For UPDATE and REVISE actions: STRICTLY return only actual modified / differential fields
    if (action === 'UPDATE' || action === 'UPDATE_ORIGINAL' || action === 'REVISE' || action === 'REVISED') {
        const mapFieldLabels = (fields) => {
            return (fields || [])
                .filter(f => !['revisions', 'pirevision', 'lastrevisedat', 'isrevision', 'currentreviseno', 'actiontype', 'id', '_id', 'updatedat', 'iscnfcommissionupdate', 'indcommissionedited', 'bdcommissionedited', 'indcnfedited', 'indcnfbulkedited', 'cnfname', 'currenttotalqty', 'currenttotaltrucks', 'totaltrucks', 'totalqty'].includes((f.field || '').toLowerCase()))
                .map(f => {
                    let label = f.label;
                    if (!label || label === f.field) {
                        label = FIELD_LABEL_MAP[f.field] || f.label;
                    } else if (label === 'Products List') {
                        label = 'Products';
                    } else if (label === 'Ip Numbers') {
                        label = 'IP Numbers';
                    }
                    return {
                        ...f,
                        label
                    };
                });
        };

        if (Array.isArray(log.details?._updatedFields) && log.details._updatedFields.length > 0) {
            return mapFieldLabels(log.details._updatedFields);
        }
        if (Array.isArray(log.details?._filledFields) && log.details._filledFields.length > 0) {
            const clean = log.details._filledFields.filter(
                f => !IGNORED_KEYS.has((f.field || '').toLowerCase()) && !['iscnfcommissionupdate', 'indcommissionedited', 'bdcommissionedited', 'indcnfedited', 'indcnfbulkedited', 'cnfname'].includes((f.field || '').toLowerCase()) && !isEncryptedString(f.value) && !/^[a-f0-9]{24}$/i.test(f.value)
            );
            // If it was a legacy full-payload dump with > 5 fields, don't show whole record
            if (clean.length > 5) {
                const operationalKeys = new Set(['truckno', 'challanno', 'rate', 'quantity', 'unitprice', 'totalamount', 'paidamount', 'dueamount', 'discount', 'paymentmethod', 'remarks', 'department', 'designation', 'salary', 'phone', 'email', 'grandtotal', 'grandtotalquantity', 'productslist', 'ipnumbers', 'accountno', 'accountname', 'branch', 'bankname', 'indcommissionrate', 'indcommissionuom', 'indcommissiontotal', 'bdcommissionrate', 'bdcommissionuom', 'bdcommissiontotal', 'indcnfcomm', 'indcnfcost', 'indcnfuom', 'bdcnfcomm', 'bdcnfcost', 'bdcnfuom']);
                return mapFieldLabels(clean.filter(f => operationalKeys.has((f.field || '').toLowerCase())));
            }
            return mapFieldLabels(clean);
        }
        return [];
    }

    // For DELETE actions: return identity fields of the deleted record
    if (action === 'DELETE') {
        if (Array.isArray(log.details?._filledFields) && log.details._filledFields.length > 0) {
            return log.details._filledFields;
        }
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
        if (targetObj.role) list.push({ field: 'role', label: 'Role', value: String(targetObj.role) });
        return list;
    }

    // If pre-calculated updated fields exist (from differential logging), use them directly
    if (Array.isArray(log.details?._updatedFields) && log.details._updatedFields.length > 0) {
        return log.details._updatedFields;
    }

    // If pre-calculated filled fields exist
    if (Array.isArray(log.details?._filledFields) && log.details._filledFields.length > 0) {
        let clean = log.details._filledFields.filter(
            f => !IGNORED_KEYS.has((f.field || '').toLowerCase()) && !isEncryptedString(f.value) && !/^[a-f0-9]{24}$/i.test(f.value)
        );
        if (clean.length > 0) return clean;
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

const getCleanDetails = (details) => {
    if (!details || typeof details !== 'object') return {};
    let copy = { ...details };
    delete copy._filledFields;

    // If data or payload is encrypted, decrypt so user sees readable payload in modal
    if (typeof copy.data === 'string' && isEncryptedString(copy.data)) {
        try {
            const dec = decryptData(copy.data);
            if (dec && typeof dec === 'object') return dec;
        } catch (e) {}
    }
    if (typeof copy.payload === 'string' && isEncryptedString(copy.payload)) {
        try {
            const dec = decryptData(copy.payload);
            if (dec && typeof dec === 'object') return dec;
        } catch (e) {}
    }

    return copy;
};

const LogManagement = ({ currentUser: _currentUser, addNotification }) => {
    // Data states
    const [logs, setLogs] = useState([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [stats, setStats] = useState({
        totalLogs: 0,
        todayLogs: 0,
        todayActiveUsers: 0,
        storageSize: '0.5 MB',
        dataSize: '0 KB',
        categories: {},
        actions: {}
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters state
    const [activeCategory, setActiveCategory] = useState('ALL'); // ALL, MUTATION, APPROVAL, AUTH, UI_CLICK
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState('ALL');
    const [selectedModule, setSelectedModule] = useState('ALL');
    const getTodayStr = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [datePreset, setDatePreset] = useState('TODAY'); // ALL, TODAY, YESTERDAY, 7DAYS, 30DAYS, CUSTOM
    const [startDate, setStartDate] = useState(getTodayStr());
    const [endDate, setEndDate] = useState(getTodayStr());

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);

    // Auto-refresh interval (in seconds, 0 = off)
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(15);
    const timerRef = useRef(null);

    // Modal states
    const [selectedLog, setSelectedLog] = useState(null);
    const [showClearModal, setShowClearModal] = useState(false);
    const [clearOlderThan, setClearOlderThan] = useState('30');
    const [clearAllConfirm, setClearAllConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    // List of distinct users and modules for filter dropdowns
    const [userOptions, setUserOptions] = useState([]);
    const [moduleOptions, setModuleOptions] = useState([]);

    // Custom popover dropdown states
    const [openDropdown, setOpenDropdown] = useState(null); // 'user', 'module', 'refresh', 'limit', null
    const userDropdownRef = useRef(null);
    const moduleDropdownRef = useRef(null);
    const autoRefreshRef = useRef(null);
    const limitRef = useRef(null);
    const [userSearchText, setUserSearchText] = useState('');
    const [moduleSearchText, setModuleSearchText] = useState('');

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                (userDropdownRef.current && userDropdownRef.current.contains(event.target)) ||
                (moduleDropdownRef.current && moduleDropdownRef.current.contains(event.target)) ||
                (autoRefreshRef.current && autoRefreshRef.current.contains(event.target)) ||
                (limitRef.current && limitRef.current.contains(event.target))
            ) {
                return;
            }
            setOpenDropdown(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate dates based on preset
    useEffect(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (datePreset === 'TODAY') {
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (datePreset === 'YESTERDAY') {
            const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
            setStartDate(yestStr);
            setEndDate(yestStr);
        } else if (datePreset === '7DAYS') {
            const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const past7Str = `${past7.getFullYear()}-${String(past7.getMonth() + 1).padStart(2, '0')}-${String(past7.getDate()).padStart(2, '0')}`;
            setStartDate(past7Str);
            setEndDate(todayStr);
        } else if (datePreset === '30DAYS') {
            const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const past30Str = `${past30.getFullYear()}-${String(past30.getMonth() + 1).padStart(2, '0')}-${String(past30.getDate()).padStart(2, '0')}`;
            setStartDate(past30Str);
            setEndDate(todayStr);
        } else if (datePreset === 'ALL') {
            setStartDate('');
            setEndDate('');
        }
        setPage(1);
    }, [datePreset]);

    // Fetch logs from backend
    const fetchLogs = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            const queryParams = new URLSearchParams();
            queryParams.append('page', page);
            queryParams.append('limit', limit);
            if (searchTerm.trim()) queryParams.append('search', searchTerm.trim());
            if (selectedUser && selectedUser !== 'ALL') queryParams.append('user', selectedUser);
            if (selectedModule && selectedModule !== 'ALL') queryParams.append('module', selectedModule);
            if (activeCategory && activeCategory !== 'ALL') queryParams.append('category', activeCategory);
            if (startDate) queryParams.append('startDate', startDate);
            if (endDate) queryParams.append('endDate', endDate);

            const url = `/api/logs?${queryParams.toString()}`;

            const [logsRes, statsRes] = await Promise.all([
                axios.get(url),
                axios.get('/api/logs/stats')
            ]);

            if (logsRes.data?.success) {
                const fetchedLogs = (logsRes.data.logs || []).filter(l => 
                    l.module !== 'Notification' && 
                    !l.path?.includes('/notifications') &&
                    !l.description?.toLowerCase().includes('notification')
                );
                setLogs(fetchedLogs);
                setTotalLogs(logsRes.data.total || 0);
                setTotalPages(logsRes.data.totalPages || 1);

                // Collect distinct users & modules from current batch as fallback
                setUserOptions(prev => {
                    const set = new Set(prev);
                    fetchedLogs.forEach(l => { if (l.username) set.add(l.username); });
                    return Array.from(set).sort();
                });

                setModuleOptions(prev => {
                    const set = new Set(prev);
                    fetchedLogs.forEach(l => { if (l.module && l.module !== 'Notification') set.add(l.module); });
                    return Array.from(set).filter(m => m !== 'Notification').sort();
                });
            }

            if (statsRes.data?.success) {
                setStats({
                    totalLogs: statsRes.data.totalLogs || 0,
                    todayLogs: statsRes.data.todayLogs || 0,
                    todayActiveUsers: statsRes.data.todayActiveUsers || 0,
                    storageSize: statsRes.data.storageSize || '0.5 MB',
                    dataSize: statsRes.data.dataSize || '0 KB',
                    categories: statsRes.data.categories || {},
                    actions: statsRes.data.actions || {}
                });

                // Set complete list of distinct users and modules across all logs
                if (Array.isArray(statsRes.data.distinctUsers) && statsRes.data.distinctUsers.length > 0) {
                    setUserOptions(statsRes.data.distinctUsers);
                }
                if (Array.isArray(statsRes.data.distinctModules) && statsRes.data.distinctModules.length > 0) {
                    setModuleOptions(statsRes.data.distinctModules.filter(m => m && m !== 'Notification'));
                }
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
            if (addNotification) {
                addNotification('Failed to load activity logs', 'error');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // Trigger fetch on dependencies change
    useEffect(() => {
        fetchLogs(true);
    }, [page, limit, activeCategory, selectedUser, selectedModule, startDate, endDate]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchLogs(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Auto-refresh interval
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (autoRefreshInterval > 0) {
            timerRef.current = setInterval(() => {
                fetchLogs(false);
            }, autoRefreshInterval * 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [autoRefreshInterval, page, limit, activeCategory, selectedUser, selectedModule, startDate, endDate, searchTerm]);

    // Format relative time
    const formatTimeAgo = (isoDate) => {
        if (!isoDate) return 'Just now';
        const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
        if (diff < 60) return `${diff < 5 ? 'Just now' : diff + 's ago'}`;
        const mins = Math.floor(diff / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(isoDate).toLocaleDateString();
    };

    // Action Badge styling
    const getActionBadge = (action) => {
        const act = (action || '').toUpperCase();
        if (act === 'CREATE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    NEW ENTRY
                </span>
            );
        }
        if (act === 'UPDATE_ORIGINAL') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    EDIT ORIGINAL
                </span>
            );
        }
        if (act === 'UPDATE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    EDIT
                </span>
            );
        }
        if (act === 'REVISE' || act === 'REVISED') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
                    REVISED
                </span>
            );
        }
        if (act === 'DELETE_REVISION') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    DEL REVISION
                </span>
            );
        }
        if (act === 'DELETE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    DELETE
                </span>
            );
        }
        if (act === 'ACCEPT') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                    ACCEPT
                </span>
            );
        }
        if (act === 'APPROVE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    APPROVE
                </span>
            );
        }
        if (act === 'REJECT') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    REJECT
                </span>
            );
        }
        if (act === 'CARD OPEN' || act === 'CARD_OPEN') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                    CARD OPEN
                </span>
            );
        }
        if (act === 'CARD CLOSE' || act === 'CARD_CLOSE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    CARD CLOSE
                </span>
            );
        }
        if (act === 'CARD CLOSE (NO SAVE)' || act === 'DISCARD' || act === 'DISCARD_ENTRY') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    CLOSED (NO SAVE)
                </span>
            );
        }
        if (act === 'CLOSE') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    CLOSE
                </span>
            );
        }
        if (act === 'LOGIN' || act === 'LOGOUT') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs">
                    {act}
                </span>
            );
        }
        if (act === 'CLICK') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">CLICK</span>;
        }
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">{act}</span>;
    };

    // Module Badge styling
    const getModuleBadge = (mod) => {
        const colors = [
            'bg-sky-50 text-sky-700 border-sky-200',
            'bg-indigo-50 text-indigo-700 border-indigo-200',
            'bg-emerald-50 text-emerald-700 border-emerald-200',
            'bg-amber-50 text-amber-700 border-amber-200',
            'bg-purple-50 text-purple-700 border-purple-200',
            'bg-teal-50 text-teal-700 border-teal-200'
        ];
        let hash = 0;
        const str = mod || 'System';
        for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
        const colorClass = colors[hash % colors.length];

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
                {str}
            </span>
        );
    };

    // Export logs to CSV
    const handleExportCSV = () => {
        if (logs.length === 0) {
            if (addNotification) addNotification('No logs to export', 'warning');
            return;
        }

        const headers = ['Timestamp', 'Username', 'Role', 'Module', 'Action', 'Category', 'Description', 'IP', 'Status'];
        const rows = logs.map(l => [
            `"${new Date(l.timestamp).toISOString()}"`,
            `"${l.username || ''}"`,
            `"${l.userRole || ''}"`,
            `"${l.module || ''}"`,
            `"${l.action || ''}"`,
            `"${l.actionCategory || ''}"`,
            `"${(l.description || '').replace(/"/g, '""')}"`,
            `"${l.ip || ''}"`,
            `"${l.status || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `system_logs_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (addNotification) addNotification('Exported logs to CSV successfully', 'success');
    };

    // Purge / Clear logs
    const handleClearLogs = async () => {
        setIsClearing(true);
        try {
            const body = clearAllConfirm ? { all: true } : { olderThanDays: parseInt(clearOlderThan) || 30 };
            const res = await axios.delete('/api/logs/clear', { data: body });

            if (res.data?.success) {
                if (addNotification) addNotification(res.data.message || 'Logs cleared successfully', 'success');
                setShowClearModal(false);
                setClearAllConfirm(false);
                fetchLogs(true);
            }
        } catch (err) {
            console.error('Error clearing logs:', err);
            if (addNotification) addNotification('Failed to clear logs: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Top Header Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                        <ActivityLogIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight">System Operation & Audit Logs</h1>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Tracking
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                Storage: {stats.storageSize || '0.5 MB'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Comprehensive record of all user operations, mutations, approvals, and interface interactions
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Auto refresh dropdown button */}
                    <div className="relative" ref={autoRefreshRef}>
                        <button
                            type="button"
                            onClick={() => setOpenDropdown(prev => prev === 'refresh' ? null : 'refresh')}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shadow-xs ${
                                openDropdown === 'refresh'
                                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                            <span>
                                {autoRefreshInterval === 0 ? 'Auto-Refresh: Paused' : `Auto-Refresh: Every ${autoRefreshInterval}s`}
                            </span>
                            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${openDropdown === 'refresh' ? 'rotate-180 text-blue-600' : ''}`} />
                        </button>
                        {openDropdown === 'refresh' && (
                            <div className="absolute right-0 mt-1.5 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                                {[
                                    { val: 0, label: 'Paused' },
                                    { val: 10, label: 'Every 10 seconds' },
                                    { val: 15, label: 'Every 15 seconds' },
                                    { val: 30, label: 'Every 30 seconds' },
                                    { val: 60, label: 'Every 60 seconds' }
                                ].map(opt => (
                                    <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => {
                                            setAutoRefreshInterval(opt.val);
                                            setOpenDropdown(null);
                                        }}
                                        className={`w-full px-3.5 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                            autoRefreshInterval === opt.val
                                                ? 'bg-blue-50 text-blue-700 font-bold'
                                                : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span>{opt.label}</span>
                                        {autoRefreshInterval === opt.val && (
                                            <CheckIcon className="w-3.5 h-3.5 text-blue-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => fetchLogs(false)}
                        disabled={isRefreshing || isLoading}
                        title="Refresh now"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
                    >
                        <RefreshIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                        Refresh
                    </button>

                    {/* Export CSV Button */}
                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                        <DownloadIcon className="w-3.5 h-3.5 text-slate-600" />
                        Export CSV
                    </button>

                    {/* Clear Logs Button (Admin only) */}
                    <button
                        onClick={() => setShowClearModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors shadow-2xs"
                    >
                        <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                        Clear Logs
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* KPI Metrics Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Operations */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Operations</span>
                            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                <ActivityLogIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-slate-800 tracking-tight">
                            {stats.totalLogs.toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            All recorded actions • {stats.storageSize || '0.5 MB'}
                        </p>
                    </div>

                    {/* Operations Today */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Operations</span>
                            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                <CalendarIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
                            {stats.todayLogs.toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Activity since midnight</p>
                    </div>

                    {/* Active Users Today */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Users Today</span>
                            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                <UserIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-indigo-600 tracking-tight">
                            {stats.todayActiveUsers}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Distinct users logged in</p>
                    </div>

                    {/* Action Breakdown */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key Breakdown</span>
                            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                <ShieldIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                                {stats.actions?.CREATE || 0} Creates
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                                {stats.actions?.UPDATE || 0} Updates
                            </span>
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-100">
                                {stats.actions?.DELETE || 0} Deletes
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Data modifications distribution</p>
                    </div>
                </div>

                {/* Category Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
                    {[
                        { key: 'ALL', label: 'All Operations', count: stats.totalLogs },
                        { key: 'MUTATION', label: 'Data Changes (CRUD)', count: stats.categories?.MUTATION || 0 },
                        { key: 'APPROVAL', label: 'Approvals & Requests', count: stats.categories?.APPROVAL || 0 },
                        { key: 'AUTH', label: 'Logins & Auth', count: stats.categories?.AUTH || 0 },
                        { key: 'UI_CLICK', label: 'User Clicks & Actions', count: stats.categories?.UI_CLICK || 0 },
                        { key: 'SYSTEM', label: 'System & Backups', count: stats.categories?.SYSTEM || 0 }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => {
                                setActiveCategory(tab.key);
                                setPage(1);
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                                activeCategory === tab.key
                                    ? 'border-blue-600 text-blue-600 bg-white shadow-2xs font-bold'
                                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                                    activeCategory === tab.key
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-200/70 text-slate-600'
                                }`}>
                                    {tab.count.toLocaleString()}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Filter Toolbar */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        {/* Search Input */}
                        {/* Search Input */}
                        <div className="md:col-span-4 relative group">
                            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by keyword, user, module, IP..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-gray-200 hover:border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800 shadow-xs transition-all"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter by User Dropdown Button */}
                        <div className="md:col-span-2 relative" ref={userDropdownRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenDropdown(prev => prev === 'user' ? null : 'user');
                                    setUserSearchText('');
                                }}
                                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-xs font-semibold text-left flex items-center justify-between transition-all shadow-xs ${
                                    openDropdown === 'user'
                                        ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-700 bg-blue-50/20'
                                        : selectedUser !== 'ALL'
                                        ? 'border-blue-300 bg-blue-50/40 text-blue-700 font-bold'
                                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span className="truncate">
                                    {selectedUser === 'ALL' ? 'All Users' : selectedUser}
                                </span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 ml-1 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openDropdown === 'user' ? 'rotate-180 text-blue-500' : ''}`} />
                            </button>

                            {openDropdown === 'user' && (
                                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-64 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-150">
                                    {userOptions.length > 5 && (
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                type="text"
                                                placeholder="Search user..."
                                                value={userSearchText}
                                                onChange={(e) => setUserSearchText(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                    <div className="overflow-y-auto max-h-48 py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedUser('ALL');
                                                setPage(1);
                                                setOpenDropdown(null);
                                            }}
                                            className={`w-full px-3.5 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                                selectedUser === 'ALL' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span>All Users</span>
                                            {selectedUser === 'ALL' && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                        </button>
                                        {userOptions
                                            .filter(u => !userSearchText || u.toLowerCase().includes(userSearchText.toLowerCase()))
                                            .map(u => (
                                                <button
                                                    key={u}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setPage(1);
                                                        setOpenDropdown(null);
                                                    }}
                                                    className={`w-full px-3.5 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                                        selectedUser === u ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="truncate">{u}</span>
                                                    {selectedUser === u && <CheckIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Filter by Module Dropdown Button */}
                        <div className="md:col-span-2 relative" ref={moduleDropdownRef}>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenDropdown(prev => prev === 'module' ? null : 'module');
                                    setModuleSearchText('');
                                }}
                                className={`w-full px-3.5 py-2 bg-white border rounded-xl text-xs font-semibold text-left flex items-center justify-between transition-all shadow-xs ${
                                    openDropdown === 'module'
                                        ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-700 bg-blue-50/20'
                                        : selectedModule !== 'ALL'
                                        ? 'border-blue-300 bg-blue-50/40 text-blue-700 font-bold'
                                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <span className="truncate">
                                    {selectedModule === 'ALL' ? 'All Modules' : selectedModule}
                                </span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 ml-1 text-gray-400 flex-shrink-0 transition-transform duration-200 ${openDropdown === 'module' ? 'rotate-180 text-blue-500' : ''}`} />
                            </button>

                            {openDropdown === 'module' && (
                                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-64 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-150">
                                    {moduleOptions.length > 6 && (
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                type="text"
                                                placeholder="Search module..."
                                                value={moduleSearchText}
                                                onChange={(e) => setModuleSearchText(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full px-2.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}
                                    <div className="overflow-y-auto max-h-48 py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedModule('ALL');
                                                setPage(1);
                                                setOpenDropdown(null);
                                            }}
                                            className={`w-full px-3.5 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                                selectedModule === 'ALL' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span>All Modules</span>
                                            {selectedModule === 'ALL' && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                        </button>
                                        {moduleOptions
                                            .filter(m => !moduleSearchText || m.toLowerCase().includes(moduleSearchText.toLowerCase()))
                                            .map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedModule(m);
                                                        setPage(1);
                                                        setOpenDropdown(null);
                                                    }}
                                                    className={`w-full px-3.5 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                                        selectedModule === m ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <span className="truncate">{m}</span>
                                                    {selectedModule === m && <CheckIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Date Preset Buttons */}
                        <div className="md:col-span-4 flex items-center justify-end gap-1 flex-wrap">
                            {[
                                { key: 'ALL', label: 'All Time' },
                                { key: 'TODAY', label: 'Today' },
                                { key: 'YESTERDAY', label: 'Yesterday' },
                                { key: '7DAYS', label: '7 Days' },
                                { key: '30DAYS', label: '30 Days' },
                                { key: 'CUSTOM', label: 'Custom' }
                            ].map(btn => (
                                <button
                                    key={btn.key}
                                    onClick={() => setDatePreset(btn.key)}
                                    className={`px-2.5 py-1.5 text-2xs font-semibold rounded-md transition-colors ${
                                        datePreset === btn.key
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range Picker when CUSTOM is selected */}
                    {datePreset === 'CUSTOM' && (
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-xs">
                            <span className="text-slate-500 font-medium">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-slate-500 font-medium">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setDatePreset('ALL');
                                    }}
                                    className="text-xs text-rose-600 hover:underline ml-2"
                                >
                                    Clear dates
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Logs Table Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                                    <th className="py-3 px-4 w-36">Time</th>
                                    <th className="py-3 px-4 w-44">User</th>
                                    <th className="py-3 px-4 w-32">Module</th>
                                    <th className="py-3 px-4 w-28">Action</th>
                                    <th className="py-3 px-4">Operation Description</th>
                                    <th className="py-3 px-4 w-32">IP Address</th>
                                    <th className="py-3 px-4 w-20 text-center">Inspect</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-slate-400">
                                            <div className="inline-flex items-center gap-2">
                                                <RefreshIcon className="w-5 h-5 animate-spin text-blue-600" />
                                                <span className="font-medium text-sm">Loading activity logs...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-slate-400">
                                            <div className="max-w-xs mx-auto space-y-2">
                                                <ActivityLogIcon className="w-10 h-10 mx-auto text-slate-300" />
                                                <p className="font-semibold text-slate-700">No logs found</p>
                                                <p className="text-xs text-slate-500">
                                                    No activities match your current filter settings. Try clearing search or date filters.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const dateObj = new Date(log.timestamp);
                                        const fullDate = dateObj.toLocaleString();
                                        const action = getLogAction(log);
                                        const module = getLogModule(log);
                                        const filledFields = getLogFilledFields(log);

                                        return (
                                            <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* Time */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="font-semibold text-slate-800">
                                                        {formatTimeAgo(log.timestamp)}
                                                    </div>
                                                    <div className="text-3xs text-slate-400 font-mono" title={fullDate}>
                                                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </div>
                                                </td>

                                                {/* User */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                            {(log.username || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-slate-800 truncate">
                                                                {log.displayName || log.username}
                                                            </div>
                                                            <div className="text-3xs text-slate-400 truncate">
                                                                @{log.username} {log.userRole ? `• ${log.userRole}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Module */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {getModuleBadge(module)}
                                                </td>

                                                {/* Action */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {getActionBadge(action, log.actionCategory)}
                                                </td>

                                                {/* Description & Inserted/Filled Fields */}
                                                <td className="py-3 px-4 min-w-[280px]">
                                                    <div className="font-semibold text-slate-800 text-xs leading-relaxed">
                                                        {formatLogDescription(log.description, log)}
                                                    </div>
                                                    {filledFields.length > 0 && (
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                            <span className={`text-[10px] uppercase font-bold tracking-wider ${
                                                                (action === 'REVISED' || action === 'REVISE') ? 'text-violet-600' : (action === 'UPDATE' || action === 'UPDATE_ORIGINAL') ? 'text-amber-600' : (action === 'DELETE' || action === 'DELETE_REVISION') ? 'text-rose-600' : 'text-slate-400'
                                                            }`}>
                                                                {['APPROVE', 'ACCEPT', 'CLOSE', 'CARD OPEN', 'CARD CLOSE', 'CARD CLOSE (NO SAVE)', 'CLICK'].includes(action) ? 'Details:' : action === 'REJECT' ? 'Reason:' : (action === 'REVISED' || action === 'REVISE') ? 'Revision:' : (action === 'UPDATE' || action === 'UPDATE_ORIGINAL') ? 'Changes:' : (action === 'DELETE' || action === 'DELETE_REVISION') ? 'Deleted Record:' : 'Fields:'}
                                                            </span>
                                                            {filledFields.slice(0, 5).map((f, i) => (
                                                                <span
                                                                    key={i}
                                                                    title={`${f.label}: ${f.oldValue ? `${f.oldValue} ➔ ` : ''}${f.value}`}
                                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium max-w-[280px] truncate shadow-2xs ${
                                                                        (action === 'REVISED' || action === 'REVISE')
                                                                            ? 'bg-violet-50/90 border border-violet-200/80 text-violet-950'
                                                                            : (action === 'UPDATE' || action === 'UPDATE_ORIGINAL')
                                                                            ? 'bg-amber-50/90 border border-amber-200/80 text-amber-950'
                                                                            : (action === 'DELETE' || action === 'DELETE_REVISION')
                                                                            ? 'bg-rose-50/90 border border-rose-200/80 text-rose-950'
                                                                            : 'bg-blue-50/90 border border-blue-200/80 text-blue-900'
                                                                    }`}
                                                                >
                                                                    <span className={`font-medium text-[10px] ${(action === 'REVISED' || action === 'REVISE') ? 'text-violet-700' : (action === 'UPDATE' || action === 'UPDATE_ORIGINAL') ? 'text-amber-700' : (action === 'DELETE' || action === 'DELETE_REVISION') ? 'text-rose-700' : 'text-blue-600'}`}>{f.label}:</span>
                                                                    {(action === 'UPDATE' || action === 'UPDATE_ORIGINAL' || action === 'REVISED' || action === 'REVISE') && f.oldValue ? (
                                                                        <span className="flex items-center gap-1 text-[10px] truncate">
                                                                            <span className="line-through text-slate-400 font-normal">{f.oldValue}</span>
                                                                            <span className={`font-bold ${(action === 'REVISED' || action === 'REVISE') ? 'text-violet-600' : 'text-amber-600'}`}>➔</span>
                                                                            <span className="font-bold text-slate-800">{f.value}</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="font-semibold text-slate-800 text-[10px] truncate">{f.value}</span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                            {filledFields.length > 5 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedLog(log)}
                                                                    className={`cursor-pointer text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                                                                        (action === 'REVISED' || action === 'REVISE')
                                                                            ? 'text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border-violet-200'
                                                                            : (action === 'UPDATE' || action === 'UPDATE_ORIGINAL')
                                                                            ? 'text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border-amber-200'
                                                                            : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-200'
                                                                    }`}
                                                                    title="Click to view all fields in inspector"
                                                                >
                                                                    +{filledFields.length - 5} more
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {log.path && (
                                                        <div className="text-3xs text-slate-400 font-mono mt-1 truncate flex items-center gap-1.5">
                                                            <span className="px-1 py-0.2 bg-slate-100 rounded text-slate-600 font-semibold">{log.method}</span>
                                                            <span>{log.path}</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* IP Address & Status */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="font-mono text-xs text-slate-600">
                                                        {log.ip || '127.0.0.1'}
                                                    </div>
                                                    {log.status === 'FAILED' ? (
                                                        <span className="inline-flex items-center gap-1 text-3xs font-semibold text-rose-600">
                                                            <XIcon className="w-3 h-3" /> Failed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-600">
                                                            <CheckIcon className="w-3 h-3" /> Success
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Inspect Action */}
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => setSelectedLog(log)}
                                                        title="Inspect full details"
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                            <span>Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalLogs)} of {totalLogs.toLocaleString()} entries</span>
                            <span className="text-slate-300">|</span>
                            <span>Rows per page:</span>
                            <div className="relative inline-flex items-center" ref={limitRef}>
                                <button
                                    type="button"
                                    onClick={() => setOpenDropdown(prev => prev === 'limit' ? null : 'limit')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border bg-white flex items-center gap-1.5 transition-all shadow-xs ${
                                        openDropdown === 'limit'
                                            ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-700'
                                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <span>{limit}</span>
                                    <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${openDropdown === 'limit' ? 'rotate-180 text-blue-500' : ''}`} />
                                </button>
                                {openDropdown === 'limit' && (
                                    <div className="absolute bottom-full mb-1 left-0 w-20 bg-white border border-gray-100 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                                        {[25, 50, 100].map(cnt => (
                                            <button
                                                key={cnt}
                                                type="button"
                                                onClick={() => {
                                                    setLimit(cnt);
                                                    setPage(1);
                                                    setOpenDropdown(null);
                                                }}
                                                className={`w-full px-2.5 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                                                    limit === cnt ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                <span>{cnt}</span>
                                                {limit === cnt && <CheckIcon className="w-3 h-3 text-blue-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inspection Modal */}
            {selectedLog && (() => {
                const modalAction = getLogAction(selectedLog);
                const modalModule = getLogModule(selectedLog);
                const modalFilledFields = getLogFilledFields(selectedLog);
                const cleanPayload = getCleanDetails(selectedLog.details);

                return (
                    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                        <ActivityLogIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-base">Operation Detail & Insertion Inspector</h3>
                                        <p className="text-xs text-slate-500 font-mono">Log ID: {selectedLog._id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-4 text-xs">
                                {/* Basic Meta Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-3xs uppercase">Timestamp</span>
                                        <span className="text-slate-800 font-mono font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-3xs uppercase">User</span>
                                        <span className="text-slate-800 font-semibold">{selectedLog.displayName || selectedLog.username} (@{selectedLog.username})</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-3xs uppercase">Role</span>
                                        <span className="text-slate-800 font-medium">{selectedLog.userRole || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-3xs uppercase">Module</span>
                                        <span className="text-slate-800 font-semibold">{modalModule}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-3xs uppercase">Action Type</span>
                                        <div className="mt-0.5">{getActionBadge(modalAction, selectedLog.actionCategory)}</div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-semibold block text-3xs uppercase">IP Address</span>
                                        <span className="text-slate-800 font-mono">{selectedLog.ip || '127.0.0.1'}</span>
                                    </div>
                                </div>

                                {/* Detailed Operation Description */}
                                <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <FileTextIcon className="w-4 h-4 text-blue-600" />
                                        <h4 className="text-xs font-bold text-slate-700">Detailed Operation Description</h4>
                                    </div>
                                    <div className="p-3.5 bg-blue-50/60 rounded-xl text-slate-800 font-semibold text-xs border border-blue-100 leading-relaxed">
                                        {formatLogDescription(selectedLog.description, selectedLog)}
                                    </div>
                                </div>

                                {/* Inserted & Filled Fields Section */}
                                {modalFilledFields.length > 0 ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <h4 className="text-xs font-bold text-slate-700">
                                                    {(modalAction === 'REVISED' || modalAction === 'REVISE') ? 'Modified / Revised Fields' : (modalAction === 'UPDATE' || modalAction === 'UPDATE_ORIGINAL') ? 'Modified / Updated Fields' : ['APPROVE', 'ACCEPT', 'REJECT', 'CLOSE', 'CARD OPEN', 'CARD CLOSE', 'CLICK'].includes(modalAction) ? 'Operation Details' : 'Inserted & Filled Fields'} ({modalFilledFields.length} field{modalFilledFields.length > 1 ? 's' : ''})
                                                </h4>
                                            </div>
                                            <span className="text-3xs font-medium text-slate-400">
                                                {modalAction === 'CLICK' ? 'Captured from target record & interaction' : 'Captured from submitted form / request'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                            {modalFilledFields.map((item, idx) => (
                                                <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                                                        <span className="text-3xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.field}</span>
                                                    </div>
                                                    {(modalAction === 'UPDATE' || modalAction === 'UPDATE_ORIGINAL' || modalAction === 'REVISED' || modalAction === 'REVISE') && item.oldValue ? (
                                                        <div className="flex items-center gap-1.5 font-mono text-xs flex-wrap">
                                                            <span className="line-through text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">{item.oldValue}</span>
                                                            <span className={`${(modalAction === 'REVISED' || modalAction === 'REVISE') ? 'text-violet-600' : 'text-amber-600'} font-bold`}>➔</span>
                                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{item.value}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="font-mono text-xs font-bold text-slate-900 break-words bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                            {item.value}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs italic">
                                        No specific form insertion fields recorded for this action.
                                    </div>
                                )}

                                {/* Technical Details / Raw Snapshot */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <h4 className="text-xs font-bold text-slate-700">Raw Payload Snapshot & Context</h4>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(JSON.stringify(cleanPayload, null, 2));
                                                if (addNotification) addNotification('Copied details to clipboard', 'info');
                                            }}
                                            className="inline-flex items-center gap-1 text-3xs text-blue-600 hover:text-blue-700 hover:underline font-semibold"
                                        >
                                            <ClipboardIcon className="w-3.5 h-3.5" />
                                            Copy JSON
                                        </button>
                                    </div>
                                    <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-2xs overflow-x-auto max-h-48 leading-relaxed">
                                        {JSON.stringify(cleanPayload, null, 2)}
                                    </pre>
                                </div>

                                {/* Client & Request Info */}
                                <div className="pt-2 border-t border-slate-200 text-3xs text-slate-500 font-mono space-y-1">
                                    <div>HTTP Method: <span className="text-slate-700 font-bold">{selectedLog.method || 'N/A'}</span> | Route: <span className="text-slate-700 font-bold">{selectedLog.path || 'N/A'}</span></div>
                                    <div className="truncate">User Agent: {selectedLog.userAgent || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Clear Logs Confirmation Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-100">
                                <TrashIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Clear Activity Logs</h3>
                                <p className="text-xs text-slate-500">Purge historical log records from database</p>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs text-slate-700">
                            <label className="block font-semibold">Select Purge Scope:</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="purgeScope"
                                        checked={!clearAllConfirm}
                                        onChange={() => setClearAllConfirm(false)}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Delete logs older than:</span>
                                    <div className="relative inline-block group">
                                        <select
                                            value={clearOlderThan}
                                            onChange={(e) => setClearOlderThan(e.target.value)}
                                            disabled={clearAllConfirm}
                                            className="appearance-none bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-lg py-1 pl-2.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            <option value="7">7 Days</option>
                                            <option value="30">30 Days</option>
                                            <option value="60">60 Days</option>
                                            <option value="90">90 Days</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 group-hover:text-gray-600 transition-colors">
                                            <ChevronDownIcon className="w-3 h-3" />
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer text-rose-600 font-semibold">
                                    <input
                                        type="radio"
                                        name="purgeScope"
                                        checked={clearAllConfirm}
                                        onChange={() => setClearAllConfirm(true)}
                                        className="text-rose-600 focus:ring-rose-500"
                                    />
                                    <span>Purge ALL logs completely (Cannot be undone)</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                onClick={() => {
                                    setShowClearModal(false);
                                    setClearAllConfirm(false);
                                }}
                                disabled={isClearing}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearLogs}
                                disabled={isClearing}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                            >
                                {isClearing ? (
                                    <>
                                        <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    'Confirm & Purge'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogManagement;
