import axios from 'axios';
const API_BASE_URL = 'http://localhost:5000'; // Adjust if needed

async function checkData() {
    try {
        const salesRes = await axios.get(`${API_BASE_URL}/api/sales`);
        const sales = salesRes.data;
        
        console.log("--- Sales with 'RANI CIKON' ---");
        sales.forEach(s => {
            const items = s.items || [];
            items.forEach(item => {
                const brandEntries = item.brandEntries || [];
                brandEntries.forEach(be => {
                    if (be.brand && be.brand.includes('RANI CIKON')) {
                        console.log(`Invoice: ${s.invoiceNo}, Status: ${s.status}, Qty: ${be.quantity}`);
                    }
                });
            });
        });
    } catch (err) {
        console.error("Error:", err.message);
    }
}
checkData();
