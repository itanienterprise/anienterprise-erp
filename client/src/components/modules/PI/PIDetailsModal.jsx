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
    initialRevisionIndex = null,
    onClose
}) => {
    const [selectedIpForModal, setSelectedIpForModal] = useState(null);

    // Resolve full target PI record if available
    const resolvedPi = useMemo(() => {
        if (!piRecord) return null;
        const cleanTarget = String(piRecord.piNumber || piRecord || '').replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
        const found = (piRecords || []).find(p => {
            const pNum = String(p.piNumber || '').replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
            return pNum === cleanTarget;
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

            revisions.forEach(rev => {
                list.push({
                    ...rev,
                    ipNumbers: rev.ipNumbers || (rev.ipNumber ? String(rev.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : (resolvedPi.ipNumbers || (resolvedPi.ipNumber ? String(resolvedPi.ipNumber).split(',').map(s => s.trim()).filter(Boolean) : []))),
                    isOriginal: rev.reviseNo === 'Original PI'
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
    const linkedLcNo = useMemo(() => {
        if (!resolvedPi?.piNumber) return null;
        const cleanPiNum = String(resolvedPi.piNumber).replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
        const linked = (lcRecords || []).find(lc => {
            const lcPi = String(lc.piNo || lc.piNumber || '').replace(/\s*\(revised\)/gi, '').trim().toLowerCase();
            return lcPi === cleanPiNum;
        });
        return linked ? linked.lcNo : null;
    }, [resolvedPi, lcRecords]);

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
        if (!resolvedPi) return;
        const enriched = {
            ...resolvedPi,
            ...activeRevision,
            piNumber: `${resolvedPi.piNumber}${activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}`
        };

        if (!enriched.exporterAddress || !enriched.exporterEmail || !enriched.exporterSignature) {
            const exp = exporters?.find(e => e.name === enriched.exporterName);
            if (exp) {
                enriched.exporterAddress = enriched.exporterAddress || exp.address;
                enriched.exporterContact = enriched.exporterContact || exp.phone;
                enriched.exporterEmail = enriched.exporterEmail || exp.email;
                enriched.exporterSignature = enriched.exporterSignature || exp.signature;
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
        const enriched = {
            ...resolvedPi,
            ...activeRevision,
            piNumber: `${resolvedPi.piNumber}${activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}`
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-600 rounded-2xl">
                            <EyeIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-900 tracking-tight">Proforma Invoice History Explorer</h3>
                            <p className="text-sm text-gray-500 font-medium">
                                PI Number: <span className="font-bold text-blue-600 font-mono">{resolvedPi.piNumber}{resolvedPi.revisions && resolvedPi.revisions.length > 0 && activeRevision.reviseNo !== 'Original PI' ? ' (REVISED)' : ''}</span>
                                {' • '}Date: <span className="font-bold text-gray-800 font-mono">{formatDate(activeRevision.reviseDate || resolvedPi.date)}</span>
                                {linkedLcNo && (
                                    <>
                                        {' • '}LC: <span className="font-bold text-emerald-600 font-mono">{linkedLcNo}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-200 text-gray-400 hover:text-gray-600 active:scale-95 transition-all cursor-pointer"
                        title="Close Modal"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    {/* Left Sidebar: Timeline */}
                    <div className="w-60 border-r border-gray-100 overflow-y-auto p-6 bg-gray-50/30 flex-shrink-0">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Revision Timeline</h4>
                        <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-8">
                            {timeline.map((rev, idx) => {
                                const isActive = activeHistoryIndex === idx;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveHistoryIndex(idx)}
                                        className="relative cursor-pointer group"
                                    >
                                        {/* Timeline Bullet */}
                                        <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${isActive
                                            ? 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 scale-110 shadow-sm'
                                            : 'bg-white border-gray-300 group-hover:border-blue-400 group-hover:scale-105'
                                            }`} />

                                        {/* Timeline Content Card */}
                                        <div className={`p-4 rounded-2xl border transition-all ${isActive
                                            ? 'bg-white border-blue-200 shadow-md shadow-blue-500/5'
                                            : 'bg-white/50 border-gray-100 hover:border-gray-200 hover:bg-white hover:shadow-sm'
                                            }`}>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${rev.isOriginal
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                {rev.reviseNo}
                                            </span>
                                            <p className="text-sm font-bold text-gray-800 mt-2">
                                                {rev.isOriginal ? 'Initial Creation' : 'Revised State'}
                                            </p>
                                            <p className="text-sm font-medium text-gray-500 mt-1 font-mono">
                                                {formatDate(rev.reviseDate)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Pane: Details */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-8">
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Card 1: Logistics */}
                                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Logistics & Route</h5>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Place of Receipt</span>
                                                <span className="font-bold text-gray-800 mt-0.5 block">{activeRevision.placeOfReceipt || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Port of Loading</span>
                                                <span className="font-bold text-gray-800 mt-0.5 block">{activeRevision.portOfLoading || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Port of Discharge</span>
                                                <span className="font-bold text-gray-800 mt-0.5 block">{activeRevision.portOfDischarge || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 2: Dates & Certifications */}
                                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Dates & Certification</h5>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Revise / Original Date</span>
                                                <span className="font-bold text-gray-800 mt-0.5 block font-mono">{formatDate(activeRevision.reviseDate)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Validity Date</span>
                                                <span className="font-bold text-rose-500 mt-0.5 block font-mono">{formatDate(activeRevision.validityDate)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Certification</span>
                                                <div className="space-y-1">
                                                    {activeRevision.certification
                                                        ? activeRevision.certification.split(',').map((cert, cIdx) => (
                                                            <span key={cIdx} className="font-bold text-gray-800 block text-sm">{cert.trim()}</span>
                                                        ))
                                                        : <span className="font-bold text-gray-800 block text-sm">N/A</span>
                                                    }
                                                </div>
                                                {activeRevision.certification && activeRevision.certification.split(',').map(s => s.trim().toLowerCase()).includes('packing') && (
                                                    <div className="mt-3">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Packing Type</span>
                                                        <div className="space-y-1">
                                                            {activeRevision.packingType
                                                                ? activeRevision.packingType.split(',').map((pack, pIdx) => (
                                                                    <span key={pIdx} className="font-bold text-gray-800 block text-sm">{pack.trim()}</span>
                                                                ))
                                                                : <span className="font-bold text-gray-800 block text-sm">N/A</span>
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: IP Records, LC & Reference */}
                                    <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">IP Records, LC & Remarks</h5>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">LC Number</span>
                                                {linkedLcNo ? (
                                                    <span className="text-sm font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100 font-mono inline-block mt-1">
                                                        {linkedLcNo}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 font-bold text-sm">No LC Linked</span>
                                                )}
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Import Permission (IP)</span>
                                                <div className="flex flex-wrap gap-1.5 mt-1">
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
                                                        <span className="text-gray-500 font-bold text-sm">N/A</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Remarks</span>
                                                <p className="text-sm font-bold text-gray-800 mt-1 max-h-16 overflow-y-auto">{activeRevision.remarks || 'No remarks provided.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Products Table */}
                                <div className="space-y-3">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Products Breakdown</h5>
                                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
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

                                    {/* Totals Summary Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto pt-6">
                                        {/* Total Quantity Card */}
                                        <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-5 text-center shadow-sm">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Quantity</span>
                                            <span className="text-xl font-black text-gray-900 mt-1 block">
                                                {parseFloat(activeRevision.grandTotalQuantity || 0).toLocaleString('en-US')} kg
                                            </span>
                                        </div>
                                        {/* Grand Total Card */}
                                        <div className="bg-blue-600 text-white rounded-2xl p-5 text-center shadow-lg shadow-blue-500/20">
                                            <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest block">Grand Total Value</span>
                                            <span className="text-xl font-black text-white mt-1 block">
                                                ${parseFloat(activeRevision.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons under Cards */}
                                    <div className="flex items-center justify-center gap-4 pt-6 pb-2">
                                        <button
                                            type="button"
                                            onClick={handlePrintPDF}
                                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <PDFIcon className="w-4 h-4 text-white" />
                                            <span>Print PI PDF</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePrintBankApplication}
                                            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <FileTextIcon className="w-4 h-4 text-white" />
                                            <span>Bank Application</span>
                                        </button>
                                    </div>
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
                    currentPi={resolvedPi}
                    onClose={() => setSelectedIpForModal(null)}
                />
            )}
        </div>,
        document.body
    );
};
