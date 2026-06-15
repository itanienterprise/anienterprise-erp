const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'server/.env' });

const { decryptData } = require('../server/src/utils/encryption');

const genericSchema = new mongoose.Schema({
    data: String
}, { timestamps: true });

const LCExpense = mongoose.model('LCExpense', genericSchema);
const CnFPayment = mongoose.model('CnFPayment', genericSchema);

async function inspectData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db');
        console.log('Connected to MongoDB');

        const expenses = await LCExpense.find();
        console.log(`\n=== Total LC Expenses: ${expenses.length} ===`);
        expenses.forEach((e) => {
            const dec = decryptData(e.data);
            if (dec) {
                console.log(`[LCExpense] ID: ${e._id}, LC: ${dec.lcNo}, Head: ${dec.expenseHead}, Type: ${dec.type}, Agent: ${dec.cnfAgent}, Amount: ${dec.amount}, Remarks: ${dec.remarks}`);
            } else {
                console.log(`[LCExpense] ID: ${e._id} - FAILED TO DECRYPT`);
            }
        });

        const payments = await CnFPayment.find();
        console.log(`\n=== Total C&F Payments: ${payments.length} ===`);
        payments.forEach((p) => {
            const dec = decryptData(p.data);
            if (dec) {
                console.log(`[CnFPayment] ID: ${p._id}, cnfId: ${dec.cnfId}, Name: ${dec.cnfName}, Date: ${dec.date}, Amount: ${dec.amount}, lcExpenseId: ${dec.lcExpenseId}, Remarks: ${dec.remarks}`);
            } else {
                console.log(`[CnFPayment] ID: ${p._id} - FAILED TO DECRYPT`);
            }
        });

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

inspectData();
