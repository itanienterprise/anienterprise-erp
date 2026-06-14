const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/erp_ani', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const LcManagement = require('./server/src/models/LcManagement.js');
    const lcs = await LcManagement.find().limit(2);
    console.log(lcs);
    process.exit(0);
  });
