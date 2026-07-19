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
 * Calculate adjusted LC values (received qty, bill value USD, total value BDT).
 * Matches the TOTAL VALUE column in the LC Management table.
 */
export const getAdjustedLcValues = (record, allStockRecords = [], allSalesRecords = []) => {
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
                let itemQty = 0;
                if (s.entries && s.entries.length > 0) {
                    const matchingEntries = s.entries.filter(item => {
                        const itemPName = (item.productName || s.productName || s.product || '').trim().toLowerCase();
                        return !cleanPName || itemPName === cleanPName;
                    });
                    itemQty = matchingEntries.reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                } else {
                    const rootPName = (s.productName || s.product || '').trim().toLowerCase();
                    if (!cleanPName || !rootPName || rootPName === cleanPName) {
                        itemQty = parseNum(s.totalLcQuantity) || parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                    }
                }
                receiptsMap[key] = (receiptsMap[key] || 0) + itemQty;
            });
        const rQty = Object.values(receiptsMap).reduce((sum, qty) => sum + qty, 0);

        const bQty = allSalesRecords
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

    let billValueUsd = 0;
    if (origProducts.length > 0) {
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

    const adjustedTotalAmount = dollarRate > 0
        ? billValueUsd * dollarRate
        : (isEnabled && openingQtyKg > 0
            ? openingValue + (actualAdjustmentQtyKg * (openingValue / openingQtyKg))
            : openingValue);

    const combinedRemKg = adjustedQtyKg - totalReceivedQtyKg;
    const lessDollar = adjustedQtyKg > 0 ? (totalReceivedQtyKg / adjustedQtyKg) * billValueUsd : 0;

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
        adjustedQtyTons: adjustedQtyKg / 1000,
        adjustedTotalAmount,
        combinedRemKg,
        isEnabled,
        totalDollar,
        billValueUsd,
        lessDollar,
        dollarRate
    };
};
