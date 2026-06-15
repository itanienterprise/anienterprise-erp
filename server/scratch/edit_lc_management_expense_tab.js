const fs = require('fs');
const path = '/Users/mdriyadahmed/Documents/anienterprise-erp/client/src/components/modules/LCManagement/LCManagement.jsx';

let content = fs.readFileSync(path, 'utf8');

// Let's replace the first occurrence (Line 1556)
const target1 = `                                                    const filtered = [...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill')];`;
const replacement1 = `                                                    const filtered = [
                                                        ...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill'),
                                                        ...insurancePayments.filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection').map(p => ({
                                                            _id: p._id,
                                                            date: p.date,
                                                            expenseHead: 'Insurance Premium',
                                                            name: p.companyName || 'Insurance',
                                                            amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
                                                            remarks: p.remarks || 'Premium Payment'
                                                        }))
                                                    ];`;

// Let's replace the second occurrence (Line 1623)
const target2 = `                                                             const filtered = [...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill')];`;
const replacement2 = `                                                             const filtered = [
                                                                 ...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill'),
                                                                 ...insurancePayments.filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection').map(p => ({
                                                                     _id: p._id,
                                                                     date: p.date,
                                                                     expenseHead: 'Insurance Premium',
                                                                     name: p.companyName || 'Insurance',
                                                                     amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
                                                                     remarks: p.remarks || 'Premium Payment'
                                                                 }))
                                                             ];`;

// Let's replace the third occurrence (Line 1653)
const target3 = `                                            const filtered = [...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill')];`;
const replacement3 = `                                            const filtered = [
                                                ...lcExpenses.filter(exp => exp.lcNo === data.lcNo && exp.type !== 'bill'),
                                                ...insurancePayments.filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection').map(p => ({
                                                    _id: p._id,
                                                    date: p.date,
                                                    expenseHead: 'Insurance Premium',
                                                    name: p.companyName || 'Insurance',
                                                    amount: (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0),
                                                    remarks: p.remarks || 'Premium Payment'
                                                }))
                                            ];`;

const normalizeNewline = (str) => str.replace(/\r?\n/g, '\n');

let normalizedContent = normalizeNewline(content);

if (!normalizedContent.includes(normalizeNewline(target1))) {
    console.error('Target 1 not found!');
} else {
    normalizedContent = normalizedContent.replace(normalizeNewline(target1), normalizeNewline(replacement1));
    console.log('Target 1 replaced!');
}

if (!normalizedContent.includes(normalizeNewline(target2))) {
    console.error('Target 2 not found!');
} else {
    normalizedContent = normalizedContent.replace(normalizeNewline(target2), normalizeNewline(replacement2));
    console.log('Target 2 replaced!');
}

if (!normalizedContent.includes(normalizeNewline(target3))) {
    console.error('Target 3 not found!');
} else {
    normalizedContent = normalizedContent.replace(normalizeNewline(target3), normalizeNewline(replacement3));
    console.log('Target 3 replaced!');
}

if (content.includes('\r\n')) {
    normalizedContent = normalizedContent.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, normalizedContent, 'utf8');
console.log('Replacement finished!');
