const CryptoJS = require('crypto-js');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: 'server/.env' });

const { encryptData, decryptData } = require('../server/src/utils/encryption');
const SECRET_KEY = process.env.SECRET_KEY || 'ani1820';

const genericSchema = new mongoose.Schema({
    data: String
}, { timestamps: true });

const LCExpense = mongoose.model('LCExpense', genericSchema);
const CnFPayment = mongoose.model('CnFPayment', genericSchema);

function generateSignature(payload, timestamp) {
    const dataToSign = `${JSON.stringify(payload)}|${timestamp}`;
    return CryptoJS.HmacSHA256(dataToSign, SECRET_KEY).toString();
}

async function makeRequest(url, method, data = null, cookie = '') {
    const timestamp = Date.now().toString();
    const gatewayPayload = {
        p: url,
        m: method.toUpperCase(),
        d: data || {}
    };

    const signature = generateSignature(gatewayPayload, timestamp);
    const encryptedBody = { payload: encryptData(gatewayPayload) };

    const headers = {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature
    };
    if (cookie) {
        headers['Cookie'] = cookie;
    }

    const options = {
        method: 'POST',
        headers,
        body: JSON.stringify(encryptedBody)
    };

    const res = await fetch(`http://localhost:5000/v`, options);
    const responseHeaders = res.headers;
    const json = await res.json();
    
    let decrypted = null;
    if (json && json.payload) {
        decrypted = decryptData(json.payload);
    } else {
        decrypted = json;
    }

    return {
        status: res.status,
        data: decrypted,
        headers: responseHeaders
    };
}

