const mongoose = require('mongoose');
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
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);
    
    console.log("=== PRODUCTS AND CATEGORIES ===");
    products.forEach(p => {
        console.log(`Product: ${p.name || p.productName} | Category: ${p.category}`);
    });
    process.exit(0);
});
