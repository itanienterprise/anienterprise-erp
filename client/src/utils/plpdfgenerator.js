import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { appendTrTemplatePage } from './plTrTemplatePage';

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

const formatExporterAddressOneLine = (addressStr) => {
    if (!addressStr) return '';
    const lines = addressStr.split('\n').map(l => l.trim()).filter(Boolean);
    const cinKeywords = ['cin:', 'cin ', 'gst:', 'gstin:', 'tin:', 'bin:', 'pan:', 'pan '];
    const addressLines = [];
    const taxLines = [];
    lines.forEach(line => {
        const lower = line.toLowerCase();
        if (cinKeywords.some(kw => lower.includes(kw))) {
            taxLines.push(line);
        } else {
            addressLines.push(line);
        }
    });
    const singleAddressLine = addressLines.join(' ').replace(/\s+/g, ' ').trim();
    const resultLines = [];
    if (singleAddressLine) resultLines.push(singleAddressLine);
    taxLines.forEach(line => resultLines.push(line));
    return resultLines.join('\n');
};


export const generatePLPDF = async (record, piRecords = [], lcRecords = [], importers = [], exporters = [], banks = [], ipRecords = [], trSetups = []) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 10;

    // Resolve details using database records if missing
    const cleanPiNumber = (record.piNumber || '').replace(' (REVISED)', '').trim();
    const pi = piRecords.find(p => (p.piNumber || '').trim().toLowerCase() === cleanPiNumber.toLowerCase());
    const lc = lcRecords.find(l => l.lcNo === (record.lcNumber || pi?.lcNumber));
    const isPiRevised = (pi?.revisions && pi.revisions.length > 0) || (record.piNumber || '').includes('(REVISED)');

    const bankName = record.bankName || lc?.bankName || '';
    let branchName = record.branchName || '';
    if (!branchName && bankName && Array.isArray(banks) && banks.length > 0) {
        const matchedBank = banks.find(b => b.bankName.toLowerCase().trim() === bankName.toLowerCase().trim());
        if (matchedBank && matchedBank.branches && matchedBank.branches.length > 0) {
            branchName = matchedBank.branches[0].branch;
        }
    }
    const importer = importers.find(imp => imp.name === record.partyName);

    const preCarriageBy = record.preCarriageBy && record.preCarriageBy !== 'ROAD' ? record.preCarriageBy : (pi?.preCarriageBy || record.preCarriageBy || 'ROAD');
    const vesselFlightNo = record.vesselFlightNo && record.vesselFlightNo !== 'BY TRUCK' ? record.vesselFlightNo : (pi?.vesselFlightNo || record.vesselFlightNo || 'BY TRUCK');
    const portOfLoading = record.portOfLoading || pi?.portOfLoading || 'ANY PLACE OF INDIA';
    const portOfDischarge = record.portOfDischarge || pi?.portOfDischarge || '';
    const descriptionGoods = record.descriptionGoods || pi?.descriptionGoods || '';
    const countryOrigin = record.countryOrigin || pi?.countryOrigin || 'INDIA';
    const certification = record.certification || pi?.certification || '';
    const showSafta = certification && certification.toLowerCase().includes('safta');
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
    const formattedAddress = formatExporterAddressOneLine(exporterAddress);
    const exporterLines = formattedAddress.split('\n');
    exporterLines.forEach(line => {
        if (line.trim()) {
            doc.text(line.trim(), pageWidth / 2, y, { align: 'center' });
            y += 4;
        }
    });

    const exporter = exporters?.find(e => e.name === (record.exporterName || pi?.exporterName));
    const exporterPhone = record.exporterContact || exporter?.phone || '';
    const exporterEmail = record.exporterEmail || exporter?.email || '';
    if (exporterPhone) {
        doc.text(`Phone: ${exporterPhone}`, pageWidth / 2, y, { align: 'center' });
        y += 4.5;
    }
    if (exporterEmail) {
        doc.text(`Email: ${exporterEmail}`, pageWidth / 2, y, { align: 'center' });
        y += 4.5;
    }
    if (!exporterPhone && !exporterEmail) {
        y += 2;
    } else {
        y += 1.5;
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
    const gridHeight = isPiRevised ? 55 : 44;

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
    const phone = record.partyContact || importer?.phone || '';
    const email = record.partyEmail || importer?.email || '';
    if (phone) {
        buyerLines.push(`Phone: ${phone}`);
    }
    if (email) {
        buyerLines.push(`Email: ${email}`);
    }
    buyerLines.slice(0, 8).forEach(line => {
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

    if (isPiRevised) {
        const origPiNo = cleanPiNumber;
        const origPiDate = pi?.date || '';

        doc.setFont("helvetica", "bold");
        doc.text("Original PI No:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(origPiNo, midX + 35, rightY);
        rightY += 5;

        doc.setFont("helvetica", "bold");
        doc.text("Original PI Date:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(formatDate(origPiDate), midX + 35, rightY);
        rightY += 6;

        // Horizontal divider
        doc.line(midX, rightY - 2, pageWidth - margin, rightY - 2);

        doc.setFont("helvetica", "bold");
        doc.text("Revised PI No:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(record.piNumber || '', midX + 35, rightY);
        rightY += 5;

        doc.setFont("helvetica", "bold");
        doc.text("Revised PI Date:", midX + 3, rightY);
        doc.setFont("helvetica", "normal");
        doc.text(formatDate(record.piDate), midX + 35, rightY);
        rightY += 6;
    } else {
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
    }

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
    if (record.productsImage) {
        // Draw uploaded image instead of building the table
        try {
            const imgProps = doc.getImageProperties(record.productsImage);
            const imgWidth = contentWidth;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            // Check if image fits on current page
            if (y + imgHeight + 10 > pageHeight - 20) {
                doc.addPage();
                y = 15;
            }
            doc.addImage(record.productsImage, imgProps.fileType || 'PNG', margin, y + 2, imgWidth, imgHeight);
            y += imgHeight + 6;
        } catch (e) {
            console.error('Error drawing products image:', e);
            y += 10;
        }
    } else if (record.productsText) {
        // Draw custom text instead of building the table
        try {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(record.productsText, contentWidth - 6);
            const lineH = 5;
            const textHeight = lines.length * lineH;
            if (y + textHeight + 10 > pageHeight - 20) {
                doc.addPage();
                y = 15;
            }
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);
            doc.rect(margin, y + 2, contentWidth, textHeight + 6);
            lines.forEach((line, idx) => {
                doc.text(line, margin + 3, y + 7 + (idx * lineH));
            });
            y += textHeight + 12;
        } catch (e) {
            console.error('Error drawing products text:', e);
            y += 10;
        }
    } else {
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
            const amnd = record.lcAmendment ? `& ${record.lcAmendment}` : '';
            let coverNoteAmnd = amnd;
            if (record.lcAmendment && lc?.amendments?.length > 0) {
                const cleanLcAmendment = record.lcAmendment.toUpperCase();
                let matchedAmnd = lc.amendments.find(a => {
                    const aNo = (a.amendmentNo || '').toUpperCase();
                    return aNo && (cleanLcAmendment.includes(aNo) || aNo.includes(cleanLcAmendment));
                });
                if (!matchedAmnd) {
                    matchedAmnd = lc.amendments[lc.amendments.length - 1];
                }
                if (matchedAmnd && matchedAmnd.addnNo) {
                    let amndDate = matchedAmnd.addnDate || matchedAmnd.amendmentDate;
                    let amndDateStr = amndDate ? formatDate(amndDate) : '';
                    if (!amndDateStr) {
                        const dateMatch = record.lcAmendment.match(/DATE:\s*([^\s]+)/i);
                        if (dateMatch) {
                            amndDateStr = dateMatch[1];
                        }
                    }
                    coverNoteAmnd = `& ADDN NO: ${matchedAmnd.addnNo}${amndDateStr ? `, DATE. ${amndDateStr}` : ''}`;
                }
            }
            const piNo = pi?.piNumber || '';
            const piDate = pi?.date ? formatDate(pi.date) : '';
            const tin = importer?.tin || '';
            const bin = importer?.bin || '';
            const bankBin = '000321414-0101'; // Default fallback

            let piDisplayStr = `PROFORMA INVOICE: ${piNo} Date:${piDate}`;
            if (isPiRevised) {
                if (record.lcAmendment) {
                    piDisplayStr = `PROFORMA INVOICE: ${record.piNumber || ''} Date:${formatDate(record.piDate)}`;
                } else {
                    piDisplayStr = `PROFORMA INVOICE: ${cleanPiNumber} Date:${formatDate(pi?.date || '')} & REVISED PI NO: ${record.piNumber || ''} Date:${formatDate(record.piDate)}`;
                }
            }

            descParts.push(`IMPORTEDAGAINEST IRC NO-${irc}`);
            const cnDatePart = cnDate ? `, DATED.${cnDate}` : '';
            const amndPart = coverNoteAmnd ? `. ${coverNoteAmnd}` : '';
            descParts.push(`UNDER INSURANCE COVER NOTE NO: ${coverNote}${cnDatePart}${amndPart} OF ${insuranceCo}, BOGURA BRANCH, BOGURA, BANGLADESH.\n`);
            descParts.push(`WE CERTIFY THAT THE COUNTRY OF ORIGIN IS MARKED IN ALL THE\nPACKETS/BAGS. WE DO THAT THE GOODS ARE SHIPED STRICTLY IN\nACCORDANCE WITH THE SPECIFICATION HERE BY CERTIFY QUANTITY AND\nPRICE AS PER ${piDisplayStr}`);
            const trDateStr = record.trDate ? formatDate(record.trDate) : '';
            const trStr = record.trNumber ? `UNDER TR NO.${record.trNumber}${trDateStr ? ` DATE:${trDateStr}` : ''}\n\n` : '';
            if (trStr) descParts.push(trStr);
            if (showSafta) {
                const ipNumberVal = record.ipNumber || pi?.ipNumber || '';
                const ipNumbersList = ipNumberVal.split(',').map(s => s.trim()).filter(Boolean);
                const ipDisplayStr = ipNumbersList.length > 0 ? ipNumbersList.map(ipNo => {
                    const ipRec = ipRecords.find(i => i.ipNumber === ipNo);
                    const rawDate = ipRec?.openingDate || record.ipDate || pi?.ipDate || '';
                    const formattedIpDate = rawDate ? formatDate(rawDate) : '';
                    return formattedIpDate ? `${ipNo} DT.${formattedIpDate}` : ipNo;
                }).join(', ') : 'N/A';
                descParts.push(`IMPORT PERMIT NO. ${ipDisplayStr}`);
            }
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
        y = doc.lastAutoTable.finalY;

        y += 6;
    } // end else (no productsImage)

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

    const enrichedProductsList = (record.productsList || []).map((prod, idx) => {
        const piProd = pi?.productsList?.find(p => (p.productName || '').trim().toLowerCase() === (prod.productName || '').trim().toLowerCase()) || pi?.productsList?.[idx];
        return {
            ...prod,
            bagCount: prod.bagCount,
            packingType: prod.packingType,
            hsCodeInd: prod.hsCodeInd || piProd?.hsCodeInd || pi?.hsCodeInd || '',
            freight: prod.freight || piProd?.freight || '',
            totalFreight: prod.totalFreight || piProd?.totalFreight || ''
        };
    });

    const trLcNo = lc?.lcNo || record.lcNumber || '';
    const trLcDate = lc?.lcDate ? formatDate(lc.lcDate) : (record.lcDate ? formatDate(record.lcDate) : '');
    const trBankBin = '000321414-0101';
    const trIrc = importer?.irc || '';
    const trTin = importer?.tin || '';
    const trBin = importer?.bin || '';
    const trPiNo = isPiRevised ? (record.piNumber || '') : (pi?.piNumber || record.piNumber || '');
    const trPiDate = isPiRevised ? formatDate(record.piDate) : (pi?.date ? formatDate(pi.date) : (record.piDate ? formatDate(record.piDate) : ''));
    
    const cnDateStr = lc?.marineCNDate ? formatDate(lc.marineCNDate) : '';
    let trCoverNote = lc?.marineCoverNote || '';
    if (trCoverNote && cnDateStr) {
        trCoverNote = `${trCoverNote} DATED.${cnDateStr}`;
    }
    
    let trAmendmentLine = '';
    if (record.lcAmendment) {
        if (lc?.amendments?.length > 0) {
            const cleanLcAmendment = record.lcAmendment.toUpperCase();
            let matchedAmnd = lc.amendments.find(a => {
                const aNo = (a.amendmentNo || '').toUpperCase();
                return aNo && (cleanLcAmendment.includes(aNo) || aNo.includes(cleanLcAmendment));
            });
            if (!matchedAmnd) {
                matchedAmnd = lc.amendments[lc.amendments.length - 1];
            }
            if (matchedAmnd && matchedAmnd.addnNo) {
                let amndDate = matchedAmnd.addnDate || matchedAmnd.amendmentDate;
                let amndDateStr = amndDate ? formatDate(amndDate) : '';
                if (!amndDateStr) {
                    const dateMatch = record.lcAmendment.match(/DATE:\s*([^\s]+)/i);
                    if (dateMatch) {
                        amndDateStr = dateMatch[1];
                    }
                }
                trCoverNote += ` & ADDN NO: ${matchedAmnd.addnNo}${amndDateStr ? `, DATE. ${amndDateStr}` : ''}`;
            }
        }
        
        const amndNoMatch = record.lcAmendment.match(/AMENDMENT\s*NO-?\s*([^\s]+)/i);
        const amndDateMatch = record.lcAmendment.match(/DATE:\s*([^\s]+)/i);
        const amndNo = amndNoMatch ? amndNoMatch[1] : '';
        const amndDate = amndDateMatch ? amndDateMatch[1] : '';
        if (amndNo) {
            trAmendmentLine = `AMENDMENT NO - ${amndNo}${amndDate ? ` DATE: ${amndDate}` : ''}`;
        } else {
            trAmendmentLine = record.lcAmendment;
        }
    }

    let computedGrandTotal = 0;
    (record.productsList || []).forEach(prod => {
        const qty = parseFloat(prod.quantity) || 0;
        const rate = parseFloat(prod.rate) || 0;
        const amt = qty * rate;
        const frt = parseFloat(prod.freight) || 0;
        computedGrandTotal += amt + frt;
    });

    const trPiGrandTotal = (computedGrandTotal > 0 ? computedGrandTotal : '') || pi?.grandTotal || record.totalAmount || record.grandTotal || '';

    await appendTrTemplatePage(doc, {
        ...record,
        bankName,
        branchName,
        productsList: enrichedProductsList,
        lcNo: trLcNo,
        lcDate: trLcDate,
        bankBin: trBankBin,
        ircNo: trIrc,
        tinNo: trTin,
        binNo: trBin,
        piNo: trPiNo,
        piDate: trPiDate,
        coverNote: trCoverNote,
        amendmentLine: trAmendmentLine,
        piGrandTotal: trPiGrandTotal,
        packingType: record.packingType || pi?.packingType || '',
        certification: record.certification || pi?.certification || ''
    }, trSetups);

    // Save/Download PDF
    const filename = `PackingList_${record.packingListNumber || 'Draft'}.pdf`;
    doc.save(filename);
};
