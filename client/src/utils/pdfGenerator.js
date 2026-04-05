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

        if (filters.warehouse) {
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

        // --- Data Preparation ---
        // 1. Group by Date + LC No (matches UI logic but adds Date for safer merging)
        const lcGroups = Object.values(reportData.reduce((acc, item) => {
            const dateStr = formatDate(item.date);
            const key = `${dateStr}_${item.warehouse || 'unknown'}`;
            if (!acc[key]) {
                acc[key] = {
                    date: item.date,
                    warehouse: item.warehouse,
                    importer: item.importer,
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

                    // Warehouse Columns: Date, Warehouse, Importer, BOE No (Span across all rows of this LC)
                    if (isFirstRowOfLC) {
                        row.push({ content: formatDate(lcGroup.date), rowSpan: totalRowsForLC, styles: { valign: 'top', halign: 'center' } });
                        row.push({ content: lcGroup.warehouse || '-', rowSpan: totalRowsForLC, styles: { valign: 'top', fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' } });
                        row.push({ content: lcGroup.importer || '-', rowSpan: totalRowsForLC, styles: { valign: 'top', halign: 'left' } });
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
            head: [['Date', 'Warehouse', 'Importer', 'BOE No', 'Truck', 'Product', 'Brand', 'Bag', 'QTY', 'SHORT', 'Stock QTY', 'Stock Bag']],
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
                1: { cellWidth: 35, fontStyle: 'bold', textColor: [0, 0, 0], halign: 'center' }, // Warehouse
                2: { cellWidth: 35, halign: 'left' },   // Importer
                3: { cellWidth: 21, halign: 'center' }, // BOE No
                4: { cellWidth: 12, halign: 'center' }, // Truck
                5: { cellWidth: 22, halign: 'left' }, // Product
                6: { cellWidth: 45, halign: 'left' },   // Brand
                7: { cellWidth: 14, halign: 'center' },  // Bag
                8: { cellWidth: 20, halign: 'right' },  // QTY
                9: { cellWidth: 17, halign: 'right' }, // SHORT
                10: { cellWidth: 20, halign: 'right' }, // IH QTY
                11: { cellWidth: 20, halign: 'right' }  // IH BAG
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

export const generateStockReportPDF = (stockData, filters, reportType = 'short') => {
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

        if (filters.warehouse) {
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

        // --- Data Preparation ---
        const tableRows = [];

        stockData.displayRecords.forEach((item, index) => {
            const hasTotal = true;
            const totalRowsForProduct = item.brandList.length + 1;

            item.brandList.forEach((brandEnt, i) => {
                const row = [];

                // SL and Product Name with rowSpan
                if (i === 0) {
                    row.push({ content: (index + 1).toString(), rowSpan: totalRowsForProduct, styles: { valign: 'top', halign: 'center' } });
                    row.push({ content: (item.productName || '-').toUpperCase(), rowSpan: totalRowsForProduct, styles: { valign: 'top', fontStyle: 'bold' } });
                }

                // 3. Brand
                row.push(brandEnt.brand || '-');

                // 4. Total BAG
                const tPkt = parseFloat(brandEnt.totalInHousePacket) || 0;
                const tQty = parseFloat(brandEnt.totalInHouseQuantity) || 0;
                const tSize = parseFloat(brandEnt.packetSize) || 0;
                const tWhole = Math.floor(tPkt);
                const tRem = Math.round(tQty - (tWhole * tSize));
                row.push(`${tWhole}${tRem > 0 ? ` - ${tRem} kg` : ''}`);

                // 5. Total QTY
                row.push(Math.round(brandEnt.totalInHouseQuantity).toString());

                // 6. Sale BAG
                const sPkt = parseFloat(brandEnt.salePacket) || 0;
                const sQty = parseFloat(brandEnt.saleQuantity) || 0;
                const sSize = parseFloat(brandEnt.packetSize) || 0;
                const sWhole = Math.floor(sPkt);
                const sRem = Math.round(sQty - (sWhole * sSize));
                row.push(`${sWhole}${sRem > 0 ? ` - ${sRem} kg` : ''}`);

                // 7. Sale QTY
                row.push(Math.round(brandEnt.saleQuantity).toString());

                // 8. InHouse BAG (Remaining)
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
            if (hasTotal) {
                const totalRow = [
                    { content: 'SUB TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [250, 250, 250] } }
                ];

                if (reportType === 'detailed') {
                    // Total BAG
                    totalRow.push({
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(Math.max(0, parseFloat(ent.totalInHousePacket) || 0)), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + Math.max(0, parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(Math.max(0, parseFloat(ent.totalInHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }
                    });
                    totalRow.push({ content: Math.round(item.totalInHouseQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } });
                    // Sale
                    totalRow.push({
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(Math.max(0, parseFloat(ent.salePacket) || 0)), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + Math.max(0, parseFloat(ent.saleQuantity) || 0) - (Math.floor(Math.max(0, parseFloat(ent.salePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }
                    });
                    totalRow.push({ content: Math.round(item.saleQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } });
                }

                // Inhouse BAG
                totalRow.push({
                    content: (() => {
                        const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(Math.max(0, parseFloat(ent.inHousePacket) || 0)), 0);
                        const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + Math.max(0, parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(Math.max(0, parseFloat(ent.inHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0));
                        return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                    })(),
                    styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] }
                });
                totalRow.push({ content: Math.round(item.inHouseQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [250, 250, 250] } });
                tableRows.push(totalRow);
            }
        });

        // Summary Calculations for Cards
        const grandTotalPktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(Math.max(0, parseFloat(ent.totalInHousePacket) || 0)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(Math.max(0, parseFloat(ent.totalInHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
        })();

        const inHousePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(Math.max(0, parseFloat(ent.inHousePacket) || 0)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(Math.max(0, parseFloat(ent.inHousePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
        })();

        const totalSalePktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(Math.max(0, parseFloat(ent.salePacket) || 0)), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + Math.max(0, parseFloat(ent.saleQuantity) || 0) - (Math.floor(Math.max(0, parseFloat(ent.salePacket) || 0)) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
        })();

        // Append Grand Total Row
        const grandTotalRow = [
            { content: '', styles: { fillColor: [240, 240, 240] } },
            { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } },
            { content: '', styles: { fillColor: [240, 240, 240] } }
        ];

        if (reportType === 'detailed') {
            grandTotalRow.push({ content: grandTotalPktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
            grandTotalRow.push({ content: Math.round(stockData.totalTotalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
            grandTotalRow.push({ content: totalSalePktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
            grandTotalRow.push({ content: Math.round(stockData.totalSaleQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
        }

        grandTotalRow.push({ content: inHousePktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });
        grandTotalRow.push({ content: Math.round(stockData.totalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } });

        tableRows.push(grandTotalRow);

        // --- Table ---
        const pdfHead = reportType === 'detailed'
            ? [['SL', 'PRODUCT NAME', 'BRAND', 'Opening Stock BAG', 'Opening Stock QTY', 'SALE BAG', 'SALE QTY', 'Closing Stock BAG', 'Closing Stock QTY']]
            : [['SL', 'PRODUCT NAME', 'BRAND', 'BAG', 'QUANTITY']];

        autoTable(doc, {
            startY: yPos + 10,
            head: pdfHead,
            body: tableRows,
            theme: 'plain',
            styles: {
                fontSize: reportType === 'detailed' ? 8 : 8.7,
                cellPadding: reportType === 'detailed' ? 1.2 : 1.3,
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
            columnStyles: reportType === 'detailed' ? {
                0: { cellWidth: 6, halign: 'center' }, // SL
                1: { cellWidth: 23 }, // Product Name
                2: { cellWidth: 44 }, // Brand
                3: { cellWidth: 22, halign: 'right' }, // Total Inhouse BAG
                4: { cellWidth: 22, halign: 'right' }, // Total Inhouse QTY
                5: { cellWidth: 20, halign: 'right' }, // Sale BAG
                6: { cellWidth: 20, halign: 'right' }, // Sale QTY
                7: { cellWidth: 22, halign: 'right' }, // InH BAG
                8: { cellWidth: 22, halign: 'right' }  // InH QTY
            } : {
                0: { cellWidth: 10, halign: 'center' }, // SL
                1: { cellWidth: 40 }, // Product Name
                2: { cellWidth: 70 }, // Brand
                3: { cellWidth: 40, halign: 'right' }, // InH BAG
                4: { cellWidth: 40, halign: 'right' }  // InH QTY
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

            doc.setFillColor(245, 245, 245);
            doc.rect(x, y, cardWidth, 8, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.line(x, y + 8, x + cardWidth, y + 8);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            const titleWidth = doc.getTextWidth(title);
            doc.text(title, x + (cardWidth - titleWidth) / 2, y + 5.5);

            // Row 1: BAG
            doc.setFontSize(10);
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
            doc.text("BAG: ", pktLineX, y + 15);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(pktValStr, pktLineX + pktLabelWidth, y + 15);

            // Row 2: QTY
            const qtyStrVal = `${Math.round(qtyVal).toLocaleString()} kg`;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            const qtyLabelWidth = doc.getTextWidth("QTY: ");
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            const qtyValWidth = doc.getTextWidth(qtyStrVal);
            const qtyTotalWidth = qtyLabelWidth + qtyValWidth;
            const qtyLineX = x + (cardWidth - qtyTotalWidth) / 2;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);
            doc.text("QTY: ", qtyLineX, y + 21);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0);
            doc.text(qtyStrVal, qtyLineX + qtyLabelWidth, y + 21);
        };

        drawSummaryCard(cardX, finalY, "OPENING STOCK", grandTotalPktStr, stockData.totalTotalInHouseQty, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "TOTAL SALE", totalSalePktStr, stockData.totalSaleQty, false);
        cardX += cardWidth + cardGap;
        drawSummaryCard(cardX, finalY, "CLOSING STOCK", inHousePktStr, stockData.totalInHouseQty, true);

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
                            return `${whole.toLocaleString()}${rem > 0 ? ` - ${rem.toLocaleString()} kg` : ''}`;
                        })(),
                        styles: { halign: 'right', valign: 'top' }
                    });
                    row.push({ content: `${Math.round(parseFloat(brandItem.inhouseQty) || 0).toLocaleString()} kg`, styles: { halign: 'right', valign: 'top' } });
                    row.push({
                        content: (() => {
                            const pkt = parseFloat(brandItem.whPkt) || 0;
                            const qty = parseFloat(brandItem.whQty) || 0;
                            const size = parseFloat(brandItem.packetSize || brandItem.size || 0);
                            const whole = Math.floor(pkt);
                            const rem = Math.round(qty - (whole * size));
                            return `${whole.toLocaleString()}${rem > 0 ? ` - ${rem.toLocaleString()} kg` : ''}`;
                        })(),
                        styles: { halign: 'right', valign: 'top', fontStyle: 'bold' }
                    });
                    row.push({ content: `${Math.round(parseFloat(brandItem.whQty) || 0).toLocaleString()} kg`, styles: { halign: 'right', valign: 'top', fontStyle: 'bold' } });

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
                                return `${totalWhole.toLocaleString()}${totalRem > 0 ? ` - ${totalRem.toLocaleString()} kg` : ''}`;
                            })(),
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250], textColor: [0, 0, 0] }
                        },
                        {
                            content: `${Math.round(pGroup.brands.reduce((sum, b) => sum + Math.max(0, parseFloat(b.inhouseQty) || 0), 0)).toLocaleString()} kg`,
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
                                return `${totalWhole.toLocaleString()}${totalRem > 0 ? ` - ${totalRem.toLocaleString()} kg` : ''}`;
                            })(),
                            styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250], textColor: [0, 0, 0] }
                        },
                        {
                            content: `${Math.round(pGroup.brands.reduce((sum, b) => sum + Math.max(0, parseFloat(b.whQty) || 0), 0)).toLocaleString()} kg`,
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
                    return `${totals.totalInHouseWhole.toLocaleString()}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString()} kg` : ''}`;
                })(),
                styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] }
            },
            { content: `${Math.round(totals.totalInHouseQty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            {
                content: (() => {
                    return `${totals.totalWhWhole.toLocaleString()}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString()} kg` : ''}`;
                })(),
                styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] }
            },
            { content: `${Math.round(totals.totalWhQty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
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
            const qtyStrVal = `${Math.round(qtyVal).toLocaleString()} kg`;
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
            return `${totals.totalInHouseWhole.toLocaleString()}${totals.totalInHouseRem > 0 ? ` - ${totals.totalInHouseRem.toLocaleString()} kg` : ''}`;
        })(), totals.totalInHouseQty, false);
        cardX += cardWidth + cardGap;

        // Card 2: WAREHOUSE STOCK
        drawSummaryCard(cardX, finalY, "WAREHOUSE STOCK", (() => {
            return `${totals.totalWhWhole.toLocaleString()}${totals.totalWhRem > 0 ? ` - ${totals.totalWhRem.toLocaleString()} kg` : ''}`;
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

export const generateSaleInvoicePDF = (sale, allCustomers = []) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 10;

        // --- Calculate Previous Balance Dynamically ---
        let previousBalance = parseFloat(sale.previousBalance || 0);

        // If we have customer context, we can calculate a more accurate point-in-time balance
        // identifying the matching customer from the list
        const customer = allCustomers.find(c =>
            c._id === sale.customerId ||
            (c.companyName && sale.companyName && c.companyName.trim().toLowerCase() === sale.companyName.trim().toLowerCase())
        );

        if (customer) {
            const sHistory = customer.salesHistory || [];
            const pHistory = customer.paymentHistory || [];

            // A transaction is "previous" if:
            // 1. It happened on a strictly earlier date
            // 2. OR it happened on the same date but has a lexicographically smaller invoice number
            const prevSales = sHistory.filter(h => {
                if (h.invoiceNo === sale.invoiceNo) return false; // Exclude current sale
                if (h.date < sale.date) return true;
                if (h.date === sale.date && h.invoiceNo < sale.invoiceNo) return true;
                return false;
            });

            const totalPrevAmt = prevSales.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);
            const totalPrevPaid = prevSales.reduce((sum, h) => sum + (parseFloat(h.paid) || 0), 0);
            const totalPrevDisc = prevSales.reduce((sum, h) => sum + (parseFloat(h.discount) || 0), 0);

            // For standalone payments, we don't have invoice numbers, so we just use date
            const prevPayments = pHistory.filter(h => h.date < sale.date);
            const totalPrevPayAmt = prevPayments.reduce((sum, h) => sum + (parseFloat(h.amount) || 0), 0);

            const calculatedPrevBalance = totalPrevAmt - totalPrevPaid - totalPrevDisc - totalPrevPayAmt;
            // Use calculated balance if it's non-zero or if the sale belongs to this customer
            previousBalance = Math.max(0, calculatedPrevBalance);
        }

        // --- 1. Header Section ---
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text("M/S ANI ENTERPRISE", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0); // Changed from 50 to 0 (Black)
        doc.text("766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh", pageWidth / 2, 26, { align: 'center' });
        doc.text("+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd", pageWidth / 2, 31, { align: 'center' });

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
        // Prioritize the human-readable customerId from the customer object if found
        const displayCustId = customer?.customerId || (sale.customerId ? sale.customerId.slice(-5).toUpperCase() : "-");
        doc.text(displayCustId, leftColX + 32, infoY);

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
        doc.text(formatDate(sale.date), rightValueX, ryPos);

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
            const productName = (prod || '').toString().toUpperCase();
            const brandName = (brand || '').toString().toUpperCase();

            // Fallback: Calculate rate if it's missing or zero
            let displayRate = parseFloat(rate) || 0;
            if (displayRate === 0 && quantity > 0) {
                displayRate = (parseFloat(total) || 0) / quantity;
            }

            return [
                sl,
                productName,
                brandName,
                quantity.toLocaleString(),
                displayRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
        };

        if (items.length === 0 && (sale.productId || sale.productName || sale.product)) {
            tableRows.push(prepareRow(
                1,
                sale.productName || sale.product || '-',
                sale.brand || '-',
                sale.quantity,
                sale.unitPrice || sale.rate,
                sale.totalAmount || sale.amount
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
                            brand.brand || '-',
                            brand.quantity,
                            brand.unitPrice || brand.rate || 0,
                            brand.totalAmount || brand.amount || 0
                        ));
                    });
                } else {
                    tableRows.push(prepareRow(
                        sl++,
                        item.productName || item.product || '-',
                        item.brand || '-',
                        item.quantity,
                        item.unitPrice || item.rate || 0,
                        item.totalAmount || item.amount || 0
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
        doc.setFont('helvetica', 'normal');
        doc.text(sale.requestedBy || sale.requestedByUsername || "-", margin + sigWidth / 2, sigY - 2, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text("PREPARED BY", margin + sigWidth / 2, sigY + 5, { align: 'center' });

        // Signature 2: VERIFIED BY
        doc.line(margin + sigWidth + sigGap, sigY, margin + sigWidth + sigGap + sigWidth, sigY);
        doc.setFont('helvetica', 'normal');
        doc.text(sale.acceptedBy || sale.rejectedBy || "-", margin + sigWidth + sigGap + sigWidth / 2, sigY - 2, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, sigY + 5, { align: 'center' });

        // Signature 3: AUTHORIZED SIGNATURE
        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.setFont('helvetica', 'bold');
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, sigY + 5, { align: 'center' });

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
                { content: `${Math.round(saleTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: `${Math.round(unifiedData[unifiedData.length - 1]?.runningInHouse || 0).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: `${Math.round(purchaseTotals.shortage).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
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
                    1: { cellWidth: 24, halign: 'center' }, // LC No
                    2: { cellWidth: 26, halign: 'left' },   // Exporter (Increased)
                    3: { cellWidth: 18, halign: 'center' }, // Invoice
                    4: { cellWidth: 36, halign: 'left' },   // Party (Increased)
                    5: { cellWidth: 21, halign: 'right' },  // Purchase
                    6: { cellWidth: 21, halign: 'right' },  // Sale
                    7: { cellWidth: 21, halign: 'right' },  // InHouse
                    8: { cellWidth: 13, halign: 'right' }   // Short
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

            const purchaseHead = [['Date', 'LC No', 'Exporter', 'Brand', 'Price', 'Bag', 'LC Qty', 'InHouse', 'Short']];
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
                { content: `TK ${Math.round(purchaseTotals.totalValue).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: purchaseTotals.pkt.toLocaleString(), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: `${Math.round(purchaseTotals.inHouse).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } },
                { content: `${Math.round(purchaseTotals.shortage).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
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
                    0: { cellWidth: 16, halign: 'center' }, // Date
                    1: { cellWidth: 20, halign: 'center' }, // LC No
                    2: { cellWidth: 28, halign: 'left' },   // Exporter (Increased)
                    3: { cellWidth: 44, halign: 'left' },   // Brand
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
            const saleTotals = saleData.reduce((acc, sale) => ({
                qty: acc.qty + (parseFloat(sale.itemQty) || 0),
                amount: acc.amount + (parseFloat(sale.itemTotal) || 0)
            }), { qty: 0, amount: 0 });

            let saleHead, saleBody, saleFoot, saleColumnStyles;

            if (isFruitCategory) {
                saleHead = [['Date', 'Invoice', 'Company', 'Customer', 'Phone', 'Qty', 'Truck', 'Price', 'Total Price']];
                saleBody = saleData.map(sale => [
                    formatDate(sale.date),
                    sale.invoiceNo || '-',
                    sale.companyName || '-',
                    sale.customerName || '-',
                    sale.phone || '-',
                    `${sale.itemQty.toLocaleString()} kg`,
                    sale.itemTruck || '-',
                    `TK ${sale.itemPrice.toLocaleString()}`,
                    `TK ${sale.itemTotal.toLocaleString()}`
                ]);
                saleFoot = [[
                    { content: 'TOTAL SALE', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: `${Math.round(saleTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: '-', colSpan: 2, styles: { halign: 'right' } },
                    { content: `TK ${Math.round(saleTotals.amount).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
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
                saleBody = saleData.map(sale => [
                    formatDate(sale.date),
                    sale.invoiceNo || '-',
                    sale.companyName || '-',
                    sale.itemBrand || '-',
                    sale.itemPacket.toLocaleString(),
                    `${sale.itemQty.toLocaleString()} kg`,
                    `TK ${sale.itemPrice.toLocaleString()}`,
                    `TK ${sale.itemTotal.toLocaleString()}`
                ]);
                saleFoot = [[
                    { content: 'TOTAL SALE', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: `${Math.round(saleTotals.qty).toLocaleString()} kg`, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: '-', styles: { halign: 'right' } },
                    { content: `TK ${Math.round(saleTotals.amount).toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] } }
                ]];
                saleColumnStyles = {
                    0: { cellWidth: 18, halign: 'center' }, // Date
                    1: { cellWidth: 16, halign: 'center' }, // Invoice
                    2: { cellWidth: 38, halign: 'left' },   // Company (Increased)
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

        reportData.forEach((sale) => {
            // Create flattened list of all entries across all items
            const flatItems = (sale.items || []).flatMap(item =>
                (item.brandEntries || []).map(entry => ({
                    productName: item.productName || item.product || '-',
                    brand: entry.brandName || entry.brand || '-',
                    quantity: entry.quantity || 0,
                    truck: entry.truck || sale.truck || '-',
                    price: entry.unitPrice || 0,
                    total: entry.totalAmount || 0
                }))
            );

            // If no items, fallback to sale level
            if (flatItems.length === 0) {
                flatItems.push({
                    productName: sale.productName || '-',
                    brand: sale.brand || '-',
                    quantity: sale.quantity || 0,
                    price: 0,
                    total: sale.totalAmount || 0,
                    lcNo: sale.lcNo || '-'
                });
            }

            flatItems.forEach((item, idx) => {
                const row = [
                    idx === 0 ? (slNum++).toString() : '',
                    idx === 0 ? formatDate(sale.date) : '',
                    idx === 0 ? (saleType === 'Border' ? (sale.lcNo || '-') : (sale.invoiceNo || '-')) : ''
                ];

                if (saleType === 'Border') {
                    row.push(idx === 0 ? (sale.importer || '-') : '');
                    row.push(idx === 0 ? (sale.port || '-') : '');
                    row.push(idx === 0 ? (sale.indianCnF || '-') : '');
                    row.push(idx === 0 ? (sale.bdCnf || '-') : '');
                    row.push(idx === 0 ? (sale.companyName || sale.customerName || '-') : '');
                } else {
                    row.push(idx === 0 ? (sale.companyName || '-') : '');
                }

                row.push(item.productName);

                if (saleType !== 'Border') {
                    row.push(item.brand);
                }

                row.push(parseFloat(item.quantity).toLocaleString());

                if (saleType === 'Border') {
                    row.push(item.truck || sale.truck || '-');
                }

                row.push(saleType === 'Border'
                    ? (parseFloat(item.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : (parseFloat(item.price) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                row.push(saleType === 'Border'
                    ? (parseFloat(item.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : (parseFloat(item.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

                if (saleType !== 'Border') {
                    row.push(idx === 0 ? (parseFloat(sale.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
                    row.push(idx === 0 ? (parseFloat(sale.paidAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
                    row.push(idx === 0 ? ((parseFloat(sale.totalAmount || 0) - parseFloat(sale.paidAmount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
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
            : [['SL', 'Date', 'Invoice', 'Company', 'Product', 'Brand', 'Qty', 'Price', 'Total', 'Disc', 'Paid', 'Balance']];

        const footRow = [[
            { content: 'GRAND TOTAL', colSpan: saleType === 'Border' ? 9 : 6, styles: { halign: 'right', fontStyle: 'bold' } },
            { content: saleType === 'Border' ? '-' : summary.totalQty.toLocaleString(), styles: { halign: 'right', fontStyle: 'bold' } },
            { content: saleType === 'Border' ? totalTrucks.toLocaleString() : '', styles: { halign: 'center', fontStyle: 'bold' } },
            ...(saleType === 'Border' ? [
                { content: '', styles: { halign: 'right', fontStyle: 'bold' } }
            ] : []),
            { content: saleType === 'Border' ? summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
            ...(saleType === 'Border' ? [] : [
                { content: totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: summary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } },
                { content: (summary.totalAmount - summary.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
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
                0: { cellWidth: 7, halign: 'center' },     // SL
                1: { cellWidth: 18, halign: 'center' },    // Date
                2: { cellWidth: 26, halign: 'center' },    // LC No
                3: { cellWidth: 32, noWrap: true },        // Importer
                4: { cellWidth: 22, noWrap: true },        // Port
                5: { cellWidth: 30, noWrap: true },        // IND C&F
                6: { cellWidth: 32, noWrap: true },        // BD C&F
                7: { cellWidth: 34, noWrap: true },        // Party Name
                8: { cellWidth: 18, overflow: 'linebreak' }, // Product
                9: { cellWidth: 16, halign: 'right' },     // Qty
                10: { cellWidth: 14, halign: 'center' },   // Truck
                11: { cellWidth: 18, halign: 'right' },    // Price
                12: { cellWidth: 18, halign: 'right' }     // Total
            } : {
                0: { cellWidth: 7, halign: 'center' },     // SL
                1: { cellWidth: 18, halign: 'center' },    // Date
                2: { cellWidth: 18, halign: 'center' },    // Invoice
                3: { cellWidth: 45 },                       // Company (Increased)
                4: { cellWidth: 25, overflow: 'linebreak' }, // Product (Reduced)
                5: { cellWidth: 35, noWrap: false, overflow: 'linebreak' }, // Brand (Reduced)
                6: { cellWidth: 15, halign: 'right' },     // Qty
                7: { cellWidth: 15, halign: 'right' },     // Price
                8: { cellWidth: 30, halign: 'right' },     // Total (Increased)
                9: { cellWidth: 15, halign: 'right' },     // Disc
                10: { cellWidth: 28, halign: 'right' },    // Paid (Increased)
                11: { cellWidth: 30, halign: 'right' }     // Balance (Increased)
            },
            margin: { left: saleType === 'Border' ? (pageWidth - 285) / 2 : (pageWidth - 280) / 2, right: margin }
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

            return Math.max(0, totalAmount - totalPaid - totalDiscount - totalHistoryPaid);
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
        doc.text(customers.length.toString(), margin + 30, yPos);

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
        customers.forEach((c, idx) => {
            const due = computeDue(c);
            tableRows.push([
                idx + 1,
                c.customerId || '-',
                c.companyName || c.customerName || '-',
                getLastTransDay(c),
                `Tk ${Math.round(due).toLocaleString('en-BD')}`,
                '' // Remark field
            ]);
        });

        // Add Grand Total
        tableRows.push([
            { content: 'GRAND TOTAL BALANCE', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: `Tk ${Math.round(grandTotalDue).toLocaleString('en-BD')}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [220, 38, 38] } },
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

        payments.forEach((p, idx) => {
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
                `Tk ${amount.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);
        });

        // Add Grand Total
        tableRows.push([
            { content: 'GRAND TOTAL', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
            { content: `${grandTotal.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [37, 99, 235] } }
        ]);

        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'Date', 'Party Name', 'Method', 'Bank/Receiver', 'Branch', 'Account No', 'Amount']],
            body: tableRows,
            theme: 'grid',
            styles: {
                fontSize: 8.5,
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
                1: { cellWidth: 19 },                   // Date
                2: { cellWidth: 30 },                   // Partyadd 
                3: { cellWidth: 24 },                   // Method
                4: { cellWidth: 36 },                   // Bank
                5: { cellWidth: 21 },                   // Branch
                6: { cellWidth: 27 },                   // Acct
                7: { cellWidth: 25, halign: 'right' }   // Amount
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

            // Sort for ascending order (chronological) in PDF
            const chronoHistory = [...historyData].sort((a, b) => new Date(a.date) - new Date(b.date));
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
                    ? `${item.method === 'Cash' ? (item.receiveBy || item.method) : (item.bankName || item.mobileType || item.method)}${item.method && (item.bankName || item.receiveBy || item.mobileType) ? ` (${item.method})` : ''}${item.reference ? ` [Ref: ${item.reference}]` : ''}`
                    : '-';

                const row = [
                    idx + 1,
                    formatDate(item.date),
                    item.invoiceNo || item.lcNo || '-',
                    item.product || '-',
                    item.truck || '-',
                    qty > 0 ? qty.toLocaleString() : '-',
                    item.type === 'sale' ? `${parseFloat(item.rate || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-',
                    amt > 0 ? `${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-',
                    details,
                    paid > 0 ? `${paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-',
                    `${runningBal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                ];
                tableRows.push(row);
            });

            autoTable(doc, {
                startY: yPos + 10,
                head: [['SL', 'Date', 'LC No', 'Product', 'Truck', 'Qty', 'Rate', 'Amount', 'Payment Details', 'Paid', 'Balance']],
                body: tableRows,
                foot: [[
                    { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: grandTrucks.toLocaleString(), styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: grandQty.toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: '', styles: { fillColor: [240, 240, 240] } },
                    { content: grandAmt.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: '', styles: { fillColor: [240, 240, 240] } },
                    { content: grandPaid.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                    { content: lastBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
                ]],
                theme: 'grid',
                styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
                headStyles: { fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'center' },
                columnStyles: {
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
                },
                margin: { left: margin, right: margin }
            });
        } else if (isSales) {
            let totalQty = 0, totalAmt = 0, totalDisc = 0, totalTrucksCount = 0;
            historyData.forEach((item, idx) => {
                const qty = parseFloat(item.quantity || 0);
                const amt = parseFloat(item.amount || 0);
                const disc = parseFloat(item.discount || 0);
                const trucksCount = parseFloat(item.truck || 0);
                totalQty += qty;
                totalAmt += amt;
                totalDisc += disc;
                if (!isNaN(trucksCount)) totalTrucksCount += trucksCount;

                const row = [
                    idx + 1,
                    formatDate(item.date),
                    item.lcNo || item.invoiceNo || '-',
                    item.product || '-',
                ];

                if (isParty) {
                    row.push(item.truck || '-');
                } else {
                    row.push(item.brand || '-');
                }

                row.push(
                    qty.toLocaleString(),
                    `${parseFloat(item.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    `${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                    `${disc.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                );

                tableRows.push(row);
            });

            // Add Grand Total row
            tableRows.push([
                { content: 'GRAND TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: isParty ? totalTrucksCount.toLocaleString() : '', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalQty.toLocaleString(), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: '', styles: { fillColor: [240, 240, 240] } },
                { content: totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalDisc.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
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
                    0: { halign: 'center', cellWidth: 10 },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 35 },
                    4: { cellWidth: 25 },
                    5: { halign: 'right', cellWidth: 20 },
                    6: { halign: 'right', cellWidth: 20 },
                    7: { halign: 'right', cellWidth: 25 },
                    8: { halign: 'right', cellWidth: 20 }
                },
                margin: { left: margin, right: margin }
            });
        } else {
            let totalCollectedAmt = 0;
            historyData.forEach((item, idx) => {
                const amt = parseFloat(item.amount || 0);
                totalCollectedAmt += amt;
                tableRows.push([
                    idx + 1,
                    formatDate(item.date),
                    item.method || '-',
                    item.method === 'Cash' ? (item.receiveBy || '-') : (item.bankName || item.mobileType || '-'),
                    item.method === 'Cash' ? (item.place || '-') : (item.branch || '-'),
                    item.accountNo || '-',
                    `${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                ]);
            });

            // Add Grand Total row for Payment
            tableRows.push([
                { content: 'GRAND TOTAL', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
                { content: totalCollectedAmt.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }
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
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

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
        const tableRows = reportData.map((row, index) => [
            formatDate(row.date),
            row.lcNo || '-',
            row.product || '-',
            row.port || '-',
            row.uom || '-',
            row.truck || '0',
            parseFloat(row.qty || 0).toLocaleString(),
            parseFloat(row.commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            parseFloat(row.totalCommission || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })
        ]);

        // Totals
        const totalTrucks = reportData.reduce((sum, row) => sum + (parseFloat(row.truck) || 0), 0);
        const totalQty = reportData.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0);
        const totalCommissionVal = reportData.reduce((sum, row) => sum + (parseFloat(row.totalCommission) || 0), 0);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 15,
            head: [['Date', 'LC No', 'Product', 'Port', 'UOM', 'Trucks', 'QTY', 'Commission', 'Total']],
            body: tableRows,
            foot: [[
                { content: 'GRAND TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }, // Date, LC, Product, Port, UOM
                { content: totalTrucks.toString(), styles: { halign: 'center', fontStyle: 'bold' } },
                { content: totalQty.toLocaleString(), styles: { halign: 'right', fontStyle: 'bold' } },
                '', // Commission rate col
                { content: totalCommissionVal.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
            theme: 'plain',
            styles: {
                fontSize: 9.0,
                cellPadding: 1.0,
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
                0: { cellWidth: 18, halign: 'center' }, // Date
                1: { cellWidth: 30, halign: 'center' }, // LC No
                2: { cellWidth: 26, halign: 'left' },   // Product
                3: { cellWidth: 15, halign: 'center' }, // Port
                4: { cellWidth: 16, halign: 'center' }, // UOM
                5: { cellWidth: 12, halign: 'center' }, // Trucks
                6: { cellWidth: 22, halign: 'right' },  // QTY
                7: { cellWidth: 21, halign: 'right' },  // Commission
                8: { cellWidth: 30, halign: 'right' }   // Total
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
