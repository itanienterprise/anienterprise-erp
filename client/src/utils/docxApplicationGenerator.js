import {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ImageRun,
    Packer
} from 'docx';

import {
    isIslamiBank,
    getAmendmentSelections,
    getNewlyAddedIpDetails,
    getAllPiProductsText,
    calculateAmendmentIncreaseValues
} from './islbankApplicationGenerator.js';

import { downloadFile } from './apkDownloadBridge.js';

// Standard styling constants
const FONT_FAMILY = 'Times New Roman';
const FONT_SIZE_HALF_POINTS = 23; // 11.5 pt
const LINE_SPACING = 280; // ~1.2 line spacing
const MARGIN_LETTERHEAD_TOP = 3600; // 2.5 inches (63.5mm) for letterhead pad
const MARGIN_SIDE = 1440; // 1 inch (25.4mm)
const MARGIN_BOTTOM = 1440; // 1 inch (25.4mm)

// Helper: DD/MM/YYYY date formatting
const formatDate = (dateStr) => {
    if (!dateStr) {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
    try {
        if (typeof dateStr === 'string') {
            const trimmed = dateStr.trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
                const [year, month, day] = trimmed.split('T')[0].split('-');
                return `${day}/${month}/${year}`;
            }
            if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(trimmed)) {
                const parts = trimmed.split(/[\/\-]/);
                return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
            }
        }
        const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return String(dateStr);
    }
};

// Helper: Convert Base64 or URL to Uint8Array for docx ImageRun
const getImageBuffer = async (imgSrc) => {
    if (!imgSrc || typeof imgSrc !== 'string') return null;
    try {
        if (imgSrc.startsWith('data:image/')) {
            const base64Data = imgSrc.split(',')[1];
            if (!base64Data) return null;
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        } else if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://') || imgSrc.startsWith('blob:')) {
            const resp = await fetch(imgSrc);
            const blob = await resp.blob();
            const arrayBuf = await blob.arrayBuffer();
            return new Uint8Array(arrayBuf);
        }
    } catch (e) {
        console.warn('[Docx Generator] Could not load signature image:', e);
    }
    return null;
};

// Helper to sanitize filename
const cleanFileName = (str) => {
    return String(str || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
};

// Helper to create signature paragraph with image or fallback
const createSignatureParagraph = async (signatureSrc, fallbackName) => {
    const imgBytes = await getImageBuffer(signatureSrc);
    if (imgBytes) {
        try {
            return new Paragraph({
                spacing: { before: 160, after: 120 },
                children: [
                    new ImageRun({
                        data: imgBytes,
                        transformation: { width: 140, height: 45 }
                    })
                ]
            });
        } catch (e) {
            console.warn('[Docx Generator] Error rendering ImageRun:', e);
        }
    }

    if (fallbackName) {
        return new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [
                new TextRun({
                    text: fallbackName,
                    font: FONT_FAMILY,
                    size: FONT_SIZE_HALF_POINTS,
                    bold: true
                })
            ]
        });
    }

    return new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
            new TextRun({
                text: '___________________________',
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_POINTS
            })
        ]
    });
};

/* =========================================================================
 * 1. PI BANK APPLICATION - ISLAMI BANK BANGLADESH PLC (DOCX)
 * ========================================================================= */
