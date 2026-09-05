import * as XLSX from 'xlsx';
import { formatDate, computeCustomerBalance, getLocalDateString, getIsoDateString } from './helpers';
import { calculateStockData } from './stockHelpers';

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

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for LC Management (General Report).
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} reportData - Formatted LC records
 * @param {Object} totals - Calculated grand totals
 * @param {string} searchQuery - Current search filter text
 * @param {Object} filters - Active filter criteria
 */
export const generateLCManagementReportExcel = (reportData = [], totals = {}, searchQuery = '', filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['LC MANAGEMENT REPORT (GENERAL)']);
        rows.push([]);

        // 2. Metadata
        const currentDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

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
        if (filters?.importerName) filterBadges.push(`Importer: ${filters.importerName}`);
        if (filters?.exporterName) filterBadges.push(`Exporter: ${filters.exporterName}`);
        if (filters?.port) filterBadges.push(`Port: ${filters.port}`);
        if (filters?.productName) filterBadges.push(`Product: ${filters.productName}`);
        if (filters?.bankName) filterBadges.push(`Bank: ${filters.bankName}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = [
            'SL',
            'Date',
            'L.S. Date',
            'LC No',
            'Importer',
            'Exporter',
            'Bank',
            'Port',
            'Product',
            'Quantity (KG)',
            'LC Receive (KG)',
            'LC Balance (KG)',
            'Total Value (TK)',
            'Expense (TK)',
            'Status'
        ];
        rows.push(tableHeaders);

        // 4. Data Rows
        reportData.forEach((record, index) => {
            rows.push([
                index + 1,
                formatDate(record.openingDate),
                formatDate(record.latestShipmentDate),
                String(record.lcNo || '-').trim(),
                String(record.importerName || '-').trim(),
                String(record.exporterName || '-').trim(),
                String(record.bankName || '-').trim(),
                String(record.port || '-').trim(),
                String(record.product || '-').trim(),
                parseFloat(record.qty) || 0,
                parseFloat(record.received) || 0,
                parseFloat(record.bal) || 0,
                parseFloat(record.val) || 0,
                record.exp > 0 ? parseFloat(record.exp) : 0,
                String(record.status || 'Opened')
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
            '',
            totals.totalQty || 0,
            totals.totalReceived || 0,
            totals.totalBal || 0,
            totals.totalVal || 0,
            totals.totalExp || 0,
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 6 },  // SL
            { wch: 14 }, // Date
            { wch: 14 }, // L.S. Date
            { wch: 18 }, // LC No
            { wch: 26 }, // Importer
            { wch: 26 }, // Exporter
            { wch: 16 }, // Bank
            { wch: 16 }, // Port
            { wch: 24 }, // Product
            { wch: 16 }, // Qty
            { wch: 16 }, // Received
            { wch: 16 }, // Balance
            { wch: 18 }, // Total Value
            { wch: 16 }, // Expense
            { wch: 14 }  // Status
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'General Report');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `LC_General_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting LC Management General Excel report:', err);
        alert(`Failed to generate LC General Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for LC Bill Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} reportData - Formatted LC bill records
 * @param {Object} totals - Calculated grand totals
 * @param {string} searchQuery - Current search filter text
 * @param {Object} filters - Active filter criteria
 */
export const generateLCBillReportExcel = (reportData = [], totals = {}, searchQuery = '', filters = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['LC BILL REPORT']);
        rows.push([]);

        // 2. Metadata
        const currentDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

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
        if (filters?.importerName) filterBadges.push(`Importer: ${filters.importerName}`);
        if (filters?.exporterName) filterBadges.push(`Exporter: ${filters.exporterName}`);
        if (filters?.port) filterBadges.push(`Port: ${filters.port}`);
        if (filters?.productName) filterBadges.push(`Product: ${filters.productName}`);
        if (filters?.bankName) filterBadges.push(`Bank: ${filters.bankName}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = [
            'SL',
            'Date',
            'LC No',
            'Importer',
            'Exporter',
            'Bank',
            'Product',
            'Bank Bill (TK)',
            'Margin Bill (TK)',
            'C&F Bill (TK)',
            'Insu. Bill (TK)',
            'Other (TK)',
            'Total Bill (TK)',
            'Paid Bill (TK)',
            'Remarks'
        ];
        rows.push(tableHeaders);

        // 4. Data Rows
        const sortedReportData = [...reportData].sort((a, b) => new Date(a.date || a.openingDate || 0) - new Date(b.date || b.openingDate || 0));

        sortedReportData.forEach((record, index) => {
            rows.push([
                index + 1,
                formatDate(record.date),
                String(record.lcNo || '-').trim(),
                String(record.importer || '-').trim(),
                String(record.exporter || '-').trim(),
                String(record.bank || '-').trim(),
                String(record.product || '-').trim(),
                record.bankCharges > 0 ? record.bankCharges : 0,
                record.marginBill > 0 ? record.marginBill : 0,
                record.cnfBill > 0 ? record.cnfBill : 0,
                record.insuranceBill > 0 ? record.insuranceBill : 0,
                record.other > 0 ? record.other : 0,
                record.totalBill > 0 ? record.totalBill : 0,
                record.paidBill > 0 ? record.paidBill : 0,
                record.remarks || '-'
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
            totals.totalBankCharges || 0,
            totals.totalMarginBill || 0,
            totals.totalCnfBill || 0,
            totals.totalInsuranceBill || 0,
            totals.totalOther || 0,
            totals.totalBill || 0,
            totals.totalPaidBill || 0,
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 6 },  // SL
            { wch: 14 }, // Date
            { wch: 18 }, // LC No
            { wch: 26 }, // Importer
            { wch: 26 }, // Exporter
            { wch: 16 }, // Bank
            { wch: 22 }, // Product
            { wch: 16 }, // Bank Bill
            { wch: 16 }, // Margin Bill
            { wch: 16 }, // C&F Bill
            { wch: 16 }, // Insu. Bill
            { wch: 14 }, // Other
            { wch: 18 }, // Total Bill
            { wch: 18 }, // Paid Bill
            { wch: 24 }  // Remarks
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bill Report');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `LC_Bill_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting LC Bill Excel report:', err);
        alert(`Failed to generate LC Bill Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for LC Expense Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} expenses - Filtered and enriched LC expenses
 * @param {Object} filters - Active filter settings
 * @param {string} searchQuery - Search query string
 */
export const generateLCExpenseReportExcel = (expenses = [], filters = {}, searchQuery = '') => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['LC EXPENSE REPORT']);
        rows.push([]);

        // 2. Metadata
        const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Date Range:',
            `${start} to ${end}`,
            '',
            '',
            'Printed On:',
            printDateStr
        ]);

        const filterBadges = [];
        if (searchQuery) filterBadges.push(`Search: "${searchQuery}"`);
        if (filters?.expenseHead) filterBadges.push(`Expense Head: ${filters.expenseHead}`);
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.bankName) filterBadges.push(`Bank: ${filters.bankName}`);
        if (filters?.cnfAgent) filterBadges.push(`C&F Agent: ${filters.cnfAgent}`);
        if (filters?.insuranceCompany) filterBadges.push(`Insurance Co: ${filters.insuranceCompany}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        rows.push(['Total Records:', expenses.length]);
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = ['SL', 'Date', 'LC No', 'Expense Head', 'Name', 'Remarks', 'Amount (TK)'];
        rows.push(tableHeaders);

        // 4. Data Rows & Total Calculation
        const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));
        let grandTotal = 0;

        sortedExpenses.forEach((exp, idx) => {
            const amt = parseFloat(exp.amount) || 0;
            grandTotal += amt;

            rows.push([
                idx + 1,
                formatDate(exp.date),
                String(exp.lcNo || '-').trim(),
                String(exp.expenseHead || '-').trim(),
                String(exp.displayName || exp.name || exp.bankName || exp.cnfAgent || '-').trim(),
                String(exp.remarks || exp.description || '-').trim(),
                amt > 0 ? amt : 0
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
            grandTotal > 0 ? grandTotal : 0
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 18 }, // LC No
            { wch: 24 }, // Expense Head
            { wch: 24 }, // Name
            { wch: 28 }, // Remarks
            { wch: 18 }  // Amount
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'LC Expenses');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `LC_Expense_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting LC Expense Excel report:', err);
        alert(`Failed to generate LC Expense Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for Margin Return Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} records - Filtered margin return records
 * @param {Object} filters - Active filter settings
 * @param {Object} totals - Precalculated totals
 * @param {Object} lcMarginMap - Map of lcId to LC details
 * @param {string} searchQuery - Search query string
 */
export const generateMarginReturnReportExcel = (records = [], filters = {}, totals = {}, lcMarginMap = {}, searchQuery = '') => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['MARGIN RETURN REPORT']);
        rows.push([]);

        // 2. Metadata
        const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Date Range:',
            `${start} to ${end}`,
            '',
            '',
            'Printed On:',
            printDateStr
        ]);

        const filterBadges = [];
        if (searchQuery) filterBadges.push(`Search: "${searchQuery}"`);
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.importerName) filterBadges.push(`Importer: ${filters.importerName}`);
        if (filters?.productName) filterBadges.push(`Product: ${filters.productName}`);
        if (filters?.bankName) filterBadges.push(`Bank: ${filters.bankName}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        if (totals?.totalMarginPaid !== undefined) {
            rows.push([
                'Total Margin Paid (TK):', totals.totalMarginPaid || 0,
                '',
                'Total Returned (TK):', totals.totalReturned || 0,
                '',
                'Pending Margin (TK):', totals.totalPending || 0
            ]);
        }

        rows.push(['Total Records:', records.length]);
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = ['SL', 'Date', 'LC No', 'Importer', 'Product', 'Bank', 'Branch', 'A/C No', 'Return Amount (TK)', 'Remarks'];
        rows.push(tableHeaders);

        // 4. Data Rows & Total Calculation
        const sortedRecords = [...records].sort((a, b) => new Date(a.returnDate || a.createdAt || 0) - new Date(b.returnDate || b.createdAt || 0));
        let grandTotal = 0;

        sortedRecords.forEach((r, idx) => {
            const lcDetails = lcMarginMap[r.lcId] || {};
            const amt = parseFloat(r.returnAmount) || 0;
            grandTotal += amt;

            rows.push([
                idx + 1,
                formatDate(r.returnDate),
                String(r.lcNo || '-').trim(),
                String(r.importerName || lcDetails.importerName || '-').trim(),
                String(lcDetails.productName || r.productName || '-').trim(),
                String(r.bankName || lcDetails.bankName || '-').trim(),
                String(lcDetails.bankBranch || r.bankBranch || '-').trim(),
                String(lcDetails.accountNo || r.accountNo || '-').trim(),
                amt > 0 ? amt : 0,
                String(r.remarks || '-').trim()
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
            grandTotal > 0 ? grandTotal : 0,
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 18 }, // LC No
            { wch: 26 }, // Importer
            { wch: 24 }, // Product
            { wch: 18 }, // Bank
            { wch: 18 }, // Branch
            { wch: 20 }, // A/C No
            { wch: 20 }, // Return Amount
            { wch: 26 }  // Remarks
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Margin Returns');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `Margin_Return_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Margin Return Excel report:', err);
        alert(`Failed to generate Margin Return Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for LC Receive Management Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} reportData - Filtered LC receive records
 * @param {Object} filters - Active filter settings
 * @param {Object} summary - Summary metrics (totalQuantity, totalPackets, totalTrucks, unit)
 */
export const generateLCReceiveReportExcel = (reportData = [], filters = {}, summary = {}) => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['LC RECEIVE REPORT']);
        rows.push([]);

        // 2. Metadata
        const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Date Range:',
            `${start} to ${end}`,
            '',
            '',
            'Printed On:',
            printDateStr
        ]);

        const filterBadges = [];
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.port) filterBadges.push(`Port: ${filters.port}`);
        if (filters?.importer) filterBadges.push(`Importer: ${filters.importer}`);
        if (filters?.indCnf) filterBadges.push(`Indian C&F: ${filters.indCnf}`);
        if (filters?.bdCnf) filterBadges.push(`BD C&F: ${filters.bdCnf}`);
        if (filters?.billOfEntry) filterBadges.push(`BOE: ${filters.billOfEntry}`);
        if (filters?.productName || filters?.product) filterBadges.push(`Product: ${filters.productName || filters.product}`);
        if (filters?.brand) filterBadges.push(`Brand: ${filters.brand}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        // Summary Cards
        if (summary) {
            rows.push([
                'TOTAL TRUCKS:', summary.totalTrucks || 0,
                '',
                `TOTAL QUANTITY (${summary.unit || 'Kg'}):`, summary.totalQuantity || 0,
                '',
                'TOTAL BAGS:', summary.totalPackets || 0
            ]);
        }

        rows.push(['Total Records:', reportData.length]);
        rows.push([]);

        // 3. Table Headers
        const tableHeaders = [
            'SL',
            'Date',
            'LC No',
            'Invoice No',
            'Port',
            'Importer',
            'Exporter',
            'Indian C&F',
            'BD C&F',
            'BOE No',
            'Truck',
            'Product',
            'Brand',
            'Bag',
            `Quantity (${summary?.unit || 'Kg'})`,
            `Shortage (${summary?.unit || 'Kg'})`,
            `Stock QTY (${summary?.unit || 'Kg'})`,
            'Stock Bag'
        ];
        rows.push(tableHeaders);

        // Helper calculations matching PDF logic
        const getIHPkt = (item) => {
            if (item.inHousePacket !== undefined && item.inHousePacket !== '') return parseFloat(item.inHousePacket) || 0;
            return (parseFloat(item.packet) || 0) - (parseFloat(item.sweepedPacket) || 0);
        };

        const getIHQty = (item) => {
            if (item.inHouseQuantity !== undefined && item.inHouseQuantity !== '') return parseFloat(item.inHouseQuantity) || 0;
            const ihPkt = getIHPkt(item);
            const size = parseFloat(item.packetSize) || 0;
            if (size > 0) return ihPkt * size;
            return (parseFloat(item.quantity) || 0) - (parseFloat(item.sweepedQuantity) || 0);
        };

        // 4. Data Rows & Total Calculation
        const sortedRecords = [...reportData].sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));
        let totalBag = 0;
        let totalQty = 0;
        let totalShortage = 0;
        let totalStockQty = 0;
        let totalStockBag = 0;

        sortedRecords.forEach((item, idx) => {
            const bag = parseFloat(item.packet) || 0;
            const qty = parseFloat(item.quantity) || 0;
            const shortage = parseFloat(item.sweepedQuantity) || 0;
            const ihQty = getIHQty(item);
            const ihPkt = getIHPkt(item);

            totalBag += bag;
            totalQty += qty;
            totalShortage += shortage;
            totalStockQty += ihQty;
            totalStockBag += ihPkt;

            rows.push([
                idx + 1,
                formatDate(item.date),
                String(item.lcNo || '-').trim(),
                String(item.invoiceNo || '-').trim(),
                String(item.port || '-').trim(),
                String(item.importer || '-').trim(),
                String(item.exporter || '-').trim(),
                String(item.indianCnF || item.indCnF || '-').trim(),
                String(item.bdCnF || '-').trim(),
                String(item.billOfEntry || '-').trim(),
                String(item.truckNo || '-').trim(),
                String(item.productName || item.product || '-').trim(),
                String(item.brand || '-').trim(),
                bag,
                qty,
                shortage,
                ihQty,
                Math.round(ihPkt)
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
            '',
            '',
            '',
            '',
            '',
            totalBag,
            totalQty,
            totalShortage,
            totalStockQty,
            Math.round(totalStockBag)
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 6 },  // SL
            { wch: 14 }, // Date
            { wch: 18 }, // LC No
            { wch: 18 }, // Invoice No
            { wch: 14 }, // Port
            { wch: 24 }, // Importer
            { wch: 24 }, // Exporter
            { wch: 18 }, // Indian C&F
            { wch: 18 }, // BD C&F
            { wch: 16 }, // BOE No
            { wch: 12 }, // Truck
            { wch: 20 }, // Product
            { wch: 18 }, // Brand
            { wch: 14 }, // Bag
            { wch: 16 }, // Quantity
            { wch: 16 }, // Shortage
            { wch: 16 }, // Stock QTY
            { wch: 14 }  // Stock Bag
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'LC Receive');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `LC_Receive_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting LC Receive Excel report:', err);
        alert(`Failed to generate LC Receive Excel report: ${err.message}`);
    }
};

/**
 * Generates an Excel spreadsheet for Stock Management records based on reportType ('short', 'detailed', or 'price').
 * Matches the layout, multi-warehouse grouping, and report type columns of the Stock Report card.
 * 
 * @param {Object} stockData - Stock management calculation object (contains displayRecords, totals, etc.)
 * @param {Object} filters - Active filter settings
 * @param {string} searchQuery - Search query string
 * @param {string} reportType - 'short' | 'detailed' | 'price'
 * @param {Array} stockRecords - Raw stock records
 * @param {Array} warehouseData - Warehouse records
 * @param {Array} salesRecords - Sales records
 * @param {Array} products - Products list
 * @param {Array} damages - Damage records
 * @param {Object} activeBaseline - Active baseline snapshot
 */
export const generateStockReportExcel = (
    stockData = {},
    filters = {},
    searchQuery = '',
    reportType = 'short',
    stockRecords = null,
    warehouseData = [],
    salesRecords = [],
    products = [],
    damages = [],
    activeBaseline = null
) => {
    try {
        const rows = [];
        const normalizedReportType = ['short', 'detailed', 'price'].includes(reportType) ? reportType : 'short';
        const typeLabel = normalizedReportType === 'detailed' ? 'DETAILS REPORT' : (normalizedReportType === 'price' ? 'PRICE REPORT' : 'SHORT REPORT');

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push([`STOCK MANAGEMENT REPORT - ${typeLabel}`]);
        rows.push([]);

        // 2. Metadata
        const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Date Range:',
            `${start} to ${end}`,
            '',
            '',
            'Printed On:',
            printDateStr
        ]);

        const filterBadges = [];
        filterBadges.push(`Report Type: ${typeLabel}`);
        if (searchQuery) filterBadges.push(`Search: "${searchQuery}"`);
        if (filters?.warehouse) filterBadges.push(`Warehouse: ${filters.warehouse}`);
        if (filters?.productName) {
            const pStr = Array.isArray(filters.productName) ? filters.productName.join(', ') : filters.productName;
            if (pStr) filterBadges.push(`Product: ${pStr}`);
        }
        if (filters?.brand) {
            const bStr = Array.isArray(filters.brand) ? filters.brand.join(', ') : filters.brand;
            if (bStr) filterBadges.push(`Brand: ${bStr}`);
        }

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        // Helper for packet remainder
        const calculatePktRem = (qty, size) => {
            const numQty = parseFloat(qty) || 0;
            const numSize = parseFloat(size) || 30;
            if (numSize <= 0) return { whole: 0, remainder: numQty };
            const isNegative = numQty < 0;
            const absQty = Math.abs(numQty);
            const whole = Math.floor(absQty / numSize + 1e-9);
            const remainder = Math.round(absQty - (whole * numSize));
            return {
                whole: isNegative ? -whole : whole,
                remainder: isNegative ? -remainder : remainder
            };
        };

        const formatPktStr = (qty, size) => {
            const { whole, remainder } = calculatePktRem(qty, size);
            return `${whole}${remainder !== 0 ? ` - ${Math.abs(remainder)} kg` : ''}`;
        };

        const sumPktRemainder = (items, qtyExtractor, sizeExtractor) => {
            let totalWhole = 0;
            let totalRem = 0;
            let sampleSize = 30;
            items.forEach(ent => {
                const size = sizeExtractor ? sizeExtractor(ent) : (ent.packetSize || 30);
                if (size > 0) sampleSize = size;
                const qty = qtyExtractor(ent);
                const { whole, remainder } = calculatePktRem(qty, size);
                totalWhole += whole;
                totalRem += remainder;
            });
            if (sampleSize > 0 && Math.abs(totalRem) >= sampleSize) {
                const extra = Math.floor(Math.abs(totalRem) / sampleSize);
                totalWhole += totalRem >= 0 ? extra : -extra;
                totalRem = totalRem % sampleSize;
            }
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(Math.round(totalRem))} kg` : ''}`;
        };

        // Resolve warehouses to render
        const warehousesToRender = (filters?.warehouse === 'All Warehouses' && stockRecords)
            ? (() => {
                const fromStock = stockRecords.map(item => (item.warehouse || item.whName || '').trim()).filter(Boolean);
                const fromWh = warehouseData ? warehouseData.map(item => (item.whName || item.warehouse || '').trim()).filter(Boolean) : [];
                const fromBaseline = (activeBaseline && Array.isArray(activeBaseline.snapshotRecords)) ? activeBaseline.snapshotRecords.map(s => (s.warehouse || s.whName || '').trim()).filter(Boolean) : [];
                const options = [...new Set([...fromStock, ...fromWh, ...fromBaseline])].sort();

                const hili = options.filter(o => o.toUpperCase().includes('HILI'));
                const bogura = options.filter(o => o.toUpperCase().includes('BOGURA'));
                const others = options.filter(o => !o.toUpperCase().includes('HILI') && !o.toUpperCase().includes('BOGURA'));
                const sortedOptions = [...hili, ...bogura, ...others];

                return sortedOptions.map(wh => ({
                    name: wh,
                    data: calculateStockData(stockRecords, { ...filters, warehouse: wh, reportType: normalizedReportType }, searchQuery, warehouseData, salesRecords, products, damages, activeBaseline)
                })).filter(w => w.data.displayRecords.length > 0);
            })()
            : [{
                name: (filters?.warehouse && filters.warehouse !== 'All Warehouses') ? filters.warehouse : '',
                data: (stockRecords ? calculateStockData(stockRecords, { ...filters, reportType: normalizedReportType }, searchQuery, warehouseData, salesRecords, products, damages, activeBaseline) : stockData)
            }];

        // Filter valid brands per product for each warehouse dataset
        const filterRecordsForReportType = (rawRecords) => {
            return (rawRecords || []).map(item => {
                const validBrands = (item.brandList || []).filter(b => {
                    if (normalizedReportType === 'short') {
                        return (b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001;
                    }
                    if (normalizedReportType === 'price') {
                        return (b.inHouseQuantity || 0) > 0.001;
                    }
                    return (b.inHouseQuantity || 0) > 0.001 || (b.orderQuantity || 0) > 0.001 || (b.openingQuantity || 0) > 0.001 || (b.saleQuantity || 0) > 0.001;
                });
                if (validBrands.length === 0) return null;
                return {
                    ...item,
                    brandList: validBrands
                };
            }).filter(Boolean);
        };

        // Pre-filter records for each warehouse
        warehousesToRender.forEach(w => {
            w.records = filterRecordsForReportType(w.data?.displayRecords || []);
        });

        // Global KPI Cards aggregated across all rendered warehouses
        const allRenderedBrands = warehousesToRender.flatMap(w => w.records.flatMap(r => r.brandList || []));
        const totalOpeningBagStr = sumPktRemainder(allRenderedBrands, b => Math.max(0, parseFloat(b.totalInHouseQuantity) || 0), b => b.packetSize);
        const totalSaleBagStr = (() => {
            const totalWhole = allRenderedBrands.reduce((sum, b) => sum + Math.floor(parseFloat(b.salePacket) || 0), 0);
            const totalRem = Math.round(allRenderedBrands.reduce((sum, b) => sum + (parseFloat(b.saleQuantity) || 0) - (Math.floor(parseFloat(b.salePacket) || 0) * (parseFloat(b.packetSize) || 30)), 0));
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
        })();
        const inHouseBagStr = sumPktRemainder(allRenderedBrands, b => Math.max(0, parseFloat(b.inHouseQuantity) || 0), b => b.packetSize);
        const orderBagStr = sumPktRemainder(allRenderedBrands, b => Math.max(0, parseFloat(b.orderQuantity) || 0), b => b.packetSize);
        const saleableBagStr = sumPktRemainder(allRenderedBrands, b => Math.max(0, parseFloat(b.saleableQuantity) || 0), b => b.packetSize);

        const totalInHouseQty = allRenderedBrands.reduce((sum, b) => sum + (parseFloat(b.inHouseQuantity) || 0), 0);
        const totalOpeningQty = allRenderedBrands.reduce((sum, b) => sum + (parseFloat(b.totalInHouseQuantity) || 0), 0);
        const totalSaleQty = allRenderedBrands.reduce((sum, b) => sum + (parseFloat(b.saleQuantity) || 0), 0);
        const totalOrderQty = allRenderedBrands.reduce((sum, b) => sum + (parseFloat(b.orderQuantity) || 0), 0);
        const totalSaleableQty = allRenderedBrands.reduce((sum, b) => sum + (parseFloat(b.saleableQuantity) || 0), 0);

        if (normalizedReportType === 'detailed') {
            rows.push([
                'TOTAL OPENING BAG:', totalOpeningBagStr,
                '',
                'TOTAL OPENING QTY (KG):', Math.round(totalOpeningQty),
                '',
                'TOTAL SALE BAG:', totalSaleBagStr,
                '',
                'TOTAL SALE QTY (KG):', Math.round(totalSaleQty)
            ]);
            rows.push([
                'CURRENT INHOUSE BAG:', inHouseBagStr,
                '',
                'CURRENT INHOUSE QTY (KG):', Math.round(totalInHouseQty),
                '',
                'SHORTAGE (KG):', Math.round(stockData?.totalShortage || 0),
                '',
                'DAMAGE (KG):', Math.round(stockData?.totalDamage || stockData?.totalDamageQty || 0)
            ]);
        } else if (normalizedReportType === 'short') {
            rows.push([
                'CURRENT INHOUSE BAG:', inHouseBagStr,
                '',
                'CURRENT INHOUSE QTY (KG):', Math.round(totalInHouseQty),
                '',
                'TOTAL ORDER BAG:', orderBagStr,
                '',
                'TOTAL ORDER QTY (KG):', Math.round(totalOrderQty)
            ]);
            rows.push([
                'SALEABLE BAG:', saleableBagStr,
                '',
                'SALEABLE QTY (KG):', Math.round(totalSaleableQty),
                '',
                'SHORTAGE (KG):', Math.round(stockData?.totalShortage || 0),
                '',
                'DAMAGE (KG):', Math.round(stockData?.totalDamage || stockData?.totalDamageQty || 0)
            ]);
        } else {
            rows.push([
                'CURRENT INHOUSE BAG:', inHouseBagStr,
                '',
                'CURRENT INHOUSE QTY (KG):', Math.round(totalInHouseQty),
                '',
                'SHORTAGE (KG):', Math.round(stockData?.totalShortage || 0),
                '',
                'DAMAGE (KG):', Math.round(stockData?.totalDamage || stockData?.totalDamageQty || 0)
            ]);
        }

        const totalProductCount = new Set(warehousesToRender.flatMap(w => w.records.map(r => r.productName))).size;
        rows.push(['Total Products:', totalProductCount]);
        rows.push([]);

        // 4. Table Headers & Column Widths
        let tableHeaders = [];
        let colWidths = [];

        if (normalizedReportType === 'short') {
            tableHeaders = [
                'SL',
                'Product & Quality',
                'Brand',
                'Closing Bag',
                'Closing Qty (KG)',
                'Order Bag',
                'Order Qty (KG)',
                'Saleable Bag',
                'Saleable Qty (KG)'
            ];
            colWidths = [
                { wch: 6 },
                { wch: 28 },
                { wch: 20 },
                { wch: 18 },
                { wch: 18 },
                { wch: 18 },
                { wch: 18 },
                { wch: 18 },
                { wch: 18 }
            ];
        } else if (normalizedReportType === 'detailed') {
            tableHeaders = [
                'SL',
                'Product & Quality',
                'Brand',
                'Opening Bag',
                'Opening Qty (KG)',
                'Sale Bag',
                'Sale Qty (KG)',
                'Closing Bag',
                'Closing Qty (KG)'
            ];
            colWidths = [
                { wch: 6 },
                { wch: 28 },
                { wch: 20 },
                { wch: 18 },
                { wch: 18 },
                { wch: 16 },
                { wch: 18 },
                { wch: 18 },
                { wch: 18 }
            ];
        } else {
            tableHeaders = [
                'SL',
                'Product & Quality',
                'Brand',
                'LC No',
                'Costing / Rate (TK)',
                'Closing Bag',
                'Closing Qty (KG)'
            ];
            colWidths = [
                { wch: 6 },
                { wch: 28 },
                { wch: 20 },
                { wch: 20 },
                { wch: 20 },
                { wch: 18 },
                { wch: 18 }
            ];
        }

        // 5. Render Warehouses
        const isMultiWarehouse = warehousesToRender.length > 1;

        warehousesToRender.forEach((whItem) => {
            if (isMultiWarehouse || (whItem.name && whItem.name.trim() !== '')) {
                rows.push([]);
                rows.push([`WAREHOUSE: ${whItem.name.toUpperCase()}`]);
            }

            rows.push(tableHeaders);

            const records = whItem.records || [];

            records.forEach((item, index) => {
                const brands = item.brandList || [];
                const prodName = String(item.productName || '-').toUpperCase();

                const brandCounts = {};
                brands.forEach(b => {
                    const bKey = (b.brand || 'No Brand').trim().toUpperCase();
                    brandCounts[bKey] = (brandCounts[bKey] || 0) + 1;
                });

                brands.forEach((b, bIdx) => {
                    const qualityStr = (b.quality && b.quality !== '-' && b.quality !== 'NO QUALITY') ? ` (${b.quality.trim()})` : '';
                    const prodAndQ = bIdx === 0 ? `${prodName}${qualityStr}` : (qualityStr ? qualityStr.trim() : '');
                    const brandStr = String(b.brand || 'No Brand').trim();

                    if (normalizedReportType === 'short') {
                        rows.push([
                            bIdx === 0 ? index + 1 : '',
                            prodAndQ,
                            brandStr,
                            formatPktStr(b.inHouseQuantity, b.packetSize || 30),
                            Math.round(b.inHouseQuantity || 0),
                            formatPktStr(b.orderQuantity, b.packetSize || 30),
                            Math.round(b.orderQuantity || 0),
                            formatPktStr(b.saleableQuantity, b.packetSize || 30),
                            Math.round(b.saleableQuantity || 0)
                        ]);
                    } else if (normalizedReportType === 'detailed') {
                        const sPkt = parseFloat(b.salePacket) || 0;
                        const sPktStr = Number.isInteger(sPkt) ? String(sPkt) : sPkt.toFixed(2);
                        rows.push([
                            bIdx === 0 ? index + 1 : '',
                            prodAndQ,
                            brandStr,
                            formatPktStr(b.totalInHouseQuantity, b.packetSize || 30),
                            Math.round(b.totalInHouseQuantity || 0),
                            sPktStr,
                            Math.round(b.saleQuantity || 0),
                            formatPktStr(b.inHouseQuantity, b.packetSize || 30),
                            Math.round(b.inHouseQuantity || 0)
                        ]);
                    } else {
                        // Price Report row
                        const lcStr = (b.lcNos && b.lcNos.length > 0) ? b.lcNos.join(', ') : (b.lcNo || '—');
                        const rateVal = b.purchasedPrice || b.rate;
                        const rateStr = rateVal ? (parseFloat(rateVal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
                        rows.push([
                            bIdx === 0 ? index + 1 : '',
                            prodAndQ,
                            brandStr,
                            lcStr,
                            rateStr,
                            formatPktStr(b.inHouseQuantity, b.packetSize || 30),
                            Math.round(b.inHouseQuantity || 0)
                        ]);

                        const isLastOfBrand = (bIdx === brands.length - 1) || ((brands[bIdx + 1]?.brand || '').trim().toUpperCase() !== brandStr.toUpperCase());
                        if (brandCounts[brandStr.toUpperCase()] > 1 && isLastOfBrand) {
                            const matchingBrandRows = brands.filter(x => (x.brand || '').trim().toUpperCase() === brandStr.toUpperCase());
                            const bTotalQty = matchingBrandRows.reduce((s, x) => s + (parseFloat(x.inHouseQuantity) || 0), 0);
                            const bTotalBagStr = sumPktRemainder(matchingBrandRows, x => Math.max(0, parseFloat(x.inHouseQuantity) || 0), x => x.packetSize);
                            rows.push([
                                '',
                                `${brandStr.toUpperCase()} TOTAL`,
                                '',
                                '',
                                '',
                                bTotalBagStr,
                                Math.round(bTotalQty)
                            ]);
                        }
                    }
                });

                // Product Subtotal Row
                if (normalizedReportType === 'short') {
                    rows.push([
                        '',
                        `${prodName} TOTAL`,
                        '',
                        sumPktRemainder(brands, b => Math.max(0, parseFloat(b.inHouseQuantity) || 0), b => b.packetSize),
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.inHouseQuantity) || 0), 0)),
                        sumPktRemainder(brands, b => Math.max(0, parseFloat(b.orderQuantity) || 0), b => b.packetSize),
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.orderQuantity) || 0), 0)),
                        sumPktRemainder(brands, b => Math.max(0, parseFloat(b.saleableQuantity) || 0), b => b.packetSize),
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.saleableQuantity) || 0), 0))
                    ]);
                } else if (normalizedReportType === 'detailed') {
                    const subSalePkt = brands.reduce((s, b) => s + (parseFloat(b.salePacket) || 0), 0);
                    const subSalePktStr = Number.isInteger(subSalePkt) ? String(subSalePkt) : subSalePkt.toFixed(2);
                    rows.push([
                        '',
                        `${prodName} TOTAL`,
                        '',
                        sumPktRemainder(brands, b => Math.max(0, parseFloat(b.totalInHouseQuantity) || 0), b => b.packetSize),
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.totalInHouseQuantity) || 0), 0)),
                        subSalePktStr,
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.saleQuantity) || 0), 0)),
                        sumPktRemainder(brands, b => Math.max(0, parseFloat(b.inHouseQuantity) || 0), b => b.packetSize),
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.inHouseQuantity) || 0), 0))
                    ]);
                } else {
                    rows.push([
                        '',
                        `${prodName} TOTAL`,
                        '',
                        '',
                        '',
                        sumPktRemainder(brands, b => Math.max(0, parseFloat(b.inHouseQuantity) || 0), b => b.packetSize),
                        Math.round(brands.reduce((s, b) => s + (parseFloat(b.inHouseQuantity) || 0), 0))
                    ]);
                }
            });

            // If multi-warehouse, show warehouse total
            if (isMultiWarehouse) {
                const whBrands = records.flatMap(r => r.brandList || []);
                const whTotalInHouseQty = whBrands.reduce((s, b) => s + (parseFloat(b.inHouseQuantity) || 0), 0);
                const whInHouseBagStr = sumPktRemainder(whBrands, b => Math.max(0, parseFloat(b.inHouseQuantity) || 0), b => b.packetSize);

                if (normalizedReportType === 'short') {
                    const whOrderBagStr = sumPktRemainder(whBrands, b => Math.max(0, parseFloat(b.orderQuantity) || 0), b => b.packetSize);
                    const whSaleableBagStr = sumPktRemainder(whBrands, b => Math.max(0, parseFloat(b.saleableQuantity) || 0), b => b.packetSize);
                    rows.push([
                        `${whItem.name.toUpperCase()} TOTAL`,
                        '',
                        '',
                        whInHouseBagStr,
                        Math.round(whTotalInHouseQty),
                        whOrderBagStr,
                        Math.round(whBrands.reduce((s, b) => s + (parseFloat(b.orderQuantity) || 0), 0)),
                        whSaleableBagStr,
                        Math.round(whBrands.reduce((s, b) => s + (parseFloat(b.saleableQuantity) || 0), 0))
                    ]);
                } else if (normalizedReportType === 'detailed') {
                    const whTotalOpeningQty = whBrands.reduce((s, b) => s + (parseFloat(b.totalInHouseQuantity) || 0), 0);
                    const whOpeningBagStr = sumPktRemainder(whBrands, b => Math.max(0, parseFloat(b.totalInHouseQuantity) || 0), b => b.packetSize);
                    const whSalePkt = whBrands.reduce((s, b) => s + (parseFloat(b.salePacket) || 0), 0);
                    const whSalePktStr = Number.isInteger(whSalePkt) ? String(whSalePkt) : whSalePkt.toFixed(2);
                    rows.push([
                        `${whItem.name.toUpperCase()} TOTAL`,
                        '',
                        '',
                        whOpeningBagStr,
                        Math.round(whTotalOpeningQty),
                        whSalePktStr,
                        Math.round(whBrands.reduce((s, b) => s + (parseFloat(b.saleQuantity) || 0), 0)),
                        whInHouseBagStr,
                        Math.round(whTotalInHouseQty)
                    ]);
                } else {
                    rows.push([
                        `${whItem.name.toUpperCase()} TOTAL`,
                        '',
                        '',
                        '',
                        '',
                        whInHouseBagStr,
                        Math.round(whTotalInHouseQty)
                    ]);
                }
            }
        });

        // 6. Overall Grand Total Row
        if (normalizedReportType === 'short') {
            rows.push([
                'GRAND TOTAL',
                '',
                '',
                inHouseBagStr,
                Math.round(totalInHouseQty),
                orderBagStr,
                Math.round(totalOrderQty),
                saleableBagStr,
                Math.round(totalSaleableQty)
            ]);
        } else if (normalizedReportType === 'detailed') {
            const grandSalePkt = allRenderedBrands.reduce((s, b) => s + (parseFloat(b.salePacket) || 0), 0);
            const grandSalePktStr = Number.isInteger(grandSalePkt) ? String(grandSalePkt) : grandSalePkt.toFixed(2);
            rows.push([
                'GRAND TOTAL',
                '',
                '',
                totalOpeningBagStr,
                Math.round(totalOpeningQty),
                grandSalePktStr,
                Math.round(totalSaleQty),
                inHouseBagStr,
                Math.round(totalInHouseQty)
            ]);
        } else {
            rows.push([
                'GRAND TOTAL',
                '',
                '',
                '',
                '',
                inHouseBagStr,
                Math.round(totalInHouseQty)
            ]);
        }

        // 7. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = colWidths;

        const sheetTitle = `Stock ${normalizedReportType.charAt(0).toUpperCase() + normalizedReportType.slice(1)} Report`.slice(0, 31);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `Stock_${normalizedReportType.charAt(0).toUpperCase() + normalizedReportType.slice(1)}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Stock Report Excel report:', err);
        alert(`Failed to generate Stock Report Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the Customer Management Report.
 * Matches all balance computations, active filters, and schema of the PDF and UI report.
 */
export const generateCustomerReportExcel = (
    customers = [],
    typeFilter = 'All Customer',
    grandTotalDue = null,
    dateStr = '',
    purchasesList = [],
    salesRecords = [],
    purchaseReceivesList = [],
    asOfDate = null,
    stockList = []
) => {
    try {
        const computeDue = (customer) => {
            return computeCustomerBalance(customer, { salesRecords, purchasesList, purchaseReceivesList, stockList, asOfDate });
        };

        const targetCutoff = asOfDate ? getIsoDateString(asOfDate) : null;
        const getLastTransDay = (customer) => {
            const payments = (customer.paymentHistory || []).filter(p => {
                if ((p.status || '').toLowerCase() === 'requested') return false;
                if (targetCutoff) {
                    const pDate = getIsoDateString(p.date);
                    if (pDate && pDate >= targetCutoff) return false;
                }
                return true;
            });
            if (payments.length === 0) return '-';

            const latestPayment = payments.reduce((latest, current) => {
                return new Date(current.date) > new Date(latest.date) ? current : latest;
            }, payments[0]);

            if (!latestPayment || !latestPayment.date) return '-';

            const lastDate = new Date(latestPayment.date);
            const today = new Date();
            lastDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            const diffTime = Math.abs(today - lastDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return '1 day ago';
            return `${diffDays} days ago`;
        };

        // Filter out customers with zero balance, sorted in alphabetical ascending order
        const displayCustomers = (customers || []).filter(c => {
            const due = computeDue(c);
            return Math.abs(due) > 0.01;
        }).sort((a, b) => {
            const nameA = (a.companyName || a.customerName || '').trim().toLowerCase();
            const nameB = (b.companyName || b.customerName || '').trim().toLowerCase();
            return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });

        const rows = [];

        // 1. Company Header
        rows.push(['ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['CUSTOMER REPORT']);
        rows.push([]);

        // 2. Metadata
        const printDate = dateStr || formatDate(getLocalDateString(new Date()));
        rows.push([
            'Customer Type:',
            typeFilter || 'All Customer',
            '',
            '',
            'Balance As Of:',
            asOfDate ? formatDate(asOfDate) : 'Live Balances',
            '',
            '',
            'Printed On:',
            printDate
        ]);
        rows.push([
            'Total Records:',
            displayCustomers.length,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            ''
        ]);
        rows.push([]); // Blank separator

        // 3. Table Headers
        const headers = [
            'SL',
            'Customer ID',
            'Company Name',
            'Customer Name',
            'Location',
            'Phone',
            'Customer Type',
            'Last Trans. Day',
            'Total Balance (TK)',
            'Remark'
        ];
        rows.push(headers);

        // 4. Data Rows
        let calculatedGrandTotal = 0;
        displayCustomers.forEach((c, idx) => {
            const due = computeDue(c);
            calculatedGrandTotal += due;
            const roundedDue = Math.round(due);

            rows.push([
                idx + 1,
                c.customerId || '-',
                c.companyName || '-',
                c.customerName || '-',
                c.location || c.address || '-',
                c.phone || '-',
                c.customerType || 'General Customer',
                getLastTransDay(c),
                roundedDue,
                ''
            ]);
        });

        // 5. Grand Total Row
        const finalGrandTotal = grandTotalDue !== null && grandTotalDue !== undefined
            ? Math.round(grandTotalDue)
            : Math.round(calculatedGrandTotal);

        rows.push([
            'GRAND TOTAL BALANCE',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            finalGrandTotal,
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 15 }, // Customer ID
            { wch: 30 }, // Company Name
            { wch: 22 }, // Customer Name
            { wch: 24 }, // Location
            { wch: 20 }, // Phone
            { wch: 18 }, // Customer Type
            { wch: 18 }, // Last Trans. Day
            { wch: 22 }, // Total Balance (TK)
            { wch: 25 }  // Remark
        ];

        const wb = XLSX.utils.book_new();
        const sheetTitle = 'Customer Report'.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const filterName = (typeFilter || 'All').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `Customer_Report_${filterName}_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Customer Report Excel:', err);
        alert(`Failed to generate Customer Report Excel: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for Customer Profile History / Ledger.
 * Supports All Transactions, Sales, Purchases, and Payment history tabs.
 */
export const generateCustomerHistoryExcel = (customer, historyData = [], summary = {}, filters = {}, activeTab = 'all') => {
    try {
        const rows = [];
        const isPurchase = activeTab === 'purchase';
        const isSales = activeTab === 'sales';
        const isPayment = activeTab === 'payment';
        const isAll = activeTab === 'all';

        let reportTitle = "CUSTOMER ACCOUNT LEDGER";
        if (isPurchase) reportTitle = "CUSTOMER PURCHASE HISTORY";
        else if (isSales) reportTitle = "CUSTOMER SALES HISTORY";
        else if (isPayment) reportTitle = "CUSTOMER PAYMENT HISTORY";

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push([reportTitle]);
        rows.push([]);

        // 2. Customer Metadata
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        const startStr = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const endStr = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Company Name:',
            customer?.companyName || '-',
            '',
            'Customer ID:',
            customer?.customerId || '-',
            '',
            'Printed On:',
            dateStr
        ]);

        rows.push([
            'Customer Name:',
            customer?.customerName || '-',
            '',
            'Phone:',
            customer?.phone || '-',
            '',
            'Date Range:',
            `${startStr} to ${endStr}`
        ]);

        if (customer?.location || customer?.address) {
            rows.push([
                'Address:',
                customer.location || customer.address || '-',
                '',
                'Customer Type:',
                customer?.customerType || 'General Customer'
            ]);
        }
        rows.push([]); // Blank separator

        // Sort history chronologically
        const sortedHistory = [...historyData].sort((a, b) => new Date(a.date) - new Date(b.date));

        if (isAll) {
            // Customer Account Ledger
            const headers = ['Date', 'Type', 'Ref / Inv No', 'Particulars', 'Qty (KG)', 'Debit (TK)', 'Credit (TK)', 'Discount (TK)', 'Balance (TK)'];
            rows.push(headers);

            if (summary?.isFiltered) {
                rows.push([
                    '-',
                    'OPENING',
                    '-',
                    'Opening Balance',
                    '',
                    '',
                    '',
                    '',
                    summary.openingBalance ? Math.round(summary.openingBalance) : 0
                ]);
            }

            let totalQty = 0;
            let totalDebit = 0;
            let totalCredit = 0;
            let totalDiscount = 0;

            sortedHistory.forEach(item => {
                const typeLabel = item.type === 'sale' ? 'SALE' : (item.type === 'payment' ? 'COLLECTION' : (item.type === 'payToCustomer' ? 'PAYOUT' : 'PURCHASE'));
                const refNo = item.invoiceNo || item.lcNo || item.purchaseNo || item.receiptNo || '-';

                let particulars = item.product || '';
                if (item.brand && item.brand !== '-') particulars += ` (${item.brand})`;
                if (item.method) particulars += (particulars ? ' - ' : '') + item.method;
                if (item.bankName) particulars += ` (${item.bankName})`;

                const debitVal = (item.type === 'sale' || item.type === 'payToCustomer') ? (parseFloat(item.amount || 0)) : 0;
                const creditVal = (item.type === 'payment' || item.type === 'purchase')
                    ? (parseFloat(item.amount || 0))
                    : (item.type === 'sale' && parseFloat(item.paid || 0) > 0 ? parseFloat(item.paid || 0) : 0);
                const discVal = parseFloat(item.discount || 0);
                const qtyVal = (item.type === 'sale' || item.type === 'purchase') ? parseFloat(item.quantity || item.qty || 0) : 0;

                totalQty += qtyVal;
                totalDebit += debitVal;
                totalCredit += creditVal;
                totalDiscount += discVal;

                rows.push([
                    item.date ? formatDate(item.date) : '-',
                    typeLabel,
                    refNo,
                    particulars || '-',
                    qtyVal > 0 ? qtyVal : '',
                    debitVal > 0 ? Math.round(debitVal) : '',
                    creditVal > 0 ? Math.round(creditVal) : '',
                    discVal > 0 ? Math.round(discVal) : '',
                    item.runningBalance !== undefined ? Math.round(item.runningBalance) : ''
                ]);
            });

            // Grand Total
            rows.push([
                'TOTAL',
                '',
                '',
                '',
                totalQty > 0 ? Math.round(totalQty) : '',
                Math.round(totalDebit),
                Math.round(totalCredit),
                totalDiscount > 0 ? Math.round(totalDiscount) : '',
                summary.totalBalance !== undefined ? Math.round(summary.totalBalance) : ''
            ]);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
                { wch: 14 }, // Date
                { wch: 14 }, // Type
                { wch: 18 }, // Ref / Inv No
                { wch: 32 }, // Particulars
                { wch: 14 }, // Qty
                { wch: 16 }, // Debit
                { wch: 16 }, // Credit
                { wch: 16 }, // Discount
                { wch: 18 }  // Balance
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Account Ledger');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const cName = (customer?.companyName || customer?.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `${cName}_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } else if (isSales) {
            const headers = ['SL', 'Date', 'Invoice No', 'Product', 'Brand', 'Quantity (KG)', 'Rate', 'Total Amount', 'Paid', 'Due'];
            rows.push(headers);

            let sumQty = 0;
            let sumTotal = 0;
            let sumPaid = 0;
            let sumDue = 0;

            sortedHistory.forEach((item, idx) => {
                const qty = parseFloat(item.quantity || item.qty || 0);
                const rate = parseFloat(item.rate || 0);
                const total = parseFloat(item.amount || item.total || 0);
                const paid = parseFloat(item.paid || 0);
                const due = parseFloat(item.due !== undefined ? item.due : (total - paid));

                sumQty += qty;
                sumTotal += total;
                sumPaid += paid;
                sumDue += due;

                rows.push([
                    idx + 1,
                    item.date ? formatDate(item.date) : '-',
                    item.invoiceNo || '-',
                    item.product || '-',
                    item.brand || '-',
                    qty,
                    rate > 0 ? rate : '-',
                    Math.round(total),
                    Math.round(paid),
                    Math.round(due)
                ]);
            });

            rows.push([
                'TOTAL',
                '',
                '',
                '',
                '',
                sumQty,
                '',
                Math.round(sumTotal),
                Math.round(sumPaid),
                Math.round(sumDue)
            ]);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
                { wch: 8 },  // SL
                { wch: 14 }, // Date
                { wch: 18 }, // Invoice No
                { wch: 22 }, // Product
                { wch: 18 }, // Brand
                { wch: 16 }, // Quantity
                { wch: 12 }, // Rate
                { wch: 18 }, // Total Amount
                { wch: 16 }, // Paid
                { wch: 16 }  // Due
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sales History');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const cName = (customer?.companyName || customer?.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `${cName}_Sales_History_${new Date().toISOString().split('T')[0]}.xlsx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } else if (isPurchase) {
            const headers = ['SL', 'Date', 'Purchase / LC No', 'Product', 'Brand', 'Quantity (KG)', 'Rate', 'Total Amount', 'Status'];
            rows.push(headers);

            let sumQty = 0;
            let sumTotal = 0;

            sortedHistory.forEach((item, idx) => {
                const qty = parseFloat(item.quantity || item.qty || 0);
                const rate = parseFloat(item.rate || 0);
                const total = parseFloat(item.amount || item.total || 0);

                sumQty += qty;
                sumTotal += total;

                rows.push([
                    idx + 1,
                    item.date ? formatDate(item.date) : '-',
                    item.purchaseNo || item.lcNo || '-',
                    item.product || '-',
                    item.brand || '-',
                    qty,
                    rate > 0 ? rate : '-',
                    Math.round(total),
                    item.status || 'Completed'
                ]);
            });

            rows.push([
                'TOTAL',
                '',
                '',
                '',
                '',
                sumQty,
                '',
                Math.round(sumTotal),
                ''
            ]);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
                { wch: 8 },  // SL
                { wch: 14 }, // Date
                { wch: 20 }, // Purchase / LC No
                { wch: 22 }, // Product
                { wch: 18 }, // Brand
                { wch: 16 }, // Quantity
                { wch: 12 }, // Rate
                { wch: 18 }, // Total Amount
                { wch: 14 }  // Status
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Purchase History');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const cName = (customer?.companyName || customer?.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `${cName}_Purchase_History_${new Date().toISOString().split('T')[0]}.xlsx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } else if (isPayment) {
            const headers = ['SL', 'Date', 'Type', 'Method', 'Bank / Account', 'Amount (TK)', 'Note'];
            rows.push(headers);

            let sumAmount = 0;

            sortedHistory.forEach((item, idx) => {
                const amt = parseFloat(item.amount || 0);
                sumAmount += amt;

                rows.push([
                    idx + 1,
                    item.date ? formatDate(item.date) : '-',
                    item.type === 'payToCustomer' ? 'Payout to Customer' : 'Customer Payment',
                    item.method || '-',
                    item.bankName || item.receiveBy || item.paidBy || '-',
                    Math.round(amt),
                    item.remarks || item.note || '-'
                ]);
            });

            rows.push([
                'TOTAL',
                '',
                '',
                '',
                '',
                Math.round(sumAmount),
                ''
            ]);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [
                { wch: 8 },  // SL
                { wch: 14 }, // Date
                { wch: 22 }, // Type
                { wch: 16 }, // Method
                { wch: 24 }, // Bank / Account
                { wch: 18 }, // Amount (TK)
                { wch: 28 }  // Note
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Payment History');
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const cName = (customer?.companyName || customer?.customerName || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
            const fileName = `${cName}_Payment_History_${new Date().toISOString().split('T')[0]}.xlsx`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    } catch (err) {
        console.error('Error exporting Customer History Excel:', err);
        alert(`Failed to generate Customer History Excel: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the Payment Collection Report.
 * Matches all data, active filters, calculations, and layout of the PDF and UI report.
 * 
 * @param {Array} payments - Filtered list of payment records
 * @param {Object} filters - Active filter settings
 * @param {string} dateStr - Formatted date string for printed date
 */
export const generatePaymentCollectionReportExcel = (payments = [], filters = {}, dateStr = '') => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['PAYMENT COLLECTION REPORT']);
        rows.push([]);

        // 2. Metadata & Active Filters
        const printDate = dateStr || formatDate(new Date().toISOString().split('T')[0]);
        const startStr = filters?.startDate ? formatDate(filters.startDate) : 'All Time';
        const endStr = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Total Records:',
            payments.length,
            '',
            '',
            'Date Range:',
            filters?.startDate || filters?.endDate ? `${startStr} to ${endStr}` : 'All Dates',
            '',
            '',
            'Printed On:',
            printDate
        ]);

        const filterBadges = [];
        if (filters?.method) filterBadges.push(`Method: ${filters.method}`);
        if (filters?.customer) filterBadges.push(`Customer: ${filters.customer}`);
        if (filters?.bankName) filterBadges.push(`Bank: ${filters.bankName}`);
        if (filters?.branch) filterBadges.push(`Branch: ${filters.branch}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]); // Blank separator

        // 3. Table Headers
        const headers = [
            'SL',
            'Date',
            'Receipt No',
            'Party Name',
            'Customer Type',
            'Location',
            'Payment Method',
            'Bank / Receiver',
            'Branch',
            'Account No',
            'Amount (TK)',
            'Discount (TK)',
            'Total Amount (TK)',
            'Status',
            'Remark'
        ];
        rows.push(headers);

        // 4. Data Rows & Calculations
        let sumRawAmount = 0;
        let sumDiscount = 0;
        let sumTotalAmount = 0;

        const sortedPayments = [...payments].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedPayments.forEach((p, idx) => {
            const rawAmount = parseFloat(p.amount) || 0;
            const discount = parseFloat(p.discount) || 0;
            const totalAmount = rawAmount + discount;

            sumRawAmount += rawAmount;
            sumDiscount += discount;
            sumTotalAmount += totalAmount;

            let remark = (p.reference || p.remarks || p.note || '').trim();
            if (discount > 0) {
                const discountText = `Discount (${Math.round(discount).toLocaleString('en-IN')})`;
                remark = remark ? `${remark}, ${discountText}` : discountText;
            }

            const bankOrReceiver = p.method === 'Cash'
                ? (p.receiveBy || '-')
                : (p.bankName || '-');
            const branchOrPlace = p.method === 'Cash'
                ? (p.place || '-')
                : (p.branch || '-');

            rows.push([
                idx + 1,
                p.date ? formatDate(p.date) : '-',
                p.receiptNo || '-',
                p.companyName || p.customerName || '-',
                p.customerType || '-',
                p.place || p.customerAddress || '-',
                p.method || '-',
                bankOrReceiver,
                branchOrPlace,
                p.accountNo || '-',
                Math.round(rawAmount),
                Math.round(discount),
                Math.round(totalAmount),
                p.status || 'Accepted',
                remark || '-'
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
            '',
            '',
            Math.round(sumRawAmount),
            Math.round(sumDiscount),
            Math.round(sumTotalAmount),
            '',
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 16 }, // Receipt No
            { wch: 28 }, // Party Name
            { wch: 18 }, // Customer Type
            { wch: 20 }, // Location
            { wch: 18 }, // Payment Method
            { wch: 26 }, // Bank / Receiver
            { wch: 18 }, // Branch
            { wch: 20 }, // Account No
            { wch: 16 }, // Amount (TK)
            { wch: 16 }, // Discount (TK)
            { wch: 18 }, // Total Amount (TK)
            { wch: 14 }, // Status
            { wch: 28 }  // Remark
        ];

        const wb = XLSX.utils.book_new();
        const sheetTitle = 'Payment Collection Report'.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `Payment_Collection_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Payment Collection Excel report:', err);
        alert(`Failed to generate Payment Collection Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for the Pay To Customer Report.
 * Matches all data, active filters, calculations, and layout of the PDF and UI report.
 * 
 * @param {Array} payments - Filtered list of payout records
 * @param {Object} filters - Active filter settings
 * @param {string} dateStr - Formatted date string for printed date
 */
export const generatePayToCustomerReportExcel = (payments = [], filters = {}, dateStr = '') => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['PAY TO CUSTOMER REPORT']);
        rows.push([]);

        // 2. Metadata & Active Filters
        const printDate = dateStr || formatDate(new Date().toISOString().split('T')[0]);
        const startStr = filters?.startDate ? formatDate(filters.startDate) : 'All Time';
        const endStr = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Total Records:',
            payments.length,
            '',
            '',
            'Date Range:',
            filters?.startDate || filters?.endDate ? `${startStr} to ${endStr}` : 'All Dates',
            '',
            '',
            'Printed On:',
            printDate
        ]);

        const filterBadges = [];
        if (filters?.method) filterBadges.push(`Method: ${filters.method}`);
        if (filters?.customer) filterBadges.push(`Customer: ${filters.customer}`);
        if (filters?.bankName) filterBadges.push(`Bank: ${filters.bankName}`);
        if (filters?.branch) filterBadges.push(`Branch: ${filters.branch}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]); // Blank separator

        // 3. Table Headers
        const headers = [
            'SL',
            'Date',
            'Receipt No',
            'Party Name',
            'Customer Type',
            'Location',
            'Payment Method',
            'Bank / Paid By',
            'Branch',
            'Account No',
            'Amount (TK)',
            'Status',
            'Remark'
        ];
        rows.push(headers);

        // 4. Data Rows & Calculations
        let grandTotal = 0;
        const sortedPayments = [...payments].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedPayments.forEach((p, idx) => {
            const amount = parseFloat(p.amount) || 0;
            grandTotal += amount;

            const bankOrPaidBy = p.method === 'Cash'
                ? (p.receiveBy || '-')
                : (p.bankName || '-');
            const branchOrPlace = p.method === 'Cash'
                ? (p.place || '-')
                : (p.branch || '-');

            rows.push([
                idx + 1,
                p.date ? formatDate(p.date) : '-',
                p.receiptNo || '-',
                p.companyName || p.customerName || '-',
                p.customerType || '-',
                p.place || p.customerAddress || '-',
                p.method || '-',
                bankOrPaidBy,
                branchOrPlace,
                p.accountNo || '-',
                Math.round(amount),
                p.status || 'Accepted',
                (p.reference || p.remarks || p.note || '').trim() || '-'
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
            '',
            '',
            Math.round(grandTotal),
            '',
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 16 }, // Receipt No
            { wch: 28 }, // Party Name
            { wch: 18 }, // Customer Type
            { wch: 20 }, // Location
            { wch: 18 }, // Payment Method
            { wch: 26 }, // Bank / Paid By
            { wch: 18 }, // Branch
            { wch: 20 }, // Account No
            { wch: 18 }, // Amount (TK)
            { wch: 14 }, // Status
            { wch: 28 }  // Remark
        ];

        const wb = XLSX.utils.book_new();
        const sheetTitle = 'Pay To Customer Report'.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `Pay_To_Customer_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Pay To Customer Excel report:', err);
        alert(`Failed to generate Pay To Customer Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for Sales / Order Reports.
 * Handles General view, Product Wise view, and LC Wise view for Order, General, and Border sale types.
 * 
 * @param {Array} reportData - Filtered sales/orders list with flatItems
 * @param {Object} filters - Active filter settings
 * @param {Object} summary - Totals summary
 * @param {string} saleType - 'Order', 'General', or 'Border'
 * @param {string} reportTab - 'general', 'product_wise', or 'lc_wise'
 * @param {Array} productWiseData - Pre-calculated product-wise entries
 * @param {Object} productWiseTotals - Totals for product-wise
 * @param {Array} lcWiseData - Pre-calculated LC-wise entries
 * @param {Object} lcWiseTotals - Totals for LC-wise
 */
export const generateSalesReportExcel = (
    reportData = [],
    filters = {},
    summary = {},
    saleType = 'General',
    reportTab = 'general',
    productWiseData = [],
    productWiseTotals = null,
    lcWiseData = [],
    lcWiseTotals = null
) => {
    try {
        void summary;
        const isOrderReport = (saleType || '').toUpperCase() === 'ORDER';
        const rows = [];

        // 1. Company Header
        rows.push(['ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);

        // Title
        let reportTitleText = 'SALES REPORT';
        if (reportTab === 'lc_wise') {
            reportTitleText = isOrderReport ? 'LC WISE ORDER REPORT' : 'LC WISE SALES REPORT';
        } else if (reportTab === 'product_wise') {
            reportTitleText = isOrderReport ? 'PRODUCT WISE ORDER REPORT' : 'PRODUCT WISE SALES REPORT';
        } else {
            reportTitleText = isOrderReport ? 'ORDER REPORT' : (saleType === 'Border' ? 'BORDER SALES REPORT' : 'SALES REPORT');
        }
        rows.push([reportTitleText]);
        rows.push([]);

        // 2. Metadata
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        let dateRangeStr = (filters.quickRange === 'all' || (!filters.startDate && !filters.endDate))
            ? 'All Time'
            : `${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`;

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
        }

        rows.push([
            'Date Range:',
            dateRangeStr,
            '',
            '',
            'Printed On:',
            dateStr
        ]);

        const filterBadges = [];
        if (filters?.companyName) filterBadges.push(`Customer: ${filters.companyName}`);
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.productName) filterBadges.push(`Product: ${filters.productName}`);
        if (filters?.brandName) filterBadges.push(`Brand: ${filters.brandName}`);
        if (filters?.warehouseName) filterBadges.push(`Warehouse: ${filters.warehouseName}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }
        rows.push([]); // Blank separator

        let colWidths = [];

        // --- Tab 1: LC Wise ---
        if (reportTab === 'lc_wise') {
            const lcHeaders = [
                'SL',
                'LC No',
                'Product',
                'Brand',
                'Purchase Bag',
                'Purchase Qty (KG)',
                'Sales Bag',
                'Sales Qty (KG)',
                'Remain Bag',
                'Remain Qty (KG)'
            ];
            rows.push(lcHeaders);

            const lcList = lcWiseData || [];
            lcList.forEach((item, idx) => {
                rows.push([
                    idx + 1,
                    item.lcNo || '-',
                    item.product || '-',
                    item.brand || '-',
                    item.pBag > 0 ? Number(item.pBag.toFixed(2)) : 0,
                    item.pQty > 0 ? Number(item.pQty.toFixed(2)) : 0,
                    item.sBag > 0 ? Number(item.sBag.toFixed(2)) : 0,
                    item.sQty > 0 ? Number(item.sQty.toFixed(2)) : 0,
                    Number((item.rBag || 0).toFixed(2)),
                    Number((item.rQty || 0).toFixed(2))
                ]);
            });

            const tPBag = lcWiseTotals?.pBag ?? lcList.reduce((s, i) => s + (parseFloat(i.pBag) || 0), 0);
            const tPQty = lcWiseTotals?.pQty ?? lcList.reduce((s, i) => s + (parseFloat(i.pQty) || 0), 0);
            const tSBag = lcWiseTotals?.sBag ?? lcList.reduce((s, i) => s + (parseFloat(i.sBag) || 0), 0);
            const tSQty = lcWiseTotals?.sQty ?? lcList.reduce((s, i) => s + (parseFloat(i.sQty) || 0), 0);
            const tRBag = lcWiseTotals?.rBag ?? lcList.reduce((s, i) => s + (parseFloat(i.rBag) || 0), 0);
            const tRQty = lcWiseTotals?.rQty ?? lcList.reduce((s, i) => s + (parseFloat(i.rQty) || 0), 0);

            rows.push([
                'GRAND TOTAL',
                '',
                '',
                '',
                Number(tPBag.toFixed(2)),
                Number(tPQty.toFixed(2)),
                Number(tSBag.toFixed(2)),
                Number(tSQty.toFixed(2)),
                Number(tRBag.toFixed(2)),
                Number(tRQty.toFixed(2))
            ]);

            colWidths = [
                { wch: 8 },  // SL
                { wch: 18 }, // LC No
                { wch: 24 }, // Product
                { wch: 20 }, // Brand
                { wch: 16 }, // Purchase Bag
                { wch: 20 }, // Purchase Qty
                { wch: 16 }, // Sales Bag
                { wch: 20 }, // Sales Qty
                { wch: 16 }, // Remain Bag
                { wch: 20 }  // Remain Qty
            ];

            // --- Tab 2: Product Wise ---
        } else if (reportTab === 'product_wise') {
            const pHeaders = [
                'SL',
                'Product',
                'Brand',
                'Bag',
                'Quantity (KG)',
                'Total Amount (TK)'
            ];
            rows.push(pHeaders);

            const pList = (productWiseData && productWiseData.length > 0) ? productWiseData : [];
            pList.forEach((item, idx) => {
                rows.push([
                    idx + 1,
                    item.productName || '-',
                    item.brand || '-',
                    item.bag > 0 ? parseFloat(item.bag) : 0,
                    parseFloat(item.quantity || 0),
                    Math.round(parseFloat(item.total || 0))
                ]);
            });

            const totalBags = productWiseTotals?.totalBags ?? pList.reduce((s, i) => s + (parseFloat(i.bag) || 0), 0);
            const totalQty = productWiseTotals?.totalQty ?? pList.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
            const totalAmount = productWiseTotals?.totalAmount ?? pList.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);

            rows.push([
                'GRAND TOTAL',
                '',
                '',
                Number(totalBags.toFixed(2)),
                Number(totalQty.toFixed(2)),
                Math.round(totalAmount)
            ]);

            colWidths = [
                { wch: 8 },  // SL
                { wch: 30 }, // Product
                { wch: 24 }, // Brand
                { wch: 16 }, // Bag
                { wch: 20 }, // Quantity
                { wch: 22 }  // Total Amount
            ];

            // --- Tab 3: General / Order View ---
        } else {
            let grandQty = 0;
            let grandTotalAmount = 0;

            const sortedReportData = [...reportData].sort((a, b) => {
                const d1 = new Date(a.date || 0).getTime();
                const d2 = new Date(b.date || 0).getTime();
                if (d1 !== d2) return d1 - d2;
                const invA = String(a.invoiceNo || a.orderNo || '').toUpperCase();
                const invB = String(b.invoiceNo || b.orderNo || '').toUpperCase();
                if (invA && invB) {
                    return invA.localeCompare(invB, undefined, { numeric: true, sensitivity: 'base' });
                }
                return (a.createdAt || a._id || 0) > (b.createdAt || b._id || 0) ? 1 : -1;
            });

            if (isOrderReport) {
                const headers = [
                    'SL',
                    'Date',
                    'Order No',
                    'Company',
                    'Location',
                    'Warehouse',
                    'Product',
                    'Brand',
                    'Qty (KG)',
                    'Price',
                    'Total (TK)',
                    'Remark'
                ];
                rows.push(headers);

                let slNum = 1;
                sortedReportData.forEach(sale => {
                    const flatItems = sale.flatItems && sale.flatItems.length > 0 ? sale.flatItems : (sale.items || []);
                    flatItems.forEach(item => {
                        const qty = parseFloat(item.quantity || 0);
                        const price = parseFloat(item.price !== undefined && item.price !== null ? item.price : (item.rate || item.unitPrice || 0));
                        const total = parseFloat(item.total !== undefined && item.total !== null ? item.total : (item.amount || (qty * price) || 0));

                        grandQty += qty;
                        grandTotalAmount += total;

                        rows.push([
                            slNum++,
                            sale.date ? formatDate(sale.date) : '-',
                            sale.orderNo || sale.invoiceNo || '-',
                            sale.companyName || sale.customerName || '-',
                            sale.location || sale.address || sale.customerAddress || '-',
                            item.warehouseName || item.warehouse || sale.warehouse || '-',
                            item.productName || item.product || '-',
                            item.brand || item.brandName || '-',
                            qty,
                            price,
                            Math.round(total),
                            (sale.remark || sale.remarks || sale.notes || sale.note || item.remark || '-').trim() || '-'
                        ]);
                    });
                });

                rows.push([
                    'GRAND TOTAL',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    Number(grandQty.toFixed(2)),
                    '',
                    Math.round(grandTotalAmount),
                    ''
                ]);

                colWidths = [
                    { wch: 8 },  // SL
                    { wch: 14 }, // Date
                    { wch: 16 }, // Order No
                    { wch: 28 }, // Company
                    { wch: 24 }, // Location
                    { wch: 18 }, // Warehouse
                    { wch: 22 }, // Product
                    { wch: 18 }, // Brand
                    { wch: 16 }, // Qty
                    { wch: 14 }, // Price
                    { wch: 18 }, // Total
                    { wch: 26 }  // Remark
                ];

            } else if (saleType === 'Border') {
                const headers = [
                    'SL',
                    'Date',
                    'LC No',
                    'Importer',
                    'Port',
                    'Indian C&F',
                    'BD C&F',
                    'Company',
                    'Product',
                    'Quantity (KG)',
                    'Rate',
                    'Total (TK)',
                    'Remark'
                ];
                rows.push(headers);

                let slNum = 1;
                sortedReportData.forEach(sale => {
                    const flatItems = sale.flatItems && sale.flatItems.length > 0 ? sale.flatItems : (sale.items || []);
                    flatItems.forEach(item => {
                        const qty = parseFloat(item.quantity || 0);
                        const rate = parseFloat(item.price !== undefined && item.price !== null ? item.price : (item.rate || 0));
                        const total = parseFloat(item.total !== undefined && item.total !== null ? item.total : (item.amount || (qty * rate) || 0));

                        grandQty += qty;
                        grandTotalAmount += total;

                        rows.push([
                            slNum++,
                            sale.date ? formatDate(sale.date) : '-',
                            item.lcNo || sale.lcNo || '-',
                            sale.importer || '-',
                            sale.port || '-',
                            sale.indianCnF || '-',
                            sale.bdCnf || '-',
                            sale.companyName || sale.customerName || '-',
                            item.productName || item.product || '-',
                            qty,
                            rate,
                            Math.round(total),
                            (sale.remark || sale.remarks || sale.note || '-').trim() || '-'
                        ]);
                    });
                });

                rows.push([
                    'GRAND TOTAL',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    Number(grandQty.toFixed(2)),
                    '',
                    Math.round(grandTotalAmount),
                    ''
                ]);

                colWidths = [
                    { wch: 8 },  // SL
                    { wch: 14 }, // Date
                    { wch: 16 }, // LC No
                    { wch: 22 }, // Importer
                    { wch: 18 }, // Port
                    { wch: 22 }, // Indian C&F
                    { wch: 22 }, // BD C&F
                    { wch: 26 }, // Company
                    { wch: 22 }, // Product
                    { wch: 16 }, // Quantity
                    { wch: 14 }, // Rate
                    { wch: 18 }, // Total
                    { wch: 24 }  // Remark
                ];

            } else {
                // General Sale
                const headers = [
                    'SL',
                    'Date',
                    'LC No',
                    'Challan No',
                    'Truck No',
                    'Invoice No',
                    'Company',
                    'Product',
                    'Brand',
                    'Quantity (KG)',
                    'Rate',
                    'Total (TK)',
                    'Remark'
                ];
                rows.push(headers);

                let slNum = 1;
                sortedReportData.forEach(sale => {
                    const flatItems = sale.flatItems && sale.flatItems.length > 0 ? sale.flatItems : (sale.items || []);
                    flatItems.forEach(item => {
                        const qty = parseFloat(item.quantity || 0);
                        const rate = parseFloat(item.price !== undefined && item.price !== null ? item.price : (item.rate || 0));
                        const total = parseFloat(item.total !== undefined && item.total !== null ? item.total : (item.amount || (qty * rate) || 0));

                        grandQty += qty;
                        grandTotalAmount += total;

                        rows.push([
                            slNum++,
                            sale.date ? formatDate(sale.date) : '-',
                            item.lcNo || sale.lcNo || '-',
                            sale.challanNo || '-',
                            sale.truckNo || '-',
                            sale.invoiceNo || '-',
                            sale.companyName || sale.customerName || '-',
                            item.productName || item.product || '-',
                            item.brand || item.brandName || '-',
                            qty,
                            rate,
                            Math.round(total),
                            (sale.remark || sale.remarks || sale.note || '-').trim() || '-'
                        ]);
                    });
                });

                rows.push([
                    'GRAND TOTAL',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    Number(grandQty.toFixed(2)),
                    '',
                    Math.round(grandTotalAmount),
                    ''
                ]);

                colWidths = [
                    { wch: 8 },  // SL
                    { wch: 14 }, // Date
                    { wch: 16 }, // LC No
                    { wch: 16 }, // Challan No
                    { wch: 16 }, // Truck No
                    { wch: 16 }, // Invoice No
                    { wch: 26 }, // Company
                    { wch: 22 }, // Product
                    { wch: 18 }, // Brand
                    { wch: 16 }, // Quantity
                    { wch: 14 }, // Rate
                    { wch: 18 }, // Total
                    { wch: 24 }  // Remark
                ];
            }
        }

        // 3. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = colWidths;

        const sheetTitle = (reportTitleText || 'Report').slice(0, 31);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const tabSuffix = reportTab === 'lc_wise' ? '_LC_Wise' : (reportTab === 'product_wise' ? '_Product_Wise' : '');
        const prefix = isOrderReport ? 'Order_Report' : `${saleType}_Sales_Report`;
        const fileName = `${prefix}${tabSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Sales/Order Excel report:', err);
        alert(`Failed to generate Sales/Order Excel report: ${err.message}`);
    }
};

export const generateOrderReportExcel = generateSalesReportExcel;

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for Cost of Goods Report.
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Array} records - Filtered Cost of Goods records
 * @param {Object} filters - Active filter settings
 * @param {string} searchQuery - Optional search query
 */
export const generateCostOfGoodsReportExcel = (records = [], filters = {}, searchQuery = '') => {
    try {
        const rows = [];

        // 1. Company Header
        rows.push(['M/S ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        rows.push(['COST OF GOODS REPORT']);
        rows.push([]);

        // 2. Metadata & Filters
        const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const start = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const end = filters?.endDate ? formatDate(filters.endDate) : 'Present';

        rows.push([
            'Date Range:',
            `${start} to ${end}`,
            '',
            '',
            'Printed On:',
            printDateStr
        ]);

        const filterBadges = [];
        if (searchQuery) filterBadges.push(`Search: "${searchQuery}"`);
        if (filters?.lcNo) filterBadges.push(`LC No: ${filters.lcNo}`);
        if (filters?.supplier) {
            const recordWithExporter = records.find(r => r.supplier === filters.supplier && r.exporter);
            const exporterName = recordWithExporter ? recordWithExporter.exporter : '';
            if (exporterName) filterBadges.push(`Exporter: ${exporterName}`);
            filterBadges.push(`Supplier: ${filters.supplier}`);
        }
        if (filters?.product) filterBadges.push(`Product: ${filters.product}`);
        if (filters?.brand) filterBadges.push(`Brand: ${filters.brand}`);

        if (filterBadges.length > 0) {
            rows.push(['Filters Applied:', filterBadges.join('  |  ')]);
        }

        rows.push(['Total Records:', records.length]);
        rows.push([]);

        // 3. Table Headers
        const hasChina = records.some(r => r.country === 'CHINA');
        const headers = [
            'SL',
            'Date',
            'LC No',
            'Supplier',
            'Invoice No',
            'Truck No',
            'Product',
            'Brand',
            'Quantity (KG)',
            hasChina ? 'Invoice Value (USD)' : 'Invoice Value (RS)',
            hasChina ? 'Net Bill (USD)' : 'Net Bill (RS)',
            'Rate / KG (BDT)',
            'C&F & Other (BDT)',
            'Net Costing/kg (BDT)'
        ];
        rows.push(headers);

        // 4. Data Rows & Total Calculation
        const totals = { quantity: 0, amount: 0, netBill: 0 };

        records.forEach((record, idx) => {
            const isChina = record.country === 'CHINA';
            const qtyVal = parseFloat(record.quantity) || 0;
            const amountVal = parseFloat(record.amount) || 0;
            const billSum = isChina ? amountVal : (record.totalBill !== undefined ? record.totalBill : (amountVal + (parseFloat(record.indTruckFare) || 0) + (parseFloat(record.slofCf) || 0)));
            const rebatePct = isChina ? 0 : (record.rebate !== undefined ? record.rebate : (record.redate !== undefined ? record.redate : '2.9'));
            const rebateVal = isChina ? 0 : (record.rebateAmount !== undefined ? record.rebateAmount : (record.redateAmount !== undefined ? record.redateAmount : ((billSum * (parseFloat(rebatePct) || 0)) / 100)));
            const netBillVal = isChina ? amountVal : (record.netBill !== undefined ? record.netBill : (billSum - rebateVal));

            const rateKgVal = qtyVal ? (netBillVal / qtyVal) : 0;
            const dollarRateVal = parseFloat(record.rsToDollar) || 0;
            const rateKgUsdVal = isChina ? (qtyVal ? (amountVal / qtyVal) : 0) : (dollarRateVal ? (rateKgVal / dollarRateVal) : 0);
            const bdtRateVal = parseFloat(record.dollarRateBdt) || 0;
            const rateKgBdtVal = rateKgUsdVal * bdtRateVal;
            const cfExpVal = parseFloat(record.cfOtherExpense !== undefined ? record.cfOtherExpense : '9') || 0;
            const costingKgVal = rateKgBdtVal + cfExpVal;

            totals.quantity += qtyVal;
            totals.amount += amountVal;
            totals.netBill += parseFloat(netBillVal) || 0;

            rows.push([
                idx + 1,
                record.date ? formatDate(record.date) : '-',
                record.lcNo || '-',
                record.supplier || '-',
                record.invoiceNo || '-',
                record.truckNo || '-',
                record.product || '-',
                record.brand || '-',
                qtyVal > 0 ? qtyVal : 0,
                amountVal > 0 ? Number(amountVal.toFixed(2)) : 0,
                netBillVal > 0 ? Number(netBillVal.toFixed(2)) : 0,
                rateKgBdtVal > 0 ? Number(rateKgBdtVal.toFixed(2)) : 0,
                cfExpVal > 0 ? Number(cfExpVal.toFixed(2)) : 0,
                costingKgVal > 0 ? Number(costingKgVal.toFixed(2)) : 0
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
            Number(totals.quantity.toFixed(2)),
            Number(totals.amount.toFixed(2)),
            Number(totals.netBill.toFixed(2)),
            '',
            '',
            ''
        ]);

        // 6. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!cols'] = [
            { wch: 8 },  // SL
            { wch: 14 }, // Date
            { wch: 18 }, // LC No
            { wch: 28 }, // Supplier
            { wch: 20 }, // Invoice No
            { wch: 18 }, // Truck No
            { wch: 24 }, // Product
            { wch: 20 }, // Brand
            { wch: 18 }, // Quantity
            { wch: 22 }, // Invoice Value
            { wch: 20 }, // Net Bill
            { wch: 18 }, // Rate / KG (BDT)
            { wch: 18 }, // C&F & Other (BDT)
            { wch: 22 }  // Net Costing/kg (BDT)
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cost of Goods');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fileName = `Cost_Of_Goods_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Cost of Goods Excel report:', err);
        alert(`Failed to generate Cost of Goods Excel report: ${err.message}`);
    }
};

/**
 * Generates and downloads an Excel spreadsheet (.xlsx) for Insurance History Report (Payment History or LC History).
 * Matches all data, calculations, and layout of the PDF and UI reports.
 * 
 * @param {Object} params - Parameters object
 */
export const generateInsuranceHistoryReportExcel = ({
    companyName = '',
    policyType = '',
    email = '',
    activeTab = 'payments',
    records = [],
    aggregates = {},
    filters = {},
    lcRecords = [],
    insurancePayments = [],
    getLcCoverNote = () => '-',
    getLcRevisedCoverNotes = () => [],
    getLcAmendmentDates = () => [],
    getLcInsuranceStatus = () => 'not paid'
} = {}) => {
    try {
        const rows = [];

        // 1. Company Branding Header
        rows.push(['ANI ENTERPRISE']);
        rows.push(['766, H.M Tower, Level-06, Borogola, Bogura, Bangladesh | Tel: +8802588813057 | Email: anienterprise051@gmail.com']);
        const reportTitle = activeTab === 'payments' ? 'INSURANCE PAYMENT HISTORY REPORT' : 'INSURANCE LC HISTORY REPORT';
        rows.push([reportTitle]);
        rows.push([]);

        // 2. Metadata & Profile Details
        const printDateStr = formatDate(new Date().toISOString().split('T')[0]);
        const startStr = filters?.startDate ? formatDate(filters.startDate) : 'Start';
        const endStr = filters?.endDate ? formatDate(filters.endDate) : 'Present';
        const dateRangeStr = (filters?.startDate || filters?.endDate) ? `${startStr} to ${endStr}` : 'All Time';

        rows.push([
            'Insurance Company:',
            companyName || '-',
            '',
            'Policy Type:',
            policyType || '-',
            '',
            'Email:',
            email || 'N/A'
        ]);

        rows.push([
            'Date Range:',
            dateRangeStr,
            '',
            '',
            'Printed On:',
            printDateStr
        ]);

        if (filters?.lcNo) {
            rows.push(['Filtered LC No:', String(filters.lcNo)]);
        }

        rows.push(['Total Records:', records.length]);
        rows.push([]);

        // 3. Summary Cards (Premium & Return)
        rows.push(['PREMIUM SUMMARY', '', '', '', 'RETURN SUMMARY', '', '']);
        rows.push([
            'Total Premium (TK):',
            aggregates?.totalPremium ? Number(aggregates.totalPremium) : 0,
            '',
            '',
            'Return Amount (TK):',
            aggregates?.returnAmount ? Number(aggregates.returnAmount) : 0,
            ''
        ]);
        rows.push([
            'Paid Premium (TK):',
            aggregates?.paidPremium ? Number(aggregates.paidPremium) : 0,
            '',
            '',
            'Paid Return (TK):',
            aggregates?.paidReturn ? Number(aggregates.paidReturn) : 0,
            ''
        ]);
        rows.push([
            'Premium Balance (TK):',
            aggregates?.premiumBalance ? Number(aggregates.premiumBalance) : 0,
            '',
            '',
            'Return Balance (TK):',
            aggregates?.returnBalance ? Number(aggregates.returnBalance) : 0,
            ''
        ]);
        rows.push([]);

        let colWidths = [];

        // 4. Tables according to Active Tab
        if (activeTab === 'payments') {
            const headers = [
                'SL',
                'Date',
                'LC No',
                'Method',
                'Reference',
                'Gross Premium (TK)',
                'Return Amount (TK)',
                'Paid (TK)',
                'Adjusted (TK)',
                'Status'
            ];
            rows.push(headers);

            let sumGross = 0;
            let sumReturn = 0;
            let sumPaid = 0;
            let sumAdj = 0;

            records.forEach((p, idx) => {
                const lc = (lcRecords || []).find(l => l.lcNo === p.lcNo);
                const paidVal = p.type === 'Return Collection' ? 0 : (parseFloat(p.amount) || 0);
                const adjVal = parseFloat(p.adjustedAmount) || 0;
                const grossVal = lc ? (parseFloat(lc.grossPremium) || 0) : 0;
                const returnVal = (p.isAdjustReturn || p.type === 'Return Collection')
                    ? (lc ? (parseFloat(lc.expectedReturnAmount) || 0) : 0)
                    : 0;

                sumGross += grossVal;
                sumReturn += returnVal;
                sumPaid += paidVal;
                sumAdj += adjVal;

                rows.push([
                    idx + 1,
                    formatDate(p.date),
                    p.lcNo || '-',
                    p.method || '-',
                    (p.reference || '').trim() || '-',
                    grossVal > 0 ? Number(grossVal.toFixed(2)) : 0,
                    returnVal > 0 ? Number(returnVal.toFixed(2)) : 0,
                    paidVal > 0 ? Number(paidVal.toFixed(2)) : 0,
                    adjVal > 0 ? Number(adjVal.toFixed(2)) : 0,
                    p.status || 'Adjusted'
                ]);
            });

            // Grand Total Row
            rows.push([
                'TOTAL',
                '',
                '',
                '',
                '',
                Number(sumGross.toFixed(2)),
                Number(sumReturn.toFixed(2)),
                Number(sumPaid.toFixed(2)),
                Number(sumAdj.toFixed(2)),
                ''
            ]);

            colWidths = [
                { wch: 8 },  // SL
                { wch: 14 }, // Date
                { wch: 18 }, // LC No
                { wch: 14 }, // Method
                { wch: 22 }, // Reference
                { wch: 20 }, // Gross Premium
                { wch: 20 }, // Return Amount
                { wch: 18 }, // Paid
                { wch: 18 }, // Adjusted
                { wch: 16 }  // Status
            ];
        } else {
            // LC History Tab
            const headers = [
                'SL',
                'LC Date',
                'LC Number',
                'Cover Note No',
                'Beneficiary',
                'Gross Premium (TK)',
                'Net Premium (TK)',
                'Exp. Return (TK)',
                'Status'
            ];
            rows.push(headers);

            let sumGross = 0;
            let sumNet = 0;
            let sumExp = 0;

            records.forEach((lc, idx) => {
                const grossVal = parseFloat(lc.grossPremium) || 0;
                const netVal = parseFloat(lc.netPremium) || 0;
                const expVal = parseFloat(lc.expectedReturnAmount) || 0;

                sumGross += grossVal;
                sumNet += netVal;
                sumExp += expVal;

                const openD = formatDate(lc.openingDate);
                const amndDates = typeof getLcAmendmentDates === 'function' ? getLcAmendmentDates(lc) : [];
                const dateStr = [openD, ...(amndDates || [])].filter(Boolean).join(', ');

                const cn = typeof getLcCoverNote === 'function' ? getLcCoverNote(lc) : '-';
                const rcnList = typeof getLcRevisedCoverNotes === 'function' ? getLcRevisedCoverNotes(lc) : [];
                const cnStr = [cn, ...(rcnList || [])].filter(Boolean).join(', ');

                const status = typeof getLcInsuranceStatus === 'function' ? getLcInsuranceStatus(lc, insurancePayments) : 'NOT PAID';

                rows.push([
                    idx + 1,
                    dateStr || '-',
                    lc.lcNo || '-',
                    cnStr || '-',
                    lc.exporterName || '-',
                    grossVal > 0 ? Number(grossVal.toFixed(2)) : 0,
                    netVal > 0 ? Number(netVal.toFixed(2)) : 0,
                    expVal > 0 ? Number(expVal.toFixed(2)) : 0,
                    String(status).toUpperCase()
                ]);
            });

            // Grand Total Row
            rows.push([
                'TOTAL',
                '',
                '',
                '',
                '',
                Number(sumGross.toFixed(2)),
                Number(sumNet.toFixed(2)),
                Number(sumExp.toFixed(2)),
                ''
            ]);

            colWidths = [
                { wch: 8 },  // SL
                { wch: 18 }, // LC Date
                { wch: 18 }, // LC Number
                { wch: 26 }, // Cover Note No
                { wch: 28 }, // Beneficiary
                { wch: 20 }, // Gross Premium
                { wch: 20 }, // Net Premium
                { wch: 20 }, // Exp. Return
                { wch: 16 }  // Status
            ];
        }

        // 5. Build Worksheet & Workbook
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = colWidths;

        const sheetName = (activeTab === 'payments' ? 'Payment History' : 'LC History').slice(0, 31);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const safeCompany = (companyName || 'Insurance').replace(/[^a-zA-Z0-9]/g, '_');
        const tabName = activeTab === 'payments' ? 'Payment_History' : 'LC_History';
        const fileName = `${safeCompany}_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Error exporting Insurance History Excel report:', err);
        alert(`Failed to generate Insurance History Excel report: ${err.message}`);
    }
};











