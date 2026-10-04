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
    if (typeof dateString === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [year, month, day] = dateString.split('-');
            return `${day}/${month}/${year}`;
        }
        if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(dateString)) {
            return dateString;
        }
    }

    // Otherwise, try to create a Date object and format it
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (isNaN(date.getTime())) {
        if (typeof dateString === 'string' && dateString.trim() !== '') {
            return dateString;
        }
        return '-';
    }

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

// Helper to extract matching return records for a customer
export const getCustomerReturns = (c, returnsList = [], salesRecords = []) => {
    if (!c) return [];
    const cId = String(c._id || '');
    const cCustId = (c.customerId || '').trim().toLowerCase();
    const cComp = (c.companyName || '').trim().toLowerCase();
    const cCust = (c.customerName || '').trim().toLowerCase();
    const cPhone = (c.phone || '').trim();

    const custInvoices = new Set();
    (c.salesHistory || []).forEach(s => {
        if (s.invoiceNo) custInvoices.add(s.invoiceNo.trim().toUpperCase());
        if (s.lcNo) custInvoices.add(s.lcNo.trim().toUpperCase());
    });

    return (returnsList || []).filter(r => {
        if ((r.status || '').toLowerCase() === 'requested' || (r.status || '').toLowerCase() === 'cancelled') return false;

        const rId = String(r.customerId || '');
        if (cId && rId && rId === cId) return true;
        if (cCustId && (r.customerId || '').trim().toLowerCase() === cCustId) return true;

        const rInv = (r.invoiceNo || '').trim().toUpperCase();
        if (rInv && custInvoices.has(rInv)) return true;

        const rComp = (r.companyName || '').trim().toLowerCase();
        if (cComp && rComp && (rComp === cComp || rComp.includes(cComp) || cComp.includes(rComp))) return true;

        const rCust = (r.customerName || '').trim().toLowerCase();
        if (cComp && rComp && (rComp === cComp || rComp.includes(cComp) || cComp.includes(rComp)) &&
            cCust && rCust && (rCust === cCust || rCust.includes(cCust) || cCust.includes(rCust))) return true;

        const rPhone = (r.phone || '').trim();
        if (cPhone && rPhone && cPhone === rPhone && cPhone !== '+8800000000000') return true;

        return false;
    }).map(r => {
        let rate = parseFloat(r.returnPrice || r.rate || r.unitPrice) || 0;
        const qty = parseFloat(r.quantity) || 0;
        if (!rate && r.invoiceNo) {
            const originalSale = (salesRecords || []).find(s => (s.invoiceNo || '').trim().toUpperCase() === (r.invoiceNo || '').trim().toUpperCase());
            if (originalSale && originalSale.items) {
                const item = originalSale.items.find(i => (i.productName || i.product || '').trim().toLowerCase() === (r.productName || r.product || '').trim().toLowerCase());
                if (item) {
                    if (item.brandEntries && item.brandEntries.length > 0) {
                        const be = item.brandEntries.find(b => (b.brandName || b.brand || '').trim().toLowerCase() === (r.brand || '').trim().toLowerCase());
                        if (be) rate = parseFloat(be.unitPrice || be.rate) || 0;
                    } else {
                        rate = parseFloat(item.unitPrice || item.rate) || 0;
                    }
                }
            } else if (originalSale) {
                rate = parseFloat(originalSale.rate || originalSale.unitPrice) || 0;
            }
        }
        const amt = parseFloat(r.amount) || (rate * qty);
        const expense = parseFloat(r.returnExpense || r.expense || 0);
        return {
            ...r,
            _id: r._id,
            invoiceNo: r.invoiceNo,
            date: r.date,
            product: r.productName || r.product || 'Product Return',
            brand: r.brand || '-',
            quantity: qty,
            rate: rate,
            amount: amt,
            returnExpense: expense,
            paid: 0,
            discount: 0,
            type: 'return',
            sortDate: r.date
        };
    });
};

