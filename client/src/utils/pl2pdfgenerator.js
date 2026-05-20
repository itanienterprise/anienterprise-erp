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
        // BDT uses: Crore (1,00,00,000), Lakh (1,00,000), Thousand (1,000)
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

export const generatePL2PDF = (record, piRecords = [], lcRecords = [], importers = [], exporters = [], banks = []) => {
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

    // Resolve details using database records if missing
    const pi = piRecords.find(p => p.piNumber === record.piNumber);
    const lc = lcRecords.find(l => l.lcNo === (record.lcNumber || pi?.lcNumber));
    const importer = importers.find(imp => (imp.name || '').toLowerCase().trim() === (record.partyName || '').toLowerCase().trim());
    console.log('PL2 importer lookup:', record.partyName, '-> found:', !!importer, 'irc:', importer?.irc);

    const bankName = record.bankName || lc?.bankName || '';
    let branchName = record.branchName || '';
    if (!branchName && bankName && banks.length > 0) {
        const matchedBank = banks.find(b => b.bankName.toLowerCase().trim() === bankName.toLowerCase().trim());
        if (matchedBank && matchedBank.branches && matchedBank.branches.length > 0) {
            branchName = matchedBank.branches[0].branch;
        }
    }
    const lcAmendment = record.lcAmendment || '';
    const termsDeliveryPayment = record.termsDeliveryPayment || pi?.termsDeliveryPayment || '';
    const countryOrigin = record.countryOrigin || pi?.countryOrigin || 'INDIA';
    const countryFinalDest = record.countryFinalDest || pi?.countryFinalDest || 'BANGLADESH';
    const descriptionGoods = record.descriptionGoods || pi?.descriptionGoods || '';
    const buyerName = record.buyerName || pi?.buyerName || '';
    const otherReferences = record.otherReferences || pi?.otherReferences || '';
    const certification = record.certification || pi?.certification || '';

    const drawDescriptionBlock = (x, startY, fSize) => {
        const irc = importer?.irc || '';
        const coverNote = lc?.marineCoverNote || '';
        const cnDate = lc?.marineCNDate ? formatDate(lc.marineCNDate) : '';
        const insuranceCo = lc?.insuranceCo || 'CONTINENTAL INSURANCE LIMITED';
        const amnd = record.lcAmendment ? ` & ${record.lcAmendment}` : '';
        const piNo = pi?.piNumber || '';
        const piDate = pi?.date ? formatDate(pi.date) : '';
        const tin = importer?.tin || '';
        const bin = importer?.bin || '';
        const bankBin = '000321414-0101';
        
        doc.setFontSize(fSize);
        let curY = startY;
        const lineSpacing = fSize * 0.46;

        const drawLine = (parts) => {
            let curX = x;
            parts.forEach(p => {
                doc.setFont("helvetica", p.bold ? "bold" : "normal");
                doc.text(p.text, curX, curY);
                curX += doc.getTextWidth(p.text);
            });
            curY += lineSpacing;
        };

        drawLine([
            { text: "IMPORTED AGAINST " },
            { text: "IRC NO-", bold: true },
            { text: irc, bold: true }
        ]);

        drawLine([
            { text: "UNDER INSURANCE COVER NOTE NO: ", bold: true },
            { text: coverNote, bold: true },
            { text: ", DATED.", bold: true },
            { text: cnDate + amnd, bold: true }
        ]);
        drawLine([
            { text: "OF " },
            { text: insuranceCo, bold: true },
            { text: "," }
        ]);

        drawLine([
            { text: "BOGURA BRANCH, BOGURA, BANGLADESH." }
        ]);

        drawLine([{ text: "WE CERTIFY THAT THE COUNTRY OF ORIGIN IS MARKED IN ALL THE" }]);
        drawLine([{ text: "PACKETS/BAGS. WE DO THAT THE GOODS ARE SHIPED STRICTLY IN" }]);
        drawLine([{ text: "ACCORDANCE WITH THE SPECIFICATION HERE BY CERTIFY QUANTITY AND" }]);

        drawLine([
            { text: "PRICE AS PER PROFORMA INVOICE:", bold: true }
        ]);
        drawLine([
            { text: piNo, bold: true },
            { text: " Date:", bold: true },
            { text: piDate, bold: true }
        ]);

        if (record.trNumber) {
            drawLine([
                { text: "UNDER TR NO.", bold: true },
                { text: record.trNumber, bold: true }
            ]);
        }

        drawLine([
            { text: "IMPORTERS TIN NO.", bold: true },
            { text: tin, bold: true },
            { text: ", & " },
            { text: "BIN-", bold: true },
            { text: bin, bold: true }
        ]);

        drawLine([
            { text: "BANK BIN-", bold: true },
            { text: bankBin, bold: true }
        ]);

        drawLine([{ text: "Export Standard packing" }]);

        drawLine([
            { text: "COUNTRY OF ORIGIN ", bold: true },
            { text: countryOrigin.toUpperCase(), bold: true }
        ]);
    };

    const preCarriageBy = record.preCarriageBy && record.preCarriageBy !== 'ROAD' ? record.preCarriageBy : (pi?.preCarriageBy || record.preCarriageBy || 'ROAD');
    const placeOfReceipt = record.placeOfReceipt && record.placeOfReceipt !== 'BY ROAD' ? record.placeOfReceipt : (pi?.placeOfReceipt || pi?.placeOfReceiptByPreCarrier || record.placeOfReceipt || 'BY ROAD');
    const vesselFlightNo = record.vesselFlightNo && record.vesselFlightNo !== 'BY TRUCK' ? record.vesselFlightNo : (pi?.vesselFlightNo || record.vesselFlightNo || 'BY TRUCK');
    const portOfLoading = record.portOfLoading || pi?.portOfLoading || 'ANY PLACE OF INDIA';
    const portOfDischarge = record.portOfDischarge || pi?.portOfDischarge || '';
    const finalDestination = record.finalDestination && record.finalDestination !== 'BANGLADESH' ? record.finalDestination : (pi?.finalDestination || record.finalDestination || 'BANGLADESH');

    const productsList = (record.productsList && record.productsList.length > 0 ? record.productsList : []).map(prod => {
        const piProd = pi?.productsList?.find(p => p.productName?.toLowerCase() === prod.productName?.toLowerCase());
        return {
            ...prod,
            rate: prod.rate || piProd?.rate || '',
            amount: prod.amount || piProd?.amount || '',
            freight: prod.freight || piProd?.freight || '',
            totalFreight: prod.totalFreight || piProd?.totalFreight || ''
        };
    });

    // Main Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(margin, margin + 10, contentWidth, pageHeight - (2 * margin) - 10);

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE-CUM PACKING LIST", pageWidth / 2, margin + 7, { align: 'center' });

    // --- Grid Layout ---
    const leftColWidth = contentWidth * 0.55;
    const rightColWidth = contentWidth - leftColWidth;
    const midX = margin + leftColWidth;

    // Row 1: Exporter vs PI Info
    let y = margin + 10;
    let row1Height = 32;
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

    // Right: Invoice Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Invoice No.& Date", midX + 2, y + 5.5);

    doc.setFontSize(10);
    doc.text(record.packingListNumber || '', midX + 2, y + 11);

    const dateVal = formatDate(record.date) || '';
    doc.setFontSize(8.5);
    doc.text("DATE-" + dateVal, midX + rightColWidth - 2, y + 11, { align: 'right' });

    doc.line(midX, y + 13, pageWidth - margin, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Buyer's Order No /Proforma Invoice No.& Date", midX + 2, y + 16.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.piNumber || '', midX + 2, y + 21);

    const piDateVal = formatDate(record.piDate || pi?.date) || '';
    doc.setFontSize(8.5);
    doc.text("DATE-" + piDateVal, midX + rightColWidth - 2, y + 21, { align: 'right' });

    doc.line(midX, y + 24, pageWidth - margin, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Seller (if other than consigner)", midX + 2, y + 27.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const buyerLines = doc.splitTextToSize(buyerName || '', rightColWidth - 5);
    doc.text(buyerLines, midX + 2, y + 30.5);

    // Row 2: Importer vs Country/Terms/LC Box
    y += row1Height;
    const showSafta = certification && certification.toLowerCase().includes('safta');

    doc.setFontSize(9);
    let cleanTerms = termsDeliveryPayment || '';
    const againstIndex = cleanTerms.toUpperCase().indexOf('AGAINST');
    if (againstIndex !== -1) {
        cleanTerms = cleanTerms.substring(0, againstIndex + 7).trim();
    }
    const termsLines = doc.splitTextToSize(cleanTerms, rightColWidth - 5);
    const termsHeight = termsLines.length * 4;
    let row2Height = Math.max(61, 24 + termsHeight);
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
    doc.text(preCarriageBy, margin + leftColWidth / 4, y + 39, { align: 'center' });
    doc.text(placeOfReceipt, margin + (3 * leftColWidth / 4), y + 39, { align: 'center' });

    doc.line(margin, y + 41, margin + leftColWidth, y + 41);
    doc.setFontSize(8.5);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 44.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 44.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(vesselFlightNo, margin + leftColWidth / 4, y + 49, { align: 'center' });
    doc.text(portOfLoading, margin + (3 * leftColWidth / 4), y + 49, { align: 'center' });

    doc.line(margin, y + 51, margin + leftColWidth, y + 51);
    doc.setFontSize(8.5);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 54.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 54.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(portOfDischarge, margin + leftColWidth / 4, y + 59, { align: 'center' });
    doc.text(finalDestination, margin + (3 * leftColWidth / 4), y + 59, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 31, margin + (leftColWidth / 2), y + row2Height);

    // Right: Country of Origin / Final Destination
    const subW = rightColWidth / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Country of Origin", midX + 2, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(countryOrigin, midX + 2, y + 7);

    doc.line(midX + subW, y, midX + subW, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Country of Final Destination", midX + subW + 2, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(countryFinalDest, midX + subW + 2, y + 7);

    doc.line(midX, y + 10, pageWidth - margin, y + 10);

    // Terms of Delivery and Payment
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("Terms of Delivery and payment:", midX + 2, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(termsLines, midX + 2, y + 20);

    // End of Terms box

    // End of Terms box

    // LC Box starting dynamically below the terms text
    let lcNo = record.lcNumber || lc?.lcNo || '';
    if (lcNo) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        let lcY = y + 20 + (termsLines.length * 4.5);
        doc.text(`LC NO: ${lcNo}   DATE:${formatDate(record.lcDate || lc?.openingDate)}`, midX + 2, lcY);

        if (lcAmendment) {
            lcY += 4.5;
            doc.text(lcAmendment, midX + 2, lcY);
        }

        if (bankName) {
            lcY += 4.5;
            let bankText = `OF ${bankName}`;
            if (branchName) {
                bankText += `,\n${branchName}`;
            }
            const bankLines = doc.splitTextToSize(bankText, rightColWidth - 5);
            doc.text(bankLines, midX + 2, lcY);
        }
    }

    y += row2Height;

    // --- Table Section (4-column) ---
    const descParts = [];

    if (descriptionGoods) {
        descParts.push(descriptionGoods);
    } else {
        const irc = importer?.irc || '';
        const coverNote = lc?.marineCoverNote || '';
        const cnDate = lc?.marineCNDate ? formatDate(lc.marineCNDate) : '';
        const insuranceCo = lc?.insuranceCo || 'CONTINENTAL INSURANCE LIMITED';
        const amnd = record.lcAmendment ? ` & ${record.lcAmendment}` : '';
        const piNo = pi?.piNumber || '';
        const piDate = pi?.date ? formatDate(pi.date) : '';
        const tin = importer?.tin || '';
        const bin = importer?.bin || '';
        const bankBin = '000321414-0101'; // Default fallback

        descParts.push(`IMPORTEDAGAINEST IRC NO-${irc}`);
        descParts.push(`UNDER INSURANCE COVER NOTE NO: UNDER INSURANCE COVER NOTE NO:\n${coverNote}, DATED.${cnDate}${amnd} OF ${insuranceCo},\nBOGURA BRANCH, BOGURA, BANGLADESH.\n`);
        descParts.push(`WE CERTIFY THAT THE COUNTRY OF ORIGIN IS MARKED IN ALL THE\nPACKETS/BAGS. WE DO THAT THE GOODS ARE SHIPED STRICTLY IN\nACCORDANCE WITH THE SPECIFICATION HERE BY CERTIFY QUANTITY AND\nPRICE AS PER PROFORMA INVOICE:\n${piNo} Date:${piDate}`);
        const trStr = record.trNumber ? `UNDER TR NO.${record.trNumber}\n` : '';
        if (trStr) descParts.push(trStr);
        descParts.push(`IMPORTERS TIN NO.${tin}, & BIN-${bin}`);
        descParts.push(`BANK BIN-${bankBin}\n`);
        descParts.push(`Export Standard packing`);
        descParts.push(`COUNTRY OF ORIGIN ${countryOrigin.toUpperCase()}`);
    }

    // Remove excessive newlines to prevent page break
    // descParts.push("\n\n\n\n\n\n\n\n\n\n"); 
    const extraDescText = descParts.join("\n");

    const tableBody = [];
    const firstRowIndexForProduct = [];
    const freightRowIndices = [];

    productsList.forEach((prod, pIdx) => {
        const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
        const numProducts = productsList.length;

        firstRowIndexForProduct.push(tableBody.length);

        let requiredNewlines = 1;
        if (numProducts === 1) requiredNewlines += 2;

        let cellText = "\n".repeat(requiredNewlines);
        if (numProducts === 1) {
            const lineCount = extraDescText.split("\n").length;
            cellText += "\n\n" + "\n".repeat(lineCount);
        }

        tableBody.push([
            {
                content: cellText,
                rowSpan: hasFreight ? 2 : 1,
                styles: {
                    halign: 'left',
                    fontSize: numProducts === 1 ? 7.5 : 9,
                    cellPadding: { top: 2, left: 2, right: 2, bottom: numProducts === 1 ? 50 : 2 }
                }
            },
            { content: prod.quantity ? `${parseFloat(prod.quantity).toLocaleString('en-US')}\n ` : '0\n ', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } },
            { content: prod.rate ? `${parseFloat(prod.rate).toFixed(3)}\nFOB VALUE` : '0.000\nFOB VALUE', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', textColor: [255, 255, 255] } },
            { content: prod.amount ? `${parseFloat(prod.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n ` : '0.00\n ', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } }
        ]);

        if (hasFreight) {
            freightRowIndices.push(tableBody.length);
            tableBody.push([
                { content: 'Freight', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', cellPadding: { top: 4, bottom: 4 }, fontSize: 11 } },
                { content: parseFloat(prod.freight).toFixed(3), styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } },
                { content: prod.totalFreight ? parseFloat(prod.totalFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00', styles: { halign: 'center', fontStyle: 'bold', valign: 'middle', fontSize: 11 } }
            ]);
        }
    });

    if (productsList.length > 1) {
        const lineCount = extraDescText.split("\n").length;
        tableBody.push([
            {
                content: "\n".repeat(lineCount),
                colSpan: 1,
                styles: { halign: 'left', fontStyle: 'normal', fontSize: 9.5, cellPadding: { top: 2, left: 2, right: 2, bottom: 2 } }
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
                { content: '', styles: { fillColor: [255, 255, 255] } },
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

                doc.setFont("helvetica", "bold");
                const isMulti = productsList.length > 1;
                doc.setFontSize(isMulti ? 15 : 20);
                doc.text(pName, centerX, drawY, { align: 'center' });

                const pWidth = doc.getTextWidth(pName);
                doc.setLineWidth(0.3);
                doc.line(centerX - pWidth / 2, drawY + 1.5, centerX + pWidth / 2, drawY + 1.5);
                doc.setLineWidth(0.1);

                drawY += 7.5;

                doc.setFontSize(12);
                if (prod.hsCodeInd || pi?.productsList?.[pIdx]?.hsCodeInd) {
                    const bdHsLine = `H.S. CODE NO.${prod.hsCode || ''} (BD)`;
                    const indHsLine = `H.S. CODE NO.${prod.hsCodeInd || pi.productsList[pIdx].hsCodeInd} (IND)`;
                    doc.text(bdHsLine, centerX, drawY, { align: 'center' });
                    drawY += 5;
                    doc.text(indHsLine, centerX, drawY, { align: 'center' });
                } else {
                    const hsCodeLine = `H.S. CODE NO.${prod.hsCode || ''}`;
                    doc.text(hsCodeLine, centerX, drawY, { align: 'center' });
                }

                if (productsList.length === 1) {
                    let descY = drawY + 8;
                    const descFontSize = 7.5;
                    
                    if (descriptionGoods) {
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(descFontSize);
                        const lines = doc.splitTextToSize(descriptionGoods, cellWidth - 5);
                        doc.text(lines, cellX + 3, descY);
                    } else {
                        drawDescriptionBlock(cellX + 3, descY, descFontSize);
                    }
                }

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            if (data.section === 'body' && data.column.index === 0 && data.row.index === tableBody.length - 1 && productsList.length > 1) {
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                const descFontSize = 9.5;
                let descY = cellY + 5;
                
                if (descriptionGoods) {
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(descFontSize);
                    const lines = doc.splitTextToSize(descriptionGoods, cellWidth - 5);
                    doc.text(lines, cellX + 3, descY);
                } else {
                    drawDescriptionBlock(cellX + 3, descY, descFontSize);
                }
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

                doc.setFontSize(11);
                doc.text(prod.rate ? parseFloat(prod.rate).toFixed(3) : '0.000', centerX, cellY + (cellHeight / 2) - 1, { align: 'center' });

                doc.setFontSize(9);
                doc.text("FOB VALUE", centerX, cellY + (cellHeight / 2) + 3.5, { align: 'center' });
            }

            if (data.section === 'body' && freightRowIndices.includes(data.row.index)) {
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5);
                doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);

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

    // Total Row
    let grandTotal = 0;
    productsList.forEach(prod => {
        const amt = parseFloat(prod.amount) || 0;
        const frt = parseFloat(prod.totalFreight) || 0;
        grandTotal += amt + frt;
    });

    const totalY = y;
    doc.line(margin, totalY, pageWidth - margin, totalY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Amount Chargeable (In Word's) USD ", margin + 1, totalY + 6.5);
    doc.setFont("helvetica", "bold");
    const wordsVal = record.totalAmountWords || numberToWordsUSD(grandTotal);
    doc.text(wordsVal, margin + 55, totalY + 6.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.text(totalVal, pageWidth - margin - 2, totalY + 6.5, { align: 'right' });

    doc.line(margin, totalY + 9, pageWidth - margin, totalY + 9);
    doc.line(pageWidth - margin - 25, totalY, pageWidth - margin - 25, totalY + 9);
    y = totalY + 9;

    // --- Declaration + Signature (side by side) ---
    const declY = y;
    const declWidth = contentWidth * 0.6;

    // Declaration (Left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DECLARATION:", margin + 2, declY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const declText = "We declare that this invoice-cum-packing list shows the actual price and details of the goods described and that all particulars are true and correct.\nWe do certify that we have no local agent in Bangladesh and the quoted price is net and no commission is payable.";
    const declLines = doc.splitTextToSize(declText, declWidth - 5);
    doc.text(declLines, margin + 2, declY + 10);

    // Signature (Right)
    const sigImageWidth = 50;
    const sigImageX = pageWidth - margin - sigImageWidth - 5;

    const exporter = exporters?.find(e => e.name === (record.exporterName || pi?.exporterName));
    const exporterSignature = record.exporterSignature || pi?.exporterSignature || exporter?.signature || '';

    if (exporterSignature) {
        try {
            doc.addImage(exporterSignature, 'PNG', sigImageX, declY + 2, sigImageWidth, 18);
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
