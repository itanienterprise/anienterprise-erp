require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erp_ani', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// We need the mongoose models and encryption logic
// Since the models store encrypted data, we need to use the encryptData/decryptData logic.
// We can just use the existing Customer, Sale, PaymentCollection models.
const { encryptData, decryptData } = require('./src/utils/encryption');
const { Customer, Sale, PaymentCollection } = require('./src/models'); // Assumes models are exported

async function repair() {
    try {
        const customers = await Customer.find();
        const sales = await Sale.find();
        
        // Decrypt all sales
        const decryptedSales = sales.map(s => {
            let d = decryptData(s.data);
            if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
                try { d = decryptData(d.data); } catch (e) { }
            }
            return { ...d, _id: s._id, createdAt: s.createdAt };
        });

        // Group sales by customer
        const salesByCustomer = {};
        for (const sale of decryptedSales) {
            const custId = sale.customer || sale.customerId; // need to find how it's stored
            // Usually sale has customerName or customerId
            // Let's print out what a sale looks like
            console.log(sale.invoiceNo, sale.customerName, sale.customerId);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

// repair();
