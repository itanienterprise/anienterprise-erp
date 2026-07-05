require('dotenv').config();
const mongoose = require('mongoose');
const CryptoJS = require('crypto-js');
const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/erp_ani_enterprise";

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

function fullyDecrypt(item) {
  if (!item) return null;
  let d = item.data ? decryptData(item.data) : item;
  if (typeof d === 'string') {
    try {
      d = decryptData(d);
    } catch (e) {}
  } else if (d && d.data && typeof d.data === 'string' && !d.lcNo) {
    try {
      d = decryptData(d.data);
    } catch (e) {}
  }
  return {
    ...d,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function run() {
  await mongoose.connect(mongoURI);
  const db = mongoose.connection.db;
  
  const targetLC = '087326010574';
  const targetProduct = 'CHICK PEAS';
  
  const warehouses = await db.collection('warehouses').find({}).toArray();
  const decryptedWh = warehouses.map(fullyDecrypt).filter(Boolean);
  
  console.log("=== WAREHOUSE RECORDS ===");
  decryptedWh.forEach(w => {
    const isLC = w.lcNo === targetLC;
    const isProd = (w.productName || w.product) === targetProduct;
    if (isLC && isProd) {
      console.log(JSON.stringify(w, null, 2));
    }
  });
  
  process.exit(0);
}
run();
