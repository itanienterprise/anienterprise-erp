import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, UserIcon, XIcon, ChevronDownIcon, ChevronUpIcon, FunnelIcon, BarChartIcon } from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import axios from '../../../utils/api';
import { generateLcBillHistoryReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';


const EyeIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const Bank = ({ onDeleteConfirm }) => {
    const [banks, setBanks] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [expandedRowKey, setExpandedRowKey] = useState(null);
    const [expandedBranchKey, setExpandedBranchKey] = useState(null);
    // LC Bill History modal state
    const [lcBillHistoryBank, setLcBillHistoryBank] = useState(null); // bank name being viewed
    const [lcBillHistoryRows, setLcBillHistoryRows] = useState([]);
    const [historySortConfig, setHistorySortConfig] = useState({ key: 'date', direction: 'asc' });
    const [lcBillHistoryLoading, setLcBillHistoryLoading] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historyFilters, setHistoryFilters] = useState({
        startDate: '',
        endDate: '',
        billType: '',
        lcNo: '',
        importer: ''
    });
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilterSearchInputs, setHistoryFilterSearchInputs] = useState({
        billTypeSearch: '',
        lcNoSearch: '',
        importerSearch: ''
    });
    const [historyFilterDropdownOpen, setHistoryFilterDropdownOpen] = useState({
        billType: false,
        lcNo: false,
        importer: false
    });
    const initialHistoryFilterDropdownState = {
        billType: false,
        lcNo: false,
        importer: false
    };

    // Refs
    const historyFilterPanelRef = useRef(null);
    const historyFilterButtonRef = useRef(null);
    const billTypeFilterRef = useRef(null);
    const lcNoFilterRef = useRef(null);
    const importerFilterRef = useRef(null);
    const [formData, setFormData] = useState({
        bankName: '',
        binNo: '',
        branches: [{
            branch: '',
            accountName: '',
            accountNo: '',
            lcCommission: '',
            vatOnCommission: '',
            swiftCharge: '',
            vatOnSwiftCharge: '',
            lcApplicationForm: '',
            mpCharge: '',
            stampCharge: '',
            amendmentCommission: '',
            amendmentVatOnCommission: '',
            amendmentSwiftCharge: '',
            amendmentVatOnSwift: ''
        }],
        isIndian: false,
        status: 'Active'
    });

    useEffect(() => {
        fetchBanks();
    }, []);

    // Click outside handler for history filter panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (
                showHistoryFilterPanel &&
                historyFilterPanelRef.current &&
                !historyFilterPanelRef.current.contains(event.target) &&
                historyFilterButtonRef.current &&
                !historyFilterButtonRef.current.contains(event.target)
            ) {
                setShowHistoryFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHistoryFilterPanel]);

    // Click outside handler for history filter dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            const openKey = Object.keys(historyFilterDropdownOpen).find(key => historyFilterDropdownOpen[key]);
            if (!openKey) return;

            let refsToCheck = [];
            if (openKey === 'billType') refsToCheck = [billTypeFilterRef];
            else if (openKey === 'lcNo') refsToCheck = [lcNoFilterRef];
            else if (openKey === 'importer') refsToCheck = [importerFilterRef];

            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [historyFilterDropdownOpen]);

    const fetchBanks = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/banks`);
            setBanks(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching banks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const openLcBillHistory = async (bankName) => {
        setLcBillHistoryBank(bankName);
        setLcBillHistoryLoading(true);
        setLcBillHistoryRows([]);
        setHistorySearchQuery('');
        setHistoryFilters({
            startDate: '',
            endDate: '',
            billType: '',
            lcNo: '',
            importer: ''
        });
        setHistorySortConfig({ key: 'date', direction: 'asc' });
        setShowHistoryFilterPanel(false);
        setHistoryFilterSearchInputs({
            billTypeSearch: '',
            lcNoSearch: '',
            importerSearch: ''
        });
        setHistoryFilterDropdownOpen({
            billType: false,
            lcNo: false,
            importer: false
        });
        try {
            const [lcRes, expRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`)
            ]);
            const lcRecords = Array.isArray(lcRes.data) ? lcRes.data : [];
            const expenses = Array.isArray(expRes.data) ? expRes.data : [];

            const cleanBankName = (bankName || '').trim().toUpperCase();

            // Filter LC records that belong to this bank
            const matchingLcs = lcRecords.filter(lc => {
                const lcBank = (lc.bankName || '').trim().toUpperCase();
                return lcBank === cleanBankName;
            });

            const rows = [];

            matchingLcs.forEach(lc => {
                const amendments = Array.isArray(lc.amendments) ? lc.amendments : [];

                // Helper: total paid bank charges from expenses (type !== bill)
                const bankChargePaid = expenses
                    .filter(e => e.lcNo === lc.lcNo && e.expenseHead === 'Bank Charges' && e.type !== 'bill')
                    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

                // Helper: total paid margin bill from expenses (type !== bill)
                const marginExpPaid = expenses
                    .filter(e => e.lcNo === lc.lcNo && e.expenseHead === 'Margin Bill' && e.type !== 'bill')
                    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

                // Get all registered custom bills for this LC from expenses
                const customBills = expenses.filter(e => e.lcNo === lc.lcNo && e.type === 'bill');
                // Sort custom bills by date ascending
                customBills.sort((a, b) => new Date(a.date) - new Date(b.date));

                // Pre-calculate how much of marginExpPaid is consumed by custom Margin Bill bills
                let remainingMarginPaid = marginExpPaid;
                customBills
                    .filter(b => b.expenseHead === 'Margin Bill')
                    .forEach(bill => {
                        const billAmt = parseFloat(bill.amount) || 0;
                        const paid = Math.min(remainingMarginPaid, billAmt);
                        remainingMarginPaid -= paid;
                    });
                const openingMarginExpPaid = remainingMarginPaid;

                // --- Original LC row ---
                const origMarginBill = parseFloat(lc.marginBill) || parseFloat(lc.totalAmount) || 0;
                const origMarginPaid = parseFloat(lc.marginPaid) || (origMarginBill * ((parseFloat(lc.bankMargin) || 0) / 100));
                const origBankBill = parseFloat(lc.bankBill) || 0;

                // Distribute bank charge payments across bills FIFO
                let remBankPaid = bankChargePaid;
                const origBankPaid = Math.min(remBankPaid, origBankBill);
                remBankPaid -= origBankPaid;

                rows.push({
                    date: lc.openingDate || lc.createdAt,
                    lcNo: lc.lcNo,
                    importer: lc.importer || '-',
                    billType: 'Opening LC',
                    marginBill: origMarginBill,
                    marginPaid: origMarginPaid + openingMarginExpPaid,
                    bankBill: origBankBill,
                    bankPaid: origBankPaid
                });

                // --- Amendment rows ---
                amendments.forEach((amnd, idx) => {
                    if (amnd.amendmentNo === 'Original LC') return;
                    const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                    const amndMargin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (parseFloat(lc.bankMargin) || 0);
                    const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (amndMarginBill * (amndMargin / 100));
                    const amndBankBill = parseFloat(amnd.amendmentBankBill) || parseFloat(amnd.totalAmendmentBankBill) || parseFloat(amnd.amendmentBill) || 0;
                    const amndBankPaid = Math.min(remBankPaid, amndBankBill);
                    remBankPaid -= amndBankPaid;

                    rows.push({
                        date: amnd.amendmentDate || lc.openingDate || lc.createdAt,
                        lcNo: lc.lcNo,
                        importer: lc.importer || '-',
                        billType: amnd.amendmentNo || `Amendment #${idx + 1}`,
                        marginBill: amndMarginBill,
                        marginPaid: amndMarginPaid,
                        bankBill: amndBankBill,
                        bankPaid: amndBankPaid
                    });
                });

                // --- Custom bills from LC Management ---
                // Collect payments of other heads (except Margin Bill and Bank Charges which are handled residuals/FIFO)
                const paymentsByHead = {};
                expenses
                    .filter(e => e.lcNo === lc.lcNo && e.type !== 'bill' && e.expenseHead !== 'Bank Charges' && e.expenseHead !== 'Margin Bill')
                    .forEach(e => {
                        const head = e.expenseHead || 'Other';
                        paymentsByHead[head] = (paymentsByHead[head] || 0) + (parseFloat(e.amount) || 0);
                    });

                const remainingPaymentsByHead = {
                    ...paymentsByHead,
                    'Bank Charges': remBankPaid,
                    'Margin Bill': marginExpPaid
                };

                customBills.forEach(bill => {
                    const head = bill.expenseHead || 'Other';
                    const billAmt = parseFloat(bill.amount) || 0;
                    const remainingPaid = remainingPaymentsByHead[head] || 0;
                    const paid = Math.min(remainingPaid, billAmt);

                    if (remainingPaymentsByHead[head] !== undefined) {
                        remainingPaymentsByHead[head] -= paid;
                    }

                    const isMargin = head === 'Margin Bill';

                    rows.push({
                        date: bill.date,
                        lcNo: lc.lcNo,
                        importer: lc.importer || '-',
                        billType: bill.expenseHead || 'Other Bill',
                        marginBill: isMargin ? billAmt : 0,
                        marginPaid: isMargin ? paid : 0,
                        bankBill: isMargin ? 0 : billAmt,
                        bankPaid: isMargin ? 0 : paid
                    });
                });
            });

            // Sort by date ascending
            rows.sort((a, b) => new Date(a.date) - new Date(b.date));
            setLcBillHistoryRows(rows);
        } catch (err) {
            console.error('Error loading LC bill history:', err);
        } finally {
            setLcBillHistoryLoading(false);
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (historySortConfig.key === key && historySortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setHistorySortConfig({ key, direction });
    };

    const filteredLcBillHistoryRows = useMemo(() => {
        const filtered = lcBillHistoryRows.filter(row => {
            // Search Query Filter
            if (historySearchQuery) {
                const query = historySearchQuery.toLowerCase().trim();
                const matchesSearch =
                    (row.lcNo || '').toLowerCase().includes(query) ||
                    (row.importer || '').toLowerCase().includes(query) ||
                    (row.billType || '').toLowerCase().includes(query);
                if (!matchesSearch) return false;
            }

            // Date Filters
            if (row.date) {
                try {
                    const rowDateStr = typeof row.date === 'string'
                        ? (row.date.includes('T') ? row.date.split('T')[0] : row.date)
                        : new Date(row.date).toISOString().split('T')[0];
                    if (historyFilters.startDate && rowDateStr < historyFilters.startDate) {
                        return false;
                    }
                    if (historyFilters.endDate && rowDateStr > historyFilters.endDate) {
                        return false;
                    }
                } catch (e) {
                    console.error("Error parsing date:", e);
                }
            } else if (historyFilters.startDate || historyFilters.endDate) {
                return false;
            }

            // Bill Type Filter
            if (historyFilters.billType) {
                const isOpening = row.billType === 'Opening LC';
                const filterOpening = historyFilters.billType === 'Opening LC';
                if (isOpening !== filterOpening) {
                    return false;
                }
            }

            // LC No Filter
            if (historyFilters.lcNo && row.lcNo !== historyFilters.lcNo) {
                return false;
            }

            // Importer Filter
            if (historyFilters.importer && row.importer !== historyFilters.importer) {
                return false;
            }

            return true;
        });

        if (historySortConfig.key) {
            filtered.sort((a, b) => {
                let aVal = a[historySortConfig.key];
                let bVal = b[historySortConfig.key];

                if (historySortConfig.key === 'date') {
                    const aDate = new Date(aVal);
                    const bDate = new Date(bVal);
                    return historySortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
                }

                if (historySortConfig.key === 'marginPaid' || historySortConfig.key === 'bankPaid') {
                    const aNum = parseFloat(aVal) || 0;
                    const bNum = parseFloat(bVal) || 0;
                    return historySortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
                }

                // Default string comparison
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
                if (aVal < bVal) return historySortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return historySortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [lcBillHistoryRows, historySearchQuery, historyFilters, historySortConfig]);

    const uniqueLcNos = useMemo(() => {
        const set = new Set(lcBillHistoryRows.map(r => r.lcNo).filter(Boolean));
        return Array.from(set).sort();
    }, [lcBillHistoryRows]);

    const uniqueImporters = useMemo(() => {
        const set = new Set(lcBillHistoryRows.map(r => r.importer).filter(Boolean));
        return Array.from(set).sort();
    }, [lcBillHistoryRows]);

    const getFilteredHistoryOptions = (type) => {
        let options = [];
        if (type === 'billType') {
            options = ['Opening LC', 'Amendment'];
        } else if (type === 'lcNo') {
            options = uniqueLcNos;
        } else if (type === 'importer') {
            options = uniqueImporters;
        }

        const searchMap = {
            billType: historyFilterSearchInputs.billTypeSearch,
            lcNo: historyFilterSearchInputs.lcNoSearch,
            importer: historyFilterSearchInputs.importerSearch
        };

        if (searchMap[type]) {
            return options.filter(opt => opt.toLowerCase().includes(searchMap[type].toLowerCase()));
        }
        return options;
    };



    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBranchChange = (index, e) => {
        const { name, value } = e.target;
        const updatedBranches = [...formData.branches];
        updatedBranches[index] = { ...updatedBranches[index], [name]: value };
        setFormData(prev => ({ ...prev, branches: updatedBranches }));
    };

    const addBranchRow = () => {
        setFormData(prev => ({
            ...prev,
            branches: [...prev.branches, {
                branch: '',
                accountName: '',
                accountNo: '',
                lcCommission: '',
                vatOnCommission: '',
                swiftCharge: '',
                vatOnSwiftCharge: '',
                lcApplicationForm: '',
                mpCharge: '',
                stampCharge: '',
                amendmentCommission: '',
                amendmentVatOnCommission: '',
                amendmentSwiftCharge: '',
                amendmentVatOnSwift: ''
            }]
        }));
    };

    const removeBranchRow = (index) => {
        if (formData.branches.length > 1) {
            const updatedBranches = formData.branches.filter((_, i) => i !== index);
            setFormData(prev => ({ ...prev, branches: updatedBranches }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/banks/${editingId}`
                : `${API_BASE_URL}/api/banks`;

            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }

            setSubmitStatus('success');
            fetchBanks();
            setTimeout(() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
                setSubmitStatus(null);
            }, 2000);
        } catch (error) {
            console.error('Error saving bank:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            bankName: '',
            binNo: '',
            branches: [{
                branch: '',
                accountName: '',
                accountNo: '',
                lcCommission: '',
                vatOnCommission: '',
                swiftCharge: '',
                vatOnSwiftCharge: '',
                lcApplicationForm: '',
                mpCharge: '',
                stampCharge: '',
                amendmentCommission: '',
                amendmentVatOnCommission: '',
                amendmentSwiftCharge: '',
                amendmentVatOnSwift: ''
            }],
            isIndian: false,
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (bank) => {
        // Handle backwards compatibility for banks saved with old structure
        const rawBranches = bank.branches || [
            {
                branch: bank.branch || '',
                accountName: bank.accountName || '',
                accountNo: bank.accountNo || ''
            }
        ];

        const branches = rawBranches.map(b => ({
            branch: b.branch || '',
            accountName: b.accountName || '',
            accountNo: b.accountNo || '',
            lcCommission: b.lcCommission !== undefined ? b.lcCommission : '',
            vatOnCommission: b.vatOnCommission !== undefined ? b.vatOnCommission : '',
            swiftCharge: b.swiftCharge !== undefined ? b.swiftCharge : '',
            vatOnSwiftCharge: b.vatOnSwiftCharge !== undefined ? b.vatOnSwiftCharge : '',
            lcApplicationForm: b.lcApplicationForm !== undefined ? b.lcApplicationForm : '',
            mpCharge: b.mpCharge !== undefined ? b.mpCharge : '',
            stampCharge: b.stampCharge !== undefined ? b.stampCharge : '',
            amendmentCommission: b.amendmentCommission !== undefined ? b.amendmentCommission : '',
            amendmentVatOnCommission: b.amendmentVatOnCommission !== undefined ? b.amendmentVatOnCommission : '',
            amendmentSwiftCharge: b.amendmentSwiftCharge !== undefined ? b.amendmentSwiftCharge : '',
            amendmentVatOnSwift: b.amendmentVatOnSwift !== undefined ? b.amendmentVatOnSwift : ''
        }));

        setFormData({
            bankName: bank.bankName || '',
            binNo: bank.binNo || '',
            branches: branches,
            isIndian: bank.isIndian || false,
            status: bank.status || 'Active'
        });
        setEditingId(bank._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'bank', id, isBulk: false });
    };

    const toggleRowExpansion = (uniqueKey) => {
        setExpandedRowKey(prev => prev === uniqueKey ? null : uniqueKey);
    };

    const displayBanks = useMemo(() => {
        const flattened = banks.flatMap(bank => {
            // Handle backwards compatibility for single-branch records
            const branches = bank.branches || [{
                branch: bank.branch,
                accountName: bank.accountName,
                accountNo: bank.accountNo
            }];

            return branches.map((branch, idx) => ({
                ...bank,
                ...branch,
                uniqueRowKey: `${bank._id}-${idx}`
            }));
        })
            .filter(item =>
                (item.bankName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.binNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.accountNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.accountName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.branch || '').toLowerCase().includes(searchQuery.toLowerCase())
            );

        // Group by bank name
        const groups = flattened.reduce((acc, current) => {
            const name = (current.bankName || '').trim().toUpperCase();
            if (!acc[name]) {
                acc[name] = {
                    bankName: current.bankName,
                    items: []
                };
            }
            acc[name].items.push(current);
            return acc;
        }, {});

        return Object.values(groups).sort((a, b) => (a.bankName || '').localeCompare(b.bankName || ''));
    }, [banks, searchQuery]);

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Bank Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by bank name or account..."
                                autoComplete="off"
                                className="h-10 block w-full pl-10 pr-4 bg-white/50 border border-gray-200 rounded-xl text-sm text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showForm && (
                    <div className="w-full md:w-1/4 flex justify-end gap-3 z-50">
                        <button
                            onClick={() => setShowForm(true)}
                            className="h-10 border border-transparent w-full md:w-auto px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center text-sm"
                        >
                            <span className="mr-2 text-xl font-bold">+</span>
                            <span>Add New Bank</span>
                        </button>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">{editingId ? 'Edit Bank Account' : 'New Bank Registration'}</h3>
                        </div>
                        <button
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="p-1.5 md:p-2 hover:bg-gray-100/80 text-gray-400 hover:text-rose-500 rounded-xl transition-all"
                        >
                            <XIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        autoComplete="off"
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10"
                    >
                        <div className="col-span-1 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Bank Name</label>
                            <input
                                type="text"
                                name="bankName"
                                value={formData.bankName}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter Bank Name"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm shadow-sm"
                            />
                        </div>

                        <div className="col-span-1 space-y-2">
                            <label className="text-sm font-medium text-gray-700">BIN No</label>
                            <input
                                type="text"
                                name="binNo"
                                value={formData.binNo}
                                onChange={handleInputChange}
                                placeholder="Enter BIN Number"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm shadow-sm"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 flex items-center space-x-3 bg-white/50 p-4 rounded-xl border border-gray-100">
                            <input
                                type="checkbox"
                                id="isIndian"
                                name="isIndian"
                                checked={formData.isIndian}
                                onChange={(e) => setFormData(prev => ({ ...prev, isIndian: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isIndian" className="text-sm font-medium text-gray-700 flex items-center cursor-pointer">
                                <span className="mr-2">🇮🇳</span> Is Indian Bank?
                                <span className="ml-2 text-[10px] text-gray-400 font-normal">(Will be hidden in local collection modules)</span>
                            </label>
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider">Branch Details</label>
                                <button
                                    type="button"
                                    onClick={addBranchRow}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all border border-blue-100"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    Add Branch
                                </button>
                            </div>

                            <div className="space-y-3">
                                {formData.branches.map((branch, index) => (
                                    <div key={index} className="flex flex-col gap-4 p-5 bg-gray-50/50 rounded-2xl border border-gray-100 relative group/row">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Branch</label>
                                                <input
                                                    type="text"
                                                    name="branch"
                                                    value={branch.branch}
                                                    onChange={(e) => handleBranchChange(index, e)}
                                                    required
                                                    placeholder="Branch Name"
                                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Account Name</label>
                                                <input
                                                    type="text"
                                                    name="accountName"
                                                    value={branch.accountName}
                                                    onChange={(e) => handleBranchChange(index, e)}
                                                    required
                                                    placeholder="Account Name"
                                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-1">Account No</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        name="accountNo"
                                                        value={branch.accountNo}
                                                        onChange={(e) => handleBranchChange(index, e)}
                                                        required
                                                        placeholder="Account Number"
                                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                                                    />
                                                    {formData.branches.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeBranchRow(index)}
                                                            className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100 shrink-0"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-200/50 my-1"></div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* New LC Bill Details */}
                                            <div className="bg-white/60 p-4 rounded-xl border border-gray-200/60 space-y-4">
                                                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-blue-50 pb-2 flex items-center">
                                                    <span>New LC Bill</span>
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">LC Commission</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="lcCommission"
                                                                value={branch.lcCommission}
                                                                onChange={(e) => handleBranchChange(index, e)}
                                                                placeholder="0.00"
                                                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                            />
                                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">VAT on Commission</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="vatOnCommission"
                                                                value={branch.vatOnCommission}
                                                                onChange={(e) => handleBranchChange(index, e)}
                                                                placeholder="0.00"
                                                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                            />
                                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">SWIFT Charge</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            name="swiftCharge"
                                                            value={branch.swiftCharge}
                                                            onChange={(e) => handleBranchChange(index, e)}
                                                            placeholder="0.00"
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">VAT on SWIFT Charge</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="vatOnSwiftCharge"
                                                                value={branch.vatOnSwiftCharge}
                                                                onChange={(e) => handleBranchChange(index, e)}
                                                                placeholder="0.00"
                                                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                            />
                                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">LC Application Form</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            name="lcApplicationForm"
                                                            value={branch.lcApplicationForm}
                                                            onChange={(e) => handleBranchChange(index, e)}
                                                            placeholder="0.00"
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">MP Charge</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            name="mpCharge"
                                                            value={branch.mpCharge}
                                                            onChange={(e) => handleBranchChange(index, e)}
                                                            placeholder="0.00"
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Stamp Charge</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            name="stampCharge"
                                                            value={branch.stampCharge}
                                                            onChange={(e) => handleBranchChange(index, e)}
                                                            placeholder="0.00"
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Amendment Bill Details */}
                                            <div className="bg-white/60 p-4 rounded-xl border border-gray-200/60 space-y-4">
                                                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-2 flex items-center">
                                                    <span>Amendment Bill</span>
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Commission on Amendment</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentCommission"
                                                                value={branch.amendmentCommission}
                                                                onChange={(e) => handleBranchChange(index, e)}
                                                                placeholder="0.00"
                                                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                            />
                                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">VAT on Commission</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentVatOnCommission"
                                                                value={branch.amendmentVatOnCommission}
                                                                onChange={(e) => handleBranchChange(index, e)}
                                                                placeholder="0.00"
                                                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                            />
                                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">SWIFT Charge</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            name="amendmentSwiftCharge"
                                                            value={branch.amendmentSwiftCharge}
                                                            onChange={(e) => handleBranchChange(index, e)}
                                                            placeholder="0.00"
                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">VAT on SWIFT</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentVatOnSwift"
                                                                value={branch.amendmentVatOnSwift}
                                                                onChange={(e) => handleBranchChange(index, e)}
                                                                placeholder="0.00"
                                                                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs shadow-sm"
                                                            />
                                                            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-bold text-gray-400 pointer-events-none">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
                            <div className="flex-1">
                                {submitStatus === 'success' && (
                                    <div className="flex items-center text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">
                                        <div className="p-1 bg-emerald-100 rounded-full mr-2">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        Bank saved successfully!
                                    </div>
                                )}
                                {submitStatus === 'error' && (
                                    <div className="flex items-center text-red-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">
                                        <div className="p-1 bg-red-100 rounded-full mr-2">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </div>
                                        Failed to save bank records.
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-3">

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`flex-1 md:flex-none px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Bank' : 'Save Bank'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="space-y-4">
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Bank</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">BIN No</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Branch</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Account Name</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Account No</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan="5" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : displayBanks.length > 0 ? (
                                        displayBanks.map((group) => (
                                            <React.Fragment key={group.bankName}>
                                                {group.items.map((item, idx) => {
                                                    const isBranchExpanded = expandedBranchKey === item.uniqueRowKey;
                                                    return (
                                                        <React.Fragment key={item.uniqueRowKey}>
                                                            <tr className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100 last:border-b-0">
                                                                <td className="px-6 py-4 text-[13px] font-bold text-gray-700">
                                                                    {idx === 0 ? group.bankName : ''}
                                                                </td>
                                                                <td className="px-6 py-4 text-[13px] font-medium text-gray-600">
                                                                    {idx === 0 ? (item.binNo || '-') : ''}
                                                                </td>
                                                                <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.branch}</td>
                                                                <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.accountName}</td>
                                                                <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{item.accountNo}</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <div className="flex justify-center items-center gap-2">
                                                                        <button
                                                                            onClick={() => openLcBillHistory(group.bankName)}
                                                                            className="p-1.5 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded-lg transition-all"
                                                                            title="LC Bill History"
                                                                        >
                                                                            <EyeIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setExpandedBranchKey(prev => prev === item.uniqueRowKey ? null : item.uniqueRowKey)}
                                                                            className={`p-1.5 rounded-lg transition-all ${isBranchExpanded ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                                                                            title="View Charges"
                                                                        >
                                                                            {isBranchExpanded ? (
                                                                                <ChevronUpIcon className="w-4 h-4" />
                                                                            ) : (
                                                                                <ChevronDownIcon className="w-4 h-4" />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleEdit(item)}
                                                                            className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all"
                                                                            title="Edit"
                                                                        >
                                                                            <EditIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(item._id)}
                                                                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"
                                                                            title="Delete"
                                                                        >
                                                                            <TrashIcon className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {isBranchExpanded && (
                                                                <tr className="bg-gray-50/30">
                                                                    <td colSpan="6" className="px-6 py-4 border-b border-gray-100">
                                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-gray-100/85 shadow-inner animate-in fade-in duration-300">
                                                                            {/* New LC Bill Charges */}
                                                                            <div className="space-y-3">
                                                                                <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2">New LC Bill Charges</h4>
                                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Commission</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.lcCommission ? `${item.lcCommission}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT on Commission</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.vatOnCommission ? `${item.vatOnCommission}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SWIFT Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.swiftCharge !== undefined && item.swiftCharge !== '' ? `${item.swiftCharge}` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT on SWIFT Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.vatOnSwiftCharge ? `${item.vatOnSwiftCharge}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Application Form</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.lcApplicationForm !== undefined && item.lcApplicationForm !== '' ? `${item.lcApplicationForm}` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MP Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.mpCharge !== undefined && item.mpCharge !== '' ? `${item.mpCharge}` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stamp Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.stampCharge !== undefined && item.stampCharge !== '' ? `${item.stampCharge}` : '-'}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Amendment Bill Charges */}
                                                                            <div className="space-y-3">
                                                                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2">Amendment Bill Charges</h4>
                                                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Commission on Amendment</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.amendmentCommission ? `${item.amendmentCommission}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT on Commission</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.amendmentVatOnCommission ? `${item.amendmentVatOnCommission}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SWIFT Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.amendmentSwiftCharge !== undefined && item.amendmentSwiftCharge !== '' ? `${item.amendmentSwiftCharge}` : '-'}</p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT on SWIFT</span>
                                                                                        <p className="text-xs font-black text-gray-800">{item.amendmentVatOnSwift ? `${item.amendmentVatOnSwift}%` : '-'}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-sm md:text-base">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                                                        <UserIcon className="w-8 h-8 text-gray-300" />
                                                    </div>
                                                    <p className="text-gray-500 font-medium">No bank accounts found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-3"></div>
                                    <div className="h-3 bg-gray-50 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-50 rounded w-1/4"></div>
                                </div>
                            ))
                        ) : displayBanks.length > 0 ? (
                            displayBanks.map((group) => {
                                const isExpanded = expandedRowKey === group.bankName;
                                return (
                                    <div
                                        key={group.bankName}
                                        onClick={() => toggleRowExpansion(group.bankName)}
                                        className={`bg-white rounded-2xl border ${isExpanded ? 'border-blue-100 ring-4 ring-blue-500/5 shadow-lg' : 'border-gray-100 shadow-sm'} p-5 transition-all duration-500 cursor-pointer overflow-hidden`}
                                    >
                                        <div className="flex justify-between items-center group">
                                            <div className="space-y-1">
                                                <h3 className={`text-base md:text-lg font-black transition-colors duration-300 ${isExpanded ? 'text-blue-600' : 'text-gray-800'}`}>
                                                    {group.bankName}
                                                </h3>
                                                {group.items[0]?.binNo && (
                                                    <p className="text-xs font-semibold text-blue-600">BIN: {group.items[0].binNo}</p>
                                                )}
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isExpanded ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                                    {group.items.length} {group.items.length > 1 ? 'Accounts' : 'Account'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-gray-50/80 p-0.5 rounded-lg border border-gray-100 divide-x divide-gray-100">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openLcBillHistory(group.bankName); }}
                                                        className="p-2 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-all"
                                                        title="LC Bill History"
                                                    >
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(group.items[0]); }}
                                                        className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all"
                                                        title="Edit Bank"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(group.items[0]._id); }}
                                                        className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-all"
                                                        title="Delete Bank"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
                                                {group.items.map((item, idx) => (
                                                    <div key={item.uniqueRowKey} className="relative bg-gray-50/50 rounded-2xl p-4 border border-gray-100 shadow-sm">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex-1 space-y-2.5">
                                                                <div className="flex items-center text-[13px]">
                                                                    <span className="w-32 text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Branch -</span>
                                                                    <span className="font-black text-gray-900 uppercase truncate">{item.branch}</span>
                                                                </div>
                                                                <div className="flex items-start text-[13px]">
                                                                    <span className="w-32 text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Account Name -</span>
                                                                    <span className="font-bold text-gray-800 uppercase leading-tight">{item.accountName}</span>
                                                                </div>
                                                                <div className="flex items-center text-[13px]">
                                                                    <span className="w-32 text-[11px] font-bold text-blue-400 uppercase tracking-wider shrink-0">Account No -</span>
                                                                    <span className="font-black text-blue-600 select-all tracking-tight">{item.accountNo}</span>
                                                                </div>

                                                                <div className="border-t border-gray-200/50 my-2"></div>

                                                                <div className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-wider">New LC Bill Charges</h4>
                                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">LC Comm.</span>
                                                                                <span className="font-black text-gray-800">{item.lcCommission ? `${item.lcCommission}%` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">VAT on Comm.</span>
                                                                                <span className="font-black text-gray-800">{item.vatOnCommission ? `${item.vatOnCommission}%` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">SWIFT</span>
                                                                                <span className="font-black text-gray-800">{item.swiftCharge !== undefined && item.swiftCharge !== '' ? `${item.swiftCharge}` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">VAT on SWIFT</span>
                                                                                <span className="font-black text-gray-800">{item.vatOnSwiftCharge ? `${item.vatOnSwiftCharge}%` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">LC App Form</span>
                                                                                <span className="font-black text-gray-800">{item.lcApplicationForm !== undefined && item.lcApplicationForm !== '' ? `${item.lcApplicationForm}` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">MP Charge</span>
                                                                                <span className="font-black text-gray-800">{item.mpCharge !== undefined && item.mpCharge !== '' ? `${item.mpCharge}` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40 col-span-2">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">Stamp Charge</span>
                                                                                <span className="font-black text-gray-800">{item.stampCharge !== undefined && item.stampCharge !== '' ? `${item.stampCharge}` : '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Amendment Bill Charges</h4>
                                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">Amendment Comm.</span>
                                                                                <span className="font-black text-gray-800">{item.amendmentCommission ? `${item.amendmentCommission}%` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">VAT on Comm.</span>
                                                                                <span className="font-black text-gray-800">{item.amendmentVatOnCommission ? `${item.amendmentVatOnCommission}%` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">SWIFT</span>
                                                                                <span className="font-black text-gray-800">{item.amendmentSwiftCharge !== undefined && item.amendmentSwiftCharge !== '' ? `${item.amendmentSwiftCharge}` : '-'}</span>
                                                                            </div>
                                                                            <div className="bg-white/80 p-2 rounded-xl border border-gray-150/40">
                                                                                <span className="text-[9px] font-bold text-gray-400 uppercase block leading-tight">VAT on SWIFT</span>
                                                                                <span className="font-black text-gray-800">{item.amendmentVatOnSwift ? `${item.amendmentVatOnSwift}%` : '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                                <div className="flex flex-col items-center justify-center">
                                    <div className="p-3 bg-gray-50 rounded-full mb-3">
                                        <UserIcon className="w-6 h-6 text-gray-300" />
                                    </div>
                                    <p className="text-gray-500 font-medium text-sm">No bank accounts found</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* LC Bill History Modal */}
            {lcBillHistoryBank && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setLcBillHistoryBank(null)} />
                    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-6xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl gap-3 flex-shrink-0 z-10 relative">
                            <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
                                <div className="p-2 bg-blue-600 text-white rounded-xl hidden sm:block">
                                    <EyeIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 leading-none">LC Bill History</h3>
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mt-1.5">{lcBillHistoryBank}</p>
                                </div>
                            </div>

                            <div className="hidden lg:flex flex-1 max-w-xl mx-auto items-center justify-center">
                                <div className="w-full max-w-md relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by LC No, Importer or Bill Type..."
                                        autoComplete="off"
                                        className="block w-full pl-10 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    />
                                    {historySearchQuery && (
                                        <button
                                            onClick={() => setHistorySearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <XIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Filter Dropdown */}
                                <div className="relative">
                                    <button
                                        ref={historyFilterButtonRef}
                                        onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                        className={`flex items-center justify-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border transition-all shadow-sm ${
                                            showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                                ? 'bg-blue-50 border-blue-200 text-blue-600'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                        }`}
                                    >
                                        <FunnelIcon className="w-4 h-4" />
                                        <span className="hidden sm:block text-sm font-medium">Filter</span>
                                    </button>

                                    {showHistoryFilterPanel && (
                                        <div
                                            ref={historyFilterPanelRef}
                                            className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 md:p-6 z-[3100] animate-in fade-in zoom-in-95 duration-200 overflow-visible"
                                        >
                                            <div className="flex items-center justify-between mb-6">
                                                <h4 className="text-lg font-bold text-gray-800">Filter History</h4>
                                                <button
                                                    onClick={() => {
                                                        setHistoryFilters({ startDate: '', endDate: '', billType: '', lcNo: '', importer: '' });
                                                        setHistoryFilterSearchInputs({
                                                            billTypeSearch: '',
                                                            lcNoSearch: '',
                                                            importerSearch: ''
                                                        });
                                                    }}
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                                >
                                                    Reset All
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Date range */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <CustomDatePicker
                                                        label="START DATE"
                                                        value={historyFilters.startDate}
                                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                        compact={true}
                                                        labelClassName="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                                                    />
                                                    <CustomDatePicker
                                                        label="END DATE"
                                                        value={historyFilters.endDate}
                                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                        compact={true}
                                                        rightAlign={true}
                                                        labelClassName="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider"
                                                    />
                                                </div>

                                                {/* Bill Type */}
                                                <div className="space-y-1.5 relative" ref={billTypeFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Bill Type</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.billTypeSearch}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, billTypeSearch: e.target.value });
                                                                setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, billType: true });
                                                            }}
                                                            onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, billType: true })}
                                                            placeholder={historyFilters.billType || "Search Bill Type..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.billType ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {historyFilters.billType && (
                                                                <button
                                                                    onClick={() => {
                                                                        setHistoryFilters({ ...historyFilters, billType: '' });
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, billTypeSearch: '' });
                                                                    }}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {historyFilterDropdownOpen.billType && (
                                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {getFilteredHistoryOptions('billType').length > 0 ? (
                                                                getFilteredHistoryOptions('billType').map(opt => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters({ ...historyFilters, billType: opt });
                                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, billTypeSearch: '' });
                                                                            setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* LC Number */}
                                                <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC Number</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.lcNoSearch}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: e.target.value });
                                                                setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, lcNo: true });
                                                            }}
                                                            onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, lcNo: true })}
                                                            placeholder={historyFilters.lcNo || "Search LC Number..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {historyFilters.lcNo && (
                                                                <button
                                                                    onClick={() => {
                                                                        setHistoryFilters({ ...historyFilters, lcNo: '' });
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: '' });
                                                                    }}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {historyFilterDropdownOpen.lcNo && (
                                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {getFilteredHistoryOptions('lcNo').length > 0 ? (
                                                                getFilteredHistoryOptions('lcNo').map(opt => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters({ ...historyFilters, lcNo: opt });
                                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, lcNoSearch: '' });
                                                                            setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Importer */}
                                                <div className="space-y-1.5 relative" ref={importerFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Importer</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={historyFilterSearchInputs.importerSearch}
                                                            onChange={(e) => {
                                                                setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, importerSearch: e.target.value });
                                                                setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, importer: true });
                                                            }}
                                                            onFocus={() => setHistoryFilterDropdownOpen({ ...initialHistoryFilterDropdownState, importer: true })}
                                                            placeholder={historyFilters.importer || "Search Importer..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${historyFilters.importer ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {historyFilters.importer && (
                                                                <button
                                                                    onClick={() => {
                                                                        setHistoryFilters({ ...historyFilters, importer: '' });
                                                                        setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, importerSearch: '' });
                                                                    }}
                                                                    className="text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {historyFilterDropdownOpen.importer && (
                                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {getFilteredHistoryOptions('importer').length > 0 ? (
                                                                getFilteredHistoryOptions('importer').map(opt => (
                                                                    <button
                                                                        key={opt}
                                                                        onClick={() => {
                                                                            setHistoryFilters({ ...historyFilters, importer: opt });
                                                                            setHistoryFilterSearchInputs({ ...historyFilterSearchInputs, importerSearch: '' });
                                                                            setHistoryFilterDropdownOpen(initialHistoryFilterDropdownState);
                                                                        }}
                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                    >
                                                                        {opt}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                <div className="px-4 py-2 text-xs text-gray-400 text-center">No options found</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Report Button */}
                                <button
                                    onClick={() => generateLcBillHistoryReportPDF(filteredLcBillHistoryRows, lcBillHistoryBank, historyFilters)}
                                    className="flex items-center justify-center sm:gap-2 w-9 h-9 sm:w-auto sm:h-10 sm:px-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm"
                                >
                                    <BarChartIcon className="w-4 h-4 text-blue-500" />
                                    <span className="hidden sm:block text-sm font-medium ml-2">Report</span>
                                </button>

                                {/* Close Button */}
                                <button
                                    onClick={() => setLcBillHistoryBank(null)}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Mobile Search Row (hidden on lg+) */}
                        <div className="lg:hidden px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by LC No, Importer or Bill Type..."
                                    autoComplete="off"
                                    className="block w-full pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                />
                                {historySearchQuery && (
                                    <button
                                        onClick={() => setHistorySearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-y-auto flex-1 p-4 sm:p-6">
                            {lcBillHistoryLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                </div>
                            ) : filteredLcBillHistoryRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <div className="p-4 bg-gray-50 rounded-full mb-4">
                                        <EyeIcon className="w-10 h-10 text-gray-300" />
                                    </div>
                                    <p className="font-bold text-gray-500">No LC bill history found</p>
                                    <p className="text-sm mt-1">
                                        {lcBillHistoryRows.length === 0
                                            ? `No LC records are linked to ${lcBillHistoryBank}`
                                            : 'No results match your search and filter criteria'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                                    <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[640px]">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100 select-none">
                                                <th 
                                                    onClick={() => requestSort('date')}
                                                    className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Date
                                                        {historySortConfig.key === 'date' && (
                                                            historySortConfig.direction === 'asc' 
                                                                ? <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500" />
                                                                : <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => requestSort('lcNo')}
                                                    className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        LC No
                                                        {historySortConfig.key === 'lcNo' && (
                                                            historySortConfig.direction === 'asc' 
                                                                ? <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500" />
                                                                : <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => requestSort('importer')}
                                                    className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Importer
                                                        {historySortConfig.key === 'importer' && (
                                                            historySortConfig.direction === 'asc' 
                                                                ? <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500" />
                                                                : <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => requestSort('billType')}
                                                    className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        Bill Type
                                                        {historySortConfig.key === 'billType' && (
                                                            historySortConfig.direction === 'asc' 
                                                                ? <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500" />
                                                                : <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => requestSort('marginPaid')}
                                                    className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right whitespace-nowrap cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        Margin Paid
                                                        {historySortConfig.key === 'marginPaid' && (
                                                            historySortConfig.direction === 'asc' 
                                                                ? <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500" />
                                                                : <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500" />
                                                        )}
                                                    </div>
                                                </th>
                                                <th 
                                                    onClick={() => requestSort('bankPaid')}
                                                    className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right whitespace-nowrap cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        Bank Paid
                                                        {historySortConfig.key === 'bankPaid' && (
                                                            historySortConfig.direction === 'asc' 
                                                                ? <ChevronUpIcon className="w-3.5 h-3.5 text-blue-500" />
                                                                : <ChevronDownIcon className="w-3.5 h-3.5 text-blue-500" />
                                                        )}
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50 font-medium">
                                            {filteredLcBillHistoryRows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(row.date)}</td>
                                                    <td className="px-5 py-3.5 text-sm font-black text-blue-600 whitespace-nowrap">{row.lcNo}</td>
                                                    <td className="px-5 py-3.5 text-sm text-gray-800 uppercase max-w-[160px] truncate">{row.importer}</td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${row.billType === 'Opening LC'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                            : 'bg-amber-50 text-amber-700 border-amber-100'
                                                            }`}>
                                                            {row.billType}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm font-bold text-right text-emerald-600 whitespace-nowrap">
                                                        {row.marginPaid > 0 ? `৳${row.marginPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-sm font-bold text-right text-emerald-600 whitespace-nowrap">
                                                        {row.bankPaid > 0 ? `৳${row.bankPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-t border-gray-100">
                                            <tr>
                                                <td colSpan="4" className="px-5 py-4 text-xs font-black text-gray-500 uppercase tracking-wider text-right">Total:</td>
                                                <td className="px-5 py-4 text-sm font-black text-right text-emerald-600">
                                                    ৳{filteredLcBillHistoryRows.reduce((s, r) => s + r.marginPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-5 py-4 text-sm font-black text-right text-emerald-600">
                                                    ৳{filteredLcBillHistoryRows.reduce((s, r) => s + r.bankPaid, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Bank;
