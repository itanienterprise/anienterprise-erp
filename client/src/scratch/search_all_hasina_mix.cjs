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

for (const [colName, list] of Object.entries(backup.data)) {
    let count = 0;
    list.forEach(item => {
        const dec = decryptData(item.data);
        if (!dec) return;
        const str = JSON.stringify(dec).toLowerCase();
        if (str.includes('hasina mix')) {
            count++;
            console.log(`Match in ${colName} (ID: ${item._id}):`);
            // print a simplified version of match
            if (colName === 'Sale') {
                console.log(`  Sale Invoice: ${dec.invoiceNo}, LC: ${dec.lcNo}, Date: ${dec.date}`);
            } else if (colName === 'Stock') {
                console.log(`  Stock ID: ${item._id}, Product: ${dec.productName || dec.product}, LC: ${dec.lcNo}`);
                if (dec.brandEntries) {
                    dec.brandEntries.forEach(b => console.log(`    BrandEntry: brand: ${b.brand}, qty: ${b.quantity}`));
                }
            } else {
                console.log(`  Data:`, JSON.stringify(dec).slice(0, 300));
            }
        }
    });
    if (count > 0) {
        console.log(`Total matches in ${colName}: ${count}`);
    }
}
