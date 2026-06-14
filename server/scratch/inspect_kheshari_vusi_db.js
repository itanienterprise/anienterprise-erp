const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const Return = require('../src/models/Return');
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
    console.log("=== SEARCHING KHESHARI VUSI ===");
    
    // 1. Warehouse
    const rawWh = await Warehouse.find({});
    const whRecords = rawWh.map(decryptRecord);
    console.log("\n--- Warehouse Records ---");
    whRecords.forEach(w => {
        const brand = (w.brand || w.brandName || '').toUpperCase();
        if (brand.includes('KHESHARI') || brand.includes('VUSI')) {
            console.log(JSON.stringify(w, null, 2));
        }
    });

    // 2. Stock
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    console.log("\n--- Stock Records ---");
    stockRecords.forEach(s => {
        const brand = (s.brand || '').toUpperCase();
        if (brand.includes('KHESHARI') || brand.includes('VUSI')) {
            console.log(JSON.stringify(s, null, 2));
        }
    });

    // 3. Damage
    const rawDamage = await Damage.find({});
    const damageRecords = rawDamage.map(decryptRecord);
    console.log("\n--- Damage Records ---");
    damageRecords.forEach(d => {
        const brand = (d.brand || '').toUpperCase();
        if (brand.includes('KHESHARI') || brand.includes('VUSI')) {
            console.log(JSON.stringify(d, null, 2));
        }
    });

    // 4. Return
    const rawReturn = await Return.find({});
    const returnRecords = rawReturn.map(decryptRecord);
    console.log("\n--- Return Records ---");
    returnRecords.forEach(r => {
        const brand = (r.brand || r.brandName || '').toUpperCase();
        if (brand.includes('KHESHARI') || brand.includes('VUSI')) {
            console.log(JSON.stringify(r, null, 2));
        }
    });

    // 5. Sales
    const rawSale = await Sale.find({});
    const saleRecords = rawSale.map(decryptRecord);
    console.log("\n--- Sale Records ---");
    saleRecords.forEach(s => {
        let matched = false;
        (s.items || []).forEach(item => {
            (item.brandEntries || []).forEach(be => {
                const brand = (be.brand || '').toUpperCase();
                if (brand.includes('KHESHARI') || brand.includes('VUSI')) {
                    matched = true;
                }
            });
        });
        if (matched) {
            console.log(`Sale Invoice: ${s.invoiceNo} | Date: ${s.date} | Status: ${s.status}`);
            (s.items || []).forEach(item => {
                (item.brandEntries || []).forEach(be => {
                    if ((be.brand || '').toUpperCase().includes('KHESHARI') || (be.brand || '').toUpperCase().includes('VUSI')) {
                        console.log(`  Brand: ${be.brand} | Wh: ${be.warehouseName} | Qty: ${be.quantity} | Pkt: ${be.packet}`);
                    }
                });
            });
        }
    });

    process.exit(0);
});
