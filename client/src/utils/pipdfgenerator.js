import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to convert number to words for USD
const numberToWordsUSD = (amount) => {
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Million', 'Billion'];

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

    if (amount === 0) return 'Zero Dollars Only';

    const parts = amount.toFixed(2).split('.');
    let dollars = parseInt(parts[0]);
    let cents = parseInt(parts[1]);

    let words = '';
    let scaleIndex = 0;

    if (dollars === 0) {
        words = 'Zero ';
    } else {
        let dollarWords = '';
        while (dollars > 0) {
            let chunk = dollars % 1000;
            if (chunk > 0) {
                dollarWords = convertChunk(chunk) + (scales[scaleIndex] ? scales[scaleIndex] + ' ' : '') + dollarWords;
            }
            dollars = Math.floor(dollars / 1000);
            scaleIndex++;
        }
        words = dollarWords;
    }

    if (cents > 0) {
        words += 'And Cents ' + convertChunk(cents) + 'Only';
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
    let row2Height = 55; // Reverted to 55 and compacted
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
    let contactInfo = "";
    if (record.partyContact) contactInfo += `Phone: ${record.partyContact}`;
    if (record.partyEmail) contactInfo += (contactInfo ? " | " : "") + `Email: ${record.partyEmail}`;
    if (contactInfo) importerInfo += `\n${contactInfo}`;
    importerInfo = importerInfo.trim();

    const partyLines = doc.splitTextToSize(importerInfo, leftColWidth - 10);
    doc.text(partyLines, margin + leftColWidth / 2, y + 17, { align: 'center', lineHeightFactor: .85 });

    // Shipping Section 1 (Compact)
    doc.line(margin, y + 27, margin + leftColWidth, y + 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Pre-Carriage by", margin + leftColWidth / 4, y + 30.5, { align: 'center' });
    doc.text("Place of Receipt by Pre-Carrier", margin + (3 * leftColWidth / 4), y + 30.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.preCarriageBy || '', margin + leftColWidth / 4, y + 35, { align: 'center' });
    doc.text(record.placeOfReceiptByPreCarrier || '', margin + (3 * leftColWidth / 4), y + 35, { align: 'center' });

    // Shipping Section 2 (Compact)
    doc.line(margin, y + 36, margin + leftColWidth, y + 36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 39.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 39.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.vesselFlightNo || '', margin + leftColWidth / 4, y + 44, { align: 'center' });
    doc.text(record.portLoading || 'ANY PLACE OF INDIA', margin + (3 * leftColWidth / 4), y + 44, { align: 'center' });

    // Shipping Section 3 (Compact)
    doc.line(margin, y + 45, margin + leftColWidth, y + 45);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 48.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 48.5, { align: 'center' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.portDischarge || 'HILI', margin + leftColWidth / 4, y + 53, { align: 'center' });
    doc.text(record.finalDestination || 'BANGLADESH', margin + (3 * leftColWidth / 4), y + 53, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 27, margin + (leftColWidth / 2), y + 55);

    // Right Column Row 2 (Top Half): Buyer & Country Side-by-Side
    const subColWidthVal = rightColWidth / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Buyer (if other than Consignee)", midX + 2, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const buyerLinesVal = doc.splitTextToSize(record.buyerName || '', subColWidthVal - 5);
    doc.text(buyerLinesVal, midX + 2, y + 11);

    doc.line(midX + subColWidthVal, y, midX + subColWidthVal, y + 25); // Vertical divider for Buyer/Country

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Country of Origin", midX + subColWidthVal + 2, y + 5);
    doc.text("Final Destination", midX + subColWidthVal + 2, y + 15); // Adjust spacing

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.countryOrigin || 'INDIA', midX + subColWidthVal + 2, y + 10);
    doc.text(record.countryFinalDest || 'BANGLADESH', midX + subColWidthVal + 2, y + 20);

    doc.line(midX, y + 27, pageWidth - margin, y + 27);

    // Terms of Delivery and Payment (Compact)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Terms of Delivery and Payment", midX + 2, y + 31);
    doc.setFontSize(9);
    const termsRefLinesInRow2 = doc.splitTextToSize(record.termsDeliveryPayment || '', rightColWidth - 5);
    doc.text(termsRefLinesInRow2, midX + 2, y + 37);

    y += row2Height;

    // --- Table Section ---

    const tableBody = [];
    const countryOriginLine = `COUNTRY OF ORIGIN OF GOODS: ${(record.countryOrigin || 'INDIA').toUpperCase()}`;
    const productName = (record.productName || '').toUpperCase();
    const hsCodeLine = `H.S. CODE NO.${record.hsCode || ''}`;
    const valueLine = "VALUE & QUANTITY ± 10% ACCEPTABLE.";

    // The top part (origin, product, hs code, value) will be drawn manually
    // We reserve space with empty lines and draw the rest normally

    // Default description template (used when descriptionGoods field is empty)
    const defaultDescLines = [
        `ADVISING BANK MUST BE THROUGH: ${record.indianBank || ''}`,
        "Insurance to be covered by the opener.",
        "Partial Bill & Partial Payment be allowed.",
        "Negotiation any Bank in India.",
        "All Foreign Bank Charges outside Bangladesh are on account of Beneficiary.",
        "",
        "TRANSHIPMENT: ALLOWED",
        "PARTIAL SHIPMENT: ALLOWED"
    ].join("\n");

    // Always prepend the Advising Bank line, then use descriptionGoods (or defaults)
    const bankLine = `ADVISING BANK MUST BE THROUGH: ${record.indianBank || ''}`;
    const extraDescText = bankLine + "\n" + (record.descriptionGoods || defaultDescLines);

    const descContent = extraDescText;

    const hasFreight = record.freight && record.freight > 0;

    tableBody.push([
        {
            content: descContent,
            colSpan: 3,
            rowSpan: hasFreight ? 2 : 1,
            styles: { halign: 'left', fontStyle: 'normal', cellPadding: { top: 28, left: 1.5, right: 1.5, bottom: 1.5 } }
        },
        { content: record.quantity ? parseFloat(record.quantity).toLocaleString() : '0', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: record.rate ? parseFloat(record.rate).toFixed(3) : '0.000', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: record.amount ? parseFloat(record.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold' } }
    ]);

    if (hasFreight) {
        tableBody.push([
            { content: 'Freight', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 10, bottom: 10, left: 1.5, right: 1.5 } } },
            { content: parseFloat(record.freight).toFixed(3), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 10, bottom: 10, left: 1.5, right: 1.5 } } },
            { content: record.totalFreight ? parseFloat(record.totalFreight).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 10, bottom: 10, left: 1.5, right: 1.5 } } }
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
            if (data.section === 'body' && data.column.index === 0 && data.row.index === 0) {
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const centerX = cellX + cellWidth / 2;
                let drawY = cellY + 4;

                // 1. "COUNTRY OF ORIGIN OF GOODS: INDIA" — bold, 9pt, centered, underlined
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text(countryOriginLine, centerX, drawY, { align: 'center' });
                // Underline
                const originTextWidth = doc.getTextWidth(countryOriginLine);
                doc.setLineWidth(0.2);
                doc.line(centerX - originTextWidth / 2, drawY + 0.8, centerX + originTextWidth / 2, drawY + 0.8);
                drawY += 8; // gap before product name

                // 2. Product Name — very large, bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.text(productName, centerX, drawY, { align: 'center' });
                drawY += 8;

                // 3. HS Code — medium bold, centered
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text(hsCodeLine, centerX, drawY, { align: 'center' });
                drawY += 6;

                // 4. VALUE line — normal, centered
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.text(valueLine, centerX, drawY, { align: 'center' });

                // Reset
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            // Remove middle horizontal line between Product and Freight row
            if (data.section === 'body' && data.row.index === 1 && data.column.index >= 3) {
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.2); // Match table line width
                // Draw white line over the top border, slightly inset to keep vertical lines intact
                doc.line(data.cell.x + 0.1, data.cell.y, data.cell.x + data.cell.width - 0.1, data.cell.y);
                doc.setDrawColor(0, 0, 0); // Reset to black
            }
        },
        didDrawPage: (data) => {
            y = data.cursor.y;
        }
    });

    // Total Row & Amount in Words (Same row)
    const totalY = y;
    doc.line(margin, totalY, pageWidth - margin, totalY);

    // 1. Draw Amount in word on the LEFT
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Amount Chargeable in words: US Dollar: ", margin + 2, totalY + 6.5);
    doc.setFont("helvetica", "bold");
    const wordsVal = numberToWordsUSD(parseFloat(record.grandTotal || 0));
    doc.text(wordsVal, margin + 58, totalY + 6.5);

    // 2. Draw TOTAL on the RIGHT
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = record.grandTotal ? `$ ${parseFloat(record.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$ 0.00';
    doc.text(`TOTAL:-  ${totalVal}`, pageWidth - margin - 2, totalY + 6.5, { align: 'right' });

    doc.line(margin, totalY + 9, pageWidth - margin, totalY + 9);
    y = totalY + 9;

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
    y += 25;
    doc.setFontSize(8.5); // Increased
    doc.text("For,", margin + 2, y + 5);

    // Render Signatures if available
    if (record.exporterSignature) {
        try {
            // Width 60, Height 20, positioned to match the 60mm line
            doc.addImage(record.exporterSignature, 'PNG', margin + 5, y + 9, 60, 20);
        } catch (e) {
            console.error('Error adding exporter signature to PDF:', e);
        }
    }

    if (record.partySignature) {
        try {
            // Width 60, Height 20, positioned to match the 60mm line
            doc.addImage(record.partySignature, 'PNG', pageWidth - margin - 65, y + 14, 60, 12);
        } catch (e) {
            console.error('Error adding importer signature to PDF:', e);
        }
    }

    // Seller line
    doc.line(margin + 5, y + 30, margin + 65, y + 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5); // Increased
    doc.text("Signature", margin + 30, y + 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11); // Increased
    doc.text("Seller", margin + 31, y + 43);

    // Buyer line
    doc.line(pageWidth - margin - 65, y + 30, pageWidth - margin - 5, y + 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5); // Increased
    doc.text("Signature", pageWidth - margin - 40, y + 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11); // Increased
    doc.text("Buyer", pageWidth - margin - 40, y + 43);

    // Opening in new tab instead of direct download
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
