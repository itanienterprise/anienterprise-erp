const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CryptoJS = require('crypto-js');

dotenv.config({ path: './server/.env' });

const decryptData = (ciphertext) => {
    if (!ciphertext) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY || 'ani_enterprise_erp_encryption_key_2024');
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        return null;
    }
};

const PI = mongoose.model('PI', new mongoose.Schema({
    data: String,
    createdAt: Date
}));

async function checkPIs() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db');
        const pis = await PI.find();
        console.log(`Found ${pis.length} PI records.`);
        for (const pi of pis) {
            const data = decryptData(pi.data);
            console.log(`ID: ${pi._id}, PI Number: ${data ? data.piNumber : 'N/A'}`);
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkPIs();
