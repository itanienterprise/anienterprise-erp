async function testTransferPostBaseline() {
    const { calculateStockData } = await import('../utils/stockHelpers.js');

    const mockProducts = [
        { name: 'CHICK PEAS', packetSize: 30, quality: 'Standard' }
    ];

    const baselineDate = '2026-08-30T00:16:00.000Z';
    const mockActiveBaseline = {
        _id: 'baseline_active',
        status: 'active',
        baselineDate: baselineDate,
        note: 'Initial Stock Baseline',
        snapshotRecords: [
            {
                warehouse: 'Main Warehouse',
                productName: 'CHICK PEAS',
                brand: 'D M',
                quality: 'Standard',
                packetSize: 30,
                inHouseQuantity: 26949,
                inHousePacket: 898.3,
                quantity: 26949,
                packet: 898.3,
                purchasedPrice: 100,
                unit: 'kg'
            }
        ]
    };

    const mockTransferLogs = [
        {
            _id: 'transfer_1',
            isTransferLog: true,
            status: 'Approved',
            date: '2026-08-30T00:20:00.000Z',
            createdAt: '2026-08-30T00:20:00.000Z',
            fromWh: 'Main Warehouse',
            toWh: 'Sub Warehouse',
            productName: 'CHICK PEAS',
            brand: 'D M',
            quality: 'Standard',
            packetSize: 30,
            transferQty: 5000,
            transferPkt: 166.66,
            whQty: 5000,
            whPkt: 166.66,
            unit: 'kg'
        }
    ];

    // Check Global Total
    const globalStock = calculateStockData([], { warehouse: 'All Warehouses' }, '', mockTransferLogs, [], mockProducts, [], mockActiveBaseline);
    console.log('\nGlobal Display Records:', JSON.stringify(globalStock.displayRecords, null, 2));
    console.log('Global In-House Qty:', globalStock.totalInHouseQty, '(expected 26949)');

    const sourceWhStock = calculateStockData([], { warehouse: 'Main Warehouse' }, '', mockTransferLogs, [], mockProducts, [], mockActiveBaseline);
    console.log('Main Wh In-House Qty:', sourceWhStock.displayRecords[0].brandList[0].inHouseQuantity);

    const destWhStock = calculateStockData([], { warehouse: 'Sub Warehouse' }, '', mockTransferLogs, [], mockProducts, [], mockActiveBaseline);
    console.log('Sub Wh In-House Qty:', destWhStock.displayRecords[0].brandList[0].inHouseQuantity);
}

testTransferPostBaseline().catch(err => {
    console.error(err);
    process.exit(1);
});
