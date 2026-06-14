const mongoose = require('mongoose');
const Warehouse = require('../src/models/Warehouse');
const Stock = require('../src/models/Stock');
const Sale = require('../src/models/Sale');
const Damage = require('../src/models/Damage');
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
    console.log("=== WAREHOUSE RECORDS ===");
    const wh = await Warehouse.find({});
    wh.forEach(w => {
        const d = decryptRecord(w);
        if (d && ((d.brand || '').toUpperCase().includes('MAIZE') || (d.productName || '').toUpperCase().includes('MAIZE') || (d.product || '').toUpperCase().includes('MAIZE'))) {
            console.log("WH:", d);
        }
    });

    console.log("\n=== STOCK RECORDS ===");
    const st = await Stock.find({});
    st.forEach(s => {
        const d = decryptRecord(s);
        if (d && ((d.brand || '').toUpperCase().includes('MAIZE') || (d.productName || '').toUpperCase().includes('MAIZE') || (d.product || '').toUpperCase().includes('MAIZE'))) {
            console.log("STOCK:", d);
        }
    });

    console.log("\n=== DAMAGE RECORDS ===");
    const dmg = await Damage.find({});
    dmg.forEach(d => {
        const dec = decryptRecord(d);
        if (dec && ((dec.brand || '').toUpperCase().includes('MAIZE') || (dec.productName || '').toUpperCase().includes('MAIZE') || (dec.product || '').toUpperCase().includes('MAIZE'))) {
            console.log("DAMAGE:", dec);
        }
    });

    console.log("\n=== SALES RECORDS ===");
    const sl = await Sale.find({});
    sl.forEach(s => {
        const d = decryptRecord(s);
        if (d.items) {
            d.items.forEach(si => {
                const prodName = (si.productName || '').trim().toUpperCase();
                if (prodName.includes('MAIZE')) {
                    console.log("SALE ITEM:", s._id, s.invoiceNo, "status:", s.status, "prod:", si.productName, "brandEntries:", si.brandEntries);
                }
            });
        }
    });

    process.exit(0);
});
