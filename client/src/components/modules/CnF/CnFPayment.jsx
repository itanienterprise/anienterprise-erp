import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SearchIcon, FunnelIcon, DollarSignIcon, EyeIcon, PlusIcon, XIcon, ChevronDownIcon, TrashIcon, EditIcon, UserIcon, BarChartIcon, CalendarIcon, CheckIcon, BoxIcon } from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { decryptData, encryptData } from '../../../utils/encryption';
import { hasPermission } from '../../../utils/permissionHelper';
import { generateCnFPaymentsListReportPDF } from '../../../utils/pdfGenerator';
import { generateCnFPaymentsListReportExcel } from '../../../utils/excelGenerator';
import ReportFormatModal from '../../shared/ReportFormatModal';
import CustomDatePicker from '../../shared/CustomDatePicker';
import axios from '../../../utils/api';

const toYYYYMMDD = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
        if (dateVal.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
            return dateVal.slice(0, 10);
        }
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const CnFPayment = ({ currentUser: propCurrentUser, addNotification, highlightId, isRequestedNotif, refreshPendingIndicators }) => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [localCurrentUser] = useState(() => {
        try {
            const saved = localStorage.getItem('currentUser');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const currentUser = propCurrentUser || localCurrentUser;

    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';

    const canAdd = hasPermission(currentUser, 'cnfPayment', 'add');
    const canEdit = hasPermission(currentUser, 'cnfPayment', 'edit');
    const canDelete = hasPermission(currentUser, 'cnfPayment', 'delete');
    const canPaymentRequest = hasPermission(currentUser, 'cnfPayment', 'paymentRequest') || canAdd;
    const canApproveFirst = hasPermission(currentUser, 'cnfPayment', 'firstApprove');
    const canApproveSecond = hasPermission(currentUser, 'cnfPayment', 'secondApprove');
    const canApprove = isAdmin || isIncharge || hasPermission(currentUser, 'cnfPayment', 'special');
    const canViewPaymentRequest = hasPermission(currentUser, 'cnfPayment', 'paymentRequest') || hasPermission(currentUser, 'cnfPayment', 'special') || canApproveFirst || canApproveSecond || canApprove;
    const canShowEntryBy = isAdmin || isIncharge || hasPermission(currentUser, 'cnfPayment', 'showEntryBy');
    const canManage = canAdd || canEdit || canDelete || canApprove || canApproveFirst || canApproveSecond || canPaymentRequest;

    // Check if current user has permission to approve the specific request step
    const showRequestedApprovalButtons = (p) => {
        if (isAdmin) return true;

        const entryBy = String(p.entryBy || '').toLowerCase().trim();
        const createdBy = String(p.createdBy || '').toLowerCase().trim();
        const myIdentifiers = [
            currentUser?.username,
            currentUser?.employeeId,
            currentUser?.id,
            currentUser?.name,
            currentUser?.nameEn
        ].filter(Boolean).map(s => String(s).toLowerCase().trim());

        const isSelfEntry = myIdentifiers.includes(entryBy) || myIdentifiers.includes(createdBy);
        if (isSelfEntry) return false;

        const isFirstApproved = p.firstApproved === true || p.smApproved === true;
        const userModulePerms = currentUser?.permissions?.cnfPayment;
        const currentUserRole = (currentUser?.role || '').toLowerCase();

        if (isFirstApproved) {
            const firstApprovedBy = String(p.firstApprovedBy || p.smApprovedBy || '').toLowerCase().trim();
            const isFirstApprover = firstApprovedBy && myIdentifiers.includes(firstApprovedBy);
            if (isFirstApprover) return false;

            if (userModulePerms && typeof userModulePerms.secondApprove === 'boolean') {
                return userModulePerms.secondApprove === true;
            }
            return currentUserRole === 'incharge' || canApproveSecond || canApprove;
        }

        if (userModulePerms && typeof userModulePerms.firstApprove === 'boolean') {
            return userModulePerms.firstApprove === true;
        }
        return currentUserRole === 'incharge' || canApproveFirst || canApprove;
    };

    // Creator can edit their own entry while it's still pending approval (before 1st approval)
    const canEditBeforeApproval = (payment) => {
        if (!payment) return false;
        const status = (payment.status || '').toLowerCase();
        if (status !== 'requested') return false;

        // Admin, Incharge, or users with explicit edit permission can always edit
        if (canEdit || isAdmin || isIncharge) return true;

        if (payment.firstApproved === true || payment.smApproved === true) return false;

        const entryBy = String(payment.entryBy || '').toLowerCase().trim();
        const createdBy = String(payment.createdBy || '').toLowerCase().trim();

        const myIdentifiers = [
            currentUser?.username,
            currentUser?.employeeId,
            currentUser?.id,
            currentUser?.name,
            currentUser?.nameEn
        ].filter(Boolean).map(s => String(s).toLowerCase().trim());

        return myIdentifiers.includes(entryBy) || myIdentifiers.includes(createdBy);
    };

    const getStatusBadge = (p) => {
        const status = (p.status || '').toLowerCase();
        if (status === 'requested') {
            const isFirstApproved = p.firstApproved === true || p.smApproved === true;
            if (isFirstApproved) {
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Pending 2nd Approval
                    </span>
                );
            }
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Pending 1st Approval
                </span>
            );
        }
        if (status === 'rejected') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    Rejected
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckIcon className="w-3 h-3 text-emerald-600" />
                Completed
            </span>
        );
    };

    // Requested Filter State
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    useEffect(() => {
        if (!highlightId && isRequestedNotif) {
            setIsRequestedOnly(true);
        }
    }, [isRequestedNotif, highlightId]);
    const [isRequestMode, setIsRequestMode] = useState(false);

    const requestedCount = useMemo(() => {
        return payments.filter(p => (p.status || '').toLowerCase() === 'requested').length;
    }, [payments]);

    // Highlighting logic
    const rowRefs = useRef({});
    useEffect(() => {
        if (!highlightId) return;

        const cleanH = String(highlightId).toLowerCase().trim();
        const targetItem = payments.find(p => 
            (p.cnfName && (String(p.cnfName).toLowerCase().trim() === cleanH || cleanH.includes(String(p.cnfName).toLowerCase().trim()) || String(p.cnfName).toLowerCase().trim().includes(cleanH))) ||
            (p.reference && (String(p.reference).toLowerCase().trim() === cleanH || cleanH.includes(String(p.reference).toLowerCase().trim()))) ||
            String(p._id) === cleanH
        );

        if (targetItem) {
            const isReq = (targetItem.status || '').toLowerCase() === 'requested';
            setIsRequestedOnly(isReq);
        } else if (isRequestedNotif) {
            setIsRequestedOnly(true);
        } else {
            setIsRequestedOnly(false);
        }

        const scrollToRow = () => {
            if (!highlightId) return false;
            const target = String(highlightId).trim().toLowerCase();
            const keys = Object.keys(rowRefs.current);
            const matchedKey = keys.find(k => {
                const cleanK = k.trim().toLowerCase();
                return cleanK === target || cleanK.includes(target) || target.includes(cleanK);
            });
            const el = matchedKey ? rowRefs.current[matchedKey] : rowRefs.current[highlightId];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        };

        const t1 = setTimeout(() => {
            if (!scrollToRow()) {
                const t2 = setTimeout(() => {
                    if (!scrollToRow()) { setSearchQuery(""); setTimeout(scrollToRow, 300); }
                }, 700);
                return () => clearTimeout(t2);
            }
        }, 250);
        return () => clearTimeout(t1);
    }, [highlightId, payments, isRequestedNotif]);

    // Edit States
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    // Filter States
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const initialFilterState = {
        startDate: '',
        endDate: '',
        method: '',
        cnfName: '',
        cnfType: ''
    };
    const [filters, setFilters] = useState(initialFilterState);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({ cnfName: '', method: '' });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // New Payment States
    const [showAddModal, setShowAddModal] = useState(false);
    const [cnfs, setCnfs] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [cnfSearchQuery, setCnfSearchQuery] = useState('');
    const [expandedCard, setExpandedCard] = useState(null);
    const [highlightedCnfIndex, setHighlightedCnfIndex] = useState(-1);

    const handleCnfKeyDown = (e) => {
        const filteredCnfs = cnfs.filter(c => c.name.toLowerCase().includes(cnfSearchQuery.toLowerCase()));
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedCnfIndex(prev => Math.min(prev + 1, filteredCnfs.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedCnfIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const indexToSelect = highlightedCnfIndex >= 0 ? highlightedCnfIndex : 0;
            if (filteredCnfs && filteredCnfs[indexToSelect]) {
                const c = filteredCnfs[indexToSelect];
                setNewPayment(prev => ({ ...prev, cnfId: c._id }));
                setActiveDropdown(null);
                setCnfSearchQuery(c.name);
                setHighlightedCnfIndex(-1);
            } else {
                setActiveDropdown(null);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };
    const cnfDropdownRef = useRef(null);
    const methodDropdownRef = useRef(null);
    const bankDropdownRef = useRef(null);
    const [banks, setBanks] = useState([]);
    const [rawStock, setRawStock] = useState([]);
    const [rawSales, setRawSales] = useState([]);
    const [rawPayments, setRawPayments] = useState([]);
    const [rawExpenses, setRawExpenses] = useState([]);

    const [newPayment, setNewPayment] = useState({
        cnfId: '',
        date: new Date().toISOString().split('T')[0],
        method: 'Cash',
        amount: '',
        discount: '',
        reference: '',
        bankName: '',
        remarks: '',
        billFrom: '',
        billTo: ''
    });

    useEffect(() => {
        fetchPayments();
        fetchCnFs();
    }, []);

    const getAgentEarningsAndPayments = (cnfId, cnfName, cnfType, commissionRateDefault) => {
        if (!cnfId || !cnfName) return { historyRecords: [], paymentRecords: [] };
        const targetName = cnfName.toLowerCase().trim();

        const rows = [];
        // 1. Process Stock (LC) Records
        rawStock.forEach(record => {
            const indCnF = (record.indianCnF || '').toLowerCase().trim();
            const bdCnF = (record.bdCnF || '').toLowerCase().trim();

            const isMatch = cnfType === 'Indian'
                ? indCnF === targetName
                : cnfType === 'BD'
                    ? bdCnF === targetName
                    : (indCnF === targetName || bdCnF === targetName);

            const status = (record.status || '').toLowerCase();
            const isAccepted = !status.includes('requested') && !status.includes('rejected');

            if (isMatch && isAccepted) {
                const qty = !isNaN(parseFloat(record.totalLcQuantity)) ? parseFloat(record.totalLcQuantity) : (!isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (parseFloat(record.inHouseQuantity) || 0));

                let commissionRate = parseFloat(commissionRateDefault) || 0;
                if (indCnF === targetName && record.indCnFComm !== undefined && record.indCnFComm !== null && record.indCnFComm !== '') {
                    commissionRate = parseFloat(record.indCnFComm);
                } else if (bdCnF === targetName && record.bdCnFComm !== undefined && record.bdCnFComm !== null && record.bdCnFComm !== '') {
                    commissionRate = parseFloat(record.bdCnFComm);
                }

                const rawUom = indCnF === targetName
                    ? (record.indCnFUom || record.uom || 'QTY')
                    : (record.bdCnFUom || record.uom || 'QTY');
                const uom = typeof rawUom === 'string' ? rawUom.toUpperCase() : 'QTY';

                let totalCommission = 0;
                if (indCnF === targetName && record.indCnFCost !== undefined && record.indCnFCost !== null && record.indCnFCost !== '') {
                    totalCommission = parseFloat(record.indCnFCost);
                } else if (bdCnF === targetName && record.bdCnFCost !== undefined && record.bdCnFCost !== null && record.bdCnFCost !== '') {
                    totalCommission = parseFloat(record.bdCnFCost);
                } else {
                    if (uom === 'QTY') {
                        totalCommission = qty * commissionRate;
                    } else if (uom === 'BAG') {
                        const bagQty = !isNaN(parseFloat(record.totalLcPacket)) ? parseFloat(record.totalLcPacket) : (!isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (record.inHousePacket || 0));
                        totalCommission = bagQty * commissionRate;
                    } else if (uom === 'TRUCK') {
                        const truckCount = !isNaN(parseFloat(record.totalLcTruck)) ? parseFloat(record.totalLcTruck) : (parseFloat(record.truckNo) || 1);
                        totalCommission = truckCount * commissionRate;
                    } else {
                        totalCommission = commissionRate;
                    }
                }
                totalCommission = parseFloat(totalCommission.toFixed(2));

                rows.push({
                    _id: record._id,
                    date: record.date,
                    lcNo: record.lcNo,
                    totalCommission: totalCommission,
                    type: 'earning'
                });
            }
        });

        // 2. Process Border Sale Records
        rawSales.forEach(sale => {
            const sTypeLow = (sale.saleType || '').toLowerCase().trim();
            const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (sale.invoiceNo || '').startsWith('BS');
            if (!isBorder) return;
            if (sale.status && sale.status.toLowerCase().includes('rejected')) return;

            const saleIndCnF = (sale.indianCnF || '').toLowerCase().trim();
            const saleBdCnf = (sale.bdCnf || '').toLowerCase().trim();

            const isMatch = targetName === saleIndCnF || targetName === saleBdCnf;
            if (!isMatch) return;

            const isIndianAgent = (saleIndCnF === targetName);
            const commissionFactor = isIndianAgent
                ? (parseFloat(sale.indCommissionRate) || parseFloat(commissionRateDefault) || 0)
                : (parseFloat(sale.bdCommissionRate) || parseFloat(commissionRateDefault) || 0);

            const uom = isIndianAgent
                ? (sale.indCommissionUom || 'QTY').toUpperCase()
                : (sale.bdCommissionUom || 'QTY').toUpperCase();

            const savedTotalComm = isIndianAgent ? (parseFloat(sale.indCommissionTotal) || 0) : (parseFloat(sale.bdCommissionTotal) || 0);

            let rawTotalMath = 0;
            (sale.items || []).forEach(item => {
                (item.brandEntries || []).forEach(entry => {
                    const qty = parseFloat(entry.quantity) || 0;
                    const truck = parseFloat(entry.truck) || 0;
                    if (uom === 'QTY') rawTotalMath += qty;
                    else if (uom === 'TRUCK') rawTotalMath += truck || 0;
                    else rawTotalMath += 1;
                });
            });

            (sale.items || []).forEach(item => {
                (item.brandEntries || []).forEach(entry => {
                    let totalEntryComm = 0;
                    const qty = parseFloat(entry.quantity) || 0;
                    const truck = parseFloat(entry.truck) || 0;

                    let mathVal = 0;
                    if (uom === 'QTY') mathVal = qty;
                    else if (uom === 'TRUCK') mathVal = truck || 0;
                    else mathVal = 1;

                    if (savedTotalComm > 0 && rawTotalMath > 0) {
                         totalEntryComm = (mathVal / rawTotalMath) * savedTotalComm;
                    } else if (savedTotalComm > 0 && rawTotalMath === 0) {
                         totalEntryComm = savedTotalComm; 
                    } else if (savedTotalComm === 0 && sale.indCommissionTotal === undefined && sale.bdCommissionTotal === undefined) {
                         if (uom === 'QTY') totalEntryComm = qty * commissionFactor;
                         else if (uom === 'TRUCK') totalEntryComm = (truck || 1) * commissionFactor;
                         else totalEntryComm = commissionFactor;
                    }

                    rows.push({
                        _id: `${sale._id}-${entry.brand}-${entry.warehouseName}`,
                        date: sale.date,
                        lcNo: sale.lcNo || '-',
                        totalCommission: parseFloat(totalEntryComm.toFixed(2)),
                        type: 'earning'
                    });
                });
            });
        });

        // 3. Process LC Expense Records (Earned from LC Expenses)
        rawExpenses.forEach(exp => {
            const expCnF = (exp.cnfAgent || '').toLowerCase().trim();
            if (expCnF === targetName && exp.type === 'bill') {
                rows.push({
                    _id: exp._id,
                    date: exp.date || exp.createdAt,
                    lcNo: exp.lcNo || '-',
                    totalCommission: parseFloat(exp.amount) || 0,
                    type: 'expense'
                });
            }
        });

        // Process Payments for this C&F (exclude requested and rejected)
        const paymentsFiltered = rawPayments.filter(p => {
            const pStatus = (p.status || '').toLowerCase();
            return p.cnfId === cnfId && pStatus !== 'requested' && pStatus !== 'rejected';
        });

        return { historyRecords: rows, paymentRecords: paymentsFiltered };
    };

    const getEarningsWithStatus = (historyRecords, paymentRecords) => {
        // Initialize remaining due for each history record
        const records = historyRecords.map(row => ({
            ...row,
            remainingDue: parseFloat(row.totalCommission) || 0
        }));

        // Sort by date ascending to process chronologically
        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Create a copy of payment records with remaining amount
        const payments = paymentRecords.map(p => ({
            ...p,
            remainingAmount: (parseFloat(p.amount) || 0) + (parseFloat(p.discount) || 0)
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        const normalizeLc = (lc) => String(lc || '').replace(/\s+/g, '').toLowerCase().trim();

        // 0. Direct Date Range matching
        payments.forEach(p => {
            if (p.billFrom && p.billTo) {
                const fromDateStr = toYYYYMMDD(p.billFrom);
                const toDateStr = toYYYYMMDD(p.billTo);

                let totalCleared = 0;
                records.forEach(r => {
                    const rDateStr = toYYYYMMDD(r.date);
                    if (rDateStr && rDateStr >= fromDateStr && rDateStr <= toDateStr) {
                        totalCleared += r.remainingDue;
                        r.remainingDue = 0;
                    }
                });
                p.remainingAmount = Math.max(0, p.remainingAmount - totalCleared);
            }
        });

        // 1. Direct LC reference matching
        payments.forEach(p => {
            const refNorm = normalizeLc(p.reference);
            if (refNorm) {
                const matches = records.filter(r => normalizeLc(r.lcNo) === refNorm);
                for (const r of matches) {
                    if (r.remainingDue > 0 && p.remainingAmount > 0) {
                        const allocated = Math.min(r.remainingDue, p.remainingAmount);
                        r.remainingDue -= allocated;
                        p.remainingAmount -= allocated;
                    }
                }
            }
        });

        // 2. FIFO matching for leftover payment amounts
        payments.forEach(p => {
            if (p.remainingAmount > 0) {
                for (const r of records) {
                    if (r.remainingDue > 0) {
                        const allocated = Math.min(r.remainingDue, p.remainingAmount);
                        r.remainingDue -= allocated;
                        p.remainingAmount -= allocated;
                        if (p.remainingAmount <= 0) break;
                    }
                }
            }
        });

        return records;
    };

    const displayBalance = useMemo(() => {
        if (!newPayment.cnfId) return 0;
        const selectedCnf = cnfs.find(c => c._id === newPayment.cnfId);
        if (!selectedCnf) return 0;

        if (!newPayment.billFrom || !newPayment.billTo) {
            return selectedCnf.totalBalance || 0;
        }

        const { historyRecords, paymentRecords } = getAgentEarningsAndPayments(
            selectedCnf._id,
            selectedCnf.name,
            selectedCnf.type,
            selectedCnf.commission
        );

        const recordsWithStatus = getEarningsWithStatus(historyRecords, paymentRecords);

        const fromDateStr = toYYYYMMDD(newPayment.billFrom);
        const toDateStr = toYYYYMMDD(newPayment.billTo);

        const rangeDue = recordsWithStatus
            .filter(r => {
                const rDateStr = toYYYYMMDD(r.date);
                if (!rDateStr || !fromDateStr || !toDateStr) return false;
                return rDateStr >= fromDateStr && rDateStr <= toDateStr;
            })
            .reduce((sum, r) => sum + r.remainingDue, 0);

        return rangeDue;
    }, [newPayment.cnfId, newPayment.billFrom, newPayment.billTo, cnfs, rawStock, rawSales, rawPayments, rawExpenses]);

    const fetchCnFs = async () => {
        try {
            const [cnfsRes, stockRes, salesRes, paymentsRes, expenseRes, banksRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/cnfs`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/cnf-payments`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`),
                axios.get(`${API_BASE_URL}/api/banks`)
            ]);

            const allCnfs = Array.isArray(cnfsRes.data) ? cnfsRes.data : [];
            const allStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
            const allPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
            const allExpenses = Array.isArray(expenseRes.data) ? expenseRes.data : [];
            const allBanks = Array.isArray(banksRes.data) ? banksRes.data : [];

            setBanks(allBanks);

            const cnfsWithBalance = allCnfs.map(cnf => {
                const targetName = (cnf.name || '').toLowerCase().trim();

                // 1. Earned from Stock (LC Arrivals)
                const stockEarned = allStock.reduce((acc, record) => {
                    const recordIndCnF = (record.indianCnF || '').toLowerCase().trim();
                    const recordBdCnF = (record.bdCnF || '').toLowerCase().trim();

                    const isMatch = cnf.type === 'Indian'
                        ? recordIndCnF === targetName
                        : cnf.type === 'BD'
                            ? recordBdCnF === targetName
                            : (recordIndCnF === targetName || recordBdCnF === targetName);

                    if (isMatch) {
                        const status = (record.status || '').toLowerCase();
                        if (status.includes('requested') || status.includes('rejected')) return acc;

                        if (recordIndCnF === targetName && record.indCnFCost !== undefined && record.indCnFCost !== null && record.indCnFCost !== '') {
                            return acc + (parseFloat(record.indCnFCost) || 0);
                        } else if (recordBdCnF === targetName && record.bdCnFCost !== undefined && record.bdCnFCost !== null && record.bdCnFCost !== '') {
                            return acc + (parseFloat(record.bdCnFCost) || 0);
                        }

                        let commission = parseFloat(cnf.commission) || 0;
                        if (recordIndCnF === targetName && record.indCnFComm !== undefined && record.indCnFComm !== null && record.indCnFComm !== '') {
                            commission = parseFloat(record.indCnFComm);
                        } else if (recordBdCnF === targetName && record.bdCnFComm !== undefined && record.bdCnFComm !== null && record.bdCnFComm !== '') {
                            commission = parseFloat(record.bdCnFComm);
                        }

                        const rawUom = recordIndCnF === targetName
                            ? (record.indCnFUom || record.uom || cnf.uom || cnf.commissionType || 'QTY')
                            : (record.bdCnFUom || record.uom || cnf.uom || cnf.commissionType || 'QTY');
                        const uom = typeof rawUom === 'string' ? rawUom.toUpperCase() : 'QTY';

                        if (uom === 'QTY') {
                            const qty = !isNaN(parseFloat(record.totalLcQuantity)) ? parseFloat(record.totalLcQuantity) : (!isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (parseFloat(record.inHouseQuantity) || 0));
                            return acc + (qty * commission);
                        } else if (uom === 'BAG') {
                            const bag = !isNaN(parseFloat(record.totalLcPacket)) ? parseFloat(record.totalLcPacket) : (!isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (parseFloat(record.inHousePacket) || 0));
                            return acc + (bag * commission);
                        } else if (uom === 'TRUCK') {
                            const truckCount = !isNaN(parseFloat(record.totalLcTruck)) ? parseFloat(record.totalLcTruck) : (parseFloat(record.truckNo) || 1);
                            return acc + (truckCount * commission);
                        } else {
                            return acc + commission;
                        }
                    }
                    return acc;
                }, 0);

                // 2. Earned from Border Sales
                const salesEarned = allSales.reduce((acc, sale) => {
                    const sTypeLow = (sale.saleType || '').toLowerCase().trim();
                    const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (sale.invoiceNo || '').startsWith('BS');
                    if (!isBorder) return acc;

                    // Skip rejected sales
                    if (sale.status && sale.status.toLowerCase().includes('rejected')) return acc;

                    const saleIndCnF = (sale.indianCnF || '').toLowerCase().trim();
                    const saleBdCnf = (sale.bdCnf || '').toLowerCase().trim();

                    const isMatch = cnf.type === 'Indian'
                        ? saleIndCnF === targetName
                        : cnf.type === 'BD'
                            ? saleBdCnf === targetName
                            : (saleIndCnF === targetName || saleBdCnf === targetName);

                    if (isMatch) {
                        let totalSaleComm = 0;
                        const isIndian = cnf.type === 'Indian' || (saleIndCnF === targetName);

                        if (isIndian && sale.indCommissionTotal) {
                            totalSaleComm = parseFloat(sale.indCommissionTotal) || 0;
                        } else if (!isIndian && sale.bdCommissionTotal) {
                            totalSaleComm = parseFloat(sale.bdCommissionTotal) || 0;
                        } else {
                            // Fallback to default calculation if no sale-specific commission exists
                            const commissionFactor = parseFloat(cnf.commission) || 0;
                            const uom = (typeof cnf.uom === 'string' ? cnf.uom : (cnf.commissionType || 'QTY')).toUpperCase();

                            (sale.items || []).forEach(item => {
                                (item.brandEntries || []).forEach(entry => {
                                    if (uom === 'QTY') {
                                        totalSaleComm += (parseFloat(entry.quantity) || 0) * commissionFactor;
                                    } else if (uom === 'TRUCK') {
                                        totalSaleComm += (parseFloat(entry.truck) || 1) * commissionFactor;
                                    } else {
                                        totalSaleComm += commissionFactor;
                                    }
                                });
                            });
                        }
                        return acc + totalSaleComm;
                    }
                    return acc;
                }, 0);

                // 3. Subtract Payments (including discount) - only completed/approved payments
                const paid = allPayments.reduce((acc, payment) => {
                    const pStatus = (payment.status || '').toLowerCase();
                    if (pStatus === 'requested' || pStatus === 'rejected') return acc;
                    if (payment.cnfId === cnf._id) {
                        return acc + (parseFloat(payment.amount) || 0) + (parseFloat(payment.discount) || 0);
                    }
                    return acc;
                }, 0);

                // 4. Earned from LC Expenses
                const expenseEarned = allExpenses.reduce((acc, exp) => {
                    const expCnF = (exp.cnfAgent || '').toLowerCase().trim();
                    if (expCnF === targetName && exp.type === 'bill') {
                        return acc + (parseFloat(exp.amount) || 0);
                    }
                    return acc;
                }, 0);

                return { ...cnf, totalBalance: stockEarned + salesEarned + expenseEarned - paid };
            });

            setRawStock(allStock);
            setRawSales(allSales);
            setRawPayments(allPayments);
            setRawExpenses(allExpenses);
            setCnfs(cnfsWithBalance);
        } catch (error) {
            console.error('Error fetching C&Fs:', error);
        }
    };

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cnf-payments`);
            setPayments(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching C&F payments:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Click outside listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) return;
            if (!activeDropdown) return;

            if (activeDropdown === 'cnf' && cnfDropdownRef.current && !cnfDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'method' && methodDropdownRef.current && !methodDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
            if (activeDropdown === 'bank' && bankDropdownRef.current && !bankDropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    // Click outside and keydown listener for Filter Panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current?.contains(event.target)) {
                setShowFilterPanel(false);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') setShowFilterPanel(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showFilterPanel]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setFilterDropdownOpen(null);
    };

    const resetFilters = () => {
        setFilters(initialFilterState);
        setFilterSearchInputs({ cnfName: '', method: '' });
        setSearchQuery('');
    };

    const uniqueMethods = ["Cash", "Bank Transfer", "Online Banking", "Mobile Banking", "Cheque", "Other"];
    const uniqueCnfNames = [...new Set(cnfs.map(c => c.name).filter(Boolean))].sort();

    const handleAddPayment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const isCreatorEditingBeforeApproval = isEditMode && editingPayment && canEditBeforeApproval(editingPayment);
        const hasAccess = isEditMode ? (canEdit || isCreatorEditingBeforeApproval) : (canAdd || canPaymentRequest);
        if (!hasAccess) {
            alert(`Forbidden: You do not have permission to ${isEditMode ? 'edit' : (isRequestMode ? 'request' : 'add')} C&F payments`);
            return;
        }

        if (!newPayment.cnfId) {
            alert('Please select a C&F agent.');
            return;
        }

        const amountVal = parseFloat(newPayment.amount) || 0;
        const discountVal = parseFloat(newPayment.discount) || 0;

        if (amountVal <= 0 && discountVal <= 0) {
            alert('Please enter a payment amount or discount.');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const selectedCnf = cnfs.find(c => c._id === newPayment.cnfId);
            const initialStatus = isEditMode ? (editingPayment?.status || 'Completed') : (isRequestMode || !canApprove ? 'Requested' : 'Completed');
            const paymentData = {
                ...newPayment,
                cnfName: selectedCnf?.name,
                cnfType: selectedCnf?.type,
                amount: amountVal,
                discount: discountVal,
                status: initialStatus,
                entryBy: editingPayment?.entryBy || currentUser?.name || currentUser?.username || 'Admin',
                createdBy: editingPayment?.createdBy || currentUser?.username || 'Admin',
                createdRole: editingPayment?.createdRole || currentUser?.role || 'Admin',
                ...(initialStatus === 'Completed' && !editingPayment?.approvedBy ? {
                    approvedBy: currentUser?.name || currentUser?.username || 'Admin',
                    approverRole: currentUser?.role || 'Admin',
                    approvedAt: new Date().toISOString()
                } : {})
            };

            if (isEditMode) {
                await axios.put(`${API_BASE_URL}/api/cnf-payments/${editingPayment._id}`, paymentData);
                if (addNotification) {
                    addNotification(
                        'C&F Payment Updated',
                        `C&F payment for ${selectedCnf?.name} was updated by ${currentUser?.name || currentUser?.username || 'User'}.`,
                        ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Accounts Manager'],
                        'cnf-payment-section',
                        selectedCnf?.name
                    );
                }
            } else {
                await axios.post(`${API_BASE_URL}/api/cnf-payments`, paymentData);
                if (addNotification) {
                    if (initialStatus === 'Requested') {
                        addNotification(
                            'New C&F Payment Requested',
                            `Payment request of ৳${(amountVal || discountVal).toLocaleString('en-IN')} for C&F agent ${selectedCnf?.name} was submitted by ${currentUser?.name || currentUser?.username || 'User'}.`,
                            ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Accounts Manager'],
                            'cnf-payment-section',
                            selectedCnf?.name
                        );
                    } else {
                        addNotification(
                            'New C&F Payment Added',
                            `C&F payment of ৳${amountVal.toLocaleString('en-IN')} for ${selectedCnf?.name} has been recorded by ${currentUser?.name || currentUser?.username || 'User'}.`,
                            ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Accounts Manager'],
                            'cnf-payment-section',
                            selectedCnf?.name
                        );
                    }
                }
            }

            setSubmitStatus('success');
            fetchPayments();
            fetchCnFs();
            refreshPendingIndicators?.();
            setTimeout(() => {
                setShowAddModal(false);
                setSubmitStatus(null);
                resetNewPayment();
            }, 1200);
        } catch (error) {
            console.error('Error saving C&F payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprovePayment = async (payment) => {
        if (!showRequestedApprovalButtons(payment)) {
            alert('Forbidden: You do not have permission to approve this payment request');
            return;
        }

        const isFirstApproved = payment.firstApproved === true || payment.smApproved === true;
        const userModulePerms = currentUser?.permissions?.cnfPayment;
        const isFirstApproverOnly = ((userModulePerms && userModulePerms.firstApprove === true) || canApproveFirst) && 
            !isAdmin && !isIncharge && !canApproveSecond && !(userModulePerms && userModulePerms.secondApprove === true) && !hasPermission(currentUser, 'cnfPayment', 'special');

        setIsSubmitting(true);
        try {
            let updatedData;
            if (!isFirstApproved && isFirstApproverOnly) {
                // Perform 1st approval step
                updatedData = {
                    ...payment,
                    firstApproved: true,
                    firstApprovedBy: currentUser?.name || currentUser?.username || 'Approver',
                    firstApprovedRole: currentUser?.role || 'Approver',
                    firstApprovedAt: new Date().toISOString(),
                    status: 'Requested'
                };
            } else {
                // Perform 2nd / Final approval step
                updatedData = {
                    ...payment,
                    status: 'Completed',
                    firstApproved: true,
                    firstApprovedBy: payment.firstApprovedBy || currentUser?.name || currentUser?.username || 'Approver',
                    firstApprovedRole: payment.firstApprovedRole || currentUser?.role || 'Approver',
                    firstApprovedAt: payment.firstApprovedAt || new Date().toISOString(),
                    secondApproved: true,
                    secondApprovedBy: currentUser?.name || currentUser?.username || 'Admin',
                    secondApprovedRole: currentUser?.role || 'Admin',
                    secondApprovedAt: new Date().toISOString(),
                    approvedBy: currentUser?.name || currentUser?.username || 'Admin',
                    approverRole: currentUser?.role || 'Admin',
                    approvedAt: new Date().toISOString()
                };
            }

            await axios.put(`${API_BASE_URL}/api/cnf-payments/${payment._id}`, updatedData);

            if (addNotification) {
                if (updatedData.status === 'Completed') {
                    addNotification(
                        'C&F Payment Approved',
                        `C&F payment of ৳${(payment.amount || payment.discount || 0).toLocaleString('en-IN')} for ${payment.cnfName} has been approved by ${currentUser?.name || currentUser?.username || 'Admin'}.`,
                        ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Accounts Manager'],
                        'cnf-payment-section',
                        payment.cnfName
                    );
                } else {
                    addNotification(
                        'C&F Payment 1st Approved',
                        `1st Approval completed for C&F agent ${payment.cnfName} (৳${(payment.amount || payment.discount || 0).toLocaleString('en-IN')}) by ${currentUser?.name || currentUser?.username || 'Approver'}. Pending 2nd approval.`,
                        ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Accounts Manager'],
                        'cnf-payment-section',
                        payment.cnfName
                    );
                }
            }

            fetchPayments();
            fetchCnFs();
            refreshPendingIndicators?.();
        } catch (error) {
            console.error('Error approving payment request:', error);
            alert('Failed to approve payment request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRejectPayment = (payment) => {
        if (!showRequestedApprovalButtons(payment) && !canDelete && !canApprove) {
            alert('Forbidden: You do not have permission to reject/delete this payment');
            return;
        }
        setPaymentToDelete(payment);
        setShowDeleteConfirm(true);
    };

    const resetNewPayment = () => {
        setNewPayment({
            cnfId: '',
            date: new Date().toISOString().split('T')[0],
            method: 'Cash',
            amount: '',
            discount: '',
            reference: '',
            bankName: '',
            remarks: '',
            billFrom: '',
            billTo: ''
        });
        setCnfSearchQuery('');
        setIsEditMode(false);
        setEditingPayment(null);
        setIsRequestMode(false);
    };

    const handleEditPayment = (payment) => {
        setIsEditMode(true);
        setEditingPayment(payment);
        setIsRequestMode(payment.status === 'Requested');
        setNewPayment({
            cnfId: payment.cnfId,
            date: payment.date,
            method: payment.method,
            amount: payment.amount !== undefined && payment.amount !== null ? payment.amount.toString() : '',
            discount: payment.discount !== undefined && payment.discount !== null ? payment.discount.toString() : '',
            reference: payment.reference || '',
            bankName: payment.bankName || '',
            remarks: payment.remarks || '',
            billFrom: payment.billFrom || '',
            billTo: payment.billTo || ''
        });
        const cnf = cnfs.find(c => c._id === payment.cnfId);
        setCnfSearchQuery(cnf?.name || '');
        setShowAddModal(true);
    };

    const handleDeletePayment = (payment) => {
        if (!canDelete && !canApprove) {
            alert('Forbidden: You do not have permission to delete C&F payments');
            return;
        }
        setPaymentToDelete(payment);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!paymentToDelete) return;
        setIsSubmitting(true);
        try {
            await axios.delete(`${API_BASE_URL}/api/cnf-payments/${paymentToDelete._id}`);
            setSubmitStatus('success');
            if (addNotification) {
                addNotification(
                    'C&F Payment Deleted',
                    `Payment record for C&F agent ${paymentToDelete?.cnfName || ''} was deleted by ${currentUser?.name || currentUser?.username || 'Admin'}.`,
                    ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Accounts Manager'],
                    'cnf-payment-section',
                    paymentToDelete?.cnfName
                );
            }
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setPaymentToDelete(null);
                setSubmitStatus(null);
                fetchPayments();
                fetchCnFs();
                refreshPendingIndicators?.();
            }, 1000);
        } catch (error) {
            console.error('Error deleting C&F payment:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const toggleCard = (id) => {
        setExpandedCard(prev => prev === id ? null : id);
    };

    const filteredPayments = payments.filter(p => {
        const statusLower = (p.status || '').toLowerCase();
        if (isRequestedOnly) {
            if (statusLower !== 'requested') return false;
        } else {
            if (statusLower === 'requested') return false;
        }

        const matchSearch = !searchQuery ||
            (p.cnfName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.method || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.entryBy || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchStartDate = !filters.startDate || p.date >= filters.startDate;
        const matchEndDate = !filters.endDate || p.date <= filters.endDate;
        const matchMethod = !filters.method || p.method === filters.method;
        const matchCnfName = !filters.cnfName || p.cnfName === filters.cnfName;
        const matchCnfType = !filters.cnfType || p.cnfType === filters.cnfType;

        return matchSearch && matchStartDate && matchEndDate && matchMethod && matchCnfName && matchCnfType;
    }).sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (sortConfig.key === 'date') {
            return sortConfig.direction === 'desc' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
        }
        if (sortConfig.direction === 'desc') return valB < valA ? -1 : 1;
        return valA < valB ? -1 : 1;
    });

    const handleGenerateReport = () => {
        setShowReportFormatModal(true);
    };

    const totalPaid = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalDiscount = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.discount) || 0), 0);
    const transactionCount = filteredPayments.length;

    return (
        <div className="space-y-6">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-center md:text-left w-full md:w-auto">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">C&F Payment</h2>
                </div>

                {!showAddModal && (
                    <div className="flex-1 w-full max-w-none md:max-w-xl mx-auto flex flex-col items-center gap-2">
                        <div className="w-full relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by C&F, method, reference..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            {canViewPaymentRequest && (
                                <button
                                    onClick={() => setIsRequestedOnly(!isRequestedOnly)}
                                    className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
                                >
                                    Requested
                                    {requestedCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                            {requestedCount}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-auto">
                    {!showAddModal && (
                        <div className="relative">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl border transition-all active:scale-95 text-sm font-medium shadow-sm ${showFilterPanel || Object.values(filters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">Filter</span>
                            </button>
                            {showFilterPanel && (
                                <>
                                    {/* Mobile backdrop */}
                                    <div className="fixed inset-0 bg-black/10 z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-72 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-visible">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                            <h4 className="font-bold text-gray-900 text-sm">Filter Payments</h4>
                                            <button onClick={resetFilters} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">Reset</button>
                                        </div>

                                        <div className="space-y-3">
                                            <CustomDatePicker
                                                label="Start Date"
                                                value={filters.startDate}
                                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="End Date"
                                                value={filters.endDate}
                                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                                compact={true}
                                            />

                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">C&F Name</label>
                                                <button
                                                    onClick={() => setFilterDropdownOpen(filterDropdownOpen === 'cnfName' ? null : 'cnfName')}
                                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm"
                                                >
                                                    <span className="truncate">{filters.cnfName || 'All C&Fs'}</span>
                                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                </button>
                                                {filterDropdownOpen === 'cnfName' && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                                        <button onClick={() => handleFilterChange('cnfName', '')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">All C&Fs</button>
                                                        {uniqueCnfNames.map(name => (
                                                            <button key={name} onClick={() => handleFilterChange('cnfName', name)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">{name}</button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => setShowFilterPanel(false)}
                                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]"
                                            >
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {!showAddModal && (
                        <button
                            onClick={handleGenerateReport}
                            className="h-10 flex items-center justify-center gap-2 px-4 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all active:scale-95 text-sm font-medium shadow-sm cursor-pointer"
                        >
                            <BarChartIcon className="w-4 h-4 text-gray-400 hidden sm:block" />
                            <span className="text-sm font-medium">Report</span>
                        </button>
                    )}
                    {(canAdd || canPaymentRequest) && !showAddModal && (
                        <button
                            onClick={() => {
                                setIsRequestMode(!canApprove);
                                setShowAddModal(true);
                            }}
                            className="h-10 border border-transparent flex items-center justify-center gap-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-sm hover:shadow-blue-500/30"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>{!canApprove && canPaymentRequest ? 'Request Payment' : 'Add Payment'}</span>
                        </button>
                    )}
                </div>
            </div>

            {showAddModal ? (
                /* Add/Edit Form Card */
                <div className="relative group mb-8">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-5 group-hover:opacity-10 transition duration-1000"></div>
                    <div className="relative bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white shadow-2xl animate-in slide-in-from-top-4 duration-500">
                        <div className="px-8 py-6 border-b border-gray-100/50 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white rounded-t-[2rem]">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight">{isEditMode ? 'Edit C&F Payment' : (isRequestMode ? 'New Payment Request' : 'New C&F Payment')}</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">C&F Financial Record</p>
                            </div>
                            <button onClick={() => { setShowAddModal(false); resetNewPayment(); }} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddPayment} className="p-8 space-y-6">
                            {/* Row 1: Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pb-6 border-b border-gray-50">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Payment Date</label>
                                    <CustomDatePicker value={newPayment.date} onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })} compact />
                                </div>

                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">C&F Agent</label>
                                    <div ref={cnfDropdownRef} className="relative group">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search C&F..."
                                                value={activeDropdown === 'cnf' ? cnfSearchQuery : (cnfs.find(c => c._id === newPayment.cnfId)?.name || '')}
                                                onChange={(e) => {
                                                    setCnfSearchQuery(e.target.value);
                                                    if (activeDropdown !== 'cnf') setActiveDropdown('cnf');
                                                    setHighlightedCnfIndex(-1);
                                                }}
                                                onFocus={() => {
                                                    setActiveDropdown('cnf');
                                                    setCnfSearchQuery('');
                                                    setHighlightedCnfIndex(-1);
                                                }}
                                                onKeyDown={handleCnfKeyDown}
                                                autoComplete="off"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10 font-medium text-gray-900"
                                            />
                                            <SearchIcon className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${activeDropdown === 'cnf' ? 'text-blue-500' : 'text-gray-400'}`} />
                                        </div>
                                        {activeDropdown === 'cnf' && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 border-t-0 py-1">
                                                {cnfs.filter(c => c.name.toLowerCase().includes(cnfSearchQuery.toLowerCase())).length > 0 ? (
                                                    cnfs.filter(c => c.name.toLowerCase().includes(cnfSearchQuery.toLowerCase())).map((c, idx) => (
                                                        <button
                                                            key={c._id}
                                                            type="button"
                                                            onClick={() => { 
                                                                setNewPayment({ ...newPayment, cnfId: c._id }); 
                                                                setActiveDropdown(null); 
                                                                setCnfSearchQuery(c.name);
                                                                setHighlightedCnfIndex(-1);
                                                            }}
                                                            onMouseEnter={() => setHighlightedCnfIndex(idx)}
                                                            className={`w-full px-5 py-3 text-left text-sm transition-colors flex items-center justify-between group ${highlightedCnfIndex === idx ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                                                        >
                                                            <div>
                                                                <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{c.name}</div>
                                                                <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{c.cnfId || c.type}</div>
                                                            </div>
                                                            {newPayment.cnfId === c._id && <CheckIcon className="w-4 h-4 text-blue-600" />}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-5 py-8 text-center text-gray-400">
                                                        <BoxIcon className="w-8 h-8 mb-2 mx-auto opacity-20" />
                                                        <p className="text-xs font-medium">No matching agent found</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Bill From (Optional)</label>
                                    <CustomDatePicker value={newPayment.billFrom || ''} onChange={(e) => setNewPayment({ ...newPayment, billFrom: e.target.value })} compact />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Bill To (Optional)</label>
                                    <CustomDatePicker value={newPayment.billTo || ''} onChange={(e) => setNewPayment({ ...newPayment, billTo: e.target.value })} compact />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Current Balance</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-bold text-sm">৳</span>
                                        </div>
                                        <input
                                            type="text"
                                            readOnly
                                            value={newPayment.cnfId ? displayBalance.toLocaleString('en-IN') : '0.00'}
                                            className={`w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black shadow-sm outline-none cursor-not-allowed transition-colors ${newPayment.cnfId ? (displayBalance > 0 ? 'text-amber-600' : 'text-emerald-600') : 'text-gray-400'}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Payment Details */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Payment Method</label>
                                    <div ref={methodDropdownRef} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDropdown(activeDropdown === 'method' ? null : 'method')}
                                            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        >
                                            <span className="truncate">{newPayment.method || 'Select Method'}</span>
                                            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                        </button>
                                        {activeDropdown === 'method' && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {uniqueMethods.map(m => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() => { setNewPayment({ ...newPayment, method: m }); setActiveDropdown(null); }}
                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                    >
                                                        <span className={newPayment.method === m ? 'font-bold text-blue-600' : 'text-gray-700'}>{m}</span>
                                                        {newPayment.method === m && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {['Bank Transfer', 'Online Banking', 'Cheque'].includes(newPayment.method) ? (
                                    <div className="space-y-1.5 relative">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Select Bank</label>
                                        <div ref={bankDropdownRef} className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'bank' ? null : 'bank')}
                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                            >
                                                <span className="truncate">{newPayment.bankName || 'Select Bank'}</span>
                                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                            </button>
                                            {activeDropdown === 'bank' && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] py-1 animate-in fade-in slide-in-from-top-2 duration-200 max-h-48 overflow-y-auto">
                                                    {banks.map(b => (
                                                        <button
                                                            key={b._id}
                                                            type="button"
                                                            onClick={() => { setNewPayment({ ...newPayment, bankName: b.bankName }); setActiveDropdown(null); }}
                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                        >
                                                            <span className={newPayment.bankName === b.bankName ? 'font-bold text-blue-600' : 'text-gray-700'}>{b.bankName}</span>
                                                            {newPayment.bankName === b.bankName && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                                                        </button>
                                                    ))}
                                                    {banks.length === 0 && <div className="px-4 py-2 text-xs text-gray-400">No banks found</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Reference / Note</label>
                                        <input
                                            type="text"
                                            value={newPayment.reference}
                                            onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                                            placeholder="Cheque No, Txn ID, or any reference..."
                                            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Amount (৳)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-bold text-sm">৳</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={newPayment.amount}
                                            onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Discount (৳)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <span className="text-gray-400 font-bold text-sm">৳</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={newPayment.discount}
                                            onChange={(e) => setNewPayment({ ...newPayment, discount: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-bold shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Remarks</label>
                                <textarea
                                    value={newPayment.remarks}
                                    onChange={(e) => setNewPayment({ ...newPayment, remarks: e.target.value })}
                                    placeholder="Add any remarks or details..."
                                    rows="2"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50">
                                <button
                                    type="submit"
                                    onClick={handleAddPayment}
                                    disabled={isSubmitting}
                                    className="px-10 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                                >
                                    {isSubmitting ? 'Processing...' : isEditMode ? 'Update Payment' : (isRequestMode ? 'Submit Request' : 'Confirm Payment')}
                                </button>
                            </div>
                        </form>

                        {submitStatus === 'success' && (
                            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in rounded-[2rem]">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckIcon className="w-8 h-8" />
                                </div>
                                <h4 className="text-xl font-black text-gray-900">Success!</h4>
                                <p className="text-gray-500">Payment record saved successfully.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Main View: Summary Cards + Table */
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Total Paid */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <DollarSignIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">{isRequestedOnly ? 'Requested Amount' : 'Total Paid'}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-gray-900">৳{totalPaid.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">Across filtered records</div>
                        </div>

                        {/* Total Discount */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <DollarSignIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Discount</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-gray-900">৳{totalDiscount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">Across filtered records</div>
                        </div>

                        {/* Transactions */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <BarChartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">{isRequestedOnly ? 'Requests' : 'Transactions'}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl sm:text-2xl font-black text-gray-900">{transactionCount}</span>
                                <span className="text-xs font-bold text-gray-400 ml-1">Entries</span>
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-1 italic">Total entries</div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        {/* ─── Desktop Table (md and above) ─── */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50/50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                                            <div className="flex items-center gap-1">
                                                <span>Date</span>
                                                <SortIcon config={sortConfig} columnKey="date" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('cnfName')}>
                                            <div className="flex items-center gap-1">
                                                <span>C&F Agent</span>
                                                <SortIcon config={sortConfig} columnKey="cnfName" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider">Method</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-left">Reference / Bank</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('amount')}>
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Amount</span>
                                                <SortIcon config={sortConfig} columnKey="amount" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Discount</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Status</th>
                                        {canShowEntryBy && (
                                            <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Entry By</th>
                                        )}
                                        {canManage && <th className="px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wider text-center">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr><td colSpan={canShowEntryBy ? (canManage ? 10 : 9) : (canManage ? 9 : 8)} className="px-4 py-12 text-center text-gray-400">Loading payments...</td></tr>
                                    ) : filteredPayments.length === 0 ? (
                                        <tr><td colSpan={canShowEntryBy ? (canManage ? 10 : 9) : (canManage ? 9 : 8)} className="px-4 py-12 text-center text-gray-400">No payment records found.</td></tr>
                                    ) : (
                                        filteredPayments.map((p) => {
                                            const isReq = (p.status || '').toLowerCase() === 'requested';
                                            const cleanH = String(highlightId || '').replace(/[৳,\s]/g, '').toLowerCase().trim();
                                            const rawH = String(highlightId || '').toLowerCase().trim();
                                            const isHighlighted = highlightId && (
                                                String(p._id) === String(highlightId) ||
                                                (p.cnfName && String(p.cnfName).toLowerCase().trim() === rawH) ||
                                                (p.cnfName && rawH.includes(String(p.cnfName).toLowerCase().trim())) ||
                                                (p.cnfName && String(p.cnfName).toLowerCase().trim().includes(rawH)) ||
                                                (p.reference && String(p.reference).toLowerCase().trim() === rawH) ||
                                                (p.reference && rawH.includes(String(p.reference).toLowerCase().trim())) ||
                                                (cleanH && cleanH.length >= 2 && (String(p.amount) === cleanH || String(p.discount) === cleanH))
                                            );
                                            return (
                                                <tr
                                                    key={p._id}
                                                    ref={el => {
                                                        if (el) {
                                                            rowRefs.current[p._id] = el;
                                                            if (p.cnfName) rowRefs.current[p.cnfName] = el;
                                                            if (p.reference) rowRefs.current[p.reference] = el;
                                                        }
                                                    }}
                                                    className={`hover:bg-gray-50/50 transition-all duration-300 group ${isHighlighted ? 'notif-row-highlight' : ''}`}
                                                    style={isHighlighted ? { borderLeft: '5px solid #f59e0b' } : undefined}
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(p.date)}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="font-bold text-gray-900">{p.cnfName}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.cnfType}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{p.method}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                                                        {p.bankName || p.reference ? (
                                                            <div>
                                                                <div className="text-gray-900 font-medium">{p.bankName || p.reference}</div>
                                                                {p.billFrom && p.billTo && (
                                                                    <div className="text-[10px] text-gray-400 font-medium">
                                                                        {formatDate(p.billFrom)} to {formatDate(p.billTo)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            p.billFrom && p.billTo ? (
                                                                <div className="text-gray-900 font-medium text-xs">
                                                                    {formatDate(p.billFrom)} to {formatDate(p.billTo)}
                                                                </div>
                                                            ) : '-'
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-black text-gray-900">৳{(parseFloat(p.amount) || 0).toLocaleString('en-IN')}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-600">
                                                        {p.discount > 0 ? `৳${(parseFloat(p.discount) || 0).toLocaleString('en-IN')}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        {getStatusBadge(p)}
                                                    </td>
                                                    {canShowEntryBy && (
                                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-xs font-semibold text-gray-700">
                                                                    {p.entryByName || p.entryBy || p.createdBy || '-'}
                                                                </span>
                                                                {(p.firstApprovedByName || p.firstApprovedBy || p.smApprovedByName || p.smApprovedBy) && (
                                                                    <span className="text-[10px] text-blue-600 font-medium" title="1st Approval">
                                                                        ✓ {p.firstApprovedByName || p.firstApprovedBy || p.smApprovedByName || p.smApprovedBy}
                                                                    </span>
                                                                )}
                                                                {(p.approvedByName || p.approvedBy || p.secondApprovedByName || p.secondApprovedBy || (p.status === 'Completed' ? (p.entryByName || p.entryBy || p.createdBy) : null)) && (
                                                                    <span className="text-[10px] text-emerald-600 font-semibold" title="Final Approval">
                                                                        ✓✓ {p.approvedByName || p.approvedBy || p.secondApprovedByName || p.secondApprovedBy || p.entryByName || p.entryBy || p.createdBy}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {canManage && (
                                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {isReq && showRequestedApprovalButtons(p) && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleApprovePayment(p)}
                                                                            disabled={isSubmitting}
                                                                            className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors cursor-pointer"
                                                                            title={p.firstApproved ? "Accept 2nd Approval" : "Accept 1st Approval"}
                                                                        >
                                                                            <CheckIcon className="w-5 h-5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRejectPayment(p)}
                                                                            disabled={isSubmitting}
                                                                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                                                            title="Reject"
                                                                        >
                                                                            <XIcon className="w-5 h-5" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {(canEdit || canEditBeforeApproval(p)) && (
                                                                    <button
                                                                        onClick={() => handleEditPayment(p)}
                                                                        className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                                                        title="Edit"
                                                                    >
                                                                        <EditIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                {!isReq && canDelete && (
                                                                    <button
                                                                        onClick={() => handleDeletePayment(p)}
                                                                        disabled={isSubmitting}
                                                                        className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                                                        title="Delete"
                                                                    >
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ─── Mobile Cards (below md) ─── */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {isLoading ? (
                                <div className="px-4 py-12 text-center text-gray-400">Loading payments...</div>
                            ) : filteredPayments.length === 0 ? (
                                <div className="px-4 py-12 text-center text-gray-400">No payment records found.</div>
                            ) : (
                                    filteredPayments.map((p) => {
                                        const isExpanded = expandedCard === p._id;
                                        const isReq = (p.status || '').toLowerCase() === 'requested';
                                        const cleanH = String(highlightId || '').replace(/[৳,\s]/g, '').toLowerCase().trim();
                                        const rawH = String(highlightId || '').toLowerCase().trim();
                                        const isHighlighted = highlightId && (
                                            String(p._id) === String(highlightId) ||
                                            (p.cnfName && String(p.cnfName).toLowerCase().trim() === rawH) ||
                                            (p.cnfName && rawH.includes(String(p.cnfName).toLowerCase().trim())) ||
                                            (p.cnfName && String(p.cnfName).toLowerCase().trim().includes(rawH)) ||
                                            (p.reference && String(p.reference).toLowerCase().trim() === rawH) ||
                                            (p.reference && rawH.includes(String(p.reference).toLowerCase().trim())) ||
                                            (cleanH && cleanH.length >= 2 && (String(p.amount) === cleanH || String(p.discount) === cleanH))
                                        );
                                        return (
                                            <div
                                                key={p._id}
                                                ref={el => {
                                                    if (el) {
                                                        rowRefs.current[p._id] = el;
                                                        if (p.cnfName) rowRefs.current[p.cnfName] = el;
                                                        if (p.reference) rowRefs.current[p.reference] = el;
                                                    }
                                                }}
                                                className={`p-5 bg-white hover:bg-gray-50 transition-all cursor-pointer ${isHighlighted ? 'notif-row-highlight !border-l-4 !border-l-amber-500 rounded-xl shadow-md' : ''}`}
                                                style={isHighlighted ? { borderLeft: '5px solid #f59e0b' } : undefined}
                                                onClick={() => toggleCard(p._id)}
                                            >
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                        <div className="text-base md:text-lg font-black text-gray-900 truncate tracking-tight">{p.cnfName}</div>
                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{p.cnfType}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-base md:text-lg font-black text-gray-900">৳{(parseFloat(p.amount) || 0).toLocaleString('en-IN')}</div>
                                                        {p.discount > 0 && <div className="text-[10px] font-bold text-emerald-600 leading-none">(-৳{(parseFloat(p.discount) || 0).toLocaleString('en-IN')})</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                            <CalendarIcon className="w-3.5 h-3.5" />
                                                            {formatDate(p.date)}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            {p.method}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {getStatusBadge(p)}
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-5 pt-5 border-t border-gray-100 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <div className="grid grid-cols-[140px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment Method</span>
                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                        <span className="font-semibold text-gray-900 text-[11px]">{p.method}</span>

                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Agent Type</span>
                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                        <span className="font-semibold text-gray-900 text-[11px] uppercase">{p.cnfType}</span>

                                                        {p.billFrom && p.billTo && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bill Period</span>
                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                <span className="font-semibold text-gray-900 text-[11px]">{formatDate(p.billFrom)} to {formatDate(p.billTo)}</span>
                                                            </>
                                                        )}

                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reference / Bank</span>
                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                        <span className="font-semibold text-gray-800 text-[11px] leading-relaxed">{p.bankName || p.reference || '-'}</span>

                                                        {p.discount > 0 && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Discount Given</span>
                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                <span className="font-bold text-emerald-600 text-[11px] italic">৳{(parseFloat(p.discount) || 0).toLocaleString('en-IN')}</span>
                                                            </>
                                                        )}

                                                        {(p.entryBy || p.createdBy) && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entry By</span>
                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-semibold text-gray-700 text-[11px]">{p.entryByName || p.entryBy || p.createdBy}</span>
                                                                    {(p.firstApprovedByName || p.firstApprovedBy || p.smApprovedByName || p.smApprovedBy) && (
                                                                        <span className="text-[10px] text-blue-600 font-medium">✓ {p.firstApprovedByName || p.firstApprovedBy || p.smApprovedByName || p.smApprovedBy} (1st Appr)</span>
                                                                    )}
                                                                    {(p.approvedByName || p.approvedBy || p.secondApprovedByName || p.secondApprovedBy || (p.status === 'Completed' ? (p.entryByName || p.entryBy || p.createdBy) : null)) && (
                                                                        <span className="text-[10px] text-emerald-600 font-semibold">✓✓ {p.approvedByName || p.approvedBy || p.secondApprovedByName || p.secondApprovedBy || p.entryByName || p.entryBy || p.createdBy} (Final Appr)</span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}

                                                        {p.remarks && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks</span>
                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                <span className="text-gray-600 text-[11px] leading-relaxed italic">{p.remarks}</span>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Action Buttons in Expanded View */}
                                                    {canManage && (
                                                        <div className="flex gap-2 pt-3 mt-1 border-t border-gray-100 w-full" onClick={(e) => e.stopPropagation()}>
                                                            {isReq && showRequestedApprovalButtons(p) && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleApprovePayment(p)}
                                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                    >
                                                                        <CheckIcon className="w-4 h-4" /> {p.firstApproved ? 'Accept (2nd)' : 'Accept (1st)'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRejectPayment(p)}
                                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                    >
                                                                        <XIcon className="w-4 h-4" /> Reject
                                                                    </button>
                                                                </>
                                                            )}
                                                            {(canEdit || canEditBeforeApproval(p)) && (
                                                                <button
                                                                    onClick={() => handleEditPayment(p)}
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                >
                                                                    <EditIcon className="w-4 h-4" /> Edit
                                                                </button>
                                                            )}
                                                            {!isReq && canDelete && (
                                                                <button
                                                                    onClick={() => handleDeletePayment(p)}
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs active:scale-95 transition-all"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" /> Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Delete / Reject Confirmation */}
            {showDeleteConfirm && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !isSubmitting && setShowDeleteConfirm(false)} />
                    <div className="relative bg-white w-full max-w-[340px] rounded-[2.5rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-200 overflow-hidden z-10">
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12 shadow-inner">
                            <TrashIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">{(paymentToDelete?.status || '').toLowerCase() === 'requested' ? 'Reject Request?' : 'Delete Payment?'}</h3>
                        <p className="text-gray-500 mb-8 text-sm leading-relaxed px-2">
                            {(paymentToDelete?.status || '').toLowerCase() === 'requested'
                                ? 'This will reject and remove the payment request from the system.'
                                : 'This action will permanently remove this record from the system. This cannot be undone.'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl transition-all hover:bg-gray-200 active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isSubmitting}
                                className="flex-1 py-4 bg-gradient-to-br from-red-500 to-red-600 text-white font-bold rounded-2xl shadow-xl shadow-red-200 transition-all hover:shadow-red-300 active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Processing...' : (paymentToDelete?.status || '').toLowerCase() === 'requested' ? 'Reject' : 'Delete'}
                            </button>
                        </div>

                        {submitStatus === 'success' && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 z-50">
                                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mb-4 animate-bounce">
                                    <CheckIcon className="w-10 h-10" />
                                </div>
                                <h4 className="text-2xl font-black text-gray-900">Success!</h4>
                                <p className="text-gray-500">Record updated successfully.</p>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Payment Report Export Format Selection Modal */}
            <ReportFormatModal
                isOpen={showReportFormatModal}
                onClose={() => setShowReportFormatModal(false)}
                title="C&F Payment Report"
                subtitle="Select your preferred format to export or preview payments"
                onExportPdf={() => {
                    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    generateCnFPaymentsListReportPDF(filteredPayments, filters, todayStr);
                }}
                onExportExcel={() => {
                    generateCnFPaymentsListReportExcel(filteredPayments, filters);
                }}
            />
        </div>
    );
};

export default CnFPayment;
