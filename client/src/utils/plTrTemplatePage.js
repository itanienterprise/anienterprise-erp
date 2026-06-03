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

/** Converts a numeric string like '03' or '05' to its English word equivalent in uppercase.
 *  Supports 0-99, which covers all practical demurrage/days values. */
const numberToWords = (numStr) => {
    const ones = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
        'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
        'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const n = parseInt(numStr, 10);
    if (isNaN(n) || n < 0 || n > 99) return String(numStr).toUpperCase();
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
};

/** Overlay positions for Jain Parivahan TR template (ratios of page). */
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
    weightActualX: 0.580,
    weightStartY: 0.680,
    weightLineSpacing: 0.038,
    freightAmountX: 0.780,
    freightAmountY: 0.690,
    packagesX: 0.09,
    packagesY: 0.720,
    descMaxWidth: 0.40,
};

/** Overlay positions for Rinku Commercial Carrier TR template (ratios of page).
 *  All values are independent — adjust each ratio to match the Rinku form fields. */
const RINKU_TEMPLATE_LAYOUT = {
    valueX: 0.650,
    noY: 0.425,
    dateY: 0.450,
    valueMaxWidth: 0.2,
    consignorNameX: 0.25,
    consignorNameY: 0.495,
    consignorAddressX: 0.10,
    consignorAddressY: 0.525,
    consignorAddressMaxWidth: 0.5,  // wrap address across 2 lines on Rinku form (~134mm)
    consigneeBankX: 0.27,
    consigneeBankY: 0.565,
    importerInfoX: 0.10,
    importerInfoY: 0.595,
    consignorMaxWidth: 0.72,
    fromX: 0.650,
    fromY: 0.517,
    toX: 0.635,
    toY: 0.590,
    descLeftX: 0.10,
    descRightX: 0.29,
    descY: 0.690,
    valueFieldX: 0.07,
    valueFieldY: 0.930,
    weightActualX: 0.505,
    weightStartY: 0.690,
    weightLineSpacing: 0.038,
    freightAmountX: 0.665,
    freightAmountY: 0.700,
    packagesX: 0.065,
    packagesY: 0.720,
    demurrageX: 0.20,
    demurrageY: 0.165,
    daysX: 0.18,
    daysY: 0.195,
    descMaxWidth: 0.38,
};

/**
 * Returns the correct layout config for a given TR carrier name.
 * Add more carriers here as needed.
 */
const getLayout = (trName) => {
    const name = (trName || '').trim().toLowerCase();
    if (name.includes('rinku')) return RINKU_TEMPLATE_LAYOUT;
    return TR_TEMPLATE_LAYOUT;
};

