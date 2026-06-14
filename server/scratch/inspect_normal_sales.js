const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);

    console.log("Checking first 10 normal sales:");
    salesRecords.slice(0, 10).forEach((sale, sIdx) => {
        console.log(`\nSale ${sIdx + 1} ID: ${sale._id} | Invoice: ${sale.invoiceNo}`);
        (sale.items || []).forEach((item, iIdx) => {
            console.log(`  Item ${iIdx + 1}: ${item.productName}`);
            (item.brandEntries || []).forEach((be, bIdx) => {
                console.log(`    Brand: ${be.brand} | quantity: ${be.quantity} (${typeof be.quantity}) | originalQuantity: ${be.originalQuantity} (${typeof be.originalQuantity})`);
            });
        });
    });

    process.exit(0);
});
