import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to convert number to words for BDT
const numberToWordsUSD = (amount) => {
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

    const parts = amount.toFixed(2).split('.');
    let taka = parseInt(parts[0]);
    let paisa = parseInt(parts[1]);

    let words = '';

    if (taka === 0) {
        words = 'Zero ';
    } else {
        let tw = '';
        if (taka >= 10000000) { tw += convertChunk(Math.floor(taka / 10000000)) + 'Crore '; taka %= 10000000; }
        if (taka >= 100000) { tw += convertChunk(Math.floor(taka / 100000)) + 'Lakh '; taka %= 100000; }
        if (taka >= 1000) { tw += convertChunk(Math.floor(taka / 1000)) + 'Thousand '; taka %= 1000; }
        if (taka > 0) { tw += convertChunk(taka); }
        words = tw;
    }

    words += 'Taka ';

    if (paisa > 0) {
        words += 'And ' + convertChunk(paisa) + 'Paisa Only';
    } else {
        words += 'Only';
    }

    return words.replace(/\s+/g, ' ').trim();
};

export const generatePIPDF = (record) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (2 * margin);

    doc.setFont("helvetica", "normal");

    const selectedCerts = (record.certification || '').split(',').map(s => s.trim()).filter(Boolean);
    const showPacking = selectedCerts.some(c => c.toLowerCase().includes('packing'));

    // Helper function for date formatting
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Draw Main Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(margin, margin, contentWidth, pageHeight - (2 * margin));

    const productsList = record.productsList && record.productsList.length > 0
        ? record.productsList
        : [{
            productName: record.productName || '',
            hsCode: record.hsCode || '',
            quantity: record.quantity || '',
            rate: record.rate || '',
            amount: record.amount || '',
            freight: record.freight || '',
            totalFreight: record.totalFreight || ''
        }];

    const isMultiProduct = productsList.length > 1;

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PROFORMA INVOICE", pageWidth / 2, margin + 7, { align: 'center' });
    doc.line(margin, margin + 10, pageWidth - margin, margin + 10);

    // --- Grid Layout ---
    const leftColWidth = contentWidth * 0.55;
    const rightColWidth = contentWidth - leftColWidth;
    const midX = margin + leftColWidth;

    // Row 1: Exporter vs PI Info
    let y = margin + 10;
    let row1Height = 38; // Reduced from 45
    doc.rect(margin, y, leftColWidth, row1Height); // Exporter
    doc.rect(midX, y, rightColWidth, row1Height); // PI Details

    // Exporter Content
    doc.setFontSize(12); // Increased to 12
    doc.setFont("helvetica", "bold"); // Changed to bold
    doc.text("Exporter", margin + leftColWidth / 2, y + 6, { align: 'center' });

    // Draw manual underline for "Exporter"
    const exporterLabelWidth = doc.getTextWidth("Exporter");
    const labelX = margin + (leftColWidth / 2) - (exporterLabelWidth / 2);
    doc.line(labelX, y + 7, labelX + exporterLabelWidth, y + 7);

    doc.setFontSize(14); // Scaled up name accordingly
    const exporterName = record.exporterName || '';
    const nameLines = doc.splitTextToSize(exporterName, leftColWidth - 10);
    doc.text(nameLines, margin + leftColWidth / 2, y + 14, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let exporterInfo = record.exporterAddress || '';
    if (record.exporterEmail) exporterInfo += `\nEmail: ${record.exporterEmail}`;

    const exporterLines = doc.splitTextToSize(exporterInfo, leftColWidth - 10);
    doc.text(exporterLines, margin + leftColWidth / 2, y + 21, { align: 'center' });

    // PI Info Content
    doc.setFontSize(7);
    doc.text("Proforma Invoice No:", midX + 2, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(record.piNumber || '', midX + 28, y + 5);

    // Align Date label and value together at the right
    const dateVal = formatDate(record.date) || '';
    const dateLabel = "Date: ";

    // Calculate widths with correct fonts
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const dateLabelWidth = doc.getTextWidth(dateLabel);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const dateValWidth = doc.getTextWidth(dateVal);

    // Draw label
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(dateLabel, midX + rightColWidth - dateValWidth - dateLabelWidth - 2, y + 5);

    // Draw value
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(dateVal, midX + rightColWidth - 2, y + 5, { align: 'right' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Proforma Invoice Validity:", midX + 2, y + 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(formatDate(record.validityDate) || '', midX + rightColWidth - 2, y + 9, { align: 'right' });

    doc.line(midX, y + 18, pageWidth - margin, y + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Buyers Order No. & Date:", midX + 2, y + 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(record.buyerOrderNo || '', midX + 2, y + 27);

    doc.line(midX, y + 31, pageWidth - margin, y + 31);
    doc.setFont("helvetica", "normal");
    doc.text("Other References", midX + 2, y + 35);
    doc.setFont("helvetica", "bold");
    doc.text(record.otherReferences || '', midX + 2, y + 35);

    // Row 2: Importer vs Shipping Info (Stacked Left)
    y += row1Height;
    const showSafta = record.certification && record.certification.toLowerCase().includes('safta');
    let termsText = record.termsDeliveryPayment || '';
    if (!showPacking) {
        termsText = termsText.split('\n')
            .filter(line => !line.trim().toLowerCase().startsWith('packing:'))
            .join('\n');
    }
    const termsRefLinesInRow2 = doc.splitTextToSize(termsText, rightColWidth - 5);
    const termsHeight = termsRefLinesInRow2.length * 4;
    const saftaHeight = showSafta ? 12 : 0;
    let row2Height = Math.max(55, 24 + termsHeight + saftaHeight);
    doc.rect(margin, y, leftColWidth, row2Height); // Full Stack
    doc.rect(midX, y, rightColWidth, row2Height); // Right area

    // Importer Section (Left)
    doc.setFontSize(12); // Increased to 12
    doc.setFont("helvetica", "bold"); // Changed to bold
    doc.text("Importer", margin + leftColWidth / 2, y + 5, { align: 'center' });

    // Draw manual underline for "Importer"
    const importerLabelWidth = doc.getTextWidth("Importer");
    const impLabelX = margin + (leftColWidth / 2) - (importerLabelWidth / 2);
    doc.line(impLabelX, y + 6, impLabelX + importerLabelWidth, y + 6);

    doc.setFontSize(14); // Scaled up name accordingly
    const partyName = record.partyName || '';
    const partyNameLines = doc.splitTextToSize(partyName, leftColWidth - 10);
    doc.text(partyNameLines, margin + leftColWidth / 2, y + 12, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let importerInfo = record.partyAddress || '';
    importerInfo = importerInfo.trim();

    const partyLines = doc.splitTextToSize(importerInfo, leftColWidth - 10);
    doc.text(partyLines, margin + leftColWidth / 2, y + 17, { align: 'center' });

    // Shipping Section 1 (Compact)
    doc.line(margin, y + 27, margin + leftColWidth, y + 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Pre-Carriage by", margin + leftColWidth / 4, y + 30.5, { align: 'center' });
    doc.text("Place of Receipt by Pre-Carrier", margin + (3 * leftColWidth / 4), y + 30.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.preCarriageBy || '', margin + leftColWidth / 4, y + 35, { align: 'center' });
    doc.text(record.placeOfReceipt || record.placeOfReceiptByPreCarrier || '', margin + (3 * leftColWidth / 4), y + 35, { align: 'center' });

    // Shipping Section 2 (Compact)
    doc.line(margin, y + 36, margin + leftColWidth, y + 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 39.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 39.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.vesselFlightNo || '', margin + leftColWidth / 4, y + 44, { align: 'center' });
    doc.text(record.portOfLoading || 'ANY PLACE OF INDIA', margin + (3 * leftColWidth / 4), y + 44, { align: 'center' });

    // Shipping Section 3 (Compact)
    doc.line(margin, y + 45, margin + leftColWidth, y + 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 48.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 48.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.portOfDischarge || record.port || 'HILI', margin + leftColWidth / 4, y + 53, { align: 'center' });
    doc.text(record.finalDestination || 'BANGLADESH', margin + (3 * leftColWidth / 4), y + 53, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 27, margin + (leftColWidth / 2), y + row2Height);

    // Right Column Row 2 (Top Half): Buyer & Country Side-by-Side
    const subColWidthVal = rightColWidth / 2;

    if (isMultiProduct) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Country of Origin", midX + 2, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text((record.countryOrigin || 'INDIA').toUpperCase(), midX + 2, y + 7);
    } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Buyer (if other than Consignee)", midX + 2, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const buyerLinesVal = doc.splitTextToSize(record.buyerName || '', subColWidthVal - 5);
        doc.text(buyerLinesVal, midX + 2, y + 7);
    }

    doc.line(midX + subColWidthVal, y, midX + subColWidthVal, y + 10); // Vertical divider for Buyer/Country

    const showCountryOfOrigin = true;
    // Reuse selectedCerts defined at function top
    const otherCerts = selectedCerts.filter(c => {
        const lower = c.toLowerCase();
        return !lower.includes('country of origin') &&
               !lower.includes('safta') &&
               !lower.includes('packing') &&
               !(lower.includes('value') && lower.includes('quantity'));
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Final Destination", midX + subColWidthVal + 2, y + 3);
    if (otherCerts.length > 0) {
        doc.text("Certification", midX + subColWidthVal + 2, y + 10);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.countryFinalDest || 'BANGLADESH', midX + subColWidthVal + 2, y + 7);
    if (otherCerts.length > 0) {
        doc.text(otherCerts.join(', '), midX + subColWidthVal + 2, y + 14);
    }

    doc.line(midX, y + 10, pageWidth - margin, y + 10);

    // Terms of Delivery and Payment (Compact)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Terms of Delivery and Payment", midX + 2, y + 14);
    doc.setFontSize(9);
    doc.text(termsRefLinesInRow2, midX + 2, y + 20);

    if (showSafta) {
        const saftaY = y + 20 + termsHeight + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("THE CERTIFICATE OF ORIGIN UNDER SAFTA", midX + rightColWidth / 2, saftaY, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("(South Asian Free Trade Area)", midX + rightColWidth / 2, saftaY + 4, { align: 'center' });
    }

    y += row2Height;

    // --- Table Section ---

    const tableBody = [];
    const firstRowIndexForProduct = [];
    const freightRowIndices = [];

    const showValQty = selectedCerts.some(c => {
        const lower = c.toLowerCase();
        return lower.includes('value') && lower.includes('quantity');
    });
    // Reuse showPacking defined at function top

    // Default description template (used when descriptionGoods field is empty)
    const defaultDescLines = [
        "Insurance to be covered by the opener.",
        "Partial Bill & Partial Payment be allowed.",
        "Negotiation any Bank in India.",
        "All Foreign Bank Charges outside Bangladesh are on account of Beneficiary.",
        "",
        "TRANSHIPMENT: ALLOWED",
        "PARTIAL SHIPMENT: ALLOWED"
    ].join("\n");

    const bankLine = `ADVISING BANK MUST BE THROUGH: ${record.indianBank || ''}`;
    let extraDescParts = [];
    if (showValQty) {
        extraDescParts.push("VALUE & QUANTITY \u00B1 10% ACCEPTABLE.");
    }
    extraDescParts.push(bankLine);
    if (showPacking) {
        extraDescParts.push("EXPORT STANDARD PACKING");
    }
    const extraDescText = (extraDescParts.join("\n") + "\n" + (record.descriptionGoods || defaultDescLines)).trim();

    // Build the table body dynamically for each product
    productsList.forEach((prod, pIdx) => {
        const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
        const isLastProduct = pIdx === productsList.length - 1;

        firstRowIndexForProduct.push(tableBody.length);

        // Reserve space for drawing product, HS code etc.
        const numProducts = productsList.length;
        let cellText = "\n\n\n\n";
        if (numProducts === 1 && showCountryOfOrigin && !isMultiProduct) {
            cellText = "\n\n\n\n\n"; // Extra line for Country of Origin text
        }
        if (numProducts === 2) {
            cellText = "\n\n\n";
        } else if (numProducts >= 3) {
            cellText = "\n\n";
        }
        if (showSafta && isLastProduct) {
            cellText += "\n\n";
        }
        if (numProducts === 1) {
            cellText += "\n\n" + extraDescText;
        }

        tableBody.push([
            {
                content: cellText,
                colSpan: 3,
                rowSpan: hasFreight ? 2 : 1,
                styles: {
                    halign: 'left',
                    fontStyle: 'normal',
                    fontSize: numProducts === 1 ? 8.5 : 10,
                    cellPadding: { top: 2, left: 1.5, right: 1.5, bottom: numProducts === 1 ? 22 : 2 }
                }
            },
            { content: prod.quantity ? parseFloat(prod.quantity).toLocaleString('en-US') : '0', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: prod.rate ? parseFloat(prod.rate).toFixed(3) : '0.000', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: prod.amount ? parseFloat(prod.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold' } }
        ]);

        if (hasFreight) {
            freightRowIndices.push(tableBody.length);
            tableBody.push([
                { content: 'Freight', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 } } },
                { content: parseFloat(prod.freight).toFixed(3), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 } } },
                { content: prod.totalFreight ? parseFloat(prod.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 } } }
            ]);
        }
    });

    // Description / advising bank row at the end of Style 1 table (only for multi-product)
    if (productsList.length > 1) {
        tableBody.push([
            {
                content: extraDescText,
                colSpan: 3,
                styles: { halign: 'left', fontStyle: 'normal', cellPadding: { top: 3, left: 1.5, right: 1.5, bottom: 3 } }
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
            fontSize: 8.5,
            cellPadding: 1.5,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            valign: 'top',
            textColor: [0, 0, 0],
            font: 'helvetica'
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            lineWidth: 0.1,
            cellPadding: 1
        },
        head: [
            ['Marks & No./\nContainer No.', 'No. & Kind\nof Package.', 'Description of Goods', 'Quantity\n(KG)', 'Rate\nPer KG\nUS $', 'Amount\nUS $']
        ],
        body: tableBody,
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 20 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 18, halign: 'right' },
            4: { cellWidth: 18, halign: 'right' },
            5: { cellWidth: 22, halign: 'right' },
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0 && firstRowIndexForProduct.includes(data.row.index)) {
                const pIdx = firstRowIndexForProduct.indexOf(data.row.index);
                const prod = productsList[pIdx];
                const pName = (prod.productName || '').toUpperCase();
                const hsCodeLine = `H.S. CODE NO.${prod.hsCode || ''}`;

                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const centerX = cellX + cellWidth / 2;
                const numProducts = productsList.length;
                let drawY = cellY + 11;
                let pNameSize = 16;
                let hsCodeSize = 10;
                let gap = 7;

                if (numProducts === 2) {
                    drawY = cellY + 6.5;
                    pNameSize = 12;
                    hsCodeSize = 8.5;
                    gap = 6;
                } else if (numProducts >= 3) {
                    drawY = cellY + 5;
                    pNameSize = 11;
                    hsCodeSize = 8;
                    gap = 4.8;
                }

                // Draw Country of Origin above product name for single product
                if (showCountryOfOrigin && !isMultiProduct && numProducts === 1) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(9);
                    doc.text(`COUNTRY OF ORIGIN OF GOODS: ${(record.countryOrigin || 'INDIA').toUpperCase()}`, centerX, cellY + 5.5, { align: 'center' });
                    drawY = cellY + 13;
                    gap = 6;
                }

                // 2. Product Name — dynamic bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(pNameSize);
                doc.text(pName, centerX, drawY, { align: 'center' });
                drawY += gap;

                // 3. HS Code — dynamic bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(hsCodeSize);
                if (prod.hsCodeInd) {
                    // Show both BD and IND HS codes
                    const bdHsLine = `H.S. CODE NO.${prod.hsCode || ''} (BD)`;
                    const indHsLine = `H.S. CODE NO.${prod.hsCodeInd} (IND)`;
                    doc.text(bdHsLine, centerX, drawY, { align: 'center' });
                    drawY += 4.5;
                    doc.text(indHsLine, centerX, drawY, { align: 'center' });
                } else {
                    doc.text(hsCodeLine, centerX, drawY, { align: 'center' });
                }
                if (showSafta && pIdx === productsList.length - 1) {
                    drawY += 1;
                    doc.setDrawColor(0, 0, 0);
                    doc.setLineWidth(0.1);
                    doc.line(cellX, drawY, cellX + cellWidth, drawY);

                    drawY += 5;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8.5);
                    doc.text("THE CERTIFICATE OF ORIGIN UNDER SAFTA", centerX, drawY, { align: 'center' });
                    drawY += 4.5;
                    doc.text("(South Asian Free Trade Area)", centerX, drawY, { align: 'center' });
                    drawY += 6;
                }

                // Reset
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            // Remove middle horizontal line between Product and Freight row
            if (data.section === 'body' && freightRowIndices.includes(data.row.index)) {
                // Erase the horizontal line completely with a thick white line
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5); // Thick enough to cover borders
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

    // Total Row & Amount in Words (Same row)
    const totalY = y;

    const wordsVal = numberToWordsUSD(parseFloat(record.grandTotal || 0));
    const fullWordsText = `Amount Chargeable in words: US Dollar: ${wordsVal}`;
    const maxWordWidth = pageWidth - margin - 70 - (margin + 2); // 190 - 70 - 2 = 118
    const wrappedWords = doc.splitTextToSize(fullWordsText, maxWordWidth);

    const rowHeight = wrappedWords.length > 1 ? 13 : 9;
    doc.line(margin, totalY, pageWidth - margin, totalY);

    // 1. Draw Amount in word on the LEFT
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    wrappedWords.forEach((lineText, lIdx) => {
        doc.text(lineText, margin + 2, totalY + 5.5 + (lIdx * 4.5));
    });

    // 2. Draw TOTAL on the RIGHT
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = record.grandTotal ? `$ ${parseFloat(record.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '$ 0.00';
    doc.text(`TOTAL:-  ${totalVal}`, pageWidth - margin - 2, totalY + (rowHeight / 2) + 1.5, { align: 'right' });

    doc.line(margin, totalY + rowHeight, pageWidth - margin, totalY + rowHeight);
    y = totalY + rowHeight;

    // Declaration
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10); // Increased from 8
    doc.text("Declaration:", margin + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5); // Increased from 7
    const declLines = [
        "1.   Deliveries age quoted in good faith, however we shall not be responsible for delays due to reasons beyond our control.",
        "2.   We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."
    ];
    doc.text(declLines[0], margin + 5, y + 11);
    doc.text(declLines[1], margin + 5, y + 16);

    doc.line(margin, y + 18, pageWidth - margin, y + 18);

    // Signature Area
    y += 18;

    const style = record.invoiceStyle || 'Style 1 SAA';

    if (style === 'Style 1 SAA') {
        // This generates the EXACT existing PDF layout (Buyer Left, Seller Right)
        doc.setFontSize(8.5);
        doc.text("For,", margin + 2, y + 4);

        // Buyer signature (Left)
        if (record.partySignature) {
            try {
                doc.addImage(record.partySignature, 'PNG', margin + 5, y + 4, 60, 12);
            } catch (e) {
                console.error('Error adding importer signature to PDF:', e);
            }
        }
        doc.line(margin + 5, y + 26, margin + 65, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", margin + 35, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Buyer", margin + 35, y + 35, { align: 'center' });

        // Seller signature (Right)
        if (record.exporterSignature) {
            try {
                doc.addImage(record.exporterSignature, 'PNG', pageWidth - margin - 65, y + 2, 60, 18);
            } catch (e) {
                console.error('Error adding exporter signature to PDF:', e);
            }
        }
        doc.line(pageWidth - margin - 65, y + 26, pageWidth - margin - 5, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth - margin - 35, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Seller", pageWidth - margin - 35, y + 35, { align: 'center' });

    } else if (style === 'Style 2 AAS') {
        doc.setFontSize(8.5);
        doc.text("For,", margin + 2, y + 4);

        // Seller signature (Left)
        if (record.exporterSignature) {
            try {
                doc.addImage(record.exporterSignature, 'PNG', margin + 5, y + 2, 60, 18);
            } catch (e) {
                console.error('Error adding exporter signature to PDF:', e);
            }
        }
        doc.line(margin + 5, y + 26, margin + 65, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", margin + 35, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Seller", margin + 35, y + 35, { align: 'center' });

        // Buyer signature (Right)
        if (record.partySignature) {
            try {
                doc.addImage(record.partySignature, 'PNG', pageWidth - margin - 65, y + 4, 60, 12);
            } catch (e) {
                console.error('Error adding importer signature to PDF:', e);
            }
        }
        doc.line(pageWidth - margin - 65, y + 26, pageWidth - margin - 5, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth - margin - 35, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Buyer", pageWidth - margin - 35, y + 35, { align: 'center' });

    } else {
        // Style 3 / Fallback - classic 3 column style with "Authorized Signatory" in the middle instead of "Advising Bank"
        doc.setFontSize(8.5);
        doc.text("For,", margin + 2, y + 4);

        // Seller signature (Left)
        if (record.exporterSignature) {
            try {
                doc.addImage(record.exporterSignature, 'PNG', margin + 5, y + 2, 50, 18);
            } catch (e) {
                console.error('Error adding exporter signature to PDF:', e);
            }
        }
        doc.line(margin + 5, y + 26, margin + 55, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", margin + 25, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Seller", margin + 25, y + 35, { align: 'center' });

        // Authorized Signatory (Middle)
        doc.line((pageWidth / 2) - 25, y + 26, (pageWidth / 2) + 25, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth / 2, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Authorized Signature", pageWidth / 2, y + 35, { align: 'center' });

        // Buyer / Acceptor (Right)
        if (record.partySignature) {
            try {
                doc.addImage(record.partySignature, 'PNG', pageWidth - margin - 55, y + 4, 50, 12);
            } catch (e) {
                console.error('Error adding importer signature to PDF:', e);
            }
        }
        doc.line(pageWidth - margin - 55, y + 26, pageWidth - margin - 5, y + 26);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth - margin - 30, y + 30, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Buyer", pageWidth - margin - 30, y + 35, { align: 'center' });
    }

    // Opening in new tab instead of direct download
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