// Pre-build index for fast O(1) customer balance calculations
export const buildCustomerBalanceIndex = (salesRecords = [], purchasesList = [], purchaseReceivesList = []) => {
    const saleByInvOrOrd = new Map();
    const salesByCustId = new Map();
    const salesByComp = new Map();

    for (let i = 0; i < (salesRecords || []).length; i++) {
        const s = salesRecords[i];
        if (!s) continue;
        const inv = (s.invoiceNo || '').trim().toUpperCase();
        const ord = (s.orderNo || '').trim().toUpperCase();
        if (inv) saleByInvOrOrd.set(inv, s);
        if (ord && !saleByInvOrOrd.has(ord)) saleByInvOrOrd.set(ord, s);

        const sType = (s.saleType || '').toLowerCase();
        if (sType === 'order' || inv.startsWith('ORD') || s.isOrderEntry === true) continue;
        if ((s.status || '').toLowerCase() === 'requested' || (s.status || '').toLowerCase() === 'rejected') continue;

        const sCustId = (s.customerId || s.customer?._id || '').toString().trim();
        const sComp = (s.companyName || '').trim().toLowerCase();

        if (sCustId) {
            let list = salesByCustId.get(sCustId);
            if (!list) { list = []; salesByCustId.set(sCustId, list); }
            list.push(s);
        }
        if (sComp) {
            let list = salesByComp.get(sComp);
            if (!list) { list = []; salesByComp.set(sComp, list); }
            list.push(s);
        }
    }

    return {
        saleByInvOrOrd,
        salesByCustId,
        salesByComp,
        purchasesList,
        purchaseReceivesList
    };
};

