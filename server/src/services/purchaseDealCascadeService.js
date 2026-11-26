const mongoose = require('mongoose');
const { encryptData, decryptData, decryptRecordWithUnwrap } = require('../utils/encryption');
const LCPurchase = require('../models/LCPurchase');
const DealReceive = require('../models/DealReceive');
const CostOfGoods = require('../models/CostOfGoods');
const Stock = require('../models/Stock');

const normalize = (str) => (str || '').toString().trim().toLowerCase();
const cleanId = (str) => (str || '').toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const getDecrypted = (doc) => {
    if (!doc) return null;
    if (doc.data) {
        const dec = decryptRecordWithUnwrap(doc.data);
        if (dec) return { ...dec, _id: doc._id };
    }
    return doc.toObject ? doc.toObject() : doc;
};

const saveEncrypted = async (doc, data) => {
    const enc = encryptData(data);
    doc.data = enc;
    await doc.save();
};

/**
 * Calculates financial costing fields for India and China entries matching the ERP formula.
 */
function calculateCostingValues(data) {
    const isChina = (data.country || '').toUpperCase() === 'CHINA';
    const amount = parseFloat(data.amount) || 0;
    const qty = parseFloat(data.quantity) || 0;
    const dollarRate = parseFloat(data.rsToDollar) || 0;
    const bdtRate = parseFloat(data.dollarRateBdt) || 0;
    const expense = parseFloat(data.cfOtherExpense !== undefined && data.cfOtherExpense !== '' ? data.cfOtherExpense : '9') || 0;

    if (isChina) {
        const totalBill = amount;
        const rebateAmount = 0;
        const netBill = amount;
        const rateKg = qty ? (amount / qty) : 0;
        const rateKgUsd = rateKg;
        const rateKgBdt = rateKgUsd * bdtRate;
        const costingKg = rateKgBdt + expense;
        return {
            totalBill,
            rebateAmount,
            netBill,
            rateKg,
            rateKgUsd,
            rateKgBdt,
            costingKg
        };
    } else {
        const indTruckFare = parseFloat(data.indTruckFare) || 0;
        const truckChangeFare = parseFloat(data.truckChangeFare) || 0;
        const slofCf = parseFloat(data.slofCf) || 0;
        const totalBill = amount + indTruckFare + truckChangeFare + slofCf;
        const rebatePct = parseFloat(data.rebate !== undefined && data.rebate !== '' ? data.rebate : '2.9') || 0;
        const rebateAmount = (totalBill * rebatePct) / 100;
        const netBill = totalBill - rebateAmount;
        const rateKg = qty ? (netBill / qty) : 0;
        const rateKgUsd = dollarRate ? (rateKg / dollarRate) : 0;
        const rateKgBdt = rateKgUsd * bdtRate;
        const costingKg = rateKgBdt + expense;
        return {
            totalBill,
            rebateAmount,
            netBill,
            rateKg,
            rateKgUsd,
            rateKgBdt,
            costingKg
        };
    }
}

/**
 * Recalculates receivedQty, remainingQty, and status for a Purchase Deal from its Deal Receives.
 */
async function syncDealQuantitiesForDeal(dealId, purchaseId) {
    if (!dealId && !purchaseId) return false;
    const normDealId = dealId ? String(dealId).trim() : '';
    const cleanPId = cleanId(purchaseId);

    try {
        let dealDoc = normDealId ? await LCPurchase.findById(normDealId) : null;
        if (!dealDoc && cleanPId) {
            const allDeals = await LCPurchase.find({});
            for (const d of allDeals) {
                const dec = getDecrypted(d);
                if (dec && cleanId(dec.purchaseId) === cleanPId) {
                    dealDoc = d;
                    break;
                }
            }
        }
        if (!dealDoc) return false;

        const deal = getDecrypted(dealDoc);
        if (!deal) return false;

        const allDrs = await DealReceive.find({});
        const matchingReceives = [];
        for (const drDoc of allDrs) {
            const dr = getDecrypted(drDoc);
            if (!dr) continue;
            const drRef = String(dr.dealRefId || '').trim();
            const drPId = cleanId(dr.purchaseId);
            if ((normDealId && drRef === normDealId) || (cleanPId && drPId === cleanPId)) {
                matchingReceives.push(dr);
            }
        }

        const isTruck = (deal.uom || '').toLowerCase() === 'truck';
        const totalReceived = matchingReceives.reduce((sum, r) => {
            if (isTruck) {
                const count = parseFloat(r.trucks) || (Array.isArray(r.truckNumbers) && r.truckNumbers.length ? r.truckNumbers.length : 1);
                return sum + count;
            }
            return sum + (parseFloat(r.quantity || r.receiveQty) || 0);
        }, 0);

        const totalQty = parseFloat(deal.qty) || 0;
        const remaining = Math.max(0, totalQty - totalReceived);
        const newStatus = remaining <= 0.0001 ? 'Completed' : 'Active';

        if (deal.receivedQty !== totalReceived || deal.remainingQty !== remaining || deal.status !== newStatus) {
            deal.receivedQty = totalReceived;
            deal.remainingQty = remaining;
            deal.status = newStatus;
            await saveEncrypted(dealDoc, deal);
            return true;
        }
    } catch (err) {
        console.error('Error syncing deal quantities:', err);
    }
    return false;
}

