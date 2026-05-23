/**
 * Appends a new PDF page with the TR Setup format image used as a full-page template.
 * Matches packing list record.trName to TR Setup name.
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
        return true;
    } catch (e) {
        console.error('Error adding TR template page:', e);
        return false;
    }
};
