import React, { useState, useEffect, useRef, useMemo } from 'react';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, TrendingUpIcon, DollarSignIcon, FunnelIcon, PrinterIcon, BarChartIcon, ReceiptIcon, TruckIcon } from '../../Icons';
import CustomDatePicker from "../../shared/CustomDatePicker";
import { generateCnFHistoryReportPDF, generateCnFAgentListReportPDF, generateCnFExpenseReportPDF, generateCnFPaymentReportPDF, generateCnFAllReportPDF } from '../../../utils/pdfGenerator';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './CnF.css';
import { hasPermission } from '../../../utils/permissionHelper';
import CnFReport from './CnFReport';

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

const CnF = ({
    moduleType,
    currentUser,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    editingId,
    setEditingId,
    sortConfig,
    setSortConfig,
    onDeleteConfirm,
    startLongPress,
    endLongPress,
    isLongPressTriggered
}) => {
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [toast, setToast] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const toastTimerRef = useRef(null);
    const getEffectiveUser = () => {
        if (currentUser && currentUser.username) return currentUser;
        try {
            const stored = localStorage.getItem('erp_user');
            if (stored) return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing stored user:', e);
        }
        return null;
    };
    const effectiveUser = getEffectiveUser();
    const isAdmin = effectiveUser?.username === 'admin' || String(effectiveUser?.role || '').toLowerCase() === 'admin';
    const isAccountManager = (effectiveUser?.role || '').toLowerCase() === 'accounts manager' || (effectiveUser?.role || '').toLowerCase() === 'account manager';
    const isLcManager = (effectiveUser?.role || '').toLowerCase() === 'lc manager';
    const isDataEntry = (effectiveUser?.role || '').toLowerCase() === 'data entry';
    const canAdd = hasPermission(effectiveUser, 'cnf', 'add');
    const canEdit = hasPermission(effectiveUser, 'cnf', 'edit');
    const canDelete = hasPermission(effectiveUser, 'cnf', 'delete');
    const canManage = canAdd || canEdit || canDelete;
    const canUserEditRecord = (row) => {
        if (!canEdit) return false;
        if (isAdmin) return true;
        if (row.source !== 'Sale') {
            return !row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited;
        } else {
            return row.cnfType === 'Indian' ? !row.indCommissionEdited : !row.bdCommissionEdited;
        }
    };
    const showToast = (type, message, duration = 3000) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ type, message });
        toastTimerRef.current = setTimeout(() => setToast(null), duration);
    };
    const [cnfs, setCnfs] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [historyRecords, setHistoryRecords] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);
    const [expandedExpenseIdx, setExpandedExpenseIdx] = useState(null);
    const [expandedCnFId, setExpandedCnFId] = useState(null);
    const [editRecord, setEditRecord] = useState(null);
    const [isSavingHistory, setIsSavingHistory] = useState(false);
    const [editHistoryData, setEditHistoryData] = useState({
        uom: 'QTY',
        commission: '',
        totalCommission: 0
    });
    const [historyViewMode, setHistoryViewMode] = useState('earnings');
    const [paymentRecords, setPaymentRecords] = useState([]);
    const [expenseRecords, setExpenseRecords] = useState([]);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [formData, setFormData] = useState({
        cnfId: '',
        name: '',
        cnf_location_full: '',
        contactPerson: '',
        email: '',
        phone: '+880',
        uom: 'QTY',
        commission: '',
        status: 'Active'
    });

    const [isHistorySelectionMode, setIsHistorySelectionMode] = useState(false);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set());
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        startDate: '',
        endDate: '',
        lcNo: '',
        productName: '',
        port: ''
    });
    const historyFilterButtonRef = useRef(null);
    const historyFilterButtonMobileRef = useRef(null);
    const historyFilterPanelRef = useRef(null);
    const [historyFilterSearchInputs, setHistoryFilterSearchInputs] = useState({ lcNo: '', product: '', port: '' });
    const [historyFilterDropdownOpen, setHistoryFilterDropdownOpen] = useState({ lcNo: false, product: false, port: false });
    const lcNoFilterRef = useRef(null);
    const productFilterSearchRef = useRef(null);
    const portFilterSearchRef = useRef(null);
    const [highlightedHistoryFilterIndex, setHighlightedHistoryFilterIndex] = useState(-1);

    const getUniqueHistoryOptions = (key) => {
        return [...new Set(historyRecords.map(item => (item[key] || '').trim()).filter(Boolean))].sort();
    };

    const handleHistoryFilterKeyDown = (e, filterKey, searchKey, field) => {
        const query = historyFilterSearchInputs[searchKey];
        const options = getUniqueHistoryOptions(filterKey);
        const filtered = options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedHistoryFilterIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedHistoryFilterIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const indexToSelect = highlightedHistoryFilterIndex >= 0 ? highlightedHistoryFilterIndex : 0;
            if (filtered && filtered[indexToSelect]) {
                const selectedVal = filtered[indexToSelect];
                setHistoryFilters(prev => ({ ...prev, [field]: selectedVal }));
                setHistoryFilterSearchInputs(prev => ({ ...prev, [searchKey]: '' }));
                setHistoryFilterDropdownOpen(prev => ({ ...prev, [searchKey]: false }));
                setHighlightedHistoryFilterIndex(-1);
            } else {
                setHistoryFilterDropdownOpen(prev => ({ ...prev, [searchKey]: false }));
            }
        } else if (e.key === 'Escape') {
            setHistoryFilterDropdownOpen(prev => ({ ...prev, [searchKey]: false }));
        }
    };

    const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
    const [bulkEditData, setBulkEditData] = useState({ uom: 'QTY', commission: '' });

    const historyLongPressTimer = React.useRef(null);
    const isHistoryLongPressTriggered = React.useRef(false);

    useEffect(() => { fetchCnFs(); }, [moduleType]);

    useEffect(() => {
        if (viewData && cnfs.length > 0) {
            const freshViewData = cnfs.find(c => c._id === viewData._id);
            if (freshViewData) {
                setViewData(freshViewData);
            }
        }
    }, [cnfs]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showHistoryFilterPanel && historyFilterPanelRef.current && !historyFilterPanelRef.current.contains(event.target) && !historyFilterButtonRef.current?.contains(event.target) && !historyFilterButtonMobileRef.current?.contains(event.target)) {
                setShowHistoryFilterPanel(false);
            }
            if (lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) {
                setHistoryFilterDropdownOpen(prev => prev.lcNo ? { ...prev, lcNo: false } : prev);
            }
            if (productFilterSearchRef.current && !productFilterSearchRef.current.contains(event.target)) {
                setHistoryFilterDropdownOpen(prev => prev.product ? { ...prev, product: false } : prev);
            }
            if (portFilterSearchRef.current && !portFilterSearchRef.current.contains(event.target)) {
                setHistoryFilterDropdownOpen(prev => prev.port ? { ...prev, port: false } : prev);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setShowHistoryFilterPanel(false);
                setHistoryFilterDropdownOpen({ lcNo: false, product: false, port: false });
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showHistoryFilterPanel, historyFilterDropdownOpen]);

    useEffect(() => {
        if (viewData) {
            document.body.style.overflow = 'hidden';
            fetchCnFHistory(viewData.name);
            fetchCnFPayments(viewData._id);
            setHistoryViewMode('earnings');
            setHistorySearchQuery('');
            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', productName: '' });
            setExpandedHistoryIdx(null);
            setIsHistorySelectionMode(false);
            setSelectedHistoryIds(new Set());
        } else {
            document.body.style.overflow = 'auto';
            setHistoryRecords([]);
            setPaymentRecords([]);
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [viewData]);

    const fetchCnFPayments = async (cnfId) => {
        setPaymentLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/cnf-payments`);
            const allPayments = Array.isArray(response.data) ? response.data : [];
            const filtered = allPayments.filter(p => p.cnfId === cnfId);
            setPaymentRecords([...filtered].sort((a, b) => new Date(a.date) - new Date(b.date)));
        } catch (error) {
            console.error('Error fetching C&F payments:', error);
            setPaymentRecords([]);
        } finally {
            setPaymentLoading(false);
        }
    };

    const historyRecordsWithStatus = useMemo(() => {
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

        return records.map(r => ({
            ...r,
            paymentStatus: r.remainingDue <= 0.01 ? 'Paid' : 'Due'
        }));
    }, [historyRecords, paymentRecords]);

    const filteredHistory = historyRecordsWithStatus.filter(row => {
        const q = historySearchQuery.toLowerCase();

        // Date Filtering
        if (historyFilters.startDate || historyFilters.endDate) {
            const rowDate = new Date(row.date);
            if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
            if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
        }

        // Field Specific Filtering
        if (historyFilters.lcNo && !(row.lcNo || '').toLowerCase().includes(historyFilters.lcNo.toLowerCase())) return false;
        if (historyFilters.productName && !(row.product || '').toLowerCase().includes(historyFilters.productName.toLowerCase())) return false;
        if (historyFilters.port && !(row.port || '').toLowerCase().includes(historyFilters.port.toLowerCase())) return false;

        // Search Query Filtering
        if (!q) return true;
        return (row.date || '').toLowerCase().includes(q) || (row.lcNo || '').toLowerCase().includes(q) || (row.port || '').toLowerCase().includes(q) || (row.product || '').toLowerCase().includes(q) || (row.brand || '').toLowerCase().includes(q) || String(row.truck || '').toLowerCase().includes(q);
    });

    const filteredExpenses = expenseRecords.filter(exp => {
        const q = historySearchQuery.toLowerCase();

        // Date Filtering
        if (historyFilters.startDate || historyFilters.endDate) {
            const rowDate = new Date(exp.date);
            if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
            if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
        }

        if (!q) return true;
        return (exp.lcNo || '').toLowerCase().includes(q) || (exp.importer || '').toLowerCase().includes(q) || (exp.product || '').toLowerCase().includes(q) || (exp.port || '').toLowerCase().includes(q);
    });

    const filteredPayments = paymentRecords.filter(p => {
        const q = historySearchQuery.toLowerCase();

        // Date Filtering
        if (historyFilters.startDate || historyFilters.endDate) {
            const rowDate = new Date(p.date);
            if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
            if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
        }

        if (!q) return true;
        return (p.date || '').toLowerCase().includes(q) || (p.method || '').toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q) || String(p.amount || '').toLowerCase().includes(q);
    });

    const filteredAll = useMemo(() => {
        const combined = [];

        // Add Earnings
        historyRecords.forEach(row => {
            combined.push({
                type: 'earning',
                date: row.date,
                lcNo: row.lcNo,
                importer: row.importer,
                product: row.product,
                billingAmount: parseFloat(row.totalCommission) || 0,
                amount: 0,
                method: '-',
                reference: '-'
            });
        });

        // Add Expenses
        expenseRecords.forEach(row => {
            combined.push({
                type: 'expense',
                date: row.date,
                lcNo: row.lcNo,
                importer: row.importer,
                product: row.product,
                billingAmount: parseFloat(row.amount) || 0,
                amount: 0,
                method: '-',
                reference: '-'
            });
        });

        // Add Payments
        paymentRecords.forEach(row => {
            combined.push({
                type: 'payment',
                date: row.date,
                lcNo: '-',
                importer: '-',
                product: '-',
                billingAmount: 0,
                amount: parseFloat(row.amount) || 0,
                discount: parseFloat(row.discount) || 0,
                method: row.method,
                reference: row.reference,
                bankName: row.bankName
            });
        });

        // Filter and Sort
        const filtered = combined.filter(row => {
            const q = historySearchQuery.toLowerCase();
            if (historyFilters.startDate || historyFilters.endDate) {
                const rowDate = new Date(row.date);
                if (historyFilters.startDate && rowDate < new Date(historyFilters.startDate)) return false;
                if (historyFilters.endDate && rowDate > new Date(historyFilters.endDate)) return false;
            }
            if (!q) return true;
            return (row.lcNo || '').toLowerCase().includes(q) ||
                   (row.importer || '').toLowerCase().includes(q) ||
                   (row.product || '').toLowerCase().includes(q) ||
                   (row.method || '').toLowerCase().includes(q) ||
                   (row.reference || '').toLowerCase().includes(q);
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Add Running Balance
        let balance = 0;
        return filtered.map(row => {
            if (row.type === 'earning' || row.type === 'expense') {
                balance += row.billingAmount;
            } else {
                balance -= (row.amount + (row.discount || 0));
            }
            return { ...row, runningBalance: balance };
        });
    }, [historyRecords, expenseRecords, paymentRecords, historySearchQuery, historyFilters]);

    const handlePrintHistory = () => {
        if (!viewData) return;
        const agentInfo = { name: viewData.name, cnfId: viewData.cnfId, phone: viewData.phone };

        if (historyViewMode === 'earnings') {
            generateCnFHistoryReportPDF(filteredHistory, agentInfo, historyFilters);
        } else if (historyViewMode === 'expense') {
            generateCnFExpenseReportPDF(filteredExpenses, agentInfo, historyFilters);
        } else if (historyViewMode === 'payments') {
            generateCnFPaymentReportPDF(filteredPayments, agentInfo, historyFilters);
        } else if (historyViewMode === 'all') {
            generateCnFAllReportPDF(filteredAll, agentInfo, historyFilters);
        }
    };

    const fetchCnFs = async () => {
        setIsLoading(true);
        try {
            const [cnfsRes, stockRes, salesRes, paymentsRes, expenseRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/cnfs`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/cnf-payments`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`)
            ]);

            const allCnfs = Array.isArray(cnfsRes.data) ? cnfsRes.data : [];
            const allStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
            const allPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
            const allExpenses = Array.isArray(expenseRes.data) ? expenseRes.data : [];

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

                // 3. Subtract Payments
                const paid = allPayments.reduce((acc, payment) => {
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

            const filtered = moduleType
                ? cnfsWithBalance.filter(c => c.type === moduleType)
                : cnfsWithBalance;
            setCnfs(filtered);
        } catch (error) {
            console.error('Error fetching C&Fs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCnFHistory = async (cnfName) => {
        setHistoryLoading(true);
        try {
            const [stockRes, salesRes, expenseRes, lcRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`),
                axios.get(`${API_BASE_URL}/api/lc-management`)
            ]);

            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];
            const salesData = Array.isArray(salesRes.data) ? salesRes.data : [];
            const expenseData = Array.isArray(expenseRes.data) ? expenseRes.data : [];
            const lcData = Array.isArray(lcRes.data) ? lcRes.data : [];
            const rows = [];
            const expenseRows = [];
            const targetCnF = (cnfName || '').toLowerCase().trim();

            // 1. Process Stock (LC) Records
            stockData.forEach(record => {
                const indCnF = (record.indianCnF || '').toLowerCase().trim();
                const bdCnF = (record.bdCnF || '').toLowerCase().trim();

                const isBaseMatch = moduleType === 'Indian'
                    ? indCnF === targetCnF
                    : moduleType === 'BD'
                        ? bdCnF === targetCnF
                        : (indCnF === targetCnF || bdCnF === targetCnF);

                const status = (record.status || '').toLowerCase();
                const isAccepted = !status.includes('requested') && !status.includes('rejected');
                const isMatch = isBaseMatch && isAccepted;

                if (isMatch) {
                    const qty = !isNaN(parseFloat(record.totalLcQuantity)) ? parseFloat(record.totalLcQuantity) : (!isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (parseFloat(record.inHouseQuantity) || 0));

                    let commissionRate = parseFloat(viewData?.commission) || 0;
                    if (indCnF === targetCnF && record.indCnFComm !== undefined && record.indCnFComm !== null && record.indCnFComm !== '') {
                        commissionRate = parseFloat(record.indCnFComm);
                    } else if (bdCnF === targetCnF && record.bdCnFComm !== undefined && record.bdCnFComm !== null && record.bdCnFComm !== '') {
                        commissionRate = parseFloat(record.bdCnFComm);
                    }

                    const rawUom = indCnF === targetCnF
                        ? (record.indCnFUom || record.uom || viewData?.uom || viewData?.commissionType || 'QTY')
                        : (record.bdCnFUom || record.uom || viewData?.uom || viewData?.commissionType || 'QTY');
                    const uom = typeof rawUom === 'string' ? rawUom.toUpperCase() : 'QTY';

                    let totalCommission = 0;
                    if (indCnF === targetCnF && record.indCnFCost !== undefined && record.indCnFCost !== null && record.indCnFCost !== '') {
                        totalCommission = parseFloat(record.indCnFCost);
                    } else if (bdCnF === targetCnF && record.bdCnFCost !== undefined && record.bdCnFCost !== null && record.bdCnFCost !== '') {
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

                    console.log('CnF Stock Record:', { id: record._id, lcNo: record.lcNo, billOfEntry: record.billOfEntry });
                    rows.push({
                        _id: record._id,
                        date: record.date,
                        lcNo: record.lcNo,
                        importer: record.importer,
                        exporter: record.exporter,
                        port: record.port,
                        product: record.productName,
                        brand: record.brand,
                        rate: record.purchasedPrice,
                        bag: !isNaN(parseFloat(record.totalLcPacket)) ? parseFloat(record.totalLcPacket) : (!isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (record.inHousePacket || 0)),
                        qty: qty,
                        truck: !isNaN(parseFloat(record.totalLcTruck)) ? record.totalLcTruck : (record.truckNo || record.truck || record.itemTruck || '-'),
                        billOfEntry: record.billOfEntry || '-',
                        commission: commissionRate,
                        uom: uom,
                        totalCommission: totalCommission,
                        cnfType: indCnF === targetCnF ? 'Indian' : 'BD',
                        source: 'LC',
                        indCnFEdited: record.indCnFEdited,
                        bdCnFEdited: record.bdCnFEdited,
                        indCnFBulkEdited: record.indCnFBulkEdited,
                        bdCnFBulkEdited: record.bdCnFBulkEdited
                    });
                }
            });

            // 2. Process Border Sale Records
            salesData.forEach(sale => {
                const sTypeLow = (sale.saleType || '').toLowerCase().trim();
                const isBorder = sTypeLow === 'border' || sTypeLow === 'border sale' || (sale.invoiceNo || '').startsWith('BS');
                if (!isBorder) return;

                // Skip rejected sales
                if (sale.status && sale.status.toLowerCase().includes('rejected')) return;

                const saleIndCnF = (sale.indianCnF || '').toLowerCase().trim();
                const saleBdCnf = (sale.bdCnf || '').toLowerCase().trim();

                const isMatch = cnfName.toLowerCase().trim() === saleIndCnF || cnfName.toLowerCase().trim() === saleBdCnf;
                if (!isMatch) return;

                const isIndianAgent = (saleIndCnF === targetCnF);
                const commissionFactor = isIndianAgent
                    ? (parseFloat(sale.indCommissionRate) || parseFloat(viewData?.commission) || 0)
                    : (parseFloat(sale.bdCommissionRate) || parseFloat(viewData?.commission) || 0);

                const uom = isIndianAgent
                    ? (sale.indCommissionUom || (typeof viewData?.uom === 'string' ? viewData.uom : (viewData?.commissionType || 'QTY'))).toUpperCase()
                    : (sale.bdCommissionUom || (typeof viewData?.uom === 'string' ? viewData.uom : (viewData?.commissionType || 'QTY'))).toUpperCase();

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
                        let rateToDisplay = commissionFactor;
                        const qty = parseFloat(entry.quantity) || 0;
                        const truck = parseFloat(entry.truck) || 0;

                        let mathVal = 0;
                        if (uom === 'QTY') mathVal = qty;
                        else if (uom === 'TRUCK') mathVal = truck || 0;
                        else mathVal = 1;

                        if (savedTotalComm > 0 && rawTotalMath > 0) {
                             totalEntryComm = (mathVal / rawTotalMath) * savedTotalComm;
                             rateToDisplay = mathVal > 0 ? parseFloat((totalEntryComm / mathVal).toFixed(2)) : 0;
                        } else if (savedTotalComm > 0 && rawTotalMath === 0) {
                             totalEntryComm = savedTotalComm; 
                        } else if (savedTotalComm === 0 && sale.indCommissionTotal === undefined && sale.bdCommissionTotal === undefined) {
                             if (uom === 'QTY') totalEntryComm = qty * commissionFactor;
                             else if (uom === 'TRUCK') totalEntryComm = (truck || 1) * commissionFactor;
                             else totalEntryComm = commissionFactor;
                             rateToDisplay = commissionFactor;
                        }

                        // Find matching stock record to resolve bill of entry
                        const relatedStock = stockData.find(st => st.lcNo && sale.lcNo && st.lcNo.trim().toLowerCase() === sale.lcNo.trim().toLowerCase());
                        const boeNo = relatedStock ? (relatedStock.billOfEntry || '-') : '-';

                        rows.push({
                            _id: `${sale._id}-${entry.brand}-${entry.warehouseName}`,
                            date: sale.date,
                            lcNo: sale.lcNo || '-',
                            importer: sale.importer,
                            exporter: sale.exporter,
                            port: sale.port || '-',
                            product: item.productName || '-',
                            brand: entry.brand || '-',
                            rate: entry.unitPrice || 0,
                            bag: '-',
                            qty: qty,
                            truck: truck || '-',
                            billOfEntry: boeNo,
                            commission: rateToDisplay,
                            uom: uom,
                            totalCommission: parseFloat(totalEntryComm.toFixed(2)),
                            cnfType: isIndianAgent ? 'Indian' : 'BD',
                            source: 'Sale',
                            originalId: sale._id,
                            indCommissionEdited: sale.indCommissionEdited,
                            bdCommissionEdited: sale.bdCommissionEdited
                        });
                    });
                });
            });

            // 3. Process LC Expense Records
            expenseData.forEach(exp => {
                const expCnF = (exp.cnfAgent || '').toLowerCase().trim();
                if (expCnF === targetCnF && exp.type === 'bill') {
                    let importer = '-';
                    let product = '-';
                    let port = '-';
                    
                    if (exp.lcNo) {
                        const relatedLc = lcData.find(l => l.lcNo === exp.lcNo);
                        if (relatedLc) {
                            importer = relatedLc.importerName || '-';
                            product = relatedLc.productName || '-';
                            port = relatedLc.port || '-';
                        }
                    }

                    expenseRows.push({
                        _id: exp._id,
                        date: exp.date || exp.createdAt,
                        lcNo: exp.lcNo || '-',
                        importer: importer,
                        product: product,
                        port: port,
                        amount: parseFloat(exp.amount) || 0
                    });
                }
            });

            rows.sort((a, b) => new Date(a.date) - new Date(b.date));
            expenseRows.sort((a, b) => new Date(a.date) - new Date(b.date));
            setHistoryRecords(rows);
            setExpenseRecords(expenseRows);
        } catch (error) {
            console.error('Error fetching C&F history:', error);
            setHistoryRecords([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleEditHistory = (record) => {
        setEditRecord(record);

        // record.uom is already resolved per C&F type by fetchCnFHistory (reads indCnFUom or bdCnFUom)
        const resolvedUom = record.uom || viewData?.uom || viewData?.commissionType || 'QTY';

        setEditHistoryData({
            uom: (typeof resolvedUom === 'string' ? resolvedUom : 'QTY').toUpperCase(),
            commission: record.commission || 0,
            totalCommission: record.totalCommission || 0
        });
    };

    const handleEditHistoryChange = (e) => {
        const { name, value } = e.target;

        setEditHistoryData(prev => {
            const newData = { ...prev, [name]: value };
            const currentUom = name === 'uom' ? value : prev.uom;
            const rate = name === 'commission' ? parseFloat(value) || 0 : parseFloat(prev.commission) || 0;
            const qty = parseFloat(editRecord?.qty) || 0;

            if (currentUom === 'QTY') {
                newData.totalCommission = qty * rate;
            } else if (currentUom === 'BAG') {
                const bagCount = parseFloat(editRecord?.bag) || 0;
                newData.totalCommission = bagCount * rate;
            } else if (currentUom === 'TRUCK') {
                const truckCount = !isNaN(parseFloat(editRecord?.truck)) ? parseFloat(editRecord.truck) : 1;
                newData.totalCommission = truckCount * rate;
            } else {
                newData.totalCommission = rate;
            }
            return newData;
        });
    };

    const handleSaveHistory = async () => {
        if (!canEdit) {
            alert('Forbidden: You do not have permission to edit C&F records');
            return;
        }
        if (!editRecord || !editRecord._id) return;
        setIsSavingHistory(true);
        try {
            if (editRecord.source === 'Sale') {
                // BRANCH FOR SALES
                const saleId = editRecord.originalId;
                const salesRes = await axios.get(`${API_BASE_URL}/api/sales`);
                const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
                const originalSale = allSales.find(s => s._id === saleId);

                if (!originalSale) throw new Error('Original sale not found');

                const updatedSale = { ...originalSale };
                const isIndian = editRecord.cnfType === 'Indian';

                if (isIndian) {
                    updatedSale.indCommissionRate = editHistoryData.commission;
                    updatedSale.indCommissionUom = editHistoryData.uom;
                    updatedSale.indCommissionEdited = true;
                } else {
                    updatedSale.bdCommissionRate = editHistoryData.commission;
                    updatedSale.bdCommissionUom = editHistoryData.uom;
                    updatedSale.bdCommissionEdited = true;
                }

                // Recalculate global sale commission totals
                const totalTrucks = (updatedSale.items || []).reduce((sum, p) =>
                    sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.truck) || 0), 0)
                    , 0);
                const totalQty = (updatedSale.items || []).reduce((sum, p) =>
                    sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.quantity) || 0), 0)
                    , 0);

                const rate = parseFloat(editHistoryData.commission) || 0;
                const uom = (editHistoryData.uom || '').toUpperCase();
                const newTotal = uom === 'BOE' ? rate : (uom === 'TRUCK' ? totalTrucks : totalQty) * rate;

                if (isIndian) {
                    updatedSale.indCommissionTotal = newTotal.toFixed(2);
                } else {
                    updatedSale.bdCommissionTotal = newTotal.toFixed(2);
                }

                updatedSale.isCnfCommissionUpdate = true;
                await axios.put(`${API_BASE_URL}/api/sales/${saleId}`, updatedSale);
            } else {
                // ORIGINAL BRANCH FOR STOCK (LC)
                const res = await axios.get(`${API_BASE_URL}/api/stock`);
                const originalRecord = res.data.find(r => r._id === editRecord._id);
                if (!originalRecord) throw new Error('Original record not found');

                const updatedData = { ...originalRecord };
                const targetCnF = (viewData?.name || '').toLowerCase().trim();
                const recordIndCnF = (originalRecord.indianCnF || '').toLowerCase().trim();
                const recordBdCnF = (originalRecord.bdCnF || '').toLowerCase().trim();

                if (editRecord.cnfType === 'Indian' || recordIndCnF === targetCnF) {
                    updatedData.indCnFComm = editHistoryData.commission;
                    updatedData.indCnFCost = editHistoryData.totalCommission;
                    updatedData.indCnFUom = editHistoryData.uom;
                    updatedData.indCnFEdited = true;
                    updatedData.indCnFBulkEdited = true;
                } else if (editRecord.cnfType === 'BD' || recordBdCnF === targetCnF) {
                    updatedData.bdCnFComm = editHistoryData.commission;
                    updatedData.bdCnFCost = editHistoryData.totalCommission;
                    updatedData.bdCnFUom = editHistoryData.uom;
                    updatedData.bdCnFEdited = true;
                    updatedData.bdCnFBulkEdited = true;
                }

                await axios.put(`${API_BASE_URL}/api/stock/${editRecord._id}`, updatedData);
            }
            setEditRecord(null);
            fetchCnFHistory(viewData.name);
            fetchCnFs();
        } catch (error) {
            console.error('Error saving history update:', error);
            showToast('error', 'Failed to save changes. Please try again.');
        } finally {
            setIsSavingHistory(false);
        }
    };

    const startHistoryLongPress = (id) => {
        historyLongPressTimer.current = setTimeout(() => {
            isHistoryLongPressTriggered.current = true;
            setIsHistorySelectionMode(true);
            setSelectedHistoryIds(new Set([id]));
        }, 500);
    };

    const endHistoryLongPress = () => {
        if (historyLongPressTimer.current) {
            clearTimeout(historyLongPressTimer.current);
            historyLongPressTimer.current = null;
        }
    };

    const toggleHistorySelection = (id) => {
        const row = filteredHistory.find(r => r._id === id);
        if (!row) return;

        const isEditable = canUserEditRecord(row);
        if (!isEditable) return;

        setSelectedHistoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                if (next.size === 0) setIsHistorySelectionMode(false);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleSelectAllHistory = () => {
        const editableIds = filteredHistory
            .filter(row => canUserEditRecord(row))
            .map(row => row._id);

        if (selectedHistoryIds.size === editableIds.length && editableIds.length > 0) {
            setSelectedHistoryIds(new Set());
            setIsHistorySelectionMode(false);
        } else {
            setSelectedHistoryIds(new Set(editableIds));
        }
    };

    const handleBulkUpdateHistory = async () => {
        if (selectedHistoryIds.size === 0) return;
        setIsSubmitting(true);
        try {
            const selectedRecords = filteredHistory.filter(r => selectedHistoryIds.has(r._id));
            const selectedStockRecords = selectedRecords.filter(r => r.source === 'LC');
            const selectedSaleRecords = selectedRecords.filter(r => r.source === 'Sale');

            if (selectedStockRecords.length > 0) {
                const res = await axios.get(`${API_BASE_URL}/api/stock`);
                for (const row of selectedStockRecords) {
                    const originalRecord = res.data.find(r => r._id === row._id);
                    if (!originalRecord) continue;

                    const updatedData = { ...originalRecord };
                    const recordIndCnF = (originalRecord.indianCnF || '').toLowerCase().trim();
                    const recordBdCnF = (originalRecord.bdCnF || '').toLowerCase().trim();
                    const targetCnF = (viewData?.name || '').toLowerCase().trim();
                    const commissionRate = parseFloat(bulkEditData.commission) || 0;
                    const qty = parseFloat(row.qty) || 0;

                    let totalCommission = 0;
                    if (bulkEditData.uom === 'QTY') {
                        totalCommission = qty * commissionRate;
                    } else if (bulkEditData.uom === 'TRUCK') {
                        const truckCount = !isNaN(parseFloat(row.truck)) ? parseFloat(row.truck) : 1;
                        totalCommission = truckCount * commissionRate;
                    } else if (bulkEditData.uom === 'BAG') {
                        const bagCount = !isNaN(parseFloat(row.bag)) ? parseFloat(row.bag) : 0;
                        totalCommission = bagCount * commissionRate;
                    } else {
                        totalCommission = commissionRate;
                    }

                    if (row.cnfType === 'Indian' || recordIndCnF === targetCnF) {
                        updatedData.indCnFComm = commissionRate;
                        updatedData.indCnFCost = totalCommission;
                        updatedData.indCnFUom = bulkEditData.uom;
                        updatedData.indCnFBulkEdited = true;
                    } else if (row.cnfType === 'BD' || recordBdCnF === targetCnF) {
                        updatedData.bdCnFComm = commissionRate;
                        updatedData.bdCnFCost = totalCommission;
                        updatedData.bdCnFUom = bulkEditData.uom;
                        updatedData.bdCnFBulkEdited = true;
                    }
                    await axios.put(`${API_BASE_URL}/api/stock/${originalRecord._id}`, updatedData);
                }
            }

            if (selectedSaleRecords.length > 0) {
                const salesRes = await axios.get(`${API_BASE_URL}/api/sales`);
                const allSales = Array.isArray(salesRes.data) ? salesRes.data : [];
                const saleIds = [...new Set(selectedSaleRecords.map(r => r.originalId))];

                for (const saleId of saleIds) {
                    const originalSale = allSales.find(s => s._id === saleId);
                    if (!originalSale) continue;

                    const updatedSale = { ...originalSale };
                    const sampleRow = selectedSaleRecords.find(r => r.originalId === saleId);
                    const isIndian = sampleRow.cnfType === 'Indian';

                    if (isIndian) {
                        updatedSale.indCommissionRate = bulkEditData.commission;
                        updatedSale.indCommissionUom = bulkEditData.uom;
                        updatedSale.indCommissionEdited = true;
                    } else {
                        updatedSale.bdCommissionRate = bulkEditData.commission;
                        updatedSale.bdCommissionUom = bulkEditData.uom;
                        updatedSale.bdCommissionEdited = true;
                    }

                    const totalTrucks = (updatedSale.items || []).reduce((sum, p) =>
                        sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.truck) || 0), 0)
                    , 0);
                    const totalQty = (updatedSale.items || []).reduce((sum, p) =>
                        sum + (p.brandEntries || []).reduce((eSum, e) => eSum + (parseFloat(e.quantity) || 0), 0)
                    , 0);

                    const rate = parseFloat(bulkEditData.commission) || 0;
                    const uom = (bulkEditData.uom || '').toUpperCase();
                    const newTotal = uom === 'BOE' ? rate : (uom === 'TRUCK' ? totalTrucks : totalQty) * rate;

                    if (isIndian) {
                        updatedSale.indCommissionTotal = newTotal.toFixed(2);
                    } else {
                        updatedSale.bdCommissionTotal = newTotal.toFixed(2);
                    }

                    updatedSale.isCnfCommissionUpdate = true;
                    await axios.put(`${API_BASE_URL}/api/sales/${saleId}`, updatedSale);
                }
            }

            setIsBulkEditModalOpen(false);
            setIsHistorySelectionMode(false);
            setSelectedHistoryIds(new Set());
            fetchCnFHistory(viewData.name);
            fetchCnFs();
            showToast('success', `Bulk updated successfully!`);
        } catch (error) {
            console.error('Error in bulk update:', error);
            showToast('error', 'Failed to update some records. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (e) => {
        const { name } = e.target;
        let { value } = e.target;
        if (name === 'phone') {
            if (!value.startsWith('+880')) value = '+880' + value.replace(/^\+880?/, '');
            if (value.length <= 14) setFormData(prev => ({ ...prev, [name]: value }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const generateNextId = (type, existing) => {
        const prefix = type === 'Indian' ? 'IND' : 'BD';
        const padding = type === 'Indian' ? 3 : 4;
        const typedAgents = existing.filter(a => (a.cnfId || '').startsWith(prefix));
        if (typedAgents.length === 0) return prefix + (1).toString().padStart(padding, '0');
        const numbers = typedAgents.map(a => parseInt((a.cnfId || '').replace(prefix, '')) || 0);
        return prefix + (Math.max(...numbers) + 1).toString().padStart(padding, '0');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isAccountManager) {
            showToast('error', 'Forbidden: Account managers are not allowed to register C&F agents.');
            return;
        }
        if (formData.phone.length !== 14) {
            showToast('error', 'Phone number must be exactly 14 characters long.');
            return;
        }
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const { cnf_location_full, ...rest } = formData;
            const submitData = { ...rest, address: cnf_location_full, type: moduleType };
            const url = editingId ? `${API_BASE_URL}/api/cnfs/${editingId}` : `${API_BASE_URL}/api/cnfs`;
            if (editingId) await axios.put(url, submitData);
            else await axios.post(url, submitData);
            setSubmitStatus('success');
            fetchCnFs();
            setTimeout(() => { setShowForm(false); setEditingId(null); resetForm(); setSubmitStatus(null); }, 2000);
        } catch (error) {
            console.error('Error saving C&F:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            cnfId: generateNextId(moduleType, cnfs),
            name: '',
            cnf_location_full: '',
            contactPerson: '',
            email: '',
            phone: '+880',
            uom: 'QTY',
            commission: '',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (cnf) => {
        setFormData({
            cnfId: cnf.cnfId || '',
            name: cnf.name || '',
            cnf_location_full: cnf.address || '',
            contactPerson: cnf.contactPerson || '',
            email: cnf.email || '',
            phone: cnf.phone || '+880',
            uom: cnf.uom || cnf.commissionType || 'QTY',
            commission: cnf.commission || '',
            status: cnf.status || 'Active'
        });
        setEditingId(cnf._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete C&F records');
            return;
        }
        onDeleteConfirm({ show: true, type: 'cnf', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === cnfs.length) { setSelectedItems(new Set()); setIsSelectionMode(false); }
        else setSelectedItems(new Set(cnfs.map(i => i._id)));
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.cnf?.key === key && sortConfig.cnf?.direction === 'asc') direction = 'desc';
        setSortConfig({ ...sortConfig, cnf: { key, direction } });
    };

    const sortData = (data) => {
        const config = sortConfig.cnf || { key: 'cnfId', direction: 'asc' };
        const { key, direction } = config;
        return [...data].sort((a, b) => {
            const aVal = (a[key] || '').toString().toLowerCase();
            const bVal = (b[key] || '').toString().toLowerCase();
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };


    return (
        <div className="cnf-container">
            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 18px', borderRadius: '12px', minWidth: '260px', maxWidth: '380px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    animation: 'fadeIn 0.3s ease',
                }}>
                    <span style={{ fontSize: '18px' }}>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <p style={{
                        margin: 0, fontSize: '13px', fontWeight: 600,
                        color: toast.type === 'success' ? '#166534' : '#991b1b'
                    }}>{toast.message}</p>
                    <button onClick={() => setToast(null)} style={{
                        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                        color: toast.type === 'success' ? '#166534' : '#991b1b', fontSize: '16px', lineHeight: 1
                    }}>×</button>
                </div>
            )}
            <div className="cnf-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-1/4 text-center md:text-left">
                    <h2 className="cnf-title whitespace-nowrap">{moduleType || 'C&F'} C&F Agent Management</h2>
                </div>

                {!showForm && (
                    <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                        <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] md:text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                        />
                    </div>
                )}

                {!showForm && (
                    <div className="w-full md:w-1/4 flex justify-end gap-2 z-10">
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="w-full md:w-auto flex items-center justify-center gap-2 h-10 px-5 bg-white border border-gray-200 text-gray-700 rounded-xl text-[13px] font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all whitespace-nowrap"
                            title={`View ${moduleType} C&F Agent Report`}
                        >
                            <BarChartIcon className="w-5 h-5 text-gray-500" />
                            <span>Report</span>
                        </button>
                        {!isAccountManager && (
                            <button onClick={() => { resetForm(); setShowForm(true); }} className="w-full md:w-auto cnf-add-btn whitespace-nowrap">+ Add New</button>
                        )}
                    </div>
                )}
            </div>

            {showForm && (
                <div className="cnf-form-container">
                    <div className="cnf-form-header">
                        <h3 className="cnf-form-title">{editingId ? `Edit ${moduleType}` : `New ${moduleType} Registration`}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="cnf-form-close"><XIcon className="w-6 h-6" /></button>
                    </div>
                    <form
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="cnf-form"
                        autoComplete="off"
                    >
                        <div className="cnf-form-field"><label className="cnf-form-label">ID</label><input type="text" name="cnfId" value={formData.cnfId} readOnly className="cnf-form-input bg-gray-50/50 cursor-not-allowed font-bold" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">{moduleType} Name</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Full Name" className="cnf-form-input" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Address</label><textarea name="cnf_location_full" value={formData.cnf_location_full} onChange={handleInputChange} required placeholder="Full Address" rows="1" className="cnf-form-textarea" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Contact Person</label><input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required placeholder="Contact Name" className="cnf-form-input" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Email</label><input type="email" name="email" value={formData.email} onChange={handleInputChange} required placeholder="email@example.com" className="cnf-form-input" /></div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Phone</label><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="cnf-form-input" /></div>
                        <div className="cnf-form-field">
                            <label className="cnf-form-label">UOM</label>
                            <select name="uom" value={formData.uom} onChange={handleInputChange} className="cnf-form-select">
                                <option value="QTY">QTY</option>
                                <option value="Truck">Truck</option>
                            </select>
                        </div>
                        <div className="cnf-form-field"><label className="cnf-form-label">Commission</label><input type="number" step="0.01" name="commission" value={formData.commission} onChange={handleInputChange} placeholder="0.00" className="cnf-form-input" /></div>
                        <div className="cnf-form-field">
                            <label className="cnf-form-label">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="cnf-form-select">
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="cnf-form-footer">
                            <div className="flex items-center gap-4">
                                {submitStatus === 'success' && <p className="cnf-form-success">C&F saved successfully!</p>}
                                {submitStatus === 'error' && <p className="cnf-form-error">Failed to save C&F.</p>}
                            </div>
                            <div className="cnf-form-spacer"></div>
                            <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Record'}</button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (() => {
                const filteredCnfs = cnfs.filter(cnf =>
                    (cnf.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (cnf.cnfId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (cnf.phone || '').includes(searchQuery)
                );

                return (
                    <div className="cnf-table-container">
                        {selectedItems.size > 0 && (
                            <div className="cnf-selection-bar flex items-center justify-between px-6 py-4 bg-gray-900 rounded-2xl mb-4 shadow-xl shadow-gray-900/20 animate-in slide-in-from-top-4 duration-300">
                                <div className="flex items-center gap-3 font-black text-white">
                                    <div className="px-2 py-1 bg-white/20 rounded-md text-[10px]">{selectedItems.size}</div>
                                    <span className="text-sm">Items Selected</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors">Cancel</button>
                                    <button onClick={() => onDeleteConfirm({ show: true, type: 'cnf', id: null, isBulk: true })} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black hover:bg-red-600 transition-all flex items-center gap-2">
                                        <TrashIcon className="w-3.5 h-3.5" /> Delete Bulk
                                    </button>
                                </div>
                            </div>
                        )}
                        {isLoading ? (
                            <div className="cnf-loading"><div className="cnf-spinner"></div></div>
                        ) : cnfs.length > 0 ? (
                            <>
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="cnf-table">
                                        <thead>
                                            <tr className="cnf-table-header-row">
                                                {isSelectionMode && <th className="cnf-table-checkbox-header"><input type="checkbox" checked={selectedItems.size === cnfs.length} onChange={toggleSelectAll} /></th>}
                                                <th className="cnf-table-header !text-left px-6" onClick={() => requestSort('cnfId')}>
                                                    <div className="flex items-center gap-1">ID <SortIcon config={sortConfig.cnf} columnKey="cnfId" /></div>
                                                </th>
                                                <th className="cnf-table-header !text-left px-6" onClick={() => requestSort('name')}>
                                                    <div className="flex items-center gap-1">Name <SortIcon config={sortConfig.cnf} columnKey="name" /></div>
                                                </th>
                                                <th className="cnf-table-header !text-left px-6">Contact</th>
                                                <th className="cnf-table-header !text-left px-6">Phone</th>
                                                <th className="cnf-table-header !text-left px-6">UOM</th>
                                                <th className="cnf-table-header !text-right px-6">Commission (Tk)</th>
                                                <th className="cnf-table-header !text-right px-6">Balance (Tk)</th>
                                                <th className="cnf-table-header !text-center px-6">Status</th>
                                                <th className="cnf-table-header !text-right px-6">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="cnf-table-body">
                                            {sortData(filteredCnfs).map((cnf) => (
                                                <tr key={cnf._id} className="cnf-table-row"
                                                    onMouseDown={() => startLongPress(cnf._id)}
                                                    onMouseUp={endLongPress}
                                                    onMouseLeave={endLongPress}
                                                    onTouchStart={(e) => startLongPress(cnf._id)}
                                                    onTouchEnd={endLongPress}
                                                    onClick={(e) => {
                                                        if (isLongPressTriggered.current) {
                                                            isLongPressTriggered.current = false;
                                                            return;
                                                        }
                                                        if (isSelectionMode) toggleSelection(cnf._id);
                                                    }}>
                                                    {isSelectionMode && <td className="cnf-table-cell px-6"><input type="checkbox" checked={selectedItems.has(cnf._id)} readOnly /></td>}
                                                    <td className="cnf-table-cell px-6 font-bold !text-left">{cnf.cnfId}</td>
                                                    <td className="cnf-table-cell px-6 !text-left">{cnf.name}</td>
                                                    <td className="cnf-table-cell px-6 !text-left">{cnf.contactPerson}</td>
                                                    <td className="cnf-table-cell px-6 !text-left">{cnf.phone}</td>
                                                    <td className="cnf-table-cell px-6 !text-left">{cnf.uom || 'QTY'}</td>
                                                    <td className="cnf-table-cell px-6 font-bold !text-right">{cnf.commission}</td>
                                                    <td className="cnf-table-cell px-6 font-black !text-right">{(cnf.totalBalance || 0).toLocaleString('en-IN')}</td>
                                                    <td className="cnf-table-cell px-6 !text-center"><span className={`cnf-status-badge ${cnf.status === 'Active' ? 'active' : 'inactive'}`}>{cnf.status}</span></td>
                                                    <td className="cnf-table-cell px-6">
                                                        <div className="cnf-table-actions justify-end">
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(cnf); }} className="cnf-action-btn hover:bg-gray-100 text-gray-400 hover:text-gray-600"><EyeIcon className="w-5 h-5" /></button>
                                                            {canManage && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(cnf); }} className="cnf-action-btn cnf-action-edit"><EditIcon className="w-5 h-5" /></button>
                                                            )}
                                                            {canDelete && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(cnf._id); }} className="cnf-action-btn cnf-action-delete"><TrashIcon className="w-5 h-5" /></button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="block md:hidden px-2 py-3 space-y-3">
                                    {sortData(filteredCnfs).map((cnf) => {
                                        const isExpanded = expandedCnFId === cnf._id;
                                        return (
                                            <div
                                                key={cnf._id}
                                                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${selectedItems.has(cnf._id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 shadow-sm'} ${isExpanded ? 'ring-1 ring-blue-50 shadow-md border-blue-200' : 'hover:border-gray-200 shadow-sm'}`}
                                                onMouseDown={() => startLongPress(cnf._id)}
                                                onMouseUp={endLongPress}
                                                onMouseLeave={endLongPress}
                                                onTouchStart={(e) => startLongPress(cnf._id)}
                                                onTouchEnd={endLongPress}
                                                onClick={(e) => {
                                                    if (isLongPressTriggered.current) {
                                                        isLongPressTriggered.current = false;
                                                        return;
                                                    }
                                                    if (isSelectionMode) {
                                                        toggleSelection(cnf._id);
                                                    } else {
                                                        setExpandedCnFId(isExpanded ? null : cnf._id);
                                                    }
                                                }}
                                            >
                                                <div className="flex justify-between items-center p-4">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        {isSelectionMode && (
                                                            <input type="checkbox" checked={selectedItems.has(cnf._id)} readOnly className="w-5 h-5 accent-blue-600 shrink-0" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{cnf.name}</p>
                                                            <p className="text-[10px] font-bold text-gray-900 mt-0.5 tracking-wider uppercase opacity-80">{cnf.cnfId}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-0.5 text-xs font-black shrink-0">
                                                            {(cnf.totalBalance || 0).toLocaleString('en-IN')} Tk
                                                        </span>
                                                        <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                                                            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                        <div className="space-y-2.5 pt-3 border-t border-gray-50 text-xs">
                                                            <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Contact Person</span><span className="text-gray-900 font-black">{cnf.contactPerson}</span></div>
                                                            <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Phone</span><span className="text-gray-900 font-black font-mono">{cnf.phone}</span></div>
                                                            <div className="flex justify-between items-center bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Balance</span>
                                                                <span className="text-gray-900 font-black">{(cnf.totalBalance || 0).toLocaleString('en-IN')} Tk</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(cnf); }} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 text-gray-700 rounded-xl text-xs font-black flex-1 hover:bg-gray-100 transition-all active:scale-95"><EyeIcon className="w-4 h-4" /> History</button>
                                                            {canManage && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(cnf); }} className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"><EditIcon className="w-4 h-4" /> Edit</button>
                                                            )}
                                                            {canDelete && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(cnf._id); }} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"><TrashIcon className="w-4 h-4" /></button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : <div className="cnf-empty"><p>{searchQuery ? 'No agents found matching your search.' : 'No agents found.'}</p></div>}
                    </div>
                );
            })()}

            {viewData && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewData(null)}></div>
                    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-[96vw] xl:max-w-[1750px] w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                        <div className="relative px-4 py-4 md:px-8 md:py-6 border-b border-gray-100 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white flex-shrink-0 z-10 rounded-t-2xl">
                            <div className="flex-1 text-left w-full flex items-center justify-between md:block pr-12 md:pr-0">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{viewData.name}</h2>
                                    <p className="text-xs text-gray-500 mt-1">ID: {viewData.cnfId}</p>
                                </div>
                                {/* Mobile Close Button */}
                                <button onClick={() => setViewData(null)} className="md:hidden p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Search bar - centered */}
                            <div className="flex-1 flex flex-col items-center gap-3 w-full">
                                {/* Desktop Search Input */}
                                <div className="hidden md:block w-full max-w-sm relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder={historyViewMode === 'earnings' ? "Search history..." : "Search payments..."}
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                    />
                                </div>

                                {/* Mobile Search & Action Bar */}
                                <div className="md:hidden w-full flex items-center gap-2 px-1">
                                    <div className="relative flex-1">
                                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder={historyViewMode === 'earnings' ? "Search history..." : "Search payments..."}
                                            value={historySearchQuery}
                                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                        />
                                    </div>
                                    <button
                                        ref={historyFilterButtonMobileRef}
                                        onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                            }`}
                                    >
                                        <FunnelIcon className="w-4 h-4 text-gray-400" />
                                    </button>
                                    <button
                                        onClick={handlePrintHistory}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl transition-all border bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                                    >
                                        <PrinterIcon className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 max-w-full overflow-x-auto hide-scrollbar shrink-0 px-1 py-0.5">
                                    <button
                                        onClick={() => { setHistoryViewMode('earnings'); setExpandedHistoryIdx(null); }}
                                        className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${historyViewMode === 'earnings'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Earnings
                                    </button>
                                    <button
                                        onClick={() => { setHistoryViewMode('expense'); setExpandedHistoryIdx(null); }}
                                        className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${historyViewMode === 'expense'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        LC Expense
                                    </button>
                                    <button
                                        onClick={() => { setHistoryViewMode('payments'); setExpandedHistoryIdx(null); }}
                                        className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${historyViewMode === 'payments'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Payment History
                                    </button>
                                    <button
                                        onClick={() => { setHistoryViewMode('all'); setExpandedHistoryIdx(null); }}
                                        className={`px-5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${historyViewMode === 'all'
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        All
                                    </button>
                                </div>
                            </div>
                            {/* Desktop Actions Column */}
                            <div className="hidden md:flex flex-1 items-center justify-end gap-2">
                                <div className="relative">
                                    <button
                                        ref={historyFilterButtonRef}
                                        onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                        className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                            }`}
                                    >
                                        <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                    </button>
                                </div>

                                <button
                                    onClick={handlePrintHistory}
                                    className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl transition-all border bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30"
                                    title="Print Report"
                                >
                                    <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                </button>

                                {isHistorySelectionMode && (
                                    <button onClick={() => setIsBulkEditModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow shadow-blue-500/30 text-sm font-medium whitespace-nowrap">
                                        Bulk Edit ({selectedHistoryIds.size})
                                    </button>
                                )}
                                <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* History Filter Panel */}
                            {showHistoryFilterPanel && (
                                <>
                                    {/* Mobile Backdrop */}
                                    <div 
                                        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[2005] md:hidden"
                                        onClick={() => setShowHistoryFilterPanel(false)}
                                    />
                                    <div 
                                        ref={historyFilterPanelRef} 
                                        className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-8 md:mt-2 w-auto md:w-80 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200"
                                    >
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                                            <h4 className="font-bold text-gray-900 text-sm">Advanced Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setHistoryFilters({ startDate: '', endDate: '', lcNo: '', productName: '', port: '' });
                                                    setHistoryFilterSearchInputs({ lcNo: '', product: '', port: '' });
                                                    setHistoryFilterDropdownOpen({ lcNo: false, product: false, port: false });
                                                    setHighlightedHistoryFilterIndex(-1);
                                                }}
                                                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        <div className="space-y-4 text-left">
                                            <div className="space-y-2">
                                                <CustomDatePicker
                                                    label="From Date"
                                                    value={historyFilters.startDate}
                                                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                    compact={true}
                                                />
                                                <CustomDatePicker
                                                    label="To Date"
                                                    value={historyFilters.endDate}
                                                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                    compact={true}
                                                />
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                {/* LC No Dropdown */}
                                                <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC NUMBER</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.lcNo}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: e.target.value }));
                                                                setHistoryFilters(prev => ({ ...prev, lcNo: e.target.value }));
                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: true, product: false, port: false }));
                                                                setHighlightedHistoryFilterIndex(-1);
                                                            }}
                                                            onFocus={() => {
                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: true, product: false, port: false }));
                                                                setHighlightedHistoryFilterIndex(-1);
                                                            }}
                                                            onKeyDown={(e) => handleHistoryFilterKeyDown(e, 'lcNo', 'lcNo', 'lcNo')}
                                                            placeholder={historyFilters.lcNo || "Select LC No..."}
                                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-8"
                                                        />
                                                        {historyFilters.lcNo && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setHistoryFilters(prev => ({ ...prev, lcNo: '' }));
                                                                    setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: '' }));
                                                                }}
                                                                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition-colors"
                                                            >
                                                                <XIcon className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                    </div>
                                                    {historyFilterDropdownOpen.lcNo && (() => {
                                                        const options = getUniqueHistoryOptions('lcNo');
                                                        const filtered = options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.lcNo.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                {filtered.map((opt, idx) => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters(prev => ({ ...prev, lcNo: opt }));
                                                                            setHistoryFilterSearchInputs(prev => ({ ...prev, lcNo: '' }));
                                                                            setHistoryFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
                                                                            setHighlightedHistoryFilterIndex(-1);
                                                                        }}
                                                                        onMouseEnter={() => setHighlightedHistoryFilterIndex(idx)}
                                                                        className={`w-full px-4 py-1.5 text-left text-xs transition-colors ${highlightedHistoryFilterIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                {/* Product Dropdown */}
                                                <div className="space-y-1.5 relative" ref={productFilterSearchRef}>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.product}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs(prev => ({ ...prev, product: e.target.value }));
                                                                setHistoryFilters(prev => ({ ...prev, productName: e.target.value }));
                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, product: true, lcNo: false, port: false }));
                                                                setHighlightedHistoryFilterIndex(-1);
                                                            }}
                                                            onFocus={() => {
                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, product: true, lcNo: false, port: false }));
                                                                setHighlightedHistoryFilterIndex(-1);
                                                            }}
                                                            onKeyDown={(e) => handleHistoryFilterKeyDown(e, 'product', 'product', 'productName')}
                                                            placeholder={historyFilters.productName || "Select Product..."}
                                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-8"
                                                        />
                                                        {historyFilters.productName && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setHistoryFilters(prev => ({ ...prev, productName: '' }));
                                                                    setHistoryFilterSearchInputs(prev => ({ ...prev, product: '' }));
                                                                }}
                                                                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition-colors"
                                                            >
                                                                <XIcon className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                    </div>
                                                    {historyFilterDropdownOpen.product && (() => {
                                                        const options = getUniqueHistoryOptions('product');
                                                        const filtered = options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.product.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                {filtered.map((opt, idx) => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters(prev => ({ ...prev, productName: opt }));
                                                                            setHistoryFilterSearchInputs(prev => ({ ...prev, product: '' }));
                                                                            setHistoryFilterDropdownOpen(prev => ({ ...prev, product: false }));
                                                                            setHighlightedHistoryFilterIndex(-1);
                                                                        }}
                                                                        onMouseEnter={() => setHighlightedHistoryFilterIndex(idx)}
                                                                        className={`w-full px-4 py-1.5 text-left text-xs transition-colors ${highlightedHistoryFilterIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                {/* Port Dropdown */}
                                                <div className="space-y-1.5 relative" ref={portFilterSearchRef}>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">PORT</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.port}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs(prev => ({ ...prev, port: e.target.value }));
                                                                setHistoryFilters(prev => ({ ...prev, port: e.target.value }));
                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, port: true, lcNo: false, product: false }));
                                                                setHighlightedHistoryFilterIndex(-1);
                                                            }}
                                                            onFocus={() => {
                                                                setHistoryFilterDropdownOpen(prev => ({ ...prev, port: true, lcNo: false, product: false }));
                                                                setHighlightedHistoryFilterIndex(-1);
                                                            }}
                                                            onKeyDown={(e) => handleHistoryFilterKeyDown(e, 'port', 'port', 'port')}
                                                            placeholder={historyFilters.port || "Select Port..."}
                                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-8"
                                                        />
                                                        {historyFilters.port && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setHistoryFilters(prev => ({ ...prev, port: '' }));
                                                                    setHistoryFilterSearchInputs(prev => ({ ...prev, port: '' }));
                                                                }}
                                                                className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition-colors"
                                                            >
                                                                <XIcon className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                    </div>
                                                    {historyFilterDropdownOpen.port && (() => {
                                                        const options = getUniqueHistoryOptions('port');
                                                        const filtered = options.filter(opt => opt.toLowerCase().includes(historyFilterSearchInputs.port.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                                {filtered.map((opt, idx) => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters(prev => ({ ...prev, port: opt }));
                                                                            setHistoryFilterSearchInputs(prev => ({ ...prev, port: '' }));
                                                                            setHistoryFilterDropdownOpen(prev => ({ ...prev, port: false }));
                                                                            setHighlightedHistoryFilterIndex(-1);
                                                                        }}
                                                                        onMouseEnter={() => setHighlightedHistoryFilterIndex(idx)}
                                                                        className={`w-full px-4 py-1.5 text-left text-xs transition-colors ${highlightedHistoryFilterIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>

                                            <button onClick={() => setShowHistoryFilterPanel(false)} className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-[0.98]">
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto p-4 md:p-8 pt-6 md:pt-8 hide-scrollbar min-h-0">
                            {historyLoading ? <div className="flex justify-center p-12"><div className="w-8 h-8 border-2 border-t-blue-600 rounded-full animate-spin"></div></div> : (
                                <div className="space-y-6">
                                    {(() => {
                                        const totalTrucks = filteredHistory.reduce((acc, row) => acc + (parseFloat(row.truck) || 0), 0);
                                        const totalBill = filteredHistory.reduce((acc, row) => acc + (parseFloat(row.totalCommission) || 0), 0) +
                                                          filteredExpenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
                                        const totalPaid = filteredPayments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
                                        const totalDiscount = filteredPayments.reduce((acc, p) => acc + (parseFloat(p.discount) || 0), 0);
                                        const currentBalance = totalBill - (totalPaid + totalDiscount);

                                        return (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                                                {/* Total Truck Card */}
                                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100/50 p-4 sm:p-5 rounded-2xl shadow-sm group hover:shadow-md transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                        <div className="space-y-1 min-w-0 flex-1 w-full">
                                                            <div className="flex items-center justify-between sm:block">
                                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-70 truncate">Total Truck</p>
                                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 sm:hidden shrink-0">
                                                                    <TruckIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                <h3 className="text-sm xs:text-base sm:text-2xl font-black text-gray-900 leading-none truncate sm:truncate">
                                                                    {totalTrucks.toLocaleString('en-IN')}
                                                                </h3>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">Units</span>
                                                            </div>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shrink-0 ml-2">
                                                            <TruckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Total Bill Card */}
                                                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100/50 p-4 sm:p-5 rounded-2xl shadow-sm group hover:shadow-md transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                        <div className="space-y-1 min-w-0 flex-1 w-full">
                                                            <div className="flex items-center justify-between sm:block">
                                                                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest opacity-70 truncate">Total Bill</p>
                                                                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 sm:hidden shrink-0">
                                                                    <BarChartIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                <h3 className="text-sm xs:text-base sm:text-2xl font-black text-gray-900 leading-none truncate sm:truncate">
                                                                    {totalBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </h3>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">TK</span>
                                                            </div>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-100 items-center justify-center text-purple-600 group-hover:scale-110 transition-transform shrink-0 ml-2">
                                                            <BarChartIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Total Paid Card */}
                                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 p-4 sm:p-5 rounded-2xl shadow-sm group hover:shadow-md transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                        <div className="space-y-1 min-w-0 flex-1 w-full">
                                                            <div className="flex items-center justify-between sm:block">
                                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-70 truncate">Total Paid</p>
                                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 sm:hidden shrink-0">
                                                                    <DollarSignIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                <h3 className="text-sm xs:text-base sm:text-2xl font-black text-gray-900 leading-none truncate sm:truncate">
                                                                    {totalPaid.toLocaleString('en-IN')}
                                                                </h3>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">TK</span>
                                                            </div>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-100 items-center justify-center text-blue-600 group-hover:scale-110 transition-transform shrink-0 ml-2">
                                                            <DollarSignIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Total Discount Card */}
                                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 p-4 sm:p-5 rounded-2xl shadow-sm group hover:shadow-md transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                        <div className="space-y-1 min-w-0 flex-1 w-full">
                                                            <div className="flex items-center justify-between sm:block">
                                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest opacity-70 truncate">Total Discount</p>
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 sm:hidden shrink-0">
                                                                    <ReceiptIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                <h3 className="text-sm xs:text-base sm:text-2xl font-black text-gray-900 leading-none truncate sm:truncate">
                                                                    {totalDiscount.toLocaleString('en-IN')}
                                                                </h3>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">TK</span>
                                                            </div>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shrink-0 ml-2">
                                                            <ReceiptIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Balance Card */}
                                                <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-100/50 p-4 sm:p-5 rounded-2xl shadow-sm group hover:shadow-md transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                        <div className="space-y-1 min-w-0 flex-1 w-full">
                                                            <div className="flex items-center justify-between sm:block">
                                                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest opacity-70 truncate">Current Balance</p>
                                                                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 sm:hidden shrink-0">
                                                                    <TrendingUpIcon className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-baseline gap-0.5 sm:gap-1">
                                                                <h3 className="text-sm xs:text-base sm:text-2xl font-black text-gray-900 leading-none truncate sm:truncate">
                                                                    {currentBalance.toLocaleString('en-IN')}
                                                                </h3>
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">TK</span>
                                                            </div>
                                                        </div>
                                                        <div className="hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-100 items-center justify-center text-rose-600 group-hover:scale-110 transition-transform shrink-0 ml-2">
                                                            <TrendingUpIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}


                                    {historyViewMode === 'earnings' ? (
                                        <>
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="cnf-table">
                                                    <thead>
                                                        <tr className="cnf-table-header-row">
                                                            {isHistorySelectionMode && <th className="cnf-table-checkbox-header"><input type="checkbox" checked={selectedHistoryIds.size === filteredHistory.length} onChange={toggleSelectAllHistory} /></th>}
                                                            <th className="cnf-table-header">Date</th>
                                                            <th className="cnf-table-header whitespace-nowrap">LC No</th>
                                                            <th className="cnf-table-header">Importer</th>
                                                            <th className="cnf-table-header">Exporter</th>
                                                            <th className="cnf-table-header">Product</th>
                                                            <th className="cnf-table-header">Port</th>
                                                            <th className="cnf-table-header text-center">Truck</th>
                                                            <th className="cnf-table-header text-center whitespace-nowrap">BOE No</th>
                                                            <th className="cnf-table-header text-right">Bag</th>
                                                            <th className="cnf-table-header text-right">Qty</th>
                                                            <th className="cnf-table-header text-right">Commission</th>
                                                            <th className="cnf-table-header text-right">Total</th>
                                                            <th className="cnf-table-header text-center whitespace-nowrap">Source</th>
                                                            <th className="cnf-table-header text-center whitespace-nowrap">Status</th>
                                                            <th className="cnf-table-header text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="cnf-table-body">
                                                        {filteredHistory.map((row, idx) => (
                                                            <tr key={idx} className={`cnf-table-row cursor-pointer transition-colors ${selectedHistoryIds.has(row._id) ? 'bg-blue-50/50' : ''}`}
                                                                onMouseDown={() => startHistoryLongPress(row._id)}
                                                                onMouseUp={endHistoryLongPress}
                                                                onMouseLeave={endHistoryLongPress}
                                                                onTouchStart={(e) => startHistoryLongPress(row._id)}
                                                                onTouchEnd={endHistoryLongPress}
                                                                onClick={(e) => {
                                                                    if (isHistoryLongPressTriggered.current) {
                                                                        isHistoryLongPressTriggered.current = false;
                                                                        return;
                                                                    }
                                                                    if (isHistorySelectionMode) {
                                                                        toggleHistorySelection(row._id);
                                                                    }
                                                                }}>
                                                                {isHistorySelectionMode && (
                                                                    <td className="cnf-table-cell">
                                                                        {((row.source !== 'Sale' && (isAdmin || (!row.indCnFEdited && !row.bdCnFEdited && !row.indCnFBulkEdited && !row.bdCnFBulkEdited))) ||
                                                                            (row.source === 'Sale' && (isAdmin || (row.cnfType === 'Indian' ? !row.indCommissionEdited : !row.bdCommissionEdited)))) ? (
                                                                            <input type="checkbox" checked={selectedHistoryIds.has(row._id)} readOnly />
                                                                        ) : null}
                                                                    </td>
                                                                )}
                                                                <td className="cnf-table-cell whitespace-nowrap">{formatDate(row.date)}</td>
                                                                <td className="cnf-table-cell font-bold whitespace-nowrap">{row.lcNo}</td>
                                                                <td className="cnf-table-cell truncate max-w-[200px]" title={row.importer || '-'}>{row.importer || '-'}</td>
                                                                <td className="cnf-table-cell truncate max-w-[200px]" title={row.exporter || '-'}>{row.exporter || '-'}</td>
                                                                <td className="cnf-table-cell font-medium">{row.product || '-'}</td>
                                                                <td className="cnf-table-cell">{row.port || '-'}</td>
                                                                <td className="cnf-table-cell text-center uppercase">{row.truck || '-'}</td>
                                                                <td className="cnf-table-cell text-center whitespace-nowrap font-medium">{row.billOfEntry || '-'}</td>
                                                                <td className="cnf-table-cell text-right font-bold">{(!isNaN(parseFloat(row.bag))) ? Math.round(row.bag).toLocaleString('en-US') : '-'}</td>
                                                                <td className="cnf-table-cell text-right font-bold">{(!isNaN(parseFloat(row.qty))) ? Math.round(row.qty).toLocaleString('en-US') : '-'}</td>
                                                                <td className="cnf-table-cell text-right">{row.uom === 'BOE' ? '-' : row.commission}</td>
                                                                <td className="cnf-table-cell text-right font-black">{(row.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td className="cnf-table-cell text-center">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${row.source === 'Sale' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'} border ${row.source === 'Sale' ? 'border-amber-200' : 'border-blue-200'}`}>
                                                                        {row.source || 'LC'}
                                                                    </span>
                                                                </td>
                                                                <td className="cnf-table-cell text-center">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${row.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'} border`}>
                                                                        {row.paymentStatus}
                                                                    </span>
                                                                </td>
                                                                <td className="cnf-table-cell text-center">
                                                                    {canUserEditRecord(row) ? (
                                                                        <button onClick={(e) => { e.stopPropagation(); handleEditHistory(row); }} className="hover:bg-gray-100 p-1.5 rounded-md transition-colors">
                                                                            <EditIcon className="w-4 h-4 text-gray-400 hover:text-gray-900" />
                                                                        </button>
                                                                    ) : (
                                                                        row.source === 'Sale' ? (
                                                                            <span className="text-[8px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm inline-block">Sale Edited</span>
                                                                        ) : (
                                                                            <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm inline-block">Edited</span>
                                                                        )
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="block md:hidden space-y-3">
                                                {filteredHistory.length > 0 ? (
                                                    filteredHistory.map((row, idx) => {
                                                        const isExpanded = expandedHistoryIdx === idx;
                                                        const isSelected = selectedHistoryIds.has(row._id);
                                                        return (
                                                            <div
                                                                key={idx}
                                                                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isSelected ? 'border-gray-900 shadow-md ring-1 ring-gray-900/10' : 'border-gray-100 shadow-sm hover:border-gray-200'} ${isExpanded ? 'border-gray-200' : ''}`}
                                                                onMouseDown={() => startHistoryLongPress(row._id)}
                                                                onMouseUp={endHistoryLongPress}
                                                                onMouseLeave={endHistoryLongPress}
                                                                onTouchStart={(e) => startHistoryLongPress(row._id)}
                                                                onTouchEnd={endHistoryLongPress}
                                                                onClick={(e) => {
                                                                    if (isHistoryLongPressTriggered.current) {
                                                                        isHistoryLongPressTriggered.current = false;
                                                                        return;
                                                                    }
                                                                    if (isHistorySelectionMode) {
                                                                        const isEditable = canUserEditRecord(row);
                                                                        if (isEditable) {
                                                                            toggleHistorySelection(row._id);
                                                                        }
                                                                    } else {
                                                                        setExpandedHistoryIdx(isExpanded ? null : idx);
                                                                    }
                                                                }}
                                                            >
                                                                <div className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors">
                                                                    <div className="flex-1 min-w-0 pr-4 flex items-center gap-3">
                                                                        {isHistorySelectionMode && canUserEditRecord(row) && (
                                                                                <input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 accent-gray-900 shrink-0" onClick={(e) => e.stopPropagation()} />
                                                                            )}
                                                                        <div className="min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5 min-w-0">
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(row.date)}</p>
                                                                                <span className="h-1 w-1 bg-gray-300 rounded-full sm:block hidden"></span>
                                                                                <p className="text-xs font-bold text-gray-800 truncate max-w-[120px] xs:max-w-[180px] sm:max-w-none">{row.product || '-'}</p>
                                                                                <span className="h-1 w-1 bg-gray-300 rounded-full sm:block hidden"></span>
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${row.source === 'Sale' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                                                    {row.source || 'LC'}
                                                                                </span>
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${row.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'} border`}>
                                                                                    {row.paymentStatus}
                                                                                </span>
                                                                                {row.source === 'Sale' ? (
                                                                                    (row.cnfType === 'Indian' ? row.indCommissionEdited : row.bdCommissionEdited) && (
                                                                                        <span className="text-[8px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 sm:inline-block hidden">Sale Edited</span>
                                                                                    )
                                                                                ) : (
                                                                                    (row.indCnFEdited || row.bdCnFEdited || row.indCnFBulkEdited || row.bdCnFBulkEdited) && (
                                                                                        <span className="text-[8px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter shrink-0 sm:inline-block hidden">Edited</span>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                            <p className="text-sm font-black text-gray-900 truncate">{row.lcNo || '-'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-gray-50 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>{isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}</div>
                                                                </div>
                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-4 duration-300">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">Port<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-700 md:text-xs md:font-medium">{row.port || '-'}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1 md:text-right">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">Status<span className="md:hidden"> :</span></span>
                                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${row.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'} border inline-block`}>
                                                                                    {row.paymentStatus}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2.5 bg-gray-50/70 rounded-xl px-4 mt-2">
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">Importer<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-700 truncate max-w-[200px] md:max-w-none md:text-xs md:font-medium" title={row.importer || '-'}>{row.importer || '-'}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1 md:text-right">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">Exporter<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-700 truncate max-w-[200px] md:max-w-none md:text-xs md:font-medium" title={row.exporter || '-'}>{row.exporter || '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2.5 bg-gray-50/70 rounded-xl px-4">
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">Truck No<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-700 md:text-xs">{row.truck || '-'}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1 md:text-right">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">BOE No<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-700 md:text-xs">{row.billOfEntry || '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2.5 bg-gray-50/70 rounded-xl px-4 mt-2">
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1">
                                                                                <span className="text-gray-500 font-medium md:text-[10px] md:font-bold md:text-gray-400 md:uppercase md:tracking-wider">Bag / Qty<span className="md:hidden"> :</span></span>
                                                                                <span className="font-bold text-gray-900 md:text-xs">{row.bag && !isNaN(parseFloat(row.bag)) ? Math.round(parseFloat(row.bag)).toLocaleString('en-US') : '0'} / {row.qty && !isNaN(parseFloat(row.qty)) ? Math.round(parseFloat(row.qty)).toLocaleString('en-US') : '0'}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-50">
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1">
                                                                                <span className="text-gray-500 font-medium md:text-[9px] md:font-bold md:text-gray-400 md:uppercase md:tracking-widest">Commission ({row.uom || viewData?.uom || 'QTY'})<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-900 font-mono md:text-xs md:font-black">{row.uom === 'BOE' ? '-' : `${(row.commission || 0).toLocaleString('en-IN')} Tk`}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-xs md:block md:space-y-1 md:text-right">
                                                                                <span className="text-gray-500 font-medium md:text-[9px] md:font-bold md:text-gray-400 md:uppercase md:tracking-widest">Total Commission<span className="md:hidden"> :</span></span>
                                                                                <span className="font-semibold text-gray-900 font-mono md:text-xs md:font-black">{(row.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                                                                            {canUserEditRecord(row) ? (
                                                                                <button onClick={() => handleEditHistory(row)} className="flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black flex-1 active:scale-95 shadow-lg shadow-gray-900/20"><EditIcon className="w-4 h-4" /> Edit Record</button>
                                                                            ) : (
                                                                                <div className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-500 rounded-xl text-[10px] font-black flex-1 uppercase tracking-widest">
                                                                                    <LockIcon className="w-4 h-4" /> {row.source === 'Sale' ? 'Sale Edited & Locked' : 'Edited & Locked'}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-center py-12 text-gray-400"><BoxIcon className="w-8 h-8 mb-2 mx-auto opacity-20" /><p className="text-sm">No history results found</p></div>
                                                )}
                                            </div>
                                        </>
                                    ) : historyViewMode === 'expense' ? (
                                        <>
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="cnf-table">
                                                    <thead>
                                                        <tr className="cnf-table-header-row">
                                                            <th className="cnf-table-header">Billing Date</th>
                                                            <th className="cnf-table-header whitespace-nowrap">LC No</th>
                                                            <th className="cnf-table-header">Importer</th>
                                                            <th className="cnf-table-header">Product</th>
                                                            <th className="cnf-table-header">Port</th>
                                                            <th className="cnf-table-header text-right">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="cnf-table-body">
                                                        {filteredExpenses.map((row, idx) => (
                                                            <tr key={idx} className="cnf-table-row transition-colors">
                                                                <td className="cnf-table-cell whitespace-nowrap">{formatDate(row.date)}</td>
                                                                <td className="cnf-table-cell font-bold whitespace-nowrap text-blue-600">{row.lcNo}</td>
                                                                <td className="cnf-table-cell truncate max-w-[150px]">{row.importer}</td>
                                                                <td className="cnf-table-cell">{row.product}</td>
                                                                <td className="cnf-table-cell">{row.port}</td>
                                                                <td className="cnf-table-cell text-right font-black text-rose-600">
                                                                    {parseFloat(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {filteredExpenses.length === 0 && (
                                                            <tr>
                                                                <td colSpan="6" className="py-12 text-center text-gray-400">
                                                                    <div className="flex flex-col items-center justify-center">
                                                                        <DollarSignIcon className="w-12 h-12 mb-3 text-gray-200" />
                                                                        <p>No expense records found</p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="block md:hidden space-y-3">
                                                {filteredExpenses.length > 0 ? (
                                                    filteredExpenses.map((row, idx) => {
                                                        const isExpanded = expandedExpenseIdx === idx;
                                                        return (
                                                            <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm transition-all overflow-hidden">
                                                                <div
                                                                    className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                                                    onClick={() => setExpandedExpenseIdx(isExpanded ? null : idx)}
                                                                >
                                                                    <div className="flex-1 min-w-0 pr-4 flex items-center gap-2">
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(row.date)}</p>
                                                                        <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
                                                                        <span className="text-xs font-bold text-blue-600 truncate">{row.lcNo}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 shrink-0">
                                                                        <span className="text-xs font-black text-rose-600 font-mono">
                                                                            {parseFloat(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk
                                                                        </span>
                                                                        <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-gray-50 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 space-y-3 animate-in slide-in-from-top-4 duration-300">
                                                                        <div className="grid grid-cols-2 gap-3 bg-gray-50/50 rounded-lg p-2.5 text-xs">
                                                                            <div>
                                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Product</p>
                                                                                <p className="font-semibold text-gray-700">{row.product || '-'}</p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Port</p>
                                                                                <p className="font-semibold text-gray-700">{row.port || '-'}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex justify-between items-center text-xs">
                                                                            <span className="text-gray-500 font-medium">Importer :</span>
                                                                            <span className="font-semibold text-gray-700 truncate max-w-[200px]">{row.importer || '-'}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                                                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Amount :</span>
                                                                            <span className="text-sm font-black text-rose-600 font-mono">
                                                                                {parseFloat(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tk
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="text-center py-12 text-gray-400">
                                                        <DollarSignIcon className="w-8 h-8 mb-2 mx-auto opacity-20" />
                                                        <p className="text-sm">No expense records found</p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : historyViewMode === 'payments' ? (
                                        <>
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="cnf-table">
                                                    <thead>
                                                        <tr className="cnf-table-header-row">
                                                            <th className="cnf-table-header">Date</th>
                                                            <th className="cnf-table-header">Method</th>
                                                            <th className="cnf-table-header">Reference / Bank</th>
                                                            <th className="cnf-table-header text-right">Amount</th>
                                                            <th className="cnf-table-header text-right">Discount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="cnf-table-body">
                                                        {filteredPayments.length > 0 ? (
                                                            filteredPayments.map((p, idx) => (
                                                                <tr key={idx} className="cnf-table-row">
                                                                    <td className="cnf-table-cell">{formatDate(p.date)}</td>
                                                                    <td className="cnf-table-cell font-bold">{p.method}</td>
                                                                    <td className="cnf-table-cell truncate max-w-[400px]" title={p.bankName || p.reference || '-'}>{p.bankName || p.reference || '-'}</td>
                                                                    <td className="cnf-table-cell text-right font-black">{(p.amount || 0).toLocaleString('en-IN')} Tk</td>
                                                                    <td className="cnf-table-cell text-right font-bold text-emerald-600">
                                                                        {p.discount > 0 ? `${(p.discount || 0).toLocaleString('en-IN')} Tk` : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr><td colSpan="5" className="text-center py-12 text-gray-400"><DollarSignIcon className="w-8 h-8 mb-2 mx-auto opacity-20" /><p className="text-sm">No payment records found</p></td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="block md:hidden space-y-3">
                                                {filteredPayments.length > 0 ? (
                                                    filteredPayments.map((p, idx) => (
                                                        <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(p.date)}</p>
                                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase tracking-widest">{p.method}</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Reference / Bank</p>
                                                                <p className="text-xs font-medium text-gray-700 truncate">{p.bankName || p.reference || '-'}</p>
                                                            </div>
                                                            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</p>
                                                                    <p className="text-sm font-black text-gray-900">{(p.amount || 0).toLocaleString('en-IN')} Tk</p>
                                                                </div>
                                                                {p.discount > 0 && (
                                                                    <div className="text-right">
                                                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Discount</p>
                                                                        <p className="text-sm font-black text-emerald-600">{(p.discount || 0).toLocaleString('en-IN')} Tk</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-12 text-gray-400"><DollarSignIcon className="w-8 h-8 mb-2 mx-auto opacity-20" /><p className="text-sm">No payment history found</p></div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="hidden md:block overflow-x-auto">
                                                <table className="cnf-table">
                                                    <thead>
                                                        <tr className="cnf-table-header-row bg-gray-50">
                                                            <th className="cnf-table-header py-3 px-4 text-left font-bold uppercase tracking-widest text-[9px]">Date</th>
                                                            <th className="cnf-table-header py-3 px-4 text-left font-bold uppercase tracking-widest text-[9px]">LC No</th>
                                                            <th className="cnf-table-header py-3 px-4 text-left font-bold uppercase tracking-widest text-[9px]">Importer</th>
                                                            <th className="cnf-table-header py-3 px-4 text-left font-bold uppercase tracking-widest text-[9px]">Product</th>
                                                            <th className="cnf-table-header py-3 px-4 text-right font-bold uppercase tracking-widest text-[9px]">Billing Amount</th>
                                                            <th className="cnf-table-header py-3 px-4 text-left font-bold uppercase tracking-widest text-[9px]">Payment Method</th>
                                                            <th className="cnf-table-header py-3 px-4 text-left font-bold uppercase tracking-widest text-[9px]">Reference / Bank</th>
                                                            <th className="cnf-table-header py-3 px-4 text-right font-bold uppercase tracking-widest text-[9px]">Amount</th>
                                                            <th className="cnf-table-header py-3 px-4 text-right font-bold uppercase tracking-widest text-[9px]">Discount</th>
                                                            <th className="cnf-table-header py-3 px-4 text-right font-bold uppercase tracking-widest text-[9px]">Balance</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="cnf-table-body">
                                                        {filteredAll.map((row, idx) => (
                                                            <tr key={idx} className="cnf-table-row hover:bg-gray-50/50 transition-colors">
                                                                <td className="cnf-table-cell py-3 px-4 whitespace-nowrap text-[11px] font-medium text-gray-500">{formatDate(row.date)}</td>
                                                                <td className="cnf-table-cell py-3 px-4 text-[11px] font-bold text-blue-600">{row.lcNo}</td>
                                                                <td className="cnf-table-cell py-3 px-4 text-[11px] font-medium text-gray-700 truncate max-w-[120px]">{row.importer}</td>
                                                                <td className="cnf-table-cell py-3 px-4 text-[11px] font-medium text-gray-700 truncate max-w-[120px]">{row.product}</td>
                                                                <td className="cnf-table-cell py-3 px-4 text-right text-[11px] font-bold text-gray-900">
                                                                    {row.billingAmount > 0 ? row.billingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                                                                </td>
                                                                <td className="cnf-table-cell py-3 px-4 text-[11px] font-medium text-gray-600 uppercase tracking-wider">{row.method}</td>
                                                                <td className="cnf-table-cell py-3 px-4 text-[11px] font-medium text-gray-600 truncate max-w-[150px]">{row.bankName || row.reference || '-'}</td>
                                                                <td className="cnf-table-cell py-3 px-4 text-right text-[11px] font-black text-rose-600">
                                                                    {row.amount > 0 ? row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                                                                </td>
                                                                <td className="cnf-table-cell py-3 px-4 text-right text-[11px] font-bold text-emerald-600">
                                                                    {row.discount > 0 ? row.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                                                                </td>
                                                                <td className="cnf-table-cell py-3 px-4 text-right text-[11px] font-black text-gray-900 bg-gray-50/30">
                                                                    {row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {filteredAll.length === 0 && (
                                                            <tr>
                                                                <td colSpan="10" className="py-20 text-center text-gray-400">
                                                                    <div className="flex flex-col items-center justify-center gap-3">
                                                                        <BoxIcon className="w-12 h-12 opacity-20" />
                                                                        <p className="text-sm font-medium uppercase tracking-widest opacity-50">No ledger entries found</p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="block md:hidden space-y-3">
                                                {filteredAll.length > 0 ? (
                                                    filteredAll.map((row, idx) => (
                                                        <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{formatDate(row.date)}</p>
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                                                    row.type === 'earning'
                                                                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                                        : row.type === 'expense'
                                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                                }`}>
                                                                    {row.type === 'earning' ? 'Earning' : row.type === 'expense' ? 'Expense' : 'Payment'}
                                                                </span>
                                                            </div>
                                                            {row.type !== 'payment' ? (
                                                                <>
                                                                    <div className="flex justify-between items-baseline">
                                                                        <span className="text-xs font-bold text-blue-600">{row.lcNo}</span>
                                                                        <span className="text-xs font-semibold text-gray-700">{row.product || '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="text-gray-500 font-medium">Importer:</span>
                                                                        <span className="font-semibold text-gray-700 truncate max-w-[180px]">{row.importer || '-'}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Billing Amount</span>
                                                                        <span className="text-sm font-black text-gray-900">+{row.billingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Tk</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="text-gray-500 font-medium">Method:</span>
                                                                        <span className="font-bold text-gray-700">{row.method || '-'}</span>
                                                                    </div>
                                                                    {(row.bankName || row.reference) && (
                                                                        <div className="flex justify-between items-center text-xs">
                                                                            <span className="text-gray-500 font-medium">Ref / Bank:</span>
                                                                            <span className="font-medium text-gray-600 truncate max-w-[180px]">{row.bankName || row.reference}</span>
                                                                        </div>
                                                                    )}
                                                                    {row.discount > 0 && (
                                                                        <div className="flex justify-between items-center text-xs text-emerald-600">
                                                                            <span>Discount:</span>
                                                                            <span className="font-semibold">{(row.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Tk</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Payment Amount</span>
                                                                        <span className="text-sm font-black text-rose-600">-{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Tk</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100/50 mt-1">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Running Balance</span>
                                                                <span className="text-xs font-black text-gray-900">{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Tk</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-12 text-gray-400">
                                                        <BoxIcon className="w-8 h-8 mb-2 mx-auto opacity-20" />
                                                        <p className="text-sm">No ledger entries found</p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {editRecord && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setEditRecord(null)}></div>
                    <div className="cnf-form-container w-full max-w-xl">

                        <div className="cnf-form-header">
                            <h3 className="cnf-form-title">Edit History Record</h3>
                            <button onClick={() => setEditRecord(null)} className="cnf-form-close"><XIcon className="w-6 h-6" /></button>
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">Calculation UOM</label>
                                    <select name="uom" value={editHistoryData.uom || 'QTY'} onChange={handleEditHistoryChange} className="cnf-form-select cursor-pointer">
                                        <option value="QTY">Based on QTY</option>
                                        <option value="BAG">Based on BAG</option>
                                        <option value="TRUCK">Based on TRUCK</option>
                                        <option value="BOE">ON BOE</option>
                                    </select>
                                </div>
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">{editHistoryData.uom === 'BOE' ? 'Amount' : 'Commission Rate'}</label>
                                    <input type="number" step="0.01" name="commission" value={editHistoryData.commission} onChange={handleEditHistoryChange} className="cnf-form-input" />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setEditRecord(null)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl font-bold text-gray-700">Cancel</button>
                                <button onClick={handleSaveHistory} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all flex-[2] justify-center text-lg h-[50px]">Update Record</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isBulkEditModalOpen && (
                <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsBulkEditModalOpen(false)}></div>
                    <div className="cnf-form-container w-full max-w-xl">

                        <div className="cnf-form-header">
                            <h3 className="cnf-form-title">Bulk Edit History</h3>
                            <button onClick={() => setIsBulkEditModalOpen(false)} className="cnf-form-close"><XIcon className="w-6 h-6" /></button>
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">Calculation UOM</label>
                                    <select value={bulkEditData.uom} onChange={(e) => setBulkEditData(p => ({ ...p, uom: e.target.value }))} className="cnf-form-select cursor-pointer">
                                        <option value="QTY">Based on QTY</option>
                                        <option value="BAG">Based on BAG</option>
                                        <option value="TRUCK">Based on TRUCK</option>
                                        <option value="BOE">ON BOE</option>
                                    </select>
                                </div>
                                <div className="cnf-form-field">
                                    <label className="cnf-form-label">{bulkEditData.uom === 'BOE' ? 'Amount' : 'Commission Rate'}</label>
                                    <input type="number" step="0.01" value={bulkEditData.commission} onChange={(e) => setBulkEditData(p => ({ ...p, commission: e.target.value }))} className="cnf-form-input" />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setIsBulkEditModalOpen(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 transition-colors rounded-xl font-bold text-gray-700">Cancel</button>
                                <button onClick={handleBulkUpdateHistory} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all flex-[2] justify-center text-lg h-[50px]">Apply to {selectedHistoryIds.size} Records</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CnFReport
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                agents={cnfs}
                moduleType={moduleType}
            />
        </div>
    );
};

export default CnF;
