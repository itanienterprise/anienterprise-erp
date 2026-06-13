const mongoose = require('mongoose');
const Stock = require('../src/models/Stock');
const Product = require('../src/models/Product');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    console.log("=== STOCK RECORDS MATCHING KHESHARI OR VUSI ===");
    stockRecords.forEach(s => {
        const pName = (s.productName || s.product || '').toUpperCase();
        const brand = (s.brand || '').toUpperCase();
        if (pName.includes('KHESHARI') || pName.includes('VUSI') || brand.includes('KHESHARI') || brand.includes('VUSI')) {
            console.log(`StockID: ${s._id} | LC: ${s.lcNo} | Prod: ${s.productName} | Brand: ${s.brand} | Wh: ${s.warehouse || s.whName} | Qty: ${s.quantity} | InHouseQty: ${s.inHouseQuantity}`);
            if (s.brandEntries) console.log(`  brandEntries:`, JSON.stringify(s.brandEntries));
        }
    });

    console.log("\n=== ALL UNIQUE PRODUCTS AND BRANDS IN STOCK ===");
    const uniqueMap = {};
    stockRecords.forEach(s => {
        const prod = s.productName || s.product || 'Unknown';
        if (!uniqueMap[prod]) uniqueMap[prod] = new Set();
        if (s.brand) uniqueMap[prod].add(s.brand);
        if (s.brandEntries) {
            s.brandEntries.forEach(be => {
                if (be.brand) uniqueMap[prod].add(be.brand);
            });
        }
    });
    for (const [prod, brands] of Object.entries(uniqueMap)) {
        console.log(`Product: ${prod} | Brands: ${Array.from(brands).join(', ')}`);
    }

    process.exit(0);
});
