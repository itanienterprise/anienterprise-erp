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

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' })).filter(w => w.location !== 'Inventory Adjustment');
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    console.log('=== BRAND KING CALCULATIONS WITHOUT ADJUSTMENTS ===');
    const resNoWh = calculateStockData(stockRecords, { warehouse: '' }, '', warehouseData, salesRecords, products, damages);
    
    console.log('Display records:');
    resNoWh.displayRecords.forEach(r => {
        console.log(`Product: '${r.productName}'`);
        r.brandList.forEach(b => {
            console.log(`  -> Brand: '${b.brand}' | Closing Qty: ${b.closingQuantity} | Sale Qty: ${b.saleQuantity} | Opening: ${b.openingQuantity}`);
        });
    });

    process.exit(0);
});
