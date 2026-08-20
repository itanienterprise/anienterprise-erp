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

// Sort Icon Component
export const SortIcon = ({ config, columnKey }) => {
    if (!config || config.key !== columnKey) {
        return <div className="w-4 h-4 ml-1 opacity-20"><ChevronDownIcon className="w-4 h-4" /></div>;
    }
    return config.direction === 'asc'
        ? <ChevronUpIcon className="w-4 h-4 ml-1 text-blue-600" />
        : <ChevronDownIcon className="w-4 h-4 ml-1 text-blue-600" />;
};

// Calculate exact customer final balance across sales, payments, payToCustomer, and purchases/purchaseReceives
export const computeCustomerBalance = (c, { salesRecords = [], purchasesList = [], purchaseReceivesList = [] } = {}) => {
    if (!c) return 0;

    const sales = (c.salesHistory || []).filter(s => (s.status || '').toLowerCase() !== 'requested').map(s => {
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
            sortDate: new Date(s.date || 0)
        };
    });

    const payments = (c.paymentHistory || []).filter(p => (p.status || '').toLowerCase() !== 'requested').map(p => ({
        ...p,
        type: 'payment',
        sortDate: new Date(p.date || 0)
    }));

    const payouts = (c.payToCustomerHistory || []).filter(pc => (pc.status || '').toLowerCase() !== 'requested').map(pc => ({
        ...pc,
        type: 'payToCustomer',
        sortDate: new Date(pc.date || 0)
    }));

    let prEntries = [];
    let coveredPurchaseNos = new Set();
    if (purchaseReceivesList && purchaseReceivesList.length > 0) {
        const matchedPRs = purchaseReceivesList.filter(pr => {
            if ((pr.status || '').toLowerCase() === 'requested') return false;
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
                                sortDate: new Date(pr.date || 0)
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
                        sortDate: new Date(pr.date || 0)
                    }];
                });
            }
            return [];
        });

        coveredPurchaseNos = new Set(prEntries.map(e => (e.purchaseNo || '').trim().toUpperCase()));
    }

    const matchedPurchases = (purchasesList || []).filter(p => {
        if ((p.status || '').toLowerCase() === 'requested') return false;
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
                    return item.brandEntries.map(b => ({
                        amount: b.total || (parseFloat(b.qty || 0) * parseFloat(b.rate || 0)),
                        discount: p.discount || 0,
                        paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                        type: 'purchase',
                        sortDate: new Date(p.date || 0)
                    }));
                }
                return [{
                    amount: item.total || item.amount || 0,
                    discount: p.discount || 0,
                    paid: p.paid || p.paidAmount || item.paid || item.paidAmount || 0,
                    type: 'purchase',
                    sortDate: new Date(p.date || 0)
                }];
            });
        }
        return [{
            amount: p.totalAmount || p.amount || 0,
            discount: p.discount || 0,
            paid: p.paid || p.paidAmount || 0,
            type: 'purchase',
            sortDate: new Date(p.date || 0)
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
    const aDate = new Date(a.date || a.sortDate || 0).setHours(0, 0, 0, 0);
    const bDate = new Date(b.date || b.sortDate || 0).setHours(0, 0, 0, 0);
    if (aDate !== bDate) {
        return aDate - bDate;
    }
    const aTime = getItemTimestamp(a);
    const bTime = getItemTimestamp(b);
    return aTime - bTime;
};


