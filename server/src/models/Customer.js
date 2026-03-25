const mongoose = require('mongoose');
const { encryptData, decryptData } = require('../utils/encryption');

const customerSchema = new mongoose.Schema({
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// For compatibility with routes that expect plain objects
// We can add a virtual or just modify how we handle the 'data' field.
// However, the current project pattern is to store everything in a single 'data' field.

module.exports = mongoose.model('Customer', customerSchema);
