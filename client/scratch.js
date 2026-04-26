const mongoose = require('mongoose');
const { Schema } = mongoose;

mongoose.connect('mongodb://localhost:27017/erp_ani', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        const db = mongoose.connection.db;
        
        const stocks = await db.collection('stocks').find({ indianCnF: 'DIBAKAR' }).toArray();
        console.log('Stocks for DIBAKAR:', stocks.length);
        if (stocks.length > 0) {
            console.log('First stock status:', stocks[0].status);
            console.log('First stock indCnFCost:', stocks[0].indCnFCost);
            console.log('First stock indianCnF:', stocks[0].indianCnF);
            console.log('First stock totalLcTruck:', stocks[0].totalLcTruck);
        }

        const sales = await db.collection('sales').find({ indianCnF: 'DIBAKAR' }).toArray();
        console.log('\nSales for DIBAKAR:', sales.length);

        const cnfs = await db.collection('cnfs').find({ name: 'DIBAKAR' }).toArray();
        console.log('\nCnF record:', cnfs);

        mongoose.connection.close();
    });
