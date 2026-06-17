const mongoose = require('mongoose');
const { decryptData } = require('../src/utils/encryption.js');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db')
  .then(async () => {
    const LCManagement = require('../src/models/LCManagement.js');
    const lcs = await LCManagement.find().limit(5);
    console.log("=== LC RECORDS ===");
    lcs.forEach(lc => {
      try {
        const d = decryptData(lc.data);
        console.log(`_id: ${lc._id}, lcNo: ${d.lcNo}, productName: ${d.productName}, productsList: ${JSON.stringify(d.productsList)}`);
      } catch (e) {
        console.log(`Failed to decrypt for ${lc._id}: ${e.message}`);
      }
    });
    process.exit(0);
  });
