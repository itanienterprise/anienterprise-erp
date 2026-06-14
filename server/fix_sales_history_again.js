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
        
        // Remove the badly formatted history items from my previous script
        // My previous script generated IDs with "_" (e.g. "69cca76887b384d971faa915_0")
        if (d.salesHistory) {
            d.salesHistory = d.salesHistory.filter(h => !(h.id && h.id.includes('_')));
        }
        
        // Find all sales for this customer
        const customerSales = decryptedSales.filter(s => 
            s.customerId === c._id.toString() || 
            (s.customer && s.customer._id === c._id.toString()) ||
            s.customerName === d.customerName
        );

        if (customerSales.length > 0) {
            // Reconstruct salesHistory correctly
            const reconstructedHistory = [];
            customerSales.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    sale.items.forEach((item, pIdx) => {
                        if (item.brandEntries && item.brandEntries.length > 0) {
                            item.brandEntries.forEach((entry, eIdx) => {
                                const isFirstEntry = pIdx === 0 && eIdx === 0;
                                reconstructedHistory.push({
                                    id: `${sale._id.toString()}_${pIdx}_${eIdx}`, // Use a unique ID with _ so we know it's reconstructed
                                    date: sale.date,
                                    invoiceNo: sale.invoiceNo,
                                    lcNo: sale.lcNo || '',
                                    product: item.productName || '',
                                    brand: entry.brand || '',
                                    quantity: entry.quantity || 0,
                                    rate: entry.unitPrice || 0,
                                    truck: entry.truck || '',
                                    amount: entry.totalAmount || 0,
                                    paid: isFirstEntry ? (parseFloat(sale.paidAmount) || 0) : 0,
                                    due: isFirstEntry ? (parseFloat(sale.dueAmount) || 0) : (entry.totalAmount || 0),
                                    discount: isFirstEntry ? (parseFloat(sale.discount) || 0) : 0,
                                    warehouse: entry.warehouseName || '',
                                    requestedBy: sale.requestedBy || '',
                                    requestedByUsername: sale.requestedByUsername || '',
                                    acceptedBy: sale.acceptedBy || '',
                                    status: 'Pending'
                                });
                            });
                        } else {
                            reconstructedHistory.push({
                                id: `${sale._id.toString()}_${pIdx}_0`,
                                date: sale.date,
                                invoiceNo: sale.invoiceNo,
                                lcNo: sale.lcNo || '',
                                product: item.productName || '',
                                brand: item.brand || '',
                                quantity: item.quantity || sale.quantity || 0,
                                rate: item.unitPrice || sale.unitPrice || 0,
                                truck: item.truck || sale.truck || '',
                                amount: item.totalAmount || sale.totalAmount || 0,
                                paid: parseFloat(sale.paidAmount) || 0,
                                due: parseFloat(sale.dueAmount) || 0,
                                discount: parseFloat(sale.discount) || 0,
                                warehouse: item.warehouseName || '',
                                requestedBy: sale.requestedBy || '',
                                requestedByUsername: sale.requestedByUsername || '',
                                acceptedBy: sale.acceptedBy || '',
                                status: 'Pending'
                            });
                        }
                    });
                } else if (sale.productName) {
                     // Old format sale without items array?
                     reconstructedHistory.push({
                        id: `${sale._id.toString()}_0_0`,
                        date: sale.date,
                        invoiceNo: sale.invoiceNo,
                        lcNo: sale.lcNo || '',
                        product: sale.productName || '',
                        brand: sale.brand || '',
                        quantity: sale.quantity || 0,
                        rate: sale.unitPrice || 0,
                        truck: sale.truck || '',
                        amount: sale.totalAmount || 0,
                        paid: parseFloat(sale.paidAmount) || 0,
                        due: parseFloat(sale.dueAmount) || 0,
                        discount: parseFloat(sale.discount) || 0,
                        warehouse: sale.warehouseName || '',
                        requestedBy: sale.requestedBy || '',
                        requestedByUsername: sale.requestedByUsername || '',
                        acceptedBy: sale.acceptedBy || '',
                        status: 'Pending'
                    });
                }
            });
            
            // Sort by date descending
            reconstructedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Merge with existing salesHistory
            const existingHistory = d.salesHistory || [];
            // Remove the bad ones if they somehow survived (already filtered above)
            const existingIds = new Set(existingHistory.map(h => h.invoiceNo));
            
            const newHistoryItems = reconstructedHistory.filter(h => !existingIds.has(h.invoiceNo));
            
            if (newHistoryItems.length > 0) {
                console.log(`Restoring ${newHistoryItems.length} corrected sales history items for ${d.customerName}`);
                d.salesHistory = [...newHistoryItems, ...existingHistory];
                d.salesHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                c.data = encryptData(d);
                await c.save();
            }
        }
    }

    console.log('Done correcting sales history.');
    process.exit(0);
}).catch(console.error);
