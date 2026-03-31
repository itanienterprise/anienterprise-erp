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
    // Expand LC Receive records that have brandEntries into individual brand-level records
    const expandedRecords = [];
    stockRecords.forEach(item => {
        // Exclude "Requested" items from stock calculations as they are not yet officially in stock
        if ((item.status || '').toLowerCase().includes('requested')) return;

        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach(entry => {
                expandedRecords.push({
                    ...item,
                    brand: entry.brand || item.brand || '',
                    quantity: safeParse(entry.quantity) || safeParse(item.quantity),
                    packet: safeParse(entry.packet) || safeParse(item.packet),
                    packetSize: safeParse(entry.packetSize) || safeParse(item.packetSize),
                    inHousePacket: safeParse(entry.inHousePacket),
                    inHouseQuantity: safeParse(entry.inHouseQuantity),
                    totalInHousePacket: safeParse(entry.inHousePacket),
                    totalInHouseQuantity: safeParse(entry.inHouseQuantity),
                    sweepedPacket: safeParse(entry.sweepedPacket),
                    sweepedQuantity: safeParse(entry.sweepedQuantity),
                    unit: entry.unit || item.unit,
                    _expandedFromBrandEntries: true
                });
            });
        } else {
            expandedRecords.push(item);
        }
    });

    // 1. Separate filtration criteria: Identify records BEFORE the period and WITHIN the period
    const startDate = stockFilters.startDate || '';
    const endDate = stockFilters.endDate || '';

    const filteredRecords = expandedRecords.filter(item => {
        // Exclude records after the end date entirely
        if (endDate && item.date > endDate) return false;
        
        // Match other filters
        if (stockFilters.lcNo && (item.lcNo || '').trim() !== stockFilters.lcNo) return false;
        if (stockFilters.port && (item.port || '').trim() !== stockFilters.port) return false;
        if (stockFilters.importer && (item.importer || '').trim() !== stockFilters.importer) return false;
        if (stockFilters.brand && (item.brand || '').trim() !== stockFilters.brand) return false;
        if (stockFilters.productName) {
            const itemName = (item.productName || item.product || '').trim().toLowerCase();
            if (itemName !== stockFilters.productName.toLowerCase()) return false;
        }

        if (stockFilters.category) {
            const product = products.find(p => {
                const pName = (p.name || p.productName || '').trim().toLowerCase();
                const itemName = (item.productName || item.product || '').trim().toLowerCase();
                return pName === itemName;
            });
            if (!product || (product.category || '').trim().toLowerCase() !== stockFilters.category.toLowerCase()) return false;
        }

        if (stockSearchQuery) {
            const q = stockSearchQuery.toLowerCase();
            return (
                (item.lcNo || '').toLowerCase().includes(q) ||
                (item.port || '').toLowerCase().includes(q) ||
                (item.importer || '').toLowerCase().includes(q) ||
                (item.truckNo || '').toLowerCase().includes(q) ||
                (item.brand || '').toLowerCase().includes(q) ||
                (item.productName || item.product || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = item.productName || item.product || 'Unknown';
        const isBefore = startDate && item.date < startDate;

        if (!acc[key]) {
            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === key.toLowerCase());
            acc[key] = {
                productName: key,
                category: product ? product.category : '',
                openingPacket: 0,
                openingQuantity: 0,
                periodArrivalPacket: 0,
                periodArrivalQuantity: 0,
                salePacket: 0,
                saleQuantity: 0,
                sweepedPacket: 0,
                sweepedQuantity: 0,
                unit: item.unit,
                brands: {},
                allIds: []
            };
        }

        const brandKey = (item.brand || 'No Brand').trim().toLowerCase();
        if (!acc[key].brands[brandKey]) {
            acc[key].brands[brandKey] = {
                brand: item.brand,
                importer: item.importer,
                port: item.port,
                openingPacket: 0,
                openingQuantity: 0,
                periodArrivalPacket: 0,
                periodArrivalQuantity: 0,
                salePacket: 0,
                saleQuantity: 0,
                sweepedPacket: 0,
                sweepedQuantity: 0,
                packetSize: safeParse(item.packetSize)
            };
        }

        const brandObj = acc[key].brands[brandKey];

        // Resolve Sales for this brand if not already done
        if (!brandObj._salesResolved) {
            let beforeSaleQty = 0;
            let beforeSalePkt = 0;
            let currentSaleQty = 0;
            let currentSalePkt = 0;

            const currentPktSize = safeParse(item.packetSize);
            const targetProd = (item.productName || item.product || '').toLowerCase().trim();
            const targetBrand = (item.brand || '').toLowerCase().trim();

            // 1. Sales Records
            salesRecords.forEach(sale => {
                const sStatus = (sale.status || '').toLowerCase();
                if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                // Exclude sales after end date
                if (endDate && sale.date > endDate) return;

                const isBeforeSale = startDate && sale.date < startDate;

                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(saleItem => {
                        const sProd = (saleItem.productName || '').toLowerCase().trim();
                        if (sProd === targetProd && saleItem.brandEntries) {
                            saleItem.brandEntries.forEach(entry => {
                                const sBrand = (entry.brand || '').toLowerCase().trim();
                                if (sBrand === targetBrand || ((sBrand === '' || sBrand === '-') && targetBrand === targetProd)) {
                                    const sQty = safeParse(entry.quantity);
                                    const sPkt = currentPktSize > 0 ? (sQty / currentPktSize) : 0;
                                    
                                    if (isBeforeSale) {
                                        beforeSaleQty += sQty;
                                        beforeSalePkt += sPkt;
                                    } else {
                                        currentSaleQty += sQty;
                                        currentSalePkt += sPkt;
                                    }
                                }
                            });
                        }
                    });
                }
            });

            // 2. Warehouse Sales
            warehouseData.forEach(whItem => {
                if (whItem && (whItem.recordType === 'warehouse' || (whItem.recordType === 'stock' && whItem.whName))) {
                    const wProd = (whItem.productName || whItem.product || '').toLowerCase().trim();
                    const wBrand = (whItem.brand || '').toLowerCase().trim();
                    if (wProd === targetProd && wBrand === targetBrand) {
                        // Warehouse data date filtering? Assuming whItem has a date or linked to record date
                        // However, current schema might not have historical date for warehouse sales readily available here
                        const itemDate = whItem.date || whItem.createdAt;
                        const isBeforeWh = startDate && itemDate && itemDate < startDate;
                        
                        const sQty = safeParse(whItem.saleQuantity);
                        const sPkt = safeParse(whItem.salePacket);

                        if (isBeforeWh) {
                            beforeSaleQty += sQty;
                            beforeSalePkt += sPkt;
                        } else {
                            currentSaleQty += sQty;
                            currentSalePkt += sPkt;
                        }
                    }
                }
            });

            brandObj.openingQuantity -= beforeSaleQty;
            brandObj.openingPacket -= beforeSalePkt;
            brandObj.saleQuantity = currentSaleQty;
            brandObj.salePacket = currentSalePkt;
            brandObj._salesResolved = true;

            acc[key].openingQuantity -= beforeSaleQty;
            acc[key].openingPacket -= beforeSalePkt;
            acc[key].saleQuantity += currentSaleQty;
            acc[key].salePacket += currentSalePkt;
        }

        const qty = safeParse(item.quantity);
        const shortagePkt = safeParse(item.sweepedPacket);
        const shortageQty = safeParse(item.sweepedQuantity);
        const basePkt = safeParse(item.packet);
        const currentPktSize = safeParse(item.packetSize);

        const totalInPkt = item.totalInHousePacket !== undefined ? safeParse(item.totalInHousePacket) : (basePkt - shortagePkt);
        let totalInQty = 0;
        if (item.totalInHouseQuantity !== undefined) {
            totalInQty = safeParse(item.totalInHouseQuantity);
        } else if (currentPktSize > 0) {
            totalInQty = totalInPkt * currentPktSize;
        } else {
            totalInQty = qty - shortageQty;
        }

        if (isBefore) {
            brandObj.openingPacket += totalInPkt;
            brandObj.openingQuantity += totalInQty;
            acc[key].openingPacket += totalInPkt;
            acc[key].openingQuantity += totalInQty;
        } else {
            brandObj.periodArrivalPacket += totalInPkt;
            brandObj.periodArrivalQuantity += totalInQty;
            acc[key].periodArrivalPacket += totalInPkt;
            acc[key].periodArrivalQuantity += totalInQty;
        }

        brandObj.sweepedPacket += shortagePkt;
        brandObj.sweepedQuantity += shortageQty;
        acc[key].sweepedPacket += shortagePkt;
        acc[key].sweepedQuantity += shortageQty;

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

    // --- SECOND PASS: GENERAL PRODUCTS ---
    salesRecords.forEach(sale => {
        const sStatus = (sale.status || '').toLowerCase();
        if (sStatus !== 'accepted' && sStatus !== 'pending' && sStatus !== 'requested') return;
        if (endDate && sale.date > endDate) return;

        if (sale && sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(saleItem => {
                const sProdName = (saleItem.productName || '').trim();
                if (!sProdName) return;

                const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === sProdName.toLowerCase());
                const category = (product?.category || '').trim().toLowerCase();
                if (category !== 'general') return;

                if (stockFilters.productName && sProdName.toLowerCase() !== stockFilters.productName.toLowerCase()) return;
                if (stockFilters.category && category !== stockFilters.category.toLowerCase()) return;
                
                if (stockSearchQuery) {
                    const q = stockSearchQuery.toLowerCase();
                    const hasMatch = sProdName.toLowerCase().includes(q) || 
                                     (saleItem.brandEntries || []).some(be => (be.brand || '').toLowerCase().includes(q));
                    if (!hasMatch) return;
                }

                if (!groupedStock[sProdName]) {
                    groupedStock[sProdName] = {
                        productName: sProdName,
                        category: 'General',
                        openingPacket: 0,
                        openingQuantity: 0,
                        periodArrivalPacket: 0,
                        periodArrivalQuantity: 0,
                        saleQuantity: 0,
                        salePacket: 0,
                        sweepedPacket: 0,
                        sweepedQuantity: 0,
                        unit: saleItem.unit || 'kg',
                        brands: {},
                        allIds: []
                    };
                }

                const group = groupedStock[sProdName];
                (saleItem.brandEntries || []).forEach(entry => {
                    const brandKey = (entry.brand || 'No Brand').trim().toLowerCase();
                    if (!group.brands[brandKey]) {
                        group.brands[brandKey] = {
                            brand: entry.brand,
                            importer: '-',
                            port: '-',
                            openingPacket: 0, openingQuantity: 0,
                            periodArrivalPacket: 0, periodArrivalQuantity: 0,
                            salePacket: 0, saleQuantity: 0,
                            sweepedPacket: 0, sweepedQuantity: 0,
                            packetSize: safeParse(saleItem.packetSize || entry.packetSize)
                        };
                    }

                    const brandObj = group.brands[brandKey];
                    if (!brandObj._salesResolved) {
                        let beforeSaleQty = 0; let beforeSalePkt = 0;
                        let currentSaleQty = 0; let currentSalePkt = 0;
                        const targetProd = sProdName.toLowerCase().trim();
                        const targetBrand = (entry.brand || '').toLowerCase().trim();
                        const currentPktSize = brandObj.packetSize;

                        salesRecords.forEach(s => {
                            const st = (s.status || '').toLowerCase();
                            if (st !== 'accepted' && st !== 'pending') return;
                            if (endDate && s.date > endDate) return;

                            const isBefore = startDate && s.date < startDate;
                            if (s.items) {
                                s.items.forEach(si => {
                                    if ((si.productName || si.productName || '').toLowerCase().trim() === targetProd && si.brandEntries) {
                                        si.brandEntries.forEach(be => {
                                            const bName = (be.brand || '').toLowerCase().trim();
                                            if (bName === targetBrand || ((bName === '' || bName === '-') && targetBrand === targetProd)) {
                                                const sq = safeParse(be.quantity);
                                                const sp = currentPktSize > 0 ? (sq / currentPktSize) : 0;
                                                if (isBefore) { beforeSaleQty += sq; beforeSalePkt += sp; }
                                                else { currentSaleQty += sq; currentSalePkt += sp; }
                                            }
                                        });
                                    }
                                });
                            }
                        });

                        brandObj.openingQuantity -= beforeSaleQty;
                        brandObj.openingPacket -= beforeSalePkt;
                        brandObj.saleQuantity = currentSaleQty;
                        brandObj.salePacket = currentSalePkt;
                        brandObj._salesResolved = true;

                        group.openingQuantity -= beforeSaleQty;
                        group.openingPacket -= beforeSalePkt;
                        group.saleQuantity += currentSaleQty;
                        group.salePacket += currentSalePkt;
                    }
                });
            });
        }
    });

    const displayRecords = Object.values(groupedStock).map(group => {
        const isGeneral = (group.category || '').toLowerCase() === 'general';
        const brandList = Object.values(group.brands).map(b => {
            const trueOpeningQty = b.openingQuantity;
            const trueOpeningPkt = b.openingPacket;
            const reportOpeningQty = trueOpeningQty + b.periodArrivalQuantity;
            const reportOpeningPkt = trueOpeningPkt + b.periodArrivalPacket;
            
            const closingQuantity = reportOpeningQty - b.saleQuantity;
            const closingPacket = reportOpeningPkt - b.salePacket;
            const isPreSold = closingQuantity < 0;

            return {
                ...b,
                trueOpeningQuantity: trueOpeningQty,
                trueOpeningPacket: trueOpeningPkt,
                openingQuantity: reportOpeningQty,
                openingPacket: reportOpeningPkt,
                inHouseQuantity: closingQuantity,
                inHousePacket: closingPacket,
                totalInHouseQuantity: reportOpeningQty,
                totalInHousePacket: reportOpeningPkt,
                saleQuantity: b.saleQuantity,
                salePacket: b.salePacket,
                isPreSold
            };
        }).filter(b => {
            if (b.inHouseQuantity !== 0 || b.openingQuantity !== 0 || b.saleQuantity !== 0) return true;
            if (isGeneral && b.saleQuantity > 0) return true;
            return false;
        }).sort((a, b) => (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' }));

        const trueOpeningQty = group.openingQuantity;
        const reportOpeningQty = trueOpeningQty + group.periodArrivalQuantity;
        const closingQuantity = reportOpeningQty - group.saleQuantity;

        return {
            ...group,
            brandList,
            trueOpeningQuantity: trueOpeningQty,
            trueOpeningPacket: brandList.reduce((sum, b) => sum + (b.trueOpeningPacket || 0), 0),
            openingQuantity: reportOpeningQty,
            openingPacket: brandList.reduce((sum, b) => sum + (b.openingPacket || 0), 0),
            inHouseQuantity: closingQuantity,
            inHousePacket: brandList.reduce((sum, b) => sum + (b.inHousePacket || 0), 0),
            saleQuantity: brandList.reduce((sum, b) => sum + (b.saleQuantity || 0), 0),
            salePacket: brandList.reduce((sum, b) => sum + (b.salePacket || 0), 0),
            totalInHouseQuantity: reportOpeningQty,
            isPreSold: closingQuantity < 0
        };
    }).filter(group => group.brandList.length > 0).sort((a, b) => (a.productName || '').localeCompare(b.productName || '', undefined, { sensitivity: 'base' }));

    // --- Summary card calculations ---
    let totalOpeningQty = 0;
    let totalArrivalQty = 0;
    let totalSaleQty = 0;
    let totalInHouseQty = 0;
    
    let totalOpeningPkt = 0;
    let totalArrivalPkt = 0;
    let totalSalePkt = 0;
    let totalInHousePkt = 0;

    displayRecords.forEach(group => {
        group.brandList.forEach(brand => {
            totalOpeningQty += (brand.trueOpeningQuantity || 0);
            totalArrivalQty += (brand.periodArrivalQuantity || 0);
            totalSaleQty += (brand.saleQuantity || 0);
            totalInHouseQty += (brand.inHouseQuantity || 0);
            
            totalOpeningPkt += (brand.trueOpeningPacket || 0);
            totalArrivalPkt += (brand.periodArrivalPacket || 0);
            totalSalePkt += (brand.salePacket || 0);
            totalInHousePkt += (brand.inHousePacket || 0);
        });
    });

    const totalPackets = filteredRecords.reduce((sum, item) => sum + safeParse(item.packet), 0);
    const totalQuantity = filteredRecords.reduce((sum, item) => sum + safeParse(item.quantity), 0);
    const totalShortage = filteredRecords.reduce((sum, item) => sum + safeParse(item.sweepedQuantity), 0);

    const totalInHousePktDetails = displayRecords.reduce((acc, group) => {
        group.brandList.forEach(brand => {
            const { whole, remainder } = calculatePktRemainder(brand.inHouseQuantity, brand.packetSize);
            acc.whole += whole;
            acc.remainder += remainder;
        });
        return acc;
    }, { whole: 0, remainder: 0 });

    const totalInHousePktWhole = totalInHousePktDetails.whole;
    const totalInHousePktDecimalKg = totalInHousePktDetails.remainder;

    const totalSalePktDetails = displayRecords.reduce((acc, group) => {
        group.brandList.forEach(brand => {
            const { whole, remainder } = calculatePktRemainder(brand.saleQuantity, brand.packetSize);
            acc.whole += whole;
            acc.remainder += remainder;
        });
        return acc;
    }, { whole: 0, remainder: 0 });

    const totalSalePktWhole = totalSalePktDetails.whole;
    const totalSalePktDecimalKg = totalSalePktDetails.remainder;

    const totalArrivalPktDetails = displayRecords.reduce((acc, group) => {
        group.brandList.forEach(brand => {
            const { whole, remainder } = calculatePktRemainder(brand.periodArrivalQuantity, brand.packetSize);
            acc.whole += whole;
            acc.remainder += remainder;
        });
        return acc;
    }, { whole: 0, remainder: 0 });

    const totalOpeningPktDetails = displayRecords.reduce((acc, group) => {
        group.brandList.forEach(brand => {
            const { whole, remainder } = calculatePktRemainder(brand.trueOpeningQuantity, brand.packetSize);
            acc.whole += whole;
            acc.remainder += remainder;
        });
        return acc;
    }, { whole: 0, remainder: 0 });

    const unit = displayRecords[0]?.unit || 'kg';

    return {
        displayRecords,
        totalPackets,
        totalQuantity,
        totalInHousePkt,
        totalInHousePktWhole,
        totalSalePktWhole,
        totalInHouseQty,
        totalTotalInHousePkt: totalOpeningPktDetails.whole,
        totalTotalInHouseQty: totalOpeningQty,
        totalOpeningPktWhole: totalOpeningPktDetails.whole,
        totalOpeningPktRemainder: totalOpeningPktDetails.remainder,
        totalArrivalQty,
        totalArrivalPktWhole: totalArrivalPktDetails.whole,
        totalArrivalPktRemainder: totalArrivalPktDetails.remainder,
        totalInHousePktDecimalKg,
        totalSalePkt,
        totalSaleQty,
        totalSalePktDecimalKg,
        totalShortage,
        unit
    };
};
