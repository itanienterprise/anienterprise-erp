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
    
    console.log("=== WAREHOUSE RECORDS ===");
    warehouseData.forEach(w => {
        if ((w.location || '').toLowerCase().includes('return') || (w.productName || '').includes('MOSUR') || (w.brand || '').includes('G D P')) {
            console.log(`ID: ${w._id} | Name: ${w.whName} | Location: ${w.location} | Prod: ${w.productName} | Brand: ${w.brand} | Qty: ${w.whQty} | Pkt: ${w.whPkt} | Status: ${w.status}`);
        }
    });

    console.log("\n=== SALES RECORDS ===");
    salesRecords.forEach(s => {
        let hasMatch = false;
        (s.items || []).forEach(item => {
            if ((item.productName || '').includes('MOSUR')) {
                (item.brandEntries || []).forEach(be => {
                    if ((be.brand || '').includes('G D P')) {
                        hasMatch = true;
                    }
                });
            }
        });
        if (hasMatch) {
            console.log(`Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status}`);
            (s.items || []).forEach(item => {
                console.log(`  Item: ${item.productName}`);
                (item.brandEntries || []).forEach(be => {
                    console.log(`    Brand: ${be.brand} | Wh: ${be.warehouseName} | Qty: ${be.quantity} | ReturnQty: ${be.returnQty} | ReturnPkt: ${be.returnPkt}`);
                });
            });
        }
    });

    const resNoWh = calculateStockData(stockRecords, { warehouse: '' }, '', warehouseData, salesRecords, products, damages);
    
    const warehouses = ['BHOMRA', 'BOGURA', 'HILI', 'Hilli', 'Bogura'];
    
    console.log("\n=== INDIVIDUAL WAREHOUSE FILTERS FOR GDP MOSUR DAL ===");
    console.log(`Unfiltered: Qty=${resNoWh.displayRecords.find(r => r.productName === 'MOSUR DAL')?.brandList.find(b => b.brand === 'G D P MOSUR DAL')?.closingQuantity}`);
    
    warehouses.forEach(wh => {
        const res = calculateStockData(stockRecords, { warehouse: wh }, '', warehouseData, salesRecords, products, damages);
        const prod = res.displayRecords.find(r => r.productName === 'MOSUR DAL');
        const brand = prod?.brandList.find(b => b.brand === 'G D P MOSUR DAL');
        console.log(`Filter: ${wh} | Qty=${brand ? brand.closingQuantity : 'NOT FOUND'} | Opening=${brand ? brand.openingQuantity : '-'} | Sale=${brand ? brand.saleQuantity : '-'} | PeriodArrival=${brand ? brand.periodArrivalQuantity : '-'}`);
    });

    process.exit(0);
});
