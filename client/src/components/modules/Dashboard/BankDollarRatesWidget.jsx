import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { getSocket } from '../../../utils/socket';
import { hasPermission } from '../../../utils/permissionHelper';
import BankLogo from '../Bank/BankLogo';
import { RefreshIcon } from '../../Icons';

const BanknotesIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const ArrowsUpDownIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const GripVerticalIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01" />
  </svg>
);

const EyeIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const PencilSquareIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const isForeignBank = (name = '') => {
  const lower = (name || '').toLowerCase();
  return (
    lower.includes('icici') ||
    lower.includes('jammu') ||
    lower.includes('kashmir') ||
    lower.includes('kolkata') ||
    lower.includes('srinagar') ||
    lower.includes('india') ||
    lower.includes('state bank of india')
  );
};

// Format rate date nicely e.g. "19 Nov 2026"
const formatRateDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const m = str.match(/([0-9]{1,2})[-\/_ ]([A-Za-z]{3,9})[-\/_ ]([0-9]{4})/i) ||
            str.match(/([A-Za-z]{3,9})[-\/_ ]([0-9]{1,2}),?[-\/_ ]([0-9]{4})/i);
  if (m) {
    const day = m[1].length <= 2 ? m[1] : m[2];
    const monthRaw = m[1].length <= 2 ? m[2] : m[1];
    const year = m[3];
    const month = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1, 3).toLowerCase();
    return `${day} ${month} ${year}`;
  }
  try {
    const parts = str.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const d = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
  } catch (e) {}
  return str;
};

