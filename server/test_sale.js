const CryptoJS = require("crypto-js");
const SECRET_KEY = "ani_enterprise_secret_key_2024_secure_billing"; 

const encryptData = (data) => {
    try {
        const jsonString = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
    } catch (error) {
        console.error('Encryption failed:', error);
        return null;
    }
};

const formData = {
    date: '2026-02-23',
    invoiceNo: 'SALE-001',
    customerId: '',
    companyName: '',
    customerName: '',
    address: '',
    contact: '',
    items: [{
        productId: '64some_id',
        productName: 'MOTH DAL',
        brandEntries: [{
            brand: 'LADDU GOPAL',
            inhouseQty: '0',
            warehouseId: 'stock-Bogura',
            warehouseName: 'Bogura',
            warehouseQty: '0',
            quantity: '0',
            unitPrice: '0',
            totalAmount: '0'
        }]
    }],
    totalAmount: '0.00',
    discount: '0.00',
    paidAmount: '0.00',
    dueAmount: '0.00',
    paymentMethod: 'Cash',
    status: 'Pending',
    saleType: 'General'
};

const payload = { data: encryptData(formData) };

fetch('http://localhost:5000/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
})
.then(r => r.json().then(data => ({status: r.status, ok: r.ok, data})))
.then(console.log)
.catch(console.error);
