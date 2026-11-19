const mongoose = require('mongoose');

const fundTransferSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FundTransfer', fundTransferSchema);
