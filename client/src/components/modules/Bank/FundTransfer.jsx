import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { decryptData } from '../../../utils/encryption';
import { queryClient } from '../../../utils/queryClient';
import { getSocket } from '../../../utils/socket';
import { hasPermission } from '../../../utils/permissionHelper';
import {
  SearchIcon, PlusIcon, EditIcon, TrashIcon, XIcon,
  ChevronDownIcon, DollarSignIcon, BuildingIcon, CalendarIcon,
  ArrowLeftRightIcon, ArrowRightIcon, FileTextIcon, UserIcon, CheckCircle2Icon,
  FunnelIcon, CheckIcon, RefreshIcon
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
import TableScrollNav from '../../shared/TableScrollNav';
import { formatFirstName } from '../IPManagement/IPManagement';
import BankLogo from './BankLogo';
import '../PaymentCollection/PaymentCollection.css';

const EyeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const PrinterIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
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

const TRANSFER_TYPES = [
  'Online Banking',
  'BEFTN',
  'RTGS',
  'Cheque Transfer',
  'NPSB',
  'Internal Transfer',
  'Demand Draft',
  'Other'
];

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
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value !== undefined ? String(opt.value) : '',
          label: opt.label !== undefined ? String(opt.label) : '',
          sublabel: opt.sublabel || ''
        };
      }
      return {
        value: String(opt),
        label: String(opt),
        sublabel: ''
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

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const item = filteredOptions[highlightedIndex];
        onChange(item.value);
        setIsOpen(false);
        setSearch('');
        inputRef.current?.blur();
      } else if (isOpen && filteredOptions.length > 0) {
        const item = filteredOptions[0];
        onChange(item.value);
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
            if (allowCustomValue) {
              onChange(e.target.value);
            }
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
              <span>{placeholder}</span>
              {!value && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
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
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 text-blue-700 font-semibold'
                      : isHighlighted
                        ? 'bg-gray-100/80 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[10px] text-gray-400 truncate">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })
          ) : allowCustomValue && search.trim() ? (
            <button
              type="button"
              onClick={() => {
                onChange(search.trim());
                setIsOpen(false);
                setSearch('');
              }}
              className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 flex items-center justify-between"
            >
              <span>Use &quot;{search.trim()}&quot;</span>
              <span className="text-[10px] text-blue-400 font-semibold">(Press Enter)</span>
            </button>
          ) : (
            <div className="px-3 py-3 text-center text-gray-400 text-xs">
              No options found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FundTransfer = ({ currentUser, onDeleteConfirm }) => {
  const user = currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const canAdd = hasPermission(user, 'fundTransfer', 'add');
  const canEdit = hasPermission(user, 'fundTransfer', 'edit');
  const canDelete = hasPermission(user, 'fundTransfer', 'delete');
  const canShowEntryBy = hasPermission(user, 'fundTransfer', 'showEntryBy');

  const [fundTransfers, setFundTransfers] = useState(() => {
    try {
      const q = queryClient.getQueryData(['fund-transfers']);
      if (Array.isArray(q) && q.length > 0) return q;
      const cached = localStorage.getItem('erp_fund_transfers_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [banks, setBanks] = useState(() => {
    try {
      const q = queryClient.getQueryData(['banks']);
      if (Array.isArray(q) && q.length > 0) return q;
    } catch {}
    return [];
  });

  const [employeesMap, setEmployeesMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewingTransfer, setViewingTransfer] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({
    fromBankName: '',
    toBankName: '',
    transferType: '',
    startDate: '',
    endDate: ''
  });

  const filterPanelRef = useRef(null);
  const filterButtonRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isSocketConnected, setIsSocketConnected] = useState(() => {
    const s = getSocket();
    return !!s?.connected;
  });

  // Initial Form State
  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    fromBankName: '',
    fromBranch: '',
    fromAccountName: '',
    fromAccountNo: '',
    toBankName: '',
    toBranch: '',
    toAccountName: '',
    toAccountNo: '',
    transferType: 'Online Banking',
    amount: '',
    referenceNo: '',
    transferredBy: '',
    remarks: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Fetch Banks
  const fetchBanks = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/banks?_t=${Date.now()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setBanks(data);
      queryClient.setQueryData(['banks'], data);
    } catch (err) {
      console.error('Error fetching banks for fund transfer:', err);
    }
  };

  // Fetch Fund Transfers
  const fetchFundTransfers = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/fund-transfers?_t=${Date.now()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setFundTransfers(data);
      queryClient.setQueryData(['fund-transfers'], data);
      localStorage.setItem('erp_fund_transfers_cache', JSON.stringify(data));
    } catch (err) {
      console.warn('API fetchFundTransfers failed, checking local storage cache:', err);
      try {
        const local = localStorage.getItem('erp_fund_transfers_cache');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) setFundTransfers(parsed);
        }
      } catch (e) {}
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Fetch Employees for resolving names
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
      console.warn('Error fetching employees in FundTransfer:', err);
    }
  };

  const getFirstNameFromIdentifier = (rawIdentifier) => {
    if (!rawIdentifier) return '';
    const cleanId = String(rawIdentifier).trim().toLowerCase();
    if (employeesMap[cleanId]) return employeesMap[cleanId];
    const rawStr = String(rawIdentifier).trim();
    const parts = rawStr.split(/\s+/);
    const firstWord = parts[0] || '';
    if (/^[EA]-\d+$/i.test(rawStr)) {
      return rawStr;
    }
    let candidate = firstWord;
    if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(firstWord.toLowerCase()) && parts.length > 1) {
      candidate = `${parts[0]} ${parts[1]}`;
    }
    return formatFirstName(candidate || rawStr);
  };

  const getEntryByName = (entryByCode, entryByName) => {
    const candidate = entryByName || entryByCode;
    if (!candidate || candidate === '-' || candidate === '—') return 'Administrator';
    return getFirstNameFromIdentifier(candidate) || candidate;
  };

  useEffect(() => {
    fetchBanks();
    fetchFundTransfers();
    fetchEmployees();

    const socket = getSocket();
    setIsSocketConnected(!!socket?.connected);

    const handleRealtimeUpdate = (data) => {
      const mod = (data?.module || '').toLowerCase().trim();
      if (!mod || mod === 'fund-transfers' || mod === 'fundtransfer' || mod === 'all') {
        fetchFundTransfers(true);
      }
      if (mod === 'banks' || mod === 'bank' || mod === 'all') {
        fetchBanks();
      }
      if (mod === 'employees' || mod === 'employee' || mod === 'all') {
        fetchEmployees();
      }
    };

    const onCustomEvent = (e) => handleRealtimeUpdate(e?.detail);
    const onSocketStatus = (e) => {
      if (typeof e?.detail?.connected === 'boolean') {
        setIsSocketConnected(e.detail.connected);
      }
    };

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    if (socket) {
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('data_updated', handleRealtimeUpdate);
    }
    window.addEventListener('erp_data_updated', onCustomEvent);
    window.addEventListener('erp_socket_status', onSocketStatus);

    const pollTimer = setInterval(() => {
      fetchFundTransfers(true);
    }, 30000);

    return () => {
      if (socket) {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
        socket.off('data_updated', handleRealtimeUpdate);
      }
      window.removeEventListener('erp_data_updated', onCustomEvent);
      window.removeEventListener('erp_socket_status', onSocketStatus);
      clearInterval(pollTimer);
    };
  }, []);

  // Unique bank names across bank records
  const registeredBankNames = useMemo(() => {
    const seen = new Map();
    banks.filter(b => !b.isIndian).forEach(b => {
      const name = (b.bankName || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.set(name.toLowerCase(), name);
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [banks]);

  // Extract branches for a specific bank
  const getBranchesForBank = (bankName) => {
    if (!bankName) return [];
    const target = bankName.trim().toLowerCase();
    const matchingDocs = banks.filter(b => (b.bankName || '').trim().toLowerCase() === target);
    const list = [];
    matchingDocs.forEach(b => {
      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          if (br && br.branch) {
            list.push({
              branch: br.branch.trim(),
              accountName: (br.accountName || b.accountName || '').trim(),
              accountNo: (br.accountNo || b.accountNo || '').trim()
            });
          }
        });
      } else if (b.branch) {
        list.push({
          branch: b.branch.trim(),
          accountName: (b.accountName || '').trim(),
          accountNo: (b.accountNo || '').trim()
        });
      }
    });

    const seen = new Set();
    return list.filter(item => {
      const key = `${item.branch.toLowerCase()}|${item.accountNo.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const fromAvailableBranches = useMemo(() => {
    return getBranchesForBank(formData.fromBankName);
  }, [banks, formData.fromBankName]);

  const toAvailableBranches = useMemo(() => {
    return getBranchesForBank(formData.toBankName);
  }, [banks, formData.toBankName]);

  // Handlers for Form Bank selection
  const handleFromBankChange = (bName) => {
    if (!bName) {
      setFormData(prev => ({
        ...prev,
        fromBankName: '',
        fromBranch: '',
        fromAccountName: '',
        fromAccountNo: ''
      }));
      return;
    }
    const branches = getBranchesForBank(bName);
    const firstBr = branches.length === 1 ? branches[0] : null;
    setFormData(prev => ({
      ...prev,
      fromBankName: bName,
      fromBranch: firstBr ? firstBr.branch : '',
      fromAccountName: firstBr ? firstBr.accountName : '',
      fromAccountNo: firstBr ? firstBr.accountNo : ''
    }));
  };

  const handleFromBranchChange = (branchName) => {
    const branchObj = fromAvailableBranches.find(b => b.branch === branchName);
    setFormData(prev => ({
      ...prev,
      fromBranch: branchName,
      fromAccountName: branchObj ? branchObj.accountName : prev.fromAccountName,
      fromAccountNo: branchObj ? branchObj.accountNo : prev.fromAccountNo
    }));
  };

  const handleToBankChange = (bName) => {
    if (!bName) {
      setFormData(prev => ({
        ...prev,
        toBankName: '',
        toBranch: '',
        toAccountName: '',
        toAccountNo: ''
      }));
      return;
    }
    const branches = getBranchesForBank(bName);
    const firstBr = branches.length === 1 ? branches[0] : null;
    setFormData(prev => ({
      ...prev,
      toBankName: bName,
      toBranch: firstBr ? firstBr.branch : '',
      toAccountName: firstBr ? firstBr.accountName : '',
      toAccountNo: firstBr ? firstBr.accountNo : ''
    }));
  };

  const handleToBranchChange = (branchName) => {
    const branchObj = toAvailableBranches.find(b => b.branch === branchName);
    setFormData(prev => ({
      ...prev,
      toBranch: branchName,
      toAccountName: branchObj ? branchObj.accountName : prev.toAccountName,
      toAccountNo: branchObj ? branchObj.accountNo : prev.toAccountNo
    }));
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditModal = (ft) => {
    setEditingId(ft._id);
    setFormData({
      date: ft.date || ft.transferDate || new Date().toISOString().split('T')[0],
      fromBankName: ft.fromBankName || '',
      fromBranch: ft.fromBranch || '',
      fromAccountName: ft.fromAccountName || '',
      fromAccountNo: ft.fromAccountNo || '',
      toBankName: ft.toBankName || '',
      toBranch: ft.toBranch || '',
      toAccountName: ft.toAccountName || '',
      toAccountNo: ft.toAccountNo || '',
      transferType: ft.transferType || 'Online Banking',
      amount: ft.amount || '',
      referenceNo: ft.referenceNo || '',
      transferredBy: ft.transferredBy || '',
      remarks: ft.remarks || ft.note || ''
    });
    setShowModal(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fromBankName) {
      alert('Please select the Source (From) Bank.');
      return;
    }
    if (!formData.toBankName) {
      alert('Please select the Destination (To) Bank.');
      return;
    }
    // Validation: source and destination cannot be the exact same account
    const isSameBank = formData.fromBankName.trim().toLowerCase() === formData.toBankName.trim().toLowerCase();
    const isSameAccount = formData.fromAccountNo && formData.toAccountNo && formData.fromAccountNo.trim() === formData.toAccountNo.trim();
    if (isSameBank && isSameAccount) {
      alert('Source Bank Account and Destination Bank Account cannot be identical. Please choose a different destination account.');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert('Please enter a valid transfer amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const entryUser = user?.name || user?.username || user?.fullName || 'Administrator';
      const existingRecord = editingId ? fundTransfers.find(d => d._id === editingId) : null;
      const editorIdentifier = user?.employeeId || user?.username || entryUser;
      const payload = {
        ...formData,
        amount: Number(formData.amount),
        entryBy: existingRecord?.entryBy || entryUser,
        entryByName: existingRecord?.entryByName || entryUser,
        editedBy: editingId ? editorIdentifier : (existingRecord?.editedBy || undefined),
        editedByName: editingId ? entryUser : (existingRecord?.editedByName || undefined),
        updatedBy: entryUser,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/fund-transfers/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/fund-transfers`, {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      setShowModal(false);
      resetForm();
      fetchFundTransfers(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_data_updated', {
          detail: { module: 'fund-transfers', action: editingId ? 'update' : 'create' }
        }));
      }
    } catch (err) {
      console.error('Error saving fund transfer:', err);
      // Fallback local persistence
      const entryUser = user?.name || user?.username || user?.fullName || 'Administrator';
      const existingRecord = editingId ? fundTransfers.find(d => d._id === editingId) : null;
      const editorIdentifier = user?.employeeId || user?.username || entryUser;
      const newRecord = {
        ...formData,
        amount: Number(formData.amount),
        entryBy: existingRecord?.entryBy || entryUser,
        entryByName: existingRecord?.entryByName || entryUser,
        editedBy: editingId ? editorIdentifier : (existingRecord?.editedBy || undefined),
        editedByName: editingId ? entryUser : (existingRecord?.editedByName || undefined),
        updatedBy: entryUser,
        updatedAt: new Date().toISOString(),
        _id: editingId || `local_ft_${Date.now()}`,
        createdAt: existingRecord?.createdAt || new Date().toISOString()
      };
      const updated = editingId
        ? fundTransfers.map(d => d._id === editingId ? newRecord : d)
        : [newRecord, ...fundTransfers];
      setFundTransfers(updated);
      localStorage.setItem('erp_fund_transfers_cache', JSON.stringify(updated));
      setShowModal(false);
      resetForm();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_data_updated', {
          detail: { module: 'fund-transfers', action: editingId ? 'update' : 'create' }
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransfer = async (id) => {
    if (!id) return;
    if (onDeleteConfirm) {
      onDeleteConfirm({
        type: 'fund-transfer',
        id,
        isBulk: false,
        extraData: { module: 'fund-transfers' }
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this fund transfer record?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/fund-transfers/${id}`);
        fetchFundTransfers(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp_data_updated', {
            detail: { module: 'fund-transfers', action: 'delete' }
          }));
        }
      } catch (err) {
        console.error('Error deleting fund transfer:', err);
        const updated = fundTransfers.filter(d => d._id !== id);
        setFundTransfers(updated);
        localStorage.setItem('erp_fund_transfers_cache', JSON.stringify(updated));
      }
    }
  };

  // Filter and Search
  const isFilterActive = useMemo(() => {
    return !!(
      filters.fromBankName ||
      filters.toBankName ||
      filters.transferType ||
      filters.startDate ||
      filters.endDate
    );
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      fromBankName: '',
      toBankName: '',
      transferType: '',
      startDate: '',
      endDate: ''
    });
    setSearchQuery('');
  };

  const filteredTransfers = useMemo(() => {
    return fundTransfers.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchSearch =
          (item.fromBankName || '').toLowerCase().includes(q) ||
          (item.fromBranch || '').toLowerCase().includes(q) ||
          (item.fromAccountNo || '').toLowerCase().includes(q) ||
          (item.fromAccountName || '').toLowerCase().includes(q) ||
          (item.toBankName || '').toLowerCase().includes(q) ||
          (item.toBranch || '').toLowerCase().includes(q) ||
          (item.toAccountNo || '').toLowerCase().includes(q) ||
          (item.toAccountName || '').toLowerCase().includes(q) ||
          (item.referenceNo || '').toLowerCase().includes(q) ||
          (item.transferType || '').toLowerCase().includes(q) ||
          (item.remarks || '').toLowerCase().includes(q) ||
          String(item.amount || '').includes(q);
        if (!matchSearch) return false;
      }

      if (filters.fromBankName && (item.fromBankName || '').trim().toLowerCase() !== filters.fromBankName.trim().toLowerCase()) {
        return false;
      }
      if (filters.toBankName && (item.toBankName || '').trim().toLowerCase() !== filters.toBankName.trim().toLowerCase()) {
        return false;
      }
      if (filters.transferType && (item.transferType || '').trim().toLowerCase() !== filters.transferType.trim().toLowerCase()) {
        return false;
      }
      const itemDate = toDateStr(item.date || item.transferDate || item.createdAt);
      if (filters.startDate && itemDate < filters.startDate) return false;
      if (filters.endDate && itemDate > filters.endDate) return false;

      return true;
    });
  }, [fundTransfers, searchQuery, filters]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalAmount = fundTransfers.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const totalCount = fundTransfers.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTransfers = fundTransfers.filter(d => toDateStr(d.date || d.transferDate || d.createdAt) === todayStr);
    const todayAmount = todayTransfers.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthTransfers = fundTransfers.filter(d => (toDateStr(d.date || d.transferDate || d.createdAt) || '').startsWith(currentYearMonth));
    const thisMonthAmount = thisMonthTransfers.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    return {
      totalAmount,
      totalCount,
      todayAmount,
      todayCount: todayTransfers.length,
      thisMonthAmount,
      thisMonthCount: thisMonthTransfers.length
    };
  }, [fundTransfers]);

  const handlePrintVoucher = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <ArrowLeftRightIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Fund Transfer
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Bank to Bank
                </span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Transfer funds between company bank accounts with real-time balance ledger synchronization
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Socket indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
              isSocketConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={isSocketConnected ? 'Real-time sync connected' : 'Connecting real-time socket...'}
          >
            <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isSocketConnected ? 'Live' : 'Reconnecting'}</span>
          </div>

          <button
            type="button"
            onClick={() => fetchFundTransfers()}
            title="Refresh list"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition cursor-pointer"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>

          {canAdd && (
            <button
              type="button"
              onClick={openAddModal}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              <span>New Transfer</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transfers Amount */}
        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Total Transferred</span>
            <div className="text-xl font-bold text-gray-900 mt-1">
              ৳{stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">{stats.totalCount} total transfers</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSignIcon className="w-6 h-6" />
          </div>
        </div>

        {/* This Month's Transfers */}
        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">This Month</span>
            <div className="text-xl font-bold text-blue-600 mt-1">
              ৳{stats.thisMonthAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">{stats.thisMonthCount} transfers recorded</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Transfers */}
        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Today</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              ৳{stats.todayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">{stats.todayCount} transfers today</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowLeftRightIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Registered Banks */}
        <div className="bg-white p-4.5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Registered Banks</span>
            <div className="text-xl font-bold text-gray-900 mt-1">
              {registeredBankNames.length} Banks
            </div>
            <span className="text-[11px] text-gray-400 mt-0.5 block">Active bank accounts</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <BuildingIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table & Filter Container */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bank, account, ref no, remarks..."
              className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter & Reset Buttons */}
          <div className="flex items-center gap-2 relative">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setShowFilterPanel(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer ${
                isFilterActive || showFilterPanel
                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              <span>Filters</span>
              {isFilterActive && (
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              )}
            </button>

            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 bg-rose-50 rounded-lg hover:bg-rose-100 transition cursor-pointer"
              >
                Clear
              </button>
            )}

            {/* Filter Dropdown Panel */}
            {showFilterPanel && (
              <div
                ref={filterPanelRef}
                className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-100 rounded-2xl shadow-xl z-40 p-4 space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <FunnelIcon className="w-4 h-4 text-blue-600" />
                    Filter Fund Transfers
                  </h4>
                  <button
                    onClick={() => setShowFilterPanel(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <CustomDatePicker
                      label="Start Date"
                      value={filters.startDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      compact={true}
                    />
                    <CustomDatePicker
                      label="End Date"
                      value={filters.endDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      compact={true}
                    />
                  </div>

                  <SearchableFilterSelect
                    label="Source (From) Bank"
                    value={filters.fromBankName}
                    onChange={(b) => setFilters(prev => ({ ...prev, fromBankName: b }))}
                    options={registeredBankNames}
                    placeholder="All Banks"
                  />

                  <SearchableFilterSelect
                    label="Destination (To) Bank"
                    value={filters.toBankName}
                    onChange={(b) => setFilters(prev => ({ ...prev, toBankName: b }))}
                    options={registeredBankNames}
                    placeholder="All Banks"
                  />

                  <SearchableFilterSelect
                    label="Transfer Mode"
                    value={filters.transferType}
                    onChange={(t) => setFilters(prev => ({ ...prev, transferType: t }))}
                    options={TRANSFER_TYPES}
                    placeholder="All Transfer Modes"
                  />

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="flex-1 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilterPanel(false)}
                      className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Pills */}
        {isFilterActive && (
          <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100/50 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-gray-400 font-medium mr-1">Active filters:</span>
            {filters.startDate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200 font-medium">
                From: {formatDate(filters.startDate)}
                <XIcon className="w-3 h-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, startDate: '' }))} />
              </span>
            )}
            {filters.endDate && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200 font-medium">
                To: {formatDate(filters.endDate)}
                <XIcon className="w-3 h-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, endDate: '' }))} />
              </span>
            )}
            {filters.fromBankName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200 font-medium">
                From: {filters.fromBankName}
                <XIcon className="w-3 h-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, fromBankName: '' }))} />
              </span>
            )}
            {filters.toBankName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200 font-medium">
                To: {filters.toBankName}
                <XIcon className="w-3 h-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, toBankName: '' }))} />
              </span>
            )}
            {filters.transferType && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-blue-700 border border-blue-200 font-medium">
                Mode: {filters.transferType}
                <XIcon className="w-3 h-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, transferType: '' }))} />
              </span>
            )}
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto relative">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Source (From Bank)</th>
                <th className="py-3 px-2 w-10 text-center">Flow</th>
                <th className="py-3 px-4">Destination (To Bank)</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Reference #</th>
                <th className="py-3 px-4 text-right">Amount (৳)</th>
                {canShowEntryBy && <th className="py-3 px-4">Recorded By</th>}
                <th className="py-3 px-4 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={canShowEntryBy ? 10 : 9} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading fund transfers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={canShowEntryBy ? 10 : 9} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ArrowLeftRightIcon className="w-8 h-8 text-gray-300" />
                      <p className="font-semibold text-gray-500">No fund transfers found</p>
                      <p className="text-xs text-gray-400">
                        {isFilterActive || searchQuery ? 'Try adjusting your search or filters' : 'Click "+ New Transfer" to record a bank to bank transfer'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((ft, idx) => (
                  <tr
                    key={ft._id || idx}
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                    onClick={() => setViewingTransfer(ft)}
                  >
                    <td className="py-3.5 px-4 text-center font-medium text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-gray-800">
                      {formatDate(ft.date || ft.transferDate || ft.createdAt)}
                    </td>
                    {/* From Bank */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <BankLogo bankName={ft.fromBankName} className="w-7 h-7 rounded-lg shrink-0 shadow-xs" />
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate">{ft.fromBankName}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {ft.fromBranch ? `${ft.fromBranch} • ` : ''}
                            <span className="font-mono text-gray-700">{ft.fromAccountNo || 'A/C -'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Transfer Flow Arrow */}
                    <td className="py-3.5 px-2 text-center">
                      <div className="w-6 h-6 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ArrowRightIcon className="w-3.5 h-3.5" />
                      </div>
                    </td>
                    {/* To Bank */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <BankLogo bankName={ft.toBankName} className="w-7 h-7 rounded-lg shrink-0 shadow-xs" />
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 truncate">{ft.toBankName}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {ft.toBranch ? `${ft.toBranch} • ` : ''}
                            <span className="font-mono text-gray-700">{ft.toAccountNo || 'A/C -'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Transfer Mode */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                        {ft.transferType || 'Online Banking'}
                      </span>
                    </td>
                    {/* Reference # */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
                      {ft.referenceNo || '—'}
                    </td>
                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-extrabold text-blue-600 text-sm">
                        ৳{Number(ft.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    {/* Recorded By */}
                    {canShowEntryBy && (
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                          <span>{getEntryByName(ft.entryBy, ft.entryByName)}</span>
                        </div>
                      </td>
                    )}
                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingTransfer(ft)}
                          title="View Voucher"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditModal(ft)}
                            title="Edit Transfer"
                            className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition cursor-pointer"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTransfer(ft._id)}
                            title="Delete Transfer"
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
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
          <TableScrollNav />
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-gray-100">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400 text-xs">
              Loading fund transfers...
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-xs">
              No fund transfers found
            </div>
          ) : (
            filteredTransfers.map((ft, idx) => (
              <div
                key={ft._id || idx}
                className="p-4 space-y-3 hover:bg-gray-50/80 transition"
                onClick={() => setViewingTransfer(ft)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    {formatDate(ft.date || ft.transferDate || ft.createdAt)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {ft.transferType || 'Online Banking'}
                  </span>
                </div>

                {/* Transfer route summary */}
                <div className="bg-gray-50 p-3 rounded-xl space-y-2 border border-gray-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">From:</span>
                    <span className="font-bold text-gray-900">{ft.fromBankName} ({ft.fromAccountNo || 'A/C'})</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowLeftRightIcon className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">To:</span>
                    <span className="font-bold text-gray-900">{ft.toBankName} ({ft.toAccountNo || 'A/C'})</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Amount</span>
                    <span className="font-extrabold text-blue-600 text-base">
                      ৳{Number(ft.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setViewingTransfer(ft)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditModal(ft)}
                        className="p-1.5 text-gray-500 hover:text-amber-600 rounded-lg hover:bg-gray-100"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTransfer(ft._id)}
                        className="p-1.5 text-gray-500 hover:text-rose-600 rounded-lg hover:bg-gray-100"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <ArrowLeftRightIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {editingId ? 'Edit Fund Transfer' : 'New Bank to Bank Fund Transfer'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Debit from source bank and credit into destination bank
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CustomDatePicker
                  label="Transfer Date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                />

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                    Transfer Mode / Type
                  </label>
                  <select
                    value={formData.transferType}
                    onChange={(e) => setFormData(prev => ({ ...prev, transferType: e.target.value }))}
                    className="w-full h-10 px-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  >
                    {TRANSFER_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Source Account Box (From) */}
              <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase tracking-wider">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Source Account (Outflow / Debit -)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableFilterSelect
                    label="From Bank *"
                    value={formData.fromBankName}
                    onChange={handleFromBankChange}
                    options={registeredBankNames}
                    placeholder="Select Source Bank"
                    required
                  />

                  <SearchableFilterSelect
                    label="Branch"
                    value={formData.fromBranch}
                    onChange={handleFromBranchChange}
                    options={fromAvailableBranches.map(b => ({
                      value: b.branch,
                      label: `${b.branch} (${b.accountNo})`,
                      sublabel: b.accountName
                    }))}
                    placeholder={formData.fromBankName ? "Select Branch" : "Select bank first"}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={formData.fromAccountName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromAccountName: e.target.value }))}
                      placeholder="Source Account Name"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                      Account No
                    </label>
                    <input
                      type="text"
                      value={formData.fromAccountNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, fromAccountNo: e.target.value }))}
                      placeholder="Source Account No"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Destination Account Box (To) */}
              <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Destination Account (Inflow / Credit +)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SearchableFilterSelect
                    label="To Bank *"
                    value={formData.toBankName}
                    onChange={handleToBankChange}
                    options={registeredBankNames}
                    placeholder="Select Destination Bank"
                    required
                  />

                  <SearchableFilterSelect
                    label="Branch"
                    value={formData.toBranch}
                    onChange={handleToBranchChange}
                    options={toAvailableBranches.map(b => ({
                      value: b.branch,
                      label: `${b.branch} (${b.accountNo})`,
                      sublabel: b.accountName
                    }))}
                    placeholder={formData.toBankName ? "Select Branch" : "Select bank first"}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      value={formData.toAccountName}
                      onChange={(e) => setFormData(prev => ({ ...prev, toAccountName: e.target.value }))}
                      placeholder="Destination Account Name"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                      Account No
                    </label>
                    <input
                      type="text"
                      value={formData.toAccountNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, toAccountNo: e.target.value }))}
                      placeholder="Destination Account No"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Transfer Details (Amount, Reference, Person, Remarks) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                    Transfer Amount (৳) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">৳</span>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-11 pl-8 pr-4 bg-gray-50/80 border border-gray-200 rounded-xl text-base font-bold text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                    Ref # / Transaction ID / Cheque #
                  </label>
                  <input
                    type="text"
                    value={formData.referenceNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, referenceNo: e.target.value }))}
                    placeholder="e.g. TR-20261101, Chq-987123"
                    className="w-full h-11 px-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                  Transferred By / Authorized By
                </label>
                <input
                  type="text"
                  value={formData.transferredBy}
                  onChange={(e) => setFormData(prev => ({ ...prev, transferredBy: e.target.value }))}
                  placeholder="Officer / Manager name"
                  className="w-full h-10 px-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-0.5 mb-1">
                  Remarks / Note / Transfer Purpose
                </label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Purpose of fund transfer..."
                  className="w-full p-3 bg-gray-50/80 border border-gray-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingId ? 'Update Transfer' : 'Confirm Transfer'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Transfer Voucher Modal */}
      {viewingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FileTextIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Fund Transfer Voucher</h3>
                  <p className="text-xs text-gray-400">
                    {formatDate(viewingTransfer.date || viewingTransfer.transferDate || viewingTransfer.createdAt)} • {viewingTransfer.transferType || 'Online Banking'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintVoucher}
                  title="Print Voucher"
                  className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewingTransfer(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/60 transition cursor-pointer"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Voucher Body */}
            <div className="p-6 space-y-4">
              {/* Amount Highlight */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Transferred Amount</span>
                  <span className="text-2xl font-extrabold text-blue-700">
                    ৳{Number(viewingTransfer.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="px-3 py-1 bg-white/80 rounded-xl border border-blue-200 text-xs font-bold text-blue-800">
                  {viewingTransfer.transferType || 'Online Banking'}
                </div>
              </div>

              {/* Transfer Visual Journey */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                {/* From Box */}
                <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-100 space-y-1">
                  <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Debit Source Bank
                  </div>
                  <div className="font-bold text-gray-900 text-sm">{viewingTransfer.fromBankName}</div>
                  <div className="text-xs text-gray-600">Branch: {viewingTransfer.fromBranch || '—'}</div>
                  <div className="text-xs font-mono font-semibold text-rose-700">A/C: {viewingTransfer.fromAccountNo || '—'}</div>
                  {viewingTransfer.fromAccountName && (
                    <div className="text-[11px] text-gray-500">{viewingTransfer.fromAccountName}</div>
                  )}
                </div>

                {/* To Box */}
                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Credit Destination Bank
                  </div>
                  <div className="font-bold text-gray-900 text-sm">{viewingTransfer.toBankName}</div>
                  <div className="text-xs text-gray-600">Branch: {viewingTransfer.toBranch || '—'}</div>
                  <div className="text-xs font-mono font-semibold text-emerald-700">A/C: {viewingTransfer.toAccountNo || '—'}</div>
                  {viewingTransfer.toAccountName && (
                    <div className="text-[11px] text-gray-500">{viewingTransfer.toAccountName}</div>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-gray-100">
                <div>
                  <span className="text-gray-400 font-medium block">Reference / Cheque #</span>
                  <span className="font-mono font-bold text-gray-800">{viewingTransfer.referenceNo || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-medium block">Transfer Date</span>
                  <span className="font-semibold text-gray-800">
                    {formatDate(viewingTransfer.date || viewingTransfer.transferDate || viewingTransfer.createdAt)}
                  </span>
                </div>
                {viewingTransfer.transferredBy && (
                  <div>
                    <span className="text-gray-400 font-medium block">Transferred By</span>
                    <span className="font-semibold text-gray-800">{viewingTransfer.transferredBy}</span>
                  </div>
                )}
                {canShowEntryBy && viewingTransfer.entryBy && (
                  <div>
                    <span className="text-gray-400 font-medium block">Entry Recorded By</span>
                    <span className="font-semibold text-gray-800">
                      {getEntryByName(viewingTransfer.entryBy, viewingTransfer.entryByName)}
                    </span>
                  </div>
                )}
              </div>

              {viewingTransfer.remarks && (
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                    Remarks / Purpose
                  </span>
                  <p className="text-gray-700">{viewingTransfer.remarks}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                ID: <span className="font-mono">{viewingTransfer._id}</span>
              </span>
              <button
                type="button"
                onClick={() => setViewingTransfer(null)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundTransfer;
