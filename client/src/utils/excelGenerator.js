import * as XLSX from 'xlsx';
import { formatDate } from './helpers';

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the Exporter Profile Transaction Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Object} exporter - Exporter details
 * @param {Array} records - List of filtered transaction records
 * @param {Object} filters - Active filter settings
 */
export const generateExporterProfileReportExcel = (exporter, records = [], filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['EXPORTER TRANSACTION REPORT']);
        rows.push([]);

        // 2. Report & Exporter Metadata
        const startStr = formatDate(filters?.startDate) === '-' ? 'Start' : formatDate(filters?.startDate);
        const endStr = formatDate(filters?.endDate) === '-' ? 'Present' : formatDate(filters?.endDate);
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);

        rows.push([
            'Exporter:',
            exporter?.name || '-',
            '',
            '',
            'Date Range:',
            `${startStr} to ${endStr}`,
            '',
            '',
            'Printed On:',
            dateStr
        ]);

        rows.push([
            'Contact Person:',
            exporter?.contactPerson || '-',
            '',
            '',
            'Phone:',
            exporter?.phone || '-',
            '',
            '',
            'BIN | TIN | IRC:',
            `${exporter?.bin || '-'} | ${exporter?.tin || '-'} | ${exporter?.irc || '-'}`
        ]);

        if (exporter?.address) {
            rows.push(['Office Address:', exporter.address]);
        }

        // Active filters row
        const filterBadges = [];
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.supplier) filterBadges.push(`Supplier: ${filters.supplier}`);
        if (filters?.product) filterBadges.push(`Product: ${filters.product}`);
        if (filters?.brand) filterBadges.push(`Brand: ${filters.brand}`);
        if (filters?.port) filterBadges.push(`Port: ${filters.port}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        rows.push([]); // Blank separator

        // 3. Table Headers
        const tableHeaders = [
            'Date',
            'Invoice No',
            'LC No',
            'Supplier',
            'Port',
            'Product',
            'Brand',
            'Total Bill',
            'Truck',
            'Bag',
            'Qty (KG)',
            'Rate (TK)',
            'Total (TK)',
            'Balance (TK)'
        ];
        rows.push(tableHeaders);

        // 4. Data Rows & Totals Calculation
        let totalBillSum = 0;
        let totalBagSum = 0;
        let totalQtySum = 0;
        let totalAmountSum = 0;
        let runningBalance = 0;

        (records || []).forEach((r) => {
            const rowTotal = (parseFloat(r.rate) || 0) * (parseFloat(r.qty) || 0);
            runningBalance += rowTotal;

            const bill = parseFloat(r.totalBill) || 0;
            const bag = parseFloat(r.bag) || 0;
            const qty = parseFloat(r.qty) || 0;
            const rate = parseFloat(r.rate) || 0;

            totalBillSum += bill;
            totalBagSum += bag;
            totalQtySum += qty;
            totalAmountSum += rowTotal;

            rows.push([
                formatDate(r.date),
                r.invoiceNo || '-',
                r.lcNo || '-',
                r.supplier || '-',
                r.port || '-',
                r.product || '-',
                r.brand || '-',
                bill > 0 ? (r.currency ? `${bill.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${r.currency}` : bill) : '-',
                r.truck || '-',
                bag > 0 ? Math.round(bag) : 0,
                qty > 0 ? Math.round(qty) : 0,
                rate > 0 ? rate : 0,
                rowTotal > 0 ? rowTotal : 0,
                (r.source !== 'sale' && runningBalance > 0) ? runningBalance : 0
            ]);
        });

        // 5. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            '',
            '',
            totalBillSum > 0 ? totalBillSum : '—',
            '—',
            totalBagSum > 0 ? Math.round(totalBagSum) : '—',
            totalQtySum > 0 ? Math.round(totalQtySum) : '—',
            '—',
            totalAmountSum > 0 ? totalAmountSum : '—',
            totalAmountSum > 0 ? totalAmountSum : '—'
        ]);

        // 6. Build Workbook & Worksheet
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Auto column widths
        ws['!cols'] = [
            { wch: 14 }, // Date
            { wch: 22 }, // Invoice No
            { wch: 20 }, // LC No
            { wch: 22 }, // Supplier
            { wch: 14 }, // Port
            { wch: 18 }, // Product
            { wch: 18 }, // Brand
            { wch: 18 }, // Total Bill
            { wch: 10 }, // Truck
            { wch: 12 }, // Bag
            { wch: 14 }, // Qty (KG)
            { wch: 14 }, // Rate (TK)
            { wch: 18 }, // Total (TK)
            { wch: 18 }  // Balance (TK)
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Exporter Report');

        // 7. Trigger Browser Download via Blob
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeName = (exporter?.name || 'Exporter')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 30);
        const fileName = `${safeName}_Transaction_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Excel report:', err);
        alert(`Failed to generate Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the Supplier Profile Transaction Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Object} supplier - Supplier details
 * @param {Array} records - List of filtered transaction records
 * @param {Object} filters - Active filter settings
 */
export const generateSupplierProfileReportExcel = (supplier, records = [], filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['SUPPLIER TRANSACTION REPORT']);
        rows.push([]);

        // 2. Metadata
        const startStr = formatDate(filters?.startDate) === '-' ? 'Start' : formatDate(filters?.startDate);
        const endStr = formatDate(filters?.endDate) === '-' ? 'Present' : formatDate(filters?.endDate);
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);

        const expList = Array.isArray(supplier?.exporters) && supplier.exporters.length > 0
            ? supplier.exporters.join(', ')
            : (supplier?.exporter || '-');

        rows.push([
            'Supplier:',
            supplier?.name || '-',
            '',
            '',
            'Date Range:',
            `${startStr} to ${endStr}`,
            '',
            '',
            'Printed On:',
            dateStr
        ]);

        rows.push([
            'Contact Person:',
            supplier?.contactPerson || '-',
            '',
            '',
            'Phone:',
            supplier?.phone || '-',
            '',
            '',
            'Associated Exporters:',
            expList
        ]);

        if (supplier?.address) {
            rows.push(['Office Address:', supplier.address]);
        }

        if (supplier?.email) {
            rows.push(['Email:', supplier.email]);
        }

        const filterBadges = [];
        if (filters?.product) filterBadges.push(`Product: ${filters.product}`);
        if (filters?.brand) filterBadges.push(`Brand: ${filters.brand}`);
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        rows.push([]);

        // 3. Table Headers
        const tableHeaders = [
            'Date',
            'Invoice No',
            'LC No',
            'Product',
            'Brand',
            'Invoice Qty (KG)',
            'Receive Qty (KG)',
            'Total Bill'
        ];
        rows.push(tableHeaders);

        // 4. Data Rows & Totals Calculation
        let totalInv = 0;
        let totalRec = 0;
        let totalBill = 0;

        (records || []).forEach((r) => {
            const invQty = parseFloat(r.invoiceQty) || 0;
            const recQty = parseFloat(r.receiveQty) || 0;
            const bill = parseFloat(r.totalBill) || 0;

            totalInv += invQty;
            totalRec += recQty;
            totalBill += bill;

            rows.push([
                formatDate(r.date),
                r.invoiceNo || '-',
                r.lcNo || '-',
                r.product || '-',
                r.brand || '-',
                invQty > 0 ? Math.round(invQty) : 0,
                recQty > 0 ? Math.round(recQty) : 0,
                bill > 0 ? (r.currency ? `${bill.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${r.currency}` : bill) : '-'
            ]);
        });

        // 5. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            totalInv > 0 ? Math.round(totalInv) : '—',
            totalRec > 0 ? Math.round(totalRec) : '—',
            totalBill > 0 ? totalBill : '—'
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 14 }, // Date
            { wch: 22 }, // Invoice No
            { wch: 20 }, // LC No
            { wch: 22 }, // Product
            { wch: 20 }, // Brand
            { wch: 18 }, // Invoice Qty
            { wch: 18 }, // Receive Qty
            { wch: 20 }  // Total Bill
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Supplier Report');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeName = (supplier?.name || 'Supplier')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 30);
        const fileName = `${safeName}_Transaction_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Supplier Excel report:', err);
        alert(`Failed to generate Supplier Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the Bank LC Bill History Report.
 * Matches all data, calculations, summary cards, and layout of the PDF and UI reports.
 * 
 * @param {Array} reportData - Filtered LC bill history records
 * @param {string} bankName - Name of the bank
 * @param {Object} filters - Active filter settings
 */
export const generateLcBillHistoryReportExcel = (reportData = [], bankName = '', filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['LC BILL HISTORY REPORT']);
        rows.push([]);

        // 2. Report & Bank Metadata
        let dateRangeStr = '';
        if (filters.quickRange && filters.quickRange !== 'all') {
            if (filters.quickRange === 'weekly') {
                dateRangeStr = 'Weekly (Current Week)';
            } else if (filters.quickRange === 'monthly') {
                const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthName = months[(filters.selectedMonth || new Date().getMonth() + 1) - 1];
                const year = filters.selectedYear || new Date().getFullYear();
                dateRangeStr = `${monthName} ${year}`;
            } else if (filters.quickRange === 'yearly') {
                const year = filters.selectedYear || new Date().getFullYear();
                dateRangeStr = `Year: ${year}`;
            } else if (filters.quickRange === 'custom') {
                const start = filters.startDate ? formatDate(filters.startDate) : 'Start';
                const end = filters.endDate ? formatDate(filters.endDate) : 'Present';
                dateRangeStr = `${start} to ${end}`;
            }
        } else if (filters.startDate || filters.endDate) {
            const start = filters.startDate ? formatDate(filters.startDate) : 'Start';
            const end = filters.endDate ? formatDate(filters.endDate) : 'Present';
            dateRangeStr = `${start} to ${end}`;
        }

        const dateStr = formatDate(new Date().toISOString().split('T')[0]);

        rows.push([
            'Bank Name:',
            bankName || '-',
            '',
            'Date Range:',
            dateRangeStr || 'All Records',
            '',
            'Printed On:',
            dateStr
        ]);

        const filterBadges = [];
        if (filters.billType) filterBadges.push(`Bill Type: ${filters.billType}`);
        if (filters.importer) filterBadges.push(`Importer: ${filters.importer}`);
        if (filters.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        // 3. Financial Summary Card
        const totalMarginPaid = reportData.reduce((s, r) => s + (parseFloat(r.marginPaid) || 0), 0);
        const totalMarginReturn = reportData.reduce((s, r) => s + (parseFloat(r.marginReturn) || 0), 0);
        const totalBankPaid = reportData.reduce((s, r) => s + (parseFloat(r.bankPaid) || 0), 0);

        rows.push([]);
        rows.push(['FINANCIAL SUMMARY']);
        rows.push(['Total Margin Paid (TK):', totalMarginPaid]);
        rows.push(['Total Margin Return (TK):', totalMarginReturn]);
        rows.push(['Total Bank Charge (TK):', totalBankPaid]);
        rows.push([]);

        // 4. Table Headers
        const tableHeaders = [
            'SL',
            'Date',
            'LC No',
            'Importer',
            'Bill Type',
            'Margin Paid (TK)',
            'Margin Return (TK)',
            'Bank Charge (TK)'
        ];
        rows.push(tableHeaders);

        // 5. Data Rows
        (reportData || []).forEach((row, idx) => {
            const mPaid = parseFloat(row.marginPaid) || 0;
            const mRet = parseFloat(row.marginReturn) || 0;
            const bPaid = parseFloat(row.bankPaid) || 0;

            rows.push([
                idx + 1,
                formatDate(row.date),
                row.lcNo && row.lcNo.length > 6 ? row.lcNo.slice(-6) : (row.lcNo || '-'),
                row.importer || '-',
                row.billType || '-',
                mPaid > 0 ? mPaid : 0,
                mRet > 0 ? mRet : 0,
                bPaid > 0 ? bPaid : 0
            ]);
        });

        // 6. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            totalMarginPaid > 0 ? totalMarginPaid : '—',
            totalMarginReturn > 0 ? totalMarginReturn : '—',
            totalBankPaid > 0 ? totalBankPaid : '—'
        ]);

        // 7. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 18 }, // LC No
            { wch: 28 }, // Importer
            { wch: 20 }, // Bill Type
            { wch: 22 }, // Margin Paid
            { wch: 22 }, // Margin Return
            { wch: 22 }  // Bank Charge
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'LC Bill History');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeName = (bankName || 'Bank')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 30);
        const fileName = `${safeName}_LC_Bill_History_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Bank LC Bill Excel report:', err);
        alert(`Failed to generate Bank Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the C&F Agent List Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} agents - Filtered C&F agents list
 * @param {string} moduleType - Module type ('Indian' or 'BD' or '')
 */
export const generateCnFAgentListReportExcel = (agents = [], moduleType = '') => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push([`${moduleType ? moduleType + ' ' : ''}C&F AGENT REPORT`]);
        rows.push([]);

        // 2. Metadata
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        rows.push([
            'Total Agents:',
            agents.length,
            '',
            '',
            'Printed On:',
            dateStr
        ]);
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = ['SL', 'ID', 'Name', 'Contact Person', 'Phone', 'Total Balance (TK)'];
        rows.push(tableHeaders);

        // 4. Data Rows & Total Calculation
        let grandTotal = 0;
        agents.forEach((agent, index) => {
            const balance = parseFloat(agent.totalBalance) || 0;
            grandTotal += balance;
            rows.push([
                index + 1,
                agent.cnfId || '-',
                agent.name || '-',
                agent.contactPerson || '-',
                agent.phone || '-',
                balance > 0 ? balance : 0
            ]);
        });

        // 5. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            grandTotal > 0 ? grandTotal : 0
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 16 }, // ID
            { wch: 30 }, // Name
            { wch: 24 }, // Contact Person
            { wch: 22 }, // Phone
            { wch: 24 }  // Total Balance
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'C&F Agent Report');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const prefix = (moduleType || 'CnF').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${prefix}_Agent_List_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting C&F Agent Excel report:', err);
        alert(`Failed to generate C&F Agent Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for C&F Agent History.
 * Supports all 4 view modes: 'earnings', 'expense', 'payments', and 'all'.
 * 
 * @param {string} mode - 'earnings' | 'expense' | 'payments' | 'all'
 * @param {Array} reportData - Records to export
 * @param {Object} agentInfo - { name, cnfId, phone }
 * @param {Object} filters - Active filter criteria
 */
export const generateCnFHistoryExcel = (mode = 'earnings', reportData = [], agentInfo = {}, filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);

        const modeTitles = {
            earnings: 'C&F EARNINGS REPORT',
            expense: 'C&F LC EXPENSE REPORT',
            payments: 'C&F PAYMENT HISTORY REPORT',
            all: 'C&F ALL TRANSACTIONS REPORT'
        };
        rows.push([modeTitles[mode] || 'C&F HISTORY REPORT']);
        rows.push([]);

        // 2. Agent Metadata
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        rows.push([
            'Agent ID:',
            agentInfo.cnfId || '-',
            '',
            'Agent Name:',
            agentInfo.name || '-',
            '',
            'Printed On:',
            dateStr
        ]);

        rows.push([
            'Contact No:',
            agentInfo.phone || '-'
        ]);

        const filterBadges = [];
        if (filters?.port) filterBadges.push(`Port: ${filters.port}`);
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.productName) filterBadges.push(`Product: ${filters.productName}`);
        if (filters?.startDate || filters?.endDate) {
            const start = formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate);
            const end = formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate);
            filterBadges.push(`Date: ${start} to ${end}`);
        }

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]);

        let cols = [];

        // 3. Table Rows based on mode
        if (mode === 'earnings') {
            rows.push(['Date', 'LC No', 'Importer', 'Exporter', 'Product', 'Port', 'Truck', 'BOE No', 'Qty', 'Commission', 'Total']);
            let totalTrucks = 0;
            let totalQty = 0;
            let totalCommission = 0;

            const sorted = [...reportData].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
            sorted.forEach(row => {
                const truck = parseFloat(row.truck) || 0;
                const qty = parseFloat(row.qty) || 0;
                const totComm = parseFloat(row.totalCommission) || 0;
                totalTrucks += truck;
                totalQty += qty;
                totalCommission += totComm;

                rows.push([
                    formatDate(row.date),
                    row.lcNo ? (row.lcNo.toString().length > 5 ? row.lcNo.toString().slice(-5) : row.lcNo.toString()) : '-',
                    row.importer || '-',
                    row.exporter || '-',
                    row.product || '-',
                    row.port || '-',
                    truck > 0 ? truck : 0,
                    row.billOfEntry || '-',
                    qty > 0 ? qty : 0,
                    (row.uom || '').toUpperCase() === 'BOE' ? '-' : (parseFloat(row.commission) || 0),
                    totComm > 0 ? totComm : 0
                ]);
            });

            rows.push([
                'GRAND TOTAL', '', '', '', '', '',
                totalTrucks > 0 ? totalTrucks : '—',
                '',
                totalQty > 0 ? totalQty : '—',
                '',
                totalCommission > 0 ? totalCommission : '—'
            ]);

            cols = [
                { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 18 },
                { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }
            ];
        } else if (mode === 'expense') {
            rows.push(['Billing Date', 'LC No', 'Importer', 'Product', 'Port', 'Amount']);
            let totalAmount = 0;

            reportData.forEach(row => {
                const amt = parseFloat(row.amount) || 0;
                totalAmount += amt;
                rows.push([
                    formatDate(row.date),
                    row.lcNo ? (row.lcNo.toString().length > 5 ? row.lcNo.toString().slice(-5) : row.lcNo.toString()) : '-',
                    row.importer || '-',
                    row.product || '-',
                    row.port || '-',
                    amt > 0 ? amt : 0
                ]);
            });

            rows.push(['GRAND TOTAL', '', '', '', '', totalAmount > 0 ? totalAmount : '—']);

            cols = [{ wch: 14 }, { wch: 14 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 20 }];
        } else if (mode === 'payments') {
            rows.push(['Date', 'Payment Method', 'Bank Name / Reference', 'Amount Paid', 'Discount']);
            let totalAmount = 0;
            let totalDiscount = 0;

            reportData.forEach(row => {
                const amt = parseFloat(row.amount) || 0;
                const disc = parseFloat(row.discount) || 0;
                totalAmount += amt;
                totalDiscount += disc;

                rows.push([
                    formatDate(row.date),
                    row.method || '-',
                    row.bankName ? (row.reference ? `${row.reference} / ${row.bankName}` : row.bankName) : (row.reference || '-'),
                    amt > 0 ? amt : 0,
                    disc > 0 ? disc : 0
                ]);
            });

            rows.push(['GRAND TOTAL', '', '', totalAmount > 0 ? totalAmount : '—', totalDiscount > 0 ? totalDiscount : '—']);

            cols = [{ wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 18 }];
        } else {
            // 'all'
            rows.push(['Date', 'LC No', 'Importer', 'Product', 'Port', 'Qty (KG)', 'Truck', 'Billing Amount', 'Method', 'Bank / Reference', 'Paid', 'Discount', 'Balance']);
            let totalBilling = 0;
            let totalPaid = 0;
            let totalDiscount = 0;

            reportData.forEach(row => {
                const billing = parseFloat(row.billingAmount) || 0;
                const paid = parseFloat(row.amount) || 0;
                const disc = parseFloat(row.discount) || 0;
                totalBilling += billing;
                totalPaid += paid;
                totalDiscount += disc;

                rows.push([
                    formatDate(row.date),
                    row.lcNo ? (row.lcNo.toString().length > 5 ? row.lcNo.toString().slice(-5) : row.lcNo.toString()) : '-',
                    row.importer || '-',
                    row.product || '-',
                    row.port || '-',
                    row.qty ? `${row.qty} kg` : '-',
                    row.truckCount || '-',
                    billing > 0 ? billing : 0,
                    row.method || '-',
                    row.bankName ? (row.reference ? `${row.reference} / ${row.bankName}` : row.bankName) : (row.reference || '-'),
                    paid > 0 ? paid : 0,
                    disc > 0 ? disc : 0,
                    row.runningBalance !== undefined ? row.runningBalance : 0
                ]);
            });

            rows.push([
                'GRAND TOTAL', '', '', '', '', '', '',
                totalBilling > 0 ? totalBilling : '—',
                '', '',
                totalPaid > 0 ? totalPaid : '—',
                totalDiscount > 0 ? totalDiscount : '—',
                ''
            ]);

            cols = [
                { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 16 },
                { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 26 },
                { wch: 16 }, { wch: 16 }, { wch: 18 }
            ];
        }

        // 4. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = cols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Agent History');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeAgent = (agentInfo.name || 'Agent').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
        const fileName = `${safeAgent}_${mode}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting C&F History Excel report:', err);
        alert(`Failed to generate C&F History Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for C&F Payment Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} payments - Filtered payments list
 * @param {Object} filters - Active filter settings
 */
