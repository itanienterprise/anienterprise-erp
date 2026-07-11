const mongoose = require('mongoose');
const Product = require('./server/src/models/Product');
const { decryptData } = require('./server/src/utils/encryption');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    const rawProd = await Product.find({});
    const products = rawProd.map(r => {
        let d = decryptData(r.data);
        return { ...d, _id: r._id, createdAt: r.createdAt };
    });

    console.log("All products name & ipName:");
    products.forEach(p => {
        console.log(`- Name: "${p.name}" | ipName: "${p.ipName}" | brand: "${p.brand}"`);
    });
    
    process.exit(0);
});
