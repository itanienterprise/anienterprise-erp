import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import { queryClient } from '../../../utils/queryClient';
import { getSocket } from '../../../utils/socket';
import { hasPermission } from '../../../utils/permissionHelper';
import {
  SearchIcon, PlusIcon, EditIcon, TrashIcon, XIcon,
  ChevronDownIcon, DollarSignIcon, BuildingIcon, CalendarIcon,
  ArrowDownLeftIcon, FileTextIcon, UserIcon, CheckCircle2Icon,
  FunnelIcon, CheckIcon
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
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

const DEPOSIT_TYPES = [
  'Cash Deposit',
  'Cheque Deposit',
  'Online Transfer',
  'Mobile Banking',
  'RTGS / BEFTN',
  'Direct Transfer',
  'Other'
];

/**
 * SearchableFilterSelect Component
 * Direct implementation matching ERP standard (Supplier.jsx / Exporter.jsx).
 * - Single unified input: the field IS the searchable element (no duplicate search bar).
 * - Live filtering as you type.
 * - ArrowUp / ArrowDown keyboard navigation.
 * - Enter key immediately selects the highlighted or top matching item.
 * - Escape or click-outside closes.
 * - Quick Clear (X) icon on the right when an option is selected.
 * - Supports both simple strings and objects with { value, label, sublabel }.
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
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Normalize options to { value, label, sublabel }
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
      String(opt.label || '').toLowerCase().includes(q) ||
      String(opt.value || '').toLowerCase().includes(q) ||
      String(opt.sublabel || '').toLowerCase().includes(q)
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

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0) {
        const target = filteredOptions[highlightedIndex] !== undefined ? filteredOptions[highlightedIndex] : filteredOptions[0];
        if (target) {
          onChange(target.value, target);
          setIsOpen(false);
          setSearch('');
          inputRef.current?.blur();
        }
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
          {/* Reset / All option (shown only when showAllOption is true) */}
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
              const isSelected = value === opt.value;
              const isHighlighted = highlightedIndex === idx;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    onChange(opt.value, opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : isHighlighted
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="truncate block font-medium">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[11px] text-gray-400 font-normal block truncate">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <CheckIcon className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1.5" />}
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
              className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 font-medium transition flex items-center justify-between"
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

