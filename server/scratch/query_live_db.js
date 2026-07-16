const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');

const SECRET_KEY = 'ani1820';

function decryptData(ciphertext) {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        return null;
    }
}

async function run() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    console.log("Connected to MongoDB");

    const StockSchema = new mongoose.Schema({
        data: String
    }, { collection: 'stocks' });

    const Stock = mongoose.model('Stock', StockSchema);

    const stocks = await Stock.find({});
    console.log(`Found ${stocks.length} stock records in database`);

    stocks.forEach(s => {
        const dec = decryptData(s.data);
        if (!dec) return;
        
        const matchLc = dec.lcNo === '087326010601';
        const matchBrand = (dec.brand || '').trim().toLowerCase() === 'hasina mix';
        const matchBrandEntries = (dec.brandEntries || []).some(b => (b.brand || '').trim().toLowerCase() === 'hasina mix');
        
        if (matchLc || matchBrand || matchBrandEntries) {
            console.log(`Stock Record ID: ${s._id}, Date: ${dec.date}, LC: ${dec.lcNo}, Brand: ${dec.brand}, Qty: ${dec.quantity}, inHouseQty: ${dec.inHouseQuantity}`);
            if (dec.brandEntries) {
                dec.brandEntries.forEach(b => console.log(`  BrandEntry: brand: ${b.brand}, qty: ${b.quantity}`));
            }
        }
    });

    await mongoose.disconnect();
}

run().catch(console.error);
