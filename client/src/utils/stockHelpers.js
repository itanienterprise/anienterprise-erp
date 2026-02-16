export const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '') => {
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

    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = item.productName || 'Unknown';

        // Helper to parse numbers safely and handle potential strings with commas
        const safeParse = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        };

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

        // Data points
        const qty = safeParse(item.quantity);
        const inPkt = safeParse(item.inHousePacket);
        const inQty = safeParse(item.inHouseQuantity);
        const salePkt = safeParse(item.salePacket);
        const saleQty = safeParse(item.saleQuantity);
        const shortagePkt = safeParse(item.sweepedPacket);
        const shortageQty = safeParse(item.sweepedQuantity);
        const pktSize = safeParse(item.packetSize);
        const basePkt = safeParse(item.packet);

        // Derive Total Inhouse if missing (for older records)
        const totalInPkt = item.totalInHousePacket !== undefined ? safeParse(item.totalInHousePacket) : (basePkt - shortagePkt);
        const totalInQty = item.totalInHouseQuantity !== undefined ? safeParse(item.totalInHouseQuantity) : (totalInPkt * pktSize);

        brandObj.quantity += qty;
        brandObj.inHousePacket += inPkt;
        brandObj.inHouseQuantity += inQty;
        brandObj.totalInHousePacket += totalInPkt;
        brandObj.totalInHouseQuantity += totalInQty;
        brandObj.salePacket += salePkt;
        brandObj.saleQuantity += saleQty;
        brandObj.sweepedPacket += shortagePkt;
        brandObj.sweepedQuantity += shortageQty;

        acc[key].quantity += qty;
        acc[key].inHousePacket += inPkt;
        acc[key].inHouseQuantity += inQty;
        acc[key].totalInHousePacket += totalInPkt;
        acc[key].totalInHouseQuantity += totalInQty;
        acc[key].salePacket += salePkt;
        acc[key].saleQuantity += saleQty;
        acc[key].sweepedPacket += shortagePkt;
        acc[key].sweepedQuantity += shortageQty;

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

    const displayRecords = Object.values(groupedStock).map(group => ({
        ...group,
        brandList: Object.values(group.brands)
    }));

    const safeParse = (val) => {
        if (val === undefined || val === null || val === '') return 0;
        const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    };

    const totalPackets = filteredRecords.reduce((sum, item) => sum + safeParse(item.packet), 0);
    const totalQuantity = filteredRecords.reduce((sum, item) => sum + safeParse(item.quantity), 0);
    const totalInHousePkt = filteredRecords.reduce((sum, item) => sum + safeParse(item.inHousePacket), 0);
    const totalInHouseQty = filteredRecords.reduce((sum, item) => sum + safeParse(item.inHouseQuantity), 0);

    // Summary card calculations
    const totalTotalInHousePkt = filteredRecords.reduce((sum, item) => {
        const val = item.totalInHousePacket !== undefined ? safeParse(item.totalInHousePacket) : (safeParse(item.packet) - safeParse(item.sweepedPacket));
        return sum + val;
    }, 0);

    const totalTotalInHouseQty = filteredRecords.reduce((sum, item) => {
        if (item.totalInHouseQuantity !== undefined) return sum + safeParse(item.totalInHouseQuantity);
        const derivedPkt = safeParse(item.packet) - safeParse(item.sweepedPacket);
        return sum + (derivedPkt * safeParse(item.packetSize));
    }, 0);

    const totalSalePkt = filteredRecords.reduce((sum, item) => sum + safeParse(item.salePacket), 0);
    const totalSaleQty = filteredRecords.reduce((sum, item) => sum + safeParse(item.saleQuantity), 0);
    const totalShortage = filteredRecords.reduce((sum, item) => sum + safeParse(item.sweepedQuantity), 0);

    const totalInHousePktDecimalKg = filteredRecords.reduce((sum, item) => {
        const pkt = safeParse(item.inHousePacket);
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
        totalShortage,
        unit
    };
};
