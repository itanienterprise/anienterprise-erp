const mongoose = require('mongoose');

const lcManagementSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('LCManagement', lcManagementSchema);
