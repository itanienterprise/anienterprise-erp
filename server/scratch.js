const mongoose = require('mongoose');
const Stock = require('./src/models/Stock');
const { decryptData } = require('./src/utils/encryption');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
    try {
        const rawStock = await Stock.find({});
        const stock = rawStock.map(r => ({ ...decryptData(r.data), _id: r._id }));
        console.log('--- STOCK RECORDS (Decrypted) ---');
        // Let's print the unique product names in stock records
        const uniqueProducts = new Set();
        stock.forEach(s => {
            uniqueProducts.add(s.productName);
        });
        console.log('Unique product names in Stock:', Array.from(uniqueProducts));
        
        console.log('\nSample Stock records:');
        stock.slice(0, 10).forEach(s => {
            console.log(`ID: ${s._id}, Date: ${s.date}, LC No: ${s.lcNo}, Product Name: "${s.productName}", Brand: "${s.brand}"`);
        });

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
});
