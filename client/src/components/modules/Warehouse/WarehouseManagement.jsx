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
import axios from '../../../utils/api';
import { ChevronDownIcon } from '../../Icons';
import { calculatePktRemainder } from '../../../utils/stockHelpers';

const WarehouseManagement = ({ currentUser }) => {
    const isAdmin = currentUser?.role?.toLowerCase() === 'admin';
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
    const [salesRecords, setSalesRecords] = useState([]);

    // Expand/Collapse state for Mobile Warehouse Cards (one at a time)
    const [expandedMobileWHIndex, setExpandedMobileWHIndex] = useState(null);
    const [expandedMobileProdIndex, setExpandedMobileProdIndex] = useState(null);

    const toggleMobileWH = (idx) => {
        setExpandedMobileWHIndex(prev => {
            if (prev !== idx) setExpandedMobileProdIndex(null);
            return prev === idx ? null : idx;
        });
    };

    const toggleMobileProd = (idx) => {
        setExpandedMobileProdIndex(prev => prev === idx ? null : idx);
    };

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
        warehouseSearch: '',
        categorySearch: ''
    });

    const initialFilterDropdownState = {
        productName: false,
        brand: false,
        warehouse: false,
        category: false
    };
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);
    const warehouseFilterDropdownRef = useRef(null);
    const categoryFilterRef = useRef(null);

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/products`);
            if (response.data) {
                setProducts(response.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const [productsWithLC, setProductsWithLC] = useState([]);

    const fetchWarehouses = async () => {
        try {
            const [whRes, stockRes, salesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);

            const whData = Array.isArray(whRes.data) ? whRes.data : [];
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];

            // 1. Calculate Global InHouse Totals from ALL Stock Data
            const globalInHouseMap = {};
            const stockDataDecrypted = stockData.map(item => {
                try {
                    return { ...item, _id: item._id, createdAt: item.createdAt };
                } catch { return null; }
            }).filter(item => item && (item.status || '').toLowerCase() !== 'requested');

            stockDataDecrypted.forEach(d => {
                const key = `${(d.productName || d.product || '').trim().toLowerCase()}|${(d.brand || '').trim().toLowerCase()}`;
                if (!globalInHouseMap[key]) {
                    globalInHouseMap[key] = { pkt: 0, qty: 0 };
                }
                // Sum up InHouse values from all stock records (LC receives)
                globalInHouseMap[key].pkt += parseFloat(d.inHousePacket || d.inhousePkt || 0);
                globalInHouseMap[key].qty += parseFloat(d.inHouseQuantity || d.inhouseQty || 0);
            });

            // 1.1 Store Sales records (already decrypted by axios/server)
            const salesData = Array.isArray(salesRes.data) ? salesRes.data : [];
            setSalesRecords(salesData);

            // Track which unique product names have LC records (only those with positive stock)
            const activeProdKeys = Object.keys(globalInHouseMap).filter(key => globalInHouseMap[key].qty > 0);
            const uniqueProdsWithLC = [...new Set(activeProdKeys.map(k => k.split('|')[0]))]
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            setProductsWithLC(uniqueProdsWithLC);

            // 2. Normalize Warehouse records
            const allDecryptedWh = whData.map(item => {
                try {
                    const decrypted = item;
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
                        packetSize: decrypted.packetSize || (parseFloat(whQty) > 0 && parseFloat(whPkt) > 0 ? (parseFloat(whQty) / parseFloat(whPkt)).toFixed(0) : 0),
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

                const inhousePkt = parseFloat(d.inHousePacket !== undefined ? d.inHousePacket : (d.inhousePkt || 0));
                const inhouseQty = parseFloat(d.inHouseQuantity !== undefined ? d.inHouseQuantity : (d.inhouseQty || 0));

                const whPkt = d.whPkt !== undefined ? parseFloat(d.whPkt) : inhousePkt;
                const whQty = d.whQty !== undefined ? parseFloat(d.whQty) : inhouseQty;

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
        brand: '',
        category: ''
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
            // Apply Advanced Filters - "Stock Summary" shows state as of the Selected Date
            if (item.recordType !== 'warehouse') {
                if (warehouseFilters.endDate && item.createdAt) {
                    const endDate = new Date(warehouseFilters.endDate);
                    endDate.setHours(23, 59, 59, 999);
                    if (new Date(item.createdAt) > endDate) return false;
                }
            }
            if (warehouseFilters.warehouse && item.whName !== warehouseFilters.warehouse) return false;
            if (warehouseFilters.productName && (item.productName || item.product) !== warehouseFilters.productName) return false;
            if (warehouseFilters.brand && item.brand !== warehouseFilters.brand) return false;

            if (warehouseFilters.category) {
                const product = products.find(p => {
                    const pName = (p.name || p.productName || '').trim().toLowerCase();
                    const itemName = (item.productName || item.product || '').trim().toLowerCase();
                    return pName === itemName;
                });
                if (!product || (product.category || '').trim().toLowerCase() !== warehouseFilters.category.toLowerCase()) return false;
            }

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
        const brands = warehouseData.reduce((acc, item) => {
            const brandKey = `${(item.productName || item.product || '').trim().toLowerCase()}|${(item.brand || '').trim().toLowerCase()}`;
            if (!acc[brandKey]) {
                acc[brandKey] = {
                    inhouseQty: 0,
                    inhousePkt: 0,
                    whQty: 0,
                    whPkt: 0,
                    packetSize: parseFloat(item.packetSize || item.size || 0)
                };
            }

            // Sum physical stock from all sources into the global "Inhouse" view
            const physicalQty = parseFloat(item.whQty) || 0;
            const physicalPkt = parseFloat(item.whPkt) || 0;

            acc[brandKey].inhouseQty += physicalQty;
            acc[brandKey].inhousePkt += physicalPkt;

            if (item.recordType === 'warehouse' || (item.recordType === 'stock' && item.whName)) {
                acc[brandKey].whQty += physicalQty;
                acc[brandKey].whPkt += physicalPkt;
            }

            return acc;
        }, {});

        salesRecords.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            if (sStatus !== 'accepted' && sStatus !== 'pending') return;
            
            // Respect period filter: only include sales up to the selected end date
            if (warehouseFilters.endDate && sale.date) {
                const endLimit = new Date(warehouseFilters.endDate);
                endLimit.setHours(23, 59, 59, 999);
                if (new Date(sale.date) > endLimit) return;
            }

            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(saleItem => {
                    const prodName = (saleItem.productName || '').trim().toLowerCase();
                    if (saleItem.brandEntries && Array.isArray(saleItem.brandEntries)) {
                        saleItem.brandEntries.forEach(entry => {
                            const brandName = (entry.brand || '').trim().toLowerCase();
                            const brandKey = `${prodName}|${brandName}`;
                            const sQty = parseFloat(entry.quantity) || 0;

                            if (brands[brandKey]) {
                                // Exact match (multi-brand products)
                                const pktSize = brands[brandKey].packetSize || parseFloat(saleItem.packetSize || entry.packetSize) || 0;
                                brands[brandKey].inhouseQty -= sQty;
                                if (pktSize > 0) brands[brandKey].inhousePkt -= (sQty / pktSize);
                            } else if (brandName === '') {
                                // Single-entry product: sale has no brand; warehouse record uses product name as brand
                                const fallbackKey = `${prodName}|${prodName}`;
                                if (brands[fallbackKey]) {
                                    const pktSize = brands[fallbackKey].packetSize || parseFloat(saleItem.packetSize || entry.packetSize) || 0;
                                    brands[fallbackKey].inhouseQty -= sQty;
                                    if (pktSize > 0) brands[fallbackKey].inhousePkt -= (sQty / pktSize);
                                } else {
                                    // Last fallback: find the only brand key that starts with this product name
                                    const matchingKey = Object.keys(brands).find(k => k.startsWith(`${prodName}|`));
                                    if (matchingKey) {
                                        const pktSize = brands[matchingKey].packetSize || parseFloat(saleItem.packetSize || entry.packetSize) || 0;
                                        brands[matchingKey].inhouseQty -= sQty;
                                        if (pktSize > 0) brands[matchingKey].inhousePkt -= (sQty / pktSize);
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });

        // Ensure no negatives — all categories represent physical stock
        Object.keys(brands).forEach(k => {
            brands[k].inhouseQty = Math.max(0, brands[k].inhouseQty);
            brands[k].inhousePkt = Math.max(0, brands[k].inhousePkt);
        });

        // --- SECOND PASS: Include sales for 'GENERAL' products that have NO stock records ---
        // This pass discovery items that exist only in sales.
        salesRecords.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            // Allow Requested for discovery
            if (sStatus !== 'accepted' && sStatus !== 'pending' && sStatus !== 'requested') return;

            if (!sale.items || !Array.isArray(sale.items)) return;
            sale.items.forEach(si => {
                const prodName = (si.productName || '').trim().toLowerCase();
                const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === prodName);
                if ((product?.category || '').trim().toUpperCase() !== 'GENERAL') return;

                if (si.brandEntries && Array.isArray(si.brandEntries)) {
                    si.brandEntries.forEach(be => {
                        const brandName = (be.brand || '').trim().toLowerCase();
                        const brandKey = `${prodName}|${brandName}`;

                        // If it doesn't exist in 'brands', it means there are NO stock records for this brand
                        if (!brands[brandKey]) {
                            const pktSize = parseFloat(si.packetSize || be.packetSize) || 0;
                            brands[brandKey] = {
                                inhouseQty: 0,
                                inhousePkt: 0,
                                whQty: 0,
                                whPkt: 0,
                                packetSize: pktSize,
                                isPreSold: false
                            };
                        }

                        // We MUST NOT subtract sales here again if it was already in the brands list in Pass 1.
                        // The Pass 1 sales loop (lines 357+) already handles subtraction for ALL brands.
                        // This Second Pass is ONLY for initializing missing brands.
                    });
                }
            });
        });

        // Ensure no negatives and set isPreSold flag
        Object.keys(brands).forEach(k => {
            brands[k].isPreSold = brands[k].inhouseQty < 0;
            brands[k].inhouseQty = Math.max(0, brands[k].inhouseQty);
            brands[k].inhousePkt = Math.max(0, brands[k].inhousePkt);
        });

        return brands;
    }, [warehouseData, salesRecords]);

    const warehouseProductCounts = useMemo(() => {
        const brandsPerWh = {};
        filteredData.forEach(item => {
            if (!brandsPerWh[item.whName]) {
                brandsPerWh[item.whName] = new Set();
            }

            const hasProduct = (item.productName && item.productName !== '-') || (item.product && item.product !== '-');
            const ihQty = parseFloat(item.inhouseQty) || 0;
            const whQty = parseFloat(item.whQty) || 0;

            // Only count if it's an active product with some stock (either from LC or physical warehouse stock)
            if (hasProduct && (item.hasLCRecord || !item.hasLCRecord) && (ihQty > 0 || whQty > 0)) {
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

            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === ((item.productName || item.product || '').trim().toLowerCase()));
            const isGeneral = (product?.category || '').trim().toUpperCase() === 'GENERAL';

            return hasProduct && (item.hasLCRecord || !item.hasLCRecord) && (ihQty > 0 || whQty > 0 || (isGeneral && (ihQty < 0 || whQty < 0)));
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

        // 1. Total Inhouse Stock should be the company-wide (global) stock for all brands currently in the filtered view.
        // This value matches the "INHOUSE QTY" column in the table.
        const totalInhouseStock = [...uniqueBrandsInView].reduce((sum, key) => {
            return sum + (globalBrandTotals[key]?.inhouseQty || 0);
        }, 0);

        // Build a set of product names currently in view (for single-entry product lookup)
        const uniqueProductsInView = new Set(
            itemsWithStock.map(item => (item.productName || item.product || '').trim().toLowerCase()).filter(Boolean)
        );

        // Calculate total sales for products currently in view
        // 2. Total Warehouse Stock should be the physical stock present in the warehouses currently in view.
        let totalWarehouseSalesInView = 0;
        const currentWhNamesLower = new Set([...currentWhNames].map(name => name.toLowerCase().trim()));

        salesRecords.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            if (sStatus !== 'accepted' && sStatus !== 'pending') return;

            // Respect period filter: only include sales up to the selected end date
            if (warehouseFilters.endDate && sale.date) {
                const endLimit = new Date(warehouseFilters.endDate);
                endLimit.setHours(23, 59, 59, 999);
                if (new Date(sale.date) > endLimit) return;
            }

            if (sale.items) {
                sale.items.forEach(si => {
                    const prodName = (si.productName || '').trim().toLowerCase();
                    if (si.brandEntries) {
                        si.brandEntries.forEach(be => {
                            const brandName = (be.brand || '').trim().toLowerCase();
                            const whName = (be.warehouseName || '').trim().toLowerCase();
                            const key = `${prodName}|${brandName}`;

                            // Only subtract from warehouse total if it's a designated warehouse (not general pool)
                            // AND that warehouse is currently in the filtered view.
                            if (whName && whName !== 'general / in stock' && currentWhNamesLower.has(whName)) {
                                if (uniqueBrandsInView.has(key)) {
                                    // Multi-brand: exact match
                                    totalWarehouseSalesInView += (parseFloat(be.quantity) || 0);
                                } else if (brandName === '' && uniqueProductsInView.has(prodName)) {
                                    // Single-entry product: brand is empty, match by product name alone
                                    totalWarehouseSalesInView += (parseFloat(be.quantity) || 0);
                                }
                            }
                        });
                    }
                });
            }
        });

        const totalWarehouseStockRaw = filteredData.reduce((sum, item) => {
            if (item.recordType === 'warehouse' || (item.recordType === 'stock' && item.whName)) {
                return sum + (parseFloat(item.whQty || 0));
            }
            return sum;
        }, 0);
        const totalWarehouseStock = Math.max(0, totalWarehouseStockRaw - totalWarehouseSalesInView);

        return {
            totalItems,
            availableCapacity: `${availableCapacityPercent}%`,
            pendingTransfers,
            lowStockCount,
            totalInhouseStock: `${totalInhouseStock.toLocaleString()} kg`,
            totalWarehouseStock: `${totalWarehouseStock.toLocaleString()} kg`
        };
    }, [filteredData, uniqueWarehouses, globalBrandTotals, warehouseData, salesRecords]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
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
                setFilterDropdownOpen(initialFilterDropdownState);
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
            if (categoryFilterRef.current && !categoryFilterRef.current.contains(event.target)) {
                setFilterDropdownOpen(prev => ({ ...prev, category: false }));
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
        // Exclude "Requested" items from brand suggestions
        const dataToFilter = (productName ? warehouseData.filter(item => (item.productName || item.product) === productName) : warehouseData)
            .filter(item => (item.status || '').toLowerCase() !== 'requested');
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

            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === ((item.productName || item.product || '').trim().toLowerCase()));
            const isGeneral = (product?.category || '').trim().toUpperCase() === 'GENERAL';

            // Show if it has valid LC source OR manually transferred stock AND has either local unallocated stock, physical warehouse stock or it is a general category pre-sale
            return (item.hasLCRecord || !item.hasLCRecord) && (localIhQty !== 0 || localWhQty !== 0 || isGeneral);
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
                    whPkt: 0,
                    _saleQty: 0, // Track sales for this specific warehouse+brand
                    _salePkt: 0
                };
            }

            // 1. Sum physical warehouse stock from warehouse-type records
            if (item.recordType === 'warehouse' || (item.recordType === 'stock' && item.whName)) {
                groups[whKey].products[prodName].brands[brand].whQty += parseFloat(item.whQty) || 0;
                groups[whKey].products[prodName].brands[brand].whPkt += parseFloat(item.whPkt) || 0;
            }
        });

        // 2. Subtract sales matching this specific warehouse + brand
        salesRecords.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            if (sStatus !== 'accepted' && sStatus !== 'pending') return;

            // Respect period filter: only include sales up to the selected end date
            if (warehouseFilters.endDate && sale.date) {
                const endLimit = new Date(warehouseFilters.endDate);
                endLimit.setHours(23, 59, 59, 999);
                if (new Date(sale.date) > endLimit) return;
            }

            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(saleItem => {
                    const prodName = (saleItem.productName || '').trim();
                    if (saleItem.brandEntries && Array.isArray(saleItem.brandEntries)) {
                        saleItem.brandEntries.forEach(entry => {
                            const whName = (entry.warehouseName || '').trim();
                            const brandName = (entry.brand || '').trim();

                            if (!groups[whName] || !groups[whName].products[prodName]) return;

                            const sQty = parseFloat(entry.quantity) || 0;

                            // Try exact brand match first
                            if (groups[whName].products[prodName].brands[brandName]) {
                                const bObj = groups[whName].products[prodName].brands[brandName];
                                const pktSize = parseFloat(bObj.packetSize) || parseFloat(saleItem.packetSize || entry.packetSize) || 0;
                                bObj.whQty -= sQty;
                                if (pktSize > 0) bObj.whPkt -= (sQty / pktSize);
                            } else if (brandName === '') {
                                // Single-entry product: sale has empty brand, warehouse record may have '-' brand
                                const fallbackBrand = groups[whName].products[prodName].brands['-'];
                                if (fallbackBrand) {
                                    const pktSize = parseFloat(fallbackBrand.packetSize) || parseFloat(saleItem.packetSize || entry.packetSize) || 0;
                                    fallbackBrand.whQty -= sQty;
                                    if (pktSize > 0) fallbackBrand.whPkt -= (sQty / pktSize);
                                } else {
                                    // No '-' brand either, try the first (and only) brand for this product in this warehouse
                                    const brandKeys = Object.keys(groups[whName].products[prodName].brands);
                                    if (brandKeys.length === 1) {
                                        const bObj = groups[whName].products[prodName].brands[brandKeys[0]];
                                        const pktSize = parseFloat(bObj.packetSize) || parseFloat(saleItem.packetSize || entry.packetSize) || 0;
                                        bObj.whQty -= sQty;
                                        if (pktSize > 0) bObj.whPkt -= (sQty / pktSize);
                                    }
                                }
                            }
                        });
                    }
                });
            }
        });

        // 3. Final cleanup: Ensure no negatives — all categories represent physical stock
        Object.values(groups).forEach(wh => {
            Object.values(wh.products).forEach(p => {
                Object.values(p.brands).forEach(b => {
                    b.whQty = Math.max(0, b.whQty);
                    b.whPkt = Math.max(0, b.whPkt);
                });
            });
        });

        // --- SECOND PASS: Include sales for 'GENERAL' products that have NO warehouse stock records yet ---
        salesRecords.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            // Allow Requested for discovery
            if (sStatus !== 'accepted' && sStatus !== 'pending' && sStatus !== 'requested') return;

            if (!sale.items || !Array.isArray(sale.items)) return;
            sale.items.forEach(si => {
                const prodName = (si.productName || '').trim().toLowerCase();
                const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === prodName);
                if ((product?.category || '').trim().toUpperCase() !== 'GENERAL') return;

                if (si.brandEntries && Array.isArray(si.brandEntries)) {
                    si.brandEntries.forEach(be => {
                        const whName = (be.warehouseName || 'General / In Stock').trim();
                        const brandName = (be.brand || '').trim();
                        const brandKey = `${prodName}|${brandName.toLowerCase()}`;

                        if (!groups[whName]) {
                            const baseWh = uniqueWarehouses.find(uw => uw.whName === whName);
                            if (baseWh) {
                                groups[whName] = {
                                    whName: whName,
                                    manager: baseWh.manager || '-',
                                    location: baseWh.location || '-',
                                    products: {}
                                };
                            } else {
                                return;
                            }
                        }

                        if (!groups[whName].products[si.productName]) {
                            groups[whName].products[si.productName] = { productName: si.productName, brands: {} };
                        }

                        if (!groups[whName].products[si.productName].brands[brandName]) {
                            const pktSize = parseFloat(si.packetSize || be.packetSize) || 0;
                            groups[whName].products[si.productName].brands[brandName] = {
                                brand: brandName,
                                inhouseQty: globalBrandTotals[brandKey]?.inhouseQty || 0,
                                inhousePkt: globalBrandTotals[brandKey]?.inhousePkt || 0,
                                isPreSold: globalBrandTotals[brandKey]?.isPreSold || false,
                                whQty: 0,
                                whPkt: 0,
                                packetSize: pktSize,
                                recordType: 'warehouse'
                            };
                        }

                        // Note: Sales subtraction for existing brands was handled in Pass 1.
                        // Pass 1 loop (lines 736+) already subtracts sales for ANY brand that exists in groups.
                    });
                }
            });
        });

        return Object.values(groups)
            .map(wh => ({
                ...wh,
                products: Object.values(wh.products)
                    .sort((a, b) => (a.productName || '').localeCompare(b.productName || '', undefined, { sensitivity: 'base' }))
                    .map(p => ({
                        ...p,
                        brands: Object.values(p.brands).sort((a, b) => (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' }))
                    }))
            }))
            .filter(wh => wh.products.length > 0)
            .sort((a, b) => a.whName.localeCompare(b.whName, undefined, { sensitivity: 'base' }));
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

            let response;
            if (editingWarehouseId) {
                response = await axios.put(`${API_BASE_URL}/api/warehouses/${editingWarehouseId}`, newWarehouse);
            } else {
                response = await axios.post(`${API_BASE_URL}/api/warehouses`, newWarehouse);
            }

            const responseData = response.data;

            if (editingWarehouseId) {
                setWarehouseData(prev => prev.map(item => item._id === editingWarehouseId ? responseData : item));
            } else {
                setWarehouseData(prev => [responseData, ...prev]);
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
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="w-full md:w-1/4">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center md:text-left">Ware House Management</h2>
                </div>
                {!showWarehouseForm && (
                    <div className="w-full md:flex-1 max-w-none md:max-w-md mx-auto relative group">
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
                    <div className="w-full md:w-1/4 flex flex-row items-center justify-between md:justify-end gap-2">
                        <div className="relative flex-1 md:flex-none">
                            <button
                                ref={warehouseFilterButtonRef}
                                onClick={() => {
                                    if (showWarehouseFilterPanel) {
                                        setFilterDropdownOpen(initialFilterDropdownState);
                                    }
                                    setShowWarehouseFilterPanel(!showWarehouseFilterPanel);
                                }}
                                className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-xl transition-all border h-[42px] ${showWarehouseFilterPanel || Object.values(warehouseFilters).some(v => v !== '')
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${showWarehouseFilterPanel || Object.values(warehouseFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {showWarehouseFilterPanel && (
                                <>
                                    {/* Mobile Backdrop */}
                                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[140] md:hidden" onClick={() => setShowWarehouseFilterPanel(false)} />

                                    <div ref={warehouseFilterRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:left-0 md:mt-2 w-auto md:w-80 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[150] p-5 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                            <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                            <button
                                                onClick={() => {
                                                    setWarehouseFilters({ startDate: '', endDate: '', warehouse: '', productName: '', brand: '', category: '' });
                                                    setFilterSearchInputs({ productSearch: '', brandSearch: '', warehouseSearch: '', categorySearch: '' });
                                                    setFilterDropdownOpen(initialFilterDropdownState);
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

                                            {/* Category Filter */}
                                            <div className="space-y-1.5 relative" ref={categoryFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Category</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.categorySearch}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFilterSearchInputs({ ...filterSearchInputs, categorySearch: val });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, category: true });
                                                        }}
                                                        onClick={() => setFilterDropdownOpen({ ...initialFilterDropdownState, category: !filterDropdownOpen.category })}
                                                        placeholder={warehouseFilters.category || "Search Category..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${warehouseFilters.category ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {warehouseFilters.category && (
                                                            <button onClick={() => { setWarehouseFilters({ ...warehouseFilters, category: '' }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.category && (() => {
                                                    const options = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
                                                    const filtered = options.filter(c => (c || '').toString().toLowerCase().includes(filterSearchInputs.categorySearch.toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(c => (
                                                                <button
                                                                    key={c}
                                                                    type="button"
                                                                    onClick={() => { setWarehouseFilters({ ...warehouseFilters, category: c }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                >
                                                                    {c}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
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
                                                    let options = getFilteredProducts(filterSearchInputs.productSearch);
                                                    if (warehouseFilters.category && products && products.length > 0) {
                                                        const categoryProducts = new Set(
                                                            products.filter(p => (p.category || '').toLowerCase() === warehouseFilters.category.toLowerCase())
                                                                .map(p => (p.name || p.productName || '').toLowerCase())
                                                        );
                                                        options = options.filter(o => categoryProducts.has((o || '').toLowerCase()));
                                                    }
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

                                            <button
                                                onClick={() => setShowWarehouseFilterPanel(false)}
                                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]"
                                            >
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => setShowWarehouseReport(true)}
                            className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-2 sm:px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 h-[42px]"
                        >
                            <BarChartIcon className="w-4 h-4 text-gray-400 hidden sm:block" />
                            <span className="text-sm font-medium">Report</span>
                        </button>
                        <button
                            onClick={() => setShowWarehouseForm(true)}
                            className="flex-1 md:flex-none w-full md:w-auto flex justify-center items-center gap-2 px-2 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:scale-105 h-[42px]"
                        >
                            <HomeIcon className="w-5 h-5 text-white/90 hidden sm:block" />
                            <PlusIcon className="w-4 h-4 text-white/90 sm:hidden" />
                            <span className="text-sm font-medium">Add New</span>
                        </button>
                    </div>
                )}
            </div>

            {!showWarehouseForm && (
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl w-full md:w-fit justify-between md:justify-start">
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg text-sm font-bold transition-all text-center ${activeTab === 'stock'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                        >
                            Stock Summary
                        </button>
                        <button
                            onClick={() => setActiveTab('warehouses')}
                            className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg text-sm font-bold transition-all text-center ${activeTab === 'warehouses'
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
                salesRecords={salesRecords}
                products={products}
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
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                            {[
                                { label: 'Total InHouse Stock', value: dashboardStats.totalInhouseStock, icon: BoxIcon, color: 'emerald' },
                                { label: 'Total Warehouse Stock', value: dashboardStats.totalWarehouseStock, icon: HomeIcon, color: 'blue' },
                                { label: 'Total Items', value: dashboardStats.totalItems.toString(), icon: BarChartIcon, color: 'indigo' },
                                { label: 'Available Capacity', value: dashboardStats.availableCapacity, icon: TrendingUpIcon, color: 'emerald' },
                            ].map((card, i) => (
                                <div key={i} className="bg-white p-3 sm:p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between mb-2 sm:mb-4">
                                        <div className={`p-2 sm:p-3 bg-${card.color}-50 rounded-xl`}>
                                            <card.icon className={`w-4 h-4 sm:w-6 sm:h-6 text-${card.color}-600`} />
                                        </div>
                                        <span className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg">+0%</span>
                                    </div>
                                    <p className="text-[10px] sm:text-sm font-medium text-gray-500 leading-tight">{card.label}</p>
                                    <p className="text-sm sm:text-2xl font-black text-gray-900 mt-1">{card.value}</p>
                                </div>
                            ))}
                        </div>

                        {activeTab === 'stock' && (
                            filteredData.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WH Name</th>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                        <th colSpan="6" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                            <div className="grid grid-cols-6 gap-4">
                                                                <div className="text-left font-bold text-gray-800">Brand</div>
                                                                <div className="text-right font-bold text-emerald-800 uppercase">TOTAL STOCK BAG</div>
                                                                <div className="text-right font-bold text-emerald-800 uppercase">TOTAL STOCK QTY</div>
                                                                <div className="text-right font-bold text-blue-800 uppercase">WareHouse BAG</div>
                                                                <div className="text-right font-bold text-blue-800 uppercase">WareHouse QTY</div>
                                                                {isAdmin && <div className="text-right font-bold text-gray-500">Actions</div>}
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
                                                                                        {(() => {
                                                                                            const { whole, remainder } = calculatePktRemainder(brand.inhouseQty, brand.packetSize);
                                                                                            return `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg`;
                                                                                        })()}
                                                                                    </div>
                                                                                    <div className="text-sm text-black text-right font-bold">
                                                                                        {parseFloat(brand.inhouseQty || 0).toLocaleString()} kg
                                                                                    </div>
                                                                                    <div className="text-sm text-black text-right font-bold">
                                                                                        {(() => {
                                                                                            const { whole, remainder } = calculatePktRemainder(brand.whQty, brand.packetSize);
                                                                                            return `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg`;
                                                                                        })()}
                                                                                    </div>
                                                                                    <div className="text-sm text-black text-right font-bold">
                                                                                        {parseFloat(brand.whQty || 0).toLocaleString()} kg
                                                                                    </div>
                                                                                    {isAdmin && (
                                                                                        <div className="flex items-center justify-end gap-2">
                                                                                            <button onClick={() => handleEditStock(brand)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-4 h-4" /></button>
                                                                                            <button onClick={() => setDeleteConfirm({ show: true, id: brand._id, type: 'stock' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                                                                        </div>
                                                                                    )}
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

                                    {/* Mobile View */}
                                    <div className="md:hidden space-y-4">
                                        {groupedStockData.map((whGroup, whIdx) => {
                                            const isExpanded = expandedMobileWHIndex === whIdx;
                                            return (
                                                <div key={whIdx} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                                                    <div
                                                        className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors"
                                                        onClick={() => toggleMobileWH(whIdx)}
                                                    >
                                                        <h4 className="font-black text-gray-900 tracking-tight">{whGroup.whName}</h4>
                                                        <div className="flex items-center gap-2">
                                                            {!isExpanded && (
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                                                                    {whGroup.products.reduce((total, p) => total + p.brands.length, 0)} Items
                                                                </span>
                                                            )}

                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                            {whGroup.products.map((prodGroup, prodIdx) => {
                                                                const isProdExpanded = expandedMobileProdIndex === prodIdx;
                                                                return (
                                                                    <div key={prodIdx} className="border border-gray-100 rounded-xl overflow-hidden bg-white/50">
                                                                        <div
                                                                            className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white transition-colors"
                                                                            onClick={() => toggleMobileProd(prodIdx)}
                                                                        >
                                                                            <h5 className="font-bold text-sm text-gray-800">{prodGroup.productName}</h5>
                                                                            <div className="flex items-center gap-2">
                                                                                {!isProdExpanded && (
                                                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                                                        {prodGroup.brands.length} {prodGroup.brands.length > 1 ? 'Brands' : 'Brand'}
                                                                                    </span>
                                                                                )}

                                                                            </div>
                                                                        </div>

                                                                        {isProdExpanded && (
                                                                            <div className="p-3 pt-0 space-y-4 animate-in slide-in-from-top-1 duration-200">
                                                                                {prodGroup.brands.map((brand, bIdx) => (
                                                                                    <div key={bIdx} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                                                                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 mb-3">
                                                                                            <span className="text-sm font-bold text-blue-600">{brand.brand}</span>
                                                                                            {isAdmin && (
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <button onClick={() => handleEditStock(brand)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-4 h-4" /></button>
                                                                                                    <button onClick={() => setDeleteConfirm({ show: true, id: brand._id, type: 'stock' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-4 w-full">
                                                                                            <div className="space-y-1 min-w-0">
                                                                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider truncate">InHouse Info</p>
                                                                                                <div className="bg-white p-1.5 sm:p-2 rounded-lg border border-emerald-100 h-full flex flex-col justify-center min-w-0">
                                                                                                    <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-1 gap-0.5 xl:gap-1">
                                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">BAG</span>
                                                                                                        <span className="text-[12px] sm:text-xs font-bold text-gray-600 truncate w-full xl:w-auto xl:text-right">
                                                                                                            {(() => {
                                                                                                                const { whole, remainder } = calculatePktRemainder(brand.inhouseQty, brand.packetSize);
                                                                                                                return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                                                            })()}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col xl:flex-row xl:items-end justify-between border-t border-emerald-50 pt-1 gap-0.5 xl:gap-1">
                                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">QTY</span>
                                                                                                        <span className="text-[11px] sm:text-xs font-black text-emerald-700 truncate w-full xl:w-auto xl:text-right">{parseFloat(brand.inhouseQty || 0).toLocaleString()} kg</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="space-y-1 min-w-0">
                                                                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider truncate">Warehouse Info</p>
                                                                                                <div className="bg-white p-1.5 sm:p-2 rounded-lg border border-blue-100 h-full flex flex-col justify-center min-w-0">
                                                                                                    <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-1 gap-0.5 xl:gap-1">
                                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">BAG</span>
                                                                                                        <span className="text-[12px] sm:text-xs font-bold text-gray-600 truncate w-full xl:w-auto xl:text-right">
                                                                                                            {(() => {
                                                                                                                const { whole, remainder } = calculatePktRemainder(brand.whQty, brand.packetSize);
                                                                                                                return `${whole.toLocaleString()}${remainder > 0 ? ` - ${remainder.toLocaleString()} kg` : ''}`;
                                                                                                            })()}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col xl:flex-row xl:items-end justify-between border-t border-blue-50 pt-1 gap-0.5 xl:gap-1">
                                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">QTY</span>
                                                                                                        <span className="text-[11px] sm:text-xs font-black text-blue-700 truncate w-full xl:w-auto xl:text-right">{parseFloat(brand.whQty || 0).toLocaleString()} kg</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                                        {!searchQuery && isAdmin && (
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
                            <div className="space-y-4">
                                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">WH Name</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Manager</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Capacity</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Stock Status</th>
                                                    {isAdmin && <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>}
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
                                                            {isAdmin && (
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
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Mobile View */}
                                <div className="md:hidden space-y-4">
                                    {uniqueWarehouses.map((wh, idx) => {
                                        const productCount = warehouseProductCounts[wh.whName] || 0;
                                        const isEmpty = productCount === 0;
                                        return (
                                            <div key={idx} className={`bg-white border ${isEmpty ? 'border-amber-200' : 'border-gray-200'} rounded-2xl overflow-hidden shadow-sm`}>
                                                <div className={`px-4 py-3 border-b ${isEmpty ? 'border-amber-100 bg-amber-50/30' : 'border-gray-100 bg-gray-50/50'} flex justify-between items-center`}>
                                                    <div className="flex items-center gap-2">
                                                        <HomeIcon className={`w-4 h-4 ${isEmpty ? 'text-amber-500' : 'text-blue-500'}`} />
                                                        <h4 className="font-black text-gray-900 tracking-tight">{wh.whName}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => handleEditWarehouse(wh)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => setDeleteConfirm({ show: true, id: wh._id, type: 'warehouse' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Manager</span>
                                                        <span className="text-sm font-semibold text-gray-700">{wh.manager || '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Location</span>
                                                        <span className="text-sm font-semibold text-gray-700">{wh.location || '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Capacity</span>
                                                        <span className="text-sm font-black text-gray-800">{wh.capacity ? `${wh.capacity.toLocaleString()} KG` : '-'}</span>
                                                    </div>
                                                    <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Stock Status</span>
                                                        {isEmpty ? (
                                                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                                                No Product
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                                {productCount} Product{productCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )
            }
            {deleteConfirm.show && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
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
        </div>
    );
};

export default WarehouseManagement;