const BankDollarRatesWidget = ({ currentUser: propUser, onNavigate, className = '' }) => {
  const currentUser = useMemo(() => {
    if (propUser) return propUser;
    try {
      const saved = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [propUser]);

  const canSyncDollarRates = useMemo(() => {
    if (!currentUser) return false;
    const roleLower = (currentUser.role || '').toLowerCase().trim();
    const username = (currentUser.username || '').toLowerCase().trim();
    if (roleLower === 'admin' || username === 'admin') return true;

    return (
      hasPermission(currentUser, 'dashboard', 'syncDollarRates') ||
      hasPermission(currentUser, 'bank', 'syncDollarRates')
    );
  }, [currentUser]);

  const [ratesData, setRatesData] = useState(() => {
    try {
      const saved = localStorage.getItem('bank_dollar_rates_cache');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const saved = localStorage.getItem('bank_dollar_rates_cache');
      return !saved || JSON.parse(saved).length === 0;
    } catch (e) {
      return true;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'increase' | 'decrease'
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    try {
      return localStorage.getItem('bank_dollar_rates_last_sync') || '';
    } catch (e) {
      return '';
    }
  });

  // Custom Serial Order (Persisted in localStorage)
  const [customSerialOrder, setCustomSerialOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('bank_dollar_rates_serial_order');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Reorder / Sort & Edit Modal state
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('order'); // 'order' | 'rates'
  const [modalBanks, setModalBanks] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [editableRates, setEditableRates] = useState(() => {
    try {
      const saved = localStorage.getItem('bank_dollar_rates_cache');
      const list = saved ? JSON.parse(saved) : [];
      const initial = {};
      list.forEach(b => {
        initial[b.bankName] = {
          todayRate: b.todayRate != null ? String(b.todayRate) : '',
          previousRate: b.previousRate != null ? String(b.previousRate) : ''
        };
      });
      return initial;
    } catch (e) {
      return {};
    }
  });
  const [savingBank, setSavingBank] = useState(null);
  const [saveSuccessBank, setSaveSuccessBank] = useState(null);

  const hasCachedRatesRef = useRef(ratesData.length > 0);
  useEffect(() => {
    hasCachedRatesRef.current = ratesData.length > 0;
  }, [ratesData]);

  const fetchRates = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsSyncing(true);
      else if (!hasCachedRatesRef.current) setIsLoading(true);

      const url = `${API_BASE_URL}/api/bank-dollar-rates${refresh ? '?refresh=true' : ''}`;
      const res = await axios.get(url);
      if (Array.isArray(res.data)) {
        // Exclude any non-BD banks
        const bdOnly = res.data.filter(r => !isForeignBank(r.bankName));
        setRatesData(bdOnly);
        try {
          localStorage.setItem('bank_dollar_rates_cache', JSON.stringify(bdOnly));
        } catch (e) {}

        const syncTime = bdOnly[0]?.lastUpdated || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        setLastSyncTime(syncTime);
        try {
          localStorage.setItem('bank_dollar_rates_last_sync', syncTime);
        } catch (e) {}

        // Initialize editable rates map
        const initialRates = {};
        bdOnly.forEach(b => {
          initialRates[b.bankName] = {
            todayRate: b.todayRate != null ? String(b.todayRate) : '',
            previousRate: b.previousRate != null ? String(b.previousRate) : ''
          };
        });
        setEditableRates(initialRates);
      }
    } catch (err) {
      console.warn('Failed to load bank dollar rates:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Real-time socket sync with debounce to prevent socket storms
  const lastSocketSyncRef = useRef(0);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data) => {
      if (data?.module === 'bank-dollar-rates') {
        const now = Date.now();
        if (now - lastSocketSyncRef.current < 4000) return;
        lastSocketSyncRef.current = now;
        fetchRates(false);
      }
    };
    socket.on('data_updated', handler);
    return () => {
      socket.off('data_updated', handler);
    };
  }, [fetchRates]);

  const handleSyncFromWebsites = async () => {
    if (!canSyncDollarRates) return;
    try {
      setIsSyncing(true);
      await axios.post(`${API_BASE_URL}/api/bank-dollar-rates/sync`);
      await fetchRates(false);
    } catch (err) {
      console.warn('Bank rate sync error:', err);
      await fetchRates(true);
    } finally {
      setIsSyncing(false);
    }
  };

  // Open Reorder Modal and initialize with active custom serial order
  const handleOpenSortModal = (tab = 'order') => {
    setModalTab(tab);
    const validBanks = ratesData.filter(r => !isForeignBank(r.bankName));
    if (customSerialOrder && customSerialOrder.length > 0) {
      const orderMap = new Map();
      customSerialOrder.forEach((name, idx) => orderMap.set(name, idx));
      const sorted = [...validBanks].sort((a, b) => {
        const idxA = orderMap.has(a.bankName) ? orderMap.get(a.bankName) : 999;
        const idxB = orderMap.has(b.bankName) ? orderMap.get(b.bankName) : 999;
        if (idxA !== idxB) return idxA - idxB;
        return a.bankName.localeCompare(b.bankName);
      });
      setModalBanks(sorted);
    } else {
      setModalBanks([...validBanks]);
    }

    // Refresh editable rates
    const currentRates = {};
    validBanks.forEach(b => {
      currentRates[b.bankName] = {
        todayRate: b.todayRate != null ? String(b.todayRate) : '',
        previousRate: b.previousRate != null ? String(b.previousRate) : ''
      };
    });
    setEditableRates(currentRates);
    setIsSortModalOpen(true);
  };

  // Move item in modal
  const moveModalItem = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= modalBanks.length) return;
    const updated = [...modalBanks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setModalBanks(updated);
  };

  // Drag and Drop handlers
  const handleDragStart = (idx) => {
    setDraggedIdx(idx);
  };

  const handleDrop = (targetIdx) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    moveModalItem(draggedIdx, targetIdx);
    setDraggedIdx(null);
  };

  // Presets in modal
  const handlePresetSort = (type) => {
    const list = [...modalBanks];
    if (type === 'high-to-low') {
      list.sort((a, b) => {
        if (a.todayRate != null && b.todayRate == null) return -1;
        if (a.todayRate == null && b.todayRate != null) return 1;
        if (a.todayRate == null && b.todayRate == null) return a.bankName.localeCompare(b.bankName);
        return (b.todayRate || 0) - (a.todayRate || 0);
      });
    } else if (type === 'low-to-high') {
      list.sort((a, b) => {
        if (a.todayRate != null && b.todayRate == null) return -1;
        if (a.todayRate == null && b.todayRate != null) return 1;
        if (a.todayRate == null && b.todayRate == null) return a.bankName.localeCompare(b.bankName);
        return (a.todayRate || 0) - (b.todayRate || 0);
      });
    } else if (type === 'a-to-z') {
      list.sort((a, b) => a.bankName.localeCompare(b.bankName));
    }
    setModalBanks(list);
  };

  // Save custom serial order
  const handleSaveCustomOrder = () => {
    const newOrder = modalBanks.map(b => b.bankName);
    setCustomSerialOrder(newOrder);
    try {
      localStorage.setItem('bank_dollar_rates_serial_order', JSON.stringify(newOrder));
    } catch (e) {
      console.warn('Failed to save bank serial order to localStorage:', e);
    }
    setIsSortModalOpen(false);
  };

  // Reset to default ordering
  const handleResetToDefault = () => {
    setCustomSerialOrder([]);
    try {
      localStorage.removeItem('bank_dollar_rates_serial_order');
    } catch (e) {}
    const defaultSorted = ratesData.filter(r => !isForeignBank(r.bankName));
    setModalBanks([...defaultSorted]);
  };

  // Save rate edits for a specific bank
  const handleSaveBankRate = async (bankName) => {
    const edit = editableRates[bankName];
    if (!edit || !edit.todayRate) return;
    try {
      setSavingBank(bankName);
      await axios.post(`${API_BASE_URL}/api/bank-dollar-rates/update`, {
        bankName,
        todayRate: parseFloat(edit.todayRate),
        previousRate: edit.previousRate ? parseFloat(edit.previousRate) : undefined
      });
      setSaveSuccessBank(bankName);
      setTimeout(() => setSaveSuccessBank(null), 2500);
      await fetchRates(false);
    } catch (err) {
      alert('Failed to update rate: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingBank(null);
    }
  };

  // Reset a bank's manual rate to live portal rate
  const handleResetBankRateToLive = async (bankName) => {
    try {
      setSavingBank(bankName);
      await axios.post(`${API_BASE_URL}/api/bank-dollar-rates/reset`, { bankName });
      await fetchRates(false);
    } catch (err) {
      console.warn('Failed to reset rate:', err);
    } finally {
      setSavingBank(null);
    }
  };

  // Filtered rates with Custom Serial Order applied
  const filteredRates = useMemo(() => {
    let list = ratesData.filter(item => {
      if (isForeignBank(item.bankName)) return false;
      if (filterType === 'increase') return item.changeType === 'increase';
      if (filterType === 'decrease') return item.changeType === 'decrease';
      return true;
    });

    // Apply custom serial order
    if (customSerialOrder && customSerialOrder.length > 0) {
      const orderMap = new Map();
      customSerialOrder.forEach((name, idx) => orderMap.set(name, idx));
      list = [...list].sort((a, b) => {
        const idxA = orderMap.has(a.bankName) ? orderMap.get(a.bankName) : 999;
        const idxB = orderMap.has(b.bankName) ? orderMap.get(b.bankName) : 999;
        if (idxA !== idxB) return idxA - idxB;
        return a.bankName.localeCompare(b.bankName);
      });
    }

    return list;
  }, [ratesData, filterType, customSerialOrder]);

  // Group banks into lines of 10 banks each (for full view without scroll)
  const chunksOfTen = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < filteredRates.length; i += 10) {
      chunks.push(filteredRates.slice(i, i + 10));
    }
    return chunks;
  }, [filteredRates]);

  // Aggregate stats (Calculated solely across banks that have a valid today rate > 0)
  const stats = useMemo(() => {
    const valid = ratesData.filter(r => !isForeignBank(r.bankName));
    if (valid.length === 0) return { avg: '—', high: '—', low: '—', gainers: 0, losers: 0, total: 0 };
    const rates = valid.map(r => r.todayRate).filter(r => r != null && !isNaN(r) && r > 0);
    const avg = rates.length > 0 ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2) : '—';
    const high = rates.length > 0 ? Math.max(...rates).toFixed(2) : '—';
    const low = rates.length > 0 ? Math.min(...rates).toFixed(2) : '—';
    const gainers = valid.filter(r => r.todayRate != null && r.changeType === 'increase').length;
    const losers = valid.filter(r => r.todayRate != null && r.changeType === 'decrease').length;
    return { avg, high, low, gainers, losers, total: valid.length };
  }, [ratesData]);

  return (
    <div className={`dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between h-full ${className}`}>
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 min-h-[46px] gap-2.5">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <BanknotesIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 leading-tight">Bank Dollar Rates</h2>
              <p className="text-[11px] text-gray-400">Prev vs Today Comparison</p>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto flex-shrink-0">
            {/* Filter pills: Up / Down */}
            <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
              {[
                { id: 'increase', label: '▲ Up' },
                { id: 'decrease', label: '▼ Down' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(filterType === f.id ? 'all' : f.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    filterType === f.id
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                  title={filterType === f.id ? 'Showing ' + f.label + ' (click to clear)' : 'Filter ' + f.label}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Customize Serial & Edit Button */}
            <button
              type="button"
              onClick={() => handleOpenSortModal('order')}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 rounded-lg text-[11px] font-semibold border border-gray-200/70 transition-all cursor-pointer shadow-2xs"
              title="Customize Bank Order or Rates"
            >
              <ArrowsUpDownIcon className="w-3.5 h-3.5" />
              <span>Sort</span>
            </button>
          </div>
        </div>

        {/* Quick Market Overview Ribbon */}
        <div className="grid grid-cols-3 gap-2 my-2.5 text-center">
          <div className="p-1.5 bg-gray-50/80 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold block uppercase">
              Market Avg
            </span>
            <span className="text-xs font-bold text-gray-900">{stats.avg !== '—' ? `৳${stats.avg}` : '—'}</span>
          </div>
          <div className="p-1.5 bg-emerald-50/50 rounded-xl border border-emerald-100/60">
            <span className="text-[10px] text-emerald-600 font-bold block uppercase">Highest</span>
            <span className="text-xs font-bold text-emerald-950">{stats.high !== '—' ? `৳${stats.high}` : '—'}</span>
          </div>
          <div className="p-1.5 bg-blue-50/50 rounded-xl border border-blue-100/60">
            <span className="text-[10px] text-blue-600 font-bold block uppercase">Lowest</span>
            <span className="text-xs font-bold text-blue-950">{stats.low !== '—' ? `৳${stats.low}` : '—'}</span>
          </div>
        </div>

        {/* Bank Dollar Rates List */}
        <div className="space-y-1.5 my-1 max-h-[365px] overflow-y-auto dash-scrollbar pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Fetching bank dollar rates...</span>
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400">
              No matching bank dollar rates found.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 select-none border-b border-gray-100 mb-1">
                <span className="flex-1">Bank</span>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <span className="hidden sm:inline-block w-14 text-right">Prev</span>
                  <span className="w-14 sm:w-16 text-right">Today</span>
                  <span className="w-13 sm:w-14 text-center">Change</span>
                </div>
              </div>
              {filteredRates.map((bank) => {
                const currentRate = bank.todayRate;
                const prevRate = bank.previousRate;
                const isUp = bank.changeType === 'increase';
                const isDown = bank.changeType === 'decrease';
                const isSame = bank.changeType === 'same';

                return (
                  <div
                    key={bank._id || bank.bankName}
                    className="group flex items-center justify-between p-2 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all bg-white relative"
                  >
                    {/* Left: Bank Logo & Clean Name */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                        <BankLogo bankName={bank.bankName} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {bank.sourceUrl ? (
                            <a
                              href={bank.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-gray-800 hover:text-indigo-600 truncate flex items-center gap-1 transition-colors"
                              title={`Open official portal: ${bank.sourceUrl}`}
                            >
                              <span className="truncate">{bank.bankName}</span>
                              <svg className="w-2.5 h-2.5 text-gray-400 group-hover:text-indigo-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : (
                            <h4 className="text-xs font-bold text-gray-800 group-hover:text-indigo-900 truncate">
                              {bank.bankName}
                            </h4>
                          )}
                          {bank.isCompanyBank && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Configured in your company bank accounts"></span>
                          )}
                        </div>
                        
                        {/* Clean subtitle showing last dollar rate getting date & mobile prev rate */}
                        <p className="text-[10px] text-gray-400 truncate flex items-center">
                          {formatRateDate(bank.rateDateDisplay || bank.rateDate) ? (
                            <span
                              className={currentRate != null ? 'text-gray-400' : 'text-amber-600 font-medium'}
                              title={`Rate date: ${formatRateDate(bank.rateDateDisplay || bank.rateDate)}`}
                            >
                              {currentRate != null
                                ? formatRateDate(bank.rateDateDisplay || bank.rateDate)
                                : `Last: ${formatRateDate(bank.rateDateDisplay || bank.rateDate)}`}
                            </span>
                          ) : (
                            '—'
                          )}
                          {prevRate != null && !isNaN(prevRate) && (
                            <span className="sm:hidden text-gray-500 font-medium ml-1.5 whitespace-nowrap">
                              • Prev: ৳{Number(prevRate).toFixed(2)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Center & Right: Prev in its own column on desktop, Today in its own column, Change in its own column */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <div className="hidden sm:block w-14 text-right tabular-nums">
                        <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">
                          {prevRate != null && !isNaN(prevRate) ? `৳${Number(prevRate).toFixed(2)}` : '—'}
                        </span>
                      </div>

                      <div className="w-14 sm:w-16 text-right tabular-nums">
                        <span className="text-xs font-extrabold text-gray-900 whitespace-nowrap">
                          {currentRate != null && !isNaN(currentRate) ? `৳${Number(currentRate).toFixed(2)}` : '—'}
                        </span>
                      </div>

                      {/* Right: Increase / Decrease Symbol & Amount */}
                      <div className="w-13 sm:w-14 flex items-center justify-center flex-shrink-0">
                        {currentRate != null && isUp && (
                          <span className="w-full inline-flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs whitespace-nowrap">
                            <span>▲</span>
                            <span>+{Number(bank.change).toFixed(2)}</span>
                          </span>
                        )}
                        {currentRate != null && isDown && (
                          <span className="w-full inline-flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
                            <span>▼</span>
                            <span>-{Number(bank.change).toFixed(2)}</span>
                          </span>
                        )}
                        {currentRate != null && isSame && (
                          <span className="w-full inline-flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-200 shadow-2xs whitespace-nowrap">
                            <span>—</span>
                            <span>0.00</span>
                          </span>
                        )}
                        {currentRate != null && !isUp && !isDown && !isSame && (
                          <span className="w-full inline-flex items-center justify-center py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 shadow-2xs whitespace-nowrap">
                            —
                          </span>
                        )}
                        {currentRate == null && (
                          <span className="w-full inline-flex items-center justify-center py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 shadow-2xs whitespace-nowrap" title="Rate not published today">
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 flex-shrink-0 gap-2 min-h-[34px]">
        <div className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
          <span className="text-[11px] flex items-center gap-1 text-gray-500">
            <span>Source:</span>
            <strong className="text-gray-700">Official Bank Portals</strong>
          </span>
          <button
            type="button"
            onClick={() => setIsViewAllModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-md text-[11px] font-bold border border-indigo-200/80 shadow-2xs transition-all cursor-pointer flex-shrink-0"
            title="View all bank dollar rates (10 banks per line, no scroll)"
          >
            <EyeIcon className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-2 w-full sm:w-auto flex-shrink-0">
          {lastSyncTime && (
            <span className="text-[10px] text-gray-400">
              Synced {lastSyncTime}
            </span>
          )}
          {canSyncDollarRates && (
            <button
              type="button"
              onClick={handleSyncFromWebsites}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-indigo-600 rounded-lg text-[11px] font-semibold border border-gray-200/80 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Sync live rates from bank portals (updates for all users)"
            >
              <RefreshIcon className={`w-3 h-3 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Customize Bank Serial & Rate Modal */}
      {isSortModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  {modalTab === 'order' ? <ArrowsUpDownIcon className="w-4 h-4" /> : <PencilSquareIcon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {modalTab === 'order' ? 'Customize Bank Serial' : 'Edit Bank Dollar Rates'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {modalTab === 'order' ? 'Arrange the order of banks on your dashboard' : 'Update official BC Selling & previous day rates'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSortModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-200/70 text-gray-400 hover:text-gray-700 flex items-center justify-center text-lg font-bold cursor-pointer transition-all"
              >
                ×
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="px-4 py-2 border-b border-gray-100 bg-white flex items-center justify-between gap-2">
              <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/70 text-xs">
                <button
                  type="button"
                  onClick={() => setModalTab('order')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    modalTab === 'order'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  ⇅ Arrange Order
                </button>
                {canSyncDollarRates && (
                  <button
                    type="button"
                    onClick={() => setModalTab('rates')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      modalTab === 'rates'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    ✏️ Edit Dollar Rates
                  </button>
                )}
              </div>

              {modalTab === 'order' && (
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="font-semibold text-gray-400">Sort:</span>
                  <button
                    type="button"
                    onClick={() => handlePresetSort('high-to-low')}
                    className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                  >
                    Rate: High
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSort('low-to-high')}
                    className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                  >
                    Rate: Low
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSort('a-to-z')}
                    className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 cursor-pointer"
                  >
                    A → Z
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: Draggable & Up/Down Bank List */}
            {modalTab === 'order' && (
              <div className="flex-1 overflow-y-auto dash-scrollbar p-3 space-y-1.5">
                {modalBanks.map((bank, index) => (
                  <div
                    key={bank.bankName}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    className="flex items-center justify-between p-2 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 bg-white transition-all select-none cursor-move"
                  >
                    {/* Left: Drag Handle + Serial Badge + Bank Info */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <span className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
                        <GripVerticalIcon className="w-3.5 h-3.5" />
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0 border border-indigo-100">
                        {index + 1}
                      </span>
                      <div className="w-6 h-6 rounded-md bg-gray-50 border border-gray-200/60 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                        <BankLogo bankName={bank.bankName} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-800 truncate">{bank.bankName}</h4>
                        <p className="text-[10px] text-gray-400">৳{Number(bank.todayRate).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Right: Move Up / Down / Top Controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveModalItem(index, 0)}
                        className="px-1.5 py-1 text-[10px] font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:pointer-events-none cursor-pointer border border-gray-200/60"
                        title="Move to #1"
                      >
                        Top
                      </button>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveModalItem(index, index - 1)}
                        className="px-1.5 py-1 text-[10px] font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:pointer-events-none cursor-pointer border border-gray-200/60"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={index === modalBanks.length - 1}
                        onClick={() => moveModalItem(index, index + 1)}
                        className="px-1.5 py-1 text-[10px] font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:pointer-events-none cursor-pointer border border-gray-200/60"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Rate Editor */}
            {modalTab === 'rates' && (
              <div className="flex-1 overflow-y-auto dash-scrollbar p-3 space-y-2">
                <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900 flex items-center justify-between">
                  <span>Enter verified BC Selling & Previous rates. Changes persist across system.</span>
                </div>

                {modalBanks.map((bank) => {
                  const edit = editableRates[bank.bankName] || { todayRate: bank.todayRate, previousRate: bank.previousRate };
                  const isSavingThis = savingBank === bank.bankName;
                  const isSuccess = saveSuccessBank === bank.bankName;

                  return (
                    <div
                      key={bank.bankName}
                      className="p-2.5 rounded-xl border border-gray-100 hover:border-indigo-200 bg-white flex items-center justify-between gap-2"
                    >
                      {/* Left: Bank Info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-6 h-6 rounded-md bg-gray-50 border border-gray-200/60 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                          <BankLogo bankName={bank.bankName} className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-gray-800 truncate">{bank.bankName}</h4>
                            {bank.sourceUrl && (
                              <a
                                href={bank.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                                title={`Check official website: ${bank.sourceUrl}`}
                              >
                                <span>portal</span>
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {bank.isManualOverride ? 'Manual Entry' : 'Live Portal'}
                          </span>
                        </div>
                      </div>

                      {/* Inputs: Prev & Today */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-col">
                          <label className="text-[9px] text-gray-400 font-semibold">Prev (৳)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={edit.previousRate || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableRates(prev => ({
                                ...prev,
                                [bank.bankName]: { ...prev[bank.bankName], previousRate: val }
                              }));
                            }}
                            className="w-18 px-1.5 py-1 text-xs border border-gray-200 rounded-lg text-right font-medium focus:outline-indigo-500 bg-gray-50"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[9px] text-gray-400 font-semibold">Today (৳)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={edit.todayRate || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableRates(prev => ({
                                ...prev,
                                [bank.bankName]: { ...prev[bank.bankName], todayRate: val }
                              }));
                            }}
                            className="w-18 px-1.5 py-1 text-xs border border-gray-200 rounded-lg text-right font-bold text-indigo-700 focus:outline-indigo-500 bg-gray-50"
                          />
                        </div>

                        {/* Save button */}
                        <div className="flex items-center gap-1 self-end pb-0.5">
                          <button
                            type="button"
                            disabled={isSavingThis}
                            onClick={() => handleSaveBankRate(bank.bankName)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                              isSuccess
                                ? 'bg-emerald-600 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs'
                            } disabled:opacity-50`}
                          >
                            {isSavingThis ? '...' : isSuccess ? '✓' : 'Save'}
                          </button>

                          {bank.isManualOverride && (
                            <button
                              type="button"
                              onClick={() => handleResetBankRateToLive(bank.bankName)}
                              className="px-1.5 py-1 text-[10px] text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Reset to live portal rate"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
              {modalTab === 'order' ? (
                <>
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="text-gray-500 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
                  >
                    Reset Default Order
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSortModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustomOrder}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs transition-all"
                    >
                      Save & Apply Order
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleResetBankRateToLive()}
                    className="text-gray-500 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
                  >
                    Reset All to Live Portals
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSortModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs transition-all"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View All Modal: 10 Banks per line, NO SCROLL */}
      {isViewAllModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <EyeIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">All Bank Dollar Rates</h3>
                  <p className="text-[11px] text-gray-500">
                    Official BC Selling Rates (LC/Trade) • 10 Banks Per Line • No Scroll
                  </p>
                </div>
              </div>

              {/* Header Right: Stats ribbon & Close button */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-gray-100 rounded-md font-semibold text-gray-700">
                    Avg: <strong className="text-gray-900">{stats.avg !== '—' ? `৳${stats.avg}` : '—'}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md font-semibold border border-emerald-100">
                    High: <strong>{stats.high !== '—' ? `৳${stats.high}` : '—'}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md font-semibold border border-blue-100">
                    Low: <strong>{stats.low !== '—' ? `৳${stats.low}` : '—'}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-md font-bold border border-indigo-100">
                    Total: {filteredRates.length} Banks
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsViewAllModalOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-gray-200/70 text-gray-400 hover:text-gray-700 flex items-center justify-center text-lg font-bold cursor-pointer transition-all"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Lines of 10 Banks Grid - No Scroll on desktop, scrollable on mobile */}
            <div className="p-2 sm:p-4 bg-white flex-1 overflow-y-auto max-h-[75vh] sm:max-h-none sm:overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 items-start">
                {chunksOfTen.map((chunk, chunkIdx) => (
                  <div
                    key={chunkIdx}
                    className="flex flex-col space-y-1.5 bg-gray-50/70 p-2 sm:p-2.5 rounded-2xl border border-gray-200/80"
                  >
                    {/* Column Table Header */}
                    <div className="flex items-center justify-between px-2.5 sm:px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 select-none border-b border-gray-200/60 pb-1 mb-0.5">
                      <span className="flex-1 pl-1">Bank</span>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <span className="hidden sm:inline-block w-16 text-right">Prev</span>
                        <span className="w-14 sm:w-16 text-right">Today</span>
                        <span className="w-13 sm:w-14 text-center">Change</span>
                      </div>
                    </div>

                    {/* Exactly 10 Banks inside this column */}
                    {chunk.map((bank, itemIdx) => {
                      const serialNo = chunkIdx * 10 + itemIdx + 1;
                      const currentRate = bank.todayRate;
                      const prevRate = bank.previousRate;
                      const isUp = bank.changeType === 'increase';
                      const isDown = bank.changeType === 'decrease';
                      const isSame = bank.changeType === 'same';

                      return (
                        <div
                          key={bank._id || bank.bankName}
                          className="flex items-center justify-between px-2 sm:px-3 py-2 rounded-xl border border-gray-100 hover:border-indigo-200 bg-white shadow-2xs hover:shadow-xs text-xs transition-all"
                        >
                          {/* Left: Serial + Logo + Bank Name & Subtitle */}
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 pr-1.5 sm:pr-2.5">
                            <span className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md bg-gray-100 text-gray-500 font-bold text-[10px] sm:text-[11px] flex items-center justify-center flex-shrink-0">
                              {serialNo}
                            </span>
                            <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                              <BankLogo bankName={bank.bankName} className="w-full h-full object-contain" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {bank.sourceUrl ? (
                                  <a
                                    href={bank.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-gray-800 hover:text-indigo-600 truncate flex items-center gap-1 transition-colors"
                                    title={`Open official portal: ${bank.sourceUrl}`}
                                  >
                                    <span className="truncate">{bank.bankName}</span>
                                    <svg className="w-2.5 h-2.5 text-gray-400 hover:text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : (
                                  <h4 className="text-xs font-bold text-gray-800 truncate" title={bank.bankName}>
                                    {bank.bankName}
                                  </h4>
                                )}
                                {bank.isCompanyBank && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Configured in company accounts"></span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 truncate mt-0.5 flex items-center">
                                {formatRateDate(bank.rateDateDisplay || bank.rateDate) ? (
                                  <span
                                    className={currentRate != null ? 'text-gray-400' : 'text-amber-600 font-medium'}
                                    title={`Rate date: ${formatRateDate(bank.rateDateDisplay || bank.rateDate)}`}
                                  >
                                    {currentRate != null
                                      ? formatRateDate(bank.rateDateDisplay || bank.rateDate)
                                      : `Last: ${formatRateDate(bank.rateDateDisplay || bank.rateDate)}`}
                                  </span>
                                ) : (
                                  '—'
                                )}
                                {prevRate != null && !isNaN(prevRate) && (
                                  <span className="sm:hidden text-gray-500 font-medium ml-1.5 whitespace-nowrap">
                                    • Prev: ৳{Number(prevRate).toFixed(2)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Center & Right: Prev in its own column on desktop, Today in its own column, Change in its own column */}
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                            {/* Prev Rate Column */}
                            <div className="hidden sm:block w-16 text-right tabular-nums">
                              <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                                {prevRate != null && !isNaN(prevRate) ? `৳${Number(prevRate).toFixed(2)}` : '—'}
                              </span>
                            </div>

                            {/* Today Rate Column */}
                            <div className="w-14 sm:w-16 text-right tabular-nums">
                              <span className="text-xs sm:text-[13px] font-extrabold text-gray-900 whitespace-nowrap">
                                {currentRate != null && !isNaN(currentRate) ? `৳${Number(currentRate).toFixed(2)}` : '—'}
                              </span>
                            </div>

                            {/* Change Badge Column */}
                            <div className="w-13 sm:w-14 flex items-center justify-center flex-shrink-0">
                              {currentRate != null && isUp && (
                                <span className="w-full inline-flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs whitespace-nowrap">
                                  <span>▲</span>
                                  <span>+{Number(bank.change).toFixed(2)}</span>
                                </span>
                              )}
                              {currentRate != null && isDown && (
                                <span className="w-full inline-flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
                                  <span>▼</span>
                                  <span>-{Number(bank.change).toFixed(2)}</span>
                                </span>
                              )}
                              {currentRate != null && isSame && (
                                <span className="w-full inline-flex items-center justify-center gap-0.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-200 shadow-2xs whitespace-nowrap">
                                  <span>—</span>
                                  <span>0.00</span>
                                </span>
                              )}
                              {currentRate != null && !isUp && !isDown && !isSame && (
                                <span className="w-full inline-flex items-center justify-center py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 shadow-2xs whitespace-nowrap">
                                  —
                                </span>
                              )}
                              {currentRate == null && (
                                <span className="w-full inline-flex items-center justify-center py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 shadow-2xs whitespace-nowrap">
                                  —
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-[11px] text-gray-500">
                Source: <strong className="text-gray-700">Official Bangladesh Bank & Commercial Portals</strong>
                {lastSyncTime ? ` • Synced ${lastSyncTime}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setIsViewAllModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default BankDollarRatesWidget;
