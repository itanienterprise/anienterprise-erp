import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { getSocket } from '../../../utils/socket';
import {
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  WalletIcon,
  ShoppingCartIcon,
  TruckIcon,
  BoxIcon,
  BuildingIcon,
  ShieldIcon,
  AnchorIcon,
  RefreshIcon,
  ArrowRightIcon,
  CheckIcon
} from '../../Icons';

const MODULE_CONFIGS = [
  {
    id: 'paymentCollection',
    title: 'Payment Collection',
    route: 'payment-collection-section',
    icon: WalletIcon,
    theme: {
      activeBg: 'bg-emerald-50/70 border-emerald-200/80 hover:border-emerald-400 hover:shadow-emerald-500/10',
      iconBg: 'bg-emerald-100 text-emerald-700',
      accentText: 'text-emerald-700',
      badge: 'bg-emerald-100/80 text-emerald-800 border-emerald-300/60'
    },
    description: 'Customer payment collections'
  },
  {
    id: 'payToCustomer',
    title: 'Pay To Customer',
    route: 'pay-to-customer-section',
    icon: WalletIcon,
    theme: {
      activeBg: 'bg-cyan-50/70 border-cyan-200/80 hover:border-cyan-400 hover:shadow-cyan-500/10',
      iconBg: 'bg-cyan-100 text-cyan-700',
      accentText: 'text-cyan-700',
      badge: 'bg-cyan-100/80 text-cyan-800 border-cyan-300/60'
    },
    description: 'Customer refunds & payouts'
  },
  {
    id: 'order',
    title: 'Order Sales',
    route: 'order-sale-section',
    icon: ShoppingCartIcon,
    theme: {
      activeBg: 'bg-blue-50/70 border-blue-200/80 hover:border-blue-400 hover:shadow-blue-500/10',
      iconBg: 'bg-blue-100 text-blue-700',
      accentText: 'text-blue-700',
      badge: 'bg-blue-100/80 text-blue-800 border-blue-300/60'
    },
    description: 'Booking & order approvals'
  },
  {
    id: 'generalSale',
    title: 'General Sales',
    route: 'general-sale-section',
    icon: ShoppingCartIcon,
    theme: {
      activeBg: 'bg-indigo-50/70 border-indigo-200/80 hover:border-indigo-400 hover:shadow-indigo-500/10',
      iconBg: 'bg-indigo-100 text-indigo-700',
      accentText: 'text-indigo-700',
      badge: 'bg-indigo-100/80 text-indigo-800 border-indigo-300/60'
    },
    description: 'Direct sales clearance'
  },
  {
    id: 'borderSale',
    title: 'Border Sales',
    route: 'border-sale-section',
    icon: TruckIcon,
    theme: {
      activeBg: 'bg-teal-50/70 border-teal-200/80 hover:border-teal-400 hover:shadow-teal-500/10',
      iconBg: 'bg-teal-100 text-teal-700',
      accentText: 'text-teal-700',
      badge: 'bg-teal-100/80 text-teal-800 border-teal-300/60'
    },
    description: 'Border dispatch & sales'
  },
  {
    id: 'purchase',
    title: 'Purchases',
    route: 'purchase-section',
    icon: BoxIcon,
    theme: {
      activeBg: 'bg-violet-50/70 border-violet-200/80 hover:border-violet-400 hover:shadow-violet-500/10',
      iconBg: 'bg-violet-100 text-violet-700',
      accentText: 'text-violet-700',
      badge: 'bg-violet-100/80 text-violet-800 border-violet-300/60'
    },
    description: 'Local purchase requests'
  },
  {
    id: 'purchaseReceive',
    title: 'Purchase Receive',
    route: 'purchase-receive-sale-section',
    icon: BoxIcon,
    theme: {
      activeBg: 'bg-purple-50/70 border-purple-200/80 hover:border-purple-400 hover:shadow-purple-500/10',
      iconBg: 'bg-purple-100 text-purple-700',
      accentText: 'text-purple-700',
      badge: 'bg-purple-100/80 text-purple-800 border-purple-300/60'
    },
    description: 'Receiving verification queue'
  },
  {
    id: 'deposit',
    title: 'Bank Deposit',
    route: 'deposit-section',
    icon: BuildingIcon,
    theme: {
      activeBg: 'bg-sky-50/70 border-sky-200/80 hover:border-sky-400 hover:shadow-sky-500/10',
      iconBg: 'bg-sky-100 text-sky-700',
      accentText: 'text-sky-700',
      badge: 'bg-sky-100/80 text-sky-800 border-sky-300/60'
    },
    description: 'Deposits awaiting clearance'
  },
  {
    id: 'withdrawal',
    title: 'Bank Withdrawal',
    route: 'withdrawal-section',
    icon: BuildingIcon,
    theme: {
      activeBg: 'bg-rose-50/70 border-rose-200/80 hover:border-rose-400 hover:shadow-rose-500/10',
      iconBg: 'bg-rose-100 text-rose-700',
      accentText: 'text-rose-700',
      badge: 'bg-rose-100/80 text-rose-800 border-rose-300/60'
    },
    description: 'Withdrawal verification'
  },
  {
    id: 'fundTransfer',
    title: 'Fund Transfer',
    route: 'fund-transfer-section',
    icon: RefreshIcon,
    theme: {
      activeBg: 'bg-amber-50/70 border-amber-200/80 hover:border-amber-400 hover:shadow-amber-500/10',
      iconBg: 'bg-amber-100 text-amber-700',
      accentText: 'text-amber-700',
      badge: 'bg-amber-100/80 text-amber-800 border-amber-300/60'
    },
    description: 'Inter-account fund transfers'
  },
  {
    id: 'insurancePayment',
    title: 'Insurance Payment',
    route: 'insurance-payment-section',
    icon: ShieldIcon,
    theme: {
      activeBg: 'bg-fuchsia-50/70 border-fuchsia-200/80 hover:border-fuchsia-400 hover:shadow-fuchsia-500/10',
      iconBg: 'bg-fuchsia-100 text-fuchsia-700',
      accentText: 'text-fuchsia-700',
      badge: 'bg-fuchsia-100/80 text-fuchsia-800 border-fuchsia-300/60'
    },
    description: 'Cargo insurance clearance'
  },
  {
    id: 'cnfPayment',
    title: 'C&F Payment',
    route: 'cnf-payment-section',
    icon: AnchorIcon,
    theme: {
      activeBg: 'bg-orange-50/70 border-orange-200/80 hover:border-orange-400 hover:shadow-orange-500/10',
      iconBg: 'bg-orange-100 text-orange-700',
      accentText: 'text-orange-700',
      badge: 'bg-orange-100/80 text-orange-800 border-orange-300/60'
    },
    description: 'Clearing & forwarding fees'
  },
  {
    id: 'stockTransfer',
    title: 'Warehouse Transfer',
    route: 'transfer-section',
    icon: TruckIcon,
    theme: {
      activeBg: 'bg-lime-50/70 border-lime-200/80 hover:border-lime-400 hover:shadow-lime-500/10',
      iconBg: 'bg-lime-100 text-lime-700',
      accentText: 'text-lime-700',
      badge: 'bg-lime-100/80 text-lime-800 border-lime-300/60'
    },
    description: 'Inter-warehouse transfers'
  },
  {
    id: 'lcReceive',
    title: 'LC Port Receive',
    route: 'lc-entry-section',
    icon: BoxIcon,
    theme: {
      activeBg: 'bg-blue-50/70 border-blue-200/80 hover:border-blue-400 hover:shadow-blue-500/10',
      iconBg: 'bg-blue-100 text-blue-700',
      accentText: 'text-blue-700',
      badge: 'bg-blue-100/80 text-blue-800 border-blue-300/60'
    },
    description: 'LC port stock arrivals'
  },
  {
    id: 'token',
    title: 'Support Tokens',
    route: 'token-section',
    icon: ClockIcon,
    theme: {
      activeBg: 'bg-pink-50/70 border-pink-200/80 hover:border-pink-400 hover:shadow-pink-500/10',
      iconBg: 'bg-pink-100 text-pink-700',
      accentText: 'text-pink-700',
      badge: 'bg-pink-100/80 text-pink-800 border-pink-300/60'
    },
    description: 'Support tickets & issues'
  }
];