const drawConsignmentNoteFields = (doc, record, pageX, pageY, pageWidth, pageHeight, trName) => {
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

    const layout = getLayout(trName);

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

            if (layout.consignorAddressMaxWidth) {
                // Rinku: use maxWidth so jsPDF wraps the address to ~2 lines
                const addrMaxWidth = pageWidth * layout.consignorAddressMaxWidth;
                const cleanAddress = exporterAddress
                    .split(/[\r\n]+/)
                    .map(line => line.trim())
                    .filter(Boolean)
                    .join(' ')
                    .replace(/\s+/g, ' ');
                doc.text(cleanAddress, addrX, addrY, { maxWidth: addrMaxWidth, charSpace: -0.15, lineHeightFactor: 1.5 });
            } else {
                // Default (Jain Parivahan): single line joined with commas
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

        // Draw total bags and bag type in the leftmost column ("Packages")
        let totalBags = 0;
        record.productsList.forEach(prod => {
            totalBags += parseInt(prod.bagCount) || 0;
        });

        if (totalBags > 0) {
            const pX = pageX + pageWidth * layout.packagesX;
            const pY = pageY + pageHeight * layout.packagesY;
            const pLS = pageHeight * 0.025; // Snug vertical spacing for packages

            const bagsFontSize = Math.max(11, Math.round(pageHeight * 0.055));
            applyAlgerianFont(doc, bagsFontSize);
            doc.setTextColor(0, 0, 0);

            // Format bags number (e.g. "3,780")
            const bagsText = `${totalBags.toLocaleString('en-US')}`;
            doc.text(bagsText, pX, pY, { align: 'center', charSpace: -0.15 });

            const rawBagType = String(record?.packingType || '').trim().toUpperCase();
            const bagTypes = rawBagType
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);

            let currentPackY = pY + pLS;
            if (bagTypes.length > 0) {
                const typeFontSize = Math.max(9, Math.round(pageHeight * 0.045));
                applyAlgerianFont(doc, typeFontSize);
                bagTypes.forEach((type, idx) => {
                    const isLast = idx === bagTypes.length - 1;
                    const lineText = isLast ? type : `${type} /`;
                    doc.text(lineText, pX, currentPackY, { align: 'center', charSpace: -0.15 });
                    currentPackY += pLS;
                });
            }
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
            let currentLineY = startY + 3 * lineSpacing;

            const maxWidth = pageWidth * (layout.descMaxWidth || 0.40);

            const drawWrappedLine = (text) => {
                if (!text) return;
                const lines = doc.splitTextToSize(text, maxWidth);
                lines.forEach(line => {
                    doc.text(line, x, currentLineY, { charSpace: -0.15 });
                    currentLineY += lineSpacing;
                });
            };

            const lcText = `L.C NO- ${lcNo} DATE: ${lcDate} BANK BIN: ${bankBin}`;
            drawWrappedLine(lcText);

            if (bankName) {
                const bankText = `OF ${bankName}${branchName ? `, ${branchName}` : ''}`;
                drawWrappedLine(bankText);
            }

            const ircNo = String(record?.ircNo || '').trim().toUpperCase();
            if (ircNo) {
                const ircText = `IMPORTER I.R.C NO- ${ircNo}`;
                drawWrappedLine(ircText);
            }

            const tinNo = String(record?.tinNo || '').trim().toUpperCase();
            const binNo = String(record?.binNo || '').trim().toUpperCase();
            if (tinNo || binNo) {
                const tinBinText = `IMPORTER'S TIN: ${tinNo} & BIN: ${binNo}`;
                drawWrappedLine(tinBinText);
            }

            const piNo = String(record?.piNo || '').trim().toUpperCase();
            const piDate = String(record?.piDate || '').trim().toUpperCase();
            if (piNo || piDate) {
                const piText = `PROFORMA INVOICE NO: ${piNo} DT: ${piDate}`;
                drawWrappedLine(piText);
            }

            const coverNote = String(record?.coverNote || '').trim().toUpperCase();
            if (coverNote) {
                const coverNoteText = `UNDER INSURANCE COVER NOTE NO: ${coverNote}`;
                drawWrappedLine(coverNoteText);
            }

            const amendmentLine = String(record?.amendmentLine || '').trim().toUpperCase();
            if (amendmentLine) {
                drawWrappedLine(amendmentLine);
            }
        }
    }

    // Draw Net Weight and Gross Weight in the Weight / Actual column
    if (Array.isArray(record?.productsList) && record.productsList.length > 0) {
        const hasNet = record.productsList.some(p => parseFloat(p.netWeight) > 0);
        const hasGross = record.productsList.some(p => parseFloat(p.grossWeight) > 0);

        if (hasNet || hasGross) {
            const wFontSize = Math.max(8.5, Math.round(pageHeight * 0.042));
            applyAlgerianFont(doc, wFontSize);
            doc.setTextColor(0, 0, 0);

            const wX = pageX + pageWidth * layout.weightActualX;
            const wStartY = pageY + pageHeight * layout.weightStartY;
            const wLS = pageHeight * layout.weightLineSpacing;

            let wY = wStartY;

            if (hasNet) {
                doc.text('NET WEIGHT (KG)', wX, wY, { align: 'center', charSpace: -0.15 });
                wY += wLS * 0.7;

                const wLargeFontSize = Math.max(11, Math.round(pageHeight * 0.055));
                applyAlgerianFont(doc, wLargeFontSize);

                record.productsList.forEach(prod => {
                    const netW = parseFloat(prod.netWeight) || 0;
                    if (netW > 0) {
                        doc.text(netW.toLocaleString('en-IN', { minimumFractionDigits: 2 }), wX, wY, { align: 'center', charSpace: -0.15 });
                        wY += wLS * 0.7;
                    }
                });

                applyAlgerianFont(doc, wFontSize);
                wY += wLS * 0.5; // Gap before gross weight label
            }

            if (hasGross) {
                doc.text('GROSS WEIGHT (KG)', wX, wY, { align: 'center', charSpace: -0.15 });
                wY += wLS * 0.7;

                const wLargeFontSize = Math.max(11, Math.round(pageHeight * 0.055));
                applyAlgerianFont(doc, wLargeFontSize);

                record.productsList.forEach(prod => {
                    const grossW = parseFloat(prod.grossWeight) || 0;
                    if (grossW > 0) {
                        doc.text(grossW.toLocaleString('en-IN', { minimumFractionDigits: 2 }), wX, wY, { align: 'center', charSpace: -0.15 });
                        wY += wLS * 0.7;
                    }
                });
            }
        }
    }

    // Draw total freight in Amount to Pay / Rs. column
    if (Array.isArray(record?.productsList) && record.productsList.length > 0) {
        const hasAnyFreight = record.productsList.some(prod => {
            const frt = parseFloat(prod.totalFreight) || parseFloat(prod.freight) || 0;
            return frt > 0;
        });

        if (hasAnyFreight) {
            const fSmall = Math.max(11, Math.round(pageHeight * 0.055));
            applyAlgerianFont(doc, fSmall);
            doc.setTextColor(0, 0, 0);

            const fX = pageX + pageWidth * layout.freightAmountX;
            let fY = pageY + pageHeight * layout.freightAmountY;
            const fLS = pageHeight * 0.038;

            record.productsList.forEach((prod, idx) => {
                const frt = parseFloat(prod.totalFreight) || parseFloat(prod.freight) || 0;
                const formatted = frt.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                const isLast = idx === record.productsList.length - 1;
                // Append " &" to the line if it is not the last freight item in the breakdown
                const lineText = isLast ? formatted : `${formatted} $ &`;
                doc.text(lineText, fX, fY, { charSpace: -0.15 });
                fY += fLS * 0.85;
            });

            // Draw "FREIGHT" line under the values
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

    // Draw Demurrage and Days (Rinku only)
    if (layout.demurrageX && layout.daysX) {
        const demurrageVal = String(record?.demurrage || '03').trim().padStart(2, '0');
        const daysVal = String(record?.days || '05').trim().padStart(2, '0');
        const demurrageWord = numberToWords(demurrageVal);
        const daysWord = numberToWords(daysVal);

        const ddFontSize = Math.max(11, Math.round(pageHeight * 0.055));
        applyAlgerianFont(doc, ddFontSize);
        doc.setTextColor(0, 0, 0);

        const dX = pageX + pageWidth * layout.demurrageX;
        const dY = pageY + pageHeight * layout.demurrageY;
        doc.text(`${demurrageVal} (${demurrageWord})`, dX, dY, { charSpace: -0.15 });

        const dayX = pageX + pageWidth * layout.daysX;
        const dayY = pageY + pageHeight * layout.daysY;
        doc.text(`${daysVal} (${daysWord})`, dayX, dayY, { charSpace: -0.15 });
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
        drawConsignmentNoteFields(doc, record, 0, 0, pageWidth, pageHeight, trName);
        return true;
    } catch (e) {
        console.error('Error adding TR template page:', e);
        return false;
    }
};
