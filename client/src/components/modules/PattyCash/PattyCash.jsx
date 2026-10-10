/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { queryClient } from '../../../utils/queryClient';
import { getSocket } from '../../../utils/socket';
import { hasPermission } from '../../../utils/permissionHelper';
import {
    SearchIcon, PlusIcon, EditIcon, TrashIcon, XIcon,
    ChevronDownIcon, DollarSignIcon, BuildingIcon,
    ArrowDownLeftIcon, ArrowUpRightIcon, FileTextIcon,
    CheckCircle2Icon, FunnelIcon, CheckIcon, WalletIcon, PrinterIcon,
    ClockIcon, BarChartIcon
} from '../../Icons';
import ReportFormatModal from '../../shared/ReportFormatModal';
import { generatePattyCashReportPDF } from '../../../utils/pdfGenerator';
import { generatePattyCashReportExcel } from '../../../utils/excelGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';
import '../PaymentCollection/PaymentCollection.css';
import './PattyCash.css';

// Helper: Convert number to English words for voucher slip
const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const n = Math.floor(Math.abs(Number(num) || 0));
    if (n === 0) return 'Zero Taka Only';

    const inWords = (n) => {
        let str = '';
        if (n >= 10000000) {
            str += inWords(Math.floor(n / 10000000)) + 'Crore ';
            n %= 10000000;
        }
        if (n >= 100000) {
            str += inWords(Math.floor(n / 100000)) + 'Lakh ';
            n %= 100000;
        }
        if (n >= 1000) {
            str += inWords(Math.floor(n / 1000)) + 'Thousand ';
            n %= 1000;
        }
        if (n >= 100) {
            str += inWords(Math.floor(n / 100)) + 'Hundred ';
            n %= 100;
        }
        if (n > 0) {
            if (n < 20) {
                str += a[n];
            } else {
                str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
            }
        }
        return str;
    };

    return inWords(n).trim() + ' Taka Only';
};

const EXPENSE_CATEGORIES = [
    'Food & Refreshment / Tea',
    'Conveyance & Travel',
    'Office Stationery & Supplies',
    'Electricity & Utility Bills',
    'Maintenance & Repairs',
    'Courier & Postal Service',
    'Cleaning & Sanitation',
    'Daily Wages / Labor',
    'Mobile / Internet Recharge',
    'Fuel & Vehicle Expense',
    'Printing & Xerox',
    'Miscellaneous Expense'
];

const INFLOW_CATEGORIES = [
    'Bank Withdrawal (Replenishment)',
    'Owner / Capital Addition',
    'Petty Cash Refund',
    'Customer Advance / Cash Collection',
    'Other Inflow'
];

const PAYMENT_MODES = [
    'Cash',
    'Bank',
    'Cheque',
    'bKash / Nagad / Mobile Banking'
];

/**
 * SearchableFilterSelect Component - Direct implementation matching Bank Deposit
 */
