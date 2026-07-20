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
  const rawWhs = await db.collection('warehouses').find({}).toArray();
  const rawSales = await db.collection('sales').find({}).toArray();
  const rawDamages = await db.collection('damages').find({}).toArray();
  const rawProducts = await db.collection('products').find({}).toArray();

  const stocks = rawStocks.map(s => {
    const dec = decryptData(s.data);
    return dec ? { ...dec, _id: s._id.toString() } : null;
  }).filter(Boolean);
  const whs = rawWhs.map(w => {
    const dec = decryptData(w.data);
    return dec ? { ...dec, _id: w._id.toString() } : null;
  }).filter(Boolean);
  const sales = rawSales.map(s => {
    const dec = decryptData(s.data);
    return dec ? { ...dec, _id: s._id.toString() } : null;
  }).filter(Boolean);
  const damages = rawDamages.map(d => {
    const dec = decryptData(d.data);
    return dec ? { ...dec, _id: d._id.toString() } : null;
  }).filter(Boolean);
  const products = rawProducts.map(p => {
    const dec = decryptData(p.data);
    return dec ? { ...dec, _id: p._id.toString() } : null;
  }).filter(Boolean);

  const { calculateStockData } = await import('../../client/src/utils/stockHelpers.js');

  const res = calculateStockData(stocks, { startDate: '2026-04-01', endDate: '2026-07-20', reportType: 'price' }, '', whs, sales, products, damages);
  
  const mosurDal = res.displayRecords.find(r => r.productName === 'MOSUR DAL');
  if (mosurDal) {
    console.log("MOSUR DAL brands count:", mosurDal.brandList.length);
    console.log("MOSUR DAL brandList detail:");
    mosurDal.brandList.forEach(b => {
       console.log(`Brand: "${b.brand}", LC: "${b.lcNo}", InHouse: ${b.inHouseQuantity}, Opening: ${b.openingQuantity}, Sale: ${b.saleQuantity}`);
    });
  }

  await conn.close();
  process.exit(0);
}
run();