export const buildIslamiBankApplicationDocx = async (record) => {
    const bankName = (record.bankName || 'Islami Bank Bangladesh PLC').trim();
    const bankBranch = (record.bankBranch || '').trim();

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

    const subjectText = `Subject: Regarding establishment of a Letter of Credit (L/C) worth US$ ${formattedGrandTotal} at ${formattedMargin} margin for import of ${importItemsText} from ${countryOrigin}.`;
    const p1Text = `Respectfully, I, the proprietor of ${importerName}, am a regular investment account customer and importer of your bank. I have received a proforma invoice for establishment of a Letter of Credit worth US$ ${formattedGrandTotal} from ${countryOrigin} in the name of the company I own. As per the said terms and conditions, I am willing to establish a Letter of Credit at ${formattedMargin} margin within my investment limit. All the charges and margin for issue of Letter of Credit are deposited in my Current Account No. ${accountNo}.`;
    const p2Text = `It is to be noted that I will be discharging the said goods on my own responsibility and storing them in my own warehouse instead of the bank's C&F agent. I have no objection to accepting defective documents.`;
    const p3Text = `Therefore, I request you to take necessary steps for issuing the Letter of Credit.`;

    const importerSign = record.partySignature || record.importerSignature;
    const sigPara = await createSignatureParagraph(importerSign, importerName);

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: [
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: 'To,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: 'Vice President & Branch Head', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: `${bankName ? bankName : 'Islami Bank Bangladesh PLC'}.`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 200 },
                    children: [new TextRun({ text: bankBranch || '............................................................', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 200 },
                    children: [
                        new TextRun({
                            text: subjectText,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_POINTS,
                            bold: true
                        })
                    ]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: 'Respected,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: 'Assalamu Alaikum.', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: p1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: p2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 200 },
                    children: [new TextRun({ text: p3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: 'Assalamu Alaikum.', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: 'Yours faithfully', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                sigPara
            ]
        }]
    });

    return doc;
};

/* =========================================================================
 * 2. PI BANK APPLICATION - NON-ISLAMI BANK (DOCX)
 * ========================================================================= */
export const buildNonIslamiBankApplicationDocx = async (record) => {
    const bankName = (record.bankName || '').trim() || '............................................................';
    const bankBranch = (record.bankBranch || '').trim() || '............................................................';
    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();

    const isMtdr = record.mtdr === true || record.mtdr === 'true';
    let marginVal = '';
    if (isMtdr) {
        const marginNum = parseFloat(record.bankMargin);
        const validMargin = !isNaN(marginNum) ? marginNum : 0;
        const mtdrNum = (record.mtdrValue !== undefined && record.mtdrValue !== null && record.mtdrValue !== '')
            ? parseFloat(record.mtdrValue)
            : Math.max(0, +(100 - validMargin).toFixed(2));
        marginVal = `100% (${validMargin}% Cash + ${mtdrNum}% MTDR)`;
    } else {
        marginVal = (record.bankMargin !== undefined && record.bankMargin !== null && String(record.bankMargin).trim() !== '')
            ? String(record.bankMargin).trim()
            : '100%';
        if (marginVal && !marginVal.endsWith('%')) {
            marginVal += '%';
        }
    }

    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const accountNo = (record.bankAccount || record.accountNo || '............................................................').trim();
    const exporterName = (record.exporterName || record.beneficiaryName || record.supplierName || '............................................................').trim();
    const exporterCountry = (record.exporterCountry || record.countryOrigin || record.country || 'INDIA').trim();

    const piNo = (record.piNumber || '').trim() || '..........';
    const piDate = formatDate(record.date || record.piDate);
    const piNoAndDate = `${piNo} & Date: ${piDate}`;

    const grandTotalNum = parseFloat(record.grandTotal || 0);
    const formattedGrandTotal = grandTotalNum > 0
        ? grandTotalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : (record.grandTotal ? String(record.grandTotal) : '0.00');
    const currency = (record.currency || 'USD').toUpperCase();
    const formattedAmount = `${currency === 'USD' ? 'US$ ' : currency + ' '}${formattedGrandTotal}`;

    const productsList = record.productsList && record.productsList.length > 0
        ? record.productsList
        : (record.productName ? [{ productName: record.productName, quantity: record.grandTotalQuantity }] : []);
    const validProducts = productsList.filter(p => p && (p.productName || p.product));

    let formattedProduct = '';
    if (validProducts.length > 0) {
        const itemsWithQty = validProducts.map(p => {
            const pName = (p.productName || p.product || '').trim();
            const pQtyNum = parseFloat(p.quantity || p.qty || (validProducts.length === 1 ? (record.grandTotalQuantity || record.quantity) : 0) || 0);
            const pQtyStr = pQtyNum > 0
                ? `${pQtyNum.toLocaleString('en-US')} kg`
                : (p.quantity || p.qty || (validProducts.length === 1 ? (record.grandTotalQuantity || record.quantity) : '') ? `${p.quantity || p.qty || record.grandTotalQuantity || record.quantity} kg` : '');
            if (pQtyStr && !pName.toLowerCase().includes('kg')) {
                return `${pQtyStr} ${pName}`;
            }
            return pName;
        }).filter(Boolean);

        if (itemsWithQty.length > 0) {
            formattedProduct = itemsWithQty.join(', ');
        }
    }

    if (!formattedProduct) {
        const qtyNum = parseFloat(record.grandTotalQuantity || record.quantity || 0);
        const formattedQuantity = qtyNum > 0
            ? `${qtyNum.toLocaleString('en-US')} kg`
            : (record.grandTotalQuantity ? `${record.grandTotalQuantity} kg` : '');
        const singleProdName = (record.productName || record.commodity || 'Goods').trim();
        if (formattedQuantity && !singleProdName.toLowerCase().includes('kg')) {
            formattedProduct = `${formattedQuantity} ${singleProdName}`;
        } else {
            formattedProduct = singleProdName;
        }
    }

    const countryOrigin = (record.countryOrigin || 'INDIA').trim();

    const subjectText = `Subject: Application for opening a new Letter of Credit (L/C) with ${marginVal} margin for import transaction.`;
    const introText = `I, ${importerName}, maintaining Account No. ${accountNo} with your branch, hereby request you to kindly open a new Letter of Credit (L/C) in favour of the following beneficiary for the purpose of importing the goods mentioned below:`;

    const particulars = [
        { label: 'Account No.', value: accountNo },
        { label: 'Beneficiary', value: exporterName },
        { label: "Exporter's Country", value: exporterCountry },
        { label: 'Proforma Invoice No. & Date', value: piNoAndDate },
        { label: 'L/C Amount', value: formattedAmount },
        { label: 'Commodity', value: formattedProduct },
        { label: 'Country of Origin', value: countryOrigin }
    ];

    const particularsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
        },
        rows: particulars.map(item => new TableRow({
            children: [
                new TableCell({
                    width: { size: 32, type: WidthType.PERCENTAGE },
                    margins: { top: 40, bottom: 40, left: 0, right: 40 },
                    children: [new Paragraph({ spacing: { line: LINE_SPACING }, children: [new TextRun({ text: item.label, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })]
                }),
                new TableCell({
                    width: { size: 4, type: WidthType.PERCENTAGE },
                    margins: { top: 40, bottom: 40, left: 0, right: 40 },
                    children: [new Paragraph({ spacing: { line: LINE_SPACING }, children: [new TextRun({ text: ':', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })]
                }),
                new TableCell({
                    width: { size: 64, type: WidthType.PERCENTAGE },
                    margins: { top: 40, bottom: 40, left: 0, right: 0 },
                    children: [new Paragraph({ spacing: { line: LINE_SPACING }, children: [new TextRun({ text: item.value, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })]
                })
            ]
        }))
    });

    const p1Text = `We request you to open the above-mentioned L/C in favour of ${exporterName} against the submitted Proforma Invoice and in accordance with the terms and conditions of the Proforma Invoice, your bank's rules and regulations, and all applicable foreign exchange and import policies of Bangladesh.`;
    const p2Text = `We undertake to provide all necessary documents, including the required import documents, margin, bank charges, fees, commissions, and any other papers or requirements as may be requested by the bank for processing and opening the said L/C.`;
    const p3Text = `We shall be grateful if you kindly process our application and arrange to open the L/C at your earliest convenience.`;

    const importerSign = record.partySignature || record.importerSignature;
    const sigPara = await createSignatureParagraph(importerSign, importerName);

    const recipientParas = [
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'To', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'The Head of Branch.', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: bankName, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: bankAddress ? 60 : 180 }, children: [new TextRun({ text: bankBranch, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })
    ];
    if (bankAddress) {
        recipientParas.push(new Paragraph({ spacing: { line: LINE_SPACING, after: 180 }, children: [new TextRun({ text: bankAddress, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }));
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: [
                ...recipientParas,
                new Paragraph({
                    alignment: AlignmentType.LEFT,
                    spacing: { line: LINE_SPACING, after: 200 },
                    children: [new TextRun({ text: subjectText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: 'Dear Sir/Madam,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: introText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 80 },
                    children: [new TextRun({ text: 'L/C Particulars:', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                particularsTable,
                new Paragraph({ spacing: { line: LINE_SPACING, before: 140, after: 160 }, children: [] }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: p3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 80 },
                    children: [new TextRun({ text: 'Thank you for your kind cooperation and assistance.', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: 'Yours faithfully,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                sigPara
            ]
        }]
    });

    return doc;
};

/* =========================================================================
 * 3. AMENDMENT APPLICATION - OPTION 1: VALUE & QUANTITY (DOCX)
 * ========================================================================= */
export const buildIncreaseLcValueQtyAmendmentApplicationDocx = async (record) => {
    const isIslami = isIslamiBank(record);
    const bankHeadTitle = isIslami ? 'Vice President & Branch Head' : 'The Head of Branch.';
    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    const bankBranch = (record.bankBranch || '').trim();
    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();

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

    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const productText = getAllPiProductsText(record);
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;

    const cleanPiNo = String(record.originalPiNumber || record.piNumber || '..........').replace(/\s*\(revised\)/gi, '').trim();
    const piNoRevised = `${cleanPiNo} (Revised)`;
    const rawReviseDate = record.reviseDate || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].reviseDate : null) || record.date;
    const reviseDateFormatted = formatDate(rawReviseDate);

    const {
        increaseVal,
        revisedTotalVal,
        increaseQty,
        revisedTotalQty,
        origTotalVal,
        origTotalQty,
        prodSumValIncrease,
        prodSumQtyIncrease
    } = calculateAmendmentIncreaseValues(record);

    const formattedIncreaseValue = (increaseVal > 0 ? increaseVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedRevisedTotalValue = (revisedTotalVal > 0 ? revisedTotalVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedIncreaseQty = (increaseQty > 0 ? increaseQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formattedRevisedTotalQty = (revisedTotalQty > 0 ? revisedTotalQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const portName = (record.port || record.portOfDischarge || (actualRevs.length > 0 ? (actualRevs[actualRevs.length - 1].port || actualRevs[actualRevs.length - 1].portOfDischarge) : '') || '').trim();
    const origPort = (record.originalPort || record.originalPortOfDischarge || origRev?.port || origRev?.portOfDischarge || '').trim();
    const isPortChanged = Boolean(portName && (!origPort || portName.toLowerCase() !== origPort.toLowerCase()));

    const hasRealValIncrease = (increaseVal > 0.01) || (revisedTotalVal - origTotalVal > 0.01) || (prodSumValIncrease > 0.01);
    const hasRealQtyIncrease = (increaseQty > 0.01) || (revisedTotalQty - origTotalQty > 0.01) || (prodSumQtyIncrease > 0.01);
    const hasRealIncrease = hasRealValIncrease || hasRealQtyIncrease;

    let subjectText = 'Subject: Application for Amendment of L/C Value, Quantity';
    if (!hasRealIncrease) {
        subjectText = portName ? 'Subject: Application for Amendment of Port' : 'Subject: Application for Amendment of L/C';
    }
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;

    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;

    let p3Text = `Please increase the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
    if (!hasRealIncrease) {
        p3Text = portName
            ? `Please amend the port as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`
            : `Please amend the above-mentioned L/C as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;
    }

    const bullets = [];
    if (hasRealIncrease) {
        bullets.push(`Increase in L/C Value: USD ${formattedIncreaseValue}`);
        bullets.push(`Revised Total L/C Value: USD ${formattedRevisedTotalValue}`);
        bullets.push(`Increase in Quantity: ${formattedIncreaseQty} KGS`);
        bullets.push(`Revised Total Quantity: ${formattedRevisedTotalQty} KGS`);
    }
    if ((!hasRealIncrease && portName) || (hasRealIncrease && isPortChanged && portName)) {
        bullets.push(`Revised Port : ${portName.toUpperCase()}`);
    }
    const newIpItems = getNewlyAddedIpDetails(record);
    newIpItems.forEach(item => {
        bullets.push(`Include ${item.productName} under I.P. No. ${item.ipNo}, dated ${item.ipDate}.`);
    });

    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p5Text = `Thank you for your kind cooperation and assistance.`;

    const importerSign = record.partySignature || record.importerSignature;
    const sigPara = await createSignatureParagraph(importerSign, importerName);

    const recipientParas = [
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'To,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: bankHeadTitle, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: `${bankName ? bankName : '............................................................'}.`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: bankAddress && !isIslami ? 60 : 180 }, children: [new TextRun({ text: bankBranch || '............................................................', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })
    ];
    if (bankAddress && !isIslami) {
        recipientParas.push(new Paragraph({ spacing: { line: LINE_SPACING, after: 180 }, children: [new TextRun({ text: bankAddress, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }));
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: [
                ...recipientParas,
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: subjectText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: referenceText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: 'Dear Sir,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: p3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                ...bullets.map(b => new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    indent: { left: 400 },
                    children: [new TextRun({ text: `•   ${b}`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                })),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, before: 120, after: 160 },
                    children: [new TextRun({ text: p4Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 80 },
                    children: [new TextRun({ text: p5Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: 'Yours faithfully,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                sigPara
            ]
        }]
    });

    return doc;
};

/* =========================================================================
 * 4. AMENDMENT APPLICATION - OPTION 2: COMMODITY & VALUE (DOCX)
 * ========================================================================= */
export const buildCommodityDescriptionAndValueAmendmentApplicationDocx = async (record) => {
    const isIslami = isIslamiBank(record);
    const bankHeadTitle = isIslami ? 'Vice President & Branch Head' : 'The Head of Branch.';
    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    const bankBranch = (record.bankBranch || '').trim();
    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();

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

    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;

    const productText = getAllPiProductsText(record);
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    const cleanPiNo = String(record.originalPiNumber || record.piNumber || '..........').replace(/\s*\(revised\)/gi, '').trim();
    const piNoRevised = `${cleanPiNo} (Revised)`;
    const rawReviseDate = record.reviseDate || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].reviseDate : null) || record.date;
    const reviseDateFormatted = formatDate(rawReviseDate);

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

    const subjectText = 'Subject: Application for Amendment of Commodity Description and Value';
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;

    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;
    const p3Text = `Please increase the L/C value and quantity as per Proforma Invoice No. ${piNoRevised}, dated ${reviseDateFormatted} , as follows:`;

    const portName = (record.port || record.portOfDischarge || (actualRevs.length > 0 ? (actualRevs[actualRevs.length - 1].port || actualRevs[actualRevs.length - 1].portOfDischarge) : '') || '').trim();
    const origPort = (record.originalPort || record.originalPortOfDischarge || origRev?.port || origRev?.portOfDischarge || '').trim();
    const isPortChanged = Boolean(portName && (!origPort || portName.toLowerCase() !== origPort.toLowerCase()));
    const hasRealDiff = (decreaseVal > 0.01) || (decreaseQty > 0.01) || (Math.abs(revisedTotalVal - origTotalVal) > 0.01) || (Math.abs(revisedTotalQty - origTotalQty) > 0.01);

    const bullets = [];
    if (hasRealDiff) {
        bullets.push(`Decrease in L/C Value: USD ${formattedDecreaseValue}`);
        bullets.push(`Revised Total L/C Value: USD ${formattedRevisedTotalValue}`);
        bullets.push(`Decrease in Quantity: ${formattedDecreaseQty} KGS`);
        bullets.push(`Revised Total Quantity: ${formattedRevisedTotalQty} KGS`);
    }
    if ((!hasRealDiff && portName) || (hasRealDiff && isPortChanged && portName)) {
        bullets.push(`Revised Port : ${portName.toUpperCase()}`);
    }
    const newIpItems = getNewlyAddedIpDetails(record);
    newIpItems.forEach(item => {
        bullets.push(`Include ${item.productName} under I.P. No. ${item.ipNo}, dated ${item.ipDate}.`);
    });

    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p5Text = `Thank you for your kind cooperation and assistance.`;

    const importerSign = record.partySignature || record.importerSignature;
    const sigPara = await createSignatureParagraph(importerSign, importerName);

    const recipientParas = [
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'To,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: bankHeadTitle, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: `${bankName ? bankName : '............................................................'}.`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: bankAddress && !isIslami ? 60 : 180 }, children: [new TextRun({ text: bankBranch || '............................................................', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })
    ];
    if (bankAddress && !isIslami) {
        recipientParas.push(new Paragraph({ spacing: { line: LINE_SPACING, after: 180 }, children: [new TextRun({ text: bankAddress, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }));
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: [
                ...recipientParas,
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: subjectText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: referenceText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: 'Dear Sir,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: p3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                ...bullets.map(b => new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    indent: { left: 400 },
                    children: [new TextRun({ text: `•   ${b}`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                })),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, before: 120, after: 160 },
                    children: [new TextRun({ text: p4Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 80 },
                    children: [new TextRun({ text: p5Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: 'Yours faithfully,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                sigPara
            ]
        }]
    });

    return doc;
};

/* =========================================================================
 * 5. AMENDMENT APPLICATION - OPTION 3: EXTENSION OF DATES (DOCX)
 * ========================================================================= */
export const buildExtensionOfDatesAmendmentApplicationDocx = async (record) => {
    const isIslami = isIslamiBank(record);
    const bankHeadTitle = isIslami ? 'Vice President & Branch Head' : 'The Head of Branch.';
    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    const bankBranch = (record.bankBranch || '').trim();
    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();

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

    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const latestRev = actualRevs.length > 0 ? actualRevs[actualRevs.length - 1] : null;

    const productText = getAllPiProductsText(record);
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

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

    const subjectText = 'Subject: Application for Amendment of Extension of Shipment and Expiry Dates';
    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;

    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;
    const p3Text = `Please extend the latest date of shipment up to ${formattedShipmentDate} and the expiry date up to ${formattedExpiryDate}, as required.`;
    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p5Text = `Thank you for your kind cooperation and assistance.`;

    const importerSign = record.partySignature || record.importerSignature;
    const sigPara = await createSignatureParagraph(importerSign, importerName);

    const recipientParas = [
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'To,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: bankHeadTitle, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: `${bankName ? bankName : '............................................................'}.`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: bankAddress && !isIslami ? 60 : 180 }, children: [new TextRun({ text: bankBranch || '............................................................', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })
    ];
    if (bankAddress && !isIslami) {
        recipientParas.push(new Paragraph({ spacing: { line: LINE_SPACING, after: 180 }, children: [new TextRun({ text: bankAddress, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }));
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: [
                ...recipientParas,
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: subjectText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: referenceText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: 'Dear Sir,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 160 },
                    children: [new TextRun({ text: p4Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 80 },
                    children: [new TextRun({ text: p5Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: 'Yours faithfully,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                sigPara
            ]
        }]
    });

    return doc;
};

/* =========================================================================
 * 6. AMENDMENT APPLICATION - MERGED (DOCX)
 * ========================================================================= */
export const buildMergedAmendmentApplicationDocx = async (record, selections) => {
    const { hasOption1, hasOption2, hasOption3 } = selections || getAmendmentSelections(record);
    const isIslami = isIslamiBank(record);
    const bankHeadTitle = isIslami ? 'Vice President & Branch Head' : 'The Head of Branch.';
    const bankName = (record.bankName || (isIslami ? 'Islami Bank Bangladesh PLC' : '')).trim();
    const bankBranch = (record.bankBranch || '').trim();
    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();

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

    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const actualRevs = (record.revisions && Array.isArray(record.revisions))
        ? record.revisions.filter(r => !r.isOriginal && r.reviseNo !== 'Original PI' && !r.isTenPercent)
        : [];
    const origRev = (record.revisions && Array.isArray(record.revisions))
        ? (record.revisions.find(r => r.isOriginal || r.reviseNo === 'Original PI') || record.revisions[0])
        : null;
    const latestRev = actualRevs.length > 0 ? actualRevs[actualRevs.length - 1] : null;

    const productText = getAllPiProductsText(record);
    const rawCountry = (record.countryOrigin || 'India').trim();
    const countryOrigin = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();

    const cleanPiNo = String(record.originalPiNumber || record.piNumber || '..........').replace(/\s*\(revised\)/gi, '').trim();
    const piNoRevised = `${cleanPiNo} (Revised)`;
    const rawReviseDate = record.reviseDate || (actualRevs.length > 0 ? actualRevs[actualRevs.length - 1].reviseDate : null) || record.date;
    const reviseDateFormatted = formatDate(rawReviseDate);

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

    const referenceText = `Reference: L/C No. ${lcNo} dated ${lcDate}.`;

    const p1Text = `With due respect, I would like to state that I, on behalf of ${importerName}, am a valued customer and regular importer of your branch. I have opened the above-mentioned Letter of Credit (L/C) in the name of my proprietorship concern for the import of ${productText} from ${countryOrigin} for the local market.`;
    const p2Text = `Due to business requirements and necessary adjustments to the import documents, I would like to request you to kindly arrange the following amendments to the above-mentioned L/C: ${lcNo}`;

    const {
        increaseVal,
        revisedTotalVal,
        increaseQty,
        revisedTotalQty,
        origTotalVal,
        origTotalQty
    } = calculateAmendmentIncreaseValues(record);
    const isValIncrease = revisedTotalVal >= origTotalVal;
    const diffVal = increaseVal;

    const isQtyIncrease = revisedTotalQty >= origTotalQty;
    const diffQty = increaseQty;

    const formattedDiffValue = (diffVal > 0 ? diffVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedRevisedTotalValue = (revisedTotalVal > 0 ? revisedTotalVal : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDiffQty = (diffQty > 0 ? diffQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formattedRevisedTotalQty = (revisedTotalQty > 0 ? revisedTotalQty : 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

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

    const bullets = [];
    const portName = (record.port || record.portOfDischarge || (actualRevs.length > 0 ? (actualRevs[actualRevs.length - 1].port || actualRevs[actualRevs.length - 1].portOfDischarge) : '') || '').trim();
    const origPort = (record.originalPort || record.originalPortOfDischarge || origRev?.port || origRev?.portOfDischarge || '').trim();
    const isPortChanged = Boolean(portName && (!origPort || portName.toLowerCase() !== origPort.toLowerCase()));
    const hasRealValDiff = Math.abs(revisedTotalVal - origTotalVal) > 0.01;
    const hasRealQtyDiff = Math.abs(revisedTotalQty - origTotalQty) > 0.01;
    const hasRealDifference = hasRealValDiff || hasRealQtyDiff;

    if (hasOption1 || hasOption2) {
        if (hasRealDifference) {
            const valAction = (hasOption2 && !hasOption1 && !isValIncrease) ? 'Decrease in L/C Value' : (isValIncrease ? 'Increase in L/C Value' : 'Decrease in L/C Value');
            const qtyAction = (hasOption2 && !hasOption1 && !isQtyIncrease) ? 'Decrease in Quantity' : (isQtyIncrease ? 'Increase in Quantity' : 'Decrease in Quantity');

            bullets.push(`${valAction}: USD ${formattedDiffValue}`);
            bullets.push(`Revised Total L/C Value: USD ${formattedRevisedTotalValue}`);
            bullets.push(`${qtyAction}: ${formattedDiffQty} KGS`);
            bullets.push(`Revised Total Quantity: ${formattedRevisedTotalQty} KGS`);
        }
    }
    if ((!hasRealDifference && portName) || (hasRealDifference && isPortChanged && portName)) {
        bullets.push(`Revised Port : ${portName.toUpperCase()}`);
    }
    const newIpItems = getNewlyAddedIpDetails(record);
    newIpItems.forEach(item => {
        bullets.push(`Include ${item.productName} under I.P. No. ${item.ipNo}, dated ${item.ipDate}.`);
    });

    const p4Text = `In view of the above, I would be grateful if you would kindly take the necessary steps to amend the above-mentioned L/C in accordance with the details stated above. I undertake to complete all required formalities and pay the applicable bank charges in connection with the amendments.`;
    const p5Text = `Thank you for your kind cooperation and assistance.`;

    const importerSign = record.partySignature || record.importerSignature;
    const sigPara = await createSignatureParagraph(importerSign, importerName);

    const recipientParas = [
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'To,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: bankHeadTitle, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: `${bankName ? bankName : '............................................................'}.`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
        new Paragraph({ spacing: { line: LINE_SPACING, after: bankAddress && !isIslami ? 60 : 180 }, children: [new TextRun({ text: bankBranch || '............................................................', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })
    ];
    if (bankAddress && !isIslami) {
        recipientParas.push(new Paragraph({ spacing: { line: LINE_SPACING, after: 180 }, children: [new TextRun({ text: bankAddress, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }));
    }

    const docChildren = [
        ...recipientParas,
        new Paragraph({
            spacing: { line: LINE_SPACING, after: 60 },
            children: [new TextRun({ text: subjectText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
        }),
        new Paragraph({
            spacing: { line: LINE_SPACING, after: 180 },
            children: [new TextRun({ text: referenceText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
        }),
        new Paragraph({
            spacing: { line: LINE_SPACING, after: 160 },
            children: [new TextRun({ text: 'Dear Sir,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: LINE_SPACING, after: 160 },
            children: [new TextRun({ text: p1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: LINE_SPACING, after: 160 },
            children: [new TextRun({ text: p2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: LINE_SPACING, after: 140 },
            children: [new TextRun({ text: p3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        ...bullets.map(b => new Paragraph({
            spacing: { line: LINE_SPACING, after: 60 },
            indent: { left: 400 },
            children: [new TextRun({ text: `•   ${b}`, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }))
    ];

    if (hasOption3) {
        const extText = `Also please extend the latest date of shipment up to ${formattedShipmentDate} and the expiry date up to ${formattedExpiryDate}, as required.`;
        docChildren.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: LINE_SPACING, before: 100, after: 140 },
                children: [new TextRun({ text: extText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
            })
        );
    }

    docChildren.push(
        new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: LINE_SPACING, before: 120, after: 160 },
            children: [new TextRun({ text: p4Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        new Paragraph({
            spacing: { line: LINE_SPACING, after: 80 },
            children: [new TextRun({ text: p5Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        new Paragraph({
            spacing: { line: LINE_SPACING, after: 100 },
            children: [new TextRun({ text: 'Yours faithfully,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
        }),
        sigPara
    );

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: docChildren
        }]
    });

    return doc;
};

/* =========================================================================
 * 7. DISPATCHER: GENERATE BANK APPLICATION DOCX FOR PI
 * ========================================================================= */
export const generateBankApplicationDocx = async (record) => {
    if (!record) return false;

    try {
        const selections = getAmendmentSelections(record);
        let doc = null;

        if (selections.isAmendment) {
            if (selections.count > 1) {
                doc = await buildMergedAmendmentApplicationDocx(record, selections);
            } else if (selections.hasOption3) {
                doc = await buildExtensionOfDatesAmendmentApplicationDocx(record);
            } else if (selections.hasOption2) {
                doc = await buildCommodityDescriptionAndValueAmendmentApplicationDocx(record);
            } else if (selections.hasOption1) {
                doc = await buildIncreaseLcValueQtyAmendmentApplicationDocx(record);
            } else {
                doc = await buildIncreaseLcValueQtyAmendmentApplicationDocx(record);
            }
        } else if (isIslamiBank(record)) {
            doc = await buildIslamiBankApplicationDocx(record);
        } else {
            doc = await buildNonIslamiBankApplicationDocx(record);
        }

        const blob = await Packer.toBlob(doc);
        const piNum = cleanFileName(record.piNumber || record.originalPiNumber || 'Draft');
        const prefix = selections.isAmendment ? 'Amendment_Bank_Application' : 'Bank_Application';
        const fileName = `${prefix}_${piNum}.docx`;

        await downloadFile(blob, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return true;
    } catch (err) {
        console.error('[Docx Generator] Error generating Bank Application DOCX:', err);
        throw err;
    }
};

/* =========================================================================
 * 8. BANK NOC APPLICATION - PACKING LIST (DOCX)
 * ========================================================================= */
export const buildNocApplicationDocx = async (record, context = {}) => {
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
    const pi = (piRecords || []).find(p => (p.piNumber || '').trim().toLowerCase() === cleanPiNumber.toLowerCase());
    const lc = (lcRecords || []).find(l => l.lcNo === (record.lcNumber || record.lcNo || pi?.lcNumber));
    const importer = (importers || []).find(imp => (imp.name || '').toLowerCase().trim() === (record.partyName || '').toLowerCase().trim());
    const exporter = (exporters || []).find(exp => (exp.name || '').toLowerCase().trim() === (record.exporterName || '').toLowerCase().trim());

    // Resolve Bank & Branch
    const bankName = (record.bankName || lc?.bankName || pi?.bankName || '').trim() || 'Islami Bank Bangladesh PLC';
    let branchName = (record.branchName || lc?.bankBranch || pi?.bankBranch || '').trim();
    const matchedBank = Array.isArray(banks)
        ? banks.find(b => (b.bankName || '').toLowerCase().trim() === bankName.toLowerCase().trim())
        : null;
    if (!branchName && matchedBank && matchedBank.branches && matchedBank.branches.length > 0) {
        branchName = matchedBank.branches[0].branch || '';
    }

    const fmt = String(record.applicationFormat || '').toLowerCase().trim();
    const isIslami = fmt.includes('islami') || (!fmt.includes('non-islami') && !fmt.includes('general') && (bankName.toLowerCase().includes('islami') || bankName.toLowerCase().includes('ibbl')));
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
    const rawLcDate = lc?.openingDate || lc?.lcDate || record.lcDate || pi?.lcDate || '';
    const lcDate = rawLcDate ? formatDate(rawLcDate) : '';

    // Resolve Importer & Exporter Names
    const importerName = (record.partyName || importer?.name || '').trim();

    // Resolve Products and Commodity Display
    const rawProducts = Array.isArray(record.productsList) && record.productsList.length > 0
        ? record.productsList
        : (pi?.productsList || []);

    const productDisplays = [];
    rawProducts.forEach(item => {
        const pName = (item.productName || '').trim();
        if (!pName) return;

        if (pName.includes('(') && pName.includes(')')) {
            productDisplays.push(pName);
            return;
        }

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

    // Resolve Quantity
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

    // Resolve USD Value
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

    const countryOrigin = (record.countryOrigin || pi?.countryOrigin || 'INDIA').trim().toUpperCase();

    const rawPort = (record.portOfDischarge || pi?.portOfDischarge || 'Benapole Land Port').trim();
    const cleanPortName = rawPort.replace(/land\s*port/gi, '').replace(/port/gi, '').trim() || 'Benapole';
    const portOfEntryDisplay = `${cleanPortName} Land Port`;

    const branchText = branchName ? `${branchName} branch` : 'branch';

    const subjectText = `Subject: Request for Issuance of NOC and Endorsement of Documents against L/C No. ${lcNo || '....................'} dated ${lcDate || '....................'} for ${productDisplay} Import.`;
    const body1Text = `With due respect, I would like to state that I am the proprietor of ${importerName || '............................................................'} , a regular business customer and importer of your ${branchText}. An L/C of USD ${formattedUsdValue} was opened in the name of my proprietorship concern for importing ${formattedQty} kg of ${productDisplay} from ${countryOrigin} .`;

    const detailRows = [
        { label: 'L/C No.', value: lcNo || '....................' },
        { label: 'Date', value: lcDate || '....................' },
        { label: 'Commodity', value: productDisplay || 'Goods' },
        { label: 'Quantity', value: `${formattedQty} kg` },
        { label: 'L/C Value', value: `USD ${formattedUsdValue}` },
        { label: 'Country of Origin', value: countryOrigin },
        { label: 'Port of Entry', value: portOfEntryDisplay }
    ];

    const detailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE }
        },
        rows: detailRows.map(row => new TableRow({
            children: [
                new TableCell({
                    width: { size: 28, type: WidthType.PERCENTAGE },
                    margins: { top: 35, bottom: 35, left: 0, right: 30 },
                    children: [new Paragraph({ spacing: { line: LINE_SPACING }, children: [new TextRun({ text: row.label, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })]
                }),
                new TableCell({
                    width: { size: 4, type: WidthType.PERCENTAGE },
                    margins: { top: 35, bottom: 35, left: 0, right: 30 },
                    children: [new Paragraph({ spacing: { line: LINE_SPACING }, children: [new TextRun({ text: ':', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })]
                }),
                new TableCell({
                    width: { size: 68, type: WidthType.PERCENTAGE },
                    margins: { top: 35, bottom: 35, left: 0, right: 0 },
                    children: [new Paragraph({ spacing: { line: LINE_SPACING }, children: [new TextRun({ text: row.value, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] })]
                })
            ]
        }))
    });

    const body2Text = `The goods under the above-mentioned L/C have already arrived at ${cleanPortName} Land Port. In order to complete the customs clearance and release the goods, NOC/necessary endorsement along with copies of the required documents is required.`;
    const body3Text = `Therefore, I would highly appreciate it if you kindly issue the necessary NOC and provide/endorse the required copy documents at your earliest convenience so that I can complete the customs clearance process and release the imported goods without further delay.`;
    const body4Text = `I further confirm that I have no objection or restriction regarding the acceptance of the required documents for the above purpose.`;
    const body5Text = `Your kind cooperation in this regard will be highly appreciated.`;

    const signatureImage = record.partySignature || pi?.partySignature || importer?.signature || record.importerSignature || '';
    const sigPara = await createSignatureParagraph(signatureImage, importerName);

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: MARGIN_LETTERHEAD_TOP,
                        bottom: MARGIN_BOTTOM,
                        left: MARGIN_SIDE,
                        right: MARGIN_SIDE
                    }
                }
            },
            children: [
                new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: 'To,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
                new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: branchHeadTitle, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
                new Paragraph({ spacing: { line: LINE_SPACING, after: 60 }, children: [new TextRun({ text: bankName, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
                new Paragraph({ spacing: { line: LINE_SPACING, after: 180 }, children: [new TextRun({ text: branchDisplay, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })] }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 180 },
                    children: [new TextRun({ text: subjectText, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS, bold: true })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: 'Dear Sir,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: body1Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 60 },
                    children: [new TextRun({ text: 'The relevant details are as follows:', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                detailsTable,
                new Paragraph({ spacing: { line: LINE_SPACING, before: 120, after: 140 }, children: [] }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: body2Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: body3Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    alignment: AlignmentType.JUSTIFIED,
                    spacing: { line: LINE_SPACING, after: 140 },
                    children: [new TextRun({ text: body4Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: body5Text, font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                new Paragraph({
                    spacing: { line: LINE_SPACING, after: 100 },
                    children: [new TextRun({ text: 'Yours faithfully,', font: FONT_FAMILY, size: FONT_SIZE_HALF_POINTS })]
                }),
                sigPara
            ]
        }]
    });

    return doc;
};

/* =========================================================================
 * 9. DISPATCHER: GENERATE BANK NOC APPLICATION DOCX FOR PL
 * ========================================================================= */
export const generateNocApplicationDocx = async (record, context = {}) => {
    if (!record) return false;

    try {
        const doc = await buildNocApplicationDocx(record, context);
        const blob = await Packer.toBlob(doc);
        const namePart = cleanFileName(record.packingListNumber || record.lcNo || record.lcNumber || 'PL');
        const fileName = `Bank_NOC_Application_${namePart}.docx`;

        await downloadFile(blob, fileName, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        return true;
    } catch (err) {
        console.error('[Docx Generator] Error generating NOC Application DOCX:', err);
        throw err;
    }
};
