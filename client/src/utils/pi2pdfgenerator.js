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
    if (amount === 0) return 'Zero.';
    const parts = amount.toFixed(2).split('.');
    let dollar = parseInt(parts[0]), cents = parseInt(parts[1]);
    let words = '';
    if (dollar === 0) { words = 'Zero '; } else {
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
    const exporterPhone = record.exporterContact || '';
    const exporterEmail = record.exporterEmail || '';
    if (exporterPhone) {
        exporterInfo = exporterInfo.trim() + `\nPhone: ${exporterPhone}`;
    }
    if (exporterEmail) {
        exporterInfo = exporterInfo.trim() + `\nEmail: ${exporterEmail}`;
    }
    // Render exporter address: compress each logical line via charSpace to fit on one line.
    const exporterColWidth = leftColWidth - 10;
    const exporterCenterX = margin + leftColWidth / 2;
    let expLineY = y + 17;
    const expLineH = 4;
    exporterInfo.trim().split('\n').forEach(rawLine => {
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
    const showCountryOfOrigin = true;
    // Reuse selectedCerts defined at function top
    const otherCerts = selectedCerts.filter(c => {
        const lower = c.toLowerCase();
        return !lower.includes('country of origin') &&
            !lower.includes('safta') &&
            !lower.includes('packing') &&
            !(lower.includes('value') && lower.includes('quantity'));
    });
    const countrySectionHeight = otherCerts.length > 0 ? (showCountryOfOrigin ? 18 : 10) : 10;

    let termsText = record.termsDeliveryPayment || '';
    if (!showPacking) {
        termsText = termsText.split('\n')
            .filter(line => !line.trim().toLowerCase().startsWith('packing:'))
            .join('\n');
    } else {
        let hasPackingLine = false;
        termsText = termsText.split('\n')
            .map(line => {
                if (line.trim().toLowerCase().startsWith('packing:')) {
                    hasPackingLine = true;
                    return `Packing: Export Standard`;
                }
                return line;
            })
            .join('\n');
        if (!hasPackingLine) {
            termsText += `\nPacking: Export Standard`;
        }
    }
    // Collapse soft newlines so words like "AGAINST" are not orphaned on their own line.
    const termsTextFormatted = termsText.replace(/ ?\n(?!Packing:)/gi, ' ');
    // Split at AGAINST: compress that first line onto one line via charSpace,
    // then wrap the rest (L/C clause, Packing) normally below it.
    const termsMaxWidth2 = rightColWidth - 5;
    const againstIdx2 = termsTextFormatted.toUpperCase().indexOf('AGAINST');
    let deliveryLines2 = [];
    let deliveryCharSpace2 = 0;
    let restTermsLines2 = [];
    let termsLines;
    if (againstIdx2 !== -1) {
        const deliveryClause2 = termsTextFormatted.substring(0, againstIdx2 + 7).trim();
        const restText2 = termsTextFormatted.substring(againstIdx2 + 7).trimStart();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const dw2 = doc.getTextWidth(deliveryClause2);
        if (dw2 > termsMaxWidth2) {
            const neededCs = (termsMaxWidth2 - dw2) / (deliveryClause2.length - 1);
            if (neededCs < -0.02) {
                deliveryLines2 = doc.splitTextToSize(deliveryClause2, termsMaxWidth2);
                deliveryCharSpace2 = 0;
            } else {
                deliveryLines2 = [deliveryClause2];
                deliveryCharSpace2 = neededCs;
            }
        } else {
            deliveryLines2 = [deliveryClause2];
            deliveryCharSpace2 = 0;
        }
        restTermsLines2 = restText2 ? doc.splitTextToSize(restText2, termsMaxWidth2) : [];
        termsLines = [...deliveryLines2, ...restTermsLines2];
    } else {
        termsLines = doc.splitTextToSize(termsTextFormatted, termsMaxWidth2);
    }
    const termsHeight = termsLines.length * 4;
    const saftaHeight = showSafta ? 12 : 0;
    let row2Height = Math.max(64, countrySectionHeight + 14 + termsHeight + saftaHeight);
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
    const phone = record.partyContact || '';
    const email = record.partyEmail || '';
    if (phone) {
        impInfo = impInfo.trim() + `\nPhone: ${phone}`;
    }
    if (email) {
        impInfo = impInfo.trim() + `\nEmail: ${email}`;
    }
    doc.text(doc.splitTextToSize(impInfo.trim(), leftColWidth - 10), margin + leftColWidth / 2, y + 17, { align: 'center' });

    // Shipping rows (left)
    doc.line(margin, y + 33, margin + leftColWidth, y + 33);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Pre-Carriage by", margin + leftColWidth / 4, y + 36.5, { align: 'center' });
    doc.text("Place of Receipt by Pre-Carrier", margin + (3 * leftColWidth / 4), y + 36.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.preCarriageBy || '', margin + leftColWidth / 4, y + 41, { align: 'center' });
    doc.text(record.placeOfReceipt || record.placeOfReceiptByPreCarrier || '', margin + (3 * leftColWidth / 4), y + 41, { align: 'center' });

    doc.line(margin, y + 43, margin + leftColWidth, y + 43);
    doc.setFontSize(8.5);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 46.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 46.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.vesselFlightNo || '', margin + leftColWidth / 4, y + 51, { align: 'center' });
    doc.text(record.portOfLoading || 'ANY PLACE OF INDIA', margin + (3 * leftColWidth / 4), y + 51, { align: 'center' });

    doc.line(margin, y + 53, margin + leftColWidth, y + 53);
    doc.setFontSize(8.5);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 56.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 56.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.portOfDischarge || record.port || 'HILI', margin + leftColWidth / 4, y + 61, { align: 'center' });
    doc.text(record.finalDestination || 'BANGLADESH', margin + (3 * leftColWidth / 4), y + 61, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 33, margin + (leftColWidth / 2), y + row2Height);

    // Right: Country of Origin / Final Destination
    const subW = rightColWidth / 2;

    if (showCountryOfOrigin) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Country of Origin", midX + 2, y + 3);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(record.countryOrigin || 'INDIA', midX + 2, y + 7);
    }

    // Country of Final Destination
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Country of Final Destination", midX + subW + 2, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.countryFinalDest || 'BANGLADESH', midX + subW + 2, y + 7);

    if (otherCerts.length > 0) {
        const certLabelY = showCountryOfOrigin ? 13 : 3;
        const certValY = showCountryOfOrigin ? 16.5 : 7;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Certification", midX + 2, y + certLabelY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(otherCerts.join(', '), midX + 2, y + certValY);
    }

    // Draw vertical divider between Country cells
    doc.line(midX + subW, y, midX + subW, y + 10);
    // Draw horizontal line below Country cells
    doc.line(midX, y + 10, pageWidth - margin, y + 10);
    // Draw horizontal line below Certification cells if they exist
    if (otherCerts.length > 0) {
        doc.line(midX, y + countrySectionHeight, pageWidth - margin, y + countrySectionHeight);
    }

    // Terms of Delivery and Payment
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("Terms of Delivery and Payment", midX + 2, y + countrySectionHeight + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let currentY = y + countrySectionHeight + 10;
    if (againstIdx2 !== -1) {
        deliveryLines2.forEach((line) => {
            const cs = deliveryLines2.length === 1 ? deliveryCharSpace2 : 0;
            doc.text(line, midX + 2, currentY, { charSpace: cs });
            currentY += 4;
        });
        restTermsLines2.forEach((line) => {
            doc.text(line, midX + 2, currentY);
            currentY += 4;
        });
    } else {
        termsLines.forEach((line) => {
            doc.text(line, midX + 2, currentY);
            currentY += 4;
        });
    }

    if (showSafta) {
        const saftaY = y + countrySectionHeight + 10 + termsHeight + 4;
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

    const showValQty = selectedCerts.some(c => {
        const lower = c.toLowerCase();
        return lower.includes('value') && lower.includes('quantity');
    });

    // Order: Value & Quantity → Country of Origin → Packing → Advising Bank → Validity of PI
    if (showValQty) {
        descParts.push('VALUE & QUANTITY ± 10% ACCEPTABLE.');
    }
    if (showCountryOfOrigin) {
        descParts.push(`COUNTRY OF ORIGIN ${(record.countryOrigin || 'INDIA').toUpperCase()}`);
    }
    if (showPacking) {
        descParts.push('Export Standard Packing');
    }
    if (record.indianBank) {
        descParts.push(`ADVISING BANK MUST BE THROUGH: ${record.indianBank}`);
    }
    if (record.validityDate) {
        descParts.push(`VALIDITY OF PROFORMA INVOICE DATE:${formatDate(record.validityDate)}`);
    }

    if (otherCerts.length > 0) {
        descParts.push(`CERTIFICATION ${otherCerts.join(', ').toUpperCase()}`);
    }

    if (record.descriptionGoods) {
        const descExtra = record.descriptionGoods
            .split('\n')
            .filter(line => {
                const trimmed = line.trim().toLowerCase();
                return !trimmed.startsWith('advising bank')
                    && !trimmed.includes('must be through')
                    && !trimmed.startsWith('country of origin')
                    && !trimmed.includes('export standard packing')
                    && !trimmed.startsWith('validity of proforma')
                    && !(trimmed.includes('value') && trimmed.includes('quantity'));
            })
            .join('\n')
            .trim();
        if (descExtra) {
            descParts.push(`\n${descExtra}`);
        }
    }

    // Extra newlines for spacing: more for single-product (signature overlay), small gap for multi-product
    if (numProductsList === 1) {
        descParts.push("\n\n\n\n");
    } else {
        descParts.push("\n\n");
    }
    const extraDescText = descParts.join("\n");

    const tableBody = [];
    const firstRowIndexForProduct = [];
    const freightRowIndices = [];
    let saftaRowIndex = -1;
    const numProducts = productsList.length;

    const getProductTableFonts = (count) => {
        if (count === 1) return { value: 11, label: 9, freight: 10 };
        if (count === 2) return { value: 9, label: 7.5, freight: 8.5 };
        return { value: 8, label: 7, freight: 7.5 };
    };
    const numericFonts = getProductTableFonts(numProducts);
    const qtyRateHalign = 'center';
    const numericCellPadding = numProducts > 1
        ? { top: 1, left: 1, right: 1, bottom: 1 }
        : { top: 1.5, left: 1.5, right: 1.5, bottom: 1.5 };
    const productRowHeight = (count, withFreight) => {
        if (count === 1) return undefined;
        return withFreight ? 18 : 16;
    };

    productsList.forEach((prod, pIdx) => {
        const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
        const isLastProduct = pIdx === numProducts - 1;
        let rowHeight = productRowHeight(numProducts, hasFreight);
        if (rowHeight && prod.hsCodeInd) {
            rowHeight += 3; // Add extra height for the IND HS code line to prevent it touching the bottom border
        }

        firstRowIndexForProduct.push(tableBody.length);

        let requiredNewlines = 1;
        if (prod.hsCodeInd) requiredNewlines += 1;
        if (numProducts === 1) {
            requiredNewlines += 1;
        } else {
            requiredNewlines = prod.hsCodeInd ? 2 : 1;
        }

        let cellText = "\n".repeat(requiredNewlines);
        if (numProducts === 1) {
            cellText += "\n\n" + extraDescText;
        }

        const descCellStyle = {
            halign: 'left',
            fontStyle: 'normal',
            fontSize: numProducts === 1 ? 9 : 10.5,
            cellPadding: { top: 2, left: 2, right: 2, bottom: numProducts === 1 ? 40 : 2 },
            valign: 'top'
        };
        if (rowHeight) descCellStyle.minCellHeight = rowHeight;

        const numericCellStyle = {
            halign: qtyRateHalign,
            fontStyle: 'bold',
            valign: 'top',
            textColor: [255, 255, 255],
            cellPadding: numericCellPadding,
            ...(rowHeight ? { minCellHeight: rowHeight } : {})
        };

        tableBody.push([
            {
                content: cellText,
                rowSpan: 1,
                styles: descCellStyle
            },
            { content: ' ', styles: { ...numericCellStyle, halign: qtyRateHalign } },
            { content: ' ', styles: { ...numericCellStyle, halign: qtyRateHalign } },
            {
                content: ' ',
                styles: {
                    ...numericCellStyle,
                    halign: 'right'
                }
            }
        ]);


    });

    if (numProducts > 1) {
        const descCellStyle = {
            halign: 'left',
            fontStyle: 'normal',
            fontSize: 9,
            cellPadding: { top: 4, left: 2, right: 2, bottom: 6 },
            valign: 'top',
            minCellHeight: 22
        };
        tableBody.push([
            {
                content: extraDescText.trim(),
                rowSpan: 1,
                styles: descCellStyle
            },
            { content: ' ', styles: { valign: 'top' } },
            { content: ' ', styles: { valign: 'top' } },
            { content: ' ', styles: { valign: 'top' } }
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
            const drawNumericText = (text, x, y, fontSize, align) => {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(fontSize);
                doc.setTextColor(0, 0, 0);
                doc.text(text, x, y, { align });
            };

            const drawProductNumericCells = (pIdx, cellX, cellY, cellWidth, colIndex) => {
                const prod = productsList[pIdx];
                const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
                const qtyVal = prod.quantity ? parseFloat(prod.quantity).toLocaleString('en-US') : '0';
                const rateVal = prod.rate ? parseFloat(prod.rate).toFixed(3) : '0.000';
                const amtVal = prod.amount ? parseFloat(prod.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
                const align = colIndex === 3 ? 'right' : 'center';
                const textX = align === 'right' ? cellX + cellWidth - 2 : cellX + cellWidth / 2;
                const { value: valueFS, label: labelFS, freight: freightFS } = numericFonts;

                const primaryY = cellY + 6;
                const labelY = cellY + 10;
                const freightY = cellY + 15;

                if (colIndex === 1) {
                    drawNumericText(qtyVal, textX, primaryY, valueFS, align);
                    if (hasFreight) {
                        drawNumericText('Freight', textX, freightY, labelFS, 'center');
                    }
                    return;
                }

                if (colIndex === 2) {
                    drawNumericText(rateVal, textX, primaryY, valueFS, align);
                    drawNumericText('FOB VALUE', textX, labelY, labelFS, 'center');
                    if (hasFreight) {
                        const freightRateVal = parseFloat(prod.freight).toFixed(3);
                        drawNumericText(freightRateVal, textX, freightY, freightFS, 'center');
                    }
                    return;
                }

                if (colIndex === 3) {
                    drawNumericText(amtVal, textX, primaryY, valueFS, align);
                    if (hasFreight) {
                        const freightAmtVal = prod.totalFreight
                            ? parseFloat(prod.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                            : '0.00';
                        drawNumericText(freightAmtVal, textX, freightY, freightFS, align);
                    }
                }
            };

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

                const numProds = productsList.length;
                let pNameSize = 20, hsCodeFS = 12, nameGap = 7.5;
                if (numProds === 2) {
                    pNameSize = 14; hsCodeFS = 11; nameGap = 6.5;
                } else if (numProds >= 3) {
                    pNameSize = 12; hsCodeFS = 10; nameGap = 5.5;
                }

                // Product Name — large, bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(pNameSize);
                doc.text(pName, centerX, drawY, { align: 'center' });

                // Add underline under product name
                const pWidth = doc.getTextWidth(pName);
                doc.setLineWidth(0.3);
                doc.line(centerX - pWidth / 2, drawY + 3, centerX + pWidth / 2, drawY + 3);
                doc.setLineWidth(0.1);

                drawY += nameGap;

                // HS Code
                doc.setFontSize(hsCodeFS);
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


                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            if (data.section === 'body'
                && [1, 2, 3].includes(data.column.index)
                && firstRowIndexForProduct.includes(data.row.index)) {
                const pIdx = firstRowIndexForProduct.indexOf(data.row.index);
                drawProductNumericCells(
                    pIdx,
                    data.cell.x,
                    data.cell.y,
                    data.cell.width,
                    data.column.index
                );
            }

            // Remove horizontal borders between product row and freight row on right columns
            if (data.section === 'body' && freightRowIndices.includes(data.row.index) && data.column.index > 0) {
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
    y = doc.lastAutoTable.finalY;

    // Description is now drawn inside the table body as a row

    const boxBottom = margin + 10 + (pageHeight - (2 * margin) - 10);
    const amountColX = pageWidth - margin - 25;
    const totalY = y;

    doc.line(margin, totalY, pageWidth - margin, totalY);

    const amountLabel = "Amount Chargeable (In Word's) USD ";
    const wordsVal = numberToWordsUSD(parseFloat(record.grandTotal || 0));
    const wordsWrapWidth = amountColX - margin - 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const labelWidth = doc.getTextWidth(amountLabel);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const valueWidth = doc.getTextWidth(wordsVal);
    const availableForValue = wordsWrapWidth - labelWidth;

    // Compress value via charSpace to always fit on the same line as the label
    const valueCharSpace = valueWidth > availableForValue
        ? (availableForValue - valueWidth) / (wordsVal.length - 1)
        : 0;

    const amountRowHeight = 10;

    // Draw label (normal) then value (bold) on the same line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(amountLabel, margin + 2, totalY + 5);

    doc.setFont("helvetica", "bold");
    doc.text(wordsVal, margin + 2 + labelWidth, totalY + 5, { charSpace: valueCharSpace });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = record.grandTotal ? parseFloat(record.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
    doc.text(totalVal, pageWidth - margin - 2, totalY + (amountRowHeight / 2) + 1, { align: 'right' });

    const declY = totalY + amountRowHeight;
    doc.line(margin, declY, pageWidth - margin, declY);
    doc.line(amountColX, totalY, amountColX, declY);

    const declText = record.declaration || "-We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\nWe do certify that we have no local agent in Bangladesh and the quoted price is net and no commission is payable.";
    const declTextWidth = amountColX - margin - 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DECLARATION:", margin + 2, declY + 5);
    doc.setFont("helvetica", "normal");
    const declLines = doc.splitTextToSize(declText, declTextWidth);
    const declLineH = 4;
    declLines.forEach((line, idx) => {
        doc.text(line, margin + 2, declY + 10 + (idx * declLineH));
    });
    const declBlockBottom = declY + 10 + (declLines.length * declLineH);

    const sigImageWidth = 50;
    const sigImageX = pageWidth - margin - sigImageWidth - 5;

    const sigLineY = Math.max(declBlockBottom + 18, (declY + 4) + 36);
    const sigTop = sigLineY - 18 - 1; // Sits 1mm above the signature line

    if (record.exporterSignature) {
        try {
            doc.addImage(record.exporterSignature, 'PNG', sigImageX, sigTop, sigImageWidth, 18);
        } catch (e) {
            console.error('Error adding exporter signature to PDF:', e);
        }
    }

    doc.line(sigImageX, sigLineY, sigImageX + sigImageWidth, sigLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Signature.", sigImageX + (sigImageWidth / 2), sigLineY + 4, { align: 'center' });

    doc.line(margin, boxBottom, pageWidth - margin, boxBottom);

    // Open in new tab
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
