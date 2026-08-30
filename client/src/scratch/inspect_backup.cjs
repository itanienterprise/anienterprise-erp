const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '../../../server/backups/backup-pre_stock_baseline-2026-08-29T18-16-25-198Z.json');
const raw = fs.readFileSync(backupPath, 'utf8');
const backup = JSON.parse(raw);
console.log('data keys:', Object.keys(backup.data || {}));
console.log('stock items count:', (backup.data.Stock || []).length);
console.log('warehouse items count:', (backup.data.Warehouse || []).length);
