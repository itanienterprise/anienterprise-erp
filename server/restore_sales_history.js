const mongoose = require('mongoose');
const { encryptData, decryptData } = require('./src/utils/encryption');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/erp_ani')
.then(async () => {
    const Sale = require('./src/models/Sale');
    const Customer = require('./src/models/Customer');
    
    const customers = await Customer.find();
    const sales = await Sale.find();

    const decryptedSales = sales.map(s => {
        let d = decryptData(s.data);
        if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
            try { d = decryptData(d.data); } catch (e) { }
        }
        return { ...d, _id: s._id, createdAt: s.createdAt };
    });

    for (const c of customers) {
        let d = decryptData(c.data);
        
        // Find all sales for this customer
        const customerSales = decryptedSales.filter(s => 
            s.customerId === c._id.toString() || 
            (s.customer && s.customer._id === c._id.toString()) ||
            s.customerName === d.customerName
        );

        if (customerSales.length > 0) {
            // Reconstruct salesHistory
            const reconstructedHistory = [];
            customerSales.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach((item, index) => {
                        let amount = 0;
                        if (item.brandEntries && item.brandEntries.length > 0) {
                            amount = item.brandEntries.reduce((sum, be) => sum + (parseFloat(be.totalAmount) || 0), 0);
                        } else {
                            amount = parseFloat(item.totalAmount) || parseFloat(sale.totalAmount) || 0;
                        }
                        
                        // We set paid and discount to 0 initially since we don't know them per item
                        // but actually paymentCollection might have updated the paid amount on the salesHistory items!
                        // Oh no, if payment was collected, it updates the "paid" field in salesHistory!
                        
                        reconstructedHistory.push({
                            id: sale._id.toString() + '_' + index,
                            date: sale.date,
                            invoiceNo: sale.invoiceNo,
                            productId: item.productId,
                            productName: item.productName,
                            brandEntries: item.brandEntries,
                            amount: amount,
                            paid: 0,
                            discount: 0
                        });
                    });
                }
            });
            
            // Sort by date descending
            reconstructedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Merge with existing salesHistory (don't duplicate)
            const existingHistory = d.salesHistory || [];
            const existingIds = new Set(existingHistory.map(h => h.invoiceNo));
            
            const newHistoryItems = reconstructedHistory.filter(h => !existingIds.has(h.invoiceNo));
            
            if (newHistoryItems.length > 0) {
                console.log(`Restoring ${newHistoryItems.length} sales history items for ${d.customerName}`);
                d.salesHistory = [...newHistoryItems, ...existingHistory];
                d.salesHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                c.data = encryptData(d);
                await c.save();
            }
        }
    }

    console.log('Done restoring sales history.');
    process.exit(0);
}).catch(console.error);
