import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from '../../../utils/api';
import {
    SearchIcon,
    RefreshIcon,
    DownloadIcon,
    TrashIcon,
    EyeIcon,
    ActivityLogIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarIcon,
    FunnelIcon,
    XIcon,
    CheckIcon,
    ShieldIcon,
    UserIcon
} from '../../Icons';

const LogManagement = ({ currentUser, addNotification }) => {
    // Data states
    const [logs, setLogs] = useState([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [stats, setStats] = useState({
        totalLogs: 0,
        todayLogs: 0,
        todayActiveUsers: 0,
        categories: {},
        actions: {}
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters state
    const [activeCategory, setActiveCategory] = useState('ALL'); // ALL, MUTATION, APPROVAL, AUTH, UI_CLICK
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState('ALL');
    const [selectedModule, setSelectedModule] = useState('ALL');
    const [datePreset, setDatePreset] = useState('ALL'); // ALL, TODAY, YESTERDAY, 7DAYS, 30DAYS, CUSTOM
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);

    // Auto-refresh interval (in seconds, 0 = off)
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(15);
    const timerRef = useRef(null);

    // Modal states
    const [selectedLog, setSelectedLog] = useState(null);
    const [showClearModal, setShowClearModal] = useState(false);
    const [clearOlderThan, setClearOlderThan] = useState('30');
    const [clearAllConfirm, setClearAllConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    // List of distinct users and modules for filter dropdowns
    const [userOptions, setUserOptions] = useState([]);
    const [moduleOptions, setModuleOptions] = useState([]);

    // Calculate dates based on preset
    useEffect(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;

        if (datePreset === 'TODAY') {
            setStartDate(todayStr);
            setEndDate(todayStr);
        } else if (datePreset === 'YESTERDAY') {
            const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
            setStartDate(yestStr);
            setEndDate(yestStr);
        } else if (datePreset === '7DAYS') {
            const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const past7Str = `${past7.getFullYear()}-${String(past7.getMonth() + 1).padStart(2, '0')}-${String(past7.getDate()).padStart(2, '0')}`;
            setStartDate(past7Str);
            setEndDate(todayStr);
        } else if (datePreset === '30DAYS') {
            const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const past30Str = `${past30.getFullYear()}-${String(past30.getMonth() + 1).padStart(2, '0')}-${String(past30.getDate()).padStart(2, '0')}`;
            setStartDate(past30Str);
            setEndDate(todayStr);
        } else if (datePreset === 'ALL') {
            setStartDate('');
            setEndDate('');
        }
        setPage(1);
    }, [datePreset]);

    // Fetch logs from backend
    const fetchLogs = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            const params = {
                page,
                limit,
                search: searchTerm.trim() || undefined,
                user: selectedUser !== 'ALL' ? selectedUser : undefined,
                module: selectedModule !== 'ALL' ? selectedModule : undefined,
                category: activeCategory !== 'ALL' ? activeCategory : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };

            const [logsRes, statsRes] = await Promise.all([
                axios.get('/api/logs', { params }),
                axios.get('/api/logs/stats')
            ]);

            if (logsRes.data?.success) {
                const fetchedLogs = logsRes.data.logs || [];
                setLogs(fetchedLogs);
                setTotalLogs(logsRes.data.total || 0);
                setTotalPages(logsRes.data.totalPages || 1);

                // Collect distinct users & modules for dropdowns
                setUserOptions(prev => {
                    const set = new Set(prev);
                    fetchedLogs.forEach(l => { if (l.username) set.add(l.username); });
                    return Array.from(set).sort();
                });

                setModuleOptions(prev => {
                    const set = new Set(prev);
                    fetchedLogs.forEach(l => { if (l.module) set.add(l.module); });
                    return Array.from(set).sort();
                });
            }

            if (statsRes.data?.success) {
                setStats({
                    totalLogs: statsRes.data.totalLogs || 0,
                    todayLogs: statsRes.data.todayLogs || 0,
                    todayActiveUsers: statsRes.data.todayActiveUsers || 0,
                    categories: statsRes.data.categories || {},
                    actions: statsRes.data.actions || {}
                });
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
            if (addNotification) {
                addNotification('Failed to load activity logs', 'error');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // Trigger fetch on dependencies change
    useEffect(() => {
        fetchLogs(true);
    }, [page, limit, activeCategory, selectedUser, selectedModule, startDate, endDate]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchLogs(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Auto-refresh interval
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (autoRefreshInterval > 0) {
            timerRef.current = setInterval(() => {
                fetchLogs(false);
            }, autoRefreshInterval * 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [autoRefreshInterval, page, limit, activeCategory, selectedUser, selectedModule, startDate, endDate, searchTerm]);

    // Format relative time
    const formatTimeAgo = (isoDate) => {
        if (!isoDate) return 'Just now';
        const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
        if (diff < 60) return `${diff < 5 ? 'Just now' : diff + 's ago'}`;
        const mins = Math.floor(diff / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(isoDate).toLocaleDateString();
    };

    // Action Badge styling
    const getActionBadge = (action, category) => {
        const act = (action || '').toUpperCase();
        if (act === 'CREATE') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">CREATE</span>;
        }
        if (act === 'UPDATE') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">UPDATE</span>;
        }
        if (act === 'DELETE') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">DELETE</span>;
        }
        if (act === 'APPROVE') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">APPROVE</span>;
        }
        if (act === 'LOGIN' || act === 'LOGOUT') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">{act}</span>;
        }
        if (act === 'CLICK') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">CLICK</span>;
        }
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">{act}</span>;
    };

    // Module Badge styling
    const getModuleBadge = (mod) => {
        const colors = [
            'bg-sky-50 text-sky-700 border-sky-200',
            'bg-indigo-50 text-indigo-700 border-indigo-200',
            'bg-emerald-50 text-emerald-700 border-emerald-200',
            'bg-amber-50 text-amber-700 border-amber-200',
            'bg-purple-50 text-purple-700 border-purple-200',
            'bg-teal-50 text-teal-700 border-teal-200'
        ];
        let hash = 0;
        const str = mod || 'System';
        for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
        const colorClass = colors[hash % colors.length];

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
                {str}
            </span>
        );
    };

    // Export logs to CSV
    const handleExportCSV = () => {
        if (logs.length === 0) {
            if (addNotification) addNotification('No logs to export', 'warning');
            return;
        }

        const headers = ['Timestamp', 'Username', 'Role', 'Module', 'Action', 'Category', 'Description', 'IP', 'Status'];
        const rows = logs.map(l => [
            `"${new Date(l.timestamp).toISOString()}"`,
            `"${l.username || ''}"`,
            `"${l.userRole || ''}"`,
            `"${l.module || ''}"`,
            `"${l.action || ''}"`,
            `"${l.actionCategory || ''}"`,
            `"${(l.description || '').replace(/"/g, '""')}"`,
            `"${l.ip || ''}"`,
            `"${l.status || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `system_logs_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (addNotification) addNotification('Exported logs to CSV successfully', 'success');
    };

    // Purge / Clear logs
    const handleClearLogs = async () => {
        setIsClearing(true);
        try {
            const body = clearAllConfirm ? { all: true } : { olderThanDays: parseInt(clearOlderThan) || 30 };
            const res = await axios.delete('/api/logs/clear', { data: body });

            if (res.data?.success) {
                if (addNotification) addNotification(res.data.message || 'Logs cleared successfully', 'success');
                setShowClearModal(false);
                setClearAllConfirm(false);
                fetchLogs(true);
            }
        } catch (err) {
            console.error('Error clearing logs:', err);
            if (addNotification) addNotification('Failed to clear logs: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Top Header Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                        <ActivityLogIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-800 tracking-tight">System Operation & Audit Logs</h1>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Tracking
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Comprehensive record of all user operations, mutations, approvals, and interface interactions
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Auto refresh dropdown */}
                    <div className="flex items-center text-xs text-slate-600 bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <span className="px-2 font-medium">Auto-Refresh:</span>
                        <select
                            value={autoRefreshInterval}
                            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                            className="bg-white text-xs font-semibold text-slate-700 rounded px-2 py-1 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value={0}>Paused</option>
                            <option value={10}>Every 10s</option>
                            <option value={15}>Every 15s</option>
                            <option value={30}>Every 30s</option>
                            <option value={60}>Every 60s</option>
                        </select>
                    </div>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => fetchLogs(false)}
                        disabled={isRefreshing || isLoading}
                        title="Refresh now"
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
                    >
                        <RefreshIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                        Refresh
                    </button>

                    {/* Export CSV Button */}
                    <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                        <DownloadIcon className="w-3.5 h-3.5 text-slate-600" />
                        Export CSV
                    </button>

                    {/* Clear Logs Button (Admin only) */}
                    <button
                        onClick={() => setShowClearModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors shadow-2xs"
                    >
                        <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
                        Clear Logs
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* KPI Metrics Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Operations */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Operations</span>
                            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                                <ActivityLogIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-slate-800 tracking-tight">
                            {stats.totalLogs.toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">All recorded actions in system</p>
                    </div>

                    {/* Operations Today */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Operations</span>
                            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                                <CalendarIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-emerald-600 tracking-tight">
                            {stats.todayLogs.toLocaleString()}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Activity since midnight</p>
                    </div>

                    {/* Active Users Today */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Users Today</span>
                            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                                <UserIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 text-2xl font-black text-indigo-600 tracking-tight">
                            {stats.todayActiveUsers}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Distinct users logged in</p>
                    </div>

                    {/* Action Breakdown */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key Breakdown</span>
                            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                <ShieldIcon className="w-4 h-4" />
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                                {stats.actions?.CREATE || 0} Creates
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                                {stats.actions?.UPDATE || 0} Updates
                            </span>
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold border border-rose-100">
                                {stats.actions?.DELETE || 0} Deletes
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Data modifications distribution</p>
                    </div>
                </div>

                {/* Category Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
                    {[
                        { key: 'ALL', label: 'All Operations', count: stats.totalLogs },
                        { key: 'MUTATION', label: 'Data Changes (CRUD)', count: stats.categories?.MUTATION || 0 },
                        { key: 'APPROVAL', label: 'Approvals & Requests', count: stats.categories?.APPROVAL || 0 },
                        { key: 'AUTH', label: 'Logins & Auth', count: stats.categories?.AUTH || 0 },
                        { key: 'UI_CLICK', label: 'User Clicks & Actions', count: stats.categories?.UI_CLICK || 0 },
                        { key: 'SYSTEM', label: 'System & Backups', count: stats.categories?.SYSTEM || 0 }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => {
                                setActiveCategory(tab.key);
                                setPage(1);
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
                                activeCategory === tab.key
                                    ? 'border-blue-600 text-blue-600 bg-white shadow-2xs font-bold'
                                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                                    activeCategory === tab.key
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-200/70 text-slate-600'
                                }`}>
                                    {tab.count.toLocaleString()}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Filter Toolbar */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        {/* Search Input */}
                        <div className="md:col-span-4 relative">
                            <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search by keyword, user, module, IP..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter by User */}
                        <div className="md:col-span-2">
                            <select
                                value={selectedUser}
                                onChange={(e) => {
                                    setSelectedUser(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
                            >
                                <option value="ALL">All Users</option>
                                {userOptions.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filter by Module */}
                        <div className="md:col-span-2">
                            <select
                                value={selectedModule}
                                onChange={(e) => {
                                    setSelectedModule(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 font-medium"
                            >
                                <option value="ALL">All Modules</option>
                                {moduleOptions.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Preset Buttons */}
                        <div className="md:col-span-4 flex items-center justify-end gap-1 flex-wrap">
                            {[
                                { key: 'ALL', label: 'All Time' },
                                { key: 'TODAY', label: 'Today' },
                                { key: 'YESTERDAY', label: 'Yesterday' },
                                { key: '7DAYS', label: '7 Days' },
                                { key: '30DAYS', label: '30 Days' },
                                { key: 'CUSTOM', label: 'Custom' }
                            ].map(btn => (
                                <button
                                    key={btn.key}
                                    onClick={() => setDatePreset(btn.key)}
                                    className={`px-2.5 py-1.5 text-2xs font-semibold rounded-md transition-colors ${
                                        datePreset === btn.key
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range Picker when CUSTOM is selected */}
                    {datePreset === 'CUSTOM' && (
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-3 text-xs">
                            <span className="text-slate-500 font-medium">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-slate-500 font-medium">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setDatePreset('ALL');
                                    }}
                                    className="text-xs text-rose-600 hover:underline ml-2"
                                >
                                    Clear dates
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Logs Table Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                                    <th className="py-3 px-4 w-36">Time</th>
                                    <th className="py-3 px-4 w-44">User</th>
                                    <th className="py-3 px-4 w-32">Module</th>
                                    <th className="py-3 px-4 w-28">Action</th>
                                    <th className="py-3 px-4">Operation Description</th>
                                    <th className="py-3 px-4 w-32">IP Address</th>
                                    <th className="py-3 px-4 w-20 text-center">Inspect</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-slate-400">
                                            <div className="inline-flex items-center gap-2">
                                                <RefreshIcon className="w-5 h-5 animate-spin text-blue-600" />
                                                <span className="font-medium text-sm">Loading activity logs...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-slate-400">
                                            <div className="max-w-xs mx-auto space-y-2">
                                                <ActivityLogIcon className="w-10 h-10 mx-auto text-slate-300" />
                                                <p className="font-semibold text-slate-700">No logs found</p>
                                                <p className="text-xs text-slate-500">
                                                    No activities match your current filter settings. Try clearing search or date filters.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const dateObj = new Date(log.timestamp);
                                        const fullDate = dateObj.toLocaleString();

                                        return (
                                            <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* Time */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="font-semibold text-slate-800">
                                                        {formatTimeAgo(log.timestamp)}
                                                    </div>
                                                    <div className="text-3xs text-slate-400 font-mono" title={fullDate}>
                                                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </div>
                                                </td>

                                                {/* User */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                            {(log.username || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-slate-800 truncate">
                                                                {log.displayName || log.username}
                                                            </div>
                                                            <div className="text-3xs text-slate-400 truncate">
                                                                @{log.username} {log.userRole ? `• ${log.userRole}` : ''}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Module */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {getModuleBadge(log.module)}
                                                </td>

                                                {/* Action */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {getActionBadge(log.action, log.actionCategory)}
                                                </td>

                                                {/* Description */}
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-slate-800 line-clamp-2">
                                                        {log.description}
                                                    </div>
                                                    {log.path && (
                                                        <div className="text-3xs text-slate-400 font-mono mt-0.5 truncate">
                                                            {log.method} {log.path}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* IP Address & Status */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="font-mono text-xs text-slate-600">
                                                        {log.ip || '127.0.0.1'}
                                                    </div>
                                                    {log.status === 'FAILED' ? (
                                                        <span className="inline-flex items-center gap-1 text-3xs font-semibold text-rose-600">
                                                            <XIcon className="w-3 h-3" /> Failed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-600">
                                                            <CheckIcon className="w-3 h-3" /> Success
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Inspect Action */}
                                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => setSelectedLog(log)}
                                                        title="Inspect full details"
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-2">
                            <span>Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, totalLogs)} of {totalLogs.toLocaleString()} entries</span>
                            <span className="text-slate-300">|</span>
                            <span>Rows per page:</span>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs font-medium focus:outline-none"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                            >
                                <ChevronLeftIcon className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                            >
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inspection Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                    <ActivityLogIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">Operation Detail Inspection</h3>
                                    <p className="text-xs text-slate-500 font-mono">ID: {selectedLog._id}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-slate-400 font-semibold block text-3xs uppercase">Timestamp</span>
                                    <span className="text-slate-800 font-mono font-medium">{new Date(selectedLog.timestamp).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-3xs uppercase">User</span>
                                    <span className="text-slate-800 font-semibold">{selectedLog.displayName || selectedLog.username} (@{selectedLog.username})</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-3xs uppercase">Role</span>
                                    <span className="text-slate-800 font-medium">{selectedLog.userRole || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-3xs uppercase">Module</span>
                                    <span className="text-slate-800 font-semibold">{selectedLog.module}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-3xs uppercase">Action Type</span>
                                    <span className="font-bold">{selectedLog.action} ({selectedLog.actionCategory})</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 font-semibold block text-3xs uppercase">IP Address</span>
                                    <span className="text-slate-800 font-mono">{selectedLog.ip || '127.0.0.1'}</span>
                                </div>
                            </div>

                            {/* Full Description */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-700 mb-1">Description</h4>
                                <div className="p-3 bg-slate-100 rounded-lg text-slate-800 font-medium border border-slate-200">
                                    {selectedLog.description}
                                </div>
                            </div>

                            {/* Technical Details / Snapshot */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-xs font-bold text-slate-700">Payload Snapshot / Context Details</h4>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(JSON.stringify(selectedLog.details || {}, null, 2));
                                            if (addNotification) addNotification('Copied details to clipboard', 'info');
                                        }}
                                        className="text-3xs text-blue-600 hover:underline font-semibold"
                                    >
                                        Copy JSON
                                    </button>
                                </div>
                                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-2xs overflow-x-auto max-h-56 leading-relaxed">
                                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                                </pre>
                            </div>

                            {/* Client & Request Info */}
                            <div className="pt-2 border-t border-slate-200 text-3xs text-slate-500 font-mono space-y-1">
                                <div>HTTP Method: {selectedLog.method || 'N/A'} | Route: {selectedLog.path || 'N/A'}</div>
                                <div className="truncate">User Agent: {selectedLog.userAgent || 'N/A'}</div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Logs Confirmation Modal */}
            {showClearModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-100">
                                <TrashIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Clear Activity Logs</h3>
                                <p className="text-xs text-slate-500">Purge historical log records from database</p>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs text-slate-700">
                            <label className="block font-semibold">Select Purge Scope:</label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="purgeScope"
                                        checked={!clearAllConfirm}
                                        onChange={() => setClearAllConfirm(false)}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>Delete logs older than:</span>
                                    <select
                                        value={clearOlderThan}
                                        onChange={(e) => setClearOlderThan(e.target.value)}
                                        disabled={clearAllConfirm}
                                        className="bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-medium"
                                    >
                                        <option value="7">7 Days</option>
                                        <option value="30">30 Days</option>
                                        <option value="60">60 Days</option>
                                        <option value="90">90 Days</option>
                                    </select>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer text-rose-600 font-semibold">
                                    <input
                                        type="radio"
                                        name="purgeScope"
                                        checked={clearAllConfirm}
                                        onChange={() => setClearAllConfirm(true)}
                                        className="text-rose-600 focus:ring-rose-500"
                                    />
                                    <span>Purge ALL logs completely (Cannot be undone)</span>
                                </label>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                            <button
                                onClick={() => {
                                    setShowClearModal(false);
                                    setClearAllConfirm(false);
                                }}
                                disabled={isClearing}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearLogs}
                                disabled={isClearing}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
                            >
                                {isClearing ? (
                                    <>
                                        <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    'Confirm & Purge'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogManagement;
