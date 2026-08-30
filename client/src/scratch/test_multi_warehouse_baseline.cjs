async function runMultiWarehouseTests() {
    const { calculateStockData } = await import('../utils/stockHelpers.js');

    const mockProducts = [
        { name: 'Sugar', packetSize: 50, quality: 'Grade A' }
    ];

    const mockStockRecords = [];
    const mockWarehouseData = [];
    const mockSales = [];

    // Active baseline with 2 warehouses
    const mockActiveBaseline = {
        _id: 'baseline_1',
        status: 'active',
        baselineDate: '2026-08-20T00:00:00.000Z',
        note: 'Multi Warehouse Rollover',
        snapshotRecords: [
            {
                warehouse: 'Dhaka Main',
                productName: 'Sugar',
                brand: 'Fresh',
                quality: 'Grade A',
                packetSize: 50,
                inHouseQuantity: 6000,
                inHousePacket: 120,
                purchasedPrice: 120,
                unit: 'kg'
            },
            {
                warehouse: 'Chittagong Port',
                productName: 'Sugar',
                brand: 'Fresh',
                quality: 'Grade A',
                packetSize: 50,
                inHouseQuantity: 4000,
                inHousePacket: 80,
                purchasedPrice: 120,
                unit: 'kg'
            }
        ]
    };

    // Test multi-warehouse combined rollup
    const globalRes = calculateStockData(
        mockStockRecords,
        { warehouse: 'All Warehouses' },
        '',
        mockWarehouseData,
        mockSales,
        mockProducts,
        [],
        mockActiveBaseline
    );

    console.log('Global Total Opening Qty:', globalRes.totalQuantity, '(expected 10000)');
    console.log('Global Total In-House Qty:', globalRes.totalInHouseQty, '(expected 10000)');
    console.log('Global Total In-House Bags:', globalRes.totalInHousePktWhole, '(expected 200)');

    if (globalRes.totalQuantity !== 10000 || globalRes.totalInHouseQty !== 10000 || globalRes.totalInHousePktWhole !== 200) {
        throw new Error('Multi-warehouse test failed!');
    }

    console.log('✅ Multi-warehouse baseline rollup test PASSED PERFECTLY!');
}

runMultiWarehouseTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
