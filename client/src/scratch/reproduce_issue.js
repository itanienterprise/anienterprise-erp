
const safeParse = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

const calculatePktRemainder = (totalQty, pktSize) => {
    const qty = safeParse(totalQty);
    const size = safeParse(pktSize);
    if (size <= 0) return { whole: 0, remainder: qty };

    if (qty >= 0) {
        const rawPkt = qty / size;
        const whole = Math.floor(rawPkt + 1e-9);
        const remainder = Math.max(0, Math.round(qty - (whole * size)));
        if (remainder >= size) return { whole: whole + 1, remainder: 0 };
        return { whole, remainder };
    } else {
        const absQty = Math.abs(qty);
        const rawPkt = absQty / size;
        const whole = Math.floor(rawPkt + 1e-9);
        const remainder = Math.max(0, Math.round(absQty - (whole * size)));
        if (remainder >= size) return { whole: -(whole + 1), remainder: 0 };
        return { whole: -whole, remainder: -remainder };
    }
};

const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = [], products = []) => {
    const expandedRecords = [];
    stockRecords.forEach(item => {
        if ((item.status || '').toLowerCase().includes('requested')) return;
        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach(entry => {
                expandedRecords.push({
                    ...item,
                    brand: entry.brand || item.brand || '',
                    quantity: safeParse(entry.quantity) || safeParse(item.quantity),
                    packet: safeParse(entry.packet) || safeParse(item.packet),
                    packetSize: safeParse(entry.packetSize) || safeParse(item.packetSize),
                    inhouseQty: safeParse(entry.inhouseQty),
                    inhousePkt: safeParse(entry.inhousePkt),
                    totalInHouseQuantity: safeParse(entry.totalInHouseQuantity),
                    totalInHousePacket: safeParse(entry.totalInHousePacket),
                    unit: entry.unit || item.unit,
                });
            });
        } else {
            expandedRecords.push(item);
        }
    });

    warehouseData.forEach(whItem => {
        if (whItem && whItem.recordType === 'warehouse') {
            expandedRecords.push({
                ...whItem,
                date: whItem.date || whItem.createdAt || new Date().toISOString(),
                quantity: whItem.whQty,
                packet: whItem.whPkt,
                inhouseQty: whItem.whQty,
                inhousePkt: whItem.whPkt,
                packetSize: whItem.packetSize || 0,
                unit: whItem.unit || 'kg',
                _isWarehouseRecord: true
            });
        }
    });

    const startDate = stockFilters.startDate || '';
    const endDate = stockFilters.endDate || '';

    const filteredRecords = expandedRecords.filter(item => {
        const itemDateOnly = (item.date || '').split('T')[0];
        if (endDate && itemDateOnly > endDate) return false;
        if (stockFilters.warehouse) {
            const filterWH = stockFilters.warehouse.trim().toLowerCase();
            const itemWH = (item.whName || item.warehouse || '').trim().toLowerCase();
            if (itemWH !== filterWH && !itemWH.includes(filterWH) && !filterWH.includes(itemWH)) return false;
        }
        if (stockFilters.productName && (item.productName || item.product || '').trim().toLowerCase() !== stockFilters.productName.toLowerCase()) return false;
        return true;
    });

    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = item.productName || item.product || 'Unknown';
        const itemDateOnly = (item.date || '').split('T')[0];
        const isBefore = startDate && itemDateOnly < startDate;
        if (!acc[key]) {
            acc[key] = { productName: key, brands: {}, periodArrivalQuantity: 0, openingQuantity: 0, saleQuantity: 0, inHouseQuantity: 0 };
        }
        const normalizedBrand = (item.brand || 'No Brand').trim().toLowerCase();
        if (!acc[key].brands[normalizedBrand]) {
            acc[key].brands[normalizedBrand] = { brand: item.brand || 'No Brand', openingQuantity: 0, periodArrivalQuantity: 0, saleQuantity: 0, inHouseQuantity: 0 };
        }
        const brandObj = acc[key].brands[normalizedBrand];
        const qty = safeParse(item.inhouseQty || item.quantity);
        if (isBefore) {
            brandObj.openingQuantity += qty;
            acc[key].openingQuantity += qty;
        } else {
            brandObj.periodArrivalQuantity += qty;
            acc[key].periodArrivalQuantity += qty;
        }
        return acc;
    }, {});

    const displayRecords = Object.values(groupedStock).map(group => {
        const brandList = Object.values(group.brands).map(b => {
            const reportOpeningQty = b.openingQuantity + b.periodArrivalQuantity;
            const closingQuantity = reportOpeningQty - b.saleQuantity;
            return { ...b, openingQuantity: reportOpeningQty, inHouseQuantity: closingQuantity };
        }).filter(b => b.inHouseQuantity !== 0 || b.openingQuantity !== 0);
        return { ...group, brandList };
    }).filter(group => group.brandList.length > 0);

    return { displayRecords };
};

// --- DATA ---
const stockRecords = [
    {
        _id: 'stock1',
        productName: 'Chickpea',
        brand: 'Badsha',
        warehouse: 'Hili',
        quantity: 50000,
        packet: 1000,
        packetSize: 50,
        inhouseQty: 4000,
        inhousePkt: 80,
        date: '2026-04-10',
        unit: 'kg'
    }
];

const warehouseData = [
    {
        _id: 'wh1',
        product: 'Chickpea',
        brand: 'Badsha',
        whName: 'Bogura',
        warehouse: 'Hili', // This is the leftover field from the source
        whQty: 46000,
        whPkt: 920,
        recordType: 'warehouse',
        date: '2026-04-16T12:00:00Z',
        unit: 'kg',
        packetSize: 50
    }
];

const stockFilters = {
    warehouse: 'Bogura',
    startDate: '2026-04-16',
    endDate: '2026-04-16'
};

const results = calculateStockData(stockRecords, stockFilters, '', warehouseData, [], []);

console.log('Results Total Products:', results.displayRecords.length);
if (results.displayRecords.length > 0) {
    console.log('Product Name:', results.displayRecords[0].productName);
    console.log('Brand Count:', results.displayRecords[0].brandList.length);
    console.log('Opening Qty:', results.displayRecords[0].brandList[0].openingQuantity);
    console.log('InHouse Qty:', results.displayRecords[0].brandList[0].inHouseQuantity);
} else {
    console.log('NO RECORDS FOUND');
}
