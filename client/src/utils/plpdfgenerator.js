import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to format dates
const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
};

export const generatePLPDF = (record, piRecords = [], lcRecords = [], importers = [], exporters = []) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10;

    // Resolve details using database records if missing
    const pi = piRecords.find(p => p.piNumber === record.piNumber);
    const lc = lcRecords.find(l => l.lcNo === (record.lcNumber || pi?.lcNumber));
    const importer = importers.find(imp => imp.name === record.partyName);

    const preCarriageBy = record.preCarriageBy && record.preCarriageBy !== 'ROAD' ? record.preCarriageBy : (pi?.preCarriageBy || record.preCarriageBy || 'ROAD');
    const vesselFlightNo = record.vesselFlightNo && record.vesselFlightNo !== 'BY TRUCK' ? record.vesselFlightNo : (pi?.vesselFlightNo || record.vesselFlightNo || 'BY TRUCK');
    const portOfLoading = record.portOfLoading || pi?.portOfLoading || 'ANY PLACE OF INDIA';
    const portOfDischarge = record.portOfDischarge || pi?.portOfDischarge || '';
    const descriptionGoods = record.descriptionGoods || pi?.descriptionGoods || '';
    const countryOrigin = record.countryOrigin || pi?.countryOrigin || 'INDIA';
    const certification = record.certification || pi?.certification || '';
    const indianBank = pi?.indianBank || '';

    // Page border setup (similar to PI Style 1)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));

    let y = margin + 5;

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    const exporterName = record.exporterName || 'ANI Enterprise';
    doc.text(exporterName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const exporterAddress = record.exporterAddress || '';
    const exporterLines = exporterAddress.split('\n');
    exporterLines.forEach(line => {
        if (line.trim()) {
            doc.text(line.trim(), pageWidth / 2, y, { align: 'center' });
            y += 4;
        }
    });

    const contactInfo = [];
    if (record.exporterContact) contactInfo.push(`Contact: ${record.exporterContact}`);
    if (record.exporterEmail) contactInfo.push(`Email: ${record.exporterEmail}`);
    if (contactInfo.length > 0) {
        doc.text(contactInfo.join(' | '), pageWidth / 2, y, { align: 'center' });
        y += 6;
    } else {
        y += 2;
    }

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PACKING LIST", pageWidth / 2, y, { align: 'center' });

    // Double line under title
    y += 1.5;
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 25, y, pageWidth / 2 + 25, y);
    y += 0.8;
    doc.line(pageWidth / 2 - 25, y, pageWidth / 2 + 25, y);
    y += 5.7;

    // --- Metadata Block (Table style, similar to PI layouts) ---
    const metadataStartY = y;

    // Grid measurements
    const leftColX = margin;
    const midX = pageWidth / 2;
    const colWidth = (pageWidth - (margin * 2)) / 2;
    const gridHeight = 44;

    // Outer borders of metadata grid
    doc.setLineWidth(0.2);
    doc.rect(leftColX, metadataStartY, pageWidth - (margin * 2), gridHeight);
    doc.line(midX, metadataStartY, midX, metadataStartY + gridHeight);

    // Left side: Importer details
    let leftY = metadataStartY + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Importer / Buyer:", leftColX + 3, leftY);
    leftY += 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(record.partyName || '', leftColX + 3, leftY);
    leftY += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const buyerAddress = record.partyAddress || '';
    const buyerLines = buyerAddress.split('\n');
    buyerLines.slice(0, 4).forEach(line => {
        if (line.trim()) {
            doc.text(line.trim(), leftColX + 3, leftY);
            leftY += 4;
        }
    });

    // Right side: Packing List details & Reference numbers
    let rightY = metadataStartY + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    doc.setFont("helvetica", "bold");
    doc.text("Invoice No:", midX + 3, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(record.packingListNumber || '', midX + 32, rightY);
    rightY += 5;

    doc.setFont("helvetica", "bold");
    doc.text("Invoice Date:", midX + 3, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(record.date), midX + 32, rightY);
    rightY += 6;

    // Horizontal divider
    doc.line(midX, rightY - 2, pageWidth - margin, rightY - 2);

    doc.setFont("helvetica", "bold");
    doc.text("Proforma Invoice No:", midX + 3, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(record.piNumber || '', midX + 35, rightY);
    rightY += 5;

    doc.setFont("helvetica", "bold");
    doc.text("PI Date:", midX + 3, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(record.piDate), midX + 35, rightY);
    rightY += 6;

    // Horizontal divider
    doc.line(midX, rightY - 2, pageWidth - margin, rightY - 2);

    if (record.lcNumber) {
        doc.setFont("helvetica", "bold");
        doc.text("L/C Number:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(record.lcNumber, midX + 32, rightY);
        rightY += 5;

        doc.setFont("helvetica", "bold");
        doc.text("L/C Date:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(formatDate(record.lcDate), midX + 32, rightY);
    } else {
        doc.setFont("helvetica", "bold");
        doc.text("Buyer's Order No:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(record.buyerOrderNo || 'N/A', midX + 32, rightY);
        rightY += 5;

        doc.setFont("helvetica", "bold");
        doc.text("Order Date:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(formatDate(record.buyerOrderDate), midX + 32, rightY);
    }

    y = metadataStartY + gridHeight;

    // --- Extra Transport Details Grid (Single Row, 4 Columns) ---
    const transStartY = y;
    const transHeight = 12;
    const cellW = (pageWidth - (margin * 2)) / 4;

    doc.rect(margin, transStartY, pageWidth - (margin * 2), transHeight);
    doc.line(margin + cellW, transStartY, margin + cellW, transStartY + transHeight);
    doc.line(margin + (cellW * 2), transStartY, margin + (cellW * 2), transStartY + transHeight);
    doc.line(margin + (cellW * 3), transStartY, margin + (cellW * 3), transStartY + transHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);

    // Col 1: Pre-carriage
    doc.text("Pre-Carriage By", margin + 2, transStartY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.text(preCarriageBy, margin + 2, transStartY + 8.5);

    // Col 2: Vessel/Truck
    doc.setFont("helvetica", "bold");
    doc.text("Vessel / Flight No / Truck No", margin + cellW + 2, transStartY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.text(vesselFlightNo, margin + cellW + 2, transStartY + 8.5);

    // Col 3: Port of Loading
    doc.setFont("helvetica", "bold");
    doc.text("Port of Loading", margin + (cellW * 2) + 2, transStartY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.text(portOfLoading, margin + (cellW * 2) + 2, transStartY + 8.5);

    // Col 4: Port of Discharge
    doc.setFont("helvetica", "bold");
    doc.text("Port of Discharge", margin + (cellW * 3) + 2, transStartY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.text(portOfDischarge, margin + (cellW * 3) + 2, transStartY + 8.5);

    y = transStartY + transHeight;

    // --- Product / Item Table ---
    const headers = [
        ['Marks & Nos', 'Description of Goods & HS Code', 'No. & Kind of Packages', 'Net Weight', 'Gross Weight']
    ];

    let totalBags = 0;
    let totalQty = 0;
    let totalNetWeight = 0;
    let totalGrossWeight = 0;

    const rows = [];
    const productsList = record.productsList || [];

    // Build description parts
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
    const extraDescText = descParts.join("\n");

    productsList.forEach((prod, index) => {
        // Calculations
        const bags = parseInt(prod.bagCount) || 0;
        const netW = parseFloat(prod.netWeight) || 0;
        const grossW = parseFloat(prod.grossWeight) || 0;

        totalBags += bags;
        totalNetWeight += netW;
        totalGrossWeight += grossW;

        const marks = record.marksNo || 'N/A';
        const hsCodeText = prod.hsCode ? `\n(H.S. CODE NO: ${prod.hsCode})` : '';
        let descText = `${prod.productName || ''}${hsCodeText}`;
        if (productsList.length === 1 && extraDescText) {
            descText += `\n\n${extraDescText}`;
        }

        const bagText = bags > 0 ? `${bags.toLocaleString('en-US')} BAGS` : 'N/A';

        rows.push([
            { content: index === 0 ? marks : '', styles: { valign: 'middle', halign: 'center' } },
            { content: descText, styles: { halign: extraDescText ? 'left' : 'center', fontSize: extraDescText ? 8 : 8.5 } },
            { content: bagText, styles: { halign: 'center', fontStyle: 'bold' } },
            { content: netW > 0 ? `${netW.toLocaleString('en-US', { maximumFractionDigits: 0 })} KG` : 'N/A', styles: { halign: 'center', fontStyle: 'bold' } },
            { content: grossW > 0 ? `${grossW.toLocaleString('en-US', { maximumFractionDigits: 0 })} KG` : 'N/A', styles: { halign: 'center', fontStyle: 'bold' } }
        ]);
    });

    if (productsList.length > 1 && extraDescText) {
        rows.push([
            { content: '', styles: { border: 'none' } },
            { content: extraDescText, styles: { halign: 'left', fontStyle: 'normal', fontSize: 8 } },
            { content: '', styles: { border: 'none' } },
            { content: '', styles: { border: 'none' } },
            { content: '', styles: { border: 'none' } }
        ]);
    }

    // Add sub-total / total row
    rows.push([
        { content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalBags > 0 ? `${totalBags.toLocaleString('en-US')} BAGS` : 'N/A', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalNetWeight > 0 ? `${totalNetWeight.toLocaleString('en-US', { maximumFractionDigits: 0 })} KG` : 'N/A', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalGrossWeight > 0 ? `${totalGrossWeight.toLocaleString('en-US', { maximumFractionDigits: 0 })} KG` : 'N/A', styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }
    ]);

    autoTable(doc, {
        startY: y + 2,
        head: headers,
        body: rows,
        margin: { left: margin, right: margin },
        theme: 'plain',
        styles: {
            fontSize: 8.5,
            cellPadding: 4,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0]
        },
        headStyles: {
            fillColor: [240, 240, 240],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle'
        },
        columnStyles: {
            0: { width: 35 },
            1: { width: 55 },
            2: { width: 35 },
            3: { width: 32 },
            4: { width: 32 }
        },
        didDrawPage: (data) => {
            y = data.cursor.y;
        }
    });

    y += 6;

    // --- Bottom details (Declaration / Notes & Signatures) ---
    // Ensure all content fits on the page by limiting signature vertical start position
    const minRemainingSpace = 55;
    if (pageHeight - y < minRemainingSpace) {
        doc.addPage();
        // Redraw page border for the new page
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2));
        y = margin + 10;
    }

    // Declaration box
    const decY = y;
    const decHeight = 16;
    doc.setLineWidth(0.2);
    doc.rect(margin, decY, pageWidth - (margin * 2), decHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Declaration:", margin + 3, decY + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const decText = "We declare that this packing list shows the actual details of the goods described and that all particulars (bag count, net weight, gross weight) are true and correct.";
    const splitDec = doc.splitTextToSize(decText, pageWidth - (margin * 2) - 8);
    doc.text(splitDec, margin + 3, decY + 8.5);

    y = decY + decHeight + 8;

    // Signatures (Style 1 Layout: Buyer Left, Seller Right)
    doc.setFontSize(8.5);
    doc.text("For,", margin + 2, y);

    const partySignature = record.partySignature || pi?.partySignature || importer?.signature || '';
    if (partySignature) {
        try {
            doc.addImage(partySignature, 'PNG', margin + 5, y, 60, 12);
        } catch (e) {
            console.error('Error adding buyer signature:', e);
        }
    }
    doc.line(margin + 5, y + 20, margin + 65, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature", margin + 35, y + 23.5, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Buyer", margin + 35, y + 28, { align: 'center' });

    // Seller signature (Right)
    const exporter = exporters?.find(e => e.name === (record.exporterName || pi?.exporterName));
    const exporterSignature = record.exporterSignature || pi?.exporterSignature || exporter?.signature || '';
    if (exporterSignature) {
        try {
            doc.addImage(exporterSignature, 'PNG', pageWidth - margin - 65, y - 2, 60, 18);
        } catch (e) {
            console.error('Error adding exporter signature:', e);
        }
    }
    doc.line(pageWidth - margin - 65, y + 20, pageWidth - margin - 5, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature", pageWidth - margin - 35, y + 23.5, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Seller", pageWidth - margin - 35, y + 28, { align: 'center' });

    // Save/Download PDF
    const filename = `PackingList_${record.packingListNumber || 'Draft'}.pdf`;
    doc.save(filename);
};
