/**
 * Generates and appends an official Bank NOC (No Objection Certificate) Application Letter
 * as an A4 portrait page in the Packing List PDF.
 */

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
};

/**
 * Checks whether the bank is Islami Bank Bangladesh PLC.
 */
export const isIslamiBank = (bankName = '', appFormat = '') => {
    const fmt = String(appFormat || '').toLowerCase().trim();
    if (fmt.includes('non-islami') || fmt.includes('general')) return false;
    if (fmt.includes('islami')) return true;
    const bName = String(bankName || '').toLowerCase().trim();
    return bName.includes('islami') || bName.includes('ibbl');
};

/**
 * Helper to draw a rich paragraph with mixed regular and bold words wrapping across lines.
 *
 * @param {jsPDF} doc - jsPDF instance
 * @param {Array<{text: string, bold?: boolean}>} parts - Text segments
 * @param {number} startX - Left margin X
 * @param {number} startY - Top Y
 * @param {number} maxWidth - Max text width before wrapping
 * @param {number} lineHeight - Line height in mm
 * @param {number} fontSize - Font size in pt
 * @returns {number} Updated Y coordinate after paragraph
 */
const drawRichParagraph = (doc, parts, startX, startY, maxWidth, lineHeight, fontSize, align = 'justify') => {
    doc.setFontSize(fontSize);

    // Break segments into individual tokens (words and whitespace)
    const tokens = [];
    parts.forEach(part => {
        if (!part || !part.text) return;
        const subTokens = part.text.split(/(\s+)/);
        subTokens.forEach(t => {
            if (!t) return;
            tokens.push({
                text: t,
                bold: !!part.bold,
                isWhitespace: /^\s+$/.test(t)
            });
        });
    });

    let currentY = startY;
    let lineTokens = [];
    let currentLineWidth = 0;

    const renderLine = (tokensToDraw, isLastLine) => {
        // Strip trailing whitespace
        while (tokensToDraw.length > 0 && tokensToDraw[tokensToDraw.length - 1].isWhitespace) {
            tokensToDraw.pop();
        }
        // Strip leading whitespace
        while (tokensToDraw.length > 0 && tokensToDraw[0].isWhitespace) {
            tokensToDraw.shift();
        }
        if (tokensToDraw.length === 0) return;

        const words = tokensToDraw.filter(t => !t.isWhitespace);
        if (words.length === 0) return;

        let curX = startX;

        // Justify text across maxWidth if not the last line and has multiple words
        if (align === 'justify' && !isLastLine && words.length > 1) {
            let totalWordsWidth = 0;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fontSize);
            words.forEach(w => {
                totalWordsWidth += doc.getTextWidth(w.text);
            });

            const gapCount = words.length - 1;
            const extraSpace = Math.max(0, maxWidth - totalWordsWidth);
            const gapWidth = extraSpace / gapCount;

            // Apply justify if the gap width is within realistic bounds (e.g. <= 12mm)
            if (gapWidth <= 12) {
                words.forEach((w, idx) => {
                    doc.text(w.text, curX, currentY);
                    curX += doc.getTextWidth(w.text) + (idx < gapCount ? gapWidth : 0);
                });
                currentY += lineHeight;
                return;
            }
        }

        // Left-aligned rendering (for last line or single-word line)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        tokensToDraw.forEach(tok => {
            doc.text(tok.text, curX, currentY);
            curX += doc.getTextWidth(tok.text);
        });
        currentY += lineHeight;
    };

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    tokens.forEach(tok => {
        const tokWidth = doc.getTextWidth(tok.text);

        if (lineTokens.length === 0 && tok.isWhitespace) {
            return;
        }

        if (currentLineWidth + tokWidth > maxWidth && lineTokens.length > 0) {
            renderLine(lineTokens, false);
            lineTokens = [];
            currentLineWidth = 0;
            if (tok.isWhitespace) return;
        }

        lineTokens.push(tok);
        currentLineWidth += tokWidth;
    });

    if (lineTokens.length > 0) {
        renderLine(lineTokens, true);
    }

    return currentY;
};

