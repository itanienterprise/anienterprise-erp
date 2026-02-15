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
            doc.text(filters.lcNo, margin + 22, yPos);
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
                if (i === 0) {
                    row.push((index + 1).toString());
                } else {
                    row.push('');
                }

                // 2. Product Name
                if (i === 0) {
                    row.push(item.productName || '-');
                } else {
                    row.push('');
                }

                // 3. Brand
                row.push(brandEnt.brand || '-');

                // 4. InHouse PKT
                const pkt = parseFloat(brandEnt.inHousePacket) || 0;
                const qty = parseFloat(brandEnt.inHouseQuantity) || 0;
                const size = parseFloat(brandEnt.packetSize) || 0;
                const whole = Math.floor(pkt);
                const rem = Math.round(qty - (whole * size));
                row.push(`${whole}${rem > 0 ? ` - ${rem} kg` : ''}`);

                // 5. InHouse QTY
                row.push(`${Math.round(brandEnt.inHouseQuantity)} ${item.unit || 'kg'}`);

                // 6. Sale PKT (Placeholder)
                row.push('-');

                // 7. Sale QTY (Placeholder)
                row.push('-');

                tableRows.push(row);
            });

            // Add Total row if multiple brands
            if (hasTotal) {
                const totalRow = [
                    '',
                    '',
                    '',
                    {
                        content: (() => {
                            const totalWhole = item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0);
                            const totalRem = Math.round(item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0));
                            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
                        })(),
                        styles: { fontStyle: 'bold', halign: 'right' }
                    },
                    {
                        content: `${Math.round(item.quantity)} ${item.unit || 'kg'}`,
                        styles: { fontStyle: 'bold' }
                    },
                    '-',
                    '-'
                ];
                tableRows.push(totalRow);
            }
        });

        // --- Table ---
        autoTable(doc, {
            startY: yPos + 10,
            head: [['SL', 'Product Name', 'Brand', 'InHouse PKT', 'InHouse QTY', 'Sale PKT', 'Sale QTY']],
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
                0: { cellWidth: 10, halign: 'center' }, // SL
                1: { cellWidth: 35, fontStyle: 'bold' }, // Product Name (Reduced from 45)
                2: { cellWidth: 40 }, // Brand (Increased slightly to balance)
                3: { cellWidth: 30, halign: 'right' }, // InHouse PKT (Right alignment)
                4: { cellWidth: 25, halign: 'right' }, // InHouse QTY
                5: { cellWidth: 20, halign: 'right' }, // Sale PKT (Changed from center)
                6: { cellWidth: 20, halign: 'right' }  // Sale QTY
            },
            margin: { left: margin, right: margin }
        });

        // --- Footer / Summary ---
        let finalY = doc.lastAutoTable.finalY + 10;

        // Avoid page break issues for summary
        if (finalY + 50 > pageHeight) {
            doc.addPage();
            finalY = 20;
        }

        // Grand Total Row (manual drawing for emphasis)
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, finalY, pageWidth - margin, finalY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("GRAND TOTAL", margin + 5, finalY + 7);

        // Grand Total Values (PKT and QTY)
        const totalPktStr = (() => {
            const totalWhole = stockData.displayRecords.reduce((accWhole, item) => accWhole + item.brandList.reduce((sum, ent) => sum + Math.floor(parseFloat(ent.inHousePacket) || 0), 0), 0);
            const totalRem = Math.round(stockData.displayRecords.reduce((accRem, item) => accRem + item.brandList.reduce((sum, ent) => sum + (parseFloat(ent.inHouseQuantity) || 0) - (Math.floor(parseFloat(ent.inHousePacket) || 0) * (parseFloat(ent.packetSize) || 0)), 0), 0));
            return `${totalWhole}${totalRem > 0 ? ` - ${totalRem} kg` : ''}`;
        })();

        // Align with table columns approx
        doc.text(totalPktStr, margin + 10 + 45 + 35 + 15, finalY + 7, { align: 'center' });
        doc.text(`${Math.round(stockData.totalInHouseQty)} ${stockData.unit}`, pageWidth - margin - 45, finalY + 7, { align: 'right' });

        doc.line(margin, finalY + 10, pageWidth - margin, finalY + 10);

        // --- Signature Section ---
        const sigY = finalY + 40;
        const sigWidth = 40;
        const sigGap = (pageWidth - (margin * 2) - (sigWidth * 3)) / 2;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');

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
