import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FunnelIcon, XIcon, ChevronDownIcon, EditIcon, TrashIcon, SearchIcon, PlusIcon, EyeIcon, PDFIcon
} from '../../Icons';
import { generatePLPDF } from '../../../utils/plpdfgenerator';
import { generatePL2PDF } from '../../../utils/pl2pdfgenerator';
import { preloadAlgerianFont } from '../../../utils/algerianFontLoader';
import { API_BASE_URL, formatDate } from '../../../utils/helpers';
import axios from '../../../utils/api';
import CustomDatePicker from '../../shared/CustomDatePicker';
import './PackingList.css';
import { hasPermission } from '../../../utils/permissionHelper';

const numberToWordsUSD = (amount) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convertChunk = (num) => {
        let s = '';
        if (num >= 100) { s += units[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
        if (num >= 10 && num <= 19) { s += teens[num - 10] + ' '; }
        else { if (num >= 20) { s += tens[Math.floor(num / 10)] + ' '; num %= 10; } if (num > 0) { s += units[num] + ' '; } }
        return s;
    };
    if (amount === 0) return 'US Dollar: Zero Only';
    const parts = amount.toFixed(2).split('.');
    let dollar = parseInt(parts[0]), cents = parseInt(parts[1]);
    let words = 'US Dollar: ';
    if (dollar === 0) { words += 'Zero '; } else {
        let tw = '';
        if (dollar >= 10000000) { tw += convertChunk(Math.floor(dollar / 10000000)) + 'Crore '; dollar %= 10000000; }
        if (dollar >= 100000) { tw += convertChunk(Math.floor(dollar / 100000)) + 'Lac '; dollar %= 100000; }
        if (dollar >= 1000) { tw += convertChunk(Math.floor(dollar / 1000)) + 'Thousand '; dollar %= 1000; }
        if (dollar > 0) { tw += convertChunk(dollar); }
        words += tw;
    }
    words += cents > 0 ? 'And Cents ' + convertChunk(cents) + 'Only' : 'Only';
    return words.replace(/\s+/g, ' ').trim();
};

const getRevName = (name) => {
    if (!name) return 'Original PI';
    if (name === 'Original PI') return 'Original PI';
    const match = name.match(/REVISE NO-(\d+)/i);
    return match ? `Revised ${parseInt(match[1])}` : name;
};

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
    const canAdd = hasPermission(currentUser, 'packingList', 'add');
    const canEdit = hasPermission(currentUser, 'packingList', 'edit');
    const canDelete = hasPermission(currentUser, 'packingList', 'delete');
    const canManage = canAdd || canEdit || canDelete;
    const isDataEntry = (currentUser?.role || '').toLowerCase() === 'data entry';

    const [showForm, setShowForm] = useState(false);
    const [records, setRecords] = useState([]);
    const [piRecords, setPiRecords] = useState([]);
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [ipRecords, setIpRecords] = useState([]);
    const [trSetups, setTrSetups] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [selectedPiRaw, setSelectedPiRaw] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [toast, setToast] = useState(null);
    const [expandedCardId, setExpandedCardId] = useState(null);

    // Auto-population dropdown state
    const [piSearchQuery, setPiSearchQuery] = useState('');

    const initialFilterDropdownState = {
        port: false,
        product: false,
        importer: false,
        exporter: false
    };

    const initialPlFilterState = {
        startDate: '',
        endDate: '',
        port: '',
        productName: '',
        importerName: '',
        exporterName: ''
    };

    const [plFilters, setPlFilters] = useState(initialPlFilterState);
    const [showPlFilterPanel, setShowPlFilterPanel] = useState(false);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        portSearch: '',
        productSearch: '',
        importerSearch: '',
        exporterSearch: ''
    });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);

    const plFilterPanelRef = useRef(null);
    const plFilterButtonRef = useRef(null);
    const portFilterRef = useRef(null);
    const productFilterRef = useRef(null);
    const importerFilterRef = useRef(null);
    const exporterFilterRef = useRef(null);

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
        productsList: [{ productName: '', hsCode: '', quantity: '', bagCount: '', packingType: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }],
        productsImage: '',
        productsText: '',
        partySignature: '',
        exporterSignature: '',
        trNumber: '',
        trDate: '',
        trName: '',
        demurrage: '03',
        days: '05',
        invoiceStyle: 'Style 2 AAS',
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
        buyerName: '',
        selectedRevisionNo: ''
    });

    useEffect(() => {
        fetchRecords();
        preloadAlgerianFont().catch(() => { });
    }, []);

    useEffect(() => {
        if (showForm) {
            fetchTrSetups();
        }
    }, [showForm]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeDropdown && !event.target.closest('.dropdown-container')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    // Click-outside detection for PL filter panel
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showPlFilterPanel &&
                plFilterPanelRef.current &&
                !plFilterPanelRef.current.contains(event.target) &&
                plFilterButtonRef.current &&
                !plFilterButtonRef.current.contains(event.target)
            ) {
                setShowPlFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPlFilterPanel]);

    // Click-outside detection for filter dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
            if (!openKey) return;

            let refsToCheck = [];
            if (openKey === 'port') {
                refsToCheck = [portFilterRef];
            } else if (openKey === 'exporter') {
                refsToCheck = [exporterFilterRef];
            } else if (openKey === 'importer') {
                refsToCheck = [importerFilterRef];
            } else if (openKey === 'product') {
                refsToCheck = [productFilterRef];
            }

            const isOutside = refsToCheck.every(ref => !ref.current || !ref.current.contains(event.target));
            if (isOutside) {
                setFilterDropdownOpen(initialFilterDropdownState);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [filterDropdownOpen]);

    const getFilteredOptions = (type) => {
        let options = [];
        let search = '';

        switch (type) {
            case 'plFilterPort':
                options = [...new Set(records.flatMap(r => [r.port, r.portOfDischarge, r.portOfLoading]).map(p => (p || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.portSearch;
                break;
            case 'plFilterExporter':
                options = [...new Set(records.map(r => (r.exporterName || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.exporterSearch;
                break;
            case 'plFilterImporter':
                options = [...new Set(records.map(r => (r.partyName || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.importerSearch;
                break;
            case 'plFilterProduct':
                const prods = [];
                records.forEach(r => {
                    if (r.productName) prods.push(r.productName.trim());
                    if (r.productsList) {
                        r.productsList.forEach(p => {
                            if (p.productName) prods.push(p.productName.trim());
                        });
                    }
                });
                options = [...new Set(prods)].sort();
                search = filterSearchInputs.productSearch;
                break;
            default:
                return [];
        }

        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    };

    const fetchTrSetups = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/tr-setups`);
            setTrSetups(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching TR setups:', error);
            showToast('Failed to load TR Setup names.', 'error');
        }
    };

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const [plRes, piRes, lcRes, bankRes, ipRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/packing-lists`),
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/ip-records`)
            ]);
            setRecords(Array.isArray(plRes.data) ? plRes.data : []);
            setPiRecords(Array.isArray(piRes.data) ? piRes.data : []);
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
            setIpRecords(Array.isArray(ipRes.data) ? ipRes.data : []);
            await fetchTrSetups();
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

    const loadPiRevision = (rawPi, revisionNo) => {
        const isRevised = revisionNo && revisionNo !== 'Original PI';
        const displayPiNumber = isRevised ? `${rawPi.piNumber} (REVISED)` : (rawPi.piNumber || '');

        // Look up the LC that references this PI number
        const cleanPiNo = rawPi.piNumber || '';
        const matchedLcByPi = lcRecords?.find(lc => {
            const lcPi = (lc.piNo || '').replace(' (REVISED)', '');
            return lcPi === cleanPiNo;
        });

        // The revisions array in rawPi
        const revisions = rawPi.revisions || [];
        // The selected revision object (could be 'Original PI' or subsequent revisions)
        const selectedRev = revisions.find(r => r.reviseNo === revisionNo) || rawPi;

        // Use the selected revision's date if available
        const piDate = selectedRev.reviseDate || selectedRev.date || rawPi.date || '';

        let revisedTotalAmount = 0;
        let mappedProducts = [];

        if (isRevised && revisions.length > 0) {
            const originalRev = revisions.find(r => r.reviseNo === 'Original PI') || rawPi;
            const originalProducts = originalRev?.productsList || [];

            // Filter and map only the changed products between selected revision and original revision
            const revisedProducts = selectedRev.productsList || [];
            revisedProducts.forEach(p => {
                const origProd = originalProducts.find(op => op.productName?.trim().toLowerCase() === p.productName?.trim().toLowerCase());
                const origQty = origProd ? (parseFloat(origProd.quantity) || 0) : 0;
                const revQty = parseFloat(p.quantity) || 0;
                const diffQty = revQty - origQty;

                if (diffQty !== 0) {
                    // This product has changed!
                    // If quantity decreased (diffQty < 0), show remaining value (revQty).
                    // If quantity increased (diffQty > 0), keep the difference (diffQty).
                    const displayQty = diffQty < 0 ? revQty : diffQty;
                    const calculatedAmt = displayQty * (parseFloat(p.rate) || 0);
                    const calculatedFrt = displayQty * (parseFloat(p.freight) || 0);
                    revisedTotalAmount += calculatedAmt + calculatedFrt;
                    mappedProducts.push({
                        productName: p.productName || '',
                        hsCode: p.hsCode || '',
                        quantity: String(displayQty),
                        bagCount: '',
                        packingType: rawPi.packingType || '',
                        netWeight: String(displayQty),
                        grossWeight: '',
                        rate: p.rate || '',
                        amount: String(calculatedAmt.toFixed(2)),
                        freight: p.freight || '',
                        totalFreight: String(calculatedFrt.toFixed(2))
                    });
                }
            });

            if (mappedProducts.length === 0) {
                mappedProducts = revisedProducts.map(p => {
                    const amt = parseFloat(p.amount) || 0;
                    const frt = parseFloat(p.totalFreight) || 0;
                    revisedTotalAmount += amt + frt;
                    return {
                        productName: p.productName || '',
                        hsCode: p.hsCode || '',
                        quantity: p.quantity || '',
                        bagCount: '',
                        packingType: rawPi.packingType || '',
                        netWeight: p.quantity || '',
                        grossWeight: '',
                        rate: p.rate || '',
                        amount: p.amount || '',
                        freight: p.freight || '',
                        totalFreight: p.totalFreight || ''
                    };
                });
            }
        } else {
            // Unrevised or Original option: show all products, netWeight = full quantity of selectedRev/rawPi
            const productsSource = selectedRev.productsList || rawPi.productsList || [];
            mappedProducts = productsSource.map(p => ({
                productName: p.productName || '',
                hsCode: p.hsCode || '',
                quantity: p.quantity || '',
                bagCount: '',
                packingType: rawPi.packingType || '',
                netWeight: p.quantity || '',
                grossWeight: '',
                rate: p.rate || '',
                amount: p.amount || '',
                freight: p.freight || '',
                totalFreight: p.totalFreight || ''
            }));
        }

        if (mappedProducts.length === 0) {
            mappedProducts = [{ productName: '', hsCode: '', quantity: '', bagCount: '', packingType: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }];
        }

        setFormData(prev => ({
            ...prev,
            piNumber: displayPiNumber,
            piDate: piDate ? piDate.split('T')[0] : '',
            partyName: rawPi.partyName || '',
            partyAddress: rawPi.partyAddress || '',
            partyContact: rawPi.partyContact || '',
            exporterName: rawPi.exporterName || '',
            exporterAddress: rawPi.exporterAddress || '',
            exporterContact: rawPi.exporterContact || '',
            exporterEmail: rawPi.exporterEmail || '',
            portOfLoading: rawPi.portOfLoading || '',
            portOfDischarge: rawPi.portOfDischarge || '',
            vesselFlightNo: rawPi.vesselFlightNo || 'BY TRUCK',
            preCarriageBy: rawPi.preCarriageBy || 'ROAD',
            placeOfReceipt: rawPi.placeOfReceipt || rawPi.placeOfReceiptByPreCarrier || 'BY ROAD',
            finalDestination: rawPi.finalDestination || 'BANGLADESH',
            marksNo: rawPi.marksNo || '',
            buyerOrderNo: rawPi.buyerOrderNo || '',
            buyerOrderDate: rawPi.buyerOrderDate ? rawPi.buyerOrderDate.split('T')[0] : '',
            lcNumber: matchedLcByPi ? (matchedLcByPi.lcNo || '') : '',
            lcDate: matchedLcByPi ? (matchedLcByPi.openingDate ? matchedLcByPi.openingDate.split('T')[0] : '') : '',
            partySignature: rawPi.partySignature || '',
            exporterSignature: rawPi.exporterSignature || '',
            invoiceStyle: rawPi.invoiceStyle || 'Style 2 AAS',
            bankName: matchedLcByPi ? (matchedLcByPi.bankName || '') : '',
            lcAmendment: matchedLcByPi ? (matchedLcByPi.lcAmendment || '') : '',
            descriptionGoods: rawPi.descriptionGoods || '',
            termsDeliveryPayment: rawPi.termsDeliveryPayment || '',
            totalAmount: isRevised ? String(revisedTotalAmount.toFixed(2)) : (selectedRev.totalAmount || rawPi.totalAmount || ''),
            totalAmountWords: isRevised ? numberToWordsUSD(revisedTotalAmount) : (selectedRev.totalAmountWords || rawPi.totalAmountWords || ''),
            countryOrigin: rawPi.countryOrigin || 'INDIA',
            countryFinalDest: rawPi.countryFinalDest || 'BANGLADESH',
            certification: rawPi.certification || '',
            otherReferences: rawPi.otherReferences || '',
            buyerName: rawPi.buyerName || '',
            selectedRevisionNo: revisionNo,
            productsList: mappedProducts,
            productsImage: '',
            productsText: ''
        }));
        setPiSearchQuery('');
        setActiveDropdown(null);
        showToast(`Copied data from PI Number ${displayPiNumber}`);
    };

    // Auto-populate form when a Proforma Invoice is selected
    const handlePISelect = (pi) => {
        const rawPi = pi.rawPi || pi;
        setSelectedPiRaw(rawPi);
        loadPiRevision(rawPi, 'Original PI');
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
            productsList: [...prev.productsList, { productName: '', hsCode: '', quantity: '', bagCount: '', packingType: '', netWeight: '', grossWeight: '' }]
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
            productsList: [{ productName: '', hsCode: '', quantity: '', bagCount: '', packingType: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }],
            productsImage: '',
            productsText: '',
            partySignature: '',
            exporterSignature: '',
            trNumber: '',
            trDate: '',
            trName: '',
            demurrage: '03',
            days: '05',
            invoiceStyle: 'Style 2 AAS',
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
            buyerName: '',
            selectedRevisionNo: ''
        });
        setPiSearchQuery('');
        setEditingId(null);
        setSubmitStatus(null);
        setSelectedPiRaw(null);
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

        const basePiNumber = (record.piNumber || '').replace(' (REVISED)', '').trim();
        const matchedRawPi = piRecords.find(pi => (pi.piNumber || '').trim() === basePiNumber);
        setSelectedPiRaw(matchedRawPi || null);

        let revisionNo = record.selectedRevisionNo || '';
        if (!revisionNo && matchedRawPi && matchedRawPi.revisions && matchedRawPi.revisions.length > 0) {
            if ((record.piNumber || '').includes('(REVISED)')) {
                revisionNo = matchedRawPi.revisions[matchedRawPi.revisions.length - 1].reviseNo || 'Original PI';
            } else {
                revisionNo = 'Original PI';
            }
        }

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
                    packingType: p.packingType || '',
                    netWeight: p.netWeight || '',
                    grossWeight: p.grossWeight || '',
                    rate: p.rate || '',
                    amount: p.amount || '',
                    freight: p.freight || '',
                    totalFreight: p.totalFreight || ''
                }))
                : [{ productName: '', hsCode: '', quantity: '', bagCount: '', packingType: '', netWeight: '', grossWeight: '', rate: '', amount: '', freight: '', totalFreight: '' }],
            productsImage: record.productsImage || '',
            productsText: record.productsText || '',
            partySignature: record.partySignature || '',
            exporterSignature: record.exporterSignature || '',
            status: record.status || 'Active',
            trNumber: record.trNumber || '',
            trDate: record.trDate ? record.trDate.split('T')[0] : '',
            trName: record.trName || '',
            demurrage: record.demurrage || '03',
            days: record.days || '05',
            invoiceStyle: record.invoiceStyle || 'Style 2 AAS',
            bankName: record.bankName || '',
            branchName: record.branchName || '',
            lcAmendment: record.lcAmendment || '',
            descriptionGoods: record.descriptionGoods || '',
            termsDeliveryPayment: record.termsDeliveryPayment || '',
            totalAmount: record.totalAmount || '',
            totalAmountWords: record.totalAmountWords || '',
            countryOrigin: record.countryOrigin || 'INDIA',
            countryFinalDest: record.countryFinalDest || 'BANGLADESH',
            certification: record.certification || '',
            otherReferences: record.otherReferences || '',
            buyerName: record.buyerName || '',
            selectedRevisionNo: revisionNo
        });
        setShowForm(true);
    };

    const handleDeleteClick = (id) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete Packing Lists');
            return;
        }
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
            const indexToSelect = (highlightedIndex >= 0 && highlightedIndex < filteredList.length) ? highlightedIndex : 0;
            if (filteredList && filteredList.length > 0) {
                const item = filteredList[indexToSelect];
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
        // Search Query Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = (record.packingListNumber || '').toLowerCase().includes(query) ||
                (record.partyName || '').toLowerCase().includes(query) ||
                (record.piNumber || '').toLowerCase().includes(query);
            if (!matchesSearch) return false;
        }

        // Advanced Filters
        if (plFilters.startDate && record.date && record.date < plFilters.startDate) return false;
        if (plFilters.endDate && record.date && record.date > plFilters.endDate) return false;

        if (plFilters.port) {
            const filterPort = plFilters.port.trim().toLowerCase();
            const recordPort = (record.port || '').trim().toLowerCase();
            const recordDischarge = (record.portOfDischarge || '').trim().toLowerCase();
            const recordLoading = (record.portOfLoading || '').trim().toLowerCase();
            if (recordPort !== filterPort && recordDischarge !== filterPort && recordLoading !== filterPort) return false;
        }

        if (plFilters.importerName && (record.partyName || '').trim().toLowerCase() !== plFilters.importerName.toLowerCase()) return false;
        if (plFilters.exporterName && (record.exporterName || '').trim().toLowerCase() !== plFilters.exporterName.toLowerCase()) return false;

        if (plFilters.productName) {
            const matchesFilterProduct = (record.productName || '').trim().toLowerCase() === plFilters.productName.toLowerCase() ||
                (record.productsList && record.productsList.some(p => (p.productName || '').trim().toLowerCase() === plFilters.productName.toLowerCase()));
            if (!matchesFilterProduct) return false;
        }

        return true;
    });

    const filteredTrSetups = useMemo(() => {
        const query = (formData.trName || '').trim().toLowerCase();
        return trSetups.filter(setup => {
            const setupName = (setup.name || '').trim();
            if (!setupName) return false;
            return !query || setupName.toLowerCase().includes(query);
        });
    }, [trSetups, formData.trName]);

    const piOptions = useMemo(() => {
        const list = [];
        piRecords.forEach(pi => {
            const hasRevisions = pi.revisions && pi.revisions.length > 0;
            if (hasRevisions) {
                // Only show Original PI in the selection list
                const originalRev = pi.revisions.find(r => r.reviseNo === 'Original PI');
                if (originalRev) {
                    list.push({
                        ...pi,
                        ...originalRev,
                        _dropdownKey: `${pi._id}-original`,
                        isRevisedOption: false,
                        displayPiNumber: pi.piNumber,
                        rawPi: pi
                    });
                } else {
                    list.push({
                        ...pi,
                        _dropdownKey: pi._id,
                        isRevisedOption: false,
                        displayPiNumber: pi.piNumber,
                        rawPi: pi
                    });
                }
            } else {
                list.push({
                    ...pi,
                    _dropdownKey: pi._id,
                    isRevisedOption: false,
                    displayPiNumber: pi.piNumber,
                    rawPi: pi
                });
            }
        });
        return list;
    }, [piRecords]);

    const filteredPIs = useMemo(() => {
        return piOptions.filter(pi => {
            if (piSearchQuery) {
                const query = piSearchQuery.toLowerCase();
                return (pi.displayPiNumber || '').toLowerCase().includes(query) ||
                    (pi.partyName || '').toLowerCase().includes(query);
            }
            return true;
        });
    }, [piOptions, piSearchQuery]);


    const filteredLcs = useMemo(() => {
        let list = lcRecords;

        // Filter by PI number if one is entered
        if (formData.piNumber) {
            const piNoClean = (formData.piNumber || '').replace(' (REVISED)', '').trim().toLowerCase();
            list = list.filter(lc => {
                const lcPiClean = (lc.piNo || '').replace(' (REVISED)', '').trim().toLowerCase();
                return lcPiClean === piNoClean;
            });
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

                    <div className="w-full md:w-auto flex flex-row justify-end gap-2 sm:gap-3 z-[60]">
                        {/* Filter Button & Panel */}
                        <div className="relative">
                            <button
                                ref={plFilterButtonRef}
                                onClick={() => setShowPlFilterPanel(!showPlFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border h-[40px] ${showPlFilterPanel || Object.values(plFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showPlFilterPanel || (plFilters && Object.values(plFilters).some(v => v !== ''))) ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showPlFilterPanel && plFilters && (
                                <div ref={plFilterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200 text-left">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                        <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPlFilters(initialPlFilterState);
                                                setFilterSearchInputs({
                                                    portSearch: '',
                                                    exporterSearch: '',
                                                    importerSearch: '',
                                                    productSearch: ''
                                                });
                                                setFilterDropdownOpen(initialFilterDropdownState);
                                                setShowPlFilterPanel(false);
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
                                                value={plFilters.startDate}
                                                onChange={(e) => setPlFilters({ ...plFilters, startDate: e.target.value })}
                                                compact={true}
                                            />
                                            <CustomDatePicker
                                                label="To Date"
                                                value={plFilters.endDate}
                                                onChange={(e) => setPlFilters({ ...plFilters, endDate: e.target.value })}
                                                compact={true}
                                                rightAlign={true}
                                            />
                                        </div>

                                        {/* Port & Product Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Port Filter */}
                                            <div className="space-y-1.5 relative" ref={portFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.portSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, portSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, port: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, port: true })}
                                                        placeholder={plFilters.port || "Search Port..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${plFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {plFilters.port && (
                                                            <button type="button" onClick={() => { setPlFilters({ ...plFilters, port: '' }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.port && (() => {
                                                    const filtered = getFilteredOptions('plFilterPort') || [];
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} type="button" onClick={() => { setPlFilters({ ...plFilters, port: opt }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Product Filter */}
                                            <div className="space-y-1.5 relative" ref={productFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Product</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.productSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ ...filterSearchInputs, productSearch: e.target.value });
                                                            setFilterDropdownOpen({ ...initialFilterDropdownState, product: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, product: true })}
                                                        placeholder={plFilters.productName || "Search Product..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${plFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {plFilters.productName && (
                                                            <button type="button" onClick={() => { setPlFilters({ ...plFilters, productName: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.product && (() => {
                                                    const filtered = getFilteredOptions('plFilterProduct') || [];
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} type="button" onClick={() => { setPlFilters({ ...plFilters, productName: opt }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Importer Filter */}
                                        <div className="space-y-1.5 relative" ref={importerFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Importer</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.importerSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, importerSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, importer: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, importer: true })}
                                                    placeholder={plFilters.importerName || "Search Importer..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${plFilters.importerName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {plFilters.importerName && (
                                                        <button type="button" onClick={() => { setPlFilters({ ...plFilters, importerName: '' }); setFilterSearchInputs({ ...filterSearchInputs, importerSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.importer && (() => {
                                                const filtered = getFilteredOptions('plFilterImporter') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setPlFilters({ ...plFilters, importerName: opt }); setFilterSearchInputs({ ...filterSearchInputs, importerSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>

                                        {/* Exporter Filter */}
                                        <div className="space-y-1.5 relative" ref={exporterFilterRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Exporter</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={filterSearchInputs.exporterSearch}
                                                    onChange={(e) => {
                                                        setFilterSearchInputs({ ...filterSearchInputs, exporterSearch: e.target.value });
                                                        setFilterDropdownOpen({ ...initialFilterDropdownState, exporter: true });
                                                    }}
                                                    onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, exporter: true })}
                                                    placeholder={plFilters.exporterName || "Search Exporter..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${plFilters.exporterName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {plFilters.exporterName && (
                                                        <button type="button" onClick={() => { setPlFilters({ ...plFilters, exporterName: '' }); setFilterSearchInputs({ ...filterSearchInputs, exporterSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.exporter && (() => {
                                                const filtered = getFilteredOptions('plFilterExporter') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setPlFilters({ ...plFilters, exporterName: opt }); setFilterSearchInputs({ ...filterSearchInputs, exporterSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {canManage && (
                            <button
                                onClick={() => { setShowForm(true); resetForm(); }}
                                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center justify-center whitespace-nowrap h-[40px]"
                            >
                                <span className="mr-1.5 font-bold text-lg leading-none">+</span> Add New
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showForm && (
                <div className="pl-form relative rounded-2xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-2xl p-8 transition-all duration-300">

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
                            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                                <div className="relative flex-1 max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Search PI number or importer name to pre-fill..."
                                        value={piSearchQuery}
                                        onChange={(e) => { setPiSearchQuery(e.target.value); setActiveDropdown('piList'); setHighlightedIndex(-1); }}
                                        onFocus={() => { setActiveDropdown('piList'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => handleDropdownKeyDown(e, 'piList', filteredPIs)}
                                        className="w-full pl-10 pr-4 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <SearchIcon className="h-4 w-4 text-blue-400" />
                                    </div>
                                    {activeDropdown === 'piList' && filteredPIs.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                            {filteredPIs.map((pi, idx) => (
                                                <button
                                                    key={pi._dropdownKey}
                                                    type="button"
                                                    onClick={() => handlePISelect(pi)}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2.5 text-left text-sm flex justify-between items-center ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    <span className="font-semibold">
                                                        {pi.piNumber}
                                                        {pi.isRevisedOption ? (
                                                            <span className="ml-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">REVISED</span>
                                                        ) : (
                                                            pi.revisions && pi.revisions.length > 0 && (
                                                                <span className="ml-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">ORIGINAL</span>
                                                            )
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{pi.partyName}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedPiRaw && selectedPiRaw.revisions && selectedPiRaw.revisions.length > 0 && (
                                    <div className="w-full sm:w-64 animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-2 relative">
                                        <span className="text-xs font-semibold text-blue-700 uppercase shrink-0">Revision:</span>
                                        <div className="relative flex-1">
                                            <button
                                                type="button"
                                                onClick={() => setActiveDropdown(activeDropdown === 'piRevisions' ? null : 'piRevisions')}
                                                className="w-full px-4 py-2 border border-blue-200 rounded-lg text-sm bg-white text-gray-700 hover:bg-gray-50 flex items-center justify-between outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-left"
                                            >
                                                <span>{getRevName(formData.selectedRevisionNo || 'Original PI')}</span>
                                                <ChevronDownIcon className={`h-4 w-4 text-blue-400 transition-transform duration-200 ${activeDropdown === 'piRevisions' ? 'transform rotate-180' : ''}`} />
                                            </button>
                                            {activeDropdown === 'piRevisions' && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {selectedPiRaw.revisions.map((rev) => (
                                                        <button
                                                            key={rev.reviseNo}
                                                            type="button"
                                                            onClick={() => {
                                                                loadPiRevision(selectedPiRaw, rev.reviseNo);
                                                                setActiveDropdown(null);
                                                            }}
                                                            className={`w-full px-4 py-2.5 text-left text-sm flex justify-between items-center transition-colors ${
                                                                (formData.selectedRevisionNo || 'Original PI') === rev.reviseNo
                                                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                                                    : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                                            }`}
                                                        >
                                                            <span>{getRevName(rev.reviseNo)}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">TR No</label>
                                <input
                                    type="text"
                                    name="trNumber"
                                    value={formData.trNumber}
                                    onChange={handleInputChange}
                                    placeholder="e.g. 87288"
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">TR Date</label>
                                <CustomDatePicker
                                    name="trDate"
                                    value={formData.trDate}
                                    onChange={handleInputChange}
                                    placeholder="Select TR Date"
                                />
                            </div>

                            <div className="space-y-2 relative dropdown-container">
                                <label className="text-sm font-medium text-gray-700">TR Name</label>
                                <input
                                    type="text"
                                    name="trName"
                                    value={formData.trName}
                                    onChange={(e) => { handleInputChange(e); setActiveDropdown('trName'); setHighlightedIndex(-1); }}
                                    onFocus={() => { setActiveDropdown('trName'); setHighlightedIndex(-1); }}
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'trName', filteredTrSetups, 'trName')}
                                    className="w-full px-4 py-2 bg-white/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Select from TR Setup"
                                    autoComplete="off"
                                />
                                {activeDropdown === 'trName' && (
                                    <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                                        {filteredTrSetups.length > 0 ? (
                                            filteredTrSetups.map((setup, idx) => (
                                                <button
                                                    key={setup._id || setup.name}
                                                    type="button"
                                                    onClick={() => {
                                                        handleDropdownSelect('trName', (setup.name || '').trim());
                                                    }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    <div className="font-medium">{(setup.name || '').trim()}</div>
                                                </button>
                                            ))
                                        ) : (
                                            <p className="px-4 py-3 text-sm text-gray-500">
                                                {trSetups.length === 0
                                                    ? 'No TR Setup found. Add names in TR Setup first.'
                                                    : 'No matching TR name.'}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- Rinku-only: Demurrage & Days --- */}
                        {formData.trName && formData.trName.trim().toLowerCase().includes('rinku') && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50/60 border border-orange-200/60 rounded-xl">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Demurrage</label>
                                    <input
                                        type="text"
                                        name="demurrage"
                                        value={formData.demurrage}
                                        onChange={handleInputChange}
                                        placeholder="e.g. 03"
                                        className="w-full px-4 py-2 bg-white/70 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Days</label>
                                    <input
                                        type="text"
                                        name="days"
                                        value={formData.days}
                                        onChange={handleInputChange}
                                        placeholder="e.g. 05"
                                        className="w-full px-4 py-2 bg-white/70 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-400 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        {/* --- Products & Packaging Image Upload --- */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <h4 className="text-base font-bold text-gray-800 uppercase tracking-wide">Products & Packaging Details</h4>
                            </div>

                            {/* --- Products List Dynamic Editor --- */}
                            <div className="space-y-4">
                                {(formData.productsList || [{ productName: '', hsCode: '', quantity: '', bagCount: '', packingType: '', netWeight: '', grossWeight: '' }]).map((item, idx) => (
                                    <div key={idx} className="p-5 bg-white/40 backdrop-blur-md border border-gray-200/50 rounded-2xl relative space-y-4 shadow-sm hover:shadow-md transition-all duration-200">
                                        <div className="flex items-center justify-between border-b border-gray-200/40 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">Product #{idx + 1}</span>
                                                <span className="text-sm font-bold text-gray-800 truncate max-w-[200px] md:max-w-md" title={item.productName}>
                                                    {item.productName || 'New Product Entry'}
                                                </span>
                                            </div>
                                            {formData.productsList && formData.productsList.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeProductRow(idx)}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
                                                    title="Remove Product"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                            {/* Product Name */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Product Name</label>
                                                <input
                                                    type="text"
                                                    value={item.productName}
                                                    onChange={(e) => handleProductChange(idx, 'productName', e.target.value)}
                                                    placeholder="Product Description"
                                                    required
                                                    className="w-full px-3.5 py-2 bg-white/80 border border-gray-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            {/* HS Code */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">HS Code</label>
                                                <input
                                                    type="text"
                                                    value={item.hsCode}
                                                    onChange={(e) => handleProductChange(idx, 'hsCode', e.target.value)}
                                                    placeholder="HS Code"
                                                    className="w-full px-3.5 py-2 bg-white/80 border border-gray-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            {/* Quantity (KG) */}
                                            <div className="md:col-span-1 space-y-1.5">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate block" title="PI Qty (KG)">PI Qty</label>
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    readOnly
                                                    disabled
                                                    placeholder="Qty"
                                                    className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-gray-500 cursor-not-allowed outline-none text-center"
                                                />
                                            </div>

                                            {/* Bag Count */}
                                            <div className="md:col-span-1 space-y-1.5">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block truncate" title="Bag Count">Bag Count</label>
                                                <input
                                                    type="number"
                                                    value={item.bagCount}
                                                    onChange={(e) => handleProductChange(idx, 'bagCount', e.target.value)}
                                                    placeholder="500"
                                                    className="w-full px-2.5 py-2 bg-white/80 border border-gray-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center"
                                                />
                                            </div>

                                            {/* Packing Type */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block truncate" title="Packing Type">Packing Type</label>
                                                <input
                                                    type="text"
                                                    value={item.packingType || ''}
                                                    onChange={(e) => handleProductChange(idx, 'packingType', e.target.value)}
                                                    placeholder="e.g. PP Bag"
                                                    className="w-full px-3.5 py-2 bg-white/80 border border-gray-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            {/* Net Weight */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Net Weight (KG)</label>
                                                <input
                                                    type="number"
                                                    value={item.netWeight}
                                                    onChange={(e) => handleProductChange(idx, 'netWeight', e.target.value)}
                                                    placeholder="Net Wt"
                                                    className="w-full px-3.5 py-2 bg-white/80 border border-gray-200 rounded-lg text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                />
                                            </div>

                                            {/* Gross Weight */}
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider truncate block" title="Gross Weight (KG)">Gross Wt (KG)*</label>
                                                <input
                                                    type="number"
                                                    value={item.grossWeight}
                                                    onChange={(e) => handleProductChange(idx, 'grossWeight', e.target.value)}
                                                    placeholder="Gross Wt"
                                                    required
                                                    className="w-full px-3.5 py-2 bg-indigo-50/20 border border-indigo-200 focus:border-indigo-500 rounded-lg text-[13px] font-bold text-indigo-700 placeholder-indigo-300 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={addProductRow}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300 font-semibold rounded-xl text-xs transition-all shadow-sm"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" /> Add Another Product
                                    </button>
                                </div>
                            </div>

                            {/* Divider between product table and packaging image upload */}
                            <div className="border-t border-gray-200/50 my-6"></div>

                            {/* Products & Packaging Text Details */}
                            <div className="space-y-2 mb-4">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Products & Packaging Text Details</label>
                                <textarea
                                    name="productsText"
                                    value={formData.productsText || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, productsText: e.target.value }))}
                                    rows="4"
                                    placeholder="Enter Products & Packaging details here (will be printed in the PDF if no image is uploaded)..."
                                    className="w-full px-4 py-3 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-y text-sm"
                                ></textarea>
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
                                        <th className="px-6 py-4">Product</th>
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
                                                <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]" title={
                                                    Array.isArray(rec.productsList) 
                                                        ? rec.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                                        : ''
                                                }>
                                                    {Array.isArray(rec.productsList) 
                                                        ? rec.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                                        : '-'}
                                                </td>
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
                                                        onClick={async () => {
                                                            try {
                                                                    await generatePL2PDF(rec, piRecords, lcRecords, importers, exporters, banks, ipRecords, trSetups);
                                                            } catch (err) {
                                                                console.error('PDF generation failed:', err);
                                                                showToast('Failed to generate PDF.', 'error');
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
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(rec._id)}
                                                                    title="Delete"
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition-all"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
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
                                                        onClick={async () => {
                                                            try {
                                                                    await generatePL2PDF(rec, piRecords, lcRecords, importers, exporters, banks, ipRecords, trSetups);
                                                            } catch (err) {
                                                                console.error('PDF generation failed:', err);
                                                                showToast('Failed to generate PDF.', 'error');
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
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(rec._id)}
                                                                    className="p-2 text-red-600 bg-red-50 border border-red-100 rounded-lg"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
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
