const mongoose = require('mongoose');

const lcGatePassSchema = new mongoose.Schema({
    data: {
        type: String, // Encrypted data
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('LCGatePass', lcGatePassSchema);
