import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from '../../../utils/api';
import {
    PlusIcon, XIcon, EditIcon, TrashIcon, SearchIcon,
    LCManagerIcon, ShieldIcon, BuildingIcon, GlobeIcon,
    DollarSignIcon, CalendarIcon, ChevronDownIcon, ChevronUpIcon, EyeIcon, FileTextIcon, CheckIcon,
    FunnelIcon
} from '../../Icons';
import { formatDate, API_BASE_URL } from '../../../utils/helpers';
import { decryptData } from '../../../utils/encryption';
import CustomDatePicker from '../../shared/CustomDatePicker';

const gridColsClassMap = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    7: 'md:grid-cols-7',
    8: 'md:grid-cols-8',
    9: 'md:grid-cols-9'
};

const ViewDetailsModal = ({ data, onClose, allStockRecords = [], allSalesRecords = [], gpRecords = [], lcExpenses = [], piRecordsRaw = [], onEdit, onEditAmendment, canManage, onRefresh }) => {
    const [showConsumption, setShowConsumption] = useState(true);
    const [consumptionSearchQuery, setConsumptionSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('history');
    const [expandedSubRowKey, setExpandedSubRowKey] = useState(null);
    const [activeMilestoneIndex, setActiveMilestoneIndex] = useState(0);
    const [insurancePayments, setInsurancePayments] = useState([]);
    const [cnfPayments, setCnfPayments] = useState([]);

    // States for Add Bill inside modal
    const [showAddBillModal, setShowAddBillModal] = useState(false);
    const [billFormData, setBillFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        lcNo: data.lcNo,
        bankName: data.bankName || '',
        expenseHead: '',
        cnfAgent: '',
        amount: '',
        remarks: ''
    });
    const [isSavingBill, setIsSavingBill] = useState(false);
    const [bdCnfs, setBdCnfs] = useState([]);
    const [billHeadDropdownOpen, setBillHeadDropdownOpen] = useState(false);
    const [billHeadQuery, setBillHeadQuery] = useState('');
    const [billHeadHighlight, setBillHeadHighlight] = useState(-1);
    const billHeadRef = React.useRef(null);


    useEffect(() => {
        const fetchCnfs = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/cnfs`);
                const bdAgents = Array.isArray(response.data) ? response.data.filter(c => c.type !== 'Indian') : [];
                const agentNames = Array.from(new Set(bdAgents.map(a => a.name).filter(Boolean)));
                setBdCnfs(agentNames);
            } catch (error) {
                console.error("Error fetching C&F Agents in details modal:", error);
            }
        };
        fetchCnfs();
    }, []);

    // Close bill head dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (billHeadRef.current && !billHeadRef.current.contains(e.target)) {
                setBillHeadDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const expenseHeads = [
        "Bank Charges",
        "Margin Bill",
        "Customs Duty",
        "C&F Commission",
        "Port Demurrage",
        "Transport Cost",
        "Other"
    ];



    const handleSaveBill = async (e) => {
        e.preventDefault();
        setIsSavingBill(true);
        try {
            const dataToSubmit = {
                ...billFormData,
                amount: parseFloat(billFormData.amount) || 0,
                type: 'bill'
            };
            await axios.post(`${API_BASE_URL}/api/lc-expenses`, dataToSubmit);
            setShowAddBillModal(false);
            setBillFormData({
                date: new Date().toISOString().split('T')[0],
                lcNo: data.lcNo,
                bankName: data.bankName || '',
                expenseHead: '',
                cnfAgent: '',
                amount: '',
                remarks: ''
            });
            setBillHeadQuery('');
            setBillHeadDropdownOpen(false);
            if (onRefresh) {
                await onRefresh();
            }
        } catch (error) {
            console.error("Error saving bill inside modal:", error);
        } finally {
            setIsSavingBill(false);
        }
    };

    useEffect(() => {
        const fetchPaymentsData = async () => {
            try {
                const [insPayRes, cnfPayRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/insurance-payments`),
                    axios.get(`${API_BASE_URL}/api/cnf-payments`)
                ]);
                setInsurancePayments(Array.isArray(insPayRes.data) ? insPayRes.data : []);
                setCnfPayments(Array.isArray(cnfPayRes.data) ? cnfPayRes.data : []);
            } catch (error) {
                console.error("Error fetching payments in modal:", error);
            }
        };
        if (data && data.lcNo) {
            fetchPaymentsData();
        }
    }, [data]);

    const timeline = useMemo(() => {
        return getLCHistoryTimeline(data);
    }, [data]);

    const activeMilestone = useMemo(() => {
        return timeline[activeMilestoneIndex] || timeline[0] || {};
    }, [timeline, activeMilestoneIndex]);

    const getMilestoneTotalQty = (mil) => {
        if (!mil) return 0;
        if (mil.productsList && mil.productsList.length > 0) {
            return mil.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
        }
        return parseFloat(mil.quantity || 0);
    };

    if (!data) return null;

    // Failsafe LC Matching helper
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    const lcNoClean = cleanLc(data.lcNo);

    // Calculate Consumptions
    const receiptsMap = {};
    allStockRecords
        .filter(s => {
            const recordLcNoClean = cleanLc(s.lcNo);
            const status = (s.status || '').toLowerCase();
            return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
        })
        .forEach(s => {
            // Ensure date key is just the day, so milliseconds in createdAt don't break grouping
            const rawDate = s.date || s.receiveDate || s.createdAt || '';
            const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

            // Group by date, and total quantity or truck to merge split records from the same transaction
            const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
            const key = `${dateStr}_${groupVal}`;

            if (!receiptsMap[key]) {
                const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                const truckNumeric = parseFloat(s.totalLcTruck || s.truckNo || s.truck) || 0;
                receiptsMap[key] = {
                    date: rawDate,
                    importer: s.importer || data.importer,
                    exporter: s.exporter || data.exporter,
                    product: s.productName || data.productName,
                    truck: s.totalLcTruck || s.truckNo || s.truck || '-',
                    truckCount: truckNumeric,
                    quantity: parseNum(s.totalLcQuantity) || itemSubtotal || parseNum(s.inHouseQuantity) || parseNum(s.quantity),
                    source: 'LC Receive',
                    _products: new Set([s.productName || data.productName])
                };
            } else {
                receiptsMap[key]._products.add(s.productName || data.productName);
                if (receiptsMap[key]._products.size > 1) {
                    receiptsMap[key].product = 'Multiple Products';
                }
                // If the group doesn't have a totalLcQuantity, accumulate the individual pieces
                if (!s.totalLcQuantity) {
                    receiptsMap[key].quantity += parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                }
            }
        });

    const relatedReceipts = Object.values(receiptsMap);

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

    const consumptionHistory = [...relatedReceipts, ...relatedSales].sort((a, b) => new Date(a.date) - new Date(b.date));

    // G.P List for this LC
    const relatedGpRecords = gpRecords.filter(gp => {
        const gpLcClean = cleanLc(gp.lcNumber);
        return gpLcClean === lcNoClean;
    });

    // Filter consumption history based on search query
    const filteredConsumptionHistory = consumptionHistory.filter(item => {
        if (!consumptionSearchQuery.trim()) return true;
        const q = consumptionSearchQuery.toLowerCase().trim();
        return (
            (formatDate(item.date) || '').toLowerCase().includes(q) ||
            (item.importer || '').toLowerCase().includes(q) ||
            (item.exporter || '').toLowerCase().includes(q) ||
            (item.product || '').toLowerCase().includes(q) ||
            String(item.truck || '').toLowerCase().includes(q) ||
            (item.source || '').toLowerCase().includes(q) ||
            String(parseNum(item.quantity)).includes(q)
        );
    });

    // Filter GP records based on search query
    const filteredGpRecords = relatedGpRecords.filter(gp => {
        if (!consumptionSearchQuery.trim()) return true;
        const q = consumptionSearchQuery.toLowerCase().trim();
        return (
            (formatDate(gp.gpDate) || '').toLowerCase().includes(q) ||
            (gp.partyName || '').toLowerCase().includes(q) ||
            (gp.party || '').toLowerCase().includes(q) ||
            (gp.productName || '').toLowerCase().includes(q) ||
            String(parseNum(gp.gpQuantity)).includes(q) ||
            (gp.remarks || '').toLowerCase().includes(q)
        );
    });

    // Summary Calculations
    const products = data.productsList?.length > 0
        ? data.productsList
        : [{
            productName: data.productName || '',
            hsCode: data.hsCode || '',
            quantity: data.quantity || '',
            rate: data.rate || '',
            freight: data.freight || '',
            totalFreight: data.totalFreight || '',
            totalDollar: data.totalDollar || ''
        }];

    const activeProducts = useMemo(() => {
        const baseProducts = activeMilestone.productsList?.length > 0
            ? activeMilestone.productsList
            : (data.productsList?.length > 0
                ? data.productsList
                : [{
                    productName: data.productName || '',
                    hsCode: data.hsCode || '',
                    quantity: data.quantity || '',
                    rate: data.rate || '',
                    freight: data.freight || '',
                    totalFreight: data.totalFreight || '',
                    totalDollar: data.totalDollar || ''
                }]);

        return baseProducts.map((p, idx) => {
            const fVal = parseFloat(p.freight || 0);
            const scaledFreight = fVal > 0 ? (fVal < 0.1 ? String(fVal * 1000) : String(fVal)) : '';
            if (idx === 0 && baseProducts.length === 1) {
                const rVal = parseFloat(activeMilestone.rate || p.rate || 0);
                const scaledRate = rVal > 0 ? (rVal < 10 ? String(rVal * 1000) : String(activeMilestone.rate || p.rate)) : '';
                return {
                    ...p,
                    quantity: activeMilestone.quantity || p.quantity,
                    rate: scaledRate,
                    freight: scaledFreight,
                    totalDollar: activeMilestone.totalDollar || p.totalDollar
                };
            }
            return {
                ...p,
                freight: scaledFreight
            };
        });
    }, [data, activeMilestone]);

    const adj = useMemo(() => {
        const totalQtyTons = data.productsList && data.productsList.length > 0
            ? data.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
            : (parseFloat(data.quantity) || 0);
        const openingQtyKg = totalQtyTons * 1000;
        const openingValue = parseFloat(data.totalAmount) || 0;

        // Calculate receipts
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
                return sum + (parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal);
            }, 0);

        const totalReceivedQtyKg = receivedQtyKg + borderSaleQtyKg;
        const rawBalanceKg = openingQtyKg - totalReceivedQtyKg;

        let adjustmentQtyKg = 0;
        if (rawBalanceKg < 0) {
            const excessQtyKg = -rawBalanceKg;
            const maxAdjustmentKg = openingQtyKg * 0.10;
            adjustmentQtyKg = Math.min(excessQtyKg, maxAdjustmentKg);
        }

        const isEnabled = !!data.enableValueQtyAdjustment;
        const actualAdjustmentQtyKg = isEnabled ? adjustmentQtyKg : 0;
        const adjustedQtyKg = openingQtyKg + actualAdjustmentQtyKg;
        
        const adjustedTotalAmount = isEnabled && openingQtyKg > 0
            ? openingValue + (actualAdjustmentQtyKg * (openingValue / openingQtyKg))
            : openingValue;

        const addedValue = adjustedTotalAmount - openingValue;

        return {
            openingQtyKg,
            openingValue,
            actualAdjustmentQtyKg,
            adjustedQtyKg,
            adjustedTotalAmount,
            addedValue,
            isEnabled
        };
    }, [data, allStockRecords, allSalesRecords, lcNoClean]);

    const totalLcQtyTons = products.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
    const totalLcQtyKg = totalLcQtyTons * 1000;
    const displayTotalLcQtyKg = data.enableValueQtyAdjustment ? adj.adjustedQtyKg : totalLcQtyKg;
    const consumedQtyKg = consumptionHistory.reduce((sum, item) => sum + parseNum(item.quantity), 0);
    const remQtyKg = totalLcQtyKg - consumedQtyKg;
    // truckNo is a numeric count per entry — sum all values instead of counting unique strings
    const truckCount = consumptionHistory.reduce((sum, item) => sum + (item.truckCount || 0), 0);

    const getCnfBillStatus = (agentName) => {
        if (!agentName) return "Unpaid";
        const cleanAgent = agentName.toLowerCase().trim();
        const totalEarned = lcExpenses
            .filter(e => e.cnfAgent && e.cnfAgent.toLowerCase().trim() === cleanAgent)
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const totalPaid = cnfPayments
            .filter(p => p.cnfName && p.cnfName.toLowerCase().trim() === cleanAgent)
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        if (totalPaid >= totalEarned && totalEarned > 0) return "Paid";
        if (totalPaid > 0 && totalPaid < totalEarned) return "Partial Paid";
        return "Unpaid";
    };

    const bills = [];

    // Calculate total bank charges paid from LC expenses (excluding added bills)
    const totalBankChargesPaid = lcExpenses
        .filter(e => e.lcNo === data.lcNo && e.expenseHead === 'Bank Charges' && e.type !== 'bill')
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    let remainingBankPaid = totalBankChargesPaid;
    let lastBankBillIdx = -1;

    // Calculate total margin payments from LC expenses (excluding added bills)
    const totalMarginPayments = lcExpenses
        .filter(e => e.lcNo === data.lcNo && e.expenseHead === 'Margin Bill' && e.type !== 'bill')
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    let remainingMarginPaid = totalMarginPayments;
    let lastMarginBillIdx = -1;

    // 1. Margin Bill (Original)
    const marginBillAmt = parseFloat(data.marginBill) || parseFloat(data.totalAmount) || 0;
    if (marginBillAmt > 0) {
        const origMarginPaidBase = parseFloat(data.marginPaid) || (() => {
            const total = parseFloat(data.totalAmount) || 0;
            const margin = parseFloat(data.bankMargin) || 0;
            return total * (margin / 100);
        })();

        const paidForOrig = Math.min(remainingMarginPaid, Math.max(0, marginBillAmt - origMarginPaidBase));
        remainingMarginPaid -= paidForOrig;

        const marginPaidAmt = origMarginPaidBase + paidForOrig;

        let marginStatus = "Unpaid";
        if (marginPaidAmt >= marginBillAmt) {
            marginStatus = "Paid";
        } else if (marginPaidAmt > 0) {
            marginStatus = "Partial Paid";
        }

        bills.push({
            date: data.openingDate || data.createdAt,
            billHead: "Margin Bill",
            name: data.bankName || "Bank",
            totalBill: marginBillAmt,
            paidBill: marginPaidAmt,
            billBalance: Math.max(0, marginBillAmt - marginPaidAmt),
            status: marginStatus
        });
        lastMarginBillIdx = bills.length - 1;
    }

    // 2. Bank Bill (Original)
    const isNewBilling = data.marginPaid !== undefined || data.marginBill !== undefined;
    const bankBillAmt = isNewBilling ? (parseFloat(data.bankBill) || 0) : (parseFloat(data.totalBankBill || data.bankBill) || 0);
    if (bankBillAmt > 0) {
        const paid = Math.min(remainingBankPaid, bankBillAmt);
        remainingBankPaid -= paid;

        let originalBankStatus = "Unpaid";
        if (paid >= bankBillAmt) {
            originalBankStatus = "Paid";
        } else if (paid > 0) {
            originalBankStatus = "Partial Paid";
        }

        bills.push({
            date: data.openingDate || data.createdAt,
            billHead: "Bank Bill",
            name: data.bankName || "Bank",
            totalBill: bankBillAmt,
            paidBill: paid,
            billBalance: Math.max(0, bankBillAmt - paid),
            status: originalBankStatus
        });
        lastBankBillIdx = bills.length - 1;
    }

    // 3. Margin Bill & Bank Bill (Amendments)
    if (data.amendments && data.amendments.length > 0) {
        data.amendments.forEach((amnd, idx) => {
            if (amnd.amendmentNo === 'Original LC') return;

            // Push Amendment Margin Bill
            const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
            if (amndMarginBill > 0) {
                const amndMarginPaidBase = parseFloat(amnd.amendmentMarginPaid) || (() => {
                    const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (data.bankMargin !== undefined ? parseFloat(data.bankMargin) : 0);
                    return amndMarginBill * (margin / 100);
                })();

                const paidForAmnd = Math.min(remainingMarginPaid, Math.max(0, amndMarginBill - amndMarginPaidBase));
                remainingMarginPaid -= paidForAmnd;

                const amndMarginPaid = amndMarginPaidBase + paidForAmnd;

                let amndMarginStatus = "Unpaid";
                if (amndMarginPaid >= amndMarginBill) {
                    amndMarginStatus = "Paid";
                } else if (amndMarginPaid > 0) {
                    amndMarginStatus = "Partial Paid";
                }

                bills.push({
                    date: amnd.amendmentDate || data.openingDate,
                    billHead: `Margin Bill (${amnd.amendmentNo || `Amend #${idx + 1}`})`,
                    name: data.bankName || "Bank",
                    totalBill: amndMarginBill,
                    paidBill: amndMarginPaid,
                    billBalance: Math.max(0, amndMarginBill - amndMarginPaid),
                    status: amndMarginStatus
                });
                lastMarginBillIdx = bills.length - 1;
            }

            // Push Amendment Bank Bill
            const isAmndNewBilling = amnd.amendmentMarginPaid !== undefined || amnd.amendmentMarginBill !== undefined;
            const amndBillAmt = isAmndNewBilling ? (parseFloat(amnd.amendmentBankBill) || 0) : (parseFloat(amnd.totalAmendmentBankBill || amnd.amendmentBill || amnd.amendmentBankBill) || 0);
            if (amndBillAmt > 0) {
                const paid = Math.min(remainingBankPaid, amndBillAmt);
                remainingBankPaid -= paid;

                let amndStatus = "Unpaid";
                if (paid >= amndBillAmt) {
                    amndStatus = "Paid";
                } else if (paid > 0) {
                    amndStatus = "Partial Paid";
                }

                bills.push({
                    date: amnd.amendmentDate || data.openingDate,
                    billHead: `Bank Bill (${amnd.amendmentNo || `Amend #${idx + 1}`})`,
                    name: data.bankName || "Bank",
                    totalBill: amndBillAmt,
                    paidBill: paid,
                    billBalance: Math.max(0, amndBillAmt - paid),
                    status: amndStatus
                });
                lastBankBillIdx = bills.length - 1;
            }
        });
    }

    // If there is excess margin paid, attribute to last margin charges bill row
    if (remainingMarginPaid > 0 && lastMarginBillIdx !== -1) {
        bills[lastMarginBillIdx].paidBill += remainingMarginPaid;
        bills[lastMarginBillIdx].billBalance = Math.max(0, bills[lastMarginBillIdx].totalBill - bills[lastMarginBillIdx].paidBill);
        bills[lastMarginBillIdx].status = bills[lastMarginBillIdx].paidBill >= bills[lastMarginBillIdx].totalBill ? "Paid" : "Partial Paid";
        remainingMarginPaid = 0;
    }

    // If there is excess bank charges paid, attribute to last bank charges bill row
    if (remainingBankPaid > 0 && lastBankBillIdx !== -1) {
        bills[lastBankBillIdx].paidBill += remainingBankPaid;
        bills[lastBankBillIdx].billBalance = Math.max(0, bills[lastBankBillIdx].totalBill - bills[lastBankBillIdx].paidBill);
        bills[lastBankBillIdx].status = "Paid";
        remainingBankPaid = 0; // consumed by original bill — don't carry over to custom bills
    }

    // 3. Insurance Bill
    const insBillAmt = parseFloat(data.grossPremium || data.netPremium) || 0;
    if (insBillAmt > 0) {
        const paidAmt = insurancePayments
            .filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        const paid = Math.min(paidAmt, insBillAmt);
        let status = "Unpaid";
        if (paid >= insBillAmt) {
            status = "Paid";
        } else if (paid > 0) {
            status = "Partial Paid";
        }

        bills.push({
            date: data.marineCNDate || data.openingDate || data.createdAt,
            billHead: "Insurance Bill",
            name: data.insuranceCo || "Insurance",
            totalBill: insBillAmt,
            paidBill: paid,
            billBalance: Math.max(0, insBillAmt - paid),
            status: status
        });
    }

    // 4. Expenses (C&F and Others)
    const cnfAgentPaidMap = {};
    lcExpenses
        .filter(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead === 'C&F Commission' && e.cnfAgent && e.type !== 'bill')
        .forEach(e => {
            const cleanAgent = e.cnfAgent.toLowerCase().trim();
            cnfAgentPaidMap[cleanAgent] = (cnfAgentPaidMap[cleanAgent] || 0) + (parseFloat(e.amount) || 0);
        });

    const cnfAgentPaidRemaining = { ...cnfAgentPaidMap };

    // Find all stock arrivals for this LC with C&F info
    const cnfArrivals = allStockRecords.filter(s => {
        const recordLcNoClean = cleanLc(s.lcNo);
        const status = (s.status || '').toLowerCase();
        return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock') && s.bdCnF;
    });

    const processedCnfAgents = new Set();
    const lastCnfBillIdxMap = {};

    cnfArrivals.forEach(s => {
        const billAmt = parseFloat(s.bdCnFCost) || 0;
        if (billAmt <= 0) return;

        const cleanAgent = s.bdCnF.toLowerCase().trim();
        processedCnfAgents.add(cleanAgent);

        const remainingPaid = cnfAgentPaidRemaining[cleanAgent] || 0;
        const paid = Math.min(remainingPaid, billAmt);
        if (cnfAgentPaidRemaining[cleanAgent] !== undefined) {
            cnfAgentPaidRemaining[cleanAgent] -= paid;
        }

        let billStatus = "Unpaid";
        if (paid >= billAmt) billStatus = "Paid";
        else if (paid > 0) billStatus = "Partial Paid";

        bills.push({
            date: s.date || s.createdAt,
            billHead: "C&F Bill",
            name: s.bdCnF,
            totalBill: billAmt,
            paidBill: paid,
            billBalance: Math.max(0, billAmt - paid),
            status: billStatus
        });
        lastCnfBillIdxMap[cleanAgent] = bills.length - 1;
    });

    const lastCnfCustomBillIdxMap = {};

    // Separate bills and payments (expenses)
    const registeredBills = lcExpenses.filter(e => cleanLc(e.lcNo) === lcNoClean && e.type === 'bill');
    const registeredPayments = lcExpenses.filter(e => cleanLc(e.lcNo) === lcNoClean && e.type !== 'bill');

    const paymentsByHead = {};
    registeredPayments.forEach(pay => {
        const head = pay.expenseHead || 'Other';
        // C&F Commission has its own stock-arrival based tracking — skip it here
        // Bank Charges and Margin Bill are handled below using residuals after original bills are filled
        if (head === 'C&F Commission') return;
        if (head === 'Bank Charges') return;
        if (head === 'Margin Bill') return;

        paymentsByHead[head] = paymentsByHead[head] || [];
        paymentsByHead[head].push(pay);
    });

    const billPaymentsRemaining = {};
    Object.keys(paymentsByHead).forEach(head => {
        billPaymentsRemaining[head] = paymentsByHead[head].reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    });

    // Inject residual Bank Charges and Margin Bill payments that weren't consumed by original/amendment bills
    // remainingBankPaid = any leftover after filling original Bank Bill + amendment bank bills
    if (remainingBankPaid > 0) {
        billPaymentsRemaining['Bank Charges'] = remainingBankPaid;
        paymentsByHead['Bank Charges'] = [{ expenseHead: 'Bank Charges', amount: remainingBankPaid }];
    }
    // For Margin Bill: compute how much of totalMarginPayments wasn't used by original + amendment margin bills
    const totalMarginBillsInBills = bills.filter(b => b.billHead === 'Margin Bill' || b.billHead.startsWith('Margin Bill (')).reduce((sum, b) => sum + b.paidBill, 0);
    const residualMarginPayment = Math.max(0, totalMarginPayments - totalMarginBillsInBills);
    if (residualMarginPayment > 0) {
        billPaymentsRemaining['Margin Bill'] = residualMarginPayment;
        paymentsByHead['Margin Bill'] = [{ expenseHead: 'Margin Bill', amount: residualMarginPayment }];
    }

    const billRows = [];
    const lastBillIdxByHead = {};

    registeredBills.forEach((bill) => {
        const head = bill.expenseHead || 'Other';
        const billAmt = parseFloat(bill.amount) || 0;

        let paid = 0;
        if (head === 'C&F Commission') {
            const cleanAgent = String(bill.cnfAgent || '').toLowerCase().trim();
            const remainingPaid = cnfAgentPaidRemaining[cleanAgent] || 0;
            paid = Math.min(remainingPaid, billAmt);
            if (cnfAgentPaidRemaining[cleanAgent] !== undefined) {
                cnfAgentPaidRemaining[cleanAgent] -= paid;
            }
        } else {
            const remainingPaid = billPaymentsRemaining[head] || 0;
            paid = Math.min(remainingPaid, billAmt);
            if (billPaymentsRemaining[head] !== undefined) {
                billPaymentsRemaining[head] -= paid;
            }
        }

        let billStatus = "Unpaid";
        if (paid >= billAmt) billStatus = "Paid";
        else if (paid > 0) billStatus = "Partial Paid";

        billRows.push({
            date: bill.date,
            billHead: bill.expenseHead || "Other Bill",
            name: bill.cnfAgent || bill.bankName || bill.remarks || bill.expenseHead || "Other Name",
            totalBill: billAmt,
            paidBill: paid,
            billBalance: Math.max(0, billAmt - paid),
            status: billStatus
        });

        lastBillIdxByHead[head] = billRows.length - 1;
        if (head === 'C&F Commission') {
            const cleanAgent = String(bill.cnfAgent || '').toLowerCase().trim();
            lastCnfCustomBillIdxMap[cleanAgent] = billRows.length - 1;
        }
    });

    // If there is excess C&F paid, attribute to last custom bill row first, then last stock bill row
    Object.keys(cnfAgentPaidRemaining).forEach(agentKey => {
        let remaining = cnfAgentPaidRemaining[agentKey];
        if (remaining > 0) {
            const lastCustomIdx = lastCnfCustomBillIdxMap[agentKey];
            if (lastCustomIdx !== undefined) {
                billRows[lastCustomIdx].paidBill += remaining;
                billRows[lastCustomIdx].billBalance = Math.max(0, billRows[lastCustomIdx].totalBill - billRows[lastCustomIdx].paidBill);
                billRows[lastCustomIdx].status = billRows[lastCustomIdx].paidBill >= billRows[lastCustomIdx].totalBill ? "Paid" : "Partial Paid";
                remaining = 0;
                cnfAgentPaidRemaining[agentKey] = 0;
            }
        }
        if (remaining > 0) {
            const lastStockIdx = lastCnfBillIdxMap[agentKey];
            if (lastStockIdx !== undefined) {
                bills[lastStockIdx].paidBill += remaining;
                bills[lastStockIdx].billBalance = Math.max(0, bills[lastStockIdx].totalBill - bills[lastStockIdx].paidBill);
                bills[lastStockIdx].status = "Paid";
                remaining = 0;
                cnfAgentPaidRemaining[agentKey] = 0;
            }
        }
    });

    // If there are C&F agents with payments but no stock records and no custom bills, push them as fallback C&F Bill rows
    Object.keys(cnfAgentPaidMap).forEach(agentKey => {
        const remainingPaid = cnfAgentPaidRemaining[agentKey];
        if (remainingPaid > 0 && !processedCnfAgents.has(agentKey) && lastCnfCustomBillIdxMap[agentKey] === undefined) {
            const firstExp = lcExpenses.find(e => cleanLc(e.lcNo) === lcNoClean && e.expenseHead === 'C&F Commission' && e.cnfAgent && e.cnfAgent.toLowerCase().trim() === agentKey);
            bills.push({
                date: firstExp ? firstExp.date : (data.openingDate || data.createdAt),
                billHead: "C&F Bill",
                name: firstExp ? firstExp.cnfAgent : agentKey.toUpperCase(),
                totalBill: 0,
                paidBill: remainingPaid,
                billBalance: 0,
                status: "Paid"
            });
        }
    });

    // If there are excess payments remaining for a head, add to the last bill row of that head
    Object.keys(billPaymentsRemaining).forEach(head => {
        const remaining = billPaymentsRemaining[head];
        if (remaining > 0) {
            const lastIdx = lastBillIdxByHead[head];
            if (lastIdx !== undefined) {
                billRows[lastIdx].paidBill += remaining;
                billRows[lastIdx].billBalance = Math.max(0, billRows[lastIdx].totalBill - billRows[lastIdx].paidBill);
                billRows[lastIdx].status = billRows[lastIdx].paidBill >= billRows[lastIdx].totalBill ? "Paid" : "Partial Paid";
                billPaymentsRemaining[head] = 0;
            }
        }
    });

    bills.push(...billRows);

    // Unbilled payments fallback
    Object.keys(paymentsByHead).forEach(head => {
        if (lastBillIdxByHead[head] === undefined) {
            paymentsByHead[head].forEach(pay => {
                const billAmt = parseFloat(pay.amount) || 0;
                bills.push({
                    date: pay.date,
                    billHead: pay.expenseHead || "Other Bill",
                    name: pay.cnfAgent || pay.bankName || pay.remarks || pay.expenseHead || "Other Name",
                    totalBill: billAmt,
                    paidBill: billAmt,
                    billBalance: 0,
                    status: "Paid"
                });
            });
        }
    });

    const filteredBills = bills.filter(b => {
        const q = (consumptionSearchQuery || "").toLowerCase();
        return !q ||
            b.billHead.toLowerCase().includes(q) ||
            b.name.toLowerCase().includes(q) ||
            b.status.toLowerCase().includes(q);
    });

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 md:p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 md:rounded-2xl rounded-none shadow-2xl w-full h-full md:h-auto md:max-w-7xl max-h-screen md:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
                {/* Desktop Header */}
                <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    {/* Left: LC Info */}
                    <div className="flex items-center gap-3 min-w-0 shrink-0">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                            <LCManagerIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 truncate">{showConsumption ? 'LC Consumption History' : 'LC Record Details'}</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                                LC NO: <span className="text-sm font-black text-blue-600">{data.lcNo}</span>
                            </p>
                        </div>
                    </div>

                    {/* Center: Search + Tabs (only in consumption view) */}
                    {showConsumption && (
                        <div className="flex flex-col items-center gap-2 flex-1 mx-6">
                            {/* Search Bar */}
                            <div className="relative group w-full max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search consumption history..."
                                    autoComplete="off"
                                    className="block w-full pl-10 pr-4 py-2 bg-white/70 border border-gray-200 rounded-xl text-[13px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none"
                                    value={consumptionSearchQuery}
                                    onChange={(e) => setConsumptionSearchQuery(e.target.value)}
                                />
                                {consumptionSearchQuery && (
                                    <button
                                        onClick={() => setConsumptionSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            {/* Tab Buttons */}
                            <div className="flex items-center gap-2">
                                {['history', 'gp', 'bill', 'expense'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => { setActiveTab(tab); setConsumptionSearchQuery(''); setExpandedSubRowKey(null); }}
                                        className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${activeTab === tab
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {tab === 'history' ? 'LC History' : tab === 'gp' ? 'G.P List' : tab === 'bill' ? 'LC Bill' : 'Expense'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        {showConsumption && activeTab === 'bill' && (
                            <button
                                onClick={() => setShowAddBillModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 transition-all transform active:scale-95"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>Add Bill</span>
                            </button>
                        )}
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

                {/* Mobile Header */}
                <div className="md:hidden flex flex-col gap-3 px-4 py-4 border-b border-gray-100 bg-gray-50/50">
                    {/* Top Row: Title, LC Info and Actions */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="min-w-0">
                                <h3 className="text-sm font-black text-gray-900 truncate">
                                    {showConsumption ? 'LC Consumption History' : 'LC Record Details'}
                                </h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                    LC NO: <span className="text-xs font-black text-blue-600">{data.lcNo}</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {showConsumption && activeTab === 'bill' && (
                                <button
                                    onClick={() => setShowAddBillModal(true)}
                                    className="h-7 flex items-center justify-center gap-1 px-2.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm transition-all transform active:scale-95 shrink-0 leading-none"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>Add</span>
                                </button>
                            )}
                            <button
                                onClick={() => setShowConsumption(!showConsumption)}
                                className={`h-7 flex items-center justify-center gap-1 px-2.5 rounded-lg text-[10px] font-bold transition-all border leading-none ${showConsumption
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-white'
                                    }`}
                            >
                                <LCManagerIcon className="w-3.5 h-3.5" />
                                {showConsumption ? 'Details' : 'History'}
                            </button>
                            <button
                                onClick={onClose}
                                className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all shrink-0"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Search Bar Row (only in consumption view) */}
                    {showConsumption && (
                        <div className="relative group w-full">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SearchIcon className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search consumption history..."
                                autoComplete="off"
                                className="block w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-xl text-[12px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                value={consumptionSearchQuery}
                                onChange={(e) => setConsumptionSearchQuery(e.target.value)}
                            />
                            {consumptionSearchQuery && (
                                <button
                                    onClick={() => setConsumptionSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <XIcon className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Tabs Row (only in consumption view) */}
                    {showConsumption && (
                        <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 flex-1">
                                {['history', 'gp', 'bill', 'expense'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => { setActiveTab(tab); setConsumptionSearchQuery(''); setExpandedSubRowKey(null); }}
                                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap border shrink-0 ${activeTab === tab
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        {tab === 'history' ? 'LC History' : tab === 'gp' ? 'G.P List' : tab === 'bill' ? 'LC Bill' : 'Expense'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    {showConsumption ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Summary Cards */}
                            {activeTab === 'bill' ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
                                    <div 
                                        className="col-span-full md:col-span-1 bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group text-center md:text-left flex flex-col items-center md:items-start justify-center md:justify-start"
                                    >
                                        <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-2 md:mb-3">
                                            <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-lg md:rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                                <DollarSignIcon className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Bills</span>
                                        </div>
                                        <div className="flex items-baseline justify-center md:justify-start gap-0.5 md:gap-1">
                                            <span className="text-lg md:text-2xl font-black text-blue-600">
                                                ৳{filteredBills.reduce((sum, b) => sum + b.totalBill, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group text-center md:text-left flex flex-col items-center md:items-start justify-center md:justify-start">
                                        <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-2 md:mb-3">
                                            <div className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                                                <DollarSignIcon className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Paid</span>
                                        </div>
                                        <div className="flex items-baseline justify-center md:justify-start gap-0.5 md:gap-1">
                                            <span className="text-lg md:text-2xl font-black text-emerald-600">
                                                ৳{filteredBills.reduce((sum, b) => sum + (b.paidBill || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-rose-100 group text-center md:text-left flex flex-col items-center md:items-start justify-center md:justify-start">
                                        <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-2 md:mb-3">
                                            <div className="p-1.5 md:p-2 bg-rose-50 text-rose-600 rounded-lg md:rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
                                                <DollarSignIcon className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Balance</span>
                                        </div>
                                        <div className="flex items-baseline justify-center md:justify-start gap-0.5 md:gap-1">
                                            <span className="text-lg md:text-2xl font-black text-rose-600">
                                                {(() => {
                                                    const bal = filteredBills.reduce((sum, b) => sum + (b.billBalance || 0), 0);
                                                    return bal < 0
                                                        ? `-৳${Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                        : `৳${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
                                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-blue-100 group text-left">
                                        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                            <div className="p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-lg md:rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                                <LCManagerIcon className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC Quantity</span>
                                        </div>
                                        <div className="flex items-baseline gap-0.5 md:gap-1">
                                            <span className="text-lg md:text-2xl font-black text-gray-900">{totalLcQtyKg.toLocaleString('en-US')}</span>
                                            <span className="text-[10px] md:text-xs font-bold text-gray-400">Kg</span>
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 group text-left">
                                        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                                                <GlobeIcon className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Consumption</span>
                                        </div>
                                        <div className="flex items-baseline gap-0.5 md:gap-1">
                                            <span className="text-lg md:text-2xl font-black text-gray-900">{consumedQtyKg.toLocaleString('en-US')}</span>
                                            <span className="text-[10px] md:text-xs font-bold text-gray-400">Kg</span>
                                        </div>
                                    </div>

                                    {data.enableValueQtyAdjustment ? (
                                        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group text-left">
                                            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                                <div className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                                                    <PlusIcon className="w-4 h-4 md:w-5 md:h-5" />
                                                </div>
                                                <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Value & Qty Added</span>
                                            </div>
                                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                                <div className="flex items-baseline gap-0.5 md:gap-1">
                                                    <span className="text-lg md:text-2xl font-black text-emerald-600">
                                                        +{adj.actualAdjustmentQtyKg.toLocaleString('en-US')}
                                                    </span>
                                                    <span className="text-[10px] md:text-xs font-bold text-gray-400">Kg</span>
                                                </div>
                                                <span className="text-sm md:text-base font-black text-gray-850 shrink-0">
                                                    +৳{adj.addedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 group text-left">
                                            <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                                <div className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-lg md:rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                                                    <ShieldIcon className="w-4 h-4 md:w-5 md:h-5" />
                                                </div>
                                                <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rem. Quantity</span>
                                            </div>
                                            <div className="flex items-baseline gap-0.5 md:gap-1">
                                                <span className={`text-lg md:text-2xl font-black ${remQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                    {remQtyKg.toLocaleString('en-US')}
                                                </span>
                                                <span className="text-[10px] md:text-xs font-bold text-gray-400">Kg</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200 group text-left">
                                        <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                                            <div className="p-1.5 md:p-2 bg-gray-50 text-gray-600 rounded-lg md:rounded-xl group-hover:bg-gray-800 group-hover:text-white transition-colors shrink-0">
                                                <BuildingIcon className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Truck</span>
                                        </div>
                                        <div className="flex items-baseline gap-0.5 md:gap-1">
                                            <span className="text-lg md:text-2xl font-black text-gray-900">{truckCount}</span>
                                            <span className="text-[10px] md:text-xs font-bold text-gray-400">Units</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Consumption History Table or GP List */}
                            {activeTab === 'history' ? (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left border-collapse min-w-[750px] md:min-w-0">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Importer</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Exporter</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Truck</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Source</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {filteredConsumptionHistory.length > 0 ? (
                                                    filteredConsumptionHistory.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(item.date)}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-800 uppercase">{item.importer || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-800 uppercase">{item.exporter || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-900">{item.product || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-blue-600 uppercase whitespace-nowrap">{item.truck || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                                {parseNum(item.quantity).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${item.source === 'LC Receive'
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
                                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-400 font-bold">
                                                            {consumptionSearchQuery ? 'No results match your search.' : 'No consumption history found for this LC.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50/30">
                                                <tr>
                                                    <td colSpan="5" className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Consumption:</td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-right text-blue-600">
                                                        {filteredConsumptionHistory.reduce((sum, item) => sum + parseNum(item.quantity), 0).toLocaleString('en-US')} <span className="text-[10px] font-normal">Kg</span>
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {/* Mobile View */}
                                    <div className="md:hidden">
                                        {filteredConsumptionHistory.length > 0 ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                                                {filteredConsumptionHistory.map((item, idx) => {
                                                    const key = `history_${idx}`;
                                                    const isExpanded = expandedSubRowKey === key;
                                                    return (
                                                        <div key={idx} className="transition-all hover:bg-gray-50/35">
                                                            {/* Collapsed View Header */}
                                                            <div
                                                                onClick={() => setExpandedSubRowKey(isExpanded ? null : key)}
                                                                className="flex items-center justify-between gap-3 p-4 cursor-pointer select-none"
                                                            >
                                                                <div className={`p-2 rounded-xl shrink-0 ${item.source === 'LC Receive'
                                                                        ? 'bg-emerald-50 text-emerald-600'
                                                                        : 'bg-indigo-50 text-indigo-600'
                                                                    }`}>
                                                                    {item.source === 'LC Receive' ? (
                                                                        <BuildingIcon className="w-4 h-4" />
                                                                    ) : (
                                                                        <GlobeIcon className="w-4 h-4" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <p className="text-xs font-bold text-gray-900 truncate">{item.product || '-'}</p>
                                                                    <p className="text-[10px] text-gray-400 font-semibold font-mono mt-0.5">{formatDate(item.date)}</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-xs font-black text-gray-900">{parseNum(item.quantity).toLocaleString('en-US')} kg</p>
                                                                    <span className={`inline-block text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded mt-1 border ${item.source === 'LC Receive'
                                                                            ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100/30'
                                                                            : 'bg-indigo-50/50 text-indigo-700 border-indigo-100/30'
                                                                        }`}>
                                                                        {item.source}
                                                                    </span>
                                                                </div>
                                                                <div className="shrink-0 text-gray-400 pl-1">
                                                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                                </div>
                                                            </div>

                                                            {/* Expanded Details */}
                                                            {isExpanded && (
                                                                <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-1 duration-200">
                                                                    <div className="grid grid-cols-[125px_8px_1fr] gap-y-1.5 pt-2 text-xs items-baseline">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 uppercase truncate text-[11px]" title={item.importer}>{item.importer || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 uppercase truncate text-[11px]" title={item.exporter}>{item.exporter || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Truck No</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-blue-600 uppercase truncate text-[11px]">{item.truck || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-semibold text-gray-700 truncate text-[11px]">{item.source || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 font-bold bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                {consumptionSearchQuery ? 'No results match your search.' : 'No consumption history found for this LC.'}
                                            </div>
                                        )}

                                    </div>
                                </>
                            ) : activeTab === 'gp' ? (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left border-collapse min-w-[700px] md:min-w-0">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Party Name</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sold To</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">GP Qty (Kg)</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">GP Value</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {filteredGpRecords.length > 0 ? (
                                                    filteredGpRecords.map((gp, idx) => (
                                                        <tr key={gp._id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(gp.gpDate)}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-800 uppercase">{gp.partyName || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-800 uppercase">{gp.party || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-900">{gp.productName || '-'}</td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                                {parseNum(gp.gpQuantity).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-right text-gray-900 whitespace-nowrap">
                                                                ৳{parseNum(gp.gpValue).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${gp.status === 'Active'
                                                                    ? 'bg-blue-50 text-blue-600 border-blue-100/50'
                                                                    : 'bg-gray-100 text-gray-500 border-gray-200/50'
                                                                    }`}>
                                                                    {gp.status || 'Active'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="7" className="px-3 md:px-6 py-12 text-center text-gray-400 font-bold">
                                                            {consumptionSearchQuery ? 'No G.P records match your search.' : 'No Gate Pass records found for this LC.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50/30">
                                                <tr>
                                                    <td colSpan="4" className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total GP Qty:</td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-right text-blue-600">
                                                        {filteredGpRecords.reduce((sum, gp) => sum + parseNum(gp.gpQuantity), 0).toLocaleString('en-US')} <span className="text-[10px] font-normal">Kg</span>
                                                    </td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-right text-blue-600">
                                                        ৳{filteredGpRecords.reduce((sum, gp) => sum + parseNum(gp.gpValue), 0).toLocaleString('en-IN')}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {/* Mobile View */}
                                    <div className="md:hidden">
                                        {filteredGpRecords.length > 0 ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                                                {filteredGpRecords.map((gp, idx) => {
                                                    const key = `gp_${idx}`;
                                                    const isExpanded = expandedSubRowKey === key;
                                                    return (
                                                        <div key={gp._id || idx} className="transition-all hover:bg-gray-50/35">
                                                            {/* Collapsed View Header */}
                                                            <div
                                                                onClick={() => setExpandedSubRowKey(isExpanded ? null : key)}
                                                                className="flex items-center justify-between gap-3 p-4 cursor-pointer select-none"
                                                            >
                                                                <div className="p-2 rounded-xl shrink-0 bg-indigo-50 text-indigo-600">
                                                                    <FileTextIcon className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <p className="text-xs font-bold text-gray-900 truncate">{gp.productName || '-'}</p>
                                                                    <p className="text-[10px] text-gray-400 font-semibold font-mono mt-0.5">{formatDate(gp.gpDate)}</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-xs font-black text-gray-900">{parseNum(gp.gpQuantity).toLocaleString('en-US')} kg</p>
                                                                    <p className="text-[10px] text-gray-500 font-bold mt-0.5">৳{parseNum(gp.gpValue).toLocaleString('en-IN')}</p>
                                                                </div>
                                                                <div className="shrink-0 text-gray-400 pl-1">
                                                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                                </div>
                                                            </div>

                                                            {/* Expanded Details */}
                                                            {isExpanded && (
                                                                <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-1 duration-200">
                                                                    <div className="grid grid-cols-[125px_8px_1fr] gap-y-1.5 pt-2 text-xs items-baseline">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Party Name</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 uppercase truncate text-[11px]" title={gp.partyName}>{gp.partyName || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sold To</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 uppercase truncate text-[11px]" title={gp.party}>{gp.party || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">GP Value</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-black text-gray-900 truncate text-[11px]">৳{parseNum(gp.gpValue).toLocaleString('en-IN')}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <div className="flex items-center">
                                                                            <span className={`inline-block text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0 ${gp.status === 'Active'
                                                                                    ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100/30'
                                                                                    : 'bg-gray-50 text-gray-500 border-gray-200/30'
                                                                                }`}>
                                                                                {gp.status || 'Active'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 font-bold bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                {consumptionSearchQuery ? 'No G.P records match your search.' : 'No Gate Pass records found for this LC.'}
                                            </div>
                                        )}

                                    </div>
                                </>
                            ) : activeTab === 'bill' ? (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left border-collapse min-w-[750px] md:min-w-0">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Bill Head</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Bill</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Paid Bill</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Bill Balance</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 font-medium">
                                                {filteredBills.length > 0 ? (
                                                    filteredBills.map((bill, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-600 whitespace-nowrap">
                                                                {formatDate(bill.date)}
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-bold text-blue-600">
                                                                {bill.billHead}
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-800 uppercase">
                                                                {bill.name || '-'}
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-black text-right text-gray-900 whitespace-nowrap">
                                                                ৳{bill.totalBill.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-black text-right text-emerald-600 whitespace-nowrap">
                                                                ৳{(bill.paidBill || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-black text-right text-rose-600 whitespace-nowrap">
                                                                {bill.billBalance < 0
                                                                    ? `-৳${Math.abs(bill.billBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                    : `৳${(bill.billBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                }
                                                            </td>
                                                            <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                                                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${bill.status === 'Paid'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                                                                    : bill.status === 'Partial Paid'
                                                                        ? 'bg-amber-50 text-amber-600 border-amber-100/50'
                                                                        : 'bg-rose-50 text-rose-600 border-rose-100/50'
                                                                    }`}>
                                                                    {bill.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="7" className="px-3 md:px-6 py-12 text-center text-gray-400 font-bold">
                                                            {consumptionSearchQuery ? 'No bills match your search.' : 'No bills found for this LC.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot className="bg-gray-50/30">
                                                <tr>
                                                    <td colSpan="3" className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Bills:</td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-black text-right text-blue-600">
                                                        ৳{filteredBills.reduce((sum, b) => sum + b.totalBill, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-black text-right text-emerald-600">
                                                        ৳{filteredBills.reduce((sum, b) => sum + (b.paidBill || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-black text-right text-rose-600">
                                                        {(() => {
                                                            const bal = filteredBills.reduce((sum, b) => sum + (b.billBalance || 0), 0);
                                                            return bal < 0
                                                                ? `-৳${Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                : `৳${bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                                                        })()}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {/* Mobile View */}
                                    <div className="md:hidden">
                                        {filteredBills.length > 0 ? (
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                                                {filteredBills.map((bill, idx) => {
                                                    const key = `bill_${idx}`;
                                                    const isExpanded = expandedSubRowKey === key;
                                                    return (
                                                        <div key={idx} className="transition-all hover:bg-gray-50/35">
                                                            {/* Collapsed View Header */}
                                                            <div
                                                                onClick={() => setExpandedSubRowKey(isExpanded ? null : key)}
                                                                className="flex items-center justify-between gap-3 p-4 cursor-pointer select-none"
                                                            >
                                                                <div className="p-2 rounded-xl shrink-0 bg-blue-50 text-blue-600">
                                                                    <DollarSignIcon className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0 text-left">
                                                                    <p className="text-xs font-bold text-blue-600 truncate">{bill.billHead || '-'}</p>
                                                                    <p className="text-[10px] text-gray-400 font-semibold font-mono mt-0.5">{formatDate(bill.date)}</p>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <p className="text-xs font-black text-gray-900">৳{bill.totalBill.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                                                    <span className={`inline-block text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded mt-1 border ${bill.status === 'Paid'
                                                                            ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100/30'
                                                                            : bill.status === 'Partial Paid'
                                                                                ? 'bg-amber-50/50 text-amber-700 border-amber-100/30'
                                                                                : 'bg-rose-50/50 text-rose-700 border-rose-100/30'
                                                                        }`}>
                                                                        {bill.status}
                                                                    </span>
                                                                </div>
                                                                <div className="shrink-0 text-gray-400 pl-1">
                                                                    {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                                </div>
                                                            </div>

                                                            {/* Expanded Content */}
                                                            {isExpanded && (
                                                                <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-1 duration-200">
                                                                    <div className="grid grid-cols-[125px_8px_1fr] gap-y-1.5 pt-2 text-xs items-baseline">
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-gray-900 uppercase truncate text-[11px]" title={bill.name}>{bill.name || '-'}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid Amount</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-emerald-600 truncate text-[11px]">৳{(bill.paidBill || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>

                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bill Balance</span>
                                                                        <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                        <span className="font-bold text-rose-600 truncate text-[11px]">
                                                                            {bill.billBalance < 0
                                                                                ? `-৳${Math.abs(bill.billBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                                : `৳${(bill.billBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-gray-400 font-bold bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                {consumptionSearchQuery ? 'No bills match your search.' : 'No bills found for this LC.'}
                                            </div>
                                        )}


                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Desktop View */}
                                    <div className="hidden md:block overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                                        <table className="w-full text-left border-collapse min-w-[650px] md:min-w-0">
                                            <thead>
                                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Expense Head</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
                                                    <th className="px-3 md:px-6 py-3 md:py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {(() => {
                                                    const filtered = [
                                                        ...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill'),
                                                        ...insurancePayments.filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection').map(p => ({
                                                            _id: p._id,
                                                            date: p.date,
                                                            expenseHead: 'Insurance Premium',
                                                            name: p.companyName || 'Insurance',
                                                            amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
                                                            remarks: p.remarks || 'Premium Payment'
                                                        }))
                                                    ];

                                                    // Check if original Margin is Paid
                                                    const marginPaidAmt = parseFloat(data.marginPaid) || (() => {
                                                        const total = parseFloat(data.totalAmount) || 0;
                                                        const margin = parseFloat(data.bankMargin) || 0;
                                                        return total * (margin / 100);
                                                    })();
                                                    if (marginPaidAmt > 0) {
                                                        filtered.unshift({
                                                            _id: 'margin-paid-virtual',
                                                            date: data.openingDate || data.createdAt,
                                                            expenseHead: `Margin Paid (${data.bankMargin || 0}%)`,
                                                            bankName: data.bankName || 'Bank',
                                                            amount: marginPaidAmt,
                                                            remarks: 'Paid Margin'
                                                        });
                                                    }

                                                    // Check if amendment Margin is Paid
                                                    if (data.amendments && data.amendments.length > 0) {
                                                        data.amendments.forEach((amnd, idx) => {
                                                            if (amnd.amendmentNo === 'Original LC') return;
                                                            const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (data.bankMargin !== undefined ? parseFloat(data.bankMargin) : 0);
                                                            const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
                                                                const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                                                                return amndMarginBill * (margin / 100);
                                                            })();
                                                            if (amndMarginPaid > 0) {
                                                                filtered.push({
                                                                    _id: `amnd-margin-paid-virtual-${idx}`,
                                                                    date: amnd.amendmentDate || data.openingDate,
                                                                    expenseHead: `Margin Paid (${margin}%) (${amnd.amendmentNo || `Amend #${idx + 1}`})`,
                                                                    bankName: data.bankName || 'Bank',
                                                                    amount: amndMarginPaid,
                                                                    remarks: `Paid Margin for ${amnd.amendmentNo || `Amend #${idx + 1}`}`
                                                                });
                                                            }
                                                        });
                                                    }

                                                    return filtered.length > 0 ? (
                                                        filtered.map((exp, idx) => (
                                                            <tr key={exp._id || idx} className="hover:bg-gray-50/50 transition-colors group">
                                                                <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(exp.date)}</td>
                                                                <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-900">{exp.expenseHead || '-'}</td>
                                                                <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-800">
                                                                    {exp.cnfAgent || exp.bankName || exp.insuranceCo || exp.insuranceName || exp.name || '-'}
                                                                </td>
                                                                <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-bold text-right text-rose-600 whitespace-nowrap">৳{parseNum(exp.amount).toLocaleString('en-IN')}</td>
                                                                <td className="px-3 md:px-6 py-3 md:py-4 text-sm text-gray-500 truncate max-w-[200px]">{exp.remarks || '-'}</td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="5" className="px-3 md:px-6 py-12 text-center text-gray-400 font-bold">
                                                                No expense records found for this LC.
                                                            </td>
                                                        </tr>
                                                    );
                                                })()}
                                            </tbody>
                                            <tfoot className="bg-gray-50/30">
                                                <tr>
                                                    <td colSpan="3" className="px-3 md:px-6 py-3 md:py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total Expense:</td>
                                                    <td className="px-3 md:px-6 py-3 md:py-4 text-sm font-bold text-right text-rose-600">
                                                        {(() => {
                                                            const filtered = [
                                                         ...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill'),
                                                         ...insurancePayments.filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection').map(p => ({
                                                             _id: p._id,
                                                             date: p.date,
                                                             expenseHead: 'Insurance Premium',
                                                             name: p.companyName || 'Insurance',
                                                             amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
                                                             remarks: p.remarks || 'Premium Payment'
                                                         }))
                                                     ];
                                                            const marginPaidAmt = parseFloat(data.marginPaid) || (() => {
                                                                const total = parseFloat(data.totalAmount) || 0;
                                                                const margin = parseFloat(data.bankMargin) || 0;
                                                                return total * (margin / 100);
                                                            })();
                                                            let total = filtered.reduce((sum, exp) => sum + parseNum(exp.amount), 0);
                                                            if (marginPaidAmt > 0) total += marginPaidAmt;
                                                            if (data.amendments && data.amendments.length > 0) {
                                                                data.amendments.forEach((amnd) => {
                                                                    if (amnd.amendmentNo === 'Original LC') return;
                                                                    const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (data.bankMargin !== undefined ? parseFloat(data.bankMargin) : 0);
                                                                    const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
                                                                        const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                                                                        return amndMarginBill * (margin / 100);
                                                                    })();
                                                                    if (amndMarginPaid > 0) total += amndMarginPaid;
                                                                });
                                                            }
                                                            return `৳${total.toLocaleString('en-IN')}`;
                                                        })()}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                    {/* Mobile View */}
                                    <div className="md:hidden">
                                        {(() => {
                                            const filtered = [
                                                ...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill'),
                                                ...insurancePayments.filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection').map(p => ({
                                                    _id: p._id,
                                                    date: p.date,
                                                    expenseHead: 'Insurance Premium',
                                                    name: p.companyName || 'Insurance',
                                                    amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
                                                    remarks: p.remarks || 'Premium Payment'
                                                }))
                                            ];

                                            // Check if original Margin is Paid
                                            const marginPaidAmt = parseFloat(data.marginPaid) || (() => {
                                                const total = parseFloat(data.totalAmount) || 0;
                                                const margin = parseFloat(data.bankMargin) || 0;
                                                return total * (margin / 100);
                                            })();
                                            if (marginPaidAmt > 0) {
                                                filtered.unshift({
                                                    _id: 'margin-paid-virtual',
                                                    date: data.openingDate || data.createdAt,
                                                    expenseHead: `Margin Paid (${data.bankMargin || 0}%)`,
                                                    bankName: data.bankName || 'Bank',
                                                    amount: marginPaidAmt,
                                                    remarks: 'Paid Margin'
                                                });
                                            }

                                            // Check if amendment Margin is Paid
                                            if (data.amendments && data.amendments.length > 0) {
                                                data.amendments.forEach((amnd, idx) => {
                                                    if (amnd.amendmentNo === 'Original LC') return;
                                                    const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (data.bankMargin !== undefined ? parseFloat(data.bankMargin) : 0);
                                                    const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
                                                        const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                                                        return amndMarginBill * (margin / 100);
                                                    })();
                                                    if (amndMarginPaid > 0) {
                                                        filtered.push({
                                                            _id: `amnd-margin-paid-virtual-${idx}`,
                                                            date: amnd.amendmentDate || data.openingDate,
                                                            expenseHead: `Margin Paid (${margin}%) (${amnd.amendmentNo || `Amend #${idx + 1}`})`,
                                                            bankName: data.bankName || 'Bank',
                                                            amount: amndMarginPaid,
                                                            remarks: `Paid Margin for ${amnd.amendmentNo || `Amend #${idx + 1}`}`
                                                        });
                                                    }
                                                });
                                            }

                                            return filtered.length > 0 ? (
                                                <>
                                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                                                        {filtered.map((exp, idx) => {
                                                            const key = `expense_${idx}`;
                                                            const isExpanded = expandedSubRowKey === key;
                                                            return (
                                                                <div key={exp._id || idx} className="transition-all hover:bg-gray-50/35">
                                                                    {/* Collapsed View Header */}
                                                                    <div
                                                                        onClick={() => setExpandedSubRowKey(isExpanded ? null : key)}
                                                                        className="flex items-center justify-between gap-3 p-4 cursor-pointer select-none"
                                                                    >
                                                                        <div className="p-2 rounded-xl shrink-0 bg-rose-50 text-rose-600">
                                                                            <BuildingIcon className="w-4 h-4" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0 text-left">
                                                                            <p className="text-xs font-bold text-gray-900 truncate">{exp.expenseHead || '-'}</p>
                                                                            <p className="text-[10px] text-gray-400 font-semibold font-mono mt-0.5">{formatDate(exp.date)}</p>
                                                                        </div>
                                                                        <div className="text-right shrink-0">
                                                                            <p className="text-xs font-black text-rose-600">৳{parseNum(exp.amount).toLocaleString('en-IN')}</p>
                                                                        </div>
                                                                        <div className="shrink-0 text-gray-400 pl-1">
                                                                            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                                        </div>
                                                                    </div>

                                                                    {/* Expanded Details */}
                                                                    {isExpanded && (
                                                                        <div className="px-4 pb-4 pt-1 space-y-2 bg-gray-50/30 border-t border-gray-100/50 text-xs text-left animate-in slide-in-from-top-1 duration-200">
                                                                            <div className="grid grid-cols-[125px_8px_1fr] gap-y-1.5 pt-2 text-xs items-baseline">
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Beneficiary Name</span>
                                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                                <span className="font-bold text-gray-900 uppercase truncate text-[11px]">
                                                                                    {exp.cnfAgent || exp.bankName || exp.insuranceCo || exp.insuranceName || exp.name || '-'}
                                                                                </span>

                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks</span>
                                                                                <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                                                <span className="font-semibold text-gray-700 truncate text-[11px]" title={exp.remarks}>{exp.remarks || '-'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                </>
                                            ) : (
                                                <div className="p-8 text-center text-gray-400 font-bold bg-white border border-gray-100 rounded-2xl shadow-sm">
                                                    No expense records found for this LC.
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                            {timeline.length > 1 && (
                                <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-gray-100 pb-6 md:pb-0 pr-0 md:pr-6 overflow-y-auto max-h-[40vh] md:max-h-[70vh] flex-shrink-0 text-left custom-scrollbar">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Amendment Timeline</h4>
                                    <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                                        {timeline.map((rev, idx) => {
                                            const isActive = activeMilestoneIndex === idx;
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => setActiveMilestoneIndex(idx)}
                                                    className="relative cursor-pointer group"
                                                >
                                                    {/* Timeline Bullet */}
                                                    <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isActive
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
                                                            {rev.amendmentNo || `AMENDMENT NO-${String(idx).padStart(2, '0')}`}
                                                        </span>
                                                        {rev.addnNo && (
                                                            <div className="mt-1">
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                    {rev.addnNo}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <p className="text-sm font-bold text-gray-800 mt-2">
                                                            {rev.isOriginal ? 'Initial Opening' : 'Amended State'}
                                                        </p>
                                                        <p className="text-[11px] font-medium text-gray-500 mt-1 font-mono">
                                                            {formatDate(rev.amendmentDate)}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Right Details Panel */}
                            <div className="flex-1 space-y-8 min-w-0">
                                {/* Section 1: General Information */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <GlobeIcon className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">General Information</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2 text-left">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Number</span>
                                            <p className="text-sm font-bold text-blue-600">
                                                {(() => {
                                                    const rawPiNo = activeMilestone.piNo || data.piNo || '';
                                                    if (!rawPiNo) return 'N/A';
                                                    // If already has (REVISED) suffix, display as-is
                                                    if (rawPiNo.endsWith(' (REVISED)')) return rawPiNo;
                                                    // Dynamically check if the referenced PI has revisions
                                                    const cleanPi = rawPiNo.replace(' (REVISED)', '');
                                                    const piRecord = piRecordsRaw.find(p => p.piNumber === cleanPi);
                                                    if (piRecord && piRecord.revisions && piRecord.revisions.length > 0) {
                                                        return `${cleanPi} (REVISED)`;
                                                    }
                                                    return rawPiNo;
                                                })()}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Number</span>
                                            <div className="flex flex-col gap-0.5">
                                                {(() => {
                                                    const ips = data.ipNumbers?.length
                                                        ? data.ipNumbers
                                                        : (data.ipNo ? data.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);
                                                    if (ips.length === 0) return <span className="text-sm font-bold text-gray-800">N/A</span>;
                                                    return ips.map((ip, idx) => (
                                                        <span key={idx} className="block text-sm font-bold text-gray-800">
                                                            {ip}
                                                        </span>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Date</span>
                                            <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">{formatDate(data.openingDate)}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-red-500">Expiry Date</span>
                                            <p className="text-sm font-bold text-red-500 font-mono tracking-tight">{formatDate(activeMilestone.expiryDate || data.expiryDate)}</p>
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</span>
                                            <p className="text-sm font-bold text-gray-800 truncate" title={data.bankName}>{data.bankName}</p>
                                        </div>
                                        <div className="space-y-1 col-span-2">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                            <p className="text-sm font-bold text-gray-800 truncate" title={data.importerName}>{data.importerName}</p>
                                        </div>
                                        <div className="col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                                <p className="text-sm font-bold text-gray-800 truncate" title={data.exporterName}>{data.exporterName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Latest Shipment Date</span>
                                                <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">
                                                    {(() => {
                                                        if (!activeMilestone.isOriginal && activeMilestoneIndex > 0) {
                                                            // For amendments: show the previous milestone's shipment date (before this amendment extended it)
                                                            const prev = timeline[activeMilestoneIndex - 1];
                                                            return formatDate(prev.extendedShipmentDate || prev.latestShipmentDate) || 'N/A';
                                                        }
                                                        // For Original LC: only use the snapshot's own latestShipmentDate.
                                                        // Do NOT fall back to data.latestShipmentDate — that gets overwritten with the latest amendment's extended date.
                                                        return formatDate(activeMilestone.latestShipmentDate) || formatDate(data.latestShipmentDate) || 'N/A';
                                                    })()}
                                                </p>
                                            </div>
                                            {!activeMilestone.isOriginal ? (
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Extended Shipment Date</span>
                                                    <p className="text-sm font-bold text-gray-800 font-mono tracking-tight">
                                                        {formatDate(activeMilestone.extendedShipmentDate) || 'N/A'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Product & Financials */}
                                <div className="pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <DollarSignIcon className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Product & Financial Details</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50/50">
                                            <table className="w-full text-left border-collapse min-w-[650px] md:min-w-0">
                                                <thead>
                                                    <tr className="bg-gray-100/50 border-b border-gray-200/60">
                                                        <th className="px-2.5 md:px-4 py-2 md:py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product Name</th>
                                                        <th className="px-2.5 md:px-4 py-2 md:py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">HS Code</th>
                                                        <th className="px-2.5 md:px-4 py-2 md:py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Quantity (Ton)</th>
                                                        <th className="px-2.5 md:px-4 py-2 md:py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Rate (/Ton)</th>
                                                        <th className="px-2.5 md:px-4 py-2 md:py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Freight (/Ton)</th>
                                                        <th className="px-2.5 md:px-4 py-2 md:py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Total Dollar</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {activeProducts.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-white/40 transition-colors">
                                                            <td className="px-2.5 md:px-4 py-2 md:py-3 text-sm font-bold text-gray-900">{item.productName || '-'}</td>
                                                            <td className="px-2.5 md:px-4 py-2 md:py-3 text-sm text-gray-600 font-medium">{item.hsCode || '-'}</td>
                                                            <td className="px-2.5 md:px-4 py-2 md:py-3 text-sm text-right text-gray-900 font-black">{parseFloat(item.quantity || 0).toLocaleString('en-US')} <span className="text-[10px] text-gray-400 font-normal">Ton</span></td>
                                                            <td className="px-2.5 md:px-4 py-2 md:py-3 text-sm text-right text-gray-700 font-semibold">${parseFloat(item.rate || 0).toLocaleString('en-US')}</td>
                                                            <td className="px-2.5 md:px-4 py-2 md:py-3 text-sm text-right text-gray-700 font-semibold">${parseFloat(item.freight || 0).toLocaleString('en-US')}</td>
                                                            <td className="px-2.5 md:px-4 py-2 md:py-3 text-sm text-right text-blue-600 font-black">${parseFloat(item.totalDollar || 0).toLocaleString('en-US')}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Summary Stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col justify-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                                <p className="text-sm font-bold text-gray-800">{activeMilestone.port || data.port || '-'}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col justify-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dollar Rate</span>
                                                <p className="text-sm font-bold text-gray-800">৳{parseFloat(activeMilestone.dollarRate || data.dollarRate || 0).toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100/50 flex justify-between items-center">
                                                <span className="text-xs font-black text-blue-800 uppercase tracking-widest text-left">Total Dollar</span>
                                                <span className="text-lg font-black text-blue-700">${activeProducts.reduce((sum, item) => sum + (parseFloat(item.totalDollar) || 0), 0).toLocaleString('en-US')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 p-4 bg-gray-50 rounded-xl flex justify-between items-center text-left">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total LC Value</span>
                                        <span className="text-xl font-black text-gray-900">৳{parseFloat(activeMilestone.totalAmount || data.totalAmount || 0).toLocaleString('en-IN')}</span>
                                    </div>

                                    {!activeMilestone.isOriginal && (
                                        <div className="mt-4 p-4 bg-blue-50/30 border border-blue-100 rounded-xl space-y-4 text-left animate-in fade-in duration-200">
                                            {(() => {
                                                const prevMilestone = activeMilestoneIndex > 0 ? timeline[activeMilestoneIndex - 1] : null;
                                                const activeQty = getMilestoneTotalQty(activeMilestone);
                                                const prevQty = prevMilestone ? getMilestoneTotalQty(prevMilestone) : 0;
                                                const diffQty = activeQty - prevQty;

                                                const rVal = parseFloat(activeMilestone.rate || 0);
                                                const ratePerTon = rVal < 10 ? rVal * 1000 : rVal;

                                                const fVal = parseFloat(activeProducts[0]?.freight || data.freight || 0);
                                                const freightPerTon = fVal < 0.1 ? fVal * 1000 : fVal;

                                                const dollarRate = parseFloat(activeMilestone.dollarRate || data.dollarRate || 0);
                                                const diffDollar = diffQty * (ratePerTon + freightPerTon);
                                                const diffAmount = diffDollar * dollarRate;
                                                const sign = diffQty >= 0 ? '+' : '';
                                                const isAmndBillActive = activeMilestone.amendmentLcBillEnabled !== undefined
                                                    ? activeMilestone.amendmentLcBillEnabled
                                                    : !!(activeMilestone.amendmentCommission || activeMilestone.amendmentSwiftCharge);
                                                const activeMilestoneMarginPaid = activeMilestone.amendmentMarginPaid !== undefined
                                                    ? activeMilestone.amendmentMarginPaid
                                                    : (() => {
                                                        const margin = activeMilestone.amendmentMargin !== undefined ? (parseFloat(activeMilestone.amendmentMargin) || 0) : (data.bankMargin !== undefined ? parseFloat(data.bankMargin) : 0);
                                                        const mb = parseFloat(activeMilestone.amendmentMarginBill) || 0;
                                                        const mp = mb * (margin / 100);
                                                        return mp > 0 ? mp.toFixed(2) : '';
                                                    })();

                                                const hasCommission1 = isAmndBillActive && activeMilestone.amendmentCommission && parseFloat(activeMilestone.amendmentCommission) > 0;
                                                const hasVatOnComm1 = isAmndBillActive && activeMilestone.amendmentVatOnCommission && parseFloat(activeMilestone.amendmentVatOnCommission) > 0;
                                                const hasSwiftCharge1 = isAmndBillActive && activeMilestone.amendmentSwiftCharge && parseFloat(activeMilestone.amendmentSwiftCharge) > 0;
                                                const hasVatOnSwift1 = isAmndBillActive && activeMilestone.amendmentVatOnSwift && parseFloat(activeMilestone.amendmentVatOnSwift) > 0;
                                                const hasBankBill1 = isAmndBillActive && activeMilestone.amendmentBankBill && parseFloat(activeMilestone.amendmentBankBill) > 0;

                                                const colsCount1 = 1 + (hasCommission1 ? 1 : 0) + (hasVatOnComm1 ? 1 : 0) + (hasSwiftCharge1 ? 1 : 0) + (hasVatOnSwift1 ? 1 : 0);
                                                const colsCount2 = 3 + (hasBankBill1 ? 1 : 0);

                                                return (
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-8 gap-y-4">
                                                            {/* Card 1: Total Amendment Qty */}
                                                            <div>
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap block mb-1">Total Amendment Qty</span>
                                                                <p className="text-sm font-black text-blue-800 whitespace-nowrap">
                                                                    {sign}{parseFloat(diffQty.toFixed(3)).toLocaleString('en-US')} Ton
                                                                </p>
                                                            </div>
                                                            {/* Card 2: Amendment Rate */}
                                                            <div>
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap block mb-1">Amendment Rate</span>
                                                                <p className="text-sm font-black text-blue-800 whitespace-nowrap">
                                                                    ${ratePerTon.toLocaleString('en-US')} /Ton
                                                                </p>
                                                            </div>
                                                            {/* Card 3: Freight */}
                                                            <div>
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap block mb-1">Freight</span>
                                                                <p className="text-sm font-black text-blue-800 whitespace-nowrap">
                                                                    ${freightPerTon.toLocaleString('en-US')} /Ton
                                                                </p>
                                                            </div>
                                                            {/* Card 4: Total Amendment Dollar */}
                                                            <div>
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap block mb-1">Total Amendment Dollar</span>
                                                                <p className="text-sm font-black text-blue-800 whitespace-nowrap">
                                                                    {sign}${parseFloat(diffDollar.toFixed(2)).toLocaleString('en-US')}
                                                                </p>
                                                            </div>
                                                            {/* Card 5: Amendment Dollar Rate */}
                                                            <div>
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap block mb-1">Amendment Dollar Rate</span>
                                                                <p className="text-sm font-black text-blue-800 whitespace-nowrap">
                                                                    ৳{dollarRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                                </p>
                                                            </div>
                                                            {/* Card 6: Amendment Value */}
                                                            <div>
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider whitespace-nowrap block mb-1">Amendment Value</span>
                                                                <p className="text-sm font-black text-blue-800 whitespace-nowrap">
                                                                    {sign}৳{parseFloat(diffAmount.toFixed(2)).toLocaleString('en-IN')}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="border-t border-blue-100/50 pt-3 text-left">
                                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">Amendment Bank Bill Details</span>
                                                            <div className={`grid grid-cols-2 ${gridColsClassMap[colsCount1] || 'md:grid-cols-5'} gap-x-8 gap-y-4 mb-3`}>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Margin</span>
                                                                    <p className="text-xs font-bold text-gray-700">
                                                                        {activeMilestone.amendmentMargin !== undefined && activeMilestone.amendmentMargin !== '' ? `${activeMilestone.amendmentMargin}%` : '-'}
                                                                    </p>
                                                                </div>
                                                                {hasCommission1 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Comm. on Amendment</span>
                                                                        <p className="text-xs font-bold text-gray-700">
                                                                            {activeMilestone.amendmentCommission}%
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {hasVatOnComm1 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">VAT on Comm.</span>
                                                                        <p className="text-xs font-bold text-gray-700">
                                                                            {activeMilestone.amendmentVatOnCommission}%
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {hasSwiftCharge1 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Swift Charge</span>
                                                                        <p className="text-xs font-bold text-gray-700">
                                                                            ৳{parseFloat(activeMilestone.amendmentSwiftCharge).toLocaleString('en-IN')}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                {hasVatOnSwift1 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-1">VAT on Swift</span>
                                                                        <p className="text-xs font-bold text-gray-700">
                                                                            {activeMilestone.amendmentVatOnSwift}%
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className={`grid grid-cols-1 ${gridColsClassMap[colsCount2] || 'md:grid-cols-4'} gap-x-8 gap-y-4 pt-3 border-t border-dashed border-blue-100/50`}>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Amendment Margin Bill</span>
                                                                    <p className="text-sm font-black text-blue-800 font-semibold">
                                                                        ৳{activeMilestone.amendmentMarginBill ? parseFloat(activeMilestone.amendmentMarginBill).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Amendment Margin Paid</span>
                                                                    <p className="text-sm font-black text-blue-800 font-semibold">
                                                                        ৳{activeMilestoneMarginPaid ? parseFloat(activeMilestoneMarginPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                                                                    </p>
                                                                </div>
                                                                {hasBankBill1 && (
                                                                    <div>
                                                                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Amendment Bank Bill</span>
                                                                        <p className="text-sm font-black text-blue-800 font-semibold">
                                                                            ৳{activeMilestone.amendmentBankBill ? parseFloat(activeMilestone.amendmentBankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Total Amendment Bank Bill</span>
                                                                    <p className="text-sm font-black text-indigo-900">
                                                                        ৳{(activeMilestone.totalAmendmentBankBill || activeMilestone.amendmentBill) ? parseFloat(activeMilestone.totalAmendmentBankBill || activeMilestone.amendmentBill).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Section 2.5: Bank Information */}
                                <div className="pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <BuildingIcon className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-left">Bank Information</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2 text-left">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Issuing Bank</span>
                                            <p className="text-sm font-bold text-gray-800">{data.bankName || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Branch</span>
                                            <p className="text-sm font-bold text-gray-800">{data.bankBranch || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Margin</span>
                                            <p className="text-sm font-bold text-gray-800">{data.bankMargin ? `${data.bankMargin}%` : '-'}</p>
                                        </div>
                                        {(data.lcBillEnabled !== undefined ? data.lcBillEnabled : !!(data.bankLcCommission || data.bankSwiftCharge || data.bankLcApplicationForm || data.bankMpCharge || data.bankStampCharge)) && (
                                            <>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Commission</span>
                                                    <p className="text-sm font-bold text-gray-800">{data.bankLcCommission ? `${data.bankLcCommission}%` : '-'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT on Commission</span>
                                                    <p className="text-sm font-bold text-gray-800">{data.bankVatOnCommission ? `${data.bankVatOnCommission}%` : '-'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Swift Charge</span>
                                                    <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.bankSwiftCharge || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT on Swift Charge</span>
                                                    <p className="text-sm font-bold text-gray-800">{data.bankVatOnSwiftCharge ? `${data.bankVatOnSwiftCharge}%` : '-'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Application Form</span>
                                                    <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.bankLcApplicationForm || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MP Charge</span>
                                                    <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.bankMpCharge || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stamp Charge</span>
                                                    <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.bankStampCharge || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                            </>
                                        )}
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Margin Bill</span>
                                            <p className="text-sm font-bold text-gray-800">
                                                {data.marginBill ? `৳${parseFloat(data.marginBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </p>
                                        </div>
                                        {(data.lcBillEnabled !== undefined ? data.lcBillEnabled : !!(data.bankLcCommission || data.bankSwiftCharge || data.bankLcApplicationForm || data.bankMpCharge || data.bankStampCharge)) && (
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Bill</span>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {data.bankBill ? `৳${parseFloat(data.bankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                </p>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Bank Bill</span>
                                            <p className="text-sm font-black text-blue-600">
                                                {data.totalBankBill ? `৳${parseFloat(data.totalBankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Insurance Details */}
                                <div className="pt-6 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <ShieldIcon className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest text-left">Insurance Information</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2 text-left">
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
                                            <p className="text-sm font-bold text-gray-800">{data.extraPercent || '0'}%</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Marine Cover Note</span>
                                            <p className="text-sm font-bold text-gray-800">{data.marineCoverNote || '-'}</p>
                                            {activeMilestone.addnNo && (
                                                <p className="text-[11px] font-bold text-amber-600 mt-1 whitespace-nowrap">
                                                    ADDN: {activeMilestone.addnNo}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Marine C.N Date</span>
                                            <p className="text-sm font-bold text-gray-800">{data.marineCNDate ? formatDate(data.marineCNDate) : '-'}</p>
                                            {activeMilestone.addnNo && (activeMilestone.addnDate || activeMilestone.amendmentDate) && (
                                                <p className="text-[11px] font-bold text-amber-600 mt-1 whitespace-nowrap">
                                                    DATE: {formatDate(activeMilestone.addnDate || activeMilestone.amendmentDate)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Rate</span>
                                            <p className="text-sm font-bold text-gray-800">{data.premium || '0'}%</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Return</span>
                                            <p className="text-sm font-bold text-blue-600">{data.premiumReturn || '0'}%</p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                            <p className="text-sm font-bold text-blue-600">৳{parseFloat(activeMilestone.expectedReturnAmount || data.expectedReturnAmount || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VAT ({data.premiumVat || '0'}%)</span>
                                            <p className="text-sm font-bold text-gray-800">
                                                ৳{(parseFloat(activeMilestone.netPremium || data.netPremium || 0) * (parseFloat(data.premiumVat || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stamp Duty</span>
                                            <p className="text-sm font-bold text-gray-800">৳{parseFloat(data.stampCharge || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                            <p className="text-sm font-bold text-gray-800">৳{parseFloat(activeMilestone.grossPremium || data.grossPremium || 0).toLocaleString('en-US')}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 p-4 bg-blue-50 rounded-xl flex justify-between items-center border border-blue-100 text-left">
                                        <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Net Payable Premium</span>
                                        <span className="text-lg font-black text-blue-700">৳{parseFloat(activeMilestone.netPremium || data.netPremium || 0).toLocaleString('en-US')}</span>
                                    </div>
                                </div>

                                {/* Section 4: Amendment Remarks */}
                                {!activeMilestone.isOriginal && (
                                    <div className="pt-6 border-t border-gray-100 text-left animate-in fade-in duration-200">
                                        <div className="flex items-center gap-2 mb-4">
                                            <FileTextIcon className="w-4 h-4 text-gray-400" />
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Amendment Remarks</h4>
                                        </div>
                                        <div className="p-4 bg-amber-50/30 border border-amber-100 rounded-2xl">
                                            <p className="text-sm font-medium text-amber-900 leading-relaxed whitespace-pre-wrap">{activeMilestone.remarks || 'No remarks provided for this amendment.'}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Edit Button */}
                                {canManage && (onEdit || onEditAmendment) && (
                                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                if (activeMilestone.isOriginal) {
                                                    onEdit?.(data);
                                                } else {
                                                    onEditAmendment?.(data, activeMilestone);
                                                }
                                            }}
                                            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <EditIcon className="w-4 h-4 text-gray-500" />
                                            <span>{activeMilestone.isOriginal ? 'Edit Original LC' : 'Edit Amendment'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Add Bill Form Modal Overlay */}
                {showAddBillModal && (
                    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowAddBillModal(false)}></div>
                        <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Add New Bill</h3>
                                    <p className="text-xs text-blue-500 font-bold uppercase tracking-widest mt-0.5">LC NO: {data.lcNo}</p>
                                </div>
                                <button onClick={() => setShowAddBillModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white transition-all">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Form */}
                            <form onSubmit={handleSaveBill} className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 text-left">
                                        <CustomDatePicker
                                            label="Date"
                                            value={billFormData.date}
                                            onChange={(e) => setBillFormData(prev => ({ ...prev, date: e.target.value }))}
                                            compact={true}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5 text-left relative" ref={billHeadRef}>
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Bill Head <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={billHeadQuery || billFormData.expenseHead}
                                                onChange={(e) => {
                                                    setBillHeadQuery(e.target.value);
                                                    setBillFormData(prev => ({ ...prev, expenseHead: '', cnfAgent: '' }));
                                                    setBillHeadDropdownOpen(true);
                                                    setBillHeadHighlight(-1);
                                                }}
                                                onFocus={() => { setBillHeadDropdownOpen(true); setBillHeadHighlight(-1); }}
                                                onKeyDown={(e) => {
                                                    const filtered = expenseHeads.filter(h => !billHeadQuery || h.toLowerCase().includes(billHeadQuery.toLowerCase()));
                                                    if (e.key === 'ArrowDown') {
                                                        e.preventDefault();
                                                        setBillHeadHighlight(prev => Math.min(prev + 1, filtered.length - 1));
                                                    } else if (e.key === 'ArrowUp') {
                                                        e.preventDefault();
                                                        setBillHeadHighlight(prev => Math.max(prev - 1, 0));
                                                    } else if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (billHeadHighlight >= 0 && billHeadHighlight < filtered.length) {
                                                            setBillFormData(prev => ({ ...prev, expenseHead: filtered[billHeadHighlight], cnfAgent: '' }));
                                                            setBillHeadQuery('');
                                                            setBillHeadDropdownOpen(false);
                                                        }
                                                    } else if (e.key === 'Escape') {
                                                        setBillHeadDropdownOpen(false);
                                                    }
                                                }}
                                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                                placeholder="Search Bill Head"
                                                autoComplete="nope"
                                                required={!billFormData.expenseHead}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                {(billFormData.expenseHead || billHeadQuery) && (
                                                    <button type="button" onClick={() => { setBillFormData(prev => ({ ...prev, expenseHead: '', cnfAgent: '' })); setBillHeadQuery(''); setBillHeadDropdownOpen(false); }} className="text-gray-400 hover:text-gray-600">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300" />
                                            </div>
                                        </div>
                                        {billHeadDropdownOpen && (
                                            <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1">
                                                {expenseHeads.filter(h => !billHeadQuery || h.toLowerCase().includes(billHeadQuery.toLowerCase())).map((head, idx) => (
                                                    <button
                                                        key={head}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setBillFormData(prev => ({ ...prev, expenseHead: head, cnfAgent: '' }));
                                                            setBillHeadQuery('');
                                                            setBillHeadDropdownOpen(false);
                                                        }}
                                                        onMouseEnter={() => setBillHeadHighlight(idx)}
                                                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${billHeadHighlight === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                    >
                                                        <span className="font-medium">{head}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>

                                {/* Conditional Bank Name */}
                                {(billFormData.expenseHead === 'Bank Charges' || billFormData.expenseHead === 'Margin Bill') && (
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Bank Name</label>
                                        <input
                                            type="text"
                                            value={billFormData.bankName}
                                            readOnly
                                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-500 font-semibold cursor-not-allowed"
                                        />
                                    </div>
                                )}

                                {/* Conditional C&F Agent */}
                                {billFormData.expenseHead === 'C&F Commission' && (
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">C&F Agent *</label>
                                        <div className="relative">
                                            <select
                                                value={billFormData.cnfAgent}
                                                onChange={(e) => setBillFormData(prev => ({ ...prev, cnfAgent: e.target.value }))}
                                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium appearance-none pr-10 cursor-pointer"
                                                required
                                            >
                                                <option value="">Select C&F Agent</option>
                                                {bdCnfs.map(cnf => (
                                                    <option key={cnf} value={cnf}>{cnf}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                )}


                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Amount (৳) *</label>
                                    <input
                                        type="number"
                                        value={billFormData.amount}
                                        onChange={(e) => setBillFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        required
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">Remarks</label>
                                    <textarea
                                        value={billFormData.remarks}
                                        onChange={(e) => setBillFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                        placeholder="Optional details..."
                                        rows="2"
                                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddBillModal(false)}
                                        className="px-5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingBill}
                                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all text-sm"
                                    >
                                        {isSavingBill ? 'Saving...' : 'Save Bill'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const getPiIpNumbers = (pi) => {
    if (!pi) return [];
    if (Array.isArray(pi.ipNumbers) && pi.ipNumbers.length > 0) return pi.ipNumbers;
    if (pi.ipNumber) return pi.ipNumber.split(',').map(s => s.trim()).filter(Boolean);
    return [];
};

export const getLCHistoryTimeline = (lc) => {
    if (!lc) return [];

    const getMilestoneTotalQty = (mil) => {
        if (!mil) return 0;
        if (mil.productsList && mil.productsList.length > 0) {
            return mil.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
        }
        return parseFloat(mil.quantity || 0);
    };

    const amendments = lc.amendments || [];
    const hasOriginal = amendments.some(a => a.amendmentNo === 'Original LC');

    let baseTimeline = [];

    if (hasOriginal) {
        baseTimeline = amendments.map(amnd => ({
            ...amnd,
            isOriginal: amnd.amendmentNo === 'Original LC'
        }));
    } else if (amendments.length === 0) {
        const totalQty = lc.productsList && lc.productsList.length > 0
            ? lc.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
            : lc.quantity;
        baseTimeline = [{
            amendmentNo: 'Original LC',
            amendmentDate: lc.openingDate,
            expiryDate: lc.expiryDate,
            quantity: totalQty,
            rate: lc.rate,
            dollarRate: lc.dollarRate,
            totalDollar: lc.totalDollar,
            totalAmount: lc.totalAmount,
            netPremium: lc.netPremium,
            expectedReturnAmount: lc.expectedReturnAmount,
            grossPremium: lc.grossPremium,
            piNo: lc.piNo || '',
            port: lc.port || '',
            latestShipmentDate: lc.latestShipmentDate || '',
            remarks: 'Original LC Details',
            isOriginal: true
        }];
    } else {
        const origQty = amendments[0]?.productsList && amendments[0].productsList.length > 0
            ? amendments[0].productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
            : (lc.productsList && lc.productsList.length > 0
                ? lc.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
                : (amendments[0]?.quantity || lc.quantity));

        baseTimeline.push({
            amendmentNo: 'Original LC',
            amendmentDate: lc.openingDate,
            expiryDate: lc.openingDate, // Fallback
            quantity: origQty,
            rate: amendments[0]?.rate || lc.rate,
            dollarRate: amendments[0]?.dollarRate || lc.dollarRate,
            totalDollar: amendments[0]?.totalDollar || lc.totalDollar,
            totalAmount: amendments[0]?.totalAmount || lc.totalAmount,
            netPremium: lc.netPremium,
            expectedReturnAmount: lc.expectedReturnAmount,
            grossPremium: lc.grossPremium,
            piNo: lc.piNo || '',
            port: lc.port || '',
            latestShipmentDate: lc.latestShipmentDate || '',
            remarks: 'Original LC Details (Estimated)',
            isOriginal: true
        });

        amendments.forEach(amnd => {
            baseTimeline.push({
                ...amnd,
                isOriginal: false
            });
        });
    }

    // Now enrich baseTimeline with calculated premiums
    return baseTimeline.map((item, idx) => {
        let netPremium = item.netPremium;
        let expectedReturnAmount = item.expectedReturnAmount;
        let grossPremium = item.grossPremium;

        if (lc.insuranceCo) {
            let baseAmount = 0;
            if (item.isOriginal) {
                baseAmount = parseFloat(item.totalAmount) || 0;
            } else {
                const prevMilestone = idx > 0 ? baseTimeline[idx - 1] : null;
                const prevQty = prevMilestone ? getMilestoneTotalQty(prevMilestone) : 0;
                const prevRVal = prevMilestone ? parseFloat(prevMilestone.rate || 0) : 0;
                const prevRateScaled = prevRVal > 0 ? (prevRVal < 10 ? prevRVal * 1000 : prevRVal) : 0;
                const prevProducts = prevMilestone?.productsList?.length > 0
                    ? prevMilestone.productsList
                    : (lc.productsList?.length > 0 ? lc.productsList : []);
                const prevFVal = parseFloat(prevProducts[0]?.freight || lc.freight || 0);
                const prevFreightPerTon = prevFVal < 0.1 ? prevFVal * 1000 : prevFVal;

                const prevDollarValue = prevQty * (prevRateScaled + prevFreightPerTon);

                const activeQty = getMilestoneTotalQty(item);
                const rVal = parseFloat(item.rate || 0);
                const ratePerTon = rVal < 10 ? rVal * 1000 : rVal;

                const activeProducts = item.productsList?.length > 0
                    ? item.productsList
                    : (lc.productsList?.length > 0 ? lc.productsList : []);
                const fVal = parseFloat(activeProducts[0]?.freight || lc.freight || 0);
                const freightPerTon = fVal < 0.1 ? fVal * 1000 : fVal;

                const newDollarValue = activeQty * (ratePerTon + freightPerTon);
                const diffDollar = newDollarValue - prevDollarValue;
                const dollarRate = parseFloat(item.dollarRate || lc.dollarRate || 0);
                const diffAmount = diffDollar * dollarRate;
                baseAmount = Math.abs(diffAmount);
            }

            if (baseAmount > 0) {
                const prem = parseFloat(lc.premium) || 0;
                const exPct = parseFloat(lc.extraPercent) || 0;
                const premRet = parseFloat(lc.premiumReturn) || 0;
                const pVat = parseFloat(lc.premiumVat) || 15;
                const stamp = parseFloat(lc.stampCharge) || 0;

                const baseNetPrem = (baseAmount * (prem / 100)) / 100;
                const netP = baseNetPrem + (baseNetPrem * (exPct / 100));
                netPremium = netP > 0 ? netP.toFixed(2) : '0';

                const expRet = netP * (premRet / 100);
                expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '0';

                const vatAmount = netP * (pVat / 100);
                const gPrem = netP + vatAmount + stamp;
                grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '0';
            }
        } else {
            netPremium = '0';
            expectedReturnAmount = '0';
            grossPremium = '0';
        }

        return {
            ...item,
            netPremium: netPremium || item.netPremium || '0',
            expectedReturnAmount: expectedReturnAmount || item.expectedReturnAmount || '0',
            grossPremium: grossPremium || item.grossPremium || '0'
        };
    });
};

const getRemIpQtyTon = (ipNo, ipRecordsRaw, lcRecords, editingId) => {
    const selectedIp = ipRecordsRaw.find(ip => ip.ipNumber === ipNo);
    if (!selectedIp) return 0;
    const totalLcQtyOnThisIp = lcRecords
        .filter(lc => {
            const lcIps = lc.ipNumbers?.length ? lc.ipNumbers : (lc.ipNo ? [lc.ipNo] : []);
            return lcIps.includes(ipNo) && lc._id !== editingId;
        })
        .reduce((sum, lc) => sum + (parseFloat(lc.quantity) || 0), 0);
    return (parseFloat(selectedIp.quantity || 0) / 1000) - totalLcQtyOnThisIp;
};

const mapPiProductsToLc = (pi) => {
    const piProducts = (pi.productsList?.length > 0)
        ? pi.productsList
        : (pi.productName
            ? [{ productName: pi.productName, hsCode: pi.hsCode || '', quantity: pi.quantity || '', rate: pi.rate || '', amount: pi.amount || '' }]
            : []);
    return piProducts.map(p => {
        const qtyTon = p.quantity ? parseFloat(p.quantity) / 1000 : 0;
        // PI rate/freight are per-kg; LC expects per-ton → multiply rate by 1000, freight by 100000
        const ratePerKg = parseFloat(p.rate) || 0;
        const freightPerKg = parseFloat(p.freight) || 0;
        const ratePerTon = ratePerKg * 1000;
        const freightPerTon = freightPerKg * 1000;
        // PI p.amount = qty_kg × rate_per_kg = qty_ton × rate_per_ton, so reuse directly
        const amt = parseFloat(p.amount) || qtyTon * ratePerTon;
        const lineFreight = parseFloat(p.totalFreight) || qtyTon * freightPerTon;
        const totalDollar = amt + lineFreight;
        return {
            productName: p.productName || '',
            hsCode: p.hsCode || '',
            quantity: qtyTon ? String(qtyTon) : '',
            rate: ratePerTon > 0 ? String(ratePerTon) : '',
            freight: freightPerTon > 0 ? String(freightPerTon) : '',
            totalFreight: lineFreight > 0 ? String(lineFreight) : '',
            totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
        };
    });
};

const calcLcProductLine = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const r = parseFloat(item.rate) || 0;
    const f = parseFloat(item.freight) || 0;
    const amt = qty * r;
    const totalFreight = qty * f;
    const totalDollar = amt + totalFreight;
    return {
        ...item,
        totalFreight: totalFreight > 0 ? totalFreight.toFixed(2) : '',
        totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
    };
};

const syncRootFromProductsList = (state) => {
    const products = state.productsList || [];
    const first = products[0];
    if (first) {
        state.productName = first.productName || '';
        state.hsCode = first.hsCode || '';
        state.quantity = first.quantity || '';
        state.rate = first.rate || '';
    }
    // Sum totalDollar across ALL product lines
    const sumDollar = products.reduce((acc, p) => acc + (parseFloat(p.totalDollar) || 0), 0);
    state.totalDollar = sumDollar > 0 ? sumDollar.toFixed(2) : '';
    return state;
};

const calculateBankBills = (state) => {
    const totalAmount = parseFloat(state.totalAmount) || 0;
    const margin = parseFloat(state.bankMargin) || 0;
    const marginBill = totalAmount; // Margin bill is = total lc value
    const marginPaid = totalAmount * (margin / 100); // margin paid is the value is Margin %

    const isLcBillActive = state.lcBillEnabled !== undefined
        ? state.lcBillEnabled
        : !!(state.bankLcCommission || state.bankSwiftCharge || state.bankLcApplicationForm || state.bankMpCharge || state.bankStampCharge);

    let bankBill = 0;
    if (isLcBillActive) {
        const bankLcCommission = parseFloat(state.bankLcCommission) || 0;
        const bankVatOnCommission = parseFloat(state.bankVatOnCommission) || 0;
        const bankSwiftCharge = parseFloat(state.bankSwiftCharge) || 0;
        const bankVatOnSwiftCharge = parseFloat(state.bankVatOnSwiftCharge) || 0;
        const bankLcApplicationForm = parseFloat(state.bankLcApplicationForm) || 0;
        const bankMpCharge = parseFloat(state.bankMpCharge) || 0;
        const bankStampCharge = parseFloat(state.bankStampCharge) || 0;

        const lcCommissionAmt = totalAmount * (bankLcCommission / 100);
        const vatOnCommissionAmt = lcCommissionAmt * (bankVatOnCommission / 100);
        const vatOnSwiftChargeAmt = bankSwiftCharge * (bankVatOnSwiftCharge / 100);

        bankBill = lcCommissionAmt + vatOnCommissionAmt + bankSwiftCharge + vatOnSwiftChargeAmt + bankLcApplicationForm + bankMpCharge + bankStampCharge;
    }

    const totalBankBill = (marginBill + bankBill) - marginPaid;

    return {
        marginBill: marginBill > 0 ? marginBill.toFixed(2) : '',
        marginPaid: marginPaid > 0 ? marginPaid.toFixed(2) : '',
        bankBill: bankBill > 0 ? bankBill.toFixed(2) : '',
        totalBankBill: totalBankBill > 0 ? totalBankBill.toFixed(2) : ''
    };
};

const syncBankBills = (state) => {
    const bills = calculateBankBills(state);
    state.marginBill = bills.marginBill;
    state.marginPaid = bills.marginPaid;
    state.bankBill = bills.bankBill;
    state.totalBankBill = bills.totalBankBill;
    return state;
};

const calculateAmendmentBillsValue = (state, lc, banksRaw, editingAmendmentNo = '') => {
    if (!lc) return {
        amendmentMargin: '',
        amendmentCommission: '',
        amendmentVatOnCommission: '',
        amendmentSwiftCharge: '',
        amendmentVatOnSwift: '',
        amendmentMarginBill: '',
        amendmentBankBill: '',
        totalAmendmentBankBill: ''
    };

    const selectedBank = banksRaw.find(b => (b.bankName || '').trim().toUpperCase() === (lc.bankName || '').trim().toUpperCase());
    const selectedBranch = selectedBank?.branches?.find(br => br.branch === lc.bankBranch);

    const margin = state.amendmentMargin !== undefined && state.amendmentMargin !== ''
        ? (parseFloat(state.amendmentMargin) || 0)
        : (lc.bankMargin !== undefined && lc.bankMargin !== '' ? parseFloat(lc.bankMargin) : 0);

    const isAmndBillActive = state.amendmentLcBillEnabled !== undefined
        ? state.amendmentLcBillEnabled
        : !!(state.amendmentCommission || state.amendmentSwiftCharge);

    const amendmentCommission = state.amendmentCommission !== undefined && state.amendmentCommission !== ''
        ? (parseFloat(state.amendmentCommission) || 0)
        : (selectedBranch?.amendmentCommission !== undefined && selectedBranch?.amendmentCommission !== '' ? parseFloat(selectedBranch.amendmentCommission) : 0);

    const amendmentVatOnCommission = state.amendmentVatOnCommission !== undefined && state.amendmentVatOnCommission !== ''
        ? (parseFloat(state.amendmentVatOnCommission) || 0)
        : (selectedBranch?.amendmentVatOnCommission !== undefined && selectedBranch?.amendmentVatOnCommission !== '' ? parseFloat(selectedBranch.amendmentVatOnCommission) : 0);

    const amendmentSwiftCharge = state.amendmentSwiftCharge !== undefined && state.amendmentSwiftCharge !== ''
        ? (parseFloat(state.amendmentSwiftCharge) || 0)
        : (selectedBranch?.amendmentSwiftCharge !== undefined && selectedBranch?.amendmentSwiftCharge !== '' ? parseFloat(selectedBranch.amendmentSwiftCharge) : 0);

    const amendmentVatOnSwift = state.amendmentVatOnSwift !== undefined && state.amendmentVatOnSwift !== ''
        ? (parseFloat(state.amendmentVatOnSwift) || 0)
        : (selectedBranch?.amendmentVatOnSwift !== undefined && selectedBranch?.amendmentVatOnSwift !== '' ? parseFloat(selectedBranch.amendmentVatOnSwift) : 0);

    const currentAmendments = [...(lc.amendments || [])];
    const getMilestoneTotalQty = (mil) => {
        if (!mil) return 0;
        if (mil.productsList && mil.productsList.length > 0) {
            return mil.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
        }
        return parseFloat(mil.quantity || 0);
    };

    const prevMilestone = editingAmendmentNo
        ? (() => {
            const idx = currentAmendments.findIndex(a => a.amendmentNo === editingAmendmentNo);
            return idx > 0 ? currentAmendments[idx - 1] : lc;
        })()
        : (currentAmendments.length > 0 ? currentAmendments[currentAmendments.length - 1] : lc);

    const prevQty = getMilestoneTotalQty(prevMilestone);
    const prevAmount = parseFloat(prevMilestone.totalAmount || lc.totalAmount || 0);

    const prevMargin = parseFloat(
        prevMilestone.amendmentMargin !== undefined && prevMilestone.amendmentMargin !== ''
            ? prevMilestone.amendmentMargin
            : (prevMilestone.bankMargin !== undefined && prevMilestone.bankMargin !== '' ? prevMilestone.bankMargin : (lc.bankMargin || 0))
    );

    const qty = parseFloat(state.quantity) || 0;
    const r = parseFloat(state.rate) || 0;
    const dRate = parseFloat(state.dollarRate) || 0;
    const targetRateScaled = r > 0 ? (r < 10 ? r * 1000 : r) : 0;

    const firstProduct = (lc.productsList || [])[0];
    const fVal = parseFloat(firstProduct?.freight || lc.freight || 0);
    const freightPerTon = fVal < 0.1 ? fVal * 1000 : fVal;

    // Fetch previous rates to compute accurate value difference
    const prevRVal = parseFloat(prevMilestone.rate || 0);
    const prevRateScaled = prevRVal > 0 ? (prevRVal < 10 ? prevRVal * 1000 : prevRVal) : 0;
    const prevFirstProduct = (prevMilestone.productsList || [])[0];
    const prevFVal = parseFloat(prevFirstProduct?.freight || prevMilestone.freight || lc.freight || 0);
    const prevFreightPerTon = prevFVal < 0.1 ? prevFVal * 1000 : prevFVal;

    const prevDollarValue = prevQty * (prevRateScaled + prevFreightPerTon);
    const newDollarValue = qty * (targetRateScaled + freightPerTon);
    const diffDollar = newDollarValue - prevDollarValue;
    const diffAmount = diffDollar * dRate;
    const baseAmount = Math.abs(diffAmount);

    const newAmount = newDollarValue * dRate;

    const calculatedMarginBill = baseAmount;
    const calculatedMarginPaid = baseAmount * (margin / 100);

    const commissionAmt = baseAmount * (amendmentCommission / 100);
    const vatOnCommissionAmt = commissionAmt * (amendmentVatOnCommission / 100);
    const swiftCharge = amendmentSwiftCharge;
    const vatOnSwiftChargeAmt = swiftCharge * (amendmentVatOnSwift / 100);

    const calculatedBankBill = isAmndBillActive ? (commissionAmt + vatOnCommissionAmt + swiftCharge + vatOnSwiftChargeAmt) : 0;
    const calculatedTotalBill = (calculatedMarginBill + calculatedBankBill) - calculatedMarginPaid;

    return {
        amendmentMargin: state.amendmentMargin !== undefined ? state.amendmentMargin : (lc.bankMargin || ''),
        amendmentCommission: isAmndBillActive
            ? (state.amendmentCommission !== undefined ? state.amendmentCommission : (selectedBranch?.amendmentCommission || ''))
            : '',
        amendmentVatOnCommission: isAmndBillActive
            ? (state.amendmentVatOnCommission !== undefined ? state.amendmentVatOnCommission : (selectedBranch?.amendmentVatOnCommission || ''))
            : '',
        amendmentSwiftCharge: isAmndBillActive
            ? (state.amendmentSwiftCharge !== undefined ? state.amendmentSwiftCharge : (selectedBranch?.amendmentSwiftCharge !== undefined && selectedBranch?.amendmentSwiftCharge !== '' ? String(selectedBranch.amendmentSwiftCharge) : ''))
            : '',
        amendmentVatOnSwift: isAmndBillActive
            ? (state.amendmentVatOnSwift !== undefined ? state.amendmentVatOnSwift : (selectedBranch?.amendmentVatOnSwift || ''))
            : '',
        amendmentMarginBill: calculatedMarginBill >= 0 ? calculatedMarginBill.toFixed(2) : '',
        amendmentMarginPaid: calculatedMarginPaid >= 0 ? calculatedMarginPaid.toFixed(2) : '',
        amendmentBankBill: isAmndBillActive && calculatedBankBill >= 0 ? calculatedBankBill.toFixed(2) : '',
        totalAmendmentBankBill: calculatedTotalBill >= 0 ? calculatedTotalBill.toFixed(2) : ''
    };
};

const syncAmendmentBills = (state, lc, banksRaw, editingAmendmentNo = '', ignoreOverride = false) => {
    if (!ignoreOverride) {
        const bills = calculateAmendmentBillsValue(state, lc, banksRaw, editingAmendmentNo);
        state.amendmentMargin = bills.amendmentMargin;
        state.amendmentCommission = bills.amendmentCommission;
        state.amendmentVatOnCommission = bills.amendmentVatOnCommission;
        state.amendmentSwiftCharge = bills.amendmentSwiftCharge;
        state.amendmentVatOnSwift = bills.amendmentVatOnSwift;
        state.amendmentMarginBill = bills.amendmentMarginBill;
        state.amendmentMarginPaid = bills.amendmentMarginPaid;
        state.amendmentBankBill = bills.amendmentBankBill;
        state.totalAmendmentBankBill = bills.totalAmendmentBankBill;
    } else {
        const mBill = parseFloat(state.amendmentMarginBill) || 0;
        const mPaid = parseFloat(state.amendmentMarginPaid) || 0;
        const isAmndBillActive = state.amendmentLcBillEnabled !== undefined
            ? state.amendmentLcBillEnabled
            : !!(state.amendmentCommission || state.amendmentSwiftCharge);
        const bBill = isAmndBillActive ? (parseFloat(state.amendmentBankBill) || 0) : 0;
        const tot = (mBill + bBill) - mPaid;
        state.totalAmendmentBankBill = tot > 0 ? tot.toFixed(2) : '';
    }
    return state;
};

const getBankBillBreakdown = (record) => {
    const totalAmount = parseFloat(record.totalAmount) || 0;
    const margin = parseFloat(record.bankMargin) || 0;
    const marginBill = parseFloat(record.marginBill) || totalAmount;
    const marginPaid = parseFloat(record.marginPaid) || (totalAmount * (margin / 100));

    const bankLcCommission = parseFloat(record.bankLcCommission) || 0;
    const bankVatOnCommission = parseFloat(record.bankVatOnCommission) || 0;
    const bankSwiftCharge = parseFloat(record.bankSwiftCharge) || 0;
    const bankVatOnSwiftCharge = parseFloat(record.bankVatOnSwiftCharge) || 0;
    const bankLcApplicationForm = parseFloat(record.bankLcApplicationForm) || 0;
    const bankMpCharge = parseFloat(record.bankMpCharge) || 0;
    const bankStampCharge = parseFloat(record.bankStampCharge) || 0;

    const commissionAmt = totalAmount * (bankLcCommission / 100);
    const vatOnCommissionAmt = commissionAmt * (bankVatOnCommission / 100);
    const vatOnSwiftChargeAmt = bankSwiftCharge * (bankVatOnSwiftCharge / 100);

    const bankBill = parseFloat(record.bankBill) || (commissionAmt + vatOnCommissionAmt + bankSwiftCharge + vatOnSwiftChargeAmt + bankLcApplicationForm + bankMpCharge + bankStampCharge);
    const totalBankBill = parseFloat(record.totalBankBill) || ((marginBill + bankBill) - marginPaid);

    return {
        margin,
        marginBill,
        marginPaid,
        bankLcCommission,
        commissionAmt,
        bankVatOnCommission,
        vatOnCommissionAmt,
        bankSwiftCharge,
        bankVatOnSwiftCharge,
        vatOnSwiftChargeAmt,
        bankLcApplicationForm,
        bankMpCharge,
        bankStampCharge,
        bankBill,
        totalBankBill
    };
};

const getAmendmentBreakdown = (record) => {
    const amendments = (record.amendments || []).filter(a => a.amendmentNo !== 'Original LC');
    let totalAmendmentBankBill = 0;
    let totalAmendmentMarginBill = 0;
    let totalAmendmentMarginPaid = 0;
    let totalAmendmentCombined = 0;

    const list = amendments.map((amnd, index) => {
        const isAmndBillActive = amnd.amendmentLcBillEnabled !== undefined
            ? amnd.amendmentLcBillEnabled
            : !!(amnd.amendmentCommission || amnd.amendmentSwiftCharge);

        const bankBill = isAmndBillActive ? (parseFloat(amnd.amendmentBankBill || amnd.amendmentBill) || 0) : 0;
        const marginBill = parseFloat(amnd.amendmentMarginBill) || 0;
        const marginPaid = parseFloat(amnd.amendmentMarginPaid) || 0;
        const totalBill = isAmndBillActive
            ? (parseFloat(amnd.totalAmendmentBankBill || amnd.amendmentBill) || ((marginBill + bankBill) - marginPaid))
            : (marginBill - marginPaid);

        totalAmendmentBankBill += bankBill;
        totalAmendmentMarginBill += marginBill;
        totalAmendmentMarginPaid += marginPaid;
        totalAmendmentCombined += totalBill;

        const swiftCharge = isAmndBillActive ? (parseFloat(amnd.amendmentSwiftCharge) || 0) : 0;
        const vatOnSwift = isAmndBillActive ? (parseFloat(amnd.amendmentVatOnSwift) || 0) : 0;
        const vatOnSwiftAmt = swiftCharge * (vatOnSwift / 100);

        const vatOnCommission = isAmndBillActive ? (parseFloat(amnd.amendmentVatOnCommission) || 0) : 0;
        const commissionTotal = Math.max(0, bankBill - swiftCharge - vatOnSwiftAmt);
        const commissionAmt = commissionTotal / (1 + vatOnCommission / 100);
        const vatOnCommissionAmt = commissionTotal - commissionAmt;

        return {
            amendmentNo: amnd.amendmentNo || `Amendment-${String(index + 1).padStart(2, '0')}`,
            amendmentDate: amnd.amendmentDate,
            bankBill,
            marginBill,
            marginPaid,
            totalBill,
            commission: isAmndBillActive ? (amnd.amendmentCommission || '0') : '0',
            commissionAmt,
            vatOnCommission,
            vatOnCommissionAmt,
            swiftCharge,
            vatOnSwift,
            vatOnSwiftAmt,
            margin: amnd.amendmentMargin || '0'
        };
    });

    return {
        list,
        totalAmendmentBankBill,
        totalAmendmentMarginBill,
        totalAmendmentMarginPaid,
        totalAmendmentCombined
    };
};

const LCManagement = ({ addNotification, currentUser }) => {
    const [lcRecords, setLcRecords] = useState([]);
    const [banks, setBanks] = useState([]);
    const [banksRaw, setBanksRaw] = useState([]);
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
    const [ports, setPorts] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [idToDelete, setIdToDelete] = useState(null);
    const [deleteStatus, setDeleteStatus] = useState(null);

    // Amendment states
    const [showAmendmentForm, setShowAmendmentForm] = useState(false);
    const [selectedAmendmentLcId, setSelectedAmendmentLcId] = useState('');
    const [amendmentSearchQuery, setAmendmentSearchQuery] = useState('');
    const [editingAmendmentNo, setEditingAmendmentNo] = useState('');
    const [amendmentFormData, setAmendmentFormData] = useState({
        amendmentNo: '',
        amendmentDate: '',
        expiryDate: '',
        quantity: '',
        rate: '',
        dollarRate: '',
        remarks: '',
        addnNo: '',
        addnDate: '',
        port: '',
        extendedShipmentDate: '',
        piNo: '',
        amendmentMargin: '',
        amendmentCommission: '',
        amendmentVatOnCommission: '',
        amendmentSwiftCharge: '',
        amendmentVatOnSwift: '',
        amendmentMarginBill: '',
        amendmentMarginPaid: '',
        amendmentBankBill: '',
        totalAmendmentBankBill: '',
        amendmentBill: '',
        amendmentLcBillEnabled: false
    });

    // Advanced Filter states
    const [showLcFilterPanel, setShowLcFilterPanel] = useState(false);
    const initialLcFilterState = {
        startDate: '',
        endDate: '',
        port: '',
        exporterName: '',
        importerName: '',
        productName: ''
    };
    const [lcFilters, setLcFilters] = useState(initialLcFilterState);
    const [filterSearchInputs, setFilterSearchInputs] = useState({
        portSearch: '',
        exporterSearch: '',
        importerSearch: '',
        productSearch: ''
    });
    const initialFilterDropdownState = {
        port: false,
        exporter: false,
        importer: false,
        product: false
    };
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(initialFilterDropdownState);

    const canManage = ['admin', 'incharge', 'lc manager', 'border manager', 'data entry'].includes((currentUser?.role || '').toLowerCase());

    const piRef = useRef(null);
    const bankRef = useRef(null);
    const branchRef = useRef(null);
    const importerRef = useRef(null);
    const exporterRef = useRef(null);
    const productRef = useRef(null);
    const insuranceRef = useRef(null);
    const statusRef = useRef(null);
    const amendmentLcRef = useRef(null);
    const amendmentPiRef = useRef(null);
    const portRef = useRef(null);
    const amendmentPortRef = useRef(null);

    // Advanced Filter Refs
    const lcFilterPanelRef = useRef(null);
    const lcFilterButtonRef = useRef(null);
    const portFilterRef = useRef(null);
    const exporterFilterRef = useRef(null);
    const importerFilterRef = useRef(null);
    const productFilterRef = useRef(null);


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
        piOpeningDate: '',
        latestShipmentDate: '',
        marineCoverNote: '',
        marineCNDate: '',
        port: '',
        productsList: [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }],
        bankBranch: '',
        bankMargin: '',
        bankLcCommission: '',
        bankVatOnCommission: '',
        bankSwiftCharge: '',
        bankVatOnSwiftCharge: '',
        bankLcApplicationForm: '',
        bankMpCharge: '',
        bankStampCharge: '',
        marginBill: '',
        marginPaid: '',
        bankBill: '',
        totalBankBill: '',
        lcBillEnabled: false,
        amendments: [],
    });
    const [gpRecords, setGpRecords] = useState([]);
    const [lcExpenses, setLcExpenses] = useState([]);
    const [insurancePayments, setInsurancePayments] = useState([]);
    const [expandedLcKey, setExpandedLcKey] = useState(null);
    const [expandedCardKey, setExpandedCardKey] = useState(null);
    const getLcTotalPaidExpense = (record) => {
        // 1. Paid LC expenses (excluding bills)
        const paidExpenses = lcExpenses
            .filter(exp => exp.lcNo === record.lcNo && exp.type !== 'bill')
            .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);

        // 2. Paid insurance premiums
        const paidInsurance = insurancePayments
            .filter(p => p.lcNo === record.lcNo && p.type !== 'Return Collection')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0), 0);

        // 3. Margin paid (original)
        const marginPaidAmt = parseFloat(record.marginPaid) || (() => {
            const total = parseFloat(record.totalAmount) || 0;
            const margin = parseFloat(record.bankMargin) || 0;
            return total * (margin / 100);
        })();

        let total = paidExpenses + paidInsurance + marginPaidAmt;

        // 4. Margin paid (amendments)
        if (record.amendments && record.amendments.length > 0) {
            record.amendments.forEach((amnd) => {
                if (amnd.amendmentNo === 'Original LC') return;
                const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (record.bankMargin !== undefined ? parseFloat(record.bankMargin) : 0);
                const amndMarginPaid = parseFloat(amnd.amendmentMarginPaid) || (() => {
                    const amndMarginBill = parseFloat(amnd.amendmentMarginBill) || 0;
                    return amndMarginBill * (margin / 100);
                })();
                if (amndMarginPaid > 0) {
                    total += amndMarginPaid;
                }
            });
        }

        return total;
    };

    const informativeQuantities = useMemo(() => {
        const selectedPi = piRecordsRaw.find(pi => pi.piNumber === formData.piNo);
        const piQtyTon = selectedPi ? (parseFloat(selectedPi.quantity || 0) / 1000) : 0;

        const ipNumbers = formData.ipNumbers?.length
            ? formData.ipNumbers
            : (formData.ipNo ? [formData.ipNo] : []);

        const ipEntries = ipNumbers.map(ipNo => ({
            ipNo,
            remIpQtyTon: getRemIpQtyTon(ipNo, ipRecordsRaw, lcRecords, editingId),
        }));

        return { piQtyTon, ipEntries };
    }, [formData.ipNo, formData.ipNumbers, formData.piNo, ipRecordsRaw, piRecordsRaw, lcRecords, editingId]);

    const getExpandedDropdownOptions = (currentInputVal) => {
        const rawOptions = [];
        piList.forEach(pi => {
            if (pi.endsWith(' (REVISED)')) {
                const clean = pi.replace(' (REVISED)', '');
                rawOptions.push(clean);
                rawOptions.push(pi);
            } else {
                rawOptions.push(pi);
            }
        });
        const uniqueOptions = Array.from(new Set(rawOptions));
        const q = (currentInputVal || '').toLowerCase().trim();
        if (!q) return uniqueOptions;
        return uniqueOptions.filter(opt => opt.toLowerCase().includes(q));
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            const refs = [piRef, bankRef, branchRef, importerRef, exporterRef, productRef, insuranceRef, statusRef, amendmentLcRef, amendmentPiRef, portRef, amendmentPortRef];
            const isClickInside = refs.some(ref => ref.current && ref.current.contains(e.target));
            if (!isClickInside) {
                setActiveDropdown(null);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            if (openKey === 'port') {
                refsToCheck = [portFilterRef];
            } else if (openKey === 'exporter') {
                refsToCheck = [exporterFilterRef];
            } else if (openKey === 'importer') {
                refsToCheck = [importerFilterRef];
            } else if (openKey === 'product') {
                refsToCheck = [productFilterRef];
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

    // Advanced Filter Option Helpers
    const getFilteredOptions = (type) => {
        let options = [];
        let search = '';

        switch (type) {
            case 'lcFilterPort':
                options = [...new Set(lcRecords.map(r => (r.port || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.portSearch;
                break;
            case 'lcFilterExporter':
                options = [...new Set(lcRecords.map(r => (r.exporterName || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.exporterSearch;
                break;
            case 'lcFilterImporter':
                options = [...new Set(lcRecords.map(r => (r.importerName || '').trim()).filter(Boolean))].sort();
                search = filterSearchInputs.importerSearch;
                break;
            case 'lcFilterProduct':
                const products = [];
                lcRecords.forEach(r => {
                    if (r.productName) products.push(r.productName.trim());
                    if (r.productsList) {
                        r.productsList.forEach(p => {
                            if (p.productName) products.push(p.productName.trim());
                        });
                    }
                });
                options = [...new Set(products)].sort();
                search = filterSearchInputs.productSearch;
                break;
            default:
                return [];
        }

        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    };

    const handleDropdownSelect = (field, value) => {
        if (field === 'amendmentPort') {
            setAmendmentFormData(prev => ({ ...prev, port: value }));
            setActiveDropdown(null);
            return;
        }
        if (field === 'amendmentPiNo') {
            const cleanPiNo = value ? value.replace(' (REVISED)', '') : '';
            const selectedPi = piRecordsRaw.find(pi => pi.piNumber === cleanPiNo);

            setAmendmentFormData(prev => {
                const nextState = { ...prev, piNo: value };
                if (selectedPi) {
                    const isSelectedRevised = value.endsWith(' (REVISED)');
                    const hasRevisions = selectedPi.revisions && selectedPi.revisions.length > 0;

                    let targetSource = selectedPi;
                    if (hasRevisions) {
                        if (isSelectedRevised) {
                            targetSource = selectedPi;
                        } else {
                            const originalRev = selectedPi.revisions.find(r => r.reviseNo === 'Original PI');
                            if (originalRev) {
                                targetSource = {
                                    ...selectedPi,
                                    ...originalRev
                                };
                            }
                        }
                    }

                    const firstProd = (targetSource.productsList || [])[0];
                    const piQtyTons = targetSource.productsList && targetSource.productsList.length > 0
                        ? targetSource.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0) / 1000
                        : (parseFloat(targetSource.grandTotalQuantity || targetSource.quantity) || 0) / 1000;

                    const piRate = firstProd ? (firstProd.rate || '') : (targetSource.rate || '');

                    nextState.quantity = piQtyTons > 0 ? String(piQtyTons) : prev.quantity;
                    nextState.rate = piRate ? String(piRate) : prev.rate;
                }
                syncAmendmentBills(nextState, selectedLcForAmendment, banksRaw, editingAmendmentNo);
                return nextState;
            });
            setActiveDropdown(null);
            return;
        }
        setFormData(prev => {
            const newState = { ...prev, [field]: value };

            // Auto-fill logic when PI Number is selected
            if (field === 'piNo') {
                if (value) {
                    const cleanValue = value.replace(' (REVISED)', '');
                    newState.piNo = value;
                    const selectedPi = piRecordsRaw.find(pi => pi.piNumber === cleanValue);
                    if (selectedPi) {
                        const isSelectedRevised = value.endsWith(' (REVISED)');
                        const hasRevisions = selectedPi.revisions && selectedPi.revisions.length > 0;

                        let targetSource = selectedPi;
                        if (hasRevisions) {
                            if (isSelectedRevised) {
                                targetSource = selectedPi;
                            } else {
                                const originalRev = selectedPi.revisions.find(r => r.reviseNo === 'Original PI');
                                if (originalRev) {
                                    targetSource = {
                                        ...selectedPi,
                                        ...originalRev
                                    };
                                }
                            }
                        }

                        if (selectedPi.partyName) newState.importerName = selectedPi.partyName;
                        if (selectedPi.exporterName) newState.exporterName = selectedPi.exporterName;
                        if (targetSource.date) newState.piOpeningDate = targetSource.reviseDate || targetSource.date || selectedPi.date;
                        const piPort = targetSource.port || targetSource.portOfDischarge || targetSource.portOfLoading;
                        if (piPort) newState.port = piPort;

                        const ipNums = getPiIpNumbers(targetSource);
                        newState.ipNumbers = ipNums;
                        newState.ipNo = ipNums[0] || '';

                        newState.productsList = mapPiProductsToLc(targetSource);
                        if (newState.productsList.length === 0) {
                            newState.productsList = [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }];
                        }
                        syncRootFromProductsList(newState);
                        const dRate = parseFloat(newState.dollarRate || prev.dollarRate) || 0;
                        const tDollar = parseFloat(newState.totalDollar) || 0;
                        const totalVal = tDollar * dRate;
                        newState.totalAmount = totalVal > 0 ? totalVal.toFixed(2) : '';
                    }
                } else {
                    newState.importerName = '';
                    newState.exporterName = '';
                    newState.hsCode = '';
                    newState.productName = '';
                    newState.quantity = '';
                    newState.rate = '';
                    newState.totalDollar = '';
                    newState.piOpeningDate = '';
                    newState.port = '';
                    newState.ipNumbers = [];
                    newState.ipNo = '';
                    newState.productsList = [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }];
                }
            }

            // Auto-fill logic when Insurance Company is selected
            if (field === 'insuranceCo') {
                if (value) {
                    const selectedIns = insuranceRecordsRaw.find(ins => ins.companyName === value);
                    if (selectedIns) {
                        if (selectedIns.policyType) newState.policyType = selectedIns.policyType;
                        if (selectedIns.premiumPercent) newState.premium = selectedIns.premiumPercent;
                        if (selectedIns.premiumReturnPercent) newState.premiumReturn = selectedIns.premiumReturnPercent;
                        if (selectedIns.stampCharge) newState.stampCharge = selectedIns.stampCharge;

                        // Auto-calculate Net Premium, Gross Premium, and Return Amount
                        const totalAmount = parseFloat(newState.totalAmount || prev.totalAmount) || 0;
                        const exPct = parseFloat(newState.extraPercent || prev.extraPercent) || 0;
                        const prem = parseFloat(selectedIns.premiumPercent || newState.premium || prev.premium) || 0;
                        const premRet = parseFloat(selectedIns.premiumReturnPercent || newState.premiumReturn || prev.premiumReturn) || 0;
                        const pVat = parseFloat(newState.premiumVat || prev.premiumVat) || 0;
                        const stamp = parseFloat(selectedIns.stampCharge || newState.stampCharge || prev.stampCharge) || 0;

                        const baseNetPrem = (totalAmount * (prem / 100)) / 100;
                        const netPrem = baseNetPrem + (baseNetPrem * (exPct / 100));
                        newState.netPremium = netPrem > 0 ? netPrem.toFixed(2) : '';

                        const expRet = netPrem * (premRet / 100);
                        newState.expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';

                        const vatAmount = netPrem * (pVat / 100);
                        const gPrem = netPrem + vatAmount + stamp;
                        newState.grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
                    }
                } else {
                    newState.policyType = '';
                    newState.premium = '';
                    newState.premiumReturn = '';
                    newState.stampCharge = '';
                    newState.netPremium = '';
                    newState.expectedReturnAmount = '';
                    newState.grossPremium = '';
                }
            }

            if (field === 'bankName') {
                newState.bankName = value;
                if (!value) {
                    newState.bankBranch = '';
                    newState.bankLcCommission = '';
                    newState.bankVatOnCommission = '';
                    newState.bankSwiftCharge = '';
                    newState.bankVatOnSwiftCharge = '';
                    newState.bankLcApplicationForm = '';
                    newState.bankMpCharge = '';
                    newState.bankStampCharge = '';
                }
            }

            if (field === 'bankBranch') {
                if (value) {
                    const selectedBank = banksRaw.find(b => (b.bankName || '').trim().toUpperCase() === (newState.bankName || prev.bankName || '').trim().toUpperCase());
                    const selectedBranch = selectedBank?.branches?.find(br => br.branch === value);
                    if (selectedBranch) {
                        newState.bankBranch = value;
                        newState.bankLcCommission = selectedBranch.lcCommission || '';
                        newState.bankVatOnCommission = selectedBranch.vatOnCommission || '';
                        newState.bankSwiftCharge = selectedBranch.swiftCharge || '';
                        newState.bankVatOnSwiftCharge = selectedBranch.vatOnSwiftCharge || '';
                        newState.bankLcApplicationForm = selectedBranch.lcApplicationForm || '';
                        newState.bankMpCharge = selectedBranch.mpCharge || '';
                        newState.bankStampCharge = selectedBranch.stampCharge || '';
                    }
                } else {
                    newState.bankBranch = '';
                    newState.bankLcCommission = '';
                    newState.bankVatOnCommission = '';
                    newState.bankSwiftCharge = '';
                    newState.bankVatOnSwiftCharge = '';
                    newState.bankLcApplicationForm = '';
                    newState.bankMpCharge = '';
                    newState.bankStampCharge = '';
                }
            }

            syncBankBills(newState);
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
            const [lcRes, bankRes, impRes, expRes, insRes, ipRes, piRes, prodRes, stockRes, saleRes, gpRes, expenseRes, portRes, insPayRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/lc-management`),
                axios.get(`${API_BASE_URL}/api/banks`),
                axios.get(`${API_BASE_URL}/api/importers`),
                axios.get(`${API_BASE_URL}/api/exporters`),
                axios.get(`${API_BASE_URL}/api/insurance`),
                axios.get(`${API_BASE_URL}/api/ip-records`),
                axios.get(`${API_BASE_URL}/api/pi`),
                axios.get(`${API_BASE_URL}/api/products`),
                axios.get(`${API_BASE_URL}/api/stock`),
                axios.get(`${API_BASE_URL}/api/sales`),
                axios.get(`${API_BASE_URL}/api/lc-gp`),
                axios.get(`${API_BASE_URL}/api/lc-expenses`),
                axios.get(`${API_BASE_URL}/api/ports`),
                axios.get(`${API_BASE_URL}/api/insurance-payments`)
            ]);
            setGpRecords(Array.isArray(gpRes.data) ? gpRes.data : []);
            setLcExpenses(Array.isArray(expenseRes.data) ? expenseRes.data : []);
            setInsurancePayments(Array.isArray(insPayRes.data) ? insPayRes.data : []);

            const freshLcRecords = Array.isArray(lcRes.data) ? lcRes.data : [];
            setLcRecords(freshLcRecords);
            // Sync the open modal's viewData to its fresh version so the LC Bill tab updates immediately
            setViewData(prev => {
                if (!prev) return prev;
                const fresh = freshLcRecords.find(r => r._id === prev._id);
                return fresh ? fresh : prev;
            });

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
            setBanksRaw(moduleBanks);
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
            setPiList(rawPis.map(pi => {
                const isRevised = pi.revisions && pi.revisions.length > 0;
                return isRevised ? `${pi.piNumber} (REVISED)` : pi.piNumber;
            }));

            setProductItems(Array.isArray(prodRes.data) ? prodRes.data.map(p => p.name) : []);
            setPorts(Array.isArray(portRes.data) ? portRes.data : []);
        } catch (error) {
            console.error('Error fetching LC initial data:', error);
            addNotification?.('Failed to load LC records', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLcProductChange = (idx, field, value) => {
        setFormData(prev => {
            const list = [...(prev.productsList || [])];
            list[idx] = calcLcProductLine({ ...list[idx], [field]: value });

            const newState = { ...prev, productsList: list };
            syncRootFromProductsList(newState);

            // Recalculate totalAmount and insurance for ANY product change
            const dRate = parseFloat(newState.dollarRate) || 0;
            // sumDollar is already updated by syncRootFromProductsList
            const tDollar = parseFloat(newState.totalDollar) || 0;
            const totalVal = tDollar * dRate;
            newState.totalAmount = totalVal > 0 ? totalVal.toFixed(2) : '';

            const exPct = parseFloat(newState.extraPercent) || 0;
            const prem = parseFloat(newState.premium) || 0;
            const premRet = parseFloat(newState.premiumReturn) || 0;
            const pVat = parseFloat(newState.premiumVat) || 0;
            const stamp = parseFloat(newState.stampCharge) || 0;
            const baseNetPrem = (totalVal * (prem / 100)) / 100;
            const netPrem = baseNetPrem + (baseNetPrem * (exPct / 100));
            newState.netPremium = netPrem > 0 ? netPrem.toFixed(2) : '';
            const expRet = netPrem * (premRet / 100);
            newState.expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';
            const vatAmount = netPrem * (pVat / 100);
            const gPrem = netPrem + vatAmount + stamp;
            newState.grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';

            syncBankBills(newState);
            return newState;
        });
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

            if (name === 'bankName') {
                if (!value) {
                    newState.bankBranch = '';
                    newState.bankLcCommission = '';
                    newState.bankVatOnCommission = '';
                    newState.bankSwiftCharge = '';
                    newState.bankVatOnSwiftCharge = '';
                    newState.bankLcApplicationForm = '';
                    newState.bankMpCharge = '';
                    newState.bankStampCharge = '';
                }
            }

            if (name === 'bankBranch') {
                if (!value) {
                    newState.bankLcCommission = '';
                    newState.bankVatOnCommission = '';
                    newState.bankSwiftCharge = '';
                    newState.bankVatOnSwiftCharge = '';
                    newState.bankLcApplicationForm = '';
                    newState.bankMpCharge = '';
                    newState.bankStampCharge = '';
                }
            }

            if (name === 'marginBill' || name === 'bankBill' || name === 'marginPaid') {
                const mb = parseFloat(name === 'marginBill' ? value : prev.marginBill) || 0;
                const bb = parseFloat(name === 'bankBill' ? value : prev.bankBill) || 0;
                const mp = parseFloat(name === 'marginPaid' ? value : prev.marginPaid) || 0;
                const total = (mb + bb) - mp;
                newState.totalBankBill = total > 0 ? total.toFixed(2) : '';
            } else if (['quantity', 'rate', 'totalDollar', 'dollarRate', 'totalAmount', 'bankMargin', 'bankLcCommission', 'bankVatOnCommission', 'bankSwiftCharge', 'bankVatOnSwiftCharge', 'bankLcApplicationForm', 'bankMpCharge', 'bankStampCharge'].includes(name)) {
                syncBankBills(newState);
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

                // Add persistent notification for LC Update
                if (addNotification) {
                    addNotification(
                        'LC Record Updated',
                        `LC No: ${formData.lcNo} has been updated by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }

                addNotification?.('LC record updated successfully', 'success');
            } else {
                await axios.post(`${API_BASE_URL}/api/lc-management`, formData);

                // Add persistent notification for management roles
                if (addNotification) {
                    addNotification(
                        'New LC Opened',
                        `A new LC (No: ${formData.lcNo}) has been opened for ${formData.importerName} by ${currentUser?.name || currentUser?.username}.`,
                        ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                    );
                }

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
        const loadedProducts = (record.productsList?.length > 0
            ? record.productsList
            : [{ productName: record.productName || '', hsCode: record.hsCode || '', quantity: record.quantity || '', rate: record.rate || '', freight: record.freight || '', totalFreight: record.totalFreight || '', totalDollar: record.totalDollar || '' }]
        ).map(calcLcProductLine);
        const parsedIpNumbers = record.ipNumbers?.length
            ? record.ipNumbers
            : (record.ipNo ? record.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);

        setFormData({
            ipNo: record.ipNo || parsedIpNumbers[0] || '',
            ipNumbers: parsedIpNumbers,
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
            piOpeningDate: record.piOpeningDate || '',
            latestShipmentDate: record.latestShipmentDate || '',
            marineCoverNote: record.marineCoverNote || '',
            marineCNDate: record.marineCNDate || '',
            port: record.port || '',
            productsList: loadedProducts,
            bankBranch: record.bankBranch || '',
            bankMargin: record.bankMargin || '',
            bankLcCommission: record.bankLcCommission || '',
            bankVatOnCommission: record.bankVatOnCommission || '',
            bankSwiftCharge: record.bankSwiftCharge || '',
            bankVatOnSwiftCharge: record.bankVatOnSwiftCharge || '',
            bankLcApplicationForm: record.bankLcApplicationForm || '',
            bankMpCharge: record.bankMpCharge || '',
            bankStampCharge: record.bankStampCharge || '',
            marginBill: record.marginBill || '',
            marginPaid: record.marginPaid || '',
            bankBill: record.bankBill || '',
            totalBankBill: record.totalBankBill || '',
            lcBillEnabled: record.lcBillEnabled !== undefined
                ? record.lcBillEnabled
                : !!(record.bankLcCommission || record.bankSwiftCharge || record.bankLcApplicationForm || record.bankMpCharge || record.bankStampCharge),
            amendments: record.amendments || [],
        });
        setEditingId(record._id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEditAmendment = (record, milestone) => {
        setSelectedAmendmentLcId(record._id);
        setEditingAmendmentNo(milestone.amendmentNo);
        setAmendmentSearchQuery(record.lcNo || '');
        const milQty = milestone.productsList && milestone.productsList.length > 0
            ? milestone.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
            : (milestone.quantity || '');
        setAmendmentFormData({
            amendmentNo: milestone.amendmentNo || '',
            amendmentDate: milestone.amendmentDate ? milestone.amendmentDate.split('T')[0] : '',
            expiryDate: milestone.expiryDate ? milestone.expiryDate.split('T')[0] : '',
            quantity: milQty || '',
            rate: (() => {
                const rVal = parseFloat(milestone.rate || 0);
                return rVal > 0 ? (rVal < 10 ? String(rVal * 1000) : String(milestone.rate)) : '';
            })(),
            dollarRate: milestone.dollarRate || '',
            remarks: milestone.remarks || '',
            addnNo: milestone.addnNo || '',
            addnDate: milestone.addnDate ? milestone.addnDate.split('T')[0] : '',
            port: milestone.port || record.port || '',
            extendedShipmentDate: milestone.extendedShipmentDate ? milestone.extendedShipmentDate.split('T')[0] : (milestone.latestShipmentDate ? milestone.latestShipmentDate.split('T')[0] : ''),
            piNo: milestone.piNo || '',
            amendmentMargin: milestone.amendmentMargin !== undefined ? milestone.amendmentMargin : undefined,
            amendmentCommission: milestone.amendmentCommission !== undefined ? milestone.amendmentCommission : undefined,
            amendmentVatOnCommission: milestone.amendmentVatOnCommission !== undefined ? milestone.amendmentVatOnCommission : undefined,
            amendmentSwiftCharge: milestone.amendmentSwiftCharge !== undefined ? milestone.amendmentSwiftCharge : undefined,
            amendmentVatOnSwift: milestone.amendmentVatOnSwift !== undefined ? milestone.amendmentVatOnSwift : undefined,
            amendmentMarginBill: milestone.amendmentMarginBill !== undefined ? milestone.amendmentMarginBill : '',
            amendmentMarginPaid: milestone.amendmentMarginPaid !== undefined
                ? milestone.amendmentMarginPaid
                : (() => {
                    const margin = milestone.amendmentMargin !== undefined ? (parseFloat(milestone.amendmentMargin) || 0) : (record.bankMargin !== undefined ? parseFloat(record.bankMargin) : 0);
                    const mb = parseFloat(milestone.amendmentMarginBill) || 0;
                    const mp = mb * (margin / 100);
                    return mp > 0 ? mp.toFixed(2) : '';
                })(),
            amendmentBankBill: milestone.amendmentBankBill !== undefined ? milestone.amendmentBankBill : '',
            totalAmendmentBankBill: milestone.totalAmendmentBankBill !== undefined ? milestone.totalAmendmentBankBill : (milestone.amendmentBill || ''),
            amendmentBill: milestone.totalAmendmentBankBill !== undefined ? milestone.totalAmendmentBankBill : (milestone.amendmentBill || ''),
            amendmentLcBillEnabled: milestone.amendmentLcBillEnabled !== undefined
                ? milestone.amendmentLcBillEnabled
                : !!(milestone.amendmentCommission || milestone.amendmentSwiftCharge)
        });
        setShowAmendmentForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id) => {
        setIdToDelete(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!idToDelete) return;
        setDeleteStatus('loading');
        try {
            await axios.delete(`${API_BASE_URL}/api/lc-management/${idToDelete}`);
            setDeleteStatus('success');
            fetchInitialData();
            setTimeout(() => {
                setShowDeleteConfirm(false);
                setDeleteStatus(null);
                setIdToDelete(null);
            }, 1500);
        } catch (error) {
            console.error('Error deleting LC record:', error);
            setDeleteStatus('error');
            setTimeout(() => setDeleteStatus(null), 3000);
        }
    };

    const selectedLcForAmendment = useMemo(() => {
        return lcRecords.find(lc => lc._id === selectedAmendmentLcId) || null;
    }, [selectedAmendmentLcId, lcRecords]);

    const amendmentInsuranceInfo = useMemo(() => {
        if (!selectedLcForAmendment) return null;

        const qty = parseFloat(amendmentFormData.quantity) || 0;
        const rate = parseFloat(amendmentFormData.rate) || 0;
        const dRate = parseFloat(amendmentFormData.dollarRate) || 0;
        const targetRateScaled = rate > 0 ? (rate < 10 ? rate * 1000 : rate) : 0;

        const currentAmendments = [...(selectedLcForAmendment.amendments || [])];
        const getMilestoneTotalQty = (mil) => {
            if (!mil) return 0;
            if (mil.productsList && mil.productsList.length > 0) {
                return mil.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
            }
            return parseFloat(mil.quantity || 0);
        };

        const prevMilestone = editingAmendmentNo
            ? (() => {
                const idx = currentAmendments.findIndex(a => a.amendmentNo === editingAmendmentNo);
                return idx > 0 ? currentAmendments[idx - 1] : selectedLcForAmendment;
            })()
            : (currentAmendments.length > 0 ? currentAmendments[currentAmendments.length - 1] : selectedLcForAmendment);

        const prevQty = getMilestoneTotalQty(prevMilestone);
        const prevRVal = parseFloat(prevMilestone.rate || 0);
        const prevRateScaled = prevRVal > 0 ? (prevRVal < 10 ? prevRVal * 1000 : prevRVal) : 0;
        const prevProducts = prevMilestone?.productsList?.length > 0
            ? prevMilestone.productsList
            : (selectedLcForAmendment.productsList?.length > 0 ? selectedLcForAmendment.productsList : []);
        const prevFVal = parseFloat(prevProducts[0]?.freight || selectedLcForAmendment.freight || 0);
        const prevFreightPerTon = prevFVal < 0.1 ? prevFVal * 1000 : prevFVal;

        const firstProduct = (selectedLcForAmendment.productsList || [])[0];
        const fVal = parseFloat(firstProduct?.freight || selectedLcForAmendment.freight || 0);
        const freightPerTon = fVal < 0.1 ? fVal * 1000 : fVal;

        const prevDollarValue = prevQty * (prevRateScaled + prevFreightPerTon);
        const newDollarValue = qty * (targetRateScaled + freightPerTon);
        const diffDollar = newDollarValue - prevDollarValue;
        const diffAmount = diffDollar * dRate;
        const baseAmount = Math.abs(diffAmount);

        let netPremium = '0';
        let expectedReturnAmount = '0';
        let grossPremium = '0';
        let vatAmount = 0;
        const premiumVat = parseFloat(selectedLcForAmendment.premiumVat) || 15;

        if (selectedLcForAmendment.insuranceCo && baseAmount > 0) {
            const prem = parseFloat(selectedLcForAmendment.premium) || 0;
            const exPct = parseFloat(selectedLcForAmendment.extraPercent) || 0;
            const premRet = parseFloat(selectedLcForAmendment.premiumReturn) || 0;
            const stamp = parseFloat(selectedLcForAmendment.stampCharge) || 0;

            const baseNetPrem = (baseAmount * (prem / 100)) / 100;
            const netP = baseNetPrem + (baseNetPrem * (exPct / 100));
            netPremium = netP > 0 ? netP.toFixed(2) : '0';

            const expRet = netP * (premRet / 100);
            expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '0';

            vatAmount = netP * (premiumVat / 100);
            const gPrem = netP + vatAmount + stamp;
            grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '0';
        } else {
            const netP = parseFloat(selectedLcForAmendment.netPremium) || 0;
            vatAmount = netP * (premiumVat / 100);
        }

        return {
            netPremium,
            expectedReturnAmount,
            grossPremium,
            vatAmount
        };
    }, [
        selectedLcForAmendment,
        amendmentFormData.quantity,
        amendmentFormData.rate,
        amendmentFormData.dollarRate,
        editingAmendmentNo
    ]);


    const selectedPiForAmendment = useMemo(() => {
        if (!amendmentFormData.piNo) return null;
        const cleanPi = amendmentFormData.piNo.replace(' (REVISED)', '');
        const basePi = piRecordsRaw.find(p => p.piNumber === cleanPi);
        if (!basePi) return null;

        const isRevised = amendmentFormData.piNo.endsWith(' (REVISED)');
        const hasRevisions = basePi.revisions && basePi.revisions.length > 0;
        if (hasRevisions && !isRevised) {
            const originalRev = basePi.revisions.find(r => r.reviseNo === 'Original PI');
            return originalRev ? { ...basePi, ...originalRev } : basePi;
        }
        return basePi;
    }, [amendmentFormData.piNo, piRecordsRaw]);

    const piBalanceTon = useMemo(() => {
        if (!amendmentFormData.piNo) return 0;
        const linkedPi = selectedPiForAmendment;
        if (!linkedPi) return 0;
        const piQtyTon = (parseFloat(linkedPi.grandTotalQuantity || linkedPi.quantity || 0) / 1000);

        // Sum of other LC quantities registered under this PI
        const currentLcId = selectedLcForAmendment?._id;
        const otherLcQtyTon = lcRecords
            .filter(lc => lc.piNo === amendmentFormData.piNo && lc._id !== currentLcId)
            .reduce((sum, lc) => sum + (parseFloat(lc.quantity) || 0), 0);

        return piQtyTon - otherLcQtyTon;
    }, [amendmentFormData.piNo, selectedLcForAmendment, selectedPiForAmendment, lcRecords]);

    const filteredLcRecordsForAmendment = useMemo(() => {
        const q = amendmentSearchQuery.toLowerCase().trim();
        if (!q) return lcRecords;
        return lcRecords.filter(lc => (lc.lcNo || '').toLowerCase().includes(q));
    }, [amendmentSearchQuery, lcRecords]);

    const handleAmendmentLcSelect = (lc) => {
        setSelectedAmendmentLcId(lc._id);
        const nextNo = (lc.amendments || []).length + 1;
        const nextNoStr = `AMENDMENT NO-${String(nextNo).padStart(2, '0')}`;

        const prefilledPiNo = (() => {
            const rawPi = lc.piNo || '';
            if (!rawPi || rawPi.endsWith(' (REVISED)')) return rawPi;
            const cleanPi = rawPi.replace(' (REVISED)', '');
            const piRecord = piRecordsRaw.find(p => p.piNumber === cleanPi);
            if (piRecord && piRecord.revisions && piRecord.revisions.length > 0) {
                return `${cleanPi} (REVISED)`;
            }
            return rawPi;
        })();

        let resolvedQty = lc.productsList && lc.productsList.length > 0
            ? lc.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
            : (parseFloat(lc.quantity) || 0);
        let resolvedRate = '';
        if (lc.rate) {
            const rVal = parseFloat(lc.rate);
            resolvedRate = rVal < 10 ? String(rVal * 1000) : String(lc.rate);
        }

        if (prefilledPiNo && prefilledPiNo !== lc.piNo) {
            const cleanPi = prefilledPiNo.replace(' (REVISED)', '');
            const piRecord = piRecordsRaw.find(p => p.piNumber === cleanPi);
            if (piRecord) {
                const isSelectedRevised = prefilledPiNo.endsWith(' (REVISED)');
                const hasRevisions = piRecord.revisions && piRecord.revisions.length > 0;
                let targetSource = piRecord;
                if (hasRevisions && !isSelectedRevised) {
                    const originalRev = piRecord.revisions.find(r => r.reviseNo === 'Original PI');
                    if (originalRev) targetSource = { ...piRecord, ...originalRev };
                }
                const firstProd = (targetSource.productsList || [])[0];
                const piQtyTons = targetSource.productsList && targetSource.productsList.length > 0
                    ? targetSource.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0) / 1000
                    : (parseFloat(targetSource.grandTotalQuantity || targetSource.quantity) || 0) / 1000;

                if (piQtyTons > 0) resolvedQty = piQtyTons;
                if (firstProd?.rate) {
                    const rVal = parseFloat(firstProd.rate);
                    resolvedRate = rVal < 10 ? String(rVal * 1000) : String(firstProd.rate);
                } else if (targetSource.rate) {
                    const rVal = parseFloat(targetSource.rate);
                    resolvedRate = rVal < 10 ? String(rVal * 1000) : String(targetSource.rate);
                }
            }
        }

        const initialFormState = {
            amendmentNo: nextNoStr,
            amendmentDate: new Date().toISOString().split('T')[0],
            expiryDate: lc.expiryDate ? lc.expiryDate.split('T')[0] : '',
            quantity: resolvedQty || '',
            rate: resolvedRate || '',
            dollarRate: lc.dollarRate || '',
            remarks: '',
            addnNo: '',
            addnDate: '',
            port: lc.port || '',
            extendedShipmentDate: lc.latestShipmentDate ? lc.latestShipmentDate.split('T')[0] : '',
            piNo: prefilledPiNo,
            amendmentMargin: undefined,
            amendmentCommission: undefined,
            amendmentVatOnCommission: undefined,
            amendmentSwiftCharge: undefined,
            amendmentVatOnSwift: undefined,
            amendmentMarginBill: '',
            amendmentBankBill: '',
            totalAmendmentBankBill: '',
            amendmentBill: '',
            amendmentLcBillEnabled: false
        };
        syncAmendmentBills(initialFormState, lc, banksRaw);
        setAmendmentFormData(initialFormState);
        setAmendmentSearchQuery(lc.lcNo || '');
        setActiveDropdown(null);
        setHighlightedIndex(-1);
    };

    const handleAmendmentInputChange = (e) => {
        const { name, value } = e.target;
        setAmendmentFormData(prev => {
            const nextState = { ...prev, [name]: value };
            if (name === 'amendmentMarginBill' || name === 'amendmentBankBill' || name === 'amendmentMarginPaid') {
                syncAmendmentBills(nextState, selectedLcForAmendment, banksRaw, editingAmendmentNo, true);
            } else if (name !== 'totalAmendmentBankBill') {
                syncAmendmentBills(nextState, selectedLcForAmendment, banksRaw, editingAmendmentNo, false);
            }
            return nextState;
        });
    };

    const handleAmendmentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedAmendmentLcId) {
            addNotification?.('Please select an LC Number first.', 'error');
            return;
        }
        if (!amendmentFormData.amendmentNo || !amendmentFormData.amendmentDate) {
            addNotification?.('Amendment Number and Date are required.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const lc = selectedLcForAmendment;
            if (!lc) throw new Error('Selected LC not found');

            // Calculate new financial totals
            const qty = parseFloat(amendmentFormData.quantity) || 0;
            const r = parseFloat(amendmentFormData.rate) || 0;
            const dRate = parseFloat(amendmentFormData.dollarRate) || 0;

            const targetRateScaled = r > 0 ? (r < 10 ? r * 1000 : r) : 0;
            const totalDollar = qty * targetRateScaled;
            const totalAmount = totalDollar * dRate;

            // Initialize overall LC insurance values (will be recalculated at the end)
            let netPremium = lc.netPremium;
            let expectedReturnAmount = lc.expectedReturnAmount;
            let grossPremium = lc.grossPremium;

            // Create amendment log entry
            // Let's build the updated products list for the LC record
            let updatedProductsList = [];
            if (selectedPiForAmendment) {
                // Map products from the selected PI
                updatedProductsList = mapPiProductsToLc(selectedPiForAmendment);
            } else if (lc.productsList && lc.productsList.length > 0) {
                // Copy existing products list
                updatedProductsList = lc.productsList.map(p => ({ ...p }));
            } else {
                // Synthesize from fields
                updatedProductsList = [{
                    productName: lc.productName || '',
                    hsCode: lc.hsCode || '',
                    quantity: amendmentFormData.quantity,
                    rate: amendmentFormData.rate,
                    freight: lc.freight || '',
                    totalFreight: '',
                    totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : ''
                }];
            }

            // Adjust product quantities and rates if they were manually overridden in the form
            const targetQty = parseFloat(amendmentFormData.quantity) || 0;
            const targetRate = parseFloat(amendmentFormData.rate) || 0;

            if (updatedProductsList.length > 0) {
                // Compute the sum of base quantities in Tons
                const baseQtySum = updatedProductsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);

                // If there's a difference between targetQty and baseQtySum, adjust the quantities
                if (Math.abs(targetQty - baseQtySum) > 0.001) {
                    if (updatedProductsList.length === 1) {
                        updatedProductsList[0].quantity = String(targetQty);
                    } else if (baseQtySum > 0) {
                        // Proportional scaling for multiple products
                        const ratio = targetQty / baseQtySum;
                        updatedProductsList.forEach(p => {
                            const currentQty = parseFloat(p.quantity) || 0;
                            p.quantity = String(currentQty * ratio);
                        });
                    } else {
                        // fallback: divide equally
                        const equalQty = targetQty / updatedProductsList.length;
                        updatedProductsList.forEach(p => {
                            p.quantity = String(equalQty);
                        });
                    }
                }

                // Adjust rates if the targetRate is provided and has changed
                if (targetRateScaled > 0) {
                    const originalFirstRate = parseFloat(updatedProductsList[0].rate) || 0;
                    if (Math.abs(targetRateScaled - originalFirstRate) > 0.001) {
                        updatedProductsList[0].rate = String(targetRateScaled);
                    }
                }

                // Recalculate freight, amount, and totalDollar for each product line
                updatedProductsList.forEach(p => {
                    const pQty = parseFloat(p.quantity) || 0;
                    const pRate = parseFloat(p.rate) || 0;
                    const pFreight = parseFloat(p.freight) || 0;

                    const pAmt = pQty * pRate;
                    const pTotalFreight = pQty * pFreight;
                    p.totalFreight = pTotalFreight > 0 ? pTotalFreight.toFixed(2) : '0.00';
                    p.totalDollar = (pAmt + pTotalFreight).toFixed(2);
                });
            }

            const firstProduct = updatedProductsList[0];
            const updatedProductName = firstProduct ? firstProduct.productName : (lc.productName || '');
            const updatedHsCode = firstProduct ? firstProduct.hsCode : (lc.hsCode || '');

            // Recalculate insurance based on the amendment value (difference) if there is an insurance company
            let amndNetPremium = '0';
            let amndExpectedReturnAmount = '0';
            let amndGrossPremium = '0';

            const getMilestoneTotalQty = (mil) => {
                if (!mil) return 0;
                if (mil.productsList && mil.productsList.length > 0) {
                    return mil.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
                }
                return parseFloat(mil.quantity || 0);
            };

            const currentAmendments = [...(lc.amendments || [])];
            const prevMilestone = editingAmendmentNo
                ? (() => {
                    const idx = currentAmendments.findIndex(a => a.amendmentNo === editingAmendmentNo);
                    return idx > 0 ? currentAmendments[idx - 1] : lc;
                })()
                : (currentAmendments.length > 0 ? currentAmendments[currentAmendments.length - 1] : lc);
            const prevQty = getMilestoneTotalQty(prevMilestone);

            const fVal = parseFloat(updatedProductsList[0]?.freight || lc.freight || 0);
            const freightPerTon = fVal < 0.1 ? fVal * 1000 : fVal;

            const prevRVal = parseFloat(prevMilestone.rate || 0);
            const prevRateScaled = prevRVal > 0 ? (prevRVal < 10 ? prevRVal * 1000 : prevRVal) : 0;
            const prevProducts = prevMilestone?.productsList?.length > 0
                ? prevMilestone.productsList
                : (lc.productsList?.length > 0 ? lc.productsList : []);
            const prevFVal = parseFloat(prevProducts[0]?.freight || lc.freight || 0);
            const prevFreightPerTon = prevFVal < 0.1 ? prevFVal * 1000 : prevFVal;

            const prevDollarValue = prevQty * (prevRateScaled + prevFreightPerTon);
            const newDollarValue = qty * (targetRateScaled + freightPerTon);
            const diffDollar = newDollarValue - prevDollarValue;
            const diffAmount = diffDollar * dRate;
            const baseAmount = Math.abs(diffAmount);

            if (editingAmendmentNo) {
                const existingAmnd = currentAmendments.find(a => a.amendmentNo === editingAmendmentNo);
                if (existingAmnd) {
                    amndNetPremium = existingAmnd.netPremium || '0';
                    amndExpectedReturnAmount = existingAmnd.expectedReturnAmount || '0';
                    amndGrossPremium = existingAmnd.grossPremium || '0';
                }
            }

            if (lc.insuranceCo && baseAmount > 0) {
                const prem = parseFloat(lc.premium) || 0;
                const exPct = parseFloat(lc.extraPercent) || 0;
                const premRet = parseFloat(lc.premiumReturn) || 0;
                const pVat = parseFloat(lc.premiumVat) || 15;
                const stamp = parseFloat(lc.stampCharge) || 0;

                const baseNetPrem = (baseAmount * (prem / 100)) / 100;
                const netP = baseNetPrem + (baseNetPrem * (exPct / 100));
                amndNetPremium = netP > 0 ? netP.toFixed(2) : '0';

                const expRet = netP * (premRet / 100);
                amndExpectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '0';

                const vatAmount = netP * (pVat / 100);
                const gPrem = netP + vatAmount + stamp;
                amndGrossPremium = gPrem > 0 ? gPrem.toFixed(2) : '0';
            }

            // Create or update amendment log entry
            const finalSavedRate = targetRateScaled > 0 ? String(targetRateScaled) : amendmentFormData.rate;

            if (editingAmendmentNo) {
                const idx = currentAmendments.findIndex(a => a.amendmentNo === editingAmendmentNo);
                if (idx !== -1) {
                    const existingAmnd = currentAmendments[idx];
                    const updatedAmendment = {
                        ...existingAmnd,
                        amendmentNo: amendmentFormData.amendmentNo,
                        amendmentDate: amendmentFormData.amendmentDate,
                        expiryDate: amendmentFormData.expiryDate,
                        quantity: amendmentFormData.quantity,
                        rate: finalSavedRate,
                        dollarRate: amendmentFormData.dollarRate,
                        totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
                        totalAmount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
                        netPremium: amndNetPremium,
                        expectedReturnAmount: amndExpectedReturnAmount,
                        grossPremium: amndGrossPremium,
                        addnNo: amendmentFormData.addnNo || '',
                        addnDate: amendmentFormData.addnDate || '',
                        port: amendmentFormData.port || '',
                        extendedShipmentDate: amendmentFormData.extendedShipmentDate || '',
                        remarks: amendmentFormData.remarks,
                        piNo: amendmentFormData.piNo,
                        productsList: updatedProductsList,
                        amendmentMargin: amendmentFormData.amendmentMargin || '',
                        amendmentCommission: amendmentFormData.amendmentCommission || '',
                        amendmentVatOnCommission: amendmentFormData.amendmentVatOnCommission || '',
                        amendmentSwiftCharge: amendmentFormData.amendmentSwiftCharge || '',
                        amendmentVatOnSwift: amendmentFormData.amendmentVatOnSwift || '',
                        amendmentMarginBill: amendmentFormData.amendmentMarginBill || '',
                        amendmentMarginPaid: amendmentFormData.amendmentMarginPaid || '',
                        amendmentBankBill: amendmentFormData.amendmentBankBill || '',
                        totalAmendmentBankBill: amendmentFormData.totalAmendmentBankBill || '',
                        amendmentBill: amendmentFormData.totalAmendmentBankBill || ''
                    };
                    currentAmendments[idx] = updatedAmendment;
                }
            } else {
                const newAmendment = {
                    amendmentNo: amendmentFormData.amendmentNo,
                    amendmentDate: amendmentFormData.amendmentDate,
                    expiryDate: amendmentFormData.expiryDate,
                    quantity: amendmentFormData.quantity,
                    rate: finalSavedRate,
                    dollarRate: amendmentFormData.dollarRate,
                    totalDollar: totalDollar > 0 ? totalDollar.toFixed(2) : '',
                    totalAmount: totalAmount > 0 ? totalAmount.toFixed(2) : '',
                    netPremium: amndNetPremium,
                    expectedReturnAmount: amndExpectedReturnAmount,
                    grossPremium: amndGrossPremium,
                    addnNo: amendmentFormData.addnNo || '',
                    addnDate: amendmentFormData.addnDate || '',
                    port: amendmentFormData.port || '',
                    extendedShipmentDate: amendmentFormData.extendedShipmentDate || '',
                    remarks: amendmentFormData.remarks,
                    piNo: amendmentFormData.piNo,
                    productsList: updatedProductsList,
                    amendmentMargin: amendmentFormData.amendmentMargin || '',
                    amendmentCommission: amendmentFormData.amendmentCommission || '',
                    amendmentVatOnCommission: amendmentFormData.amendmentVatOnCommission || '',
                    amendmentSwiftCharge: amendmentFormData.amendmentSwiftCharge || '',
                    amendmentVatOnSwift: amendmentFormData.amendmentVatOnSwift || '',
                    amendmentMarginBill: amendmentFormData.amendmentMarginBill || '',
                    amendmentMarginPaid: amendmentFormData.amendmentMarginPaid || '',
                    amendmentBankBill: amendmentFormData.amendmentBankBill || '',
                    totalAmendmentBankBill: amendmentFormData.totalAmendmentBankBill || '',
                    amendmentBill: amendmentFormData.totalAmendmentBankBill || '',
                    createdAt: new Date().toISOString()
                };

                if (currentAmendments.length === 0) {
                    const originalLcSnapshot = {
                        amendmentNo: 'Original LC',
                        amendmentDate: lc.openingDate,
                        expiryDate: lc.expiryDate,
                        quantity: lc.quantity,
                        rate: lc.rate,
                        dollarRate: lc.dollarRate,
                        totalDollar: lc.totalDollar,
                        totalAmount: lc.totalAmount,
                        netPremium: lc.netPremium,
                        expectedReturnAmount: lc.expectedReturnAmount,
                        grossPremium: lc.grossPremium,
                        piNo: lc.piNo || '',
                        latestShipmentDate: lc.latestShipmentDate || '',
                        remarks: 'Original LC Details',
                        productsList: lc.productsList || [],
                        createdAt: lc.createdAt || lc.openingDate || new Date().toISOString()
                    };
                    currentAmendments.push(originalLcSnapshot);
                }
                currentAmendments.push(newAmendment);
            }

            const latestState = currentAmendments.length > 0 ? currentAmendments[currentAmendments.length - 1] : lc;

            // Recalculate insurance based on the latest state's total amount
            netPremium = lc.netPremium;
            expectedReturnAmount = lc.expectedReturnAmount;
            grossPremium = lc.grossPremium;

            const latestTotalAmount = parseFloat(latestState.totalAmount) || 0;
            if (lc.insuranceCo && latestTotalAmount > 0) {
                const prem = parseFloat(lc.premium) || 0;
                const exPct = parseFloat(lc.extraPercent) || 0;
                const premRet = parseFloat(lc.premiumReturn) || 0;
                const pVat = parseFloat(lc.premiumVat) || 15;
                const stamp = parseFloat(lc.stampCharge) || 0;

                const baseNetPrem = (latestTotalAmount * (prem / 100)) / 100;
                const netP = baseNetPrem + (baseNetPrem * (exPct / 100));
                netPremium = netP > 0 ? netP.toFixed(2) : '';

                const expRet = netP * (premRet / 100);
                expectedReturnAmount = expRet > 0 ? expRet.toFixed(2) : '';

                const vatAmount = netP * (pVat / 100);
                const gPrem = netP + vatAmount + stamp;
                grossPremium = gPrem > 0 ? gPrem.toFixed(2) : '';
            }

            // Find updated IP numbers from the selected PI for amendment, or fall back to the LC's current IP numbers
            const updatedIpNumbers = selectedPiForAmendment
                ? getPiIpNumbers(selectedPiForAmendment)
                : (lc.ipNumbers || []);

            // Update main LC record fields to match the latest state
            const updatedLcData = {
                ...lc,
                expiryDate: latestState.expiryDate,
                quantity: latestState.quantity,
                rate: latestState.rate,
                dollarRate: latestState.dollarRate,
                totalDollar: latestState.totalDollar,
                totalAmount: latestState.totalAmount,
                netPremium,
                expectedReturnAmount,
                grossPremium,
                piNo: latestState.piNo,
                port: latestState.port || lc.port || '',
                latestShipmentDate: latestState.extendedShipmentDate || latestState.latestShipmentDate || lc.latestShipmentDate || '',
                productName: latestState.productsList?.[0]?.productName || lc.productName || '',
                hsCode: latestState.productsList?.[0]?.hsCode || lc.hsCode || '',
                productsList: latestState.productsList || [],
                ipNumbers: updatedIpNumbers,
                ipNo: updatedIpNumbers[0] || '',
                lcAmendment: latestState.amendmentNo === 'Original LC'
                    ? ''
                    : `${latestState.amendmentNo} DATE: ${formatDate(latestState.amendmentDate)}`,
                amendments: currentAmendments
            };

            // Save via PUT
            await axios.put(`${API_BASE_URL}/api/lc-management/${selectedAmendmentLcId}`, updatedLcData);

            if (addNotification) {
                addNotification(
                    editingAmendmentNo ? 'LC Amendment Updated' : 'LC Amendment Saved',
                    `LC No: ${lc.lcNo} amendment (${amendmentFormData.amendmentNo}) has been saved by ${currentUser?.name || currentUser?.username}.`,
                    ['Admin', 'Incharge', 'Border Manager', 'LC Manager', 'Data Entry']
                );
            }
            addNotification?.('LC Amendment saved successfully', 'success');

            // Reset state
            setShowAmendmentForm(false);
            setSelectedAmendmentLcId('');
            setAmendmentSearchQuery('');
            setEditingAmendmentNo('');
            setAmendmentFormData({
                amendmentNo: '',
                amendmentDate: '',
                expiryDate: '',
                quantity: '',
                rate: '',
                dollarRate: '',
                remarks: '',
                addnNo: '',
                addnDate: '',
                port: '',
                extendedShipmentDate: '',
                piNo: '',
                amendmentMargin: '',
                amendmentCommission: '',
                amendmentVatOnCommission: '',
                amendmentSwiftCharge: '',
                amendmentVatOnSwift: '',
                amendmentMarginBill: '',
                amendmentMarginPaid: '',
                amendmentBankBill: '',
                totalAmendmentBankBill: '',
                amendmentBill: '',
                amendmentLcBillEnabled: false
            });
            fetchInitialData();
        } catch (error) {
            console.error('Error saving LC amendment:', error);
            addNotification?.('Failed to save LC amendment', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setFormData({
            ipNo: '',
            ipNumbers: [],
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
            piOpeningDate: '',
            latestShipmentDate: '',
            marineCoverNote: '',
            marineCNDate: '',
            port: '',
            productsList: [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }],
            bankBranch: '',
            bankMargin: '',
            bankLcCommission: '',
            bankVatOnCommission: '',
            bankSwiftCharge: '',
            bankVatOnSwiftCharge: '',
            bankLcApplicationForm: '',
            bankMpCharge: '',
            bankStampCharge: '',
            marginBill: '',
            marginPaid: '',
            bankBill: '',
            totalBankBill: '',
            lcBillEnabled: false,
            amendments: [],
        });
        setEditingId(null);
        setShowForm(false);
    };

    const getAdjustedLcValues = (record) => {
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
                return sum + (parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal);
            }, 0);

        const totalReceivedQtyKg = receivedQtyKg + borderSaleQtyKg;
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
        
        const adjustedTotalAmount = isEnabled && openingQtyKg > 0
            ? openingValue + (actualAdjustmentQtyKg * (openingValue / openingQtyKg))
            : openingValue;

        const combinedRemKg = adjustedQtyKg - totalReceivedQtyKg;

        return {
            openingQtyKg,
            openingValue,
            receivedQtyKg,
            borderSaleQtyKg,
            totalReceivedQtyKg,
            rawBalanceKg,
            adjustmentQtyKg,
            actualAdjustmentQtyKg,
            adjustedQtyKg,
            adjustedQtyTons,
            adjustedTotalAmount,
            combinedRemKg,
            isEnabled
        };
    };

    const handleToggleValueQtyAdjustment = async (record, isEnabled) => {
        try {
            const adj = getAdjustedLcValues({ ...record, enableValueQtyAdjustment: isEnabled });
            const updatedRecord = {
                ...record,
                enableValueQtyAdjustment: isEnabled,
                adjustedQuantity: adj.adjustedQtyTons,
                adjustedTotalAmount: adj.adjustedTotalAmount
            };
            
            const tempState = {
                ...updatedRecord,
                totalAmount: adj.adjustedTotalAmount
            };
            const bills = calculateBankBills(tempState);
            updatedRecord.marginBill = bills.marginBill;
            updatedRecord.marginPaid = bills.marginPaid;
            updatedRecord.bankBill = bills.bankBill;
            updatedRecord.totalBankBill = bills.totalBankBill;
            
            const response = await axios.put(`${API_BASE_URL}/api/lc-management/${record._id}`, updatedRecord);
            if (response.data) {
                addNotification?.('LC Adjustment updated successfully', 'success');
                await fetchInitialData();
            }
        } catch (error) {
            console.error("Failed to toggle adjustment:", error);
            addNotification?.('Failed to update adjustment setting.', 'error');
        }
    };

    const filteredRecords = lcRecords.filter(record => {
        const query = searchQuery.toLowerCase();
        const matchesProduct = (record.productName || '').toLowerCase().includes(query) ||
            (record.productsList && record.productsList.some(p => (p.productName || '').toLowerCase().includes(query)));
        const matchesSearch = (record.ipNo || '').toLowerCase().includes(query) ||
            (record.lcNo || '').toLowerCase().includes(query) ||
            (record.importerName || '').toLowerCase().includes(query) ||
            (record.bankName || '').toLowerCase().includes(query) ||
            matchesProduct;

        if (!matchesSearch) return false;

        // Advanced filter checks
        if (lcFilters.startDate && record.openingDate < lcFilters.startDate) return false;
        if (lcFilters.endDate && record.openingDate > lcFilters.endDate) return false;
        if (lcFilters.port && (record.port || '').trim().toLowerCase() !== lcFilters.port.toLowerCase()) return false;
        if (lcFilters.exporterName && (record.exporterName || '').trim().toLowerCase() !== lcFilters.exporterName.toLowerCase()) return false;
        if (lcFilters.importerName && (record.importerName || '').trim().toLowerCase() !== lcFilters.importerName.toLowerCase()) return false;
        if (lcFilters.productName) {
            const matchesFilterProduct = (record.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase() ||
                (record.productsList && record.productsList.some(p => (p.productName || '').trim().toLowerCase() === lcFilters.productName.toLowerCase()));
            if (!matchesFilterProduct) return false;
        }

        return true;
    });

    const amendmentDisplayProducts = selectedPiForAmendment
        ? mapPiProductsToLc(selectedPiForAmendment)
        : (selectedLcForAmendment?.productsList && selectedLcForAmendment.productsList.length > 0
            ? selectedLcForAmendment.productsList.map(calcLcProductLine)
            : (selectedLcForAmendment ? [{ productName: selectedLcForAmendment.productName || selectedLcForAmendment.product || '', quantity: selectedLcForAmendment.quantity || '', rate: selectedLcForAmendment.rate || '' }] : []));

    const amendmentDisplayPort = selectedPiForAmendment
        ? (selectedPiForAmendment.port || selectedPiForAmendment.portOfDischarge || selectedPiForAmendment.portOfLoading || '-')
        : (selectedLcForAmendment?.port || '-');

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Standard Module Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {!showForm && !showAmendmentForm ? (
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

                {!showForm && !showAmendmentForm && (
                    <div className="w-full md:w-auto flex flex-row justify-end gap-3 z-50">
                        {/* Filter Button & Panel */}
                        <div className="relative">
                            <button
                                ref={lcFilterButtonRef}
                                onClick={() => setShowLcFilterPanel(!showLcFilterPanel)}
                                className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border h-[40px] ${showLcFilterPanel || Object.values(lcFilters).some(v => v !== '') ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FunnelIcon className={`w-4 h-4 ${(showLcFilterPanel || (lcFilters && Object.values(lcFilters).some(v => v !== ''))) ? 'text-white' : 'text-gray-400'}`} />
                                <span className="text-sm font-medium">Filter</span>
                            </button>

                            {/* Floating Filter Panel */}
                            {showLcFilterPanel && lcFilters && (
                                <div ref={lcFilterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:inset-auto md:right-0 md:mt-3 w-auto md:w-[450px] bg-white/95 backdrop-blur-2xl border border-gray-100 rounded-2xl shadow-2xl z-[60] p-4 md:p-6 animate-in fade-in zoom-in duration-200 text-left">
                                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-50">
                                        <h4 className="font-extrabold text-gray-900 text-lg">Advance Filter</h4>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLcFilters(initialLcFilterState);
                                                setFilterSearchInputs({
                                                    portSearch: '',
                                                    exporterSearch: '',
                                                    importerSearch: '',
                                                    productSearch: ''
                                                });
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
                                                        placeholder={lcFilters.port || "Search Port..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${lcFilters.port ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.port && (
                                                            <button type="button" onClick={() => { setLcFilters({ ...lcFilters, port: '' }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.port && (() => {
                                                    const filtered = getFilteredOptions('lcFilterPort') || [];
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, port: opt }); setFilterSearchInputs({ ...filterSearchInputs, portSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
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
                                                        placeholder={lcFilters.productName || "Search Product..."}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${lcFilters.productName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {lcFilters.productName && (
                                                            <button type="button" onClick={() => { setLcFilters({ ...lcFilters, productName: '' }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.product && (() => {
                                                    const filtered = getFilteredOptions('lcFilterProduct') || [];
                                                    return filtered.length > 0 ? (
                                                        <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                            {filtered.map(opt => (
                                                                <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, productName: opt }); setFilterSearchInputs({ ...filterSearchInputs, productSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
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
                                                    placeholder={lcFilters.importerName || "Search Importer..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${lcFilters.importerName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {lcFilters.importerName && (
                                                        <button type="button" onClick={() => { setLcFilters({ ...lcFilters, importerName: '' }); setFilterSearchInputs({ ...filterSearchInputs, importerSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.importer && (() => {
                                                const filtered = getFilteredOptions('lcFilterImporter') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, importerName: opt }); setFilterSearchInputs({ ...filterSearchInputs, importerSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
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
                                                    placeholder={lcFilters.exporterName || "Search Exporter..."}
                                                    className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${lcFilters.exporterName ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                />
                                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {lcFilters.exporterName && (
                                                        <button type="button" onClick={() => { setLcFilters({ ...lcFilters, exporterName: '' }); setFilterSearchInputs({ ...filterSearchInputs, exporterSearch: '' }); }} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {filterDropdownOpen.exporter && (() => {
                                                const filtered = getFilteredOptions('lcFilterExporter') || [];
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-[120] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {filtered.map(opt => (
                                                            <button key={opt} type="button" onClick={() => { setLcFilters({ ...lcFilters, exporterName: opt }); setFilterSearchInputs({ ...filterSearchInputs, exporterSearch: '' }); setFilterDropdownOpen(initialFilterDropdownState); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors uppercase font-medium">{opt}</button>
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
                            <>
                                <button
                                    onClick={() => setShowAmendmentForm(true)}
                                    className="w-1/2 md:w-auto px-4 py-2 border border-blue-200 bg-blue-50/10 hover:bg-blue-50/50 text-blue-600 font-bold rounded-xl transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap text-sm h-[40px]"
                                >
                                    <FileTextIcon className="w-4 h-4 mr-1.5 text-blue-500" />
                                    <span>Amendment</span>
                                </button>
                                <button
                                    onClick={() => setShowForm(true)}
                                    className="w-1/2 md:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 md:hover:scale-105 flex items-center justify-center whitespace-nowrap text-sm h-[40px]"
                                >
                                    <PlusIcon className="w-4 h-4 mr-1.5" />
                                    <span>New LC</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {showForm && (
                <div className="lc-form-container relative bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 pb-10">

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
                        autoComplete="off"
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10"
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
                                            date.setDate(date.getDate() + 90);
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

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="Latest Shipment Date"
                                value={formData.latestShipmentDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, latestShipmentDate: e.target.value }))}
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
                                autoComplete="off"
                                placeholder="Enter LC Number"
                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                            />
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
                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'piNo', 'piNo', getExpandedDropdownOptions(formData.piNo))}
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
                                    {getExpandedDropdownOptions(formData.piNo).map((pi, idx) => (
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

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-gray-600 ml-1">PI Quantity (Ton)</label>
                            <input
                                type="text"
                                readOnly
                                value={formData.piNo ? informativeQuantities.piQtyTon.toLocaleString('en-IN', { minimumFractionDigits: 3 }) : ''}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <CustomDatePicker
                                label="PI Date"
                                value={formData.piOpeningDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, piOpeningDate: e.target.value }))}
                                compact={true}
                                readOnly={true}
                            />
                        </div>

                        <div className="space-y-1.5 text-left relative" ref={portRef}>
                            <label className="text-sm font-semibold text-gray-600 ml-1">Port</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="port"
                                    value={formData.port}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, port: e.target.value }));
                                        setActiveDropdown('port');
                                        setHighlightedIndex(-1);
                                    }}
                                    onFocus={() => {
                                        setActiveDropdown('port');
                                        setHighlightedIndex(-1);
                                    }}
                                    placeholder="Select Port Name"
                                    autoComplete="off"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {formData.port && (
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, port: '' }))} className="text-gray-400 hover:text-gray-600">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                </div>
                            </div>
                            {activeDropdown === 'port' && (
                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                    {ports
                                        .filter(p => !p.isLoadingPort && (!formData.port || p.name.toLowerCase().includes(formData.port.toLowerCase())))
                                        .map((p, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleDropdownSelect('port', p.name);
                                                }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                                className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.port === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                            >
                                                {p.name}
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {informativeQuantities.ipEntries.map((entry, idx) => (
                            <React.Fragment key={entry.ipNo || idx}>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">
                                        IP Number{informativeQuantities.ipEntries.length > 1 ? ` (${idx + 1})` : ''}
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={entry.ipNo}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-700 font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold text-gray-600 ml-1">
                                        Remaining IP Qty (Ton){informativeQuantities.ipEntries.length > 1 ? ` (${idx + 1})` : ''}
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={entry.remIpQtyTon.toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold"
                                    />
                                </div>
                            </React.Fragment>
                        ))}

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

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Margin Bill</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                <input
                                    type="number"
                                    name="marginBill"
                                    value={formData.marginBill}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Margin Paid</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                <input
                                    type="number"
                                    name="marginPaid"
                                    value={formData.marginPaid}
                                    onChange={handleInputChange}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>
                        </div>

                        {formData.lcBillEnabled !== false && (
                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Bank Bill</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                    <input
                                        type="number"
                                        name="bankBill"
                                        value={formData.bankBill}
                                        onChange={handleInputChange}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5 text-left">
                            <label className="text-sm font-semibold text-gray-600 ml-1">Total Bank Bill</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">৳</span>
                                <input
                                    type="number"
                                    name="totalBankBill"
                                    readOnly
                                    value={formData.totalBankBill}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 pl-8 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-500 font-bold"
                                />
                            </div>
                        </div>

                        <div className="col-span-full mb-2 mt-4">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Product Details</h3>
                            </div>
                        </div>

                        {(formData.productsList || [{ productName: '', hsCode: '', quantity: '', rate: '', freight: '', totalFreight: '', totalDollar: '' }]).map((item, prodIdx) => (
                            <div key={prodIdx} className="col-span-full space-y-3">
                                {(formData.productsList?.length || 0) > 1 && (
                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider ml-1">Product #{prodIdx + 1}</p>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6">
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">H.S Code</label>
                                        <input
                                            type="text"
                                            value={item.hsCode}
                                            onChange={(e) => handleLcProductChange(prodIdx, 'hsCode', e.target.value)}
                                            placeholder="Enter H.S Code"
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5 text-left relative" ref={prodIdx === 0 ? productRef : null}>
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Product</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={item.productName}
                                                onChange={(e) => handleLcProductChange(prodIdx, 'productName', e.target.value)}
                                                onFocus={() => { setActiveDropdown(`productName_${prodIdx}`); setHighlightedIndex(-1); }}
                                                onKeyDown={(e) => {
                                                    const options = productItems.filter(p => !item.productName || p.toLowerCase().includes(item.productName.toLowerCase()));
                                                    if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < options.length) {
                                                        e.preventDefault();
                                                        handleLcProductChange(prodIdx, 'productName', options[highlightedIndex]);
                                                        setActiveDropdown(null);
                                                        setHighlightedIndex(-1);
                                                        return;
                                                    }
                                                    handleDropdownKeyDown(e, `productName_${prodIdx}`, 'productName', options);
                                                }}
                                                placeholder="Select Product"
                                                autoComplete="off"
                                                className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                {item.productName && (
                                                    <button type="button" onClick={() => handleLcProductChange(prodIdx, 'productName', '')} className="text-gray-400 hover:text-gray-600">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                            </div>
                                        </div>
                                        {activeDropdown === `productName_${prodIdx}` && (
                                            <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                {productItems.filter(p => !item.productName || p.toLowerCase().includes(item.productName.toLowerCase())).map((p, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onMouseDown={(e) => { e.preventDefault(); handleLcProductChange(prodIdx, 'productName', p); }}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${item.productName === p ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Quantity (Ton)</label>
                                        <input
                                            type="number"
                                            value={item.quantity}
                                            onChange={(e) => handleLcProductChange(prodIdx, 'quantity', e.target.value)}
                                            placeholder="0"
                                            className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                        />
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Rate (Per Ton)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="number"
                                                value={item.rate}
                                                onChange={(e) => handleLcProductChange(prodIdx, 'rate', e.target.value)}
                                                step="0.001"
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Freight (Per Ton)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="number"
                                                value={item.freight}
                                                onChange={(e) => handleLcProductChange(prodIdx, 'freight', e.target.value)}
                                                step="0.001"
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Total Freight</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={item.totalFreight}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-600 font-medium cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Total Dollar</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                            <input
                                                type="text"
                                                readOnly
                                                value={item.totalDollar}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pl-8 bg-gray-50 border border-gray-200/60 rounded-xl outline-none text-gray-700 font-bold cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="col-span-full mb-2 mt-4 flex items-center justify-between bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                            <div>
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Bank Details</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">LC Bill</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => {
                                            const nextVal = !prev.lcBillEnabled;
                                            const newState = {
                                                ...prev,
                                                lcBillEnabled: nextVal,
                                            };
                                            if (!nextVal) {
                                                newState.bankLcCommission = '';
                                                newState.bankVatOnCommission = '';
                                                newState.bankSwiftCharge = '';
                                                newState.bankVatOnSwiftCharge = '';
                                                newState.bankLcApplicationForm = '';
                                                newState.bankMpCharge = '';
                                                newState.bankStampCharge = '';
                                            } else {
                                                const selectedBank = banksRaw.find(b => (b.bankName || '').trim().toUpperCase() === (prev.bankName || '').trim().toUpperCase());
                                                const selectedBranch = selectedBank?.branches?.find(br => br.branch === prev.bankBranch);
                                                if (selectedBranch) {
                                                    newState.bankLcCommission = selectedBranch.lcCommission || '';
                                                    newState.bankVatOnCommission = selectedBranch.vatOnCommission || '';
                                                    newState.bankSwiftCharge = selectedBranch.swiftCharge || '';
                                                    newState.bankVatOnSwiftCharge = selectedBranch.vatOnSwiftCharge || '';
                                                    newState.bankLcApplicationForm = selectedBranch.lcApplicationForm || '';
                                                    newState.bankMpCharge = selectedBranch.mpCharge || '';
                                                    newState.bankStampCharge = selectedBranch.stampCharge || '';
                                                }
                                            }
                                            return syncBankBills(newState);
                                        });
                                    }}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.lcBillEnabled !== false ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${formData.lcBillEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>
                        </div>

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                            {/* Issuing Bank Dropdown Input */}
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

                            {/* Branch Dropdown Input */}
                            <div className="space-y-1.5 text-left relative" ref={branchRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1">Branch</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="bankBranch"
                                        value={formData.bankBranch}
                                        onChange={handleInputChange}
                                        onFocus={() => { setActiveDropdown('bankBranch'); setHighlightedIndex(-1); }}
                                        onKeyDown={(e) => {
                                            const selectedBank = banksRaw.find(b => (b.bankName || '').trim().toUpperCase() === (formData.bankName || '').trim().toUpperCase());
                                            const branchesList = selectedBank?.branches || [];
                                            const options = branchesList.filter(br => !formData.bankBranch || br.branch.toLowerCase().includes(formData.bankBranch.toLowerCase())).map(br => br.branch);
                                            handleDropdownKeyDown(e, 'bankBranch', 'bankBranch', options);
                                        }}
                                        placeholder="Select Branch"
                                        autoComplete="off"
                                        className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {formData.bankBranch && (
                                            <button type="button" onClick={() => handleDropdownSelect('bankBranch', '')} className="text-gray-400 hover:text-gray-600">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                                {activeDropdown === 'bankBranch' && (() => {
                                    const selectedBank = banksRaw.find(b => (b.bankName || '').trim().toUpperCase() === (formData.bankName || '').trim().toUpperCase());
                                    const branchesList = selectedBank?.branches || [];
                                    const filteredBranches = branchesList.filter(br => !formData.bankBranch || br.branch.toLowerCase().includes(formData.bankBranch.toLowerCase()));
                                    return (
                                        <div className="absolute z-[60] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                            {filteredBranches.map((br, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('bankBranch', br.branch); }}
                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${formData.bankBranch === br.branch ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                >
                                                    {br.branch}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Margin (%) */}
                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Margin</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="bankMargin"
                                        value={formData.bankMargin}
                                        onChange={handleInputChange}
                                        placeholder="0"
                                        className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                </div>
                            </div>

                            {formData.lcBillEnabled !== false && (
                                <>
                                    {/* LC Commission (%) */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">LC Commission</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                name="bankLcCommission"
                                                value={formData.bankLcCommission}
                                                onChange={handleInputChange}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                        </div>
                                    </div>

                                    {/* VAT on Commission (%) */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">VAT on Commission</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                name="bankVatOnCommission"
                                                value={formData.bankVatOnCommission}
                                                onChange={handleInputChange}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                        </div>
                                    </div>

                                    {/* Swift Charge */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Swift Charge</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                            <input
                                                type="number"
                                                name="bankSwiftCharge"
                                                value={formData.bankSwiftCharge}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    {/* VAT on Swift Charge (%) */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">VAT on Swift Charge</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                name="bankVatOnSwiftCharge"
                                                value={formData.bankVatOnSwiftCharge}
                                                onChange={handleInputChange}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2.5 pr-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">%</span>
                                        </div>
                                    </div>

                                    {/* LC Application Form */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">LC Application Form</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                            <input
                                                type="number"
                                                name="bankLcApplicationForm"
                                                value={formData.bankLcApplicationForm}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    {/* MP Charge */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">MP Charge</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                            <input
                                                type="number"
                                                name="bankMpCharge"
                                                value={formData.bankMpCharge}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    {/* Stamp Charge */}
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-sm font-semibold text-gray-600 ml-1">Stamp Charge</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">৳</span>
                                            <input
                                                type="number"
                                                name="bankStampCharge"
                                                value={formData.bankStampCharge}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                className="w-full px-4 py-2.5 pl-8 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="col-span-full mb-2 mt-4">
                            <div className="bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                <h3 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Insurance Details</h3>
                            </div>
                        </div>

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-[2.2fr_0.9fr_1.2fr_1fr_1.2fr_2.2fr_1fr_1.2fr_1.2fr] gap-x-3 gap-y-4 items-end">
                            <div className="space-y-1.5 text-left relative md:col-span-2 lg:col-span-1" ref={insuranceRef}>
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Insurance Company</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Premium Return</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Extra Percent</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Net Premium</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Premium VAT</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Stamp Charge</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Gross Premium</label>
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
                                <label className="text-sm font-semibold text-gray-600 ml-1 whitespace-nowrap">Return Amount</label>
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

                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4 relative z-10 items-end">
                            <div className="space-y-1.5 text-left">
                                <label className="text-sm font-semibold text-gray-600 ml-1">Marine Cover Note</label>
                                <input
                                    type="text"
                                    name="marineCoverNote"
                                    value={formData.marineCoverNote}
                                    onChange={handleInputChange}
                                    placeholder="Enter Cover Note No"
                                    className="w-full px-4 py-2.5 bg-white/50 border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <CustomDatePicker
                                    label="Marine C.N Date"
                                    value={formData.marineCNDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, marineCNDate: e.target.value }))}
                                    compact={true}
                                    dropUp={true}
                                />
                            </div>

                            <div className="lg:col-span-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full md:w-auto px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
                                >
                                    {isSaving ? 'Saving...' : editingId ? 'Update LC Record' : 'Save '}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {showAmendmentForm && (
                <div className="lc-form-container relative bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl p-5 md:p-8 pb-10">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8 relative z-30 border-b border-gray-200/40 pb-4">
                        {/* Title */}
                        <div className="flex items-center gap-2 shrink-0">
                            <FileTextIcon className="w-5 h-5 text-blue-500" />
                            <span className="text-base font-bold text-gray-800">LC Amendment Registration</span>
                        </div>

                        {/* Search Dropdown in same line */}
                        <div className="flex-1 max-w-md w-full relative dropdown-container" ref={amendmentLcRef}>
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Search or select LC number..."
                                    value={amendmentSearchQuery}
                                    onChange={(e) => {
                                        setAmendmentSearchQuery(e.target.value);
                                        setActiveDropdown('amendmentLc');
                                        setHighlightedIndex(-1);
                                    }}
                                    onFocus={() => {
                                        setActiveDropdown('amendmentLc');
                                        setHighlightedIndex(-1);
                                    }}
                                    className="w-full px-4 py-2 bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-center text-sm shadow-sm h-[38px]"
                                    required
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                            {activeDropdown === 'amendmentLc' && filteredLcRecordsForAmendment.length > 0 && (
                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                    {filteredLcRecordsForAmendment.map((lc, idx) => (
                                        <button
                                            key={lc._id}
                                            type="button"
                                            onClick={() => handleAmendmentLcSelect(lc)}
                                            className="w-full px-4 py-2 text-center text-sm flex justify-between items-center hover:bg-blue-50 text-gray-700 font-semibold"
                                        >
                                            <span className="flex-1 text-center">{lc.lcNo}</span>
                                            <span className="text-xs text-gray-400 font-normal pr-4">Date: {lc.openingDate ? formatDate(lc.openingDate) : '-'}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Close button */}
                        <button
                            onClick={() => {
                                setShowAmendmentForm(false);
                                setSelectedAmendmentLcId('');
                                setAmendmentSearchQuery('');
                                setEditingAmendmentNo('');
                                setAmendmentFormData({
                                    amendmentNo: '',
                                    amendmentDate: '',
                                    expiryDate: '',
                                    quantity: '',
                                    rate: '',
                                    dollarRate: '',
                                    remarks: '',
                                    addnNo: '',
                                    addnDate: '',
                                    port: '',
                                    extendedShipmentDate: '',
                                    piNo: '',
                                    amendmentMargin: '',
                                    amendmentCommission: '',
                                    amendmentVatOnCommission: '',
                                    amendmentSwiftCharge: '',
                                    amendmentVatOnSwift: '',
                                    amendmentMarginBill: '',
                                    amendmentMarginPaid: '',
                                    amendmentBankBill: '',
                                    totalAmendmentBankBill: '',
                                    amendmentBill: '',
                                    amendmentLcBillEnabled: false
                                });
                            }}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-all group active:scale-95 shrink-0"
                            title="Close Form"
                        >
                            <XIcon className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
                        </button>
                    </div>

                    <form onSubmit={handleAmendmentSubmit} className="space-y-8 relative z-10 w-full">
                        {selectedAmendmentLcId && selectedLcForAmendment && (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full text-left">
                                {/* Left Side: Original Details View (Read-Only) */}
                                <div className="lg:col-span-1 space-y-6 bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
                                    <div>
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Current LC Details</h4>
                                        <div className="space-y-4">
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PI Number</span>
                                                <p className="text-sm font-bold text-blue-600 truncate" title={selectedLcForAmendment.piNo}>
                                                    {(() => {
                                                        const rawPiNo = selectedLcForAmendment.piNo || '';
                                                        if (!rawPiNo) return 'N/A';
                                                        if (rawPiNo.endsWith(' (REVISED)')) return rawPiNo;
                                                        const cleanPi = rawPiNo.replace(' (REVISED)', '');
                                                        const piRecord = piRecordsRaw.find(p => p.piNumber === cleanPi);
                                                        if (piRecord && piRecord.revisions && piRecord.revisions.length > 0) {
                                                            return `${cleanPi} (REVISED)`;
                                                        }
                                                        return rawPiNo;
                                                    })()}
                                                </p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Number</span>
                                                <div className="flex flex-col gap-0.5">
                                                    {(() => {
                                                        const ips = selectedLcForAmendment.ipNumbers?.length
                                                            ? selectedLcForAmendment.ipNumbers
                                                            : (selectedLcForAmendment.ipNo ? selectedLcForAmendment.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);
                                                        if (ips.length === 0) return <span className="text-sm font-bold text-gray-800">N/A</span>;
                                                        return ips.map((ip, idx) => (
                                                            <span key={idx} className="block text-sm font-bold text-gray-800">
                                                                {ip}
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedLcForAmendment.importerName}</p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                                <p className="text-sm font-bold text-gray-800 truncate">{selectedLcForAmendment.exporterName}</p>
                                            </div>
                                            <div className="border-b border-gray-200/50 pb-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank Name</span>
                                                <p className="text-sm font-bold text-gray-800 truncate" title={selectedLcForAmendment.bankName}>{selectedLcForAmendment.bankName}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Date</span>
                                                    <p className="text-sm font-bold text-gray-800 font-mono">{formatDate(selectedLcForAmendment.openingDate)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Expiry Date</span>
                                                    <p className="text-sm font-bold text-rose-500 font-mono">{formatDate(selectedLcForAmendment.expiryDate)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Latest Shipment Date</span>
                                                    <p className="text-sm font-bold text-gray-800 font-mono">{formatDate(selectedLcForAmendment.latestShipmentDate) || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Quantity</span>
                                                    <p className="text-sm font-bold text-gray-800">{parseFloat(selectedLcForAmendment.quantity || 0).toLocaleString('en-US')} Ton</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Rate</span>
                                                    <p className="text-sm font-bold text-gray-800">${parseFloat(selectedLcForAmendment.rate || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Dollar</span>
                                                    <p className="text-sm font-bold text-blue-600">${parseFloat(selectedLcForAmendment.totalDollar || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Amount</span>
                                                    <p className="text-sm font-bold text-gray-800">৳{parseFloat(selectedLcForAmendment.totalAmount || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Amendment Details Inputs */}
                                <div className="lg:col-span-2 space-y-6 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Amendment Details</h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Number *</label>
                                            <input
                                                type="text"
                                                name="amendmentNo"
                                                value={amendmentFormData.amendmentNo}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, amendmentNo: e.target.value }))}
                                                placeholder="e.g. AMENDMENT NO-01"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <CustomDatePicker
                                                label="Amendment Date *"
                                                value={amendmentFormData.amendmentDate}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, amendmentDate: e.target.value }))}
                                                required
                                                compact={true}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <CustomDatePicker
                                                label="New Expiry Date"
                                                value={amendmentFormData.expiryDate}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                                                compact={true}
                                            />
                                        </div>

                                        <div className="space-y-1.5 text-left relative" ref={amendmentPiRef}>
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PI Number</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={amendmentFormData.piNo}
                                                    onChange={(e) => setAmendmentFormData(prev => ({ ...prev, piNo: e.target.value }))}
                                                    onFocus={() => { setActiveDropdown('amendmentPiNo'); setHighlightedIndex(-1); }}
                                                    onKeyDown={(e) => handleDropdownKeyDown(e, 'amendmentPiNo', 'amendmentPiNo', getExpandedDropdownOptions(amendmentFormData.piNo))}
                                                    placeholder="Select PI Number"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10 text-sm"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    {amendmentFormData.piNo && (
                                                        <button type="button" onClick={() => setAmendmentFormData(prev => ({ ...prev, piNo: '' }))} className="text-gray-400 hover:text-gray-600">
                                                            <XIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                </div>
                                            </div>
                                            {activeDropdown === 'amendmentPiNo' && (
                                                <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                    {getExpandedDropdownOptions(amendmentFormData.piNo).map((pi, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                handleDropdownSelect('amendmentPiNo', pi);
                                                            }}
                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                            className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${amendmentFormData.piNo === pi ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                        >
                                                            {pi}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 text-left">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PI Balance (Ton)</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={selectedPiForAmendment ? `${piBalanceTon.toLocaleString('en-US', { minimumFractionDigits: 3 })} Ton` : 'N/A'}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-blue-600 font-bold text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5 text-left">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">PI Expiry Date</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={selectedPiForAmendment?.validityDate ? formatDate(selectedPiForAmendment.validityDate) : 'N/A'}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-gray-500 font-bold text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Quantity (Ton)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="quantity"
                                                value={amendmentFormData.quantity}
                                                onChange={handleAmendmentInputChange}
                                                placeholder="e.g. 520.50"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Rate ($/Ton)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="rate"
                                                value={amendmentFormData.rate}
                                                onChange={handleAmendmentInputChange}
                                                placeholder="e.g. 350.00"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Dollar Rate (৳)</label>
                                            <input
                                                type="number"
                                                step="any"
                                                name="dollarRate"
                                                value={amendmentFormData.dollarRate}
                                                onChange={handleAmendmentInputChange}
                                                placeholder="e.g. 120.00"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>

                                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5 text-left">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">ADDN Number</label>
                                                <input
                                                    type="text"
                                                    name="addnNo"
                                                    value={amendmentFormData.addnNo || ''}
                                                    onChange={(e) => setAmendmentFormData(prev => ({ ...prev, addnNo: e.target.value }))}
                                                    placeholder="e.g. ADDN-01"
                                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <CustomDatePicker
                                                    label="ADDN Date"
                                                    value={amendmentFormData.addnDate}
                                                    onChange={(e) => setAmendmentFormData(prev => ({ ...prev, addnDate: e.target.value }))}
                                                    compact={true}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5 text-left relative" ref={amendmentPortRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Port</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        name="port"
                                                        value={amendmentFormData.port || ''}
                                                        onChange={(e) => {
                                                            setAmendmentFormData(prev => ({ ...prev, port: e.target.value }));
                                                            setActiveDropdown('amendmentPort');
                                                            setHighlightedIndex(-1);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDropdown('amendmentPort');
                                                            setHighlightedIndex(-1);
                                                        }}
                                                        placeholder="Select Port Name"
                                                        autoComplete="off"
                                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium pr-10 text-sm"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        {amendmentFormData.port && (
                                                            <button type="button" onClick={() => setAmendmentFormData(prev => ({ ...prev, port: '' }))} className="text-gray-400 hover:text-gray-600">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {activeDropdown === 'amendmentPort' && (
                                                    <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                                                        {ports
                                                            .filter(p => !p.isLoadingPort && (!amendmentFormData.port || p.name.toLowerCase().includes(amendmentFormData.port.toLowerCase())))
                                                            .map((p, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        handleDropdownSelect('amendmentPort', p.name);
                                                                    }}
                                                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                                                    className={`w-full px-4 py-2 text-left text-sm transition-colors font-medium ${amendmentFormData.port === p.name ? 'bg-blue-50 text-blue-700' : highlightedIndex === idx ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-blue-50'}`}
                                                                >
                                                                    {p.name}
                                                                </button>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <CustomDatePicker
                                                    label="Extended Shipment Date"
                                                    value={amendmentFormData.extendedShipmentDate}
                                                    onChange={(e) => setAmendmentFormData(prev => ({ ...prev, extendedShipmentDate: e.target.value }))}
                                                    compact={true}
                                                />
                                            </div>
                                        </div>

                                        {/* Amendment Bank Details & Bills */}
                                        <div className="col-span-full border-t border-dashed border-gray-200 pt-6">
                                            <div className="flex items-center justify-between mb-4 bg-blue-50/30 border-l-4 border-blue-500 px-4 py-2 rounded-r-xl">
                                                <div>
                                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest text-left">Amendment Bank Details</h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Amendment Bill</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAmendmentFormData(prev => {
                                                                const nextVal = !prev.amendmentLcBillEnabled;
                                                                const newState = {
                                                                    ...prev,
                                                                    amendmentLcBillEnabled: nextVal,
                                                                };
                                                                if (!nextVal) {
                                                                    newState.amendmentCommission = '';
                                                                    newState.amendmentVatOnCommission = '';
                                                                    newState.amendmentSwiftCharge = '';
                                                                    newState.amendmentVatOnSwift = '';
                                                                    newState.amendmentBankBill = '';
                                                                } else {
                                                                    const selectedBank = banksRaw.find(b => (b.bankName || '').trim().toUpperCase() === (selectedLcForAmendment?.bankName || '').trim().toUpperCase());
                                                                    const selectedBranch = selectedBank?.branches?.find(br => br.branch === selectedLcForAmendment?.bankBranch);
                                                                    if (selectedBranch) {
                                                                        newState.amendmentCommission = selectedBranch.amendmentCommission || '';
                                                                        newState.amendmentVatOnCommission = selectedBranch.amendmentVatOnCommission || '';
                                                                        newState.amendmentSwiftCharge = selectedBranch.amendmentSwiftCharge !== undefined && selectedBranch.amendmentSwiftCharge !== '' ? String(selectedBranch.amendmentSwiftCharge) : '';
                                                                        newState.amendmentVatOnSwift = selectedBranch.amendmentVatOnSwift || '';
                                                                    }
                                                                }
                                                                return syncAmendmentBills(newState, selectedLcForAmendment, banksRaw, editingAmendmentNo);
                                                            });
                                                        }}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${amendmentFormData.amendmentLcBillEnabled !== false ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${amendmentFormData.amendmentLcBillEnabled !== false ? 'translate-x-5' : 'translate-x-0'}`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                            {amendmentFormData.amendmentLcBillEnabled === false ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                                    <div className="space-y-1.5 text-left">
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Margin (%)</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            name="amendmentMargin"
                                                            value={amendmentFormData.amendmentMargin || ''}
                                                            onChange={handleAmendmentInputChange}
                                                            placeholder="0.00"
                                                            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5 text-left">
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Margin Bill</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">৳</span>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentMarginBill"
                                                                value={amendmentFormData.amendmentMarginBill || ''}
                                                                onChange={handleAmendmentInputChange}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 pl-8 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm font-semibold text-gray-800"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 text-left">
                                                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Margin Paid</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">৳</span>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentMarginPaid"
                                                                value={amendmentFormData.amendmentMarginPaid || ''}
                                                                onChange={handleAmendmentInputChange}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 pl-8 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm font-semibold text-gray-800"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 text-left">
                                                        <label className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider font-extrabold">Total Amendment Bank Bill</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-indigo-400 text-sm">৳</span>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="totalAmendmentBankBill"
                                                                value={amendmentFormData.totalAmendmentBankBill || ''}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 pl-8 bg-blue-50 border border-blue-100 rounded-xl outline-none transition-all font-black text-sm text-blue-700"
                                                                readOnly
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Margin (%)</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentMargin"
                                                                value={amendmentFormData.amendmentMargin || ''}
                                                                onChange={handleAmendmentInputChange}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Comm. on Amnd. (%)</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentCommission"
                                                                value={amendmentFormData.amendmentCommission || ''}
                                                                onChange={handleAmendmentInputChange}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">VAT on Comm. (%)</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentVatOnCommission"
                                                                value={amendmentFormData.amendmentVatOnCommission || ''}
                                                                onChange={handleAmendmentInputChange}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Swift Charge</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">৳</span>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    name="amendmentSwiftCharge"
                                                                    value={amendmentFormData.amendmentSwiftCharge || ''}
                                                                    onChange={handleAmendmentInputChange}
                                                                    placeholder="0.00"
                                                                    className="w-full px-4 py-2.5 pl-8 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">VAT on Swift (%)</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                name="amendmentVatOnSwift"
                                                                value={amendmentFormData.amendmentVatOnSwift || ''}
                                                                onChange={handleAmendmentInputChange}
                                                                placeholder="0.00"
                                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Margin Bill</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">৳</span>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    name="amendmentMarginBill"
                                                                    value={amendmentFormData.amendmentMarginBill || ''}
                                                                    onChange={handleAmendmentInputChange}
                                                                    placeholder="0.00"
                                                                    className="w-full px-4 py-2.5 pl-8 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm font-semibold text-gray-800"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Margin Paid</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">৳</span>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    name="amendmentMarginPaid"
                                                                    value={amendmentFormData.amendmentMarginPaid || ''}
                                                                    onChange={handleAmendmentInputChange}
                                                                    placeholder="0.00"
                                                                    className="w-full px-4 py-2.5 pl-8 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm font-semibold text-gray-800"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Bank Bill</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">৳</span>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    name="amendmentBankBill"
                                                                    value={amendmentFormData.amendmentBankBill || ''}
                                                                    onChange={handleAmendmentInputChange}
                                                                    placeholder="0.00"
                                                                    className="w-full px-4 py-2.5 pl-8 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium text-sm font-semibold text-gray-800"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5 text-left">
                                                            <label className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider font-extrabold">Total Amendment Bank Bill</label>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-indigo-400 text-sm">৳</span>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    name="totalAmendmentBankBill"
                                                                    value={amendmentFormData.totalAmendmentBankBill || ''}
                                                                    placeholder="0.00"
                                                                    className="w-full px-4 py-2.5 pl-8 bg-blue-50 border border-blue-100 rounded-xl outline-none transition-all font-black text-sm text-blue-700"
                                                                    readOnly
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="col-span-full space-y-1.5">
                                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Remarks / Amendment Details</label>
                                            <textarea
                                                name="remarks"
                                                value={amendmentFormData.remarks}
                                                onChange={(e) => setAmendmentFormData(prev => ({ ...prev, remarks: e.target.value }))}
                                                placeholder="Describe the details of the amendment..."
                                                rows="3"
                                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowAmendmentForm(false);
                                                setSelectedAmendmentLcId('');
                                                setAmendmentSearchQuery('');
                                                setEditingAmendmentNo('');
                                                setAmendmentFormData({
                                                    amendmentNo: '',
                                                    amendmentDate: '',
                                                    expiryDate: '',
                                                    quantity: '',
                                                    rate: '',
                                                    dollarRate: '',
                                                    remarks: '',
                                                    addnNo: '',
                                                    addnDate: '',
                                                    port: '',
                                                    extendedShipmentDate: '',
                                                    piNo: '',
                                                    amendmentMargin: '',
                                                    amendmentCommission: '',
                                                    amendmentVatOnCommission: '',
                                                    amendmentSwiftCharge: '',
                                                    amendmentVatOnSwift: '',
                                                    amendmentMarginBill: '',
                                                    amendmentMarginPaid: '',
                                                    amendmentBankBill: '',
                                                    totalAmendmentBankBill: '',
                                                    amendmentBill: '',
                                                    amendmentLcBillEnabled: false
                                                });
                                            }}
                                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Amendment'}
                                        </button>
                                    </div>
                                </div>

                                {/* Right Side: Product & Insurance Details (Read-Only) */}
                                <div className="lg:col-span-1 space-y-6 bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
                                    <div>
                                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4">Product & Insurance</h4>
                                        <div className="space-y-4">
                                            {/* Product Details Section */}
                                            <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-100/50 space-y-3">
                                                <div className="flex items-center gap-1.5 border-b border-blue-100/50 pb-1.5 mb-1">
                                                    <DollarSignIcon className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Product Info</span>
                                                </div>
                                                {amendmentDisplayProducts && amendmentDisplayProducts.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {amendmentDisplayProducts.map((prod, pIdx) => (
                                                            <div key={pIdx} className="border-b border-gray-200/40 pb-2 last:border-0 last:pb-0 text-left">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Item {amendmentDisplayProducts.length > 1 ? pIdx + 1 : ''}</span>
                                                                <p className="text-xs font-bold text-gray-800 truncate" title={prod.productName}>{prod.productName || '-'}</p>
                                                                <div className="grid grid-cols-2 gap-2 mt-1">
                                                                    <div>
                                                                        <span className="text-[8px] font-semibold text-gray-400 uppercase">Qty</span>
                                                                        <p className="text-[11px] font-bold text-gray-700">{parseFloat(prod.quantity || 0).toLocaleString('en-US')} Ton</p>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[8px] font-semibold text-gray-400 uppercase">Rate</span>
                                                                        <p className="text-[11px] font-bold text-gray-700">${parseFloat(prod.rate || 0).toLocaleString('en-IN')}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2 text-left">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Product Name</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">
                                                                {selectedPiForAmendment
                                                                    ? (selectedPiForAmendment.productName || '-')
                                                                    : (selectedLcForAmendment.productName || selectedLcForAmendment.product || '-')}
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-left">
                                                            <div>
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                                                <p className="text-xs font-bold text-gray-800">
                                                                    {selectedPiForAmendment
                                                                        ? `${((parseFloat(selectedPiForAmendment.grandTotalQuantity || selectedPiForAmendment.quantity) || 0) / 1000).toLocaleString('en-US')} Ton`
                                                                        : `${parseFloat(selectedLcForAmendment.quantity || 0).toLocaleString('en-US')} Ton`}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Rate</span>
                                                                <p className="text-xs font-bold text-gray-800">
                                                                    {selectedPiForAmendment
                                                                        ? `$${parseFloat(selectedPiForAmendment.rate || 0).toLocaleString('en-IN')}`
                                                                        : `$${parseFloat(selectedLcForAmendment.rate || 0).toLocaleString('en-IN')}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="border-t border-blue-100/50 pt-2 mt-2 text-left">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                                    <p className="text-xs font-bold text-gray-800">{amendmentDisplayPort}</p>
                                                </div>
                                            </div>

                                            {/* Bank Details Section */}
                                            <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-100/50 space-y-3">
                                                <div className="flex items-center gap-1.5 border-b border-blue-100/50 pb-1.5 mb-1">
                                                    <BuildingIcon className="w-3.5 h-3.5 text-blue-500" />
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Bank Info</span>
                                                </div>
                                                <div className="space-y-2 text-left">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Issuing Bank</span>
                                                        <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.bankName}>{selectedLcForAmendment.bankName || '-'}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Branch</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">{selectedLcForAmendment.bankBranch || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Margin</span>
                                                            <p className="text-xs font-bold text-gray-800">{selectedLcForAmendment.bankMargin ? `${selectedLcForAmendment.bankMargin}%` : '-'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Insurance Details Section */}
                                            <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50 space-y-3">
                                                <div className="flex items-center gap-1.5 border-b border-indigo-100/50 pb-1.5 mb-1">
                                                    <ShieldIcon className="w-3.5 h-3.5 text-indigo-500" />
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Insurance Info</span>
                                                </div>
                                                <div className="space-y-2 text-left">
                                                    <div>
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Company</span>
                                                        <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.insuranceCo}>{selectedLcForAmendment.insuranceCo || '-'}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Policy Type</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">{selectedLcForAmendment.policyType || '-'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cover Note No</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.marineCoverNote}>{selectedLcForAmendment.marineCoverNote || '-'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">C.N Date</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">{selectedLcForAmendment.marineCNDate ? formatDate(selectedLcForAmendment.marineCNDate) : '-'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Policy No</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate" title={selectedLcForAmendment.policyNo}>{selectedLcForAmendment.policyNo || '-'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 border-t border-indigo-100/50 pt-1.5">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Extra %</span>
                                                            <p className="text-xs font-bold text-gray-800">{selectedLcForAmendment.extraPercent || '0'}%</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Premium Rate</span>
                                                            <p className="text-xs font-bold text-gray-800">{selectedLcForAmendment.premium || '0'}%</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Premium Return</span>
                                                            <p className="text-xs font-bold text-blue-600">{selectedLcForAmendment.premiumReturn || '0'}%</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Return Amount</span>
                                                            <p className="text-xs font-bold text-blue-600 truncate">৳{parseFloat(amendmentInsuranceInfo?.expectedReturnAmount || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">VAT ({selectedLcForAmendment.premiumVat || '0'}%)</span>
                                                            <p className="text-xs font-bold text-gray-800 truncate">
                                                                ৳{parseFloat(amendmentInsuranceInfo?.vatAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Stamp Duty</span>
                                                            <p className="text-xs font-bold text-gray-800">৳{parseFloat(selectedLcForAmendment.stampCharge || 0).toLocaleString('en-IN')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 border-t border-indigo-100/50 pt-1.5 mt-1">
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Gross Premium</span>
                                                            <p className="text-xs font-bold text-gray-800">৳{parseFloat(amendmentInsuranceInfo?.grossPremium || 0).toLocaleString('en-US')}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Net Premium</span>
                                                            <p className="text-xs font-bold text-indigo-600 truncate">৳{parseFloat(amendmentInsuranceInfo?.netPremium || 0).toLocaleString('en-US')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}

            {!showForm && !showAmendmentForm && (
                <>
                    {/* Desktop View */}
                    <div className="hidden md:block overflow-x-auto bg-white/50 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Date</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Expire Date</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">LC No</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Importer</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Exporter</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Bank</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Port</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-nowrap">Product</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Quantity (Kg)</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Total Value (৳)</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">LC Balance</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right text-nowrap">Expense</th>
                                    <th className="px-3 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="13" className="px-6 py-12 text-center text-sm text-gray-500">
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

                                        const displayProducts = record.productsList && record.productsList.length > 0
                                            ? record.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                            : record.productName || '-';

                                        // Unit conversion for display (Data is in Tons, Table shows Kg)
                                        const totalQtyTons = record.productsList && record.productsList.length > 0
                                            ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
                                            : (parseFloat(record.quantity) || 0);
                                        const qtyKg = totalQtyTons * 1000;

                                        // Calculate Remaining Quantities
                                        // Received: From allStockRecords where lcNo matches and status is NOT requested/rejected
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

                                        const adj = getAdjustedLcValues(record);
                                        const combinedRemKg = adj.combinedRemKg;

                                        // Calculate Rem G.P
                                        const totalGpQtyKg = gpRecords
                                            .filter(gp => String(gp.lcNumber || '').replace(/\D/g, '') === lcNoClean)
                                            .reduce((sum, gp) => sum + (parseFloat(gp.gpQuantity) || 0), 0);
                                        const remGpKg = Math.max(0, adj.adjustedQtyKg - totalGpQtyKg);

                                        return (
                                            <React.Fragment key={record._id}>
                                                <tr className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 group">
                                                    <td className="px-3 py-4 text-sm font-medium text-gray-600 whitespace-nowrap">{formatDate(record.openingDate)}</td>
                                                    <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{formatDate(record.expiryDate)}</td>
                                                    <td className="px-3 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span>{record.lcNo}</span>
                                                            {record.amendments?.length > 0 && (
                                                                <span className="self-start px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                                    {record.lcAmendment?.split(' ')[0] || 'Amended'}
                                                                </span>
                                                            )}
                                                            {record.enableValueQtyAdjustment && (
                                                                <span className="self-start px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                                    {(() => {
                                                                        const addedPercent = adj.openingQtyKg > 0 ? (adj.actualAdjustmentQtyKg / adj.openingQtyKg) * 100 : 0;
                                                                        return `${addedPercent.toFixed(2)}% added`;
                                                                    })()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-4 text-sm font-medium text-gray-700 whitespace-nowrap truncate max-w-[120px]" title={record.importerName}>{record.importerName}</td>
                                                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap truncate max-w-[120px]" title={record.exporterName}>{record.exporterName}</td>
                                                    <td className="px-3 py-4 text-sm text-gray-600 font-medium whitespace-nowrap truncate max-w-[120px]" title={record.bankName}>{record.bankName}</td>
                                                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap truncate max-w-[80px]" title={displayPort}>{displayPort}</td>
                                                    <td className="px-3 py-4 text-sm font-bold text-gray-900 max-w-[120px]">
                                                         {record.productsList && record.productsList.length > 0 ? (
                                                             <div className="flex flex-col gap-0.5">
                                                                 {record.productsList.map((p, idx) => (
                                                                     <div key={idx} className="truncate whitespace-nowrap" title={p.productName}>
                                                                         {p.productName}
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                         ) : (
                                                             <span className="truncate whitespace-nowrap block">{record.productName || '-'}</span>
                                                         )}
                                                     </td>
                                                    <td className="px-3 py-4 text-sm text-right text-gray-600 whitespace-nowrap">
                                                        <span className="font-bold text-gray-900">{adj.adjustedQtyKg.toLocaleString('en-US')}</span> <span className="text-[10px] text-gray-400 font-normal">Kg</span>
                                                    </td>
                                                    <td className="px-3 py-4 text-sm text-right font-black text-gray-900 whitespace-nowrap">৳{adj.adjustedTotalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                                    <td className="px-3 py-4 text-sm text-right whitespace-nowrap">
                                                        <span className={`font-black ${combinedRemKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                            {combinedRemKg.toLocaleString('en-IN')} <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">Kg</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-4 text-sm text-right whitespace-nowrap">
                                                        {(() => {
                                                            const totalExpense = getLcTotalPaidExpense(record);
                                                            return (
                                                                <span className={`font-black ${totalExpense > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                                                    {totalExpense > 0 ? `৳${totalExpense.toLocaleString('en-IN')}` : '—'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-3 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-4">
                                                            <button
                                                                onClick={() => setExpandedLcKey(prev => prev === record._id ? null : record._id)}
                                                                className={`p-1.5 rounded-lg transition-all ${expandedLcKey === record._id ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                                                                title="View Charges"
                                                            >
                                                                {expandedLcKey === record._id ? (
                                                                    <ChevronUpIcon className="w-4 h-4" />
                                                                ) : (
                                                                    <ChevronDownIcon className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => setViewData(record)}
                                                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                                                title="View Details"
                                                            >
                                                                <EyeIcon className="w-5 h-5" />
                                                            </button>
                                                            {canManage && (
                                                                <>
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
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Expandable Sub-row containing Charges Breakdown */}
                                                {expandedLcKey === record._id && (
                                                    <tr className="bg-gray-50/40">
                                                        <td colSpan="13" className="px-6 py-4 border-b border-gray-100">
                                                            <div className="flex flex-col gap-6 bg-white p-5 rounded-2xl border border-gray-100 shadow-inner animate-in fade-in duration-300">
                                                                {/* Radio Button for Enable Value and Quantity */}
                                                                {record.piNo && record.quantity && record.totalAmount && (
                                                                    <div className="flex items-center gap-4 py-1.5 px-3 bg-blue-50/50 rounded-xl border border-blue-100/30 self-start">
                                                                        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Adjust Quantity & Value:</span>
                                                                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700">
                                                                            <input
                                                                                type="radio"
                                                                                name={`adjust-${record._id}`}
                                                                                checked={!!record.enableValueQtyAdjustment}
                                                                                onChange={() => handleToggleValueQtyAdjustment(record, true)}
                                                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                                                                            />
                                                                            Enable
                                                                        </label>
                                                                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-700">
                                                                            <input
                                                                                type="radio"
                                                                                name={`adjust-${record._id}`}
                                                                                checked={!record.enableValueQtyAdjustment}
                                                                                onChange={() => handleToggleValueQtyAdjustment(record, false)}
                                                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                                                                            />
                                                                            Disable
                                                                        </label>
                                                                        {record.enableValueQtyAdjustment && (
                                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                                                {(() => {
                                                                                    const addedPercent = adj.openingQtyKg > 0 ? (adj.actualAdjustmentQtyKg / adj.openingQtyKg) * 100 : 0;
                                                                                    return `${addedPercent.toFixed(2)}% added`;
                                                                                })()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* New LC Bill Charges */}
                                                                <div className="space-y-3">
                                                                    <h4 className="text-sm font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-2 flex items-center justify-between">
                                                                        <span>New LC Bill Charges</span>
                                                                        {record.bankName && (
                                                                            <span className="text-xs text-gray-400 font-bold normal-case">
                                                                                {record.bankName} {record.bankBranch ? `(${record.bankBranch})` : ''}
                                                                            </span>
                                                                        )}
                                                                    </h4>
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-y-4 gap-x-6 text-left">
                                                                        {(() => {
                                                                            const isRecordLcBillActive = record.lcBillEnabled !== undefined
                                                                                ? record.lcBillEnabled
                                                                                : !!(record.bankLcCommission || record.bankSwiftCharge || record.bankLcApplicationForm || record.bankMpCharge || record.bankStampCharge);
                                                                            return (
                                                                                <>
                                                                                    {isRecordLcBillActive && (
                                                                                        <>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC Commission</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankLcCommission ? `${record.bankLcCommission}%` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VAT on Commission</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankVatOnCommission ? `${record.bankVatOnCommission}%` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">SWIFT Charge</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankSwiftCharge !== undefined && record.bankSwiftCharge !== '' ? `৳${parseFloat(record.bankSwiftCharge).toLocaleString('en-IN')}` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VAT on SWIFT Charge</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankVatOnSwiftCharge ? `${record.bankVatOnSwiftCharge}%` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">LC Application Form</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankLcApplicationForm !== undefined && record.bankLcApplicationForm !== '' ? `৳${parseFloat(record.bankLcApplicationForm).toLocaleString('en-IN')}` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">MP Charge</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankMpCharge !== undefined && record.bankMpCharge !== '' ? `৳${parseFloat(record.bankMpCharge).toLocaleString('en-IN')}` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="space-y-0.5">
                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Stamp Charge</span>
                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                    {record.bankStampCharge !== undefined && record.bankStampCharge !== '' ? `৳${parseFloat(record.bankStampCharge).toLocaleString('en-IN')}` : '-'}
                                                                                                </p>
                                                                                            </div>
                                                                                        </>
                                                                                    )}
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Margin</span>
                                                                                        <p className="text-sm font-black text-gray-800">
                                                                                            {record.bankMargin ? `${record.bankMargin}%` : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Margin Bill</span>
                                                                                        <p className="text-sm font-black text-blue-600">
                                                                                            {record.marginBill ? `৳${parseFloat(record.marginBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Margin Paid</span>
                                                                                        <p className="text-sm font-black text-blue-600">
                                                                                            {record.marginPaid !== undefined && record.marginPaid !== ''
                                                                                                ? `৳${parseFloat(record.marginPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                                                : (() => {
                                                                                                    const totalAmount = adj.adjustedTotalAmount;
                                                                                                    const margin = parseFloat(record.bankMargin) || 0;
                                                                                                    const mp = totalAmount * (margin / 100);
                                                                                                    return mp > 0 ? `৳${mp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                                                                                                })()
                                                                                            }
                                                                                        </p>
                                                                                    </div>
                                                                                    {isRecordLcBillActive && (
                                                                                        <div className="space-y-0.5">
                                                                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Bank Bill</span>
                                                                                            <p className="text-sm font-black text-rose-600">
                                                                                                {record.bankBill ? `৳${parseFloat(record.bankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                            </p>
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                        <div className="space-y-0.5">
                                                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Bank Bill</span>
                                                                            <p className="text-sm font-black text-blue-600 font-extrabold">
                                                                                {record.totalBankBill ? `৳${parseFloat(record.totalBankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Amendment Bill Charges */}
                                                                {record.amendments && record.amendments.filter(amnd => amnd.amendmentNo !== 'Original LC').length > 0 && (
                                                                    <div className="space-y-3">
                                                                        <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 flex items-center justify-between">
                                                                            <span>Amendment Bill Charges</span>
                                                                        </h4>
                                                                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                                                            {record.amendments
                                                                                .filter(amnd => amnd.amendmentNo !== 'Original LC')
                                                                                .map((amnd, index) => {
                                                                                    const isAmndBillActive = amnd.amendmentLcBillEnabled !== undefined
                                                                                        ? amnd.amendmentLcBillEnabled
                                                                                        : !!(amnd.amendmentCommission || amnd.amendmentSwiftCharge);

                                                                                    const swiftCharge = isAmndBillActive ? (parseFloat(amnd.amendmentSwiftCharge) || 0) : 0;
                                                                                    const vatOnSwift = isAmndBillActive ? (parseFloat(amnd.amendmentVatOnSwift) || 0) : 0;
                                                                                    const vatOnSwiftAmt = swiftCharge * (vatOnSwift / 100);

                                                                                    const bankBill = isAmndBillActive ? (parseFloat(amnd.amendmentBankBill || amnd.amendmentBill) || 0) : 0;
                                                                                    const vatOnCommission = isAmndBillActive ? (parseFloat(amnd.amendmentVatOnCommission) || 0) : 0;
                                                                                    const commissionTotal = Math.max(0, bankBill - swiftCharge - vatOnSwiftAmt);
                                                                                    const commissionAmt = commissionTotal / (1 + vatOnCommission / 100);
                                                                                    const vatOnCommissionAmt = commissionTotal - commissionAmt;

                                                                                    return (
                                                                                        <div key={index} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl space-y-2">
                                                                                            <div className="flex justify-between items-center border-b border-gray-200/50 pb-1">
                                                                                                <span className="text-sm font-black text-indigo-600 uppercase tracking-wider">
                                                                                                    {amnd.amendmentNo || `Amendment-${String(index + 1).padStart(2, '0')}`}
                                                                                                </span>
                                                                                                {amnd.amendmentDate && (
                                                                                                    <span className="text-sm font-semibold text-gray-500 font-mono">
                                                                                                        {formatDate(amnd.amendmentDate)}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            {(() => {
                                                                                                const hasCommission = isAmndBillActive && amnd.amendmentCommission && parseFloat(amnd.amendmentCommission) > 0;
                                                                                                const hasVatOnComm = isAmndBillActive && amnd.amendmentVatOnCommission && parseFloat(amnd.amendmentVatOnCommission) > 0;
                                                                                                const hasSwiftCharge = isAmndBillActive && amnd.amendmentSwiftCharge && parseFloat(amnd.amendmentSwiftCharge) > 0;
                                                                                                const hasVatOnSwift = isAmndBillActive && amnd.amendmentVatOnSwift && parseFloat(amnd.amendmentVatOnSwift) > 0;
                                                                                                const hasBankBill = isAmndBillActive && amnd.amendmentBankBill && parseFloat(amnd.amendmentBankBill) > 0;

                                                                                                const colsCount = 4 + (hasCommission ? 1 : 0) + (hasVatOnComm ? 1 : 0) + (hasSwiftCharge ? 1 : 0) + (hasVatOnSwift ? 1 : 0) + (hasBankBill ? 1 : 0);

                                                                                                return (
                                                                                                    <div className={`grid grid-cols-2 sm:grid-cols-3 ${gridColsClassMap[colsCount] || 'md:grid-cols-9'} gap-4 text-left`}>
                                                                                                        {hasCommission && (
                                                                                                            <div className="space-y-0.5">
                                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Commission ({amnd.amendmentCommission || 0}%)</span>
                                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                                    ৳{Math.round(commissionAmt).toLocaleString('en-IN')}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {hasVatOnComm && (
                                                                                                            <div className="space-y-0.5">
                                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VAT on Comm. ({amnd.amendmentVatOnCommission || 0}%)</span>
                                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                                    ৳{Math.round(vatOnCommissionAmt).toLocaleString('en-IN')}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {hasSwiftCharge && (
                                                                                                            <div className="space-y-0.5">
                                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">SWIFT Charge</span>
                                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                                    ৳{parseFloat(amnd.amendmentSwiftCharge).toLocaleString('en-IN')}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {hasVatOnSwift && (
                                                                                                            <div className="space-y-0.5">
                                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">VAT on SWIFT ({amnd.amendmentVatOnSwift || 0}%)</span>
                                                                                                                <p className="text-sm font-black text-gray-800">
                                                                                                                    ৳{Math.round(vatOnSwiftAmt).toLocaleString('en-IN')}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        <div className="space-y-0.5">
                                                                                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Margin</span>
                                                                                                            <p className="text-sm font-black text-gray-800">
                                                                                                                {amnd.amendmentMargin !== undefined && amnd.amendmentMargin !== '' ? `${amnd.amendmentMargin}%` : (record.bankMargin ? `${record.bankMargin}%` : '-')}
                                                                                                            </p>
                                                                                                        </div>
                                                                                                        <div className="space-y-0.5">
                                                                                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Margin Bill</span>
                                                                                                            <p className="text-sm font-black text-blue-600">
                                                                                                                {amnd.amendmentMarginBill ? `৳${parseFloat(amnd.amendmentMarginBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                                            </p>
                                                                                                        </div>
                                                                                                        <div className="space-y-0.5">
                                                                                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Margin Paid</span>
                                                                                                            <p className="text-sm font-black text-blue-600">
                                                                                                                {amnd.amendmentMarginPaid !== undefined && amnd.amendmentMarginPaid !== ''
                                                                                                                    ? `৳${parseFloat(amnd.amendmentMarginPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                                                                    : (() => {
                                                                                                                        const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (record.bankMargin !== undefined ? parseFloat(record.bankMargin) : 0);
                                                                                                                        const mb = parseFloat(amnd.amendmentMarginBill) || 0;
                                                                                                                        const mp = mb * (margin / 100);
                                                                                                                        return mp > 0 ? `৳${mp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                                                                                                                    })()
                                                                                                                }
                                                                                                            </p>
                                                                                                        </div>
                                                                                                        {hasBankBill && (
                                                                                                            <div className="space-y-0.5">
                                                                                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Amendment Bill</span>
                                                                                                                <p className="text-sm font-extrabold text-rose-600">
                                                                                                                    {isAmndBillActive && amnd.amendmentBankBill ? `৳${parseFloat(amnd.amendmentBankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        )}
                                                                                                        <div className="space-y-0.5">
                                                                                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Bill</span>
                                                                                                            <p className="text-sm font-black text-blue-600">
                                                                                                                {(amnd.totalAmendmentBankBill || amnd.amendmentBill) ? `৳${parseFloat(amnd.totalAmendmentBankBill || amnd.amendmentBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                                            </p>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                );
                                                                                            })()}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="13" className="px-6 py-12 text-center text-gray-400 font-medium whitespace-nowrap italic">
                                            No LC records found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            Array(3).fill(0).map((_, i) => (
                                <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm animate-pulse space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                                        <div className="h-3 bg-gray-100 rounded w-1/4"></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="h-10 bg-gray-50 rounded-xl"></div>
                                        <div className="h-10 bg-gray-50 rounded-xl"></div>
                                    </div>
                                </div>
                            ))
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
                                const totalQtyTons = record.productsList && record.productsList.length > 0
                                    ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
                                    : (parseFloat(record.quantity) || 0);
                                const qtyKg = totalQtyTons * 1000;

                                // Calculate Remaining Quantities
                                // Received: From allStockRecords where lcNo matches and status is NOT requested/rejected
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

                                const adj = getAdjustedLcValues(record);
                                const combinedRemKg = adj.combinedRemKg;

                                // Calculate Rem G.P
                                const totalGpQtyKg = gpRecords
                                    .filter(gp => String(gp.lcNumber || '').replace(/\D/g, '') === lcNoClean)
                                    .reduce((sum, gp) => sum + (parseFloat(gp.gpQuantity) || 0), 0);
                                const remGpKg = Math.max(0, adj.adjustedQtyKg - totalGpQtyKg);

                                const totalExpense = getLcTotalPaidExpense(record);

                                const isCardExpanded = expandedCardKey === record._id;
                                const isExpanded = expandedLcKey === record._id;

                                return (
                                    <div
                                        key={record._id}
                                        className={`bg-white rounded-2xl border ${isCardExpanded ? 'border-blue-100 ring-4 ring-blue-500/5 shadow-lg' : 'border-gray-100 shadow-sm'} p-5 transition-all duration-300 overflow-hidden text-left`}
                                    >
                                        {/* Collapsed View: Redesigned Premium Card Header */}
                                        <div
                                            onClick={() => setExpandedCardKey(isCardExpanded ? null : record._id)}
                                            className="flex items-center justify-between gap-4 cursor-pointer select-none py-1"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {/* Main Info Column */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-black text-gray-955 font-sans tracking-tight">{record.lcNo}</span>
                                                        {record.amendments?.length > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-150/40 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                                {record.lcAmendment?.split(' ')[0] || 'Amended'}
                                                            </span>
                                                        )}
                                                        {record.enableValueQtyAdjustment && (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-150/40 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                                {(() => {
                                                                    const addedPercent = adj.openingQtyKg > 0 ? (adj.actualAdjustmentQtyKg / adj.openingQtyKg) * 100 : 0;
                                                                    return `${addedPercent.toFixed(2)}% added`;
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-semibold text-gray-500 truncate mt-0.5">
                                                        {record.productsList && record.productsList.length > 0
                                                            ? record.productsList.map(p => p.productName).filter(Boolean).join(', ')
                                                            : record.productName || '-'}
                                                    </p>
                                                </div>
                                                {/* Date Info Column */}
                                                <div className="text-right shrink-0">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Date</span>
                                                    <span className="text-xs font-bold text-gray-800 font-mono mt-0.5 block">{formatDate(record.openingDate)}</span>
                                                </div>
                                            </div>
                                            <div className={`shrink-0 flex items-center justify-center p-1.5 rounded-lg border transition-all ${isCardExpanded ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-400 border-gray-100 hover:text-gray-600'}`}>
                                                {isCardExpanded ? (
                                                    <ChevronUpIcon className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDownIcon className="w-4 h-4" />
                                                )}
                                            </div>
                                        </div>
                                        {isCardExpanded && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                {/* Card Details: Premium aligned grid */}
                                                <div className="grid grid-cols-[125px_8px_1fr] gap-y-1.5 bg-gray-50/50 p-4 rounded-2xl border border-gray-100/80 text-xs items-baseline text-left">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC NO</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-black text-gray-955 font-sans text-[11px]">{record.lcNo}</span>
                                                        {record.amendments?.length > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide leading-none">
                                                                {record.lcAmendment?.split(' ')[0] || 'Amended'}
                                                            </span>
                                                        )}
                                                        {record.enableValueQtyAdjustment && (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide leading-none">
                                                                {(() => {
                                                                    const addedPercent = adj.openingQtyKg > 0 ? (adj.actualAdjustmentQtyKg / adj.openingQtyKg) * 100 : 0;
                                                                    return `${addedPercent.toFixed(2)}% added`;
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opening Date</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-850 font-mono text-[11px]">{formatDate(record.openingDate)}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 tracking-wider">Expiry Date</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-850 font-mono text-[11px]">{formatDate(record.expiryDate)}</span>

                                                    {/* Divider */}
                                                    <div className="col-span-3 h-[1px] bg-gray-200/60 my-1"></div>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Importer</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-bold text-gray-850 break-words text-[11px]">{record.importerName}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exporter</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-850 break-words text-[11px]">{record.exporterName}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bank</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-850 break-words text-[11px]">{record.bankName}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-semibold text-gray-850 break-words text-[11px]">{displayPort}</span>

                                                    {/* Divider */}
                                                    <div className="col-span-3 h-[1px] bg-gray-200/60 my-1"></div>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <div className="font-bold text-gray-900 break-words text-[11px]">
                                                         {record.productsList && record.productsList.length > 0 ? (
                                                             <div className="flex flex-col gap-0.5">
                                                                 {record.productsList.map((p, idx) => (
                                                                     <div key={idx} className="break-words">
                                                                         {p.productName}
                                                                     </div>
                                                                 ))}
                                                             </div>
                                                         ) : (
                                                             <span className="break-words block">{record.productName || '-'}</span>
                                                         )}
                                                     </div>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quantity</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <div className="text-[11px]">
                                                        <span className="font-bold text-gray-900">{adj.adjustedQtyKg.toLocaleString('en-US')}</span> <span className="text-[10px] text-gray-400 font-normal ml-0.5">Kg</span>
                                                    </div>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Value</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="font-black text-gray-955 text-[11px]">৳{adj.adjustedTotalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>

                                                    {/* Divider */}
                                                    <div className="col-span-3 h-[1px] bg-gray-200/60 my-1"></div>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Balance</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className={`font-black text-[11px] ${combinedRemKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                        {combinedRemKg.toLocaleString('en-IN')} <span className="text-[10px] text-gray-400 font-medium ml-0.5">Kg</span>
                                                    </span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expense</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className={`font-black text-[11px] ${totalExpense > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                                        {totalExpense > 0 ? `৳${totalExpense.toLocaleString('en-IN')}` : '—'}
                                                    </span>
                                                </div>

                                                {/* Expanded details (LC Bill and Amendment Bill Charges) */}
                                                {isExpanded && (
                                                    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                        {/* Radio Button for Enable Value and Quantity (Mobile) */}
                                                        {record.piNo && record.quantity && record.totalAmount && (
                                                            <div className="flex items-center gap-3 py-1 px-2.5 bg-blue-50/50 rounded-xl border border-blue-100/30 flex-wrap">
                                                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Adjust Qty & Val:</span>
                                                                <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] font-bold text-gray-700">
                                                                    <input
                                                                        type="radio"
                                                                        name={`adjust-mobile-${record._id}`}
                                                                        checked={!!record.enableValueQtyAdjustment}
                                                                        onChange={() => handleToggleValueQtyAdjustment(record, true)}
                                                                        className="w-3 h-3 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    Enable
                                                                </label>
                                                                <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] font-bold text-gray-700">
                                                                    <input
                                                                        type="radio"
                                                                        name={`adjust-mobile-${record._id}`}
                                                                        checked={!record.enableValueQtyAdjustment}
                                                                        onChange={() => handleToggleValueQtyAdjustment(record, false)}
                                                                        className="w-3 h-3 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    Disable
                                                                </label>
                                                                {record.enableValueQtyAdjustment && (
                                                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-200/50 rounded text-[9px] font-extrabold uppercase tracking-wide">
                                                                        {(() => {
                                                                            const addedPercent = adj.openingQtyKg > 0 ? (adj.actualAdjustmentQtyKg / adj.openingQtyKg) * 100 : 0;
                                                                            return `${addedPercent.toFixed(2)}% added`;
                                                                        })()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* New LC Bill Charges */}
                                                        <div className="space-y-2">
                                                            <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-b border-blue-50 pb-1.5 flex items-center justify-between">
                                                                <span>New LC Bill Charges</span>
                                                            </h4>

                                                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-left">
                                                                {(() => {
                                                                    const isRecordLcBillActive = record.lcBillEnabled !== undefined
                                                                        ? record.lcBillEnabled
                                                                        : !!(record.bankLcCommission || record.bankSwiftCharge || record.bankLcApplicationForm || record.bankMpCharge || record.bankStampCharge);
                                                                    return (
                                                                        <>
                                                                            {isRecordLcBillActive && (
                                                                                <>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">LC Commission</span>
                                                                                        <p className="text-xs font-black text-gray-800">{record.bankLcCommission ? `${record.bankLcCommission}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">VAT on Comm.</span>
                                                                                        <p className="text-xs font-black text-gray-800">{record.bankVatOnCommission ? `${record.bankVatOnCommission}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">SWIFT Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">
                                                                                            {record.bankSwiftCharge !== undefined && record.bankSwiftCharge !== '' ? `৳${parseFloat(record.bankSwiftCharge).toLocaleString('en-IN')}` : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">VAT on SWIFT</span>
                                                                                        <p className="text-xs font-black text-gray-800">{record.bankVatOnSwiftCharge ? `${record.bankVatOnSwiftCharge}%` : '-'}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">LC App Form</span>
                                                                                        <p className="text-xs font-black text-gray-850">
                                                                                            {record.bankLcApplicationForm !== undefined && record.bankLcApplicationForm !== '' ? `৳${parseFloat(record.bankLcApplicationForm).toLocaleString('en-IN')}` : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">MP Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">
                                                                                            {record.bankMpCharge !== undefined && record.bankMpCharge !== '' ? `৳${parseFloat(record.bankMpCharge).toLocaleString('en-IN')}` : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Stamp Charge</span>
                                                                                        <p className="text-xs font-black text-gray-800">
                                                                                            {record.bankStampCharge !== undefined && record.bankStampCharge !== '' ? `৳${parseFloat(record.bankStampCharge).toLocaleString('en-IN')}` : '-'}
                                                                                        </p>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                            <div>
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Margin</span>
                                                                                <p className="text-xs font-black text-gray-800">{record.bankMargin ? `${record.bankMargin}%` : '-'}</p>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Margin Bill</span>
                                                                                <p className="text-xs font-black text-blue-600">
                                                                                    {record.marginBill ? `৳${parseFloat(record.marginBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Margin Paid</span>
                                                                                <p className="text-xs font-black text-blue-600">
                                                                                    {record.marginPaid !== undefined && record.marginPaid !== ''
                                                                                        ? `৳${parseFloat(record.marginPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                                        : (() => {
                                                                                            const totalAmount = adj.adjustedTotalAmount;
                                                                                            const margin = parseFloat(record.bankMargin) || 0;
                                                                                            const mp = totalAmount * (margin / 100);
                                                                                            return mp > 0 ? `৳${mp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                                                                                        })()
                                                                                    }
                                                                                </p>
                                                                            </div>
                                                                            {isRecordLcBillActive && (
                                                                                <div>
                                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Bank Bill</span>
                                                                                    <p className="text-xs font-black text-rose-600">
                                                                                        {record.bankBill ? `৳${parseFloat(record.bankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            <div>
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Bank Bill</span>
                                                                                <p className="text-xs font-black text-blue-600">
                                                                                    {record.totalBankBill ? `৳${parseFloat(record.totalBankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                </p>
                                                                            </div>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>

                                                        {/* Amendment Bill Charges */}
                                                        {record.amendments && record.amendments.filter(amnd => amnd.amendmentNo !== 'Original LC').length > 0 && (
                                                            <div className="space-y-2">
                                                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-1.5">
                                                                    <span>Amendment Bill Charges</span>
                                                                </h4>
                                                                <div className="space-y-3">
                                                                    {record.amendments
                                                                        .filter(amnd => amnd.amendmentNo !== 'Original LC')
                                                                        .map((amnd, index) => {
                                                                            const isAmndBillActive = amnd.amendmentLcBillEnabled !== undefined
                                                                                ? amnd.amendmentLcBillEnabled
                                                                                : !!(amnd.amendmentCommission || amnd.amendmentSwiftCharge);

                                                                            const swiftCharge = isAmndBillActive ? (parseFloat(amnd.amendmentSwiftCharge) || 0) : 0;
                                                                            const vatOnSwift = isAmndBillActive ? (parseFloat(amnd.amendmentVatOnSwift) || 0) : 0;
                                                                            const vatOnSwiftAmt = swiftCharge * (vatOnSwift / 100);

                                                                            const bankBill = isAmndBillActive ? (parseFloat(amnd.amendmentBankBill || amnd.amendmentBill) || 0) : 0;
                                                                            const vatOnCommission = isAmndBillActive ? (parseFloat(amnd.amendmentVatOnCommission) || 0) : 0;
                                                                            const commissionTotal = Math.max(0, bankBill - swiftCharge - vatOnSwiftAmt);
                                                                            const commissionAmt = commissionTotal / (1 + vatOnCommission / 100);
                                                                            const vatOnCommissionAmt = commissionTotal - commissionAmt;

                                                                            return (
                                                                                <div key={index} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl space-y-2 text-xs">
                                                                                    <div className="flex justify-between items-center border-b border-gray-200/50 pb-1">
                                                                                        <span className="font-black text-indigo-600 uppercase">
                                                                                            {amnd.amendmentNo || `Amendment-${String(index + 1).padStart(2, '0')}`}
                                                                                        </span>
                                                                                        {amnd.amendmentDate && (
                                                                                            <span className="font-semibold text-gray-500 font-mono">
                                                                                                {formatDate(amnd.amendmentDate)}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                                                                                        {isAmndBillActive && amnd.amendmentCommission && parseFloat(amnd.amendmentCommission) > 0 && (
                                                                                            <div>
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Commission ({amnd.amendmentCommission || 0}%)</span>
                                                                                                <p className="text-xs font-black text-gray-800">৳{Math.round(commissionAmt).toLocaleString('en-IN')}</p>
                                                                                            </div>
                                                                                        )}
                                                                                        {isAmndBillActive && amnd.amendmentVatOnCommission && parseFloat(amnd.amendmentVatOnCommission) > 0 && (
                                                                                            <div>
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">VAT on Comm. ({amnd.amendmentVatOnCommission || 0}%)</span>
                                                                                                <p className="text-xs font-black text-gray-800">৳{Math.round(vatOnCommissionAmt).toLocaleString('en-IN')}</p>
                                                                                            </div>
                                                                                        )}
                                                                                        {isAmndBillActive && amnd.amendmentSwiftCharge && parseFloat(amnd.amendmentSwiftCharge) > 0 && (
                                                                                            <div>
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">SWIFT Charge</span>
                                                                                                <p className="text-xs font-black text-gray-800">৳{parseFloat(amnd.amendmentSwiftCharge).toLocaleString('en-IN')}</p>
                                                                                            </div>
                                                                                        )}
                                                                                        {isAmndBillActive && amnd.amendmentVatOnSwift && parseFloat(amnd.amendmentVatOnSwift) > 0 && (
                                                                                            <div>
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">VAT on SWIFT ({amnd.amendmentVatOnSwift || 0}%)</span>
                                                                                                <p className="text-xs font-black text-gray-800">৳{Math.round(vatOnSwiftAmt).toLocaleString('en-IN')}</p>
                                                                                            </div>
                                                                                        )}
                                                                                        <div>
                                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Margin</span>
                                                                                            <p className="text-xs font-black text-gray-800">
                                                                                                {amnd.amendmentMargin !== undefined && amnd.amendmentMargin !== '' ? `${amnd.amendmentMargin}%` : (record.bankMargin ? `${record.bankMargin}%` : '-')}
                                                                                            </p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Margin Bill</span>
                                                                                            <p className="text-xs font-black text-blue-600">
                                                                                                {amnd.amendmentMarginBill ? `৳${parseFloat(amnd.amendmentMarginBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                            </p>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Margin Paid</span>
                                                                                            <p className="text-xs font-black text-blue-600">
                                                                                                {amnd.amendmentMarginPaid !== undefined && amnd.amendmentMarginPaid !== ''
                                                                                                    ? `৳${parseFloat(amnd.amendmentMarginPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                                                                    : (() => {
                                                                                                        const margin = amnd.amendmentMargin !== undefined ? (parseFloat(amnd.amendmentMargin) || 0) : (record.bankMargin !== undefined ? parseFloat(record.bankMargin) : 0);
                                                                                                        const mb = parseFloat(amnd.amendmentMarginBill) || 0;
                                                                                                        const mp = mb * (margin / 100);
                                                                                                        return mp > 0 ? `৳${mp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';
                                                                                                    })()
                                                                                                }
                                                                                            </p>
                                                                                        </div>
                                                                                        {isAmndBillActive && amnd.amendmentBankBill && parseFloat(amnd.amendmentBankBill) > 0 && (
                                                                                            <div>
                                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Amendment Bill</span>
                                                                                                <p className="text-xs font-black text-rose-600">৳{parseFloat(amnd.amendmentBankBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                                                                            </div>
                                                                                        )}
                                                                                        <div>
                                                                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Bill</span>
                                                                                            <p className="text-xs font-black text-blue-600">
                                                                                                {(amnd.totalAmendmentBankBill || amnd.amendmentBill) ? `৳${parseFloat(amnd.totalAmendmentBankBill || amnd.amendmentBill).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Card Footer: Action buttons and Collapse trigger */}
                                                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedLcKey(prev => prev === record._id ? null : record._id);
                                                        }}
                                                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                                                    >
                                                        {isExpanded ? (
                                                            <>
                                                                <ChevronUpIcon className="w-4 h-4" />
                                                                Hide Charges
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDownIcon className="w-4 h-4" />
                                                                Show Charges
                                                            </>
                                                        )}
                                                    </button>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewData(record); }}
                                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="View Details"
                                                        >
                                                            <EyeIcon className="w-4.5 h-4.5" />
                                                        </button>
                                                        {canManage && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                                                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                                    title="Edit Record"
                                                                >
                                                                    <EditIcon className="w-4.5 h-4.5" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(record._id); }}
                                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                                    title="Delete Record"
                                                                >
                                                                    <TrashIcon className="w-4.5 h-4.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center text-gray-400 font-medium italic bg-white/50 border border-gray-100 rounded-2xl shadow-sm">
                                No LC records found
                            </div>
                        )}
                    </div>
                </>
            )}
            {viewData && (
                <ViewDetailsModal
                    data={viewData}
                    onClose={() => setViewData(null)}
                    allStockRecords={allStockRecords}
                    allSalesRecords={allSalesRecords}
                    gpRecords={gpRecords}
                    lcExpenses={lcExpenses}
                    piRecordsRaw={piRecordsRaw}
                    onEdit={handleEdit}
                    onEditAmendment={handleEditAmendment}
                    canManage={canManage}
                    onRefresh={fetchInitialData}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"></div>
                    <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-300">
                        {deleteStatus === 'success' ? (
                            <div className="p-12 text-center">
                                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
                                    <CheckIcon className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">Deleted!</h3>
                                <p className="text-sm text-gray-500">The LC record has been removed.</p>
                            </div>
                        ) : (
                            <div className="p-8">
                                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto rotate-3">
                                    <TrashIcon className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 text-center mb-2">Delete Record?</h3>
                                <p className="text-sm text-gray-500 text-center mb-8">Are you sure you want to delete this LC record? This action cannot be undone.</p>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setIdToDelete(null);
                                        }}
                                        className="py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all active:scale-95"
                                        disabled={deleteStatus === 'loading'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="py-3.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        disabled={deleteStatus === 'loading'}
                                    >
                                        {deleteStatus === 'loading' ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            'Delete Now'
                                        )}
                                    </button>
                                </div>
                                {deleteStatus === 'error' && (
                                    <p className="text-center text-xs font-bold text-red-500 mt-4 animate-bounce">Failed to delete record. Please try again.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LCManagement;
