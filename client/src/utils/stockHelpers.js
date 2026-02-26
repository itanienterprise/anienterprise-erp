export const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = []) => {
    const filteredRecords = stockRecords.filter(item => {
        if (stockFilters.startDate && item.date < stockFilters.startDate) return false;
        if (stockFilters.endDate && item.date > stockFilters.endDate) return false;
        if (stockFilters.lcNo && (item.lcNo || '').trim() !== stockFilters.lcNo) return false;
        if (stockFilters.port && (item.port || '').trim() !== stockFilters.port) return false;
        if (stockFilters.importer && (item.importer || '').trim() !== stockFilters.importer) return false;
        if (stockFilters.brand && (item.brand || '').trim() !== stockFilters.brand) return false;
        if (stockFilters.productName && (item.productName || '').trim().toLowerCase() !== stockFilters.productName.toLowerCase()) return false;

        if (!stockSearchQuery) return true;
        const q = stockSearchQuery.toLowerCase();
        return (
            (item.lcNo || '').toLowerCase().includes(q) ||
            (item.port || '').toLowerCase().includes(q) ||
            (item.importer || '').toLowerCase().includes(q) ||
            (item.truckNo || '').toLowerCase().includes(q) ||
            (item.brand || '').toLowerCase().includes(q) ||
            (item.productName || '').toLowerCase().includes(q)
        );
    });

    // Helper to parse numbers safely and handle potential strings with commas
    const safeParse = (val) => {
        if (val === undefined || val === null || val === '') return 0;
        const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    };

    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = item.productName || 'Unknown';

        if (!acc[key]) {
            acc[key] = {
                productName: item.productName,
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

        const brandKey = `${item.brand || 'No Brand'}_${item.importer || 'No Importer'}_${item.port || 'No Port'}`;
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
            const targetProd = (item.productName || '').toLowerCase().trim();
            const targetBrand = (item.brand || '').toLowerCase().trim();

            // 1. Accumulate from Sales Records (Direct Sales)
            salesRecords.forEach(sale => {
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

    const displayRecords = Object.values(groupedStock).map(group => {
        const brandList = Object.values(group.brands).map(b => {
            const dynamicInHouseQty = b.totalInHouseQuantity;
            const dynamicInHousePkt = b.totalInHousePacket;
            // Subtract sales to show REMAINING inhouse stock on the dashboard
            return {
                ...b,
                inHouseQuantity: Math.max(0, dynamicInHouseQty - b.saleQuantity),
                inHousePacket: Math.max(0, dynamicInHousePkt - b.salePacket)
            };
        });
        const grpInHouseQty = group.totalInHouseQuantity;
        const grpInHousePkt = group.totalInHousePacket;

        return {
            ...group,
            brandList,
            inHouseQuantity: Math.max(0, grpInHouseQty - group.saleQuantity),
            inHousePacket: Math.max(0, grpInHousePkt - group.salePacket)
        };
    });

    const totalPackets = filteredRecords.reduce((sum, item) => sum + safeParse(item.packet), 0);
    const totalQuantity = filteredRecords.reduce((sum, item) => sum + safeParse(item.quantity), 0);

    // Summary card calculations
    const totalTotalInHousePkt = filteredRecords.reduce((sum, item) => {
        const val = item.totalInHousePacket !== undefined ? safeParse(item.totalInHousePacket) : (safeParse(item.packet) - safeParse(item.sweepedPacket));
        return sum + val;
    }, 0);

    const totalTotalInHouseQty = filteredRecords.reduce((sum, item) => {
        if (item.totalInHouseQuantity !== undefined) return sum + safeParse(item.totalInHouseQuantity);
        const derivedPkt = safeParse(item.packet) - safeParse(item.sweepedPacket);
        const size = safeParse(item.packetSize);
        if (size > 0) {
            return sum + (derivedPkt * size);
        }
        // Fallback for zero size
        return sum + (safeParse(item.quantity) - safeParse(item.sweepedQuantity));
    }, 0);

    // Calculate Global Sale Totals from the grouped product data to ensure NO double counting
    let totalSalePkt = Object.values(groupedStock).reduce((sum, group) => sum + safeParse(group.salePacket), 0);
    let totalSaleQty = Object.values(groupedStock).reduce((sum, group) => sum + safeParse(group.saleQuantity), 0);

    const totalShortage = filteredRecords.reduce((sum, item) => sum + safeParse(item.sweepedQuantity), 0);

    // Mathematically derive global current inhouse stock (Total Received - Total Sold)
    const totalInHousePkt = Math.max(0, totalTotalInHousePkt - totalSalePkt);
    const totalInHouseQty = Math.max(0, totalTotalInHouseQty - totalSaleQty);

    const totalInHousePktDecimalKg = displayRecords.reduce((sum, group) => {
        return sum + group.brandList.reduce((brandSum, brand) => {
            const pkt = safeParse(brand.inHousePacket);
            const size = safeParse(brand.packetSize);
            const decimalPortion = pkt - Math.floor(pkt);
            return brandSum + (decimalPortion * size);
        }, 0);
    }, 0);

    const totalSalePktDecimalKg = filteredRecords.reduce((sum, item) => {
        const pkt = safeParse(item.salePacket);
        const size = safeParse(item.packetSize);
        const decimalPortion = pkt - Math.floor(pkt);
        return sum + (decimalPortion * size);
    }, 0);
    const unit = displayRecords[0]?.unit || 'kg';

    return {
        displayRecords,
        totalPackets,
        totalQuantity,
        totalInHousePkt,
        totalInHouseQty,
        totalTotalInHousePkt,
        totalTotalInHouseQty,
        totalInHousePktDecimalKg,
        totalSalePkt,
        totalSaleQty,
        totalSalePktDecimalKg,
        totalShortage,
        unit
    };
};
