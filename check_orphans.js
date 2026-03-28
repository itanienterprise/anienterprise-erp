const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { decryptData } = require('./server/src/utils/encryption');
const Customer = require('./server/src/models/Customer');
const Sale = require('./server/src/models/Sale');

dotenv.config({ path: './server/.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db';

async function checkOrphans() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const customers = await Customer.find();
        console.log(`Found ${customers.length} customers.`);

        for (const record of customers) {
            const customer = decryptData(record.data);
            if (customer && customer.salesHistory && customer.salesHistory.length > 0) {
                console.log(`Checking customer: ${customer.companyName || customer.customerName} (${customer.customerId})`);
                
                const uniqueInvoices = [...new Set(customer.salesHistory.map(h => h.invoiceNo))];
                console.log(`  History has ${customer.salesHistory.length} entries with ${uniqueInvoices.length} unique invoices.`);

                for (const inv of uniqueInvoices) {
                    const sales = await Sale.find(); // This is slow, but we need to decrypt each
                    let found = false;
                    for (const sr of sales) {
                        try {
                            const sale = decryptData(sr.data);
                            if (sale.invoiceNo === inv) {
                                found = true;
                                break;
                            }
                        } catch (e) {}
                    }

                    if (!found) {
                        console.log(`  [ORPHANED] Invoice ${inv} not found in Sales collection.`);
                    } else {
                        // console.log(`  [OK] Invoice ${inv} exists.`);
                    }
                }
            }
        }

        mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkOrphans();
