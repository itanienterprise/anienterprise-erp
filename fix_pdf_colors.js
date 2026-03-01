const fs = require('fs');

let content = fs.readFileSync('/Users/mdriyadahmed/Documents/ERP_ANI_Enterprise/client/src/utils/pdfGenerator.js', 'utf8');

// 1. Replace array-based text colors like textColor: [0, 0, 139] with textColor: [0, 0, 0]
content = content.replace(/textColor:\s*\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]/g, 'textColor: [0, 0, 0]');

// 2. Replace function-based text colors like doc.setTextColor(0, 0, 139) with doc.setTextColor(0)
// Be careful to not replace doc.setTextColor(0) or doc.setTextColor(255)
content = content.replace(/doc\.setTextColor\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g, 'doc.setTextColor(0)');
// also specific occurrences like doc.setTextColor(100) or doc.setTextColor(50) ? User said all black
// content = content.replace(/doc\.setTextColor\(\s*(?!0|255)\d+\s*\)/g, 'doc.setTextColor(0)');

// 3. Replace summary card colored backgrounds
// These are: doc.setFillColor(isBlue ? 239 : 249, isBlue ? 246 : 250, isBlue ? 255 : 251);
// -> doc.setFillColor(245, 245, 245);
content = content.replace(/doc\.setFillColor\(\s*isBlue\s*\?[^;]+;/g, 'doc.setFillColor(245, 245, 245);');
content = content.replace(/doc\.setDrawColor\(\s*isBlue\s*\?[^;]+;/g, 'doc.setDrawColor(200, 200, 200);');

// 4. Replace text colors in summary cards
// doc.setTextColor(isBlue ? 59 : 107, isBlue ? 130 : 114, isBlue ? 246 : 128);
content = content.replace(/doc\.setTextColor\(\s*isBlue\s*\?[^;]+;/g, 'doc.setTextColor(0);');
// doc.setTextColor(107, 114, 128); (gray)
content = content.replace(/doc\.setTextColor\(107,\s*114,\s*128\);/g, 'doc.setTextColor(0);');

// 5. Replace other specific instances:
// styles: { textColor: [220, 38, 38] } -> already caught by #1

fs.writeFileSync('/Users/mdriyadahmed/Documents/ERP_ANI_Enterprise/client/src/utils/pdfGenerator.js', content, 'utf8');
console.log('PDF colors updated successfully');
