import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, UserIcon, XIcon, SearchIcon, FunnelIcon, ChevronDownIcon, EyeIcon, ShieldIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
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
    endLongPress,
    isLongPressTriggered
}) => {
    const [showForm, setShowForm] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState(null);
    const [generatedId, setGeneratedId] = useState(null);
    const [filters, setFilters] = useState({ status: 'All Status' });
    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewData, setViewData] = useState(null);
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [openDropdown, setOpenDropdown] = useState(null);
    const roleDropdownRef = useRef(null);
    const statusDropdownRef = useRef(null);

    const toggleCardExpansion = (id) => {
        const newExpanded = new Set(expandedCards);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedCards(newExpanded);
    };

    const [formData, setFormData] = useState({
        employeeId: '',
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

    useEffect(() => {
        fetchEmployees();
    }, []);

    // Close custom dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
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
            const response = await fetch(`${API_BASE_URL}/api/employees`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedEmployees = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                });
                setEmployees(decryptedEmployees);
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
            let value = e.target.value;
            if (!value.startsWith('+880')) {
                value = '+880' + value.replace(/^\+880?/, '');
            }
            if (value.length <= 14) {
                setFormData(prev => ({ ...prev, [name]: value }));
            }
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.phone.length !== 14) {
            alert('Phone number must be exactly 14 characters long (e.g., +8801700000000)');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId ? `${API_BASE_URL}/api/employees/${editingId}` : `${API_BASE_URL}/api/employees`;
            const encryptedPayload = { data: encryptData(formData) };
            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload),
            });
            if (response.ok) {
                const result = await response.json();
                if (result.plainPassword) {
                    setGeneratedPassword(result.plainPassword);
                }
                if (result.data) {
                    try {
                        const dec = decryptData(result.data);
                        if (dec.employeeId) setGeneratedId(dec.employeeId);
                    } catch (e) { }
                }
                setSubmitStatus('success');
                fetchEmployees();
                // Removed the setTimeout that closes the form and resets status
                // to allow the user to see the credentials card.
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving employee:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
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
        setFormData({
            employeeId: employee.employeeId || '',
            name: employee.name || '',
            designation: employee.designation || '',
            department: employee.department || '',
            phone: (employee.phone && employee.phone.startsWith('+880')) ? employee.phone : '+880',
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
        onDeleteConfirm({ show: true, type: 'employees', id, isBulk: false });
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
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
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

                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="flex-1 md:flex-none justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                        >
                            <span className="mr-2 text-xl">+</span> Add New
                        </button>
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
                    <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 text-left">
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
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-sans">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                                placeholder="John Doe"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
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
                                    onClick={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')}
                                    className="w-full px-4 py-2 pr-10 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-gray-800 text-left flex items-center justify-between"
                                >
                                    <span>{formData.role}</span>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${openDropdown === 'role' ? 'rotate-180' : ''}`} />
                                </button>
                                {openDropdown === 'role' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {['Admin', 'Incharge', 'LC Manager', 'Sales Manager', 'Accounts Manager', 'Border Manager', 'Data Entry', 'General Staff'].map(opt => (
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
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900 font-sans text-right">{e.salary ? `${parseFloat(e.salary).toLocaleString()} BDT` : '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button onClick={(event) => { event.stopPropagation(); setViewData(e); }} className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded transition-colors"><EyeIcon className="w-5 h-5" /></button>
                                                        <button onClick={(event) => { event.stopPropagation(); handleEdit(e); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                        <button onClick={(event) => { event.stopPropagation(); handleDelete(e._id); }} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
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
                                                <button onClick={(event) => { event.stopPropagation(); handleEdit(e); }} className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                <button onClick={(event) => { event.stopPropagation(); handleDelete(e._id); }} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-xl transition-colors"><TrashIcon className="w-4 h-4" /></button>
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

            {viewData && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewData(null)}></div>
                    <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-lg w-full p-8 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 font-sans">{viewData.name}</h2>
                                <p className="text-blue-600 font-semibold font-sans">{viewData.designation}</p>
                            </div>
                            <button onClick={() => setViewData(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <XIcon className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4 font-sans text-left">
                            <div className="grid grid-cols-2 gap-4 border-b border-gray-50 pb-4">
                                <div><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Employee ID</p><p className="text-sm text-gray-700">{viewData.employeeId}</p></div>
                                <div><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Role</p><p className="text-sm text-blue-600 font-bold">{viewData.role}</p></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-b border-gray-50 pb-4">
                                <div><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Department</p><p className="text-sm text-gray-700">{viewData.department}</p></div>
                                <div><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Status</p><p className="text-sm text-gray-700">{viewData.status}</p></div>
                            </div>
                            <div className="border-b border-gray-50 pb-4">
                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Email</p>
                                <p className="text-sm text-gray-700">{viewData.email || 'N/A'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pb-2">
                                <div><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Joining Date</p><p className="text-sm text-gray-700">{formatDate(viewData.joiningDate)}</p></div>
                                <div><p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Salary</p><p className="text-sm text-gray-700">{viewData.salary ? `${viewData.salary} BDT` : 'N/A'}</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeManagement;
