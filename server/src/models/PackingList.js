const mongoose = require('mongoose');

const packingListSchema = new mongoose.Schema({
    packingListNumber: { type: String, sparse: true },
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PackingList', packingListSchema);
