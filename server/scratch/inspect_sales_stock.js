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

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
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

    console.log("=== INSPECTING SALES RECORDS WITH DIFFERENT ORIGINAL QUANTITIES ===");
    salesRecords.forEach(sale => {
        let hasDiff = false;
        const details = [];
        (sale.items || []).forEach(si => {
            (si.brandEntries || []).forEach(be => {
                const q = be.quantity || 0;
                const oq = be.originalQuantity || q;
                if (q !== oq) {
                    hasDiff = true;
                    details.push({
                        product: si.productName,
                        brand: be.brand,
                        wh: be.warehouseName || si.whName,
                        quantity: q,
                        originalQuantity: oq,
                        diff: oq - q
                    });
                }
            });
        });
        if (hasDiff) {
            console.log(`Sale ID: ${sale._id} | Date: ${sale.date} | Status: ${sale.status}`);
            console.log("Details:", details);
        }
    });

    console.log("\n=== INSPECTING WAREHOUSE RETURNED STOCK RECORDS ===");
    const returnedWh = warehouseData.filter(w => (w.location || '').toLowerCase().trim() === 'returned stock' || (w.whName || '').toLowerCase().trim() === 'returned stock');
    console.log(`Found ${returnedWh.length} Returned Stock warehouse records:`);
    returnedWh.forEach(w => {
        console.log(`WH Name: ${w.whName} | Location: ${w.location} | Prod: ${w.productName} | Brand: ${w.brand} | Qty: ${w.whQty}`);
    });

    process.exit(0);
});
