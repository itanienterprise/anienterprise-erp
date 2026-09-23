import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    TicketIcon, SearchIcon, PlusIcon, EditIcon, TrashIcon, 
    XIcon, CheckIcon, ChevronDownIcon, ClockIcon, AlertCircleIcon,
    RefreshCwIcon, EyeIcon, UserIcon, CheckCircle2Icon, ArrowLeftIcon
} from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Token.css';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { decryptData } from '../../../utils/encryption';

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

const STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];

// Custom Searchable Dropdown - Mirrored from ReturnProduct / Exporter module style
const CustomSelect = ({
    label,
    value,
    onChange,
    options = [],
    placeholder = "Select...",
    required = false,
    searchable = true,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizedOptions = useMemo(() => {
        return (options || []).map(opt => {
            if (typeof opt === 'string') {
                return { value: opt, label: opt };
            }
            return opt;
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return normalizedOptions;
        const q = searchTerm.toLowerCase();
        return normalizedOptions.filter(opt => 
            (opt.label && String(opt.label).toLowerCase().includes(q)) ||
            (opt.sublabel && String(opt.sublabel).toLowerCase().includes(q)) ||
            (opt.value && String(opt.value).toLowerCase().includes(q))
        );
    }, [normalizedOptions, searchTerm]);

    const selectedOption = normalizedOptions.find(opt => opt.value === value);
    const displayValue = isOpen ? searchTerm : (selectedOption?.label || value || '');

    return (
        <div className="token-form-field" ref={containerRef}>
            {label && <label className="token-form-label">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    className="token-form-input pr-10 cursor-pointer"
                    placeholder={placeholder}
                    value={displayValue}
                    readOnly={!searchable}
                    disabled={disabled}
                    required={required && !value}
                    onFocus={() => {
                        if (!disabled) {
                            setIsOpen(true);
                            setSearchTerm('');
                        }
                    }}
                    onChange={(e) => {
                        if (searchable) {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }
                    }}
                    autoComplete="off"
                />
                <div 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer p-1 flex items-center"
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(prev => !prev);
                            if (isOpen) setSearchTerm('');
                        }
                    }}
                >
                    <ChevronDownIcon className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''} w-4 h-4`} />
                </div>

                {isOpen && !disabled && (
                    <div className="token-dropdown-list animate-in fade-in zoom-in-95 duration-150">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                No options found
                            </div>
                        ) : (
                            filteredOptions.map((opt, idx) => {
                                const isSelected = opt.value === value;
                                return (
                                    <div
                                        key={opt.value || idx}
                                        className={`token-dropdown-item ${isSelected ? 'active' : ''}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onChange(opt.value);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                                            {opt.sublabel && (
                                                <span className="text-xs text-gray-400 font-normal">{opt.sublabel}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const generateTokenNo = (existingTokens = []) => {
    const now = new Date();
    const prefix = `TK-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    let maxSeq = 0;
    (existingTokens || []).forEach(t => {
        const no = t?.tokenNo || '';
        if (no.startsWith(prefix)) {
            const parts = no.split('-');
            if (parts.length >= 3) {
                const num = parseInt(parts[2], 10);
                if (!isNaN(num) && num > maxSeq) {
                    maxSeq = num;
                }
            }
        }
    });
    const seq = maxSeq + 1;
    const padded = String(seq).padStart(3, '0');
    return `${prefix}-${padded}`;
};

const Token = ({ currentUser, addNotification }) => {
    const [tokens, setTokens] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatusTab, setSelectedStatusTab] = useState('All');
    const [selectedModuleFilter, setSelectedModuleFilter] = useState('All');
    
    // Inline card view states (same pattern as other ERP modules)
    const [showForm, setShowForm] = useState(false);
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
        needApproveFrom: '',
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
        fetchEmployees();
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

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/employees`);
            const rawData = Array.isArray(res.data) ? res.data : [];
            const list = rawData.map(e => {
                let d = e;
                if (e && e.data) {
                    if (typeof e.data === 'string') {
                        try { d = { ...decryptData(e.data), _id: e._id }; } catch { /* ignore */ }
                    } else if (typeof e.data === 'object') {
                        d = { ...e.data, _id: e._id };
                    }
                }
                const name = (d.name || d.nameEn || d.employeeName || d.username || '').trim();
                return {
                    _id: d._id || e._id,
                    name: name,
                    username: d.username || '',
                    employeeId: d.employeeId || '',
                    role: d.role || d.designation || 'Staff',
                    designation: d.designation || d.role || ''
                };
            }).filter(emp => emp.name || emp.username);

            list.sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username));
            setEmployees(list);
        } catch (error) {
            console.error('Error fetching employees in Token:', error);
        }
    };

    const handleOpenNew = () => {
        setFormData({
            ...emptyForm,
            tokenNo: '',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            employeeName: currentUser?.name || currentUser?.username || 'Employee',
            employeeId: currentUser?.employeeId || currentUser?.username || '',
            employeeRole: currentUser?.role || 'Staff',
            needApproveFrom: ''
        });
        setEditingId(null);
        setViewingToken(null);
        setShowForm(true);
    };

    const handleEditToken = (token) => {
        setFormData({
            ...emptyForm,
            needApproveFrom: '',
            ...token
        });
        setEditingId(token._id);
        setViewingToken(null);
        setShowForm(true);
    };

    const requestedOptions = useMemo(() => {
        const list = employees.map(emp => ({
            value: emp.name || emp.username,
            label: emp.name || emp.username,
            sublabel: emp.designation ? emp.designation : emp.role ? emp.role : ''
        }));
        if (formData.employeeName && !list.some(o => o.value === formData.employeeName)) {
            list.unshift({
                value: formData.employeeName,
                label: formData.employeeName,
                sublabel: currentUser?.role || 'Staff'
            });
        }
        return list;
    }, [employees, formData.employeeName, currentUser]);

    const approverOptions = useMemo(() => {
        const list = [
            { value: 'Admin', label: 'Admin', sublabel: 'Administrator' },
            { value: 'Incharge', label: 'Incharge', sublabel: 'System Incharge / Manager' }
        ];
        employees.forEach(emp => {
            const name = emp.name || emp.username;
            if (!list.some(l => l.value === name)) {
                list.push({
                    value: name,
                    label: name,
                    sublabel: emp.designation ? emp.designation : emp.role ? emp.role : ''
                });
            }
        });
        return list;
    }, [employees]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.subject.trim() || !formData.description.trim()) {
            alert('Please provide a subject and detailed description.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Generate token number upon submit for new tokens
            const finalTokenNo = editingId ? (formData.tokenNo || generateTokenNo(tokens)) : generateTokenNo(tokens);

            const dataToSave = {
                ...formData,
                tokenNo: finalTokenNo,
                updatedAt: new Date().toISOString()
            };

            // Auto-assign resolution metadata
            if (dataToSave.status === 'Resolved' && !dataToSave.resolvedAt) {
                dataToSave.resolvedAt = new Date().toISOString().split('T')[0];
                dataToSave.resolvedBy = currentUser?.name || currentUser?.username || 'Admin';
            }

            if (editingId) {
                const res = await axios.put(`${API_BASE_URL}/api/tokens/${editingId}`, dataToSave);
                setTokens(prev => prev.map(t => t._id === editingId ? { ...t, ...res.data } : t));
                if (typeof addNotification === 'function') {
                    addNotification(`Token ${finalTokenNo} updated successfully!`, 'success');
                }
            } else {
                const res = await axios.post(`${API_BASE_URL}/api/tokens`, dataToSave);
                setTokens(prev => [res.data, ...prev]);
                if (typeof addNotification === 'function') {
                    addNotification(`Token ${res.data.tokenNo || finalTokenNo} generated and submitted successfully!`, 'success');
                }
            }
            setShowForm(false);
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
            if (viewingToken && viewingToken._id === id) {
                setViewingToken(null);
            }
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
            if (selectedStatusTab !== 'All' && t.status !== selectedStatusTab) return false;
            if (selectedModuleFilter !== 'All' && t.module !== selectedModuleFilter) return false;
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
        <div className="token-container">
            {/* Header (Visible when list is showing) */}
            {!showForm && !viewingToken && (
                <div className="token-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <TicketIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="token-title" style={{ margin: 0 }}>Token Management</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Open and track service requests for entry edits, data changes, and technical assistance
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={fetchTokens} 
                            disabled={isLoading}
                            className="token-refresh-btn"
                            title="Refresh tokens"
                        >
                            <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={handleOpenNew}
                            className="token-add-btn whitespace-nowrap"
                        >
                            <PlusIcon className="w-4 h-4 mr-1.5" />
                            Open New Token
                        </button>
                    </div>
                </div>
            )}

            {/* INLINE CARD 1: FORM (Edit or Create New) */}
            {showForm && (
                <div className="token-form-container animate-in">
                    <div className="token-form-header">
                        <div>
                            <h3 className="token-form-title">
                                {editingId ? `Edit Service Token (${formData.tokenNo})` : 'Open New Service Token'}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Submit a request for entry edit, correction, or assistance
                            </p>
                        </div>
                        <button
                            onClick={() => { setShowForm(false); setEditingId(null); }}
                            className="token-form-close"
                            title="Close"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="token-form-card-body">
                        {/* Row 1: Requested Date, Requested, Need Approve From */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="token-form-field">
                                <label className="token-form-label">Requested Date</label>
                                <CustomDatePicker
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required={true}
                                />
                            </div>
                            <CustomSelect
                                label="Requested"
                                value={formData.employeeName}
                                onChange={(val) => {
                                    const foundEmp = employees.find(emp => (emp.name || emp.username) === val);
                                    setFormData({
                                        ...formData,
                                        employeeName: val,
                                        employeeId: foundEmp ? (foundEmp.employeeId || foundEmp.username) : formData.employeeId,
                                        employeeRole: foundEmp ? (foundEmp.role || foundEmp.designation) : formData.employeeRole
                                    });
                                }}
                                options={requestedOptions}
                                placeholder="Select requester..."
                                required={true}
                            />
                            <CustomSelect
                                label="Need Approve From"
                                value={formData.needApproveFrom}
                                onChange={(val) => setFormData({ ...formData, needApproveFrom: val })}
                                options={approverOptions}
                                placeholder="Select approver..."
                                required={true}
                            />
                        </div>

                        {/* Row 2: Category, ERP Module, Priority, Reference */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <CustomSelect
                                label="Request Category"
                                value={formData.category}
                                onChange={(val) => setFormData({ ...formData, category: val })}
                                options={CATEGORIES}
                                placeholder="Select category..."
                                required={true}
                            />
                            <CustomSelect
                                label="ERP Module"
                                value={formData.module}
                                onChange={(val) => setFormData({ ...formData, module: val })}
                                options={MODULE_OPTIONS}
                                placeholder="Select module..."
                                required={true}
                            />
                            <CustomSelect
                                label="Priority"
                                value={formData.priority}
                                onChange={(val) => setFormData({ ...formData, priority: val })}
                                options={[
                                    { value: 'Low', label: 'Low', sublabel: 'Minor' },
                                    { value: 'Medium', label: 'Medium', sublabel: 'Standard' },
                                    { value: 'High', label: 'High', sublabel: 'Urgent' },
                                    { value: 'Critical', label: 'Critical', sublabel: 'Emergency' }
                                ]}
                                placeholder="Select priority..."
                                required={true}
                            />
                            <div className="token-form-field">
                                <label className="token-form-label">Reference No (Invoice #, LC #, ID)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. GS0348, LC-26010687"
                                    value={formData.referenceNo}
                                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                                    className="token-form-input font-mono"
                                />
                            </div>
                        </div>

                        {/* Row 3: Subject */}
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

                        {/* Row 4: Description */}
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

                        {/* Admin Resolution & Status Section */}
                        {canManageAll && (
                            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-3">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                    <CheckCircle2Icon className="w-4 h-4 text-amber-600" />
                                    Admin Resolution & Status
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <CustomSelect
                                        label="Status"
                                        value={formData.status}
                                        onChange={(val) => setFormData({ ...formData, status: val })}
                                        options={STATUSES}
                                        required={true}
                                    />
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

                        {/* Footer Buttons */}
                        <div className="token-form-actions">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setEditingId(null); }}
                                className="token-btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="token-btn-primary"
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Submit Token'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* INLINE CARD 2: VIEW TOKEN DETAILS */}
            {viewingToken && !showForm && (
                <div className="token-form-container animate-in">
                    <div className="token-form-header">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setViewingToken(null)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                                title="Back to Token List"
                            >
                                <ArrowLeftIcon className="w-4 h-4" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-black text-blue-600 text-sm tracking-wider font-mono">
                                        {viewingToken.tokenNo}
                                    </span>
                                    {getStatusBadge(viewingToken.status)}
                                    {getPriorityBadge(viewingToken.priority)}
                                </div>
                                <h3 className="token-form-title mt-1">
                                    {viewingToken.subject}
                                </h3>
                            </div>
                        </div>
                        <button
                            onClick={() => setViewingToken(null)}
                            className="token-form-close"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Metadata Pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                            <div>
                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Requested By</span>
                                <span className="font-bold text-gray-900">{viewingToken.employeeName}</span>
                            </div>
                            <div>
                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Need Approve From</span>
                                <span className="font-bold text-amber-700">{viewingToken.needApproveFrom || '—'}</span>
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
                            <div className="p-5 bg-white rounded-xl border border-gray-200 text-gray-800 text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                                {viewingToken.description}
                            </div>
                        </div>

                        {/* Admin Remarks / Resolution */}
                        {viewingToken.adminRemarks && (
                            <div className="p-5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs space-y-1.5 shadow-sm">
                                <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                                    <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />
                                    Resolution / Admin Response
                                </div>
                                <p className="text-emerald-800 whitespace-pre-wrap leading-relaxed text-sm">
                                    {viewingToken.adminRemarks}
                                </p>
                                {viewingToken.resolvedBy && (
                                    <div className="text-[11px] text-emerald-600 font-medium pt-1">
                                        Handled by: <span className="font-bold">{viewingToken.resolvedBy}</span> {viewingToken.resolvedAt ? `on ${viewingToken.resolvedAt}` : ''}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Admin Quick Action Buttons */}
                        <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                            <button
                                onClick={() => setViewingToken(null)}
                                className="token-btn-secondary"
                            >
                                Back to List
                            </button>

                            <div className="flex items-center gap-2">
                                {canManageAll && (
                                    <>
                                        {viewingToken.status !== 'In Progress' && (
                                            <button
                                                onClick={() => handleQuickStatusChange(viewingToken, 'In Progress')}
                                                className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors"
                                            >
                                                Mark In Progress
                                            </button>
                                        )}
                                        {viewingToken.status !== 'Resolved' && (
                                            <button
                                                onClick={() => handleQuickStatusChange(viewingToken, 'Resolved')}
                                                className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold transition-colors shadow-sm"
                                            >
                                                Mark Resolved
                                            </button>
                                        )}
                                        {viewingToken.status !== 'Rejected' && (
                                            <button
                                                onClick={() => handleQuickStatusChange(viewingToken, 'Rejected')}
                                                className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition-colors"
                                            >
                                                Reject
                                            </button>
                                        )}
                                    </>
                                )}
                                {(canManageAll || viewingToken.employeeName === currentUser?.name) && (
                                    <button
                                        onClick={() => handleEditToken(viewingToken)}
                                        className="token-btn-primary"
                                    >
                                        Edit Token
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LIST VIEW (Visible when form or details are closed) */}
            {!showForm && !viewingToken && (
                <>
                    {/* Stats Grid */}
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

                    {/* Controls Bar: Search, Module Selector & Status Tabs */}
                    <div className="token-controls-bar">
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
                        <div className="token-table-wrapper">
                            <table className="token-table">
                                <thead>
                                    <tr>
                                        <th className="w-32 whitespace-nowrap cursor-pointer" onClick={() => handleSort('tokenNo')}>
                                            <div className="flex items-center gap-1.5">
                                                Token No <SortIcon config={sortConfig} columnKey="tokenNo" />
                                            </div>
                                        </th>
                                        <th className="w-28 whitespace-nowrap cursor-pointer" onClick={() => handleSort('date')}>
                                            <div className="flex items-center gap-1.5">
                                                Date <SortIcon config={sortConfig} columnKey="date" />
                                            </div>
                                        </th>
                                        <th className="w-36 whitespace-nowrap cursor-pointer" onClick={() => handleSort('employeeName')}>
                                            <div className="flex items-center gap-1.5">
                                                Requested By <SortIcon config={sortConfig} columnKey="employeeName" />
                                            </div>
                                        </th>
                                        <th className="w-36 whitespace-nowrap">
                                            Need Approve From
                                        </th>
                                        <th className="w-28 whitespace-nowrap cursor-pointer" onClick={() => handleSort('module')}>
                                            <div className="flex items-center gap-1.5">
                                                Module <SortIcon config={sortConfig} columnKey="module" />
                                            </div>
                                        </th>
                                        <th className="w-24 whitespace-nowrap">
                                            Ref #
                                        </th>
                                        <th className="w-40 whitespace-nowrap cursor-pointer" onClick={() => handleSort('category')}>
                                            <div className="flex items-center gap-1.5">
                                                Category <SortIcon config={sortConfig} columnKey="category" />
                                            </div>
                                        </th>
                                        <th className="min-w-[180px]">
                                            Subject
                                        </th>
                                        <th className="w-24 whitespace-nowrap text-center">
                                            Priority
                                        </th>
                                        <th className="w-28 whitespace-nowrap text-center">
                                            Status
                                        </th>
                                        <th className="w-24 whitespace-nowrap text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={11} className="py-16 text-center text-gray-400">
                                                <RefreshCwIcon className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500 opacity-60" />
                                                Loading service tokens...
                                            </td>
                                        </tr>
                                    ) : filteredTokens.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-20 text-center text-gray-400">
                                                <TicketIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p className="font-semibold text-gray-600">No service tokens found</p>
                                                <p className="text-xs text-gray-400 mt-1">Need help or a data change? Click "Open New Token" above.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTokens.map(t => (
                                            <tr key={t._id}>
                                                <td className="whitespace-nowrap font-bold">
                                                    <span 
                                                        onClick={() => setViewingToken(t)}
                                                        className="font-mono font-bold text-blue-600 cursor-pointer hover:underline text-xs tracking-wide"
                                                    >
                                                        {t.tokenNo}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap text-xs font-semibold text-gray-800">
                                                    {t.date}
                                                </td>
                                                <td className="whitespace-nowrap font-bold text-gray-900 text-xs">
                                                    {t.employeeName}
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    {t.needApproveFrom ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                            {t.needApproveFrom}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                                                        {t.module || 'General'}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    {t.referenceNo ? (
                                                        <span className="font-mono text-xs font-bold text-blue-600">
                                                            {t.referenceNo}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    <span className="text-xs text-gray-700 font-medium">
                                                        {t.category || '—'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div 
                                                        onClick={() => setViewingToken(t)}
                                                        className="font-bold text-gray-900 text-xs hover:text-blue-600 cursor-pointer line-clamp-1"
                                                        title={t.subject}
                                                    >
                                                        {t.subject}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap text-center">
                                                    {getPriorityBadge(t.priority)}
                                                </td>
                                                <td className="whitespace-nowrap text-center">
                                                    {getStatusBadge(t.status)}
                                                </td>
                                                <td className="whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setViewingToken(t)}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            title="View Details"
                                                        >
                                                            <EyeIcon className="w-4 h-4" />
                                                        </button>
                                                        {(canManageAll || t.employeeName === currentUser?.name || t.employeeId === currentUser?.username) && (
                                                            <button
                                                                onClick={() => handleEditToken(t)}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                                title="Edit Token"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => setDeleteConfirmId(t._id)}
                                                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                                    onClick={() => setViewingToken(t)}
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
                                        {t.needApproveFrom && (
                                            <span className="text-[10px] text-amber-700 font-medium ml-1.5">
                                                (Appr: {t.needApproveFrom})
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setViewingToken(t)}
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
                </>
            )}

            {/* Delete Confirmation Modal (Compact) */}
            {deleteConfirmId && (
                <div className="token-delete-overlay">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-gray-100">
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
