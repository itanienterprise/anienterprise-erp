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

/** Positions on JAIN PARIVAHAN TR template (ratios of rendered image). */
const TR_TEMPLATE_LAYOUT = {
    landscape: {
        valueX: 0.756,
        // Lines beside "No." / "Date." in CONSIGNMENT NOTE box (above "From")
        noY: 0.418,
        dateY: 0.445,
        valueMaxWidth: 0.2,
        fontSize: 9
    },
    portrait: {
        valueX: 0.768,
        noY: 0.558,
        dateY: 0.592,
        valueMaxWidth: 0.2,
        fontSize: 10
    }
};

/**
 * Overlay TR No / TR Date on the Consignment Note "No." and "Date" lines
 * (header box above From / To — not the To box or charges table).
 */
const drawConsignmentNoteFields = (doc, record, imgX, imgY, imgWidth, imgHeight, imgProps) => {
    const trNo = String(record?.trNumber || '').trim();
    const trDate = formatTrDate(record?.trDate);
    if (!trNo && !trDate) return;

    const isLandscape = (imgProps?.width || imgWidth) >= (imgProps?.height || imgHeight);
    const layout = isLandscape ? TR_TEMPLATE_LAYOUT.landscape : TR_TEMPLATE_LAYOUT.portrait;

    const valueX = imgX + imgWidth * layout.valueX;
    const valueMaxWidth = imgWidth * layout.valueMaxWidth;
    const noY = imgY + imgHeight * layout.noY;
    const dateY = imgY + imgHeight * layout.dateY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(layout.fontSize);
    doc.setTextColor(0, 0, 0);

    if (trNo) {
        doc.text(trNo, valueX, noY, { maxWidth: valueMaxWidth });
    }
    if (trDate) {
        doc.text(trDate, valueX, dateY, { maxWidth: valueMaxWidth });
    }
};

/**
 * Appends a new PDF page with the TR Setup format image used as a full-page template.
 * Matches packing list record.trName to TR Setup name.
 * Overlays TR No and TR Date on the Consignment Note section.
 */
export const appendTrTemplatePage = (doc, record, trSetups = [], options = {}) => {
    const margin = options.margin ?? 10;
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
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgProps = doc.getImageProperties(trFormat);
        const fileType = imgProps.fileType || 'PNG';
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;

        let imgWidth = maxWidth;
        let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = (imgProps.width * imgHeight) / imgProps.height;
        }

        const x = margin + (maxWidth - imgWidth) / 2;
        const y = margin + (maxHeight - imgHeight) / 2;

        doc.addPage();
        doc.addImage(trFormat, fileType, x, y, imgWidth, imgHeight);
        drawConsignmentNoteFields(doc, record, x, y, imgWidth, imgHeight, imgProps);
        return true;
    } catch (e) {
        console.error('Error adding TR template page:', e);
        return false;
    }
};
