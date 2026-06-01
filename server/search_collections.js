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

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const sales = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stocks = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouses = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));

    console.log("=== SEARCHING FOR 894 OR 882 OR 888 IN ALL DECRYPTED RECORDS ===");
    
    console.log("\n--- STOCKS ---");
    stocks.forEach(s => {
        const str = JSON.stringify(s);
        if (str.includes('894') || str.includes('882') || str.includes('888')) {
            console.log(`Stock ID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${s.brand} | Qty: ${s.quantity} | Pkt: ${s.packet}`);
        }
    });

    console.log("\n--- WAREHOUSES ---");
    warehouses.forEach(w => {
        const str = JSON.stringify(w);
        if (str.includes('894') || str.includes('882') || str.includes('888') || w.whQty === 6 || w.whPkt === 6 || w.inHousePacket === 6 || w.inHouseQuantity === 6) {
            console.log(`Wh ID: ${w._id} | Name: ${w.whName} | Prod: ${w.productName} | Brand: ${w.brand} | Qty: ${w.whQty} | Pkt: ${w.whPkt} | Location: ${w.location}`);
        }
    });

    console.log("\n--- SALES ---");
    sales.forEach(s => {
        const str = JSON.stringify(s);
        if (str.includes('894') || str.includes('882') || str.includes('888') || str.includes('returnQty') || str.includes('returnPkt')) {
            console.log(`Sale Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status}`);
            (s.items || []).forEach(item => {
                console.log(`  Item: ${item.productName}`);
                (item.brandEntries || []).forEach(be => {
                    console.log(`    Brand: ${be.brand} | Qty: ${be.quantity} | ReturnQty: ${be.returnQty} | ReturnPkt: ${be.returnPkt}`);
                });
            });
        }
    });

    process.exit(0);
});
