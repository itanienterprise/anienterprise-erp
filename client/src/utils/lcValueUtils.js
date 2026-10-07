import { formatDate } from './helpers';

/**
 * Shared LC value calculation utilities.
 * Used by LCManagement and MarginReturn to produce consistent Total Value figures.
 */

export const getMilestoneTotalDollar = (mil, defaultLc) => {
    if (!mil) return 0;
    if (mil.totalDollar) {
        const val = parseFloat(mil.totalDollar);
        if (val > 0) return val;
    }
    const products = mil.productsList?.length > 0 ? mil.productsList : [];
    if (products.length > 0) {
        return products.reduce((acc, p) => {
            const q = parseFloat(p.quantity) || 0;
            const r = parseFloat(p.rate) || 0;
            const f = parseFloat(p.freight) || 0;
            const rScaled = r > 0 ? (r < 10 ? r * 1000 : r) : 0;
            const fScaled = f < 0.1 ? f * 1000 : f;
            return acc + q * (rScaled + fScaled);
        }, 0);
    }
    const qty = parseFloat(mil.quantity || 0);
    const rVal = parseFloat(mil.rate || 0);
    const rateScaled = rVal > 0 ? (rVal < 10 ? rVal * 1000 : rVal) : 0;
    return qty * rateScaled;
};

export const getLCHistoryTimeline = (lc) => {
    if (!lc) return [];

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
            dollarRate: lc.openingDollarRate || lc.dollarRate,
            totalDollar: lc.totalDollar,
            totalAmount: lc.totalAmount,
            netPremium: lc.netPremium,
            expectedReturnAmount: lc.expectedReturnAmount,
            grossPremium: lc.grossPremium,
            piNo: lc.piNo || '',
            port: lc.port || '',
            latestShipmentDate: lc.latestShipmentDate || '',
            remarks: 'Original LC Details',
            isOriginal: true,
            productsList: lc.productsList || []
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
            expiryDate: lc.openingDate,
            quantity: origQty,
            rate: amendments[0]?.rate || lc.rate,
            dollarRate: lc.openingDollarRate || amendments[0]?.dollarRate || lc.dollarRate,
            totalDollar: amendments[0]?.totalDollar || lc.totalDollar,
            totalAmount: amendments[0]?.totalAmount || lc.totalAmount,
            netPremium: lc.netPremium,
            expectedReturnAmount: lc.expectedReturnAmount,
            grossPremium: lc.grossPremium,
            piNo: lc.piNo || '',
            port: lc.port || '',
            latestShipmentDate: lc.latestShipmentDate || '',
            remarks: 'Original LC Details (Estimated)',
            isOriginal: true,
            productsList: amendments[0]?.productsList || lc.productsList || []
        });

        amendments.forEach(amnd => {
            baseTimeline.push({ ...amnd, isOriginal: false });
        });
    }

    return baseTimeline;
};

/**
 * Helper to calculate Cost/KG in BDT for a Cost of Goods (COG) record.
 */
