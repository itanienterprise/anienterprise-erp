// Helper to parse numbers safely and handle potential strings with commas
export const safeParse = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

export const isLcMatch = (targetLc, filterLc) => {
    if (!filterLc) return true;
    if (!targetLc) return false;
    const rawTarget = targetLc.toString().trim().toLowerCase();
    const rawFilter = filterLc.toString().trim().toLowerCase();
    if (!rawTarget || !rawFilter) return false;
    if (rawTarget === rawFilter) return true;

    // Allow generic "purchase" or "pur" to match any purchase "pur-..."
    if ((rawTarget === 'purchase' || rawTarget === 'pur') && (rawFilter.startsWith('pur-') || rawFilter.startsWith('purchase'))) return true;
    if ((rawFilter === 'purchase' || rawFilter === 'pur') && (rawTarget.startsWith('pur-') || rawTarget.startsWith('purchase'))) return true;

    const cleanTarget = rawTarget.replace(/^(lc|pur|purchase)[-_\s]*/i, '').replace(/^0+/, '');
    const cleanFilter = rawFilter.replace(/^(lc|pur|purchase)[-_\s]*/i, '').replace(/^0+/, '');

    if (cleanTarget && cleanFilter && (cleanTarget === cleanFilter || cleanTarget.endsWith(cleanFilter) || cleanFilter.endsWith(cleanTarget))) return true;
    return false;
};

// Helper to group split brand entries by quality & brand name to avoid split-induced inflation in subtotals/totals
export const getGroupedBrandList = (brandList) => {
    if (!Array.isArray(brandList)) return [];
    const groups = {};
    brandList.forEach(b => {
        const cleanBrand = (b.brand || 'No Brand').trim();
        const cleanQuality = (b.quality || '-').trim();
        const key = `${cleanQuality.toLowerCase()}_${cleanBrand.toLowerCase()}`;
        if (!groups[key]) {
            const { openingQuantity, openingPacket, periodArrivalQuantity, periodArrivalPacket, saleQuantity, salePacket, orderQuantity, orderPacket, saleableQuantity, saleablePacket, sweepedQuantity, sweepedPacket, damageQuantity, damagePacket, inHouseQuantity, inHousePacket, totalInHouseQuantity, totalInHousePacket, closingQuantity, closingPacket, ...rest } = b;
            groups[key] = {
                ...rest,
                brand: cleanBrand,
                quality: cleanQuality,
                openingQuantity: 0,
                openingPacket: 0,
                periodArrivalQuantity: 0,
                periodArrivalPacket: 0,
                saleQuantity: 0,
                salePacket: 0,
                orderQuantity: 0,
                orderPacket: 0,
                saleableQuantity: 0,
                saleablePacket: 0,
                sweepedQuantity: 0,
                sweepedPacket: 0,
                damageQuantity: 0,
                damagePacket: 0,
                inHouseQuantity: 0,
                inHousePacket: 0,
                totalInHouseQuantity: 0,
                totalInHousePacket: 0,
                closingQuantity: 0,
                closingPacket: 0
            };
        }
        groups[key].openingQuantity += b.openingQuantity || 0;
        groups[key].openingPacket += b.openingPacket || 0;
        groups[key].periodArrivalQuantity += b.periodArrivalQuantity || 0;
        groups[key].periodArrivalPacket += b.periodArrivalPacket || 0;
        groups[key].saleQuantity += b.saleQuantity || 0;
        groups[key].salePacket += b.salePacket || 0;
        groups[key].orderQuantity += b.orderQuantity || 0;
        groups[key].orderPacket += b.orderPacket || 0;
        groups[key].sweepedQuantity += b.sweepedQuantity || 0;
        groups[key].sweepedPacket += b.sweepedPacket || 0;
        groups[key].damageQuantity += b.damageQuantity || 0;
        groups[key].damagePacket += b.damagePacket || 0;
        groups[key].inHouseQuantity += (b.closingQuantity !== undefined ? b.closingQuantity : (b.inHouseQuantity || 0));
        groups[key].inHousePacket += (b.closingPacket !== undefined ? b.closingPacket : (b.inHousePacket || 0));
        groups[key].totalInHouseQuantity += b.totalInHouseQuantity || 0;
        groups[key].totalInHousePacket += b.totalInHousePacket || 0;
        groups[key].closingQuantity += (b.closingQuantity !== undefined ? b.closingQuantity : (b.inHouseQuantity || 0));
        groups[key].closingPacket += (b.closingPacket !== undefined ? b.closingPacket : (b.inHousePacket || 0));
        groups[key].saleableQuantity += b.saleableQuantity || 0;
        groups[key].saleablePacket += b.saleablePacket || 0;
    });

    Object.values(groups).forEach(g => {
        g.closingQuantity = Math.max(0, g.closingQuantity);
        g.closingPacket = Math.max(0, g.closingPacket);
        g.inHouseQuantity = g.closingQuantity;
        g.inHousePacket = g.closingPacket;
        g.saleableQuantity = Math.max(0, g.closingQuantity - g.orderQuantity);
        g.saleablePacket = Math.max(0, g.closingPacket - g.orderPacket);
    });

    return Object.values(groups).sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
};


// Helper for robust packet and weight remainder calculation (fixing 4,999 - 60 kg issue)
export const calculatePktRemainder = (totalQty, pktSize) => {
    const qty = safeParse(totalQty);
    const size = safeParse(pktSize);
    if (size <= 0) return { whole: 0, remainder: qty };

    if (qty >= 0) {
        // Use a small epsilon to handle floating point precision
        const rawPkt = qty / size;
        const whole = Math.floor(rawPkt + 1e-9);
        const remainder = Math.max(0, Math.round(qty - (whole * size)));

        // Final rollover check
        if (remainder >= size) {
            return { whole: whole + 1, remainder: 0 };
        }
        return { whole, remainder };
    } else {
        // Handle negative quantities (pre-sales) for CROP category
        const absQty = Math.abs(qty);
        const rawPkt = absQty / size;
        const whole = Math.floor(rawPkt + 1e-9);
        const remainder = Math.max(0, Math.round(absQty - (whole * size)));

        if (remainder >= size) {
            return { whole: -(whole + 1), remainder: 0 };
        }
        return { whole: -whole, remainder: -remainder };
    }
};

// Helper to reconcile LC breakdown in Price Report mode against true brand-level remaining stock
export const reconcilePriceReportBrandList = (brandList) => {
    if (!Array.isArray(brandList)) return [];

    // Group entries by quality and brand to determine true total stock
    const brandGroups = {};
    brandList.forEach(b => {
        const cleanBrand = (b.brand || 'No Brand').trim();
        const cleanQuality = (b.quality || '-').trim();
        const key = `${cleanQuality.toLowerCase()}_${cleanBrand.toLowerCase()}`;
        if (!brandGroups[key]) {
            brandGroups[key] = {
                brand: cleanBrand,
                quality: cleanQuality,
                totalClosing: 0,
                entries: []
            };
        }
        const closing = (b.closingQuantity !== undefined ? b.closingQuantity : (b.inHouseQuantity || 0));
        brandGroups[key].totalClosing += closing;

        // Consolidate duplicate LC/Price entries within the brand
        const cleanLc = (b.lcNo || '').trim();
        const price = safeParse(b.purchasedPrice ?? b.rate);

        const existingIdx = brandGroups[key].entries.findIndex(e => {
            const eLc = (e.lcNo || '').trim().toLowerCase();
            const ePrice = safeParse(e.purchasedPrice ?? e.rate);
            return eLc === cleanLc.toLowerCase() && Math.abs(ePrice - price) < 0.001;
        });

        if (existingIdx >= 0) {
            const existing = brandGroups[key].entries[existingIdx];
            existing.openingQuantity = (existing.openingQuantity || 0) + (b.openingQuantity || 0);
            existing.openingPacket = (existing.openingPacket || 0) + (b.openingPacket || 0);
            existing.periodArrivalQuantity = (existing.periodArrivalQuantity || 0) + (b.periodArrivalQuantity || 0);
            existing.periodArrivalPacket = (existing.periodArrivalPacket || 0) + (b.periodArrivalPacket || 0);
            existing.saleQuantity = (existing.saleQuantity || 0) + (b.saleQuantity || 0);
            existing.salePacket = (existing.salePacket || 0) + (b.salePacket || 0);
            existing.orderQuantity = (existing.orderQuantity || 0) + (b.orderQuantity || 0);
            existing.orderPacket = (existing.orderPacket || 0) + (b.orderPacket || 0);
            existing.sweepedQuantity = (existing.sweepedQuantity || 0) + (b.sweepedQuantity || 0);
            existing.sweepedPacket = (existing.sweepedPacket || 0) + (b.sweepedPacket || 0);
            existing.damageQuantity = (existing.damageQuantity || 0) + (b.damageQuantity || 0);
            existing.damagePacket = (existing.damagePacket || 0) + (b.damagePacket || 0);
            existing.inHouseQuantity = (existing.inHouseQuantity || 0) + (b.inHouseQuantity || 0);
            existing.inHousePacket = (existing.inHousePacket || 0) + (b.inHousePacket || 0);
            existing.closingQuantity = (existing.closingQuantity || 0) + (b.closingQuantity || 0);
            existing.closingPacket = (existing.closingPacket || 0) + (b.closingPacket || 0);
        } else {
            brandGroups[key].entries.push({ ...b });
        }
    });

    const result = [];

    Object.values(brandGroups).forEach(group => {
        const trueInHouse = Math.max(0, group.totalClosing);
        if (trueInHouse <= 0.001) {
            // Brand is out of stock - no entries should appear in Price report
            return;
        }

        // Keep entries that represent actual stock arrival / positive stock
        const validEntries = group.entries.filter(e =>
            (e.openingQuantity || 0) > 0 || (e.inHouseQuantity || 0) > 0 || (e.closingQuantity || 0) > 0
        );

        if (validEntries.length === 0) return;

        // Sort entries by date (FIFO: oldest arrivals first)
        const sortedEntries = [...validEntries].sort((a, b) => {
            const dateA = a.date || a.createdAt || '';
            const dateB = b.date || b.createdAt || '';
            return dateA.localeCompare(dateB);
        });

        const currentLcSum = sortedEntries.reduce((sum, e) => sum + Math.max(0, e.inHouseQuantity || 0), 0);
        let excessToDeduct = Math.max(0, currentLcSum - trueInHouse);

        for (const entry of sortedEntries) {
            const currentQty = Math.max(0, entry.inHouseQuantity || 0);
            const deduct = Math.min(currentQty, excessToDeduct);
            excessToDeduct -= deduct;
            const remainingQty = currentQty - deduct;

            if (remainingQty > 0.001) {
                const pktSize = entry.packetSize || 30;
                const { whole, remainder } = calculatePktRemainder(remainingQty, pktSize);
                const inHousePacket = whole + (remainder / pktSize);

                result.push({
                    ...entry,
                    inHouseQuantity: remainingQty,
                    closingQuantity: remainingQty,
                    inHousePacket: inHousePacket,
                    closingPacket: inHousePacket,
                    saleableQuantity: Math.max(0, remainingQty - (entry.orderQuantity || 0)),
                    saleablePacket: Math.max(0, inHousePacket - (entry.orderPacket || 0))
                });
            }
        }
    });

    return result.sort((a, b) => {
        const qCmp = (a.quality || '-').localeCompare(b.quality || '-');
        if (qCmp !== 0) return qCmp;
        const bCmp = (a.brand || '').localeCompare(b.brand || '');
        if (bCmp !== 0) return bCmp;
        return (a.lcNo || '').localeCompare(b.lcNo || '');
    });
};

