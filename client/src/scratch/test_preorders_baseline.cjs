async function testPreOrdersWithBaseline() {
    const { calculateStockData } = await import('../utils/stockHelpers.js');

    const mockProducts = [
        { name: 'CHICK PEAS', packetSize: 30, quality: 'Standard' }
    ];

    const mockActiveBaseline = {
        _id: 'baseline_active',
        status: 'active',
        baselineDate: '2026-08-30T00:16:00.000Z',
        snapshotRecords: [
            {
                warehouse: 'Main Warehouse',
                productName: 'CHICK PEAS',
                brand: 'BUT DAL',
                quality: 'Standard',
                packetSize: 30,
                inHouseQuantity: 50000,
                inHousePacket: 1666.66,
                quantity: 50000,
                packet: 1666.66,
                purchasedPrice: 100,
                unit: 'kg'
            }
        ]
    };

    // Pre-order placed BEFORE baseline date, but not yet fulfilled
    const mockSales = [
        {
            _id: 'order_1',
            invoiceNo: 'ORD-1001',
            orderNo: 'ORD-1001',
            saleType: 'order',
            status: 'Approved',
            date: '2026-08-25T10:00:00.000Z',
            createdAt: '2026-08-25T10:00:00.000Z',
            warehouse: 'Main Warehouse',
            items: [
                {
                    productName: 'CHICK PEAS',
                    quantity: 32000,
                    packet: 1066.66,
                    brandEntries: [
                        { brand: 'BUT DAL', quantity: 32000, packet: 1066.66, warehouseName: 'Main Warehouse' }
                    ]
                }
            ]
        }
    ];

    const res = calculateStockData([], { warehouse: 'All Warehouses' }, '', [], mockSales, mockProducts, [], mockActiveBaseline);
    const prod = res.displayRecords[0];
    const brand = prod.brandList[0];

    console.log('Product:', prod.productName);
    console.log('Brand:', brand.brand);
    console.log('In-House Qty:', brand.inHouseQuantity, '(expected 50000)');
    console.log('Order Qty:', brand.orderQuantity, '(expected 32000)');
    console.log('Saleable Qty:', brand.saleableQuantity, '(expected 18000)');

    if (brand.orderQuantity !== 32000) throw new Error('Order quantity mismatch');
    if (brand.saleableQuantity !== 18000) throw new Error('Saleable quantity mismatch');

    console.log('✅ PRE-ORDERS WITH BASELINE TEST PASSED PERFECTLY!');
}

testPreOrdersWithBaseline().catch(err => {
    console.error(err);
    process.exit(1);
});
