import React, { useState, useEffect, useMemo } from 'react';
import { EditIcon, TrashIcon, AnchorIcon, SearchIcon, XIcon } from '../../Icons';
import { API_BASE_URL, SortIcon } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Port.css';

const Port = ({
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
    const [ports, setPorts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        code: '',
        type: 'Seaport',
        status: 'Active'
    });

    useEffect(() => {
        fetchPorts();
    }, []);

    const fetchPorts = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ports`);
            setPorts(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching ports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId ? `${API_BASE_URL}/api/ports/${editingId}` : `${API_BASE_URL}/api/ports`;
            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }
            setSubmitStatus('success');
            fetchPorts();
            setTimeout(() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
                setSubmitStatus(null);
            }, 2000);
        } catch (error) {
            console.error('Error saving port:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', location: '', code: '', type: 'Seaport', status: 'Active' });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (port) => {
        setFormData({
            name: port.name || '',
            location: port.location || '',
            code: port.code || '',
            type: port.type || 'Seaport',
            status: port.status || 'Active'
        });
        setEditingId(port._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'port', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
        if (newSelected.size === 0) {
            setIsSelectionMode(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === ports.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(ports.map(p => p._id)));
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.port?.key === key && sortConfig.port?.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ ...sortConfig, port: { key, direction } });
    };

    const displayPorts = useMemo(() => {
        let filtered = ports.filter(port => 
            (port.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (port.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (port.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (port.type || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (!sortConfig.port) return filtered;
        const { key, direction } = sortConfig.port;
        return [...filtered].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [ports, searchQuery, sortConfig.port]);

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header section - centered on mobile */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">Port Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-5.5 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by port name, code, or location..."
                                autoComplete="off"
                                className="block w-full pl-10 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                <div className={`${showForm ? 'w-full md:w-auto flex justify-end' : 'w-full md:w-1/4 flex justify-end'} gap-3 z-50`}>
                    <button 
                        onClick={() => setShowForm(!showForm)}
                        className="w-full md:w-auto px-4 py-2.5 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center"
                    >
                        <span className="mr-2 text-xl font-bold">+</span>
                        <span>{showForm ? 'Cancel' : 'Add New Port'}</span>
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-lg md:text-xl font-semibold text-gray-800">{editingId ? 'Edit Port' : 'New Port Registration'}</h3>
                        </div>
                        <button 
                            onClick={() => { setShowForm(false); resetForm(); }}
                            className="p-1.5 md:p-2 hover:bg-gray-100/80 text-gray-400 hover:text-rose-500 rounded-xl transition-all"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Port Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Chittagong Port" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Port Code</label>
                            <input type="text" name="code" value={formData.code} onChange={handleInputChange} required placeholder="e.g., BDCGP" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Location</label>
                            <input type="text" name="location" value={formData.location} onChange={handleInputChange} required placeholder="City, Country" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Port Type</label>
                            <select name="type" value={formData.type} onChange={handleInputChange} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
                                <option>Seaport</option>
                                <option>Airport</option>
                                <option>Land Port</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all">
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 mt-4 border-t border-gray-100">
                            <div className="flex-1">
                                {submitStatus === 'success' && <p className="text-emerald-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">✓ Port saved successfully!</p>}
                                {submitStatus === 'error' && <p className="text-red-600 font-bold text-sm animate-in fade-in slide-in-from-left-4">✕ Failed to save port.</p>}
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 md:flex-none px-6 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className={`flex-1 md:flex-none px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isSubmitting ? 'Saving...' : editingId ? 'Update Port' : 'Register Port'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="space-y-4">
                    {/* Desktop Table - Hidden on Mobile */}
                    <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100" onClick={() => requestSort('name')}>Port Name</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100" onClick={() => requestSort('code')}>Code</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100" onClick={() => requestSort('location')}>Location</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100" onClick={() => requestSort('type')}>Type</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100" onClick={() => requestSort('status')}>Status</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan="6" className="px-6 py-4 animate-pulse bg-gray-100/50"></td></tr>)
                                    ) : displayPorts.map((port) => (
                                        <tr key={port._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-[13px] font-bold text-gray-700">{port.name}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{port.code}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{port.location}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium text-gray-600">{port.type}</td>
                                            <td className="px-6 py-4 text-[13px] font-medium">
                                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${port.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-600 border border-gray-100'}`}>{port.status}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button onClick={() => handleEdit(port)} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDelete(port._id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl"></div>)
                        ) : displayPorts.length > 0 ? (
                            displayPorts.map((port) => {
                                const isExpanded = expandedRowId === port._id;
                                return (
                                    <div 
                                        key={port._id} 
                                        onClick={() => setExpandedRowId(isExpanded ? null : port._id)}
                                        className={`bg-white rounded-2xl border ${isExpanded ? 'border-blue-100 ring-4 ring-blue-500/5 shadow-lg' : 'border-gray-100 shadow-sm'} p-5 transition-all duration-500 cursor-pointer overflow-hidden`}
                                    >
                                        <div className="flex justify-between items-center group">
                                            <div className="space-y-1">
                                                <h3 className={`text-base font-black transition-colors duration-300 ${isExpanded ? 'text-blue-600' : 'text-gray-800'}`}>{port.name}</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-2 ${port.status === 'Active' ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                                                    {port.status}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-gray-50/80 p-0.5 rounded-lg border border-gray-100 divide-x divide-gray-100">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(port); }} className="p-2 hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all"><EditIcon className="w-5 h-5" /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(port._id); }} className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-500 transition-all"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
                                                <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100/50">
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-[0.8]">
                                                            <div className="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">Code</div>
                                                            <div className="text-[13px] font-bold text-gray-800 uppercase">{port.code}</div>
                                                        </div>
                                                        <div className="flex-[1.2] border-l border-gray-200/50 pl-3">
                                                            <div className="text-[9px] font-bold text-gray-400 uppercase leading-none mb-1">Location</div>
                                                            <div className="text-[13px] font-bold text-gray-700 break-words leading-tight">{port.location}</div>
                                                        </div>
                                                        <div className="flex-[1.1] border-l border-gray-200/50 pl-3">
                                                            <div className="text-[9px] font-bold text-blue-400 uppercase leading-none mb-1">Type</div>
                                                            <div className="text-[13px] font-black text-blue-600">{port.type}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                                <AnchorIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-gray-500 font-medium text-sm">No ports found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Port;
