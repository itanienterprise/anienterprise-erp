const mongoose = require('mongoose');
const { encryptData, decryptData } = require('./src/utils/encryption');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erp_ani')
.then(async () => {
    const Sale = require('./src/models/Sale');
    const Customer = require('./src/models/Customer');
    
    const customers = await Customer.find();
    const sales = await Sale.find();

    const customerDict = {};
    for (const c of customers) {
        let d = decryptData(c.data);
        customerDict[c._id.toString()] = {
            companyName: d.companyName || '',
            customerName: d.customerName || ''
        };
    }

    let updatedCount = 0;
    for (const s of sales) {
        let d = decryptData(s.data);
        if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
            try { d = decryptData(d.data); } catch(e) {}
        }
        
        let cId = d.customerId;
        if (!cId && d.customer && d.customer._id) {
            cId = d.customer._id;
        }

        if (cId && customerDict[cId]) {
            const cust = customerDict[cId];
            if (d.companyName !== cust.companyName || d.customerName !== cust.customerName) {
                d.companyName = cust.companyName;
                d.customerName = cust.customerName;
                s.data = encryptData(d);
                await s.save();
                updatedCount++;
            }
        }
    }

    console.log(`Successfully synced ${updatedCount} sales with their latest customer names.`);
    process.exit(0);
}).catch(console.error);
