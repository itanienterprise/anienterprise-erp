import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from '../../../utils/api';
import {
    PlusIcon, XIcon, EditIcon, TrashIcon, SearchIcon,
    LCManagerIcon, ShieldIcon, BuildingIcon, GlobeIcon,
    DollarSignIcon, CalendarIcon, ChevronDownIcon, EyeIcon
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import { decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';
const ViewDetailsModal = ({ data, onClose, allStockRecords = [], allSalesRecords = [] }) => {
    const [showConsumption, setShowConsumption] = useState(true);
    if (!data) return null;

    // Failsafe LC Matching helper
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    const lcNoClean = cleanLc(data.lcNo);

    // Calculate Consumptions
    const relatedReceipts = allStockRecords
        .filter(s => {
            const recordLcNoClean = cleanLc(s.lcNo);
            const status = (s.status || '').toLowerCase();
            return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
        })
        .map(s => {
            const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
            // truckNo is a numeric count (number of trucks), not a plate number
            const truckNumeric = parseFloat(s.truckNo) || 0;
            return {
                date: s.receiveDate || s.createdAt,
                importer: s.importer || data.importer,
                exporter: s.exporter || data.exporter,
                product: s.productName || data.productName,
                truck: s.truckNo || s.truck || '-',
                truckCount: truckNumeric,
                quantity: parseNum(s.totalLcQuantity) || parseNum(s.inHouseQuantity) || parseNum(s.quantity) || itemSubtotal,
                source: 'LC Receive'
            };
        });

    const relatedSales = allSalesRecords
        .filter(s => {
            const recordLcNoClean = cleanLc(s.lcNo);
            const sTypeLow = (s.saleType || '').toLowerCase().trim();
            const isBorder = sTypeLow.includes('border') || (s.invoiceNo || '').startsWith('BS') || (!s.saleType && !!(s.lcNo || s.port || s.importer)) || (recordLcNoClean === lcNoClean && !!(s.port || s.importer));
            const status = (s.status || '').toLowerCase();
            return recordLcNoClean === lcNoClean && status === 'accepted' && isBorder;
        })
        .map(s => {
            const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                return iSum + (brandSubtotal || parseNum(item.quantity));
            }, 0);
            // truckNo for sales — check all possible locations matching the display truck field
            const truckRaw = s.truckNo || s.truck || (s.items && s.items[0]?.brandEntries && s.items[0].brandEntries[0]?.truck) || 0;
            const truckNumeric = parseFloat(truckRaw) || 0;
            return {
                date: s.date || s.createdAt,
                importer: s.importer || data.importer,
                exporter: s.exporter || data.exporter,
                product: (s.items && s.items[0]?.productName) || s.productName || data.productName,
                truck: s.truckNo || s.truck || (s.items && s.items[0]?.brandEntries && s.items[0].brandEntries[0]?.truck) || '-',
                truckCount: truckNumeric,
                quantity: parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal,
                source: 'Border sale'
            };
        });

    const consumptionHistory = [...relatedReceipts, ...relatedSales].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Summary Calculations
    const totalLcQtyKg = parseNum(data.quantity) * 1000;
    const consumedQtyKg = consumptionHistory.reduce((sum, item) => sum + parseNum(item.quantity), 0);
    const remQtyKg = totalLcQtyKg - consumedQtyKg;
    // truckNo is a numeric count per entry — sum all values instead of counting unique strings
    const truckCount = consumptionHistory.reduce((sum, item) => sum + (item.truckCount || 0), 0);

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${showConsumption ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-blue-600'}`}>
                            <LCManagerIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">{showConsumption ? 'LC Consumption History' : 'LC Record Details'}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                                LC NO: <span className={`text-sm font-black ${showConsumption ? 'text-blue-600' : 'text-blue-600'}`}>{data.lcNo}</span> • {formatDate(data.openingDate)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowConsumption(!showConsumption)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${showConsumption
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-white'
                                }`}
                        >
                            <LCManagerIcon className="w-4 h-4" />
                            {showConsumption ? 'Show Details' : 'LC History'}
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[80vh] p-8 custom-scrollbar">
                    {showConsumption ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <LCManagerIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC Quantity</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">{totalLcQtyKg.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-gray-400">Kg</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <GlobeIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Consumption</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">{consumedQtyKg.toLocaleString()}</span>
                                        <span className="text-xs font-bold text-gray-400">Kg</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                            <ShieldIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rem. Quantity</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-black ${remQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {remQtyKg.toLocaleString()}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">Kg</span>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200 group">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-gray-50 text-gray-600 rounded-xl group-hover:bg-gray-800 group-hover:text-white transition-colors">
                                            <BuildingIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Truck</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-gray-900">{truckCount}</span>
                                        <span className="text-xs font-bold text-gray-400">Units</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b border-gray-100">
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Importer</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Exporter</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Truck</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Source</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {consumptionHistory.length > 0 ? (
                                            consumptionHistory.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-800 uppercase">{item.importer || '-'}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-800 uppercase">{item.exporter || '-'}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.product || '-'}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-blue-600 uppercase whitespace-nowrap">{item.truck || '-'}</td>
                                                    <td className="px-6 py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                        {parseNum(item.quantity).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${item.source === 'LC Receive'
                                                            ? 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                            : 'bg-indigo-50 text-indigo-600 border-indigo-100/50'
                                                            }`}>
                                                            {item.source}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-12 text-center text-gray-400 font-bold">No consumption history found for this LC.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-50/30">
                                        <tr>
                                            <td colSpan="5" className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Consumption:</td>
                                            <td className="px-6 py-4 text-sm font-medium text-right text-blue-600">
                                                {consumptionHistory.reduce((sum, item) => sum + parseNum(item.quantity), 0).toLocaleString()} <span className="text-[10px] font-normal">Kg</span>
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Section 1: General Information */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <GlobeIcon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">General Information</h4>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Number</span>
                                        <p className="text-sm font-bold text-blue-600">{data.piNo || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Number</span>
                                        <p className="text-sm font-bold text-gray-800">{data.ipNo || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Date</span>
                                        <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">{formatDate(data.openingDate)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-red-500">Expiry Date</span>
                                        <p className="text-sm font-bold text-red-500 font-mono tracking-tight">{formatDate(data.expiryDate)}</p>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</span>
                                        <p className="text-sm font-bold text-gray-800 truncate" title={data.bankName}>{data.bankName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                        <p className="text-sm font-bold text-gray-800 truncate">{data.importerName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                        <p className="text-sm font-bold text-gray-800 truncate">{data.exporterName}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Product & Financials */}
                            <div className="pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <DollarSignIcon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Product & Financial Details</h4>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product Name</span>
                                        <p className="text-sm font-black text-gray-900">{data.productName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">HS Code</span>
                                        <p className="text-sm font-bold text-gray-800">{data.hsCode || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                        <p className="text-sm font-bold text-gray-800">{data.port || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                        <p className="text-sm font-black text-gray-900">
                                            {parseFloat(data.quantity || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">Ton</span>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rate</span>
                                        <p className="text-sm font-bold text-gray-800">
                                            ${parseFloat(data.rate || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">/Ton</span>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Dollar</span>
                                        <p className="text-sm font-black text-blue-600">${parseFloat(data.totalDollar || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dollar Rate</span>
                                        <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.dollarRate || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total LC Value</span>
                                    <span className="text-xl font-black text-gray-900">৳{parseFloat(data.totalAmount || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Section 3: Insurance Details */}
                            <div className="pt-6 border-t border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <ShieldIcon className="w-4 h-4 text-gray-400" />
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Insurance Information</h4>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Insurance Company</span>
                                        <p className="text-sm font-bold text-gray-800 truncate">{data.insuranceCo || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Policy Type</span>
                                        <p className="text-sm font-bold text-gray-800">{data.policyType || '-'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Extra %</span>
                                        <p className="text-sm font-bold text-gray-800">{data.extraPercent}%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Rate</span>
                                        <p className="text-sm font-bold text-gray-800">{data.premium}%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Return</span>
                                        <p className="text-sm font-bold text-blue-600">{data.premiumReturn || '0'}%</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                        <p className="text-sm font-bold text-blue-600">৳{parseFloat(data.expectedReturnAmount || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT ({data.premiumVat}%)</span>
                                        <p className="text-sm font-bold text-gray-800">
                                            ৳{(parseFloat(data.netPremium || 0) * (parseFloat(data.premiumVat || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stamp Duty</span>
                                        <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.stampCharge || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                        <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.grossPremium || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="mt-4 p-4 bg-blue-50 rounded-xl flex justify-between items-center border border-blue-100">
                                    <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Net Payable Premium</span>
                                    <span className="text-lg font-black text-blue-700">৳{parseFloat(data.netPremium || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LCManagement = ({ addNotification }) => {
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [importers, setImporters] = useState([]);
    const [exporters, setExporters] = useState([]);
    const [insuranceCos, setInsuranceCos] = useState([]);
    const [insuranceRecordsRaw, setInsuranceRecordsRaw] = useState([]);
    const [ipList, setIpList] = useState([]);
    const [ipRecordsRaw, setIpRecordsRaw] = useState([]);
    const [piList, setPiList] = useState([]);
    const [piRecordsRaw, setPiRecordsRaw] = useState([]);
    const [productItems, setProductItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [viewData, setViewData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [allStockRecords, setAllStockRecords] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);

    const ipRef = useRef(null);
    const piRef = useRef(null);
    const bankRef = useRef(null);
    const importerRef = useRef(null);
    const exporterRef = useRef(null);
    const productRef = useRef(null);
    const insuranceRef = useRef(null);
    const statusRef = useRef(null);


    const [formData, setFormData] = useState({
        ipNo: '',
        piNo: '',
        lcNo: '',
        openingDate: '',
        expiryDate: '',
        bankName: '',
        importerName: '',
        exporterName: '',
        hsCode: '',
        productName: '',
        quantity: '',
        rate: '',
        totalDollar: '',
        dollarRate: '',
        insuranceCo: '',
        policyType: '',
        extraPercent: '',
        premium: '',
        grossPremium: '',
        premiumReturn: '',
        expectedReturnAmount: '',
        netPremium: '',
        premiumVat: '15',
        stampCharge: '',
        totalAmount: '',
        status: 'Opened',
        port: ''
    });

    const informativeQuantities = useMemo(() => {
        const selectedIp = ipRecordsRaw.find(ip => ip.ipNumber === formData.ipNo);
        const selectedPi = piRecordsRaw.find(pi => pi.piNumber === formData.piNo);

        let remIpQtyTon = 0;
        if (selectedIp) {
            const totalLcQtyOnThisIp = lcRecords
                .filter(lc => lc.ipNo === selectedIp.ipNumber && lc._id !== editingId)
                .reduce((sum, lc) => sum + (parseFloat(lc.quantity) || 0), 0);
            remIpQtyTon = (parseFloat(selectedIp.quantity || 0) / 1000) - totalLcQtyOnThisIp;
        }

        const piQtyTon = selectedPi ? (parseFloat(selectedPi.quantity || 0) / 1000) : 0;

        return { remIpQtyTon, piQtyTon };
    }, [formData.ipNo, formData.piNo, ipRecordsRaw, piRecordsRaw, lcRecords, editingId]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            const refs = [ipRef, piRef, bankRef, importerRef, exporterRef, productRef, insuranceRef, statusRef];
            const isClickInside = refs.some(ref => ref.current && ref.current.contains(e.target));
            if (!isClickInside) {
                setActiveDropdown(null);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDropdownSelect = (field, value) => {
        setFormData(prev => {
            const newState = { ...prev, [field]: value };

            // Auto-fill logic when IP Number is selected
            if (field === 'ipNo' && value) {
                const selectedIp = ipRecordsRaw.find(ip => ip.ipNumber === value);
                if (selectedIp) {
                    if (selectedIp.ipParty) newState.importerName = selectedIp.ipParty;
                    if (selectedIp.exporterName) newState.exporterName = selectedIp.exporterName;
                    if (selectedIp.productName) newState.productName = selectedIp.productName;
                }
            }

            // Auto-fill logic when PI Number is selected
            if (field === 'piNo' && value) {
                const selectedPi = piRecordsRaw.find(pi => pi.piNumber === value);
                if (selectedPi) {
                    if (selectedPi.partyName) newState.importerName = selectedPi.partyName;
                    if (selectedPi.exporterName) newState.exporterName = selectedPi.exporterName;
                    if (selectedPi.hsCode) newState.hsCode = selectedPi.hsCode;
                    if (selectedPi.productName) newState.productName = selectedPi.productName;
                    const piPort = selectedPi.port || selectedPi.portOfDischarge || selectedPi.portOfLoading;
                    if (piPort) newState.port = piPort;
                }
            }

            // Auto-fill logic when Insurance Company is selected
            if (field === 'insuranceCo' && value) {
                const selectedIns = insuranceRecordsRaw.find(ins => ins.companyName === value);
                if (selectedIns) {
                    if (selectedIns.policyType) newState.policyType = selectedIns.policyType;
                    if (selectedIns.premiumPercent) newState.premium = selectedIns.premiumPercent;
                    if (selectedIns.premiumReturnPercent) newState.premiumReturn = selectedIns.premiumReturnPercent;
                    if (selectedIns.stampCharge) newState.stampCharge = selectedIns.stampCharge;
                }
            }

            return newState;
        });
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleDropdownKeyDown = (e, dropdownId, field, options = []) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                handleDropdownSelect(field, options[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [lcRes, bankRes, impRes, expRes, insRes, ipRes, piRes, prodRes, stockRes, saleRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/importers`),
                axios.get(`${API_BASE_URL}/api/exporters`),
                axios.get(`${API_BASE_URL}/api/insurance`),
                axios.get(`${API_BASE_URL}/api/ip-records`),
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/products`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);

            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);

            const rawStock = Array.isArray(stockRes.data) ? stockRes.data : [];
            const decryptedStock = rawStock.map(item => {
                try {
                    let d = item.data ? decryptData(item.data) : item;
                    // Robust Guard: If the result is a string or still has an inner 'data' string, decrypt again
                    if (typeof d === 'string') {
                        try { d = decryptData(d); } catch (e) { }
                    } else if (d && d.data && typeof d.data === 'string' && !d.lcNo) {
                        try { d = decryptData(d.data); } catch (e) { }
                    }
                    return d;
                } catch {
                    return item;
                }
            });
            setAllStockRecords(decryptedStock);

            const rawSales = Array.isArray(saleRes.data) ? saleRes.data : [];
            const decryptedSales = rawSales.map(item => {
                try {
                    let d = item.data ? decryptData(item.data) : item;
                    // Robust Guard: If the result is a string or still has an inner 'data' string, decrypt again
                    if (typeof d === 'string') {
                        try { d = decryptData(d); } catch (e) { }
                    } else if (d && d.data && typeof d.data === 'string' && !d.lcNo && !d.saleType) {
                        try { d = decryptData(d.data); } catch (e) { }
                    }
                    return d;
                } catch {
                    return item;
                }
            });
            setAllSalesRecords(decryptedSales);

            // Filter banks to only show those NOT marked as Indian (from PI Module)
            const moduleBanks = Array.isArray(bankRes.data) ? bankRes.data.filter(b => !b.isIndian) : [];
            const uniqueBankNames = Array.from(new Set(moduleBanks.map(b => (b.bankName || '').trim().toUpperCase()))).filter(Boolean);
            setBanks(uniqueBankNames);

            setImporters(Array.isArray(impRes.data) ? impRes.data.map(i => i.name) : []);
            setExporters(Array.isArray(expRes.data) ? expRes.data.map(e => e.name) : []);

            const rawIns = Array.isArray(insRes.data) ? insRes.data : [];
            setInsuranceRecordsRaw(rawIns);
            setInsuranceCos(rawIns.map(i => i.companyName));

            const rawIps = Array.isArray(ipRes.data) ? ipRes.data : [];
            setIpRecordsRaw(rawIps);
            setIpList(rawIps.map(ip => ip.ipNumber));

            const rawPis = Array.isArray(piRes.data) ? piRes.data : [];
            setPiRecordsRaw(rawPis);
            setPiList(rawPis.map(pi => pi.piNumber));

            setProductItems(Array.isArray(prodRes.data) ? prodRes.data.map(p => p.name) : []);
        } catch (error) {
            console.error('Error fetching LC initial data:', error);
            addNotification?.('Failed to load LC records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };

            if (['quantity', 'rate', 'totalDollar', 'dollarRate', 'extraPercent', 'premium', 'premiumReturn', 'totalAmount', 'premiumVat', 'stampCharge'].includes(name)) {
                let latestTotalAmount = parseFloat(prev.totalAmount) || 0;

                if (['quantity', 'rate', 'totalDollar', 'dollarRate'].includes(name)) {
                    const qty = parseFloat(name === 'quantity' ? value : prev.quantity) || 0;
                    const r = parseFloat(name === 'rate' ? value : prev.rate) || 0;
                    const dRate = parseFloat(name === 'dollarRate' ? value : prev.dollarRate) || 0;

                    let tDollar = parseFloat(prev.totalDollar) || 0;
                    if (name === 'quantity' || name === 'rate') {
                        tDollar = qty * r;
                        newState.totalDollar = tDollar > 0 ? tDollar.toFixed(2) : '';
                    } else if (name === 'totalDollar') {
                        tDollar = parseFloat(value) || 0;
                    }

                    const totalVal = tDollar * dRate;
                    latestTotalAmount = totalVal;
                    newState.totalAmount = totalVal > 0 ? totalVal.toFixed(2) : '';
                } else if (name === 'totalAmount') {
                    latestTotalAmount = parseFloat(value) || 0;
                }

                const exPct = parseFloat(name === 'extraPercent' ? value : prev.extraPercent) || 0;
                const prem = parseFloat(name === 'premium' ? value : prev.premium) || 0;
                const premRet = parseFloat(name === 'premiumReturn' ? value : prev.premiumReturn) || 0;
                const pVat = parseFloat(name === 'premiumVat' ? value : prev.premiumVat) || 0;
                const stamp = parseFloat(name === 'stampCharge' ? value : prev.stampCharge) || 0;

                const baseNetPrem = (latestTotalAmount * (prem / 100)) / 100;
                const netPrem = baseNetPrem + (baseNetPrem * (exPct / 100));
                newState.netPremium = netPrem > 0 ? netPrem.toFixed(2) : '';

                const expRet = netPrem * (premRet / 100);
                newState.expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';

                const vatAmount = netPrem * (pVat / 100);
                const gPrem = netPrem + vatAmount + stamp;
                newState.grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
            }

            return newState;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingId) {
                await axios.put(`${API_BASE_URL}/api/lc-management/${editingId}`, formData);
                addNotification?.('LC record updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/lc-management`, formData);
                addNotification?.('New LC record created successfully', 'success');
            }
            resetForm();
            fetchInitialData();
        } catch (error) {
            console.error('Error saving LC record:', error);
            addNotification?.('Failed to save LC record', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (record) => {
        setFormData({
            ipNo: record.ipNo || '',
            lcNo: record.lcNo || '',
            openingDate: record.openingDate || '',
            expiryDate: record.expiryDate || '',
            bankName: record.bankName || '',
            importerName: record.importerName || '',
            exporterName: record.exporterName || '',
            hsCode: record.hsCode || '',
            productName: record.productName || '',
            quantity: record.quantity || '',
            rate: record.rate || '',
            totalDollar: record.totalDollar || '',
            dollarRate: record.dollarRate || '',
            insuranceCo: record.insuranceCo || '',
            policyType: record.policyType || '',
            extraPercent: record.extraPercent || '',
            premium: record.premium || '',
            grossPremium: record.grossPremium || '',
            premiumReturn: record.premiumReturn || '',
            expectedReturnAmount: record.expectedReturnAmount || '',
            netPremium: record.netPremium || '',
            premiumVat: record.premiumVat || '',
            stampCharge: record.stampCharge || '',
            totalAmount: record.totalAmount || '',
            status: record.status || 'Opened',
            piNo: record.piNo || '',
            port: record.port || ''
        });
        setEditingId(record._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this LC record?')) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/lc-management/${id}`);
            addNotification?.('LC record deleted', 'success');
            fetchInitialData();
        } catch (error) {
            console.error('Error deleting LC record:', error);
            addNotification?.('Failed to delete LC record', 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            ipNo: '',
            lcNo: '',
            openingDate: '',
            expiryDate: '',
            bankName: '',
            importerName: '',
            exporterName: '',
            hsCode: '',
            productName: '',
            quantity: '',
            rate: '',
            totalDollar: '',
            dollarRate: '',
            insuranceCo: '',
            policyType: '',
            extraPercent: '',
            premium: '',
            grossPremium: '',
            premiumReturn: '',
            expectedReturnAmount: '',
            netPremium: '',
            premiumVat: '15',
            stampCharge: '',
            totalAmount: '',
            status: 'Opened',
            piNo: '',
            port: ''
        });
        setEditingId(null);
        setShowForm(false);
    };

    const filteredRecords = lcRecords.filter(record =>
        (record.ipNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.lcNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.importerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (record.bankName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Standard Module Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm ? (
                    <>
                        <div className="w-full md:w-1/4 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-gray-800">LC Management</h2>
                        </div>

                        <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                            <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                                <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by IP, LC Number, Importer or Bank..."
                                autoComplete="off"
                                className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showForm && (
                    <div className="w-full md:w-1/4 flex justify-end gap-3 z-50">
                        <button
                            onClick={() => setShowForm(true)}
                            className="w-full md:w-auto px-4 py-2.5 md:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            <span>Register New LC</span>
                        </button>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="lc-form-container relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl text-sm"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl delay-1000"></div>

                    <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                        <h3 className="text-lg md:text-xl font-semibold text-gray-800">
                            {editingId ? 'Edit LC Record' : 'New LC Registration'}
                        </h3>
                        <button
                            onClick={resetForm}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all group active:scale-95"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                                e.preventDefault();
                            }
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10"
                    >
                        <div className="col-span-full mb-2">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">LC Details</h3>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Opening Date"
                                value={formData.openingDate}
                                onChange={(e) => {
                                    const opening = e.target.value;
                                    setFormData(prev => {
                                        const newState = { ...prev, openingDate: opening };
                                        if (opening) {
                                            const date = new Date(opening);
                                            date.setDate(date.getDate() + 180);
                                            newState.expiryDate = date.toISOString().split('T')[0];
                                        }
                                        return newState;
                                    });
                                }}
                                required
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Expiry Date"
                                value={formData.expiryDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                                required
                                compact={true}
                            />
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">LC Number</label>
                            <input
                                type="text"
                                name="lcNo"
                                value={formData.lcNo}
                                onChange={handleInputChange}
                                required
                                placeholder="Enter LC Number"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={ipRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">IP Number</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="ipNo"
                                    value={formData.ipNo}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('ipNo'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'ipNo', 'ipNo', ipList.filter(ip => !formData.ipNo || ip.toLowerCase().includes(formData.ipNo.toLowerCase())))}
                                    placeholder="Select IP Number"
                                    autoComplete="off"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.ipNo && (
                                        <button type="button" onClick={() => handleDropdownSelect('ipNo', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'ipNo' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {ipList.filter(ip => !formData.ipNo || ip.toLowerCase().includes(formData.ipNo.toLowerCase())).map((ip, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('ipNo', ip); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.ipNo === ip ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {ip}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {formData.ipNo && (
                                <div className="mt-1 px-2 py-1 bg-blue-50/50 rounded-lg flex items-center justify-between border border-blue-100/50">
                                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Remaining IP Qty</span>
                                    <span className="text-xs font-black text-blue-700">{informativeQuantities.remIpQtyTon.toLocaleString(undefined, { minimumFractionDigits: 3 })} <span className="text-[10px] font-bold opacity-60">Ton</span></span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={piRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">PI Number</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="piNo"
                                    value={formData.piNo}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('piNo'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'piNo', 'piNo', piList.filter(pi => !formData.piNo || pi.toLowerCase().includes(formData.piNo.toLowerCase())))}
                                    placeholder="Select PI Number"
                                    autoComplete="off"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.piNo && (
                                        <button type="button" onClick={() => handleDropdownSelect('piNo', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'piNo' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {piList.filter(pi => !formData.piNo || pi.toLowerCase().includes(formData.piNo.toLowerCase())).map((pi, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('piNo', pi); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.piNo === pi ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {pi}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {formData.piNo && (
                                <div className="mt-1 px-2 py-1 bg-indigo-50/50 rounded-lg flex items-center justify-between border border-indigo-100/50">
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">PI Quantity</span>
                                    <span className="text-xs font-black text-indigo-700">{informativeQuantities.piQtyTon.toLocaleString(undefined, { minimumFractionDigits: 3 })} <span className="text-[10px] font-bold opacity-60">Ton</span></span>
                                </div>
                            )}
                        </div>


                        <div className="space-y-1.5 text-left relative" ref={bankRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Issuing Bank</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('bankName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'bankName', 'bankName', banks.filter(b => !formData.bankName || b.toLowerCase().includes(formData.bankName.toLowerCase())))}
                                    placeholder="Select Bank"
                                    autoComplete="off"
                                    required
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.bankName && (
                                        <button type="button" onClick={() => handleDropdownSelect('bankName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'bankName' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {banks.filter(b => !formData.bankName || b.toLowerCase().includes(formData.bankName.toLowerCase())).map((bank, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('bankName', bank); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.bankName === bank ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {bank}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Port</label>
                            <input
                                type="text"
                                name="port"
                                value={formData.port}
                                onChange={handleInputChange}
                                placeholder="Enter Port Name"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            />
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={importerRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Importer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="importerName"
                                    value={formData.importerName}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('importerName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'importerName', 'importerName', importers.filter(i => !formData.importerName || i.toLowerCase().includes(formData.importerName.toLowerCase())))}
                                    placeholder="Select Importer"
                                    autoComplete="off"
                                    required
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.importerName && (
                                        <button type="button" onClick={() => handleDropdownSelect('importerName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'importerName' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {importers.filter(i => !formData.importerName || i.toLowerCase().includes(formData.importerName.toLowerCase())).map((imp, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('importerName', imp); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.importerName === imp ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {imp}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={exporterRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Exporter</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="exporterName"
                                    value={formData.exporterName}
                                    onChange={handleInputChange}
                                    onFocus={() => { setActiveDropdown('exporterName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'exporterName', 'exporterName', exporters.filter(exp => !formData.exporterName || exp.toLowerCase().includes(formData.exporterName.toLowerCase())))}
                                    placeholder="Select Exporter"
                                    autoComplete="off"
                                    required
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.exporterName && (
                                        <button type="button" onClick={() => handleDropdownSelect('exporterName', '')} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'exporterName' && (
                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {exporters.filter(exp => !formData.exporterName || exp.toLowerCase().includes(formData.exporterName.toLowerCase())).map((exp, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('exporterName', exp); }}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.exporterName === exp ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                        >
                                            {exp}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Total LC Value</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                <input
                                    type="number"
                                    name="totalAmount"
                                    value={formData.totalAmount}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={statusRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Status</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl text-left focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium flex items-center justify-between"
                                >
                                    <span className={formData.status ? 'text-gray-900' : 'text-gray-400'}>{formData.status}</span>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${activeDropdown === 'status' ? 'rotate-180' : ''}`} />
                                </button>
                                {activeDropdown === 'status' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1">
                                        {['Opened', 'In-Transit', 'Received', 'Closed', 'Cancelled'].map((s, idx) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => handleDropdownSelect('status', s)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.status === s ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-full mb-2 mt-4">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Product Details</h3>
                            </div>
                        </div>

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">H.S Code</label>
                                <input
                                    type="text"
                                    name="hsCode"
                                    value={formData.hsCode}
                                    onChange={handleInputChange}
                                    placeholder="Enter H.S Code"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5 text-left relative" ref={productRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1">Product</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="productName"
                                        value={formData.productName}
                                        onChange={handleInputChange}
                                        onFocus={() => { setActiveDropdown('productName'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'productName', 'productName', productItems.filter(p => !formData.productName || p.toLowerCase().includes(formData.productName.toLowerCase())))}
                                        placeholder="Select Product"
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.productName && (
                                            <button type="button" onClick={() => handleDropdownSelect('productName', '')} className="text-gray-400 hover:text-gray-600">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                                {activeDropdown === 'productName' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {productItems.filter(p => !formData.productName || p.toLowerCase().includes(formData.productName.toLowerCase())).map((p, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('productName', p); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.productName === p ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Quantity</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleInputChange}
                                    placeholder="0"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Rate</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                    <input
                                        type="number"
                                        name="rate"
                                        value={formData.rate}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Total Dollar</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                    <input
                                        type="number"
                                        name="totalDollar"
                                        value={formData.totalDollar}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Dollar Rate (BDT)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="dollarRate"
                                        value={formData.dollarRate}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-span-full mb-2 mt-4">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Insurance Details</h3>
                            </div>
                        </div>

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[2fr_0.8fr_0.8fr_0.8fr_1.5fr_2.2fr_0.8fr_1.5fr_1.5fr] gap-2">
                            <div className="space-y-1.5 text-left relative md:col-span-2 lg:col-span-1" ref={insuranceRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1">Insurance Company</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="insuranceCo"
                                        value={formData.insuranceCo}
                                        onChange={handleInputChange}
                                        onFocus={() => { setActiveDropdown('insuranceCo'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'insuranceCo', 'insuranceCo', insuranceCos.filter(ins => !formData.insuranceCo || ins.toLowerCase().includes(formData.insuranceCo.toLowerCase())))}
                                        placeholder="Select Insurance"
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.insuranceCo && (
                                            <button type="button" onClick={() => handleDropdownSelect('insuranceCo', '')} className="text-gray-400 hover:text-gray-600">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                                {activeDropdown === 'insuranceCo' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                        {insuranceCos.filter(ins => !formData.insuranceCo || ins.toLowerCase().includes(formData.insuranceCo.toLowerCase())).map((ins, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('insuranceCo', ins); }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.insuranceCo === ins ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {ins}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">
                                    {formData.policyType ? `${formData.policyType.replace(/insurance/i, '').trim()} Premium` : 'Premium'}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="premium"
                                        value={formData.premium}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Premium Return</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="premiumReturn"
                                        value={formData.premiumReturn}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Extra Percent</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="extraPercent"
                                        value={formData.extraPercent}
                                        onChange={handleInputChange}
                                        placeholder="0"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Net Premium</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="netPremium"
                                        value={formData.netPremium}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Premium VAT</label>
                                <div className="grid grid-cols-[1.5fr_1fr] gap-1">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                        <input
                                            type="text"
                                            readOnly
                                            value={(parseFloat(formData.netPremium || 0) * (parseFloat(formData.premiumVat || 0) / 100)).toFixed(2)}
                                            className="w-full px-4 py-2.5 pl-8 bg-gray-50/50 border border-gray-200/60 rounded-xl outline-none font-medium text-gray-500 cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="premiumVat"
                                            value={formData.premiumVat}
                                            onChange={handleInputChange}
                                            placeholder="15"
                                            className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Stamp Charge</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="stampCharge"
                                        value={formData.stampCharge}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Gross Premium</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="grossPremium"
                                        value={formData.grossPremium}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Return Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="expectedReturnAmount"
                                        value={formData.expectedReturnAmount}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 lg:col-span-3 flex justify-end mt-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full md:w-auto px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                            >
                                {isSaving ? 'Saving...' : editingId ? 'Update LC Record' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="overflow-x-auto bg-white/50 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Expire Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">LC No</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Importer</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Exporter</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Bank</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Port</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Product</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Quantity (Kg)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Rate (/Kg)</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Total LC Value</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Rem. Qty</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-nowrap">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="12" className="px-6 py-12 text-center text-sm text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-medium text-gray-400">Loading records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecords.length > 0 ? (
                                filteredRecords.map((record) => {
                                    // Helper for sanitized numeric parsing
                                    const parseNum = (val) => {
                                        if (val === null || val === undefined) return 0;
                                        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
                                    };

                                    // Failsafe LC Matching: Compare only the numeric digits
                                    const cleanLc = (val) => String(val || '').replace(/\D/g, '');

                                    // Dynamic fallback for Port if empty in LC record
                                    const linkedPi = record.piNo ? piRecordsRaw.find(p => p.piNumber === record.piNo) : null;
                                    const displayPort = record.port || (linkedPi && (linkedPi.port || linkedPi.portOfDischarge || linkedPi.portOfLoading)) || '-';

                                    // Unit conversion for display (Data is in Tons, Table shows Kg)
                                    const qtyKg = parseNum(record.quantity) * 1000;
                                    const rateKg = parseNum(record.rate) / 1000;

                                    // Calculate Remaining Quantities
                                    // Received: From allStockRecords where lcNo matches and status is NOT requested/rejected
                                    const lcNoClean = cleanLc(record.lcNo);

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

                                    // Border Sale: From allSalesRecords where lcNo matches and is a Border Sale
                                    const borderSaleQtyKg = allSalesRecords
                                        .filter(s => {
                                            const recordLcNoClean = cleanLc(s.lcNo);

                                            // Adopt robust Border Sale detection
                                            const sTypeLow = (s.saleType || '').toLowerCase().trim();
                                            // Permissive: Catch by BS prefix OR explicit sale type OR presence of matching LC + port details
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

                                    const combinedRemKg = qtyKg - (receivedQtyKg + borderSaleQtyKg);

                                    return (
                                        <tr key={record._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(record.openingDate)}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{formatDate(record.expiryDate)}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">{record.lcNo}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-700">{record.importerName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{record.exporterName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{record.bankName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{displayPort}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{record.productName || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-600 whitespace-nowrap">
                                                <span className="font-bold text-gray-900">{qtyKg.toLocaleString()}</span> <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-600 whitespace-nowrap">
                                                <span className="font-medium text-gray-900">${rateKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span> <span className="text-[10px] text-gray-400 font-normal">/Kg</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right font-black text-gray-900 whitespace-nowrap">৳{parseFloat(record.totalAmount || 0).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                                                <span className={`font-black ${combinedRemKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                    {combinedRemKg.toLocaleString()} <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Kg</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button
                                                        onClick={() => setViewData(record)}
                                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(record)}
                                                        className="text-gray-400 hover:text-blue-600 transition-colors"
                                                        title="Edit Record"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(record._id)}
                                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                                        title="Delete Record"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="12" className="px-6 py-12 text-center text-gray-400 font-medium whitespace-nowrap italic">
                                        No LC records found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {viewData && (
                <ViewDetailsModal 
                    data={viewData} 
                    onClose={() => setViewData(null)} 
                    allStockRecords={allStockRecords}
                    allSalesRecords={allSalesRecords}
                />
            )}
        </div>
    );
};

export default LCManagement;
