const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);
    const cp = products.find(p => p.name === 'CHICK PEAS' || p.productName === 'CHICK PEAS');
    console.log("=== PRODUCT CHICK PEAS ===");
    console.log(JSON.stringify(cp, null, 2));

    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord).filter(s => s.productName === 'CHICK PEAS' || s.product === 'CHICK PEAS');
    console.log(`=== STOCK RECORDS (${stockRecords.length}) ===`);
    stockRecords.forEach((s, idx) => {
        console.log(`\n--- Stock Record ${idx + 1} ---`);
        console.log(JSON.stringify(s, null, 2));
    });

    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord).filter(sale => {
        return (sale.items || []).some(si => si.productName === 'CHICK PEAS' || si.product === 'CHICK PEAS');
    });

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord).filter(d => d.productName === 'CHICK PEAS' || d.product === 'CHICK PEAS');

    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(decryptRecord).filter(w => w.productName === 'CHICK PEAS' || w.product === 'CHICK PEAS');
    console.log(`=== WAREHOUSE RECORDS (${warehouseData.length}) ===`);
    warehouseData.forEach((w, idx) => {
        console.log(`\n--- Warehouse Record ${idx + 1} ---`);
        console.log(JSON.stringify(w, null, 2));
    });

    process.exit(0);
});
