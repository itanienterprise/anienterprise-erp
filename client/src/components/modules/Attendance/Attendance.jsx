import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from '../../../utils/api';
import { API_BASE_URL } from '../../../utils/helpers';
import { hasPermission } from '../../../utils/permissionHelper';
import { getSocket } from '../../../utils/socket';
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
  return d.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true });
};
const fmtDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: 'short', year: 'numeric' });
};
const isTodayDate = (dt) => {
  if (!dt) return false;
  const d = new Date(dt);
  if (isNaN(d)) return false;
  const dhakaFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' });
  return dhakaFormatter.format(d) === dhakaFormatter.format(new Date());
};
const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

const StatusBadge = ({ status, lateMinutes = 0 }) => {
  let lateLabel = '● Late';
  if (lateMinutes > 0) {
    if (lateMinutes >= 60) {
      const h = Math.floor(lateMinutes / 60);
      const m = lateMinutes % 60;
      lateLabel = `● Late (${h}h${m > 0 ? ` ${m}m` : ''})`;
    } else {
      lateLabel = `● Late (${lateMinutes}m)`;
    }
  }
  const map = {
    PRESENT: ['present', '● Present'],
    ABSENT:  ['absent',  '● Absent'],
    LATE:    ['late',    lateLabel],
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

const PunchTypeBadge = ({ type }) => {
  const norm = String(type || '').toUpperCase().trim();
  if (norm === 'IN') {
    return <span className="att-badge punch-in">● IN</span>;
  }
  if (norm === 'OUT') {
    return <span className="att-badge punch-out">● OUT</span>;
  }
  if (norm.includes('BREAK')) {
    return <span className="att-badge punch-break">☕ {norm.replace('_', ' ')}</span>;
  }
  if (norm.includes('OT')) {
    return <span className="att-badge punch-ot">⏱ {norm.replace('_', ' ')}</span>;
  }
  return <span className="att-badge punch-unknown">● {norm || 'UNKNOWN'}</span>;
};

const VerifyModeBadge = ({ mode }) => {
  const m = String(mode || '').toUpperCase().trim();
  if (m.includes('CARD') || m === '4') {
    return <span className="att-verify-badge card">💳 RFID Card</span>;
  }
  if (m.includes('FINGER') || m === '1') {
    return <span className="att-verify-badge fingerprint">👆 Fingerprint</span>;
  }
  if (m.includes('PASS') || m.includes('PIN') || m === '0') {
    return <span className="att-verify-badge password">🔑 Password</span>;
  }
  if (m.includes('FACE') || m === '15') {
    return <span className="att-verify-badge face">👤 Face ID</span>;
  }
  return <span className="att-verify-badge default">👆 Biometric</span>;
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
  const [logFromDate, setLogFromDate] = useState(todayStr());
  const [logToDate, setLogToDate] = useState(todayStr());
  const [logEmpId, setLogEmpId] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [leaveStatus, setLeaveStatus] = useState('');
  const [punchDate, setPunchDate] = useState(todayStr());
  const [punchUnmatchedOnly, setPunchUnmatchedOnly] = useState(false);
  const [unmappedEnrolls, setUnmappedEnrolls] = useState([]);

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
  const canDeleteLeave = isAdmin || hasPermission(currentUser, 'attendance', 'deleteLeave');
  const canEditLog = isAdmin || hasPermission(currentUser, 'attendance', 'editLog');
  const canProcessAttendance = isAdmin || hasPermission(currentUser, 'attendance', 'special') || canEdit;

  const canAddShift = isAdmin || hasPermission(currentUser, 'attendance', 'addShift');
  const canEditShift = isAdmin || hasPermission(currentUser, 'attendance', 'editShift');
  const canDeleteShift = isAdmin || hasPermission(currentUser, 'attendance', 'deleteShift');

  const canAddMapping = isAdmin || hasPermission(currentUser, 'attendance', 'addMapping');
  const canEditMapping = isAdmin || hasPermission(currentUser, 'attendance', 'editMapping');
  const canDeleteMapping = isAdmin || hasPermission(currentUser, 'attendance', 'deleteMapping');
  const canAccessDeviceTab = isAdmin || (currentUser?.role || '').toLowerCase() === 'incharge' || hasPermission(currentUser, 'attendance', 'deviceMapping');

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
  const load = useCallback(async (key, fn, silent = false) => {
    if (!silent) setLoading(p => ({ ...p, [key]: true }));
    try { await fn(); } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(p => ({ ...p, [key]: false })); }
  }, []);

  const fetchSummary = (silent = false) => load('summary', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/summary/today`);
    const data = r.data || {};
    const presentVal = Math.max(Number(data.present) || 0, (Number(data.late) || 0) + (Number(data.halfDay) || 0));
    setSummary({
      ...data,
      present: presentVal
    });
  }, silent);

  const fetchLive = (silent = false) => load('live', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/live`);
    setLivePunches(r.data || []);
  }, silent);

  const fetchLogs = (silent = false) => load('logs', async () => {
    const params = new URLSearchParams();
    if (logFromDate) params.set('fromDate', logFromDate);
    if (logToDate) params.set('toDate', logToDate);
    if (!canViewAll) {
      if (myEmployee?._id) params.set('employeeId', myEmployee._id);
    } else {
      if (logEmpId) params.set('employeeId', logEmpId);
    }
    if (logStatus) params.set('status', logStatus);
    const r = await axios.get(`${API_BASE_URL}/api/attendance/logs?${params}`);
    setLogs(r.data || []);
  }, silent);

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

  const fetchPunches = (silent = false) => load('punches', async () => {
    const params = new URLSearchParams();
    if (punchDate && punchDate.trim()) params.set('date', punchDate.trim());
    if (punchUnmatchedOnly) params.set('unmatched', 'true');
    params.set('limit', '200');
    if (!canViewAll && myEmployee?._id) {
      params.set('employeeId', myEmployee._id);
    }
    const r = await axios.get(`${API_BASE_URL}/api/attendance/punches?${params}`);
    setPunches(r.data || []);
  }, silent);

  const fetchMappings = () => load('mappings', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/attendance/mappings`);
    setMappings(r.data || []);
  });

  const fetchUnmappedEnrolls = (silent = false) => load('unmapped', async () => {
    try {
      const r = await axios.get(`${API_BASE_URL}/api/attendance/unmapped-enrolls`);
      setUnmappedEnrolls(r.data || []);
    } catch (e) {
      console.warn('Could not fetch unmapped enrolls:', e);
    }
  }, silent);

  const fetchEmployees = () => load('employees', async () => {
    const r = await axios.get(`${API_BASE_URL}/api/employees`);
    setEmployees(r.data || []);
  });

  // Live ZKTeco Device state
  const [deviceLiveStatus, setDeviceLiveStatus] = useState({ connected: false, status: 'disconnected' });
  const [connectingLive, setConnectingLive] = useState(false);
  const [livePunchToast, setLivePunchToast] = useState(null);

  const fetchDeviceLiveStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/attendance/device/live-status`);
      setDeviceLiveStatus(res.data || { connected: false, status: 'disconnected' });
    } catch (_) {}
  };

  const handleConnectLive = async (ip, port = 4370) => {
    setConnectingLive(true);
    try {
      const cleanIp = ip || '192.168.0.74';
      const cleanPort = Number(port) || 4370;
      const res = await axios.post(`${API_BASE_URL}/api/attendance/device/connect`, { ip: cleanIp, port: cleanPort });
      setDeviceLiveStatus(res.data.status || { connected: true, status: 'connected', ip: cleanIp, port: cleanPort });
      localStorage.setItem('zk_device_ip', cleanIp);
      localStorage.setItem('zk_auto_connect', 'true');
      fetchLive();
      fetchSummary();
      return res.data;
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to connect to device');
      throw err;
    } finally {
      setConnectingLive(false);
    }
  };

  const handleDisconnectLive = async () => {
    setConnectingLive(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/attendance/device/disconnect`);
      setDeviceLiveStatus(res.data.status || { connected: false, status: 'disconnected' });
      localStorage.removeItem('zk_auto_connect');
      return res.data;
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to disconnect from device');
      throw err;
    } finally {
      setConnectingLive(false);
    }
  };

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSummary();
    fetchLive();
    fetchEmployees();
    fetchShifts();
    fetchMappings();
    fetchUnmappedEnrolls();
    fetchDeviceLiveStatus();

    const autoConn = localStorage.getItem('zk_auto_connect');
    const savedIp = localStorage.getItem('zk_device_ip') || '192.168.0.74';
    if (autoConn === 'true' && savedIp && canEdit) {
      handleConnectLive(savedIp, 4370).catch(() => {});
    }

    // Auto-refresh live feed and summary silently every 4 seconds
    const iv = setInterval(() => { fetchSummary(true); fetchLive(true); }, 4000);
    return () => clearInterval(iv);
  }, [canEdit]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    const handleRealtimeUpdate = (data) => {
      const mod = (data?.module || '').toLowerCase().trim();
      if (!mod || ['attendance', 'attendances', 'all'].includes(mod)) {
        fetchSummary(true);
        fetchLive(true);
        if (activeTab === 'logs') fetchLogs(true);
        if (activeTab === 'punches') fetchPunches(true);
        if (activeTab === 'device') fetchUnmappedEnrolls(true);
      }
    };

    const handleDeviceStatus = (st) => {
      if (st) setDeviceLiveStatus(st);
    };

    const handleLivePunch = (p) => {
      fetchSummary(true);
      fetchLive(true);
      if (activeTab === 'logs') fetchLogs(true);
      if (activeTab === 'punches') fetchPunches(true);
      if (p && p.message) {
        setLivePunchToast({
          message: p.message,
          employeeName: p.employeeName,
          punchTime: p.punchTime || new Date(),
          id: Date.now()
        });
        setTimeout(() => setLivePunchToast(null), 6000);
      }
    };

    if (socket) {
      socket.on('data_updated', handleRealtimeUpdate);
      socket.on('zk_device_status', handleDeviceStatus);
      socket.on('zk_live_punch', handleLivePunch);
    }
    const onCustomEvent = (e) => handleRealtimeUpdate(e?.detail);
    window.addEventListener('erp_data_updated', onCustomEvent);

    return () => {
      if (socket) {
        socket.off('data_updated', handleRealtimeUpdate);
        socket.off('zk_device_status', handleDeviceStatus);
        socket.off('zk_live_punch', handleLivePunch);
      }
      window.removeEventListener('erp_data_updated', onCustomEvent);
    };
  }, [activeTab, logFromDate, logToDate, logStatus, logEmpId]);

  useEffect(() => { if (activeTab === 'logs')    { fetchLogs();    } }, [activeTab, logFromDate, logToDate, logStatus, logEmpId, canViewAll, myEmployee]);
  useEffect(() => { if (activeTab === 'shifts' && canViewAll)  { fetchShifts();  } }, [activeTab, canViewAll]);
  useEffect(() => { if (activeTab === 'leaves')  { fetchLeaves();  } }, [activeTab, leaveStatus, canViewAll, myEmployee]);
  useEffect(() => { if (activeTab === 'punches' && canViewAll) { fetchPunches(); fetchMappings(); } }, [activeTab, punchDate, punchUnmatchedOnly, canViewAll, myEmployee]);
  useEffect(() => { if (activeTab === 'device' && canAccessDeviceTab)  { fetchMappings(); fetchEmployees(); fetchUnmappedEnrolls(); fetchShifts(); } }, [activeTab, canAccessDeviceTab]);

  useEffect(() => {
    if (!canViewAll && (activeTab === 'shifts' || activeTab === 'punches')) {
      setActiveTab('dashboard');
    }
    if (!canAccessDeviceTab && activeTab === 'device') {
      setActiveTab('dashboard');
    }
  }, [canViewAll, canAccessDeviceTab, activeTab]);

  // ── Process attendance ─────────────────────────────────────────────────────
  const [syncingDevice, setSyncingDevice] = useState(false);
  const handleQuickSyncDevice = async () => {
    setSyncingDevice(true);
    try {
      const ip = localStorage.getItem('zk_device_ip') || '192.168.0.74';
      const port = Number(localStorage.getItem('zk_device_port') || 4370);
      const res = await axios.post(`${API_BASE_URL}/api/attendance/device/sync-ip`, { ip, port });
      alert(res.data.message || 'Device synchronized successfully');
      fetchSummary();
      fetchLive();
      if (activeTab === 'logs') fetchLogs();
      if (activeTab === 'punches') fetchPunches();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to sync from device');
    } finally {
      setSyncingDevice(false);
    }
  };

  const handleProcess = async (date) => {
    setProcessing(true);
    try {
      const targetDate = date || logToDate || logFromDate || todayStr();
      const r = await axios.post(`${API_BASE_URL}/api/attendance/process`, { date: targetDate });
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
      fetchSummary();
      fetchUnmappedEnrolls();
      if (activeTab === 'punches') fetchPunches();
    } catch (e) { alert(e.response?.data?.message || e.message); }
  };

  const handleMappingDelete = async (id) => {
    if (!window.confirm('Remove this mapping?')) return;
    await axios.delete(`${API_BASE_URL}/api/attendance/mappings/${id}`);
    fetchMappings();
    fetchSummary();
    fetchUnmappedEnrolls();
    if (activeTab === 'punches') fetchPunches();
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
    ] : []),
    ...(canAccessDeviceTab ? [
      { id: 'device',    label: 'Device / Mapping', icon: <IcoDevice />, badge: summary.unmatchedPunches || 0 },
    ] : [])
  ];

  return (
    <div className="attendance-module">
      {/* Header */}
      <div className="att-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="att-header-title">
            <span style={{ marginRight: 8 }}>👆</span>Attendance Management
          </h1>
          <p className="att-header-sub">ZKTech F8 Biometric Integration · Real-time Tracking</p>
        </div>
        {canAccessDeviceTab && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {deviceLiveStatus?.connected ? (
              <div
                onClick={() => setActiveTab('device')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                title="Device is live connected. Auto-receiving punches in real time. Click to manage."
              >
                <span className="att-live-dot" style={{ width: 8, height: 8 }} />
                <span>F8 Live: Connected ({deviceLiveStatus.ip})</span>
              </div>
            ) : (
              <div
                onClick={() => setActiveTab('device')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
                title="Device is offline. Click to connect."
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
                <span>F8 Device: Disconnected</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Punch Toast Notification */}
      {livePunchToast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: '#065f46',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: 12,
          boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          animation: 'fadeIn 0.25s ease-out',
          border: '1px solid #34d399'
        }}>
          <span style={{ fontSize: '1.4rem' }}>⚡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.01em' }}>Live Punch Detected</div>
            <div style={{ fontSize: '0.8rem', color: '#a7f3d0', marginTop: 2 }}>{livePunchToast.message}</div>
          </div>
          <button
            onClick={() => setLivePunchToast(null)}
            style={{ background: 'transparent', border: 'none', color: '#a7f3d0', cursor: 'pointer', marginLeft: 12, fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

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
          mappings={mappings}
          loadingLive={loading.live}
          onRefresh={() => { fetchSummary(); fetchLive(); }}
          onProcess={() => handleProcess(todayStr())}
          onQuickSync={handleQuickSyncDevice}
          syncingDevice={syncingDevice}
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
          logFromDate={logFromDate} setLogFromDate={setLogFromDate}
          logToDate={logToDate} setLogToDate={setLogToDate}
          logStatus={logStatus} setLogStatus={setLogStatus}
          logEmpId={logEmpId} setLogEmpId={setLogEmpId}
          employees={employees}
          onRefresh={fetchLogs}
          onProcess={handleProcess}
          processing={processing}
          canEdit={canEditLog}
          canProcess={canProcessAttendance}
          canViewAll={canViewAll}
          onEdit={canEditLog ? (log) => setEditLogModal(log) : null}
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
          onDelete={canDeleteLeave ? handleLeaveDelete : null}
          canEdit={canEdit}
          canDelete={canDeleteLeave}
          canApproveLeave={canApproveLeave}
          canEditLeave={canEditLeave}
          canDeleteLeave={canDeleteLeave}
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
          onAdd={canAddShift ? () => setShiftModal({ mode: 'add' }) : null}
          onEdit={canEditShift ? (s) => setShiftModal({ mode: 'edit', data: s }) : null}
          onDelete={canDeleteShift ? handleShiftDelete : null}
        />
      )}

      {/* ── Raw Punches ──────────────────────────────────────────────────────── */}
      {activeTab === 'punches' && (
        <PunchesTab
          punches={punches}
          loading={loading.punches}
          punchDate={punchDate}
          setPunchDate={setPunchDate}
          punchUnmatchedOnly={punchUnmatchedOnly}
          setPunchUnmatchedOnly={setPunchUnmatchedOnly}
          onRefresh={() => { fetchPunches(); fetchMappings(); }}
          onAddMapping={canAddMapping ? (enrollId) => setMappingModal({ enrollId: String(enrollId) }) : null}
          mappings={mappings}
        />
      )}

      {/* ── Device / Mapping ────────────────────────────────────────────────── */}
      {activeTab === 'device' && canAccessDeviceTab && (
        <DeviceTab
          mappings={mappings}
          loading={loading.mappings}
          employees={employees}
          shifts={shifts}
          summary={summary}
          unmappedEnrolls={unmappedEnrolls}
          deviceLiveStatus={deviceLiveStatus}
          onConnectLive={handleConnectLive}
          onDisconnectLive={handleDisconnectLive}
          connectingLive={connectingLive}
          onRefresh={() => { fetchMappings(); fetchUnmappedEnrolls(); fetchShifts(); }}
          onAdd={canAddMapping ? (init) => setMappingModal(typeof init === 'object' && init !== null ? init : true) : null}
          onEdit={canEditMapping ? (mapping) => setMappingModal(mapping) : null}
          onDelete={canDeleteMapping ? handleMappingDelete : null}
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
          shifts={shifts}
          initialData={typeof mappingModal === 'object' ? mappingModal : null}
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
const DashboardTab = ({ summary, livePunches, mappings = [], loadingLive, onRefresh, onProcess, onQuickSync, syncingDevice, processing, canEdit, canViewAll }) => {
  const mappingMap = useMemo(() => {
    const map = new Map();
    (mappings || []).forEach(m => map.set(Number(m.enrollId), m));
    return map;
  }, [mappings]);

  return (
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
          <div className="att-card-value">{Math.max(Number(summary.present) || 0, (Number(summary.late) || 0) + (Number(summary.halfDay) || 0))}</div>
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canEdit && (
            <button
              className="att-btn att-btn-secondary att-btn-sm"
              onClick={onQuickSync}
              disabled={syncingDevice}
              title="Sync latest punches directly from ZKTeco device (LAN IP)"
            >
              <IcoDevice />
              {syncingDevice ? 'Syncing Device…' : 'Sync Device'}
            </button>
          )}
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
        {loadingLive && livePunches.length === 0 ? (
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
                <th>Time & Date</th>
                <th>Enroll ID</th>
                <th>ERP ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Verify</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {livePunches.map(p => {
                const today = isTodayDate(p.punchTime);
                const mapping = mappingMap.get(Number(p.enrollId));
                const erpId = p.employeeEmpId || mapping?.employeeEmpId || '';
                const empName = p.employeeName || mapping?.employeeName || '';
                return (
                  <tr key={p._id}>
                    <td style={{ fontFamily: 'monospace' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                        {fmt12(p.punchTime)}
                      </div>
                      <div style={{ fontSize: '0.72rem', marginTop: 2, fontWeight: today ? 600 : 400, color: today ? '#059669' : '#64748b' }}>
                        {today ? '● Today' : fmtDate(p.punchTime)}
                      </div>
                    </td>
                    <td><span className="att-enroll-badge">{p.enrollId}</span></td>
                    <td>
                      {erpId ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: 6, fontSize: '0.82rem', border: '1px solid #dbeafe' }}>
                          {erpId}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      {empName ? (
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                          {empName}
                        </div>
                      ) : p.unmatched ? (
                        <span style={{ color: '#dc2626', fontSize: '0.78rem', fontStyle: 'italic' }}>
                          Unmapped Card
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td><PunchTypeBadge type={p.punchType} /></td>
                    <td><VerifyModeBadge mode={p.verifyMode} /></td>
                    <td>
                      {p.unmatched
                        ? <span className="att-badge absent">⚠ Unmatched</span>
                        : <span className="att-badge present">✓ Linked</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Logs Tab
// ═══════════════════════════════════════════════════════════════════════════════
const LogsTab = ({ logs, loading, logFromDate, setLogFromDate, logToDate, setLogToDate, logStatus, setLogStatus, logEmpId, setLogEmpId, employees, onRefresh, onProcess, processing, canEdit, canProcess, canViewAll, onEdit }) => (
  <div className="att-panel">
    <div className="att-panel-header">
      <h2 className="att-panel-title">{canViewAll ? 'Attendance Logs' : 'My Attendance Logs'}</h2>
      <div className="att-controls">
        <button
          type="button"
          className={`att-btn ${logFromDate === todayStr() && logToDate === todayStr() ? 'att-btn-primary' : 'att-btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.8rem', height: 40, borderRadius: 12 }}
          onClick={() => {
            setLogFromDate(todayStr());
            setLogToDate(todayStr());
          }}
        >
          Today
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <div className="att-date-wrap" title="From Date">
            <CustomDatePicker
              placeholder="From Date"
              value={logFromDate}
              onChange={e => setLogFromDate(e.target.value)}
              compact={true}
            />
          </div>
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>to</span>
          <div className="att-date-wrap" title="To Date">
            <CustomDatePicker
              placeholder="To Date"
              value={logToDate}
              onChange={e => setLogToDate(e.target.value)}
              compact={true}
              rightAlign={true}
            />
          </div>
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
        {(canProcess ?? canEdit) && (
          <button className="att-btn att-btn-primary" onClick={() => onProcess(logToDate || logFromDate || todayStr())} disabled={processing}>
            <IcoRefresh />
            <span>{processing ? 'Processing…' : 'Process Date'}</span>
          </button>
        )}
        <button className="att-btn att-btn-secondary" onClick={onRefresh}>
          <IcoRefresh />
          <span>Refresh</span>
        </button>
      </div>
    </div>
    <div className="att-table-wrap">
      {loading && logs.length === 0 ? (
        <div style={{ padding: 24 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="att-skeleton" style={{ height: 40, marginBottom: 8 }} />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="att-empty">
          <IcoList />
          <div className="att-empty-title">
            {logFromDate && logToDate && logFromDate !== logToDate
              ? `No records between ${fmtDate(logFromDate)} and ${fmtDate(logToDate)}`
              : (logFromDate || logToDate)
                ? `No records for date: ${fmtDate(logFromDate || logToDate)}`
                : 'No records found'}
          </div>
          <div className="att-empty-sub">Click "Process Date" to compute attendance from device punches</div>
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
              <th>Shift</th>
              {onEdit && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const displayShift = log.shiftName
                ? (/shift/i.test(log.shiftName) ? log.shiftName : `${log.shiftName} Shift`)
                : '';

              return (
                <tr key={log._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.employeeName || '—'}</div>
                    {logFromDate !== logToDate && log.date && (
                      <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: 2, fontWeight: 500, fontFamily: 'monospace' }}>
                        📅 {fmtDate(log.date)}
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{log.employeeEmpId || '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{fmt12(log.firstPunchIn)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{fmt12(log.lastPunchOut)}</td>
                  <td style={{ fontWeight: 600 }}>{log.totalHours ? `${log.totalHours}h` : (log.status === 'PRESENT' || log.status === 'LATE' ? '0h' : '—')}</td>
                  <td>
                    {log.overtimeHours > 0 ? (
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                        +{log.overtimeHours}h
                      </span>
                    ) : (log.firstPunchIn || log.status === 'PRESENT' || log.status === 'LATE') ? (
                      <span className="text-gray-400 font-mono text-xs">0h</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={log.status} lateMinutes={log.lateMinutes} />
                    {log.manualOverride && <span title={`Corrected by ${log.overriddenBy}`} style={{ marginLeft: 4, fontSize: '0.68rem', color: '#6366f1' }}>✎</span>}
                  </td>
                  <td>
                    {displayShift ? (
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.75rem',
                        color: '#047857',
                        backgroundColor: '#f0fdf4',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 500,
                        border: '1px solid #bbf7d0',
                        whiteSpace: 'nowrap'
                      }}>
                        {displayShift}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
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
            );
          })}
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
  canDeleteLeave,
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
              {(canApproveLeave || canEditLeave || canDeleteLeave || canDelete || leaves.some(l => canEditItem(l))) && <th style={{ textAlign: 'center' }}>Action</th>}
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
                {(canApproveLeave || canEditLeave || canDeleteLeave || canDelete || canEditItem(l)) && (
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
              <th>Holiday</th>
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
                <td style={{ fontFamily: 'monospace' }}>{s.graceMinutes}</td>
                <td style={{ fontFamily: 'monospace' }}>{s.breakMinutes}</td>
                <td>
                  {Array.isArray(s.holidays) && s.holidays.length > 0 ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {s.holidays.map(d => (
                        <span key={d} className="att-badge holiday">{d}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>—</span>
                  )}
                </td>
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

// Raw Punches Tab
// ═══════════════════════════════════════════════════════════════════════════════
const PunchesTab = ({
  punches,
  loading,
  punchDate,
  setPunchDate,
  punchUnmatchedOnly,
  setPunchUnmatchedOnly,
  onRefresh,
  onAddMapping,
  mappings = []
}) => {
  const mappingMap = useMemo(() => {
    const map = new Map();
    (mappings || []).forEach(m => {
      if (m.enrollId != null) {
        map.set(Number(m.enrollId), m);
      }
    });
    return map;
  }, [mappings]);

  return (
    <div className="att-panel">
      <div className="att-panel-header">
        <h2 className="att-panel-title">Raw Device Punches</h2>
        <div className="att-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`att-btn ${!punchDate ? 'att-btn-primary' : 'att-btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => setPunchDate('')}
          >
            All Dates
          </button>
          <button
            type="button"
            className={`att-btn ${punchDate === todayStr() ? 'att-btn-primary' : 'att-btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => setPunchDate(todayStr())}
          >
            Today
          </button>
          <div className="att-date-wrap">
            <CustomDatePicker
              value={punchDate}
              onChange={e => setPunchDate(e.target.value)}
              compact={true}
            />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, color: punchUnmatchedOnly ? '#dc2626' : '#64748b' }}>
            <input
              type="checkbox"
              checked={punchUnmatchedOnly}
              onChange={e => setPunchUnmatchedOnly(e.target.checked)}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            <span>Unmapped Only</span>
          </label>
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
            <div className="att-empty-title">{punchDate ? `No punches for date: ${punchDate}` : 'No punches found'}</div>
            {punchDate && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="att-btn att-btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setPunchDate('')}
                >
                  View Punches for All Dates
                </button>
              </div>
            )}
          </div>
        ) : (
          <table className="att-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Device ID</th>
                <th>Enroll ID</th>
                <th>ERP ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Verify</th>
                <th>Linked</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {punches.map(p => {
                const mapping = mappingMap.get(Number(p.enrollId));
                const erpId = p.employeeEmpId || mapping?.employeeEmpId || '';
                const empName = p.employeeName || mapping?.employeeName || '';
                return (
                  <tr key={p._id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {new Date(p.punchTime).toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka' })} {fmt12(p.punchTime)}
                    </td>
                    <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{p.deviceId}</td>
                    <td><span className="att-enroll-badge">{p.enrollId}</span></td>
                    <td>
                      {erpId ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: 6, fontSize: '0.82rem', border: '1px solid #dbeafe' }}>
                          {erpId}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      {empName ? (
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>
                          {empName}
                        </div>
                      ) : p.unmatched ? (
                        <span style={{ color: '#dc2626', fontSize: '0.78rem', fontStyle: 'italic' }}>
                          Unmapped Card
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td><PunchTypeBadge type={p.punchType} /></td>
                    <td><VerifyModeBadge mode={p.verifyMode} /></td>
                    <td>{p.unmatched ? <span className="att-badge absent">⚠ Unmapped</span> : <span className="att-badge present">✓ Linked</span>}</td>
                    <td>
                      {p.unmatched && onAddMapping ? (
                        <button
                          className="att-btn att-btn-primary"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                          onClick={() => onAddMapping(p.enrollId)}
                        >
                          + Link ID {p.enrollId}
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Device / Mapping Tab — Multi-Method Integration Hub
// ═══════════════════════════════════════════════════════════════════════════════
const DeviceTab = ({
  mappings,
  loading,
  employees,
  shifts = [],
  summary,
  unmappedEnrolls = [],
  deviceLiveStatus,
  onConnectLive,
  onDisconnectLive,
  connectingLive,
  onRefresh,
  onAdd,
  onEdit,
  onDelete
}) => {
  const [activeMethod, setActiveMethod] = useState('lan'); // 'lan' | 'usb' | 'agent' | 'cloud'
  
  // LAN IP Sync state
  const [deviceIp, setDeviceIp] = useState(() => localStorage.getItem('zk_device_ip') || '192.168.0.74');
  const [devicePort, setDevicePort] = useState(() => localStorage.getItem('zk_device_port') || '4370');
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
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="att-btn att-btn-secondary"
                  onClick={handleTestIp}
                  disabled={testingIp || syncingIp || connectingLive}
                >
                  {testingIp ? 'Testing...' : 'Test Connection'}
                </button>

                {deviceLiveStatus?.connected ? (
                  <button
                    type="button"
                    className="att-btn"
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: '1px solid #dc2626',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 600,
                      boxShadow: '0 1px 3px rgba(239, 68, 68, 0.25)'
                    }}
                    onClick={onDisconnectLive}
                    disabled={connectingLive}
                    title="Disconnect from device"
                  >
                    <span style={{ fontSize: '0.85rem' }}>⏹</span>
                    <span>{connectingLive ? 'Disconnecting...' : 'Disconnect'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="att-btn"
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: '1px solid #059669',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 600,
                      boxShadow: '0 1px 3px rgba(16, 185, 129, 0.25)'
                    }}
                    onClick={() => {
                      localStorage.setItem('zk_device_ip', deviceIp);
                      localStorage.setItem('zk_device_port', devicePort);
                      onConnectLive(deviceIp, devicePort);
                    }}
                    disabled={connectingLive || testingIp || syncingIp}
                    title="Connect and stay connected to automatically receive new punches"
                  >
                    <span style={{ fontSize: '0.85rem' }}>⚡</span>
                    <span>{connectingLive ? 'Connecting...' : 'Connect (Stay Online)'}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="att-btn att-btn-primary"
                  onClick={handleSyncIp}
                  disabled={syncingIp || testingIp || connectingLive}
                  title="Manual on-demand sync of all punches"
                >
                  <IcoRefresh className={syncingIp ? "animate-spin" : ""} />
                  <span>{syncingIp ? 'Fetching Punches...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

            {deviceLiveStatus?.connected && (
              <div style={{
                marginTop: 14,
                padding: '12px 16px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="att-live-dot" style={{ width: 10, height: 10, background: '#16a34a', boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: '#14532d', fontSize: '0.88rem' }}>
                      Device Live Connected: {deviceLiveStatus.ip}:{deviceLiveStatus.port}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#166534', marginTop: 2 }}>
                      Auto-receiving real-time biometric punches & auto-syncing every 10s · Session punches captured: <strong>{deviceLiveStatus.totalPunchesSession || 0}</strong>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', fontFamily: 'monospace' }}>
                    Connected at: {deviceLiveStatus.connectedAt ? new Date(deviceLiveStatus.connectedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }) : '—'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: 2 }}>
                    Last Sync: {deviceLiveStatus.lastSyncAt ? new Date(deviceLiveStatus.lastSyncAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }) : 'Just now'}
                  </div>
                </div>
              </div>
            )}

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

        {unmappedEnrolls && unmappedEnrolls.length > 0 && (
          <div style={{ marginTop: 16, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔍 Detected Unmapped Enroll IDs on Device ({unmappedEnrolls.length})</span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#c2410c' }}>
                Click "+ Link to Employee" on any ID to map all its historical punches immediately
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
              {unmappedEnrolls.map(item => (
                <div
                  key={item.enrollId}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #ffedd5',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="att-enroll-badge" style={{ fontSize: '0.82rem', padding: '3px 8px' }}>
                        ID #{item.enrollId}
                      </span>
                      <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>
                        {item.punchCount?.toLocaleString()} {item.punchCount === 1 ? 'punch' : 'punches'}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                      Last punch: {item.lastPunch ? new Date(item.lastPunch).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                  {onAdd && (
                    <button
                      type="button"
                      className="att-btn att-btn-primary"
                      style={{ fontSize: '0.74rem', padding: '5px 10px', height: 'auto', whiteSpace: 'nowrap' }}
                      onClick={() => onAdd({ enrollId: String(item.enrollId), deviceId: item.deviceId || 'F8-DEFAULT' })}
                    >
                      + Link to Employee
                    </button>
                  )}
                </div>
              ))}
            </div>
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
                  <th>Shift</th>
                  <th>Device</th>
                  <th>Notes</th>
                  {(onEdit || onDelete) && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {mappings.map(m => (
                  <tr key={m._id}>
                    <td><span className="att-enroll-badge">{m.enrollId}</span></td>
                    <td style={{ fontWeight: 600 }}>{m.employeeName || '—'}</td>
                    <td style={{ fontFamily: 'monospace', color: '#3b82f6' }}>
                      {m.employeeEmpId || (!m.employeeId ? (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-sans font-medium">
                          Card / Custom
                        </span>
                      ) : '—')}
                    </td>
                    <td>
                      {m.shiftName ? (
                        <span className="att-badge present" style={{ fontSize: '0.74rem' }}>{m.shiftName}</span>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Default</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{m.deviceId}</td>
                    <td style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{m.notes || '—'}</td>
                    {(onEdit || onDelete) && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div className="flex items-center space-x-1.5">
                          {onEdit && (
                            <button
                              className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors inline-flex items-center justify-center cursor-pointer"
                              onClick={() => onEdit(m)}
                              title="Edit Mapping"
                              style={{ border: 'none', background: 'transparent' }}
                            >
                              <EditIcon className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors inline-flex items-center justify-center cursor-pointer"
                              onClick={() => onDelete(m._id)}
                              title="Remove Mapping"
                              style={{ border: 'none', background: 'transparent' }}
                            >
                              <TrashIcon className="w-4 h-4" />
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
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════════

// Shift Modal
const DAYS_OF_WEEK = ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const ShiftModal = ({ mode, data, onSave, onClose }) => {
  const initialHolidays = Array.isArray(data?.holidays)
    ? data.holidays
    : (typeof data?.holidays === 'string' && data.holidays ? [data.holidays] : ['Friday']);

  const [form, setForm] = useState({
    shiftName: data?.shiftName || '',
    startTime: data?.startTime || '09:00',
    endTime: data?.endTime || '18:00',
    graceMinutes: data?.graceMinutes ?? 15,
    breakMinutes: data?.breakMinutes ?? 60,
    isDefault: data?.isDefault ?? false,
    holidays: initialHolidays,
  });
  const [holidayDropdownOpen, setHolidayDropdownOpen] = useState(false);
  const holidayRef = useRef(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (holidayRef.current && !holidayRef.current.contains(e.target)) {
        setHolidayDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleHoliday = (day) => {
    setForm(prev => {
      const current = prev.holidays || [];
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return { ...prev, holidays: updated };
    });
  };

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

          {/* Holiday Selection Dropdown Button & Day Name Display */}
          <div className="att-form-field" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={holidayRef}>
            <label className="att-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Weekly Holiday</span>
              {form.holidays?.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: '#059669', textTransform: 'none', fontWeight: 600 }}>
                  {form.holidays.length} {form.holidays.length === 1 ? 'day' : 'days'} selected
                </span>
              )}
            </label>

            <button
              type="button"
              onClick={() => setHolidayDropdownOpen(p => !p)}
              className="att-form-input"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left',
                height: 'auto',
                minHeight: 42,
                padding: '6px 12px',
                background: holidayDropdownOpen ? '#f8fafc' : '#ffffff',
                borderColor: holidayDropdownOpen ? '#3b82f6' : '#e2e8f0',
                boxShadow: holidayDropdownOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {form.holidays && form.holidays.length > 0 ? (
                  form.holidays.map(day => (
                    <span
                      key={day}
                      style={{
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        lineHeight: 1.3
                      }}
                    >
                      {day}
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#94a3b8', fontSize: '0.84rem' }}>Select holiday day(s)...</span>
                )}
              </div>

              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: '#64748b',
                  flexShrink: 0,
                  transform: holidayDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {holidayDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
                  zIndex: 9999,
                  padding: '10px',
                  animation: 'att-fade-in 0.15s ease-out'
                }}
              >
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                  paddingLeft: 4
                }}>
                  Select Days of the Week
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 6
                }}>
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = form.holidays?.includes(day);
                    return (
                      <div
                        key={day}
                        onClick={() => toggleHoliday(day)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected ? '#ecfdf5' : '#ffffff',
                          color: isSelected ? '#065f46' : '#334155',
                          fontWeight: isSelected ? 600 : 500,
                          fontSize: '0.82rem',
                          border: `1px solid ${isSelected ? '#86efac' : '#f1f5f9'}`,
                          transition: 'all 0.12s ease'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = '#ffffff';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => {}}
                          style={{
                            width: 15,
                            height: 15,
                            accentColor: '#10b981',
                            cursor: 'pointer'
                          }}
                        />
                        <span>{day}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '0.74rem'
                }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => set('holidays', ['Friday'])}
                      style={{
                        border: '1px solid #d1fae5',
                        background: '#ecfdf5',
                        color: '#059669',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: 6
                      }}
                    >
                      Friday Only
                    </button>
                    <button
                      type="button"
                      onClick={() => set('holidays', ['Friday', 'Saturday'])}
                      style={{
                        border: '1px solid #dbeafe',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: 6
                      }}
                    >
                      Fri & Sat
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => set('holidays', [])}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '3px 6px',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
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
const MappingModal = ({ employees = [], shifts = [], initialData, onSave, onClose }) => {
  const [form, setForm] = useState({
    enrollId: initialData?.enrollId ? String(initialData.enrollId) : '',
    employeeId: initialData?.employeeId || '',
    employeeName: initialData?.employeeName || '',
    employeeEmpId: initialData?.employeeEmpId || '',
    deviceId: initialData?.deviceId || 'F8-DEFAULT',
    shiftId: initialData?.shiftId || '',
    shiftName: initialData?.shiftName || '',
    notes: initialData?.notes || ''
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Shift list state (passed from parent or fetched)
  const [shiftList, setShiftList] = useState(shifts || []);
  useEffect(() => {
    if (shifts && shifts.length > 0) {
      setShiftList(shifts);
    } else {
      axios.get(`${API_BASE_URL}/api/attendance/shifts`)
        .then(res => setShiftList(res.data || []))
        .catch(err => console.warn('Could not load shifts:', err));
    }
  }, [shifts]);

  // Editable Employee Search & Dropdown State
  const initialEmpDisplay = useMemo(() => {
    if (initialData?.employeeName) {
      return `${initialData.employeeName}${initialData.employeeEmpId ? ` (${initialData.employeeEmpId})` : ''}`;
    }
    if (initialData?.employeeId) {
      const match = (employees || []).find(e => e._id === initialData.employeeId);
      if (match) return `${match.name} (${match.employeeId})`;
    }
    return '';
  }, [initialData, employees]);

  const [empSearch, setEmpSearch] = useState(initialEmpDisplay);
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const empDropdownRef = useRef(null);

  // Close employee dropdown on click outside
  useEffect(() => {
    if (!empDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target)) {
        setEmpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [empDropdownOpen]);

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const q = empSearch.toLowerCase().trim();
    return (employees || []).filter(emp =>
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.employeeId && String(emp.employeeId).toLowerCase().includes(q)) ||
      (emp.department && emp.department.toLowerCase().includes(q)) ||
      (emp.designation && emp.designation.toLowerCase().includes(q))
    );
  }, [employees, empSearch]);

  const handleSelectEmployee = (emp) => {
    if (!emp) {
      setForm(p => ({ ...p, employeeId: '', employeeName: '', employeeEmpId: '' }));
      setEmpSearch('');
      return;
    }
    // Check if this employee already has an assigned shift in shiftList
    const existingShift = shiftList.find(s => (s.applicableTo || []).some(id => String(id) === String(emp._id)));
    setForm(p => ({
      ...p,
      employeeId: emp._id,
      employeeName: emp.name || '',
      employeeEmpId: emp.employeeId || '',
      shiftId: p.shiftId || existingShift?._id || '',
      shiftName: p.shiftName || existingShift?.shiftName || ''
    }));
    setEmpSearch(`${emp.name} (${emp.employeeId})`);
    setEmpDropdownOpen(false);
  };

  const handleShiftSelect = (sId) => {
    const selectedShift = shiftList.find(s => String(s._id) === String(sId));
    setForm(p => ({
      ...p,
      shiftId: sId || '',
      shiftName: selectedShift ? selectedShift.shiftName : ''
    }));
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
            <input
              type="number"
              className="att-form-input"
              value={form.enrollId}
              onChange={e => set('enrollId', e.target.value)}
              placeholder="e.g. 42"
              min={1}
            />
          </div>
          <div className="att-form-field">
            <label className="att-form-label">Device ID (optional)</label>
            <input
              className="att-form-input"
              value={form.deviceId}
              onChange={e => set('deviceId', e.target.value)}
              placeholder="F8-DEFAULT"
            />
          </div>

          {/* Editable ERP Employee / Card Name Field with Dropdown Button */}
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label flex items-center justify-between">
              <span>ERP Employee or Card Name <span className="text-red-500">*</span></span>
              {form.employeeEmpId ? (
                <span className="text-[11px] text-blue-600 font-mono font-bold">
                  ID: {form.employeeEmpId}
                </span>
              ) : empSearch?.trim() ? (
                <span className="text-[11px] text-amber-600 font-medium">
                  Card / Custom Name
                </span>
              ) : null}
            </label>
            <div className="relative" ref={empDropdownRef}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  className="att-form-input pr-16 font-medium"
                  value={empSearch}
                  onChange={e => {
                    const val = e.target.value;
                    setEmpSearch(val);
                    setEmpDropdownOpen(true);
                    const exact = (employees || []).find(emp =>
                      emp.name?.toLowerCase().trim() === val.toLowerCase().trim() ||
                      String(emp.employeeId).toLowerCase().trim() === val.toLowerCase().trim() ||
                      `${emp.name} (${emp.employeeId})`.toLowerCase().trim() === val.toLowerCase().trim()
                    );
                    if (exact) {
                      handleSelectEmployee(exact);
                    } else {
                      setForm(p => ({ ...p, employeeName: val, employeeId: '', employeeEmpId: '' }));
                    }
                  }}
                  onFocus={() => setEmpDropdownOpen(true)}
                  placeholder="Type employee name or card name (e.g. Card)..."
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
                  {empSearch && (
                    <button
                      type="button"
                      onClick={() => handleSelectEmployee(null)}
                      className="p-1 hover:text-red-500 rounded cursor-pointer"
                      title="Clear"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEmpDropdownOpen(prev => !prev)}
                    className="p-1 hover:text-blue-600 rounded cursor-pointer transition-transform"
                    title="Toggle employee list"
                  >
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${empDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Floating Dropdown List */}
              {empDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-full z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto py-1 animate-in fade-in duration-150">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-500 text-center">
                      No matching employee found in ERP.
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setForm(p => ({ ...p, employeeName: empSearch.trim(), employeeId: '', employeeEmpId: '' }));
                            setEmpDropdownOpen(false);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                        >
                          Use "{empSearch.trim()}" as Card / Custom Name
                        </button>
                      </div>
                    </div>
                  ) : (
                    filteredEmployees.map(emp => {
                      const isSelected = String(form.employeeId) === String(emp._id);
                      return (
                        <div
                          key={emp._id}
                          onClick={() => handleSelectEmployee(emp)}
                          className={`px-3.5 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{emp.name}</span>
                            <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              {emp.employeeId}
                            </span>
                            {(emp.designation || emp.department) && (
                              <span className="text-gray-400 text-[11px]">
                                · {emp.designation || emp.department}
                              </span>
                            )}
                          </div>
                          {isSelected && <CheckIcon className="w-4 h-4 text-blue-600" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Shift with Dropdown Button */}
          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label flex items-center justify-between">
              <span>Shift (optional)</span>
              {form.shiftId && (
                <span className="text-[11px] text-emerald-600 font-bold">
                  {shiftList.find(s => String(s._id) === String(form.shiftId))?.startTime} – {shiftList.find(s => String(s._id) === String(form.shiftId))?.endTime}
                </span>
              )}
            </label>
            <ERPSelect
              value={form.shiftId}
              onChange={e => handleShiftSelect(e.target.value)}
              placeholder="— Select Shift (or Default) —"
              className="w-full"
              options={[
                { value: '', label: '— Default Shift (Auto) —' },
                ...shiftList.map(s => ({
                  value: s._id,
                  label: `${s.shiftName} (${s.startTime} – ${s.endTime}${s.isDefault ? ' · Default' : ''})`
                }))
              ]}
            />
          </div>

          <div className="att-form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="att-form-label">Notes (optional)</label>
            <input className="att-form-input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this mapping" />
          </div>
        </div>
        <div className="att-form-actions">
          <button className="att-btn att-btn-secondary" onClick={onClose}><IcoX />Cancel</button>
          <button
            className="att-btn att-btn-primary"
            disabled={!form.enrollId || (!form.employeeId && !form.employeeName?.trim() && !empSearch?.trim())}
            onClick={() => {
              const nameToSave = (form.employeeName || empSearch || '').trim();
              if (!form.enrollId) {
                alert('Enroll ID is required');
                return;
              }
              if (!form.employeeId && !nameToSave) {
                alert('Please enter an employee or card name');
                return;
              }
              onSave({
                ...form,
                employeeName: nameToSave
              });
            }}
          >
            <IcoCheck />Save Mapping
          </button>
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
    overtimeHours: log.overtimeHours !== undefined ? log.overtimeHours : 0,
    lateMinutes: log.lateMinutes !== undefined ? log.lateMinutes : 0,
    remarks: log.remarks || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="att-modal-overlay" onClick={onClose}>
      <div className="att-modal" onClick={e => e.stopPropagation()}>
        <h3 className="att-modal-title">Manual Correction — {log.employeeName}</h3>
        <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: 16 }}>
          {log.date}{log.shiftName ? ` · ${log.shiftName} Shift` : ''}
        </div>
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
          <div className="att-form-field">
            <label className="att-form-label">Overtime Hours (OT)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="att-form-input font-semibold text-amber-700"
              value={form.overtimeHours}
              onChange={e => set('overtimeHours', e.target.value === '' ? 0 : parseFloat(e.target.value))}
              placeholder="0.0"
            />
          </div>
          {form.status === 'LATE' && (
            <div className="att-form-field">
              <label className="att-form-label">Late Duration (Minutes)</label>
              <input
                type="number"
                min="0"
                className="att-form-input font-semibold text-amber-700"
                value={form.lateMinutes}
                onChange={e => set('lateMinutes', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                placeholder="e.g. 25"
              />
            </div>
          )}
          <div className="att-form-field" style={{ gridColumn: form.status === 'LATE' ? 'span 1' : '1 / -1' }}>
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
