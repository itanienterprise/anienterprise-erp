const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
const Stock = require('./src/models/Stock');
const Warehouse = require('./src/models/Warehouse');
const Product = require('./src/models/Product');
const Damage = require('./src/models/Damage');
const { encryptData } = require('./src/utils/encryption');
const { calculateStockData } = require('../client/src/utils/stockHelpers.js');

function decryptRecord(r) {
    if (!r) return null;
    const { decryptData } = require('./src/utils/encryption');
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    // Let's clear the Warehouse collection and rebuild it to match the BHOMRA transfer scenario
    await Warehouse.deleteMany({});
    await Damage.deleteMany({});

    // 1. Create BHOMRA transfer record
    // In actual app, a transfer creates a Warehouse record with whName: "BHOMRA" (destination)
    const transferData = {
        whName: "BHOMRA",
        productName: "BRAN",
        brand: "KHESHARI VUSI",
        whQty: 22200,
        whPkt: 888,
        inHouseQuantity: 22200,
        inHousePacket: 888,
        status: "Active",
        manager: "XYZ",
        location: "BHOMRA",
        packetSize: 25,
        recordType: "warehouse",
        date: "2026-06-01"
    };
    await new Warehouse({ data: encryptData(transferData) }).save();

    // 2. Create Returned Stock record in BHOMRA (since they returned it to BHOMRA)
    const returnWhData = {
        whName: "BHOMRA",
        productName: "BRAN",
        brand: "KHESHARI VUSI",
        whQty: 150,
        whPkt: 6,
        inHouseQuantity: 150,
        inHousePacket: 6,
        status: "Active",
        manager: "-",
        location: "Returned Stock",
        packetSize: 25,
        recordType: "warehouse",
        date: "2026-06-01"
    };
    await new Warehouse({ data: encryptData(returnWhData) }).save();

    // 3. Create Damage record in BHOMRA
    const damageData = {
        date: "2026-06-01",
        productName: "BRAN",
        brand: "KHESHARI VUSI",
        warehouse: "BHOMRA",
        price: "",
        quantity: "150",
        reason: "Damaged",
        remarks: ""
    };
    await new Damage({ data: encryptData(damageData) }).save();

    // Now reload database
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

    console.log("=== RUNNING CALCULATE STOCK DATA ===");
    const resBhomra = calculateStockData(stockRecords, { warehouse: 'BHOMRA' }, '', warehouseData, salesRecords, products, damages);
    const prodBhomra = resBhomra.displayRecords.find(r => r.productName === 'BRAN');
    const brandBhomra = prodBhomra?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    
    console.log("BHOMRA Filter Result:");
    console.log(JSON.stringify(brandBhomra, null, 2));

    const resUnfiltered = calculateStockData(stockRecords, { warehouse: '' }, '', warehouseData, salesRecords, products, damages);
    const prodUnfiltered = resUnfiltered.displayRecords.find(r => r.productName === 'BRAN');
    const brandUnfiltered = prodUnfiltered?.brandList.find(b => b.brand === 'KHESHARI VUSI');
    
    console.log("\nUnfiltered Result:");
    console.log(JSON.stringify(brandUnfiltered, null, 2));

    process.exit(0);
});
