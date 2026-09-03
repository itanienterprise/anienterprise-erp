import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon, FunnelIcon, PrinterIcon, FileTextIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { decryptData } from '../../../utils/encryption';
import { generateSupplierProfileReportPDF } from '../../../utils/pdfGenerator';
import { generateSupplierProfileReportExcel } from '../../../utils/excelGenerator';
import ReportFormatModal from '../../shared/ReportFormatModal';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './Supplier.css';
import { hasPermission } from '../../../utils/permissionHelper';
const SearchableFilterSelect = ({ label, value, onChange, options = [], placeholder = 'Search...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    const filteredOptions = options.filter(opt =>
        String(opt || '').toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setHighlightedIndex(0);
    }, [search, isOpen]);

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredOptions.length > 0) {
                const selected = filteredOptions[highlightedIndex] !== undefined ? filteredOptions[highlightedIndex] : filteredOptions[0];
                onChange(selected);
                setIsOpen(false);
                setSearch('');
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
        }
    };

    return (
        <div className="space-y-1 relative" ref={dropdownRef}>
            {label && <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{label}</label>}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? search : (value || '')}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        setSearch('');
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={value || placeholder}
                    className={`w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none transition-all pr-8 ${
                        value && !isOpen ? 'font-semibold text-gray-900 bg-blue-50/40 border-blue-200' : 'text-gray-700 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                                setSearch('');
                            }}
                            className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-[5300] max-h-44 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-150">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => {
                            const isSelected = value === opt;
                            const isHighlighted = highlightedIndex === idx;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                                        isSelected
                                            ? 'bg-blue-50 text-blue-700 font-bold'
                                            : isHighlighted
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="truncate">{opt}</span>
                                    {isSelected && <span className="text-blue-600 text-xs font-bold ml-2">✓</span>}
                                </button>
                            );
                        })
                    ) : (
                        <div className="px-3 py-3 text-center text-gray-400 text-xs">
                            No options found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

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
    const [historyRecords, setHistoryRecords] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historySortConfig, setHistorySortConfig] = useState({ key: 'date', direction: 'desc' });
    const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        quickRange: 'all',
        startDate: '',
        endDate: '',
        product: '',
        brand: '',
        lcNo: ''
    });
    const historyFilterPanelRef = useRef(null);
    const historyFilterButtonRef = useRef(null);
    const [showReportFormatModal, setShowReportFormatModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [exporterDropdownOpen, setExporterDropdownOpen] = useState(false);
    const [exporterSearchQuery, setExporterSearchQuery] = useState('');
    const [highlightedExporterIndex, setHighlightedExporterIndex] = useState(-1);
    const exporterDropdownRef = useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        exporter: '',
        exporters: [],
        address: '',
        contactPerson: '',
        email: '',
        phone: '',
        status: 'Active'
    });

    useEffect(() => { fetchSuppliers(); }, []);

    useEffect(() => {
        if (viewData && viewData.name) {
            fetchSupplierHistory(viewData.name);
        } else {
            setHistoryRecords([]);
            setHistorySearchQuery('');
            setExpandedHistoryIdx(null);
            setShowHistoryFilterPanel(false);
            setShowReportFormatModal(false);
            setHistoryFilters({
                quickRange: 'all',
                startDate: '',
                endDate: '',
                product: '',
                brand: '',
                lcNo: ''
            });
        }
    }, [viewData]);

    // Close history filter panel on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                showHistoryFilterPanel &&
                historyFilterPanelRef.current &&
                !historyFilterPanelRef.current.contains(e.target) &&
                !historyFilterButtonRef.current?.contains(e.target)
            ) {
                setShowHistoryFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHistoryFilterPanel]);

    const availableProducts = [...new Set(historyRecords.map(r => r.product).filter(Boolean))].sort();
    const availableBrands = [...new Set(historyRecords.map(r => r.brand).filter(Boolean))].sort();
    const availableLcs = [...new Set(historyRecords.map(r => r.lcNo).filter(Boolean))].sort();

    const isFilterActive = 
        historyFilters.quickRange !== 'all' ||
        historyFilters.startDate !== '' ||
        historyFilters.endDate !== '' ||
        historyFilters.product !== '' ||
        historyFilters.brand !== '' ||
        historyFilters.lcNo !== '';

    const getFilteredHistory = () => {
        return historyRecords.filter(row => {
            // Quick Range
            if (historyFilters.quickRange && historyFilters.quickRange !== 'all') {
                const rowDate = new Date(row.date);
                const now = new Date();
                if (historyFilters.quickRange === 'weekly') {
                    const d = new Date();
                    d.setDate(now.getDate() - 7);
                    if (rowDate < d || rowDate > now) return false;
                } else if (historyFilters.quickRange === 'monthly') {
                    const d = new Date();
                    d.setMonth(now.getMonth() - 1);
                    if (rowDate < d || rowDate > now) return false;
                } else if (historyFilters.quickRange === 'yearly') {
                    const d = new Date();
                    d.setFullYear(now.getFullYear() - 1);
                    if (rowDate < d || rowDate > now) return false;
                }
            }

            // Date Range
            if (historyFilters.startDate) {
                const rDate = (row.date || '').slice(0, 10);
                if (rDate < historyFilters.startDate) return false;
            }
            if (historyFilters.endDate) {
                const rDate = (row.date || '').slice(0, 10);
                if (rDate > historyFilters.endDate) return false;
            }

            // Product
            if (historyFilters.product && (row.product || '').toLowerCase() !== historyFilters.product.toLowerCase()) {
                return false;
            }

            // Brand
            if (historyFilters.brand && (row.brand || '').toLowerCase() !== historyFilters.brand.toLowerCase()) {
                return false;
            }

            // LC No
            if (historyFilters.lcNo && (row.lcNo || '').toLowerCase() !== historyFilters.lcNo.toLowerCase()) {
                return false;
            }

            // Search Query
            const q = (historySearchQuery || '').toLowerCase().trim();
            if (!q) return true;
            return (
                (row.date || '').toLowerCase().includes(q) ||
                (row.invoiceNo || '').toLowerCase().includes(q) ||
                (row.lcNo || '').toLowerCase().includes(q) ||
                (row.product || '').toLowerCase().includes(q) ||
                (row.brand || '').toLowerCase().includes(q) ||
                String(row.invoiceQty).toLowerCase().includes(q) ||
                String(row.receiveQty).toLowerCase().includes(q) ||
                String(row.totalBill).toLowerCase().includes(q)
            );
        });
    };

    const fetchSupplierHistory = async (supplierName) => {
        setHistoryLoading(true);
        try {
            const [cogRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/cost-of-goods`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const cogData = Array.isArray(cogRes.data) ? cogRes.data : [];
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];

            const targetSupplier = (supplierName || '').trim().toLowerCase();

            // Decrypt/normalize stock data if needed
            const validStock = stockData.map(item => {
                try {
                    const d = item.data ? decryptData(item.data) : item;
                    const status = (d.status || '').toLowerCase();
                    if (status.includes('requested') || status.includes('rejected')) return null;
                    return { ...d, _id: item._id };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // Filter Cost of Goods for this supplier
            const supplierCog = cogData.filter(cog => 
                (cog.supplier || '').trim().toLowerCase() === targetSupplier
            );

            // Map each COG record to a history row with receive quantity from stock
            const rows = supplierCog.map(cog => {
                const cleanLc = (cog.lcNo || '').trim().toLowerCase();
                const cleanInv = (cog.invoiceNo || '').trim().toLowerCase();
                const cleanProd = (cog.product || '').trim().toLowerCase();
                const cleanBrand = (cog.brand || '').trim().toLowerCase();

                // Find matching stock records for this COG record
                const matchingStock = validStock.filter(st => {
                    const stLc = (st.lcNo || '').trim().toLowerCase();
                    const stInv = (st.invoiceNo || '').trim().toLowerCase();
                    const stProd = (st.productName || st.product || '').trim().toLowerCase();
                    const stBrand = (st.brand || '').trim().toLowerCase();

                    if (cleanLc && stLc && cleanLc !== stLc) return false;
                    if (cleanInv && stInv && cleanInv !== stInv) return false;
                    if (cleanProd && stProd && cleanProd !== stProd) return false;
                    if (cleanBrand && stBrand && cleanBrand !== stBrand) return false;
                    return true;
                });

                const receiveQty = matchingStock.reduce((sum, st) => sum + (parseFloat(st.quantity) || 0), 0);
                const invQty = parseFloat(cog.quantity) || 0;
                const totalBill = parseFloat(
                    cog.netBill !== undefined && cog.netBill !== null && cog.netBill !== ''
                        ? cog.netBill
                        : (cog.totalBill !== undefined && cog.totalBill !== null && cog.totalBill !== ''
                            ? cog.totalBill
                            : (cog.amount || 0))
                ) || 0;
                const currency = (cog.country === 'CHINA' || cog.country === 'China') ? 'USD' : 'RS';

                return {
                    _id: cog._id,
                    date: cog.date || cog.createdAt,
                    invoiceNo: cog.invoiceNo || '-',
                    lcNo: cog.lcNo || '-',
                    product: cog.product || '-',
                    brand: cog.brand || '-',
                    invoiceQty: invQty,
                    receiveQty: receiveQty,
                    totalBill: totalBill,
                    currency: currency,
                    rawCog: cog
                };
            });

            // If any stock records have this supplier directly and weren't in COG
            const existingKeys = new Set(rows.map(r => `${r.lcNo}_${r.invoiceNo}_${r.product}_${r.brand}`.toLowerCase()));
            validStock.forEach(st => {
                if ((st.supplier || '').trim().toLowerCase() === targetSupplier) {
                    const key = `${st.lcNo || '-'}_${st.invoiceNo || '-'}_${st.productName || st.product || '-'}_${st.brand || '-'}`.toLowerCase();
                    if (!existingKeys.has(key)) {
                        existingKeys.add(key);
                        rows.push({
                            _id: st._id,
                            date: st.date || st.createdAt,
                            invoiceNo: st.invoiceNo || '-',
                            lcNo: st.lcNo || '-',
                            product: st.productName || st.product || '-',
                            brand: st.brand || '-',
                            invoiceQty: parseFloat(st.invoiceQty) || 0,
                            receiveQty: parseFloat(st.quantity) || 0,
                            totalBill: 0,
                            currency: 'RS',
                            rawCog: null
                        });
                    }
                }
            });

            rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setHistoryRecords(rows);
        } catch (error) {
            console.error('Error fetching supplier history:', error);
            setHistoryRecords([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const requestHistorySort = (key) => {
        const direction = (historySortConfig.key === key && historySortConfig.direction === 'asc') ? 'desc' : 'asc';
        setHistorySortConfig({ key, direction });
    };

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

    const toggleExporterSelection = (exporterName) => {
        setFormData(prev => {
            const currentList = Array.isArray(prev.exporters) && prev.exporters.length > 0
                ? prev.exporters
                : (prev.exporter ? prev.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
            let newList;
            if (currentList.includes(exporterName)) {
                newList = currentList.filter(name => name !== exporterName);
            } else {
                newList = [...currentList, exporterName];
            }
            return {
                ...prev,
                exporters: newList,
                exporter: newList.join(', ')
            };
        });
    };

    const removeExporterTag = (exporterName) => {
        setFormData(prev => {
            const currentList = Array.isArray(prev.exporters) && prev.exporters.length > 0
                ? prev.exporters
                : (prev.exporter ? prev.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
            const newList = currentList.filter(name => name !== exporterName);
            return {
                ...prev,
                exporters: newList,
                exporter: newList.join(', ')
            };
        });
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
                toggleExporterSelection(selected.name);
                setExporterSearchQuery('');
            } else if (filtered.length > 0) {
                toggleExporterSelection(filtered[0].name);
                setExporterSearchQuery('');
            }
        } else if (e.key === 'Escape') {
            setExporterDropdownOpen(false);
            setHighlightedExporterIndex(-1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const selectedExporters = Array.isArray(formData.exporters) && formData.exporters.length > 0
            ? formData.exporters
            : (formData.exporter ? formData.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);

        if (selectedExporters.length === 0) {
            alert('Please select at least one exporter.');
            return;
        }

        const payload = {
            ...formData,
            exporters: selectedExporters,
            exporter: selectedExporters.join(', ')
        };

        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const url = editingId
                ? `${API_BASE_URL}/api/suppliers/${editingId}`
                : `${API_BASE_URL}/api/suppliers`;
            if (editingId) await axios.put(url, payload);
            else await axios.post(url, payload);
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
        setFormData({ name: '', exporter: '', exporters: [], address: '', contactPerson: '', email: '', phone: '', status: 'Active' });
        setEditingId(null);
        setSubmitStatus(null);
        setExporterSearchQuery('');
    };

    const handleEdit = (supplier) => {
        const selectedExporters = Array.isArray(supplier.exporters) && supplier.exporters.length > 0
            ? supplier.exporters
            : (supplier.exporter ? supplier.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
        setFormData({
            name: supplier.name || '',
            exporter: selectedExporters.join(', '),
            exporters: selectedExporters,
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
                                {Array.isArray(formData.exporters) && formData.exporters.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {formData.exporters.map(expName => (
                                            <span key={expName} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-sm">
                                                <span>{expName}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); removeExporterTag(expName); }}
                                                    className="hover:bg-blue-200/60 p-0.5 rounded-full text-blue-600 hover:text-blue-900 transition-colors"
                                                >
                                                    <XIcon className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.exporters && formData.exporters.length > 0 ? "Add more exporters..." : "Search Exporter..."}
                                        value={exporterSearchQuery}
                                        onChange={(e) => {
                                            setExporterSearchQuery(e.target.value);
                                            setHighlightedExporterIndex(-1);
                                            if (!exporterDropdownOpen) setExporterDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setExporterDropdownOpen(true);
                                            setHighlightedExporterIndex(-1);
                                        }}
                                        onKeyDown={handleExporterKeyDown}
                                        autoComplete="off"
                                        className="supplier-form-input pr-10"
                                    />
                                    <SearchIcon className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${exporterDropdownOpen ? 'text-blue-500' : 'text-gray-400'}`} />
                                </div>
                                {exporterDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {exporters.filter(exp => exp.name.toLowerCase().includes(exporterSearchQuery.toLowerCase())).length > 0 ? (
                                            exporters.filter(exp => exp.name.toLowerCase().includes(exporterSearchQuery.toLowerCase())).map((exp, idx) => {
                                                const isSelected = (formData.exporters || []).includes(exp.name);
                                                return (
                                                    <button
                                                        key={exp._id}
                                                        type="button"
                                                        onMouseEnter={() => setHighlightedExporterIndex(idx)}
                                                        onClick={() => {
                                                            toggleExporterSelection(exp.name);
                                                            setExporterSearchQuery('');
                                                        }}
                                                        className={`w-full px-5 py-3 text-left text-sm transition-colors flex items-center justify-between group ${
                                                            isSelected
                                                                ? 'bg-blue-50/80 font-bold text-blue-700'
                                                                : highlightedExporterIndex === idx
                                                                ? 'bg-blue-50'
                                                                : 'hover:bg-blue-50'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className={`font-bold ${isSelected ? 'text-blue-700' : 'text-gray-900 group-hover:text-blue-700'}`}>{exp.name}</div>
                                                            {exp.exporterId && <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">{exp.exporterId}</div>}
                                                        </div>
                                                        {isSelected && (
                                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                                                                ✓
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })
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
                const filteredSuppliers = suppliers.filter(supplier => {
                    const searchLower = searchQuery.toLowerCase();
                    const expList = Array.isArray(supplier.exporters) && supplier.exporters.length > 0
                        ? supplier.exporters
                        : (supplier.exporter ? supplier.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
                    return (
                        (supplier.name || '').toLowerCase().includes(searchLower) ||
                        (supplier.phone || '').toLowerCase().includes(searchLower) ||
                        (supplier.contactPerson || '').toLowerCase().includes(searchLower) ||
                        (supplier.exporter || '').toLowerCase().includes(searchLower) ||
                        expList.some(expName => expName.toLowerCase().includes(searchLower))
                    );
                });

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
                                            const expList = Array.isArray(supplier.exporters) && supplier.exporters.length > 0
                                                ? supplier.exporters
                                                : (supplier.exporter ? supplier.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
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
                                                    <td className="supplier-table-cell">
                                                        {expList.length === 0 ? (
                                                            '—'
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                                {expList.map((expName, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100/80">
                                                                        {expName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
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
                                    const expList = Array.isArray(supplier.exporters) && supplier.exporters.length > 0
                                        ? supplier.exporters
                                        : (supplier.exporter ? supplier.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
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
                                                    <div className="text-xs text-gray-500 mt-1 text-left flex items-start gap-1 flex-wrap">
                                                        <span className="font-semibold">Exporter:</span>
                                                        {expList.length === 0 ? '—' : (
                                                            <div className="flex flex-wrap gap-1">
                                                                {expList.map((expName, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                                                        {expName}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
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

            {/* Supplier Details & History Modal */}
            {viewData && createPortal(
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 app-modal-overlay">
                    <div 
                        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" 
                        onClick={() => {
                            setViewData(null);
                            setHistorySearchQuery('');
                            setExpandedHistoryIdx(null);
                        }}
                    ></div>
                    <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl max-w-[95vw] w-full flex flex-col max-h-[90vh] animate-in zoom-in duration-300 z-10 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-4 sm:px-8 pt-3 pb-4 sm:pt-4 sm:pb-6 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-3xl gap-3 flex-shrink-0 z-50 relative">
                            <div className="flex-shrink-0 min-w-0">
                                <h3 className="text-base sm:text-xl font-bold text-gray-900 leading-tight">Supplier History</h3>
                                <p className="text-xs sm:text-sm font-semibold text-gray-600 truncate mt-0.5">{viewData.name}</p>
                            </div>

                            {/* Center Search bar */}
                            <div className="hidden lg:flex flex-1 max-w-xl mx-auto flex-col items-center gap-4">
                                <div className="w-full max-w-md relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by LC No, Invoice, Product or Brand..."
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-9 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    />
                                    {historySearchQuery && (
                                        <button
                                            onClick={() => setHistorySearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                                        >
                                            <XIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Right: Filter, Report, Close */}
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button
                                        ref={historyFilterButtonRef}
                                        onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                        className={`flex items-center justify-center sm:gap-2 w-9 h-9 sm:w-auto sm:h-10 sm:px-4 rounded-xl transition-all border ${
                                            showHistoryFilterPanel || isFilterActive
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || isFilterActive ? 'text-white' : 'text-gray-400'}`} />
                                        <span className="hidden sm:block text-sm font-medium">Filter</span>
                                    </button>

                                    {/* Mobile Filter Overlay Backdrop */}
                                    {showHistoryFilterPanel && (
                                        <div 
                                            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[55] lg:hidden"
                                            onClick={() => setShowHistoryFilterPanel(false)}
                                        />
                                    )}

                                    {/* Filter Dropdown Panel */}
                                    {showHistoryFilterPanel && (
                                        <div
                                            ref={historyFilterPanelRef}
                                            className="fixed inset-x-4 top-24 lg:absolute lg:inset-auto lg:right-0 lg:mt-3 w-auto lg:w-[360px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200 overflow-y-auto lg:overflow-visible max-h-[70vh] text-left"
                                        >
                                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                                <h4 className="font-bold text-gray-900 text-sm">Advanced Filters</h4>
                                                <button
                                                    onClick={() => {
                                                        setHistoryFilters({
                                                            quickRange: 'all',
                                                            startDate: '',
                                                            endDate: '',
                                                            product: '',
                                                            brand: '',
                                                            lcNo: ''
                                                        });
                                                    }}
                                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                                >
                                                    Reset All
                                                </button>
                                            </div>

                                            <div className="space-y-3.5">
                                                {/* Quick Range */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Quick Range</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                                            <button
                                                                key={range}
                                                                type="button"
                                                                onClick={() => setHistoryFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                                    historyFilters.quickRange === range
                                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {range.charAt(0).toUpperCase() + range.slice(1)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Date Range */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <CustomDatePicker
                                                        label="FROM DATE"
                                                        value={historyFilters.startDate}
                                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'all' }))}
                                                        compact={true}
                                                        labelClassName="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                                                    />
                                                    <CustomDatePicker
                                                        label="TO DATE"
                                                        value={historyFilters.endDate}
                                                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'all' }))}
                                                        compact={true}
                                                        rightAlign={true}
                                                        labelClassName="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                                                    />
                                                </div>

                                                {/* Product Filter */}
                                                <SearchableFilterSelect
                                                    label="Product"
                                                    value={historyFilters.product}
                                                    onChange={(val) => setHistoryFilters(prev => ({ ...prev, product: val }))}
                                                    options={availableProducts}
                                                    placeholder="All Products"
                                                />

                                                {/* Brand Filter */}
                                                <SearchableFilterSelect
                                                    label="Brand"
                                                    value={historyFilters.brand}
                                                    onChange={(val) => setHistoryFilters(prev => ({ ...prev, brand: val }))}
                                                    options={availableBrands}
                                                    placeholder="All Brands"
                                                />

                                                {/* LC No Filter */}
                                                <SearchableFilterSelect
                                                    label="LC No"
                                                    value={historyFilters.lcNo}
                                                    onChange={(val) => setHistoryFilters(prev => ({ ...prev, lcNo: val }))}
                                                    options={availableLcs}
                                                    placeholder="All LC Numbers"
                                                />

                                                <button
                                                    onClick={() => setShowHistoryFilterPanel(false)}
                                                    className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-all mt-2"
                                                >
                                                    Apply Filters
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Report Button */}
                                <button
                                    onClick={() => setShowReportFormatModal(true)}
                                    className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-10 sm:px-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm"
                                    title="Export Report (PDF / Excel)"
                                >
                                    <FileTextIcon className="w-4 h-4" />
                                    <span className="hidden sm:block text-sm font-medium ml-2">Report</span>
                                </button>

                                {/* Close Button */}
                                <button 
                                    onClick={() => {
                                        setViewData(null);
                                        setHistorySearchQuery('');
                                        setExpandedHistoryIdx(null);
                                        setShowReportFormatModal(false);
                                    }} 
                                    className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <XIcon className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Mobile Search Row (hidden on lg+) */}
                        <div className="lg:hidden px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by LC No, Invoice, Product, Brand..."
                                    value={historySearchQuery}
                                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-9 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-xs placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                                {historySearchQuery && (
                                    <button
                                        onClick={() => setHistorySearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                                    >
                                        <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 min-h-0 text-left">
                            {/* Supplier Profile Info Card */}
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-2">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Associated Exporters</span>
                                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {(() => {
                                                const expList = Array.isArray(viewData.exporters) && viewData.exporters.length > 0
                                                    ? viewData.exporters
                                                    : (viewData.exporter ? viewData.exporter.split(',').map(s => s.trim()).filter(Boolean) : []);
                                                if (expList.length === 0) return <p className="font-semibold text-gray-800 text-sm">—</p>;
                                                return expList.map((expName, idx) => (
                                                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                        {expName}
                                                    </span>
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contact Person</span>
                                        <p className="font-semibold text-gray-800 mt-1 text-sm">{viewData.contactPerson || '—'}</p>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Phone</span>
                                        <p className="font-semibold text-gray-800 mt-1 text-sm font-mono">{viewData.phone || '—'}</p>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Email</span>
                                        <p className="font-semibold text-gray-800 mt-1 text-sm truncate" title={viewData.email}>{viewData.email || '—'}</p>
                                    </div>

                                    <div className="md:col-span-3">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Address</span>
                                        <p className="text-gray-700 mt-1 text-sm whitespace-pre-wrap">{viewData.address || '—'}</p>
                                    </div>
                                </div>

                                {/* KPI Metrics Bar */}
                                {(() => {
                                    const filtered = getFilteredHistory();
                                    const totalInv = filtered.reduce((s, r) => s + (parseFloat(r.invoiceQty) || 0), 0);
                                    const totalRec = filtered.reduce((s, r) => s + (parseFloat(r.receiveQty) || 0), 0);
                                    const totalBill = filtered.reduce((s, r) => s + (parseFloat(r.totalBill) || 0), 0);

                                    return (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-200/60">
                                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Entries</span>
                                                <p className="text-lg font-black text-gray-900 mt-0.5">{filtered.length}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total Invoice QTY</span>
                                                <p className="text-lg font-black text-blue-700 mt-0.5">{Math.round(totalInv).toLocaleString('en-US')} <span className="text-xs font-semibold text-gray-400">KG</span></p>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Total Receive QTY</span>
                                                <p className="text-lg font-black text-emerald-700 mt-0.5">{Math.round(totalRec).toLocaleString('en-US')} <span className="text-xs font-semibold text-gray-400">KG</span></p>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">Total Bill</span>
                                                <p className="text-lg font-black text-purple-700 mt-0.5">
                                                    {totalBill > 0 ? totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Transactions Table Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                                        <span>Transactions & Receive Details</span>
                                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full font-semibold">
                                            {getFilteredHistory().length}
                                        </span>
                                    </h4>
                                </div>

                                {historyLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                        <p className="text-xs text-gray-400 mt-2 font-medium">Loading supplier history from COG & LC Receive...</p>
                                    </div>
                                ) : (() => {
                                    const filtered = getFilteredHistory();

                                    const sorted = [...filtered].sort((a, b) => {
                                        if (!historySortConfig.key) return 0;
                                        const { key, direction } = historySortConfig;
                                        let valA = a[key];
                                        let valB = b[key];
                                        if (key === 'date') {
                                            valA = new Date(valA || 0).getTime();
                                            valB = new Date(valB || 0).getTime();
                                        } else if (typeof valA === 'number' && typeof valB === 'number') {
                                            // numeric
                                        } else {
                                            valA = (valA || '').toString().toLowerCase();
                                            valB = (valB || '').toString().toLowerCase();
                                        }
                                        if (valA < valB) return direction === 'asc' ? -1 : 1;
                                        if (valA > valB) return direction === 'asc' ? 1 : -1;
                                        return 0;
                                    });

                                    const totalInv = sorted.reduce((s, r) => s + (parseFloat(r.invoiceQty) || 0), 0);
                                    const totalRec = sorted.reduce((s, r) => s + (parseFloat(r.receiveQty) || 0), 0);
                                    const totalBill = sorted.reduce((s, r) => s + (parseFloat(r.totalBill) || 0), 0);

                                    if (sorted.length === 0) {
                                        return (
                                            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
                                                <BoxIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p className="text-sm font-semibold text-gray-600">No transactions found</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {historySearchQuery || isFilterActive ? 'Try clearing your search query or filters' : 'No cost of goods or receive records found for this supplier'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {/* Desktop Table */}
                                            <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-x-auto shadow-sm">
                                                <table className="w-full text-left text-sm border-collapse" style={{ minWidth: '50rem' }}>
                                                    <thead className="bg-slate-50/70 border-b border-gray-100">
                                                        <tr>
                                                            <th 
                                                                onClick={() => requestHistorySort('date')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    Date
                                                                    <SortIcon config={historySortConfig} columnKey="date" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('invoiceNo')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    Invoice
                                                                    <SortIcon config={historySortConfig} columnKey="invoiceNo" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('lcNo')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    LC No
                                                                    <SortIcon config={historySortConfig} columnKey="lcNo" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('product')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    Product
                                                                    <SortIcon config={historySortConfig} columnKey="product" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('brand')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    Brand
                                                                    <SortIcon config={historySortConfig} columnKey="brand" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('invoiceQty')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center justify-end gap-1">
                                                                    Invoice QTY
                                                                    <SortIcon config={historySortConfig} columnKey="invoiceQty" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('receiveQty')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center justify-end gap-1">
                                                                    Receive Qty
                                                                    <SortIcon config={historySortConfig} columnKey="receiveQty" />
                                                                </div>
                                                            </th>
                                                            <th 
                                                                onClick={() => requestHistorySort('totalBill')}
                                                                className="px-4 py-3.5 text-[10px] md:text-[11px] font-black text-gray-400 uppercase tracking-widest text-right cursor-pointer hover:bg-gray-100/60 transition-colors whitespace-nowrap"
                                                            >
                                                                <div className="flex items-center justify-end gap-1">
                                                                    Total Bill
                                                                    <SortIcon config={historySortConfig} columnKey="totalBill" />
                                                                </div>
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50 font-medium">
                                                        {sorted.map((row, idx) => (
                                                            <tr key={row._id || idx} className="hover:bg-blue-50/30 transition-colors">
                                                                <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap font-mono">
                                                                    {formatDate(row.date)}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs font-black text-gray-900 whitespace-nowrap">
                                                                    {row.invoiceNo || '—'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs font-black text-blue-600 whitespace-nowrap uppercase tracking-tight">
                                                                    {row.lcNo || '—'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs font-bold text-gray-800">
                                                                    {row.product || '—'}
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs">
                                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                                                        {row.brand || '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs text-right font-bold text-gray-900 whitespace-nowrap">
                                                                    {row.invoiceQty ? `${Math.round(row.invoiceQty).toLocaleString('en-US')} ` : '0 '}
                                                                    <span className="text-[10px] text-gray-400 font-semibold">KG</span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs text-right font-bold text-emerald-600 whitespace-nowrap">
                                                                    {row.receiveQty ? `${Math.round(row.receiveQty).toLocaleString('en-US')} ` : '0 '}
                                                                    <span className="text-[10px] text-emerald-500/70 font-semibold">KG</span>
                                                                </td>
                                                                <td className="px-4 py-3.5 text-xs text-right font-black text-purple-700 whitespace-nowrap">
                                                                    {row.totalBill ? (
                                                                        <span>
                                                                            {row.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            <span className="text-[10px] text-gray-400 font-semibold ml-1">{row.currency}</span>
                                                                        </span>
                                                                    ) : '—'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-gradient-to-r from-blue-50/50 via-slate-50 to-indigo-50/50 border-t border-gray-100 font-bold">
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-3.5 text-gray-600 text-xs uppercase tracking-wider font-black">
                                                                Grand Total ({sorted.length} records)
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right text-blue-700 text-xs font-black">
                                                                {Math.round(totalInv).toLocaleString('en-US')} <span className="text-[10px] font-semibold text-blue-500">KG</span>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right text-emerald-700 text-xs font-black">
                                                                {Math.round(totalRec).toLocaleString('en-US')} <span className="text-[10px] font-semibold text-emerald-500">KG</span>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-right text-purple-800 text-xs font-black">
                                                                {totalBill > 0 ? totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>

                                            {/* Mobile Card List View */}
                                            <div className="block md:hidden space-y-3">
                                                {sorted.map((row, idx) => {
                                                    const isExpanded = expandedHistoryIdx === idx;
                                                    return (
                                                        <div 
                                                            key={row._id || idx}
                                                            className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
                                                                isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'
                                                            }`}
                                                        >
                                                            {/* Card Toggle Header */}
                                                            <div 
                                                                className="flex justify-between items-center p-3.5 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                                                onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}
                                                            >
                                                                <div className="flex-1 min-w-0 pr-3">
                                                                    <div className="flex items-center gap-1.5 text-xs text-left min-w-0 overflow-hidden">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">{formatDate(row.date)}</span>
                                                                        <span className="text-gray-300 font-bold shrink-0">•</span>
                                                                        <span className="font-bold text-gray-800 truncate" title={row.product}>{row.product || '—'}</span>
                                                                        <span className="text-gray-300 font-bold shrink-0">•</span>
                                                                        <span className="font-black text-blue-600 truncate shrink-0" title={row.lcNo}>{row.lcNo || '—'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                                                                        <span className="text-gray-500 font-medium">Inv: {row.invoiceNo || '—'}</span>
                                                                        <span className="text-gray-300">•</span>
                                                                        <span className="font-bold text-emerald-600">Rec: {row.receiveQty ? Math.round(row.receiveQty).toLocaleString('en-US') : 0} KG</span>
                                                                    </div>
                                                                </div>
                                                                <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                                </div>
                                                            </div>

                                                            {/* Expandable Details */}
                                                            {isExpanded && (
                                                                <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/50 border-t border-gray-100 text-xs text-left animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="grid grid-cols-[110px_8px_1fr] gap-y-2 pt-2.5 items-baseline">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice No</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-semibold text-gray-800 text-[11px]">{row.invoiceNo || '—'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC No</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-blue-600 text-[11px] uppercase">{row.lcNo || '—'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 text-[11px]">{row.product || '—'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brand</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-purple-600 text-[11px]">{row.brand || '—'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice QTY</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 text-[11px]">
                                                                            {row.invoiceQty ? `${Math.round(row.invoiceQty).toLocaleString('en-US')} KG` : '0 KG'}
                                                                        </span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receive QTY</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-emerald-700 text-[11px]">
                                                                            {row.receiveQty ? `${Math.round(row.receiveQty).toLocaleString('en-US')} KG` : '0 KG'}
                                                                        </span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Bill</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-purple-700 text-[11px]">
                                                                            {row.totalBill ? `${row.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${row.currency}` : '—'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Export Format Selection Modal */}
            <ReportFormatModal
                isOpen={showReportFormatModal}
                onClose={() => setShowReportFormatModal(false)}
                title={`${viewData?.name || 'Supplier'} Report`}
                subtitle="Select your preferred format to export or preview transactions"
                onExportPdf={() => {
                    generateSupplierProfileReportPDF(viewData, getFilteredHistory(), historyFilters);
                }}
                onExportExcel={() => {
                    generateSupplierProfileReportExcel(viewData, getFilteredHistory(), historyFilters);
                }}
            />
        </div>
    );
};

export default Supplier;
