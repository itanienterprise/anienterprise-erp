const axios = require('axios');
const { encryptData, decryptData, generateSignature } = require('../src/utils/encryption');

const API_URL = 'http://127.0.0.1:5000/v';

const timestamp = Date.now().toString();
const gatewayPayload = {
    p: '/api/stock',
    m: 'GET',
    d: {}
};

const signature = generateSignature(gatewayPayload, timestamp);

axios.post(API_URL, {
    payload: encryptData(gatewayPayload)
}, {
    headers: {
        'X-Timestamp': timestamp,
        'X-Signature': signature
    }
}).then(res => {
    if (res.data && res.data.payload) {
        const decrypted = decryptData(res.data.payload);
        console.log('Decrypted stock records:');
        
        // Find matching LCs
        const matches = decrypted.filter(r => r.lcNo === 'L1001' || r.lcNo === '100001');
        console.log(JSON.stringify(matches, null, 2));
    } else {
        console.log('Response body:', res.data);
    }
    process.exit(0);
}).catch(err => {
    console.error('Error fetching stock:', err.message);
    process.exit(1);
});
