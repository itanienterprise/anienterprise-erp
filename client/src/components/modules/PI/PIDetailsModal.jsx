import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    XIcon, EyeIcon, PDFIcon, FileTextIcon
} from '../../Icons';
import { generatePIPDF } from '../../../utils/pipdfgenerator';
import { generatePI2PDF } from '../../../utils/pi2pdfgenerator';
import { generateBankApplicationPDF } from '../../../utils/islbankApplicationGenerator';
import { formatDate } from '../../../utils/helpers';
import { IPDetailsModal } from '../IPManagement/IPDetailsModal';

const ViewDetailsModal = React.lazy(() =>
    import('../LCManagement/LCManagement').then(m => ({ default: m.ViewDetailsModal }))
);

export const PIDetailsModal = ({
    piRecord,
    piRecords = [],
    lcRecords = [],
    ipRecords = [],
    allStockRecords = [],
    allSalesRecords = [],
    importers = [],
    exporters = [],
    banks = [],
    employeesMap = {},
    employeesFullNameMap = {},
    initialRevisionIndex = null,
    currentUser = null,
    modalZIndex = 'z-[9999]',
    onClose
}) => {
    const [selectedIpForModal, setSelectedIpForModal] = useState(null);
    const [selectedLcForModal, setSelectedLcForModal] = useState(null);

    // Resolve full target PI record if available
    const resolvedPi = useMemo(() => {
        if (!piRecord) return null;
        const cleanTarget = String(piRecord.piNumber || piRecord || '').replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
        const targetParts = cleanTarget.split(',').map(s => s.trim()).filter(Boolean);

        const found = (piRecords || []).find(p => {
            const pNum = String(p.piNumber || '').replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
            const pParts = (p.piNumbers && Array.isArray(p.piNumbers) && p.piNumbers.length > 0)
                ? p.piNumbers.map(s => String(s).replace(/\s*\(revised\)/gi, '').trim().toLowerCase())
                : pNum.split(',').map(s => s.trim()).filter(Boolean);

            if (pNum === cleanTarget) return true;
            if (targetParts.some(tp => pParts.includes(tp) || pNum.includes(tp))) return true;
            if (pParts.some(pp => targetParts.includes(pp) || cleanTarget.includes(pp))) return true;
            return false;
        });

        if (found) {
            return {
                ...found,
                _isRevisedRequested: piRecord._isRevisedRequested !== undefined
                    ? piRecord._isRevisedRequested
                    : String(piRecord.piNumber || piRecord).toLowerCase().includes('(revised)')
            };
        }

        return typeof piRecord === 'object' ? piRecord : { piNumber: piRecord };
    }, [piRecord, piRecords]);

    const getPiProductsList = (pi) => {
        if (pi?.productsList && Array.isArray(pi.productsList) && pi.productsList.length > 0) {
            return pi.productsList.map(p => ({
                ...p,
                showIndHsCode: p.showIndHsCode !== undefined ? p.showIndHsCode === true : false
            }));
        }
        if (pi?.productName || pi?.quantity) {
            return [{
                productName: pi.productName || '',
                hsCode: pi.hsCode || '',
                quantity: pi.quantity || '',
                rate: pi.rate || '',
                amount: pi.amount || '',
                freight: pi.freight || '',
                totalFreight: pi.totalFreight || '',
                showIndHsCode: pi.showIndHsCode !== undefined ? pi.showIndHsCode === true : false
            }];
        }
        return [];
    };

    const timeline = useMemo(() => {
        if (!resolvedPi) return [];
        const list = [];
        const revisions = resolvedPi.revisions || [];
        const hasOriginal = revisions.some(r => r.reviseNo === 'Original PI');

        if (revisions.length === 0) {
            list.push({
                reviseNo: 'Original PI',
                reviseDate: resolvedPi.date,
                validityDate: resolvedPi.validityDate,
                placeOfReceipt: resolvedPi.placeOfReceipt || 'N/A',
                portOfLoading: resolvedPi.portOfLoading || 'N/A',
                portOfDischarge: resolvedPi.portOfDischarge || 'N/A',
                certification: resolvedPi.certification || 'N/A',
                packingType: resolvedPi.packingType || 'N/A',
                productsList: getPiProductsList(resolvedPi),
                grandTotal: resolvedPi.grandTotal,
                grandTotalQuantity: resolvedPi.grandTotalQuantity,
                remarks: resolvedPi.remarks || '',
                ipNumbers: resolvedPi.ipNumbers || (resolvedPi.ipNumber ? String(resolvedPi.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : []),
                isOriginal: true
            });
        } else {
            if (!hasOriginal) {
                list.push({
                    reviseNo: 'Original PI',
                    reviseDate: resolvedPi.date,
                    validityDate: 'N/A (Historical)',
                    placeOfReceipt: 'N/A (Historical)',
                    portOfLoading: 'N/A (Historical)',
                    portOfDischarge: 'N/A (Historical)',
                    certification: 'N/A (Historical)',
                    packingType: 'N/A (Historical)',
                    productsList: [],
                    grandTotal: 'N/A',
                    grandTotalQuantity: 'N/A',
                    remarks: 'Historical original values were not captured prior to first revision.',
                    ipNumbers: [],
                    isOriginal: true,
                    isPlaceholder: true
                });
            }

            // Deduplicate revisions defensively by reviseNo, keeping the latest occurrence
            const seenNos = new Map();
            revisions.forEach(rev => {
                const key = (rev.reviseNo || '').trim().toLowerCase();
                if (key) seenNos.set(key, rev);
            });
            const processedKeys = new Set();
            revisions.forEach(rev => {
                const key = (rev.reviseNo || '').trim().toLowerCase();
                if (key && !processedKeys.has(key)) {
                    processedKeys.add(key);
                    const latestRev = seenNos.get(key);
                    list.push({
                        ...latestRev,
                        ipNumbers: latestRev.ipNumbers || (latestRev.ipNumber ? String(latestRev.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : (resolvedPi.ipNumbers || (resolvedPi.ipNumber ? String(resolvedPi.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : []))),
                        isOriginal: latestRev.reviseNo === 'Original PI'
                    });
                }
            });
        }

        // Append 10% PI records if present
        const tenPercentRecs = resolvedPi.tenPercentRecords || (resolvedPi.tenPercentRecord ? [resolvedPi.tenPercentRecord] : []);
        if (tenPercentRecs.length > 0) {
            tenPercentRecs.forEach(tRec => {
                list.push({
                    ...tRec,
                    reviseNo: tRec.reviseNo || '10% PI',
                    isTenPercent: true,
                    isOriginal: false,
                    reviseDate: tRec.reviseDate || tRec.savedAt || resolvedPi.date,
                    productsList: tRec.productsList || [],
                    grandTotal: tRec.grandTotal,
                    grandTotalQuantity: tRec.grandTotalQuantity,
                    ipNumbers: tRec.ipNumbers || (tRec.ipNumber ? String(tRec.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : (resolvedPi.ipNumbers || []))
                });
            });
        }

        return list;
    }, [resolvedPi]);

    // Determine initial selected revision index
    const defaultIndex = useMemo(() => {
        if (initialRevisionIndex !== null && initialRevisionIndex >= 0 && initialRevisionIndex < timeline.length) {
            return initialRevisionIndex;
        }
        if (resolvedPi?._isRevisedRequested && timeline.length > 1) {
            return timeline.length - 1;
        }
        return 0;
    }, [timeline, initialRevisionIndex, resolvedPi]);

    const [activeHistoryIndex, setActiveHistoryIndex] = useState(defaultIndex);

    // Look up linked LC number for this PI
    const linkedLcRecord = useMemo(() => {
        if (!resolvedPi?.piNumber) return null;
        const cleanPiNum = String(resolvedPi.piNumber).replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
        return (lcRecords || []).find(lc => {
            const lcPi = String(lc.piNo || lc.piNumber || '').replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
            return lcPi === cleanPiNum;
        });
    }, [resolvedPi, lcRecords]);

    const linkedLcNo = linkedLcRecord ? linkedLcRecord.lcNo : null;

    const activeRevision = timeline[activeHistoryIndex] || timeline[0] || {};
    const activeProducts = activeRevision.productsList || [];
    const activeIps = activeRevision.ipNumbers || [];

    // Handler to open IP Details from within PI Details
    const handleOpenIpDetails = (ipNum) => {
        if (!ipNum) return;
        const cleanTarget = String(ipNum).trim().toLowerCase();
        const cleanDigits = String(ipNum).replace(/\D/g, '');

        let targetIp = (ipRecords || []).find(ip => {
            const num = String(ip.ipNumber || '').trim().toLowerCase();
            const digits = num.replace(/\D/g, '');
            return num === cleanTarget || (cleanDigits && digits && digits === cleanDigits);
        });

        if (!targetIp) {
            targetIp = {
                ipNumber: ipNum,
                ipParty: resolvedPi?.partyName || 'M/S. ANI ENTERPRISE',
                productName: resolvedPi?.productName || (activeProducts[0]?.productName) || '',
                port: activeRevision.portOfDischarge || activeRevision.portOfLoading || resolvedPi?.port || '',
                openingDate: activeRevision.reviseDate || resolvedPi?.date || '',
                closeDate: activeRevision.validityDate || resolvedPi?.validityDate || '',
                referenceNo: resolvedPi?.buyerOrderNo || resolvedPi?.piNumber || '',
                quantity: parseFloat(activeRevision.grandTotalQuantity || resolvedPi?.grandTotalQuantity || resolvedPi?.quantity) || 0,
                status: 'Active',
                isPlaceholder: true
            };
        }

        const enrichedIp = {
            ...targetIp,
            exporterName: targetIp.exporterName || targetIp.exporter || resolvedPi?.exporterName || '',
            ipParty: targetIp.ipParty || resolvedPi?.partyName || '',
            productName: targetIp.productName || (activeProducts[0]?.productName) || resolvedPi?.productName || '',
            port: targetIp.port || activeRevision.portOfDischarge || activeRevision.portOfLoading || resolvedPi?.port || '',
            openingDate: targetIp.openingDate || activeRevision.reviseDate || resolvedPi?.date || '',
            closeDate: targetIp.closeDate || activeRevision.validityDate || resolvedPi?.validityDate || '',
            referenceNo: targetIp.referenceNo || resolvedPi?.buyerOrderNo || resolvedPi?.piNumber || '',
            entryBy: targetIp.entryBy || resolvedPi?.entryBy || '',
            entryByName: targetIp.entryByName || resolvedPi?.entryByName || '',
            currentPi: resolvedPi
        };

        setSelectedIpForModal(enrichedIp);
    };

    const handlePrintPDF = () => {
        const origRev = timeline.find(t => t.isOriginal || t.reviseNo === 'Original PI') || timeline[0] || resolvedPi;
        const prevRev = activeHistoryIndex > 0 ? timeline[activeHistoryIndex - 1] : origRev;

        const enriched = {
            ...resolvedPi,
            ...activeRevision,
            piNumber: activeRevision.isTenPercent
                ? (activeRevision.piNumber || resolvedPi.piNumber)
                : `${resolvedPi.piNumber}${activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}`,
            originalPiNumber: resolvedPi.piNumber,
            originalGrandTotal: activeRevision.originalGrandTotal || origRev?.grandTotal || resolvedPi.grandTotal,
            originalGrandTotalQuantity: activeRevision.originalGrandTotalQuantity || origRev?.grandTotalQuantity || resolvedPi.grandTotalQuantity,
            previousGrandTotal: prevRev?.grandTotal || origRev?.grandTotal || resolvedPi.grandTotal,
            previousGrandTotalQuantity: prevRev?.grandTotalQuantity || origRev?.grandTotalQuantity || resolvedPi.grandTotalQuantity,
            linkedLc: linkedLcRecord,
            lcNo: linkedLcRecord?.lcNo || resolvedPi.lcNo || resolvedPi.lcNumber || activeRevision.lcNo || '',
            lcDate: linkedLcRecord?.openingDate || linkedLcRecord?.lcDate || resolvedPi.lcDate || activeRevision.lcDate || '',
            originalProductsList: origRev?.productsList || (origRev?.productName ? [{ productName: origRev.productName }] : (resolvedPi.productsList || [])),
            originalIpNumbers: origRev?.ipNumbers || (origRev?.ipNumber ? String(origRev.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : (resolvedPi.ipNumbers || [])),
            amendmentType: activeRevision.amendmentType || (activeRevision.reviseNo !== 'Original PI' ? 'Increase of L/C Value and Quantity' : ''),
            extendedShipmentDate: activeRevision.extendedShipmentDate || activeRevision.latestShipmentDate || '',
            extendedExpiryDate: activeRevision.extendedExpiryDate || activeRevision.expiryDate || '',
            isTenPercent: !!activeRevision.isTenPercent,
            ipRecords: ipRecords || []
        };

        if (!enriched.exporterAddress || !enriched.exporterEmail || !enriched.exporterSignature || !enriched.exporterSeal) {
            const exp = exporters?.find(e => e.name === enriched.exporterName);
            if (exp) {
                enriched.exporterAddress = enriched.exporterAddress || exp.address;
                enriched.exporterContact = enriched.exporterContact || exp.phone;
                enriched.exporterEmail = enriched.exporterEmail || exp.email;
                enriched.exporterSignature = enriched.exporterSignature || exp.signature;
                enriched.exporterSeal = enriched.exporterSeal || exp.seal;
            }
        }

        if (!enriched.partyAddress || !enriched.partyEmail || !enriched.partySignature) {
            const imp = importers?.find(i => i.name === enriched.partyName);
            if (imp) {
                enriched.partyAddress = enriched.partyAddress || imp.address;
                enriched.partyContact = enriched.partyContact || imp.phone;
                enriched.partyEmail = enriched.partyEmail || imp.email;
                enriched.partySignature = enriched.partySignature || imp.signature;
            }
        }

        if (enriched.invoiceStyle === 'Style 2 AAS' || enriched.invoiceStyle === 'Style 3') {
            generatePI2PDF(enriched);
        } else {
            generatePIPDF(enriched);
        }
    };

    const handlePrintBankApplication = () => {
        if (!resolvedPi) return;
        const origRev = timeline.find(t => t.isOriginal || t.reviseNo === 'Original PI') || timeline[0] || resolvedPi;
        const prevRev = activeHistoryIndex > 0 ? timeline[activeHistoryIndex - 1] : origRev;

        const enriched = {
            ...resolvedPi,
            ...activeRevision,
            piNumber: `${resolvedPi.piNumber}${activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}`,
            originalPiNumber: resolvedPi.piNumber,
            originalGrandTotal: activeRevision.originalGrandTotal || origRev?.grandTotal || resolvedPi.grandTotal,
            originalGrandTotalQuantity: activeRevision.originalGrandTotalQuantity || origRev?.grandTotalQuantity || resolvedPi.grandTotalQuantity,
            previousGrandTotal: prevRev?.grandTotal || origRev?.grandTotal || resolvedPi.grandTotal,
            previousGrandTotalQuantity: prevRev?.grandTotalQuantity || origRev?.grandTotalQuantity || resolvedPi.grandTotalQuantity,
            linkedLc: linkedLcRecord,
            lcNo: linkedLcRecord?.lcNo || resolvedPi.lcNo || resolvedPi.lcNumber || activeRevision.lcNo || '',
            lcDate: linkedLcRecord?.openingDate || linkedLcRecord?.lcDate || resolvedPi.lcDate || activeRevision.lcDate || '',
            originalProductsList: origRev?.productsList || (origRev?.productName ? [{ productName: origRev.productName }] : (resolvedPi.productsList || [])),
            originalIpNumbers: origRev?.ipNumbers || (origRev?.ipNumber ? String(origRev.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : (resolvedPi.ipNumbers || [])),
            amendmentType: activeRevision.amendmentType || (activeRevision.reviseNo !== 'Original PI' ? 'Increase of L/C Value and Quantity' : ''),
            extendedShipmentDate: activeRevision.extendedShipmentDate || activeRevision.latestShipmentDate || '',
            extendedExpiryDate: activeRevision.extendedExpiryDate || activeRevision.expiryDate || '',
            ipRecords: ipRecords || []
        };

        if (!enriched.exporterAddress || !enriched.exporterEmail || !enriched.exporterSignature) {
            const exp = exporters?.find(e => e.name === enriched.exporterName);
            if (exp) {
                enriched.exporterAddress = enriched.exporterAddress || exp.address;
                enriched.exporterContact = enriched.exporterContact || exp.phone;
                enriched.exporterEmail = enriched.exporterEmail || exp.email;
                enriched.exporterSignature = enriched.exporterSignature || exp.signature;
                enriched.exporterSeal = enriched.exporterSeal || exp.seal;
            }
        }

        if (!enriched.partyAddress || !enriched.partyEmail || !enriched.partySignature) {
            const imp = importers?.find(i => i.name === enriched.partyName);
            if (imp) {
                enriched.partyAddress = enriched.partyAddress || imp.address;
                enriched.partyContact = enriched.partyContact || imp.phone;
                enriched.partyEmail = enriched.partyEmail || imp.email;
                enriched.partySignature = enriched.partySignature || imp.signature;
            }
        }

        if (!enriched.bankBranch && banks?.length > 0) {
            const b = banks.find(bk => bk.name === enriched.bankName);
            if (b) enriched.bankBranch = b.branch;
        }

        generateBankApplicationPDF(enriched);
    };

    if (!resolvedPi || typeof document === 'undefined' || !document.body) return null;

    return createPortal(
        <div className={`fixed inset-0 ${modalZIndex} flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200`}>
            <div className="bg-white w-full max-w-[95vw] 2xl:max-w-[1550px] xl:max-w-[1450px] h-[92vh] sm:h-[85vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-4 sm:px-8 py-3.5 sm:py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="p-2 sm:p-2.5 bg-blue-100 text-blue-600 rounded-xl sm:rounded-2xl shrink-0">
                            <EyeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight truncate">Proforma Invoice History Explorer</h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
                                <span>
                                    PI Number:{' '}
                                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold font-mono text-blue-700 bg-blue-50/90 border border-blue-200/90 rounded-lg shadow-2xs">
                                        {resolvedPi.piNumber}{resolvedPi.revisions && resolvedPi.revisions.length > 0 && activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}
                                    </span>
                                </span>
                                <span className="text-gray-300">•</span>
                                <span>
                                    Date: <span className="font-bold text-gray-800 font-mono">{formatDate(activeRevision.reviseDate || resolvedPi.date)}</span>
                                </span>
                                {linkedLcNo && (
                                    <>
                                        <span className="text-gray-300">•</span>
                                        <span>
                                            LC:{' '}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedLcForModal(linkedLcRecord)}
                                                className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold font-mono text-blue-700 bg-blue-50/90 hover:bg-blue-600 hover:text-white border border-blue-200/90 hover:border-blue-600 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer select-none"
                                                title={`View LC Details (${linkedLcNo})`}
                                            >
                                                {linkedLcNo}
                                            </button>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-200 text-gray-400 hover:text-gray-600 active:scale-95 transition-all cursor-pointer shrink-0 ml-2"
                        title="Close Modal"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Mobile Action Buttons: Circular Design Before Timeline */}
                <div className="md:hidden border-b border-gray-100 bg-gray-50/50 px-4 py-3 shrink-0">
                    <div className="flex items-center justify-around gap-2 max-w-sm mx-auto">
                        {/* 1. Print PI PDF */}
                        <div className="flex flex-col items-center gap-1">
                            <button
                                type="button"
                                onClick={handlePrintPDF}
                                className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200/80 shadow-sm flex items-center justify-center transition-all transform active:scale-95"
                                title={activeRevision.isTenPercent ? 'Print 10% PI PDF' : 'Print PI PDF'}
                                aria-label={activeRevision.isTenPercent ? 'Print 10% PI PDF' : 'Print PI PDF'}
                            >
                                <PDFIcon className="w-5 h-5 shrink-0" />
                            </button>
                            <span className="text-[10px] font-bold text-gray-600 text-center leading-tight">
                                {activeRevision.isTenPercent ? '10% PDF' : 'PI PDF'}
                            </span>
                        </div>

                        {/* 2. Bank Application */}
                        {!activeRevision.isTenPercent && (
                            <div className="flex flex-col items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handlePrintBankApplication}
                                    className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 shadow-sm flex items-center justify-center transition-all transform active:scale-95"
                                    title="Bank Application"
                                    aria-label="Bank Application"
                                >
                                    <FileTextIcon className="w-5 h-5 shrink-0" />
                                </button>
                                <span className="text-[10px] font-bold text-gray-600 text-center leading-tight">Bank App</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                    {/* Revision Timeline: Top scrollable section on mobile, sidebar on desktop (matching LC Record Details) */}
                    {timeline.length > 1 && (
                        <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-100 p-5 md:p-6 bg-gray-50/30 overflow-y-auto max-h-[35vh] md:max-h-full flex-shrink-0 text-left custom-scrollbar">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Revision Timeline</h4>
                            <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-6">
                                {timeline.map((rev, idx) => {
                                    const isActive = activeHistoryIndex === idx;
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setActiveHistoryIndex(idx)}
                                            className="relative cursor-pointer group"
                                        >
                                            {/* Timeline Bullet */}
                                            <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isActive
                                                ? rev.isTenPercent
                                                    ? 'bg-purple-600 border-purple-600 ring-4 ring-purple-100 scale-110 shadow-sm'
                                                    : 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 scale-110 shadow-sm'
                                                : rev.isTenPercent
                                                    ? 'bg-white border-purple-300 group-hover:border-purple-400 group-hover:scale-105'
                                                    : 'bg-white border-gray-300 group-hover:border-blue-400 group-hover:scale-105'
                                                }`} />

                                            {/* Timeline Content Card */}
                                            <div className={`p-4 rounded-2xl border transition-all ${isActive
                                                ? rev.isTenPercent
                                                    ? 'bg-white border-purple-200 shadow-md shadow-purple-500/5 ring-1 ring-purple-100'
                                                    : 'bg-white border-blue-200 shadow-md shadow-blue-500/5'
                                                : 'bg-white/50 border-gray-100 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                                                }`}>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${rev.isTenPercent
                                                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                    : rev.isOriginal
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                    {rev.reviseNo}
                                                </span>
                                                <p className="text-sm font-bold text-gray-800 mt-2">
                                                    {rev.isTenPercent
                                                        ? '10% Value Added State'
                                                        : rev.isOriginal ? 'Initial Creation' : 'Revised State'}
                                                </p>
                                                <p className="text-[11px] font-medium text-gray-500 mt-1 font-mono">
                                                    {formatDate(rev.reviseDate)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Right Pane: Details */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 min-w-0">
                        {activeRevision.isPlaceholder ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50/50 rounded-3xl border border-gray-100">
                                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                                    <span className="text-2xl">⚠️</span>
                                </div>
                                <h4 className="text-base font-bold text-gray-800">Original PI Data</h4>
                                <p className="text-sm text-gray-500 mt-2 max-w-md">
                                    This PI was revised prior to the deployment of the detailed history tracking system. Historical initial values were overwritten and are not fully accessible.
                                </p>
                                <p className="text-xs text-gray-400 mt-4">
                                    All subsequent revisions and updates are saved and fully trackable.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Details Section */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                                    {/* Card 1: Logistics */}
                                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-3">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Logistics & Route</h5>
                                        <div className="grid grid-cols-[105px_8px_1fr] sm:grid-cols-[115px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Place of Receipt</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <span className="font-bold text-gray-800 break-words">{activeRevision.placeOfReceipt || 'N/A'}</span>

                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port of Loading</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <span className="font-bold text-gray-800 break-words">{activeRevision.portOfLoading || 'N/A'}</span>

                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Port of Discharge</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <span className="font-bold text-gray-800 break-words">{activeRevision.portOfDischarge || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Card 2: Dates & Certifications */}
                                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-3">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Dates & Certification</h5>
                                        <div className="grid grid-cols-[105px_8px_1fr] sm:grid-cols-[115px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Revise / PI Date</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <span className="font-bold text-gray-800 font-mono">{formatDate(activeRevision.reviseDate)}</span>

                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Validity Date</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <span className="font-bold text-rose-500 font-mono">{formatDate(activeRevision.validityDate)}</span>

                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Certification</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <div className="space-y-0.5 min-w-0">
                                                {activeRevision.certification
                                                    ? activeRevision.certification.split(',').map((cert, cIdx) => (
                                                        <span key={cIdx} className="font-bold text-gray-800 block text-xs">{cert.trim()}</span>
                                                    ))
                                                    : <span className="font-bold text-gray-800 block text-xs">N/A</span>
                                                }
                                            </div>

                                            {activeRevision.certification && activeRevision.certification.split(',').map(s => s.trim().toLowerCase()).includes('packing') && (
                                                <>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Packing Type</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <div className="space-y-0.5 min-w-0">
                                                        {activeRevision.packingType
                                                            ? activeRevision.packingType.split(',').map((pack, pIdx) => (
                                                                <span key={pIdx} className="font-bold text-gray-800 block text-xs">{pack.trim()}</span>
                                                            ))
                                                            : <span className="font-bold text-gray-800 block text-xs">N/A</span>
                                                        }
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card 3: IP Records, LC & Reference */}
                                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-3">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">IP Records, LC & Remarks</h5>
                                        <div className="grid grid-cols-[105px_8px_1fr] sm:grid-cols-[115px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LC Number</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <div>
                                                {linkedLcNo ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedLcForModal(linkedLcRecord)}
                                                        className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-bold font-mono text-blue-700 bg-blue-50/90 hover:bg-blue-600 hover:text-white border border-blue-200/90 hover:border-blue-600 rounded-lg shadow-2xs transition-all active:scale-95 cursor-pointer select-none"
                                                        title={`View LC Details (${linkedLcNo})`}
                                                    >
                                                        {linkedLcNo}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-500 font-bold text-xs">No LC Linked</span>
                                                )}
                                            </div>

                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Import Permission</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <div className="flex flex-wrap gap-1.5 min-w-0">
                                                {activeIps.length > 0 ? (
                                                    activeIps.map((ip, i) => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenIpDetails(ip);
                                                            }}
                                                            className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold text-blue-700 bg-blue-50/90 hover:bg-blue-600 hover:text-white border border-blue-200/90 hover:border-blue-600 rounded-md shadow-2xs transition-all active:scale-95 cursor-pointer font-mono select-none"
                                                            title={`View IP Details (${ip})`}
                                                        >
                                                            {ip}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-500 font-bold text-xs">N/A</span>
                                                )}
                                            </div>

                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Remarks</span>
                                            <span className="text-gray-400 font-bold text-[10px]">:</span>
                                            <p className="text-xs font-bold text-gray-800 break-words">{activeRevision.remarks || 'No remarks provided.'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Products Breakdown on Mobile Cards */}
                                <div className="md:hidden space-y-3">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Products Breakdown</h5>
                                    <div className="space-y-3">
                                        {activeProducts.map((prod, pIdx) => (
                                            <div key={pIdx} className="bg-gray-50/60 p-4 rounded-2xl border border-gray-100 text-left">
                                                {activeProducts.length > 1 && (
                                                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2">
                                                        Product #{pIdx + 1}
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-[105px_8px_1fr] sm:grid-cols-[115px_8px_1fr] gap-y-2 text-xs items-baseline text-left">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PRODUCT NAME</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="text-xs font-bold text-gray-900 break-words">{prod.productName || 'N/A'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">HS CODE</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="text-xs font-mono font-semibold text-gray-700">{prod.hsCode || 'N/A'}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">QUANTITY</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="text-xs font-bold text-gray-900">{parseFloat(prod.quantity || 0).toLocaleString('en-US')} kg</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">RATE</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="text-xs font-semibold text-gray-800">${parseFloat(prod.rate || 0).toFixed(3)}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">FREIGHT</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="text-xs font-semibold text-gray-800">${parseFloat(prod.freight || 0).toFixed(3)}</span>

                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TOTAL AMOUNT</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">:</span>
                                                    <span className="text-xs font-black text-blue-600">${(parseFloat(prod.amount || 0) + parseFloat(prod.totalFreight || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Products Breakdown on Desktop Table */}
                                <div className="hidden md:block space-y-3">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Products Breakdown</h5>
                                    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                    <th className="px-6 py-3">Product Name</th>
                                                    <th className="px-6 py-3">HS Code</th>
                                                    <th className="px-6 py-3 text-right">Quantity (kg)</th>
                                                    <th className="px-6 py-3 text-right">Rate ($)</th>
                                                    <th className="px-6 py-3 text-right">Freight</th>
                                                    <th className="px-6 py-3 text-right">Total Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 text-sm">
                                                {activeProducts.map((prod, pIdx) => (
                                                    <tr key={pIdx} className="hover:bg-gray-50/30">
                                                        <td className="px-6 py-3.5 font-bold text-gray-800">{prod.productName || 'N/A'}</td>
                                                        <td className="px-6 py-3.5 font-mono font-medium text-gray-500">{prod.hsCode || 'N/A'}</td>
                                                        <td className="px-6 py-3.5 text-right font-semibold text-gray-700">{parseFloat(prod.quantity || 0).toLocaleString('en-US')} kg</td>
                                                        <td className="px-6 py-3.5 text-right font-semibold text-gray-700">${parseFloat(prod.rate || 0).toFixed(3)}</td>
                                                        <td className="px-6 py-3.5 text-right font-semibold text-gray-700">${parseFloat(prod.freight || 0).toFixed(3)}</td>
                                                        <td className="px-6 py-3.5 text-right font-black text-blue-600">${(parseFloat(prod.amount || 0) + parseFloat(prod.totalFreight || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Totals Summary Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-lg mx-auto pt-4 sm:pt-6">
                                    {/* Total Quantity Card */}
                                    <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 sm:p-5 text-center shadow-sm">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Quantity</span>
                                        <span className="text-lg sm:text-xl font-black text-gray-900 mt-1 block">
                                            {parseFloat(activeRevision.grandTotalQuantity || 0).toLocaleString('en-US')} kg
                                        </span>
                                    </div>
                                    {/* Grand Total Card */}
                                    <div className="bg-blue-600 text-white rounded-2xl p-4 sm:p-5 text-center shadow-lg shadow-blue-500/20">
                                        <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block">Grand Total Value</span>
                                        <span className="text-lg sm:text-xl font-black text-white mt-1 block">
                                            ${parseFloat(activeRevision.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons under Cards (Desktop only - mobile has circular buttons above timeline) */}
                                <div className="hidden md:flex flex-wrap items-center justify-center gap-3 pt-6 pb-2">
                                    <button
                                        type="button"
                                        onClick={handlePrintPDF}
                                        className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <PDFIcon className="w-4 h-4 text-white" />
                                        <span>{activeRevision.isTenPercent ? 'Print 10% PI PDF' : 'Print PI PDF'}</span>
                                    </button>
                                    {!activeRevision.isTenPercent && (
                                        <button
                                            type="button"
                                            onClick={handlePrintBankApplication}
                                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <FileTextIcon className="w-4 h-4 text-white" />
                                            <span>Bank Application</span>
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Nested IP Details Modal when clicking any IP tag within PI Details */}
            {selectedIpForModal && (
                <IPDetailsModal
                    ipRecord={selectedIpForModal}
                    lcRecords={lcRecords}
                    ipRecords={ipRecords}
                    allStockRecords={allStockRecords}
                    allSalesRecords={allSalesRecords}
                    piRecords={piRecords}
                    employeesMap={employeesMap}
                    employeesFullNameMap={employeesFullNameMap}
                    currentPi={resolvedPi}
                    currentUser={currentUser}
                    modalZIndex="z-[10001]"
                    onClose={() => setSelectedIpForModal(null)}
                />
            )}

            {/* Nested LC Details Modal when clicking linked LC within PI Details */}
            {selectedLcForModal && (
                <React.Suspense fallback={null}>
                    <ViewDetailsModal
                        data={selectedLcForModal}
                        lcRecords={lcRecords}
                        piRecordsRaw={piRecords}
                        ipRecordsRaw={ipRecords}
                        allStockRecords={allStockRecords}
                        allSalesRecords={allSalesRecords}
                        employeesFullNameMap={employeesFullNameMap}
                        currentUser={currentUser}
                        showDetailsFirst={true}
                        modalZIndex="z-[10001]"
                        onClose={() => setSelectedLcForModal(null)}
                    />
                </React.Suspense>
            )}
        </div>,
        document.body
    );
};