/**
 * Cascades updates from Purchase Deal (LCPurchase) DOWNSTREAM to:
 * 1. Deal Receive (DealReceive)
 * 2. Cost of Goods (CostOfGoods)
 * 3. LC Receive (Stock)
 *
 * @param {string} dealId - The _id of the Purchase Deal
 * @param {Object} newDeal - The updated Purchase Deal data
 * @param {Object} oldDeal - The previous Purchase Deal data before update
 * @param {Object} context - Optional context to prevent circular cascading
 * @returns {Promise<Object>} Counts of updated documents in each collection
 */
async function cascadePurchaseDealUpdate(dealId, newDeal = {}, oldDeal = {}, context = {}) {
    const visited = context.visited || {
        deals: new Set(),
        drs: new Set(),
        cogs: new Set(),
        stocks: new Set()
    };

    if (dealId) visited.deals.add(String(dealId));

    const counts = {
        dealReceives: 0,
        costOfGoods: 0,
        stocks: 0
    };

    if (!dealId && !newDeal.purchaseId && !oldDeal.purchaseId) {
        return { status: 'skipped', counts };
    }

    const normDealId = dealId ? String(dealId).trim() : '';
    const cleanNewPId = cleanId(newDeal.purchaseId);
    const cleanOldPId = cleanId(oldDeal.purchaseId);

    const newSupplier = (newDeal.supplierName || newDeal.supplier || '').trim();
    const newProduct = (newDeal.productName || newDeal.product || '').trim();
    const newBrand = (newDeal.brand || '').trim();
    const newExporter = (newDeal.exporter || '').trim();
    const targetPurchaseId = (newDeal.purchaseId || oldDeal.purchaseId || '').replace(/-/g, '').trim();

    try {
        const drDocs = await DealReceive.find({});
        for (const doc of drDocs) {
            if (visited.drs.has(String(doc._id))) continue;

            const dr = getDecrypted(doc);
            if (!dr) continue;

            const drDealRefId = String(dr.dealRefId || '').trim();
            const drPIdClean = cleanId(dr.purchaseId);

            const isMatchingDeal =
                (normDealId && drDealRefId && drDealRefId === normDealId) ||
                (cleanNewPId && drPIdClean && drPIdClean === cleanNewPId) ||
                (cleanOldPId && drPIdClean && drPIdClean === cleanOldPId);

            if (!isMatchingDeal) continue;

            visited.drs.add(String(doc._id));
            let drModified = false;
            const oldDrData = { ...dr };

            if (newSupplier && (dr.supplier !== newSupplier || dr.supplierName !== newSupplier)) {
                dr.supplier = newSupplier;
                dr.supplierName = newSupplier;
                drModified = true;
            }

            if (newProduct && (dr.product !== newProduct || dr.productName !== newProduct)) {
                dr.product = newProduct;
                dr.productName = newProduct;
                drModified = true;
            }

            if (newBrand && dr.brand !== newBrand) {
                dr.brand = newBrand;
                drModified = true;
            }

            if (newExporter && dr.exporter !== newExporter) {
                dr.exporter = newExporter;
                drModified = true;
            }

            if (targetPurchaseId && dr.purchaseId !== targetPurchaseId) {
                dr.purchaseId = targetPurchaseId;
                drModified = true;
            }

            if (normDealId && dr.dealRefId !== normDealId) {
                dr.dealRefId = normDealId;
                drModified = true;
            }

            if (drModified) {
                await saveEncrypted(doc, dr);
                counts.dealReceives++;
            }

            // Cascade downstream to COG and LC Receive
            const subRes = await cascadeDealReceiveUpdate(doc._id, dr, oldDrData, { visited, skipDealUpstream: true });
            if (subRes && subRes.counts) {
                counts.costOfGoods += subRes.counts.costOfGoods || 0;
                counts.stocks += subRes.counts.stocks || 0;
            }
        }
    } catch (err) {
        console.error('Error cascading Purchase Deal update:', err);
    }

    return { status: 'success', counts };
}

/**
 * Cascades updates from Deal Receive (DealReceive):
 * 1. DOWNSTREAM to Cost of Goods (CostOfGoods) and LC Receive (Stock)
 * 2. UPSTREAM to Purchase Deal (LCPurchase)
 *
 * @param {string} dealReceiveId - The _id of the Deal Receive
 * @param {Object} newDr - The updated Deal Receive data
 * @param {Object} oldDr - The previous Deal Receive data before update
 * @param {Object} context - Optional context to prevent circular cascading
 * @returns {Promise<Object>} Counts of updated documents in each collection
 */
