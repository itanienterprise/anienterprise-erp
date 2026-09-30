import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import CustomDatePicker from '../../shared/CustomDatePicker';
import { ChevronDownIcon } from '../../Icons';
import './Attendance.css';

// ─── Custom ERP Dropdown Select ──────────────────────────────────────────────
const ERPSelect = ({ value, onChange, options = [], placeholder, className = '', style, disabled = false }) => (
  <div className={`relative inline-flex items-center ${className}`} style={style}>
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="att-select-field"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => {
        if (typeof opt === 'string') {
          return <option key={opt} value={opt}>{opt}</option>;
        }
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
    <div className="att-select-arrow">
      <ChevronDownIcon className="w-4 h-4 text-gray-400" />
    </div>
  </div>
);

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
  const [leaveStatus, setLeaveStatus] = useState('PENDING');
  const [punchDate, setPunchDate] = useState(todayStr());

  // Modals
  const [shiftModal, setShiftModal] = useState(null); // null | {mode:'add'|'edit', data?}
  const [leaveModal, setLeaveModal] = useState(null);
  const [mappingModal, setMappingModal] = useState(null);
  const [editLogModal, setEditLogModal] = useState(null);

  const isAdmin = currentUser?.username === 'admin' || (currentUser?.role || '').toLowerCase() === 'admin';
  const canEdit = isAdmin || hasPermission(currentUser, 'employees', 'edit');

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
    if (logEmpId) params.set('employeeId', logEmpId);
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
    const r = await axios.get(`${API_BASE_URL}/api/attendance/leaves?${params}`);
    setLeaves(r.data || []);
  });

  const fetchPunches = () => load('punches', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/punches?date=${punchDate}&limit=100`);
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

  useEffect(() => { if (activeTab === 'logs')    { fetchLogs();    } }, [activeTab, logDate, logStatus, logEmpId]);
  useEffect(() => { if (activeTab === 'shifts')  { fetchShifts();  } }, [activeTab]);
  useEffect(() => { if (activeTab === 'leaves')  { fetchLeaves();  } }, [activeTab, leaveStatus]);
  useEffect(() => { if (activeTab === 'punches') { fetchPunches(); } }, [activeTab, punchDate]);
  useEffect(() => { if (activeTab === 'device')  { fetchMappings(); fetchEmployees(); } }, [activeTab]);

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

  const handleLeaveCreate = async (data) => {
    try {
      await axios.post(`${API_BASE_URL}/api/attendance/leaves`, data);
      setLeaveModal(null);
      fetchLeaves();
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
    { id: 'logs',      label: 'Attendance Logs', icon: <IcoList /> },
    { id: 'leaves',    label: 'Leaves', icon: <IcoLeave />, badge: leaves.filter(l => l.status === 'PENDING').length },
    { id: 'shifts',    label: 'Shifts', icon: <IcoShift /> },
    { id: 'punches',   label: 'Raw Punches', icon: <IcoClock /> },
    { id: 'device',    label: 'Device / Mapping', icon: <IcoDevice />, badge: summary.unmatchedPunches || 0 },
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
          onAdd={canEdit ? () => setLeaveModal(true) : null}
          canEdit={canEdit}
          employees={employees}
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
          employees={employees}
          onSave={handleLeaveCreate}
          onClose={() => setLeaveModal(null)}
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
const DashboardTab = ({ summary, livePunches, loadingLive, onRefresh, onProcess, processing, canEdit }) => (
  <>
    {/* Warning: unmatched punches */}
    {summary.unmatchedPunches > 0 && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef9c3', border: '1px solid #fde047', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: '0.84rem', color: '#713f12' }}>
        <IcoWarning />
        <strong>{summary.unmatchedPunches} unmatched punch{summary.unmatchedPunches > 1 ? 'es' : ''}</strong> — Employee enrollment not mapped.
        Go to <em>Device / Mapping</em> tab to fix.
      </div>
    )}

    {/* Summary cards */}
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

    {/* Live Punch Feed */}
    <div className="att-panel">
      <div className="att-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="att-live-dot" />
          <h2 className="att-panel-title">Live Punch Feed</h2>
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
const LogsTab = ({ logs, loading, logDate, setLogDate, logStatus, setLogStatus, logEmpId, setLogEmpId, employees, onRefresh, onProcess, processing, canEdit, onEdit }) => (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">Attendance Logs</h2>
      <div className="att-controls">
        <div className="att-date-wrap">
          <CustomDatePicker
            value={logDate}
            onChange={e => setLogDate(e.target.value)}
            compact={true}
          />
        </div>
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
                  <td>
                    <button className="att-btn att-btn-secondary att-btn-sm" onClick={() => onEdit(log)}>
                      <IcoEdit />Edit
                    </button>
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
const LeavesTab = ({ leaves, loading, leaveStatus, setLeaveStatus, onRefresh, onAction, onAdd, canEdit, employees }) => (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">Leave Requests</h2>
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
              {canEdit && <th>Action</th>}
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
                {canEdit && l.status === 'PENDING' && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="att-btn att-btn-success att-btn-sm" onClick={() => onAction(l._id, 'APPROVED')}>
                      <IcoCheck />Approve
                    </button>
                    <button className="att-btn att-btn-danger att-btn-sm" onClick={() => onAction(l._id, 'REJECTED')}>
                      <IcoX />Reject
                    </button>
                  </td>
                )}
                {canEdit && l.status !== 'PENDING' && <td />}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </div>
);

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
                  <td style={{ display: 'flex', gap: 6 }}>
                    {onEdit && <button className="att-btn att-btn-secondary att-btn-sm" onClick={() => onEdit(s)}><IcoEdit />Edit</button>}
                    {onDelete && <button className="att-btn att-btn-danger att-btn-sm" onClick={() => onDelete(s._id)}><IcoTrash /></button>}
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
// Device / Mapping Tab
// ═══════════════════════════════════════════════════════════════════════════════
const DeviceTab = ({ mappings, loading, employees, summary, onRefresh, onAdd, onDelete }) => {
  const serverHost = window.location.hostname;
  const serverPort = '5000';
  const pushUrl = `http://${serverHost}:${serverPort}/api/attendance/device/push`;

  return (
    <>
      {/* Setup Instructions */}
      <div className="att-device-card" style={{ marginBottom: 20 }}>
        <h3>🔧 ZKTech F8 — ADMS Configuration</h3>
        <p>Configure your F8 device to push punches to this server:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>1. On the F8: Menu → Communication → Cloud Server</div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 8 }}>2. Set the Push URL to:</div>
            <div className="att-code">{pushUrl}</div>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            3. Enable ADMS / HTTP Push · Protocol: HTTP · Method: POST
          </div>
        </div>
        {summary.unmatchedPunches > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, background: 'rgba(239,68,68,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem', color: '#fca5a5' }}>
            <IcoWarning />
            <strong>{summary.unmatchedPunches} unmatched punches</strong> — Map the Enroll IDs below
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
                      <td>
                        <button className="att-btn att-btn-danger att-btn-sm" onClick={() => onDelete(m._id)}>
                          <IcoTrash />Remove
                        </button>
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

  return (
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
    </div>
  );
};

