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
    
    console.log("=== ALL STOCKS ===");
    stockRecords.forEach(s => {
        console.log(`LC: ${s.lcNo} | Product: ${s.productName} | Brand: ${s.brand} | Wh: ${s.warehouse} | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity} | InHousePkt: ${s.inHousePacket}`);
    });

    console.log("\n=== ALL WAREHOUSES ===");
    warehouseData.forEach(w => {
        console.log(`Name: ${w.whName} | Loc: ${w.location} | Prod: ${w.productName} | Brand: ${w.brand} | Qty: ${w.whQty} | Pkt: ${w.whPkt}`);
    });

    console.log("\n=== ALL SALES ===");
    salesRecords.forEach(s => {
        console.log(`Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status}`);
        (s.items || []).forEach(item => {
            console.log(`  Product: ${item.productName}`);
            (item.brandEntries || []).forEach(be => {
                console.log(`    Brand: ${be.brand} | Wh: ${be.warehouseName} | Qty: ${be.quantity} | Packet: ${be.packet} | OriginalQty: ${be.originalQuantity} | ReturnQty: ${be.returnQty} | ReturnPkt: ${be.returnPkt}`);
            });
        });
    });

    console.log("\n=== ALL DAMAGES ===");
    damages.forEach(d => {
        console.log(`Date: ${d.date} | Product: ${d.productName} | Brand: ${d.brand} | Wh: ${d.warehouse} | Qty: ${d.quantity}`);
    });

    const resNoWh = calculateStockData(stockRecords, { warehouse: '' }, '', warehouseData, salesRecords, products, damages);
    const prodNoWh = resNoWh.displayRecords.find(r => r.productName === 'BRAN');
    const brandNoWh = prodNoWh?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    console.log("\n=== UNFILTERED BRAN/KHESHARI VUSI ===");
    console.log(JSON.stringify(brandNoWh, null, 2));

    const resBhomra = calculateStockData(stockRecords, { warehouse: 'BHOMRA' }, '', warehouseData, salesRecords, products, damages);
    const prodBhomra = resBhomra.displayRecords.find(r => r.productName === 'BRAN');
    const brandBhomra = prodBhomra?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    console.log("\n=== FILTERED (BHOMRA) BRAN/KHESHARI VUSI ===");
    console.log(JSON.stringify(brandBhomra, null, 2));

    const resHili = calculateStockData(stockRecords, { warehouse: 'HILI' }, '', warehouseData, salesRecords, products, damages);
    const prodHili = resHili.displayRecords.find(r => r.productName === 'BRAN');
    const brandHili = prodHili?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    console.log("\n=== FILTERED (HILI) BRAN/KHESHARI VUSI ===");
    console.log(JSON.stringify(brandHili, null, 2));

    process.exit(0);
});
