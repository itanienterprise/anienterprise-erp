const CryptoJS = require('crypto-js');
const mongoose = require('mongoose');

const SECRET_KEY = 'ani1820';

function decryptData(ciphertext) {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    return null;
  }
}

async function run() {
  const uri = `mongodb://localhost:27017/erp_db`;
  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;

  const rawStocks = await db.collection('stocks').find({}).toArray();
  const stocks = rawStocks.map(s => ({ ...s, dec: decryptData(s.data) })).filter(s => s.dec);

  const matchStocks = stocks.filter(s => {
    const d = s.dec;
    let m = (d.lcNo && String(d.lcNo).includes('0335'));
    if (d.brandEntries) {
      d.brandEntries.forEach(be => {
        if (be.lcNo && String(be.lcNo).includes('0335')) m = true;
      });
    }
    return m;
  });

  console.log("=== MATCHING STOCKS ===");
  matchStocks.forEach(s => {
    console.log(`Stock ID: ${s._id}`);
    console.log("Decrypted stock record:", JSON.stringify(s.dec, null, 2));
  });

  await conn.close();
  process.exit(0);
}
run();