async function cascadeDealReceiveUpdate(dealReceiveId, newDr = {}, oldDr = {}, context = {}) {
    const visited = context.visited || {
        deals: new Set(),
        drs: new Set(),
        cogs: new Set(),
        stocks: new Set()
    };

    if (dealReceiveId) visited.drs.add(String(dealReceiveId));

    const counts = {
        costOfGoods: 0,
        stocks: 0,
        lcPurchases: 0
    };

    if (!dealReceiveId && !newDr.receiveId && !oldDr.receiveId && !newDr.invoiceNo && !oldDr.invoiceNo) {
        return { status: 'skipped', counts };
    }

    const normDrId = dealReceiveId ? String(dealReceiveId).trim() : '';
    const cleanNewRecId = cleanId(newDr.receiveId);
    const cleanOldRecId = cleanId(oldDr.receiveId);
    const cleanNewInv = cleanId(newDr.invoiceNo);
    const cleanOldInv = cleanId(oldDr.invoiceNo);

    const supplierVal = (newDr.supplier || newDr.supplierName || '').trim();
    const productVal = (newDr.product || newDr.productName || '').trim();
    const brandVal = (newDr.brand || '').trim();
    const invoiceNoVal = (newDr.invoiceNo || '').trim();
    const truckNoVal = (newDr.truckNo || (Array.isArray(newDr.truckNumbers) ? newDr.truckNumbers.filter(Boolean).join(', ') : '') || '').trim();

    try {
        // ─── 1. DOWNSTREAM: Update matching Cost of Goods ───────────────────
        const cogDocs = await CostOfGoods.find({});
        for (const doc of cogDocs) {
            if (visited.cogs.has(String(doc._id))) continue;

            const cog = getDecrypted(doc);
            if (!cog) continue;

            const cogDrRefId = String(cog.dealReceiveRefId || '').trim();
            const cogDrIdClean = cleanId(cog.dealReceiveId);
            const cogInvClean = cleanId(cog.invoiceNo);

            const isMatchingCog =
                (normDrId && cogDrRefId && cogDrRefId === normDrId) ||
                (cleanNewRecId && cogDrIdClean && cogDrIdClean === cleanNewRecId) ||
                (cleanOldRecId && cogDrIdClean && cogDrIdClean === cleanOldRecId) ||
                (cleanOldInv && cogInvClean && cogInvClean === cleanOldInv && (!supplierVal || normalize(cog.supplier) === normalize(supplierVal)));

            if (!isMatchingCog) continue;

            visited.cogs.add(String(doc._id));
            const oldCogData = { ...cog };
            let cogModified = false;

            if (normDrId && cog.dealReceiveRefId !== normDrId) {
                cog.dealReceiveRefId = normDrId;
                cogModified = true;
            }

            const targetDrId = newDr.receiveId || oldDr.receiveId;
            if (targetDrId && cog.dealReceiveId !== targetDrId) {
                cog.dealReceiveId = targetDrId;
                cogModified = true;
            }

            if (supplierVal && cog.supplier !== supplierVal) {
                cog.supplier = supplierVal;
                cogModified = true;
            }

            if (productVal && cog.product !== productVal) {
                cog.product = productVal;
                cogModified = true;
            }

            if (brandVal !== undefined && cog.brand !== brandVal) {
                cog.brand = brandVal;
                cogModified = true;
            }

            if (invoiceNoVal && cog.invoiceNo !== invoiceNoVal) {
                cog.invoiceNo = invoiceNoVal;
                cogModified = true;
            }

            if (truckNoVal && cog.truckNo !== truckNoVal) {
                cog.truckNo = truckNoVal;
                cogModified = true;
            }

            if (newDr.quantity !== undefined && newDr.quantity !== '' && cog.quantity !== newDr.quantity) {
                cog.quantity = newDr.quantity;
                cogModified = true;
            }

            if (newDr.amount !== undefined && newDr.amount !== '' && cog.amount !== newDr.amount) {
                cog.amount = newDr.amount;
                cogModified = true;
            }

            if (newDr.indTruckFare !== undefined && cog.indTruckFare !== newDr.indTruckFare) {
                cog.indTruckFare = newDr.indTruckFare;
                cogModified = true;
            }

            if (newDr.truckChangeFare !== undefined && cog.truckChangeFare !== newDr.truckChangeFare) {
                cog.truckChangeFare = newDr.truckChangeFare;
                cogModified = true;
            }

            if (newDr.slofCf !== undefined && cog.slofCf !== newDr.slofCf) {
                cog.slofCf = newDr.slofCf;
                cogModified = true;
            }

            if (newDr.rebate !== undefined && cog.rebate !== newDr.rebate) {
                cog.rebate = newDr.rebate;
                cogModified = true;
            }

            if (newDr.rsToDollar !== undefined && newDr.rsToDollar !== '' && cog.rsToDollar !== newDr.rsToDollar) {
                cog.rsToDollar = newDr.rsToDollar;
                cogModified = true;
            }

            if (newDr.dollarRateBdt !== undefined && newDr.dollarRateBdt !== '' && cog.dollarRateBdt !== newDr.dollarRateBdt) {
                cog.dollarRateBdt = newDr.dollarRateBdt;
                cogModified = true;
            }

            if (newDr.cfOtherExpense !== undefined && cog.cfOtherExpense !== newDr.cfOtherExpense) {
                cog.cfOtherExpense = newDr.cfOtherExpense;
                cogModified = true;
            }

            if (newDr.country && cog.country !== newDr.country) {
                cog.country = newDr.country;
                cogModified = true;
            }

            if (newDr.date && cog.date !== newDr.date) {
                cog.date = newDr.date;
                cogModified = true;
            }

            if (newDr.exporter && !cog.exporter) {
                cog.exporter = newDr.exporter;
                cogModified = true;
            }

            const calc = calculateCostingValues(cog);
            const costingVal = newDr.costingKg !== undefined && newDr.costingKg !== '' ? newDr.costingKg : calc.costingKg;
            if (cog.costingKg !== costingVal) {
                cog.costingKg = costingVal;
                cogModified = true;
            }
            if (newDr.rateKg !== undefined && cog.rateKg !== newDr.rateKg) {
                cog.rateKg = newDr.rateKg;
                cogModified = true;
            }
            if (newDr.rateKgUsd !== undefined && cog.rateKgUsd !== newDr.rateKgUsd) {
                cog.rateKgUsd = newDr.rateKgUsd;
                cogModified = true;
            }
            if (newDr.rateKgBdt !== undefined && cog.rateKgBdt !== newDr.rateKgBdt) {
                cog.rateKgBdt = newDr.rateKgBdt;
                cogModified = true;
            }
            if (newDr.netBill !== undefined && cog.netBill !== newDr.netBill) {
                cog.netBill = newDr.netBill;
                cogModified = true;
            }
            if (newDr.totalBill !== undefined && cog.totalBill !== newDr.totalBill) {
                cog.totalBill = newDr.totalBill;
                cogModified = true;
            }
            if (newDr.rebateAmount !== undefined && cog.rebateAmount !== newDr.rebateAmount) {
                cog.rebateAmount = newDr.rebateAmount;
                cogModified = true;
            }

            if (cogModified) {
                await saveEncrypted(doc, cog);
                counts.costOfGoods++;
            }

            // Downstream to LC Receive (Stock)
            const subRes = await cascadeCostOfGoodsUpdate(doc._id, cog, oldCogData, { visited, skipDrUpstream: true });
            if (subRes && subRes.counts) {
                counts.stocks += subRes.counts.stocks || 0;
            }
        }

        // Direct fallback: Update Stock directly if invoice matches
        if (cleanNewInv || cleanOldInv) {
            const stockDocs = await Stock.find({});
            for (const doc of stockDocs) {
                if (visited.stocks.has(String(doc._id))) continue;

                const stock = getDecrypted(doc);
                if (!stock) continue;

                const stInvClean = cleanId(stock.invoiceNo);
                const matchesInv = (cleanNewInv && stInvClean === cleanNewInv) || (cleanOldInv && stInvClean === cleanOldInv);
                if (!matchesInv) continue;

                visited.stocks.add(String(doc._id));
                let stockModified = false;
                if (productVal && normalize(stock.productName || stock.product) !== normalize(productVal)) {
                    stock.productName = productVal;
                    stock.product = productVal;
                    stockModified = true;
                }
                if (brandVal && normalize(stock.brand) !== normalize(brandVal)) {
                    stock.brand = brandVal;
                    stockModified = true;
                }
                if (invoiceNoVal && stock.invoiceNo !== invoiceNoVal) {
                    stock.invoiceNo = invoiceNoVal;
                    stockModified = true;
                }
                if (truckNoVal && stock.truckNo !== truckNoVal) {
                    stock.truckNo = truckNoVal;
                    stockModified = true;
                }
                if (newDr.quantity !== undefined && newDr.quantity !== '' && String(stock.invoiceQty) !== String(newDr.quantity)) {
                    stock.invoiceQty = String(newDr.quantity);
                    stockModified = true;
                }
                if (newDr.costingKg !== undefined && newDr.costingKg !== '' && String(stock.purchasedPrice) !== String(newDr.costingKg)) {
                    stock.purchasedPrice = String(newDr.costingKg);
                    stockModified = true;
                }

                if (Array.isArray(stock.entries)) {
                    stock.entries.forEach(entry => {
                        const eInv = cleanId(entry.invoiceNo);
                        if ((cleanNewInv && eInv === cleanNewInv) || (cleanOldInv && eInv === cleanOldInv)) {
                            if (productVal) entry.productName = productVal;
                            if (brandVal) entry.brand = brandVal;
                            if (invoiceNoVal) entry.invoiceNo = invoiceNoVal;
                            if (truckNoVal) entry.truckNo = truckNoVal;
                            if (newDr.quantity !== undefined && newDr.quantity !== '') entry.invoiceQty = String(newDr.quantity);
                            if (newDr.costingKg !== undefined && newDr.costingKg !== '') entry.purchasedPrice = String(newDr.costingKg);
                            stockModified = true;
                        }
                    });
                }

                if (stockModified) {
                    await saveEncrypted(doc, stock);
                    counts.stocks++;
                }
            }
        }

        // ─── 2. UPSTREAM: Update matching Purchase Deal (LCPurchase) ────────
        if (!context.skipDealUpstream) {
            const dealRefId = String(newDr.dealRefId || oldDr.dealRefId || '').trim();
            const pIdClean = cleanId(newDr.purchaseId || oldDr.purchaseId);

            if (dealRefId || pIdClean) {
                const dealDocs = await LCPurchase.find({});
                for (const dDoc of dealDocs) {
                    if (visited.deals.has(String(dDoc._id))) continue;

                    const deal = getDecrypted(dDoc);
                    if (!deal) continue;

                    const dIdStr = String(dDoc._id);
                    const dPIdClean = cleanId(deal.purchaseId);

                    const matchesDeal = (dealRefId && dIdStr === dealRefId) || (pIdClean && dPIdClean === pIdClean);
                    if (!matchesDeal) continue;

                    visited.deals.add(dIdStr);
                    let dealModified = false;

                    if (supplierVal && (deal.supplierName !== supplierVal || deal.supplier !== supplierVal)) {
                        deal.supplierName = supplierVal;
                        deal.supplier = supplierVal;
                        dealModified = true;
                    }

                    if (productVal && (deal.productName !== productVal || deal.product !== productVal)) {
                        deal.productName = productVal;
                        deal.product = productVal;
                        dealModified = true;
                    }

                    if (brandVal !== undefined && deal.brand !== brandVal) {
                        deal.brand = brandVal;
                        dealModified = true;
                    }

                    if (newDr.exporter && deal.exporter !== newDr.exporter) {
                        deal.exporter = newDr.exporter;
                        dealModified = true;
                    }

                    if (dealModified) {
                        await saveEncrypted(dDoc, deal);
                        counts.lcPurchases++;
                    }

                    await syncDealQuantitiesForDeal(dDoc._id, deal.purchaseId);
                }
            }
        }
    } catch (err) {
        console.error('Error cascading Deal Receive update:', err);
    }

    return { status: 'success', counts };
}

