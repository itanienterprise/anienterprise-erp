const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');

const SECRET_KEY = 'ani1820';

const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
        return null;
    }
};

async function main() {
    await mongoose.connect('mongodb://localhost:27017/erp_db');
    console.log('Connected to DB');

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (let col of collections) {
        const docs = await mongoose.connection.db.collection(col.name).find().toArray();
        console.log(`\nCollection: ${col.name} (${docs.length} docs)`);
        
        const decryptedDocs = docs.map(d => {
            if (d.data) {
                let decrypted = decryptData(d.data);
                if (typeof decrypted === 'string') {
                    try { decrypted = decryptData(decrypted); } catch (e) {}
                }
                return decrypted;
            }
            return d;
        }).filter(Boolean);

        if (decryptedDocs.length > 0) {
            console.log('Sample Doc Keys:', Object.keys(decryptedDocs[0]));
            if (col.name === 'lcexpenses') {
                const heads = new Set(decryptedDocs.map(d => d.expenseHead));
                console.log('Unique Expense Heads:', Array.from(heads));
            }
            if (col.name === 'lcmanagements') {
                console.log('Sample LC data:', decryptedDocs[0]);
            }
        }
    }
    await mongoose.disconnect();
}

main().catch(console.error);
