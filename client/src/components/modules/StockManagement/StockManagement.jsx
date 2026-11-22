import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
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
import TableScrollNav from '../../shared/TableScrollNav';
import StockReport from './StockReport';
import { encryptData, decryptData } from '../../../utils/encryption';
import { calculateStockData, calculatePktRemainder, getGroupedBrandList, safeParse, isLcMatch } from '../../../utils/stockHelpers';
import { generateStockReportPDF, generateProductHistoryPDF } from '../../../utils/pdfGenerator';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import { queryClient } from '../../../utils/queryClient';

const SortIcon = ({ config, columnKey }) => {
    if (!config || config.key !== columnKey) return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100" />;
    return config.direction === 'asc'
        ? <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-500" />
        : <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-500" />;
};

const getLocalDatetimeInputValue = (date = new Date()) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseDate = (dateVal) => {
    if (!dateVal) return new Date(0);
    if (dateVal instanceof Date) return dateVal;
    const str = String(dateVal).trim();
    if (!str || str === '-') return new Date(0);

    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
        const parts = str.split(/[\/\-]/);
        const p1 = parseInt(parts[0], 10);
        const p2 = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        if (p1 > 12) return new Date(year, p2 - 1, p1);
        if (p2 > 12) return new Date(year, p1 - 1, p2);
        return new Date(year, p2 - 1, p1);
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const parts = str.split('T')[0].split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

const isBeforeDate = (dateVal, filterDateStr) => {
    if (!dateVal || !filterDateStr) return false;
    const itemTime = parseDate(dateVal).getTime();
    const filterTime = parseDate(filterDateStr).getTime();
    if (itemTime === 0 || filterTime === 0) return false;
    return itemTime < filterTime;
};

const isAfterDate = (dateVal, filterDateStr) => {
    if (!dateVal || !filterDateStr) return false;
    const itemTime = parseDate(dateVal).getTime();
    const filterTime = parseDate(filterDateStr).getTime();
    if (itemTime === 0 || filterTime === 0) return false;
    return itemTime > filterTime;
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
    warehouseData: externalWarehouseData,
    salesRecords,
    fetchSales,
    damages,
    setShowProductHistoryReport,
    showProductHistoryReport,
    setProductHistoryReportData,
    showRate,
    setShowRate,
    activeBaseline,
    fetchStockBaseline,
    returnsList: externalReturnsList
}) => {

    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const isAdmin = currentUser.username === 'admin' || (currentUser.role || '').toLowerCase() === 'admin';
    const isLcManager = (currentUser?.role || '').toLowerCase() === 'lc manager';
    const isBorderManager = (currentUser?.role || '').toLowerCase() === 'border manager';
    const canTransfer = hasPermission(currentUser, 'stock', 'special');
    const canShowRate = hasPermission(currentUser, 'stock', 'showRate');
    const canSetBaseline = isAdmin || hasPermission(currentUser, 'stock', 'special');
    const effectiveShowRate = canShowRate && showRate;

    // Stock Baseline Modal States
    const [showBaselineModal, setShowBaselineModal] = useState(false);
    const [baselineTab, setBaselineTab] = useState('preview'); // 'preview' | 'history'
    const [baselineNote, setBaselineNote] = useState('Initial Stock Baseline');
    const [baselineCutoffDate, setBaselineCutoffDate] = useState(() => getLocalDatetimeInputValue());
    const [baselineConfirmText, setBaselineConfirmText] = useState('');
    const [baselineLoading, setBaselineLoading] = useState(false);
    const [baselineHistory, setBaselineHistory] = useState([]);
    const [baselineSearchQuery, setBaselineSearchQuery] = useState('');
    const [baselineWhFilter, setBaselineWhFilter] = useState('All');

    // LC Reconciliation & Manual Fix Modal & States
    const [isOffsetZeroLcActive, setIsOffsetZeroLcActive] = useState(() => {
        const saved = localStorage.getItem('stock_offset_zero_lc');
        return saved !== null ? saved === 'true' : true;
    });
    const [showReconcileModal, setShowReconcileModal] = useState(false);
    const [reconcileSuccessMsg, setReconcileSuccessMsg] = useState('');

    // Manual LC Fix & Adjustment States
    const [activeModalTab, setActiveModalTab] = useState('adjust'); // 'adjust' | 'reassign'
    const [manualFixWarehouse, setManualFixWarehouse] = useState('All');
    const [manualFixProduct, setManualFixProduct] = useState('');
    const [manualFixBrand, setManualFixBrand] = useState('');
    const [manualFixFromLc, setManualFixFromLc] = useState('');
    const [manualFixToLc, setManualFixToLc] = useState('');
    const [selectedFixInvoices, setSelectedFixInvoices] = useState(new Set());
    const [manualFixLoading, setManualFixLoading] = useState(false);

    // Stock Quantity Adjustment States (Zero Effect on LC Receive)
    const [adjustLcNo, setAdjustLcNo] = useState('');
    const [adjustMode, setAdjustMode] = useState('add'); // 'add' | 'reduce' | 'set'
    const [adjustUnit, setAdjustUnit] = useState('bag'); // 'bag' | 'kg'
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [isAdjustingStock, setIsAdjustingStock] = useState(false);
    const [adjustFeedback, setAdjustFeedback] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);

    const [localReturnsList, setLocalReturnsList] = useState([]);
    useEffect(() => {
        let isMounted = true;
        const fetchReturns = async () => {
            const cached = queryClient.getQueryData(['returns']);
            if (cached && isMounted) {
                setLocalReturnsList(Array.isArray(cached) ? cached : []);
            }
            try {
                const data = await queryClient.fetchQuery({
                    queryKey: ['returns'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/returns`).then(r => Array.isArray(r.data) ? r.data : [])
                });
                if (isMounted) {
                    setLocalReturnsList(data);
                }
            } catch (err) {
                console.error('Error fetching returns in StockManagement:', err);
            }
        };
        fetchReturns();

        const handleUpdate = () => {
            fetchReturns();
            if (typeof fetchStockRecords === 'function') {
                fetchStockRecords();
            }
        };
        window.addEventListener('returnsUpdated', handleUpdate);
        window.addEventListener('stockUpdated', handleUpdate);

        return () => {
            isMounted = false;
            window.removeEventListener('returnsUpdated', handleUpdate);
            window.removeEventListener('stockUpdated', handleUpdate);
        };
    }, [fetchStockRecords]);

    const returnsList = (externalReturnsList !== undefined && externalReturnsList !== null) ? externalReturnsList : localReturnsList;

    // Filtering & Search (Main View)
    const [displayUnit, setDisplayUnit] = useState(() => {
        const saved = localStorage.getItem('stock_displayUnit_default');
        if (saved) return saved;
        const oldShowBag = localStorage.getItem('stock_showBag_default');
        if (oldShowBag === 'true') return 'BOTH';
        if (oldShowBag === 'false') return 'QTY';
        return 'BOTH';
    });

    useEffect(() => {
        localStorage.setItem('stock_displayUnit_default', displayUnit);
    }, [displayUnit]);

    const showBag = displayUnit === 'BOTH' || displayUnit === 'BAG';
    const showQty = displayUnit === 'BOTH' || displayUnit === 'QTY';

    const [stockSearchQuery, setStockSearchQuery] = useState('');
    const deferredStockSearch = useDeferredValue(stockSearchQuery);
    const [showStockFilterPanel, setShowStockFilterPanel] = useState(false);
    // stockFilters lifted to App.jsx
    const selectedProductsList = useMemo(() => {
        if (!stockFilters.productName) return [];
        if (Array.isArray(stockFilters.productName)) return stockFilters.productName;
        return stockFilters.productName.split(',').map(p => p.trim()).filter(Boolean);
    }, [stockFilters.productName]);

    const selectedBrandsList = useMemo(() => {
        if (!stockFilters.brand) return [];
        if (Array.isArray(stockFilters.brand)) return stockFilters.brand;
        return stockFilters.brand.split(',').map(b => b.trim()).filter(Boolean);
    }, [stockFilters.brand]);

    const handleToggleProduct = (prodName) => {
        let newList;
        if (selectedProductsList.includes(prodName)) {
            newList = selectedProductsList.filter(p => p !== prodName);
        } else {
            newList = [...selectedProductsList, prodName];
        }

        // Keep only valid brands matching the selected products
        const validBrands = new Set();
        const selectedProductNames = newList.map(p => p.toLowerCase().trim());
        stockRecords.forEach(r => {
            if (selectedProductNames.length > 0) {
                const rProdName = (r.productName || r.product || '').trim().toLowerCase();
                if (!selectedProductNames.includes(rProdName)) return;
            }
            if (r.brand) validBrands.add(r.brand);
            if (r.entries) r.entries.forEach(e => { if (e.brand) validBrands.add(e.brand) });
            if (r.brandEntries) r.brandEntries.forEach(e => { if (e.brand) validBrands.add(e.brand) });
        });
        const filteredBrands = selectedBrandsList.filter(b => validBrands.has(b));

        setStockFilters({
            ...stockFilters,
            productName: newList,
            brand: filteredBrands
        });
    };

    const handleToggleBrand = (brandName) => {
        let newList;
        if (selectedBrandsList.includes(brandName)) {
            newList = selectedBrandsList.filter(b => b !== brandName);
        } else {
            newList = [...selectedBrandsList, brandName];
        }
        setStockFilters({
            ...stockFilters,
            brand: newList
        });
    };

    // Filtering & Search (Modal View)
    const [viewRecord, setViewRecord] = useState(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [showHistoryFilterPanel, setShowHistoryFilterPanel] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', warehouse: '' });
    const [historyTab, setHistoryTab] = useState('purchase'); // 'purchase' or 'sale'

    // Dropdown & Selection State
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ warehouse: false, importer: false, brand: false, productName: false, lcNo: false, port: false });
    const [filterSearchInputs, setFilterSearchInputs] = useState({ warehouseSearch: '', importerSearch: '', brandSearch: '', productSearch: '' });
    const initialFilterDropdownState = { warehouse: false, importer: false, brand: false, productName: false, lcNo: false, port: false };

    // Table Selection & Sorting
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [sortConfig, setSortConfig] = useState({
        stock: { key: 'date', direction: 'desc' },
        history: { key: 'date', direction: 'asc' }
    });

    // Long Press Logic
    const longPressTimer = useRef(null);
    const isLongPressTriggered = useRef(false);

    // Refs for Click Outside
    const stockFilterRef = useRef(null);
    const stockFilterButtonRef = useRef(null);
    const historyFilterRef = useRef(null);
    const filterButtonRef = useRef(null);

    const stockWarehouseFilterRef = useRef(null);
    const stockImporterFilterRef = useRef(null);
    const stockProductFilterRef = useRef(null);
    const stockBrandFilterRef = useRef(null);

    const warehouseFilterRef = useRef(null);
    const brandFilterRef = useRef(null);

    const productRefs = useRef([]);
    const brandRefs = useRef({});
    const portRef = useRef(null);
    const importerRef = useRef(null);
    const lcNoFilterRef = useRef(null);
    const portFilterRef = useRef(null);

    // --- Add Stock to Warehouse State ---
    const [warehouseData, setWarehouseData] = useState(externalWarehouseData || []);

    useEffect(() => {
        if (externalWarehouseData && Array.isArray(externalWarehouseData) && externalWarehouseData.length > 0) {
            setWarehouseData(externalWarehouseData);
        }
    }, [externalWarehouseData]);

    useEffect(() => {
        const fetchWarehouseData = async () => {
            const cached = queryClient.getQueryData(['warehouses']);
            if (cached && Array.isArray(cached) && cached.length > 0) {
                setWarehouseData(cached);
            }
            try {
                const data = await queryClient.fetchQuery({
                    queryKey: ['warehouses'],
                    queryFn: async () => {
                        const res = await axios.get(`${API_BASE_URL}/api/warehouses`);
                        if (Array.isArray(res.data)) {
                            return res.data.map(item => {
                                let d = decryptData(item.data);
                                if (d && d.data && typeof d.data === 'string') {
                                    try { d = decryptData(d.data); } catch (e) { }
                                }
                                return { ...item, ...(d || {}) };
                            });
                        }
                        return [];
                    }
                });
                setWarehouseData(data);
            } catch (e) {
                console.error('Error fetching warehouses in StockManagement:', e);
            }
        };
        fetchWarehouseData();
        if (typeof fetchSales === 'function') {
            fetchSales();
        }
        if (typeof fetchStockRecords === 'function') {
            fetchStockRecords();
        }

    }, []);
    const [showAddWarehouseStockForm, setShowAddWarehouseStockForm] = useState(false);
    const [addWarehouseStockFormData, setAddWarehouseStockFormData] = useState({
        whName: '', manager: '', location: '', capacity: '',
        to: '', toManager: '', toLocation: '', toCapacity: '',
        productEntries: [{
            productName: '',
            brandEntries: [{ lcNo: '', brand: '', inhousePkt: '', inhouseQty: '', whPkt: '', whQty: '', transferPkt: '', transferQty: '' }]
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
    const [showWhLcDropdown, setShowWhLcDropdown] = useState(false);
    const whLcDropdownRefs = useRef({});


    // Expand/Collapse state for mobile cards
    const [expandedProducts, setExpandedProducts] = useState(null);
    const [expandedBrands, setExpandedBrands] = useState(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [expandedSaleId, setExpandedSaleId] = useState(null);

    const toggleProductExpansion = (productName) => {
        setExpandedProducts(prev => prev === productName ? null : productName);
    };

    const toggleBrandExpansion = (brandId) => {
        setExpandedBrands(prev => prev === brandId ? null : brandId);
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
        const list = warehouseData.reduce((acc, current) => {
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

        // Priority: HILI first, then BOGURA, then others in alphabetical order
        const hili = list.filter(w => w.whName.toUpperCase().includes('HILI'));
        const bogura = list.filter(w => w.whName.toUpperCase().includes('BOGURA'));
        const others = list.filter(w => !w.whName.toUpperCase().includes('HILI') && !w.whName.toUpperCase().includes('BOGURA'));
        return [...hili, ...bogura, ...others];
    }, [warehouseData]);

    const activePurchaseHistory = useMemo(() => {
        if (!viewRecord) return [];
        const searchLower = historySearchQuery.toLowerCase().trim();
        const productName = (viewRecord.data.productName || '').trim().toLowerCase();
        const consumedWhIds = new Set();

        const filteredRaw = (stockRecords || []).filter(item => {
            const status = (item.status || '').toLowerCase();
            if (status.includes('requested') || status.includes('rejected') || status.includes('deleted')) return false;

            const productName = (viewRecord.data.productName || '').trim().toLowerCase();
            const matchesProduct = (item.productName || item.product || '').trim().toLowerCase() === productName;
            if (!matchesProduct) return false;

            if (historyFilters.startDate && isBeforeDate(item.date, historyFilters.startDate)) return false;
            if (historyFilters.endDate && isAfterDate(item.date, historyFilters.endDate)) return false;
            if (historyFilters.warehouse && (item.warehouse || item.whName || '').trim().toLowerCase() !== historyFilters.warehouse.toLowerCase()) return false;
            if (historyFilters.lcNo && !isLcMatch(item.lcNo, historyFilters.lcNo)) return false;
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
            const matchesLC = isLcMatch(item.lcNo, searchLower);
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

            // Filter warehouse records to ONLY include actual warehouse entries,
            // excluding 'stock' entries to avoid double-counting the truck's arrival record
            const relatedWhRecords = (warehouseData || []).filter(w => {
                if (w.recordType !== 'warehouse') return false;
                if (w.isTransferLog) return false;

                const wLC = normalizeStr(w.lcNo);
                const wTruck = normalizeStr(w.truckNo);
                const wProd = normalizeStr(w.productName || w.product);
                const wBrand = normalizeStr(w.brand);
                const wWh = normalizeStr(w.whName || w.warehouse);
                const itemWh = normalizeStr(item.whName || item.warehouse);
                const whMatch = !historyFilters.warehouse || !wWh || !itemWh || wWh === itemWh;
                const isBasicMatch = whMatch && wLC === targetLC && wProd === targetProd && wBrand === targetBrand && (wTruck === targetTruck || (!wTruck && !targetTruck));
                if (!isBasicMatch) return false;

                // Date-aware matching to prevent duplicate assignment when same LC/Truck/Brand/Prod has multiple arrival dates
                const wDateVal = w.date || w.createdAt || w.updatedAt;
                const wDate = wDateVal ? wDateVal.toString().split('T')[0] : '';
                const itemDate = (item.date || '').split('T')[0];
                if (wDate && itemDate && wDate < itemDate) return false;

                // Find all matching stock arrivals
                const otherMatchingStocks = filteredRaw.filter(s => {
                    const sLC = normalizeStr(s.lcNo);
                    const sTruck = normalizeStr(s.truckNo);
                    const sProd = normalizeStr(s.productName || s.product);
                    const sBrand = normalizeStr(s.brand);
                    return sLC === wLC && sProd === wProd && sBrand === wBrand && (!wTruck || sTruck === wTruck);
                });

                // Find the latest arrival that happened before or on the transfer date
                let bestStock = null;
                let bestStockDate = '';
                for (const s of otherMatchingStocks) {
                    const sDate = (s.date || '').split('T')[0];
                    if (wDate && sDate && sDate <= wDate) {
                        if (!bestStockDate || sDate > bestStockDate) {
                            bestStock = s;
                            bestStockDate = sDate;
                        }
                    }
                }

                if (bestStock) {
                    const matches = bestStock._id === item._id;
                    if (matches) consumedWhIds.add(w._id);
                    return matches;
                }
                consumedWhIds.add(w._id);
                return true;
            });

            const whOnlyQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whQty ?? r.transferQty ?? r.inHouseQuantity ?? r.quantity) || 0), 0);
            const whOnlyPkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.whPkt ?? r.transferPacket ?? r.inHousePacket ?? r.packet) || 0), 0);

            const itemInHouseQty = parseFloat(item.inHouseQuantity) || 0;
            const itemInHousePkt = parseFloat(item.inHousePacket) || 0;

            const shortageQty = parseFloat(item.sweepedQuantity) || 0;
            const origLcQty = parseFloat(item.quantity) || 0;
            const origLcPkt = parseFloat(item.packet) || 0;

            const physicalWhQty = itemInHouseQty + whOnlyQty;
            const physicalWhPkt = itemInHousePkt + whOnlyPkt;

            const saleQty = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.saleQuantity) || 0), 0);
            const salePkt = relatedWhRecords.reduce((sum, r) => sum + (parseFloat(r.salePacket) || 0), 0);

            if (!acc[key]) {
                acc[key] = {
                    ...item,
                    allIds: [item._id],
                    brandsProcessed: new Set([targetBrand]),
                    totalQuantity: origLcQty,
                    totalPacket: origLcPkt,
                    totalInHousePacket: physicalWhPkt,
                    totalInHouseQuantity: physicalWhQty,
                    totalShortage: shortageQty,
                    totalSaleQuantity: saleQty,
                    totalSalePacket: salePkt,
                    entries: [{
                        brand: item.brand || item.productName,
                        purchasedPrice: item.purchasedPrice,
                        packet: origLcPkt,
                        packetSize: item.packetSize,
                        quantity: origLcQty,
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
                acc[key].totalQuantity += origLcQty;
                acc[key].totalPacket += origLcPkt;

                if (!acc[key].brandsProcessed.has(targetBrand)) {
                    acc[key].totalInHousePacket += physicalWhPkt;
                    acc[key].totalInHouseQuantity += physicalWhQty;
                    acc[key].brandsProcessed.add(targetBrand);
                } else {
                    acc[key].totalInHousePacket += itemInHousePkt;
                    acc[key].totalInHouseQuantity += itemInHouseQty;
                }

                acc[key].totalShortage += shortageQty;
                acc[key].totalSaleQuantity += saleQty;
                acc[key].totalSalePacket += salePkt;
                acc[key].entries.push({
                    brand: item.brand || item.productName,
                    purchasedPrice: item.purchasedPrice,
                    packet: origLcPkt,
                    packetSize: item.packetSize,
                    quantity: origLcQty,
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

        const transferDestKeys = new Set(
            (warehouseData || [])
                .filter(t => t.isTransferLog)
                .map(t => `${(t.toWh || t.warehouse || '').trim().toLowerCase()}_${(t.productName || t.product || '').trim().toLowerCase()}_${(t.brand || '').trim().toLowerCase()}_${(t.lcNo || '').trim().toLowerCase()}`)
        );

        const knownLcSet = new Set(
            (stockRecords || [])
                .map(s => (s.lcNo || '').trim())
                .filter(v => v && v !== '-' && v !== '—' && v !== '--')
        );

        // Include unmatched warehouse records
        const unmatchedWhRecords = (warehouseData || []).filter(w => {
            if (w.recordType !== 'warehouse') return false;
            if (w.isTransferLog) return false;
            if (w.isTransferredEntry) return false;
            if (consumedWhIds.has(w._id)) return false;

            const wLc = (w.lcNo || '').trim();
            if (wLc && knownLcSet.has(wLc)) return false;

            const wWh = (w.whName || w.warehouse || '').trim().toLowerCase();
            const wProd = (w.productName || w.product || '').trim().toLowerCase();
            const wBrand = (w.brand || '').trim().toLowerCase();
            const destKey = `${wWh}_${wProd}_${wBrand}_${wLc}`;
            if (transferDestKeys.has(destKey)) return false;

            if (wProd !== productName) return false;

            // Apply filters
            const wDateVal = w.date || w.createdAt || w.updatedAt;
            const wDate = wDateVal ? wDateVal.toString().split('T')[0] : '';
            if (historyFilters.startDate && isBeforeDate(wDateVal, historyFilters.startDate)) return false;
            if (historyFilters.endDate && isAfterDate(wDateVal, historyFilters.endDate)) return false;
            if (historyFilters.lcNo && (w.lcNo || '').trim() !== historyFilters.lcNo) return false;
            if (historyFilters.port && (w.port || '').trim() !== historyFilters.port) return false;
            if (historyFilters.warehouse && (w.whName || w.warehouse || '').trim().toLowerCase() !== historyFilters.warehouse.toLowerCase()) return false;
            if (historyFilters.brand && (w.brand || '').trim().toLowerCase() !== historyFilters.brand.toLowerCase()) return false;

            if (searchLower) {
                const matchesLC = (w.lcNo || '').trim().toLowerCase().includes(searchLower);
                const matchesWh = (w.whName || w.warehouse || '').trim().toLowerCase().includes(searchLower);
                const matchesBrand = (w.brand || '').trim().toLowerCase().includes(searchLower);
                if (!matchesLC && !matchesWh && !matchesBrand) return false;
            }

            return true;
        });

        unmatchedWhRecords.forEach(w => {
            const wDateVal = w.date || w.createdAt || w.updatedAt;
            const wDate = wDateVal ? wDateVal.toString().split('T')[0] : new Date().toISOString().split('T')[0];
            const wBrand = w.brand || 'No Brand';
            const key = `${wDate}_${w.lcNo || 'adjustment'}_wh_${w._id}`;

            const whQty = parseFloat(w.whQty) || parseFloat(w.quantity) || 0;
            const whPkt = parseFloat(w.whPkt) || parseFloat(w.packet) || 0;

            groupedMap[key] = {
                ...w,
                _id: w._id,
                date: wDate,
                lcNo: w.lcNo || '-',
                truckNo: w.truckNo || '-',
                allIds: [w._id],
                brandsProcessed: new Set([wBrand.trim().toLowerCase()]),
                totalQuantity: whQty,
                totalPacket: whPkt,
                totalInHousePacket: whPkt,
                totalInHouseQuantity: whQty,
                totalShortage: 0,
                totalSaleQuantity: 0,
                totalSalePacket: 0,
                entries: [{
                    brand: wBrand,
                    purchasedPrice: w.purchasedPrice || '',
                    packet: whPkt,
                    packetSize: w.packetSize || 30,
                    quantity: whQty,
                    inHousePacket: whPkt,
                    inHouseQuantity: whQty,
                    sweepedPacket: 0,
                    sweepedQuantity: 0,
                    saleQuantity: 0,
                    salePacket: 0,
                    unit: w.unit || 'kg'
                }]
            };
        });

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
        const productName = (viewRecord.data.productName || viewRecord.productName || viewRecord.name || '').trim().toLowerCase();

        const filteredSales = (salesRecords || []).filter(sale => {
            const status = (sale.status || '').toLowerCase();
            if (status && (status.includes('rejected') || status.includes('deleted'))) return false;

            // Exclude order and border entries from the Sale history tab
            const sTypeLow = (sale.saleType || '').toLowerCase().trim();
            const invUpper = (sale.invoiceNo || sale.orderNo || '').toUpperCase();
            if (sTypeLow === 'order' || invUpper.startsWith('ORD') || sale.isOrderEntry === true) return false;
            if (sTypeLow === 'border' || invUpper.startsWith('BS') || sale.isBorderSale === true) return false;

            const matchingItems = (sale.items || []).filter(item =>
                (item.productName || '').trim().toLowerCase() === productName
            );
            if (matchingItems.length === 0) return false;

            if (historyFilters.startDate && isBeforeDate(sale.date, historyFilters.startDate)) return false;
            if (historyFilters.endDate && isAfterDate(sale.date, historyFilters.endDate)) return false;

            if (historyFilters.lcNo) {
                const filterLc = historyFilters.lcNo;
                const matchesLc = isLcMatch(sale.lcNo, filterLc) ||
                    matchingItems.some(item =>
                        isLcMatch(item.lcNo, filterLc) ||
                        (item.brandEntries || []).some(entry => isLcMatch(entry.lcNo, filterLc))
                    );
                if (!matchesLc) return false;
            }
            if (historyFilters.port && (sale.port || '').trim() !== historyFilters.port) return false;

            if (searchLower) {
                const matchesInvoice = (sale.invoiceNo || '').toLowerCase().includes(searchLower);
                const matchesCompany = (sale.companyName || '').toLowerCase().includes(searchLower);
                const matchesCustomer = (sale.customerName || '').toLowerCase().includes(searchLower);
                const matchesPhone = (sale.contact || '').toLowerCase().includes(searchLower);
                const matchesLC = isLcMatch(sale.lcNo, searchLower) ||
                    matchingItems.some(item =>
                        isLcMatch(item.lcNo, searchLower) ||
                        (item.brandEntries || []).some(entry => isLcMatch(entry.lcNo, searchLower))
                    );
                const matchesItemBrand = matchingItems.some(item =>
                    (item.brand || '').toLowerCase().includes(searchLower) ||
                    (item.brandEntries || []).some(entry => (entry.brand || '').toLowerCase().includes(searchLower))
                );
                return matchesInvoice || matchesCompany || matchesCustomer || matchesPhone || matchesItemBrand || matchesLC;
            }
            return true;
        });

        const flattened = [];
        filteredSales.forEach(sale => {
            const matchingItems = (sale.items || []).filter(item =>
                (item.productName || '').trim().toLowerCase() === productName
            );
            matchingItems.forEach(item => {
                const itemBrandEntries = (item.brandEntries && item.brandEntries.length > 0)
                    ? item.brandEntries
                    : [{ brand: item.brand || '', quantity: item.quantity, packet: item.packet, warehouseName: item.whName || item.warehouse || sale.whName || sale.warehouse || '', lcNo: item.lcNo || sale.lcNo || '' }];

                itemBrandEntries.forEach(entry => {
                    const entryQty = parseFloat(entry.quantity) || parseFloat(item.quantity) || 0;
                    if (entryQty <= 0) return;
                    const rawEntryLc = (entry.lcNo || '').trim();
                    const rawItemLc = (item.lcNo || '').trim();
                    const rawSaleLc = (sale.lcNo || '').trim();
                    const entryLc = rawEntryLc || rawItemLc || rawSaleLc || '';

                    if (historyFilters.lcNo && !isLcMatch(entryLc, historyFilters.lcNo) && !isLcMatch(sale.lcNo, historyFilters.lcNo)) return;
                    if (historyFilters.brand && (entry.brand || '').trim().toLowerCase() !== historyFilters.brand.toLowerCase()) return;
                    if (historyFilters.warehouse && (entry.warehouseName || sale.whName || sale.warehouse || '').trim().toLowerCase() !== historyFilters.warehouse.toLowerCase()) return;

                    if (searchLower) {
                        const matchesInvoice = (sale.invoiceNo || '').toLowerCase().includes(searchLower);
                        const matchesCompany = (sale.companyName || '').toLowerCase().includes(searchLower);
                        const matchesCustomer = (sale.customerName || '').toLowerCase().includes(searchLower);
                        const matchesPhone = (sale.contact || '').toLowerCase().includes(searchLower);
                        const matchesLC = isLcMatch(entryLc, searchLower) || isLcMatch(sale.lcNo, searchLower);
                        const matchesBrand = (entry.brand || '').toLowerCase().includes(searchLower);
                        if (!matchesInvoice && !matchesCompany && !matchesCustomer && !matchesPhone && !matchesLC && !matchesBrand) return;
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
                        lcNo: entryLc,
                        itemBrand: entry.brand,
                        itemTruck: entry.truck,
                        itemPacket: calculatedPacket,
                        itemQty: qty,
                        itemPrice: parseFloat(entry.unitPrice) || 0,
                        itemTotal: parseFloat(entry.totalAmount) || 0,
                        itemWarehouse: entry.warehouseName || '',
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
            // Use aggregated record.entries first (which includes full in-house quantity across warehouses)
            const entries = (record.entries && record.entries.length > 0) ? record.entries : (record.brandEntries || []);
            entries.forEach(entry => {
                // Apply brand filter if present
                const brandMatch = !historyFilters.brand || (entry.brand || '').trim().toLowerCase() === historyFilters.brand.toLowerCase();
                if (brandMatch) {
                    const purchaseQty = parseFloat(entry.quantity ?? record.totalQuantity ?? entry.inHouseQuantity ?? record.totalInHouseQuantity) || 0;
                    const purchasePkt = parseFloat(entry.packet ?? record.totalPacket ?? entry.inHousePacket ?? record.totalInHousePacket) || 0;
                    const inhouseQty = parseFloat(entry.inHouseQuantity ?? record.totalInHouseQuantity ?? purchaseQty) || 0;
                    purchaseFlattened.push({
                        ...record,
                        itemBrand: entry.brand,
                        itemPurchasedPrice: entry.purchasedPrice,
                        itemPacket: purchasePkt,
                        itemQty: purchaseQty,
                        itemInHouseQty: inhouseQty,
                        itemShortageQty: entry.sweepedQuantity,
                        itemExporter: record.exporter,
                        unit: entry.unit
                    });
                }
            });
        });

        // 2. Calculate Sale History (already flattened in activeSaleHistory)
        const saleFlattened = activeSaleHistory;

        // 3. Filter Damage History
        const damageFlattened = (damages || []).filter(d => {
            const pMatch = (d.productName || '').trim().toLowerCase() === productName;
            const bMatch = !historyFilters.brand || (d.brand || '').trim().toLowerCase() === historyFilters.brand.toLowerCase();
            const lcMatch = !historyFilters.lcNo || isLcMatch(d.lcNo, historyFilters.lcNo);
            return pMatch && bMatch && lcMatch;
        }).map(d => ({
            ...d,
            itemBrand: d.brand,
            itemQty: d.quantity,
            itemPacket: d.packet,
            type: 'damage'
        }));

        // 4. Flatten Transfer History (combining explicit transfer logs and legacy transferred warehouse records)
        const explicitTransferLogs = (warehouseData || []).filter(w => w.isTransferLog);
        const explicitLogKeys = new Set(
            explicitTransferLogs.map(t => `${(t.fromWh || '').trim().toLowerCase()}_${(t.toWh || '').trim().toLowerCase()}_${(t.productName || t.product || '').trim().toLowerCase()}_${(t.brand || '').trim().toLowerCase()}_${(t.lcNo || '').trim()}`)
        );

        const synthesizedTransfers = [...explicitTransferLogs];
        (warehouseData || []).forEach(w => {
            if (w.isTransferLog) return;
            if (w.recordType === 'warehouse' || (!w.recordType && (w.whName || w.warehouse) && (w.productName || w.product))) {
                const wWh = (w.whName || w.warehouse || '').trim();
                const wLc = (w.lcNo || '').trim();
                const wProd = (w.productName || w.product || '').trim();
                const wBrand = (w.brand || '').trim();

                const parentStock = (stockRecords || []).find(s => {
                    const sLc = (s.lcNo || '').trim();
                    const sProd = (s.productName || s.product || '').trim();
                    const sBrand = (s.brand || '').trim();
                    return sLc === wLc && sProd.toLowerCase() === wProd.toLowerCase() && sBrand.toLowerCase() === wBrand.toLowerCase() && sLc !== '' && sLc !== '-';
                });

                if (parentStock) {
                    const parentWh = (parentStock.whName || parentStock.warehouse || 'HILI').trim();
                    if (parentWh.toLowerCase() !== wWh.toLowerCase()) {
                        const synthKey = `${parentWh.toLowerCase()}_${wWh.toLowerCase()}_${wProd.toLowerCase()}_${wBrand.toLowerCase()}_${wLc}`;
                        if (!explicitLogKeys.has(synthKey)) {
                            synthesizedTransfers.push({
                                ...w,
                                isTransferLog: true,
                                fromWh: parentWh,
                                toWh: wWh,
                                productName: wProd,
                                brand: wBrand,
                                lcNo: wLc,
                                date: w.date || w.createdAt || parentStock.date || new Date().toISOString(),
                                whQty: parseFloat(w.whQty || w.quantity) || 0,
                                whPkt: parseFloat(w.whPkt || w.packet) || 0
                            });
                        }
                    }
                }
            }
        });

        const transferFlattened = synthesizedTransfers.filter(w => {
            const pMatch = (w.productName || w.product || '').trim().toLowerCase() === productName;
            if (!pMatch) return false;
            if (historyFilters.brand && (w.brand || '').trim().toLowerCase() !== historyFilters.brand.trim().toLowerCase()) return false;
            if (historyFilters.lcNo && !isLcMatch(w.lcNo, historyFilters.lcNo)) return false;
            return true;
        }).map(t => ({
            ...t,
            type: 'transfer',
            date: t.date ? t.date.split('T')[0] : (t.createdAt ? t.createdAt.split('T')[0] : ''),
            itemQty: parseFloat(t.whQty) || parseFloat(t.quantity) || 0,
            itemPacket: parseFloat(t.whPkt) || parseFloat(t.packet) || 0,
            fromWh: (t.fromWh || t.fromWarehouse || '').trim(),
            toWh: (t.toWh || t.toWarehouse || '').trim()
        }));

        setProductHistoryReportData({
            productName: viewRecord.data.productName,
            category: viewRecord.data.category,
            filters: historyFilters,
            purchaseHistory: purchaseFlattened,
            saleHistory: saleFlattened,
            damageHistory: damageFlattened,
            transferHistory: transferFlattened,
            activeBaseline: activeBaseline
        });
        setShowProductHistoryReport(true);
    };

    const availableLcs = useMemo(() => {
        const activeProduct = addWarehouseStockFormData.productEntries[activeWhProductIndex];
        if (!activeProduct || !activeProduct.productName) return [];
        const targetProd = (activeProduct.productName || '').trim().toLowerCase();

        // Get all unique LC numbers from warehouseData for this product
        const lcs = warehouseData
            .filter(item => (item.productName || item.product || '').trim().toLowerCase() === targetProd)
            .map(item => (item.lcNo || '').trim())
            .filter(Boolean);

        return [...new Set(lcs)].sort();
    }, [addWarehouseStockFormData.productEntries, activeWhProductIndex, warehouseData]);

    const availableBrands = useMemo(() => {
        const activeProduct = addWarehouseStockFormData.productEntries[activeWhProductIndex];
        if (!activeProduct || !activeProduct.productName) return [];
        const activeBrandEntry = activeProduct.brandEntries[activeWhBrandIndex];
        const currentLc = (activeBrandEntry?.lcNo || '').trim().toLowerCase();
        const targetProd = (activeProduct.productName || '').trim().toLowerCase();

        // Find brands for this product AND this LC No in warehouseData
        const matchingBrands = warehouseData
            .filter(item =>
                (item.productName || item.product || '').trim().toLowerCase() === targetProd &&
                (currentLc ? (item.lcNo || '').trim().toLowerCase() === currentLc : true)
            )
            .map(item => (item.brand || '').trim())
            .filter(Boolean);

        const uniqueMatchingBrands = [...new Set(matchingBrands)].sort();

        // If we found matching brands, return them as objects (with brand property)
        if (uniqueMatchingBrands.length > 0) {
            return uniqueMatchingBrands.map(bName => ({ brand: bName }));
        }

        // Fallback: If no matching brands found in warehouseData, fall back to product's defined brands
        if (products) {
            const selectedProduct = products.find(p => p.name === activeProduct.productName);
            if (selectedProduct && selectedProduct.brands) {
                return selectedProduct.brands.map(b => typeof b === 'object' && b.brand ? b : { brand: b });
            }
        }
        return [];
    }, [addWarehouseStockFormData.productEntries, activeWhProductIndex, activeWhBrandIndex, warehouseData, products]);

    const ports = useMemo(() => {
        return [...new Set(stockRecords.map(r => r.port).filter(Boolean))].map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [stockRecords]);

    const importers = useMemo(() => {
        return [...new Set(stockRecords.map(r => r.importer).filter(Boolean))].map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [stockRecords]);

    // --- Effects ---

    const fetchWarehouses = async () => {
        try {
            const [whResData, stockResData] = await Promise.all([
                queryClient.fetchQuery({
                    queryKey: ['warehouses'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/warehouses`).then(r => Array.isArray(r.data) ? r.data : [])
                }),
                queryClient.fetchQuery({
                    queryKey: ['stock'],
                    queryFn: () => axios.get(`${API_BASE_URL}/api/stock`).then(r => Array.isArray(r.data) ? r.data : [])
                })
            ]);

            const whData = Array.isArray(whResData) ? whResData : [];
            const stockDataRes = Array.isArray(stockResData) ? stockResData : [];

            // 1. Calculate Global InHouse Totals from ALL Stock Data
            const globalInHouseMap = {};
            const stockDataDecrypted = stockDataRes.map(item => {
                try {
                    return { ...item, _id: item._id, createdAt: item.createdAt };
                } catch { return null; }
            }).filter(item => {
                if (!item) return false;
                const status = (item.status || '').toLowerCase();
                return !status.includes('requested') && !status.includes('rejected');
            });

            stockDataDecrypted.forEach(d => {
                const key = `${(d.productName || d.product || '').trim()}_${(d.brand || '').trim()}`;
                if (!globalInHouseMap[key]) {
                    globalInHouseMap[key] = { pkt: 0, qty: 0 };
                }
                globalInHouseMap[key].pkt += parseFloat(d.inHousePacket || d.inhousePkt || 0);
                globalInHouseMap[key].qty += parseFloat(d.inHouseQuantity || d.inhouseQty || 0);
            });

            // 2. Normalize Warehouse records
            const allDecryptedWh = whData.map(item => {
                try {
                    let decrypted = item.data ? decryptData(item.data) : item;
                    if (typeof decrypted === 'string') {
                        try { decrypted = decryptData(decrypted); } catch (e) { }
                    }
                    if (decrypted && typeof decrypted === 'object' && decrypted.data && typeof decrypted.data === 'string') {
                        try { decrypted = decryptData(decrypted.data); } catch (e) { }
                    }
                    const key = `${(decrypted.product || decrypted.productName || '').trim()}_${(decrypted.brand || '').trim()}`;
                    const globalStats = globalInHouseMap[key] || { pkt: 0, qty: 0 };

                    const inhousePkt = globalStats.qty > 0 ? globalStats.pkt : parseFloat(decrypted.inhousePkt ?? decrypted.inHousePacket ?? decrypted.whPkt ?? 0);
                    const inhouseQty = globalStats.qty > 0 ? globalStats.qty : parseFloat(decrypted.inhouseQty ?? decrypted.inHouseQuantity ?? decrypted.whQty ?? 0);

                    const whPkt = decrypted.whPkt !== undefined && decrypted.whPkt !== null ? parseFloat(decrypted.whPkt) : inhousePkt;
                    const whQty = decrypted.whQty !== undefined && decrypted.whQty !== null ? parseFloat(decrypted.whQty) : inhouseQty;
                    const salePacket = decrypted.salePacket !== undefined && decrypted.salePacket !== null ? parseFloat(decrypted.salePacket) : 0;
                    const saleQuantity = decrypted.saleQuantity !== undefined && decrypted.saleQuantity !== null ? parseFloat(decrypted.saleQuantity) : 0;

                    return {
                        ...decrypted,
                        productName: decrypted.productName || decrypted.product || '',
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
                const rawWh = (d.whName || d.warehouse || '').trim();
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
                if (name === 'brand' || name === 'lcNo') {
                    const currentProductName = updatedProducts[pIndex].productName;
                    const targetProd = (currentProductName || '').trim().toLowerCase();

                    const brandVal = name === 'brand' ? value : updatedBrands[bIndex].brand;
                    const lcNoVal = name === 'lcNo' ? value : updatedBrands[bIndex].lcNo;

                    const targetBrand = (brandVal || '').trim().toLowerCase();
                    const targetLcNo = (lcNoVal || '').trim().toLowerCase();
                    const targetWh = (addWarehouseStockFormData.whName || '').trim().toLowerCase();

                    const matchingStockEntries = warehouseData.filter(item =>
                        ((item.productName || item.product || '').trim().toLowerCase() === targetProd) &&
                        (item.brand || '').trim().toLowerCase() === targetBrand &&
                        (targetLcNo ? (item.lcNo || '').trim().toLowerCase() === targetLcNo : true)
                    );

                    const globalInPkt = matchingStockEntries.reduce((sum, item) => sum + (parseFloat(item.inhousePkt) || 0), 0);
                    const globalInQty = matchingStockEntries.reduce((sum, item) => sum + (parseFloat(item.inhouseQty) || 0), 0);

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
                        const sStatus = (sale.status || '').toLowerCase();
                        const sType = (sale.saleType || '').toLowerCase();
                        if (sStatus !== 'accepted') return;
                        if (sType === 'border' || (sale.invoiceNo || '').toUpperCase().startsWith('BS') || sale.isBorderSale === true) return;
                        if (sale.items) {
                            sale.items.forEach(saleItem => {
                                if ((saleItem.productName || '').trim().toLowerCase() === targetProd) {
                                    if (saleItem.brandEntries) {
                                        saleItem.brandEntries.forEach(entry => {
                                            if ((entry.brand || '').trim().toLowerCase() === targetBrand &&
                                                (targetLcNo ? (entry.lcNo || '').trim().toLowerCase() === targetLcNo : true)) {
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
                    if (name === 'brand') {
                        setActiveWhProductIndex(pIndex);
                        setActiveWhBrandIndex(bIndex);
                        setShowWhBrandDropdown(true);
                    }
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
                        const sStatus = (sale.status || '').toLowerCase();
                        const sType = (sale.saleType || '').toLowerCase();
                        if (sStatus !== 'accepted') return;
                        if (sType === 'border' || (sale.invoiceNo || '').toUpperCase().startsWith('BS') || sale.isBorderSale === true) return;
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
                    updatedProducts[pIndex] = {
                        ...updatedProducts[pIndex],
                        [name]: value,
                        brandEntries: [{ lcNo: '', brand: '', inhousePkt: '', inhouseQty: '', whPkt: '', whQty: '', transferPkt: '', transferQty: '', packetSize: '' }]
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
                                    const sStatus = (sale.status || '').toLowerCase();
                                    const sType = (sale.saleType || '').toLowerCase();
                                    if (sStatus !== 'accepted') return;
                                    if (sType === 'border' || (sale.invoiceNo || '').toUpperCase().startsWith('BS') || sale.isBorderSale === true) return;
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
                    lcNo: '',
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
            lcNo: '',
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
        if (!canTransfer) {
            alert('Forbidden: You do not have permission to transfer stock');
            return;
        }
        setIsAddingWarehouseStock(true);
        setAddWarehouseStockSubmitStatus(null);
        try {
            for (const productEntry of addWarehouseStockFormData.productEntries) {
                for (const brandEntry of productEntry.brandEntries) {
                    let transferQty = parseFloat(brandEntry.transferQty) || 0;
                    let transferPkt = parseFloat(brandEntry.transferPkt) || 0;

                    if (transferQty <= 0 && transferPkt <= 0) continue;

                    // 1. Handle Source Deduction - Support multiple sources matching same product/brand/LC No
                    const targetWh = (addWarehouseStockFormData.whName || '').trim().toLowerCase();
                    const targetProd = (productEntry.productName || '').trim().toLowerCase();
                    const targetBrand = (brandEntry.brand || '').trim().toLowerCase();
                    const targetLc = (brandEntry.lcNo || '').trim().toLowerCase();

                    const sourceRecords = warehouseData.filter(item => {
                        const itemWh = (item.whName || item.warehouse || '').trim().toLowerCase();
                        const itemProd = (item.productName || item.product || '').trim().toLowerCase();
                        const itemBrand = (item.brand || '').trim().toLowerCase();
                        const itemLc = (item.lcNo || '').trim().toLowerCase();

                        const whMatch = !targetWh || itemWh === targetWh || itemWh.includes(targetWh) || targetWh.includes(itemWh);
                        const prodMatch = itemProd === targetProd;
                        const brandMatch = !targetBrand || itemBrand === targetBrand || !itemBrand;
                        const lcMatch = !targetLc || itemLc === targetLc || (item.lcNoClean && targetLc && item.lcNoClean === targetLc.replace(/\D/g, ''));

                        const availQty = parseFloat(item.whQty) || parseFloat(item.inHouseQuantity) || parseFloat(item.inhouseQty) || parseFloat(item.quantity) || 0;
                        const availPkt = parseFloat(item.whPkt) || parseFloat(item.inHousePacket) || parseFloat(item.inhousePkt) || parseFloat(item.packet) || 0;

                        return whMatch && prodMatch && brandMatch && lcMatch && (availQty > 0 || availPkt > 0);
                    });

                    // Sort to prioritize older stock or simply iterate
                    // Let's iterate and deduct until transferQty/Pkt is fulfilled
                    const updates = [];
                    const lcSrrDeductions = [];

                    for (const sourceRecord of sourceRecords) {
                        if (transferQty <= 0 && transferPkt <= 0) break;

                        const availableQty = parseFloat(sourceRecord.whQty) || parseFloat(sourceRecord.inHouseQuantity) || parseFloat(sourceRecord.inhouseQty) || parseFloat(sourceRecord.quantity) || 0;
                        const availablePkt = parseFloat(sourceRecord.whPkt) || parseFloat(sourceRecord.inHousePacket) || parseFloat(sourceRecord.inhousePkt) || parseFloat(sourceRecord.packet) || 0;

                        const deductQty = Math.min(availableQty, transferQty);
                        const deductPkt = Math.min(availablePkt, transferPkt);

                        if (deductQty > 0 || deductPkt > 0) {
                            const newWhQty = availableQty - deductQty;
                            const newWhPkt = availablePkt - deductPkt;

                            let updatedBrandEntries = sourceRecord.brandEntries;
                            if (Array.isArray(sourceRecord.brandEntries) && sourceRecord.brandEntries.length > 0) {
                                updatedBrandEntries = sourceRecord.brandEntries.map(be => {
                                    const beBrand = (be.brand || '').trim().toLowerCase();
                                    if (!targetBrand || !beBrand || beBrand === targetBrand) {
                                        const beQty = parseFloat(be.inHouseQuantity ?? be.inhouseQty ?? be.quantity ?? 0);
                                        const bePkt = parseFloat(be.inHousePacket ?? be.inhousePkt ?? be.packet ?? 0);
                                        const newBeQty = Math.max(0, beQty - deductQty);
                                        const newBePkt = Math.max(0, bePkt - deductPkt);
                                        return {
                                            ...be,
                                            whQty: newBeQty,
                                            whPkt: newBePkt,
                                            inHouseQuantity: newBeQty,
                                            inhouseQty: newBeQty,
                                            inHousePacket: newBePkt,
                                            inhousePkt: newBePkt
                                        };
                                    }
                                    return be;
                                });
                            }

                            const updatedSource = {
                                ...sourceRecord,
                                whQty: newWhQty,
                                whPkt: newWhPkt,
                                ...(sourceRecord.recordType === 'stock' && {
                                    inHouseQuantity: newWhQty,
                                    inhouseQty: newWhQty,
                                    inHousePacket: newWhPkt,
                                    inhousePkt: newWhPkt
                                }),
                                ...(updatedBrandEntries ? { brandEntries: updatedBrandEntries } : {})
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

                    // Execute Source Updates (skip pre-baseline historical records to preserve old connections)
                    for (const { record: updatedSource, original } of updates) {
                        if (activeBaseline && activeBaseline.status === 'active') {
                            const origDate = original.date || original.createdAt || '';
                            if (origDate && origDate < activeBaseline.baselineDate) {
                                // Baseline isolates stock state; do not mutate pre-baseline historical DB records
                                continue;
                            }
                        }

                        const { _id, recordType, createdAt, updatedAt, ...sourceDataToEncrypt } = updatedSource;

                        if (original.recordType === 'stock') {
                            await axios.put(`${API_BASE_URL}/api/stock/${original._id}`, sourceDataToEncrypt);
                        } else {
                            await axios.put(`${API_BASE_URL}/api/warehouses/${original._id}`, sourceDataToEncrypt);
                        }
                    }

                    // 2. Handle Destination Addition (Transfer or New Stock)
                    const destWhName = addWarehouseStockFormData.to || addWarehouseStockFormData.whName;

                    for (const deduction of lcSrrDeductions) {
                        const destRecord = warehouseData.find(item =>
                            !item.isTransferLog &&
                            (item.whName || item.warehouse || '').trim().toLowerCase() === (destWhName || '').trim().toLowerCase() &&
                            (item.productName || item.product || '').trim().toLowerCase() === targetProd &&
                            (item.brand || '').trim().toLowerCase() === targetBrand &&
                            (item.lcNo === deduction.lcNo || (!item.lcNo && !deduction.lcNo)) &&
                            (item.truckNo === deduction.truckNo || (!item.truckNo && !deduction.truckNo))
                        );

                        if (destRecord) {
                            const newWhQty = (parseFloat(destRecord.whQty) || parseFloat(destRecord.inHouseQuantity) || parseFloat(destRecord.inhouseQty) || 0) + deduction.qty;
                            const newWhPkt = (parseFloat(destRecord.whPkt) || parseFloat(destRecord.inHousePacket) || parseFloat(destRecord.inhousePkt) || 0) + deduction.pkt;

                            const updatedDest = {
                                ...destRecord,
                                isTransferredEntry: true,
                                isTransferLog: false,
                                whQty: newWhQty,
                                whPkt: newWhPkt,
                                quantity: newWhQty,
                                packet: newWhPkt,
                                inHouseQuantity: newWhQty,
                                inhouseQty: newWhQty,
                                inHousePacket: newWhPkt,
                                inhousePkt: newWhPkt,
                                totalInHouseQuantity: newWhQty,
                                totalInHousePacket: newWhPkt
                            };
                            const { _id, recordType, createdAt, updatedAt, ...destDataToEncrypt } = updatedDest;

                            if (destRecord.recordType === 'stock') {
                                await axios.put(`${API_BASE_URL}/api/stock/${destRecord._id}`, destDataToEncrypt);
                            } else {
                                await axios.put(`${API_BASE_URL}/api/warehouses/${destRecord._id}`, destDataToEncrypt);
                            }
                        } else {
                            const newEntry = {
                                whName: destWhName,
                                warehouse: destWhName,
                                recordType: 'warehouse',
                                isTransferredEntry: true,
                                isTransferLog: false,
                                manager: addWarehouseStockFormData.toManager || addWarehouseStockFormData.manager || '-',
                                location: addWarehouseStockFormData.toLocation || addWarehouseStockFormData.location || '-',
                                capacity: parseFloat(addWarehouseStockFormData.toCapacity) || parseFloat(addWarehouseStockFormData.capacity) || 0,
                                product: productEntry.productName,
                                productName: productEntry.productName,
                                brand: brandEntry.brand,
                                lcNo: deduction.lcNo || '',
                                truckNo: deduction.truckNo || '',
                                inhousePkt: deduction.pkt,
                                inhouseQty: deduction.qty,
                                inHousePacket: deduction.pkt,
                                inHouseQuantity: deduction.qty,
                                whPkt: deduction.pkt,
                                whQty: deduction.qty,
                                packet: deduction.pkt,
                                quantity: deduction.qty,
                                totalInHousePacket: deduction.pkt,
                                totalInHouseQuantity: deduction.qty,
                                transferPkt: 0,
                                transferQty: 0
                            };
                            await axios.post(`${API_BASE_URL}/api/warehouses`, newEntry);
                        }

                        // Create and save a transfer history log document
                        const transferLog = {
                            isTransferLog: true,
                            date: new Date().toISOString(),
                            fromWh: addWarehouseStockFormData.whName,
                            toWh: destWhName,
                            productName: productEntry.productName,
                            product: productEntry.productName,
                            brand: brandEntry.brand,
                            lcNo: deduction.lcNo || '',
                            truckNo: deduction.truckNo || '',
                            whQty: deduction.qty,
                            whPkt: deduction.pkt,
                            manager: addWarehouseStockFormData.toManager || addWarehouseStockFormData.manager || '-',
                            location: addWarehouseStockFormData.toLocation || addWarehouseStockFormData.location || '-'
                        };
                        await axios.post(`${API_BASE_URL}/api/warehouses`, transferLog);
                    }
                }
            }
            // Refresh data to reflect changes
            queryClient.invalidateQueries({ queryKey: ['warehouses'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
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
            fetchWarehouses();
        } catch (error) {
            console.error('Error saving warehouse stock:', error);
            setAddWarehouseStockSubmitStatus('error');
        } finally {
            setIsAddingWarehouseStock(false);
        }
    };

    // Generate History Options
    const historyOptions = useMemo(() => {
        if (!viewRecord) return { lcNos: [], ports: [], brands: [], warehouses: [] };

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

        const productName = (viewRecord.data.productName || '').trim().toLowerCase();
        const whFromStock = productHistory.map(r => r.warehouse || r.whName).filter(Boolean);
        const whFromWh = (warehouseData || []).filter(w => (w.productName || w.product || '').trim().toLowerCase() === productName).map(w => w.whName || w.warehouse).filter(Boolean);
        const warehouses = [...new Set([...whFromStock, ...whFromWh])].sort();

        return {
            lcNos,
            ports,
            brands: [...brandsSet].sort(),
            warehouses
        };
    }, [viewRecord, stockRecords, warehouseData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target && !document.body.contains(event.target)) {
                return;
            }
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
                if (filterDropdownOpen.warehouse && stockWarehouseFilterRef.current && !stockWarehouseFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, warehouse: false }));
                if (filterDropdownOpen.importer && stockImporterFilterRef.current && !stockImporterFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, importer: false }));
                if (filterDropdownOpen.productName && stockProductFilterRef.current && !stockProductFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, productName: false }));
                if (filterDropdownOpen.brand && stockBrandFilterRef.current && !stockBrandFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, brand: false }));
            }

            // Filter Dropdowns (History Modal - always check)
            if (filterDropdownOpen.warehouse && warehouseFilterRef.current && !warehouseFilterRef.current.contains(event.target)) setFilterDropdownOpen(prev => ({ ...prev, warehouse: false }));
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
                if (activeDropdown === 'warehouse' && warehouseFilterRef.current && !warehouseFilterRef.current.contains(event.target)) setActiveDropdown(null);
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
            if (showWhLcDropdown && whLcDropdownRefs.current[`${activeWhProductIndex}-${activeWhBrandIndex}`] && !whLcDropdownRefs.current[`${activeWhProductIndex}-${activeWhBrandIndex}`].contains(event.target)) {
                setShowWhLcDropdown(false);
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
    }, [showStockFilterPanel, showHistoryFilterPanel, activeDropdown, filterDropdownOpen, viewRecord, showWhDropdown, showToDropdown, showWhProductDropdown, showWhBrandDropdown, showWhLcDropdown, activeWhProductIndex, activeWhBrandIndex]);

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
        let selectedProductNames = [];
        if (productName) {
            if (Array.isArray(productName)) {
                selectedProductNames = productName.map(p => p.toLowerCase().trim());
            } else if (typeof productName === 'string' && productName.trim() !== '') {
                selectedProductNames = productName.split(',').map(p => p.toLowerCase().trim());
            }
        }

        stockRecords.forEach(r => {
            // Filter by product if provided
            if (selectedProductNames.length > 0) {
                const rProdName = (r.productName || r.product || '').trim().toLowerCase();
                if (!selectedProductNames.includes(rProdName)) {
                    return;
                }
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
            resetStockForm();
            setShowStockForm(false);
            setSubmitStatus(null);
            if (fetchStockRecords) fetchStockRecords();

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
        return calculateStockData(stockRecords, { ...stockFilters, showRate: effectiveShowRate, offsetZeroLc: isOffsetZeroLcActive }, deferredStockSearch, warehouseData, salesRecords, products, damages, activeBaseline, returnsList);
    }, [stockRecords, stockFilters, effectiveShowRate, deferredStockSearch, warehouseData, salesRecords, products, damages, activeBaseline, returnsList, isOffsetZeroLcActive]);

    const warehouseOptions = useMemo(() => {
        const fromStock = (stockRecords || []).map(item => (item.warehouse || item.whName || '').trim()).filter(Boolean);
        const fromWh = (warehouseData || []).flatMap(item => [item.whName, item.warehouse, item.fromWh, item.toWh].map(x => (x || '').trim())).filter(Boolean);
        const fromBaseline = (activeBaseline && Array.isArray(activeBaseline.snapshotRecords))
            ? activeBaseline.snapshotRecords.map(s => (s.warehouse || s.whName || '').trim()).filter(Boolean)
            : [];
        const options = [...new Set([...fromStock, ...fromWh, ...fromBaseline])].filter(w => w && w !== 'Inventory Adjustment').sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        // Priority: HILI first, then BOGURA, then others in alphabetical order
        const hili = options.filter(o => o.toUpperCase().includes('HILI'));
        const bogura = options.filter(o => o.toUpperCase().includes('BOGURA'));
        const others = options.filter(o => !o.toUpperCase().includes('HILI') && !o.toUpperCase().includes('BOGURA'));
        return [...hili, ...bogura, ...others];
    }, [stockRecords, warehouseData, activeBaseline]);

    const formatWarehouseName = (name) => {
        if (!name) return '';
        return String(name)
            .split(' ')
            .map(word => {
                if (!word) return '';
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    };

    const multiWarehouseData = useMemo(() => {
        const isAll = !stockFilters.warehouse || stockFilters.warehouse === "All Warehouses" || stockFilters.warehouse === "All";
        if (!isAll) {
            return [{
                warehouseName: stockFilters.warehouse,
                data: stockData
            }].filter(item => item.data?.displayRecords?.length > 0);
        }

        return warehouseOptions.map(wh => {
            const filters = { ...stockFilters, warehouse: wh, showRate: effectiveShowRate, _isSubCall: true, offsetZeroLc: isOffsetZeroLcActive };
            return {
                warehouseName: wh,
                data: calculateStockData(stockRecords, filters, deferredStockSearch, warehouseData, salesRecords, products, damages, activeBaseline, returnsList)
            };
        }).filter(item => item.data?.displayRecords?.length > 0);
    }, [stockFilters, warehouseOptions, stockRecords, deferredStockSearch, warehouseData, salesRecords, products, damages, effectiveShowRate, activeBaseline, returnsList, stockData, isOffsetZeroLcActive]);

    // Track sales recorded under placeholder (0000 or missing) LC numbers
    const detectedLcDiscrepancies = useMemo(() => {
        const isZeroPlaceholderLc = (v) => !v || ['0000', '000', '00', '0', '-', '—', '--'].includes(v.toString().trim().toLowerCase());
        const list = [];
        (salesRecords || []).forEach(sale => {
            const sType = (sale.saleType || '').toLowerCase();
            const inv = sale.invoiceNo || sale.orderNo || '';
            const isOrder = sType === 'order' || inv.startsWith('ORD') || sale.isOrderEntry === true;
            if (isOrder) return;
            (sale.items || []).forEach(item => {
                const pName = (item.productName || item.product || '').trim();
                if (item.brandEntries && item.brandEntries.length > 0) {
                    item.brandEntries.forEach(be => {
                        const lc = (be.lcNo || item.lcNo || '').trim();
                        if (isZeroPlaceholderLc(lc)) {
                            list.push({
                                saleId: sale._id,
                                invoiceNo: sale.invoiceNo,
                                date: sale.date || sale.createdAt,
                                warehouse: be.warehouse || item.warehouse || sale.warehouse,
                                productName: pName,
                                brand: be.brand || item.brand,
                                lcNo: lc || '0000',
                                quantity: be.quantity || be.qty || 0
                            });
                        }
                    });
                } else {
                    const lc = (item.lcNo || '').trim();
                    if (isZeroPlaceholderLc(lc)) {
                        list.push({
                            saleId: sale._id,
                            invoiceNo: sale.invoiceNo,
                            date: sale.date || sale.createdAt,
                            warehouse: item.warehouse || sale.warehouse,
                            productName: pName,
                            brand: item.brand,
                            lcNo: lc || '0000',
                            quantity: item.quantity || item.qty || 0
                        });
                    }
                }
            });
        });
        return list;
    }, [salesRecords]);

    const groupedDiscrepancies = useMemo(() => {
        const map = {};
        detectedLcDiscrepancies.forEach(d => {
            const whNorm = (d.warehouse || '').trim();
            const pNorm = (d.productName || '').trim();
            const bNorm = (d.brand || '').trim();
            const key = `${pNorm.toLowerCase()}_${bNorm.toLowerCase()}_${whNorm.toLowerCase()}`;
            if (!map[key]) {
                let targetLc = '';
                let targetClosing = 0;
                (multiWarehouseData || []).forEach(wh => {
                    if ((wh.warehouseName || '').toLowerCase() === whNorm.toLowerCase()) {
                        (wh.data?.displayRecords || []).forEach(p => {
                            if ((p.productName || '').toLowerCase() === pNorm.toLowerCase()) {
                                (p.brandList || []).forEach(b => {
                                    if ((b.brand || '').toLowerCase() === bNorm.toLowerCase() && b.lcNo && b.lcNo !== '0000' && b.lcNo !== '-') {
                                        targetLc = b.lcNo;
                                        targetClosing = b.closingQuantity;
                                    }
                                });
                            }
                        });
                    }
                });

                map[key] = {
                    productName: pNorm,
                    brand: bNorm,
                    warehouse: whNorm,
                    totalPlaceholderQty: 0,
                    count: 0,
                    targetLc,
                    targetClosing
                };
            }
            map[key].totalPlaceholderQty += (parseFloat(d.quantity) || 0);
            map[key].count += 1;
        });
        return Object.values(map);
    }, [detectedLcDiscrepancies, multiWarehouseData]);

    // Product options for manual LC fix
    const manualFixProductOptions = useMemo(() => {
        const set = new Set();
        (products || []).forEach(p => {
            const name = (p.name || p.productName || '').trim();
            if (name) set.add(name);
        });
        (stockRecords || []).forEach(s => {
            const name = (s.productName || s.product || '').trim();
            if (name) set.add(name);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [products, stockRecords]);

    // Brand options for selected product
    const manualFixBrandOptions = useMemo(() => {
        if (!manualFixProduct) return [];
        const set = new Set();
        const pNorm = manualFixProduct.trim().toLowerCase();
        (stockRecords || []).forEach(s => {
            if ((s.productName || s.product || '').trim().toLowerCase() === pNorm) {
                if (s.brand) set.add(s.brand.trim());
                if (s.brandEntries) s.brandEntries.forEach(b => { if (b.brand) set.add(b.brand.trim()); });
            }
        });
        (salesRecords || []).forEach(s => {
            (s.items || []).forEach(it => {
                if ((it.productName || it.product || '').trim().toLowerCase() === pNorm) {
                    if (it.brand) set.add(it.brand.trim());
                    if (it.brandEntries) it.brandEntries.forEach(b => { if (b.brand) set.add(b.brand.trim()); });
                }
            });
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [manualFixProduct, stockRecords, salesRecords]);

    // Auto-select brand when product changes if current brand is invalid
    useEffect(() => {
        if (manualFixBrandOptions.length > 0 && !manualFixBrandOptions.includes(manualFixBrand)) {
            setManualFixBrand(manualFixBrandOptions[0]);
        }
    }, [manualFixBrandOptions, manualFixBrand]);

    // Auto pre-populate product & brand when opening reconcile modal
    useEffect(() => {
        if (showReconcileModal && (!manualFixProduct || !manualFixBrand)) {
            if (groupedDiscrepancies.length > 0) {
                const first = groupedDiscrepancies[0];
                setManualFixProduct(first.productName || '');
                setManualFixBrand(first.brand || '');
                setManualFixFromLc('');
                if (first.targetLc) setManualFixToLc(first.targetLc);
                if (first.warehouse) setManualFixWarehouse(first.warehouse);
            } else if (!manualFixProduct && manualFixProductOptions.length > 0) {
                setManualFixProduct(manualFixProductOptions[0]);
            }
        }
    }, [showReconcileModal, groupedDiscrepancies]);

    // Current LC breakdown for selected Product & Brand (with all LCs un-omitted)
    const manualFixLcBreakdown = useMemo(() => {
        if (!manualFixProduct || !manualFixBrand) return [];
        const pNorm = manualFixProduct.trim().toLowerCase();
        const bNorm = manualFixBrand.trim().toLowerCase();
        const list = [];

        const targetWarehouses = manualFixWarehouse && manualFixWarehouse !== 'All'
            ? [manualFixWarehouse]
            : (warehouseOptions.length > 0 ? warehouseOptions : ['Hili', 'Bogura']);

        targetWarehouses.forEach(whName => {
            const filters = {
                warehouse: whName,
                showRate: true,
                offsetZeroLc: false, // Ensures 0000 and all placeholder LCs are kept visible with true closing!
                _isSubCall: true
            };
            const calc = calculateStockData(
                stockRecords,
                filters,
                '',
                warehouseData,
                salesRecords,
                products,
                damages,
                activeBaseline,
                returnsList
            );

            (calc.displayRecords || []).forEach(prod => {
                if ((prod.productName || '').trim().toLowerCase() === pNorm) {
                    (prod.brandList || []).forEach(b => {
                        if ((b.brand || '').trim().toLowerCase() === bNorm) {
                            const rawLc = (b.lcNo || '').trim();
                            list.push({
                                warehouse: whName,
                                lcNo: (rawLc === '0000' || rawLc === '-') ? '' : rawLc,
                                rate: b.rate || b.purchasedPrice,
                                openingQuantity: b.openingQuantity || 0,
                                inHouseQuantity: b.inHouseQuantity !== undefined ? b.inHouseQuantity : (b.closingQuantity || 0),
                                closingQuantity: b.closingQuantity !== undefined ? b.closingQuantity : (b.inHouseQuantity || 0),
                                packetSize: b.packetSize || 30
                            });
                        }
                    });
                }
            });
        });

        // Also check active baseline snapshotRecords directly to ensure any baseline record is present
        if (activeBaseline && activeBaseline.status === 'active' && Array.isArray(activeBaseline.snapshotRecords)) {
            activeBaseline.snapshotRecords.forEach(snap => {
                if ((snap.productName || '').trim().toLowerCase() === pNorm && (snap.brand || '').trim().toLowerCase() === bNorm) {
                    const snapWh = (snap.warehouse || '').trim();
                    if (manualFixWarehouse !== 'All' && snapWh.toLowerCase() !== manualFixWarehouse.toLowerCase()) return;
                    const rawSnapLc = (snap.lcNo || '').trim();
                    const snapLc = (rawSnapLc === '0000' || rawSnapLc === '-') ? '' : rawSnapLc;
                    const alreadyExists = list.some(l => l.warehouse.toLowerCase() === snapWh.toLowerCase() && (l.lcNo || '').toLowerCase() === snapLc.toLowerCase());
                    if (!alreadyExists) {
                        list.push({
                            warehouse: snapWh,
                            lcNo: snapLc,
                            rate: snap.rate || snap.purchasedPrice || 0,
                            openingQuantity: snap.quantity || snap.inHouseQuantity || 0,
                            inHouseQuantity: snap.quantity || snap.inHouseQuantity || 0,
                            closingQuantity: snap.quantity || snap.inHouseQuantity || 0,
                            packetSize: snap.packetSize || 30
                        });
                    }
                }
            });
        }

        return list;
    }, [manualFixProduct, manualFixBrand, manualFixWarehouse, warehouseOptions, stockRecords, warehouseData, salesRecords, products, damages, activeBaseline, returnsList]);

    // Currently selected LC Item for Stock Adjustment
    const selectedLcItem = useMemo(() => {
        if (!manualFixProduct || !manualFixBrand) return null;

        const targetLc = (adjustLcNo !== undefined && adjustLcNo !== null ? adjustLcNo : (manualFixFromLc || '')).trim();
        const isTargetBlank = !targetLc || targetLc === '0000' || targetLc === '-';

        if (manualFixWarehouse !== 'All') {
            const matchWh = manualFixLcBreakdown.find(i => {
                const iWh = (i.warehouse || '').toLowerCase() === manualFixWarehouse.toLowerCase();
                const iBlank = !i.lcNo || i.lcNo === '' || i.lcNo === '0000' || i.lcNo === '-';
                if (isTargetBlank) return iWh && iBlank;
                return iWh && (i.lcNo || '').toLowerCase() === targetLc.toLowerCase();
            });
            if (matchWh) return matchWh;
        }

        const matchAny = manualFixLcBreakdown.find(i => {
            const iBlank = !i.lcNo || i.lcNo === '' || i.lcNo === '0000' || i.lcNo === '-';
            if (isTargetBlank) return iBlank;
            return (i.lcNo || '').toLowerCase() === targetLc.toLowerCase();
        });
        if (matchAny) return matchAny;

        if (isTargetBlank) {
            const fallbackWh = (manualFixWarehouse && manualFixWarehouse !== 'All')
                ? manualFixWarehouse
                : (manualFixLcBreakdown[0]?.warehouse || warehouseOptions[0] || 'Hili');
            const targetPkt = manualFixLcBreakdown[0]?.packetSize ||
                products.find(p => (p.name || p.productName || '').trim().toLowerCase() === manualFixProduct.trim().toLowerCase())?.packetSize || 30;
            return {
                warehouse: fallbackWh,
                lcNo: '',
                rate: 0,
                openingQuantity: 0,
                inHouseQuantity: 0,
                closingQuantity: 0,
                packetSize: targetPkt
            };
        }

        return manualFixLcBreakdown[0] || null;
    }, [adjustLcNo, manualFixFromLc, manualFixWarehouse, manualFixLcBreakdown, manualFixProduct, manualFixBrand, warehouseOptions, products]);

    // Keep adjustLcNo in sync with selections
    useEffect(() => {
        if (!adjustLcNo && manualFixFromLc) {
            setAdjustLcNo(manualFixFromLc);
        }
    }, [manualFixFromLc, adjustLcNo]);

    // From LC options
    const manualFixFromLcOptions = useMemo(() => {
        const set = new Set();
        manualFixLcBreakdown.forEach(item => {
            const clean = (item.lcNo || '').trim();
            if (clean && clean !== '0000' && clean !== '-') set.add(clean);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [manualFixLcBreakdown]);

    // Target LC options
    const manualFixTargetLcOptions = useMemo(() => {
        const set = new Set();
        manualFixLcBreakdown.forEach(item => {
            if (item.lcNo && item.lcNo !== '0000' && item.lcNo !== '-') set.add(item.lcNo);
        });
        if (manualFixProduct && manualFixBrand) {
            const pNorm = manualFixProduct.trim().toLowerCase();
            const bNorm = manualFixBrand.trim().toLowerCase();
            (stockRecords || []).forEach(s => {
                if ((s.productName || s.product || '').trim().toLowerCase() === pNorm) {
                    const lc = (s.lcNo || '').trim();
                    if (lc && lc !== '0000' && lc !== '-') {
                        const hasBrand = (s.brand || '').trim().toLowerCase() === bNorm || (s.brandEntries || []).some(b => (b.brand || '').trim().toLowerCase() === bNorm);
                        if (hasBrand) set.add(lc);
                    }
                }
            });
        }
        return Array.from(set);
    }, [manualFixLcBreakdown, manualFixProduct, manualFixBrand, stockRecords]);

    // Auto-select Target LC if available
    useEffect(() => {
        if (manualFixTargetLcOptions.length > 0 && (!manualFixToLc || !manualFixTargetLcOptions.includes(manualFixToLc))) {
            setManualFixToLc(manualFixTargetLcOptions[0]);
        }
    }, [manualFixTargetLcOptions, manualFixToLc]);

    // Matching sales invoices for selected criteria
    const manualFixMatchingInvoices = useMemo(() => {
        if (!manualFixProduct || !manualFixBrand || manualFixFromLc === undefined || manualFixFromLc === null) return [];
        const isPlaceholderLc = (v) => !v || ['0000', '000', '00', '0', '-', '—', '--'].includes(v.toString().trim().toLowerCase());
        const pNorm = manualFixProduct.trim().toLowerCase();
        const bNorm = manualFixBrand.trim().toLowerCase();
        const fromNorm = (manualFixFromLc || '').trim().toLowerCase();
        const isFromZero = fromNorm === '0000' || isPlaceholderLc(fromNorm) || fromNorm === '';
        const whFilterNorm = manualFixWarehouse !== 'All' ? manualFixWarehouse.trim().toLowerCase() : null;

        const results = [];
        (salesRecords || []).forEach(sale => {
            const inv = (sale.invoiceNo || sale.orderNo || '').trim().toUpperCase();
            const sType = (sale.saleType || '').toLowerCase();
            if (sType === 'order' || inv.startsWith('ORD') || sale.isOrderEntry === true) return;

            (sale.items || []).forEach(item => {
                if ((item.productName || item.product || '').trim().toLowerCase() !== pNorm) return;

                if (Array.isArray(item.brandEntries) && item.brandEntries.length > 0) {
                    item.brandEntries.forEach(be => {
                        if ((be.brand || item.brand || '').trim().toLowerCase() !== bNorm) return;
                        const wh = (be.warehouse || item.warehouse || sale.warehouse || '').trim();
                        if (whFilterNorm && wh && wh.toLowerCase() !== whFilterNorm) return;

                        const curLc = (be.lcNo || item.lcNo || '').trim();
                        const isMatch = isFromZero ? (isPlaceholderLc(curLc) || curLc === '0000' || curLc === '') : curLc.toLowerCase() === fromNorm;
                        if (isMatch) {
                            results.push({
                                saleId: sale._id,
                                invoiceNo: inv,
                                date: sale.date || sale.createdAt,
                                customer: sale.customerName || sale.customer || item.customerName || 'N/A',
                                warehouse: wh || 'Hili',
                                quantity: parseFloat(be.quantity || be.qty) || 0,
                                packet: be.packet || 0,
                                lcNo: curLc || ''
                            });
                        }
                    });
                } else {
                    if ((item.brand || '').trim().toLowerCase() !== bNorm) return;
                    const wh = (item.warehouse || sale.warehouse || '').trim();
                    if (whFilterNorm && wh && wh.toLowerCase() !== whFilterNorm) return;

                    const curLc = (item.lcNo || '').trim();
                    const isMatch = isFromZero ? (isPlaceholderLc(curLc) || curLc === '0000' || curLc === '') : curLc.toLowerCase() === fromNorm;
                    if (isMatch) {
                        results.push({
                            saleId: sale._id,
                            invoiceNo: inv,
                            date: sale.date || sale.createdAt,
                            customer: sale.customerName || sale.customer || item.customerName || 'N/A',
                            warehouse: wh || 'Hili',
                            quantity: parseFloat(item.quantity || item.qty) || 0,
                            packet: item.packet || 0,
                            lcNo: curLc || ''
                        });
                    }
                }
            });
        });
        return results;
    }, [manualFixProduct, manualFixBrand, manualFixFromLc, manualFixWarehouse, salesRecords]);

    const handleManualFixReassign = async () => {
        if (!manualFixToLc || !manualFixToLc.trim()) {
            setAdjustFeedback({ type: 'error', message: 'Please select or enter a Target LC No.' });
            return;
        }
        if (selectedFixInvoices.size === 0) {
            setAdjustFeedback({ type: 'error', message: 'Please select at least one sales invoice to reassign.' });
            return;
        }

        const selectedList = Array.from(selectedFixInvoices);
        const totalQty = manualFixMatchingInvoices
            .filter(inv => selectedFixInvoices.has(inv.invoiceNo))
            .reduce((sum, inv) => sum + inv.quantity, 0);

        setConfirmAction({
            title: 'Confirm Sales LC Fix & Reassignment',
            message: `• Product: ${manualFixProduct}\n• Brand: ${manualFixBrand}\n• Target LC: ${manualFixToLc.trim()}\n• Selected Invoices: ${selectedList.length} (${totalQty.toLocaleString('en-US')} kg)\n\nThis will reassign these sales from LC ${manualFixFromLc} to LC ${manualFixToLc.trim()}.\nZero Effect on LC Receive: It will NOT affect your original LC Receive or port arrival records.`,
            confirmText: `Yes, Reassign to LC ${manualFixToLc.trim()}`,
            onConfirm: async () => {
                setManualFixLoading(true);
                try {
                    const res = await axios.post(`${API_BASE_URL}/api/sales/reassign-lc`, {
                        productName: manualFixProduct,
                        brand: manualFixBrand,
                        warehouse: manualFixWarehouse,
                        fromLc: manualFixFromLc,
                        toLc: manualFixToLc.trim(),
                        invoiceNos: selectedList
                    });

                    setSelectedFixInvoices(new Set());
                    if (typeof fetchSales === 'function') fetchSales();
                    if (typeof fetchStockRecords === 'function') fetchStockRecords();
                    setAdjustFeedback({
                        type: 'success',
                        message: res.data?.message || 'Sales records updated successfully!'
                    });
                } catch (err) {
                    console.error('Error in manual LC fix:', err);
                    setAdjustFeedback({
                        type: 'error',
                        message: err.response?.data?.message || err.message || 'Failed to reassign sales LC.'
                    });
                } finally {
                    setManualFixLoading(false);
                }
            }
        });
    };

    const handleApplyStockAdjustment = async (overrideParams = null, skipConfirm = false) => {
        const targetItem = overrideParams?.item || selectedLcItem;
        if (!targetItem) {
            setAdjustFeedback({ type: 'error', message: 'Please select a product and brand to adjust.' });
            return;
        }

        const mode = overrideParams?.mode || adjustMode;
        const rawTargetLc = (overrideParams?.lcNo !== undefined ? overrideParams.lcNo : (targetItem?.lcNo !== undefined ? targetItem.lcNo : (adjustLcNo || ''))).trim();
        const isTargetBlank = !rawTargetLc || rawTargetLc === '0000' || rawTargetLc === '-';
        const targetLc = isTargetBlank ? '' : rawTargetLc;
        const displayLc = isTargetBlank ? 'Blank / No LC' : targetLc;
        const curClosing = targetItem.closingQuantity !== undefined ? targetItem.closingQuantity : (targetItem.inHouseQuantity || 0);
        const pktSize = targetItem.packetSize || 30;

        let amountKg = 0;
        let resultingQty = 0;

        if (overrideParams?.targetQuantity !== undefined) {
            resultingQty = parseFloat(overrideParams.targetQuantity);
            amountKg = Math.abs(resultingQty - curClosing);
        } else {
            const rawAmount = parseFloat(adjustAmount);
            if (isNaN(rawAmount) || rawAmount < 0) {
                setAdjustFeedback({ type: 'error', message: 'Please enter a valid positive quantity.' });
                return;
            }
            amountKg = adjustUnit === 'bag' ? rawAmount * pktSize : rawAmount;
            if (mode === 'add') {
                resultingQty = curClosing + amountKg;
            } else if (mode === 'reduce') {
                resultingQty = curClosing - amountKg;
            } else { // 'set'
                resultingQty = amountKg;
            }
        }

        const curBags = calculatePktRemainder(curClosing, pktSize);
        const newBags = calculatePktRemainder(resultingQty, pktSize);

        const actionText = mode === 'add'
            ? `Add ${amountKg.toLocaleString()} kg (+${(amountKg / pktSize).toFixed(1)} bags)`
            : (mode === 'reduce'
                ? `Reduce ${amountKg.toLocaleString()} kg (-${(amountKg / pktSize).toFixed(1)} bags)`
                : `Set exact stock to ${resultingQty.toLocaleString()} kg (${newBags.whole} bags)`);

        const executeAdjustment = async () => {
            setIsAdjustingStock(true);
            setAdjustFeedback(null);
            try {
                const res = await axios.post(`${API_BASE_URL}/api/stock-baseline/adjust-opening`, {
                    warehouse: targetItem.warehouse,
                    productName: manualFixProduct,
                    brand: manualFixBrand,
                    lcNo: targetLc,
                    mode: mode,
                    adjustQuantity: amountKg,
                    targetQuantity: resultingQty,
                    currentClosingQuantity: curClosing,
                    packetSize: pktSize,
                    note: adjustNote || overrideParams?.note || 'Manual physical stock adjustment'
                });

                if (typeof fetchStockRecords === 'function') await fetchStockRecords();
                if (typeof fetchStockBaseline === 'function') await fetchStockBaseline();

                setAdjustAmount('');
                setAdjustNote('');
                setAdjustFeedback({
                    type: 'success',
                    message: res.data?.message || `Successfully adjusted stock${isTargetBlank ? ' (Blank / No LC)' : ` for LC ${targetLc}`} in ${targetItem.warehouse}! New closing: ${resultingQty.toLocaleString()} kg (${newBags.whole} bags). LC Receive was NOT affected.`
                });
            } catch (err) {
                console.error('Error in stock adjustment:', err);
                setAdjustFeedback({
                    type: 'error',
                    message: err.response?.data?.message || err.message || 'Failed to adjust stock'
                });
            } finally {
                setIsAdjustingStock(false);
            }
        };

        if (skipConfirm) {
            await executeAdjustment();
            return;
        }

        setConfirmAction({
            title: 'Confirm Stock Adjustment',
            message: `• Warehouse: ${targetItem.warehouse}\n• Product: ${manualFixProduct} • Brand: ${manualFixBrand}\n• LC No: ${displayLc}\n• Current Stock: ${curClosing.toLocaleString()} kg (${curBags.whole} bags)\n• Action: ${actionText}\n• Resulting Stock: ${resultingQty.toLocaleString()} kg (${newBags.whole} bags)\n\nZero Effect on LC Receive: This adjusts stock inventory without touching your original import or LC receive records.`,
            confirmText: 'Yes, Apply Adjustment',
            onConfirm: executeAdjustment
        });
    };

    const handleReassignPlaceholderLc = async (groupItem) => {
        if (!groupItem.targetLc) {
            setAdjustFeedback({ type: 'error', message: 'No target genuine LC found for reassignment.' });
            return;
        }

        setConfirmAction({
            title: 'Confirm Placeholder Reassignment',
            message: `Permanently update all ${groupItem.count} sales records (${groupItem.totalPlaceholderQty.toLocaleString('en-US')} kg) of ${groupItem.productName} - ${groupItem.brand} in ${groupItem.warehouse} from placeholder LC '0000' to genuine LC '${groupItem.targetLc}' in the database?\n\nZero Effect on LC Receive: It will NOT affect your original LC Receive documents.`,
            confirmText: `Yes, Reassign to LC ${groupItem.targetLc}`,
            onConfirm: async () => {
                setManualFixLoading(true);
                try {
                    const res = await axios.post(`${API_BASE_URL}/api/sales/reassign-lc`, {
                        productName: groupItem.productName,
                        brand: groupItem.brand,
                        warehouse: groupItem.warehouse,
                        fromLc: '0000',
                        toLc: groupItem.targetLc
                    });
                    if (typeof fetchSales === 'function') fetchSales();
                    if (typeof fetchStockRecords === 'function') fetchStockRecords();
                    setAdjustFeedback({
                        type: 'success',
                        message: res.data?.message || 'Sales records updated successfully.'
                    });
                } catch (err) {
                    console.error('Error reassigning LC:', err);
                    setAdjustFeedback({
                        type: 'error',
                        message: err.response?.data?.message || err.message || 'Failed to reassign LC.'
                    });
                } finally {
                    setManualFixLoading(false);
                }
            }
        });
    };

    const hasAnyDisplayRecords = useMemo(() => {
        return multiWarehouseData.some(whItem => {
            return (whItem.data?.displayRecords || []).some(group => {
                const matchesExpanded = !expandedProducts || expandedProducts === `${whItem.warehouseName}_${group.productName}` || expandedProducts === group.productName;
                const matchesRate = !effectiveShowRate || (group.brandList && group.brandList.some(b => Math.abs(b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001 || Math.abs(b.closingQuantity || 0) > 0.001));
                return matchesExpanded && matchesRate;
            });
        });
    }, [multiWarehouseData, expandedProducts, effectiveShowRate]);

    // Function to calculate raw in-house snapshot across all warehouses for baseline
    const generateCurrentStockSnapshot = () => {
        const whSet = new Set();
        (warehouseData || []).forEach(w => {
            const name = (w.name || w.whName || w.warehouse || w.fromWh || w.toWh || '').trim();
            if (name && name !== 'Inventory Adjustment') whSet.add(name);
        });
        (stockRecords || []).forEach(s => {
            const name = (s.name || s.whName || s.warehouse || '').trim();
            if (name && name !== 'Inventory Adjustment') whSet.add(name);
        });
        const whList = Array.from(whSet).sort();

        const snapshot = [];
        let totalInHouseBags = 0;
        let totalInHouseKg = 0;
        let totalStockValuation = 0;

        whList.forEach(whName => {
            const whRes = calculateStockData(
                stockRecords,
                { warehouse: whName, reportType: 'price', _isSubCall: true },
                '',
                warehouseData,
                salesRecords,
                products,
                damages,
                activeBaseline, // Carry forward active baseline calculations so current verified physical stock is captured!
                returnsList
            );

            (whRes.displayRecords || []).forEach(prod => {
                (prod.brandList || []).forEach(b => {
                    const inHouseQty = Math.max(0, b.inHouseQuantity || 0);
                    const inHousePkt = Math.max(0, b.inHousePacket || 0);
                    if (inHouseQty > 0.0001 || inHousePkt > 0.0001) {
                        const price = safeParse(b.purchasedPrice ?? b.rate);
                        const valuation = inHouseQty * price;

                        totalInHouseBags += inHousePkt;
                        totalInHouseKg += inHouseQty;
                        totalStockValuation += valuation;

                        snapshot.push({
                            warehouse: whName,
                            productName: prod.productName,
                            brand: b.brand || 'No Brand',
                            quality: b.quality || '-',
                            packetSize: b.packetSize || 30,
                            inHouseQuantity: inHouseQty,
                            inHousePacket: inHousePkt,
                            quantity: inHouseQty,
                            packet: inHousePkt,
                            purchasedPrice: price,
                            rate: price,
                            lcNo: b.lcNo || (b.lcNos && b.lcNos[0]) || '',
                            unit: prod.unit || 'kg'
                        });
                    }
                });
            });
        });

        return {
            snapshotRecords: snapshot,
            summary: {
                totalWarehouses: whList.length,
                totalProducts: new Set(snapshot.map(s => s.productName)).size,
                totalBrands: new Set(snapshot.map(s => `${s.productName}|${s.brand}`)).size,
                totalInHouseQuantity: totalInHouseKg,
                totalInHousePacket: totalInHouseBags,
                totalValuation: totalStockValuation
            }
        };
    };

    const fetchBaselineHistory = async () => {
        const cached = queryClient.getQueryData(['stock-baseline-history']);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            setBaselineHistory(cached);
        }
        try {
            const data = await queryClient.fetchQuery({
                queryKey: ['stock-baseline-history'],
                queryFn: () => axios.get(`${API_BASE_URL}/api/stock-baseline/history`).then(r => Array.isArray(r.data) ? r.data : [])
            });
            setBaselineHistory(data);
        } catch (err) {
            console.error('Error fetching baseline history:', err);
        }
    };

    const handleSetBaseline = async (e) => {
        if (e) e.preventDefault();
        if (baselineConfirmText.trim().toUpperCase() !== 'CONFIRM') {
            setAdjustFeedback({ type: 'error', message: 'Please type "CONFIRM" to establish the new initial stock baseline.' });
            return;
        }

        const { snapshotRecords, summary } = generateCurrentStockSnapshot();
        if (!snapshotRecords || snapshotRecords.length === 0) {
            setAdjustFeedback({ type: 'error', message: 'Cannot set initial baseline: No valid in-house stock records found.' });
            return;
        }

        const baselineIso = (baselineCutoffDate && !isNaN(new Date(baselineCutoffDate).getTime()))
            ? new Date(baselineCutoffDate).toISOString()
            : new Date().toISOString();

        setBaselineLoading(true);
        try {
            await axios.post(`${API_BASE_URL}/api/stock-baseline`, {
                baselineDate: baselineIso,
                note: baselineNote.trim() || 'Initial Stock Baseline',
                setBy: currentUser.name || currentUser.username || 'Admin',
                summary,
                snapshotRecords
            });

            queryClient.invalidateQueries({ queryKey: ['stock-baseline'] });
            queryClient.invalidateQueries({ queryKey: ['stock-baseline-history'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });

            if (typeof fetchStockBaseline === 'function') fetchStockBaseline();
            if (typeof fetchStockRecords === 'function') fetchStockRecords();

            setBaselineConfirmText('');
            setAdjustFeedback({
                type: 'success',
                message: 'Initial Stock Baseline established successfully! An automated safety backup was created on the server.'
            });
        } catch (err) {
            console.error('Error setting initial baseline:', err);
            setAdjustFeedback({
                type: 'error',
                message: err.response?.data?.message || err.message || 'Failed to set initial stock baseline.'
            });
        } finally {
            setBaselineLoading(false);
        }
    };

    const handleRevertBaseline = async (baselineId) => {
        setConfirmAction({
            title: 'Confirm Baseline Revert',
            message: 'Are you sure you want to revert this stock baseline? Stock calculations will return to full historical mode.',
            confirmText: 'Yes, Revert Baseline',
            type: 'danger',
            onConfirm: async () => {
                setBaselineLoading(true);
                try {
                    await axios.post(`${API_BASE_URL}/api/stock-baseline/${baselineId}/revert`);
                    queryClient.invalidateQueries({ queryKey: ['stock-baseline'] });
                    queryClient.invalidateQueries({ queryKey: ['stock-baseline-history'] });
                    queryClient.invalidateQueries({ queryKey: ['stock'] });

                    if (typeof fetchStockBaseline === 'function') fetchStockBaseline();
                    if (typeof fetchStockRecords === 'function') fetchStockRecords();
                    fetchBaselineHistory();
                    setAdjustFeedback({
                        type: 'success',
                        message: 'Stock baseline reverted successfully!'
                    });
                } catch (err) {
                    console.error('Error reverting baseline:', err);
                    setAdjustFeedback({
                        type: 'error',
                        message: err.response?.data?.message || err.message || 'Failed to revert stock baseline.'
                    });
                } finally {
                    setBaselineLoading(false);
                }
            }
        });
    };

    const handleActivateBaseline = async (baselineId) => {
        setConfirmAction({
            title: 'Confirm Activate Baseline',
            message: 'Are you sure you want to activate this stock baseline?',
            confirmText: 'Yes, Activate Baseline',
            onConfirm: async () => {
                setBaselineLoading(true);
                try {
                    await axios.post(`${API_BASE_URL}/api/stock-baseline/${baselineId}/activate`);
                    queryClient.invalidateQueries({ queryKey: ['stock-baseline'] });
                    queryClient.invalidateQueries({ queryKey: ['stock-baseline-history'] });
                    queryClient.invalidateQueries({ queryKey: ['stock'] });

                    if (typeof fetchStockBaseline === 'function') fetchStockBaseline();
                    if (typeof fetchStockRecords === 'function') fetchStockRecords();
                    await fetchBaselineHistory();
                    setAdjustFeedback({
                        type: 'success',
                        message: 'Stock baseline activated successfully!'
                    });
                } catch (err) {
                    console.error('Error activating baseline:', err);
                    setAdjustFeedback({
                        type: 'error',
                        message: err.response?.data?.message || err.message || 'Failed to activate stock baseline.'
                    });
                } finally {
                    setBaselineLoading(false);
                }
            }
        });
    };

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
        totalQuantity,
        totalOpeningPktWhole,
        totalOpeningPktRemainder,
        totalInHousePktWhole,
        totalInHousePktDecimalKg,
        totalInHouseQty,
        totalSalePktWhole,
        totalSaleQty,
        totalSalePktDecimalKg,
        totalShortage,
        totalDamageQty,
        unit
    } = stockData;

    const minWidthClass = effectiveShowRate
        ? (displayUnit === 'BOTH' ? 'min-w-[1300px]' : 'min-w-[1000px]')
        : (displayUnit === 'BOTH' ? 'min-w-[1200px]' : 'min-w-[900px]');

    const gridClass = effectiveShowRate
        ? (displayUnit === 'BOTH'
            ? "grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_repeat(6,minmax(0,1fr))_minmax(0,0.9fr)] gap-2"
            : "grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1fr)_repeat(3,minmax(0,1fr))_minmax(0,0.9fr)] gap-3")
        : displayUnit === 'BOTH'
            ? "grid grid-cols-[minmax(0,1.8fr)_repeat(10,minmax(0,1fr))_minmax(0,0.9fr)] gap-2"
            : "grid grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))_minmax(0,0.9fr)] gap-3";

    return (
        <div className="stock-management-container space-y-6">
            {(!showStockForm && !showAddWarehouseStockForm) && (
                <>
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="w-full md:w-1/4">
                            <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center md:text-left">Stock Management</h2>
                        </div>

                        <div className="w-full md:flex-1 max-w-none md:max-w-lg mx-auto flex items-center gap-3">
                            <div className="relative flex-1 group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search by LC No, Product or Brand..."
                                    value={stockSearchQuery}
                                    onChange={(e) => setStockSearchQuery(e.target.value)}
                                    className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                />
                            </div>
                            {canShowRate && (
                                <label className="flex items-center gap-2 cursor-pointer select-none bg-white border border-gray-200 px-3.5 py-2 rounded-xl hover:bg-gray-50 transition-all shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={showRate}
                                        onChange={(e) => setShowRate(e.target.checked)}
                                        className="w-4 h-4 rounded-full text-blue-600 focus:ring-blue-500/20 border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-[13px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Show Rate</span>
                                </label>
                            )}
                        </div>

                        <div className="w-full md:w-1/4 flex max-md:flex-wrap items-center justify-between md:justify-end gap-2">
                            <div className="relative flex-1 md:flex-none max-md:min-w-[calc(50%-4px)]">
                                <button
                                    ref={stockFilterButtonRef}
                                    onClick={() => setShowStockFilterPanel(!showStockFilterPanel)}
                                    className={`w-full flex justify-center items-center gap-2 px-4 py-2 rounded-xl transition-all border ${showStockFilterPanel || Object.values(stockFilters).some(v => Array.isArray(v) ? v.length > 0 : v !== '')
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <FunnelIcon className={`w-4 h-4 ${showStockFilterPanel || Object.values(stockFilters).some(v => Array.isArray(v) ? v.length > 0 : v !== '') ? 'text-white' : 'text-gray-400'}`} />
                                    <span className="text-sm font-medium">Filter</span>
                                </button>

                                {showStockFilterPanel && (
                                    <>
                                        {/* Backdrop for mobile */}
                                        <div
                                            className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]"
                                            onClick={() => setShowStockFilterPanel(false)}
                                        />
                                        <div ref={stockFilterRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 md:w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200 mb-4">
                                            <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                                                <h4 className="font-bold text-gray-900 tracking-tight">Advance Filter</h4>
                                                <button onClick={() => {
                                                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                                                    const today = new Date().toISOString().split('T')[0];
                                                    setStockFilters({ startDate: yesterday, endDate: today, warehouse: 'All Warehouses', brand: [], importer: '', productName: [] });
                                                    setFilterSearchInputs({ warehouseSearch: '', importerSearch: '', brandSearch: '', productSearch: '' });
                                                    setShowStockFilterPanel(false);
                                                }} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">RESET ALL</button>
                                            </div>
                                            <div className="space-y-4">
                                                {/* Show Unit Toggle (BAG | QTY | BOTH) */}
                                                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                                    <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">SHOW UNIT</span>
                                                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDisplayUnit('BAG')}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${displayUnit === 'BAG' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                        >
                                                            BAG
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDisplayUnit('QTY')}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${displayUnit === 'QTY' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                        >
                                                            QTY
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDisplayUnit('BOTH')}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${displayUnit === 'BOTH' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                                                        >
                                                            BOTH
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <CustomDatePicker label="From Date" value={stockFilters.startDate} onChange={(e) => setStockFilters({ ...stockFilters, startDate: e.target.value })} compact={true} />
                                                    <CustomDatePicker label="To Date" value={stockFilters.endDate} onChange={(e) => setStockFilters({ ...stockFilters, endDate: e.target.value })} compact={true} rightAlign={true} />
                                                </div>

                                                {/* Warehouse Filter */}
                                                <div className="space-y-1.5 relative col-span-2" ref={stockWarehouseFilterRef}>
                                                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">WAREHOUSE</label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={filterSearchInputs.warehouseSearch}
                                                            onChange={(e) => {
                                                                setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: e.target.value });
                                                                setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true });
                                                            }}
                                                            onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true })}
                                                            placeholder={stockFilters.warehouse || "Search Warehouse..."}
                                                            className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${stockFilters.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                        />
                                                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            {stockFilters.warehouse && (
                                                                <button onClick={() => { setStockFilters({ ...stockFilters, warehouse: '' }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="text-gray-400 hover:text-gray-600">
                                                                    <XIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                            <SearchIcon className="w-4.5 h-4.5 text-gray-300 pointer-events-none" />
                                                        </div>
                                                    </div>
                                                    {filterDropdownOpen.warehouse && (() => {
                                                        const options = ["All Warehouses", ...warehouseOptions];
                                                        const filtered = options.filter(wh => wh.toLowerCase().includes(filterSearchInputs.warehouseSearch.toLowerCase()));
                                                        return filtered.length > 0 ? (
                                                            <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                {filtered.map(wh => (
                                                                    <button
                                                                        key={wh}
                                                                        type="button"
                                                                        onClick={() => { setStockFilters({ ...stockFilters, warehouse: wh }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }}
                                                                        className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                                                    >
                                                                        {wh}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-1.5 relative" ref={stockProductFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Product Name</label>
                                                        {selectedProductsList.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mb-1.5 pl-1 max-h-24 overflow-y-auto">
                                                                {selectedProductsList.map(prod => (
                                                                    <span key={prod} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100">
                                                                        {prod}
                                                                        <button type="button" onClick={() => handleToggleProduct(prod)} className="text-blue-500 hover:text-blue-700">
                                                                            <XIcon className="w-3 h-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.productSearch}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFilterSearchInputs({ ...filterSearchInputs, productSearch: val });
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, productName: true });
                                                                }}
                                                                onClick={() => {
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, productName: !filterDropdownOpen.productName });
                                                                }}
                                                                placeholder="Search Product..."
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm ${selectedProductsList.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                                                {selectedProductsList.length > 0 ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            setStockFilters({ ...stockFilters, productName: [], brand: [] });
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
                                                                            onClick={() => {
                                                                                handleToggleProduct(product.name);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                                        >
                                                                            <span>{product.name}</span>
                                                                            {selectedProductsList.includes(product.name) ? (
                                                                                <span className="w-4 h-4 flex items-center justify-center bg-blue-600 rounded text-white text-[10px] font-bold">✓</span>
                                                                            ) : (
                                                                                <span className="w-4 h-4 rounded border border-gray-300" />
                                                                            )}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>

                                                    <div className="space-y-1.5 relative" ref={stockBrandFilterRef}>
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Brand</label>
                                                        {selectedBrandsList.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mb-1.5 pl-1 max-h-24 overflow-y-auto">
                                                                {selectedBrandsList.map(brand => (
                                                                    <span key={brand} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-100">
                                                                        {brand}
                                                                        <button type="button" onClick={() => handleToggleBrand(brand)} className="text-blue-500 hover:text-blue-700">
                                                                            <XIcon className="w-3 h-3" />
                                                                        </button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={filterSearchInputs.brandSearch}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFilterSearchInputs({ ...filterSearchInputs, brandSearch: val });
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                                }}
                                                                onClick={() => {
                                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, brand: !filterDropdownOpen.brand });
                                                                }}
                                                                placeholder="Search Brand..."
                                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm ${selectedBrandsList.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                disabled={selectedProductsList.length === 0}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                                                {selectedBrandsList.length > 0 ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            setStockFilters({ ...stockFilters, brand: [] });
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
                                                                            onClick={() => {
                                                                                handleToggleBrand(brand);
                                                                            }}
                                                                            className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                                                        >
                                                                            <span>{brand}</span>
                                                                            {selectedBrandsList.includes(brand) ? (
                                                                                <span className="w-4 h-4 flex items-center justify-center bg-blue-600 rounded text-white text-[10px] font-bold">✓</span>
                                                                            ) : (
                                                                                <span className="w-4 h-4 rounded border border-gray-300" />
                                                                            )}
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
                                className="flex-1 md:flex-none max-md:min-w-[calc(50%-4px)] flex items-center justify-center gap-2 px-3 py-2 md:px-4 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 text-sm font-medium"
                            >
                                <BarChartIcon className="w-4 h-4 text-gray-400" />
                                <span>Report</span>
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => {
                                        setShowBaselineModal(true);
                                        setBaselineTab(activeBaseline ? 'adjust' : 'preview');
                                        setBaselineConfirmText('');
                                        setBaselineCutoffDate(getLocalDatetimeInputValue());
                                        fetchBaselineHistory();
                                    }}
                                    className={`flex-1 md:flex-none max-md:min-w-[calc(50%-4px)] flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 border ${activeBaseline
                                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                        }`}
                                    title={activeBaseline ? "Stock Baseline & Adjustment. Admin access only." : "Snapshot Day 1 Initial Stage & Stock Adjustment. Admin access only."}
                                >
                                    <span className={`w-2.5 h-2.5 rounded-full ${activeBaseline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                    <span>{activeBaseline ? 'Baseline Active' : 'Set Initial Stage'}</span>
                                </button>
                            )}
                            {canTransfer && (
                                <button
                                    onClick={() => setShowAddWarehouseStockForm(true)}
                                    className="flex-1 md:flex-none max-md:min-w-[calc(50%-4px)] flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg shadow-blue-500/20 active:scale-95 font-bold text-sm max-md:whitespace-nowrap"
                                >
                                    <PlusIcon className="w-5 h-5 text-white/90" />
                                    <span>Transfer</span>
                                </button>
                            )}
                        </div>
                    </div>
                    {/* Summary Cards */}
                    <div className={`grid grid-cols-2 ${displayUnit === 'BOTH' ? 'md:grid-cols-4 lg:grid-cols-8' : (displayUnit === 'BAG' ? 'md:grid-cols-3 lg:grid-cols-3' : 'md:grid-cols-3 lg:grid-cols-5')} gap-3 md:gap-4 mb-6`}>
                        {[
                            {
                                label: 'TOTAL BAG',
                                show: showBag,
                                value: `${(totalOpeningPktWhole || 0).toLocaleString('en-US')}`,
                                bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600'
                            },
                            {
                                label: 'TOTAL QUANTITY',
                                show: showQty,
                                value: `${Math.round(totalQuantity || 0).toLocaleString('en-US')} ${unit}`,
                                bgColor: 'bg-blue-50/50', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600'
                            },
                            {
                                label: 'TOTAL SALE BAG',
                                show: showBag,
                                value: `${(totalSalePktWhole || 0).toLocaleString('en-IN')} - ${(totalSalePktDecimalKg || 0).toLocaleString('en-IN')} ${unit}`,
                                bgColor: 'bg-orange-50/50', borderColor: 'border-orange-100', textColor: 'text-orange-700', labelColor: 'text-orange-600'
                            },
                            {
                                label: 'TOTAL SALE QTY',
                                show: showQty,
                                value: `${Math.round(totalSaleQty || 0).toLocaleString('en-US')} ${unit}`,
                                bgColor: 'bg-orange-50/50', borderColor: 'border-orange-100', textColor: 'text-orange-700', labelColor: 'text-orange-600'
                            },
                            {
                                label: 'INHOUSE BAG',
                                show: showBag,
                                value: `${(totalInHousePktWhole || 0).toLocaleString('en-US')} - ${Math.round(totalInHousePktDecimalKg || 0).toLocaleString('en-US')} ${unit}`,
                                bgColor: (totalInHouseQty || 0) < 0 ? 'bg-blue-50/50' : 'bg-emerald-50/50',
                                borderColor: (totalInHouseQty || 0) < 0 ? 'border-blue-100' : 'border-emerald-100',
                                textColor: (totalInHouseQty || 0) < 0 ? 'text-blue-700' : 'text-emerald-700',
                                labelColor: (totalInHouseQty || 0) < 0 ? 'text-blue-600' : 'text-emerald-600'
                            },
                            {
                                label: 'INHOUSE QTY',
                                show: showQty,
                                value: `${Math.round(totalInHouseQty || 0).toLocaleString('en-US')} ${unit}`,
                                bgColor: (totalInHouseQty || 0) < 0 ? 'bg-blue-50/50' : 'bg-emerald-50/50',
                                borderColor: (totalInHouseQty || 0) < 0 ? 'border-blue-100' : 'border-emerald-100',
                                textColor: (totalInHouseQty || 0) < 0 ? 'text-blue-700' : 'text-emerald-700',
                                labelColor: (totalInHouseQty || 0) < 0 ? 'text-blue-600' : 'text-emerald-600'
                            },
                            {
                                label: 'SHORTAGE',
                                show: showQty,
                                value: `${Math.round(totalShortage || 0).toLocaleString('en-IN')} ${unit}`,
                                bgColor: 'bg-rose-50/50', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600'
                            },
                            {
                                label: 'DAMAGE',
                                show: showQty,
                                value: `${Math.round(totalDamageQty || 0).toLocaleString('en-IN')} ${unit}`,
                                bgColor: 'bg-red-50/50', borderColor: 'border-red-100', textColor: 'text-red-700', labelColor: 'text-red-600'
                            },
                        ].filter(card => card.show).map((card, i) => (
                            <div key={i} className={`bg-white border ${card.bgColor} ${card.borderColor} p-3 md:p-4 rounded-2xl shadow-sm transition-all hover:shadow-md hover:scale-[1.02] flex flex-col justify-between h-full`}>
                                <div className={`text-[10px] md:text-[11px] font-bold ${card.labelColor} uppercase tracking-wider mb-1 whitespace-nowrap`}>{card.label}</div>
                                <div>
                                    <div className={`text-sm md:text-lg font-black ${card.textColor} truncate leading-tight`} title={card.value}>{card.value}</div>
                                    <div className="text-[10px] md:text-xs text-gray-400 font-bold mt-0.5">{card.subValue}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Add Stock to Warehouse Form Card */}
            {showAddWarehouseStockForm && (
                <div className="warehouse-form-container border-blue-100 mb-6" style={{ maxWidth: '1300px' }}>

                    <div className="warehouse-form-header">
                        <div>
                            <h3 className="warehouse-form-title">Transfer Product to Warehouse</h3>
                            <p className="text-[12px] md:text-sm text-gray-500">Record a new stock transfer or direct entry to warehouse</p>
                        </div>
                        <button onClick={() => setShowAddWarehouseStockForm(false)} className="warehouse-form-close hover:bg-blue-50 hover:text-blue-600">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleAddWarehouseStockSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="relative z-10 space-y-6"
                    >
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
                                            <div className="hidden lg:grid grid-cols-10 gap-4 px-3 mb-1 pr-[88px]">
                                                <div className="col-span-2 text-xs font-bold text-gray-400 uppercase tracking-wider">LC No</div>
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
                                                    <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-10 gap-4 items-center">
                                                        <div className="lg:col-span-2 relative" ref={el => whLcDropdownRefs.current[`${pIndex}-${bIndex}`] = el}>
                                                            <label className="block lg:hidden text-xs font-bold text-gray-500 mb-1">LC No</label>
                                                            <input
                                                                type="text"
                                                                name="lcNo"
                                                                value={brandEntry.lcNo || ''}
                                                                onChange={(e) => handleAddWarehouseStockInputChange(e, pIndex, bIndex)}
                                                                onFocus={() => {
                                                                    setActiveWhProductIndex(pIndex);
                                                                    setActiveWhBrandIndex(bIndex);
                                                                    setShowWhLcDropdown(true);
                                                                }}
                                                                placeholder="LC No"
                                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-semibold"
                                                                autoComplete="off"
                                                                disabled={!product.productName}
                                                            />
                                                            {showWhLcDropdown && activeWhProductIndex === pIndex && activeWhBrandIndex === bIndex && product.productName && (
                                                                <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
                                                                    <div className="max-h-60 overflow-y-auto py-1">
                                                                        {availableLcs
                                                                            .filter(lc => lc.toLowerCase().includes((brandEntry.lcNo || '').toLowerCase()))
                                                                            .map((lc, lcIdx) => (
                                                                                <button
                                                                                    key={lcIdx}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const fakeEvent = { target: { name: 'lcNo', value: lc } };
                                                                                        handleAddWarehouseStockInputChange(fakeEvent, pIndex, bIndex);
                                                                                        setShowWhLcDropdown(false);
                                                                                    }}
                                                                                    className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                                                >
                                                                                    <div className="font-bold text-gray-900 text-xs group-hover:text-blue-700 whitespace-nowrap">{lc}</div>
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
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
                <>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                        {/* Mobile View: Cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {!hasAnyDisplayRecords ? (
                                <div className="p-8 text-center text-gray-400 font-medium italic">No stock records found</div>
                            ) : (
                                multiWarehouseData.map((whItem, whIdx) => {
                                    const warehouseRecords = (whItem.data?.displayRecords || [])
                                        .filter(group => !expandedProducts || expandedProducts === `${whItem.warehouseName}_${group.productName}` || expandedProducts === group.productName)
                                        .filter(group => !effectiveShowRate || (group.brandList && group.brandList.some(b => Math.abs(b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001 || Math.abs(b.closingQuantity || 0) > 0.001)));

                                    if (warehouseRecords.length === 0) return null;

                                    return (
                                        <div key={whItem.warehouseName || whIdx} className="divide-y divide-gray-100">
                                            <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-blue-50/70 px-4 py-2.5 border-y border-blue-100 flex items-center justify-center sticky top-0 z-10">
                                                <span className="inline-flex items-center px-4 py-1 rounded-lg text-xs font-black tracking-wider bg-blue-600 text-white shadow-sm">
                                                    Warehouse - {formatWarehouseName(whItem.warehouseName)}
                                                </span>
                                            </div>

                                            {warehouseRecords.map((group, gIdx) => {
                                                const productKey = `${whItem.warehouseName}_${group.productName}`;
                                                const isExpanded = expandedProducts === productKey || expandedProducts === group.productName;
                                                const effectiveBrandList = effectiveShowRate
                                                    ? group.brandList.filter(b => Math.abs(b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001 || Math.abs(b.closingQuantity || 0) > 0.001)
                                                    : group.brandList;

                                                return (
                                                    <div key={productKey} className="p-4 space-y-4 hover:bg-gray-50/50 transition-colors">
                                                        <div
                                                            className="w-full cursor-pointer select-none space-y-2.5"
                                                            onClick={() => toggleProductExpansion(productKey)}
                                                        >
                                                            <div className="flex justify-between items-center w-full">
                                                                <h3 className="text-base font-black text-gray-900 leading-tight truncate flex-1 min-w-0 pr-3">{group.productName}</h3>
                                                                <div className="shrink-0 flex items-center">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                                        Math.round(group.inHouseQuantity) < 0 && (group.orderQuantity || 0) <= 0
                                                                            ? 'bg-blue-100 text-blue-700'
                                                                            : Math.round(group.saleableQuantity || 0) < 0
                                                                                ? 'bg-purple-100 text-purple-700'
                                                                                : Math.round(group.inHouseQuantity) > 0
                                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                                    : 'bg-red-100 text-red-700'
                                                                    }`}>
                                                                        {Math.round(group.inHouseQuantity) < 0 && (group.orderQuantity || 0) <= 0
                                                                            ? 'Pre-Sold'
                                                                            : Math.round(group.saleableQuantity || 0) < 0
                                                                                ? 'Pre-Order'
                                                                                : Math.round(group.inHouseQuantity) > 0
                                                                                    ? 'In Stock'
                                                                                    : 'Out of Stock'
                                                                        }
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center w-full">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">INHOUSE</span>
                                                                    <span className="text-gray-400 font-bold">:</span>
                                                                </div>
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap ${group.inHouseQuantity > 0 ? 'bg-emerald-50 border-emerald-100 text-gray-900' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                                                                    {(Math.round(group.inHousePacket) || 0).toLocaleString('en-US')} BAG • {(Math.round(group.inHouseQuantity) || 0).toLocaleString('en-US')} {group.unit || 'kg'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center w-full">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">SALEABLE</span>
                                                                    <span className="text-teal-400 font-bold">:</span>
                                                                </div>
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border whitespace-nowrap bg-teal-50 border-teal-100 text-teal-900">
                                                                    {(() => {
                                                                        const pktSize = group.packetSize || group.brandList?.find(b => (b.packetSize || 0) > 0)?.packetSize || 30;
                                                                        const { whole: sWhole } = calculatePktRemainder(group.saleableQuantity || 0, pktSize);
                                                                        const sPkt = Math.round(group.saleablePacket) || sWhole || 0;
                                                                        return `${sPkt.toLocaleString('en-US')} BAG • ${(Math.round(group.saleableQuantity) || 0).toLocaleString('en-US')} ${group.unit || 'kg'}`;
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">

                                                                {/* Brands List Mobile */}
                                                                <div className="space-y-3 pl-2 border-l-2 border-blue-100">
                                                                    {(() => {
                                                                        const mobileBrandGroups = [];
                                                                        effectiveBrandList.forEach((brand) => {
                                                                            const bName = (brand.brand || '-').trim();
                                                                            let groupItem = mobileBrandGroups.find(g => g.brand.toLowerCase() === bName.toLowerCase());
                                                                            if (!groupItem) {
                                                                                groupItem = {
                                                                                    brand: bName,
                                                                                    packetSize: brand.packetSize || group.packetSize || 30,
                                                                                    entries: []
                                                                                };
                                                                                mobileBrandGroups.push(groupItem);
                                                                            }
                                                                            groupItem.entries.push(brand);
                                                                        });

                                                                        return mobileBrandGroups.map((brandGroup, bgIdx) => {
                                                                            const totalInHouseQty = brandGroup.entries.reduce((sum, b) => sum + (parseFloat(b.inHouseQuantity) || 0), 0);
                                                                            const totalInHousePkt = brandGroup.entries.reduce((sum, b) => sum + (parseFloat(b.inHousePacket) || 0), 0);
                                                                            const hasMultipleLcs = brandGroup.entries.length > 1;
                                                                            const effectiveShowRate = canShowRate && showRate;

                                                                            return (
                                                                                <div key={bgIdx} className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 space-y-2.5 transition-all">
                                                                                    {/* Row 1: Brand Name & Status + Action */}
                                                                                    <div className="flex justify-between items-center w-full select-none">
                                                                                        <span className="font-black text-gray-900 text-base truncate flex-1 min-w-0 pr-2">
                                                                                            {brandGroup.brand}
                                                                                        </span>
                                                                                        <div className="shrink-0 flex items-center gap-2">
                                                                                            {(() => {
                                                                                                const isPreSold = Math.round(totalInHouseQty) < 0 && (brandGroup.entries.reduce((s, b) => s + (b.orderQuantity || 0), 0) <= 0);
                                                                                                const totalSaleableQty = brandGroup.entries.reduce((sum, b) => sum + (b.saleableQuantity !== undefined ? b.saleableQuantity : ((b.inHouseQuantity || 0) - (b.orderQuantity || 0))), 0);
                                                                                                const isPreOrder = Math.round(totalSaleableQty) < 0;
                                                                                                const isInStock = Math.round(totalInHouseQty) > 0;
                                                                                                return (
                                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                                                                        isPreSold
                                                                                                            ? 'bg-blue-100 text-blue-700'
                                                                                                            : isPreOrder
                                                                                                                ? 'bg-purple-100 text-purple-700'
                                                                                                                : isInStock
                                                                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                                                                    : 'bg-red-100 text-red-700'
                                                                                                    }`}>
                                                                                                        {isPreSold ? 'Pre-Sold' : isPreOrder ? 'Pre-Order' : isInStock ? 'In Stock' : 'Out of Stock'}
                                                                                                    </span>
                                                                                                );
                                                                                            })()}
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    const filterBrand = (brandGroup.brand && brandGroup.brand !== '-') ? brandGroup.brand.trim() : '';
                                                                                                    setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: filterBrand, warehouse: whItem.warehouseName });
                                                                                                    setViewRecord({ data: group, warehouse: whItem.warehouseName });
                                                                                                }}
                                                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                                                title={`View ${brandGroup.brand} History`}
                                                                                            >
                                                                                                <EyeIcon className="w-4 h-4" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* LC Entries for this brand */}
                                                                                    <div className="space-y-2.5 pt-2 border-t border-gray-100">
                                                                                        {brandGroup.entries.map((brand, entryIdx) => (
                                                                                            <div key={entryIdx} className={`${entryIdx !== 0 ? 'pt-2.5 border-t border-gray-200/50' : ''}`}>
                                                                                                <div className="grid grid-cols-[85px_8px_1fr] gap-y-1.5 text-xs items-baseline text-left">
                                                                                                    {effectiveShowRate && (
                                                                                                        <>
                                                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">LC NO</span>
                                                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                                                            <span className="font-bold text-blue-600 font-mono tracking-tight break-all">{brand.lcNo || '—'}</span>

                                                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">RATE</span>
                                                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                                                            <span className="font-bold text-purple-700 break-words">
                                                                                                                {brand.purchasedPrice ? `৳${parseFloat(brand.purchasedPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                                                                            </span>
                                                                                                        </>
                                                                                                    )}

                                                                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">INHOUSE</span>
                                                                                                    <span className="text-gray-400 font-bold">:</span>
                                                                                                    <span className="font-bold text-gray-900 break-words">
                                                                                                        {(Math.round(brand.inHousePacket) || 0).toLocaleString('en-US')} BAG • {(Math.round(brand.inHouseQuantity) || 0).toLocaleString('en-US')} {group.unit || 'kg'}
                                                                                                    </span>

                                                                                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">ORDER</span>
                                                                                                    <span className="text-purple-400 font-bold">:</span>
                                                                                                    <span className="font-bold text-purple-700 break-words">
                                                                                                        {(() => {
                                                                                                            const pktSize = brand.packetSize || brandGroup.packetSize || group.packetSize || 30;
                                                                                                            const orderQty = brand.orderQuantity || 0;
                                                                                                            const { whole: orderWhole } = calculatePktRemainder(orderQty, pktSize);
                                                                                                            const orderPkt = brand.orderPacket !== undefined ? Math.round(brand.orderPacket) : orderWhole;
                                                                                                            return `${(orderPkt || 0).toLocaleString('en-US')} BAG • ${(Math.round(orderQty) || 0).toLocaleString('en-US')} ${group.unit || 'kg'}`;
                                                                                                        })()}
                                                                                                    </span>

                                                                                                    <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">SALEABLE</span>
                                                                                                    <span className="text-teal-400 font-bold">:</span>
                                                                                                    <span className="font-bold text-teal-700 break-words">
                                                                                                        {(() => {
                                                                                                            const pktSize = brand.packetSize || brandGroup.packetSize || group.packetSize || 30;
                                                                                                            const saleableQty = brand.saleableQuantity !== undefined ? brand.saleableQuantity : ((brand.inHouseQuantity || 0) - (brand.orderQuantity || 0));
                                                                                                            const { whole: saleableWhole } = calculatePktRemainder(saleableQty, pktSize);
                                                                                                            const saleablePkt = brand.saleablePacket !== undefined ? Math.round(brand.saleablePacket) : saleableWhole;
                                                                                                            return `${(saleablePkt || 0).toLocaleString('en-US')} BAG • ${(Math.round(saleableQty) || 0).toLocaleString('en-US')} ${group.unit || 'kg'}`;
                                                                                                        })()}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>

                                                                                    {/* Brand Total if multiple LCs */}
                                                                                    {effectiveShowRate && hasMultipleLcs && (
                                                                                        <div className="bg-purple-50/20 rounded-xl p-2.5 border border-dashed border-purple-200 mt-2">
                                                                                            <div className="grid grid-cols-[85px_8px_1fr] gap-y-1 text-xs items-baseline text-left">
                                                                                                <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">TOTAL</span>
                                                                                                <span className="text-purple-400 font-bold">:</span>
                                                                                                <span className="font-black text-purple-950 break-words">
                                                                                                    {(() => {
                                                                                                        const pktSize = brandGroup.packetSize || group.packetSize || 30;
                                                                                                        const { whole, remainder = 0 } = calculatePktRemainder(totalInHouseQty, pktSize);
                                                                                                        return `${whole.toLocaleString('en-US')} BAG • ${Math.round(totalInHouseQty).toLocaleString('en-US')} ${group.unit || 'kg'}`;
                                                                                                    })()}
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>

                                                                {/* Card Actions - Bottom Round Shape Buttons */}
                                                                <div className="pt-3 border-t border-gray-100 flex items-start justify-around gap-1 mt-2">
                                                                    {/* View */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', warehouse: whItem.warehouseName });
                                                                            setViewRecord({ data: group, warehouse: whItem.warehouseName });
                                                                        }}
                                                                        className="group flex-1 flex flex-col items-center justify-center gap-1.5 py-1 px-1 min-w-0 transition-transform active:scale-95 cursor-pointer bg-transparent border-0"
                                                                        title={`View Stock History (${group.productName || ''})`}
                                                                    >
                                                                        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[#f8fafc] border border-[#e2e8f0] text-blue-600 shadow-[0_2px_6px_rgba(0,0,0,0.04)] transition-all duration-200 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 group-hover:scale-105 group-active:scale-95 shrink-0">
                                                                            <EyeIcon className="w-5 h-5 transition-transform duration-150" />
                                                                        </div>
                                                                        <span className="text-[11.5px] font-semibold text-[#475569] text-center leading-[1.2] tracking-[-0.01em] transition-colors group-hover:text-blue-700">
                                                                            View
                                                                        </span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop View: Table */}

                        < div className="overflow-x-auto hidden md:block" >
                            <table className="w-full text-left">
                                <tbody className="divide-y divide-gray-100">
                                    {!hasAnyDisplayRecords ? (
                                        <tr>
                                            <td colSpan="10" className="px-6 py-12 text-center text-gray-400 font-medium italic">No stock records found</td>
                                        </tr>
                                    ) : (
                                        multiWarehouseData.map((whItem, whIdx) => {
                                            const warehouseRecords = (whItem.data?.displayRecords || [])
                                                .filter(group => !expandedProducts || expandedProducts === `${whItem.warehouseName}_${group.productName}` || expandedProducts === group.productName)
                                                .filter(group => !effectiveShowRate || (group.brandList && group.brandList.some(b => Math.abs(b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001 || Math.abs(b.closingQuantity || 0) > 0.001)));

                                            if (warehouseRecords.length === 0) return null;

                                            return (
                                                <React.Fragment key={whItem.warehouseName || whIdx}>
                                                    {/* Warehouse Tag Row (Sticky at top: 0) */}
                                                    <tr className="bg-blue-50/95 backdrop-blur-md border-b border-blue-100 h-10 sticky top-0 z-20" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                                                        <td
                                                            colSpan="10"
                                                            className="px-6 py-1.5 text-center sticky top-0 z-20 bg-blue-50/95 backdrop-blur-md shadow-xs"
                                                            style={{ position: 'sticky', top: 0, zIndex: 20 }}
                                                        >
                                                            <div className="flex items-center justify-center">
                                                                <span className="inline-flex items-center px-4 py-1 rounded-lg text-xs font-black tracking-wider bg-blue-600 text-white shadow-sm">
                                                                    Warehouse - {formatWarehouseName(whItem.warehouseName)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Column Header Row for this warehouse (Sticky at top: 40px) */}
                                                    <tr className="bg-gray-50/95 backdrop-blur-md border-b border-gray-200 sticky top-10 z-10" style={{ position: 'sticky', top: '40px', zIndex: 10 }}>
                                                        <th
                                                            className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50/95 backdrop-blur-md border-b border-gray-200 shadow-xs"
                                                            style={{ position: 'sticky', top: '40px', zIndex: 10 }}
                                                        >
                                                            Product Name
                                                        </th>
                                                        <th
                                                            colSpan="8"
                                                            className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/95 backdrop-blur-md border-b border-gray-200 shadow-xs"
                                                            style={{ position: 'sticky', top: '40px', zIndex: 10 }}
                                                        >
                                                            <div className={`${gridClass} ${minWidthClass} whitespace-nowrap`}>
                                                                <div className="text-left text-gray-900 pr-2 truncate min-w-0">Brand</div>
                                                                {effectiveShowRate ? (
                                                                    <>
                                                                        <div className="text-center text-purple-800 truncate min-w-0">LC No</div>
                                                                        <div className="text-center text-purple-800 truncate min-w-0">Rate</div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {showBag && <div className="text-center text-blue-800 truncate min-w-0" title="Opening Stock Bag">{displayUnit === 'BOTH' ? 'Opening Bag' : 'Opening Stock Bag'}</div>}
                                                                        {showQty && <div className="text-center text-blue-800 truncate min-w-0" title="Opening Stock QTY (KG)">{displayUnit === 'BOTH' ? 'Opening QTY (KG)' : 'Opening Stock QTY (KG)'}</div>}
                                                                        {showBag && <div className="text-center text-orange-800 truncate min-w-0" title="Sale Bag">Sale BAG</div>}
                                                                        {showQty && <div className="text-center text-orange-800 truncate min-w-0" title="Sale QTY (KG)">Sale QTY (KG)</div>}
                                                                    </>
                                                                )}
                                                                {showBag && <div className="text-center text-green-800 truncate min-w-0" title="Closing Stock Bag">{displayUnit === 'BOTH' ? 'Closing Bag' : 'Closing Stock Bag'}</div>}
                                                                {showQty && <div className="text-center text-green-800 truncate min-w-0" title="Closing Stock QTY (KG)">{displayUnit === 'BOTH' ? 'Closing QTY (KG)' : 'Closing Stock QTY (KG)'}</div>}

                                                                {/* Order & Saleable Headers */}
                                                                {showBag && <div className="text-center text-purple-800 truncate min-w-0" title="Order Bag">Order Bag</div>}
                                                                {showQty && <div className="text-center text-purple-800 truncate min-w-0" title="Order Qty (KG)">Order Qty (KG)</div>}
                                                                {showBag && <div className="text-center text-teal-800 truncate min-w-0" title="Saleable Bag">Saleable Bag</div>}
                                                                {showQty && <div className="text-center text-teal-800 truncate min-w-0" title="Saleable Qty (KG)">Saleable Qty (KG)</div>}

                                                                <div className="text-center text-gray-500 truncate min-w-0">Status</div>
                                                            </div>
                                                        </th>
                                                        <th
                                                            className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50/95 backdrop-blur-md border-b border-gray-200 shadow-xs"
                                                            style={{ position: 'sticky', top: '40px', zIndex: 10 }}
                                                        >
                                                            Actions
                                                        </th>
                                                    </tr>

                                                    {warehouseRecords.map((group, gIdx) => {
                                                        const effectiveBrandList = effectiveShowRate
                                                            ? group.brandList.filter(b => Math.abs(b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001 || Math.abs(b.closingQuantity || 0) > 0.001)
                                                            : group.brandList;

                                                        // Calculate brand spans for this group's brandList
                                                        const brandSpans = [];
                                                        effectiveBrandList.forEach((ent, i) => {
                                                            const bName = (ent.brand || 'No Brand').trim().toLowerCase();
                                                            const prevB = i > 0 ? (effectiveBrandList[i - 1].brand || 'No Brand').trim().toLowerCase() : null;
                                                            if (bName === prevB) {
                                                                brandSpans.push({ name: bName, span: 0 });
                                                                let parentIdx = i - 1;
                                                                while (parentIdx >= 0 && brandSpans[parentIdx].span === 0) {
                                                                    parentIdx--;
                                                                }
                                                                if (parentIdx >= 0) brandSpans[parentIdx].span++;
                                                            } else {
                                                                brandSpans.push({ name: bName, span: 1 });
                                                            }
                                                        });

                                                        return (
                                                            <tr key={`${whItem.warehouseName}_${group.productName || gIdx}`} className="hover:bg-gray-50/30 transition-colors group">
                                                                <td className="px-6 py-4 align-top">
                                                                    <div className="text-sm font-semibold text-gray-900 mt-1 whitespace-nowrap">{group.productName}</div>
                                                                </td>
                                                                <td className="px-6 py-4 align-top" colSpan="8">
                                                                    <div className="space-y-3">
                                                                        {effectiveBrandList.map((brand, bIdx) => {
                                                                            let startIdx = bIdx;
                                                                            while (startIdx > 0 && brandSpans[startIdx]?.span === 0) {
                                                                                startIdx--;
                                                                            }
                                                                            const spanInfo = brandSpans[startIdx] || { span: 1 };
                                                                            const isLastOfBrandGroup = bIdx === startIdx + spanInfo.span - 1;
                                                                            const hasMultipleLcs = spanInfo.span > 1;
                                                                            const effectiveShowRate = canShowRate && showRate;
                                                                            const showBrandName = !effectiveShowRate || (brandSpans[bIdx]?.span > 0);

                                                                            return (
                                                                                <React.Fragment key={bIdx}>
                                                                                    <div className={`${gridClass} ${minWidthClass} items-center whitespace-nowrap ${bIdx !== group.brandList.length - 1 ? 'border-b border-gray-100 pb-2' : 'pb-1'}`}>
                                                                                        <div className="text-sm text-gray-600 font-medium whitespace-nowrap truncate pr-2" title={(brand.brand || '').trim()}>
                                                                                            {showBrandName ? (brand.brand || '-').trim() : ""}
                                                                                        </div>

                                                                                        {effectiveShowRate ? (
                                                                                            <>
                                                                                                {/* LC No */}
                                                                                                <div className="text-sm text-purple-800 bg-purple-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                    {brand.lcNo || '—'}
                                                                                                </div>
                                                                                                {/* Rate */}
                                                                                                <div className="text-sm text-purple-900 text-center font-medium">
                                                                                                    {brand.purchasedPrice ? `৳${parseFloat(brand.purchasedPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                                                                                </div>
                                                                                            </>
                                                                                        ) : (
                                                                                            <>
                                                                                                {/* Opening Stock */}
                                                                                                {showBag && (
                                                                                                    <div className="text-sm text-blue-800 bg-blue-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                        {(() => {
                                                                                                            const { whole, remainder } = calculatePktRemainder(brand.openingQuantity, brand.packetSize);
                                                                                                            return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                        })()}
                                                                                                    </div>
                                                                                                )}
                                                                                                {showQty && (
                                                                                                    <div className="text-sm text-blue-900 bg-blue-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                        {Math.round(brand.openingQuantity || 0).toLocaleString('en-US')}
                                                                                                    </div>
                                                                                                )}

                                                                                                {/* Sale Stock */}
                                                                                                {showBag && (
                                                                                                    <div className="text-sm text-orange-800 bg-orange-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                        {(() => {
                                                                                                            const { whole, remainder } = calculatePktRemainder(brand.saleQuantity, brand.packetSize);
                                                                                                            return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                        })()}
                                                                                                    </div>
                                                                                                )}
                                                                                                {showQty && (
                                                                                                    <div className="text-sm text-orange-900 bg-orange-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                        {Math.round(brand.saleQuantity || 0).toLocaleString('en-US')}
                                                                                                    </div>
                                                                                                )}
                                                                                            </>
                                                                                        )}

                                                                                        {/* Closing Stock */}
                                                                                        {showBag && (
                                                                                            <div className={`text-sm px-2 py-1 rounded-lg text-center font-bold border ${brand.inHouseQuantity < 0 ? 'text-blue-800 bg-blue-50/50 border-blue-100/50' : 'text-green-800 bg-green-50/50 border-green-100/50'}`}>
                                                                                                {(() => {
                                                                                                    const { whole, remainder } = calculatePktRemainder(brand.inHouseQuantity, brand.packetSize);
                                                                                                    return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                })()}
                                                                                            </div>
                                                                                        )}
                                                                                        {showQty && (
                                                                                            <div className={`text-sm px-2 py-1 rounded-lg text-center font-black border ${brand.inHouseQuantity < 0 ? 'text-blue-900 bg-blue-50/50 border-blue-100/50' : 'text-green-900 bg-green-50/50 border-green-100/50'}`}>
                                                                                                {Math.round(brand.inHouseQuantity).toLocaleString('en-US')}
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Order & Saleable Cells */}
                                                                                        {showBag && (
                                                                                            <div className="text-sm text-purple-800 bg-purple-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                {(() => {
                                                                                                    const { whole, remainder } = calculatePktRemainder(brand.orderQuantity, brand.packetSize);
                                                                                                    return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                })()}
                                                                                            </div>
                                                                                        )}
                                                                                        {showQty && (
                                                                                            <div className="text-sm text-purple-900 bg-purple-50/50 px-2 py-1 rounded-lg text-center font-bold">
                                                                                                {Math.round(brand.orderQuantity || 0).toLocaleString('en-US')}
                                                                                            </div>
                                                                                        )}
                                                                                        {showBag && (
                                                                                            <div className={`text-sm px-2 py-1 rounded-lg text-center font-bold border ${(Math.round(brand.saleableQuantity || 0) < 0) ? 'text-purple-800 bg-purple-50/50 border-purple-100/50' : 'text-teal-800 bg-teal-50/50 border-teal-100/50'}`}>
                                                                                                {(() => {
                                                                                                    const { whole, remainder } = calculatePktRemainder(brand.saleableQuantity, brand.packetSize);
                                                                                                    return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                })()}
                                                                                            </div>
                                                                                        )}
                                                                                        {showQty && (
                                                                                            <div className={`text-sm px-2 py-1 rounded-lg text-center font-black border ${(Math.round(brand.saleableQuantity || 0) < 0) ? 'text-purple-900 bg-purple-50/50 border-purple-100/50' : 'text-teal-900 bg-teal-50/50 border-teal-100/50'}`}>
                                                                                                {Math.round(brand.saleableQuantity || 0).toLocaleString('en-US')}
                                                                                            </div>
                                                                                        )}

                                                                                        <div className="text-center overflow-hidden">
                                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                                                Math.round(brand.inHouseQuantity) < 0 && (brand.orderQuantity || 0) <= 0
                                                                                                    ? 'bg-blue-50 text-blue-600'
                                                                                                    : Math.round(brand.saleableQuantity || 0) < 0
                                                                                                        ? 'bg-purple-50 text-purple-700'
                                                                                                        : Math.round(brand.inHouseQuantity) > 0
                                                                                                            ? 'bg-emerald-50 text-emerald-600'
                                                                                                            : 'bg-red-50 text-red-600'
                                                                                            }`}>
                                                                                                {Math.round(brand.inHouseQuantity) < 0 && (brand.orderQuantity || 0) <= 0
                                                                                                    ? 'Pre-Sold'
                                                                                                    : Math.round(brand.saleableQuantity || 0) < 0
                                                                                                        ? 'Pre-Order'
                                                                                                        : Math.round(brand.inHouseQuantity) > 0
                                                                                                            ? 'In Stock'
                                                                                                            : 'Out of Stock'
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    {effectiveShowRate && hasMultipleLcs && isLastOfBrandGroup && (
                                                                                        <div className={`${gridClass} ${minWidthClass} items-center whitespace-nowrap border-t border-dashed border-purple-200 pt-1.5 pb-1 mt-1 bg-purple-50/20 rounded-lg px-2`}>
                                                                                            <div className="text-xs text-purple-950 font-black uppercase tracking-wider">{(brand.brand || '-').trim()} Total</div>
                                                                                            <div></div>
                                                                                            <div></div>
                                                                                            {/* Closing Bag */}
                                                                                            {showBag && (
                                                                                                <div className="text-sm text-purple-900 font-extrabold text-center bg-purple-100/50 px-2 py-0.5 rounded-md">
                                                                                                    {(() => {
                                                                                                        const brandGroup = group.brandList.slice(startIdx, startIdx + spanInfo.span);
                                                                                                        const totalQty = brandGroup.reduce((sum, b) => sum + Math.max(0, b.inHouseQuantity || 0), 0);
                                                                                                        const pktSize = brand.packetSize || 30;
                                                                                                        const { whole, remainder = 0 } = calculatePktRemainder(totalQty, pktSize);
                                                                                                        return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                            {/* Closing Qty */}
                                                                                            {showQty && (
                                                                                                <div className="text-sm text-purple-900 font-extrabold text-center bg-purple-100/50 px-2 py-0.5 rounded-md">
                                                                                                    {(() => {
                                                                                                        const brandGroup = group.brandList.slice(startIdx, startIdx + spanInfo.span);
                                                                                                        const totalQty = brandGroup.reduce((sum, b) => sum + Math.max(0, b.inHouseQuantity || 0), 0);
                                                                                                        return Math.round(totalQty).toLocaleString('en-US');
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                            {/* Order Bag */}
                                                                                            {showBag && (
                                                                                                <div className="text-sm text-purple-900 font-extrabold text-center bg-purple-100/50 px-2 py-0.5 rounded-md">
                                                                                                    {(() => {
                                                                                                        const brandGroup = group.brandList.slice(startIdx, startIdx + spanInfo.span);
                                                                                                        const totalOrder = brandGroup.reduce((sum, b) => sum + (b.orderQuantity || 0), 0);
                                                                                                        const pktSize = brand.packetSize || 30;
                                                                                                        const { whole, remainder = 0 } = calculatePktRemainder(totalOrder, pktSize);
                                                                                                        return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                            {/* Order Qty */}
                                                                                            {showQty && (
                                                                                                <div className="text-sm text-purple-900 font-extrabold text-center bg-purple-100/50 px-2 py-0.5 rounded-md">
                                                                                                    {(() => {
                                                                                                        const brandGroup = group.brandList.slice(startIdx, startIdx + spanInfo.span);
                                                                                                        const totalOrder = brandGroup.reduce((sum, b) => sum + (b.orderQuantity || 0), 0);
                                                                                                        return Math.round(totalOrder).toLocaleString('en-US');
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                            {/* Saleable Bag */}
                                                                                            {showBag && (
                                                                                                <div className="text-sm text-teal-900 font-extrabold text-center bg-teal-100/50 px-2 py-0.5 rounded-md">
                                                                                                    {(() => {
                                                                                                        const brandGroup = group.brandList.slice(startIdx, startIdx + spanInfo.span);
                                                                                                        const totalSaleable = brandGroup.reduce((sum, b) => sum + Math.max(0, b.saleableQuantity || 0), 0);
                                                                                                        const pktSize = brand.packetSize || 30;
                                                                                                        const { whole, remainder = 0 } = calculatePktRemainder(totalSaleable, pktSize);
                                                                                                        return `${whole.toLocaleString('en-US')} - ${Math.abs(remainder).toLocaleString('en-US')} kg`;
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                            {/* Saleable Qty */}
                                                                                            {showQty && (
                                                                                                <div className="text-sm text-teal-900 font-extrabold text-center bg-teal-100/50 px-2 py-0.5 rounded-md">
                                                                                                    {(() => {
                                                                                                        const brandGroup = group.brandList.slice(startIdx, startIdx + spanInfo.span);
                                                                                                        const totalSaleable = brandGroup.reduce((sum, b) => sum + Math.max(0, b.saleableQuantity || 0), 0);
                                                                                                        return Math.round(totalSaleable).toLocaleString('en-US');
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                            <div></div>
                                                                                        </div>
                                                                                    )}
                                                                                </React.Fragment>
                                                                            );
                                                                        })}
                                                                        <div className={`pt-1.5 pb-1.5 mt-2 bg-blue-50/20 border-t border-dashed border-blue-200 rounded-lg px-2 ${gridClass} ${minWidthClass} items-center whitespace-nowrap`}>
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="text-xs font-black text-blue-950 uppercase tracking-wider">Total:</span>
                                                                            </div>
                                                                            {effectiveShowRate ? (
                                                                                <>
                                                                                    <div className="text-center"></div>
                                                                                    <div className="text-center"></div>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    {/* Total Opening */}
                                                                                    {showBag && (
                                                                                        <div className="text-sm text-blue-900 font-extrabold text-center bg-blue-100/50 px-2 py-0.5 rounded-md">
                                                                                            {(() => {
                                                                                                const grouped = getGroupedBrandList(group.brandList || []);
                                                                                                let totalWhole = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.openingQuantity || 0), ent.packetSize).whole, 0);
                                                                                                let totalRem = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.openingQuantity || 0), ent.packetSize).remainder, 0);
                                                                                                const pktSize = group.packetSize || group.brandList?.find(b => (b.packetSize || 0) > 0)?.packetSize || 30;
                                                                                                if (pktSize > 0 && Math.abs(totalRem) >= pktSize) {
                                                                                                    const extra = Math.floor(Math.abs(totalRem) / pktSize);
                                                                                                    totalWhole += totalRem >= 0 ? extra : -extra;
                                                                                                    totalRem = totalRem % pktSize;
                                                                                                }
                                                                                                return `${totalWhole.toLocaleString('en-US')}${totalRem !== 0 ? ` - ${Math.abs(Math.round(totalRem)).toLocaleString('en-US')} kg` : ''}`;
                                                                                            })()}
                                                                                        </div>
                                                                                    )}
                                                                                    {showQty && (
                                                                                        <div className="text-sm text-blue-900 font-extrabold text-center bg-blue-100/50 px-2 py-0.5 rounded-md">
                                                                                            {Math.round(Math.max(0, group.openingQuantity || 0)).toLocaleString('en-US')}
                                                                                        </div>
                                                                                    )}
                                                                                    {/* Total Sale */}
                                                                                    {showBag && (
                                                                                        <div className="text-sm text-blue-900 font-extrabold text-center bg-blue-100/50 px-2 py-0.5 rounded-md">
                                                                                            {(() => {
                                                                                                const grouped = getGroupedBrandList(group.brandList || []);
                                                                                                let totalWhole = grouped.reduce((sum, ent) => sum + calculatePktRemainder(ent.saleQuantity || 0, ent.packetSize).whole, 0);
                                                                                                let totalRem = grouped.reduce((sum, ent) => sum + calculatePktRemainder(ent.saleQuantity || 0, ent.packetSize).remainder, 0);
                                                                                                const pktSize = group.packetSize || group.brandList?.find(b => (b.packetSize || 0) > 0)?.packetSize || 30;
                                                                                                if (pktSize > 0 && Math.abs(totalRem) >= pktSize) {
                                                                                                    const extra = Math.floor(Math.abs(totalRem) / pktSize);
                                                                                                    totalWhole += totalRem >= 0 ? extra : -extra;
                                                                                                    totalRem = totalRem % pktSize;
                                                                                                }
                                                                                                return `${totalWhole.toLocaleString('en-US')}${totalRem !== 0 ? ` - ${Math.abs(Math.round(totalRem)).toLocaleString('en-US')} kg` : ''}`;
                                                                                            })()}
                                                                                        </div>
                                                                                    )}
                                                                                    {showQty && (
                                                                                        <div className="text-sm text-blue-900 font-extrabold text-center bg-blue-100/50 px-2 py-0.5 rounded-md">
                                                                                            {Math.round(group.saleQuantity).toLocaleString('en-US')}
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {/* Total Closing */}
                                                                            {showBag && (
                                                                                <div className="text-sm text-blue-900 font-extrabold text-center bg-blue-100/50 px-2 py-0.5 rounded-md">
                                                                                    {(() => {
                                                                                        const grouped = getGroupedBrandList(group.brandList || []);
                                                                                        let totalWhole = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.inHouseQuantity || 0), ent.packetSize).whole, 0);
                                                                                        let totalRem = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.inHouseQuantity || 0), ent.packetSize).remainder, 0);
                                                                                        const pktSize = group.packetSize || group.brandList?.find(b => (b.packetSize || 0) > 0)?.packetSize || 30;
                                                                                        if (pktSize > 0 && Math.abs(totalRem) >= pktSize) {
                                                                                            const extra = Math.floor(Math.abs(totalRem) / pktSize);
                                                                                            totalWhole += totalRem >= 0 ? extra : -extra;
                                                                                            totalRem = totalRem % pktSize;
                                                                                        }
                                                                                        return `${totalWhole.toLocaleString('en-US')}${totalRem !== 0 ? ` - ${Math.abs(Math.round(totalRem)).toLocaleString('en-US')} kg` : ''}`;
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                            {showQty && (
                                                                                <div className="text-sm text-blue-900 font-extrabold text-center bg-blue-100/50 px-2 py-0.5 rounded-md">
                                                                                    {Math.round(Math.max(0, group.inHouseQuantity || 0)).toLocaleString('en-US')}
                                                                                </div>
                                                                            )}

                                                                            {/* Total Order & Saleable */}
                                                                            {showBag && (
                                                                                <div className="text-sm text-purple-900 font-extrabold text-center bg-purple-100/50 px-2 py-0.5 rounded-md">
                                                                                    {(() => {
                                                                                        const grouped = getGroupedBrandList(group.brandList || []);
                                                                                        let totalWhole = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.orderQuantity || 0), ent.packetSize).whole, 0);
                                                                                        let totalRem = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.orderQuantity || 0), ent.packetSize).remainder, 0);
                                                                                        const pktSize = group.packetSize || group.brandList?.find(b => (b.packetSize || 0) > 0)?.packetSize || 30;
                                                                                        if (pktSize > 0 && Math.abs(totalRem) >= pktSize) {
                                                                                            const extra = Math.floor(Math.abs(totalRem) / pktSize);
                                                                                            totalWhole += totalRem >= 0 ? extra : -extra;
                                                                                            totalRem = totalRem % pktSize;
                                                                                        }
                                                                                        return `${totalWhole.toLocaleString('en-US')}${totalRem !== 0 ? ` - ${Math.abs(Math.round(totalRem)).toLocaleString('en-US')} kg` : ''}`;
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                            {showQty && (
                                                                                <div className="text-sm text-purple-900 font-extrabold text-center bg-purple-100/50 px-2 py-0.5 rounded-md">
                                                                                    {Math.round(group.orderQuantity || 0).toLocaleString('en-US')}
                                                                                </div>
                                                                            )}
                                                                            {showBag && (
                                                                                <div className="text-sm text-teal-900 font-extrabold text-center bg-teal-100/50 px-2 py-0.5 rounded-md">
                                                                                    {(() => {
                                                                                        const grouped = getGroupedBrandList(group.brandList || []);
                                                                                        let totalWhole = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.saleableQuantity || 0), ent.packetSize).whole, 0);
                                                                                        let totalRem = grouped.reduce((sum, ent) => sum + calculatePktRemainder(Math.max(0, ent.saleableQuantity || 0), ent.packetSize).remainder, 0);
                                                                                        const pktSize = group.packetSize || group.brandList?.find(b => (b.packetSize || 0) > 0)?.packetSize || 30;
                                                                                        if (pktSize > 0 && Math.abs(totalRem) >= pktSize) {
                                                                                            const extra = Math.floor(Math.abs(totalRem) / pktSize);
                                                                                            totalWhole += totalRem >= 0 ? extra : -extra;
                                                                                            totalRem = totalRem % pktSize;
                                                                                        }
                                                                                        return `${totalWhole.toLocaleString('en-US')}${totalRem !== 0 ? ` - ${Math.abs(Math.round(totalRem)).toLocaleString('en-US')} kg` : ''}`;
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                            {showQty && (
                                                                                <div className="text-sm text-teal-900 font-extrabold text-center bg-teal-100/50 px-2 py-0.5 rounded-md">
                                                                                    {(() => {
                                                                                        const grouped = getGroupedBrandList(group.brandList || []);
                                                                                        const totalQty = grouped.reduce((sum, ent) => sum + Math.max(0, ent.saleableQuantity || 0), 0);
                                                                                        return Math.round(totalQty).toLocaleString('en-US');
                                                                                    })()}
                                                                                </div>
                                                                            )}
                                                                            <div className="text-center"></div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 align-top text-right">
                                                                    <div className="flex items-center justify-end gap-3 mt-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', warehouse: whItem.warehouseName });
                                                                                setViewRecord({ data: group, warehouse: whItem.warehouseName });
                                                                            }}
                                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                                            title={`View Stock History (${group.productName || ''})`}
                                                                        >
                                                                            <EyeIcon className="w-5 h-5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div >
                        <TableScrollNav className="hidden md:flex" count={stockData.displayRecords?.length} />
                    </div >
                </>
            )}

            {
                viewRecord && createPortal(
                    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 max-md:p-2 app-modal-overlay">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViewRecord(null)}></div>
                        <div className="relative bg-white/95 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-2xl max-w-[95vw] max-md:max-w-[96vw] max-md:rounded-2xl max-md:max-h-[94vh] max-md:bg-white max-md:border-gray-100 w-full animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
                            {/* Modal Header */}
                            <div className="px-4 sm:px-8 pt-2 pb-4 sm:pt-4 sm:pb-6 max-md:px-3 max-md:py-2.5 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-3xl max-md:rounded-t-2xl gap-3 max-md:gap-1.5 flex-shrink-0 z-50 relative">
                                <div className="flex-shrink-0 min-w-0 max-md:flex-1 max-md:mr-1">
                                    {/* Desktop view: 100% identical to origin/main */}
                                    <h3 className="hidden md:block text-lg sm:text-2xl font-bold text-gray-900 truncate">
                                        Stock History - {viewRecord.data?.productName || viewRecord.productName || ''}
                                    </h3>
                                    {/* Mobile view: Product Name in next line */}
                                    <div className="md:hidden flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider leading-tight">
                                            Stock History
                                        </span>
                                        <h3 className="text-base font-bold text-gray-900 truncate leading-snug" title={viewRecord.data?.productName || viewRecord.productName || ''}>
                                            {viewRecord.data?.productName || viewRecord.productName || ''}
                                        </h3>
                                    </div>
                                </div>

                                {/* Center Aligned Search Bar & Tabs - Hidden on mobile if needed, or condensed */}
                                <div className="hidden lg:flex flex-1 max-w-xl mx-auto flex-col items-center gap-4">
                                    <div className="w-full max-w-md relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={historyTab === 'purchase' ? "Search by LC No, Brand, Port or Truck..." : "Search by LC No, Invoice, Company, Customer, Phone or Brand..."}
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

                                <div className="flex items-center gap-2 max-md:gap-1.5 shrink-0">
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
                                            <div ref={historyFilterRef} className="fixed inset-x-4 top-24 lg:absolute lg:inset-auto lg:right-0 lg:mt-3 w-auto lg:w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl z-[60] p-5 animate-in fade-in zoom-in duration-200 overflow-y-auto lg:overflow-visible max-h-[70vh]">
                                                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                                                    <h4 className="font-bold text-gray-900">Advanced Filters</h4>
                                                    <button
                                                        onClick={() => {
                                                            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', warehouse: '' });
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

                                                    {/* Brand and Warehouse Filters */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                                                        <div className="space-y-1.5 relative" ref={warehouseFilterRef}>
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Warehouse</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    readOnly
                                                                    value={historyFilters.warehouse}
                                                                    onClick={() => { setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: !filterDropdownOpen.warehouse }); }}
                                                                    placeholder="Select Warehouse..."
                                                                    className={`w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm cursor-pointer ${historyFilters.warehouse ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                                                                />
                                                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                                {filterDropdownOpen.warehouse && (
                                                                    <div className="absolute z-[70] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        <button type="button" onClick={() => { setHistoryFilters({ ...historyFilters, warehouse: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 font-medium border-b border-gray-50">All Warehouses</button>
                                                                        {historyOptions.warehouses.map(wh => (
                                                                            <button key={wh} type="button" onClick={() => { setHistoryFilters({ ...historyFilters, warehouse: wh }); setFilterDropdownOpen(initialFilterDropdownState); }} className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${historyFilters.warehouse === wh ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600'}`}>{wh}</button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
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
                                            setHistoryFilters({ startDate: '', endDate: '', lcNo: '', port: '', brand: '', warehouse: '' });
                                            setShowHistoryFilterPanel(false);
                                            setExpandedHistoryId(null);
                                            setExpandedSaleId(null);
                                        }}
                                        className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 shrink-0"
                                    >
                                        <XIcon className="w-6 h-6 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Tabs & Search Unified - Visible only on mobile */}
                            <div className="lg:hidden px-4 pb-4 border-b border-gray-100 flex-shrink-0 bg-white">
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
                                    <div className="flex items-center justify-center gap-12 pt-1 pb-0.5">
                                        {/* Purchase */}
                                        <button
                                            type="button"
                                            onClick={() => setHistoryTab('purchase')}
                                            className="group flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer bg-transparent border-0"
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${historyTab === 'purchase'
                                                ? 'bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/35'
                                                : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:bg-[#f1f5f9]'
                                                }`}>
                                                <ShoppingCartIcon className="w-5 h-5 transition-transform duration-150" />
                                            </div>
                                            <span className={`text-[12px] tracking-tight transition-colors ${historyTab === 'purchase'
                                                ? 'font-bold text-[#1e40af]'
                                                : 'font-semibold text-[#475569] group-hover:text-[#1e293b]'
                                                }`}>
                                                Purchase
                                            </span>
                                        </button>

                                        {/* Sale */}
                                        <button
                                            type="button"
                                            onClick={() => setHistoryTab('sale')}
                                            className="group flex flex-col items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer bg-transparent border-0"
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${historyTab === 'sale'
                                                ? 'bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-md shadow-blue-500/35'
                                                : 'bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:bg-[#f1f5f9]'
                                                }`}>
                                                <TrendingUpIcon className="w-5 h-5 transition-transform duration-150" />
                                            </div>
                                            <span className={`text-[12px] tracking-tight transition-colors ${historyTab === 'sale'
                                                ? 'font-bold text-[#1e40af]'
                                                : 'font-semibold text-[#475569] group-hover:text-[#1e293b]'
                                                }`}>
                                                Sale
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Content */}
                            <div className="px-4 sm:px-8 py-6 sm:py-8 flex-1 overflow-y-auto custom-scrollbar min-h-0">
                                {historyTab === 'purchase' ? (() => {
                                    const history = activePurchaseHistory;
                                    const unit = history[0]?.unit || 'kg';
                                    const validEntries = (item) => {
                                        if (item.entries && item.entries.length > 0) {
                                            return item.entries;
                                        }
                                        return [{
                                            brand: item.brand || item.productName || '-',
                                            purchasedPrice: item.purchasedPrice,
                                            packet: item.totalPacket || item.packet,
                                            quantity: item.totalQuantity || item.quantity,
                                            inHousePacket: item.totalInHousePacket || item.inHousePacket,
                                            inHouseQuantity: item.totalInHouseQuantity || item.inHouseQuantity,
                                            sweepedPacket: item.sweepedPacket,
                                            sweepedQuantity: item.totalShortage || item.sweepedQuantity,
                                            unit: item.unit || unit
                                        }];
                                    };
                                    const visibleHistory = history;

                                    const tPkts = history.reduce((sum, item) => sum + (parseFloat(item.totalPacket) || 0), 0);
                                    const tQty = history.reduce((sum, item) => sum + (parseFloat(item.totalQuantity) || 0), 0);
                                    const tShort = history.reduce((sum, item) => sum + (parseFloat(item.totalShortage) || 0), 0);

                                    // Calculate INHOUSE totals accurately:
                                    // 1. Sum in-house quantities from all history items (unassigned stock)
                                    // 2. Sum matching warehouse records (excluding 'stock' records)
                                    const productName = (viewRecord.data.productName || '').trim().toLowerCase();
                                    const shownLCTrucks = new Set(history.map(item => `${(item.lcNo || '').trim()}_${(item.truckNo || '').trim()}`));

                                    // Sum unassigned stock from history items
                                    const historyInHouseQty = history.reduce((sum, h) => {
                                        return sum + (h.entries || []).reduce((eSum, e) => eSum + (parseFloat(e.inHouseQuantity) || 0), 0);
                                    }, 0);
                                    const historyInHousePkt = history.reduce((sum, h) => {
                                        return sum + (h.entries || []).reduce((eSum, e) => eSum + (parseFloat(e.inHousePacket) || 0), 0);
                                    }, 0);

                                    const tIHQty = historyInHouseQty;
                                    const tIHPkt = historyInHousePkt;

                                    return (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 md:flex md:flex-row gap-3 sm:gap-4 w-full">
                                                {[
                                                    { label: 'TOTAL BAG', value: tPkts.toLocaleString('en-US'), bgColor: 'bg-white', borderColor: 'border-gray-200', textColor: 'text-gray-900', labelColor: 'text-gray-400' },
                                                    { label: 'TOTAL QTY', value: `${Math.round(tQty).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-emerald-50/10', borderColor: 'border-emerald-100', textColor: 'text-emerald-700', labelColor: 'text-emerald-600' },
                                                    { label: 'INHOUSE BAG', value: tIHPkt.toLocaleString('en-US'), bgColor: 'bg-amber-50/10', borderColor: 'border-amber-100', textColor: 'text-amber-700', labelColor: 'text-amber-600' },
                                                    { label: 'INHOUSE QTY', value: `${Math.round(tIHQty).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-blue-50/10', borderColor: 'border-blue-100', textColor: 'text-blue-700', labelColor: 'text-blue-600' },
                                                    { label: 'SHORTAGE', value: `${Math.round(tShort).toLocaleString('en-US')} ${unit}`, bgColor: 'bg-rose-50/10', borderColor: 'border-rose-100', textColor: 'text-rose-700', labelColor: 'text-rose-600', span: 'col-span-2 md:col-auto' },
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
                                                                <th onClick={() => requestSort('history', 'exporter')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">Exporter <SortIcon config={sortConfig.history} columnKey="exporter" /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', 'truckNo')} className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">Truck <SortIcon config={sortConfig.history} columnKey="truckNo" /></div>
                                                                </th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Brand</th>
                                                                {canShowRate && showRate && (
                                                                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purchase Price</th>
                                                                )}
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">BAG</th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">InHouse Pkt</th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">InHouse Qty</th>
                                                                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-rose-600">Shortage</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {visibleHistory.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={canShowRate && showRate ? "14" : "13"} className="px-6 py-12 text-center text-gray-400 font-medium italic">No history records found</td>
                                                                </tr>
                                                            ) : (
                                                                visibleHistory.map((item, idx) => (
                                                                    <tr key={item._id || idx} className="hover:bg-gray-50/30 transition-colors group border-b border-gray-50">
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(item.date)}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 font-semibold">{item.lcNo}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">{item.port}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={item.importer}>{item.importer}</td>
                                                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600 truncate max-w-[120px]" title={item.exporter}>{item.exporter || '-'}</td>
                                                                        <td className="px-3 py-3 text-sm text-gray-600 font-medium">
                                                                            {item.truckNo ? (
                                                                                item.truckNo.split(/(.{14})/).filter(Boolean).map((chunk, idx) => (
                                                                                    <div key={idx}>{chunk}</div>
                                                                                ))
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top whitespace-nowrap">
                                                                            <div className="space-y-1">
                                                                                {validEntries(item).map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-600 font-medium">{entry.brand}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        {canShowRate && showRate && (
                                                                            <td className="px-3 py-3 align-top">
                                                                                <div className="space-y-1">
                                                                                    {validEntries(item).map((entry, eIdx) => (
                                                                                        <div key={eIdx} className="text-sm text-gray-600">৳{parseFloat(entry.purchasedPrice || 0).toLocaleString('en-IN')}</div>
                                                                                    ))}
                                                                                </div>
                                                                            </td>
                                                                        )}
                                                                        <td className="px-3 py-3 align-top font-bold">
                                                                            <div className="space-y-1">
                                                                                {validEntries(item).map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-900">
                                                                                        {parseFloat(entry.packet) > 0 ? entry.packet : '-'}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top font-bold">
                                                                            <div className="space-y-1">
                                                                                {validEntries(item).map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-gray-900">{Math.round(parseFloat(entry.quantity || 0)).toLocaleString('en-US')} {entry.unit}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top">
                                                                            <div className="space-y-1">
                                                                                {validEntries(item).map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-amber-600 font-bold">
                                                                                        {parseFloat(entry.inHousePacket) > 0 ? entry.inHousePacket : '-'}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top">
                                                                            <div className="space-y-1">
                                                                                {validEntries(item).map((entry, eIdx) => (
                                                                                    <div key={eIdx} className="text-sm text-blue-600 font-bold">{Math.round(parseFloat(entry.inHouseQuantity || 0)).toLocaleString('en-US')} {entry.unit}</div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 align-top text-rose-600 font-black">
                                                                            <div className="space-y-1">
                                                                                {validEntries(item).map((entry, eIdx) => {
                                                                                    const shortage = Math.round(parseFloat(entry.sweepedQuantity || 0));
                                                                                    return (
                                                                                        <div key={eIdx} className="text-sm">
                                                                                            {shortage > 0 ? `${shortage.toLocaleString('en-US')} ${entry.unit}` : '-'}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </td>

                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <TableScrollNav className="hidden md:flex" count={visibleHistory.length} />

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
                                                                    <div className="flex items-start justify-between gap-2 select-none">
                                                                        <div className="grid grid-cols-[85px_8px_1fr] gap-y-1.5 text-xs items-baseline text-left flex-1 min-w-0">
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DATE</span>
                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                            <span className="font-bold text-gray-900">{formatDate(item.date)}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC NO</span>
                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                            <span className="font-bold text-blue-600 font-mono tracking-tight break-all">{item.lcNo || '—'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL QTY</span>
                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                            <span className="font-bold text-gray-900 break-words">
                                                                                {item.totalPacket ? `${item.totalPacket} BAG` : ''}
                                                                                {item.totalPacket && item.totalQuantity ? ' • ' : ''}
                                                                                {item.totalQuantity ? `${Math.round(item.totalQuantity).toLocaleString('en-US')} ${item.unit || unit}` : ''}
                                                                            </span>
                                                                        </div>

                                                                        <div className={`p-1.5 rounded-full transition-colors shrink-0 self-start mt-0.5 ${isExpanded ? 'bg-blue-50 text-blue-500' : 'text-gray-400'}`}>
                                                                            {isExpanded ? (
                                                                                <ChevronUpIcon className="w-5 h-5" />
                                                                            ) : (
                                                                                <ChevronDownIcon className="w-5 h-5" />
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Content */}
                                                                    {isExpanded && (
                                                                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                                            {/* Label & Value Info Grid */}
                                                                            <div className="grid grid-cols-[85px_8px_1fr] gap-y-2 p-3 bg-gray-50/70 rounded-xl border border-gray-100 text-xs items-baseline text-left">
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PORT</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-semibold text-blue-600 truncate">{item.port || '-'}</span>

                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IMPORTER</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-semibold text-gray-800 break-words">{item.importer || '-'}</span>

                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">EXPORTER</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-semibold text-gray-800 break-words">{item.exporter || '-'}</span>

                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TRUCK</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-bold text-gray-900">{item.truckNo || '-'}</span>
                                                                            </div>

                                                                            {/* Brands Breakdown */}
                                                                            <div className="bg-gray-50/50 rounded-xl p-3 space-y-3 border border-gray-100">
                                                                                {validEntries(item).map((entry, eIdx) => (
                                                                                    <div key={eIdx} className={`${eIdx !== 0 ? 'border-t border-gray-200/60 pt-3' : ''}`}>
                                                                                        <div className="flex justify-between items-center mb-2">
                                                                                            <span className="text-sm font-black text-gray-900">{entry.brand || '-'}</span>
                                                                                            {canShowRate && showRate && (
                                                                                                <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                                                                                                    ৳{parseFloat(entry.purchasedPrice || 0).toLocaleString('en-IN')}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div className="grid grid-cols-2 gap-2.5">
                                                                                            <div className="flex flex-col bg-white p-2.5 rounded-lg border border-gray-100 shadow-xs">
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total LC Amount</span>
                                                                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                                                                    <span className="text-xs font-bold text-gray-900">{entry.packet || 0} PKT</span>
                                                                                                    <span className="text-xs font-semibold text-gray-600">{Math.round(parseFloat(entry.quantity || 0)).toLocaleString('en-US')} {entry.unit || unit}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex flex-col bg-white p-2.5 rounded-lg border border-gray-100 shadow-xs">
                                                                                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">InHouse</span>
                                                                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                                                                    <span className="text-xs font-bold text-blue-600">{entry.inHousePacket || 0} BAG</span>
                                                                                                    <span className="text-xs font-semibold text-blue-500">{Math.round(parseFloat(entry.inHouseQuantity || 0)).toLocaleString('en-US')} {entry.unit || unit}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        {parseFloat(entry.sweepedQuantity || 0) > 0 && (
                                                                                            <div className="mt-2 flex items-center justify-between bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md">
                                                                                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Shortage:</span>
                                                                                                <span className="text-xs font-bold text-rose-600">{Math.round(parseFloat(entry.sweepedQuantity || 0)).toLocaleString('en-US')} {entry.unit || unit}</span>
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
                                                    <div className="text-lg sm:text-2xl font-black text-emerald-700">{totalSaleQty.toLocaleString('en-US')} {unit}</div>
                                                </div>
                                                {canShowRate && showRate && (
                                                    <div className="bg-blue-50/10 border border-blue-100 p-4 sm:p-6 rounded-2xl shadow-sm transition-all hover:shadow-md">
                                                        <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Sale Amount</div>
                                                        <div className="text-lg sm:text-2xl font-black text-blue-700">৳ {totalSaleAmount.toLocaleString('en-IN')}</div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                                <div className="hidden md:block overflow-x-auto">
                                                    <table className="w-full text-left min-w-[800px]">
                                                        <thead>
                                                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                                                <th onClick={() => requestSort('history', 'date')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">Date <SortIcon config={sortConfig.history} columnKey="date" /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', 'lcNo')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">LC No <SortIcon config={sortConfig.history} columnKey="lcNo" /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', 'invoiceNo')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">Invoice No <SortIcon config={sortConfig.history} columnKey="invoiceNo" /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', 'companyName')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">Company Name <SortIcon config={sortConfig.history} columnKey="companyName" /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', isFruitHistory ? "customerName" : "itemBrand")} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center">{isFruitHistory ? "Customer Name" : "Brand"} <SortIcon config={sortConfig.history} columnKey={isFruitHistory ? "customerName" : "itemBrand"} /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', isFruitHistory ? "contact" : "itemPacket")} className={`px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors ${!isFruitHistory ? 'text-right' : ''}`}>
                                                                    <div className={`flex items-center ${!isFruitHistory ? 'justify-end' : ''}`}>{isFruitHistory ? "Phone" : "BAG"} <SortIcon config={sortConfig.history} columnKey={isFruitHistory ? "contact" : "itemPacket"} /></div>
                                                                </th>
                                                                <th onClick={() => requestSort('history', 'itemQty')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors text-right">
                                                                    <div className="flex items-center justify-end">Quantity <SortIcon config={sortConfig.history} columnKey="itemQty" /></div>
                                                                </th>
                                                                {isFruitHistory && (
                                                                    <th onClick={() => requestSort('history', 'itemTruck')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors text-right">
                                                                        <div className="flex items-center justify-end">Truck <SortIcon config={sortConfig.history} columnKey="itemTruck" /></div>
                                                                    </th>
                                                                )}
                                                                {canShowRate && showRate && (
                                                                    <>
                                                                        <th onClick={() => requestSort('history', 'itemPrice')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors text-right">
                                                                            <div className="flex items-center justify-end">Price <SortIcon config={sortConfig.history} columnKey="itemPrice" /></div>
                                                                        </th>
                                                                        <th onClick={() => requestSort('history', 'itemTotal')} className="px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors text-right">
                                                                            <div className="flex items-center justify-end">Total <SortIcon config={sortConfig.history} columnKey="itemTotal" /></div>
                                                                        </th>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50">
                                                            {flattenedSaleHistory.length === 0 ? (
                                                                <tr><td colSpan={isFruitHistory ? (canShowRate && showRate ? "10" : "8") : (canShowRate && showRate ? "9" : "7")} className="px-6 py-20 text-center text-gray-400 font-medium">No sale history found for this product</td></tr>
                                                            ) : (
                                                                flattenedSaleHistory.map((sale, sIdx) => (
                                                                    <tr key={sIdx} className="hover:bg-blue-50/20 transition-all group border-b border-gray-50">
                                                                        <td className="px-3 py-3 text-sm text-gray-600">{formatDate(sale.date)}</td>
                                                                        <td className="px-3 py-3 text-sm text-gray-600 font-semibold">{sale.lcNo ? sale.lcNo.slice(-4) : '-'}</td>
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
                                                                                    <div className="text-sm font-bold text-gray-900">{sale.itemPacket.toLocaleString('en-US')}</div>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                        <td className="px-3 py-3 text-right">
                                                                            <div className="text-sm font-bold text-gray-900">{sale.itemQty.toLocaleString('en-US')} {unit}</div>
                                                                        </td>
                                                                        {isFruitHistory && (
                                                                            <td className="px-3 py-3 text-sm text-gray-600 font-medium text-right">{sale.itemTruck || '-'}</td>
                                                                        )}
                                                                        {canShowRate && showRate && (
                                                                            <>
                                                                                <td className="px-3 py-3 text-right">
                                                                                    <div className="text-sm font-medium text-gray-600">৳{sale.itemPrice.toLocaleString('en-IN')}</div>
                                                                                </td>
                                                                                <td className="px-3 py-3 text-right">
                                                                                    <div className="text-sm font-black text-blue-600 group-hover:text-blue-700">৳{sale.itemTotal.toLocaleString('en-IN')}</div>
                                                                                </td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <TableScrollNav className="hidden md:flex" count={flattenedSaleHistory.length} />

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
                                                                    <div className="flex items-start justify-between gap-2 select-none">
                                                                        <div className="grid grid-cols-[85px_8px_1fr] gap-y-1.5 text-xs items-baseline text-left flex-1 min-w-0">
                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DATE</span>
                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                            <span className="font-bold text-gray-900">{formatDate(sale.date)}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">INVOICE</span>
                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                            <span className="font-bold text-blue-600 font-mono tracking-tight break-all">{sale.invoiceNo || '—'}</span>

                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">QUANTITY</span>
                                                                            <span className="text-gray-400 font-bold">:</span>
                                                                            <span className="font-bold text-gray-900 break-words">{sale.itemQty?.toLocaleString('en-US') || 0} {unit}</span>
                                                                        </div>

                                                                        <div className={`p-1.5 rounded-full transition-colors shrink-0 self-start mt-0.5 ${isExpanded ? 'bg-blue-50 text-blue-500' : 'text-gray-400'}`}>
                                                                            {isExpanded ? (
                                                                                <ChevronUpIcon className="w-5 h-5" />
                                                                            ) : (
                                                                                <ChevronDownIcon className="w-5 h-5" />
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Content */}
                                                                    {isExpanded && (
                                                                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                                            <div className="grid grid-cols-[85px_8px_1fr] gap-y-2 p-3 bg-gray-50/70 rounded-xl border border-gray-100 text-xs items-baseline text-left">
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">COMPANY</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-bold text-gray-900 break-words">{sale.companyName || '-'}</span>

                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC NO</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-semibold text-blue-600 truncate">{sale.lcNo || '-'}</span>

                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isFruitHistory ? "CUSTOMER" : "BRAND"}</span>
                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                <span className="font-bold text-gray-800 break-words">{isFruitHistory ? (sale.customerName || '-') : (sale.itemBrand || '-')}</span>

                                                                                {isFruitHistory && (
                                                                                    <>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PHONE</span>
                                                                                        <span className="text-gray-400 font-bold">:</span>
                                                                                        <span className="font-semibold text-gray-700">{sale.contact || '-'}</span>

                                                                                        {sale.itemTruck && (
                                                                                            <>
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TRUCK</span>
                                                                                                <span className="text-gray-400 font-bold">:</span>
                                                                                                <span className="font-semibold text-gray-700">{sale.itemTruck}</span>
                                                                                            </>
                                                                                        )}
                                                                                    </>
                                                                                )}

                                                                                {!isFruitHistory && (
                                                                                    <>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BAG</span>
                                                                                        <span className="text-gray-400 font-bold">:</span>
                                                                                        <span className="font-bold text-gray-900">{sale.itemPacket?.toLocaleString('en-US') || 0} BAG</span>
                                                                                    </>
                                                                                )}
                                                                            </div>

                                                                            <div className="flex items-center justify-between p-3 bg-blue-50/40 border border-blue-100 rounded-xl">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                                                                    <span className="text-sm font-black text-gray-900">{sale.itemQty.toLocaleString('en-US')} {unit}</span>
                                                                                </div>
                                                                                {canShowRate && showRate && (
                                                                                    <>
                                                                                        <div className="flex flex-col items-center">
                                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Price</span>
                                                                                            <span className="text-xs font-bold text-gray-600">৳{sale.itemPrice.toLocaleString('en-IN')}</span>
                                                                                        </div>
                                                                                        <div className="flex flex-col items-end">
                                                                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total</span>
                                                                                            <span className="text-base font-black text-blue-600">৳{sale.itemTotal.toLocaleString('en-IN')}</span>
                                                                                        </div>
                                                                                    </>
                                                                                )}
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
                                })()}
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {/* Stock Baseline Modal (Set Initial Stage & Revert) */}
            {showBaselineModal && createPortal(
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 app-modal-overlay bg-black/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white flex items-center justify-between shadow-md shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs">
                                    <BoxIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                        <span>Stock Baseline & Quantity Adjustment</span>
                                        <span className="px-2 py-0.5 text-[10px] bg-amber-400 text-amber-950 font-black rounded-full uppercase tracking-wider">Admin Only</span>
                                    </h3>
                                    <p className="text-xs text-indigo-100 mt-0.5">Manage initial stage snapshots, direct stock adjustments (add/reduce/set), and sales LC allocations.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBaselineModal(false)}
                                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all cursor-pointer"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 bg-gray-50/70 px-6 pt-3 shrink-0 overflow-x-auto gap-1">
                            <button
                                type="button"
                                onClick={() => setBaselineTab('adjust')}
                                className={`pb-3 px-3.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                    baselineTab === 'adjust'
                                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span>⚡</span>
                                <span>Adjust Stock Qty</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBaselineTab('reassign')}
                                className={`pb-3 px-3.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                    baselineTab === 'reassign'
                                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span>🔄</span>
                                <span>Reassign Sales</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setBaselineTab('preview')}
                                className={`pb-3 px-3.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                    baselineTab === 'preview'
                                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span>📸</span>
                                <span>Snapshot Baseline</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setBaselineTab('history');
                                    fetchBaselineHistory();
                                }}
                                className={`pb-3 px-3.5 text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                    baselineTab === 'history'
                                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span>📜</span>
                                <span>Baseline History & Revert</span>
                                {baselineHistory.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-700 rounded-full font-bold">
                                        {baselineHistory.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Feedback Banner (Success / Error) */}
                            {adjustFeedback && (
                                <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-fade-in ${
                                    adjustFeedback.type === 'success'
                                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                                        : 'bg-rose-50 border border-rose-200 text-rose-900'
                                }`}>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base">{adjustFeedback.type === 'success' ? '✅' : '⚠️'}</span>
                                        <span className="leading-relaxed">{adjustFeedback.message}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustFeedback(null)}
                                        className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-black/5 text-xs font-bold cursor-pointer transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Inline Action Confirmation Prompt (No Browser Alert / Confirm) */}
                            {confirmAction && (
                                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-amber-100 text-amber-900 rounded-xl text-base shrink-0">
                                            ⚠️
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                                                {confirmAction.title || 'Please Confirm Action'}
                                            </h5>
                                            <p className="text-xs text-amber-900 mt-1 whitespace-pre-line leading-relaxed font-medium">
                                                {confirmAction.message}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-200/80">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmAction(null)}
                                            className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 rounded-xl hover:bg-gray-50 transition-all cursor-pointer shadow-xs active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const fn = confirmAction.onConfirm;
                                                setConfirmAction(null);
                                                if (fn) await fn();
                                            }}
                                            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer ${
                                                confirmAction.type === 'danger'
                                                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                                            }`}
                                        >
                                            {confirmAction.confirmText || 'Yes, Proceed'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {(baselineTab === 'adjust' || baselineTab === 'reassign') ? (
                                <div className="space-y-5">
                            {/* Zero Effect on LC Receive Guarantee Banner */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs">
                                <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                                    ✓
                                </div>
                                <div className="text-xs text-emerald-900 leading-relaxed">
                                    <strong>Zero Effect on LC Receive:</strong> Changes made here only adjust warehouse stock allocations or reassign sales invoice LC tags in Stock Management. It will <strong>never modify or touch your original LC Receive, Deal Receive, or port arrival documents</strong>.
                                </div>
                            </div>

                            {/* Mode Selection Tabs */}
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                <button
                                    type="button"
                                    onClick={() => { setBaselineTab('adjust'); setConfirmAction(null); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                        baselineTab === 'adjust'
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    <span>⚡</span>
                                    <span>Adjust Stock Quantity (Add / Reduce / Set)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setBaselineTab('reassign'); setConfirmAction(null); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                        baselineTab === 'reassign'
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    <span>🔄</span>
                                    <span>Reassign Sales Invoices between LCs</span>
                                </button>
                            </div>

                            {/* Manual Selection Form */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">
                                    1. Select Product, Brand & LC Number
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Warehouse */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-1">
                                            Warehouse
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={manualFixWarehouse}
                                                onChange={(e) => setManualFixWarehouse(e.target.value)}
                                                className="w-full appearance-none bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer"
                                            >
                                                <option value="All">All Warehouses</option>
                                                {warehouseOptions.map(wh => (
                                                    <option key={wh} value={wh}>{wh}</option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Product */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-1">
                                            Product Name *
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={manualFixProduct}
                                                onChange={(e) => {
                                                    setManualFixProduct(e.target.value);
                                                    setSelectedFixInvoices(new Set());
                                                    setAdjustFeedback(null);
                                                    setConfirmAction(null);
                                                }}
                                                className="w-full appearance-none bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer"
                                            >
                                                <option value="">-- Select Product --</option>
                                                {manualFixProductOptions.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Brand */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider pl-1">
                                            Brand *
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={manualFixBrand}
                                                onChange={(e) => {
                                                    setManualFixBrand(e.target.value);
                                                    setSelectedFixInvoices(new Set());
                                                    setAdjustFeedback(null);
                                                    setConfirmAction(null);
                                                }}
                                                className="w-full appearance-none bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-xs font-semibold text-gray-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer"
                                            >
                                                <option value="">-- Select Brand --</option>
                                                {manualFixBrandOptions.map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* LC Selection */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider pl-1">
                                            Selected LC Number
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={adjustLcNo}
                                                onChange={(e) => {
                                                    setAdjustLcNo(e.target.value);
                                                    setManualFixFromLc(e.target.value);
                                                    setSelectedFixInvoices(new Set());
                                                    setAdjustFeedback(null);
                                                    setConfirmAction(null);
                                                }}
                                                className="w-full appearance-none bg-indigo-50/40 border border-indigo-200 hover:border-indigo-300 rounded-xl px-4 py-2.5 pr-10 text-xs font-bold text-indigo-950 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer font-mono"
                                            >
                                                <option value="">-- Blank / No LC --</option>
                                                {manualFixFromLcOptions.map(lc => (
                                                    <option key={lc} value={lc}>{lc}</option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {baselineTab === 'reassign' && (
                                    <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="space-y-1.5 w-full sm:w-1/2">
                                            <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider pl-1">
                                                Target / To LC *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 087326010601"
                                                    value={manualFixToLc}
                                                    onChange={(e) => setManualFixToLc(e.target.value)}
                                                    list="manualFixTargetLcList"
                                                    className="w-full bg-indigo-50/40 border border-indigo-200 hover:border-indigo-300 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-950 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all font-mono"
                                                />
                                                <datalist id="manualFixTargetLcList">
                                                    {manualFixTargetLcOptions.map(lc => (
                                                        <option key={lc} value={lc} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Current LC Stock Breakdown Cards */}
                            {manualFixProduct && manualFixBrand && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                            <span>Current Stock Status for:</span>
                                            <span className="text-gray-900 font-bold">{manualFixProduct}</span>
                                            <span>•</span>
                                            <span className="text-indigo-700 font-bold">{manualFixBrand}</span>
                                        </h4>
                                        <span className="text-xs text-gray-400 font-medium">
                                            Click an LC card to select it for adjustment
                                        </span>
                                    </div>

                                    {manualFixLcBreakdown.length === 0 ? (
                                        <div className="text-xs text-gray-500 italic py-3 text-center bg-gray-50 rounded-xl">
                                            No stock records currently found for this brand in the selected warehouse.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {manualFixLcBreakdown.map((item, idx) => {
                                                const isNeg = (item.closingQuantity || 0) < -0.001;
                                                const isZero = Math.abs(item.closingQuantity || 0) <= 0.001;
                                                const isBlank = !item.lcNo || item.lcNo === '' || item.lcNo === '0000' || item.lcNo === '-';
                                                const isSelected = isBlank
                                                    ? (!adjustLcNo || adjustLcNo === '' || adjustLcNo === '0000')
                                                    : ((adjustLcNo || '').toLowerCase() === (item.lcNo || '').toLowerCase());
                                                const pkt = calculatePktRemainder(item.closingQuantity, item.packetSize);

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            setAdjustLcNo(isBlank ? '' : item.lcNo);
                                                            setManualFixFromLc(isBlank ? '' : item.lcNo);
                                                            if (manualFixWarehouse === 'All') setManualFixWarehouse(item.warehouse);
                                                            setAdjustFeedback(null);
                                                            setConfirmAction(null);
                                                        }}
                                                        className={`p-4 rounded-2xl border text-xs flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                                                            isSelected
                                                                ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500 shadow-md scale-[1.01]'
                                                                : (isNeg
                                                                    ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300 hover:shadow-xs'
                                                                    : (isZero
                                                                        ? 'bg-gray-50/80 border-gray-200 hover:border-gray-300 hover:shadow-xs'
                                                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'))
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="font-mono font-bold text-gray-900 text-xs bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                                                                    {isBlank ? 'Blank / No LC' : `LC: ${item.lcNo}`}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                                    isNeg
                                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                        : (isZero
                                                                            ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                                                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                                                                }`}>
                                                                    {isNeg ? 'Pre-Sold' : (isZero ? 'Zero Stock' : 'In Stock')}
                                                                </span>
                                                            </div>

                                                            <div className="space-y-1 mt-2">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                                    {item.warehouse}
                                                                </div>
                                                                <div className={`text-lg font-black tracking-tight ${isNeg ? 'text-rose-600' : 'text-gray-900'}`}>
                                                                    {Math.round(item.closingQuantity || 0).toLocaleString('en-US')} <span className="text-xs font-semibold text-gray-500">kg</span>
                                                                </div>
                                                                <div className="text-[11px] font-medium text-gray-500">
                                                                    {pkt.whole.toLocaleString('en-US')} bags{pkt.remainder !== 0 ? ` - ${Math.abs(Math.round(pkt.remainder))} kg` : ''}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isSelected && (
                                                            <div className="mt-3 pt-2 border-t border-indigo-200 text-[10px] font-black text-indigo-700 flex items-center justify-center gap-1 uppercase tracking-wider">
                                                                <span>✓</span> Selected for Adjustment
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 1: Direct Stock Adjustment Component */}
                            {baselineTab === 'adjust' && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                                        <div>
                                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                                <span>2. Adjust Quantity for:</span>
                                                <span className="text-indigo-600 font-mono text-sm">
                                                    {selectedLcItem ? (selectedLcItem.lcNo && selectedLcItem.lcNo !== '0000' ? `LC ${selectedLcItem.lcNo}` : 'Blank / No LC') : (manualFixProduct && manualFixBrand ? 'Blank / No LC' : 'None selected')}
                                                </span>
                                            </h4>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                Add or reduce stock, or set exact physical count. LC Receive records will <strong>NOT</strong> be affected.
                                            </p>
                                        </div>

                                        {selectedLcItem && (
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                                                Warehouse: {selectedLcItem.warehouse}
                                            </span>
                                        )}
                                    </div>

                                    {/* Selected LC Status Summary */}
                                    {selectedLcItem ? (
                                        <div className="bg-gradient-to-r from-gray-50 to-indigo-50/30 rounded-2xl p-4 border border-indigo-100 space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                                        Current Closing Stock in Warehouse
                                                    </span>
                                                    <div className="flex items-baseline gap-2 mt-0.5">
                                                        <span className={`text-2xl font-black ${
                                                            selectedLcItem.closingQuantity < -0.001 ? 'text-rose-600' : 'text-gray-900'
                                                        }`}>
                                                            {Math.round(selectedLcItem.closingQuantity || 0).toLocaleString('en-US')} kg
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-600">
                                                            ({(() => {
                                                                const p = calculatePktRemainder(selectedLcItem.closingQuantity, selectedLcItem.packetSize || 30);
                                                                return `${p.whole.toLocaleString('en-US')} bags${p.remainder !== 0 ? ` - ${Math.abs(Math.round(p.remainder))} kg` : ''}`;
                                                            })()})
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Quick Zero Out Button if Negative */}
                                                    {selectedLcItem.closingQuantity < -0.001 && (
                                                        <button
                                                            type="button"
                                                            disabled={isAdjustingStock}
                                                            onClick={() => handleApplyStockAdjustment({
                                                                targetQuantity: 0,
                                                                mode: 'set',
                                                                note: 'Zero out negative placeholder balance'
                                                            })}
                                                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                                                        >
                                                            <span>⚡</span>
                                                            <span>One-Click Zero Out (Set to 0 kg)</span>
                                                        </button>
                                                    )}
                                                    <span className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-medium">
                                                        Bag Size: <strong className="text-gray-900">{selectedLcItem.packetSize || 30} kg</strong>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Negative warning banner if placeholder has negative balance */}
                                            {selectedLcItem.closingQuantity < -0.001 && (
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2 font-medium">
                                                    <span className="text-sm">⚠️</span>
                                                    <div>
                                                        This stock currently has a negative balance of <strong>{Math.round(Math.abs(selectedLcItem.closingQuantity)).toLocaleString()} kg</strong>. Click <strong>"One-Click Zero Out"</strong> to eliminate the discrepancy without touching any LC receive records.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl text-center">
                                            Please select a product and brand from above to adjust.
                                        </div>
                                    )}

                                    {/* Adjustment Mode Selection */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
                                                Select Adjustment Action
                                            </label>
                                            <div className="grid grid-cols-3 gap-2.5 max-w-lg">
                                                <button
                                                    type="button"
                                                    onClick={() => { setAdjustMode('add'); setAdjustFeedback(null); setConfirmAction(null); }}
                                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                                        adjustMode === 'add'
                                                            ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800'
                                                    }`}
                                                >
                                                    <span>➕</span>
                                                    <span>Add (+)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setAdjustMode('reduce'); setAdjustFeedback(null); setConfirmAction(null); }}
                                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                                        adjustMode === 'reduce'
                                                            ? 'bg-rose-600 text-white shadow-rose-600/20'
                                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-800'
                                                    }`}
                                                >
                                                    <span>➖</span>
                                                    <span>Reduce (-)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setAdjustMode('set'); setAdjustFeedback(null); setConfirmAction(null); }}
                                                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                                                        adjustMode === 'set'
                                                            ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800'
                                                    }`}
                                                >
                                                    <span>🎯</span>
                                                    <span>Set Exact</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Input Amount & Unit */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end max-w-2xl">
                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                    {adjustMode === 'add' ? 'Quantity to Add' : (adjustMode === 'reduce' ? 'Quantity to Reduce' : 'New Exact Target Stock')} *
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        placeholder={`Enter quantity in ${adjustUnit}...`}
                                                        value={adjustAmount}
                                                        onChange={(e) => { setAdjustAmount(e.target.value); setAdjustFeedback(null); setConfirmAction(null); }}
                                                        className="w-full text-sm font-bold px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all shadow-xs"
                                                    />
                                                    <div className="absolute right-2 top-1.5 flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                                                        <button
                                                            type="button"
                                                            onClick={() => setAdjustUnit('bag')}
                                                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                                adjustUnit === 'bag' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            Bag
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAdjustUnit('kg')}
                                                            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                                                adjustUnit === 'kg' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        >
                                                            kg
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Note / Reason */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                    Adjustment Reason
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Physical stock count"
                                                    value={adjustNote}
                                                    onChange={(e) => setAdjustNote(e.target.value)}
                                                    className="w-full text-xs font-medium px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all shadow-xs"
                                                />
                                            </div>
                                        </div>

                                        {/* Quick Bag Pills */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[11px] text-gray-400 font-semibold mr-1">Quick Bags:</span>
                                            {[1, 5, 10, 20, 50, 100].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => {
                                                        setAdjustUnit('bag');
                                                        setAdjustAmount(val.toString());
                                                        setAdjustFeedback(null);
                                                        setConfirmAction(null);
                                                    }}
                                                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-gray-700 hover:text-indigo-700 transition-all cursor-pointer shadow-xs active:scale-95"
                                                >
                                                    {adjustMode === 'reduce' ? `-${val}` : `+${val}`} bag{val > 1 ? 's' : ''}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Real-time Resulting Stock Preview Box */}
                                        {selectedLcItem && adjustAmount && !isNaN(parseFloat(adjustAmount)) && (
                                            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-2">
                                                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                                                    Live Adjustment Calculation Preview
                                                </span>
                                                {(() => {
                                                    const cur = selectedLcItem.closingQuantity !== undefined ? selectedLcItem.closingQuantity : (selectedLcItem.inHouseQuantity || 0);
                                                    const pSize = selectedLcItem.packetSize || 30;
                                                    const rawAmt = parseFloat(adjustAmount) || 0;
                                                    const amtKg = adjustUnit === 'bag' ? rawAmt * pSize : rawAmt;
                                                    let resQty = cur;
                                                    if (adjustMode === 'add') resQty = cur + amtKg;
                                                    else if (adjustMode === 'reduce') resQty = cur - amtKg;
                                                    else resQty = amtKg;

                                                    const curB = calculatePktRemainder(cur, pSize);
                                                    const resB = calculatePktRemainder(resQty, pSize);

                                                    return (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                                            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                                                                <span className="text-gray-500 block text-[10px] uppercase font-bold">Current Stock</span>
                                                                <span className="text-sm font-black text-gray-800 block">{Math.round(cur).toLocaleString()} kg</span>
                                                                <span className="text-[11px] text-gray-500">{curB.whole.toLocaleString()} bags</span>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                                                                <span className="text-gray-500 block text-[10px] uppercase font-bold">Adjustment</span>
                                                                <span className={`text-sm font-black block ${
                                                                    adjustMode === 'reduce' ? 'text-rose-600' : 'text-emerald-600'
                                                                }`}>
                                                                    {adjustMode === 'reduce' ? '-' : (adjustMode === 'add' ? '+' : '= ')}{Math.round(amtKg).toLocaleString()} kg
                                                                </span>
                                                                <span className="text-[11px] text-gray-500">
                                                                    ({(amtKg / pSize).toFixed(1)} bags)
                                                                </span>
                                                            </div>
                                                            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-xs">
                                                                <span className="text-indigo-200 block text-[10px] uppercase font-bold">Resulting Closing Stock</span>
                                                                <span className="text-base font-black block">{Math.round(resQty).toLocaleString()} kg</span>
                                                                <span className="text-[11px] text-indigo-100">{resB.whole.toLocaleString()} bags{resB.remainder !== 0 ? ` - ${Math.abs(Math.round(resB.remainder))} kg` : ''}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {/* Apply Stock Adjustment Button */}
                                        <div className="pt-2">
                                            <button
                                                type="button"
                                                disabled={isAdjustingStock || !selectedLcItem || !adjustAmount || isNaN(parseFloat(adjustAmount))}
                                                onClick={() => handleApplyStockAdjustment()}
                                                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                                            >
                                                <span>✓</span>
                                                <span>{isAdjustingStock ? 'Applying Stock Adjustment...' : 'Apply Stock Adjustment (Zero Effect on LC Receive)'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Matching Sales Invoices Section */}
                            {baselineTab === 'reassign' && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                                            2. Select Sales Invoices to Reassign ({manualFixMatchingInvoices.length} found under {manualFixFromLc ? `LC ${manualFixFromLc}` : 'Blank / No LC'})
                                        </h4>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Select which sales to reassign to <strong>LC {manualFixToLc || '...'}</strong>.
                                        </p>
                                    </div>

                                    {manualFixMatchingInvoices.length > 0 && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (selectedFixInvoices.size === manualFixMatchingInvoices.length) {
                                                        setSelectedFixInvoices(new Set());
                                                    } else {
                                                        setSelectedFixInvoices(new Set(manualFixMatchingInvoices.map(i => i.invoiceNo)));
                                                    }
                                                }}
                                                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 transition-all cursor-pointer"
                                            >
                                                {selectedFixInvoices.size === manualFixMatchingInvoices.length ? 'Deselect All' : 'Select All'}
                                            </button>

                                            {/* Quick select to cover negative closing */}
                                            {(() => {
                                                const negClosing = manualFixLcBreakdown.find(i => i.lcNo === manualFixFromLc && i.closingQuantity < -0.001);
                                                if (negClosing) {
                                                    const neededQty = Math.abs(negClosing.closingQuantity);
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                let acc = 0;
                                                                const newSet = new Set();
                                                                for (const inv of manualFixMatchingInvoices) {
                                                                    newSet.add(inv.invoiceNo);
                                                                    acc += inv.quantity;
                                                                    if (acc >= neededQty) break;
                                                                }
                                                                setSelectedFixInvoices(newSet);
                                                            }}
                                                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 transition-all cursor-pointer"
                                                        >
                                                            Select to Cover Pre-Sold ({neededQty.toLocaleString('en-US')} kg)
                                                        </button>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {manualFixMatchingInvoices.length === 0 ? (
                                    <div className="p-8 text-center bg-gray-50 rounded-xl text-gray-500 text-xs italic">
                                        No sales records found for {manualFixProduct || 'the selected product'} - {manualFixBrand || 'brand'} under LC {manualFixFromLc}.
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-gray-100 sticky top-0 border-b border-gray-200 z-10">
                                                <tr>
                                                    <th className="px-3 py-2 w-10 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedFixInvoices.size === manualFixMatchingInvoices.length && manualFixMatchingInvoices.length > 0}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedFixInvoices(new Set(manualFixMatchingInvoices.map(i => i.invoiceNo)));
                                                                } else {
                                                                    setSelectedFixInvoices(new Set());
                                                                }
                                                            }}
                                                            className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    </th>
                                                    <th className="px-3 py-2 font-bold text-gray-600">Invoice No</th>
                                                    <th className="px-3 py-2 font-bold text-gray-600">Date</th>
                                                    <th className="px-3 py-2 font-bold text-gray-600">Customer</th>
                                                    <th className="px-3 py-2 font-bold text-gray-600">Warehouse</th>
                                                    <th className="px-3 py-2 font-bold text-gray-600 text-right">Sold Qty (kg)</th>
                                                    <th className="px-3 py-2 font-bold text-gray-600 text-center">Current LC</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {manualFixMatchingInvoices.map((inv, idx) => {
                                                    const isChecked = selectedFixInvoices.has(inv.invoiceNo);
                                                    return (
                                                        <tr
                                                            key={idx}
                                                            onClick={() => {
                                                                const next = new Set(selectedFixInvoices);
                                                                if (next.has(inv.invoiceNo)) next.delete(inv.invoiceNo);
                                                                else next.add(inv.invoiceNo);
                                                                setSelectedFixInvoices(next);
                                                            }}
                                                            className={`cursor-pointer transition-colors ${
                                                                isChecked ? 'bg-indigo-50/40' : 'hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        const next = new Set(selectedFixInvoices);
                                                                        if (next.has(inv.invoiceNo)) next.delete(inv.invoiceNo);
                                                                        else next.add(inv.invoiceNo);
                                                                        setSelectedFixInvoices(next);
                                                                    }}
                                                                    className="rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 font-bold text-gray-900">{inv.invoiceNo}</td>
                                                            <td className="px-3 py-2 text-gray-600">{inv.date ? String(inv.date).split('T')[0] : '—'}</td>
                                                            <td className="px-3 py-2 font-medium text-gray-800">{inv.customer}</td>
                                                            <td className="px-3 py-2 text-gray-600">{inv.warehouse}</td>
                                                            <td className="px-3 py-2 text-right font-black text-gray-900">{inv.quantity.toLocaleString('en-US')} kg</td>
                                                            <td className="px-3 py-2 text-center font-mono text-red-600 font-bold">{inv.lcNo}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Action Bar */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="text-xs text-gray-700">
                                        Selected: <strong>{selectedFixInvoices.size} invoices</strong>
                                        {' '}• Total Qty:{' '}
                                        <strong className="text-indigo-700">
                                            {manualFixMatchingInvoices
                                                .filter(i => selectedFixInvoices.has(i.invoiceNo))
                                                .reduce((sum, i) => sum + i.quantity, 0)
                                                .toLocaleString('en-US')} kg
                                        </strong>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={manualFixLoading || selectedFixInvoices.size === 0 || !manualFixToLc}
                                        onClick={handleManualFixReassign}
                                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {manualFixLoading ? 'Updating Invoices...' : `Fix & Reassign ${selectedFixInvoices.size} Invoices to LC ${manualFixToLc || '...'}`}
                                    </button>
                                </div>
                            </div>
                            )}

                            {/* Auto-Offset Live View Toggle */}
                            <div className="bg-white border border-indigo-100 p-4 rounded-2xl shadow-xs flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <h5 className="text-xs font-bold text-gray-900">Auto-Offset in Real-Time View</h5>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isOffsetZeroLcActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {isOffsetZeroLcActive ? 'Active' : 'Disabled'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-gray-500">
                                        Keeps Show Rate balanced on-the-fly by absorbing placeholder sales into positive LC stock.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = !isOffsetZeroLcActive;
                                        setIsOffsetZeroLcActive(next);
                                        localStorage.setItem('stock_offset_zero_lc', String(next));
                                    }}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                        isOffsetZeroLcActive ? 'bg-indigo-600' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                            isOffsetZeroLcActive ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    ) : baselineTab === 'preview' ? (
                        (() => {
                                    const { snapshotRecords, summary } = generateCurrentStockSnapshot();
                                    const filteredSnapshot = snapshotRecords.filter(item => {
                                        if (baselineWhFilter !== 'All' && item.warehouse !== baselineWhFilter) return false;
                                        if (baselineSearchQuery) {
                                            const q = baselineSearchQuery.toLowerCase();
                                            return item.productName.toLowerCase().includes(q) ||
                                                item.brand.toLowerCase().includes(q) ||
                                                (item.lcNo || '').toLowerCase().includes(q) ||
                                                item.warehouse.toLowerCase().includes(q);
                                        }
                                        return true;
                                    });

                                    const uniqueWhs = Array.from(new Set(snapshotRecords.map(s => s.warehouse))).sort();

                                    return (
                                        <div className="space-y-6">
                                            {/* Active Baseline Status Card */}
                                            {activeBaseline && (
                                                <div className="p-4 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs">
                                                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                        <span className="flex h-3.5 w-3.5 relative shrink-0 mt-0.5 sm:mt-0">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                                                        </span>
                                                        <div className="text-xs md:text-sm text-amber-900 font-medium">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-bold text-amber-950 text-sm">Initial Stage Active:</span>
                                                                <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-200/80 text-amber-900 rounded-md">In Effect</span>
                                                            </div>
                                                            <div className="mt-1 text-amber-950">
                                                                Current stock is calculated from baseline established on{' '}
                                                                <span className="font-bold underline decoration-amber-300">
                                                                    {new Date(activeBaseline.baselineDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                                                </span>
                                                                {activeBaseline.setBy && <span className="text-amber-800"> by <b>{activeBaseline.setBy}</b></span>}
                                                                {activeBaseline.note && <span className="text-amber-800 italic"> — "{activeBaseline.note}"</span>}
                                                            </div>
                                                            {Array.isArray(activeBaseline.snapshotRecords) && (
                                                                <div className="text-[11px] text-amber-700 mt-1">
                                                                    Snapshot contains <b>{activeBaseline.snapshotRecords.length} items</b> across <b>{new Set(activeBaseline.snapshotRecords.map(s => s.warehouse)).size} warehouse(s)</b> ({Math.round(activeBaseline.snapshotRecords.reduce((sum, s) => sum + (parseFloat(s.quantity ?? s.inHouseQuantity) || 0), 0)).toLocaleString('en-US')} kg).
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setBaselineTab('history');
                                                            fetchBaselineHistory();
                                                        }}
                                                        className="text-xs font-bold text-amber-950 hover:text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 active:scale-95"
                                                    >
                                                        Manage / Revert Baseline →
                                                    </button>
                                                </div>
                                            )}

                                            {/* Informative Notice Banner */}
                                            <div className="p-4 bg-blue-50/80 border border-blue-100 rounded-2xl text-xs md:text-sm text-blue-900 flex items-start gap-3 shadow-xs">
                                                <div className="p-1 bg-blue-100 rounded-lg text-blue-600 shrink-0 mt-0.5">ℹ️</div>
                                                <div>
                                                    <div className="font-bold text-blue-950 mb-1">How this works:</div>
                                                    Setting the initial stage will capture the <b>exact current In-House / Closing Stock</b> across all warehouses and establish it as Day 1 Opening Stock starting from the cutoff timestamp.
                                                    <ul className="list-disc ml-5 mt-1.5 space-y-0.5 text-blue-800">
                                                        <li><b>Non-destructive:</b> All past sales, customer invoices, and customer ledgers remain 100% intact.</li>
                                                        <li><b>Automated Safety Backup:</b> A full database backup file will be created on the server prior to applying.</li>
                                                        <li><b>Reversible:</b> You can revert back to full historical calculation at any time from the History tab.</li>
                                                    </ul>
                                                </div>
                                            </div>

                                            {/* Summary Cards */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Warehouses</div>
                                                    <div className="text-lg font-extrabold text-slate-800 mt-1">{summary.totalWarehouses}</div>
                                                </div>
                                                <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-3.5 text-center">
                                                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Products</div>
                                                    <div className="text-lg font-extrabold text-blue-800 mt-1">{summary.totalProducts}</div>
                                                </div>
                                                <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-3.5 text-center">
                                                    <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Brands</div>
                                                    <div className="text-lg font-extrabold text-indigo-800 mt-1">{summary.totalBrands}</div>
                                                </div>
                                                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 text-center">
                                                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">In-House Bag</div>
                                                    <div className="text-lg font-extrabold text-emerald-800 mt-1">{Math.round(summary.totalInHousePacket).toLocaleString('en-US')}</div>
                                                </div>
                                                <div className="bg-teal-50/50 border border-teal-200 rounded-2xl p-3.5 text-center">
                                                    <div className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">In-House QTY (kg)</div>
                                                    <div className="text-lg font-extrabold text-teal-800 mt-1">{Math.round(summary.totalInHouseQuantity).toLocaleString('en-US')}</div>
                                                </div>
                                                <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-3.5 text-center">
                                                    <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Total Valuation</div>
                                                    <div className="text-lg font-extrabold text-purple-800 mt-1">৳{Math.round(summary.totalValuation).toLocaleString('en-IN')}</div>
                                                </div>
                                            </div>

                                            {/* Preview Table Header & Search */}
                                            <div className="space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                        <span>Preview of Items Becoming Initial Stock ({filteredSnapshot.length} entries)</span>
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <div className="relative">
                                                            <select
                                                                value={baselineWhFilter}
                                                                onChange={(e) => setBaselineWhFilter(e.target.value)}
                                                                className="appearance-none text-xs border border-gray-200 hover:border-gray-300 rounded-xl px-3.5 py-1.5 pr-8 bg-white font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                                                            >
                                                                <option value="All">All Warehouses ({uniqueWhs.length})</option>
                                                                {uniqueWhs.map(w => (
                                                                    <option key={w} value={w}>{w}</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Search product / brand / LC..."
                                                                value={baselineSearchQuery}
                                                                onChange={(e) => setBaselineSearchQuery(e.target.value)}
                                                                className="text-xs pl-8 pr-3 py-1.5 border border-gray-300 rounded-xl bg-white font-medium text-gray-700 w-48 md:w-60 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                                            />
                                                            <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Scrollable Table */}
                                                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto shadow-inner bg-gray-50/30">
                                                    <table className="w-full text-left text-xs border-collapse">
                                                        <thead className="bg-gray-100/80 sticky top-0 border-b border-gray-200 z-10">
                                                            <tr>
                                                                <th className="px-3 py-2.5 font-bold text-gray-600">Warehouse</th>
                                                                <th className="px-3 py-2.5 font-bold text-gray-600">Product Name</th>
                                                                <th className="px-3 py-2.5 font-bold text-gray-600">Brand</th>
                                                                <th className="px-3 py-2.5 font-bold text-gray-600">LC No</th>
                                                                <th className="px-3 py-2.5 font-bold text-gray-600 text-center">Pkt Size</th>
                                                                <th className="px-3 py-2.5 font-bold text-emerald-700 text-right">In-House Bag</th>
                                                                <th className="px-3 py-2.5 font-bold text-emerald-700 text-right">In-House Qty (kg)</th>
                                                                <th className="px-3 py-2.5 font-bold text-purple-700 text-right">Rate</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 bg-white">
                                                            {filteredSnapshot.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan="8" className="px-4 py-8 text-center text-gray-400 italic">
                                                                        No in-house stock items found matching your filters.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                filteredSnapshot.map((item, idx) => (
                                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                                        <td className="px-3 py-2 font-medium text-gray-800">{item.warehouse}</td>
                                                                        <td className="px-3 py-2 font-semibold text-gray-900">{item.productName}</td>
                                                                        <td className="px-3 py-2 text-gray-700">{item.brand}</td>
                                                                        <td className="px-3 py-2 text-purple-700 font-medium">{item.lcNo || '—'}</td>
                                                                        <td className="px-3 py-2 text-center text-gray-600">{item.packetSize} kg</td>
                                                                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{Math.round(item.inHousePacket).toLocaleString('en-US')}</td>
                                                                        <td className="px-3 py-2 text-right font-bold text-emerald-800">{Math.round(item.inHouseQuantity).toLocaleString('en-US')}</td>
                                                                        <td className="px-3 py-2 text-right text-purple-800 font-medium">{item.rate ? `৳${parseFloat(item.rate).toFixed(2)}` : '—'}</td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Baseline Configuration Form */}
                                            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs">
                                                <h4 className="text-sm font-bold text-gray-900">Baseline Setup Details</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Baseline Title / Note</label>
                                                        <input
                                                            type="text"
                                                            value={baselineNote}
                                                            onChange={(e) => setBaselineNote(e.target.value)}
                                                            placeholder="e.g. Fiscal Year 2026 Opening Stock / Post-Audit Baseline"
                                                            className="w-full text-xs md:text-sm px-3.5 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="block text-xs font-bold text-gray-700">Baseline Cutoff Timestamp</label>
                                                            <button
                                                                type="button"
                                                                onClick={() => setBaselineCutoffDate(getLocalDatetimeInputValue())}
                                                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                            >
                                                                Set to Now
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="datetime-local"
                                                            value={baselineCutoffDate || ''}
                                                            onChange={(e) => setBaselineCutoffDate(e.target.value)}
                                                            className="w-full text-xs md:text-sm px-3.5 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Safety Confirmation Step */}
                                                <div className="pt-3 border-t border-gray-200">
                                                    <label className="block text-xs font-bold text-red-700 mb-1">
                                                        To confirm, please type <span className="font-extrabold underline tracking-wider">CONFIRM</span> below:
                                                    </label>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <input
                                                            type="text"
                                                            value={baselineConfirmText}
                                                            onChange={(e) => setBaselineConfirmText(e.target.value)}
                                                            placeholder="Type CONFIRM to activate"
                                                            className="flex-1 text-xs md:text-sm px-3.5 py-2.5 border-2 border-red-300 rounded-xl bg-white focus:outline-hidden focus:border-red-500 font-bold uppercase tracking-wider text-red-800"
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={baselineLoading || baselineConfirmText.trim().toUpperCase() !== 'CONFIRM'}
                                                            onClick={handleSetBaseline}
                                                            className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${baselineConfirmText.trim().toUpperCase() === 'CONFIRM' && !baselineLoading
                                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/25 active:scale-95'
                                                                : 'bg-gray-400 cursor-not-allowed opacity-60'
                                                                }`}
                                                        >
                                                            {baselineLoading ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    <span>Applying Baseline...</span>
                                                                </>
                                                            ) : (
                                                                <span>Establish Initial Stock Baseline</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : (
                                /* History & Revert Tab */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-gray-900">Historical Stock Baselines</h4>
                                        <button
                                            onClick={fetchBaselineHistory}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 bg-blue-50 rounded-lg"
                                        >
                                            Refresh History
                                        </button>
                                    </div>

                                    {baselineHistory.length === 0 ? (
                                        <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-400 italic text-sm">
                                            No stock baselines have been established yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {baselineHistory.map((bh) => {
                                                const isActive = bh.status === 'active';
                                                const isReverted = bh.status === 'reverted';
                                                const isArchived = bh.status === 'archived';

                                                return (
                                                    <div
                                                        key={bh._id}
                                                        className={`p-4 rounded-2xl border transition-all ${isActive
                                                            ? 'bg-amber-50/70 border-amber-300 shadow-sm ring-1 ring-amber-300'
                                                            : (isReverted ? 'bg-gray-50 border-gray-200 opacity-80' : 'bg-white border-gray-200')
                                                            }`}
                                                    >
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2.5">
                                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide ${isActive
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : (isReverted ? 'bg-gray-200 text-gray-700' : 'bg-blue-100 text-blue-800')
                                                                        }`}>
                                                                        {isActive ? 'Active Baseline' : (isReverted ? 'Reverted' : 'Archived')}
                                                                    </span>
                                                                    <h5 className="font-bold text-gray-900 text-sm">{bh.note || 'Initial Stock Baseline'}</h5>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1.5 space-x-2">
                                                                    <span><b>Cutoff:</b> {new Date(bh.baselineDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                                    <span>•</span>
                                                                    <span><b>Set by:</b> {bh.setBy || 'Admin'}</span>
                                                                    <span>•</span>
                                                                    <span><b>Created:</b> {new Date(bh.createdAt).toLocaleDateString()}</span>
                                                                    {bh.backupFile && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-blue-600 font-mono text-[11px]">📁 {bh.backupFile}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {bh.summary && (
                                                                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-700">
                                                                        <span className="bg-gray-100 px-2 py-0.5 rounded-md">Items: <b>{(bh.snapshotRecords || []).length}</b></span>
                                                                        <span className="bg-gray-100 px-2 py-0.5 rounded-md">Warehouses: <b>{bh.summary.totalWarehouses || 0}</b></span>
                                                                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-semibold">Total Bags: <b>{Math.round(bh.summary.totalInHousePacket || 0).toLocaleString('en-US')}</b></span>
                                                                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-semibold">Total Qty: <b>{Math.round(bh.summary.totalInHouseQuantity || 0).toLocaleString('en-US')} kg</b></span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {isActive ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={baselineLoading}
                                                                    onClick={() => handleRevertBaseline(bh._id)}
                                                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer shrink-0"
                                                                >
                                                                    {baselineLoading ? 'Reverting...' : 'Revert Baseline'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={baselineLoading}
                                                                    onClick={() => handleActivateBaseline(bh._id)}
                                                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer shrink-0"
                                                                >
                                                                    {baselineLoading ? 'Activating...' : 'Activate Baseline'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setShowBaselineModal(false)}
                                className="px-5 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-sm cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}



        </div >
    );
};

export default StockManagement;
