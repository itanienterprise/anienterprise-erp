const mongoose = require('mongoose');
const Sale = require('./src/models/Sale');
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
    
    sales.forEach(s => {
        (s.items || []).forEach(item => {
            (item.brandEntries || []).forEach(be => {
                if (be.returnQty > 0) {
                    console.log(`Invoice: ${s.invoiceNo} | Brand: ${be.brand} | WhName: ${be.warehouseName} | Qty: ${be.quantity} | ReturnQty: ${be.returnQty}`);
                }
            });
        });
    });
    process.exit(0);
});
