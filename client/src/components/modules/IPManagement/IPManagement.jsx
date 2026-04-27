import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, BoxIcon, ChevronUpIcon, SearchIcon, EyeIcon, PDFIcon, PlusIcon
} from '../../Icons';
import { API_BASE_URL, formatDate, SortIcon } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './IPManagement.css';

// Modal to show all LCs using a specific IP
const ViewIPLCsModal = ({ ipRecord, lcRecords, allStockRecords = [], allSalesRecords = [], onClose }) => {
    if (!ipRecord) return null;

    const relatedLCs = lcRecords.filter(lc => lc.ipNo === ipRecord.ipNumber);

    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    const cleanLc = (val) => String(val || '').replace(/\D/g, '');

    // Compute remaining quantity for each LC (same logic as LCManagement table)
    const computeLcRemQty = (lc) => {
        const lcNoClean = cleanLc(lc.lcNo);
        const qtyKg = parseNum(lc.quantity) * 1000;

        const receivedQtyKg = allStockRecords
            .filter(s => {
                const recordLcNoClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
            })
            .reduce((sum, s) => {
                const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                const qty = parseNum(s.totalLcQuantity) || parseNum(s.inHouseQuantity) || parseNum(s.quantity) || itemSubtotal;
                return sum + qty;
            }, 0);

        const borderSaleQtyKg = allSalesRecords
            .filter(s => {
                const recordLcNoClean = cleanLc(s.lcNo);
                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                const isBorder = sTypeLow.includes('border') ||
                    (s.invoiceNo || '').startsWith('BS') ||
                    (!s.saleType && !!(s.lcNo || s.port || s.importer)) ||
                    (recordLcNoClean === lcNoClean && !!(s.port || s.importer));
                const status = (s.status || '').toLowerCase();
                return recordLcNoClean === lcNoClean && status === 'accepted' && isBorder;
            })
            .reduce((sum, s) => {
                const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                    const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                    return iSum + (brandSubtotal || parseNum(item.quantity));
                }, 0);
                const qty = parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal;
                return sum + qty;
            }, 0);

        return qtyKg - (receivedQtyKg + borderSaleQtyKg);
    };

    // Calculate total quantity used and remaining for this IP
    const totalLcQtyKg = relatedLCs.reduce((sum, lc) => sum + (parseNum(lc.quantity) * 1000), 0);
    const ipQtyKg = parseNum(ipRecord.quantity);
    const ipRemQtyKg = ipQtyKg - totalLcQtyKg;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <EyeIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">LCs Under This IP</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                                IP: <span className="text-sm font-black text-blue-600">{ipRecord.ipNumber}</span> • {ipRecord.ipParty}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="px-6 pt-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Quantity</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-gray-900">{ipQtyKg.toLocaleString()}</span>
                                <span className="text-xs font-bold text-gray-400">Kg</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total LC Qty</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-gray-900">{totalLcQtyKg.toLocaleString()}</span>
                                <span className="text-xs font-bold text-gray-400">Kg</span>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remaining Qty</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black ${ipRemQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>{ipRemQtyKg.toLocaleString()}</span>
                                <span className="text-xs font-bold text-gray-400">Kg</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LC Table */}
                <div className="overflow-y-auto max-h-[60vh] px-6 pb-6 custom-scrollbar">
                    <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Expire Date</th>
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">LC No</th>
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Bank</th>
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Rem. Qty</th>
                                    <th className="px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {relatedLCs.length > 0 ? (
                                    relatedLCs.map((lc, idx) => {
                                        const lcQtyTon = parseNum(lc.quantity);
                                        const lcQtyKg = lcQtyTon * 1000;
                                        const lcRemQtyKg = computeLcRemQty(lc);
                                        return (
                                            <tr key={lc._id || idx} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-5 py-3.5 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(lc.openingDate)}</td>
                                                <td className="px-5 py-3.5 text-sm font-medium text-red-500 whitespace-nowrap">{formatDate(lc.expiryDate)}</td>
                                                <td className="px-5 py-3.5 text-sm font-black text-blue-600 whitespace-nowrap">{lc.lcNo || '-'}</td>
                                                <td className="px-5 py-3.5 text-sm font-medium text-gray-800 uppercase">{lc.bankName || '-'}</td>
                                                <td className="px-5 py-3.5 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                    {lcQtyKg.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-sm font-medium text-right whitespace-nowrap">
                                                    <span className={`font-black ${lcRemQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>{lcRemQtyKg.toLocaleString()}</span> <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                </td>
                                                <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                                    {(() => {
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const exp = new Date(lc.expiryDate);
                                                        exp.setHours(0, 0, 0, 0);
                                                        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

                                                        let statusText = "Active";
                                                        let statusClass = "bg-green-50 text-green-700 border-green-100";

                                                        if (exp < today) {
                                                            statusText = "Expired";
                                                            statusClass = "bg-red-50 text-red-600 border-red-100";
                                                        } else if (diffDays <= 5) {
                                                            statusText = "Expire Soon";
                                                            statusClass = "bg-amber-50 text-amber-600 border-amber-100";
                                                        }

                                                        return (
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusClass}`}>
                                                                {statusText}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-5 py-12 text-center text-gray-400 font-bold">No LC records found for this IP.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Modal specifically for viewing attached PDFs
const PDFViewerModal = ({ pdfData, fileName, onClose, onDownload }) => {
    if (!pdfData) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <PDFIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 leading-none mb-1">{fileName || "IP Document"}</h3>
                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></span>
                                Secure PDF Viewer
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onDownload(pdfData, fileName)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            Download PDF
                        </button>
                        <button onClick={onClose} className="p-2.5 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all border border-transparent hover:border-red-100 active:scale-90">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* PDF Content */}
                <div className="flex-1 bg-gray-100 relative">
                    <iframe
                        src={pdfData}
                        className="w-full h-full border-none shadow-inner"
                        title="PDF Viewer"
                    />
                </div>

                {/* Footer Tip */}
                <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Press ESC or click outside to close viewer</p>
                </div>
            </div>
        </div>
    );
};

