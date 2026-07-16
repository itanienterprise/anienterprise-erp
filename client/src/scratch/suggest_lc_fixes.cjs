const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

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

const backupPath = path.join(__dirname, '../../../server/backups/auto_backup_2026-07-15_19-00-14.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const sales = (backup.data.Sale || []).map(s => {
    const dec = decryptData(s.data);
    return { ...s, dec };
}).filter(s => s.dec);

console.log("Legacy Sales of HASINA MIX with blank LC:");
let count = 0;
sales.forEach(s => {
    const items = s.dec.items || [];
    items.forEach(item => {
        (item.brandEntries || []).forEach(be => {
            const bName = (be.brand || '').trim().toLowerCase();
            if (bName.includes('hasina mix') && (!be.lcNo || be.lcNo.trim() === '')) {
                count++;
                console.log(`${count}. Invoice: ${s.dec.invoiceNo} | Date: ${s.dec.date} | Quantity: ${be.quantity} kg (${be.bag} bags)`);
            }
        });
    });
});
