import React from 'react';
import axios from './api';
import { ChevronUpIcon, ChevronDownIcon } from '../components/Icons';

// Set axios defaults for session handling
axios.defaults.withCredentials = true;

// API Base URL - In development Vite proxies this; in production Nginx proxies this.
export const API_BASE_URL = '';

// Date Formatting Utilities
export const formatDate = (dateString) => {
    if (!dateString) return '-';

    // If it's a simple YYYY-MM-DD string, handle it directly
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    }

    // Otherwise, try to create a Date object and format it
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

export const parseDate = (dateString) => {
    if (!dateString) return new Date();
    if (typeof dateString === 'string' && dateString.includes('-')) {
        const [y, m, d] = dateString.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    return new Date(dateString);
};

export const getLocalDateString = (d = new Date()) => {
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Sort Icon Component
export const SortIcon = ({ config, columnKey }) => {
    if (!config || config.key !== columnKey) {
        return <div className="w-4 h-4 ml-1 opacity-20"><ChevronDownIcon className="w-4 h-4" /></div>;
    }
    return config.direction === 'asc'
        ? <ChevronUpIcon className="w-4 h-4 ml-1 text-blue-600" />
        : <ChevronDownIcon className="w-4 h-4 ml-1 text-blue-600" />;
};

// Robust ISO date converter for universal date comparisons (handles YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO strings, Date objects)
export const getIsoDateString = (val) => {
    if (!val) return '';
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return '';
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (!str) return '';

    // Match YYYY-MM-DD or YYYY/MM/DD (with optional time)
    const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd) {
        return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }

    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }

    // Fallback Date parser
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return '';
};

