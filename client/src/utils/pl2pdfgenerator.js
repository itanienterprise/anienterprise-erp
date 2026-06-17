import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { appendTrTemplatePage } from './plTrTemplatePage';

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
    if (amount === 0) return 'US Dollar: Zero.';
    const parts = amount.toFixed(2).split('.');
    let dollar = parseInt(parts[0]), cents = parseInt(parts[1]);
    let words = 'US Dollar: ';
    if (dollar === 0) { words += 'Zero '; } else {
        let tw = '';
        if (dollar >= 10000000) { tw += convertChunk(Math.floor(dollar / 10000000)) + 'Crore '; dollar %= 10000000; }
        if (dollar >= 100000) { tw += convertChunk(Math.floor(dollar / 100000)) + 'Lac '; dollar %= 100000; }
        if (dollar >= 1000) { tw += convertChunk(Math.floor(dollar / 1000)) + 'Thousand '; dollar %= 1000; }
        if (dollar > 0) { tw += convertChunk(dollar); }
        words += tw;
    }
    if (cents > 0) {
        words += 'And Cents ' + convertChunk(cents);
    }
    return words.replace(/\s+/g, ' ').trim() + '.';
};

const fitFontSizeOneLine = (doc, text, maxWidth, maxSize = 9, minSize = 4.5, fontStyle = 'bold') => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return maxSize;
    doc.setFont('helvetica', fontStyle);
    let size = maxSize;
    while (size > minSize) {
        doc.setFontSize(size);
        if (doc.getTextWidth(clean) <= maxWidth) return size;
        size -= 0.25;
    }
    doc.setFontSize(minSize);
    return minSize;
};

