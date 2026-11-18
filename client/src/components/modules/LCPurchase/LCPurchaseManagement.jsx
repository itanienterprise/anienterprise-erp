import React, { useRef, useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { queryClient } from '../../../utils/queryClient';
import { getSocket } from '../../../utils/socket';
import {
    SearchIcon, PlusIcon, FunnelIcon, BarChartIcon, XIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, BoxIcon, TrashIcon, EditIcon, EyeIcon
} from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import PaginationBar, { ALL_PAGE_SIZE } from '../../shared/PaginationBar';
import '../Sale/SaleManagement.css';
import PurchaseDealReport from './PurchaseDealReport';

/**
 * Reusable Table Header Sort Indicator
 */
const SortIndicator = ({ sortKey, currentSortKey, direction, align = 'left' }) => {
    const isActive = sortKey === currentSortKey;
    return (
        <span className={`inline-flex items-center ${align === 'center' ? 'ml-1' : align === 'right' ? 'ml-1' : 'ml-1.5'} transition-opacity ${
            isActive ? 'opacity-100 text-blue-600' : 'opacity-25 group-hover:opacity-60 text-gray-400'
        }`}>
            {isActive ? (
                direction === 'asc' ? (
                    <ChevronUpIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                    <ChevronDownIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                )
            ) : (
                <span className="flex flex-col -space-y-1">
                    <ChevronUpIcon className="w-2.5 h-2.5" />
                    <ChevronDownIcon className="w-2.5 h-2.5" />
                </span>
            )}
        </span>
    );
};

export const getDealStatus = (qty, remainingQty) => {
    const purchase = parseFloat(qty) || 0;
    const remaining = parseFloat(remainingQty) || 0;
    const received = Math.max(0, purchase - remaining);

    if (purchase > 0 && remaining <= 0.001) {
        return {
            status: 'Completed',
            badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200/60',
            dotClass: 'bg-blue-500'
        };
    } else if (purchase > 0 && received > 0 && remaining > 0.001) {
        return {
            status: 'Not Completed',
            badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/60',
            dotClass: 'bg-amber-500'
        };
    } else {
        return {
            status: 'Active',
            badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
            dotClass: 'bg-emerald-500'
        };
    }
};

/**
 * Unified Searchable Filter Select with Multi-select Support
 * - Single unified input: the field itself IS the search input.
 * - Supports selecting multiple options with checkboxes.
 * - Live filtering as you type in the same place.
 */
const SearchableFilterSelect = ({
    label,
    value = [],
    onChange,
    options = [],
    placeholder = 'Search...',
    labelClassName = 'text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1',
    multiple = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Normalize value to array
    const selectedValues = useMemo(() => {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return [value];
    }, [value]);

    const filteredOptions = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return options;
        return options.filter(opt =>
            String(opt || '').toLowerCase().includes(q)
        );
    }, [options, search]);

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

    const toggleOption = (opt) => {
        if (!multiple) {
            onChange(opt);
            setIsOpen(false);
            setSearch('');
            return;
        }

        let updated;
        if (selectedValues.includes(opt)) {
            updated = selectedValues.filter(v => v !== opt);
        } else {
            updated = [...selectedValues, opt];
        }
        onChange(updated);
        inputRef.current?.focus();
    };

    const handleClearAll = (e) => {
        if (e) e.stopPropagation();
        onChange(multiple ? [] : '');
        setSearch('');
        if (!isOpen) setIsOpen(false);
    };

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
                const target = filteredOptions[highlightedIndex] !== undefined ? filteredOptions[highlightedIndex] : filteredOptions[0];
                if (target) {
                    toggleOption(target);
                }
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearch('');
            inputRef.current?.blur();
        }
    };

    // Label displayed when not searching
    const displayText = useMemo(() => {
        if (selectedValues.length === 0) return '';
        if (selectedValues.length === 1) return selectedValues[0];
        return `${selectedValues.length} Selected`;
    }, [selectedValues]);

    return (
        <div className={`space-y-1 relative ${isOpen ? 'z-40' : 'z-10'}`} ref={dropdownRef}>
            {label && <label className={labelClassName}>{label}</label>}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={isOpen ? search : displayText}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => {
                        setIsOpen(true);
                        setSearch('');
                    }}
                    onClick={() => {
                        if (!isOpen) setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={displayText || placeholder}
                    className={`w-full px-3 py-2 bg-gray-50/70 border rounded-xl text-xs outline-none transition-all pr-12 ${
                        selectedValues.length > 0 && !isOpen
                            ? 'font-semibold text-blue-900 bg-blue-50/50 border-blue-200'
                            : 'text-gray-700 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {selectedValues.length > 1 && !isOpen && (
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {selectedValues.length}
                        </span>
                    )}
                    {selectedValues.length > 0 ? (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            title="Clear selection"
                            className="p-1 text-gray-400 hover:text-red-500 rounded-full transition-colors cursor-pointer"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <div
                            onClick={() => {
                                setIsOpen(prev => !prev);
                                if (!isOpen) inputRef.current?.focus();
                            }}
                            className="cursor-pointer p-1 text-gray-400"
                        >
                            <ChevronDownIcon
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}
                            />
                        </div>
                    )}
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-[70] max-h-56 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                    {/* Header bar showing counts and Clear action */}
                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60 text-[11px]">
                        <span className="text-gray-500 font-medium">
                            {selectedValues.length === 0 ? 'Showing All' : `${selectedValues.length} of ${options.length} selected`}
                        </span>
                        {selectedValues.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                            >
                                Reset to All
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto max-h-44 py-0.5 divide-y divide-gray-50">
                        {/* Option for "All" */}
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                selectedValues.length === 0 ? 'bg-blue-50/80 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    selectedValues.length === 0 ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                                }`}>
                                    {selectedValues.length === 0 && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                                </span>
                                <span>{placeholder}</span>
                            </div>
                        </button>

                        {/* List of filtered options */}
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => {
                                const isChecked = selectedValues.includes(opt);
                                const isHighlighted = highlightedIndex === idx;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        onClick={() => toggleOption(opt)}
                                        className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                                            isChecked
                                                ? 'bg-blue-50/60 text-blue-900 font-semibold'
                                                : isHighlighted
                                                ? 'bg-gray-100 text-gray-900'
                                                : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                                            }`}>
                                                {isChecked && <CheckIcon className="w-3 h-3 stroke-[3]" />}
                                            </span>
                                            <span className="truncate">{opt}</span>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-center text-gray-400 text-xs font-medium">
                                No matching options found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const LCPurchaseManagement = ({ currentUser, addNotification, refreshPendingIndicators }) => {
    const canAdd = hasPermission(currentUser, 'lcPurchase', 'add');
    const canEdit = hasPermission(currentUser, 'lcPurchase', 'edit');
    const canDelete = hasPermission(currentUser, 'lcPurchase', 'delete');
    const canShowEntryBy = hasPermission(currentUser, 'lcPurchase', 'showEntryBy') || currentUser?.role === 'Admin' || currentUser?.role === 'Incharge';

    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [deleteConfirmState, setDeleteConfirmState] = useState({ show: false, id: null, title: '' });
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [expandedMobileRows, setExpandedMobileRows] = useState([]);

    const toggleMobileRowExpansion = (id) => {
        setExpandedMobileRows(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };

    // Filter states
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        quickRange: 'all',
        exporter: [],
        supplierName: [],
        productName: [],
        brand: [],
        status: ['all']
    });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // Modal & Form State for "+ Add Purchase" / Edit
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        exporter: '',
        supplierName: '',
        productName: '',
        brand: '',
        rate: '',
        qty: '',
        uom: 'Truck', // 'Truck' or 'QTY'
        truckNo: '',
        remarks: ''
    });

    // Dropdown / search states for form
    const [exportersList, setExportersList] = useState([]);
    const [suppliersList, setSuppliersList] = useState([]);
    const [productsList, setProductsList] = useState([]);
    const [exporterSearch, setExporterSearch] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [isExporterDropdownOpen, setIsExporterDropdownOpen] = useState(false);
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

    // Records list state
    const [records, setRecords] = useState([]);
    const [dealReceivesList, setDealReceivesList] = useState([]);
    const [costOfGoodsList, setCostOfGoodsList] = useState([]);
    const [stockList, setStockList] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState('all');
    const tableContainerRef = useRef(null);

    // Fetch initial suppliers, exporters and products
    const loadInitialData = async () => {
        try {
            const [supRes, expRes, prodRes] = await Promise.all([
                queryClient.fetchQuery({
                    queryKey: ['suppliers'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/suppliers?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
                }),
                queryClient.fetchQuery({
                    queryKey: ['exporters'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/exporters?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
                }),
                queryClient.fetchQuery({
                    queryKey: ['products'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/products?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
                })
            ]);
            if (Array.isArray(supRes)) setSuppliersList(supRes);
            if (Array.isArray(expRes)) setExportersList(expRes);
            if (Array.isArray(prodRes)) setProductsList(prodRes);
        } catch (err) {
            console.error('Error loading initial data for LC Purchase:', err);
        }
    };

    // Fetch LC Purchases from backend
    const fetchLCPurchases = async (silent = false) => {
        if (!silent) {
            const cached = queryClient.getQueryData(['lcPurchases']);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                setRecords(cached);
            } else {
                setIsLoading(true);
            }
        }
        try {
            const res = await axios.get(`${API_BASE_URL}/api/lc-purchases?_t=${Date.now()}`);
            const data = Array.isArray(res.data) ? res.data : [];
            setRecords(data);
            queryClient.setQueryData(['lcPurchases'], data);
        } catch (err) {
            console.error('Error fetching LC Purchases:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch Deal Receives, Cost of Goods, and Stock to display downstream LC Receive info in Purchase Deal Details
    const fetchDealReceives = async () => {
        try {
            const [drRes, cogRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/deal-receives?_t=${Date.now()}`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/cost-of-goods?_t=${Date.now()}`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/stock?_t=${Date.now()}`).catch(() => ({ data: [] }))
            ]);
            setDealReceivesList(Array.isArray(drRes.data) ? drRes.data : []);
            setCostOfGoodsList(Array.isArray(cogRes.data) ? cogRes.data : []);
            setStockList(Array.isArray(stockRes.data) ? stockRes.data : []);
        } catch (err) {
            console.error('Error fetching deal receives, COG, and stock:', err);
        }
    };

    useEffect(() => {
        loadInitialData();
        fetchLCPurchases();
        fetchDealReceives();

        const socket = getSocket();
        const handleRealtimeUpdate = (data) => {
            const mod = (data?.module || '').toLowerCase().trim();
            if (!mod || ['suppliers', 'supplier', 'exporters', 'exporter', 'products', 'product', 'all'].includes(mod)) {
                loadInitialData();
            }
            if (!mod || ['lc-purchases', 'lc-purchase', 'lcpurchase', 'all'].includes(mod)) {
                fetchLCPurchases(true);
            }
            if (!mod || ['deal-receives', 'deal-receive', 'dealreceive', 'costofgoods', 'cost-of-goods', 'stock', 'lcreceive', 'lc-receive', 'all'].includes(mod)) {
                fetchDealReceives();
            }
        };

        if (socket) {
            socket.on('data_updated', handleRealtimeUpdate);
        }
        const onCustomEvent = (e) => handleRealtimeUpdate(e?.detail);
        window.addEventListener('erp_data_updated', onCustomEvent);

        return () => {
            if (socket) socket.off('data_updated', handleRealtimeUpdate);
            window.removeEventListener('erp_data_updated', onCustomEvent);
        };
    }, []);

    // Filtered exporters for dropdown
    const filteredExporters = useMemo(() => {
        const q = (exporterSearch || '').toLowerCase().trim();
        return exportersList.filter(e => {
            const name = (e.name || '').toLowerCase();
            return name.includes(q);
        });
    }, [exportersList, exporterSearch]);

    // Search within all suppliers
    const filteredSuppliers = useMemo(() => {
        const q = (supplierSearch || '').toLowerCase().trim();
        return suppliersList.filter(s => {
            const name = (s.name || s.companyName || s.customerName || '').toLowerCase();
            const contact = (s.contactPerson || '').toLowerCase();
            return !q || name.includes(q) || contact.includes(q);
        });
    }, [suppliersList, supplierSearch]);

    const filteredProducts = useMemo(() => {
        const q = (productSearch || '').toLowerCase().trim();
        return productsList.filter(p => {
            const name = (p.productName || p.name || '').toLowerCase();
            return name.includes(q);
        });
    }, [productsList, productSearch]);

    const availableBrands = useMemo(() => {
        if (!formData.productName) return [];
        const prod = productsList.find(p => (p.productName || p.name || '').toLowerCase().trim() === formData.productName.toLowerCase().trim());
        if (prod && Array.isArray(prod.brands)) {
            return prod.brands.map(b => typeof b === 'string' ? b : (b.brand || b.name || '')).filter(Boolean);
        }
        return [];
    }, [formData.productName, productsList]);

    const filteredBrands = useMemo(() => {
        const q = (brandSearch || '').toLowerCase().trim();
        return availableBrands.filter(b => b.toLowerCase().includes(q));
    }, [availableBrands, brandSearch]);

    const totalCalculatedAmount = useMemo(() => {
        const r = parseFloat(formData.rate) || 0;
        const q = parseFloat(formData.qty) || 0;
        return r * q;
    }, [formData.rate, formData.qty]);

    // Unique Exporters for filter
    const uniqueExporters = useMemo(() => {
        const fromRecords = records.map(r => (r.exporter || '').trim()).filter(Boolean);
        const fromList = exportersList.map(e => (e.name || '').trim()).filter(Boolean);
        return Array.from(new Set([...fromRecords, ...fromList])).sort((a, b) => a.localeCompare(b));
    }, [records, exportersList]);

    // Unique Suppliers for filter
    const uniqueSuppliers = useMemo(() => {
        const selectedExps = Array.isArray(filters.exporter)
            ? filters.exporter
            : (filters.exporter ? [filters.exporter] : []);

        if (selectedExps.length > 0) {
            const expTargets = selectedExps.map(e => e.toLowerCase().trim());
            const recSuppliers = records
                .filter(r => expTargets.includes((r.exporter || '').toLowerCase().trim()))
                .map(r => (r.supplierName || '').trim())
                .filter(Boolean);

            const cfgSuppliers = suppliersList.filter(s => {
                if (Array.isArray(s.exporters) && s.exporters.some(e => expTargets.includes((e || '').toLowerCase().trim()))) return true;
                if (s.exporter && expTargets.some(t => String(s.exporter).toLowerCase().includes(t))) return true;
                return false;
            }).map(s => (s.name || s.companyName || '').trim()).filter(Boolean);

            let list = [...recSuppliers, ...cfgSuppliers];
            if (list.length === 0) {
                list = [...records.map(r => (r.supplierName || '').trim()).filter(Boolean), ...suppliersList.map(s => (s.name || s.companyName || '').trim()).filter(Boolean)];
            }
            return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
        } else {
            const list = [...records.map(r => (r.supplierName || '').trim()).filter(Boolean), ...suppliersList.map(s => (s.name || s.companyName || '').trim()).filter(Boolean)];
            return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
        }
    }, [records, suppliersList, filters.exporter]);

    // Unique Products for filter
    const uniqueProducts = useMemo(() => {
        const fromRecords = records.map(r => (r.productName || '').trim()).filter(Boolean);
        const fromList = productsList.map(p => (p.productName || p.name || '').trim()).filter(Boolean);
        return Array.from(new Set([...fromRecords, ...fromList])).sort((a, b) => a.localeCompare(b));
    }, [records, productsList]);

    // Unique Brands for filter
    const uniqueBrands = useMemo(() => {
        const selectedProds = Array.isArray(filters.productName)
            ? filters.productName
            : (filters.productName ? [filters.productName] : []);

        if (selectedProds.length > 0) {
            const prodTargets = selectedProds.map(p => p.toLowerCase().trim());
            const recBrands = records
                .filter(r => prodTargets.includes((r.productName || '').toLowerCase().trim()))
                .map(r => (r.brand || '').trim())
                .filter(Boolean);

            let cfgBrands = [];
            productsList.filter(p => prodTargets.includes((p.productName || p.name || '').toLowerCase().trim())).forEach(prodObj => {
                if (prodObj && Array.isArray(prodObj.brands)) {
                    prodObj.brands.forEach(b => {
                        const name = (typeof b === 'string' ? b : (b.brand || b.name || '')).trim();
                        if (name) cfgBrands.push(name);
                    });
                }
            });

            let list = [...recBrands, ...cfgBrands];
            if (list.length === 0) {
                list = records.map(r => (r.brand || '').trim()).filter(Boolean);
            }
            return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
        } else {
            const fromRecords = records.map(r => (r.brand || '').trim()).filter(Boolean);
            const fromProducts = productsList.flatMap(p => Array.isArray(p.brands) ? p.brands.map(b => typeof b === 'string' ? b : (b.brand || b.name || '')) : []).map(b => (b || '').trim()).filter(Boolean);
            return Array.from(new Set([...fromRecords, ...fromProducts])).sort((a, b) => a.localeCompare(b));
        }
    }, [records, productsList, filters.productName]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                filterPanelRef.current && !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current && !filterButtonRef.current.contains(e.target)
            ) {
                setShowFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            ...(key === 'startDate' || key === 'endDate' ? { quickRange: 'custom' } : {})
        }));
    };

    const handleQuickRange = (range) => {
        const now = new Date();
        let start = '';
        let end = '';

        if (range === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            start = todayStr;
            end = todayStr;
        } else if (range === 'weekly') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            start = startOfWeek.toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
        } else if (range === 'monthly') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            start = startOfMonth.toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
        } else if (range === 'yearly') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            start = startOfYear.toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
        }

        setFilters(prev => ({
            ...prev,
            quickRange: range,
            startDate: start,
            endDate: end
        }));
    };

    const handleStatusToggle = (val) => {
        setFilters(prev => {
            let current = Array.isArray(prev.status) ? [...prev.status] : ['all'];
            if (val === 'all') {
                return { ...prev, status: ['all'] };
            }
            current = current.filter(s => s !== 'all');
            if (current.includes(val)) {
                current = current.filter(s => s !== val);
                if (current.length === 0) current = ['all'];
            } else {
                current.push(val);
            }
            return { ...prev, status: current };
        });
    };

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            quickRange: 'all',
            exporter: [],
            supplierName: [],
            productName: [],
            brand: [],
            status: ['all']
        });
    };

    const handleOpenModal = () => {
        setEditingRecord(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            exporter: '',
            supplierName: '',
            productName: '',
            brand: '',
            rate: '',
            qty: '',
            uom: 'Truck',
            truckNo: '',
            remarks: ''
        });
        setExporterSearch('');
        setSupplierSearch('');
        setProductSearch('');
        setBrandSearch('');
        setIsExporterDropdownOpen(false);
        setIsSupplierDropdownOpen(false);
        setIsProductDropdownOpen(false);
        setIsBrandDropdownOpen(false);
        setShowModal(true);
    };

    const handleEditRecord = (item) => {
        setEditingRecord(item);
        setFormData({
            date: item.date || new Date().toISOString().split('T')[0],
            exporter: item.exporter || '',
            supplierName: item.supplierName || '',
            productName: item.productName || '',
            brand: item.brand || '',
            rate: item.rate !== undefined && item.rate !== null ? String(item.rate) : '',
            qty: item.qty !== undefined && item.qty !== null ? String(item.qty) : '',
            uom: item.uom || 'Truck',
            truckNo: item.truckNo || '',
            remarks: item.remarks || ''
        });
        setExporterSearch(item.exporter || '');
        setSupplierSearch(item.supplierName || '');
        setProductSearch(item.productName || '');
        setBrandSearch(item.brand || '');
        setIsExporterDropdownOpen(false);
        setIsSupplierDropdownOpen(false);
        setIsProductDropdownOpen(false);
        setIsBrandDropdownOpen(false);
        setShowModal(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const purchaseQty = parseFloat(formData.qty) || 0;
            const purchaseRate = parseFloat(formData.rate) || 0;

            if (editingRecord) {
                const receivedQty = parseFloat(editingRecord.receivedQty) || 0;
                const remainingQty = Math.max(0, purchaseQty - receivedQty);
                const pId = (editingRecord.purchaseId || '').replace(/-/g, '');
                const payload = {
                    ...editingRecord,
                    ...formData,
                    purchaseId: pId,
                    qty: purchaseQty,
                    rate: purchaseRate,
                    receivedQty,
                    remainingQty,
                    updatedBy: currentUser?.name || currentUser?.username || 'Admin'
                };

                const res = await axios.put(`${API_BASE_URL}/api/lc-purchases/${editingRecord._id}`, payload);
                const updatedRecord = res.data || { ...payload, _id: editingRecord._id };
                setRecords(prev => prev.map(r => r._id === editingRecord._id ? updatedRecord : r));
                queryClient.invalidateQueries({ queryKey: ['lcPurchases'] });
                if (addNotification) {
                    addNotification(`Purchase Deal ${pId} updated successfully`, 'success');
                }
                setShowModal(false);
                setEditingRecord(null);
                return;
            }

            // Generate purchase ID upon clicking save button (no hyphen, e.g. LCP0001)
            const nextId = `LCP${String(records.length + 1).padStart(4, '0')}`;

            const payload = {
                ...formData,
                purchaseId: nextId,
                qty: purchaseQty,
                rate: purchaseRate,
                receivedQty: 0,
                remainingQty: purchaseQty,
                status: 'Active',
                createdBy: currentUser?.name || currentUser?.username || 'Admin'
            };

            const res = await axios.post(`${API_BASE_URL}/api/lc-purchases`, payload);
            const savedRecord = res.data || { ...payload, _id: Date.now().toString(), createdAt: new Date().toISOString() };
            setRecords(prev => [savedRecord, ...prev.filter(r => r._id !== savedRecord._id)]);
            queryClient.invalidateQueries({ queryKey: ['lcPurchases'] });
            if (addNotification) {
                addNotification(`Purchase Deal ${savedRecord.purchaseId || nextId} created successfully`, 'success');
            }
            setShowModal(false);
        } catch (err) {
            console.error('Error saving Purchase Deal entry:', err);
            if (editingRecord) {
                const receivedQty = parseFloat(editingRecord.receivedQty) || 0;
                const pId = (editingRecord.purchaseId || '').replace(/-/g, '');
                const fallbackRecord = {
                    ...editingRecord,
                    ...formData,
                    purchaseId: pId,
                    qty: parseFloat(formData.qty) || 0,
                    rate: parseFloat(formData.rate) || 0,
                    receivedQty,
                    remainingQty: Math.max(0, (parseFloat(formData.qty) || 0) - receivedQty)
                };
                setRecords(prev => prev.map(r => r._id === editingRecord._id ? fallbackRecord : r));
                if (addNotification) {
                    addNotification(`Purchase Deal ${pId} updated locally`, 'success');
                }
                setShowModal(false);
                setEditingRecord(null);
                return;
            }
            const nextId = `LCP${String(records.length + 1).padStart(4, '0')}`;
            const fallbackRecord = {
                _id: Date.now().toString(),
                ...formData,
                purchaseId: nextId,
                qty: parseFloat(formData.qty) || 0,
                rate: parseFloat(formData.rate) || 0,
                receivedQty: 0,
                remainingQty: parseFloat(formData.qty) || 0,
                createdAt: new Date().toISOString()
            };
            setRecords(prev => [fallbackRecord, ...prev]);
            if (addNotification) {
                addNotification(`Purchase Deal ${nextId} created locally`, 'success');
            }
            setShowModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRecord = (recordOrId) => {
        const id = typeof recordOrId === 'object' && recordOrId ? recordOrId._id : recordOrId;
        const item = typeof recordOrId === 'object' && recordOrId ? recordOrId : records.find(r => r._id === id);
        const pId = item ? String(item.purchaseId || '').replace(/-/g, '') : '';
        setDeleteConfirmState({
            show: true,
            id,
            title: pId ? `Purchase Deal ${pId}` : 'this Purchase Deal entry'
        });
    };

    const handleConfirmDelete = async () => {
        const id = deleteConfirmState.id;
        if (!id) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/lc-purchases/${id}`);
            setRecords(prev => prev.filter(r => r._id !== id));
            queryClient.invalidateQueries({ queryKey: ['lcPurchases'] });
            if (addNotification) {
                addNotification('Purchase Deal entry deleted', 'info');
            }
        } catch (err) {
            console.error('Error deleting Purchase Deal:', err);
            setRecords(prev => prev.filter(r => r._id !== id));
        } finally {
            setDeleteConfirmState({ show: false, id: null, title: '' });
        }
    };

    const filteredRecords = useMemo(() => {
        let list = Array.isArray(records) ? [...records] : [];

        // Search query filter
        const q = (searchQuery || '').toLowerCase().trim();
        if (q) {
            list = list.filter(r => {
                const pId = (r.purchaseId || '').toLowerCase();
                const exp = (r.exporter || '').toLowerCase();
                const sup = (r.supplierName || '').toLowerCase();
                const prod = (r.productName || '').toLowerCase();
                const brand = (r.brand || '').toLowerCase();
                return pId.includes(q) || exp.includes(q) || sup.includes(q) || prod.includes(q) || brand.includes(q);
            });
        }

        // Date range filter
        if (filters.startDate) {
            list = list.filter(r => r.date >= filters.startDate);
        }
        if (filters.endDate) {
            list = list.filter(r => r.date <= filters.endDate);
        }

        // Exporter filter (multi-select)
        const expList = Array.isArray(filters.exporter) ? filters.exporter : (filters.exporter ? [filters.exporter] : []);
        if (expList.length > 0) {
            const expFilters = expList.map(e => e.toLowerCase().trim());
            list = list.filter(r => expFilters.includes((r.exporter || '').toLowerCase().trim()));
        }

        // Supplier filter (multi-select)
        const supList = Array.isArray(filters.supplierName) ? filters.supplierName : (filters.supplierName ? [filters.supplierName] : []);
        if (supList.length > 0) {
            const supFilters = supList.map(s => s.toLowerCase().trim());
            list = list.filter(r => supFilters.includes((r.supplierName || '').toLowerCase().trim()));
        }

        // Product filter (multi-select)
        const prodList = Array.isArray(filters.productName) ? filters.productName : (filters.productName ? [filters.productName] : []);
        if (prodList.length > 0) {
            const prodFilters = prodList.map(p => p.toLowerCase().trim());
            list = list.filter(r => prodFilters.includes((r.productName || '').toLowerCase().trim()));
        }

        // Brand filter (multi-select)
        const brandList = Array.isArray(filters.brand) ? filters.brand : (filters.brand ? [filters.brand] : []);
        if (brandList.length > 0) {
            const brandFilters = brandList.map(b => b.toLowerCase().trim());
            list = list.filter(r => brandFilters.includes((r.brand || '').toLowerCase().trim()));
        }

        // Status filter (Active, Not Completed, Completed)
        if (Array.isArray(filters.status) && !filters.status.includes('all')) {
            list = list.filter(r => {
                const pQty = parseFloat(r.qty) || 0;
                const rQty = parseFloat(r.receivedQty) || 0;
                const rem = Math.max(0, pQty - rQty);
                const st = getDealStatus(pQty, rem).status;
                return filters.status.includes(st);
            });
        }

        return list;
    }, [records, searchQuery, filters]);

    // Reset page to 1 on filter/search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters]);

    const requestSort = (key) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const sortedRecords = useMemo(() => {
        if (!sortConfig.key) return filteredRecords;
        return [...filteredRecords].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (sortConfig.key === 'date') {
                aVal = new Date(a.date || 0).getTime();
                bVal = new Date(b.date || 0).getTime();
            } else if (sortConfig.key === 'purchaseId') {
                aVal = String(a.purchaseId || '').replace(/-/g, '').toLowerCase();
                bVal = String(b.purchaseId || '').replace(/-/g, '').toLowerCase();
            } else if (sortConfig.key === 'exporter') {
                aVal = (a.exporter || '').toLowerCase();
                bVal = (b.exporter || '').toLowerCase();
            } else if (sortConfig.key === 'supplierName') {
                aVal = (a.supplierName || '').toLowerCase();
                bVal = (b.supplierName || '').toLowerCase();
            } else if (sortConfig.key === 'productName') {
                aVal = (a.productName || '').toLowerCase();
                bVal = (b.productName || '').toLowerCase();
            } else if (sortConfig.key === 'brand') {
                aVal = (a.brand || '').toLowerCase();
                bVal = (b.brand || '').toLowerCase();
            } else if (sortConfig.key === 'rate') {
                aVal = parseFloat(a.rate) || 0;
                bVal = parseFloat(b.rate) || 0;
            } else if (sortConfig.key === 'qty') {
                aVal = parseFloat(a.qty) || 0;
                bVal = parseFloat(b.qty) || 0;
            } else if (sortConfig.key === 'receivedQty') {
                aVal = parseFloat(a.receivedQty) || 0;
                bVal = parseFloat(b.receivedQty) || 0;
            } else if (sortConfig.key === 'remainingQty') {
                aVal = Math.max(0, (parseFloat(a.qty) || 0) - (parseFloat(a.receivedQty) || 0));
                bVal = Math.max(0, (parseFloat(b.qty) || 0) - (parseFloat(b.receivedQty) || 0));
            } else if (sortConfig.key === 'status') {
                const aRem = Math.max(0, (parseFloat(a.qty) || 0) - (parseFloat(a.receivedQty) || 0));
                const bRem = Math.max(0, (parseFloat(b.qty) || 0) - (parseFloat(b.receivedQty) || 0));
                const aStat = getDealStatus(parseFloat(a.qty) || 0, aRem).status;
                const bStat = getDealStatus(parseFloat(b.qty) || 0, bRem).status;
                aVal = aStat.toLowerCase();
                bVal = bStat.toLowerCase();
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRecords, sortConfig]);

    // Paginated records for table
    const paginatedRecords = useMemo(() => {
        if (pageSize === 'all' || Number(pageSize) >= ALL_PAGE_SIZE) {
            return sortedRecords;
        }
        const size = Number(pageSize) || 15;
        const start = (currentPage - 1) * size;
        return sortedRecords.slice(start, start + size);
    }, [sortedRecords, currentPage, pageSize]);


    const isFilterActive = (val) => Array.isArray(val) ? val.length > 0 && !val.includes('all') : Boolean(val);

    const hasActiveFilters = Boolean(
        filters.startDate ||
        filters.endDate ||
        (filters.quickRange && filters.quickRange !== 'all') ||
        isFilterActive(filters.supplierName) ||
        isFilterActive(filters.productName) ||
        isFilterActive(filters.brand) ||
        isFilterActive(filters.status)
    );

    const activeFilterCount = (
        (filters.startDate ? 1 : 0) +
        (filters.endDate ? 1 : 0) +
        (filters.quickRange && filters.quickRange !== 'all' && !filters.startDate && !filters.endDate ? 1 : 0) +
        (isFilterActive(filters.supplierName) ? 1 : 0) +
        (isFilterActive(filters.productName) ? 1 : 0) +
        (isFilterActive(filters.brand) ? 1 : 0) +
        (isFilterActive(filters.status) ? 1 : 0)
    );

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight text-center md:text-left">Purchase Deal</h2>
                </div>

                {/* Center Search (No Request button in LC Purchase) */}
                <div className="flex-1 w-full max-w-none md:max-w-xl mx-auto flex flex-col items-center gap-2">
                    <div className="w-full relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by purchase no, company, LC no..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full md:w-auto flex flex-row items-center justify-between md:justify-end gap-2">
                    {/* Advanced Filter Button & Dropdown Panel Container */}
                    <div className="relative flex-1 md:flex-none">
                        <button
                            ref={filterButtonRef}
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`w-full md:w-auto flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl transition-all border ${showFilterPanel || hasActiveFilters ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'} h-[42px] font-semibold text-xs sm:text-sm`}
                        >
                            <FunnelIcon className={`w-4 h-4 ${showFilterPanel || hasActiveFilters ? 'text-white' : 'text-gray-400'}`} />
                            <span>Filter</span>
                            {hasActiveFilters && (
                                <span className="flex items-center justify-center w-5 h-5 text-[11px] font-bold rounded-full bg-white text-blue-600 ml-0.5 shadow-sm">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Dropdown Panel */}
                        {showFilterPanel && (
                            <div
                                ref={filterPanelRef}
                                className="fixed inset-x-4 top-[140px] md:absolute md:inset-auto md:right-0 md:mt-3 md:top-auto w-auto md:w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[60] p-5 opacity-100 scale-100 transform transform-gpu transition-all duration-200 ease-out origin-top-right text-left max-h-[85vh] overflow-y-auto"
                            >
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                            <FunnelIcon className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-[15px]">Filter Purchase Deals</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                onClick={resetFilters}
                                                className="text-[12px] font-bold text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 bg-gray-50 hover:bg-blue-50 rounded-md"
                                            >
                                                Reset All
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setShowFilterPanel(false)}
                                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Status Filter */}
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Status</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                { label: 'All', value: 'all', activeCls: 'bg-gray-800 text-white shadow-md shadow-gray-700/30 font-bold', inactiveCls: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
                                                { label: 'Active', value: 'Active', dot: 'bg-emerald-500', activeCls: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 font-bold', inactiveCls: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100' },
                                                { label: 'Not Completed', value: 'Not Completed', dot: 'bg-amber-500', activeCls: 'bg-amber-500 text-white shadow-md shadow-amber-500/30 font-bold', inactiveCls: 'bg-amber-50 text-amber-700 border border-amber-200/60 hover:bg-amber-100' },
                                                { label: 'Completed', value: 'Completed', dot: 'bg-blue-500', activeCls: 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-bold', inactiveCls: 'bg-blue-50 text-blue-700 border border-blue-200/60 hover:bg-blue-100' }
                                            ].map((opt) => {
                                                const currentStatusList = Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : ['all']);
                                                const isSelected = currentStatusList.includes(opt.value);
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => handleStatusToggle(opt.value)}
                                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${isSelected ? opt.activeCls : opt.inactiveCls}`}
                                                    >
                                                        {opt.dot && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : opt.dot}`} />}
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Quick Range */}
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Quick Range</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['all', 'today', 'weekly', 'monthly', 'yearly'].map(range => (
                                                <button
                                                    key={range}
                                                    type="button"
                                                    onClick={() => handleQuickRange(range)}
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all capitalize ${filters.quickRange === range ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                >
                                                    {range}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Date Range with CustomDatePicker */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Start Date</label>
                                            <CustomDatePicker
                                                value={filters.startDate}
                                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                                                compact
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">End Date</label>
                                            <CustomDatePicker
                                                value={filters.endDate}
                                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                                                compact
                                                rightAlign={true}
                                            />
                                        </div>
                                    </div>

                                    {/* Supplier Filter */}
                                    <SearchableFilterSelect
                                        label="Supplier"
                                        value={filters.supplierName}
                                        onChange={(val) => handleFilterChange('supplierName', val)}
                                        options={uniqueSuppliers}
                                        placeholder="All Suppliers"
                                    />

                                    {/* Product & Brand Filters Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <SearchableFilterSelect
                                            label="Product"
                                            value={filters.productName}
                                            onChange={(val) => handleFilterChange('productName', val)}
                                            options={uniqueProducts}
                                            placeholder="All Products"
                                        />

                                        <SearchableFilterSelect
                                            label="Brand"
                                            value={filters.brand}
                                            onChange={(val) => handleFilterChange('brand', val)}
                                            options={uniqueBrands}
                                            placeholder="All Brands"
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowFilterPanel(false)}
                                        className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                                    >
                                        Apply Filters
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Report Button */}
                    <button
                        type="button"
                        onClick={() => setShowReportModal(true)}
                        className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px] font-semibold text-xs sm:text-sm"
                    >
                        <BarChartIcon className="w-4 h-4 text-blue-600" />
                        <span>Report</span>
                    </button>

                    {/* Add Purchase Deal Button */}
                    {canAdd && (
                        <button
                            type="button"
                            onClick={handleOpenModal}
                            className="flex-1 md:flex-none w-full md:w-auto justify-center px-2.5 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-[42px] whitespace-nowrap"
                        >
                            <PlusIcon className="w-4 h-4 shrink-0" /> <span>Add Purchase Deal</span>
                        </button>
                    )}
                </div>
            </div>


            {/* LC Purchases Data Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Desktop Table View */}
                <div ref={tableContainerRef} className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/80">
                                <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Sl</th>
                                <th onClick={() => requestSort('date')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center">
                                        <span>Date</span>
                                        <SortIndicator sortKey="date" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('purchaseId')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center">
                                        <span>Pur. ID</span>
                                        <SortIndicator sortKey="purchaseId" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('supplierName')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center">
                                        <span>Supplier</span>
                                        <SortIndicator sortKey="supplierName" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('productName')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center">
                                        <span>Product</span>
                                        <SortIndicator sortKey="productName" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('brand')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center">
                                        <span>Brand</span>
                                        <SortIndicator sortKey="brand" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('rate')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center justify-end">
                                        <span>Pur. Rate</span>
                                        <SortIndicator sortKey="rate" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="right" />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('qty')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center justify-center">
                                        <span>Pur. Truck / KG</span>
                                        <SortIndicator sortKey="qty" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="center" />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('receivedQty')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center justify-center">
                                        <span>Receive Truck / KG</span>
                                        <SortIndicator sortKey="receivedQty" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="center" />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('remainingQty')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center justify-center">
                                        <span>Remaining</span>
                                        <SortIndicator sortKey="remainingQty" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="center" />
                                    </div>
                                </th>
                                <th onClick={() => requestSort('status')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                    <div className="flex items-center justify-center">
                                        <span>Status</span>
                                        <SortIndicator sortKey="status" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="center" />
                                    </div>
                                </th>
                                <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-12 text-center text-gray-400 font-medium text-sm whitespace-nowrap">
                                        Loading Purchase Deal records...
                                    </td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-6 py-16 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <BoxIcon className="w-10 h-10 text-gray-300 stroke-1" />
                                            <span className="font-semibold text-gray-500">No Purchase Deal records found</span>
                                            <span className="text-xs text-gray-400">Click &ldquo;+ Add Purchase Deal&rdquo; above to create a new record</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecords.map((item, idx) => {
                                    const isAll = pageSize === 'all' || Number(pageSize) >= ALL_PAGE_SIZE;
                                    const sl = (isAll ? 0 : (currentPage - 1) * (Number(pageSize) || 15)) + idx + 1;
                                    const purchaseQty = parseFloat(item.qty) || 0;
                                    const receiveQty = parseFloat(item.receivedQty) || 0;
                                    const remaining = Math.max(0, purchaseQty - receiveQty);
                                    const unitLabel = item.uom === 'Truck' ? 'Trucks' : 'KG';
                                    const dealStatus = getDealStatus(purchaseQty, remaining);

                                    return (
                                        <tr key={item._id || idx} className="hover:bg-blue-50/40 transition-colors">
                                            <td className="px-4 py-3.5 text-xs font-bold text-gray-400 text-center whitespace-nowrap">{sl}</td>
                                            <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">{formatDate(item.date)}</td>
                                            <td className="px-4 py-3.5 text-sm font-black whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewData(item);
                                                        fetchDealReceives();
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-black"
                                                    title="View Deal Details"
                                                >
                                                    {(item.purchaseId || '').replace(/-/g, '') || '—'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3.5 text-sm font-semibold text-gray-800 whitespace-nowrap">{item.supplierName || '—'}</td>
                                            <td className="px-4 py-3.5 text-sm font-bold text-gray-900 whitespace-nowrap">{item.productName || '—'}</td>
                                            <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">{item.brand || '—'}</td>
                                            <td className="px-4 py-3.5 text-sm font-bold text-gray-900 text-right whitespace-nowrap">৳{Number(item.rate || 0).toLocaleString('en-IN')}/kg</td>
                                            <td className="px-4 py-3.5 text-sm font-bold text-gray-800 text-center whitespace-nowrap">
                                                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs inline-block whitespace-nowrap">
                                                    {purchaseQty.toLocaleString('en-IN')} {unitLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-sm font-bold text-gray-800 text-center whitespace-nowrap">
                                                <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 font-bold text-xs inline-block whitespace-nowrap">
                                                    {receiveQty.toLocaleString('en-IN')} {unitLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-sm font-bold text-center whitespace-nowrap">
                                                <span className={`px-2.5 py-1 rounded-lg font-bold text-xs inline-block whitespace-nowrap ${
                                                    remaining === 0
                                                        ? 'bg-gray-100 text-gray-500'
                                                        : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                    {remaining.toLocaleString('en-IN')} {unitLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${dealStatus.badgeClass} whitespace-nowrap`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${dealStatus.dotClass}`} />
                                                    {dealStatus.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setViewData(item);
                                                            fetchDealReceives();
                                                        }}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="View Deal Details"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                    </button>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEditRecord(item)}
                                                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit Deal"
                                                        >
                                                            <EditIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteRecord(item._id)}
                                                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Delete Entry"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>


                    </table>
                </div>

                {/* Mobile Card View (< 768px) */}
                <div className="block md:hidden px-3 py-3 space-y-3">
                    {isLoading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="animate-pulse bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                                <div className="h-6 bg-gray-200 rounded w-full"></div>
                                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        ))
                    ) : filteredRecords.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <BoxIcon className="w-10 h-10 text-gray-300 stroke-1" />
                                <span className="font-semibold text-gray-500">No Purchase Deal records found</span>
                                <span className="text-xs text-gray-400">Click &ldquo;+ Add Purchase Deal&rdquo; above to create a new record</span>
                            </div>
                        </div>
                    ) : (
                        paginatedRecords.map((item, idx) => {
                            const isAll = pageSize === 'all' || Number(pageSize) >= ALL_PAGE_SIZE;
                            const sl = (isAll ? 0 : (currentPage - 1) * (Number(pageSize) || 15)) + idx + 1;
                            const purchaseQty = parseFloat(item.qty) || 0;
                            const receiveQty = parseFloat(item.receivedQty) || 0;
                            const remaining = Math.max(0, purchaseQty - receiveQty);
                            const unitLabel = item.uom === 'Truck' ? 'Trucks' : 'KG';
                            const dealStatus = getDealStatus(purchaseQty, remaining);
                            const isExpanded = expandedMobileRows.includes(item._id || idx);

                            return (
                                <div
                                    key={item._id || idx}
                                    onClick={() => toggleMobileRowExpansion(item._id || idx)}
                                    className={`bg-white border rounded-2xl overflow-hidden shadow-2xs select-none transition-all duration-200 cursor-pointer ${
                                        isExpanded ? 'border-blue-200 ring-2 ring-blue-500/10 shadow-md' : 'border-gray-200/80 hover:border-gray-300'
                                    }`}
                                >
                                    {/* Card Header (Always Visible) */}
                                    <div className={`bg-gray-50/70 px-3.5 py-2.5 flex flex-col gap-1.5 transition-colors ${isExpanded ? 'border-b border-gray-100 bg-blue-50/20' : ''}`}>
                                        {/* Line 1: #{sl} & Pur. ID on left, Date on right */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                    #{sl}
                                                </span>
                                                <span className="text-xs font-black text-blue-600 truncate">
                                                    {(item.purchaseId || '').replace(/-/g, '') || '—'}
                                                </span>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="text-xs font-semibold text-gray-400 tracking-wider">
                                                    {formatDate(item.date)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Line 2: Supplier on left, Status Badge on right */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="font-black text-gray-900 text-sm tracking-tight truncate">
                                                    {item.supplierName || '—'}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${dealStatus.badgeClass}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${dealStatus.dotClass}`} />
                                                    {dealStatus.status}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Line 3: Product & Brand on left, Rate on right */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <span className="text-xs font-semibold text-gray-600 truncate block">
                                                    {item.productName || '—'}{item.brand ? ` • ${item.brand}` : ''}
                                                </span>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="text-xs font-bold text-gray-900">
                                                    ৳{Number(item.rate || 0).toLocaleString('en-IN')}/kg
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body (Expanded View) */}
                                    {isExpanded && (
                                        <div className="p-3.5 space-y-3 animate-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                                            {/* Quantities Progression Grid */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="bg-blue-50/60 border border-blue-100/70 rounded-xl p-2.5 text-center">
                                                    <span className="text-[10px] font-bold text-blue-600/80 uppercase block">Pur. Qty</span>
                                                    <span className="text-xs font-black text-blue-800 block mt-0.5">
                                                        {purchaseQty.toLocaleString('en-IN')} {unitLabel}
                                                    </span>
                                                </div>
                                                <div className="bg-green-50/60 border border-green-100/70 rounded-xl p-2.5 text-center">
                                                    <span className="text-[10px] font-bold text-green-600/80 uppercase block">Received</span>
                                                    <span className="text-xs font-black text-green-800 block mt-0.5">
                                                        {receiveQty.toLocaleString('en-IN')} {unitLabel}
                                                    </span>
                                                </div>
                                                <div className={`rounded-xl p-2.5 text-center border ${
                                                    remaining === 0
                                                        ? 'bg-gray-50 border-gray-200/60'
                                                        : 'bg-amber-50/60 border-amber-100/70'
                                                }`}>
                                                    <span className={`text-[10px] font-bold uppercase block ${
                                                        remaining === 0 ? 'text-gray-500' : 'text-amber-600/80'
                                                    }`}>Remaining</span>
                                                    <span className={`text-xs font-black block mt-0.5 ${
                                                        remaining === 0 ? 'text-gray-600' : 'text-amber-800'
                                                    }`}>
                                                        {remaining.toLocaleString('en-IN')} {unitLabel}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Extra details (Truck No / Vehicle, Notes) */}
                                            {(item.truckNo || item.remarks || item.notes) && (
                                                <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3 text-xs space-y-1.5">
                                                    {item.truckNo && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-500 font-medium">Truck No / Vehicle:</span>
                                                            <span className="font-bold text-gray-800 text-right">{item.truckNo}</span>
                                                        </div>
                                                    )}
                                                    {(item.remarks || item.notes) && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-500 font-medium">Note:</span>
                                                            <span className="font-semibold text-gray-700 text-right">{item.remarks || item.notes}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Action Buttons Toolbar */}
                                            <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-2.5 w-full" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewData(item);
                                                        fetchDealReceives();
                                                    }}
                                                    className="flex-1 max-w-[80px] h-9 flex items-center justify-center text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-100 rounded-xl transition-colors shadow-2xs"
                                                    title="View Deal Details"
                                                >
                                                    <EyeIcon className="w-4.5 h-4.5" />
                                                </button>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditRecord(item)}
                                                        className="flex-1 max-w-[80px] h-9 flex items-center justify-center text-blue-600 bg-blue-50/80 hover:bg-blue-100 border border-blue-100 rounded-xl transition-colors shadow-2xs"
                                                        title="Edit Deal"
                                                    >
                                                        <EditIcon className="w-4.5 h-4.5" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRecord(item._id)}
                                                        className="flex-1 max-w-[80px] h-9 flex items-center justify-center text-rose-500 bg-rose-50/80 hover:bg-rose-100 border border-rose-100 rounded-xl transition-colors shadow-2xs"
                                                        title="Delete Entry"
                                                    >
                                                        <TrashIcon className="w-4.5 h-4.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Table Footer with Pagination Controls & Horizontal Scroll Arrows */}
                {filteredRecords.length > 0 && (
                    <PaginationBar
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredRecords.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        pageSizeOptions={['all', 15, 30, 50, 100]}
                        tableContainerRef={tableContainerRef}
                    />
                )}
            </div>

            {/* Entry Card Modal: Date, Supplier Name, Product, Brand, Purchase Rate, Purchase Qty (Truck or Qty) */}
            {showModal && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setShowModal(false); setEditingRecord(null); }} />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 border border-gray-100 relative z-10 animate-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <BoxIcon className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">
                                    {editingRecord ? `Edit Purchase Deal (${(editingRecord.purchaseId || '').replace(/-/g, '')})` : 'New Purchase Deal Entry'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowModal(false); setEditingRecord(null); }}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleFormSubmit} className="space-y-5">
                            {/* Row 1: Date & Supplier Name */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative font-sans [&_.date-picker-input]:h-[42px] [&_.date-picker-input]:py-2.5 [&_.date-picker-input]:px-3.5 [&_.date-picker-input]:rounded-xl [&_.date-picker-input]:text-sm [&_.date-picker-input]:font-semibold [&_.date-picker-container>label]:mb-1">
                                    <CustomDatePicker
                                        label="Date"
                                        labelClassName="text-xs font-bold text-gray-600 uppercase mb-1 block"
                                        name="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        compact={false}
                                        required
                                    />
                                </div>

                                <div className="relative font-sans">
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Supplier Name</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.supplierName}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, supplierName: val });
                                                setSupplierSearch(val);
                                                setIsSupplierDropdownOpen(true);
                                            }}
                                            onFocus={() => {
                                                setSupplierSearch(formData.supplierName || '');
                                                setIsSupplierDropdownOpen(true);
                                            }}
                                            placeholder="Select or enter Supplier Name"
                                            required
                                            className="w-full h-[42px] px-3.5 py-2.5 pr-14 border border-gray-200 rounded-xl text-sm font-semibold outline-none transition-all bg-white text-gray-900 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {formData.supplierName && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData(prev => ({ ...prev, supplierName: '' }));
                                                        setSupplierSearch('');
                                                    }}
                                                    className="p-0.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                                    title="Clear Supplier"
                                                >
                                                    <XIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {isSupplierDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsSupplierDropdownOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                {filteredSuppliers.length > 0 ? (
                                                    filteredSuppliers.map((s, sIdx) => {
                                                        const sName = s.name || s.companyName || s.customerName || '';
                                                        return (
                                                            <button
                                                                key={s._id || sIdx}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, supplierName: sName });
                                                                    setSupplierSearch('');
                                                                    setIsSupplierDropdownOpen(false);
                                                                }}
                                                                className={`w-full px-4 py-2.5 text-left text-sm font-semibold hover:bg-blue-50/80 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between ${
                                                                    formData.supplierName === sName ? 'bg-blue-50/60 text-blue-600' : 'text-gray-800'
                                                                }`}
                                                            >
                                                                <span>{sName}</span>
                                                                {s.contactPerson && (
                                                                    <span className="text-[11px] font-normal text-gray-400">
                                                                        {s.contactPerson} {s.phone ? `(${s.phone})` : ''}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">
                                                        {supplierSearch
                                                            ? `Press Enter to use "${supplierSearch}"`
                                                            : 'No suppliers found. Enter custom supplier name.'}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Row 3: Product & Brand */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative font-sans">
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Product</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.productName}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, productName: val, brand: '' });
                                                setProductSearch(val);
                                                setIsProductDropdownOpen(true);
                                            }}
                                            onFocus={() => {
                                                setProductSearch(formData.productName || '');
                                                setIsProductDropdownOpen(true);
                                            }}
                                            placeholder="Select or enter Product"
                                            required
                                            className="w-full h-[42px] px-3.5 py-2.5 pr-14 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {formData.productName && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData(prev => ({ ...prev, productName: '', brand: '' }));
                                                        setProductSearch('');
                                                        setBrandSearch('');
                                                    }}
                                                    className="p-0.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                                    title="Clear Product"
                                                >
                                                    <XIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {isProductDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsProductDropdownOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                {filteredProducts.length > 0 ? (
                                                    filteredProducts.map((p, pIdx) => {
                                                        const pName = p.productName || p.name || '';
                                                        return (
                                                            <button
                                                                key={p._id || pIdx}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFormData({ ...formData, productName: pName, brand: '' });
                                                                    setIsProductDropdownOpen(false);
                                                                }}
                                                                className="w-full px-4 py-2 text-left text-sm font-semibold hover:bg-blue-50/80 text-gray-800 transition-colors border-b border-gray-50 last:border-0"
                                                            >
                                                                {pName}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">
                                                        No matching products found
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="relative font-sans">
                                    <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Brand</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={formData.brand}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, brand: val });
                                                setBrandSearch(val);
                                                setIsBrandDropdownOpen(true);
                                            }}
                                            onFocus={() => {
                                                setBrandSearch(formData.brand || '');
                                                setIsBrandDropdownOpen(true);
                                            }}
                                            placeholder={formData.productName ? 'Select or enter Brand' : 'Select Product first'}
                                            className="w-full h-[42px] px-3.5 py-2.5 pr-14 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {formData.brand && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData(prev => ({ ...prev, brand: '' }));
                                                        setBrandSearch('');
                                                    }}
                                                    className="p-0.5 text-gray-400 hover:text-red-500 rounded-full transition-colors"
                                                    title="Clear Brand"
                                                >
                                                    <XIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isBrandDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {isBrandDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsBrandDropdownOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in fade-in duration-150">
                                                {filteredBrands.length > 0 ? (
                                                    filteredBrands.map((b, bIdx) => (
                                                        <button
                                                            key={bIdx}
                                                            type="button"
                                                            onClick={() => {
                                                                setFormData({ ...formData, brand: b });
                                                                setIsBrandDropdownOpen(false);
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-sm font-semibold hover:bg-blue-50/80 text-gray-800 transition-colors border-b border-gray-50 last:border-0"
                                                        >
                                                            {b}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">
                                                        {formData.productName ? 'Enter custom brand' : 'Select Product first'}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Row 4: Purchase Rate & Purchase Qty (Truck or Qty) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center justify-between h-7 mb-1">
                                        <label className="text-xs font-bold text-gray-600 uppercase">
                                            Purchase Rate (৳ / KG)
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.rate}
                                        onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                                        placeholder="0.00"
                                        required
                                        className="w-full h-[42px] px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between h-7 mb-1">
                                        <label className="text-xs font-bold text-gray-600 uppercase">
                                            Purchase Qty
                                        </label>
                                        {/* Truck or Qty toggle */}
                                        <div className="inline-flex rounded-lg p-0.5 bg-gray-100 border border-gray-200 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, uom: 'Truck' }))}
                                                className={`px-2.5 py-0.5 rounded-md font-bold transition-all ${formData.uom === 'Truck' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                            >
                                                Truck
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, uom: 'QTY' }))}
                                                className={`px-2.5 py-0.5 rounded-md font-bold transition-all ${formData.uom === 'QTY' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                            >
                                                Qty (KG)
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.qty}
                                            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                                            placeholder={formData.uom === 'Truck' ? 'Enter number of trucks' : 'Enter quantity in KG'}
                                            required
                                            className="w-full h-[42px] px-3.5 py-2.5 pr-14 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                                            {formData.uom === 'Truck' ? 'Trucks' : 'KG'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-center gap-3 pt-5 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setEditingRecord(null); }}
                                    className="min-w-[120px] px-6 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors text-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="min-w-[120px] px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm active:scale-95 text-center"
                                >
                                    {isSubmitting ? (editingRecord ? 'Updating...' : 'Saving...') : (editingRecord ? 'Update Deal' : 'Save Entry')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* View Detail Modal */}
            {viewData && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewData(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto z-10 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        {(() => {
                            const dealId = String(viewData._id || '');
                            const cleanPId = String(viewData.purchaseId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

                            const matchingReceives = dealReceivesList.filter(rec => {
                                if (!rec) return false;
                                const recDealRef = String(rec.dealRefId || '');
                                if (dealId && recDealRef && recDealRef === dealId) return true;
                                const recPId = String(rec.purchaseId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                if (cleanPId && recPId && recPId === cleanPId) return true;
                                return false;
                            });

                            const totalReceivedFromEntries = matchingReceives.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0);
                            const totalTrucksFromEntries = matchingReceives.reduce((sum, r) => {
                                const tCount = parseFloat(r.trucks) || (Array.isArray(r.truckNumbers) && r.truckNumbers.length ? r.truckNumbers.length : 1);
                                return sum + tCount;
                            }, 0);

                            const purchaseQty = parseFloat(viewData.qty) || 0;
                            const unitLabel = viewData.uom === 'Truck' ? 'Trucks' : 'KG';
                            const receiveQty = viewData.receivedQty !== undefined && parseFloat(viewData.receivedQty) > 0
                                ? parseFloat(viewData.receivedQty)
                                : (viewData.uom === 'Truck' ? totalTrucksFromEntries : totalReceivedFromEntries);
                            const remaining = Math.max(0, purchaseQty - receiveQty);
                            const dealStatus = getDealStatus(purchaseQty, remaining);

                            // Match Deal Receive to LC Receive via Cost of Goods
                            const getLcReceiveInfoForDealReceive = (rec) => {
                                if (!rec) return { lcReceiveDate: null, status: null, matchedCog: null, matchedStock: null };
                                const recReceiveId = String(rec.receiveId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                const recId = String(rec._id || '').trim();
                                const recInvoice = String(rec.invoiceNo || '').trim().toLowerCase();
                                const recProduct = String(rec.product || rec.productName || '').trim().toLowerCase();
                                const recBrand = String(rec.brand || '').trim().toLowerCase();

                                // 1. Match Cost of Goods entry for this Deal Receive
                                const matchedCog = (costOfGoodsList || []).find(cog => {
                                    const cogDrId = String(cog.dealReceiveId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                    const cogDrRef = String(cog.dealReceiveRefId || '').trim();
                                    if (recReceiveId && cogDrId && cogDrId === recReceiveId) return true;
                                    if (recId && cogDrRef && cogDrRef === recId) return true;
                                    if (recId && cogDrId && cogDrId === recId) return true;
                                    return false;
                                }) || (recInvoice ? (costOfGoodsList || []).find(cog => {
                                    const cogInv = String(cog.invoiceNo || '').trim().toLowerCase();
                                    const cogProd = String(cog.product || '').trim().toLowerCase();
                                    return cogInv && cogInv === recInvoice && (!recProduct || !cogProd || recProduct === cogProd);
                                }) : null);

                                if (!matchedCog) return { lcReceiveDate: null, status: null, matchedCog: null, matchedStock: null };

                                // 2. Match LC Receive (Stock) entry using the COG entry
                                const cogIdStr = String(matchedCog._id || '');
                                const targetLc = String(matchedCog.lcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                const targetInv = String(matchedCog.invoiceNo || rec.invoiceNo || '').trim().toLowerCase();
                                const targetProd = String(matchedCog.product || recProduct || '').trim().toLowerCase();
                                const targetBrand = String(matchedCog.brand || recBrand || '').trim().toLowerCase();
                                const targetTruck = String(matchedCog.truckNo || rec.truckNo || '').trim().toLowerCase();

                                const matchedStock = (stockList || []).find(st => {
                                    if (st.matchedCogId && String(st.matchedCogId) === cogIdStr) return true;
                                    const stLc = String(st.lcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                    const stInv = String(st.invoiceNo || '').trim().toLowerCase();
                                    const stProd = String(st.productName || st.product || '').trim().toLowerCase();
                                    const stBrand = String(st.brand || '').trim().toLowerCase();

                                    const lcMatches = targetLc && stLc && targetLc === stLc;
                                    const invMatches = targetInv && stInv && targetInv === stInv;
                                    if (lcMatches && invMatches) {
                                        const prodMatches = !targetProd || !stProd || targetProd === stProd;
                                        const brandMatches = !targetBrand || !stBrand || targetBrand === stBrand;
                                        return prodMatches && brandMatches;
                                    }
                                    return false;
                                }) || (stockList || []).find(st => {
                                    const stLc = String(st.lcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                    const stInv = String(st.invoiceNo || '').trim().toLowerCase();
                                    return targetLc && stLc && targetLc === stLc && targetInv && stInv && targetInv === stInv;
                                }) || (stockList || []).find(st => {
                                    const stLc = String(st.lcNo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                    const stTruck = String(st.truckNo || '').trim().toLowerCase();
                                    return targetLc && stLc && targetLc === stLc && targetTruck && stTruck && targetTruck === stTruck;
                                });

                                if (!matchedStock) return { lcReceiveDate: null, status: null, matchedCog, matchedStock: null };

                                const lcReceiveDate = matchedStock.date || matchedStock.receivedDate || (Array.isArray(matchedStock.entries) ? matchedStock.entries[0]?.date : null) || null;
                                const status = matchedStock.status || (Array.isArray(matchedStock.entries) ? matchedStock.entries[0]?.status : null) || 'In Stock';

                                return {
                                    lcReceiveDate,
                                    status,
                                    matchedCog,
                                    matchedStock
                                };
                            };

                            const getStockStatusBadge = (status) => {
                                if (!status) return null;
                                const s = String(status).toLowerCase();
                                if (s.includes('stock') || s.includes('accept') || s.includes('received')) {
                                    return {
                                        text: 'Received',
                                        badgeClass: 'bg-green-50 text-green-700 border-green-200/60',
                                        dotClass: 'bg-green-500'
                                    };
                                }
                                if (s.includes('request') || s.includes('pending')) {
                                    return {
                                        text: status,
                                        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
                                        dotClass: 'bg-amber-500'
                                    };
                                }
                                if (s.includes('reject')) {
                                    return {
                                        text: status,
                                        badgeClass: 'bg-red-50 text-red-700 border-red-200/60',
                                        dotClass: 'bg-red-500'
                                    };
                                }
                                return {
                                    text: status === 'In Stock' ? 'Received' : status,
                                    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
                                    dotClass: 'bg-blue-500'
                                };
                            };

                            return (
                                <>
                                    {/* Modal Header */}
                                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/70 via-white to-gray-50/40">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 font-black">
                                                <EyeIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-gray-900 tracking-tight">Purchase Deal Details</h3>
                                                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                                                    {(viewData.purchaseId || '').replace(/-/g, '') || '—'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${dealStatus.badgeClass}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${dealStatus.dotClass}`} />
                                                {dealStatus.status}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setViewData(null)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            >
                                                <XIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Modal Body */}
                                    <div className="p-6 space-y-5">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Date</span>
                                                <span className="text-sm font-semibold text-gray-800">{formatDate(viewData.date)}</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Purchase ID</span>
                                                <span className="text-sm font-bold text-blue-600">{(viewData.purchaseId || '').replace(/-/g, '') || '—'}</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Purchase Rate</span>
                                                <span className="text-sm font-bold text-gray-900">৳{Number(viewData.rate || 0).toLocaleString('en-IN')}/kg</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Supplier</span>
                                                <span className="text-sm font-semibold text-gray-800">{viewData.supplierName || '—'}</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Product</span>
                                                <span className="text-sm font-bold text-gray-900">{viewData.productName || '—'}</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Brand</span>
                                                <span className="text-sm font-semibold text-gray-800">{viewData.brand || '—'}</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Deal Unit (UOM)</span>
                                                <span className="text-sm font-bold text-gray-800">{unitLabel}</span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Truck No / Vehicle</span>
                                                <span className="text-sm font-semibold text-gray-800">{viewData.truckNo || '—'}</span>
                                            </div>
                                        </div>

                                        {/* Deal Quantities Progression Card */}
                                        <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 space-y-3">
                                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                                                Quantity Summary
                                            </span>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-white rounded-xl p-3 border border-blue-100 shadow-xs">
                                                    <span className="text-[10px] font-bold text-blue-600 uppercase block">Purchased</span>
                                                    <span className="text-sm font-black text-blue-700">
                                                        {purchaseQty.toLocaleString('en-IN')} {unitLabel}
                                                    </span>
                                                </div>
                                                <div className="bg-white rounded-xl p-3 border border-green-100 shadow-xs">
                                                    <span className="text-[10px] font-bold text-green-600 uppercase block">Received</span>
                                                    <span className="text-sm font-black text-green-700">
                                                        {receiveQty.toLocaleString('en-IN')} {unitLabel}
                                                    </span>
                                                </div>
                                                <div className="bg-white rounded-xl p-3 border border-amber-100 shadow-xs">
                                                    <span className="text-[10px] font-bold text-amber-600 uppercase block">Remaining</span>
                                                    <span className="text-sm font-black text-amber-700">
                                                        {remaining.toLocaleString('en-IN')} {unitLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Deal Receives Recorded Against This Purchase Deal */}
                                        <div className="space-y-3 pt-1">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                        Deal Receives Against This Purchase Deal
                                                    </h4>
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200/60">
                                                        {matchingReceives.length} {matchingReceives.length === 1 ? 'Entry' : 'Entries'}
                                                    </span>
                                                </div>
                                                {matchingReceives.length > 0 && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-gray-500 font-medium">Total Received:</span>
                                                        <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-black text-xs border border-green-200/60">
                                                            {totalReceivedFromEntries.toLocaleString('en-IN')} KG
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200/60">
                                                            {totalTrucksFromEntries} {totalTrucksFromEntries === 1 ? 'Truck' : 'Trucks'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {matchingReceives.length === 0 ? (
                                                <div className="bg-gray-50/70 rounded-xl p-6 text-center border border-dashed border-gray-200 text-gray-400 space-y-1">
                                                    <p className="text-xs font-semibold text-gray-500">No deal receives recorded against this purchase deal yet.</p>
                                                    <p className="text-[11px] text-gray-400">
                                                        Entries created under &ldquo;Deal Receive&rdquo; with Purchase ID <span className="font-bold text-blue-600">{(viewData.purchaseId || '').replace(/-/g, '')}</span> will automatically appear here.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead>
                                                                <tr className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                                                    <th className="px-3.5 py-2.5 text-center whitespace-nowrap">#</th>
                                                                    <th className="px-3.5 py-2.5 whitespace-nowrap">Date</th>
                                                                    <th className="px-3.5 py-2.5 whitespace-nowrap">Receive ID</th>
                                                                    <th className="px-3.5 py-2.5 whitespace-nowrap">Invoice No</th>
                                                                    <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Trucks</th>
                                                                    <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Received Qty</th>
                                                                    <th className="px-3.5 py-2.5 whitespace-nowrap">Truck No</th>
                                                                    <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Costing/kg</th>
                                                                    <th className="px-3.5 py-2.5 whitespace-nowrap">LC Rec. Date</th>
                                                                    <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100 text-xs">
                                                                {matchingReceives.map((rec, rIdx) => {
                                                                    const rQty = parseFloat(rec.quantity) || 0;
                                                                    const rCost = parseFloat(rec.costingKg) || 0;
                                                                    const rTruckCount = parseFloat(rec.trucks) || (Array.isArray(rec.truckNumbers) && rec.truckNumbers.length ? rec.truckNumbers.length : 1);

                                                                    let rTruckNo = rec.truckNo || '';
                                                                    if (Array.isArray(rec.truckNumbers) && rec.truckNumbers.length > 0) {
                                                                        const validTrucks = rec.truckNumbers.filter(t => t && String(t).trim());
                                                                        if (validTrucks.length > 0) {
                                                                            rTruckNo = validTrucks.join(', ');
                                                                        }
                                                                    }
                                                                    if (!rTruckNo) rTruckNo = '—';

                                                                    const lcInfo = getLcReceiveInfoForDealReceive(rec);
                                                                    const statusBadge = getStockStatusBadge(lcInfo.status);

                                                                    return (
                                                                        <tr key={rec._id || rIdx} className="hover:bg-blue-50/30 transition-colors">
                                                                            <td className="px-3.5 py-2.5 text-center text-gray-400 font-bold whitespace-nowrap">
                                                                                {rIdx + 1}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 font-semibold text-gray-700 whitespace-nowrap">
                                                                                {formatDate(rec.date)}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 font-bold text-blue-600 whitespace-nowrap">
                                                                                {rec.receiveId || `DR${String(rIdx + 1).padStart(4, '0')}`}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 font-semibold text-gray-800 whitespace-nowrap">
                                                                                {rec.invoiceNo || '—'}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200/60">
                                                                                    {rTruckCount} {rTruckCount === 1 ? 'Truck' : 'Trucks'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                                                <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-bold text-[11px] border border-green-200/60">
                                                                                    {rQty.toLocaleString('en-IN')} KG
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 font-semibold text-gray-700 whitespace-nowrap">
                                                                                {rTruckNo}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">
                                                                                {rCost ? `${rCost.toFixed(2)} BDT` : '—'}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 font-semibold text-gray-700 whitespace-nowrap">
                                                                                {lcInfo.lcReceiveDate ? formatDate(lcInfo.lcReceiveDate) : '—'}
                                                                            </td>
                                                                            <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                                                                                {statusBadge ? (
                                                                                    <span
                                                                                        title={lcInfo.matchedCog?.lcNo ? `LC: ${lcInfo.matchedCog.lcNo}` : ''}
                                                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.badgeClass} whitespace-nowrap`}
                                                                                    >
                                                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
                                                                                        {statusBadge.text}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-gray-400 font-medium">—</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Additional Details */}
                                        {viewData.remarks && (
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Remarks</span>
                                                <p className="text-xs font-medium text-gray-700 mt-1 whitespace-pre-wrap">{viewData.remarks}</p>
                                            </div>
                                        )}

                                        {canShowEntryBy && (
                                            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                                                <span>Created By: <strong className="text-gray-600">{viewData.createdBy || 'Admin'}</strong></span>
                                                {viewData.createdAt && (
                                                    <span>Created: {formatDate(viewData.createdAt)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Modal Actions */}
                                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/40">
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const deal = viewData;
                                                    setViewData(null);
                                                    handleEditRecord(deal);
                                                }}
                                                className="px-5 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                                            >
                                                <EditIcon className="w-3.5 h-3.5" />
                                                Edit Deal
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setViewData(null)}
                                            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white font-bold text-xs hover:bg-gray-800 transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>,
                document.body
            )}
        {/* Purchase Deal Report Modal */}
            <PurchaseDealReport
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                deals={records}
                dealReceives={dealReceivesList}
                costOfGoods={costOfGoodsList}
                stockList={stockList}
            />

            {/* Custom In-App Deletion Confirmation Modal */}
            {deleteConfirmState.show && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setDeleteConfirmState({ show: false, id: null, title: '' })}
                    />
                    <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-red-100/60 rounded-full mx-auto mb-5 text-red-600">
                            <TrashIcon className="w-7 h-7 sm:w-8 sm:h-8" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 text-center mb-2">Delete Confirmation</h3>
                        <p className="text-gray-600 text-center text-sm mb-6">
                            Are you sure you want to delete {deleteConfirmState.title}? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmState({ show: false, id: null, title: '' })}
                                className="flex-1 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="flex-1 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-lg shadow-red-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default LCPurchaseManagement;
