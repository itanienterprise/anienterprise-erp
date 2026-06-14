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
        if (d && (d.brand || '').toUpperCase().includes('BADSAH')) {
            console.log("WH:", d);
        }
    });

    console.log("\n=== STOCK RECORDS ===");
    const st = await Stock.find({});
    st.forEach(s => {
        const d = decryptRecord(s);
        if (d && (d.brand || '').toUpperCase().includes('BADSAH')) {
            console.log("STOCK:", d);
        }
    });

    console.log("\n=== DAMAGE RECORDS ===");
    const dmg = await Damage.find({});
    dmg.forEach(d => {
        const dec = decryptRecord(d);
        if (dec && (dec.brand || '').toUpperCase().includes('BADSAH')) {
            console.log("DAMAGE:", dec);
        }
    });

    console.log("\n=== SALES RECORDS ===");
    const sl = await Sale.find({});
    sl.forEach(s => {
        const d = decryptRecord(s);
        if (d.items) {
            d.items.forEach(si => {
                if (si.brandEntries) {
                    si.brandEntries.forEach(be => {
                        if ((be.brand || '').toUpperCase().includes('BADSAH')) {
                            console.log("SALE ITEM:", s._id, s.invoiceNo, "brand:", be.brand, "qty:", be.quantity, "orig:", be.originalQuantity, "wh:", be.warehouseName);
                        }
                    });
                }
            });
        }
    });

    process.exit(0);
});
