async function runTests() {
    const { calculateStockData } = await import('../utils/stockHelpers.js');

    // Mock data
    const mockProducts = [
        { name: 'Sugar', packetSize: 50, quality: 'Grade A' }
    ];

    const mockStockRecords = [
        {
            _id: 'stock_1',
            date: '2026-08-01T10:00:00.000Z',
            createdAt: '2026-08-01T10:00:00.000Z',
            productName: 'Sugar',
            brand: 'Fresh',
            quality: 'Grade A',
            warehouse: 'Dhaka Main',
            quantity: 10000,
            packet: 200,
            inHouseQuantity: 10000,
            inHousePacket: 200,
            packetSize: 50,
            purchasedPrice: 120,
            unit: 'kg'
        }
    ];

    const mockWarehouseData = [];

    // Sale 1 happened BEFORE baseline (Aug 15)
    const mockSalesBefore = [
        {
            _id: 'sale_1',
            date: '2026-08-15T12:00:00.000Z',
            createdAt: '2026-08-15T12:00:00.000Z',
            status: 'completed',
            saleType: 'general',
            warehouse: 'Dhaka Main',
            items: [
                {
                    productName: 'Sugar',
                    quantity: 4000,
                    packet: 80,
                    brandEntries: [{ brand: 'Fresh', quantity: 4000, packet: 80, warehouseName: 'Dhaka Main' }]
                }
            ]
        }
    ];

    // Test 1: Historical stock calculation before baseline
    console.log('--- Test 1: Historical Stock (Pre-Baseline) ---');
    const historicalRes = calculateStockData(
        mockStockRecords,
        { warehouse: 'Dhaka Main' },
        '',
        mockWarehouseData,
        mockSalesBefore,
        mockProducts,
        [],
        null
    );
    const brand1 = historicalRes.displayRecords[0].brandList[0];
    console.log('Opening Qty:', brand1.openingQuantity, '(expected 10000)');
    console.log('Sale Qty:', brand1.saleQuantity, '(expected 4000)');
    console.log('In-House Qty:', brand1.inHouseQuantity, '(expected 6000)');
    if (brand1.openingQuantity !== 10000 || brand1.saleQuantity !== 4000 || brand1.inHouseQuantity !== 6000) {
        throw new Error('Test 1 failed!');
    }

    // Test 2: Active Baseline established at Aug 20 with in-house stock = 6,000 kg (120 bags)
    console.log('\n--- Test 2: Active Baseline (Starting Day 1 Initial Stage) ---');
    const mockActiveBaseline = {
        _id: 'baseline_1',
        status: 'active',
        baselineDate: '2026-08-20T00:00:00.000Z',
        note: 'Fiscal Rollover',
        setBy: 'Admin',
        snapshotRecords: [
            {
                warehouse: 'Dhaka Main',
                productName: 'Sugar',
                brand: 'Fresh',
                quality: 'Grade A',
                packetSize: 50,
                inHouseQuantity: 6000,
                inHousePacket: 120,
                quantity: 6000,
                packet: 120,
                purchasedPrice: 120,
                unit: 'kg'
            }
        ]
    };

    const baselineRes = calculateStockData(
        mockStockRecords,
        { warehouse: 'Dhaka Main' },
        '',
        mockWarehouseData,
        mockSalesBefore,
        mockProducts,
        [],
        mockActiveBaseline
    );
    const brand2 = baselineRes.displayRecords[0].brandList[0];
    console.log('Opening Qty:', brand2.openingQuantity, '(expected 6000)');
    console.log('Sale Qty:', brand2.saleQuantity, '(expected 0)');
    console.log('In-House Qty:', brand2.inHouseQuantity, '(expected 6000)');
    if (brand2.openingQuantity !== 6000 || brand2.saleQuantity !== 0 || brand2.inHouseQuantity !== 6000) {
        throw new Error('Test 2 failed!');
    }

    // Test 3: New Sale AFTER baseline (Aug 25)
    console.log('\n--- Test 3: New Sale Post-Baseline ---');
    const mockSalesAfter = [
        ...mockSalesBefore,
        {
            _id: 'sale_2',
            date: '2026-08-25T14:00:00.000Z',
            createdAt: '2026-08-25T14:00:00.000Z',
            status: 'completed',
            saleType: 'general',
            warehouse: 'Dhaka Main',
            items: [
                {
                    productName: 'Sugar',
                    quantity: 1000,
                    packet: 20,
                    brandEntries: [{ brand: 'Fresh', quantity: 1000, packet: 20, warehouseName: 'Dhaka Main' }]
                }
            ]
        }
    ];

    const postBaselineRes = calculateStockData(
        mockStockRecords,
        { warehouse: 'Dhaka Main' },
        '',
        mockWarehouseData,
        mockSalesAfter,
        mockProducts,
        [],
        mockActiveBaseline
    );
    const brand3 = postBaselineRes.displayRecords[0].brandList[0];
    console.log('Opening Qty:', brand3.openingQuantity, '(expected 6000)');
    console.log('Sale Qty:', brand3.saleQuantity, '(expected 1000)');
    console.log('In-House Qty:', brand3.inHouseQuantity, '(expected 5000)');
    if (brand3.openingQuantity !== 6000 || brand3.saleQuantity !== 1000 || brand3.inHouseQuantity !== 5000) {
        throw new Error('Test 3 failed!');
    }

    console.log('\n✅ ALL BASELINE STOCK CALCULATION TESTS PASSED PERFECTLY!');
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