/**
 * Cascades updates from Cost of Goods (CostOfGoods):
 * 1. DOWNSTREAM to LC Receive (Stock)
 * 2. UPSTREAM to Deal Receive (DealReceive) and Purchase Deal (LCPurchase) (VICE VERSA)
 *
 * @param {string} cogId - The _id of the Cost of Goods record
 * @param {Object} newCog - The updated Cost of Goods data
 * @param {Object} oldCog - The previous Cost of Goods data before update
 * @param {Object} context - Optional context to prevent circular cascading
 * @returns {Promise<Object>} Counts of updated documents in Stock, DealReceive, and LCPurchase
 */
async function cascadeCostOfGoodsUpdate(cogId, newCog = {}, oldCog = {}, context = {}) {
    const visited = context.visited || {
        deals: new Set(),
        drs: new Set(),
        cogs: new Set(),
        stocks: new Set()
    };

    if (cogId) visited.cogs.add(String(cogId));

    const counts = {
        stocks: 0,
        dealReceives: 0,
        lcPurchases: 0
    };

    if (!cogId && !newCog.invoiceNo && !oldCog.invoiceNo && !newCog.dealReceiveId && !newCog.dealReceiveRefId) {
        return { status: 'skipped', counts };
    }

    const normCogId = cogId ? String(cogId).trim() : '';
    const cleanNewInv = cleanId(newCog.invoiceNo);
    const cleanOldInv = cleanId(oldCog.invoiceNo);
    const cleanNewLc = cleanId(newCog.lcNo);
    const cleanOldLc = cleanId(oldCog.lcNo);

    const targetSupplier = (newCog.supplier || newCog.supplierName || '').trim();
    const targetProduct = (newCog.product || newCog.productName || '').trim();
    const targetBrand = (newCog.brand || '').trim();
    const targetInvoiceNo = (newCog.invoiceNo || '').trim();
    const targetTruckNo = (newCog.truckNo || '').trim();
    const targetPrice = newCog.costingKg !== undefined && newCog.costingKg !== null ? String(newCog.costingKg) : '';
    const targetQty = newCog.quantity !== undefined && newCog.quantity !== null ? String(newCog.quantity) : '';

    try {
        // ─── 1. DOWNSTREAM: Update matching Stock (LC Receive) ─────────────
        const stockDocs = await Stock.find({});
        for (const doc of stockDocs) {
            if (visited.stocks.has(String(doc._id))) continue;

            const stock = getDecrypted(doc);
            if (!stock) continue;

            const stMatchedCogId = String(stock.matchedCogId || '').trim();
            const stInvClean = cleanId(stock.invoiceNo);
            const stLcClean = cleanId(stock.lcNo);

            const isMatchingStock =
                (normCogId && stMatchedCogId && stMatchedCogId === normCogId) ||
                (cleanNewInv && stInvClean && stInvClean === cleanNewInv && (!cleanNewLc || !stLcClean || stLcClean === cleanNewLc)) ||
                (cleanOldInv && stInvClean && stInvClean === cleanOldInv && (!cleanOldLc || !stLcClean || stLcClean === cleanOldLc));

            let hasMatchingEntry = false;
            if (Array.isArray(stock.entries)) {
                hasMatchingEntry = stock.entries.some(e => {
                    const eCogId = String(e.matchedCogId || '').trim();
                    const eInv = cleanId(e.invoiceNo);
                    return (normCogId && eCogId && eCogId === normCogId) ||
                           (cleanNewInv && eInv && eInv === cleanNewInv) ||
                           (cleanOldInv && eInv && eInv === cleanOldInv);
                });
            }

            if (!isMatchingStock && !hasMatchingEntry) continue;

            visited.stocks.add(String(doc._id));
            let stockModified = false;

            if (isMatchingStock) {
                if (normCogId && stock.matchedCogId !== normCogId) {
                    stock.matchedCogId = normCogId;
                    stockModified = true;
                }

                if (targetProduct && normalize(stock.productName || stock.product) !== normalize(targetProduct)) {
                    stock.productName = targetProduct;
                    stock.product = targetProduct;
                    stockModified = true;
                }

                if (targetBrand !== undefined && normalize(stock.brand) !== normalize(targetBrand)) {
                    stock.brand = targetBrand;
                    stockModified = true;
                }

                if (targetInvoiceNo && stock.invoiceNo !== targetInvoiceNo) {
                    stock.invoiceNo = targetInvoiceNo;
                    stockModified = true;
                }

                if (targetTruckNo && stock.truckNo !== targetTruckNo) {
                    stock.truckNo = targetTruckNo;
                    stockModified = true;
                }

                if (targetPrice && String(stock.purchasedPrice) !== targetPrice) {
                    stock.purchasedPrice = targetPrice;
                    stockModified = true;
                }

                if (targetQty && String(stock.invoiceQty) !== targetQty) {
                    stock.invoiceQty = targetQty;
                    stockModified = true;
                }
            }

            if (Array.isArray(stock.entries)) {
                stock.entries.forEach(entry => {
                    const eCogId = String(entry.matchedCogId || '').trim();
                    const eInv = cleanId(entry.invoiceNo);
                    const eMatch = (normCogId && eCogId && eCogId === normCogId) ||
                                  (cleanNewInv && eInv && eInv === cleanNewInv) ||
                                  (cleanOldInv && eInv && eInv === cleanOldInv);
                    if (eMatch) {
                        if (normCogId) entry.matchedCogId = normCogId;
                        if (targetProduct) entry.productName = targetProduct;
                        if (targetBrand !== undefined) entry.brand = targetBrand;
                        if (targetInvoiceNo) entry.invoiceNo = targetInvoiceNo;
                        if (targetTruckNo) entry.truckNo = targetTruckNo;
                        if (targetPrice) entry.purchasedPrice = targetPrice;
                        if (targetQty) entry.invoiceQty = targetQty;
                        stockModified = true;
                    }
                });
            }

            if (stockModified) {
                await saveEncrypted(doc, stock);
                counts.stocks++;
            }
        }

        // ─── 2. UPSTREAM: Update matching Deal Receive (DealReceive) (VICE VERSA) ───
        if (!context.skipDrUpstream) {
            const targetDrRefId = String(newCog.dealReceiveRefId || oldCog.dealReceiveRefId || '').trim();
            const cleanTargetDrId = cleanId(newCog.dealReceiveId || oldCog.dealReceiveId);

            const drDocs = await DealReceive.find({});
            for (const doc of drDocs) {
                if (visited.drs.has(String(doc._id))) continue;

                const dr = getDecrypted(doc);
                if (!dr) continue;

                const drIdStr = String(doc._id);
                const drRecIdClean = cleanId(dr.receiveId);
                const drInvClean = cleanId(dr.invoiceNo);

                const isMatch =
                    (targetDrRefId && drIdStr === targetDrRefId) ||
                    (cleanTargetDrId && drRecIdClean === cleanTargetDrId) ||
                    (cleanNewInv && drInvClean === cleanNewInv && (!targetSupplier || normalize(dr.supplier) === normalize(targetSupplier))) ||
                    (cleanOldInv && drInvClean === cleanOldInv && (!targetSupplier || normalize(dr.supplier) === normalize(targetSupplier)));

                if (!isMatch) continue;

                visited.drs.add(drIdStr);
                let drModified = false;

                if (targetSupplier && (dr.supplier !== targetSupplier || dr.supplierName !== targetSupplier)) {
                    dr.supplier = targetSupplier;
                    dr.supplierName = targetSupplier;
                    drModified = true;
                }

                if (targetProduct && (dr.product !== targetProduct || dr.productName !== targetProduct)) {
                    dr.product = targetProduct;
                    dr.productName = targetProduct;
                    drModified = true;
                }

                if (targetBrand !== undefined && dr.brand !== targetBrand) {
                    dr.brand = targetBrand;
                    drModified = true;
                }

                if (targetInvoiceNo && dr.invoiceNo !== targetInvoiceNo) {
                    dr.invoiceNo = targetInvoiceNo;
                    drModified = true;
                }

                if (targetTruckNo && dr.truckNo !== targetTruckNo) {
                    dr.truckNo = targetTruckNo;
                    drModified = true;
                }

                if (newCog.quantity !== undefined && newCog.quantity !== '' && dr.quantity !== newCog.quantity) {
                    dr.quantity = newCog.quantity;
                    drModified = true;
                }

                if (newCog.amount !== undefined && newCog.amount !== '' && dr.amount !== newCog.amount) {
                    dr.amount = newCog.amount;
                    drModified = true;
                }

                if (newCog.indTruckFare !== undefined && dr.indTruckFare !== newCog.indTruckFare) {
                    dr.indTruckFare = newCog.indTruckFare;
                    drModified = true;
                }

                if (newCog.truckChangeFare !== undefined && dr.truckChangeFare !== newCog.truckChangeFare) {
                    dr.truckChangeFare = newCog.truckChangeFare;
                    drModified = true;
                }

                if (newCog.slofCf !== undefined && dr.slofCf !== newCog.slofCf) {
                    dr.slofCf = newCog.slofCf;
                    drModified = true;
                }

                if (newCog.rebate !== undefined && dr.rebate !== newCog.rebate) {
                    dr.rebate = newCog.rebate;
                    drModified = true;
                }

                if (newCog.rsToDollar !== undefined && newCog.rsToDollar !== '' && dr.rsToDollar !== newCog.rsToDollar) {
                    dr.rsToDollar = newCog.rsToDollar;
                    drModified = true;
                }

                if (newCog.dollarRateBdt !== undefined && newCog.dollarRateBdt !== '' && dr.dollarRateBdt !== newCog.dollarRateBdt) {
                    dr.dollarRateBdt = newCog.dollarRateBdt;
                    drModified = true;
                }

                if (newCog.cfOtherExpense !== undefined && dr.cfOtherExpense !== newCog.cfOtherExpense) {
                    dr.cfOtherExpense = newCog.cfOtherExpense;
                    drModified = true;
                }

                if (newCog.country && dr.country !== newCog.country) {
                    dr.country = newCog.country;
                    drModified = true;
                }

                if (newCog.date && dr.date !== newCog.date) {
                    dr.date = newCog.date;
                    drModified = true;
                }

                if (newCog.exporter && dr.exporter !== newCog.exporter) {
                    dr.exporter = newCog.exporter;
                    drModified = true;
                }

                const calc = calculateCostingValues(dr);
                const costingVal = newCog.costingKg !== undefined && newCog.costingKg !== '' ? newCog.costingKg : calc.costingKg;
                if (dr.costingKg !== costingVal) {
                    dr.costingKg = costingVal;
                    drModified = true;
                }
                if (newCog.rateKg !== undefined && dr.rateKg !== newCog.rateKg) {
                    dr.rateKg = newCog.rateKg;
                    drModified = true;
                }
                if (newCog.rateKgUsd !== undefined && dr.rateKgUsd !== newCog.rateKgUsd) {
                    dr.rateKgUsd = newCog.rateKgUsd;
                    drModified = true;
                }
                if (newCog.rateKgBdt !== undefined && dr.rateKgBdt !== newCog.rateKgBdt) {
                    dr.rateKgBdt = newCog.rateKgBdt;
                    drModified = true;
                }
                if (newCog.netBill !== undefined && dr.netBill !== newCog.netBill) {
                    dr.netBill = newCog.netBill;
                    drModified = true;
                }
                if (newCog.totalBill !== undefined && dr.totalBill !== newCog.totalBill) {
                    dr.totalBill = newCog.totalBill;
                    drModified = true;
                }
                if (newCog.rebateAmount !== undefined && dr.rebateAmount !== newCog.rebateAmount) {
                    dr.rebateAmount = newCog.rebateAmount;
                    drModified = true;
                }

                if (drModified) {
                    await saveEncrypted(doc, dr);
                    counts.dealReceives++;
                }

                // ─── 3. UPSTREAM: From Deal Receive to Purchase Deal (LCPurchase) ───
                const dealRefId = String(dr.dealRefId || '').trim();
                const pIdClean = cleanId(dr.purchaseId);

                if (dealRefId || pIdClean) {
                    const dealDocs = await LCPurchase.find({});
                    for (const dDoc of dealDocs) {
                        if (visited.deals.has(String(dDoc._id))) continue;

                        const deal = getDecrypted(dDoc);
                        if (!deal) continue;

                        const dIdStr = String(dDoc._id);
                        const dPIdClean = cleanId(deal.purchaseId);

                        const matchesDeal = (dealRefId && dIdStr === dealRefId) || (pIdClean && dPIdClean === pIdClean);
                        if (!matchesDeal) continue;

                        visited.deals.add(dIdStr);
                        let dealModified = false;

                        if (targetSupplier && (deal.supplierName !== targetSupplier || deal.supplier !== targetSupplier)) {
                            deal.supplierName = targetSupplier;
                            deal.supplier = targetSupplier;
                            dealModified = true;
                        }

                        if (targetProduct && (deal.productName !== targetProduct || deal.product !== targetProduct)) {
                            deal.productName = targetProduct;
                            deal.product = targetProduct;
                            dealModified = true;
                        }

                        if (targetBrand !== undefined && deal.brand !== targetBrand) {
                            deal.brand = targetBrand;
                            dealModified = true;
                        }

                        if (newCog.exporter && deal.exporter !== newCog.exporter) {
                            deal.exporter = newCog.exporter;
                            dealModified = true;
                        }

                        if (dealModified) {
                            await saveEncrypted(dDoc, deal);
                            counts.lcPurchases++;
                        }

                        await syncDealQuantitiesForDeal(dDoc._id, deal.purchaseId);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error cascading Cost of Goods update:', err);
    }

    return { status: 'success', counts };
}

/**
 * Reconciles and synchronizes all historical Purchase Deals, Deal Receives, Cost of Goods, and LC Receives.
 */
async function syncAllPurchaseDealCascades() {
    const totalCounts = {
        dealReceives: 0,
        costOfGoods: 0,
        stocks: 0,
        lcPurchases: 0
    };

    try {
        // 1. Sync from Deals downstream
        const deals = await LCPurchase.find({});
        for (const dealDoc of deals) {
            const deal = getDecrypted(dealDoc);
            if (!deal) continue;
            const res = await cascadePurchaseDealUpdate(dealDoc._id, deal, deal);
            if (res && res.counts) {
                totalCounts.dealReceives += res.counts.dealReceives || 0;
                totalCounts.costOfGoods += res.counts.costOfGoods || 0;
                totalCounts.stocks += res.counts.stocks || 0;
            }
        }

        // 2. Sync from Deal Receives
        const drs = await DealReceive.find({});
        for (const drDoc of drs) {
            const dr = getDecrypted(drDoc);
            if (!dr) continue;
            const res = await cascadeDealReceiveUpdate(drDoc._id, dr, dr);
            if (res && res.counts) {
                totalCounts.costOfGoods += res.counts.costOfGoods || 0;
                totalCounts.stocks += res.counts.stocks || 0;
                totalCounts.lcPurchases += res.counts.lcPurchases || 0;
            }
        }

        // 3. Sync from COGs
        const cogs = await CostOfGoods.find({});
        for (const cogDoc of cogs) {
            const cog = getDecrypted(cogDoc);
            if (!cog) continue;
            const res = await cascadeCostOfGoodsUpdate(cogDoc._id, cog, cog);
            if (res && res.counts) {
                totalCounts.stocks += res.counts.stocks || 0;
                totalCounts.dealReceives += res.counts.dealReceives || 0;
                totalCounts.lcPurchases += res.counts.lcPurchases || 0;
            }
        }

        console.log('Bidirectional Purchase Deal <-> Deal Receive <-> COG <-> Stock sync completed:', totalCounts);
    } catch (err) {
        console.error('Error syncing all purchase deal cascades:', err);
    }

    return totalCounts;
}

module.exports = {
    cascadePurchaseDealUpdate,
    cascadeDealReceiveUpdate,
    cascadeCostOfGoodsUpdate,
    syncDealQuantitiesForDeal,
    syncAllPurchaseDealCascades
};
