import React, { useState, useMemo, useRef, useEffect } from 'react';
import axios from '../../../utils/api';
import {
    SearchIcon, FunnelIcon, XIcon, BarChartIcon, EditIcon, TrashIcon, BoxIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon, EyeIcon, CheckIcon
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import { encryptData, decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './LCReceive.css';

const ViewDetailsModal = ({ data, onClose }) => {
    if (!data) return null;

    const uniqueEntriesMap = data.entries.reduce((acc, item) => {
        const key = `${item.productName}-${item.brand}-${item.truckNo}-${item.unit}`;
        if (!acc[key]) {
            acc[key] = { ...item, quantity: 0, sweepedQuantity: 0, inHouseQuantity: 0 };
        }
        acc[key].quantity += (parseFloat(item.quantity) || 0);
        acc[key].sweepedQuantity += (parseFloat(item.sweepedQuantity) || 0);
        acc[key].inHouseQuantity += (parseFloat(item.inHouseQuantity) || 0);
        return acc;
    }, {});
    const uniqueEntries = Object.values(uniqueEntriesMap);

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">LC Receive Details</h3>
                        <p className="text-xs text-gray-500 font-medium">Grouped Record • {formatDate(data.date)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6">
                    {/* Core Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">LC No</span>
                            <p className="text-sm font-bold text-gray-800">{data.lcNo || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Port</span>
                            <p className="text-sm font-bold text-blue-600">{data.port || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Importer</span>
                            <p className="text-sm font-medium text-gray-700 truncate">{data.importer || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exporter</span>
                            <p className="text-sm font-medium text-gray-700 truncate">{data.exporter || 'N/A'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-50">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IND C&F</span>
                            <p className="text-sm text-gray-700 font-medium">{data.indianCnF || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">IND Cost</span>
                            <p className="text-sm text-gray-700 font-bold">{!isNaN(parseFloat(data.indCnFCost)) ? `৳${parseFloat(data.indCnFCost).toLocaleString()}` : '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">BD C&F</span>
                            <p className="text-sm text-gray-700 font-medium">{data.bdCnF || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">BD Cost</span>
                            <p className="text-sm text-gray-700 font-bold">{!isNaN(parseFloat(data.bdCnFCost)) ? `৳${parseFloat(data.bdCnFCost).toLocaleString()}` : '-'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bill Of Entry</span>
                            <p className="text-sm text-gray-700 font-bold">{data.billOfEntry || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Trucks</span>
                            <p className="text-sm text-amber-600 font-black">{data.totalLcTruck}</p>
                        </div>
                    </div>

                    {/* Product Table */}
                    <div className="space-y-3 pt-4 border-t border-gray-50">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <BoxIcon className="w-3.5 h-3.5" />
                            Product Summary
                        </h4>

                        {/* Desktop table — hidden on mobile */}
                        <div className="hidden sm:block bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/50">
                                        <th className="px-4 py-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter">Product</th>
                                        <th className="px-4 py-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter">Brand</th>
                                        <th className="px-4 py-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter text-center">Truck</th>
                                        <th className="px-4 py-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter text-right">Arrival Qty</th>
                                        <th className="px-4 py-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter text-right text-red-500">Short</th>
                                        <th className="px-4 py-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter text-right text-blue-600">In Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(() => {
                                        // Build rowspan rows: product span + truck span within each product group
                                        const rows = [];
                                        let i = 0;
                                        while (i < uniqueEntries.length) {
                                            const product = uniqueEntries[i].productName;
                                            // Count how many consecutive rows share this product
                                            let productSpan = 1;
                                            while (i + productSpan < uniqueEntries.length && uniqueEntries[i + productSpan].productName === product) productSpan++;

                                            // Within the product group, sub-group by truckNo
                                            let j = 0;
                                            while (j < productSpan) {
                                                const truck = uniqueEntries[i + j].truckNo;
                                                let truckSpan = 1;
                                                while (j + truckSpan < productSpan && uniqueEntries[i + j + truckSpan].truckNo === truck) truckSpan++;
                                                for (let k = 0; k < truckSpan; k++) {
                                                    rows.push({
                                                        item: uniqueEntries[i + j + k],
                                                        isProductFirst: j === 0 && k === 0,
                                                        productSpan,
                                                        isTruckFirst: k === 0,
                                                        truckSpan,
                                                    });
                                                }
                                                j += truckSpan;
                                            }
                                            i += productSpan;
                                        }
                                        return rows.map(({ item, isProductFirst, productSpan, isTruckFirst, truckSpan }, idx) => (
                                            <tr key={idx} className="hover:bg-white transition-colors">
                                                {isProductFirst && (
                                                    <td rowSpan={productSpan} className="px-4 py-2 text-xs font-bold text-gray-800 align-middle border-r border-gray-100">
                                                        {item.productName}
                                                    </td>
                                                )}
                                                <td className="px-4 py-2 text-xs text-purple-700 font-semibold">{item.brand || '-'}</td>
                                                {isTruckFirst && (
                                                    <td rowSpan={truckSpan} className="px-4 py-2 text-xs text-gray-600 text-center font-medium align-middle border-l border-gray-100">
                                                        {item.truckNo}
                                                    </td>
                                                )}
                                                <td className="px-4 py-2 text-xs text-gray-900 text-right font-bold">{Math.round(item.quantity).toLocaleString()} kg</td>
                                                <td className="px-4 py-2 text-xs text-red-500 text-right font-bold">{Math.round(item.sweepedQuantity).toLocaleString()} kg</td>
                                                <td className="px-4 py-2 text-xs text-blue-600 text-right font-black">{Math.round(item.inHouseQuantity).toLocaleString()} kg</td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-white/80 border-t border-gray-200">
                                        <td colSpan="3" className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase text-right">Grand Totals</td>
                                        <td className="px-4 py-2 text-xs text-gray-900 text-right font-black">{Math.round(data.totalQuantity).toLocaleString()} kg</td>
                                        <td className="px-4 py-2 text-xs text-red-600 text-right font-black">{Math.round(data.entries.reduce((sum, e) => sum + (parseFloat(e.sweepedQuantity) || 0), 0)).toLocaleString()} kg</td>
                                        <td className="px-4 py-2 text-xs text-blue-700 text-right font-black">{Math.round(data.entries.reduce((sum, e) => sum + (parseFloat(e.inHouseQuantity) || 0), 0)).toLocaleString()} kg</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Mobile card layout — hidden on desktop */}
                        <div className="block sm:hidden space-y-3">
                            {(() => {
                                // Group by product, then sub-group by truckNo within each product
                                const groups = [];
                                let i = 0;
                                while (i < uniqueEntries.length) {
                                    const product = uniqueEntries[i].productName;
                                    const truckGroups = [];
                                    while (i < uniqueEntries.length && uniqueEntries[i].productName === product) {
                                        const truck = uniqueEntries[i].truckNo;
                                        const brands = [];
                                        while (i < uniqueEntries.length && uniqueEntries[i].productName === product && uniqueEntries[i].truckNo === truck) {
                                            brands.push(uniqueEntries[i]);
                                            i++;
                                        }
                                        truckGroups.push({ truck, brands });
                                    }
                                    groups.push({ product, truckGroups });
                                }
                                const multipleTrucks = (group) => group.truckGroups.length > 1;
                                return groups.map((group, gIdx) => (
                                    <div key={gIdx} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                        {/* Product name header */}
                                        <div className="px-3 py-2 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between">
                                            <p className="text-xs font-black text-gray-800">{group.product}</p>
                                            {/* Show single truck badge in header if only one truck */}
                                            {!multipleTrucks(group) && group.truckGroups[0]?.truck && (
                                                <span className="text-[10px] font-bold text-gray-500 bg-gray-200 rounded-md px-2 py-0.5">Truck {group.truckGroups[0].truck}</span>
                                            )}
                                        </div>
                                        {/* Truck sub-groups */}
                                        <div className="divide-y divide-gray-200">
                                            {group.truckGroups.map((tg, tIdx) => (
                                                <div key={tIdx}>
                                                    {/* Sub-truck header only if multiple trucks */}
                                                    {multipleTrucks(group) && tg.truck && (
                                                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-gray-500 bg-gray-200 rounded-md px-2 py-0.5">Truck {tg.truck}</span>
                                                        </div>
                                                    )}
                                                    {/* Brand rows */}
                                                    <div className="divide-y divide-gray-100">
                                                        {tg.brands.map((item, idx) => (
                                                            <div key={idx} className="p-3 space-y-2">
                                                                {item.brand && <p className="text-xs text-purple-700 font-semibold">{item.brand}</p>}
                                                                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-100">
                                                                    <div className="text-center">
                                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Arrival</p>
                                                                        <p className="text-xs font-bold text-gray-800">{Math.round(item.quantity).toLocaleString()} kg</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-wider mb-0.5">Short</p>
                                                                        <p className="text-xs font-bold text-red-500">{Math.round(item.sweepedQuantity).toLocaleString()} kg</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-0.5">In Qty</p>
                                                                        <p className="text-xs font-black text-blue-600">{Math.round(item.inHouseQuantity).toLocaleString()} kg</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                            {/* Mobile Grand Totals */}
                            <div className="bg-white rounded-xl border border-gray-200 p-3">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">Grand Totals</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">Arrival</p>
                                        <p className="text-xs font-black text-gray-900">{Math.round(data.totalQuantity).toLocaleString()} kg</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-wider mb-0.5">Short</p>
                                        <p className="text-xs font-black text-red-600">{Math.round(data.entries.reduce((sum, e) => sum + (parseFloat(e.sweepedQuantity) || 0), 0)).toLocaleString()} kg</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-0.5">In Qty</p>
                                        <p className="text-xs font-black text-blue-700">{Math.round(data.entries.reduce((sum, e) => sum + (parseFloat(e.inHouseQuantity) || 0), 0)).toLocaleString()} kg</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Requested By / Accepted By / Rejected By */}
                    {(data.entries[0]?.requestedBy || data.entries[0]?.acceptedBy || data.entries[0]?.rejectedBy) && (
                        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-50">
                            {data.entries[0]?.requestedBy && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested By</span>
                                    <p className="text-sm font-semibold text-gray-700">{data.entries[0].requestedBy}</p>
                                </div>
                            )}
                            {data.entries[0]?.acceptedBy && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Accepted By</span>
                                    <p className="text-sm font-semibold text-emerald-600">{data.entries[0].acceptedBy}</p>
                                </div>
                            )}
                            {data.entries[0]?.rejectedBy && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rejected By</span>
                                    <p className="text-sm font-semibold text-red-500">{data.entries[0].rejectedBy}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status/Warehouse Info */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-50">
                        <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Status: {data.entries[0]?.status || 'In Stock'}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg border border-gray-100 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Warehouse: {data.entries[0]?.warehouse || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-black transition-all active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

function LCReceive({
    currentUser,
    stockRecords,
    fetchStockRecords,
    importers,
    exporters = [],
    ports,
    products,
    brands,
    isSelectionMode,
    setIsSelectionMode,
    selectedItems,
    setSelectedItems,
    startLongPress,
    endLongPress,
    isLongPressTriggered,
    onDelete,
    setShowLcReport,
    lcSearchQuery,
    setLcSearchQuery,
    lcFilters,
    setLcFilters,
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
    lcReceiveRecords,
    lcReceiveSummary,
    fetchProducts,
    salesRecords = [],
    addNotification
}) {
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [warehouses, setWarehouses] = useState([]);
    const [allWhRecords, setAllWhRecords] = useState([]);
    const [whSearchQuery, setWhSearchQuery] = useState('');
    const [validationErrors, setValidationErrors] = useState([]);
    const [showWhSelectDropdown, setShowWhSelectDropdown] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);
    const [viewData, setViewData] = useState(null);
    const [isRequestedOnly, setIsRequestedOnly] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ChevronDownIcon className="w-3 h-3 ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        }
        return sortConfig.direction === 'desc' ?
            <ChevronDownIcon className="w-3 h-3 ml-1 text-blue-600" /> :
            <ChevronUpIcon className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const productRefs = useRef([]);
    const brandRefs = useRef({});
    const portRef = useRef(null);
    const importerRef = useRef(null);
    const canApprove = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'admin') return true;
        const role = (currentUser.role || '').toLowerCase();
        return ['admin', 'incharge', 'sales manager'].includes(role);
    }, [currentUser]);

    // Only the system admin account or employees with the Admin role can edit/delete accepted entries
    const canEditDelete = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.username === 'admin') return true;
        const role = (currentUser.role || '').toLowerCase();
        return role === 'admin';
    }, [currentUser]);
    const exporterRef = useRef(null);
    const whSelectRef = useRef(null);

    const fetchWarehouses = async () => {
        try {
            // Fetch from both sources
            const [whRes, stockRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/warehouses`),
                axios.get(`${API_BASE_URL}/api/stock`)
            ]);

            const whData = Array.isArray(whRes.data) ? whRes.data : [];
            const stockData = Array.isArray(stockRes.data) ? stockRes.data : [];

            // 1. Calculate Global InHouse Totals from ALL Stock Data
            // Stock records still have an encrypted .data field
            const globalInHouseMap = {};
            stockData.forEach(item => {
                try {
                    const d = item.data ? decryptData(item.data) : item;
                    const key = `${(d.productName || d.product || '').trim()}_${(d.brand || '').trim()}`;
                    if (!globalInHouseMap[key]) globalInHouseMap[key] = true;
                } catch { }
            });

            // 2. Warehouse records are now server-decrypted plain objects
            const allDecryptedWh = whData.map(item => {
                // item is already plain data; no need to decrypt
                const key = `${(item.product || item.productName || '').trim()}_${(item.brand || '').trim()}`;
                return {
                    ...item,
                    productName: item.product,
                    packetSize: item.packetSize || (item.whQty && item.whPkt ? (parseFloat(item.whQty) / parseFloat(item.whPkt)).toFixed(0) : 0),
                    hasLCRecord: globalInHouseMap[key] !== undefined
                };
            }).filter(Boolean);

            // Get unique warehouse names for the dropdown (from ALL warehouse records)
            const seen = new Set();
            const uniqueWarehouses = allDecryptedWh.filter(item => {
                if (item.whName && !seen.has(item.whName)) {
                    seen.add(item.whName);
                    return true;
                }
                return false;
            });

            // Filter for stock display (exclude metadata entries and orphaned records)
            const whStockOnly = allDecryptedWh.filter(d => d.product !== '-' && d.hasLCRecord).map(d => ({
                ...d,
                productName: d.product,
                whPkt: d.whPkt,
                whQty: d.whQty
            }));

            // Decrypt and normalize Stock records (stock still has encrypted .data)
            const decryptedStock = stockData.map(item => {
                try {
                    const d = item.data ? decryptData(item.data) : item;
                    const rawWh = (d.warehouse || '').trim();
                    if (!rawWh) return null;
                    return {
                        ...d,
                        whName: rawWh,
                        whPkt: (d.whPkt !== undefined && d.whPkt !== null) ? parseFloat(d.whPkt) : (parseFloat(d.inHousePacket) || 0),
                        whQty: (d.whQty !== undefined && d.whQty !== null) ? parseFloat(d.whQty) : (parseFloat(d.inHouseQuantity) || 0),
                        productName: d.productName || d.product,
                        packetSize: d.packetSize || d.size || 0,
                        hasLCRecord: true,
                        _id: item._id
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);

            // Combine for comprehensive view
            const allRecords = [...whStockOnly, ...decryptedStock];

            setWarehouses(uniqueWarehouses);
            setAllWhRecords(allRecords);
        } catch (err) {
            console.error('Failed to fetch warehouse data:', err);
        }
    };

    const toggleCard = (key) => {
        setExpandedCard(prev => prev === key ? null : key);
    };

    // Fetch warehouses
    useEffect(() => {
        fetchWarehouses();
    }, []);

    // Close warehouse dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (whSelectRef.current && !whSelectRef.current.contains(e.target)) {
                setShowWhSelectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedWhStock = useMemo(() => {
        const selectedWh = (stockFormData.warehouse || '').trim();
        if (!selectedWh || !allWhRecords.length) return null;

        // Filter by warehouse and ensure it has an LC source
        const filtered = allWhRecords.filter(r =>
            (r.whName || '').trim() === selectedWh &&
            r.hasLCRecord
        );

        // Calculate sales for this warehouse
        const whSalesMap = {};
        salesRecords.forEach(sale => {
            if (sale && sale.items && Array.isArray(sale.items)) {
                sale.items.forEach(saleItem => {
                    if (saleItem.brandEntries) {
                        saleItem.brandEntries.forEach(entry => {
                            if ((entry.warehouseName || '').trim() === selectedWh) {
                                const prodName = (saleItem.productName || '').trim();
                                const brandName = (entry.brand || '').trim();
                                const key = `${prodName}_${brandName}`;
                                if (!whSalesMap[key]) whSalesMap[key] = { qty: 0, pkt: 0 };
                                whSalesMap[key].qty += parseFloat(entry.quantity) || 0;
                                // We might need to estimate pkt if not present, but SaleManagement brandEntries usually only has quantity
                                // For now we focus on Qty as requested, or estimate pkt if size available
                            }
                        });
                    }
                });
            }
        });

        const groups = {};
        filtered.forEach(item => {
            const prodName = item.productName || 'Unnamed Product';
            const brandName = item.brand || 'No Brand';
            const key = `${prodName}_${brandName}`;

            if (!groups[prodName]) {
                groups[prodName] = {
                    productName: prodName,
                    brands: {}
                };
            }

            if (!groups[prodName].brands[brandName]) {
                groups[prodName].brands[brandName] = {
                    ...item,
                    whPkt: 0,
                    whQty: 0
                };
            }

            groups[prodName].brands[brandName].whPkt += parseFloat(item.whPkt) || 0;
            groups[prodName].brands[brandName].whQty += parseFloat(item.whQty) || 0;
        });

        // Subtract sales and convert brands map to array
        const finalResults = Object.values(groups).map(prodGroup => {
            const brandList = Object.values(prodGroup.brands).map(brand => {
                const key = `${prodGroup.productName}_${brand.brand}`;
                const saleData = whSalesMap[key] || { qty: 0, pkt: 0 };

                // If we have size, calculate sale packets to be accurate
                let salePkt = 0;
                const size = parseFloat(brand.packetSize) || 0;
                if (size > 0) {
                    salePkt = saleData.qty / size;
                }

                return {
                    ...brand,
                    whQty: Math.max(0, brand.whQty - saleData.qty),
                    whPkt: Math.max(0, brand.whPkt - salePkt)
                };
            }).filter(b => b.whQty > 0 || b.whPkt > 0);

            return {
                ...prodGroup,
                brands: brandList
            };
        }).filter(p => p.brands.length > 0);

        return finalResults.length > 0 ? finalResults : null;
    }, [stockFormData.warehouse, allWhRecords, salesRecords]);

    // --- Handlers ---
    const resetStockForm = () => {
        setStockFormData({
            date: '',
            lcNo: '',
            port: '',
            importer: '',
            exporter: '',
            indianCnF: '',
            indCnFCost: '',
            bdCnF: '',
            bdCnFCost: '',
            billOfEntry: '',
            totalLcTruck: 0,
            totalLcQuantity: '',
            status: 'Requested',
            warehouse: '',
            productEntries: [{
                isMultiBrand: true,
                productName: '',
                truckNo: '',
                brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
            }]
        });
        setEditingId(null);
        setWhSearchQuery('');
    };

    const recalculateEntry = (entry, isQuantityDriven = false) => {
        const pkt = parseFloat(entry.packet) || 0;
        const qty = parseFloat(entry.quantity) || 0;
        const size = parseFloat(entry.packetSize) || 0;
        const swpPkt = parseFloat(entry.sweepedPacket) || 0;
        const swpQty = parseFloat(entry.sweepedQuantity) || 0;

        if (size > 0) {
            if (isQuantityDriven) {
                // Arrival Qty + Size -> Packet
                entry.packet = (qty / size).toFixed(2);
                entry.sweepedPacket = (swpQty / size).toFixed(2);
            } else {
                // Packet + Size -> Arrival Qty (Legacy compatibility)
                entry.quantity = (pkt * size).toFixed(2);
                entry.sweepedQuantity = (swpPkt * size).toFixed(2);
            }
            // inHouse is always arrived - sweeped
            const currentQty = parseFloat(entry.quantity) || 0;
            const currentSwpQty = parseFloat(entry.sweepedQuantity) || 0;
            const currentPkt = parseFloat(entry.packet) || 0;
            const currentSwpPkt = parseFloat(entry.sweepedPacket) || 0;

            entry.inHouseQuantity = (currentQty - currentSwpQty).toFixed(2);
            entry.inHousePacket = (currentPkt - currentSwpPkt).toFixed(2);
        } else {
            // No size -> arrival qty is primary
            const aQty = parseFloat(entry.quantity) || 0;
            const sQty = parseFloat(entry.sweepedQuantity) || 0;
            entry.inHouseQuantity = (aQty - sQty).toFixed(2);
            entry.inHousePacket = (parseFloat(entry.packet) || 0) - (parseFloat(entry.sweepedPacket) || 0);
        }
        return entry;
    };

    const calculateSummaries = (productEntries) => {
        let totalLcTruck = 0;
        let totalLcQuantity = 0;

        productEntries.forEach(prod => {
            // Sum the truck numbers
            totalLcTruck += parseFloat(prod.truckNo) || 0;

            // Sum quantities from all brand entries
            prod.brandEntries.forEach(brandEntry => {
                totalLcQuantity += parseFloat(brandEntry.quantity) || 0;
            });
        });

        return { totalLcTruck, totalLcQuantity: totalLcQuantity.toFixed(2) };
    };

    const handleStockInputChange = (e, pIndex = null) => {
        const { name, value } = e.target;
        if (pIndex !== null) {
            const updatedProducts = [...stockFormData.productEntries];
            updatedProducts[pIndex] = { ...updatedProducts[pIndex], [name]: value };

            const summaries = calculateSummaries(updatedProducts);
            setStockFormData({
                ...stockFormData,
                productEntries: updatedProducts,
                ...summaries
            });
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

        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const handleBrandEntryChange = (pIndex, bIndex, field, value) => {
        const updatedProducts = [...stockFormData.productEntries];
        const entry = { ...updatedProducts[pIndex].brandEntries[bIndex] };
        entry[field] = value;

        if (field === 'brand') {
            const product = products.find(p => p.name === updatedProducts[pIndex].productName);
            if (product && product.brands) {
                const brandData = product.brands.find(b => b.brand === value);
                if (brandData) {
                    entry.packetSize = brandData.packetSize || entry.packetSize;
                    entry.purchasedPrice = brandData.purchasedPrice || entry.purchasedPrice;
                    recalculateEntry(entry);
                }
            }
        }

        if (field === 'packet' || field === 'sweepedPacket') {
            recalculateEntry(entry, false); // Packet driven
        }

        if (field === 'quantity' || field === 'packetSize' || field === 'sweepedQuantity') {
            recalculateEntry(entry, true); // Quantity/Size driven (Auto-fill Packet)
        }

        updatedProducts[pIndex].brandEntries[bIndex] = entry;

        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const addProductEntry = () => {
        const updatedProducts = [
            ...stockFormData.productEntries,
            {
                isMultiBrand: true,
                productName: '',
                truckNo: '',
                brandEntries: [{ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' }]
            }
        ];
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const removeProductEntry = (index) => {
        const updatedProducts = stockFormData.productEntries.filter((_, i) => i !== index);
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const addBrandEntry = (pIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries.push({ brand: '', purchasedPrice: '', packet: '', packetSize: '', quantity: '', unit: 'kg', sweepedPacket: '', sweepedQuantity: '', inHousePacket: '', inHouseQuantity: '' });
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const removeBrandEntry = (pIndex, bIndex) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].brandEntries = updatedProducts[pIndex].brandEntries.filter((_, i) => i !== bIndex);
        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
    };

    const handleAddBrand = async (pIndex, bIndex, newBrandName) => {
        if (!newBrandName) return;
        const productName = stockFormData.productEntries[pIndex].productName;
        if (!productName) return;

        const product = products.find(p => p.name === productName);
        if (!product) return;

        try {
            const currentBrands = product.brands || [];
            if (currentBrands.some(b => b.brand.toLowerCase() === newBrandName.toLowerCase())) {
                handleBrandEntryChange(pIndex, bIndex, 'brand', newBrandName);
                return;
            }

            const updatedBrands = [...currentBrands, { brand: newBrandName, purchasedPrice: '', packetSize: '' }];
            const updatedProductData = { ...product, brands: updatedBrands };

            // Remove helper fields before encrypting and sending to backend
            await axios.put(`${API_BASE_URL}/api/products/${product._id}`, dataToEncrypt);

            if (fetchProducts) await fetchProducts();

            handleBrandEntryChange(pIndex, bIndex, 'brand', newBrandName);
            setActiveDropdown(null);
        } catch (error) {
            console.error('Error adding brand:', error);
            alert('Failed to add new brand. Please try again.');
        }
    };

    const handleStockDropdownSelect = (field, value) => {
        setStockFormData({ ...stockFormData, [field]: value });
        setActiveDropdown(null);
    };

    const handleProductSelect = (pIndex, productName) => {
        const updatedProducts = [...stockFormData.productEntries];
        updatedProducts[pIndex].productName = productName;

        // In Single mode, auto-fill the brand to match the product
        if (!updatedProducts[pIndex].isMultiBrand && updatedProducts[pIndex].brandEntries[0]) {
            updatedProducts[pIndex].brandEntries[0].brand = productName;
        }

        const summaries = calculateSummaries(updatedProducts);
        setStockFormData({
            ...stockFormData,
            productEntries: updatedProducts,
            ...summaries
        });
        setActiveDropdown(null);
    };

    const handleDropdownKeyDown = (e, dropdownId, onSelect, fieldOrValue, options = []) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                const selected = options[highlightedIndex];
                const value = typeof selected === 'object' ? (selected.name || selected.port || selected.brand) : selected;
                onSelect(fieldOrValue, value);
                setHighlightedIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const handleStockSubmit = async (e) => {
        e.preventDefault();
        setValidationErrors([]);

        // Detailed manual validation
        const errors = [];
        if (!stockFormData.lcNo) errors.push("LC Number is required");
        if (!stockFormData.port) errors.push("Port is required");
        if (!stockFormData.importer) errors.push("Importer is required");
        if (!stockFormData.warehouse) errors.push("Warehouse is required");

        stockFormData.productEntries.forEach((p, pIdx) => {
            const prodLabel = p.productName || `Product #${pIdx + 1}`;
            if (!p.productName) errors.push(`Product Name is required for entry #${pIdx + 1}`);

            p.brandEntries.forEach((b, bIdx) => {
                const brandLabel = b.brand || `Brand #${bIdx + 1}`;

                // For Single mode, auto-fallback brand if empty
                if (!p.isMultiBrand && !b.brand) b.brand = p.productName;

                if (!b.brand) errors.push(`${prodLabel}: Brand is required for entry #${bIdx + 1}`);

                // Packet Size is only required in Multi mode
                if (p.isMultiBrand && !b.packetSize) {
                    errors.push(`${prodLabel} (${brandLabel}): Size is required`);
                }

                if (b.packet === '' || isNaN(parseFloat(b.packet))) {
                    // Only require packet if it's multi mode or if weight isn't primary
                    if (p.isMultiBrand) {
                        errors.push(`${prodLabel} (${brandLabel}): Packet count is required`);
                    }
                }
            });
        });

        if (errors.length > 0) {
            setValidationErrors(errors);
            setSubmitStatus('error');
            setTimeout(() => setSubmitStatus(null), 5000);
            return;
        }

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
                            exporter: stockFormData.exporter,
                            indianCnF: stockFormData.indianCnF,
                            indCnFCost: stockFormData.indCnFCost,
                            bdCnF: stockFormData.bdCnF,
                            bdCnFCost: stockFormData.bdCnFCost,
                            billOfEntry: stockFormData.billOfEntry,
                            totalLcTruck: stockFormData.totalLcTruck,
                            totalLcQuantity: stockFormData.totalLcQuantity,
                            status: stockFormData.status,
                            warehouse: stockFormData.warehouse,
                            requestedBy: stockFormData.requestedBy || (currentUser ? (currentUser.name || currentUser.username || '') : ''),
                            requestedByUsername: stockFormData.requestedByUsername || (currentUser ? currentUser.username : ''),
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
                            totalInHousePacket: brandEntry.inHousePacket,
                            totalInHouseQuantity: brandEntry.inHouseQuantity,
                        };

                        if (brandEntry._id) {
                            validIds.add(brandEntry._id);
                            promises.push(axios.put(`${API_BASE_URL}/api/stock/${brandEntry._id}`, recordData));
                        } else {
                            promises.push(axios.post(`${API_BASE_URL}/api/stock`, recordData));
                        }
                    }
                }

                const idsToDelete = originalIds.filter(id => !validIds.has(id));
                idsToDelete.forEach(id => {
                    promises.push(axios.delete(`${API_BASE_URL}/api/stock/${id}`));
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
                            exporter: stockFormData.exporter,
                            indianCnF: stockFormData.indianCnF,
                            indCnFCost: stockFormData.indCnFCost,
                            bdCnF: stockFormData.bdCnF,
                            bdCnFCost: stockFormData.bdCnFCost,
                            billOfEntry: stockFormData.billOfEntry,
                            totalLcTruck: stockFormData.totalLcTruck,
                            totalLcQuantity: stockFormData.totalLcQuantity,
                            status: stockFormData.status,
                            warehouse: stockFormData.warehouse,
                            requestedBy: stockFormData.requestedBy || (currentUser ? (currentUser.name || currentUser.username || '') : ''),
                            requestedByUsername: stockFormData.requestedByUsername || (currentUser ? currentUser.username : ''),
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
                            totalInHousePacket: brandEntry.inHousePacket,
                            totalInHouseQuantity: brandEntry.inHouseQuantity
                        });
                    });
                });

                const createPromises = newRecords.map(record =>
                    axios.post(`${API_BASE_URL}/api/stock`, { data: encryptData(record) })
                );

                await Promise.all(createPromises);
            }

            if (addNotification && !editingId) {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const dateStr = `${day}/${month}/${year}`;
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const employeeName = currentUser?.name || currentUser?.username || 'An employee';

                await addNotification(
                    'New LC Received',
                    `${dateStr} | ${timeStr} | ${employeeName} has requested new lc receive entry (${stockFormData.lcNo})`
                );
            } else if (addNotification && editingId && (stockFormData.status || '').toLowerCase().includes('requested')) {
                const now = new Date();
                const day = String(now.getDate()).padStart(2, '0');
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const year = now.getFullYear();
                const dateStr = `${day}/${month}/${year}`;
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const employeeName = currentUser?.name || currentUser?.username || 'An employee';

                // Identify what changed
                const originalRecord = lcReceiveRecords.find(r => r._id === editingId || (r.allIds && r.allIds.includes(editingId)));
                const changes = [];
                if (originalRecord) {
                    if (originalRecord.date !== stockFormData.date) changes.push('Date');
                    if (originalRecord.lcNo !== stockFormData.lcNo) changes.push('LC No');
                    if (originalRecord.port !== stockFormData.port) changes.push('Port');
                    if (originalRecord.importer !== stockFormData.importer) changes.push('Importer');
                    if (originalRecord.exporter !== stockFormData.exporter) changes.push('Exporter');
                    if (originalRecord.warehouse !== stockFormData.warehouse) changes.push('Warehouse');
                    if (originalRecord.status !== stockFormData.status) changes.push('Status');

                    // Check for product/brand related changes (Price, Packet, Qty)
                    const originalEntries = originalRecord.entries || [originalRecord];
                    const currentEntries = [];
                    stockFormData.productEntries.forEach(p => {
                        p.brandEntries.forEach(b => {
                            currentEntries.push({ ...p, ...b });
                        });
                    });

                    let priceChanged = false;
                    let packetChanged = false;
                    let quantityChanged = false;
                    let productStructureChanged = false;

                    if (originalEntries.length !== currentEntries.length) {
                        productStructureChanged = true;
                    } else {
                        for (let i = 0; i < currentEntries.length; i++) {
                            const cur = currentEntries[i];
                            const orig = originalEntries[i];
                            if (parseFloat(cur.purchasedPrice) !== parseFloat(orig.purchasedPrice)) priceChanged = true;
                            if (parseFloat(cur.packet) !== parseFloat(orig.packet)) packetChanged = true;
                            if (parseFloat(cur.quantity) !== parseFloat(orig.quantity)) quantityChanged = true;
                            if (cur.productName !== orig.productName || cur.brand !== orig.brand) productStructureChanged = true;
                        }
                    }

                    if (priceChanged) changes.push('Price');
                    if (packetChanged) changes.push('Packet');
                    if (quantityChanged) changes.push('Quantity');
                    if (productStructureChanged) changes.push('Products/Brands');
                }

                const changeText = changes.length > 0 ? ` (Changes: ${changes.join(', ')})` : '';

                // Recipients: Admins, Managers, and the Original Requester
                const targetRoles = ['admin', 'incharge', 'sales manager'];
                const targetUsers = [];
                if (stockFormData.requestedByUsername) targetUsers.push(stockFormData.requestedByUsername);
                // Explicitly include 'admin' username to be sure
                if (!targetUsers.includes('admin')) targetUsers.push('admin');

                // Send to requester + admins/managers
                await addNotification(
                    'LC Receive Entry Updated',
                    `${dateStr} | ${timeStr} | ${employeeName} has edited the requested LC receive entry (${stockFormData.lcNo})${changeText}`,
                    targetRoles,
                    targetUsers
                );
            }

            setSubmitStatus('success');
            setTimeout(() => {
                resetStockForm();
                setShowStockForm(false);
                setSubmitStatus(null);
                if (fetchStockRecords) fetchStockRecords();
                fetchWarehouses(); // Refresh warehouse stock display immediately
            }, 1500);

        } catch (error) {
            console.error("Error submitting stock:", error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditInternal = (type, record) => {
        // Use either _id (single) or the first id from the group (grouped) to mark as editing
        const editId = record._id || (record.allIds && record.allIds[0]);
        setEditingId(editId);

        const isGrouped = record.entries && Array.isArray(record.entries);

        if (isGrouped) {
            // Group the entries by productName AND truckNo to correctly restore multi-product LC receives
            // If they have different truck numbers, they should be distinct product blocks (Single Mode)
            // If they share the same truck number, they are likely brands under the same product block (Multi Mode)
            const entriesByProduct = record.entries.reduce((acc, e) => {
                const pName = e.productName || '';
                const tNo = e.truckNo || '';
                const key = `${pName}|${tNo}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(e);
                return acc;
            }, {});

            const formProductEntries = Object.keys(entriesByProduct).map(key => {
                const prodEntries = entriesByProduct[key];
                const pName = prodEntries[0]?.productName || '';

                // It is multi-brand if there are multiple entries.
                // If there's only 1 entry, it is SINGLE mode if the brand is empty, a hyphen, OR exactly matches the product name.
                let isMulti = false;
                if (prodEntries.length > 1) {
                    isMulti = true;
                } else if (prodEntries.length === 1) {
                    const b = (prodEntries[0].brand || '').trim().toLowerCase();
                    const p = pName.trim().toLowerCase();
                    if (b !== '-' && b !== '' && b !== p) {
                        isMulti = true;
                    }
                }

                return {
                    isMultiBrand: isMulti,
                    productName: pName,
                    truckNo: prodEntries[0]?.truckNo || '',
                    brandEntries: prodEntries.map(e => ({
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
            });

            setStockFormData({
                date: record.date || new Date().toISOString().split('T')[0],
                lcNo: record.lcNo,
                port: record.port,
                importer: record.importer,
                exporter: record.exporter,
                indianCnF: record.indianCnF,
                indCnFCost: record.indCnFCost,
                bdCnF: record.bdCnF,
                bdCnFCost: record.bdCnFCost,
                billOfEntry: record.billOfEntry,
                totalLcTruck: record.totalLcTruck,
                totalLcQuantity: record.totalLcQuantity,
                status: record.status,
                warehouse: record.warehouse || record.entries?.[0]?.warehouse || '',
                requestedBy: record.entries?.[0]?.requestedBy || '',
                requestedByUsername: record.entries?.[0]?.requestedByUsername || '',
                productEntries: formProductEntries,
                originalIds: record.allIds
            });

            // Set the search query for the warehouse search box so it's not visually empty
            if (record.warehouse || record.entries?.[0]?.warehouse) {
                setWhSearchQuery(record.warehouse || record.entries?.[0]?.warehouse);
            } else {
                setWhSearchQuery('');
            }

        } else {
            setStockFormData({
                date: record.date || new Date().toISOString().split('T')[0],
                lcNo: record.lcNo,
                port: record.port,
                importer: record.importer,
                exporter: record.exporter,
                indianCnF: record.indianCnF,
                indCnFCost: record.indCnFCost,
                bdCnF: record.bdCnF,
                bdCnFCost: record.bdCnFCost,
                billOfEntry: record.billOfEntry,
                totalLcTruck: record.totalLcTruck,
                totalLcQuantity: record.totalLcQuantity,
                status: record.status,
                warehouse: record.warehouse || '',
                requestedBy: record.requestedBy || '',
                requestedByUsername: record.requestedByUsername || '',
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
                        inHousePacket: record.inHousePacket,
                        inHouseQuantity: record.inHouseQuantity
                    }]
                }]
            });
            // Set the search query for the warehouse search box
            setWhSearchQuery(record.warehouse || '');
        }
        setShowStockForm(true);
    };

    const handleStatusUpdate = async (record, newStatus) => {
        try {
            setIsSubmitting(true);
            const ids = record.allIds || record.ids || (record._id ? [record._id] : []);

            const promises = ids.map(id => {
                const originalRecord = stockRecords.find(r => r._id === id);
                if (!originalRecord) return null;

                const { _id, createdAt, __v, ...rest } = originalRecord;
                const actionBy = currentUser ? (currentUser.name || currentUser.username || '') : '';
                const updatedData = {
                    ...rest,
                    status: newStatus,
                    ...(newStatus === 'In Stock' ? { acceptedBy: actionBy } : {}),
                    ...(newStatus === 'Rejected' ? { rejectedBy: actionBy } : {}),
                };
                return axios.put(`${API_BASE_URL}/api/stock/${id}`, { data: encryptData(updatedData) });
            }).filter(Boolean);

            await Promise.all(promises);

            // Send notification to the original requester
            if (addNotification && record.entries && record.entries[0]) {
                const firstEntry = record.entries[0];
                const requesterUsername = firstEntry.requestedByUsername;

                if (requesterUsername) {
                    const now = new Date();
                    const day = String(now.getDate()).padStart(2, '0');
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const year = now.getFullYear();
                    const dateStr = `${day}/${month}/${year}`;
                    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const adminName = currentUser?.name || currentUser?.username || 'Admin';

                    const statusLabel = newStatus === 'In Stock' ? 'Accepted' : newStatus;
                    const actionLabel = newStatus === 'In Stock' ? 'accepted' : 'rejected';
                    const requesterName = firstEntry.requestedBy || firstEntry.requestedByUsername || 'an employee';

                    // Notify Admins, Managers, and the Original Requester
                    const targetRoles = ['admin', 'incharge', 'sales manager'];
                    const targetUsers = [requesterUsername];
                    if (!targetUsers.includes('admin')) targetUsers.push('admin');

                    await addNotification(
                        `LC Receive ${statusLabel}`,
                        `${dateStr} | ${timeStr} | ${adminName} has ${actionLabel} the LC receive entry (${firstEntry.lcNo}) requested by ${requesterName}`,
                        targetRoles,
                        targetUsers
                    );
                }
            }

            if (fetchStockRecords) fetchStockRecords();
            fetchWarehouses();
        } catch (error) {
            console.error(`Error updating status to ${newStatus}:`, error);
            alert(`Failed to update status to ${newStatus}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFilteredProducts = (input) => {
        if (!input) return products;
        return products.filter(p => p.name.toLowerCase().includes(input.toLowerCase()));
    };

    const getFilteredBrands = (input, productName) => {
        // No product selected → no brands to show
        if (!productName) return [];

        const allBrands = new Set();

        // 1. Get brands defined in the product definition
        if (products) {
            const product = products.find(p => p.name === productName);
            if (product && product.brands) {
                product.brands.forEach(b => {
                    if (b.brand) allBrands.add(b.brand);
                });
            } else if (product && product.brand) {
                allBrands.add(product.brand);
            }
        }

        // 2. Get brands from existing stock records for this product only
        stockRecords.forEach(r => {
            if (r.productName === productName && r.brand && (r.status || '').toLowerCase() !== 'requested') {
                allBrands.add(r.brand);
            }
        });

        const brandsArr = Array.from(allBrands).sort();
        if (!input) return brandsArr;
        return brandsArr.filter(b => b.toLowerCase().includes(input.toLowerCase()));
    };

    const [showLcFilterPanel, setShowLcFilterPanel] = useState(false);

    const initialLcFilterState = {
        startDate: '',
        endDate: '',
        warehouse: '',
        indCnf: '',
        bdCnf: '',
        billOfEntry: '',
        productName: '',
        brand: ''
    };

    const [filterSearchInputs, setFilterSearchInputs] = useState({
        warehouseSearch: '',
        brandSearch: '',
        productSearch: '',
        indCnfSearch: '',
        bdCnfSearch: '',
        billOfEntrySearch: ''
    });

    const initialFilterDropdownState = {
        warehouse: false,
        brand: false,
        product: false,
        indCnf: false,
        bdCnf: false,
        billOfEntry: false
    };

    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);

    // Refs for filters - using Refs to manage focus/click outside if needed, 
    // though for now simple state might suffice. Kept for consistency.
    // Refs for filters
    const lcFilterPanelRef = useRef(null);
    const lcFilterButtonRef = useRef(null);

    const warehouseFilterRef = useRef(null);
    const indCnfFilterRef = useRef(null);
    const bdCnfFilterRef = useRef(null);
    const billOfEntryFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const brandFilterRef = useRef(null);

    // Click-outside detection for LC filter panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showLcFilterPanel &&
                lcFilterPanelRef.current &&
                !lcFilterPanelRef.current.contains(event.target) &&
                lcFilterButtonRef.current &&
                !lcFilterButtonRef.current.contains(event.target)
            ) {
                setShowLcFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLcFilterPanel]);

    // Click-outside detection for filter dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Find which filter is currently open
            const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
            if (!openKey) return;

            // Map open keys to their corresponding DOM containers (refs)
            let refsToCheck = [];
            if (openKey === 'lcNo') {
                refsToCheck = [lcNoFilterRef];
            } else if (openKey === 'port') {
                refsToCheck = [portFilterRef];
            } else if (openKey === 'brand') {
                refsToCheck = [brandFilterRef];
            } else if (openKey === 'product') {
                refsToCheck = [productFilterRef];
            } else if (openKey === 'indCnf') {
                refsToCheck = [indCnfFilterRef];
            } else if (openKey === 'bdCnf') {
                refsToCheck = [bdCnfFilterRef];
            } else if (openKey === 'billOfEntry') {
                refsToCheck = [billOfEntryFilterRef];
            }

            // If click is outside all associated refs for the open dropdown, close it
            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setFilterDropdownOpen(initialFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterDropdownOpen, showLcFilterPanel]);

    // Click-outside detection for form's activeDropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!activeDropdown) return;

            // Define refs for all possible searchable dropdowns in the form
            const refs = [
                portRef,
                importerRef,
                exporterRef,
                ...Object.values(productRefs.current).map(r => ({ current: r })),
                ...Object.values(brandRefs.current).map(r => ({ current: r }))
            ];

            const isOutside = refs.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    // Handlers for dropdown filtering
    const getFilteredOptions = (type) => {
        let options = [];
        let search = '';

        switch (type) {
            case 'lcFilterLcNo':
                options = [...new Set(stockRecords.map(r => (r.lcNo || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.lcNoSearch;
                break;
            case 'lcFilterPort':
                options = [...new Set(stockRecords.map(r => (r.port || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.portSearch;
                break;
            case 'lcFilterIndCnf':
                options = [...new Set(stockRecords.map(r => (r.indianCnF || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.indCnfSearch;
                break;
            case 'lcFilterBdCnf':
                options = [...new Set(stockRecords.map(r => (r.bdCnF || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.bdCnfSearch;
                break;
            case 'lcFilterBillOfEntry':
                options = [...new Set(stockRecords.map(r => (r.billOfEntry || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.billOfEntrySearch;
                break;
            default:
                return [];
        }

        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    };


    const filteredRecords = useMemo(() => {
        let records = [];
        if (isRequestedOnly) {
            records = lcReceiveRecords.filter(item => (item.status || '').toLowerCase().includes('requested'));
        } else {
            records = lcReceiveRecords.filter(item => !(item.status || '').toLowerCase().includes('requested'));
        }

        // Apply Search Query
        if (lcSearchQuery.trim()) {
            const query = lcSearchQuery.toLowerCase().trim();
            records = records.filter(item => 
                (item.warehouse || '').toLowerCase().includes(query) ||
                (item.importer || '').toLowerCase().includes(query) ||
                (item.exporter || '').toLowerCase().includes(query) ||
                (item.truckNo || '').toLowerCase().includes(query) ||
                (item.productName || '').toLowerCase().includes(query)
            );
        }

        // Apply Advanced Filters
        if (lcFilters) {
            if (lcFilters.startDate) {
                records = records.filter(item => new Date(item.date) >= new Date(lcFilters.startDate));
            }
            if (lcFilters.endDate) {
                records = records.filter(item => new Date(item.date) <= new Date(lcFilters.endDate));
            }
            if (lcFilters.warehouse) {
                records = records.filter(item => (item.warehouse || '').toLowerCase() === lcFilters.warehouse.toLowerCase());
            }
            if (lcFilters.indCnf) {
                records = records.filter(item => (item.indianCnF || '').toLowerCase() === lcFilters.indCnf.toLowerCase());
            }
            if (lcFilters.bdCnf) {
                records = records.filter(item => (item.bdCnF || '').toLowerCase() === lcFilters.bdCnf.toLowerCase());
            }
            if (lcFilters.billOfEntry) {
                records = records.filter(item => (item.billOfEntry || '').toLowerCase() === lcFilters.billOfEntry.toLowerCase());
            }
            if (lcFilters.productName) {
                records = records.filter(item => (item.productName || '').toLowerCase() === lcFilters.productName.toLowerCase());
            }
            if (lcFilters.brand) {
                records = records.filter(item => (item.brand || '').toLowerCase() === lcFilters.brand.toLowerCase());
            }
        }

        // Apply interactive sorting
        return [...records].sort((a, b) => {
            const key = sortConfig.key;
            let valA = a[key] || '';
            let valB = b[key] || '';

            // Handle specific keys if needed (e.g. numeric or date)
            if (key === 'date') {
                valA = new Date(valA);
                valB = new Date(valB);
            } else if (['purchasedPrice', 'packet', 'packetSize', 'quantity', 'sweepedPacket', 'sweepedQuantity', 'inHousePacket', 'inHouseQuantity', 'indCnFCost', 'bdCnFCost', 'totalLcTruck', 'totalLcQuantity'].includes(key)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [lcReceiveRecords, isRequestedOnly, sortConfig]);

    const requestedCount = useMemo(() => {
        const requested = lcReceiveRecords.filter(item => (item.status || '').toLowerCase().includes('requested'));
        return new Set(requested.map(item => `${item.date || ''}-${item.warehouse || ''}-${item.indianCnF || ''}-${item.bdCnF || ''}`)).size;
    }, [lcReceiveRecords]);

    const memoizedSummary = useMemo(() => {
        const totalPackets = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.packet) || 0), 0);
        const totalQuantity = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

        const uniqueTrucksMap = filteredRecords.reduce((acc, item) => {
            const key = `${item.date}-${item.warehouse}-${item.productName}-${item.truckNo}`;
            if (!acc[key]) {
                acc[key] = parseFloat(item.truckNo) || 0;
            }
            return acc;
        }, {});
        const totalTrucks = Object.values(uniqueTrucksMap).reduce((sum, val) => sum + val, 0);

        const unit = filteredRecords[0]?.unit || 'kg';

        return { totalPackets, totalQuantity, totalTrucks, unit };
    }, [filteredRecords]);

    return (
        <div className="space-y-6">
            {!showStockForm && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-auto md:shrink-0">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 text-center md:text-left">LC Receive Management</h2>
                    </div>

                    {/* Center Aligned Search Bar */}
                    <div className="flex-1 w-full max-w-none md:max-w-md mx-auto flex flex-col items-center gap-2">
                        <div className="w-full relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by Warehouse, Importer, Exporter, Truck..."
                                value={lcSearchQuery}
                                onChange={(e) => setLcSearchQuery(e.target.value)}
                                className="block w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsRequestedOnly(!isRequestedOnly)}
                                className={`relative px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${isRequestedOnly ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
                            >
                                Requested
                                {requestedCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-pulse border-2 border-white">
                                        {requestedCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="w-full md:w-auto md:shrink-0 flex items-center gap-2">
                        <div className="relative flex-1 md:flex-none">
                            <button
                                ref={lcFilterButtonRef}
                                onClick={() => setShowLcFilterPanel(!showLcFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border ${showLcFilterPanel || Object.values(lcFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showLcFilterPanel || (lcFilters && Object.values(lcFilters).some(v => v !== ''))) ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showLcFilterPanel && lcFilters && (
                                <div ref={lcFilterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                        <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                        <button
                                            onClick={() => {
                                                if (setLcFilters) setLcFilters(initialLcFilterState);
                                                setFilterSearchInputs({
                                                    warehouseSearch: '',
                                                    brandSearch: '',
                                                    productSearch: '',
                                                    indCnfSearch: '',
                                                    bdCnfSearch: '',
                                                    billOfEntrySearch: ''
                                                });
                                                if (setLcSearchQuery) setLcSearchQuery('');
                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                setShowLcFilterPanel(false);
                                            }}
                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                                        >
                                            RESET ALL
                                        </button>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Date Range Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <CustomDatePicker
                                                label="From Date"
                                                value={lcFilters.startDate}
                                                onChange={(e) => setLcFilters({ ...lcFilters, startDate: e.target.value })}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={lcFilters.endDate}
                                                onChange={(e) => setLcFilters({ ...lcFilters, endDate: e.target.value })}
                                                compact={true}
                                                rightAlign={true}
                                            />
                                        </div>

                                        {/* Warehouse Row */}
                                        <div className="space-y-1.5 relative" ref={warehouseFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">WAREHOUSE</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.warehouseSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, warehouse: true })}
                                                    placeholder={lcFilters.warehouse || "Search Warehouse..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {lcFilters.warehouse && (
                                                        <button onClick={() => { setLcFilters({ ...lcFilters, warehouse: '' }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.warehouse && (() => {
                                                const filtered = getFilteredOptions('lcFilterWarehouse') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, warehouse: opt }); setFilterSearchInputs({ ...filterSearchInputs, warehouseSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Product and Brand Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Product Filter */}
                                            <div className="space-y-1.5 relative" ref={productFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PRODUCT</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.productSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                        placeholder={lcFilters.productName || "Search Product..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.productName && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, productName: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.product && (() => {
                                                    const options = stockRecords ? [...new Set(stockRecords.map(item => (item.productName || '').trim()).filter(Boolean))].sort() : [];
                                                    const filtered = options.filter(o => o.toLowerCase().includes((filterSearchInputs.productSearch || '').toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(o => (
                                                                <button key={o} type="button" onClick={() => { setLcFilters({ ...lcFilters, productName: o }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{o}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Brand Filter */}
                                            <div className="space-y-1.5 relative" ref={brandFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BRAND</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.brandSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, brandSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, brand: true })}
                                                        placeholder={lcFilters.brand || "Search Brand..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.brand && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, brand: '' }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.brand && (() => {
                                                    if (!stockRecords) return null;
                                                    const productFilteredRecords = lcFilters.productName
                                                        ? stockRecords.filter(item => (item.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase())
                                                        : stockRecords;
                                                    const options = [...new Set(productFilteredRecords.flatMap(item => {
                                                        if (item.brand) return [(item.brand || '').trim()];
                                                        return (item.brandEntries || []).map(e => (e.brand || '').trim());
                                                    }).filter(Boolean))].sort();
                                                    const filtered = options.filter(o => o.toLowerCase().includes((filterSearchInputs.brandSearch || '').toLowerCase()));
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(o => (
                                                                <button key={o} type="button" onClick={() => { setLcFilters({ ...lcFilters, brand: o }); setFilterSearchInputs({ ...filterSearchInputs, brandSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{o}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* C&F Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* IND C&F Filter */}
                                            <div className="space-y-1.5 relative" ref={indCnfFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IND C&F</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.indCnfSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, indCnf: true })}
                                                        placeholder={lcFilters.indCnf || "Search..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.indCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.indCnf && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, indCnf: '' }); setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.indCnf && (() => {
                                                    const filtered = getFilteredOptions('lcFilterIndCnf');
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} onClick={() => { setLcFilters({ ...lcFilters, indCnf: opt }); setFilterSearchInputs({ ...filterSearchInputs, indCnfSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* BD C&F Filter */}
                                            <div className="space-y-1.5 relative" ref={bdCnfFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BD C&F</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.bdCnfSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, bdCnf: true })}
                                                        placeholder={lcFilters.bdCnf || "Search..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.bdCnf ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.bdCnf && (
                                                            <button onClick={() => { setLcFilters({ ...lcFilters, bdCnf: '' }); setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.bdCnf && (() => {
                                                    const filtered = getFilteredOptions('lcFilterBdCnf');
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} onClick={() => { setLcFilters({ ...lcFilters, bdCnf: opt }); setFilterSearchInputs({ ...filterSearchInputs, bdCnfSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Bill Of Entry Full Row */}
                                        <div className="space-y-1.5 relative" ref={billOfEntryFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">BILL OF ENTRY</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.billOfEntrySearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, billOfEntry: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, billOfEntry: true })}
                                                    placeholder={lcFilters.billOfEntry || "Search Bill Of Entry..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-14 ${lcFilters.billOfEntry ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {lcFilters.billOfEntry && (
                                                        <button onClick={() => { setLcFilters({ ...lcFilters, billOfEntry: '' }); setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.billOfEntry && (() => {
                                                const filtered = getFilteredOptions('lcFilterBillOfEntry');
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} onClick={() => { setLcFilters({ ...lcFilters, billOfEntry: opt }); setFilterSearchInputs({ ...filterSearchInputs, billOfEntrySearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        <button
                                            onClick={() => setShowLcFilterPanel(false)}
                                            className="w-full py-3 bg-[#0f172a] text-white rounded-xl text-sm font-bold shadow-xl shadow-gray-200/50 hover:bg-[#1e293b] active:scale-[0.98] transition-all mt-4"
                                        >
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 md:flex-none">
                            <button
                                onClick={() => setShowLcReport(true)}
                                className="w-full h-11 md:h-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-95 text-sm font-medium"
                            >
                                <BarChartIcon className="w-4 h-4 text-gray-400" />
                                <span>Report</span>
                            </button>
                        </div>
                        <div className="flex-1 md:flex-none">
                            <button
                                onClick={() => setShowStockForm(!showStockForm)}
                                className="w-full h-11 md:h-auto justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center gap-2 text-sm"
                            >
                                <span className="text-lg font-light">+</span> <span>Add New</span>
                            </button>
                        </div>
                    </div>
                </div >
            )
            }

            {/* Summary Cards */}
            {
                !showStockForm && (
                    <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4">
                        <div className="order-1 flex-1 min-w-[calc(50%-4px)] md:min-w-0 bg-white border border-gray-100 p-2.5 md:p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                            <div className="text-[9px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 md:mb-1">Total BAG</div>
                            <div className="text-base md:text-xl font-bold text-gray-900">{(parseFloat(memoizedSummary.totalPackets) || 0).toFixed(2)}</div>
                        </div>
                        <div className="order-2 flex-1 min-w-[calc(50%-4px)] md:min-w-0 bg-emerald-50/50 border border-emerald-100 p-2.5 md:p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                            <div className="text-[9px] md:text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5 md:mb-1">Total Qty</div>
                            <div className="text-base md:text-xl font-bold text-emerald-700 truncate">{Math.round(memoizedSummary.totalQuantity)} {memoizedSummary.unit}</div>
                        </div>
                        <div className="order-3 w-full md:w-auto md:flex-1 bg-blue-50/50 border border-blue-100 p-2.5 md:p-4 rounded-xl shadow-sm transition-all hover:shadow-md">
                            <div className="text-[9px] md:text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-0.5 md:mb-1">Truck</div>
                            <div className="text-base md:text-xl font-bold text-blue-700">
                                {memoizedSummary.totalTrucks}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Form Section */}
            {
                showStockForm && (
                    <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-4 md:p-8 transition-all duration-300">
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                            <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit LC Receive' : 'New LC Receive'}</h3>
                            <button onClick={() => { setShowStockForm(false); resetStockForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleStockSubmit} autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            {/* Form Fields - Reusing logic by passing handlers */}
                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-6">
                                <CustomDatePicker
                                    label="Date"
                                    name="date"
                                    value={stockFormData.date}
                                    onChange={handleStockInputChange}
                                    required
                                    compact={true}
                                />
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">LC No</label>
                                    <input
                                        type="text" name="lcNo" value={stockFormData.lcNo} onChange={handleStockInputChange} required
                                        placeholder="LC Number" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2 relative" ref={portRef}>
                                    <label className="text-sm font-medium text-gray-700">Port</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="port"
                                            value={stockFormData.port}
                                            onChange={(e) => { handleStockInputChange(e); setActiveDropdown('lcr-port'); setHighlightedIndex(-1); }}
                                            onFocus={() => { setActiveDropdown('lcr-port'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => handleDropdownKeyDown(e, 'lcr-port', handleStockDropdownSelect, 'port', ports.filter(p => p.status === 'Active' && (!stockFormData.port || ports.some(x => x.name === stockFormData.port) || p.name.toLowerCase().includes(stockFormData.port.toLowerCase()))))}
                                            placeholder="Search port..."
                                            autoComplete="off"
                                            className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {stockFormData.port && (
                                                <button type="button" onClick={() => handleStockDropdownSelect('port', '')} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'lcr-port' && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {ports.filter(p => p.status === 'Active' && (!stockFormData.port || ports.some(x => x.name === stockFormData.port) || p.name.toLowerCase().includes(stockFormData.port.toLowerCase()))).map((port, idx) => (
                                                <button
                                                    key={port._id}
                                                    type="button"
                                                    onClick={() => handleStockDropdownSelect('port', port.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${stockFormData.port === port.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {port.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 relative" ref={importerRef}>
                                    <label className="text-sm font-medium text-gray-700">Importer</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="importer"
                                            value={stockFormData.importer}
                                            onChange={(e) => { handleStockInputChange(e); setActiveDropdown('lcr-importer'); setHighlightedIndex(-1); }}
                                            onFocus={() => { setActiveDropdown('lcr-importer'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => handleDropdownKeyDown(e, 'lcr-importer', handleStockDropdownSelect, 'importer', importers.filter(imp => imp.status === 'Active' && (!stockFormData.importer || importers.some(x => x.name === stockFormData.importer) || imp.name.toLowerCase().includes(stockFormData.importer.toLowerCase()))))}
                                            placeholder="Search importer..."
                                            autoComplete="off"
                                            className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.importer ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {stockFormData.importer && (
                                                <button type="button" onClick={() => handleStockDropdownSelect('importer', '')} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'lcr-importer' && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {importers.filter(imp => imp.status === 'Active' && (!stockFormData.importer || importers.some(x => x.name === stockFormData.importer) || imp.name.toLowerCase().includes(stockFormData.importer.toLowerCase()))).map((imp, idx) => (
                                                <button
                                                    key={imp._id}
                                                    type="button"
                                                    onClick={() => handleStockDropdownSelect('importer', imp.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${stockFormData.importer === imp.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {imp.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 relative" ref={exporterRef}>
                                    <label className="text-sm font-medium text-gray-700">Exporter</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="exporter"
                                            value={stockFormData.exporter}
                                            onChange={(e) => { handleStockInputChange(e); setActiveDropdown('lcr-exporter'); setHighlightedIndex(-1); }}
                                            onFocus={() => { setActiveDropdown('lcr-exporter'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => handleDropdownKeyDown(e, 'lcr-exporter', handleStockDropdownSelect, 'exporter', exporters.filter(exp => exp.status === 'Active' && (!stockFormData.exporter || exporters.some(x => x.name === stockFormData.exporter) || exp.name.toLowerCase().includes(stockFormData.exporter.toLowerCase()))))}
                                            placeholder="Search exporter..."
                                            autoComplete="off"
                                            className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.exporter ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {stockFormData.exporter && (
                                                <button type="button" onClick={() => handleStockDropdownSelect('exporter', '')} className="text-gray-400 hover:text-gray-600">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                        </div>
                                    </div>
                                    {activeDropdown === 'lcr-exporter' && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {exporters.filter(exp => exp.status === 'Active' && (!stockFormData.exporter || exporters.some(x => x.name === stockFormData.exporter) || exp.name.toLowerCase().includes(stockFormData.exporter.toLowerCase()))).map((exp, idx) => (
                                                <button
                                                    key={exp._id}
                                                    type="button"
                                                    onClick={() => handleStockDropdownSelect('exporter', exp.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${stockFormData.exporter === exp.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {exp.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">IND C&F</label>
                                    <input
                                        type="text" name="indianCnF" value={stockFormData.indianCnF} onChange={handleStockInputChange}
                                        placeholder="IND C&F" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">IND C&F Cost</label>
                                    <input
                                        type="number" name="indCnFCost" value={stockFormData.indCnFCost} onChange={handleStockInputChange}
                                        placeholder="0.00" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">BD C&F</label>
                                    <input
                                        type="text" name="bdCnF" value={stockFormData.bdCnF} onChange={handleStockInputChange}
                                        placeholder="BD C&F" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">BD C&F Cost</label>
                                    <input
                                        type="number" name="bdCnFCost" value={stockFormData.bdCnFCost} onChange={handleStockInputChange}
                                        placeholder="0.00" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Bill Of Entry</label>
                                    <input
                                        type="text" name="billOfEntry" value={stockFormData.billOfEntry} onChange={handleStockInputChange}
                                        placeholder="Bill Of Entry" autoComplete="off" className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                    />
                                </div>
                            </div>

                            {/* Total LC Truck/Quantity Row */}
                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Total LC Truck</label>
                                    <input
                                        type="text"
                                        name="totalLcTruck"
                                        value={stockFormData.totalLcTruck || '0'}
                                        readOnly
                                        placeholder="Total LC Truck"
                                        autoComplete="off"
                                        className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default backdrop-blur-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Total LC Quantity</label>
                                    <input
                                        type="text"
                                        name="totalLcQuantity"
                                        value={stockFormData.totalLcQuantity && parseFloat(stockFormData.totalLcQuantity) !== 0 ? stockFormData.totalLcQuantity : ''}
                                        readOnly
                                        placeholder="Total LC Quantity"
                                        autoComplete="off"
                                        className="w-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default backdrop-blur-sm"
                                    />
                                </div>
                            </div>

                            {/* Product Entries Section */}
                            <div className="col-span-1 md:col-span-2 space-y-8 animate-in fade-in duration-500">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                        Product Details
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={addProductEntry}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-300 font-semibold text-sm shadow-sm active:scale-95 group"
                                    >
                                        <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                                        Add Product
                                    </button>
                                </div>

                                <div className="space-y-12">
                                    {stockFormData.productEntries.map((product, pIndex) => (
                                        <div key={pIndex} className="relative p-6 rounded-2xl bg-gray-50/30 border border-gray-100 group/product hover:border-blue-200 hover:bg-white/80 transition-all duration-500">
                                            {/* Remove Product Button */}
                                            {stockFormData.productEntries.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeProductEntry(pIndex)}
                                                    className="absolute -top-3 -right-3 p-2 bg-white text-gray-500 hover:text-red-500 rounded-xl shadow-lg border border-gray-100 opacity-100 md:opacity-0 md:group-hover/product:opacity-100 transition-all duration-300 hover:scale-110 active:scale-90 z-20"
                                                >
                                                    <TrashIcon className="w-5 h-5 md:w-4 md:h-4" />
                                                </button>
                                            )}

                                            <div className="space-y-6">
                                                {/* Product Info - Single Brand Mode */}
                                                {!product.isMultiBrand && (
                                                    <div className="w-full grid grid-cols-2 md:grid-cols-12 gap-4 items-end animate-in fade-in duration-300">
                                                        <div className="col-span-2 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Mode</label>
                                                            <div className="h-[42px] flex items-center gap-1 p-1 bg-gray-100/50 rounded-lg w-full">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, false)}
                                                                    className={`flex-1 h-full text-[10px] font-bold rounded flex items-center justify-center transition-all ${!product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    SINGLE
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, true)}
                                                                    className={`flex-1 h-full text-[10px] font-bold rounded flex items-center justify-center transition-all ${product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    MULTI
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-4 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                                                            <div className="relative w-full" ref={el => productRefs.current[pIndex] = el}>
                                                                <input
                                                                    type="text"
                                                                    name="productName"
                                                                    value={product.productName}
                                                                    onChange={(e) => {
                                                                        handleStockInputChange(e, pIndex);
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-product-${pIndex}`, (field, val) => handleProductSelect(pIndex, val), 'name', getFilteredProducts(product.productName))}
                                                                    placeholder="Search product..."
                                                                    autoComplete="off"
                                                                    className={`w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm pr-14 ${product.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {product.productName && (
                                                                        <button type="button" onClick={() => handleProductSelect(pIndex, '')} className="text-gray-400 hover:text-gray-600">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                                {activeDropdown === `lcr-product-${pIndex}` && (
                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {getFilteredProducts(product.productName).map((p, idx) => (
                                                                            <button
                                                                                key={p._id}
                                                                                type="button"
                                                                                onClick={() => handleProductSelect(pIndex, p.name)}
                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                className={`w-full text-left px-4 py-2 text-sm transition-colors font-medium ${product.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                            >
                                                                                {p.name}
                                                                            </button>
                                                                        ))}
                                                                        {getFilteredProducts(product.productName).length === 0 && (
                                                                            <div className="px-4 py-3 text-sm text-gray-500 italic">No products found</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 md:col-span-3 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Truck No.</label>
                                                            <input
                                                                type="text" name="truckNo" value={product.truckNo} onChange={(e) => handleStockInputChange(e, pIndex)}
                                                                placeholder="Truck #" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 md:col-span-3 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Arrival Qty</label>
                                                            <div className="relative h-[42px]">
                                                                <input
                                                                    type="text"
                                                                    value={product.brandEntries[0].quantity && parseFloat(product.brandEntries[0].quantity) !== 0 ? product.brandEntries[0].quantity : ''}
                                                                    onChange={(e) => handleBrandEntryChange(pIndex, 0, 'quantity', e.target.value)}
                                                                    placeholder="Qty"
                                                                    className="w-full h-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-center font-bold"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Row 2 */}
                                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">Size</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].packetSize}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'packetSize', e.target.value)}
                                                                placeholder="Size" autoComplete="off" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-center"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700 text-center block w-full">BAG</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].packet && parseFloat(product.brandEntries[0].packet) !== 0 ? product.brandEntries[0].packet : ''}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'packet', e.target.value)}
                                                                placeholder="Qty" autoComplete="off" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm text-center"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">Swp. Pkt</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].sweepedPacket && parseFloat(product.brandEntries[0].sweepedPacket) !== 0 ? product.brandEntries[0].sweepedPacket : ''}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'sweepedPacket', e.target.value)}
                                                                placeholder="Qty" autoComplete="off" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">SwpQty</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].sweepedQuantity && parseFloat(product.brandEntries[0].sweepedQuantity) !== 0 ? product.brandEntries[0].sweepedQuantity : ''}
                                                                onChange={(e) => handleBrandEntryChange(pIndex, 0, 'sweepedQuantity', e.target.value)}
                                                                placeholder="Qty" className="w-full h-[42px] px-2 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">InHouse Pkt</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].inHousePacket}
                                                                readOnly
                                                                placeholder="Qty" autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-medium outline-none cursor-default backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 md:col-span-2 space-y-1.5">
                                                            <label className="text-sm font-medium text-gray-700">InHouse Qty</label>
                                                            <input
                                                                type="text"
                                                                value={product.brandEntries[0].inHouseQuantity}
                                                                readOnly
                                                                placeholder="Qty" className="w-full h-[42px] px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-medium outline-none cursor-default backdrop-blur-sm text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Product Info - Multi Brand Mode */}
                                                {product.isMultiBrand && (
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-300">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Entry Mode</label>
                                                            <div className="h-[42px] flex items-center gap-1 p-1 bg-gray-100/50 rounded-lg w-full">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, false)}
                                                                    className={`flex-1 h-full text-xs font-semibold rounded-md transition-all ${!product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    Single
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleProductModeToggle(pIndex, true)}
                                                                    className={`flex-1 h-full text-xs font-semibold rounded-md transition-all ${product.isMultiBrand ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                                >
                                                                    Multi
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                                                            <div className="relative w-full" ref={el => productRefs.current[pIndex] = el}>
                                                                <input
                                                                    type="text"
                                                                    name="productName"
                                                                    value={product.productName}
                                                                    onChange={(e) => {
                                                                        handleStockInputChange(e, pIndex);
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onFocus={() => {
                                                                        setActiveDropdown(`lcr-product-${pIndex}`);
                                                                        setHighlightedIndex(-1);
                                                                    }}
                                                                    onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-product-${pIndex}`, (field, val) => handleProductSelect(pIndex, val), 'name', getFilteredProducts(product.productName))}
                                                                    placeholder="Search product..."
                                                                    autoComplete="off"
                                                                    className={`w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${product.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                />
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                    {product.productName && (
                                                                        <button type="button" onClick={() => handleProductSelect(pIndex, '')} className="text-gray-400 hover:text-gray-600">
                                                                            <XIcon className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                                </div>
                                                                {activeDropdown === `lcr-product-${pIndex}` && (
                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                                        {getFilteredProducts(product.productName).map((p, idx) => (
                                                                            <button
                                                                                key={p._id}
                                                                                type="button"
                                                                                onClick={() => handleProductSelect(pIndex, p.name)}
                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                className={`w-full text-left px-4 py-2 text-sm transition-colors font-medium ${product.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                            >
                                                                                {p.name}
                                                                            </button>
                                                                        ))}
                                                                        {getFilteredProducts(product.productName).length === 0 && (
                                                                            <div className="px-4 py-3 text-sm text-gray-500 italic">No products found</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Truck No.</label>
                                                            <input
                                                                type="text" name="truckNo" value={product.truckNo} onChange={(e) => handleStockInputChange(e, pIndex)}
                                                                placeholder="Truck No." autoComplete="off" className="w-full h-[42px] px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-gray-700">Total Arrival</label>
                                                            <div className="relative h-[42px]">
                                                                <input
                                                                    type="text"
                                                                    value={(() => {
                                                                        const total = product.brandEntries.reduce((sum, entry) => sum + (parseFloat(entry.quantity) || 0), 0);
                                                                        return total > 0 ? total.toFixed(2) : '';
                                                                    })()}
                                                                    readOnly
                                                                    className="w-full h-full px-4 py-2 bg-gray-50/80 border border-gray-200/60 rounded-lg text-gray-600 font-semibold outline-none cursor-default"
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                                                                    {product.brandEntries[0]?.unit || 'kg'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Brand Entries Section (Multi-Brand Only) */}
                                                {product.isMultiBrand && (
                                                    <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 bg-gray-50/50 p-2 md:p-4 rounded-xl border border-gray-100 mx-[-4px] md:mx-0">
                                                        <div className="hidden md:flex items-center gap-2 mb-1 px-3">
                                                            <div className="flex-1 grid grid-cols-6 gap-2">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BRAND</div>
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PRICE</div>
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BAG</div>
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SIZE</div>
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">QTY</div>
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">UNIT</div>
                                                            </div>
                                                            <div className="w-10"></div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            {product.brandEntries.map((entry, bIndex) => (
                                                                <div key={bIndex} className="p-2 md:p-3 bg-white/40 border border-gray-200/50 rounded-lg space-y-4 group/brand">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-2">
                                                                            <div className="relative w-full col-span-1" ref={el => brandRefs.current[`${pIndex}-${bIndex}`] = el}>
                                                                                <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Brand</label>
                                                                                <div className="flex items-center gap-1">
                                                                                    <div className="relative flex-1">
                                                                                        <input
                                                                                            type="text"
                                                                                            value={entry.brand}
                                                                                            placeholder="Search brand..."
                                                                                            onChange={(e) => { handleBrandEntryChange(pIndex, bIndex, 'brand', e.target.value); setActiveDropdown(`lcr-brand-${pIndex}-${bIndex}`); setHighlightedIndex(-1); }}
                                                                                            onFocus={() => {
                                                                                                setActiveDropdown(`lcr-brand-${pIndex}-${bIndex}`);
                                                                                                setHighlightedIndex(-1);
                                                                                            }}
                                                                                            onKeyDown={(e) => handleDropdownKeyDown(e, `lcr-brand-${pIndex}-${bIndex}`, (field, val) => { handleBrandEntryChange(pIndex, bIndex, 'brand', val); setActiveDropdown(null); }, 'brand', getFilteredBrands(entry.brand, product.productName))}
                                                                                            className={`w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-12 ${entry.brand ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                                                                        />
                                                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                                                            {entry.brand && (
                                                                                                <button type="button" onClick={() => { handleBrandEntryChange(pIndex, bIndex, 'brand', ''); setActiveDropdown(null); }} className="text-gray-400 hover:text-gray-600">
                                                                                                    <XIcon className="w-3.5 h-3.5" />
                                                                                                </button>
                                                                                            )}
                                                                                            <SearchIcon className="w-3.5 h-3.5 text-gray-300 pointer-events-none" />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="md:hidden flex items-center gap-0.5">
                                                                                        <button
                                                                                            type="button" onClick={() => addBrandEntry(pIndex)}
                                                                                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all"
                                                                                        >
                                                                                            <PlusIcon className="w-5 h-5 shadow-sm" />
                                                                                        </button>
                                                                                        {product.brandEntries.length > 1 && (
                                                                                            <button
                                                                                                type="button" onClick={() => removeBrandEntry(pIndex, bIndex)}
                                                                                                className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                            >
                                                                                                <TrashIcon className="w-4 h-4" />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {activeDropdown === `lcr-brand-${pIndex}-${bIndex}` && (
                                                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
                                                                                        {getFilteredBrands(entry.brand, product.productName).map((brand, idx) => (
                                                                                            <button
                                                                                                key={idx}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    handleBrandEntryChange(pIndex, bIndex, 'brand', brand);
                                                                                                    setActiveDropdown(null);
                                                                                                }}
                                                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                                                className={`w-full text-left px-3 py-2 text-sm transition-colors font-medium ${entry.brand === brand ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                                            >
                                                                                                {brand}
                                                                                            </button>
                                                                                        ))}
                                                                                        {getFilteredBrands(entry.brand, product.productName).length === 0 && (
                                                                                            <div className="px-3 py-2 text-sm text-gray-500 italic">
                                                                                                {!product.productName ? 'Please select a product first' : (
                                                                                                    <div className="flex flex-col gap-2">
                                                                                                        <span>No brands found</span>
                                                                                                        {entry.brand && (
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={() => handleAddBrand(pIndex, bIndex, entry.brand)}
                                                                                                                className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-semibold text-xs border border-blue-100"
                                                                                                            >
                                                                                                                + Add "{entry.brand}"
                                                                                                            </button>
                                                                                                        )}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                        {entry.brand && getFilteredBrands(entry.brand, product.productName).length > 0 && !getFilteredBrands(entry.brand, product.productName).some(b => b.toLowerCase() === entry.brand.toLowerCase()) && (
                                                                                            <div className="px-1 py-1 border-t border-gray-50">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => handleAddBrand(pIndex, bIndex, entry.brand)}
                                                                                                    className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-semibold text-xs text-left flex items-center gap-2"
                                                                                                >
                                                                                                    <PlusIcon className="w-3 h-3" /> Add "{entry.brand}"
                                                                                                </button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="space-y-1 md:space-y-0 col-span-1">
                                                                                <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Price</label>
                                                                                <input
                                                                                    type="number" value={entry.purchasedPrice} placeholder="Price" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'purchasedPrice', e.target.value)}
                                                                                    className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1 md:space-y-0 relative col-span-1">
                                                                                <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">BAG</label>
                                                                                <input
                                                                                    type="number" value={entry.packet && parseFloat(entry.packet) !== 0 ? entry.packet : ''} placeholder="BAG" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'packet', e.target.value)}
                                                                                    className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1 md:space-y-0 col-span-1">
                                                                                <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Size</label>
                                                                                <input
                                                                                    type="number" value={entry.packetSize} placeholder="Size" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'packetSize', e.target.value)}
                                                                                    className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1 md:space-y-0 col-span-1">
                                                                                <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Qty</label>
                                                                                <input
                                                                                    type="number"
                                                                                    value={entry.quantity && parseFloat(entry.quantity) !== 0 ? entry.quantity : ''}
                                                                                    onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'quantity', e.target.value)}
                                                                                    placeholder="Qty"
                                                                                    className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1 md:space-y-0 col-span-1">
                                                                                <label className="md:hidden text-[10px] font-bold text-gray-400 uppercase mb-1">Unit</label>
                                                                                <select
                                                                                    value={entry.unit} onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'unit', e.target.value)}
                                                                                    className="w-full h-9 px-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                                                >
                                                                                    <option>kg</option><option>pcs</option><option>boxes</option><option>liters</option>
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                        <div className="hidden md:flex items-center md:flex-col gap-1">
                                                                            <button
                                                                                type="button" onClick={() => addBrandEntry(pIndex)}
                                                                                className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-all"
                                                                            >
                                                                                <PlusIcon className="w-5 h-5 shadow-sm" />
                                                                            </button>
                                                                            {product.brandEntries.length > 1 && (
                                                                                <button
                                                                                    type="button" onClick={() => removeBrandEntry(pIndex, bIndex)}
                                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                                >
                                                                                    <TrashIcon className="w-4 h-4" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Combined line for Sweeped and InHouse fields */}
                                                                    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-3">
                                                                        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase md:min-w-[60px]">SWP. BAG</label>
                                                                            <input
                                                                                type="number" value={entry.sweepedPacket && parseFloat(entry.sweepedPacket) !== 0 ? entry.sweepedPacket : ''} placeholder="BAG" onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'sweepedPacket', e.target.value)}
                                                                                className="w-full h-9 md:h-8 px-2 text-xs bg-white/70 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase md:min-w-[60px]">SWPQTY</label>
                                                                            <input
                                                                                type="number" value={entry.sweepedQuantity && parseFloat(entry.sweepedQuantity) !== 0 ? entry.sweepedQuantity : ''}
                                                                                onChange={(e) => handleBrandEntryChange(pIndex, bIndex, 'sweepedQuantity', e.target.value)}
                                                                                placeholder="Qty"
                                                                                className="w-full h-9 md:h-8 px-2 text-xs bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase md:min-w-[60px]">INHOUSE BAG</label>
                                                                            <input
                                                                                type="text" value={entry.inHousePacket} readOnly placeholder="BAG"
                                                                                className="w-full h-9 md:h-8 px-2 text-xs bg-gray-50/80 border border-gray-200 rounded-md text-gray-600 font-medium outline-none cursor-default"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
                                                                            <label className="text-[10px] font-bold text-gray-400 uppercase md:min-w-[60px]">INHOUSE QTY</label>
                                                                            <input
                                                                                type="text" value={entry.inHouseQuantity} readOnly placeholder="Qty"
                                                                                className="w-full h-9 md:h-8 px-2 text-xs bg-gray-50/80 border border-gray-200 rounded-md text-gray-600 font-medium outline-none cursor-default"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            < div className="col-span-1 md:col-span-2 pt-4 border-t border-gray-100" >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="w-full sm:w-64 space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Status</label>
                                        <select
                                            name="status" value={stockFormData.status} onChange={handleStockInputChange}
                                            className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                        >
                                            <option>In Stock</option>
                                            <option>Sale From Panama</option>
                                        </select>
                                    </div>

                                    {/* Warehouse Selection */}
                                    <div className="w-full sm:w-64 space-y-2 relative" ref={whSelectRef}>
                                        <label className="text-sm font-medium text-gray-700">Warehouse</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={whSearchQuery}
                                                onChange={(e) => {
                                                    setWhSearchQuery(e.target.value);
                                                    setShowWhSelectDropdown(true);
                                                }}
                                                onFocus={() => setShowWhSelectDropdown(true)}
                                                placeholder={stockFormData.warehouse || "Search warehouse..."}
                                                autoComplete="off"
                                                className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-14 ${stockFormData.warehouse ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {stockFormData.warehouse && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setStockFormData(prev => ({ ...prev, warehouse: '' }));
                                                            setWhSearchQuery('');
                                                            setShowWhSelectDropdown(false);
                                                        }}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {showWhSelectDropdown && (
                                            <div className="absolute z-[200] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                {warehouses
                                                    .filter(wh => !whSearchQuery || wh.whName.toLowerCase().includes(whSearchQuery.toLowerCase()))
                                                    .map((wh, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                setStockFormData(prev => ({ ...prev, warehouse: wh.whName }));
                                                                setWhSearchQuery('');
                                                                setShowWhSelectDropdown(false);
                                                            }}
                                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium ${stockFormData.warehouse === wh.whName ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                                        >
                                                            {wh.whName}
                                                        </button>
                                                    ))}
                                                {warehouses.filter(wh => !whSearchQuery || wh.whName.toLowerCase().includes(whSearchQuery.toLowerCase())).length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-gray-400 italic">No warehouses found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedWhStock && (
                                    <div className="col-span-1 md:col-span-2 mt-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="bg-blue-50/50 backdrop-blur-sm border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
                                            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/80">
                                                <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                                    <BoxIcon className="w-4 h-4" />
                                                    What's in {stockFormData.warehouse}
                                                </h4>
                                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Current Inventory</span>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="bg-white/50 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider">Product</th>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider">Brand</th>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider text-right">WAREHOUSE BAG</th>
                                                            <th className="px-6 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider text-right">WAREHOUSE QUANTITY</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-blue-50">
                                                        {selectedWhStock.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="4" className="px-6 py-8 text-center text-blue-300 italic text-sm">
                                                                    This warehouse is currently empty
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            selectedWhStock.map((prod, pIdx) => (
                                                                <React.Fragment key={pIdx}>
                                                                    {prod.brands.map((brand, bIdx) => (
                                                                        <tr key={`${pIdx}-${bIdx}`} className="hover:bg-blue-50/80 transition-colors group">
                                                                            <td className="px-6 py-3">
                                                                                {bIdx === 0 && (
                                                                                    <span className="text-sm font-bold text-gray-800">{prod.productName}</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-6 py-3">
                                                                                <span className="text-sm text-gray-600 font-medium">{brand.brand}</span>
                                                                            </td>
                                                                            <td className="px-6 py-3 text-right font-bold text-gray-900 text-sm">
                                                                                {(() => {
                                                                                    const pkt = brand.whPkt || 0;
                                                                                    const size = brand.packetSize || 0;
                                                                                    const whole = Math.floor(pkt);
                                                                                    const remainder = Math.round((pkt % 1) * size);
                                                                                    return remainder > 0 ? `${whole.toLocaleString()} - ${remainder.toLocaleString()} kg` : whole.toLocaleString();
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-6 py-3 text-right font-bold text-gray-900 text-sm">
                                                                                {parseFloat(brand.whQty || 0).toLocaleString()} kg
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </React.Fragment>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="col-span-1 md:col-span-2 pt-4 flex flex-col md:flex-row items-center justify-center md:justify-between gap-4">
                                {validationErrors.length > 0 && (
                                    <div className="w-full mb-4 bg-red-50 border border-red-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                        <h5 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center justify-center md:justify-start gap-2">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                            Please correct the following:
                                        </h5>
                                        <ul className="list-disc list-inside space-y-1 text-center md:text-left">
                                            {validationErrors.map((err, i) => (
                                                <li key={i} className="text-xs text-red-500 font-medium">{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto md:ml-auto">
                                    {submitStatus === 'success' && (
                                        <p className="text-green-600 font-medium flex items-center justify-center md:justify-start animate-bounce">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Stock saved successfully!
                                        </p>
                                    )}
                                    {submitStatus === 'error' && validationErrors.length === 0 && (
                                        <p className="text-red-600 font-medium flex items-center justify-center md:justify-start">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            Failed to save LC receive.
                                        </p>
                                    )}
                                    <button
                                        type="submit" disabled={isSubmitting}
                                        className="w-full md:w-auto px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                                    >
                                        {isSubmitting ? 'Saving...' : editingId ? 'Update LC Receive' : 'Add LC Receive'}
                                    </button>
                                </div>
                            </div>
                        </form >
                    </div >
                )
            }

            {/* Table Section */}
            {
                !showStockForm && (
                    <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-sm overflow-hidden">
                        {/* ... Table logic ... */}
                        <div className="overflow-x-auto hidden md:block">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        {isSelectionMode && (
                                            <th className="px-6 py-4 w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.size === lcReceiveRecords.length && lcReceiveRecords.length > 0}
                                                    onChange={(e) => {
                                                        // Bulk select logic if needed
                                                    }}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </th>
                                        )}
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('date')}
                                        >
                                            <div className="flex items-center">
                                                Date
                                                {renderSortIcon('date')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('warehouse')}
                                        >
                                            <div className="flex items-center">
                                                Warehouse
                                                {renderSortIcon('warehouse')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('importer')}
                                        >
                                            <div className="flex items-center">
                                                Importer
                                                {renderSortIcon('importer')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('exporter')}
                                        >
                                            <div className="flex items-center">
                                                Exporter
                                                {renderSortIcon('exporter')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('exporter')}
                                        >
                                            <div className="flex items-center">
                                                Exporter
                                                {renderSortIcon('exporter')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('indianCnF')}
                                        >
                                            <div className="flex items-center">
                                                Ind C&F
                                                {renderSortIcon('indianCnF')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('indCnFCost')}
                                        >
                                            <div className="flex items-center">
                                                Cost
                                                {renderSortIcon('indCnFCost')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('bdCnF')}
                                        >
                                            <div className="flex items-center">
                                                BD C&F
                                                {renderSortIcon('bdCnF')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('bdCnFCost')}
                                        >
                                            <div className="flex items-center">
                                                Cost
                                                {renderSortIcon('bdCnFCost')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('billOfEntry')}
                                        >
                                            <div className="flex items-center">
                                                Bill Entry
                                                {renderSortIcon('billOfEntry')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('productName')}
                                        >
                                            <div className="flex items-center">
                                                Product
                                                {renderSortIcon('productName')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('totalLcTruck')}
                                        >
                                            <div className="flex items-center">
                                                Truck
                                                {renderSortIcon('totalLcTruck')}
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:bg-gray-100/50 transition-colors"
                                            onClick={() => handleSort('totalLcQuantity')}
                                        >
                                            <div className="flex items-center">
                                                Quantity
                                                {renderSortIcon('totalLcQuantity')}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan="14" className="px-6 py-12 text-center text-gray-400 bg-white/50">
                                                <BoxIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No LC receive records found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        // Grouping logic is complex (see App.jsx), recreating simplify logic here or reuse grouped records
                                        // For this extraction, I'll iterate directly or implement the grouping if needed.
                                        // App.jsx implements grouping within the map. I'll stick to a simpler rendering for now or copy the grouping logic.
                                        // IMPORTANT: The original code Groups by Date+LC+Port.
                                        // I will simplify for now to render row-by-row or recreate the reduce logic:

                                        Object.values(filteredRecords.reduce((acc, item) => {
                                            // Lines 2753-2818 in App.jsx
                                            const groupedKey = `${item.date}-${item.warehouse}-${item.indianCnF}-${item.bdCnF}-${item.importer}-${item.exporter}`;

                                            if (!acc[groupedKey]) {
                                                acc[groupedKey] = {
                                                    groupedKey,
                                                    date: item.date,
                                                    warehouse: item.warehouse,
                                                    indianCnF: item.indianCnF,
                                                    indCnFCost: item.indCnFCost,
                                                    bdCnF: item.bdCnF,
                                                    bdCnFCost: item.bdCnFCost,
                                                    importer: item.importer,
                                                    exporter: item.exporter,
                                                    billOfEntry: item.billOfEntry,
                                                    warehouse: item.warehouse || '',
                                                    totalLcTruck: 0,
                                                    totalQuantity: 0,
                                                    truckEntries: new Set(),
                                                    products: new Set(),
                                                    ids: [],
                                                    allIds: [],
                                                    entries: []
                                                };
                                            }

                                            const itemQty = parseFloat(item.quantity) || 0;
                                            acc[groupedKey].totalQuantity += itemQty;

                                            const truckEntryKey = `${item.date}-${item.productName}-${item.truckNo}`;
                                            if (!acc[groupedKey].truckEntries.has(truckEntryKey)) {
                                                acc[groupedKey].truckEntries.add(truckEntryKey);
                                                acc[groupedKey].totalLcTruck += (parseFloat(item.truckNo) || 0);
                                            }

                                            if (item.productName) acc[groupedKey].products.add(item.productName);
                                            acc[groupedKey].ids.push(item._id);
                                            acc[groupedKey].allIds.push(item._id);
                                            acc[groupedKey].entries.push(item);
                                            return acc;
                                        }, {})).map((entry) => {
                                            const uniqueEntriesMap = entry.entries.reduce((acc, item) => {
                                                const key = `${item.productName}-${item.truckNo}-${item.unit}`;
                                                if (!acc[key]) {
                                                    acc[key] = { ...item, quantity: 0 };
                                                }
                                                acc[key].quantity += (parseFloat(item.quantity) || 0);
                                                return acc;
                                            }, {});
                                            const uniqueEntries = Object.values(uniqueEntriesMap);

                                            return (
                                                <tr
                                                    key={entry.groupedKey}
                                                    className={`transition-colors duration-200 cursor-pointer select-none ${selectedItems.has(entry.groupedKey) ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
                                                    onMouseDown={() => startLongPress(entry.groupedKey)}
                                                    onMouseUp={endLongPress}
                                                    onMouseLeave={endLongPress}
                                                    onClick={() => {
                                                        if (isLongPressTriggered.current) return;
                                                        if (isSelectionMode) toggleSelection(entry.groupedKey);
                                                    }}
                                                >
                                                    {isSelectionMode && (
                                                        <td className="px-6 py-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedItems.has(entry.groupedKey)}
                                                                onChange={(e) => { e.stopPropagation(); toggleSelection(entry.groupedKey); }}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(entry.date)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.warehouse || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.importer || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.exporter || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.indianCnF || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {!isNaN(parseFloat(entry.indCnFCost)) && entry.indCnFCost !== '' ? `৳${parseFloat(entry.indCnFCost).toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.bdCnF || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {!isNaN(parseFloat(entry.bdCnFCost)) && entry.bdCnFCost !== '' ? `৳${parseFloat(entry.bdCnFCost).toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{entry.billOfEntry || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 align-top">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="leading-6 py-1 border-b border-gray-100 last:border-0 truncate max-w-xs">{item.productName || '-'}</div>
                                                        ))}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 align-top">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="leading-6 py-1 border-b border-gray-100 last:border-0">{item.truckNo || '0'}</div>
                                                        ))}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="leading-6 py-1 border-b border-gray-100 last:border-0">{Math.round(item.quantity)}</div>
                                                        ))}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end space-x-3">
                                                            <button onClick={(e) => { e.stopPropagation(); setViewData(entry); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="View Details">
                                                                <EyeIcon className="w-5 h-5" />
                                                            </button>

                                                            {entry.entries[0]?.status === 'Requested' ? (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleEditInternal('stock', entry); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                                                                        <EditIcon className="w-5 h-5" />
                                                                    </button>
                                                                    {canApprove && (
                                                                        <>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(entry, 'In Stock'); }}
                                                                                className="text-gray-400 hover:text-emerald-600 transition-colors"
                                                                                title="Accept"
                                                                            >
                                                                                <CheckIcon className="w-5 h-5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(entry, 'Rejected'); }}
                                                                                className="text-gray-400 hover:text-red-600 transition-colors"
                                                                                title="Reject"
                                                                            >
                                                                                <XIcon className="w-5 h-5" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {canEditDelete && (
                                                                        <>
                                                                            <button onClick={(e) => { e.stopPropagation(); handleEditInternal('stock', entry); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                                                                                <EditIcon className="w-5 h-5" />
                                                                            </button>
                                                                            <button onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const ids = entry.allIds || entry.ids;
                                                                                setSelectedItems(new Set(ids));
                                                                                onDelete('stock', null, true, entry);
                                                                            }} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete">
                                                                                <TrashIcon className="w-5 h-5" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
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

                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {filteredRecords.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-400 bg-white/50">
                                    <BoxIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No LC receive records found</p>
                                </div>
                            ) : (
                                Object.values(filteredRecords.reduce((acc, item) => {
                                    const dateStr = formatDate(item.date);
                                    const groupedKey = `${dateStr}-${item.lcNo}-${item.port}-${item.importer}-${item.billOfEntry}-${item.indianCnF}-${item.bdCnF}`;

                                    if (!acc[groupedKey]) {
                                        acc[groupedKey] = {
                                            groupedKey,
                                            date: item.date,
                                            lcNo: item.lcNo,
                                            port: item.port,
                                            importer: item.importer,
                                            exporter: item.exporter,
                                            indianCnF: item.indianCnF,
                                            indCnFCost: item.indCnFCost,
                                            bdCnF: item.bdCnF,
                                            bdCnFCost: item.bdCnFCost,
                                            billOfEntry: item.billOfEntry,
                                            status: item.status,
                                            warehouse: item.warehouse || '',
                                            totalQuantity: 0,
                                            totalLcQuantity: 0,
                                            totalShort: 0,
                                            totalInQty: 0,
                                            totalLcTruck: 0,
                                            truckEntries: new Set(),
                                            allIds: [],
                                            entries: []
                                        };
                                    }
                                    const itemQty = parseFloat(item.quantity) || 0;
                                    acc[groupedKey].totalQuantity += itemQty;
                                    acc[groupedKey].totalLcQuantity += itemQty;
                                    acc[groupedKey].totalShort += (parseFloat(item.sweepedQuantity) || 0);
                                    acc[groupedKey].totalInQty += (parseFloat(item.inHouseQuantity) || 0);

                                    const truckEntryKey = `${item.date}-${item.productName}-${item.truckNo}`;
                                    if (!acc[groupedKey].truckEntries.has(truckEntryKey)) {
                                        acc[groupedKey].truckEntries.add(truckEntryKey);
                                        acc[groupedKey].totalLcTruck += (parseFloat(item.truckNo) || 0);
                                    }

                                    acc[groupedKey].allIds.push(item._id);
                                    acc[groupedKey].entries.push(item);
                                    return acc;
                                }, {})).map((entry) => {
                                    const isExpanded = expandedCard === entry.groupedKey;
                                    const uniqueEntriesMap = entry.entries.reduce((acc, item) => {
                                        const key = `${item.productName}-${item.truckNo}-${item.unit}`;
                                        if (!acc[key]) {
                                            acc[key] = { ...item, quantity: 0 };
                                        }
                                        acc[key].quantity += (parseFloat(item.quantity) || 0);
                                        return acc;
                                    }, {});
                                    const uniqueEntries = Object.values(uniqueEntriesMap);

                                    return (
                                        <div
                                            key={entry.groupedKey}
                                            className="p-4 bg-white hover:bg-gray-50 transition-all cursor-pointer"
                                            onClick={() => toggleCard(entry.groupedKey)}
                                        >
                                            <div className={`flex justify-between items-center ${isExpanded ? 'mb-2' : ''}`}>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-gray-400 mb-0.5">{formatDate(entry.date)}</div>
                                                    <div className="flex items-center justify-between overflow-hidden">
                                                        <div className="text-sm font-bold text-gray-900 truncate pr-2">{entry.lcNo || 'N/A'}</div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {!isExpanded && (
                                                                <>
                                                                    <div className="text-[10px] font-bold text-blue-600 bg-blue-50/50 px-1.5 py-0.5 rounded uppercase tracking-wider">{entry.port || '-'}</div>
                                                                    <span className="text-gray-200 text-[10px]">|</span>
                                                                    <div className="text-[10px] font-bold text-amber-600 bg-amber-50/50 px-1.5 py-0.5 rounded uppercase tracking-wider">Truck: {entry.totalLcTruck}</div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {isExpanded && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setViewData(entry); }}
                                                                className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100"
                                                                title="View Details"
                                                            >
                                                                <EyeIcon className="w-4 h-4" />
                                                            </button>

                                                            {entry.entries[0]?.status === 'Requested' ? (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleEditInternal('stock', entry); }}
                                                                        className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100"
                                                                        title="Edit"
                                                                    >
                                                                        <EditIcon className="w-4 h-4" />
                                                                    </button>
                                                                    {canApprove && (
                                                                        <>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(entry, 'In Stock'); }}
                                                                                className="p-2 text-emerald-600 bg-emerald-50/50 rounded-lg transition-colors hover:bg-emerald-100"
                                                                                title="Accept"
                                                                            >
                                                                                <CheckIcon className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusUpdate(entry, 'Rejected'); }}
                                                                                className="p-2 text-red-600 bg-red-50/50 rounded-lg transition-colors hover:bg-red-100"
                                                                                title="Reject"
                                                                            >
                                                                                <XIcon className="w-4 h-4" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {canEditDelete && (
                                                                        <>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleEditInternal('stock', entry); }}
                                                                                className="p-2 text-blue-600 bg-blue-50/50 rounded-lg transition-colors hover:bg-blue-100"
                                                                                title="Edit"
                                                                            >
                                                                                <EditIcon className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const ids = entry.allIds || entry.entries.map(e => e._id);
                                                                                    setSelectedItems(new Set(ids));
                                                                                    onDelete('stock', null, true, entry);
                                                                                }}
                                                                                className="p-2 text-red-600 bg-red-50/50 rounded-lg transition-colors hover:bg-red-100"
                                                                                title="Delete"
                                                                            >
                                                                                <TrashIcon className="w-4 h-4" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    )}

                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-gray-50">
                                                        <div className="col-span-1">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">Importer</span>
                                                            <div className="text-gray-700 text-[13px] font-bold truncate">{entry.importer || "-"}</div>
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">Exporter</span>
                                                            <div className="text-gray-700 text-[13px] font-bold truncate">{entry.exporter || "-"}</div>
                                                        </div>

                                                        <div className="col-span-1">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">IND C&F</span>
                                                            <div className="text-gray-700 text-[13px] font-bold truncate">{entry.indianCnF || "-"}</div>
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">BD C&F</span>
                                                            <div className="text-gray-700 text-[13px] font-bold truncate">{entry.bdCnF || "-"}</div>
                                                        </div>

                                                        <div className="col-span-1">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">BOE</span>
                                                            <div className="text-gray-700 text-[13px] font-bold truncate">{entry.billOfEntry || "-"}</div>
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">Port</span>
                                                            <div className="text-blue-600 text-[13px] font-bold truncate">{entry.port || "-"}</div>
                                                        </div>
                                                        <div className="col-span-1">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">Truck</span>
                                                            <div className="text-gray-900 text-[13px] font-bold">{entry.totalLcTruck}</div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-x-2 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                                        <div className="col-span-1 text-center">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">Total Qty</span>
                                                            <div className="text-gray-900 font-bold text-sm">{Math.round(entry.totalQuantity).toLocaleString()} kg</div>
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">Short</span>
                                                            <div className="text-red-500 font-bold text-sm">{Math.round(entry.totalShort).toLocaleString()} kg</div>
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <span className="block text-gray-400 uppercase font-bold tracking-widest text-[10px] mb-0.5">IN QTY</span>
                                                            <div className="text-blue-600 font-bold text-sm">{Math.round(entry.totalInQty).toLocaleString()} kg</div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {uniqueEntries.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors">
                                                                <span className="font-black text-gray-900 truncate mr-2">{item.productName}</span>
                                                                <span className="shrink-0 text-gray-600 font-bold uppercase text-[11px]">
                                                                    QTY: {Math.round(item.quantity).toLocaleString()} kg | Truck: {item.truckNo}
                                                                </span>
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
                )
            }
            {viewData && <ViewDetailsModal data={viewData} onClose={() => setViewData(null)} />}
        </div >
    );
}

export default LCReceive;
