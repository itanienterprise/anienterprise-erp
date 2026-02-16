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
        const doc = new jsPDF();

        // --- Configuration ---
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 14;

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
        doc.text(`${filters.startDate || 'Start'} to ${filters.endDate || 'Present'}`, margin + 22, yPos);

        if (filters.lcNo) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("LC No:", margin, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 139); // Dark Blue
            doc.text(filters.lcNo, margin + 15, yPos);
            doc.setTextColor(0);
        }

        // Right Side: Printed On
        const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Data Preparation ---
        // 1. Group by LC No (matches UI logic)
        const lcGroups = Object.values(reportData.reduce((acc, item) => {
            const key = item.lcNo || 'unknown';
            if (!acc[key]) {
                acc[key] = {
                    ...item,
                    entries: []
                };
            }
            acc[key].entries.push(item);
            return acc;
        }, {}));

        const tableRows = [];

        lcGroups.forEach((lcGroup) => {

            // 2. Group by Product+Truck within LC (matches UI logic)
            const productGroups = lcGroup.entries.reduce((acc, item) => {
                const key = `${item.date}-${item.productName}-${item.truckNo}`;
                if (!acc[key]) {
                    acc[key] = {
                        ...item,
                        brandList: [],
                        packetList: [],
                        qtyList: []
                    };
                }
                acc[key].brandList.push(item.brand || '-');
                acc[key].packetList.push(item.packet || '0');
                acc[key].qtyList.push({ quantity: item.quantity, unit: item.unit });
                return acc;
            }, {});

            const finalEntries = Object.values(productGroups);

            let isFirstRowOfLC = true;

            finalEntries.forEach((subItem) => {
                let isFirstRowOfProduct = true;
                const count = subItem.brandList.length;

                for (let i = 0; i < count; i++) {
                    const row = [];

                    // LC Columns: Date, LC No, Importer, Port, BOE No
                    if (isFirstRowOfLC && isFirstRowOfProduct && i === 0) {
                        row.push(formatDate(lcGroup.date));
                        row.push(lcGroup.lcNo || '-');
                        row.push(lcGroup.importer || '-');
                        row.push(lcGroup.port || '-');
                        row.push(lcGroup.billOfEntry || '-');
                    } else {
                        row.push('');
                        row.push('');
                        row.push('');
                        row.push('');
                        row.push('');
                    }

                    // Product Column
                    if (isFirstRowOfProduct && i === 0) {
                        row.push(subItem.productName || '-');
                    } else {
                        row.push('');
                    }

                    // Detail Columns: Brand, Packet, Truck, QTY
                    row.push(subItem.brandList[i]);
                    row.push(subItem.packetList[i]);

                    // Truck Column (Merged for product group)
                    if (isFirstRowOfProduct && i === 0) {
                        row.push(subItem.truckNo || '-');
                    } else {
                        row.push('');
                    }

                    row.push(`${Math.round(subItem.qtyList[i].quantity)} ${subItem.qtyList[i].unit}`);

                    tableRows.push(row);
                }
                isFirstRowOfLC = false;
            });
        });

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['Date', 'LC No', 'Importer', 'Port', 'BOE No', 'Product', 'Brand', 'Packet', 'Truck', 'QTY']],
            body: tableRows,
            theme: 'plain',
            styles: {
                fontSize: 9, // Reduced slightly to fit more content
                cellPadding: 2,
                lineColor: [0, 0, 0], // Pure black borders
                lineWidth: 0.2,
                textColor: [0, 0, 0],
                valign: 'middle',
                halign: 'center' // Default center alignment for all cells
            },
            headStyles: {
                fillColor: [240, 240, 240], // Light gray background
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
                lineColor: [0, 0, 0],
                lineWidth: 0.2
            },
            margin: { left: 5, right: 5 }, // Minimize margins to 5mm to maximize table width
            columnStyles: {
                0: { cellWidth: 22, halign: 'center' }, // Date (Increased)
                1: { cellWidth: 28, fontStyle: 'bold', textColor: [0, 0, 139], halign: 'center' }, // LC No (Increased)
                2: { cellWidth: 22, halign: 'center' }, // Importer
                3: { cellWidth: 10, halign: 'center' }, // Port
                4: { cellWidth: 16, halign: 'center' }, // BOE No
                5: { cellWidth: 22, halign: 'center' }, // Product (Increased)
                6: { cellWidth: 28, halign: 'center' }, // Brand (Increased)
                7: { cellWidth: 14, halign: 'right' }, // Packet
                8: { cellWidth: 12, halign: 'right' }, // Truck
                9: { cellWidth: 26, halign: 'right' } // QTY (Increased)
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
        doc.text(`${filters.startDate || 'Start'} to ${filters.endDate || 'Present'}`, margin + 22, yPos);

        if (filters.productName) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("Product:", margin, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(filters.productName, margin + 22, yPos);
        }

        if (filters.lcNo) {
            yPos += 5;
            doc.setFont('helvetica', 'bold');
            doc.text("LC No:", margin, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 139); // Dark Blue
            doc.text(filters.lcNo, margin + 22, yPos);
            doc.setTextColor(0);
        }

        // Right Side: Printed On
        const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' });
        doc.setFont('helvetica', 'normal');
        doc.text(`Printed on: ${dateStr}`, pageWidth - margin, 55, { align: 'right' });

        // --- Data Preparation ---
        const tableRows = [];

        stockData.displayRecords.forEach((item, index) => {
            const hasTotal = item.brandList.length > 1;

            item.brandList.forEach((brandEnt, i) => {
                const row = [];

                // 1. SL
                row.push(i === 0 ? (index + 1).toString() : '');

                // 2. Product Name
                row.push(i === 0 ? (item.productName || '-') : '');

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

                // 6. InHouse PKT (Remaining)
                const rPkt = parseFloat(brandEnt.inHousePacket) || 0;
                const rQty = parseFloat(brandEnt.inHouseQuantity) || 0;
                const rSize = parseFloat(brandEnt.packetSize) || 0;
                const rWhole = Math.floor(rPkt);
                const rRem = Math.round(rQty - (rWhole * rSize));
                row.push(`${rWhole}${rRem > 0 ? ` - ${rRem} kg` : ''}`);

                // 7. Inhouse QTY (Remaining)
                row.push(Math.round(brandEnt.inHouseQuantity).toString());

                // 8. Sale PKT
                row.push((parseFloat(brandEnt.salePacket) || 0).toString());

                // 9. Sale QTY
                row.push(Math.round(brandEnt.saleQuantity).toString());

                tableRows.push(row);
            });

            // Add Total row if multiple brands
            if (hasTotal) {
                const totalRow = [
                    '',
                    '',
                    '',
                    // Total PKT
                    {
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.totalInHousePacket) || 0), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.totalInHouseQuantity) || 0) - (Math.floor(parseFloat(ent.totalInHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right' }
                    },
                    { content: Math.round(item.totalInHouseQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right' } },
                    // Inhouse PKT
                    {
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right' }
                    },
                    { content: Math.round(item.inHouseQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right' } },
                    // Sale
                    { content: item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.salePacket) || 0), 0).toString(), styles: { fontStyle: 'bold', halign: 'right' } },
                    { content: Math.round(item.saleQuantity).toString(), styles: { fontStyle: 'bold', halign: 'right' } }
                ];
                tableRows.push(totalRow);
            }
        });

        // --- Summary Calculations ---
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

        const totalSalePkt = stockData.displayRecords.reduce((sum, item) => sum + item.brandList.reduce((s, ent) => s + (parseFloat(ent.salePacket) || 0), 0), 0);

        // Append Grand Total Row to Table
        tableRows.push([
            { content: '', styles: { fillColor: [240, 240, 240] } },
            { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } },
            { content: '', styles: { fillColor: [240, 240, 240] } },
            { content: grandTotalPktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Math.round(stockData.totalTotalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: inHousePktStr, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Math.round(stockData.totalInHouseQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: totalSalePkt.toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
            { content: Math.round(stockData.totalSaleQty).toString(), styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } }
        ]);

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'Product\nName', 'Brand', 'Total Inhouse\nPKT', 'Total Inhouse\nQTY', 'Inhouse\nPKT', 'Inhouse\nQTY', 'Sale\nPKT', 'Sale\nQTY']],
            body: tableRows,
            theme: 'plain',
            styles: {
                fontSize: 9,
                cellPadding: 2,
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
                0: { cellWidth: 11, halign: 'center' }, // SL (One line)
                1: { cellWidth: 32, fontStyle: 'bold' }, // Product Name
                2: { cellWidth: 30 }, // Brand
                3: { cellWidth: 34, halign: 'right' }, // Total Inhouse PKT
                4: { cellWidth: 26, halign: 'right' }, // Total Inhouse QTY (Two lines)
                5: { cellWidth: 25, halign: 'right' }, // InH PKT (Fit "kg" in one line)
                6: { cellWidth: 18, halign: 'right' }, // InH QTY
                7: { cellWidth: 12, halign: 'right' }, // Sale PKT
                8: { cellWidth: 12, halign: 'right' }  // Sale QTY
            },
            margin: { left: 5, right: 5 }
        });

        // --- Footer / Summary ---
        let finalY = doc.lastAutoTable.finalY + 10;

        // Avoid page break issues for summary
        if (finalY + 50 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        // --- Card-Style Summary ---
        doc.setDrawColor(200);
        doc.setLineWidth(0.2);

        const cardWidth = 64;
        const cardHeight = 25;
        const cardGap = 4;
        let cardX = 5;

        // Card 1: TOTAL INHOUSE
        doc.setFillColor(248, 250, 252); // Subtle blue-gray fill
        doc.rect(cardX, finalY, cardWidth, cardHeight, 'FD');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL INHOUSE STOCK", cardX + 5, finalY + 7);
        doc.setFont('helvetica', 'bold'); // Make values bold
        doc.setFontSize(11); // Increased from 8
        doc.text(`PKT: ${grandTotalPktStr}`, cardX + 5, finalY + 14);
        doc.text(`QTY: ${Math.round(stockData.totalTotalInHouseQty)}`, cardX + 5, finalY + 21);

        cardX += cardWidth + cardGap;

        // Card 2: REMAINING INHOUSE
        doc.setFillColor(255, 255, 255);
        doc.rect(cardX, finalY, cardWidth, cardHeight, 'FD');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text("CURRENT INHOUSE", cardX + 5, finalY + 7);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`PKT: ${inHousePktStr}`, cardX + 5, finalY + 14);
        doc.text(`QTY: ${Math.round(stockData.totalInHouseQty)}`, cardX + 5, finalY + 21);

        cardX += cardWidth + cardGap;

        // Card 3: TOTAL SALE
        doc.setFillColor(248, 250, 252);
        doc.rect(cardX, finalY, cardWidth, cardHeight, 'FD');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text("TOTAL SALE", cardX + 5, finalY + 7);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const totalSalePkt_val = stockData.displayRecords.reduce((sum, item) => sum + item.brandList.reduce((s, ent) => s + (parseFloat(ent.salePacket) || 0), 0), 0);
        doc.text(`PKT: ${totalSalePkt}`, cardX + 5, finalY + 14);
        doc.text(`QTY: ${Math.round(stockData.totalSaleQty)}`, cardX + 5, finalY + 21);

        // --- Signature Section ---
        const sigY = finalY + 45;
        const sigWidth = 45;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);

        // Prepared By
        doc.line(margin, sigY, margin + sigWidth, sigY);
        doc.text("PREPARED BY", margin + sigWidth / 2, sigY + 5, { align: 'center' });

        // Verified By
        doc.line(margin + sigWidth + sigGap, sigY, margin + sigWidth + sigGap + sigWidth, sigY);
        doc.text("VERIFIED BY", margin + sigWidth + sigGap + sigWidth / 2, sigY + 5, { align: 'center' });

        // Authorized Signature
        doc.line(pageWidth - margin - sigWidth, sigY, pageWidth - margin, sigY);
        doc.text("AUTHORIZED SIGNATURE", pageWidth - margin - sigWidth / 2, sigY + 5, { align: 'center' });

        // Finalize
        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');

    } catch (error) {
        console.error("Stock PDF Generation Error:", error);
        alert(`Failed to generate Stock PDF: ${error.message}`);
    }
};