/**
 * Appends the NOC Application Letter page to the PDF.
 *
 * @param {jsPDF} doc - Existing jsPDF instance
 * @param {Object} record - Packing list record / resolved data
 * @param {Object} context - Optional lookup context (piRecords, lcRecords, importers, exporters, banks, ipRecords, products)
 */
export const appendNocApplicationPage = async (doc, record, context = {}) => {
    if (!doc || !record) return false;

    try {
        const {
            piRecords = [],
            lcRecords = [],
            importers = [],
            exporters = [],
            banks = [],
            ipRecords = [],
            products = []
        } = context;

        // Resolve lookup records
        const cleanPiNumber = (record.piNumber || '').replace(' (REVISED)', '').trim();
        const pi = piRecords.find(p => (p.piNumber || '').trim().toLowerCase() === cleanPiNumber.toLowerCase());
        const lc = lcRecords.find(l => l.lcNo === (record.lcNumber || record.lcNo || pi?.lcNumber));
        const importer = importers.find(imp => (imp.name || '').toLowerCase().trim() === (record.partyName || '').toLowerCase().trim());
        const exporter = exporters.find(exp => (exp.name || '').toLowerCase().trim() === (record.exporterName || '').toLowerCase().trim());

        // Resolve Bank & Branch
        const bankName = (record.bankName || lc?.bankName || pi?.bankName || '').trim() || 'Islami Bank Bangladesh PLC';
        let branchName = (record.branchName || lc?.bankBranch || pi?.bankBranch || '').trim();
        const matchedBank = Array.isArray(banks)
            ? banks.find(b => (b.bankName || '').toLowerCase().trim() === bankName.toLowerCase().trim())
            : null;
        if (!branchName && matchedBank && matchedBank.branches && matchedBank.branches.length > 0) {
            branchName = matchedBank.branches[0].branch || '';
        }

        const isIslami = isIslamiBank(bankName, record.applicationFormat);
        const branchHeadTitle = isIslami ? 'The Vice President & Head of Branch' : 'The Head of Branch';

        let branchDisplay = branchName;
        if (branchDisplay) {
            if (!branchDisplay.toLowerCase().includes('branch')) {
                branchDisplay = `${branchDisplay} Branch.`;
            } else if (!branchDisplay.endsWith('.')) {
                branchDisplay = `${branchDisplay}.`;
            }
        } else {
            branchDisplay = 'Branch .';
        }

        // Resolve L/C No & Date
        const lcNo = record.lcNo || record.lcNumber || lc?.lcNo || pi?.lcNumber || '';
        const rawLcDate = lc?.lcDate || record.lcDate || pi?.lcDate || '';
        const lcDate = rawLcDate ? formatDate(rawLcDate) : '';

        // Resolve Importer & Exporter Names
        const importerName = (record.partyName || importer?.name || '').trim();
        const exporterName = (record.exporterName || pi?.exporterName || exporter?.name || '').trim();

        // Resolve Products, IP Names, and Commodity Display
        const rawProducts = Array.isArray(record.productsList) && record.productsList.length > 0
            ? record.productsList
            : (pi?.productsList || []);

        const productDisplays = [];
        rawProducts.forEach((item, idx) => {
            const pName = (item.productName || '').trim();
            if (!pName) return;

            // Check if item already has IP name in parentheses
            if (pName.includes('(') && pName.includes(')')) {
                productDisplays.push(pName);
                return;
            }

            // Look up ipName from product item, product definitions, or ipRecords
            let ipName = (item.ipName || '').trim();
            if (!ipName && Array.isArray(products)) {
                const matchedProd = products.find(p =>
                    (p.name || '').trim().toLowerCase() === pName.toLowerCase() ||
                    (p.ipName || '').trim().toLowerCase() === pName.toLowerCase()
                );
                if (matchedProd && matchedProd.ipName && matchedProd.ipName.trim().toLowerCase() !== pName.toLowerCase()) {
                    ipName = matchedProd.ipName.trim();
                }
            }
            if (!ipName && Array.isArray(ipRecords)) {
                const matchedIp = ipRecords.find(i =>
                    (i.productName || '').trim().toLowerCase() === pName.toLowerCase() ||
                    (i.name || '').trim().toLowerCase() === pName.toLowerCase()
                );
                if (matchedIp && matchedIp.ipName && matchedIp.ipName.trim().toLowerCase() !== pName.toLowerCase()) {
                    ipName = matchedIp.ipName.trim();
                }
            }

            if (ipName) {
                productDisplays.push(`${pName} (${ipName})`);
            } else {
                productDisplays.push(pName);
            }
        });

        const productDisplay = productDisplays.length > 0
            ? productDisplays.join(', ')
            : (record.productName || 'Goods');

        // Resolve Quantity (kg)
        let totalNetWeight = 0;
        let totalQty = 0;
        rawProducts.forEach(p => {
            totalNetWeight += parseFloat(p.netWeight || p.quantity || 0) || 0;
            totalQty += parseFloat(p.quantity || p.netWeight || 0) || 0;
        });
        const qtyNum = totalNetWeight > 0 ? totalNetWeight : (totalQty > 0 ? totalQty : (parseFloat(record.grandTotalQuantity || 0) || 0));
        const formattedQty = qtyNum > 0
            ? qtyNum.toLocaleString('en-US', { maximumFractionDigits: 2 })
            : (record.grandTotalQuantity ? String(record.grandTotalQuantity) : '0');

        // Resolve L/C USD Value
        let computedTotal = 0;
        rawProducts.forEach(p => {
            const q = parseFloat(p.quantity || p.netWeight || 0) || 0;
            const r = parseFloat(p.rate || 0) || 0;
            const amt = parseFloat(p.amount) || (q * r);
            const frt = parseFloat(p.freight || 0) || 0;
            const totFrt = parseFloat(p.totalFreight) || (q * frt);
            computedTotal += amt + totFrt;
        });
        const usdValNum = computedTotal > 0
            ? computedTotal
            : (parseFloat(record.piGrandTotal || record.grandTotal || record.totalAmount || pi?.grandTotal || 0) || 0);
        const formattedUsdValue = usdValNum > 0
            ? usdValNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0.00';

        // Resolve Country of Origin
        const countryOrigin = (record.countryOrigin || pi?.countryOrigin || 'INDIA').trim().toUpperCase();

        // Resolve Port of Entry
        const rawPort = (record.portOfDischarge || pi?.portOfDischarge || 'Benapole Land Port').trim();
        const cleanPortName = rawPort.replace(/land\s*port/gi, '').replace(/port/gi, '').trim() || 'Benapole';
        const portOfEntryDisplay = `${cleanPortName} Land Port`;

        // Resolve Importer Signature & Name
        const signatureImage = record.partySignature || pi?.partySignature || importer?.signature || record.importerSignature || '';
        const signatoryName = importerName || record.partyName || '';

        // Add A4 Portrait Page
        doc.addPage('a4', 'p');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginLeft = 25.4; // 1 inch
        const marginRight = 25.4; // 1 inch
        const contentWidth = pageWidth - marginLeft - marginRight; // 159.2 mm

        let currentY = isIslami ? 70 : 65; // Same top margin as bank application (for company letterhead pad)

        // --- Recipient Section ---
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);

        doc.text('To,', marginLeft, currentY);
        currentY += 5.0;

        doc.text(branchHeadTitle, marginLeft, currentY);
        currentY += 5.0;

        doc.setFont('helvetica', 'normal');
        doc.text(bankName, marginLeft, currentY);
        currentY += 5.0;

        doc.text(branchDisplay, marginLeft, currentY);
        currentY += 6.5;

        // --- Subject Line ---
        const subjectParts = [
            { text: 'Subject: Request for Issuance of NOC and Endorsement of Documents against L/C No. ' },
            { text: lcNo || '....................' },
            { text: ' dated ' },
            { text: lcDate || '....................' },
            { text: ' for ' },
            { text: productDisplay },
            { text: ' Import.' }
        ];
        currentY = drawRichParagraph(doc, subjectParts, marginLeft, currentY, contentWidth, 5.2, 11);
        currentY += 3.5;

        // --- Salutation ---
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('Dear Sir,', marginLeft, currentY);
        currentY += 5;

        // --- Body Paragraph 1 ---
        const branchText = branchName ? `${branchName} branch` : 'branch';
        const body1Parts = [
            { text: 'With due respect, I would like to state that I am the proprietor of ' },
            { text: importerName || '............................................................' },
            { text: ' , a regular business customer and importer of your ' },
            { text: branchText },
            { text: '. An L/C of ' },
            { text: `USD ${formattedUsdValue}` },
            { text: ' was opened in the name of my proprietorship concern for importing ' },
            { text: formattedQty },
            { text: ' kg of ' },
            { text: productDisplay },
            { text: ' from ' },
            { text: countryOrigin },
            { text: ' .' }
        ];
        currentY = drawRichParagraph(doc, body1Parts, marginLeft, currentY, contentWidth, 5.2, 11);
        currentY += 3.5;

        // --- Aligned Relevant Details Table ---
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('The relevant details are as follows:', marginLeft, currentY);
        currentY += 5.5;

        const colonX = marginLeft + 38;
        const valX = marginLeft + 42;
        const valMaxWidth = contentWidth - 42;

        const detailRows = [
            { label: 'L/C No.', value: lcNo || '....................' },
            { label: 'Date', value: lcDate || '....................' },
            { label: 'Commodity', value: productDisplay || 'Goods' },
            { label: 'Quantity', value: `${formattedQty} kg` },
            { label: 'L/C Value', value: `USD ${formattedUsdValue}` },
            { label: 'Country of Origin', value: countryOrigin },
            { label: 'Port of Entry', value: portOfEntryDisplay }
        ];

        detailRows.forEach(row => {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(row.label, marginLeft, currentY);
            doc.text(':', colonX, currentY);

            // Wrap long values (e.g. Commodity) if needed
            doc.setFont('helvetica', 'normal');
            const lines = doc.splitTextToSize(row.value, valMaxWidth);
            doc.text(lines, valX, currentY);
            currentY += (lines.length * 4.8);
        });

        currentY += 3.5;

        // --- Body Paragraph 2 ---
        const body2Parts = [
            { text: 'The goods under the above-mentioned L/C have already arrived at ' },
            { text: cleanPortName },
            { text: ' Land Port. In order to complete the customs clearance and release the goods, NOC/necessary endorsement along with copies of the required documents is required.' }
        ];
        currentY = drawRichParagraph(doc, body2Parts, marginLeft, currentY, contentWidth, 5.2, 11);
        currentY += 3.0;

        // --- Body Paragraph 3 ---
        const body3Parts = [
            { text: 'Therefore, I would highly appreciate it if you kindly issue the necessary NOC and provide/endorse the required copy documents at your earliest convenience so that I can complete the customs clearance process and release the imported goods without further delay.' }
        ];
        currentY = drawRichParagraph(doc, body3Parts, marginLeft, currentY, contentWidth, 5.2, 11);
        currentY += 3.0;

        // --- Body Paragraph 4 ---
        const body4Parts = [
            { text: 'I further confirm that I have no objection or restriction regarding the acceptance of the required documents for the above purpose.' }
        ];
        currentY = drawRichParagraph(doc, body4Parts, marginLeft, currentY, contentWidth, 5.2, 11);
        currentY += 3.0;

        // --- Body Paragraph 5 ---
        const body5Parts = [
            { text: 'Your kind cooperation in this regard will be highly appreciated.' }
        ];
        currentY = drawRichParagraph(doc, body5Parts, marginLeft, currentY, contentWidth, 5.2, 11);
        currentY += 6;

        // --- Signature Section ---
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('Yours faithfully,', marginLeft, currentY);
        currentY += 5;

        if (signatureImage) {
            try {
                doc.addImage(signatureImage, 'PNG', marginLeft, currentY, 50, 16);
                currentY += 18;
            } catch (e) {
                console.error('Error adding signature to NOC Application PDF:', e);
            }
        }

        return true;
    } catch (e) {
        console.error('Error generating NOC application page:', e);
        return false;
    }
};