// Calculate exact customer final balance across sales, payments, payToCustomer, and purchases/purchaseReceives
export const computeCustomerBalance = (c, { salesRecords = [], purchasesList = [], purchaseReceivesList = [], stockList = [], asOfDate = null } = {}) => {
    if (!c) return 0;
    const targetCutoff = asOfDate ? getIsoDateString(asOfDate) : null;

    const resolvePurchaseItem = (p, item, b) => {
        const pNo = (p?.purchaseNo || p?.invoiceNo || 'PUR-0000').trim().toUpperCase();
        const pName = (item?.productName || item?.product || p?.productName || p?.product || '').trim().toLowerCase();
        const bName = (b?.brand || p?.brand || '').trim().toLowerCase();

        const matchingStocks = (stockList || []).filter(s =>
            (s.status || '').toLowerCase() === 'accepted' &&
            ((s.lcNo || '').trim().toUpperCase() === pNo || (s.purchaseNo || '').trim().toUpperCase() === pNo) &&
            (!pName || (s.productName || s.product || '').trim().toLowerCase() === pName) &&
            (!bName || (s.brand || '').trim().toLowerCase() === bName)
        );
        const totalStockQty = matchingStocks.reduce((sum, s) => sum + parseFloat((s.inHouseQuantity ?? s.quantity) || 0), 0);

        let prQty = 0;
        const matchingPRs = (purchaseReceivesList || []).filter(pr =>
            (pr.status || '').toLowerCase() === 'accepted' &&
            ((pr.purchaseNo || pr.purchaseReceiveNo || '').trim().toUpperCase() === pNo)
        );
        matchingPRs.forEach(matchedPR => {
            if (matchedPR && matchedPR.items) {
                matchedPR.items.forEach(prItem => {
                    if (!pName || (prItem.productName || prItem.product || '').trim().toLowerCase() === pName) {
                        (prItem.brandEntries || []).forEach(be => {
                            if (!bName || (be.brand || '').trim().toLowerCase() === bName) {
                                prQty += parseFloat((be.inHouseQuantity ?? be.inHouseQty ?? be.inhouseQty ?? be.qty) || 0);
                            }
                        });
                    }
                });
            }
        });

        const finalInHouseQty = matchingStocks.length > 0
            ? totalStockQty
            : (prQty > 0
                ? prQty
                : parseFloat((b?.inHouseQuantity ?? b?.inHouseQty ?? b?.inhouseQty ?? b?.qty ?? item?.qty ?? item?.quantity ?? p?.quantity ?? p?.qty) || 0));

        const rate = parseFloat((b?.rate ?? item?.rate ?? p?.rate) || 0);
        const origTotal = parseFloat((b?.total ?? item?.total ?? item?.amount ?? p?.totalAmount ?? p?.amount) || 0);
        const origQty = parseFloat((b?.qty ?? b?.quantity ?? item?.qty ?? item?.quantity ?? p?.quantity ?? p?.qty) || 0);
        const amount = (rate > 0 && finalInHouseQty > 0) ? (finalInHouseQty * rate) : (origQty > 0 ? (origTotal * (finalInHouseQty / origQty)) : origTotal);

        return { quantity: finalInHouseQty, rate, amount };
    };

    const sales = (c.salesHistory || []).filter(s => {
        if ((s.status || '').toLowerCase() === 'requested') return false;
        if (s.saleType === 'Order' || (s.invoiceNo || '').startsWith('ORD') || s.isOrderEntry === true) return false;
        if (targetCutoff) {
            const sDate = getIsoDateString(s.date);
            if (sDate && sDate >= targetCutoff) return false;
        }
        return true;
    }).map(s => {
        let updatedS = { ...s };
        if (salesRecords && salesRecords.length > 0) {
            const itemInv = (s.invoiceNo || '').trim().toUpperCase();
            const itemOrd = (s.orderNo || '').trim().toUpperCase();
            const matchingSale = salesRecords.find(sale => {
                const sInv = (sale.invoiceNo || '').trim().toUpperCase();
                const sOrd = (sale.orderNo || '').trim().toUpperCase();
                return (itemInv && (sInv === itemInv || sOrd === itemInv)) ||
                    (itemOrd && (sInv === itemOrd || sOrd === itemOrd));
            });

            if (matchingSale) {
                const pName = (s.product || s.productName || '').trim().toLowerCase();
                const bName = (s.brand || s.brandName || '').trim().toLowerCase();
                let latestRate = null;

                (matchingSale.items || []).forEach(si => {
                    const siProd = (si.productName || si.product || '').trim().toLowerCase();
                    if (!pName || siProd === pName) {
                        if (si.brandEntries && si.brandEntries.length > 0) {
                            si.brandEntries.forEach(be => {
                                const beBrand = (be.brand || be.brandName || '').trim().toLowerCase();
                                if (!bName || beBrand === bName) {
                                    const r = parseFloat(be.rate !== undefined && be.rate !== null && be.rate !== '' ? be.rate : be.unitPrice) || 0;
                                    if (r > 0) latestRate = r;
                                }
                            });
                        } else {
                            const r = parseFloat(si.rate !== undefined && si.rate !== null && si.rate !== '' ? si.rate : si.unitPrice) || 0;
                            if (r > 0) latestRate = r;
                        }
                    }
                });

                if (latestRate && Math.abs((parseFloat(s.rate) || 0) - latestRate) > 0.001) {
                    const qty = parseFloat(s.quantity || s.qty) || 0;
                    const bag = parseFloat(s.bag || s.packet) || 0;
                    const isBagUom = (s.uom || c?.uom || '').toLowerCase() === 'bag';
                    const newAmt = isBagUom && bag > 0 ? (bag * latestRate) : (qty * latestRate);
                    const disc = parseFloat(s.discount) || 0;
                    const paid = parseFloat(s.paid) || 0;
                    updatedS.rate = latestRate;
                    updatedS.amount = Number(newAmt.toFixed(2));
                    updatedS.due = Number(Math.max(0, newAmt - disc - paid).toFixed(2));
                }
            }
        }
        return {
            ...updatedS,
            type: 'sale',
            sortDate: s.date
        };
    });

    const payments = (c.paymentHistory || []).filter(p => {
        if ((p.status || '').toLowerCase() === 'requested') return false;
        if (targetCutoff) {
            const pDate = getIsoDateString(p.date);
            if (pDate && pDate >= targetCutoff) return false;
        }
        return true;
    }).map(p => ({
        ...p,
        type: 'payment',
        sortDate: p.date
    }));

    const payouts = (c.payToCustomerHistory || []).filter(pc => {
        if ((pc.status || '').toLowerCase() === 'requested') return false;
        if (targetCutoff) {
            const pcDate = getIsoDateString(pc.date);
            if (pcDate && pcDate >= targetCutoff) return false;
        }
        return true;
    }).map(pc => ({
        ...pc,
        type: 'payToCustomer',
        sortDate: pc.date
    }));

    let prEntries = [];
    let coveredPurchaseNos = new Set();
    if (purchaseReceivesList && purchaseReceivesList.length > 0) {
        const matchedPRs = purchaseReceivesList.filter(pr => {
            if ((pr.status || '').toLowerCase() === 'requested') return false;
            if (targetCutoff) {
                const prDate = getIsoDateString(pr.date);
                if (prDate && prDate >= targetCutoff) return false;
            }
            const sName = (pr.supplierName || pr.companyName || '').trim().toLowerCase();
            const cComp = (c?.companyName || '').trim().toLowerCase();
            const cCust = (c?.customerName || '').trim().toLowerCase();
            return (
                pr.customerId === c?._id ||
                pr.customerId === c?.customerId ||
                (cComp && (sName === cComp || sName.includes(cComp) || cComp.includes(sName))) ||
                (cCust && (sName === cCust || sName.includes(cCust) || cCust.includes(sName)))
            );
        });

        prEntries = matchedPRs.flatMap(pr => {
            const pNo = pr.purchaseNo || pr.purchaseReceiveNo || 'PUR-0000';
            if (pr.items && Array.isArray(pr.items)) {
                return pr.items.flatMap(item => {
                    if (item.brandEntries && Array.isArray(item.brandEntries)) {
                        return item.brandEntries.map(b => {
                            const q = parseFloat((b.inHouseQuantity ?? b.inHouseQty ?? b.inhouseQty ?? b.qty) || 0);
                            const r = parseFloat(b.rate || 0);
                            const amt = b.total ? parseFloat(b.total) : (q * r);
                            return {
                                _id: `${pr._id}-${item.productName}-${b.brand}`,
                                purchaseNo: pNo,
                                invoiceNo: pNo,
                                date: pr.date,
                                product: item.productName || item.product,
                                brand: b.brand,
                                quantity: q,
                                rate: r,
                                amount: amt,
                                discount: pr.discount || 0,
                                paid: pr.paid || pr.paidAmount || 0,
                                warehouse: pr.warehouse || item.warehouse || '-',
                                status: pr.status || 'Accepted',
                                type: 'purchase',
                                sortDate: pr.date
                            };
                        });
                    }
                    const q = parseFloat((item.inHouseQuantity ?? item.inHouseQty ?? item.qty) || 0);
                    const r = parseFloat(item.rate || 0);
                    const amt = item.total ? parseFloat(item.total) : (q * r);
                    return [{
                        _id: `${pr._id}-${item.productName}`,
                        purchaseNo: pNo,
                        invoiceNo: pNo,
                        date: pr.date,
                        product: item.productName || item.product,
                        brand: item.brand || '-',
                        quantity: q,
                        rate: r,
                        amount: amt,
                        discount: pr.discount || 0,
                        paid: pr.paid || pr.paidAmount || 0,
                        warehouse: pr.warehouse || item.warehouse || '-',
                        status: pr.status || 'Accepted',
                        type: 'purchase',
                        sortDate: pr.date
                    }];
                });
            }
            return [];
        });

        coveredPurchaseNos = new Set(prEntries.map(e => (e.purchaseNo || '').trim().toUpperCase()));
    }

    const matchedPurchases = (purchasesList || []).filter(p => {
        if ((p.status || '').toLowerCase() === 'requested') return false;
        if (targetCutoff) {
            const pDate = getIsoDateString(p.date);
            if (pDate && pDate >= targetCutoff) return false;
        }
        const pNo = (p.purchaseNo || p.invoiceNo || '').trim().toUpperCase();
        if (pNo && coveredPurchaseNos.has(pNo)) return false;

        return (
            p.customerId === c?._id ||
            p.customerId === c?.customerId ||
            (p.companyName && p.companyName.toLowerCase() === (c?.companyName || '').toLowerCase()) ||
            (p.customerName && p.customerName.toLowerCase() === (c?.customerName || '').toLowerCase()) ||
            (p.supplierName && (
                p.supplierName.toLowerCase() === (c?.companyName || '').toLowerCase() ||
                p.supplierName.toLowerCase() === (c?.customerName || '').toLowerCase()
            ))
        );
    }).flatMap(p => {
        if (p.items && Array.isArray(p.items)) {
            return p.items.flatMap(item => {
                if (item.brandEntries && Array.isArray(item.brandEntries)) {
                    return item.brandEntries.map(b => {
                        const res = resolvePurchaseItem(p, item, b);
                        return {
                            amount: res.amount,
                            discount: p.discount || 0,
                            paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                            type: 'purchase',
                            sortDate: p.date
                        };
                    });
                }
                const res = resolvePurchaseItem(p, item, null);
                return [{
                    amount: res.amount,
                    discount: p.discount || 0,
                    paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                    type: 'purchase',
                    sortDate: p.date
                }];
            });
        }
        const res = resolvePurchaseItem(p, null, null);
        return [{
            amount: res.amount,
            discount: p.discount || 0,
            paid: p.paid || p.paidAmount || 0,
            type: 'purchase',
            sortDate: p.date
        }];
    });

    const purchases = prEntries.length > 0 ? prEntries : matchedPurchases;
    const all = [...sales, ...payments, ...payouts, ...purchases].sort(compareTransactions);

    let currentBalance = 0;
    all.forEach(item => {
        if (item.type === 'sale') {
            const amt = parseFloat(item.amount) || 0;
            const pd = parseFloat(item.paid) || 0;
            const disc = parseFloat(item.discount) || 0;
            currentBalance += (amt - pd - disc);
        } else if (item.type === 'payment') {
            const amt = parseFloat(item.amount) || 0;
            const disc = parseFloat(item.discount) || 0;
            currentBalance -= (amt + disc);
        } else if (item.type === 'payToCustomer') {
            const amt = parseFloat(item.amount) || 0;
            currentBalance += amt;
        } else if (item.type === 'purchase') {
            const amt = parseFloat(item.amount) || 0;
            const pd = parseFloat(item.paid) || 0;
            const disc = parseFloat(item.discount) || 0;
            currentBalance -= (amt - pd - disc);
        }
    });

    return currentBalance;
};

