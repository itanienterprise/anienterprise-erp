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
  UserIcon, CheckCircle2Icon, FunnelIcon, CheckIcon, PrinterIcon,
  DownloadIcon, RefreshCwIcon, WalletIcon
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
import ReportFormatModal from '../../shared/ReportFormatModal';
import { generateBankStatementPDF } from '../../../utils/pdfGenerator';
import { generateBankStatementExcel } from '../../../utils/excelGenerator';
import { formatFirstName } from '../IPManagement/IPManagement';
import '../PaymentCollection/PaymentCollection.css';

const EyeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
    deposits.forEach(d => {
      list.push({
        id: `dep-${d._id || d.id || Math.random()}`,
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
    withdrawals.forEach(w => {
      list.push({
        id: `with-${w._id || w.id || Math.random()}`,
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
      history.forEach(p => {
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
              id: `pc-${customer._id}-${p.id || p._id || p.receiptNo || Math.random()}-${itemIdx}`,
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
            id: `pc-${customer._id}-${p.id || p._id || p.receiptNo || Math.random()}`,
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
      history.forEach(p => {
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
              id: `ptc-${customer._id}-${p.id || p._id || p.receiptNo || Math.random()}-${itemIdx}`,
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
            id: `ptc-${customer._id}-${p.id || p._id || p.receiptNo || Math.random()}`,
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
    cnfPayments.forEach(p => {
      const pStatus = (p.status || '').toLowerCase();
      if (pStatus === 'requested' || pStatus === 'rejected') return;

      const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.method);
      if (!hasBank) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `cnf-${p._id || p.id || Math.random()}`,
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
    insurancePayments.forEach(p => {
      const pStatus = (p.status || '').toLowerCase();
      if (pStatus === 'requested' || pStatus === 'rejected') return;

      const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.method);
      if (!hasBank) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `ins-${p._id || p.id || Math.random()}`,
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
    pattyCashRecords.forEach(p => {
      const hasBank = (p.bankName && p.bankName.trim()) || isBankMethod(p.paymentMode);
      if (!hasBank) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      const isDepositToBank = (p.category || '').toLowerCase().includes('deposit');
      const isBankWithdrawalToPatty = p.type === 'inflow' || (p.category || '').toLowerCase().includes('withdrawal');

      list.push({
        id: `patty-${p._id || p.id || Math.random()}`,
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
    marginReturns.forEach(p => {
      const amt = Number(p.returnAmount || p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `mr-${p._id || p.id || Math.random()}`,
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
    lcRecords.forEach(lc => {
      const bName = (lc.bankName || lc.bank || '').trim();
      if (!bName) return;

      const importer = (lc.importerName || lc.importer || 'LC Opening').trim();
      const openDate = toDateStr(lc.openingDate || lc.date || lc.createdAt);

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
          id: `lc-open-margin-${lc._id || lc.id || Math.random()}`,
          sourceModule: 'LC Margin & Bill',
          moduleKey: 'lcExpense',
          type: 'withdrawal', // Outflow (-)
          typeName: 'LC Margin Paid (Opening)',
          date: openDate,
          bankName: bName,
          branch: (lc.branch || '').trim(),
          accountNo: (lc.accountNo || '').trim(),
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
          id: `lc-open-charge-${lc._id || lc.id || Math.random()}`,
          sourceModule: 'LC Margin & Bill',
          moduleKey: 'lcExpense',
          type: 'withdrawal', // Outflow (-)
          typeName: 'LC Bank Charges (Opening)',
          date: openDate,
          bankName: bName,
          branch: (lc.branch || '').trim(),
          accountNo: (lc.accountNo || '').trim(),
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
            branch: (lc.branch || '').trim(),
            accountNo: (lc.accountNo || '').trim(),
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
            branch: (lc.branch || '').trim(),
            accountNo: (lc.accountNo || '').trim(),
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
    lcExpenses.forEach(p => {
      if (p.type === 'bill') return; // Exclude pending/unpaid bills
      const matchedLc = p.lcNo ? lcMap.get(cleanLc(p.lcNo)) : null;
      const bName = (p.bankName || matchedLc?.bankName || matchedLc?.bank || '').trim();
      const isBankHead = (p.expenseHead === 'Bank Charges' || p.expenseHead === 'Margin Bill' || bName);
      if (!isBankHead) return;

      const amt = Number(p.amount) || 0;
      if (amt <= 0) return;

      list.push({
        id: `lc-exp-${p._id || p.id || Math.random()}`,
        sourceModule: 'LC Margin & Bill',
        moduleKey: 'lcExpense',
        type: 'withdrawal', // Outflow (-)
        typeName: p.expenseHead || 'LC Bank Charge',
        date: toDateStr(p.date || p.createdAt),
        bankName: bName,
        branch: (p.branch || matchedLc?.branch || '').trim(),
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
  }, [deposits, withdrawals, customers, cnfPayments, insurancePayments, pattyCashRecords, marginReturns, lcExpenses, lcRecords]);

  // Unique bank names across all sources
  const uniqueBankNames = useMemo(() => {
    const seen = new Map();
    [
      ...banks.map(b => b.bankName),
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

    banks.forEach(b => {
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

    banks.forEach(b => {
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.bankName) count++;
    if (filters.branch) count++;
    if (filters.accountNo) count++;
    if (filters.sourceModule && filters.sourceModule !== 'all') count++;
    if (filters.transactionType && filters.transactionType !== 'all') count++;
    if (filters.startDate || filters.endDate) count++;
    return count;
  }, [filters]);

  // Base Opening Balance from Bank Master
  const baseMasterOpeningBalance = useMemo(() => {
    let sum = 0;
    const targetBank = filters.bankName ? filters.bankName.trim().toLowerCase() : null;
    const targetBranch = filters.branch ? filters.branch.trim().toLowerCase() : null;
    const targetAcc = filters.accountNo ? filters.accountNo.trim().toLowerCase() : null;

    banks.forEach(b => {
      const bNameMatch = !targetBank || (b.bankName || '').trim().toLowerCase() === targetBank;
      if (!bNameMatch) return;

      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          const brMatch = !targetBranch || (br.branch || '').trim().toLowerCase() === targetBranch;
          const accMatch = !targetAcc || (br.accountNo || '').trim().toLowerCase() === targetAcc;
          if (brMatch && accMatch) {
            sum += (Number(br.openingBalance) || 0);
          }
        });
      }

      if (!targetBranch && !targetAcc && b.openingBalance !== undefined) {
        sum += (Number(b.openingBalance) || 0);
      }
    });

    return sum;
  }, [banks, filters.bankName, filters.branch, filters.accountNo]);

  // Account, Module & Date filtering + Running Balance Calculation
  const { periodOpeningBalance, ledgerRows, periodTotals } = useMemo(() => {
    const targetBank = filters.bankName ? filters.bankName.trim().toLowerCase() : null;
    const targetBranch = filters.branch ? filters.branch.trim().toLowerCase() : null;
    const targetAcc = filters.accountNo ? filters.accountNo.trim().toLowerCase() : null;
    const targetModule = filters.sourceModule && filters.sourceModule !== 'all' ? filters.sourceModule : null;

    // 1. Filter by Account criteria and Module
    const matchedTx = unifiedTransactions.filter(tx => {
      if (targetBank && tx.bankName.toLowerCase() !== targetBank) return false;
      if (targetBranch && tx.branch && tx.branch.toLowerCase() !== targetBranch) return false;
      if (targetAcc && tx.accountNo && tx.accountNo.toLowerCase() !== targetAcc) return false;
      if (targetModule && tx.moduleKey !== targetModule) return false;
      return true;
    });

    // 2. Separate prior vs in-period transactions
    let openingBal = baseMasterOpeningBalance;
    const inPeriodTx = [];

    const startFilter = filters.startDate ? toDateStr(filters.startDate) : null;
    const endFilter = filters.endDate ? toDateStr(filters.endDate) : null;

    matchedTx.forEach(tx => {
      const txDate = tx.date;
      if (startFilter && txDate < startFilter) {
        if (tx.type === 'deposit') {
          openingBal += tx.amount;
        } else {
          openingBal -= tx.amount;
        }
      } else if (endFilter && txDate > endFilter) {
        // Ignored for current period
      } else {
        inPeriodTx.push(tx);
      }
    });

    // 3. Chronological sorting
    inPeriodTx.sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id));
    });

    // 4. Running Balance
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

    return {
      periodOpeningBalance: openingBal,
      ledgerRows: computedRows,
      periodTotals: {
        totalDeposits: sumDeposits,
        totalWithdrawals: sumWithdrawals,
        netMovement: sumDeposits - sumWithdrawals,
        closingBalance: currentBal,
        count: computedRows.length
      }
    };
  }, [unifiedTransactions, baseMasterOpeningBalance, filters.bankName, filters.branch, filters.accountNo, filters.sourceModule, filters.startDate, filters.endDate]);

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

  // Bank Accounts Overview (Aggregated Multi-Module Summary of each bank account)
  const bankAccountsOverview = useMemo(() => {
    const accounts = [];

    banks.forEach(b => {
      const bName = (b.bankName || '').trim();
      if (!bName) return;

      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          const brName = (br.branch || '').trim();
          const accNo = (br.accountNo || '').trim();
          const accName = (br.accountName || b.accountName || '').trim();
          const openBal = Number(br.openingBalance) || 0;

          // Compute matching transactions across ALL modules
          const matchingTx = unifiedTransactions.filter(tx => {
            const matchBank = tx.bankName.toLowerCase() === bName.toLowerCase();
            const matchAcc = !accNo || !tx.accountNo || tx.accountNo.toLowerCase() === accNo.toLowerCase();
            return matchBank && matchAcc;
          });

          const totalDep = matchingTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
          const totalWith = matchingTx.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);

          accounts.push({
            bankName: bName,
            branch: brName || 'Main Branch',
            accountNo: accNo || 'N/A',
            accountName: accName || bName,
            openingBalance: openBal,
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
        const openBal = Number(b.openingBalance) || 0;

        const matchingTx = unifiedTransactions.filter(tx => {
          const matchBank = tx.bankName.toLowerCase() === bName.toLowerCase();
          const matchAcc = !accNo || !tx.accountNo || tx.accountNo.toLowerCase() === accNo.toLowerCase();
          return matchBank && matchAcc;
        });

        const totalDep = matchingTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
        const totalWith = matchingTx.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0);

        accounts.push({
          bankName: bName,
          branch: brName || 'Main Branch',
          accountNo: accNo || 'N/A',
          accountName: accName || bName,
          openingBalance: openBal,
          totalDeposits: totalDep,
          totalWithdrawals: totalWith,
          netBalance: openBal + totalDep - totalWith,
          depositCount: matchingTx.filter(t => t.type === 'deposit').length,
          withdrawalCount: matchingTx.filter(t => t.type === 'withdrawal').length
        });
      }
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
  }, [banks, unifiedTransactions, searchQuery]);

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
  const handleExportPdf = () => {
    const meta = {
      bankName: filters.bankName,
      branch: filters.branch,
      accountNo: filters.accountNo,
      accountName: filterAccountsList.find(a => a.accountNo === filters.accountNo)?.accountName || '',
      startDate: filters.startDate,
      endDate: filters.endDate,
      openingBalance: periodOpeningBalance,
      closingBalance: periodTotals.closingBalance,
      totalDeposits: periodTotals.totalDeposits,
      totalWithdrawals: periodTotals.totalWithdrawals
    };
    generateBankStatementPDF(displayLedger, meta);
  };

  const handleExportExcel = () => {
    const meta = {
      bankName: filters.bankName,
      branch: filters.branch,
      accountNo: filters.accountNo,
      accountName: filterAccountsList.find(a => a.accountNo === filters.accountNo)?.accountName || '',
      startDate: filters.startDate,
      endDate: filters.endDate,
      openingBalance: periodOpeningBalance,
      closingBalance: periodTotals.closingBalance,
      totalDeposits: periodTotals.totalDeposits,
      totalWithdrawals: periodTotals.totalWithdrawals
    };
    generateBankStatementExcel(displayLedger, meta);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-1/4 text-center md:text-left">
          <h2 className="text-2xl font-bold text-gray-800">Bank Statement</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Unified financial ledger across all ERP modules & real-time bank balances
          </p>
        </div>

        {/* Search Input - CENTERED */}
        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
          <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
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
        <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-auto shrink-0 flex-wrap">
          {/* Tab Switcher Pills */}
          <div className="flex items-center bg-gray-100/90 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
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
              onClick={() => setActiveTab('accounts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'accounts'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <BuildingIcon className="w-3.5 h-3.5" />
              <span>All Accounts ({bankAccountsOverview.length})</span>
            </button>
          </div>

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

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="h-10 flex items-center justify-center gap-1.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 text-xs transition-all active:scale-95 cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            title="Print Statement"
            className="h-10 w-10 flex items-center justify-center bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl shadow-sm text-xs transition-all active:scale-95 cursor-pointer"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Account / Filter Banner */}
      {filters.bankName && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <BuildingIcon className="w-5 h-5" />
            </div>
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
                  ? `Period: ${filters.startDate ? formatDate(filters.startDate) : 'Start'} to ${filters.endDate ? formatDate(filters.endDate) : 'Present'}`
                  : 'All time historical ledger across all modules'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
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

      {/* Active Filter Badges */}
      {isFilterActive && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-400 font-medium">Active filters:</span>
          {filters.sourceModule !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium border border-purple-100">
              Module: {filters.sourceModule}
              <button onClick={() => setFilters(p => ({ ...p, sourceModule: 'all' }))} className="hover:text-purple-900">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.bankName && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-100">
              Bank: {filters.bankName}
              <button onClick={() => setFilters(p => ({ ...p, bankName: '', branch: '', accountNo: '' }))} className="hover:text-blue-900">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.branch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-100">
              Branch: {filters.branch}
              <button onClick={() => setFilters(p => ({ ...p, branch: '', accountNo: '' }))} className="hover:text-blue-900">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.accountNo && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-100">
              A/C: {filters.accountNo}
              <button onClick={() => setFilters(p => ({ ...p, accountNo: '' }))} className="hover:text-blue-900">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.startDate || filters.endDate) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg font-medium border border-gray-200">
              Date: {filters.startDate || 'Start'} to {filters.endDate || 'Present'}
              <button onClick={() => setFilters(p => ({ ...p, startDate: '', endDate: '', quickRange: 'all' }))} className="hover:text-gray-900">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.transactionType !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg font-medium border border-gray-200">
              Nature: {filters.transactionType === 'deposit' ? 'Inflows Only' : 'Outflows Only'}
              <button onClick={() => setFilters(p => ({ ...p, transactionType: 'all' }))} className="hover:text-gray-900">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={resetFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-bold ml-1 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

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
                    {filters.startDate ? formatDate(filters.startDate) : '-'}
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
                          <div className="truncate max-w-[130px]" title={row.bankName}>{row.bankName}</div>
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
                      <p className="font-medium text-gray-500">No bank transactions found</p>
                      <p className="text-xs text-gray-400 mt-1">Try resetting your date, module or filter options</p>
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
                  <span className="font-bold text-blue-900">Opening Balance Forward</span>
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
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                      <BuildingIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900">{acc.bankName}</h4>
                      <p className="text-xs text-gray-500">{acc.branch}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                    Active
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

              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Net Balance</span>
                  <span className="text-lg font-black text-gray-900">
                    ৳{acc.netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAccountForStatement(acc)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-blue-500/20 active:scale-95"
                >
                  View Statement
                </button>
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

      {/* Export Format Modal */}
      <ReportFormatModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Bank Statement"
        subtitle="Select format to download bank statement ledger"
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
      />
    </div>
  );
};

export default Statement;