export const generateCnFPaymentsListReportExcel = (payments = [], filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['C&F PAYMENT REPORT']);
        rows.push([]);

        // 2. Metadata
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        rows.push([
            'Total Records:',
            payments.length,
            '',
            '',
            'Printed On:',
            dateStr
        ]);

        const filterBadges = [];
        if (filters?.cnfName) filterBadges.push(`C&F Agent: ${filters.cnfName}`);
        if (filters?.type || filters?.cnfType) filterBadges.push(`Type: ${filters.type || filters.cnfType}`);
        if (filters?.startDate || filters?.endDate) {
            const start = formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate);
            const end = formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate);
            filterBadges.push(`Date: ${start} to ${end}`);
        }

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = ['SL', 'Date', 'C&F Agent', 'Type', 'Method', 'Reference / Bank', 'Amount (TK)', 'Discount (TK)'];
        rows.push(tableHeaders);

        // 4. Data Rows & Total Calculation
        let totalAmount = 0;
        let totalDiscount = 0;

        payments.forEach((p, index) => {
            const amt = parseFloat(p.amount) || 0;
            const disc = parseFloat(p.discount) || 0;
            totalAmount += amt;
            totalDiscount += disc;

            const refBank = p.bankName ? (p.reference ? `${p.bankName} (${p.reference})` : p.bankName) : (p.reference || '-');
            const billRange = (p.billFrom && p.billTo) ? ` (${formatDate(p.billFrom)} - ${formatDate(p.billTo)})` : '';

            rows.push([
                index + 1,
                formatDate(p.date),
                p.cnfName || '-',
                p.cnfType || '-',
                p.method || '-',
                refBank + billRange,
                amt > 0 ? amt : 0,
                disc > 0 ? disc : 0
            ]);
        });

        // 5. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            '',
            totalAmount > 0 ? totalAmount : 0,
            totalDiscount > 0 ? totalDiscount : 0
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 24 }, // C&F Agent
            { wch: 14 }, // Type
            { wch: 16 }, // Method
            { wch: 32 }, // Reference / Bank
            { wch: 18 }, // Amount
            { wch: 18 }  // Discount
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'C&F Payments');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `CnF_Payment_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting C&F Payment Excel report:', err);
        alert(`Failed to generate C&F Payment Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for IP Management Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} reportData - Filtered IP records
 * @param {Object} totals - Precalculated totals (quantity, remainingQuantity, ipBalance, totalLcCount)
 * @param {string} searchQuery - Current search filter text
 * @param {Object} filters - Active filter settings (startDate, endDate, importer, port, productName)
 */
