import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EditIcon, TrashIcon, UserIcon, EyeIcon, XIcon, BoxIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, TrendingUpIcon, DollarSignIcon, PlusIcon, FunnelIcon, FileTextIcon } from '../../Icons';
import { API_BASE_URL, SortIcon, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { decryptData } from '../../../utils/encryption';
import { generateExporterProfileReportPDF } from '../../../utils/pdfGenerator';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './Exporter.css';
import { hasPermission } from '../../../utils/permissionHelper';

const SearchableFilterSelect = ({ label, value, onChange, options = [], placeholder = 'Search...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const dropdownRef = useRef(null);

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
        <div className="space-y-1.5" ref={dropdownRef}>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{label}</label>
            <div className="relative">
                <div
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs cursor-pointer hover:bg-gray-100/70 transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                    <span className={`truncate ${value ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}>
                        {value || placeholder}
                    </span>
                    <div className="flex items-center gap-1">
                        {value && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange('');
                                }}
                                className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full"
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        )}
                        <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 space-y-1.5 animate-in fade-in zoom-in duration-100">
                        <div className="relative">
                            <input
                                autoFocus
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search..."
                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                            />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5">
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!value ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                All ({label}s)
                            </button>
                            {filteredOptions.map((opt, idx) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${value === opt ? 'bg-blue-50 text-blue-600 font-semibold' : highlightedIndex === idx ? 'bg-gray-100 text-gray-800' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                            {filteredOptions.length === 0 && (
                                <div className="px-2 py-2 text-center text-xs text-gray-400">No results found</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const Exporter = ({
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
    const isBorderManager = (currentUser?.role || '').toLowerCase() === 'border manager';
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [exporters, setExporters] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historyRecords, setHistoryRecords] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);
    const [expandedExporterId, setExpandedExporterId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contactPerson: '',
        email: '',
        phone: '',
        bin: '',
        tin: '',
        irc: '',
        status: 'Active',
        signature: ''
    });

    useEffect(() => { fetchExporters(); }, []);

    useEffect(() => {
        if (viewData) {
            document.body.style.overflow = 'hidden';
            fetchExportHistory(viewData.name);
            setHistorySearchQuery('');
            setExpandedHistoryIdx(null); // Reset expansion on new view
            setShowHistoryFilterPanel(false);
            setHistoryFilters({
                quickRange: 'all',
                startDate: '',
                endDate: '',
                supplier: '',
                product: '',
                brand: '',
                lcNo: '',
                port: ''
            });
        } else {
            document.body.style.overflow = 'auto';
            setHistoryRecords([]);
            setShowHistoryFilterPanel(false);
        }

        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [viewData]);

    const fetchExporters = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/exporters`);
            setExporters(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching exporters:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchExportHistory = async (exporterName) => {
        setHistoryLoading(true);
        try {
            const [stockRes, salesRes, cogRes, lcRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/stock`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/sales`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/cost-of-goods`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/lc-management`).catch(() => ({ data: [] }))
            ]);

            // Safe item parser for encrypted or unencrypted data
            const parseItem = (item) => {
                if (!item) return {};
                let d = item;
                if (item.data) {
                    if (typeof item.data === 'string') {
                        try {
                            const dec = decryptData(item.data);
                            if (dec && typeof dec === 'object') d = dec;
                        } catch (e) {}
                    } else if (typeof item.data === 'object') {
                        d = item.data;
                    }
                }
                return { ...item, ...d, _id: item._id || d._id };
            };

            const rawStockData = Array.isArray(stockRes.data) ? stockRes.data : [];
            const rawSalesData = Array.isArray(salesRes.data) ? salesRes.data : [];
            const rawCogData = Array.isArray(cogRes.data) ? cogRes.data : [];
            const rawLcData = Array.isArray(lcRes.data) ? lcRes.data : [];

            const stockData = rawStockData.map(parseItem);
            const salesData = rawSalesData.map(parseItem);
            const cogData = rawCogData.map(parseItem);
            const lcData = rawLcData.map(parseItem);

            // Build lookups from LC Management
            const lcMap = {};
            lcData.forEach(lc => {
                const cleanLc = (lc.lcNo || '').trim().toLowerCase();
                if (cleanLc) {
                    lcMap[cleanLc] = {
                        supplier: lc.supplier || lc.supplierName || '',
                        invoiceNo: lc.invoiceNo || lc.invoice || '',
                        exporter: lc.exporterName || lc.exporter || ''
                    };
                }
            });

            // Helper to calculate total bill from COG
            const getCogTotalBill = (cog) => {
                if (!cog) return 0;
                if (cog.totalBill !== undefined && cog.totalBill !== null && cog.totalBill !== '' && !isNaN(parseFloat(cog.totalBill))) {
                    return parseFloat(cog.totalBill);
                }
                if (cog.netBill !== undefined && cog.netBill !== null && cog.netBill !== '' && !isNaN(parseFloat(cog.netBill))) {
                    return parseFloat(cog.netBill);
                }
                const amt = parseFloat(cog.amount) || 0;
                const indTruck = parseFloat(cog.indTruckFare) || 0;
                const truckChange = parseFloat(cog.truckChangeFare) || 0;
                const slof = parseFloat(cog.slofCf) || 0;
                const total = amt + indTruck + truckChange + slof;
                return total > 0 ? total : amt;
            };

            // Build lookups from Cost of Goods
            const cogMap = {};
            cogData.forEach(cog => {
                const cleanLc = (cog.lcNo || '').trim().toLowerCase();
                const cleanProd = (cog.product || cog.productName || '').trim().toLowerCase();
                const cleanBrand = (cog.brand || '').trim().toLowerCase();

                const totalBill = getCogTotalBill(cog);
                const currency = (cog.country === 'CHINA' || cog.country === 'China') ? 'USD' : (cog.currency || 'RS');

                const cogObj = {
                    supplier: cog.supplier || cog.supplierName || '',
                    invoiceNo: cog.invoiceNo || cog.invoice || '',
                    exporter: cog.exporter || cog.exporterName || '',
                    totalBill: totalBill,
                    currency: currency
                };

                if (cleanLc) {
                    if (cleanProd && cleanBrand) cogMap[`${cleanLc}_${cleanProd}_${cleanBrand}`] = cogObj;
                    if (cleanProd && !cogMap[`${cleanLc}_${cleanProd}`]) cogMap[`${cleanLc}_${cleanProd}`] = cogObj;
                    if (cleanBrand && !cogMap[`${cleanLc}_${cleanBrand}`]) cogMap[`${cleanLc}_${cleanBrand}`] = cogObj;
                    if (!cogMap[cleanLc]) cogMap[cleanLc] = cogObj;
                }
            });

            const rows = [];
            const targetExporter = (exporterName || '').toLowerCase().trim();

            // 1. Process Stock (LC Receive) - records are flat
            stockData.forEach(record => {
                const status = (record.status || '').toLowerCase();
                if (status.includes('requested') || status.includes('rejected')) return;

                const cleanLc = (record.lcNo || '').trim().toLowerCase();
                const cleanProd = (record.productName || record.product || '').trim().toLowerCase();
                const cleanBrand = (record.brand || '').trim().toLowerCase();

                const cogMatch = cogMap[`${cleanLc}_${cleanProd}_${cleanBrand}`] ||
                    cogMap[`${cleanLc}_${cleanProd}`] ||
                    cogMap[`${cleanLc}_${cleanBrand}`] ||
                    cogMap[cleanLc] || {};

                const lcMatch = lcMap[cleanLc] || {};

                const exp = (record.exporter || record.exporterName || cogMatch.exporter || lcMatch.exporter || '').toLowerCase().trim();
                if (exp === targetExporter) {
                    const resolvedInvoiceNo = cogMatch.invoiceNo || '-';

                    const resolvedSupplier = (cogMatch.supplier && cogMatch.supplier !== '-')
                        ? cogMatch.supplier
                        : (lcMatch.supplier && lcMatch.supplier !== '-')
                            ? lcMatch.supplier
                            : (record.supplier && record.supplier !== '-')
                                ? record.supplier
                                : (record.supplierName && record.supplierName !== '-')
                                    ? record.supplierName
                                    : '-';

                    rows.push({
                        date: record.date || record.createdAt,
                        invoiceNo: resolvedInvoiceNo,
                        supplier: resolvedSupplier,
                        lcNo: record.lcNo || '-',
                        port: record.port || '-',
                        product: record.productName || record.product || '-',
                        brand: record.brand || '-',
                        totalBill: cogMatch.totalBill || 0,
                        currency: cogMatch.currency || 'RS',
                        rate: record.purchasedPrice || record.rate || record.price || 0,
                        bag: !isNaN(parseFloat(record.packet)) ? parseFloat(record.packet) : (!isNaN(parseFloat(record.bag)) ? parseFloat(record.bag) : (record.inHousePacket || 0)),
                        qty: !isNaN(parseFloat(record.quantity)) ? parseFloat(record.quantity) : (!isNaN(parseFloat(record.qty)) ? parseFloat(record.qty) : (record.inHouseQuantity || 0)),
                        truck: record.truckNo || record.truck || '-',
                        source: 'stock'
                    });
                }
            });

            // 2. Process Sales (Border Sale)
            salesData.forEach(sale => {
                const sTypeLow = (sale.saleType || '').toLowerCase();
                const cleanLc = (sale.lcNo || '').trim().toLowerCase();
                const lcMatch = lcMap[cleanLc] || {};
                const sExp = (sale.exporter || sale.exporterName || lcMatch.exporter || '').toLowerCase().trim();

                if ((sTypeLow === 'border' || sTypeLow === 'border sale') && sExp === targetExporter) {
                    if (sale.items && Array.isArray(sale.items)) {
                        sale.items.forEach(item => {
                            const cleanProd = (item.productName || item.product || '').trim().toLowerCase();
                            if (item.brandEntries && Array.isArray(item.brandEntries)) {
                                item.brandEntries.forEach(be => {
                                    const cleanBrand = (be.brand || '').trim().toLowerCase();

                                    const cogMatch = cogMap[`${cleanLc}_${cleanProd}_${cleanBrand}`] ||
                                        cogMap[`${cleanLc}_${cleanProd}`] ||
                                        cogMap[`${cleanLc}_${cleanBrand}`] ||
                                        cogMap[cleanLc] || {};

                                    const resolvedInvoiceNo = cogMatch.invoiceNo || '-';

                                    const resolvedSupplier = (cogMatch.supplier && cogMatch.supplier !== '-')
                                        ? cogMatch.supplier
                                        : (lcMatch.supplier && lcMatch.supplier !== '-')
                                            ? lcMatch.supplier
                                            : (sale.supplier && sale.supplier !== '-')
                                                ? sale.supplier
                                                : (sale.supplierName && sale.supplierName !== '-')
                                                    ? sale.supplierName
                                                    : (item.supplier && item.supplier !== '-')
                                                        ? item.supplier
                                                        : '-';

                                    rows.push({
                                        date: sale.date || sale.createdAt,
                                        invoiceNo: resolvedInvoiceNo,
                                        supplier: resolvedSupplier,
                                        lcNo: sale.lcNo || '-',
                                        port: sale.port || '-',
                                        product: item.productName || item.product || '-',
                                        brand: be.brand || '-',
                                        totalBill: cogMatch.totalBill || 0,
                                        currency: cogMatch.currency || 'RS',
                                        rate: be.rate || be.purchasedPrice || 0, 
                                        bag: be.bag || be.packet || '-',
                                        qty: be.quantity || 0,
                                        truck: be.truck || sale.truck || '-',
                                        source: 'sale'
                                    });
                                });
                            }
                        });
                    }
                }
            });

            // Sort by date (newest first)
            rows.sort((a, b) => new Date(a.date) - new Date(b.date));

            setHistoryRecords(rows);
        } catch (error) {
            console.error('Error fetching export history:', error);
            setHistoryRecords([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a JPG or PNG image.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({
                ...prev,
                signature: reader.result
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeSignature = () => {
        setFormData(prev => ({
            ...prev,
            signature: ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const payload = { ...formData };
            const url = editingId
                ? `${API_BASE_URL}/api/exporters/${editingId}`
                : `${API_BASE_URL}/api/exporters`;
            if (editingId) {
                await axios.put(url, payload);
            } else {
                await axios.post(url, payload);
            }
            setSubmitStatus('success');
            fetchExporters();
            setTimeout(() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
                setSubmitStatus(null);
            }, 2000);
        } catch (error) {
            console.error('Error saving exporter:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            address: '',
            contactPerson: '',
            email: '',
            phone: '',
            bin: '',
            tin: '',
            irc: '',
            bankName: '',
            branchName: '',
            accountNumber: '',
            routingNumber: '',
            swiftCode: '',
            status: 'Active',
            signature: ''
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (exporter) => {
        setFormData({
            name: exporter.name || '',
            address: exporter.address || '',
            contactPerson: exporter.contactPerson || '',
            email: exporter.email || '',
            phone: exporter.phone || '',
            bin: exporter.bin || '',
            tin: exporter.tin || '',
            irc: exporter.irc || '',
            bankName: exporter.bankName || '',
            branchName: exporter.branchName || '',
            accountNumber: exporter.accountNumber || '',
            routingNumber: exporter.routingNumber || '',
            swiftCode: exporter.swiftCode || '',
            status: exporter.status || 'Active',
            signature: exporter.signature || ''
        });
        setEditingId(exporter._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (cannotDelete) {
            alert('Forbidden: You do not have permission to delete exporters');
            return;
        }
        onDeleteConfirm({ show: true, type: 'exporter', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === exporters.length) { setSelectedItems(new Set()); setIsSelectionMode(false); }
        else setSelectedItems(new Set(exporters.map(i => i._id)));
    };

    const requestSort = (key) => {
        const direction = (sortConfig.exporter?.key === key && sortConfig.exporter?.direction === 'asc') ? 'desc' : 'asc';
        setSortConfig({ ...sortConfig, exporter: { key, direction } });
    };

    const sortData = (data) => {
        if (!sortConfig.exporter) return data;
        const { key, direction } = sortConfig.exporter;
        return [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const historyFilterPanelRef = useRef(null);
    const historyFilterButtonRef = useRef(null);

    const [historyFilters, setHistoryFilters] = useState({
        quickRange: 'all',
        startDate: '',
        endDate: '',
        supplier: '',
        product: '',
        brand: '',
        lcNo: '',
        port: ''
    });

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

    const availableSuppliers = [...new Set(historyRecords.map(r => r.supplier).filter(s => s && s !== '-'))].sort();
    const availableProducts = [...new Set(historyRecords.map(r => r.product).filter(p => p && p !== '-'))].sort();
    const availableBrands = [...new Set(historyRecords.map(r => r.brand).filter(b => b && b !== '-'))].sort();
    const availableLcs = [...new Set(historyRecords.map(r => r.lcNo).filter(l => l && l !== '-'))].sort();
    const availablePorts = [...new Set(historyRecords.map(r => r.port).filter(p => p && p !== '-'))].sort();

    const isFilterActive = 
        historyFilters.quickRange !== 'all' ||
        historyFilters.startDate !== '' ||
        historyFilters.endDate !== '' ||
        historyFilters.supplier !== '' ||
        historyFilters.product !== '' ||
        historyFilters.brand !== '' ||
        historyFilters.lcNo !== '' ||
        historyFilters.port !== '';

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

            // Supplier
            if (historyFilters.supplier && (row.supplier || '').toLowerCase() !== historyFilters.supplier.toLowerCase()) {
                return false;
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

            // Port
            if (historyFilters.port && (row.port || '').toLowerCase() !== historyFilters.port.toLowerCase()) {
                return false;
            }

            // Search Query
            const q = (historySearchQuery || '').toLowerCase().trim();
            if (!q) return true;
            return (
                (row.date || '').toLowerCase().includes(q) ||
                (row.invoiceNo || '').toLowerCase().includes(q) ||
                (row.supplier || '').toLowerCase().includes(q) ||
                (row.lcNo || '').toLowerCase().includes(q) ||
                (row.port || '').toLowerCase().includes(q) ||
                (row.product || '').toLowerCase().includes(q) ||
                (row.brand || '').toLowerCase().includes(q) ||
                String(row.truck || '').toLowerCase().includes(q)
            );
        });
    };

    const filteredHistory = getFilteredHistory();

    const totalBag = filteredHistory.reduce((s, r) => s + (parseFloat(r.bag) || 0), 0);
    const totalQty = filteredHistory.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
    const totalAmount = filteredHistory.reduce((s, r) => s + (parseFloat(r.rate) || 0) * (parseFloat(r.qty) || 0), 0);
    const totalBillSum = filteredHistory.reduce((s, r) => s + (parseFloat(r.totalBill) || 0), 0);

    return (
        <div className="exporter-container">
            <div className="exporter-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-1/4 text-center md:text-left">
                    <h2 className="exporter-title" style={{margin:0}}>Exporter Management</h2>
                </div>
                
                <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                    <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search exporters..."
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
                <div className="exporter-form-container">
                    <div className="exporter-form-header">
                        <h3 className="exporter-form-title">{editingId ? 'Edit Exporter' : 'New Exporter Registration'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="exporter-form-close">
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
                        className="exporter-form"
                    >
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Exporter Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Full Name" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">BIN</label>
                            <input type="text" name="bin" value={formData.bin} onChange={handleInputChange} required placeholder="BIN Number" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">TIN</label>
                            <input type="text" name="tin" value={formData.tin} onChange={handleInputChange} required placeholder="TIN Number" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">IRC Number</label>
                            <input type="text" name="irc" value={formData.irc} onChange={handleInputChange} required placeholder="IRC Number" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field exporter-form-field-full">
                            <label className="exporter-form-label">Address</label>
                            <textarea name="address" value={formData.address} onChange={handleInputChange} required placeholder="Full Address" rows="2" className="exporter-form-textarea" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Contact Person</label>
                            <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required placeholder="Contact Name" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Phone number" className="exporter-form-input" />
                        </div>
                        <div className="exporter-form-field">
                            <label className="exporter-form-label">Status</label>
                            <select name="status" value={formData.status} onChange={handleInputChange} className="exporter-form-select">
                                <option>Active</option>
                                <option>Inactive</option>
                            </select>
                        </div>
                        <div className="exporter-form-field exporter-form-field-full">
                            <label className="exporter-form-label">Digital Signature (JPG/PNG)</label>
                            <div className="mt-1 flex items-center gap-4">
                                {formData.signature ? (
                                    <div className="relative group">
                                        <img 
                                            src={formData.signature} 
                                            alt="Signature" 
                                            className="h-20 w-40 object-contain border border-gray-200 rounded bg-gray-50 p-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeSignature}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                            title="Remove signature"
                                        >
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all group">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <PlusIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mb-2" />
                                            <p className="text-xs text-gray-500">Click to upload signature</p>
                                        </div>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/png, image/jpeg, image/jpg"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                        <div className="exporter-form-footer">
                            {submitStatus === 'success' && (
                                <p className="exporter-form-success">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Exporter saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="exporter-form-error">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save exporter.
                                </p>
                            )}
                            <div className="exporter-form-spacer"></div>
                            <button type="submit" disabled={isSubmitting} className={`exporter-form-submit ${isSubmitting ? 'disabled' : ''}`}>
                                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (() => {
                const filteredExporters = exporters.filter(exporter => 
                    (exporter.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (exporter.bin || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (exporter.tin || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (exporter.irc || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (exporter.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (exporter.contactPerson || '').toLowerCase().includes(searchQuery.toLowerCase())
                );

                return (
                <div className="exporter-table-container">
                    {selectedItems.size > 0 && (
                        <div className="exporter-selection-bar">
                            <span className="exporter-selection-count">{selectedItems.size} items selected</span>
                            <div className="exporter-selection-actions">
                                <button onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }} className="exporter-selection-cancel">Cancel</button>
                                <button onClick={() => onDeleteConfirm({ show: true, type: 'exporter', id: null, isBulk: true })} className="exporter-selection-delete">
                                    <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="exporter-loading"><div className="exporter-spinner"></div></div>
                    ) : filteredExporters.length > 0 ? (
                        <>
                            {/* Desktop Table - hidden on mobile */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="exporter-table">
                                    <thead>
                                        <tr className="exporter-table-header-row" onMouseDown={() => startLongPress(null)} onMouseUp={endLongPress} onMouseLeave={endLongPress} onTouchStart={() => startLongPress(null)} onTouchEnd={endLongPress}>
                                            {isSelectionMode && (
                                                <th className="exporter-table-checkbox-header">
                                                    <input type="checkbox" checked={selectedItems.size === exporters.length} onChange={toggleSelectAll} className="exporter-checkbox" />
                                                </th>
                                            )}
                                            <th className="exporter-table-header" onClick={() => requestSort('name')}><div className="exporter-table-header-content">Exporter Name <SortIcon config={sortConfig.exporter} columnKey="name" /></div></th>
                                            <th className="exporter-table-header" onClick={() => requestSort('bin')}><div className="exporter-table-header-content">BIN <SortIcon config={sortConfig.exporter} columnKey="bin" /></div></th>
                                            <th className="exporter-table-header" onClick={() => requestSort('tin')}><div className="exporter-table-header-content">TIN <SortIcon config={sortConfig.exporter} columnKey="tin" /></div></th>
                                            <th className="exporter-table-header" onClick={() => requestSort('irc')}><div className="exporter-table-header-content">IRC <SortIcon config={sortConfig.exporter} columnKey="irc" /></div></th>
                                            <th className="exporter-table-header" onClick={() => requestSort('contactPerson')}><div className="exporter-table-header-content">Contact Person <SortIcon config={sortConfig.exporter} columnKey="contactPerson" /></div></th>
                                            <th className="exporter-table-header" onClick={() => requestSort('phone')}><div className="exporter-table-header-content">Phone <SortIcon config={sortConfig.exporter} columnKey="phone" /></div></th>
                                            <th className="exporter-table-header" onClick={() => requestSort('status')}><div className="exporter-table-header-content">Status <SortIcon config={sortConfig.exporter} columnKey="status" /></div></th>
                                            <th className="exporter-table-header">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="exporter-table-body">
                                        {sortData(filteredExporters).map((exporter) => (
                                            <tr
                                                key={exporter._id}
                                                className={`exporter-table-row ${selectedItems.has(exporter._id) ? 'selected' : ''}`}
                                                onMouseDown={() => startLongPress(exporter._id)} onMouseUp={endLongPress} onMouseLeave={endLongPress}
                                                onTouchStart={() => startLongPress(exporter._id)} onTouchEnd={endLongPress}
                                                onClick={() => { if (isLongPressTriggered.current) { isLongPressTriggered.current = false; return; } if (isSelectionMode) toggleSelection(exporter._id); }}
                                            >
                                                {isSelectionMode && (
                                                    <td className="exporter-table-cell">
                                                        <input type="checkbox" checked={selectedItems.has(exporter._id)} onChange={(e) => { e.stopPropagation(); toggleSelection(exporter._id); }} className="exporter-checkbox" />
                                                    </td>
                                                )}
                                                <td className="exporter-table-cell exporter-table-cell-name">{exporter.name}</td>
                                                <td className="exporter-table-cell">{exporter.bin || '-'}</td>
                                                <td className="exporter-table-cell">{exporter.tin || '-'}</td>
                                                <td className="exporter-table-cell">{exporter.irc || '-'}</td>
                                                <td className="exporter-table-cell">{exporter.contactPerson}</td>
                                                <td className="exporter-table-cell exporter-table-cell-muted">{exporter.phone}</td>
                                                <td className="exporter-table-cell">
                                                    <span className={`exporter-status-badge ${exporter.status === 'Active' ? 'active' : 'inactive'}`}>{exporter.status}</span>
                                                </td>
                                                <td className="exporter-table-cell">
                                                    <div className="exporter-table-actions">
                                                        <button onClick={(e) => { e.stopPropagation(); setViewData(exporter); }} className="exporter-action-btn hover:bg-gray-100 text-gray-400 hover:text-gray-600"><EyeIcon className="w-5 h-5" /></button>
                                                        {canManage && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleEdit(exporter); }} className="exporter-action-btn exporter-action-edit"><EditIcon className="w-5 h-5" /></button>
                                                        )}
                                                        {canDelete && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(exporter._id); }} className="exporter-action-btn exporter-action-delete"><TrashIcon className="w-5 h-5" /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card List - hidden on desktop */}
                            <div className="block md:hidden px-2 py-3 space-y-3">
                                {sortData(filteredExporters).map((exporter) => {
                                    const isExpanded = expandedExporterId === exporter._id;
                                    return (
                                        <div
                                            key={exporter._id}
                                            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${selectedItems.has(exporter._id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 shadow-sm'} ${isExpanded ? 'ring-1 ring-blue-50 shadow-md border-blue-200' : 'hover:border-gray-200 shadow-sm'}`}
                                            onTouchStart={() => startLongPress(exporter._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) {
                                                    toggleSelection(exporter._id);
                                                } else {
                                                    setExpandedExporterId(isExpanded ? null : exporter._id);
                                                }
                                            }}
                                        >
                                            {/* Card Header - Always Visible */}
                                            <div className="flex justify-between items-center p-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {isSelectionMode && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(exporter._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelection(exporter._id); }}
                                                            className="w-5 h-5 accent-blue-600 shrink-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{exporter.name}</p>
                                                        <p className="text-[10px] font-semibold text-blue-600 mt-0.5">BIN: {exporter.bin} | TIN: {exporter.tin} | IRC: {exporter.irc}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`exporter-status-badge ${exporter.status === 'Active' ? 'active' : 'inactive'} shrink-0 text-[10px] py-0.5 px-2`}>
                                                        {exporter.status}
                                                    </span>
                                                    <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>
                                                        {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expandable Body */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2.5 pt-3 border-t border-gray-50">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Contact Person</span>
                                                            <span className="text-gray-900 font-black">{exporter.contactPerson}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Phone Number</span>
                                                            <span className="text-gray-900 font-black font-mono">{exporter.phone}</span>
                                                        </div>
                                                        {exporter.address && (
                                                            <div className="flex justify-between items-start text-xs pt-1">
                                                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[9px] shrink-0">Office Address</span>
                                                                <span className="text-gray-900 font-black text-right max-w-[65%] line-clamp-2">{exporter.address}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Card Actions */}
                                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewData(exporter); }}
                                                            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 text-gray-700 rounded-xl text-xs font-black flex-1 hover:bg-gray-100 transition-all active:scale-95"
                                                        >
                                                            <EyeIcon className="w-4 h-4" /> View History
                                                        </button>
                                                        {canEdit && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEdit(exporter); }}
                                                                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"
                                                            >
                                                                <EditIcon className="w-4 h-4" /> Edit
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(exporter._id); }}
                                                                className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="exporter-empty">
                            <div className="exporter-empty-icon-wrapper"><UserIcon className="exporter-empty-icon" /></div>
                            <p className="exporter-empty-title">{searchQuery ? 'No exporters found matching your search' : 'No exporters found'}</p>
                            <p className="exporter-empty-subtitle">{searchQuery ? '' : 'Click "Add New" to register a new exporter'}</p>
                        </div>
                    )}
                </div>
            );
            })()}

            {/* Export History Modal */}
            {viewData && createPortal(
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 app-modal-overlay">
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
                                <h3 className="text-base sm:text-xl font-bold text-gray-900 leading-tight">Exporter History</h3>
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
                                        placeholder="Search by LC No, Product, Port, Brand..."
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

                            {/* Right: Filter, Close */}
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
                                                            supplier: '',
                                                            product: '',
                                                            brand: '',
                                                            lcNo: '',
                                                            port: ''
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

                                                {/* Supplier Filter */}
                                                <SearchableFilterSelect
                                                    label="Supplier"
                                                    value={historyFilters.supplier}
                                                    onChange={(val) => setHistoryFilters(prev => ({ ...prev, supplier: val }))}
                                                    options={availableSuppliers}
                                                    placeholder="All Suppliers"
                                                />

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

                                                {/* Port Filter */}
                                                <SearchableFilterSelect
                                                    label="Port"
                                                    value={historyFilters.port}
                                                    onChange={(val) => setHistoryFilters(prev => ({ ...prev, port: val }))}
                                                    options={availablePorts}
                                                    placeholder="All Ports"
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
                                    onClick={() => generateExporterProfileReportPDF(viewData, getFilteredHistory(), historyFilters)}
                                    className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-10 sm:px-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm"
                                >
                                    <FileTextIcon className="w-4 h-4" />
                                    <span className="hidden sm:block text-sm font-medium ml-2">Report</span>
                                </button>

                                <button 
                                    onClick={() => {
                                        setViewData(null);
                                        setHistorySearchQuery('');
                                        setExpandedHistoryIdx(null);
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
                                    placeholder="Search by LC No, Product, Port..."
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
                        <div className="flex-1 overflow-auto p-4 md:p-6 min-h-0 space-y-4 text-left">
                            {/* Exporter Info Card */}
                            {(viewData.bin || viewData.tin || viewData.irc || viewData.address) && (
                                <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl border border-gray-100 p-4 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {(viewData.bin || viewData.tin || viewData.irc) && (
                                            <div>
                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Registration Info</span>
                                                <p className="text-xs font-semibold text-gray-800 mt-0.5">
                                                    BIN: {viewData.bin || '-'} | TIN: {viewData.tin || '-'} | IRC: {viewData.irc || '-'}
                                                </p>
                                            </div>
                                        )}
                                        {viewData.address && (
                                            <div className="md:col-span-3">
                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Address</span>
                                                <p className="text-xs font-semibold text-gray-800 mt-0.5">{viewData.address}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {historyLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Desktop Table View */}
                                    <div className="hidden md:block bg-gray-50 rounded-xl border border-gray-200 overflow-x-auto">
                                        <table className="w-full text-left text-sm" style={{ minWidth: '55rem' }}>
                                            <thead className="bg-white border-b border-gray-200">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Date</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Invoice No</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">LC No</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Supplier</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Port</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Product</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide whitespace-nowrap">Brand</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Total Bill</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-center whitespace-nowrap">Truck</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Bag</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Qty</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Rate</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Total</th>
                                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right whitespace-nowrap">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredHistory.length > 0 ? (
                                                    <>
                                                        {(() => {
                                                            let runningBalance = 0;
                                                            return filteredHistory.map((row, idx) => {
                                                                const rowTotal = (parseFloat(row.rate) || 0) * (parseFloat(row.qty) || 0);
                                                                runningBalance += rowTotal;
                                                                return (
                                                                    <tr key={idx} className="hover:bg-white transition-colors">
                                                                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(row.date)}</td>
                                                                        <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{row.invoiceNo || '-'}</td>
                                                                        <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">{row.lcNo || '-'}</td>
                                                                        <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.supplier || '-'}</td>
                                                                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.port || '-'}</td>
                                                                        <td className="px-4 py-3 font-medium text-gray-800">{row.product || '-'}</td>
                                                                        <td className="px-4 py-3 text-purple-700 font-medium">{row.brand || '-'}</td>
                                                                        <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">
                                                                            {row.totalBill > 0 ? `${row.currency === 'USD' ? '$' : '₹'}${row.totalBill.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-center text-gray-600">{row.truck || '-'}</td>
                                                                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{row.bag ? Math.round(parseFloat(row.bag)).toLocaleString('en-US') : '-'}</td>
                                                                        <td className="px-4 py-3 text-right font-semibold text-gray-800">{row.qty ? Math.round(parseFloat(row.qty)).toLocaleString('en-US') : '-'}</td>
                                                                        <td className="px-4 py-3 text-right text-gray-700">{row.rate ? `৳${parseFloat(row.rate).toLocaleString('en-IN')}` : '-'}</td>
                                                                        <td className="px-4 py-3 text-right font-bold text-emerald-700">{rowTotal > 0 ? `৳${rowTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}</td>
                                                                        <td className="px-4 py-3 text-right font-bold text-blue-700">{(row.source !== 'sale' && runningBalance > 0) ? `৳${runningBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}</td>
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                        <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold">
                                                            <td colSpan={7} className="px-4 py-3 text-blue-700 text-xs uppercase tracking-wide">Grand Total</td>
                                                            <td className="px-4 py-3 text-right text-purple-800 font-bold">{totalBillSum > 0 ? `₹${totalBillSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}</td>
                                                            <td className="px-4 py-3"></td>
                                                            <td className="px-4 py-3 text-right text-blue-800">{Math.round(totalBag).toLocaleString('en-US')}</td>
                                                            <td className="px-4 py-3 text-right text-blue-800">{Math.round(totalQty).toLocaleString('en-US')}</td>
                                                            <td></td>
                                                            <td className="px-4 py-3 text-right text-emerald-800">৳{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                                            <td className="px-4 py-3 text-right text-blue-800">৳{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr>
                                                        <td colSpan="14" className="px-4 py-12 text-center text-gray-400">
                                                            <div className="flex flex-col items-center">
                                                                <BoxIcon className="w-8 h-8 mb-2 opacity-20" />
                                                                <p>No export history available</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="block md:hidden space-y-3">
                                        {filteredHistory.length > 0 ? (
                                            <>
                                                {(() => {
                                                    let runningBalance = 0;
                                                    return filteredHistory.map((row, idx) => {
                                                        const rowTotal = (parseFloat(row.rate) || 0) * (parseFloat(row.qty) || 0);
                                                        runningBalance += rowTotal;
                                                        const isExpanded = expandedHistoryIdx === idx;
                                                        return (
                                                            <div key={idx} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                                                {/* Card Toggle Header */}
                                                                <div
                                                                    className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                                                    onClick={() => setExpandedHistoryIdx(isExpanded ? null : idx)}
                                                                >
                                                                    <div className="flex-1 min-w-0 pr-4">
                                                                        <div className="flex items-center gap-1.5 text-xs text-left min-w-0 overflow-hidden">
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">{formatDate(row.date)}</span>
                                                                            <span className="text-gray-300 font-bold shrink-0">•</span>
                                                                            <span className="font-bold text-gray-800 truncate max-w-[100px] shrink-0" title={row.product}>{row.product || '-'}</span>
                                                                            <span className="text-gray-300 font-bold shrink-0">•</span>
                                                                            <span className="font-black text-blue-600 truncate min-w-0" title={row.lcNo}>{row.lcNo || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                        {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                                                    </div>
                                                                </div>

                                                                {/* Expandable Details */}
                                                                {isExpanded && (
                                                                    <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-4 duration-300">
                                                                        <div className="grid grid-cols-[125px_8px_1fr] gap-y-2 pt-3 text-xs items-baseline">
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice No</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-gray-900 truncate text-[11px]">{row.invoiceNo || '-'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Supplier</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-semibold text-gray-800 uppercase truncate text-[11px]">{row.supplier || '-'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-semibold text-gray-700 uppercase truncate text-[11px]">{row.port || '-'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brand</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-purple-600 uppercase truncate text-[11px]">{row.brand || '-'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Bill</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-gray-900 text-[11px]">
                                                                                {row.totalBill > 0 ? `${row.currency === 'USD' ? '$' : '₹'}${row.totalBill.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                                                                            </span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Truck No</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-semibold text-gray-700 text-[11px]">{row.truck || '-'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bag / Qty</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-gray-900 text-[11px]">
                                                                                {row.bag ? Math.round(parseFloat(row.bag)).toLocaleString('en-US') : '0'} / {row.qty ? Math.round(parseFloat(row.qty)).toLocaleString('en-US') : '0'}
                                                                            </span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rate</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-gray-700 text-[11px]">{row.rate ? `৳${parseFloat(row.rate).toLocaleString('en-IN')}` : '-'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Row Total</span>
                                                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-emerald-700 text-[11px]">{rowTotal > 0 ? `৳${rowTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}</span>

                                                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                                                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shrink-0"></span>
                                                                                Running Balance
                                                                            </span>
                                                                            <span className="text-blue-500 font-bold text-[10px]">:</span>
                                                                            <span className="font-bold text-blue-700 text-[11px]">
                                                                                {(row.source !== 'sale' && runningBalance > 0) ? `৳${runningBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </>
                                        ) : (
                                            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
                                                <BoxIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                <p className="text-sm">No export history available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Exporter;