const Deposit = ({ currentUser, onDeleteConfirm }) => {
  const user = currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const canAdd = hasPermission(user, 'deposit', 'add');
  const canEdit = hasPermission(user, 'deposit', 'edit');
  const canDelete = hasPermission(user, 'deposit', 'delete');
  const canShowEntryBy = hasPermission(user, 'deposit', 'showEntryBy');
  const cannotAddEdit = !canAdd && !canEdit;

  const [deposits, setDeposits] = useState(() => {
    try {
      const q = queryClient.getQueryData(['deposits']);
      if (Array.isArray(q) && q.length > 0) return q;
      const cached = localStorage.getItem('erp_deposits_cache');
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
  const [viewingDeposit, setViewingDeposit] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(null); // 'bankName' | 'branch' | 'accountNo' | 'depositType' | null
  const [filters, setFilters] = useState({
    bankName: '',
    branch: '',
    accountNo: '',
    depositType: '',
    startDate: '',
    endDate: ''
  });

  const filterPanelRef = useRef(null);
  const filterButtonRef = useRef(null);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleBankFilterSelect = (bName) => {
    setFilters(prev => ({
      ...prev,
      bankName: bName,
      branch: '',
      accountNo: ''
    }));
    setFilterDropdownOpen(null);
  };

  const handleBranchFilterSelect = (brName) => {
    setFilters(prev => ({
      ...prev,
      branch: brName,
      accountNo: ''
    }));
    setFilterDropdownOpen(null);
  };

  const handleAccountFilterSelect = (accNo) => {
    setFilters(prev => ({
      ...prev,
      accountNo: accNo
    }));
    setFilterDropdownOpen(null);
  };

  const handleTypeFilterSelect = (t) => {
    setFilters(prev => ({
      ...prev,
      depositType: t
    }));
    setFilterDropdownOpen(null);
  };

  const resetFilters = () => {
    setFilters({
      bankName: '',
      branch: '',
      accountNo: '',
      depositType: '',
      startDate: '',
      endDate: ''
    });
    setFilterDropdownOpen(null);
    setSearchQuery('');
  };

  const isFilterActive = useMemo(() => {
    return !!(
      filters.bankName ||
      filters.branch ||
      filters.accountNo ||
      filters.depositType ||
      filters.startDate ||
      filters.endDate
    );
  }, [filters]);

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
        setFilterDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterPanel]);

  const [isSocketConnected, setIsSocketConnected] = useState(() => {
    const s = getSocket();
    return !!s?.connected;
  });

  // Form State
  const initialFormState = {
    date: new Date().toISOString().split('T')[0],
    bankName: '',
    branch: '',
    accountName: '',
    accountNo: '',
    depositType: 'Cash Deposit',
    amount: '',
    referenceNo: '',
    depositedBy: '',
    remarks: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Fetch Banks for dropdown selection
  const fetchBanks = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/banks?_t=${Date.now()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setBanks(data);
      queryClient.setQueryData(['banks'], data);
    } catch (err) {
      console.error('Error fetching banks for deposit module:', err);
    }
  };

  // Fetch Deposits
  const fetchDeposits = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/deposits?_t=${Date.now()}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setDeposits(data);
      queryClient.setQueryData(['deposits'], data);
    } catch (err) {
      console.warn('API fetchDeposits failed, checking local storage cache:', err);
      try {
        const local = localStorage.getItem('erp_deposits_cache');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) setDeposits(parsed);
        }
      } catch (e) {
        // ignore
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Fetch Employees for resolving IDs / usernames to first names
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
        if (!rawFName && d.nameEn) {
          const parts = d.nameEn.trim().split(/\s+/);
          if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(parts[0].toLowerCase()) && parts.length > 1) {
            rawFName = `${parts[0]} ${parts[1]}`;
          } else {
            rawFName = parts[0];
          }
        }
        if (!rawFName && d.fullName) {
          const parts = d.fullName.trim().split(/\s+/);
          if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(parts[0].toLowerCase()) && parts.length > 1) {
            rawFName = `${parts[0]} ${parts[1]}`;
          } else {
            rawFName = parts[0];
          }
        }
        if (!rawFName && d.username) {
          rawFName = d.username.trim();
        }

        const fName = formatFirstName(rawFName || rawFullName);
        if (!fName) return;

        if (d.employeeId) {
          map[d.employeeId.toLowerCase().trim()] = fName;
          map[d.employeeId] = fName;
        }
        if (d.username) {
          map[d.username.toLowerCase().trim()] = fName;
          map[d.username] = fName;
        }
        if (d._id) {
          map[String(d._id).toLowerCase()] = fName;
          map[String(d._id)] = fName;
        }
        if (d.id) {
          map[String(d.id).toLowerCase()] = fName;
          map[String(d.id)] = fName;
        }
        if (d.name) {
          const fullNameLower = d.name.toLowerCase().trim();
          map[fullNameLower] = fName;
          map[d.name.trim()] = fName;
          const firstPart = fullNameLower.split(/\s+/)[0];
          if (firstPart) map[firstPart] = fName;
        }
        if (d.nameEn) {
          const fullNameEnLower = d.nameEn.toLowerCase().trim();
          map[fullNameEnLower] = fName;
          map[d.nameEn.trim()] = fName;
          const firstPartEn = fullNameEnLower.split(/\s+/)[0];
          if (firstPartEn) map[firstPartEn] = fName;
        }
      });

      const adminEmp = rawData.find(e => {
        let d = e;
        if (e && e.data) {
          if (typeof e.data === 'string') {
            try { d = { ...decryptData(e.data), _id: e._id }; } catch { /* ignore */ }
          } else if (typeof e.data === 'object') {
            d = { ...e.data, _id: e._id };
          }
        }
        const r = (d.role || '').toLowerCase();
        const eid = (d.employeeId || '').toLowerCase();
        return r === 'admin' || eid === 'a-1001';
      });
      let adminFirstName = 'Anil';
      if (adminEmp) {
        let d = adminEmp;
        if (adminEmp && adminEmp.data) {
          if (typeof adminEmp.data === 'string') {
            try { d = { ...decryptData(adminEmp.data), _id: adminEmp._id }; } catch { /* ignore */ }
          } else if (typeof adminEmp.data === 'object') {
            d = { ...adminEmp.data, _id: adminEmp._id };
          }
        }
        const resolvedAdmin = formatFirstName((d.firstName || '').trim() || (d.name || '').trim().split(/\s+/)[0]);
        if (resolvedAdmin) adminFirstName = resolvedAdmin;
      }
      map['admin'] = 'Administrator';
      map['administrator'] = 'Administrator';
      map['a-1001'] = adminFirstName;

      setEmployeesMap(map);
    } catch (error) {
      console.error('Error fetching employees map in Deposit:', error);
    }
  };

  const getFirstNameFromIdentifier = (identifier) => {
    if (!identifier || identifier === '-' || identifier === '—') return '';
    const rawStr = String(identifier).trim();
    const key = rawStr.toLowerCase();
    if (key === 'admin' || key === 'administrator') {
      return 'Administrator';
    }
    if (employeesMap[key]) {
      return employeesMap[key];
    }
    if (employeesMap[rawStr]) {
      return employeesMap[rawStr];
    }
    const parts = rawStr.split(/\s+/);
    if (['md', 'md.', 'mohammad', 'mst', 'mst.'].includes(parts[0].toLowerCase()) && parts.length > 1) {
      const prefixKey = `${parts[0]} ${parts[1]}`.toLowerCase();
      if (employeesMap[prefixKey]) return employeesMap[prefixKey];
    }
    const firstWord = parts[0];
    if (employeesMap[firstWord.toLowerCase()]) {
      return employeesMap[firstWord.toLowerCase()];
    }
    if (key === 'a-1001') {
      return 'Anil';
    }
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

  const getEditedByName = (editedByCode, editedByName) => {
    const candidate = editedByName || editedByCode;
    if (!candidate || candidate === '-' || candidate === '—') return '';
    return getFirstNameFromIdentifier(candidate) || candidate;
  };

  useEffect(() => {
    fetchBanks();
    fetchDeposits();
    fetchEmployees();

    const socket = getSocket();
    setIsSocketConnected(!!socket?.connected);

    const handleRealtimeUpdate = (data) => {
      const mod = (data?.module || '').toLowerCase().trim();
      console.log('[Deposit] Real-time socket event received:', data);
      if (!mod || mod === 'deposits' || mod === 'deposit' || mod === 'all') {
        fetchDeposits(true);
      }
      if (mod === 'banks' || mod === 'bank' || mod === 'all') {
        fetchBanks();
      }
      if (mod === 'employees' || mod === 'employee' || mod === 'all') {
        fetchEmployees();
      }
    };

    const onCustomEvent = (e) => {
      handleRealtimeUpdate(e?.detail);
    };

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

    // Fallback polling every 30s while viewing Deposit module
    const pollTimer = setInterval(() => {
      fetchDeposits(true);
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

  // Unique bank names (deduplicated case-insensitively) across all bank records & existing deposits
  const uniqueBankNames = useMemo(() => {
    const seen = new Map();
    [...banks.map(b => b.bankName), ...deposits.map(d => d.bankName)].forEach(name => {
      if (!name) return;
      const clean = name.trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.set(lower, clean);
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [banks, deposits]);

  // When Bank is selected in Form, populate branches & accounts across all matching bank records
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

    // Also include branches recorded in historical deposits for this bank if any
    deposits
      .filter(d => (d.bankName || '').trim().toLowerCase() === targetName && d.branch)
      .forEach(d => {
        list.push({
          branch: d.branch.trim(),
          accountName: (d.accountName || '').trim(),
          accountNo: (d.accountNo || '').trim()
        });
      });

    const seen = new Set();
    return list.filter(item => {
      const key = `${(item.branch || '').toLowerCase()}|${(item.accountNo || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [banks, deposits, formData.bankName]);

  const handleBankChange = (valOrEvent) => {
    const bName = typeof valOrEvent === 'string' ? valOrEvent : (valOrEvent?.target?.value || '');
    if (!bName) {
      setFormData(prev => ({
        ...prev,
        bankName: '',
        branch: '',
        accountName: '',
        accountNo: ''
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
              accountNo: (br.accountNo || b.accountNo || '').trim()
            });
          }
        });
      } else if (b.branch) {
        branches.push({
          branch: b.branch.trim(),
          accountName: (b.accountName || '').trim(),
          accountNo: (b.accountNo || '').trim()
        });
      }
    });
    const firstBranch = branches[0];

    setFormData(prev => ({
      ...prev,
      bankName: bName,
      branch: firstBranch?.branch || '',
      accountName: firstBranch?.accountName || '',
      accountNo: firstBranch?.accountNo || ''
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
      accountNo: branchObj ? branchObj.accountNo : (branchName ? prev.accountNo : '')
    }));
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openEditModal = (dep) => {
    setEditingId(dep._id);
    setFormData({
      date: dep.date || new Date().toISOString().split('T')[0],
      bankName: dep.bankName || '',
      branch: dep.branch || '',
      accountName: dep.accountName || '',
      accountNo: dep.accountNo || '',
      depositType: dep.depositType || 'Cash Deposit',
      amount: dep.amount || '',
      referenceNo: dep.referenceNo || '',
      depositedBy: dep.depositedBy || '',
      remarks: dep.remarks || dep.note || ''
    });
    setShowModal(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bankName) {
      alert('Please select a bank.');
      return;
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      alert('Please enter a valid deposit amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const entryUser = user?.name || user?.username || user?.fullName || 'Administrator';
      const existingRecord = editingId ? deposits.find(d => d._id === editingId) : null;
      const editorIdentifier = user?.employeeId || user?.username || entryUser;
      const payload = {
        ...formData,
        note: formData.remarks,
        amount: Number(formData.amount),
        entryBy: existingRecord?.entryBy || entryUser,
        entryByName: existingRecord?.entryByName || entryUser,
        editedBy: editingId ? editorIdentifier : (existingRecord?.editedBy || undefined),
        editedByName: editingId ? entryUser : (existingRecord?.editedByName || undefined),
        updatedBy: entryUser,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/deposits/${editingId}`, payload);
      } else {
        await axios.post(`${API_BASE_URL}/api/deposits`, {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      setShowModal(false);
      resetForm();
      fetchDeposits(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_data_updated', {
          detail: { module: 'deposits', action: editingId ? 'update' : 'create' }
        }));
      }
    } catch (err) {
      console.error('Error saving deposit:', err);
      // Fallback local persistence if server is unavailable
      const entryUser = user?.name || user?.username || user?.fullName || 'Administrator';
      const existingRecord = editingId ? deposits.find(d => d._id === editingId) : null;
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
        _id: editingId || `local_dep_${Date.now()}`,
        createdAt: existingRecord?.createdAt || new Date().toISOString()
      };
      const updated = editingId
        ? deposits.map(d => d._id === editingId ? newRecord : d)
        : [newRecord, ...deposits];
      setDeposits(updated);
      localStorage.setItem('erp_deposits_cache', JSON.stringify(updated));
      setShowModal(false);
      resetForm();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_data_updated', {
          detail: { module: 'deposits', action: editingId ? 'update' : 'create' }
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (onDeleteConfirm) {
      onDeleteConfirm({
        type: 'deposit',
        id: id,
        isBulk: false
      });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this deposit record?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/deposits/${id}`);
      fetchDeposits(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_data_updated', {
          detail: { module: 'deposits', action: 'delete' }
        }));
      }
    } catch (err) {
      console.error('Error deleting deposit:', err);
      const filtered = deposits.filter(d => d._id !== id);
      setDeposits(filtered);
      localStorage.setItem('erp_deposits_cache', JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp_data_updated', {
          detail: { module: 'deposits', action: 'delete' }
        }));
      }
    }
  };

  // Available filter branches for selected bank (aggregating across all documents for this bank)
  const filterBranches = useMemo(() => {
    if (!filters.bankName) return [];
    const targetBankName = filters.bankName.trim().toLowerCase();
    const matchingBankDocs = banks.filter(b => (b.bankName || '').trim().toLowerCase() === targetBankName);

    const fromMaster = [];
    matchingBankDocs.forEach(b => {
      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          if (br && br.branch) fromMaster.push(br.branch.trim());
        });
      } else if (b.branch) {
        fromMaster.push(b.branch.trim());
      }
    });

    const fromDeposits = deposits
      .filter(d => (d.bankName || '').trim().toLowerCase() === targetBankName)
      .map(d => (d.branch || '').trim())
      .filter(Boolean);

    // Deduplicate branches (case-insensitive deduplication, preserving clean display)
    const seen = new Map();
    [...fromMaster, ...fromDeposits].forEach(br => {
      const clean = br.trim();
      const lower = clean.toLowerCase();
      if (clean && !seen.has(lower)) {
        seen.set(lower, clean);
      }
    });

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [banks, deposits, filters.bankName]);

  // Available filter accounts for selected bank and branch
  const filterAccounts = useMemo(() => {
    if (!filters.bankName || !filters.branch) return [];
    const targetBankName = filters.bankName.trim().toLowerCase();
    const targetBranchName = filters.branch.trim().toLowerCase();

    const matchingBankDocs = banks.filter(b => (b.bankName || '').trim().toLowerCase() === targetBankName);
    const list = [];
    matchingBankDocs.forEach(b => {
      if (Array.isArray(b.branches) && b.branches.length > 0) {
        b.branches.forEach(br => {
          if (br && (br.branch || '').trim().toLowerCase() === targetBranchName) {
            list.push({
              accountNo: (br.accountNo || '').trim(),
              accountName: (br.accountName || b.accountName || '').trim()
            });
          }
        });
      } else if (b.branch && (b.branch || '').trim().toLowerCase() === targetBranchName) {
        list.push({
          accountNo: (b.accountNo || '').trim(),
          accountName: (b.accountName || '').trim()
        });
      }
    });

    const fromDeposits = deposits
      .filter(d =>
        (d.bankName || '').trim().toLowerCase() === targetBankName &&
        (d.branch || '').trim().toLowerCase() === targetBranchName
      )
      .map(d => ({
        accountNo: (d.accountNo || '').trim(),
        accountName: (d.accountName || '').trim()
      }));

    const map = new Map();
    [...list, ...fromDeposits].forEach(acc => {
      if (acc.accountNo && !map.has(acc.accountNo)) {
        map.set(acc.accountNo, acc.accountName || '');
      }
    });

    return Array.from(map.entries()).map(([accountNo, accountName]) => ({
      accountNo,
      accountName
    }));
  }, [banks, deposits, filters.bankName, filters.branch]);

  // Filtered deposits
  const filteredDeposits = useMemo(() => {
    return deposits.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (item.bankName && item.bankName.toLowerCase().includes(q)) ||
        (item.branch && item.branch.toLowerCase().includes(q)) ||
        (item.accountNo && item.accountNo.toLowerCase().includes(q)) ||
        (item.accountName && item.accountName.toLowerCase().includes(q)) ||
        (item.referenceNo && item.referenceNo.toLowerCase().includes(q)) ||
        (item.depositedBy && item.depositedBy.toLowerCase().includes(q)) ||
        (item.depositType && item.depositType.toLowerCase().includes(q)) ||
        (item.remarks && item.remarks.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.entryBy && item.entryBy.toLowerCase().includes(q)) ||
        (item.entryByName && item.entryByName.toLowerCase().includes(q)) ||
        (item.editedBy && item.editedBy.toLowerCase().includes(q)) ||
        (item.editedByName && item.editedByName.toLowerCase().includes(q)) ||
        (getEntryByName(item.entryBy, item.entryByName).toLowerCase().includes(q)) ||
        (getEditedByName(item.editedBy, item.editedByName).toLowerCase().includes(q));

      const matchBank = !filters.bankName || (item.bankName || '').trim().toLowerCase() === filters.bankName.trim().toLowerCase();
      const matchBranch = !filters.branch || (item.branch || '').trim().toLowerCase() === filters.branch.trim().toLowerCase();
      const matchAccount = !filters.accountNo || (item.accountNo || '').trim() === filters.accountNo.trim();
      const matchType = !filters.depositType || (item.depositType || '').trim().toLowerCase() === filters.depositType.trim().toLowerCase();

      let matchDate = true;
      if (filters.startDate || filters.endDate) {
        const itemDate = toDateStr(item.date);
        if (filters.startDate && itemDate < filters.startDate) matchDate = false;
        if (filters.endDate && itemDate > filters.endDate) matchDate = false;
      }

      return matchSearch && matchBank && matchBranch && matchAccount && matchType && matchDate;
    });
  }, [deposits, searchQuery, filters]);

  // Statistics
  const stats = useMemo(() => {
    const totalAmount = deposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const count = deposits.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayAmount = deposits
      .filter(d => toDateStr(d.date) === todayStr)
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const activeBanks = new Set(deposits.map(d => d.bankName).filter(Boolean)).size;

    return { totalAmount, count, todayAmount, activeBanks };
  }, [deposits]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header and Action Controls - Hidden while Form Card is Open */}
      {!showModal && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-1/4 text-center md:text-left">
          <h2 className="text-2xl font-bold text-gray-800">Deposit Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">Track, record, and reconcile incoming bank deposits</p>
        </div>

        {/* Search Input */}
        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
          <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search deposits by bank, account, slip #, depositor..."
            autoComplete="off"
            className="h-10 block w-full pl-10 pr-4 bg-white/70 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Action Controls: Filter Button + Add Button */}
        <div className="flex items-center justify-center md:justify-end gap-2.5 w-full md:w-auto shrink-0">
          {/* Filter Dropdown */}
          <div className="relative">
            <button
              ref={filterButtonRef}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`h-10 flex items-center justify-center gap-2 px-4 rounded-xl border transition-all active:scale-95 text-sm font-medium shadow-sm ${
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
                    <h4 className="font-bold text-gray-900 text-sm">Filter Deposits</h4>
                    <button
                      onClick={resetFilters}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                    >
                      Reset
                    </button>
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

                    {/* Bank Filter */}
                    <SearchableFilterSelect
                      label="Bank Name"
                      value={filters.bankName}
                      onChange={(name) => handleBankFilterSelect(name)}
                      options={uniqueBankNames}
                      placeholder="All Banks"
                    />

                    {/* Branch Filter - Shown only after Bank is selected */}
                    {filters.bankName && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <SearchableFilterSelect
                          label="Branch"
                          value={filters.branch}
                          onChange={(br) => handleBranchFilterSelect(br)}
                          options={filterBranches}
                          placeholder="All Branches"
                        />
                      </div>
                    )}

                    {/* Account Filter - Shown only after Branch is selected */}
                    {filters.bankName && filters.branch && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                        <SearchableFilterSelect
                          label="Account No / Name"
                          value={filters.accountNo}
                          displayValue={
                            filters.accountNo
                              ? `${filters.accountNo}${filterAccounts.find(a => a.accountNo === filters.accountNo)?.accountName ? ` (${filterAccounts.find(a => a.accountNo === filters.accountNo)?.accountName})` : ''}`
                              : ''
                          }
                          onChange={(accNo) => handleAccountFilterSelect(accNo)}
                          options={filterAccounts.map(a => ({
                            value: a.accountNo,
                            label: a.accountNo,
                            sublabel: a.accountName
                          }))}
                          placeholder="All Accounts"
                        />
                      </div>
                    )}

                    {/* Deposit Type Filter */}
                    <SearchableFilterSelect
                      label="Deposit Type"
                      value={filters.depositType}
                      onChange={(t) => handleTypeFilterSelect(t)}
                      options={DEPOSIT_TYPES}
                      placeholder="All Deposit Types"
                    />

                    <button
                      onClick={() => {
                        setShowFilterPanel(false);
                        setFilterDropdownOpen(null);
                      }}
                      className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]"
                    >
                      APPLY FILTERS
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Add Deposit Button */}
          {!cannotAddEdit && (
            <button
              onClick={openAddModal}
              data-action="Create New Deposit"
              className="h-10 border border-transparent px-4.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center text-sm gap-2 whitespace-nowrap cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Record Deposit</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* Add / Edit Bank Deposit Card (Matches New Collection Card Style) */}
      {showModal && (
        <div className="payment-form-container">
          {/* Header */}
          <div className="payment-form-header">
            <div>
              <h3 className="payment-form-title">
                {editingId ? 'Edit Bank Deposit' : 'New Bank Deposit Entry'}
              </h3>
              <p className="text-xs text-gray-500 font-medium italic">
                Record a deposit transaction to a bank account
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowModal(false); resetForm(); }}
              className="payment-form-close"
              title="Close form"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
              }
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10"
          >
            {/* Row 1: Date, Bank, Branch, Deposit Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Deposit Date *
              </label>
              <CustomDatePicker
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                compact={false}
              />
            </div>

            <div className="space-y-2">
              <SearchableFilterSelect
                label="Select Bank *"
                labelClassName="text-sm font-medium text-gray-700 ml-1"
                required
                value={formData.bankName}
                onChange={handleBankChange}
                options={uniqueBankNames}
                placeholder="-- Choose Bank --"
                showAllOption={false}
                inputClassName="h-10 payment-form-input pr-8"
              />
            </div>

            <div className="space-y-2">
              <SearchableFilterSelect
                label="Branch"
                labelClassName="text-sm font-medium text-gray-700 ml-1"
                value={formData.branch}
                onChange={handleBranchChange}
                options={availableBranches.map(br => ({
                  value: br.branch,
                  label: br.branch,
                  sublabel: br.accountNo ? `A/C: ${br.accountNo}${br.accountName ? ` (${br.accountName})` : ''}` : '',
                  accountNo: br.accountNo,
                  accountName: br.accountName
                }))}
                placeholder={availableBranches.length > 0 ? '-- Select Branch --' : 'Branch name'}
                allowCustomValue={true}
                showAllOption={false}
                inputClassName="h-10 payment-form-input pr-8"
              />
            </div>

            <div className="space-y-2">
              <SearchableFilterSelect
                label="Deposit Type"
                labelClassName="text-sm font-medium text-gray-700 ml-1"
                value={formData.depositType}
                onChange={(val) => setFormData(prev => ({ ...prev, depositType: val || 'Cash Deposit' }))}
                options={DEPOSIT_TYPES}
                placeholder="Select Deposit Type"
                showAllOption={false}
                inputClassName="h-10 payment-form-input pr-8"
              />
            </div>

            {/* Row 2: Account Number, Account Name, Amount, Slip/Ref # */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Account Number
              </label>
              <input
                type="text"
                placeholder="e.g. 1234567890"
                value={formData.accountNo}
                onChange={(e) => setFormData({ ...formData, accountNo: e.target.value })}
                className="h-10 payment-form-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Account Name
              </label>
              <input
                type="text"
                placeholder="Account holder / entity"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                className="h-10 payment-form-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Amount (BDT) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">৳</span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="h-10 payment-form-input pl-8 font-semibold text-gray-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Slip / Ref / Cheque #
              </label>
              <input
                type="text"
                placeholder="e.g. SLIP-10294"
                value={formData.referenceNo}
                onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                className="h-10 payment-form-input"
              />
            </div>

            {/* Row 3: Deposited By & Remarks */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Deposited By (Person / Source)
              </label>
              <input
                type="text"
                placeholder="Name of depositor or representative"
                value={formData.depositedBy}
                onChange={(e) => setFormData({ ...formData, depositedBy: e.target.value })}
                className="h-10 payment-form-input"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 ml-1">
                Remarks / Note
              </label>
              <textarea
                rows="2"
                placeholder="Optional notes regarding this deposit..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="payment-form-input resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="lg:col-span-4 md:col-span-2 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/25 transition transform active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingId ? 'Update Deposit' : 'Record Deposit'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPI Overview & Table Section - Hidden while Card is Open */}
      {!showModal && (
        <div className="space-y-4 md:space-y-6">
          {/* KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deposits Card */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Deposits</p>
              <h3 className="text-xl font-bold text-gray-900 mt-1">
                ৳{stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
              <DollarSignIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">Cumulative deposits recorded</p>
        </div>

        {/* Transactions Card */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Entries</p>
              <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.count}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
              <FileTextIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">All deposit transaction entries</p>
        </div>

        {/* Today's Deposits Card */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today's Deposit</p>
              <h3 className="text-xl font-bold text-emerald-600 mt-1">
                ৳{stats.todayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
              <ArrowDownLeftIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">Deposited today</p>
        </div>

        {/* Receiving Banks */}
        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4.5 border border-white/60 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Receiving Banks</p>
              <h3 className="text-xl font-bold text-gray-900 mt-1">{stats.activeBanks}</h3>
            </div>
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shadow-sm">
              <BuildingIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">Banks with active deposits</p>
        </div>
      </div>

      {/* Active Filter Badges */}
      {isFilterActive && (
        <div className="flex items-center gap-2 flex-wrap text-xs px-1">
          <span className="font-semibold text-gray-400 text-[11px] uppercase tracking-wider">Active Filters:</span>
          {filters.bankName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Bank: {filters.bankName}
              <button onClick={() => handleFilterChange('bankName', '')} className="hover:text-blue-900 cursor-pointer">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.branch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Branch: {filters.branch}
              <button onClick={() => handleFilterChange('branch', '')} className="hover:text-blue-900 cursor-pointer">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.accountNo && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              A/C: {filters.accountNo}
              <button onClick={() => handleFilterChange('accountNo', '')} className="hover:text-blue-900 cursor-pointer">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.depositType && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Type: {filters.depositType}
              <button onClick={() => handleFilterChange('depositType', '')} className="hover:text-blue-900 cursor-pointer">
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.startDate || filters.endDate) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Date: {filters.startDate || '...'} to {filters.endDate || '...'}
              <button
                onClick={() => {
                  handleFilterChange('startDate', '');
                  handleFilterChange('endDate', '');
                }}
                className="hover:text-blue-900 cursor-pointer"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={resetFilters}
            className="text-[11px] font-bold text-gray-500 hover:text-gray-700 underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1150px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Date</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Bank</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Branch</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Account No</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Account Name</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Deposit Type</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Slip / Ref #</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Deposited By</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">Remarks / Note</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Amount (BDT)</th>
                {canShowEntryBy && (
                  <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Entry By</th>
                )}
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={canShowEntryBy ? 12 : 11} className="px-5 py-12 text-center text-gray-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-sm">Loading deposit records...</p>
                  </td>
                </tr>
              ) : filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={canShowEntryBy ? 12 : 11} className="px-5 py-16 text-center text-gray-400">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl mx-auto flex items-center justify-center">
                        <ArrowDownLeftIcon className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">No deposit records found</p>
                      <p className="text-xs text-gray-400">
                        {searchQuery || isFilterActive
                          ? "Try modifying your search or filter criteria."
                          : "Click 'Record Deposit' above to add your first deposit entry."}
                      </p>
                      {!cannotAddEdit && (
                        <button
                          onClick={openAddModal}
                          className="mt-2 inline-flex items-center px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          <PlusIcon className="w-3.5 h-3.5 mr-1" /> Record Deposit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((item, idx) => (
                  <tr
                    key={item._id || idx}
                    className="hover:bg-gray-50/50 transition-colors group border-b border-gray-100 last:border-b-0"
                  >
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-bold text-gray-700">
                      {item.bankName || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600">
                      {item.branch ? (item.branch.toLowerCase().includes('branch') ? item.branch : `${item.branch} Branch`) : '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600 font-mono">
                      {item.accountNo || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600">
                      {item.accountName || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.depositType || 'Deposit'}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600 font-mono">
                      {item.referenceNo || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600">
                      {item.depositedBy || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-[13px] font-medium text-gray-600 max-w-[200px] truncate" title={item.remarks || item.note || ''}>
                      {item.remarks || item.note || '—'}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right font-bold text-emerald-600 text-[13px]">
                      ৳{(Number(item.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {canShowEntryBy && (
                      <td className="px-5 py-4 whitespace-nowrap text-center align-middle">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="text-xs font-semibold text-gray-700">
                            {getEntryByName(item.entryBy, item.entryByName || item.createdBy || item.createdByName || item.userName || item.user)}
                          </span>
                          {(item.editedBy || item.editedByName || (item.updatedBy && item.updatedBy !== item.entryBy && item.updatedBy !== item.entryByName)) && (
                            <span className="text-[10px] text-amber-600 font-medium">
                              ✎ {getEditedByName(item.editedBy, item.editedByName || item.updatedBy)}
                            </span>
                          )}
                          {(item.approvedByName || item.approvedBy) && (
                            <span className="text-[10px] text-emerald-600 font-semibold" title="Approved">
                              ✓ {getFirstNameFromIdentifier(item.approvedByName || item.approvedBy)}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => setViewingDeposit(item)}
                          title="View Deposit Voucher"
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit Deposit"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(item._id)}
                            title="Delete Deposit"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
    </div>
  )}

      {/* View Deposit Voucher Modal */}
      {viewingDeposit && typeof document !== 'undefined' && document.body && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setViewingDeposit(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <BuildingIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900">Deposit Voucher</h3>
              </div>
              <button
                onClick={() => setViewingDeposit(null)}
                className="p-1 hover:bg-gray-200/70 rounded-lg transition text-gray-400"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500">Deposit Amount</span>
                  <div className="text-2xl font-black text-blue-600 mt-0.5">
                    ৳{(Number(viewingDeposit.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  {viewingDeposit.depositType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium">Bank</span>
                  <div className="font-semibold text-gray-800 mt-0.5">{viewingDeposit.bankName || '—'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium">Branch</span>
                  <div className="font-semibold text-gray-800 mt-0.5">{viewingDeposit.branch || '—'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium">Account No</span>
                  <div className="font-semibold text-gray-800 font-mono mt-0.5">{viewingDeposit.accountNo || '—'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium">Account Name</span>
                  <div className="font-semibold text-gray-800 mt-0.5">{viewingDeposit.accountName || '—'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium">Date</span>
                  <div className="font-semibold text-gray-800 mt-0.5">{formatDate(viewingDeposit.date)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 font-medium">Slip / Reference #</span>
                  <div className="font-semibold text-gray-800 font-mono mt-0.5">{viewingDeposit.referenceNo || '—'}</div>
                </div>
              </div>

              {viewingDeposit.depositedBy && (
                <div className="p-3 bg-gray-50 rounded-xl text-xs">
                  <span className="text-gray-400 font-medium">Deposited By</span>
                  <div className="font-semibold text-gray-800 mt-0.5">{viewingDeposit.depositedBy}</div>
                </div>
              )}

              {(viewingDeposit.remarks || viewingDeposit.note) && (
                <div className="p-3 bg-gray-50 rounded-xl text-xs">
                  <span className="text-gray-400 font-medium">Remarks / Note</span>
                  <div className="text-gray-700 mt-0.5">{viewingDeposit.remarks || viewingDeposit.note}</div>
                </div>
              )}

              {canShowEntryBy && (viewingDeposit.entryByName || viewingDeposit.entryBy || viewingDeposit.createdBy) && (
                <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
                  <span className="text-gray-400 font-medium block">Entry By</span>
                  <div className="font-semibold text-gray-800">
                    {getEntryByName(viewingDeposit.entryBy, viewingDeposit.entryByName || viewingDeposit.createdBy || viewingDeposit.createdByName || viewingDeposit.userName || viewingDeposit.user)}
                  </div>
                  {(viewingDeposit.editedBy || viewingDeposit.editedByName || (viewingDeposit.updatedBy && viewingDeposit.updatedBy !== viewingDeposit.entryBy && viewingDeposit.updatedBy !== viewingDeposit.entryByName)) && (
                    <div className="text-[11px] text-amber-600 font-medium">
                      ✎ Edited: {getEditedByName(viewingDeposit.editedBy, viewingDeposit.editedByName || viewingDeposit.updatedBy)}
                    </div>
                  )}
                  {(viewingDeposit.approvedByName || viewingDeposit.approvedBy) && (
                    <div className="text-[11px] text-emerald-600 font-semibold">
                      ✓ Approved: {getFirstNameFromIdentifier(viewingDeposit.approvedByName || viewingDeposit.approvedBy)}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setViewingDeposit(null)}
                  className="px-4 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Deposit;
