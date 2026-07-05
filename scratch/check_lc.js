require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/erp_ani_enterprise";

async function run() {
  await mongoose.connect(mongoURI);
  const db = mongoose.connection.db;
  
  const targetLC = '087326010574';
  const targetProduct = 'CHICK PEAS';
  
  const stocks = await db.collection('stocks').find({
    $or: [
      { lcNo: targetLC },
      { 'brandEntries.lcNo': targetLC }
    ]
  }).toArray();
  
  const warehouses = await db.collection('warehouses').find({
    $or: [
      { lcNo: targetLC },
      { 'lcNo': targetLC }
    ]
  }).toArray();
  
  console.log("=== STOCKS ===");
  stocks.forEach(s => {
    console.log(`ID: ${s._id}, Date: ${s.date}, Product: ${s.productName || s.product}, LC: ${s.lcNo}, Truck: ${s.truckNo}`);
    if (s.brandEntries) {
      console.log("  Brand Entries:");
      s.brandEntries.forEach(b => {
        console.log(`    Brand: ${b.brand}, Packet: ${b.packet}, Qty: ${b.quantity}, InHousePkt: ${b.inHousePacket}, InHouseQty: ${b.inHouseQuantity}, Shortage: ${b.sweepedQuantity}`);
      });
    } else {
      console.log(`  Single entry: Brand: ${s.brand}, Packet: ${s.packet}, Qty: ${s.quantity}, InHousePkt: ${s.inHousePacket}, InHouseQty: ${s.inHouseQuantity}, Shortage: ${s.sweepedQuantity}`);
    }
  });
  
  console.log("\n=== WAREHOUSES ===");
  warehouses.forEach(w => {
    console.log(`ID: ${w._id}, Date: ${w.date}, RecordType: ${w.recordType}, Product: ${w.productName || w.product}, LC: ${w.lcNo}, Truck: ${w.truckNo}, Brand: ${w.brand}, whQty: ${w.whQty}, whPkt: ${w.whPkt}`);
  });
  
  process.exit(0);
}
run();
