const mongoose = require('mongoose');

const metaDataSchema = new mongoose.Schema({
    category: { type: String, required: true }, // e.g., 'preCarriage', 'receiptPlace', 'vessel', 'country'
    data: { type: String, required: true },     // Encrypted object { value: '...' }
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MetaData', metaDataSchema);
