import { calculateStockData } from '../utils/stockHelpers.js';

const mockStock = [
    {
        _id: 'stock1',
        productName: 'Chickpea',
        brand: 'Badsha',
        brandEntries: [
            { brand: 'Badsha', quantity: 1000, packet: 1000, packetSize: 30, inHouseQuantity: 970, inHousePacket: 970 }
        ],
        date: '2026-04-16T10:00:00Z',
        whName: 'Hili'
    }
];

const mockSales = [
    {
        _id: 'sale1',
        status: 'accepted',
        date: '2026-04-16T15:00:00Z',
        items: [
            {
                productName: 'Chickpea',
                brandEntries: [
                    { brand: 'Badsha', quantity: 30, packet: 30, warehouseName: 'Hili' }
                ]
            }
        ]
    }
];

const globalFilters = {};

console.log('--- GLOBAL VIEW WITH SALES ---');
const dataGlobal = calculateStockData(mockStock, globalFilters, '', [], mockSales, []);
dataGlobal.displayRecords.forEach(r => {
    console.log(`Product: ${r.productName}`);
    r.brandList.forEach(b => {
        console.log(`  Brand: ${b.brand} | Opening: ${b.openingQuantity} | Sale: ${b.saleQuantity} | Closing: ${b.closingQuantity}`);
    });
});

console.log('Summary Cards:');
console.log(`  Total Arrival: ${dataGlobal.totalQuantity}`);
console.log(`  Total Sale: ${dataGlobal.totalSaleQty}`);
console.log(`  Total Inhouse: ${dataGlobal.totalInHouseQty}`);
