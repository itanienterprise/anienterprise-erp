import axios from 'axios';
import { calculateStockData } from './utils/stockHelpers.js';

async function test() {
    try {
        const [stockRes, salesRes, productsRes] = await Promise.all([
            axios.get('http://localhost:5000/api/stock'),
            axios.get('http://localhost:5000/api/sales'),
            axios.get('http://localhost:5000/api/products')
        ]);
        
        const result = calculateStockData(stockRes.data, {}, '', [], salesRes.data, productsRes.data);
        console.log("Total Sales Qty:", result.totalSaleQty);
        result.displayRecords.forEach(record => {
            console.log(record.productName, "Sale Qty:", record.saleQuantity);
        });
    } catch (e) {
        console.error(e.message);
    }
}
test();
