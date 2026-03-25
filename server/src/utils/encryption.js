const CryptoJS = require('crypto-js');

const SECRET_KEY = process.env.SECRET_KEY || 'ani1820'; // Fallback for safety, but should be in .env

const encryptData = (data) => {
    if (!data) return data;
    try {
        const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
        return ciphertext;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
};

const decryptData = (ciphertext) => {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
};

/**
 * Verifies an HMAC signature for a payload and timestamp.
 */
const verifySignature = (payload, timestamp, signature) => {
    try {
        const dataToSign = `${JSON.stringify(payload)}|${timestamp}`;
        const expectedSignature = CryptoJS.HmacSHA256(dataToSign, SECRET_KEY).toString();
        return expectedSignature === signature;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};

module.exports = { encryptData, decryptData, verifySignature };
