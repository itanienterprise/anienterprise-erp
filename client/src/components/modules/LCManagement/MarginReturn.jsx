import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
    PlusIcon,
    SearchIcon,
    EditIcon,
    TrashIcon,
    XIcon,
    DollarSignIcon,
    CalendarIcon,
    BuildingIcon,
    FileTextIcon,
    RotateCcwIcon,
    DownloadIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    FunnelIcon,
    BarChartIcon
} from '../../Icons';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { formatDate } from '../../../utils/helpers';
import { getLCHistoryTimeline, getMilestoneTotalDollar } from './LCManagement';
import { generateMarginReturnReportPDF } from '../../../utils/pdfGenerator';


const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const MarginReturn = ({ currentUser, addNotification, onDeleteConfirm, refreshKey }) => {
    const [marginReturns, setMarginReturns] = useState([]);
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [stockRecords, setStockRecords] = useState([]);
    const [salesRecords, setSalesRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter & Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedRecordIdx, setExpandedRecordIdx] = useState(null);

    const initialMarginReturnFilterState = {
        startDate: '',
        endDate: '',
        lcNo: '',
        bankName: '',
        importerName: ''
    };
    const [marginReturnFilters, setMarginReturnFilters] = useState(initialMarginReturnFilterState);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const filterPanelRef = useRef(null);
    const filterButtonRef = useRef(null);
    const lcFilterRef = useRef(null);
    const bankFilterRef = useRef(null);
    const importerFilterRef = useRef(null);

    const initialFilterDropdownState = {
        lcNo: false,
        bankName: false,
        importerName: false
    };
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        lcSearch: '',
        bankSearch: '',
        importerSearch: ''
    });

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // LC Dropdown Autocomplete state & ref
    const [isLcDropdownOpen, setIsLcDropdownOpen] = useState(false);
    const [lcSearchText, setLcSearchText] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const lcDropdownRef = useRef(null);

    // Delete Modal State
    const [deleteModalRecord, setDeleteModalRecord] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        returnDate: new Date().toISOString().split('T')[0],
        lcId: '',
        lcNo: '',
        importerName: '',
        bankName: '',
        returnAmount: '',
        remarks: ''
    });

    const canView = hasPermission(currentUser, 'marginReturn', 'view');
    const canAdd = hasPermission(currentUser, 'marginReturn', 'add');
    const canEdit = hasPermission(currentUser, 'marginReturn', 'edit');
    const canDelete = hasPermission(currentUser, 'marginReturn', 'delete');

    useEffect(() => {
        fetchData();
    }, [refreshKey]);

    // Close LC dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (lcDropdownRef.current && !lcDropdownRef.current.contains(e.target)) {
                setIsLcDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close Filter Panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showFilterPanel &&
                filterPanelRef.current &&
                !filterPanelRef.current.contains(event.target) &&
                filterButtonRef.current &&
                !filterButtonRef.current.contains(event.target)
            ) {
                setShowFilterPanel(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterPanel]);

    // Close Filter Dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            const openKey = Object.keys(filterDropdownOpen).find(key => filterDropdownOpen[key]);
            if (!openKey) return;

            let refsToCheck = [];
            if (openKey === 'lcNo') refsToCheck = [lcFilterRef];
            else if (openKey === 'bankName') refsToCheck = [bankFilterRef];
            else if (openKey === 'importerName') refsToCheck = [importerFilterRef];

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
            case 'marginReturnFilterLc':
                options = [...new Set([...marginReturns.map(m => m.lcNo), ...lcRecords.map(l => l.lcNo)].filter(Boolean))].sort();
                search = filterSearchInputs.lcSearch;
                break;
            case 'marginReturnFilterBank':
                options = [...new Set([...banks.map(b => b.name), ...lcRecords.map(l => l.bankName || l.bank), ...marginReturns.map(m => m.bankName)].filter(Boolean))].sort();
                search = filterSearchInputs.bankSearch;
                break;
            case 'marginReturnFilterImporter':
                options = [...new Set([...lcRecords.map(l => l.importerName || l.importer), ...marginReturns.map(m => m.importerName)].filter(Boolean))].sort();
                search = filterSearchInputs.importerSearch;
                break;
            default:
                return [];
        }

        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    };

    const handleGenerateReport = () => {
        generateMarginReturnReportPDF(filteredRecords, marginReturnFilters, totals, lcMarginMap, searchQuery);
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [returnsRes, lcRes, bankRes, stockRes, salesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/margin-returns`),
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/stock`).catch(() => ({ data: [] })),
                axios.get(`${API_BASE_URL}/api/sales`).catch(() => ({ data: [] }))
            ]);

            setMarginReturns(Array.isArray(returnsRes.data) ? returnsRes.data : []);
            setLcRecords(Array.isArray(lcRes.data) ? lcRes.data : []);
            setBanks(Array.isArray(bankRes.data) ? bankRes.data : []);
            setStockRecords(Array.isArray(stockRes.data) ? stockRes.data : []);
            setSalesRecords(Array.isArray(salesRes.data) ? salesRes.data : []);
        } catch (error) {
            console.error('Error fetching Margin Return data:', error);
            addNotification?.('Failed to load Margin Return records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate adjusted LC values matching LC Management module exactly
    const getAdjustedLcValues = (record, allStockRecords = [], allSalesRecords = []) => {
        if (!record) return { adjustedTotalAmount: 0, billValueUsd: 0, dollarRate: 0, openingValue: 0 };

        const totalQtyTons = record.productsList && record.productsList.length > 0
            ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
            : (parseFloat(record.quantity) || 0);
        const openingQtyKg = totalQtyTons * 1000;
        const openingValue = parseFloat(record.totalAmount) || 0;

        const parseNum = (val) => {
            if (val === null || val === undefined) return 0;
            return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
        };
        const cleanLc = (val) => String(val || '').replace(/\D/g, '');
        const lcNoClean = cleanLc(record.lcNo);

        const receiptsMapForBalance = {};
        allStockRecords
            .filter(s => {
                const recordLcNoClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
            })
            .forEach(s => {
                const rawDate = s.date || s.receiveDate || s.createdAt || '';
                const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
                const key = `${dateStr}_${groupVal}`;

                if (!receiptsMapForBalance[key]) {
                    const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                    receiptsMapForBalance[key] = parseNum(s.totalLcQuantity) || itemSubtotal || parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                } else {
                    if (!s.totalLcQuantity) {
                        receiptsMapForBalance[key] += parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                    }
                }
            });
        const receivedQtyKg = Object.values(receiptsMapForBalance).reduce((sum, qty) => sum + qty, 0);

        const borderSaleQtyKg = allSalesRecords
            .filter(s => {
                const matchesLc = !!lcNoClean && (
                    (s.lcNo && cleanLc(s.lcNo) === lcNoClean) ||
                    (s.lcNumber && cleanLc(s.lcNumber) === lcNoClean) ||
                    (s.lc_no && cleanLc(s.lc_no) === lcNoClean) ||
                    (s.items && s.items.some(i => (i.lcNo && cleanLc(i.lcNo) === lcNoClean) || (i.brandEntries && i.brandEntries.some(b => b.lcNo && cleanLc(b.lcNo) === lcNoClean))))
                );
                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                const isBorder = (sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').toUpperCase().startsWith('BS') || s.isBorderSale === true) && sTypeLow !== 'general' && sTypeLow !== 'warehouse';
                const status = (s.status || '').toLowerCase();
                const isValidStatus = !status.includes('rejected') && status !== 'requested';
                return matchesLc && isValidStatus && isBorder;
            })
            .reduce((sum, s) => {
                const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                    const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                    return iSum + (brandSubtotal || parseNum(item.quantity));
                }, 0);
                return sum + (itemSubtotal || parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal);
            }, 0);

        const hasCustomReceive = record?.updatedLcReceive !== undefined && record?.updatedLcReceive !== null && record?.updatedLcReceive !== '';
        const totalReceivedQtyKg = hasCustomReceive
            ? (parseFloat(record.updatedLcReceive) || 0)
            : (receivedQtyKg + borderSaleQtyKg);
        const rawBalanceKg = openingQtyKg - totalReceivedQtyKg;

        let adjustmentQtyKg = 0;
        if (rawBalanceKg < 0) {
            const excessQtyKg = -rawBalanceKg;
            const maxAdjustmentKg = openingQtyKg * 0.10;
            adjustmentQtyKg = Math.min(excessQtyKg, maxAdjustmentKg);
        }

        const isEnabled = !!record.enableValueQtyAdjustment;
        const actualAdjustmentQtyKg = isEnabled ? adjustmentQtyKg : 0;

        const adjustedQtyKg = openingQtyKg + actualAdjustmentQtyKg;
        const adjustedQtyTons = adjustedQtyKg / 1000;

        const timeline = getLCHistoryTimeline(record);
        const latestMilestone = timeline[timeline.length - 1] || {};
        const totalDollar = getMilestoneTotalDollar(latestMilestone, record);
        const dollarRate = parseFloat(record.updatedDollarRate || record.dollarRate || latestMilestone.dollarRate || 0);

        const getRatePerTon = (rVal) => {
            const r = parseFloat(rVal) || 0;
            return r > 0 && r < 10 ? r * 1000 : r;
        };
        const getFreightPerTon = (fVal) => {
            const f = parseFloat(fVal) || 0;
            return f > 0 && f < 0.1 ? f * 1000 : f;
        };

        const getProductReceivedQtyKg = (pName) => {
            const cleanPName = (pName || '').trim().toLowerCase();
            const receiptsMap = {};
            allStockRecords
                .filter(s => {
                    const recordLcNoClean = cleanLc(s.lcNo);
                    const status = (s.status || '').toLowerCase();
                    return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
                })
                .forEach(s => {
                    const rawDate = s.date || s.receiveDate || s.createdAt || '';
                    const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                    const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
                    const key = `${dateStr}_${groupVal}`;

                    if (s.entries && s.entries.length > 0) {
                        const matchingEntries = s.entries.filter(item => {
                            const itemPName = (item.productName || s.productName || s.product || '').trim().toLowerCase();
                            return !cleanPName || itemPName === cleanPName;
                        });
                        const itemQty = matchingEntries.reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                        receiptsMap[key] = (receiptsMap[key] || 0) + itemQty;
                    } else {
                        const rootPName = (s.productName || s.product || '').trim().toLowerCase();
                        if (!cleanPName || !rootPName || rootPName === cleanPName) {
                            const itemQty = parseNum(s.totalLcQuantity) || parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                            if (!receiptsMap[key]) {
                                receiptsMap[key] = itemQty;
                            } else if (!s.totalLcQuantity) {
                                receiptsMap[key] += itemQty;
                            }
                        }
                    }
                });
            const rQty = Object.values(receiptsMap).reduce((sum, qty) => sum + qty, 0);

            const bQty = allSalesRecords
                .filter(s => {
                    const matchesLc = !!lcNoClean && (
                        (s.lcNo && cleanLc(s.lcNo) === lcNoClean) ||
                        (s.lcNumber && cleanLc(s.lcNumber) === lcNoClean) ||
                        (s.lc_no && cleanLc(s.lc_no) === lcNoClean) ||
                        (s.items && s.items.some(i => (i.lcNo && cleanLc(i.lcNo) === lcNoClean) || (i.brandEntries && i.brandEntries.some(b => b.lcNo && cleanLc(b.lcNo) === lcNoClean))))
                    );
                    const sTypeLow = (s.saleType || '').toLowerCase().trim();
                    const isBorder = (sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').toUpperCase().startsWith('BS') || s.isBorderSale === true) && sTypeLow !== 'general' && sTypeLow !== 'warehouse';
                    const status = (s.status || '').toLowerCase();
                    const isValidStatus = !status.includes('rejected') && status !== 'requested';
                    return matchesLc && isValidStatus && isBorder;
                })
                .reduce((sum, s) => {
                    const matchingItems = (s.items || []).filter(item => {
                        const itemPName = (item.productName || s.productName || s.product || '').trim().toLowerCase();
                        return !cleanPName || !itemPName || itemPName === cleanPName;
                    });
                    const itemSubtotal = matchingItems.reduce((iSum, item) => {
                        const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                        return iSum + (brandSubtotal || parseNum(item.quantity));
                    }, 0);
                    return sum + (itemSubtotal || parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total));
                }, 0);

            return rQty + bQty;
        };

        const originalLc = timeline.find(m => m.isOriginal) || timeline[0] || record;
        const origProducts = (originalLc.productsList && originalLc.productsList.length > 0)
            ? originalLc.productsList
            : (record.productsList && record.productsList.length > 0 ? record.productsList : []);

        let billValueUsd = parseFloat(record.billValueUsd) || 0;
        if (billValueUsd === 0 && origProducts.length > 0) {
            origProducts.forEach(p => {
                const pRecQtyKg = getProductReceivedQtyKg(p.productName);
                const pRecQtyTons = pRecQtyKg / 1000;
                let pRate = getRatePerTon(p.rate);
                let pFreight = getFreightPerTon(p.freight);
                if (pRate === 0) {
                    const rootRate = getRatePerTon(originalLc.rate || record.rate);
                    const rootFreight = getFreightPerTon(originalLc.freight || record.freight);
                    if (rootFreight > 0 && rootRate > rootFreight) {
                        pRate = rootRate - rootFreight;
                        pFreight = rootFreight;
                    } else {
                        pRate = rootRate;
                        pFreight = rootFreight;
                    }
                }
                billValueUsd += pRecQtyTons * (pRate + pFreight);
            });
        }

        if (billValueUsd === 0 && totalReceivedQtyKg > 0) {
            const pRecQtyTons = totalReceivedQtyKg / 1000;
            const rootRateVal = originalLc.rate || record.rate || (origProducts[0]?.rate);
            const rootFreightVal = originalLc.freight || record.freight || (origProducts[0]?.freight);
            let pRate = getRatePerTon(rootRateVal);
            let pFreight = getFreightPerTon(rootFreightVal);
            if (pFreight > 0 && pRate > pFreight) {
                pRate = pRate - pFreight;
            }
            billValueUsd = pRecQtyTons * (pRate + pFreight);
        }

        const adjustedTotalAmount = dollarRate > 0 && billValueUsd > 0
            ? billValueUsd * dollarRate
            : (isEnabled && openingQtyKg > 0
                ? openingValue + (actualAdjustmentQtyKg * (openingValue / openingQtyKg))
                : openingValue);

        return {
            adjustedTotalAmount: adjustedTotalAmount || openingValue,
            billValueUsd,
            dollarRate,
            openingValue
        };
    };

    // Calculate total margin paid for a given LC record
    const getLcMarginPaid = (lc) => {
        if (!lc) return 0;
        let totalMargin = parseFloat(lc.marginPaid || 0);

        // Include amendments margin paid
        if (lc.amendments && lc.amendments.length > 0) {
            lc.amendments.forEach(amnd => {
                totalMargin += parseFloat(amnd.amendmentMarginPaid || 0);
            });
        }
        return totalMargin;
    };

    // Map LC margin details for easy lookup
    const lcMarginMap = useMemo(() => {
        const map = {};
        lcRecords.forEach(lc => {
            const adj = getAdjustedLcValues(lc, stockRecords, salesRecords);
            const totalValue = adj.adjustedTotalAmount;
            const marginPaid = getLcMarginPaid(lc);
            const returnedAmount = marginReturns
                .filter(r => (r.lcId === lc._id || String(r.lcNo || '').trim() === String(lc.lcNo || '').trim()))
                .reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);

            // Return Amount = (Margin Paid - Total Value)
            const calcReturnAmount = marginPaid - totalValue;

            const productNames = lc.productsList && lc.productsList.length > 0
                ? lc.productsList.map(p => p.productName).filter(Boolean).join(', ')
                : (lc.productName || '-');

            const cleanStr = (s) => (s || '').trim().toUpperCase();
            const lcBankClean = cleanStr(lc.bankName);
            const lcBranchClean = cleanStr(lc.bankBranch || lc.branch || lc.branchName);

            const matchedBank = banks.find(b =>
                cleanStr(b.bankName) === lcBankClean ||
                cleanStr(b.shortName) === lcBankClean
            );

            let matchedBranch = null;
            if (matchedBank && Array.isArray(matchedBank.branches)) {
                matchedBranch = matchedBank.branches.find(br => cleanStr(br.branch) === lcBranchClean);
            }

            const accountNo = matchedBranch?.accountNo ||
                matchedBank?.accountNo ||
                lc.accountNo ||
                lc.acNo ||
                lc.accountNumber ||
                (matchedBank?.branches && matchedBank.branches.length > 0 ? matchedBank.branches[0]?.accountNo : null) ||
                '-';

            map[lc._id] = {
                lcNo: lc.lcNo,
                importerName: lc.importerName,
                bankName: lc.bankName,
                bankBranch: lc.bankBranch || lc.branch || lc.branchName || matchedBank?.branch || '-',
                accountNo,
                productName: productNames,
                totalValue,
                marginPaid,
                returnedAmount,
                calcReturnAmount,
                pendingMargin: marginPaid - returnedAmount
            };
        });
        return map;
    }, [lcRecords, marginReturns, stockRecords, salesRecords, banks]);

    // Filtered LC records for modal dropdown
    const filteredLcRecords = useMemo(() => {
        return lcRecords.filter(lc => {
            if (!lcSearchText) return true;
            const searchLower = lcSearchText.toLowerCase();
            return (lc.lcNo || '').toLowerCase().includes(searchLower) ||
                (lc.importerName || '').toLowerCase().includes(searchLower) ||
                (lc.bankName || '').toLowerCase().includes(searchLower);
        });
    }, [lcRecords, lcSearchText]);

    // Handle Keyboard navigation for LC Dropdown
    const handleLcKeyDown = (e) => {
        if (!isLcDropdownOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsLcDropdownOpen(true);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < filteredLcRecords.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredLcRecords.length > 0) {
                const targetIdx = highlightedIndex >= 0 && highlightedIndex < filteredLcRecords.length ? highlightedIndex : 0;
                const selected = filteredLcRecords[targetIdx];
                if (selected) {
                    const lcDetails = lcMarginMap[selected._id];
                    setFormData(prev => ({
                        ...prev,
                        lcId: selected._id,
                        lcNo: selected.lcNo || '',
                        importerName: selected.importerName || '',
                        bankName: selected.bankName || '',
                        returnAmount: prev.returnAmount || (lcDetails?.calcReturnAmount !== undefined ? String(lcDetails.calcReturnAmount) : '')
                    }));
                    setLcSearchText(`${selected.lcNo}${selected.importerName ? ` (${selected.importerName})` : ''} - ${selected.bankName}`);
                    setIsLcDropdownOpen(false);
                }
            }
        } else if (e.key === 'Escape') {
            setIsLcDropdownOpen(false);
        }
    };

    // Total summary metrics
    const totals = useMemo(() => {
        const totalMarginPaidAllLcs = lcRecords.reduce((sum, lc) => sum + getLcMarginPaid(lc), 0);
        const totalReturned = marginReturns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
        const totalPending = totalMarginPaidAllLcs - totalReturned;

        return {
            totalMarginPaid: totalMarginPaidAllLcs,
            totalReturned,
            totalPending: totalPending > 0 ? totalPending : 0,
            count: marginReturns.length
        };
    }, [lcRecords, marginReturns]);

    // Filtered Return Records
    const filteredRecords = useMemo(() => {
        return marginReturns.filter(item => {
            const lcDetails = lcMarginMap[item.lcId] || {};
            const itemBank = item.bankName || lcDetails.bankName || '';
            const itemImporter = item.importerName || lcDetails.importerName || '';
            const itemProduct = lcDetails.productName || item.productName || '';

            // Search Query Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    (item.lcNo || '').toLowerCase().includes(q) ||
                    itemImporter.toLowerCase().includes(q) ||
                    itemBank.toLowerCase().includes(q) ||
                    itemProduct.toLowerCase().includes(q) ||
                    (item.remarks || '').toLowerCase().includes(q);
                if (!matchesSearch) return false;
            }

            // Advanced Filters
            if (marginReturnFilters.startDate && item.returnDate && item.returnDate < marginReturnFilters.startDate) return false;
            if (marginReturnFilters.endDate && item.returnDate && item.returnDate > marginReturnFilters.endDate) return false;
            if (marginReturnFilters.lcNo && (item.lcNo || '').trim().toLowerCase() !== marginReturnFilters.lcNo.toLowerCase()) return false;
            if (marginReturnFilters.bankName && itemBank.trim().toLowerCase() !== marginReturnFilters.bankName.toLowerCase()) return false;
            if (marginReturnFilters.importerName && itemImporter.trim().toLowerCase() !== marginReturnFilters.importerName.toLowerCase()) return false;

            return true;
        });
    }, [marginReturns, searchQuery, marginReturnFilters, lcMarginMap]);

    // Open Modal for Add
    const handleOpenAddModal = () => {
        if (!canAdd) {
            alert('Forbidden: You do not have permission to add margin return records.');
            return;
        }
        setIsEditMode(false);
        setEditingId(null);
        setLcSearchText('');
        setHighlightedIndex(0);
        setIsLcDropdownOpen(false);
        setFormData({
            returnDate: new Date().toISOString().split('T')[0],
            lcId: '',
            lcNo: '',
            importerName: '',
            bankName: '',
            returnAmount: '',
            remarks: ''
        });
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditModal = (record) => {
        if (!canEdit) {
            alert('Forbidden: You do not have permission to edit margin return records.');
            return;
        }
        setIsEditMode(true);
        setEditingId(record._id);
        const displayText = record.lcNo ? `${record.lcNo}${record.importerName ? ` (${record.importerName})` : ''}` : '';
        setLcSearchText(displayText);
        setHighlightedIndex(0);
        setIsLcDropdownOpen(false);
        setFormData({
            returnDate: record.returnDate || new Date().toISOString().split('T')[0],
            lcId: record.lcId || '',
            lcNo: record.lcNo || '',
            importerName: record.importerName || '',
            bankName: record.bankName || '',
            returnAmount: record.returnAmount || '',
            remarks: record.remarks || ''
        });
        setIsModalOpen(true);
    };

    // Submit Add / Edit Form
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.lcNo) {
            alert('Please select an LC');
            return;
        }
        const amt = parseFloat(formData.returnAmount);
        if (isNaN(amt) || amt <= 0) {
            alert('Please enter a valid return amount');
            return;
        }

        setIsSaving(true);
        try {
            if (isEditMode) {
                const res = await axios.put(`${API_BASE_URL}/api/margin-returns/${editingId}`, formData);
                setMarginReturns(prev => prev.map(r => r._id === editingId ? res.data : r));
                addNotification?.('Margin Return record updated successfully', 'success');
            } else {
                const res = await axios.post(`${API_BASE_URL}/api/margin-returns`, formData);
                setMarginReturns(prev => [res.data, ...prev]);

                if (addNotification) {
                    addNotification(
                        'Margin Return Received',
                        `Margin return of ৳${amt.toLocaleString('en-IN')} for LC No: ${formData.lcNo} received.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }
                addNotification?.('Margin Return record added successfully', 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving Margin Return record:', error);
            addNotification?.('Failed to save Margin Return record', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Delete
    const handleDeleteClick = (record) => {
        if (!canDelete) {
            alert('Forbidden: You do not have permission to delete margin return records.');
            return;
        }
        setDeleteModalRecord(record);
    };

    const confirmDelete = async () => {
        if (!deleteModalRecord) return;
        try {
            await axios.delete(`${API_BASE_URL}/api/margin-returns/${deleteModalRecord._id}`);
            setMarginReturns(prev => prev.filter(r => r._id !== deleteModalRecord._id));
            addNotification?.('Margin Return record deleted successfully', 'success');
            setDeleteModalRecord(null);
        } catch (error) {
            console.error('Error deleting Margin Return record:', error);
            addNotification?.('Failed to delete Margin Return record', 'error');
        }
    };

    // Export to CSV
    const handleExportCSV = () => {
        const headers = ['Return Date', 'LC No', 'Importer', 'Product', 'Bank Name', 'Branch', 'AC No', 'Return Amount (BDT)', 'Remarks'];
        const rows = filteredRecords.map(r => {
            const lcDetails = lcMarginMap[r.lcId] || {};
            return [
                r.returnDate || '',
                `"${r.lcNo || ''}"`,
                `"${r.importerName || ''}"`,
                `"${lcDetails.productName || r.productName || ''}"`,
                `"${r.bankName || ''}"`,
                `"${lcDetails.bankBranch || r.bankBranch || ''}"`,
                `"${lcDetails.accountNo || r.accountNo || ''}"`,
                parseFloat(r.returnAmount || 0).toFixed(2),
                `"${r.remarks || ''}"`
            ];
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Margin_Return_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!canView) {
        return (
            <div className="p-8 text-center text-red-600 bg-red-50 rounded-2xl border border-red-100 max-w-xl mx-auto my-12 shadow-sm">
                <h3 className="text-lg font-bold">Access Denied</h3>
                <p className="text-sm mt-1">You do not have permission to view the Margin Return module.</p>
            </div>
        );
    }

    const selectedLcDetails = formData.lcId ? lcMarginMap[formData.lcId] : null;

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="w-full md:w-auto text-center md:text-left">
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Margin Return</h2>
                </div>

                <div className="w-full max-w-md mx-auto relative group px-2 md:px-0">
                    <div className="absolute inset-y-0 left-0 pl-12 md:pl-3.5 flex items-center pointer-events-none">
                        <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search LC No, Importer, Bank..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-4 py-2.5 md:py-2 bg-white/50 border border-gray-200 rounded-xl text-[13px] text-center md:text-left placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                    />
                </div>
                <div className="flex items-center justify-center md:justify-end gap-2 w-full md:w-auto z-[60]">
                    {/* Filter Button & Panel */}
                    <div className="relative">
                        <button
                            ref={filterButtonRef}
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border h-[40px] ${showFilterPanel || Object.values(marginReturnFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FunnelIcon className={`w-4 h-4 ${(showFilterPanel || (marginReturnFilters && Object.values(marginReturnFilters).some(v => v !== ''))) ? 'text-white' : 'text-gray-400'}`} />
                            <span className="text-sm font-medium">Filter</span>
                        </button>

                        {/* Floating Filter Panel */}
                        {showFilterPanel && (
                            <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[400px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200 text-left">
                                <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                    <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMarginReturnFilters(initialMarginReturnFilterState);
                                            setFilterSearchInputs({
                                                lcSearch: '',
                                                bankSearch: '',
                                                importerSearch: ''
                                            });
                                            setFilterDropdownOpen(initialFilterDropdownState);
                                            setShowFilterPanel(false);
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
                                            value={marginReturnFilters.startDate}
                                            onChange={(e) => setMarginReturnFilters({ ...marginReturnFilters, startDate: e.target.value })}
                                            compact={true}
                                        />
                                        <CustomDatePicker
                                            label="To Date"
                                            value={marginReturnFilters.endDate}
                                            onChange={(e) => setMarginReturnFilters({ ...marginReturnFilters, endDate: e.target.value })}
                                            compact={true}
                                        />
                                    </div>

                                    {/* LC Filter */}
                                    <div className="space-y-1.5 relative" ref={lcFilterRef}>
                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC No</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={filterSearchInputs.lcSearch}
                                                onChange={(e) => {
                                                    setFilterSearchInputs({ ...filterSearchInputs, lcSearch: e.target.value });
                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true });
                                                }}
                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, lcNo: true })}
                                                placeholder={marginReturnFilters.lcNo || "Search LC No..."}
                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${marginReturnFilters.lcNo ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                            />
                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {marginReturnFilters.lcNo && (
                                                    <button type="button" onClick={() => { setMarginReturnFilters({ ...marginReturnFilters, lcNo: '' }); setFilterSearchInputs({ ...filterSearchInputs, lcSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {filterDropdownOpen.lcNo && (() => {
                                            const filtered = getFilteredOptions('marginReturnFilterLc') || [];
                                            return filtered.length > 0 ? (
                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                    {filtered.map(opt => (
                                                        <button key={opt} type="button" onClick={() => { setMarginReturnFilters({ ...marginReturnFilters, lcNo: opt }); setFilterSearchInputs({ ...filterSearchInputs, lcSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium">{opt}</button>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>

                                    {/* Bank Filter */}
                                    <div className="space-y-1.5 relative" ref={bankFilterRef}>
                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bank</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={filterSearchInputs.bankSearch}
                                                onChange={(e) => {
                                                    setFilterSearchInputs({ ...filterSearchInputs, bankSearch: e.target.value });
                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, bankName: true });
                                                }}
                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, bankName: true })}
                                                placeholder={marginReturnFilters.bankName || "Search Bank..."}
                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${marginReturnFilters.bankName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                            />
                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {marginReturnFilters.bankName && (
                                                    <button type="button" onClick={() => { setMarginReturnFilters({ ...marginReturnFilters, bankName: '' }); setFilterSearchInputs({ ...filterSearchInputs, bankSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {filterDropdownOpen.bankName && (() => {
                                            const filtered = getFilteredOptions('marginReturnFilterBank') || [];
                                            return filtered.length > 0 ? (
                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                    {filtered.map(opt => (
                                                        <button key={opt} type="button" onClick={() => { setMarginReturnFilters({ ...marginReturnFilters, bankName: opt }); setFilterSearchInputs({ ...filterSearchInputs, bankSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium">{opt}</button>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}
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
                                                    setFilterDropdownOpen({ ...initialFilterDropdownState, importerName: true });
                                                }}
                                                onFocus={() => setFilterDropdownOpen({ ...initialFilterDropdownState, importerName: true })}
                                                placeholder={marginReturnFilters.importerName || "Search Importer..."}
                                                className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${marginReturnFilters.importerName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                            />
                                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {marginReturnFilters.importerName && (
                                                    <button type="button" onClick={() => { setMarginReturnFilters({ ...marginReturnFilters, importerName: '' }); setFilterSearchInputs({ ...filterSearchInputs, importerSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {filterDropdownOpen.importerName && (() => {
                                            const filtered = getFilteredOptions('marginReturnFilterImporter') || [];
                                            return filtered.length > 0 ? (
                                                <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                    {filtered.map(opt => (
                                                        <button key={opt} type="button" onClick={() => { setMarginReturnFilters({ ...marginReturnFilters, importerName: opt }); setFilterSearchInputs({ ...filterSearchInputs, importerSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors font-medium">{opt}</button>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Report Button */}
                    <button
                        type="button"
                        onClick={handleGenerateReport}
                        className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 h-[40px] shadow-sm transform active:scale-95 md:hover:scale-105"
                    >
                        <BarChartIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Report</span>
                    </button>

                    {canAdd && (
                        <button
                            onClick={handleOpenAddModal}
                            className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap h-[40px]"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            <span>Add Return</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total LC Margin Paid</p>
                        <h3 className="text-base md:text-2xl font-black text-gray-800">৳{totals.totalMarginPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div className="w-9 h-9 md:w-12 md:h-12 bg-blue-50 rounded-xl hidden md:flex items-center justify-center shrink-0">
                        <BuildingIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Returned</p>
                        <h3 className="text-base md:text-2xl font-black text-emerald-600">৳{totals.totalReturned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div className="w-9 h-9 md:w-12 md:h-12 bg-emerald-50 rounded-xl hidden md:flex items-center justify-center shrink-0">
                        <RotateCcwIcon className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pending Margin</p>
                        <h3 className="text-base md:text-2xl font-black text-amber-600">৳{totals.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                    </div>
                    <div className="w-9 h-9 md:w-12 md:h-12 bg-amber-50 rounded-xl hidden md:flex items-center justify-center shrink-0">
                        <DollarSignIcon className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-3 md:p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Return Records</p>
                        <h3 className="text-base md:text-2xl font-black text-gray-800">{totals.count} Records</h3>
                    </div>
                    <div className="w-9 h-9 md:w-12 md:h-12 bg-purple-50 rounded-xl hidden md:flex items-center justify-center shrink-0">
                        <FileTextIcon className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white/70 backdrop-blur-sm rounded-3xl border border-white/60 shadow-sm overflow-hidden overflow-x-auto transition-all duration-500">
                <table className="w-full text-left min-w-[1000px]">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Date</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">LC No</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Importer</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Product</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Bank</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Branch</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">AC No</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Return Amount</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Remarks</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {isLoading ? (
                            <tr><td colSpan="10" className="px-6 py-12 text-center text-gray-400">Loading margin return records...</td></tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr><td colSpan="10" className="px-6 py-12 text-center text-gray-400">No Margin Return records found.</td></tr>
                        ) : (
                            filteredRecords.map((record) => {
                                const lcDetails = lcMarginMap[record.lcId] || {};
                                return (
                                    <tr key={record._id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {formatDate(record.returnDate)}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm font-bold text-gray-900">
                                            {record.lcNo || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 text-sm text-blue-600 font-medium max-w-[140px] truncate" title={record.importerName}>
                                            {record.importerName || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 text-sm text-gray-700 font-medium max-w-[150px] truncate" title={lcDetails.productName || record.productName}>
                                            {lcDetails.productName || record.productName || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {record.bankName || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {lcDetails.bankBranch || record.bankBranch || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm text-gray-700 font-mono">
                                            {lcDetails.accountNo || record.accountNo || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 whitespace-nowrap text-sm font-black text-emerald-600 text-right">
                                            ৳{parseFloat(record.returnAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[180px] truncate" title={record.remarks}>
                                            {record.remarks || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleOpenEditModal(record)}
                                                        className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-xl transition-all active:scale-90"
                                                        title="Edit Record"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteClick(record)}
                                                        className="p-1.5 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-all active:scale-90"
                                                        title="Delete Record"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
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

            {/* Mobile View */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400">
                        Loading records...
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 shadow-sm text-gray-400 italic text-sm">
                        No Margin Return records found.
                    </div>
                ) : (
                    filteredRecords.map((record, idx) => {
                        const isExpanded = expandedRecordIdx === idx;
                        const lcDetails = lcMarginMap[record.lcId] || {};
                        return (
                            <div key={record._id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-50' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                                <div
                                    className="flex justify-between items-center p-4 cursor-pointer select-none active:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedRecordIdx(isExpanded ? null : idx)}
                                >
                                    <div>
                                        <span className="text-xs text-gray-400 font-medium block mb-0.5">{formatDate(record.returnDate)}</span>
                                        <h4 className="text-sm font-bold text-gray-900">{record.lcNo}</h4>
                                        <span className="text-xs text-blue-600 font-medium block">{record.importerName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-emerald-600">
                                            ৳{parseFloat(record.returnAmount || 0).toLocaleString('en-IN')}
                                        </span>
                                        {isExpanded ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-4 duration-300">
                                        <div className="grid grid-cols-[120px_8px_1fr] gap-y-2 pt-3 items-baseline">
                                            <span className="font-bold text-gray-400 uppercase text-[10px]">Product</span>
                                            <span className="text-gray-400">:</span>
                                            <span className="font-semibold text-gray-800">{lcDetails.productName || record.productName || '-'}</span>

                                            <span className="font-bold text-gray-400 uppercase text-[10px]">Bank Name</span>
                                            <span className="text-gray-400">:</span>
                                            <span className="font-semibold text-gray-800">{record.bankName || '-'}</span>

                                            <span className="font-bold text-gray-400 uppercase text-[10px]">Branch</span>
                                            <span className="text-gray-400">:</span>
                                            <span className="font-semibold text-gray-800">{lcDetails.bankBranch || record.bankBranch || '-'}</span>

                                            <span className="font-bold text-gray-400 uppercase text-[10px]">AC No</span>
                                            <span className="text-gray-400">:</span>
                                            <span className="font-mono text-gray-800">{lcDetails.accountNo || record.accountNo || '-'}</span>

                                            <span className="font-bold text-gray-400 uppercase text-[10px]">Remarks</span>
                                            <span className="text-gray-400">:</span>
                                            <span className="text-gray-600">{record.remarks || '-'}</span>
                                        </div>

                                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleOpenEditModal(record)}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDeleteClick(record)}
                                                    className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-xl w-full p-6 md:p-8 border border-white/60 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg md:text-xl font-bold text-gray-900">
                                    {isEditMode ? 'Edit Margin Return' : 'Add New Margin Return'}
                                </h3>
                                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mt-0.5">
                                    Margin Return Details
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-all"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body Form */}
                        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 space-y-4 pr-1 pb-44">
                            {/* Searchable LC Autocomplete Dropdown */}
                            <div className="space-y-1.5 text-left relative" ref={lcDropdownRef}>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Select LC Record <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={lcSearchText}
                                        onChange={(e) => {
                                            setLcSearchText(e.target.value);
                                            setIsLcDropdownOpen(true);
                                            setHighlightedIndex(0);
                                            if (!e.target.value) {
                                                setFormData(prev => ({ ...prev, lcId: '', lcNo: '', importerName: '', bankName: '' }));
                                            }
                                        }}
                                        onFocus={() => {
                                            setIsLcDropdownOpen(true);
                                            setHighlightedIndex(0);
                                        }}
                                        onKeyDown={handleLcKeyDown}
                                        placeholder="Search & Select LC No / Importer / Bank..."
                                        className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all pr-16"
                                        required={!formData.lcId}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                        {(lcSearchText || formData.lcId) && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setLcSearchText('');
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        lcId: '',
                                                        lcNo: '',
                                                        importerName: '',
                                                        bankName: '',
                                                        returnAmount: ''
                                                    }));
                                                    setIsLcDropdownOpen(true);
                                                }}
                                                className="p-0.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer"
                                                title="Remove selected LC"
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-400 pointer-events-none" />
                                        <ChevronDownIcon className={`w-4 h-4 text-gray-400 pointer-events-none transition-transform ${isLcDropdownOpen ? 'transform rotate-180' : ''}`} />
                                    </div>
                                </div>

                                {isLcDropdownOpen && (
                                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 animate-in fade-in duration-150">
                                        {filteredLcRecords.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">
                                                No matching LC records found
                                            </div>
                                        ) : (
                                            filteredLcRecords.map((lc, idx) => (
                                                <button
                                                    key={lc._id}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        const lcDetails = lcMarginMap[lc._id];
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            lcId: lc._id,
                                                            lcNo: lc.lcNo || '',
                                                            importerName: lc.importerName || '',
                                                            bankName: lc.bankName || '',
                                                            returnAmount: prev.returnAmount || (lcDetails?.calcReturnAmount !== undefined ? String(lcDetails.calcReturnAmount) : '')
                                                        }));
                                                        setLcSearchText(`${lc.lcNo}${lc.importerName ? ` (${lc.importerName})` : ''} - ${lc.bankName}`);
                                                        setIsLcDropdownOpen(false);
                                                    }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2.5 text-left text-xs transition-colors flex items-center justify-between border-b border-gray-50 last:border-none ${highlightedIndex === idx ? 'bg-blue-50/90 text-blue-700 font-bold' : 'text-gray-700 hover:bg-blue-50/70'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-900">LC: {lc.lcNo}</span>
                                                        <span className="text-[11px] text-gray-500">{lc.importerName} • {lc.bankName}</span>
                                                    </div>
                                                    {formData.lcId === lc._id && (
                                                        <span className="text-[11px] font-bold text-blue-600">Selected</span>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* LC Margin Info Banner */}
                            {selectedLcDetails && (
                                <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100/80 grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Value</span>
                                        <span className="text-xs font-black text-gray-800">৳{selectedLcDetails.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Margin Paid</span>
                                        <span className="text-xs font-black text-blue-600">৳{selectedLcDetails.marginPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Return Amount</span>
                                        <span className="text-xs font-black text-emerald-600">৳{selectedLcDetails.calcReturnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-left">
                                    <CustomDatePicker
                                        label="Return Date"
                                        value={formData.returnDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, returnDate: e.target.value }))}
                                        compact={true}
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Return Amount (BDT) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.returnAmount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, returnAmount: e.target.value }))}
                                        required
                                        className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    Remarks
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Optional notes or details..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50 text-xs"
                                >
                                    {isSaving ? 'Saving...' : (isEditMode ? 'Update Return' : 'Save Return')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Modal */}
            {deleteModalRecord && typeof document !== 'undefined' && document.body && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150 relative z-10">
                        <h3 className="text-base font-bold text-gray-900">Delete Margin Return?</h3>
                        <p className="text-xs text-gray-500 mt-2">
                            Are you sure you want to delete the margin return record for LC <strong className="text-gray-800">{deleteModalRecord.lcNo}</strong> (৳{parseFloat(deleteModalRecord.returnAmount || 0).toLocaleString('en-IN')})?
                        </p>
                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button
                                onClick={() => setDeleteModalRecord(null)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MarginReturn;
