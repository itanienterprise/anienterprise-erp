const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Stock = require('./src/models/Stock');
const Warehouse = require('./src/models/Warehouse');
const Product = require('./src/models/Product');
const Damage = require('./src/models/Damage');
const { decryptData } = require('./src/utils/encryption');
const { calculateStockData } = require('../client/src/utils/stockHelpers.js');

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
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);
    
    const filtersNoWh = {
        startDate: '',
        endDate: '',
        warehouse: ''
    };
    
    const filtersBhomra = {
        startDate: '',
        endDate: '',
        warehouse: 'BHOMRA'
    };

    console.log("--- CALCULATING STOCK DATA (NO DATE, NO WAREHOUSE FILTER) ---");
    const resNoWh = calculateStockData(stockRecords, filtersNoWh, '', warehouseData, salesRecords, products, damages);
    const branNoWh = resNoWh.displayRecords.find(r => r.productName === 'BRAN');
    if (branNoWh) {
        branNoWh.brandList.forEach(b => {
            console.log(`Brand: ${b.brand} | Opening: ${b.openingQuantity} | Sale: ${b.saleQuantity} | Damage: ${b.damageQuantity} | Closing: ${b.closingQuantity}`);
        });
    }

    console.log("\n--- CALCULATING STOCK DATA (NO DATE, BHOMRA WAREHOUSE FILTER) ---");
    const resBhomra = calculateStockData(stockRecords, filtersBhomra, '', warehouseData, salesRecords, products, damages);
    const branBhomra = resBhomra.displayRecords.find(r => r.productName === 'BRAN');
    if (branBhomra) {
        branBhomra.brandList.forEach(b => {
            console.log(`Brand: ${b.brand} | Opening: ${b.openingQuantity} | Sale: ${b.saleQuantity} | Damage: ${b.damageQuantity} | Closing: ${b.closingQuantity}`);
        });
    }

    process.exit(0);
});
