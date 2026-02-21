import React, { useState, useMemo, useRef, useEffect } from 'react';
import './WarehouseManagement.css';
import {
    PlusIcon,
    FunnelIcon,
    BoxIcon,
    TrendingUpIcon,
    BellIcon,
    ShoppingCartIcon,
    HomeIcon,
    XIcon,
    UserIcon,
    MapPinIcon,
    SearchIcon,
    TrashIcon,
    EditIcon,
    BarChartIcon,
    ChevronUpIcon,
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
import WarehouseReport from './WarehouseReport';
import { API_BASE_URL } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import axios from 'axios';
import { ChevronDownIcon } from '../../Icons';

const WarehouseManagement = () => {
    const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'warehouses'
    const [showWarehouseForm, setShowWarehouseForm] = useState(false);
    const [warehouseFormData, setWarehouseFormData] = useState({
        name: '',
        location: '',
        manager: '',
        capacity: '',
        type: 'General',
        status: 'Active'
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [warehouseData, setWarehouseData] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [showWhDropdown, setShowWhDropdown] = useState(false);
    const whDropdownRef = useRef(null);

    // Product Dropdown State
    const [products, setProducts] = useState([]);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productDropdownRef = useRef(null);

    // Brand Dropdown State
    const [showBrandDropdown, setShowBrandDropdown] = useState(false);
    const brandDropdownRef = useRef(null);

    // From and To Dropdown State
    const [showToDropdown, setShowToDropdown] = useState(false);
    const toDropdownRef = useRef(null);

    // Filtering State
    const [showWarehouseFilterPanel, setShowWarehouseFilterPanel] = useState(false);
    const warehouseFilterRef = useRef(null);
    const warehouseFilterButtonRef = useRef(null);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        productSearch: '',
        brandSearch: '',
        warehouseSearch: ''
    });

    const initialFilterDropdownState = {
        productName: false,
        brand: false,
        warehouse: false
    };
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);
    const warehouseFilterDropdownRef = useRef(null);

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products`);
            if (response.data) {
                const decryptedProducts = response.data.map(item => {
                    try {
                        const decrypted = decryptData(item.data);
                        return { ...decrypted, _id: item._id };
                    } catch (err) {
                        console.error("Error decrypting product:", err);
                        return null;
                    }
                }).filter(item => item !== null);
                setProducts(decryptedProducts);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const [productsWithLC, setProductsWithLC] = useState([]);

    const fetchWarehouses = async () => {
        try {
            const [whRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const whData = Array.isArray(whRes.data) ? whRes.data : [];
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];

            // 1. Calculate Global InHouse Totals from ALL Stock Data
            const globalInHouseMap = {};
            const stockDataDecrypted = stockData.map(item => {
                try {
                    return { ...decryptData(item.data), _id: item._id, createdAt: item.createdAt };
                } catch { return null; }
            }).filter(Boolean);

            stockDataDecrypted.forEach(d => {
                const key = `${(d.productName || d.product || '').trim().toLowerCase()}|${(d.brand || '').trim().toLowerCase()}`;
                if (!globalInHouseMap[key]) {
                    globalInHouseMap[key] = { pkt: 0, qty: 0 };
                }
                // Sum up InHouse values from all stock records (LC receives)
                globalInHouseMap[key].pkt += parseFloat(d.inHousePacket || d.inhousePkt || 0);
                globalInHouseMap[key].qty += parseFloat(d.inHouseQuantity || d.inhouseQty || 0);
            });

            // Track which unique product names have LC records (only those with positive stock)
            const activeProdKeys = Object.keys(globalInHouseMap).filter(key => globalInHouseMap[key].qty > 0);
            const uniqueProdsWithLC = [...new Set(activeProdKeys.map(k => k.split('|')[0]))];
            setProductsWithLC(uniqueProdsWithLC);

            // 2. Decrypt and normalize Warehouse records
            const allDecryptedWh = whData.map(item => {
                try {
                    const decrypted = decryptData(item.data);
                    const prodName = (decrypted.product || decrypted.productName || '').trim();
                    const brand = (decrypted.brand || '').trim();
                    const key = `${prodName.toLowerCase()}|${brand.toLowerCase()}`;

                    const whPkt = decrypted.whPkt !== undefined && decrypted.whPkt !== null ? decrypted.whPkt : 0;
                    const whQty = decrypted.whQty !== undefined && decrypted.whQty !== null ? decrypted.whQty : 0;

                    // A warehouse record is valid only if its source LC has positive total capacity
                    const hasLCRecord = globalInHouseMap[key] && globalInHouseMap[key].qty > 0;

                    return {
                        ...decrypted,
                        productName: prodName,
                        whPkt,
                        whQty,
                        packetSize: decrypted.packetSize || (whQty && whPkt ? (parseFloat(whQty) / parseFloat(whPkt)).toFixed(0) : 0),
                        _id: item._id,
                        recordType: 'warehouse',
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        hasLCRecord
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // 3. Normalize Stock records (treated as Warehouse rows)
            const decryptedStock = stockDataDecrypted.map(d => {
                const rawWh = (d.warehouse || d.whName || '').trim();
                // If it has no warehouse assigned, it's "General / In Stock" (Unallocated)
                const whName = rawWh || 'General / In Stock';

                const prodName = (d.productName || d.product || '').trim();
                const brand = (d.brand || '').trim();
                const key = `${prodName.toLowerCase()}|${brand.toLowerCase()}`;

                const inhousePkt = parseFloat(d.inHousePacket || d.inhousePkt || 0);
                const inhouseQty = parseFloat(d.inHouseQuantity || d.inhouseQty || 0);

                const whPkt = d.whPkt !== undefined && d.whPkt !== null ? d.whPkt : inhousePkt;
                const whQty = d.whQty !== undefined && d.whQty !== null ? d.whQty : inhouseQty;

                return {
                    ...d,
                    whName,
                    inhousePkt,
                    inhouseQty,
                    whPkt,
                    whQty,
                    productName: prodName,
                    packetSize: d.packetSize || d.size || 0,
                    recordType: 'stock',
                    hasLCRecord: true,
                    _id: d._id
                };
            }).filter(Boolean);

            // Combine for comprehensive view
            const combinedData = [...allDecryptedWh, ...decryptedStock];
            setWarehouseData(combinedData);
        } catch (error) {
            console.error('Error fetching warehouse data:', error);
        }
    };

    useEffect(() => {
        fetchWarehouses();
        fetchProducts();
    }, []);

    const [showWarehouseReport, setShowWarehouseReport] = useState(false);
    const [warehouseFilters, setWarehouseFilters] = useState({
        startDate: '',
        endDate: '',
        warehouse: '',
        productName: '',
        brand: ''
    });

    const [editingWarehouseId, setEditingWarehouseId] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, type: 'warehouse' });

    const filteredData = useMemo(() => {
        if (!warehouseData || !Array.isArray(warehouseData)) return [];
        return warehouseData.filter(item => {
            const search = searchQuery.toLowerCase();
            const matchesSearch = (
                (item.whName || '').toLowerCase().includes(search) ||
                (item.manager || '').toLowerCase().includes(search) ||
                (item.product || item.productName || '').toLowerCase().includes(search) ||
                (item.brand || '').toLowerCase().includes(search) ||
                (item.location || '').toLowerCase().includes(search)
            );

            if (!matchesSearch) return false;

            // Apply Advanced Filters
            if (warehouseFilters.startDate && item.createdAt) {
                if (new Date(item.createdAt) < new Date(warehouseFilters.startDate)) return false;
            }
            if (warehouseFilters.endDate && item.createdAt) {
                const endDate = new Date(warehouseFilters.endDate);
                endDate.setHours(23, 59, 59, 999);
                if (new Date(item.createdAt) > endDate) return false;
            }
            if (warehouseFilters.warehouse && item.whName !== warehouseFilters.warehouse) return false;
            if (warehouseFilters.productName && (item.productName || item.product) !== warehouseFilters.productName) return false;
            if (warehouseFilters.brand && item.brand !== warehouseFilters.brand) return false;

            return true;
        });
    }, [warehouseData, searchQuery, warehouseFilters]);


    const allWarehousesMaster = useMemo(() => {
        const master = {};
        warehouseData.forEach(item => {
            const name = (item.whName || item.warehouse || '').trim();
            if (name && !master[name] && item.recordType === 'warehouse') {
                master[name] = {
                    whName: name,
                    manager: item.manager || '-',
                    location: item.location || '-',
                    capacity: parseFloat(item.capacity) || 0,
                    _id: item._id
                };
            }
        });
        return master;
    }, [warehouseData]);

    const uniqueWarehouses = useMemo(() => {
        if (!filteredData || !Array.isArray(filteredData)) return [];
        const seen = new Set();
        return filteredData.reduce((acc, current) => {
            const name = (current.whName || current.warehouse || '').trim();
            if (name && !seen.has(name)) {
                seen.add(name);
                acc.push(allWarehousesMaster[name] || {
                    whName: name,
                    manager: current.manager || '-',
                    location: current.location || '-',
                    capacity: parseFloat(current.capacity) || 0,
                    _id: current._id
                });
            }
            return acc;
        }, []);
    }, [filteredData, allWarehousesMaster]);

    const globalBrandTotals = useMemo(() => {
        return warehouseData.reduce((acc, item) => {
            const brandKey = `${(item.productName || item.product || '').trim().toLowerCase()}|${(item.brand || '').trim().toLowerCase()}`;
            if (!acc[brandKey]) {
                acc[brandKey] = { inhouseQty: 0, inhousePkt: 0, whQty: 0, whPkt: 0 };
            }

            if (item.recordType === 'stock') {
                acc[brandKey].inhouseQty += parseFloat(item.inhouseQty || item.inHouseQuantity || 0);
                acc[brandKey].inhousePkt += parseFloat(item.inhousePkt || item.inHousePacket || 0);
            }

            if (item.recordType === 'warehouse' || (item.recordType === 'stock' && item.whName)) {
                acc[brandKey].whQty += parseFloat(item.whQty) || 0;
                acc[brandKey].whPkt += parseFloat(item.whPkt) || 0;
            }

            return acc;
        }, {});
    }, [warehouseData]);

    const warehouseProductCounts = useMemo(() => {
        const brandsPerWh = {};
        filteredData.forEach(item => {
            if (!brandsPerWh[item.whName]) {
                brandsPerWh[item.whName] = new Set();
            }

            const hasProduct = (item.productName && item.productName !== '-') || (item.product && item.product !== '-');
            const ihQty = parseFloat(item.inhouseQty) || 0;
            const whQty = parseFloat(item.whQty) || 0;

            // Only count if it's an active product with LC record and some stock
            if (hasProduct && item.hasLCRecord && (ihQty > 0 || whQty > 0)) {
                if (item.brand && item.brand !== '-') {
                    brandsPerWh[item.whName].add(item.brand);
                }
            }
        });

        const counts = {};
        Object.keys(brandsPerWh).forEach(whName => {
            counts[whName] = brandsPerWh[whName].size;
        });
        return counts;
    }, [filteredData]);

    const dashboardStats = useMemo(() => {
        const itemsWithStock = filteredData.filter(item => {
            const hasProduct = (item.productName && item.productName !== '-') || (item.product && item.product !== '-');
            const ihQty = parseFloat(item.inhouseQty) || 0;
            const whQty = parseFloat(item.whQty) || 0;
            return hasProduct && item.hasLCRecord && (ihQty > 0 || whQty > 0);
        });

        const uniqueBrands = new Set();
        itemsWithStock.forEach(item => {
            if (item.brand && item.brand !== '-') {
                uniqueBrands.add(item.brand);
            }
        });
        const totalItems = uniqueBrands.size;

        const totalCapacity = uniqueWarehouses.reduce((sum, wh) => sum + (parseFloat(wh.capacity) || 0), 0);

        // usedCapacity should sum whQty from ALL records in warehouseData for the warehouses currently in view
        const currentWhNames = new Set(uniqueWarehouses.map(wh => wh.whName));
        const usedCapacity = warehouseData.reduce((sum, item) => {
            const name = (item.whName || item.warehouse || '').trim();
            if (currentWhNames.has(name)) {
                return sum + (parseFloat(item.whQty) || 0);
            }
            return sum;
        }, 0);

        let availableCapacityPercent = 100;
        if (totalCapacity > 0) {
            availableCapacityPercent = Math.max(0, Math.round(((totalCapacity - usedCapacity) / totalCapacity) * 100));
        }

        const pendingTransfers = filteredData.filter(item => (parseFloat(item.transferPkt) || 0) > 0).length;
        const lowStockCount = itemsWithStock.filter(item => (parseFloat(item.whQty) || 0) < 50).length; // Default threshold of 50

        const uniqueBrandsInView = new Set();
        itemsWithStock.forEach(item => {
            if (item.brand && item.brand !== '-') {
                uniqueBrandsInView.add(`${(item.productName || item.product || '').trim().toLowerCase()}|${item.brand.trim().toLowerCase()}`);
            }
        });

        let totalInhouseStock = 0;
        uniqueBrandsInView.forEach(brandKey => {
            totalInhouseStock += globalBrandTotals[brandKey]?.inhouseQty || 0;
        });

        const totalWarehouseStock = filteredData.reduce((sum, item) => {
            if (item.recordType === 'warehouse' || (item.recordType === 'stock' && item.whName)) {
                return sum + (parseFloat(item.whQty || 0));
            }
            return sum;
        }, 0);

        return {
            totalItems,
            availableCapacity: `${availableCapacityPercent}%`,
            pendingTransfers,
            lowStockCount,
            totalInhouseStock: `${totalInhouseStock.toLocaleString()} kg`,
            totalWarehouseStock: `${totalWarehouseStock.toLocaleString()} kg`
        };
    }, [filteredData, uniqueWarehouses, globalBrandTotals, warehouseData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (whDropdownRef.current && !whDropdownRef.current.contains(event.target)) {
                setShowWhDropdown(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
                setShowProductDropdown(false);
            }
            if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
                setShowBrandDropdown(false);
            }
            if (toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
                setShowToDropdown(false);
            }
            if (warehouseFilterRef.current && !warehouseFilterRef.current.contains(event.target) &&
                warehouseFilterButtonRef.current && !warehouseFilterButtonRef.current.contains(event.target)) {
                setShowWarehouseFilterPanel(false);
            }
            if (productFilterRef.current && !productFilterRef.current.contains(event.target)) {
                setFilterDropdownOpen(prev => ({ ...prev, productName: false }));
            }
            if (brandFilterRef.current && !brandFilterRef.current.contains(event.target)) {
                setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            }
            if (warehouseFilterDropdownRef.current && !warehouseFilterDropdownRef.current.contains(event.target)) {
                setFilterDropdownOpen(prev => ({ ...prev, warehouse: false }));
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeleteStock = async (id, type = 'stock') => {
        try {
            await axios.delete(`${API_BASE_URL}/api/warehouses/${id}`);
            setWarehouseData(prev => prev.filter(item => item._id !== id));
            setDeleteConfirm({ show: false, id: null, type: type });
        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
        }
    };

    const handleEditWarehouse = (wh) => {
        setEditingWarehouseId(wh._id);
        setWarehouseFormData({
            name: wh.whName || '',
            location: wh.location || '',
            manager: wh.manager || '',
            capacity: wh.capacity || '',
            type: wh.type || 'General',
            status: wh.status || 'Active'
        });
        setShowWarehouseForm(true);
    };



    const getFilteredProducts = (search = '') => {
        const options = [...new Set(warehouseData.map(item => item.productName || item.product).filter(Boolean))].sort();
        return options.filter(p => (p || '').toString().toLowerCase().includes((search || '').toString().toLowerCase()));
    };

    const getFilteredBrands = (search = '', productName) => {
        const dataToFilter = productName ? warehouseData.filter(item => (item.productName || item.product) === productName) : warehouseData;
        const options = [...new Set(dataToFilter.map(item => item.brand).filter(Boolean))].sort();
        return options.filter(b => (b || '').toString().toLowerCase().includes((search || '').toString().toLowerCase()));
    };

    const getFilteredWarehouses = (search = '') => {
        const options = uniqueWarehouses.map(w => w.whName).sort();
        return options.filter(w => (w || '').toString().toLowerCase().includes((search || '').toString().toLowerCase()));
    };

    const groupedStockData = useMemo(() => {
        // 2. Group for Display: Warehouse -> Product -> Brands
        const groups = {};

        // Pre-initialize unique warehouses to maintain headers even if empty
        uniqueWarehouses.forEach(wh => {
            const whKey = wh.whName.trim();
            if (!groups[whKey]) {
                groups[whKey] = {
                    whName: whKey,
                    manager: wh.manager || '-',
                    location: wh.location || '-',
                    products: {}
                };
            }
        });

        // Filter and group items
        filteredData.filter(item => {
            // Check LOCAL quantity to avoid showing empty rows just because the brand exists globally
            const localIhQty = item.recordType === 'stock' ? (parseFloat(item.inhouseQty || item.inHouseQuantity || 0)) : 0;
            const localWhQty = parseFloat(item.whQty || 0);

            // Show if it has valid LC source AND has either local unallocated stock or physical warehouse stock
            return item.hasLCRecord && (localIhQty > 0 || localWhQty > 0);
        }).forEach(item => {
            const rawWhName = (item.whName || item.warehouse || '').trim();
            if (!rawWhName) return;

            const whKey = rawWhName;
            if (!groups[whKey]) {
                groups[whKey] = {
                    whName: whKey,
                    manager: item.manager || '-',
                    location: item.location || '-',
                    products: {}
                };
            }

            const prodName = (item.productName || item.product || '').trim();
            if (!prodName || prodName === '-') return;

            const brand = (item.brand || '').trim();
            const brandKey = `${prodName.toLowerCase()}|${brand.toLowerCase()}`;

            if (!groups[whKey].products[prodName]) {
                groups[whKey].products[prodName] = { productName: prodName, brands: {} };
            }

            if (!groups[whKey].products[prodName].brands[brand]) {
                groups[whKey].products[prodName].brands[brand] = {
                    ...item,
                    brand,
                    // Use Global Inhouse values
                    inhouseQty: globalBrandTotals[brandKey]?.inhouseQty || 0,
                    inhousePkt: globalBrandTotals[brandKey]?.inhousePkt || 0,
                    whQty: 0,
                    whPkt: 0
                };
            }

            // Only sum physical warehouse stock from warehouse-type records
            if (item.recordType === 'warehouse' || (item.recordType === 'stock' && item.whName)) {
                groups[whKey].products[prodName].brands[brand].whQty += parseFloat(item.whQty) || 0;
                groups[whKey].products[prodName].brands[brand].whPkt += parseFloat(item.whPkt) || 0;
            }
        });

        return Object.values(groups)
            .map(wh => ({
                ...wh,
                products: Object.values(wh.products).map(p => ({
                    ...p,
                    brands: Object.values(p.brands)
                }))
            }))
            .filter(wh => wh.products.length > 0);
    }, [warehouseData, uniqueWarehouses]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setWarehouseFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);
        try {
            const newWarehouse = {
                whName: warehouseFormData.name,
                manager: warehouseFormData.manager,
                location: warehouseFormData.location,
                capacity: parseFloat(warehouseFormData.capacity) || 0,
                type: warehouseFormData.type,
                status: warehouseFormData.status,
                product: '-',
                brand: '-',
                inhousePkt: 0,
                inhouseQty: 0,
                whPkt: 0,
                whQty: 0
            };

            const encryptedData = encryptData(newWarehouse);
            let response;
            if (editingWarehouseId) {
                response = await axios.put(`${API_BASE_URL}/api/warehouses/${editingWarehouseId}`, { data: encryptedData });
            } else {
                response = await axios.post(`${API_BASE_URL}/api/warehouses`, { data: encryptedData });
            }

            const decryptedResponse = {
                ...decryptData(response.data.data),
                _id: response.data._id,
                createdAt: response.data.createdAt,
                updatedAt: response.data.updatedAt
            };

            if (editingWarehouseId) {
                setWarehouseData(prev => prev.map(item => item._id === editingWarehouseId ? decryptedResponse : item));
            } else {
                setWarehouseData(prev => [decryptedResponse, ...prev]);
            }
            setSubmitStatus('success');
            setTimeout(() => {
                setShowWarehouseForm(false);
                setSubmitStatus(null);
                setEditingWarehouseId(null);
                setWarehouseFormData({
                    name: '',
                    location: '',
                    manager: '',
                    capacity: '',
                    type: 'General',
                    status: 'Active'
                });
            }, 1500);
        } catch (error) {
            console.error('Error adding warehouse:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Ware House Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage and track warehouse specific stock and locations</p>
                </div>
                {!showWarehouseForm && (
                    <div className="flex-1 max-w-md mx-6 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, location or manager..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all outline-none"
                            autoComplete="off"
                        />
                    </div>
                )}
                {!showWarehouseForm && (
                    <div className="flex justify-end gap-3 flex-wrap">
                        <div className="relative">
                            <button
                                ref={warehouseFilterButtonRef}
                                onClick={() => setShowWarehouseFilterPanel(!showWarehouseFilterPanel)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border h-[42px] ${showWarehouseFilterPanel || Object.values(warehouseFilters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${showWarehouseFilterPanel || Object.values(warehouseFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {showWarehouseFilterPanel && (
                                <div ref={warehouseFilterRef} className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[150] p-5 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                        <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                        <button
                                            onClick={() => {
                                                setWarehouseFilters({ startDate: '', endDate: '', warehouse: '', productName: '', brand: '' });
                                                setFilterSearchInputs({ productSearch: '', brandSearch: '', warehouseSearch: '' });
                                                setShowWarehouseFilterPanel(false);
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                        >
                                            RESET ALL
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <CustomDatePicker
                                                label="From Date"
                                                value={warehouseFilters.startDate}
                                                onChange={(e) => setWarehouseFilters({ ...warehouseFilters, startDate: e.target.value })}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={warehouseFilters.endDate}
                                                onChange={(e) => setWarehouseFilters({ ...warehouseFilters, endDate: e.target.value })}
                                                compact={true}
                                                rightAlign={true}
                                            />
                                        </div>

                                        <div className="space-y-1.5 relative" ref={warehouseFilterDropdownRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">WAREHOUSE</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.warehouseSearch}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: val });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true });
                                                    }}
                                                    onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: !filterDropdownOpen.warehouse })}
                                                    placeholder={warehouseFilters.warehouse || "Search Warehouse..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm ${warehouseFilters.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {warehouseFilters.warehouse && (
                                                        <button onClick={() => { setWarehouseFilters({ ...warehouseFilters, warehouse: '' }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.warehouse && (() => {
                                                const options = getFilteredWarehouses(filterSearchInputs.warehouseSearch);
                                                return options.length > 0 ? (
                                                    <div className="absolute z-[160] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {options.map(wh => (
                                                            <button
                                                                key={wh}
                                                                type="button"
                                                                onClick={() => { setWarehouseFilters({ ...warehouseFilters, warehouse: wh }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {wh}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <div className="space-y-1.5 relative" ref={productFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">PRODUCT</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.productSearch}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFilterSearchInputs({ ...filterSearchInputs, productSearch: val });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, productName: true });
                                                    }}
                                                    onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, productName: !filterDropdownOpen.productName })}
                                                    placeholder={warehouseFilters.productName || "Search Product..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm ${warehouseFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {warehouseFilters.productName && (
                                                        <button onClick={() => { setWarehouseFilters({ ...warehouseFilters, productName: '', brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '', brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.productName && (() => {
                                                const options = getFilteredProducts(filterSearchInputs.productSearch);
                                                return options.length > 0 ? (
                                                    <div className="absolute z-[160] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {options.map(prod => (
                                                            <button
                                                                key={prod}
                                                                type="button"
                                                                onClick={() => { setWarehouseFilters({ ...warehouseFilters, productName: prod }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                            >
                                                                {prod}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {warehouseFilters.productName && (
                                            <div className="space-y-1.5 relative" ref={brandFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">BRAND</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.brandSearch}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFilterSearchInputs({ ...filterSearchInputs, brandSearch: val });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                        }}
                                                        onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand })}
                                                        placeholder={warehouseFilters.brand || "Search Brand..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm ${warehouseFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {warehouseFilters.brand && (
                                                            <button onClick={() => { setWarehouseFilters({ ...warehouseFilters, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.brand && (() => {
                                                    const options = getFilteredBrands(filterSearchInputs.brandSearch, warehouseFilters.productName);
                                                    return options.length > 0 ? (
                                                        <div className="absolute z-[160] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {options.map(brand => (
                                                                <button
                                                                    key={brand}
                                                                    type="button"
                                                                    onClick={() => { setWarehouseFilters({ ...warehouseFilters, brand: brand }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
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
                            )}
                        </div>
                        <button
                            onClick={() => setShowWarehouseReport(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px]"
                        >
                            <BarChartIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium">Report</span>
                        </button>
                        <button
                            onClick={() => setShowWarehouseForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:scale-105 h-[42px]"
                        >
                            <HomeIcon className="w-5 h-5 text-white/90" />
                            <span className="text-sm font-medium">Add New</span>
                        </button>
                    </div>
                )}
            </div>

            {!showWarehouseForm && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'stock'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            Stock Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('warehouses')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'warehouses'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            Warehouse List
                        </button>
                    </div>


                </div>
            )}



            {/* Report Modal */}
            <WarehouseReport
                isOpen={showWarehouseReport}
                onClose={() => setShowWarehouseReport(false)}
                warehouseData={warehouseData}
                uniqueWarehouses={uniqueWarehouses}
                filters={warehouseFilters}
                setFilters={setWarehouseFilters}
            />

            {/* Warehouse Form Modal */}
            {
                showWarehouseForm && (
                    <div className="warehouse-form-container">
                        <div className="warehouse-form-bg-orb warehouse-form-bg-orb-1"></div>
                        <div className="warehouse-form-bg-orb warehouse-form-bg-orb-2"></div>

                        <div className="warehouse-form-header">
                            <div>
                                <h3 className="warehouse-form-title">Add New Warehouse</h3>
                            </div>
                            <button onClick={() => setShowWarehouseForm(false)} className="warehouse-form-close">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Warehouse Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <HomeIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="name"
                                            value={warehouseFormData.name}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Main Central Warehouse"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            required
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Location / Address</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <MapPinIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="location"
                                            value={warehouseFormData.location}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Dhaka, Bangladesh"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            required
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Warehouse Manager</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <UserIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="manager"
                                            value={warehouseFormData.manager}
                                            onChange={handleInputChange}
                                            placeholder="e.g. John Doe"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Capacity (KG)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <BoxIcon className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="number"
                                            name="capacity"
                                            value={warehouseFormData.capacity}
                                            onChange={handleInputChange}
                                            placeholder="e.g. 5000 KG"
                                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm"
                                            autoComplete="off"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Warehouse Type</label>
                                    <select
                                        name="type"
                                        value={warehouseFormData.type}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm cursor-pointer"
                                    >
                                        <option value="General">General</option>
                                        <option value="Cold Storage">Cold Storage</option>
                                        <option value="Bonded">Bonded</option>
                                        <option value="Distribution Center">Distribution Center</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 ml-1">Status</label>
                                    <select
                                        name="status"
                                        value={warehouseFormData.status}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all backdrop-blur-sm text-sm cursor-pointer"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Full">Full</option>
                                    </select>
                                </div>
                            </div>

                            <div className="warehouse-form-footer">
                                <div className="flex-1">
                                    {submitStatus === 'success' && (
                                        <p className="text-green-600 font-medium flex items-center animate-bounce">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Warehouse created successfully!
                                        </p>
                                    )}
                                    {submitStatus === 'error' && (
                                        <p className="text-red-600 font-medium flex items-center">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            Failed to create warehouse.
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowWarehouseForm(false)}
                                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center justify-center disabled:opacity-50 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 text-sm shadow-md hover:scale-105"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating...
                                        </span>
                                    ) : (
                                        <>
                                            <PlusIcon className="w-5 h-5 mr-2" />
                                            Create Warehouse
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            {
                !showWarehouseForm && (
                    <>
                        {/* Placeholder Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                            {[
                                { label: 'Total InHouse Stock', value: dashboardStats.totalInhouseStock, icon: BoxIcon, color: 'emerald' },
                                { label: 'Total Warehouse Stock', value: dashboardStats.totalWarehouseStock, icon: HomeIcon, color: 'blue' },
                                { label: 'Total Items', value: dashboardStats.totalItems.toString(), icon: BarChartIcon, color: 'indigo' },
                                { label: 'Available Capacity', value: dashboardStats.availableCapacity, icon: TrendingUpIcon, color: 'emerald' },
                                { label: 'Pending Transfers', value: dashboardStats.pendingTransfers.toString(), icon: BellIcon, color: 'amber' },
                                { label: 'Low Stock Alerts', value: dashboardStats.lowStockCount.toString(), icon: ShoppingCartIcon, color: 'red' },
                            ].map((card, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 bg-${card.color}-50 rounded-xl`}>
                                            <card.icon className={`w-6 h-6 text-${card.color}-600`} />
                                        </div>
                                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">+0%</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">{card.label}</p>
                                    <p className="text-2xl font-black text-gray-900 mt-1">{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {activeTab === 'stock' && (
                            filteredData.length > 0 ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WH Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                    <th colSpan="6" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        <div className="grid grid-cols-6 gap-4">
                                                            <div className="text-left font-bold text-gray-800">Brand</div>
                                                            <div className="text-right font-bold text-emerald-800 uppercase">InHouse QTY</div>
                                                            <div className="text-right font-bold text-emerald-800 uppercase">InHouse PKT</div>
                                                            <div className="text-right font-bold text-blue-800 uppercase">WareHouse QTY</div>
                                                            <div className="text-right font-bold text-blue-800 uppercase">WareHouse PKT</div>
                                                            <div className="text-right font-bold text-gray-500">Actions</div>
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {groupedStockData.map((whGroup, whIdx) => (
                                                    <React.Fragment key={whIdx}>
                                                        {whGroup.products.map((prodGroup, prodIdx) => (
                                                            <tr key={`${whIdx}-${prodIdx}`} className="hover:bg-gray-50/30 transition-colors group border-b border-gray-50">
                                                                <td className="px-6 py-4 align-top">
                                                                    {prodIdx === 0 && (
                                                                        <div className="text-sm font-bold text-gray-900">{whGroup.whName}</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 align-top">
                                                                    <div className="text-sm font-semibold text-gray-800">{prodGroup.productName}</div>
                                                                </td>
                                                                <td className="px-6 py-4 align-top" colSpan="6">
                                                                    <div className="space-y-4">
                                                                        {prodGroup.brands.map((brand, bIdx) => (
                                                                            <div key={bIdx} className="grid grid-cols-6 gap-4 items-center">
                                                                                <div className="text-sm text-gray-600 font-medium">{brand.brand}</div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {parseFloat(brand.inhouseQty || 0).toLocaleString()} kg
                                                                                </div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {(() => {
                                                                                        const pkt = brand.inhousePkt || 0;
                                                                                        const size = brand.packetSize || 0;
                                                                                        const whole = Math.floor(pkt);
                                                                                        const remainder = Math.round((pkt % 1) * size);
                                                                                        return remainder > 0 ? `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg` : whole.toLocaleString();
                                                                                    })()}
                                                                                </div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {parseFloat(brand.whQty || 0).toLocaleString()} kg
                                                                                </div>
                                                                                <div className="text-sm text-black text-right font-bold">
                                                                                    {(() => {
                                                                                        const pkt = brand.whPkt || 0;
                                                                                        const size = brand.packetSize || 0;
                                                                                        const whole = Math.floor(pkt);
                                                                                        const remainder = Math.round((pkt % 1) * size);
                                                                                        return remainder > 0 ? `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg` : whole.toLocaleString();
                                                                                    })()}
                                                                                </div>
                                                                                <div className="flex items-center justify-end gap-2">
                                                                                    <button onClick={() => handleEditStock(brand)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-4 h-4" /></button>
                                                                                    <button onClick={() => setDeleteConfirm({ show: true, id: brand._id, type: 'stock' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                                                                </div>
                                                                            </div>
                                                                        ))}

                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="flex flex-col items-center justify-center p-20">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                            <HomeIcon className="w-10 h-10 text-gray-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900">{searchQuery ? 'No Results Found' : 'Ware House is Empty'}</h3>
                                        <p className="text-gray-500 mt-2 text-center max-w-sm">
                                            {searchQuery ? `We couldn't find any warehouse records matching "${searchQuery}".` : "You haven't added any stock to the warehouse section yet. Start by transferring stock or adding new entries."}
                                        </p>
                                        {!searchQuery && (
                                            <button
                                                onClick={() => {
                                                    setShowStockForm(true);
                                                    setShowWarehouseForm(false);
                                                }}
                                                className="mt-8 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
                                            >
                                                Setup Ware House
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                        {activeTab === 'warehouses' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WH Name</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Manager</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Capacity</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Status</th>
                                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {uniqueWarehouses.map((wh, idx) => {
                                                const productCount = warehouseProductCounts[wh.whName] || 0;
                                                const isEmpty = productCount === 0;
                                                return (
                                                    <tr key={idx} className={`hover:bg-gray-50/30 transition-colors group ${isEmpty ? 'bg-amber-50/20' : ''}`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <HomeIcon className={`w-4 h-4 ${isEmpty ? 'text-amber-500' : 'text-blue-500'}`} />
                                                                <div className="text-sm font-bold text-gray-900">{wh.whName}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{wh.manager || '-'}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{wh.location || '-'}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{wh.capacity ? `${wh.capacity.toLocaleString()} KG` : '-'}</td>
                                                        <td className="px-6 py-4">
                                                            {isEmpty ? (
                                                                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                                                    No Product
                                                                </span>
                                                            ) : (
                                                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 w-fit">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                    {productCount} Product{productCount > 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleEditWarehouse(wh)}
                                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                                >
                                                                    <EditIcon className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirm({ show: true, id: wh._id, type: 'warehouse' })}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )
            }
            {deleteConfirm.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, id: null, type: 'stock' })}></div>
                    <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <TrashIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Confirm Delete</h3>
                        <p className="text-gray-500 text-center mb-8">Are you sure you want to delete this {deleteConfirm.type === 'warehouse' ? 'warehouse' : 'stock record'}? This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm({ show: false, id: null, type: 'stock' })}
                                className="flex-1 px-6 py-3 bg-gray-50 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteStock(deleteConfirm.id, deleteConfirm.type)}
                                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default WarehouseManagement;