// Leave Modal
const LeaveModal = ({ employees, onSave, onClose }) => {
  const [form, setForm] = useState({
    employeeId: '',
    employeeName: '',
    employeeEmpId: '',
    leaveType: 'ANNUAL',
    fromDate: todayStr(),
    toDate: todayStr(),
    reason: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleEmpChange = (id) => {
    const emp = employees.find(e => e._id === id);
    set('employeeId', id);
    if (emp) { set('employeeName', emp.name || ''); set('employeeEmpId', emp.employeeId || ''); }
  };

  return (
    <div className="att-modal-overlay" onClick={onClose}>
      <div className="att-modal" onClick={e => e.stopPropagation()}>
        <h3 className="att-modal-title">New Leave Request</h3>
        <div className="att-form-grid">
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Employee</label>
            <ERPSelect
              value={form.employeeId}
              onChange={e => handleEmpChange(e.target.value)}
              placeholder="— Select Employee —"
              className="w-full"
              options={employees.map(e => ({ value: e._id, label: `${e.name} (${e.employeeId})` }))}
            />
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
          <button className="att-btn att-btn-primary" disabled={!form.employeeId} onClick={() => onSave(form)}><IcoCheck />Submit Leave</button>
        </div>
      </div>
    </div>
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

  return (
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
    </div>
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

  return (
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
    </div>
  );
};

export default Attendance;
