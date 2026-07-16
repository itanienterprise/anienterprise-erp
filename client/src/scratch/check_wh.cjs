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
const backupContent = fs.readFileSync(backupPath, 'utf8');
const backup = JSON.parse(backupContent);

const warehouses = backup.data.Warehouse || [];
const decryptedWarehouses = warehouses.map(w => {
    const dec = decryptData(w.data);
    return { ...w, dec };
}).filter(w => w.dec);

console.log(`Total decrypted warehouses: ${decryptedWarehouses.length}`);
decryptedWarehouses.forEach(w => {
    const dec = w.dec;
    const pName = (dec.productName || dec.product || '').trim().toLowerCase();
    const brand = (dec.brand || '').trim().toLowerCase();
    if (brand.includes('hasina mix') || pName.includes('hasina mix')) {
        console.log(`Warehouse Record: ID: ${w._id}, Product: ${dec.productName || dec.product}, Brand: ${dec.brand}, LC: ${dec.lcNo}, Qty: ${dec.whQty || dec.quantity}, WH: ${dec.whName || dec.warehouse}`);
    }
});
