import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        doc.setTextColor(100);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

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
            doc.setTextColor(0, 0, 139); // Dark Blue
            doc.text(filters.lcNo, margin + 25, yPos);
            doc.setTextColor(0);
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
                    port: item.port,
                    billOfEntry: item.billOfEntry,
                    entries: []
                };
            }
            acc[key].entries.push(item);
            return acc;
        }, {}));

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

            // Calculate total rows for this LC (entries + subtotal rows for groups with >1 entry)
            const totalRowsForLC = lcGroup.entries.length + productSubGroups.filter(sg => sg.brandDetails.length > 1).length;
            let isFirstRowOfLC = true;

            productSubGroups.forEach((subGroup) => {
                const hasSubTotal = subGroup.brandDetails.length > 1;
                const totalRowsForSubGroup = subGroup.brandDetails.length + (hasSubTotal ? 1 : 0);
                let isFirstRowOfProduct = true;

                subGroup.brandDetails.forEach((item, i) => {
                    const row = [];

                    // LC Columns: Date, LC No, Importer, Port, BOE No (Span across all rows of this LC)
                    if (isFirstRowOfLC) {
                        row.push({ content: formatDate(lcGroup.date), rowSpan: totalRowsForLC, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: lcGroup.lcNo || '-', rowSpan: totalRowsForLC, styles: { valign: 'top', fontStyle: 'bold', textColor: [0, 0, 139], halign: 'center' } });
                        row.push({ content: lcGroup.importer || '-', rowSpan: totalRowsForLC, styles: { valign: 'top', halign: 'left' } });
                        row.push({ content: lcGroup.port || '-', rowSpan: totalRowsForLC, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: lcGroup.billOfEntry || '-', rowSpan: totalRowsForLC, styles: { valign: 'top', halign: 'center' } });
                        isFirstRowOfLC = false;
                    }

                    // Product Grouping Columns: Truck, Product
                    if (isFirstRowOfProduct) {
                        row.push({ content: item.truckNo || '-', rowSpan: totalRowsForSubGroup, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: (item.productName || '-').toUpperCase(), rowSpan: totalRowsForSubGroup, styles: { valign: 'top', fontStyle: 'bold', halign: 'center' } });
                    }

                    // Detail Columns (Unique per row): Brand, Packet
                    row.push(item.brand || '-');
                    row.push(item.packet || '0');

                    if (isFirstRowOfProduct) {
                        isFirstRowOfProduct = false;
                    }

                    // Numeric Columns (Unique per row): QTY, IH QTY, IH PKT, SHORT
                    row.push(`${Math.round(item.quantity)} ${item.unit}`);
                    row.push(`${Math.round(getIHQty(item))} ${item.unit}`);
                    row.push(`${formatPktDisplay(getIHPkt(item), getIHQty(item), item.packetSize)}`);
                    row.push(`${Math.round(item.sweepedQuantity)} ${item.unit}`);

                    tableRows.push(row);
                });

                // Add Sub-Total Row if group has more than one entry
                if (hasSubTotal) {
                    const subTotalRow = [
                        { content: 'SUB TOTAL', styles: { fontStyle: 'italic', halign: 'left' } },
                        '', // Empty Packet col
                        { content: `${Math.round(subGroup.brandDetails.reduce((sum, e) => sum + (parseFloat(e.quantity) || 0), 0))} ${subGroup.brandDetails[0].unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
                        { content: `${Math.round(subGroup.brandDetails.reduce((sum, e) => sum + getIHQty(e), 0))} ${subGroup.brandDetails[0].unit}`, styles: { fontStyle: 'bold', halign: 'right' } },
                        {
                            content: (() => {
                                const totalWhole = subGroup.brandDetails.reduce((sum, e) => sum + Math.floor(getIHPkt(e)), 0);
                                const totalRem = Math.round(subGroup.brandDetails.reduce((sum, e) => {
                                    const pkt = getIHPkt(e);
                                    const qty = getIHQty(e);
                                    const size = parseFloat(e.packetSize) || 0;
                                    const whole = Math.floor(pkt);
                                    return sum + (qty - (whole * size));
                                }, 0));
                                return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                            })(),
                            styles: { fontStyle: 'bold', halign: 'right' }
                        },
                        { content: `${Math.round(subGroup.brandDetails.reduce((sum, e) => sum + (parseFloat(e.sweepedQuantity) || 0), 0))} ${subGroup.brandDetails[0].unit}`, styles: { fontStyle: 'bold', halign: 'right' } }
                    ];
                    tableRows.push(subTotalRow);
                }
            });
        });

        // --- Totals for Footer ---
        const totalIHQuantity = reportData.reduce((sum, item) => sum + getIHQty(item), 0);
        const totalIHPackets = reportData.reduce((sum, item) => sum + getIHPkt(item), 0);
        const totalShortage = reportData.reduce((sum, item) => sum + (parseFloat(item.sweepedQuantity) || 0), 0);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['Date', 'LC No', 'Importer', 'Port', 'BOE No', 'Truck', 'Product', 'Brand', 'Packet', 'QTY', 'IH QTY', 'IH PKT', 'SHORT']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: summary.totalPackets.toString(), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(summary.totalQuantity)} ${summary.unit}`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(totalIHQuantity)} ${summary.unit}`, styles: { halign: 'right', fontStyle: 'bold' } },
                {
                    content: (() => {
                        const totalWhole = reportData.reduce((sum, item) => sum + Math.floor(getIHPkt(item)), 0);
                        const totalRem = Math.round(reportData.reduce((sum, item) => {
                            const pkt = getIHPkt(item);
                            const qty = getIHQty(item);
                            const size = parseFloat(item.packetSize) || 0;
                            const whole = Math.floor(pkt);
                            return sum + (qty - (whole * size));
                        }, 0));
                        return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                    })(),
                    styles: { halign: 'right', fontStyle: 'bold' }
                },
                { content: `${Math.round(totalShortage)} ${summary.unit}`, styles: { halign: 'right', fontStyle: 'bold' } }
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
                0: { cellWidth: 22, halign: 'center' }, // Date
                1: { cellWidth: 28, fontStyle: 'bold', textColor: [0, 0, 139], halign: 'center' }, // LC No
                2: { cellWidth: 30, halign: 'left' },   // Importer
                3: { cellWidth: 18, halign: 'center' }, // Port
                4: { cellWidth: 15, halign: 'center' }, // BOE No
                5: { cellWidth: 12, halign: 'center' }, // Truck
                6: { cellWidth: 22, halign: 'left' }, // Product
                7: { cellWidth: 37, halign: 'left' },   // Brand
                8: { cellWidth: 20, halign: 'right' },  // Packet
                9: { cellWidth: 20, halign: 'right' },  // QTY
                10: { cellWidth: 20, halign: 'right' }, // IH QTY
                11: { cellWidth: 26, halign: 'right' }, // IH PKT
                12: { cellWidth: 15, halign: 'right' }  // SHORT
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

        // Box 1: Total Packets
        doc.setDrawColor(0); // Pure Black Border
        doc.roundedRect(startX, finalY, boxWidth, boxHeight, 2, 2);
        doc.setFontSize(8);
        doc.setTextColor(0); // Pure Black Text
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL PACKETS", startX + boxWidth / 2, finalY + 7, { align: 'center' });
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
        doc.setTextColor(0, 0, 139); // Deep Blue (DarkBlue)
        doc.text("TOTAL QUANTITY", startX + (boxWidth + boxGap) * 2 + boxWidth / 2, finalY + 7, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 139); // Deep Blue Value
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

export const generateStockReportPDF = (stockData, filters) => {
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
        doc.setTextColor(100);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

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

        if (filters.lcNo) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("LC No:", margin, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 139); // Dark Blue
            doc.text(filters.lcNo, margin + 25, yPos);
            doc.setTextColor(0);
        }

        // Right Side: Printed On
        const dateStr = formatDate(new Date().toISOString().split('T')[0]);
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Data Preparation ---
        const tableRows = [];

        stockData.displayRecords.forEach((item, index) => {
            const hasTotal = item.brandList.length > 1;
            const totalRowsForProduct = item.brandList.length + (hasTotal && stockData.displayRecords.length > 1 ? 1 : 0);

            item.brandList.forEach((brandEnt, i) => {
                const row = [];

                // SL and Product Name with rowSpan
                if (i === 0) {
                    row.push({ content: (index + 1).toString(), rowSpan: totalRowsForProduct, styles: { valign: 'top', halign: 'center' } });
                    row.push({ content: (item.productName || '-').toUpperCase(), rowSpan: totalRowsForProduct, styles: { valign: 'top', fontStyle: 'bold' } });
                }

                // 3. Brand
                row.push(brandEnt.brand || '-');

                // 4. Total PKT
                const tPkt = parseFloat(brandEnt.totalInHousePacket) || 0;
                const tQty = parseFloat(brandEnt.totalInHouseQuantity) || 0;
                const tSize = parseFloat(brandEnt.packetSize) || 0;
                const tWhole = Math.floor(tPkt);
                const tRem = Math.round(tQty - (tWhole * tSize));
                row.push(`${tWhole}${tRem > 0 ? ` - ${tRem} kg` : ''}`);

                // 5. Total QTY
                row.push(Math.round(brandEnt.totalInHouseQuantity).toString());

                // 6. Sale PKT
                const sPkt = parseFloat(brandEnt.salePacket) || 0;
                row.push(Number.isInteger(sPkt) ? sPkt.toString() : sPkt.toFixed(2));

                // 7. Sale QTY
                row.push(Math.round(brandEnt.saleQuantity).toString());

                // 8. InHouse PKT (Remaining)
                const rPkt = parseFloat(brandEnt.inHousePacket) || 0;
                const rQty = parseFloat(brandEnt.inHouseQuantity) || 0;
                const rSize = parseFloat(brandEnt.packetSize) || 0;
                const rWhole = Math.floor(rPkt);
                const rRem = Math.round(rQty - (rWhole * rSize));
                row.push(`${rWhole}${rRem > 0 ? ` - ${rRem} kg` : ''}`);

                // 9. Inhouse QTY (Remaining)
                row.push(Math.round(brandEnt.inHouseQuantity).toString());

                tableRows.push(row);
            });

            // Add Total row for product
            if (hasTotal && stockData.displayRecords.length > 1) {
                const totalRow = [
                    { content: 'SUB TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [250, 250, 250] } },
                    // Total PKT
                    {
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.totalInHousePacket) || 0), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(parseFloat(ent.totalInHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }
                    },
                    { content: Math.round(item.totalInHouseQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } },
                    // Sale
                    { content: item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.salePacket) || 0), 0).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } },
                    { content: Math.round(item.saleQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } },
                    // Inhouse PKT
                    {
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }
                    },
                    { content: Math.round(item.inHouseQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } }
                ];
                tableRows.push(totalRow);
            }
        });

        // Summary Calculations for Cards
        const grandTotalPktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.totalInHousePacket) || 0), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(parseFloat(ent.totalInHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
        })();

        const inHousePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
        })();

        const totalSalePkt = stockData.totalSalePkt;

        // Append Grand Total Row
        tableRows.push([
            { content: '', styles: { fillColor: [240, 240, 240] } },
            { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } },
            { content: '', styles: { fillColor: [240, 240, 240] } },
            { content: grandTotalPktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Math.round(stockData.totalTotalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Number.isInteger(totalSalePkt) ? totalSalePkt.toString() : totalSalePkt.toFixed(2), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Math.round(stockData.totalSaleQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: inHousePktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Math.round(stockData.totalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } }
        ]);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'PRODUCT NAME', 'BRAND', 'TOTAL INHOUSE PKT', 'TOTAL INHOUSE QTY', 'SALE PKT', 'SALE QTY', 'INHOUSE PKT', 'INHOUSE QTY']],
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
                0: { cellWidth: 6, halign: 'center' }, // SL
                1: { cellWidth: 23 }, // Product Name
                2: { cellWidth: 55 }, // Brand (increased to fit on one line)
                3: { cellWidth: 20, halign: 'right' }, // Total Inhouse PKT
                4: { cellWidth: 18, halign: 'right' }, // Total Inhouse QTY
                5: { cellWidth: 16, halign: 'right' }, // Sale PKT
                6: { cellWidth: 16, halign: 'right' }, // Sale QTY
                7: { cellWidth: 20, halign: 'right' }, // InH PKT
                8: { cellWidth: 18, halign: 'right' }  // InH QTY
            },
            margin: { left: margin, right: margin }
        });

        // --- Footer / Summary ---
        let finalY = doc.lastAutoTable.finalY + 12;

        if (finalY + 60 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        const cardWidth = 64;
        const cardHeight = 25;
        const cardGap = 4;
        const totalCardsWidth = (cardWidth * 3) + (cardGap * 2);
        let cardX = (pageWidth - totalCardsWidth) / 2;

        const drawSummaryCard = (x, y, title, pktVal, qtyVal, isBlue = false) => {
            doc.setDrawColor(200);
            doc.setLineWidth(0.2);
            doc.setFillColor(255, 255, 255);
            doc.rect(x, y, cardWidth, cardHeight, 'FD');

            doc.setFillColor(isBlue ? 239 : 249, isBlue ? 246 : 250, isBlue ? 255 : 251);
            doc.rect(x, y, cardWidth, 8, 'F');
            doc.setDrawColor(isBlue ? 219 : 229, isBlue ? 234 : 231, isBlue ? 254 : 235);
            doc.line(x, y + 8, x + cardWidth, y + 8);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 59 : 107, isBlue ? 130 : 114, isBlue ? 246 : 128);
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, x + (cardWidth - titleWidth) / 2, y + 5.5);

            // Row 1: PKT
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            const pktLabelWidth = doc.getTextWidth("PKT: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            const pktValStr = pktVal.toString();
            const pktValWidth = doc.getTextWidth(pktValStr);
            const pktTotalWidth = pktLabelWidth + pktValWidth;
            const pktLineX = x + (cardWidth - pktTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            doc.text("PKT: ", pktLineX, y + 15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            doc.text(pktValStr, pktLineX + pktLabelWidth, y + 15);

            // Row 2: QTY
            const qtyStrVal = `${Math.round(qtyVal).toLocaleString()} kg`;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            const qtyLabelWidth = doc.getTextWidth("QTY: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            const qtyValWidth = doc.getTextWidth(qtyStrVal);
            const qtyTotalWidth = qtyLabelWidth + qtyValWidth;
            const qtyLineX = x + (cardWidth - qtyTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            doc.text("QTY: ", qtyLineX, y + 21);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            doc.text(qtyStrVal, qtyLineX + qtyLabelWidth, y + 21);
        };

        drawSummaryCard(cardX, finalY, "TOTAL INHOUSE STOCK", grandTotalPktStr, stockData.totalTotalInHouseQty, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "TOTAL SALE", totalSalePkt, stockData.totalSaleQty, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "CURRENT INHOUSE", inHousePktStr, stockData.totalInHouseQty, true);

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
        doc.setTextColor(100);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

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
        doc.text(`${filters.startDate || 'Start'} to ${filters.endDate || 'Present'}`, margin + 25, yPos);

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
        const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        const tableRows = [];
        displayGroups.forEach((whGroup, whIdx) => {
            const totalRowsForWarehouse = whGroup.products.reduce((sum, p) => sum + p.brands.length + (p.brands.length > 1 ? 1 : 0), 0);

            whGroup.products.forEach((pGroup, pIdx) => {
                const hasTotal = pGroup.brands.length > 1;
                const totalRowsForProduct = pGroup.brands.length + (hasTotal ? 1 : 0);

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
                    row.push({ content: Math.round(parseFloat(brandItem.inhouseQty) || 0).toLocaleString(), styles: { halign: 'right', valign: 'top' } });
                    row.push({ content: Math.round(parseFloat(brandItem.inhousePkt) || 0).toLocaleString(), styles: { halign: 'right', valign: 'top' } });
                    row.push({ content: Math.round(parseFloat(brandItem.whQty) || 0).toLocaleString(), styles: { halign: 'right', valign: 'top', fontStyle: 'bold' } });
                    row.push({ content: Math.round(parseFloat(brandItem.whPkt) || 0).toLocaleString(), styles: { halign: 'right', valign: 'top', fontStyle: 'bold' } });

                    tableRows.push(row);
                });

                // Add Sub-total row if product has multiple brands
                if (hasTotal) {
                    tableRows.push([
                        { content: 'SUB TOTAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }, colSpan: 1 }, // Spanning Brand col
                        { content: Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhouseQty) || 0), 0)).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] } },
                        { content: Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.inhousePkt) || 0), 0)).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250], textColor: [0, 100, 0] } },
                        { content: Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whQty) || 0), 0)).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] } },
                        { content: Math.round(pGroup.brands.reduce((sum, b) => sum + (parseFloat(b.whPkt) || 0), 0)).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250], textColor: [0, 0, 150] } }
                    ]);
                }
            });
        });

        // Add Grand Total Row
        tableRows.push([
            { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] }, colSpan: 4 },
            { content: Math.round(totals.totalInHouseQty).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: Math.round(totals.totalInHousePkt).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: Math.round(totals.totalWhQty).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: Math.round(totals.totalWhPkt).toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
        ]);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'WAREHOUSE', 'PRODUCT NAME', 'BRAND', 'INHOUSE QTY', 'INHOUSE PKT', 'WAREHOUSE QTY', 'WAREHOUSE PKT']],
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
                1: { cellWidth: 28 },                     // Warehouse
                2: { cellWidth: 26 },                     // Product Name
                3: { cellWidth: 40 },                     // Brand (reduced from 44)
                4: { cellWidth: 20, halign: 'right' },    // Inhouse Qty
                5: { cellWidth: 24, halign: 'right' },    // Inhouse Pkt (increased from 20)
                6: { cellWidth: 27, halign: 'right' },    // Warehouse Qty
                7: { cellWidth: 27, halign: 'right' }     // Warehouse Pkt
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
            doc.setFillColor(isBlue ? 239 : 249, isBlue ? 246 : 250, isBlue ? 255 : 251);
            doc.rect(x, y, cardWidth, 8, 'F');
            doc.setDrawColor(isBlue ? 219 : 229, isBlue ? 234 : 231, isBlue ? 254 : 235);
            doc.line(x, y + 8, x + cardWidth, y + 8);

            // Header text (centered)
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 59 : 107, isBlue ? 130 : 114, isBlue ? 246 : 128);
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, x + (cardWidth - titleWidth) / 2, y + 5.5);

            // Row 1: PKT (centered)
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128); // gray label color
            const pktLabelWidth = doc.getTextWidth("PKT: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39); // blue/black value color
            const pktValWidth = doc.getTextWidth(Math.round(pktVal).toLocaleString());

            let pktTotalWidth = pktLabelWidth + pktValWidth;
            let pktLineX = x + (cardWidth - pktTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            doc.text("PKT: ", pktLineX, y + 15);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            doc.text(`${Math.round(pktVal).toLocaleString()}`, pktLineX + pktLabelWidth, y + 15);

            // Row 2: QTY (centered)
            const qtyStrVal = `${Math.round(qtyVal).toLocaleString()} kg`;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            const qtyLabelWidth = doc.getTextWidth("QTY: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            const qtyValWidth = doc.getTextWidth(qtyStrVal);

            let qtyTotalWidth = qtyLabelWidth + qtyValWidth;
            let qtyLineX = x + (cardWidth - qtyTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(107, 114, 128);
            doc.text("QTY: ", qtyLineX, y + 21);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isBlue ? 29 : 17, isBlue ? 78 : 24, isBlue ? 216 : 39);
            doc.text(qtyStrVal, qtyLineX + qtyLabelWidth, y + 21);
        };

        // Card 1: TOTAL INHOUSE STOCK
        drawSummaryCard(cardX, finalY, "TOTAL INHOUSE STOCK", totals.totalInHousePkt, totals.totalInHouseQty, false);
        cardX += cardWidth + cardGap;

        // Card 2: WAREHOUSE STOCK
        drawSummaryCard(cardX, finalY, "WAREHOUSE STOCK", totals.totalWhPkt, totals.totalWhQty, true);

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

export const generateSaleInvoicePDF = (sale) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // --- 1. Header Section ---
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

        // --- 2. Boxed Title with Extending Lines ---
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        // Left line
        doc.line(margin, 43, (pageWidth / 2) - 35, 43);
        // Right line
        doc.line((pageWidth / 2) + 35, 43, pageWidth - margin, 43);

        // Boxed Title
        doc.setLineWidth(0.3);
        doc.rect((pageWidth / 2) - 35, 38, 70, 10);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("SALES INVOICE", pageWidth / 2, 44.5, { align: 'center' });

        // --- 2b. Customer Type (Centered under Title Box) ---
        let custTypeLabel = "General Customer";
        const cType = (sale.customerType || "").toLowerCase();
        if (cType.includes("party") || sale.isParty) {
            custTypeLabel = "Party Customer";
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(custTypeLabel, pageWidth / 2, 53, { align: 'center' });

        // --- 3. Info Block (Expanded) ---
        let infoY = 60; // Pushed down slightly to give room to Customer Type label
        doc.setFontSize(9.5);
        doc.setTextColor(0);

        // Left Column: Customer Details
        const leftColX = margin + 2;
        doc.setFont('helvetica', 'bold');
        doc.text("Customer ID :", leftColX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.customerId ? sale.customerId.slice(-5).toUpperCase() : "-", leftColX + 32, infoY);

        infoY += 5;
        doc.setFont('helvetica', 'bold');
        doc.text("Company Name :", leftColX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.companyName || "-", leftColX + 32, infoY);

        infoY += 5;
        doc.setFont('helvetica', 'bold');
        doc.text("Address :", leftColX, infoY);
        doc.setFont('helvetica', 'normal');
        const addr = sale.address || "-";
        doc.text(addr, leftColX + 32, infoY, { maxWidth: 75 });

        // Adjust Y pos based on address length
        const addrLines = doc.splitTextToSize(addr, 75);
        infoY += addrLines.length * 5;

        doc.setFont('helvetica', 'bold');
        doc.text("Contact No :", leftColX, infoY);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.contact || "-", leftColX + 32, infoY);

        // Right Column: Invoice Details
        const rightLabelX = pageWidth - margin - 55;
        const rightValueX = pageWidth - margin - 25;
        let ryPos = 60; // Align with infoY

        doc.setFont('helvetica', 'bold');
        doc.text("Invoice Date :", rightLabelX, ryPos);
        doc.setFont('helvetica', 'normal');

        // Format date as dd/mm/yyyy
        const dateObj = new Date(sale.date);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        doc.text(`${day}/${month}/${year}`, rightValueX, ryPos);

        ryPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text("Invoice No :", rightLabelX, ryPos);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.invoiceNo || "-", rightValueX, ryPos);

        // --- 4. Items Table ---
        const tableRows = [];
        let items = sale.items || [];

        const prepareRow = (sl, prod, brand, qty, rate, total) => {
            const quantity = parseFloat(qty) || 0;

            return [
                sl,
                prod.toUpperCase(),
                brand.toUpperCase(),
                quantity.toLocaleString(),
                parseFloat(rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
        };

        if (items.length === 0 && sale.productId) {
            tableRows.push(prepareRow(
                1,
                sale.productName,
                sale.brand,
                sale.quantity,
                sale.unitPrice,
                sale.totalAmount
            ));
        } else {
            let sl = 1;
            items.forEach((item) => {
                const bEntries = item.brandEntries || [];
                if (bEntries.length > 0) {
                    bEntries.forEach((brand) => {
                        tableRows.push(prepareRow(
                            sl++,
                            item.productName,
                            brand.brand,
                            brand.quantity,
                            brand.unitPrice,
                            brand.totalAmount
                        ));
                    });
                } else {
                    tableRows.push(prepareRow(
                        sl++,
                        item.productName,
                        item.brand,
                        item.quantity,
                        item.unitPrice,
                        item.totalAmount
                    ));
                }
            });
        }

        autoTable(doc, {
            startY: Math.max(infoY, ryPos) + 12,
            head: [['SN', 'Product Name', 'Brand', 'Quantity', 'Rate', 'Total Amount']],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 2,
                textColor: [0, 0, 0],
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                valign: 'middle'
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'left', cellWidth: 42 },
                2: { halign: 'left', cellWidth: 68 }, // Changed to left align
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'right', cellWidth: 20 },
                5: { halign: 'right', cellWidth: 30 }
            },
            margin: { left: margin, right: margin }
        });

        // --- 5. Summary Table (Right Aligned, Immediately after Table) ---
        let finalY = doc.lastAutoTable.finalY + 2;
        const summaryBoxWidth = 35;
        const summaryX = pageWidth - margin - summaryBoxWidth;
        const rowHeight = 7;

        const drawSummaryRow = (label, value, y, isBold = false) => {
            doc.setDrawColor(0);
            doc.setLineWidth(0.1);
            // Label Cell
            doc.setFont('helvetica', 'bold');
            doc.text(label + " :", summaryX - 2, y + 4.5, { align: 'right' });
            // Value Cell (Boxed)
            doc.rect(summaryX, y, summaryBoxWidth, rowHeight);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.text(value, summaryX + summaryBoxWidth - 2, y + 4.5, { align: 'right' });
        };

        doc.setFontSize(9);

        // Correct calculation logic
        // subtotal should be the sum of all item totalAmounts
        const subtotal = tableRows.reduce((sum, row) => {
            // totalAmount is the last element in the row
            const amtStr = row[row.length - 1].replace(/,/g, '');
            return sum + (parseFloat(amtStr) || 0);
        }, 0);

        const discount = parseFloat(sale.discount || 0);
        const invoiceTotal = subtotal - discount;
        const paidAmount = parseFloat(sale.paidAmount || 0);
        const currentBalance = invoiceTotal - paidAmount;
        const previousBalance = parseFloat(sale.previousBalance || 0);
        const totalBalance = currentBalance + previousBalance;

        drawSummaryRow("Discount", discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), finalY);
        finalY += rowHeight;
        drawSummaryRow("Invoice Total", invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), finalY);
        finalY += rowHeight;
        drawSummaryRow("Paid Amount", paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), finalY);
        finalY += rowHeight;
        drawSummaryRow("Balance", currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), finalY, true);
        finalY += rowHeight;
        drawSummaryRow("Previous Balance", previousBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), finalY);
        finalY += rowHeight;
        drawSummaryRow("Total Balance", totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), finalY, true);

        // --- 6. Footer / Signatures ---
        const sigY = finalY + 30;
        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setLineWidth(0.3);
        doc.setDrawColor(0);

        // Signature 1: PREPARED BY
        doc.line(margin, sigY, margin + sigWidth, sigY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text("PREPARED BY", margin + sigWidth / 2, sigY + 5, { align: 'center' });

        // Signature 2: VERIFIED BY
        doc.line(margin + sigWidth + sigGap, sigY, margin + sigWidth + sigGap + sigWidth, sigY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, sigY + 5, { align: 'center' });

        // Signature 3: AUTHORIZED SIGNATURE
        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, sigY + 5, { align: 'center' });

        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Invoice PDF Generation Error:", error);
        alert(`Failed to generate Invoice PDF: ${error.message}`);
    }
};


export const generateProductHistoryPDF = (productName, activeTab, purchaseData, saleData, summary, filters) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 7; // Reduced margin to gain space

        // --- Header ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, +8801711-406898, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

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

        let currentY = yPos + 10;

        if (activeTab === 'total') {
            // --- Unified History Table ---
            const aggregatedPurchase = Object.values(purchaseData.reduce((acc, p) => {
                const key = `${p.date}_${p.lcNo}`;
                if (!acc[key]) acc[key] = { ...p, type: 'purchase', itemQty: 0, itemInHouseQty: 0, itemShortageQty: 0 };
                acc[key].itemQty += parseFloat(p.itemQty) || 0;
                acc[key].itemInHouseQty += parseFloat(p.inHouseQuantity || p.itemInHouseQty) || 0;
                acc[key].itemShortageQty += parseFloat(p.itemShortageQty) || 0;
                return acc;
            }, {}));

            const aggregatedSale = Object.values(saleData.reduce((acc, s) => {
                const key = `${s.date}_${s.invoiceNo}`;
                if (!acc[key]) acc[key] = { ...s, type: 'sale', itemQty: 0 };
                acc[key].itemQty += parseFloat(s.itemQty) || 0;
                return acc;
            }, {}));

            let currentBalance = 0;
            const unifiedData = [...aggregatedPurchase, ...aggregatedSale]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(item => {
                    if (item.type === 'purchase') {
                        currentBalance += item.itemInHouseQty;
                    } else {
                        currentBalance -= item.itemQty;
                    }
                    return { ...item, runningInHouse: currentBalance };
                });

            const purchaseTotals = purchaseData.reduce((acc, item) => ({
                qty: acc.qty + (parseFloat(item.itemQty) || 0),
                inHouse: acc.inHouse + (parseFloat(item.itemInHouseQty) || 0),
                shortage: acc.shortage + (parseFloat(item.itemShortageQty) || 0)
            }), { qty: 0, inHouse: 0, shortage: 0 });

            const saleTotals = saleData.reduce((acc, sale) => ({
                qty: acc.qty + (parseFloat(sale.itemQty) || 0)
            }), { qty: 0 });

            const unifiedHead = [['Date', 'LC No', 'Exporter', 'Invoice', 'Party', 'Purchase', 'Sale', 'InHouse', 'Short']];
            const unifiedBody = unifiedData.map(item => [
                formatDate(item.date),
                item.lcNo || '-',
                item.itemExporter || '-',
                item.invoiceNo || '-',
                item.type === 'purchase' ? '-' : (item.companyName || '-'),
                item.type === 'purchase' ? `${Math.round(item.itemQty).toLocaleString()} kg` : '-',
                item.type === 'sale' ? `${Math.round(item.itemQty).toLocaleString()} kg` : '-',
                `${Math.round(item.runningInHouse).toLocaleString()} kg`,
                item.type === 'purchase' ? `${Math.round(item.itemShortageQty || 0).toLocaleString()} kg` : '-'
            ]);
            const unifiedFoot = [[
                { content: 'TOTAL HISTORY', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(saleTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } },
                { content: `${Math.round(unifiedData[unifiedData.length - 1]?.runningInHouse || 0).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] } },
                { content: `${Math.round(purchaseTotals.shortage).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } }
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
                    0: { cellWidth: 18, halign: 'center' }, // Date
                    1: { cellWidth: 28, halign: 'center' }, // LC No (reduced)
                    2: { cellWidth: 18, halign: 'left' },   // Exporter
                    3: { cellWidth: 16, halign: 'center' }, // Invoice
                    4: { cellWidth: 26, halign: 'left' },   // Party (reduced)
                    5: { cellWidth: 23, halign: 'right' },  // Purchase (increased)
                    6: { cellWidth: 23, halign: 'right' },  // Sale (increased)
                    7: { cellWidth: 23, halign: 'right' },  // InHouse (increased)
                    8: { cellWidth: 21, halign: 'right' }   // Short (increased)
                },
                margin: { left: margin, right: margin }
            });

        } else if (activeTab === 'purchase') {
            // --- Purchase History Table (Single) ---
            const purchaseTotals = purchaseData.reduce((acc, item) => {
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

            const purchaseHead = [['Date', 'LC No', 'Exporter', 'Brand', 'Price', 'Packet', 'LC Qty', 'InHouse', 'Short']];
            const purchaseBody = purchaseData.map(item => [
                formatDate(item.date),
                item.lcNo || '-',
                item.itemExporter || '-',
                item.itemBrand || '-',
                `TK ${parseFloat(item.itemPurchasedPrice || 0).toLocaleString()}`,
                item.itemPacket.toLocaleString(),
                `${Math.round(item.itemQty).toLocaleString()} kg`,
                `${Math.round(item.itemInHouseQty).toLocaleString()} kg`,
                `${Math.round(item.itemShortageQty || 0).toLocaleString()} kg`
            ]);
            const purchaseFoot = [[
                { content: 'TOTAL PURCHASE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `TK ${Math.round(purchaseTotals.totalValue).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [29, 78, 216] } },
                { content: purchaseTotals.pkt.toLocaleString(), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.inHouse).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } },
                { content: `${Math.round(purchaseTotals.shortage).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } }
            ]];

            autoTable(doc, {
                startY: currentY,
                head: purchaseHead,
                body: purchaseBody,
                foot: purchaseFoot,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, font: 'helvetica', textColor: [0, 0, 0], minCellHeight: 0 },
                headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 18, halign: 'center' }, // Date
                    1: { cellWidth: 24, halign: 'center' }, // LC No
                    2: { cellWidth: 18, halign: 'left' },   // Exporter
                    3: { cellWidth: 46, halign: 'left' },   // Brand (reduced to 46 from 54)
                    4: { cellWidth: 16, halign: 'right' },  // Price
                    5: { cellWidth: 14, halign: 'right' },  // Packet
                    6: { cellWidth: 21, halign: 'right' },  // LC Qty (increased from 19)
                    7: { cellWidth: 21, halign: 'right' },  // InHouse (increased from 19)
                    8: { cellWidth: 18, halign: 'right' }   // Short (increased from 14)
                },
                margin: { left: margin, right: margin }
            });

        } else if (activeTab === 'sale') {
            // --- Sale History Table (Single) ---
            const saleTotals = saleData.reduce((acc, sale) => ({
                qty: acc.qty + (parseFloat(sale.itemQty) || 0),
                amount: acc.amount + (parseFloat(sale.itemTotal) || 0)
            }), { qty: 0, amount: 0 });

            const saleHead = [['Date', 'Invoice', 'Company', 'Brand', 'Qty', 'Price', 'Total Price']];
            const saleBody = saleData.map(sale => [
                formatDate(sale.date),
                sale.invoiceNo || '-',
                sale.companyName || '-',
                sale.itemBrand || '-',
                `${sale.itemQty.toLocaleString()} kg`,
                `TK ${sale.itemPrice.toLocaleString()}`,
                `TK ${sale.itemTotal.toLocaleString()}`
            ]);
            const saleFoot = [[
                { content: 'TOTAL SALE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(saleTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: '-', styles: { halign: 'right' } },
                { content: `TK ${Math.round(saleTotals.amount).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } }
            ]];

            autoTable(doc, {
                startY: currentY,
                head: saleHead,
                body: saleBody,
                foot: saleFoot,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, font: 'helvetica', textColor: [0, 0, 0], minCellHeight: 0 },
                headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                footStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 18, halign: 'center' }, // Date
                    1: { cellWidth: 20, halign: 'center' }, // Invoice
                    2: { cellWidth: 34, halign: 'left' },   // Company
                    3: { cellWidth: 48, halign: 'left' },   // Brand (reduced to 48 from 52)
                    4: { cellWidth: 22, halign: 'right' },  // Qty (increased from 18)
                    5: { cellWidth: 22, halign: 'right' },  // Price
                    6: { cellWidth: 32, halign: 'right' }   // Total Price
                },
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
