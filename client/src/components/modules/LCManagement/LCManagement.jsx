import React, { useState, useEffect, useRef } from 'react';
import axios from '../../../utils/api';
import {
    PlusIcon, XIcon, EditIcon, TrashIcon, SearchIcon,
    LCManagerIcon, ShieldIcon, BuildingIcon, GlobeIcon,
    DollarSignIcon, CalendarIcon, ChevronDownIcon
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './LCManagement.css';

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
        status: 'Opened'
    });

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
            const [lcRes, bankRes, impRes, expRes, insRes, ipRes, piRes, prodRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/importers`),
                axios.get(`${API_BASE_URL}/api/exporters`),
                axios.get(`${API_BASE_URL}/api/insurance`),
                axios.get(`${API_BASE_URL}/api/ip-records`),
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/products`)
            ]);

            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);

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

            if (['quantity', 'rate', 'totalDollar', 'dollarRate', 'extraPercent', 'premium', 'premiumReturn', 'totalAmount'].includes(name)) {
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
            status: record.status || 'Opened'
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
            status: 'Opened'
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

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-10 gap-6">
                            <div className="space-y-1.5 text-left relative md:col-span-2 lg:col-span-2" ref={insuranceRef}>
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
                                className="px-10 py-3 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-black hover:to-gray-800 text-white font-bold rounded-xl shadow-xl transition-all active:scale-95 transform"
                            >
                                {editingId ? 'Update LC Record' : 'Complete Registration'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!showForm && (
                <div className="overflow-x-auto bg-white/50 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">IP / PI / LC Number</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Dates</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Parties</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product / H.S Code</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">LC Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-sm text-gray-500 font-medium">Loading records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecords.length > 0 ? (
                                filteredRecords.map((record) => (
                                    <tr key={record._id} className="lc-table-row hover:bg-white/80 transition-all group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">IP:</span>
                                                    <span className="text-sm font-bold text-gray-900">{record.ipNo || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-rose-400 uppercase">PI:</span>
                                                    <span className="text-xs font-bold text-gray-700">{record.piNo || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-blue-400 uppercase">LC:</span>
                                                    <span className="text-xs font-bold text-gray-700">{record.lcNo}</span>
                                                </div>
                                                <span className="text-[11px] font-bold text-blue-500 uppercase mt-1">{record.bankName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <span className={`lc-status-badge status-${record.status?.toLowerCase().replace(' ', '-')}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                    <span className="text-gray-400 font-bold w-12">OPEN:</span>
                                                    <span className="text-gray-700 font-medium">{formatDate(record.openingDate)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px]">
                                                    <span className="text-gray-400 font-bold w-12">EXP:</span>
                                                    <span className="text-red-500 font-bold">{formatDate(record.expiryDate)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <BuildingIcon className="w-3.5 h-3.5 text-indigo-400" />
                                                    <span className="text-xs font-bold text-gray-700">{record.importerName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <GlobeIcon className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-[11px] font-semibold text-gray-500">{record.exporterName}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-gray-900">৳{parseFloat(record.totalAmount || 0).toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900 truncate">{record.productName || '-'}</span>
                                                <span className="text-[10px] text-gray-500 font-semibold uppercase">{record.hsCode || 'No H.S Code'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                                    title="Edit Record"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record._id)}
                                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <LCManagerIcon className="w-12 h-12 text-gray-200" />
                                            <span className="text-gray-400 font-medium">No LC records found</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default LCManagement;
