const mongoose = require('mongoose');
const LCExpense = require('../src/models/LCExpense');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.lcNo) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawExpenses = await LCExpense.find({});
    console.log(`Total Expense records: ${rawExpenses.length}`);
    
    rawExpenses.forEach((exp, idx) => {
        const d = decryptRecord(exp);
        console.log(`${idx + 1}. ID: ${d._id} | LC No: "${d.lcNo}" | expenseHead: "${d.expenseHead}" | amount: ${d.amount} | type: "${d.type}" | expenseDate: "${d.date}"`);
    });
    
    process.exit(0);
});
