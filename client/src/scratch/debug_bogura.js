import { calculateStockData } from '../utils/stockHelpers.js';

const mockStock = [
    {
        _id: 'stock1',
        productName: 'Chickpea',
        brand: 'Badsha',
        brandEntries: [
            { brand: 'Badsha', quantity: 1000, packet: 1000, packetSize: 30, inHouseQuantity: 80, inHousePacket: 80 }
        ],
        date: '2026-04-16T10:00:00Z',
        whName: 'Hili'
    }
];

const mockWarehouse = [
    {
        _id: 'wh1',
        productName: 'Chickpea',
        brand: 'Badsha',
        whQty: 920,
        whPkt: 920,
        packetSize: 30,
        whName: 'Bogura',
        date: '2026-04-16T11:00:00Z',
        recordType: 'warehouse'
    }
];

const filtersBogura = { warehouse: 'Bogura' };

console.log('--- DEBUG BOGURA ---');
const dataBogura = calculateStockData(mockStock, filtersBogura, '', mockWarehouse, [], []);
dataBogura.displayRecords.forEach(r => {
    console.log(`Product: ${r.productName}`);
    r.brandList.forEach(b => {
        console.log(`  Brand: ${b.brand}`);
        console.log(`    Opening: ${b.openingQuantity}`);
        console.log(`    Closing: ${b.closingQuantity}`);
    });
});
