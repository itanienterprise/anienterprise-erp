import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateStockData } from './stockHelpers';

const formatDate = (dateString) => {
    if (!dateString) return '-';

    // Check if dateString is already in DD/MM/YYYY format or similar that doesn't need splitting by '-'
    if (typeof dateString === 'string' && dateString.includes('/')) return dateString;

    const parts = dateString.split('-');
    if (parts.length === 3) {
        const day = parts[2].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[0];
        return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const numberToWords = (amount) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertChunk = (num) => {
        let chunkStr = '';
        if (num >= 100) {
            chunkStr += units[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        if (num >= 10 && num <= 19) {
            chunkStr += teens[num - 10] + ' ';
        } else {
            if (num >= 20) {
                chunkStr += tens[Math.floor(num / 10)] + ' ';
                num %= 10;
            }
            if (num > 0) {
                chunkStr += units[num] + ' ';
            }
        }
        return chunkStr;
    };

    if (amount === 0) return 'Zero Taka Only';

    const parts = Math.abs(amount).toFixed(2).split('.');
    let num = parseInt(parts[0]);
    let cents = parseInt(parts[1]);

    let words = '';

    if (num >= 10000000) {
        words += convertChunk(Math.floor(num / 10000000)) + 'Crore ';
        num %= 10000000;
    }
    if (num >= 100000) {
        words += convertChunk(Math.floor(num / 100000)) + 'Lac ';
        num %= 100000;
    }
    if (num >= 1000) {
        words += convertChunk(Math.floor(num / 1000)) + 'Thousand ';
        num %= 1000;
    }
    if (num > 0) {
        words += convertChunk(num);
    }

    words += 'Taka ';

    if (cents > 0) {
        words += 'And Paisa ' + convertChunk(cents) + ' ';
    }

    words += 'Only';

    return (amount < 0 ? 'Negative ' : '') + words.replace(/\s+/g, ' ').trim();
};

export const generateMoneyReceiptPDF = async (payment) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        // --- Background Patterns (Organic Waves - Adjusted for Portrait) ---
        doc.setFillColor(255, 247, 237);
        doc.circle(0, 0, 35, 'F');
        doc.setFillColor(254, 215, 170);

        doc.setFillColor(255, 247, 237);
        doc.circle(pageWidth, pageHeight, 45, 'F');
        doc.setFillColor(254, 215, 170);
        doc.circle(0, pageHeight, 30, 'F');

        // Load and embed company logo
        const logoImg = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = '/logo.png';
        });

        if (logoImg) {
            doc.addImage(logoImg, 'PNG', margin, margin, 22, 22);
        } else {
            doc.setFillColor(249, 115, 22);
            doc.roundedRect(margin, margin, 20, 20, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text("A", margin + 10, margin + 13, { align: 'center' });
        }

        doc.setTextColor(20, 25, 35);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text("ANI ENTERPRISE", margin + 24, margin + 13);

        // Contact Info (Company) - Structured Multi-line
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text([
            "766, H.M Tower, Level-06",
            "Borogola, Bogura, Bangladesh",
            "Tel: +8802588813057",
            "Email: anienterprise051@gmail.com"
        ], pageWidth - margin, margin + 3, { align: 'right', lineHeightFactor: 1.15 });

        // --- Body Section ---
        let y = margin + 40;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');

        // Helper for dotted lines
        const drawDottedLine = (x1, y1, x2) => {
            doc.setDrawColor(200);
            doc.setLineWidth(0.1);
            doc.setLineDashPattern([0.5, 1], 0);
            doc.line(x1, y1, x2, y1);
            doc.setLineDashPattern([], 0);
        };

        const labelWidth = 40;
        const rightColStart = margin + 105;

        // Line 1: Date (Left) | Receipt No (Right)
        doc.text("Date", margin, y);
        doc.text(":", margin + labelWidth - 5, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(formatDate(payment.date), margin + labelWidth, y);
        drawDottedLine(margin + labelWidth, y + 1, rightColStart - 5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text("Receipt No :", rightColStart, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(payment.receiptNo || '000000', rightColStart + 28, y);
        drawDottedLine(rightColStart + 28, y + 1, pageWidth - margin);

        y += 12;
        // Line 2: Received from (Left) | Address (Right)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text("Party Name", margin, y);
        doc.text(":", margin + labelWidth - 5, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(payment.companyName || payment.customerName || 'N/A', margin + labelWidth, y);
        drawDottedLine(margin + labelWidth, y + 1, rightColStart - 5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text("Contact :", rightColStart, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(payment.phone || '—', rightColStart + 28, y);
        drawDottedLine(rightColStart + 28, y + 1, pageWidth - margin);

        y += 12;
        // Line 3: Address (Full Width)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text("Address", margin, y);
        doc.text(":", margin + labelWidth - 5, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(payment.address || '—', margin + labelWidth, y);
        drawDottedLine(margin + labelWidth, y + 1, pageWidth - margin);

        y += 14;
        // --- Payment Details Table ---
        const tableItems = payment.items || [payment];
        const tableBody = tableItems.map((item, idx) => [
            (idx + 1).toString(),
            item.method || '—',
            item.bankName || '—',
            item.branch || '—',
            item.accountNo || '—',
            'TK. ' + (parseFloat(item.amount) || 0).toLocaleString('en-IN')
        ]);

        autoTable(doc, {
            startY: y,
            head: [['#', 'Payment Method', 'Bank Name', 'Branch', 'Account No', 'Amount']],
            body: tableBody,
            theme: 'grid',
            styles: {
                fontSize: 9.5,
                cellPadding: 3,
                textColor: [0, 0, 0],
                lineColor: [226, 232, 240],
                lineWidth: 0.2,
            },
            headStyles: {
                fillColor: [249, 115, 22],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'center',
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'right', fontStyle: 'bold' },
            },
            margin: { left: margin, right: margin },
        });

        y = doc.lastAutoTable.finalY + 10;

        // Numeric Amount Box (Centered in Portrait)
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin + 25, y - 4, contentWidth - 50, 15, 5, 5, 'F');
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text("TK.   " + parseFloat(payment.amount).toLocaleString('en-IN'), pageWidth / 2, y + 1.5, { align: 'center' });
        const amountWords = numberToWords(parseFloat(payment.amount) || 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text("Amount :  " + amountWords, pageWidth / 2, y + 7.5, { align: 'center' });

        // --- Bottom Section ---
        y += 25;

        // Financial Summary (Left)
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const prevBal = payment.previousBalance || 0;
        const dueBal = payment.balanceDue || 0;

        doc.text("Amount of Balance", margin, y);
        doc.text(":", margin + labelWidth, y);
        doc.text("TK.", margin + labelWidth + 3, y);
        doc.text(prevBal.toLocaleString('en-IN'), margin + labelWidth + 12, y);
        drawDottedLine(margin + labelWidth + 12, y + 1, margin + 75);

        y += 10;
        doc.text("Payment Amount", margin, y);
        doc.text(":", margin + labelWidth, y);
        doc.text("TK.", margin + labelWidth + 3, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(parseFloat(payment.amount).toLocaleString('en-IN'), margin + labelWidth + 12, y);
        drawDottedLine(margin + labelWidth + 12, y + 1, margin + 75);

        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text("Balance Due", margin, y);
        doc.text(":", margin + labelWidth, y);
        doc.text("TK.", margin + labelWidth + 3, y);
        doc.text(dueBal.toLocaleString('en-IN'), margin + labelWidth + 12, y);
        drawDottedLine(margin + labelWidth + 12, y + 1, margin + 75);

        // Payment Method Checkboxes (Middle-Right) - Compact Layout
        const allUsedMethods = (payment.items || [payment]).map(item => item.method);
        const methodYStart = y - 20;
        const methodX = margin + 90;
        const col2X = methodX + 45;

        // Row layout: [method, x, y]
        const methodLayout = [
            ['Cash', methodX, methodYStart],
            ['Bank Deposit', methodX, methodYStart + 7],
            ['Online Banking', col2X, methodYStart + 7],
            ['Mobile Banking', methodX, methodYStart + 14],
            ['Cheque', methodX, methodYStart + 21],
        ];

        methodLayout.forEach(([m, mx, my]) => {
            doc.setDrawColor(200);
            doc.setLineWidth(0.2);
            doc.circle(mx, my - 1, 1.8, 'S');
            if (allUsedMethods.includes(m)) {
                doc.setFillColor(249, 115, 22);
                doc.circle(mx, my - 1, 1.0, 'FD');
            }
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(m, mx + 6, my);
        });



        // Signature (Bottom Right)
        doc.setDrawColor(180);
        doc.setLineWidth(0.5);
        doc.line(pageWidth - margin - 60, pageHeight - margin - 20, pageWidth - margin, pageHeight - margin - 20);
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text("Authorized Signature", pageWidth - margin - 30, pageHeight - margin - 14, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("Money Receipt Error:", error);
        alert(`Failed to generate receipt: ${error.message}`);
    }
};

export const generateLCReceiveReportPDF = (reportData, filters, summary) => {
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

        // --- Configuration ---
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 5; // Reduced margin to 5mm to maximize table width in landscape

        const getIHPkt = (item) => {
            if (item.inHousePacket !== undefined && item.inHousePacket !== '') return parseFloat(item.inHousePacket) || 0;
            return (parseFloat(item.packet) || 0) - (parseFloat(item.sweepedPacket) || 0);
        };

        const getIHQty = (item) => {
            if (item.inHouseQuantity !== undefined && item.inHouseQuantity !== '') return parseFloat(item.inHouseQuantity) || 0;
            const ihPkt = getIHPkt(item);
            const size = parseFloat(item.packetSize) || 0;
            if (size > 0) return ihPkt * size;
            // Fallback for zero size: use weight-based calculation directly from arrival - shortage
            return (parseFloat(item.quantity) || 0) - (parseFloat(item.sweepedQuantity) || 0);
        };

        const formatPktDisplay = (pkt, qty, size) => {
            const pSize = parseFloat(size) || 0;
            const whole = Math.floor(pkt);
            const rem = Math.round(qty - (whole * pSize));
            if (pSize <= 0) return Math.round(pkt).toString();
            return `${whole}${rem > 0 ? ` - ${rem} kg` : ''}`;
        };

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0); // Changed from 100 to 0 (Black)
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("LC RECEIVE REPORT", pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);

        // Left Side: Date Range, LC No
        doc.setFont('helvetica', 'bold');
        doc.text("Date Range:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, margin + 25, yPos);

        if (filters.lcNo) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("LC No:", margin, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(filters.lcNo, margin + 25, yPos);
        }

        // Right Side: Printed On
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Data Preparation ---
        // 1. Group by Date + LC No (matches UI logic but adds Date for safer merging)
        const lcGroups = Object.values(reportData.reduce((acc, item) => {
            const dateStr = formatDate(item.date);
            const key = `${dateStr}_${item.lcNo || 'unknown'}`;
            if (!acc[key]) {
                acc[key] = {
                    date: item.date,
                    lcNo: item.lcNo,
                    importer: item.importer,
                    billOfEntry: item.billOfEntry,
                    entries: []
                };
            }
            acc[key].entries.push(item);
            return acc;
        }, {})).sort((a, b) => new Date(a.date) - new Date(b.date));

        const tableRows = [];

        lcGroups.forEach((lcGroup) => {
            // 2. Group by Product + Truck within LC
            const productSubGroups = Object.values(lcGroup.entries.reduce((acc, item) => {
                const key = `${item.productName}-${item.truckNo}`;
                if (!acc[key]) {
                    acc[key] = {
                        productName: item.productName,
                        truckNo: item.truckNo,
                        brandDetails: []
                    };
                }
                acc[key].brandDetails.push(item);
                return acc;
            }, {}));

            productSubGroups.forEach((subGroup) => {
                const hasSubTotal = subGroup.brandDetails.length > 1;
                const totalRowsForSubGroup = subGroup.brandDetails.length + (hasSubTotal ? 1 : 0);
                let isFirstRowOfProduct = true;

                subGroup.brandDetails.forEach((item, i) => {
                    const row = [];

                    // Group Columns: Date, LC No, Importer, BOE No, Truck, Product (Span across sub-group)
                    if (isFirstRowOfProduct) {
                        row.push({ content: formatDate(lcGroup.date), rowSpan: totalRowsForSubGroup, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: lcGroup.lcNo || '-', rowSpan: totalRowsForSubGroup, styles: { valign: 'top', fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' } });
                        row.push({ content: lcGroup.importer || '-', rowSpan: totalRowsForSubGroup, styles: { valign: 'top', halign: 'left' } });
                        row.push({ content: lcGroup.billOfEntry || '-', rowSpan: totalRowsForSubGroup, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: item.truckNo || '-', rowSpan: totalRowsForSubGroup, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: (item.productName || '-').toUpperCase(), rowSpan: totalRowsForSubGroup, styles: { valign: 'top', fontStyle: 'bold', halign: 'center' } });
                    }

                    // Detail Columns (Unique per row): Brand, Packet
                    row.push(item.brand || '-');
                    row.push(item.packet || '0');

                    if (isFirstRowOfProduct) {
                        isFirstRowOfProduct = false;
                    }

                    // Numeric Columns (Unique per row): QTY, SHORT, IH QTY, IH BAG
                    row.push(`${Math.round(item.quantity)} ${item.unit}`);
                    row.push(`${Math.round(item.sweepedQuantity)} ${item.unit}`);
                    row.push(`${Math.round(getIHQty(item))} ${item.unit}`);
                    row.push(`${formatPktDisplay(getIHPkt(item), getIHQty(item), item.packetSize)}`);

                    tableRows.push(row);
                });

                // Add Sub-Total Row if group has more than one entry
                if (hasSubTotal) {
                    const subTotalRow = [
                        { content: 'SUB TOTAL', styles: { fontStyle: 'italic', halign: 'left' } },
                        '', // Empty Packet col
                        { content: `${Math.round(subGroup.brandDetails.reduce((sum, e) => sum + Math.max(0, parseFloat(e.quantity) || 0), 0))} ${subGroup.brandDetails[0].unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: `${Math.round(subGroup.brandDetails.reduce((sum, e) => sum + Math.max(0, parseFloat(e.sweepedQuantity) || 0), 0))} ${subGroup.brandDetails[0].unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: `${Math.round(subGroup.brandDetails.reduce((sum, e) => sum + Math.max(0, getIHQty(e)), 0))} ${subGroup.brandDetails[0].unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
                        {
                            content: (() => {
                                const totalWhole = subGroup.brandDetails.reduce((sum, e) => sum + Math.floor(Math.max(0, getIHPkt(e))), 0);
                                const totalRem = Math.round(subGroup.brandDetails.reduce((sum, e) => {
                                    const pkt = Math.max(0, getIHPkt(e));
                                    const qty = Math.max(0, getIHQty(e));
                                    const size = parseFloat(e.packetSize) || 0;
                                    const whole = Math.floor(pkt);
                                    return sum + (qty - (whole * size));
                                }, 0));
                                return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                            })(),
                            styles: { fontStyle: 'bold', halign: 'right' }
                        }
                    ];
                    tableRows.push(subTotalRow);
                }
            });
        });

        // --- Totals for Footer ---
        const totalIHQuantity = reportData.reduce((sum, item) => sum + Math.max(0, getIHQty(item)), 0);
        const totalIHPackets = reportData.reduce((sum, item) => sum + Math.max(0, getIHPkt(item)), 0);
        const totalShortage = reportData.reduce((sum, item) => sum + Math.max(0, parseFloat(item.sweepedQuantity) || 0), 0);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['Date', 'LC No', 'Importer', 'BOE No', 'Truck', 'Product', 'Brand', 'Bag', 'QTY', 'SHORT', 'Stock QTY', 'Stock Bag']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: summary.totalPackets.toString(), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(summary.totalQuantity)} ${summary.unit}`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(totalShortage)} ${summary.unit}`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(totalIHQuantity)} ${summary.unit}`, styles: { halign: 'right', fontStyle: 'bold' } },
                {
                    content: (() => {
                        const totalWhole = reportData.reduce((sum, item) => sum + Math.floor(Math.max(0, getIHPkt(item))), 0);
                        const totalRem = Math.round(reportData.reduce((sum, item) => {
                            const pkt = Math.max(0, getIHPkt(item));
                            const qty = Math.max(0, getIHQty(item));
                            const size = parseFloat(item.packetSize) || 0;
                            const whole = Math.floor(pkt);
                            return sum + (qty - (whole * size));
                        }, 0));
                        return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                    })(),
                    styles: { halign: 'right', fontStyle: 'bold' }
                }
            ]],
            theme: 'plain',
            styles: {
                fontSize: 9.0,
                cellPadding: 1.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.15,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.15
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.15
            },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 21, halign: 'center' }, // Date
                1: { cellWidth: 28, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' }, // LC No
                2: { cellWidth: 38, halign: 'left' },   // Importer
                3: { cellWidth: 21, halign: 'center' }, // BOE No
                4: { cellWidth: 12, halign: 'center' }, // Truck
                5: { cellWidth: 26, halign: 'left' }, // Product
                6: { cellWidth: 36, halign: 'left' },   // Brand
                7: { cellWidth: 17, halign: 'center' },  // Bag
                8: { cellWidth: 21, halign: 'right' },  // QTY
                9: { cellWidth: 18, halign: 'right' }, // SHORT
                10: { cellWidth: 21, halign: 'right' }, // IH QTY
                11: { cellWidth: 23, halign: 'right' }  // IH BAG
            }
        });

        // --- Summary Section ---
        let finalY = doc.lastAutoTable.finalY + 10;

        // Avoid page break issues for summary
        if (finalY + 40 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        const boxWidth = 50;
        const boxHeight = 20;
        const boxGap = 10;
        // Calculate total width of the 3 boxes + 2 gaps
        const totalSummaryWidth = (boxWidth * 3) + (boxGap * 2);
        // Center the summary block
        const startX = (pageWidth - totalSummaryWidth) / 2;

        // Box 1: Total Bags
        doc.setDrawColor(0); // Pure Black Border
        doc.roundedRect(startX, finalY, boxWidth, boxHeight, 2, 2);
        doc.setFontSize(8);
        doc.setTextColor(0); // Pure Black Text
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL BAGS", startX + boxWidth / 2, finalY + 7, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(0); // Pure Black Value
        doc.text(summary.totalPackets.toString(), startX + boxWidth / 2, finalY + 15, { align: 'center' });

        // Box 2: Total Trucks
        doc.setDrawColor(0); // Pure Black Border
        doc.roundedRect(startX + boxWidth + boxGap, finalY, boxWidth, boxHeight, 2, 2);
        doc.setFontSize(8);
        doc.setTextColor(0); // Pure Black Text
        doc.text("TOTAL TRUCKS", startX + boxWidth + boxGap + boxWidth / 2, finalY + 7, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(0); // Pure Black Value
        doc.text(summary.totalTrucks.toString(), startX + boxWidth + boxGap + boxWidth / 2, finalY + 15, { align: 'center' });

        // Box 3: Total Quantity
        doc.setDrawColor(0); // Pure Black Border
        doc.roundedRect(startX + (boxWidth + boxGap) * 2, finalY, boxWidth, boxHeight, 2, 2);
        doc.setFontSize(8);
        doc.setTextColor(0); // Deep Blue (DarkBlue)
        doc.text("TOTAL QUANTITY", startX + (boxWidth + boxGap) * 2 + boxWidth / 2, finalY + 7, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(0); // Deep Blue Value
        doc.text(`${summary.totalQuantity} ${summary.unit}`, startX + (boxWidth + boxGap) * 2 + boxWidth / 2, finalY + 15, { align: 'center' });

        // --- Signatures ---
        const sigY = finalY + 40;
        const sigWidth = 35;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setDrawColor(0);
        doc.setLineDashPattern([1, 1], 0);

        // Sig 1
        doc.line(margin, sigY, margin + sigWidth, sigY);
        doc.setFontSize(7);
        doc.setTextColor(0);
        doc.text("PREPARED BY", margin + (sigWidth / 2), sigY + 5, { align: 'center' });

        // Sig 2
        doc.line(margin + sigWidth + sigGap, sigY, margin + sigWidth + sigGap + sigWidth, sigY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + (sigWidth / 2), sigY + 5, { align: 'center' });

        // Sig 3
        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - (sigWidth / 2), sigY + 5, { align: 'center' });

        // Open in new tab for print preview instead of downloading directly
        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert(`Failed to generate PDF: ${error.message}`);
    }
};

export const generateStockReportPDF = (stockData, filters, reportType = 'short', stockRecords, warehouseData, salesRecords, products, damages = []) => {
    try {
        const doc = new jsPDF();

        // --- Configuration ---
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 5;

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0); // Changed from 100 to 0 (Black)
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("STOCK REPORT", pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);

        // Left Side: Date Range, LC No, Product
        doc.setFont('helvetica', 'bold');
        doc.text("Date Range:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, margin + 25, yPos);

        if (filters.productName) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Product:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.productName, margin + 25, yPos);
        }

        if (filters.warehouse && filters.warehouse !== 'All Warehouses') {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Warehouse:", margin, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(filters.warehouse, margin + 25, yPos);
        }

        // Right Side: Printed On
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        const warehousesToRender = (filters.warehouse === 'All Warehouses' && stockRecords)
            ? (() => {
                const fromStock = stockRecords.map(item => (item.warehouse || item.whName || '').trim()).filter(Boolean);
                const fromWh = warehouseData ? warehouseData.map(item => (item.whName || item.warehouse || '').trim()).filter(Boolean) : [];
                const options = [...new Set([...fromStock, ...fromWh])].sort();

                // Priority: HILI first, then BOGURA, then others
                const hili = options.filter(o => o.toUpperCase().includes('HILI'));
                const bogura = options.filter(o => o.toUpperCase().includes('BOGURA'));
                const others = options.filter(o => !o.toUpperCase().includes('HILI') && !o.toUpperCase().includes('BOGURA'));
                const sortedOptions = [...hili, ...bogura, ...others];

                return sortedOptions.map(wh => ({
                    name: wh,
                    data: calculateStockData(stockRecords, { ...filters, warehouse: wh }, '', warehouseData, salesRecords, products, damages)
                })).filter(w => w.data.displayRecords.length > 0);
            })()
            : [{ name: filters.warehouse, data: stockData }];

        // Helper for packet/remainder calculation
        const calculatePktRemainderLocal = (qty, size) => {
            const numQty = parseFloat(qty) || 0;
            const numSize = parseFloat(size) || 0;
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

        // Global Summary Calculations for Cards
        const globalGrandTotalPktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.max(0, Math.floor(parseFloat(ent.totalInHousePacket) || 0)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, (parseFloat(ent.totalInHouseQuantity) || 0)) - (Math.max(0, Math.floor(parseFloat(ent.totalInHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
        })();

        const globalInHousePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.max(0, Math.floor(parseFloat(ent.inHousePacket) || 0)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, (parseFloat(ent.inHouseQuantity) || 0)) - (Math.max(0, Math.floor(parseFloat(ent.inHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
        })();

        const globalTotalSalePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.salePacket) || 0), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.saleQuantity) || 0) - (Math.floor(parseFloat(ent.salePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
        })();

        const globalTotalShortagePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor((parseFloat(ent.sweepedQuantity) || 0) / (parseFloat(ent.packetSize) || 30)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.sweepedQuantity) || 0) % (parseFloat(ent.packetSize) || 30), 0), 0));
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
        })();

        const globalTotalDamagePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor((parseFloat(ent.damageQuantity) || 0) / (parseFloat(ent.packetSize) || 30)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.damageQuantity) || 0) % (parseFloat(ent.packetSize) || 30), 0), 0));
            return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
        })();

        yPos += 8;
        if (filters.warehouse === 'All Warehouses') {
            yPos = Math.max(yPos, 68);
        }

        warehousesToRender.forEach((whItem, whIdx) => {
            const currentStockData = whItem.data;
            if (whIdx > 0) {
                if (yPos + 40 > pageHeight) {
                    doc.addPage();
                    yPos = 20;
                } else {
                    yPos += 12;
                }
            }

            if (filters.warehouse === 'All Warehouses') {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0);
                const label = `Warehouse: ${whItem.name}`;
                const textWidth = doc.getTextWidth(label);
                const padding = 4;
                const boxWidth = textWidth + (padding * 2);
                const boxHeight = 7;
                const boxX = (pageWidth - boxWidth) / 2;
                const boxY = yPos - 5;

                doc.setDrawColor(0);
                doc.setLineWidth(0.2);
                doc.rect(boxX, boxY, boxWidth, boxHeight);
                doc.text(label, pageWidth / 2, boxY + 5, { align: 'center' });

                yPos = boxY + boxHeight + 1;
            }

            // --- Data Preparation ---
            const tableRows = [];
            const boldBottomRowIndices = new Set();
            const boldLinesToDraw = [];


            const sortedDisplayRecords = [...currentStockData.displayRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
            sortedDisplayRecords.forEach((item, index) => {
                // Legitimate quality check - only separate if there's actual quality data
                const qualityGroups = item.brandList.reduce((acc, ent) => {
                    const q = (ent.quality || '-').toUpperCase().trim();
                    // Ensure the entity visually reflects the properly capitalized string for display
                    if (q !== '-') ent.quality = q;
                    if (!acc[q]) acc[q] = [];
                    acc[q].push(ent);
                    return acc;
                }, {});

                const qEntries = Object.entries(qualityGroups);
                const hasQuals = qEntries.length > 1 || (qEntries.length === 1 && qEntries[0][0] !== '-');

                const hasSubTotal = true;
                const brandsCount = item.brandList.length;
                const hasQualSubTotals = hasQuals && qEntries.length > 1;
                const qualSubTotalCount = hasQualSubTotals ? qEntries.length : 0;
                const totalRowsForProduct = brandsCount + (hasQuals ? 1 : 0) + (hasSubTotal ? 1 : 0) + qualSubTotalCount;

                let isFirstRowOfProduct = true;

                // --- 1. PRODUCT HEADER ROW (MOSUR DAL style for products with qualities) ---
                if (hasQuals) {
                    const headRow = [];
                    // SL Column
                    headRow.push({
                        content: (index + 1).toString(),
                        rowSpan: totalRowsForProduct,
                        styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }
                    });
                    // Product Name Header (Stays strictly in Product Name Column)
                    headRow.push({
                        content: (item.productName || '-').toUpperCase(),
                        styles: { valign: 'middle', fontStyle: 'bold', halign: 'center', fillColor: [248, 248, 248] }
                    });
                    // Empty Brand Column
                    headRow.push({
                        content: '',
                        styles: { fillColor: [248, 248, 248] }
                    });
                    // Numeric placeholders
                    const emptyDataColsCount = reportType === 'detailed' ? 6 : 2;
                    for (let i = 0; i < emptyDataColsCount; i++) {
                        headRow.push({ content: '', styles: { fillColor: [248, 248, 248] } });
                    }

                    tableRows.push(headRow);
                    isFirstRowOfProduct = false; // SL already pushed
                }

                // --- 2. DETAIL ROWS ---
                qEntries.forEach(([quality, brands], qIdx) => {
                    let isFirstRowOfQuality = true;
                    const totalRowsForQuality = brands.length + (hasQualSubTotals ? 1 : 0);

                    brands.forEach((ent, bIdx) => {
                        const row = [];

                        // Column 1: SL (Only if not already spanned by a header row)
                        if (isFirstRowOfProduct) {
                            row.push({
                                content: (index + 1).toString(),
                                rowSpan: totalRowsForProduct,
                                styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }
                            });

                            // Product Name without Qualities spans all the way through detail and subtotal rows
                            row.push({
                                content: (item.productName || '-').toUpperCase(),
                                rowSpan: totalRowsForProduct,
                                styles: { valign: 'middle', fontStyle: 'bold', halign: 'center' }
                            });
                        }

                        // Column 2/3: Quality & Brand
                        if (hasQuals) {
                            if (isFirstRowOfQuality) {
                                row.push({
                                    content: (quality === '-' ? '' : quality).toUpperCase(),
                                    rowSpan: totalRowsForQuality,
                                    styles: { valign: 'middle', halign: 'center', fontStyle: 'bold' }
                                });
                            }
                            row.push({
                                content: ent.brand || '-',
                                styles: { halign: 'left' }
                            });
                        } else {
                            // Product Name is already in column 2, so this is just the brand column
                            row.push({
                                content: ent.brand || '-',
                                styles: { halign: 'left' }
                            });
                        }

                        // Detailed Numeric Data
                        if (reportType === 'detailed') {
                            const tQty = parseFloat(ent.totalInHouseQuantity) || 0;
                            const tSize = parseFloat(ent.packetSize) || 0;
                            const { whole: tW, remainder: tR } = calculatePktRemainderLocal(tQty, tSize);
                            row.push({ content: `${tW}${tR !== 0 ? ` - ${Math.abs(tR)} kg` : ''}`, styles: { halign: 'right' } });
                            row.push({ content: Math.round(tQty).toLocaleString('en-US'), styles: { halign: 'right' } });

                            const sQty = parseFloat(ent.saleQuantity) || 0;
                            const sSize = parseFloat(ent.packetSize) || 0;
                            const { whole: sW, remainder: sR } = calculatePktRemainderLocal(sQty, sSize);
                            row.push({ content: `${sW}${sR !== 0 ? ` - ${Math.abs(sR)} kg` : ''}`, styles: { halign: 'right' } });
                            row.push({ content: Math.round(sQty).toLocaleString('en-US'), styles: { halign: 'right' } });
                        }

                        // Closing Data
                        const rQty = parseFloat(ent.inHouseQuantity) || 0;
                        const rSize = parseFloat(ent.packetSize) || 0;
                        const { whole: rW, remainder: rR } = calculatePktRemainderLocal(rQty, rSize);
                        row.push({ content: `${rW}${rR !== 0 ? ` - ${Math.abs(rR)} kg` : ''}`, styles: { halign: 'right' } });
                        row.push({ content: Math.round(rQty).toLocaleString('en-US'), styles: { halign: 'right' } });

                        if (bIdx === brands.length - 1) {
                            const isLastQualityOfProduct = qIdx === qEntries.length - 1;
                            if (!hasQualSubTotals && (!isLastQualityOfProduct || !hasSubTotal)) {
                                boldBottomRowIndices.add(tableRows.length);
                            }
                            row.isQualityEnd = true;
                        }
                        tableRows.push(row);
                        isFirstRowOfProduct = false;
                        isFirstRowOfQuality = false;
                    });

                    // --- Quality Sub Total Row ---
                    if (hasQualSubTotals) {
                        const qualSubRow = [];
                        qualSubRow.push({
                            content: `${quality} TOTAL`,
                            styles: { fontStyle: 'bolditalic', halign: 'right', fillColor: [245, 245, 250] }
                        });

                        if (reportType === 'detailed') {
                            const qTotalIHQty = brands.reduce((s, e) => s + (parseFloat(e.totalInHouseQuantity) || 0), 0);
                            const qPktSize = parseFloat(brands[0]?.packetSize) || 0;
                            const { whole: tW, remainder: tR } = calculatePktRemainderLocal(qTotalIHQty, qPktSize);
                            qualSubRow.push({ content: `${tW}${tR !== 0 ? ` - ${Math.abs(tR)} kg` : ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } });
                            qualSubRow.push({ content: Math.round(qTotalIHQty).toLocaleString('en-US'), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } });

                            const qSaleQty = brands.reduce((s, e) => s + (parseFloat(e.saleQuantity) || 0), 0);
                            const { whole: sW, remainder: sR } = calculatePktRemainderLocal(qSaleQty, qPktSize);
                            qualSubRow.push({ content: `${sW}${sR !== 0 ? ` - ${Math.abs(sR)} kg` : ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } });
                            qualSubRow.push({ content: Math.round(qSaleQty).toLocaleString('en-US'), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } });
                        }

                        const qCloseQty = brands.reduce((s, e) => s + (parseFloat(e.inHouseQuantity) || 0), 0);
                        const qPktSize2 = parseFloat(brands[0]?.packetSize) || 0;
                        const { whole: rW2, remainder: rR2 } = calculatePktRemainderLocal(qCloseQty, qPktSize2);
                        qualSubRow.push({ content: `${rW2}${rR2 !== 0 ? ` - ${Math.abs(rR2)} kg` : ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } });
                        qualSubRow.push({ content: Math.round(qCloseQty).toLocaleString('en-US'), styles: { fontStyle: 'bold', halign: 'right', fillColor: [245, 245, 250] } });

                        boldBottomRowIndices.add(tableRows.length);
                        tableRows.push(qualSubRow);
                    }
                });

                // --- 3. SUB TOTAL ROW ---
                if (hasSubTotal) {
                    const subRow = [];
                    // If hasQuals, SUB TOTAL spans Product Name and Brand columns. 
                    // If !hasQuals, Product Name column is occupied, so SUB TOTAL only occupies Brand column.
                    subRow.push({
                        content: 'SUB TOTAL',
                        colSpan: hasQuals ? 2 : 1,
                        styles: { fontStyle: 'bold', halign: 'center', fillColor: [248, 248, 248] }
                    });

                    if (reportType === 'detailed') {
                        const tSize = item.brandList[0]?.packetSize || 0;
                        const { whole: tW, remainder: tR } = calculatePktRemainderLocal(item.totalInHouseQuantity, tSize);
                        subRow.push({ content: `${tW}${tR !== 0 ? ` - ${Math.abs(tR)} kg` : ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 248, 248] } });
                        subRow.push({ content: Math.round(item.totalInHouseQuantity).toLocaleString('en-US'), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 248, 248] } });

                        const { whole: sW, remainder: sR } = calculatePktRemainderLocal(item.saleQuantity, tSize);
                        subRow.push({ content: `${sW}${sR !== 0 ? ` - ${Math.abs(sR)} kg` : ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 248, 248] } });
                        subRow.push({ content: Math.round(item.saleQuantity).toLocaleString('en-US'), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 248, 248] } });
                    }

                    const tSize = item.brandList[0]?.packetSize || 0;
                    const { whole: rW, remainder: rR } = calculatePktRemainderLocal(item.inHouseQuantity, tSize);
                    subRow.push({ content: `${rW}${rR !== 0 ? ` - ${Math.abs(rR)} kg` : ''}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 248, 248] } });
                    subRow.push({ content: Math.round(item.inHouseQuantity).toLocaleString('en-US'), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 248, 248] } });

                    boldBottomRowIndices.add(tableRows.length);
                    subRow.isSubTotal = true;
                    tableRows.push(subRow);
                }
            });

            // Per-Warehouse Summary for Table Grand Total
            const whGrandTotalPktStr = (() => {
                const totalWhole = currentStockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.max(0, Math.floor(parseFloat(ent.totalInHousePacket) || 0)), 0), 0);
                const totalRem = Math.round(currentStockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, (parseFloat(ent.totalInHouseQuantity) || 0)) - (Math.max(0, Math.floor(parseFloat(ent.totalInHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
            })();

            const whInHousePktStr = (() => {
                const totalWhole = currentStockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.max(0, Math.floor(parseFloat(ent.inHousePacket) || 0)), 0), 0);
                const totalRem = Math.round(currentStockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, (parseFloat(ent.inHouseQuantity) || 0)) - (Math.max(0, Math.floor(parseFloat(ent.inHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
            })();

            const whTotalSalePktStr = (() => {
                const totalWhole = currentStockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.salePacket) || 0), 0), 0);
                const totalRem = Math.round(currentStockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.saleQuantity) || 0) - (Math.floor(parseFloat(ent.salePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
                return `${totalWhole}${totalRem !== 0 ? ` - ${Math.abs(totalRem)} kg` : ''}`;
            })();

            // Append Grand Total Row
            const grandTotalRow = [
                { content: 'GRAND TOTAL', colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } } // SL + Product Name + Brand
            ];

            if (reportType === 'detailed') {
                grandTotalRow.push({ content: whGrandTotalPktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
                grandTotalRow.push({ content: Math.round(currentStockData.totalTotalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
                grandTotalRow.push({ content: whTotalSalePktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
                grandTotalRow.push({ content: Math.round(currentStockData.totalSaleQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
            }

            grandTotalRow.push({ content: whInHousePktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
            grandTotalRow.push({ content: Math.round(currentStockData.totalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });

            boldBottomRowIndices.add(tableRows.length);
            grandTotalRow.isSubTotal = true;
            tableRows.push(grandTotalRow);

            // --- Table ---
            const pdfHead = reportType === 'detailed'
                ? [['SL', 'PRODUCT NAME', 'BRAND', 'Opening Stock BAG', 'Opening Stock QTY', 'SALE BAG', 'SALE QTY', 'Closing Stock BAG', 'Closing Stock QTY']]
                : [['SL', 'PRODUCT NAME', 'BRAND', 'BAG', 'QUANTITY']];

            autoTable(doc, {
                startY: yPos + 1,
                head: pdfHead,
                body: tableRows,
                theme: 'plain',
                styles: {
                    fontSize: reportType === 'detailed' ? 8 : 8.7,
                    cellPadding: reportType === 'detailed' ? 1.2 : 1.3,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0],
                    valign: 'top'
                },
                headStyles: {
                    fillColor: [245, 245, 245],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center',
                    lineWidth: 0.1
                },
                columnStyles: reportType === 'detailed' ? {
                    0: { cellWidth: 8, halign: 'center' }, // SL
                    1: { cellWidth: 32 }, // Product Name / Quality
                    2: { cellWidth: 40 }, // Brand
                    3: { cellWidth: 18, halign: 'right' }, // Opening Stock BAG
                    4: { cellWidth: 18, halign: 'right' }, // Opening Stock QTY
                    5: { cellWidth: 18, halign: 'right' }, // Sale BAG
                    6: { cellWidth: 18, halign: 'right' }, // Sale QTY
                    7: { cellWidth: 18, halign: 'right' }, // Closing Stock BAG
                    8: { cellWidth: 18, halign: 'right' }  // Closing Stock QTY
                } : {
                    0: { cellWidth: 10, halign: 'center' }, // SL
                    1: { cellWidth: 45 }, // Product Name / Quality
                    2: { cellWidth: 75 }, // Brand
                    3: { cellWidth: 35, halign: 'right' }, // BAG
                    4: { cellWidth: 35, halign: 'right' }  // QUANTITY
                },
                margin: { left: margin, right: margin },
                didDrawCell: (data) => {
                    const { cell, row } = data;
                    if (row.section !== 'body') return;

                    // Identify if this cell needs a bold bottom border
                    // 1. It's a designated boundary row (end of quality, subtotal, or grand total)
                    // 2. It's a spanned cell (SL/Product) that ENDS on a boundary row
                    const isBoundaryRow = boldBottomRowIndices.has(row.index);
                    const endRowIndex = row.index + (cell.rowSpan || 1) - 1;
                    const endsOnBoundary = boldBottomRowIndices.has(endRowIndex);

                    if (isBoundaryRow || (cell.rowSpan > 1 && endsOnBoundary)) {
                        boldLinesToDraw.push({
                            x1: cell.x,
                            y1: cell.y + cell.height,
                            x2: cell.x + cell.width,
                            y2: cell.y + cell.height
                        });
                    }
                },
                didDrawPage: () => {
                    // Draw all collected bold lines at the end of the page to ensure they are on top
                    if (boldLinesToDraw.length > 0) {
                        doc.setLineWidth(0.5);
                        doc.setDrawColor(0, 0, 0);
                        boldLinesToDraw.forEach(line => {
                            doc.line(line.x1, line.y1, line.x2, line.y2);
                        });
                        boldLinesToDraw.length = 0; // Clear for next page
                    }
                }
            });

            yPos = doc.lastAutoTable.finalY + 5;
        }); // End of warehousesToRender.forEach


        // --- Footer / Summary ---
        let finalY = doc.lastAutoTable.finalY + 12;

        if (finalY + 60 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        const cardWidth = 38;
        const cardHeight = 25;
        const cardGap = 2;
        const totalCardsWidth = (cardWidth * 5) + (cardGap * 4);
        let cardX = (pageWidth - totalCardsWidth) / 2;

        const drawSummaryCard = (x, y, title, pktVal, qtyVal, isBlue = false) => {
            doc.setDrawColor(200);
            doc.setLineWidth(0.2);
            doc.setFillColor(255, 255, 255);
            doc.rect(x, y, cardWidth, cardHeight, 'FD');

            doc.setFillColor(isBlue ? 240 : 245, isBlue ? 245 : 245, isBlue ? 255 : 245);
            doc.rect(x, y, cardWidth, 8, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.line(x, y + 8, x + cardWidth, y + 8);

            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 0 : 0);
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, x + (cardWidth - titleWidth) / 2, y + 5.2); // Adjusted for center

            // Row 1: BAG
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            const pktLabelWidth = doc.getTextWidth("BAG: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            const pktValStr = pktVal.toString();
            const pktValWidth = doc.getTextWidth(pktValStr);
            const pktTotalWidth = pktLabelWidth + pktValWidth;
            const pktLineX = x + (cardWidth - pktTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            doc.text("BAG: ", pktLineX, y + 14.5); // Adjusted up
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(pktValStr, pktLineX + pktLabelWidth, y + 14.5);

            // Row 2: QTY
            const qtyStrVal = `${Math.round(qtyVal).toLocaleString('en-US')} kg`;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            const qtyLabelWidth = doc.getTextWidth("QTY: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 0 : 0);
            const qtyValWidth = doc.getTextWidth(qtyStrVal);
            const qtyTotalWidth = qtyLabelWidth + qtyValWidth;
            const qtyLineX = x + (cardWidth - qtyTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            doc.text("QTY: ", qtyLineX, y + 20.5); // Adjusted up
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 0 : 0);
            doc.text(qtyStrVal, qtyLineX + qtyLabelWidth, y + 20.5);
        };

        drawSummaryCard(cardX, finalY, "OPENING STOCK", globalGrandTotalPktStr, stockData.totalTotalInHouseQty, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "TOTAL SALE", globalTotalSalePktStr, stockData.totalSaleQty, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "CLOSING STOCK", globalInHousePktStr, stockData.totalInHouseQty, true);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "TOTAL SHORTAGE", globalTotalShortagePktStr, stockData.totalShortage || 0, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "TOTAL DAMAGE", globalTotalDamagePktStr, stockData.totalDamageQty || 0, false);

        // --- Signature Section ---
        const sigY = finalY + 45;
        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);

        doc.line(margin, sigY, margin + sigWidth, sigY);
        doc.text("PREPARED BY", margin + sigWidth / 2, sigY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, sigY, margin + sigWidth + sigGap + sigWidth, sigY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, sigY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, sigY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Stock PDF Generation Error:", error);
        alert(`Failed to generate Stock PDF: ${error.message}`);
    }
};

export const generateWarehouseReportPDF = (displayGroups, filters, totals) => {
    try {
        const doc = new jsPDF();

        // --- Configuration ---
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 5;

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0); // Changed from 100 to 0 (Black)
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("WAREHOUSE STOCK REPORT", pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);

        // Left Side: Date Range, Warehouse, Product
        doc.setFont('helvetica', 'bold');
        doc.text("Date Range:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, margin + 25, yPos);

        if (filters.warehouse) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Warehouse:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.warehouse, margin + 25, yPos);
        }

        if (filters.productName) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Product:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.productName, margin + 25, yPos);
        }

        // Right Side: Printed On
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        const tableRows = [];
        displayGroups.forEach((whGroup, whIdx) => {
            const totalRowsForWarehouse = whGroup.products.reduce((sum, p) => sum + p.brands.length + 1, 0);

            whGroup.products.forEach((pGroup, pIdx) => {
                const hasTotal = true;
                const totalRowsForProduct = pGroup.brands.length + 1;

                pGroup.brands.forEach((brandItem, bIdx) => {
                    const row = [];

                    // SL, Warehouse and Product Name with rowSpan (only in the first row of the group)
                    if (pIdx === 0 && bIdx === 0) {
                        row.push({ content: (whIdx + 1).toString(), rowSpan: totalRowsForWarehouse, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: whGroup.whName.toUpperCase(), rowSpan: totalRowsForWarehouse, styles: { valign: 'top', fontStyle: 'bold' } });
                    }
                    if (bIdx === 0) {
                        row.push({ content: pGroup.productName, rowSpan: totalRowsForProduct, styles: { fontStyle: 'bold', valign: 'top', textTransform: 'uppercase' } });
                    }

                    // Brand details (Individual row per brand)
                    row.push({ content: (brandItem.brand || '-').toUpperCase(), styles: { valign: 'top' } });
                    row.push({
                        content: (() => {
                            const pkt = parseFloat(brandItem.inhousePkt) || 0;
                            const qty = parseFloat(brandItem.inhouseQty) || 0;
                            const size = parseFloat(brandItem.packetSize || brandItem.size || 0);
                            const whole = Math.floor(pkt);
                            const rem = Math.round(qty - (whole * size));
                            return `${whole.toLocaleString('en-US')}${rem > 0 ? ` - ${rem.toLocaleString('en-US')} kg` : ''}`;
                        })(),
                        styles: { halign: 'right', valign: 'top' }
                    });
                    row.push({ content: `${Math.round(parseFloat(brandItem.inhouseQty) || 0).toLocaleString('en-US')} kg`, styles: { halign: 'right', valign: 'top' } });
                    row.push({
                        content: (() => {
                            const pkt = parseFloat(brandItem.whPkt) || 0;
                            const qty = parseFloat(brandItem.whQty) || 0;
                            const size = parseFloat(brandItem.packetSize || brandItem.size || 0);
                            const whole = Math.floor(pkt);
                            const rem = Math.round(qty - (whole * size));
                            return `${whole.toLocaleString('en-US')}${rem > 0 ? ` - ${rem.toLocaleString('en-US')} kg` : ''}`;
                        })(),
                        styles: { halign: 'right', valign: 'top', fontStyle: 'bold' }
                    });
                    row.push({ content: `${Math.round(parseFloat(brandItem.whQty) || 0).toLocaleString('en-US')} kg`, styles: { halign: 'right', valign: 'top', fontStyle: 'bold' } });

                    tableRows.push(row);
                });

                // Add Sub-total row if product has multiple brands
                if (hasTotal) {
                    tableRows.push([
                        { content: 'SUB TOTAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }, colSpan: 1 }, // Spanning Brand col
                        {
                            content: (() => {
                                const totalWhole = pGroup.brands.reduce((sum, b) => sum + Math.floor(Math.max(0, parseFloat(b.inhousePkt) || 0)), 0);
                                const totalRem = Math.round(pGroup.brands.reduce((sum, b) => {
                                    const pkt = Math.max(0, parseFloat(b.inhousePkt) || 0);
                                    const qty = Math.max(0, parseFloat(b.inhouseQty) || 0);
                                    const size = parseFloat(b.packetSize || b.size || 0);
                                    return sum + (qty - (Math.floor(pkt) * size));
                                }, 0));
                                return `${totalWhole.toLocaleString('en-IN')}${totalRem > 0 ? ` - ${totalRem.toLocaleString('en-IN')} kg` : ''}`;
                            })(),
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250], textColor: [0, 0, 0] }
                        },
                        {
                            content: `${Math.round(pGroup.brands.reduce((sum, b) => sum + Math.max(0, parseFloat(b.inhouseQty) || 0), 0)).toLocaleString('en-US')} kg`,
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] }
                        },
                        {
                            content: (() => {
                                const totalWhole = pGroup.brands.reduce((sum, b) => sum + Math.floor(Math.max(0, parseFloat(b.whPkt) || 0)), 0);
                                const totalRem = Math.round(pGroup.brands.reduce((sum, b) => {
                                    const pkt = Math.max(0, parseFloat(b.whPkt) || 0);
                                    const qty = Math.max(0, parseFloat(b.whQty) || 0);
                                    const size = parseFloat(b.packetSize || b.size || 0);
                                    return sum + (qty - (Math.floor(pkt) * size));
                                }, 0));
                                return `${totalWhole.toLocaleString('en-IN')}${totalRem > 0 ? ` - ${totalRem.toLocaleString('en-IN')} kg` : ''}`;
                            })(),
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250], textColor: [0, 0, 0] }
                        },
                        {
                            content: `${Math.round(pGroup.brands.reduce((sum, b) => sum + Math.max(0, parseFloat(b.whQty) || 0), 0)).toLocaleString('en-US')} kg`,
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] }
                        }
                    ]);
                }
            });
        });

        // Add Grand Total Row
        tableRows.push([
            { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] }, colSpan: 4 },
            {
                content: (() => {
                    return `${totals.totalInHouseWhole.toLocaleString('en-US')}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString('en-US')} kg` : ''}`;
                })(),
                styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] }
            },
            { content: `${Math.round(totals.totalInHouseQty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            {
                content: (() => {
                    return `${totals.totalWhWhole.toLocaleString('en-IN')}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString('en-IN')} kg` : ''}`;
                })(),
                styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] }
            },
            { content: `${Math.round(totals.totalWhQty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
        ]);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'WAREHOUSE', 'PRODUCT NAME', 'BRAND', 'TOTAL STOCK BAG', 'TOTAL STOCK QTY', 'WAREHOUSE BAG', 'WAREHOUSE QTY']],
            body: tableRows,
            theme: 'plain',
            styles: {
                fontSize: 8,
                cellPadding: 1.2,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [245, 245, 245],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },   // SL
                1: { cellWidth: 22 },                     // Warehouse
                2: { cellWidth: 26 },                     // Product Name
                3: { cellWidth: 40 },                     // Brand (reduced from 44)
                4: { cellWidth: 26, halign: 'right' },    // Inhouse Pkt
                5: { cellWidth: 26, halign: 'right' },    // Inhouse Qty
                6: { cellWidth: 27, halign: 'right' },    // Warehouse Pkt
                7: { cellWidth: 27, halign: 'right' }     // Warehouse Qty
            },
            margin: { left: margin, right: margin }
        });

        // --- Footer / Summary ---
        let finalY = doc.lastAutoTable.finalY + 12;

        // Avoid page break issues for summary
        if (finalY + 60 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        // --- Card-Style Summary ---
        const cardWidth = 64;
        const cardHeight = 25;
        const cardGap = 4;
        const totalCardsWidth = (cardWidth * 2) + cardGap;
        let cardX = (pageWidth - totalCardsWidth) / 2; // Center horizontally

        const drawSummaryCard = (x, y, title, pktVal, qtyVal, isBlue = false) => {
            // Main card border and background
            doc.setDrawColor(200);
            doc.setLineWidth(0.2);
            doc.setFillColor(255, 255, 255);
            doc.rect(x, y, cardWidth, cardHeight, 'FD');

            // Header strip
            doc.setFillColor(245, 245, 245);
            doc.rect(x, y, cardWidth, 8, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.line(x, y + 8, x + cardWidth, y + 8);

            // Header text (centered)
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, x + (cardWidth - titleWidth) / 2, y + 5.5);

            // Row 1: BAG (centered)
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0); // gray label color
            const pktLabelWidth = doc.getTextWidth("BAG: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0); // blue/black value color
            const pktValStr = pktVal; // Expecting string now
            const pktValWidth = doc.getTextWidth(pktValStr);

            let pktTotalWidth = pktLabelWidth + pktValWidth;
            let pktLineX = x + (cardWidth - pktTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            doc.text("BAG: ", pktLineX, y + 15);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(pktValStr, pktLineX + pktLabelWidth, y + 15);

            // Row 2: QTY (centered)
            const qtyStrVal = `${Math.round(qtyVal).toLocaleString('en-US')} kg`;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            const qtyLabelWidth = doc.getTextWidth("QTY: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            const qtyValWidth = doc.getTextWidth(qtyStrVal);

            let qtyTotalWidth = qtyLabelWidth + qtyValWidth;
            let qtyLineX = x + (cardWidth - qtyTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            doc.text("QTY: ", qtyLineX, y + 21);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(qtyStrVal, qtyLineX + qtyLabelWidth, y + 21);
        };

        // Card 1: TOTAL INHOUSE STOCK
        drawSummaryCard(cardX, finalY, "TOTAL STOCK", (() => {
            return `${totals.totalInHouseWhole.toLocaleString('en-US')}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString('en-US')} kg` : ''}`;
        })(), totals.totalInHouseQty, false);
        cardX += cardWidth + cardGap;

        // Card 2: WAREHOUSE STOCK
        drawSummaryCard(cardX, finalY, "WAREHOUSE STOCK", (() => {
            return `${totals.totalWhWhole.toLocaleString('en-IN')}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString('en-IN')} kg` : ''}`;
        })(), totals.totalWhQty, true);

        // --- Signatures ---
        const sigY = finalY + 45;
        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(0.2);
        doc.setLineDashPattern([1, 1], 0);

        doc.line(margin, sigY, margin + sigWidth, sigY);
        doc.text("PREPARED BY", margin + sigWidth / 2, sigY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, sigY, margin + sigWidth + sigGap + sigWidth, sigY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, sigY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, sigY + 5, { align: 'center' });

        // Finalize
        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Warehouse PDF Generation Error:", error);
        alert(`Failed to generate Warehouse PDF: ${error.message}`);
    }
};

export const generateSaleInvoicePDF = async (sale, allCustomers = []) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        // --- Calculate Previous Balance Dynamically ---
        let previousBalance = parseFloat(sale.previousBalance || 0);

        const customer = allCustomers.find(c =>
            c._id === sale.customerId ||
            (c.companyName && sale.companyName && c.companyName.trim().toLowerCase() === sale.companyName.trim().toLowerCase())
        );

        if (customer) {
            const sHistory = customer.salesHistory || [];
            const pHistory = customer.paymentHistory || [];

            const prevSales = sHistory.filter(h => {
                if (h.invoiceNo === sale.invoiceNo) return false;
                if (h.date < sale.date) return true;
                if (h.date === sale.date && h.invoiceNo < sale.invoiceNo) return true;
                return false;
            });

            const totalPrevAmt = prevSales.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
            const totalPrevPaid = prevSales.reduce((sum, h) => sum + (parseFloat(h.paid) || 0), 0);
            const totalPrevDisc = prevSales.reduce((sum, h) => sum + (parseFloat(h.discount) || 0), 0);

            const prevPayments = pHistory.filter(h => h.date < sale.date);
            const totalPrevPayAmt = prevPayments.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);

            const calculatedPrevBalance = totalPrevAmt - totalPrevPaid - totalPrevDisc - totalPrevPayAmt;
            previousBalance = Math.max(0, calculatedPrevBalance);
        }

        // --- Background Patterns (Organic Waves - Adjusted for Portrait) ---
        doc.setFillColor(255, 247, 237);
        doc.circle(0, 0, 35, 'F');
        doc.setFillColor(254, 215, 170);

        doc.setFillColor(255, 247, 237);
        doc.circle(pageWidth, pageHeight, 45, 'F');
        doc.setFillColor(254, 215, 170);
        doc.circle(0, pageHeight, 30, 'F');

        // Load and embed company logo
        const logoImg = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = '/logo.png';
        });

        if (logoImg) {
            doc.addImage(logoImg, 'PNG', margin, margin, 22, 22);
        } else {
            doc.setFillColor(249, 115, 22);
            doc.roundedRect(margin, margin, 20, 20, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text("A", margin + 10, margin + 13, { align: 'center' });
        }

        doc.setTextColor(20, 25, 35);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text("ANI ENTERPRISE", margin + 24, margin + 13);

        // Contact Info (Company) - Structured Multi-line
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text([
            "766, H.M Tower, Level-06",
            "Borogola, Bogura, Bangladesh",
            "Tel: +8802588813057",
            "Email: anienterprise051@gmail.com"
        ], pageWidth - margin, margin + 3, { align: 'right', lineHeightFactor: 1.15 });

        // --- Body Section ---
        let y = margin + 40;
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');

        // Helper for dotted lines
        const drawDottedLine = (x1, y1, x2) => {
            doc.setDrawColor(200);
            doc.setLineWidth(0.1);
            doc.setLineDashPattern([0.5, 1], 0);
            doc.line(x1, y1, x2, y1);
            doc.setLineDashPattern([], 0);
        };

        const labelWidth = 40;
        const rightColStart = margin + 105;

        // --- 2. Boxed Title ---
        doc.setFillColor(249, 115, 22); // Orange color
        doc.rect((pageWidth / 2) - 35, y - 8, 70, 9, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text("SALES INVOICE", pageWidth / 2, y - 2, { align: 'center' });

        // --- 2b. Customer Type (Centered under Title Box) ---
        let custTypeLabel = "General Customer";
        const cType = (customer?.customerType || sale.customerType || "").toLowerCase();
        if (cType.includes("party") || sale.isParty) {
            custTypeLabel = "Party Customer";
        }
        y += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(custTypeLabel, pageWidth / 2, y, { align: 'center' });

        y += 12;

        // Line 1: Date (Left) | Invoice No (Right)
        doc.setFont('helvetica', 'bold');
        doc.text("Invoice Date", margin, y);
        doc.text(":", margin + labelWidth - 5, y);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(sale.date), margin + labelWidth, y);
        drawDottedLine(margin + labelWidth, y + 1, rightColStart - 5);

        doc.setFont('helvetica', 'bold');
        doc.text("Invoice No :", rightColStart, y);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.invoiceNo || "-", rightColStart + 28, y);
        drawDottedLine(rightColStart + 28, y + 1, pageWidth - margin);

        y += 12;
        // Line 2: Company Name (Left) | Customer ID (Right)
        doc.setFont('helvetica', 'bold');
        doc.text("Company Name", margin, y);
        doc.text(":", margin + labelWidth - 5, y);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.companyName || "-", margin + labelWidth, y);
        drawDottedLine(margin + labelWidth, y + 1, rightColStart - 5);

        doc.setFont('helvetica', 'bold');
        doc.text("Customer ID :", rightColStart, y);
        doc.setFont('helvetica', 'normal');
        const displayCustId = customer?.customerId || (sale.customerId ? sale.customerId.slice(-5).toUpperCase() : "-");
        doc.text(displayCustId, rightColStart + 28, y);
        drawDottedLine(rightColStart + 28, y + 1, pageWidth - margin);

        y += 12;
        // Line 3: Address (Full Width)
        doc.setFont('helvetica', 'bold');
        doc.text("Address", margin, y);
        doc.text(":", margin + labelWidth - 5, y);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.address || "-", margin + labelWidth, y);
        drawDottedLine(margin + labelWidth, y + 1, pageWidth - margin);

        y += 12;
        // Line 4: Contact No (Full Width)
        doc.setFont('helvetica', 'bold');
        doc.text("Contact No", margin, y);
        doc.line(margin + labelWidth, y + 1, pageWidth - margin, y + 1);

        y += 14;

        // --- 4. Items Table ---
        const tableRows = [];
        let items = sale.items || [];

        const hasReturns = items.some(item =>
            (parseFloat(item.returnQty) || 0) > 0 ||
            (item.brandEntries && item.brandEntries.some(be => (parseFloat(be.returnQty) || 0) > 0))
        ) || (parseFloat(sale.returnQty) || 0) > 0;

        const prepareRow = (sl, prod, brand, qty, rate, total, retQty = 0) => {
            const netQuantity = parseFloat(qty) || 0;
            const returnQuantity = parseFloat(retQty) || 0;
            const purchaseQuantity = netQuantity + returnQuantity;
            const productName = (prod || '').toString().toUpperCase();
            const brandName = (brand || '').toString().toUpperCase();

            let displayRate = parseFloat(rate) || 0;
            if (displayRate === 0 && netQuantity > 0) {
                displayRate = (parseFloat(total) || 0) / netQuantity;
            }

            if (hasReturns) {
                return [
                    sl,
                    productName,
                    brandName,
                    purchaseQuantity.toLocaleString('en-US'),
                    returnQuantity.toLocaleString('en-US'),
                    netQuantity.toLocaleString('en-US'),
                    displayRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    parseFloat(total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                ];
            }

            return [
                sl,
                productName,
                brandName,
                netQuantity.toLocaleString('en-US'),
                displayRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                parseFloat(total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
        };

        const isBorderSale = (sale.invoiceNo || '').startsWith('BS');

        if (items.length === 0 && (sale.productId || sale.productName || sale.product)) {
            tableRows.push(prepareRow(
                1,
                sale.productName || sale.product || '-',
                isBorderSale ? (sale.truck || '-') : (sale.brand || '-'),
                sale.quantity,
                sale.unitPrice || sale.rate,
                sale.totalAmount || sale.amount,
                sale.returnQty
            ));
        } else {
            let sl = 1;
            items.forEach((item) => {
                const bEntries = item.brandEntries || [];
                if (bEntries.length > 0) {
                    bEntries.forEach((brand) => {
                        tableRows.push(prepareRow(
                            sl++,
                            item.productName || item.product || '-',
                            isBorderSale ? (brand.truck || '-') : (brand.brand || '-'),
                            brand.quantity,
                            brand.unitPrice || brand.rate || 0,
                            brand.totalAmount || brand.amount || 0,
                            brand.returnQty
                        ));
                    });
                } else {
                    tableRows.push(prepareRow(
                        sl++,
                        item.productName || item.product || '-',
                        isBorderSale ? (item.truck || '-') : (item.brand || '-'),
                        item.quantity,
                        item.unitPrice || item.rate || 0,
                        item.totalAmount || item.amount || 0,
                        item.returnQty
                    ));
                }
            });
        }

        const tableHead = hasReturns
            ? [['SN', 'Product Name', isBorderSale ? 'Truck' : 'Brand', 'Purchase', 'Return', 'Net Qty', 'Rate', 'Total Amount']]
            : [['SN', 'Product Name', isBorderSale ? 'Truck' : 'Brand', 'Quantity', 'Rate', 'Total Amount']];

        const columnStyles = hasReturns
            ? {
                0: { cellWidth: 8 },
                1: { cellWidth: 35 },
                2: { cellWidth: 35 },
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'center', cellWidth: 20 },
                5: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
                6: { halign: 'right', cellWidth: 22 },
                7: { halign: 'right', fontStyle: 'bold' },
            }
            : {
                0: { halign: 'center', cellWidth: 14 },
                1: { halign: 'left', cellWidth: 40 },
                2: { halign: isBorderSale ? 'center' : 'left', cellWidth: 40 },
                3: { halign: 'center', cellWidth: 25 },
                4: { halign: 'right', cellWidth: 33 },
                5: { halign: 'right', cellWidth: 38 }
            };

        autoTable(doc, {
            startY: y,
            head: tableHead,
            body: tableRows,
            theme: 'grid',
            styles: {
                fontSize: 9.5,
                cellPadding: 3,
                textColor: [0, 0, 0],
                lineColor: [226, 232, 240],
                lineWidth: 0.2,
            },
            headStyles: {
                fillColor: [249, 115, 22],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'center',
            },
            columnStyles: columnStyles,
            margin: { left: margin, right: margin },
        });

        // --- 5. Summary Section ---
        let finalY = doc.lastAutoTable.finalY + 10;

        const subtotal = tableRows.reduce((sum, row) => {
            const amtStr = row[row.length - 1].replace(/,/g, '');
            return sum + (parseFloat(amtStr) || 0);
        }, 0);

        const discount = parseFloat(sale.discount || 0);
        const invoiceTotal = subtotal - discount;
        const paidAmount = parseFloat(sale.paidAmount || 0);
        const currentBalance = invoiceTotal - paidAmount;
        const totalBalance = currentBalance + previousBalance;

        // Left Side: In Words
        const boxWidth = contentWidth - 65;
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, finalY, boxWidth, 16, 4, 4, 'F');
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text("TK.   " + invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), margin + (boxWidth / 2), finalY + 6, { align: 'center' });
        const amountWords = numberToWords(invoiceTotal);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text("In Words : " + amountWords, margin + (boxWidth / 2), finalY + 12, { align: 'center' });


        // Right Side: Summary Table
        const summaryBoxWidth = 35;
        const summaryX = pageWidth - margin - summaryBoxWidth;
        const rowHeight = 7;
        let sumY = finalY;

        const drawSummaryRow = (label, value, isBold = false) => {
            doc.setDrawColor(200);
            doc.setLineWidth(0.1);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(label + " :", summaryX - 2, sumY + 4.5, { align: 'right' });

            // Box
            if (isBold) {
                doc.setFillColor(249, 115, 22);
                doc.rect(summaryX, sumY, summaryBoxWidth, rowHeight, 'F');
            } else {
                doc.setFillColor(255, 255, 255);
                doc.rect(summaryX, sumY, summaryBoxWidth, rowHeight, 'S');
            }

            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.setTextColor(isBold ? 255 : 0, isBold ? 255 : 0, isBold ? 255 : 0);
            doc.text(value, summaryX + summaryBoxWidth - 2, sumY + 4.5, { align: 'right' });

            sumY += rowHeight;
            doc.setTextColor(0, 0, 0); // reset
        };

        drawSummaryRow("Discount", discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        drawSummaryRow("Invoice Total", invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        drawSummaryRow("Truck Fare", paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        drawSummaryRow("Balance", currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), true);
        drawSummaryRow("Previous Balance", previousBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        drawSummaryRow("Total Balance", totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), true);

        // --- 6. Footer / Signatures ---
        const sigY = Math.max(sumY + 20, finalY + 45);

        doc.setDrawColor(180);
        doc.setLineWidth(0.5);

        // Signature 1: PREPARED BY
        doc.line(margin, sigY, margin + 40, sigY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.requestedBy || sale.requestedByUsername || "-", margin + 20, sigY - 2, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text("PREPARED BY", margin + 20, sigY + 5, { align: 'center' });

        // Signature 2: VERIFIED BY
        doc.line((pageWidth / 2) - 20, sigY, (pageWidth / 2) + 20, sigY);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.acceptedBy || sale.rejectedBy || "-", pageWidth / 2, sigY - 2, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text("VERIFIED BY", pageWidth / 2, sigY + 5, { align: 'center' });

        // Signature 3: AUTHORIZED SIGNATURE
        doc.line(pageWidth - margin - 40, sigY, pageWidth - margin, sigY);
        doc.setFont('helvetica', 'bold');
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - 20, sigY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Invoice PDF Generation Error:", error);
        alert(`Failed to generate Invoice PDF: ${error.message}`);
    }
};


export const generateProductHistoryPDF = (productName, category, activeTab, purchaseData, saleData, summary, filters) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 7; // Reduced margin to gain space
        const isFruitCategory = (category || '').toLowerCase() === 'fruit';

        // Ensure data is sorted ascending by date for reports
        const sortedPurchaseData = [...purchaseData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const sortedSaleData = [...saleData].sort((a, b) => new Date(a.date) - new Date(b.date));

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 50, 37, 100, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        const title = `${activeTab.toUpperCase()} HISTORY - ${productName.toUpperCase()}`;
        doc.text(title, pageWidth / 2, 42, { align: 'center' });

        // --- Helper for formatting date ---
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("Product:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(productName, margin + 25, yPos);

        doc.text(`Printed on: ${formatDate(new Date())}`, pageWidth - margin, yPos, { align: 'right' });

        yPos += 7;
        doc.setFont('helvetica', 'bold');
        doc.text("Date Range:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, margin + 25, yPos);

        if (filters.brand) {
            yPos += 7;
            doc.setFont('helvetica', 'bold');
            doc.text("Brand:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.brand, margin + 25, yPos);
        }
        if (filters.party) {
            yPos += 7;
            doc.setFont('helvetica', 'bold');
            doc.text("Party:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.party, margin + 25, yPos);
        }

        let currentY = yPos + 10;

        if (activeTab === 'total') {
            // --- Unified History Table ---
            const aggregatedPurchase = Object.values(sortedPurchaseData.reduce((acc, p) => {
                const key = `${p.date}_${p.lcNo}_${p.itemTruck || p.truckNo || ''}`;
                if (!acc[key]) acc[key] = { ...p, type: 'purchase', itemQty: 0, itemInHouseQty: 0, itemShortageQty: 0, brandsProcessed: new Set() };
                acc[key].itemQty += parseFloat(p.itemQty) || 0;

                const brandKey = (p.itemBrand || '').trim().toLowerCase();
                if (!acc[key].brandsProcessed.has(brandKey)) {
                    acc[key].itemInHouseQty += parseFloat(p.itemInHouseQty) || 0;
                    acc[key].brandsProcessed.add(brandKey);
                }

                acc[key].itemShortageQty += parseFloat(p.itemShortageQty) || 0;
                return acc;
            }, {}));

            const aggregatedSale = Object.values(sortedSaleData.reduce((acc, s) => {
                const key = `${s.date}_${s.invoiceNo}`;
                if (!acc[key]) acc[key] = { ...s, type: 'sale', itemQty: 0 };
                acc[key].itemQty += parseFloat(s.itemQty) || 0;
                return acc;
            }, {}));

            let currentBalance = 0;
            const processedLCTruckBrands = new Set();

            const unifiedData = [...aggregatedPurchase, ...aggregatedSale]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(item => {
                    if (item.type === 'purchase') {
                        const lcKey = `${(item.lcNo || '').trim()}_${(item.itemTruck || item.truckNo || '').trim()}_${(item.itemBrand || '').trim()}`;
                        if (!processedLCTruckBrands.has(lcKey)) {
                            currentBalance += item.itemInHouseQty;
                            processedLCTruckBrands.add(lcKey);
                        }
                    } else {
                        currentBalance -= item.itemQty;
                    }
                    return { ...item, runningInHouse: currentBalance };
                });

            // deduplicate In House Quantity calculation using the robust (StockTable + WhPortionOnce) logic
            let totalInHouseQty = 0;
            const truckBrandsSeen = new Set();

            sortedPurchaseData.forEach(item => {
                const bKey = (item.itemBrand || '').trim().toLowerCase();
                const truckKey = `${(item.lcNo || '').trim()}_${(item.itemTruck || item.truckNo || '').trim()}_${bKey}`;

                // 1. Always add the raw stock table remainder for this specific entry
                totalInHouseQty += parseFloat(item.inHouseQuantity) || 0;

                // 2. Add the shared warehouse portion ONLY once per truck/brand combination
                if (!truckBrandsSeen.has(truckKey)) {
                    const fullQty = parseFloat(item.itemInHouseQty) || 0;
                    const stockQty = parseFloat(item.inHouseQuantity) || 0;
                    const whPortion = Math.max(0, fullQty - stockQty);
                    totalInHouseQty += whPortion;
                    truckBrandsSeen.add(truckKey);
                }
            });

            const purchaseTotals = sortedPurchaseData.reduce((acc, item) => ({
                qty: acc.qty + (parseFloat(item.itemQty) || 0),
                inHouse: totalInHouseQty, // Use the pre-calculated unique total
                shortage: acc.shortage + (parseFloat(item.itemShortageQty) || 0)
            }), { qty: 0, inHouse: 0, shortage: 0 });

            const saleTotals = sortedSaleData.reduce((acc, sale) => ({
                qty: acc.qty + (parseFloat(sale.itemQty) || 0)
            }), { qty: 0 });

            const unifiedHead = [['Date', 'LC No', 'Exporter', 'Invoice', 'Party', 'Purchase', 'Sale', 'InHouse', 'Short']];
            const unifiedBody = unifiedData.map(item => [
                formatDate(item.date),
                item.lcNo || '-',
                item.itemExporter || '-',
                item.invoiceNo || '-',
                item.type === 'purchase' ? '-' : (item.companyName || '-'),
                item.type === 'purchase' ? `${Math.round(item.itemQty).toLocaleString('en-US')} kg` : '-',
                item.type === 'sale' ? `${Math.round(item.itemQty).toLocaleString('en-US')} kg` : '-',
                `${Math.round(item.runningInHouse).toLocaleString('en-US')} kg`,
                item.type === 'purchase' ? `${Math.round(item.itemShortageQty || 0).toLocaleString('en-US')} kg` : '-'
            ]);
            const unifiedFoot = [[
                { content: 'TOTAL HISTORY', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.qty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(saleTotals.qty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: `${Math.round(unifiedData[unifiedData.length - 1]?.runningInHouse || 0).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: `${Math.round(purchaseTotals.shortage).toLocaleString('en-IN')} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
            ]];

            autoTable(doc, {
                startY: currentY,
                head: unifiedHead,
                body: unifiedBody,
                foot: unifiedFoot,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, font: 'helvetica', textColor: [0, 0, 0], minCellHeight: 0 },
                headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' }, // Date
                    1: { cellWidth: 24, halign: 'center' }, // LC No
                    2: { cellWidth: 26, halign: 'left' },   // Exporter (Increased)
                    3: { cellWidth: 18, halign: 'center' }, // Invoice
                    4: { cellWidth: 34, halign: 'left' },   // Party (Increased)
                    5: { cellWidth: 21, halign: 'right' },  // Purchase
                    6: { cellWidth: 21, halign: 'right' },  // Sale
                    7: { cellWidth: 21, halign: 'right' },  // InHouse
                    8: { cellWidth: 13, halign: 'right' }   // Short
                },
                margin: { left: margin, right: margin }
            });

        } else if (activeTab === 'purchase') {
            // --- Purchase History Table (Single) ---
            const purchaseTotals = sortedPurchaseData.reduce((acc, item) => {
                const qty = parseFloat(item.itemQty) || 0;
                const price = parseFloat(item.itemPurchasedPrice) || 0;
                return {
                    pkt: acc.pkt + (parseInt(item.itemPacket) || 0),
                    qty: acc.qty + qty,
                    inHouse: acc.inHouse + (parseFloat(item.itemInHouseQty) || 0),
                    shortage: acc.shortage + (parseFloat(item.itemShortageQty) || 0),
                    totalValue: acc.totalValue + (price * qty)
                };
            }, { pkt: 0, qty: 0, inHouse: 0, shortage: 0, totalValue: 0 });

            const purchaseHead = [['Date', 'LC No', 'Exporter', 'Brand', 'Price', 'Bag', 'LC Qty', 'InHouse', 'Short']];
            const purchaseBody = sortedPurchaseData.map(item => [
                formatDate(item.date),
                item.lcNo || '-',
                item.itemExporter || '-',
                item.itemBrand || '-',
                `TK ${parseFloat(item.itemPurchasedPrice || 0).toLocaleString('en-IN')}`,
                item.itemPacket.toLocaleString('en-US'),
                `${Math.round(item.itemQty).toLocaleString('en-US')} kg`,
                `${Math.round(item.itemInHouseQty).toLocaleString('en-US')} kg`,
                `${Math.round(item.itemShortageQty || 0).toLocaleString('en-US')} kg`
            ]);
            const purchaseFoot = [[
                { content: 'TOTAL PURCHASE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `TK ${Math.round(purchaseTotals.totalValue).toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: purchaseTotals.pkt.toLocaleString('en-US'), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.qty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.inHouse).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: `${Math.round(purchaseTotals.shortage).toLocaleString('en-IN')} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
            ]];

            autoTable(doc, {
                startY: currentY,
                head: purchaseHead,
                body: purchaseBody,
                foot: purchaseFoot,
                theme: 'grid',
                styles: { fontSize: 8.5, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, font: 'helvetica', textColor: [0, 0, 0], minCellHeight: 0 },
                headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' }, // Date
                    1: { cellWidth: 20, halign: 'center' }, // LC No
                    2: { cellWidth: 28, halign: 'left' },   // Exporter (Increased)
                    3: { cellWidth: 40, halign: 'left' },   // Brand
                    4: { cellWidth: 16, halign: 'right' },  // Price
                    5: { cellWidth: 14, halign: 'right' },  // Bag
                    6: { cellWidth: 20, halign: 'right' },  // LC Qty
                    7: { cellWidth: 20, halign: 'right' },  // InHouse
                    8: { cellWidth: 18, halign: 'right' }   // Short
                },
                margin: { left: margin, right: margin }
            });

        } else if (activeTab === 'sale') {
            // --- Sale History Table (Single) ---
            const saleTotals = sortedSaleData.reduce((acc, sale) => ({
                qty: acc.qty + (parseFloat(sale.itemQty) || 0),
                amount: acc.amount + (parseFloat(sale.itemTotal) || 0)
            }), { qty: 0, amount: 0 });

            let saleHead, saleBody, saleFoot, saleColumnStyles;

            if (isFruitCategory) {
                saleHead = [['Date', 'Invoice', 'Company', 'Customer', 'Phone', 'Qty', 'Truck', 'Price', 'Total Price']];
                saleBody = sortedSaleData.map(sale => [
                    formatDate(sale.date),
                    sale.invoiceNo || '-',
                    sale.companyName || '-',
                    sale.customerName || '-',
                    sale.phone || '-',
                    `${sale.itemQty.toLocaleString('en-US')} kg`,
                    sale.itemTruck || '-',
                    `TK ${sale.itemPrice.toLocaleString('en-IN')}`,
                    `TK ${sale.itemTotal.toLocaleString('en-IN')}`
                ]);
                saleFoot = [[
                    { content: 'TOTAL SALE', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: `${Math.round(saleTotals.qty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: '-', colSpan: 2, styles: { halign: 'right' } },
                    { content: `TK ${Math.round(saleTotals.amount).toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
                ]];
                saleColumnStyles = {
                    0: { cellWidth: 20, halign: 'center' }, // Date (increased from 16)
                    1: { cellWidth: 16, halign: 'center' }, // Invoice
                    2: { cellWidth: 25, halign: 'left' },   // Company (slightly reduced from 26)
                    3: { cellWidth: 25, halign: 'left' },   // Customer (slightly reduced from 26)
                    4: { cellWidth: 22, halign: 'left' },   // Phone (reduced from 24)
                    5: { cellWidth: 24, halign: 'right' },  // Qty (increased from 20)
                    6: { cellWidth: 12, halign: 'center' }, // Truck (reduced from 16)
                    7: { cellWidth: 20, halign: 'right' },  // Price (reduced from 22)
                    8: { cellWidth: 26, halign: 'right' }   // Total Price (reduced from 30)
                };
            } else {
                saleHead = [['Date', 'Invoice', 'Company', 'Brand', 'Bag', 'Qty', 'Price', 'Total Price']];
                saleBody = sortedSaleData.map(sale => [
                    formatDate(sale.date),
                    sale.invoiceNo || '-',
                    sale.companyName || '-',
                    sale.itemBrand || '-',
                    sale.itemPacket.toLocaleString('en-US'),
                    `${sale.itemQty.toLocaleString('en-US')} kg`,
                    `TK ${sale.itemPrice.toLocaleString('en-IN')}`,
                    `TK ${sale.itemTotal.toLocaleString('en-IN')}`
                ]);
                saleFoot = [[
                    { content: 'TOTAL SALE', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: `${Math.round(saleTotals.qty).toLocaleString('en-US')} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: '-', styles: { halign: 'right' } },
                    { content: `TK ${Math.round(saleTotals.amount).toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
                ]];
                saleColumnStyles = {
                    0: { cellWidth: 20, halign: 'center' }, // Date
                    1: { cellWidth: 16, halign: 'center' }, // Invoice
                    2: { cellWidth: 36, halign: 'left' },   // Company (Increased)
                    3: { cellWidth: 34, halign: 'left' },   // Brand
                    4: { cellWidth: 18, halign: 'right' },  // Packet
                    5: { cellWidth: 20, halign: 'right' },  // Qty
                    6: { cellWidth: 22, halign: 'right' },  // Price
                    7: { cellWidth: 30, halign: 'right' }   // Total Price
                };
            }

            autoTable(doc, {
                startY: currentY,
                head: saleHead,
                body: saleBody,
                foot: saleFoot,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, font: 'helvetica', textColor: [0, 0, 0], minCellHeight: 0 },
                headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
                columnStyles: saleColumnStyles,
                margin: { left: margin, right: margin }
            });
        }

        // --- Signatures (Directly under table) ---
        let sigY = doc.lastAutoTable.finalY + 25;

        // If signatures won't fit on current page, add a new page
        if (sigY + 20 > pageHeight) {
            doc.addPage();
            sigY = 30; // Start at top of new page
        }

        doc.setDrawColor(0);
        doc.setFontSize(8);
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');

        doc.line(margin, sigY, margin + 40, sigY);
        doc.text("PREPARED BY", margin + 20, sigY + 5, { align: 'center' });

        doc.line(pageWidth / 2 - 20, sigY, pageWidth / 2 + 20, sigY);
        doc.text("VERIFIED BY", pageWidth / 2, sigY + 5, { align: 'center' });

        doc.line(pageWidth - margin - 40, sigY, pageWidth - margin, sigY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - 20, sigY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("Product History PDF Error:", error);
        alert(`Failed to generate PDF: ${error.message}`);
    }
};

export const generateSalesReportPDF = (reportData, filters, summary, saleType = 'General') => {
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

        // --- Configuration ---
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 5;

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`${saleType.toUpperCase()} SALES REPORT`, pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);

        // Date Range
        doc.setFont('helvetica', 'bold');
        doc.text("Date Range:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, margin + 25, yPos);

        if (filters.companyName) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Customer:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.companyName, margin + 25, yPos);
        }

        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Table ---
        const tableRows = [];
        let slNum = 1;

        const sortedReportData = [...reportData].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedReportData.forEach((sale) => {
            // Create flattened list of all entries across all items
            const flatItems = (sale.items || []).flatMap(item => {
                const entries = (item.brandEntries && item.brandEntries.length > 0)
                    ? item.brandEntries
                    : [{ brandName: item.brand || '-', quantity: item.quantity, unitPrice: 0, totalAmount: item.totalAmount }];

                return entries.map((entry, subIdx) => ({
                    productName: item.productName || item.product || '-',
                    brand: entry.brandName || entry.brand || '-',
                    quantity: entry.quantity || 0,
                    truck: entry.truck || sale.truck || '-',
                    price: entry.unitPrice || 0,
                    total: entry.totalAmount || 0,
                    isFirstInProduct: subIdx === 0,
                    productSpan: entries.length
                }));
            });

            // If no items, fallback to sale level
            if (flatItems.length === 0) {
                flatItems.push({
                    productName: sale.productName || '-',
                    brand: sale.brand || '-',
                    quantity: sale.quantity || 0,
                    price: 0,
                    total: sale.totalAmount || 0,
                    lcNo: sale.lcNo || '-',
                    isFirstInProduct: true,
                    productSpan: 1
                });
            }

            flatItems.forEach((item, idx) => {
                const row = [];

                if (idx === 0) {
                    row.push({ content: (slNum++).toString(), rowSpan: flatItems.length, styles: { halign: 'center' } });
                    row.push({ content: formatDate(sale.date), rowSpan: flatItems.length, styles: { halign: 'center' } });
                    row.push({ content: (saleType === 'Border' ? (sale.lcNo || '-') : (sale.invoiceNo || '-')), rowSpan: flatItems.length, styles: { halign: 'center' } });

                    if (saleType === 'Border') {
                        row.push({ content: (sale.importer || '-'), rowSpan: flatItems.length });
                        row.push({ content: (sale.port || '-'), rowSpan: flatItems.length });
                        row.push({ content: (sale.indianCnF || '-'), rowSpan: flatItems.length });
                        row.push({ content: (sale.bdCnf || '-'), rowSpan: flatItems.length });
                        row.push({ content: (sale.companyName || sale.customerName || '-'), rowSpan: flatItems.length });
                    } else {
                        row.push({ content: (sale.companyName || '-'), rowSpan: flatItems.length });
                    }
                }

                if (item.isFirstInProduct) {
                    row.push({ content: item.productName, rowSpan: item.productSpan });
                }

                if (saleType !== 'Border') {
                    row.push(item.brand);
                }

                if (saleType !== 'Border' && idx === 0) {
                    row.push({ content: (sale.challanNo || '-'), rowSpan: flatItems.length });
                    row.push({ content: (sale.truckNo || '-'), rowSpan: flatItems.length });
                }

                row.push(parseFloat(item.quantity).toLocaleString('en-US'));

                if (saleType === 'Border') {
                    row.push(item.truck || sale.truck || '-');
                }

                row.push(saleType === 'Border'
                    ? (parseFloat(item.price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : (parseFloat(item.price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                row.push(saleType === 'Border'
                    ? (parseFloat(item.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : (parseFloat(item.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

                if (saleType !== 'Border' && idx === 0) {
                    row.push({ content: (parseFloat(sale.paidAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), rowSpan: flatItems.length, styles: { halign: 'right' } });
                    row.push({ content: ((parseFloat(sale.totalAmount || 0) - parseFloat(sale.paidAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), rowSpan: flatItems.length, styles: { halign: 'right' } });
                }

                tableRows.push(row);
            });
        });

        const totalTrucks = saleType === 'Border' ? reportData.reduce((sum, sale) => {
            const items = sale.items || [];
            const truckTotal = items.reduce((iSum, item) => {
                const brandEntries = item.brandEntries || [];
                return iSum + brandEntries.reduce((bSum, entry) => bSum + (parseFloat(entry.truck) || 0), 0);
            }, 0);
            return sum + (items.length > 0 ? truckTotal : (parseFloat(sale.truck) || 0));
        }, 0) : 0;

        const totalDiscount = reportData.reduce((sum, s) => sum + (parseFloat(s.discount) || 0), 0);

        const headRow = saleType === 'Border'
            ? [['SL', 'Date', 'LC No', 'Importer', 'Port', 'IND C&F', 'BD C&F', 'Party Name', 'Product', 'Qty', 'Truck', 'Price', 'Total']]
            : [['SL', 'Date', 'Invoice', 'Company', 'Product', 'Brand', 'Challan No', 'Truck No', 'Qty', 'Price', 'Total', 'Truck Fare', 'Balance']];

        const footRow = [[
            { content: 'GRAND TOTAL', colSpan: saleType === 'Border' ? 9 : 8, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: saleType === 'Border' ? '-' : summary.totalQty.toLocaleString('en-US'), styles: { halign: 'right', fontStyle: 'bold' } },
            { content: saleType === 'Border' ? totalTrucks.toLocaleString('en-US') : '', styles: { halign: 'center', fontStyle: 'bold' } },
            ...(saleType === 'Border' ? [
                { content: '', styles: { halign: 'right', fontStyle: 'bold' } }
            ] : []),
            { content: saleType === 'Border' ? summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
            ...(saleType === 'Border' ? [] : [
                { content: summary.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: (summary.totalAmount - summary.totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
            ])
        ]];

        autoTable(doc, {
            startY: yPos + 10,
            head: headRow,
            body: tableRows,
            foot: footRow,
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 1,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                valign: 'middle',
                textColor: [0, 0, 0],
                overflow: 'ellipsize'
            },
            headStyles: {
                fillColor: [240, 240, 240],
                fontStyle: 'bold',
                halign: 'center'
            },
            footStyles: {
                fillColor: [240, 240, 240],
                fontStyle: 'bold'
            },
            columnStyles: saleType === 'Border' ? {
                0: { cellWidth: 10, halign: 'center' },     // SL
                1: { cellWidth: 20, halign: 'center' },    // Date
                2: { cellWidth: 25, halign: 'center' },    // LC No (Reduced)
                3: { cellWidth: 30, noWrap: true },        // Importer
                4: { cellWidth: 18, noWrap: true },        // Port
                5: { cellWidth: 26, noWrap: true },        // IND C&F
                6: { cellWidth: 26, noWrap: true },        // BD C&F
                7: { cellWidth: 36, noWrap: true },        // Party Name
                8: { cellWidth: 18, overflow: 'linebreak' }, // Product (Reduced)
                9: { cellWidth: 22, halign: 'right' },     // Qty
                10: { cellWidth: 12, halign: 'center' },   // Truck
                11: { cellWidth: 18, halign: 'right' },    // Price (Reduced)
                12: { cellWidth: 24, halign: 'right' }     // Total
            } : {
                0: { cellWidth: 9, halign: 'center' },     // SL
                1: { cellWidth: 20, halign: 'center' },    // Date
                2: { cellWidth: 16, halign: 'center' },    // Invoice (Reduced)
                3: { cellWidth: 35 },                       // Company
                4: { cellWidth: 22, overflow: 'linebreak' }, // Product
                5: { cellWidth: 30, noWrap: false, overflow: 'linebreak' }, // Brand
                6: { cellWidth: 19, overflow: 'linebreak' }, // Challan No
                7: { cellWidth: 20, overflow: 'linebreak' }, // Truck No
                8: { cellWidth: 18, halign: 'right' },     // Qty
                9: { cellWidth: 15, halign: 'right' },     // Price
                10: { cellWidth: 26, halign: 'right' },    // Total
                11: { cellWidth: 22, halign: 'right' },    // Truck Fare (Reduced)
                12: { cellWidth: 30, halign: 'right' }     // Balance
            },
            margin: { left: saleType === 'Border' ? (pageWidth - 277) / 2 : (pageWidth - 277) / 2, right: margin }
        });

        // --- Signatures ---
        let finalY = doc.lastAutoTable.finalY + 30;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 30;
        }

        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("Sales PDF Generation Error:", error);
        alert(`Failed to generate Sales PDF: ${error.message}`);
    }
};


export const generateCustomerReportPDF = (customers, typeFilter, grandTotalDue, dateStr) => {
    try {
        const doc = new jsPDF();

        const computeDue = (customer) => {
            const salesHistory = customer.salesHistory || [];
            const paymentHistory = customer.paymentHistory || [];

            const totalAmount = salesHistory.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            const totalPaid = salesHistory.reduce((s, i) => s + (parseFloat(i.paid) || 0), 0);
            const totalDiscount = salesHistory.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
            const totalHistoryPaid = paymentHistory.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

            return totalAmount - totalPaid - totalDiscount - totalHistoryPaid;
        };

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // Filter out customers with zero balance
        const activeCustomers = customers.filter(c => {
            const due = computeDue(c);
            return Math.abs(due) > 0.01; // Avoid floating point issues with zero
        });

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("CUSTOMER BALANCE REPORT", pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);

        if (typeFilter && typeFilter !== 'All Customer') {
            doc.setFont('helvetica', 'bold');
            doc.text("Customer Type:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(typeFilter, margin + 30, yPos);
            yPos += 5;
        }

        doc.setFont('helvetica', 'bold');
        doc.text("Total Records:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(activeCustomers.length.toString(), margin + 30, yPos);

        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        const getLastTransDay = (customer) => {
            const payments = customer.paymentHistory || [];
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

        // --- Table ---
        const tableRows = [];
        activeCustomers.forEach((c, idx) => {
            const due = computeDue(c);
            tableRows.push([
                idx + 1,
                c.customerId || '-',
                c.companyName || c.customerName || '-',
                getLastTransDay(c),
                {
                    content: `Tk ${Math.round(due).toLocaleString('en-IN')}`,
                    styles: { fontStyle: due < 0 ? 'bold' : 'normal', halign: 'right' }
                },
                '' // Remark field
            ]);
        });

        // Add Grand Total
        tableRows.push([
            { content: 'GRAND TOTAL BALANCE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: `Tk ${Math.round(grandTotalDue).toLocaleString('en-IN')}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [220, 38, 38] } },
            { content: '', styles: { fillColor: [240, 240, 240] } } // Remark empty total cell
        ]);

        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'ID', 'Company', 'Last Trans. Day', 'Total Balance', 'Remark']],
            body: tableRows,
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0]
            },
            headStyles: {
                fillColor: [245, 245, 245],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' }, // SL
                1: { cellWidth: 20 },                   // ID
                2: { cellWidth: 45 },                   // Company
                3: { cellWidth: 30, halign: 'center' }, // Last Trans. Day
                4: { cellWidth: 35, halign: 'right' },  // Total Balance
                5: { cellWidth: 50 }                    // Remark
            },
            margin: { left: margin, right: margin }
        });

        // --- Signatures ---
        let finalY = doc.lastAutoTable.finalY + 30;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 30;
        }

        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Customer Report PDF Generation Error:", error);
        alert(`Failed to generate Customer Report PDF: ${error.message}`);
    }
};

export const generatePaymentCollectionReportPDF = (payments, filters, dateStr) => {
    try {
        const doc = new jsPDF();

        // Use a format similar to other reports
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 45, 37, 90, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("PAYMENT COLLECTION REPORT", pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);

        doc.setFont('helvetica', 'bold');
        doc.text("Total Records:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text((payments.length || 0).toString(), margin + 30, yPos);

        if (filters?.startDate) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Start Date:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(filters.startDate), margin + 30, yPos);
        }

        if (filters?.endDate) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("End Date:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(filters.endDate), margin + 30, yPos);
        }

        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Table ---
        const tableRows = [];
        let grandTotal = 0;

        const sortedPayments = [...payments].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedPayments.forEach((p, idx) => {
            const amount = parseFloat(p.amount) || 0;
            grandTotal += amount;

            tableRows.push([
                idx + 1,
                formatDate(p.date),
                p.companyName || p.customerName || '-',
                p.method || '-',
                p.method === 'Cash' ? (p.receiveBy || '-') : (p.bankName || '-'),
                p.method === 'Cash' ? (p.place || '-') : (p.branch || '-'),
                p.accountNo || '-',
                `Tk ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);
        });

        // Add Grand Total
        tableRows.push([
            { content: 'GRAND TOTAL', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: `${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }
        ]);

        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'Date', 'Party Name', 'Method', 'Bank/Receiver', 'Branch', 'Account No', 'Amount']],
            body: tableRows,
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 1.2,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0],
                noWrap: true
            },
            headStyles: {
                fillColor: [245, 245, 245],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },  // SL
                1: { cellWidth: 18 },                   // Date
                2: { cellWidth: 32 },                   // Party
                3: { cellWidth: 25 },                   // Method
                4: { cellWidth: 32 },                   // Bank
                5: { cellWidth: 18 },                   // Branch
                6: { cellWidth: 27 },                   // Acct
                7: { cellWidth: 29, halign: 'right' }   // Amount
            },
            margin: { left: margin, right: margin }
        });

        // --- Signatures ---
        let finalY = doc.lastAutoTable.finalY + 30;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 30;
        }

        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Payment Collection Report PDF Generation Error:", error);
        alert(`Failed to generate Payment Collection Report PDF: ${error.message}`);
    }
};

export const generateCustomerHistoryPDF = (customer, historyData, summary, filters, activeTab) => {
    try {
        const isSales = activeTab === 'sales';
        const isAll = activeTab === 'all';
        const isPayment = activeTab === 'payment';

        // Match the orientation and margin of other reports
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 5; // Standard margin in other reports

        // Ensure history data is sorted ascending by date for reports
        const sortedHistoryData = [...historyData].sort((a, b) => new Date(a.date) - new Date(b.date));

        // --- Header (Matching generateSalesReportPDF) ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 50, 37, 100, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        let reportTitle = "";
        if (isSales) reportTitle = "CUSTOMER SALES HISTORY";
        else if (isPayment) reportTitle = "CUSTOMER PAYMENT HISTORY";
        else if (isAll) reportTitle = "CUSTOMER ALL TRANSACTION HISTORY";
        doc.text(reportTitle, pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("Company:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(customer.companyName || '-', margin + 25, yPos);

        if (customer.customerName && customer.customerName !== customer.companyName) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Customer:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(customer.customerName, margin + 25, yPos);
        }

        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text("Contact:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(customer.phone || '-', margin + 25, yPos);

        if (filters.startDate || filters.endDate) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Date Range:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            const start = filters.startDate ? formatDate(filters.startDate) : 'Start';
            const end = filters.endDate ? formatDate(filters.endDate) : 'Present';
            doc.text(`${start} to ${end}`, margin + 25, yPos);
        }

        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Table ---
        const tableRows = [];
        const customerType = (customer.customerType || '').toLowerCase();
        const isParty = customerType.includes('party');

        if (isAll) {
            let grandQty = 0;
            let grandAmt = 0;
            let grandPaid = 0;
            let grandTrucks = 0;

            // Merge same invoice numbers
            const chronoHistory = sortedHistoryData.reduce((acc, item) => {
                const invoice = item.invoiceNo || item.lcNo;
                const existing = item.type === 'sale' && invoice
                    ? acc.find(x => x.type === 'sale' && (x.invoiceNo === invoice || x.lcNo === invoice))
                    : null;

                if (existing) {
                    existing.amount = (parseFloat(existing.amount || 0)) + (parseFloat(item.amount || 0));
                    existing.paid = (parseFloat(existing.paid || 0)) + (parseFloat(item.paid || 0));
                    existing.truck = (parseFloat(existing.truck || 0)) + (parseFloat(item.truck || 0));

                    // Initialize sub-items for merging logic if not present
                    if (!existing.items) {
                        existing.items = [{
                            product: existing.product_original || existing.product,
                            quantity: parseFloat(existing.quantity_original || existing.quantity),
                            rate: parseFloat(existing.rate_original || existing.rate)
                        }];
                    }

                    const itemRate = parseFloat(item.rate || 0);
                    const matchingItem = existing.items.find(si =>
                        (si.product?.trim() === item.product?.trim()) &&
                        (parseFloat(si.rate || 0) === itemRate)
                    );
                    if (matchingItem) {
                        matchingItem.quantity += parseFloat(item.quantity || 0);
                    } else {
                        existing.items.push({
                            product: item.product,
                            quantity: parseFloat(item.quantity || 0),
                            rate: itemRate
                        });
                    }

                    // Rebuild display properties (PDF uses clean numbers without Taka symbol)
                    existing.product = existing.items.map(si => si.product || '—').join('\n');
                    existing.quantity_display = existing.items.map(si => (si.quantity || 0).toLocaleString('en-US')).join('\n');
                    existing.rate_display = existing.items.map(si => (si.rate || 0) > 0 ? si.rate.toLocaleString('en-IN') : '—').join('\n');

                    existing.quantity = (parseFloat(existing.quantity || 0)) + (parseFloat(item.quantity || 0));
                    existing.runningBalance = item.runningBalance;
                    return acc;
                }
                acc.push({
                    ...item,
                    product_original: item.product,
                    quantity_original: item.quantity,
                    rate_original: item.rate
                });
                return acc;
            }, []);

            let lastBalance = chronoHistory.length > 0 ? chronoHistory[chronoHistory.length - 1].runningBalance : 0;

            chronoHistory.forEach((item, idx) => {
                const qty = item.type === 'sale' ? parseFloat(item.quantity || 0) : 0;
                const amt = item.type === 'sale' ? parseFloat(item.amount || 0) : 0;
                const paid = item.type === 'sale' ? parseFloat(item.paid || 0) : parseFloat(item.amount || 0);
                const runningBal = parseFloat(item.runningBalance || 0);
                const trucks = parseFloat(item.truck || 0) || 0;

                grandQty += qty;
                grandAmt += amt;
                grandPaid += paid;
                grandTrucks += trucks;

                const details = item.type === 'payment'
                    ? `${item.method === 'Cash' ? (item.receiveBy || item.method) : (item.bankName || item.mobileType || item.method)}${item.method && (item.bankName || item.receiveBy || item.mobileType) ? ` (${item.method})` : ''}${item.reference ? ` [Ref: ${item.reference}]` : ''}${parseFloat(item.discount) > 0 ? `\n(Disc: Tk ${parseFloat(item.discount).toLocaleString('en-IN')})` : ''}`
                    : (parseFloat(item.paid || 0) > 0 ? 'Truck Fare' : '-');

                const row = [
                    idx + 1,
                    formatDate(item.date),
                    item.invoiceNo || item.lcNo || '-',
                    item.product || '-'
                ];

                if (isParty) {
                    row.push(item.truck || '-');
                }

                row.push(
                    item.type === 'sale' ? (item.quantity_display || (qty > 0 ? qty.toLocaleString('en-US') : '-')) : '-',
                    item.type === 'sale' ? (item.rate_display || (parseFloat(item.rate || 0) > 0 ? parseFloat(item.rate || 0).toLocaleString('en-IN') : '-')) : '-',
                    amt > 0 ? `${amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-',
                    details,
                    paid > 0 ? `${paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-',
                    `${runningBal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                );
                tableRows.push(row);
            });

            const head = ['SL', 'Date', isParty ? 'LC No' : 'Invoice No', 'Product'];
            if (isParty) head.push('Truck');
            head.push('Qty', 'Rate', 'Amount', 'Payment Details', 'Paid', 'Balance');

            const foot = [
                { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            ];
            if (isParty) {
                foot.push({ content: grandTrucks.toLocaleString('en-US'), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } });
            }
            foot.push(
                { content: grandQty.toLocaleString('en-US'), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: '', styles: { fillColor: [240, 240, 240] } },
                { content: grandAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: '', styles: { fillColor: [240, 240, 240] } },
                { content: grandPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: lastBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
            );

            autoTable(doc, {
                startY: yPos + 10,
                head: [head],
                body: tableRows,
                foot: [foot],
                theme: 'grid',
                styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
                headStyles: { fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'center' },
                columnStyles: isParty ? {
                    0: { halign: 'center', cellWidth: 7 },
                    1: { cellWidth: 18, halign: 'center' },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 25 },
                    4: { cellWidth: 15, halign: 'center' },
                    5: { halign: 'right', cellWidth: 15 },
                    6: { halign: 'right', cellWidth: 15 },
                    7: { halign: 'right', cellWidth: 20 },
                    8: { cellWidth: 25 },
                    9: { halign: 'right', cellWidth: 20 },
                    10: { halign: 'right', cellWidth: 20 }
                } : {
                    0: { halign: 'center', cellWidth: 7 },
                    1: { cellWidth: 18, halign: 'center' },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 25 },
                    4: { halign: 'right', cellWidth: 18 }, // Qty
                    5: { halign: 'right', cellWidth: 15 }, // Rate
                    6: { halign: 'right', cellWidth: 22 }, // Amount
                    7: { cellWidth: 35 }, // Details
                    8: { halign: 'right', cellWidth: 20 }, // Paid
                    9: { halign: 'right', cellWidth: 22 }  // Balance
                },
                margin: { left: margin, right: margin }
            });
        } else if (isSales) {
            let totalQty = 0, totalAmt = 0, totalDisc = 0, totalTrucksCount = 0;
            let slIndex = 1;

            const invoiceGroups = [];
            sortedHistoryData.forEach(item => {
                const dateStr = formatDate(item.date);
                const invNo = item.lcNo || item.invoiceNo || '-';
                const key = `${dateStr}_${invNo}`;

                let ig = invoiceGroups.find(g => g.key === key);
                if (!ig) {
                    ig = { key, dateStr, invNo, products: [] };
                    invoiceGroups.push(ig);
                }
                const prodKey = item.product || '-';
                let pg = ig.products.find(p => p.prodKey === prodKey);
                if (!pg) {
                    pg = { prodKey, items: [] };
                    ig.products.push(pg);
                }
                pg.items.push(item);
            });

            invoiceGroups.forEach((ig) => {
                const totalRowsForInv = ig.products.reduce((sum, p) => sum + p.items.length, 0);
                let isFirstRowOfInv = true;

                ig.products.forEach((pg) => {
                    const totalRowsForProd = pg.items.length;
                    let isFirstRowOfProd = true;

                    pg.items.forEach((item) => {
                        const qty = parseFloat(item.quantity || 0);
                        const amt = parseFloat(item.amount || 0);
                        const disc = parseFloat(item.discount || 0);
                        const trucksCount = parseFloat(item.truck || 0);
                        totalQty += qty;
                        totalAmt += amt;
                        totalDisc += disc;
                        if (!isNaN(trucksCount)) totalTrucksCount += trucksCount;

                        const row = [];

                        // Merged SL, Date and Invoice
                        if (isFirstRowOfInv) {
                            row.push({ content: slIndex++, rowSpan: totalRowsForInv, styles: { halign: 'center', valign: 'middle' } });
                            row.push({ content: ig.dateStr, rowSpan: totalRowsForInv, styles: { halign: 'center', valign: 'middle' } });
                            row.push({ content: ig.invNo, rowSpan: totalRowsForInv, styles: { valign: 'middle' } });
                        }

                        // Merged Product
                        if (isFirstRowOfProd) {
                            row.push({ content: pg.prodKey, rowSpan: totalRowsForProd, styles: { valign: 'middle' } });
                        }

                        if (isParty) {
                            row.push(item.truck || '-');
                        } else {
                            row.push(item.brand || '-');
                        }

                        row.push(
                            { content: qty.toLocaleString('en-US'), styles: { halign: 'right' } },
                            { content: `${parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } },
                            { content: `${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } },
                            { content: `${disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, styles: { halign: 'right' } }
                        );

                        tableRows.push(row);

                        isFirstRowOfInv = false;
                        isFirstRowOfProd = false;
                    });
                });
            });

            // Add Grand Total row
            tableRows.push([
                { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: isParty ? totalTrucksCount.toLocaleString('en-US') : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalQty.toLocaleString('en-US'), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: '', styles: { fillColor: [240, 240, 240] } },
                { content: totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

            const headers = isParty
                ? [['SL', 'Date', 'LC No', 'Product', 'Truck', 'Qty', 'Rate', 'Amount', 'Disc']]
                : [['SL', 'Date', 'Invoice No', 'Product', 'Brand', 'Qty', 'Rate', 'Amount', 'Disc']];

            autoTable(doc, {
                startY: yPos + 10,
                head: headers,
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 8.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                headStyles: { fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'center' },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 8 },    // SL
                    1: { cellWidth: 20, halign: 'center' },   // Date
                    2: { cellWidth: 25 },                     // LC No / Invoice No
                    3: { cellWidth: 25 },                     // Product
                    4: { halign: 'center', cellWidth: 40 },    // Brand / Truck
                    5: { halign: 'right', cellWidth: 20 },    // Qty
                    6: { halign: 'right', cellWidth: 20 },    // Rate
                    7: { halign: 'right', cellWidth: 27 },    // Amount
                    8: { halign: 'right', cellWidth: 15 }     // Disc
                },
                margin: { left: margin, right: margin }
            });
        } else {
            let totalCollectedAmt = 0;
            sortedHistoryData.forEach((item, idx) => {
                const amt = parseFloat(item.amount || 0);
                const disc = parseFloat(item.discount || 0);
                totalCollectedAmt += amt;
                tableRows.push([
                    idx + 1,
                    formatDate(item.date),
                    item.method || '-',
                    `${item.method === 'Cash' ? (item.receiveBy || '-') : (item.bankName || item.mobileType || '-')}${disc > 0 ? `\n(Disc: Tk ${disc.toLocaleString('en-IN')})` : ''}`,
                    item.method === 'Cash' ? (item.place || '-') : (item.branch || '-'),
                    item.accountNo || '-',
                    `${amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                ]);
            });

            // Add Grand Total row for Payment
            tableRows.push([
                { content: 'GRAND TOTAL', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalCollectedAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
            ]);

            autoTable(doc, {
                startY: yPos + 10,
                head: [['SL', 'Date', 'Method', 'Bank / Receiver', 'Branch / Place', 'Acc No / Ref', 'Amount']],
                body: tableRows,
                theme: 'grid',
                styles: { fontSize: 8.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                headStyles: { fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'center' },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 45 },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 30 },
                    6: { halign: 'right', cellWidth: 25 }
                },
                margin: { left: margin, right: margin }
            });
        }

        // --- Signatures ---
        yPos = doc.lastAutoTable.finalY + 30;
        if (yPos + 40 > pageHeight) {
            doc.addPage();
            yPos = 30;
        }

        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.line(margin, yPos, margin + sigWidth, yPos);
        doc.text("PREPARED BY", margin + sigWidth / 2, yPos + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, yPos, margin + sigWidth + sigGap + sigWidth, yPos);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + (sigWidth / 2), yPos + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, yPos, pageWidth - margin, yPos);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - (sigWidth / 2), yPos + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Customer History PDF Error:", error);
        alert(`Failed to generate PDF: ${error.message}`);
    }
};

export const generateCnFHistoryReportPDF = (reportData, agentInfo, filters) => {
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

        // --- Configuration ---
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("C&F HISTORY REPORT", pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        doc.setFontSize(9);

        // Agent Info (Box Style)
        doc.setFont('helvetica', 'bold');
        doc.text("Agent Name:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.name || '-', margin + 22, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent ID:", margin, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.cnfId || '-', margin + 22, yPos + 6);

        // Right Side: Date Range, Printed On
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        const rightColX = pageWidth - margin - 70; // Increased spacing for long date ranges

        doc.setFont('helvetica', 'bold');
        doc.text("Printed on:", rightColX, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth - margin, yPos, { align: 'right' });

        if (filters.startDate || filters.endDate) {
            doc.setFont('helvetica', 'bold');
            doc.text("Date Range:", rightColX, yPos + 6);
            doc.setFont('helvetica', 'normal');
            doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, pageWidth - margin, yPos + 6, { align: 'right' });
        }

        // --- Data Preparation ---
        const sortedReportData = [...reportData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const tableRows = sortedReportData.map((row, index) => [
            formatDate(row.date),
            row.lcNo || '-',
            row.importer || '-',
            row.exporter || '-',
            row.product || '-',
            row.port || '-',
            row.uom || '-',
            row.truck || '0',
            parseFloat(row.qty || 0).toLocaleString('en-US'),
            parseFloat(row.commission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            parseFloat(row.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]);

        // Totals
        const totalTrucks = reportData.reduce((sum, row) => sum + (parseFloat(row.truck) || 0), 0);
        const totalQty = reportData.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
        const totalCommissionVal = reportData.reduce((sum, row) => sum + (parseFloat(row.totalCommission) || 0), 0);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 15,
            head: [['Date', 'LC No', 'Importer', 'Exporter', 'Product', 'Port', 'UOM', 'Trucks', 'QTY', 'Commission', 'Total']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } }, // Date, LC, Importer, Exporter, Product, Port, UOM
                { content: totalTrucks.toString(), styles: { halign: 'center', fontStyle: 'bold' } },
                { content: totalQty.toLocaleString('en-US'), styles: { halign: 'right', fontStyle: 'bold' } },
                '', // Commission rate col
                { content: totalCommissionVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
            theme: 'plain',
            styles: {
                fontSize: 9.5,
                cellPadding: 1.2,
                lineColor: [0, 0, 0],
                lineWidth: 0.15,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.15
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.15
            },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' }, // Date
                1: { cellWidth: 28, halign: 'left' }, // LC No
                2: { cellWidth: 36, halign: 'left' },   // Importer
                3: { cellWidth: 38, halign: 'left' },   // Exporter
                4: { cellWidth: 25, halign: 'left' },   // Product
                5: { cellWidth: 22, halign: 'center' }, // Port
                6: { cellWidth: 16, halign: 'center' }, // UOM
                7: { cellWidth: 15, halign: 'center' }, // Trucks
                8: { cellWidth: 20, halign: 'right' },  // QTY
                9: { cellWidth: 24, halign: 'right' },  // Commission
                10: { cellWidth: 31, halign: 'right' }   // Total
            }
        });

        // --- Signatures ---
        let finalY = doc.lastAutoTable.finalY + 40;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 40;
        }

        const sigWidth = 40;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setLineWidth(0.2);
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.setFontSize(8);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        // Open in new tab
        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("C&F PDF Error:", error);
        alert(`Failed to generate C&F PDF: ${error.message}`);
    }
};

export const generateCnFExpenseReportPDF = (reportData, agentInfo, filters) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // Header
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("LC EXPENSE REPORT", pageWidth / 2, 42, { align: 'center' });

        let yPos = 55;
        doc.setFontSize(9);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent Name:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.name || '-', margin + 22, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent ID:", margin, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.cnfId || '-', margin + 22, yPos + 6);

        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        const rightColX = pageWidth - margin - 70;

        doc.setFont('helvetica', 'bold');
        doc.text("Printed on:", rightColX, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth - margin, yPos, { align: 'right' });

        if (filters.startDate || filters.endDate) {
            doc.setFont('helvetica', 'bold');
            doc.text("Date Range:", rightColX, yPos + 6);
            doc.setFont('helvetica', 'normal');
            doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, pageWidth - margin, yPos + 6, { align: 'right' });
        }

        const tableRows = reportData.map((row) => [
            formatDate(row.date),
            row.lcNo || '-',
            row.importer || '-',
            row.product || '-',
            row.port || '-',
            parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]);

        const totalAmount = reportData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);

        autoTable(doc, {
            startY: yPos + 15,
            head: [['Billing Date', 'LC No', 'Importer', 'Product', 'Port', 'Amount']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
            theme: 'plain',
            styles: {
                fontSize: 9.5,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.15,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.15
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.15
            },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 30, halign: 'center' },
                2: { cellWidth: 40, halign: 'left' },
                3: { cellWidth: 40, halign: 'left' },
                4: { cellWidth: 25, halign: 'center' },
                5: { cellWidth: 30, halign: 'right' }
            }
        });

        let finalY = doc.lastAutoTable.finalY + 40;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 40;
        }

        const sigWidth = 40;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setLineWidth(0.2);
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.setFontSize(8);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert(`Failed to generate PDF: ${error.message}`);
    }
};

export const generateCnFAgentListReportPDF = (agents, moduleType) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // Separator
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Report Title
        const reportTitle = `${moduleType ? moduleType + ' ' : ''}C&F AGENT REPORT`;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 50, 37, 100, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle, pageWidth / 2, 42, { align: 'center' });

        // --- Info Row ---
        let yPos = 55;
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.setFontSize(9);

        doc.setFont('helvetica', 'bold');
        doc.text("Total Agents:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(String(agents.length), margin + 24, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text("Printed on:", pageWidth - margin - 50, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth - margin, yPos, { align: 'right' });

        // --- Table ---
        let grandTotal = 0;

        const tableRows = agents.map((agent, index) => {
            const balance = parseFloat(agent.totalBalance) || 0;
            grandTotal += balance;
            return [
                index + 1,
                agent.cnfId || '-',
                agent.name || '-',
                agent.contactPerson || '-',
                agent.phone || '-',
                balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
        });

        // Grand total row
        tableRows.push([
            { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] } },
            { content: grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] } }
        ]);

        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'ID', 'Name', 'Contact Person', 'Phone', 'Total Balance']],
            body: tableRows,
            theme: 'grid',
            styles: {
                fontSize: 9,
                cellPadding: 3,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [245, 245, 245],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 14, halign: 'center' },   // SL
                1: { cellWidth: 24 },                     // ID
                2: { cellWidth: 54 },                     // Name
                3: { cellWidth: 33 },                     // Contact
                4: { cellWidth: 35 },                     // Phone
                5: { cellWidth: 30, halign: 'right' }     // Total Balance
            },
            margin: { left: margin, right: margin }
        });

        // --- Signatures ---
        let finalY = doc.lastAutoTable.finalY + 30;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 30;
        }

        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("C&F Agent List PDF Error:", error);
        alert(`Failed to generate C&F Agent List PDF: ${error.message}`);
    }
};

export const generateCnFPaymentReportPDF = (reportData, agentInfo, filters) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // Header
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("C&F PAYMENT REPORT", pageWidth / 2, 42, { align: 'center' });

        let yPos = 55;
        doc.setFontSize(9);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent Name:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.name || '-', margin + 22, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent ID:", margin, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.cnfId || '-', margin + 22, yPos + 6);

        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        const rightColX = pageWidth - margin - 70;

        doc.setFont('helvetica', 'bold');
        doc.text("Printed on:", rightColX, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth - margin, yPos, { align: 'right' });

        if (filters.startDate || filters.endDate) {
            doc.setFont('helvetica', 'bold');
            doc.text("Date Range:", rightColX, yPos + 6);
            doc.setFont('helvetica', 'normal');
            doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, pageWidth - margin, yPos + 6, { align: 'right' });
        }

        const tableRows = reportData.map((row) => [
            formatDate(row.date),
            row.method || '-',
            row.bankName ? (row.reference ? `${row.reference} / ${row.bankName}` : row.bankName) : (row.reference || '-'),
            parseFloat(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            parseFloat(row.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]);

        const totalAmount = reportData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
        const totalDiscount = reportData.reduce((sum, row) => sum + (parseFloat(row.discount) || 0), 0);

        autoTable(doc, {
            startY: yPos + 15,
            head: [['Date', 'Method', 'Reference / Bank', 'Amount', 'Discount']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
            theme: 'plain',
            styles: {
                fontSize: 9.5,
                cellPadding: 2,
                lineColor: [0, 0, 0],
                lineWidth: 0.15,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.15
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.15
            },
            margin: { left: margin, right: margin },
            columnStyles: {
                0: { cellWidth: 30, halign: 'center' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 55, halign: 'left' },
                3: { cellWidth: 35, halign: 'right' },
                4: { cellWidth: 30, halign: 'right' }
            }
        });

        let finalY = doc.lastAutoTable.finalY + 40;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 40;
        }

        const sigWidth = 40;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setLineWidth(0.2);
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.setFontSize(8);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert(`Failed to generate PDF: ${error.message}`);
    }
};

export const generateCnFAllReportPDF = (reportData, agentInfo, filters) => {
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // Header
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(0);
        doc.rect(pageWidth / 2 - 40, 37, 80, 8, 'FD');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("C&F COMPLETE LEDGER", pageWidth / 2, 42, { align: 'center' });

        let yPos = 55;
        doc.setFontSize(9);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent Name:", margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.name || '-', margin + 22, yPos);

        doc.setFont('helvetica', 'bold');
        doc.text("Agent ID:", margin, yPos + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(agentInfo.cnfId || '-', margin + 22, yPos + 6);

        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        const rightColX = pageWidth - margin - 70;

        doc.setFont('helvetica', 'bold');
        doc.text("Printed on:", rightColX, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth - margin, yPos, { align: 'right' });

        if (filters.startDate || filters.endDate) {
            doc.setFont('helvetica', 'bold');
            doc.text("Date Range:", rightColX, yPos + 6);
            doc.setFont('helvetica', 'normal');
            doc.text(`${formatDate(filters.startDate) === '-' ? 'Start' : formatDate(filters.startDate)} to ${formatDate(filters.endDate) === '-' ? 'Present' : formatDate(filters.endDate)}`, pageWidth - margin, yPos + 6, { align: 'right' });
        }

        const tableRows = reportData.map((row) => [
            formatDate(row.date),
            row.lcNo || '-',
            row.importer || '-',
            row.product || '-',
            row.billingAmount > 0 ? row.billingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-',
            row.method || '-',
            row.bankName ? (row.reference ? `${row.reference} / ${row.bankName}` : row.bankName) : (row.reference || '-'),
            row.amount > 0 ? row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-',
            row.discount > 0 ? row.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-',
            row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })
        ]);

        const totalBilling = reportData.reduce((sum, row) => sum + (parseFloat(row.billingAmount) || 0), 0);
        const totalAmount = reportData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
        const totalDiscount = reportData.reduce((sum, row) => sum + (parseFloat(row.discount) || 0), 0);

        const totalTableWidth = 18 + 22 + 32 + 32 + 22 + 22 + 38 + 22 + 22 + 25;
        const tableMargin = (pageWidth - totalTableWidth) / 2;
        const lastBalance = reportData.length > 0 ? reportData[reportData.length - 1].runningBalance : 0;

        autoTable(doc, {
            startY: yPos + 15,
            head: [['Date', 'LC No', 'Importer', 'Product', 'Billing Amt', 'Method', 'Reference / Bank', 'Amount', 'Discount', 'Balance']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalBilling.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                '',
                '',
                { content: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: lastBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
            theme: 'plain',
            styles: {
                fontSize: 8,
                cellPadding: 1.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0],
                valign: 'middle'
            },
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.1
            },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                lineWidth: 0.1
            },
            margin: { left: tableMargin, right: tableMargin },
            columnStyles: {
                0: { cellWidth: 18, halign: 'center' },
                1: { cellWidth: 22, halign: 'center' },
                2: { cellWidth: 32, halign: 'left' },
                3: { cellWidth: 32, halign: 'left' },
                4: { cellWidth: 22, halign: 'right' },
                5: { cellWidth: 22, halign: 'center' },
                6: { cellWidth: 38, halign: 'left' },
                7: { cellWidth: 22, halign: 'right' },
                8: { cellWidth: 22, halign: 'right' },
                9: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }
            }
        });

        let finalY = doc.lastAutoTable.finalY + 40;
        if (finalY + 20 > pageHeight) {
            doc.addPage();
            finalY = 40;
        }

        const sigWidth = 40;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setLineWidth(0.2);
        doc.line(margin, finalY, margin + sigWidth, finalY);
        doc.setFontSize(8);
        doc.text("PREPARED BY", margin + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(margin + sigWidth + sigGap, finalY, margin + sigWidth + sigGap + sigWidth, finalY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, finalY + 5, { align: 'center' });

        doc.line(pageWidth - margin - sigWidth, finalY, pageWidth - margin, finalY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, finalY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert(`Failed to generate PDF: ${error.message}`);
    }
};
