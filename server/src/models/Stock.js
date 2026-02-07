const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Stock', stockSchema);