// Calculate exact customer final balance across sales, payments, payToCustomer, purchases/purchaseReceives, and returns
export const computeCustomerBalance = (c, { salesRecords = [], purchasesList = [], purchaseReceivesList = [], stockList = [], asOfDate = null, returnsList = [], index = null } = {}) => {
    if (!c) return 0;
    const targetCutoff = asOfDate ? getIsoDateString(asOfDate) : null;

    const idx = index || buildCustomerBalanceIndex(salesRecords, purchasesList, purchaseReceivesList);
    const { saleByInvOrOrd, salesByCustId, salesByComp } = idx;

    const targetId = (c?._id || c?.customerId || '').toString().trim();
    const vComp = (c?.companyName || '').trim().toLowerCase();
    const cCust = (c?.customerName || '').trim().toLowerCase();
    const cCode = (c?.customerId || '').toString().trim().toLowerCase();

    // 1. Sales from customer's salesHistory
    let salesBalance = 0;
    const existingInvoices = new Set();

    const salesHistory = c.salesHistory || [];
    for (let i = 0; i < salesHistory.length; i++) {
        const s = salesHistory[i];
        if ((s.status || '').toLowerCase() === 'requested' || (s.status || '').toLowerCase() === 'rejected') continue;
        if (s.saleType === 'Order' || (s.invoiceNo || '').startsWith('ORD') || s.isOrderEntry === true) continue;
        if (targetCutoff) {
            const sDate = getIsoDateString(s.date);
            if (sDate && sDate >= targetCutoff) continue;
        }

        const itemInv = (s.invoiceNo || '').trim().toUpperCase();
        const itemOrd = (s.orderNo || '').trim().toUpperCase();
        if (itemInv) existingInvoices.add(itemInv);

        let finalRate = parseFloat(s.rate) || 0;
        let finalAmount = parseFloat(s.amount) || 0;
        const finalPaid = parseFloat(s.paid) || 0;
        const finalDiscount = parseFloat(s.discount) || 0;

        if (saleByInvOrOrd && saleByInvOrOrd.size > 0) {
            const matchingSale = (itemInv ? saleByInvOrOrd.get(itemInv) : null) || (itemOrd ? saleByInvOrOrd.get(itemOrd) : null);
            if (matchingSale) {
                const sCustId = (matchingSale.customerId || matchingSale.customer?._id || '').toString().trim();
                const sComp = (matchingSale.companyName || '').trim().toLowerCase();

                const idMatch = Boolean(targetId && sCustId && (targetId === sCustId));
                const compMatch = Boolean(vComp && sComp && vComp === sComp);

                if ((sCustId || sComp) && !idMatch && !compMatch) {
                    continue; // Belongs to a different customer, exclude
                }

                const pName = (s.product || s.productName || '').trim().toLowerCase();
                const bName = (s.brand || s.brandName || '').trim().toLowerCase();
                const sQty = parseFloat(s.quantity || s.qty) || 0;
                const sRate = parseFloat(s.rate || 0);

                const candidateEntries = [];
                const mItems = matchingSale.items || [];
                for (let j = 0; j < mItems.length; j++) {
                    const si = mItems[j];
                    const siProd = (si.productName || si.product || '').trim().toLowerCase();
                    if (!pName || siProd === pName) {
                        if (si.brandEntries && si.brandEntries.length > 0) {
                            for (let k = 0; k < si.brandEntries.length; k++) {
                                const be = si.brandEntries[k];
                                const beBrand = (be.brand || be.brandName || '').trim().toLowerCase();
                                if (!bName || beBrand === bName) candidateEntries.push(be);
                            }
                        } else {
                            candidateEntries.push(si);
                        }
                    }
                }

                let matchedEntry = candidateEntries.find(entry => {
                    const eQty = parseFloat(entry.quantity || entry.qty) || 0;
                    return Math.abs(eQty - sQty) < 0.001;
                });
                if (!matchedEntry) {
                    matchedEntry = candidateEntries.find(entry => {
                        const r = parseFloat(entry.unitPrice !== undefined && entry.unitPrice !== null && entry.unitPrice !== '' ? entry.unitPrice : entry.rate) || 0;
                        return Math.abs(r - sRate) < 0.001;
                    });
                }
                if (!matchedEntry && candidateEntries.length === 1) {
                    matchedEntry = candidateEntries[0];
                }

                let latestRate = null;
                if (matchedEntry) {
                    const r = parseFloat(matchedEntry.unitPrice !== undefined && matchedEntry.unitPrice !== null && matchedEntry.unitPrice !== '' ? matchedEntry.unitPrice : matchedEntry.rate) || 0;
                    if (r > 0) latestRate = r;
                }

                if (latestRate && Math.abs(finalRate - latestRate) > 0.001) {
                    const qty = parseFloat(s.quantity || s.qty) || 0;
                    const bag = parseFloat(s.bag || s.packet) || 0;
                    const isBagUom = (s.uom || c?.uom || '').toLowerCase() === 'bag';
                    const newAmt = isBagUom && bag > 0 ? (bag * latestRate) : (qty * latestRate);
                    finalAmount = Number(newAmt.toFixed(2));
                }
            }
        }

        salesBalance += (finalAmount - finalPaid - finalDiscount);
    }

    // 2. Extra sales in salesRecords not yet in salesHistory
    const candidateSales = [];
    if (targetId && salesByCustId && salesByCustId.has(targetId)) {
        const list = salesByCustId.get(targetId);
        for (let i = 0; i < list.length; i++) candidateSales.push(list[i]);
    }
    if (vComp && salesByComp && salesByComp.has(vComp)) {
        const list = salesByComp.get(vComp);
        for (let i = 0; i < list.length; i++) {
            const cs = list[i];
            const sCustId = (cs.customerId || cs.customer?._id || '').toString().trim();
            if (!sCustId || sCustId === targetId) {
                if (!targetId || sCustId !== targetId) {
                    candidateSales.push(cs);
                }
            }
        }
    }

    for (let i = 0; i < candidateSales.length; i++) {
        const s = candidateSales[i];
        const sInv = (s.invoiceNo || '').trim().toUpperCase();
        if (existingInvoices.has(sInv)) continue;
        if (targetCutoff) {
            const sDate = getIsoDateString(s.date);
            if (sDate && sDate >= targetCutoff) continue;
        }

        existingInvoices.add(sInv);

        const items = s.items && Array.isArray(s.items) ? s.items : [];
        if (items.length > 0) {
            for (let pIdx = 0; pIdx < items.length; pIdx++) {
                const product = items[pIdx];
                const brandEntries = product.brandEntries && Array.isArray(product.brandEntries) ? product.brandEntries : [];
                if (brandEntries.length > 0) {
                    for (let eIdx = 0; eIdx < brandEntries.length; eIdx++) {
                        const entry = brandEntries[eIdx];
                        const isFirstEntry = pIdx === 0 && eIdx === 0;
                        const qty = parseFloat(entry.quantity) || 0;
                        const rate = parseFloat(entry.unitPrice !== undefined && entry.unitPrice !== null && entry.unitPrice !== '' ? entry.unitPrice : (entry.rate || 0)) || 0;
                        const amt = parseFloat(entry.totalAmount || entry.amount) || (qty * rate);
                        const paid = isFirstEntry ? (parseFloat(s.paidAmount || s.paid) || 0) : 0;
                        const discount = isFirstEntry ? (parseFloat(s.discount) || 0) : 0;
                        salesBalance += (amt - paid - discount);
                    }
                } else {
                    const isFirstEntry = pIdx === 0;
                    const qty = parseFloat(product.quantity || s.quantity) || 0;
                    const rate = parseFloat(product.unitPrice || product.rate || s.unitPrice || 0) || 0;
                    const amt = parseFloat(product.totalAmount || product.amount) || (qty * rate);
                    const paid = isFirstEntry ? (parseFloat(s.paidAmount || s.paid) || 0) : 0;
                    const discount = isFirstEntry ? (parseFloat(s.discount) || 0) : 0;
                    salesBalance += (amt - paid - discount);
                }
            }
        }
    }

    // 3. Payments
    let paymentsBalance = 0;
    const paymentHistory = c.paymentHistory || [];
    for (let i = 0; i < paymentHistory.length; i++) {
        const p = paymentHistory[i];
        if ((p.status || '').toLowerCase() === 'requested') continue;
        if (targetCutoff) {
            const pDate = getIsoDateString(p.date);
            if (pDate && pDate >= targetCutoff) continue;
        }
        const amt = parseFloat(p.amount) || 0;
        const disc = parseFloat(p.discount) || 0;
        paymentsBalance += (amt + disc);
    }

    // 4. Pay to Customer
    let payoutsBalance = 0;
    const payToCustomerHistory = c.payToCustomerHistory || [];
    for (let i = 0; i < payToCustomerHistory.length; i++) {
        const pc = payToCustomerHistory[i];
        if ((pc.status || '').toLowerCase() === 'requested') continue;
        if (targetCutoff) {
            const pcDate = getIsoDateString(pc.date);
            if (pcDate && pcDate >= targetCutoff) continue;
        }
        payoutsBalance += (parseFloat(pc.amount) || 0);
    }

    // 5. Purchases & Purchase Receives
    let purchasesBalance = 0;
    const coveredPurchaseNos = new Set();

    if (purchaseReceivesList && purchaseReceivesList.length > 0) {
        for (let i = 0; i < purchaseReceivesList.length; i++) {
            const pr = purchaseReceivesList[i];
            if ((pr.status || '').toLowerCase() === 'requested') continue;
            if (targetCutoff) {
                const prDate = getIsoDateString(pr.date);
                if (prDate && prDate >= targetCutoff) continue;
            }
            const prCustId = (pr.customerId || '').toString().trim();
            let matches = false;
            if (prCustId && (prCustId === targetId || (cCode && prCustId.toLowerCase() === cCode))) {
                matches = true;
            } else {
                const prComp = (pr.companyName || '').trim().toLowerCase();
                const prSupp = (pr.supplierName || '').trim().toLowerCase();
                if (vComp && prComp && (prComp === vComp || prComp.includes(vComp) || vComp.includes(prComp))) matches = true;
                else if (vComp && prSupp && (prSupp === vComp || prSupp.includes(vComp) || vComp.includes(prSupp))) matches = true;
                else if (cCust && prSupp && (prSupp === cCust || prSupp.includes(cCust) || cCust.includes(prSupp))) {
                    if (!prComp || !vComp || prComp === vComp || prComp.includes(vComp) || vComp.includes(prComp)) matches = true;
                }
            }

            if (matches) {
                const pNo = pr.purchaseNo || pr.purchaseReceiveNo || 'PUR-0000';
                coveredPurchaseNos.add(pNo.trim().toUpperCase());
                if (pr.items && Array.isArray(pr.items)) {
                    for (let j = 0; j < pr.items.length; j++) {
                        const item = pr.items[j];
                        if (item.brandEntries && Array.isArray(item.brandEntries)) {
                            for (let k = 0; k < item.brandEntries.length; k++) {
                                const b = item.brandEntries[k];
                                const q = parseFloat((b.inHouseQuantity ?? b.inHouseQty ?? b.inhouseQty ?? b.qty) || 0);
                                const r = parseFloat(b.rate || 0);
                                const amt = b.total ? parseFloat(b.total) : (q * r);
                                const paid = parseFloat(pr.paid || pr.paidAmount || 0);
                                const disc = parseFloat(pr.discount || 0);
                                purchasesBalance += (amt - paid - disc);
                            }
                        } else {
                            const q = parseFloat((item.inHouseQuantity ?? item.inHouseQty ?? item.qty) || 0);
                            const r = parseFloat(item.rate || 0);
                            const amt = item.total ? parseFloat(item.total) : (q * r);
                            const paid = parseFloat(pr.paid || pr.paidAmount || 0);
                            const disc = parseFloat(pr.discount || 0);
                            purchasesBalance += (amt - paid - disc);
                        }
                    }
                }
            }
        }
    }

    if (purchasesList && purchasesList.length > 0) {
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

        for (let i = 0; i < purchasesList.length; i++) {
            const p = purchasesList[i];
            if ((p.status || '').toLowerCase() === 'requested') continue;
            if (targetCutoff) {
                const pDate = getIsoDateString(p.date);
                if (pDate && pDate >= targetCutoff) continue;
            }
            const pNo = (p.purchaseNo || p.invoiceNo || '').trim().toUpperCase();
            if (pNo && coveredPurchaseNos.has(pNo)) continue;

            const pCustId = (p.customerId || '').toString().trim();
            let matches = false;
            if (pCustId && (pCustId === targetId || (cCode && pCustId.toLowerCase() === cCode))) {
                matches = true;
            } else {
                const pComp = (p.companyName || '').trim().toLowerCase();
                const pSupp = (p.supplierName || '').trim().toLowerCase();
                const pCustName = (p.customerName || '').trim().toLowerCase();

                if (vComp && pComp && (pComp === vComp || pComp.includes(vComp) || vComp.includes(pComp))) matches = true;
                else if (vComp && pSupp && (pSupp === vComp || pSupp.includes(vComp) || vComp.includes(pSupp))) matches = true;
                else if (cCust && pSupp && (pSupp === cCust || pSupp.includes(cCust) || cCust.includes(pSupp))) {
                    if (!pComp || !vComp || pComp === vComp || pComp.includes(vComp) || vComp.includes(pComp)) matches = true;
                } else if (cCust && pCustName && (pCustName === cCust || pCustName.includes(cCust) || cCust.includes(pCustName))) {
                    if (!pComp || !vComp || pComp === vComp || pComp.includes(vComp) || vComp.includes(pComp)) matches = true;
                }
            }

            if (matches) {
                if (p.items && Array.isArray(p.items)) {
                    for (let j = 0; j < p.items.length; j++) {
                        const item = p.items[j];
                        if (item.brandEntries && Array.isArray(item.brandEntries)) {
                            for (let k = 0; k < item.brandEntries.length; k++) {
                                const b = item.brandEntries[k];
                                const res = resolvePurchaseItem(p, item, b);
                                const paid = parseFloat(p.paid || p.paidAmount || item.paid || item.paidAmount || 0);
                                const disc = parseFloat(p.discount || 0);
                                purchasesBalance += (res.amount - paid - disc);
                            }
                        } else {
                            const res = resolvePurchaseItem(p, item, null);
                            const paid = parseFloat(p.paid || p.paidAmount || item.paid || item.paidAmount || 0);
                            const disc = parseFloat(p.discount || 0);
                            purchasesBalance += (res.amount - paid - disc);
                        }
                    }
                } else {
                    const res = resolvePurchaseItem(p, null, null);
                    const paid = parseFloat(p.paid || p.paidAmount || 0);
                    const disc = parseFloat(p.discount || 0);
                    purchasesBalance += (res.amount - paid - disc);
                }
            }
        }
    }

    // 6. Returns
    let returnsBalance = 0;
    if (returnsList && returnsList.length > 0) {
        const cPhone = (c.phone || '').trim();
        const custInvoices = new Set();
        for (let i = 0; i < salesHistory.length; i++) {
            const s = salesHistory[i];
            if (s.invoiceNo) custInvoices.add(s.invoiceNo.trim().toUpperCase());
            if (s.lcNo) custInvoices.add(s.lcNo.trim().toUpperCase());
        }

        for (let i = 0; i < returnsList.length; i++) {
            const r = returnsList[i];
            if ((r.status || '').toLowerCase() === 'requested' || (r.status || '').toLowerCase() === 'cancelled') continue;
            if (targetCutoff) {
                const rDate = getIsoDateString(r.date);
                if (rDate && rDate >= targetCutoff) continue;
            }

            const rId = String(r.customerId || '');
            let rMatches = false;
            if (targetId && rId && rId === targetId) rMatches = true;
            else if (cCode && (r.customerId || '').trim().toLowerCase() === cCode) rMatches = true;
            else {
                const rInv = (r.invoiceNo || '').trim().toUpperCase();
                if (rInv && custInvoices.has(rInv)) rMatches = true;
                else {
                    const rComp = (r.companyName || '').trim().toLowerCase();
                    const rCust = (r.customerName || '').trim().toLowerCase();
                    if (vComp && rComp && (rComp === vComp || rComp.includes(vComp) || vComp.includes(rComp))) rMatches = true;
                    else if (vComp && rComp && (rComp === vComp || rComp.includes(vComp) || vComp.includes(rComp)) &&
                             cCust && rCust && (rCust === cCust || rCust.includes(cCust) || cCust.includes(rCust))) rMatches = true;
                    else {
                        const rPhone = (r.phone || '').trim();
                        if (cPhone && rPhone && cPhone === rPhone && cPhone !== '+8800000000000') rMatches = true;
                    }
                }
            }

            if (rMatches) {
                let rate = parseFloat(r.returnPrice || r.rate || r.unitPrice) || 0;
                const qty = parseFloat(r.quantity) || 0;
                const amt = parseFloat(r.amount) || (rate * qty);
                const expense = parseFloat(r.returnExpense || r.expense || 0);
                returnsBalance += (amt - expense);
            }
        }
    }

    return salesBalance - paymentsBalance + payoutsBalance - purchasesBalance - returnsBalance;
};

// Compute all customer balances in a single optimized pass
export const computeAllCustomerBalances = (customers = [], options = {}) => {
    const { salesRecords = [], purchasesList = [], purchaseReceivesList = [] } = options;
    const index = options.index || buildCustomerBalanceIndex(salesRecords, purchasesList, purchaseReceivesList);
    const balanceMap = new Map();
    for (let i = 0; i < (customers || []).length; i++) {
        const c = customers[i];
        if (!c) continue;
        const bal = computeCustomerBalance(c, {
            ...options,
            index
        });
        if (c._id) balanceMap.set(c._id.toString(), bal);
        if (c.customerId) balanceMap.set(c.customerId.toString(), bal);
    }
    return balanceMap;
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


