const mongoose = require('mongoose');

const piSchema = new mongoose.Schema({
    piNumber: { type: String, unique: true, sparse: true },
    data: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PI', piSchema);
