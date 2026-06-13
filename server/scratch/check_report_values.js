const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData } = require('../src/utils/encryption');
const { calculateStockData } = require('../../client/src/utils/stockHelpers.js');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    const warehouses = ['HILI', 'BOGURA', 'BHOMRA'];

    console.log("=== CLOSING STOCKS ON 2026-06-11 ===");
    
    warehouses.forEach(wh => {
        console.log(`\n--- Warehouse: ${wh} ---`);
        const res = calculateStockData(stockRecords, { warehouse: wh, startDate: '2026-06-11', endDate: '2026-06-11' }, '', warehouseData, salesRecords, products, damages);
        res.displayRecords.forEach(group => {
            group.brandList.forEach(b => {
                console.log(`Product: ${group.productName.padEnd(15)} | Brand: ${b.brand.padEnd(20)} | closingQty: ${b.closingQuantity.toString().padStart(8)} | closingPkt: ${b.closingPacket.toFixed(2).padStart(8)}`);
            });
        });
    });

    process.exit(0);
});
