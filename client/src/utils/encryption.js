import CryptoJS from 'crypto-js';

const SECRET_KEY = 'ani1820';

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