// Helper to extract timestamp from createdAt, timestamp ID, or date
export const getItemTimestamp = (item) => {
    if (!item) return 0;
    if (item.createdAt) {
        const t = new Date(item.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
    }
    const idStr = String(item.id || item._id || '');
    if (idStr) {
        const matchTime = idStr.match(/^(\d{12,14})/);
        if (matchTime) {
            const t = parseInt(matchTime[1], 10);
            if (!isNaN(t) && t > 1500000000000) return t;
        }
        if (/^[0-9a-fA-F]{24}$/.test(idStr)) {
            const sec = parseInt(idStr.substring(0, 8), 16);
            if (!isNaN(sec) && sec > 1500000000) return sec * 1000;
        }
    }
    if (item.date) {
        const t = new Date(item.date).getTime();
        if (!isNaN(t)) return t;
    }
    return 0;
};

// Comparator to sort transactions chronologically (by calendar date, then precise creation timestamp)
export const compareTransactions = (a, b) => {
    const aDateStr = getIsoDateString(a.date || a.sortDate);
    const bDateStr = getIsoDateString(b.date || b.sortDate);
    if (aDateStr !== bDateStr) {
        if (!aDateStr) return -1;
        if (!bDateStr) return 1;
        return aDateStr.localeCompare(bDateStr);
    }
    const aTime = getItemTimestamp(a);
    const bTime = getItemTimestamp(b);
    return aTime - bTime;
};


