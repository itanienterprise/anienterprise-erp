import jsPDF from 'jspdf';

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
 * Render Format: Non-Islami Bank Bangladesh PLC Application Letter
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record data
 */
export const renderNonIslamiBankApplication = (doc, record) => {
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
    doc.text('To', marginLeft, currentY);
    currentY += 5.5;
    doc.text('The Head of Branch.', marginLeft, currentY);
    currentY += 5.5;

    const bankName = (record.bankName || '').trim() || '............................................................';
    doc.text(bankName, marginLeft, currentY);
    currentY += 5.5;

    const bankBranch = (record.bankBranch || '').trim() || '............................................................';
    doc.text(bankBranch, marginLeft, currentY);
    currentY += 5.5;

    const bankAddress = (record.bankAddress || record.branchAddress || record.bankBranchAddress || '').trim();
    if (bankAddress) {
        doc.text(bankAddress, marginLeft, currentY);
        currentY += 5.5;
    }
    currentY += 4;

    // Margin determination (defaults to 100%)
    let marginVal = (record.bankMargin !== undefined && record.bankMargin !== null && String(record.bankMargin).trim() !== '')
        ? String(record.bankMargin).trim()
        : '100%';
    if (marginVal && !marginVal.endsWith('%')) {
        marginVal += '%';
    }

    // Subject Line (Bold)
    doc.setFont('times', 'bold');
    const subjectText = `Subject: Application for opening a new Letter of Credit (L/C) with ${marginVal} margin for import transaction.`;
    const subjectLines = doc.splitTextToSize(subjectText, contentWidth);
    doc.text(subjectText, marginLeft, currentY, { maxWidth: contentWidth, align: 'left', lineHeightFactor: 1.3 });
    currentY += (subjectLines.length * 5.5) + 4;

    // Salutation
    doc.setFont('times', 'normal');
    doc.text('Dear Sir/Madam,', marginLeft, currentY);
    currentY += 6.5;

    // Values extraction
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const accountNo = (record.bankAccount || record.accountNo || '............................................................').trim();
    const exporterName = (record.exporterName || record.beneficiaryName || record.supplierName || '............................................................').trim();
    const exporterCountry = (record.exporterCountry || record.countryOrigin || record.country || 'INDIA').trim();

    // PI Number & Date
    const piNo = (record.piNumber || '').trim() || '..........';
    const piDate = formatDate(record.date || record.piDate);
    const piNoAndDate = `${piNo} & Date: ${piDate}`;

    // L/C Amount & Currency
    const grandTotalNum = parseFloat(record.grandTotal || 0);
    const formattedGrandTotal = grandTotalNum > 0
        ? grandTotalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : (record.grandTotal ? String(record.grandTotal) : '0.00');
    const currency = (record.currency || 'USD').toUpperCase();
    const formattedAmount = `${currency === 'USD' ? 'US$ ' : currency + ' '}${formattedGrandTotal}`;

    // Commodity / Description of goods
    const productsList = record.productsList && record.productsList.length > 0
        ? record.productsList
        : (record.productName ? [{ productName: record.productName }] : []);
    const productNames = productsList.map(p => p.productName).filter(Boolean);
    const formattedProduct = productNames.length > 0 ? productNames.join(', ') : (record.productName || record.commodity || 'Goods');

    const countryOrigin = (record.countryOrigin || 'INDIA').trim();

    // Body Opening Paragraph (Justified)
    const introText = `I, ${importerName}, maintaining Account No. ${accountNo} with your branch, hereby request you to kindly open a new Letter of Credit (L/C) in favour of the following beneficiary for the purpose of importing the goods mentioned below:`;
    const introLines = doc.splitTextToSize(introText, contentWidth);
    doc.text(introText, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (introLines.length * 5.5) + 4;

    // L/C Particulars Header
    doc.text('L/C Particulars:', marginLeft, currentY);
    currentY += 6;

    // Particulars Table
    const particulars = [
        { label: 'Account No.', value: accountNo },
        { label: 'Beneficiary', value: exporterName },
        { label: "Exporter's Country", value: exporterCountry },
        { label: 'Proforma Invoice No. & Date', value: piNoAndDate },
        { label: 'L/C Amount', value: formattedAmount },
        { label: 'Commodity', value: formattedProduct },
        { label: 'Country of Origin', value: countryOrigin }
    ];

    const labelColWidth = 54;
    const colonX = marginLeft + labelColWidth;
    const valX = colonX + 4;
    const valMaxWidth = contentWidth - labelColWidth - 4;

    particulars.forEach(item => {
        doc.setFont('times', 'normal');
        doc.text(item.label, marginLeft, currentY);
        doc.text(':', colonX, currentY);

        const valLines = doc.splitTextToSize(item.value, valMaxWidth);
        doc.text(valLines, valX, currentY);
        currentY += Math.max(valLines.length * 5.2, 5.5);
    });

    currentY += 4;

    // Body Paragraph 1 (Justified)
    const p1Text = `We request you to open the above-mentioned L/C in favour of ${exporterName} against the submitted Proforma Invoice and in accordance with the terms and conditions of the Proforma Invoice, your bank's rules and regulations, and all applicable foreign exchange and import policies of Bangladesh.`;
    const p1Lines = doc.splitTextToSize(p1Text, contentWidth);
    doc.text(p1Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p1Lines.length * 5.5) + 4;

    // Body Paragraph 2 (Justified)
    const p2Text = `We undertake to provide all necessary documents, including the required import documents, margin, bank charges, fees, commissions, and any other papers or requirements as may be requested by the bank for processing and opening the said L/C.`;
    const p2Lines = doc.splitTextToSize(p2Text, contentWidth);
    doc.text(p2Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p2Lines.length * 5.5) + 4;

    // Body Paragraph 3 (Justified)
    const p3Text = `We shall be grateful if you kindly process our application and arrange to open the L/C at your earliest convenience.`;
    const p3Lines = doc.splitTextToSize(p3Text, contentWidth);
    doc.text(p3Text, marginLeft, currentY, { maxWidth: contentWidth, align: 'justify', lineHeightFactor: 1.35 });
    currentY += (p3Lines.length * 5.5) + 5;

    // Closing
    doc.text('Thank you for your kind cooperation and assistance.', marginLeft, currentY);
    currentY += 7;

    doc.text('Yours faithfully,', marginLeft, currentY);
    currentY += 5;

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
 * Generate Non-Islami Bank Application Letter PDF standalone for a Proforma Invoice (PI)
 * @param {Object} record - PI Record data
 */
export const generateNonIslamiBankApplicationPDF = (record) => {
    if (!record) return;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    renderNonIslamiBankApplication(doc, record);

    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
};
