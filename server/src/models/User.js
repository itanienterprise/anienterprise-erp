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
        type: String, // Base64 encoded image (original portrait)
        default: null
    },
    avatarPhoto: {
        type: String, // Base64 encoded cropped avatar for navbar
        default: null
    },
    phone: {
        type: String,
        default: '+880XXXXXXXXXX'
    },
    email: {
        type: String,
        default: 'admin@ani-enterprise.com'
    },
    name: {
        type: String,
        default: null
    },
    designation: {
        type: String,
        default: null
    },
    department: {
        type: String,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
