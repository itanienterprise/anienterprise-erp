import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { ChevronDownIcon, SearchIcon, CheckIcon, EditIcon, TrashIcon, XIcon } from '../../Icons';
import './Attendance.css';

// ─── Custom ERP Dropdown Select (Styled like SystemAccess / Token / ERP Standard) ───
const ERPSelect = ({ value, onChange, options = [], placeholder, className = '', style, disabled = false, searchable }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Normalize options to [{ value, label }]
  const normalizedOptions = React.useMemo(() => {
    return (options || []).map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Determine if search should be enabled (auto-enable if >= 6 options, e.g. for employees list)
  const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length >= 6;

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return normalizedOptions;
    const q = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter(opt =>
      (opt.label && String(opt.label).toLowerCase().includes(q)) ||
      (opt.value && String(opt.value).toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchTerm]);

  // Find currently selected option
  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (val) => {
    if (onChange) {
      onChange({ target: { value: val } });
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative inline-block text-left ${className}`} style={style} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full h-10 px-3.5 pr-8 bg-white border rounded-xl text-left text-sm font-medium transition-all flex items-center justify-between shadow-sm outline-none cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 text-gray-900'
            : 'border-slate-200 hover:border-slate-300 text-gray-800'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <span className="truncate block font-sans">
          {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
        </span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-slate-400">
          <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[200px] z-50 bg-white border border-slate-100 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto animate-in fade-in duration-150">
          {/* Search Bar if searchable */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="relative flex items-center">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  autoFocus
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-colors font-sans"
                />
              </div>
            </div>
          )}

          {/* Optional placeholder / "All" option */}
          {placeholder && (
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-3.5 py-2 text-left text-sm transition-colors flex items-center justify-between font-sans ${
                !value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{placeholder}</span>
              {!value && <CheckIcon className="w-4 h-4 text-blue-600" />}
            </button>
          )}

          {/* Filtered Options List */}
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center font-sans">
              No matching options
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full px-3.5 py-2 text-left text-sm transition-colors flex items-center justify-between font-sans ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-700 hover:bg-blue-50/70 hover:text-blue-900'
                  }`}
                >
                  <span className="truncate mr-2">{opt.label}</span>
                  {isSelected && <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── Tiny SVG Icons ──────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IcoHome     = () => <Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />;
const IcoList     = () => <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />;
const IcoClock    = () => <Icon d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 5v5l4 2" />;
const IcoShift    = () => <Icon d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-14v4l3 3" />;
const IcoLeave    = () => <Icon d="M9 14l-4-4 4-4M5 10h14M15 14l4-4-4-4" />;
const IcoDevice   = () => <Icon d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.63 19.79 19.79 0 01.22 1a2 2 0 012-1.18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 7a15.89 15.89 0 006.9 6.9l.81-.85a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />;
const IcoRefresh  = () => <Icon d="M1 4v6h6M23 20v-6h-6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />;
const IcoEdit     = () => <Icon d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />;
const IcoTrash    = () => <Icon d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />;
const IcoCheck    = () => <Icon d="M20 6L9 17l-5-5" />;
const IcoX        = () => <Icon d="M18 6L6 18M6 6l12 12" />;
const IcoPlus     = () => <Icon d="M12 5v14M5 12h14" />;
const IcoWarning  = () => <Icon d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />;
const IcoFingerprint = () => <Icon d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt12 = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const fmtDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const todayStr = () => new Date().toISOString().split('T')[0];

const StatusBadge = ({ status }) => {
  const map = {
    PRESENT: ['present', '●  Present'],
    ABSENT:  ['absent',  '● Absent'],
    LATE:    ['late',    '● Late'],
    HALF_DAY:['half',    '● Half Day'],
    LEAVE:   ['leave',   '● On Leave'],
    WEEKEND: ['weekend', '● Weekend'],
    HOLIDAY: ['holiday', '● Holiday'],
    PENDING: ['pending', '● Pending'],
    APPROVED:['approved','● Approved'],
    REJECTED:['rejected','● Rejected'],
  };
  const [cls, label] = map[status] || ['weekend', status];
  return <span className={`att-badge ${cls}`}>{label}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Attendance = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState({ present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0, totalEmployees: 0, unmatchedPunches: 0 });
  const [livePunches, setLivePunches] = useState([]);
  const [logs, setLogs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [punches, setPunches] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState({});
  const [processing, setProcessing] = useState(false);

  // Filters
  const [logDate, setLogDate] = useState(todayStr());
  const [logEmpId, setLogEmpId] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [punchDate, setPunchDate] = useState(todayStr());

  // Modals
  const [shiftModal, setShiftModal] = useState(null); // null | {mode:'add'|'edit', data?}
  const [leaveModal, setLeaveModal] = useState(null);
  const [mappingModal, setMappingModal] = useState(null);
  const [editLogModal, setEditLogModal] = useState(null);

  const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
  const canViewAll = isAdmin ||
    (currentUser?.role || '').toLowerCase() === 'incharge' ||
    hasPermission(currentUser, 'attendance', 'viewAll') ||
    hasPermission(currentUser, 'attendance', 'edit') ||
    hasPermission(currentUser, 'attendance', 'delete') ||
    hasPermission(currentUser, 'attendance', 'special') ||
    hasPermission(currentUser, 'employees', 'view') ||
    hasPermission(currentUser, 'employees', 'edit');

  const canEdit = isAdmin || hasPermission(currentUser, 'attendance', 'edit') || hasPermission(currentUser, 'employees', 'edit');
  const canDelete = isAdmin || hasPermission(currentUser, 'attendance', 'delete') || hasPermission(currentUser, 'employees', 'delete');
  const canApproveLeave = isAdmin || hasPermission(currentUser, 'attendance', 'approveLeave');
  const canEditLeave = isAdmin || hasPermission(currentUser, 'attendance', 'editLeave') || hasPermission(currentUser, 'attendance', 'edit');

  const myEmployee = useMemo(() => {
    const curEmpId = (currentUser?.employeeId || currentUser?.username || '').toLowerCase().trim();
    const curName = (currentUser?.name || '').toLowerCase().trim();
    return (employees || []).find(emp => {
      const empId = (emp.employeeId || emp.empId || '').toLowerCase().trim();
      const empName = (emp.name || emp.nameEn || '').toLowerCase().trim();
      return (curEmpId && (empId === curEmpId || emp._id === curEmpId)) || (curName && empName === curName);
    });
  }, [employees, currentUser]);

  // ── API calls ──────────────────────────────────────────────────────────────
  const load = useCallback(async (key, fn) => {
    setLoading(p => ({ ...p, [key]: true }));
    try { await fn(); } catch (e) { console.error(e); }
    finally { setLoading(p => ({ ...p, [key]: false })); }
  }, []);

  const fetchSummary = () => load('summary', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/summary/today`);
    setSummary(r.data);
  });

  const fetchLive = () => load('live', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/live`);
    setLivePunches(r.data || []);
  });

  const fetchLogs = () => load('logs', async () => {
    const params = new URLSearchParams();
    if (logDate) params.set('date', logDate);
    if (!canViewAll) {
      if (myEmployee?._id) params.set('employeeId', myEmployee._id);
    } else {
      if (logEmpId) params.set('employeeId', logEmpId);
    }
    if (logStatus) params.set('status', logStatus);
    const r = await axios.get(`${API_BASE_URL}/api/attendance/logs?${params}`);
    setLogs(r.data || []);
  });

  const fetchShifts = () => load('shifts', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/shifts`);
    setShifts(r.data || []);
  });

  const fetchLeaves = () => load('leaves', async () => {
    const params = new URLSearchParams();
    if (leaveStatus) params.set('status', leaveStatus);
    if (!canViewAll && myEmployee?._id) {
      params.set('employeeId', myEmployee._id);
    }
    const r = await axios.get(`${API_BASE_URL}/api/attendance/leaves?${params}`);
    setLeaves(r.data || []);
  });

  const fetchPunches = () => load('punches', async () => {
    const params = new URLSearchParams();
    params.set('date', punchDate);
    params.set('limit', '100');
    if (!canViewAll && myEmployee?._id) {
      params.set('employeeId', myEmployee._id);
    }
    const r = await axios.get(`${API_BASE_URL}/api/attendance/punches?${params}`);
    setPunches(r.data || []);
  });

  const fetchMappings = () => load('mappings', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/mappings`);
    setMappings(r.data || []);
  });

  const fetchEmployees = () => load('employees', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/employees`);
    setEmployees(r.data || []);
  });

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSummary();
    fetchLive();
    fetchEmployees();
    const iv = setInterval(() => { fetchSummary(); fetchLive(); }, 10000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (activeTab === 'logs')    { fetchLogs();    } }, [activeTab, logDate, logStatus, logEmpId, canViewAll, myEmployee]);
  useEffect(() => { if (activeTab === 'shifts' && canViewAll)  { fetchShifts();  } }, [activeTab, canViewAll]);
  useEffect(() => { if (activeTab === 'leaves')  { fetchLeaves();  } }, [activeTab, leaveStatus, canViewAll, myEmployee]);
  useEffect(() => { if (activeTab === 'punches' && canViewAll) { fetchPunches(); } }, [activeTab, punchDate, canViewAll, myEmployee]);
  useEffect(() => { if (activeTab === 'device' && canViewAll)  { fetchMappings(); fetchEmployees(); } }, [activeTab, canViewAll]);

  useEffect(() => {
    if (!canViewAll && (activeTab === 'shifts' || activeTab === 'punches' || activeTab === 'device')) {
      setActiveTab('dashboard');
    }
  }, [canViewAll, activeTab]);

  // ── Process attendance ─────────────────────────────────────────────────────
  const handleProcess = async (date) => {
    setProcessing(true);
    try {
      const r = await axios.post(`${API_BASE_URL}/api/attendance/process`, { date: date || logDate });
      alert(r.data.message);
      fetchLogs();
      fetchSummary();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message));
    } finally { setProcessing(false); }
  };

  // ── Shift CRUD ─────────────────────────────────────────────────────────────
  const handleShiftSave = async (data) => {
    try {
      if (shiftModal?.mode === 'edit' && shiftModal.data?._id) {
        await axios.put(`${API_BASE_URL}/api/attendance/shifts/${shiftModal.data._id}`, data);
      } else {
        await axios.post(`${API_BASE_URL}/api/attendance/shifts`, data);
      }
      setShiftModal(null);
      fetchShifts();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleShiftDelete = async (id) => {
    if (!window.confirm('Delete this shift?')) return;
    await axios.delete(`${API_BASE_URL}/api/attendance/shifts/${id}`);
    fetchShifts();
  };

  // ── Leave CRUD ─────────────────────────────────────────────────────────────
  const handleLeaveAction = async (id, status, note) => {
    try {
      await axios.put(`${API_BASE_URL}/api/attendance/leaves/${id}`, { status, approveNote: note || '' });
      fetchLeaves();
      fetchSummary();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleLeaveSave = async (data) => {
    try {
      if (leaveModal?.mode === 'edit' && leaveModal?.data?._id) {
        await axios.put(`${API_BASE_URL}/api/attendance/leaves/${leaveModal.data._id}`, data);
      } else {
        await axios.post(`${API_BASE_URL}/api/attendance/leaves`, data);
      }
      setLeaveModal(null);
      fetchLeaves();
      fetchSummary();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleLeaveDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave request?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/attendance/leaves/${id}`);
      fetchLeaves();
      fetchSummary();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  // ── Mapping CRUD ───────────────────────────────────────────────────────────
  const handleMappingSave = async (data) => {
    try {
      await axios.post(`${API_BASE_URL}/api/attendance/mappings`, data);
      setMappingModal(null);
      fetchMappings();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleMappingDelete = async (id) => {
    if (!window.confirm('Remove this mapping?')) return;
    await axios.delete(`${API_BASE_URL}/api/attendance/mappings/${id}`);
    fetchMappings();
  };

  // ── Log manual edit ────────────────────────────────────────────────────────
  const handleLogEdit = async (data) => {
    try {
      await axios.put(`${API_BASE_URL}/api/attendance/logs/${editLogModal._id}`, data);
      setEditLogModal(null);
      fetchLogs();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <IcoHome /> },
    { id: 'logs',      label: canViewAll ? 'Attendance Logs' : 'My Attendance Logs', icon: <IcoList /> },
    { id: 'leaves',    label: canViewAll ? 'Leaves' : 'My Leaves', icon: <IcoLeave />, badge: leaves.filter(l => l.status === 'PENDING').length },
    ...(canViewAll ? [
      { id: 'shifts',    label: 'Shifts', icon: <IcoShift /> },
      { id: 'punches',   label: 'Raw Punches', icon: <IcoClock /> },
      { id: 'device',    label: 'Device / Mapping', icon: <IcoDevice />, badge: summary.unmatchedPunches || 0 },
    ] : [])
  ];

  return (
    <div className="attendance-module">
      {/* Header */}
      <div className="att-header">
        <h1 className="att-header-title">
          <span style={{ marginRight: 8 }}>👆</span>Attendance Management
        </h1>
        <p className="att-header-sub">ZKTech F8 Biometric Integration · Real-time Tracking</p>
      </div>

      {/* Tabs */}
      <div className="att-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`att-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            {t.label}
            {t.badge > 0 && <span className="att-tab-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Dashboard ───────────────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          summary={summary}
          livePunches={livePunches}
          loadingLive={loading.live}
          onRefresh={() => { fetchSummary(); fetchLive(); }}
          onProcess={() => handleProcess(todayStr())}
          processing={processing}
          canEdit={canEdit}
          canViewAll={canViewAll}
        />
      )}

      {/* ── Logs ────────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <LogsTab
          logs={logs}
          loading={loading.logs}
          logDate={logDate} setLogDate={setLogDate}
          logStatus={logStatus} setLogStatus={setLogStatus}
          logEmpId={logEmpId} setLogEmpId={setLogEmpId}
          employees={employees}
          onRefresh={fetchLogs}
          onProcess={handleProcess}
          processing={processing}
          canEdit={canEdit}
          canViewAll={canViewAll}
          onEdit={canEdit ? (log) => setEditLogModal(log) : null}
        />
      )}

      {/* ── Leaves ──────────────────────────────────────────────────────────── */}
      {activeTab === 'leaves' && (
        <LeavesTab
          leaves={leaves}
          loading={loading.leaves}
          leaveStatus={leaveStatus} setLeaveStatus={setLeaveStatus}
          onRefresh={fetchLeaves}
          onAction={handleLeaveAction}
          onAdd={() => setLeaveModal({ mode: 'add' })}
          onEdit={(l) => setLeaveModal({ mode: 'edit', data: l })}
          onDelete={canDelete ? handleLeaveDelete : null}
          canEdit={canEdit}
          canDelete={canDelete}
          canApproveLeave={canApproveLeave}
          canEditLeave={canEditLeave}
          canViewAll={canViewAll}
          employees={employees}
          currentUser={currentUser}
          myEmployee={myEmployee}
        />
      )}

      {/* ── Shifts ──────────────────────────────────────────────────────────── */}
      {activeTab === 'shifts' && (
        <ShiftsTab
          shifts={shifts}
          loading={loading.shifts}
          onRefresh={fetchShifts}
          onAdd={canEdit ? () => setShiftModal({ mode: 'add' }) : null}
          onEdit={canEdit ? (s) => setShiftModal({ mode: 'edit', data: s }) : null}
          onDelete={canEdit ? handleShiftDelete : null}
        />
      )}

      {/* ── Raw Punches ──────────────────────────────────────────────────────── */}
      {activeTab === 'punches' && (
        <PunchesTab
          punches={punches}
          loading={loading.punches}
          punchDate={punchDate} setPunchDate={setPunchDate}
          onRefresh={fetchPunches}
          mappings={mappings}
        />
      )}

      {/* ── Device / Mapping ────────────────────────────────────────────────── */}
      {activeTab === 'device' && (
        <DeviceTab
          mappings={mappings}
          loading={loading.mappings}
          employees={employees}
          summary={summary}
          onRefresh={fetchMappings}
          onAdd={canEdit ? () => setMappingModal(true) : null}
          onDelete={canEdit ? handleMappingDelete : null}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {shiftModal && (
        <ShiftModal
          mode={shiftModal.mode}
          data={shiftModal.data}
          onSave={handleShiftSave}
          onClose={() => setShiftModal(null)}
        />
      )}
      {leaveModal && (
        <LeaveModal
          mode={leaveModal.mode || 'add'}
          data={leaveModal.data || null}
          employees={employees}
          onSave={handleLeaveSave}
          onClose={() => setLeaveModal(null)}
          canViewAll={canViewAll}
          canApproveLeave={canApproveLeave}
          canEditLeave={canEditLeave}
          currentUser={currentUser}
          myEmployee={myEmployee}
        />
      )}
      {mappingModal && (
        <MappingModal
          employees={employees}
          onSave={handleMappingSave}
          onClose={() => setMappingModal(null)}
        />
      )}
      {editLogModal && (
        <EditLogModal
          log={editLogModal}
          onSave={handleLogEdit}
          onClose={() => setEditLogModal(null)}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Tab
// ═══════════════════════════════════════════════════════════════════════════════
const DashboardTab = ({ summary, livePunches, loadingLive, onRefresh, onProcess, processing, canEdit, canViewAll }) => (
  <>
    {/* Warning: unmatched punches */}
    {canViewAll && summary.unmatchedPunches > 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef9c3', border: '1px solid #fde047', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: '0.84rem', color: '#713f12' }}>
        <IcoWarning />
        <strong>{summary.unmatchedPunches} unmatched punch{summary.unmatchedPunches > 1 ? 'es' : ''}</strong> — Employee enrollment not mapped.
        Go to <em>Device / Mapping</em> tab to fix.
      </div>
    )}

    {/* Summary cards */}
    {canViewAll ? (
      <div className="att-cards">
        <div className="att-card blue">
          <div className="att-card-label">Total Employees</div>
          <div className="att-card-value">{summary.totalEmployees}</div>
        </div>
        <div className="att-card green">
          <div className="att-card-label">Present Today</div>
          <div className="att-card-value">{summary.present}</div>
        </div>
        <div className="att-card red">
          <div className="att-card-label">Absent</div>
          <div className="att-card-value">{summary.absent}</div>
        </div>
        <div className="att-card yellow">
          <div className="att-card-label">Late</div>
          <div className="att-card-value">{summary.late}</div>
        </div>
        <div className="att-card purple">
          <div className="att-card-label">On Leave</div>
          <div className="att-card-value">{summary.onLeave}</div>
        </div>
        <div className="att-card orange">
          <div className="att-card-label">Half Day</div>
          <div className="att-card-value">{summary.halfDay}</div>
        </div>
      </div>
    ) : (
      <div className="att-cards">
        <div className={`att-card ${summary.myStatus === 'PRESENT' ? 'green' : (summary.myStatus === 'LEAVE' ? 'purple' : (summary.myStatus === 'LATE' ? 'yellow' : 'red'))}`}>
          <div className="att-card-label">My Status Today</div>
          <div className="att-card-value" style={{ fontSize: '1.4rem' }}>{summary.myStatus || (summary.present ? 'PRESENT' : 'ABSENT')}</div>
        </div>
        <div className="att-card green">
          <div className="att-card-label">First Punch In</div>
          <div className="att-card-value" style={{ fontSize: '1.4rem' }}>{summary.firstPunchIn ? fmt12(summary.firstPunchIn) : '—'}</div>
        </div>
        <div className="att-card orange">
          <div className="att-card-label">Last Punch Out</div>
          <div className="att-card-value" style={{ fontSize: '1.4rem' }}>{summary.lastPunchOut ? fmt12(summary.lastPunchOut) : '—'}</div>
        </div>
        <div className="att-card blue">
          <div className="att-card-label">Working Hours</div>
          <div className="att-card-value" style={{ fontSize: '1.4rem' }}>{summary.totalHours ? `${summary.totalHours}h` : '0h'}</div>
        </div>
        <div className={`att-card ${summary.late ? 'yellow' : 'blue'}`}>
          <div className="att-card-label">Late Today</div>
          <div className="att-card-value" style={{ fontSize: '1.4rem' }}>{summary.late ? 'YES' : 'NO'}</div>
        </div>
        <div className={`att-card ${summary.onLeave ? 'purple' : 'blue'}`}>
          <div className="att-card-label">On Leave</div>
          <div className="att-card-value" style={{ fontSize: '1.4rem' }}>{summary.onLeave ? 'YES' : 'NO'}</div>
        </div>
      </div>
    )}

    {/* Live Punch Feed */}
    <div className="att-panel">
      <div className="att-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="att-live-dot" />
          <h2 className="att-panel-title">{canViewAll ? 'Live Punch Feed' : 'My Recent Punches'}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button className="att-btn att-btn-primary att-btn-sm" onClick={onProcess} disabled={processing}>
              <IcoRefresh />
              {processing ? 'Processing…' : 'Process Today'}
            </button>
          )}
          <button className="att-btn att-btn-secondary att-btn-sm" onClick={onRefresh}>
            <IcoRefresh />Refresh
          </button>
        </div>
      </div>
      <div className="att-panel-body att-table-wrap">
        {loadingLive ? (
          <div style={{ padding: 24 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="att-skeleton" style={{ height: 36, marginBottom: 8, borderRadius: 8 }} />
            ))}
          </div>
        ) : livePunches.length === 0 ? (
          <div className="att-empty">
            <IcoFingerprint />
            <div className="att-empty-title">No punches yet today</div>
            <div className="att-empty-sub">The device will push punches here in real time</div>
          </div>
        ) : (
          <table className="att-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Enroll ID</th>
                <th>Type</th>
                <th>Verify</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {livePunches.map(p => (
                <tr key={p._id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt12(p.punchTime)}</td>
                  <td><span className="att-enroll-badge">{p.enrollId}</span></td>
                  <td><span className={`att-badge ${p.punchType === 'IN' ? 'present' : p.punchType === 'OUT' ? 'absent' : 'leave'}`}>{p.punchType}</span></td>
                  <td style={{ color: '#64748b', fontSize: '0.78rem' }}>{p.verifyMode}</td>
                  <td>
                    {p.unmatched
                      ? <span className="att-badge absent">⚠ Unmatched</span>
                      : <span className="att-badge present">✓ Linked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Logs Tab
// ═══════════════════════════════════════════════════════════════════════════════
const LogsTab = ({ logs, loading, logDate, setLogDate, logStatus, setLogStatus, logEmpId, setLogEmpId, employees, onRefresh, onProcess, processing, canEdit, canViewAll, onEdit }) => (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">{canViewAll ? 'Attendance Logs' : 'My Attendance Logs'}</h2>
      <div className="att-controls">
        <div className="att-date-wrap">
          <CustomDatePicker
            value={logDate}
            onChange={e => setLogDate(e.target.value)}
            compact={true}
          />
        </div>
        {canViewAll && (
          <ERPSelect
            value={logEmpId}
            onChange={e => setLogEmpId(e.target.value)}
            placeholder="All Employees"
            style={{ minWidth: 190 }}
            options={(employees || []).map(emp => ({
              value: emp._id,
              label: `${emp.name || emp.firstName || emp.employeeId}${emp.employeeId ? ` (${emp.employeeId})` : ''}`
            }))}
          />
        )}
        <ERPSelect
          value={logStatus}
          onChange={e => setLogStatus(e.target.value)}
          placeholder="All Status"
          style={{ minWidth: 140 }}
          options={['PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','WEEKEND'].map(s => ({
            value: s,
            label: s.replace('_', ' ')
          }))}
        />
        {canEdit && (
          <button className="att-btn att-btn-primary" onClick={() => onProcess(logDate)} disabled={processing}>
            <IcoRefresh />
            <span>{processing ? 'Processing…' : 'Process This Date'}</span>
          </button>
        )}
        <button className="att-btn att-btn-secondary" onClick={onRefresh}>
          <IcoRefresh />
          <span>Refresh</span>
        </button>
      </div>
    </div>
    <div className="att-table-wrap">
      {loading ? (
        <div style={{ padding: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="att-skeleton" style={{ height: 40, marginBottom: 8 }} />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="att-empty">
          <IcoList />
          <div className="att-empty-title">No records for this date</div>
          <div className="att-empty-sub">Click "Process This Date" to compute attendance from device punches</div>
        </div>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>ERP ID</th>
              <th>In Time</th>
              <th>Out Time</th>
              <th>Hours</th>
              <th>OT</th>
              <th>Status</th>
              {onEdit && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log._id}>
                <td style={{ fontWeight: 600 }}>{log.employeeName || '—'}</td>
                <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{log.employeeEmpId || '—'}</td>
                <td style={{ fontFamily: 'monospace' }}>{fmt12(log.firstPunchIn)}</td>
                <td style={{ fontFamily: 'monospace' }}>{fmt12(log.lastPunchOut)}</td>
                <td style={{ fontWeight: 600 }}>{log.totalHours ? `${log.totalHours}h` : '—'}</td>
                <td style={{ color: log.overtimeHours > 0 ? '#d97706' : '#94a3b8' }}>
                  {log.overtimeHours > 0 ? `+${log.overtimeHours}h` : '—'}
                </td>
                <td>
                  <StatusBadge status={log.status} />
                  {log.manualOverride && <span title={`Corrected by ${log.overriddenBy}`} style={{ marginLeft: 4, fontSize: '0.68rem', color: '#6366f1' }}>✎</span>}
                </td>
                {onEdit && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => onEdit(log)}
                        className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors inline-flex items-center justify-center"
                        title="Edit Attendance Log"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                      >
                        <EditIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Leaves Tab
// ═══════════════════════════════════════════════════════════════════════════════
const LeavesTab = ({
  leaves,
  loading,
  leaveStatus,
  setLeaveStatus,
  onRefresh,
  onAction,
  onAdd,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  canApproveLeave,
  canEditLeave,
  canViewAll,
  employees,
  currentUser,
  myEmployee
}) => {
  const isOwnerOf = (l) => {
    const curEmpId = (currentUser?.employeeId || currentUser?.username || '').toLowerCase().trim();
    const curUsername = (currentUser?.username || '').toLowerCase().trim();
    const curName = (currentUser?.name || '').toLowerCase().trim();
    const myEmpId = (myEmployee?.employeeId || myEmployee?.empId || '').toLowerCase().trim();
    const myEmpObjectId = myEmployee?._id ? myEmployee._id.toString() : '';

    const lEmpId = (l.employeeEmpId || '').toLowerCase().trim();
    const lEmpObjectId = l.employeeId ? l.employeeId.toString() : '';
    const lEmpName = (l.employeeName || '').toLowerCase().trim();
    const lCreatedBy = (l.createdBy || '').toLowerCase().trim();

    return (lCreatedBy && curUsername && lCreatedBy === curUsername) ||
      (myEmpObjectId && lEmpObjectId && myEmpObjectId === lEmpObjectId) ||
      (myEmpId && lEmpId && myEmpId === lEmpId) ||
      (curEmpId && lEmpId && curEmpId === lEmpId) ||
      (curUsername && lEmpId && curUsername === lEmpId) ||
      (curName && lEmpName && curName === lEmpName);
  };

  const canEditItem = (l) => {
    if (canEditLeave) return true;
    return isOwnerOf(l) && l.status === 'PENDING';
  };

  return (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">{canViewAll ? 'Leave Requests' : 'My Leaves'}</h2>
      <div className="att-controls">
        <ERPSelect
          value={leaveStatus}
          onChange={e => setLeaveStatus(e.target.value)}
          placeholder="All Status"
          style={{ minWidth: 140 }}
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
        />
        {onAdd && (
          <button className="att-btn att-btn-primary" onClick={onAdd}>
            <IcoPlus />
            <span>New Leave</span>
          </button>
        )}
        <button className="att-btn att-btn-secondary" onClick={onRefresh}>
          <IcoRefresh />
          <span>Refresh</span>
        </button>
      </div>
    </div>
    <div className="att-table-wrap">
      {loading ? (
        <div style={{ padding: 24 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="att-skeleton" style={{ height: 42, marginBottom: 8 }} />)}
        </div>
      ) : leaves.length === 0 ? (
        <div className="att-empty">
          <IcoLeave />
          <div className="att-empty-title">No leave requests</div>
        </div>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Status</th>
              {(canApproveLeave || canEditLeave || canDelete || leaves.some(l => canEditItem(l))) && <th style={{ textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l._id}>
                <td style={{ fontWeight: 600 }}>{l.employeeName || l.employeeEmpId || '—'}</td>
                <td><span className="att-badge leave">{l.leaveType}</span></td>
                <td>{fmtDate(l.fromDate)}</td>
                <td>{fmtDate(l.toDate)}</td>
                <td style={{ fontWeight: 700, textAlign: 'center' }}>{l.totalDays}</td>
                <td><StatusBadge status={l.status} /></td>
                {(canApproveLeave || canEditLeave || canDelete || canEditItem(l)) && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div className="flex items-center justify-center space-x-1.5">
                      {canApproveLeave && l.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => onAction(l._id, 'APPROVED')}
                            className="p-1 hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 rounded transition-colors inline-flex items-center justify-center"
                            title="Approve Leave"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          >
                            <CheckIcon className="w-5 h-5 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => onAction(l._id, 'REJECTED')}
                            className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded transition-colors inline-flex items-center justify-center"
                            title="Reject Leave"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          >
                            <XIcon className="w-5 h-5 text-rose-500" />
                          </button>
                        </>
                      )}
                      {onEdit && canEditItem(l) && (
                        <button
                          onClick={() => onEdit(l)}
                          className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors inline-flex items-center justify-center"
                          title="Edit Leave"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          <EditIcon className="w-5 h-5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(l._id)}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors inline-flex items-center justify-center"
                          title="Delete Leave"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Shifts Tab
// ═══════════════════════════════════════════════════════════════════════════════
const ShiftsTab = ({ shifts, loading, onRefresh, onAdd, onEdit, onDelete }) => (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">Shift Configuration</h2>
      <div className="att-controls">
        {onAdd && (
          <button className="att-btn att-btn-primary" onClick={onAdd}>
            <IcoPlus />
            <span>New Shift</span>
          </button>
        )}
        <button className="att-btn att-btn-secondary" onClick={onRefresh}>
          <IcoRefresh />
          <span>Refresh</span>
        </button>
      </div>
    </div>
    <div className="att-table-wrap">
      {loading ? (
        <div style={{ padding: 24 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="att-skeleton" style={{ height: 48, marginBottom: 8 }} />)}
        </div>
      ) : shifts.length === 0 ? (
        <div className="att-empty">
          <IcoShift />
          <div className="att-empty-title">No shifts configured</div>
          <div className="att-empty-sub">Add at least one shift (e.g. "General" 9:00–18:00)</div>
        </div>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Shift Name</th>
              <th>Start</th>
              <th>End</th>
              <th>Grace (min)</th>
              <th>Break (min)</th>
              <th>Default</th>
              {(onEdit || onDelete) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {shifts.map(s => (
              <tr key={s._id}>
                <td style={{ fontWeight: 700 }}>{s.shiftName}</td>
                <td style={{ fontFamily: 'monospace' }}>{s.startTime}</td>
                <td style={{ fontFamily: 'monospace' }}>{s.endTime}</td>
                <td style={{ textAlign: 'center' }}>{s.graceMinutes}</td>
                <td style={{ textAlign: 'center' }}>{s.breakMinutes}</td>
                <td>{s.isDefault ? <span className="att-badge present">✓ Default</span> : '—'}</td>
                {(onEdit || onDelete) && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div className="flex items-center space-x-1.5">
                      {onEdit && (
                        <button
                          className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors inline-flex items-center justify-center"
                          onClick={() => onEdit(s)}
                          title="Edit Shift"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          <EditIcon className="w-5 h-5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors inline-flex items-center justify-center"
                          onClick={() => onDelete(s._id)}
                          title="Delete Shift"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Raw Punches Tab
// ═══════════════════════════════════════════════════════════════════════════════
const PunchesTab = ({ punches, loading, punchDate, setPunchDate, onRefresh }) => (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">Raw Device Punches</h2>
      <div className="att-controls">
        <div className="att-date-wrap">
          <CustomDatePicker
            value={punchDate}
            onChange={e => setPunchDate(e.target.value)}
            compact={true}
          />
        </div>
        <button className="att-btn att-btn-secondary" onClick={onRefresh}>
          <IcoRefresh />
          <span>Refresh</span>
        </button>
      </div>
    </div>
    <div className="att-table-wrap">
      {loading ? (
        <div style={{ padding: 24 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="att-skeleton" style={{ height: 36, marginBottom: 8 }} />)}
        </div>
      ) : punches.length === 0 ? (
        <div className="att-empty">
          <IcoClock />
          <div className="att-empty-title">No punches for this date</div>
        </div>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Device ID</th>
              <th>Enroll ID</th>
              <th>Type</th>
              <th>Verify</th>
              <th>Linked</th>
              <th>Processed</th>
            </tr>
          </thead>
          <tbody>
            {punches.map(p => (
              <tr key={p._id}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{fmt12(p.punchTime)}</td>
                <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{p.deviceId}</td>
                <td><span className="att-enroll-badge">{p.enrollId}</span></td>
                <td><span className={`att-badge ${p.punchType === 'IN' ? 'present' : p.punchType === 'OUT' ? 'absent' : 'leave'}`}>{p.punchType}</span></td>
                <td style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{p.verifyMode}</td>
                <td>{p.unmatched ? <span className="att-badge absent">⚠ No</span> : <span className="att-badge present">✓ Yes</span>}</td>
                <td>{p.processed ? <span className="att-badge present">✓</span> : <span className="att-badge weekend">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Device / Mapping Tab — Multi-Method Integration Hub
// ═══════════════════════════════════════════════════════════════════════════════
const DeviceTab = ({ mappings, loading, employees, summary, onRefresh, onAdd, onDelete }) => {
  const [activeMethod, setActiveMethod] = useState('lan'); // 'lan' | 'usb' | 'agent' | 'cloud'
  
  // LAN IP Sync state
  const [deviceIp, setDeviceIp] = useState(() => localStorage.getItem('zk_device_ip') || '192.168.1.201');
  const [devicePort, setDevicePort] = useState('4370');
  const [testingIp, setTestingIp] = useState(false);
  const [syncingIp, setSyncingIp] = useState(false);
  const [ipStatus, setIpStatus] = useState(null); // { type: 'success' | 'error' | 'info', message: '' }

  // USB Import state
  const [usbFile, setUsbFile] = useState(null);
  const [uploadingUsb, setUploadingUsb] = useState(false);
  const [usbStatus, setUsbStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Cloud URL
  const serverHost = window.location.hostname;
  const serverPort = window.location.port ? window.location.port : '5000';
  const pushUrl = `${window.location.protocol}//${serverHost}:${serverPort}/api/attendance/device/push`;
  const [copied, setCopied] = useState(false);

  const handleTestIp = async () => {
    setTestingIp(true);
    setIpStatus(null);
    try {
      localStorage.setItem('zk_device_ip', deviceIp);
      const res = await axios.post(`${API_BASE_URL}/api/attendance/device/test-ip`, { ip: deviceIp, port: Number(devicePort) });
      setIpStatus({ type: 'success', message: res.data.message });
    } catch (err) {
      setIpStatus({ type: 'error', message: err.response?.data?.message || err.message || 'Could not connect to device.' });
    } finally {
      setTestingIp(false);
    }
  };

  const handleSyncIp = async () => {
    setSyncingIp(true);
    setIpStatus(null);
    try {
      localStorage.setItem('zk_device_ip', deviceIp);
      const res = await axios.post(`${API_BASE_URL}/api/attendance/device/sync-ip`, { ip: deviceIp, port: Number(devicePort) });
      setIpStatus({ type: 'success', message: res.data.message });
      onRefresh();
    } catch (err) {
      setIpStatus({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to sync from device.' });
    } finally {
      setSyncingIp(false);
    }
  };

  const handleUsbUpload = async () => {
    if (!usbFile) return;
    setUploadingUsb(true);
    setUsbStatus(null);
    try {
      const fd = new FormData();
      fd.append('file', usbFile);
      const res = await axios.post(`${API_BASE_URL}/api/attendance/device/upload-usb`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUsbStatus({ type: 'success', message: res.data.message });
      setUsbFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRefresh();
    } catch (err) {
      setUsbStatus({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to import USB file.' });
    } finally {
      setUploadingUsb(false);
    }
  };

  const copyPushUrl = () => {
    navigator.clipboard.writeText(pushUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAgentScript = () => {
    window.open(`${API_BASE_URL}/api/attendance/device/agent-script`, '_blank');
  };

  return (
    <>
      {/* 4-in-1 Device Integration Hub */}
      <div className="att-device-card">
        <div className="att-device-card-header">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
              🔌 ZKTeco F8 Connection Hub
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              Choose how your ERP synchronizes punch logs with your office access control device.
            </p>
          </div>
          <div className="att-sync-tabs">
            <button
              className={`att-sync-tab-btn ${activeMethod === 'lan' ? 'active' : ''}`}
              onClick={() => setActiveMethod('lan')}
            >
              🌐 Direct LAN IP
            </button>
            <button
              className={`att-sync-tab-btn ${activeMethod === 'usb' ? 'active' : ''}`}
              onClick={() => setActiveMethod('usb')}
            >
              💾 USB Import
            </button>
            <button
              className={`att-sync-tab-btn ${activeMethod === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveMethod('agent')}
            >
              🖥️ Office Sync Agent
            </button>
            <button
              className={`att-sync-tab-btn ${activeMethod === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveMethod('cloud')}
            >
              ☁️ Cloud ADMS Push
            </button>
          </div>
        </div>

        {/* METHOD 1: Direct LAN IP */}
        {activeMethod === 'lan' && (
          <div className="att-sync-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Direct Network Sync (Port 4370)</strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  Connect directly to the F8 on your office local network/Wi-Fi to fetch punches.
                </p>
              </div>
              <span className="att-badge present">Offline & Local Friendly</span>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="att-form-label">Device IP Address</label>
                <input
                  type="text"
                  className="att-input"
                  value={deviceIp}
                  onChange={e => setDeviceIp(e.target.value)}
                  placeholder="e.g. 192.168.1.201"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ width: 100 }}>
                <label className="att-form-label">Port</label>
                <input
                  type="number"
                  className="att-input"
                  value={devicePort}
                  onChange={e => setDevicePort(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button
                  type="button"
                  className="att-btn att-btn-secondary"
                  onClick={handleTestIp}
                  disabled={testingIp || syncingIp}
                >
                  {testingIp ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  className="att-btn att-btn-primary"
                  onClick={handleSyncIp}
                  disabled={syncingIp || testingIp}
                >
                  <IcoRefresh className={syncingIp ? "animate-spin" : ""} />
                  <span>{syncingIp ? 'Fetching Punches...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

            {ipStatus && (
              <div className={`att-alert-box ${ipStatus.type}`}>
                {ipStatus.type === 'success' ? '✓' : '⚠'} {ipStatus.message}
              </div>
            )}
          </div>
        )}

        {/* METHOD 2: USB Log File Import */}
        {activeMethod === 'usb' && (
          <div className="att-sync-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Import from USB Flash Drive</strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  No network required. Export attendance log to USB on the F8, then upload the file here.
                </p>
              </div>
              <span className="att-badge weekend">Zero Network Needed</span>
            </div>

            <div
              className="att-usb-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".dat,.csv,.txt"
                onChange={e => {
                  if (e.target.files?.[0]) setUsbFile(e.target.files[0]);
                }}
              />
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
              {usbFile ? (
                <div>
                  <strong style={{ color: '#2563eb' }}>{usbFile.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {(usbFile.size / 1024).toFixed(1)} KB — Click to change file
                  </div>
                </div>
              ) : (
                <div>
                  <strong style={{ color: '#1e293b' }}>Click to select `1_attlog.dat` or attendance file</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>
                    Supports ZKTeco `.dat` (tab-delimited), `.csv`, and `.txt` files
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                💡 <strong>On Device:</strong> Menu → USB Disk (or Data Mgt) → Download Attendance Data
              </div>
              <button
                type="button"
                className="att-btn att-btn-primary"
                onClick={handleUsbUpload}
                disabled={!usbFile || uploadingUsb}
              >
                <IcoCheck />
                <span>{uploadingUsb ? 'Importing Punches...' : 'Process & Import Punches'}</span>
              </button>
            </div>

            {usbStatus && (
              <div className={`att-alert-box ${usbStatus.type}`}>
                {usbStatus.type === 'success' ? '✓' : '⚠'} {usbStatus.message}
              </div>
            )}
          </div>
        )}

        {/* METHOD 3: Office Sync Agent */}
        {activeMethod === 'agent' && (
          <div className="att-sync-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Office Sync Agent (For Cloud ERP)</strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  If your ERP is hosted on the cloud, run this lightweight agent on any office PC on the same Wi-Fi as the F8.
                </p>
              </div>
              <span className="att-badge leave">Auto Background Sync</span>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                Quick 2-Step Setup:
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.6 }}>
                1. <strong>Download the script:</strong> Click the button below to download <code>zk-sync-agent.js</code>.<br />
                2. <strong>Run on office computer:</strong> Open a terminal in that folder and run:
                <div className="att-code" style={{ margin: '8px 0' }}>
                  npm install node-zklib axios<br />
                  node zk-sync-agent.js
                </div>
                It automatically connects to your F8 device every 60 seconds and forwards all new punches to your cloud ERP!
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="att-btn att-btn-primary"
                onClick={downloadAgentScript}
              >
                💾 Download `zk-sync-agent.js`
              </button>
            </div>
          </div>
        )}

        {/* METHOD 4: Cloud Server ADMS Push */}
        {activeMethod === 'cloud' && (
          <div className="att-sync-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Cloud ADMS / HTTP Push URL</strong>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                  For ZKTeco devices that have the "Cloud Server / ADMS" menu option.
                </p>
              </div>
              <span className="att-badge approved">Direct Device Push</span>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 6 }}>
              On your F8: <strong>Menu → Communication → Cloud Server</strong>. Enter this Server Address:
            </div>
            <div className="att-code" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{pushUrl}</span>
              <button
                type="button"
                onClick={copyPushUrl}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                {copied ? '✓ Copied' : 'Copy URL'}
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Enable ADMS / Push: Yes · Protocol: HTTP · Port: {serverPort}
            </div>
          </div>
        )}

        {summary.unmatchedPunches > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', fontSize: '0.82rem', color: '#b91c1c' }}>
            <IcoWarning />
            <strong>{summary.unmatchedPunches} punches are from unmapped devices/IDs</strong> — Use the table below to link them to employee names.
          </div>
        )}
      </div>

      {/* Mapping Table */}
      <div className="att-panel">
        <div className="att-panel-header">
          <h2 className="att-panel-title">Enroll ID → Employee Mapping</h2>
          <div className="att-controls">
            {onAdd && (
              <button className="att-btn att-btn-primary" onClick={onAdd}>
                <IcoPlus />
                <span>Add Mapping</span>
              </button>
            )}
            <button className="att-btn att-btn-secondary" onClick={onRefresh}>
              <IcoRefresh />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <div className="att-table-wrap">
          {loading ? (
            <div style={{ padding: 24 }}>
              {[...Array(4)].map((_, i) => <div key={i} className="att-skeleton" style={{ height: 44, marginBottom: 8 }} />)}
            </div>
          ) : mappings.length === 0 ? (
            <div className="att-empty">
              <IcoDevice />
              <div className="att-empty-title">No employee mappings yet</div>
              <div className="att-empty-sub">Click "Add Mapping" to link a ZKTech Enroll ID to an ERP employee</div>
            </div>
          ) : (
            <table className="att-table">
              <thead>
                <tr>
                  <th>ZK Enroll ID</th>
                  <th>Employee Name</th>
                  <th>ERP ID</th>
                  <th>Device</th>
                  <th>Notes</th>
                  {onDelete && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m._id}>
                    <td><span className="att-enroll-badge">{m.enrollId}</span></td>
                    <td style={{ fontWeight: 600 }}>{m.employeeName || '—'}</td>
                    <td style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{m.employeeEmpId || '—'}</td>
                    <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{m.deviceId}</td>
                    <td style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{m.notes || '—'}</td>
                    {onDelete && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="flex items-center space-x-1.5">
                          <button
                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors inline-flex items-center justify-center"
                            onClick={() => onDelete(m._id)}
                            title="Remove Mapping"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════════

// Shift Modal
const ShiftModal = ({ mode, data, onSave, onClose }) => {
  const [form, setForm] = useState({
    shiftName: data?.shiftName || '',
    startTime: data?.startTime || '09:00',
    endTime: data?.endTime || '18:00',
    graceMinutes: data?.graceMinutes ?? 15,
    breakMinutes: data?.breakMinutes ?? 60,
    isDefault: data?.isDefault ?? false,
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="att-modal-overlay" onClick={onClose}>
      <div className="att-modal" onClick={e => e.stopPropagation()}>
        <h3 className="att-modal-title">{mode === 'edit' ? 'Edit Shift' : 'Add New Shift'}</h3>
        <div className="att-form-grid">
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Shift Name</label>
            <input className="att-form-input" value={form.shiftName} onChange={e => set('shiftName', e.target.value)} placeholder="e.g. General, Morning" />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Start Time</label>
            <input type="time" className="att-form-input" value={form.startTime} onChange={e => set('startTime', e.target.value)} />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">End Time</label>
            <input type="time" className="att-form-input" value={form.endTime} onChange={e => set('endTime', e.target.value)} />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Grace Period (min)</label>
            <input type="number" className="att-form-input" value={form.graceMinutes} onChange={e => set('graceMinutes', Number(e.target.value))} min={0} />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Break Time (min)</label>
            <input type="number" className="att-form-input" value={form.breakMinutes} onChange={e => set('breakMinutes', Number(e.target.value))} min={0} />
          </div>
          <div className="att-form-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }}>
            <input type="checkbox" id="isDefault" checked={form.isDefault} onChange={e => set('isDefault', e.target.checked)} style={{ width: 16, height: 16 }} />
            <label htmlFor="isDefault" className="att-form-label" style={{ textTransform: 'none', fontSize: '0.84rem', cursor: 'pointer' }}>Set as default shift (applies to all unmapped employees)</label>
          </div>
        </div>
        <div className="att-form-actions">
          <button className="att-btn att-btn-secondary" onClick={onClose}><IcoX />Cancel</button>
          <button className="att-btn att-btn-primary" onClick={() => onSave(form)}><IcoCheck />Save Shift</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Leave Modal
const LeaveModal = ({ mode = 'add', data = null, employees, onSave, onClose, canViewAll, canApproveLeave, canEditLeave, currentUser, myEmployee }) => {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    employeeId: data?.employeeId || ((!canViewAll && myEmployee?._id) ? myEmployee._id : ''),
    employeeName: data?.employeeName || ((!canViewAll && (myEmployee?.name || currentUser?.name)) ? (myEmployee?.name || currentUser?.name) : ''),
    employeeEmpId: data?.employeeEmpId || ((!canViewAll && (myEmployee?.employeeId || currentUser?.employeeId || currentUser?.username)) ? (myEmployee?.employeeId || currentUser?.employeeId || currentUser?.username) : ''),
    leaveType: data?.leaveType || 'ANNUAL',
    fromDate: data?.fromDate ? data.fromDate.split('T')[0] : todayStr(),
    toDate: data?.toDate ? data.toDate.split('T')[0] : todayStr(),
    status: data?.status || 'PENDING',
    reason: data?.reason || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (isEdit && data) {
      setForm({
        employeeId: data.employeeId || '',
        employeeName: data.employeeName || '',
        employeeEmpId: data.employeeEmpId || '',
        leaveType: data.leaveType || 'ANNUAL',
        fromDate: data.fromDate ? data.fromDate.split('T')[0] : todayStr(),
        toDate: data.toDate ? data.toDate.split('T')[0] : todayStr(),
        status: data.status || 'PENDING',
        reason: data.reason || '',
      });
    } else if (!canViewAll && myEmployee) {
      setForm(p => ({
        ...p,
        employeeId: myEmployee._id || '',
        employeeName: myEmployee.name || currentUser?.name || '',
        employeeEmpId: myEmployee.employeeId || currentUser?.employeeId || currentUser?.username || ''
      }));
    }
  }, [isEdit, data, canViewAll, myEmployee, currentUser]);

  const handleEmpChange = (id) => {
    const emp = employees.find(e => e._id === id);
    set('employeeId', id);
    if (emp) { set('employeeName', emp.name || ''); set('employeeEmpId', emp.employeeId || ''); }
  };

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="att-modal-overlay" onClick={onClose}>
      <div className="att-modal" onClick={e => e.stopPropagation()}>
        <h3 className="att-modal-title">{isEdit ? 'Edit Leave Request' : 'New Leave Request'}</h3>
        <div className="att-form-grid">
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Employee</label>
            {canViewAll && (!isEdit || canEditLeave) ? (
              <ERPSelect
                value={form.employeeId}
                onChange={e => handleEmpChange(e.target.value)}
                placeholder="— Select Employee —"
                className="w-full"
                options={employees.map(e => ({ value: e._id, label: `${e.name} (${e.employeeId})` }))}
              />
            ) : (
              <input
                type="text"
                readOnly
                value={`${form.employeeName || currentUser?.name || 'Me'}${form.employeeEmpId ? ` (${form.employeeEmpId})` : ''}`}
                className="att-form-input bg-gray-50 text-gray-700 cursor-not-allowed"
                disabled
              />
            )}
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Leave Type</label>
            <ERPSelect
              value={form.leaveType}
              onChange={e => set('leaveType', e.target.value)}
              className="w-full"
              options={['ANNUAL','SICK','CASUAL','UNPAID','OTHER']}
            />
          </div>
          {isEdit && canApproveLeave && (
            <div className="att-form-field">
              <label className="att-form-label">Status</label>
              <ERPSelect
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full"
                options={[
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
            </div>
          )}
          <div className="att-form-field">
            <label className="att-form-label">From Date</label>
            <CustomDatePicker
              value={form.fromDate}
              onChange={e => set('fromDate', e.target.value)}
              compact={true}
            />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">To Date</label>
            <CustomDatePicker
              value={form.toDate}
              onChange={e => set('toDate', e.target.value)}
              compact={true}
            />
          </div>
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Reason</label>
            <input className="att-form-input" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Optional reason" />
          </div>
        </div>
        <div className="att-form-actions">
          <button className="att-btn att-btn-secondary" onClick={onClose}><IcoX />Cancel</button>
          <button className="att-btn att-btn-primary" disabled={!form.employeeId} onClick={() => onSave(form)}>
            <IcoCheck />{isEdit ? 'Save Changes' : 'Submit Leave'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Mapping Modal
const MappingModal = ({ employees, onSave, onClose }) => {
  const [form, setForm] = useState({ enrollId: '', employeeId: '', deviceId: 'F8-DEFAULT', notes: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleEmpChange = (id) => {
    const emp = employees.find(e => e._id === id);
    set('employeeId', id);
    if (emp) { setForm(p => ({ ...p, employeeId: id, employeeName: emp.name || '', employeeEmpId: emp.employeeId || '' })); }
  };

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="att-modal-overlay" onClick={onClose}>
      <div className="att-modal" onClick={e => e.stopPropagation()}>
        <h3 className="att-modal-title">Link ZKTech Enroll ID → Employee</h3>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: '0.78rem', color: '#0369a1' }}>
          💡 The <strong>Enroll ID</strong> is the number assigned to the employee in the ZKTech device (e.g. 7, 42, 101). Check the device admin panel.
        </div>
        <div className="att-form-grid">
          <div className="att-form-field">
            <label className="att-form-label">ZK Enroll ID (Device Number)</label>
            <input type="number" className="att-form-input" value={form.enrollId} onChange={e => set('enrollId', e.target.value)} placeholder="e.g. 42" min={1} />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Device ID (optional)</label>
            <input className="att-form-input" value={form.deviceId} onChange={e => set('deviceId', e.target.value)} placeholder="F8-DEFAULT" />
          </div>
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">ERP Employee</label>
            <ERPSelect
              value={form.employeeId}
              onChange={e => handleEmpChange(e.target.value)}
              placeholder="— Select Employee —"
              className="w-full"
              options={employees.map(e => ({ value: e._id, label: `${e.name} (${e.employeeId})` }))}
            />
          </div>
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Notes (optional)</label>
            <input className="att-form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this mapping" />
          </div>
        </div>
        <div className="att-form-actions">
          <button className="att-btn att-btn-secondary" onClick={onClose}><IcoX />Cancel</button>
          <button className="att-btn att-btn-primary" disabled={!form.enrollId || !form.employeeId} onClick={() => onSave(form)}><IcoCheck />Save Mapping</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Edit Log Modal (HR Manual Correction)
const EditLogModal = ({ log, onSave, onClose }) => {
  const [form, setForm] = useState({
    status: log.status || 'PRESENT',
    firstPunchIn: log.firstPunchIn ? new Date(log.firstPunchIn).toISOString().slice(0,16) : '',
    lastPunchOut: log.lastPunchOut ? new Date(log.lastPunchOut).toISOString().slice(0,16) : '',
    remarks: log.remarks || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="att-modal-overlay" onClick={onClose}>
      <div className="att-modal" onClick={e => e.stopPropagation()}>
        <h3 className="att-modal-title">Manual Correction — {log.employeeName}</h3>
        <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 16 }}>{log.date}</div>
        <div className="att-form-grid">
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Status</label>
            <ERPSelect
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full"
              options={['PRESENT','ABSENT','LATE','HALF_DAY','LEAVE','HOLIDAY','WEEKEND']}
            />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">First Punch In</label>
            <input type="datetime-local" className="att-form-input" value={form.firstPunchIn} onChange={e => set('firstPunchIn', e.target.value)} />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Last Punch Out</label>
            <input type="datetime-local" className="att-form-input" value={form.lastPunchOut} onChange={e => set('lastPunchOut', e.target.value)} />
          </div>
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Remarks</label>
            <input className="att-form-input" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Reason for correction" />
          </div>
        </div>
        <div className="att-form-actions">
          <button className="att-btn att-btn-secondary" onClick={onClose}><IcoX />Cancel</button>
          <button className="att-btn att-btn-primary" onClick={() => onSave(form)}><IcoCheck />Save Correction</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Attendance;