export const getRecCostingKg = (rec) => {
    if (!rec) return 0;
    let cost = 0;
    if (rec.costingKg !== undefined && rec.costingKg !== null && rec.costingKg !== '') {
        cost = parseFloat(rec.costingKg) || 0;
    } else {
        const isChina = rec.country === 'CHINA';
        const amount = parseFloat(rec.amount) || 0;
        const qty = parseFloat(rec.quantity) || 0;
        const bdtRate = parseFloat(rec.dollarRateBdt) || 0;
        const expense = parseFloat(rec.cfOtherExpense !== undefined ? rec.cfOtherExpense : 9) || 0;

        if (isChina) {
            const rateKgUsd = qty ? (amount / qty) : 0;
            const rateKgBdt = rateKgUsd * bdtRate;
            cost = rateKgBdt + expense;
        } else {
            const indTruckFare = parseFloat(rec.indTruckFare) || 0;
            const truckChangeFare = parseFloat(rec.truckChangeFare) || 0;
            const slofCf = parseFloat(rec.slofCf) || 0;
            const totalBill = rec.totalBill !== undefined ? parseFloat(rec.totalBill) : (amount + indTruckFare + truckChangeFare + slofCf);
            const rebatePct = parseFloat(rec.rebate !== undefined ? rec.rebate : (rec.redate !== undefined ? rec.redate : 2.9)) || 0;
            const rebateAmount = rec.rebateAmount !== undefined ? parseFloat(rec.rebateAmount) : (rec.redateAmount !== undefined ? parseFloat(rec.redateAmount) : ((totalBill * rebatePct) / 100));
            const netBill = rec.netBill !== undefined && rec.netBill !== null && rec.netBill !== '' ? parseFloat(rec.netBill) : (totalBill - rebateAmount);
            const rateKg = qty ? (netBill / qty) : 0;
            const dollarRate = parseFloat(rec.rsToDollar) || 0;
            const rateKgUsd = dollarRate ? (rateKg / dollarRate) : 0;
            const rateKgBdt = rateKgUsd * bdtRate;
            cost = rateKgBdt + expense;
        }
    }
    return Math.round(cost * 100) / 100;
};

/**
 * Helper to calculate Net Bill in BDT for a Cost of Goods (COG) record.
 * Net Bill BDT = Cost/KG (BDT) * Quantity (KG).
 */
export const getCogNetBillBdt = (rec) => {
    if (!rec) return 0;
    const qty = parseFloat(rec.quantity) || 0;
    const costingKg = getRecCostingKg(rec);
    return costingKg * qty;
};

export const isProductMatch = (p1, p2) => {
    if (!p1 || !p2) return false;
    const s1 = String(p1).toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = String(p2).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!s1 || !s2) return false;
    if (s1 === s2) return true;
    if (s1.includes(s2) || s2.includes(s1)) return true;
    const w1 = String(p1).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    const w2 = String(p2).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    return w1.some(w => w2.includes(w));
};

const adjustedLcValuesCache = new Map();

export const clearAdjustedLcValuesCache = () => {
    adjustedLcValuesCache.clear();
};

/**
 * Calculate adjusted LC values (received qty, bill value USD, total value BDT).
 * Matches the TOTAL VALUE column in the LC Management table.
 */