export const generateIPManagementReportExcel = (reportData = [], totals = {}, searchQuery = '', filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['IP MANAGEMENT REPORT']);
        rows.push([]);

        // 2. Metadata
        const currentDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Date Range:',
            `${start} to ${end}`,
            '',
            '',
            'Printed On:',
            currentDateStr
        ]);

        const filterBadges = [];
        if (searchQuery) filterBadges.push(`Search: "${searchQuery}"`);
        if (filters.importer) filterBadges.push(`Importer: ${filters.importer}`);
        if (filters.port) filterBadges.push(`Port: ${filters.port}`);
        if (filters.productName) filterBadges.push(`Product: ${filters.productName}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = [
            'SL',
            'Date',
            'Close Date',
            'IP Number',
            'Reference No',
            'Importer',
            'Port',
            'Product Name',
            'Quantity (KG)',
            'LC Rem (KG)',
            'IP Balance (KG)',
            'Total LC',
            'Status'
        ];
        rows.push(tableHeaders);

        // 4. Data Rows
        reportData.forEach((record, index) => {
            rows.push([
                index + 1,
                formatDate(record.openingDate),
                formatDate(record.closeDate),
                String(record.ipNumber || '-').trim(),
                String(record.referenceNo || '-').trim(),
                String(record.ipParty || '-').trim(),
                String(record.port || '-').trim(),
                String(record.productName || '-').trim(),
                parseFloat(record.quantity) || 0,
                parseFloat(record.remainingQuantity) || 0,
                parseFloat(record.ipBalance) || 0,
                parseInt(record.totalLcCount) || 0,
                String(record.computedStatus || record.status || 'Active')
            ]);
        });

        // 5. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            totals.totalQuantity || 0,
            totals.totalRemainingQuantity || 0,
            totals.totalIpBalance || 0,
            totals.totalLcCount || 0,
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 6 },  // SL
            { wch: 14 }, // Date
            { wch: 14 }, // Close Date
            { wch: 20 }, // IP Number
            { wch: 16 }, // Ref No
            { wch: 28 }, // Importer
            { wch: 18 }, // Port
            { wch: 26 }, // Product Name
            { wch: 18 }, // Quantity
            { wch: 18 }, // LC Rem
            { wch: 18 }, // IP Balance
            { wch: 12 }, // Total LC
            { wch: 14 }  // Status
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'IP Management');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `IP_Management_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting IP Management Excel report:', err);
        alert(`Failed to generate IP Management Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for Insurance Payment Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} payments - Filtered insurance payments
 * @param {Object} filters - Active filter settings (startDate, endDate, companyName)
 * @param {Array} lcs - LC records list for gross premium and expected return mapping
 */
export const generateInsurancePaymentReportExcel = (payments = [], filters = {}, lcs = []) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['INSURANCE PAYMENT REPORT']);
        rows.push([]);

        // 2. Metadata
        const currentDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const dateRangeStr = (filters?.startDate || filters?.endDate)
            ? `${filters.startDate ? formatDate(filters.startDate) : 'Start'} to ${filters.endDate ? formatDate(filters.endDate) : 'Present'}`
            : 'All Time';

        rows.push([
            'Date Range:',
            dateRangeStr,
            '',
            '',
            'Printed On:',
            currentDateStr
        ]);

        const filterBadges = [];
        if (filters?.companyName) filterBadges.push(`Company: ${filters.companyName}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        rows.push(['Total Records:', payments.length]);
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = [
            'SL',
            'Date',
            'Insurance Company',
            'LC No',
            'Method',
            'Reference',
            'Gross Premium (TK)',
            'Return Amount (TK)',
            'Paid (TK)',
            'Adjusted (TK)',
            'Status'
        ];
        rows.push(tableHeaders);

        // 4. Data Rows & Total Calculation
        let totalPaid = 0;
        let totalAdjusted = 0;

        const sortedPayments = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date));
        sortedPayments.forEach((p, idx) => {
            const lc = (lcs || []).find(l => l.lcNo === p.lcNo);
            const paidVal = p.type === 'Return Collection' ? 0 : (parseFloat(p.amount) || 0);
            const adjVal = parseFloat(p.adjustedAmount) || 0;
            const grossPrem = lc ? (parseFloat(lc.grossPremium) || 0) : 0;
            const returnAmt = (p.isAdjustReturn || p.type === 'Return Collection')
                ? (lc ? (parseFloat(lc.expectedReturnAmount) || 0) : 0)
                : 0;

            totalPaid += paidVal;
            totalAdjusted += adjVal;

            rows.push([
                idx + 1,
                formatDate(p.date),
                p.companyName || '-',
                p.lcNo || '-',
                p.method || '-',
                (p.reference || '').trim() || '-',
                grossPrem > 0 ? grossPrem : '-',
                returnAmt > 0 ? returnAmt : 0,
                paidVal > 0 ? paidVal : 0,
                adjVal > 0 ? adjVal : '-',
                p.status || 'Adjusted'
            ]);
        });

        // 5. Grand Total Row
        rows.push([
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            totalPaid > 0 ? totalPaid : 0,
            totalAdjusted > 0 ? totalAdjusted : 0,
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 6 },  // SL
            { wch: 14 }, // Date
            { wch: 28 }, // Insurance Company
            { wch: 18 }, // LC No
            { wch: 14 }, // Method
            { wch: 18 }, // Reference
            { wch: 20 }, // Gross Premium
            { wch: 20 }, // Return Amount
            { wch: 18 }, // Paid
            { wch: 18 }, // Adjusted
            { wch: 14 }  // Status
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Insurance Payments');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `Insurance_Payment_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Insurance Payment Excel report:', err);
        alert(`Failed to generate Insurance Payment Excel report: ${err.message}`);
    }
};