export const generatePL2PDF = async (record, piRecords = [], lcRecords = [], importers = [], exporters = [], banks = [], ipRecords = [], trSetups = []) => {
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
    const cleanPiNumber = (record.piNumber || '').replace(' (REVISED)', '').trim();
    const pi = piRecords.find(p => (p.piNumber || '').trim().toLowerCase() === cleanPiNumber.toLowerCase());
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
    const showSafta = certification && certification.toLowerCase().includes('safta');
    const isPiRevised = (pi?.revisions && pi.revisions.length > 0) || (record.piNumber || '').includes('(REVISED)');

    const getCertBlockFontSize = (productCount) => {
        if (productCount <= 1) return 7.0;
        if (productCount === 2) return 7.2;
        return 6.2;
    };

    const getDescriptionBlockHeight = (fSize, maxWidth = 0) => {
        const prevFontSize = doc.internal.getFontSize();
        doc.setFontSize(fSize);
        doc.setFont('helvetica', 'bold');

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
        const bankBin = '000321414-0101';

        let curY = 0;
        const lineSpacing = fSize < 7 ? fSize * 0.38 : fSize * 0.46;

        const addWrapped = (text) => {
            const lines = maxWidth > 0 ? doc.splitTextToSize(text, maxWidth) : [text];
            curY += lines.length * lineSpacing;
        };

        addWrapped(`IMPORTED AGAINST IRC NO-${irc}`);

        if (maxWidth > 0) {
            const cnDatePart = cnDate ? `, DATED.${cnDate}` : '';
            const amndPart = coverNoteAmnd ? `. ${coverNoteAmnd}` : '';
            addWrapped(`UNDER INSURANCE COVER NOTE NO: ${coverNote}${cnDatePart}${amndPart} OF ${insuranceCo}, BOGURA BRANCH, BOGURA, BANGLADESH.`);
            curY += lineSpacing;
            addWrapped('WE CERTIFY THAT THE COUNTRY OF ORIGIN IS MARKED IN ALL THE PACKETS/BAGS. WE DO THAT THE GOODS ARE SHIPED STRICTLY IN ACCORDANCE WITH THE SPECIFICATION HERE BY CERTIFY QUANTITY AND');
        } else {
            curY += 6 * lineSpacing;
        }

        if (isPiRevised) {
            if (record.lcAmendment) {
                addWrapped(`PRICE AS PER PROFORMA INVOICE: ${record.piNumber || ''} Date:${formatDate(record.piDate)}`);
            } else {
                addWrapped(`PRICE AS PER PROFORMA INVOICE: ${cleanPiNumber} Date:${formatDate(pi?.date || '')}`);
                addWrapped(`& REVISED PI NO: ${record.piNumber || ''} Date:${formatDate(record.piDate)}`);
            }
        } else {
            addWrapped(`PRICE AS PER PROFORMA INVOICE: ${piNo || record.piNumber || ''} Date:${piDate || formatDate(record.piDate)}`);
        }

        if (record.trNumber) {
            const trDateStr = record.trDate ? formatDate(record.trDate) : '';
            const trLine = trDateStr ? `UNDER TR NO.${record.trNumber} DATE:${trDateStr}` : `UNDER TR NO.${record.trNumber}`;
            addWrapped(trLine);
            curY += lineSpacing;
        }

        if (showSafta) {
            const ipNumberVal = record.ipNumber || pi?.ipNumber || '';
            const ipNumbersList = ipNumberVal.split(',').map(s => s.trim()).filter(Boolean);
            
            let filteredIpNumbersList = ipNumbersList;
            if (isPiRevised && pi?.revisions?.length > 0) {
                const originalRev = pi.revisions.find(r => r.reviseNo === 'Original PI');
                const originalProducts = originalRev?.productsList || [];
                const changedProducts = [];
                
                (pi.productsList || []).forEach(p => {
                    const origProd = originalProducts.find(op => op.productName?.trim().toLowerCase() === p.productName?.trim().toLowerCase());
                    const origQty = origProd ? (parseFloat(origProd.quantity) || 0) : 0;
                    const revQty = parseFloat(p.quantity) || 0;
                    if (revQty - origQty > 0) {
                        changedProducts.push(p.productName?.trim().toLowerCase());
                    }
                });
                
                if (changedProducts.length > 0) {
                    const matchedIps = ipNumbersList.filter(ipNo => {
                        const ipRec = ipRecords.find(i => i.ipNumber === ipNo);
                        const ipProdName = ipRec?.productName?.trim().toLowerCase() || '';
                        return changedProducts.includes(ipProdName);
                    });
                    if (matchedIps.length > 0) {
                        filteredIpNumbersList = matchedIps;
                    }
                }
            }

            const ipDisplayStr = filteredIpNumbersList.length > 0 ? filteredIpNumbersList.map(ipNo => {
                const ipRec = ipRecords.find(i => i.ipNumber === ipNo);
                const rawDate = ipRec?.closeDate || record.ipDate || pi?.ipDate || '';
                const formattedIpDate = rawDate ? formatDate(rawDate) : '';
                return formattedIpDate ? `${ipNo} DATED.${formattedIpDate}` : ipNo;
            }).join(', ') : 'N/A';

            addWrapped(`IMPORT PERMIT NO. ${ipDisplayStr}`);
        }

        addWrapped(`IMPORTERS TIN NO.${tin}, & BIN-${bin}`);
        addWrapped(`BANK BIN-${bankBin}`);
        addWrapped('Export Standard packing');
        addWrapped(`COUNTRY OF ORIGIN ${countryOrigin.toUpperCase()}`);

        doc.setFontSize(prevFontSize);
        doc.setFont('helvetica', 'normal');

        return curY;
    };

    const drawDescriptionBlock = (x, startY, fSize, maxWidth = 0) => {
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
        const bankBin = '000321414-0101';

        doc.setFontSize(fSize);
        let curY = startY;
        const lineSpacing = fSize < 7 ? fSize * 0.38 : fSize * 0.46;

        const drawWrapped = (text, bold = true) => {
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.setFontSize(fSize);
            const lines = maxWidth > 0
                ? doc.splitTextToSize(text, maxWidth)
                : [text];
            lines.forEach((line) => {
                doc.text(line, x, curY);
                curY += lineSpacing;
            });
        };

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

        if (maxWidth > 0) {
            const cnDatePart = cnDate ? `, DATED.${cnDate}` : '';
            const amndPart = coverNoteAmnd ? `. ${coverNoteAmnd}` : '';
            drawWrapped(`UNDER INSURANCE COVER NOTE NO: ${coverNote}${cnDatePart}${amndPart} OF ${insuranceCo}, BOGURA BRANCH, BOGURA, BANGLADESH.`);
            curY += lineSpacing;
            drawWrapped('WE CERTIFY THAT THE COUNTRY OF ORIGIN IS MARKED IN ALL THE PACKETS/BAGS. WE DO THAT THE GOODS ARE SHIPED STRICTLY IN ACCORDANCE WITH THE SPECIFICATION HERE BY CERTIFY QUANTITY AND', false);
        } else {
            const cnDatePart = cnDate ? `, DATED.${cnDate}` : '';
            const amndPart = coverNoteAmnd ? `. ${coverNoteAmnd}` : '';
            drawLine([
                { text: `UNDER INSURANCE COVER NOTE NO: ${coverNote}${cnDatePart}${amndPart}`, bold: true }
            ]);
            drawLine([
                { text: "OF " },
                { text: insuranceCo, bold: true },
                { text: ", BOGURA BRANCH, BOGURA, BANGLADESH." }
            ]);
            curY += lineSpacing;
            drawLine([{ text: "WE CERTIFY THAT THE COUNTRY OF ORIGIN IS MARKED IN ALL THE" }]);
            drawLine([{ text: "PACKETS/BAGS. WE DO THAT THE GOODS ARE SHIPED STRICTLY IN" }]);
            drawLine([{ text: "ACCORDANCE WITH THE SPECIFICATION HERE BY CERTIFY QUANTITY AND" }]);
        }

        if (isPiRevised) {
            if (record.lcAmendment) {
                drawLine([
                    { text: "PRICE AS PER PROFORMA INVOICE: ", bold: true },
                    { text: record.piNumber || '', bold: true },
                    { text: " Date:", bold: true },
                    { text: formatDate(record.piDate), bold: true }
                ]);
            } else {
                drawLine([
                    { text: "PRICE AS PER PROFORMA INVOICE: ", bold: true },
                    { text: cleanPiNumber, bold: true },
                    { text: " Date:", bold: true },
                    { text: formatDate(pi?.date || ''), bold: true }
                ]);
                drawLine([
                    { text: "& REVISED PI NO: ", bold: true },
                    { text: record.piNumber || '', bold: true },
                    { text: " Date:", bold: true },
                    { text: formatDate(record.piDate), bold: true }
                ]);
            }
        } else {
            drawLine([
                { text: "PRICE AS PER PROFORMA INVOICE: ", bold: true },
                { text: piNo || record.piNumber || '', bold: true },
                { text: " Date:", bold: true },
                { text: piDate || formatDate(record.piDate), bold: true }
            ]);
        }

        if (record.trNumber) {
            const trDateStr = record.trDate ? formatDate(record.trDate) : '';
            drawLine([
                { text: "UNDER TR NO. ", bold: true },
                { text: trDateStr ? `${record.trNumber} DATE:${trDateStr}` : record.trNumber, bold: true }
            ]);
            curY += lineSpacing;
        }

        if (showSafta) {
            const ipNumberVal = record.ipNumber || pi?.ipNumber || '';
            const ipNumbersList = ipNumberVal.split(',').map(s => s.trim()).filter(Boolean);
            
            let filteredIpNumbersList = ipNumbersList;
            if (isPiRevised && pi?.revisions?.length > 0) {
                const originalRev = pi.revisions.find(r => r.reviseNo === 'Original PI');
                const originalProducts = originalRev?.productsList || [];
                const changedProducts = [];
                
                (pi.productsList || []).forEach(p => {
                    const origProd = originalProducts.find(op => op.productName?.trim().toLowerCase() === p.productName?.trim().toLowerCase());
                    const origQty = origProd ? (parseFloat(origProd.quantity) || 0) : 0;
                    const revQty = parseFloat(p.quantity) || 0;
                    if (revQty - origQty > 0) {
                        changedProducts.push(p.productName?.trim().toLowerCase());
                    }
                });
                
                if (changedProducts.length > 0) {
                    const matchedIps = ipNumbersList.filter(ipNo => {
                        const ipRec = ipRecords.find(i => i.ipNumber === ipNo);
                        const ipProdName = ipRec?.productName?.trim().toLowerCase() || '';
                        return changedProducts.includes(ipProdName);
                    });
                    if (matchedIps.length > 0) {
                        filteredIpNumbersList = matchedIps;
                    }
                }
            }

            const ipDisplayStr = filteredIpNumbersList.length > 0 ? filteredIpNumbersList.map(ipNo => {
                const ipRec = ipRecords.find(i => i.ipNumber === ipNo);
                const rawDate = ipRec?.closeDate || record.ipDate || pi?.ipDate || '';
                const formattedIpDate = rawDate ? formatDate(rawDate) : '';
                return formattedIpDate ? `${ipNo} DT.${formattedIpDate}` : ipNo;
            }).join(', ') : 'N/A';

            if (maxWidth > 0) {
                drawWrapped(`IMPORT PERMIT NO. ${ipDisplayStr}`);
            } else {
                drawLine([
                    { text: "IMPORT PERMIT NO. ", bold: true },
                    { text: ipDisplayStr, bold: true }
                ]);
            }
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
        return curY;
    };

    const preCarriageBy = record.preCarriageBy && record.preCarriageBy !== 'ROAD' ? record.preCarriageBy : (pi?.preCarriageBy || record.preCarriageBy || 'ROAD');
    const placeOfReceipt = record.placeOfReceipt && record.placeOfReceipt !== 'BY ROAD' ? record.placeOfReceipt : (pi?.placeOfReceipt || pi?.placeOfReceiptByPreCarrier || record.placeOfReceipt || 'BY ROAD');
    const vesselFlightNo = record.vesselFlightNo && record.vesselFlightNo !== 'BY TRUCK' ? record.vesselFlightNo : (pi?.vesselFlightNo || record.vesselFlightNo || 'BY TRUCK');
    const portOfLoading = record.portOfLoading || pi?.portOfLoading || 'ANY PLACE OF INDIA';
    const portOfDischarge = record.portOfDischarge || pi?.portOfDischarge || '';
    const finalDestination = record.finalDestination && record.finalDestination !== 'BANGLADESH' ? record.finalDestination : (pi?.finalDestination || record.finalDestination || 'BANGLADESH');

    const productsList = (record.productsList && record.productsList.length > 0 ? record.productsList : []).map(prod => {
        const piProd = pi?.productsList?.find(p => p.productName?.toLowerCase() === prod.productName?.toLowerCase());
        
        let qty = prod.quantity;
        let amt = prod.amount;
        let totFrt = prod.totalFreight;
        
        if (isPiRevised && pi?.revisions?.length > 0) {
            const originalRev = pi.revisions.find(r => r.reviseNo === 'Original PI');
            const originalProducts = originalRev?.productsList || [];
            const origProd = originalProducts.find(op => op.productName?.trim().toLowerCase() === prod.productName?.trim().toLowerCase());
            
            const origQty = origProd ? (parseFloat(origProd.quantity) || 0) : 0;
            const revQty = piProd ? (parseFloat(piProd.quantity) || 0) : 0;
            const diffQty = revQty - origQty;
            
            if (diffQty > 0) {
                qty = String(diffQty);
                amt = String((diffQty * (parseFloat(prod.rate || piProd?.rate || 0))).toFixed(2));
                totFrt = String((diffQty * (parseFloat(prod.freight || piProd?.freight || 0))).toFixed(2));
            }
        }
        
        return {
            ...prod,
            quantity: qty,
            rate: prod.rate || piProd?.rate || '',
            amount: amt || piProd?.amount || '',
            freight: prod.freight || piProd?.freight || '',
            totalFreight: totFrt || piProd?.totalFreight || ''
        };
    });

    // Main Border
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.rect(margin, margin + 8, contentWidth, pageHeight - (2 * margin) - 8);

    // --- Header ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE-CUM PACKING LIST", pageWidth / 2, margin + 5.5, { align: 'center' });

    // --- Grid Layout ---
    const leftColWidth = contentWidth * 0.55;
    const rightColWidth = contentWidth - leftColWidth;
    const midX = margin + leftColWidth;

    // Row 1: Exporter vs PI Info
    let y = margin + 8;
    const row1Height = isPiRevised ? 34 : 30;
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
    const exporterNameY = isPiRevised ? y + 13 : y + 12;
    doc.text(nameLines, margin + leftColWidth / 2, exporterNameY, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    let exporterInfo = record.exporterAddress || '';
    const exporter = exporters?.find(e => e.name === (record.exporterName || pi?.exporterName));
    const exporterPhone = record.exporterContact || exporter?.phone || '';
    const exporterEmail = record.exporterEmail || exporter?.email || '';
    const expContactParts = [];
    if (exporterPhone) expContactParts.push(`Phone: ${exporterPhone}`);
    if (exporterEmail) expContactParts.push(`Email: ${exporterEmail}`);
    const expContactLine = expContactParts.join(', ');
    if (expContactLine) {
        exporterInfo = exporterInfo.trim() + `\n${expContactLine}`;
    }
    const exporterAddressY = isPiRevised ? y + 19 : y + 17;
    doc.text(doc.splitTextToSize(exporterInfo.trim(), leftColWidth - 10), margin + leftColWidth / 2, exporterAddressY, { align: 'center' });

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

    if (isPiRevised) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(cleanPiNumber, midX + 2, y + 21);

        const origPiDateVal = formatDate(pi?.date || '') || '';
        doc.setFontSize(8.5);
        doc.text("DATE-" + origPiDateVal, midX + rightColWidth - 2, y + 21, { align: 'right' });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(record.piNumber || '', midX + 2, y + 25);

        const revisedPiDateVal = formatDate(record.piDate) || '';
        doc.setFontSize(8.5);
        doc.text("DATE-" + revisedPiDateVal, midX + rightColWidth - 2, y + 25, { align: 'right' });

        doc.line(midX, y + 28, pageWidth - margin, y + 28);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Seller (if other than consigner)", midX + 2, y + 31.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        const buyerLines = doc.splitTextToSize(buyerName || '', rightColWidth - 5);
        doc.text(buyerLines, midX + 2, y + 33.5);
    } else {
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
    }

    // Row 2: Importer vs Country/Terms/LC Box
    y += row1Height;

    doc.setFontSize(9);
    let cleanTerms = termsDeliveryPayment || '';
    const againstIndex = cleanTerms.toUpperCase().indexOf('AGAINST');
    if (againstIndex !== -1) {
        cleanTerms = cleanTerms.substring(0, againstIndex + 7).trim();
    }
    // Collapse soft newlines so "AGAINST" is not orphaned on its own line.
    cleanTerms = cleanTerms.replace(/ ?\n/g, ' ').trim();
    const termsLines = doc.splitTextToSize(cleanTerms, rightColWidth - 5);
    const termsHeight = termsLines.length * 4;
    let row2Height = Math.max(55, 24 + termsHeight);
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
    const phone = record.partyContact || importer?.phone || '';
    const email = record.partyEmail || importer?.email || '';
    const contactParts = [];
    if (phone) contactParts.push(`Phone: ${phone}`);
    if (email) contactParts.push(`Email: ${email}`);
    const contactLine = contactParts.join(', ');
    if (contactLine) {
        impInfo = impInfo.trim() + `\n${contactLine}`;
    }
    doc.text(doc.splitTextToSize(impInfo.trim(), leftColWidth - 10), margin + leftColWidth / 2, y + 17, { align: 'center' });

    // Shipping rows (left)
    doc.line(margin, y + 29, margin + leftColWidth, y + 29);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Pre-Carriage by", margin + leftColWidth / 4, y + 32, { align: 'center' });
    doc.text("Place of Receipt by Pre-Carrier", margin + (3 * leftColWidth / 4), y + 32, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(preCarriageBy, margin + leftColWidth / 4, y + 36, { align: 'center' });
    doc.text(placeOfReceipt, margin + (3 * leftColWidth / 4), y + 36, { align: 'center' });

    doc.line(margin, y + 38.5, margin + leftColWidth, y + 38.5);
    doc.setFontSize(8.5);
    doc.text("Vessel/Flight No.", margin + leftColWidth / 4, y + 41.5, { align: 'center' });
    doc.text("Port of Loading", margin + (3 * leftColWidth / 4), y + 41.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(vesselFlightNo, margin + leftColWidth / 4, y + 45.5, { align: 'center' });
    doc.text(portOfLoading, margin + (3 * leftColWidth / 4), y + 45.5, { align: 'center' });

    doc.line(margin, y + 47.5, margin + leftColWidth, y + 47.5);
    doc.setFontSize(8.5);
    doc.text("Port of Discharge", margin + leftColWidth / 4, y + 50.5, { align: 'center' });
    doc.text("Final Destination", margin + (3 * leftColWidth / 4), y + 50.5, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(portOfDischarge, margin + leftColWidth / 4, y + 53.5, { align: 'center' });
    doc.text(finalDestination, margin + (3 * leftColWidth / 4), y + 53.5, { align: 'center' });
    doc.line(margin + (leftColWidth / 2), y + 29, margin + (leftColWidth / 2), y + row2Height);

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
    const numProducts = productsList.length;
    // Certification block is drawn via drawDescriptionBlock (not descriptionGoods / terms text)
    const certFontSize = getCertBlockFontSize(numProducts);
    const certBlockLineCount = 13 + (record.trNumber ? 2 : 0) + (showSafta ? 1 : 0);

    const tableBody = [];
    const firstRowIndexForProduct = [];
    let saftaRowIndex = -1;

    const getProductTableFonts = (count) => {
        if (count === 1) return { value: 11, label: 9, freight: 10 };
        if (count === 2) return { value: 9, label: 7.5, freight: 8.5 };
        return { value: 8, label: 7, freight: 7.5 };
    };
    const numericFonts = getProductTableFonts(numProducts);
    const numericCellPadding = numProducts > 1
        ? { top: 1, left: 1, right: 1, bottom: 1 }
        : { top: 1.5, left: 1.5, right: 1.5, bottom: 1.5 };
    const productRowHeight = (count, withFreight) => {
        if (count === 1) return undefined;
        return withFreight ? 18 : 16;
    };
    const numericCellStyleBase = {
        halign: 'center',
        fontStyle: 'bold',
        valign: 'top',
        textColor: [255, 255, 255],
        cellPadding: numericCellPadding
    };

    productsList.forEach((prod, pIdx) => {
        const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
        const isLastProduct = pIdx === numProducts - 1;
        const hasDoubleHsCode = !!(prod.hsCodeInd || pi?.productsList?.[pIdx]?.hsCodeInd);
        let rowHeight = productRowHeight(numProducts, hasFreight);
        if (rowHeight && hasDoubleHsCode) {
            rowHeight += 5;
        }

        firstRowIndexForProduct.push(tableBody.length);

        let requiredNewlines = 1;
        if (prod.hsCodeInd || pi?.productsList?.[pIdx]?.hsCodeInd) requiredNewlines += 1;
        if (showSafta && isLastProduct && (!hasFreight || numProducts === 1)) requiredNewlines += 2.5;
        if (numProducts === 1) {
            requiredNewlines += 2;
        } else {
            requiredNewlines = (prod.hsCodeInd || pi?.productsList?.[pIdx]?.hsCodeInd) ? 2 : 1;
        }

        let cellText = "\n".repeat(requiredNewlines);
        if (numProducts === 1) {
            cellText += "\n\n" + "\n".repeat(certBlockLineCount);
        }

        let bottomPadding = 2;
        let singleRowMinHeight = undefined;
        if (numProducts === 1) {
            const descTextHeight = getDescriptionBlockHeight(certFontSize, 108);
            const prod = productsList[0] || {};
            const hasDoubleHsCode = !!(prod.hsCodeInd || pi?.productsList?.[0]?.hsCodeInd);
            const offsetToDesc = -1 + 7.5 + (hasDoubleHsCode ? 5 : 0) + (showSafta ? 16.5 : 0) + 8;
            if (record.productsImage) {
                try {
                    const imgProps = doc.getImageProperties(record.productsImage);
                    const imgWidth = 108;
                    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                    bottomPadding = imgHeight + 5;
                    singleRowMinHeight = offsetToDesc + descTextHeight + imgHeight + 5;
                } catch (e) {
                    console.error('Error calculating productsImage bottomPadding:', e);
                    bottomPadding = 80;
                    singleRowMinHeight = offsetToDesc + descTextHeight + 80 + 5;
                }
            } else {
                bottomPadding = showSafta ? 15 : 50;
                singleRowMinHeight = showSafta ? offsetToDesc + descTextHeight + 15 : offsetToDesc + descTextHeight + 50;
            }
        }

        const descCellStyle = {
            halign: 'left',
            fontSize: numProducts === 1 ? 7.5 : 9,
            cellPadding: { top: 2, left: 2, right: 2, bottom: bottomPadding },
            valign: 'top'
        };
        if (rowHeight) descCellStyle.minCellHeight = rowHeight;
        else if (singleRowMinHeight) descCellStyle.minCellHeight = singleRowMinHeight;

        const numericCellStyle = {
            ...numericCellStyleBase,
            ...(rowHeight ? { minCellHeight: rowHeight } : {}),
            ...(singleRowMinHeight ? { minCellHeight: singleRowMinHeight } : {})
        };

        tableBody.push([
            { content: cellText, rowSpan: 1, styles: descCellStyle },
            { content: ' ', styles: { ...numericCellStyle } },
            { content: ' ', styles: { ...numericCellStyle } },
            {
                content: ' ',
                styles: {
                    ...numericCellStyle,
                    halign: numProducts > 1 ? 'center' : 'right'
                }
            }
        ]);

        if (showSafta && isLastProduct && hasFreight && numProducts > 1) {
            tableBody.push([
                {
                    content: "THE CERTIFICATE OF ORIGIN UNDER SAFTA\n(South Asian Free Trade Area)",
                    colSpan: 1,
                    styles: {
                        halign: 'center',
                        valign: 'middle',
                        fontStyle: 'bold',
                        fontSize: 9,
                        cellPadding: { top: 3, bottom: 3 }
                    }
                },
                { content: '', styles: { halign: 'center' } },
                { content: '', styles: { halign: 'center' } },
                { content: '', styles: { halign: 'center' } }
            ]);
            saftaRowIndex = tableBody.length - 1;
        }
    });

    if (productsList.length > 1) {
        const descColWidth = contentWidth - 76;
        const descFontSize = certFontSize;
        let exactDescHeight = getDescriptionBlockHeight(descFontSize, descColWidth - 6) + 5;
        let descRowHeight = exactDescHeight + 4;
        if (record.productsImage) {
            try {
                const imgProps = doc.getImageProperties(record.productsImage);
                const imgWidth = descColWidth - 6;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                descRowHeight = exactDescHeight + imgHeight + 5;
            } catch (e) {
                descRowHeight = exactDescHeight + 50;
            }
        }
        tableBody.push([
            {
                content: ' ',
                colSpan: 1,
                styles: {
                    halign: 'left',
                    fontStyle: 'normal',
                    fontSize: descFontSize,
                    cellPadding: { top: 2, left: 2, right: 2, bottom: 2 },
                    minCellHeight: descRowHeight,
                    valign: 'top'
                }
            },
            { content: '', styles: { halign: 'center' } },
            { content: '', styles: { halign: 'center' } },
            { content: '', styles: { halign: 'center' } }
        ]);
    }

    autoTable(doc, {
        startY: y,
        rowPageBreak: 'avoid',
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
                { content: 'Rate USD\nPer KG.', styles: { fillColor: [235, 235, 235] } },
                { content: 'Amount\nUSD', styles: { fillColor: [235, 235, 235] } }
            ]
        ],
        body: tableBody,
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 26, halign: 'center' },
            3: { cellWidth: 25, halign: numProducts > 1 ? 'center' : 'right' },
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
                const align = colIndex === 3 && numProducts === 1 ? 'right' : 'center';
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
                const isMulti = productsList.length > 1;
                const numProds = productsList.length;
                let drawY = pIdx === 0 ? cellY - 1 : cellY + 5;
                let pNameSize = 20, hsCodeFS = 12, nameGap = 7.5;
                if (numProds === 2) {
                    pNameSize = 14; hsCodeFS = 11; nameGap = 6.5;
                } else if (numProds >= 3) {
                    pNameSize = 12; hsCodeFS = 10; nameGap = 5.5;
                }

                doc.setFont("helvetica", "bold");
                doc.setFontSize(pNameSize);
                doc.text(pName, centerX, drawY, { align: 'center' });

                const pWidth = doc.getTextWidth(pName);
                doc.setLineWidth(0.3);
                doc.line(centerX - pWidth / 2, drawY + 1.5, centerX + pWidth / 2, drawY + 1.5);
                doc.setLineWidth(0.1);

                drawY += nameGap;

                doc.setFontSize(hsCodeFS);
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
                const hasFreight = prod.freight && parseFloat(prod.freight) > 0;
                const shouldDrawSaftaInside = showSafta && pIdx === productsList.length - 1 && (!hasFreight || productsList.length === 1);
                if (shouldDrawSaftaInside) {
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

                if (productsList.length === 1) {
                    let descY = drawY + 8;
                    let endY = drawDescriptionBlock(cellX + 3, descY, certFontSize, cellWidth - 6);

                    if (record.productsImage) {
                        try {
                            const imgProps = doc.getImageProperties(record.productsImage);
                            const imgWidth = cellWidth - 6;
                            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                            doc.addImage(record.productsImage, imgProps.fileType || 'PNG', cellX + 3, endY + 2, imgWidth, imgHeight);
                        } catch (e) {
                            console.error('Error drawing productsImage in single-row cell:', e);
                        }
                    }
                }

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
            }

            if (data.section === 'body' && data.column.index === 0 && data.row.index === tableBody.length - 1 && productsList.length > 1) {
                const cellX = data.cell.x;
                const cellY = data.cell.y;
                const cellWidth = data.cell.width;
                let descY = cellY + 5;
                let endY = drawDescriptionBlock(cellX + 3, descY, certFontSize, cellWidth - 6);

                if (record.productsImage) {
                    try {
                        const imgProps = doc.getImageProperties(record.productsImage);
                        const imgWidth = cellWidth - 6;
                        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                        doc.addImage(record.productsImage, imgProps.fileType || 'PNG', cellX + 3, endY - 2, imgWidth, imgHeight);
                    } catch (e) {
                        console.error('Error drawing productsImage in multi-row cell:', e);
                    }
                }
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

            if (data.section === 'body' && saftaRowIndex >= 0 && (data.row.index === saftaRowIndex || data.row.index === saftaRowIndex + 1)) {
                const borderY = data.row.index === saftaRowIndex ? data.cell.y + data.cell.height : data.cell.y;
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.5);
                doc.line(data.cell.x + 0.5, borderY, data.cell.x + data.cell.width - 0.5, borderY);
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.1);
                doc.line(data.cell.x, borderY - 1, data.cell.x, borderY + 1);
                doc.line(data.cell.x + data.cell.width, borderY - 1, data.cell.x + data.cell.width, borderY + 1);
            }
        },
        didDrawPage: (data) => {
            y = data.cursor.y;
        }
    });
    y = doc.lastAutoTable.finalY;

    // Ensure all content fits on the page by checking remaining space for the footer
    const footerMinSpace = 40; // minimum space needed for Amount Chargeable + Declaration + Signature
    if (pageHeight - margin - y < footerMinSpace) {
        doc.addPage();
        // Redraw page border for the new page
        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.rect(margin, margin + 8, contentWidth, pageHeight - (2 * margin) - 8);
        y = margin + 10;
    }

    // Total Row
    let grandTotal = 0;
    productsList.forEach(prod => {
        const amt = parseFloat(prod.amount) || 0;
        const frt = parseFloat(prod.totalFreight) || 0;
        grandTotal += amt + frt;
    });
    if (grandTotal === 0 && record.totalAmount) {
        grandTotal = parseFloat(record.totalAmount) || 0;
    }

    const boxBottom = margin + 10 + (pageHeight - (2 * margin) - 10);
    const sigColWidth = 58;
    const sigColX = pageWidth - margin - sigColWidth;
    const totalY = y;

    const amountLabel = "Amount Chargeable (In words) USD ";
    const wordsVal = String(record.totalAmountWords || numberToWordsUSD(grandTotal)).replace(/\s+/g, ' ').trim();
    const declText = "We declare that this invoice-cum-packing list shows the actual price and details of the goods described and that all particulars are true and correct.\nWe do certify that we have no local agent in Bangladesh and the quoted price is net and no commission is payable.";
    const declTextWidth = sigColX - margin - 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const totalVal = grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const totalReserved = doc.getTextWidth(totalVal) + 10;
    const amountLineWidth = contentWidth - totalReserved;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const labelWidth = doc.getTextWidth(amountLabel);
    const wordsMaxWidth = amountLineWidth - labelWidth - 4;
    const wordsFontSize = fitFontSizeOneLine(doc, wordsVal, wordsMaxWidth, 10.5, 6.5, 'bold');

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const declLines = doc.splitTextToSize(declText, declTextWidth);
    const declLineH = 3.3;
    const amountRowHeight = 6;
    const amountLineY = totalY + (amountRowHeight / 2) + 1.2;
    const declY = totalY + amountRowHeight;
    const declBoxHeight = boxBottom - declY;
    const sigImageHeight = 18; // standard system-wide signature height
    const sigImgY = declY + (declBoxHeight - sigImageHeight) / 2;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.line(margin, totalY, pageWidth - margin, totalY);
    doc.line(margin, declY, pageWidth - margin, declY);
    doc.line(margin, boxBottom, pageWidth - margin, boxBottom);
    doc.line(margin, totalY, margin, boxBottom);
    doc.line(pageWidth - margin, totalY, pageWidth - margin, boxBottom);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(amountLabel, margin + 2, amountLineY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(wordsFontSize);
    const wordsX = margin + 2 + labelWidth;
    let wordsWidth = doc.getTextWidth(wordsVal);
    const wordsOpts = { baseline: 'alphabetic' };
    if (wordsWidth > wordsMaxWidth && wordsVal.length > 1) {
        wordsOpts.charSpace = (wordsMaxWidth - wordsWidth) / (wordsVal.length - 1);
    }
    doc.text(wordsVal, wordsX, amountLineY, wordsOpts);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(totalVal, pageWidth - margin - 3, amountLineY, { align: 'right' });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DECLARATION:", margin + 2, declY + 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    declLines.forEach((line, idx) => {
        doc.text(line, margin + 2, declY + 7.5 + (idx * declLineH));
    });

    const sigImageWidth = sigColWidth - 10;
    const sigImageX = sigColX + 5;
    const exporterSignature = record.exporterSignature || pi?.exporterSignature || exporter?.signature || '';

    if (exporterSignature) {
        try {
            doc.addImage(exporterSignature, 'PNG', sigImageX, sigImgY, sigImageWidth, sigImageHeight);
        } catch (e) {
            console.error('Error adding exporter signature to PDF:', e);
        }
    }

    const enrichedProductsList = productsList.map((prod, idx) => {
        const piProd = pi?.productsList?.find(p => (p.productName || '').trim().toLowerCase() === (prod.productName || '').trim().toLowerCase()) || pi?.productsList?.[idx];
        return {
            ...prod,
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
    const trPiGrandTotal = (grandTotal > 0 ? grandTotal : '') || pi?.grandTotal || record.totalAmount || record.grandTotal || '';

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
        packingType: record.packingType || pi?.packingType || ''
    }, trSetups);

    // Open in new tab
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
