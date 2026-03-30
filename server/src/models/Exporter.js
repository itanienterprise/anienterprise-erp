const mongoose = require('mongoose');

const exporterSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exporter', exporterSchema);
