const mongoose = require('mongoose');
const { encryptData, decryptData } = require('./src/utils/encryption');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erp_ani')
.then(async () => {
    const Sale = require('./src/models/Sale');
    const Customer = require('./src/models/Customer');
    
    const customers = await Customer.find();
    let aviId = '';
    for (const c of customers) {
        let d = decryptData(c.data);
        if (d.customerName === 'AVI') {
            console.log('Found AVI:', d);
            aviId = c._id.toString();
        }
    }

    const sales = await Sale.find();
    console.log(`Total sales: ${sales.length}`);
    for (const s of sales) {
        let d = decryptData(s.data);
        if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
            try { d = decryptData(d.data); } catch (e) { }
        }
        if (d.customerName === 'AVI' || (d.customer && d.customer._id === aviId) || d.customerId === aviId) {
             console.log('Sale for AVI:', JSON.stringify(d, null, 2));
        }
    }
    process.exit(0);
}).catch(console.error);
