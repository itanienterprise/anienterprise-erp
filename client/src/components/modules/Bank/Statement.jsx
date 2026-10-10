import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { decryptData } from '../../../utils/encryption';
import { queryClient } from '../../../utils/queryClient';
import { getSocket } from '../../../utils/socket';
import { hasPermission } from '../../../utils/permissionHelper';
import {
  SearchIcon, XIcon, ChevronDownIcon, DollarSignIcon, BuildingIcon,
  CalendarIcon, ArrowDownLeftIcon, ArrowUpRightIcon, FileTextIcon,
  UserIcon, CheckCircle2Icon, FunnelIcon, CheckIcon,
  DownloadIcon, RefreshCwIcon, WalletIcon, BarChartIcon
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
import ReportFormatModal from '../../shared/ReportFormatModal';
import { generateBankStatementPDF } from '../../../utils/pdfGenerator';
import { generateBankStatementExcel } from '../../../utils/excelGenerator';
import { formatFirstName } from '../IPManagement/IPManagement';
import BankLogo, { BankWatermark } from './BankLogo';
import '../PaymentCollection/PaymentCollection.css';

const EyeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const BanknotesIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const toDateStr = (dateVal) => {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    try {
      return dateVal.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }
  if (typeof dateVal === 'number') {
    try {
      return new Date(dateVal).toISOString().split('T')[0];
    } catch {
      return '';
    }
  }
  return String(dateVal).split('T')[0];
};

/**
 * SearchableFilterSelect Component
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    return (options || []).map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt, sublabel: '' };
      }
      return {
        value: opt.value ?? opt.label ?? '',
        label: opt.label ?? opt.value ?? '',
        sublabel: opt.sublabel || ''
      };
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    const q = search.toLowerCase().trim();
    return normalizedOptions.filter(opt =>
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      } else if (filteredOptions.length > 0) {
        onChange(filteredOptions[0].value);
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      } else if (allowCustomValue && search.trim()) {
        onChange(search.trim());
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      inputRef.current?.blur();
    }
  };

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
          {label}
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
          onKeyDown={handleKeyDown}
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
              className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                !value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>-- All Options --</span>
              {!value && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
            </button>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : isHighlighted
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="truncate">
                    <span className="font-medium">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="ml-1.5 text-[11px] text-gray-400">({opt.sublabel})</span>
                    )}
                  </div>
                  {isSelected && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-gray-400 italic text-center">
              No matching options
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Module tags color map
const MODULE_TAG_STYLES = {
  'Bank Deposit': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Bank Withdrawal': 'bg-rose-50 text-rose-700 border-rose-200',
  'Payment Collection': 'bg-teal-50 text-teal-700 border-teal-200',
  'Pay to Customer': 'bg-amber-50 text-amber-700 border-amber-200',
  'C&F Payment': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Insurance Payment': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Patty Cash': 'bg-orange-50 text-orange-700 border-orange-200',
  'Margin Return': 'bg-sky-50 text-sky-700 border-sky-200',
  'LC Margin & Bill': 'bg-purple-50 text-purple-700 border-purple-200',
  'LC Expense / Bill': 'bg-purple-50 text-purple-700 border-purple-200'
};

const Statement = ({ currentUser, onDeleteConfirm }) => {
  const user = currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const canShowEntryBy = hasPermission(user, 'bankStatement', 'showEntryBy') || hasPermission(user, 'bank', 'view');
  const canManageOpeningBalance = hasPermission(user, 'bankStatement', 'openingBalance') || hasPermission(user, 'bank', 'openingBalance');

  // Main Data States across all modules
  const [banks, setBanks] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cnfPayments, setCnfPayments] = useState([]);
  const [insurancePayments, setInsurancePayments] = useState([]);
  const [pattyCashRecords, setPattyCashRecords] = useState([]);
  const [marginReturns, setMarginReturns] = useState([]);
  const [lcExpenses, setLcExpenses] = useState([]);
  const [lcRecords, setLcRecords] = useState([]);
  const [employeesMap, setEmployeesMap] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(() => {
    const s = getSocket();
    return !!s?.connected;
  });

  // Active View Tab: 'accounts' (Default) | 'ledger'
  const [activeTab, setActiveTab] = useState('accounts');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [viewingTransaction, setViewingTransaction] = useState(null);

  const [filters, setFilters] = useState({
    bankName: '',
    branch: '',
    accountNo: '',
    sourceModule: 'all',    // 'all' | 'deposit' | 'withdrawal' | 'paymentCollection' | 'payToCustomer' | 'cnfPayment' | 'insurancePayment' | 'pattyCash' | 'marginReturn' | 'lcExpense'
    transactionType: 'all', // 'all' | 'deposit' (inflow) | 'withdrawal' (outflow)
    quickRange: 'all',      // 'all' | 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom'
    startDate: '',
    endDate: ''
  });

  // Sort State
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });

  // Opening Balance Modal State
  const [openingBalanceModal, setOpeningBalanceModal] = useState({
    isOpen: false,
    item: null,
    isActive: false,
    date: '',
    amount: '',
    isSaving: false
  });

  const handleOpenOpeningBalance = (accountOrBank) => {
    if (!canManageOpeningBalance) {
      alert('You do not have permission to manage Opening Balance Activation.');
      return;
    }
    if (!accountOrBank) return;
    const bName = accountOrBank.bankName;
    const targetBank = banks.find(b => (b.bankName || '').trim().toLowerCase() === (bName || '').trim().toLowerCase());
    if (!targetBank) return;

    const rawBranches = Array.isArray(targetBank.branches) && targetBank.branches.length > 0
      ? targetBank.branches
      : [{
          branch: targetBank.branch || '',
          accountName: targetBank.accountName || '',
          accountNo: targetBank.accountNo || ''
        }];

    let targetIdx = -1;
    if (accountOrBank.accountNo && accountOrBank.accountNo !== 'N/A') {
      targetIdx = rawBranches.findIndex(br => 
        (br.accountNo || '').trim().toLowerCase() === accountOrBank.accountNo.trim().toLowerCase()
      );
    }
    if (targetIdx === -1 && accountOrBank.branch && accountOrBank.branch !== 'Main Branch') {
      targetIdx = rawBranches.findIndex(br => 
        (br.branch || '').trim().toLowerCase() === accountOrBank.branch.trim().toLowerCase()
      );
    }
    if (targetIdx === -1) targetIdx = 0;

    const targetBranch = rawBranches[targetIdx] || rawBranches[0];
    const isAct = targetBranch.isOpeningBalanceActive !== undefined 
      ? !!targetBranch.isOpeningBalanceActive 
      : !!targetBank.isOpeningBalanceActive;
    const currDate = targetBranch.openingBalanceDate || targetBank.openingBalanceDate || new Date().toISOString().split('T')[0];
    const currAmt = targetBranch.openingBalance !== undefined 
      ? targetBranch.openingBalance 
      : (targetBank.openingBalance !== undefined ? targetBank.openingBalance : '');

    setOpeningBalanceModal({
      isOpen: true,
      item: {
        _id: targetBank._id,
        bankName: targetBank.bankName,
        branch: targetBranch.branch || targetBank.branch || 'Main Branch',
        accountName: targetBranch.accountName || targetBank.accountName || '',
        accountNo: targetBranch.accountNo || targetBank.accountNo || 'N/A',
        branchIndex: targetIdx,
        isOpeningBalanceActive: isAct
      },
      isActive: isAct,
      date: currDate ? toDateStr(currDate) : new Date().toISOString().split('T')[0],
      amount: currAmt !== '' ? currAmt : '',
      isSaving: false
    });
  };

  const handleOpenOpeningBalanceFromFilter = () => {
    if (!canManageOpeningBalance) {
      alert('You do not have permission to manage Opening Balance Activation.');
      return;
    }
    if (filters.bankName) {
      handleOpenOpeningBalance({
        bankName: filters.bankName,
        branch: filters.branch,
        accountNo: filters.accountNo
      });
    } else if (banks.length > 0) {
      handleOpenOpeningBalance({
        bankName: banks[0].bankName,
        branch: banks[0].branches?.[0]?.branch || '',
        accountNo: banks[0].branches?.[0]?.accountNo || ''
      });
    }
  };

  const handleSaveOpeningBalance = async (e, forceDeactivate = false) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!openingBalanceModal.item) return;
    if (!canManageOpeningBalance) {
      alert('You do not have permission to manage Opening Balance Activation.');
      return;
    }

    const willBeActive = forceDeactivate ? false : openingBalanceModal.isActive;

    if (willBeActive) {
      if (!openingBalanceModal.date) {
        alert('Please select an effective opening date.');
        return;
      }
      if (openingBalanceModal.amount === '' || isNaN(Number(openingBalanceModal.amount))) {
        alert('Please enter a valid opening balance amount.');
        return;
      }
    }

    setOpeningBalanceModal(prev => ({ ...prev, isSaving: true }));

    try {
      const item = openingBalanceModal.item;
      const targetBank = banks.find(b => b._id === item._id);
      if (!targetBank) throw new Error('Bank not found');

      const rawBranches = Array.isArray(targetBank.branches) && targetBank.branches.length > 0
        ? [...targetBank.branches]
        : [{
            branch: targetBank.branch || '',
            accountName: targetBank.accountName || '',
            accountNo: targetBank.accountNo || ''
          }];

      let targetIdx = item.branchIndex !== undefined ? item.branchIndex : -1;
      if (targetIdx === -1 || !rawBranches[targetIdx]) {
        targetIdx = rawBranches.findIndex(b =>
          (b.accountNo || '').trim().toLowerCase() === (item.accountNo || '').trim().toLowerCase() &&
          (b.branch || '').trim().toLowerCase() === (item.branch || '').trim().toLowerCase()
        );
      }
      if (targetIdx === -1) {
        targetIdx = rawBranches.findIndex(b =>
          (b.accountNo || '').trim().toLowerCase() === (item.accountNo || '').trim().toLowerCase()
        );
      }
      if (targetIdx === -1) targetIdx = 0;

      const updatedBranch = {
        ...rawBranches[targetIdx],
        isOpeningBalanceActive: willBeActive,
        openingBalance: willBeActive ? (Number(openingBalanceModal.amount) || 0) : (Number(rawBranches[targetIdx].openingBalance) || 0),
        openingBalanceDate: willBeActive ? openingBalanceModal.date : (rawBranches[targetIdx].openingBalanceDate || '')
      };

      const updatedBranches = [...rawBranches];
      updatedBranches[targetIdx] = updatedBranch;

      const payload = {
        ...targetBank,
        branches: updatedBranches,
        isOpeningBalanceActive: willBeActive,
        openingBalance: willBeActive ? (Number(openingBalanceModal.amount) || 0) : (Number(targetBank.openingBalance) || 0),
        openingBalanceDate: willBeActive ? openingBalanceModal.date : (targetBank.openingBalanceDate || '')
      };

      queryClient.setQueryData(['banks'], (old = []) => {
        return (old || []).map(b => b._id === targetBank._id ? payload : b);
      });
      setBanks(prev => prev.map(b => b._id === targetBank._id ? payload : b));

      await axios.put(`${API_BASE_URL}/api/banks/${targetBank._id}`, payload);
      queryClient.invalidateQueries({ queryKey: ['banks'] });
      fetchAllModuleData(true);

      setOpeningBalanceModal({ isOpen: false, item: null, isActive: false, date: '', amount: '', isSaving: false });
    } catch (err) {
      console.error('Error saving opening balance in Statement:', err);
      alert('Failed to update opening balance. Please try again.');
      setOpeningBalanceModal(prev => ({ ...prev, isSaving: false }));
    }
  };

  // Refs for outside click
  const filterPanelRef = useRef(null);
  const filterButtonRef = useRef(null);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showFilterPanel &&
        filterPanelRef.current &&
        !filterPanelRef.current.contains(event.target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(event.target)
      ) {
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterPanel]);

  // Unified Data Fetcher across all modules
  const fetchAllModuleData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [
        banksRes,
        depositsRes,
        withdrawalsRes,
        customersRes,
        cnfRes,
        insuranceRes,
        pattyRes,
        marginRes,
        lcExpRes,
        lcRecordsRes
      ] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/banks?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/deposits?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/withdrawals?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/customers?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/cnf-payments?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/insurance-payments?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/patty-cash?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/margin-returns?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/lc-expenses?_t=${Date.now()}`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/lc-management?_t=${Date.now()}`).catch(() => ({ data: [] }))
      ]);

      setBanks(Array.isArray(banksRes.data) ? banksRes.data : []);
      setDeposits(Array.isArray(depositsRes.data) ? depositsRes.data : []);
      setWithdrawals(Array.isArray(withdrawalsRes.data) ? withdrawalsRes.data : []);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setCnfPayments(Array.isArray(cnfRes.data) ? cnfRes.data : []);
      setInsurancePayments(Array.isArray(insuranceRes.data) ? insuranceRes.data : []);
      setPattyCashRecords(Array.isArray(pattyRes.data) ? pattyRes.data : []);
      setMarginReturns(Array.isArray(marginRes.data) ? marginRes.data : []);
      setLcExpenses(Array.isArray(lcExpRes.data) ? lcExpRes.data : []);
      setLcRecords(Array.isArray(lcRecordsRes.data) ? lcRecordsRes.data : []);
    } catch (err) {
      console.warn('Error fetching statement module data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Fetch Employees for resolving Entry By
  const fetchEmployees = async () => {
    try {
      const rawData = await queryClient.fetchQuery({
        queryKey: ['employees'],
        queryFn: () => axios.get(`${API_BASE_URL}/api/employees`).then(r => Array.isArray(r.data) ? r.data : [])
      });
      const map = {};
      rawData.forEach(emp => {
        let d = emp;
        if (emp && emp.data) {
          if (typeof emp.data === 'string') {
            try { d = { ...decryptData(emp.data), _id: emp._id }; } catch (e) {}
          } else if (typeof emp.data === 'object') {
            d = { ...emp.data, _id: emp._id };
          }
        }
        const rawFullName = (d.name || d.nameEn || d.fullName || '').trim();
        let rawFName = (d.firstName || '').trim();
        if (!rawFName && d.name) {
          const parts = d.name.trim().split(/\s+/);
          if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(parts[0].toLowerCase()) && parts.length > 1) {
            rawFName = `${parts[0]} ${parts[1]}`;
          } else {
            rawFName = parts[0];
          }
        }
        if (!rawFName && d.username) rawFName = d.username.trim();
        const fName = formatFirstName(rawFName || rawFullName);
        if (!fName) return;

        if (d.employeeId) map[d.employeeId.toLowerCase().trim()] = fName;
        if (d.username) map[d.username.toLowerCase().trim()] = fName;
        if (d._id) map[String(d._id)] = fName;
      });
      setEmployeesMap(map);
    } catch (err) {
      console.warn('Error fetching employees in Statement:', err);
    }
  };

  // Initial fetch and Realtime sync
  useEffect(() => {
    fetchAllModuleData();
    fetchEmployees();

    const socket = getSocket();
    const handleRealtimeUpdate = (detail) => {
      const mod = (detail?.module || '').toLowerCase();
      if ([
        'banks', 'bank', 'deposits', 'deposit', 'withdrawals', 'withdrawal',
        'customers', 'customer', 'payment-collection', 'paymentcollection',
        'pay-to-customer', 'paytocustomer', 'cnf-payments', 'cnf',
        'insurance-payments', 'insurance', 'patty-cash', 'pattycash',
        'margin-returns', 'margin-return', 'lc-expenses', 'lc-expense',
        'lc-management', 'lc', 'all'
      ].includes(mod)) {
        fetchAllModuleData(true);
      }
      if (mod === 'employees' || mod === 'employee' || mod === 'all') {
        fetchEmployees();
      }
    };

    const onCustomEvent = (e) => handleRealtimeUpdate(e?.detail);
    const onSocketStatus = (e) => {
      if (typeof e?.detail?.connected === 'boolean') setIsSocketConnected(e.detail.connected);
    };

    if (socket) {
      socket.on('connect', () => setIsSocketConnected(true));
      socket.on('disconnect', () => setIsSocketConnected(false));
      socket.on('data_updated', handleRealtimeUpdate);
    }
    window.addEventListener('erp_data_updated', onCustomEvent);
    window.addEventListener('erp_socket_status', onSocketStatus);

    const pollTimer = setInterval(() => {
      fetchAllModuleData(true);
    }, 30000);

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('data_updated', handleRealtimeUpdate);
      }
      window.removeEventListener('erp_data_updated', onCustomEvent);
      window.removeEventListener('erp_socket_status', onSocketStatus);
      clearInterval(pollTimer);
    };
  }, []);

  // AGGREGATE ALL TRANSACTIONS ACROSS ALL MODULES
  const unifiedTransactions = useMemo(() => {
    const list = [];

    // Helper to check valid bank method
    const isBankMethod = (method) => {
      if (!method) return false;
      const m = String(method).toLowerCase().trim();
      return m.includes('bank') || m.includes('cheque') || m.includes('online') || m.includes('rtgs') || m.includes('beftn') || m.includes('transfer');
    };

    // 1. Direct Bank Deposits
    deposits.forEach((d, dIdx) => {
      list.push({
        id: `dep-${d._id || d.id || dIdx}`,
        sourceModule: 'Bank Deposit',
        moduleKey: 'deposit',
        type: 'deposit', // Inflow (+)
        typeName: d.depositType || 'Cash Deposit',
        date: toDateStr(d.date || d.createdAt),
        bankName: (d.bankName || '').trim(),
        branch: (d.branch || '').trim(),
        accountNo: (d.accountNo || '').trim(),
        accountName: (d.accountName || '').trim(),
        amount: Number(d.amount) || 0,
        referenceNo: (d.referenceNo || '').trim(),
        partyOrPerson: (d.depositedBy || '').trim(),
        remarks: (d.remarks || d.note || '').trim(),
        createdBy: d.createdBy || d.entryBy || '',
        createdAt: d.createdAt || d.date || '',
        raw: d
      });
    });

    // 2. Direct Bank Withdrawals
    withdrawals.forEach((w, wIdx) => {
      list.push({
        id: `with-${w._id || w.id || wIdx}`,
        sourceModule: 'Bank Withdrawal',
        moduleKey: 'withdrawal',
        type: 'withdrawal', // Outflow (-)
        typeName: w.withdrawalType || 'Cash Withdrawal',
        date: toDateStr(w.date || w.createdAt),
        bankName: (w.bankName || '').trim(),
        branch: (w.branch || '').trim(),
        accountNo: (w.accountNo || '').trim(),
        accountName: (w.accountName || '').trim(),
        amount: Number(w.amount) || 0,
        referenceNo: (w.referenceNo || '').trim(),
        partyOrPerson: (w.withdrawnBy || '').trim(),
        remarks: (w.remarks || w.note || '').trim(),
        createdBy: w.createdBy || w.entryBy || '',
        createdAt: w.createdAt || w.date || '',
        raw: w
      });
    });

    // 3. Customer Payment Collections (Inflow into Bank)
    customers.forEach(customer => {
      const history = customer.paymentHistory || [];
      history.forEach((p, pIdx) => {
        const pStatus = (p.status || '').toLowerCase();
        if (pStatus === 'requested' || pStatus === 'rejected') return;

        const customerLabel = (customer.customerName || customer.companyName || 'Customer').trim();

        // Check if payment has itemized breakdown
        if (Array.isArray(p.items) && p.items.length > 0) {
          p.items.forEach((item, itemIdx) => {
            const hasBank = (item.bankName && item.bankName.trim()) || (p.bankName && p.bankName.trim()) || isBankMethod(item.method || p.method);
            if (!hasBank) return;

            const bName = (item.bankName || p.bankName || '').trim();
            const amt = Number(item.amount) || 0;
            if (amt <= 0) return;

            list.push({
              id: `pc-${customer._id}-${p.id || p._id || p.receiptNo || pIdx}-${itemIdx}`,
              sourceModule: 'Payment Collection',
              moduleKey: 'paymentCollection',
              type: 'deposit', // Inflow (+)
              typeName: item.method || p.method || 'Bank Collection',
              date: toDateStr(p.date || p.createdAt),
              bankName: bName,
              branch: (item.branch || p.branch || '').trim(),
              accountNo: (item.accountNo || p.accountNo || '').trim(),
              accountName: (customer.companyName || customer.customerName || '').trim(),
              amount: amt,
              referenceNo: (p.receiptNo || p.reference || item.reference || '').trim(),
              partyOrPerson: customerLabel,
              remarks: (p.remarks || p.note || '').trim(),
              createdBy: p.createdBy || p.entryBy || '',
              createdAt: p.createdAt || p.date || '',
              raw: { ...p, ...item, customer }
            });
          });
        } else {
          const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.method);
          if (!hasBank) return;

          const amt = Number(p.amount) || 0;
          if (amt <= 0) return;

          list.push({
            id: `pc-${customer._id}-${p.id || p._id || p.receiptNo || pIdx}`,
            sourceModule: 'Payment Collection',
            moduleKey: 'paymentCollection',
            type: 'deposit', // Inflow (+)
            typeName: p.method || 'Bank Collection',
            date: toDateStr(p.date || p.createdAt),
            bankName: (p.bankName || '').trim(),
            branch: (p.branch || '').trim(),
            accountNo: (p.accountNo || '').trim(),
            accountName: (customer.companyName || customer.customerName || '').trim(),
            amount: amt,
            referenceNo: (p.receiptNo || p.reference || '').trim(),
            partyOrPerson: customerLabel,
            remarks: (p.remarks || p.note || '').trim(),
            createdBy: p.createdBy || p.entryBy || '',
            createdAt: p.createdAt || p.date || '',
            raw: { ...p, customer }
          });
        }
      });
    });

    // 4. Pay To Customer (Refunds / Outflow from Bank)
    customers.forEach(customer => {
      const history = customer.payToCustomerHistory || [];
      history.forEach((p, pIdx) => {
        const pStatus = (p.status || '').toLowerCase();
        if (pStatus === 'requested' || pStatus === 'rejected') return;

        const customerLabel = (customer.customerName || customer.companyName || 'Customer').trim();

        if (Array.isArray(p.items) && p.items.length > 0) {
          p.items.forEach((item, itemIdx) => {
            const hasBank = (item.bankName && item.bankName.trim()) || (p.bankName && p.bankName.trim()) || isBankMethod(item.method || p.method);
            if (!hasBank) return;

            const bName = (item.bankName || p.bankName || '').trim();
            const amt = Number(item.amount || item.paid || item.paidAmount) || 0;
            if (amt <= 0) return;

            list.push({
              id: `ptc-${customer._id}-${p.id || p._id || p.receiptNo || pIdx}-${itemIdx}`,
              sourceModule: 'Pay to Customer',
              moduleKey: 'payToCustomer',
              type: 'withdrawal', // Outflow (-)
              typeName: item.method || p.method || 'Customer Payout',
              date: toDateStr(p.date || p.createdAt),
              bankName: bName,
              branch: (item.branch || p.branch || '').trim(),
              accountNo: (item.accountNo || p.accountNo || '').trim(),
              accountName: (customer.companyName || customer.customerName || '').trim(),
              amount: amt,
              referenceNo: (p.receiptNo || p.reference || item.reference || '').trim(),
              partyOrPerson: customerLabel,
              remarks: (p.remarks || p.note || '').trim(),
              createdBy: p.createdBy || p.entryBy || '',
              createdAt: p.createdAt || p.date || '',
              raw: { ...p, ...item, customer }
            });
          });
        } else {
          const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.method);
          if (!hasBank) return;

          const amt = Number(p.amount || p.paid || p.paidAmount) || 0;
          if (amt <= 0) return;

          list.push({
            id: `ptc-${customer._id}-${p.id || p._id || p.receiptNo || pIdx}`,
            sourceModule: 'Pay to Customer',
            moduleKey: 'payToCustomer',
            type: 'withdrawal', // Outflow (-)
            typeName: p.method || 'Customer Payout',
            date: toDateStr(p.date || p.createdAt),
            bankName: (p.bankName || '').trim(),
            branch: (p.branch || '').trim(),
            accountNo: (p.accountNo || '').trim(),
            accountName: (customer.companyName || customer.customerName || '').trim(),
            amount: amt,
            referenceNo: (p.receiptNo || p.reference || '').trim(),
            partyOrPerson: customerLabel,
            remarks: (p.remarks || p.note || '').trim(),
            createdBy: p.createdBy || p.entryBy || '',
            createdAt: p.createdAt || p.date || '',
            raw: { ...p, customer }
          });
        }
      });
    });

    // 5. C&F Payments (Outflow from Bank)
    cnfPayments.forEach((p, pIdx) => {
      const pStatus = (p.status || '').toLowerCase();
      if (pStatus === 'requested' || pStatus === 'rejected') return;

      const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.method);
      if (!hasBank) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `cnf-${p._id || p.id || pIdx}`,
        sourceModule: 'C&F Payment',
        moduleKey: 'cnfPayment',
        type: 'withdrawal', // Outflow (-)
        typeName: p.method || 'C&F Bank Payment',
        date: toDateStr(p.date || p.createdAt),
        bankName: (p.bankName || '').trim(),
        branch: (p.branch || '').trim(),
        accountNo: (p.accountNo || '').trim(),
        accountName: '',
        amount: amt,
        referenceNo: (p.reference || '').trim(),
        partyOrPerson: (p.cnfName || p.agentName || 'C&F Agent').trim(),
        remarks: (p.remarks || p.note || '').trim(),
        createdBy: p.createdBy || p.entryBy || '',
        createdAt: p.createdAt || p.date || '',
        raw: p
      });
    });

    // 6. Insurance Payments (Outflow from Bank)
    insurancePayments.forEach((p, pIdx) => {
      const pStatus = (p.status || '').toLowerCase();
      if (pStatus === 'requested' || pStatus === 'rejected') return;

      const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.method);
      if (!hasBank) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `ins-${p._id || p.id || pIdx}`,
        sourceModule: 'Insurance Payment',
        moduleKey: 'insurancePayment',
        type: 'withdrawal', // Outflow (-)
        typeName: p.method || 'Insurance Bank Payment',
        date: toDateStr(p.date || p.createdAt),
        bankName: (p.bankName || '').trim(),
        branch: (p.branch || '').trim(),
        accountNo: (p.accountNo || '').trim(),
        accountName: '',
        amount: amt,
        referenceNo: (p.reference || '').trim(),
        partyOrPerson: (p.companyName || 'Insurance Company').trim(),
        remarks: (p.remarks || p.note || '').trim(),
        createdBy: p.createdBy || p.entryBy || '',
        createdAt: p.createdAt || p.date || '',
        raw: p
      });
    });

    // 7. Patty Cash Transactions (Inflows / Outflows involving Bank)
    pattyCashRecords.forEach((p, pIdx) => {
      const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.paymentMode);
      if (!hasBank) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      const isDepositToBank = (p.category || '').toLowerCase().includes('deposit');
      const isBankWithdrawalToPatty = p.type === 'inflow' || (p.category || '').toLowerCase().includes('withdrawal');

      list.push({
        id: `patty-${p._id || p.id || pIdx}`,
        sourceModule: 'Patty Cash',
        moduleKey: 'pattyCash',
        type: isDepositToBank ? 'deposit' : 'withdrawal',
        typeName: p.paymentMode || (isDepositToBank ? 'Bank Deposit' : 'Bank Replenishment'),
        date: toDateStr(p.date || p.createdAt),
        bankName: (p.bankName || '').trim(),
        branch: (p.branch || '').trim(),
        accountNo: (p.accountNo || '').trim(),
        accountName: '',
        amount: amt,
        referenceNo: (p.voucherNo || '').trim(),
        partyOrPerson: (p.partyOrPerson || (isBankWithdrawalToPatty ? 'Patty Cash Replenishment' : p.category) || 'Patty Cash').trim(),
        remarks: (p.remarks || p.category || '').trim(),
        createdBy: p.createdBy || p.entryBy || '',
        createdAt: p.createdAt || p.date || '',
        raw: p
      });
    });

    // 8. Margin Returns (Inflow / Refund into Bank)
    marginReturns.forEach((p, pIdx) => {
      const amt = Number(p.returnAmount || p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `mr-${p._id || p.id || pIdx}`,
        sourceModule: 'Margin Return',
        moduleKey: 'marginReturn',
        type: 'deposit', // Inflow (+)
        typeName: 'Margin Refund',
        date: toDateStr(p.returnDate || p.date || p.createdAt),
        bankName: (p.bankName || '').trim(),
        branch: (p.branch || '').trim(),
        accountNo: (p.accountNo || '').trim(),
        accountName: '',
        amount: amt,
        referenceNo: (p.lcNo ? `LC: ${p.lcNo}` : '').trim(),
        partyOrPerson: (p.importerName ? `Importer: ${p.importerName}` : 'Bank Margin Return').trim(),
        remarks: (p.remarks || `LC Margin Return for LC: ${p.lcNo || ''}`).trim(),
        createdBy: p.createdBy || p.entryBy || '',
        createdAt: p.createdAt || p.date || '',
        raw: p
      });
    });

    // 9. LC Margin, Bank Charges & LC Bills (Outflow from Bank)
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const lcMap = new Map();
    lcRecords.forEach(lc => {
      const clean = cleanLc(lc.lcNo);
      if (clean) lcMap.set(clean, lc);
    });

    // 9a. LC Opening Margin Paid & Bank Charges directly from LC Management
    lcRecords.forEach((lc, lcIdx) => {
      const bName = (lc.bankName || lc.bank || '').trim();
      if (!bName) return;

      const importer = (lc.importerName || lc.importer || 'LC Opening').trim();
      const openDate = toDateStr(lc.openingDate || lc.date || lc.createdAt);
      const lcBranch = (lc.bankBranch || lc.branch || '').trim();

      // Resolve accountNo if not explicitly saved on LC
      let lcAccountNo = (lc.accountNo || '').trim();
      if (!lcAccountNo && bName) {
        const foundBank = banks.find(b => (b.bankName || '').trim().toLowerCase() === bName.toLowerCase());
        if (foundBank && Array.isArray(foundBank.branches)) {
          const brMatch = foundBank.branches.find(br => 
            lcBranch && (br.branch || '').trim().toLowerCase() === lcBranch.toLowerCase()
          );
          if (brMatch && brMatch.accountNo) {
            lcAccountNo = brMatch.accountNo;
          } else if (foundBank.branches.length === 1 && foundBank.branches[0].accountNo) {
            lcAccountNo = foundBank.branches[0].accountNo;
          }
        }
      }

      // Opening Margin Paid (Outflow from bank)
      const isAdj = !!lc.enableValueQtyAdjustment;
      const origMarginBill = isAdj && lc.adjustedTotalAmount !== undefined
        ? (parseFloat(lc.marginBill) || parseFloat(lc.adjustedTotalAmount) || 0)
        : (parseFloat(lc.marginBill) || parseFloat(lc.totalAmount) || 0);
      const marginPaidAmt = isAdj && lc.adjustedTotalAmount !== undefined
        ? (parseFloat(lc.marginPaid) || (origMarginBill * ((parseFloat(lc.bankMargin) || 0) / 100)))
        : (parseFloat(lc.marginPaid) || (origMarginBill * ((parseFloat(lc.bankMargin) || 0) / 100)));

      if (marginPaidAmt > 0) {
        list.push({
          id: `lc-open-margin-${lc._id || lc.id || lcIdx}`,
          sourceModule: 'LC Margin & Bill',
          moduleKey: 'lcExpense',
          type: 'withdrawal', // Outflow (-)
          typeName: 'LC Margin Paid (Opening)',
          date: openDate,
          bankName: bName,
          branch: lcBranch,
          accountNo: lcAccountNo,
          accountName: '',
          amount: marginPaidAmt,
          referenceNo: (lc.lcNo ? `LC: ${lc.lcNo}` : '').trim(),
          partyOrPerson: importer,
          remarks: (lc.remarks || `Opening LC Margin Paid for LC: ${lc.lcNo || ''}`).trim(),
          createdBy: lc.entryBy || lc.createdBy || '',
          createdAt: lc.createdAt || lc.openingDate || '',
          raw: lc
        });
      }

      // Opening Bank Bill / Charges (Outflow from bank)
      const isNewBilling = lc.marginPaid !== undefined || lc.marginBill !== undefined;
      const origBankBill = isNewBilling
        ? (parseFloat(lc.bankBill) || 0)
        : (parseFloat(lc.totalBankBill || lc.bankBill) || 0);
      const bankPaidAmt = parseFloat(lc.bankPaid) || origBankBill;

      if (bankPaidAmt > 0) {
        list.push({
          id: `lc-open-charge-${lc._id || lc.id || lcIdx}`,
          sourceModule: 'LC Margin & Bill',
          moduleKey: 'lcExpense',
          type: 'withdrawal', // Outflow (-)
          typeName: 'LC Bank Charges (Opening)',
          date: openDate,
          bankName: bName,
          branch: lcBranch,
          accountNo: lcAccountNo,
          accountName: '',
          amount: bankPaidAmt,
          referenceNo: (lc.lcNo ? `LC: ${lc.lcNo}` : '').trim(),
          partyOrPerson: importer,
          remarks: (lc.remarks || `Opening Bank Charges for LC: ${lc.lcNo || ''}`).trim(),
          createdBy: lc.entryBy || lc.createdBy || '',
          createdAt: lc.createdAt || lc.openingDate || '',
          raw: lc
        });
      }

      // Amendments
      const amendments = Array.isArray(lc.amendments) ? lc.amendments : [];
      amendments.forEach((amnd, idx) => {
        if (amnd.amendmentNo === 'Original LC') return;
        const amndDate = toDateStr(amnd.amendmentDate || lc.openingDate || lc.createdAt);
        const amndLabel = amnd.amendmentNo || `Amend #${idx + 1}`;

        const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
        const amndMargin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (parseFloat(lc.bankMargin) || 0);
        const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (amndMarginBill * (amndMargin / 100));

        if (amndMarginPaid > 0) {
          list.push({
            id: `lc-amnd-margin-${lc._id || lc.id}-${idx}`,
            sourceModule: 'LC Margin & Bill',
            moduleKey: 'lcExpense',
            type: 'withdrawal', // Outflow (-)
            typeName: `Amendment Margin Paid (${amndLabel})`,
            date: amndDate,
            bankName: bName,
            branch: lcBranch,
            accountNo: lcAccountNo,
            accountName: '',
            amount: amndMarginPaid,
            referenceNo: (lc.lcNo ? `LC: ${lc.lcNo}` : '').trim(),
            partyOrPerson: importer,
            remarks: `Amendment Margin Paid for LC: ${lc.lcNo || ''}`,
            createdBy: amnd.entryBy || lc.entryBy || lc.createdBy || '',
            createdAt: amnd.createdAt || amnd.amendmentDate || lc.createdAt || '',
            raw: { ...lc, amendment: amnd }
          });
        }

        const isAmndNewBilling = amnd.amendmentMarginPaid !== undefined || amnd.amendmentMarginBill !== undefined;
        const amndBankBill = isAmndNewBilling
          ? (parseFloat(amnd.amendmentBankBill) || 0)
          : (parseFloat(amnd.totalAmendmentBankBill || amnd.amendmentBill || amnd.amendmentBankBill) || 0);
        const amndBankPaid = parseFloat(amnd.amendmentBankPaid) || amndBankBill;

        if (amndBankPaid > 0) {
          list.push({
            id: `lc-amnd-charge-${lc._id || lc.id}-${idx}`,
            sourceModule: 'LC Margin & Bill',
            moduleKey: 'lcExpense',
            type: 'withdrawal', // Outflow (-)
            typeName: `Amendment Bank Charges (${amndLabel})`,
            date: amndDate,
            bankName: bName,
            branch: lcBranch,
            accountNo: lcAccountNo,
            accountName: '',
            amount: amndBankPaid,
            referenceNo: (lc.lcNo ? `LC: ${lc.lcNo}` : '').trim(),
            partyOrPerson: importer,
            remarks: `Amendment Bank Charges for LC: ${lc.lcNo || ''}`,
            createdBy: amnd.entryBy || lc.entryBy || lc.createdBy || '',
            createdAt: amnd.createdAt || amnd.amendmentDate || lc.createdAt || '',
            raw: { ...lc, amendment: amnd }
          });
        }
      });
    });

    // 9b. LC Expenses & Custom Bills from /api/lc-expenses
    lcExpenses.forEach((p, pIdx) => {
      if (p.type === 'bill') return; // Exclude pending/unpaid bills
      const matchedLc = p.lcNo ? lcMap.get(cleanLc(p.lcNo)) : null;
      const bName = (p.bankName || matchedLc?.bankName || matchedLc?.bank || '').trim();
      const isBankHead = (p.expenseHead === 'Bank Charges' || p.expenseHead === 'Margin Bill' || bName);
      if (!isBankHead) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `lc-exp-${p._id || p.id || pIdx}`,
        sourceModule: 'LC Margin & Bill',
        moduleKey: 'lcExpense',
        type: 'withdrawal', // Outflow (-)
        typeName: p.expenseHead || 'LC Bank Charge',
        date: toDateStr(p.date || p.createdAt),
        bankName: bName,
        branch: (p.branch || matchedLc?.bankBranch || matchedLc?.branch || '').trim(),
        accountNo: (p.accountNo || matchedLc?.accountNo || '').trim(),
        accountName: '',
        amount: amt,
        referenceNo: (p.lcNo ? `LC: ${p.lcNo}` : '').trim(),
        partyOrPerson: (matchedLc?.importerName || matchedLc?.importer || p.expenseHead || 'Bank Charge').trim(),
        remarks: (p.remarks || `LC No: ${p.lcNo || ''}`).trim(),
        createdBy: p.createdBy || p.entryBy || '',
        createdAt: p.createdAt || p.date || '',
        raw: p
      });
    });

    return list;
  }, [deposits, withdrawals, customers, cnfPayments, insurancePayments, pattyCashRecords, marginReturns, lcExpenses, lcRecords, banks]);

  // Unique BD bank names across all sources
  const uniqueBankNames = useMemo(() => {
    const seen = new Map();
    [
      ...banks.filter(b => !b.isIndian).map(b => b.bankName),
      ...unifiedTransactions.map(tx => tx.bankName)
    ].forEach(name => {
      if (!name) return;
      const clean = name.trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.set(lower, clean);
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [banks, unifiedTransactions]);

  // Branches list (filtered by selected bank)
  const filterBranchesList = useMemo(() => {
    const list = [];
    const targetBank = filters.bankName ? filters.bankName.trim().toLowerCase() : null;

    banks.filter(b => !b.isIndian).forEach(b => {
      if (targetBank && (b.bankName || '').trim().toLowerCase() !== targetBank) return;
      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          if (br && br.branch) list.push(br.branch.trim());
        });
      } else if (b.branch) {
        list.push(b.branch.trim());
      }
    });

    unifiedTransactions.forEach(tx => {
      if (targetBank && (tx.bankName || '').trim().toLowerCase() !== targetBank) return;
      if (tx.branch) list.push(tx.branch.trim());
    });

    const seen = new Set();
    return list.filter(br => {
      const lower = br.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    }).sort((a, b) => a.localeCompare(b));
  }, [banks, unifiedTransactions, filters.bankName]);

  // Accounts list (filtered by selected bank and branch)
  const filterAccountsList = useMemo(() => {
    const targetBank = filters.bankName ? filters.bankName.trim().toLowerCase() : null;
    const targetBranch = filters.branch ? filters.branch.trim().toLowerCase() : null;
    const map = new Map();

    banks.filter(b => !b.isIndian).forEach(b => {
      if (targetBank && (b.bankName || '').trim().toLowerCase() !== targetBank) return;
      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          if (targetBranch && (br.branch || '').trim().toLowerCase() !== targetBranch) return;
          if (br.accountNo && !map.has(br.accountNo)) {
            map.set(br.accountNo, br.accountName || b.accountName || '');
          }
        });
      } else if (b.accountNo) {
        if (targetBranch && (b.branch || '').trim().toLowerCase() !== targetBranch) return;
        if (!map.has(b.accountNo)) {
          map.set(b.accountNo, b.accountName || '');
        }
      }
    });

    unifiedTransactions.forEach(tx => {
      if (targetBank && (tx.bankName || '').trim().toLowerCase() !== targetBank) return;
      if (targetBranch && (tx.branch || '').trim().toLowerCase() !== targetBranch) return;
      if (tx.accountNo && !map.has(tx.accountNo)) {
        map.set(tx.accountNo, tx.accountName || '');
      }
    });

    return Array.from(map.entries()).map(([accountNo, accountName]) => ({
      accountNo,
      accountName
    }));
  }, [banks, unifiedTransactions, filters.bankName, filters.branch]);

  // Quick Date Range Handler
  const handleQuickRange = (rangeKey) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let start = '';
    let end = todayStr;

    if (rangeKey === 'all') {
      start = '';
      end = '';
    } else if (rangeKey === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (rangeKey === 'yesterday') {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      start = yStr;
      end = yStr;
    } else if (rangeKey === 'thisWeek') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      start = monday.toISOString().split('T')[0];
      end = todayStr;
    } else if (rangeKey === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      start = firstDay.toISOString().split('T')[0];
      end = todayStr;
    } else if (rangeKey === 'lastMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
    } else if (rangeKey === 'thisYear') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      start = firstDay.toISOString().split('T')[0];
      end = todayStr;
    }

    setFilters(prev => ({
      ...prev,
      quickRange: rangeKey,
      startDate: start,
      endDate: end
    }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      quickRange: (field === 'startDate' || field === 'endDate') ? 'custom' : prev.quickRange
    }));
  };

  const resetFilters = () => {
    setFilters({
      bankName: '',
      branch: '',
      accountNo: '',
      sourceModule: 'all',
      transactionType: 'all',
      quickRange: 'all',
      startDate: '',
      endDate: ''
    });
    setSearchQuery('');
  };

  const isFilterActive = useMemo(() => {
    return Boolean(
      filters.bankName ||
      filters.branch ||
      filters.accountNo ||
      (filters.sourceModule && filters.sourceModule !== 'all') ||
      (filters.transactionType && filters.transactionType !== 'all') ||
      filters.startDate ||
      filters.endDate ||
      (filters.quickRange && filters.quickRange !== 'all')
    );
  }, [filters]);

  const _activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.bankName) count++;
    if (filters.branch) count++;
    if (filters.accountNo) count++;
    if (filters.sourceModule && filters.sourceModule !== 'all') count++;
    if (filters.transactionType && filters.transactionType !== 'all') count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
  }, [filters]);

  // Map of active baselines by account & bank
  const accountBaselineMap = useMemo(() => {
    const map = new Map();
    const norm = (v) => (v || '').trim().toLowerCase();

    banks.filter(b => !b.isIndian).forEach(b => {
      const bName = norm(b.bankName);
      if (!bName) return;

      const rawBranches = Array.isArray(b.branches) && b.branches.length > 0
        ? b.branches
        : [{
            branch: b.branch || '',
            accountName: b.accountName || '',
            accountNo: b.accountNo || '',
            openingBalance: b.openingBalance,
            openingBalanceDate: b.openingBalanceDate,
            isOpeningBalanceActive: b.isOpeningBalanceActive
          }];

      let bankEarliestActiveDate = null;
      let bankTotalActiveBalance = 0;
      let bankHasAnyActive = false;

      rawBranches.forEach(br => {
        const brName = norm(br.branch);
        const accNo = norm(br.accountNo);
        const isAct = br.isOpeningBalanceActive !== undefined ? !!br.isOpeningBalanceActive : !!b.isOpeningBalanceActive;
        const rawDate = br.openingBalanceDate || b.openingBalanceDate;
        const openDate = rawDate ? toDateStr(rawDate) : null;
        const rawBal = br.openingBalance !== undefined ? br.openingBalance : b.openingBalance;
        const openBal = Number(rawBal) || 0;

        const info = {
          isActive: isAct && !!openDate,
          date: openDate,
          openingBalance: openBal,
          bankName: b.bankName,
          branch: br.branch,
          accountNo: br.accountNo,
          bankId: b._id
        };

        if (info.isActive) {
          bankHasAnyActive = true;
          bankTotalActiveBalance += openBal;
          if (!bankEarliestActiveDate || (openDate && openDate < bankEarliestActiveDate)) {
            bankEarliestActiveDate = openDate;
          }
        }

        if (accNo) {
          if (brName) map.set(bName + "__" + brName + "__" + accNo, info);
          map.set(bName + "__" + accNo, info);
          map.set(accNo, info);
        }
        if (brName) {
          if (!map.has(bName + "__" + brName) || info.isActive) {
            map.set(bName + "__" + brName, info);
          }
        }
      });

      // Bank-level active baseline entry
      const bankLevelAct = !!b.isOpeningBalanceActive && !!b.openingBalanceDate;
      const bankDate = bankLevelAct ? toDateStr(b.openingBalanceDate) : bankEarliestActiveDate;
      const bankBal = bankLevelAct ? (Number(b.openingBalance) || 0) : bankTotalActiveBalance;

      const bankInfo = {
        isActive: bankLevelAct || bankHasAnyActive,
        date: bankDate,
        openingBalance: bankBal,
        bankName: b.bankName,
        branch: '',
        accountNo: '',
        bankId: b._id
      };

      if (!map.has(bName) || bankInfo.isActive) {
        map.set(bName, bankInfo);
      }
    });

    return map;
  }, [banks]);

  // Account, Module & Date filtering + Running Balance Calculation
  const { periodOpeningBalance, ledgerRows, periodTotals, effectiveOpeningDate, scopeBaseline } = useMemo(() => {
    const norm = (v) => (v || '').trim().toLowerCase();
    const targetBank = filters.bankName ? norm(filters.bankName) : null;
    const targetBranch = filters.branch ? norm(filters.branch) : null;
    const targetAcc = filters.accountNo ? norm(filters.accountNo) : null;
    const targetModule = filters.sourceModule && filters.sourceModule !== 'all' ? filters.sourceModule : null;

    // Helper to get baseline for a specific bank + branch + account
    const getTxBaseline = (bName, brName, accNo) => {
      const bKey = norm(bName);
      const brKey = norm(brName);
      const accKey = norm(accNo);

      if (bKey && brKey && accKey) {
        const val = accountBaselineMap.get(bKey + "__" + brKey + "__" + accKey);
        if (val) return val;
      }
      if (bKey && accKey) {
        const val = accountBaselineMap.get(bKey + "__" + accKey);
        if (val) return val;
      }
      if (accKey) {
        const val = accountBaselineMap.get(accKey);
        if (val) return val;
      }
      if (bKey && brKey) {
        const val = accountBaselineMap.get(bKey + "__" + brKey);
        if (val) return val;
      }
      if (bKey) {
        const val = accountBaselineMap.get(bKey);
        if (val) return val;
      }
      return null;
    };

    // 1. Identify targeted accounts in scope
    const targetedAccounts = [];
    banks.filter(b => !b.isIndian).forEach(b => {
      const bNameMatch = !targetBank || norm(b.bankName) === targetBank;
      if (!bNameMatch) return;

      const rawBranches = Array.isArray(b.branches) && b.branches.length > 0
        ? b.branches
        : [{
            branch: b.branch || '',
            accountName: b.accountName || '',
            accountNo: b.accountNo || '',
            openingBalance: b.openingBalance,
            openingBalanceDate: b.openingBalanceDate,
            isOpeningBalanceActive: b.isOpeningBalanceActive
          }];

      rawBranches.forEach(br => {
        const brMatch = !targetBranch || norm(br.branch) === targetBranch;
        const accMatch = !targetAcc || norm(br.accountNo) === targetAcc;
        if (brMatch && accMatch) {
          const baseline = getTxBaseline(b.bankName, br.branch, br.accountNo);
          targetedAccounts.push({
            bankName: b.bankName,
            branch: br.branch,
            accountNo: br.accountNo,
            accountName: br.accountName,
            baseline
          });
        }
      });
    });

    // 2. Active baseline for current filtered scope
    let currentScopeBaseline = null;
    if (targetAcc) {
      currentScopeBaseline = getTxBaseline(filters.bankName, filters.branch, filters.accountNo);
    } else if (targetBranch && targetBank) {
      currentScopeBaseline = getTxBaseline(filters.bankName, filters.branch, '');
    } else if (targetBank) {
      currentScopeBaseline = getTxBaseline(filters.bankName, '', '');
    }

    const scopeCutoffDate = (currentScopeBaseline?.isActive && currentScopeBaseline.date) ? currentScopeBaseline.date : null;

    // 3. Compute base starting balance sum across targeted accounts
    let baseStartingBal = 0;
    let effectiveActiveBaselineDate = null;

    if (currentScopeBaseline?.isActive) {
      baseStartingBal = currentScopeBaseline.openingBalance;
      effectiveActiveBaselineDate = currentScopeBaseline.date;
    } else if (targetedAccounts.length === 1 && targetedAccounts[0].baseline?.isActive) {
      baseStartingBal = targetedAccounts[0].baseline.openingBalance;
      effectiveActiveBaselineDate = targetedAccounts[0].baseline.date;
    } else {
      targetedAccounts.forEach(acc => {
        if (acc.baseline?.isActive) {
          baseStartingBal += acc.baseline.openingBalance;
          if (!effectiveActiveBaselineDate || (acc.baseline.date && acc.baseline.date < effectiveActiveBaselineDate)) {
            effectiveActiveBaselineDate = acc.baseline.date;
          }
        } else {
          const rawBal = banks.find(b => norm(b.bankName) === norm(acc.bankName))?.branches?.find(br => norm(br.accountNo) === norm(acc.accountNo))?.openingBalance;
          baseStartingBal += (Number(rawBal) || 0);
        }
      });
    }

    if (baseStartingBal === 0 && currentScopeBaseline?.openingBalance) {
      baseStartingBal = currentScopeBaseline.openingBalance;
    }

    // 4. Filter transactions
    const startFilter = filters.startDate ? toDateStr(filters.startDate) : null;
    const endFilter = filters.endDate ? toDateStr(filters.endDate) : null;

    const matchedTx = unifiedTransactions.filter(tx => {
      if (targetBank && norm(tx.bankName) !== targetBank) return false;
      if (targetBranch && tx.branch && norm(tx.branch) !== targetBranch) return false;
      if (targetAcc && tx.accountNo && norm(tx.accountNo) !== targetAcc) return false;
      if (targetModule && tx.moduleKey !== targetModule) return false;

      // Rule A: If current filter view has an active opening balance cutoff date,
      // strictly suppress ANY transaction before that date!
      if (scopeCutoffDate && tx.date < scopeCutoffDate) {
        return false;
      }

      // Rule B: If the transaction's specific bank/account has an active baseline,
      // strictly suppress if before its active opening date!
      const txBaseline = getTxBaseline(tx.bankName, tx.branch, tx.accountNo);
      if (txBaseline && txBaseline.isActive && txBaseline.date) {
        if (tx.date < txBaseline.date) {
          return false;
        }
      }

      return true;
    });

    // 5. Separate prior vs in-period transactions
    let openingBal = baseStartingBal;
    const inPeriodTx = [];

    matchedTx.forEach(tx => {
      const txDate = tx.date;

      if (startFilter && txDate < startFilter) {
        if (tx.type === 'deposit') {
          openingBal += tx.amount;
        } else {
          openingBal -= tx.amount;
        }
      } else if (endFilter && txDate > endFilter) {
        // After end date
      } else {
        inPeriodTx.push(tx);
      }
    });

    // 6. Chronological sorting
    inPeriodTx.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });

    // 7. Running Balance Calculation
    let currentBal = openingBal;
    let sumDeposits = 0;
    let sumWithdrawals = 0;

    const computedRows = inPeriodTx.map((tx, idx) => {
      if (tx.type === 'deposit') {
        currentBal += tx.amount;
        sumDeposits += tx.amount;
      } else {
        currentBal -= tx.amount;
        sumWithdrawals += tx.amount;
      }
      return {
        ...tx,
        sl: idx + 1,
        runningBalance: currentBal
      };
    });

    // Determine effective opening date to show on baseline forward row
    const effectiveOpDate = filters.startDate
      ? filters.startDate
      : (effectiveActiveBaselineDate || scopeCutoffDate || null);

    return {
      periodOpeningBalance: openingBal,
      ledgerRows: computedRows,
      periodTotals: {
        totalDeposits: sumDeposits,
        totalWithdrawals: sumWithdrawals,
        netMovement: sumDeposits - sumWithdrawals,
        closingBalance: currentBal,
        count: computedRows.length
      },
      effectiveOpeningDate: effectiveOpDate,
      scopeBaseline: currentScopeBaseline
    };
  }, [unifiedTransactions, banks, accountBaselineMap, filters.bankName, filters.branch, filters.accountNo, filters.sourceModule, filters.startDate, filters.endDate]);

  // Search query & Transaction Type filtering
  const filteredLedger = useMemo(() => {
    return ledgerRows.filter(row => {
      if (filters.transactionType === 'deposit' && row.type !== 'deposit') return false;
      if (filters.transactionType === 'withdrawal' && row.type !== 'withdrawal') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          row.sourceModule.toLowerCase().includes(q) ||
          row.bankName.toLowerCase().includes(q) ||
          row.branch.toLowerCase().includes(q) ||
          row.accountNo.toLowerCase().includes(q) ||
          row.accountName.toLowerCase().includes(q) ||
          row.referenceNo.toLowerCase().includes(q) ||
          row.partyOrPerson.toLowerCase().includes(q) ||
          row.remarks.toLowerCase().includes(q) ||
          row.typeName.toLowerCase().includes(q) ||
          String(row.amount).includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [ledgerRows, filters.transactionType, searchQuery]);

  // Display sorted rows based on user column click
  const displayLedger = useMemo(() => {
    if (!sortConfig.key) return filteredLedger;
    const sorted = [...filteredLedger];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'amount' || sortConfig.key === 'runningBalance' || sortConfig.key === 'sl') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredLedger, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Bank Accounts Overview (Aggregated Multi-Module Summary of each BD bank account, sorted alphabetically ascending)
  const bankAccountsOverview = useMemo(() => {
    const accounts = [];
    const norm = (v) => (v || '').trim().toLowerCase();
    const bdBanks = banks.filter(b => !b.isIndian);

    bdBanks.forEach(b => {
      const bName = (b.bankName || '').trim();
      if (!bName) return;

      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          const brName = (br.branch || '').trim();
          const accNo = (br.accountNo || '').trim();
          const accName = (br.accountName || b.accountName || '').trim();
          const baseline = (
            accountBaselineMap.get(norm(bName) + "__" + norm(brName) + "__" + norm(accNo)) ||
            accountBaselineMap.get(norm(bName) + "__" + norm(accNo)) ||
            accountBaselineMap.get(norm(accNo)) ||
            accountBaselineMap.get(norm(bName) + "__" + norm(brName)) ||
            accountBaselineMap.get(norm(bName))
          );
          const isAct = baseline?.isActive;
          const openBal = isAct ? baseline.openingBalance : (Number(br.openingBalance) || 0);
          const baselineDate = isAct ? baseline.date : null;

          // Compute matching transactions across ALL modules
          const matchingTx = unifiedTransactions.filter(tx => {
            const matchBank = tx.bankName.toLowerCase() === bName.toLowerCase();
            const matchAcc = !accNo || !tx.accountNo || tx.accountNo.toLowerCase() === accNo.toLowerCase();
            if (!matchBank || !matchAcc) return false;
            if (baselineDate && tx.date < baselineDate) return false;
            return true;
          });

          const totalDep = matchingTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
          const totalWith = matchingTx.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);

          accounts.push({
            _id: b._id,
            bankId: b._id,
            bankName: bName,
            branch: brName || 'Main Branch',
            accountNo: accNo || 'N/A',
            accountName: accName || bName,
            openingBalance: openBal,
            isOpeningBalanceActive: isAct,
            openingBalanceDate: baselineDate,
            totalDeposits: totalDep,
            totalWithdrawals: totalWith,
            netBalance: openBal + totalDep - totalWith,
            depositCount: matchingTx.filter(t => t.type === 'deposit').length,
            withdrawalCount: matchingTx.filter(t => t.type === 'withdrawal').length
          });
        });
      } else {
        const brName = (b.branch || '').trim();
        const accNo = (b.accountNo || '').trim();
        const accName = (b.accountName || '').trim();
        const baseline = (
          accountBaselineMap.get(norm(bName) + "__" + norm(brName) + "__" + norm(accNo)) ||
          accountBaselineMap.get(norm(bName) + "__" + norm(accNo)) ||
          accountBaselineMap.get(norm(accNo)) ||
          accountBaselineMap.get(norm(bName))
        );
        const isAct = baseline?.isActive;
        const openBal = isAct ? baseline.openingBalance : (Number(b.openingBalance) || 0);
        const baselineDate = isAct ? baseline.date : null;

        const matchingTx = unifiedTransactions.filter(tx => {
          const matchBank = tx.bankName.toLowerCase() === bName.toLowerCase();
          const matchAcc = !accNo || !tx.accountNo || tx.accountNo.toLowerCase() === accNo.toLowerCase();
          if (!matchBank || !matchAcc) return false;
          if (baselineDate && tx.date < baselineDate) return false;
          return true;
        });

        const totalDep = matchingTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
        const totalWith = matchingTx.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);

        accounts.push({
          _id: b._id,
          bankId: b._id,
          bankName: bName,
          branch: brName || 'Main Branch',
          accountNo: accNo || 'N/A',
          accountName: accName || bName,
          openingBalance: openBal,
          isOpeningBalanceActive: isAct,
          openingBalanceDate: baselineDate,
          totalDeposits: totalDep,
          totalWithdrawals: totalWith,
          netBalance: openBal + totalDep - totalWith,
          depositCount: matchingTx.filter(t => t.type === 'deposit').length,
          withdrawalCount: matchingTx.filter(t => t.type === 'withdrawal').length
        });
      }
    });

    // Sort in alphabetical ascending order (A to Z) by bank name, then branch, then account number
    accounts.sort((a, b) => {
      const cmpBank = a.bankName.localeCompare(b.bankName, undefined, { sensitivity: 'base' });
      if (cmpBank !== 0) return cmpBank;
      const cmpBranch = (a.branch || '').localeCompare(b.branch || '', undefined, { sensitivity: 'base' });
      if (cmpBranch !== 0) return cmpBranch;
      return (a.accountNo || '').localeCompare(b.accountNo || '', undefined, { sensitivity: 'base' });
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return accounts.filter(acc =>
        acc.bankName.toLowerCase().includes(q) ||
        acc.branch.toLowerCase().includes(q) ||
        acc.accountNo.toLowerCase().includes(q) ||
        acc.accountName.toLowerCase().includes(q)
      );
    }

    return accounts;
  }, [banks, unifiedTransactions, searchQuery, accountBaselineMap]);

  const handleSelectAccountForStatement = (acc) => {
    setFilters({
      bankName: acc.bankName,
      branch: acc.branch !== 'Main Branch' ? acc.branch : '',
      accountNo: acc.accountNo !== 'N/A' ? acc.accountNo : '',
      sourceModule: 'all',
      transactionType: 'all',
      quickRange: 'all',
      startDate: '',
      endDate: ''
    });
    setActiveTab('ledger');
  };

  // Export handlers
  const handleExportPdf = async () => {
    const meta = {
      bankName: filters.bankName,
      branch: filters.branch,
      accountNo: filters.accountNo,
      accountName: filterAccountsList.find(a => a.accountNo === filters.accountNo)?.accountName || '',
      startDate: effectiveOpeningDate || filters.startDate,
      openingBalanceDate: effectiveOpeningDate,
      endDate: filters.endDate,
      openingBalance: periodOpeningBalance,
      closingBalance: periodTotals.closingBalance,
      totalDeposits: periodTotals.totalDeposits,
      totalWithdrawals: periodTotals.totalWithdrawals
    };
    await generateBankStatementPDF(displayLedger, meta);
  };

  const handleExportExcel = () => {
    const meta = {
      bankName: filters.bankName,
      branch: filters.branch,
      accountNo: filters.accountNo,
      accountName: filterAccountsList.find(a => a.accountNo === filters.accountNo)?.accountName || '',
      startDate: effectiveOpeningDate || filters.startDate,
      openingBalanceDate: effectiveOpeningDate,
      endDate: filters.endDate,
      openingBalance: periodOpeningBalance,
      closingBalance: periodTotals.closingBalance,
      totalDeposits: periodTotals.totalDeposits,
      totalWithdrawals: periodTotals.totalWithdrawals
    };
    generateBankStatementExcel(displayLedger, meta);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Top Header & Search Bar */}
      <div className="space-y-3">
        {/* Row 1: Title (Left), Search Input (Center), Actions (Right) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full md:w-72 text-center md:text-left shrink-0">
            <h2 className="text-2xl font-bold text-gray-800">Bank Statement</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Unified financial ledger & real-time bank balances
            </p>
          </div>

          {/* Search Input - CENTERED */}
          <div className="w-full md:flex-1 md:max-w-md mx-auto relative group px-2 md:px-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search statement by module, ref #, party, notes, account..."
              autoComplete="off"
              className="h-10 block w-full pl-10 pr-4 bg-white/70 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-72 shrink-0 flex-wrap">

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              ref={filterButtonRef}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`h-10 flex items-center justify-center gap-1.5 px-3.5 rounded-xl border transition-all active:scale-95 text-xs font-semibold shadow-sm cursor-pointer ${
                showFilterPanel || isFilterActive
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className={`w-4 h-4 ${showFilterPanel || isFilterActive ? 'text-white' : 'text-gray-400'}`} />
              <span>Filter</span>
              {isFilterActive && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
              )}
            </button>

            {showFilterPanel && (
              <>
                <div
                  className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[2005] md:hidden"
                  onClick={() => setShowFilterPanel(false)}
                />
                <div
                  ref={filterPanelRef}
                  className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-auto md:right-0 md:mt-2 w-auto md:w-92 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-visible text-left max-h-[85vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                    <h4 className="font-bold text-gray-900 text-sm">Filter Bank Statement</h4>
                    <button
                      onClick={resetFilters}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider cursor-pointer"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Quick Date Chips */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                        Quick Period
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { key: 'all', label: 'All' },
                          { key: 'today', label: 'Today' },
                          { key: 'thisWeek', label: 'Week' },
                          { key: 'thisMonth', label: 'Month' },
                          { key: 'lastMonth', label: 'Last M' },
                          { key: 'thisYear', label: 'Year' }
                        ].map(q => (
                          <button
                            key={q.key}
                            type="button"
                            onClick={() => handleQuickRange(q.key)}
                            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer ${
                              filters.quickRange === q.key
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>

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

                    {/* Source Module Filter */}
                    <SearchableFilterSelect
                      label="Source ERP Module"
                      value={filters.sourceModule}
                      onChange={(mod) => handleFilterChange('sourceModule', mod || 'all')}
                      options={[
                        { value: 'all', label: 'All Modules (Complete Statement)' },
                        { value: 'deposit', label: 'Bank Deposits (Direct)' },
                        { value: 'withdrawal', label: 'Bank Withdrawals (Direct)' },
                        { value: 'paymentCollection', label: 'Payment Collection (Customer Inflow)' },
                        { value: 'payToCustomer', label: 'Pay to Customer (Customer Outflow)' },
                        { value: 'cnfPayment', label: 'C&F Payments' },
                        { value: 'insurancePayment', label: 'Insurance Payments' },
                        { value: 'pattyCash', label: 'Patty Cash (Replenishments & Expenses)' },
                        { value: 'marginReturn', label: 'Margin Returns (LC Margin Refund)' },
                        { value: 'lcExpense', label: 'LC Margin, Bills & Bank Charges' }
                      ]}
                      showAllOption={false}
                    />

                    {/* Bank Filter */}
                    <SearchableFilterSelect
                      label="Bank Name"
                      value={filters.bankName}
                      onChange={(name) => {
                        setFilters(prev => ({
                          ...prev,
                          bankName: name,
                          branch: '',
                          accountNo: ''
                        }));
                      }}
                      options={uniqueBankNames}
                      placeholder="All Banks"
                    />

                    {/* Branch Filter */}
                    {filters.bankName && (
                      <SearchableFilterSelect
                        label="Branch"
                        value={filters.branch}
                        onChange={(br) => {
                          setFilters(prev => ({
                            ...prev,
                            branch: br,
                            accountNo: ''
                          }));
                        }}
                        options={filterBranchesList}
                        placeholder="All Branches"
                      />
                    )}

                    {/* Account Filter */}
                    {filters.bankName && (
                      <SearchableFilterSelect
                        label="Account No / Title"
                        value={filters.accountNo}
                        displayValue={
                          filters.accountNo
                            ? `${filters.accountNo}${filterAccountsList.find(a => a.accountNo === filters.accountNo)?.accountName ? ` (${filterAccountsList.find(a => a.accountNo === filters.accountNo)?.accountName})` : ''}`
                            : ''
                        }
                        onChange={(accNo) => handleFilterChange('accountNo', accNo)}
                        options={filterAccountsList.map(a => ({
                          value: a.accountNo,
                          label: a.accountNo,
                          sublabel: a.accountName
                        }))}
                        placeholder="All Accounts"
                      />
                    )}

                    {/* Nature Filter */}
                    <SearchableFilterSelect
                      label="Transaction Nature"
                      value={filters.transactionType}
                      onChange={(val) => handleFilterChange('transactionType', val || 'all')}
                      options={[
                        { value: 'all', label: 'All Transactions (Inflows & Outflows)' },
                        { value: 'deposit', label: 'Inflows / Deposits / Credits Only (+)' },
                        { value: 'withdrawal', label: 'Outflows / Withdrawals / Debits Only (-)' }
                      ]}
                      showAllOption={false}
                    />

                    <button
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
            onClick={() => setShowExportModal(true)}
            className="h-10 flex items-center justify-center gap-1.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all active:scale-95 cursor-pointer"
          >
            <BarChartIcon className="w-4 h-4" />
            <span>Report</span>
          </button>
          </div>
        </div>

        {/* Row 2: Tab Switcher Pills - Perfectly Centered under the Search Bar */}
        <div className="flex justify-center items-center w-full">
          <div className="inline-flex items-center bg-gray-100/90 p-1 rounded-xl border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <FileTextIcon className="w-3.5 h-3.5" />
              <span>Statement ({displayLedger.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('accounts');
                setFilters(prev => ({
                  ...prev,
                  bankName: '',
                  branch: '',
                  accountNo: ''
                }));
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'accounts'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <BuildingIcon className="w-3.5 h-3.5" />
              <span>All Accounts ({bankAccountsOverview.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Account / Filter Banner - ONLY for Statement Ledger View */}
      {activeTab === 'ledger' && filters.bankName && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs relative overflow-hidden group">
          <BankWatermark bankName={filters.bankName} className="w-64 h-64" opacity={0.08} />
          <div className="flex items-center gap-3.5 relative z-10">
            <BankLogo bankName={filters.bankName} className="w-16 h-16 rounded-2xl shadow-xs" imgClassName="w-full h-full object-contain p-1" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-base">{filters.bankName}</h3>
                {filters.branch && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                    {filters.branch} Branch
                  </span>
                )}
                {filters.accountNo && (
                  <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                    A/C: {filters.accountNo}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {filters.startDate || filters.endDate
                  ? `Period: ${filters.startDate ? formatDate(filters.startDate) : (effectiveOpeningDate ? formatDate(effectiveOpeningDate) : 'Start')} to ${filters.endDate ? formatDate(filters.endDate) : 'Present'}`
                  : (effectiveOpeningDate ? `Statement starting strictly from Opening Balance (${formatDate(effectiveOpeningDate)} forward)` : 'All time historical ledger across all modules')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            {canManageOpeningBalance ? (
              <button
                type="button"
                onClick={handleOpenOpeningBalanceFromFilter}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                  scopeBaseline?.isActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                title={scopeBaseline?.isActive ? 'Edit Opening Balance' : 'Activate Opening Balance'}
              >
                <BanknotesIcon className="w-4 h-4 text-emerald-600" />
                {scopeBaseline?.isActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>OB: ৳{Number(scopeBaseline.openingBalance || 0).toLocaleString()} ({formatDate(scopeBaseline.date)})</span>
                  </>
                ) : (
                  <span>Activate Opening Balance</span>
                )}
              </button>
            ) : (
              scopeBaseline?.isActive ? (
                <div
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-2xs bg-emerald-50 text-emerald-800 border-emerald-300"
                  title={`Opening Balance Active (${formatDate(scopeBaseline.date)})`}
                >
                  <BanknotesIcon className="w-4 h-4 text-emerald-600" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>OB: ৳{Number(scopeBaseline.openingBalance || 0).toLocaleString()} ({formatDate(scopeBaseline.date)})</span>
                </div>
              ) : null
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer ml-1"
            >
              Clear Account Filter
            </button>
          </div>
        </div>
      )}

      {/* Financial KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Opening Balance */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Opening Balance</p>
              <h3 className="text-lg font-bold text-blue-600 mt-1">
                ৳{(periodOpeningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <WalletIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">
            {filters.startDate ? `As of ${formatDate(filters.startDate)}` : 'Master initial balance'}
          </p>
        </div>

        {/* 2. Total Inflows (Deposits) */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Inflows (+)</p>
              <h3 className="text-lg font-bold text-emerald-600 mt-1">
                +৳{(periodTotals.totalDeposits || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <ArrowDownLeftIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">
            {ledgerRows.filter(r => r.type === 'deposit').length} credit entries across modules
          </p>
        </div>

        {/* 3. Total Outflows (Withdrawals / Payouts) */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Outflows (-)</p>
              <h3 className="text-lg font-bold text-rose-600 mt-1">
                -৳{(periodTotals.totalWithdrawals || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <ArrowUpRightIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">
            {ledgerRows.filter(r => r.type === 'withdrawal').length} debit entries across modules
          </p>
        </div>

        {/* 4. Net Movement */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Net Movement</p>
              <h3 className={`text-lg font-bold mt-1 ${periodTotals.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {periodTotals.netMovement >= 0 ? '+' : ''}৳{(periodTotals.netMovement || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <DollarSignIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">Period net delta</p>
        </div>

        {/* 5. Closing / Current Balance */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Closing Balance</p>
              <h3 className="text-lg font-extrabold text-gray-900 mt-1">
                ৳{(periodTotals.closingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <CheckCircle2Icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">Net calculated position</p>
        </div>
      </div>



      {/* MAIN VIEW: Statement Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left text-sm hidden md:table border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-gray-100 transition-colors w-24" onClick={() => requestSort('date')}>
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      <ChevronDownIcon className={`w-3 h-3 ${sortConfig.key === 'date' ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                  </th>
                  <th className="py-3 px-3">Module</th>
                  <th className="py-3 px-3">Type / Mode</th>
                  <th className="py-3 px-3">Bank & Branch</th>
                  <th className="py-3 px-3">Account No</th>
                  <th className="py-3 px-3">Ref / Slip #</th>
                  <th className="py-3 px-3">Particulars / Party</th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('amount')}>
                    <span className="text-emerald-700">Deposit / In (+)</span>
                  </th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('amount')}>
                    <span className="text-rose-700">Withdraw / Out (-)</span>
                  </th>
                  <th className="py-3 px-3 text-right cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('runningBalance')}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Balance</span>
                      <ChevronDownIcon className={`w-3 h-3 ${sortConfig.key === 'runningBalance' ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Baseline Opening Balance Row */}
                <tr className="bg-blue-50/40 font-semibold text-xs text-gray-800">
                  <td className="py-3 px-3 text-center text-gray-400">-</td>
                  <td className="py-3 px-3 text-gray-600">
                    {effectiveOpeningDate ? formatDate(effectiveOpeningDate) : (filters.startDate ? formatDate(filters.startDate) : '-')}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                      System Balance
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-500">Opening Balance</td>
                  <td className="py-3 px-3 text-gray-600">{filters.bankName || 'All Banks'}</td>
                  <td className="py-3 px-3 text-gray-600">{filters.accountNo || 'All Accounts'}</td>
                  <td className="py-3 px-3 text-gray-400">-</td>
                  <td className="py-3 px-3 text-blue-900 font-bold">
                    OPENING BALANCE FORWARD
                  </td>
                  <td className="py-3 px-3 text-right text-gray-400">-</td>
                  <td className="py-3 px-3 text-right text-gray-400">-</td>
                  <td className="py-3 px-3 text-right text-blue-900 font-extrabold text-sm">
                    ৳{(periodOpeningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-center text-gray-400">-</td>
                </tr>

                {/* In-Period Multi-Module Transaction Rows */}
                {displayLedger.length > 0 ? (
                  displayLedger.map((row, idx) => {
                    const isDeposit = row.type === 'deposit';
                    const tagStyle = MODULE_TAG_STYLES[row.sourceModule] || 'bg-gray-50 text-gray-700 border-gray-200';
                    return (
                      <tr
                        key={`${row.id}-${idx}`}
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                        onClick={() => setViewingTransaction(row)}
                      >
                        <td className="py-3 px-3 text-center text-xs text-gray-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-700 whitespace-nowrap">
                          {formatDate(row.date)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${tagStyle}`}>
                            {row.sourceModule}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${
                              isDeposit
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {isDeposit ? (
                              <ArrowDownLeftIcon className="w-3 h-3 text-emerald-600 shrink-0" />
                            ) : (
                              <ArrowUpRightIcon className="w-3 h-3 text-rose-600 shrink-0" />
                            )}
                            <span className="truncate max-w-[110px]" title={row.typeName}>{row.typeName}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-900 font-medium">
                          <div className="truncate max-w-[130px] font-semibold" title={row.bankName}>{row.bankName}</div>
                          {row.branch && (
                            <div className="text-[11px] text-gray-400 truncate max-w-[130px]">{row.branch}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-600 font-mono">
                          {row.accountNo || '-'}
                        </td>
                        <td className="py-3 px-3 text-xs font-mono text-gray-600">
                          {row.referenceNo || '-'}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.partyOrPerson && (
                            <div className="font-semibold text-gray-800 line-clamp-1" title={row.partyOrPerson}>
                              {row.partyOrPerson}
                            </div>
                          )}
                          {row.remarks && (
                            <div className="text-[11px] text-gray-400 line-clamp-1" title={row.remarks}>
                              {row.remarks}
                            </div>
                          )}
                          {!row.partyOrPerson && !row.remarks && (
                            <span className="text-gray-400 italic">No notes</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-xs font-bold text-emerald-600 whitespace-nowrap">
                          {isDeposit ? `+৳${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-xs font-bold text-rose-600 whitespace-nowrap">
                          {!isDeposit ? `-৳${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-xs font-bold text-gray-900 whitespace-nowrap">
                          ৳{(row.runningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setViewingTransaction(row)}
                            title="View Transaction Details"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="12" className="py-12 text-center text-gray-400 text-sm">
                      <FileTextIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                      <p className="font-bold text-gray-700">
                        {effectiveOpeningDate
                          ? `No transactions recorded after opening activation (${formatDate(effectiveOpeningDate)} forward)`
                          : 'No bank transactions found'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                        {effectiveOpeningDate
                          ? 'Prior historical transactions are excluded. The statement starts strictly from the opening balance forward.'
                          : 'Try resetting your date, module or filter options'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 text-xs font-bold text-gray-900">
                <tr>
                  <td colSpan="8" className="py-3.5 px-3 text-right uppercase tracking-wider text-gray-600">
                    Totals & Ending Balance:
                  </td>
                  <td className="py-3.5 px-3 text-right text-emerald-700 text-sm font-extrabold">
                    +৳{(periodTotals.totalDeposits || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-rose-700 text-sm font-extrabold">
                    -৳{(periodTotals.totalWithdrawals || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-3 text-right text-blue-900 text-base font-black">
                    ৳{(periodTotals.closingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-gray-100 p-3 space-y-3">
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-900">
                    Opening Balance Forward {effectiveOpeningDate ? `(${formatDate(effectiveOpeningDate)})` : ''}
                  </span>
                  <span className="font-extrabold text-blue-900">
                    ৳{(periodOpeningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {displayLedger.map((row, idx) => {
                const isDeposit = row.type === 'deposit';
                return (
                  <div
                    key={`m-${row.id}-${idx}`}
                    onClick={() => setViewingTransaction(row)}
                    className="p-3 bg-white rounded-xl border border-gray-100 shadow-xs space-y-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${MODULE_TAG_STYLES[row.sourceModule] || 'bg-gray-50'}`}>
                          {row.sourceModule}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isDeposit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {isDeposit ? <ArrowDownLeftIcon className="w-3 h-3" /> : <ArrowUpRightIcon className="w-3 h-3" />}
                          {row.typeName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{formatDate(row.date)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-gray-900">{row.bankName}</div>
                        <div className="text-xs text-gray-500">{row.branch} {row.accountNo ? `• ${row.accountNo}` : ''}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-extrabold text-sm ${isDeposit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isDeposit ? '+' : '-'}৳{row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-gray-400 font-medium">
                          Bal: ৳{(row.runningBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {(row.partyOrPerson || row.referenceNo) && (
                      <div className="text-xs text-gray-500 pt-1 border-t border-gray-50 flex items-center justify-between">
                        <span className="truncate max-w-[200px]">{row.partyOrPerson}</span>
                        {row.referenceNo && <span className="font-mono text-gray-400 shrink-0">Ref: {row.referenceNo}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: All Bank Accounts Overview Tab */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccountsOverview.map((acc, idx) => (
            <div
              key={`${acc.bankName}-${acc.accountNo}-${idx}`}
              className="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between relative overflow-hidden"
            >
              {/* Centered Bank Logo Watermark */}
              <BankWatermark bankName={acc.bankName} className="w-52 h-52 sm:w-60 sm:h-60" opacity={0.09} />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <BankLogo bankName={acc.bankName} className="w-16 h-16 rounded-2xl shadow-xs" imgClassName="w-full h-full object-contain p-1" />
                    <div>
                      <h4 className="font-bold text-base text-gray-900">{acc.bankName}</h4>
                      <p className="text-xs text-gray-500">{acc.branch}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    acc.isOpeningBalanceActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {acc.isOpeningBalanceActive && acc.openingBalanceDate ? `OB Active: ${formatDate(acc.openingBalanceDate)}` : 'Active'}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Account Name:</span>
                    <span className="font-semibold text-gray-800">{acc.accountName}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Account No:</span>
                    <span className="font-mono font-bold text-gray-900">{acc.accountNo}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Opening Balance:</span>
                    <span className="font-medium text-gray-800">
                      ৳{acc.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Total Inflows (+):</span>
                    <span className="font-bold">
                      +৳{acc.totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>Total Outflows (-):</span>
                    <span className="font-bold">
                      -৳{acc.totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Net Balance</span>
                  <span className="text-lg font-black text-gray-900">
                    ৳{acc.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canManageOpeningBalance && (
                    <button
                      type="button"
                      onClick={() => handleOpenOpeningBalance(acc)}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        acc.isOpeningBalanceActive
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 shadow-2xs'
                          : 'bg-gray-100 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200'
                      }`}
                      title={acc.isOpeningBalanceActive ? 'Edit Opening Balance' : 'Activate Opening Balance'}
                    >
                      <BanknotesIcon className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectAccountForStatement(acc)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-blue-500/20 active:scale-95"
                  >
                    View Statement
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Details Modal */}
      {viewingTransaction && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    viewingTransaction.type === 'deposit'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {viewingTransaction.type === 'deposit' ? (
                    <ArrowDownLeftIcon className="w-5 h-5" />
                  ) : (
                    <ArrowUpRightIcon className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {viewingTransaction.sourceModule}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {formatDate(viewingTransaction.date)} • {viewingTransaction.typeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingTransaction(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-sm">
              <div className="bg-gray-50 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-500 block">Transaction Nature</span>
                  <span className="text-xs font-bold text-gray-800">
                    {viewingTransaction.type === 'deposit' ? 'Credit / Inflow (+)' : 'Debit / Outflow (-)'}
                  </span>
                </div>
                <span
                  className={`text-xl font-extrabold ${
                    viewingTransaction.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  ৳{viewingTransaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block">Source Module</span>
                  <span className="font-bold text-gray-800 text-sm">{viewingTransaction.sourceModule}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Transaction Mode</span>
                  <span className="font-semibold text-gray-800 text-sm">{viewingTransaction.typeName}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Bank Name</span>
                  <span className="font-bold text-gray-800 text-sm">{viewingTransaction.bankName || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Branch</span>
                  <span className="font-semibold text-gray-800 text-sm">{viewingTransaction.branch || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Account No</span>
                  <span className="font-mono font-bold text-gray-800">{viewingTransaction.accountNo || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Ref / Voucher / Slip #</span>
                  <span className="font-mono text-gray-800">{viewingTransaction.referenceNo || '-'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400 font-medium block">Party / Beneficiary / Client</span>
                  <span className="font-semibold text-gray-800">{viewingTransaction.partyOrPerson || '-'}</span>
                </div>
              </div>

              {canShowEntryBy && viewingTransaction.createdBy && (
                <div className="pt-2 border-t border-gray-100 text-xs">
                  <span className="text-gray-400 font-medium block">Recorded By</span>
                  <span className="font-semibold text-gray-700">
                    {employeesMap[viewingTransaction.createdBy] || viewingTransaction.createdBy || 'System'}
                  </span>
                </div>
              )}

              {viewingTransaction.remarks && (
                <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Remarks / Particulars</span>
                  <p className="text-gray-700">{viewingTransaction.remarks}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingTransaction(null)}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Opening Balance Activation Modal */}
      {openingBalanceModal.isOpen && openingBalanceModal.item && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => {
              if (!openingBalanceModal.isSaving) {
                setOpeningBalanceModal(prev => ({ ...prev, isOpen: false }));
              }
            }}
          />
          <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/60 shadow-xs">
                  <BanknotesIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Opening Balance Activation</h3>
                  <p className="text-xs font-semibold text-gray-400">Set opening balance & statement starting date</p>
                </div>
              </div>
              <button
                type="button"
                disabled={openingBalanceModal.isSaving}
                onClick={() => setOpeningBalanceModal(prev => ({ ...prev, isOpen: false }))}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Account Info Pill */}
            <div className="p-6 space-y-5">
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-150/60 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200/50">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Bank</span>
                  <span className="font-black text-gray-900">{openingBalanceModal.item.bankName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Branch</span>
                  <span className="font-bold text-gray-800">{openingBalanceModal.item.branch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Account Name</span>
                  <span className="font-bold text-gray-800">{openingBalanceModal.item.accountName}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">Account No</span>
                  <span className="font-black font-mono text-blue-600 text-sm select-all">{openingBalanceModal.item.accountNo}</span>
                </div>
              </div>

              {/* Activation Toggle Card */}
              <div className={`p-4 rounded-2xl border transition-all ${openingBalanceModal.isActive ? 'bg-emerald-50/60 border-emerald-200 ring-2 ring-emerald-500/10' : 'bg-gray-50/50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-gray-900">Activate Opening Balance</span>
                      {openingBalanceModal.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {openingBalanceModal.isActive
                        ? 'Statement will start strictly from this date and opening balance. Prior historical transactions are excluded.'
                        : 'Statement calculates with all historical transactions without cutoff.'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={openingBalanceModal.isActive}
                      onChange={(e) => setOpeningBalanceModal(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Inputs (visible when active) */}
              {openingBalanceModal.isActive && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                      Effective Opening Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={openingBalanceModal.date}
                      onChange={(e) => setOpeningBalanceModal(prev => ({ ...prev, date: e.target.value }))}
                      required
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-semibold text-gray-800 outline-none transition-all shadow-xs"
                    />
                    <p className="text-[11px] text-gray-400 ml-1">The date from which the account statement starts forward.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                      Opening Balance Amount (TK) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-bold text-gray-400 pointer-events-none">
                        ৳
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={openingBalanceModal.amount}
                        onChange={(e) => setOpeningBalanceModal(prev => ({ ...prev, amount: e.target.value }))}
                        required
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-bold text-gray-900 outline-none transition-all shadow-xs"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 ml-1">The starting balance on the effective date forward.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              <div>
                {openingBalanceModal.item.isOpeningBalanceActive && (
                  <button
                    type="button"
                    disabled={openingBalanceModal.isSaving}
                    onClick={(e) => {
                      if (window.confirm('Are you sure you want to deactivate opening balance for this account?')) {
                        handleSaveOpeningBalance(e, true);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                  >
                    Deactivate
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={openingBalanceModal.isSaving}
                  onClick={() => setOpeningBalanceModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={openingBalanceModal.isSaving}
                  onClick={handleSaveOpeningBalance}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {openingBalanceModal.isSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Saving...
                    </>
                  ) : (
                    'Save & Apply'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Export Format Modal */}
      <ReportFormatModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Bank Statement Report"
        subtitle="Select format to generate bank statement ledger report (PDF / Excel)"
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
};

export default Statement;
