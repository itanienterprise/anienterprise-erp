import React, { useState, useEffect, useRef } from 'react';
import { EditIcon, TrashIcon, UsersIcon, XIcon, SearchIcon } from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import './Customer.css';

const Customer = ({
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        customerId: '',
        companyName: '',
        customerName: '',
        address: '',
        location: '',
        phone: '+88',
        customerType: 'General Customer',
        status: 'Active'
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedCustomers = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                });
                setCustomers(decryptedCustomers);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'phone') {
            // Enforce +88 prefix and 14 characters limit
            if (!value.startsWith('+88')) {
                return; // Prevent removing +88
            }
            if (value.length > 14) {
                return; // Limit to 14 characters
            }
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate phone number
        if (formData.phone.length !== 14) {
            alert('Phone number must be exactly 14 characters long (e.g., +8801700000000)');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId ? `${API_BASE_URL}/api/customers/${editingId}` : `${API_BASE_URL}/api/customers`;
            const encryptedPayload = { data: encryptData(formData) };
            const response = await fetch(url, {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload),
            });
            if (response.ok) {
                setSubmitStatus('success');
                fetchCustomers();
                setTimeout(() => {
                    setShowForm(false);
                    setEditingId(null);
                    resetForm();
                    setSubmitStatus(null);
                }, 2000);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving customer:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            customerId: '',
            companyName: '',
            customerName: '',
            address: '',
            location: '',
            phone: '+88',
            customerType: 'General Customer',
            status: 'Active'
        });
        setEditingId(null);
    };

    const handleEdit = (customer) => {
        setFormData({
            customerId: customer.customerId || '',
            companyName: customer.companyName || '',
            customerName: customer.customerName || '',
            address: customer.address || '',
            location: customer.location || '',
            phone: customer.phone || '+88',
            customerType: customer.customerType || 'General Customer',
            status: customer.status || 'Active'
        });
        setEditingId(customer._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'customer', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === customers.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(customers.map(c => c._id)));
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.customer?.key === key && sortConfig.customer?.direction === 'asc') direction = 'desc';
        setSortConfig({ ...sortConfig, customer: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.customer) return data;
        const { key, direction } = sortConfig.customer;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getFilteredAndSortedData = () => {
        let filtered = customers;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = customers.filter(c =>
                c.customerId?.toLowerCase().includes(query) ||
                c.companyName?.toLowerCase().includes(query) ||
                c.customerName?.toLowerCase().includes(query) ||
                c.location?.toLowerCase().includes(query) ||
                c.phone?.toLowerCase().includes(query)
            );
        }

        return sortData(filtered);
    };

    return (
        <div className="customer-container space-y-6">
            {!showForm && (
                <div className="flex items-center justify-between gap-4">
                    <div className="w-1/4">
                        <h2 className="text-2xl font-bold text-gray-800">Customer Management</h2>
                    </div>

                    <div className="flex-1 max-w-md mx-auto relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by ID, Company, Name, Location or Phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                        />
                    </div>

                    <div className="w-1/4 flex justify-end">
                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                        >
                            <span className="mr-2 text-xl">+</span> Add New
                        </button>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="customer-form-container">
                    <div className="customer-form-bg-orb customer-form-bg-orb-1"></div>
                    <div className="customer-form-bg-orb customer-form-bg-orb-2"></div>

                    <div className="customer-form-header">
                        <h3 className="customer-form-title">{editingId ? 'Edit Customer' : 'New Customer Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="customer-form-close">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">ID</label>
                            <input
                                type="text"
                                name="customerId"
                                value={formData.customerId}
                                onChange={handleInputChange}
                                required
                                placeholder="Customer ID"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Company Name</label>
                            <input
                                type="text"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleInputChange}
                                required
                                placeholder="Company Name"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Customer Name</label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleInputChange}
                                required
                                placeholder="Customer Name"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Location</label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleInputChange}
                                required
                                placeholder="Location"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Address</label>
                            <textarea
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                required
                                rows="2"
                                placeholder="Full Street Address"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm resize-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Phone Number</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                                placeholder="+880..."
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Customer Type</label>
                            <div className="relative">
                                <select
                                    name="customerType"
                                    value={formData.customerType}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm appearance-none pr-10 cursor-pointer"
                                >
                                    <option value="General Customer">General Customer</option>
                                    <option value="Party Customer">Party Customer</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <div className="relative">
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm appearance-none pr-10 cursor-pointer"
                                >
                                    <option>Active</option>
                                    <option>Inactive</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="col-span-1 md:col-span-2 customer-form-footer">
                            {submitStatus === 'success' && (
                                <p className="customer-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Customer saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="customer-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save customer.
                                </p>
                            )}
                            <div className="customer-form-spacer"></div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`customer-form-submit ${isSubmitting ? 'disabled' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        {isSelectionMode && <th className="px-6 py-4 w-10"><input type="checkbox" checked={selectedItems.size === customers.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>}
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('customerId')}>
                                            <div className="flex items-center space-x-1">
                                                <span>ID</span>
                                                <SortIcon config={sortConfig.customer} columnKey="customerId" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('companyName')}>
                                            <div className="flex items-center space-x-1">
                                                <span>Company</span>
                                                <SortIcon config={sortConfig.customer} columnKey="companyName" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('customerName')}>
                                            <div className="flex items-center space-x-1">
                                                <span>Customer</span>
                                                <SortIcon config={sortConfig.customer} columnKey="customerName" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {getFilteredAndSortedData().map(c => (
                                        <tr
                                            key={c._id}
                                            onMouseDown={() => startLongPress(c._id)}
                                            onMouseUp={endLongPress}
                                            onClick={() => isSelectionMode && toggleSelection(c._id)}
                                            className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                                        >
                                            {isSelectionMode && <td className="px-6 py-4"><input type="checkbox" checked={selectedItems.has(c._id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>}
                                            <td className="px-6 py-4 text-sm text-gray-600">{c.customerId}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{c.companyName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{c.customerName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{c.location}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{c.phone}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <span className={`customer-type-badge ${c.customerType === 'Party Customer' ? 'party' : 'general'}`}>
                                                    {c.customerType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600"><span className={`customer-status-badge ${c.status === 'Active' ? 'active' : 'inactive'}`}>{c.status}</span></td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="flex space-x-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"><EditIcon className="w-5 h-5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Customer;
