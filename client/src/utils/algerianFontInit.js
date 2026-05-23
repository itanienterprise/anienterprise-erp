import { jsPDF } from 'jspdf';
import { AlgerianBase64 } from './algerianFont';

let initialized = false;
let vfsAdded = false;

/** Register Algerian on every new jsPDF document (recommended jsPDF custom-font pattern). */
export const initAlgerianFont = () => {
    if (initialized) return;
    initialized = true;

    const callAddFont = function addAlgerianFont() {
        try {
            if (!vfsAdded) {
                this.addFileToVFS('Algerian.ttf', AlgerianBase64);
                vfsAdded = true;
            }
            this.addFont('Algerian.ttf', 'Algerian', 'normal');
        } catch (e) {
            console.warn('Algerian font registration failed:', e);
        }
    };

    jsPDF.API.events.push(['addFonts', callAddFont]);
};

initAlgerianFont();
