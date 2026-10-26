import jsPDF from 'jspdf';
import { renderNonIslamiBankApplication, generateNonIslamiBankApplicationPDF } from './nonIslamiBankApplicationGenerator';

// Helper function for date formatting (DD/MM/YYYY)
const formatDate = (dateStr) => {
    if (!dateStr) {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Format Constants
 */
export const APPLICATION_FORMATS = {
    ISLAMI_BANK: 'Islami Bank Bangladesh PLC',
    NON_ISLAMI_BANK: 'Non-Islami Bank Bangladesh PLC'
};

// Re-export non-Islami bank generator functions
export { renderNonIslamiBankApplication, generateNonIslamiBankApplicationPDF };

/**
 * Check if the record is intended for Islami Bank Bangladesh PLC
 * @param {Object} record - PI Record data
 * @returns {boolean}
 */
export const isIslamiBank = (record) => {
    if (!record) return false;
    const formatName = (record.applicationFormat || '').toLowerCase().trim();
    if (formatName.includes('non-islami') || formatName.includes('general')) {
        return false;
    }
    if (formatName.includes('islami')) {
        return true;
    }
    const bankName = (record.bankName || '').toLowerCase().trim();
    return bankName.includes('islami') || bankName.includes('ibbl');
};

/**
 * Render Format: Islami Bank Bangladesh PLC (Default Format)
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record data
 */
export const renderIslamiBankApplication = (doc, record) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 25.4; // 1 inch left margin
    const marginRight = 25.4; // 1 inch right margin
    const contentWidth = pageWidth - marginLeft - marginRight; // 159.2 mm
    let currentY = 70; // Increased top margin for company letterhead pad

    // Set font to Times
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);

    // Recipient Section
    doc.text('To,', marginLeft, currentY);
    currentY += 6;
    doc.text('Vice President & Branch Head', marginLeft, currentY);
    currentY += 6;

    const bankName = (record.bankName || 'Islami Bank Bangladesh PLC').trim();
    doc.text(`${bankName ? bankName : 'Islami Bank Bangladesh PLC'}.`, marginLeft, currentY);
    currentY += 6;

    const bankBranch = (record.bankBranch || '').trim();
    doc.text(`${bankBranch ? bankBranch : '............................................................'}`, marginLeft, currentY);
    currentY += 10;

    // Values extraction
    const grandTotalNum = parseFloat(record.grandTotal || 0);
    const formattedGrandTotal = grandTotalNum > 0
        ? grandTotalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : (record.grandTotal ? String(record.grandTotal) : '0.00');

    const isMtdr = record.mtdr === true || record.mtdr === 'true';
    let formattedMargin = '';
    if (isMtdr) {
        const marginNum = parseFloat(record.bankMargin);
        const validMargin = !isNaN(marginNum) ? marginNum : 0;
        const mtdrNum = (record.mtdrValue !== undefined && record.mtdrValue !== null && record.mtdrValue !== '')
            ? parseFloat(record.mtdrValue)
            : Math.max(0, +(100 - validMargin).toFixed(2));
        formattedMargin = `100% (${validMargin}% Cash + ${mtdrNum}% MTDR)`;
    } else {
        let marginVal = (record.bankMargin !== undefined && record.bankMargin !== null && String(record.bankMargin).trim() !== '')
            ? String(record.bankMargin).trim()
            : '';
        if (marginVal && !marginVal.endsWith('%')) {
            marginVal += '%';
        }
        formattedMargin = marginVal || '......%';
    }

    const productsList = record.productsList && record.productsList.length > 0
        ? record.productsList
        : (record.productName ? [{ productName: record.productName, quantity: record.grandTotalQuantity }] : []);
    const validProducts = productsList.filter(p => p && (p.productName || p.product));

    let importItemsText = '';
    if (validProducts.length > 1) {
        // Multi-product: show quantity separately for each product
        const itemsWithQty = validProducts.map(p => {
            const pName = (p.productName || p.product || '').trim();
            const pQtyNum = parseFloat(p.quantity || p.qty || 0);
            const pQtyStr = pQtyNum > 0
                ? `${pQtyNum.toLocaleString('en-US')} kg`
                : (p.quantity || p.qty ? `${p.quantity || p.qty} kg` : '');
            return pQtyStr ? `${pQtyStr} ${pName}` : pName;
        }).filter(Boolean);

        if (itemsWithQty.length > 0) {
            importItemsText = itemsWithQty.join(', ');
        }
    }

    if (!importItemsText) {
        // Single product or fallback
        const qtyNum = parseFloat(record.grandTotalQuantity || validProducts[0]?.quantity || validProducts[0]?.qty || 0);
        const formattedQuantity = qtyNum > 0
            ? `${qtyNum.toLocaleString('en-US')} kg`
            : (record.grandTotalQuantity ? `${record.grandTotalQuantity} kg` : '.................... kg');

        const singleProdName = validProducts[0]?.productName || validProducts[0]?.product || record.productName || 'Goods';
        importItemsText = `${formattedQuantity} ${singleProdName}`;
    }

    const countryOrigin = (record.countryOrigin || 'INDIA').trim();
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const accountNo = (record.bankAccount || record.accountNo || '............................................................').trim();

    // Subject Line (Bold, Justified)
    doc.setFont('times', 'bold');
    const subjectText = `Subject: Regarding establishment of a Letter of Credit (L/C) worth US$ ${formattedGrandTotal} at ${formattedMargin} margin for import of ${importItemsText} from ${countryOrigin}.`;
    const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
    doc.text(subjectText, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (subjectLines.length * 6) + 5;

    // Salutation
    doc.setFont('times', 'normal');
    doc.text('Respected,', marginLeft, currentY);
    currentY += 6;
    doc.text('Assalamu Alaikum.', marginLeft, currentY);
    currentY += 8;

    // Body Paragraph 1 (Justified)
    const p1Text = `Respectfully, I, the proprietor of ${importerName}, am a regular investment account customer and importer of your bank. I have received a proforma invoice for establishment of a Letter of Credit worth US$ ${formattedGrandTotal} from ${countryOrigin} in the name of the company I own. As per the said terms and conditions, I am willing to establish a Letter of Credit at ${formattedMargin} margin within my investment limit. All the charges and margin for issue of Letter of Credit are deposited in my Current Account No. ${accountNo}.`;
    const p1Lines = doc.splitTextToSize(p1Text, contentWidth);
    doc.text(p1Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p1Lines.length * 6) + 6;

    // Body Paragraph 2 (Justified)
    const p2Text = `It is to be noted that I will be discharging the said goods on my own responsibility and storing them in my own warehouse instead of the bank's C&F agent. I have no objection to accepting defective documents.`;
    const p2Lines = doc.splitTextToSize(p2Text, contentWidth);
    doc.text(p2Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p2Lines.length * 6) + 6;

    // Body Paragraph 3 (Justified)
    const p3Text = `Therefore, I request you to take necessary steps for issuing the Letter of Credit.`;
    const p3Lines = doc.splitTextToSize(p3Text, contentWidth);
    doc.text(p3Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p3Lines.length * 6) + 8;

    // Closing
    doc.text('Assalamu Alaikum.', marginLeft, currentY);
    currentY += 6;
    doc.text('Yours faithfully', marginLeft, currentY);
    currentY += 4;

    // Importer Signature Image
    const importerSign = record.partySignature || record.importerSignature;
    if (importerSign) {
        try {
            doc.addImage(importerSign, 'PNG', marginLeft, currentY, 50, 16);
            currentY += 18;
        } catch (e) {
            console.error('Error adding importer signature to Bank Application PDF:', e);
        }
    }
};

/**
 * Parse and determine which amendment options are selected on the record / revision.
 * Supports single selection and multi-selection (combinations of Options 1, 2, 3).
 * 
 * Option 1: Increase of L/C Value and Quantity
 * Option 2: Amendment of Commodity Description and Value
 * Option 3: Extension of Shipment and Expiry Dates
 * 
 * @param {Object} record - PI Record or Revision
 * @returns {{ hasOption1: boolean, hasOption2: boolean, hasOption3: boolean, count: number, isAmendment: boolean }}
 */
export const getAmendmentSelections = (record) => {
    if (!record) return { hasOption1: false, hasOption2: false, hasOption3: false, count: 0, isAmendment: false };

    let typeStr = (record.amendmentType || record.amendment || '').trim();
    if (!typeStr && record.revisions && Array.isArray(record.revisions)) {
        const actualRevs = record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent);
        if (actualRevs.length > 0) {
            const latest = actualRevs[actualRevs.length - 1];
            typeStr = (latest.amendmentType || latest.amendment || '').trim();
        }
    }

    const lower = typeStr.toLowerCase();

    // Option 1: Increase of L/C Value and Quantity
    const hasOption1 = lower.includes('increase of l/c value') ||
        lower.includes('increase in l/c value') ||
        (lower.includes('increase') && lower.includes('value') && lower.includes('quantity'));

    // Option 2: Amendment of Commodity Description and Value
    const hasOption2 = lower.includes('commodity description') ||
        (lower.includes('commodity') && lower.includes('value')) ||
        lower.includes('amendment of commodity');

    // Option 3: Extension of Shipment and Expiry Dates
    const hasOption3 = lower.includes('extension of shipment') ||
        lower.includes('extension of shipment and expiry') ||
        (lower.includes('extension') && (lower.includes('shipment') || lower.includes('expiry') || lower.includes('date')));

    const count = (hasOption1 ? 1 : 0) + (hasOption2 ? 1 : 0) + (hasOption3 ? 1 : 0);

    const isRevision = !!(record.isRevision || (record.reviseNo && record.reviseNo !== 'Original PI') || (record.piNumber && String(record.piNumber).toLowerCase().includes('(revised)')));

    if (count === 0 && isRevision) {
        return {
            hasOption1: true,
            hasOption2: false,
            hasOption3: false,
            count: 1,
            isAmendment: true
        };
    }

    return {
        hasOption1,
        hasOption2,
        hasOption3,
        count,
        isAmendment: count > 0 || isRevision
    };
};

