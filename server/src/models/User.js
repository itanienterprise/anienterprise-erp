const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'admin'
    },
    profilePhoto: {
        type: String, // Base64 encoded image
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
