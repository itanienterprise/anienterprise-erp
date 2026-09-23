import React, { useState, useEffect, useMemo } from 'react';
import { 
    TicketIcon, SearchIcon, PlusIcon, EditIcon, TrashIcon, 
    XIcon, CheckIcon, ChevronDownIcon, ClockIcon, AlertCircleIcon,
    RefreshCwIcon, FileTextIcon, UserIcon, CheckCircle2Icon
} from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Token.css';
import { hasPermission } from '../../../utils/permissionHelper';

const CATEGORIES = [
    'Entry Edit / Update',
    'Data Correction',
    'Delete Request',
    'Invoice / Voucher Amendment',
    'Permission & Access Request',
    'Technical Issue / Bug',
    'General Assistance / Other'
];

const MODULE_OPTIONS = [
    'Sales',
    'Purchase',
    'LC Management',
    'Stock & Warehouse',
    'Customer',
    'Supplier',
    'Bank & Payments',
    'Margin Return / Returns',
    'C&F Management',
    'Insurance',
    'Employees',
    'System / General'
];

const PRIORITIES = [
    { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'High', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Urgent', color: 'bg-rose-50 text-rose-700 border-rose-200' }
];

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];

const generateTokenNo = (existingTokens = []) => {
    const now = new Date();
    const prefix = `TK-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const seq = existingTokens.length + 1;
    const padded = String(seq).padStart(3, '0');
    return `${prefix}-${padded}`;
};

const Token = ({ currentUser, addNotification }) => {
    const [tokens, setTokens] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusTab, setSelectedStatusTab] = useState('All');
    const [selectedModuleFilter, setSelectedModuleFilter] = useState('All');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingToken, setViewingToken] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

    const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase().trim() === 'admin';
    const isIncharge = (currentUser?.role || '').toLowerCase().trim() === 'incharge';
    const canManageAll = isAdmin || isIncharge || hasPermission(currentUser, 'token', 'special');
    const canDelete = isAdmin || hasPermission(currentUser, 'token', 'delete');
    const canEdit = isAdmin || hasPermission(currentUser, 'token', 'edit');

    const emptyForm = {
        tokenNo: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        employeeName: currentUser?.name || currentUser?.username || 'Employee',
        employeeId: currentUser?.employeeId || currentUser?.username || '',
        employeeRole: currentUser?.role || 'Staff',
        category: CATEGORIES[0],
        module: MODULE_OPTIONS[0],
        referenceNo: '',
        priority: 'Medium',
        subject: '',
        description: '',
        status: 'Pending',
        assignedTo: '',
        adminRemarks: '',
        resolvedBy: '',
        resolvedAt: ''
    };

    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        fetchTokens();
    }, []);

    const fetchTokens = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/api/tokens`);
            setTokens(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error fetching tokens:', error);
            if (typeof addNotification === 'function') {
                addNotification('Failed to load tokens', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenNewModal = () => {
        setFormData({
            ...emptyForm,
            tokenNo: generateTokenNo(tokens),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            employeeName: currentUser?.name || currentUser?.username || 'Employee',
            employeeId: currentUser?.employeeId || currentUser?.username || '',
            employeeRole: currentUser?.role || 'Staff'
        });
        setEditingId(null);
        setShowFormModal(true);
    };

    const handleEditToken = (token) => {
        setFormData({
            ...emptyForm,
            ...token
        });
        setEditingId(token._id);
        setShowFormModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.subject.trim() || !formData.description.trim()) {
            alert('Please provide a subject and detailed description.');
            return;
        }

        setIsSubmitting(true);
        try {
            const dataToSave = {
                ...formData,
                updatedAt: new Date().toISOString()
            };

            // If status changed to Resolved, auto-set resolvedBy and resolvedAt
            if (dataToSave.status === 'Resolved' && !dataToSave.resolvedAt) {
                dataToSave.resolvedAt = new Date().toISOString().split('T')[0];
                dataToSave.resolvedBy = currentUser?.name || currentUser?.username || 'Admin';
            }

            if (editingId) {
                const res = await axios.put(`${API_BASE_URL}/api/tokens/${editingId}`, dataToSave);
                setTokens(prev => prev.map(t => t._id === editingId ? { ...t, ...res.data } : t));
                if (typeof addNotification === 'function') {
                    addNotification(`Token ${formData.tokenNo} updated successfully!`, 'success');
                }
            } else {
                const res = await axios.post(`${API_BASE_URL}/api/tokens`, dataToSave);
                setTokens(prev => [res.data, ...prev]);
                if (typeof addNotification === 'function') {
                    addNotification(`Token ${res.data.tokenNo || formData.tokenNo} submitted successfully!`, 'success');
                }
            }
            setShowFormModal(false);
            setEditingId(null);
            setFormData(emptyForm);
        } catch (error) {
            console.error('Error saving token:', error);
            if (typeof addNotification === 'function') {
                addNotification('Error saving token. Please try again.', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API_BASE_URL}/api/tokens/${id}`);
            setTokens(prev => prev.filter(t => t._id !== id));
            setDeleteConfirmId(null);
            if (typeof addNotification === 'function') {
                addNotification('Token deleted successfully', 'success');
            }
        } catch (error) {
            console.error('Error deleting token:', error);
            if (typeof addNotification === 'function') {
                addNotification('Failed to delete token', 'error');
            }
        }
    };

    const handleQuickStatusChange = async (token, newStatus) => {
        try {
            const updated = {
                ...token,
                status: newStatus,
                resolvedBy: newStatus === 'Resolved' ? (currentUser?.name || currentUser?.username || 'Admin') : token.resolvedBy,
                resolvedAt: newStatus === 'Resolved' ? new Date().toISOString().split('T')[0] : token.resolvedAt
            };
            await axios.put(`${API_BASE_URL}/api/tokens/${token._id}`, updated);
            setTokens(prev => prev.map(t => t._id === token._id ? { ...t, ...updated } : t));
            if (viewingToken && viewingToken._id === token._id) {
                setViewingToken(updated);
            }
            if (typeof addNotification === 'function') {
                addNotification(`Token status changed to ${newStatus}`, 'success');
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Filter tokens based on user role: Regular employees see their own tokens, admins see all
    const accessibleTokens = useMemo(() => {
        if (canManageAll) return tokens;
        const currentUserId = (currentUser?.employeeId || currentUser?.username || '').toLowerCase().trim();
        const currentUserName = (currentUser?.name || currentUser?.username || '').toLowerCase().trim();
        return tokens.filter(t => {
            const tEmpId = (t.employeeId || '').toLowerCase().trim();
            const tEmpName = (t.employeeName || '').toLowerCase().trim();
            return tEmpId === currentUserId || tEmpName === currentUserName || tEmpName.includes(currentUserName);
        });
    }, [tokens, canManageAll, currentUser]);

    // Statistics
    const stats = useMemo(() => {
        const total = accessibleTokens.length;
        const pending = accessibleTokens.filter(t => t.status === 'Pending').length;
        const inProgress = accessibleTokens.filter(t => t.status === 'In Progress').length;
        const resolved = accessibleTokens.filter(t => t.status === 'Resolved').length;
        const rejected = accessibleTokens.filter(t => t.status === 'Rejected').length;
        return { total, pending, inProgress, resolved, rejected };
    }, [accessibleTokens]);

    // Filter & Sort
    const filteredTokens = useMemo(() => {
        return accessibleTokens.filter(t => {
            // Status tab
            if (selectedStatusTab !== 'All' && t.status !== selectedStatusTab) return false;
            // Module filter
            if (selectedModuleFilter !== 'All' && t.module !== selectedModuleFilter) return false;
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchNo = (t.tokenNo || '').toLowerCase().includes(q);
                const matchSubject = (t.subject || '').toLowerCase().includes(q);
                const matchDesc = (t.description || '').toLowerCase().includes(q);
                const matchEmp = (t.employeeName || '').toLowerCase().includes(q);
                const matchRef = (t.referenceNo || '').toLowerCase().includes(q);
                const matchCat = (t.category || '').toLowerCase().includes(q);
                const matchMod = (t.module || '').toLowerCase().includes(q);
                return matchNo || matchSubject || matchDesc || matchEmp || matchRef || matchCat || matchMod;
            }
            return true;
        }).sort((a, b) => {
            let valA = a[sortConfig.key] || '';
            let valB = b[sortConfig.key] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [accessibleTokens, selectedStatusTab, selectedModuleFilter, searchQuery, sortConfig]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Pending':
                return <span className="token-status-badge pending">Pending</span>;
            case 'In Progress':
                return <span className="token-status-badge in-progress">In Progress</span>;
            case 'Resolved':
                return <span className="token-status-badge resolved">Resolved</span>;
            case 'Rejected':
                return <span className="token-status-badge rejected">Rejected</span>;
            default:
                return <span className="token-status-badge">{status || 'Open'}</span>;
        }
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'Urgent':
                return <span className="token-priority-badge urgent">Urgent</span>;
            case 'High':
                return <span className="token-priority-badge high">High</span>;
            case 'Medium':
                return <span className="token-priority-badge medium">Medium</span>;
            case 'Low':
            default:
                return <span className="token-priority-badge low">Low</span>;
        }
    };

    return (
        <div className="token-module-container">
            {/* Header Area */}
            <div className="token-header-wrapper">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                <TicketIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="token-header-title">Token Management</h1>
                                <p className="token-header-subtitle">
                                    Open and track service requests for entry edits, data changes, and technical assistance
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={fetchTokens} 
                            disabled={isLoading}
                            className="token-action-secondary-btn"
                            title="Refresh tokens"
                        >
                            <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={handleOpenNewModal}
                            className="token-action-primary-btn"
                        >
                            <PlusIcon className="w-4 h-4 mr-1.5" />
                            Open New Token
                        </button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="token-stats-grid">
                    <div 
                        className={`token-stat-card ${selectedStatusTab === 'All' ? 'active' : ''}`}
                        onClick={() => setSelectedStatusTab('All')}
                    >
                        <div className="token-stat-label">Total Requests</div>
                        <div className="token-stat-val text-gray-900">{stats.total}</div>
                    </div>
                    <div 
                        className={`token-stat-card ${selectedStatusTab === 'Pending' ? 'active ring-amber-400' : ''}`}
                        onClick={() => setSelectedStatusTab('Pending')}
                    >
                        <div className="token-stat-label text-amber-700">Pending Review</div>
                        <div className="token-stat-val text-amber-600">{stats.pending}</div>
                    </div>
                    <div 
                        className={`token-stat-card ${selectedStatusTab === 'In Progress' ? 'active ring-blue-400' : ''}`}
                        onClick={() => setSelectedStatusTab('In Progress')}
                    >
                        <div className="token-stat-label text-blue-700">In Progress</div>
                        <div className="token-stat-val text-blue-600">{stats.inProgress}</div>
                    </div>
                    <div 
                        className={`token-stat-card ${selectedStatusTab === 'Resolved' ? 'active ring-emerald-400' : ''}`}
                        onClick={() => setSelectedStatusTab('Resolved')}
                    >
                        <div className="token-stat-label text-emerald-700">Resolved</div>
                        <div className="token-stat-val text-emerald-600">{stats.resolved}</div>
                    </div>
                </div>
            </div>

            {/* Controls Bar: Search, Filters & Tabs */}
            <div className="token-controls-bar">
                {/* Search Bar */}
                <div className="token-search-wrapper">
                    <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by token #, subject, employee, module, reference..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="token-search-input"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Module Selector */}
                <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Module:</label>
                    <select
                        value={selectedModuleFilter}
                        onChange={(e) => setSelectedModuleFilter(e.target.value)}
                        className="token-filter-select"
                    >
                        <option value="All">All Modules</option>
                        {MODULE_OPTIONS.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                {/* Status Tabs */}
                <div className="token-status-tabs">
                    {['All', 'Pending', 'In Progress', 'Resolved', 'Rejected'].map(st => (
                        <button
                            key={st}
                            onClick={() => setSelectedStatusTab(st)}
                            className={`token-tab-btn ${selectedStatusTab === st ? 'active' : ''}`}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="token-table-container">
                <table className="token-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('tokenNo')} className="cursor-pointer">
                                <div className="flex items-center gap-1.5">
                                    Token No <SortIcon config={sortConfig} columnKey="tokenNo" />
                                </div>
                            </th>
                            <th onClick={() => handleSort('date')} className="cursor-pointer">
                                <div className="flex items-center gap-1.5">
                                    Date & Time <SortIcon config={sortConfig} columnKey="date" />
                                </div>
                            </th>
                            <th onClick={() => handleSort('employeeName')} className="cursor-pointer">
                                <div className="flex items-center gap-1.5">
                                    Requested By <SortIcon config={sortConfig} columnKey="employeeName" />
                                </div>
                            </th>
                            <th>Module & Ref</th>
                            <th>Subject & Category</th>
                            <th className="text-center">Priority</th>
                            <th className="text-center">Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="py-16 text-center text-gray-400">
                                    <RefreshCwIcon className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500 opacity-60" />
                                    Loading service tokens...
                                </td>
                            </tr>
                        ) : filteredTokens.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-20 text-center text-gray-400">
                                    <TicketIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="font-semibold text-gray-600">No service tokens found</p>
                                    <p className="text-xs text-gray-400 mt-1">Need help or a data change? Click "Open New Token" above.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredTokens.map(t => (
                                <tr key={t._id} className="hover:bg-blue-50/30 transition-colors">
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <span 
                                                onClick={() => { setViewingToken(t); setShowViewModal(true); }}
                                                className="font-black text-blue-600 cursor-pointer hover:underline text-xs tracking-wide"
                                            >
                                                {t.tokenNo}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-xs font-semibold text-gray-800">{t.date}</div>
                                        <div className="text-[10px] text-gray-400 font-mono">{t.time || ''}</div>
                                    </td>
                                    <td>
                                        <div className="font-bold text-gray-900 text-xs">{t.employeeName}</div>
                                        <div className="text-[10px] text-gray-400">{t.employeeRole || t.employeeId || 'Employee'}</div>
                                    </td>
                                    <td>
                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                                            {t.module || 'General'}
                                        </span>
                                        {t.referenceNo && (
                                            <div className="text-[10px] font-mono text-blue-600 font-bold mt-0.5">
                                                Ref: {t.referenceNo}
                                            </div>
                                        )}
                                    </td>
                                    <td className="max-w-[280px]">
                                        <div 
                                            onClick={() => { setViewingToken(t); setShowViewModal(true); }}
                                            className="font-bold text-gray-900 text-xs truncate hover:text-blue-600 cursor-pointer"
                                            title={t.subject}
                                        >
                                            {t.subject}
                                        </div>
                                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                            {t.category}
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        {getPriorityBadge(t.priority)}
                                    </td>
                                    <td className="text-center">
                                        {getStatusBadge(t.status)}
                                    </td>
                                    <td>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setViewingToken(t); setShowViewModal(true); }}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="View Details"
                                            >
                                                <FileTextIcon className="w-4 h-4" />
                                            </button>
                                            {(canManageAll || t.employeeName === currentUser?.name || t.employeeId === currentUser?.username) && (
                                                <button
                                                    onClick={() => handleEditToken(t)}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                    title="Edit Token"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => setDeleteConfirmId(t._id)}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Delete Token"
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

            {/* Mobile Card List */}
            <div className="token-mobile-card-list">
                {filteredTokens.map(t => (
                    <div key={t._id} className="token-mobile-card">
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                                <span className="font-black text-blue-600 text-xs tracking-wider">{t.tokenNo}</span>
                                <div className="text-[10px] text-gray-400">{t.date} {t.time}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {getPriorityBadge(t.priority)}
                                {getStatusBadge(t.status)}
                            </div>
                        </div>

                        <div 
                            onClick={() => { setViewingToken(t); setShowViewModal(true); }}
                            className="font-bold text-gray-900 text-sm mb-1 cursor-pointer"
                        >
                            {t.subject}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <span className="font-semibold text-gray-700">{t.module}</span>
                            <span>•</span>
                            <span>{t.category}</span>
                            {t.referenceNo && (
                                <>
                                    <span>•</span>
                                    <span className="font-mono text-blue-600 font-bold">Ref: {t.referenceNo}</span>
                                </>
                            )}
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                            <div className="text-gray-600">
                                By: <span className="font-bold text-gray-800">{t.employeeName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { setViewingToken(t); setShowViewModal(true); }}
                                    className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg"
                                >
                                    Details
                                </button>
                                {(canManageAll || t.employeeName === currentUser?.name) && (
                                    <button
                                        onClick={() => handleEditToken(t)}
                                        className="p-1 text-gray-500 hover:text-emerald-600"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal: Open / Edit Token */}
            {showFormModal && (
                <div className="token-modal-overlay">
                    <div className="token-modal-container">
                        <div className="token-modal-header">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingId ? 'Edit Service Token' : 'Open New Service Token'}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Submit a request for entry edit, correction, or assistance
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowFormModal(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="token-modal-body">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="token-form-field">
                                    <label className="token-form-label">Token No</label>
                                    <input
                                        type="text"
                                        value={formData.tokenNo}
                                        readOnly
                                        className="token-form-input bg-gray-50 font-mono font-bold text-blue-600 cursor-not-allowed"
                                    />
                                </div>
                                <div className="token-form-field">
                                    <label className="token-form-label">Requested Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="token-form-input"
                                        required
                                    />
                                </div>
                                <div className="token-form-field">
                                    <label className="token-form-label">Requester</label>
                                    <input
                                        type="text"
                                        value={formData.employeeName}
                                        readOnly
                                        className="token-form-input bg-gray-50 font-semibold cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="token-form-field">
                                    <label className="token-form-label">Request Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="token-form-select"
                                        required
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="token-form-field">
                                    <label className="token-form-label">ERP Module</label>
                                    <select
                                        value={formData.module}
                                        onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                                        className="token-form-select"
                                        required
                                    >
                                        {MODULE_OPTIONS.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="token-form-field">
                                    <label className="token-form-label">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="token-form-select"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent (Immediate attention)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="token-form-field">
                                    <label className="token-form-label">Reference No (Invoice #, LC #, Record ID)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. GS0348, LC-26010687, ORD-0047"
                                        value={formData.referenceNo}
                                        onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                                        className="token-form-input font-mono"
                                    />
                                </div>
                                <div className="token-form-field">
                                    <label className="token-form-label">Subject / Title</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Need to modify return quantity on GS0348"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        className="token-form-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="token-form-field">
                                <label className="token-form-label">
                                    Detailed Description of Request / Change Needed
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Please describe exactly what needs to be changed (e.g. Old value vs New value, reason for edit, or error encountered)..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="token-form-textarea"
                                    required
                                />
                            </div>

                            {/* Admin / Resolution Section (Visible to Admins or on Edit) */}
                            {canManageAll && (
                                <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60 mt-2 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                        <CheckCircle2Icon className="w-4 h-4 text-amber-600" />
                                        Admin Resolution & Status
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="token-form-field">
                                            <label className="token-form-label">Status</label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="token-form-select font-bold"
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="token-form-field">
                                            <label className="token-form-label">Assigned Handler</label>
                                            <input
                                                type="text"
                                                placeholder="Admin or Staff Name"
                                                value={formData.assignedTo}
                                                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                                className="token-form-input"
                                            />
                                        </div>
                                    </div>
                                    <div className="token-form-field">
                                        <label className="token-form-label">Admin / Resolution Remarks</label>
                                        <textarea
                                            rows={2}
                                            placeholder="Notes on action taken, corrections performed, or reasons for rejection..."
                                            value={formData.adminRemarks}
                                            onChange={(e) => setFormData({ ...formData, adminRemarks: e.target.value })}
                                            className="token-form-textarea text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="token-modal-footer">
                                <button
                                    type="button"
                                    onClick={() => setShowFormModal(false)}
                                    className="token-btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="token-btn-primary"
                                >
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Token' : 'Submit Token'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: View Token Details */}
            {showViewModal && viewingToken && (
                <div className="token-modal-overlay">
                    <div className="token-modal-container max-w-2xl">
                        <div className="token-modal-header">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-blue-600 text-sm tracking-wider font-mono">
                                        {viewingToken.tokenNo}
                                    </span>
                                    {getStatusBadge(viewingToken.status)}
                                    {getPriorityBadge(viewingToken.priority)}
                                </div>
                                <h2 className="text-base font-bold text-gray-900 mt-1">
                                    {viewingToken.subject}
                                </h2>
                            </div>
                            <button 
                                onClick={() => setShowViewModal(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="token-modal-body space-y-4">
                            {/* Metadata Pills */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs">
                                <div>
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Requested By</span>
                                    <span className="font-bold text-gray-900">{viewingToken.employeeName}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Module</span>
                                    <span className="font-bold text-gray-900">{viewingToken.module}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Category</span>
                                    <span className="font-bold text-gray-900">{viewingToken.category}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Reference #</span>
                                    <span className="font-bold text-blue-600 font-mono">{viewingToken.referenceNo || 'None'}</span>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                                    Description of Request
                                </label>
                                <div className="p-4 bg-white rounded-xl border border-gray-200 text-gray-800 text-xs whitespace-pre-wrap leading-relaxed">
                                    {viewingToken.description}
                                </div>
                            </div>

                            {/* Admin Remarks / Resolution */}
                            {viewingToken.adminRemarks && (
                                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs space-y-1">
                                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                                        <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                                        Resolution / Admin Response
                                    </div>
                                    <p className="text-emerald-800 whitespace-pre-wrap leading-relaxed">
                                        {viewingToken.adminRemarks}
                                    </p>
                                    {viewingToken.resolvedBy && (
                                        <div className="text-[10px] text-emerald-600 font-medium pt-1">
                                            Handled by: {viewingToken.resolvedBy} {viewingToken.resolvedAt ? `on ${viewingToken.resolvedAt}` : ''}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Admin Quick Action Buttons */}
                            {canManageAll && (
                                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs text-gray-500 font-medium">
                                        Change Status:
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {viewingToken.status !== 'In Progress' && (
                                            <button
                                                onClick={() => handleQuickStatusChange(viewingToken, 'In Progress')}
                                                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors"
                                            >
                                                Mark In Progress
                                            </button>
                                        )}
                                        {viewingToken.status !== 'Resolved' && (
                                            <button
                                                onClick={() => handleQuickStatusChange(viewingToken, 'Resolved')}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-colors"
                                            >
                                                Mark Resolved
                                            </button>
                                        )}
                                        {viewingToken.status !== 'Rejected' && (
                                            <button
                                                onClick={() => handleQuickStatusChange(viewingToken, 'Rejected')}
                                                className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors"
                                            >
                                                Reject
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setShowViewModal(false);
                                                handleEditToken(viewingToken);
                                            }}
                                            className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold transition-colors"
                                        >
                                            Full Edit
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="token-modal-overlay">
                    <div className="token-modal-container max-w-sm text-center p-6">
                        <AlertCircleIcon className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-gray-900 mb-1">Delete Service Token?</h3>
                        <p className="text-xs text-gray-500 mb-5">
                            This token record will be permanently deleted from the system.
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="token-btn-secondary px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Token;
