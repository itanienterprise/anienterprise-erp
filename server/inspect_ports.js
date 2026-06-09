const mongoose = require('mongoose');
const Port = require('./src/models/Port');
const { decryptData } = require('./src/utils/encryption');

mongoose.connect('mongodb://localhost:27017/erp_db').then(async () => {
  const ports = await Port.find({});
  console.log("=== PORTS ===");
  ports.forEach(p => {
    try {
      console.log(p._id, decryptData(p.data));
    } catch(e) {
      console.error(p._id, "Error decrypting");
    }
  });
  process.exit(0);
});
