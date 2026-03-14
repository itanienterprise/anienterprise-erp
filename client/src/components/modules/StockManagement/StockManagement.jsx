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
    FileTextIcon,
} from '../../Icons';
import CustomDatePicker from '../../shared/CustomDatePicker';
import StockReport from './StockReport';
import { encryptData, decryptData } from '../../../utils/encryption';
import { API_BASE_URL } from '../../../utils/helpers';
import { calculateStockData, calculatePktRemainder } from '../../../utils/stockHelpers';
import { generateStockReportPDF, generateProductHistoryPDF } from '../../../utils/pdfGenerator';
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
    setStockFilters,
    salesRecords,
    fetchSales,
    setShowProductHistoryReport,
    showProductHistoryReport,
    setProductHistoryReportData
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
    const [historyTab, setHistoryTab] = useState('purchase'); // 'purchase' or 'sale'

    // Dropdown & Selection State
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ lcNo: false, port: false, importer: false, brand: false, productName: false, category: false });
    const [filterSearchInputs, setFilterSearchInputs] = useState({ lcNoSearch: '', portSearch: '', importerSearch: '', brandSearch: '', productSearch: '', categorySearch: '' });
    const initialFilterDropdownState = { lcNo: false, port: false, importer: false, brand: false, productName: false, category: false };

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
    const stockCategoryFilterRef = useRef(null);

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
    const whProductDropdownRefs = useRef([]);
    const [showWhBrandDropdown, setShowWhBrandDropdown] = useState(false);
    const whBrandDropdownRefs = useRef({}); // Using object for nested indices


    // Expand/Collapse state for mobile cards
    const [expandedProducts, setExpandedProducts] = useState(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [expandedSaleId, setExpandedSaleId] = useState(null);

    const toggleProductExpansion = (productName) => {
        setExpandedProducts(prev => prev === productName ? null : productName);
    };

    const toggleHistoryExpansion = (historyId) => {
        setExpandedHistoryId(prev => prev === historyId ? null : historyId);
        setExpandedSaleId(null); // Close any open sale history card
    };

    const toggleSaleExpansion = (saleId) => {
        setExpandedSaleId(prev => prev === saleId ? null : saleId);
        setExpandedHistoryId(null); // Close any open purchase history card
    };

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
        }, []).sort((a, b) => a.whName.localeCompare(b.whName, undefined, { sensitivity: 'base' }));
    }, [warehouseData]);

    const activePurchaseHistory = useMemo(() => {
        if (!viewRecord) return [];
        const searchLower = historySearchQuery.toLowerCase().trim();
        const productName = (viewRecord.data.productName || '').trim().toLowerCase();

        const filteredRaw = stockRecords.filter(item => {
            const matchesProduct = (item.productName || '').trim().toLowerCase() === productName;
            if (!matchesProduct) return false;

            if (historyFilters.startDate && item.date < historyFilters.startDate) return false;
            if (historyFilters.endDate && item.date > historyFilters.endDate) return false;
            if (historyFilters.lcNo && (item.lcNo || '').trim() !== historyFilters.lcNo) return false;
            if (historyFilters.port && (item.port || '').trim() !== historyFilters.port) return false;
            if (historyFilters.brand) {
                const brandLower = historyFilters.brand.toLowerCase();
                // Check top-level brand, entries (old), and brandEntries (LC Receive)
                const hasBrand = (item.brand || '').trim().toLowerCase() === brandLower ||
                    (item.entries || []).some(e => (e.brand || '').trim().toLowerCase() === brandLower) ||
                    (item.brandEntries || []).some(e => (e.brand || '').trim().toLowerCase() === brandLower);
                if (!hasBrand) return false;
            }

            if (!searchLower) return true;
            const matchesLC = (item.lcNo || '').trim().toLowerCase().includes(searchLower);
            const matchesPort = (item.port || '').trim().toLowerCase().includes(searchLower);
            const matchesImporter = (item.importer || '').trim().toLowerCase().includes(searchLower);
            const matchesTruck = (item.truckNo || '').trim().toLowerCase().includes(searchLower);
            const brandList = [
                item.brand,
                ...(item.entries || []).map(e => e.brand),
                ...(item.brandEntries || []).map(e => e.brand)
            ].filter(Boolean);
            const matchesBrand = brandList.some(b => (b || '').trim().toLowerCase().includes(searchLower));
            return matchesLC || matchesPort || matchesImporter || matchesTruck || matchesBrand;
        });

        const groupedMap = filteredRaw.reduce((acc, item) => {
            const key = `${item.date}_${item.lcNo}_${item.truckNo}`;
            const normalizeStr = (s) => (s || '').toString().trim().toLowerCase();
            const targetLC = normalizeStr(item.lcNo);
            const targetTruck = normalizeStr(item.truckNo);
            const targetProd = normalizeStr(item.productName || item.product);
            const targetBrand = normalizeStr(item.brand);

            const relatedWhRecords = (warehouseData || []).filter(w => {
                const wLC = normalizeStr(w.lcNo);
                const wTruck = normalizeStr(w.truckNo);
                const wProd = normalizeStr(w.productName || w.product);
                const wBrand = normalizeStr(w.brand);
                return wLC === targetLC && wProd === targetProd && wBrand === targetBrand && (wTruck === targetTruck || (!wTruck && !targetTruck));
            });

            const physicalWhQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whQty) || 0), 0);
            const physicalWhPkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whPkt) || 0), 0);
            const saleQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.saleQuantity) || 0), 0);
            const salePkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.salePacket) || 0), 0);
            const shortageQty = parseFloat(item.sweepedQuantity) || 0;

            if (!acc[key]) {
                acc[key] = {
                    ...item,
                    allIds: [item._id],
                    totalQuantity: parseFloat(item.quantity) || 0,
                    totalPacket: parseFloat(item.packet) || 0,
                    totalInHousePacket: physicalWhPkt,
                    totalInHouseQuantity: physicalWhQty,
                    totalShortage: shortageQty,
                    totalSaleQuantity: saleQty,
                    totalSalePacket: salePkt,
                    entries: [{
                        brand: item.brand || item.productName,
                        purchasedPrice: item.purchasedPrice,
                        packet: item.packet,
                        packetSize: item.packetSize,
                        quantity: item.quantity,
                        inHousePacket: physicalWhPkt,
                        inHouseQuantity: physicalWhQty,
                        sweepedPacket: item.sweepedPacket,
                        sweepedQuantity: item.sweepedQuantity,
                        saleQuantity: saleQty,
                        salePacket: salePkt,
                        unit: item.unit
                    }]
                };
            } else {
                acc[key].allIds.push(item._id);
                acc[key].totalQuantity += parseFloat(item.quantity) || 0;
                acc[key].totalPacket += parseFloat(item.packet) || 0;
                acc[key].totalInHousePacket += physicalWhPkt;
                acc[key].totalInHouseQuantity += physicalWhQty;
                acc[key].totalShortage += shortageQty;
                acc[key].totalSaleQuantity += saleQty;
                acc[key].totalSalePacket += salePkt;
                acc[key].entries.push({
                    brand: item.brand || item.productName,
                    purchasedPrice: item.purchasedPrice,
                    packet: item.packet,
                    packetSize: item.packetSize,
                    quantity: item.quantity,
                    inHousePacket: physicalWhPkt,
                    inHouseQuantity: physicalWhQty,
                    sweepedPacket: item.sweepedPacket,
                    sweepedQuantity: item.sweepedQuantity,
                    saleQuantity: saleQty,
                    salePacket: salePkt,
                    unit: item.unit
                });
            }
            return acc;
        }, {});

        return Object.values(groupedMap).sort((a, b) => {
            const config = sortConfig.history;
            if (!config) return 0;
            const aVal = a[config.key];
            const bVal = b[config.key];
            if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewRecord, historyTab, stockRecords, historySearchQuery, historyFilters, warehouseData, sortConfig.history]);

    const activeSaleHistory = useMemo(() => {
        if (!viewRecord) return [];
        const searchLower = historySearchQuery.toLowerCase().trim();
        const productName = (viewRecord.data.productName || '').trim().toLowerCase();

        const filteredSales = (salesRecords || []).filter(sale => {
            const hasMatchingProduct = (sale.items || []).some(item =>
                (item.productName || '').trim().toLowerCase() === productName
            );
            if (!hasMatchingProduct) return false;
            if (historyFilters.startDate && sale.date < historyFilters.startDate) return false;
            if (historyFilters.endDate && sale.date > historyFilters.endDate) return false;

            if (searchLower) {
                const matchesInvoice = (sale.invoiceNo || '').toLowerCase().includes(searchLower);
                const matchesCompany = (sale.companyName || '').toLowerCase().includes(searchLower);
                const matchesCustomer = (sale.customerName || '').toLowerCase().includes(searchLower);
                const matchesPhone = (sale.contact || '').toLowerCase().includes(searchLower);
                const matchesItemBrand = (sale.items || [])
                    .filter(item => (item.productName || '').trim().toLowerCase() === productName)
                    .some(item => (item.brandEntries || []).some(entry => (entry.brand || '').toLowerCase().includes(searchLower)));
                return matchesInvoice || matchesCompany || matchesCustomer || matchesPhone || matchesItemBrand;
            }
            return true;
        });

        const flattened = [];
        filteredSales.forEach(sale => {
            const matchingItems = (sale.items || []).filter(item =>
                (item.productName || '').trim().toLowerCase() === productName
            );
            matchingItems.forEach(item => {
                (item.brandEntries || []).forEach(entry => {
                    if (historyFilters.brand && (entry.brand || '').trim().toLowerCase() !== historyFilters.brand.toLowerCase()) return;
                    if (searchLower) {
                        const matchesEnv = (sale.invoiceNo || '').toLowerCase().includes(searchLower) ||
                            (sale.companyName || '').toLowerCase().includes(searchLower) ||
                            (sale.customerName || '').toLowerCase().includes(searchLower) ||
                            (sale.contact || '').toLowerCase().includes(searchLower);
                        const matchesBrand = (entry.brand || '').toLowerCase().includes(searchLower);
                        if (!matchesEnv && !matchesBrand) return;
                    }

                    const brandLower = (entry.brand || '').trim().toLowerCase();
                    // Try exact product+brand match first; fall back to product-only for single-entry (no-brand) products
                    let purchaseRecord = stockRecords.find(s =>
                        (s.productName || '').trim().toLowerCase() === productName &&
                        (s.brand || '').trim().toLowerCase() === brandLower
                    );
                    if (!purchaseRecord) {
                        purchaseRecord = stockRecords.find(s =>
                            (s.productName || '').trim().toLowerCase() === productName
                        );
                    }
                    const pktSize = parseFloat(purchaseRecord?.packetSize) || 0;
                    const qty = parseFloat(entry.quantity) || 0;
                    const calculatedPacket = pktSize > 0 ? (qty / pktSize) : 0;

                    flattened.push({
                        ...sale,
                        itemBrand: entry.brand,
                        itemTruck: entry.truck,
                        itemPacket: calculatedPacket,
                        itemQty: qty,
                        itemPrice: parseFloat(entry.unitPrice) || 0,
                        itemTotal: parseFloat(entry.totalAmount) || 0,
                        unit: 'kg'
                    });
                });
            });
        });

        return flattened.sort((a, b) => {
            const config = sortConfig.history;
            if (!config) return 0;
            const aVal = a[config.key];
            const bVal = b[config.key];
            if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [viewRecord, salesRecords, stockRecords, historySearchQuery, historyFilters, sortConfig.history]);

    const handleGenerateProductReport = () => {
        if (!viewRecord) return;
        const productName = (viewRecord.data.productName || '').trim().toLowerCase();

        // 1. Flatten Purchase History from activePurchaseHistory
        const purchaseFlattened = [];
        activePurchaseHistory.forEach(record => {
            // Support both old `entries` format and LC Receive `brandEntries` format
            const entries = record.brandEntries || record.entries || [];
            entries.forEach(entry => {
                // Apply brand filter if present
                const brandMatch = !historyFilters.brand || (entry.brand || '').trim().toLowerCase() === historyFilters.brand.toLowerCase();
                if (brandMatch) {
                    purchaseFlattened.push({
                        ...record,
                        itemBrand: entry.brand,
                        itemPurchasedPrice: entry.purchasedPrice,
                        itemPacket: entry.packet,
                        itemQty: entry.quantity,
                        itemInHouseQty: entry.inHouseQuantity,
                        itemShortageQty: entry.sweepedQuantity,
                        itemExporter: record.exporter,
                        unit: entry.unit
                    });
                }
            });
        });

        // 2. Calculate Sale History (already flattened in activeSaleHistory)
        const saleFlattened = activeSaleHistory;

        setProductHistoryReportData({
            productName: viewRecord.data.productName,
            category: viewRecord.data.category,
            filters: historyFilters,
            purchaseHistory: purchaseFlattened,
            saleHistory: saleFlattened
        });
        setShowProductHistoryReport(true);
    };

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
                    const salePacket = decrypted.salePacket !== undefined && decrypted.salePacket !== null ? decrypted.salePacket : 0;
                    const saleQuantity = decrypted.saleQuantity !== undefined && decrypted.saleQuantity !== null ? decrypted.saleQuantity : 0;

                    return {
                        ...decrypted,
                        productName: decrypted.product,
                        inhousePkt,
                        inhouseQty,
                        whPkt,
                        whQty,
                        salePacket,
                        saleQuantity,
                        packetSize: decrypted.packetSize || (parseFloat(whQty) > 0 && parseFloat(whPkt) > 0 ? (parseFloat(whQty) / parseFloat(whPkt)).toFixed(0) : 0),
                        _id: item._id,
                        recordType: 'warehouse',
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // AUTO-FILL MISSING TRUCK NO FOR HISTORICAL TRANSFERS
            const normalizeStr = (s) => (s || '').toString().trim().toLowerCase();
            allDecryptedWh.forEach(wh => {
                const wLC = normalizeStr(wh.lcNo);
                const wProd = normalizeStr(wh.productName || wh.product);
                const wBrand = normalizeStr(wh.brand);
                const wTruck = normalizeStr(wh.truckNo);

                if (wLC && !wTruck && (parseFloat(wh.whQty) > 0 || parseFloat(wh.whPkt) > 0)) {
                    const matchingStock = stockDataDecrypted.find(s =>
                        normalizeStr(s.lcNo) === wLC &&
                        normalizeStr(s.productName || s.product) === wProd &&
                        normalizeStr(s.brand) === wBrand &&
                        normalizeStr(s.truckNo) !== ''
                    );
                    if (matchingStock && matchingStock.truckNo) {
                        wh.truckNo = matchingStock.truckNo;
                    }
                }
            });

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

                const salePacket = d.salePacket !== undefined && d.salePacket !== null ? d.salePacket : 0;
                const saleQuantity = d.saleQuantity !== undefined && d.saleQuantity !== null ? d.saleQuantity : 0;

                return {
                    ...d,
                    whName: rawWh,
                    inhousePkt,
                    inhouseQty,
                    whPkt,
                    whQty,
                    salePacket,
                    saleQuantity,
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
        if (typeof fetchSales === 'function') {
            fetchSales();
        }
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
                    const targetProd = (currentProductName || '').trim().toLowerCase();
                    const targetBrand = (value || '').trim().toLowerCase();
                    const targetWh = (addWarehouseStockFormData.whName || '').trim().toLowerCase();

                    const matchingStockEntries = warehouseData.filter(item =>
                        ((item.productName || '').trim().toLowerCase() === targetProd || (item.product || '').trim().toLowerCase() === targetProd) &&
                        (item.brand || '').trim().toLowerCase() === targetBrand
                    );

                    const globalInPkt = matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].inhousePkt) || 0) : 0;
                    const globalInQty = matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].inhouseQty) || 0) : 0;

                    let totalWhPkt = 0;
                    let totalWhQty = 0;

                    matchingStockEntries.forEach(item => {
                        if ((item.whName || '').trim().toLowerCase() === targetWh) {
                            totalWhPkt += (parseFloat(item.whPkt) || 0);
                            totalWhQty += (parseFloat(item.whQty) || 0);
                        }
                    });

                    // Deduct Sales dynamically
                    let totalSaleQty = 0;
                    let totalSalePkt = 0;
                    let whSaleQty = 0;
                    let whSalePkt = 0;

                    (salesRecords || []).forEach(sale => {
                        if (sale.items) {
                            sale.items.forEach(saleItem => {
                                if ((saleItem.productName || '').trim().toLowerCase() === targetProd) {
                                    if (saleItem.brandEntries) {
                                        saleItem.brandEntries.forEach(entry => {
                                            if ((entry.brand || '').trim().toLowerCase() === targetBrand) {
                                                const sQty = parseFloat(entry.quantity) || 0;
                                                const pktSize = parseFloat(saleItem.packetSize || entry.packetSize) || (matchingStockEntries[0]?.packetSize ? parseFloat(matchingStockEntries[0].packetSize) : 0);
                                                const sPkt = pktSize > 0 ? sQty / pktSize : 0;

                                                totalSaleQty += sQty;
                                                totalSalePkt += sPkt;

                                                if ((entry.warehouseName || '').trim().toLowerCase() === targetWh) {
                                                    whSaleQty += sQty;
                                                    whSalePkt += sPkt;
                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });

                    const finalInPkt = Math.max(0, globalInPkt - totalSalePkt);
                    const finalInQty = Math.max(0, globalInQty - totalSaleQty);
                    const finalWhPkt = Math.max(0, totalWhPkt - whSalePkt);
                    const finalWhQty = Math.max(0, totalWhQty - whSaleQty);

                    updatedBrands[bIndex] = {
                        ...updatedBrands[bIndex],
                        [name]: value,
                        inhousePkt: finalInPkt ? Number(finalInPkt.toFixed(2)) : 0,
                        inhouseQty: finalInQty ? Number(finalInQty.toFixed(2)) : 0,
                        whPkt: finalWhPkt ? Number(finalWhPkt.toFixed(2)) : 0,
                        whQty: finalWhQty ? Number(finalWhQty.toFixed(2)) : 0,
                        packetSize: matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].packetSize) || 0) : 0
                    };
                    setActiveWhProductIndex(pIndex);
                    setActiveWhBrandIndex(bIndex);
                    setShowWhBrandDropdown(true);
                } else if (name === 'brand_refresh') {
                    // Logic for refreshing an existing brand's data (used when whName changes)
                    const currentProductName = updatedProducts[pIndex].productName;
                    const targetProd = (currentProductName || '').trim().toLowerCase();
                    const targetBrand = (value || '').trim().toLowerCase();
                    const targetWh = (addWarehouseStockFormData.whName || '').trim().toLowerCase();

                    const matchingStockEntries = warehouseData.filter(item =>
                        ((item.productName || '').trim().toLowerCase() === targetProd || (item.product || '').trim().toLowerCase() === targetProd) &&
                        (item.brand || '').trim().toLowerCase() === targetBrand
                    );

                    const globalInPkt = matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].inhousePkt) || 0) : 0;
                    const globalInQty = matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].inhouseQty) || 0) : 0;

                    let totalWhPkt = 0;
                    let totalWhQty = 0;

                    matchingStockEntries.forEach(item => {
                        if ((item.whName || '').trim().toLowerCase() === targetWh) {
                            totalWhPkt += (parseFloat(item.whPkt) || 0);
                            totalWhQty += (parseFloat(item.whQty) || 0);
                        }
                    });

                    // Deduct Sales dynamically
                    let totalSaleQty = 0;
                    let totalSalePkt = 0;
                    let whSaleQty = 0;
                    let whSalePkt = 0;

                    (salesRecords || []).forEach(sale => {
                        if (sale.items) {
                            sale.items.forEach(saleItem => {
                                if ((saleItem.productName || '').trim().toLowerCase() === targetProd) {
                                    if (saleItem.brandEntries) {
                                        saleItem.brandEntries.forEach(entry => {
                                            if ((entry.brand || '').trim().toLowerCase() === targetBrand) {
                                                const sQty = parseFloat(entry.quantity) || 0;
                                                const pktSize = parseFloat(saleItem.packetSize || entry.packetSize) || (matchingStockEntries[0]?.packetSize ? parseFloat(matchingStockEntries[0].packetSize) : 0);
                                                const sPkt = pktSize > 0 ? sQty / pktSize : 0;

                                                totalSaleQty += sQty;
                                                totalSalePkt += sPkt;

                                                if ((entry.warehouseName || '').trim().toLowerCase() === targetWh) {
                                                    whSaleQty += sQty;
                                                    whSalePkt += sPkt;
                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });

                    const finalInPkt = Math.max(0, globalInPkt - totalSalePkt);
                    const finalInQty = Math.max(0, globalInQty - totalSaleQty);
                    const finalWhPkt = Math.max(0, totalWhPkt - whSalePkt);
                    const finalWhQty = Math.max(0, totalWhQty - whSaleQty);

                    updatedBrands[bIndex] = {
                        ...updatedBrands[bIndex],
                        brand: value,
                        inhousePkt: finalInPkt ? Number(finalInPkt.toFixed(2)) : 0,
                        inhouseQty: finalInQty ? Number(finalInQty.toFixed(2)) : 0,
                        whPkt: finalWhPkt ? Number(finalWhPkt.toFixed(2)) : 0,
                        whQty: finalWhQty ? Number(finalWhQty.toFixed(2)) : 0,
                        packetSize: matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].packetSize) || 0) : 0
                    };
                } else if (name === 'transferQty') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const currentBrandName = updatedBrands[bIndex].brand;

                    const pktSize = parseFloat(updatedBrands[bIndex].packetSize) || 0;
                    let calculatedPkt = updatedBrands[bIndex].transferPkt;

                    if (pktSize > 0) {
                        const qty = parseFloat(value) || 0;
                        if (qty > 0) {
                            calculatedPkt = (qty / pktSize).toFixed(2);
                            if (calculatedPkt.endsWith('.00')) calculatedPkt = calculatedPkt.slice(0, -3);
                        } else {
                            calculatedPkt = '';
                        }
                    }

                    updatedBrands[bIndex] = { ...updatedBrands[bIndex], [name]: value, transferPkt: calculatedPkt };
                } else if (name === 'transferPkt') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const currentBrandName = updatedBrands[bIndex].brand;

                    const pktSize = parseFloat(updatedBrands[bIndex].packetSize) || 0;
                    let calculatedQty = updatedBrands[bIndex].transferQty;

                    if (pktSize > 0) {
                        const pkt = parseFloat(value) || 0;
                        if (pkt > 0) {
                            calculatedQty = (pkt * pktSize).toFixed(2);
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
                    // Auto-populate brands for this product if whName is selected
                    const targetWh = (addWarehouseStockFormData.whName || '').trim().toLowerCase();
                    const targetProd = (value || '').trim().toLowerCase();

                    // Find all unique brands for this product in warehouseData
                    const productBrands = [...new Set(warehouseData
                        .filter(item => (item.productName || item.product || '').trim().toLowerCase() === targetProd)
                        .map(item => item.brand))]
                        .filter(Boolean);

                    let autoFilledBrands = [];
                    if (productBrands.length > 0) {
                        autoFilledBrands = productBrands.map(brandName => {
                            // Calculate quantities for each brand
                            const matchingStockEntries = warehouseData.filter(item =>
                                ((item.productName || '').trim().toLowerCase() === targetProd || (item.product || '').trim().toLowerCase() === targetProd) &&
                                (item.brand || '').trim().toLowerCase() === brandName.trim().toLowerCase()
                            );

                            const globalInPkt = matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].inhousePkt) || 0) : 0;
                            const globalInQty = matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].inhouseQty) || 0) : 0;

                            let totalWhPkt = 0;
                            let totalWhQty = 0;
                            matchingStockEntries.forEach(item => {
                                if ((item.whName || '').trim().toLowerCase() === targetWh) {
                                    totalWhPkt += (parseFloat(item.whPkt) || 0);
                                    totalWhQty += (parseFloat(item.whQty) || 0);
                                }
                            });

                            let tSaleQty = 0;
                            let tSalePkt = 0;
                            let wSaleQty = 0;
                            let wSalePkt = 0;

                            (salesRecords || []).forEach(sale => {
                                if (sale.items) {
                                    sale.items.forEach(saleItem => {
                                        if ((saleItem.productName || '').trim().toLowerCase() === targetProd) {
                                            if (saleItem.brandEntries) {
                                                saleItem.brandEntries.forEach(entry => {
                                                    if ((entry.brand || '').trim().toLowerCase() === brandName.trim().toLowerCase()) {
                                                        const sQty = parseFloat(entry.quantity) || 0;
                                                        const pktSize = parseFloat(saleItem.packetSize || entry.packetSize) || (matchingStockEntries[0]?.packetSize ? parseFloat(matchingStockEntries[0].packetSize) : 0);
                                                        const sPkt = pktSize > 0 ? sQty / pktSize : 0;
                                                        tSaleQty += sQty;
                                                        tSalePkt += sPkt;
                                                        if ((entry.warehouseName || '').trim().toLowerCase() === targetWh) {
                                                            wSaleQty += sQty;
                                                            wSalePkt += sPkt;
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    });
                                }
                            });

                            const fInPkt = Math.max(0, globalInPkt - tSalePkt);
                            const fInQty = Math.max(0, globalInQty - tSaleQty);
                            const fWhPkt = Math.max(0, totalWhPkt - wSalePkt);
                            const fWhQty = Math.max(0, totalWhQty - wSaleQty);

                            return {
                                brand: brandName,
                                inhousePkt: fInPkt ? Number(fInPkt.toFixed(2)) : 0,
                                inhouseQty: fInQty ? Number(fInQty.toFixed(2)) : 0,
                                whPkt: fWhPkt ? Number(fWhPkt.toFixed(2)) : 0,
                                whQty: fWhQty ? Number(fWhQty.toFixed(2)) : 0,
                                transferPkt: '',
                                transferQty: '',
                                packetSize: matchingStockEntries.length > 0 ? (parseFloat(matchingStockEntries[0].packetSize) || 0) : 0
                            };
                        });
                    }

                    updatedProducts[pIndex] = {
                        ...updatedProducts[pIndex],
                        [name]: value,
                        brandEntries: autoFilledBrands.length > 0 ? autoFilledBrands : [{ brand: '', inhousePkt: '', inhouseQty: '', whPkt: '', whQty: '', transferPkt: '', transferQty: '', packetSize: '' }]
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
                setAddWarehouseStockFormData(prev => {
                    const nextState = { ...prev, [name]: value };

                    // If whName changes, refresh all current brand entries with new quantities
                    if (name === 'whName') {
                        const newWh = (value || '').trim().toLowerCase();
                        nextState.productEntries = nextState.productEntries.map(prod => {
                            if (!prod.productName) return prod;
                            const targetProd = (prod.productName || '').trim().toLowerCase();

                            const refreshedBrands = prod.brandEntries.map(brandInfo => {
                                if (!brandInfo.brand) return brandInfo;
                                const targetBrand = (brandInfo.brand || '').trim().toLowerCase();

                                // Calculate matching stock entries for this brand
                                const matchingStockEntries = warehouseData.filter(item =>
                                    ((item.productName || '').trim().toLowerCase() === targetProd || (item.product || '').trim().toLowerCase() === targetProd) &&
                                    (item.brand || '').trim().toLowerCase() === targetBrand
                                );

                                // Calculate Warehouse Specific Totals
                                let totalWhPkt = 0;
                                let totalWhQty = 0;
                                matchingStockEntries.forEach(item => {
                                    if ((item.whName || '').trim().toLowerCase() === newWh) {
                                        totalWhPkt += (parseFloat(item.whPkt) || 0);
                                        totalWhQty += (parseFloat(item.whQty) || 0);
                                    }
                                });

                                // Deduct Sales specifically for this warehouse
                                let whSaleQty = 0;
                                let whSalePkt = 0;
                                (salesRecords || []).forEach(sale => {
                                    if (sale.items) {
                                        sale.items.forEach(saleItem => {
                                            if ((saleItem.productName || '').trim().toLowerCase() === targetProd) {
                                                if (saleItem.brandEntries) {
                                                    saleItem.brandEntries.forEach(entry => {
                                                        if ((entry.brand || '').trim().toLowerCase() === targetBrand && (entry.warehouseName || '').trim().toLowerCase() === newWh) {
                                                            const sQty = parseFloat(entry.quantity) || 0;
                                                            const pktSize = parseFloat(saleItem.packetSize || entry.packetSize) || (matchingStockEntries[0]?.packetSize ? parseFloat(matchingStockEntries[0].packetSize) : 0);
                                                            whSaleQty += sQty;
                                                            whSalePkt += pktSize > 0 ? sQty / pktSize : 0;
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                    }
                                });

                                return {
                                    ...brandInfo,
                                    whPkt: Number(Math.max(0, totalWhPkt - whSalePkt).toFixed(2)),
                                    whQty: Number(Math.max(0, totalWhQty - whSaleQty).toFixed(2))
                                };
                            });
                            return { ...prod, brandEntries: refreshedBrands };
                        });
                    }
                    return nextState;
                });
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
                    transferQty: '',
                    packetSize: ''
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
            transferQty: '',
            packetSize: ''
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
                            const newWhQty = availableQty - deductQty;
                            const newWhPkt = availablePkt - deductPkt;

                            const updatedSource = {
                                ...sourceRecord,
                                whQty: newWhQty,
                                whPkt: newWhPkt,
                                ...(sourceRecord.recordType === 'stock' && {
                                    inHouseQuantity: newWhQty,
                                    inhouseQty: newWhQty,
                                    inHousePacket: newWhPkt,
                                    inhousePkt: newWhPkt
                                })
                            };

                            updates.push({ record: updatedSource, original: sourceRecord });

                            lcSrrDeductions.push({
                                lcNo: sourceRecord.lcNo || '',
                                truckNo: sourceRecord.truckNo || '',
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
                            (item.lcNo === deduction.lcNo || (!item.lcNo && !deduction.lcNo)) &&
                            (item.truckNo === deduction.truckNo || (!item.truckNo && !deduction.truckNo))
                        );

                        if (destRecord) {
                            const newWhQty = (parseFloat(destRecord.whQty) || 0) + deduction.qty;
                            const newWhPkt = (parseFloat(destRecord.whPkt) || 0) + deduction.pkt;

                            const updatedDest = {
                                ...destRecord,
                                whQty: newWhQty,
                                whPkt: newWhPkt,
                                ...(destRecord.recordType === 'stock' && {
                                    inHouseQuantity: newWhQty,
                                    inhouseQty: newWhQty,
                                    inHousePacket: newWhPkt,
                                    inhousePkt: newWhPkt
                                })
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
                                truckNo: deduction.truckNo,
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
            // Check nested entries for multi-brand records (old format)
            if (item.entries) {
                item.entries.forEach(e => {
                    if (e.brand) brandsSet.add(e.brand.trim());
                });
            }
            // Check brandEntries (LC Receive format)
            if (item.brandEntries) {
                item.brandEntries.forEach(e => {
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
                if (filterDropdownOpen.productName && stockProductFilterRef.current && !stockProductFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, productName: false }));
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
            if (showWhProductDropdown && whProductDropdownRefs.current[activeWhProductIndex] && !whProductDropdownRefs.current[activeWhProductIndex].contains(event.target)) {
                setShowWhProductDropdown(false);
            }
            if (showWhBrandDropdown && whBrandDropdownRefs.current[`${activeWhProductIndex}-${activeWhBrandIndex}`] && !whBrandDropdownRefs.current[`${activeWhProductIndex}-${activeWhBrandIndex}`].contains(event.target)) {
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
    }, [showStockFilterPanel, showHistoryFilterPanel, activeDropdown, filterDropdownOpen, viewRecord, showWhDropdown, showToDropdown, showWhProductDropdown, showWhBrandDropdown, activeWhProductIndex, activeWhBrandIndex]);

    // Scroll Lock Effect
    useEffect(() => {
        const hasActiveOverlay =
            showStockFilterPanel ||
            viewRecord ||
            showStockReport ||
            showProductHistoryReport ||
            showAddWarehouseStockForm ||
            showStockForm;

        if (hasActiveOverlay) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showStockFilterPanel, viewRecord, showStockReport, showProductHistoryReport, showAddWarehouseStockForm, showStockForm]);

    // --- Helpers ---

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const parts = dateString.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getFilteredOptions = (type) => {
        const options = stockRecords.map(item => item[type]).filter(Boolean);
        const uniqueOptions = [...new Set(options)].map(opt => ({ _id: opt, name: opt }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
            // Check both entries (old format) and brandEntries (LC Receive format)
            if (r.entries) r.entries.forEach(e => { if (e.brand) allBrands.add(e.brand) });
            if (r.brandEntries) r.brandEntries.forEach(e => { if (e.brand) allBrands.add(e.brand) });
        });
        // Return unique brand names sorted alphabetically
        const brands = Array.from(allBrands).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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
        // 5. INHOUSE PKT = Total InHouse Pkt
        // 6. INHOUSE QTY = InHouse Pkt * Size
        if (field === 'packet' || field === 'packetSize' || field === 'sweepedPacket') {
            entry.sweepedQuantity = (sweepedPacket * packetSize).toFixed(2);
            entry.totalInHousePacket = (packet - sweepedPacket).toFixed(2);
            entry.totalInHouseQuantity = (parseFloat(entry.totalInHousePacket) * packetSize).toFixed(2);
            entry.inHousePacket = entry.totalInHousePacket;
            entry.inHouseQuantity = entry.totalInHouseQuantity;
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
                            salePacket: brandEntry.salePacket,
                            saleQuantity: brandEntry.saleQuantity,
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
        // Use either _id (single) or the first id from the group (grouped) to mark as editing
        const editId = record._id || (record.allIds && record.allIds[0]);
        setEditingId(editId);

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
                originalIds: record.allIds || [record._id],
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
        return calculateStockData(stockRecords, stockFilters, stockSearchQuery, warehouseData, salesRecords, products);
    }, [stockRecords, stockFilters, stockSearchQuery, warehouseData, salesRecords, products]);

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
        totalInHousePktWhole,
        totalInHousePktDecimalKg,
        totalInHouseQty,
        totalSalePkt,
        totalSalePktWhole,
        totalSaleQty,
        totalSalePktDecimalKg,
        totalShortage,
        unit
    } = stockData;

    return (
        <div className="stock-management-container space-y-6">
            {(!showStockForm && !showAddWarehouseStockForm) && (
                <>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="w-full md:w-1/4">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center md:text-left">Stock Management</h2>
                        </div>

                        <div className="w-full md:flex-1 max-w-none md:max-w-md mx-auto relative group">
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

                        <div className="w-full md:w-1/4 flex items-center justify-between md:justify-end gap-2">
                            <div className="relative flex-1 md:flex-none">
                                <button
                                    ref={stockFilterButtonRef}
                                    onClick={() => setShowStockFilterPanel(!showStockFilterPanel)}
                                    className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showStockFilterPanel || Object.values(stockFilters).some(v => v !== '')
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FunnelIcon className={`w-4 h-4 ${showStockFilterPanel || Object.values(stockFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                    <span className="text-sm font-medium">Filter</span>
                                </button>

                                {showStockFilterPanel && (
                                    <>
                                        {/* Backdrop for mobile */}
                                        <div
                                            className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]"
                                            onClick={() => setShowStockFilterPanel(false)}
                                        />
                                        <div ref={stockFilterRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 md:w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[80vh] md:max-h-none">
                                            <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                                <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                                <button onClick={() => { setStockFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', importer: '', productName: '', category: 'Crop' }); setFilterSearchInputs({ ...filterSearchInputs, lcNoSearch: '', portSearch: '', importerSearch: '', brandSearch: '', productSearch: '', categorySearch: '' }); setShowStockFilterPanel(false); }} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">RESET ALL</button>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <CustomDatePicker label="From Date" value={stockFilters.startDate} onChange={(e) => setStockFilters({ ...stockFilters, startDate: e.target.value })} compact={true} />
                                                    <CustomDatePicker label="To Date" value={stockFilters.endDate} onChange={(e) => setStockFilters({ ...stockFilters, endDate: e.target.value })} compact={true} rightAlign={true} />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                                    {/* Category Filter */}
                                                    <div className="space-y-1.5 relative" ref={stockCategoryFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Category</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.categorySearch}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFilterSearchInputs({ ...filterSearchInputs, categorySearch: val });
                                                                    setStockFilters({ ...stockFilters, category: val });
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, category: true });
                                                                }}
                                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, category: true })}
                                                                placeholder={stockFilters.category || "Search Category..."}
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.category ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                            />
                                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                {stockFilters.category && (
                                                                    <button onClick={() => { setStockFilters({ ...stockFilters, category: '' }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                        <XIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                        {filterDropdownOpen.category && (() => {
                                                            const options = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
                                                            const filtered = options.filter(c => c.toLowerCase().includes(filterSearchInputs.categorySearch.toLowerCase()));
                                                            return filtered.length > 0 ? (
                                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {filtered.map(c => (
                                                                        <button
                                                                            key={c}
                                                                            type="button"
                                                                            onClick={() => { setStockFilters({ ...stockFilters, category: c }); setFilterSearchInputs({ ...filterSearchInputs, categorySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {c}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    <div className="space-y-1.5 relative" ref={stockProductFilterRef}>
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
                                                                onClick={() => {
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, productName: !filterDropdownOpen.productName });
                                                                }}
                                                                placeholder="Search Product..."
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm ${stockFilters.productName ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                                                {stockFilters.productName ? (
                                                                    <button
                                                                        onClick={() => {
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
                                                            let options = getFilteredProducts(filterSearchInputs.productSearch);
                                                            if (stockFilters.category) {
                                                                options = options.filter(p => (p.category || '').toLowerCase() === stockFilters.category.toLowerCase());
                                                            }
                                                            return options.length > 0 ? (
                                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    {options.map(product => (
                                                                        <button
                                                                            key={product._id || product.name}
                                                                            type="button"
                                                                            onClick={() => { setStockFilters({ ...stockFilters, productName: product.name }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: product.name }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            {product.name}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    <div className="space-y-1.5 relative" ref={stockBrandFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={stockFilters.brand || filterSearchInputs.brandSearch}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: val });
                                                                    setStockFilters({ ...stockFilters, brand: '' });
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                                }}
                                                                onClick={() => {
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand });
                                                                }}
                                                                placeholder="Search Brand..."
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm ${stockFilters.brand ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                disabled={!stockFilters.productName}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                                                {stockFilters.brand ? (
                                                                    <button
                                                                        onClick={() => {
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
                                                                            onClick={() => { setStockFilters({ ...stockFilters, brand }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: brand }); setFilterDropdownOpen(initialFilterDropdownState); }}
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

                                                <div className="mt-6 pt-4 border-t border-gray-50 flex md:hidden">
                                                    <button
                                                        onClick={() => setShowStockFilterPanel(false)}
                                                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                                                    >
                                                        Apply Filters
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setShowStockReport(true)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 md:px-4 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 text-sm font-medium"
                            >
                                <BarChartIcon className="w-4 h-4 text-gray-400" />
                                <span>Report</span>
                            </button>
                            <button
                                onClick={() => setShowAddWarehouseStockForm(true)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-95 font-bold text-sm"
                            >
                                <PlusIcon className="w-5 h-5 text-white/90" />
                                <span>Transfer</span>
                            </button>
                        </div>
                    </div>
                    {/* Summary Cards */}
                    <div className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4 mb-4 md:mb-0">
                        {[
                            { label: 'TOTAL BAG', value: Math.round(totalPackets).toLocaleString(), bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                            { label: 'TOTAL QUANTITY', value: `${Math.round(totalQuantity).toLocaleString()} ${unit}`, bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                            { label: 'TOTAL SALE BAG', value: `${(totalSalePktWhole || 0).toLocaleString()} - ${(totalSalePktDecimalKg || 0).toLocaleString()} kg`, bgColor: 'bg-orange-50/50', borderColor: 'border-orange-100', textColor: 'text-orange-700', labelColor: 'text-orange-600' },
                            { label: 'TOTAL SALE QTY', value: `${Math.round(totalSaleQty).toLocaleString()} ${unit}`, bgColor: 'bg-orange-50/50', borderColor: 'border-orange-100', textColor: 'text-orange-700', labelColor: 'text-orange-600' },
                            { label: 'INHOUSE BAG', value: `${(totalInHousePktWhole || 0).toLocaleString()} - ${Math.round(totalInHousePktDecimalKg || 0).toLocaleString()} kg`, bgColor: 'bg-emerald-50/50', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                            { label: 'INHOUSE QTY', value: `${Math.round(totalInHouseQty).toLocaleString()} ${unit}`, bgColor: 'bg-emerald-50/50', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                            { label: 'SHORTAGE', value: `${Math.round(totalShortage).toLocaleString()} ${unit}`, bgColor: 'bg-rose-50/50', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600' },
                        ].map((card, i) => (
                            <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-3 md:p-4 rounded-xl shadow-sm transition-all hover:shadow-md md:flex-1 ${i === 6 ? 'w-full md:w-auto' : 'w-[calc(50%-6px)] md:w-auto'}`}>
                                <div className={`text-[10px] md:text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-0.5 md:mb-1 whitespace-nowrap`}>{card.label}</div>
                                <div className={`text-sm md:text-xl font-bold ${card.textColor} truncate`} title={card.value}>{card.value}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Add Stock to Warehouse Form Card */}
            {showAddWarehouseStockForm && (
                <div className="warehouse-form-container border-blue-100 mb-6">
                    <div className="warehouse-form-bg-orb bg-blue-400/20 left-1/4 top-1/4"></div>
                    <div className="warehouse-form-bg-orb bg-indigo-400/20 right-1/4 bottom-1/4"></div>

                    <div className="warehouse-form-header">
                        <div>
                            <h3 className="warehouse-form-title">Transfer Product to Warehouse</h3>
                            <p className="text-[12px] md:text-sm text-gray-500">Record a new stock transfer or direct entry to warehouse</p>
                        </div>
                        <button onClick={() => setShowAddWarehouseStockForm(false)} className="warehouse-form-close hover:bg-blue-50 hover:text-blue-600">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleAddWarehouseStockSubmit} className="relative z-10 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
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

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
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
                                                className="absolute -top-3 -right-3 p-2 bg-white text-red-400 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-100 md:opacity-0 md:group-hover/product:opacity-100 transition-all duration-300 hover:scale-110 active:scale-90 z-20"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2 relative" ref={el => whProductDropdownRefs.current[pIndex] = el}>
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
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">InHouse BAG</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">WareHouse QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">WareHouse BAG</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Transfer QTY</div>
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Transfer BAG</div>
                                            </div>

                                            {product.brandEntries.map((brandEntry, bIndex) => (
                                                <div key={bIndex} className="flex flex-col lg:flex-row items-center gap-4 p-4 lg:p-3 bg-white/40 border border-gray-200/50 rounded-xl group/brand hover:border-blue-200 transition-all">
                                                    <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-8 gap-4 items-center">
                                                        <div className="lg:col-span-2 relative" ref={el => whBrandDropdownRefs.current[`${pIndex}-${bIndex}`] = el}>
                                                            <label className="block lg:hidden text-xs font-bold text-gray-500 mb-1">Brand</label>
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

                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 lg:col-span-6">
                                                            <div>
                                                                <label className="block lg:hidden text-xs font-bold text-gray-500 mb-1">InHouse QTY</label>
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
                                                            </div>
                                                            <div>
                                                                <label className="block lg:hidden text-xs font-bold text-gray-500 mb-1">InHouse BAG</label>
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
                                                            </div>
                                                            <div>
                                                                <label className="block lg:hidden text-xs font-bold text-gray-500 mb-1">Warehouse QTY</label>
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
                                                            </div>
                                                            <div>
                                                                <label className="block lg:hidden text-xs font-bold text-gray-500 mb-1">Warehouse BAG</label>
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
                                                            </div>
                                                            <div>
                                                                <label className="block lg:hidden text-xs font-bold text-indigo-500 mb-1">Transfer QTY</label>
                                                                <input
                                                                    type="number"
                                                                    name="transferQty"
                                                                    value={brandEntry.transferQty}
                                                                    onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                                    placeholder="0"
                                                                    className="w-full px-2 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-center font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                                    required
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block lg:hidden text-xs font-bold text-indigo-500 mb-1">Transfer BAG</label>
                                                                <input
                                                                    type="number"
                                                                    name="transferPkt"
                                                                    value={brandEntry.transferPkt}
                                                                    onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                                    placeholder="0"
                                                                    className="w-full px-2 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-center font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                                    required
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end lg:justify-start items-center gap-2 w-full lg:w-[72px] mt-2 lg:mt-0 pt-2 lg:pt-0 border-t border-gray-100 lg:border-t-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => addWarehouseBrandEntry(pIndex)}
                                                            className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2 text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white rounded-xl transition-all duration-300 font-bold text-xs shadow-sm active:scale-95 lg:w-9 lg:h-9 lg:p-0"
                                                        >
                                                            <PlusIcon className="w-4 h-4" />
                                                            <span className="lg:hidden ml-2">Add Brand</span>
                                                        </button>
                                                        {product.brandEntries.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeWarehouseBrandEntry(pIndex, bIndex)}
                                                                className="flex-1 lg:flex-none flex items-center justify-center px-4 py-2 text-red-600 bg-red-50/50 hover:bg-red-600 hover:text-white rounded-xl transition-all duration-300 font-bold text-xs shadow-sm active:scale-95 lg:w-9 lg:h-9 lg:p-0"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                                <span className="lg:hidden ml-2">Remove</span>
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

                        {/* Status Messages */}
                        <div className="px-6 mb-2">
                            {addWarehouseStockSubmitStatus === 'success' && (
                                <p className="text-green-600 font-medium flex items-center justify-center animate-bounce text-sm">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Stock saved successfully!
                                </p>
                            )}
                            {addWarehouseStockSubmitStatus === 'error' && (
                                <p className="text-red-600 font-medium flex items-center justify-center text-sm">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save stock.
                                </p>
                            )}
                        </div>

                        <div className="warehouse-form-footer border-t border-gray-100 pt-6 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowAddWarehouseStockForm(false)}
                                className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={addWarehouseStockSubmitStatus === 'submitting'}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 font-bold text-sm"
                            >
                                {addWarehouseStockSubmitStatus === 'submitting' ? (
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

                    {/* Mobile View: Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {stockData.displayRecords.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 font-medium italic">No stock records found</div>
                        ) : (
                            stockData.displayRecords.map((group, gIdx) => {
                                const isExpanded = expandedProducts === group.productName;
                                return (
                                    <div key={group.productName || gIdx} className="p-4 space-y-4 hover:bg-gray-50/50 transition-colors">
                                        <div className="flex justify-between items-start w-full">
                                            <div
                                                className="flex flex-col gap-1 cursor-pointer select-none flex-1 pr-2"
                                                onClick={() => toggleProductExpansion(group.productName)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-bold text-gray-900 leading-none">{group.productName}</h3>
                                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                                                </div>
                                                {!isExpanded && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${group.totalInHouseQuantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                            {group.totalInHouseQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                                <button
                                                    onClick={() => {
                                                        const targetProd = group.productName;
                                                        const targetWh = stockFilters.whName || ''; // Pre-fill if filtered
                                                        setAddWarehouseStockFormData({
                                                            whName: targetWh, manager: '', location: '', capacity: '',
                                                            to: '', toManager: '', toLocation: '', toCapacity: '',
                                                            productEntries: [{
                                                                productName: targetProd,
                                                                brandEntries: group.brandList.map(brand => ({
                                                                    brand: brand.brand,
                                                                    inhousePkt: brand.totalInHousePacket - (brand.salePacket || 0),
                                                                    inhouseQty: brand.totalInHouseQuantity - (brand.saleQuantity || 0),
                                                                    whPkt: 0,
                                                                    whQty: 0,
                                                                    transferPkt: '',
                                                                    transferQty: '',
                                                                    packetSize: brand.packetSize || 0
                                                                }))
                                                            }]
                                                        });
                                                        if (targetWh) {
                                                            const updatedProductEntries = [{
                                                                productName: targetProd,
                                                                brandEntries: group.brandList.map(brand => {
                                                                    const targetBrand = (brand.brand || '').trim().toLowerCase();
                                                                    const matchingStockEntries = warehouseData.filter(item =>
                                                                        ((item.productName || '').trim().toLowerCase() === targetProd.toLowerCase() || (item.product || '').trim().toLowerCase() === targetProd.toLowerCase()) &&
                                                                        (item.brand || '').trim().toLowerCase() === targetBrand
                                                                    );
                                                                    let totalWhPkt = 0; let totalWhQty = 0;
                                                                    matchingStockEntries.forEach(item => {
                                                                        if ((item.whName || '').trim().toLowerCase() === targetWh.trim().toLowerCase()) {
                                                                            totalWhPkt += (parseFloat(item.whPkt) || 0); totalWhQty += (parseFloat(item.whQty) || 0);
                                                                        }
                                                                    });
                                                                    let whSaleQty = 0; let whSalePkt = 0;
                                                                    (salesRecords || []).forEach(sale => {
                                                                        if (sale.items) {
                                                                            sale.items.forEach(saleItem => {
                                                                                if ((saleItem.productName || '').trim().toLowerCase() === targetProd.toLowerCase()) {
                                                                                    if (saleItem.brandEntries) {
                                                                                        saleItem.brandEntries.forEach(entry => {
                                                                                            if ((entry.brand || '').trim().toLowerCase() === targetBrand && (entry.warehouseName || '').trim().toLowerCase() === targetWh.trim().toLowerCase()) {
                                                                                                const sQty = parseFloat(entry.quantity) || 0;
                                                                                                const pktSize = parseFloat(saleItem.packetSize || entry.packetSize) || (matchingStockEntries[0]?.packetSize ? parseFloat(matchingStockEntries[0].packetSize) : 0);
                                                                                                whSaleQty += sQty; whSalePkt += pktSize > 0 ? sQty / pktSize : 0;
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }
                                                                            });
                                                                        }
                                                                    });

                                                                    return {
                                                                        brand: brand.brand,
                                                                        inhousePkt: Number(Math.max(0, brand.totalInHousePacket - (brand.salePacket || 0)).toFixed(2)),
                                                                        inhouseQty: Number(Math.max(0, brand.totalInHouseQuantity - (brand.saleQuantity || 0)).toFixed(2)),
                                                                        whPkt: Number(Math.max(0, totalWhPkt - whSalePkt).toFixed(2)),
                                                                        whQty: Number(Math.max(0, totalWhQty - whSaleQty).toFixed(2)),
                                                                        transferPkt: '', transferQty: '', packetSize: brand.packetSize || 0
                                                                    };
                                                                })
                                                            }];
                                                            setAddWarehouseStockFormData(prev => ({ ...prev, productEntries: updatedProductEntries }));
                                                        }
                                                        setShowAddWarehouseStockForm(true);
                                                    }}
                                                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all shadow-sm border border-indigo-100"
                                                    title="Transfer Product"
                                                >
                                                    <ShoppingCartIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setViewRecord({ data: group })}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all shadow-sm border border-blue-100"
                                                    title="View History"
                                                >
                                                    <EyeIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="flex flex-col gap-2 w-full mt-1">
                                                    <div className="grid grid-cols-3 gap-1 md:gap-2 w-full">
                                                        <div className="bg-blue-50 text-blue-700 py-1.5 rounded-md text-[10px] sm:text-xs font-bold border border-blue-100 flex items-center justify-center text-center whitespace-nowrap px-1">
                                                            TOT: {Math.round(group.totalInHousePacket).toLocaleString()} BAG
                                                        </div>
                                                        <div className="bg-orange-50 text-orange-700 py-1.5 rounded-md text-[10px] sm:text-xs font-bold border border-orange-100 flex items-center justify-center text-center whitespace-nowrap px-1">
                                                            SALE: {Math.round(group.salePacket || 0).toLocaleString()} BAG
                                                        </div>
                                                        <div className="bg-emerald-50 text-emerald-700 py-1.5 rounded-md text-[10px] sm:text-xs font-bold border border-emerald-100 flex items-center justify-center text-center whitespace-nowrap px-1">
                                                            IN: {Math.round(group.inHousePacket).toLocaleString()} BAG
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1 md:gap-2 w-full">
                                                        <div className="bg-blue-50 text-blue-700 py-1.5 rounded-md text-[10px] sm:text-xs font-bold border border-blue-100 flex items-center justify-center text-center whitespace-nowrap px-1">
                                                            TOT: {Math.round(group.totalInHouseQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="bg-orange-50 text-orange-700 py-1.5 rounded-md text-[10px] sm:text-xs font-bold border border-orange-100 flex items-center justify-center text-center whitespace-nowrap px-1">
                                                            SALE: {Math.round(group.saleQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="bg-emerald-50 text-emerald-700 py-1.5 rounded-md text-[10px] sm:text-xs font-bold border border-emerald-100 flex items-center justify-center text-center whitespace-nowrap px-1">
                                                            IN: {Math.round(group.inHouseQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Brands List Mobile */}
                                                <div className="space-y-3 pl-2 border-l-2 border-blue-100">
                                                    {group.brandList.map((brand, bIdx) => (
                                                        <div key={bIdx} className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-bold text-gray-800 text-sm truncate pr-2">{brand.brand || '-'}</span>
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${brand.totalInHouseQuantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {brand.totalInHouseQuantity > 0 ? 'In Stock' : 'Out of Stock'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <div className="bg-blue-50 text-blue-700 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-blue-100 flex items-center justify-center text-center whitespace-nowrap px-0.5">
                                                                        TOT: {Math.round(brand.totalInHousePacket).toLocaleString()} BAG
                                                                    </div>
                                                                    <div className="bg-orange-50 text-orange-700 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-orange-100 flex items-center justify-center text-center whitespace-nowrap px-0.5">
                                                                        SALE: {Math.round(brand.salePacket || 0).toLocaleString()} BAG
                                                                    </div>
                                                                    <div className="bg-emerald-50 text-emerald-700 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-emerald-100 flex items-center justify-center text-center whitespace-nowrap px-0.5">
                                                                        IN: {Math.round(brand.inHousePacket).toLocaleString()} BAG
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-1">
                                                                    <div className="bg-blue-50 text-blue-700 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-blue-100 flex items-center justify-center text-center whitespace-nowrap px-0.5">
                                                                        TOT: {Math.round(brand.totalInHouseQuantity).toLocaleString()} {group.unit}
                                                                    </div>
                                                                    <div className="bg-orange-50 text-orange-700 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-orange-100 flex items-center justify-center text-center whitespace-nowrap px-0.5">
                                                                        SALE: {Math.round(brand.saleQuantity || 0).toLocaleString()} {group.unit}
                                                                    </div>
                                                                    <div className="bg-emerald-50 text-emerald-700 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border border-emerald-100 flex items-center justify-center text-center whitespace-nowrap px-0.5">
                                                                        IN: {Math.round(brand.inHouseQuantity).toLocaleString()} {group.unit}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop View: Table */}

                    < div className="overflow-x-auto hidden md:block" >
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Product Name</th>
                                    <th colSpan="8" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="grid grid-cols-[2.5fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1fr] gap-4 whitespace-nowrap min-w-[1000px]">
                                            <div className="text-left text-gray-900 pr-2">Brand</div>
                                            <div className="text-center text-blue-800">Total Inhouse BAG</div>
                                            <div className="text-center text-blue-800">Total Inhouse QTY</div>
                                            <div className="text-center text-orange-800">Sale BAG</div>
                                            <div className="text-center text-orange-800">Sale QTY</div>
                                            <div className="text-center text-green-800">Inhouse BAG</div>
                                            <div className="text-center text-green-800">Inhouse QTY</div>
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
                                                <div className="text-sm font-semibold text-gray-900 mt-1 whitespace-nowrap">{group.productName}</div>
                                            </td>
                                            <td className="px-6 py-4 align-top" colSpan="8">
                                                <div className="space-y-3">
                                                    {group.brandList.map((brand, bIdx) => (
                                                        <div key={bIdx} className={`grid grid-cols-[2.5fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1fr] gap-4 items-center whitespace-nowrap min-w-[1000px] ${bIdx !== group.brandList.length - 1 ? 'border-b border-gray-100 pb-2' : 'pb-1'}`}>
                                                            <div className="text-sm text-gray-600 font-medium whitespace-nowrap" title={brand.brand}>{brand.brand || '-'}</div>
                                                            <div className="text-sm text-black bg-blue-50/30 px-2 py-1 rounded-lg text-center">
                                                                {(() => {
                                                                    const { whole, remainder } = calculatePktRemainder(brand.totalInHouseQuantity, brand.packetSize);
                                                                    return `${whole.toLocaleString()} - ${Math.abs(remainder).toLocaleString()} kg`;
                                                                })()}
                                                            </div>
                                                            <div className="text-sm text-black text-center font-medium">
                                                                {Math.round(brand.totalInHouseQuantity || 0).toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-sm text-black bg-orange-50/30 px-2 py-1 rounded-lg text-center font-medium">
                                                                {(() => {
                                                                    const { whole, remainder } = calculatePktRemainder(brand.saleQuantity, brand.packetSize);
                                                                    return `${whole.toLocaleString()} - ${Math.abs(remainder).toLocaleString()} kg`;
                                                                })()}
                                                            </div>
                                                            <div className="text-sm text-black text-center font-medium">
                                                                {Math.round(brand.saleQuantity || 0).toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-sm text-black bg-green-50/30 px-2 py-1 rounded-lg text-center">
                                                                {(() => {
                                                                    const { whole, remainder } = calculatePktRemainder(brand.inHouseQuantity, brand.packetSize);
                                                                    return `${whole.toLocaleString()} - ${Math.abs(remainder).toLocaleString()} kg`;
                                                                })()}
                                                            </div>
                                                            <div className="text-sm text-black text-center font-medium">
                                                                {Math.round(brand.inHouseQuantity).toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-center overflow-hidden">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${brand.inHouseQuantity > 0 ? 'bg-emerald-50 text-emerald-600' : brand.isPreSold ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                                                    {brand.inHouseQuantity > 0 ? 'In Stock' : brand.isPreSold ? 'Pre-Sold' : 'Out of Stock'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="pt-2 border-t border-gray-200 mt-1 grid grid-cols-[2.5fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1.2fr_1fr] gap-4 items-center whitespace-nowrap min-w-[1000px]">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Total:</span>
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {(() => {
                                                                const pktSize = group.brandList?.[0]?.packetSize || 0;
                                                                const { whole, remainder } = calculatePktRemainder(group.totalInHouseQuantity, pktSize);
                                                                return `${whole.toLocaleString()} - ${Math.abs(remainder).toLocaleString()} kg`;
                                                            })()}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.round(group.totalInHouseQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {(() => {
                                                                const pktSize = group.brandList?.[0]?.packetSize || 0;
                                                                const { whole, remainder } = calculatePktRemainder(group.saleQuantity, pktSize);
                                                                return `${whole.toLocaleString()} - ${Math.abs(remainder).toLocaleString()} kg`;
                                                            })()}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.round(group.saleQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {(() => {
                                                                const pktSize = group.brandList?.[0]?.packetSize || 0;
                                                                const { whole, remainder } = calculatePktRemainder(group.inHouseQuantity, pktSize);
                                                                return `${whole.toLocaleString()} - ${Math.abs(remainder).toLocaleString()} kg`;
                                                            })()}
                                                        </div>
                                                        <div className="text-sm text-black font-black text-center">
                                                            {Math.round(group.inHouseQuantity).toLocaleString()} {group.unit}
                                                        </div>
                                                        <div className="text-center"></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top text-right">
                                                <div className="flex items-center justify-end gap-3 mt-1">
                                                    <button
                                                        onClick={() => {
                                                            const targetProd = group.productName;
                                                            const targetWh = stockFilters.whName || ''; // Pre-fill if filtered

                                                            setAddWarehouseStockFormData({
                                                                whName: targetWh, manager: '', location: '', capacity: '',
                                                                to: '', toManager: '', toLocation: '', toCapacity: '',
                                                                productEntries: [{
                                                                    productName: targetProd,
                                                                    brandEntries: group.brandList.map(brand => ({
                                                                        brand: brand.brand,
                                                                        inhousePkt: brand.totalInHousePacket - (brand.salePacket || 0),
                                                                        inhouseQty: brand.totalInHouseQuantity - (brand.saleQuantity || 0),
                                                                        whPkt: 0, // Need to fetch warehouse specific if whName is known
                                                                        whQty: 0,
                                                                        transferPkt: '',
                                                                        transferQty: '',
                                                                        packetSize: brand.packetSize || 0
                                                                    }))
                                                                }]
                                                            });

                                                            // If whName is pre-filled, we need to manually trigger the quantity calculation for warehouse-specific stock
                                                            if (targetWh) {
                                                                // We use a small timeout to let the state update or we manually calculate here
                                                                const updatedProductEntries = [{
                                                                    productName: targetProd,
                                                                    brandEntries: group.brandList.map(brand => {
                                                                        const targetBrand = (brand.brand || '').trim().toLowerCase();
                                                                        const matchingStockEntries = warehouseData.filter(item =>
                                                                            ((item.productName || '').trim().toLowerCase() === targetProd.toLowerCase() || (item.product || '').trim().toLowerCase() === targetProd.toLowerCase()) &&
                                                                            (item.brand || '').trim().toLowerCase() === targetBrand
                                                                        );

                                                                        let totalWhPkt = 0;
                                                                        let totalWhQty = 0;
                                                                        matchingStockEntries.forEach(item => {
                                                                            if ((item.whName || '').trim().toLowerCase() === targetWh.trim().toLowerCase()) {
                                                                                totalWhPkt += (parseFloat(item.whPkt) || 0);
                                                                                totalWhQty += (parseFloat(item.whQty) || 0);
                                                                            }
                                                                        });

                                                                        let whSaleQty = 0;
                                                                        let whSalePkt = 0;
                                                                        (salesRecords || []).forEach(sale => {
                                                                            if (sale.items) {
                                                                                sale.items.forEach(saleItem => {
                                                                                    if ((saleItem.productName || '').trim().toLowerCase() === targetProd.toLowerCase()) {
                                                                                        if (saleItem.brandEntries) {
                                                                                            saleItem.brandEntries.forEach(entry => {
                                                                                                if ((entry.brand || '').trim().toLowerCase() === targetBrand && (entry.warehouseName || '').trim().toLowerCase() === targetWh.trim().toLowerCase()) {
                                                                                                    const sQty = parseFloat(entry.quantity) || 0;
                                                                                                    const pktSize = parseFloat(saleItem.packetSize || entry.packetSize) || (matchingStockEntries[0]?.packetSize ? parseFloat(matchingStockEntries[0].packetSize) : 0);
                                                                                                    whSaleQty += sQty;
                                                                                                    whSalePkt += pktSize > 0 ? sQty / pktSize : 0;
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }
                                                                        });

                                                                        return {
                                                                            brand: brand.brand,
                                                                            inhousePkt: Number(Math.max(0, brand.totalInHousePacket - (brand.salePacket || 0)).toFixed(2)),
                                                                            inhouseQty: Number(Math.max(0, brand.totalInHouseQuantity - (brand.saleQuantity || 0)).toFixed(2)),
                                                                            whPkt: Number(Math.max(0, totalWhPkt - whSalePkt).toFixed(2)),
                                                                            whQty: Number(Math.max(0, totalWhQty - whSaleQty).toFixed(2)),
                                                                            transferPkt: '',
                                                                            transferQty: '',
                                                                            packetSize: brand.packetSize || 0
                                                                        };
                                                                    })
                                                                }];

                                                                setAddWarehouseStockFormData(prev => ({ ...prev, productEntries: updatedProductEntries }));
                                                            }

                                                            setShowAddWarehouseStockForm(true);
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Transfer Product"
                                                    >
                                                        <ShoppingCartIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => setViewRecord({ data: group })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><EyeIcon className="w-5 h-5" /></button>
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
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                        <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl max-w-[95vw] w-full animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="px-4 sm:px-8 pt-2 pb-4 sm:pt-4 sm:pb-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 rounded-t-3xl gap-3">
                                <div className="flex-shrink-0 min-w-0">
                                    <h3 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Stock History - {viewRecord.data.productName}</h3>
                                </div>

                                {/* Center Aligned Search Bar & Tabs - Hidden on mobile if needed, or condensed */}
                                <div className="hidden lg:flex flex-1 max-w-xl mx-auto flex-col items-center gap-4">
                                    <div className="w-full max-w-md relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={historyTab === 'purchase' ? "Search by LC, Port, Importer, Truck or Brand..." : "Search by Invoice, Company, Customer, Phone or Brand..."}
                                            value={historySearchQuery}
                                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                                            className="block w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        <button
                                            onClick={() => setHistoryTab('purchase')}
                                            className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${historyTab === 'purchase'
                                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                                : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Purchase
                                        </button>
                                        <button
                                            onClick={() => setHistoryTab('sale')}
                                            className={`px-6 py-1.5 rounded-lg text-xs font-bold transition-all ${historyTab === 'sale'
                                                ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                                                : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Sale
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <button
                                            ref={filterButtonRef}
                                            onClick={() => setShowHistoryFilterPanel(!showHistoryFilterPanel)}
                                            className={`flex items-center justify-center sm:gap-2 w-9 h-9 sm:w-auto sm:h-10 sm:px-4 rounded-xl transition-all border ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '')
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <FunnelIcon className={`w-4 h-4 ${showHistoryFilterPanel || Object.values(historyFilters).some(v => v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                            <span className="hidden sm:block text-sm font-medium">Filter</span>
                                        </button>

                                        {/* Mobile Filter Overlay Backdrop */}
                                        {showHistoryFilterPanel && (
                                            <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[55] lg:hidden" onClick={() => setShowHistoryFilterPanel(false)}></div>
                                        )}

                                        {/* Floating Filter Panel */}
                                        {showHistoryFilterPanel && (
                                            <div ref={historyFilterRef} className="fixed inset-x-4 top-24 lg:absolute lg:inset-auto lg:right-0 lg:mt-3 w-auto lg:w-[420px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200 overflow-y-auto lg:overflow-visible max-h-[70vh]">
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
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {/* LC No Filter */}
                                                        <div className="space-y-1.5 relative" ref={lcNoFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">LC No</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value={historyFilters.lcNo}
                                                                    onClick={() => { setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: !filterDropdownOpen.lcNo }); }}
                                                                    placeholder="Select LC No..."
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.lcNo ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                />
                                                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                                {filterDropdownOpen.lcNo && (
                                                                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        <button type="button" onClick={() => { setHistoryFilters({ ...historyFilters, lcNo: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All LCs</button>
                                                                        {historyOptions.lcNos.map(lc => (
                                                                            <button key={lc} type="button" onClick={() => { setHistoryFilters({ ...historyFilters, lcNo: lc }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.lcNo === lc ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{lc}</button>
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
                                                                    onClick={() => { setFilterDropdownOpen({ ...initialFilterDropdownState, port: !filterDropdownOpen.port }); }}
                                                                    placeholder="Select Port..."
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.port ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                />
                                                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                                {filterDropdownOpen.port && (
                                                                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        <button type="button" onClick={() => { setHistoryFilters({ ...historyFilters, port: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Ports</button>
                                                                        {historyOptions.ports.map(port => (
                                                                            <button key={port} type="button" onClick={() => { setHistoryFilters({ ...historyFilters, port: port }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.port === port ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{port}</button>
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
                                                                onClick={() => { setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand }); }}
                                                                placeholder="Select Brand..."
                                                                className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.brand ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                            />
                                                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                            {filterDropdownOpen.brand && (
                                                                <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                    <button type="button" onClick={() => { setHistoryFilters({ ...historyFilters, brand: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Brands</button>
                                                                    {historyOptions.brands.map(brand => (
                                                                        <button key={brand} type="button" onClick={() => { setHistoryFilters({ ...historyFilters, brand: brand }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.brand === brand ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{brand}</button>
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

                                    <button
                                        onClick={handleGenerateProductReport}
                                        className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-10 sm:px-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm"
                                        title="Product Report"
                                    >
                                        <FileTextIcon className="w-4 h-4" />
                                        <span className="hidden sm:block text-sm font-medium ml-2">Report</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setViewRecord(null);
                                            setHistorySearchQuery('');
                                            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '' });
                                            setShowHistoryFilterPanel(false);
                                            setExpandedHistoryId(null);
                                            setExpandedSaleId(null);
                                        }}
                                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <XIcon className="w-6 h-6 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Tabs & Search Unified - Visible only on mobile */}
                            <div className="lg:hidden px-4 pb-4 border-b border-gray-100">
                                <div className="bg-gray-50 rounded-2xl border border-gray-200/60 p-2 space-y-2.5 shadow-inner-sm">
                                    <div className="w-full relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={historySearchQuery}
                                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                                            className="block w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] outline-none shadow-sm focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder-gray-400"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 p-1 bg-gray-200/50 rounded-xl">
                                        <button
                                            onClick={() => setHistoryTab('purchase')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${historyTab === 'purchase' ? 'bg-white text-blue-600 shadow-sm scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Purchase
                                        </button>
                                        <button
                                            onClick={() => setHistoryTab('sale')}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${historyTab === 'sale' ? 'bg-white text-blue-600 shadow-sm scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Sale
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="px-4 sm:px-8 py-6 sm:py-8 flex-1 overflow-y-auto custom-scrollbar">
                                {historyTab === 'purchase' ? (() => {
                                    const history = activePurchaseHistory;
                                    const unit = history[0]?.unit || 'kg';

                                    const tPkts = history.reduce((sum, item) => sum + (parseFloat(item.totalPacket) || 0), 0);
                                    const tQty = history.reduce((sum, item) => sum + (parseFloat(item.totalQuantity) || 0), 0);
                                    const tIHPkt = history.reduce((sum, item) => sum + (parseFloat(item.totalInHousePacket) || 0), 0);
                                    const tIHQty = history.reduce((sum, item) => sum + (parseFloat(item.totalInHouseQuantity) || 0), 0);
                                    const tShort = history.reduce((sum, item) => sum + (parseFloat(item.totalShortage) || 0), 0);

                                    return (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 md:flex md:flex-row gap-3 sm:gap-4 w-full">
                                                {[
                                                    { label: 'TOTAL BAG', value: tPkts.toLocaleString(), bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-900', labelColor: 'text-gray-400' },
                                                    { label: 'TOTAL QTY', value: `${Math.round(tQty).toLocaleString()} ${unit}`, bgColor: 'bg-emerald-50/10', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                                                    { label: 'INHOUSE BAG', value: tIHPkt.toLocaleString(), bgColor: 'bg-amber-50/10', borderColor: 'border-amber-100', textColor: 'text-amber-700', labelColor: 'text-amber-600' },
                                                    { label: 'INHOUSE QTY', value: `${Math.round(tIHQty).toLocaleString()} ${unit}`, bgColor: 'bg-blue-50/10', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                                                    { label: 'SHORTAGE', value: `${Math.round(tShort).toLocaleString()} ${unit}`, bgColor: 'bg-rose-50/10', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600', span: 'col-span-2 md:col-auto' },
                                                ].map((card, i) => (
                                                    <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-3 sm:p-4 rounded-xl shadow-sm transition-all hover:shadow-md ${card.span || ''} md:flex-1 min-w-[120px]`}>
                                                        <div className={`text-[10px] sm:text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-0.5 sm:mb-1`}>{card.label}</div>
                                                        <div className={`text-sm sm:text-xl font-bold ${card.textColor}`}>{card.value}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                                                <div className="hidden md:block overflow-x-auto">
                                                    <table className="w-full text-left min-w-[1000px]">
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
                                                                    <div className="flex items-center">Truck <SortIcon config={sortConfig.history} columnKey="truckNo" /></div>
                                                                </th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Brand</th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purchase Price</th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">BAG</th>
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
                                                                    <tr key={item._id || idx} className="hover:bg-gray-50/30 transition-colors group border-b border-gray-50">
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.date}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 font-semibold">{item.lcNo}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.port}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={item.importer}>{item.importer}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.itemExporter || '-'}</td>
                                                                        <td className="px-3 py-3 align-top whitespace-nowrap">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-600 font-medium">{entry.brand}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-600">৳{parseFloat(entry.purchasedPrice || 0).toLocaleString()}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top font-bold">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-900">{entry.packet}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top font-bold">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-900">{Math.round(parseFloat(entry.quantity || 0)).toLocaleString()} {entry.unit}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-amber-600 font-bold">{entry.inHousePacket}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-blue-600 font-bold">{Math.round(parseFloat(entry.inHouseQuantity || 0)).toLocaleString()} {entry.unit}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top text-rose-600 font-black">
                                                                            <div className="space-y-1">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm">{Math.round(parseFloat(entry.sweepedQuantity || 0)).toLocaleString()} {entry.unit}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                                            <div className="flex items-center justify-center gap-2">
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Mobile Card View */}
                                                <div className="md:hidden space-y-4">
                                                    {history.length === 0 ? (
                                                        <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-xl border border-gray-100">No history records found</div>
                                                    ) : (
                                                        history.map((item, idx) => {
                                                            const historyId = item._id || idx;
                                                            const isExpanded = expandedHistoryId === historyId;

                                                            return (
                                                                <div
                                                                    key={historyId}
                                                                    onClick={() => toggleHistoryExpansion(historyId)}
                                                                    className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm transition-all duration-200 cursor-pointer hover:border-blue-100 ${isExpanded ? 'ring-1 ring-blue-500/10' : ''}`}
                                                                >
                                                                    {/* Summary Header */}
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="flex flex-col min-w-0 flex-1">
                                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</span>
                                                                            <span className="text-sm font-bold text-gray-900 truncate">{formatDate(item.date)}</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-center flex-1">
                                                                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">LC No</span>
                                                                            <span className="text-sm font-bold text-blue-600 truncate">{item.lcNo}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {!isExpanded && (
                                                                                <div className="flex flex-col items-end mr-1">
                                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Pkt</span>
                                                                                    <span className="text-sm font-bold text-gray-900">{item.totalPacket || 0} BAG</span>
                                                                                </div>
                                                                            )}
                                                                            <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-blue-50 text-blue-500' : 'text-gray-400'}`}>
                                                                                {isExpanded ? (
                                                                                    <ChevronUpIcon className="w-5 h-5" />
                                                                                ) : (
                                                                                    <ChevronDownIcon className="w-5 h-5" />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Content */}
                                                                    {isExpanded && (
                                                                        <div className="mt-4 pt-4 border-t border-gray-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Port</div>
                                                                                    <div className="text-gray-700 font-medium truncate">{item.port}</div>
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Importer</div>
                                                                                    <div className="text-gray-700 font-medium truncate" title={item.importer}>{item.importer}</div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="bg-gray-50/50 rounded-xl p-3 space-y-3">
                                                                                {item.entries.map((entry, eIdx) => (
                                                                                    <div key={eIdx} className={`${eIdx !== 0 ? 'border-t border-gray-100 pt-3' : ''}`}>
                                                                                        <div className="flex justify-between items-center mb-2">
                                                                                            <span className="text-sm font-bold text-gray-900">{entry.brand}</span>
                                                                                            <span className="text-xs font-medium text-gray-500">৳{parseFloat(entry.purchasedPrice || 0).toLocaleString()}</span>
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 gap-3">
                                                                                            <div className="flex flex-col bg-white p-2 rounded-lg border border-gray-100">
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total LC Amount</span>
                                                                                                <div className="flex flex-col gap-1">
                                                                                                    <span className="text-xs font-bold text-gray-900">{entry.packet} PKT</span>
                                                                                                    <span className="text-xs font-bold text-gray-600">{Math.round(parseFloat(entry.quantity || 0)).toLocaleString()} {entry.unit}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex flex-col bg-white p-2 rounded-lg border border-gray-100">
                                                                                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">InHouse</span>
                                                                                                <div className="flex flex-col gap-1">
                                                                                                    <span className="text-xs font-bold text-blue-600">{entry.inHousePacket} BAG</span>
                                                                                                    <span className="text-xs font-bold text-blue-500">{Math.round(parseFloat(entry.inHouseQuantity || 0)).toLocaleString()} {entry.unit}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        {parseFloat(entry.sweepedQuantity || 0) > 0 && (
                                                                                            <div className="mt-2 flex items-center gap-2 bg-rose-50 px-2 py-1 rounded-md">
                                                                                                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Shortage:</span>
                                                                                                <span className="text-xs font-bold text-rose-600">{Math.round(parseFloat(entry.sweepedQuantity || 0)).toLocaleString()} {entry.unit}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })() : (() => {
                                    const flattenedSaleHistory = activeSaleHistory;
                                    const totalSaleQty = flattenedSaleHistory.reduce((sum, s) => sum + s.itemQty, 0);
                                    const totalSaleAmount = flattenedSaleHistory.reduce((sum, s) => sum + s.itemTotal, 0);

                                    const unit = activePurchaseHistory[0]?.unit || 'kg';
                                    const isFruitHistory = (viewRecord.data.category || '').toLowerCase() === 'fruit';

                                    return (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4 max-w-2xl">
                                                <div className="bg-emerald-50/10 border border-emerald-100 p-4 sm:p-6 rounded-2xl shadow-sm transition-all hover:shadow-md">
                                                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Sale Quantity</div>
                                                    <div className="text-lg sm:text-2xl font-black text-emerald-700">{totalSaleQty.toLocaleString()} {unit}</div>
                                                </div>
                                                <div className="bg-blue-50/10 border border-blue-100 p-4 sm:p-6 rounded-2xl shadow-sm transition-all hover:shadow-md">
                                                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Sale Amount</div>
                                                    <div className="text-lg sm:text-2xl font-black text-blue-700">৳ {totalSaleAmount.toLocaleString()}</div>
                                                </div>
                                            </div>

                                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                                <div className="hidden md:block overflow-x-auto">
                                                    <table className="w-full text-left min-w-[800px]">
                                                        <thead>
                                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Invoice No</th>
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Company Name</th>
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{isFruitHistory ? "Customer Name" : "Brand"}</th>
                                                                <th className={`px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${!isFruitHistory ? 'text-right' : ''}`}>{isFruitHistory ? "Phone" : "BAG"}</th>
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                                                                {isFruitHistory && <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Truck</th>}
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Price</th>
                                                                <th className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {flattenedSaleHistory.length === 0 ? (
                                                                <tr><td colSpan={isFruitHistory ? "9" : "8"} className="px-6 py-20 text-center text-gray-400 font-medium">No sale history found for this product</td></tr>
                                                            ) : (
                                                                flattenedSaleHistory.map((sale, sIdx) => (
                                                                    <tr key={sIdx} className="hover:bg-blue-50/20 transition-all group border-b border-gray-50">
                                                                        <td className="px-3 py-3 text-sm text-gray-600">{sale.date}</td>
                                                                        <td className="px-3 py-3 text-sm font-bold text-gray-900">{sale.invoiceNo}</td>
                                                                        <td className="px-3 py-3 text-sm font-bold text-gray-800 truncate max-w-[150px]" title={sale.companyName}>{sale.companyName}</td>
                                                                        {isFruitHistory ? (
                                                                            <>
                                                                                <td className="px-3 py-3 text-sm text-gray-600">{sale.customerName || '-'}</td>
                                                                                <td className="px-3 py-3 text-sm text-gray-600 font-medium">{sale.contact || '-'}</td>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <td className="px-3 py-3">
                                                                                    <div className="text-sm font-medium text-blue-600">{sale.itemBrand}</div>
                                                                                </td>
                                                                                <td className={`px-3 py-3 text-right ${!isFruitHistory ? 'text-right' : ''}`}>
                                                                                    <div className="text-sm font-bold text-gray-900">{sale.itemPacket.toLocaleString()}</div>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                        <td className="px-3 py-3 text-right">
                                                                            <div className="text-sm font-bold text-gray-900">{sale.itemQty.toLocaleString()} {unit}</div>
                                                                        </td>
                                                                        {isFruitHistory && (
                                                                            <td className="px-3 py-3 text-sm text-gray-600 font-medium text-right">{sale.itemTruck || '-'}</td>
                                                                        )}
                                                                        <td className="px-3 py-3 text-right">
                                                                            <div className="text-sm font-medium text-gray-600">৳{sale.itemPrice.toLocaleString()}</div>
                                                                        </td>
                                                                        <td className="px-3 py-3 text-right">
                                                                            <div className="text-sm font-black text-blue-600 group-hover:text-blue-700">৳{sale.itemTotal.toLocaleString()}</div>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Mobile Card View for Sale History */}
                                                <div className="md:hidden space-y-4 p-4 bg-gray-50/30">
                                                    {flattenedSaleHistory.length === 0 ? (
                                                        <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-xl border border-gray-100">No sale history found for this product</div>
                                                    ) : (
                                                        flattenedSaleHistory.map((sale, sIdx) => {
                                                            const saleId = sale._id || sIdx;
                                                            const isExpanded = expandedSaleId === saleId;

                                                            return (
                                                                <div
                                                                    key={saleId}
                                                                    onClick={() => toggleSaleExpansion(saleId)}
                                                                    className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm transition-all duration-200 cursor-pointer hover:border-blue-100 ${isExpanded ? 'ring-1 ring-blue-500/10' : ''}`}
                                                                >
                                                                    {/* Summary Header */}
                                                                    <div className={`${isExpanded ? 'space-y-3' : ''}`}>
                                                                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                                                                            <div className="flex flex-col min-w-0 flex-[0.8]">
                                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</span>
                                                                                <span className="text-sm font-bold text-gray-900 truncate">{formatDate(sale.date)}</span>
                                                                            </div>
                                                                            <div className="flex flex-col items-center flex-1">
                                                                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Invoice</span>
                                                                                <span className="text-sm font-bold text-blue-600 truncate">{sale.invoiceNo}</span>
                                                                            </div>
                                                                            {!isExpanded && (
                                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Company</span>
                                                                                    <span className="text-xs font-bold text-gray-800 truncate">{sale.companyName}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex items-center">
                                                                                <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-blue-50 text-blue-500' : 'text-gray-400'}`}>
                                                                                    {isExpanded ? (
                                                                                        <ChevronUpIcon className="w-5 h-5" />
                                                                                    ) : (
                                                                                        <ChevronDownIcon className="w-5 h-5" />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {isExpanded && (
                                                                            <div className="flex flex-col animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Company</span>
                                                                                <span className="text-sm font-bold text-gray-800 truncate">{sale.companyName}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Expanded Content */}
                                                                    {isExpanded && (
                                                                        <div className="mt-4 pt-4 border-t border-gray-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                                                            <div className="grid grid-cols-2 gap-4 bg-gray-50/50 rounded-xl p-3">
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{isFruitHistory ? "Customer" : "Brand"}</div>
                                                                                    <div className="text-sm font-bold text-blue-600 truncate">{isFruitHistory ? (sale.customerName || '-') : sale.itemBrand}</div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{isFruitHistory ? "Phone" : "BAG"}</div>
                                                                                    <div className="text-sm font-bold text-gray-900 truncate">{isFruitHistory ? (sale.contact || '-') : `${sale.itemPacket.toLocaleString()} BAG`}</div>
                                                                                </div>
                                                                            </div>

                                                                            <div className="flex items-end justify-between pt-1">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                                                                    <span className="text-sm font-black text-gray-900">{sale.itemQty.toLocaleString()} {unit}</span>
                                                                                </div>
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Price</span>
                                                                                    <span className="text-xs font-bold text-gray-600">৳{sale.itemPrice.toLocaleString()}</span>
                                                                                </div>
                                                                                <div className="flex flex-col items-end">
                                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Amount</span>
                                                                                    <span className="text-lg font-black text-blue-600">৳{sale.itemTotal.toLocaleString()}</span>
                                                                                </div>
                                                                            </div>

                                                                            {isFruitHistory && (
                                                                                <div className="pt-2 border-t border-gray-50 flex justify-between items-center text-sm">
                                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Truck:</span>
                                                                                    <span className="font-bold text-gray-700">{sale.itemTruck || '-'}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
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
