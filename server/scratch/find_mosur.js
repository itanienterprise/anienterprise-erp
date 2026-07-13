const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    return { ...d, _id: r._id };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawProducts = await Product.find({});
    
    rawProducts.forEach((p, idx) => {
        const d = decryptRecord(p);
        if (d.name && d.name.toUpperCase().includes('MOSUR')) {
            console.log(`Matched Product: ID: ${d._id} | Name: "${d.name}" | HSCode: "${d.hsCode}" | Brand: "${d.brand}" | Brands: ${JSON.stringify(d.brands)}`);
        }
    });
    
    process.exit(0);
});
