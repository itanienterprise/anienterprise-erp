import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, SearchIcon, PlusIcon, EyeIcon, PDFIcon, FileTextIcon
} from '../../Icons';
import { generatePIPDF } from '../../../utils/pipdfgenerator';
import { generatePI2PDF } from '../../../utils/pi2pdfgenerator';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import { decryptData } from '../../../utils/encryption';
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
    const DEFAULT_DESC_GOODS = "Insurance to be covered by the opener.\nPartial Bill & Partial Payment be allowed.\nNegotiation is unrestricted in any Bank in India.\nAll Foreign Bank Charges outside India are on account of Importer.\n\nTRANSHIPMENT: ALLOWED\nPARTIAL SHIPMENT: ALLOWED";
    const DEFAULT_DECLARATION = "1. Deliveries age quoted in good faith, however we shall not be responsible for delays due to reasons beyond our control.\n2. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
    const STYLE2_DECLARATION = "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\nWe do certify that we have no local agent in Bangladesh and the quoted price is net and no commission is payable.";

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
    const [lcRecords, setLcRecords] = useState([]);
    const [allStockRecords, setAllStockRecords] = useState([]);
    const [allSalesRecords, setAllSalesRecords] = useState([]);
    const [preCarriages, setPreCarriages] = useState([]);
    const [receiptPlaces, setReceiptPlaces] = useState([]);
    const [vessels, setVessels] = useState([]);
    const [countries, setCountries] = useState([]);
    const [certifications, setCertifications] = useState([]);
    const [certSearch, setCertSearch] = useState('');
    const [packingTypes, setPackingTypes] = useState([]);
    const [packSearch, setPackSearch] = useState('');
    const [ipSearch, setIpSearch] = useState('');
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [toast, setToast] = useState(null);
    const [expandedCardId, setExpandedCardId] = useState(null);
    const [showReviseForm, setShowReviseForm] = useState(false);
    const [selectedRevisePiId, setSelectedRevisePiId] = useState('');
    const [reviseSearchQuery, setReviseSearchQuery] = useState('');
    const [isReviseSaving, setIsReviseSaving] = useState(false);
    const [reviseIpSearch, setReviseIpSearch] = useState('');
    const [reviseFormData, setReviseFormData] = useState({
        reviseNo: '',
        reviseDate: '',
        validityDate: '',
        placeOfReceipt: '',
        portOfLoading: '',
        portOfDischarge: '',
        certification: '',
        productsList: [],
        grandTotal: '',
        grandTotalQuantity: '',
        remarks: '',
        ipNumbers: []
    });
    const [viewHistoryRecord, setViewHistoryRecord] = useState(null);
    const [activeHistoryIndex, setActiveHistoryIndex] = useState(0);
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
        grandTotalQuantity: '',
        productsList: [{ productName: '', hsCode: '', quantity: '', rate: '', amount: '', freight: '', totalFreight: '' }],
        invoiceStyle: 'Style 1 SAA',
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
        ipNumbers: [],
        ipNumber: '',
        ipQuantity: '',
        ipDate: '',
        marksNo: '',
        noKindPackage: '',
        descriptionGoods: DEFAULT_DESC_GOODS,
        termsDeliveryPayment: 'CPT [PORT OF DISCHARGE], BANGLADESH, BY ROAD, BY TRUCK AGAINST 100% Irrevocable at Sight Letter of Credit valid for 90 days & Negotiable within 21 days of Shipment.\nPacking: Export Standard P.P/Gunny Bags.',
        declaration: DEFAULT_DECLARATION,
        status: 'Active',
        certification: 'Value & Quantity, Country of Origin',
        packingType: ''
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
    const certificationRef = useRef(null);
    const packingTypeRef = useRef(null);
    const statusRef = useRef(null);
    const invoiceStyleRef = useRef(null);
    const revisePiRef = useRef(null);

    useEffect(() => {
        fetchRecords();
        fetchMetaData('preCarriage', setPreCarriages);
        fetchMetaData('receiptPlace', setReceiptPlaces);
        fetchMetaData('vessel', setVessels);
        fetchMetaData('country', setCountries);
        fetchMetaData('certification', setCertifications);
        fetchMetaData('packingType', setPackingTypes);
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
            const [piRes, bankRes, ipRes, lcRes, stockRes, saleRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/ip-records`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`)
            ]);
            setRecords(Array.isArray(piRes.data) ? piRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
            setIpRecords(Array.isArray(ipRes.data) ? ipRes.data : []);
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);

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
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Helpers for IP balance calculation
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    // Compute IP Balance: IP Qty - actual consumption (stock receipts + border sales)
    const computeIpBalance = useMemo(() => {
        const balanceMap = {};
        ipRecords.forEach(ip => {
            const ipNoClean = cleanLc(ip.ipNumber);
            const relatedLcs = lcRecords.filter(lc => cleanLc(lc.ipNo) === ipNoClean);
            const lcNumbers = relatedLcs.map(lc => cleanLc(lc.lcNo));

            const ipReceiptsMap = {};
            allStockRecords.forEach(s => {
                const sLcClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                if (lcNumbers.includes(sLcClean) && (status === 'accepted' || status === 'in stock')) {
                    const rawDate = s.date || s.receiveDate || s.createdAt || '';
                    const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                    const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
                    const key = `${sLcClean}_${dateStr}_${groupVal}`;
                    if (!ipReceiptsMap[key]) {
                        const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                        ipReceiptsMap[key] = parseNum(s.totalLcQuantity) || itemSubtotal || parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                    } else {
                        if (!s.totalLcQuantity) {
                            ipReceiptsMap[key] += parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                        }
                    }
                }
            });
            let totalConsumption = Object.values(ipReceiptsMap).reduce((sum, qty) => sum + qty, 0);

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

            balanceMap[ip.ipNumber] = (parseNum(ip.quantity) || 0) - totalConsumption;
        });
        return balanceMap;
    }, [ipRecords, lcRecords, allStockRecords, allSalesRecords]);

    const calculatedGrandTotalQuantity = useMemo(() => {
        if (!formData.productsList || formData.productsList.length === 0) return 0;
        return formData.productsList.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    }, [formData.productsList]);

    const calculatedGrandTotal = useMemo(() => {
        if (!formData.productsList || formData.productsList.length === 0) return 0;
        return formData.productsList.reduce((sum, item) => {
            const q = parseFloat(item.quantity) || 0;
            const r = parseFloat(item.rate) || 0;
            const f = parseFloat(item.freight) || 0;
            return sum + (q * r) + (q * f);
        }, 0);
    }, [formData.productsList]);

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
                updated.grandTotalQuantity = q > 0 ? q.toFixed(2) : '';
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
                if (updated.termsDeliveryPayment) {
                    updated.termsDeliveryPayment = updated.termsDeliveryPayment.replace(/(CPT\s+[^,]+,\s*)([^,]+)(,)/i, `$1${value.toUpperCase()}$3`);
                }
            }

            if (name === 'portOfDischarge' && updated.termsDeliveryPayment) {
                updated.termsDeliveryPayment = updated.termsDeliveryPayment.replace(/CPT\s+([^,]+),/i, `CPT ${value.toUpperCase()},`);
            }

            return updated;
        });
    };

    const handleProductFieldChange = (idx, field, value) => {
        setFormData(prev => {
            const list = [...(prev.productsList || [])];
            list[idx] = { ...list[idx], [field]: value };

            // Recalculate amounts
            const q = parseFloat(list[idx].quantity) || 0;
            const r = parseFloat(list[idx].rate) || 0;
            const f = parseFloat(list[idx].freight) || 0;

            const amt = q * r;
            const totalFreight = q * f;

            list[idx].amount = amt > 0 ? amt.toFixed(2) : '';
            list[idx].totalFreight = totalFreight > 0 ? totalFreight.toFixed(2) : '';

            // Calculate grand total of all products
            let grandTotalVal = 0;
            let grandTotalQuantityVal = 0;
            list.forEach(item => {
                const itemQ = parseFloat(item.quantity) || 0;
                const itemR = parseFloat(item.rate) || 0;
                const itemF = parseFloat(item.freight) || 0;
                grandTotalVal += (itemQ * itemR) + (itemQ * itemF);
                grandTotalQuantityVal += itemQ;
            });

            // Backward compatibility: keep root-level product fields updated with the first product
            const updated = {
                ...prev,
                productsList: list,
                grandTotal: grandTotalVal > 0 ? grandTotalVal.toFixed(2) : '',
                grandTotalQuantity: grandTotalQuantityVal > 0 ? grandTotalQuantityVal.toFixed(2) : ''
            };

            if (idx === 0) {
                updated.productName = list[0].productName || '';
                updated.hsCode = list[0].hsCode || '';
                updated.quantity = list[0].quantity || '';
                updated.rate = list[0].rate || '';
                updated.amount = list[0].amount || '';
                updated.freight = list[0].freight || '';
                updated.totalFreight = list[0].totalFreight || '';
            }

            return updated;
        });
    };

    const handleAddProduct = () => {
        setFormData(prev => {
            const currentList = prev.productsList || [];
            const updatedList = [
                ...currentList,
                {
                    productName: '',
                    hsCode: currentList.length > 0 ? currentList[0].hsCode : '',
                    quantity: '',
                    rate: '',
                    amount: '',
                    freight: currentList.length > 0 ? currentList[0].freight : '',
                    totalFreight: ''
                }
            ];
            return {
                ...prev,
                productsList: updatedList
            };
        });
    };

    const handleRemoveProduct = (idx) => {
        setFormData(prev => {
            const list = (prev.productsList || []).filter((_, i) => i !== idx);

            // Recalculate grand total
            let grandTotalVal = 0;
            let grandTotalQuantityVal = 0;
            list.forEach(item => {
                const itemQ = parseFloat(item.quantity) || 0;
                const itemR = parseFloat(item.rate) || 0;
                const itemF = parseFloat(item.freight) || 0;
                grandTotalVal += (itemQ * itemR) + (itemQ * itemF);
                grandTotalQuantityVal += itemQ;
            });

            const updated = {
                ...prev,
                productsList: list,
                grandTotal: grandTotalVal > 0 ? grandTotalVal.toFixed(2) : '',
                grandTotalQuantity: grandTotalQuantityVal > 0 ? grandTotalQuantityVal.toFixed(2) : ''
            };

            // Update root-level fields with the first item
            if (list.length > 0) {
                updated.productName = list[0].productName || '';
                updated.hsCode = list[0].hsCode || '';
                updated.quantity = list[0].quantity || '';
                updated.rate = list[0].rate || '';
                updated.amount = list[0].amount || '';
                updated.freight = list[0].freight || '';
                updated.totalFreight = list[0].totalFreight || '';
            } else {
                updated.productName = '';
                updated.hsCode = '';
                updated.quantity = '';
                updated.rate = '';
                updated.amount = '';
                updated.freight = '';
                updated.totalFreight = '';
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
            else if (category === 'certification') fetchMetaData(category, setCertifications);
            else if (category === 'packingType') fetchMetaData(category, setPackingTypes);
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
            else if (category === 'certification') fetchMetaData(category, setCertifications);
            else if (category === 'packingType') fetchMetaData(category, setPackingTypes);
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

            if (field === 'certification') {
                setCertSearch('');
                const currentCert = prev.certification || '';
                const parts = currentCert.split(',').map(s => s.trim()).filter(Boolean);
                const valueLower = value.toLowerCase();
                const matchedIndex = parts.findIndex(p => p.toLowerCase() === valueLower);
                if (matchedIndex > -1) {
                    // Remove if already selected
                    parts.splice(matchedIndex, 1);
                    updated.certification = parts.join(', ');
                } else {
                    // Add if not selected
                    parts.push(value);
                    updated.certification = parts.join(', ');
                }
            }

            if (field === 'packingType') {
                setPackSearch('');
                const currentPack = prev.packingType || '';
                const parts = currentPack.split(',').map(s => s.trim()).filter(Boolean);
                const valueLower = value.toLowerCase();
                const matchedIndex = parts.findIndex(p => p.toLowerCase() === valueLower);
                if (matchedIndex > -1) {
                    // Remove if already selected
                    parts.splice(matchedIndex, 1);
                    updated.packingType = parts.join(', ');
                } else {
                    // Add if not selected
                    parts.push(value);
                    updated.packingType = parts.join(', ');
                }
            }

            if (field === 'ipNumber') {
                const ip = ipRecords.find(i => i.ipNumber === value);
                if (ip) {
                    const currentIpNumbers = [...(prev.ipNumbers || [])];
                    const alreadySelected = currentIpNumbers.includes(value);

                    if (alreadySelected) {
                        // Remove IP and its product
                        const removedIndex = currentIpNumbers.indexOf(value);
                        currentIpNumbers.splice(removedIndex, 1);
                        updated.ipNumbers = currentIpNumbers;

                        // Remove corresponding product from productsList
                        const currentProducts = [...(prev.productsList || [])];
                        const prodIdx = currentProducts.findIndex(p => p._fromIp === value);
                        if (prodIdx > -1) {
                            currentProducts.splice(prodIdx, 1);
                        }
                        if (currentProducts.length === 0) {
                            currentProducts.push({ productName: '', hsCode: '', quantity: '', rate: '', amount: '', freight: '', totalFreight: '' });
                        }
                        updated.productsList = currentProducts;
                    } else {
                        // Add IP and its product
                        currentIpNumbers.push(value);
                        updated.ipNumbers = currentIpNumbers;

                        const product = products.find(p => p.name === ip.productName);
                        const hCode = product ? (product.hsCode || '') : '';
                        const hCodeInd = product ? (product.hsCodeInd || '') : '';

                        const newProduct = {
                            productName: ip.productName || '',
                            hsCode: hCode,
                            hsCodeInd: hCodeInd,
                            quantity: '',
                            rate: '',
                            amount: '',
                            freight: '',
                            totalFreight: '',
                            _fromIp: value
                        };

                        const currentProducts = [...(prev.productsList || [])];
                        // If only one empty product exists, replace it
                        if (currentProducts.length === 1 && !currentProducts[0].productName) {
                            updated.productsList = [newProduct];
                        } else {
                            updated.productsList = [...currentProducts, newProduct];
                        }

                        // Auto-fill party info from the first selected IP
                        if (currentIpNumbers.length === 1) {
                            updated.partyName = ip.ipParty || '';
                            const importer = importers.find(i => i.name === ip.ipParty);
                            if (importer) {
                                updated.partyAddress = importer.address || '';
                                updated.partyContact = importer.phone || '';
                            }
                        }
                    }

                    // Update ipNumber as comma-separated for backward compat
                    updated.ipNumber = updated.ipNumbers.join(', ');

                    // Sum all selected IPs' quantities
                    let totalIpQty = 0;
                    updated.ipNumbers.forEach(ipNum => {
                        const rec = ipRecords.find(i => i.ipNumber === ipNum);
                        if (rec) totalIpQty += parseFloat(rec.quantity) || 0;
                    });
                    updated.ipQuantity = totalIpQty > 0 ? totalIpQty.toString() : '';

                    // Use latest closing date
                    let latestDate = '';
                    updated.ipNumbers.forEach(ipNum => {
                        const rec = ipRecords.find(i => i.ipNumber === ipNum);
                        if (rec && rec.closeDate && rec.closeDate > latestDate) {
                            latestDate = rec.closeDate;
                        }
                    });
                    updated.ipDate = latestDate;

                    // Sync root-level fields from first product
                    const firstProd = (updated.productsList || [])[0];
                    if (firstProd) {
                        updated.productName = firstProd.productName || '';
                        updated.hsCode = firstProd.hsCode || '';
                    }
                }
                setIpSearch('');
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

            if (field === 'invoiceStyle') {
                if (value === 'Style 2 AAS') {
                    updated.descriptionGoods = "";
                    updated.declaration = STYLE2_DECLARATION;
                } else {
                    updated.descriptionGoods = DEFAULT_DESC_GOODS;
                    updated.declaration = DEFAULT_DECLARATION;
                }
            }

            if (field === 'portOfDischarge' && updated.termsDeliveryPayment) {
                updated.termsDeliveryPayment = updated.termsDeliveryPayment.replace(/CPT\s+([^,]+),/i, `CPT ${value.toUpperCase()},`);
            }

            if (field === 'countryFinalDest') {
                updated.finalDestination = value;
                if (updated.termsDeliveryPayment) {
                    updated.termsDeliveryPayment = updated.termsDeliveryPayment.replace(/(CPT\s+[^,]+,\s*)([^,]+)(,)/i, `$1${value.toUpperCase()}$3`);
                }
            }

            return updated;
        });
        if (field !== 'certification' && field !== 'packingType') {
            setActiveDropdown(null);
            setHighlightedIndex(-1);
        }
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

        const submissionData = {
            ...formData,
            grandTotal: calculatedGrandTotal > 0 ? calculatedGrandTotal.toFixed(2) : '',
            grandTotalQuantity: calculatedGrandTotalQuantity > 0 ? calculatedGrandTotalQuantity.toFixed(2) : ''
        };

        try {
            const url = editingId
                ? `${API_BASE_URL}/api/pi/${editingId}`
                : `${API_BASE_URL}/api/pi`;

            if (editingId) {
                await axios.put(url, submissionData);

                // Add persistent notification for PI Update
                if (addNotification) {
                    addNotification(
                        'PI Record Updated',
                        `PI No: ${formData.piNumber} has been updated by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }
            } else {
                await axios.post(url, submissionData);

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
            grandTotalQuantity: '',
            productsList: [{ productName: '', hsCode: '', quantity: '', rate: '', amount: '', freight: '', totalFreight: '' }],
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
            ipNumbers: [],
            ipNumber: '',
            ipQuantity: '',
            ipDate: '',
            marksNo: '',
            noKindPackage: '',
            descriptionGoods: DEFAULT_DESC_GOODS,
            termsDeliveryPayment: 'CPT BHOMRA, BANGLADESH, BY ROAD, BY TRUCK AGAINST 100% Confirm Irrevocable at Sight Letter of Credit valid for 90 days & Negotiable within 21 days of Shipment.\nPacking: Export Standard P.P/Gunny Bags.',
            declaration: DEFAULT_DECLARATION,
            status: 'Active',
            invoiceStyle: 'Style 1 SAA',
            certification: 'Value & Quantity, Country of Origin',
            packingType: ''
        });
        setEditingId(null);
        setSubmitStatus(null);
        setCertSearch('');
        setIpSearch('');
    };

    const handleEdit = (record) => {
        const loadedList = record.productsList && record.productsList.length > 0
            ? record.productsList
            : [{
                productName: record.productName || '',
                hsCode: record.hsCode || '',
                quantity: record.quantity || '',
                rate: record.rate || '',
                amount: record.amount || '',
                freight: record.freight || '',
                totalFreight: record.totalFreight || ''
            }];

        const parsedIpNumbers = record.ipNumbers || (record.ipNumber ? record.ipNumber.split(',').map(s => s.trim()).filter(Boolean) : []);

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
            grandTotalQuantity: record.grandTotalQuantity || '',
            productsList: loadedList,
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
            ipNumbers: parsedIpNumbers,
            ipNumber: record.ipNumber || '',
            ipQuantity: record.ipQuantity || '',
            ipDate: record.ipDate || '',
            marksNo: record.marksNo || '',
            noKindPackage: record.noKindPackage || '',
            descriptionGoods: record.descriptionGoods || '',
            termsDeliveryPayment: record.termsDeliveryPayment || 'CPT BHOMRA, BANGLADESH, BY ROAD, BY TRUCK AGAINST 100% Confirm Irrevocable at Sight Letter of Credit valid for 90 days & Negotiable within 21 days of Shipment.\nPacking: Export Standard P.P/Gunny Bags.',
            declaration: record.declaration || DEFAULT_DECLARATION,
            status: record.status || 'Active',
            invoiceStyle: record.invoiceStyle || 'Style 1 SAA',
            certification: record.certification || '',
            packingType: record.packingType || ''
        });
        setEditingId(record._id);
        setShowForm(true);
        setCertSearch('');
        setIpSearch('');
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

    const recalcReviseProducts = (list) => {
        let grandTotalVal = 0;
        let grandTotalQuantityVal = 0;
        const updatedList = (list || []).map(item => {
            const itemQ = parseFloat(item.quantity) || 0;
            const itemR = parseFloat(item.rate) || 0;
            const itemF = parseFloat(item.freight) || 0;
            const amount = itemQ * itemR;
            const totalFreight = itemQ * itemF;
            grandTotalVal += amount + totalFreight;
            grandTotalQuantityVal += itemQ;
            return {
                ...item,
                amount: amount > 0 ? amount.toFixed(2) : '',
                totalFreight: totalFreight > 0 ? totalFreight.toFixed(2) : ''
            };
        });
        return {
            list: updatedList,
            grandTotal: grandTotalVal > 0 ? grandTotalVal.toFixed(2) : '',
            grandTotalQuantity: grandTotalQuantityVal > 0 ? grandTotalQuantityVal.toFixed(2) : ''
        };
    };

    const getPiProductsList = (pi) => {
        if (pi.productsList && pi.productsList.length > 0) {
            return pi.productsList.map(p => ({ ...p }));
        }
        return [{
            productName: pi.productName || '',
            hsCode: pi.hsCode || '',
            quantity: pi.quantity || '',
            rate: pi.rate || '',
            amount: pi.amount || '',
            freight: pi.freight || '',
            totalFreight: pi.totalFreight || ''
        }];
    };

    const filteredPiRecordsForRevise = useMemo(() => {
        const q = (reviseSearchQuery || '').trim().toLowerCase();
        if (!q) return records;
        return records.filter(pi =>
            (pi.piNumber || '').toLowerCase().includes(q) ||
            (pi.partyName || '').toLowerCase().includes(q)
        );
    }, [reviseSearchQuery, records]);

    const selectedPiForRevise = useMemo(() => {
        if (!selectedRevisePiId) return null;
        return records.find(r => r._id === selectedRevisePiId) || null;
    }, [selectedRevisePiId, records]);

    const selectedPiReviseIpInfo = useMemo(() => {
        if (!selectedPiForRevise) return [];
        const ipNumbers = reviseFormData.ipNumbers || [];

        if (ipNumbers.length === 0) return [];

        return ipNumbers.map(ipNum => {
            const balance = computeIpBalance[ipNum];
            const ipRec = ipRecords.find(r => r.ipNumber === ipNum);
            const expiryDate = ipRec?.closeDate ? formatDate(ipRec.closeDate) : 'N/A';
            const balanceKg = balance !== undefined ? balance : null;
            return {
                ipNumber: ipNum,
                balance: balanceKg,
                balanceDisplay: balanceKg !== null ? `${balanceKg.toLocaleString('en-US')} kg` : 'N/A',
                expiryDisplay: expiryDate,
                isLowBalance: balanceKg !== null && balanceKg < 50000
            };
        });
    }, [selectedPiForRevise, reviseFormData.ipNumbers, computeIpBalance, ipRecords]);

    const resetReviseForm = () => {
        setShowReviseForm(false);
        setSelectedRevisePiId('');
        setReviseSearchQuery('');
        setReviseIpSearch('');
        setReviseFormData({
            reviseNo: '',
            reviseDate: '',
            validityDate: '',
            placeOfReceipt: '',
            portOfLoading: '',
            portOfDischarge: '',
            certification: '',
            packingType: '',
            productsList: [],
            grandTotal: '',
            grandTotalQuantity: '',
            remarks: '',
            ipNumbers: []
        });
    };

    const handleReviseDropdownSelect = (field, value) => {
        setReviseFormData(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'certification') {
                setCertSearch('');
                const currentCert = prev.certification || '';
                const parts = currentCert.split(',').map(s => s.trim()).filter(Boolean);
                const valueLower = value.toLowerCase();
                const matchedIndex = parts.findIndex(p => p.toLowerCase() === valueLower);
                if (matchedIndex > -1) {
                    // Remove if already selected
                    parts.splice(matchedIndex, 1);
                    updated.certification = parts.join(', ');
                } else {
                    // Add if not selected
                    parts.push(value);
                    updated.certification = parts.join(', ');
                }
            }

            if (field === 'packingType') {
                setPackSearch('');
                const currentPack = prev.packingType || '';
                const parts = currentPack.split(',').map(s => s.trim()).filter(Boolean);
                const valueLower = value.toLowerCase();
                const matchedIndex = parts.findIndex(p => p.toLowerCase() === valueLower);
                if (matchedIndex > -1) {
                    // Remove if already selected
                    parts.splice(matchedIndex, 1);
                    updated.packingType = parts.join(', ');
                } else {
                    // Add if not selected
                    parts.push(value);
                    updated.packingType = parts.join(', ');
                }
            }
            return updated;
        });
        setActiveDropdown(null);
    };

    const handleRevisePiSelect = (pi) => {
        setSelectedRevisePiId(pi._id);
        const nextNo = (pi.revisions || []).filter(r => r.reviseNo !== 'Original PI').length + 1;
        const ipNumbers = pi.ipNumbers?.length
            ? pi.ipNumbers
            : (pi.ipNumber
                ? pi.ipNumber.split(',').map(s => s.trim()).filter(Boolean)
                : []);

        const productsList = getPiProductsList(pi);
        const mappedProducts = productsList.map(prod => {
            if (prod._fromIp) return prod;
            const matchingIp = ipNumbers.find(ipNum => {
                const ipRec = ipRecords.find(r => r.ipNumber === ipNum);
                return ipRec && ipRec.productName === prod.productName;
            });
            if (matchingIp) {
                return { ...prod, _fromIp: matchingIp };
            }
            return prod;
        });

        const { list, grandTotal, grandTotalQuantity } = recalcReviseProducts(mappedProducts);
        setReviseFormData({
            reviseNo: `REVISE NO-${String(nextNo).padStart(2, '0')}`,
            reviseDate: new Date().toISOString().split('T')[0],
            validityDate: pi.validityDate ? pi.validityDate.split('T')[0] : '',
            placeOfReceipt: pi.placeOfReceipt || '',
            portOfLoading: pi.portOfLoading || '',
            portOfDischarge: pi.portOfDischarge || '',
            certification: pi.certification || '',
            packingType: pi.packingType || '',
            productsList: list,
            grandTotal,
            grandTotalQuantity,
            remarks: '',
            ipNumbers
        });
        setReviseSearchQuery(pi.piNumber || '');
        setReviseIpSearch('');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleReviseIpSelectToggle = (value) => {
        const ip = ipRecords.find(i => i.ipNumber === value);
        if (!ip) return;

        setReviseFormData(prev => {
            const currentIpNumbers = [...(prev.ipNumbers || [])];
            const alreadySelected = currentIpNumbers.includes(value);

            let updatedIpNumbers = [];
            let updatedProductsList = [...(prev.productsList || [])];

            if (alreadySelected) {
                // Remove IP
                updatedIpNumbers = currentIpNumbers.filter(num => num !== value);

                // Remove corresponding product from productsList
                let prodIdx = updatedProductsList.findIndex(p => p._fromIp === value);
                if (prodIdx === -1) {
                    prodIdx = updatedProductsList.findIndex(p => p.productName === ip.productName);
                }
                if (prodIdx > -1) {
                    updatedProductsList.splice(prodIdx, 1);
                }
                if (updatedProductsList.length === 0) {
                    updatedProductsList.push({ productName: '', hsCode: '', quantity: '', rate: '', amount: '', freight: '', totalFreight: '' });
                }
            } else {
                // Add IP
                updatedIpNumbers = [...currentIpNumbers, value];

                // Check if product is already in productsList to avoid duplicate products for the same IP
                const productExists = updatedProductsList.some(p =>
                    p._fromIp === value ||
                    (p.productName === ip.productName)
                );

                if (!productExists) {
                    const product = products.find(p => p.name === ip.productName);
                    const hCode = product ? (product.hsCode || '') : '';
                    const hCodeInd = product ? (product.hsCodeInd || '') : '';

                    const newProduct = {
                        productName: ip.productName || '',
                        hsCode: hCode,
                        hsCodeInd: hCodeInd,
                        quantity: '',
                        rate: '',
                        amount: '',
                        freight: '',
                        totalFreight: '',
                        _fromIp: value
                    };

                    if (updatedProductsList.length === 1 && !updatedProductsList[0].productName) {
                        updatedProductsList = [newProduct];
                    } else {
                        updatedProductsList = [...updatedProductsList, newProduct];
                    }
                }
            }

            const { list: recalculatedList, grandTotal, grandTotalQuantity } = recalcReviseProducts(updatedProductsList);

            return {
                ...prev,
                ipNumbers: updatedIpNumbers,
                productsList: recalculatedList,
                grandTotal,
                grandTotalQuantity
            };
        });
        setReviseIpSearch('');
    };

    const handleReviseProductChange = (idx, field, value) => {
        setReviseFormData(prev => {
            const list = [...(prev.productsList || [])];
            list[idx] = { ...list[idx], [field]: value };
            const { list: updatedList, grandTotal, grandTotalQuantity } = recalcReviseProducts(list);
            return { ...prev, productsList: updatedList, grandTotal, grandTotalQuantity };
        });
    };

    const handleReviseSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRevisePiId) {
            showToast('Please select a PI Number first.', 'error');
            return;
        }
        if (!reviseFormData.reviseNo || !reviseFormData.reviseDate) {
            showToast('Revise Number and Date are required.', 'error');
            return;
        }
        setIsReviseSaving(true);
        try {
            const pi = selectedPiForRevise;
            if (!pi) throw new Error('Selected PI not found');

            const updatedIpNumbers = reviseFormData.ipNumbers || [];
            const updatedIpNumberStr = updatedIpNumbers.join(', ');

            let totalIpQty = 0;
            updatedIpNumbers.forEach(ipNum => {
                const rec = ipRecords.find(i => i.ipNumber === ipNum);
                if (rec) totalIpQty += parseFloat(rec.quantity) || 0;
            });
            const updatedIpQuantity = totalIpQty > 0 ? totalIpQty.toString() : '';

            let latestDate = '';
            updatedIpNumbers.forEach(ipNum => {
                const rec = ipRecords.find(i => i.ipNumber === ipNum);
                if (rec && rec.closeDate && rec.closeDate > latestDate) {
                    latestDate = rec.closeDate;
                }
            });

            const newRevision = {
                reviseNo: reviseFormData.reviseNo,
                reviseDate: reviseFormData.reviseDate,
                validityDate: reviseFormData.validityDate,
                placeOfReceipt: reviseFormData.placeOfReceipt,
                portOfLoading: reviseFormData.portOfLoading,
                portOfDischarge: reviseFormData.portOfDischarge,
                certification: reviseFormData.certification,
                packingType: reviseFormData.packingType || '',
                productsList: reviseFormData.productsList,
                grandTotal: reviseFormData.grandTotal,
                grandTotalQuantity: reviseFormData.grandTotalQuantity,
                remarks: reviseFormData.remarks,
                ipNumbers: updatedIpNumbers,
                createdAt: new Date().toISOString()
            };

            const currentRevisions = [...(pi.revisions || [])];
            if (currentRevisions.length === 0) {
                const originalRevision = {
                    reviseNo: 'Original PI',
                    reviseDate: pi.date,
                    validityDate: pi.validityDate,
                    placeOfReceipt: pi.placeOfReceipt,
                    portOfLoading: pi.portOfLoading,
                    portOfDischarge: pi.portOfDischarge,
                    certification: pi.certification,
                    packingType: pi.packingType || '',
                    productsList: getPiProductsList(pi),
                    grandTotal: pi.grandTotal,
                    grandTotalQuantity: pi.grandTotalQuantity,
                    remarks: pi.remarks || '',
                    ipNumbers: pi.ipNumbers || (pi.ipNumber ? pi.ipNumber.split(',').map(s => s.trim()).filter(Boolean) : []),
                    createdAt: pi.createdAt || pi.date || new Date().toISOString()
                };
                currentRevisions.push(originalRevision);
            }

            const updatedPiData = {
                ...pi,
                ipNumbers: updatedIpNumbers,
                ipNumber: updatedIpNumberStr,
                ipQuantity: updatedIpQuantity,
                ipDate: latestDate,
                validityDate: reviseFormData.validityDate,
                placeOfReceipt: reviseFormData.placeOfReceipt,
                portOfLoading: reviseFormData.portOfLoading,
                portOfDischarge: reviseFormData.portOfDischarge,
                certification: reviseFormData.certification,
                packingType: reviseFormData.packingType || '',
                productsList: reviseFormData.productsList,
                grandTotal: reviseFormData.grandTotal,
                grandTotalQuantity: reviseFormData.grandTotalQuantity,
                piRevision: `${reviseFormData.reviseNo} DATE: ${formatDate(reviseFormData.reviseDate)}`,
                revisions: [...currentRevisions, newRevision]
            };

            await axios.put(`${API_BASE_URL}/api/pi/${selectedRevisePiId}`, updatedPiData);

            if (addNotification) {
                addNotification(
                    'PI Revised',
                    `PI No: ${pi.piNumber} has been revised (${reviseFormData.reviseNo}) by ${currentUser?.name || currentUser?.username}.`,
                    ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                );
            }
            showToast('PI revision saved successfully!', 'success');
            resetReviseForm();
            fetchRecords();
        } catch (error) {
            console.error('Error saving PI revision:', error);
            showToast('Failed to save PI revision', 'error');
        } finally {
            setIsReviseSaving(false);
        }
    };

    const filteredRecords = records.filter(record => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesProduct = (record.productName || '').toLowerCase().includes(query) ||
                (record.productsList && record.productsList.some(p => (p.productName || '').toLowerCase().includes(query)));
            return (record.piNumber || '').toLowerCase().includes(query) ||
                (record.partyName || '').toLowerCase().includes(query) ||
                matchesProduct;
        }
        return true;
    });

    const getHistoryTimeline = (record) => {
        if (!record) return [];
        const list = [];
        const revisions = record.revisions || [];
        const hasOriginal = revisions.some(r => r.reviseNo === 'Original PI');

        if (revisions.length === 0) {
            // Unrevised: just original PI using current fields
            list.push({
                reviseNo: 'Original PI',
                reviseDate: record.date,
                validityDate: record.validityDate,
                placeOfReceipt: record.placeOfReceipt || 'N/A',
                portOfLoading: record.portOfLoading || 'N/A',
                portOfDischarge: record.portOfDischarge || 'N/A',
                certification: record.certification || 'N/A',
                packingType: record.packingType || 'N/A',
                productsList: getPiProductsList(record),
                grandTotal: record.grandTotal,
                grandTotalQuantity: record.grandTotalQuantity,
                remarks: record.remarks || '',
                ipNumbers: record.ipNumbers || (record.ipNumber ? record.ipNumber.split(',').map(s => s.trim()).filter(Boolean) : []),
                isOriginal: true
            });
        } else {
            // Revised:
            if (!hasOriginal) {
                // Synthesize the Original PI for old records if it was not stored
                list.push({
                    reviseNo: 'Original PI',
                    reviseDate: record.date,
                    validityDate: 'N/A (Historical)',
                    placeOfReceipt: 'N/A (Historical)',
                    portOfLoading: 'N/A (Historical)',
                    portOfDischarge: 'N/A (Historical)',
                    certification: 'N/A (Historical)',
                    packingType: 'N/A (Historical)',
                    productsList: [],
                    grandTotal: 'N/A',
                    grandTotalQuantity: 'N/A',
                    remarks: 'Historical original values were not captured prior to first revision.',
                    ipNumbers: [],
                    isOriginal: true,
                    isPlaceholder: true
                });
            }

            revisions.forEach(rev => {
                list.push({
                    ...rev,
                    ipNumbers: rev.ipNumbers || (rev.ipNumber ? rev.ipNumber.split(',').map(s => s.trim()).filter(Boolean) : (record.ipNumbers || (record.ipNumber ? record.ipNumber.split(',').map(s => s.trim()).filter(Boolean) : []))),
                    isOriginal: rev.reviseNo === 'Original PI'
                });
            });
        }
        return list;
    };

    return (
        <div className="pi-management space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm && !showReviseForm ? (
                    <>
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
                    </>
                ) : (
                    <div className="hidden md:block md:flex-1"></div>
                )}

                {!showForm && !showReviseForm && canManage && (
                    <div className="w-full md:w-auto flex flex-row justify-end gap-2 sm:gap-3 z-10">
                        <button
                            onClick={() => setShowReviseForm(true)}
                            className="flex-1 md:flex-none px-4 py-2 border border-blue-200 bg-blue-50/10 hover:bg-blue-50/50 text-blue-600 font-bold rounded-xl transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap text-sm h-[40px]"
                        >
                            <FileTextIcon className="w-4 h-4 mr-1.5 text-blue-500" />
                            <span>PI Revise</span>
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap h-[40px]"
                        >
                            <span className="mr-1.5 font-bold text-lg leading-none">+</span> Add New
                        </button>
                    </div>
                )}
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
                        {/* --- IP Section --- */}
                        <div className="col-span-full space-y-4">
                            {/* IP Search Input */}
                            <div className="space-y-2 relative dropdown-container max-w-md" ref={ipNumberRef}>
                                <label className="text-sm font-medium text-gray-700">IP Search & Selection</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="ipSearch"
                                        value={ipSearch}
                                        onChange={(e) => { setIpSearch(e.target.value); setActiveDropdown('ipNumber'); setHighlightedIndex(-1); }}
                                        onFocus={() => { setActiveDropdown('ipNumber'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'ipNumber', ipRecords.filter(ip => !ipSearch || ip.ipNumber.toLowerCase().includes(ipSearch.toLowerCase())), 'ipNumber')}
                                        placeholder="Search & Select IP Numbers..."
                                        autoComplete="off"
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                    {activeDropdown === 'ipNumber' && (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                            {ipRecords.filter(ip => !ipSearch || ip.ipNumber.toLowerCase().includes(ipSearch.toLowerCase())).map((ip, idx) => {
                                                const isSelected = formData.ipNumbers && formData.ipNumbers.includes(ip.ipNumber);
                                                return (
                                                    <button
                                                        key={ip._id}
                                                        type="button"
                                                        onMouseDown={() => handleDropdownSelect('ipNumber', ip.ipNumber)}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{ip.ipNumber}</span>
                                                            <span className="text-[10px] text-gray-500">{ip.ipParty} • {ip.productName}</span>
                                                        </div>
                                                        {isSelected && (
                                                            <span className="text-blue-600 font-bold text-sm">✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Selected IPs Rows */}
                            {formData.ipNumbers && formData.ipNumbers.length > 0 && (
                                <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-200/40">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selected Import Permits (IP)</h4>
                                    <div className="space-y-2">
                                        {formData.ipNumbers.map((ipNum) => {
                                            const ipRec = ipRecords.find(i => i.ipNumber === ipNum);
                                            const qty = ipRec?.quantity || '';
                                            const closeDate = ipRec?.closeDate ? formatDate(ipRec.closeDate) : '';
                                            return (
                                                <div key={ipNum} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                    <div className="flex-1 min-w-[150px]">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">IP Number</label>
                                                        <span className="text-sm font-semibold text-gray-800">{ipNum}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-[120px]">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">IP Quantity</label>
                                                        <span className="text-sm font-medium text-gray-700">{qty}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-[120px]">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">IP Balance</label>
                                                        {(() => {
                                                            const balance = computeIpBalance[ipNum];
                                                            const hasBalance = balance !== undefined;
                                                            const isLow = hasBalance && balance < 50000;
                                                            return (
                                                                <span className={`text-sm font-bold ${!hasBalance ? 'text-gray-400' :
                                                                    isLow ? 'text-red-600' : 'text-emerald-600'
                                                                    }`}>
                                                                    {hasBalance ? balance.toLocaleString('en-US') + ' Kg' : '—'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex-1 min-w-[120px]">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase">IP Closing Date</label>
                                                        <span className="text-sm font-medium text-gray-700">{closeDate || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDropdownSelect('ipNumber', ipNum)}
                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
                                                            title="Remove IP"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

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
                        </div>                        {/* --- Products List Section --- */}
                        <div className="md:col-span-3 col-span-1 space-y-4">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    Product Details
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleAddProduct}
                                    className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:scale-105 transition-all duration-200"
                                    title="Add Product"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {(formData.productsList || [{ productName: '', hsCode: '', quantity: '', rate: '', amount: '', freight: '', totalFreight: '' }]).map((item, idx) => (
                                    <div key={idx} className="p-5 bg-gray-50/50 border border-gray-200/60 rounded-2xl relative space-y-4 transition-all duration-200">
                                        <div className="flex items-center justify-between border-b border-gray-200/50 pb-2">
                                            <span className="text-sm font-bold text-gray-700">Product #{idx + 1}</span>
                                            {formData.productsList && formData.productsList.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveProduct(idx)}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
                                                    title="Remove Product"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Product Name */}
                                            <div className="space-y-2 relative dropdown-container">
                                                <label className="text-sm font-medium text-gray-700">Product Name</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={item.productName}
                                                        onChange={(e) => {
                                                            handleProductFieldChange(idx, 'productName', e.target.value);
                                                            setActiveDropdown(`product_${idx}`);
                                                            setHighlightedIndex(-1);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDropdown(`product_${idx}`);
                                                            setHighlightedIndex(-1);
                                                        }}
                                                        onKeyDown={(e) => handleDropdownKeyDown(e, `product_${idx}`, products.filter(p => !item.productName || p.name.toLowerCase().includes(item.productName.toLowerCase())), 'productName')}
                                                        placeholder="Search Product..."
                                                        required
                                                        autoComplete="off"
                                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                                    />
                                                    {activeDropdown === `product_${idx}` && (
                                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {products.filter(p => !item.productName || p.name.toLowerCase().includes(item.productName.toLowerCase())).map((p, pIdx) => (
                                                                <button
                                                                    key={p._id}
                                                                    type="button"
                                                                    onMouseDown={() => {
                                                                        handleProductFieldChange(idx, 'productName', p.name);
                                                                        handleProductFieldChange(idx, 'hsCode', p.hsCode || '');
                                                                        handleProductFieldChange(idx, 'hsCodeInd', p.hsCodeInd || '');
                                                                        setActiveDropdown(null);
                                                                    }}
                                                                    onMouseEnter={() => setHighlightedIndex(pIdx)}
                                                                    className={`w-full px-4 py-2 text-left text-sm ${highlightedIndex === pIdx || item.productName === p.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* HS Code */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">HS Code</label>
                                                <input
                                                    type="text"
                                                    value={item.hsCode}
                                                    onChange={(e) => handleProductFieldChange(idx, 'hsCode', e.target.value)}
                                                    maxLength="10"
                                                    placeholder="10-digit HS Code"
                                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            {/* Quantity (KG) */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Quantity (KG)</label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleProductFieldChange(idx, 'quantity', e.target.value)}
                                                    required
                                                    placeholder="0.00"
                                                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            {/* Rate Per KG */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Rate Per KG (US $)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.rate}
                                                        onChange={(e) => handleProductFieldChange(idx, 'rate', e.target.value)}
                                                        required
                                                        step="0.001"
                                                        placeholder="0.00"
                                                        className="w-full pl-8 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Freight Per KG */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Freight Per KG (US $)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.freight}
                                                        onChange={(e) => handleProductFieldChange(idx, 'freight', e.target.value)}
                                                        step="0.001"
                                                        placeholder="0.00"
                                                        className="w-full pl-8 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </div>

                                            {/* Total Freight */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Total Freight (US $)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.totalFreight}
                                                        readOnly
                                                        placeholder="0.00"
                                                        className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none cursor-not-allowed font-medium text-gray-600"
                                                    />
                                                </div>
                                            </div>

                                            {/* Total Amount */}
                                            <div className="space-y-2 md:col-span-3">
                                                <label className="text-sm font-medium text-gray-700">Total Amount (US $)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        value={item.amount}
                                                        readOnly
                                                        placeholder="0.00"
                                                        className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none cursor-not-allowed font-bold text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
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
                            <label className="text-sm font-medium text-blue-700 font-bold">Grand Total Quantity</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="grandTotalQuantity"
                                    value={calculatedGrandTotalQuantity ? calculatedGrandTotalQuantity.toLocaleString('en-US') + ' KG' : '0 KG'}
                                    readOnly
                                    className="w-full px-4 py-2 bg-blue-50/50 border border-blue-200/60 rounded-lg outline-none font-bold text-blue-700 transition-all cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 font-bold text-blue-700">Grand Total (US $)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-bold">$</span>
                                <input
                                    type="text"
                                    name="grandTotal"
                                    value={calculatedGrandTotal > 0 ? '$ ' + parseFloat(calculatedGrandTotal.toFixed(2)).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '$ 0.00'}
                                    readOnly
                                    placeholder="0.00"
                                    className="w-full pl-8 pr-4 py-2 bg-blue-50/50 border border-blue-200/60 rounded-lg outline-none font-bold text-blue-700 transition-all cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 relative dropdown-container" ref={certificationRef}>
                            <label className="text-sm font-medium text-gray-700 font-bold text-blue-700">Certification</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="certification"
                                    value={formData.certification}
                                    onChange={(e) => {
                                        handleInputChange(e);
                                        setActiveDropdown('certification');
                                        setHighlightedIndex(-1);
                                        const val = e.target.value;
                                        const lastPart = val.split(',').pop().trim();
                                        setCertSearch(lastPart);
                                    }}
                                    onFocus={() => { setActiveDropdown('certification'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'certification', certifications.filter(v => !certSearch || v.value.toLowerCase().includes(certSearch.toLowerCase())), 'certification')}
                                    autoComplete="off"
                                    placeholder="e.g. ISO 9001:2015"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddQuickMetaData('certification', formData.certification)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                    title="Add new certification"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                                {activeDropdown === 'certification' && (() => {
                                    const defaultCerts = [
                                        { _id: 'default-packing', value: 'Packing', isDefault: true },
                                        { _id: 'default-valqty', value: 'Value & Quantity', isDefault: true },
                                        { _id: 'default-coo', value: 'Country of Origin', isDefault: true }
                                    ];
                                    const merged = [...defaultCerts];
                                    certifications.forEach(cert => {
                                        if (!merged.some(d => d.value.toLowerCase() === cert.value.toLowerCase())) {
                                            merged.push(cert);
                                        }
                                    });
                                    const filtered = merged.filter(v => !certSearch || v.value.toLowerCase().includes(certSearch.toLowerCase()));
                                    return (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                            {filtered.map((v, idx) => {
                                                const selectedParts = (formData.certification || '').split(',').map(p => p.trim()).filter(Boolean);
                                                const isSelected = selectedParts.some(p => p.toLowerCase() === v.value.toLowerCase());
                                                return (
                                                    <div key={v._id} className="flex items-center group">
                                                        <button
                                                            key={v._id}
                                                            type="button"
                                                            onMouseDown={() => handleDropdownSelect('certification', v.value)}
                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                            className={`flex-1 px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                        >
                                                            <span>{v.value}</span>
                                                            {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                                                        </button>
                                                        {!v.isDefault && (
                                                            <button
                                                                type="button"
                                                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('certification', v._id); }}
                                                                className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="Delete this certification"
                                                            >
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Conditional Packing Type Field */}
                        {(() => {
                            const isPackingSelected = (formData.certification || '').split(',').map(s => s.trim().toLowerCase()).includes('packing');
                            if (!isPackingSelected) return null;
                            return (
                                <div className="space-y-2 relative dropdown-container" ref={packingTypeRef}>
                                    <label className="text-sm font-medium text-gray-700 font-bold text-blue-700">Packing Type</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="packingType"
                                            value={formData.packingType || ''}
                                            onChange={(e) => {
                                                handleInputChange(e);
                                                setActiveDropdown('packingType');
                                                setHighlightedIndex(-1);
                                                const val = e.target.value;
                                                const lastPart = val.split(',').pop().trim();
                                                setPackSearch(lastPart);
                                            }}
                                            onFocus={() => { setActiveDropdown('packingType'); setHighlightedIndex(-1); }}
                                            onKeyDown={(e) => handleDropdownKeyDown(e, 'packingType', packingTypes.filter(v => !packSearch || v.value.toLowerCase().includes(packSearch.toLowerCase())), 'packingType')}
                                            autoComplete="off"
                                            placeholder="e.g. Export Standard P.P Bags"
                                            className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddQuickMetaData('packingType', formData.packingType)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 p-1"
                                            title="Add new packing type"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                        {activeDropdown === 'packingType' && (() => {
                                            const defaultPacks = [
                                                { _id: 'default-ppbags', value: 'Export Standard P.P Bags', isDefault: true },
                                                { _id: 'default-gunnybags', value: 'Gunny Bags', isDefault: true },
                                                { _id: 'default-jutebags', value: 'Jute Bags', isDefault: true }
                                            ];
                                            const merged = [...defaultPacks];
                                            packingTypes.forEach(pack => {
                                                if (!merged.some(d => d.value.toLowerCase() === pack.value.toLowerCase())) {
                                                    merged.push(pack);
                                                }
                                            });
                                            const filtered = merged.filter(v => !packSearch || v.value.toLowerCase().includes(packSearch.toLowerCase()));
                                            return (
                                                <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {filtered.map((v, idx) => {
                                                        const selectedParts = (formData.packingType || '').split(',').map(p => p.trim()).filter(Boolean);
                                                        const isSelected = selectedParts.some(p => p.toLowerCase() === v.value.toLowerCase());
                                                        return (
                                                            <div key={v._id} className="flex items-center group">
                                                                <button
                                                                    key={v._id}
                                                                    type="button"
                                                                    onMouseDown={() => handleDropdownSelect('packingType', v.value)}
                                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                                    className={`flex-1 px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                >
                                                                    <span>{v.value}</span>
                                                                    {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                                                                </button>
                                                                {!v.isDefault && (
                                                                    <button
                                                                        type="button"
                                                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteQuickMetaData('packingType', v._id); }}
                                                                        className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                        title="Delete this packing type"
                                                                    >
                                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="space-y-2 relative dropdown-container" ref={invoiceStyleRef}>
                            <label className="text-sm font-medium text-gray-700 font-bold text-blue-700">Invoice Style</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setActiveDropdown(activeDropdown === 'invoiceStyle' ? null : 'invoiceStyle'); setHighlightedIndex(-1); }}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200/60 rounded-lg text-left focus:ring-2 focus:ring-blue-500 outline-none transition-all flex items-center justify-between"
                                >
                                    <span className="text-gray-900 font-medium">{formData.invoiceStyle || 'Style 1 SAA'}</span>
                                    <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                </button>
                                {activeDropdown === 'invoiceStyle' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1">
                                        {['Style 1 SAA', 'Style 2 AAS', 'Style 3'].map((styleName, idx) => (
                                            <button
                                                key={styleName}
                                                type="button"
                                                onMouseDown={() => handleDropdownSelect('invoiceStyle', styleName)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm ${formData.invoiceStyle === styleName ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {styleName}
                                            </button>
                                        ))}
                                    </div>
                                )}
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
            )}

            {showReviseForm && (
                <div className="pi-form relative rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-5 md:p-8 transition-all duration-300">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 relative z-30 border-b border-gray-200/40 pb-4">
                        <div className="flex items-center gap-2 shrink-0">
                            <FileTextIcon className="w-5 h-5 text-blue-500" />
                            <span className="text-base font-bold text-gray-800">PI Revise Registration</span>
                        </div>

                        <div className="flex-1 max-w-md w-full relative dropdown-container" ref={revisePiRef}>
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Search or select PI number..."
                                    value={reviseSearchQuery}
                                    onChange={(e) => {
                                        setReviseSearchQuery(e.target.value);
                                        setActiveDropdown('revisePi');
                                        setHighlightedIndex(-1);
                                    }}
                                    onFocus={() => {
                                        setActiveDropdown('revisePi');
                                        setHighlightedIndex(-1);
                                    }}
                                    className="w-full px-4 py-2 bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-center text-sm shadow-sm h-[38px]"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                            {activeDropdown === 'revisePi' && filteredPiRecordsForRevise.length > 0 && (
                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {filteredPiRecordsForRevise.map((pi) => (
                                        <button
                                            key={pi._id}
                                            type="button"
                                            onClick={() => handleRevisePiSelect(pi)}
                                            className="w-full px-4 py-2 text-center text-sm flex justify-between items-center hover:bg-blue-50 text-gray-700 font-semibold"
                                        >
                                            <span className="flex-1 text-center">{pi.piNumber}</span>
                                            <span className="text-xs text-gray-400 font-normal pr-4">{pi.partyName || '-'}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={resetReviseForm}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all group active:scale-95 shrink-0"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                    <form onSubmit={handleReviseSubmit} className="space-y-8 relative z-10 w-full">
                        {selectedRevisePiId && selectedPiForRevise && (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full text-left">
                                <div className="lg:col-span-1 space-y-6 bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
                                    <div>
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Current PI Details</h4>
                                        <div className="space-y-4">
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Number</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedPiForRevise.piNumber}</p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedPiForRevise.partyName}</p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedPiForRevise.exporterName}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Date</span>
                                                    <p className="text-sm font-bold text-gray-800 font-mono">{formatDate(selectedPiForRevise.date)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Validity</span>
                                                    <p className="text-sm font-bold text-rose-500 font-mono">{formatDate(selectedPiForRevise.validityDate)}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Qty</span>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {parseFloat(selectedPiForRevise.grandTotalQuantity || 0).toLocaleString('en-US')} kg
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Grand Total</span>
                                                    <p className="text-sm font-bold text-blue-600">${parseFloat(selectedPiForRevise.grandTotal || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 space-y-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Revise Details</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Revise Number *</label>
                                            <input
                                                type="text"
                                                value={reviseFormData.reviseNo}
                                                onChange={(e) => setReviseFormData(prev => ({ ...prev, reviseNo: e.target.value }))}
                                                placeholder="e.g. REVISE NO-01"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <CustomDatePicker
                                                label="Revise Date *"
                                                value={reviseFormData.reviseDate}
                                                onChange={(e) => setReviseFormData(prev => ({ ...prev, reviseDate: e.target.value }))}
                                                required
                                                compact={true}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <CustomDatePicker
                                                label="New Validity Date"
                                                value={reviseFormData.validityDate}
                                                onChange={(e) => setReviseFormData(prev => ({ ...prev, validityDate: e.target.value }))}
                                                compact={true}
                                            />
                                        </div>
                                    </div>

                                    {/* First Line: Place of Receipt, Port of Loading, Port of Discharge */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Place of Receipt */}
                                        <div className="space-y-1.5 relative dropdown-container">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Place of Receipt</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={reviseFormData.placeOfReceipt || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setReviseFormData(prev => ({ ...prev, placeOfReceipt: val }));
                                                        setActiveDropdown('reviseReceiptPlace');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    onFocus={() => {
                                                        setActiveDropdown('reviseReceiptPlace');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    placeholder="e.g. GHOJADANGA"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                    autoComplete="off"
                                                />
                                                {activeDropdown === 'reviseReceiptPlace' && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                        {receiptPlaces.filter(v => !reviseFormData.placeOfReceipt || v.value.toLowerCase().includes(reviseFormData.placeOfReceipt.toLowerCase())).map((v, idx) => (
                                                            <button
                                                                key={v._id}
                                                                type="button"
                                                                onMouseDown={() => handleReviseDropdownSelect('placeOfReceipt', v.value)}
                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || reviseFormData.placeOfReceipt === v.value ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                            >
                                                                {v.value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Port of Loading */}
                                        <div className="space-y-1.5 relative dropdown-container">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port of Loading</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={reviseFormData.portOfLoading || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setReviseFormData(prev => ({ ...prev, portOfLoading: val }));
                                                        setActiveDropdown('revisePortLoading');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    onFocus={() => {
                                                        setActiveDropdown('revisePortLoading');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    placeholder="Search Port of Loading..."
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                    autoComplete="off"
                                                />
                                                {activeDropdown === 'revisePortLoading' && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                        {ports.filter(p => p.isLoadingPort && (!reviseFormData.portOfLoading || p.name.toLowerCase().includes(reviseFormData.portOfLoading.toLowerCase()))).map((p, idx) => (
                                                            <button
                                                                key={p._id}
                                                                type="button"
                                                                onMouseDown={() => handleReviseDropdownSelect('portOfLoading', p.name)}
                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || reviseFormData.portOfLoading === p.name ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                            >
                                                                {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Port of Discharge */}
                                        <div className="space-y-1.5 relative dropdown-container">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port of Discharge</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={reviseFormData.portOfDischarge || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setReviseFormData(prev => ({ ...prev, portOfDischarge: val }));
                                                        setActiveDropdown('revisePortDischarge');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    onFocus={() => {
                                                        setActiveDropdown('revisePortDischarge');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    placeholder="Search Port of Discharge..."
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                    autoComplete="off"
                                                />
                                                {activeDropdown === 'revisePortDischarge' && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                        {ports.filter(p => !p.isLoadingPort && (!reviseFormData.portOfDischarge || p.name.toLowerCase().includes(reviseFormData.portOfDischarge.toLowerCase()))).map((p, idx) => (
                                                            <button
                                                                key={p._id}
                                                                type="button"
                                                                onMouseDown={() => handleReviseDropdownSelect('portOfDischarge', p.name)}
                                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                                className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || reviseFormData.portOfDischarge === p.name ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                            >
                                                                {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Second Line: IP Search & Selection, Certification */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* IP Search & Selection */}
                                        <div className="space-y-1.5 relative dropdown-container">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP Search & Selection</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={reviseIpSearch}
                                                    onChange={(e) => {
                                                        setReviseIpSearch(e.target.value);
                                                        setActiveDropdown('reviseIpNumber');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    onFocus={() => {
                                                        setActiveDropdown('reviseIpNumber');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    placeholder="Search & Select IP Numbers to Add..."
                                                    autoComplete="off"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-sm"
                                                />
                                                {activeDropdown === 'reviseIpNumber' && (
                                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                        {ipRecords.filter(ip => !reviseIpSearch || ip.ipNumber.toLowerCase().includes(reviseIpSearch.toLowerCase())).map((ip, idx) => {
                                                            const isSelected = reviseFormData.ipNumbers && reviseFormData.ipNumbers.includes(ip.ipNumber);
                                                            return (
                                                                <button
                                                                    key={ip._id}
                                                                    type="button"
                                                                    onMouseDown={() => handleReviseIpSelectToggle(ip.ipNumber)}
                                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                >
                                                                    <div className="flex flex-col text-left">
                                                                        <span className="font-bold">{ip.ipNumber}</span>
                                                                        <span className="text-[10px] text-gray-500">{ip.ipParty} • {ip.productName}</span>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <span className="text-blue-600 font-bold text-sm">✓</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Certification */}
                                        <div className="space-y-1.5 relative dropdown-container">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Certification</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={reviseFormData.certification || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setReviseFormData(prev => ({ ...prev, certification: val }));
                                                        setActiveDropdown('reviseCertification');
                                                        setHighlightedIndex(-1);
                                                        const lastPart = val.split(',').pop().trim();
                                                        setCertSearch(lastPart);
                                                    }}
                                                    onFocus={() => {
                                                        setActiveDropdown('reviseCertification');
                                                        setHighlightedIndex(-1);
                                                    }}
                                                    placeholder="e.g. Packing, Value & Quantity"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm pr-10"
                                                    autoComplete="off"
                                                />
                                                {activeDropdown === 'reviseCertification' && (() => {
                                                    const defaultCerts = [
                                                        { _id: 'default-packing', value: 'Packing', isDefault: true },
                                                        { _id: 'default-valqty', value: 'Value & Quantity', isDefault: true },
                                                        { _id: 'default-coo', value: 'Country of Origin', isDefault: true }
                                                    ];
                                                    const merged = [...defaultCerts];
                                                    certifications.forEach(cert => {
                                                        if (!merged.some(d => d.value.toLowerCase() === cert.value.toLowerCase())) {
                                                            merged.push(cert);
                                                        }
                                                    });
                                                    const filtered = merged.filter(v => !certSearch || v.value.toLowerCase().includes(certSearch.toLowerCase()));
                                                    return (
                                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                            {filtered.map((v, idx) => {
                                                                const selectedParts = (reviseFormData.certification || '').split(',').map(p => p.trim()).filter(Boolean);
                                                                const isSelected = selectedParts.some(p => p.toLowerCase() === v.value.toLowerCase());
                                                                return (
                                                                    <button
                                                                        key={v._id}
                                                                        type="button"
                                                                        onMouseDown={() => handleReviseDropdownSelect('certification', v.value)}
                                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                    >
                                                                        <span>{v.value}</span>
                                                                        {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conditional Packing Type Field for Revise Form */}
                                    {(() => {
                                        const isPackingSelected = (reviseFormData.certification || '').split(',').map(s => s.trim().toLowerCase()).includes('packing');
                                        if (!isPackingSelected) return null;
                                        return (
                                            <div className="mt-4 space-y-1.5 relative dropdown-container">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Packing Type</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={reviseFormData.packingType || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setReviseFormData(prev => ({ ...prev, packingType: val }));
                                                            setActiveDropdown('revisePackingType');
                                                            setHighlightedIndex(-1);
                                                            const lastPart = val.split(',').pop().trim();
                                                            setPackSearch(lastPart);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDropdown('revisePackingType');
                                                            setHighlightedIndex(-1);
                                                        }}
                                                        placeholder="e.g. Export Standard P.P Bags"
                                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm pr-10"
                                                        autoComplete="off"
                                                    />
                                                    {activeDropdown === 'revisePackingType' && (() => {
                                                        const defaultPacks = [
                                                            { _id: 'default-ppbags', value: 'Export Standard P.P Bags', isDefault: true },
                                                            { _id: 'default-gunnybags', value: 'Gunny Bags', isDefault: true },
                                                            { _id: 'default-jutebags', value: 'Jute Bags', isDefault: true }
                                                        ];
                                                        const merged = [...defaultPacks];
                                                        packingTypes.forEach(pack => {
                                                            if (!merged.some(d => d.value.toLowerCase() === pack.value.toLowerCase())) {
                                                                merged.push(pack);
                                                            }
                                                        });
                                                        const filtered = merged.filter(v => !packSearch || v.value.toLowerCase().includes(packSearch.toLowerCase()));
                                                        return (
                                                            <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                                {filtered.map((v, idx) => {
                                                                    const selectedParts = (reviseFormData.packingType || '').split(',').map(p => p.trim()).filter(Boolean);
                                                                    const isSelected = selectedParts.some(p => p.toLowerCase() === v.value.toLowerCase());
                                                                    return (
                                                                        <button
                                                                            key={v._id}
                                                                            type="button"
                                                                            onMouseDown={() => handleReviseDropdownSelect('packingType', v.value)}
                                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                                            className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${highlightedIndex === idx || isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                        >
                                                                            <span>{v.value}</span>
                                                                            {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* IP rows - one per IP number */}
                                    {selectedPiReviseIpInfo.length > 0 ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP</label>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP Balance</label>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP Expiry Date</label>
                                                <div className="w-8"></div>
                                            </div>
                                            {selectedPiReviseIpInfo.map((ipInfo, idx) => (
                                                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-center">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={ipInfo.ipNumber}
                                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-800 font-semibold text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={ipInfo.balanceDisplay}
                                                            className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-sm ${ipInfo.isLowBalance ? 'text-red-600' : 'text-emerald-600'
                                                                }`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={ipInfo.expiryDisplay}
                                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-red-600 font-bold text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 flex items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReviseIpSelectToggle(ipInfo.ipNumber)}
                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
                                                            title="Remove IP"
                                                        >
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP</label>
                                                <input type="text" readOnly value="N/A" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-400 text-sm" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP Balance</label>
                                                <input type="text" readOnly value="N/A" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-400 text-sm" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IP Expiry Date</label>
                                                <input type="text" readOnly value="N/A" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-400 text-sm" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product Updates</h5>
                                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                                            <table className="w-full text-left text-sm">
                                                <thead>
                                                    <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                        <th className="px-3 py-2">Product</th>
                                                        <th className="px-3 py-2">Qty (kg)</th>
                                                        <th className="px-3 py-2">Rate ($)</th>
                                                        <th className="px-3 py-2">Freight</th>
                                                        <th className="px-3 py-2">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {(reviseFormData.productsList || []).map((prod, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-3 py-2 font-semibold text-gray-700">{prod.productName || '-'}</td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    value={prod.quantity}
                                                                    onChange={(e) => handleReviseProductChange(idx, 'quantity', e.target.value)}
                                                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={prod.rate}
                                                                    onChange={(e) => handleReviseProductChange(idx, 'rate', e.target.value)}
                                                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={prod.freight}
                                                                    onChange={(e) => handleReviseProductChange(idx, 'freight', e.target.value)}
                                                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 font-bold text-blue-600">${parseFloat(prod.amount || 0).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="flex justify-end gap-6 text-sm font-bold">
                                            <span className="text-gray-500">Total Qty: {parseFloat(reviseFormData.grandTotalQuantity || 0).toLocaleString('en-US')} kg</span>
                                            <span className="text-blue-600">Grand Total: ${parseFloat(reviseFormData.grandTotal || 0).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={resetReviseForm}
                                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isReviseSaving}
                                            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isReviseSaving ? 'Saving...' : 'Save PI Revise'}
                                        </button>
                                    </div>
                                </div>

                                <div className="lg:col-span-1 space-y-6 bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
                                    <div>
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Current Products</h4>
                                        <div className="space-y-3">
                                            {getPiProductsList(selectedPiForRevise).map((prod, pIdx) => (
                                                <div key={pIdx} className="border-b border-gray-200/40 pb-2 last:border-0 last:pb-0">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                                        Item {getPiProductsList(selectedPiForRevise).length > 1 ? pIdx + 1 : ''}
                                                    </span>
                                                    <p className="text-xs font-bold text-gray-800 truncate" title={prod.productName}>{prod.productName || '-'}</p>
                                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                                        <div>
                                                            <span className="text-[8px] font-semibold text-gray-400 uppercase">Qty</span>
                                                            <p className="text-[11px] font-bold text-gray-700">{parseFloat(prod.quantity || 0).toLocaleString('en-US')} kg</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[8px] font-semibold text-gray-400 uppercase">Rate</span>
                                                            <p className="text-[11px] font-bold text-gray-700">${parseFloat(prod.rate || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {(selectedPiForRevise.revisions || []).length > 0 && (
                                            <div className="mt-6 pt-4 border-t border-gray-200/50">
                                                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Revision History</h5>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {(selectedPiForRevise.revisions || []).slice().reverse().map((rev, rIdx) => (
                                                        <div key={rIdx} className="text-[11px] bg-white rounded-lg p-2 border border-gray-100">
                                                            <p className="font-bold text-blue-600">{rev.reviseNo}</p>
                                                            <p className="text-gray-500">{formatDate(rev.reviseDate)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {!showForm && !showReviseForm && (
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
                                        filteredRecords.map(record => {
                                            const displayProducts = record.productsList && record.productsList.length > 0
                                                ? record.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                                : record.productName || 'N/A';

                                            const totalQty = record.productsList && record.productsList.length > 0
                                                ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
                                                : (parseFloat(record.grandTotalQuantity || record.quantity) || 0);

                                            return (
                                                <tr key={record._id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">{formatDate(record.revisions && record.revisions.length > 0 ? (record.revisions[record.revisions.length - 1].reviseDate || record.date) : record.date)}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-blue-600">
                                                        {record.piNumber}
                                                        {record.revisions && record.revisions.length > 0 ? ' (REVISED)' : ''}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 font-semibold">{record.partyName}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-700 font-semibold">{record.exporterName}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate" title={displayProducts}>{displayProducts}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 font-bold">{totalQty.toLocaleString('en-US')} kg</td>
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
                                                                    setViewHistoryRecord(record);
                                                                    const tl = getHistoryTimeline(record);
                                                                    setActiveHistoryIndex(tl.length > 1 ? tl.length - 1 : 0);
                                                                }}
                                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-90"
                                                                title="View History"
                                                            >
                                                                <EyeIcon className="w-5 h-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const enriched = {
                                                                        ...record,
                                                                        piNumber: record.revisions && record.revisions.length > 0 ? `${record.piNumber} (REVISED)` : record.piNumber,
                                                                        date: record.revisions && record.revisions.length > 0 ? (record.revisions[record.revisions.length - 1].reviseDate || record.date) : record.date
                                                                    };
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
                                                                    if (enriched.invoiceStyle === 'Style 2 AAS') {
                                                                        generatePI2PDF(enriched);
                                                                    } else {
                                                                        generatePIPDF(enriched);
                                                                    }
                                                                }}
                                                                className="p-2 text-gray-400 hover:text-blue-600 transition-all active:scale-90"
                                                                title="Download PDF"
                                                            >
                                                                <PDFIcon className="w-5 h-5" />
                                                            </button>
                                                            {canManage && (
                                                                <button
                                                                    onClick={() => handleDelete(record._id)}
                                                                    className="p-2 text-gray-400 hover:text-red-600 transition-all active:scale-90"
                                                                    title="Delete Record"
                                                                >
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
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
                                const displayProducts = record.productsList && record.productsList.length > 0
                                    ? record.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                    : record.productName || 'N/A';

                                const totalQty = record.productsList && record.productsList.length > 0
                                    ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
                                    : (parseFloat(record.grandTotalQuantity || record.quantity) || 0);

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
                                                    <span className="text-sm font-black text-gray-900 tracking-tight truncate">
                                                        {record.piNumber}
                                                        {record.revisions && record.revisions.length > 0 ? ' (REVISED)' : ''}
                                                    </span>
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
                                                        <span className="text-sm font-bold text-gray-700">{formatDate(record.revisions && record.revisions.length > 0 ? (record.revisions[record.revisions.length - 1].reviseDate || record.date) : record.date)}</span>
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
                                                        <span className="text-sm font-bold text-gray-700 truncate" title={displayProducts}>{displayProducts}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="w-[100px] text-[11px] font-black text-gray-400 uppercase tracking-widest shrink-0">Total Qty</span>
                                                        <span className="text-gray-400 font-bold mx-2">-</span>
                                                        <span className="text-sm font-bold text-gray-700">{totalQty.toLocaleString('en-US')} kg</span>
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
                                                            setViewHistoryRecord(record);
                                                            const tl = getHistoryTimeline(record);
                                                            setActiveHistoryIndex(tl.length > 1 ? tl.length - 1 : 0);
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                    >
                                                        <EyeIcon className="w-3.5 h-3.5" /> View
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const enriched = {
                                                                ...record,
                                                                piNumber: record.revisions && record.revisions.length > 0 ? `${record.piNumber} (REVISED)` : record.piNumber,
                                                                date: record.revisions && record.revisions.length > 0 ? (record.revisions[record.revisions.length - 1].reviseDate || record.date) : record.date
                                                            };
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
                                                            if (enriched.invoiceStyle === 'Style 2 AAS') {
                                                                generatePI2PDF(enriched);
                                                            } else {
                                                                generatePIPDF(enriched);
                                                            }
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                    >
                                                        <PDFIcon className="w-3.5 h-3.5" /> PDF
                                                    </button>
                                                    {canManage && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(record._id); }}
                                                            className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" /> Delete
                                                        </button>
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

            {/* History Explorer Modal */}
            {viewHistoryRecord && (() => {
                const timeline = getHistoryTimeline(viewHistoryRecord);
                const activeRevision = timeline[activeHistoryIndex] || timeline[0] || {};
                const activeProducts = activeRevision.productsList || [];
                const activeIps = activeRevision.ipNumbers || [];

                // Look up linked LC number for this PI
                const cleanPiNum = viewHistoryRecord.piNumber || '';
                const linkedLc = lcRecords.find(lc => {
                    const lcPi = (lc.piNo || '').replace(' (REVISED)', '');
                    return lcPi === cleanPiNum;
                });
                const linkedLcNo = linkedLc ? linkedLc.lcNo : null;

                return (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-2xl">
                                        <EyeIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Proforma Invoice History Explorer</h3>
                                        <p className="text-sm text-gray-500 font-medium">
                                            PI Number: <span className="font-bold text-blue-600 font-mono">{viewHistoryRecord.piNumber}{viewHistoryRecord.revisions && viewHistoryRecord.revisions.length > 0 && activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}</span>
                                            {' • '}Date: <span className="font-bold text-gray-800 font-mono">{formatDate(activeRevision.reviseDate || viewHistoryRecord.date)}</span>
                                            {linkedLcNo && (
                                                <>
                                                    {' • '}LC: <span className="font-bold text-emerald-600 font-mono">{linkedLcNo}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setViewHistoryRecord(null)}
                                    className="p-2 rounded-xl hover:bg-gray-200 text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 flex overflow-hidden min-h-0">
                                {/* Left Sidebar: Timeline */}
                                <div className="w-60 border-r border-gray-100 overflow-y-auto p-6 bg-gray-50/30 flex-shrink-0">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Revision Timeline</h4>
                                    <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-8">
                                        {timeline.map((rev, idx) => {
                                            const isActive = activeHistoryIndex === idx;
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => setActiveHistoryIndex(idx)}
                                                    className="relative cursor-pointer group"
                                                >
                                                    {/* Timeline Bullet */}
                                                    <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isActive
                                                        ? 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 scale-110 shadow-sm'
                                                        : 'bg-white border-gray-300 group-hover:border-blue-400 group-hover:scale-105'
                                                        }`} />

                                                    {/* Timeline Content Card */}
                                                    <div className={`p-4 rounded-2xl border transition-all ${isActive
                                                        ? 'bg-white border-blue-200 shadow-md shadow-blue-500/5'
                                                        : 'bg-white/50 border-gray-100 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                                                        }`}>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${rev.isOriginal
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'bg-amber-50 text-amber-700'
                                                            }`}>
                                                            {rev.reviseNo}
                                                        </span>
                                                        <p className="text-sm font-bold text-gray-800 mt-2">
                                                            {rev.isOriginal ? 'Initial Creation' : 'Revised State'}
                                                        </p>
                                                        <p className="text-sm font-medium text-gray-500 mt-1 font-mono">
                                                            {formatDate(rev.reviseDate)}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right Pane: Details */}
                                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                    {activeRevision.isPlaceholder ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 rounded-3xl border border-gray-100">
                                            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                                                <span className="text-2xl">⚠️</span>
                                            </div>
                                            <h4 className="text-base font-bold text-gray-800">Original PI Data</h4>
                                            <p className="text-sm text-gray-500 mt-2 max-w-md">
                                                This PI was revised prior to the deployment of the detailed history tracking system. Historical initial values were overwritten and are not fully accessible.
                                            </p>
                                            <p className="text-xs text-gray-400 mt-4">
                                                All subsequent revisions and updates are saved and fully trackable.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Details Section */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {/* Card 1: Logistics */}
                                                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Logistics & Route</h5>
                                                    <div className="space-y-3 text-sm">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Place of Receipt</span>
                                                            <span className="font-bold text-gray-800 mt-0.5 block">{activeRevision.placeOfReceipt || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Port of Loading</span>
                                                            <span className="font-bold text-gray-800 mt-0.5 block">{activeRevision.portOfLoading || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Port of Discharge</span>
                                                            <span className="font-bold text-gray-800 mt-0.5 block">{activeRevision.portOfDischarge || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 2: Dates & Certifications */}
                                                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Dates & Certification</h5>
                                                    <div className="space-y-3 text-sm">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Revise / Original Date</span>
                                                            <span className="font-bold text-gray-800 mt-0.5 block font-mono">{formatDate(activeRevision.reviseDate)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Validity Date</span>
                                                            <span className="font-bold text-rose-500 mt-0.5 block font-mono">{formatDate(activeRevision.validityDate)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Certification</span>
                                                            <div className="space-y-1">
                                                                {activeRevision.certification
                                                                    ? activeRevision.certification.split(',').map((cert, cIdx) => (
                                                                        <span key={cIdx} className="font-bold text-gray-800 block text-sm">{cert.trim()}</span>
                                                                    ))
                                                                    : <span className="font-bold text-gray-800 block text-sm">N/A</span>
                                                                }
                                                            </div>
                                                         {activeRevision.certification && activeRevision.certification.split(',').map(s => s.trim().toLowerCase()).includes('packing') && (
                                                             <div className="mt-3">
                                                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Packing Type</span>
                                                                 <div className="space-y-1">
                                                                     {activeRevision.packingType
                                                                         ? activeRevision.packingType.split(',').map((pack, pIdx) => (
                                                                             <span key={pIdx} className="font-bold text-gray-800 block text-sm">{pack.trim()}</span>
                                                                         ))
                                                                         : <span className="font-bold text-gray-800 block text-sm">N/A</span>
                                                                     }
                                                                 </div>
                                                             </div>
                                                         )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 3: IP Records, LC & Reference */}
                                                <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                                                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">IP Records, LC & Remarks</h5>
                                                    <div className="space-y-3 text-sm">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">LC Number</span>
                                                            {linkedLcNo ? (
                                                                <span className="text-sm font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100 font-mono inline-block mt-1">
                                                                    {linkedLcNo}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-500 font-bold text-sm">No LC Linked</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Import Permission (IP)</span>
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {activeIps.length > 0 ? (
                                                                    activeIps.map((ip, i) => (
                                                                        <span key={i} className="text-sm font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-100 font-mono">
                                                                            {ip}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-gray-500 font-bold text-sm">N/A</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remarks</span>
                                                            <p className="text-sm font-bold text-gray-800 mt-1 max-h-16 overflow-y-auto">{activeRevision.remarks || 'No remarks provided.'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Products Table */}
                                            <div className="space-y-3">
                                                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Products Breakdown</h5>
                                                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                                <th className="px-6 py-3">Product Name</th>
                                                                <th className="px-6 py-3">HS Code</th>
                                                                <th className="px-6 py-3 text-right">Quantity (kg)</th>
                                                                <th className="px-6 py-3 text-right">Rate ($)</th>
                                                                <th className="px-6 py-3 text-right">Freight</th>
                                                                <th className="px-6 py-3 text-right">Total Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50 text-sm">
                                                            {activeProducts.map((prod, pIdx) => (
                                                                <tr key={pIdx} className="hover:bg-gray-50/30">
                                                                    <td className="px-6 py-3.5 font-bold text-gray-800">{prod.productName || 'N/A'}</td>
                                                                    <td className="px-6 py-3.5 font-mono font-medium text-gray-500">{prod.hsCode || 'N/A'}</td>
                                                                    <td className="px-6 py-3.5 text-right font-semibold text-gray-700">{parseFloat(prod.quantity || 0).toLocaleString('en-US')} kg</td>
                                                                    <td className="px-6 py-3.5 text-right font-semibold text-gray-700">${parseFloat(prod.rate || 0).toFixed(2)}</td>
                                                                    <td className="px-6 py-3.5 text-right font-semibold text-gray-700">${parseFloat(prod.freight || 0).toFixed(2)}</td>
                                                                    <td className="px-6 py-3.5 text-right font-black text-blue-600">${parseFloat(prod.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Totals Summary Cards */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto pt-6">
                                                    {/* Total Quantity Card */}
                                                    <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-5 text-center shadow-sm">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Quantity</span>
                                                        <span className="text-xl font-black text-gray-900 mt-1 block">
                                                            {parseFloat(activeRevision.grandTotalQuantity || 0).toLocaleString('en-US')} kg
                                                        </span>
                                                    </div>
                                                    {/* Grand Total Card */}
                                                    <div className="bg-blue-600 text-white rounded-2xl p-5 text-center shadow-lg shadow-blue-500/20">
                                                        <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block">Grand Total Value</span>
                                                        <span className="text-xl font-black text-white mt-1 block">
                                                            ${parseFloat(activeRevision.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Action Buttons under Cards */}
                                                <div className="flex items-center justify-center gap-4 pt-6 pb-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const enriched = {
                                                                ...viewHistoryRecord,
                                                                ...activeRevision,
                                                                piNumber: `${viewHistoryRecord.piNumber}${activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}`
                                                            };

                                                            // Enrich exporter details if missing
                                                            if (!enriched.exporterAddress || !enriched.exporterEmail || !enriched.exporterSignature) {
                                                                const exp = exporters?.find(e => e.name === enriched.exporterName);
                                                                if (exp) {
                                                                    enriched.exporterAddress = enriched.exporterAddress || exp.address;
                                                                    enriched.exporterContact = enriched.exporterContact || exp.phone;
                                                                    enriched.exporterEmail = enriched.exporterEmail || exp.email;
                                                                    enriched.exporterSignature = enriched.exporterSignature || exp.signature;
                                                                }
                                                            }

                                                            // Enrich importer details if missing
                                                            if (!enriched.partyAddress || !enriched.partyEmail || !enriched.partySignature) {
                                                                const imp = importers?.find(i => i.name === enriched.partyName);
                                                                if (imp) {
                                                                    enriched.partyAddress = enriched.partyAddress || imp.address;
                                                                    enriched.partyContact = enriched.partyContact || imp.phone;
                                                                    enriched.partyEmail = enriched.partyEmail || imp.email;
                                                                    enriched.partySignature = enriched.partySignature || imp.signature;
                                                                }
                                                            }

                                                            if (enriched.invoiceStyle === 'Style 2 AAS') {
                                                                generatePI2PDF(enriched);
                                                            } else {
                                                                generatePIPDF(enriched);
                                                            }
                                                        }}
                                                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        <PDFIcon className="w-4 h-4 text-white" />
                                                        <span>Print PI PDF</span>
                                                    </button>
                                                    {canManage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setViewHistoryRecord(null);
                                                                if (activeRevision.reviseNo === 'Original PI') {
                                                                    handleEdit(viewHistoryRecord);
                                                                } else {
                                                                    setSelectedRevisePiId(viewHistoryRecord._id);
                                                                    setReviseSearchQuery(viewHistoryRecord.piNumber || '');
                                                                    setReviseIpSearch('');
                                                                    setActiveDropdown(null);
                                                                    setHighlightedIndex(-1);

                                                                    // Pre-fill reviseFormData with the specific activeRevision values
                                                                    setReviseFormData({
                                                                        reviseNo: activeRevision.reviseNo,
                                                                        reviseDate: activeRevision.reviseDate ? activeRevision.reviseDate.split('T')[0] : new Date().toISOString().split('T')[0],
                                                                        validityDate: activeRevision.validityDate && activeRevision.validityDate !== 'N/A (Historical)' ? activeRevision.validityDate.split('T')[0] : '',
                                                                        placeOfReceipt: activeRevision.placeOfReceipt && activeRevision.placeOfReceipt !== 'N/A (Historical)' ? activeRevision.placeOfReceipt : '',
                                                                        portOfLoading: activeRevision.portOfLoading && activeRevision.portOfLoading !== 'N/A (Historical)' ? activeRevision.portOfLoading : '',
                                                                        portOfDischarge: activeRevision.portOfDischarge && activeRevision.portOfDischarge !== 'N/A (Historical)' ? activeRevision.portOfDischarge : '',
                                                                        certification: activeRevision.certification && activeRevision.certification !== 'N/A (Historical)' ? activeRevision.certification : '',
                                                                        packingType: activeRevision.packingType && activeRevision.packingType !== 'N/A (Historical)' ? activeRevision.packingType : '',
                                                                        productsList: activeRevision.productsList || [],
                                                                        grandTotal: activeRevision.grandTotal !== 'N/A' ? activeRevision.grandTotal : 0,
                                                                        grandTotalQuantity: activeRevision.grandTotalQuantity !== 'N/A' ? activeRevision.grandTotalQuantity : 0,
                                                                        remarks: activeRevision.remarks && activeRevision.remarks !== 'Historical original values were not captured prior to first revision.' ? activeRevision.remarks : '',
                                                                        ipNumbers: activeRevision.ipNumbers || []
                                                                    });
                                                                    setShowReviseForm(true);
                                                                }
                                                            }}
                                                            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                                        >
                                                            <EditIcon className="w-4 h-4 text-gray-500" />
                                                            <span>Edit PI</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

export default PI;
