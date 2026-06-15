const fs = require('fs');
const content = fs.readFileSync('/Users/mdriyadahmed/Documents/anienterprise-erp/client/src/components/modules/LCManagement/LCManagement.jsx', 'utf8');
const lines = content.split('\n');
for (let i = 7035; i <= 7055; i++) {
    console.log(`${i}: ${JSON.stringify(lines[i - 1])}`);
}
