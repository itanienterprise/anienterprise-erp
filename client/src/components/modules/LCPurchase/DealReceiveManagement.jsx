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

/**
 * Unified Searchable Filter Select with Multi-select Support
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

    const selectedValues = useMemo(() => {
        if (!multiple) {
            return value ? [String(value)] : [];
        }
        return Array.isArray(value) ? value.filter(v => v !== 'all' && v !== '') : (value ? [String(value)] : []);
    }, [value, multiple]);

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;
        return options.filter(opt =>
            String(opt || '').toLowerCase().includes(query)
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

    const displayText = useMemo(() => {
        if (selectedValues.length === 0) return '';
        if (selectedValues.length === 1) return selectedValues[0];
        return `${selectedValues.length} Selected`;
    }, [selectedValues]);

    return (
        <div className="relative w-full" ref={dropdownRef}>
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
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedValues.length === 0 ? placeholder : (isOpen ? `Searching (${selectedValues.length} selected)...` : displayText)}
                    className="w-full h-[42px] pl-3.5 pr-14 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                />

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {selectedValues.length > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                            {selectedValues.length}
                        </span>
                    )}

                    {selectedValues.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                            title="Clear selection"
                        >
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            if (isOpen) {
                                setIsOpen(false);
                                setSearch('');
                            } else {
                                setIsOpen(true);
                                inputRef.current?.focus();
                            }
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                    >
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 py-1">
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${selectedValues.length === 0 ? 'bg-blue-50/80 text-blue-700 font-bold' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedValues.length === 0 ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                                    }`}>
                                    {selectedValues.length === 0 && <CheckIcon className="w-3.5 h-3.5 stroke-[3]" />}
                                </span>
                                <span>{placeholder}</span>
                            </div>
                        </button>

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
                                        className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${isChecked
                                            ? 'bg-blue-50/60 text-blue-900 font-semibold'
                                            : isHighlighted
                                                ? 'bg-gray-100 text-gray-900'
                                                : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
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

const DealReceiveManagement = ({ currentUser, addNotification, refreshPendingIndicators }) => {
    const canAdd = hasPermission(currentUser, 'dealReceive', 'add');
    const canEdit = hasPermission(currentUser, 'dealReceive', 'edit');
    const canDelete = hasPermission(currentUser, 'dealReceive', 'delete');
    const canShowEntryBy = hasPermission(currentUser, 'dealReceive', 'showEntryBy') || currentUser?.role === 'Admin' || currentUser?.role === 'Incharge';

    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Filter states
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        quickRange: 'all',
        purchaseId: [],
        exporter: [],
        supplierName: [],
        productName: [],
        brand: []
    });

    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);

    // Form data state matching Cost of Goods structure
    const defaultFormData = {
        date: new Date().toISOString().split('T')[0],
        country: 'INDIA',
        purchaseId: '', // Replaces LC NO
        dealRefId: '',
        trucks: 1,
        truckNumbers: [''],
        importer: '',
        exporter: '',
        supplier: '',
        invoiceNo: '',
        truckNo: '',
        product: '',
        brand: '',
        quantity: '',
        amount: '',
        indTruckFare: '',
        truckChangeFare: '',
        slofCf: '',
        rebate: '2.9',
        rebateAmount: '',
        netBill: '',
        rateKg: '',
        rsToDollar: '',
        rateKgUsd: '',
        dollarRateBdt: '',
        rateKgBdt: '',
        cfOtherExpense: '9',
        costingKg: ''
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
    const countryDropdownRef = useRef(null);

    // Dropdowns inside form
    const [dealDropdownOpen, setDealDropdownOpen] = useState(false);
    const [dealSearchQuery, setDealSearchQuery] = useState('');
    const [highlightedDealIndex, setHighlightedDealIndex] = useState(-1);
    const dealDropdownRef = useRef(null);

    const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(-1);
    const supplierDropdownRef = useRef(null);

    const [productDropdownOpen, setProductDropdownOpen] = useState(false);
    const productDropdownRef = useRef(null);

    const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
    const [brandSearchQuery, setBrandSearchQuery] = useState('');
    const [highlightedBrandIndex, setHighlightedBrandIndex] = useState(-1);
    const brandDropdownRef = useRef(null);

    // Relational options states
    const [dealsList, setDealsList] = useState([]);
    const [suppliersList, setSuppliersList] = useState([]);
    const [productsList, setProductsList] = useState([]);

    // Records list state
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState('all');
    const tableContainerRef = useRef(null);

    // Calculation function matching Cost of Goods
    const calculateFormValues = (data) => {
        const isChina = data.country === 'CHINA';
        const amount = parseFloat(data.amount) || 0;
        const qty = parseFloat(data.quantity) || 0;
        const dollarRate = parseFloat(data.rsToDollar) || 0;
        const bdtRate = parseFloat(data.dollarRateBdt) || 0;
        const expense = parseFloat(data.cfOtherExpense) || 0;

        if (isChina) {
            const totalBill = amount;
            const rebateAmount = 0;
            const netBill = amount;
            const rateKg = qty ? (amount / qty) : 0;
            const rateKgUsd = qty ? (amount / qty) : 0;
            const rateKgBdt = rateKgUsd * bdtRate;
            const costingKg = rateKgBdt + expense;
            return {
                isChina: true,
                totalBill,
                rebateAmount,
                netBill,
                rateKg,
                rateKgUsd,
                rateKgBdt,
                costingKg
            };
        } else {
            const indTruckFare = parseFloat(data.indTruckFare) || 0;
            const truckChangeFare = parseFloat(data.truckChangeFare) || 0;
            const slofCf = parseFloat(data.slofCf) || 0;
            const totalBill = amount + indTruckFare + truckChangeFare + slofCf;
            const rebatePct = parseFloat(data.rebate) || 0;
            const rebateAmount = (totalBill * rebatePct) / 100;
            const netBill = totalBill - rebateAmount;
            const rateKg = qty ? (netBill / qty) : 0;
            const rateKgUsd = dollarRate ? (rateKg / dollarRate) : 0;
            const rateKgBdt = rateKgUsd * bdtRate;
            const costingKg = rateKgBdt + expense;
            return {
                isChina: false,
                totalBill,
                rebateAmount,
                netBill,
                rateKg,
                rateKgUsd,
                rateKgBdt,
                costingKg
            };
        }
    };

    // Load initial dependencies
    const loadDependencies = async () => {
        try {
            const [dealsRes, supRes, prodRes] = await Promise.all([
                queryClient.fetchQuery({
                    queryKey: ['lc-purchases'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/lc-purchases?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
                }),
                queryClient.fetchQuery({
                    queryKey: ['suppliers'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/suppliers?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
                }),
                queryClient.fetchQuery({
                    queryKey: ['products'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/products?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : []).catch(() => [])
                })
            ]);
            if (Array.isArray(dealsRes)) setDealsList(dealsRes);
            if (Array.isArray(supRes)) setSuppliersList(supRes);
            if (Array.isArray(prodRes)) setProductsList(prodRes);
        } catch (err) {
            console.error('Error loading dependencies for Deal Receive:', err);
        }
    };

    // Fetch deal receive records
    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const res = await queryClient.fetchQuery({
                queryKey: ['deal-receives'],
                queryFn: () => axios.get(`${API_BASE_URL}/api/deal-receives?_t=${Date.now()}`).then(r => Array.isArray(r.data) ? r.data : [])
            });
            setRecords(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error('Error fetching Deal Receive records:', err);
            if (addNotification) {
                addNotification('Failed to load Deal Receive records', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDependencies();
        fetchRecords();

        const socket = getSocket();
        if (socket) {
            const handleUpdate = (data) => {
                if (data.module === 'deal-receives' || data.module === 'lc-purchases') {
                    queryClient.invalidateQueries({ queryKey: [data.module] });
                    if (data.module === 'deal-receives') fetchRecords();
                    if (data.module === 'lc-purchases') loadDependencies();
                }
            };
            socket.on('data_updated', handleUpdate);
            return () => {
                socket.off('data_updated', handleUpdate);
            };
        }
    }, []);

    // Outside click listener for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
                setCountryDropdownOpen(false);
            }
            if (dealDropdownRef.current && !dealDropdownRef.current.contains(e.target)) {
                setDealDropdownOpen(false);
            }
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target)) {
                setSupplierDropdownOpen(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(e.target)) {
                setProductDropdownOpen(false);
            }
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
                setBrandDropdownOpen(false);
            }
            if (
                filterPanelRef.current &&
                !filterPanelRef.current.contains(e.target) &&
                filterButtonRef.current &&
                !filterButtonRef.current.contains(e.target)
            ) {
                setShowFilterPanel(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'truckNo') {
            handleTruckNumberChange(0, value);
            return;
        }
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleTrucksChange = (val) => {
        const rawVal = parseInt(val, 10);
        const count = isNaN(rawVal) ? '' : Math.max(1, rawVal);
        setFormData(prev => {
            const currentNumbers = Array.isArray(prev.truckNumbers) ? [...prev.truckNumbers] : (prev.truckNo ? [prev.truckNo] : []);
            const targetLen = typeof count === 'number' ? count : 1;
            let updatedNumbers = currentNumbers.slice(0, targetLen);
            while (updatedNumbers.length < targetLen) {
                updatedNumbers.push('');
            }
            return {
                ...prev,
                trucks: count,
                truckNumbers: updatedNumbers,
                truckNo: updatedNumbers.filter(Boolean).join(', ')
            };
        });
    };

    const handleTruckNumberChange = (index, value) => {
        setFormData(prev => {
            const trucksCount = Math.max(1, parseInt(prev.trucks, 10) || 1);
            const updated = Array.isArray(prev.truckNumbers) ? [...prev.truckNumbers] : [];
            while (updated.length < trucksCount) {
                updated.push('');
            }
            updated[index] = value;
            return {
                ...prev,
                truckNumbers: updated,
                truckNo: updated.filter(Boolean).join(', ')
            };
        });
    };

    // Filter deals for Deal dropdown
    const filteredDeals = useMemo(() => {
        const query = dealSearchQuery.trim().toLowerCase();
        if (!query) return dealsList;
        return dealsList.filter(d => {
            const pId = String(d.purchaseId || '').replace(/-/g, '').toLowerCase();
            const exp = String(d.exporter || '').toLowerCase();
            const sup = String(d.supplierName || '').toLowerCase();
            const prod = String(d.productName || '').toLowerCase();
            const br = String(d.brand || '').toLowerCase();
            return pId.includes(query) || exp.includes(query) || sup.includes(query) || prod.includes(query) || br.includes(query);
        });
    }, [dealsList, dealSearchQuery]);

    // Handle Deal selection in form
    const handleDealSelect = (deal) => {
        const cleanPId = String(deal.purchaseId || '').replace(/-/g, '');
        const autoProduct = deal.productName || '';
        const autoBrand = deal.brand || '';
        const autoSupplier = deal.supplierName || '';

        setFormData(prev => ({
            ...prev,
            purchaseId: cleanPId,
            dealRefId: deal._id,
            importer: deal.importer || 'ANI ENTERPRISE',
            exporter: '',
            supplier: autoSupplier,
            product: autoProduct,
            brand: autoBrand,
            rsToDollar: prev.rsToDollar || deal.rate || '',
            trucks: prev.trucks || 1,
            truckNumbers: (Array.isArray(prev.truckNumbers) && prev.truckNumbers.length > 0) ? prev.truckNumbers : ['']
        }));

        setDealDropdownOpen(false);
        setDealSearchQuery('');
        setHighlightedDealIndex(-1);
    };

    const handleDealKeyDown = (e) => {
        if (!dealDropdownOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedDealIndex(prev => (prev < filteredDeals.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedDealIndex(prev => (prev > 0 ? prev - 1 : filteredDeals.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedDealIndex >= 0 && filteredDeals[highlightedDealIndex]) {
                handleDealSelect(filteredDeals[highlightedDealIndex]);
            } else if (filteredDeals.length > 0) {
                handleDealSelect(filteredDeals[0]);
            }
        } else if (e.key === 'Escape') {
            setDealDropdownOpen(false);
        }
    };

    // Filter suppliers for searchable dropdown
    const filteredSuppliers = useMemo(() => {
        if (!supplierSearchQuery.trim()) return suppliersList;
        const q = supplierSearchQuery.toLowerCase().trim();
        return suppliersList.filter(s => (s.name || '').toLowerCase().includes(q));
    }, [suppliersList, supplierSearchQuery]);

    // Filter brands for selected product
    const filteredBrands = useMemo(() => {
        if (!formData.product) return [];
        const target = formData.product.trim().toLowerCase();
        const pObj = productsList.find(p => (p.name || '').trim().toLowerCase() === target);
        if (!pObj) return [];
        const brands = [
            ...(pObj.brands || []).map(b => b.brand).filter(Boolean),
            pObj.brand
        ].filter(Boolean);
        return [...new Set(brands)];
    }, [productsList, formData.product]);

    // Filter options computed from data for header filter
    const filterOptions = useMemo(() => {
        const pIds = new Set();
        const exporters = new Set();
        const suppliers = new Set();
        const products = new Set();
        const brands = new Set();

        records.forEach(r => {
            if (r.purchaseId) pIds.add(String(r.purchaseId).replace(/-/g, ''));
            if (r.exporter) exporters.add(r.exporter);
            if (r.supplier) suppliers.add(r.supplier);
            if (r.product) products.add(r.product);
            if (r.brand) brands.add(r.brand);
        });

        dealsList.forEach(d => {
            if (d.purchaseId) pIds.add(String(d.purchaseId).replace(/-/g, ''));
            if (d.exporter) exporters.add(d.exporter);
            if (d.supplierName) suppliers.add(d.supplierName);
            if (d.productName) products.add(d.productName);
            if (d.brand) brands.add(d.brand);
        });

        return {
            purchaseIds: Array.from(pIds).sort(),
            exporters: Array.from(exporters).sort(),
            suppliers: Array.from(suppliers).sort(),
            products: Array.from(products).sort(),
            brands: Array.from(brands).sort()
        };
    }, [records, dealsList]);

    // Handle Quick Range selection
    const handleQuickRange = (range) => {
        const today = new Date();
        let startDate = '';
        let endDate = today.toISOString().split('T')[0];

        if (range === 'today') {
            startDate = endDate;
        } else if (range === 'weekly') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().split('T')[0];
        } else if (range === 'monthly') {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            startDate = d.toISOString().split('T')[0];
        } else if (range === 'yearly') {
            const d = new Date();
            d.setFullYear(d.getFullYear() - 1);
            startDate = d.toISOString().split('T')[0];
        } else if (range === 'all') {
            startDate = '';
            endDate = '';
        }

        setFilters(prev => ({
            ...prev,
            quickRange: range,
            startDate,
            endDate
        }));
    };

    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            quickRange: 'all',
            purchaseId: [],
            exporter: [],
            supplierName: [],
            productName: [],
            brand: []
        });
        setCurrentPage(1);
    };

    // Filter records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const receiveId = String(r.receiveId || '').toLowerCase();
                const purchaseId = String(r.purchaseId || '').toLowerCase().replace(/-/g, '');
                const exporter = String(r.exporter || '').toLowerCase();
                const supplier = String(r.supplier || r.supplierName || '').toLowerCase();
                const product = String(r.product || r.productName || '').toLowerCase();
                const brand = String(r.brand || '').toLowerCase();
                const truckNo = String(r.truckNo || '').toLowerCase();
                const invoiceNo = String(r.invoiceNo || '').toLowerCase();

                const match = receiveId.includes(q) ||
                    purchaseId.includes(q) ||
                    exporter.includes(q) ||
                    supplier.includes(q) ||
                    product.includes(q) ||
                    brand.includes(q) ||
                    truckNo.includes(q) ||
                    invoiceNo.includes(q);

                if (!match) return false;
            }

            if (filters.startDate) {
                const rDate = (r.date || '').split('T')[0];
                if (rDate < filters.startDate) return false;
            }
            if (filters.endDate) {
                const rDate = (r.date || '').split('T')[0];
                if (rDate > filters.endDate) return false;
            }

            if (filters.purchaseId && filters.purchaseId.length > 0) {
                const pId = String(r.purchaseId || '').replace(/-/g, '');
                if (!filters.purchaseId.includes(pId)) return false;
            }
            if (filters.exporter && filters.exporter.length > 0) {
                if (!filters.exporter.includes(r.exporter)) return false;
            }
            if (filters.supplierName && filters.supplierName.length > 0) {
                if (!filters.supplierName.includes(r.supplier || r.supplierName)) return false;
            }
            if (filters.productName && filters.productName.length > 0) {
                if (!filters.productName.includes(r.product || r.productName)) return false;
            }
            if (filters.brand && filters.brand.length > 0) {
                if (!filters.brand.includes(r.brand)) return false;
            }

            return true;
        });
    }, [records, searchQuery, filters]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.quickRange !== 'all' || filters.startDate || filters.endDate) count += 1;
        if (filters.purchaseId && filters.purchaseId.length > 0) count += filters.purchaseId.length;
        if (filters.supplierName && filters.supplierName.length > 0) count += filters.supplierName.length;
        if (filters.productName && filters.productName.length > 0) count += filters.productName.length;
        if (filters.brand && filters.brand.length > 0) count += filters.brand.length;
        return count;
    }, [filters]);

    const hasActiveFilters = activeFilterCount > 0;

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
            } else if (sortConfig.key === 'receiveId') {
                aVal = String(a.receiveId || '').toLowerCase();
                bVal = String(b.receiveId || '').toLowerCase();
            } else if (sortConfig.key === 'purchaseId') {
                aVal = String(a.purchaseId || '').replace(/-/g, '').toLowerCase();
                bVal = String(b.purchaseId || '').replace(/-/g, '').toLowerCase();
            } else if (sortConfig.key === 'exporter') {
                aVal = (a.exporter || '').toLowerCase();
                bVal = (b.exporter || '').toLowerCase();
            } else if (sortConfig.key === 'supplier') {
                aVal = (a.supplier || a.supplierName || '').toLowerCase();
                bVal = (b.supplier || b.supplierName || '').toLowerCase();
            } else if (sortConfig.key === 'product') {
                aVal = (a.product || a.productName || '').toLowerCase();
                bVal = (b.product || b.productName || '').toLowerCase();
            } else if (sortConfig.key === 'brand') {
                aVal = (a.brand || '').toLowerCase();
                bVal = (b.brand || '').toLowerCase();
            } else if (sortConfig.key === 'trucks') {
                aVal = parseFloat(a.trucks) || (Array.isArray(a.truckNumbers) ? a.truckNumbers.length : 1);
                bVal = parseFloat(b.trucks) || (Array.isArray(b.truckNumbers) ? b.truckNumbers.length : 1);
            } else if (sortConfig.key === 'quantity') {
                aVal = parseFloat(a.quantity) || 0;
                bVal = parseFloat(b.quantity) || 0;
            } else if (sortConfig.key === 'truckNo') {
                aVal = (a.truckNo || '').toLowerCase();
                bVal = (b.truckNo || '').toLowerCase();
            } else if (sortConfig.key === 'costingKg') {
                aVal = parseFloat(a.costingKg) || 0;
                bVal = parseFloat(b.costingKg) || 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRecords, sortConfig]);

    const paginatedRecords = useMemo(() => {
        if (pageSize === 'all' || Number(pageSize) >= ALL_PAGE_SIZE) {
            return sortedRecords;
        }
        const size = Number(pageSize) || 15;
        const start = (currentPage - 1) * size;
        return sortedRecords.slice(start, start + size);
    }, [sortedRecords, currentPage, pageSize]);

    const resetForm = () => {
        setFormData(defaultFormData);
        setEditingId(null);
        setDealSearchQuery('');
        setSupplierSearchQuery('');
        setBrandSearchQuery('');
    };

    const handleOpenAddForm = () => {
        resetForm();
        setShowForm(true);
    };

    const handleEdit = (record) => {
        setEditingId(record._id);
        const initialTrucks = parseInt(record.trucks, 10) || (Array.isArray(record.truckNumbers) && record.truckNumbers.length ? record.truckNumbers.length : 1);
        let initialTruckNumbers = Array.isArray(record.truckNumbers) && record.truckNumbers.length > 0
            ? [...record.truckNumbers]
            : (record.truckNo ? record.truckNo.split(',').map(s => s.trim()) : ['']);
        while (initialTruckNumbers.length < initialTrucks) {
            initialTruckNumbers.push('');
        }
        setFormData({
            ...defaultFormData,
            ...record,
            trucks: initialTrucks,
            truckNumbers: initialTruckNumbers,
            purchaseId: String(record.purchaseId || '').replace(/-/g, ''),
            date: record.date ? record.date.split('T')[0] : new Date().toISOString().split('T')[0]
        });
        setShowForm(true);
    };

    // Sync deal quantities after save or delete
    const syncDealQuantities = async (targetDealRefId, targetPurchaseId) => {
        try {
            const deal = dealsList.find(d =>
                d._id === targetDealRefId ||
                String(d.purchaseId || '').replace(/-/g, '') === String(targetPurchaseId || '').replace(/-/g, '')
            );
            if (!deal) return;

            const rRes = await axios.get(`${API_BASE_URL}/api/deal-receives?_t=${Date.now()}`);
            const allReceives = Array.isArray(rRes.data) ? rRes.data : [];
            const cleanPId = String(deal.purchaseId || '').replace(/-/g, '');
            const matchingReceives = allReceives.filter(r =>
                r.dealRefId === deal._id || String(r.purchaseId || '').replace(/-/g, '') === cleanPId
            );

            const isTruckDeal = deal.uom === 'Truck';
            const totalReceived = matchingReceives.reduce((sum, r) => {
                if (isTruckDeal) {
                    const count = parseFloat(r.trucks) || (Array.isArray(r.truckNumbers) && r.truckNumbers.length ? r.truckNumbers.length : 1);
                    return sum + count;
                }
                return sum + (parseFloat(r.quantity || r.receiveQty) || 0);
            }, 0);
            const totalDealQty = parseFloat(deal.qty) || 0;
            const remaining = Math.max(0, totalDealQty - totalReceived);

            await axios.put(`${API_BASE_URL}/api/lc-purchases/${deal._id}`, {
                ...deal,
                receivedQty: totalReceived,
                remainingQty: remaining
            });
            queryClient.invalidateQueries({ queryKey: ['lc-purchases'] });
        } catch (err) {
            console.error('Error syncing deal quantities:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.purchaseId) {
            if (addNotification) addNotification('Please select a Purchase Deal', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const calc = calculateFormValues(formData);
            const trucksNum = Math.max(1, parseInt(formData.trucks, 10) || 1);
            const truckNumbersClean = Array.isArray(formData.truckNumbers) ? formData.truckNumbers.slice(0, trucksNum) : [];
            const payload = {
                ...formData,
                trucks: trucksNum,
                truckNumbers: truckNumbersClean,
                truckNo: truckNumbersClean.filter(Boolean).join(', ') || formData.truckNo || '',
                totalBill: calc.totalBill,
                rebateAmount: calc.rebateAmount,
                netBill: calc.netBill,
                rateKg: calc.rateKg,
                rateKgUsd: calc.rateKgUsd,
                rateKgBdt: calc.rateKgBdt,
                costingKg: calc.costingKg,
                ...(editingId
                    ? { updatedBy: currentUser?.name || currentUser?.username || 'Admin' }
                    : { createdBy: currentUser?.name || currentUser?.username || 'Admin' }
                )
            };

            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/deal-receives/${editingId}`, payload);
                if (addNotification) addNotification('Deal Receive updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/deal-receives`, payload);
                if (addNotification) addNotification('Deal Receive recorded successfully', 'success');
            }

            await syncDealQuantities(formData.dealRefId, formData.purchaseId);

            setShowForm(false);
            resetForm();
            fetchRecords();
            loadDependencies();
        } catch (err) {
            console.error('Error saving Deal Receive:', err);
            if (addNotification) {
                addNotification(err.response?.data?.message || 'Failed to save Deal Receive', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        const item = records.find(r => r._id === id);
        if (!window.confirm(`Are you sure you want to delete Deal Receive for ${(item?.purchaseId || '').replace(/-/g, '')}?`)) {
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/deal-receives/${id}`);
            if (addNotification) addNotification('Deal Receive deleted successfully', 'success');

            if (item) {
                await syncDealQuantities(item.dealRefId, item.purchaseId);
            }

            fetchRecords();
            loadDependencies();
        } catch (err) {
            console.error('Error deleting Deal Receive:', err);
            if (addNotification) {
                addNotification(err.response?.data?.message || 'Failed to delete Deal Receive', 'error');
            }
        }
    };

    const calculated = calculateFormValues(formData);

    return (
        <div className="space-y-6">
            {/* Header matching exact layout */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-auto">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight text-center md:text-left">Deal Receive</h2>
                </div>

                {/* Center Search Input */}
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
                    {/* Filter Button */}
                    <div className="relative flex-1 md:flex-none">
                        <button
                            ref={filterButtonRef}
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border ${showFilterPanel || hasActiveFilters ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'} h-[42px] font-semibold text-sm`}
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
                                className="fixed inset-x-4 top-[140px] md:absolute md:inset-auto md:right-0 md:mt-3 md:top-auto w-auto md:w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[60] p-5 opacity-100 scale-100 transform transform-gpu transition-all duration-200 ease-out origin-top-right text-left"
                            >
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                            <FunnelIcon className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-[15px]">Filter Deal Receives</h3>
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
                                    {/* Quick Date Range */}
                                    <div>
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Quick Range</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {['all', 'today', 'weekly', 'monthly', 'yearly'].map((rng) => (
                                                <button
                                                    key={rng}
                                                    type="button"
                                                    onClick={() => handleQuickRange(rng)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${filters.quickRange === rng
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {rng}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Date Range */}
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div className="relative font-sans [&_.date-picker-input]:h-[42px] [&_.date-picker-input]:py-2 [&_.date-picker-input]:px-3 [&_.date-picker-input]:rounded-xl [&_.date-picker-input]:text-xs [&_.date-picker-container>label]:mb-1">
                                            <CustomDatePicker
                                                label="Start Date"
                                                labelClassName="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1"
                                                name="filterStartDate"
                                                value={filters.startDate}
                                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                                                compact={false}
                                            />
                                        </div>
                                        <div className="relative font-sans [&_.date-picker-input]:h-[42px] [&_.date-picker-input]:py-2 [&_.date-picker-input]:px-3 [&_.date-picker-input]:rounded-xl [&_.date-picker-input]:text-xs [&_.date-picker-container>label]:mb-1">
                                            <CustomDatePicker
                                                label="End Date"
                                                labelClassName="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1"
                                                name="filterEndDate"
                                                value={filters.endDate}
                                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                                                compact={false}
                                            />
                                        </div>
                                    </div>

                                    {/* Multi-select Purchase ID Filter */}
                                    <SearchableFilterSelect
                                        label="Purchase Deal (Pur. ID)"
                                        value={filters.purchaseId}
                                        onChange={(val) => setFilters(prev => ({ ...prev, purchaseId: val }))}
                                        options={filterOptions.purchaseIds}
                                        placeholder="All Purchase Deals"
                                        multiple={true}
                                    />

                                    {/* Multi-select Supplier Filter */}
                                    <SearchableFilterSelect
                                        label="Supplier"
                                        value={filters.supplierName}
                                        onChange={(val) => setFilters(prev => ({ ...prev, supplierName: val }))}
                                        options={filterOptions.suppliers}
                                        placeholder="All Suppliers"
                                        multiple={true}
                                    />

                                    {/* Multi-select Product Filter */}
                                    <SearchableFilterSelect
                                        label="Product"
                                        value={filters.productName}
                                        onChange={(val) => setFilters(prev => ({ ...prev, productName: val }))}
                                        options={filterOptions.products}
                                        placeholder="All Products"
                                        multiple={true}
                                    />

                                    {/* Multi-select Brand Filter */}
                                    <SearchableFilterSelect
                                        label="Brand"
                                        value={filters.brand}
                                        onChange={(val) => setFilters(prev => ({ ...prev, brand: val }))}
                                        options={filterOptions.brands}
                                        placeholder="All Brands"
                                        multiple={true}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Report Button */}
                    <button
                        type="button"
                        onClick={() => setShowReportModal(true)}
                        className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px] font-semibold text-sm"
                    >
                        <BarChartIcon className="w-4 h-4 text-blue-600" />
                        <span>Report</span>
                    </button>

                    {/* Add Deal Receive Button */}
                    {canAdd && (
                        <button
                            type="button"
                            onClick={handleOpenAddForm}
                            className="flex-1 md:flex-none w-full md:w-auto justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-95 flex items-center gap-2 text-sm h-[42px]"
                        >
                            <PlusIcon className="w-4 h-4" /> <span>Add Deal Receive</span>
                        </button>
                    )}
                </div>
            </div>

            {/* In-page Entry Form matching Cost of Goods layout */}
            {showForm ? (
                <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-[40px] border border-white/50 shadow-2xl p-8 transition-all duration-300 animate-in fade-in zoom-in-95">
                    {/* Header of Form Card */}
                    <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-100">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">
                                {editingId ? 'Edit Deal Receive Entry' : 'New Deal Receive Entry'}
                            </h3>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                                Deal Receive Record
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            {/* Country Dropdown (INDIA / CHINA) */}
                            <div className="relative" ref={countryDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                                    className="flex items-center justify-between space-x-2.5 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 shadow-sm hover:border-blue-300 hover:bg-gray-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/10 min-w-[100px]"
                                >
                                    <span>{formData.country || 'INDIA'}</span>
                                    <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${countryDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                                </button>
                                {countryDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-1.5 w-32 bg-white border border-gray-100 rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-fade-in">
                                        {['INDIA', 'CHINA'].map((country) => (
                                            <button
                                                key={country}
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, country }));
                                                    setCountryDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3.5 py-2 text-xs font-bold transition-colors flex items-center justify-between ${(formData.country || 'INDIA') === country
                                                    ? 'bg-blue-50 text-blue-600'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                    }`}
                                            >
                                                <span>{country}</span>
                                                {(formData.country || 'INDIA') === country && (
                                                    <CheckIcon className="w-3.5 h-3.5 text-blue-600" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => { setShowForm(false); resetForm(); }}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Entry Form Grid */}
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Date Field */}
                            <CustomDatePicker
                                label="Date"
                                value={formData.date}
                                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                name="date"
                                required
                                compact={true}
                                labelClassName="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1"
                            />

                            {/* PURCHASE DEAL ID Searchable Dropdown (Replaces LC NO) */}
                            <div className="space-y-1.5 relative" ref={dealDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                                    Purchase Deal ID
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search & Select Purchase Deal..."
                                        value={dealDropdownOpen ? dealSearchQuery : (formData.purchaseId || '')}
                                        onChange={(e) => {
                                            setDealSearchQuery(e.target.value);
                                            setHighlightedDealIndex(-1);
                                            if (!dealDropdownOpen) setDealDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setDealDropdownOpen(true);
                                            setDealSearchQuery('');
                                            setHighlightedDealIndex(-1);
                                        }}
                                        onKeyDown={handleDealKeyDown}
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10"
                                        required
                                    />
                                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                                {dealDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {filteredDeals.length > 0 ? (
                                            filteredDeals.map((deal, idx) => {
                                                const cleanPId = String(deal.purchaseId || '').replace(/-/g, '');
                                                const pQty = parseFloat(deal.qty) || 0;
                                                const rQty = parseFloat(deal.receivedQty) || 0;
                                                const remaining = Math.max(0, pQty - rQty);
                                                const uLabel = deal.uom === 'Truck' ? 'Trucks' : 'KG';

                                                return (
                                                    <button
                                                        key={deal._id}
                                                        type="button"
                                                        onMouseEnter={() => setHighlightedDealIndex(idx)}
                                                        onClick={() => handleDealSelect(deal)}
                                                        className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedDealIndex === idx
                                                            ? 'bg-blue-50'
                                                            : formData.purchaseId === cleanPId
                                                                ? 'bg-blue-50/60'
                                                                : 'hover:bg-blue-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-blue-600 group-hover:text-blue-700">{cleanPId}</span>
                                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                                                                Remaining: {remaining} {uLabel}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                                                            {deal.productName || '—'} ({deal.brand || 'No Brand'}) • {deal.supplierName || '—'}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No Purchase Deal found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Trucks Field - Added right after Purchase Deal ID */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">
                                    Trucks
                                </label>
                                <input
                                    type="number"
                                    name="trucks"
                                    value={formData.trucks}
                                    onChange={(e) => handleTrucksChange(e.target.value)}
                                    min="1"
                                    placeholder="1"
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-blue-600"
                                />
                            </div>

                            {/* Supplier Searchable Dropdown */}
                            <div className="space-y-1.5 relative" ref={supplierDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Supplier</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search & Select Supplier..."
                                        value={supplierDropdownOpen ? supplierSearchQuery : (formData.supplier || '')}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSupplierSearchQuery(val);
                                            setFormData(prev => ({ ...prev, supplier: val }));
                                            setHighlightedSupplierIndex(-1);
                                            if (!supplierDropdownOpen) setSupplierDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setSupplierDropdownOpen(true);
                                            setSupplierSearchQuery('');
                                            setHighlightedSupplierIndex(-1);
                                        }}
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10"
                                    />
                                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                                {supplierDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {filteredSuppliers.length > 0 ? (
                                            filteredSuppliers.map((sup, idx) => (
                                                <button
                                                    key={sup._id}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedSupplierIndex(idx)}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, supplier: sup.name }));
                                                        setSupplierDropdownOpen(false);
                                                        setSupplierSearchQuery('');
                                                        setHighlightedSupplierIndex(-1);
                                                    }}
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedSupplierIndex === idx
                                                        ? 'bg-blue-50'
                                                        : formData.supplier === sup.name
                                                            ? 'bg-blue-50/60'
                                                            : 'hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <div className="font-bold text-blue-600 group-hover:text-blue-700">{sup.name}</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No suppliers found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Invoice No */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Invoice No</label>
                                <input
                                    type="text"
                                    name="invoiceNo"
                                    value={formData.invoiceNo}
                                    onChange={handleInputChange}
                                    placeholder="Enter Invoice No..."
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Truck No / Numbers */}
                            {(parseInt(formData.trucks, 10) || 1) <= 1 ? (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Truck No</label>
                                    <input
                                        type="text"
                                        name="truckNo"
                                        value={formData.truckNumbers?.[0] !== undefined ? formData.truckNumbers[0] : (formData.truckNo || '')}
                                        onChange={(e) => handleTruckNumberChange(0, e.target.value)}
                                        placeholder="Enter Truck No..."
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-semibold text-gray-800"
                                    />
                                </div>
                            ) : (
                                <div className="col-span-full bg-blue-50/40 rounded-2xl border border-blue-100/70 p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-blue-100/60 pb-2">
                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                            <span>Truck Numbers</span>
                                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                                {Math.max(1, parseInt(formData.trucks, 10) || 1)} Trucks
                                            </span>
                                        </span>
                                        <span className="text-[11px] text-gray-400">
                                            Enter registration / number plate for each truck
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {Array.from({ length: Math.max(1, parseInt(formData.trucks, 10) || 1) }).map((_, idx) => (
                                            <div key={idx} className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">
                                                    Truck {idx + 1} No
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.truckNumbers?.[idx] || ''}
                                                    onChange={(e) => handleTruckNumberChange(idx, e.target.value)}
                                                    placeholder="e.g. HR-58D6568"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-sm hover:border-gray-300 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-semibold text-gray-800"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Product Auto Fill */}
                            <div className="space-y-1.5 relative" ref={productDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Product</label>
                                <input
                                    type="text"
                                    value={formData.product}
                                    readOnly
                                    placeholder={formData.purchaseId ? "Auto filled" : "Select Purchase Deal first"}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Brand */}
                            <div className="space-y-1.5 relative" ref={brandDropdownRef}>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Brand</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={formData.product ? "Search & Select Brand..." : "Select Product first"}
                                        value={brandDropdownOpen ? brandSearchQuery : (formData.brand || '')}
                                        onChange={(e) => {
                                            setBrandSearchQuery(e.target.value);
                                            setHighlightedBrandIndex(-1);
                                            if (!brandDropdownOpen) setBrandDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            if (!formData.product) return;
                                            setBrandDropdownOpen(true);
                                            setBrandSearchQuery('');
                                            setHighlightedBrandIndex(-1);
                                        }}
                                        autoComplete="off"
                                        disabled={!formData.product}
                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none pr-10 ${!formData.product ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' : ''
                                            }`}
                                    />
                                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                                {brandDropdownOpen && formData.product && (
                                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[110] max-h-56 overflow-y-auto py-1">
                                        {filteredBrands.length > 0 ? (
                                            filteredBrands.map((b, idx) => (
                                                <button
                                                    key={b}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedBrandIndex(idx)}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, brand: b }));
                                                        setBrandDropdownOpen(false);
                                                        setBrandSearchQuery('');
                                                        setHighlightedBrandIndex(-1);
                                                    }}
                                                    className={`w-full px-5 py-3 text-left text-sm transition-colors group ${highlightedBrandIndex === idx
                                                        ? 'bg-blue-50'
                                                        : formData.brand === b
                                                            ? 'bg-blue-50/60'
                                                            : 'hover:bg-blue-50'
                                                        }`}
                                                >
                                                    <div className="font-bold text-blue-600 group-hover:text-blue-700">{b}</div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-5 py-6 text-center text-gray-400">
                                                <BoxIcon className="w-7 h-7 mb-2 mx-auto opacity-20" />
                                                <p className="text-xs font-medium">No brands found for "{formData.product}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Quantity */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Quantity</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleInputChange}
                                    placeholder="0"
                                    min="0"
                                    step="any"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Invoice Value */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Invoice Value</label>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* IND Truck Fare & Truck Change Fare (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 truncate block" title="IND TRUCK FARE">
                                            IND TRUCK FARE
                                        </label>
                                        <input
                                            type="number"
                                            name="indTruckFare"
                                            value={formData.indTruckFare}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                            className="w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1 truncate block" title="TRUCK CHANGE FARE">
                                            TRK CHG FARE
                                        </label>
                                        <input
                                            type="number"
                                            name="truckChangeFare"
                                            value={formData.truckChangeFare}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                            className="w-full px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}


                            {/* SLOF / CF (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">SLOF / CF</label>
                                    <input
                                        type="number"
                                        name="slofCf"
                                        value={formData.slofCf}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Total BILL (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Total BILL</label>
                                    <input
                                        type="text"
                                        name="totalBill"
                                        value={'₹' + calculated.totalBill.toLocaleString()}
                                        disabled
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                    />
                                </div>
                            )}

                            {/* Rebate (%) (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rebate (%)</label>
                                    <input
                                        type="number"
                                        name="rebate"
                                        value={formData.rebate}
                                        onChange={handleInputChange}
                                        placeholder="2.9"
                                        step="0.01"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Rebate Amount (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rebate</label>
                                    <input
                                        type="text"
                                        name="rebateAmount"
                                        value={'₹' + calculated.rebateAmount.toLocaleString()}
                                        disabled
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                    />
                                </div>
                            )}

                            {/* Net Bill (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Net Bill</label>
                                    <input
                                        type="text"
                                        name="netBill"
                                        value={'₹' + calculated.netBill.toLocaleString()}
                                        disabled
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                    />
                                </div>
                            )}

                            {/* Rate/KG (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rate/KG</label>
                                    <input
                                        type="text"
                                        name="rateKg"
                                        value={'₹' + calculated.rateKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        disabled
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                    />
                                </div>
                            )}

                            {/* Rs to Dollar Rate (Hidden for CHINA) */}
                            {formData.country !== 'CHINA' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rs to Dollar Rate</label>
                                    <input
                                        type="number"
                                        name="rsToDollar"
                                        value={formData.rsToDollar}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.0001"
                                        className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Rate/Kg USD */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rate/Kg USD</label>
                                <input
                                    type="text"
                                    name="rateKgUsd"
                                    value={'$' + calculated.rateKgUsd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* Dollar rate BDT */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Dollar rate BDT</label>
                                <input
                                    type="number"
                                    name="dollarRateBdt"
                                    value={formData.dollarRateBdt}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Rate/KG BDT */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Rate/KG BDT</label>
                                <input
                                    type="text"
                                    name="rateKgBdt"
                                    value={calculated.rateKgBdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BDT'}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>

                            {/* C&F & Other Expance */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">C&F & Other Expance</label>
                                <input
                                    type="number"
                                    name="cfOtherExpense"
                                    value={formData.cfOtherExpense}
                                    onChange={handleInputChange}
                                    placeholder="9"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm shadow-sm hover:border-gray-200 transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none"
                                />
                            </div>

                            {/* Costing/kg */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Costing/kg</label>
                                <input
                                    type="text"
                                    name="costingKg"
                                    value={calculated.costingKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BDT'}
                                    disabled
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed outline-none"
                                />
                            </div>
                        </div>

                        {/* Form Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); resetForm(); }}
                                className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                /* Deal Receive Data Table */
                <div className="space-y-4">
                    {/* Active Filters Pill Bar */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900">
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Active Filters:</span>

                            {filters.quickRange !== 'all' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    Range: {filters.quickRange}
                                    <button
                                        type="button"
                                        onClick={() => handleQuickRange('all')}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {filters.startDate && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    From: {filters.startDate}
                                    <button
                                        type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, startDate: '' }))}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {filters.endDate && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    To: {filters.endDate}
                                    <button
                                        type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, endDate: '' }))}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {filters.purchaseId && filters.purchaseId.map((pId) => (
                                <span key={pId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    Deal: {pId}
                                    <button
                                        type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, purchaseId: prev.purchaseId.filter(x => x !== pId) }))}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}

                            {filters.supplierName && filters.supplierName.map((sup) => (
                                <span key={sup} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    Supplier: {sup}
                                    <button
                                        type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, supplierName: prev.supplierName.filter(x => x !== sup) }))}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}

                            {filters.productName && filters.productName.map((prd) => (
                                <span key={prd} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    Product: {prd}
                                    <button
                                        type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, productName: prev.productName.filter(x => x !== prd) }))}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}

                            {filters.brand && filters.brand.map((br) => (
                                <span key={br} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                                    Brand: {br}
                                    <button
                                        type="button"
                                        onClick={() => setFilters(prev => ({ ...prev, brand: prev.brand.filter(x => x !== br) }))}
                                        className="p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}

                            <button
                                type="button"
                                onClick={resetFilters}
                                className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 px-2 py-0.5 hover:bg-red-50 rounded-md transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div ref={tableContainerRef} className="overflow-x-auto">
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
                                        <th onClick={() => requestSort('receiveId')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center">
                                                <span>Receive ID</span>
                                                <SortIndicator sortKey="receiveId" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('purchaseId')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center">
                                                <span>Pur. ID</span>
                                                <SortIndicator sortKey="purchaseId" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('supplier')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center">
                                                <span>Supplier</span>
                                                <SortIndicator sortKey="supplier" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('product')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center">
                                                <span>Product</span>
                                                <SortIndicator sortKey="product" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('brand')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center">
                                                <span>Brand</span>
                                                <SortIndicator sortKey="brand" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('trucks')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center justify-center">
                                                <span>Trucks</span>
                                                <SortIndicator sortKey="trucks" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="center" />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('quantity')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center justify-center">
                                                <span>Quantity</span>
                                                <SortIndicator sortKey="quantity" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="center" />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('truckNo')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center">
                                                <span>Truck No</span>
                                                <SortIndicator sortKey="truckNo" currentSortKey={sortConfig.key} direction={sortConfig.direction} />
                                            </div>
                                        </th>
                                        <th onClick={() => requestSort('costingKg')} className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap cursor-pointer hover:bg-gray-100/70 transition-colors group select-none">
                                            <div className="flex items-center justify-end">
                                                <span>Costing/kg</span>
                                                <SortIndicator sortKey="costingKg" currentSortKey={sortConfig.key} direction={sortConfig.direction} align="right" />
                                            </div>
                                        </th>
                                        <th className="px-4 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={12} className="px-6 py-12 text-center text-gray-400 font-medium text-sm whitespace-nowrap">
                                                Loading Deal Receive records...
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={12} className="px-6 py-16 text-center text-gray-400">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <BoxIcon className="w-10 h-10 text-gray-300 stroke-1" />
                                                    <span className="font-semibold text-gray-500">No Deal Receive records found</span>
                                                    <span className="text-xs text-gray-400">Click &ldquo;+ Add Deal Receive&rdquo; above to record a receive</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedRecords.map((item, idx) => {
                                            const isAll = pageSize === 'all' || Number(pageSize) >= ALL_PAGE_SIZE;
                                            const sl = (isAll ? 0 : (currentPage - 1) * (Number(pageSize) || 15)) + idx + 1;
                                            const qtyNum = parseFloat(item.quantity) || 0;
                                            const costingVal = parseFloat(item.costingKg) || 0;

                                            return (
                                                <tr key={item._id || idx} className="hover:bg-blue-50/40 transition-colors">
                                                    <td className="px-4 py-3.5 text-xs font-bold text-gray-400 text-center whitespace-nowrap">{sl}</td>
                                                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">{formatDate(item.date)}</td>
                                                    <td className="px-4 py-3.5 text-sm font-black whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewData(item)}
                                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-black"
                                                            title="View Details"
                                                        >
                                                            {item.receiveId || `DR${String(sl).padStart(4, '0')}`}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm font-bold text-blue-600 whitespace-nowrap">{(item.purchaseId || '').replace(/-/g, '') || '—'}</td>
                                                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-800 whitespace-nowrap">{item.supplier || item.supplierName || '—'}</td>
                                                    <td className="px-4 py-3.5 text-sm font-bold text-gray-900 whitespace-nowrap">{item.product || item.productName || '—'}</td>
                                                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">{item.brand || '—'}</td>
                                                    <td className="px-4 py-3.5 text-sm font-bold text-gray-800 text-center whitespace-nowrap">
                                                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs inline-block whitespace-nowrap border border-blue-200/60">
                                                            {item.trucks || (Array.isArray(item.truckNumbers) && item.truckNumbers.length ? item.truckNumbers.length : 1)} { (item.trucks === 1 || (!item.trucks && (!item.truckNumbers || item.truckNumbers.length <= 1))) ? 'Truck' : 'Trucks' }
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm font-bold text-gray-800 text-center whitespace-nowrap">
                                                        <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 font-bold text-xs inline-block whitespace-nowrap border border-green-200/60">
                                                            {qtyNum.toLocaleString('en-IN')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                        {item.truckNo || (Array.isArray(item.truckNumbers) ? item.truckNumbers.filter(Boolean).join(', ') : '—') || '—'}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-sm font-bold text-gray-900 text-right whitespace-nowrap">
                                                        {costingVal ? `${costingVal.toFixed(2)} BDT` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setViewData(item)}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="View Details"
                                                            >
                                                                <EyeIcon className="w-4 h-4" />
                                                            </button>
                                                            {canEdit && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEdit(item)}
                                                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    title="Edit Record"
                                                                >
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(item._id)}
                                                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete Record"
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

                        {/* Pagination */}
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
                </div>
            )}

            {/* Quick Report Summary Modal */}
            {showReportModal && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowReportModal(false)} />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-gray-100 relative z-10 animate-in zoom-in duration-200">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <BarChartIcon className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-black text-gray-900">Deal Receive Summary</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowReportModal(false)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3 py-2 text-sm text-gray-700">
                            <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                                <span className="font-semibold text-gray-600">Total Receives Recorded:</span>
                                <span className="font-bold text-gray-900">{filteredRecords.length}</span>
                            </div>
                            <div className="flex justify-between p-3 bg-green-50 rounded-xl">
                                <span className="font-semibold text-green-700">Total Quantity:</span>
                                <span className="font-black text-green-800">
                                    {filteredRecords.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0).toLocaleString('en-IN')}
                                </span>
                            </div>
                        </div>
                        <div className="pt-4 mt-2 border-t border-gray-100 text-right">
                            <button
                                type="button"
                                onClick={() => setShowReportModal(false)}
                                className="px-5 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* View Detail Modal */}
            {viewData && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 app-modal-overlay">
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewData(null)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/70 via-white to-gray-50/40">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 font-black">
                                    <EyeIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Deal Receive Details</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                                            Pur. ID: {(viewData.purchaseId || '').replace(/-/g, '') || '—'}
                                        </span>
                                        {viewData.receiveId && (
                                            <span className="text-[11px] font-semibold text-gray-400">
                                                • {viewData.receiveId}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                    {viewData.country || 'INDIA'}
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

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* 1. Basic Info Grid */}
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                                    Purchase & Entity Information
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Date</span>
                                        <span className="text-sm font-semibold text-gray-800">{formatDate(viewData.date)}</span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Purchase Deal ID</span>
                                        <span className="text-sm font-bold text-blue-600">{(viewData.purchaseId || '').replace(/-/g, '') || '—'}</span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Invoice No</span>
                                        <span className="text-sm font-semibold text-gray-800">{viewData.invoiceNo || '—'}</span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Supplier</span>
                                        <span className="text-sm font-semibold text-gray-800">{viewData.supplier || viewData.supplierName || '—'}</span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Product</span>
                                        <span className="text-sm font-bold text-gray-900">{viewData.product || viewData.productName || '—'}</span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Brand</span>
                                        <span className="text-sm font-semibold text-gray-800">{viewData.brand || '—'}</span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Received Qty</span>
                                        <span className="text-sm font-black text-green-700">
                                            {Number(viewData.quantity || 0).toLocaleString('en-IN')} KG
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Truck Details & Registration Numbers */}
                            <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100/70 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                        <span>Trucks Information</span>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                            {viewData.trucks || (Array.isArray(viewData.truckNumbers) && viewData.truckNumbers.length ? viewData.truckNumbers.length : 1)} Trucks
                                        </span>
                                    </span>
                                </div>
                                {Array.isArray(viewData.truckNumbers) && viewData.truckNumbers.filter(Boolean).length > 0 ? (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {viewData.truckNumbers.filter(Boolean).map((tNum, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-blue-200/80 shadow-xs text-xs font-bold text-gray-800">
                                                <span className="text-[10px] text-blue-500 font-semibold">Truck {idx + 1}:</span>
                                                <span>{tNum}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-xs font-semibold text-gray-600 bg-white px-3 py-1.5 rounded-xl border border-gray-100 inline-block">
                                        {viewData.truckNo || 'No truck numbers recorded'}
                                    </div>
                                )}
                            </div>

                            {/* 3. Cost of Goods & Financial Summary */}
                            <div>
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                                    Cost of Goods & Billing Details
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Invoice Value</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            ₹{Number(viewData.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    {viewData.country !== 'CHINA' && (
                                        <>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">IND Truck Fare</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    ₹{Number(viewData.indTruckFare || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">TRK CHG Fare</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    ₹{Number(viewData.truckChangeFare || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">SLOF / CF</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    ₹{Number(viewData.slofCf || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Bill</span>
                                                <span className="text-sm font-bold text-gray-900">
                                                    ₹{Number(viewData.totalBill || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Rebate ({viewData.rebate || 2.9}%)</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    ₹{Number(viewData.rebateAmount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Net Bill</span>
                                                <span className="text-sm font-bold text-gray-900">
                                                    ₹{Number(viewData.netBill || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Rate / KG (INR)</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    ₹{Number(viewData.rateKg || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Rs to Dollar</span>
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {Number(viewData.rsToDollar || 0).toFixed(4)}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Rate / KG (USD)</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            ${Number(viewData.rateKgUsd || 0).toFixed(3)}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Dollar Rate BDT</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {Number(viewData.dollarRateBdt || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Rate / KG BDT</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {Number(viewData.rateKgBdt || 0).toFixed(2)} BDT
                                        </span>
                                    </div>
                                    <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">C&F Expense</span>
                                        <span className="text-sm font-semibold text-gray-900">
                                            {Number(viewData.cfOtherExpense || 9).toFixed(2)} BDT
                                        </span>
                                    </div>
                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/80 col-span-2 sm:col-span-2">
                                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Final Costing / KG</span>
                                        <span className="text-base font-black text-emerald-800">
                                            {Number(viewData.costingKg || 0).toFixed(2)} BDT
                                        </span>
                                    </div>
                                </div>

                                {canShowEntryBy && (viewData.createdBy || viewData.createdAt) && (
                                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-3 border-t border-gray-100 mt-4">
                                        <span>Created By: <strong className="text-gray-600">{viewData.createdBy || 'Admin'}</strong></span>
                                        {viewData.createdAt && (
                                            <span>Created: {formatDate(viewData.createdAt)}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/40">
                            {canEdit && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const rec = viewData;
                                        setViewData(null);
                                        handleEdit(rec);
                                    }}
                                    className="px-5 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                                >
                                    <EditIcon className="w-3.5 h-3.5" />
                                    Edit Record
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
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default DealReceiveManagement;
