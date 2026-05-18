import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const numberToWordsUSD = (amount) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Million', 'Billion'];
    const convertChunk = (num) => {
        let s = '';
        if (num >= 100) { s += units[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
        if (num >= 10 && num <= 19) { s += teens[num - 10] + ' '; }
        else { if (num >= 20) { s += tens[Math.floor(num / 10)] + ' '; num %= 10; } if (num > 0) { s += units[num] + ' '; } }
        return s;
    };
    if (amount === 0) return 'Zero Dollars Only';
    const parts = amount.toFixed(2).split('.');
    let dollars = parseInt(parts[0]), cents = parseInt(parts[1]);
    let words = '', scaleIndex = 0;
    if (dollars === 0) { words = 'Zero '; } else {
        let dw = '';
        while (dollars > 0) { let chunk = dollars % 1000; if (chunk > 0) { dw = convertChunk(chunk) + (scales[scaleIndex] ? scales[scaleIndex] + ' ' : '') + dw; } dollars = Math.floor(dollars / 1000); scaleIndex++; }
        words = dw;
    }
    words += cents > 0 ? 'And Cents ' + convertChunk(cents) + 'Only' : 'Only';
    return words.replace(/\s+/g, ' ').trim();
};

export const generatePI2PDF = (record) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (2 * margin);

    doc.setFont("helvetica", "normal");

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

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
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
    doc.setFontSize(12);
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
    doc.setFontSize(8.5);
    doc.text("Buyer's Order No/Proforma Invoice No.& Date", midX + 2, y + 5.5);
    
    doc.setFontSize(10);
    doc.text(record.piNumber || '', midX + 2, y + 11);

    const dateVal = formatDate(record.date) || '';
    doc.setFontSize(8.5);
    doc.text("DATE-" + dateVal, midX + rightColWidth - 2, y + 11, { align: 'right' });

    doc.line(midX, y + 13, pageWidth - margin, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Other References", midX + 2, y + 16.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.otherReferences || '', midX + 2, y + 21);

    doc.line(midX, y + 24, pageWidth - margin, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Buyer (if other than consignee)", midX + 2, y + 27.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const buyerLines = doc.splitTextToSize(record.buyerName || '', rightColWidth - 5);
    doc.text(buyerLines, midX + 2, y + 30.5);

    // Row 2: Importer vs Country/Terms
    y += row1Height;
    let row2Height = 61;
    doc.rect(margin, y, leftColWidth, row2Height);
    doc.rect(midX, y, rightColWidth, row2Height);

    // Importer
    doc.setFontSize(12);
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
    let cInfo = "";
    if (record.partyContact) cInfo += `Phone: ${record.partyContact}`;
    if (record.partyEmail) cInfo += (cInfo ? " | " : "") + `Email: ${record.partyEmail}`;
    if (cInfo) impInfo += `\n${cInfo}`;
    doc.text(doc.splitTextToSize(impInfo.trim(), leftColWidth - 10), margin + leftColWidth / 2, y + 17, { align: 'center', lineHeightFactor: .85 });

    // Shipping rows (left)
    doc.line(margin, y + 31, margin + leftColWidth, y + 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("Pre-Carriage by", margin + leftColWidth / 4, y + 34.5, { align: 'center' });
    doc.text("Place of Receipt by Pre-Carrier", margin + (3 * leftColWidth / 4), y + 34.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.preCarriageBy || '', margin + leftColWidth / 4, y + 39, { align: 'center' });
    doc.text(record.placeOfReceiptByPreCarrier || '', margin + (3 * leftColWidth / 4), y + 39, { align: 'center' });

    doc.line(margin, y + 41, margin + leftColWidth, y + 41);
    doc.setFontSize(7.5);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 44.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 44.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.vesselFlightNo || '', margin + leftColWidth / 4, y + 49, { align: 'center' });
    doc.text(record.portOfLoading || 'ANY PLACE OF INDIA', margin + (3 * leftColWidth / 4), y + 49, { align: 'center' });

    doc.line(margin, y + 51, margin + leftColWidth, y + 51);
    doc.setFontSize(7.5);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 54.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 54.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(record.portOfDischarge || record.port || 'HILI', margin + leftColWidth / 4, y + 59, { align: 'center' });
    doc.text(record.finalDestination || 'BANGLADESH', margin + (3 * leftColWidth / 4), y + 59, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 31, margin + (leftColWidth / 2), y + 61);

    // Right: Country of Origin / Final Destination
    const subW = rightColWidth / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Country of Origin", midX + 2, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.countryOrigin || 'INDIA', midX + 2, y + 10);

    doc.line(midX + subW, y, midX + subW, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Country of Final Destination", midX + subW + 2, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.countryFinalDest || 'BANGLADESH', midX + subW + 2, y + 10);

    doc.line(midX, y + 14, pageWidth - margin, y + 14);

    // Terms of Delivery and Payment
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Terms of Delivery and Payment", midX + 2, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const termsLines = doc.splitTextToSize(record.termsDeliveryPayment || '', rightColWidth - 5);
    doc.text(termsLines, midX + 2, y + 23);

    y += row2Height;

    // --- Table Section (4-column: Description | Quantity | Rate | Amount) ---
    const productName = (record.productName || '').toUpperCase();
    const hsCodeLine = `H.S. CODE NO.${record.hsCode || ''}`;
    const hasFreight = record.freight && record.freight > 0;

    // Build description content for below the product header area
    const descParts = [];
    descParts.push(`COUNTRY OF ORIGIN ${(record.countryOrigin || 'INDIA').toUpperCase()}`);
    descParts.push("EXPORT STANDARD PACKING");
    descParts.push(`ADVISING BANK: ${record.indianBank || ''}`);
    descParts.push(`VALIDITY OF PROFORMA INVOICE DATE:${formatDate(record.validityDate)}`);
    descParts.push("\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n");
    const descContent = descParts.join("\n");

    const tableBody = [];
    tableBody.push([
        {
            content: descContent,
            rowSpan: hasFreight ? 2 : 1,
            styles: { halign: 'left', fontStyle: 'normal', cellPadding: { top: 30, left: 2, right: 2, bottom: 2 } }
        },
        { content: record.quantity ? parseFloat(record.quantity).toLocaleString('en-US') : '0', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle' } },
        { content: record.rate ? parseFloat(record.rate).toFixed(3) : '0.000', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle' } },
        { content: record.amount ? parseFloat(record.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle' } }
    ]);

    if (hasFreight) {
        tableBody.push([
            { content: 'Freight', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 8, bottom: 8 } } },
            { content: parseFloat(record.freight).toFixed(3), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle' } },
            { content: record.totalFreight ? parseFloat(record.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle' } }
        ]);
    }

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.1,
        styles: {
            fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1,
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
                { content: 'Rate\nUSD\nPer KG.\nFOB VALUE', styles: { fillColor: [235, 235, 235] } },
                { content: 'Amount\nUSD', styles: { fillColor: [235, 235, 235] } }
            ]
        ],
        body: tableBody,
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 25, halign: 'right' },
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0 && data.row.index === 0) {
                // Erase top border so it merges with the empty header box
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5);
                doc.line(data.cell.x + 0.5, data.cell.y, data.cell.x + data.cell.width - 0.5, data.cell.y);
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.1);

                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const centerX = cellX + cellWidth / 2;
                let drawY = cellY + 6;

                // Product Name — large, bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.text(productName, centerX, drawY, { align: 'center' });
                drawY += 7;

                // HS Code
                doc.setFontSize(10);
                doc.text(hsCodeLine, centerX, drawY, { align: 'center' });
                drawY += 8;

                // VALUE & QUANTITY line
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text("VALUE & QUANTITY \u00B1 10% ACCEPTABLE.", cellX + 2, drawY);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            // Remove horizontal borders between product row and freight row on right columns
            if (data.section === 'body' && data.row.index === 1 && data.column.index >= 1) {
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
    doc.setFontSize(8.5);
    doc.text("Amount Chargeable (In Word's) USD ", margin + 2, totalY + 6.5);
    doc.setFont("helvetica", "bold");
    const wordsVal = numberToWordsUSD(parseFloat(record.grandTotal || 0));
    doc.text(wordsVal, margin + 55, totalY + 6.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = record.grandTotal ? parseFloat(record.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00';
    doc.text(totalVal, pageWidth - margin - 2, totalY + 6.5, { align: 'right' });

    doc.line(margin, totalY + 9, pageWidth - margin, totalY + 9);
    y = totalY + 9;

    // --- Declaration + Signature (side by side) ---
    const declY = y;
    const declWidth = contentWidth * 0.6;
    const sigWidth = contentWidth - declWidth;

    // Declaration (Left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DICLATION:", margin + 2, declY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const declText = "-We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.\nWe do certify that we have no local agent in Bangladesh and the quoted price is net and no commission is payable.";
    const declLines = doc.splitTextToSize(declText, declWidth - 5);
    doc.text(declLines, margin + 2, declY + 10);

    // Signature (Right)
    const sigX = margin + declWidth;

    // Exporter signature
    if (record.exporterSignature) {
        try {
            doc.addImage(record.exporterSignature, 'PNG', sigX + 5, declY + 14, 50, 15);
        } catch (e) {
            console.error('Error adding exporter signature to PDF:', e);
        }
    }

    doc.line(sigX + 5, declY + 32, sigX + sigWidth - 5, declY + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Signature.", sigX + (sigWidth / 2), declY + 37, { align: 'center' });

    // Open in new tab
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