function IPManagement({
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
    importers,
    ports,
    products = [],
    addNotification,
    currentUser
}) {
    const [showIpForm, setShowIpForm] = useState(false);
    const [ipRecords, setIpRecords] = useState([]);
    const [lcRecords, setLcRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const sentNotificationsRef = useRef(new Set()); // Session cache to prevent duplicate notifications
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [expandedIpId, setExpandedIpId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewIpLcData, setViewIpLcData] = useState(null);
    const [viewingPdf, setViewingPdf] = useState(null);
    const [viewingPdfName, setViewingPdfName] = useState("");
    const [allStockRecords, setAllStockRecords] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [piRecords, setPiRecords] = useState([]);

    // Authorization check for administrative actions
    const canManage = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());

    const [formData, setFormData] = useState({
        openingDate: '',
        closeDate: '',
        ipNumber: '',
        referenceNo: '',
        ipParty: '',
        productName: '',
        product: null,
        quantity: '',
        remainingQuantity: '',
        port: '',
        status: 'Active',
        ipAttachment: '',
        ipAttachmentName: ''
    });

    const [filters, setFilters] = useState({
        quickRange: 'all',
        startDate: '',
        endDate: '',
        port: '',
        importer: '',
        productName: ''
    });

    const ipImporterRef = useRef(null);
    const ipPortRef = useRef(null);
    const ipProductRef = useRef(null);
    const filterPortRef = useRef(null);
    const filterImporterRef = useRef(null);
    const filterProductRef = useRef(null);
    const ipStatusRef = useRef(null);

    useEffect(() => {
        fetchIpRecords();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown && !event.target.closest('.dropdown-container')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    const fetchIpRecords = async () => {
        setIsLoading(true);
        try {
            const [ipRes, lcRes, stockRes, saleRes, piRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/ip-records`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/pi`)
            ]);
            setIpRecords(Array.isArray(ipRes.data) ? ipRes.data : []);
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
            setPiRecords(Array.isArray(piRes.data) ? piRes.data : []);

            const rawStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const decryptedStock = rawStock.map(item => {
                try {
                    let d = item.data ? decryptData(item.data) : item;
                    if (typeof d === 'string') { try { d = decryptData(d); } catch (e) { } }
                    else if (d && d.data && typeof d.data === 'string' && !d.lcNo) { try { d = decryptData(d.data); } catch (e) { } }
                    return d;
                } catch { return item; }
            });
            setAllStockRecords(decryptedStock);

            const rawSales = Array.isArray(saleRes.data) ? saleRes.data : [];
            const decryptedSales = rawSales.map(item => {
                try {
                    let d = item.data ? decryptData(item.data) : item;
                    if (typeof d === 'string') { try { d = decryptData(d); } catch (e) { } }
                    else if (d && d.data && typeof d.data === 'string' && !d.lcNo && !d.saleType) { try { d = decryptData(d.data); } catch (e) { } }
                    return d;
                } catch { return item; }
            });
            setAllSalesRecords(decryptedSales);
        } catch (error) {
            console.error('Error fetching IP records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Helpers for robust calculations
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    // Calculate dynamic remaining quantity for each IP
    const enrichedIpRecords = useMemo(() => {
        return ipRecords.map(ip => {
            const ipNoClean = cleanLc(ip.ipNumber);
            const relatedLcs = lcRecords.filter(lc => cleanLc(lc.ipNo) === ipNoClean);
            const lcNumbers = relatedLcs.map(lc => cleanLc(lc.lcNo));

            // 1. LC Rem (kg) - Based on LC commitments
            const totalLcQtyInKg = relatedLcs.reduce((sum, lc) => sum + (parseNum(lc.quantity) * 1000), 0);
            const calculatedRemQty = (parseNum(ip.quantity) || 0) - totalLcQtyInKg;

            // 2. IP Balance - Based on actual consumption (LC Receive + Border Sale)
            let totalConsumption = 0;

            // Related Receipts (Stock)
            allStockRecords.forEach(s => {
                const sLcClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                if (lcNumbers.includes(sLcClean) && (status === 'accepted' || status === 'in stock')) {
                    const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                    const qty = parseNum(s.totalLcQuantity) || parseNum(s.inHouseQuantity) || parseNum(s.quantity) || itemSubtotal;
                    totalConsumption += qty;
                }
            });

            // Related Border Sales
            allSalesRecords.forEach(s => {
                const sLcClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                const isBorder = sTypeLow.includes('border') || (s.invoiceNo || '').startsWith('BS') || (!s.saleType && !!(s.lcNo || s.port || s.importer));
                
                if (lcNumbers.includes(sLcClean) && status === 'accepted' && isBorder) {
                    const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                        const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                        return iSum + (brandSubtotal || parseNum(item.quantity));
                    }, 0);
                    const qty = parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal;
                    totalConsumption += qty;
                }
            });

            const calculatedIpBalance = (parseNum(ip.quantity) || 0) - totalConsumption;

            // Calculate automated status based on closeDate
            let computedStatus = "Active";
            if (ip.closeDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const closeDate = new Date(ip.closeDate);
                closeDate.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((closeDate - today) / (1000 * 60 * 60 * 24));

                if (closeDate < today) {
                    computedStatus = "Expired";
                } else if (diffDays <= 5) {
                    computedStatus = "Expire Soon";
                }
            }

            return {
                ...ip,
                remainingQuantity: calculatedRemQty,
                ipBalance: calculatedIpBalance,
                totalLcCount: relatedLcs.length,
                computedStatus
            };
        });
    }, [ipRecords, lcRecords, piRecords, allStockRecords, allSalesRecords]);

    useEffect(() => {
        if (!addNotification || !currentUser || enrichedIpRecords.length === 0) return;

        // Managers and Data Entry can trigger notifications to avoid redundancy
        const isAuthorized = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());
        if (!isAuthorized && currentUser?.username !== 'admin') return;

        const targetRoles = ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Data Entry'];
        let hasTriggeredUpdate = false;

        enrichedIpRecords.forEach(record => {
            const hasSentExpireSoon = record.notificationSent?.expireSoon;
            const hasSentExpired = record.notificationSent?.expired;

            // Check session cache to prevent rapid-fire duplicates
            const expireSoonKey = `${record.ipNumber}_expireSoon`;
            const expiredKey = `${record.ipNumber}_expired`;

            if (record.computedStatus === 'Expire Soon' && !hasSentExpireSoon && !sentNotificationsRef.current.has(expireSoonKey)) {
                // Add to session cache immediately
                sentNotificationsRef.current.add(expireSoonKey);

                addNotification(
                    'IP Expiring Soon',
                    `IP No: ${record.ipNumber} (${record.ipParty}) is expiring soon on ${formatDate(record.closeDate)}.`,
                    targetRoles,
                    [],
                    true
                );

                // Mark as sent in DB
                const updatedData = {
                    ...record,
                    notificationSent: { ...(record.notificationSent || {}), expireSoon: true }
                };
                const { _id, computedStatus, remainingQuantity, totalLcCount, createdAt, ...dataToSave } = updatedData;
                axios.put(`${API_BASE_URL}/api/ip-records/${_id}`, dataToSave).catch(err => {
                    console.error('Error updating notification flag:', err);
                    // Optionally remove from cache if DB update fails, but safer to keep it to avoid spam
                });
                hasTriggeredUpdate = true;
            } else if (record.computedStatus === 'Expired' && !hasSentExpired && !sentNotificationsRef.current.has(expiredKey)) {
                // Add to session cache immediately
                sentNotificationsRef.current.add(expiredKey);

                addNotification(
                    'IP Expired',
                    `IP No: ${record.ipNumber} (${record.ipParty}) has expired on ${formatDate(record.closeDate)}.`,
                    targetRoles,
                    [],
                    true
                );

                // Mark as sent in DB
                const updatedData = {
                    ...record,
                    notificationSent: { ...(record.notificationSent || {}), expired: true }
                };
                const { _id, computedStatus, remainingQuantity, totalLcCount, createdAt, ...dataToSave } = updatedData;
                axios.put(`${API_BASE_URL}/api/ip-records/${_id}`, dataToSave).catch(err => {
                    console.error('Error updating notification flag:', err);
                });
                hasTriggeredUpdate = true;
            }
        });

        if (hasTriggeredUpdate) {
            // No need to fetch immediately as the axios.put is async and fetchIpRecords 
            // might run before DB is updated. The session cache handles it for now.
            // But we call it to sync eventually.
            setTimeout(fetchIpRecords, 1000);
        }
    }, [enrichedIpRecords, addNotification, currentUser]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto matich add 120 days from opening date
            if (name === 'openingDate' && value) {
                const openDate = new Date(value);
                if (!isNaN(openDate.getTime())) {
                    const closeDate = new Date(openDate);
                    closeDate.setDate(closeDate.getDate() + 121);
                    newData.closeDate = closeDate.toISOString().split('T')[0];
                }
            }

            return newData;
        });
    };

    const handleIpDropdownSelect = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleDropdownKeyDown = (e, dropdownId, options = [], field) => {
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
                const value = selected.name || selected;

                if (dropdownId.startsWith('filter-')) {
                    const filterField = dropdownId.replace('filter-', '');
                    setFilters(prev => ({ ...prev, [filterField]: value }));
                    setActiveDropdown(null);
                    setHighlightedIndex(-1);
                } else if (dropdownId === 'ip-product') {
                    // For product, value is just the name as per user request
                    setFormData(prev => ({ ...prev, productName: value }));
                    setActiveDropdown(null);
                    setHighlightedIndex(-1);
                } else {
                    handleIpDropdownSelect(field || dropdownId, value);
                }
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/ip-records/${editingId}`
                : `${API_BASE_URL}/api/ip-records`;

            if (editingId) {
                await axios.put(url, formData);

                // Add notification for IP Update
                if (addNotification) {
                    addNotification(
                        'IP Record Updated',
                        `IP No: ${formData.ipNumber} has been updated by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Data Entry']
                    );
                }
            } else {
                await axios.post(url, formData);

                // Add notification for New IP
                if (addNotification) {
                    addNotification(
                        'New IP Added',
                        `A new IP (No: ${formData.ipNumber}) has been added for ${formData.ipParty} by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Data Entry']
                    );
                }
            }
            setSubmitStatus('success');
            setTimeout(() => {
                setShowIpForm(false);
                resetIpForm();
                fetchIpRecords();
            }, 1500);
        } catch (error) {
            console.error('Error saving IP record:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetIpForm = () => {
        setFormData({
            openingDate: '',
            closeDate: '',
            ipNumber: '',
            referenceNo: '',
            ipParty: '',
            productName: '',
            product: null,
            quantity: '',
            remainingQuantity: '',
            port: '',
            status: 'Active',
            ipAttachment: '',
            ipAttachmentName: ''
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file type
        if (file.type !== 'application/pdf') {
            alert('Only PDF files are allowed.');
            return;
        }

        // Check file size (500KB = 500 * 1024 bytes)
        const maxSize = 500 * 1024;
        if (file.size > maxSize) {
            alert('File size exceeds the 500KB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({
                ...prev,
                ipAttachment: reader.result,
                ipAttachmentName: file.name
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeAttachment = () => {
        setFormData(prev => ({
            ...prev,
            ipAttachment: '',
            ipAttachmentName: ''
        }));
    };

    const downloadPDF = (base64Data, fileName) => {
        if (!base64Data) return;
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = fileName || 'IP_Document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEdit = (record) => {
        setFormData({
            openingDate: record.openingDate || '',
            closeDate: record.closeDate || '',
            ipNumber: record.ipNumber || '',
            referenceNo: record.referenceNo || '',
            ipParty: record.ipParty || '',
            productName: record.productName || '',
            quantity: record.quantity || '',
            port: record.port || '',
            ipAttachment: record.ipAttachment || '',
            ipAttachmentName: record.ipAttachmentName || ''
        });
        setEditingId(record._id);
        setShowIpForm(true);
    };

    const handleDelete = (id) => {
        onDeleteConfirm({ show: true, type: 'ip', id, isBulk: false });
    };

    const toggleSelection = (id) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
        if (newSelected.size === 0) setIsSelectionMode(false);
    };

    const toggleSelectAll = (records) => {
        if (selectedItems.size === records.length) {
            setSelectedItems(new Set());
            setIsSelectionMode(false);
        } else {
            setSelectedItems(new Set(records.map(r => r._id)));
            setIsSelectionMode(true);
        }
    };

    const requestSort = (key) => {
        setSortConfig(prev => ({
            ...prev,
            ip: {
                key,
                direction: prev.ip?.key === key && prev.ip?.direction === 'asc' ? 'desc' : 'asc'
            }
        }));
    };

    const sortData = (data) => {
        if (!sortConfig.ip?.key) return data;
        return [...data].sort((a, b) => {
            const aVal = a[sortConfig.ip.key];
            const bVal = b[sortConfig.ip.key];
            if (aVal < bVal) return sortConfig.ip.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.ip.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };


    const resetFilters = () => {
        setFilters({
            quickRange: 'all',
            startDate: '',
            endDate: '',
            port: '',
            importer: ''
        });
    };

    const filteredIpRecords = enrichedIpRecords.filter(record => {
        // Apply text search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesText =
                (record.ipNumber || '').toLowerCase().includes(query) ||
                (record.ipParty || '').toLowerCase().includes(query) ||
                (record.productName || '').toLowerCase().includes(query) ||
                (record.referenceNo || '').toLowerCase().includes(query);
            if (!matchesText) return false;
        }

        // Apply filters
        if (filters.port && record.port !== filters.port) return false;
        if (filters.importer && record.ipParty !== filters.importer) return false;
        if (filters.productName && record.productName !== filters.productName) return false;

        // Date filtering
        if (filters.startDate || filters.endDate) {
            const recordDate = new Date(record.openingDate);
            if (filters.startDate && recordDate < new Date(filters.startDate)) return false;
            if (filters.endDate && recordDate > new Date(filters.endDate)) return false;
        }

        // Quick range filtering
        if (filters.quickRange !== 'all' && filters.quickRange !== 'custom') {
            const now = new Date();
            const recordDate = new Date(record.openingDate);
            if (filters.quickRange === 'weekly' && (now - recordDate) > 7 * 24 * 60 * 60 * 1000) return false;
            if (filters.quickRange === 'monthly' && (now - recordDate) > 30 * 24 * 60 * 60 * 1000) return false;
            if (filters.quickRange === 'yearly' && (now - recordDate) > 365 * 24 * 60 * 60 * 1000) return false;
        }

        return true;
    });

    return (
        <div className="ip-management space-y-6">
            {!showIpForm && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-1/4 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-gray-800" style={{ margin: 0 }}>IP Management</h2>
                    </div>

                    <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                        <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search IP No, Party, Product or Ref..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm focus:bg-white"
                        />
                    </div>

                    <div className="w-full md:w-1/4 flex justify-end z-10 gap-2 sm:gap-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex-1 md:flex-none px-4 py-2 ${showFilters ? 'bg-indigo-100 text-indigo-600 border-indigo-200' : 'bg-white text-gray-600 border border-gray-200'} font-medium rounded-xl shadow-sm transition-all flex items-center justify-center hover:bg-gray-50 border`}
                        >
                            <FunnelIcon className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Filter'}</span>
                        </button>
                        {canManage && (
                            <button
                                onClick={() => setShowIpForm(!showIpForm)}
                                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap"
                            >
                                <span className="mr-1.5 font-bold text-lg leading-none">+</span> New IP
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Filters Section - Truncated for brevity, keeping the structure */}
            {showFilters && (
                <div className="ip-filters relative rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl p-6 transition-all duration-300 animate-in slide-in-from-top-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative z-10">
                        {/* Quick Range */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Quick Range</label>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'weekly', 'monthly', 'yearly'].map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setFilters(prev => ({ ...prev, quickRange: range, startDate: '', endDate: '' }))}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filters.quickRange === range ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {range.charAt(0).toUpperCase() + range.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Date Range */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Date Range</label>
                            <div className="flex items-center space-x-2">
                                <div className="flex-1 min-w-0">
                                    <CustomDatePicker
                                        value={filters.startDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value, quickRange: 'custom' }))}
                                        name="startDate"
                                        placeholder="From"
                                        compact={true}
                                    />
                                </div>
                                <span className="text-gray-400">to</span>
                                <div className="flex-1 min-w-0">
                                    <CustomDatePicker
                                        value={filters.endDate}
                                        onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value, quickRange: 'custom' }))}
                                        name="endDate"
                                        placeholder="To"
                                        compact={true}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Importer Filter - Simplified */}
                        <div className="space-y-3 relative dropdown-container" ref={filterImporterRef}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Importer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={filters.importer}
                                    onChange={(e) => { setFilters(prev => ({ ...prev, importer: e.target.value })); setActiveDropdown('filter-importer'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('filter-importer'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'filter-importer', importers.filter(imp => !filters.importer || importers.some(x => x.name === filters.importer) || imp.name.toLowerCase().includes(filters.importer.toLowerCase())), 'filter-importer')}
                                    placeholder="Search Importer..."
                                    autoComplete="off"
                                    className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {filters.importer && (
                                        <button type="button" onClick={() => setFilters(prev => ({ ...prev, importer: '' }))} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-3 h-3 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'filter-importer' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in zoom-in duration-200">
                                    {importers.filter(imp => !filters.importer || importers.some(x => x.name === filters.importer) || imp.name.toLowerCase().includes(filters.importer.toLowerCase())).length > 0 ? (
                                        importers.filter(imp => !filters.importer || importers.some(x => x.name === filters.importer) || imp.name.toLowerCase().includes(filters.importer.toLowerCase())).map((imp, idx) => (
                                            <button
                                                key={imp._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFilters(prev => ({ ...prev, importer: imp.name })); setActiveDropdown(null); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-3 py-1.5 text-left text-[11px] transition-colors font-medium ${filters.importer === imp.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {imp.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-1.5 text-[11px] text-gray-500">No importers found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Port Filter - Simplified */}
                        <div className="space-y-3 relative dropdown-container" ref={filterPortRef}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Port</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={filters.port}
                                    onChange={(e) => { setFilters(prev => ({ ...prev, port: e.target.value })); setActiveDropdown('filter-port'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('filter-port'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'filter-port', ports.filter(p => !filters.port || ports.some(x => x.name === filters.port) || p.name.toLowerCase().includes(filters.port.toLowerCase())), 'filter-port')}
                                    placeholder="Search Port..."
                                    autoComplete="off"
                                    className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {filters.port && (
                                        <button type="button" onClick={() => setFilters(prev => ({ ...prev, port: '' }))} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-3 h-3 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'filter-port' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in zoom-in duration-200">
                                    {ports.filter(p => !filters.port || ports.some(x => x.name === filters.port) || p.name.toLowerCase().includes(filters.port.toLowerCase())).length > 0 ? (
                                        ports.filter(p => !filters.port || ports.some(x => x.name === filters.port) || p.name.toLowerCase().includes(filters.port.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFilters(prev => ({ ...prev, port: port.name })); setActiveDropdown(null); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-3 py-1.5 text-left text-[11px] transition-colors font-medium ${filters.port === port.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {port.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-1.5 text-[11px] text-gray-500">No ports found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 relative dropdown-container" ref={filterProductRef}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Product</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={filters.productName}
                                    onChange={(e) => { setFilters(prev => ({ ...prev, productName: e.target.value })); setActiveDropdown('filter-product'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('filter-product'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'filter-product', products.filter(p => !filters.productName || p.name.toLowerCase().includes(filters.productName.toLowerCase())), 'filter-product')}
                                    placeholder="Search Product..."
                                    autoComplete="off"
                                    className="w-full px-3 py-2 text-xs bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {filters.productName && (
                                        <button type="button" onClick={() => setFilters(prev => ({ ...prev, productName: '' }))} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-3 h-3" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-3 h-3 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'filter-product' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in zoom-in duration-200">
                                    {products.filter(p => !filters.productName || p.name.toLowerCase().includes(filters.productName.toLowerCase())).length > 0 ? (
                                        products.filter(p => !filters.productName || p.name.toLowerCase().includes(filters.productName.toLowerCase())).map((p, idx) => (
                                            <button
                                                key={p._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFilters(prev => ({ ...prev, productName: p.name })); setActiveDropdown(null); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-3 py-1.5 text-left text-[11px] transition-colors font-medium ${filters.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-1.5 text-[11px] text-gray-500">No products found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                        <button
                            onClick={resetFilters}
                            className="flex items-center text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                        >
                            <XIcon className="w-3 h-3 mr-1" /> Clear Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Form Section - Continuing in next message due to length */}
            {showIpForm && (
                <div className="ip-form relative rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit IP Record' : 'Create New IP'}</h3>
                        <button onClick={() => { setShowIpForm(false); resetIpForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
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
                        className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10"
                    >
                        <CustomDatePicker
                            label="Date"
                            name="openingDate"
                            value={formData.openingDate}
                            onChange={handleInputChange}
                            required
                            compact={true}
                        />

                        <CustomDatePicker
                            label="Close Date"
                            name="closeDate"
                            value={formData.closeDate}
                            onChange={handleInputChange}
                            compact={true}
                            rightAlign={true}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">IP Number</label>
                            <input
                                type="text"
                                name="ipNumber"
                                value={formData.ipNumber}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter IP Number"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Reference No</label>
                            <input
                                type="text"
                                name="referenceNo"
                                value={formData.referenceNo}
                                onChange={handleInputChange}
                                required
                                placeholder="REF-12345"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-2 relative dropdown-container" ref={ipImporterRef}>
                            <label className="text-sm font-medium text-gray-700">Importer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="ipParty"
                                    value={formData.ipParty}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('ip-importer'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('ip-importer'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'ip-importer', importers.filter(imp => !formData.ipParty || importers.some(x => x.name === formData.ipParty) || imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())), 'ipParty')}
                                    placeholder="Search Importer..."
                                    autoComplete="off"
                                    required
                                    className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10 ${formData.ipParty ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.ipParty && (
                                        <button type="button" onClick={() => handleIpDropdownSelect('ipParty', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'ip-importer' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in zoom-in duration-200">
                                    {importers.filter(imp => !formData.ipParty || importers.some(x => x.name === formData.ipParty) || imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())).length > 0 ? (
                                        importers.filter(imp => !formData.ipParty || importers.some(x => x.name === formData.ipParty) || imp.name.toLowerCase().includes(formData.ipParty.toLowerCase())).map((imp, idx) => (
                                            <button
                                                key={imp._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleIpDropdownSelect('ipParty', imp.name); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.ipParty === imp.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {imp.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-sm text-gray-500">No importers found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={ipProductRef}>
                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="productName"
                                    value={formData.productName}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('ip-product'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('ip-product'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'ip-product', products.filter(p => !formData.productName || products.some(x => x.name === formData.productName) || p.name.toLowerCase().includes(formData.productName.toLowerCase())), 'productName')}
                                    placeholder="Search Product..."
                                    autoComplete="off"
                                    required
                                    className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10 ${formData.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.productName && (
                                        <button type="button" onClick={() => handleIpDropdownSelect('productName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'ip-product' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in zoom-in duration-200">
                                    {products.filter(p => !formData.productName || products.some(x => x.name === formData.productName) || p.name.toLowerCase().includes(formData.productName.toLowerCase())).length > 0 ? (
                                        products.filter(p => !formData.productName || products.some(x => x.name === formData.productName) || p.name.toLowerCase().includes(formData.productName.toLowerCase())).map((p, idx) => (
                                            <button
                                                key={p._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleIpDropdownSelect('productName', p.name); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.productName === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-sm text-gray-500">No products found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Quantity (kg)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0.00"
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-400 text-sm">kg</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Remaining Quantity (kg)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    name="remainingQuantity"
                                    value={formData.remainingQuantity}
                                    readOnly
                                    placeholder="0.00"
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200/60 rounded-lg focus:ring-0 outline-none transition-all backdrop-blur-sm cursor-not-allowed font-semibold text-blue-600"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-gray-400 text-sm">kg</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={ipPortRef}>
                            <label className="text-sm font-medium text-gray-700">Port</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="port"
                                    value={formData.port}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('ip-port'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('ip-port'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'ip-port', ports.filter(p => !formData.port || ports.some(x => x.name === formData.port) || p.name.toLowerCase().includes(formData.port.toLowerCase())), 'port')}
                                    placeholder="Search Port..."
                                    autoComplete="off"
                                    required
                                    className={`w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all backdrop-blur-sm pr-10 ${formData.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-400'}`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.port && (
                                        <button type="button" onClick={() => handleIpDropdownSelect('port', '')} className="text-gray-400 hover:text-red-500 shrink-0">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none shrink-0" />
                                </div>
                            </div>
                            {activeDropdown === 'ip-port' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1 animate-in zoom-in duration-200">
                                    {ports.filter(p => !formData.port || ports.some(x => x.name === formData.port) || p.name.toLowerCase().includes(formData.port.toLowerCase())).length > 0 ? (
                                        ports.filter(p => !formData.port || ports.some(x => x.name === formData.port) || p.name.toLowerCase().includes(formData.port.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleIpDropdownSelect('port', port.name); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.port === port.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {port.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-2 text-sm text-gray-500">No ports found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* PDF Attachment Field */}
                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                PDF Attachment (Max 500KB)
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">New</span>
                            </label>
                            <div className="mt-1 flex items-center gap-4">
                                {formData.ipAttachment ? (
                                    <div className="flex-1 flex items-center justify-between p-3 bg-blue-50/50 border border-blue-100 rounded-xl group relative transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
                                                <PDFIcon className="w-6 h-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate">
                                                    {formData.ipAttachmentName || 'IP_Document.pdf'}
                                                </p>
                                                <p className="text-[10px] text-blue-500 font-medium uppercase tracking-widest">
                                                    PDF Document Attached
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={removeAttachment}
                                            className="p-2 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50 transition-colors border border-gray-100"
                                            title="Remove PDF"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex-1 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-blue-50/30 hover:border-blue-400 transition-all group overflow-hidden relative">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-100 transition-all mb-3 text-gray-400 group-hover:text-blue-600 shadow-sm border border-gray-100">
                                                <PlusIcon className="w-6 h-6" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-700 group-hover:text-blue-700 mb-1">Click to upload IP PDF</p>
                                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Only PDF files are allowed • Max 500KB</p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="application/pdf"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 pt-4 flex items-center justify-between">
                            {submitStatus === 'success' && (
                                <p className="text-green-600 font-medium flex items-center animate-bounce">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    Record saved successfully!
                                </p>
                            )}
                            {submitStatus === 'error' && (
                                <p className="text-red-600 font-medium flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    Failed to save record.
                                </p>
                            )}
                            <div className="flex-1"></div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center ${isSubmitting ? 'opacity-70 cursor-not-allowed scale-100' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : 'Save IP Record'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table Section */}
            {!showIpForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {selectedItems.size > 0 && (
                        <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700">{selectedItems.size} items selected</span>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => { setSelectedItems(new Set()); setIsSelectionMode(false); }}
                                    className="px-3 py-1 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => onDeleteConfirm({ show: true, type: 'ip', id: null, isBulk: true })}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors flex items-center"
                                >
                                    <TrashIcon className="w-3.5 h-3.5 mr-1" /> Delete Bulk
                                </button>
                            </div>
                        </div>
                    )}
                    {isLoading ? (
                        <div className="flex items-center justify-center p-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredIpRecords.length > 0 ? (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto text-sm lg:text-base">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr
                                            className="bg-gray-50 border-b border-gray-100 select-none cursor-pointer"
                                            onMouseDown={() => startLongPress(null)}
                                            onMouseUp={endLongPress}
                                            onMouseLeave={endLongPress}
                                            onTouchStart={() => startLongPress(null)}
                                            onTouchEnd={endLongPress}
                                        >
                                            {isSelectionMode && (
                                                <th className="px-6 py-4 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.size === filteredIpRecords.length && filteredIpRecords.length > 0}
                                                        onChange={() => toggleSelectAll(filteredIpRecords)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </th>
                                            )}
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('openingDate')}>
                                                <div className="flex items-center">Date <SortIcon config={sortConfig.ip} columnKey="openingDate" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('closeDate')}>
                                                <div className="flex items-center">Close Date <SortIcon config={sortConfig.ip} columnKey="closeDate" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ipNumber')}>
                                                <div className="flex items-center">IP Number <SortIcon config={sortConfig.ip} columnKey="ipNumber" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('referenceNo')}>
                                                <div className="flex items-center">Reference No <SortIcon config={sortConfig.ip} columnKey="referenceNo" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ipParty')}>
                                                <div className="flex items-center">Importer <SortIcon config={sortConfig.ip} columnKey="ipParty" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('port')}>
                                                <div className="flex items-center">Port <SortIcon config={sortConfig.ip} columnKey="port" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('productName')}>
                                                <div className="flex items-center">Product <SortIcon config={sortConfig.ip} columnKey="productName" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('quantity')}>
                                                <div className="flex items-center">Quantity (kg) <SortIcon config={sortConfig.ip} columnKey="quantity" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('remainingQuantity')}>
                                                <div className="flex items-center">LC Rem (kg) <SortIcon config={sortConfig.ip} columnKey="remainingQuantity" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('ipBalance')}>
                                                <div className="flex items-center">IP Balance <SortIcon config={sortConfig.ip} columnKey="ipBalance" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('totalLcCount')}>
                                                <div className="flex items-center">Total LC <SortIcon config={sortConfig.ip} columnKey="totalLcCount" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('computedStatus')}>
                                                <div className="flex items-center">Status <SortIcon config={sortConfig.ip} columnKey="computedStatus" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sortData(filteredIpRecords).map((record) => (
                                            <tr
                                                key={record._id}
                                                className={`${selectedItems.has(record._id) ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors cursor-pointer select-none`}
                                                onMouseDown={() => startLongPress(record._id)}
                                                onMouseUp={endLongPress}
                                                onMouseLeave={endLongPress}
                                                onTouchStart={() => startLongPress(record._id)}
                                                onTouchEnd={endLongPress}
                                                onClick={() => {
                                                    if (isLongPressTriggered.current) {
                                                        isLongPressTriggered.current = false;
                                                        return;
                                                    }
                                                    if (isSelectionMode) toggleSelection(record._id);
                                                }}
                                            >
                                                {isSelectionMode && (
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(record._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelection(record._id); }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(record.openingDate)}</td>
                                                <td className="px-6 py-4 text-sm text-red-500 font-medium">{formatDate(record.closeDate)}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-black">{record.ipNumber}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{record.referenceNo || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{record.ipParty}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{record.port || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{record.productName}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.quantity} kg</td>
                                                <td className="px-6 py-4 text-sm font-medium text-black">{record.remainingQuantity || '0'} kg</td>
                                                <td className="px-6 py-4 text-sm font-bold text-blue-700">{(record.ipBalance || 0).toLocaleString()} kg</td>
                                                <td className="px-6 py-4 text-sm font-bold text-indigo-600">{record.totalLcCount || 0}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${record.computedStatus === 'Active' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        record.computedStatus === 'Expired' ? 'bg-red-50 text-red-600 border-red-100' :
                                                            'bg-amber-50 text-amber-700 border-amber-100'
                                                        }`}>
                                                        {record.computedStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <button onClick={(e) => { e.stopPropagation(); setViewIpLcData(record); }} className="text-gray-400 hover:text-indigo-600 transition-colors" title="View LCs">
                                                            <EyeIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (record.ipAttachment) {
                                                                    setViewingPdf(record.ipAttachment);
                                                                    setViewingPdfName(record.ipAttachmentName);
                                                                } else {
                                                                    alert("No PDF document has been uploaded for this IP record.");
                                                                }
                                                            }}
                                                            className={`${record.ipAttachment ? 'text-blue-500 hover:text-blue-700' : 'text-gray-200 cursor-not-allowed'} transition-colors`}
                                                            title={record.ipAttachment ? `View ${record.ipAttachmentName || 'PDF'}` : 'No PDF attached'}
                                                        >
                                                            <PDFIcon className="w-5 h-5" />
                                                        </button>
                                                        {canManage && (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(record); }} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit Record">
                                                                    <EditIcon className="w-5 h-5" />
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(record._id); }} className="text-gray-400 hover:text-red-600 transition-colors" title="Delete Record">
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="block md:hidden px-2 py-3 space-y-3">
                                {sortData(filteredIpRecords).map((record) => {
                                    const isExpanded = expandedIpId === record._id;
                                    return (
                                        <div
                                            key={record._id}
                                            className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${selectedItems.has(record._id) ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 shadow-sm'} ${isExpanded ? 'ring-1 ring-blue-50 shadow-md border-blue-200' : 'hover:border-gray-200'}`}
                                            onTouchStart={() => startLongPress(record._id)}
                                            onTouchEnd={endLongPress}
                                            onClick={() => {
                                                if (isLongPressTriggered.current) {
                                                    isLongPressTriggered.current = false;
                                                    return;
                                                }
                                                if (isSelectionMode) {
                                                    toggleSelection(record._id);
                                                } else {
                                                    setExpandedIpId(isExpanded ? null : record._id);
                                                }
                                            }}
                                        >
                                            {/* Card Header */}
                                            <div className="flex justify-between items-center p-4">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    {isSelectionMode && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(record._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelection(record._id); }}
                                                            className="w-5 h-5 accent-blue-600 shrink-0"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{formatDate(record.openingDate)}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="font-bold text-black text-lg sm:text-xl truncate uppercase tracking-tight shrink-0">{record.ipNumber}</p>
                                                            <span className="text-gray-300">|</span>
                                                            <p className="text-sm font-semibold text-gray-900 truncate">{record.ipParty}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${record.computedStatus === 'Active' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        record.computedStatus === 'Expired' ? 'bg-red-50 text-red-600 border-red-100' :
                                                            'bg-amber-50 text-amber-700 border-amber-100'
                                                        }`}>
                                                        {record.computedStatus}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Expandable Body */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-3 pt-3 border-t border-gray-50">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Product</span>
                                                            <span className="text-gray-900 font-black text-sm">{record.productName}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Quantity</span>
                                                            <span className="text-gray-900 font-black text-sm">{record.quantity} kg</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Rem. Quantity</span>
                                                            <span className="text-black font-black text-sm">{record.remainingQuantity || '0'} kg</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Total LC</span>
                                                            <span className="text-indigo-600 font-black text-sm">{record.totalLcCount || 0}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Port</span>
                                                            <span className="text-gray-900 font-black text-sm">{record.port}</span>
                                                        </div>
                                                        {record.closeDate && (
                                                            <div className="flex justify-between items-center pt-1">
                                                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Close Date</span>
                                                                <span className="text-red-600 font-black text-sm">{formatDate(record.closeDate)}</span>
                                                            </div>
                                                        )}
                                                        {record.referenceNo && (
                                                            <div className="flex justify-between items-center pt-1">
                                                                <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Reference</span>
                                                                <span className="text-gray-900 font-black text-sm">{record.referenceNo}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Card Actions */}
                                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewIpLcData(record); }}
                                                            className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-black flex-1 hover:bg-indigo-100 transition-all active:scale-95"
                                                        >
                                                            <EyeIcon className="w-5 h-5" /> View LCs
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (record.ipAttachment) {
                                                                    setViewingPdf(record.ipAttachment);
                                                                    setViewingPdfName(record.ipAttachmentName);
                                                                } else {
                                                                    alert("No PDF document has been uploaded for this IP record.");
                                                                }
                                                            }}
                                                            className={`flex items-center justify-center gap-2 py-3 px-4 ${record.ipAttachment ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'} rounded-xl text-sm font-black flex-1 transition-all active:scale-95`}
                                                        >
                                                            <PDFIcon className="w-5 h-5" /> {record.ipAttachment ? 'View PDF' : 'No PDF'}
                                                        </button>
                                                        {canManage && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                                                                    className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-black flex-1 hover:bg-blue-100 transition-all active:scale-95"
                                                                >
                                                                    <EditIcon className="w-5 h-5" /> Edit Record
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(record._id); }}
                                                                    className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </>
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
                        <div className="flex flex-col items-center justify-center p-12">
                            <div className="p-4 bg-gray-50 rounded-full mb-4">
                                <BoxIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">{searchQuery ? 'No IP records found matching your search' : 'No IP records found'}</p>
                            <p className="text-sm text-gray-400 mt-1">{searchQuery ? '' : 'Click "Add New" to create a new entry'}</p>
                        </div>
                    )}
                </div>
            )}

            {/* View IP LCs Modal */}
            {viewIpLcData && (
                <ViewIPLCsModal
                    ipRecord={viewIpLcData}
                    lcRecords={lcRecords}
                    allStockRecords={allStockRecords}
                    allSalesRecords={allSalesRecords}
                    onClose={() => setViewIpLcData(null)}
                />
            )}
            {viewingPdf && (
                <PDFViewerModal
                    pdfData={viewingPdf}
                    fileName={viewingPdfName}
                    onClose={() => { setViewingPdf(null); setViewingPdfName(""); }}
                    onDownload={downloadPDF}
                />
            )}
        </div>
    );
}

export default IPManagement;
