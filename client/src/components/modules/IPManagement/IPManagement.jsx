import React, { useState, useEffect, useRef } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, BoxIcon
} from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './IPManagement.css';

function IPManagement({
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
    isLongPressTriggered,
    importers,
    ports
}) {
    const [showIpForm, setShowIpForm] = useState(false);
    const [ipRecords, setIpRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const [formData, setFormData] = useState({
        openingDate: '',
        closeDate: '',
        ipNumber: '',
        referenceNo: '',
        ipParty: '',
        productName: '',
        quantity: '',
        port: '',
        status: 'Active'
    });

    const [filters, setFilters] = useState({
        quickRange: 'all',
        startDate: '',
        endDate: '',
        port: '',
        importer: ''
    });

    const ipImporterRef = useRef(null);
    const ipPortRef = useRef(null);
    const filterPortRef = useRef(null);
    const filterImporterRef = useRef(null);

    useEffect(() => {
        fetchIpRecords();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ipImporterRef.current && !ipImporterRef.current.contains(event.target) &&
                ipPortRef.current && !ipPortRef.current.contains(event.target) &&
                filterPortRef.current && !filterPortRef.current.contains(event.target) &&
                filterImporterRef.current && !filterImporterRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchIpRecords = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/ip-records`);
            if (response.ok) {
                const rawData = await response.json();
                const decryptedRecords = rawData.map(record => {
                    const decrypted = decryptData(record.data);
                    return { ...decrypted, _id: record._id, createdAt: record.createdAt };
                });
                setIpRecords(decryptedRecords);
            }
        } catch (error) {
            console.error('Error fetching IP records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto matich add 4 mont from opending date
            if (name === 'openingDate' && value) {
                const openDate = new Date(value);
                if (!isNaN(openDate.getTime())) {
                    const closeDate = new Date(openDate);
                    closeDate.setMonth(closeDate.getMonth() + 4);
                    newData.closeDate = closeDate.toISOString().split('T')[0];
                }
            }

            return newData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const encryptedPayload = { data: encryptData(formData) };
            const url = editingId
                ? `${API_BASE_URL}/api/ip-records/${editingId}`
                : `${API_BASE_URL}/api/ip-records`;
            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encryptedPayload)
            });

            if (response.ok) {
                setSubmitStatus('success');
                setTimeout(() => {
                    setShowIpForm(false);
                    resetIpForm();
                    fetchIpRecords();
                }, 1500);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Error saving IP record:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetIpForm = () => {
        setFormData({
            openingDate: '',
            closeDate: '',
            ipNumber: '',
            referenceNo: '',
            ipParty: '',
            productName: '',
            quantity: '',
            port: '',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (record) => {
        setFormData({
            openingDate: record.openingDate || '',
            closeDate: record.closeDate || '',
            ipNumber: record.ipNumber || '',
            referenceNo: record.referenceNo || '',
            ipParty: record.ipParty || '',
            productName: record.productName || '',
            quantity: record.quantity || '',
            port: record.port || '',
            status: record.status || 'Active'
        });
        setEditingId(record._id);
        setShowIpForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'ip', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = (records) => {
        if (selectedItems.size === records.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(records.map(r => r._id)));
            setIsSelectionMode(true);
        }
    };

    const requestSort = (key) => {
        setSortConfig(prev => ({
            ...prev,
            ip: {
                key,
                direction: prev.ip?.key === key && prev.ip?.direction === 'asc' ? 'desc' : 'asc'
            }
        }));
    };

    const sortData = (data) => {
        if (!sortConfig.ip?.key) return data;
        return [...data].sort((a, b) => {
            const aVal = a[sortConfig.ip.key];
            const bVal = b[sortConfig.ip.key];
            if (aVal < bVal) return sortConfig.ip.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.ip.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleIpDropdownSelect = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setActiveDropdown(null);
    };

    const handleFilterDropdownSelect = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setActiveDropdown(null);
    };

    const getFilteredOptions = (dropdownType) => {
        if (dropdownType === 'ipImporter' || dropdownType === 'filterImporter') {
            const searchTerm = dropdownType === 'ipImporter' ? formData.ipParty : filters.importer;
            return importers.filter(imp =>
                imp.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (dropdownType === 'ipPort' || dropdownType === 'filterPort') {
            const searchTerm = dropdownType === 'ipPort' ? formData.port : filters.port;
            return ports.filter(port =>
                port.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return [];
    };

    const handleDropdownKeyDown = (e, dropdownType, selectHandler, field) => {
        const options = getFilteredOptions(dropdownType);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && options[highlightedIndex]) {
            e.preventDefault();
            selectHandler(field, options[highlightedIndex].name);
        }
    };

    const resetFilters = () => {
        setFilters({
            quickRange: 'all',
            startDate: '',
            endDate: '',
            port: '',
            importer: ''
        });
    };

    const filteredIpRecords = ipRecords.filter(record => {
        // Apply filters
        if (filters.port && record.port !== filters.port) return false;
        if (filters.importer && record.ipParty !== filters.importer) return false;

        // Date filtering
        if (filters.startDate || filters.endDate) {
            const recordDate = new Date(record.openingDate);
            if (filters.startDate && recordDate < new Date(filters.startDate)) return false;
            if (filters.endDate && recordDate > new Date(filters.endDate)) return false;
        }

        // Quick range filtering
        if (filters.quickRange !== 'all' && filters.quickRange !== 'custom') {
            const now = new Date();
            const recordDate = new Date(record.openingDate);
            if (filters.quickRange === 'weekly' && (now - recordDate) > 7 * 24 * 60 * 60 * 1000) return false;
            if (filters.quickRange === 'monthly' && (now - recordDate) > 30 * 24 * 60 * 60 * 1000) return false;
            if (filters.quickRange === 'yearly' && (now - recordDate) > 365 * 24 * 60 * 60 * 1000) return false;
        }

        return true;
    });

    return (
        <div className="ip-management space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">IP Management</h2>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 ${showFilters ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border border-gray-200'} font-medium rounded-lg shadow-sm transition-all flex items-center hover:bg-gray-50 border`}
                    >
                        <FunnelIcon className="w-4 h-4 mr-2" /> {showFilters ? 'Hide Filters' : 'Filter'}
                    </button>
                    <button
                        onClick={() => setShowIpForm(!showIpForm)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center"
                    >
                        <span className="mr-2 text-xl">+</span> Add New
                    </button>
                </div>
            </div>

            {/* Filters Section - Truncated for brevity, keeping the structure */}
            {showFilters && (
                <div className="ip-filters relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all duration-300 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                        {/* Quick Range */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Quick Range</label>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filters.quickRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {range.charAt(0).toUpperCase() + range.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Date Range</label>
                            <div className="flex items-center space-x-2">
                                <div className="flex-1 min-w-0">
                                    <CustomDatePicker
                                        value={filters.startDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                                        name="startDate"
                                        placeholder="From"
                                        compact={true}
                                    />
                                </div>
                                <span className="text-gray-400">to</span>
                                <div className="flex-1 min-w-0">
                                    <CustomDatePicker
                                        value={filters.endDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                                        name="endDate"
                                        placeholder="To"
                                        compact={true}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Port Filter - Simplified */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Port</label>
                            <select
                                value={filters.port}
                                onChange={(e) => setFilters(prev => ({ ...prev, port: e.target.value }))}
                                className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="">All Ports</option>
                                {ports.map(port => (
                                    <option key={port._id} value={port.name}>{port.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Importer Filter - Simplified */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Importer</label>
                            <select
                                value={filters.importer}
                                onChange={(e) => setFilters(prev => ({ ...prev, importer: e.target.value }))}
                                className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="">All Importers</option>
                                {importers.map(imp => (
                                    <option key={imp._id} value={imp.name}>{imp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                        <button
                            onClick={resetFilters}
                            className="flex items-center text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                        >
                            <XIcon className="w-3 h-3 mr-1" /> Clear Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Form Section - Continuing in next message due to length */}
            {showIpForm && (
                <div className="ip-form relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit IP Record' : 'New IP Insertion'}</h3>
                        <button onClick={() => { setShowIpForm(false); resetIpForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <CustomDatePicker
                            label="Opening Date"
                            name="openingDate"
                            value={formData.openingDate}
                            onChange={handleInputChange}
                            required
                            compact={true}
                        />

                        <CustomDatePicker
                            label="Close Date"
                            name="closeDate"
                            value={formData.closeDate}
                            onChange={handleInputChange}
                            compact={true}
                            rightAlign={true}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">IP Number</label>
                            <input
                                type="text"
                                name="ipNumber"
                                value={formData.ipNumber}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter IP Number"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Reference No</label>
                            <input
                                type="text"
                                name="referenceNo"
                                value={formData.referenceNo}
                                onChange={handleInputChange}
                                required
                                placeholder="REF-12345"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Importer</label>
                            <select
                                name="ipParty"
                                value={formData.ipParty}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            >
                                <option value="">Select Importer</option>
                                {importers.map(imp => (
                                    <option key={imp._id} value={imp.name}>{imp.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                            <input
                                type="text"
                                name="productName"
                                value={formData.productName}
                                onChange={handleInputChange}
                                required
                                placeholder="Product Name"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Quantity (kg)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-400 text-sm">kg</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Port</label>
                            <select
                                name="port"
                                value={formData.port}
                                onChange={handleInputChange}
                                required
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            >
                                <option value="">Select Port</option>
                                {ports.map(port => (
                                    <option key={port._id} value={port.name}>{port.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            >
                                <option>Active</option>
                                <option>Closed</option>
                                <option>Pending</option>
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                            {submitStatus === 'success' && (
                                <p className="text-green-600 font-medium flex items-center animate-bounce">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Record saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="text-red-600 font-medium flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save record.
                                </p>
                            )}
                            <div className="flex-1"></div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : 'Save IP Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table Section */}
            {!showIpForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {selectedItems.size > 0 && (
                        <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700">{selectedItems.size} items selected</span>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                                    className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => onDeleteConfirm({ show: true, type: 'ip', id: null, isBulk: true })}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
                                >
                                    <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredIpRecords.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr
                                        className="bg-gray-50 border-b border-gray-100 select-none cursor-pointer"
                                        onMouseDown={() => startLongPress(null)}
                                        onMouseUp={endLongPress}
                                        onMouseLeave={endLongPress}
                                        onTouchStart={() => startLongPress(null)}
                                        onTouchEnd={endLongPress}
                                    >
                                        {isSelectionMode && (
                                            <th className="px-6 py-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === filteredIpRecords.length && filteredIpRecords.length > 0}
                                                    onChange={() => toggleSelectAll(filteredIpRecords)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('openingDate')}>
                                            <div className="flex items-center">Opening Date <SortIcon config={sortConfig.ip} columnKey="openingDate" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ipNumber')}>
                                            <div className="flex items-center">IP Number <SortIcon config={sortConfig.ip} columnKey="ipNumber" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ipParty')}>
                                            <div className="flex items-center">Importer <SortIcon config={sortConfig.ip} columnKey="ipParty" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('productName')}>
                                            <div className="flex items-center">Product <SortIcon config={sortConfig.ip} columnKey="productName" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('quantity')}>
                                            <div className="flex items-center">Quantity (kg) <SortIcon config={sortConfig.ip} columnKey="quantity" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('status')}>
                                            <div className="flex items-center">Status <SortIcon config={sortConfig.ip} columnKey="status" /></div>
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortData(filteredIpRecords).map((record) => (
                                        <tr
                                            key={record._id}
                                            className={`${selectedItems.has(record._id) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                                            onMouseDown={() => startLongPress(record._id)}
                                            onMouseUp={endLongPress}
                                            onMouseLeave={endLongPress}
                                            onTouchStart={() => startLongPress(record._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) toggleSelection(record._id);
                                            }}
                                        >
                                            {isSelectionMode && (
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(record._id)}
                                                        onChange={(e) => { e.stopPropagation(); toggleSelection(record._id); }}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-sm text-gray-600">{formatDate(record.openingDate)}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-blue-600">{record.ipNumber}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900">{record.ipParty}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{record.productName}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.quantity} kg</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-100' :
                                                    record.status === 'Closed' ? 'bg-gray-50 text-gray-700 border border-gray-100' :
                                                        'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                                    }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(record); }} className="text-gray-400 hover:text-blue-600 transition-colors">
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(record._id); }} className="text-gray-400 hover:text-red-600 transition-colors">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12">
                            <div className="p-4 bg-gray-50 rounded-full mb-4">
                                <BoxIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">No IP records found</p>
                            <p className="text-sm text-gray-400 mt-1">Click "Add New" to create a new entry</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default IPManagement;
