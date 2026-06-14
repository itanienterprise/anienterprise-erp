import { ensureAlgerianFont, preloadAlgerianFont } from './algerianFontLoader';

const formatTrDate = (dateString) => {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateString;
    }
};

const applyAlgerianFont = (doc, fontSize) => {
    if (ensureAlgerianFont(doc)) {
        doc.setFont('Algerian', 'normal');
        doc.setFontSize(fontSize);
        return true;
    }
    console.warn('[TR PDF] Using helvetica fallback — Algerian could not be loaded');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    return false;
};

/** Overlay positions on full-page A4 landscape TR template (ratios of page). */
const TR_TEMPLATE_LAYOUT = {
    valueX: 0.756,
    noY: 0.422,
    dateY: 0.447,
    valueMaxWidth: 0.2,
    consignorNameX: 0.30,
    consignorNameY: 0.505,
    consignorAddressX: 0.06,
    consignorAddressY: 0.527,
    consigneeBankX: 0.28,
    consigneeBankY: 0.557,
    importerInfoX: 0.06,
    importerInfoY: 0.587,
    consignorMaxWidth: 0.72,
    fromX: 0.735,
    fromY: 0.517,
    toX: 0.735,
    toY: 0.587,
    descLeftX: 0.13,
    descRightX: 0.31,
    descY: 0.680,
    valueFieldX: 0.18,
    valueFieldY: 0.895,
    weightActualX: 0.535,
    weightStartY: 0.680,
    weightLineSpacing: 0.038,
    freightAmountX: 0.780,
    freightAmountY: 0.690
};

