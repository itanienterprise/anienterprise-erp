import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    XIcon, BoxIcon, EyeIcon, PDFIcon, DownloadIcon, FileTextIcon,
    CalendarIcon, MapPinIcon, ShieldIcon, BuildingIcon, UserIcon, CheckIcon
} from '../../Icons';
import { formatDate } from '../../../utils/helpers';

// Helper modal specifically for viewing attached PDFs
export const PDFViewerModal = ({ pdfData, fileName, onClose, onDownload }) => {
    if (!pdfData || typeof document === 'undefined' || !document.body) return null;

    const handleDownload = () => {
        if (onDownload) {
            onDownload();
            return;
        }
        const link = document.createElement('a');
        link.href = pdfData;
        link.download = fileName || 'Document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300 z-10">
                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm border border-blue-100/50 shrink-0">
                            <PDFIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm md:text-xl font-black text-gray-900 truncate tracking-tight">{fileName || 'Document.pdf'}</h3>
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className="text-[9px] md:text-xs font-black text-blue-600 uppercase tracking-widest">Secure Viewer</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 ml-3">
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-3 md:px-6 py-2.5 md:py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 text-[10px] md:text-sm cursor-pointer"
                        >
                            <DownloadIcon className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden xs:inline">Download</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 md:p-3 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all active:scale-90 border border-transparent hover:border-red-100 cursor-pointer"
                        >
                            <XIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>

                {/* PDF Content Area */}
                <div className="flex-1 bg-gray-50/50 relative overflow-hidden">
                    <iframe
                        src={pdfData}
                        className="w-full h-full border-none shadow-inner"
                        title="PDF Viewer"
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 text-center">
                    <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        Press <span className="text-gray-600">ESC</span> or click outside to close viewer
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

// Main IP Details Modal / Card Component
export const IPDetailsModal = ({
    ipRecord,
    lcRecords = [],
    ipRecords = [],
    allStockRecords = [],
    allSalesRecords = [],
    piRecords = [],
    employeesMap = {},
    currentPi = null,
    onClose
}) => {
    const [viewingPdf, setViewingPdf] = useState(null);
    const [viewingPdfName, setViewingPdfName] = useState('');

    const cleanLc = (val) => String(val || '').replace(/\D/g, '');

    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    };

    const resolveEntryByName = (code, name) => {
        if (!code && !name) return '';
        const cleanName = String(name || '').trim();
        const cleanCode = String(code || '').trim();
        if (cleanName && !cleanName.startsWith('E-') && !cleanName.startsWith('A-') && cleanName !== cleanCode && cleanName !== '—') {
            return cleanName;
        }
        if (cleanCode && employeesMap[cleanCode]) return employeesMap[cleanCode];
        if (cleanName && employeesMap[cleanName]) return employeesMap[cleanName];
        if (cleanName && cleanName !== '—') return cleanName;
        if (cleanCode && cleanCode !== '—') return cleanCode;
        return '';
    };

    const getLcQtyForIpInKg = (lc, ip, includeTolerance = true) => {
        const targetIpNo = String(ip?.ipNumber || '').trim();
        const targetIpNoClean = cleanLc(targetIpNo);
        const targetIpId = String(ip?._id || '');

        let lcIpNos = Array.isArray(lc?.ipNumbers) && lc.ipNumbers.length > 0
            ? lc.ipNumbers.map(s => String(s).trim()).filter(Boolean)
            : (lc?.ipNo ? lc.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);

        if (lcIpNos.length === 0 && Array.isArray(lc?.ipDetails) && lc.ipDetails.length > 0) {
            lcIpNos = lc.ipDetails.map(d => String(d.ipNo || d.ipNumber || '').trim()).filter(Boolean);
        }

        const isMatchIp = !targetIpNo || lcIpNos.length === 0 || lcIpNos.some(n => {
            const cleanN = cleanLc(n);
            return n === targetIpNo || (cleanN && cleanN === targetIpNoClean);
        }) || (lc?.ipId && targetIpId && String(lc.ipId) === targetIpId) ||
           (Array.isArray(lc?.ipDetails) && lc.ipDetails.some(d => String(d.ipId || d._id || '') === targetIpId));

        if (!isMatchIp) {
            return 0;
        }

        const targetProductName = (ip?.productName || '').toLowerCase().trim();
        let baseQtyKg = 0;

        if (Array.isArray(lc?.productsList) && lc.productsList.length > 0) {
            const matchedProducts = lc.productsList.filter(p => {
                const name = (p.productName || p.product || p.name || '').toLowerCase().trim();
                return !targetProductName || name === targetProductName || name.includes(targetProductName) || targetProductName.includes(name);
            });
            if (matchedProducts.length > 0) {
                baseQtyKg = matchedProducts.reduce((sum, p) => {
                    const q = parseNum(p.quantity || p.qty);
                    return sum + (q < 50000 ? q * 1000 : q);
                }, 0);
            }
        }
        if (baseQtyKg === 0 && Array.isArray(lc?.items) && lc.items.length > 0) {
            const matchedProducts = lc.items.filter(i => {
                const name = (i.productName || i.product || i.name || '').toLowerCase().trim();
                return !targetProductName || name === targetProductName || name.includes(targetProductName) || targetProductName.includes(name);
            });
            if (matchedProducts.length > 0) {
                baseQtyKg = matchedProducts.reduce((sum, i) => {
                    const q = parseNum(i.quantity || i.qty);
                    return sum + (q < 50000 ? q * 1000 : q);
                }, 0);
            }
        }
        if (baseQtyKg === 0) {
            const lcProd = (lc?.productName || lc?.product || '').toLowerCase().trim();
            if (!targetProductName || !lcProd || lcProd === targetProductName || lcProd.includes(targetProductName) || targetProductName.includes(lcProd)) {
                const q = parseNum(lc?.quantity || lc?.totalQuantity || lc?.lcQuantity || lc?.totalQty || lc?.qty);
                if (q > 0) baseQtyKg = q < 50000 ? q * 1000 : q;
            }
        }

        // Add tolerance extra qty if tolerance is enabled and this IP is the designated one
        if (includeTolerance && baseQtyKg > 0 && lc?.enableValueQtyAdjustment && lc?.adjustedQuantity) {
            const ipNo = String(ip?.ipNumber || '').trim();
            const toleranceIpNo = String(lc?.toleranceIpNo || lcIpNos[0] || '').trim();
            if (ipNo && (ipNo === toleranceIpNo || cleanLc(ipNo) === cleanLc(toleranceIpNo))) {
                const adjQtyRaw = parseNum(lc.adjustedQuantity);
                const adjQtyKg = adjQtyRaw < 50000 ? adjQtyRaw * 1000 : adjQtyRaw;
                const extraKg = Math.max(0, adjQtyKg - baseQtyKg);
                baseQtyKg += extraKg;
            }
        }

        return baseQtyKg;
    };

    const getLcStates = (lc) => {
        if (!lc) return [];
        const amendments = lc.amendments || [];
        const hasOriginal = amendments.some(a => a.amendmentNo === 'Original LC');

        const getIpFieldsForState = (amnd) => {
            let ipNumbers = [];
            if (Array.isArray(amnd?.ipNumbers) && amnd.ipNumbers.length > 0) {
                ipNumbers = amnd.ipNumbers.map(s => String(s).trim()).filter(Boolean);
            } else if (amnd?.ipNo) {
                ipNumbers = amnd.ipNo.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (ipNumbers.length === 0) {
                if (Array.isArray(lc.ipNumbers) && lc.ipNumbers.length > 0) {
                    ipNumbers = lc.ipNumbers.map(s => String(s).trim()).filter(Boolean);
                } else if (lc.ipNo) {
                    ipNumbers = lc.ipNo.split(',').map(s => s.trim()).filter(Boolean);
                }
            }
            if (ipNumbers.length === 0) {
                const statePiNo = amnd?.piNo || lc.piNo || '';
                if (statePiNo) {
                    const clean = cleanLc(statePiNo);
                    const matchingPi = (piRecords || []).find(p => p.piNumber === statePiNo || cleanLc(p.piNumber) === clean);
                    if (matchingPi) {
                        if (Array.isArray(matchingPi.ipNumbers) && matchingPi.ipNumbers.length > 0) {
                            ipNumbers = matchingPi.ipNumbers.map(s => String(s).trim()).filter(Boolean);
                        } else if (matchingPi.ipNumber) {
                            ipNumbers = matchingPi.ipNumber.split(',').map(s => s.trim()).filter(Boolean);
                        }
                    }
                }
            }
            return {
                ipNumbers,
                ipNo: ipNumbers.join(','),
            };
        };

        if (hasOriginal) {
            return amendments.map((amnd, idx) => {
                const isLast = idx === amendments.length - 1;
                const ipFields = getIpFieldsForState(amnd);
                return {
                    ...amnd,
                    isOriginal: amnd.amendmentNo === 'Original LC',
                    _isLastState: isLast,
                    enableValueQtyAdjustment: isLast ? lc.enableValueQtyAdjustment : false,
                    toleranceIpNo: lc.toleranceIpNo,
                    adjustedQuantity: isLast ? lc.adjustedQuantity : null,
                    productsList: amnd.productsList && amnd.productsList.length > 0 ? amnd.productsList : (lc.productsList || []),
                    productName: amnd.productName || amnd.product || lc.productName || lc.product,
                    ...ipFields,
                };
            });
        }

        const toleranceFields = {
            enableValueQtyAdjustment: amendments.length === 0 ? lc.enableValueQtyAdjustment : false,
            toleranceIpNo: lc.toleranceIpNo,
            adjustedQuantity: amendments.length === 0 ? lc.adjustedQuantity : null,
        };

        if (amendments.length === 0) {
            const ipFields = getIpFieldsForState(lc);
            return [{
                amendmentNo: 'Original LC',
                amendmentDate: lc.openingDate,
                expiryDate: lc.expiryDate,
                quantity: lc.quantity,
                rate: lc.rate,
                dollarRate: lc.dollarRate,
                totalDollar: lc.totalDollar,
                totalAmount: lc.totalAmount,
                remarks: 'Original LC Details',
                productsList: lc.productsList || [],
                productName: lc.productName || lc.product,
                isOriginal: true,
                _isLastState: true,
                ...toleranceFields,
                ...ipFields,
            }];
        }

        const origIpFields = getIpFieldsForState({ piNo: amendments[0]?.piNo || lc.piNo });
        const states = [{
            amendmentNo: 'Original LC',
            amendmentDate: lc.openingDate,
            expiryDate: lc.expiryDate || lc.openingDate,
            quantity: amendments[0]?.quantity || lc.quantity,
            rate: amendments[0]?.rate || lc.rate,
            dollarRate: amendments[0]?.dollarRate || lc.dollarRate,
            totalDollar: amendments[0]?.totalDollar || lc.totalDollar,
            totalAmount: amendments[0]?.totalAmount || lc.totalAmount,
            remarks: 'Original LC Details',
            productsList: amendments[0]?.productsList || lc.productsList || [],
            productName: amendments[0]?.productName || amendments[0]?.product || lc.productName || lc.product,
            isOriginal: true,
            _isLastState: false,
            enableValueQtyAdjustment: false,
            toleranceIpNo: lc.toleranceIpNo,
            adjustedQuantity: null,
            ...origIpFields,
        }];

        amendments.forEach((amnd, idx) => {
            const isLast = idx === amendments.length - 1;
            const ipFields = getIpFieldsForState(amnd);
            states.push({
                ...amnd,
                isOriginal: false,
                _isLastState: isLast,
                enableValueQtyAdjustment: isLast ? lc.enableValueQtyAdjustment : false,
                toleranceIpNo: lc.toleranceIpNo,
                adjustedQuantity: isLast ? lc.adjustedQuantity : null,
                productsList: amnd.productsList && amnd.productsList.length > 0 ? amnd.productsList : (lc.productsList || []),
                productName: amnd.productName || amnd.product || lc.productName || lc.product,
                ...ipFields,
            });
        });

        return states;
    };

    const isLcLinkedToIpModal = (lc, ip) => {
        if (!lc || !ip) return false;
        const ipNo = String(ip.ipNumber || '').trim();
        const ipNoClean = cleanLc(ipNo);
        const ipIdStr = String(ip._id || '');

        if (Array.isArray(lc.ipNumbers) && lc.ipNumbers.length > 0) {
            if (lc.ipNumbers.some(n => {
                const str = String(n).trim();
                return str === ipNo || (cleanLc(str) && cleanLc(str) === ipNoClean);
            })) return true;
        }

        const singleIp = String(lc.ipNo || lc.ipNumber || lc.ip_number || lc.ipRef || '').trim();
        if (singleIp) {
            const parts = singleIp.split(',').map(s => s.trim()).filter(Boolean);
            if (parts.some(n => n === ipNo || (cleanLc(n) && cleanLc(n) === ipNoClean))) return true;
        }

        const lcIpId = String(lc.ipId || lc.ipRecordId || lc.ip_id || '');
        if (lcIpId && ipIdStr && lcIpId === ipIdStr) return true;

        if (Array.isArray(lc.ipDetails) && lc.ipDetails.length > 0) {
            if (lc.ipDetails.some(d => {
                const dNo = String(d.ipNo || d.ipNumber || '').trim();
                const dId = String(d.ipId || d._id || '');
                return dNo === ipNo || (cleanLc(dNo) && cleanLc(dNo) === ipNoClean) || (dId && dId === ipIdStr);
            })) return true;
        }

        // 5. Linked via amendments
        if (Array.isArray(lc.amendments) && lc.amendments.length > 0) {
            if (lc.amendments.some(amnd => {
                const amndIps = Array.isArray(amnd.ipNumbers) && amnd.ipNumbers.length > 0
                    ? amnd.ipNumbers.map(s => String(s).trim())
                    : (amnd.ipNo ? String(amnd.ipNo).split(',').map(s => s.trim()) : []);
                return amndIps.some(n => n === ipNo || (cleanLc(n) && cleanLc(n) === ipNoClean));
            })) return true;
        }

        // 6. Linked via PI (Proforma Invoice) if LC has no explicit IP fields
        const hasExplicitIp = (Array.isArray(lc.ipNumbers) && lc.ipNumbers.length > 0) ||
            !!(lc.ipNo || lc.ipNumber || lc.ip_number || lc.ipRef || lc.ipId || lc.ipRecordId || lc.ip_id) ||
            (Array.isArray(lc.ipDetails) && lc.ipDetails.length > 0);

        if (!hasExplicitIp && Array.isArray(piRecords) && piRecords.length > 0) {
            const lcPiNo = String(lc.piNo || lc.piNumber || '').trim();
            const lcPiId = String(lc.piId || lc.pi_id || '');
            if (lcPiNo || lcPiId) {
                const matchingPi = piRecords.find(pi => {
                    if (lcPiId && String(pi._id || '') === lcPiId) return true;
                    if (lcPiNo && String(pi.piNo || pi.piNumber || '').trim() === lcPiNo) return true;
                    return false;
                });
                if (matchingPi) {
                    const piIps = Array.isArray(matchingPi.ipNumbers) && matchingPi.ipNumbers.length > 0
                        ? matchingPi.ipNumbers.map(s => String(s).trim())
                        : String(matchingPi.ipNo || matchingPi.ipNumber || '').split(',').map(s => s.trim()).filter(Boolean);
                    if (piIps.some(n => n === ipNo || (cleanLc(n) && cleanLc(n) === ipNoClean))) return true;
                }
            }
        }

        return false;
    };

    const relatedLCs = lcRecords.filter(lc => isLcLinkedToIpModal(lc, ipRecord));

    // Linked PIs matching this IP (supporting original, revisions, and active currentPi)
    const relatedPIs = useMemo(() => {
        const targetIpNo = String(ipRecord?.ipNumber || '').trim();
        const targetIpNoClean = cleanLc(targetIpNo);
        if (!targetIpNo) return [];

        const list = (piRecords || []).filter(pi => {
            const piIps = [];
            if (Array.isArray(pi.revisions) && pi.revisions.length > 0) {
                pi.revisions.forEach(rev => {
                    if (Array.isArray(rev.ipNumbers) && rev.ipNumbers.length > 0) {
                        piIps.push(...rev.ipNumbers.map(s => String(s).trim()).filter(Boolean));
                    } else if (rev.ipNumber) {
                        piIps.push(...String(rev.ipNumber).split(',').map(s => s.trim()).filter(Boolean));
                    }
                });
            }
            if (Array.isArray(pi.ipNumbers) && pi.ipNumbers.length > 0) {
                piIps.push(...pi.ipNumbers.map(s => String(s).trim()).filter(Boolean));
            } else if (pi.ipNumber) {
                piIps.push(...String(pi.ipNumber).split(',').map(s => s.trim()).filter(Boolean));
            }
            return piIps.some(n => {
                const str = String(n).trim();
                return str === targetIpNo || (cleanLc(str) && cleanLc(str) === targetIpNoClean);
            });
        });

        if (currentPi && !list.some(p => String(p._id || p.piNumber) === String(currentPi._id || currentPi.piNumber))) {
            list.unshift(currentPi);
        }

        return list;
    }, [piRecords, ipRecord?.ipNumber, currentPi]);

    const getLcReceiveQty = (lc) => {
        if (!lc) return 0;
        const lcNoClean = cleanLc(lc.lcNo);
        if (!lcNoClean) return 0;

        const hasCustomReceive = lc.updatedLcReceive !== undefined && lc.updatedLcReceive !== null && lc.updatedLcReceive !== '';
        if (hasCustomReceive) {
            return parseNum(lc.updatedLcReceive);
        }

        const receiptsMapForBalance = {};
        allStockRecords
            .filter(s => {
                const recordLcNoClean = cleanLc(s.lcNo);
                const status = (s.status || '').toLowerCase();
                return recordLcNoClean === lcNoClean && (status === 'accepted' || status === 'in stock');
            })
            .forEach(s => {
                const rawDate = s.date || s.receiveDate || s.createdAt || '';
                const dateStr = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                const groupVal = s.totalLcQuantity || s.billOfEntry || s.totalLcTruck || s.truckNo || s.truck || 'single';
                const key = `${dateStr}_${groupVal}`;

                if (!receiptsMapForBalance[key]) {
                    const itemSubtotal = (s.entries || []).reduce((iSum, item) => iSum + parseNum(item.inHouseQuantity || item.quantity), 0);
                    receiptsMapForBalance[key] = parseNum(s.totalLcQuantity) || itemSubtotal || parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                } else {
                    if (!s.totalLcQuantity) {
                        receiptsMapForBalance[key] += parseNum(s.inHouseQuantity) || parseNum(s.quantity);
                    }
                }
            });
        const receivedQtyKg = Object.values(receiptsMapForBalance).reduce((sum, qty) => sum + qty, 0);

        const borderSaleQtyKg = allSalesRecords
            .filter(s => {
                const matchesLc = !!lcNoClean && (
                    (s.lcNo && cleanLc(s.lcNo) === lcNoClean) ||
                    (s.lcNumber && cleanLc(s.lcNumber) === lcNoClean) ||
                    (s.lc_no && cleanLc(s.lc_no) === lcNoClean) ||
                    (s.items && s.items.some(i => (i.lcNo && cleanLc(i.lcNo) === lcNoClean) || (i.brandEntries && i.brandEntries.some(b => b.lcNo && cleanLc(b.lcNo) === lcNoClean))))
                );
                const sTypeLow = (s.saleType || '').toLowerCase().trim();
                const isBorder = (sTypeLow === 'border' || sTypeLow === 'border sale' || (s.invoiceNo || '').toUpperCase().startsWith('BS') || s.isBorderSale === true) && sTypeLow !== 'general' && sTypeLow !== 'warehouse';
                const status = (s.status || '').toLowerCase();
                const isValidStatus = !status.includes('rejected') && status !== 'requested';
                return matchesLc && isValidStatus && isBorder;
            })
            .reduce((sum, s) => {
                const itemSubtotal = (s.items || []).reduce((iSum, item) => {
                    const brandSubtotal = (item.brandEntries || []).reduce((bSum, b) => bSum + parseNum(b.quantity), 0);
                    return iSum + (brandSubtotal || parseNum(item.quantity));
                }, 0);
                const qty = parseNum(s.currentTotalQty) || parseNum(s.totalQuantity) || parseNum(s.totalQty) || parseNum(s.qty) || parseNum(s.quantity) || parseNum(s.total) || itemSubtotal;
                return sum + qty;
            }, 0);

        return receivedQtyKg + borderSaleQtyKg;
    };

    const getLcReceiveQtyForIp = (lc) => {
        const totalConsumption = getLcReceiveQty(lc);
        const targetIpNo = String(ipRecord.ipNumber || '').trim();
        const targetIpNoClean = cleanLc(targetIpNo);

        const lcIpNos = Array.isArray(lc.ipNumbers) && lc.ipNumbers.length > 0
            ? lc.ipNumbers.map(s => String(s).trim()).filter(Boolean)
            : (lc.ipNo ? lc.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);

        if (lcIpNos.length <= 1) {
            return totalConsumption;
        }

        let remainingConsumption = totalConsumption;
        for (const ipNo of lcIpNos) {
            const ipRecordForNo = (ipRecords || []).find(ip => {
                const num = String(ip.ipNumber || '').trim();
                return num === ipNo || (cleanLc(num) && cleanLc(num) === cleanLc(ipNo));
            }) || ipRecord;
            const allocatedQtyForIp = getLcConsumptionFromIp(lc, lc, true, ipRecordForNo);
            const consumedFromIp = Math.min(allocatedQtyForIp, remainingConsumption);
            remainingConsumption = Math.max(0, remainingConsumption - consumedFromIp);

            if (ipNo === targetIpNo || cleanLc(ipNo) === targetIpNoClean) {
                return consumedFromIp;
            }
        }
        return totalConsumption;
    };

    const getLcConsumptionFromIp = (stateOrLc, parentLc, includeTolerance = true, targetIp = null) => {
        const parent = parentLc || stateOrLc;
        const currentIp = targetIp || ipRecord;
        const targetIpNo = String(currentIp.ipNumber || '').trim();
        const targetIpNoClean = cleanLc(targetIpNo);

        const parentIps = Array.isArray(parent.ipNumbers) && parent.ipNumbers.length > 0
            ? parent.ipNumbers.map(s => String(s).trim()).filter(Boolean)
            : (parent.ipNo ? parent.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);

        const stateIps = Array.isArray(stateOrLc.ipNumbers) && stateOrLc.ipNumbers.length > 0
            ? stateOrLc.ipNumbers.map(s => String(s).trim()).filter(Boolean)
            : (stateOrLc.ipNo ? stateOrLc.ipNo.split(',').map(s => s.trim()).filter(Boolean) : (parentIps.length > 0 ? parentIps : []));

        const matchesStateIp = stateIps.length === 0 || stateIps.some(n => n === targetIpNo || (cleanLc(n) && cleanLc(n) === targetIpNoClean)) || isLcLinkedToIpModal(parent, currentIp);
        if (!matchesStateIp) return 0;

        const lcIpNos = parentIps.length > 0 ? parentIps : stateIps;
        const toleranceIpNo = String(parent.toleranceIpNo || lcIpNos[0] || '').trim();
        const toleranceIp = (ipRecords || []).find(ip => {
            const ipNum = String(ip.ipNumber || '').trim();
            return ipNum === toleranceIpNo || (cleanLc(ipNum) && cleanLc(ipNum) === cleanLc(toleranceIpNo));
        }) || currentIp;

        const totalQtyKg = getLcQtyForIpInKg(stateOrLc, toleranceIp, includeTolerance);
        if (lcIpNos.length <= 1) return totalQtyKg;
        if (!lcIpNos.some(n => n === targetIpNo || (cleanLc(n) && cleanLc(n) === targetIpNoClean))) return totalQtyKg;

        const sortedLcs = [...lcRecords].sort((a, b) => new Date(a.openingDate || a.createdAt || 0) - new Date(b.openingDate || b.createdAt || 0));

        const tempCaps = {};
        (ipRecords || []).forEach(ip => {
            const ipNo = String(ip.ipNumber || '').trim();
            if (ipNo) tempCaps[ipNo] = parseNum(ip.quantity) || 0;
        });

        for (const lc of sortedLcs) {
            const isCurrentLc = String(lc._id) === String(parent._id) || lc.lcNo === parent.lcNo;
            const currentLcToleranceIpNo = String(lc.toleranceIpNo || (lc.ipNumbers && lc.ipNumbers[0]) || (lc.ipNo && lc.ipNo.split(',')[0]) || '').trim();
            const currentLcToleranceIp = (ipRecords || []).find(ip => {
                const ipNum = String(ip.ipNumber || '').trim();
                return ipNum === currentLcToleranceIpNo || (cleanLc(ipNum) && cleanLc(ipNum) === cleanLc(currentLcToleranceIpNo));
            }) || ipRecord;

            const lcQty = getLcQtyForIpInKg(lc, currentLcToleranceIp);
            if (lcQty <= 0) continue;

            let linkedIpNos = Array.isArray(lc.ipNumbers) && lc.ipNumbers.length > 0
                ? lc.ipNumbers.map(s => String(s).trim()).filter(Boolean)
                : (lc.ipNo ? lc.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);

            if (linkedIpNos.length === 0) {
                linkedIpNos = (ipRecords || []).filter(ip => isLcLinkedToIpModal(lc, ip)).map(ip => String(ip.ipNumber || '').trim()).filter(Boolean);
            }

            let remLc = isCurrentLc ? totalQtyKg : lcQty;
            for (const ipNo of linkedIpNos) {
                if (remLc <= 0) break;

                let toleranceQtyKg = 0;
                if (includeTolerance && lc.enableValueQtyAdjustment && lc.adjustedQuantity) {
                    const lcIpNosList = Array.isArray(lc.ipNumbers) && lc.ipNumbers.length > 0
                        ? lc.ipNumbers.map(s => String(s).trim()).filter(Boolean)
                        : (lc.ipNo ? lc.ipNo.split(',').map(s => s.trim()).filter(Boolean) : []);
                    const tIpNo = String(lc.toleranceIpNo || lcIpNosList[0] || '').trim();
                    if (ipNo === tIpNo || (cleanLc(ipNo) && cleanLc(ipNo) === cleanLc(tIpNo))) {
                        const baseQty = getLcQtyForIpInKg(lc, ipRecord, false);
                        const adjQtyRaw = parseNum(lc.adjustedQuantity);
                        const adjQtyKg = adjQtyRaw < 50000 ? adjQtyRaw * 1000 : adjQtyRaw;
                        toleranceQtyKg = Math.max(0, adjQtyKg - baseQty);
                    }
                }

                const cap = (tempCaps[ipNo] ?? remLc) + toleranceQtyKg;
                const take = Math.min(cap, remLc);

                if (isCurrentLc && (ipNo === targetIpNo || cleanLc(ipNo) === targetIpNoClean)) {
                    return take;
                }

                const baseTake = Math.max(0, take - toleranceQtyKg);
                tempCaps[ipNo] = Math.max(0, (tempCaps[ipNo] ?? baseTake) - baseTake);
                remLc -= take;
            }
        }

        return totalQtyKg;
    };

    // Target active PI context (if opened from a specific PI or found in relatedPIs)
    const activePiContext = currentPi || ipRecord.currentPi || (relatedPIs.length === 1 ? relatedPIs[0] : null);
    const resolvedParty = ipRecord.ipParty || activePiContext?.partyName || (relatedPIs[0]?.partyName) || '—';
    const resolvedExporter = activePiContext?.exporterName || ipRecord.exporterName || ipRecord.exporter || (relatedPIs[0]?.exporterName) || '—';
    const resolvedProduct = ipRecord.productName || activePiContext?.productName || (activePiContext?.productsList?.[0]?.productName) || (relatedPIs[0]?.productName) || '—';
    const resolvedPort = ipRecord.port || activePiContext?.port || activePiContext?.portOfLoading || activePiContext?.portOfDischarge || (relatedPIs[0]?.port) || '—';
    const resolvedOpeningDate = ipRecord.openingDate || activePiContext?.date || (relatedPIs[0]?.date) || '';
    const resolvedCloseDate = ipRecord.closeDate || activePiContext?.validityDate || (relatedPIs[0]?.validityDate) || '';
    const resolvedReferenceNo = ipRecord.referenceNo || activePiContext?.buyerOrderNo || activePiContext?.piNumber || (relatedPIs[0]?.buyerOrderNo) || '—';

    const resolvedEntryByName = resolveEntryByName(ipRecord.entryBy, ipRecord.entryByName) ||
        resolveEntryByName(activePiContext?.entryBy, activePiContext?.entryByName) ||
        resolveEntryByName(relatedPIs[0]?.entryBy, relatedPIs[0]?.entryByName) ||
        '—';

    // Calculate core quantities for this IP
    const totalLcQtyKg = relatedLCs.reduce((sum, lc) => sum + getLcConsumptionFromIp(lc, lc), 0);
    const totalLcReceiveQtyKg = relatedLCs.reduce((sum, lc) => sum + getLcReceiveQtyForIp(lc), 0);
    const ipQtyKg = parseNum(ipRecord.quantity) || parseNum(activePiContext?.grandTotalQuantity || activePiContext?.quantity) || 0;
    const ipRemQtyKg = Math.max(0, ipQtyKg - totalLcQtyKg); // LC REM: remaining capacity to open LCs
    const ipBalanceKg = Math.max(0, ipQtyKg - totalLcReceiveQtyKg); // IP Balance: physical unreceived balance

    // Compute IP Validity Status & Countdown
    const { computedStatus, validityDaysText, isExtendedFinal } = useMemo(() => {
        let isExt = ipRecord.isExtended;
        const openDateStr = ipRecord.openingDate || resolvedOpeningDate;
        const closeDateStr = ipRecord.closeDate || resolvedCloseDate;

        if (!isExt && openDateStr && closeDateStr) {
            const openDate = new Date(openDateStr);
            const closeDateObj = new Date(closeDateStr);
            if (!isNaN(openDate.getTime()) && !isNaN(closeDateObj.getTime())) {
                const diffDaysBetween = Math.round((closeDateObj.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDaysBetween > 121) isExt = true;
            }
        }

        if (ipRecord.computedStatus) {
            return { computedStatus: ipRecord.computedStatus, validityDaysText: '', isExtendedFinal: isExt };
        }

        if (!closeDateStr) {
            return { computedStatus: ipRecord.status || 'Active', validityDaysText: '', isExtendedFinal: isExt };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const close = new Date(closeDateStr);
        close.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((close - today) / (1000 * 60 * 60 * 24));

        let status = 'Active';
        let text = '';
        if (close < today) {
            status = 'Expired';
            text = `${Math.abs(diffDays)} days ago`;
        } else if (diffDays <= 5) {
            status = 'Expire Soon';
            text = `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
        } else if (isExt) {
            status = 'Extended';
            text = `${diffDays} days left`;
        } else {
            text = `${diffDays} days left`;
        }

        return { computedStatus: status, validityDaysText: text, isExtendedFinal: isExt };
    }, [ipRecord, resolvedOpeningDate, resolvedCloseDate]);

    const statusStyle = computedStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        computedStatus === 'Expired' ? 'bg-rose-50 text-rose-700 border-rose-200' :
            computedStatus === 'Extended' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-amber-50 text-amber-700 border-amber-200';

    if (!ipRecord || typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-7xl animate-in zoom-in duration-300 flex flex-col max-h-[92vh] overflow-hidden z-10">
                {/* Header - Fixed at top */}
                <div className="bg-white px-5 sm:px-7 py-4.5 border-b border-gray-100 flex items-center justify-between z-20 shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 shadow-sm border border-blue-100/60 shrink-0">
                            <ShieldIcon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                                    Import Permit (IP) Details
                                </h3>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${statusStyle}`}>
                                    <span>{computedStatus}</span>
                                    {validityDaysText && (
                                        <span className="opacity-75 font-mono text-[9px] font-bold">({validityDaysText})</span>
                                    )}
                                </span>
                                {isExtendedFinal && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-purple-50 text-purple-700 border border-purple-200">
                                        Extended
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-500 font-bold tracking-wide mt-1 truncate">
                                IP No: <span className="font-mono font-black text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/60">{ipRecord.ipNumber}</span>
                                {resolvedParty !== '—' && (
                                    <>
                                        <span className="mx-2 text-gray-300">•</span>
                                        <span className="text-gray-700 font-semibold">{resolvedParty}</span>
                                    </>
                                )}
                                {resolvedExporter !== '—' && (
                                    <>
                                        <span className="mx-2 text-gray-300">•</span>
                                        <span className="text-gray-500 font-medium">Exp: {resolvedExporter}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all active:scale-90 border border-transparent hover:border-red-100 shrink-0 cursor-pointer"
                        title="Close Modal"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="overflow-y-auto flex-1 px-5 sm:px-7 py-5 custom-scrollbar space-y-6">
                    {/* Originating / Current Proforma Invoice (PI) Banner (when opened from PI) */}
                    {activePiContext && (
                        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-blue-50/70 border border-blue-200/90 rounded-2xl p-4 shadow-2xs">
                            <div className="flex items-center justify-between gap-3 mb-2.5 pb-2.5 border-b border-blue-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                                        Active Proforma Invoice
                                    </span>
                                    <span className="font-mono font-black text-blue-900 text-sm">{activePiContext.piNumber}</span>
                                    {activePiContext.revisions && activePiContext.revisions.length > 0 && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                            Revised
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-blue-800 font-mono">Date: {formatDate(activePiContext.date)}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block mb-0.5">Importer</span>
                                    <span className="font-bold text-gray-900 truncate block" title={activePiContext.partyName}>{activePiContext.partyName || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block mb-0.5">Exporter</span>
                                    <span className="font-bold text-gray-900 truncate block" title={activePiContext.exporterName}>{activePiContext.exporterName || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block mb-0.5">PI Quantity</span>
                                    <span className="font-mono font-black text-gray-900 block">
                                        {(parseFloat(activePiContext.grandTotalQuantity || activePiContext.quantity) || 0).toLocaleString('en-US')} kg
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block mb-0.5">PI Grand Total</span>
                                    <span className="font-mono font-black text-blue-700 block">
                                        ${(parseFloat(activePiContext.grandTotal) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top IP Details Information Card */}
                    <div className="bg-gradient-to-br from-gray-50/80 via-white to-gray-50/50 rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs">
                        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                    <FileTextIcon className="w-4 h-4" />
                                </div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">General IP Information</h4>
                            </div>
                            {ipRecord.ipAttachment && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewingPdf(ipRecord.ipAttachment);
                                        setViewingPdfName(ipRecord.ipAttachmentName || `IP_${ipRecord.ipNumber}.pdf`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                                    title="Preview Attached PDF"
                                >
                                    <PDFIcon className="w-3.5 h-3.5 text-red-600" />
                                    <span className="max-w-[140px] truncate">{ipRecord.ipAttachmentName || 'Attached Document'}</span>
                                </button>
                            )}
                        </div>

                        {/* Metadata Details Grid - 8 Key Attributes */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 text-xs">
                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">IP Number</span>
                                <span className="font-mono font-black text-blue-700 text-sm">{ipRecord.ipNumber || '—'}</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Importer / Party</span>
                                <span className="font-bold text-gray-800 truncate block" title={resolvedParty}>{resolvedParty}</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Exporter</span>
                                <span className="font-bold text-gray-800 truncate block" title={resolvedExporter}>{resolvedExporter}</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Product</span>
                                <span className="font-bold text-gray-800 truncate block" title={resolvedProduct}>{resolvedProduct}</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Port</span>
                                <span className="font-bold text-gray-800 truncate block" title={resolvedPort}>{resolvedPort}</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Issue / Opening Date</span>
                                <div className="flex items-center gap-1 font-mono font-bold text-gray-700">
                                    <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{formatDate(resolvedOpeningDate)}</span>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Expiry / Close Date</span>
                                <div className="flex items-center gap-1 font-mono font-bold text-rose-600">
                                    <CalendarIcon className="w-3.5 h-3.5 text-rose-400" />
                                    <span>{formatDate(resolvedCloseDate)}</span>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Reference No.</span>
                                <span className="font-bold text-gray-700 truncate block">{resolvedReferenceNo}</span>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Entry By</span>
                                <div className="flex items-center gap-1 font-bold text-gray-700 truncate">
                                    <UserIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{resolvedEntryByName}</span>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Attachment Status</span>
                                {ipRecord.ipAttachment ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                        <PDFIcon className="w-3.5 h-3.5 text-emerald-500" /> Attached
                                    </span>
                                ) : (
                                    <span className="text-gray-400 font-medium">None</span>
                                )}
                            </div>
                        </div>

                        {ipRecord.isPlaceholder && (
                            <div className="mt-3.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-800 text-xs flex items-center gap-2">
                                <span>ℹ️</span>
                                <span>This IP was referenced from a Proforma Invoice record. Complete registration in IP Management is pending.</span>
                            </div>
                        )}
                    </div>

                    {/* Summary KPI Metrics - 5 Key Quantity Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-blue-100 transition-all group">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">IP Quantity</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-gray-900 truncate">{ipQtyKg.toLocaleString('en-US')}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Kg</span>
                            </div>
                            {ipQtyKg >= 1000 && (
                                <span className="text-[10px] font-semibold text-gray-400 mt-0.5 block">
                                    {(ipQtyKg / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} MT
                                </span>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-indigo-100 transition-all group">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">Total LC (Used)</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-gray-900 truncate">{totalLcQtyKg.toLocaleString('en-US')}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Kg</span>
                            </div>
                            {totalLcQtyKg >= 1000 && (
                                <span className="text-[10px] font-semibold text-gray-400 mt-0.5 block">
                                    {(totalLcQtyKg / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} MT
                                </span>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-emerald-100 transition-all group">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${ipRemQtyKg <= 0 ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">LC REM (Quota)</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black truncate ${ipRemQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                    {ipRemQtyKg.toLocaleString('en-US')}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Kg</span>
                            </div>
                            {ipRemQtyKg >= 1000 && (
                                <span className="text-[10px] font-semibold text-gray-400 mt-0.5 block">
                                    {(ipRemQtyKg / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} MT
                                </span>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-amber-100 transition-all group">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">LC Received</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-gray-900 truncate">{totalLcReceiveQtyKg.toLocaleString('en-US')}</span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Kg</span>
                            </div>
                            {totalLcReceiveQtyKg >= 1000 && (
                                <span className="text-[10px] font-semibold text-gray-400 mt-0.5 block">
                                    {(totalLcReceiveQtyKg / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} MT
                                </span>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs hover:shadow-md hover:border-teal-100 transition-all group">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors shrink-0">
                                    <BoxIcon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight truncate">IP Balance</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black truncate ${ipBalanceKg <= 0 ? 'text-gray-400' : 'text-teal-700'}`}>
                                    {ipBalanceKg.toLocaleString('en-US')}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Kg</span>
                            </div>
                            {ipBalanceKg >= 1000 && (
                                <span className="text-[10px] font-semibold text-gray-400 mt-0.5 block">
                                    {(ipBalanceKg / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} MT
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Linked Proforma Invoices (PIs) */}
                    {relatedPIs.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                    <span>All Proforma Invoices (PIs) Linked to this IP</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                                        {relatedPIs.length}
                                    </span>
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {relatedPIs.map(pi => (
                                    <div key={pi._id} className="p-3 bg-gray-50/60 hover:bg-blue-50/30 rounded-xl border border-gray-100 transition-all">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono font-black text-blue-600 text-xs truncate" title={pi.piNumber}>{pi.piNumber}</span>
                                            <span className="text-[10px] font-bold text-gray-500 font-mono">{formatDate(pi.date)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-600 mt-1.5">
                                            <span className="truncate max-w-[130px] font-semibold" title={pi.exporterName}>{pi.exporterName || pi.partyName || '—'}</span>
                                            <span className="font-mono font-bold text-gray-800">
                                                {(parseFloat(pi.grandTotalQuantity || pi.quantity) || 0).toLocaleString('en-US')} kg
                                            </span>
                                        </div>
                                        {pi.grandTotal && (
                                            <div className="text-[10px] font-mono text-gray-400 mt-1 text-right font-bold">
                                                Total: ${parseFloat(pi.grandTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Linked LCs Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                <span>Letters of Credit (LCs) Under This IP</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {relatedLCs.length}
                                </span>
                            </h4>
                        </div>

                        {/* Desktop LC Table */}
                        <div className="hidden md:block border border-gray-100 rounded-2xl shadow-sm overflow-x-auto overflow-y-auto max-h-[46vh] custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-10">Date</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-10">Expire Date</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-10">LC No</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-10">Bank</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right sticky top-0 bg-gray-50 z-10">Quantity</th>
                                        <th className="px-4 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider text-right bg-blue-50/50 sticky top-0 bg-blue-50 z-10">IP Qty</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider text-right sticky top-0 bg-gray-50 z-10">LC Receive</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right sticky top-0 bg-gray-50 z-10">Remaining LC Qty</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center sticky top-0 bg-gray-50 z-10">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {relatedLCs.length > 0 ? (
                                        relatedLCs.flatMap((lc, lcIdx) => {
                                            const states = getLcStates(lc);
                                            const lcReceiveQtyKg = getLcReceiveQtyForIp(lc);

                                            return states.map((state, sIdx) => {
                                                const stateQtyKg = getLcConsumptionFromIp(state, lc, false);
                                                const stateIpQtyUsedKg = getLcConsumptionFromIp(state, lc);
                                                const isLastState = sIdx === states.length - 1;
                                                const isOriginalState = state.amendmentNo === 'Original LC';
                                                const stateRemQtyKg = isLastState ? Math.max(0, stateIpQtyUsedKg - lcReceiveQtyKg) : 0;

                                                const prevQtyKg = sIdx > 0 ? getLcConsumptionFromIp(states[sIdx - 1], lc, false) : 0;
                                                const diffQtyKg = stateQtyKg - prevQtyKg;

                                                const prevStateIpQtyUsedKg = sIdx > 0 ? getLcConsumptionFromIp(states[sIdx - 1], lc) : 0;
                                                const diffIpQtyUsedKg = stateIpQtyUsedKg - prevStateIpQtyUsedKg;

                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const exp = new Date(state.expiryDate);
                                                exp.setHours(0, 0, 0, 0);
                                                const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

                                                let statusText = "Active";
                                                let statusClass = "bg-green-50 text-green-700 border-green-100";

                                                if (!isLastState) {
                                                    statusText = "Amended";
                                                    statusClass = "bg-gray-50 text-gray-400 border-gray-100";
                                                } else if (exp < today) {
                                                    statusText = "Expired";
                                                    statusClass = "bg-red-50 text-red-600 border-red-100";
                                                } else if (diffDays <= 5) {
                                                    statusText = "Expire Soon";
                                                    statusClass = "bg-amber-50 text-amber-600 border-amber-100";
                                                }

                                                return (
                                                    <tr key={`${lc._id || lcIdx}_${sIdx}`} className={`${isLastState ? 'hover:bg-gray-50/50' : 'bg-gray-50/20 text-gray-500'} transition-colors`}>
                                                        <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{formatDate(state.amendmentDate || state.openingDate || lc.openingDate)}</td>
                                                        <td className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${isLastState ? 'text-red-500' : 'text-red-400'}`}>{formatDate(state.expiryDate)}</td>
                                                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className={`font-black ${isLastState ? 'text-blue-600' : 'text-blue-400'}`}>
                                                                    {lc.lcNo || '-'}
                                                                </span>
                                                                {!isOriginalState && (
                                                                    <span className={`self-start px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${
                                                                        isLastState 
                                                                            ? 'bg-amber-50 text-amber-600 border-amber-200/60' 
                                                                            : 'bg-gray-100 text-gray-500 border-gray-200/60'
                                                                    }`}>
                                                                        {state.amendmentNo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium uppercase">{lc.bankName || '-'}</td>
                                                        <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap">
                                                            <span className={
                                                                sIdx > 0
                                                                    ? (diffQtyKg > 0 ? 'text-green-600 font-black' : diffQtyKg < 0 ? 'text-red-500 font-black' : 'text-gray-400')
                                                                    : (isLastState ? 'text-gray-900 font-bold' : '')
                                                            }>
                                                                {sIdx > 0 && diffQtyKg > 0 ? '+' : ''}
                                                                {(sIdx > 0 ? diffQtyKg : stateQtyKg).toLocaleString('en-US')} kg
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-bold text-right whitespace-nowrap bg-blue-50/20">
                                                            <span className={
                                                                sIdx > 0
                                                                    ? (diffIpQtyUsedKg > 0 ? 'text-green-600 font-black' : diffIpQtyUsedKg < 0 ? 'text-red-500 font-black' : 'text-gray-400')
                                                                    : 'text-blue-700 font-black'
                                                            }>
                                                                {sIdx > 0 && diffIpQtyUsedKg > 0 ? '+' : ''}
                                                                {(sIdx > 0 ? diffIpQtyUsedKg : stateIpQtyUsedKg).toLocaleString('en-US')}
                                                            </span> <span className="text-[10px] font-normal uppercase text-gray-500">kg</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-bold text-right whitespace-nowrap">
                                                            <span className={isLastState ? 'text-gray-900 font-bold' : 'text-gray-400'}>
                                                                {(isLastState ? lcReceiveQtyKg : 0).toLocaleString('en-US')}
                                                            </span> <span className="text-[10px] font-normal uppercase text-gray-500">kg</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-right whitespace-nowrap">
                                                            <span className={`font-black ${isLastState ? (stateRemQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600') : 'text-gray-400'}`}>
                                                                {stateRemQtyKg.toLocaleString('en-US')}
                                                            </span> <span className="text-[10px] font-normal uppercase text-gray-400">kg</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusClass}`}>
                                                                {statusText}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="9" className="px-5 py-12 text-center text-gray-400 font-bold">No LC records found for this IP.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {relatedLCs.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100/80 border-t-2 border-gray-200 font-black text-gray-900">
                                            <td colSpan="4" className="px-4 py-3 text-sm text-right uppercase tracking-wider text-gray-700">Grand Total:</td>
                                            <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                                                {relatedLCs.reduce((sum, lc) => sum + getLcConsumptionFromIp(lc, lc, false), 0).toLocaleString('en-US')} kg
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right whitespace-nowrap bg-blue-100/50 text-blue-900">
                                                {totalLcQtyKg.toLocaleString('en-US')} <span className="text-[10px] font-normal uppercase text-gray-600">kg</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right whitespace-nowrap text-gray-900">
                                                {totalLcReceiveQtyKg.toLocaleString('en-US')} <span className="text-[10px] font-normal uppercase text-gray-600">kg</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right whitespace-nowrap text-blue-700">
                                                {relatedLCs.reduce((sum, lc) => {
                                                    const lcIpQty = getLcConsumptionFromIp(lc, lc);
                                                    const lcRecQty = getLcReceiveQtyForIp(lc);
                                                    return sum + Math.max(0, lcIpQty - lcRecQty);
                                                }, 0).toLocaleString('en-US')} <span className="text-[10px] font-normal uppercase text-gray-500">kg</span>
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Mobile LC Cards */}
                        <div className="md:hidden space-y-3.5">
                            {relatedLCs.length > 0 ? (
                                relatedLCs.flatMap((lc, lcIdx) => {
                                    const states = getLcStates(lc);
                                    const lcReceiveQtyKg = getLcReceiveQtyForIp(lc);

                                    return states.map((state, sIdx) => {
                                        const stateQtyKg = getLcConsumptionFromIp(state, lc, false);
                                        const stateIpQtyUsedKg = getLcConsumptionFromIp(state, lc);
                                        const isLastState = sIdx === states.length - 1;
                                        const isOriginalState = state.amendmentNo === 'Original LC';
                                        const stateRemQtyKg = isLastState ? Math.max(0, stateIpQtyUsedKg - lcReceiveQtyKg) : 0;

                                        const prevQtyKg = sIdx > 0 ? getLcConsumptionFromIp(states[sIdx - 1], lc, false) : 0;
                                        const diffQtyKg = stateQtyKg - prevQtyKg;

                                        const prevStateIpQtyUsedKg = sIdx > 0 ? getLcConsumptionFromIp(states[sIdx - 1], lc) : 0;
                                        const diffIpQtyUsedKg = stateIpQtyUsedKg - prevStateIpQtyUsedKg;

                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const exp = new Date(state.expiryDate);
                                        exp.setHours(0, 0, 0, 0);
                                        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

                                        let statusText = "Active";
                                        let statusClass = "bg-green-50 text-green-700 border-green-100";
                                        if (!isLastState) {
                                            statusText = "Amended";
                                            statusClass = "bg-gray-50 text-gray-500 border-gray-100";
                                        } else if (exp < today) {
                                            statusText = "Expired";
                                            statusClass = "bg-red-50 text-red-600 border-red-100";
                                        } else if (diffDays <= 5) {
                                            statusText = "Expire Soon";
                                            statusClass = "bg-amber-50 text-amber-600 border-amber-100";
                                        }

                                        return (
                                            <div key={`${lc._id || lcIdx}_${sIdx}`} className={`bg-white p-4.5 rounded-2xl border shadow-sm ${isLastState ? 'border-gray-100' : 'border-gray-100/60 bg-gray-50/10'}`}>
                                                <div className="flex justify-between items-center mb-2.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">LC No:</span>
                                                        <span className={`text-sm font-black font-mono truncate ${isLastState ? 'text-gray-900' : 'text-gray-500'}`}>
                                                            {lc.lcNo || '-'}
                                                        </span>
                                                        {!isOriginalState && (
                                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-200">
                                                                {state.amendmentNo}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${statusClass}`}>
                                                        {statusText}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-50">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Date</span>
                                                        <span className="font-mono font-bold text-gray-700">{formatDate(state.amendmentDate || state.openingDate || lc.openingDate)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Expiry Date</span>
                                                        <span className="font-mono font-bold text-red-500">{formatDate(state.expiryDate)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Bank</span>
                                                        <span className="font-bold text-gray-800 truncate block">{lc.bankName || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">LC Quantity</span>
                                                        <span className="font-mono font-bold text-gray-800">
                                                            {sIdx > 0 && diffQtyKg > 0 ? '+' : ''}
                                                            {(sIdx > 0 ? diffQtyKg : stateQtyKg).toLocaleString('en-US')} kg
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-blue-600 uppercase block">IP Qty Used</span>
                                                        <span className="font-mono font-black text-blue-700">
                                                            {sIdx > 0 && diffIpQtyUsedKg > 0 ? '+' : ''}
                                                            {(sIdx > 0 ? diffIpQtyUsedKg : stateIpQtyUsedKg).toLocaleString('en-US')} kg
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">LC Receive</span>
                                                        <span className="font-mono font-bold text-gray-800">
                                                            {(isLastState ? lcReceiveQtyKg : 0).toLocaleString('en-US')} kg
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Rem. LC Qty</span>
                                                        <span className={`font-mono font-black ${stateRemQtyKg <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                            {stateRemQtyKg.toLocaleString('en-US')} kg
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    });
                                })
                            ) : (
                                <div className="p-6 text-center bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                                    <p className="text-gray-400 font-bold text-xs">No LC records found for this IP.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sub-modal for Viewing Attached PDF */}
                {viewingPdf && (
                    <PDFViewerModal
                        pdfData={viewingPdf}
                        fileName={viewingPdfName}
                        onClose={() => {
                            setViewingPdf(null);
                            setViewingPdfName('');
                        }}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

export default IPDetailsModal;
