import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, SearchIcon, PlusIcon, EyeIcon, PDFIcon
} from '../../Icons';
import { generatePLPDF } from '../../../utils/plpdfgenerator';
import { generatePL2PDF } from '../../../utils/pl2pdfgenerator';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './PackingList.css';

function PackingList({
    importers = [],
    exporters = [],
    ports = [],
    products = [],
    fetchPorts,
    onDeleteConfirm,
    addNotification,
    currentUser
}) {
    const canManage = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());

    const [showForm, setShowForm] = useState(false);
    const [records, setRecords] = useState([]);
    const [piRecords, setPiRecords] = useState([]);
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [toast, setToast] = useState(null);
    const [expandedCardId, setExpandedCardId] = useState(null);
    
    // Auto-population dropdown state
    const [piSearchQuery, setPiSearchQuery] = useState('');
    
    const toastTimerRef = useRef(null);
    const piDropdownRef = useRef(null);
    const importerRef = useRef(null);
    const exporterRef = useRef(null);
    const portLoadingRef = useRef(null);
    const portDischargeRef = useRef(null);
    const bankRef = useRef(null);
    const branchRef = useRef(null);

    const showToast = (message, type = 'success', duration = 3000) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), duration);
    };

    const [formData, setFormData] = useState({
        packingListNumber: '',
        date: '',
        piNumber: '',
        piDate: '',
        partyName: '',
        partyAddress: '',
        partyContact: '',
        exporterName: '',
        exporterAddress: '',
        exporterContact: '',
        exporterEmail: '',
        preCarriageBy: 'ROAD',
        placeOfReceipt: 'BY ROAD',
        vesselFlightNo: 'BY TRUCK',
        portOfLoading: '',
        portOfDischarge: '',
        finalDestination: 'BANGLADESH',
        marksNo: '',
        lcNumber: '',
        lcDate: '',
        buyerOrderNo: '',
        buyerOrderDate: '',
        productsList: [{ productName: '', hsCode: '', quantity: '', bagCount: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }],
        productsImage: '',
        partySignature: '',
        exporterSignature: '',
        trNumber: '',
        invoiceStyle: 'Style 1 SAA',
        bankName: '',
        branchName: '',
        lcAmendment: '',
        descriptionGoods: '',
        termsDeliveryPayment: '',
        totalAmount: '',
        totalAmountWords: '',
        countryOrigin: 'INDIA',
        countryFinalDest: 'BANGLADESH',
        certification: '',
        otherReferences: '',
        buyerName: ''
    });

    useEffect(() => {
        fetchRecords();
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

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const [plRes, piRes, lcRes, bankRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/packing-lists`),
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`)
            ]);
            setRecords(Array.isArray(plRes.data) ? plRes.data : []);
            setPiRecords(Array.isArray(piRes.data) ? piRes.data : []);
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('Failed to fetch records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Auto-populate form when a Proforma Invoice is selected
    const handlePISelect = (pi) => {
        const matchedLc = lcRecords?.find(l => l.lcNo === pi.lcNumber);
        setFormData(prev => ({
            ...prev,
            piNumber: pi.piNumber || '',
            piDate: pi.date ? pi.date.split('T')[0] : '',
            partyName: pi.partyName || '',
            partyAddress: pi.partyAddress || '',
            partyContact: pi.partyContact || '',
            exporterName: pi.exporterName || '',
            exporterAddress: pi.exporterAddress || '',
            exporterContact: pi.exporterContact || '',
            exporterEmail: pi.exporterEmail || '',
            portOfLoading: pi.portOfLoading || '',
            portOfDischarge: pi.portOfDischarge || '',
            vesselFlightNo: pi.vesselFlightNo || 'BY TRUCK',
            preCarriageBy: pi.preCarriageBy || 'ROAD',
            placeOfReceipt: pi.placeOfReceipt || pi.placeOfReceiptByPreCarrier || 'BY ROAD',
            finalDestination: pi.finalDestination || 'BANGLADESH',
            marksNo: pi.marksNo || '',
            buyerOrderNo: pi.buyerOrderNo || '',
            buyerOrderDate: pi.buyerOrderDate ? pi.buyerOrderDate.split('T')[0] : '',
            lcNumber: pi.lcNumber || '',
            lcDate: pi.lcDate ? pi.lcDate.split('T')[0] : '',
            partySignature: pi.partySignature || '',
            exporterSignature: pi.exporterSignature || '',
            invoiceStyle: pi.invoiceStyle || 'Style 1 SAA',
            bankName: matchedLc ? (matchedLc.bankName || '') : '',
            lcAmendment: '',
            descriptionGoods: pi.descriptionGoods || '',
            termsDeliveryPayment: pi.termsDeliveryPayment || '',
            totalAmount: pi.totalAmount || '',
            totalAmountWords: pi.totalAmountWords || '',
            countryOrigin: pi.countryOrigin || 'INDIA',
            countryFinalDest: pi.countryFinalDest || 'BANGLADESH',
            certification: pi.certification || '',
            otherReferences: pi.otherReferences || '',
            buyerName: pi.buyerName || '',
            productsList: Array.isArray(pi.productsList) && pi.productsList.length > 0
                ? pi.productsList.map(p => ({
                    productName: p.productName || '',
                    hsCode: p.hsCode || '',
                    quantity: p.quantity || '',
                    bagCount: '',
                    netWeight: p.quantity || '', // default net weight to product quantity
                    grossWeight: '',
                    rate: p.rate || '',
                    amount: p.amount || '',
                    freight: p.freight || '',
                    totalFreight: p.totalFreight || ''
                }))
                : [{ productName: '', hsCode: '', quantity: '', bagCount: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }]
        }));
        setPiSearchQuery('');
        setActiveDropdown(null);
        showToast(`Copied data from PI Number ${pi.piNumber}`);
    };

    const handleProductsImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a JPG or PNG image.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, productsImage: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const removeProductsImage = () => {
        setFormData(prev => ({ ...prev, productsImage: '' }));
    };

    const handleProductChange = (index, field, value) => {
        setFormData(prev => {
            const newList = [...prev.productsList];
            newList[index] = { ...newList[index], [field]: value };
            return { ...prev, productsList: newList };
        });
    };

    const addProductRow = () => {
        setFormData(prev => ({
            ...prev,
            productsList: [...prev.productsList, { productName: '', hsCode: '', quantity: '', bagCount: '', netWeight: '', grossWeight: '' }]
        }));
    };

    const removeProductRow = (index) => {
        if (formData.productsList.length === 1) return;
        setFormData(prev => ({
            ...prev,
            productsList: prev.productsList.filter((_, i) => i !== index)
        }));
    };

    const resetForm = () => {
        setFormData({
            packingListNumber: '',
            date: '',
            piNumber: '',
            piDate: '',
            partyName: '',
            partyAddress: '',
            partyContact: '',
            exporterName: '',
            exporterAddress: '',
            exporterContact: '',
            exporterEmail: '',
            preCarriageBy: 'ROAD',
            placeOfReceipt: 'BY ROAD',
            vesselFlightNo: 'BY TRUCK',
            portOfLoading: '',
            portOfDischarge: '',
            finalDestination: 'BANGLADESH',
            marksNo: '',
            lcNumber: '',
            lcDate: '',
            buyerOrderNo: '',
            buyerOrderDate: '',
            productsList: [{ productName: '', hsCode: '', quantity: '', bagCount: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }],
            productsImage: '',
            partySignature: '',
            exporterSignature: '',
            trNumber: '',
            invoiceStyle: 'Style 1 SAA',
            bankName: '',
            branchName: '',
            lcAmendment: '',
            descriptionGoods: '',
            termsDeliveryPayment: '',
            totalAmount: '',
            totalAmountWords: '',
            countryOrigin: 'INDIA',
            countryFinalDest: 'BANGLADESH',
            certification: '',
            otherReferences: '',
            buyerName: ''
        });
        setPiSearchQuery('');
        setEditingId(null);
        setSubmitStatus(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.packingListNumber || !formData.date) {
            showToast('Invoice No and Date are required.', 'error');
            return;
        }

        setIsSubmitting(true);
        setSubmitStatus({ type: 'loading', message: editingId ? 'Updating...' : 'Creating...' });

        try {
            if (editingId) {
                const response = await axios.put(`${API_BASE_URL}/api/packing-lists/${editingId}`, formData);
                setRecords(prev => prev.map(rec => rec._id === editingId ? response.data : rec));
                showToast('Packing List updated successfully.');
                
                // Add system notification
                addNotification(
                    'Packing List Updated',
                    `Packing List (Invoice No: ${formData.packingListNumber}) has been updated by ${currentUser?.name || currentUser?.username}.`,
                    ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                );
            } else {
                const response = await axios.post(`${API_BASE_URL}/api/packing-lists`, formData);
                setRecords(prev => [response.data, ...prev]);
                showToast('Packing List created successfully.');

                addNotification(
                    'Packing List Created',
                    `A new Packing List (Invoice No: ${formData.packingListNumber}) has been created by ${currentUser?.name || currentUser?.username}.`,
                    ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                );
            }
            setShowForm(false);
            resetForm();
        } catch (err) {
            console.error('Error submitting:', err);
            const msg = err.response?.data?.message || 'Error occurred during submission';
            setSubmitStatus({ type: 'error', message: msg });
            showToast(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (record) => {
        setEditingId(record._id);
        setFormData({
            packingListNumber: record.packingListNumber || '',
            date: record.date ? record.date.split('T')[0] : '',
            piNumber: record.piNumber || '',
            piDate: record.piDate ? record.piDate.split('T')[0] : '',
            partyName: record.partyName || '',
            partyAddress: record.partyAddress || '',
            partyContact: record.partyContact || '',
            exporterName: record.exporterName || '',
            exporterAddress: record.exporterAddress || '',
            exporterContact: record.exporterContact || '',
            exporterEmail: record.exporterEmail || '',
            preCarriageBy: record.preCarriageBy || 'ROAD',
            placeOfReceipt: record.placeOfReceipt || 'BY ROAD',
            vesselFlightNo: record.vesselFlightNo || 'BY TRUCK',
            portOfLoading: record.portOfLoading || '',
            portOfDischarge: record.portOfDischarge || '',
            finalDestination: record.finalDestination || 'BANGLADESH',
            marksNo: record.marksNo || '',
            lcNumber: record.lcNumber || '',
            lcDate: record.lcDate ? record.lcDate.split('T')[0] : '',
            buyerOrderNo: record.buyerOrderNo || '',
            buyerOrderDate: record.buyerOrderDate ? record.buyerOrderDate.split('T')[0] : '',
            productsList: Array.isArray(record.productsList) && record.productsList.length > 0
                ? record.productsList.map(p => ({
                    productName: p.productName || '',
                    hsCode: p.hsCode || '',
                    quantity: p.quantity || '',
                    bagCount: p.bagCount || '',
                    netWeight: p.netWeight || '',
                    grossWeight: p.grossWeight || '',
                    rate: p.rate || '',
                    amount: p.amount || '',
                    freight: p.freight || '',
                    totalFreight: p.totalFreight || ''
                }))
                : [{ productName: '', hsCode: '', quantity: '', bagCount: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }],
            productsImage: record.productsImage || '',
            partySignature: record.partySignature || '',
            exporterSignature: record.exporterSignature || '',
            status: record.status || 'Active',
            invoiceStyle: record.invoiceStyle || 'Style 1 SAA',
            bankName: record.bankName || '',
            lcAmendment: record.lcAmendment || '',
            descriptionGoods: record.descriptionGoods || '',
            termsDeliveryPayment: record.termsDeliveryPayment || '',
            totalAmount: record.totalAmount || '',
            totalAmountWords: record.totalAmountWords || '',
            countryOrigin: record.countryOrigin || 'INDIA',
            countryFinalDest: record.countryFinalDest || 'BANGLADESH',
            certification: record.certification || '',
            otherReferences: record.otherReferences || '',
            buyerName: record.buyerName || ''
        });
        setShowForm(true);
    };

    const handleDeleteClick = (id) => {
        onDeleteConfirm({
            show: true,
            type: 'packing-list',
            id: id,
            isBulk: false,
            extraData: {
                action: () => {
                    axios.delete(`${API_BASE_URL}/api/packing-lists/${id}`).then(() => fetchRecords());
                }
            }
        });
    };

    const handleDropdownSelect = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setActiveDropdown(null);
    };

    const handleDropdownKeyDown = (e, dropdownKey, filteredList, selectField) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredList.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredList.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < filteredList.length) {
                const item = filteredList[highlightedIndex];
                if (dropdownKey === 'piList') {
                    handlePISelect(item);
                } else if (dropdownKey === 'lcNumber') {
                    setFormData(prev => ({
                        ...prev,
                        lcNumber: item.lcNo || '',
                        lcDate: item.openingDate ? item.openingDate.split('T')[0] : ''
                    }));
                    setActiveDropdown(null);
                } else if (selectField) {
                    handleDropdownSelect(selectField, typeof item === 'object' ? item.name || item.piNumber : item);
                }
            }
        } else if (e.key === 'Escape') {
            setActiveDropdown(null);
        }
    };

    const filteredRecords = records.filter(record => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (record.packingListNumber || '').toLowerCase().includes(query) ||
                (record.partyName || '').toLowerCase().includes(query) ||
                (record.piNumber || '').toLowerCase().includes(query);
        }
        return true;
    });

    const filteredPIs = piRecords.filter(pi => {
        if (piSearchQuery) {
            const query = piSearchQuery.toLowerCase();
            return (pi.piNumber || '').toLowerCase().includes(query) ||
                (pi.partyName || '').toLowerCase().includes(query);
        }
        return true;
    });

    const filteredLcs = useMemo(() => {
        let list = lcRecords;
        
        // Filter by PI number if one is entered
        if (formData.piNumber) {
            const piNoClean = (formData.piNumber || '').trim().toLowerCase();
            list = list.filter(lc => (lc.piNo || '').trim().toLowerCase() === piNoClean);
        }
        
        // Filter by the search input typed inside the LC Number field
        if (formData.lcNumber) {
            const search = formData.lcNumber.toLowerCase();
            list = list.filter(lc => (lc.lcNo || '').toLowerCase().includes(search));
        }
        
        return list;
    }, [lcRecords, formData.piNumber, formData.lcNumber]);

    return (
        <div className="pl-management space-y-6">
            {toast && (
                <div className={`fixed top-4 right-4 z-[9999] px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium animate-in transition-all ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                    {toast.message}
                </div>
            )}

            {!showForm && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="w-full md:w-1/4 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-gray-800" style={{ margin: 0 }}>Packing List</h2>
                    </div>

                    <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                        <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Invoice No, Importer, or PI No..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm focus:bg-white"
                        />
                    </div>

                    <div className="w-full md:w-1/4 flex justify-end z-10 gap-2 sm:gap-3">
                        {canManage && (
                            <button
                                onClick={() => { setShowForm(true); resetForm(); }}
                                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap"
                            >
                                <span className="mr-1.5 font-bold text-lg leading-none">+</span> Add New
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showForm && (
                <div className="pl-form relative rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-4 relative z-10">
                        <h3 className="text-xl font-semibold text-gray-800">{editingId ? 'Edit Packing List' : 'New Packing List Creation'}</h3>
                        <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-red-500 transition-colors">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* PI pre-fill search bar */}
                    {!editingId && (
                        <div className="mb-8 p-4 bg-blue-50/50 border border-blue-100 rounded-xl relative z-20 dropdown-container" ref={piDropdownRef}>
                            <label className="block text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Auto-populate from Proforma Invoice (PI)</label>
                            <div className="relative max-w-md">
                                <input
                                    type="text"
                                    placeholder="Search PI number or importer name to pre-fill..."
                                    value={piSearchQuery}
                                    onChange={(e) => { setPiSearchQuery(e.target.value); setActiveDropdown('piList'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('piList'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'piList', filteredPIs)}
                                    className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-blue-400" />
                                </div>
                                {activeDropdown === 'piList' && filteredPIs.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {filteredPIs.map((pi, idx) => (
                                            <button
                                                key={pi._id}
                                                type="button"
                                                onClick={() => handlePISelect(pi)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2.5 text-left text-sm flex justify-between items-center ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                <span className="font-semibold">{pi.piNumber}</span>
                                                <span className="text-xs text-gray-500 truncate max-w-[200px]">{pi.partyName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        {/* --- Main Grid --- */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Invoice No*</label>
                                <input
                                    type="text"
                                    name="packingListNumber"
                                    value={formData.packingListNumber}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Invoice No"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Invoice Date*</label>
                                <CustomDatePicker
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    placeholder="Select Date"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">TR No.</label>
                                <input
                                    type="text"
                                    name="trNumber"
                                    value={formData.trNumber}
                                    onChange={handleInputChange}
                                    placeholder="e.g. 87288 DATE:04/05/2026"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">PI Number</label>
                                <input
                                    type="text"
                                    name="piNumber"
                                    value={formData.piNumber}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="PI Reference No"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">PI Date</label>
                                <CustomDatePicker
                                    name="piDate"
                                    value={formData.piDate}
                                    onChange={handleInputChange}
                                    placeholder="PI Reference Date"
                                />
                            </div>

                            <div className="space-y-2 relative dropdown-container">
                                <label className="text-sm font-medium text-gray-700">LC Number</label>
                                <input
                                    type="text"
                                    name="lcNumber"
                                    value={formData.lcNumber}
                                    onChange={(e) => {
                                        handleInputChange(e);
                                        setActiveDropdown('lcNumber');
                                        setHighlightedIndex(-1);
                                    }}
                                    onFocus={() => {
                                        setActiveDropdown('lcNumber');
                                        setHighlightedIndex(-1);
                                    }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'lcNumber', filteredLcs, 'lcNumber')}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Select or enter LC Number"
                                    autoComplete="off"
                                />
                                {activeDropdown === 'lcNumber' && filteredLcs.length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {filteredLcs.map((lc, idx) => (
                                            <button
                                                key={lc._id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        lcNumber: lc.lcNo || '',
                                                        lcDate: lc.openingDate ? lc.openingDate.split('T')[0] : '',
                                                        bankName: lc.bankName || ''
                                                    }));
                                                    setActiveDropdown(null);
                                                }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm flex justify-between items-center ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                <span className="font-semibold">{lc.lcNo}</span>
                                                <span className="text-xs text-gray-400">Date: {lc.openingDate ? formatDate(lc.openingDate) : '-'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">LC Date</label>
                                <CustomDatePicker
                                    name="lcDate"
                                    value={formData.lcDate}
                                    onChange={handleInputChange}
                                    placeholder="LC Date"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Buyer's Order No (Alternate)</label>
                                <input
                                    type="text"
                                    name="buyerOrderNo"
                                    value={formData.buyerOrderNo}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Alternate Buyer's Order No"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Buyer's Order Date (Alternate)</label>
                                <CustomDatePicker
                                    name="buyerOrderDate"
                                    value={formData.buyerOrderDate}
                                    onChange={handleInputChange}
                                    placeholder="Alternate Order Date"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-blue-700">Invoice Style</label>
                                <select
                                    name="invoiceStyle"
                                    value={formData.invoiceStyle || 'Style 1 SAA'}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-900"
                                >
                                    <option value="Style 1 SAA">Style 1 SAA</option>
                                    <option value="Style 2 AAS">Style 2 AAS</option>
                                </select>
                            </div>

                            <div className="space-y-2 relative dropdown-container" ref={bankRef}>
                                <label className="text-sm font-medium text-gray-700">LC Bank Name</label>
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('bank'); }}
                                    onFocus={() => setActiveDropdown('bank')}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'bank', banks, 'bankName')}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="e.g. CITY BANK PLC"
                                />
                                {activeDropdown === 'bank' && banks.length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {banks.filter(b => !formData.bankName || b.bankName.toLowerCase().includes(formData.bankName.toLowerCase())).map((b, idx) => (
                                            <button
                                                key={b._id || idx}
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        bankName: b.bankName,
                                                        branchName: b.branches && b.branches.length > 0 ? b.branches[0].branch : ''
                                                    }));
                                                    setActiveDropdown(null);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                                            >
                                                <div className="font-medium">{b.bankName}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 relative dropdown-container" ref={branchRef}>
                                <label className="text-sm font-medium text-gray-700">LC Branch Name</label>
                                <input
                                    type="text"
                                    name="branchName"
                                    value={formData.branchName || ''}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('branch'); }}
                                    onFocus={() => setActiveDropdown('branch')}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="e.g. BOGURA BRANCH..."
                                />
                                {activeDropdown === 'branch' && formData.bankName && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {banks.find(b => b.bankName === formData.bankName)?.branches?.filter(br => !formData.branchName || br.branch.toLowerCase().includes(formData.branchName.toLowerCase())).map((br, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, branchName: br.branch }));
                                                    setActiveDropdown(null);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors text-gray-700`}
                                            >
                                                <div className="font-medium">{br.branch}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">LC Amendment Details (Optional)</label>
                                <input
                                    type="text"
                                    name="lcAmendment"
                                    value={formData.lcAmendment || ''}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="e.g. AMENDMENT NO-02 DATE: 04/05/2026"
                                />
                            </div>

                            <div className="md:col-span-3 space-y-2">
                                <label className="text-sm font-medium text-gray-700">Description of Goods (Extra Details)</label>
                                <textarea
                                    name="descriptionGoods"
                                    value={formData.descriptionGoods || ''}
                                    onChange={handleInputChange}
                                    rows="3"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    placeholder="Extra certifications, insurance note, etc."
                                ></textarea>
                            </div>

                            <div className="md:col-span-3 space-y-2">
                                <label className="text-sm font-medium text-gray-700">Terms of Delivery and Payment</label>
                                <textarea
                                    name="termsDeliveryPayment"
                                    value={formData.termsDeliveryPayment || ''}
                                    onChange={handleInputChange}
                                    rows="3"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    placeholder="Terms of delivery and payment..."
                                ></textarea>
                            </div>
                        </div>

                        {/* --- Parties Grid --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50/50 p-4 border border-gray-200/40 rounded-xl">
                            {/* Exporter Section */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1.5 uppercase tracking-wider">Exporter / Seller</h4>
                                <div className="space-y-2 relative dropdown-container" ref={exporterRef}>
                                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Exporter Name</label>
                                    <input
                                        type="text"
                                        name="exporterName"
                                        value={formData.exporterName}
                                        onChange={(e) => { handleInputChange(e); setActiveDropdown('exporter'); }}
                                        onFocus={() => setActiveDropdown('exporter')}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'exporter', exporters, 'exporterName')}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Exporter Name"
                                    />
                                    {activeDropdown === 'exporter' && exporters.length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                            {exporters.filter(e => !formData.exporterName || e.name.toLowerCase().includes(formData.exporterName.toLowerCase())).map((exp, idx) => (
                                                <button
                                                    key={exp._id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            exporterName: exp.name || '',
                                                            exporterAddress: exp.address || '',
                                                            exporterContact: exp.contact || '',
                                                            exporterEmail: exp.email || '',
                                                            exporterSignature: exp.signature || ''
                                                        }));
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                                                >
                                                    {exp.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Address</label>
                                    <textarea
                                        name="exporterAddress"
                                        value={formData.exporterAddress}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        placeholder="Exporter Address"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold text-gray-500 uppercase">Contact</label>
                                        <input
                                            type="text"
                                            name="exporterContact"
                                            value={formData.exporterContact}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Contact"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-semibold text-gray-500 uppercase">Email</label>
                                        <input
                                            type="email"
                                            name="exporterEmail"
                                            value={formData.exporterEmail}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Email"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Importer Section */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1.5 uppercase tracking-wider">Importer / Buyer</h4>
                                <div className="space-y-2 relative dropdown-container" ref={importerRef}>
                                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Importer Name</label>
                                    <input
                                        type="text"
                                        name="partyName"
                                        value={formData.partyName}
                                        onChange={(e) => { handleInputChange(e); setActiveDropdown('importer'); }}
                                        onFocus={() => setActiveDropdown('importer')}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'importer', importers, 'partyName')}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Importer Name"
                                    />
                                    {activeDropdown === 'importer' && importers.length > 0 && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                            {importers.filter(i => !formData.partyName || i.name.toLowerCase().includes(formData.partyName.toLowerCase())).map((imp, idx) => (
                                                <button
                                                    key={imp._id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            partyName: imp.name || '',
                                                            partyAddress: imp.address || '',
                                                            partyContact: imp.contact || '',
                                                            partySignature: imp.signature || ''
                                                        }));
                                                        setActiveDropdown(null);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                                                >
                                                    {imp.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Address</label>
                                    <textarea
                                        name="partyAddress"
                                        value={formData.partyAddress}
                                        onChange={handleInputChange}
                                        rows={3}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        placeholder="Importer Address"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Contact</label>
                                    <input
                                        type="text"
                                        name="partyContact"
                                        value={formData.partyContact}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Contact No"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* --- Transport Grid --- */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 p-4 border border-gray-200/40 rounded-xl">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Pre-Carriage By</label>
                                <input
                                    type="text"
                                    name="preCarriageBy"
                                    value={formData.preCarriageBy}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. ROAD"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Place of Receipt by Pre-Carrier</label>
                                <input
                                    type="text"
                                    name="placeOfReceipt"
                                    value={formData.placeOfReceipt || ''}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. BY ROAD"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Vessel/Flight/Truck No</label>
                                <input
                                    type="text"
                                    name="vesselFlightNo"
                                    value={formData.vesselFlightNo}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. BY TRUCK"
                                />
                            </div>

                            <div className="space-y-2 relative dropdown-container" ref={portLoadingRef}>
                                <label className="text-sm font-medium text-gray-700">Port of Loading</label>
                                <input
                                    type="text"
                                    name="portOfLoading"
                                    value={formData.portOfLoading}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('portOfLoading'); }}
                                    onFocus={() => setActiveDropdown('portOfLoading')}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'portOfLoading', ports, 'portOfLoading')}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Port of Loading"
                                />
                                {activeDropdown === 'portOfLoading' && ports.length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {ports.filter(p => !formData.portOfLoading || p.name.toLowerCase().includes(formData.portOfLoading.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onClick={() => handleDropdownSelect('portOfLoading', port.name)}
                                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                                            >
                                                {port.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 relative dropdown-container" ref={portDischargeRef}>
                                <label className="text-sm font-medium text-gray-700">Port of Discharge</label>
                                <input
                                    type="text"
                                    name="portOfDischarge"
                                    value={formData.portOfDischarge}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('portOfDischarge'); }}
                                    onFocus={() => setActiveDropdown('portOfDischarge')}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'portOfDischarge', ports, 'portOfDischarge')}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Port of Discharge"
                                />
                                {activeDropdown === 'portOfDischarge' && ports.length > 0 && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {ports.filter(p => !formData.portOfDischarge || p.name.toLowerCase().includes(formData.portOfDischarge.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onClick={() => handleDropdownSelect('portOfDischarge', port.name)}
                                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-blue-50"
                                            >
                                                {port.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Final Destination</label>
                                <input
                                    type="text"
                                    name="finalDestination"
                                    value={formData.finalDestination || ''}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. BANGLADESH"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Marks & No.</label>
                                <input
                                    type="text"
                                    name="marksNo"
                                    value={formData.marksNo}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Marks & No."
                                />
                            </div>
                        </div>

                        {/* --- Products & Packaging Image Upload --- */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Products & Packaging Details</h4>
                            </div>

                            <div className="rounded-xl border border-gray-200 shadow-sm bg-white/50 p-4">
                                {formData.productsImage ? (
                                    <div className="relative group">
                                        <img
                                            src={formData.productsImage}
                                            alt="Products & Packaging Details"
                                            className="w-full max-h-[500px] object-contain rounded-lg border border-gray-200 bg-gray-50 p-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={removeProductsImage}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                                            title="Remove image"
                                        >
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                        <p className="text-xs text-gray-400 text-center mt-2">Hover over image to see remove option</p>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-blue-50/30 hover:border-blue-400 transition-all group">
                                        <div className="flex flex-col items-center justify-center py-6">
                                            <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
                                            <p className="text-sm font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">Click to upload Products & Packaging image</p>
                                            <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG</p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/png, image/jpeg, image/jpg"
                                            onChange={handleProductsImageChange}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* --- Footer Status / Submit buttons --- */}
                        {submitStatus && submitStatus.type === 'error' && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
                                {submitStatus.message}
                            </div>
                        )}

                        <div className="flex justify-end gap-4 border-t border-gray-250/50 pt-6">
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); resetForm(); }}
                                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:scale-100 disabled:opacity-50"
                            >
                                {editingId ? 'Update Record' : 'Save Packing List'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- List View --- */}
            {!showForm && (
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="spinner w-10 h-10"></div>
                            <p className="text-sm font-medium text-gray-500">Loading Packing List records...</p>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <PDFIcon className="w-16 h-16 text-gray-300 mb-4 stroke-1" />
                            <h3 className="text-lg font-bold text-gray-800 mb-1">No Packing Lists Found</h3>
                            <p className="text-sm text-gray-500 max-w-sm px-4">
                                {searchQuery ? 'Try adjusting your search criteria.' : 'Create a new Packing List using the "+ Add New" button.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            {/* Desktop Table View */}
                            <table className="hidden md:table w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Invoice No</th>
                                        <th className="px-6 py-4">Invoice Date</th>
                                        <th className="px-6 py-4">PI Ref Number</th>
                                        <th className="px-6 py-4">Importer / Buyer</th>
                                        <th className="px-6 py-4 text-center">Bags</th>
                                        <th className="px-6 py-4 text-center">Net Wt (KG)</th>
                                        <th className="px-6 py-4 text-center">Gross Wt (KG)</th>
                                        <th className="px-6 py-4 text-center">TR No.</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150 text-sm">
                                    {filteredRecords.map(rec => {
                                        let totalBags = 0;
                                        let totalNet = 0;
                                        let totalGross = 0;
                                        if (Array.isArray(rec.productsList)) {
                                            rec.productsList.forEach(p => {
                                                totalBags += parseInt(p.bagCount) || 0;
                                                totalNet += parseFloat(p.netWeight) || 0;
                                                totalGross += parseFloat(p.grossWeight) || 0;
                                            });
                                        }

                                        return (
                                            <tr key={rec._id} className="hover:bg-gray-50/50">
                                                <td className="px-6 py-4 font-bold text-gray-800">{rec.packingListNumber}</td>
                                                <td className="px-6 py-4 text-gray-600">{formatDate(rec.date)}</td>
                                                <td className="px-6 py-4 text-gray-600">{rec.piNumber || 'N/A'}</td>
                                                <td className="px-6 py-4 font-semibold text-gray-800 truncate max-w-[180px]">{rec.partyName}</td>
                                                <td className="px-6 py-4 text-center font-semibold text-gray-800">{totalBags.toLocaleString('en-US')}</td>
                                                <td className="px-6 py-4 text-center font-bold text-blue-600">{totalNet.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                                <td className="px-6 py-4 text-center font-bold text-indigo-600">{totalGross.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-gray-700 font-medium">
                                                        {rec.trNumber || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            if (rec.invoiceStyle === 'Style 2 AAS') {
                                                                generatePL2PDF(rec, piRecords, lcRecords, importers, exporters, banks);
                                                            } else {
                                                                generatePLPDF(rec, piRecords, lcRecords, importers, exporters);
                                                            }
                                                        }}
                                                        title="Download PDF"
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg transition-all"
                                                    >
                                                        <PDFIcon className="w-4 h-4" />
                                                    </button>
                                                    {canManage && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditClick(rec)}
                                                                title="Edit"
                                                                className="p-1.5 text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-200 rounded-lg transition-all"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(rec._id)}
                                                                title="Delete"
                                                                className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-all"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Mobile Card Layout */}
                            <div className="md:hidden grid grid-cols-1 gap-4 p-4">
                                {filteredRecords.map(rec => {
                                    let totalBags = 0;
                                    let totalNet = 0;
                                    let totalGross = 0;
                                    if (Array.isArray(rec.productsList)) {
                                        rec.productsList.forEach(p => {
                                            totalBags += parseInt(p.bagCount) || 0;
                                            totalNet += parseFloat(p.netWeight) || 0;
                                            totalGross += parseFloat(p.grossWeight) || 0;
                                        });
                                    }
                                    const isExpanded = expandedCardId === rec._id;

                                    return (
                                        <div key={rec._id} className="bg-white rounded-xl border border-gray-150 shadow-sm p-4 relative overflow-hidden transition-all duration-300">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Invoice No</span>
                                                    <h4 className="text-base font-bold text-gray-800 leading-tight">{rec.packingListNumber}</h4>
                                                    <span className="text-xs text-gray-500 font-medium">{formatDate(rec.date)}</span>
                                                </div>
                                                <span className={`status-badge ${rec.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                    {rec.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-y-3 gap-x-2 my-4 border-t border-b border-gray-100 py-3 text-xs">
                                                <div>
                                                    <span className="block font-medium text-gray-400">Importer</span>
                                                    <span className="font-semibold text-gray-800 truncate max-w-[120px] block">{rec.partyName}</span>
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-gray-400">PI Ref</span>
                                                    <span className="font-semibold text-gray-800 block">{rec.piNumber || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-gray-400">Total Bags</span>
                                                    <span className="font-bold text-gray-800 block">{totalBags.toLocaleString('en-US')}</span>
                                                </div>
                                                <div>
                                                    <span className="block font-medium text-gray-400">Net Wt / Gross Wt</span>
                                                    <span className="font-bold text-blue-600 block">{Math.round(totalNet).toLocaleString('en-US')} / {Math.round(totalGross).toLocaleString('en-US')} KG</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center pt-2">
                                                <button
                                                    onClick={() => setExpandedCardId(isExpanded ? null : rec._id)}
                                                    className="text-xs font-semibold text-gray-500 hover:text-blue-600 flex items-center gap-1.5 focus:outline-none"
                                                >
                                                    <span>{isExpanded ? 'Hide products' : 'Show products'}</span>
                                                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} />
                                                </button>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (rec.invoiceStyle === 'Style 2 AAS') {
                                                                generatePL2PDF(rec, piRecords, lcRecords, importers, exporters, banks);
                                                            } else {
                                                                generatePLPDF(rec, piRecords, lcRecords, importers, exporters);
                                                            }
                                                        }}
                                                        className="p-2 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg"
                                                    >
                                                        <PDFIcon className="w-4 h-4" />
                                                    </button>
                                                    {canManage && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditClick(rec)}
                                                                className="p-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg"
                                                            >
                                                                <EditIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(rec._id)}
                                                                className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {isExpanded && rec.productsList && (
                                                <div className="mt-4 pt-3 border-t border-dashed border-gray-150 bg-gray-50/50 p-2.5 rounded-lg space-y-2 animate-in">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product Details</span>
                                                    {rec.productsList.map((p, pIdx) => (
                                                        <div key={pIdx} className="text-xs flex justify-between items-center border-b border-gray-100 pb-1.5 last:border-b-0 last:pb-0">
                                                            <span className="font-semibold text-gray-700">{p.productName}</span>
                                                            <span className="text-gray-500">
                                                                {p.bagCount ? `${p.bagCount} bags` : ''} ({Math.round(parseFloat(p.netWeight)).toLocaleString('en-US')} KG Net)
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default PackingList;
