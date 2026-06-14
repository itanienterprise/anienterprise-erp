import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to convert number to words for USD
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

    if (amount === 0) return 'Zero.';

    const parts = amount.toFixed(2).split('.');
    let dollar = parseInt(parts[0]);
    let cents = parseInt(parts[1]);

    let words = '';

    if (dollar === 0) {
        words = 'Zero ';
    } else {
        let tw = '';
        if (dollar >= 10000000) { tw += convertChunk(Math.floor(dollar / 10000000)) + 'Crore '; dollar %= 10000000; }
        if (dollar >= 100000) { tw += convertChunk(Math.floor(dollar / 100000)) + 'Lakh '; dollar %= 100000; }
        if (dollar >= 1000) { tw += convertChunk(Math.floor(dollar / 1000)) + 'Thousand '; dollar %= 1000; }
        if (dollar > 0) { tw += convertChunk(dollar); }
        words = tw;
    }

    if (cents > 0) {
        words += 'And Cents ' + convertChunk(cents);
    }

    return words.replace(/\s+/g, ' ').trim() + '.';
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
    const exporterPhone = record.exporterContact || '';
    const exporterEmail = record.exporterEmail || '';
    const expContactParts = [];
    if (exporterPhone) expContactParts.push(`Phone: ${exporterPhone}`);
    if (exporterEmail) expContactParts.push(`Email: ${exporterEmail}`);
    const expContactLine = expContactParts.join(', ');
    if (expContactLine) {
        exporterInfo = exporterInfo.trim() + `\n${expContactLine}`;
    }

    // Render exporter address: each logical line (split by \n) is compressed
    // via charSpace to fit in one column-width if needed.
    const exporterColWidth = leftColWidth - 10;
    const exporterRawLines = exporterInfo.trim().split('\n');
    const exporterCenterX = margin + leftColWidth / 2;
    let expLineY = y + 21;
    const expLineH = 4;
    exporterRawLines.forEach(rawLine => {
        const trimmed = rawLine.trim();
        if (!trimmed) { expLineY += expLineH; return; }
        const w = doc.getTextWidth(trimmed);
        if (w > exporterColWidth) {
            const cs = (exporterColWidth - w) / (trimmed.length - 1);
            doc.text(trimmed, exporterCenterX, expLineY, { align: 'center', charSpace: cs });
        } else {
            doc.text(trimmed, exporterCenterX, expLineY, { align: 'center' });
        }
        expLineY += expLineH;
    });

    // PI Info Content
    const rawPiNumber = record.piNumber || '';
    const isRevised = rawPiNumber.includes('(REVISED)');
    const basePiNumber = rawPiNumber.replace('(REVISED)', '').trim();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Proforma Invoice No:", midX + 2, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(basePiNumber, midX + 28, y + 5);

    if (isRevised) {
        const piWidth = doc.getTextWidth(basePiNumber);
        const centerX = midX + 28 + (piWidth / 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(220, 38, 38);
        doc.text("(REVISED)", centerX, y + 9, { align: 'center' });
        doc.setTextColor(0, 0, 0);
    }

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

    const validityY = isRevised ? (y + 13) : (y + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Proforma Invoice Validity:", midX + 2, validityY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(formatDate(record.validityDate) || '', midX + rightColWidth - 2, validityY, { align: 'right' });

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
    } else if (record.packingType) {
        const formattedPacking = record.packingType.split(',').map(s => s.trim()).join(' / ');
        termsText = termsText.split('\n')
            .map(line => {
                if (line.trim().toLowerCase().startsWith('packing:')) {
                    return `Packing: ${formattedPacking}`;
                }
                return line;
            })
            .join('\n');
    }
    // Split at AGAINST so the delivery clause always occupies exactly one line
    // (compressed via charSpace if needed) and the rest wraps normally below.
    const termsTextFormatted = termsText.replace(/ ?\n(?!Packing:)/g, ' ');
    const termsMaxWidth = rightColWidth - 5;
    const againstIdxT = termsTextFormatted.toUpperCase().indexOf('AGAINST');
    let deliveryClause = '';
    let deliveryCharSpace = 0;
    let restTermsLines = [];
    let termsRefLinesInRow2;
    if (againstIdxT !== -1) {
        deliveryClause = termsTextFormatted.substring(0, againstIdxT + 7).trim();
        const restText = termsTextFormatted.substring(againstIdxT + 7).trimStart();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const dw = doc.getTextWidth(deliveryClause);
        if (dw > termsMaxWidth) {
            deliveryCharSpace = (termsMaxWidth - dw) / (deliveryClause.length - 1);
        }
        restTermsLines = restText ? doc.splitTextToSize(restText, termsMaxWidth) : [];
        termsRefLinesInRow2 = [deliveryClause, ...restTermsLines];
    } else {
        termsRefLinesInRow2 = doc.splitTextToSize(termsTextFormatted, termsMaxWidth);
    }
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
    const phone = record.partyContact || '';
    const email = record.partyEmail || '';
    const contactParts = [];
    if (phone) contactParts.push(`Phone: ${phone}`);
    if (email) contactParts.push(`Email: ${email}`);
    const contactLine = contactParts.join(', ');
    if (contactLine) {
        importerInfo = importerInfo + `\n${contactLine}`;
    }

    const partyLines = doc.splitTextToSize(importerInfo.trim(), leftColWidth - 10);
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

    const showCountryOfOrigin = selectedCerts.some(c => c.toLowerCase().includes('country of origin'));
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
    if (deliveryClause) {
        doc.text(deliveryClause, midX + 2, y + 20, { charSpace: deliveryCharSpace });
        restTermsLines.forEach((line, idx) => {
            doc.text(line, midX + 2, y + 20 + ((idx + 1) * 4));
        });
    } else {
        doc.text(termsRefLinesInRow2, midX + 2, y + 20);
    }

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
        "Negotiation is unrestricted in any Bank in India.",
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
        if (record.packingType) {
            extraDescParts.push(`EXPORT STANDARD PACKING: ${record.packingType.split(',').map(s => s.trim().toUpperCase()).join(' / ')}`);
        } else {
            extraDescParts.push("EXPORT STANDARD PACKING");
        }
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
        if (numProducts === 1 && showCountryOfOrigin) {
            cellText = "\n\n\n\n\n"; // Extra line for Country of Origin text
        }
        if (numProducts === 2) {
            cellText = (pIdx === 0 && showCountryOfOrigin) ? "\n\n\n\n" : "\n\n\n";
        } else if (numProducts >= 3) {
            cellText = (pIdx === 0 && showCountryOfOrigin) ? "\n\n\n" : "\n\n";
        }

        if (numProducts === 1) {
            const descSpacing = showSafta ? "\n\n\n\n\n\n" : "\n\n";
            cellText += descSpacing + extraDescText;
        }

        tableBody.push([
            {
                content: cellText,
                colSpan: 3,
                styles: {
                    halign: 'left',
                    fontStyle: 'normal',
                    fontSize: numProducts === 1 ? 8.5 : 10,
                    cellPadding: { top: 2, left: 1.5, right: 1.5, bottom: numProducts === 1 ? 22 : 2 }
                }
            },
            { content: '', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: '', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: '', styles: { halign: 'center', fontStyle: 'bold' } }
        ]);
    });

    // Description / advising bank row at the end of Style 1 table (only for multi-product)
    if (productsList.length > 1) {
        const descText = showSafta ? "\n\n\n" + extraDescText : extraDescText;
        const cellPaddingTop = showSafta ? 2 : 3;
        tableBody.push([
            {
                content: descText,
                colSpan: 3,
                styles: { halign: 'left', fontStyle: 'normal', cellPadding: { top: cellPaddingTop, left: 1.5, right: 1.5, bottom: 3 } }
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

                // Draw Country of Origin above product name for the 1st product if selected
                if (showCountryOfOrigin && pIdx === 0) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(9);
                    const originY = numProducts === 1 ? cellY + 5.5 : cellY + 5;
                    const originText = `COUNTRY OF ORIGIN OF GOODS: ${(record.countryOrigin || 'INDIA').toUpperCase()}`;
                    doc.text(originText, centerX, originY, { align: 'center' });

                    // Draw underline under Country of Origin
                    const oWidth = doc.getTextWidth(originText);
                    doc.setLineWidth(0.3);
                    doc.line(centerX - oWidth / 2, originY + 1.5, centerX + oWidth / 2, originY + 1.5);
                    doc.setLineWidth(0.1);

                    if (numProducts === 1) {
                        drawY = cellY + 13;
                        gap = 6;
                    } else if (numProducts === 2) {
                        drawY = cellY + 11;
                        gap = 5.5;
                    } else { // numProducts >= 3
                        drawY = cellY + 9.5;
                        gap = 4.8;
                    }
                }

                // 2. Product Name — dynamic bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(pNameSize);
                doc.text(pName, centerX, drawY, { align: 'center' });

                // Add underline under product name
                const pWidth = doc.getTextWidth(pName);
                doc.setLineWidth(0.3);
                doc.line(centerX - pWidth / 2, drawY + 1.5, centerX + pWidth / 2, drawY + 1.5);
                doc.setLineWidth(0.1);

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

                if (showSafta && numProducts === 1) {
                    drawY += 6;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8.5);
                    doc.text("THE CERTIFICATE OF ORIGIN UNDER SAFTA", centerX, drawY, { align: 'center' });
                    drawY += 4.5;
                    doc.text("(South Asian Free Trade Area)", centerX, drawY, { align: 'center' });

                }

                // Reset
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            const isDescRow = productsList.length > 1 && data.row.index === tableBody.length - 1;
            if (data.section === 'body' && data.column.index === 0 && isDescRow) {
                if (showSafta) {
                    const cellX = data.cell.x;
                    const cellY = data.cell.y;
                    const cellWidth = data.cell.width;
                    const centerX = cellX + cellWidth / 2;

                    let drawY = cellY + 5;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8.5);
                    doc.text("THE CERTIFICATE OF ORIGIN UNDER SAFTA", centerX, drawY, { align: 'center' });
                    drawY += 4.5;
                    doc.text("(South Asian Free Trade Area)", centerX, drawY, { align: 'center' });


                    // Reset
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8.5);
                }
            }

            // Draw quantity, rate, amount values (FOB + Freight stacked in same cell)
            if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4 || data.column.index === 5) && firstRowIndexForProduct.includes(data.row.index)) {
                const pIdxVal = firstRowIndexForProduct.indexOf(data.row.index);
                const prodVal = productsList[pIdxVal];
                const hasFreightVal = prodVal.freight && parseFloat(prodVal.freight) > 0;

                const cX = data.cell.x;
                const cY = data.cell.y;
                const cW = data.cell.width;
                const cCenterX = cX + cW / 2;
                const sepY = cY + 10;

                if (data.column.index === 3) {
                    // Quantity column
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8.5);
                    const qtyText = prodVal.quantity ? parseFloat(prodVal.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0';
                    doc.text(qtyText, cCenterX, cY + 5.5, { align: 'center' });

                    if (hasFreightVal) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8.5);
                        doc.text('Freight', cCenterX, sepY + 5, { align: 'center' });
                    }
                } else if (data.column.index === 4) {
                    // Rate column - FOB Value label below rate
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8.5);
                    const rateText = prodVal.rate ? parseFloat(prodVal.rate).toFixed(3) : '0.000';
                    doc.text(rateText, cCenterX, cY + 4.5, { align: 'center' });
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(6.5);
                    doc.text('FOB Value', cCenterX, cY + 8.5, { align: 'center' });

                    if (hasFreightVal) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8.5);
                        doc.text(parseFloat(prodVal.freight).toFixed(3), cCenterX, sepY + 5, { align: 'center' });
                    }
                } else if (data.column.index === 5) {
                    // Amount column
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(8.5);
                    const amtText = prodVal.amount ? parseFloat(prodVal.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
                    doc.text(amtText, cCenterX, cY + 5.5, { align: 'center' });

                    if (hasFreightVal) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(8.5);
                        const freightAmtText = prodVal.totalFreight ? parseFloat(prodVal.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
                        doc.text(freightAmtText, cCenterX, sepY + 5, { align: 'center' });
                    }
                }

                // Reset font
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }
        },
        didDrawPage: (data) => {
            y = data.cursor.y;
        }
    });
    y = doc.lastAutoTable.finalY;

    // Total Row & Amount in Words (Same row)
    const totalY = y;

    const wordsVal = numberToWordsUSD(parseFloat(record.grandTotal || 0));
    const labelText = "Amount Chargeable in words: US Dollar: ";
    const maxWordWidth = pageWidth - margin - 70 - (margin + 2); // 190 - 70 - 2 = 118

    // Measure label (normal) and value (bold) at font size 8.5
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const labelWidth = doc.getTextWidth(labelText);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const valueWidth = doc.getTextWidth(wordsVal);
    const availableForValue = maxWordWidth - labelWidth;

    // Compress value via charSpace to always fit on the same line as the label
    const valueCharSpace = valueWidth > availableForValue
        ? (availableForValue - valueWidth) / (wordsVal.length - 1)
        : 0;

    const rowHeight = 9;
    doc.line(margin, totalY, pageWidth - margin, totalY);

    // 1. Draw label (normal) then value (bold) on the same line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(labelText, margin + 2, totalY + 5.5);

    doc.setFont("helvetica", "bold");
    doc.text(wordsVal, margin + 2 + labelWidth, totalY + 5.5, { charSpace: valueCharSpace });

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
        doc.text("For,", margin + 2, y + 3);

        // Buyer signature (Left)
        if (record.partySignature) {
            try {
                doc.addImage(record.partySignature, 'PNG', margin + 5, y + 3, 60, 12);
            } catch (e) {
                console.error('Error adding importer signature to PDF:', e);
            }
        }
        doc.line(margin + 5, y + 18, margin + 65, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", margin + 35, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Buyer", margin + 35, y + 26, { align: 'center' });

        // Seller signature (Right)
        if (record.exporterSignature) {
            try {
                doc.addImage(record.exporterSignature, 'PNG', pageWidth - margin - 65, y + 1, 60, 18);
            } catch (e) {
                console.error('Error adding exporter signature to PDF:', e);
            }
        }
        doc.line(pageWidth - margin - 65, y + 18, pageWidth - margin - 5, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth - margin - 35, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Seller", pageWidth - margin - 35, y + 26, { align: 'center' });

    } else if (style === 'Style 2 AAS') {
        doc.setFontSize(8.5);
        doc.text("For,", margin + 2, y + 3);

        // Seller signature (Left)
        if (record.exporterSignature) {
            try {
                doc.addImage(record.exporterSignature, 'PNG', margin + 5, y + 1, 60, 18);
            } catch (e) {
                console.error('Error adding exporter signature to PDF:', e);
            }
        }
        doc.line(margin + 5, y + 18, margin + 65, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", margin + 35, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Seller", margin + 35, y + 26, { align: 'center' });

        // Buyer signature (Right)
        if (record.partySignature) {
            try {
                doc.addImage(record.partySignature, 'PNG', pageWidth - margin - 65, y + 3, 60, 12);
            } catch (e) {
                console.error('Error adding importer signature to PDF:', e);
            }
        }
        doc.line(pageWidth - margin - 65, y + 18, pageWidth - margin - 5, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth - margin - 35, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Buyer", pageWidth - margin - 35, y + 26, { align: 'center' });

    } else {
        // Style 3 / Fallback - classic 3 column style with "Authorized Signatory" in the middle instead of "Advising Bank"
        doc.setFontSize(8.5);
        doc.text("For,", margin + 2, y + 3);

        // Seller signature (Left)
        if (record.exporterSignature) {
            try {
                doc.addImage(record.exporterSignature, 'PNG', margin + 5, y + 1, 50, 18);
            } catch (e) {
                console.error('Error adding exporter signature to PDF:', e);
            }
        }
        doc.line(margin + 5, y + 18, margin + 55, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", margin + 25, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Seller", margin + 25, y + 26, { align: 'center' });

        // Authorized Signatory (Middle)
        doc.line((pageWidth / 2) - 25, y + 18, (pageWidth / 2) + 25, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth / 2, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Authorized Signature", pageWidth / 2, y + 26, { align: 'center' });

        // Buyer / Acceptor (Right)
        if (record.partySignature) {
            try {
                doc.addImage(record.partySignature, 'PNG', pageWidth - margin - 55, y + 3, 50, 12);
            } catch (e) {
                console.error('Error adding importer signature to PDF:', e);
            }
        }
        doc.line(pageWidth - margin - 55, y + 18, pageWidth - margin - 5, y + 18);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Signature", pageWidth - margin - 30, y + 22, { align: 'center' });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Buyer", pageWidth - margin - 30, y + 26, { align: 'center' });
    }

    // Opening in new tab instead of direct download
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
