import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
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

const BankDollarRatesWidget = ({ onNavigate, className = '' }) => {
  const [ratesData, setRatesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'increase' | 'decrease'
  const [lastSyncTime, setLastSyncTime] = useState('');

  // Custom Serial Order (Persisted in localStorage)
  const [customSerialOrder, setCustomSerialOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('bank_dollar_rates_serial_order');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Reorder / Sort Modal state
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [modalBanks, setModalBanks] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const fetchRates = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsSyncing(true);
      else setIsLoading(true);

      const url = `${API_BASE_URL}/api/bank-dollar-rates${refresh ? '?refresh=true' : ''}`;
      const res = await axios.get(url);
      if (Array.isArray(res.data)) {
        // Exclude any non-BD banks
        const bdOnly = res.data.filter(r => !isForeignBank(r.bankName));
        setRatesData(bdOnly);
        if (bdOnly[0]?.lastUpdated) {
          setLastSyncTime(bdOnly[0].lastUpdated);
        } else {
          setLastSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }
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

  const handleSyncFromWebsites = async () => {
    await fetchRates(true);
  };

  // Open Reorder Modal and initialize with active custom serial order
  const handleOpenSortModal = () => {
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
      list.sort((a, b) => (b.todayRate || 0) - (a.todayRate || 0));
    } else if (type === 'low-to-high') {
      list.sort((a, b) => (a.todayRate || 0) - (b.todayRate || 0));
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

  // Aggregate stats (Calculated solely for BD BC Selling rates)
  const stats = useMemo(() => {
    const valid = ratesData.filter(r => !isForeignBank(r.bankName));
    if (valid.length === 0) return { avg: 0, high: 0, low: 0, gainers: 0, losers: 0 };
    const rates = valid.map(r => r.todayRate).filter(r => r > 0);
    const avg = rates.length > 0 ? (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2) : '0.00';
    const high = rates.length > 0 ? Math.max(...rates).toFixed(2) : '0.00';
    const low = rates.length > 0 ? Math.min(...rates).toFixed(2) : '0.00';
    const gainers = valid.filter(r => r.changeType === 'increase').length;
    const losers = valid.filter(r => r.changeType === 'decrease').length;
    return { avg, high, low, gainers, losers, total: valid.length };
  }, [ratesData]);

  return (
    <div className={`dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between ${className}`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 min-h-[46px] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <BanknotesIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate">Bank Dollar Rates</h2>
              <p className="text-[11px] text-gray-400 truncate">Previous Day vs Today Comparison</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
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
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
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

            {/* Customize Serial / Sort Button */}
            <button
              type="button"
              onClick={handleOpenSortModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-600 rounded-lg text-[11px] font-semibold border border-gray-200/70 transition-all cursor-pointer shadow-2xs"
              title="Customize Bank Serial & Order"
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
            <span className="text-xs font-bold text-gray-900">৳{stats.avg}</span>
          </div>
          <div className="p-1.5 bg-emerald-50/50 rounded-xl border border-emerald-100/60">
            <span className="text-[10px] text-emerald-600 font-bold block uppercase">Highest</span>
            <span className="text-xs font-bold text-emerald-950">৳{stats.high}</span>
          </div>
          <div className="p-1.5 bg-blue-50/50 rounded-xl border border-blue-100/60">
            <span className="text-[10px] text-blue-600 font-bold block uppercase">Lowest</span>
            <span className="text-xs font-bold text-blue-950">৳{stats.low}</span>
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
            filteredRates.map((bank) => {
              const currentRate = bank.todayRate;
              const prevRate = bank.previousRate;
              const isUp = bank.changeType === 'increase';
              const isDown = bank.changeType === 'decrease';
              const isSame = bank.changeType === 'same';

              return (
                <div
                  key={bank._id || bank.bankName}
                  className="group flex items-center justify-between p-2 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all bg-white"
                >
                  {/* Left: Bank Logo & Clean Name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                      <BankLogo bankName={bank.bankName} className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-gray-800 group-hover:text-indigo-900 truncate">
                          {bank.bankName}
                        </h4>
                        {bank.isCompanyBank && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Configured in your company bank accounts"></span>
                        )}
                      </div>
                      
                      {/* Clean subtitle showing rate classification */}
                      <p className="text-[10px] text-gray-400 truncate">
                        {bank.shortName ? `${bank.shortName} • ` : ''}BC Selling Rate
                      </p>
                    </div>
                  </div>

                  {/* Center: Previous vs Today */}
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-400">
                        Prev: <strong className="text-gray-500 font-semibold">৳{Number(prevRate || currentRate).toFixed(2)}</strong>
                      </span>
                      <span className="text-xs font-extrabold text-gray-900">
                        ৳{Number(currentRate).toFixed(2)}
                      </span>
                    </div>

                    {/* Right: Increase / Decrease Symbol & Amount */}
                    <div className="w-16 flex justify-end">
                      {isUp && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs whitespace-nowrap">
                          <span>▲</span>
                          <span>+{Number(bank.change).toFixed(2)}</span>
                        </span>
                      )}
                      {isDown && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
                          <span>▼</span>
                          <span>-{Number(bank.change).toFixed(2)}</span>
                        </span>
                      )}
                      {isSame && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-200 shadow-2xs whitespace-nowrap">
                          <span>—</span>
                          <span>0.00</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
        <span className="text-[11px] flex items-center gap-1">
          <span>Source:</span>
          <strong className="text-gray-700">Official Bank Portals</strong>
        </span>
        <div className="flex items-center gap-2">
          {lastSyncTime && (
            <span className="text-[10px] text-gray-400">
              Synced {lastSyncTime}
            </span>
          )}
          <button
            type="button"
            onClick={handleSyncFromWebsites}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-indigo-600 rounded-lg text-[11px] font-semibold border border-gray-200/80 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Sync live rates from bank portals"
          >
            <RefreshIcon className={`w-3 h-3 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* Customize Bank Serial & Sort Modal */}
      {isSortModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <ArrowsUpDownIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Customize Bank Serial</h3>
                  <p className="text-[11px] text-gray-500">Arrange the order of banks on your dashboard</p>
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

            {/* Quick Preset Sorts */}
            <div className="px-4 py-2 bg-indigo-50/40 border-b border-indigo-100/60 flex items-center justify-between gap-1 text-[11px] flex-wrap">
              <span className="font-semibold text-indigo-900">Quick Sort:</span>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePresetSort('high-to-low')}
                  className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white font-medium cursor-pointer transition-all shadow-2xs"
                >
                  Rate: High → Low
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSort('low-to-high')}
                  className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white font-medium cursor-pointer transition-all shadow-2xs"
                >
                  Rate: Low → High
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetSort('a-to-z')}
                  className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white font-medium cursor-pointer transition-all shadow-2xs"
                >
                  A → Z
                </button>
              </div>
            </div>

            {/* Draggable & Up/Down Bank List */}
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

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs flex-shrink-0">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-gray-500 hover:text-rose-600 font-semibold cursor-pointer transition-colors"
              >
                Reset Default
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
                  Save & Apply
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

export default BankDollarRatesWidget;
