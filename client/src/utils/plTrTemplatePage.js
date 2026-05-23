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
    noY: 0.418,
    dateY: 0.445,
    valueMaxWidth: 0.2
};

const drawConsignmentNoteFields = (doc, record, pageX, pageY, pageWidth, pageHeight) => {
    const trNo = String(record?.trNumber || '').trim();
    const trDate = formatTrDate(record?.trDate);
    if (!trNo && !trDate) return;

    const layout = TR_TEMPLATE_LAYOUT;
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