export const getAdjustedLcValues = (record, allStockRecords = [], allSalesRecords = [], allCostOfGoodsRecords = []) => {
    if (!record) return { adjustedTotalAmount: 0, billValueUsd: 0, dollarRate: 0, openingValue: 0 };

    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };
    const cleanLc = (val) => String(val || '').replace(/\D/g, '');
    const lcNoClean = cleanLc(record.lcNo);

    // Fast Cache Check
    const lcId = record._id || record.id || record.lcNo || '';
    const cacheKey = `${lcId}_${record.updatedAt || ''}_${record.updatedLcReceive || ''}_${record.updatedDollarRate || record.dollarRate || ''}_${record.enableValueQtyAdjustment ? 1 : 0}_${(record.productsList || []).length}_${allStockRecords.length}_${allSalesRecords.length}_${allCostOfGoodsRecords.length}`;
    if (adjustedLcValuesCache.has(cacheKey)) {
        return adjustedLcValuesCache.get(cacheKey);
    }

    const totalQtyTons = record.productsList && record.productsList.length > 0
        ? record.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0)
        : (parseFloat(record.quantity) || 0);
    const openingQtyKg = totalQtyTons * 1000;
    const openingValue = parseFloat(record.totalAmount) || 0;

    // Pre-filter stocks and border sales for this LC ONCE instead of in every loop
    const matchingStocks = allStockRecords.filter(s => {
        const recordLcNoClean = cleanLc(s.lcNo);
        const status = (s.status || '').toLowerCase();
        return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
    });

    const matchingBorderSales = allSalesRecords.filter(s => {
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
    });

    const receiptsMapForBalance = {};
    matchingStocks.forEach(s => {
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

    const borderSaleQtyKg = matchingBorderSales.reduce((sum, s) => {
        const itemSubtotal = (s.items || []).reduce((iSum, item) => {
            const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
            return iSum + (brandSubtotal || parseNum(item.quantity));
        }, 0);
        return sum + (parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal);
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

    const timeline = getLCHistoryTimeline(record);
    const latestMilestone = timeline[timeline.length - 1] || {};
    const totalDollar = getMilestoneTotalDollar(latestMilestone, record);
    const dollarRate = parseFloat(record.updatedDollarRate || record.dollarRate || latestMilestone.dollarRate || 0);

    const matchingCogRecords = (allCostOfGoodsRecords || []).filter(cog => cleanLc(cog.lcNo) === lcNoClean);
    const totalCogNetBill = matchingCogRecords.reduce((sum, rec) => sum + getCogNetBillBdt(rec, dollarRate), 0);

    const getRatePerTon = (rVal) => {
        const r = parseFloat(rVal) || 0;
        return r > 0 && r < 10 ? r * 1000 : r;
    };
    const getFreightPerTon = (fVal) => {
        const f = parseFloat(fVal) || 0;
        return f > 0 && f < 0.1 ? f * 1000 : f;
    };

    const getProductReceivedQtyKg = (pName) => {
        const receiptsMap = {};
        matchingStocks.forEach(s => {
            const rawDate = s.date || s.receiveDate || s.createdAt || '';
            const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
            const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
            const key = `${dateStr}_${groupVal}`;
            if (s.entries && s.entries.length > 0) {
                const matchingEntries = s.entries.filter(item => {
                    const itemPName = item.productName || s.productName || s.product || '';
                    return !pName || isProductMatch(pName, itemPName);
                });
                const itemQty = matchingEntries.reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                receiptsMap[key] = (receiptsMap[key] || 0) + itemQty;
            } else {
                const rootPName = s.productName || s.product || '';
                if (!pName || isProductMatch(pName, rootPName)) {
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

        const bQty = matchingBorderSales.reduce((sum, s) => {
            if (s.items && s.items.length > 0) {
                const matchingItems = s.items.filter(item => {
                    const itemPName = item.productName || s.productName || s.product || '';
                    return !pName || isProductMatch(pName, itemPName);
                });
                const itemSubtotal = matchingItems.reduce((iSum, item) => {
                    const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                    return iSum + (brandSubtotal || parseNum(item.quantity));
                }, 0);
                return sum + itemSubtotal;
            } else {
                const rootPName = s.productName || s.product || '';
                if (!pName || isProductMatch(pName, rootPName)) {
                    return sum + (parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total));
                }
                return sum;
            }
        }, 0);

        return rQty + bQty;
    };

    const originalLc = timeline.find(m => m.isOriginal) || timeline[0] || record;
    const origProducts = (originalLc.productsList && originalLc.productsList.length > 0)
        ? originalLc.productsList
        : (record.productsList && record.productsList.length > 0 ? record.productsList : []);

    let billValueUsd = parseFloat(record.billValueUsd) || 0;
    if (billValueUsd === 0 && origProducts.length > 0) {
        const productRecMap = origProducts.map(p => ({
            product: p,
            recKg: getProductReceivedQtyKg(p.productName)
        }));
        const totalProdRecKg = productRecMap.reduce((sum, item) => sum + item.recKg, 0);

        origProducts.forEach(p => {
            let pRecQtyKg = 0;
            const pQtyKg = (parseFloat(p.quantity) || 0) * 1000;
            if (totalProdRecKg > 0) {
                const foundRec = productRecMap.find(item => item.product === p)?.recKg || 0;
                if (hasCustomReceive && totalReceivedQtyKg > 0 && totalProdRecKg > 0) {
                    pRecQtyKg = foundRec * (totalReceivedQtyKg / totalProdRecKg);
                } else {
                    pRecQtyKg = foundRec;
                }
            } else if (totalReceivedQtyKg > 0 && openingQtyKg > 0) {
                pRecQtyKg = totalReceivedQtyKg * (pQtyKg / openingQtyKg);
            } else if (totalReceivedQtyKg > 0) {
                pRecQtyKg = totalReceivedQtyKg / origProducts.length;
            }

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

    const combinedRemKg = adjustedQtyKg - totalReceivedQtyKg;
    const lessDollar = adjustedQtyKg > 0 ? (totalReceivedQtyKg / adjustedQtyKg) * billValueUsd : 0;

    const result = {
        openingQtyKg,
        openingValue,
        receivedQtyKg,
        borderSaleQtyKg,
        totalReceivedQtyKg,
        rawBalanceKg,
        adjustmentQtyKg,
        actualAdjustmentQtyKg,
        adjustedQtyKg,
        adjustedQtyTons: adjustedQtyKg / 1000,
        adjustedTotalAmount,
        combinedRemKg,
        isEnabled,
        totalDollar,
        billValueUsd,
        lessDollar,
        dollarRate
    };

    if (adjustedLcValuesCache.size > 500) {
        adjustedLcValuesCache.clear();
    }
    adjustedLcValuesCache.set(cacheKey, result);

    return result;
};

export const getLcMilestoneFinances = (lc, amendmentNo) => {
    if (!lc) return { grossPrem: 0, expReturn: 0 };
    const amnds = Array.isArray(lc.amendments) ? lc.amendments : [];
    const nonOrigAmnds = amnds.filter(a => a.amendmentNo !== 'Original LC');
    const origSnapshot = amnds.find(a => a.amendmentNo === 'Original LC');

    if (nonOrigAmnds.length === 0) {
        return {
            grossPrem: parseFloat(lc.grossPremium || 0),
            expReturn: parseFloat(lc.expectedReturnAmount || 0)
        };
    }

    if (amendmentNo === 'All (Entire LC)') {
        return {
            grossPrem: parseFloat(lc.grossPremium || 0),
            expReturn: parseFloat(lc.expectedReturnAmount || 0)
        };
    }

    if (amendmentNo && amendmentNo !== 'Original LC') {
        const matched = nonOrigAmnds.find(a => a.amendmentNo === amendmentNo);
        if (matched) {
            return {
                grossPrem: parseFloat(matched.grossPremium || 0),
                expReturn: parseFloat(matched.expectedReturnAmount || 0)
            };
        }
    }

    // Original LC (or when amendmentNo is not provided or is 'Original LC')
    if (origSnapshot) {
        return {
            grossPrem: parseFloat(origSnapshot.grossPremium || 0),
            expReturn: parseFloat(origSnapshot.expectedReturnAmount || 0)
        };
    }

    let sumAmndGross = 0;
    let sumAmndReturn = 0;
    nonOrigAmnds.forEach(a => {
        sumAmndGross += (parseFloat(a.grossPremium) || 0);
        sumAmndReturn += (parseFloat(a.expectedReturnAmount) || 0);
    });

    return {
        grossPrem: Math.max(0, (parseFloat(lc.grossPremium) || 0) - sumAmndGross),
        expReturn: Math.max(0, (parseFloat(lc.expectedReturnAmount) || 0) - sumAmndReturn)
    };
};

export const getLcMilestonesBreakdown = (lc, payments = []) => {
    if (!lc) return [];
    const amnds = Array.isArray(lc.amendments) ? lc.amendments : [];
    const nonOrigAmnds = amnds.filter(a => a.amendmentNo !== 'Original LC');
    const origSnapshot = amnds.find(a => a.amendmentNo === 'Original LC');
    const lcPayments = payments.filter(p => p.lcNo === lc.lcNo && p.status !== 'Requested');

    const evaluateStatus = (milGross, milNet, milReturn, matchedPayments) => {
        let paid = 0;
        let retCollected = 0;
        matchedPayments.forEach(p => {
            const amt = parseFloat(p.amount || 0);
            const adj = parseFloat(p.adjustedAmount || 0);
            if (p.type === 'Return Collection') {
                retCollected += amt;
            } else {
                paid += amt + adj;
                if (p.isAdjustReturn) {
                    retCollected += adj;
                }
            }
        });
        const isPremDone = paid >= (milNet - 1) || paid >= (milGross - 1);
        const isRetDone = milReturn <= 0 || retCollected >= (milReturn - 1);
        if (isPremDone && isRetDone) return 'complete';
        if (retCollected > 0 && paid > 0) return 'partial';
        if (retCollected > 0) return 'return recived';
        if (paid > 0) return 'premium paid';
        return 'not paid';
    };

    if (nonOrigAmnds.length === 0) {
        const gross = parseFloat(lc.grossPremium || 0);
        const net = parseFloat(lc.netPremium || 0);
        const expRet = parseFloat(lc.expectedReturnAmount || 0);
        const status = evaluateStatus(gross, net, expRet, lcPayments);
        return [{
            isOriginal: true,
            label: 'Original LC',
            date: formatDate(lc.openingDate),
            coverNote: lc.marineCoverNote || lc.coverNoteNo || lc.coverNote || '-',
            grossPremium: gross,
            netPremium: net,
            expectedReturnAmount: expRet,
            status
        }];
    }

    let sumAmndGross = 0;
    let sumAmndNet = 0;
    let sumAmndReturn = 0;
    nonOrigAmnds.forEach(a => {
        sumAmndGross += parseFloat(a.grossPremium || 0);
        sumAmndNet += parseFloat(a.netPremium || 0);
        sumAmndReturn += parseFloat(a.expectedReturnAmount || 0);
    });

    const origGross = origSnapshot
        ? parseFloat(origSnapshot.grossPremium || 0)
        : Math.max(0, parseFloat(lc.grossPremium || 0) - sumAmndGross);
    const origNet = origSnapshot
        ? parseFloat(origSnapshot.netPremium || 0)
        : Math.max(0, parseFloat(lc.netPremium || 0) - sumAmndNet);
    const origExpRet = origSnapshot
        ? parseFloat(origSnapshot.expectedReturnAmount || 0)
        : Math.max(0, parseFloat(lc.expectedReturnAmount || 0) - sumAmndReturn);

    const origPayments = lcPayments.filter(p => !p.amendmentNo || p.amendmentNo === 'Original LC');
    const origStatus = evaluateStatus(origGross, origNet, origExpRet, origPayments);

    const milestones = [
        {
            isOriginal: true,
            label: 'Original LC',
            date: formatDate(origSnapshot?.amendmentDate || lc.openingDate),
            coverNote: origSnapshot?.marineCoverNote || lc.marineCoverNote || lc.coverNoteNo || '-',
            grossPremium: origGross,
            netPremium: origNet,
            expectedReturnAmount: origExpRet,
            status: origStatus
        }
    ];

    nonOrigAmnds.forEach((a, idx) => {
        const amndGross = parseFloat(a.grossPremium || 0);
        const amndNet = parseFloat(a.netPremium || 0);
        const amndExpRet = parseFloat(a.expectedReturnAmount || 0);
        const amndPayments = lcPayments.filter(p => p.amendmentNo === a.amendmentNo);
        const amndStatus = evaluateStatus(amndGross, amndNet, amndExpRet, amndPayments);

        milestones.push({
            isOriginal: false,
            label: a.amendmentNo || `Amendment-${String(idx + 1).padStart(2, '0')}`,
            date: formatDate(a.amendmentDate || a.addnDate || a.date),
            coverNote: a.addnNo || a.revisedCoverNoteNo || a.revisedCoverNote || a.marineCoverNote || a.amendmentNo,
            grossPremium: amndGross,
            netPremium: amndNet,
            expectedReturnAmount: amndExpRet,
            status: amndStatus
        });
    });

    return milestones;
};

/**
 * Calculates LC conclusion metrics matching the report conclusion summary statement.
 */
export const calculateLcConclusion = ({
    selectedLc,
    adjustedLcValues,
    selectedLcCostOfGoods = [],
    totalLcCostOfGoodsQty = 0,
    totalLcCostOfGoodsAmount = 0,
    selectedLcExpenses = [],
    totalLcExpensesAmount = 0,
    selectedLcStocks = [],
    selectedLcSales = [],
    totalLcSalesAmount = 0,
    totalLcSalesQty = 0,
    productSummary = [],
    profitLossData = null,
    selectedLcDamages = [],
    totalLcDamagesQty = 0
}) => {
    if (!selectedLc) return null;

    const adjValues = adjustedLcValues || (typeof getAdjustedLcValues === 'function' ? getAdjustedLcValues(selectedLc, selectedLcStocks, selectedLcSales) : null);

    const lcNo = selectedLc.lcNo || '-';

    const item = (productSummary && productSummary.length > 0)
        ? productSummary.map(p => p.productName).filter(Boolean).join(', ')
        : (selectedLc.productsList && selectedLc.productsList.length > 0
            ? selectedLc.productsList.map(p => p.productName || p.product || p.name).filter(Boolean).join(', ')
            : (selectedLc.productName || selectedLc.item || selectedLc.product || '-'));

    const supplier = selectedLc.exporterName || selectedLc.supplier || selectedLc.supplierName || '-';

    // Total LC Value (USD)
    const rawTotalLcValue = (typeof getMilestoneTotalDollar === 'function' ? getMilestoneTotalDollar(selectedLc) : 0)
        || parseFloat(selectedLc.totalDollar || selectedLc.lcValueUsd || selectedLc.lcValue || selectedLc.amountUsd || 0)
        || (selectedLc.productsList && selectedLc.productsList.length > 0
            ? selectedLc.productsList.reduce((sum, p) => sum + (parseFloat(p.totalDollar) || ((parseFloat(p.quantity) || 0) * (parseFloat(p.rate) || 0))), 0)
            : 0);
    const totalLcValue = Math.abs(rawTotalLcValue - Math.round(rawTotalLcValue)) < 0.1
        ? Math.round(rawTotalLcValue)
        : Math.round(rawTotalLcValue * 100) / 100;

    const rawBillUsd = parseFloat(adjValues?.billValueUsd || 0)
        || parseFloat(selectedLc.totalDollar || selectedLc.lcValueUsd || selectedLc.lcValue || selectedLc.amountUsd || 0);
    const billValueUsd = Math.abs(rawBillUsd - Math.round(rawBillUsd)) < 0.1
        ? Math.round(rawBillUsd)
        : Math.round(rawBillUsd * 100) / 100;

    const dollarRate = parseFloat(adjValues?.dollarRate || selectedLc.dollarRate || selectedLc.openingDollarRate || selectedLc.exchangeRate || 0);

    const totalRateKgBdt = (totalLcValue > 0 && dollarRate > 0)
        ? Math.round(totalLcValue * dollarRate)
        : ((billValueUsd > 0 && dollarRate > 0)
            ? Math.round(billValueUsd * dollarRate)
            : (parseFloat(adjValues?.adjustedTotalAmount || 0) || parseFloat(selectedLc.totalAmount || 0)));

    // 1. LC Inv Qty in kg = Total COG qty
    const cogQtySum = (parseFloat(totalLcCostOfGoodsQty) || 0)
        || (selectedLcCostOfGoods && selectedLcCostOfGoods.length > 0
            ? selectedLcCostOfGoods.reduce((sum, r) => sum + (parseFloat(r.quantity) || 0), 0)
            : 0);

    const invQtyKg = cogQtySum > 0
        ? cogQtySum
        : (parseFloat(adjValues?.openingQtyKg || 0)
            || (selectedLc.productsList && selectedLc.productsList.length > 0
                ? selectedLc.productsList.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0) * 1000
                : (parseFloat(selectedLc.quantity || 0) * 1000))
            || (productSummary.length > 0
                ? productSummary.reduce((sum, p) => sum + (parseFloat(p.purchaseQty) || 0), 0)
                : 0));

    // 2. Rcv Qty in kg = Total Received inhouse qty
    const inhouseFromSummary = (productSummary && productSummary.length > 0)
        ? productSummary.reduce((sum, p) => sum + (parseFloat(p.inhouseQty) || 0), 0)
        : 0;

    const inhouseFromStocks = (selectedLcStocks && selectedLcStocks.length > 0)
        ? selectedLcStocks.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0;
            const shortQty = parseFloat(item.sweepedQuantity) || 0;
            const inhouseQty = (item.inHouseQuantity !== undefined && item.inHouseQuantity !== null && item.inHouseQuantity !== '')
                ? (parseFloat(item.inHouseQuantity) || 0)
                : Math.max(0, qty - shortQty);
            return sum + inhouseQty;
        }, 0)
        : 0;

    const rcvQtyKg = inhouseFromSummary > 0
        ? inhouseFromSummary
        : (inhouseFromStocks > 0
            ? inhouseFromStocks
            : (parseFloat(adjValues?.totalReceivedQtyKg || 0) || invQtyKg));

    // 3. Insurance
    const insuranceExpenses = (selectedLcExpenses || []).filter(e => (e.expenseHead || '').toLowerCase().includes('insurance'));
    const insuranceAmount = insuranceExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
        || parseFloat(selectedLc.insurance || selectedLc.netPremium || selectedLc.grossPremium || 0);

    // 4. CnF & Others (BDT)
    let cnfAndOthersPerKg = 0;
    let cnfAndOthersBdt = 0;

    // Check if Cost of Goods records have cfOtherExpense specified
    const totalCnfFromCog = (selectedLcCostOfGoods || []).reduce((sum, rec) => {
        const expensePerKg = parseFloat(rec.cfOtherExpense !== undefined && rec.cfOtherExpense !== null ? rec.cfOtherExpense : 0) || 0;
        const qty = parseFloat(rec.quantity) || 0;
        return sum + (expensePerKg * qty);
    }, 0);

    if (totalCnfFromCog > 0 && cogQtySum > 0) {
        cnfAndOthersPerKg = totalCnfFromCog / cogQtySum;
        cnfAndOthersBdt = rcvQtyKg > 0 ? (cnfAndOthersPerKg * rcvQtyKg) : totalCnfFromCog;
    } else {
        const expensesTotal = totalLcExpensesAmount || (selectedLcExpenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const expensesExcludingInsurance = Math.max(0, expensesTotal - insuranceAmount);
        cnfAndOthersBdt = expensesExcludingInsurance;
        cnfAndOthersPerKg = rcvQtyKg > 0 ? (cnfAndOthersBdt / rcvQtyKg) : (invQtyKg > 0 ? (cnfAndOthersBdt / invQtyKg) : 0);
    }

    // 5. Overall rate per kg in BDT: use the Average Cost/KG from Cost of Goods (COG) (Net Bill / Quantity) if available
    const cogNetBillTotal = (parseFloat(totalLcCostOfGoodsAmount) || 0)
        || (selectedLcCostOfGoods && selectedLcCostOfGoods.length > 0
            ? selectedLcCostOfGoods.reduce((sum, rec) => {
                const costingKg = typeof getRecCostingKg === 'function'
                    ? getRecCostingKg(rec)
                    : (Math.round(parseFloat(rec.costingKg || 0) * 100) / 100);
                const qty = parseFloat(rec.quantity || 0);
                return sum + Math.round(costingKg * qty);
            }, 0)
            : 0);

    const cogAvgCostKg = (cogQtySum > 0 && cogNetBillTotal > 0)
        ? (cogNetBillTotal / cogQtySum)
        : 0;

    const totalCogBdt = cogNetBillTotal > 0
        ? Math.round(cogNetBillTotal)
        : Math.round(totalRateKgBdt + (cnfAndOthersBdt || 0));

    const totalRatePerKgBdt = cogAvgCostKg > 0
        ? cogAvgCostKg
        : (rcvQtyKg > 0 ? (totalRateKgBdt / rcvQtyKg) : (invQtyKg > 0 ? (totalRateKgBdt / invQtyKg) : 0));

    // 6. Base Rate/kg in BDT: Since C&F (1.50) is included in rate/kg, Base Rate = Total Rate - CnF
    const rateKgBdt = Math.max(0, totalRatePerKgBdt - cnfAndOthersPerKg);

    // 7. Sales Qty in kg
    const salesQtyKg = parseFloat(totalLcSalesQty || 0)
        || (selectedLcSales.length > 0
            ? selectedLcSales.reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0)
            : (productSummary.length > 0
                ? productSummary.reduce((sum, p) => sum + (parseFloat(p.saleQty) || 0), 0)
                : 0));

    // 8. Damage Qty in kg
    const damageFromSummary = (productSummary && productSummary.length > 0)
        ? productSummary.reduce((sum, p) => sum + (parseFloat(p.damageQty) || 0), 0)
        : 0;

    const damageFromRecords = (selectedLcDamages && selectedLcDamages.length > 0)
        ? selectedLcDamages.reduce((sum, d) => sum + (parseFloat(d.quantity || d.itemQty) || 0), 0)
        : 0;

    const damageQtyKg = damageFromSummary > 0
        ? damageFromSummary
        : (damageFromRecords > 0
            ? damageFromRecords
            : (parseFloat(totalLcDamagesQty || 0) || parseFloat(selectedLc?.damageQty || 0)));

    // 9. Short Qty in kg = LC Inv Qty in kg - Rcv Qty in kg
    const shortQtyKg = Math.max(0, invQtyKg - rcvQtyKg);

    // 10. Unsold Stock in kg = Rcv Qty in kg - Sales Qty in kg - Damage Qty in kg
    const unsoldStockKg = Math.max(0, rcvQtyKg - salesQtyKg - damageQtyKg);

    // 11. LC Invest = LC Inv Qty in kg * Total Rate/kg in BDT
    const lcInvest = (invQtyKg > 0 && totalRatePerKgBdt > 0)
        ? Math.round(invQtyKg * totalRatePerKgBdt)
        : totalRateKgBdt;

    // 12. Total Invest = LC Invest + Insurance
    const totalInvest = lcInvest + insuranceAmount;

    // 13. Sales Value
    const salesValue = parseFloat(totalLcSalesAmount || 0) || parseFloat(profitLossData?.summary?.salesRevenue || 0);

    // 14. Sales Value/kg
    const salesValuePerKg = salesQtyKg > 0 ? (salesValue / salesQtyKg) : 0;

    // 15. Unsold Stock Price (Appx) = Unsold Stock in kg * Sales Value/kg
    const unsoldStockPriceAppx = unsoldStockKg > 0
        ? (salesValuePerKg > 0
            ? Math.round(unsoldStockKg * salesValuePerKg)
            : (parseFloat(profitLossData?.summary?.currentStockValue || 0) || Math.round(unsoldStockKg * totalRatePerKgBdt)))
        : 0;

    // 16. Profit/Loss
    const profitOrLoss = (salesValue + unsoldStockPriceAppx) - totalInvest;

    return {
        lcNo,
        item,
        supplier,
        totalLcValue,
        billValueUsd,
        dollarRate,
        totalRateKgBdt,
        totalCogBdt,
        invQtyKg,
        rcvQtyKg,
        rateKgBdt,
        cnfAndOthersPerKg,
        cnfAndOthersBdt,
        totalRatePerKgBdt,
        shortQtyKg,
        damageQtyKg,
        salesQtyKg,
        unsoldStockKg,
        lcInvest,
        insuranceAmount,
        totalInvest,
        salesValue,
        salesValuePerKg,
        unsoldStockPriceAppx,
        profitOrLoss
    };
};

