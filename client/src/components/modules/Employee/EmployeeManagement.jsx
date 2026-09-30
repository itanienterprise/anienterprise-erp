import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EditIcon, TrashIcon, UserIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, EyeIcon, ShieldIcon, PhoneIcon, MailIcon, UploadIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import axios from '../../../utils/api';
import { useQueryClient } from '@tanstack/react-query';
import { useEmployees, useCustomRoles, QUERY_KEYS } from '../../../hooks/useQueries';
import CustomDatePicker from '../../shared/CustomDatePicker';
import '../Profile/Profile.css';
import './EmployeeManagement.css';

const EmployeeManagement = ({
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    editingId,
    setEditingId,
    sortConfig,
    setSortConfig,
    onDeleteConfirm,
    startLongPress,
    endLongPress
}) => {
    const [showForm, setShowForm] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState(null);
    const [generatedId, setGeneratedId] = useState(null);
    const queryClient = useQueryClient();
    const { data: queryEmployees, isLoading: isQueryLoading, refetch: refetchEmployees } = useEmployees();
    const { data: queryCustomRoles, refetch: refetchCustomRoles } = useCustomRoles();

    const [filters, setFilters] = useState({ status: 'All Status' });
    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewData, setViewData] = useState(null);
    const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [openDropdown, setOpenDropdown] = useState(null);
    const roleDropdownRef = useRef(null);
    const statusDropdownRef = useRef(null);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [resetPasswordValue, setResetPasswordValue] = useState(null);
    const [showConfirmReset, setShowConfirmReset] = useState(false);
    const employeePhotoInputRef = useRef(null);
    const [isUploadingEmployeePhoto, setIsUploadingEmployeePhoto] = useState(false);

    // Sync React Query cache to local state
    useEffect(() => {
        if (queryEmployees) {
            setEmployees(queryEmployees);
        }
    }, [queryEmployees]);

    const getNameFontSize = (name = '') => {
        if (!name) return '1.75rem';
        if (name.length > 25) return '1.32rem';
        if (name.length > 18) return '1.52rem';
        return '1.75rem';
    };

    const handleEmployeePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !viewData) return;
        if (employeePhotoInputRef.current) employeePhotoInputRef.current.value = '';

        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('Image must be under 10 MB.');
            return;
        }

        setIsUploadingEmployeePhoto(true);
        try {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const dataUrl = ev.target.result;
                // Instant optimistic update
                setViewData(prev => ({ ...prev, profilePhoto: dataUrl }));
                setEmployees(prev => prev.map(emp => emp._id === viewData._id ? { ...emp, profilePhoto: dataUrl } : emp));
                queryClient.setQueryData(QUERY_KEYS.employees, (old) => {
                    if (!Array.isArray(old)) return old;
                    return old.map(emp => emp._id === viewData._id ? { ...emp, profilePhoto: dataUrl } : emp);
                });

                try {
                    const response = await axios.post(`${API_BASE_URL}/api/employees/${viewData._id}/photo`, { photo: dataUrl });
                    if (response.data?.success) {
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
                    }
                } catch (err) {
                    console.error('Error uploading employee photo:', err);
                    alert('Failed to upload employee photo.');
                    refetchEmployees();
                } finally {
                    setIsUploadingEmployeePhoto(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setIsUploadingEmployeePhoto(false);
        }
    };

    const handleRemoveEmployeePhoto = async () => {
        if (!viewData || isUploadingEmployeePhoto) return;
        setIsUploadingEmployeePhoto(true);
        // Instant optimistic update
        setViewData(prev => ({ ...prev, profilePhoto: null }));
        setEmployees(prev => prev.map(emp => emp._id === viewData._id ? { ...emp, profilePhoto: null } : emp));
        queryClient.setQueryData(QUERY_KEYS.employees, (old) => {
            if (!Array.isArray(old)) return old;
            return old.map(emp => emp._id === viewData._id ? { ...emp, profilePhoto: null } : emp);
        });

        try {
            const response = await axios.post(`${API_BASE_URL}/api/employees/${viewData._id}/photo`, { photo: null });
            if (response.data?.success) {
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
            }
        } catch (err) {
            console.error('Error removing employee photo:', err);
            alert('Failed to remove photo.');
            refetchEmployees();
        } finally {
            setIsUploadingEmployeePhoto(false);
        }
    };

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdminUser = currentUser?.username === 'admin';
    const isAdminRole = (currentUser?.role || '').toLowerCase() === 'admin';
    const isAdmin = isAdminUser || isAdminRole;
    const isIncharge = (currentUser?.role || '').toLowerCase() === 'incharge';
    const canAdd = hasPermission(currentUser, 'employees', 'add');
    const canEdit = hasPermission(currentUser, 'employees', 'edit');
    const canDelete = hasPermission(currentUser, 'employees', 'delete');
    const canSpecial = hasPermission(currentUser, 'employees', 'special');
    const cannotManage = !canAdd && !canEdit;
    const cannotDelete = !canDelete;

    const toggleCardExpansion = (id) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedCards(newExpanded);
    };

    const [formData, setFormData] = useState({
        employeeId: '',
        firstName: '',
        lastName: '',
        name: '',
        designation: '',
        department: '',
        phone: '+880',
        email: '',
        joiningDate: new Date().toISOString().split('T')[0],
        salary: '',
        role: 'General Staff',
        status: 'Active'
    });

    const [customRoles, setCustomRoles] = useState([]);

    useEffect(() => {
        if (queryCustomRoles) {
            setCustomRoles(queryCustomRoles);
        }
    }, [queryCustomRoles]);

    const fetchCustomRoles = async () => {
        try {
            const res = await refetchCustomRoles();
            if (res.data) {
                setCustomRoles(res.data);
            }
        } catch (error) {
            console.error('Error fetching custom roles:', error);
        }
    };

    // Close custom dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.target && !document.body.contains(e.target)) {
                return;
            }
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
                setOpenDropdown(prev => prev === 'role' ? null : prev);
            }
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
                setOpenDropdown(prev => prev === 'status' ? null : prev);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterPanel]);


    const fetchEmployees = async () => {
        setIsLoading(true);
        try {
            const res = await refetchEmployees();
            if (res.data) {
                setEmployees(res.data);
            }
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            const val = e.target.value.replace(/[^0-9+\s\-()]/g, '');
            if (val.length <= 20) {
                setFormData(prev => ({ ...prev, [name]: val }));
            }
            return;
        }

        if (name === 'firstName' || name === 'lastName') {
            setFormData(prev => {
                const updated = { ...prev, [name]: value };
                const fullName = `${updated.firstName || ''} ${updated.lastName || ''}`.trim();
                return { ...updated, name: fullName };
            });
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        let phoneVal = (formData.phone || '').trim();
        if (/^01[3-9]\d{8}$/.test(phoneVal)) {
            phoneVal = '+880' + phoneVal.substring(1);
        }

        if (phoneVal && phoneVal !== '+880' && phoneVal.length !== 14) {
            alert('Phone number must be a valid 11-digit or 14-digit number (e.g., 01700000000 or +8801700000000)');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const fullName = `${formData.firstName || ''} ${formData.lastName || ''}`.trim() || formData.name;
            const payload = {
                ...formData,
                name: fullName
            };

            // OPTIMISTIC UPDATE: instant UI feedback (0ms delay)
            if (editingId) {
                const optimisticEmployee = {
                    ...formData,
                    name: fullName,
                    _id: editingId
                };
                setEmployees(prev => prev.map(emp => emp._id === editingId ? { ...emp, ...optimisticEmployee } : emp));
                queryClient.setQueryData(QUERY_KEYS.employees, (old) => {
                    if (!Array.isArray(old)) return old;
                    return old.map(emp => emp._id === editingId ? { ...emp, ...optimisticEmployee } : emp);
                });
            }

            const url = editingId ? `${API_BASE_URL}/api/employees/${editingId}` : `${API_BASE_URL}/api/employees`;
            let response;
            if (editingId) {
                response = await axios.put(url, payload);
            } else {
                response = await axios.post(url, payload);
            }

            if (response.status >= 200 && response.status < 300) {
                const result = response.data;
                if (result.plainPassword) {
                    setGeneratedPassword(result.plainPassword);
                }
                if (result.employeeId) {
                    setGeneratedId(result.employeeId);
                }
                setSubmitStatus('success');

                const savedEmployee = result.employee || result;
                if (!editingId && savedEmployee && (savedEmployee._id || savedEmployee.employeeId)) {
                    setEmployees(prev => [savedEmployee, ...prev]);
                    queryClient.setQueryData(QUERY_KEYS.employees, (old) => [savedEmployee, ...(Array.isArray(old) ? old : [])]);
                }

                // Invalidate cache for background sync
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
            } else {
                setSubmitStatus('error');
                fetchEmployees();
            }
        } catch (error) {
            console.error('Error saving employee:', error);
            setSubmitStatus('error');
            fetchEmployees();
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
            firstName: '',
            lastName: '',
            name: '',
            designation: '',
            department: '',
            phone: '+880',
            email: '',
            joiningDate: new Date().toISOString().split('T')[0],
            salary: '',
            role: 'General Staff',
            status: 'Active'
        });
        setEditingId(null);
        setGeneratedPassword(null);
        setGeneratedId(null);
    };

    const handleEdit = (employee) => {
        let firstName = employee.firstName || '';
        let lastName = employee.lastName || '';
        if (!firstName && !lastName && employee.name) {
            const parts = employee.name.trim().split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }

        setFormData({
            employeeId: employee.employeeId || '',
            firstName,
            lastName,
            name: employee.name || `${firstName} ${lastName}`.trim(),
            designation: employee.designation || '',
            department: employee.department || '',
            phone: (employee.phone && !employee.phone.includes('X')) ? employee.phone : '',
            email: employee.email || '',
            joiningDate: employee.joiningDate || new Date().toISOString().split('T')[0],
            salary: employee.salary || '',
            role: employee.role || 'General Staff',
            status: employee.status || 'Active'
        });
        setEditingId(employee._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (cannotDelete) {
            alert('Forbidden: You do not have permission to delete employees');
            return;
        }
        onDeleteConfirm({ show: true, type: 'employees', id, isBulk: false });
    };

    const handleResetPassword = async (id) => {
        setResettingPassword(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/employees/${id}/reset-password`);
            if (response.data && response.data.newPassword) {
                setResetPasswordValue(response.data.newPassword);
                setShowConfirmReset(false);
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            alert('Failed to reset password. Employee may not have an active user account.');
            setShowConfirmReset(false);
        } finally {
            setResettingPassword(false);
        }
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === employees.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(employees.map(e => e._id)));
            setIsSelectionMode(true);
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.employee?.key === key && sortConfig.employee?.direction === 'asc') direction = 'desc';
        setSortConfig({ ...sortConfig, employee: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.employee) return data;
        const { key, direction } = sortConfig.employee;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getFilteredAndSortedData = () => {
        let filtered = employees;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = employees.filter(e =>
                e.employeeId?.toLowerCase().includes(query) ||
                e.name?.toLowerCase().includes(query) ||
                e.firstName?.toLowerCase().includes(query) ||
                e.lastName?.toLowerCase().includes(query) ||
                e.designation?.toLowerCase().includes(query) ||
                e.department?.toLowerCase().includes(query) ||
                e.phone?.toLowerCase().includes(query) ||
                e.role?.toLowerCase().includes(query)
            );
        }

        if (filters.status && filters.status !== 'All Status') {
            filtered = filtered.filter(e => e.status === filters.status);
        }

        return sortData(filtered);
    };

    return (
        <div className="employee-container space-y-6 text-left">
            {!showForm && (
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="w-full md:w-1/4 text-left">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800">Employee Management</h2>
                    </div>

                    <div className="flex-1 w-full max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by ID, Name, Designation..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 block w-full pl-10 pr-4 bg-white/50 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                    </div>

                    <div className="w-full md:w-1/4 flex items-center justify-between md:justify-end gap-3 z-30">
                        <div className="flex-1 md:flex-none flex items-center gap-2 relative">
                            {filters.status && (
                                <button
                                    ref={filterButtonRef}
                                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all shadow-sm whitespace-nowrap"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                    {filters.status}
                                    <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform duration-300 ${showFilterPanel ? 'rotate-180' : ''}`} />
                                </button>
                            )}

                            {showFilterPanel && (
                                <div
                                    ref={filterPanelRef}
                                    className="absolute right-0 top-full mt-3 w-72 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in zoom-in duration-200"
                                >
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                        <h4 className="font-bold text-gray-900">Filters</h4>
                                        <button
                                            onClick={() => {
                                                setFilters({ status: 'All Status' });
                                                setShowFilterPanel(false);
                                            }}
                                            className="text-xs text-rose-500 hover:text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1 font-sans">Status</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {['All Status', 'Active', 'Inactive'].map((status) => (
                                                    <button
                                                        key={status}
                                                        onClick={() => setFilters({ status })}
                                                        className={`w-full px-4 py-2.5 text-left text-sm rounded-xl transition-all border ${filters.status === status
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium shadow-sm'
                                                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <span>{status}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!cannotManage && (
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="h-10 border border-transparent flex-1 md:flex-none justify-center px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center text-sm"
                            >
                                <span className="mr-2 text-xl">+</span> Add New
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showForm && (
                <div className="employee-form-container">
                    <div className="employee-form-header">
                        <h3 className="employee-form-title font-sans">{editingId ? 'Edit Employee' : 'New Employee Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="employee-form-close">
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
                        autoComplete="off"
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 text-left"
                    >
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Employee ID</label>
                            <input
                                type="text"
                                name="employeeId"
                                value={editingId ? formData.employeeId : ''}
                                readOnly
                                placeholder="Auto-generated on creation"
                                className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg focus:outline-none transition-all backdrop-blur-sm opacity-70 cursor-not-allowed"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 font-sans">First Name</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="First Name"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 font-sans">Last Name</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    placeholder="Last Name (optional)"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Designation</label>
                            <input
                                type="text"
                                name="designation"
                                value={formData.designation}
                                onChange={handleInputChange}
                                required
                                placeholder="Manager"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Department</label>
                            <input
                                type="text"
                                name="department"
                                value={formData.department}
                                onChange={handleInputChange}
                                required
                                placeholder="Operations"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                                placeholder="+880..."
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="example@mail.com"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <CustomDatePicker
                            label="Joining Date"
                            name="joiningDate"
                            value={formData.joiningDate}
                            onChange={handleInputChange}
                            required
                            compact={true}
                        />
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Salary</label>
                            <input
                                type="number"
                                name="salary"
                                value={formData.salary}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Role</label>
                            <div className="relative" ref={roleDropdownRef}>
                                <button
                                    type="button"
                                    disabled={isIncharge}
                                    onClick={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')}
                                    className={`w-full px-4 py-2 pr-10 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-gray-800 text-left flex items-center justify-between ${isIncharge ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <span>{formData.role}</span>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openDropdown === 'role' ? 'rotate-180' : ''}`} />
                                </button>
                                {openDropdown === 'role' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {[
                                            'Admin', 'Incharge', 'LC Manager', 'Sales Manager', 'Accounts Manager', 'Border Manager', 'Data Entry', 'General Staff',
                                            ...customRoles.filter(cr => !['Admin', 'Incharge', 'LC Manager', 'Sales Manager', 'Accounts Manager', 'Border Manager', 'Data Entry', 'General Staff'].includes(cr.name)).map(cr => cr.name)
                                        ].map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => { setFormData(p => ({ ...p, role: opt })); setOpenDropdown(null); }}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.role === opt ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Status</label>
                            <div className="relative" ref={statusDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                                    className="w-full px-4 py-2 pr-10 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-gray-800 text-left flex items-center justify-between"
                                >
                                    <span>{formData.status}</span>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openDropdown === 'status' ? 'rotate-180' : ''}`} />
                                </button>
                                {openDropdown === 'status' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden py-1">
                                        {['Active', 'Inactive'].map(opt => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => { setFormData(p => ({ ...p, status: opt })); setOpenDropdown(null); }}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.status === opt ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-4 pt-4">
                            {submitStatus === 'success' && (
                                <div className="space-y-4">
                                    <div className="flex items-center text-green-600 font-bold bg-green-50 p-3 rounded-lg border border-green-100">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Employee Registered Successfully!
                                    </div>

                                    {generatedPassword && (
                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-sm animate-in zoom-in duration-300">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">Login Credentials</p>
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">Action Required</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-50">
                                                    <span className="text-xs text-gray-500 font-medium">Username / Employee ID</span>
                                                    <span className="text-sm font-bold text-gray-800">{generatedId || formData.employeeId}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-50">
                                                    <span className="text-xs text-gray-500 font-medium">Password</span>
                                                    <span className="text-sm font-bold text-blue-600 font-mono tracking-wider">{generatedPassword}</span>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-start space-x-2">
                                                <ShieldIcon className="w-3.5 h-3.5 text-blue-400 mt-0.5" />
                                                <p className="text-[10px] text-gray-500 leading-relaxed italic">
                                                    Please share these credentials with the employee. This password is shown only once and cannot be retrieved later.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForm(false);
                                                setEditingId(null);
                                                resetForm();
                                                setSubmitStatus(null);
                                            }}
                                            className="px-10 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg hover:bg-black transition-all"
                                        >
                                            Done & Close
                                        </button>
                                    </div>
                                </div>
                            )}

                            {submitStatus === 'error' && (
                                <div className="flex items-center justify-between">
                                    <p className="text-red-600 font-medium flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        Failed to register employee.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {!submitStatus && (
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? 'Processing...' : editingId ? 'Update Record' : 'Create Employee'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="bg-transparent md:bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-100 overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block overflow-x-auto text-left">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            {isSelectionMode && <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedItems.size === employees.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>}
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors font-sans" onClick={() => requestSort('employeeId')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>ID</span>
                                                    <SortIcon config={sortConfig.employee} columnKey="employeeId" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors font-sans" onClick={() => requestSort('name')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Name</span>
                                                    <SortIcon config={sortConfig.employee} columnKey="name" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors font-sans" onClick={() => requestSort('department')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Department</span>
                                                    <SortIcon config={sortConfig.employee} columnKey="department" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors font-sans" onClick={() => requestSort('designation')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Designation</span>
                                                    <SortIcon config={sortConfig.employee} columnKey="designation" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors font-sans" onClick={() => requestSort('role')}>
                                                <div className="flex items-center space-x-1">
                                                    <span>Role</span>
                                                    <SortIcon config={sortConfig.employee} columnKey="role" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider font-sans">Phone</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors font-sans text-right" onClick={() => requestSort('salary')}>
                                                <div className="flex items-center justify-end space-x-1">
                                                    <span>Salary</span>
                                                    <SortIcon config={sortConfig.employee} columnKey="salary" />
                                                </div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center font-sans">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {getFilteredAndSortedData().map(e => (
                                            <tr
                                                key={e._id}
                                                onMouseDown={() => startLongPress(e._id)}
                                                onMouseUp={endLongPress}
                                                onClick={() => isSelectionMode && toggleSelection(e._id)}
                                                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                            >
                                                {isSelectionMode && <td className="px-6 py-4"><input type="checkbox" checked={selectedItems.has(e._id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>}
                                                <td className="px-6 py-4 text-sm text-gray-600 font-sans">{e.employeeId}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 font-sans">{e.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 font-sans">{e.department}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 font-sans">{e.designation}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 font-sans">
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase tracking-tight">
                                                        {e.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600 font-sans">{e.phone}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 font-sans text-right">{e.salary ? `${parseFloat(e.salary).toLocaleString('en-IN')} BDT` : '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button onClick={(event) => { event.stopPropagation(); setViewData(e); }} className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded transition-colors"><EyeIcon className="w-5 h-5" /></button>
                                                        {!cannotManage && (
                                                            <button onClick={(event) => { event.stopPropagation(); handleEdit(e); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                        )}
                                                        {!cannotDelete && (
                                                            <button onClick={(event) => { event.stopPropagation(); handleDelete(e._id); }} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Grid Layout */}
                            <div className="md:hidden space-y-4">
                                {getFilteredAndSortedData().map(e => (
                                    <div
                                        key={e._id}
                                        onMouseDown={() => startLongPress(e._id)}
                                        onMouseUp={endLongPress}
                                        onClick={() => isSelectionMode ? toggleSelection(e._id) : toggleCardExpansion(e._id)}
                                        className={`p-5 bg-white rounded-2xl border border-gray-100 shadow-sm transition-all relative overflow-hidden cursor-pointer ${selectedItems.has(e._id) ? 'ring-2 ring-blue-500 border-transparent bg-blue-50/30' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">
                                                    {e.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 text-sm">{e.name}</h4>
                                                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{e.employeeId}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={(event) => { event.stopPropagation(); setViewData(e); }} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors"><EyeIcon className="w-4 h-4" /></button>
                                                {!cannotManage && (
                                                    <button onClick={(event) => { event.stopPropagation(); handleEdit(e); }} className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                )}
                                                {!cannotDelete && (
                                                    <button onClick={(event) => { event.stopPropagation(); handleDelete(e._id); }} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`grid grid-cols-2 gap-y-3 gap-x-4 overflow-hidden transition-all duration-300 ${expandedCards.has(e._id) ? 'max-h-[500px] opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'}`}>
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Role</p>
                                                <p className="text-xs text-gray-700 font-medium">{e.role}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Dept</p>
                                                <p className="text-xs text-gray-700 font-medium">{e.department}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Designation</p>
                                                <p className="text-xs text-gray-700 font-medium">{e.designation}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Phone</p>
                                                <p className="text-xs text-gray-700 font-medium">{e.phone}</p>
                                            </div>
                                            <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-gray-50 mt-1">
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Status:</p>
                                                <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-tight ${e.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                                                    {e.status}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {viewData && typeof document !== 'undefined' && document.body && createPortal(
                <div className="profile-overlay">
                    <div
                        className="profile-backdrop"
                        onClick={() => {
                            setViewData(null);
                            setResetPasswordValue(null);
                            setShowConfirmReset(false);
                            setViewDrawerOpen(false);
                        }}
                    ></div>

                    {/* Main Portrait Card */}
                    <div className="profile-card-portrait">
                        {/* Portrait Photo or Studio Fallback */}
                        {viewData.profilePhoto ? (
                            <img
                                src={viewData.profilePhoto}
                                alt={viewData.name}
                                className="profile-portrait-bg"
                            />
                        ) : (
                            <div className="profile-portrait-fallback">
                                <div className="profile-fallback-avatar">
                                    <span>{viewData.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                                </div>
                            </div>
                        )}

                        {/* Dark Vignette Overlay */}
                        <div className="profile-portrait-vignette"></div>

                        {/* Top Bar: Left = Employee ID, Right = Role Tag */}
                        <div className="profile-top-bar">
                            <div className="profile-role-pill" title="Employee ID">
                                <UserIcon className="w-3.5 h-3.5 mr-1.5 text-white/90" />
                                <span>{viewData.employeeId}</span>
                            </div>
                            <div className="profile-role-pill" title="Role">
                                <ShieldIcon className="w-3.5 h-3.5 mr-1.5 text-white/90" />
                                <span>{viewData.role}</span>
                            </div>
                        </div>

                        {/* Bottom Info Content */}
                        <div className="profile-bottom-info">
                            {/* Name */}
                            <div className="profile-name-row">
                                <h2
                                    className="profile-name-text"
                                    style={{ fontSize: getNameFontSize(viewData.name) }}
                                    title={viewData.name}
                                >
                                    {viewData.name}
                                </h2>
                            </div>

                            {/* Designation */}
                            <p className="profile-card-designation">{viewData.designation || 'Staff Member'}</p>

                            {/* Department */}
                            {viewData.department && (
                                <p className="profile-card-dept">{viewData.department}</p>
                            )}

                            {/* Bottom Row: Contact Info on Left, Details Button on Right */}
                            <div className="profile-bottom-row">
                                <div className="profile-contact-list">
                                    <div className="profile-contact-row" title="Phone">
                                        <span className="profile-contact-icon">
                                            <PhoneIcon className="w-3.5 h-3.5 text-white/75" />
                                        </span>
                                        <span>{viewData.phone || 'N/A'}</span>
                                    </div>
                                    <div className="profile-contact-row" title="Email">
                                        <span className="profile-contact-icon">
                                            <MailIcon className="w-3.5 h-3.5 text-white/75" />
                                        </span>
                                        <span className="profile-contact-email">{viewData.email || 'N/A'}</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="profile-pill-btn"
                                    onClick={() => setViewDrawerOpen(true)}
                                >
                                    <span>Details</span>
                                    <span className="profile-pill-plus">+</span>
                                </button>
                            </div>
                        </div>

                        {/* ─── Slide-Up Details & Management Drawer ─────────── */}
                        <div className={`profile-drawer ${viewDrawerOpen ? 'profile-drawer--open' : ''}`}>
                            {/* Drawer handle */}
                            <div className="profile-drawer-handle-bar" onClick={() => setViewDrawerOpen(false)}>
                                <div className="profile-drawer-handle"></div>
                            </div>

                            {/* Drawer Header */}
                            <div className="profile-drawer-header">
                                <div>
                                    <h3 className="profile-drawer-title">Employee Details</h3>
                                    <p className="profile-drawer-subtitle">{viewData.name} &middot; {viewData.role}</p>
                                </div>
                                <button
                                    type="button"
                                    className="profile-drawer-close-btn"
                                    onClick={() => setViewDrawerOpen(false)}
                                    title="Back to Card"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Drawer Body */}
                            <div className="profile-drawer-body space-y-4">
                                {/* ERP Info Grid */}
                                <div className="profile-info-grid">
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Employee ID</span>
                                        <span className="profile-info-val">{viewData.employeeId}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Role</span>
                                        <span className="profile-info-val text-blue-400">{viewData.role}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Department</span>
                                        <span className="profile-info-val">{viewData.department}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Status</span>
                                        <span className={`profile-info-val ${viewData.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>{viewData.status}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Joined</span>
                                        <span className="profile-info-val">{formatDate(viewData.joiningDate)}</span>
                                    </div>
                                    <div className="profile-info-card">
                                        <span className="profile-info-label">Salary</span>
                                        <span className="profile-info-val">{viewData.salary ? `${parseFloat(viewData.salary).toLocaleString('en-IN')} BDT` : 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Photo Management (Admin or Incharge) */}
                                {!cannotManage && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-white/90 font-bold">Profile Photo</p>
                                                <p className="text-[10px] text-white/60">Upload or change employee portrait</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    ref={employeePhotoInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleEmployeePhotoUpload}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={isUploadingEmployeePhoto}
                                                    onClick={() => employeePhotoInputRef.current?.click()}
                                                    className="px-3 py-1.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-bold rounded-xl transition-colors border border-blue-500/30 flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <UploadIcon className="w-3.5 h-3.5" />
                                                    <span>{isUploadingEmployeePhoto ? 'Uploading...' : (viewData.profilePhoto ? 'Change Photo' : 'Upload Photo')}</span>
                                                </button>
                                                {viewData.profilePhoto && (
                                                    <button
                                                        type="button"
                                                        disabled={isUploadingEmployeePhoto}
                                                        onClick={handleRemoveEmployeePhoto}
                                                        className="p-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-xl transition-colors border border-rose-500/30 disabled:opacity-50"
                                                        title="Remove Photo"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Account Security: Reset Password */}
                                {(isAdmin || canSpecial) && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mt-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-white/90 font-bold">Account Security</p>
                                                <p className="text-[10px] text-white/60">Generate a new password for this employee.</p>
                                            </div>

                                            {resetPasswordValue ? (
                                                <div className="flex flex-col items-end">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-emerald-400">Password:</span>
                                                        <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-500/30 select-all">{resetPasswordValue}</span>
                                                    </div>
                                                    <span className="text-[9px] text-white/50 mt-1 italic text-right">Copy and share with employee</span>
                                                </div>
                                            ) : showConfirmReset ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setShowConfirmReset(false)}
                                                        disabled={resettingPassword}
                                                        className="px-2.5 py-1 text-white/70 hover:bg-white/10 text-xs font-semibold rounded-lg transition-colors border border-white/20"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleResetPassword(viewData._id)}
                                                        disabled={resettingPassword}
                                                        className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                                                    >
                                                        {resettingPassword ? 'Resetting...' : 'Confirm'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setShowConfirmReset(true)}
                                                    className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold rounded-xl transition-colors border border-rose-500/30"
                                                >
                                                    Reset Password
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Edit Action Button */}
                                {!cannotManage && (
                                    <button
                                        type="button"
                                        className="profile-submit-btn flex items-center justify-center gap-2 mt-3"
                                        onClick={() => {
                                            const dataToEdit = viewData;
                                            setViewData(null);
                                            setViewDrawerOpen(false);
                                            handleEdit(dataToEdit);
                                        }}
                                    >
                                        <EditIcon className="w-4 h-4" />
                                        <span>Edit Employee</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default EmployeeManagement;
