const mongoose = require('mongoose');
const { decryptData } = require('../src/utils/encryption');

function decryptField(val) {
    if (typeof val !== 'string') return val;
    if (val.length > 20 && !val.includes(' ') && !val.includes('{') && !val.includes('[')) {
        try {
            const dec = decryptData(val);
            if (dec) return dec;
        } catch (e) {}
    }
    return val;
}

function decryptObject(obj) {
    if (!obj) return obj;
    if (Array.isArray(obj)) {
        return obj.map(decryptObject);
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (key === 'data' && typeof obj[key] === 'string') {
                const dec = decryptField(obj[key]);
                if (typeof dec === 'object') {
                    Object.assign(result, decryptObject(dec));
                } else {
                    result[key] = dec;
                }
            } else {
                try {
                    result[key] = decryptObject(decryptField(obj[key]));
                } catch (e) {
                    result[key] = obj[key];
                }
            }
        }
        return result;
    }
    return obj;
}

// Override console.error during decryption
console.error = () => {};

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const colInfo of collections) {
        const colName = colInfo.name;
        if (colName === 'sessions' || colName === 'system.indexes') continue;
        
        const docs = await db.collection(colName).find({}).toArray();
        const matches = [];
        
        docs.forEach(doc => {
            const decrypted = decryptObject(doc);
            const str = JSON.stringify(decrypted).toUpperCase();
            if (str.includes('MAIZE')) {
                matches.push({
                    id: doc._id,
                    lcNo: decrypted.lcNo || decrypted.lcNoVal,
                    date: decrypted.date,
                    productName: decrypted.productName || decrypted.product,
                    invoiceNo: decrypted.invoiceNo,
                    status: decrypted.status
                });
            }
        });
        
        if (matches.length > 0) {
            console.log(`\n=== COLLECTION: ${colName} (Count: ${matches.length}) ===`);
            matches.forEach(m => {
                console.log(`  - ID: ${m.id} | LC: ${m.lcNo || '-'} | Date: ${m.date || '-'} | Product: ${m.productName || '-'} | Invoice: ${m.invoiceNo || '-'} | Status: ${m.status || '-'}`);
            });
        }
    }
    
    process.exit(0);
});
