const { calculateStockData } = require('../client/src/utils/stockHelpers.js');
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
    const salesRecords = rawSales.map(decryptRecord);
    console.log(`rawSales: ${rawSales.length}, salesRecords: ${salesRecords.length}`);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    console.log(`rawStock: ${rawStock.length}, stockRecords: ${stockRecords.length}`);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    console.log(`rawWh: ${rawWh.length}, warehouseData: ${warehouseData.length}`);
    
    const rawProd = await Product.find({});
    const products = rawProd.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt.toISOString() }));

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(r => ({ ...decryptData(r.data), _id: r._id, createdAt: r.createdAt.toISOString() }));

    const resultNoFilter = calculateStockData(stockRecords, {}, '', warehouseData, salesRecords, products, damages);
    const resultFilterHili = calculateStockData(stockRecords, { warehouse: 'HILI' }, '', warehouseData, salesRecords, products, damages);
    
    console.log("=== UNFILTERED BRAN / KHESHARI VUSI ===");
    const branNoFilter = resultNoFilter.displayRecords.find(r => r.productName === 'BRAN');
    console.log("Group closing:", branNoFilter ? branNoFilter.closingQuantity : 'NOT FOUND');
    const brandNoFilter = branNoFilter?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    console.log(JSON.stringify(brandNoFilter, null, 2));

    console.log("\n=== FILTERED (HILI) BRAN / KHESHARI VUSI ===");
    const branFilterHili = resultFilterHili.displayRecords.find(r => r.productName === 'BRAN');
    console.log("Group closing:", branFilterHili ? branFilterHili.closingQuantity : 'NOT FOUND');
    const brandFilterHili = branFilterHili?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    console.log(JSON.stringify(brandFilterHili, null, 2));
    
    process.exit(0);
});
