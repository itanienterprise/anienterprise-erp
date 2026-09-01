const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
const SECRET_KEY = 'ani1820';

function encryptData(data) {
    if (!data) return data;
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
}

function decryptData(ciphertext) {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) { return null; }
}

async function run() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    const db = mongoose.connection.db;

    // 1. Stock 6a96812049e2209fba061bed
    const sDoc = await db.collection('stocks').findOne({ _id: new mongoose.Types.ObjectId('6a96812049e2209fba061bed') });
    if (sDoc) {
        let dec = decryptData(sDoc.data);
        dec.createdAt = '2026-08-25T12:00:00.000Z';
        const newCipher = encryptData(dec);
        const res = await db.collection('stocks').updateOne(
            { _id: sDoc._id },
            { $set: { data: newCipher, createdAt: new Date('2026-08-25T12:00:00.000Z'), updatedAt: new Date() } }
        );
        console.log('Stock updated result:', res.modifiedCount);
    }

    // 2. PR 6a93cae6445d8499a7f5faab
    const prDoc = await db.collection('purchasereceives').findOne({ _id: new mongoose.Types.ObjectId('6a93cae6445d8499a7f5faab') });
    if (prDoc) {
        let dec = decryptData(prDoc.data);
        dec.createdAt = '2026-08-25T12:00:00.000Z';
        const newCipher = encryptData(dec);
        const res = await db.collection('purchasereceives').updateOne(
            { _id: prDoc._id },
            { $set: { data: newCipher, createdAt: new Date('2026-08-25T12:00:00.000Z'), updatedAt: new Date() } }
        );
        console.log('PR updated result:', res.modifiedCount);
    }

    // Verify immediately
    const checkStock = await db.collection('stocks').findOne({ _id: new mongoose.Types.ObjectId('6a96812049e2209fba061bed') });
    console.log('Verified stock in DB:', {
        decCreatedAt: decryptData(checkStock.data).createdAt,
        docCreatedAt: checkStock.createdAt
    });

    await mongoose.disconnect();
}

run().catch(console.error);
