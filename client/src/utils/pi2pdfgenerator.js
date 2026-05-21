import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const numberToWordsUSD = (amount) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convertChunk = (num) => {
        let s = '';
        if (num >= 100) { s += units[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
        if (num >= 10 && num <= 19) { s += teens[num - 10] + ' '; }
        else { if (num >= 20) { s += tens[Math.floor(num / 10)] + ' '; num %= 10; } if (num > 0) { s += units[num] + ' '; } }
        return s;
    };
    if (amount === 0) return 'Zero Taka Only';
    const parts = amount.toFixed(2).split('.');
    let taka = parseInt(parts[0]), paisa = parseInt(parts[1]);
    let words = '';
    if (taka === 0) { words = 'Zero '; } else {
        let tw = '';
        if (taka >= 10000000) { tw += convertChunk(Math.floor(taka / 10000000)) + 'Crore '; taka %= 10000000; }
        if (taka >= 100000) { tw += convertChunk(Math.floor(taka / 100000)) + 'Lakh '; taka %= 100000; }
        if (taka >= 1000) { tw += convertChunk(Math.floor(taka / 1000)) + 'Thousand '; taka %= 1000; }
        if (taka > 0) { tw += convertChunk(taka); }
        words = tw;
    }
    words += 'Taka ';
    words += paisa > 0 ? 'And ' + convertChunk(paisa) + 'Paisa Only' : 'Only';
    return words.replace(/\s+/g, ' ').trim();
};

export const generatePI2PDF = (record) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (2 * margin);

    doc.setFont("helvetica", "normal");

    const selectedCerts = (record.certification || '').split(',').map(s => s.trim()).filter(Boolean);
    const showPacking = selectedCerts.some(c => c.toLowerCase().includes('packing'));

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    // Main Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(margin, margin + 10, contentWidth, pageHeight - (2 * margin) - 10);

    const productsList = record.productsList && record.productsList.length > 0
        ? record.productsList
        : [{
            productName: record.productName || '',
            hsCode: record.hsCode || '',
            hsCodeInd: record.hsCodeInd || '',
            quantity: record.quantity || '',
            rate: record.rate || '',
            amount: record.amount || '',
            freight: record.freight || '',
            totalFreight: record.totalFreight || ''
        }];

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("PROFORMA INVOICE", pageWidth / 2, margin + 7, { align: 'center' });

    // --- Grid Layout ---
    const leftColWidth = contentWidth * 0.55;
    const rightColWidth = contentWidth - leftColWidth;
    const midX = margin + leftColWidth;

    // Row 1: Exporter vs PI Info
    let y = margin + 10;
    let row1Height = 32; // Reduced from 38 to make the Buyer box smaller
    doc.rect(margin, y, leftColWidth, row1Height);
    doc.rect(midX, y, rightColWidth, row1Height);

    // Exporter Content
    doc.setFontSize(13.5);
    doc.setFont("helvetica", "bold");
    doc.text("Exporter", margin + leftColWidth / 2, y + 5, { align: 'center' });
    const eLW = doc.getTextWidth("Exporter");
    doc.line(margin + (leftColWidth / 2) - (eLW / 2), y + 6, margin + (leftColWidth / 2) + (eLW / 2), y + 6);

    doc.setFontSize(14);
    const nameLines = doc.splitTextToSize(record.exporterName || '', leftColWidth - 10);
    doc.text(nameLines, margin + leftColWidth / 2, y + 12, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let exporterInfo = record.exporterAddress || '';
    if (record.exporterEmail) exporterInfo += `\nEmail: ${record.exporterEmail}`;
    doc.text(doc.splitTextToSize(exporterInfo, leftColWidth - 10), margin + leftColWidth / 2, y + 17, { align: 'center' });

    // Right: PI Info - Buyer's Order No/Proforma Invoice No.& Date
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Buyer's Order No/Proforma Invoice No.& Date", midX + 2, y + 5.5);

    doc.setFontSize(10);
    doc.text(record.piNumber || '', midX + 2, y + 11);

    const dateVal = formatDate(record.date) || '';
    doc.setFontSize(8.5);
    doc.text("DATE-" + dateVal, midX + rightColWidth - 2, y + 11, { align: 'right' });

    doc.line(midX, y + 13, pageWidth - margin, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Other References", midX + 2, y + 16.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.otherReferences || '', midX + 2, y + 21);

    doc.line(midX, y + 24, pageWidth - margin, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Buyer (if other than consignee)", midX + 2, y + 27.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const buyerLines = doc.splitTextToSize(record.buyerName || '', rightColWidth - 5);
    doc.text(buyerLines, midX + 2, y + 30.5);

    // Row 2: Importer vs Country/Terms
    y += row1Height;
    const showSafta = record.certification && record.certification.toLowerCase().includes('safta');

    let termsText = record.termsDeliveryPayment || '';
    if (!showPacking) {
        termsText = termsText.split('\n')
            .filter(line => !line.trim().toLowerCase().startsWith('packing:'))
            .join('\n');
    }
    const termsLines = doc.splitTextToSize(termsText, rightColWidth - 5);
    const termsHeight = termsLines.length * 4;
    const saftaHeight = showSafta ? 12 : 0;
    let row2Height = Math.max(61, 24 + termsHeight + saftaHeight);
    doc.rect(margin, y, leftColWidth, row2Height);
    doc.rect(midX, y, rightColWidth, row2Height);

    // Importer
    doc.setFontSize(13.5);
    doc.setFont("helvetica", "bold");
    doc.text("Importer", margin + leftColWidth / 2, y + 5, { align: 'center' });
    const iLW = doc.getTextWidth("Importer");
    doc.line(margin + (leftColWidth / 2) - (iLW / 2), y + 6, margin + (leftColWidth / 2) + (iLW / 2), y + 6);

    doc.setFontSize(14);
    const pnLines = doc.splitTextToSize(record.partyName || '', leftColWidth - 10);
    doc.text(pnLines, margin + leftColWidth / 2, y + 12, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let impInfo = record.partyAddress || '';

    doc.text(doc.splitTextToSize(impInfo.trim(), leftColWidth - 10), margin + leftColWidth / 2, y + 17, { align: 'center' });

    // Shipping rows (left)
    doc.line(margin, y + 31, margin + leftColWidth, y + 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Pre-Carriage by", margin + leftColWidth / 4, y + 34.5, { align: 'center' });
    doc.text("Place of Receipt by Pre-Carrier", margin + (3 * leftColWidth / 4), y + 34.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.preCarriageBy || '', margin + leftColWidth / 4, y + 39, { align: 'center' });
    doc.text(record.placeOfReceipt || record.placeOfReceiptByPreCarrier || '', margin + (3 * leftColWidth / 4), y + 39, { align: 'center' });

    doc.line(margin, y + 41, margin + leftColWidth, y + 41);
    doc.setFontSize(8.5);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 44.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 44.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.vesselFlightNo || '', margin + leftColWidth / 4, y + 49, { align: 'center' });
    doc.text(record.portOfLoading || 'ANY PLACE OF INDIA', margin + (3 * leftColWidth / 4), y + 49, { align: 'center' });

    doc.line(margin, y + 51, margin + leftColWidth, y + 51);
    doc.setFontSize(8.5);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 54.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 54.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.portOfDischarge || record.port || 'HILI', margin + leftColWidth / 4, y + 59, { align: 'center' });
    doc.text(record.finalDestination || 'BANGLADESH', margin + (3 * leftColWidth / 4), y + 59, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 31, margin + (leftColWidth / 2), y + row2Height);

    // Right: Country of Origin / Final Destination
    const subW = rightColWidth / 2;
    const showCountryOfOrigin = true;
    // Reuse selectedCerts defined at function top
    const otherCerts = selectedCerts.filter(c => {
        const lower = c.toLowerCase();
        return !lower.includes('country of origin') &&
               !lower.includes('safta') &&
               !lower.includes('packing') &&
               !(lower.includes('value') && lower.includes('quantity'));
    });

    if (showCountryOfOrigin) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Country of Origin", midX + 2, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(record.countryOrigin || 'INDIA', midX + 2, y + 7);
    }

    if (otherCerts.length > 0) {
        const certLabelY = showCountryOfOrigin ? 10 : 3;
        const certValY = showCountryOfOrigin ? 13.5 : 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Certification", midX + 2, y + certLabelY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(otherCerts.join(', '), midX + 2, y + certValY);
    }

    doc.line(midX + subW, y, midX + subW, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Country of Final Destination", midX + subW + 2, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.countryFinalDest || 'BANGLADESH', midX + subW + 2, y + 7);

    doc.line(midX, y + 10, pageWidth - margin, y + 10);

    // Terms of Delivery and Payment
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("Terms of Delivery and Payment", midX + 2, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(termsLines, midX + 2, y + 20);

    if (showSafta) {
        const saftaY = y + 20 + termsHeight + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("THE CERTIFICATE OF ORIGIN UNDER SAFTA", midX + rightColWidth / 2, saftaY, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("(South Asian Free Trade Area)", midX + rightColWidth / 2, saftaY + 4, { align: 'center' });
    }

    y += row2Height;

    // --- Table Section (4-column: Description | Quantity | Rate | Amount) ---
    // Build description content for below the product header area
    const descParts = [];
    const numProductsList = record.productsList ? record.productsList.length : 1;

    // Reuse showPacking defined at function top

    if (showCountryOfOrigin) {
        descParts.push(`COUNTRY OF ORIGIN ${(record.countryOrigin || 'INDIA').toUpperCase()}`);
    }
    if (otherCerts.length > 0) {
        descParts.push(`CERTIFICATION ${otherCerts.join(', ').toUpperCase()}`);
    }
    if (showPacking) {
        descParts.push("EXPORT STANDARD PACKING");
    }
    descParts.push(`VALIDITY OF PROFORMA INVOICE DATE:${formatDate(record.validityDate)}`);

    if (record.descriptionGoods) {
        const descWithoutBank = record.descriptionGoods
            .split('\n')
            .filter(line => {
                const trimmed = line.trim().toLowerCase();
                return !trimmed.startsWith('advising bank') && !trimmed.includes('must be through');
            })
            .join('\n')
            .trim();
        if (descWithoutBank) {
            descParts.push(`\n${descWithoutBank}`);
        }
    }

    descParts.push("\n\n\n\n\n\n\n\n\n\n");
    const extraDescText = descParts.join("\n");

    const tableBody = [];
    const firstRowIndexForProduct = [];
    const freightRowIndices = [];

    productsList.forEach((prod, pIdx) => {
        const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
        const numProducts = productsList.length;
        const isLastProduct = pIdx === numProducts - 1;

        firstRowIndexForProduct.push(tableBody.length);

        // Calculate required space dynamically
        let requiredNewlines = 1; // Base: Product name
        if (prod.hsCodeInd) requiredNewlines += 1; // Extra space for dual HS code
        if (showSafta && isLastProduct && !hasFreight) requiredNewlines += 2.5; // Extra space for SAFTA
        if (numProducts === 1) requiredNewlines += 1; // Buffer for single product layout

        let cellText = "\n".repeat(requiredNewlines);
        if (numProducts === 1) {
            cellText += "\n\n" + extraDescText;
        }

        tableBody.push([
            {
                content: cellText,
                rowSpan: (hasFreight && !(showSafta && isLastProduct)) ? 2 : 1,
                styles: {
                    halign: 'left',
                    fontStyle: 'normal',
                    fontSize: numProducts === 1 ? 9 : 10.5,
                    cellPadding: { top: 2, left: 2, right: 2, bottom: numProducts === 1 ? 40 : 2 }
                }
            },
            { content: prod.quantity ? `${parseFloat(prod.quantity).toLocaleString('en-US')}\n ` : '0\n ', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } },
            { content: prod.rate ? `${parseFloat(prod.rate).toFixed(3)}\nFOB VALUE` : '0.000\nFOB VALUE', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', textColor: [255, 255, 255] } },
            { content: prod.amount ? `${parseFloat(prod.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n ` : '0.00\n ', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } }
        ]);

        if (hasFreight) {
            freightRowIndices.push(tableBody.length);
            if (showSafta && isLastProduct) {
                tableBody.push([
                    {
                        content: "THE CERTIFICATE OF ORIGIN UNDER SAFTA\n(South Asian Free Trade Area)",
                        colSpan: 1,
                        styles: {
                            halign: 'center',
                            valign: 'middle',
                            fontStyle: 'bold',
                            fontSize: 9,
                            cellPadding: { top: 2, bottom: 2 }
                        }
                    },
                    { content: 'Freight', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 4, bottom: 4 }, fontSize: 11 } },
                    { content: parseFloat(prod.freight).toFixed(3), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } },
                    { content: prod.totalFreight ? parseFloat(prod.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } }
                ]);
            } else {
                tableBody.push([
                    { content: 'Freight', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 4, bottom: 4 }, fontSize: 11 } },
                    { content: parseFloat(prod.freight).toFixed(3), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } },
                    { content: prod.totalFreight ? parseFloat(prod.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } }
                ]);
            }
        }
    });

    // Add description parts at the bottom of the table (only for multi-product)
    if (productsList.length > 1) {
        tableBody.push([
            {
                content: extraDescText,
                colSpan: 1,
                styles: { halign: 'left', fontStyle: 'normal', fontSize: 9, cellPadding: { top: 2, left: 2, right: 2, bottom: 2 } }
            },
            { content: '', styles: { halign: 'center' } },
            { content: '', styles: { halign: 'center' } },
            { content: '', styles: { halign: 'center' } }
        ]);
    }

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.1,
        styles: {
            fontSize: 9.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1,
            valign: 'top', textColor: [0, 0, 0], font: 'helvetica'
        },
        headStyles: {
            fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold',
            halign: 'center', lineWidth: 0.1, cellPadding: 1
        },
        head: [
            [
                { content: '', styles: { cellWidth: 'auto', fillColor: [255, 255, 255] } },
                { content: 'Quantity\n(KG.)', styles: { fillColor: [235, 235, 235] } },
                { content: 'Rate\nUSD\nPer KG.', styles: { fillColor: [235, 235, 235] } },
                { content: 'Amount\nUSD', styles: { fillColor: [235, 235, 235] } }
            ]
        ],
        body: tableBody,
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 26, halign: 'center' },
            3: { cellWidth: 25, halign: 'right' },
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0 && firstRowIndexForProduct.includes(data.row.index)) {
                const pIdx = firstRowIndexForProduct.indexOf(data.row.index);
                const prod = productsList[pIdx];
                const pName = (prod.productName || '').toUpperCase();

                if (pIdx === 0) {
                    // Erase top border so it merges with the empty header box
                    doc.setDrawColor(255, 255, 255);
                    doc.setLineWidth(1.5);
                    doc.line(data.cell.x + 0.5, data.cell.y, data.cell.x + data.cell.width - 0.5, data.cell.y);
                    doc.setDrawColor(0, 0, 0);
                    doc.setLineWidth(0.1);
                }

                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const centerX = cellX + cellWidth / 2;
                let drawY = pIdx === 0 ? cellY - 1 : cellY + 5;

                // Product Name — large, bold, centered
                doc.setFont("helvetica", "bold");
                const isMulti = productsList.length > 1;
                doc.setFontSize(isMulti ? 15 : 20);
                doc.text(pName, centerX, drawY, { align: 'center' });

                // Add underline under product name
                const pWidth = doc.getTextWidth(pName);
                doc.setLineWidth(0.3);
                doc.line(centerX - pWidth / 2, drawY + 1.5, centerX + pWidth / 2, drawY + 1.5);
                doc.setLineWidth(0.1);

                drawY += 7.5;

                // HS Code
                doc.setFontSize(12);
                if (prod.hsCodeInd) {
                    const bdHsLine = `H.S. CODE NO.${prod.hsCode || ''} (BD)`;
                    const indHsLine = `H.S. CODE NO.${prod.hsCodeInd} (IND)`;
                    doc.text(bdHsLine, centerX, drawY, { align: 'center' });
                    drawY += 5;
                    doc.text(indHsLine, centerX, drawY, { align: 'center' });
                } else {
                    const hsCodeLine = `H.S. CODE NO.${prod.hsCode || ''}`;
                    doc.text(hsCodeLine, centerX, drawY, { align: 'center' });
                }
                const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
                if (showSafta && pIdx === productsList.length - 1 && !hasFreight) {
                    drawY += 1.5;
                    doc.setDrawColor(0, 0, 0);
                    doc.setLineWidth(0.1);
                    doc.line(cellX, drawY, cellX + cellWidth, drawY);

                    drawY += 5;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(9);
                    doc.text("THE CERTIFICATE OF ORIGIN UNDER SAFTA", centerX, drawY, { align: 'center' });
                    drawY += 4.5;
                    doc.text("(South Asian Free Trade Area)", centerX, drawY, { align: 'center' });
                    drawY += 5.5;
                }

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            if (data.section === 'body' && data.column.index === 2 && firstRowIndexForProduct.includes(data.row.index)) {
                const pIdx = firstRowIndexForProduct.indexOf(data.row.index);
                const prod = productsList[pIdx];

                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const cellHeight = data.cell.height;
                const centerX = cellX + cellWidth / 2;

                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 0, 0);

                // Draw rate value (size 11)
                doc.setFontSize(11);
                doc.text(prod.rate ? parseFloat(prod.rate).toFixed(3) : '0.000', centerX, cellY + (cellHeight / 2) - 1, { align: 'center' });

                // Draw FOB VALUE (size 9, slightly further down at +3)
                doc.setFontSize(9);
                doc.text("FOB VALUE", centerX, cellY + (cellHeight / 2) + 3.5, { align: 'center' });
            }

            // Remove horizontal borders between product row and freight row on right columns
            if (data.section === 'body' && freightRowIndices.includes(data.row.index)) {
                // Erase the horizontal line completely with a thick white line
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5); // Thick enough to cover both row 0 bottom and row 1 top borders
                doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);

                // Redraw the left and right vertical borders for this cell
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.1);
                doc.line(data.cell.x, data.cell.y - 1, data.cell.x, data.cell.y + data.cell.height);
                doc.line(data.cell.x + data.cell.width, data.cell.y - 1, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            }
        },
        didDrawPage: (data) => {
            y = data.cursor.y;
        }
    });

    // --- Buyer signature/stamp area (inside the table, at bottom of description) ---
    // Removed signature drawing from here as requested to avoid overlapping text.

    // Total Row
    const totalY = y;
    doc.line(margin, totalY, pageWidth - margin, totalY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Amount Chargeable (In Word's) USD ", margin + 1, totalY + 6.5);
    doc.setFont("helvetica", "bold");
    const wordsVal = numberToWordsUSD(parseFloat(record.grandTotal || 0));
    doc.text(wordsVal, margin + 55, totalY + 6.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = record.grandTotal ? parseFloat(record.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
    doc.text(totalVal, pageWidth - margin - 2, totalY + 6.5, { align: 'right' });

    doc.line(margin, totalY + 9, pageWidth - margin, totalY + 9);
    // Vertical line to separate the total amount
    doc.line(pageWidth - margin - 25, totalY, pageWidth - margin - 25, totalY + 9);
    y = totalY + 9;

    // --- Declaration + Signature (side by side) ---
    const declY = y;
    const declWidth = contentWidth * 0.6;
    const sigWidth = contentWidth - declWidth;

    // Declaration (Left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DECLARATION:", margin + 2, declY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const declText = record.declaration || "-We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\nWe do certify that we have no local agent in Bangladesh and the quoted price is net and no commission is payable.";
    const declLines = doc.splitTextToSize(declText, declWidth - 5);
    doc.text(declLines, margin + 2, declY + 10);

    // Signature (Right)
    const sigX = margin + declWidth;
    const sigImageWidth = 50;
    const sigImageX = pageWidth - margin - sigImageWidth - 5; // Align to the right side of the box

    // Exporter signature
    if (record.exporterSignature) {
        try {
            doc.addImage(record.exporterSignature, 'PNG', sigImageX, declY + 2, sigImageWidth, 18);
        } catch (e) {
            console.error('Error adding exporter signature to PDF:', e);
        }
    }

    doc.line(sigImageX, declY + 28, sigImageX + sigImageWidth, declY + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Signature.", sigImageX + (sigImageWidth / 2), declY + 33, { align: 'center' });

    // Open in new tab
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
