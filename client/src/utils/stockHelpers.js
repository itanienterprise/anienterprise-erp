// Helper to parse numbers safely and handle potential strings with commas
const safeParse = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

// Helper to group split brand entries by quality & brand name to avoid split-induced inflation in subtotals/totals
export const getGroupedBrandList = (brandList) => {
    if (!Array.isArray(brandList)) return [];
    const groups = {};
    brandList.forEach(b => {
        const key = `${b.quality || '-'}_${b.brand || 'No Brand'}`;
        if (!groups[key]) {
            groups[key] = {
                ...b,
                openingQuantity: 0,
                openingPacket: 0,
                periodArrivalQuantity: 0,
                periodArrivalPacket: 0,
                saleQuantity: 0,
                salePacket: 0,
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
        groups[key].sweepedQuantity += b.sweepedQuantity || 0;
        groups[key].sweepedPacket += b.sweepedPacket || 0;
        groups[key].damageQuantity += b.damageQuantity || 0;
        groups[key].damagePacket += b.damagePacket || 0;
        groups[key].inHouseQuantity += b.inHouseQuantity || 0;
        groups[key].inHousePacket += b.inHousePacket || 0;
        groups[key].totalInHouseQuantity += b.totalInHouseQuantity || 0;
        groups[key].totalInHousePacket += b.totalInHousePacket || 0;
        groups[key].closingQuantity += b.closingQuantity || 0;
        groups[key].closingPacket += b.closingPacket || 0;
    });
    return Object.values(groups);
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

export const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = [], products = [], damages = []) => {
    const isWhFilter = stockFilters.warehouse && stockFilters.warehouse.trim().toLowerCase() !== 'all warehouses';
    const isPriceReport = stockFilters && stockFilters.reportType === 'price';

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

    const rawExpanded = [];
    const seenRecords = new Set();
    const consumedSales = new Set(); // Track consumed sale entries to prevent double-counting across quality grades
    const consumedDamages = new Set(); // Track consumed damages to prevent double-counting

    // 1. Process Primary Stock Records (LC Receive)
    stockRecords.forEach(item => {
        const itemStatus = (item.status || '').toLowerCase();
        if (itemStatus.includes('requested') || itemStatus.includes('rejected')) return;

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

    // 2. Process Warehouse Records (Transfers)
    warehouseData.forEach(whItem => {
        if (!whItem || whItem.isTransferLog) return;
        if ((whItem.location || '').trim().toLowerCase() === 'returned stock') return;
        if (whItem.recordType !== 'warehouse' && !whItem.productName && !whItem.product) return;
        if (seenRecords.has(whItem._id)) return;
        seenRecords.add(whItem._id);

        let resolvedPktSize = safeParse(whItem.packetSize ?? whItem.size);
        if (resolvedPktSize <= 0 && Array.isArray(products)) {
            const pName = (whItem.productName || whItem.product || '').trim().toLowerCase();
            const productMatch = products.find(p =>
                (p.name || '').trim().toLowerCase() === pName ||
                (p.productName || '').trim().toLowerCase() === pName
            );
            if (productMatch) resolvedPktSize = safeParse(productMatch.packetSize || productMatch.size);
        }

        rawExpanded.push({
            ...whItem,
            date: whItem.date || whItem.createdAt || new Date().toISOString(),
            productName: whItem.productName || whItem.product || '',
            warehouse: whItem.whName || whItem.warehouse || '',
            quality: (() => {
                const rq = resolveQuality(whItem.productName || whItem.product, whItem.brand);
                return rq !== '-' ? rq : (whItem.quality || '-');
            })(),
            purchasedPrice: safeParse(whItem.purchasedPrice ?? whItem.rate),
            quantity: safeParse(whItem.whQty ?? whItem.quantity),
            packet: safeParse(whItem.whPkt ?? whItem.packet),
            inHouseQuantity: safeParse(whItem.whQty ?? whItem.inHouseQuantity),
            inHousePacket: safeParse(whItem.whPkt ?? whItem.inHousePacket),
            packetSize: resolvedPktSize || 30,
            unit: whItem.unit || 'kg',
            recordType: 'warehouse'
        });
    });

    const startDate = stockFilters.startDate || '';
    const endDate = stockFilters.endDate || '';

    // 3. Filtering
    const filteredRecords = rawExpanded.filter(item => {
        const itemDateOnly = (item.date || '').split('T')[0];
        if (endDate && itemDateOnly > endDate) return false;

        if (stockFilters.lcNo && (item.lcNo || '').trim() !== stockFilters.lcNo) return false;
        if (isWhFilter) {
            const filterWH = stockFilters.warehouse.trim().toLowerCase();
            const itemWH = (item.whName || item.warehouse || '').trim().toLowerCase();
            if (!itemWH || (itemWH !== filterWH && !itemWH.includes(filterWH) && !filterWH.includes(itemWH))) return false;
        }
        if (stockFilters.brand) {
            const itemBrand = (item.brand || '').trim().toLowerCase();
            if (Array.isArray(stockFilters.brand)) {
                if (stockFilters.brand.length > 0 && !stockFilters.brand.map(b => b.toLowerCase().trim()).includes(itemBrand)) return false;
            } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                const selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase());
                if (!selectedBrands.includes(itemBrand)) return false;
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

    // 4. Aggregation
    const groupedStock = filteredRecords.reduce((acc, item) => {
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
                brand: item.brand || 'No Brand',
                quality: item.quality || '-',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                damagePacket: 0, damageQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                packetSize: safeParse(item.packetSize),
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
                if (sStatus !== 'accepted' && sStatus !== 'pending') return;

                const sDate = (sale.date || sale.createdAt || '').split('T')[0];
                if (endDate && sDate > endDate) return;

                const isBeforeSale = startDate && sDate < startDate;
                (sale.items || []).forEach((si, siIdx) => {
                    const siName = (si.productName || si.product || '').trim().toLowerCase();
                    if (siName === keyLower) {
                        (si.brandEntries || []).forEach((be, beIdx) => {
                            const beBrand = (be.brand || 'No Brand').trim().toLowerCase();
                            const rq = resolveQuality(siName, be.brand);
                            let beQualityRaw = rq !== '-' ? rq : (be.quality || '-');
                            let beQuality = beQualityRaw.trim().toLowerCase();

                            if (beBrand === normBrand && beQuality === '-' && normQuality !== '-') {
                                beQuality = normQuality;
                            }

                            if (beBrand === normBrand && beQuality === normQuality) {
                                const saleLc = ((be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '')).trim().toLowerCase();
                                const stockLc = (item.lcNo || '').trim().toLowerCase();
                                if (saleLc !== stockLc) return; // ALWAYS require LC matching
                                if (stockFilters.lcNo && saleLc !== stockFilters.lcNo.toLowerCase()) return;
                                if (stockSearchQuery) {
                                    const q = stockSearchQuery.toLowerCase();
                                    const matchesQuery = normBrand.includes(q) || keyLower.includes(q) || saleLc.includes(q);
                                    if (!matchesQuery) return;
                                }

                                const saleEntryId = `${sale._id}_${siIdx}_${beIdx}`;
                                if (consumedSales.has(saleEntryId)) return;

                                const saleWH = (be.warehouseName || si.whName || si.warehouse || sale.warehouse || sale.whName || '').trim().toLowerCase();
                                if (isWhFilter && saleWH !== stockFilters.warehouse.toLowerCase()) return;

                                const sq = safeParse(be.quantity);
                                let sp = safeParse(be.packet);

                                if (sp <= 0 && sq > 0) {
                                    const pSize = brandObj.packetSize || 30;
                                    sp = sq / pSize;
                                }

                                consumedSales.add(saleEntryId);

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
                if (endDate && dDate > endDate) return;

                const isBeforeDamage = startDate && dDate < startDate;
                
                const dProdName = (damage.productName || damage.product || '').trim().toLowerCase();
                const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
                const dWh = (damage.warehouse || '').trim().toLowerCase();

                if (dProdName === keyLower && dBrand === normBrand) {
                    const damageLc = (damage.lcNo || '').trim().toLowerCase();
                    const stockLc = (item.lcNo || '').trim().toLowerCase();
                    if (damageLc !== stockLc) return; // ALWAYS require LC matching
                    if (stockFilters.lcNo && damageLc !== stockFilters.lcNo.toLowerCase()) return;
                    if (stockSearchQuery) {
                        const q = stockSearchQuery.toLowerCase();
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
        if (sStatus !== 'accepted' && sStatus !== 'pending') return;
        if (endDate && (sale.date || '').split('T')[0] > endDate) return;

        (sale.items || []).forEach((si, siIdx) => {
            const sProdName = (si.productName || '').trim();
            if (!sProdName) return;

            // If this product already has stock records in first pass, do not process in second pass!
            if (groupedStock[sProdName]) return;

            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === sProdName.toLowerCase());
            if (product?.category?.toLowerCase() !== 'general') return;

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
            (si.brandEntries || []).forEach((be, beIdx) => {
                const saleWH = (be.warehouseName || si.whName || si.warehouse || sale.warehouse || sale.whName || '').trim().toLowerCase();
                if (isWhFilter && saleWH !== stockFilters.warehouse.toLowerCase()) return;
                
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
 
                if (stockFilters.lcNo && beLc.toLowerCase() !== stockFilters.lcNo.toLowerCase()) return;
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
                        brand: be.brand || 'No Brand',
                        quality: resolvedQ || '-',
                        openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                        salePacket: 0, saleQuantity: 0, sweepedPacket: 0, sweepedQuantity: 0,
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
                            if (stockFilters.lcNo && (damage.lcNo || '').trim().toLowerCase() !== stockFilters.lcNo.toLowerCase()) return;
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

            return {
                ...b,
                openingQuantity: openingAfterShortage,
                openingPacket: openingPktAfterShortage,
                closingQuantity: closingQty,
                closingPacket: closingPkt,
                inHouseQuantity: closingQty,
                inHousePacket: closingPkt,
                totalInHouseQuantity: openingAfterShortage,
                totalInHousePacket: openingPktAfterShortage
            };
        });

        // If not a price report, group by quality and brand name!
        if (!isPriceReport) {
            brandList = getGroupedBrandList(brandList);
        }

        brandList = brandList.sort((a, b) => {
            const qCmp = (a.quality || '-').localeCompare(b.quality || '-');
            if (qCmp !== 0) return qCmp;
            return a.brand.localeCompare(b.brand);
        }).filter(b => 
            Math.abs(b.totalInHouseQuantity) > 0.01 || 
            Math.abs(b.saleQuantity) > 0.01 || 
            Math.abs(b.inHouseQuantity) > 0.01 || 
            Math.abs(b.sweepedQuantity) > 0.01 ||
            Math.abs(b.damageQuantity || 0) > 0.01
        );

        if (brandList.length === 0) return null;

        const groupedBrands = getGroupedBrandList(brandList);
        const openingQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.openingQuantity), 0);
        const inHouseQty = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.inHouseQuantity), 0);
        const saleQty = brandList.reduce((sum, b) => sum + b.saleQuantity, 0);
        const damageQty = brandList.reduce((sum, b) => sum + (b.damageQuantity || 0), 0);
        const openingPkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.openingPacket), 0);
        const inHousePkt = groupedBrands.reduce((sum, b) => sum + Math.max(0, b.inHousePacket), 0);
        const salePkt = brandList.reduce((sum, b) => sum + b.salePacket, 0);
        const damagePkt = brandList.reduce((sum, b) => sum + (b.damagePacket || 0), 0);

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
            filteredBrands = filteredBrands.filter(b => (b.brand || '').trim() === stockFilters.brand);
        } else {
            // Otherwise just filter out empty stocks
            filteredBrands = filteredBrands.filter(b => Math.abs(b.inHouseQuantity) > 0.01);
        }

        if (filteredBrands.length === 0 && (!stockFilters.brand || Math.abs(group.inHouseQuantity) <= 0.01)) {
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
            if (stockFilters.lcNo && (damage.lcNo || '').trim() !== stockFilters.lcNo) return;
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
