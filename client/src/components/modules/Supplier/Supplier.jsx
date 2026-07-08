import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, PlusIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import './Supplier.css';
import { hasPermission } from '../../../utils/permissionHelper';

const Supplier = ({
    exporters = [],
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
    currentUser
}) => {
    // Dynamic permissions check
    const canAdd = hasPermission(currentUser, 'importerExporter', 'add');
    const canEdit = hasPermission(currentUser, 'importerExporter', 'edit');
    const canDelete = hasPermission(currentUser, 'importerExporter', 'delete');
    const canManage = canAdd || canEdit;
    const cannotDelete = !canDelete;
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [exporterDropdownOpen, setExporterDropdownOpen] = useState(false);
    const [exporterSearchQuery, setExporterSearchQuery] = useState('');
    const [highlightedExporterIndex, setHighlightedExporterIndex] = useState(-1);
    const exporterDropdownRef = useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        exporter: '',
        address: '',
        contactPerson: '',
        email: '',
        phone: '',
        status: 'Active'
    });

    useEffect(() => { fetchSuppliers(); }, []);

    // Close exporter dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exporterDropdownRef.current && !exporterDropdownRef.current.contains(e.target)) {
                setExporterDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (viewData) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [viewData]);

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/suppliers`);
            setSuppliers(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleExporterKeyDown = (e) => {
        const filtered = exporters.filter(exp =>
            exp.name.toLowerCase().includes(exporterSearchQuery.toLowerCase())
        );
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedExporterIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedExporterIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedExporterIndex >= 0 && filtered[highlightedExporterIndex]) {
                const selected = filtered[highlightedExporterIndex];
                setFormData(prev => ({ ...prev, exporter: selected.name }));
                setExporterDropdownOpen(false);
                setExporterSearchQuery('');
                setHighlightedExporterIndex(-1);
            } else if (filtered.length === 1) {
                // Auto-select if only one result
                setFormData(prev => ({ ...prev, exporter: filtered[0].name }));
                setExporterDropdownOpen(false);
                setExporterSearchQuery('');
                setHighlightedExporterIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setExporterDropdownOpen(false);
            setHighlightedExporterIndex(-1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId
                ? `${API_BASE_URL}/api/suppliers/${editingId}`
                : `${API_BASE_URL}/api/suppliers`;
            if (editingId) await axios.put(url, formData);
            else await axios.post(url, formData);
            setSubmitStatus('success');
            fetchSuppliers();
            setTimeout(() => { setShowForm(false); setEditingId(null); resetForm(); setSubmitStatus(null); }, 2000);
        } catch (error) {
            console.error('Error saving supplier:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', exporter: '', address: '', contactPerson: '', email: '', phone: '', status: 'Active' });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (supplier) => {
        setFormData({
            name: supplier.name || '',
            exporter: supplier.exporter || '',
            address: supplier.address || '',
            contactPerson: supplier.contactPerson || '',
            email: supplier.email || '',
            phone: supplier.phone || '',
            status: supplier.status || 'Active'
        });
        setEditingId(supplier._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (cannotDelete) {
            alert('Forbidden: You do not have permission to delete suppliers');
            return;
        }
        onDeleteConfirm({ show: true, type: 'supplier', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === suppliers.length) { setSelectedItems(new Set()); setIsSelectionMode(false); }
        else setSelectedItems(new Set(suppliers.map(i => i._id)));
    };

    const requestSort = (key) => {
        const direction = (sortConfig.supplier?.key === key && sortConfig.supplier?.direction === 'asc') ? 'desc' : 'asc';
        setSortConfig({ ...sortConfig, supplier: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.supplier) return data;
        const { key, direction } = sortConfig.supplier;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    return (
        <div className="supplier-container">
            <div className="supplier-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-1/4 text-center md:text-left">
                    <h2 className="supplier-title" style={{margin:0}}>Supplier Management</h2>
                </div>
                
                <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                    <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search suppliers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10 block w-full pl-10 pr-4 bg-white/50 border border-gray-200 rounded-xl text-sm text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none shadow-sm"
                    />
                </div>

                {canAdd && (
                    <div className="w-full md:w-1/4 flex justify-end z-10">
                        <button onClick={() => setShowForm(!showForm)} className="h-10 border border-transparent w-full md:w-auto px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center justify-center text-sm whitespace-nowrap">
                            <span className="mr-2 text-xl font-bold">+</span> Add New
                        </button>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="supplier-form-container">
                    <div className="supplier-form-header">
                        <h3 className="supplier-form-title">{editingId ? 'Edit Supplier' : 'New Supplier Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="supplier-form-close">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                    <form 
                        onSubmit={handleSubmit} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="supplier-form"
                    >
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Supplier Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Full Name" className="supplier-form-input" />
                        </div>
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Exporter</label>
                            <div ref={exporterDropdownRef} className="relative">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search Exporter..."
                                        value={exporterDropdownOpen ? exporterSearchQuery : (formData.exporter || '')}
                                        onChange={(e) => {
                                            setExporterSearchQuery(e.target.value);
                                            setHighlightedExporterIndex(-1);
                                            if (!exporterDropdownOpen) setExporterDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setExporterDropdownOpen(true);
                                            setExporterSearchQuery('');
                                            setHighlightedExporterIndex(-1);
                                        }}
                                        onKeyDown={handleExporterKeyDown}
                                        autoComplete="off"
                                        required={!formData.exporter}
                                        className="supplier-form-input pr-10"
                                    />
                                    <SearchIcon className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${exporterDropdownOpen ? 'text-blue-500' : 'text-gray-400'}`} />
                                </div>
                                {exporterDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {exporters.filter(exp => exp.name.toLowerCase().includes(exporterSearchQuery.toLowerCase())).length > 0 ? (
                                            exporters.filter(exp => exp.name.toLowerCase().includes(exporterSearchQuery.toLowerCase())).map((exp, idx) => (
                                                <button
                                                    key={exp._id}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedExporterIndex(idx)}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, exporter: exp.name }));
                                                        setExporterDropdownOpen(false);
                                                        setExporterSearchQuery('');
                                                        setHighlightedExporterIndex(-1);
                                                    }}
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${
                                                        highlightedExporterIndex === idx
                                                            ? 'bg-blue-50'
                                                            : formData.exporter === exp.name
                                                            ? 'bg-blue-50/60'
                                                            : 'hover:bg-blue-50'
                                                    }`}
                                                >
                                                    <div className="font-bold text-blue-600 group-hover:text-blue-700">{exp.name}</div>
                                                    {exp.exporterId && <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">{exp.exporterId}</div>}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No exporter found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="supplier-form-field supplier-form-field-full">
                            <label className="supplier-form-label">Address</label>
                            <textarea name="address" value={formData.address} onChange={handleInputChange} required placeholder="Full Address" rows="2" className="supplier-form-textarea" />
                        </div>
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Contact Person</label>
                            <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required placeholder="Contact Name" className="supplier-form-input" />
                        </div>
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" className="supplier-form-input" />
                        </div>
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Phone number" className="supplier-form-input" />
                        </div>
                        <div className="supplier-form-field">
                            <label className="supplier-form-label">Status</label>
                            <div className="relative">
                                <select name="status" value={formData.status} onChange={handleInputChange} className="supplier-form-select appearance-none pr-9 cursor-pointer">
                                    <option>Active</option>
                                    <option>Inactive</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="supplier-form-footer">
                            {submitStatus === 'success' && (
                                <p className="supplier-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Supplier saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="supplier-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save supplier.
                                </p>
                            )}
                            <div className="supplier-form-spacer"></div>
                            <button type="submit" disabled={isSubmitting} className={`supplier-form-submit ${isSubmitting ? 'disabled' : ''}`}>
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (() => {
                const filteredSuppliers = suppliers.filter(supplier => 
                    (supplier.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (supplier.bin || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (supplier.tin || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (supplier.irc || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (supplier.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (supplier.contactPerson || '').toLowerCase().includes(searchQuery.toLowerCase())
                );

                const sortedSuppliers = sortData(filteredSuppliers);

                return (
                <div className="supplier-table-container">
                    {selectedItems.size > 0 && (
                        <div className="supplier-selection-bar">
                            <span className="supplier-selection-count">{selectedItems.size} items selected</span>
                            <div className="supplier-selection-actions">
                                <button onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} className="supplier-selection-cancel">Cancel</button>
                                <button 
                                    onClick={() => {
                                        if (cannotDelete) {
                                            alert('Forbidden: You do not have permission to delete suppliers');
                                            return;
                                        }
                                        onDeleteConfirm({ show: true, type: 'supplier', id: Array.from(selectedItems), isBulk: true });
                                    }}
                                    className="supplier-selection-delete"
                                >
                                    <TrashIcon className="w-3.5 h-3.5 mr-1.5" />
                                    Delete Selected
                                </button>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="supplier-loading">
                            <div className="supplier-spinner"></div>
                        </div>
                    ) : sortedSuppliers.length > 0 ? (
                        <>
                            {/* Desktop View */}
                            <div className="supplier-table-wrapper hidden md:block">
                                <table className="supplier-table">
                                    <thead>
                                        <tr className="supplier-table-header-row">
                                            {isSelectionMode && (
                                            <th className="supplier-table-checkbox-header">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedItems.size === sortedSuppliers.length && sortedSuppliers.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="supplier-checkbox"
                                                />
                                            </th>
                                            )}
                                            <th onClick={() => requestSort('name')} className="supplier-table-header">
                                                <div className="supplier-table-header-content">
                                                    Name
                                                    <SortIcon config={sortConfig} columnKey="supplier" targetKey="name" />
                                                </div>
                                            </th>
                                            <th onClick={() => requestSort('contactPerson')} className="supplier-table-header">
                                                <div className="supplier-table-header-content">
                                                    Contact Person
                                                    <SortIcon config={sortConfig} columnKey="supplier" targetKey="contactPerson" />
                                                </div>
                                            </th>
                                            <th className="supplier-table-header">Phone</th>
                                            <th className="supplier-table-header">Export With</th>
                                            <th onClick={() => requestSort('status')} className="supplier-table-header">
                                                <div className="supplier-table-header-content">
                                                    Status
                                                    <SortIcon config={sortConfig} columnKey="supplier" targetKey="status" />
                                                </div>
                                            </th>
                                            <th className="supplier-table-header text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="supplier-table-body">
                                        {sortedSuppliers.map((supplier) => {
                                            const isSelected = selectedItems.has(supplier._id);
                                            return (
                                                <tr 
                                                    key={supplier._id}
                                                    className={`supplier-table-row ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        if (isSelectionMode) {
                                                            toggleSelection(supplier._id);
                                                        }
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setIsSelectionMode(true);
                                                        toggleSelection(supplier._id);
                                                    }}
                                                >
                                                    {isSelectionMode && (
                                                    <td className="supplier-table-cell" onClick={(e) => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                if (!isSelectionMode) setIsSelectionMode(true);
                                                                toggleSelection(supplier._id);
                                                            }}
                                                            className="supplier-checkbox"
                                                        />
                                                    </td>
                                                    )}
                                                    <td className="supplier-table-cell supplier-table-cell-name">{supplier.name}</td>
                                                    <td className="supplier-table-cell">{supplier.contactPerson}</td>
                                                    <td className="supplier-table-cell">{supplier.phone}</td>
                                                    <td className="supplier-table-cell">{supplier.exporter || '—'}</td>
                                                    <td className="supplier-table-cell">
                                                        <span className={`supplier-status-badge ${supplier.status === 'Active' ? 'active' : 'inactive'}`}>
                                                            {supplier.status}
                                                        </span>
                                                    </td>
                                                    <td className="supplier-table-cell text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="supplier-table-actions justify-end">
                                                            <button onClick={() => setViewData(supplier)} className="supplier-action-btn" title="View details">
                                                                <EyeIcon className="w-5 h-5 text-gray-500 hover:text-blue-600 transition-colors" />
                                                            </button>
                                                            {canManage && (
                                                                <button onClick={() => handleEdit(supplier)} className="supplier-action-btn supplier-action-edit" title="Edit">
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button onClick={() => handleDelete(supplier._id)} className="supplier-action-btn supplier-action-delete" title="Delete">
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View */}
                            <div className="block md:hidden space-y-4 px-2">
                                {sortedSuppliers.map((supplier) => {
                                    const isSelected = selectedItems.has(supplier._id);
                                    return (
                                        <div 
                                            key={supplier._id}
                                            className={`supplier-mobile-card ${isSelected ? 'selected' : ''}`}
                                            onClick={() => {
                                                if (isSelectionMode) {
                                                    toggleSelection(supplier._id);
                                                } else {
                                                    setViewData(supplier);
                                                }
                                            }}
                                            onTouchStart={(e) => startLongPress(() => {
                                                setIsSelectionMode(true);
                                                toggleSelection(supplier._id);
                                            }, e)}
                                            onTouchEnd={endLongPress}
                                            onTouchMove={endLongPress}
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-gray-900 truncate text-left">{supplier.name}</h4>
                                                    <p className="text-xs text-gray-500 mt-1 text-left">Contact: {supplier.contactPerson}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5 text-left">Phone: {supplier.phone}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5 text-left">Exporter: {supplier.exporter || '—'}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-2.5 shrink-0">
                                                    <span className={`supplier-status-badge ${supplier.status === 'Active' ? 'active' : 'inactive'}`}>
                                                        {supplier.status}
                                                    </span>
                                                    {!isSelectionMode && (
                                                        <div className="flex items-center gap-2">
                                                            {canManage && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(supplier); }} 
                                                                    className="p-1.5 bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200"
                                                                >
                                                                    <EditIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(supplier._id); }} 
                                                                    className="p-1.5 bg-red-50 rounded-lg text-red-600 active:bg-red-100"
                                                                >
                                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="supplier-empty">
                            <div className="supplier-empty-icon-wrapper">
                                <UserIcon className="supplier-empty-icon" />
                            </div>
                            <h3 className="supplier-empty-title">No Suppliers Found</h3>
                            <p className="supplier-empty-subtitle">{searchQuery ? 'Try adjusting your search query' : 'Register a new supplier to get started'}</p>
                        </div>
                    )}
                </div>
                );
            })()}

            {/* Supplier Details Modal */}
            {viewData && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white font-bold text-lg">Supplier Profile</h3>
                            <button 
                                onClick={() => setViewData(null)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-left">
                            <div>
                                <h4 className="text-xl font-bold text-gray-900">{viewData.name}</h4>
                                <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${viewData.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {viewData.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">

                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase">Exporter</span>
                                    <p className="font-semibold text-gray-800 mt-0.5">{viewData.exporter || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase">Phone</span>
                                    <p className="font-semibold text-gray-800 mt-0.5">{viewData.phone || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Email</span>
                                    <p className="font-semibold text-gray-800 mt-0.5">{viewData.email || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Contact Person</span>
                                    <p className="font-semibold text-gray-800 mt-0.5">{viewData.contactPerson || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Address</span>
                                    <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{viewData.address || '-'}</p>
                                </div>
                            </div>


                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end">
                            <button 
                                onClick={() => setViewData(null)}
                                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-sm"
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Supplier;
