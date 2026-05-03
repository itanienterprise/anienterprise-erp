import React, { useState, useEffect, useRef } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, SearchIcon, PlusIcon, EyeIcon, PDFIcon
} from '../../Icons';
import { generatePIPDF } from '../../../utils/pipdfgenerator';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './PI.css';

function PI({
    importers,
    exporters,
    ports,
    products = [],
    fetchPorts,
    onDeleteConfirm,
    addNotification,
    currentUser
}) {
    const DEFAULT_DESC_GOODS = "Insurance to be covered by the opener.\nPartial Bill & Partial Payment be allowed.\nNegotiation any Bank in India.\nThe Importer or Bank will not hold the bill in any circumstances.\nAll Foreign Bank Charges outside India are on account of Importer.\nWeight and measurement are final which is taken by weighing bridge in India.\n\nTRANSHIPMENT: ALLOWED\nPARTIAL SHIPMENT: ALLOWED";

    // Authorization check for administrative actions
    const canManage = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());

    const [showForm, setShowForm] = useState(false);
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [banks, setBanks] = useState([]);
    const [ipRecords, setIpRecords] = useState([]);
    const [preCarriages, setPreCarriages] = useState([]);
    const [receiptPlaces, setReceiptPlaces] = useState([]);
    const [vessels, setVessels] = useState([]);
    const [countries, setCountries] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [toast, setToast] = useState(null);
    const [expandedCardId, setExpandedCardId] = useState(null);
    const toastTimerRef = useRef(null);

    const showToast = (message, type = 'success', duration = 3000) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), duration);
    };

    const [formData, setFormData] = useState({
        date: '',
        validityDate: '',
        piNumber: '',
        partyName: '',
        partyAddress: '',
        partyContact: '',
        exporterName: '',
        exporterAddress: '',
        exporterContact: '',
        exporterEmail: '',
        productName: '',
        quantity: '',
        rate: '',
        amount: '',
        freight: '',
        totalFreight: '',
        grandTotal: '',
        port: '',
        placeOfReceipt: '',
        portOfLoading: '',
        portOfDischarge: '',
        indianBank: '',
        buyerOrderNo: '',
        buyerOrderDate: '',
        otherReferences: '',
        buyerName: '',
        preCarriageBy: 'ROAD',
        placeOfReceiptByPreCarrier: '',
        vesselFlightNo: 'BY TRUCK',
        countryOrigin: 'INDIA',
        countryFinalDest: 'BANGLADESH',
        finalDestination: 'BANGLADESH',
        hsCode: '',
        ipNumber: '',
        ipQuantity: '',
        ipDate: '',
        marksNo: '',
        noKindPackage: '',
        descriptionGoods: DEFAULT_DESC_GOODS,
        termsDeliveryPayment: 'CPT BHOMRA, BANGLADESH, BY ROAD, BY TRUCK AGAINST 100% Irrevocable at Sight Letter of Credit valid for 90 days & Negotiable within 21 days of Shipment.\nPacking: Export Standard P.P/Gunny Bags.',
        declaration: '1. Deliveries age quoted in good faith, however we shall not be responsible for delays due to reasons beyond our control.\n2. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
        status: 'Active'
    });

    const ipNumberRef = useRef(null);
    const partyRef = useRef(null);
    const exporterRef = useRef(null);
    const productRef = useRef(null);
    const bankRef = useRef(null);
    const portLoadingRef = useRef(null);
    const portDischargeRef = useRef(null);
    const preCarriageRef = useRef(null);
    const receiptPlaceRef = useRef(null);
    const vesselRef = useRef(null);
    const countryOriginRef = useRef(null);
    const countryFinalDestRef = useRef(null);
    const statusRef = useRef(null);

    useEffect(() => {
        fetchRecords();
        fetchMetaData('preCarriage', setPreCarriages);
        fetchMetaData('receiptPlace', setReceiptPlaces);
        fetchMetaData('vessel', setVessels);
        fetchMetaData('country', setCountries);
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

    const fetchMetaData = async (category, setter) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/metadata?category=${category}`);
            setter(response.data);
        } catch (error) {
            console.error(`Error fetching meta ${category}:`, error);
        }
    };

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const [piRes, bankRes, ipRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/ip-records`)
            ]);
            setRecords(Array.isArray(piRes.data) ? piRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
            setIpRecords(Array.isArray(ipRes.data) ? ipRes.data : []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'quantity' || name === 'rate' || name === 'freight') {
                const q = parseFloat(updated.quantity) || 0;
                const r = parseFloat(updated.rate) || 0;
                const f = parseFloat(updated.freight) || 0;

                const amt = q * r;
                const totalFreight = q * f;
                const grandT = amt + totalFreight;

                updated.amount = amt > 0 ? amt.toFixed(2) : '';
                updated.totalFreight = totalFreight > 0 ? totalFreight.toFixed(2) : '';
                updated.grandTotal = grandT > 0 ? grandT.toFixed(2) : '';
            }

            if (name === 'date' && value) {
                const selectedDate = new Date(value);
                if (!isNaN(selectedDate.getTime())) {
                    selectedDate.setDate(selectedDate.getDate() + 90);
                    updated.validityDate = selectedDate.toISOString().split('T')[0];
                }
            }

            if (name === 'countryFinalDest') {
                updated.finalDestination = value;
            }

            return updated;
        });
    };

    const handleAddQuickPort = async (name) => {
        if (!name) return;
        try {
            await axios.post(`${API_BASE_URL}/api/ports`, { name, isLoadingPort: true });
            if (typeof fetchPorts === 'function') {
                await fetchPorts();
            }
        } catch (error) {
            console.error('Error adding quick port:', error);
            showToast('Failed to add port', 'error');
        }
    };

    const handleAddQuickBank = async (name) => {
        if (!name) return;
        try {
            await axios.post(`${API_BASE_URL}/api/banks`, { bankName: name, isIndian: true });
            await fetchRecords();
        } catch (error) {
            console.error('Error adding quick bank:', error);
            showToast('Failed to add bank', 'error');
        }
    };

    const handleAddQuickMetaData = async (category, value) => {
        if (!value) return;
        try {
            await axios.post(`${API_BASE_URL}/api/metadata`, { category, value });
            if (category === 'preCarriage') fetchMetaData(category, setPreCarriages);
            else if (category === 'receiptPlace') fetchMetaData(category, setReceiptPlaces);
            else if (category === 'vessel') fetchMetaData(category, setVessels);
            else if (category === 'country') fetchMetaData(category, setCountries);
        } catch (error) {
            console.error(`Error adding quick ${category}:`, error);
        }
    };

    const handleDeleteQuickMetaData = async (category, id) => {
        if (!window.confirm("Are you sure you want to delete this option?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/metadata/${id}`);
            if (category === 'preCarriage') fetchMetaData(category, setPreCarriages);
            else if (category === 'receiptPlace') fetchMetaData(category, setReceiptPlaces);
            else if (category === 'vessel') fetchMetaData(category, setVessels);
            else if (category === 'country') fetchMetaData(category, setCountries);
        } catch (error) {
            console.error(`Error deleting quick ${category}:`, error);
            showToast('Failed to delete option', 'error');
        }
    };

    const handleDeleteQuickBank = async (id) => {
        if (!window.confirm("Are you sure you want to delete this bank?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/banks/${id}`);
            await fetchRecords();
        } catch (error) {
            console.error('Error deleting quick bank:', error);
            showToast('Failed to delete bank', 'error');
        }
    };

    const handleDeleteQuickPort = async (id) => {
        if (!window.confirm("Are you sure you want to delete this port?")) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/ports/${id}`);
            if (typeof fetchPorts === 'function') {
                await fetchPorts();
            }
        } catch (error) {
            console.error('Error deleting quick port:', error);
            showToast('Failed to delete port', 'error');
        }
    };

    const handleDropdownSelect = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'ipNumber') {
                const ip = ipRecords.find(i => i.ipNumber === value);
                if (ip) {
                    updated.ipQuantity = ip.quantity || '';
                    updated.ipDate = ip.closeDate || '';
                    updated.productName = ip.productName || '';
                    updated.partyName = ip.ipParty || '';

                    // Auto-fill Importer details
                    const importer = importers.find(i => i.name === ip.ipParty);
                    if (importer) {
                        updated.partyAddress = importer.address || '';
                        updated.partyContact = importer.phone || '';
                    }

                    // Also try to find HS Code from the product list if product name matches
                    const product = products.find(p => p.name === ip.productName);
                    if (product) {
                        updated.hsCode = product.hsCode || '';
                    }
                }
            }

            if (field === 'exporterName') {
                const exporter = exporters.find(e => e.name === value);
                if (exporter) {
                    updated.exporterAddress = exporter.address || '';
                    updated.exporterContact = exporter.phone || '';
                    updated.exporterEmail = exporter.email || '';
                }
            }

            if (field === 'partyName') {
                const importer = importers.find(i => i.name === value);
                if (importer) {
                    updated.partyAddress = importer.address || '';
                    updated.partyContact = importer.phone || '';
                }
            }

            if (field === 'productName') {
                const product = products.find(p => p.name === value);
                if (product) {
                    updated.hsCode = product.hsCode || '';
                }
            }

            return updated;
        });
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
                handleDropdownSelect(field || dropdownId, value);
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check for duplicate PI Number
        const isDuplicate = records.some(r =>
            r.piNumber &&
            r.piNumber.trim().toLowerCase() === (formData.piNumber || '').trim().toLowerCase() &&
            r._id !== editingId
        );

        if (isDuplicate) {
            showToast("Duplicate PI Number detected! Each PI must have a unique number.", "error");
            setIsSubmitting(false);
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/pi/${editingId}`
                : `${API_BASE_URL}/api/pi`;

            if (editingId) {
                await axios.put(url, formData);

                // Add persistent notification for PI Update
                if (addNotification) {
                    addNotification(
                        'PI Record Updated',
                        `PI No: ${formData.piNumber} has been updated by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }
            } else {
                await axios.post(url, formData);

                // Add persistent notification for management roles
                if (addNotification) {
                    addNotification(
                        'New PI Created',
                        `A new Proforma Invoice (PI No: ${formData.piNumber}) has been created for ${formData.partyName || 'N/A'} by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }
            }
            setSubmitStatus('success');
            showToast(editingId ? 'PI updated successfully!' : 'PI created successfully!', 'success');
            setTimeout(() => {
                setShowForm(false);
                resetForm();
                fetchRecords();
            }, 1500);
        } catch (error) {
            console.error('Error saving PI record:', error);
            setSubmitStatus('error');
            const errorMsg = error.response?.data?.message || 'Error saving PI record';
            showToast(errorMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            date: '',
            validityDate: '',
            piNumber: '',
            partyName: '',
            partyAddress: '',
            partyContact: '',
            exporterName: '',
            exporterAddress: '',
            exporterContact: '',
            exporterEmail: '',
            productName: '',
            quantity: '',
            rate: '',
            amount: '',
            freight: '',
            totalFreight: '',
            grandTotal: '',
            port: '',
            placeOfReceipt: '',
            portOfLoading: '',
            portOfDischarge: '',
            indianBank: '',
            buyerOrderNo: '',
            buyerOrderDate: '',
            otherReferences: '',
            buyerName: '',
            preCarriageBy: 'ROAD',
            placeOfReceiptByPreCarrier: '',
            vesselFlightNo: 'BY TRUCK',
            countryOrigin: 'INDIA',
            countryFinalDest: 'BANGLADESH',
            finalDestination: 'BANGLADESH',
            hsCode: '0806.10.90',
            ipNumber: '',
            ipQuantity: '',
            ipDate: '',
            marksNo: '',
            noKindPackage: '',
            descriptionGoods: DEFAULT_DESC_GOODS,
            termsDeliveryPayment: 'CPT BHOMRA, BANGLADESH, BY ROAD, BY TRUCK AGAINST 100% Confirm Irrevocable at Sight Letter of Credit valid for 90 days & Negotiable within 21 days of Shipment.\nPacking: Export Standard P.P/Gunny Bags.',
            declaration: '1. Deliveries age quoted in good faith, however we shall not be responsible for delays due to reasons beyond our control.\n2. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
            status: 'Active'
        });
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleEdit = (record) => {
        setFormData({
            date: record.date || '',
            validityDate: record.validityDate || '',
            piNumber: record.piNumber || '',
            partyName: record.partyName || '',
            partyAddress: record.partyAddress || '',
            partyContact: record.partyContact || '',
            exporterName: record.exporterName || '',
            exporterAddress: record.exporterAddress || '',
            exporterContact: record.exporterContact || '',
            exporterEmail: record.exporterEmail || '',
            productName: record.productName || '',
            quantity: record.quantity || '',
            rate: record.rate || '',
            amount: record.amount || '',
            freight: record.freight || '',
            totalFreight: record.totalFreight || '',
            grandTotal: record.grandTotal || '',
            port: record.port || '',
            placeOfReceipt: record.placeOfReceipt || '',
            portOfLoading: record.portOfLoading || '',
            portOfDischarge: record.portOfDischarge || '',
            indianBank: record.indianBank || '',
            buyerOrderNo: record.buyerOrderNo || '',
            buyerOrderDate: record.buyerOrderDate || '',
            otherReferences: record.otherReferences || '',
            buyerName: record.buyerName || '',
            preCarriageBy: record.preCarriageBy || 'ROAD',
            placeOfReceiptByPreCarrier: record.placeOfReceiptByPreCarrier || '',
            vesselFlightNo: record.vesselFlightNo || 'BY TRUCK',
            countryOrigin: record.countryOrigin || 'INDIA',
            countryFinalDest: record.countryFinalDest || 'BANGLADESH',
            finalDestination: record.finalDestination || 'BANGLADESH',
            hsCode: record.hsCode || '0806.10.90',
            ipNumber: record.ipNumber || '',
            ipQuantity: record.ipQuantity || '',
            ipDate: record.ipDate || '',
            marksNo: record.marksNo || '',
            noKindPackage: record.noKindPackage || '',
            descriptionGoods: record.descriptionGoods || '',
            termsDeliveryPayment: record.termsDeliveryPayment || 'CPT BHOMRA, BANGLADESH, BY ROAD, BY TRUCK AGAINST 100% Confirm Irrevocable at Sight Letter of Credit valid for 90 days & Negotiable within 21 days of Shipment.\nPacking: Export Standard P.P/Gunny Bags.',
            declaration: record.declaration || '1. Deliveries age quoted in good faith, however we shall not be responsible for delays due to reasons beyond our control.\n2. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
            status: record.status || 'Active'
        });
        setEditingId(record._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (onDeleteConfirm) {
            // Reusing existing generalized delete modal if possible, otherwise trigger native confirm or basic logic
            onDeleteConfirm({ show: true, type: 'pi', id, isBulk: false });
        } else {
            if (window.confirm("Are you sure you want to delete this PI record?")) {
                axios.delete(`${API_BASE_URL}/api/pi/${id}`).then(() => fetchRecords());
            }
        }
    };

    const filteredRecords = records.filter(record => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (record.piNumber || '').toLowerCase().includes(query) ||
                (record.partyName || '').toLowerCase().includes(query) ||
                (record.productName || '').toLowerCase().includes(query);
        }
        return true;
    });

    return (
        <div className="pi-management space-y-6">
            {!showForm && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-1/4 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-gray-800" style={{ margin: 0 }}>Proforma Invoice (PI)</h2>
                    </div>

                    <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                        <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search PI No, Importer, or Product..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm focus:bg-white"
                        />
                    </div>

                    <div className="w-full md:w-1/4 flex justify-end z-10 gap-2 sm:gap-3">
                        {canManage && (
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap"
                            >
                                <span className="mr-1.5 font-bold text-lg leading-none">+</span> Add New
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showForm && (
                <div className="pi-form relative rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit PI Record' : 'New PI Creation'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10"
                    >
                        {/* --- IP Section --- */}
                        <div className="space-y-2 relative dropdown-container" ref={ipNumberRef}>
                            <label className="text-sm font-medium text-gray-700">IP Number</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="ipNumber"
                                    value={formData.ipNumber}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('ipNumber'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('ipNumber'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'ipNumber', ipRecords.filter(ip => !formData.ipNumber || ip.ipNumber.toLowerCase().includes(formData.ipNumber.toLowerCase())), 'ipNumber')}
                                    placeholder="Search IP Number..."
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                {activeDropdown === 'ipNumber' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ipRecords.filter(ip => !formData.ipNumber || ip.ipNumber.toLowerCase().includes(formData.ipNumber.toLowerCase())).map((ip, idx) => (
                                            <button
                                                key={ip._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('ipNumber', ip.ipNumber)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.ipNumber === ip.ipNumber ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{ip.ipNumber}</span>
                                                    <span className="text-[10px] text-gray-500">{ip.ipParty} • {ip.productName}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">IP Quantity</label>
                            <input
                                type="text"
                                name="ipQuantity"
                                value={formData.ipQuantity}
                                readOnly
                                placeholder="Auto-filled"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200/60 rounded-lg outline-none transition-all cursor-not-allowed"
                            />
                        </div>

                        <CustomDatePicker
                            label="IP Closing Date"
                            name="ipDate"
                            value={formData.ipDate}
                            onChange={() => { }} // Read-only
                            compact={true}
                            readOnly={true}
                        />

                        {/* --- PI Info --- */}
                        <CustomDatePicker
                            label="Date"
                            name="date"
                            value={formData.date}
                            onChange={handleInputChange}
                            required
                            compact={true}
                        />

                        <CustomDatePicker
                            label="Validity Date"
                            name="validityDate"
                            value={formData.validityDate}
                            onChange={handleInputChange}
                            required
                            compact={true}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">PI Number</label>
                            <input
                                type="text"
                                name="piNumber"
                                value={formData.piNumber}
                                onChange={handleInputChange}
                                required
                                autoComplete="off"
                                placeholder="Enter PI Number"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* --- Exporter Section --- */}
                        <div className="space-y-2 relative dropdown-container" ref={exporterRef}>
                            <label className="text-sm font-medium text-gray-700">Exporter</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="exporterName"
                                    value={formData.exporterName}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('exporter'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('exporter'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'exporter', exporters.filter(exp => !formData.exporterName || exp.name.toLowerCase().includes(formData.exporterName.toLowerCase())), 'exporterName')}
                                    placeholder="Search Exporter..."
                                    required
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'exporter' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {exporters.filter(exp => !formData.exporterName || exp.name.toLowerCase().includes(formData.exporterName.toLowerCase())).map((exp, idx) => (
                                            <button
                                                key={exp._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('exporterName', exp.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.exporterName === exp.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {exp.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Exporter Address</label>
                            <input
                                type="text"
                                name="exporterAddress"
                                value={formData.exporterAddress}
                                onChange={handleInputChange}
                                placeholder="Address"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Exporter Contact</label>
                            <input
                                type="text"
                                name="exporterContact"
                                value={formData.exporterContact}
                                onChange={handleInputChange}
                                placeholder="Phone / Email"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* --- Importer Section --- */}
                        <div className="space-y-2 relative dropdown-container" ref={partyRef}>
                            <label className="text-sm font-medium text-gray-700">Importer</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="partyName"
                                    value={formData.partyName}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('party'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('party'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'party', importers.filter(imp => !formData.partyName || imp.name.toLowerCase().includes(formData.partyName.toLowerCase())), 'partyName')}
                                    placeholder="Search Importer..."
                                    required
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'party' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {importers.filter(imp => !formData.partyName || imp.name.toLowerCase().includes(formData.partyName.toLowerCase())).map((imp, idx) => (
                                            <button
                                                key={imp._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('partyName', imp.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.partyName === imp.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {imp.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Party Address</label>
                            <input
                                type="text"
                                name="partyAddress"
                                value={formData.partyAddress}
                                onChange={handleInputChange}
                                placeholder="Address"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Party Contact</label>
                            <input
                                type="text"
                                name="partyContact"
                                value={formData.partyContact}
                                onChange={handleInputChange}
                                placeholder="Contact Details"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* --- Shipping Info --- */}
                        <div className="space-y-2 relative dropdown-container" ref={preCarriageRef}>
                            <label className="text-sm font-medium text-gray-700">Pre-Carriage By</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="preCarriageBy"
                                    value={formData.preCarriageBy}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('preCarriage'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('preCarriage'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'preCarriage', preCarriages.filter(v => !formData.preCarriageBy || v.value.toLowerCase().includes(formData.preCarriageBy.toLowerCase())), 'preCarriageBy')}
                                    placeholder="e.g. ROAD"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickMetaData('preCarriage', formData.preCarriageBy)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new pre-carriage mode"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'preCarriage' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {preCarriages.filter(v => !formData.preCarriageBy || v.value.toLowerCase().includes(formData.preCarriageBy.toLowerCase())).map((v, idx) => (
                                            <div key={v._id} className="flex items-center group">
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('preCarriageBy', v.value)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.preCarriageBy === v.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {v.value}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('preCarriage', v._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this option"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={receiptPlaceRef}>
                            <label className="text-sm font-medium text-gray-700">Place of Receipt (Pre-Carrier)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="placeOfReceipt"
                                    value={formData.placeOfReceipt}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('receiptPlace'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('receiptPlace'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'receiptPlace', receiptPlaces.filter(v => !formData.placeOfReceipt || v.value.toLowerCase().includes(formData.placeOfReceipt.toLowerCase())), 'placeOfReceipt')}
                                    placeholder="e.g. GHOJADANGA"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickMetaData('receiptPlace', formData.placeOfReceipt)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new place of receipt"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'receiptPlace' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {receiptPlaces.filter(v => !formData.placeOfReceipt || v.value.toLowerCase().includes(formData.placeOfReceipt.toLowerCase())).map((v, idx) => (
                                            <div key={v._id} className="flex items-center group">
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('placeOfReceipt', v.value)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.placeOfReceipt === v.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {v.value}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('receiptPlace', v._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this option"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={vesselRef}>
                            <label className="text-sm font-medium text-gray-700">Vessel / Flight No</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="vesselFlightNo"
                                    value={formData.vesselFlightNo}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('vessel'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('vessel'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'vessel', vessels.filter(v => !formData.vesselFlightNo || v.value.toLowerCase().includes(formData.vesselFlightNo.toLowerCase())), 'vesselFlightNo')}
                                    placeholder="e.g. BY TRUCK"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickMetaData('vessel', formData.vesselFlightNo)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new vessel/flight"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'vessel' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {vessels.filter(v => !formData.vesselFlightNo || v.value.toLowerCase().includes(formData.vesselFlightNo.toLowerCase())).map((v, idx) => (
                                            <div key={v._id} className="flex items-center group">
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('vesselFlightNo', v.value)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.vesselFlightNo === v.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {v.value}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('vessel', v._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this option"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={portLoadingRef}>
                            <label className="text-sm font-medium text-gray-700">Port of Loading</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="portOfLoading"
                                    value={formData.portOfLoading}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('portLoading'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('portLoading'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'portLoading', ports.filter(p => p.isLoadingPort && (!formData.portOfLoading || p.name.toLowerCase().includes(formData.portOfLoading.toLowerCase()))), 'portOfLoading')}
                                    placeholder="Search Port of Loading..."
                                    required
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickPort(formData.portOfLoading)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new loading port"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'portLoading' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ports.filter(p => p.isLoadingPort && (!formData.portOfLoading || p.name.toLowerCase().includes(formData.portOfLoading.toLowerCase()))).map((p, idx) => (
                                            <div key={p._id} className="flex items-center group">
                                                <button
                                                    key={p._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('portOfLoading', p.name)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.portOfLoading === p.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {p.name}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickPort(p._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this port"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={portDischargeRef}>
                            <label className="text-sm font-medium text-gray-700">Port of Discharge</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="portOfDischarge"
                                    value={formData.portOfDischarge}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('portDischarge'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('portDischarge'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'portDischarge', ports.filter(p => !p.isLoadingPort && (!formData.portOfDischarge || p.name.toLowerCase().includes(formData.portOfDischarge.toLowerCase()))), 'portOfDischarge')}
                                    placeholder="Search Port of Discharge..."
                                    required
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'portDischarge' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ports.filter(p => !p.isLoadingPort && (!formData.portOfDischarge || p.name.toLowerCase().includes(formData.portOfDischarge.toLowerCase()))).map((p, idx) => (
                                            <button
                                                key={p._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('portOfDischarge', p.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.portOfDischarge === p.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Port (Final Port)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="port"
                                    value={formData.port}
                                    onChange={handleInputChange}
                                    placeholder="e.g. BHOMRA, BANGLADESH"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={countryOriginRef}>
                            <label className="text-sm font-medium text-gray-700">Country of Origin</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="countryOrigin"
                                    value={formData.countryOrigin}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('countryOrigin'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('countryOrigin'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'country', countries.filter(v => !formData.countryOrigin || v.value.toLowerCase().includes(formData.countryOrigin.toLowerCase())), 'countryOrigin')}
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickMetaData('country', formData.countryOrigin)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new country"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'countryOrigin' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {countries.filter(v => !formData.countryOrigin || v.value.toLowerCase().includes(formData.countryOrigin.toLowerCase())).map((v, idx) => (
                                            <div key={v._id} className="flex items-center group">
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('countryOrigin', v.value)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.countryOrigin === v.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {v.value}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('country', v._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this country"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={countryFinalDestRef}>
                            <label className="text-sm font-medium text-gray-700">Country of Final Destination</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="countryFinalDest"
                                    value={formData.countryFinalDest}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('countryFinalDest'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('countryFinalDest'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'country', countries.filter(v => !formData.countryFinalDest || v.value.toLowerCase().includes(formData.countryFinalDest.toLowerCase())), 'countryFinalDest')}
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickMetaData('country', formData.countryFinalDest)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new country"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'countryFinalDest' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {countries.filter(v => !formData.countryFinalDest || v.value.toLowerCase().includes(formData.countryFinalDest.toLowerCase())).map((v, idx) => (
                                            <div key={v._id} className="flex items-center group">
                                                <button
                                                    key={v._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('countryFinalDest', v.value)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.countryFinalDest === v.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {v.value}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('country', v._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this country"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={bankRef}>
                            <label className="text-sm font-medium text-gray-700">Advising Bank (Indian Bank)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="indianBank"
                                    value={formData.indianBank}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('bank'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('bank'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'bank', banks.filter(bank => bank.isIndian && (!formData.indianBank || bank.bankName.toLowerCase().includes(formData.indianBank.toLowerCase()))), 'indianBank')}
                                    placeholder="Search Indian Bank..."
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickBank(formData.indianBank)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new bank"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'bank' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {banks.filter(bank => bank.isIndian && (!formData.indianBank || bank.bankName.toLowerCase().includes(formData.indianBank.toLowerCase()))).map((bank, idx) => (
                                            <div key={bank._id} className="flex items-center group">
                                                <button
                                                    key={bank._id}
                                                    type="button"
                                                    onMouseDown={() => handleDropdownSelect('indianBank', bank.bankName)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`flex-1 px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.indianBank === bank.bankName ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {bank.bankName}
                                                </button>
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickBank(bank._id); }}
                                                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this bank"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- Reference Info --- */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Buyer Order No & Date</label>
                            <input
                                type="text"
                                name="buyerOrderNo"
                                value={formData.buyerOrderNo}
                                onChange={handleInputChange}
                                placeholder="Order details"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Other References</label>
                            <input
                                type="text"
                                name="otherReferences"
                                value={formData.otherReferences}
                                onChange={handleInputChange}
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Buyer (if other than Consignee)</label>
                            <input
                                type="text"
                                name="buyerName"
                                value={formData.buyerName}
                                onChange={handleInputChange}
                                placeholder="Optional"
                                autoComplete="off"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* --- Item Details --- */}
                        <div className="space-y-2 relative dropdown-container" ref={productRef}>
                            <label className="text-sm font-medium text-gray-700">Product Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="productName"
                                    value={formData.productName}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('product'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('product'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'product', products.filter(p => !formData.productName || p.name.toLowerCase().includes(formData.productName.toLowerCase())), 'productName')}
                                    placeholder="Search Product..."
                                    required
                                    autoComplete="off"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'product' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {products.filter(p => !formData.productName || p.name.toLowerCase().includes(formData.productName.toLowerCase())).map((p, idx) => (
                                            <button
                                                key={p._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('productName', p.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.productName === p.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">HS Code</label>
                            <input
                                type="text"
                                name="hsCode"
                                value={formData.hsCode}
                                onChange={handleInputChange}
                                maxLength="10"
                                placeholder="10-digit HS Code"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Quantity (KG)</label>
                            <input
                                type="number"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleInputChange}
                                required
                                placeholder="0.00"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Rate Per KG (US $)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="rate"
                                    value={formData.rate}
                                    onChange={handleInputChange}
                                    required
                                    step="0.001"
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Freight Per KG (US $)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="freight"
                                    value={formData.freight}
                                    onChange={handleInputChange}
                                    step="0.001"
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Total Freight (US $)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="totalFreight"
                                    value={formData.totalFreight}
                                    readOnly
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg outline-none transition-all cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Total Amount (US $)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    required
                                    readOnly
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-gray-50/50 border border-gray-200/60 rounded-lg outline-none transition-all cursor-not-allowed font-bold"
                                />
                            </div>
                        </div>


                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Marks & No.</label>
                            <input
                                type="text"
                                name="marksNo"
                                value={formData.marksNo}
                                onChange={handleInputChange}
                                placeholder="CONTAINER/MARKS"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">No. & Kind of Package</label>
                            <input
                                type="text"
                                name="noKindPackage"
                                value={formData.noKindPackage}
                                onChange={handleInputChange}
                                placeholder="e.g. 500 BAGS"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-bold text-blue-700">Grand Total (US $)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-bold">$</span>
                                <input
                                    type="number"
                                    name="grandTotal"
                                    value={formData.grandTotal}
                                    readOnly
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-blue-50/50 border border-blue-200/60 rounded-lg outline-none font-bold text-blue-700 transition-all cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* --- Advanced/Detailed Sections --- */}
                        <div className="md:col-span-3 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Description of Goods</label>
                            <textarea
                                name="descriptionGoods"
                                value={formData.descriptionGoods}
                                onChange={handleInputChange}
                                rows="3"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                            ></textarea>
                        </div>

                        <div className="md:col-span-3 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Terms of Delivery and Payment</label>
                            <textarea
                                name="termsDeliveryPayment"
                                value={formData.termsDeliveryPayment}
                                onChange={handleInputChange}
                                rows="3"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-[13px]"
                            ></textarea>
                        </div>

                        <div className="md:col-span-3 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Declaration</label>
                            <textarea
                                name="declaration"
                                value={formData.declaration}
                                onChange={handleInputChange}
                                rows="2"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-[13px]"
                            ></textarea>
                        </div>




                        <div className="space-y-2 relative dropdown-container" ref={statusRef}>
                            <label className="text-sm font-medium text-gray-700">Status</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setActiveDropdown(activeDropdown === 'status' ? null : 'status'); setHighlightedIndex(-1); }}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg text-left focus:ring-2 focus:ring-blue-500 outline-none transition-all flex items-center justify-between"
                                >
                                    <span className={formData.status ? 'text-gray-900 font-medium' : 'text-gray-400'}>{formData.status || 'Select Status'}</span>
                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                </button>
                                {activeDropdown === 'status' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1">
                                        {['Active', 'Pending', 'Closed'].map((s, idx) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('status', s)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${formData.status === s ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-3 flex justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
                            {submitStatus === 'success' && <span className="text-green-600 font-medium flex items-center">Saved!</span>}
                            {submitStatus === 'error' && <span className="text-red-600 font-medium flex items-center">Error saving</span>}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update PI' : 'Save PI'}
                            </button>
                        </div>
                    </form>
                </div>
            )}            {!showForm && (
                <div className="space-y-4">
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80">
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Date</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">PI Number</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Importer</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Exporter</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Product</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Qty</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-blue-600">Grand T.</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Status</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {isLoading ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan="9" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                            </tr>
                                        ))
                                    ) : filteredRecords.length > 0 ? (
                                        filteredRecords.map(record => (
                                            <tr key={record._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-600 font-medium">{formatDate(record.date)}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-blue-600">{record.piNumber}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 font-semibold">{record.partyName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700 font-semibold">{record.exporterName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{record.productName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600 font-bold">{record.quantity} kg</td>
                                                <td className="px-6 py-4 text-sm text-blue-700 font-bold">${parseFloat(record.grandTotal).toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${record.status === 'Active' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        record.status === 'Closed' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                                                            'bg-amber-50 text-amber-600 border-amber-100'
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={() => {
                                                                const enriched = { ...record };
                                                                if (!enriched.exporterAddress || !enriched.exporterEmail || !enriched.exporterSignature) {
                                                                    const exp = exporters?.find(e => e.name === enriched.exporterName);
                                                                    if (exp) {
                                                                        enriched.exporterAddress = enriched.exporterAddress || exp.address;
                                                                        enriched.exporterContact = enriched.exporterContact || exp.phone;
                                                                        enriched.exporterEmail = enriched.exporterEmail || exp.email;
                                                                        enriched.exporterSignature = enriched.exporterSignature || exp.signature;
                                                                    }
                                                                }
                                                                if (!enriched.partyAddress || !enriched.partyEmail || !enriched.partySignature) {
                                                                    const imp = importers?.find(i => i.name === enriched.partyName);
                                                                    if (imp) {
                                                                        enriched.partyAddress = enriched.partyAddress || imp.address;
                                                                        enriched.partyContact = enriched.partyContact || imp.phone;
                                                                        enriched.partyEmail = enriched.partyEmail || imp.email;
                                                                        enriched.partySignature = enriched.partySignature || imp.signature;
                                                                    }
                                                                }
                                                                generatePIPDF(enriched);
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-blue-600 transition-all active:scale-90"
                                                            title="Generate PI PDF"
                                                        >
                                                            <PDFIcon className="w-5 h-5" />
                                                        </button>
                                                        {canManage && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEdit(record)}
                                                                    className="p-2 text-gray-400 hover:text-indigo-600 transition-all active:scale-90"
                                                                    title="Edit Record"
                                                                >
                                                                    <EditIcon className="w-5 h-5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(record._id)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 transition-all active:scale-90"
                                                                    title="Delete Record"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center text-gray-400 font-bold">No PI records found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-4 px-2 pb-10">
                        {isLoading ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 animate-pulse space-y-4">
                                    <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                                    <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                                </div>
                            ))
                        ) : filteredRecords.length > 0 ? (
                            filteredRecords.map(record => {
                                const isExpanded = expandedCardId === record._id;
                                return (
                                    <div
                                        key={record._id}
                                        className={`bg-white rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-blue-200 shadow-lg ring-1 ring-blue-50' : 'border-gray-100 shadow-sm'}`}
                                        onClick={() => setExpandedCardId(isExpanded ? null : record._id)}
                                    >
                                        <div className="p-5 space-y-4">
                                            {/* Single Line Header: PI Number & Status Tag */}
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center min-w-0 flex-1">
                                                    <span className="w-[48px] text-[11px] font-black text-blue-500 uppercase tracking-widest shrink-0 whitespace-nowrap">PI No.</span>
                                                    <span className="text-blue-500 font-bold mx-2">-</span>
                                                    <span className="text-sm font-black text-gray-900 tracking-tight truncate">{record.piNumber}</span>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${record.status === 'Active' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    record.status === 'Closed' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                                                        'bg-amber-50 text-amber-700 border-amber-100'
                                                    }`}>
                                                    {record.status}
                                                </span>
                                            </div>

                                            {/* Expandable Details */}
                                            {isExpanded && (
                                                <div className="space-y-2.5 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Date</span>
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-gray-700">{formatDate(record.date)}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Expire Date</span>
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-red-600">{formatDate(record.validityDate)}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Importer</span>
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-gray-800 truncate">{record.partyName}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Exporter</span>
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-gray-800 truncate">{record.exporterName}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Product</span>
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-gray-700 truncate">{record.productName}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-indigo-500 uppercase tracking-widest shrink-0">Grand Total</span>
                                                        <span className="text-indigo-500 font-bold mx-2">-</span>
                                                        <span className="text-sm font-black text-indigo-700 tracking-tight">${parseFloat(record.grandTotal).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Expandable Actions */}
                                        {isExpanded && (
                                            <div className="px-5 pb-5 animate-in slide-in-from-top-2 duration-300">
                                                <div className="pt-2 flex flex-row gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const enriched = { ...record };
                                                            const exp = exporters?.find(e => e.name === enriched.exporterName);
                                                            if (exp) {
                                                                enriched.exporterAddress = enriched.exporterAddress || exp.address;
                                                                enriched.exporterContact = enriched.exporterContact || exp.phone;
                                                                enriched.exporterEmail = enriched.exporterEmail || exp.email;
                                                                enriched.exporterSignature = enriched.exporterSignature || exp.signature;
                                                            }
                                                            const imp = importers?.find(i => i.name === enriched.partyName);
                                                            if (imp) {
                                                                enriched.partyAddress = enriched.partyAddress || imp.address;
                                                                enriched.partyContact = enriched.partyContact || imp.phone;
                                                                enriched.partyEmail = enriched.partyEmail || imp.email;
                                                                enriched.partySignature = enriched.partySignature || imp.signature;
                                                            }
                                                            generatePIPDF(enriched);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                    >
                                                        <PDFIcon className="w-3.5 h-3.5" /> PDF
                                                    </button>
                                                    {canManage && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                                                                className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                            >
                                                                <EditIcon className="w-3.5 h-3.5" /> Edit
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(record._id); }}
                                                                className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No PI records found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Premium Toast Notification */}
            {toast && (
                <div
                    className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-10 duration-300 min-w-[300px] max-w-[90vw]"
                    style={{
                        background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                        boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.15), 0 10px 15px -6px rgb(0 0 0 / 0.15)'
                    }}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        <span className="text-xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm m-0" style={{ lineHeight: 1.2 }}>{toast.type === 'success' ? 'Success' : 'Error'}</p>
                        <p className="text-gray-600 text-[13px] mt-1 m-0" style={{
                            color: toast.type === 'success' ? '#166534' : '#991b1b'
                        }}>{toast.message}</p>
                    </div>
                    <button
                        onClick={() => setToast(null)}
                        className="p-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
                    >
                        <XIcon className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default PI;
