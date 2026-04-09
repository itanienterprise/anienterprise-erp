require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/erp_ani_enterprise";

async function run() {
  await mongoose.connect(mongoURI);
  const db = mongoose.connection.db;
  
  const stock = await db.collection('stocks').find({}).toArray();
  const wh = await db.collection('warehouses').find({}).toArray();
  
  console.log("=== STOCK RECORDS ===");
  stock.forEach(s => {
      let isMatch = false;
      if (s.productName === 'MOSUR DAL' || s.product === 'MOSUR DAL') {
          console.log("Stock Record:", s);
      }
      if (s.brandEntries) {
          s.brandEntries.forEach(b => {
              if (b.brand && b.brand.toLowerCase() === 'g d p medium') {
                  console.log("Stock Record with GDP Medium brand entry:", s);
              }
          })
      }
  });

  console.log("=== WAREHOUSE RECORDS ===");
  wh.forEach(w => {
      if (w.productName === 'MOSUR DAL' || w.product === 'MOSUR DAL') {
          console.log("Warehouse Record:", w);
      }
  });
  
  process.exit(0);
}
run();
