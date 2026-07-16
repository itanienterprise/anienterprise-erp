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

const stocks = backup.data.Stock || [];

stocks.forEach(s => {
    const dec = decryptData(s.data);
    if (dec && dec.lcNo === '087326010601') {
        console.log(`\nStock ID: ${s._id}`);
        console.log(JSON.stringify(dec, null, 2));
    }
});
