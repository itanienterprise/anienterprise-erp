import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'ani1820'; // Fallback for safety, but should be in .env

export const encryptData = (data) => {
    if (!data) return data;
    try {
        const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
        return ciphertext;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
};

export const decryptData = (ciphertext) => {
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
 * Generates an HMAC signature for a payload and timestamp.
 * This ensures request integrity and prevents tampering in Burp Suite.
 */
export const generateSignature = (payload, timestamp) => {
    try {
        const dataToSign = `${JSON.stringify(payload)}|${timestamp}`;
        return CryptoJS.HmacSHA256(dataToSign, SECRET_KEY).toString();
    } catch (error) {
        console.error('Signature generation error:', error);
        return null;
    }
};
