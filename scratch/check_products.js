const mongoose = require('mongoose');
const { decryptData } = require('../server/src/utils/crypto.js');

mongoose.connect('mongodb://127.0.0.1:27017/erp_ani')
  .then(async () => {
    const Product = require('../server/src/models/Product.js');
    const products = await Product.find();
    console.log("=== PRODUCTS ===");
    products.forEach(p => {
      try {
        const d = decryptData(p.data);
        console.log(`_id: ${p._id}, name: ${d.name}, ipName: ${d.ipName}, category: ${d.category}`);
      } catch (e) {
        console.log(`Failed to decrypt for ${p._id}: ${e.message}`);
      }
    });
    process.exit(0);
  });
