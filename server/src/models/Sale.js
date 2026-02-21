const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