export const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = [], products = [], damages = [], activeBaseline = null) => {
    const isPriceReport = Boolean(stockFilters && (stockFilters.reportType === 'price' || stockFilters.showRate === true));

    const isWhFilter = stockFilters && stockFilters.warehouse &&
        typeof stockFilters.warehouse === 'string' &&
        stockFilters.warehouse.trim() !== '' &&
        stockFilters.warehouse.trim().toLowerCase() !== 'all' &&
        stockFilters.warehouse.trim().toLowerCase() !== 'all warehouses' &&
        stockFilters.warehouse.trim().toLowerCase() !== 'all warehouse';

    if (!isWhFilter && (!stockFilters || !stockFilters._isSubCall)) {
        const whSet = new Set();
        (warehouseData || []).forEach(w => {
            const name = (w.name || w.whName || w.warehouse || '').trim();
            if (name && name !== 'Inventory Adjustment') whSet.add(name);
            const fromName = (w.fromWh || '').trim();
            if (fromName && fromName !== 'Inventory Adjustment') whSet.add(fromName);
            const toName = (w.toWh || '').trim();
            if (toName && toName !== 'Inventory Adjustment') whSet.add(toName);
        });
        (stockRecords || []).forEach(s => {
            const name = (s.name || s.whName || s.warehouse || '').trim();
            if (name && name !== 'Inventory Adjustment') whSet.add(name);
        });
        if (activeBaseline && activeBaseline.status === 'active' && Array.isArray(activeBaseline.snapshotRecords)) {
            activeBaseline.snapshotRecords.forEach(s => {
                const name = (s.warehouse || s.whName || '').trim();
                if (name && name !== 'Inventory Adjustment') whSet.add(name);
            });
        }
        const whList = Array.from(whSet);

        if (whList.length > 0) {
            const combinedProductsMap = {};
            whList.forEach(whName => {
                const subFilters = { ...(stockFilters || {}), warehouse: whName, _isSubCall: true };
                const whRes = calculateStockData(stockRecords, subFilters, stockSearchQuery, warehouseData, salesRecords, products, damages, activeBaseline);
                (whRes.displayRecords || []).forEach(rec => {
                    const pName = rec.productName;
                    if (!combinedProductsMap[pName]) {
                        combinedProductsMap[pName] = {
                            ...rec,
                            brandList: []
                        };
                    }
                    (rec.brandList || []).forEach(b => {
                        const safeInHouseQty = Math.max(0, b.inHouseQuantity || 0);
                        const safeInHousePkt = Math.max(0, b.inHousePacket || 0);
                        const safeClosingQty = Math.max(0, b.closingQuantity || 0);
                        const safeClosingPkt = Math.max(0, b.closingPacket || 0);
                        const safeOpeningQty = Math.max(0, b.openingQuantity || 0);
                        const safeOpeningPkt = Math.max(0, b.openingPacket || 0);

                        combinedProductsMap[pName].brandList.push({
                            ...b,
                            inHouseQuantity: safeInHouseQty,
                            inHousePacket: safeInHousePkt,
                            closingQuantity: safeClosingQty,
                            closingPacket: safeClosingPkt,
                            openingQuantity: safeOpeningQty,
                            openingPacket: safeOpeningPkt,
                            totalInHouseQuantity: safeOpeningQty,
                            totalInHousePacket: safeOpeningPkt
                        });
                    });
                });
            });

            const displayRecords = Object.values(combinedProductsMap).map(prod => {
                let groupedBrands = isPriceReport
                    ? reconcilePriceReportBrandList(prod.brandList)
                    : getGroupedBrandList(prod.brandList);

                if (isPriceReport) {
                    groupedBrands = groupedBrands.filter(b => (b.inHouseQuantity || 0) > 0.001);
                } else if (stockFilters?.reportType === 'short') {
                    groupedBrands = groupedBrands.filter(b =>
                        (b.inHouseQuantity || 0) > 0.001 ||
                        (b.orderQuantity || 0) > 0.001
                    );
                }
                const inHouseQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.inHouseQuantity), 0);
                const inHousePkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.inHousePacket), 0);
                const openingQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.openingQuantity), 0);
                const openingPkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.openingPacket), 0);
                const saleQty = groupedBrands.reduce((sum, b) => sum + (b.saleQuantity || 0), 0);
                const salePkt = groupedBrands.reduce((sum, b) => sum + (b.salePacket || 0), 0);
                const orderQty = groupedBrands.reduce((sum, b) => sum + (b.orderQuantity || 0), 0);
                const orderPkt = groupedBrands.reduce((sum, b) => sum + (b.orderPacket || 0), 0);
                const saleableQty = Math.max(0, inHouseQty - orderQty);
                const saleablePkt = Math.max(0, inHousePkt - orderPkt);

                return {
                    ...prod,
                    brandList: groupedBrands,
                    openingQuantity: openingQty,
                    openingPacket: openingPkt,
                    inHouseQuantity: inHouseQty,
                    inHousePacket: inHousePkt,
                    saleQuantity: saleQty,
                    salePacket: salePkt,
                    orderQuantity: orderQty,
                    orderPacket: orderPkt,
                    saleableQuantity: saleableQty,
                    saleablePacket: saleablePkt
                };
            }).filter(prod => prod && prod.brandList && prod.brandList.length > 0).sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));

            let tOpeningQty = 0; let tSaleQty = 0; let tInHouseQty = 0; let tShortageQty = 0; let tDamageQty = 0;
            const tOpeningPkt = { whole: 0, remainder: 0 };
            const tSalePkt = { whole: 0, remainder: 0 };
            const tInHousePkt = { whole: 0, remainder: 0 };

            displayRecords.forEach(group => {
                group.brandList.forEach(b => {
                    tOpeningQty += Math.max(0, b.openingQuantity);
                    tSaleQty += b.saleQuantity || 0;
                    tInHouseQty += Math.max(0, b.inHouseQuantity);
                    tShortageQty += b.sweepedQuantity || 0;
                    tDamageQty += (b.damageQuantity || 0);

                    const op = calculatePktRemainder(Math.max(0, b.openingQuantity), b.packetSize);
                    tOpeningPkt.whole += op.whole; tOpeningPkt.remainder += op.remainder;

                    const sl = calculatePktRemainder(b.saleQuantity || 0, b.packetSize);
                    tSalePkt.whole += sl.whole; tSalePkt.remainder += sl.remainder;

                    const ih = calculatePktRemainder(Math.max(0, b.inHouseQuantity), b.packetSize);
                    tInHousePkt.whole += ih.whole; tInHousePkt.remainder += ih.remainder;
                });
            });

            const baselineCutoffIso = (activeBaseline && activeBaseline.status === 'active' && activeBaseline.baselineDate)
                ? activeBaseline.baselineDate
                : null;
            const isBaselineApplicable = Boolean(baselineCutoffIso);

            const isPreBaselineRecord = (recordDate, recordCreatedAt) => {
                if (!isBaselineApplicable) return false;
                if (activeBaseline && activeBaseline.createdAt && recordCreatedAt) {
                    const baselineCreatedMs = new Date(activeBaseline.createdAt).getTime();
                    const recordCreatedMs = new Date(recordCreatedAt).getTime();
                    if (!isNaN(baselineCreatedMs) && !isNaN(recordCreatedMs) && recordCreatedMs >= baselineCreatedMs) {
                        return false;
                    }
                }
                const rDate = (recordDate || recordCreatedAt || '').trim();
                if (!rDate) return false;
                const rTime = new Date(rDate).getTime();
                const bTime = new Date(baselineCutoffIso).getTime();
                if (!isNaN(rTime) && !isNaN(bTime)) return rTime < bTime;
                return rDate < baselineCutoffIso;
            };

            let cumulativeDamageQty = 0;
            if (Array.isArray(damages)) {
                damages.forEach(damage => {
                    if (isPreBaselineRecord(damage.date, damage.createdAt)) return;
                    const dDate = damage.date || damage.createdAt || '';
                    const dDateOnly = dDate.split('T')[0];
                    const endDate = stockFilters?.endDate || '';
                    if (endDate && dDateOnly > endDate) return;
                    cumulativeDamageQty += safeParse(damage.quantity);
                });
            }

            return {
                displayRecords,
                totalQuantity: tOpeningQty,
                totalSaleQty: tSaleQty,
                totalInHouseQty: tInHouseQty,
                totalShortage: tShortageQty,
                totalDamageQty: cumulativeDamageQty,
                totalOpeningPktWhole: tOpeningPkt.whole,
                totalOpeningPktRemainder: tOpeningPkt.remainder,
                totalArrivalPktWhole: 0,
                totalArrivalPktRemainder: 0,
                totalSalePktWhole: tSalePkt.whole,
                totalSalePktDecimalKg: tSalePkt.remainder,
                totalInHousePktWhole: tInHousePkt.whole,
                totalInHousePktDecimalKg: tInHousePkt.remainder,
                unit: displayRecords[0]?.unit || 'kg'
            };
        }
    }

    const resolveQuality = (pName, bName) => {
        if (!products || !Array.isArray(products)) return '-';
        const targetP = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === (pName || '').trim().toLowerCase());
        if (!targetP) return '-';
        if (bName) {
            const targetB = (targetP.brands || []).find(b => (b.brand || '').trim().toLowerCase() === (bName || '').trim().toLowerCase());
            if (targetB && targetB.quality && targetB.quality.trim() !== '') return targetB.quality.trim();
        }
        if (targetP.quality && targetP.quality.trim() !== '') return targetP.quality.trim();
        return '-';
    };

    const resolvePacketSize = (pName, bName, directSize) => {
        const direct = safeParse(directSize);
        if (direct > 0) return direct;
        if (!products || !Array.isArray(products)) return 30;
        const targetP = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === (pName || '').trim().toLowerCase());
        if (!targetP) return 30;
        if (bName) {
            const targetB = (targetP.brands || []).find(b => (b.brand || '').trim().toLowerCase() === (bName || '').trim().toLowerCase());
            if (targetB && targetB.packetSize && safeParse(targetB.packetSize) > 0) return safeParse(targetB.packetSize);
        }
        if (targetP.packetSize && safeParse(targetP.packetSize) > 0) return safeParse(targetP.packetSize);
        if (targetP.size && safeParse(targetP.size) > 0) return safeParse(targetP.size);
        return 30;
    };

    const rawExpanded = [];
    const seenRecords = new Set();
    const consumedSales = new Set(); // Track consumed sale entries to prevent double-counting across quality grades
    const consumedDamages = new Set(); // Track consumed damages to prevent double-counting

    const baselineCutoffIso = (activeBaseline && activeBaseline.status === 'active' && activeBaseline.baselineDate)
        ? activeBaseline.baselineDate
        : null;
    const isBaselineApplicable = Boolean(baselineCutoffIso);
    const baselineDateStr = (baselineCutoffIso || '').split('T')[0];
    const baselineCreatedMs = activeBaseline && activeBaseline.createdAt ? new Date(activeBaseline.createdAt).getTime() : NaN;

    const isPreBaselineRecord = (recordDate, recordCreatedAt) => {
        if (!isBaselineApplicable) return false;
        if (activeBaseline && activeBaseline.createdAt && recordCreatedAt) {
            const bCreatedMs = new Date(activeBaseline.createdAt).getTime();
            const recordCreatedMs = new Date(recordCreatedAt).getTime();
            if (!isNaN(bCreatedMs) && !isNaN(recordCreatedMs) && recordCreatedMs >= bCreatedMs) {
                return false;
            }
        }
        const rRaw = recordDate || recordCreatedAt || '';
        const rDate = (rRaw instanceof Date ? rRaw.toISOString() : String(rRaw)).trim();
        if (!rDate) return false;
        const rTime = new Date(rDate).getTime();
        const bTime = new Date(baselineCutoffIso).getTime();
        if (!isNaN(rTime) && !isNaN(bTime)) return rTime < bTime;
        return rDate < baselineCutoffIso;
    };

    // Track pre-baseline sales by LC and by Purchase Key (warehouse + product + brand)
    // ONLY include sales that are discarded/skipped by isPreBaselineRecord!
    const preBaselineSalesByLc = {};
    const preBaselineSalesByPurchaseKey = {};
    if (isBaselineApplicable) {
        salesRecords.forEach(sale => {
            const sStatus = (sale.status || '').toLowerCase();
            const sType = (sale.saleType || '').toLowerCase();
            const isBorder = sType === 'border' || (sale.invoiceNo || '').toUpperCase().startsWith('BS') || sale.isBorderSale === true;
            if (isBorder || sStatus === 'rejected' || sStatus === 'cancelled') return;
            const isOrder = sType === 'order' || (sale.invoiceNo || '').toUpperCase().startsWith('ORD') || sale.isOrderEntry === true;
            if (isOrder) return;

            // Only count sales that are skipped from online deduction by isPreBaselineRecord
            if (!isPreBaselineRecord(sale.date, sale.createdAt)) return;

            (sale.items || []).forEach(si => {
                const pName = (si.productName || si.product || '').trim().toUpperCase();
                const brandEntries = (Array.isArray(si.brandEntries) && si.brandEntries.length > 0)
                    ? si.brandEntries
                    : [{ lcNo: si.lcNo || sale.lcNo, quantity: si.quantity, brand: si.brand, warehouseName: sale.warehouse || sale.whName }];

                brandEntries.forEach(be => {
                    const lc = (be.lcNo || si.lcNo || sale.lcNo || '').trim().toUpperCase();
                    const bName = (be.brand || si.brand || '').trim().toUpperCase();
                    const whName = (be.warehouseName || be.warehouse || sale.warehouse || sale.whName || '').trim().toUpperCase();
                    const qty = safeParse(be.quantity);

                    if (lc) {
                        preBaselineSalesByLc[lc] = (preBaselineSalesByLc[lc] || 0) + qty;
                    }
                    const isSalePurchase = lc.startsWith('PUR-') || (be.requestedBy === 'PurchaseReceive') || (lc === 'PURCHASE');
                    if (isSalePurchase) {
                        const purKey = `${whName}__${pName}__${bName}`;
                        preBaselineSalesByPurchaseKey[purKey] = (preBaselineSalesByPurchaseKey[purKey] || 0) + qty;
                    }
                });
            });
        });
    }

    const cumArrivalsByLc = {};
    const cumArrivalsByPurchaseKey = {};
    const isStockPreBaseline = (item) => {
        if (!isBaselineApplicable) return false;
        const rRaw = item.date || item.createdAt || '';
        const rDate = (rRaw instanceof Date ? rRaw.toISOString() : String(rRaw)).trim().split('T')[0];
        const itemCreatedMs = new Date(item.createdAt).getTime();

        if (rDate >= baselineDateStr) return false;
        if (!isNaN(baselineCreatedMs) && !isNaN(itemCreatedMs) && itemCreatedMs < baselineCreatedMs) return true;

        const lc = (item.lcNo || '').trim().toUpperCase();
        const wh = (item.warehouse || item.whName || '').trim().toUpperCase();
        const prod = (item.productName || item.product || '').trim().toUpperCase();
        const brand = (item.brand || '').trim().toUpperCase();

        let qty = safeParse(item.quantity);
        if (qty <= 0 && Array.isArray(item.brandEntries)) {
            qty = item.brandEntries.reduce((sum, be) => sum + safeParse(be.quantity), 0);
        }

        const isPurchase = (item.requestedBy === 'PurchaseReceive' || lc.startsWith('PUR-'));

        if (lc) {
            cumArrivalsByLc[lc] = (cumArrivalsByLc[lc] || 0) + qty;
            const preSalesLc = preBaselineSalesByLc[lc] || 0;
            if (cumArrivalsByLc[lc] <= preSalesLc) return true;
        }

        if (isPurchase && wh && prod && brand) {
            const purKey = `${wh}__${prod}__${brand}`;
            cumArrivalsByPurchaseKey[purKey] = (cumArrivalsByPurchaseKey[purKey] || 0) + qty;
            const preSalesPur = preBaselineSalesByPurchaseKey[purKey] || 0;
            if (cumArrivalsByPurchaseKey[purKey] <= preSalesPur) return true;
        }

        return false;
    };

    // 0. Seed Initial Baseline Records (if active baseline exists)
    if (isBaselineApplicable && Array.isArray(activeBaseline.snapshotRecords)) {
        activeBaseline.snapshotRecords.forEach((snap, idx) => {
            const snapWh = (snap.warehouse || snap.whName || '').trim();
            if (isWhFilter) {
                const filterWH = stockFilters.warehouse.trim().toLowerCase();
                const snapWhLower = snapWh.toLowerCase();
                if (snapWhLower !== filterWH && !snapWhLower.includes(filterWH) && !filterWH.includes(snapWhLower)) return;
            }
            const snapQty = safeParse(snap.quantity ?? snap.inHouseQuantity);
            const snapPkt = safeParse(snap.packet ?? snap.inHousePacket);
            if (snapQty <= 0 && snapPkt <= 0) return;

            const pName = (snap.productName || snap.product || '').trim();
            const bName = (snap.brand || 'No Brand').trim();
            const uniqueId = `baseline_${snapWh}_${pName}_${bName}_${idx}`;
            if (seenRecords.has(uniqueId)) return;
            seenRecords.add(uniqueId);

            const rq = resolveQuality(pName, bName);
            const qualityVal = rq !== '-' ? rq : (snap.quality || '-');

            rawExpanded.push({
                ...snap,
                _id: uniqueId,
                date: snap.date || baselineCutoffIso,
                createdAt: snap.createdAt || baselineCutoffIso,
                productName: pName,
                brand: bName,
                quality: qualityVal,
                warehouse: snapWh,
                whName: snapWh,
                quantity: snapQty,
                packet: snapPkt,
                inHouseQuantity: snapQty,
                inHousePacket: snapPkt,
                packetSize: safeParse(snap.packetSize) || resolvePacketSize(pName, bName, snap.packetSize) || 30,
                purchasedPrice: safeParse(snap.purchasedPrice ?? snap.rate),
                lcNo: snap.lcNo || '',
                unit: snap.unit || 'kg',
                recordType: 'baseline'
            });
        });
    }

    // Build Map of order reference + product + brand -> sold quantity from General Sales
    // Key: `${ref}_${normProductName}_${normBrand}`
    const orderFulfilledQtyMap = {};
    salesRecords.forEach(s => {
        const sType = (s.saleType || '').toLowerCase();
        const sStatus = (s.status || '').toLowerCase();
        const isOrder = sType === 'order' || (s.invoiceNo || '').toUpperCase().startsWith('ORD') || s.isOrderEntry === true;

        if (!isOrder && sStatus !== 'rejected' && sStatus !== 'cancelled' && sStatus !== 'requested') {
            const refs = [];
            if (s.orderNo && s.orderNo.toString().trim() !== '') refs.push(s.orderNo.toString().trim().toUpperCase());
            if (s.orderId && s.orderId.toString().trim() !== '') refs.push(s.orderId.toString().trim().toUpperCase());
            if (s.orderRef && s.orderRef.toString().trim() !== '') refs.push(s.orderRef.toString().trim().toUpperCase());

            refs.forEach(ref => {
                (s.items || []).forEach(item => {
                    const pName = (item.productName || '').trim().toLowerCase();
                    const brandEntries = (item.brandEntries && item.brandEntries.length > 0)
                        ? item.brandEntries
                        : [{ brand: item.brand || '', quantity: item.quantity }];

                    brandEntries.forEach(be => {
                        const bName = (be.brand || '').trim().toLowerCase();
                        const key = `${ref}_${pName}_${bName}`;
                        const qty = parseFloat(be.quantity) || 0;
                        orderFulfilledQtyMap[key] = (orderFulfilledQtyMap[key] || 0) + qty;
                    });
                });
            });
        }
    });

    // 1. Process Primary Stock Records (LC Receive)
    const sortedStockRecords = [...stockRecords].sort((a, b) => {
        const da = a.date || a.createdAt || '';
        const db = b.date || b.createdAt || '';
        return da > db ? 1 : (da < db ? -1 : 0);
    });

    sortedStockRecords.forEach(item => {
        const itemStatus = (item.status || '').toLowerCase();
        if (itemStatus.includes('requested') || itemStatus.includes('rejected')) return;

        if (isStockPreBaseline(item)) return;

        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach((entry, idx) => {
                const uniqueId = `${item._id}_brand_${idx}`;
                if (seenRecords.has(uniqueId)) return;
                seenRecords.add(uniqueId);

                rawExpanded.push({
                    ...item,
                    _id: uniqueId,
                    brand: entry.brand || item.brand || '',
                    quality: (() => {
                        const rq = resolveQuality(item.productName || item.product, entry.brand || item.brand);
                        return rq !== '-' ? rq : (entry.quality || item.quality || '-');
                    })(),
                    productName: item.productName || item.product || '',
                    warehouse: item.warehouse || item.whName || '',
                    quantity: safeParse(entry.quantity ?? item.quantity),
                    packet: safeParse(entry.packet ?? item.packet),
                    packetSize: safeParse(entry.packetSize ?? item.packetSize),
                    inHousePacket: safeParse(entry.inHousePacket ?? entry.inhousePkt ?? item.inHousePacket),
                    inHouseQuantity: safeParse(entry.inHouseQuantity ?? entry.inhouseQty ?? item.inHouseQuantity),
                    sweepedPacket: safeParse(entry.sweepedPacket) || safeParse(entry.shortagePkt) || safeParse(item.sweepedPacket),
                    sweepedQuantity: safeParse(entry.sweepedQuantity) || safeParse(entry.shortageQty) || safeParse(item.sweepedQuantity),
                    purchasedPrice: safeParse(entry.purchasedPrice ?? item.purchasedPrice ?? entry.rate ?? item.rate),
                    unit: entry.unit || item.unit,
                    recordType: 'stock'
                });
            });
        } else {
            if (seenRecords.has(item._id)) return;
            seenRecords.add(item._id);
            const q = (() => {
                const rq = resolveQuality(item.productName || item.product, item.brand);
                return rq !== '-' ? rq : (item.quality || '-');
            })();
            rawExpanded.push({
                ...item,
                recordType: 'stock',
                quality: q,
                purchasedPrice: safeParse(item.purchasedPrice ?? item.rate),
                // InHouse quantity is already net (Quantity - Shortage)
                inHouseQuantity: safeParse(item.inHouseQuantity ?? item.inhouseQty ?? item.quantity),
                inHousePacket: safeParse(item.inHousePacket ?? item.inhousePkt ?? item.packet)
            });
        }
    });

    // Build Map of LC / Product / Brand -> Rate from primary stock records and baseline records
    const lcRateMap = {};
    if (isBaselineApplicable && Array.isArray(activeBaseline.snapshotRecords)) {
        activeBaseline.snapshotRecords.forEach(snap => {
            const itemLc = (snap.lcNo || '').trim().toLowerCase();
            const pKey = (snap.productName || snap.product || '').trim().toLowerCase();
            const bKey = (snap.brand || '').trim().toLowerCase();
            const price = safeParse(snap.purchasedPrice ?? snap.rate);
            if (price > 0) {
                if (itemLc && itemLc !== '-') lcRateMap[`${itemLc}_${pKey}_${bKey}`] = price;
                if (pKey && bKey) lcRateMap[`${pKey}_${bKey}`] = price;
                if (itemLc && itemLc !== '-') lcRateMap[itemLc] = price;
            }
        });
    }

    (stockRecords || []).forEach(item => {
        const itemLc = (item.lcNo || '').trim().toLowerCase();
        const pKey = (item.productName || item.product || '').trim().toLowerCase();
        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach(be => {
                const bKey = (be.brand || item.brand || '').trim().toLowerCase();
                const price = safeParse(be.purchasedPrice ?? item.purchasedPrice ?? be.rate ?? item.rate);
                if (price > 0) {
                    if (itemLc && itemLc !== '-') lcRateMap[`${itemLc}_${pKey}_${bKey}`] = price;
                    if (pKey && bKey) lcRateMap[`${pKey}_${bKey}`] = price;
                    if (itemLc && itemLc !== '-') lcRateMap[itemLc] = price;
                }
            });
        } else {
            const bKey = (item.brand || '').trim().toLowerCase();
            const price = safeParse(item.purchasedPrice ?? item.rate);
            if (price > 0) {
                if (itemLc && itemLc !== '-') lcRateMap[`${itemLc}_${pKey}_${bKey}`] = price;
                if (pKey && bKey) lcRateMap[`${pKey}_${bKey}`] = price;
                if (itemLc && itemLc !== '-') lcRateMap[itemLc] = price;
            }
        }
    });

    const resolveWhItemPrice = (whItem) => {
        const directPrice = safeParse(whItem.purchasedPrice ?? whItem.rate);
        if (directPrice > 0) return directPrice;
        const itemLc = (whItem.lcNo || '').trim().toLowerCase();
        const pKey = (whItem.productName || whItem.product || '').trim().toLowerCase();
        const bKey = (whItem.brand || '').trim().toLowerCase();
        if (itemLc && itemLc !== '-') {
            return lcRateMap[`${itemLc}_${pKey}_${bKey}`] || lcRateMap[itemLc] || 0;
        }
        return 0;
    };

    // 2. Process Warehouse Records (Transfers)
    warehouseData.forEach(whItem => {
        if (!whItem) return;
        const wStatus = (whItem.status || '').toLowerCase();
        if (wStatus === 'requested' || wStatus === 'pending' || wStatus === 'rejected') return;
        if (whItem.recordType !== 'warehouse' && !whItem.productName && !whItem.product && !whItem.isTransferLog) return;
        if (seenRecords.has(whItem._id)) return;
        seenRecords.add(whItem._id);

        if (whItem.isTransferLog && isBaselineApplicable && activeBaseline && activeBaseline.createdAt && whItem.createdAt) {
            const baselineCreatedMs = new Date(activeBaseline.createdAt).getTime();
            const recordCreatedMs = new Date(whItem.createdAt).getTime();
            if (!isNaN(baselineCreatedMs) && !isNaN(recordCreatedMs) && recordCreatedMs >= baselineCreatedMs) {
                // Post-baseline transfer: recorded after the baseline snapshot was captured.
                // Do not skip! It must be processed to transfer stock from source to destination.
            } else if (isPreBaselineRecord(whItem.date, whItem.createdAt)) {
                return;
            }
        } else if (isPreBaselineRecord(whItem.date, whItem.createdAt)) {
            return;
        }

        let resolvedPktSize = safeParse(whItem.packetSize ?? whItem.size);
        if (resolvedPktSize <= 0 && Array.isArray(products)) {
            const pName = (whItem.productName || whItem.product || '').trim().toLowerCase();
            const productMatch = products.find(p =>
                (p.name || '').trim().toLowerCase() === pName ||
                (p.productName || '').trim().toLowerCase() === pName
            );
            if (productMatch) resolvedPktSize = safeParse(productMatch.packetSize || productMatch.size);
        }

        const destWhName = (whItem.toWh || whItem.whName || whItem.warehouse || '').trim();
        const srcWhName = (whItem.fromWh || '').trim();
        const pName = (whItem.productName || whItem.product || '').trim();
        const itemQty = safeParse(whItem.transferQty ?? whItem.whQty ?? whItem.inHouseQuantity ?? whItem.quantity);
        const itemPkt = safeParse(whItem.transferPkt ?? whItem.whPkt ?? whItem.inHousePacket ?? whItem.packet);

        if (!pName || (itemQty <= 0 && itemPkt <= 0)) return;

        const qualityVal = (() => {
            const rq = resolveQuality(pName, whItem.brand);
            return rq !== '-' ? rq : (whItem.quality || '-');
        })();

        const whPrice = resolveWhItemPrice(whItem);

        if (whItem.isTransferLog) {
            // Destination Entry (+ stock at destination warehouse)
            if (destWhName) {
                rawExpanded.push({
                    ...whItem,
                    _id: `${whItem._id}_dest`,
                    date: whItem.date || whItem.createdAt || new Date().toISOString(),
                    productName: pName,
                    warehouse: destWhName,
                    whName: destWhName,
                    quality: qualityVal,
                    purchasedPrice: whPrice,
                    quantity: itemQty,
                    packet: itemPkt,
                    inHouseQuantity: itemQty,
                    inHousePacket: itemPkt,
                    packetSize: resolvedPktSize || 30,
                    unit: whItem.unit || 'kg',
                    recordType: 'warehouse_dest'
                });
            }

            // Source Entry (- stock at source warehouse)
            if (srcWhName && isBaselineApplicable) {
                rawExpanded.push({
                    ...whItem,
                    _id: `${whItem._id}_src`,
                    date: whItem.date || whItem.createdAt || new Date().toISOString(),
                    productName: pName,
                    warehouse: srcWhName,
                    whName: srcWhName,
                    quality: qualityVal,
                    purchasedPrice: whPrice,
                    quantity: -itemQty,
                    packet: -itemPkt,
                    inHouseQuantity: -itemQty,
                    inHousePacket: -itemPkt,
                    packetSize: resolvedPktSize || 30,
                    unit: whItem.unit || 'kg',
                    recordType: 'warehouse_src_transfer'
                });
            }
        } else {
            rawExpanded.push({
                ...whItem,
                date: whItem.date || whItem.createdAt || new Date().toISOString(),
                productName: pName,
                warehouse: destWhName,
                whName: destWhName,
                quality: qualityVal,
                purchasedPrice: whPrice,
                quantity: itemQty,
                packet: itemPkt,
                inHouseQuantity: itemQty,
                inHousePacket: itemPkt,
                packetSize: resolvedPktSize || 30,
                unit: whItem.unit || 'kg',
                recordType: 'warehouse'
            });
        }
    });

    const startDate = stockFilters.startDate || '';
    const endDate = stockFilters.endDate || '';

    // 3. Filtering
    const filteredRecords = rawExpanded.filter(item => {
        const itemDateOnly = (item.date || '').split('T')[0];
        if (endDate && itemDateOnly > endDate) return false;

        if (stockFilters.lcNo && !isLcMatch(item.lcNo, stockFilters.lcNo)) return false;
        if (isWhFilter) {
            const filterWH = stockFilters.warehouse.trim().toLowerCase();
            const itemWH = (item.whName || item.warehouse || '').trim().toLowerCase();
            if (!itemWH || (itemWH !== filterWH && !itemWH.includes(filterWH) && !filterWH.includes(itemWH))) return false;
        }
        if (stockFilters.brand) {
            const itemBrand = (item.brand || '').trim().toLowerCase();
            // Only apply brand filter if the record HAS a brand (warehouse transfer
            // records may have no brand - they should pass through the brand filter)
            if (itemBrand) {
                if (Array.isArray(stockFilters.brand)) {
                    if (stockFilters.brand.length > 0 && !stockFilters.brand.map(b => b.toLowerCase().trim()).includes(itemBrand)) return false;
                } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                    const selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase());
                    if (!selectedBrands.includes(itemBrand)) return false;
                }
            }
        }
        if (stockFilters.productName) {
            const itemName = (item.productName || item.product || '').trim().toLowerCase();
            if (Array.isArray(stockFilters.productName)) {
                if (stockFilters.productName.length > 0 && !stockFilters.productName.map(p => p.toLowerCase().trim()).includes(itemName)) return false;
            } else if (typeof stockFilters.productName === 'string' && stockFilters.productName.trim() !== '') {
                const selectedProds = stockFilters.productName.split(',').map(p => p.trim().toLowerCase());
                if (!selectedProds.includes(itemName)) return false;
            }
        }

        if (stockSearchQuery) {
            const q = stockSearchQuery.toLowerCase();
            return (item.brand || '').toLowerCase().includes(q) ||
                (item.productName || item.product || '').toLowerCase().includes(q) ||
                (item.lcNo || '').toLowerCase().includes(q);
        }
        return true;
    });

    // 4. Aggregation (FIFO: process oldest arrivals first so sales deplete older stock first)
    const sortedFilteredRecords = [...filteredRecords].sort((a, b) => {
        const dateA = a.date || a.createdAt || '';
        const dateB = b.date || b.createdAt || '';
        return dateA.localeCompare(dateB);
    });

    const groupedStock = sortedFilteredRecords.reduce((acc, item) => {
        const key = (item.productName || item.product || 'Unknown').trim();
        const keyLower = key.toLowerCase();
        const itemDateOnly = (item.date || '').split('T')[0];
        const isBefore = startDate && itemDateOnly < startDate;

        if (!acc[key]) {
            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === keyLower);
            acc[key] = {
                productName: key,
                productRef: product,
                category: product ? product.category : '',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                orderPacket: 0, orderQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                damagePacket: 0, damageQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                unit: item.unit || 'kg',
                brands: {}, allIds: []
            };
        }

        const normBrand = (item.brand || 'No Brand').trim().toLowerCase();
        const normQuality = (item.quality || '-').trim().toLowerCase();
        const subKey = `${normQuality}_${normBrand}_${(item.lcNo || 'no-lc').trim().toLowerCase()}`;

        if (!acc[key].brands[subKey]) {
            acc[key].brands[subKey] = {
                brand: (item.brand || 'No Brand').trim(),
                quality: item.quality || '-',
                date: item.date || item.createdAt || '',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                orderPacket: 0, orderQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                damagePacket: 0, damageQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                packetSize: resolvePacketSize(key, item.brand, item.packetSize),
                _salesResolved: false,
                _damagesResolved: false,
                lcNos: item.lcNo ? [item.lcNo] : [],
                lcNo: item.lcNo || '',
                purchasedPrice: item.purchasedPrice || 0,
                totalCostForAvg: item.purchasedPrice * safeParse(item.inHouseQuantity),
                totalQtyForAvg: safeParse(item.inHouseQuantity)
            };
        } else {
            if (item.lcNo && !acc[key].brands[subKey].lcNos.includes(item.lcNo)) {
                acc[key].brands[subKey].lcNos.push(item.lcNo);
            }
            acc[key].brands[subKey].totalCostForAvg += item.purchasedPrice * safeParse(item.inHouseQuantity);
            acc[key].brands[subKey].totalQtyForAvg += safeParse(item.inHouseQuantity);
            if (acc[key].brands[subKey].totalQtyForAvg > 0) {
                acc[key].brands[subKey].purchasedPrice = acc[key].brands[subKey].totalCostForAvg / acc[key].brands[subKey].totalQtyForAvg;
            }
        }

        const brandObj = acc[key].brands[subKey];

        // Resolve Sales for this brand if not already done
        if (!brandObj._salesResolved) {
            salesRecords.forEach(sale => {
                const sStatus = (sale.status || '').toLowerCase();
                const sType = (sale.saleType || '').toLowerCase();
                const isBorderSale = sType === 'border' || (sale.invoiceNo || '').toUpperCase().startsWith('BS') || sale.isBorderSale === true;
                if (isBorderSale) return; // Exclude Border sales from Warehouse Stock
                const isOrderSale = sType === 'order' ||
                    (sale.invoiceNo || sale.orderNo || '').toUpperCase().startsWith('ORD') ||
                    sale.isOrderEntry === true;
                if (sStatus === 'rejected' || sStatus === 'cancelled') return;
                if (isOrderSale && (sStatus === 'requested' || sStatus === 'pending')) return;
                if (!isOrderSale && sStatus === 'requested') return;

                const sDate = (sale.date || sale.createdAt || '').split('T')[0];
                if (!isOrderSale && isPreBaselineRecord(sale.date, sale.createdAt)) return;
                if (endDate && sDate > endDate) return;

                const isBeforeSale = startDate && sDate < startDate;
                (sale.items || []).forEach((si, siIdx) => {
                    const siName = (si.productName || si.product || '').trim().toLowerCase();
                    if (siName === keyLower) {
                        const itemBrandEntries = (si.brandEntries && si.brandEntries.length > 0)
                            ? si.brandEntries
                            : [{ brand: si.brand || '', quantity: si.quantity, packet: si.packet, packetSize: si.packetSize, warehouseName: si.warehouseName || si.whName || '', lcNo: si.lcNo || '' }];

                        itemBrandEntries.forEach((be, beIdx) => {
                            const beBrand = (be.brand || 'No Brand').trim().toLowerCase();
                            const rq = resolveQuality(siName, be.brand);
                            let beQualityRaw = rq !== '-' ? rq : (be.quality || '-');
                            let beQuality = beQualityRaw.trim().toLowerCase();

                            if (beBrand === normBrand && (beQuality === '-' || normQuality === '-' || beQuality === normQuality)) {
                                const saleLc = ((be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '')).trim();
                                const stockLc = (item.lcNo || '').trim();

                                const isStockPurchase = (item.requestedBy === 'PurchaseReceive' || (stockLc || '').toUpperCase().startsWith('PUR-') || (stockLc || '').toUpperCase() === 'PURCHASE');
                                const isSalePurchase = (saleLc.toUpperCase().startsWith('PUR-') || saleLc.toUpperCase().startsWith('PURCHASE') || saleLc.toUpperCase() === 'PUR');

                                // Strictly keep LC Receive and Purchase Receive stock separate
                                if (isStockPurchase && !isSalePurchase) return;
                                if (!isStockPurchase && isSalePurchase) return;

                                if (!isOrderSale && saleLc && stockLc && !isLcMatch(saleLc, stockLc) && !isLcMatch(stockLc, saleLc)) return;
                                if (stockFilters.lcNo && !isLcMatch(saleLc, stockFilters.lcNo)) return;
                                if (stockSearchQuery) {
                                    const q = stockSearchQuery.toLowerCase();
                                    const matchesQuery = normBrand.includes(q) || keyLower.includes(q) || saleLc.toLowerCase().includes(q);
                                    if (!matchesQuery) return;
                                }

                                if (saleLc) {
                                    if (!brandObj.lcNo) brandObj.lcNo = saleLc;
                                    if (!brandObj.lcNos.includes(saleLc)) brandObj.lcNos.push(saleLc);
                                }

                                const saleEntryId = `${sale._id}_${siIdx}_${beIdx}`;
                                if (consumedSales.has(saleEntryId)) return;

                                const saleWH = (be.warehouseName || si.whName || si.warehouse || sale.warehouse || sale.whName || '').trim().toLowerCase();
                                if (isWhFilter && saleWH && !saleWH.startsWith(stockFilters.warehouse.toLowerCase()) && saleWH !== stockFilters.warehouse.toLowerCase()) return;

                                const sq = safeParse(be.quantity);
                                let sp = safeParse(be.packet);

                                if (sp <= 0 && sq > 0) {
                                    const pSize = brandObj.packetSize || 30;
                                    sp = sq / pSize;
                                }

                                consumedSales.add(saleEntryId);

                                const sType = (sale.saleType || '').toLowerCase();
                                const inv = (sale.invoiceNo || sale.orderNo || '').trim().toUpperCase();
                                const ordNo = (sale.orderNo || sale.invoiceNo || '').trim().toUpperCase();
                                const ordId = sale._id ? sale._id.toString().trim().toUpperCase() : '';
                                const isOrder = sType === 'order' || inv.startsWith('ORD') || sale.isOrderEntry === true;
                                const isFulfilled = (sale.status || '').toLowerCase() === 'complete' || (sale.status || '').toLowerCase() === 'completed' || sale.isFulfilled === true;

                                const pKeyName = (si.productName || item.productName || item.product || '').trim().toLowerCase();
                                const bKeyName = (be.brand || '').trim().toLowerCase();
                                if (isOrder) {
                                    if (isFulfilled || (sale.status || '').toLowerCase() === 'rejected') return;

                                    const soldQty1 = inv && pKeyName && bKeyName ? (orderFulfilledQtyMap[`${inv}_${pKeyName}_${bKeyName}`] || 0) : 0;
                                    const soldQty2 = ordNo && pKeyName && bKeyName ? (orderFulfilledQtyMap[`${ordNo}_${pKeyName}_${bKeyName}`] || 0) : 0;
                                    const soldQty3 = ordId && pKeyName && bKeyName ? (orderFulfilledQtyMap[`${ordId}_${pKeyName}_${bKeyName}`] || 0) : 0;
                                    const totalSoldQty = Math.max(soldQty1, soldQty2, soldQty3);

                                    const netOrderSq = Math.max(0, sq - totalSoldQty);
                                    if (netOrderSq <= 0) return;

                                    const pktRatio = sq > 0 ? (sp / sq) : 0;
                                    const netOrderSp = netOrderSq * pktRatio;

                                    brandObj.orderQuantity += netOrderSq;
                                    brandObj.orderPacket += netOrderSp;
                                    acc[key].orderQuantity += netOrderSq;
                                    acc[key].orderPacket += netOrderSp;
                                } else {
                                    if (isBeforeSale) {
                                        brandObj.openingQuantity -= sq;
                                        brandObj.openingPacket -= sp;
                                        acc[key].openingQuantity -= sq;
                                        acc[key].openingPacket -= sp;
                                    } else {
                                        brandObj.saleQuantity += sq;
                                        brandObj.salePacket += sp;
                                        acc[key].saleQuantity += sq;
                                        acc[key].salePacket += sp;
                                    }
                                }
                            }
                        });
                    }
                });
            });
            brandObj._salesResolved = true;
        }

        // Resolve Damages for this brand if not already done
        if (!brandObj._damagesResolved) {
            damages.forEach(damage => {
                const dDate = (damage.date || damage.createdAt || '').split('T')[0];
                if (isPreBaselineRecord(damage.date, damage.createdAt)) return;
                if (endDate && dDate > endDate) return;

                const isBeforeDamage = startDate && dDate < startDate;

                const dProdName = (damage.productName || damage.product || '').trim().toLowerCase();
                const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
                const dWh = (damage.warehouse || '').trim().toLowerCase();

                if (dProdName === keyLower && dBrand === normBrand) {
                    const damageLc = (damage.lcNo || '').trim();
                    const stockLc = (item.lcNo || '').trim();
                    if (damageLc && stockLc && !isLcMatch(damageLc, stockLc) && !isLcMatch(stockLc, damageLc)) return;
                    if (stockFilters.lcNo && !isLcMatch(damageLc, stockFilters.lcNo)) return;
                    if (stockSearchQuery) {
                        const q = stockSearchQuery.toLowerCase();
                        const matchesQuery = normBrand.includes(q) || keyLower.includes(q) || damageLc.toLowerCase().includes(q);
                        if (!matchesQuery) return;
                    }

                    if (damageLc) {
                        if (!brandObj.lcNo) brandObj.lcNo = damageLc;
                        if (!brandObj.lcNos.includes(damageLc)) brandObj.lcNos.push(damageLc);
                    }
                    if (isWhFilter) {
                        const filterWH = stockFilters.warehouse.toLowerCase();
                        // Skip damage if it has no warehouse or warehouse doesn't match the filter
                        if (!dWh || (dWh !== filterWH && !dWh.includes(filterWH) && !filterWH.includes(dWh))) return;
                    }

                    const damageEntryId = `${damage._id}`;
                    if (consumedDamages.has(damageEntryId)) return;
                    consumedDamages.add(damageEntryId);

                    const dq = safeParse(damage.quantity);
                    let dp = safeParse(damage.packet);
                    if (dp <= 0 && dq > 0) {
                        const pSize = brandObj.packetSize || 30;
                        dp = dq / pSize;
                    }

                    if (isBeforeDamage) {
                        brandObj.openingQuantity -= dq;
                        brandObj.openingPacket -= dp;
                        acc[key].openingQuantity -= dq;
                        acc[key].openingPacket -= dp;
                    } else {
                        brandObj.damageQuantity += dq;
                        brandObj.damagePacket += dp;
                        acc[key].damageQuantity += dq;
                        acc[key].damagePacket += dp;
                    }
                }
            });
            brandObj._damagesResolved = true;
        }

        const arrivalQty = safeParse(item.inHouseQuantity);
        const arrivalPkt = safeParse(item.inHousePacket);

        if (isBefore) {
            brandObj.openingQuantity += arrivalQty;
            brandObj.openingPacket += arrivalPkt;
            acc[key].openingQuantity += arrivalQty;
        } else {
            brandObj.periodArrivalQuantity += arrivalQty;
            brandObj.periodArrivalPacket += arrivalPkt;
            acc[key].periodArrivalQuantity += arrivalQty;
        }

        brandObj.inHouseQuantity += safeParse(item.inHouseQuantity);
        brandObj.inHousePacket += safeParse(item.inHousePacket);
        acc[key].inHouseQuantity += safeParse(item.inHouseQuantity);

        brandObj.sweepedPacket += safeParse(item.sweepedPacket);
        brandObj.sweepedQuantity += safeParse(item.sweepedQuantity);
        acc[key].sweepedPacket += safeParse(item.sweepedPacket);
        acc[key].sweepedQuantity += safeParse(item.sweepedQuantity);

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

    // 5. Second Pass: General Products (from sales)
    salesRecords.forEach(sale => {
        const sStatus = (sale.status || '').toLowerCase();
        const sType = (sale.saleType || '').toLowerCase();
        const isBorderSale = sType === 'border' || (sale.invoiceNo || '').toUpperCase().startsWith('BS') || sale.isBorderSale === true;
        if (isBorderSale) return; // Exclude Border sales from Warehouse Stock
        const inv = (sale.invoiceNo || sale.orderNo || '').trim().toUpperCase();
        const isOrderSale = sType === 'order' || inv.startsWith('ORD') || sale.isOrderEntry === true;
        if (sStatus === 'rejected' || sStatus === 'cancelled') return;
        if (isOrderSale && (sStatus === 'requested' || sStatus === 'pending')) return;
        if (!isOrderSale && sStatus === 'requested') return;
        if (!isOrderSale && isPreBaselineRecord(sale.date, sale.createdAt)) return;
        if (endDate && (sale.date || '').split('T')[0] > endDate) return;

        (sale.items || []).forEach((si, siIdx) => {
            const sProdName = (si.productName || '').trim();
            if (!sProdName) return;

            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === sProdName.toLowerCase());

            if (stockFilters.productName) {
                const searchName = sProdName.toLowerCase();
                if (Array.isArray(stockFilters.productName)) {
                    if (stockFilters.productName.length > 0 && !stockFilters.productName.map(p => p.toLowerCase().trim()).includes(searchName)) return;
                } else if (typeof stockFilters.productName === 'string' && stockFilters.productName.trim() !== '') {
                    const selectedProds = stockFilters.productName.split(',').map(p => p.trim().toLowerCase());
                    if (!selectedProds.includes(searchName)) return;
                }
            }



            if (!groupedStock[sProdName]) {
                groupedStock[sProdName] = {
                    productName: sProdName, productRef: product, category: 'General',
                    openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                    saleQuantity: 0, salePacket: 0, sweepedPacket: 0, sweepedQuantity: 0,
                    damageQuantity: 0, damagePacket: 0,
                    inHousePacket: 0, inHouseQuantity: 0,
                    unit: si.unit || 'kg', brands: {}, allIds: []
                };
            }
            const group = groupedStock[sProdName];
            const itemBrandEntries = (si.brandEntries && si.brandEntries.length > 0)
                ? si.brandEntries
                : [{ brand: si.brand || '', quantity: si.quantity, packet: si.packet, packetSize: si.packetSize, warehouseName: si.warehouseName || si.whName || '', lcNo: si.lcNo || '' }];

            itemBrandEntries.forEach((be, beIdx) => {
                const saleWH = (be.warehouseName || si.whName || si.warehouse || sale.warehouse || sale.whName || '').trim().toLowerCase();
                if (isWhFilter && saleWH && !saleWH.startsWith(stockFilters.warehouse.toLowerCase()) && saleWH !== stockFilters.warehouse.toLowerCase()) return;

                // ADDED: Brand filter for General products
                if (stockFilters.brand) {
                    const itemBrand = (be.brand || '').trim().toLowerCase();
                    if (Array.isArray(stockFilters.brand)) {
                        if (stockFilters.brand.length > 0 && !stockFilters.brand.map(b => b.toLowerCase().trim()).includes(itemBrand)) return;
                    } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                        const selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase());
                        if (!selectedBrands.includes(itemBrand)) return;
                    }
                }

                const normBrand = (be.brand || 'No Brand').trim().toLowerCase();
                const rq = resolveQuality(sProdName, be.brand);
                const resolvedQ = rq !== '-' ? rq : (be.quality || '-');
                const normQuality = resolvedQ.trim().toLowerCase();
                const beLc = ((be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '')).trim();
                const bePrice = parseFloat(be.purchasedPrice) || 0;

                if (stockFilters.lcNo && !isLcMatch(beLc, stockFilters.lcNo)) return;
                if (stockSearchQuery) {
                    const q = stockSearchQuery.toLowerCase();
                    const matchesQuery = sProdName.toLowerCase().includes(q) ||
                        normBrand.includes(q) ||
                        beLc.toLowerCase().includes(q);
                    if (!matchesQuery) return;
                }

                const subKey = `${normQuality}_${normBrand}_${beLc.toLowerCase()}`;

                if (!group.brands[subKey]) {
                    let resolvedPktSize = safeParse(be.packetSize);
                    if (resolvedPktSize <= 0 && Array.isArray(products)) {
                        const productMatch = products.find(p =>
                            (p.name || '').trim().toLowerCase() === sProdName.toLowerCase() ||
                            (p.productName || '').trim().toLowerCase() === sProdName.toLowerCase()
                        );
                        if (productMatch) resolvedPktSize = safeParse(productMatch.packetSize || productMatch.size);
                    }
                    if (resolvedPktSize <= 0) resolvedPktSize = 30; // fallback default

                    group.brands[subKey] = {
                        brand: (be.brand || 'No Brand').trim(),
                        quality: resolvedQ || '-',
                        openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                        salePacket: 0, saleQuantity: 0, orderPacket: 0, orderQuantity: 0, sweepedPacket: 0, sweepedQuantity: 0,
                        damagePacket: 0, damageQuantity: 0,
                        inHousePacket: 0, inHouseQuantity: 0, packetSize: resolvedPktSize,
                        _salesResolved: false,
                        _damagesResolved: false,
                        lcNos: beLc ? [beLc] : [],
                        lcNo: beLc,
                        purchasedPrice: bePrice
                    };
                } else {
                    const saleLC = (be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '');
                    if (saleLC && !group.brands[subKey].lcNos.includes(saleLC)) {
                        group.brands[subKey].lcNos.push(saleLC);
                    }
                }
                const brandObj = group.brands[subKey];

                // Resolve Damages for General Product
                if (!brandObj._damagesResolved) {
                    damages.forEach(damage => {
                        const dDate = (damage.date || '').split('T')[0];
                        if (endDate && dDate > endDate) return;
                        const isBefore = startDate && dDate < startDate;
                        const dProdName = (damage.productName || '').trim().toLowerCase();
                        const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
                        const dWh = (damage.warehouse || '').trim().toLowerCase();
                        if (dProdName === sProdName.toLowerCase() && dBrand === normBrand) {
                            const damageLc = (damage.lcNo || '').trim().toLowerCase();
                            const stockLc = beLc.toLowerCase();
                            if (damageLc !== stockLc) return;
                            if (stockFilters.lcNo && !isLcMatch(damage.lcNo, stockFilters.lcNo)) return;
                            if (stockSearchQuery) {
                                const q = stockSearchQuery.toLowerCase();
                                const damageLc = (damage.lcNo || '').trim().toLowerCase();
                                const matchesQuery = dProdName.includes(q) || dBrand.includes(q) || damageLc.includes(q);
                                if (!matchesQuery) return;
                            }
                            if (isWhFilter) {
                                const filterWH = stockFilters.warehouse.toLowerCase();
                                // Skip damage if it has no warehouse or warehouse doesn't match the filter
                                if (!dWh || (dWh !== filterWH && !dWh.includes(filterWH) && !filterWH.includes(dWh))) return;
                            }

                            const damageEntryId = `${damage._id}`;
                            if (consumedDamages.has(damageEntryId)) return;
                            consumedDamages.add(damageEntryId);

                            const dq = safeParse(damage.quantity);
                            let dp = safeParse(damage.packet) || (brandObj.packetSize > 0 ? dq / brandObj.packetSize : 0);
                            if (isBefore) {
                                brandObj.openingQuantity -= dq;
                                group.openingQuantity -= dq;
                            } else {
                                brandObj.damageQuantity += dq;
                                brandObj.damagePacket += dp;
                                group.damageQuantity += dq;
                            }
                        }
                    });
                    brandObj._damagesResolved = true;
                }

                const saleEntryId = `${sale._id}_${siIdx}_${beIdx}`;
                if (!consumedSales.has(saleEntryId)) {
                    consumedSales.add(saleEntryId);
                    const sDate = (sale.date || '').split('T')[0];
                    const isBefore = startDate && sDate < startDate;
                    const sq = safeParse(be.quantity);
                    let sp = safeParse(be.packet);
                    if (sp <= 0 && sq > 0) {
                        const pSize = brandObj.packetSize || 30;
                        sp = sq / pSize;
                    }

                    const sType = (sale.saleType || '').toLowerCase();
                    const inv = (sale.invoiceNo || sale.orderNo || '').trim().toUpperCase();
                    const ordNo = (sale.orderNo || sale.invoiceNo || '').trim().toUpperCase();
                    const ordId = sale._id ? sale._id.toString().trim().toUpperCase() : '';
                    const isOrder = sType === 'order' || inv.startsWith('ORD') || sale.isOrderEntry === true;
                    const isFulfilled = (sale.status || '').toLowerCase() === 'complete' || (sale.status || '').toLowerCase() === 'completed' || sale.isFulfilled === true;

                    const pKeyName = (si.productName || '').trim().toLowerCase();
                    const bKeyName = (be.brand || '').trim().toLowerCase();
                    if (isOrder) {
                        if (isFulfilled || (sale.status || '').toLowerCase() === 'rejected') return;

                        const soldQty1 = inv && pKeyName && bKeyName ? (orderFulfilledQtyMap[`${inv}_${pKeyName}_${bKeyName}`] || 0) : 0;
                        const soldQty2 = ordNo && pKeyName && bKeyName ? (orderFulfilledQtyMap[`${ordNo}_${pKeyName}_${bKeyName}`] || 0) : 0;
                        const soldQty3 = ordId && pKeyName && bKeyName ? (orderFulfilledQtyMap[`${ordId}_${pKeyName}_${bKeyName}`] || 0) : 0;
                        const totalSoldQty = Math.max(soldQty1, soldQty2, soldQty3);

                        const netOrderSq = Math.max(0, sq - totalSoldQty);
                        if (netOrderSq <= 0) return;

                        const pktRatio = sq > 0 ? (sp / sq) : 0;
                        const netOrderSp = netOrderSq * pktRatio;

                        brandObj.orderQuantity += netOrderSq;
                        brandObj.orderPacket += netOrderSp;
                        group.orderQuantity += netOrderSq;
                        group.orderPacket += netOrderSp;
                    } else {
                        if (isBefore) {
                            brandObj.openingQuantity -= sq;
                            brandObj.openingPacket -= sp;
                            group.openingQuantity -= sq;
                            group.openingPacket -= sp;
                        } else {
                            brandObj.saleQuantity += sq;
                            brandObj.salePacket += sp;
                            group.saleQuantity += sq;
                            group.salePacket += sp;
                        }
                    }
                }
            });
        });
    });

    const displayRecords = Object.values(groupedStock).map(group => {
        let brandList = Object.values(group.brands).map(b => {
            const totalIn = b.openingQuantity + b.periodArrivalQuantity;
            const saleQty = b.saleQuantity;
            const shortageQty = b.sweepedQuantity;
            const damageQty = b.damageQuantity || 0;
            const totalPkt = b.openingPacket + b.periodArrivalPacket;

            const isGrossArrival = false;
            const openingAfterShortage = isGrossArrival ? (totalIn - shortageQty) : totalIn;
            const openingPktAfterShortage = isGrossArrival ? (totalPkt - b.sweepedPacket) : totalPkt;

            const closingQty = openingAfterShortage - saleQty - damageQty;
            const closingPkt = openingPktAfterShortage - b.salePacket - (b.damagePacket || 0);

            const orderQty = b.orderQuantity || 0;
            const orderPkt = b.orderPacket || 0;
            const saleableQty = Math.max(0, closingQty - orderQty);
            const saleablePkt = Math.max(0, closingPkt - orderPkt);

            const cleanVal = (v) => Math.abs(v) < 0.001 ? 0 : v;

            return {
                ...b,
                openingQuantity: cleanVal(openingAfterShortage),
                openingPacket: cleanVal(openingPktAfterShortage),
                periodArrivalQuantity: cleanVal(b.periodArrivalQuantity),
                periodArrivalPacket: cleanVal(b.periodArrivalPacket),
                saleQuantity: cleanVal(saleQty),
                salePacket: cleanVal(b.salePacket),
                orderQuantity: cleanVal(orderQty),
                orderPacket: cleanVal(orderPkt),
                saleableQuantity: cleanVal(saleableQty),
                saleablePacket: cleanVal(saleablePkt),
                sweepedQuantity: cleanVal(shortageQty),
                sweepedPacket: cleanVal(b.sweepedPacket),
                damageQuantity: cleanVal(damageQty),
                damagePacket: cleanVal(b.damagePacket || 0),
                closingQuantity: cleanVal(closingQty),
                closingPacket: cleanVal(closingPkt),
                inHouseQuantity: cleanVal(closingQty),
                inHousePacket: cleanVal(closingPkt),
                totalInHouseQuantity: cleanVal(openingAfterShortage),
                totalInHousePacket: cleanVal(openingPktAfterShortage)
            };
        });

        // In Price Report / Show Rate mode, reconcile LC entries against true brand stock; otherwise group by quality and brand name
        brandList = isPriceReport
            ? reconcilePriceReportBrandList(brandList)
            : getGroupedBrandList(brandList);

        brandList = brandList.sort((a, b) => {
            const qCmp = (a.quality || '-').localeCompare(b.quality || '-');
            if (qCmp !== 0) return qCmp;
            const bCmp = (a.brand || '').localeCompare(b.brand || '');
            if (bCmp !== 0) return bCmp;
            return (a.lcNo || '').localeCompare(b.lcNo || '');
        }).filter(b => {
            const closing = Math.abs(b.closingQuantity !== undefined ? b.closingQuantity : (b.inHouseQuantity || 0));
            const order = Math.abs(b.orderQuantity || 0);
            const saleable = Math.abs(b.saleableQuantity || 0);
            const opening = Math.abs(b.openingQuantity || 0);
            const sale = Math.abs(b.saleQuantity || 0);

            if (isPriceReport && !stockFilters?._isSubCall) {
                return (b.inHouseQuantity || 0) > 0.001;
            }

            // If closing, order, saleable, opening, and sale are 0, do not show
            if (closing <= 0.001 && order <= 0.001 && saleable <= 0.001 && opening <= 0.001 && sale <= 0.001) {
                return false;
            }
            return true;
        });

        if (brandList.length === 0) return null;

        const groupedBrands = getGroupedBrandList(brandList);
        const openingQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.openingQuantity || 0), 0);
        const inHouseQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.inHouseQuantity || 0), 0);
        const saleQty = groupedBrands.reduce((sum, b) => sum + (b.saleQuantity || 0), 0);
        const damageQty = groupedBrands.reduce((sum, b) => sum + (b.damageQuantity || 0), 0);
        const openingPkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.openingPacket || 0), 0);
        const inHousePkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.inHousePacket || 0), 0);
        const salePkt = groupedBrands.reduce((sum, b) => sum + (b.salePacket || 0), 0);
        const damagePkt = groupedBrands.reduce((sum, b) => sum + (b.damagePacket || 0), 0);
        const orderQty = groupedBrands.reduce((sum, b) => sum + (b.orderQuantity || 0), 0);
        const orderPkt = groupedBrands.reduce((sum, b) => sum + (b.orderPacket || 0), 0);
        const saleableQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.saleableQuantity || 0), 0);
        const saleablePkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.saleablePacket || 0), 0);

        const groupPktSize = brandList.find(b => (b.packetSize || 0) > 0)?.packetSize || products.find(p => (p.name || p.productName || '').trim().toLowerCase() === group.productName.toLowerCase())?.packetSize || 30;

        return {
            ...group,
            brandList: brandList.map(b => ({ ...b, packetSize: b.packetSize || groupPktSize })),
            packetSize: groupPktSize,
            openingQuantity: openingQty,
            openingPacket: openingPkt,
            totalInHouseQuantity: openingQty,
            totalInHousePacket: openingPkt,
            inHouseQuantity: inHouseQty,
            inHousePacket: inHousePkt,
            saleQuantity: saleQty,
            salePacket: salePkt,
            orderQuantity: orderQty,
            orderPacket: orderPkt,
            saleableQuantity: saleableQty,
            saleablePacket: saleablePkt,
            damageQuantity: damageQty,
            damagePacket: damagePkt
        };
    }).filter(p => p !== null && p.productName && p.productName.trim() !== '-' && p.productName.trim() !== '').sort((a, b) => a.productName.localeCompare(b.productName));

    // Summary Calculations
    let tOpeningQty = 0; let tSaleQty = 0; let tInHouseQty = 0; let tShortageQty = 0; let tDamageQty = 0;
    const tOpeningPkt = { whole: 0, remainder: 0 };
    const tSalePkt = { whole: 0, remainder: 0 };
    const tInHousePkt = { whole: 0, remainder: 0 };

    displayRecords.forEach(group => {
        group.brandList.forEach(b => {
            tOpeningQty += Math.max(0, b.openingQuantity);
            tSaleQty += b.saleQuantity;
            tInHouseQty += Math.max(0, b.inHouseQuantity);
            tShortageQty += b.sweepedQuantity;
            tDamageQty += (b.damageQuantity || 0);

            const op = calculatePktRemainder(Math.max(0, b.openingQuantity), b.packetSize);
            tOpeningPkt.whole += op.whole; tOpeningPkt.remainder += op.remainder;

            const sl = calculatePktRemainder(b.saleQuantity, b.packetSize);
            tSalePkt.whole += sl.whole; tSalePkt.remainder += sl.remainder;

            const ih = calculatePktRemainder(Math.max(0, b.inHouseQuantity), b.packetSize);
            tInHousePkt.whole += ih.whole; tInHousePkt.remainder += ih.remainder;
        });
    });

    const filteredDisplayRecords = displayRecords.map(group => {
        // Filter brands by in-house quantity OR by active brand filter
        let filteredBrands = group.brandList;

        // Apply brand filter if active
        if (stockFilters.brand) {
            let selectedBrands = [];
            if (Array.isArray(stockFilters.brand)) {
                selectedBrands = stockFilters.brand.map(b => b.toLowerCase().trim()).filter(Boolean);
            } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
            }
            if (selectedBrands.length > 0) {
                filteredBrands = filteredBrands.filter(b => selectedBrands.includes((b.brand || '').trim().toLowerCase()));
            }
        }

        if (isPriceReport && !stockFilters?._isSubCall) {
            // In Price Report mode, keep all LC entries with positive remaining stock
            filteredBrands = filteredBrands.filter(b => (b.inHouseQuantity || 0) > 0.001);
        } else if (stockFilters?.reportType === 'short') {
            // In Short Report mode, only keep items with positive closing stock or active pending orders
            filteredBrands = filteredBrands.filter(b =>
                (b.inHouseQuantity || 0) > 0.001 ||
                (b.orderQuantity || 0) > 0.001
            );
        } else {
            // Standard / Detailed view: keep items with positive in-house stock, opening, sale, or active pending orders
            filteredBrands = filteredBrands.filter(b =>
                (b.inHouseQuantity || 0) > 0.001 ||
                (b.orderQuantity || 0) > 0.001 ||
                (b.openingQuantity || 0) > 0.001 ||
                (b.saleQuantity || 0) > 0.001
            );
        }

        if (filteredBrands.length === 0) {
            return null;
        }

        return {
            ...group,
            brandList: filteredBrands.length > 0 ? filteredBrands : group.brandList
        };
    }).filter(Boolean);

    // Calculate cumulative damage quantity matching active filters up to endDate
    let cumulativeDamageQty = 0;
    if (Array.isArray(damages)) {
        damages.forEach(damage => {
            const dDate = (damage.date || damage.createdAt || '').split('T')[0];
            if (endDate && dDate > endDate) return;

            const dProdName = (damage.productName || damage.product || '').trim().toLowerCase();
            const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
            const dWh = (damage.warehouse || '').trim().toLowerCase();

            if (stockFilters.productName) {
                if (Array.isArray(stockFilters.productName)) {
                    if (stockFilters.productName.length > 0 && !stockFilters.productName.map(p => p.toLowerCase().trim()).includes(dProdName)) return;
                } else if (typeof stockFilters.productName === 'string' && stockFilters.productName.trim() !== '') {
                    const selectedProds = stockFilters.productName.split(',').map(p => p.trim().toLowerCase());
                    if (!selectedProds.includes(dProdName)) return;
                }
            }
            if (stockFilters.brand) {
                if (Array.isArray(stockFilters.brand)) {
                    if (stockFilters.brand.length > 0 && !stockFilters.brand.map(b => b.toLowerCase().trim()).includes(dBrand)) return;
                } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                    const selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase());
                    if (!selectedBrands.includes(dBrand)) return;
                }
            }
            if (isWhFilter) {
                const filterWH = stockFilters.warehouse.toLowerCase();
                if (!dWh || (dWh !== filterWH && !dWh.includes(filterWH) && !filterWH.includes(dWh))) return;
            }
            if (stockFilters.lcNo && !isLcMatch(damage.lcNo, stockFilters.lcNo)) return;
            if (stockSearchQuery) {
                const q = stockSearchQuery.toLowerCase();
                const match = dProdName.includes(q) || dBrand.includes(q) || (damage.lcNo || '').toLowerCase().includes(q);
                if (!match) return;
            }

            cumulativeDamageQty += safeParse(damage.quantity);
        });
    }

    return {
        displayRecords: filteredDisplayRecords,
        totalQuantity: tOpeningQty,
        totalSaleQty: tSaleQty,
        totalInHouseQty: tInHouseQty,
        totalShortage: tShortageQty,
        totalDamageQty: cumulativeDamageQty,
        totalOpeningPktWhole: tOpeningPkt.whole,
        totalOpeningPktRemainder: tOpeningPkt.remainder,
        totalArrivalPktWhole: 0,
        totalArrivalPktRemainder: 0,
        totalSalePktWhole: tSalePkt.whole,
        totalSalePktDecimalKg: tSalePkt.remainder,
        totalInHousePktWhole: tInHousePkt.whole,
        totalInHousePktDecimalKg: tInHousePkt.remainder,
        unit: displayRecords[0]?.unit || 'kg'
    };
};
