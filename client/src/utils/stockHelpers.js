// Helper to parse numbers safely and handle potential strings with commas
const safeParse = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
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

export const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = [], products = []) => {
    const rawExpanded = [];
    const seenRecords = new Set();

    // 1. Process Primary Stock Records (LC Receive)
    stockRecords.forEach(item => {
        if ((item.status || '').toLowerCase().includes('requested')) return;
        
        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach((entry, idx) => {
                const uniqueId = `${item._id}_brand_${idx}`;
                if (seenRecords.has(uniqueId)) return;
                seenRecords.add(uniqueId);

                rawExpanded.push({
                    ...item,
                    _id: uniqueId,
                    brand: entry.brand || item.brand || '',
                    productName: item.productName || item.product || '',
                    warehouse: item.warehouse || item.whName || '',
                    quantity: safeParse(entry.quantity ?? item.quantity),
                    packet: safeParse(entry.packet ?? item.packet),
                    packetSize: safeParse(entry.packetSize ?? item.packetSize),
                    inHousePacket: safeParse(entry.inHousePacket ?? entry.inhousePkt ?? item.inHousePacket),
                    inHouseQuantity: safeParse(entry.inHouseQuantity ?? entry.inhouseQty ?? item.inHouseQuantity),
                    sweepedPacket: safeParse(entry.sweepedPacket ?? entry.shortagePkt ?? item.sweepedPacket),
                    sweepedQuantity: safeParse(entry.sweepedQuantity ?? entry.shortageQty ?? item.sweepedQuantity),
                    unit: entry.unit || item.unit,
                    recordType: 'stock'
                });
            });
        } else {
            if (seenRecords.has(item._id)) return;
            seenRecords.add(item._id);
            rawExpanded.push({ 
                ...item, 
                recordType: 'stock',
                inHouseQuantity: safeParse(item.inHouseQuantity ?? item.inhouseQty ?? item.quantity),
                inHousePacket: safeParse(item.inHousePacket ?? item.inhousePkt ?? item.packet)
            });
        }
    });

    // 2. Process Warehouse Records (Transfers)
    warehouseData.forEach(whItem => {
        if (!whItem || whItem.recordType !== 'warehouse') return;
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
        if (stockFilters.warehouse) {
            const filterWH = stockFilters.warehouse.trim().toLowerCase();
            const itemWH = (item.whName || item.warehouse || '').trim().toLowerCase();
            if (itemWH !== filterWH && !itemWH.includes(filterWH) && !filterWH.includes(itemWH)) return false;
        }
        if (stockFilters.brand && (item.brand || '').trim() !== stockFilters.brand) return false;
        if (stockFilters.productName) {
            const itemName = (item.productName || item.product || '').trim().toLowerCase();
            if (itemName !== stockFilters.productName.toLowerCase()) return false;
        }
        
        if (stockSearchQuery) {
            const q = stockSearchQuery.toLowerCase();
            return (item.lcNo||'').toLowerCase().includes(q) || (item.brand||'').toLowerCase().includes(q) || (item.productName||item.product||'').toLowerCase().includes(q);
        }
        return true;
    });

    // 4. Aggregation
    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = item.productName || item.product || 'Unknown';
        const itemDateOnly = (item.date || '').split('T')[0];
        const isBefore = startDate && itemDateOnly < startDate;

        if (!acc[key]) {
            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === key.toLowerCase());
            acc[key] = {
                productName: key,
                productRef: product,
                category: product ? product.category : '',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                unit: item.unit || 'kg',
                brands: {}, allIds: []
            };
        }

        const normBrand = (item.brand || 'No Brand').trim().toLowerCase();
        if (!acc[key].brands[normBrand]) {
            acc[key].brands[normBrand] = {
                brand: item.brand || 'No Brand',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                packetSize: safeParse(item.packetSize),
                _salesResolved: false
            };
        }

        const brandObj = acc[key].brands[normBrand];

        // Resolve Sales for this brand if not already done
        if (!brandObj._salesResolved) {
            salesRecords.forEach(sale => {
                const sStatus = (sale.status || '').toLowerCase();
                if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                
                const sDate = (sale.date || sale.createdAt || '').split('T')[0];
                if (endDate && sDate > endDate) return;

                const isBeforeSale = startDate && sDate < startDate;
                (sale.items || []).forEach(si => {
                    const siName = (si.productName || si.product || '').trim().toLowerCase();
                    if (siName === key.toLowerCase()) {
                        (si.brandEntries || []).forEach(be => {
                            const beBrand = (be.brand || '').trim().toLowerCase();
                            if (beBrand === normBrand) {
                                if (stockFilters.warehouse && (be.warehouseName || '').trim().toLowerCase() !== stockFilters.warehouse.toLowerCase()) return;
                                
                                const sq = safeParse(be.quantity);
                                let sp = safeParse(be.packet);

                                // If bag count is missing but weight exists, calculate bags
                                if (sp <= 0 && sq > 0) {
                                    const pSize = brandObj.packetSize || 30;
                                    sp = sq / pSize;
                                }

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

        // Arrival Quantities: Use physical distributed stock if filtering by warehouse.
        // For Global view, only count primary LC records as "Arrival" to prevent double-counting transfers.
        const arrivalQty = stockFilters.warehouse 
            ? safeParse(item.inHouseQuantity) 
            : (item.recordType === 'stock' ? safeParse(item.quantity) : 0);
        
        const arrivalPkt = stockFilters.warehouse 
            ? safeParse(item.inHousePacket) 
            : (item.recordType === 'stock' ? safeParse(item.packet) : 0);

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
        if (sStatus !== 'accepted' && sStatus !== 'pending' && sStatus !== 'requested') return;
        if (endDate && (sale.date || '').split('T')[0] > endDate) return;

        (sale.items || []).forEach(si => {
            const sProdName = (si.productName || '').trim();
            if (!sProdName) return;

            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === sProdName.toLowerCase());
            if (product?.category?.toLowerCase() !== 'general') return;

            if (stockFilters.productName && sProdName.toLowerCase() !== stockFilters.productName.toLowerCase()) return;
            
            if (!groupedStock[sProdName]) {
                groupedStock[sProdName] = {
                    productName: sProdName, productRef: product, category: 'General',
                    openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                    saleQuantity: 0, salePacket: 0, sweepedPacket: 0, sweepedQuantity: 0,
                    inHousePacket: 0, inHouseQuantity: 0,
                    unit: si.unit || 'kg', brands: {}, allIds: []
                };
            }
            const group = groupedStock[sProdName];
            (si.brandEntries || []).forEach(be => {
                if (stockFilters.warehouse && (be.warehouseName || '').trim().toLowerCase() !== stockFilters.warehouse.toLowerCase()) return;
                const normBrand = (be.brand || 'No Brand').trim().toLowerCase();
                if (!group.brands[normBrand]) {
                    group.brands[normBrand] = {
                        brand: be.brand || 'No Brand',
                        openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                        salePacket: 0, saleQuantity: 0, sweepedPacket: 0, sweepedQuantity: 0,
                        inHousePacket: 0, inHouseQuantity: 0, packetSize: safeParse(be.packetSize),
                        _salesResolved: false
                    };
                }
                const brandObj = group.brands[normBrand];
                if (!brandObj._salesResolved) {
                    const sDate = (sale.date || '').split('T')[0];
                    const isBefore = startDate && sDate < startDate;
                    const sq = safeParse(be.quantity);
                    const sp = safeParse(be.packet);
                    if (isBefore) {
                        brandObj.openingQuantity -= sq;
                        group.openingQuantity -= sq;
                    } else {
                        brandObj.saleQuantity += sq;
                        brandObj.salePacket += sp;
                        group.saleQuantity += sq;
                        group.salePacket += sp;
                    }
                    brandObj._salesResolved = true;
                }
            });
        });
    });

    const displayRecords = Object.values(groupedStock).map(group => {
        const brandList = Object.values(group.brands).map(b => {
            // In this UI table, "Opening Stock" is the total arriving or starting balance
            const totalIn = b.openingQuantity + b.periodArrivalQuantity;
            const saleQty = b.saleQuantity;
            const shortageQty = b.sweepedQuantity;
            
            // MATH: Closing = Arrival - Sales - Shortage
            const closingQty = totalIn - saleQty - shortageQty;
            const closingPkt = (b.openingPacket + b.periodArrivalPacket) - b.salePacket - b.sweepedPacket;

            return {
                ...b,
                openingQuantity: totalIn,
                openingPacket: b.openingPacket + b.periodArrivalPacket,
                closingQuantity: closingQty,
                closingPacket: closingPkt,
                inHouseQuantity: closingQty,
                inHousePacket: closingPkt,
                totalInHouseQuantity: totalIn,
                totalInHousePacket: b.openingPacket + b.periodArrivalPacket
            };
        }).sort((a,b) => a.brand.localeCompare(b.brand));

        const openingQty = brandList.reduce((sum, b) => sum + b.openingQuantity, 0);
        const inHouseQty = brandList.reduce((sum, b) => sum + b.inHouseQuantity, 0);
        const saleQty = brandList.reduce((sum, b) => sum + b.saleQuantity, 0);
        const openingPkt = brandList.reduce((sum, b) => sum + b.openingPacket, 0);
        const inHousePkt = brandList.reduce((sum, b) => sum + b.inHousePacket, 0);
        const salePkt = brandList.reduce((sum, b) => sum + b.salePacket, 0);

        return {
            ...group, 
            brandList,
            packetSize: brandList[0]?.packetSize || 0,
            openingQuantity: openingQty,
            openingPacket: openingPkt,
            totalInHouseQuantity: openingQty,
            totalInHousePacket: openingPkt,
            inHouseQuantity: inHouseQty,
            inHousePacket: inHousePkt,
            saleQuantity: saleQty,
            salePacket: salePkt
        };
    }).sort((a, b) => a.productName.localeCompare(b.productName));

    // Summary Calculations
    let tOpeningQty = 0; let tSaleQty = 0; let tInHouseQty = 0; let tShortageQty = 0;
    const tOpeningPkt = { whole: 0, remainder: 0 };
    const tSalePkt = { whole: 0, remainder: 0 };
    const tInHousePkt = { whole: 0, remainder: 0 };

    displayRecords.forEach(group => {
        group.brandList.forEach(b => {
            tOpeningQty += b.openingQuantity;
            tSaleQty += b.saleQuantity;
            tInHouseQty += b.inHouseQuantity;
            tShortageQty += b.sweepedQuantity;

            const op = calculatePktRemainder(b.openingQuantity, b.packetSize);
            tOpeningPkt.whole += op.whole; tOpeningPkt.remainder += op.remainder;

            const sl = calculatePktRemainder(b.saleQuantity, b.packetSize);
            tSalePkt.whole += sl.whole; tSalePkt.remainder += sl.remainder;

            const ih = calculatePktRemainder(b.inHouseQuantity, b.packetSize);
            tInHousePkt.whole += ih.whole; tInHousePkt.remainder += ih.remainder;
        });
    });

    return {
        displayRecords,
        totalQuantity: tOpeningQty,
        totalSaleQty: tSaleQty,
        totalInHouseQty: tInHouseQty,
        totalShortage: tShortageQty,
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
