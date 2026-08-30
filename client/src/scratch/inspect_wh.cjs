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

async function inspectWh() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    const Wh = mongoose.model('Warehouse', new mongoose.Schema({}, { strict: false }), 'warehouses');
    const allWh = await Wh.find({}).lean();
    console.log(`Total warehouses in DB: ${allWh.length}`);

    const decryptedWh = allWh.map(w => {
        let dec = w.data ? decryptData(w.data) : w;
        if (typeof dec === 'string') dec = decryptData(dec);
        return { ...dec, _id: w._id, createdAt: w.createdAt };
    }).filter(w => w && ((w.lcNo || '').includes('087326010687') || (w.productName || w.product || '').toLowerCase().includes('chick')));

    console.log(`Found ${decryptedWh.length} matching warehouse records:`);
    decryptedWh.forEach((w, i) => {
        console.log(`[${i}] date: ${w.date}, lcNo: ${w.lcNo}, prod: ${w.productName || w.product}, brand: ${w.brand}, whQty: ${w.whQty || w.quantity}, whPkt: ${w.whPkt || w.packet}, inHouseQty: ${w.inHouseQuantity}, fromWh: ${w.fromWh}, toWh: ${w.toWh}, isTransferLog: ${w.isTransferLog}, recordType: ${w.recordType}, whName: ${w.whName || w.warehouse}`);
    });

    await mongoose.disconnect();
}

inspectWh();