const drawConsignmentNoteFields = (doc, record, pageX, pageY, pageWidth, pageHeight) => {
    const trNo = String(record?.trNumber || '').trim();
    const trDate = formatTrDate(record?.trDate);
    const exporterName = String(record?.exporterName || '').trim();
    const exporterAddress = String(record?.exporterAddress || '').trim();
    const bankName = String(record?.bankName || '').trim();
    const branchName = String(record?.branchName || '').trim();
    const partyName = String(record?.partyName || '').trim();
    const partyAddress = String(record?.partyAddress || '').trim();
    const placeOfReceipt = String(record?.placeOfReceipt || '').trim();
    const portOfDischarge = String(record?.portOfDischarge || record?.port || '').trim();

    if (!trNo && !trDate && !exporterName && !exporterAddress && !bankName && !partyName && !placeOfReceipt && !portOfDischarge) return;

    const layout = TR_TEMPLATE_LAYOUT;

    if (trNo || trDate) {
        const valueX = pageX + pageWidth * layout.valueX;
        const valueMaxWidth = pageWidth * layout.valueMaxWidth;
        const noY = pageY + pageHeight * layout.noY;
        const dateY = pageY + pageHeight * layout.dateY;

        const fontSize = Math.max(12, Math.round(pageHeight * 0.065));
        applyAlgerianFont(doc, fontSize);
        doc.setTextColor(0, 0, 0);

        if (trNo) {
            doc.text(trNo, valueX, noY, { maxWidth: valueMaxWidth });
        }
        if (trDate) {
            doc.text(trDate, valueX, dateY, { maxWidth: valueMaxWidth });
        }
    }

    if (exporterName || exporterAddress) {
        doc.setTextColor(0, 0, 0);

        if (exporterName) {
            const nameFontSize = Math.max(11, Math.round(pageHeight * 0.055));
            applyAlgerianFont(doc, nameFontSize);
            const nameX = pageX + pageWidth * layout.consignorNameX;
            const nameY = pageY + pageHeight * layout.consignorNameY;
            const nameMaxWidth = pageWidth * layout.consignorMaxWidth;
            doc.text(exporterName, nameX, nameY, { maxWidth: nameMaxWidth, charSpace: -0.15 });
        }

        if (exporterAddress) {
            const addrFontSize = Math.max(9, Math.round(pageHeight * 0.045));
            applyAlgerianFont(doc, addrFontSize);
            const addrX = pageX + pageWidth * layout.consignorAddressX;
            const addrY = pageY + pageHeight * layout.consignorAddressY;

            const cleanAddress = exporterAddress
                .split(/[\r\n]+/)
                .map(line => line.trim())
                .filter(Boolean)
                .join(', ')
                .replace(/,\s*,/g, ',')
                .replace(/\s+/g, ' ');

            doc.text(cleanAddress, addrX, addrY, { charSpace: -0.15 });
        }
    }

    if (bankName || partyName) {
        doc.setTextColor(0, 0, 0);
        const detailFontSize = Math.max(9, Math.round(pageHeight * 0.045));
        applyAlgerianFont(doc, detailFontSize);

        if (bankName) {
            const consigneeText = `TO THE ORDER OF ${bankName.toUpperCase()}${branchName ? `, ${branchName.toUpperCase()}` : ''}`;
            const bankX = pageX + pageWidth * layout.consigneeBankX;
            const bankY = pageY + pageHeight * layout.consigneeBankY;
            doc.text(consigneeText, bankX, bankY, { charSpace: -0.15 });
        }

        if (partyName) {
            const cleanImporterAddress = partyAddress
                .split(/[\r\n]+/)
                .map(line => line.trim())
                .filter(Boolean)
                .join(', ')
                .replace(/,\s*,/g, ',')
                .replace(/\s+/g, ' ');

            const importerText = `${partyName.toUpperCase()}${cleanImporterAddress ? `, ${cleanImporterAddress.toUpperCase()}` : ''}`;
            const impX = pageX + pageWidth * layout.importerInfoX;
            const impY = pageY + pageHeight * layout.importerInfoY;
            doc.text(importerText, impX, impY, { charSpace: -0.15 });
        }
    }

    if (placeOfReceipt || portOfDischarge) {
        doc.setTextColor(0, 0, 0);
        const fromToFontSize = Math.max(11, Math.round(pageHeight * 0.055));
        applyAlgerianFont(doc, fromToFontSize);

        if (placeOfReceipt) {
            const fromText = placeOfReceipt.toUpperCase() !== 'BY ROAD'
                ? `${placeOfReceipt.toUpperCase()}, INDIA`
                : 'INDIA';
            const fromX = pageX + pageWidth * layout.fromX;
            const fromY = pageY + pageHeight * layout.fromY;
            doc.text(fromText, fromX, fromY, { charSpace: -0.15 });
        }

        if (portOfDischarge) {
            const toText = `${portOfDischarge.toUpperCase()}, BANGLADESH`;
            const toX = pageX + pageWidth * layout.toX;
            const toY = pageY + pageHeight * layout.toY;
            doc.text(toText, toX, toY, { charSpace: -0.15 });
        }
    }

    if (record?.productsList && record.productsList.length > 0) {
        doc.setTextColor(0, 0, 0);

        const drawProduct = (prod, startXRatio) => {
            const name = String(prod.productName || '').trim().toUpperCase();
            const hsIndia = String(prod.hsCodeInd || '').trim().toUpperCase();
            const hsBd = String(prod.hsCode || '').trim().toUpperCase();

            const x = pageX + pageWidth * startXRatio;
            const startY = pageY + pageHeight * layout.descY;
            const lineSpacing = pageHeight * 0.0155; // Snug relative line spacing (~3.67mm)

            // Draw product name in larger font size
            const nameFontSize = Math.max(13, Math.round(pageHeight * 0.065));
            applyAlgerianFont(doc, nameFontSize);
            doc.text(name, x, startY, { charSpace: -0.15 });

            // Draw HS codes in smaller font size, displaying only if a value is present
            const hsFontSize = Math.max(8.5, Math.round(pageHeight * 0.042)); // Reduced size (~8.8pt)
            applyAlgerianFont(doc, hsFontSize);

            let currentY = startY + lineSpacing;
            if (hsIndia) {
                doc.text(`H.S. CODE NO. ${hsIndia} (INDIA)`, x, currentY, { charSpace: -0.15 });
                currentY += lineSpacing;
            }
            if (hsBd) {
                doc.text(`H.S. CODE NO. ${hsBd} (BD)`, x, currentY, { charSpace: -0.15 });
            }
        };

        // Draw 1st product on the left
        drawProduct(record.productsList[0], layout.descLeftX);

        // If there are multiple products, draw the 2nd product on the right
        if (record.productsList.length > 1) {
            drawProduct(record.productsList[1], layout.descRightX);
        }

        // Draw L/C details under HS code
        const lcNo = String(record?.lcNo || '').trim().toUpperCase();
        const lcDate = String(record?.lcDate || '').trim().toUpperCase();
        const bankBin = String(record?.bankBin || '000321414-0101').trim().toUpperCase();
        const bankName = String(record?.bankName || '').trim().toUpperCase();
        const branchName = String(record?.branchName || '').trim().toUpperCase();

        if (lcNo || lcDate) {
            const lcFontSize = Math.max(8.5, Math.round(pageHeight * 0.042)); // Reduced size (~8.8pt)
            applyAlgerianFont(doc, lcFontSize);
            doc.setTextColor(0, 0, 0);

            const x = pageX + pageWidth * layout.descLeftX;
            const startY = pageY + pageHeight * layout.descY;
            const lineSpacing = pageHeight * 0.0155; // Snug relative line spacing (~3.67mm)
            const lcY = startY + 3 * lineSpacing;

            const lcText = `L.C NO- ${lcNo} DATE: ${lcDate} BANK BIN: ${bankBin}`;
            doc.text(lcText, x, lcY, { charSpace: -0.15 });

            let currentLineY = lcY + lineSpacing;
            if (bankName) {
                const bankText = `OF ${bankName}${branchName ? `, ${branchName}` : ''}`;
                doc.text(bankText, x, currentLineY, { charSpace: -0.15 });
                currentLineY += lineSpacing;
            }

            const ircNo = String(record?.ircNo || '').trim().toUpperCase();
            if (ircNo) {
                const ircText = `IMPORTER I.R.C NO- ${ircNo}`;
                doc.text(ircText, x, currentLineY, { charSpace: -0.15 });
                currentLineY += lineSpacing;
            }

            const tinNo = String(record?.tinNo || '').trim().toUpperCase();
            const binNo = String(record?.binNo || '').trim().toUpperCase();
            if (tinNo || binNo) {
                const tinBinText = `IMPORTER'S TIN: ${tinNo} & BIN: ${binNo}`;
                doc.text(tinBinText, x, currentLineY, { charSpace: -0.15 });
                currentLineY += lineSpacing;
            }

            const piNo = String(record?.piNo || '').trim().toUpperCase();
            const piDate = String(record?.piDate || '').trim().toUpperCase();
            if (piNo || piDate) {
                const piText = `PROFORMA INVOICE NO: ${piNo} DT: ${piDate}`;
                doc.text(piText, x, currentLineY, { charSpace: -0.15 });
                currentLineY += lineSpacing;
            }

            const coverNote = String(record?.coverNote || '').trim().toUpperCase();
            if (coverNote) {
                const coverNoteText = `UNDER INSURANCE COVER NOTE NO: ${coverNote}`;
                doc.text(coverNoteText, x, currentLineY, { charSpace: -0.15 });
            }
        }
    }

    // Draw Net Weight and Gross Weight in the Weight / Actual column
    if (Array.isArray(record?.productsList) && record.productsList.length > 0) {
        let totalNetWeight = 0;
        let totalGrossWeight = 0;
        record.productsList.forEach(prod => {
            totalNetWeight += parseFloat(prod.netWeight) || 0;
            totalGrossWeight += parseFloat(prod.grossWeight) || 0;
        });

        if (totalNetWeight > 0 || totalGrossWeight > 0) {
            const wFontSize = Math.max(8.5, Math.round(pageHeight * 0.042));
            applyAlgerianFont(doc, wFontSize);
            doc.setTextColor(0, 0, 0);

            const wX = pageX + pageWidth * layout.weightActualX;
            const wStartY = pageY + pageHeight * layout.weightStartY;
            const wLS = pageHeight * layout.weightLineSpacing;

            let wY = wStartY;

            if (totalNetWeight > 0) {
                doc.text('NET WEIGHT(KG)', wX, wY, { charSpace: -0.15 });
                wY += wLS * 0.7;
                const wLargeFontSize = Math.max(11, Math.round(pageHeight * 0.055));
                applyAlgerianFont(doc, wLargeFontSize);
                doc.text(totalNetWeight.toLocaleString('en-IN', { minimumFractionDigits: 2 }), wX, wY, { charSpace: -0.15 });
                applyAlgerianFont(doc, wFontSize);
                wY += wLS * 1.1; // gap before gross weight
            }

            if (totalGrossWeight > 0) {
                doc.text('GROSS WEIGHT(KG)', wX, wY, { charSpace: -0.15 });
                wY += wLS * 0.7;
                const wLargeFontSize = Math.max(11, Math.round(pageHeight * 0.055));
                applyAlgerianFont(doc, wLargeFontSize);
                doc.text(totalGrossWeight.toLocaleString('en-IN', { minimumFractionDigits: 2 }), wX, wY, { charSpace: -0.15 });
            }
        }
    }

    // Draw total freight in Amount to Pay / Rs. column
    if (Array.isArray(record?.productsList) && record.productsList.length > 0) {
        let totalFreight = 0;
        record.productsList.forEach(prod => {
            totalFreight += parseFloat(prod.totalFreight) || parseFloat(prod.freight) || 0;
        });

        if (totalFreight > 0) {
            const fSmall = Math.max(11, Math.round(pageHeight * 0.055));
            applyAlgerianFont(doc, fSmall);
            doc.setTextColor(0, 0, 0);

            const fX = pageX + pageWidth * layout.freightAmountX;
            let fY = pageY + pageHeight * layout.freightAmountY;
            const fLS = pageHeight * 0.038;

            // Line 1: value &
            const freightFormatted = totalFreight.toLocaleString('en-IN', { minimumFractionDigits: 2 });
            doc.text(`${freightFormatted} &`, fX, fY, { charSpace: -0.15 });
            fY += fLS * 0.8;
            // Line 2: FREIGHT
            doc.text('FREIGHT', fX, fY, { charSpace: -0.15 });
        }
    }

    // Compute grand total from products list as a solid fallback
    let computedTotal = 0;
    if (Array.isArray(record?.productsList)) {
        record.productsList.forEach(prod => {
            const qty = parseFloat(prod.quantity) || 0;
            const rate = parseFloat(prod.rate) || 0;
            const amt = qty * rate;
            const frt = parseFloat(prod.freight) || 0;
            computedTotal += amt + frt;
        });
    }

    // Draw PI Grand Total in the bottom-left "Value" field
    const piGrandTotal = record?.piGrandTotal || record?.totalAmount || (computedTotal > 0 ? computedTotal : '') || record?.grandTotal;
    if (piGrandTotal !== undefined && piGrandTotal !== null && piGrandTotal !== '') {
        let cleanVal = String(piGrandTotal).trim();
        if (cleanVal.startsWith('$')) {
            cleanVal = cleanVal.slice(1).trim();
        }
        const parsed = parseFloat(cleanVal.replace(/,/g, ''));
        let formattedVal = '';
        if (!isNaN(parsed)) {
            formattedVal = parsed.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        } else {
            formattedVal = cleanVal;
        }

        if (formattedVal) {
            const valueFontSize = Math.max(13, Math.round(pageHeight * 0.065)); // Increased size (~13.6pt)
            applyAlgerianFont(doc, valueFontSize);
            doc.setTextColor(0, 0, 0);

            const valX = pageX + pageWidth * layout.valueFieldX;
            const valY = pageY + pageHeight * layout.valueFieldY;
            const valueText = `$ ${formattedVal}`;
            doc.text(valueText, valX, valY, { charSpace: -0.15 });
        }
    }
};

/**
 * Appends an A4 landscape page with TR template image filling the full page.
 */
export const appendTrTemplatePage = async (doc, record, trSetups = []) => {
    const trName = (record?.trName || '').trim().toLowerCase();
    if (!trName || !Array.isArray(trSetups) || trSetups.length === 0) {
        return false;
    }

    const setup = trSetups.find(
        (s) => (s.name || '').trim().toLowerCase() === trName
    );
    const trFormat = setup?.trFormat;
    if (!trFormat) {
        return false;
    }

    try {
        await preloadAlgerianFont();

        doc.addPage('a4', 'l');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgProps = doc.getImageProperties(trFormat);
        const fileType = imgProps.fileType || 'PNG';

        doc.addImage(trFormat, fileType, 0, 0, pageWidth, pageHeight);
        drawConsignmentNoteFields(doc, record, 0, 0, pageWidth, pageHeight);
        return true;
    } catch (e) {
        console.error('Error adding TR template page:', e);
        return false;
    }
};
