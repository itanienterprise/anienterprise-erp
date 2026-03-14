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

    const filteredRecords = expandedRecords.filter(item => {
        if (stockFilters.startDate && item.date < stockFilters.startDate) return false;
        if (stockFilters.endDate && item.date > stockFilters.endDate) return false;
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

        if (!stockSearchQuery) return true;
        const q = stockSearchQuery.toLowerCase();
        return (
            (item.lcNo || '').toLowerCase().includes(q) ||
            (item.port || '').toLowerCase().includes(q) ||
            (item.importer || '').toLowerCase().includes(q) ||
            (item.truckNo || '').toLowerCase().includes(q) ||
            (item.brand || '').toLowerCase().includes(q) ||
            (item.productName || item.product || '').toLowerCase().includes(q)
        );
    });

    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = item.productName || item.product || 'Unknown';

        if (!acc[key]) {
            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === key.toLowerCase());
            acc[key] = {
                productName: key,
                category: product ? product.category : '',
                quantity: 0,
                inHousePacket: 0,
                inHouseQuantity: 0,
                totalInHousePacket: 0,
                totalInHouseQuantity: 0,
                salePacket: 0,
                saleQuantity: 0,
                sweepedPacket: 0,
                sweepedQuantity: 0,
                unit: item.unit,
                brands: {}, // Group by brand within product
                allIds: []
            };
        }

        const brandKey = (item.brand || 'No Brand').trim().toLowerCase();
        if (!acc[key].brands[brandKey]) {
            acc[key].brands[brandKey] = {
                brand: item.brand,
                importer: item.importer,
                port: item.port,
                quantity: 0,
                inHousePacket: 0,
                inHouseQuantity: 0,
                totalInHousePacket: 0,
                totalInHouseQuantity: 0,
                salePacket: 0,
                saleQuantity: 0,
                sweepedPacket: 0,
                sweepedQuantity: 0,
                packetSize: safeParse(item.packetSize)
            };
        }

        const brandObj = acc[key].brands[brandKey];

        // Ensure sales are calculated ONLY once per unique brand grouping object
        if (!brandObj._salesResolved) {
            let dynamicSaleQty = 0;
            let dynamicSalePkt = 0;
            const currentPktSize = safeParse(item.packetSize);
            const targetProd = (item.productName || item.product || '').toLowerCase().trim();
            const targetBrand = (item.brand || '').toLowerCase().trim();

            // 1. Accumulate from Sales Records (Direct Sales)
            salesRecords.forEach(sale => {
                const sStatus = (sale.status || '').toLowerCase();
                if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                if (sale && sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach(saleItem => {
                        const sProd = (saleItem.productName || '').toLowerCase().trim();
                        if (sProd === targetProd && saleItem.brandEntries) {
                            saleItem.brandEntries.forEach(entry => {
                                const sBrand = (entry.brand || '').toLowerCase().trim();
                                // Match if exact brand match OR if sale brand is empty and stock brand matches product name (single-mode)
                                if (sBrand === targetBrand || ((sBrand === '' || sBrand === '-') && targetBrand === targetProd)) {
                                    const sQty = safeParse(entry.quantity);
                                    dynamicSaleQty += sQty;
                                    if (currentPktSize > 0) {
                                        dynamicSalePkt += (sQty / currentPktSize);
                                    }
                                }
                            });
                        }
                    });
                }
            });

            // 2. Accumulate from Warehouse Data (Sales specifically recorded against warehouses)
            warehouseData.forEach(whItem => {
                if (whItem && (whItem.recordType === 'warehouse' || (whItem.recordType === 'stock' && whItem.whName))) {
                    const wProd = (whItem.productName || whItem.product || '').toLowerCase().trim();
                    const wBrand = (whItem.brand || '').toLowerCase().trim();
                    if (wProd === targetProd && wBrand === targetBrand) {
                        dynamicSaleQty += safeParse(whItem.saleQuantity);
                        dynamicSalePkt += safeParse(whItem.salePacket);
                    }
                }
            });

            // Set final totals
            brandObj.salePacket = dynamicSalePkt;
            brandObj.saleQuantity = dynamicSaleQty;
            brandObj._salesResolved = true;

            // Group totals
            acc[key].salePacket += dynamicSalePkt;
            acc[key].saleQuantity += dynamicSaleQty;
        }

        // Data points
        const qty = safeParse(item.quantity);
        // Use wh fields for current on-hand stock if available, else fallback to inHouse fields
        const inPkt = safeParse(item.whPkt !== undefined ? item.whPkt : item.inHousePacket);
        const inQty = safeParse(item.whQty !== undefined ? item.whQty : item.inHouseQuantity);

        const shortagePkt = safeParse(item.sweepedPacket);
        const shortageQty = safeParse(item.sweepedQuantity);
        const currentPktSize = safeParse(item.packetSize);
        const basePkt = safeParse(item.packet);

        // Derive Total Inhouse if missing (for older records)
        const totalInPkt = item.totalInHousePacket !== undefined ? safeParse(item.totalInHousePacket) : (basePkt - shortagePkt);
        let totalInQty = 0;
        if (item.totalInHouseQuantity !== undefined) {
            totalInQty = safeParse(item.totalInHouseQuantity);
        } else if (currentPktSize > 0) {
            totalInQty = totalInPkt * currentPktSize;
        } else {
            // Fallback for zero size: use weight-based calculation directly from arrival - shortage
            totalInQty = qty - shortageQty;
        }

        brandObj.quantity += qty;
        brandObj.inHousePacket += inPkt;
        brandObj.inHouseQuantity += inQty;
        brandObj.totalInHousePacket += totalInPkt;
        brandObj.totalInHouseQuantity += totalInQty;
        brandObj.sweepedPacket += shortagePkt;
        brandObj.sweepedQuantity += shortageQty;

        acc[key].quantity += qty;
        acc[key].inHousePacket += inPkt;
        acc[key].inHouseQuantity += inQty;
        acc[key].totalInHousePacket += totalInPkt;
        acc[key].totalInHouseQuantity += totalInQty;
        acc[key].sweepedPacket += shortagePkt;
        acc[key].sweepedQuantity += shortageQty;

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

    // --- SECOND PASS: Identify GENERAL products with sales but NO stock records ---
    // This ensure they appear in the report even if arrivals haven't been recorded yet.
    salesRecords.forEach(sale => {
        const sStatus = (sale.status || '').toLowerCase();
        // Allow Requested for discovery, but don't subtract stock yet
        if (sStatus !== 'accepted' && sStatus !== 'pending' && sStatus !== 'requested') return;
        if (sale && sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(saleItem => {
                const sProdName = (saleItem.productName || '').trim();
                if (!sProdName) return;

                // Only proceed if it's a GENERAL product
                const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === sProdName.toLowerCase());
                const category = (product?.category || '').trim().toLowerCase();
                if (category !== 'general') return;

                // Initialize group if missing
                if (!groupedStock[sProdName]) {
                    groupedStock[sProdName] = {
                        productName: sProdName,
                        category: product ? product.category : 'General',
                        quantity: 0,
                        inHousePacket: 0,
                        inHouseQuantity: 0,
                        totalInHousePacket: 0,
                        totalInHouseQuantity: 0,
                        salePacket: 0,
                        saleQuantity: 0,
                        sweepedPacket: 0,
                        sweepedQuantity: 0,
                        unit: saleItem.unit || 'kg',
                        brands: {},
                        allIds: []
                    };
                }

                const group = groupedStock[sProdName];
                const brandsInSale = saleItem.brandEntries || [];
                
                brandsInSale.forEach(entry => {
                    const brandKey = (entry.brand || 'No Brand').trim().toLowerCase();
                    if (!group.brands[brandKey]) {
                        group.brands[brandKey] = {
                            brand: entry.brand,
                            importer: '-',
                            port: '-',
                            quantity: 0,
                            inHousePacket: 0,
                            inHouseQuantity: 0,
                            totalInHousePacket: 0,
                            totalInHouseQuantity: 0,
                            salePacket: 0,
                            saleQuantity: 0,
                            sweepedPacket: 0,
                            sweepedQuantity: 0,
                            packetSize: safeParse(saleItem.packetSize || entry.packetSize)
                        };
                    }

                    const brandObj = group.brands[brandKey];
                    // If this brand wasn't resolved in the first pass, we need to resolve it now.
                    // Important: We only resolve sales for brands that didn't have any stock records.
                    // If it HAD stock records, it was already resolved in the first pass.
                    if (!brandObj._salesResolved) {
                        let dynamicSaleQty = 0;
                        let dynamicSalePkt = 0;
                        const targetProd = sProdName.toLowerCase().trim();
                        const targetBrand = (entry.brand || '').toLowerCase().trim();
                        const currentPktSize = brandObj.packetSize;

                        // Re-run sales accumulation for this specific product/brand
                        salesRecords.forEach(s => {
                            const sStatus = (s.status || '').toLowerCase();
                            // ONLY subtract if confirmed (Accepted or Pending)
                            if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                            
                            if (s && s.items) {
                                s.items.forEach(si => {
                                    if ((si.productName || Si.productName || '').toLowerCase().trim() === targetProd && si.brandEntries) {
                                        si.brandEntries.forEach(be => {
                                            const bName = (be.brand || '').toLowerCase().trim();
                                            if (bName === targetBrand || ((bName === '' || bName === '-') && targetBrand === targetProd)) {
                                                const sq = safeParse(be.quantity);
                                                dynamicSaleQty += sq;
                                                if (currentPktSize > 0) dynamicSalePkt += (sq / currentPktSize);
                                            }
                                        });
                                    }
                                });
                            }
                        });

                         // Also check warehouse recorded sales if any
                         warehouseData.forEach(whItem => {
                            if (whItem && (whItem.recordType === 'warehouse' || (whItem.recordType === 'stock' && whItem.whName))) {
                                const wProd = (whItem.productName || whItem.product || '').toLowerCase().trim();
                                const wBrand = (whItem.brand || '').toLowerCase().trim();
                                if (wProd === targetProd && wBrand === targetBrand) {
                                    dynamicSaleQty += safeParse(whItem.saleQuantity);
                                    dynamicSalePkt += safeParse(whItem.salePacket);
                                }
                            }
                        });

                        brandObj.salePacket = dynamicSalePkt;
                        brandObj.saleQuantity = dynamicSaleQty;
                        brandObj._salesResolved = true;

                        group.salePacket += dynamicSalePkt;
                        group.saleQuantity += dynamicSaleQty;
                    }
                });
            });
        }
    });

    const displayRecords = Object.values(groupedStock).map(group => {
        const isGeneral = (group.category || '').toLowerCase() === 'general';
                const brandList = Object.values(group.brands).map(b => {
            const dynamicInHouseQty = b.totalInHouseQuantity;
            const dynamicInHousePkt = b.totalInHousePacket;

            const inHouseQuantity = Math.max(0, dynamicInHouseQty - b.saleQuantity);
            const inHousePacket = Math.max(0, dynamicInHousePkt - b.salePacket);
            const isPreSold = (dynamicInHouseQty - b.saleQuantity) < 0;

            return {
                ...b,
                inHouseQuantity,
                inHousePacket,
                isPreSold
            };
        }).filter(b => {
            // Show brand if there is physical stock OR if it's a GENERAL product with sales (even if negative stock)
            if (b.inHouseQuantity > 0) return true;
            if (isGeneral && b.saleQuantity > 0) return true;
            return false;
        }).sort((a, b) => (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' }));

        const grpInHouseQty = group.totalInHouseQuantity;
        const grpInHousePkt = group.totalInHousePacket;

        const inHouseQuantity = Math.max(0, grpInHouseQty - group.saleQuantity);
        const inHousePacket = Math.max(0, grpInHousePkt - group.salePacket);
        const isPreSold = (grpInHouseQty - group.saleQuantity) < 0;

        return {
            ...group,
            brandList,
            inHouseQuantity,
            inHousePacket,
            isPreSold
        };
    }).filter(group => group.brandList.length > 0).sort((a, b) => (a.productName || '').localeCompare(b.productName || '', undefined, { sensitivity: 'base' }));

    // --- Summary card calculations ---
    // We calculate these based on the filtered displayRecords to ensure consistency
    // across the UI and to prevent pre-sales of one product from distorting totals of others.
    
    let totalTotalInHouseQty = 0;
    let totalSaleQty = 0;
    let totalInHouseQty = 0;
    
    // For packets, we need to track both arrivals and sales
    let totalTotalInHousePktArrival = 0; // Sum of arrivals
    let totalTotalInHousePktSale = 0;    // Sum of sales (negative effect in pre-sale logic)
    let totalSalePkt = 0;               // Sum of actual sales recorded
    let totalInHousePkt = 0;            // Net balance

    displayRecords.forEach(group => {
        group.brandList.forEach(brand => {
            // These should already be filtered to only include positive inHouseQuantity
            totalTotalInHouseQty += (brand.totalInHouseQuantity || 0);
            totalSaleQty += (brand.saleQuantity || 0);
            totalInHouseQty += (brand.inHouseQuantity || 0);
            
            totalTotalInHousePktArrival += (brand.totalInHousePacket || 0);
            totalSalePkt += (brand.salePacket || 0);
            totalInHousePkt += (brand.inHousePacket || 0);
        });
    });

    const totalPackets = filteredRecords.reduce((sum, item) => sum + safeParse(item.packet), 0);
    const totalQuantity = filteredRecords.reduce((sum, item) => sum + safeParse(item.quantity), 0);
    const totalShortage = filteredRecords.reduce((sum, item) => sum + safeParse(item.sweepedQuantity), 0);

    const totalInHousePktWhole = Math.floor(displayRecords.reduce((acc, group) => acc + group.brandList.reduce((sum, brand) => sum + calculatePktRemainder(brand.inHouseQuantity, brand.packetSize).whole, 0), 0));
    const totalInHousePktDecimalKg = displayRecords.reduce((acc, group) => acc + group.brandList.reduce((sum, brand) => sum + calculatePktRemainder(brand.inHouseQuantity, brand.packetSize).remainder, 0), 0);

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
    const unit = displayRecords[0]?.unit || 'kg';

    return {
        displayRecords,
        totalPackets,
        totalQuantity,
        totalInHousePkt,
        totalInHousePktWhole,
        totalSalePktWhole,
        totalInHouseQty,
        totalTotalInHousePkt: totalTotalInHousePktArrival,
        totalTotalInHouseQty,
        totalInHousePktDecimalKg,
        totalSalePkt,
        totalSaleQty,
        totalSalePktDecimalKg,
        totalShortage,
        unit
    };
};
