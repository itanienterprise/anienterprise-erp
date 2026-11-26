import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { getSocket } from '../../../utils/socket';
import {
  UserIcon,
  UsersIcon,
  ClockIcon,
  RefreshIcon,
  CalendarIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  XIcon
} from '../../Icons';

const ActiveUsersWidget = ({ className = '', onNavigate = null }) => {
  const [activeUsersList, setActiveUsersList] = useState([]);
  const [totalActiveToday, setTotalActiveToday] = useState(0);
  const [liveNowCount, setLiveNowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Full Details Modal state
  const [showFullModal, setShowFullModal] = useState(false);

  // User Monthly History Modal state
  const [userHistoryModal, setUserHistoryModal] = useState({
    isOpen: false,
    username: null,
    displayName: null,
    userRole: null,
    selectedMonth: '',
    availableMonths: [],
    history: [],
    loading: false,
    error: null
  });

  // Fetch active users from backend
  const fetchActiveUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/active-users`);
      if (res.data && res.data.success) {
        const list = Array.isArray(res.data.todayActiveUsersList) ? res.data.todayActiveUsersList : [];
        setActiveUsersList(list);
        setTotalActiveToday(res.data.todayActiveUsers || list.length || 0);
        setLiveNowCount(res.data.todayLiveUsers !== undefined ? res.data.todayLiveUsers : list.filter(u => u.isLive).length);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.warn('Failed to fetch dashboard active users:', err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh intervals
  useEffect(() => {
    fetchActiveUsers();

    // Auto-refresh every 25 seconds
    const interval = setInterval(() => {
      fetchActiveUsers(true);
    }, 25000);

    // Socket.io live log updates trigger instant refresh
    const socket = getSocket();
    if (socket) {
      const handleDataUpdate = (data) => {
        const mod = (data?.module || '').toLowerCase();
        if (mod.includes('auth') || mod.includes('user') || mod.includes('log')) {
          fetchActiveUsers(true);
        }
      };
      socket.on('data_updated', handleDataUpdate);
      return () => {
        clearInterval(interval);
        socket.off('data_updated', handleDataUpdate);
      };
    }

    return () => clearInterval(interval);
  }, [fetchActiveUsers]);

  // Open Monthly User History Modal
  const openUserHistory = async (username, displayName, userRole, month = null) => {
    setUserHistoryModal(prev => ({
      ...prev,
      isOpen: true,
      username,
      displayName: displayName || username,
      userRole: userRole || 'User',
      loading: true,
      error: null
    }));

    try {
      const params = { username };
      if (month) params.month = month;
      params.tz = '+06:00';
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/user-history`, { params });
      if (res.data && res.data.success) {
        setUserHistoryModal(prev => ({
          ...prev,
          username: res.data.username,
          displayName: res.data.displayName || prev.displayName,
          userRole: res.data.userRole || prev.userRole,
          selectedMonth: res.data.selectedMonth,
          availableMonths: res.data.availableMonths || [res.data.selectedMonth],
          history: res.data.history || [],
          loading: false
        }));
      } else {
        setUserHistoryModal(prev => ({ ...prev, loading: false, error: 'Could not load activity history' }));
      }
    } catch (err) {
      console.error('Failed to fetch user activity history:', err);
      setUserHistoryModal(prev => ({ ...prev, loading: false, error: 'Failed to load activity history' }));
    }
  };

  const handleMonthChange = (month) => {
    if (!userHistoryModal.username) return;
    openUserHistory(userHistoryModal.username, userHistoryModal.displayName, userHistoryModal.userRole, month);
  };

  // Duration Formatter
  const formatDuration = (start, end, isLive, activeMs = null) => {
    let durationMs = activeMs;
    if (durationMs === null || durationMs === undefined) {
      if (!start) return '1s';
      const now = Date.now();
      const startMs = new Date(start).getTime();
      const endMs = end ? new Date(end).getTime() : startMs;
      durationMs = isLive ? Math.max(0, now - startMs) : Math.max(0, endMs - startMs);
    }
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    const remainingSecs = totalSeconds % 60;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours === 0) {
      return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  // Relative Time Formatter
  const getRelativeTime = (date, isLive) => {
    if (isLive) return 'Active now';
    if (!date) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ${diffMin % 60}m ago`;
  };

  // User Initials Helper
  const getInitials = (name, username) => {
    return (name || username || 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
  };

  // Total Actions Count across active users today
  const totalActionsToday = activeUsersList.reduce((sum, u) => sum + (u.actionCount || 0), 0);

  return (
    <>
      {/* ─── SUMMARY CARD (Compact standard 1/3 card size) ───────────────── */}
      <div className={`dash-card ${className} bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between h-full`}>
        <div>
          {/* Card Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 min-h-[46px]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <UsersIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Active Users Today</h2>
                <p className="text-[11px] text-gray-400">Live Operating Sessions</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>{liveNowCount} Live</span>
              </span>

              <button
                type="button"
                onClick={() => setShowFullModal(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer whitespace-nowrap ml-1"
              >
                View All →
              </button>
            </div>
          </div>

          {/* KPI Chips Summary */}
          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/80 text-center">
              <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider">Active</span>
              <span className="text-lg font-black text-indigo-950">{totalActiveToday}</span>
            </div>
            <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100/80 text-center">
              <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wider">Live Now</span>
              <span className="text-lg font-black text-emerald-950 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {liveNowCount}
              </span>
            </div>
            <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100/80 text-center">
              <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider">Actions</span>
              <span className="text-lg font-black text-blue-950">{totalActionsToday}</span>
            </div>
          </div>

          {/* Compact User Summary List */}
          <div className="space-y-2 my-3 max-h-64 overflow-y-auto dash-scrollbar pr-1">
            {loading && activeUsersList.length === 0 ? (
              <div className="py-10 text-center text-gray-400 space-y-1">
                <RefreshIcon className="w-5 h-5 animate-spin mx-auto text-indigo-400" />
                <p className="text-xs text-gray-400">Loading active users...</p>
              </div>
            ) : activeUsersList.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-xs">
                No active users recorded today yet.
              </div>
            ) : (
              activeUsersList.map((user, idx) => {
                const lastTime = user.lastActive ? new Date(user.lastActive) : null;
                const firstTime = user.firstActive ? new Date(user.firstActive) : null;
                const isUserLive = Boolean(
                  user.isLive ||
                  user.isCurrent ||
                  (lastTime && Date.now() - lastTime.getTime() <= 15 * 60 * 1000)
                );
                const initials = getInitials(user.name, user.username);
                const activeTimeStr = formatDuration(firstTime, lastTime, isUserLive, user.activeMs);

                return (
                  <div
                    key={user.username || idx}
                    className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/70 transition-all cursor-pointer group"
                    onClick={() => setShowFullModal(true)}
                  >
                    {/* Left: Avatar with Status Dot */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                        {initials}
                      </div>
                      {isUserLive ? (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 opacity-75"></span>
                        </span>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-slate-300 border border-white rounded-full"></span>
                      )}
                    </div>

                    {/* Middle: User Info (Name & Role tag under name) */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold text-gray-900 truncate" title={user.name || user.username}>
                          {user.name || user.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {user.role && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-tight">
                            {user.role}
                          </span>
                        )}
                        {isUserLive && (
                          <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            LIVE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Time, Actions & History Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-indigo-600 whitespace-nowrap leading-tight">
                          {activeTimeStr} active
                        </div>
                        <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap leading-tight mt-0.5">
                          {user.actionCount || 1} actions
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openUserHistory(user.username, user.name || user.username, user.role)}
                          title="View monthly activity history"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        >
                          <CalendarIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card Footer */}
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Times tracked from logs</span>
          <button
            type="button"
            onClick={() => fetchActiveUsers()}
            title="Refresh active users"
            className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 cursor-pointer font-medium"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ─── FULL MODAL: Complete representation when user clicks View All ── */}
      {showFullModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setShowFullModal(false); }}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200/90 overflow-hidden ring-1 ring-black/5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-blue-50/30 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 ring-4 ring-indigo-50 shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-base">Active Users Today</h3>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-2xs shadow-2xs">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>{liveNowCount} Live Now</span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      • {totalActiveToday} active today
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Users logged in and operating on the system since midnight today
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Full Active Users Cards */}
            <div className="p-5 overflow-y-auto space-y-3.5 bg-slate-50/40">
              {activeUsersList.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200/60">
                  <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-25 text-slate-400" />
                  <p className="font-bold text-sm text-slate-700">No active users recorded today yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Activity will appear here automatically when staff log in and perform actions on the ERP
                  </p>
                </div>
              ) : (
                activeUsersList.map((user, idx) => {
                  const lastTime = user.lastActive ? new Date(user.lastActive) : null;
                  const firstTime = user.firstActive ? new Date(user.firstActive) : null;
                  const isUserLive = Boolean(
                    user.isLive ||
                    user.isCurrent ||
                    (lastTime && Date.now() - lastTime.getTime() <= 15 * 60 * 1000)
                  );
                  const initials = getInitials(user.name, user.username);

                  return (
                    <div
                      key={user.username || idx}
                      className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs ring-2 ring-indigo-50">
                              {initials}
                            </div>
                            {isUserLive ? (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-xs">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                              </span>
                            ) : (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-300 border-2 border-white rounded-full shadow-xs"></span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-800 text-[15px] truncate">
                                {user.name || user.username}
                              </h4>
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200/70">
                                @{user.username}
                              </span>
                              {user.role && (
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                                  {user.role}
                                </span>
                              )}
                              {isUserLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </span>
                                  <span>LIVE NOW</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200/80">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span>Offline</span>
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              {user.lastIp && (
                                <span>IP: <strong className="font-mono text-slate-700 font-semibold">{user.lastIp}</strong></span>
                              )}
                              {user.lastIp && firstTime && <span className="text-slate-300">•</span>}
                              {firstTime && (
                                <span>Started today at {firstTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openUserHistory(user.username, user.name || user.username, user.role)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-2xs group-hover:border-indigo-300 cursor-pointer"
                          >
                            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500 group-hover:text-white transition-colors" />
                            <span>History</span>
                            <ChevronRightIcon className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      </div>

                      {/* 3 Micro-Metrics Strip */}
                      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <ClockIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold text-indigo-900/60 uppercase tracking-wider">Total Active</span>
                            <span className="text-sm font-black text-indigo-700 truncate block">
                              {formatDuration(firstTime, lastTime, isUserLive, user.activeMs)}
                            </span>
                          </div>
                        </div>

                        <div className={`p-2.5 rounded-xl border flex items-center gap-3 ${isUserLive ? 'bg-emerald-50/60 border-emerald-200/80' : 'bg-slate-50 border-slate-200/70'
                          }`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isUserLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                            {isUserLive ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ) : (
                              <ClockIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Last Active</span>
                            <span className={`text-sm font-black truncate block ${isUserLive ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {lastTime ? lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                              <span className="text-xs font-semibold text-slate-400 ml-1.5">
                                ({getRelativeTime(lastTime, isUserLive)})
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[11px] font-bold text-blue-900/60 uppercase tracking-wider">Activity Count</span>
                            <span className="text-sm font-black text-blue-700 truncate block">
                              {user.actionCount || 1} {(user.actionCount || 1) === 1 ? 'action' : 'actions'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-xs">
                Times and active durations are tracked from system logs
              </span>
              <button
                type="button"
                onClick={() => setShowFullModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── USER MONTHLY HISTORY MODAL ─────────────────────────────────── */}
      {userHistoryModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setUserHistoryModal(prev => ({ ...prev, isOpen: false }));
            }
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200/90 overflow-hidden ring-1 ring-black/5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* History Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-blue-50/30 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-500/25 ring-4 ring-indigo-50 shrink-0">
                  {getInitials(userHistoryModal.displayName, userHistoryModal.username)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-base">
                      {userHistoryModal.displayName}
                    </h3>
                    <span className="font-mono text-3xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200/70">
                      @{userHistoryModal.username}
                    </span>
                    {userHistoryModal.userRole && (
                      <span className="text-3xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
                        {userHistoryModal.userRole}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly Activity & Attendance Breakdown
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Month Selector */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs hover:border-indigo-300 transition-colors">
                  <CalendarIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <select
                    value={userHistoryModal.selectedMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer pr-1 outline-none"
                  >
                    {(userHistoryModal.availableMonths || []).map(m => {
                      const [y, mon] = (m || '').split('-');
                      const d = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
                      const label = !isNaN(d.getTime()) ? d.toLocaleString('default', { month: 'long', year: 'numeric' }) : m;
                      return (
                        <option key={m} value={m}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setUserHistoryModal(prev => ({ ...prev, isOpen: false }))}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* History Modal Body: Day-by-Day Table */}
            <div className="p-0 overflow-y-auto flex-1 bg-white">
              {userHistoryModal.loading ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshIcon className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Loading activity history...</p>
                </div>
              ) : userHistoryModal.error ? (
                <div className="py-16 text-center text-rose-500">
                  <p className="font-bold text-sm">{userHistoryModal.error}</p>
                </div>
              ) : userHistoryModal.history.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-25 text-slate-400" />
                  <p className="font-bold text-sm text-slate-700">No activity recorded for this month</p>
                  <p className="text-xs text-slate-400 mt-1">Select another month from the top right to view historical records.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-100/75 text-slate-500 font-bold uppercase tracking-wider text-3xs sticky top-0 z-10 backdrop-blur-xs">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-5 py-3">Started Time</th>
                        <th className="px-5 py-3">Total Active</th>
                        <th className="px-5 py-3">Last Active</th>
                        <th className="px-6 py-3 text-right">Activity Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {userHistoryModal.history.map(row => {
                        const formatDate = (dateStr) => {
                          if (!dateStr) return '';
                          try {
                            const [y, m, d] = dateStr.split('-').map(Number);
                            return new Date(y, m - 1, d).toLocaleDateString('default', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            });
                          } catch (e) {
                            return dateStr;
                          }
                        };

                        const formatTime = (iso) => {
                          if (!iso) return '-';
                          try {
                            return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                          } catch (e) {
                            return '-';
                          }
                        };

                        return (
                          <tr key={row.date} className="hover:bg-indigo-50/25 transition-colors group">
                            <td className="px-6 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{formatDate(row.date)}</span>
                                {row.isToday && (
                                  <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Today
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-600 font-medium">
                              <div className="flex items-center gap-1.5">
                                <ClockIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{formatTime(row.startedTime)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-2xs border border-indigo-100 shadow-2xs">
                                {formatDuration(null, null, false, row.totalActiveMs)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-600 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{formatTime(row.lastActive)}</span>
                                {row.isLive && (
                                  <span className="inline-flex items-center gap-1 text-3xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    Active now
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3.5 whitespace-nowrap text-right">
                              <div className="inline-flex items-center gap-1 justify-end">
                                <span className="font-extrabold text-slate-800 text-xs">{row.activityCount}</span>
                                <span className="text-xs text-slate-400 font-medium">{row.activityCount === 1 ? 'action' : 'actions'}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* History Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setUserHistoryModal(prev => ({ ...prev, isOpen: false }));
                  setShowFullModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span>Back to Active Users</span>
              </button>
              <button
                type="button"
                onClick={() => setUserHistoryModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ActiveUsersWidget;
