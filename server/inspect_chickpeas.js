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

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    console.log("=== CHICK PEAS BADSAH RECORDS ===");
    stocks.forEach(s => {
        const prod = (s.productName || s.product || '').toUpperCase();
        if (prod.includes('CHICK')) {
            console.log(`Stock ID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${s.brand} | Qty: ${s.quantity} | Pkt: ${s.packet} | PktSize: ${s.packetSize} | BrandEntries:`, s.brandEntries);
        }
    });

    console.log("\n=== WAREHOUSE RECORDS ===");
    warehouses.forEach(w => {
        const prod = (w.productName || w.product || '').toUpperCase();
        if (prod.includes('CHICK')) {
            console.log(`Wh ID: ${w._id} | Name: ${w.whName} | Prod: ${w.productName} | Brand: ${w.brand} | Qty: ${w.whQty} | Pkt: ${w.whPkt} | Location: ${w.location}`);
        }
    });

    console.log("\n=== SALES RECORDS ===");
    sales.forEach(s => {
        let matches = false;
        (s.items || []).forEach(item => {
            if ((item.productName || '').toUpperCase().includes('CHICK')) {
                matches = true;
            }
        });
        if (matches) {
            console.log(`Sale Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status}`);
            (s.items || []).forEach(item => {
                console.log(`  Item: ${item.productName}`);
                (item.brandEntries || []).forEach(be => {
                    console.log(`    Brand: ${be.brand} | Qty: ${be.quantity} | Pkt: ${be.packet} | ReturnQty: ${be.returnQty} | ReturnPkt: ${be.returnPkt}`);
                });
            });
        }
    });

    console.log("\n=== DAMAGES RECORDS ===");
    damages.forEach(d => {
        const prod = (d.productName || d.product || '').toUpperCase();
        if (prod.includes('CHICK')) {
            console.log(`Damage ID: ${d._id} | Prod: ${d.productName} | Brand: ${d.brand} | Qty: ${d.quantity} | Pkt: ${d.packet}`);
        }
    });

    process.exit(0);
});
