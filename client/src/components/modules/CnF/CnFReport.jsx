import React, { useState, useRef, useEffect } from 'react';
import { XIcon, PrinterIcon, SearchIcon, FunnelIcon, ChevronDownIcon } from '../../Icons';
import { generateCnFAgentListReportPDF } from '../../../utils/pdfGenerator';
import { formatDate } from '../../../utils/helpers';

const CnFReport = ({ isOpen, onClose, agents = [], moduleType = '' }) => {
    if (!isOpen) return null;

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [filters, setFilters] = useState({ name: '', status: '', uom: '' });
    const [filterSearchInputs, setFilterSearchInputs] = useState({ nameSearch: '' });
    const [filterDropdownOpen, setFilterDropdownOpen] = useState({ name: false });

    const filterButtonRef = useRef(null);
    const filterPanelRef = useRef(null);
    const nameFilterRef = useRef(null);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterPanel && filterPanelRef.current && !filterPanelRef.current.contains(event.target) && !filterButtonRef.current?.contains(event.target)) {
                setShowFilterPanel(false);
            }
            if (filterDropdownOpen.name && nameFilterRef.current && !nameFilterRef.current.contains(event.target)) {
                setFilterDropdownOpen(prev => ({ ...prev, name: false }));
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') { setShowFilterPanel(false); onClose(); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showFilterPanel, filterDropdownOpen]);

    const hasActiveFilters = Object.values(filters).some(v => v !== '');

    const getUniqueNames = () => [...new Set(agents.map(a => (a.name || '').trim()).filter(Boolean))].sort();
    const getUniqueStatuses = () => [...new Set(agents.map(a => (a.status || '').trim()).filter(Boolean))].sort();
    const getUniqueUoms = () => [...new Set(agents.map(a => ((a.uom || a.commissionType || '').toUpperCase()).trim()).filter(Boolean))].sort();

    const filteredAgents = agents.filter(agent => {
        if (filters.name && (agent.name || '').toLowerCase() !== filters.name.toLowerCase()) return false;
        if (filters.status && (agent.status || '').toLowerCase() !== filters.status.toLowerCase()) return false;
        if (filters.uom && (agent.uom || agent.commissionType || '').toUpperCase() !== filters.uom.toUpperCase()) return false;
        return true;
    });

    const summary = {
        totalAgents: filteredAgents.length,
        activeCount: filteredAgents.filter(a => (a.status || '').toLowerCase() === 'active').length,
        totalBalance: filteredAgents.reduce((sum, a) => sum + (parseFloat(a.totalBalance) || 0), 0),
        avgCommission: filteredAgents.length > 0
            ? filteredAgents.reduce((sum, a) => sum + (parseFloat(a.commission) || 0), 0) / filteredAgents.length
            : 0,
    };

    const resetFilters = () => {
        setFilters({ name: '', status: '', uom: '' });
        setFilterSearchInputs({ nameSearch: '' });
        setFilterDropdownOpen({ name: false });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-[1200px] max-h-[90vh] overflow-visible rounded-3xl shadow-2xl flex flex-col">

                {/* Modal Header/Toolbar */}
                <div className="flex flex-row items-center justify-between px-6 sm:px-8 py-4 border-b border-gray-100 gap-2 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center bg-indigo-50 rounded-xl">
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                        </div>
                        <h3 className="text-base sm:text-xl font-black text-gray-800 truncate leading-none">
                            {moduleType ? `${moduleType} C&F` : 'C&F'} Agent Report
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Filter Button */}
                        <div className="relative flex items-center">
                            <button
                                ref={filterButtonRef}
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all border ${showFilterPanel || hasActiveFilters
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
                                    }`}
                            >
                                <FunnelIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${showFilterPanel || hasActiveFilters ? 'text-white' : 'text-gray-400'}`} />
                            </button>

                            {/* Filter Panel */}
                            {showFilterPanel && (
                                <>
                                    <div className="fixed inset-0 bg-black/10 z-[2005] md:hidden" onClick={() => setShowFilterPanel(false)} />
                                    <div ref={filterPanelRef} className="fixed inset-x-4 top-24 md:absolute md:top-full md:right-0 md:mt-2 w-auto md:w-72 bg-white border border-gray-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[2010] p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-visible">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                            <h4 className="font-bold text-gray-900 text-sm">Filter Agents</h4>
                                            <button onClick={resetFilters} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider">Reset</button>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Name Filter */}
                                            <div className={`space-y-1.5 relative ${filterDropdownOpen.name ? 'z-50' : 'z-10'}`} ref={nameFilterRef}>
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Agent Name</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterSearchInputs.nameSearch}
                                                        onChange={(e) => {
                                                            setFilterSearchInputs({ nameSearch: e.target.value });
                                                            setFilters(prev => ({ ...prev, name: e.target.value }));
                                                            setFilterDropdownOpen({ name: true });
                                                        }}
                                                        onFocus={() => setFilterDropdownOpen({ name: true })}
                                                        placeholder={filters.name || 'Search agent...'}
                                                        className={`w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm hover:border-gray-200 pr-10 ${filters.name ? 'placeholder:text-gray-900 placeholder:font-semibold' : 'placeholder:text-gray-300'}`}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                        {filters.name && (
                                                            <button type="button" onClick={() => { setFilters(prev => ({ ...prev, name: '' })); setFilterSearchInputs({ nameSearch: '' }); setFilterDropdownOpen({ name: false }); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                                                                <XIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <SearchIcon className="w-4 h-4 text-gray-300 pointer-events-none" />
                                                    </div>
                                                </div>
                                                {filterDropdownOpen.name && (() => {
                                                    const opts = getUniqueNames().filter(n => n.toLowerCase().includes(filterSearchInputs.nameSearch.toLowerCase()));
                                                    return opts.length > 0 ? (
                                                        <div className="absolute z-[2020] mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                                            {opts.map(n => (
                                                                <button key={n} type="button" onMouseDown={(e) => { e.preventDefault(); setFilters(prev => ({ ...prev, name: n })); setFilterSearchInputs({ nameSearch: '' }); setFilterDropdownOpen({ name: false }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors">
                                                                    {n}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            {/* Status Filter */}
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">Status</label>
                                                <div className="flex gap-2 flex-wrap">
                                                    {['', ...getUniqueStatuses()].map(s => (
                                                        <button
                                                            key={s || 'all'}
                                                            type="button"
                                                            onClick={() => setFilters(prev => ({ ...prev, status: s }))}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filters.status === s
                                                                ? 'bg-blue-600 border-blue-600 text-white shadow'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'
                                                                }`}
                                                        >
                                                            {s || 'All'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* UOM Filter */}
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pl-1">UOM</label>
                                                <div className="flex gap-2 flex-wrap">
                                                    {['', ...getUniqueUoms()].map(u => (
                                                        <button
                                                            key={u || 'all'}
                                                            type="button"
                                                            onClick={() => setFilters(prev => ({ ...prev, uom: u }))}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filters.uom === u
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200'
                                                                }`}
                                                        >
                                                            {u || 'All'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => setShowFilterPanel(false)}
                                                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all mt-2 active:scale-[0.98]"
                                            >
                                                APPLY FILTERS
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Print PDF Button */}
                        <button
                            onClick={() => generateCnFAgentListReportPDF(filteredAgents, moduleType)}
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
                            title="Download PDF Report"
                        >
                            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </button>

                        {/* Close Button */}
                        <button onClick={onClose} className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                            <XIcon className="w-4 h-4 sm:w-6 sm:h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white">
                    <div className="max-w-[1100px] mx-auto space-y-6 sm:space-y-8">

                        {/* Company Header */}
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 tracking-tight">M/S ANI ENTERPRISE</h1>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">766, H.M Tower, Level-06, Borogola, Bogura-5800, Bangladesh</p>
                            <p className="text-[12px] sm:text-[14px] text-gray-600">+8802588813057, anienterprise051@gmail.com, www.anienterprises.com.bd</p>
                        </div>

                        <div className="border-t-2 border-gray-900 w-full mt-4" />
                        <div className="flex justify-center -mt-6">
                            <div className="bg-white border-2 border-gray-900 px-12 py-1.5 inline-block">
                                <h2 className="text-xl font-bold text-gray-900 tracking-wide uppercase">
                                    {moduleType ? `${moduleType} C&F` : 'C&F'} Agent List Report
                                </h2>
                            </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex justify-between items-end text-[13px] text-gray-800 pt-4 px-2">
                            <div className="flex flex-col gap-1">
                                {filters.name && <div className="flex"><span className="font-bold text-gray-900 w-28">Agent:</span><span>{filters.name}</span></div>}
                                {filters.status && <div className="flex"><span className="font-bold text-gray-900 w-28">Status:</span><span>{filters.status}</span></div>}
                                {filters.uom && <div className="flex"><span className="font-bold text-gray-900 w-28">UOM:</span><span>{filters.uom}</span></div>}
                                {!hasActiveFilters && <div className="flex"><span className="font-bold text-gray-900 w-28">Total Agents:</span><span>{filteredAgents.length}</span></div>}
                            </div>
                            <div className="font-bold"><span className="text-gray-900">Printed on: </span><span className="text-gray-900">{formatDate(new Date().toISOString().split('T')[0])}</span></div>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto border border-gray-900">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-900">
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold text-gray-900 uppercase w-[5%]">SL</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-center text-[11px] font-bold text-gray-900 uppercase w-[10%]">ID</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase w-[25%]">Name</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase w-[20%]">Contact Person</th>
                                        <th className="border-r border-gray-900 px-2 py-2 text-left text-[11px] font-bold text-gray-900 uppercase w-[20%]">Phone</th>
                                        <th className="px-2 py-2 text-right text-[11px] font-bold text-gray-900 uppercase w-[20%]">Total Balance (Tk)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredAgents.length > 0 ? filteredAgents.map((agent, idx) => {
                                        const balance = parseFloat(agent.totalBalance) || 0;
                                        const isActive = (agent.status || '').toLowerCase() === 'active';
                                        return (
                                            <tr key={agent._id || idx} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="border-r border-gray-200 px-2 py-2 text-[12px] text-gray-600 text-center">{idx + 1}</td>
                                                <td className="border-r border-gray-200 px-2 py-2 text-[12px] text-gray-900 font-bold text-center">{agent.cnfId || '-'}</td>
                                                <td className="border-r border-gray-200 px-2 py-2 text-[12px] text-gray-900 font-semibold">{agent.name || '-'}</td>
                                                <td className="border-r border-gray-200 px-2 py-2 text-[12px] text-gray-700">{agent.contactPerson || '-'}</td>
                                                <td className="border-r border-gray-200 px-2 py-2 text-[12px] text-gray-700">{agent.phone || '-'}</td>
                                                <td className="px-2 py-2 text-[12px] text-right font-black text-indigo-700">
                                                    {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan="9" className="px-4 py-10 text-center text-gray-400 italic text-[12px]">No agents found for the selected criteria.</td></tr>
                                    )}
                                </tbody>
                                {filteredAgents.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-gray-100 border-t-2 border-gray-900">
                                            <td colSpan="5" className="px-2 py-2 text-[12px] font-black text-gray-900 text-right uppercase tracking-wider border-r border-gray-900">Grand Total</td>
                                            <td className="px-2 py-2 text-[13px] text-right font-black text-indigo-700">
                                                {summary.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {filteredAgents.length > 0 ? filteredAgents.map((agent, idx) => {
                                const balance = parseFloat(agent.totalBalance) || 0;
                                const isActive = (agent.status || '').toLowerCase() === 'active';
                                return (
                                    <div key={agent._id || idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{agent.cnfId || '-'}</div>
                                                <div className="text-sm font-black text-gray-900">{agent.name || '-'}</div>
                                                <div className="text-[11px] text-gray-600 font-medium pt-0.5">{agent.contactPerson || '-'}</div>
                                                <div className="text-[11px] text-gray-500 font-medium">{agent.phone || '-'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1 leading-none">Balance</div>
                                                <div className="text-[15px] font-black text-indigo-700">Tk {balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center text-gray-400 italic text-sm">
                                    No agents found for the selected criteria.
                                </div>
                            )}

                            {filteredAgents.length > 0 && (
                                <div className="bg-gray-900 rounded-2xl p-4 shadow-lg space-y-3 mt-4">
                                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Grand Total Summary</div>
                                        <div className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">{filteredAgents.length} Agents</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Total Agents</div>
                                            <div className="text-lg font-black text-white">{summary.totalAgents}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Active</div>
                                            <div className="text-lg font-black text-emerald-400">{summary.activeCount}</div>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <div className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Total Balance</div>
                                            <div className="text-xl font-black text-indigo-300">Tk {summary.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 px-2">
                            <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50 shadow-sm hover:shadow-md transition-all">
                                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Total Agents</div>
                                <div className="text-2xl font-black text-gray-900">{summary.totalAgents}</div>
                            </div>
                            <div className="border border-emerald-200 p-5 rounded-2xl bg-emerald-50/50 shadow-sm hover:shadow-md transition-all">
                                <div className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider mb-2">Active Agents</div>
                                <div className="text-2xl font-black text-emerald-700">{summary.activeCount}</div>
                            </div>
                            <div className="border border-blue-200 p-5 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all ring-2 ring-blue-500/10">
                                <div className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2">Avg. Commission</div>
                                <div className="text-2xl font-black text-gray-900">{summary.avgCommission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div className="border border-indigo-200 p-5 rounded-2xl bg-indigo-50/50 shadow-sm hover:shadow-md transition-all">
                                <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Total Balance (Tk)</div>
                                <div className="text-2xl font-black text-indigo-700">{summary.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-3 gap-8 pt-24 px-4 pb-12">
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Prepared By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Verified By</div></div>
                            <div className="text-center"><div className="border-t border-dotted border-gray-900 pt-2 text-[10px] font-bold text-gray-900 uppercase">Authorized Signature</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CnFReport;
