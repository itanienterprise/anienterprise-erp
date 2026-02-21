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
import axios from 'axios';

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

    // --- Add Stock to Warehouse State ---
    const [warehouseData, setWarehouseData] = useState([]);
    const [showAddWarehouseStockForm, setShowAddWarehouseStockForm] = useState(false);
    const [addWarehouseStockFormData, setAddWarehouseStockFormData] = useState({
        whName: '', manager: '', location: '', capacity: '',
        to: '', toManager: '', toLocation: '', toCapacity: '',
        productEntries: [{
            productName: '',
            brandEntries: [{ brand: '', inhousePkt: '', inhouseQty: '', whPkt: '', whQty: '', transferPkt: '', transferQty: '' }]
        }]
    });
    const [isAddingWarehouseStock, setIsAddingWarehouseStock] = useState(false);
    const [addWarehouseStockSubmitStatus, setAddWarehouseStockSubmitStatus] = useState(null);

    const [activeWhProductIndex, setActiveWhProductIndex] = useState(0);
    const [activeWhBrandIndex, setActiveWhBrandIndex] = useState(0);

    const [showWhDropdown, setShowWhDropdown] = useState(false);
    const whDropdownRef = useRef(null);
    const [showToDropdown, setShowToDropdown] = useState(false);
    const toDropdownRef = useRef(null);
    const [showWhProductDropdown, setShowWhProductDropdown] = useState(false);
    const whProductDropdownRef = useRef(null);
    const [showWhBrandDropdown, setShowWhBrandDropdown] = useState(false);
    const whBrandDropdownRef = useRef(null);

    const uniqueWarehouses = useMemo(() => {
        if (!warehouseData || !Array.isArray(warehouseData)) return [];
        return warehouseData.reduce((acc, current) => {
            if (current?.whName && !acc.find(item => item.whName === current.whName)) {
                acc.push({
                    _id: current._id,
                    whName: current.whName,
                    manager: current.manager || '',
                    location: current.location || '',
                    capacity: current.capacity || 0
                });
            }
            return acc;
        }, []);
    }, [warehouseData]);

    const availableBrands = useMemo(() => {
        const activeProduct = addWarehouseStockFormData.productEntries[activeWhProductIndex];
        if (!activeProduct || !activeProduct.productName || !products) return [];
        const selectedProduct = products.find(p => p.name === activeProduct.productName);
        return selectedProduct ? (selectedProduct.brands || []) : [];
    }, [addWarehouseStockFormData.productEntries, activeWhProductIndex, products]);

    const ports = useMemo(() => {
        return [...new Set(stockRecords.map(r => r.port).filter(Boolean))].map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [stockRecords]);

    const importers = useMemo(() => {
        return [...new Set(stockRecords.map(r => r.importer).filter(Boolean))].map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [stockRecords]);

    // --- Effects ---

    const fetchWarehouses = async () => {
        try {
            const [whRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const whData = Array.isArray(whRes.data) ? whRes.data : [];
            const stockDataRes = Array.isArray(stockRes.data) ? stockRes.data : [];

            // 1. Calculate Global InHouse Totals from ALL Stock Data
            const globalInHouseMap = {};
            const stockDataDecrypted = stockDataRes.map(item => {
                try {
                    return { ...decryptData(item.data), _id: item._id, createdAt: item.createdAt };
                } catch { return null; }
            }).filter(Boolean);

            stockDataDecrypted.forEach(d => {
                const key = `${(d.productName || d.product || '').trim()}_${(d.brand || '').trim()}`;
                if (!globalInHouseMap[key]) {
                    globalInHouseMap[key] = { pkt: 0, qty: 0 };
                }
                globalInHouseMap[key].pkt += parseFloat(d.inHousePacket || d.inhousePkt || 0);
                globalInHouseMap[key].qty += parseFloat(d.inHouseQuantity || d.inhouseQty || 0);
            });

            // 2. Decrypt and normalize Warehouse records
            const allDecryptedWh = whData.map(item => {
                try {
                    const decrypted = decryptData(item.data);
                    const key = `${(decrypted.product || decrypted.productName || '').trim()}_${(decrypted.brand || '').trim()}`;
                    const globalStats = globalInHouseMap[key] || { pkt: 0, qty: 0 };

                    const inhousePkt = globalStats.pkt;
                    const inhouseQty = globalStats.qty;

                    const whPkt = decrypted.whPkt !== undefined && decrypted.whPkt !== null ? decrypted.whPkt : 0;
                    const whQty = decrypted.whQty !== undefined && decrypted.whQty !== null ? decrypted.whQty : 0;

                    return {
                        ...decrypted,
                        productName: decrypted.product,
                        inhousePkt,
                        inhouseQty,
                        whPkt,
                        whQty,
                        packetSize: decrypted.packetSize || (whQty && whPkt ? (parseFloat(whQty) / parseFloat(whPkt)).toFixed(0) : 0),
                        _id: item._id,
                        recordType: 'warehouse',
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // 3. Normalize Stock records (treated as Warehouse rows)
            const decryptedStock = stockDataDecrypted.map(d => {
                const rawWh = (d.warehouse || d.whName || '').trim();
                if (!rawWh) return null;

                const key = `${(d.productName || d.product || '').trim()}_${(d.brand || '').trim()}`;
                const globalStats = globalInHouseMap[key] || { pkt: 0, qty: 0 };

                const inhousePkt = globalStats.pkt;
                const inhouseQty = globalStats.qty;

                const originalInHousePkt = parseFloat(d.inHousePacket || d.inhousePkt || 0);
                const originalInHouseQty = parseFloat(d.inHouseQuantity || d.inhouseQty || 0);

                const whPkt = d.whPkt !== undefined && d.whPkt !== null ? d.whPkt : originalInHousePkt;
                const whQty = d.whQty !== undefined && d.whQty !== null ? d.whQty : originalInHouseQty;

                return {
                    ...d,
                    whName: rawWh,
                    inhousePkt,
                    inhouseQty,
                    whPkt,
                    whQty,
                    productName: d.productName || d.product,
                    packetSize: d.packetSize || d.size || 0,
                    recordType: 'stock',
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
    }, []);

    const handleAddWarehouseStockInputChange = (e, pIndex = null, bIndex = null) => {
        const { name, value } = e.target;
        if (pIndex !== null) {
            const updatedProducts = [...addWarehouseStockFormData.productEntries];
            if (bIndex !== null) {
                // Update brand-specific field
                const updatedBrands = [...updatedProducts[pIndex].brandEntries];
                if (name === 'brand') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const matchingStockEntries = warehouseData.filter(item =>
                        item.whName === addWarehouseStockFormData.whName &&
                        (item.productName === currentProductName || item.product === currentProductName) &&
                        item.brand === value
                    );

                    const totalInPkt = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.inhousePkt) || 0), 0);
                    const totalInQty = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.inhouseQty) || 0), 0);
                    const totalWhPkt = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.whPkt) || 0), 0);
                    const totalWhQty = matchingStockEntries.reduce((sum, entry) => sum + (parseFloat(entry.whQty) || 0), 0);

                    updatedBrands[bIndex] = {
                        ...updatedBrands[bIndex],
                        [name]: value,
                        inhousePkt: totalInPkt || 0,
                        inhouseQty: totalInQty || 0,
                        whPkt: totalWhPkt || 0,
                        whQty: totalWhQty || 0
                    };
                    setActiveWhProductIndex(pIndex);
                    setActiveWhBrandIndex(bIndex);
                    setShowWhBrandDropdown(true);
                } else if (name === 'transferQty') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const currentBrandName = updatedBrands[bIndex].brand;

                    const productData = products.find(p => p.name === currentProductName);
                    const brandData = productData?.brands?.find(b => b.brand === currentBrandName);
                    const packetSize = brandData?.packetSize ? parseFloat(brandData.packetSize) : 0;

                    let calculatedPkt = updatedBrands[bIndex].transferPkt;

                    if (packetSize > 0) {
                        const qty = parseFloat(value) || 0;
                        if (qty > 0) {
                            calculatedPkt = (qty / packetSize).toFixed(2);
                            if (calculatedPkt.endsWith('.00')) calculatedPkt = calculatedPkt.slice(0, -3);
                        } else {
                            calculatedPkt = '';
                        }
                    }

                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value, transferPkt: calculatedPkt };
                } else if (name === 'transferPkt') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const currentBrandName = updatedBrands[bIndex].brand;

                    const productData = products.find(p => p.name === currentProductName);
                    const brandData = productData?.brands?.find(b => b.brand === currentBrandName);
                    const packetSize = brandData?.packetSize ? parseFloat(brandData.packetSize) : 0;

                    let calculatedQty = updatedBrands[bIndex].transferQty;

                    if (packetSize > 0) {
                        const pkt = parseFloat(value) || 0;
                        if (pkt > 0) {
                            calculatedQty = (pkt * packetSize).toFixed(2);
                            if (calculatedQty.endsWith('.00')) calculatedQty = calculatedQty.slice(0, -3);
                        } else {
                            calculatedQty = '';
                        }
                    }

                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value, transferQty: calculatedQty };
                } else {
                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value };
                }
                updatedProducts[pIndex] = { ...updatedProducts[pIndex], brandEntries: updatedBrands };
            } else {
                // Update product-specific field
                if (name === 'productName') {
                    updatedProducts[pIndex] = {
                        ...updatedProducts[pIndex],
                        [name]: value,
                        brandEntries: updatedProducts[pIndex].brandEntries.map(b => ({ ...b, brand: '' }))
                    };
                    setActiveWhProductIndex(pIndex);
                    setShowWhProductDropdown(true);
                } else {
                    updatedProducts[pIndex] = { ...updatedProducts[pIndex], [name]: value };
                }
            }
            setAddWarehouseStockFormData(prev => ({ ...prev, productEntries: updatedProducts }));
        } else {
            if (name === 'whName' && value === '') {
                setAddWarehouseStockFormData(prev => ({
                    ...prev,
                    whName: '',
                    manager: '',
                    location: '',
                    capacity: ''
                }));
            } else if (name === 'to' && value === '') {
                setAddWarehouseStockFormData(prev => ({
                    ...prev,
                    to: '',
                    toManager: '',
                    toLocation: '',
                    toCapacity: ''
                }));
            } else {
                setAddWarehouseStockFormData(prev => ({ ...prev, [name]: value }));
            }
            if (name === 'whName') setShowWhDropdown(true);
            if (name === 'to') setShowToDropdown(true);
        }
    };

    const addWarehouseProductEntry = () => {
        setAddWarehouseStockFormData(prev => ({
            ...prev,
            productEntries: [...prev.productEntries, {
                productName: '',
                brandEntries: [{
                    brand: '',
                    inhousePkt: '',
                    inhouseQty: '',
                    whPkt: '',
                    whQty: '',
                    transferPkt: '',
                    transferQty: ''
                }]
            }]
        }));
    };

    const removeWarehouseProductEntry = (index) => {
        if (addWarehouseStockFormData.productEntries.length > 1) {
            setAddWarehouseStockFormData(prev => ({
                ...prev,
                productEntries: prev.productEntries.filter((_, i) => i !== index)
            }));
        }
    };

    const addWarehouseBrandEntry = (pIndex) => {
        const updatedProducts = [...addWarehouseStockFormData.productEntries];
        updatedProducts[pIndex].brandEntries.push({
            brand: '',
            inhousePkt: '',
            inhouseQty: '',
            whPkt: '',
            whQty: '',
            transferPkt: '',
            transferQty: ''
        });
        setAddWarehouseStockFormData(prev => ({ ...prev, productEntries: updatedProducts }));
    };

    const removeWarehouseBrandEntry = (pIndex, bIndex) => {
        const updatedProducts = [...addWarehouseStockFormData.productEntries];
        if (updatedProducts[pIndex].brandEntries.length > 1) {
            updatedProducts[pIndex].brandEntries = updatedProducts[pIndex].brandEntries.filter((_, i) => i !== bIndex);
            setAddWarehouseStockFormData(prev => ({ ...prev, productEntries: updatedProducts }));
        }
    };

    const handleAddWarehouseStockSubmit = async (e) => {
        e.preventDefault();
        setIsAddingWarehouseStock(true);
        setAddWarehouseStockSubmitStatus(null);
        try {
            for (const productEntry of addWarehouseStockFormData.productEntries) {
                for (const brandEntry of productEntry.brandEntries) {
                    let transferQty = parseFloat(brandEntry.transferQty) || 0;
                    let transferPkt = parseFloat(brandEntry.transferPkt) || 0;

                    if (transferQty <= 0 && transferPkt <= 0) continue;

                    // 1. Handle Source Deduction - Support multiple sources matching same product/brand
                    const sourceRecords = warehouseData.filter(item =>
                        item.whName === addWarehouseStockFormData.whName &&
                        (item.productName || item.product) === productEntry.productName &&
                        item.brand === brandEntry.brand &&
                        ((parseFloat(item.whQty) > 0) || (parseFloat(item.whPkt) > 0))
                    );

                    // Sort to prioritize older stock or simply iterate
                    // Let's iterate and deduct until transferQty/Pkt is fulfilled
                    const updates = [];
                    const lcSrrDeductions = [];

                    for (const sourceRecord of sourceRecords) {
                        if (transferQty <= 0 && transferPkt <= 0) break;

                        const availableQty = parseFloat(sourceRecord.whQty) || 0;
                        const availablePkt = parseFloat(sourceRecord.whPkt) || 0;

                        const deductQty = Math.min(availableQty, transferQty);
                        const deductPkt = Math.min(availablePkt, transferPkt);

                        if (deductQty > 0 || deductPkt > 0) {
                            const updatedSource = {
                                ...sourceRecord,
                                whQty: availableQty - deductQty,
                                whPkt: availablePkt - deductPkt
                            };

                            updates.push({ record: updatedSource, original: sourceRecord });

                            lcSrrDeductions.push({
                                lcNo: sourceRecord.lcNo || '',
                                qty: deductQty,
                                pkt: deductPkt
                            });

                            transferQty -= deductQty;
                            transferPkt -= deductPkt;
                        }
                    }

                    // Execute Source Updates
                    for (const { record: updatedSource, original } of updates) {
                        const { _id, recordType, createdAt, updatedAt, ...sourceDataToEncrypt } = updatedSource;
                        const encryptedSource = encryptData(sourceDataToEncrypt);

                        if (original.recordType === 'stock') {
                            await axios.put(`${API_BASE_URL}/api/stock/${original._id}`, { data: encryptedSource });
                        } else {
                            await axios.put(`${API_BASE_URL}/api/warehouses/${original._id}`, { data: encryptedSource });
                        }
                    }

                    // 2. Handle Destination Addition (Transfer or New Stock)
                    const destWhName = addWarehouseStockFormData.to || addWarehouseStockFormData.whName;

                    for (const deduction of lcSrrDeductions) {
                        const destRecord = warehouseData.find(item =>
                            item.whName === destWhName &&
                            (item.productName || item.product) === productEntry.productName &&
                            item.brand === brandEntry.brand &&
                            (item.lcNo === deduction.lcNo || (!item.lcNo && !deduction.lcNo))
                        );

                        if (destRecord) {
                            const updatedDest = {
                                ...destRecord,
                                whQty: (parseFloat(destRecord.whQty) || 0) + deduction.qty,
                                whPkt: (parseFloat(destRecord.whPkt) || 0) + deduction.pkt
                            };
                            const { _id, recordType, createdAt, updatedAt, ...destDataToEncrypt } = updatedDest;
                            const encryptedDest = encryptData(destDataToEncrypt);

                            if (destRecord.recordType === 'stock') {
                                await axios.put(`${API_BASE_URL}/api/stock/${destRecord._id}`, { data: encryptedDest });
                            } else {
                                await axios.put(`${API_BASE_URL}/api/warehouses/${destRecord._id}`, { data: encryptedDest });
                            }
                        } else {
                            const newEntry = {
                                whName: destWhName,
                                manager: addWarehouseStockFormData.toManager || addWarehouseStockFormData.manager,
                                location: addWarehouseStockFormData.toLocation || addWarehouseStockFormData.location,
                                capacity: parseFloat(addWarehouseStockFormData.toCapacity) || parseFloat(addWarehouseStockFormData.capacity) || 0,
                                product: productEntry.productName,
                                brand: brandEntry.brand,
                                lcNo: deduction.lcNo,
                                inhousePkt: 0, // only source retains inhouse
                                inhouseQty: 0, // only source retains inhouse
                                whPkt: deduction.pkt,
                                whQty: deduction.qty,
                                transferPkt: 0,
                                transferQty: 0
                            };
                            const encryptedData = encryptData(newEntry);
                            await axios.post(`${API_BASE_URL}/api/warehouses`, { data: encryptedData });
                        }
                    }
                }
            }
            // Refresh data to reflect changes
            await fetchWarehouses();

            setAddWarehouseStockSubmitStatus('success');
            setTimeout(() => {
                setShowAddWarehouseStockForm(false);
                setAddWarehouseStockSubmitStatus(null);
                setAddWarehouseStockFormData({
                    whName: '', manager: '', location: '', capacity: '',
                    to: '', toManager: '', toLocation: '', toCapacity: '',
                    productEntries: [{
                        productName: '',
                        brandEntries: [{ brand: '', inhousePkt: '', inhouseQty: '', whPkt: '', whQty: '', transferPkt: '', transferQty: '' }]
                    }]
                });
            }, 1500);
        } catch (error) {
            console.error('Error saving warehouse stock:', error);
            setAddWarehouseStockSubmitStatus('error');
        } finally {
            setIsAddingWarehouseStock(false);
        }
    };

    // Generate History Options
    const historyOptions = useMemo(() => {
        if (!viewRecord) return { lcNos: [], ports: [], brands: [] };

        const productHistory = stockRecords.filter(item =>
            (item.productName || '').trim().toLowerCase() === (viewRecord.data.productName || '').trim().toLowerCase()
        );

        const lcNos = [...new Set(productHistory.map(i => (i.lcNo || '').trim()).filter(Boolean))].sort();
        const ports = [...new Set(productHistory.map(i => (i.port || '').trim()).filter(Boolean))].sort();

        const brandsSet = new Set();
        productHistory.forEach(item => {
            if (item.brand) brandsSet.add(item.brand.trim());
            // Check nested entries for multi-brand records
            if (item.entries) {
                item.entries.forEach(e => {
                    if (e.brand) brandsSet.add(e.brand.trim());
                });
            }
        });
        const brands = Array.from(brandsSet).filter(Boolean).sort();

        return { lcNos, ports, brands };
    }, [viewRecord, stockRecords]);

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

            // Filter Dropdowns (Main List - only if not viewing record)
            if (!viewRecord) {
                if (filterDropdownOpen.lcNo && stockLcNoFilterRef.current && !stockLcNoFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
                if (filterDropdownOpen.port && stockPortFilterRef.current && !stockPortFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
                if (filterDropdownOpen.importer && stockImporterFilterRef.current && !stockImporterFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, importer: false }));
                if (filterDropdownOpen.product && stockProductFilterRef.current && !stockProductFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, product: false }));
                if (filterDropdownOpen.brand && stockBrandFilterRef.current && !stockBrandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            }

            // Filter Dropdowns (History Modal - always check)
            if (filterDropdownOpen.lcNo && lcNoFilterRef.current && !lcNoFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, lcNo: false }));
            if (filterDropdownOpen.port && portFilterRef.current && !portFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, port: false }));
            if (filterDropdownOpen.brand && brandFilterRef.current && !brandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));

            // Custom Dropdowns in Form (activeDropdown)
            if (activeDropdown && !event.target.closest('input') && !event.target.closest('.dropdown-container')) {
                setActiveDropdown(null);

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
            }

            // Outside click for Warehouse Add Stock Form Dropdowns
            if (showWhDropdown && whDropdownRef.current && !whDropdownRef.current.contains(event.target)) {
                setShowWhDropdown(false);
            }
            if (showToDropdown && toDropdownRef.current && !toDropdownRef.current.contains(event.target)) {
                setShowToDropdown(false);
            }
            if (showWhProductDropdown && whProductDropdownRef.current && !whProductDropdownRef.current.contains(event.target)) {
                setShowWhProductDropdown(false);
            }
            if (showWhBrandDropdown && whBrandDropdownRef.current && !whBrandDropdownRef.current.contains(event.target)) {
                setShowWhBrandDropdown(false);
            }
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
    }, [showStockFilterPanel, showHistoryFilterPanel, activeDropdown, filterDropdownOpen, viewRecord]);

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
        // 3. TOTAL INHOUSE PKT = Packet - Swp Pkt
        // 4. TOTAL INHOUSE QTY = Total InHouse Pkt * Size
        // 5. INHOUSE PKT = Total InHouse Pkt - Sale Pkt
        // 6. INHOUSE QTY = InHouse Pkt * Size
        if (field === 'packet' || field === 'packetSize' || field === 'sweepedPacket' || field === 'salePacket') {
            const salePacket = parseFloat(entry.salePacket) || 0;
            entry.sweepedQuantity = (sweepedPacket * packetSize).toFixed(2);
            entry.totalInHousePacket = (packet - sweepedPacket).toFixed(2);
            entry.totalInHouseQuantity = (parseFloat(entry.totalInHousePacket) * packetSize).toFixed(2);
            entry.saleQuantity = (salePacket * packetSize).toFixed(2);
            entry.inHousePacket = (parseFloat(entry.totalInHousePacket) - salePacket).toFixed(2);
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
                    brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', totalInHousePacket: '', totalInHouseQuantity: '', salePacket: '', saleQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
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
        updatedProducts[pIndex].brandEntries.push({ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', totalInHousePacket: '', totalInHouseQuantity: '', salePacket: '', saleQuantity: '', inHousePacket: '', inHouseQuantity: '' });
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
                    totalInHousePacket: e.totalInHousePacket,
                    totalInHouseQuantity: e.totalInHouseQuantity,
                    salePacket: e.salePacket,
                    saleQuantity: e.saleQuantity,
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
                        totalInHousePacket: record.totalInHousePacket,
                        totalInHouseQuantity: record.totalInHouseQuantity,
                        salePacket: record.salePacket,
                        saleQuantity: record.saleQuantity,
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
    const {
        displayRecords,
        totalPackets,
        totalQuantity,
        totalTotalInHousePkt,
        totalTotalInHouseQty,
        totalInHousePkt,
        totalInHousePktDecimalKg,
        totalInHouseQty,
        totalShortage,
        unit
    } = stockData;

    return (
        <div className="space-y-6">
            {(!showStockForm && !showAddWarehouseStockForm) && (
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
                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Product Name</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.productSearch}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFilterSearchInputs({ ...filterSearchInputs, productSearch: val });
                                                            setStockFilters({ ...stockFilters, productName: val });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, productName: true });
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, productName: !filterDropdownOpen.productName });
                                                        }}
                                                        placeholder="Search Product..."
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm ${stockFilters.productName ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                                        {stockFilters.productName ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setStockFilters({ ...stockFilters, productName: '' });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 transition-colors bg-white p-0.5"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        ) : null}
                                                        <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.productName && (() => {
                                                    const options = getFilteredProducts(filterSearchInputs.productSearch);
                                                    return options.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {options.map(product => (
                                                                <button
                                                                    key={product}
                                                                    type="button"
                                                                    onClick={() => { setStockFilters({ ...stockFilters, productName: product }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                >
                                                                    {product}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            <div className="space-y-1.5 relative">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.brandSearch}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFilterSearchInputs({ ...filterSearchInputs, brandSearch: val });
                                                            setStockFilters({ ...stockFilters, brand: val });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand });
                                                        }}
                                                        placeholder="Search Brand..."
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm ${stockFilters.brand ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                        disabled={!stockFilters.productName}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                                        {stockFilters.brand ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setStockFilters({ ...stockFilters, brand: '' });
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' });
                                                                    setFilterDropdownOpen(initialFilterDropdownState);
                                                                }}
                                                                className="text-gray-400 hover:text-red-500 transition-colors bg-white p-0.5"
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        ) : null}
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
                        <button
                            onClick={() => setShowAddWarehouseStockForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:scale-105 font-medium"
                        >
                            <PlusIcon className="w-5 h-5 mr-1" />
                            <span className="text-sm font-medium">Transfer</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {(!showStockForm && !showAddWarehouseStockForm) && (
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
            )}

            {/* Add Stock to Warehouse Form Card */}
            {showAddWarehouseStockForm && (
                <div className="warehouse-form-container border-blue-100 mb-6">
                    <div className="warehouse-form-bg-orb bg-blue-400/20 left-1/4 top-1/4"></div>
                    <div className="warehouse-form-bg-orb bg-indigo-400/20 right-1/4 bottom-1/4"></div>

                    <div className="warehouse-form-header">
                        <div>
                            <h3 className="warehouse-form-title text-blue-900">Transfer Product to Warehouse</h3>
                            <p className="text-sm text-gray-500">Record a new stock transfer or direct entry to warehouse</p>
                        </div>
                        <button onClick={() => setShowAddWarehouseStockForm(false)} className="warehouse-form-close hover:bg-blue-50 hover:text-blue-600">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleAddWarehouseStockSubmit} className="relative z-10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2 relative" ref={whDropdownRef}>
                                <label className="text-sm font-bold text-gray-700 ml-1">From</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="whName"
                                        value={addWarehouseStockFormData.whName}
                                        onChange={handleAddWarehouseStockInputChange}
                                        onFocus={() => setShowWhDropdown(true)}
                                        placeholder="Select or enter warehouse"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm pr-10"
                                        required
                                        autoComplete="off"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showWhDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {showWhDropdown && (
                                    <div className="absolute z-[100] mt-1 w-full bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="max-h-60 overflow-y-auto py-1">
                                            {uniqueWarehouses
                                                .filter(wh =>
                                                    wh.whName.toLowerCase().includes(addWarehouseStockFormData.whName.toLowerCase()) &&
                                                    wh.whName !== addWarehouseStockFormData.to
                                                )
                                                .map((wh, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            setAddWarehouseStockFormData(prev => ({
                                                                ...prev,
                                                                whName: wh.whName,
                                                                manager: wh.manager || prev.manager,
                                                                location: wh.location || prev.location,
                                                                capacity: wh.capacity || prev.capacity
                                                            }));
                                                            setShowWhDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                    >
                                                        <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">{wh.whName}</div>
                                                    </button>
                                                ))}
                                            {uniqueWarehouses.filter(wh =>
                                                wh.whName.toLowerCase().includes(addWarehouseStockFormData.whName.toLowerCase()) &&
                                                wh.whName !== addWarehouseStockFormData.to
                                            ).length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-500 italic">No warehouses found</div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Manager</label>
                                <input
                                    type="text"
                                    name="manager"
                                    value={addWarehouseStockFormData.manager}
                                    onChange={handleAddWarehouseStockInputChange}
                                    placeholder="Manager Name"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                    required
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Address</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={addWarehouseStockFormData.location}
                                    onChange={handleAddWarehouseStockInputChange}
                                    placeholder="Location/Address"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">Capacity (KG)</label>
                                <input
                                    type="number"
                                    name="capacity"
                                    value={addWarehouseStockFormData.capacity}
                                    onChange={handleAddWarehouseStockInputChange}
                                    placeholder="KG Units"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2 relative" ref={toDropdownRef}>
                                <label className="text-sm font-bold text-gray-700 ml-1">To</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        name="to"
                                        value={addWarehouseStockFormData.to}
                                        onChange={handleAddWarehouseStockInputChange}
                                        onFocus={() => setShowToDropdown(true)}
                                        placeholder="Select warehouse"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm pr-10"
                                        required
                                        autoComplete="off"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${showToDropdown ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {showToDropdown && (
                                    <div className="absolute z-[100] mt-1 w-full bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="max-h-60 overflow-y-auto py-1">
                                            {uniqueWarehouses
                                                .filter(wh =>
                                                    wh.whName.toLowerCase().includes(addWarehouseStockFormData.to.toLowerCase()) &&
                                                    wh.whName !== addWarehouseStockFormData.whName
                                                )
                                                .map((wh, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            setAddWarehouseStockFormData(prev => ({
                                                                ...prev,
                                                                to: wh.whName,
                                                                toManager: wh.manager,
                                                                toLocation: wh.location,
                                                                toCapacity: wh.capacity
                                                            }));
                                                            setShowToDropdown(false);
                                                        }}
                                                        className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                    >
                                                        <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">{wh.whName}</div>
                                                    </button>
                                                ))}
                                            {uniqueWarehouses.filter(wh =>
                                                wh.whName.toLowerCase().includes(addWarehouseStockFormData.to.toLowerCase()) &&
                                                wh.whName !== addWarehouseStockFormData.whName
                                            ).length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-500 italic">No warehouses found</div>
                                                )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">To Manager</label>
                                <input
                                    type="text"
                                    name="toManager"
                                    value={addWarehouseStockFormData.toManager}
                                    onChange={handleAddWarehouseStockInputChange}
                                    placeholder="Manager Name"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">To Address</label>
                                <input
                                    type="text"
                                    name="toLocation"
                                    value={addWarehouseStockFormData.toLocation}
                                    onChange={handleAddWarehouseStockInputChange}
                                    placeholder="Location/Address"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 ml-1">To Capacity (KG)</label>
                                <input
                                    type="number"
                                    name="toCapacity"
                                    value={addWarehouseStockFormData.toCapacity}
                                    onChange={handleAddWarehouseStockInputChange}
                                    placeholder="KG Units"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all backdrop-blur-sm text-sm"
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        {/* Stock Details Section */}
                        <div className="col-span-full space-y-8 mt-4 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    Product Details
                                </h4>
                                <button
                                    type="button"
                                    onClick={addWarehouseProductEntry}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-300 font-semibold text-sm shadow-sm active:scale-95 group"
                                >
                                    <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                    Add Product
                                </button>
                            </div>

                            <div className="space-y-12">
                                {addWarehouseStockFormData.productEntries.map((product, pIndex) => (
                                    <div key={pIndex} className="relative p-6 rounded-2xl bg-gray-50/30 border border-gray-100 group/product hover:border-blue-200 hover:bg-white/80 transition-all duration-500 space-y-6">
                                        {/* Remove Product Button */}
                                        {addWarehouseStockFormData.productEntries.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeWarehouseProductEntry(pIndex)}
                                                className="absolute -top-3 -right-3 p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-0 group-hover/product:opacity-100 transition-all duration-300 hover:scale-110 active:scale-90 z-20"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2 relative" ref={whProductDropdownRef}>
                                                <label className="text-sm font-bold text-gray-700 ml-1">Product</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        name="productName"
                                                        value={product.productName}
                                                        onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex)}
                                                        onFocus={() => {
                                                            setActiveWhProductIndex(pIndex);
                                                            setShowWhProductDropdown(true);
                                                        }}
                                                        placeholder="Select Product"
                                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                                                        required
                                                        autoComplete="off"
                                                    />
                                                    {showWhProductDropdown && activeWhProductIndex === pIndex && (
                                                        <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
                                                            <div className="max-h-60 overflow-y-auto py-1">
                                                                {products
                                                                    .filter(p => (p.name || '').toLowerCase().includes((product.productName || '').toLowerCase()))
                                                                    .map((p, pIdx) => (
                                                                        <button
                                                                            key={pIdx}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const fakeEvent = { target: { name: 'productName', value: p.name } };
                                                                                handleAddWarehouseStockInputChange(fakeEvent, pIndex);
                                                                                setShowWhProductDropdown(false);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                                        >
                                                                            <div className="font-bold text-gray-900 text-sm group-hover:text-blue-700">{p.name}</div>
                                                                        </button>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Brand Entries for this Product */}
                                        <div className="space-y-4">
                                            <div className="hidden lg:grid grid-cols-8 gap-4 px-3 mb-1 pr-[88px]">
                                                <div className="col-span-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">InHouse QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">InHouse PKT</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">WareHouse QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">WareHouse PKT</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Transfer QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Transfer PKT</div>
                                            </div>

                                            {product.brandEntries.map((brandEntry, bIndex) => (
                                                <div key={bIndex} className="flex items-center gap-4 p-3 bg-white/40 border border-gray-200/50 rounded-xl group/brand hover:border-blue-200 transition-all">
                                                    <div className="flex-1 grid grid-cols-8 gap-4 items-center">
                                                        <div className="col-span-2 relative" ref={whBrandDropdownRef}>
                                                            <input
                                                                type="text"
                                                                name="brand"
                                                                value={brandEntry.brand}
                                                                onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                                onFocus={() => {
                                                                    setActiveWhProductIndex(pIndex);
                                                                    setActiveWhBrandIndex(bIndex);
                                                                    setShowWhBrandDropdown(true);
                                                                }}
                                                                placeholder="Brand"
                                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm"
                                                                required
                                                                autoComplete="off"
                                                                disabled={!product.productName}
                                                            />
                                                            {showWhBrandDropdown && activeWhProductIndex === pIndex && activeWhBrandIndex === bIndex && product.productName && (
                                                                <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden min-w-[220px]">
                                                                    <div className="max-h-60 overflow-y-auto py-1">
                                                                        {availableBrands
                                                                            .filter(b => (b.brand || '').toLowerCase().includes((brandEntry.brand || '').toLowerCase()))
                                                                            .map((b, bIdx) => (
                                                                                <button
                                                                                    key={bIdx}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const fakeEvent = { target: { name: 'brand', value: b.brand } };
                                                                                        handleAddWarehouseStockInputChange(fakeEvent, pIndex, bIndex);
                                                                                        setShowWhBrandDropdown(false);
                                                                                    }}
                                                                                    className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                                                >
                                                                                    <div className="font-bold text-gray-900 text-xs group-hover:text-blue-700 whitespace-nowrap">{b.brand}</div>
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <input
                                                            type="number"
                                                            name="inhouseQty"
                                                            value={brandEntry.inhouseQty}
                                                            onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="inhousePkt"
                                                            value={brandEntry.inhousePkt}
                                                            onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="whQty"
                                                            value={brandEntry.whQty}
                                                            onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="whPkt"
                                                            value={brandEntry.whPkt}
                                                            onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-gray-50/50 border border-gray-100 rounded-lg text-sm text-center font-mono outline-none focus:border-blue-400"
                                                            required
                                                            readOnly
                                                        />
                                                        <input
                                                            type="number"
                                                            name="transferQty"
                                                            value={brandEntry.transferQty}
                                                            onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-white border border-indigo-100 rounded-lg text-sm text-center font-mono outline-none focus:border-indigo-400"
                                                            required
                                                        />
                                                        <input
                                                            type="number"
                                                            name="transferPkt"
                                                            value={brandEntry.transferPkt}
                                                            onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                            placeholder="0"
                                                            className="w-full px-2 py-2 bg-white border border-indigo-100 rounded-lg text-sm text-center font-mono outline-none focus:border-indigo-400"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1 w-[72px]">
                                                        <button
                                                            type="button"
                                                            onClick={() => addWarehouseBrandEntry(pIndex)}
                                                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all"
                                                        >
                                                            <PlusIcon className="w-4 h-4" />
                                                        </button>
                                                        {product.brandEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeWarehouseBrandEntry(pIndex, bIndex)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="warehouse-form-footer border-t border-gray-100 pt-6 mt-6 flex gap-4 justify-end">
                            <div className="flex-1">
                                {addWarehouseStockSubmitStatus === 'success' && (
                                    <p className="text-green-600 font-medium flex items-center animate-bounce">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        Stock saved successfully!
                                    </p>
                                )}
                                {addWarehouseStockSubmitStatus === 'error' && (
                                    <p className="text-red-600 font-medium flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        Failed to save stock.
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddWarehouseStockForm(false)}
                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm"
                                disabled={isAddingWarehouseStock}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-200 text-sm flex items-center shadow-md disabled:opacity-50 hover:scale-105"
                                disabled={isAddingWarehouseStock}
                            >
                                {isAddingWarehouseStock ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </span>
                                ) : (
                                    <>
                                        <PlusIcon className="w-5 h-5 mr-2" />
                                        Transfer
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {(!showStockForm && !showAddWarehouseStockForm) && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                                    <th colSpan="8" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="grid grid-cols-8 gap-4">
                                            <div className="text-left text-gray-900">Brand</div>
                                            <div className="text-center text-blue-800">Total Inhouse Packet</div>
                                            <div className="text-center text-blue-800">Total Inhouse QTY</div>
                                            <div className="text-center text-green-800">Inhouse Packet</div>
                                            <div className="text-center text-green-800">Inhouse Quantity</div>
                                            <div className="text-center text-orange-800">Sale Packet</div>
                                            <div className="text-center text-orange-800">Sale Quantity</div>
                                            <div className="text-center text-gray-500">Status</div>
                                        </div>
                                    </th>
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
                                            <td className="px-6 py-4 align-top" colSpan="8">
                                                <div className="space-y-3">
                                                    {group.brandList.map((brand, bIdx) => (
                                                        <div key={bIdx} className={`grid grid-cols-8 gap-4 items-center ${bIdx !== group.brandList.length - 1 ? 'border-b border-gray-100 pb-2' : 'pb-1'}`}>
                                                            <div className="text-sm text-gray-600 font-medium">{brand.brand || '-'}</div>
                                                            <div className="text-sm text-black bg-blue-50/30 px-2 py-1 rounded-lg text-center">
                                                                {Math.floor(brand.totalInHousePacket || 0).toLocaleString()} - {Math.round(((brand.totalInHousePacket || 0) - Math.floor(brand.totalInHousePacket || 0)) * brand.packetSize).toLocaleString()} kg
                                                            </div>
                                                            <div className="text-sm text-black text-center font-medium">
                                                                {Math.round(brand.totalInHouseQuantity || 0).toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-sm text-black bg-green-50/30 px-2 py-1 rounded-lg text-center">
                                                                {Math.floor(brand.inHousePacket).toLocaleString()} - {Math.round((brand.inHousePacket - Math.floor(brand.inHousePacket)) * brand.packetSize).toLocaleString()} kg
                                                            </div>
                                                            <div className="text-sm text-black text-center font-medium">
                                                                {Math.round(brand.inHouseQuantity).toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-sm text-black bg-orange-50/30 px-2 py-1 rounded-lg text-center font-medium">
                                                                {Math.floor(brand.salePacket || 0).toLocaleString()} - {Math.round(((brand.salePacket || 0) - Math.floor(brand.salePacket || 0)) * brand.packetSize).toLocaleString()} kg
                                                            </div>
                                                            <div className="text-sm text-black text-center font-medium">
                                                                {Math.round(brand.saleQuantity || 0).toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-center">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${brand.inHouseQuantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                                    {brand.inHouseQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="pt-2 border-t border-gray-200 mt-1 grid grid-cols-8 gap-4 items-center">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total:</span>
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.floor(group.totalInHousePacket).toLocaleString()} - {Math.round((group.totalInHousePacket - Math.floor(group.totalInHousePacket)) * group.brandList[0].packetSize).toLocaleString()} kg
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.round(group.totalInHouseQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.floor(group.inHousePacket).toLocaleString()} - {Math.round((group.inHousePacket - Math.floor(group.inHousePacket)) * group.brandList[0].packetSize).toLocaleString()} kg
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.round(group.inHouseQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.floor(group.salePacket).toLocaleString()} - {Math.round((group.salePacket - Math.floor(group.salePacket)) * group.brandList[0].packetSize).toLocaleString()} kg
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.round(group.saleQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="text-center"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-right">
                                                <div className="flex items-center justify-end gap-3 mt-1">
                                                    <button onClick={() => setViewRecord({ data: group })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><EyeIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleEditInternal('stock', group)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-5 h-5" /></button>
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
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
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
                                            <div ref={historyFilterRef} className="absolute right-0 mt-3 w-[420px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200">
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
                                                    {/* Date Range: One Line */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <CustomDatePicker
                                                            label="FROM DATE"
                                                            value={historyFilters.startDate}
                                                            onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                                                            placeholder="Select start date"
                                                            name="startDate"
                                                            compact={true}
                                                            fullWidth={true}
                                                        />
                                                        <CustomDatePicker
                                                            label="TO DATE"
                                                            value={historyFilters.endDate}
                                                            onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                                                            placeholder="Select end date"
                                                            name="endDate"
                                                            compact={true}
                                                            fullWidth={true}
                                                        />
                                                    </div>

                                                    {/* LC No and Port: Next Line */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* LC No Filter */}
                                                        <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC No</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value={historyFilters.lcNo}
                                                                    onClick={(e) => { e.stopPropagation(); setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: !filterDropdownOpen.lcNo }); }}
                                                                    placeholder="Select LC No..."
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.lcNo ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                />
                                                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                                {filterDropdownOpen.lcNo && (
                                                                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setHistoryFilters({ ...historyFilters, lcNo: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All LCs</button>
                                                                        {historyOptions.lcNos.map(lc => (
                                                                            <button key={lc} type="button" onClick={(e) => { e.stopPropagation(); setHistoryFilters({ ...historyFilters, lcNo: lc }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.lcNo === lc ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{lc}</button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Port Filter */}
                                                        <div className="space-y-1.5 relative" ref={portFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Port</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value={historyFilters.port}
                                                                    onClick={(e) => { e.stopPropagation(); setFilterDropdownOpen({ ...initialFilterDropdownState, port: !filterDropdownOpen.port }); }}
                                                                    placeholder="Select Port..."
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.port ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                />
                                                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                                {filterDropdownOpen.port && (
                                                                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setHistoryFilters({ ...historyFilters, port: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Ports</button>
                                                                        {historyOptions.ports.map(port => (
                                                                            <button key={port} type="button" onClick={(e) => { e.stopPropagation(); setHistoryFilters({ ...historyFilters, port: port }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.port === port ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{port}</button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Brand Filter */}
                                                    <div className="space-y-1.5 relative" ref={brandFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={historyFilters.brand}
                                                                onClick={(e) => { e.stopPropagation(); setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand }); }}
                                                                placeholder="Select Brand..."
                                                                className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.brand ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                            />
                                                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                            {filterDropdownOpen.brand && (
                                                                <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setHistoryFilters({ ...historyFilters, brand: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Brands</button>
                                                                    {historyOptions.brands.map(brand => (
                                                                        <button key={brand} type="button" onClick={(e) => { e.stopPropagation(); setHistoryFilters({ ...historyFilters, brand: brand }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.brand === brand ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{brand}</button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
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
                                                    { label: 'TOTAL QUANTITY', value: `${Math.round(tQty).toLocaleString()} ${unit}`, bgColor: 'bg-emerald-50/50', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                                                    { label: 'INHOUSE PKT', value: tIHPkt.toLocaleString(), bgColor: 'bg-amber-50/50', borderColor: 'border-amber-100', textColor: 'text-amber-700', labelColor: 'text-amber-600' },
                                                    { label: 'INHOUSE QTY', value: `${Math.round(tIHQty).toLocaleString()} ${unit}`, bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                                                    { label: 'SHORTAGE', value: `${Math.round(tShort).toLocaleString()} ${unit}`, bgColor: 'bg-rose-50/50', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600' },
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
                                                                                <div key={eIdx} className="text-sm text-gray-600">{Math.round(parseFloat(entry.quantity || 0)).toLocaleString()} {entry.unit}</div>
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
                                                                                <div key={eIdx} className="text-sm text-gray-600">{Math.round(parseFloat(entry.inHouseQuantity || 0)).toLocaleString()} {entry.unit}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 align-top text-rose-600 font-medium">
                                                                        <div className="space-y-1">
                                                                            {item.entries.map((entry, eIdx) => (
                                                                                <div key={eIdx} className="text-sm">{Math.round(parseFloat(entry.sweepedQuantity || 0)).toLocaleString()} {entry.unit}</div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <button onClick={() => handleEditInternal('history', item)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><EditIcon className="w-5 h-5" /></button>
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