const PendingRequestsWidget = ({ onNavigate, className = '' }) => {
  const [counts, setCounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingCounts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/pending-indicators?force=true`);
      if (res.data && res.data.counts && typeof res.data.counts === 'object') {
        setCounts(res.data.counts);
      } else if (res.data && typeof res.data === 'object') {
        const fallbackCounts = {};
        MODULE_CONFIGS.forEach(m => {
          fallbackCounts[m.id] = res.data[m.id] ? 1 : 0;
        });
        setCounts(fallbackCounts);
      }
    } catch (err) {
      console.warn('[PendingRequestsWidget] Failed to fetch pending counts:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingCounts();

    // 1. Periodic background auto-sync every 10 seconds
    const pollInterval = setInterval(() => {
      fetchPendingCounts();
    }, 10000);

    // 2. Real-time WebSocket instant auto-synchronization
    const socket = getSocket();
    let debounceTimer = null;
    const handleUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchPendingCounts();
      }, 800);
    };

    if (socket) {
      socket.on('data_updated', handleUpdate);
    }

    return () => {
      clearInterval(pollInterval);
      clearTimeout(debounceTimer);
      if (socket) {
        socket.off('data_updated', handleUpdate);
      }
    };
  }, [fetchPendingCounts]);

  // Aggregate totals
  const totalPending = useMemo(() => {
    return Object.entries(counts).reduce((sum, [key, val]) => {
      if (key === 'total') return sum;
      return sum + (parseInt(val, 10) || 0);
    }, 0);
  }, [counts]);

  // Only modules that currently have pending requests (> 0)
  const pendingModules = useMemo(() => {
    return MODULE_CONFIGS.filter(m => (counts[m.id] || 0) > 0);
  }, [counts]);

  // Dynamically calculate card height so exactly 4 rows fit the container with zero top/bottom dead gap
  return (
    <div className={`dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between h-full ${className}`}>
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-gray-100 min-h-[46px] gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0 relative">
            <ClockIcon className="w-4 h-4" />
            {totalPending > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-tight">Pending Requests</h2>
            <p className="text-[11px] text-gray-400">Approval & verification queues</p>
          </div>
        </div>

        {totalPending > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300/80 animate-pulse self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {totalPending} Pending
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-600" />
            All Clear
          </span>
        )}
      </div>

      {/* ─── Cards Grid (3 in row, 4 in column layout with scroll) ─── */}
      <div className="my-1.5 flex-1 min-h-0 max-h-[380px] overflow-y-auto pr-1 dash-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[89px] bg-gray-50 rounded-xl animate-pulse border border-gray-100 p-2" />
            ))}
          </div>
        ) : pendingModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2Icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">All Queues Clear</h3>
            <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
              There are currently no pending requests or approvals waiting.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pendingModules.map((item) => {
              const count = counts[item.id] || 0;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => onNavigate && onNavigate(item.route, null, true)}
                  className={`group relative rounded-xl p-2 transition-all duration-150 cursor-pointer border flex flex-col justify-between ${item.theme.activeBg} shadow-2xs hover:-translate-y-0.5 hover:shadow-xs h-[89px] select-none`}
                >
                  {/* Top: Icon + Big Count */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs flex-shrink-0 ${item.theme.iconBg}`}
                    >
                      <Icon className="w-3 h-3" />
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-base sm:text-lg font-black tracking-tight text-gray-900 group-hover:text-amber-600 transition-colors leading-none">
                        {count}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                        {count === 1 ? 'Req' : 'Reqs'}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Title - 2 lines clean display */}
                  <div className="my-auto py-0.5">
                    <div className="text-[10.5px] font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-amber-600 transition-colors" title={item.title}>
                      {item.title}
                    </div>
                  </div>

                  {/* Bottom: Action row */}
                  <div className="pt-1 border-t border-gray-100/90 flex items-center justify-between text-[10px] font-semibold text-gray-500 group-hover:text-gray-900 transition-colors">
                    <span className="whitespace-nowrap">Open Queue</span>
                    <span className="transform group-hover:translate-x-0.5 transition-transform text-xs ml-0.5 flex-shrink-0">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer sync bar sits directly at the bottom with no gap */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
        <span>Synchronized via Real-time Socket</span>
        <span className="text-gray-500 font-semibold">{totalPending} pending</span>
      </div>
    </div>
  );
};

export default PendingRequestsWidget;