export const isExtensionOfDatesAmendment = (record) => {
    const sel = getAmendmentSelections(record);
    return sel.count === 1 && sel.hasOption3;
};

export const isCommodityDescriptionAndValueAmendment = (record) => {
    const sel = getAmendmentSelections(record);
    return sel.count === 1 && sel.hasOption2;
};

export const isIncreaseLcValueQtyAmendment = (record) => {
    const sel = getAmendmentSelections(record);
    return sel.count === 1 && sel.hasOption1;
};

export const isMergedAmendment = (record) => {
    const sel = getAmendmentSelections(record);
    return sel.count > 1;
};

/**
 * Helper to identify newly added IP details for Option 2
 */
export const getNewlyAddedIpDetails = (record) => {
    const ipRecords = record.ipRecords || [];
    const ipSnapshots = record.ipSnapshots || {};

    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;

    // Get original and current IP numbers
    const rawOrigIps = (record.originalIpNumbers && record.originalIpNumbers.length > 0)
        ? record.originalIpNumbers
        : (origRev?.ipNumbers || (origRev?.ipNumber ? String(origRev.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : []));
    const origIps = rawOrigIps.map(s => String(s).trim());
    const origIpsLower = origIps.map(s => s.toLowerCase());

    const rawCurrentIps = (record.ipNumbers && record.ipNumbers.length > 0)
        ? record.ipNumbers
        : (record.ipNumber ? String(record.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : []);
    const currentIps = rawCurrentIps.map(s => String(s).trim()).filter(Boolean);

    // Get original and current products
    const origProdsList = (record.originalProductsList && record.originalProductsList.length > 0)
        ? record.originalProductsList
        : ((origRev?.productsList && origRev.productsList.length > 0)
            ? origRev.productsList
            : (origRev?.productName ? [{ productName: origRev.productName }] : []));
    const origProds = origProdsList.map(p => (p.productName || p.product || '').trim().toLowerCase()).filter(Boolean);

    const currentProds = (record.productsList && record.productsList.length > 0)
        ? record.productsList
        : (record.productName ? [{ productName: record.productName, quantity: record.grandTotalQuantity }] : []);
    const validCurrentProds = currentProds.filter(p => p && (p.productName || p.product));

    const results = [];

    // 1. Check if there are newly added IP numbers
    const addedIps = currentIps.filter(ip => !origIpsLower.includes(ip.toLowerCase()));

    if (addedIps.length > 0) {
        addedIps.forEach(ipNum => {
            const cleanIpLower = ipNum.toLowerCase();
            const ipRec = ipRecords.find(i => String(i.ipNumber || '').trim().toLowerCase() === cleanIpLower) || ipSnapshots[ipNum] || {};
            const matchingProd = validCurrentProds.find(p =>
                (p._fromIp && String(p._fromIp).trim().toLowerCase() === cleanIpLower) ||
                (p.productName && ipRec.productName && p.productName.toLowerCase().trim() === ipRec.productName.toLowerCase().trim())
            );
            const newlyAddedProd = validCurrentProds.find(p => !origProds.includes((p.productName || p.product || '').trim().toLowerCase()));
            const prodName = matchingProd?.productName || newlyAddedProd?.productName || ipRec.productName || (validCurrentProds.length > 0 ? validCurrentProds[validCurrentProds.length - 1].productName : record.productName) || 'fresh apples';
            const rawDate = ipRec.openingDate || ipRec.date || ipRec.openDate || ipRec.ipDate || record.ipDate || record.date;
            results.push({
                productName: prodName,
                ipNo: ipNum,
                ipDate: formatDate(rawDate)
            });
        });
    }

    // 2. If no new IP numbers found by diff, check if a new product was added to productsList
    if (results.length === 0) {
        const newlyAddedProducts = validCurrentProds.filter(p => !origProds.includes((p.productName || p.product || '').trim().toLowerCase()));
        if (newlyAddedProducts.length > 0) {
            newlyAddedProducts.forEach(prod => {
                const prodIp = prod._fromIp || (currentIps.length > 0 ? currentIps[currentIps.length - 1] : record.ipNumber) || '..........';
                const cleanIpLower = String(prodIp).toLowerCase();
                const ipRec = ipRecords.find(i => String(i.ipNumber || '').trim().toLowerCase() === cleanIpLower) || ipSnapshots[prodIp] || {};
                const rawDate = ipRec.openingDate || ipRec.date || ipRec.openDate || ipRec.ipDate || record.ipDate || record.date;
                results.push({
                    productName: prod.productName || prod.product,
                    ipNo: prodIp,
                    ipDate: formatDate(rawDate)
                });
            });
        }
    }

    // 3. Fallback: if still empty (e.g. single IP or preview), take the latest product and latest IP
    if (results.length === 0) {
        const lastProd = validCurrentProds[validCurrentProds.length - 1] || {};
        const lastIp = lastProd._fromIp || (currentIps.length > 0 ? currentIps[currentIps.length - 1] : record.ipNumber) || '..........';
        const cleanIpLower = String(lastIp).toLowerCase();
        const ipRec = ipRecords.find(i => String(i.ipNumber || '').trim().toLowerCase() === cleanIpLower) || ipSnapshots[lastIp] || {};
        const rawDate = ipRec.openingDate || ipRec.date || ipRec.openDate || ipRec.ipDate || record.ipDate || record.date;
        results.push({
            productName: lastProd.productName || lastProd.product || record.productName || 'fresh apples',
            ipNo: lastIp,
            ipDate: formatDate(rawDate)
        });
    }

    return results;
};

/**
 * Resolves product names strictly belonging to THIS PI / revision.
 * Only extracts from current productsList, originalProductsList, or direct productName.
 * @param {Object} record - PI Record data
 * @returns {string} Lowercase comma-separated product names
 */
export const getAllPiProductsText = (record) => {
    if (!record) return 'fresh apples';

    const seen = new Set();
    const productList = [];

    const addProduct = (rawName) => {
        if (!rawName) return;
        const trimmed = String(rawName).trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            productList.push(trimmed);
        }
    };

    const extractFromList = (list) => {
        if (!list || !Array.isArray(list)) return;
        list.forEach(p => {
            if (!p) return;
            const name = typeof p === 'string' ? p : (p.productName || p.product || p.itemName || p.item || p.description);
            addProduct(name);
        });
    };

    // 1. Current / revised productsList for this PI
    extractFromList(record.productsList);

    // 2. Original productsList for this PI (if any)
    extractFromList(record.originalProductsList);

    // 3. Direct productName field fallback
    if (productList.length === 0 && record.productName) {
        if (typeof record.productName === 'string' && record.productName.includes(',')) {
            record.productName.split(',').forEach(s => addProduct(s));
        } else {
            addProduct(record.productName);
        }
    }

    if (productList.length > 0) {
        return productList.join(', ').toLowerCase();
    }

    return 'fresh apples';
};

/**
 * Render Format: Amendment of L/C Value and Quantity Application Letter (Option 1)
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record / Revision data
 */
export const renderIncreaseLcValueQtyAmendmentApplication = (doc, record) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 25.4; // 1 inch left margin
    const marginRight = 25.4; // 1 inch right margin
    const contentWidth = pageWidth - marginLeft - marginRight; // 159.2 mm
    let currentY = 65; // Top margin for company letterhead pad

    // Set font to Times
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);

    // Recipient Section
    doc.text('To,', marginLeft, currentY);
    currentY += 6;

    const isIslami = isIslamiBank(record);
    if (isIslami) {
        doc.text('Vice President & Branch Head', marginLeft, currentY);
    } else {
        doc.text('The Head of Branch.', marginLeft, currentY);
    }
    currentY += 6;

    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    doc.text(`${bankName ? bankName : '............................................................'}.`, marginLeft, currentY);
    currentY += 6;

    const bankBranch = (record.bankBranch || '').trim();
    doc.text(`${bankBranch ? bankBranch : '............................................................'}`, marginLeft, currentY);
    currentY += 5.5;

    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();
    if (bankAddress && !isIslami) {
        doc.text(bankAddress, marginLeft, currentY);
        currentY += 5.5;
    }
    currentY += 4;

    // LC Number & LC Date
    let lcNo = (record.lcNo || record.lcNumber || record.linkedLc?.lcNo || '').trim();
    let rawLcDate = record.lcDate || record.linkedLc?.openingDate || record.linkedLc?.lcDate || '';
    if ((!lcNo || !rawLcDate) && record.revisions && Array.isArray(record.revisions)) {
        for (let i = record.revisions.length - 1; i >= 0; i--) {
            const r = record.revisions[i];
            if (!lcNo && r.lcNo) lcNo = (r.lcNo || '').trim();
            if (!rawLcDate && (r.lcDate || r.openingDate)) rawLcDate = r.lcDate || r.openingDate;
        }
    }
    lcNo = lcNo || '....................';
    const lcDate = rawLcDate ? formatDate(rawLcDate) : '....................';

    // Importer Name
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();

    // Commodity / Product Text
    const productText = getAllPiProductsText(record);

    // Country of Origin
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    // Revisions context
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;

    // PI Number & Date (Revised)
    const cleanPiNo = String(record.originalPiNumber || record.piNumber || '..........').replace(/\s*\(revised\)/gi, '').trim();
    const piNoRevised = `${cleanPiNo} (Revised)`;
    const rawReviseDate = record.reviseDate || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].reviseDate : null) || record.date;
    const reviseDateFormatted = formatDate(rawReviseDate);

    // Value and Quantity Calculations
    const revisedTotalVal = parseFloat(record.grandTotal || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].grandTotal : 0) || 0);
    const origTotalVal = parseFloat(record.originalGrandTotal || record.previousGrandTotal || origRev?.grandTotal || (actualRevs.length > 0 ? origRev?.grandTotal : record.grandTotal) || 0);
    const increaseVal = record.increaseValue !== undefined
        ? parseFloat(record.increaseValue)
        : (origTotalVal > 0 ? Math.max(0, revisedTotalVal - origTotalVal) : revisedTotalVal);

    const revisedTotalQty = parseFloat(record.grandTotalQuantity || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].grandTotalQuantity : 0) || 0);
    const origTotalQty = parseFloat(record.originalGrandTotalQuantity || record.previousGrandTotalQuantity || origRev?.grandTotalQuantity || (actualRevs.length > 0 ? origRev?.grandTotalQuantity : record.grandTotalQuantity) || 0);
    const increaseQty = record.increaseQuantity !== undefined
        ? parseFloat(record.increaseQuantity)
        : (origTotalQty > 0 ? Math.max(0, revisedTotalQty - origTotalQty) : revisedTotalQty);

    const formattedIncreaseValue = (increaseVal > 0 ? increaseVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedRevisedTotalValue = (revisedTotalVal > 0 ? revisedTotalVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedIncreaseQty = (increaseQty > 0 ? increaseQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formattedRevisedTotalQty = (revisedTotalQty > 0 ? revisedTotalQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    // Subject Line (Bold)
    doc.setFont('times', 'bold');
    const subjectText = 'Subject: Application for Amendment of L/C Value, Quantity';
    const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
    doc.text(subjectLines, marginLeft, currentY);
    currentY += (subjectLines.length * 5.6) + 2;

    // Reference Line (Bold)
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;
    const referenceLines = doc.splitTextToSize(referenceText, contentWidth);
    doc.text(referenceLines, marginLeft, currentY);
    currentY += (referenceLines.length * 5.6) + 2.5;

    // Salutation
    doc.setFont('times', 'normal');
    doc.text('Dear Sir,', marginLeft, currentY);
    currentY += 6.5;

    // Body Paragraph 1 (Justified)
    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p1Lines = doc.splitTextToSize(p1Text, contentWidth);
    doc.text(p1Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p1Lines.length * 5.6) + 4.5;

    // Body Paragraph 2 (Justified)
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;
    const p2Lines = doc.splitTextToSize(p2Text, contentWidth);
    doc.text(p2Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p2Lines.length * 5.6) + 4.5;

    // Body Paragraph 3 (Justified)
    const p3Text = `Please increase the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
    const p3Lines = doc.splitTextToSize(p3Text, contentWidth);
    doc.text(p3Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p3Lines.length * 5.6) + 4;

    // Bullet Points (Indented)
    const bulletIndent = marginLeft + 6;
    const bullets = [
        `•   Increase in L/C Value: USD ${formattedIncreaseValue}`,
        `•   Revised Total L/C Value: USD ${formattedRevisedTotalValue}`,
        `•   Increase in Quantity: ${formattedIncreaseQty} KGS`,
        `•   Revised Total Quantity: ${formattedRevisedTotalQty} KGS`
    ];
    doc.setFont('times', 'normal');
    bullets.forEach(b => {
        doc.text(b, bulletIndent, currentY);
        currentY += 5.5;
    });
    currentY += 3;

    // Body Paragraph 4 (Justified)
    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p4Lines = doc.splitTextToSize(p4Text, contentWidth);
    doc.text(p4Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p4Lines.length * 5.6) + 4.5;

    // Body Paragraph 5
    const p5Text = `Thank you for your kind cooperation and assistance.`;
    doc.text(p5Text, marginLeft, currentY);
    currentY += 7.5;

    // Closing
    doc.text('Yours faithfully,', marginLeft, currentY);
    currentY += 5;

    // Importer Signature Image
    const importerSign = record.partySignature || record.importerSignature;
    if (importerSign) {
        try {
            doc.addImage(importerSign, 'PNG', marginLeft, currentY, 50, 16);
            currentY += 18;
        } catch (e) {
            console.error('Error adding importer signature to Amendment Bank Application PDF:', e);
        }
    }
};

/**
 * Render Format: Amendment of Commodity Description and Value Application Letter (Option 2)
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record / Revision data
 */
export const renderCommodityDescriptionAndValueAmendmentApplication = (doc, record) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 25.4; // 1 inch left margin
    const marginRight = 25.4; // 1 inch right margin
    const contentWidth = pageWidth - marginLeft - marginRight; // 159.2 mm
    let currentY = 65; // Top margin for company letterhead pad

    // Set font to Times
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);

    // Recipient Section
    doc.text('To,', marginLeft, currentY);
    currentY += 6;

    const isIslami = isIslamiBank(record);
    if (isIslami) {
        doc.text('Vice President & Branch Head', marginLeft, currentY);
    } else {
        doc.text('The Head of Branch.', marginLeft, currentY);
    }
    currentY += 6;

    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    doc.text(`${bankName ? bankName : '............................................................'}.`, marginLeft, currentY);
    currentY += 6;

    const bankBranch = (record.bankBranch || '').trim();
    doc.text(`${bankBranch ? bankBranch : '............................................................'}`, marginLeft, currentY);
    currentY += 5.5;

    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();
    if (bankAddress && !isIslami) {
        doc.text(bankAddress, marginLeft, currentY);
        currentY += 5.5;
    }
    currentY += 4;

    // LC Number & LC Date
    let lcNo = (record.lcNo || record.lcNumber || record.linkedLc?.lcNo || '').trim();
    let rawLcDate = record.lcDate || record.linkedLc?.openingDate || record.linkedLc?.lcDate || '';
    if ((!lcNo || !rawLcDate) && record.revisions && Array.isArray(record.revisions)) {
        for (let i = record.revisions.length - 1; i >= 0; i--) {
            const r = record.revisions[i];
            if (!lcNo && r.lcNo) lcNo = (r.lcNo || '').trim();
            if (!rawLcDate && (r.lcDate || r.openingDate)) rawLcDate = r.lcDate || r.openingDate;
        }
    }
    lcNo = lcNo || '....................';
    const lcDate = rawLcDate ? formatDate(rawLcDate) : '....................';

    // Importer Name
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();

    // Revisions context
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;

    // Commodity / Product Text for Paragraph 1
    const productText = getAllPiProductsText(record);

    // Country of Origin
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    // PI Number & Date (Revised)
    const cleanPiNo = String(record.originalPiNumber || record.piNumber || '..........').replace(/\s*\(revised\)/gi, '').trim();
    const piNoRevised = `${cleanPiNo} (Revised)`;
    const rawReviseDate = record.reviseDate || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].reviseDate : null) || record.date;
    const reviseDateFormatted = formatDate(rawReviseDate);

    // Value and Quantity Calculations (Decrease)
    const revisedTotalVal = parseFloat(record.grandTotal || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].grandTotal : 0) || 0);
    const origTotalVal = parseFloat(record.originalGrandTotal || record.previousGrandTotal || origRev?.grandTotal || (actualRevs.length > 0 ? origRev?.grandTotal : record.grandTotal) || 0);
    const decreaseVal = record.decreaseValue !== undefined
        ? parseFloat(record.decreaseValue)
        : (origTotalVal > revisedTotalVal ? (origTotalVal - revisedTotalVal) : (origTotalVal > 0 ? Math.abs(revisedTotalVal - origTotalVal) : 0));

    const revisedTotalQty = parseFloat(record.grandTotalQuantity || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].grandTotalQuantity : 0) || 0);
    const origTotalQty = parseFloat(record.originalGrandTotalQuantity || record.previousGrandTotalQuantity || origRev?.grandTotalQuantity || (actualRevs.length > 0 ? origRev?.grandTotalQuantity : record.grandTotalQuantity) || 0);
    const decreaseQty = record.decreaseQuantity !== undefined
        ? parseFloat(record.decreaseQuantity)
        : (origTotalQty > revisedTotalQty ? (origTotalQty - revisedTotalQty) : (origTotalQty > 0 ? Math.abs(revisedTotalQty - origTotalQty) : 0));

    const formattedDecreaseValue = (decreaseVal > 0 ? decreaseVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedRevisedTotalValue = (revisedTotalVal > 0 ? revisedTotalVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDecreaseQty = (decreaseQty > 0 ? decreaseQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formattedRevisedTotalQty = (revisedTotalQty > 0 ? revisedTotalQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    // Subject Line (Bold)
    doc.setFont('times', 'bold');
    const subjectText = 'Subject: Application for Amendment of Commodity Description and Value';
    const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
    doc.text(subjectLines, marginLeft, currentY);
    currentY += (subjectLines.length * 5.6) + 2;

    // Reference Line (Bold)
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;
    const referenceLines = doc.splitTextToSize(referenceText, contentWidth);
    doc.text(referenceLines, marginLeft, currentY);
    currentY += (referenceLines.length * 5.6) + 2.5;

    // Salutation
    doc.setFont('times', 'normal');
    doc.text('Dear Sir,', marginLeft, currentY);
    currentY += 6.5;

    // Body Paragraph 1 (Justified)
    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p1Lines = doc.splitTextToSize(p1Text, contentWidth);
    doc.text(p1Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p1Lines.length * 5.6) + 4.5;

    // Body Paragraph 2 (Justified)
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;
    const p2Lines = doc.splitTextToSize(p2Text, contentWidth);
    doc.text(p2Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p2Lines.length * 5.6) + 4.5;

    // Body Paragraph 3 (Justified)
    const p3Text = `Please increase the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
    const p3Lines = doc.splitTextToSize(p3Text, contentWidth);
    doc.text(p3Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p3Lines.length * 5.6) + 4;

    // Bullet Points (Indented)
    const bulletIndent = marginLeft + 6;
    const bullets = [
        `•   Decrease in L/C Value: USD ${formattedDecreaseValue}`,
        `•   Revised Total L/C Value: USD ${formattedRevisedTotalValue}`,
        `•   Decrease in Quantity: ${formattedDecreaseQty} KGS`,
        `•   Revised Total Quantity: ${formattedRevisedTotalQty} KGS`
    ];

    // Newly added IP(s) items
    const newIpItems = getNewlyAddedIpDetails(record);
    newIpItems.forEach(item => {
        bullets.push(`•   Include ${item.productName} under I.P. No. ${item.ipNo}, dated ${item.ipDate}.`);
    });

    doc.setFont('times', 'normal');
    bullets.forEach(b => {
        const bLines = doc.splitTextToSize(b, contentWidth - 6);
        doc.text(bLines, bulletIndent, currentY);
        currentY += (bLines.length * 5.5);
    });
    currentY += 3;

    // Body Paragraph 4 (Justified)
    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p4Lines = doc.splitTextToSize(p4Text, contentWidth);
    doc.text(p4Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p4Lines.length * 5.6) + 4.5;

    // Body Paragraph 5
    const p5Text = `Thank you for your kind cooperation and assistance.`;
    doc.text(p5Text, marginLeft, currentY);
    currentY += 7.5;

    // Closing
    doc.text('Yours faithfully,', marginLeft, currentY);
    currentY += 5;

    // Importer Signature Image
    const importerSign = record.partySignature || record.importerSignature;
    if (importerSign) {
        try {
            doc.addImage(importerSign, 'PNG', marginLeft, currentY, 50, 16);
            currentY += 18;
        } catch (e) {
            console.error('Error adding importer signature to Amendment Bank Application PDF:', e);
        }
    }
};

/**
 * Render Format: Extension of Shipment and Expiry Dates Application Letter (Option 3)
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record / Revision data
 */
export const renderExtensionOfDatesAmendmentApplication = (doc, record) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 25.4; // 1 inch left margin
    const marginRight = 25.4; // 1 inch right margin
    const contentWidth = pageWidth - marginLeft - marginRight; // 159.2 mm
    let currentY = 65; // Top margin for company letterhead pad

    // Set font to Times
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);

    // Recipient Section
    doc.text('To,', marginLeft, currentY);
    currentY += 6;

    const isIslami = isIslamiBank(record);
    if (isIslami) {
        doc.text('Vice President & Branch Head', marginLeft, currentY);
    } else {
        doc.text('The Head of Branch.', marginLeft, currentY);
    }
    currentY += 6;

    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    doc.text(`${bankName ? bankName : '............................................................'}.`, marginLeft, currentY);
    currentY += 6;

    const bankBranch = (record.bankBranch || '').trim();
    doc.text(`${bankBranch ? bankBranch : '............................................................'}`, marginLeft, currentY);
    currentY += 5.5;

    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();
    if (bankAddress && !isIslami) {
        doc.text(bankAddress, marginLeft, currentY);
        currentY += 5.5;
    }
    currentY += 4;

    // LC Number & LC Date
    let lcNo = (record.lcNo || record.lcNumber || record.linkedLc?.lcNo || '').trim();
    let rawLcDate = record.lcDate || record.linkedLc?.openingDate || record.linkedLc?.lcDate || '';
    if ((!lcNo || !rawLcDate) && record.revisions && Array.isArray(record.revisions)) {
        for (let i = record.revisions.length - 1; i >= 0; i--) {
            const r = record.revisions[i];
            if (!lcNo && r.lcNo) lcNo = (r.lcNo || '').trim();
            if (!rawLcDate && (r.lcDate || r.openingDate)) rawLcDate = r.lcDate || r.openingDate;
        }
    }
    lcNo = lcNo || '....................';
    const lcDate = rawLcDate ? formatDate(rawLcDate) : '....................';

    // Importer Name
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();

    // Revisions context
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;
    const latestRev = actualRevs.length > 0 ? actualRevs[actualRevs.length - 1] : null;

    // Commodity / Product Text
    const productText = getAllPiProductsText(record);

    // Country of Origin
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    // Dates for Extension
    let rawShipmentDate = record.extendedShipmentDate || record.newShipmentDate || record.latestShipmentDate || latestRev?.extendedShipmentDate || latestRev?.latestShipmentDate;
    let rawExpiryDate = record.extendedExpiryDate || record.newExpiryDate || record.expiryDate || latestRev?.extendedExpiryDate || latestRev?.expiryDate;

    // Fallbacks if not set
    if (!rawShipmentDate) {
        rawShipmentDate = record.validityDate || latestRev?.validityDate || record.linkedLc?.extendedShipmentDate || record.linkedLc?.latestShipmentDate;
    }
    if (!rawExpiryDate) {
        rawExpiryDate = record.validityDate || latestRev?.validityDate || record.linkedLc?.extendedExpiryDate || record.linkedLc?.expiryDate;
    }

    const formattedShipmentDate = rawShipmentDate ? formatDate(rawShipmentDate) : 'new date';
    const formattedExpiryDate = rawExpiryDate ? formatDate(rawExpiryDate) : 'new date';

    // Subject Line (Bold)
    doc.setFont('times', 'bold');
    const subjectText = 'Subject: Application for Amendment of Extension of Shipment and Expiry Dates';
    const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
    doc.text(subjectLines, marginLeft, currentY);
    currentY += (subjectLines.length * 5.6) + 2;

    // Reference Line (Bold)
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;
    const referenceLines = doc.splitTextToSize(referenceText, contentWidth);
    doc.text(referenceLines, marginLeft, currentY);
    currentY += (referenceLines.length * 5.6) + 2.5;

    // Salutation
    doc.setFont('times', 'normal');
    doc.text('Dear Sir,', marginLeft, currentY);
    currentY += 6.5;

    // Body Paragraph 1 (Justified)
    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p1Lines = doc.splitTextToSize(p1Text, contentWidth);
    doc.text(p1Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p1Lines.length * 5.6) + 4.5;

    // Body Paragraph 2 (Justified)
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;
    const p2Lines = doc.splitTextToSize(p2Text, contentWidth);
    doc.text(p2Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p2Lines.length * 5.6) + 4.5;

    // Body Paragraph 3 (Justified)
    const p3Text = `Please extend the latest date of shipment up to ${formattedShipmentDate} and the expiry date up to ${formattedExpiryDate}, as required.`;
    const p3Lines = doc.splitTextToSize(p3Text, contentWidth);
    doc.text(p3Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p3Lines.length * 5.6) + 4.5;

    // Body Paragraph 4 (Justified)
    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p4Lines = doc.splitTextToSize(p4Text, contentWidth);
    doc.text(p4Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p4Lines.length * 5.6) + 4.5;

    // Body Paragraph 5
    const p5Text = `Thank you for your kind cooperation and assistance.`;
    doc.text(p5Text, marginLeft, currentY);
    currentY += 7.5;

    // Closing
    doc.text('Yours faithfully,', marginLeft, currentY);
    currentY += 5;

    // Importer Signature Image
    const importerSign = record.partySignature || record.importerSignature;
    if (importerSign) {
        try {
            doc.addImage(importerSign, 'PNG', marginLeft, currentY, 50, 16);
            currentY += 18;
        } catch (e) {
            console.error('Error adding importer signature to Amendment Bank Application PDF:', e);
        }
    }
};

/**
 * Render Format: Merged Amendment Application Letter (When multiple amendment options are selected)
 * Merges combinations of:
 * - Option 1: Increase of L/C Value and Quantity
 * - Option 2: Amendment of Commodity Description and Value
 * - Option 3: Extension of Shipment and Expiry Dates
 * 
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record / Revision data
 * @param {Object} selections - Result from getAmendmentSelections
 */
export const renderMergedAmendmentApplication = (doc, record, selections) => {
    const { hasOption1, hasOption2, hasOption3 } = selections || getAmendmentSelections(record);
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 25.4; // 1 inch left margin
    const marginRight = 25.4; // 1 inch right margin
    const contentWidth = pageWidth - marginLeft - marginRight; // 159.2 mm
    let currentY = 65; // Top margin for company letterhead pad

    // Set font to Times
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);

    // Recipient Section
    doc.text('To,', marginLeft, currentY);
    currentY += 6;

    const isIslami = isIslamiBank(record);
    if (isIslami) {
        doc.text('Vice President & Branch Head', marginLeft, currentY);
    } else {
        doc.text('The Head of Branch.', marginLeft, currentY);
    }
    currentY += 6;

    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    doc.text(`${bankName ? bankName : '............................................................'}.`, marginLeft, currentY);
    currentY += 6;

    const bankBranch = (record.bankBranch || '').trim();
    doc.text(`${bankBranch ? bankBranch : '............................................................'}`, marginLeft, currentY);
    currentY += 5.5;

    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();
    if (bankAddress && !isIslami) {
        doc.text(bankAddress, marginLeft, currentY);
        currentY += 5.5;
    }
    currentY += 4;

    // LC Number & LC Date
    let lcNo = (record.lcNo || record.lcNumber || record.linkedLc?.lcNo || '').trim();
    let rawLcDate = record.lcDate || record.linkedLc?.openingDate || record.linkedLc?.lcDate || '';
    if ((!lcNo || !rawLcDate) && record.revisions && Array.isArray(record.revisions)) {
        for (let i = record.revisions.length - 1; i >= 0; i--) {
            const r = record.revisions[i];
            if (!lcNo && r.lcNo) lcNo = (r.lcNo || '').trim();
            if (!rawLcDate && (r.lcDate || r.openingDate)) rawLcDate = r.lcDate || r.openingDate;
        }
    }
    lcNo = lcNo || '....................';
    const lcDate = rawLcDate ? formatDate(rawLcDate) : '....................';

    // Importer Name
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();

    // Revisions context
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;
    const latestRev = actualRevs.length > 0 ? actualRevs[actualRevs.length - 1] : null;

    // Commodity / Product Text for Paragraph 1
    const productText = getAllPiProductsText(record);

    // Country of Origin
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    // PI Number & Date (Revised)
    const cleanPiNo = String(record.originalPiNumber || record.piNumber || '..........').replace(/\s*\(revised\)/gi, '').trim();
    const piNoRevised = `${cleanPiNo} (Revised)`;
    const rawReviseDate = record.reviseDate || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].reviseDate : null) || record.date;
    const reviseDateFormatted = formatDate(rawReviseDate);

    // Subject Line (Bold, Merged)
    doc.setFont('times', 'bold');
    let subjectText = 'Subject: Application for Amendment of ';
    if (hasOption1 && hasOption2 && hasOption3) {
        subjectText += 'Commodity Description, L/C Value, Quantity and Extension of Shipment and Expiry Dates';
    } else if (hasOption1 && hasOption2) {
        subjectText += 'Commodity Description, L/C Value and Quantity';
    } else if (hasOption1 && hasOption3) {
        subjectText += 'L/C Value, Quantity and Extension of Shipment and Expiry Dates';
    } else if (hasOption2 && hasOption3) {
        subjectText += 'Commodity Description, Value and Extension of Shipment and Expiry Dates';
    } else if (hasOption3) {
        subjectText += 'Extension of Shipment and Expiry Dates';
    } else if (hasOption2) {
        subjectText += 'Commodity Description and Value';
    } else {
        subjectText += 'L/C Value, Quantity';
    }

    const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
    doc.text(subjectLines, marginLeft, currentY);
    currentY += (subjectLines.length * 5.6) + 2;

    // Reference Line (Bold)
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;
    const referenceLines = doc.splitTextToSize(referenceText, contentWidth);
    doc.text(referenceLines, marginLeft, currentY);
    currentY += (referenceLines.length * 5.6) + 2.5;

    // Salutation
    doc.setFont('times', 'normal');
    doc.text('Dear Sir,', marginLeft, currentY);
    currentY += 6.5;

    // Body Paragraph 1 (Justified)
    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p1Lines = doc.splitTextToSize(p1Text, contentWidth);
    doc.text(p1Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p1Lines.length * 5.6) + 4.5;

    // Body Paragraph 2 (Justified)
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;
    const p2Lines = doc.splitTextToSize(p2Text, contentWidth);
    doc.text(p2Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p2Lines.length * 5.6) + 4.5;

    // Value and Quantity Calculations
    const revisedTotalVal = parseFloat(record.grandTotal || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].grandTotal : 0) || 0);
    const origTotalVal = parseFloat(record.originalGrandTotal || record.previousGrandTotal || origRev?.grandTotal || (actualRevs.length > 0 ? origRev?.grandTotal : record.grandTotal) || 0);
    const isValIncrease = revisedTotalVal >= origTotalVal;
    const diffVal = Math.abs(revisedTotalVal - origTotalVal);

    const revisedTotalQty = parseFloat(record.grandTotalQuantity || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].grandTotalQuantity : 0) || 0);
    const origTotalQty = parseFloat(record.originalGrandTotalQuantity || record.previousGrandTotalQuantity || origRev?.grandTotalQuantity || (actualRevs.length > 0 ? origRev?.grandTotalQuantity : record.grandTotalQuantity) || 0);
    const isQtyIncrease = revisedTotalQty >= origTotalQty;
    const diffQty = Math.abs(revisedTotalQty - origTotalQty);

    const formattedDiffValue = (diffVal > 0 ? diffVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedRevisedTotalValue = (revisedTotalVal > 0 ? revisedTotalVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDiffQty = (diffQty > 0 ? diffQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formattedRevisedTotalQty = (revisedTotalQty > 0 ? revisedTotalQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    // Dates for Extension
    let rawShipmentDate = record.extendedShipmentDate || record.newShipmentDate || record.latestShipmentDate || latestRev?.extendedShipmentDate || latestRev?.latestShipmentDate;
    let rawExpiryDate = record.extendedExpiryDate || record.newExpiryDate || record.expiryDate || latestRev?.extendedExpiryDate || latestRev?.expiryDate;
    if (!rawShipmentDate) {
        rawShipmentDate = record.validityDate || latestRev?.validityDate || record.linkedLc?.extendedShipmentDate || record.linkedLc?.latestShipmentDate;
    }
    if (!rawExpiryDate) {
        rawExpiryDate = record.validityDate || latestRev?.validityDate || record.linkedLc?.extendedExpiryDate || record.linkedLc?.expiryDate;
    }
    const formattedShipmentDate = rawShipmentDate ? formatDate(rawShipmentDate) : 'new date';
    const formattedExpiryDate = rawExpiryDate ? formatDate(rawExpiryDate) : 'new date';

    // Body Paragraph 3 (Justified)
    let p3Text = '';
    if (hasOption1 && !hasOption2 && !hasOption3) {
        p3Text = `Please increase the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
    } else if (hasOption1 || hasOption2) {
        if (isValIncrease && isQtyIncrease) {
            p3Text = `Please increase the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
        } else {
            p3Text = `Please amend the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
        }
    } else {
        p3Text = `Please amend the above-mentioned L/C as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
    }

    const p3Lines = doc.splitTextToSize(p3Text, contentWidth);
    doc.text(p3Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p3Lines.length * 5.6) + 4;

    // Bullet Points (Indented)
    const bulletIndent = marginLeft + 6;
    const bullets = [];

    if (hasOption1 || hasOption2) {
        const valAction = (hasOption2 && !hasOption1 && !isValIncrease) ? 'Decrease in L/C Value' : (isValIncrease ? 'Increase in L/C Value' : 'Decrease in L/C Value');
        const qtyAction = (hasOption2 && !hasOption1 && !isQtyIncrease) ? 'Decrease in Quantity' : (isQtyIncrease ? 'Increase in Quantity' : 'Decrease in Quantity');

        bullets.push(`•   ${valAction}: USD ${formattedDiffValue}`);
        bullets.push(`•   Revised Total L/C Value: USD ${formattedRevisedTotalValue}`);
        bullets.push(`•   ${qtyAction}: ${formattedDiffQty} KGS`);
        bullets.push(`•   Revised Total Quantity: ${formattedRevisedTotalQty} KGS`);
    }

    if (hasOption2) {
        const newIpItems = getNewlyAddedIpDetails(record);
        newIpItems.forEach(item => {
            bullets.push(`•   Include ${item.productName} under I.P. No. ${item.ipNo}, dated ${item.ipDate}.`);
        });
    }

    if (bullets.length > 0) {
        doc.setFont('times', 'normal');
        bullets.forEach(b => {
            const bLines = doc.splitTextToSize(b, contentWidth - 6);
            doc.text(bLines, bulletIndent, currentY);
            currentY += (bLines.length * 5.5);
        });
        currentY += 4;
    }

    // Date Extension as its own paragraph (NOT as a bullet point)
    if (hasOption3) {
        const extText = `Also please extend the latest date of shipment up to ${formattedShipmentDate} and the expiry date up to ${formattedExpiryDate}, as required.`;
        const extLines = doc.splitTextToSize(extText, contentWidth);
        doc.text(extText, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
        currentY += (extLines.length * 5.6) + 4.5;
    }

    // Body Paragraph 4 (Justified)
    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p4Lines = doc.splitTextToSize(p4Text, contentWidth);
    doc.text(p4Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p4Lines.length * 5.6) + 4.5;

    // Body Paragraph 5
    const p5Text = `Thank you for your kind cooperation and assistance.`;
    doc.text(p5Text, marginLeft, currentY);
    currentY += 7.5;

    // Closing
    doc.text('Yours faithfully,', marginLeft, currentY);
    currentY += 5;

    // Importer Signature Image
    const importerSign = record.partySignature || record.importerSignature;
    if (importerSign) {
        try {
            doc.addImage(importerSign, 'PNG', marginLeft, currentY, 50, 16);
            currentY += 18;
        } catch (e) {
            console.error('Error adding importer signature to Amendment Bank Application PDF:', e);
        }
    }
};

/**
 * Dispatcher: Render the Bank Application Letter content based on Bank / Format / Amendment
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record data
 */
export const renderBankApplicationContent = (doc, record) => {
    if (!doc || !record) return;

    const selections = getAmendmentSelections(record);

    if (selections.count > 1) {
        renderMergedAmendmentApplication(doc, record, selections);
    } else if (selections.count === 1) {
        if (selections.hasOption3) {
            renderExtensionOfDatesAmendmentApplication(doc, record);
        } else if (selections.hasOption2) {
            renderCommodityDescriptionAndValueAmendmentApplication(doc, record);
        } else {
            renderIncreaseLcValueQtyAmendmentApplication(doc, record);
        }
    } else if (selections.isAmendment) {
        renderIncreaseLcValueQtyAmendmentApplication(doc, record);
    } else if (isIslamiBank(record)) {
        renderIslamiBankApplication(doc, record);
    } else {
        renderNonIslamiBankApplication(doc, record);
    }
};

/**
 * Appends the Bank Application Letter as a new page in an existing jsPDF document
 * @param {jsPDF} doc - Existing jsPDF instance
 * @param {Object} record - PI Record data
 */
export const appendBankApplicationPage = (doc, record) => {
    if (!doc || !record) return;
    doc.addPage('a4', 'p');
    renderBankApplicationContent(doc, record);
};

/**
 * Generate Bank Application Letter PDF standalone for a Proforma Invoice (PI)
 * Automatically detects whether to use Islami Bank or Non-Islami Bank template
 * @param {Object} record - PI Record data
 */
export const generateBankApplicationPDF = (record) => {
    if (!record) return;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    renderBankApplicationContent(doc, record);

    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};

/**
 * Generate Islami Bank Bangladesh PLC Application standalone
 * @param {Object} record - PI Record data
 */
export const generateIslamiBankApplicationPDF = (record) => {
    if (!record) return;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    renderIslamiBankApplication(doc, record);

    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};

