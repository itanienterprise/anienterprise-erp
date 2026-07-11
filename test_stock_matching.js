require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const fs = require('fs');

// Read the safeParse and calculateStockData code from stockHelpers.js
const stockHelpersCode = fs.readFileSync('./client/src/utils/stockHelpers.js', 'utf8')
  .replace(/export const/g, 'const')
  .replace(/export /g, '');

// Eval stockHelpers.js in our context
const context = {};
eval(stockHelpersCode + '\ncontext.calculateStockData = calculateStockData;');

const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/erp_ani_enterprise";

async function run() {
  await mongoose.connect(mongoURI);
  const db = mongoose.connection.db;

  const stockRecords = await db.collection('stocks').find({}).toArray();
  const warehouseData = await db.collection('warehouses').find({}).toArray();
  const salesRecords = await db.collection('sales').find({}).toArray();
  const products = await db.collection('products').find({}).toArray();
  const damages = await db.collection('damages').find({}).toArray();

  const stockFilters = {};

  console.log("=== RUNNING SHORT REPORT ===");
  const shortData = context.calculateStockData(
    stockRecords,
    { ...stockFilters, reportType: 'short' },
    '',
    warehouseData,
    salesRecords,
    products,
    damages
  );

  const shortBran = shortData.displayRecords.find(r => r.productName === 'BRAN');
  if (shortBran) {
    console.log("Short BRAN Brands:");
    shortBran.brandList.forEach(b => {
      console.log(`- Brand: ${b.brand}, LC: ${b.lcNo}, Qty: ${b.inHouseQuantity}, Bag: ${b.openingQuantity + b.periodArrivalQuantity - b.saleQuantity}`);
    });
    console.log("Short BRAN Totals: inHouseQty:", shortBran.inHouseQuantity);
  } else {
    console.log("BRAN not found in Short report.");
  }

  console.log("\n=== RUNNING PRICE REPORT ===");
  const priceData = context.calculateStockData(
    stockRecords,
    { ...stockFilters, reportType: 'price' },
    '',
    warehouseData,
    salesRecords,
    products,
    damages
  );

  const priceBran = priceData.displayRecords.find(r => r.productName === 'BRAN');
  if (priceBran) {
    console.log("Price BRAN Brands:");
    priceBran.brandList.forEach(b => {
      console.log(`- Brand: ${b.brand}, LC: ${b.lcNo}, Rate: ${b.purchasedPrice}, Qty: ${b.inHouseQuantity}`);
    });
    console.log("Price BRAN Totals: inHouseQty:", priceBran.inHouseQuantity);
  } else {
    console.log("BRAN not found in Price report.");
  }

  process.exit(0);
}
run();
