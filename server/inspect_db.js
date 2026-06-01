const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Stock = require('./src/models/Stock');
const Warehouse = require('./src/models/Warehouse');
const Product = require('./src/models/Product');
const Damage = require('./src/models/Damage');
const { decryptData } = require('./src/utils/encryption');

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
    const sales = rawSales.map(decryptRecord);
    console.log("=== SALES ===");
    console.log(JSON.stringify(sales, null, 2));

    const rawStock = await Stock.find({});
    const stocks = rawStock.map(decryptRecord);
    console.log("=== STOCKS ===");
    console.log(JSON.stringify(stocks, null, 2));

    const rawWh = await Warehouse.find({});
    const warehouses = rawWh.map(decryptRecord);
    console.log("=== WAREHOUSES ===");
    console.log(JSON.stringify(warehouses, null, 2));

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);
    console.log("=== DAMAGES ===");
    console.log(JSON.stringify(damages, null, 2));

    process.exit(0);
});
