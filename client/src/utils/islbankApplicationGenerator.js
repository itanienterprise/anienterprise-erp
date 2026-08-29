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

    let marginVal = (record.bankMargin !== undefined && record.bankMargin !== null && String(record.bankMargin).trim() !== '')
        ? String(record.bankMargin).trim()
        : '';
    if (marginVal && !marginVal.endsWith('%')) {
        marginVal += '%';
    }
    const formattedMargin = marginVal || '......%';

    const qtyNum = parseFloat(record.grandTotalQuantity || 0);
    const formattedQuantity = qtyNum > 0
        ? `${qtyNum.toLocaleString('en-US')} kg`
        : (record.grandTotalQuantity ? `${record.grandTotalQuantity} kg` : '.................... kg');

    const productsList = record.productsList && record.productsList.length > 0
        ? record.productsList
        : (record.productName ? [{ productName: record.productName }] : []);
    const productNames = productsList.map(p => p.productName).filter(Boolean);
    const formattedProduct = productNames.length > 0 ? productNames.join(', ') : (record.productName || 'Goods');

    const countryOrigin = (record.countryOrigin || 'INDIA').trim();
    const importerName = (record.partyName || record.buyerName || record.importerName || '............................................................').trim();
    const accountNo = (record.bankAccount || record.accountNo || '............................................................').trim();

    // Subject Line (Bold, Justified)
    doc.setFont('times', 'bold');
    const subjectText = `Subject: Regarding establishment of a Letter of Credit (L/C) worth US$ ${formattedGrandTotal} at ${formattedMargin} margin for import of ${formattedQuantity} ${formattedProduct} from ${countryOrigin}.`;
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
 * Dispatcher: Render the Bank Application Letter content based on Bank / Format
 * If bank is Islami Bank Bangladesh PLC -> renderIslamiBankApplication
 * If bank is any non-Islami bank -> renderNonIslamiBankApplication
 * @param {jsPDF} doc - jsPDF instance
 * @param {Object} record - PI Record data
 */
export const renderBankApplicationContent = (doc, record) => {
    if (!doc || !record) return;

    if (isIslamiBank(record)) {
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

