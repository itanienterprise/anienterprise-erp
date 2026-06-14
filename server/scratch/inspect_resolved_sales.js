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

    const filters = { warehouse: 'all warehouses', startDate: '', endDate: '' };
    const res = calculateStockData(stockRecords, filters, '', warehouseData, salesRecords, products, damages);

    console.log("=== CALCULATE STOCK DATA SUMMARY ===");
    console.log("totalQuantity:", res.totalQuantity);
    console.log("totalSaleQty:", res.totalSaleQty);
    console.log("totalInHouseQty:", res.totalInHouseQty);

    console.log("\n=== DISPLAY RECORDS ===");
    res.displayRecords.forEach(g => {
        console.log(`Product: ${g.productName} | Sale Qty: ${g.saleQuantity} | InHouse Qty: ${g.inHouseQuantity}`);
        g.brandList.forEach(b => {
            console.log(`  Brand: ${b.brand} | Quality: ${b.quality} | Sale Qty: ${b.saleQuantity} | InHouse Qty: ${b.inHouseQuantity}`);
        });
    });

    process.exit(0);
});