const SearchableFilterSelect = ({
    label,
    value,
    displayValue,
    onChange,
    options = [],
    placeholder = 'Select...',
    required = false,
    inputClassName = '',
    labelClassName = '',
    allowCustomValue = false,
    showAllOption = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const normalizedOptions = useMemo(() => {
        return (options || []).map(opt => {
            if (typeof opt === 'string') {
                return { value: opt, label: opt, sublabel: '' };
            }
            return {
                value: opt.value || '',
                label: opt.label || opt.value || '',
                sublabel: opt.sublabel || ''
            };
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return normalizedOptions;
        const q = search.toLowerCase().trim();
        return normalizedOptions.filter(opt =>
            opt.label.toLowerCase().includes(q) ||
            opt.sublabel.toLowerCase().includes(q) ||
            opt.value.toLowerCase().includes(q)
        );
    }, [normalizedOptions, search]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                if (allowCustomValue && search.trim()) {
                    onChange(search.trim());
                }
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [allowCustomValue, search, onChange]);

    const selectedOption = normalizedOptions.find(opt => opt.value === value);
    const currentText = displayValue || selectedOption?.label || value || '';

    const defaultInputClass = `w-full h-10 px-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm outline-none transition-all pr-8 ${
        value && !isOpen
            ? 'font-semibold text-gray-900 bg-blue-50/40 border-blue-200'
            : 'text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
    }`;

    const defaultLabelClass = "text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5";

    return (
        <div className={`space-y-1 relative ${isOpen ? 'z-30' : 'z-10'}`} ref={dropdownRef}>
            {label && (
                <label className={labelClassName || defaultLabelClass}>
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    required={required && !value}
                    value={isOpen ? search : currentText}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (allowCustomValue) onChange(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        setSearch('');
                    }}
                    onClick={() => {
                        if (!isOpen) setIsOpen(true);
                    }}
                    placeholder={currentText || placeholder}
                    className={inputClassName || defaultInputClass}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearch('');
                                setIsOpen(false);
                            }}
                            title="Clear selection"
                            className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition cursor-pointer"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <div
                            onClick={() => {
                                setIsOpen(prev => !prev);
                                if (!isOpen) inputRef.current?.focus();
                            }}
                            className="cursor-pointer p-0.5 text-gray-400"
                        >
                            <ChevronDownIcon
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
                            />
                        </div>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl z-[5300] max-h-48 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-100 divide-y divide-gray-50">
                    {showAllOption && (
                        <button
                            type="button"
                            onClick={() => {
                                onChange('');
                                setIsOpen(false);
                                setSearch('');
                            }}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                !value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <span>{placeholder}</span>
                            {!value && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        </button>
                    )}

                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => {
                            const isSelected = value === opt.value;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value, opt);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                        isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <span className="truncate">{opt.label}</span>
                                        {opt.sublabel && (
                                            <span className="text-[10px] text-gray-400 truncate">{opt.sublabel}</span>
                                        )}
                                    </div>
                                    {isSelected && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                                </button>
                            );
                        })
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-400 text-center">
                            No matching options
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const PattyCash = ({ currentUser = {}, onDeleteConfirm }) => {
    const user = currentUser?.username ? currentUser : JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdmin = user?.username === 'admin' || (user?.role || '').toLowerCase().trim() === 'admin';
    const canAdd = isAdmin || hasPermission(user, 'pattyCash', 'add');
    const canEdit = isAdmin || hasPermission(user, 'pattyCash', 'edit');
    const canDelete = isAdmin || hasPermission(user, 'pattyCash', 'delete');

    // Data States
    const [records, setRecords] = useState(() => {
        try {
            const cached = queryClient.getQueryData(['pattyCash']);
            return Array.isArray(cached) ? cached : [];
        } catch {
            return [];
        }
    });
    const [banks, setBanks] = useState(() => {
        try {
            const cached = queryClient.getQueryData(['banks']);
            return Array.isArray(cached) ? cached : [];
        } catch {
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'expense', 'inflow', 'summary'

    // Search & Filter Panel State (matching Deposit.jsx)
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        type: '',
        category: ''
    });

    // Form Modal State
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [selectedVoucher, setSelectedVoucher] = useState(null); // Printable Voucher Slip
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        type: 'expense',
        date: new Date().toISOString().split('T')[0],
        category: EXPENSE_CATEGORIES[0],
        customCategory: '',
        amount: '',
        partyName: '',
        paymentMode: '',
        bankAccountId: '',
        bankName: '',
        branch: '',
        accountNo: '',
        accountName: '',
        refNo: '',
        particulars: '',
        remarks: ''
    });

    // Close filter panel on click outside (matching Deposit.jsx)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                filterPanelRef.current &&
                !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current &&
                !filterButtonRef.current.contains(e.target)
            ) {
                setShowFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isFilterActive = Boolean(
        filters.startDate ||
        filters.endDate ||
        filters.type ||
        filters.category
    );

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            type: '',
            category: ''
        });
        setShowFilterPanel(false);
    };

    // Auto-generate voucher number: PC0001 for expense, PCI0001 for cash in
    const generateVoucherNumber = (type, existingList) => {
        const isPrefixInflow = type === 'inflow';
        const prefix = isPrefixInflow ? 'PCI' : 'PC';

        let maxSeq = 0;
        (existingList || []).forEach(r => {
            const v = String(r.voucherNo || '').trim().toUpperCase();
            if (isPrefixInflow) {
                if (v.startsWith('PCI')) {
                    const match = v.match(/(\d+)$/);
                    if (match) {
                        const parsed = parseInt(match[1], 10);
                        if (!isNaN(parsed) && parsed > maxSeq) {
                            maxSeq = parsed;
                        }
                    }
                }
            } else {
                if (v.startsWith('PC') && !v.startsWith('PCI')) {
                    const match = v.match(/(\d+)$/);
                    if (match) {
                        const parsed = parseInt(match[1], 10);
                        if (!isNaN(parsed) && parsed > maxSeq) {
                            maxSeq = parsed;
                        }
                    }
                }
            }
        });
        const nextSeq = maxSeq + 1;
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    };

    // Fetch records
    const fetchRecords = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/patty-cash?_t=${Date.now()}`);
            const data = Array.isArray(res.data) ? res.data : [];
            data.sort((a, b) => {
                const dateA = (a.date || '').split('T')[0];
                const dateB = (b.date || '').split('T')[0];
                if (dateA !== dateB) {
                    return dateB.localeCompare(dateA);
                }
                const timeA = new Date(a.createdAt || 0).getTime();
                const timeB = new Date(b.createdAt || 0).getTime();
                if (timeA !== timeB && timeA && timeB) {
                    return timeB - timeA;
                }
                return String(b._id || '').localeCompare(String(a._id || ''));
            });
            setRecords(data);
            queryClient.setQueryData(['pattyCash'], data);
        } catch (error) {
            console.error('Error fetching patty cash:', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    // Fetch banks
    const fetchBanks = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/banks?_t=${Date.now()}`);
            if (Array.isArray(res.data)) {
                setBanks(res.data);
            }
        } catch (err) {
            console.warn('Could not fetch banks for patty cash:', err);
        }
    };

    useEffect(() => {
        fetchRecords();
        fetchBanks();

        const socket = getSocket();
        const handleRealtimeUpdate = (data) => {
            const mod = (data?.module || '').toLowerCase().trim();
            if (!mod || mod === 'patty-cash' || mod === 'pattycash' || mod === 'all') {
                fetchRecords(true);
            }
        };

        if (socket) {
            socket.on('data_updated', handleRealtimeUpdate);
        }
        const onCustomEvent = (e) => handleRealtimeUpdate(e?.detail);
        window.addEventListener('erp_data_updated', onCustomEvent);

        return () => {
            if (socket) socket.off('data_updated', handleRealtimeUpdate);
            window.removeEventListener('erp_data_updated', onCustomEvent);
        };
    }, []);

    // Summary calculations (matching Deposit.jsx stats format)
    const summary = useMemo(() => {
        let totalIn = 0;
        let totalOut = 0;
        let todayExpense = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        records.forEach(r => {
            const amt = Number(r.amount) || 0;
            if (r.type === 'inflow') {
                totalIn += amt;
            } else {
                totalOut += amt;
                if ((r.date || '').split('T')[0] === todayStr) {
                    todayExpense += amt;
                }
            }
        });

        const currentBalance = totalIn - totalOut;

        return {
            totalIn,
            totalOut,
            currentBalance,
            todayExpense,
            totalCount: records.length
        };
    }, [records]);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(item => {
            // Tab filter
            if (activeTab === 'expense' && item.type !== 'expense') return false;
            if (activeTab === 'inflow' && item.type !== 'inflow') return false;

            // Panel filters
            if (filters.type && item.type !== filters.type) return false;
            if (filters.category && item.category !== filters.category) return false;

            const itemDate = (item.date || '').split('T')[0];
            if (filters.startDate && itemDate < filters.startDate) return false;
            if (filters.endDate && itemDate > filters.endDate) return false;

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const vNo = (item.voucherNo || '').toLowerCase();
                const cat = (item.category || '').toLowerCase();
                const party = (item.partyName || '').toLowerCase();
                const desc = (item.particulars || '').toLowerCase();
                const ref = (item.refNo || '').toLowerCase();
                const amt = String(item.amount || '');
                const entry = (item.entryBy || '').toLowerCase();

                if (!vNo.includes(q) && !cat.includes(q) && !party.includes(q) && !desc.includes(q) && !ref.includes(q) && !amt.includes(q) && !entry.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [records, activeTab, filters, searchQuery]);

    // Running balance calculation
    const recordsWithBalance = useMemo(() => {
        const asc = [...records].sort((a, b) => {
            const dateA = (a.date || '').split('T')[0];
            const dateB = (b.date || '').split('T')[0];
            if (dateA !== dateB) {
                return dateA.localeCompare(dateB);
            }
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            if (timeA !== timeB && timeA && timeB) {
                return timeA - timeB;
            }
            return String(a._id || '').localeCompare(String(b._id || ''));
        });
        let runningBal = 0;
        const balanceMap = new Map();

        asc.forEach(r => {
            const amt = Number(r.amount) || 0;
            if (r.type === 'inflow') {
                runningBal += amt;
            } else {
                runningBal -= amt;
            }
            balanceMap.set(r._id, runningBal);
        });

        return filteredRecords.map(r => ({
            ...r,
            runningBalance: balanceMap.get(r._id) ?? 0
        }));
    }, [records, filteredRecords]);

    // Export handlers for PDF & Excel report
    const handleExportPdf = async () => {
        await generatePattyCashReportPDF(filteredRecords, filters, summary);
    };

    const handleExportExcel = () => {
        generatePattyCashReportExcel(filteredRecords, filters, summary);
    };

    // Category breakdown for summary tab
    const categoryStats = useMemo(() => {
        const stats = {};
        let totalExpenses = 0;

        records.forEach(r => {
            if (r.type === 'expense') {
                const amt = Number(r.amount) || 0;
                const cat = r.category || 'Miscellaneous';
                stats[cat] = (stats[cat] || 0) + amt;
                totalExpenses += amt;
            }
        });

        const sorted = Object.entries(stats).map(([category, amount]) => ({
            category,
            amount,
            percentage: totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0
        })).sort((a, b) => b.amount - a.amount);

        return { list: sorted, totalExpenses };
    }, [records]);

    // Check if Payment Method is Bank or Cheque
    const isBankOrCheque = useMemo(() => {
        const mode = (formData.paymentMode || '').trim().toLowerCase();
        return mode.includes('bank') || mode.includes('cheque') || mode.includes('check');
    }, [formData.paymentMode]);

    // Unique bank names across bank records & existing transactions
    const uniqueBankNames = useMemo(() => {
        const seen = new Map();
        [...banks.map(b => b.bankName), ...records.map(r => r.bankName)].forEach(name => {
            if (!name) return;
            const clean = name.trim();
            const lower = clean.toLowerCase();
            if (clean && !seen.has(lower)) {
                seen.set(lower, clean);
            }
        });
        return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
    }, [banks, records]);

    // Available branches for selected bank
    const availableBranches = useMemo(() => {
        if (!formData.bankName) return [];
        const targetName = formData.bankName.trim().toLowerCase();
        const matchingDocs = banks.filter(b => (b.bankName || '').trim().toLowerCase() === targetName);
        const list = [];
        matchingDocs.forEach(b => {
            if (Array.isArray(b.branches) && b.branches.length > 0) {
                b.branches.forEach(br => {
                    if (br && br.branch) {
                        list.push({
                            branch: br.branch.trim(),
                            accountName: (br.accountName || b.accountName || '').trim(),
                            accountNo: (br.accountNo || b.accountNo || '').trim(),
                            bankAccountId: b._id || ''
                        });
                    }
                });
            } else if (b.branch) {
                list.push({
                    branch: b.branch.trim(),
                    accountName: (b.accountName || '').trim(),
                    accountNo: (b.accountNo || '').trim(),
                    bankAccountId: b._id || ''
                });
            }
        });

        records
            .filter(r => (r.bankName || '').trim().toLowerCase() === targetName && r.branch)
            .forEach(r => {
                list.push({
                    branch: r.branch.trim(),
                    accountName: (r.accountName || '').trim(),
                    accountNo: (r.accountNo || '').trim(),
                    bankAccountId: r.bankAccountId || ''
                });
            });

        const seen = new Set();
        return list.filter(item => {
            const key = `${(item.branch || '').toLowerCase()}|${(item.accountNo || '').toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [banks, records, formData.bankName]);

    // Available account options for selected bank & branch
    const availableAccountOptions = useMemo(() => {
        if (!formData.bankName) return [];
        const list = availableBranches.filter(b => !formData.branch || (b.branch || '').toLowerCase() === (formData.branch || '').toLowerCase());
        const candidateList = list.length > 0 ? list : availableBranches;
        const seen = new Set();
        const opts = [];
        candidateList.forEach(item => {
            const acc = (item.accountNo || '').trim();
            if (acc && !seen.has(acc.toLowerCase())) {
                seen.add(acc.toLowerCase());
                opts.push({
                    value: acc,
                    label: acc,
                    sublabel: [item.branch, item.accountName].filter(Boolean).join(' • '),
                    accountName: item.accountName,
                    branch: item.branch,
                    bankAccountId: item.bankAccountId
                });
            }
        });
        return opts;
    }, [availableBranches, formData.bankName, formData.branch]);

    const handleBankChange = (valOrEvent) => {
        const bName = typeof valOrEvent === 'string' ? valOrEvent : (valOrEvent?.target?.value || '');
        if (!bName) {
            setFormData(prev => ({
                ...prev,
                bankName: '',
                branch: '',
                accountName: '',
                accountNo: '',
                bankAccountId: ''
            }));
            return;
        }
        const targetName = bName.trim().toLowerCase();
        const matchingDocs = banks.filter(b => (b.bankName || '').trim().toLowerCase() === targetName);
        const branches = [];
        matchingDocs.forEach(b => {
            if (Array.isArray(b.branches) && b.branches.length > 0) {
                b.branches.forEach(br => {
                    if (br && br.branch) {
                        branches.push({
                            branch: br.branch.trim(),
                            accountName: (br.accountName || b.accountName || '').trim(),
                            accountNo: (br.accountNo || b.accountNo || '').trim(),
                            bankAccountId: b._id || ''
                        });
                    }
                });
            } else if (b.branch) {
                branches.push({
                    branch: b.branch.trim(),
                    accountName: (b.accountName || '').trim(),
                    accountNo: (b.accountNo || '').trim(),
                    bankAccountId: b._id || ''
                });
            }
        });
        const firstBranch = branches[0];

        setFormData(prev => ({
            ...prev,
            bankName: bName,
            branch: firstBranch?.branch || '',
            accountName: firstBranch?.accountName || '',
            accountNo: firstBranch?.accountNo || '',
            bankAccountId: firstBranch?.bankAccountId || ''
        }));
    };

    const handleBranchChange = (valOrEvent, extraOpt) => {
        const branchName = typeof valOrEvent === 'string' ? valOrEvent : (valOrEvent?.target?.value || '');
        let branchObj;
        if (extraOpt?.accountNo) {
            branchObj = availableBranches.find(b =>
                (b.branch || '').trim().toLowerCase() === branchName.trim().toLowerCase() &&
                (b.accountNo || '').trim() === (extraOpt.accountNo || '').trim()
            );
        }
        if (!branchObj) {
            branchObj = availableBranches.find(b => (b.branch || '').trim().toLowerCase() === branchName.trim().toLowerCase());
        }
        setFormData(prev => ({
            ...prev,
            branch: branchName,
            accountName: branchObj ? branchObj.accountName : (branchName ? prev.accountName : ''),
            accountNo: branchObj ? branchObj.accountNo : (branchName ? prev.accountNo : ''),
            bankAccountId: branchObj?.bankAccountId || prev.bankAccountId || ''
        }));
    };

    const handleAccountChange = (valOrEvent, extraOpt) => {
        const accNo = typeof valOrEvent === 'string' ? valOrEvent : (valOrEvent?.target?.value || '');
        let accObj;
        if (extraOpt?.branch) {
            accObj = availableBranches.find(b =>
                (b.accountNo || '').trim() === accNo.trim() &&
                (b.branch || '').trim().toLowerCase() === (extraOpt.branch || '').trim().toLowerCase()
            );
        }
        if (!accObj) {
            accObj = availableBranches.find(b => (b.accountNo || '').trim() === accNo.trim());
        }
        setFormData(prev => ({
            ...prev,
            accountNo: accNo,
            accountName: accObj?.accountName || prev.accountName,
            branch: accObj?.branch || prev.branch,
            bankAccountId: accObj?.bankAccountId || prev.bankAccountId || ''
        }));
    };

    // Open Add (Voucher No is generated after save)
    const handleOpenCreateModal = (type = 'expense') => {
        setEditingRecord(null);
        setFormData({
            type,
            date: new Date().toISOString().split('T')[0],
            category: type === 'expense' ? EXPENSE_CATEGORIES[0] : INFLOW_CATEGORIES[0],
            customCategory: '',
            amount: '',
            partyName: '',
            paymentMode: '',
            bankAccountId: '',
            bankName: '',
            branch: '',
            accountNo: '',
            accountName: '',
            refNo: '',
            particulars: '',
            remarks: ''
        });
        setShowModal(true);
    };

    // Open Edit
    const handleOpenEditModal = (record) => {
        setEditingRecord(record);
        const isPreset = (record.type === 'expense' ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES).includes(record.category);
        setFormData({
            type: record.type || 'expense',
            date: (record.date || '').split('T')[0] || new Date().toISOString().split('T')[0],
            category: isPreset ? record.category : 'Other',
            customCategory: isPreset ? '' : record.category,
            amount: record.amount || '',
            partyName: record.partyName || '',
            paymentMode: record.paymentMode || '',
            bankAccountId: record.bankAccountId || '',
            bankName: record.bankName || '',
            branch: record.branch || '',
            accountNo: record.accountNo || '',
            accountName: record.accountName || '',
            refNo: record.refNo || '',
            particulars: record.particulars || '',
            remarks: record.remarks || ''
        });
        setShowModal(true);
    };

    // Form Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount);
        if (!amt || amt <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        if (!formData.paymentMode || !formData.paymentMode.trim()) {
            alert('Payment Method is required. Please choose a method.');
            return;
        }

        if (isBankOrCheque) {
            if (!formData.bankName || !formData.bankName.trim()) {
                alert(`Bank selection is required when payment method is ${formData.paymentMode}.`);
                return;
            }
            if (!formData.branch || !formData.branch.trim()) {
                alert(`Branch selection is required when payment method is ${formData.paymentMode}.`);
                return;
            }
            if (!formData.accountNo || !formData.accountNo.trim()) {
                alert(`Account selection is required when payment method is ${formData.paymentMode}.`);
                return;
            }
        }

        const finalCategory = formData.category === 'Other' && formData.customCategory.trim()
            ? formData.customCategory.trim()
            : formData.category;

        // Auto-generate voucher number after save (or retain existing if editing)
        const finalVoucherNo = editingRecord?.voucherNo || generateVoucherNumber(formData.type, records);

        const payload = {
            ...formData,
            voucherNo: finalVoucherNo,
            category: finalCategory,
            amount: amt,
            paymentMode: formData.paymentMode.trim(),
            bankName: isBankOrCheque ? (formData.bankName || '').trim() : '',
            branch: isBankOrCheque ? (formData.branch || '').trim() : '',
            accountNo: isBankOrCheque ? (formData.accountNo || '').trim() : '',
            accountName: isBankOrCheque ? (formData.accountName || '').trim() : '',
            bankAccountId: isBankOrCheque ? (formData.bankAccountId || '') : '',
            entryBy: editingRecord?.entryBy || user?.name || user?.username || 'Admin',
            entryDate: editingRecord?.entryDate || new Date().toISOString()
        };

        setIsSubmitting(true);
        try {
            if (editingRecord) {
                const res = await axios.put(`${API_BASE_URL}/api/patty-cash/${editingRecord._id}`, payload);
                const updated = res.data;
                setRecords(prev => prev.map(item => item._id === editingRecord._id ? updated : item));
                queryClient.invalidateQueries({ queryKey: ['pattyCash'] });
            } else {
                const res = await axios.post(`${API_BASE_URL}/api/patty-cash`, payload);
                const created = res.data;
                setRecords(prev => [created, ...prev]);
                queryClient.invalidateQueries({ queryKey: ['pattyCash'] });
            }
            setShowModal(false);
            setEditingRecord(null);
        } catch (err) {
            console.error('Error saving patty cash record:', err);
            alert(err?.response?.data?.message || 'Failed to save transaction.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete
    const handleDeleteClick = (record) => {
        if (!canDelete) {
            alert('You do not have permission to delete this record.');
            return;
        }

        if (typeof onDeleteConfirm === 'function') {
            onDeleteConfirm({
                type: 'patty-cash',
                id: record._id,
                isBulk: false
            });
        } else {
            if (window.confirm(`Are you sure you want to delete voucher "${record.voucherNo || 'this record'}"?`)) {
                axios.delete(`${API_BASE_URL}/api/patty-cash/${record._id}`)
                    .then(() => {
                        setRecords(prev => prev.filter(r => r._id !== record._id));
                        queryClient.invalidateQueries({ queryKey: ['pattyCash'] });
                    })
                    .catch(err => alert('Failed to delete: ' + err.message));
            }
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header and Action Controls - EXACTLY MATCHING BANK DEPOSIT */}
            {!showModal && (
                <div className="space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Patty Cash Management</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Track, record, and reconcile petty cash transactions</p>
                        </div>

                        {/* Search Input - CENTERED (Same as Deposit.jsx) */}
                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by voucher, category, payee, particulars..."
                                autoComplete="off"
                                className="h-10 block w-full pl-10 pr-4 bg-white/70 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Action Controls: Filter Button + Add Buttons (Same as Deposit.jsx) */}
                        <div className="flex items-center justify-center md:justify-end gap-2.5 w-full md:w-auto shrink-0">
                            {/* Filter Dropdown */}
                            <div className="relative">
                                <button
                                    ref={filterButtonRef}
                                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                                    className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl border transition-all active:scale-95 text-sm font-medium shadow-sm cursor-pointer ${
                                        showFilterPanel || isFilterActive
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <FunnelIcon className={`w-4 h-4 ${showFilterPanel || isFilterActive ? 'text-white' : 'text-gray-400'}`} />
                                    <span className="text-sm font-medium">Filter</span>
                                    {isFilterActive && (
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    )}
                                </button>

                                {showFilterPanel && (
                                    <>
                                        {/* Mobile backdrop */}
                                        <div
                                            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden"
                                            onClick={() => setShowFilterPanel(false)}
                                        />
                                        <div
                                            ref={filterPanelRef}
                                            className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-88 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-visible text-left"
                                        >
                                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                                <h4 className="font-bold text-gray-900 text-sm">Filter Transactions</h4>
                                                <button
                                                    type="button"
                                                    onClick={resetFilters}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
                                                >
                                                    Reset
                                                </button>
                                            </div>

                                            <div className="space-y-3">
                                                <CustomDatePicker
                                                    label="Start Date"
                                                    value={filters.startDate}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e?.target?.value || e }))}
                                                    compact={true}
                                                />
                                                <CustomDatePicker
                                                    label="End Date"
                                                    value={filters.endDate}
                                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e?.target?.value || e }))}
                                                    compact={true}
                                                />

                                                {/* Transaction Type Filter */}
                                                <SearchableFilterSelect
                                                    label="Transaction Type"
                                                    value={filters.type}
                                                    onChange={(val) => setFilters(prev => ({ ...prev, type: val }))}
                                                    options={[
                                                        { value: '', label: 'All Types' },
                                                        { value: 'expense', label: 'Expense (Cash Out)' },
                                                        { value: 'inflow', label: 'Cash In (Replenish)' }
                                                    ]}
                                                    placeholder="All Types"
                                                />

                                                {/* Category Head Filter */}
                                                <SearchableFilterSelect
                                                    label="Category Head"
                                                    value={filters.category}
                                                    onChange={(val) => setFilters(prev => ({ ...prev, category: val }))}
                                                    options={[
                                                        { value: '', label: 'All Categories' },
                                                        ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c, sublabel: 'Expense Head' })),
                                                        ...INFLOW_CATEGORIES.map(c => ({ value: c, label: c, sublabel: 'Inflow Head' }))
                                                    ]}
                                                    placeholder="All Categories"
                                                />

                                                <button
                                                    type="button"
                                                    onClick={() => setShowFilterPanel(false)}
                                                    className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98] cursor-pointer"
                                                >
                                                    APPLY FILTERS
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Report Button */}
                            <button
                                type="button"
                                onClick={() => setShowReportFormatModal(true)}
                                className="h-10 flex items-center justify-center gap-2 px-4 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all active:scale-95 text-sm font-medium shadow-sm cursor-pointer"
                                title="Export Report (PDF / Excel)"
                            >
                                <BarChartIcon className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium">Report</span>
                            </button>

                            {/* Add Deposit / Record Expense Buttons (Same Style as Deposit.jsx) */}
                            {canAdd && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenCreateModal('inflow')}
                                        data-action="Create New Cash In"
                                        className="h-10 border border-transparent px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center text-sm gap-1.5 whitespace-nowrap cursor-pointer"
                                    >
                                        <ArrowDownLeftIcon className="w-4 h-4" />
                                        <span>Cash In</span>
                                    </button>

                                    <button
                                        onClick={() => handleOpenCreateModal('expense')}
                                        data-action="Create New Expense"
                                        className="h-10 border border-transparent px-4.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center text-sm gap-2 whitespace-nowrap cursor-pointer"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                        <span>Record Expense</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* View Tabs - CENTER ALIGNED UNDER SEARCH BAR */}
                    <div className="flex justify-center items-center w-full pt-1">
                        <div className="inline-flex p-1 bg-gray-100/90 rounded-xl max-w-full overflow-x-auto shadow-xs">
                            <button
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                                onClick={() => setActiveTab('all')}
                            >
                                All Transactions ({records.length})
                            </button>
                            <button
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab === 'expense' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                                onClick={() => setActiveTab('expense')}
                            >
                                Expenses ({records.filter(r => r.type === 'expense').length})
                            </button>
                            <button
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab === 'inflow' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                                onClick={() => setActiveTab('inflow')}
                            >
                                Cash In ({records.filter(r => r.type === 'inflow').length})
                            </button>
                            <button
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab === 'summary' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                                onClick={() => setActiveTab('summary')}
                            >
                                Category Breakdown
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inline Add / Edit Form Card (Matches Deposit.jsx payment-form-container) */}
            {showModal && (
                <div className="payment-form-container">
                    <div className="payment-form-header">
                        <div>
                            <h3 className="payment-form-title">
                                {editingRecord
                                    ? `Edit Transaction${editingRecord.voucherNo ? ` (${editingRecord.voucherNo})` : ''}`
                                    : formData.type === 'inflow'
                                        ? 'New Cash In / Float Replenishment'
                                        : 'New Petty Cash Expense'}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium italic">
                                {editingRecord ? 'Update transaction details' : 'Record a petty cash float transaction'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setShowModal(false); setEditingRecord(null); }}
                            className="payment-form-close cursor-pointer"
                            title="Close form"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Type Toggle when creating */}
                        {!editingRecord && (
                            <div className="inline-flex p-1 bg-gray-100 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            type: 'expense',
                                            category: EXPENSE_CATEGORIES[0]
                                        }));
                                    }}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                        formData.type === 'expense'
                                            ? 'bg-white text-rose-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <ArrowUpRightIcon className="w-3.5 h-3.5" />
                                    <span>Expense (Cash Out)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            type: 'inflow',
                                            category: INFLOW_CATEGORIES[0]
                                        }));
                                    }}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                                        formData.type === 'inflow'
                                            ? 'bg-white text-emerald-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <ArrowDownLeftIcon className="w-3.5 h-3.5" />
                                    <span>Cash In (Replenish)</span>
                                </button>
                            </div>
                        )}

                        {/* Fields Grid Row 1: Date, Category Head, Amount, Payment Method (No Voucher No shown) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Date */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    Date <span className="text-red-500">*</span>
                                </label>
                                <CustomDatePicker
                                    value={formData.date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, date: e?.target?.value || e }))}
                                    placeholder="Select Date"
                                />
                            </div>

                            {/* Category Head */}
                            <div className="space-y-1">
                                <SearchableFilterSelect
                                    label="Category Head *"
                                    labelClassName="text-xs font-semibold text-gray-700 block"
                                    required
                                    value={formData.category}
                                    onChange={(cat) => setFormData(prev => ({ ...prev, category: cat || 'Miscellaneous Expense' }))}
                                    options={[
                                        ...(formData.type === 'expense' ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES),
                                        'Other'
                                    ]}
                                    placeholder="-- Choose Category --"
                                    showAllOption={false}
                                    inputClassName="h-10 payment-form-input pr-8"
                                />
                            </div>

                            {/* Amount */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    Amount (BDT) <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">৳</span>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        className="h-10 payment-form-input pl-8 font-bold text-gray-900"
                                    />
                                </div>
                            </div>

                            {/* Payment Method * (REQUIRED) */}
                            <div className="space-y-1">
                                <SearchableFilterSelect
                                    label="Payment Method *"
                                    labelClassName="text-xs font-semibold text-gray-700 block"
                                    required
                                    value={formData.paymentMode}
                                    onChange={(val) => setFormData(prev => ({ ...prev, paymentMode: val || '' }))}
                                    options={PAYMENT_MODES}
                                    placeholder="-- Select Method --"
                                    showAllOption={false}
                                    inputClassName="h-10 payment-form-input pr-8"
                                />
                            </div>
                        </div>

                        {/* Custom Category input if 'Other' selected */}
                        {formData.category === 'Other' && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    Custom Category Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Type custom category name..."
                                    value={formData.customCategory}
                                    onChange={(e) => setFormData(prev => ({ ...prev, customCategory: e.target.value }))}
                                    className="h-10 payment-form-input"
                                />
                            </div>
                        )}

                        {/* Bank & Cheque Details: Required when Bank or Cheque is selected */}
                        {isBankOrCheque && (
                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3 animate-in fade-in duration-200">
                                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider">
                                    <BuildingIcon className="w-4 h-4 text-blue-600" />
                                    <span>Bank & Account Details ({formData.paymentMode || 'Bank / Cheque'})</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Select Bank * */}
                                    <div className="space-y-1">
                                        <SearchableFilterSelect
                                            label="Select Bank *"
                                            labelClassName="text-xs font-semibold text-gray-700 block"
                                            required={true}
                                            value={formData.bankName}
                                            onChange={handleBankChange}
                                            options={uniqueBankNames}
                                            placeholder="-- Select Bank --"
                                            allowCustomValue={true}
                                            showAllOption={false}
                                            inputClassName="h-10 payment-form-input pr-8"
                                        />
                                    </div>

                                    {/* Branch * */}
                                    <div className="space-y-1">
                                        <SearchableFilterSelect
                                            label="Branch *"
                                            labelClassName="text-xs font-semibold text-gray-700 block"
                                            required={true}
                                            value={formData.branch}
                                            onChange={handleBranchChange}
                                            options={availableBranches.map(br => ({
                                                value: br.branch,
                                                label: br.branch,
                                                sublabel: br.accountNo ? `A/C: ${br.accountNo}${br.accountName ? ` (${br.accountName})` : ''}` : '',
                                                accountNo: br.accountNo,
                                                accountName: br.accountName,
                                                bankAccountId: br.bankAccountId
                                            }))}
                                            placeholder={availableBranches.length > 0 ? '-- Select Branch --' : 'Type branch name'}
                                            allowCustomValue={true}
                                            showAllOption={false}
                                            inputClassName="h-10 payment-form-input pr-8"
                                        />
                                    </div>

                                    {/* Account Selection * */}
                                    <div className="space-y-1">
                                        <SearchableFilterSelect
                                            label="Account Selection *"
                                            labelClassName="text-xs font-semibold text-gray-700 block"
                                            required={true}
                                            value={formData.accountNo}
                                            onChange={handleAccountChange}
                                            options={availableAccountOptions}
                                            placeholder={availableAccountOptions.length > 0 ? '-- Select Account --' : 'Type account number'}
                                            allowCustomValue={true}
                                            showAllOption={false}
                                            inputClassName="h-10 payment-form-input pr-8"
                                        />
                                    </div>

                                    {/* Account Name */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-700 block">
                                            Account Name / Title
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Ani Enterprise"
                                            value={formData.accountName}
                                            onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
                                            className="h-10 payment-form-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Row 2: Paid To / Received From & Ref / Cheque # */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    {formData.type === 'inflow' ? 'Received From / Source' : 'Paid To (Recipient / Vendor)'}
                                </label>
                                <input
                                    type="text"
                                    placeholder={formData.type === 'inflow' ? 'e.g. Bank Withdrawal / Director' : 'e.g. Stationery Shop / Peon'}
                                    value={formData.partyName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, partyName: e.target.value }))}
                                    className="h-10 payment-form-input"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    {formData.paymentMode?.toLowerCase().includes('cheque') || formData.paymentMode?.toLowerCase().includes('check')
                                        ? 'Cheque / Slip Ref #'
                                        : 'Bill / Memo / Ref #'}
                                </label>
                                <input
                                    type="text"
                                    placeholder={
                                        formData.paymentMode?.toLowerCase().includes('cheque') || formData.paymentMode?.toLowerCase().includes('check')
                                            ? 'e.g. Cheque #492015'
                                            : 'e.g. Memo #1024'
                                    }
                                    value={formData.refNo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, refNo: e.target.value }))}
                                    className="h-10 payment-form-input"
                                />
                            </div>
                        </div>

                        {/* Particulars & Remarks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    Particulars / Purpose / Description
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Office tea & snacks for meeting, paper reams..."
                                    value={formData.particulars}
                                    onChange={(e) => setFormData(prev => ({ ...prev, particulars: e.target.value }))}
                                    className="h-10 payment-form-input"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-700 block">
                                    Internal Remarks
                                </label>
                                <input
                                    type="text"
                                    placeholder="Optional notes or references"
                                    value={formData.remarks}
                                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                    className="h-10 payment-form-input"
                                />
                            </div>
                        </div>

                        {/* Form Footer Action Buttons (Same as Deposit.jsx) */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => { setShowModal(false); setEditingRecord(null); }}
                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition flex items-center gap-2 cursor-pointer ${
                                    formData.type === 'inflow'
                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30'
                                } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                <span>{editingRecord ? 'Update Record' : 'Save Transaction'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* KPI OVERVIEW CARDS (EXACT STYLE MATCHING DEPOSIT.JSX) */}
            {!showModal && (
                <div className="space-y-4 md:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Cash in Hand Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cash In Hand</p>
                                    <h3 className={`text-xl font-bold mt-1 ${summary.currentBalance < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                        ৳{summary.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </h3>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                                    <WalletIcon className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-2 font-medium">Net available petty cash</p>
                        </div>

                        {/* Total Cash In Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cash In</p>
                                    <h3 className="text-xl font-bold text-emerald-600 mt-1">
                                        ৳{summary.totalIn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </h3>
                                </div>
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
                                    <ArrowDownLeftIcon className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-2 font-medium">Fund replenished / added</p>
                        </div>

                        {/* Total Expense Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Expenses</p>
                                    <h3 className="text-xl font-bold text-rose-600 mt-1">
                                        ৳{summary.totalOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </h3>
                                </div>
                                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shadow-sm">
                                    <ArrowUpRightIcon className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-2 font-medium">Disbursed petty expenses</p>
                        </div>

                        {/* Today's Expense Card */}
                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Expense</p>
                                    <h3 className="text-xl font-bold text-amber-600 mt-1">
                                        ৳{summary.todayExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </h3>
                                </div>
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
                                    <ClockIcon className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-2 font-medium">Disbursed today</p>
                        </div>
                    </div>



                    {/* TAB CONTENT: Category Breakdown */}
                    {activeTab === 'summary' ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-sm">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Expense Category Breakdown</h2>
                                    <p className="text-xs text-gray-500">Distribution of petty cash expenses across various heads</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold block">Total Outflow</span>
                                    <span className="text-xl font-bold text-rose-600">
                                        ৳ {categoryStats.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {categoryStats.list.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    No expense records available to analyze.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {categoryStats.list.map((item, idx) => (
                                        <div key={idx} className="space-y-1.5">
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                                    <span className="font-semibold text-gray-800">{item.category}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-gray-500 text-xs">{item.percentage}%</span>
                                                    <span className="font-bold text-gray-900">
                                                        ৳ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                                    style={{ width: `${Math.max(item.percentage, 2)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* TAB CONTENT: Table */
                        <div className="patty-cash-table-card">
                            <div className="patty-cash-table-wrapper">
                                <table className="patty-cash-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Voucher No</th>
                                            <th>Type</th>
                                            <th>Category</th>
                                            <th>Paid To / Source</th>
                                            <th>Particulars</th>
                                            <th className="text-right">Cash In (Tk)</th>
                                            <th className="text-right">Cash Out (Tk)</th>
                                            <th className="text-right">Balance (Tk)</th>
                                            <th>Entry By</th>
                                            <th className="text-center w-28">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {isLoading ? (
                                            <tr>
                                                <td colSpan="11" className="py-12 text-center text-gray-500">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                        <span>Loading patty cash records...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : recordsWithBalance.length === 0 ? (
                                            <tr>
                                                <td colSpan="11" className="py-12 text-center text-gray-400">
                                                    No patty cash transactions found matching your criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            recordsWithBalance.map((item) => (
                                                <tr key={item._id}>
                                                    <td className="whitespace-nowrap font-medium text-gray-900">
                                                        {formatDate(item.date) || item.date}
                                                    </td>
                                                    <td className="whitespace-nowrap">
                                                        <button
                                                            onClick={() => setSelectedVoucher(item)}
                                                            className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition cursor-pointer"
                                                            title="Click to view printable voucher slip"
                                                        >
                                                            {item.voucherNo || 'N/A'}
                                                        </button>
                                                    </td>
                                                    <td className="whitespace-nowrap">
                                                        {item.type === 'inflow' ? (
                                                            <span className="badge-inflow">
                                                                <ArrowDownLeftIcon className="w-3 h-3" />
                                                                <span>Cash In</span>
                                                            </span>
                                                        ) : (
                                                            <span className="badge-expense">
                                                                <ArrowUpRightIcon className="w-3 h-3" />
                                                                <span>Expense</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap text-[13px] font-medium text-gray-700">
                                                        {item.category || 'General'}
                                                    </td>
                                                    <td className="max-w-[150px] truncate" title={item.partyName}>
                                                        <span className="font-medium text-gray-800">{item.partyName || '—'}</span>
                                                        {item.paymentMode && (
                                                            <span className="text-[10px] text-gray-400 block font-normal">
                                                                {item.paymentMode}{item.bankName ? ` • ${item.bankName}` : ''}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="max-w-[200px] truncate" title={item.particulars}>
                                                        <span className="text-gray-600 text-xs">{item.particulars || '—'}</span>
                                                    </td>
                                                    <td className="text-right whitespace-nowrap font-semibold text-emerald-600">
                                                        {item.type === 'inflow'
                                                            ? `৳ ${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                            : '—'}
                                                    </td>
                                                    <td className="text-right whitespace-nowrap font-semibold text-rose-600">
                                                        {item.type === 'expense'
                                                            ? `৳ ${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                            : '—'}
                                                    </td>
                                                    <td className={`text-right whitespace-nowrap font-bold ${item.runningBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                        ৳ {item.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="whitespace-nowrap text-[13px] font-medium text-gray-600">
                                                        {item.entryBy || 'Admin'}
                                                    </td>
                                                    <td className="text-center whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-1">
                                                            <button
                                                                onClick={() => setSelectedVoucher(item)}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                                                                title="Print / View Voucher"
                                                            >
                                                                <PrinterIcon className="w-4 h-4" />
                                                            </button>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleOpenEditModal(item)}
                                                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                                                                    title="Edit Transaction"
                                                                >
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(item)}
                                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                                                                    title="Delete Transaction"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PRINTABLE VOUCHER MODAL */}
            {selectedVoucher && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden">
                        <div className="no-print px-6 py-3.5 bg-gray-50 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileTextIcon className="w-5 h-5 text-blue-600" />
                                <span className="font-bold text-gray-800 text-sm">Petty Cash Voucher Slip</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                                >
                                    <PrinterIcon className="w-4 h-4" />
                                    <span>Print Voucher</span>
                                </button>
                                <button
                                    onClick={() => setSelectedVoucher(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition cursor-pointer"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="printable-voucher-content p-8 bg-white text-gray-900 space-y-6">
                            <div className="text-center border-b-2 border-gray-800 pb-4">
                                <h1 className="text-2xl font-black tracking-wide text-gray-900 uppercase">ANI ENTERPRISE</h1>
                                <p className="text-xs text-gray-600 font-medium">Head Office: Dhaka, Bangladesh</p>
                                <div className="inline-block mt-2 px-3 py-1 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest rounded">
                                    {selectedVoucher.type === 'inflow' ? 'PETTY CASH RECEIPT / INFLOW VOUCHER' : 'PETTY CASH PAYMENT VOUCHER'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-gray-500 font-medium block">Voucher No:</span>
                                    <span className="font-mono font-bold text-sm text-gray-900">{selectedVoucher.voucherNo || '—'}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-500 font-medium block">Date:</span>
                                    <span className="font-bold text-sm text-gray-900">{formatDate(selectedVoucher.date) || selectedVoucher.date}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 font-medium block">
                                        {selectedVoucher.type === 'inflow' ? 'Received From:' : 'Paid To:'}
                                    </span>
                                    <span className="font-bold text-sm text-gray-900">{selectedVoucher.partyName || '—'}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-500 font-medium block">Category Head:</span>
                                    <span className="font-semibold text-gray-800">{selectedVoucher.category || '—'}</span>
                                </div>
                            </div>

                            <div className="border border-gray-300 rounded overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-100 border-b border-gray-300">
                                        <tr>
                                            <th className="py-2 px-3 text-left font-bold text-gray-700">Particulars / Description</th>
                                            <th className="py-2 px-3 text-right font-bold text-gray-700 w-32">Amount (BDT)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="py-4 px-3 align-top">
                                                <p className="font-medium text-gray-900">{selectedVoucher.particulars || 'Petty cash disbursement'}</p>
                                                {selectedVoucher.refNo && (
                                                    <p className="text-gray-500 mt-1">Ref / Bill No: {selectedVoucher.refNo}</p>
                                                )}
                                                {selectedVoucher.paymentMode && (
                                                    <p className="text-gray-500">Payment Mode: {selectedVoucher.paymentMode}</p>
                                                )}
                                                {selectedVoucher.bankName && (
                                                    <p className="text-gray-500">
                                                        Bank: {selectedVoucher.bankName}
                                                        {selectedVoucher.branch ? ` • Branch: ${selectedVoucher.branch}` : ''}
                                                        {selectedVoucher.accountNo ? ` • A/C: ${selectedVoucher.accountNo}` : ''}
                                                        {selectedVoucher.accountName ? ` (${selectedVoucher.accountName})` : ''}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-4 px-3 text-right font-mono font-bold text-base align-top">
                                                ৳ {Number(selectedVoucher.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        <tr className="bg-gray-50 border-t border-gray-300 font-bold">
                                            <td className="py-2.5 px-3 text-right">TOTAL AMOUNT:</td>
                                            <td className="py-2.5 px-3 text-right font-mono text-base text-gray-900">
                                                ৳ {Number(selectedVoucher.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs">
                                <span className="font-bold text-gray-700">In Words: </span>
                                <span className="font-semibold text-gray-900 italic">
                                    {numberToWords(selectedVoucher.amount)}
                                </span>
                            </div>

                            <div className="pt-12 grid grid-cols-4 gap-4 text-center text-[10px] text-gray-600">
                                <div>
                                    <div className="border-t border-gray-400 pt-1 font-bold text-gray-800">
                                        {selectedVoucher.entryBy || 'Prepared By'}
                                    </div>
                                    <span>Prepared By</span>
                                </div>
                                <div>
                                    <div className="border-t border-gray-400 pt-1 font-bold text-gray-800">
                                        Accounts Officer
                                    </div>
                                    <span>Checked By</span>
                                </div>
                                <div>
                                    <div className="border-t border-gray-400 pt-1 font-bold text-gray-800">
                                        Managing Director
                                    </div>
                                    <span>Approved By</span>
                                </div>
                                <div>
                                    <div className="border-t border-gray-400 pt-1 font-bold text-gray-800">
                                        {selectedVoucher.partyName || "Receiver's Sign"}
                                    </div>
                                    <span>Received By</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Format Modal (PDF / Excel) */}
            <ReportFormatModal
                isOpen={showReportFormatModal}
                onClose={() => setShowReportFormatModal(false)}
                title="Patty Cash Transactions Report"
                subtitle="Choose format to download the transactions report"
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
            />
        </div>
    );
};

export default PattyCash;
