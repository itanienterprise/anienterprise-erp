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
        
        const lcNoClean = String(dec.lcNo || '').replace(/\D/g, '');
        if (lcNoClean === '073926010101') {
            console.log(`LC STOCK: Stock Record ID: ${s._id}, Date: ${dec.date}, Product: ${dec.productName || dec.product}, LC: ${dec.lcNo}, Brand: ${dec.brand}, Qty: ${dec.quantity}, inHouseQty: ${dec.inHouseQuantity}`);
            if (dec.entries) {
                dec.entries.forEach(e => console.log(`  Entry: product: ${e.productName}, qty: ${e.quantity}, inHouse: ${e.inHouseQuantity}`));
            }
        }
    });

    const DamageSchema = new mongoose.Schema({
        data: String
    }, { collection: 'damages' });
    const Damage = mongoose.model('Damage', DamageSchema);
    const damages = await Damage.find({});
    damages.forEach(d => {
        const dec = decryptData(d.data);
        if (!dec) return;
        const lcNoClean = String(dec.lcNo || '').replace(/\D/g, '');
        if (lcNoClean === '073926010101') {
            console.log(`LC DAMAGE: Damage ID: ${d._id}, Product: ${dec.productName}, Qty: ${dec.quantity}`);
        }
    });

    await mongoose.disconnect();
}

run().catch(console.error);
