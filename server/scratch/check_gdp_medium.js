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
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    console.log("=== BRAND KING CALCULATIONS ===");
    const resNoWh = calculateStockData(stockRecords, { warehouse: '' }, '', warehouseData, salesRecords, products, damages);
    const prodNoWh = resNoWh.displayRecords.find(r => r.productName === 'BRAN');
    const brandNoWh = prodNoWh?.brandList.find(b => b.brand.trim() === 'BRAND KING');
    console.log(`Unfiltered: Qty=${brandNoWh ? brandNoWh.closingQuantity : 'NOT FOUND'} | Opening=${brandNoWh ? brandNoWh.openingQuantity : '-'} | Sale=${brandNoWh ? brandNoWh.saleQuantity : '-'} | Damage=${brandNoWh ? brandNoWh.damageQuantity : '-'} | Arrival=${brandNoWh ? brandNoWh.periodArrivalQuantity : '-'}`);

    const warehouses = ['BHOMRA', 'BOGURA', 'HILI'];
    warehouses.forEach(wh => {
        const res = calculateStockData(stockRecords, { warehouse: wh }, '', warehouseData, salesRecords, products, damages);
        const prod = res.displayRecords.find(r => r.productName === 'BRAN');
        const brand = prod?.brandList.find(b => b.brand.trim() === 'BRAND KING');
        console.log(`Filter: ${wh} | Qty=${brand ? brand.closingQuantity : 'NOT FOUND'} | Opening=${brand ? brand.openingQuantity : '-'} | Sale=${brand ? brand.saleQuantity : '-'} | Damage=${brand ? brand.damageQuantity : '-'} | Arrival=${brand ? brand.periodArrivalQuantity : '-'}`);
    });

    process.exit(0);
});
