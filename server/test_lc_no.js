const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
const SECRET_KEY = 'ani1820'; // From client/src/utils/encryption.js

const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        return null;
    }
};

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const coll = mongoose.connection.db.collection('sales');
    const docs = await coll.find().sort({_id: -1}).limit(5).toArray();
    docs.forEach(d => {
        const dec = decryptData(d.data);
        console.log(`ID: ${d._id}\nInvoice: ${dec?.invoiceNo}\nLC No: ${dec?.lcNo}\nImporter: ${dec?.importer}\nType: ${dec?.saleType}\n----`);
    });
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
