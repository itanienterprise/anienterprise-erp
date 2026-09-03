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