async function runTests() {
    try {
        console.log('Logging in as admin...');
        const loginRes = await makeRequest('/api/auth/login', 'POST', { username: 'admin', password: 'admin123' });
        if (loginRes.status !== 200 || !loginRes.data.success) {
            console.error('Login failed:', loginRes.data);
            process.exit(1);
        }
        console.log('Login successful.');

        const rawCookie = loginRes.headers.get('set-cookie');
        // Extract session cookie
        const cookie = rawCookie ? rawCookie.split(';')[0] : '';
        console.log('Session Cookie acquired:', cookie ? 'YES' : 'NO');

        // Connect mongoose to verify DB directly
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db');
        console.log('Connected to MongoDB directly for validation.');

        // Step 1: Create an LC Expense for C&F Commission payment
        console.log('\n--- Test 1: Create LC Expense (C&F Commission Payment) ---');
        const expenseBody = {
            expenseHead: 'C&F Commission',
            cnfAgent: 'abc',
            lcNo: 'L1001',
            type: 'payment',
            amount: 5000,
            date: '2026-06-15',
            remarks: 'LC Expense Payment Test'
        };
        const createRes = await makeRequest('/api/lc-expenses', 'POST', expenseBody, cookie);
        console.log('LC Expense Created:', createRes.data);
        const expenseId = createRes.data._id;
        if (!expenseId) {
            throw new Error('Failed to create LC Expense');
        }

        // Wait a small amount of time for any async ops if any
        await new Promise(r => setTimeout(r, 500));

        // Verify CnFPayment was created
        let payments = await CnFPayment.find();
        let linkedPayment = payments.map(p => {
            const d = decryptData(p.data);
            return { ...d, _id: p._id };
        }).find(p => p.lcExpenseId === expenseId);

        if (!linkedPayment) {
            throw new Error('Verification failed: Linked C&F Payment not found in database!');
        }
        console.log('Verified: Linked C&F Payment found:', linkedPayment);
        if (linkedPayment.amount !== 5000 || linkedPayment.cnfName !== 'abc') {
            throw new Error('Verification failed: C&F Payment amount or agent does not match!');
        }

        // Step 2: Edit LC Expense Amount
        console.log('\n--- Test 2: Edit LC Expense Amount ---');
        const updatedExpenseBody = {
            ...expenseBody,
            amount: 7500
        };
        const updateRes = await makeRequest(`/api/lc-expenses/${expenseId}`, 'PUT', updatedExpenseBody, cookie);
        console.log('LC Expense Updated:', updateRes.data);

        await new Promise(r => setTimeout(r, 500));

        payments = await CnFPayment.find();
        linkedPayment = payments.map(p => {
            const d = decryptData(p.data);
            return { ...d, _id: p._id };
        }).find(p => p.lcExpenseId === expenseId);

        if (!linkedPayment || linkedPayment.amount !== 7500) {
            throw new Error(`Verification failed: Linked C&F Payment amount was not updated! Got: ${linkedPayment ? linkedPayment.amount : 'null'}`);
        }
        console.log('Verified: Linked C&F Payment amount updated to:', linkedPayment.amount);

        // Step 3: Edit LC Expense to non-C&F head
        console.log('\n--- Test 3: Edit LC Expense to non-C&F head ---');
        const nonCnfExpenseBody = {
            ...expenseBody,
            expenseHead: 'Other',
            amount: 7500
        };
        const updateNonCnfRes = await makeRequest(`/api/lc-expenses/${expenseId}`, 'PUT', nonCnfExpenseBody, cookie);
        console.log('LC Expense Head Updated to Other:', updateNonCnfRes.data);

        await new Promise(r => setTimeout(r, 500));

        payments = await CnFPayment.find();
        linkedPayment = payments.map(p => {
            const d = decryptData(p.data);
            return { ...d, _id: p._id };
        }).find(p => p.lcExpenseId === expenseId);

        if (linkedPayment) {
            throw new Error('Verification failed: Linked C&F Payment was not deleted when head changed to Other!');
        }
        console.log('Verified: Linked C&F Payment was deleted successfully.');

        // Step 4: Edit LC Expense back to C&F Commission payment
        console.log('\n--- Test 4: Edit LC Expense back to C&F Commission ---');
        const updateBackRes = await makeRequest(`/api/lc-expenses/${expenseId}`, 'PUT', expenseBody, cookie);
        console.log('LC Expense Head Updated back:', updateBackRes.data);

        await new Promise(r => setTimeout(r, 500));

        payments = await CnFPayment.find();
        linkedPayment = payments.map(p => {
            const d = decryptData(p.data);
            return { ...d, _id: p._id };
        }).find(p => p.lcExpenseId === expenseId);

        if (!linkedPayment) {
            throw new Error('Verification failed: Linked C&F Payment was not recreated!');
        }
        console.log('Verified: Linked C&F Payment recreated:', linkedPayment);
        const paymentId = linkedPayment._id.toString();

        // Step 5: Edit Linked CnF Payment via PUT /api/cnf-payments/:id
        console.log('\n--- Test 5: Edit Linked CnF Payment ---');
        const updatedPaymentBody = {
            cnfId: linkedPayment.cnfId,
            cnfName: linkedPayment.cnfName,
            cnfType: linkedPayment.cnfType,
            date: linkedPayment.date,
            method: 'Cash',
            amount: 8000,
            discount: 0,
            reference: 'L1001',
            remarks: 'Updated from Payment Module',
            lcExpenseId: expenseId
        };
        const updatePayRes = await makeRequest(`/api/cnf-payments/${paymentId}`, 'PUT', updatedPaymentBody, cookie);
        console.log('CnF Payment Updated:', updatePayRes.data);

        await new Promise(r => setTimeout(r, 500));

        const expDoc = await LCExpense.findById(expenseId);
        if (!expDoc) {
            throw new Error('Verification failed: LC Expense was deleted instead of updated!');
        }
        const decExp = decryptData(expDoc.data);
        if (decExp.amount !== 8000) {
            throw new Error(`Verification failed: LC Expense amount was not updated to 8000! Got: ${decExp.amount}`);
        }
        console.log('Verified: LC Expense amount updated to:', decExp.amount);

        // Step 6: Delete CnF Payment via DELETE /api/cnf-payments/:id
        console.log('\n--- Test 6: Delete CnF Payment ---');
        const deletePayRes = await makeRequest(`/api/cnf-payments/${paymentId}`, 'DELETE', {}, cookie);
        console.log('CnF Payment Deleted:', deletePayRes.data);

        await new Promise(r => setTimeout(r, 500));

        const deletedExpDoc = await LCExpense.findById(expenseId);
        if (deletedExpDoc) {
            throw new Error('Verification failed: LC Expense was not deleted when linked C&F Payment was deleted!');
        }
        console.log('Verified: LC Expense was also deleted successfully.');

        // Step 7: Create another LC Expense, then delete it directly
        console.log('\n--- Test 7: Delete LC Expense Directly ---');
        const createRes2 = await makeRequest('/api/lc-expenses', 'POST', expenseBody, cookie);
        const expenseId2 = createRes2.data._id;
        console.log('Second LC Expense Created:', expenseId2);

        await new Promise(r => setTimeout(r, 500));

        payments = await CnFPayment.find();
        linkedPayment = payments.map(p => {
            const d = decryptData(p.data);
            return { ...d, _id: p._id };
        }).find(p => p.lcExpenseId === expenseId2);

        if (!linkedPayment) {
            throw new Error('Verification failed: Linked C&F Payment not found for second expense!');
        }
        const paymentId2 = linkedPayment._id.toString();
        console.log('Second linked C&F Payment found:', paymentId2);

        const deleteExpRes2 = await makeRequest(`/api/lc-expenses/${expenseId2}`, 'DELETE', {}, cookie);
        console.log('LC Expense Deleted:', deleteExpRes2.data);

        await new Promise(r => setTimeout(r, 500));

        const payDoc2 = await CnFPayment.findById(paymentId2);
        if (payDoc2) {
            throw new Error('Verification failed: Linked C&F Payment was not deleted when LC Expense was deleted!');
        }
        console.log('Verified: Linked C&F Payment was also deleted successfully.');

        console.log('\n=====================================');
        console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉');
        console.log('=====================================');
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

runTests();
