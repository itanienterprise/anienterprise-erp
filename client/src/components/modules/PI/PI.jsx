import React, { useState, useEffect, useRef } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, SearchIcon
} from '../../Icons';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './PI.css';

function PI({
    importers,
    exporters,
    ports,
    products = [],
    onDeleteConfirm
}) {
    const [showForm, setShowForm] = useState(false);
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const [banks, setBanks] = useState([]);
    const [formData, setFormData] = useState({
        date: '',
        validityDate: '',
        piNumber: '',
        partyName: '',
        exporterName: '',
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
        status: 'Active'
    });

    const partyRef = useRef(null);
    const exporterRef = useRef(null);
    const productRef = useRef(null);
    const portRef = useRef(null);
    const placeOfReceiptRef = useRef(null);
    const portLoadingRef = useRef(null);
    const portDischargeRef = useRef(null);
    const bankRef = useRef(null);
    const statusRef = useRef(null);

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
            const [piRes, bankRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/banks`)
            ]);
            setRecords(Array.isArray(piRes.data) ? piRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
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
                
                const amt = q > 0 && r > 0 ? (q * r) : 0;
                updated.amount = amt > 0 ? amt.toFixed(2) : '';
                
                const totFr = q > 0 && f > 0 ? (q * f) : 0;
                updated.totalFreight = totFr > 0 ? totFr.toFixed(2) : '';
                
                const grand = amt + totFr;
                updated.grandTotal = grand > 0 ? grand.toFixed(2) : '';
            }
            return updated;
        });
    };

    const handleDropdownSelect = (field, value) => {
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
                handleDropdownSelect(field || dropdownId, value);
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
                ? `${API_BASE_URL}/api/pi/${editingId}`
                : `${API_BASE_URL}/api/pi`;

            if (editingId) {
                await axios.put(url, formData);
            } else {
                await axios.post(url, formData);
            }
            setSubmitStatus('success');
            setTimeout(() => {
                setShowForm(false);
                resetForm();
                fetchRecords();
            }, 1500);
        } catch (error) {
            console.error('Error saving PI record:', error);
            setSubmitStatus('error');
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
            exporterName: '',
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
            exporterName: record.exporterName || '',
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-1/4 text-center md:text-left">
                    <h2 className="text-2xl font-bold text-gray-800" style={{margin:0}}>Proforma Invoice (PI)</h2>
                </div>
                
                <div className="w-full md:flex-1 md:max-w-md md:mx-auto relative group px-2 md:px-0">
                    <div className="absolute inset-y-0 left-0 pl-5 md:pl-3.5 flex items-center pointer-events-none">
                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search PI No, Party, or Product..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-12 md:pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none shadow-sm focus:bg-white"
                    />
                </div>

                <div className="w-full md:w-1/4 flex justify-end z-10 gap-2 sm:gap-3">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap"
                    >
                        <span className="mr-1.5 font-bold text-lg leading-none">+</span> Add New
                    </button>
                </div>
            </div>

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
                                placeholder="Enter PI Number"
                                className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={partyRef}>
                            <label className="text-sm font-medium text-gray-700">Party / Importer</label>
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
                            <label className="text-sm font-medium text-gray-700">Quantity</label>
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
                            <label className="text-sm font-medium text-gray-700">Rate</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="rate"
                                    value={formData.rate}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Total Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Freight</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="freight"
                                    value={formData.freight}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Total Freight</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="totalFreight"
                                    value={formData.totalFreight}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Grand Total</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    name="grandTotal"
                                    value={formData.grandTotal}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="space-y-2 relative dropdown-container" ref={placeOfReceiptRef}>
                            <label className="text-sm font-medium text-gray-700">Place of Receipt</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="placeOfReceipt"
                                    value={formData.placeOfReceipt}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('placeOfReceipt'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('placeOfReceipt'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'placeOfReceipt', ports.filter(p => !formData.placeOfReceipt || p.name.toLowerCase().includes(formData.placeOfReceipt.toLowerCase())), 'placeOfReceipt')}
                                    placeholder="Search Port..."
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'placeOfReceipt' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ports.filter(p => !formData.placeOfReceipt || p.name.toLowerCase().includes(formData.placeOfReceipt.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('placeOfReceipt', port.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.placeOfReceipt === port.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {port.name}
                                            </button>
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
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('portOfLoading'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('portOfLoading'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'portOfLoading', ports.filter(p => !formData.portOfLoading || p.name.toLowerCase().includes(formData.portOfLoading.toLowerCase())), 'portOfLoading')}
                                    placeholder="Search Port..."
                                    required
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'portOfLoading' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ports.filter(p => !formData.portOfLoading || p.name.toLowerCase().includes(formData.portOfLoading.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('portOfLoading', port.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.portOfLoading === port.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {port.name}
                                            </button>
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
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('portOfDischarge'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('portOfDischarge'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'portOfDischarge', ports.filter(p => !formData.portOfDischarge || p.name.toLowerCase().includes(formData.portOfDischarge.toLowerCase())), 'portOfDischarge')}
                                    placeholder="Search Port..."
                                    required
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'portOfDischarge' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ports.filter(p => !formData.portOfDischarge || p.name.toLowerCase().includes(formData.portOfDischarge.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('portOfDischarge', port.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.portOfDischarge === port.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {port.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={bankRef}>
                            <label className="text-sm font-medium text-gray-700">Indian Bank</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="indianBank"
                                    value={formData.indianBank}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('indianBank'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('indianBank'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'indianBank', banks.filter(b => !formData.indianBank || b.bankName.toLowerCase().includes(formData.indianBank.toLowerCase())), 'indianBank')}
                                    placeholder="Search Bank..."
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'indianBank' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {banks.filter(b => !formData.indianBank || b.bankName.toLowerCase().includes(formData.indianBank.toLowerCase())).map((bank, idx) => (
                                            <button
                                                key={bank._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('indianBank', bank.bankName)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.indianBank === bank.bankName ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {bank.bankName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={portRef}>
                            <label className="text-sm font-medium text-gray-700">Port</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="port"
                                    value={formData.port}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('port'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('port'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'port', ports.filter(p => !formData.port || p.name.toLowerCase().includes(formData.port.toLowerCase())), 'port')}
                                    placeholder="Search Port..."
                                    required
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                {activeDropdown === 'port' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ports.filter(p => !formData.port || p.name.toLowerCase().includes(formData.port.toLowerCase())).map((port, idx) => (
                                            <button
                                                key={port._id}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('port', port.name)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === idx || formData.port === port.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {port.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                type="button"
                                onClick={() => { setShowForm(false); resetForm(); }}
                                className="px-6 py-2.5 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-8 py-2.5 bg-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? 'Saving...' : editingId ? 'Update PI' : 'Save PI'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80">
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Date</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">PI Number</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Party</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Product</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Qty</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Rate</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Amount</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Freight</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Total Fr.</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 text-blue-600">Grand T.</th>
                                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">Port</th>
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
                                            <td className="px-6 py-4 text-sm text-gray-600">{record.productName}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-bold">{record.quantity}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">${record.rate}</td>
                                            <td className="px-6 py-4 text-sm text-gray-800 font-bold">${record.amount}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">${record.freight}</td>
                                            <td className="px-6 py-4 text-sm text-gray-800 font-bold">${record.totalFreight}</td>
                                            <td className="px-6 py-4 text-sm text-blue-700 font-bold">${record.grandTotal}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{record.port}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    record.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    record.status === 'Closed' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
                                                    'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center items-center gap-2">
                                                    <button onClick={() => handleEdit(record)} className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-all" title="Edit">
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(record._id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-all" title="Delete">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-12 text-center text-gray-500 font-medium">
                                            No PI records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PI;
