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

async function inspect() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    const Stock = mongoose.model('Stock', new mongoose.Schema({}, { strict: false }), 'stocks');
    const allStocks = await Stock.find({}).lean();
    console.log(`Total stocks in DB: ${allStocks.length}`);

    const decryptedStocks = allStocks.map(s => {
        let dec = s.data ? decryptData(s.data) : s;
        if (typeof dec === 'string') dec = decryptData(dec);
        return { ...dec, _id: s._id, createdAt: s.createdAt };
    }).filter(s => s && ((s.lcNo || '').includes('087326010687') || (s.productName || s.product || '').toLowerCase().includes('chick')));

    console.log(`Found ${decryptedStocks.length} matching stocks:`);
    decryptedStocks.forEach((s, i) => {
        console.log(`[${i}] date: ${s.date}, lcNo: ${s.lcNo}, prod: ${s.productName || s.product}, brand: ${s.brand}, qty: ${s.quantity}, inHouseQty: ${s.inHouseQuantity}, truck: ${s.truckNo}, invoice: ${s.invoiceNo}`);
        if (s.entries) console.log('   entries:', JSON.stringify(s.entries));
        if (s.brandEntries) console.log('   brandEntries:', JSON.stringify(s.brandEntries));
    });

    const LCReceive = mongoose.model('LCReceive', new mongoose.Schema({}, { strict: false }), 'lcreceives');
    const allLcs = await LCReceive.find({}).lean();
    console.log(`\nTotal LCReceives in DB: ${allLcs.length}`);
    const decryptedLcs = allLcs.map(l => {
        let dec = l.data ? decryptData(l.data) : l;
        if (typeof dec === 'string') dec = decryptData(dec);
        return { ...dec, _id: l._id, createdAt: l.createdAt };
    }).filter(l => l && (l.lcNo || '').includes('087326010687'));

    console.log(`Found ${decryptedLcs.length} matching LCReceives:`);
    decryptedLcs.forEach((l, i) => {
        console.log(`[${i}] date: ${l.date}, lcNo: ${l.lcNo}, truck: ${l.truckNo}, invoice: ${l.invoiceNo}`);
        if (l.entries) console.log('   entries:', JSON.stringify(l.entries));
    });

    await mongoose.disconnect();
}

inspect();
