const fs = require('fs');
const path = '/Users/mdriyadahmed/Documents/anienterprise-erp/client/src/components/modules/LCManagement/LCManagement.jsx';

let content = fs.readFileSync(path, 'utf8');

const targetInsurancePaid = `    // 3. Insurance Bill
    const insBillAmt = parseFloat(data.grossPremium || data.netPremium) || 0;
    if (insBillAmt > 0) {
        const paidAmt = insurancePayments
            .filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);`;

const replacementInsurancePaid = `    // 3. Insurance Bill
    const insBillAmt = parseFloat(data.grossPremium || data.netPremium) || 0;
    if (insBillAmt > 0) {
        const paidAmt = insurancePayments
            .filter(p => p.lcNo === data.lcNo && p.type !== 'Return Collection')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0) + (parseFloat(p.adjustedAmount) || 0), 0);`;

const normalizeNewline = (str) => str.replace(/\r?\n/g, '\n');

let normalizedContent = normalizeNewline(content);
const normTarget = normalizeNewline(targetInsurancePaid);

if (!normalizedContent.includes(normTarget)) {
    console.error('Target insurance paid calculation block not found!');
} else {
    normalizedContent = normalizedContent.replace(normTarget, normalizeNewline(replacementInsurancePaid));
    console.log('Insurance paid calculation block replaced!');
}

if (content.includes('\r\n')) {
    normalizedContent = normalizedContent.replace(/\n/g, '\r\n');
}

fs.writeFileSync(path, normalizedContent, 'utf8');
console.log('Replacement finished!');
