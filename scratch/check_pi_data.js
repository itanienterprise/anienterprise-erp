const mongoose = require('mongoose');
const dotenv = require('dotenv');
const CryptoJS = require('crypto-js');

dotenv.config({ path: 'server/.env' });

const encryptionKey = process.env.ENCRYPTION_KEY || 'ani_enterprise_secret_key_2024';

function decryptData(ciphertext) {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, encryptionKey);
    const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    return decryptedData;
  } catch (error) {
    return null;
  }
}

const piSchema = new mongoose.Schema({
    piNumber: String,
    data: String
}, { timestamps: true });

const PI = mongoose.model('PI', piSchema);

async function checkPiData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db');
        console.log('Connected to MongoDB');

        const records = await PI.find().limit(5);
        console.log(`Found ${records.length} PI records`);

        records.forEach((r, i) => {
            const data = decryptData(r.data);
            console.log(`\nRecord ${i+1} (PI: ${r.piNumber}):`);
            console.log('Port:', data.port);
            console.log('Port of Loading:', data.portOfLoading);
            console.log('Port of Discharge:', data.portOfDischarge);
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkPiData();
