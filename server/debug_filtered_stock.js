const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');
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
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    stockRecords.forEach(item => {
        const prod = (item.productName || item.product || '').toUpperCase();
        if (prod.includes('MOSUR') && (item.brand || '').includes('G D P')) {
            const itemStatus = (item.status || '').toLowerCase();
            const dateOnly = (item.date || '').split('T')[0];
            console.log(`ID: ${item._id} | LC: ${item.lcNo} | Status: ${item.status} | Date: ${item.date} | InHouseQty: ${item.inHouseQuantity} | Qty: ${item.quantity}`);
        }
    });
    process.exit(0);
});
