const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bank', bankSchema);
