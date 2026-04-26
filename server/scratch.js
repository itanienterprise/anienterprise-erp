const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/erp_db')
    .then(async () => {
        const db = mongoose.connection.db;
        const expenses = await db.collection('lcexpenses').find({}).limit(5).toArray();
        if (expenses.length > 0) {
            console.log("Expense schema:", Object.keys(expenses[0]));
            console.log("Expense sample:", expenses[0]);
        } else {
            console.log("No expenses found");
        }
        mongoose.connection.close();
    });
