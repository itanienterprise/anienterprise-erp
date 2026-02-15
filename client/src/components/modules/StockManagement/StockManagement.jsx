import React, { useState, useEffect, useRef, useMemo } from 'react';
import './StockManagement.css';
import {
    SearchIcon,
    PlusIcon,
    TrashIcon,
    EyeIcon,
    EditIcon,
    XIcon,
    ChevronDownIcon,
    FunnelIcon,
    BarChartIcon,
    ShoppingCartIcon,
    BoxIcon,
    TrendingUpIcon,
    BellIcon,
    HomeIcon,
    ChevronUpIcon,
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
import StockReport from './StockReport';
import { encryptData, decryptData } from '../../../utils/encryption';
import { API_BASE_URL } from '../../../utils/helpers';
import { calculateStockData } from '../../../utils/stockHelpers';

const SortIcon = ({ config, columnKey }) => {
    if (!config || config.key !== columnKey) return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100" />;
    return config.direction === 'asc'
        ? <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-500" />
        : <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-500" />;
};

const StockManagement = ({
    stockRecords,
    setStockRecords,
    products,
    deleteConfirm,
    setDeleteConfirm,
    onEdit,
    onDelete,
    isLoading,
    fetchStockRecords,
    stockFormData,
    setStockFormData,
    showStockForm,
    setShowStockForm,
    editingId,
    setEditingId,
    isSubmitting,
    setIsSubmitting,
    submitStatus,
    setSubmitStatus,
    showStockReport,
    setShowStockReport,
    stockFilters,
    setStockFilters
}) => {

    // Filtering & Search (Main View)
    const [stockSearchQuery, setStockSearchQuery] = useState('');
    const [showStockFilterPanel, setShowStockFilterPanel] = useState(false);
    // stockFilters lifted to App.jsx

    // Filtering & Search (Modal View)
    const [viewRecord, setViewRecord] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' });

    // Dropdown & Selection State
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ lcNo: false, port: false, importer: false, brand: false, product: false });
    const [filterSearchInputs, setFilterSearchInputs] = useState({ lcNoSearch: '', portSearch: '', importerSearch: '', brandSearch: '', productSearch: '' });
    const initialFilterDropdownState = { lcNo: false, port: false, importer: false, brand: false, product: false };

    // Table Selection & Sorting
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [sortConfig, setSortConfig] = useState({
        stock: { key: 'date', direction: 'desc' },
        history: { key: 'date', direction: 'desc' }
    });

    // Long Press Logic
    const longPressTimer = useRef(null);
    const isLongPressTriggered = useRef(false);

    // Refs for Click Outside
    const stockFilterRef = useRef(null);
    const stockFilterButtonRef = useRef(null);
    const historyFilterRef = useRef(null);
    const filterButtonRef = useRef(null);

    const stockLcNoFilterRef = useRef(null);
    const stockPortFilterRef = useRef(null);
    const stockImporterFilterRef = useRef(null);
    const stockProductFilterRef = useRef(null);
    const stockBrandFilterRef = useRef(null);

    const lcNoFilterRef = useRef(null);
    const portFilterRef = useRef(null);
    const brandFilterRef = useRef(null);

    const productRefs = useRef([]);
    const brandRefs = useRef({});
    const portRef = useRef(null);
    const importerRef = useRef(null);

    // --- Effects ---

    useEffect(() => {
        const handleClickOutside = (event) => {
            // Main Stock Filter Panel
            if (showStockFilterPanel && stockFilterRef.current && !stockFilterRef.current.contains(event.target) && !stockFilterButtonRef.current.contains(event.target)) {
                setShowStockFilterPanel(false);
            }
            // History Filter Panel
            if (showHistoryFilterPanel && historyFilterRef.current && !historyFilterRef.current.contains(event.target) && !filterButtonRef.current.contains(event.target)) {
                setShowHistoryFilterPanel(false);
            }

            if (activeDropdown && !event.target.closest('input') && !event.target.closest('.dropdown-container')) {
                setActiveDropdown(null);
            }

            // Filter Dropdowns
            if (filterDropdownOpen.lcNo && stockLcNoFilterRef.current && !stockLcNoFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
            if (filterDropdownOpen.port && stockPortFilterRef.current && !stockPortFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.importer && stockImporterFilterRef.current && !stockImporterFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, importer: false }));
            if (filterDropdownOpen.product && stockProductFilterRef.current && !stockProductFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
            if (filterDropdownOpen.brand && stockBrandFilterRef.current && !stockBrandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));

            if (filterDropdownOpen.lcNo && lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
            if (filterDropdownOpen.port && portFilterRef.current && !portFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.brand && brandFilterRef.current && !brandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));

            // Custom Dropdowns in Form
            if (activeDropdown?.startsWith('product-')) {
                const pIdx = parseInt(activeDropdown.split('-')[1]);
                if (productRefs.current[pIdx] && !productRefs.current[pIdx].contains(event.target)) setActiveDropdown(null);
            }
            if (activeDropdown?.startsWith('brand-')) {
                const parts = activeDropdown.split('-');
                const pIdx = parseInt(parts[1]);
                const bIdx = parseInt(parts[2]);
                if (brandRefs.current[pIdx]?.[bIdx] && !brandRefs.current[pIdx][bIdx].contains(event.target)) setActiveDropdown(null);
            }
            if (activeDropdown === 'port' && portRef.current && !portRef.current.contains(event.target)) setActiveDropdown(null);
            if (activeDropdown === 'importer' && importerRef.current && !importerRef.current.contains(event.target)) setActiveDropdown(null);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setShowStockFilterPanel(false);
                setShowHistoryFilterPanel(false);
                setFilterDropdownOpen(initialFilterDropdownState);
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showStockFilterPanel, showHistoryFilterPanel, activeDropdown, filterDropdownOpen]);

    // --- Helpers ---

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const getFilteredOptions = (type) => {
        const options = stockRecords.map(item => item[type]).filter(Boolean);
        const uniqueOptions = [...new Set(options)].map(opt => ({ _id: opt, name: opt }));
        const inputVal = stockFormData[type] || '';
        return uniqueOptions.filter(opt => opt.name.toLowerCase().includes(inputVal.toLowerCase()));
    };

    const getFilteredProducts = (input) => {
        if (!input) return products;
        return products.filter(p => p.name.toLowerCase().includes(input.toLowerCase()));
    };

    const getFilteredBrands = (input, productName) => {
        const allBrands = new Set();
        stockRecords.forEach(r => {
            // Filter by product if provided
            if (productName && (r.productName || '').trim().toLowerCase() !== productName.toLowerCase()) {
                return;
            }
            if (r.brand) allBrands.add(r.brand);
            if (r.entries) r.entries.forEach(e => { if (e.brand) allBrands.add(e.brand) });
        });
        const brands = Array.from(allBrands).sort();
        if (!input) return brands;
        return brands.filter(b => b.toLowerCase().includes(input.toLowerCase()));
    };

    // --- Handlers ---

    const handleStockInputChange = (e, pIndex = null) => {
        const { name, value } = e.target;
        if (pIndex !== null) {
            const updatedProducts = [...stockFormData.productEntries];
            updatedProducts[pIndex] = { ...updatedProducts[pIndex], [name]: value };
            setStockFormData({ ...stockFormData, productEntries: updatedProducts });
        } else {
            setStockFormData({ ...stockFormData, [name]: value });
        }
    };

    const handleProductModeToggle = (pIndex, isMulti) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].isMultiBrand = isMulti;
        if (!isMulti && updatedProducts[pIndex].brandEntries.length > 1) {
            updatedProducts[pIndex].brandEntries = [updatedProducts[pIndex].brandEntries[0]];
        }
        setStockFormData({ ...stockFormData, productEntries: updatedProducts });
    };

    const handleBrandEntryChange = (pIndex, bIndex, field, value) => {
        const updatedProducts = [...stockFormData.productEntries];
        const entry = updatedProducts[pIndex].brandEntries[bIndex];
        entry[field] = value;

        // Auto-recalculate dependent fields
        const packetSize = parseFloat(entry.packetSize) || 0;
        const packet = parseFloat(entry.packet) || 0;
        const sweepedPacket = parseFloat(entry.sweepedPacket) || 0;

        // 1. QTY = Packet * Size
        if (field === 'packet' || field === 'packetSize') {
            entry.quantity = (packet * packetSize).toFixed(2);
        }

        // 2. SWPQTY = Swp Pkt * Size
        // 3. INHOUSE PKT = Packet - Swp Pkt
        // 4. INHOUSE QTY = InHouse Pkt * Size
        if (field === 'packet' || field === 'packetSize' || field === 'sweepedPacket') {
            entry.sweepedQuantity = (sweepedPacket * packetSize).toFixed(2);
            entry.inHousePacket = (packet - sweepedPacket).toFixed(2);
            entry.inHouseQuantity = (parseFloat(entry.inHousePacket) * packetSize).toFixed(2);
        }

        updatedProducts[pIndex].brandEntries[bIndex] = entry;

        // Calculate Product Total Quantity
        let productTotalQuantity = 0;
        updatedProducts[pIndex].brandEntries.forEach(be => {
            productTotalQuantity += parseFloat(be.quantity) || 0;
        });
        updatedProducts[pIndex].totalQuantity = productTotalQuantity.toFixed(2);

        // Calculate Global Totals
        const totalLcTruck = updatedProducts.length;
        let totalLcQuantity = 0;
        updatedProducts.forEach(prod => {
            prod.brandEntries.forEach(brandEntry => {
                totalLcQuantity += parseFloat(brandEntry.quantity) || 0;
            });
        });

        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            totalLcTruck: totalLcTruck,
            totalLcQuantity: totalLcQuantity.toFixed(2)
        });
    };

    const addProductEntry = () => {
        setStockFormData({
            ...stockFormData,
            productEntries: [
                ...stockFormData.productEntries,
                {
                    isMultiBrand: false,
                    productName: '',
                    truckNo: '',
                    brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
                }
            ]
        });
    };

    const removeProductEntry = (index) => {
        const updatedProducts = stockFormData.productEntries.filter((_, i) => i !== index);
        setStockFormData({ ...stockFormData, productEntries: updatedProducts });
    };

    const addBrandEntry = (pIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries.push({ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' });
        setStockFormData({ ...stockFormData, productEntries: updatedProducts });
    };

    const removeBrandEntry = (pIndex, bIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries = updatedProducts[pIndex].brandEntries.filter((_, i) => i !== bIndex);
        setStockFormData({ ...stockFormData, productEntries: updatedProducts });
    };

    const handleStockDropdownSelect = (field, value) => {
        setStockFormData({ ...stockFormData, [field]: value });
        setActiveDropdown(null);
    };

    const handleProductSelect = (pIndex, productName) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].productName = productName;
        setStockFormData({ ...stockFormData, productEntries: updatedProducts });
        setActiveDropdown(null);
    };

    const handleDropdownKeyDown = (e, dropdownId, onSelect, fieldOrValue) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => prev + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            if (editingId) {
                const originalIds = stockFormData.originalIds || [editingId];
                const validIds = new Set();
                const promises = [];

                for (let i = 0; i < stockFormData.productEntries.length; i++) {
                    const product = stockFormData.productEntries[i];
                    for (let j = 0; j < product.brandEntries.length; j++) {
                        const brandEntry = product.brandEntries[j];

                        const recordData = {
                            date: stockFormData.date,
                            lcNo: stockFormData.lcNo,
                            port: stockFormData.port,
                            importer: stockFormData.importer,
                            indianCnF: stockFormData.indianCnF,
                            indCnFCost: stockFormData.indCnFCost,
                            bdCnF: stockFormData.bdCnF,
                            bdCnFCost: stockFormData.bdCnFCost,
                            billOfEntry: stockFormData.billOfEntry,
                            totalLcTruck: stockFormData.totalLcTruck,
                            totalLcQuantity: stockFormData.totalLcQuantity,
                            status: stockFormData.status,

                            productName: product.productName,
                            truckNo: product.truckNo,

                            brand: brandEntry.brand,
                            purchasedPrice: brandEntry.purchasedPrice,
                            packet: brandEntry.packet,
                            packetSize: brandEntry.packetSize,
                            quantity: brandEntry.quantity,
                            unit: brandEntry.unit,
                            sweepedPacket: brandEntry.sweepedPacket,
                            sweepedQuantity: brandEntry.sweepedQuantity,
                            inHousePacket: brandEntry.inHousePacket,
                            inHouseQuantity: brandEntry.inHouseQuantity,
                        };

                        const encryptedData = encryptData(recordData);

                        if (brandEntry._id) {
                            validIds.add(brandEntry._id);
                            promises.push(fetch(`${API_BASE_URL}/api/stock/${brandEntry._id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ data: encryptedData }),
                            }));
                        } else {
                            promises.push(fetch(`${API_BASE_URL}/api/stock`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ data: encryptedData }),
                            }));
                        }
                    }
                }

                const idsToDelete = originalIds.filter(id => !validIds.has(id));
                idsToDelete.forEach(id => {
                    promises.push(fetch(`${API_BASE_URL}/api/stock/${id}`, { method: 'DELETE' }));
                });

                await Promise.all(promises);

            } else {
                const newRecords = [];
                stockFormData.productEntries.forEach(product => {
                    product.brandEntries.forEach(brandEntry => {
                        newRecords.push({
                            date: stockFormData.date,
                            lcNo: stockFormData.lcNo,
                            port: stockFormData.port,
                            importer: stockFormData.importer,
                            indianCnF: stockFormData.indianCnF,
                            indCnFCost: stockFormData.indCnFCost,
                            bdCnF: stockFormData.bdCnF,
                            bdCnFCost: stockFormData.bdCnFCost,
                            billOfEntry: stockFormData.billOfEntry,
                            totalLcTruck: stockFormData.totalLcTruck,
                            totalLcQuantity: stockFormData.totalLcQuantity,
                            status: stockFormData.status,
                            productName: product.productName,
                            truckNo: product.truckNo,
                            brand: brandEntry.brand,
                            purchasedPrice: brandEntry.purchasedPrice,
                            packet: brandEntry.packet,
                            packetSize: brandEntry.packetSize,
                            quantity: brandEntry.quantity,
                            unit: brandEntry.unit,
                            sweepedPacket: brandEntry.sweepedPacket,
                            sweepedQuantity: brandEntry.sweepedQuantity,
                            inHousePacket: brandEntry.inHousePacket,
                            inHouseQuantity: brandEntry.inHouseQuantity
                        });
                    });
                });

                const createPromises = newRecords.map(record =>
                    fetch(`${API_BASE_URL}/api/stock`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: encryptData(record) })
                    })
                );

                await Promise.all(createPromises);
            }

            setSubmitStatus('success');
            setTimeout(() => {
                resetStockForm();
                setShowStockForm(false);
                setSubmitStatus(null);
                if (fetchStockRecords) fetchStockRecords();
            }, 1500);

        } catch (error) {
            console.error("Error submitting stock:", error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetStockForm = () => {
        setStockFormData({
            date: new Date().toISOString().split('T')[0],
            lcNo: '',
            port: '',
            importer: '',
            indianCnF: '',
            indCnFCost: '',
            bdCnF: '',
            bdCnFCost: '',
            billOfEntry: '',
            totalLcTruck: '',
            totalLcQuantity: '',
            status: 'In Stock',
            productEntries: [{
                isMultiBrand: false,
                productName: '',
                truckNo: '',
                brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
            }]
        });
        setEditingId(null);
    };

    const handleEditInternal = (type, record) => {
        setEditingId(record._id || record.originalId);

        const isGrouped = record.entries && Array.isArray(record.entries);

        if (isGrouped) {
            const formProductEntry = {
                isMultiBrand: record.entries.length > 1,
                productName: record.productName,
                truckNo: record.entries[0].truckNo || '',
                brandEntries: record.entries.map(e => ({
                    _id: e._id,
                    brand: e.brand,
                    purchasedPrice: e.purchasedPrice,
                    packet: e.packet,
                    packetSize: e.packetSize,
                    quantity: e.quantity,
                    unit: e.unit,
                    sweepedPacket: e.sweepedPacket,
                    sweepedQuantity: e.sweepedQuantity,
                    inHousePacket: e.inHousePacket,
                    inHouseQuantity: e.inHouseQuantity
                }))
            };

            setStockFormData({
                date: record.date || new Date().toISOString().split('T')[0],
                lcNo: record.lcNo,
                port: record.port,
                importer: record.importer,
                indianCnF: record.indianCnF,
                indCnFCost: record.indCnFCost,
                bdCnF: record.bdCnF,
                bdCnFCost: record.bdCnFCost,
                billOfEntry: record.billOfEntry,
                totalLcTruck: record.totalLcTruck,
                totalLcQuantity: record.totalLcQuantity,
                status: record.status,
                productEntries: [formProductEntry],
                originalIds: record.allIds
            });

        } else {
            setStockFormData({
                date: record.date,
                lcNo: record.lcNo,
                port: record.port,
                importer: record.importer,
                indianCnF: record.indianCnF,
                indCnFCost: record.indCnFCost,
                bdCnF: record.bdCnF,
                bdCnFCost: record.bdCnFCost,
                billOfEntry: record.billOfEntry,
                totalLcTruck: record.totalLcTruck,
                totalLcQuantity: record.totalLcQuantity,
                status: record.status,
                productEntries: [{
                    isMultiBrand: false,
                    productName: record.productName,
                    truckNo: record.truckNo,
                    brandEntries: [{
                        _id: record._id,
                        brand: record.brand,
                        purchasedPrice: record.purchasedPrice,
                        packet: record.packet,
                        packetSize: record.packetSize,
                        quantity: record.quantity,
                        unit: record.unit,
                        sweepedPacket: record.sweepedPacket,
                        sweepedQuantity: record.sweepedQuantity,
                        inHousePacket: record.inHousePacket,
                        inHouseQuantity: record.inHouseQuantity
                    }]
                }],
                originalIds: [record._id]
            });
        }

        setShowStockForm(true);
    };

    const handleView = (type, record) => {
        setViewRecord({ data: record });
    };

    const sortData = (data, configType) => {
        const { key, direction } = sortConfig[configType];
        return [...data].sort((a, b) => {
            let aVal = key.split('.').reduce((o, i) => (o ? o[i] : null), a);
            let bVal = key.split('.').reduce((o, i) => (o ? o[i] : null), b);

            if (typeof a[key] !== 'undefined') aVal = a[key];
            if (typeof b[key] !== 'undefined') bVal = b[key];

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const requestSort = (configType, key) => {
        let direction = 'asc';
        if (sortConfig[configType].key === key && sortConfig[configType].direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ ...sortConfig, [configType]: { key, direction } });
    };

    // --- Calculations (Memoized) ---

    const stockData = useMemo(() => {
        return calculateStockData(stockRecords, stockFilters, stockSearchQuery);
    }, [stockRecords, stockFilters, stockSearchQuery]);

    const isStockGroupSelected = (productName) => {
        const groupItems = stockRecords.filter(r => r.productName === productName);
        return groupItems.length > 0 && groupItems.every(r => selectedItems.has(r._id));
    };

    const toggleStockGroupSelection = (productName) => {
        const groupItems = stockRecords.filter(r => r.productName === productName);
        const groupIds = groupItems.map(r => r._id);
        const allSelected = groupIds.every(id => selectedItems.has(id));

        const newSelected = new Set(selectedItems);
        if (allSelected) {
            groupIds.forEach(id => newSelected.delete(id));
        } else {
            groupIds.forEach(id => newSelected.add(id));
        }
        setSelectedItems(newSelected);
        setIsSelectionMode(newSelected.size > 0);
    };

    const startLongPress = (id) => {
        isLongPressTriggered.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPressTriggered.current = true;
            // Pass product name? logic seems to be handled in render
        }, 700);
    };
    const endLongPress = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    // --- Render ---
    const { displayRecords, totalPackets, totalQuantity, totalInHousePkt, totalInHousePktDecimalKg, totalInHouseQty, totalShortage, unit } = stockData;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="w-1/4">
                    <h2 className="text-2xl font-bold text-gray-800">Stock Management</h2>
                </div>

                <div className="flex-1 max-w-md mx-auto relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by LC, Port, Importer, Truck or Brand..."
                        value={stockSearchQuery}
                        onChange={(e) => setStockSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                    />
                </div>

                <div className="w-1/4 flex justify-end items-center gap-2">

                    <div className="relative">
                        <button
                            ref={stockFilterButtonRef}
                            onClick={() => setShowStockFilterPanel(!showStockFilterPanel)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showStockFilterPanel || Object.values(stockFilters).some(v => v !== '')
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <FunnelIcon className={`w-4 h-4 ${showStockFilterPanel || Object.values(stockFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                            <span className="text-sm font-medium">Filter</span>
                        </button>

                        {showStockFilterPanel && (
                            <div ref={stockFilterRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200">
                                <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                    <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                    <button onClick={() => { setStockFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', importer: '', productName: '' }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '', portSearch: '', importerSearch: '', brandSearch: '', productSearch: '' }); setShowStockFilterPanel(false); }} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">RESET ALL</button>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <CustomDatePicker label="From Date" value={stockFilters.startDate} onChange={(e) => setStockFilters({ ...stockFilters, startDate: e.target.value })} compact={true} />
                                        <CustomDatePicker label="To Date" value={stockFilters.endDate} onChange={(e) => setStockFilters({ ...stockFilters, endDate: e.target.value })} compact={true} rightAlign={true} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {/* LC No Filter */}
                                        <div className="space-y-1.5 relative" ref={stockLcNoFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC NUMBER</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.lcNoSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                                                    placeholder={stockFilters.lcNo || "Search LC..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {stockFilters.lcNo && (
                                                        <button onClick={() => { setStockFilters({ ...stockFilters, lcNo: '' }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.lcNo && (() => {
                                                const options = [...new Set(stockRecords.map(r => r.lcNo).filter(Boolean))].sort();
                                                const filtered = options.filter(lc => lc.toLowerCase().includes(filterSearchInputs.lcNoSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(lc => (
                                                            <button
                                                                key={lc}
                                                                type="button"
                                                                onClick={() => { setStockFilters({ ...stockFilters, lcNo: lc }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {lc}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Port Filter */}
                                        <div className="space-y-1.5 relative" ref={stockPortFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PORT</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.portSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                    placeholder={stockFilters.port || "Search Port..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {stockFilters.port && (
                                                        <button onClick={() => { setStockFilters({ ...stockFilters, port: '' }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.port && (() => {
                                                const options = [...new Set(stockRecords.map(r => r.port).filter(Boolean))].sort();
                                                const filtered = options.filter(p => p.toLowerCase().includes(filterSearchInputs.portSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(p => (
                                                            <button
                                                                key={p}
                                                                type="button"
                                                                onClick={() => { setStockFilters({ ...stockFilters, port: p }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Product Filter */}
                                        <div className="space-y-1.5 relative" ref={stockProductFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.productSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                    placeholder={stockFilters.productName || "Search Product..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {stockFilters.productName && (
                                                        <button onClick={() => { setStockFilters({ ...stockFilters, productName: '', brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.product && (() => {
                                                const options = products.map(p => p.name).sort();
                                                const filtered = options.filter(n => n.toLowerCase().includes(filterSearchInputs.productSearch.toLowerCase()));
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(name => (
                                                            <button
                                                                key={name}
                                                                type="button"
                                                                onClick={() => { setStockFilters({ ...stockFilters, productName: name, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Brand Filter - Only show if product is selected */}
                                        {stockFilters.productName && (
                                            <div className="space-y-1.5 relative animate-in fade-in slide-in-from-top-2 duration-300" ref={stockBrandFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">BRAND</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.brandSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                        placeholder={stockFilters.brand || "Search Brand..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {stockFilters.brand && (
                                                            <button onClick={() => { setStockFilters({ ...stockFilters, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.brand && (() => {
                                                    const options = getFilteredBrands(filterSearchInputs.brandSearch, stockFilters.productName);
                                                    return options.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {options.map(brand => (
                                                                <button
                                                                    key={brand}
                                                                    type="button"
                                                                    onClick={() => { setStockFilters({ ...stockFilters, brand }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                >
                                                                    {brand}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowStockReport(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95"
                    >
                        <BarChartIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Report</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                    { label: 'TOTAL PACKET', value: totalPackets.toLocaleString(), bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-900', labelColor: 'text-gray-400' },
                    { label: 'TOTAL QUANTITY', value: `${totalQuantity.toLocaleString()} ${unit}`, bgColor: 'bg-emerald-50/50', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                    { label: 'INHOUSE PKT', value: `${Math.floor(totalInHousePkt).toLocaleString()} - ${Math.round(totalInHousePktDecimalKg).toLocaleString()} kg`, bgColor: 'bg-amber-50/50', borderColor: 'border-amber-100', textColor: 'text-amber-700', labelColor: 'text-amber-600' },
                    { label: 'INHOUSE QTY', value: `${totalInHouseQty.toLocaleString()} ${unit}`, bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                    { label: 'SHORTAGE', value: `${totalShortage.toLocaleString()} ${unit}`, bgColor: 'bg-rose-50/50', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600' },
                ].map((card, i) => (
                    <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-4 rounded-xl shadow-sm transition-all hover:shadow-md`}>
                        <div className={`text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-1`}>{card.label}</div>
                        <div className={`text-xl font-bold ${card.textColor}`}>{card.value}</div>
                    </div>
                ))}
            </div>

            {showStockForm && (
                <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Stock' : 'New Stock Entry'}</h3>
                        <button onClick={() => { setShowStockForm(false); resetStockForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleStockSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                            <CustomDatePicker label="Date" name="date" value={stockFormData.date} onChange={handleStockInputChange} required />
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">LC No</label>
                                <input type="text" name="lcNo" value={stockFormData.lcNo} onChange={handleStockInputChange} required placeholder="LC Number" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none" />
                            </div>
                            {/* Port Dropdown */}
                            <div className="space-y-2 relative" ref={portRef}>
                                <label className="text-sm font-medium text-gray-700">Port</label>
                                <div className="relative group/dropdown">
                                    <input
                                        type="text"
                                        name="port"
                                        value={stockFormData.port}
                                        onChange={handleStockInputChange}
                                        onFocus={() => setActiveDropdown('port')}
                                        placeholder="Select or type port name"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none focus:border-blue-500 pr-10"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setActiveDropdown(activeDropdown === 'port' ? null : 'port')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                    >
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'port' ? 'rotate-180 text-blue-500' : ''}`} />
                                    </button>
                                    {activeDropdown === 'port' && (
                                        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl py-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                                            {ports.filter(p => !stockFormData.port || p.name.toLowerCase().includes(stockFormData.port.toLowerCase())).length > 0 ? (
                                                ports.filter(p => !stockFormData.port || p.name.toLowerCase().includes(stockFormData.port.toLowerCase())).map((p, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            handleStockInputChange({ target: { name: 'port', value: p.name } });
                                                            setActiveDropdown(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-2 text-sm text-gray-400 italic">No ports found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Importer Dropdown */}
                            <div className="space-y-2 relative" ref={importerRef}>
                                <label className="text-sm font-medium text-gray-700">Importer</label>
                                <div className="relative group/dropdown">
                                    <input
                                        type="text"
                                        name="importer"
                                        value={stockFormData.importer}
                                        onChange={handleStockInputChange}
                                        onFocus={() => setActiveDropdown('importer')}
                                        placeholder="Select or type importer"
                                        className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none focus:border-blue-500 pr-10"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setActiveDropdown(activeDropdown === 'importer' ? null : 'importer')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                    >
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'importer' ? 'rotate-180 text-blue-500' : ''}`} />
                                    </button>
                                    {activeDropdown === 'importer' && (
                                        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl py-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                                            {importers.filter(i => !stockFormData.importer || i.name.toLowerCase().includes(stockFormData.importer.toLowerCase())).length > 0 ? (
                                                importers.filter(i => !stockFormData.importer || i.name.toLowerCase().includes(stockFormData.importer.toLowerCase())).map((i, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            handleStockInputChange({ target: { name: 'importer', value: i.name } });
                                                            setActiveDropdown(null);
                                                        }}
                                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                    >
                                                        {i.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-2 text-sm text-gray-400 italic">No importers found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Second Row Fields */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">IND CNF</label>
                                <input type="text" name="indianCnF" value={stockFormData.indianCnF} onChange={handleStockInputChange} placeholder="IND CNF" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">IND CNF Cost</label>
                                <input type="number" name="indCnFCost" value={stockFormData.indCnFCost} onChange={handleStockInputChange} placeholder="0.00" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">BD CNF</label>
                                <input type="text" name="bdCnF" value={stockFormData.bdCnF} onChange={handleStockInputChange} placeholder="BD CNF" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Bill Of Entry</label>
                                <input type="text" name="billOfEntry" value={stockFormData.billOfEntry} onChange={handleStockInputChange} placeholder="Bill Of Entry" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none" />
                            </div>

                            {/* Third Row Totals */}
                            <div className="space-y-2 col-span-2">
                                <label className="text-sm font-medium text-gray-700">Total LC Truck</label>
                                <input type="number" name="totalLcTruck" value={stockFormData.totalLcTruck} readOnly placeholder="0" className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold" />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <label className="text-sm font-medium text-gray-700">Total LC Quantity</label>
                                <input type="number" name="totalLcQuantity" value={stockFormData.totalLcQuantity} readOnly placeholder="0.00" className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold" />
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-8">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <h4 className="text-lg font-bold text-gray-800">Product Details</h4>
                                <button type="button" onClick={addProductEntry} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                    <PlusIcon className="w-4 h-4" /> Add Product
                                </button>
                            </div>
                            {stockFormData.productEntries.map((product, pIndex) => (
                                <div key={pIndex} className="p-6 rounded-2xl bg-gray-50/30 border border-gray-100 relative group/product">
                                    {stockFormData.productEntries.length > 1 && (
                                        <button type="button" onClick={() => removeProductEntry(pIndex)} className="absolute -top-3 -right-3 p-2 bg-white text-red-400 shadow-md rounded-xl hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                        <div className="space-y-2 relative" ref={el => productRefs.current[pIndex] = el}>
                                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                                            <div className="relative group/dropdown">
                                                <input
                                                    type="text"
                                                    name="productName"
                                                    value={product.productName}
                                                    onChange={(e) => handleStockInputChange(e, pIndex)}
                                                    onFocus={() => setActiveDropdown(`product-${pIndex}`)}
                                                    placeholder="Select or type product"
                                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none focus:border-blue-500 pr-10"
                                                    autoComplete="off"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveDropdown(activeDropdown === `product-${pIndex}` ? null : `product-${pIndex}`)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                >
                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === `product-${pIndex}` ? 'rotate-180 text-blue-500' : ''}`} />
                                                </button>
                                                {activeDropdown === `product-${pIndex}` && (
                                                    <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl py-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                                                        {products.filter(p => !product.productName || p.name.toLowerCase().includes(product.productName.toLowerCase())).length > 0 ? (
                                                            products.filter(p => !product.productName || p.name.toLowerCase().includes(product.productName.toLowerCase())).map((p, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        handleStockInputChange({ target: { name: 'productName', value: p.name } }, pIndex);
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-4 py-2 text-sm text-gray-400 italic">No products found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Truck No</label>
                                            <input type="text" name="truckNo" value={product.truckNo} onChange={(e) => handleStockInputChange(e, pIndex)} className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg outline-none focus:border-blue-500" placeholder="Truck No" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Total Quantity</label>
                                            <input type="number" value={product.totalQuantity || 0} readOnly className="w-full px-4 py-2 bg-gray-50 border border-gray-200/60 rounded-lg outline-none text-gray-500 font-bold" placeholder="0.00" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Entry Mode</label>
                                            <div className="flex items-center gap-1 p-1 bg-gray-100/50 border border-gray-200/30 rounded-xl shadow-inner">
                                                <button
                                                    type="button"
                                                    onClick={() => handleProductModeToggle(pIndex, false)}
                                                    className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${!product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm scale-100' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
                                                >
                                                    Single
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleProductModeToggle(pIndex, true)}
                                                    className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm scale-100' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
                                                >
                                                    Multi
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Brand Entries Breakdown */}
                                    <div className="space-y-3 bg-white/40 p-4 rounded-2xl border border-gray-100/50 shadow-sm">
                                        <div className="hidden md:grid grid-cols-7 gap-3 mb-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Brand</label>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Purchased Price</label>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Packet</label>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Size</label>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Qty</label>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 text-center">Unit</label>
                                            <div className="w-8"></div>
                                        </div>
                                        {product.brandEntries.map((brandEntry, bIndex) => (
                                            <div key={bIndex} className="space-y-3 p-4 bg-white/70 border border-gray-200/50 rounded-2xl hover:border-blue-300/50 hover:shadow-md transition-all duration-300 group/brand relative">
                                                <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-center">
                                                    {/* Brand Dropdown */}
                                                    <div className="relative" ref={el => { if (!brandRefs.current[pIndex]) brandRefs.current[pIndex] = []; brandRefs.current[pIndex][bIndex] = el; }}>
                                                        <div className="relative group/dropdown">
                                                            <input
                                                                type="text"
                                                                value={brandEntry.brand}
                                                                placeholder="Select Brand"
                                                                onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'brand', e.target.value)}
                                                                onFocus={() => setActiveDropdown(`brand-${pIndex}-${bIndex}`)}
                                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                                                                autoComplete="off"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveDropdown(activeDropdown === `brand-${pIndex}-${bIndex}` ? null : `brand-${pIndex}-${bIndex}`)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                                            >
                                                                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === `brand-${pIndex}-${bIndex}` ? 'rotate-180 text-blue-500' : ''}`} />
                                                            </button>
                                                            {activeDropdown === `brand-${pIndex}-${bIndex}` && (
                                                                <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl py-2 max-h-48 overflow-y-auto animate-in fade-in zoom-in duration-200">
                                                                    {/* Brands logic: Unique brands from existing records */}
                                                                    {[...new Set(stockRecords.flatMap(r => [r.brand, ...(r.entries || []).map(e => e.brand)]).filter(Boolean))].filter(b => !brandEntry.brand || b.toLowerCase().includes(brandEntry.brand.toLowerCase())).length > 0 ? (
                                                                        [...new Set(stockRecords.flatMap(r => [r.brand, ...(r.entries || []).map(e => e.brand)]).filter(Boolean))].filter(b => !brandEntry.brand || b.toLowerCase().includes(brandEntry.brand.toLowerCase())).map((b, idx) => (
                                                                            <button
                                                                                key={idx}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    handleBrandEntryChange(pIndex, bIndex, 'brand', b);
                                                                                    setActiveDropdown(null);
                                                                                }}
                                                                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                            >
                                                                                {b}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-2 text-sm text-gray-400 italic">No brands found</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <input type="number" value={brandEntry.purchasedPrice} placeholder="Price" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'purchasedPrice', e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all" />
                                                    <input type="number" value={brandEntry.packet} placeholder="Packet" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'packet', e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all font-medium" />
                                                    <input type="number" value={brandEntry.packetSize} placeholder="Size" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'packetSize', e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all" />
                                                    <input type="text" value={brandEntry.quantity} readOnly className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-bold" />
                                                    <div className="relative group/unit">
                                                        <select value={brandEntry.unit} onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'unit', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 appearance-none transition-all cursor-pointer">
                                                            <option value="kg">kg</option>
                                                            <option value="pcs">pcs</option>
                                                            <option value="bags">bags</option>
                                                        </select>
                                                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none group-hover/unit:text-blue-500 transition-colors" />
                                                    </div>
                                                    <div className="flex items-center justify-center">
                                                        {product.isMultiBrand && (
                                                            <div className="flex gap-1.5 opacity-0 group-hover/brand:opacity-100 transition-all duration-300">
                                                                <button type="button" onClick={() => addBrandEntry(pIndex)} className="p-2 text-blue-500 hover:bg-blue-100 rounded-xl shadow-sm hover:shadow transition-all"><PlusIcon className="w-4 h-4" /></button>
                                                                {product.brandEntries.length > 1 && <button type="button" onClick={() => removeBrandEntry(pIndex, bIndex)} className="p-2 text-red-500 hover:bg-red-100 rounded-xl shadow-sm hover:shadow transition-all"><TrashIcon className="w-4 h-4" /></button>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Second Row for Calculations */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-3 py-2 bg-gray-50/50 rounded-xl border border-gray-100/50">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter pl-1">SWP. PKT</label>
                                                        <input type="number" value={brandEntry.sweepedPacket} placeholder="Packet" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'sweepedPacket', e.target.value)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-500 transition-all" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter pl-1">SWPQTY</label>
                                                        <input type="text" value={brandEntry.sweepedQuantity} readOnly placeholder="Qty" className="px-3 py-1.5 bg-white/50 border border-gray-100 rounded-lg text-xs text-gray-400 font-medium" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter pl-1">INHOUSE PKT</label>
                                                        <input type="text" value={brandEntry.inHousePacket} readOnly placeholder="Packet" className="px-3 py-1.5 bg-white/50 border border-gray-100 rounded-lg text-xs text-gray-400 font-medium" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter pl-1">INHOUSE QTY</label>
                                                        <input type="text" value={brandEntry.inHouseQuantity} readOnly placeholder="Qty" className="px-3 py-1.5 bg-white/50 border border-gray-100 rounded-lg text-xs text-gray-400 font-medium" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="col-span-1 md:col-span-2 pt-6 flex items-center justify-between border-t border-gray-100 relative z-20">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Status</label>
                                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 mt-1 w-fit">{stockFormData.status}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button type="button" onClick={() => { setShowStockForm(false); resetStockForm(); }} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Saving...</span>
                                    ) : (
                                        <span>Save Stock</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div >
            )}

            {!showStockForm && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                                    <th colSpan="3" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-left">Brand</div>
                                            <div className="text-center">Inhouse Packet</div>
                                            <div className="text-center">Inhouse Quantity</div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Sale Packet</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Sale Quantity</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stockData.displayRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-gray-400 font-medium italic">No stock records found</td>
                                    </tr>
                                ) : (
                                    stockData.displayRecords.map((group, gIdx) => (
                                        <tr key={group.productName || gIdx} className="hover:bg-gray-50/30 transition-colors group">
                                            <td className="px-6 py-4 align-top">
                                                <div className="text-sm font-semibold text-gray-900 mt-1">{group.productName}</div>
                                            </td>
                                            <td className="px-6 py-4 align-top" colSpan="3">
                                                <div className="space-y-3">
                                                    {group.brandList.map((brand, bIdx) => (
                                                        <div key={bIdx} className={`grid grid-cols-3 gap-4 items-center ${bIdx !== group.brandList.length - 1 ? 'border-b border-gray-100 pb-2' : 'pb-1'}`}>
                                                            <div className="text-sm text-gray-600 font-medium">{brand.brand || '-'}</div>
                                                            <div className="text-sm text-gray-600 text-center">{Math.floor(brand.inHousePacket).toLocaleString()} - {Math.round((brand.inHousePacket - Math.floor(brand.inHousePacket)) * brand.packetSize).toLocaleString()} kg</div>
                                                            <div className="text-sm text-gray-900 font-bold text-center">{Math.round(brand.inHouseQuantity).toLocaleString()} {group.unit}</div>
                                                        </div>
                                                    ))}
                                                    <div className="pt-2 border-t border-gray-200 mt-1 grid grid-cols-3 gap-4 items-center">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">Total Summary</span>
                                                        </div>
                                                        <div className="text-sm font-bold text-gray-900 text-center">
                                                            {Math.floor(group.inHousePacket).toLocaleString()} - {Math.round((group.inHousePacket - Math.floor(group.inHousePacket)) * (group.brandList[0]?.packetSize || 0)).toLocaleString()} kg
                                                        </div>
                                                        <div className="flex flex-col items-center">
                                                            <div className="text-sm font-bold text-gray-900">
                                                                {Math.round(group.inHouseQuantity).toLocaleString()} {group.unit}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-center">
                                                <div className="text-sm text-gray-400 mt-1">-</div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-center">
                                                <div className="text-sm text-gray-400 mt-1">-</div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-center">
                                                <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${group.inHouseQuantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                    {group.inHouseQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 align-top text-right">
                                                <div className="flex items-center justify-end gap-3 mt-1">
                                                    <button onClick={() => setViewRecord({ data: group })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><EyeIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleEdit('stock', group)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => setDeleteConfirm({ show: true, id: group.allIds, type: 'stock' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div >
                </div >
            )}

            {
                viewRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setViewRecord(null); setHistorySearchQuery(''); setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' }); setShowHistoryFilterPanel(false); }}></div>
                        <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl max-w-[95vw] w-full animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 rounded-t-3xl">
                                <div className="w-1/4">
                                    <h3 className="text-2xl font-bold text-gray-900">Stock History - {viewRecord.data.productName}</h3>
                                </div>

                                {/* Center Aligned Search Bar */}
                                <div className="flex-1 max-w-md mx-auto relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by LC, Port, Importer, Truck or Brand..."
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    />
                                </div>

                                <div className="w-1/4 flex justify-end items-center gap-2">
                                    <div className="relative">
                                        <button
                                            ref={filterButtonRef}
                                            onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                            <span className="text-sm font-medium">Filter</span>
                                        </button>

                                        {/* Floating Filter Panel */}
                                        {showHistoryFilterPanel && (
                                            <div ref={historyFilterRef} className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200">
                                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                                    <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                                                    <button
                                                        onClick={() => {
                                                            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' });
                                                            setShowHistoryFilterPanel(false);
                                                        }}
                                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                                                    >
                                                        Reset All
                                                    </button>
                                                </div>

                                                <div className="space-y-4">
                                                    {/* Date Range */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <CustomDatePicker
                                                            label="FROM DATE"
                                                            value={historyFilters.startDate}
                                                            onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                                                            placeholder="Select start date"
                                                            name="startDate"
                                                            compact={true}
                                                        />
                                                        <CustomDatePicker
                                                            label="TO DATE"
                                                            value={historyFilters.endDate}
                                                            onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                                                            placeholder="Select end date"
                                                            name="endDate"
                                                            compact={true}
                                                            rightAlign={true}
                                                        />
                                                    </div>

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

                                    <button onClick={() => { setViewRecord(null); setHistorySearchQuery(''); setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' }); setShowHistoryFilterPanel(false); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                        <XIcon className="w-6 h-6 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="p-8 flex-1 overflow-y-auto">
                                {(() => {
                                    const searchLower = historySearchQuery.toLowerCase().trim();
                                    const filteredRaw = stockRecords.filter(item => {
                                        const matchesProduct = (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase();
                                        if (!matchesProduct) return false;

                                        if (historyFilters.startDate && item.date < historyFilters.startDate) return false;
                                        if (historyFilters.endDate && item.date > historyFilters.endDate) return false;
                                        if (historyFilters.lcNo && (item.lcNo || '').trim() !== historyFilters.lcNo) return false;
                                        if (historyFilters.port && (item.port || '').trim() !== historyFilters.port) return false;
                                        if (historyFilters.brand) {
                                            const itemBrand = (item.brand || item.productName || '').trim().toLowerCase();
                                            const filterBrand = historyFilters.brand.toLowerCase();
                                            if (itemBrand !== filterBrand) return false;
                                        }

                                        if (!searchLower) return true;
                                        const matchesLC = (item.lcNo || '').trim().toLowerCase().includes(searchLower);
                                        const matchesPort = (item.port || '').trim().toLowerCase().includes(searchLower);
                                        const matchesImporter = (item.importer || '').trim().toLowerCase().includes(searchLower);
                                        const matchesTruck = (item.truckNo || '').trim().toLowerCase().includes(searchLower);
                                        const brandList = item.brand ? [item.brand] : (item.entries || []).map(e => e.brand);
                                        const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));
                                        return matchesLC || matchesPort || matchesImporter || matchesTruck || matchesBrand;
                                    });

                                    const groupedHistoryMap = filteredRaw.reduce((acc, item) => {
                                        const key = `${item.date}_${item.lcNo}_${item.truckNo}`;
                                        const quantity = parseFloat(item.quantity) || 0;
                                        const packet = parseFloat(item.packet) || 0;
                                        const inHousePacket = parseFloat(item.inHousePacket || item.packet) || 0;
                                        const inHouseQuantity = parseFloat(item.inHouseQuantity || item.quantity) || 0;
                                        const sweepedQuantity = parseFloat(item.sweepedQuantity) || 0;

                                        if (!acc[key]) {
                                            acc[key] = {
                                                ...item,
                                                allIds: [item._id],
                                                totalQuantity: quantity,
                                                totalPacket: packet,
                                                totalInHousePacket: inHousePacket,
                                                totalInHouseQuantity: inHouseQuantity,
                                                totalShortage: sweepedQuantity,
                                                isGrouped: false,
                                                entries: [
                                                    {
                                                        brand: item.brand || item.productName,
                                                        purchasedPrice: item.purchasedPrice,
                                                        packet: item.packet,
                                                        packetSize: item.packetSize,
                                                        quantity: item.quantity,
                                                        inHousePacket: item.inHousePacket || item.packet,
                                                        inHouseQuantity: item.inHouseQuantity || item.quantity,
                                                        sweepedPacket: item.sweepedPacket,
                                                        sweepedQuantity: item.sweepedQuantity,
                                                        unit: item.unit
                                                    }
                                                ]
                                            };
                                        } else {
                                            acc[key].allIds.push(item._id);
                                            acc[key].totalQuantity += quantity;
                                            acc[key].totalPacket += packet;
                                            acc[key].totalInHousePacket += inHousePacket;
                                            acc[key].totalInHouseQuantity += inHouseQuantity;
                                            acc[key].totalShortage += sweepedQuantity;
                                            acc[key].isGrouped = true;
                                            acc[key].entries.push({
                                                brand: item.brand || item.productName,
                                                purchasedPrice: item.purchasedPrice,
                                                packet: item.packet,
                                                packetSize: item.packetSize,
                                                quantity: item.quantity,
                                                inHousePacket: item.inHousePacket || item.packet,
                                                inHouseQuantity: item.inHouseQuantity || item.quantity,
                                                sweepedPacket: item.sweepedPacket,
                                                sweepedQuantity: item.sweepedQuantity,
                                                unit: item.unit
                                            });
                                        }
                                        return acc;
                                    }, {});

                                    const history = sortData(Object.values(groupedHistoryMap), 'history');
                                    const unit = history[0]?.unit || 'kg';

                                    const tPkts = history.reduce((sum, item) => sum + (parseFloat(item.totalPacket) || 0), 0);
                                    const tQty = history.reduce((sum, item) => sum + (parseFloat(item.totalQuantity) || 0), 0);
                                    const tIHPkt = history.reduce((sum, item) => sum + (parseFloat(item.totalInHousePacket) || 0), 0);
                                    const tIHQty = history.reduce((sum, item) => sum + (parseFloat(item.totalInHouseQuantity) || 0), 0);
                                    const tShort = history.reduce((sum, item) => sum + (parseFloat(item.totalShortage) || 0), 0);

                                    return (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                                {[
                                                    { label: 'TOTAL PACKET', value: tPkts.toLocaleString(), bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-900', labelColor: 'text-gray-400' },
                                                    { label: 'TOTAL QUANTITY', value: `${tQty.toLocaleString()} ${unit}`, bgColor: 'bg-emerald-50/50', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                                                    { label: 'INHOUSE PKT', value: tIHPkt.toLocaleString(), bgColor: 'bg-amber-50/50', borderColor: 'border-amber-100', textColor: 'text-amber-700', labelColor: 'text-amber-600' },
                                                    { label: 'INHOUSE QTY', value: `${tIHQty.toLocaleString()} ${unit}`, bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                                                    { label: 'SHORTAGE', value: `${tShort.toLocaleString()} ${unit}`, bgColor: 'bg-rose-50/50', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600' },
                                                ].map((card, i) => (
                                                    <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-4 rounded-xl shadow-sm transition-all hover:shadow-md`}>
                                                        <div className={`text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-1`}>{card.label}</div>
                                                        <div className={`text-xl font-bold ${card.textColor}`}>{card.value}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
                                                <table className="w-full text-left min-w-[800px]">
                                                    <thead>
                                                        <tr className="bg-white border-b border-gray-100">
                                                            <th onClick={() => requestSort('history', 'date')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <div className="flex items-center">Date <SortIcon config={sortConfig.history} columnKey="date" /></div>
                                                            </th>
                                                            <th onClick={() => requestSort('history', 'lcNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <div className="flex items-center">LC No <SortIcon config={sortConfig.history} columnKey="lcNo" /></div>
                                                            </th>
                                                            <th onClick={() => requestSort('history', 'port')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <div className="flex items-center">Port <SortIcon config={sortConfig.history} columnKey="port" /></div>
                                                            </th>
                                                            <th onClick={() => requestSort('history', 'importer')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <div className="flex items-center">Importer <SortIcon config={sortConfig.history} columnKey="importer" /></div>
                                                            </th>
                                                            <th onClick={() => requestSort('history', 'truckNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <div className="flex items-center">Truck No. <SortIcon config={sortConfig.history} columnKey="truckNo" /></div>
                                                            </th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Brand</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purchase Price</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Packet</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">InHouse Pkt</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">InHouse Qty</th>
                                                            <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-rose-600">Shortage</th>
                                                            <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {history.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="13" className="px-6 py-12 text-center text-gray-400 font-medium italic">No history records found</td>
                                                            </tr>
                                                        ) : (
                                                            history.map((item, idx) => (
                                                                <tr key={item._id || idx} className="hover:bg-gray-50/30 transition-colors group">
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.date}</td>
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.lcNo}</td>
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.port}</td>
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.importer}</td>
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.truckNo}</td>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm text-gray-600">{entry.brand}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm text-gray-600">{entry.purchasedPrice}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm text-gray-600">{entry.packet}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm text-gray-600">{entry.quantity} {entry.unit}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm text-gray-600">{entry.inHousePacket}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm text-gray-600">{entry.inHouseQuantity} {entry.unit}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top text-rose-600 font-medium">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm">{entry.sweepedQuantity} {entry.unit}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <button onClick={() => handleEdit('history', item)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-5 h-5" /></button>
                                                                            <button onClick={() => setDeleteConfirm({ show: true, id: item.allIds, type: 'history' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-5 h-5" /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Stock Report Modal moved to App.jsx for printing stability */}
        </div >
    );
};

export default StockManagement;
