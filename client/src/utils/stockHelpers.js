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
        if (!acc[key]) {
            acc[key] = {
                productName: item.productName,
                quantity: 0,
                inHousePacket: 0,
                inHouseQuantity: 0,
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
                sweepedPacket: 0,
                sweepedQuantity: 0,
                packetSize: item.packetSize || 0
            };
        }

        const brandObj = acc[key].brands[brandKey];
        brandObj.quantity += (parseFloat(item.quantity) || 0);
        brandObj.inHousePacket += (parseFloat(item.inHousePacket) || 0);
        brandObj.inHouseQuantity += (parseFloat(item.inHouseQuantity) || 0);
        brandObj.sweepedPacket += (parseFloat(item.sweepedPacket) || 0);
        brandObj.sweepedQuantity += (parseFloat(item.sweepedQuantity) || 0);

        acc[key].quantity += (parseFloat(item.quantity) || 0);
        acc[key].inHousePacket += (parseFloat(item.inHousePacket) || 0);
        acc[key].inHouseQuantity += (parseFloat(item.inHouseQuantity) || 0);
        acc[key].sweepedPacket += (parseFloat(item.sweepedPacket) || 0);
        acc[key].sweepedQuantity += (parseFloat(item.sweepedQuantity) || 0);

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

    const displayRecords = Object.values(groupedStock).map(group => ({
        ...group,
        brandList: Object.values(group.brands)
    }));

    const totalPackets = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.packet) || 0), 0);
    const totalQuantity = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    const totalInHousePkt = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.inHousePacket) || 0), 0);
    const totalInHouseQty = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.inHouseQuantity) || 0), 0);
    const totalShortage = filteredRecords.reduce((sum, item) => sum + (parseFloat(item.sweepedQuantity) || 0), 0);
    const totalInHousePktDecimalKg = filteredRecords.reduce((sum, item) => {
        const pkt = parseFloat(item.inHousePacket) || 0;
        const size = parseFloat(item.packetSize) || 0;
        const decimalPortion = pkt - Math.floor(pkt);
        return sum + (decimalPortion * size);
    }, 0);
    const unit = displayRecords[0]?.unit || 'kg';

    return { displayRecords, totalPackets, totalQuantity, totalInHousePkt, totalInHousePktDecimalKg, totalInHouseQty, totalShortage, unit };
};
