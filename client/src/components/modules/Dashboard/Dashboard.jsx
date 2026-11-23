import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  UserIcon,
  UsersIcon,
  ClockIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  TrendingUpIcon,
  BarChartIcon,
  BoxIcon,
  ShoppingCartIcon,
  TruckIcon,
  WalletIcon,
  MapPinIcon,
  ActivityLogIcon,
  RefreshIcon,
  PlusIcon,
  TrashIcon,
  CalendarIcon,
  CheckIcon,
  XIcon,
  ShieldIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AnchorIcon,
  BuildingIcon
} from '../../Icons';
import { API_BASE_URL } from '../../../utils/helpers';
import { safeStorage } from '../../../utils/storageHelper';
import axios from '../../../utils/api';
import { hasPermission } from '../../../utils/permissionHelper';
import { getSocket } from '../../../utils/socket';
import BankDollarRatesWidget from './BankDollarRatesWidget';
import './Dashboard.css';
import { queryClient } from '../../../utils/queryClient';

const formatCurrency = (val) => '৳' + Number(val || 0).toLocaleString('en-IN');
const formatDhakaYMD = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(date);

const formatCompactValue = (val, isCurrency = false, unit = '') => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const num = Number(val);
  const prefix = isCurrency ? '৳ ' : '';
  const suffix = unit ? ` ${unit}` : '';
  if (isCurrency) {
    if (num >= 1e7) {
      return `${prefix}${(num / 1e7).toFixed(1)} Cr`;
    }
    if (num >= 1e5) {
      return `${prefix}${(num / 1e5).toFixed(1)} L`;
    }
    if (num >= 1e3) {
      return `${prefix}${(num / 1e3).toFixed(1)}K`;
    }
    return `${prefix}${Math.round(num).toLocaleString()}`;
  }
  // Weight / Volume / Count mode (e.g. Ton)
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M${suffix}`;
  }
  if (num >= 100000) {
    return `${(num / 1e3).toFixed(1)}K${suffix}`;
  }
  if (num >= 10) {
    return `${Math.round(num).toLocaleString()}${suffix}`;
  }
  return `${num.toFixed(1)}${suffix}`;
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr === 'string') {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const isRecordInTimeframe = (recordDateStr, timeframe, now = new Date()) => {
  if (timeframe === 'all' || !recordDateStr) return true;
  const d = parseDateSafe(recordDateStr);
  if (!d) return true;

  if (timeframe === 'today') {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  if (timeframe === 'weekly') {
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return d >= startOfWeek && d <= endOfToday;
  }

  if (timeframe === 'monthly') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  if (timeframe === 'yearly') {
    return d.getFullYear() === now.getFullYear();
  }

  return true;
};

// Fix Leaflet Default Marker Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Color palette for charts
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#6366f1', '#14b8a6',
  '#f97316', '#84cc16', '#a855f7', '#64748b'
];

const DEFAULT_EMPTY_ARRAY = [];

const Dashboard = ({
  currentUser,
  salesRecords = DEFAULT_EMPTY_ARRAY,
  stockRecords = DEFAULT_EMPTY_ARRAY,
  lcStockRecords = DEFAULT_EMPTY_ARRAY,
  products = DEFAULT_EMPTY_ARRAY,
  warehouseData = DEFAULT_EMPTY_ARRAY,
  customerRecords: initialCustomerRecords = DEFAULT_EMPTY_ARRAY,
  onNavigate
}) => {
  // ─── Dashboard Stats & Backend State ──────────────────────────
  const userStatsCacheKey = useMemo(() => {
    const id = currentUser?._id || currentUser?.id || currentUser?.username || 'default';
    return `dashboard_stats_cache_${id}`;
  }, [currentUser]);

  const userProfileCacheKey = useMemo(() => {
    const id = currentUser?._id || currentUser?.id || currentUser?.username || 'default';
    return `dashboard_user_profile_${id}`;
  }, [currentUser]);

  const [statsData, setStatsData] = useState(() => {
    try {
      const id = currentUser?._id || currentUser?.id || currentUser?.username || 'default';
      const cached = localStorage.getItem(`dashboard_stats_cache_${id}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [isLoadingStats, setIsLoadingStats] = useState(() => !statsData);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const hasStatsRef = useRef(!!statsData);
  useEffect(() => {
    hasStatsRef.current = !!statsData;
  }, [statsData]);

  // ─── Customer Records (for Payment Collections) ───────────────
  const [customerRecords, setCustomerRecords] = useState(initialCustomerRecords || []);

  // ─── Card 1: Attendance & Working Time State ──────────────────
  const [attendanceViewMode, setAttendanceViewMode] = useState('attendance'); // 'attendance' | 'workingTime'
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const id = currentUser?._id || currentUser?.id || currentUser?.username || 'default';
      const cached = localStorage.getItem(`dashboard_user_profile_${id}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);
  const [attendanceWeekOffset, setAttendanceWeekOffset] = useState(0);

  // ─── Card 2: Line Graph (Weekly / Daily LC & PI) State ─────────
  const [lcGraphTimeframe, setLcGraphTimeframe] = useState('weekly'); // 'weekly' | 'daily' | 'all'
  const [lineHoveredPoint, setLineHoveredPoint] = useState(null);

  // ─── Card 3: Pie Chart (LC / IP / Product / Profit) State ──────
  const [pieTab, setPieTab] = useState('product'); // 'product' | 'lc' | 'ip'
  const [pieMetric, setPieMetric] = useState('quantity'); // 'quantity' | 'profit'
  const [pieHoveredSlice, setPieHoveredSlice] = useState(null);
  const [pieTimeframe, setPieTimeframe] = useState('monthly'); // 'monthly' | 'yearly' | 'all'
  const [pieProductType, setPieProductType] = useState('all'); // 'all' | 'General' | 'Border'

  // ─── Card 4: Order & Sales Donut State ─────────────────────────
  const [orderSalesTimeframe, setOrderSalesTimeframe] = useState('weekly'); // 'today' | 'weekly' | 'monthly' | 'yearly' | 'all'
  const [donutHoveredSlice, setDonutHoveredSlice] = useState(null);

  // ─── Card 5: Collection vs Sales State ─────────────────────────
  const [collectionTimeframe, setCollectionTimeframe] = useState('weekly'); // 'today' | 'weekly' | 'monthly' | 'yearly' | 'all'
  const [barHoveredIndex, setBarHoveredIndex] = useState(null);

  // ─── Card 6: To-Do List State ──────────────────────────────────
  const [todos, setTodos] = useState([]);
  const [todoFilter, setTodoFilter] = useState('all'); // 'all' | 'pending' | 'completed'
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState('normal');
  const [isAddingTodo, setIsAddingTodo] = useState(false);

  // ─── Card 7: Location Map State ────────────────────────────────
  const [mapTab, setMapTab] = useState('all'); // 'all' | 'devices' | 'hubs'
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // ─── Card 8: Recent Activity State ─────────────────────────────
  const [activityModuleFilter, setActivityModuleFilter] = useState('ALL');
  const [piRecords, setPiRecords] = useState([]);
  const [lcRecords, setLcRecords] = useState([]);

  // ─── Access Control Check Helper ──────────────────────────────
  const canAccess = useCallback((widgetKey, fallbackModule = null) => {
    if (!currentUser) return false;
    const username = currentUser.username;
    const roleLower = (currentUser.role || '').toLowerCase().trim();
    if (username === 'admin' || roleLower === 'admin' || roleLower === 'administrator' || roleLower === 'superadmin') {
      return true;
    }

    // Check specific dashboard permission
    if (currentUser.permissions && currentUser.permissions.dashboard) {
      if (currentUser.permissions.dashboard[widgetKey] !== undefined) {
        return !!currentUser.permissions.dashboard[widgetKey];
      }
      if (currentUser.permissions.dashboard.view !== undefined) {
        return !!currentUser.permissions.dashboard.view;
      }
    }

    // Check fallback module permission
    if (fallbackModule && hasPermission(currentUser, fallbackModule, 'view')) {
      return true;
    }

    return hasPermission(currentUser, 'dashboard', widgetKey);
  }, [currentUser]);

  const canSyncAttendance = useMemo(() => {
    if (!currentUser) return false;
    const roleLower = (currentUser.role || '').toLowerCase().trim();
    const username = (currentUser.username || '').toLowerCase().trim();
    if (username === 'admin' || roleLower === 'admin' || roleLower === 'administrator' || roleLower === 'superadmin') {
      return true;
    }
    return hasPermission(currentUser, 'attendance', 'special') || hasPermission(currentUser, 'attendance', 'edit');
  }, [currentUser]);

  // ─── Fetch Dashboard Backend Data ──────────────────────────────
  const fetchDashboardStats = useCallback(async (customOffset = null) => {
    try {
      const targetOffset = customOffset !== null ? customOffset : attendanceWeekOffset;
      if (!hasStatsRef.current || targetOffset !== 0) {
        setIsLoadingStats(true);
      }
      const offsetQuery = targetOffset !== 0 ? `&weekOffset=${targetOffset}` : '';
      const res = await axios.get(`${API_BASE_URL}/api/dashboard/stats?mode=personal${offsetQuery}`);
      if (res.data && res.data.success) {
        setStatsData(res.data);
        if (targetOffset === 0) {
          try {
            localStorage.setItem(userStatsCacheKey, JSON.stringify(res.data));
          } catch (e) { }
        }
      }
    } catch (err) {
      console.warn('Dashboard stats fetch failed:', err);
    } finally {
      setIsLoadingStats(false);
      setLastRefreshed(new Date());
    }
  }, [attendanceWeekOffset, userStatsCacheKey]);

  const handleWeekChange = (offset) => {
    setAttendanceWeekOffset(offset);
    fetchDashboardStats(offset);
  };

  // Real-time synchronization via Socket.IO for Attendance & Biometrics
  const lastAttendanceSocketSyncRef = useRef(0);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleAttendanceUpdate = (data) => {
      const mod = (data?.module || '').toLowerCase().trim();
      // Listen specifically for attendance log updates with an 8-second debounce to prevent socket storms
      if (mod === 'attendance' || mod === 'attendances') {
        const now = Date.now();
        if (now - lastAttendanceSocketSyncRef.current < 8000) return;
        lastAttendanceSocketSyncRef.current = now;
        fetchDashboardStats();
      }
    };
    socket.on('data_updated', handleAttendanceUpdate);
    return () => {
      socket.off('data_updated', handleAttendanceUpdate);
    };
  }, [fetchDashboardStats]);

  // Manual trigger for attendance processing
  const handleManualAttendanceSync = async () => {
    try {
      setIsSyncingAttendance(true);
      await axios.post(`${API_BASE_URL}/api/attendance/process-today`);
      await fetchDashboardStats();
    } catch (err) {
      console.warn('Manual attendance sync error:', err);
      await fetchDashboardStats();
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  // ─── Fetch Todos ───────────────────────────────────────────────
  const fetchTodos = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/todos`);
      if (res.data && res.data.todos) {
        setTodos(res.data.todos);
      }
    } catch (err) {
      // Local storage fallback if server endpoint offline
      try {
        const saved = localStorage.getItem('dashboard_todos');
        if (saved) setTodos(JSON.parse(saved));
      } catch (e) { }
    }
  }, []);

  // ─── Fetch PI Records for LC/PI Comparison ─────────────────────
  const fetchPiRecords = useCallback(async () => {
    const cached = queryClient.getQueryData(['pi']);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setPiRecords(cached);
      const isFresh = queryClient.getQueryState(['pi'])?.dataUpdatedAt &&
        (Date.now() - queryClient.getQueryState(['pi']).dataUpdatedAt < 1000 * 60 * 5);
      if (isFresh) return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/pi`);
      if (Array.isArray(res.data)) {
        setPiRecords(res.data);
        queryClient.setQueryData(['pi'], res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch PI records:', e);
    }
  }, []);

  // ─── Fetch LC Records (from LC Management module: 304 LCs) ──────
  const fetchLcRecords = useCallback(async () => {
    const cached = queryClient.getQueryData(['lc-management']);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setLcRecords(cached);
      const isFresh = queryClient.getQueryState(['lc-management'])?.dataUpdatedAt &&
        (Date.now() - queryClient.getQueryState(['lc-management']).dataUpdatedAt < 1000 * 60 * 5);
      if (isFresh) return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/lc-management`);
      if (Array.isArray(res.data)) {
        setLcRecords(res.data);
        queryClient.setQueryData(['lc-management'], res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch LC records:', e);
    }
  }, []);

  // ─── Fetch User Profile (Photo, Designation, Contact) ────────
  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/profile`);
      if (res.data) {
        setUserProfile(res.data);
        try {
          const { profilePhoto, ...cacheable } = res.data;
          safeStorage.setItem(localStorage, userProfileCacheKey, JSON.stringify(cacheable));
        } catch (e) { }
      }
    } catch (e) {
      console.warn('Failed to load user profile in dashboard:', e);
    }
  }, [userProfileCacheKey]);

  // ─── Fetch Customer Records (for Payment Collections) ──────────
  const fetchCustomerRecords = useCallback(async () => {
    const cached = queryClient.getQueryData(['customers']);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setCustomerRecords(cached);
      const isFresh = queryClient.getQueryState(['customers'])?.dataUpdatedAt &&
        (Date.now() - queryClient.getQueryState(['customers']).dataUpdatedAt < 1000 * 60 * 5);
      if (isFresh) return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/customers`);
      if (Array.isArray(res.data)) {
        setCustomerRecords(res.data);
        queryClient.setQueryData(['customers'], res.data);
      }
    } catch (e) {
      console.warn('Failed to load customers in dashboard:', e);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchTodos();
    fetchPiRecords();
    fetchLcRecords();
    fetchUserProfile();
  }, [fetchDashboardStats, fetchTodos, fetchPiRecords, fetchLcRecords, fetchUserProfile]);

  useEffect(() => {
    if (initialCustomerRecords && initialCustomerRecords.length > 0) {
      setCustomerRecords(initialCustomerRecords);
    }
  }, [initialCustomerRecords]);

  // ─── Todo Handlers ─────────────────────────────────────────────
  const handleAddTodo = async (e) => {
    if (e) e.preventDefault();
    if (!newTodoTitle.trim()) return;

    setIsAddingTodo(true);
    const tempId = 'temp_' + Date.now();
    const optimisticTodo = {
      _id: tempId,
      title: newTodoTitle.trim(),
      priority: newTodoPriority,
      completed: false,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.username || 'user'
    };

    setTodos(prev => [optimisticTodo, ...prev]);
    setNewTodoTitle('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/todos`, {
        title: optimisticTodo.title,
        priority: optimisticTodo.priority
      });
      if (res.data && res.data.todo) {
        setTodos(prev => prev.map(t => t._id === tempId ? res.data.todo : t));
      }
    } catch (err) {
      // Keep optimistic item in localStorage
      localStorage.setItem('dashboard_todos', JSON.stringify([optimisticTodo, ...todos]));
    } finally {
      setIsAddingTodo(false);
    }
  };

  const handleToggleTodo = async (id, currentCompleted) => {
    setTodos(prev => prev.map(t => t._id === id ? { ...t, completed: !currentCompleted } : t));
    try {
      await axios.put(`${API_BASE_URL}/api/todos/${id}`, { completed: !currentCompleted });
    } catch (err) {
      console.warn('Failed to update todo status on server:', err);
    }
  };

  const handleDeleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t._id !== id));
    try {
      await axios.delete(`${API_BASE_URL}/api/todos/${id}`);
    } catch (err) {
      console.warn('Failed to delete todo on server:', err);
    }
  };

  const filteredTodos = useMemo(() => {
    return todos.filter(t => {
      if (todoFilter === 'pending') return !t.completed;
      if (todoFilter === 'completed') return t.completed;
      return true;
    });
  }, [todos, todoFilter]);

  // ─── CARD 1: User Profile & Portrait Card Data ─────────────────
  const profileName = userProfile?.name || currentUser?.displayName || currentUser?.name || 'Administrator';
  const profileEmployeeId = userProfile?.employeeId || currentUser?.employeeId || 'ADMIN-001';
  const profileRole = (userProfile?.role || currentUser?.role || 'Admin').toUpperCase();
  const profileDesignation = userProfile?.designation || currentUser?.designation || 'System Administrator';
  const profileDepartment = userProfile?.department || currentUser?.department || 'Management';
  const profilePhone = userProfile?.phone || currentUser?.phone || 'N/A';
  const profileEmail = userProfile?.email || currentUser?.email || 'admin@ani-enterprise.com';
  const profilePhoto = userProfile?.profilePhoto || currentUser?.photo || currentUser?.profilePhoto || '/default-portrait.jpg';

  const formatDateDMY = useCallback((dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return dateStr;
  }, []);

  // ─── CARD 1: Profile & Weekly Days (Saturday - Friday) ─────────
  const weeklyDaysList = useMemo(() => {
    if (statsData?.weekDays && statsData.weekDays.length === 7) {
      return statsData.weekDays.map(wd => ({
        ...wd,
        formattedDate: wd.formattedDate || formatDateDMY(wd.date)
      }));
    }
    // Fallback standard 7 days Saturday to Friday in local time without fake dummy punch data
    const dayNames = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const now = new Date();
    const todayDay = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const diffToSat = (todayDay + 1) % 7;
    const sat = new Date(now);
    sat.setDate(now.getDate() - diffToSat);
    sat.setHours(12, 0, 0, 0);

    return dayNames.map((name, i) => {
      const d = new Date(sat);
      d.setDate(sat.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayNum}`;
      const formattedDate = `${dayNum}/${m}/${y}`;
      const isToday = (todayDay === (i === 0 ? 6 : i - 1));
      return {
        dayName: name,
        date: dateStr,
        formattedDate,
        isToday,
        activeHours: 0,
        status: name === 'Friday' ? 'Weekend' : (isToday ? 'Active' : 'Absent'),
        inTime: '--:--',
        outTime: '--:--',
        attendanceStatus: name === 'Friday' ? 'WEEKEND' : (isToday ? 'ACTIVE' : 'ABSENT')
      };
    });
  }, [statsData, formatDateDMY]);

  const weeklyTotalHours = useMemo(() => {
    return weeklyDaysList.reduce((sum, d) => {
      const h = parseFloat(d.attendanceHours !== undefined && d.attendanceHours !== null && d.attendanceHours > 0 ? d.attendanceHours : (d.activeHours || d.attendanceHours)) || 0;
      return sum + h;
    }, 0).toFixed(1);
  }, [weeklyDaysList]);

  // ─── CARD 2: Line Graph Data (LC vs PI over Days / Weeks / All) ───
  const lineGraphData = useMemo(() => {
    // Prefer true LC Management records (304 LCs), fallback to stock records
    const records = lcRecords.length > 0 ? lcRecords : (lcStockRecords.length > 0 ? lcStockRecords : stockRecords);
    const pis = piRecords || [];

    const getRecDate = (rec) => {
      if (!rec) return '';
      const raw = rec.openingDate || rec.date || rec.piDate || rec.createdAt || '';
      if (typeof raw === 'string') return raw.slice(0, 10);
      if (raw instanceof Date) return raw.toISOString().slice(0, 10);
      return '';
    };

    let dataPoints = [];

    if (lcGraphTimeframe === 'weekly') {
      // Last 8 Weeks trend
      const now = new Date();
      now.setHours(12, 0, 0, 0);

      const weekBuckets = [];
      for (let i = 7; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(now.getDate() - (i * 7));
        const start = new Date(end);
        start.setDate(end.getDate() - 6);

        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);
        const [sy, sm, sd] = startStr.split('-');
        const [ey, em, ed] = endStr.split('-');

        weekBuckets.push({
          label: i === 0 ? 'This Wk' : `${sd}/${sm}`,
          subLabel: `${sd}/${sm}/${sy} - ${ed}/${em}/${ey}`,
          startDate: startStr,
          endDate: endStr,
          lcCount: 0,
          lcValue: 0,
          piCount: 0
        });
      }

      records.forEach(r => {
        const dt = getRecDate(r);
        if (dt) {
          const b = weekBuckets.find(wb => dt >= wb.startDate && dt <= wb.endDate);
          if (b) {
            b.lcCount++;
            b.lcValue += (parseFloat(r.totalBill || r.amount || r.quantity || 0));
          }
        }
      });

      pis.forEach(p => {
        const dt = getRecDate(p);
        if (dt) {
          const b = weekBuckets.find(wb => dt >= wb.startDate && dt <= wb.endDate);
          if (b) {
            b.piCount++;
          }
        }
      });

      dataPoints = weekBuckets;

    } else if (lcGraphTimeframe === 'all') {
      // Monthly trend across last 7 months
      const monthBuckets = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        monthBuckets.push({
          key: mKey,
          label,
          subLabel: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          lcCount: 0,
          lcValue: 0,
          piCount: 0
        });
      }

      records.forEach(r => {
        const dt = getRecDate(r);
        if (dt && dt.length >= 7) {
          const mKey = dt.slice(0, 7);
          const b = monthBuckets.find(mb => mb.key === mKey);
          if (b) {
            b.lcCount++;
            b.lcValue += (parseFloat(r.totalBill || r.amount || r.quantity || 0));
          }
        }
      });

      pis.forEach(p => {
        const dt = getRecDate(p);
        if (dt && dt.length >= 7) {
          const mKey = dt.slice(0, 7);
          const b = monthBuckets.find(mb => mb.key === mKey);
          if (b) {
            b.piCount++;
          }
        }
      });

      dataPoints = monthBuckets;

    } else {
      // Daily: Work Week (Sat to Fri)
      const dayBuckets = weeklyDaysList.map(d => ({
        label: d.dayName.slice(0, 3),
        subLabel: d.formattedDate || d.date,
        date: d.date,
        lcCount: 0,
        lcValue: 0,
        piCount: 0
      }));

      records.forEach(r => {
        const dt = getRecDate(r);
        const b = dayBuckets.find(db => db.date === dt);
        if (b) {
          b.lcCount++;
          b.lcValue += (parseFloat(r.totalBill || r.amount || r.quantity || 0));
        }
      });

      pis.forEach(p => {
        const dt = getRecDate(p);
        const b = dayBuckets.find(db => db.date === dt);
        if (b) {
          b.piCount++;
        }
      });

      dataPoints = dayBuckets;
    }

    const maxVal = Math.max(
      1,
      ...dataPoints.map(p => Math.max(p.lcCount, p.piCount))
    );

    return {
      points: dataPoints,
      maxVal,
      totalLcs: records.length,
      totalPis: pis.length,
      timeframe: lcGraphTimeframe
    };
  }, [lcRecords, lcStockRecords, stockRecords, piRecords, weeklyDaysList, lcGraphTimeframe]);

  // ─── CARD 3: Pie / Donut Chart Data (Product / IP / LC) ────────
  const pieChartData = useMemo(() => {
    const productCountMap = {};

    if (pieTab === 'product') {
      const rawList = salesRecords && salesRecords.length > 0 ? salesRecords : [];
      let sourceList = rawList.filter(s => {
        const dStr = s.date || (s.createdAt ? String(s.createdAt).slice(0, 10) : null);
        const matchesTime = isRecordInTimeframe(dStr, pieTimeframe);
        if (!matchesTime) return false;
        if (pieProductType === 'all') return true;
        const sType = (s.saleType || 'General').toLowerCase().trim();
        return sType === pieProductType.toLowerCase().trim();
      });
      // Fallback if monthly has no records in calendar month, find latest recorded month
      if (sourceList.length === 0 && rawList.length > 0 && pieTimeframe === 'monthly') {
        let latestDate = null;
        rawList.forEach(s => {
          const dStr = s.date || (s.createdAt ? String(s.createdAt).slice(0, 10) : null);
          if (dStr) {
            const d = new Date(dStr);
            if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) latestDate = d;
          }
        });
        if (latestDate) {
          sourceList = rawList.filter(s => {
            const dStr = s.date || (s.createdAt ? String(s.createdAt).slice(0, 10) : null);
            if (!dStr) return false;
            const d = new Date(dStr);
            const matchesTime = !isNaN(d.getTime()) && d.getFullYear() === latestDate.getFullYear() && d.getMonth() === latestDate.getMonth();
            if (!matchesTime) return false;
            if (pieProductType === 'all') return true;
            const sType = (s.saleType || 'General').toLowerCase().trim();
            return sType === pieProductType.toLowerCase().trim();
          });
        }
      }

      sourceList.forEach(rec => {
        const items = Array.isArray(rec.items) && rec.items.length > 0 ? rec.items : [rec];
        items.forEach(it => {
          const pName = (it.productName || it.product || rec.productName || 'General').trim().toUpperCase();
          if (!pName) return;

          let qty = 0;
          let val = 0;

          if (Array.isArray(it.brandEntries) && it.brandEntries.length > 0) {
            it.brandEntries.forEach(b => {
              const bq = parseFloat(b.quantity) || 0;
              const bPrice = parseFloat(b.unitPrice) || 0;
              const bAmt = parseFloat(b.totalAmount) || (bq * bPrice);
              qty += bq;
              val += bAmt;
            });
          } else {
            qty = parseFloat(it.quantity || it.qty || 0);
            const unitP = parseFloat(it.unitPrice || it.rate || 0);
            val = parseFloat(it.totalAmount || (qty * unitP) || 0);
          }

          if (val === 0 && qty > 0) {
            const saleTotal = parseFloat(rec.totalAmount || rec.totalBill || 0);
            if (saleTotal > 0 && items.length > 0) {
              val = saleTotal / items.length;
            }
          }

          // Convert kg to Ton for volume/qty in Product tab
          const qtyInTon = qty / 1000;
          const metricVal = pieMetric === 'profit' ? val : qtyInTon;
          productCountMap[pName] = (productCountMap[pName] || 0) + (isNaN(metricVal) ? 0 : metricVal);
        });
      });

      // Fallback if sales records are empty but stock records exist
      if (sourceList.length === 0 && stockRecords && stockRecords.length > 0) {
        stockRecords.forEach(rec => {
          const pName = (rec.productName || rec.product || 'General').trim().toUpperCase();
          const q = parseFloat(rec.quantity || rec.stockQuantity || 0);
          const price = parseFloat(rec.purchasedPrice || rec.salePrice || rec.rate || 0);
          const amt = parseFloat(rec.totalAmount || (q * price) || 0);
          const qInTon = q / 1000;
          const metricVal = pieMetric === 'profit' ? amt : qInTon;
          productCountMap[pName] = (productCountMap[pName] || 0) + (isNaN(metricVal) ? 0 : metricVal);
        });
      }
    } else if (pieTab === 'ip') {
      const allLcs = lcRecords && lcRecords.length > 0 ? lcRecords : lcStockRecords;
      let lcs = (allLcs || []).filter(l => {
        const dStr = l.openingDate || l.date || (l.createdAt ? String(l.createdAt).slice(0, 10) : null);
        return isRecordInTimeframe(dStr, pieTimeframe);
      });
      if (lcs.length === 0 && (allLcs || []).length > 0 && pieTimeframe === 'monthly') {
        let latestDate = null;
        (allLcs || []).forEach(l => {
          const dStr = l.openingDate || l.date || (l.createdAt ? String(l.createdAt).slice(0, 10) : null);
          if (dStr) {
            const d = new Date(dStr);
            if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) latestDate = d;
          }
        });
        if (latestDate) {
          lcs = (allLcs || []).filter(l => {
            const dStr = l.openingDate || l.date || (l.createdAt ? String(l.createdAt).slice(0, 10) : null);
            if (!dStr) return false;
            const d = new Date(dStr);
            return !isNaN(d.getTime()) && d.getFullYear() === latestDate.getFullYear() && d.getMonth() === latestDate.getMonth();
          });
        }
      }

      (lcs || []).forEach(rec => {
        const ip = (rec.importerName || rec.importer || rec.ipNo || (Array.isArray(rec.ipNumbers) && rec.ipNumbers[0]) || 'Direct IP').trim();
        const q = parseFloat(rec.quantity || 1);
        const amt = parseFloat(rec.totalAmount || (parseFloat(rec.totalDollar || 0) * parseFloat(rec.dollarRate || 120)) || 0);
        const metricVal = pieMetric === 'profit' ? (amt || q * 1000) : q;
        productCountMap[ip] = (productCountMap[ip] || 0) + (isNaN(metricVal) ? 0 : metricVal);
      });
    } else {
      // LC distribution by Port
      const allLcs = lcRecords && lcRecords.length > 0 ? lcRecords : lcStockRecords;
      let lcs = (allLcs || []).filter(l => {
        const dStr = l.openingDate || l.date || (l.createdAt ? String(l.createdAt).slice(0, 10) : null);
        return isRecordInTimeframe(dStr, pieTimeframe);
      });
      if (lcs.length === 0 && (allLcs || []).length > 0 && pieTimeframe === 'monthly') {
        let latestDate = null;
        (allLcs || []).forEach(l => {
          const dStr = l.openingDate || l.date || (l.createdAt ? String(l.createdAt).slice(0, 10) : null);
          if (dStr) {
            const d = new Date(dStr);
            if (!isNaN(d.getTime()) && (!latestDate || d > latestDate)) latestDate = d;
          }
        });
        if (latestDate) {
          lcs = (allLcs || []).filter(l => {
            const dStr = l.openingDate || l.date || (l.createdAt ? String(l.createdAt).slice(0, 10) : null);
            if (!dStr) return false;
            const d = new Date(dStr);
            return !isNaN(d.getTime()) && d.getFullYear() === latestDate.getFullYear() && d.getMonth() === latestDate.getMonth();
          });
        }
      }

      (lcs || []).forEach(rec => {
        const port = (rec.port || rec.dischargePort || rec.customsName || rec.status || 'Chattogram Port').trim().toUpperCase();
        const q = parseFloat(rec.quantity || 1);
        const amt = parseFloat(rec.totalAmount || (parseFloat(rec.totalDollar || 0) * parseFloat(rec.dollarRate || 120)) || 0);
        const metricVal = pieMetric === 'profit' ? (amt || q * 1000) : q;
        productCountMap[port] = (productCountMap[port] || 0) + (isNaN(metricVal) ? 0 : metricVal);
      });
    }

    const entries = Object.entries(productCountMap)
      .filter(([name, val]) => val > 0 && name && name !== 'UNDEFINED')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const totalVal = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const isCurrency = pieMetric === 'profit';
    const unit = isCurrency ? '' : 'Ton';

    let cumulativeAngle = 0;
    const slices = entries.map(([name, val], idx) => {
      const percentage = (val / totalVal) * 100;
      const angle = (val / totalVal) * 360;
      const startAngle = cumulativeAngle;
      cumulativeAngle += angle;
      return {
        name,
        value: val,
        percentage: percentage.toFixed(1),
        formattedValue: formatCompactValue(val, isCurrency, unit),
        color: PALETTE[idx % PALETTE.length],
        startAngle,
        endAngle: cumulativeAngle
      };
    });

    return {
      slices,
      total: totalVal,
      formattedTotal: formatCompactValue(totalVal, isCurrency, unit),
      unit,
      isCurrency,
      timeframe: pieTimeframe
    };
  }, [pieTab, pieMetric, pieTimeframe, pieProductType, salesRecords, stockRecords, lcStockRecords, lcRecords]);

  // ─── CARD 4: Order & Sales Circle / Donut Data ─────────────────
  const orderSalesData = useMemo(() => {
    let generalCount = 0;
    let orderCount = 0;
    let borderCount = 0;

    let generalAmount = 0;
    let borderAmount = 0;
    let orderAmount = 0;

    salesRecords.forEach(s => {
      const dStr = s.date || (s.createdAt ? String(s.createdAt).slice(0, 10) : '');
      if (!isRecordInTimeframe(dStr, orderSalesTimeframe)) return;

      const type = (s.saleType || '').toLowerCase().trim();
      const amount = parseFloat(s.totalAmount || s.totalBill || 0) || 0;

      if (type === 'order' || (s.invoiceNo || '').startsWith('ORD')) {
        orderCount++;
        orderAmount += amount;
      } else if (type === 'border') {
        borderCount++;
        borderAmount += amount;
      } else {
        generalCount++;
        generalAmount += amount;
      }
    });

    const totalCount = generalCount + borderCount + orderCount;
    const closedSalesCount = generalCount + borderCount;
    const totalSalesAmount = generalAmount + borderAmount;
    const fulfillmentRate = totalCount > 0 ? Math.round((closedSalesCount / totalCount) * 100) : 0;

    const segments = [
      {
        id: 'general',
        name: 'General Sales',
        count: generalCount,
        amount: generalAmount,
        color: '#10b981',
        pct: totalCount > 0 ? (generalCount / totalCount) * 100 : 0
      },
      {
        id: 'border',
        name: 'Border Sales',
        count: borderCount,
        amount: borderAmount,
        color: '#8b5cf6',
        pct: totalCount > 0 ? (borderCount / totalCount) * 100 : 0
      },
      {
        id: 'order',
        name: 'Orders in Pipe',
        count: orderCount,
        amount: orderAmount,
        color: '#3b82f6',
        pct: totalCount > 0 ? (orderCount / totalCount) * 100 : 0
      }
    ];

    return {
      segments,
      fulfillmentRate,
      completionRate: fulfillmentRate,
      completedCount: generalCount,
      generalCount,
      borderCount,
      orderCount,
      totalCount,
      closedSalesCount,
      generalAmount,
      borderAmount,
      orderAmount,
      completedAmount: totalSalesAmount,
      totalSalesAmount,
      timeframe: orderSalesTimeframe
    };
  }, [salesRecords, orderSalesTimeframe]);

  // ─── CARD 5: Collection vs Sales Bar Chart Data ────────────────
  const collectionSalesData = useMemo(() => {
    // Prefer server-aggregated recentCollections from statsData (bandwidth optimization), fallback to customerRecords
    const allCollections = (statsData?.recentCollections && statsData.recentCollections.length > 0)
      ? statsData.recentCollections
      : [];

    if (allCollections.length === 0 && customerRecords && customerRecords.length > 0) {
      customerRecords.forEach(cust => {
        if (Array.isArray(cust.paymentHistory)) {
          cust.paymentHistory.forEach(p => {
            if (p && p.date) {
              allCollections.push({
                date: String(p.date || '').slice(0, 10),
                amount: parseFloat(p.amount || 0)
              });
            }
          });
        }
      });
    }

    const allSalesList = (salesRecords || []).map(s => ({
      date: String(s.date || (s.createdAt ? String(s.createdAt).slice(0, 10) : '')).slice(0, 10),
      totalAmount: parseFloat(s.totalAmount || s.totalBill || s.grandTotal || 0) || 0,
      paidAmount: parseFloat(s.paidAmount || s.paid || s.receivedAmount || 0) || 0
    }));

    const now = new Date();
    const todayStr = formatDhakaYMD(now);

    let columns = [];

    if (collectionTimeframe === 'today' || collectionTimeframe === 'weekly') {
      // Past 7 Days leading up to and including Today (Weekly cycle)
      for (let i = 6; i >= 0; i--) {
        const cur = new Date(now);
        cur.setDate(now.getDate() - i);
        const dateStr = formatDhakaYMD(cur);
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Dhaka' });
        const [y, m, d] = dateStr.split('-');
        const isToday = dateStr === todayStr;

        let daySales = 0;
        let dayColl = 0;

        allSalesList.forEach(s => {
          if (s.date === dateStr) {
            daySales += s.totalAmount;
            dayColl += s.paidAmount;
          }
        });
        allCollections.forEach(c => {
          if (c.date === dateStr) {
            dayColl += c.amount;
          }
        });

        columns.push({
          label: isToday ? 'Today' : dayName,
          subLabel: `${d}/${m}/${y}`,
          date: dateStr,
          sales: Math.round(daySales),
          collection: Math.round(dayColl),
          isHighlight: isToday
        });
      }

    } else if (collectionTimeframe === 'monthly') {
      // Weeks of current month (Nov 2026: Week 1 to Week 5)
      const curYear = now.getFullYear();
      const curMonth = now.getMonth(); // 0-based
      const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
      const monthShort = now.toLocaleDateString('en-US', { month: 'short' });

      const weekRanges = [
        { label: 'W1', subLabel: `1-7 ${monthShort}`, startDay: 1, endDay: 7 },
        { label: 'W2', subLabel: `8-14 ${monthShort}`, startDay: 8, endDay: 14 },
        { label: 'W3', subLabel: `15-21 ${monthShort}`, startDay: 15, endDay: 21 },
        { label: 'W4', subLabel: `22-28 ${monthShort}`, startDay: 22, endDay: 28 },
      ];
      if (daysInMonth > 28) {
        weekRanges.push({
          label: 'W5',
          subLabel: `29-${daysInMonth} ${monthShort}`,
          startDay: 29,
          endDay: daysInMonth
        });
      }

      const pad = (n) => String(n).padStart(2, '0');
      const curYm = `${curYear}-${pad(curMonth + 1)}`;

      columns = weekRanges.map(w => {
        const startStr = `${curYm}-${pad(w.startDay)}`;
        const endStr = `${curYm}-${pad(w.endDay)}`;
        let wSales = 0;
        let wColl = 0;

        allSalesList.forEach(s => {
          if (s.date >= startStr && s.date <= endStr) {
            wSales += s.totalAmount;
            wColl += s.paidAmount;
          }
        });
        allCollections.forEach(c => {
          if (c.date >= startStr && c.date <= endStr) {
            wColl += c.amount;
          }
        });

        return {
          label: w.label,
          subLabel: w.subLabel,
          date: `${w.startDay}-${w.endDay}`,
          sales: Math.round(wSales),
          collection: Math.round(wColl)
        };
      });

    } else if (collectionTimeframe === 'yearly') {
      // 12 Months of the current year (Jan to Dec)
      const curYear = now.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      columns = monthNames.map((mName, idx) => {
        const mStr = `${curYear}-${String(idx + 1).padStart(2, '0')}`;
        let mSales = 0;
        let mColl = 0;

        allSalesList.forEach(s => {
          if (s.date.startsWith(mStr)) {
            mSales += s.totalAmount;
            mColl += s.paidAmount;
          }
        });
        allCollections.forEach(c => {
          if (c.date.startsWith(mStr)) {
            mColl += c.amount;
          }
        });

        return {
          label: mName,
          subLabel: `${mName} ${curYear}`,
          date: mStr,
          sales: Math.round(mSales),
          collection: Math.round(mColl)
        };
      });

    } else if (collectionTimeframe === 'all') {
      // Last 6 Quarters across recorded history
      const quarters = [
        { label: "Q3 '25", subLabel: 'Jul - Sep 2025', start: '2025-07-01', end: '2025-09-30' },
        { label: "Q4 '25", subLabel: 'Oct - Dec 2025', start: '2025-10-01', end: '2025-12-31' },
        { label: "Q1 '26", subLabel: 'Jan - Mar 2026', start: '2026-01-01', end: '2026-03-31' },
        { label: "Q2 '26", subLabel: 'Apr - Jun 2026', start: '2026-04-01', end: '2026-06-30' },
        { label: "Q3 '26", subLabel: 'Jul - Sep 2026', start: '2026-07-01', end: '2026-09-30' },
        { label: "Q4 '26", subLabel: 'Oct - Dec 2026', start: '2026-10-01', end: '2026-12-31' }
      ];

      columns = quarters.map(q => {
        let qSales = 0;
        let qColl = 0;

        allSalesList.forEach(s => {
          if (s.date >= q.start && s.date <= q.end) {
            qSales += s.totalAmount;
            qColl += s.paidAmount;
          }
        });
        allCollections.forEach(c => {
          if (c.date >= q.start && c.date <= q.end) {
            qColl += c.amount;
          }
        });

        return {
          label: q.label,
          subLabel: q.subLabel,
          date: q.label,
          sales: Math.round(qSales),
          collection: Math.round(qColl)
        };
      });

    } else {
      // Default fallback: Past 7 Days leading up to and including Today
      for (let i = 6; i >= 0; i--) {
        const cur = new Date(now);
        cur.setDate(now.getDate() - i);
        const dateStr = formatDhakaYMD(cur);
        const dayName = cur.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Dhaka' });
        const [y, m, d] = dateStr.split('-');
        const isToday = dateStr === todayStr;

        let daySales = 0;
        let dayColl = 0;

        allSalesList.forEach(s => {
          if (s.date === dateStr) {
            daySales += s.totalAmount;
            dayColl += s.paidAmount;
          }
        });
        allCollections.forEach(c => {
          if (c.date === dateStr) {
            dayColl += c.amount;
          }
        });

        columns.push({
          label: isToday ? 'Today' : dayName,
          subLabel: `${d}/${m}/${y}`,
          date: dateStr,
          sales: Math.round(daySales),
          collection: Math.round(dayColl),
          isHighlight: isToday
        });
      }
    }

    // Compute Totals
    let totalSales = 0;
    let totalCollection = 0;

    if (collectionTimeframe === 'today') {
      // Today KPI is filtered strictly to Today
      allSalesList.forEach(s => {
        if (s.date === todayStr) {
          totalSales += s.totalAmount;
          totalCollection += s.paidAmount;
        }
      });
      allCollections.forEach(c => {
        if (c.date === todayStr) {
          totalCollection += c.amount;
        }
      });
    } else if (collectionTimeframe === 'all') {
      // All time totals across all records
      totalSales = allSalesList.reduce((acc, s) => acc + s.totalAmount, 0);
      totalCollection = allSalesList.reduce((acc, s) => acc + s.paidAmount, 0) + allCollections.reduce((acc, c) => acc + c.amount, 0);
    } else {
      // Sum of columns for weekly / monthly / yearly
      totalSales = columns.reduce((s, d) => s + d.sales, 0);
      totalCollection = columns.reduce((s, d) => s + d.collection, 0);
    }

    totalSales = Math.round(totalSales);
    totalCollection = Math.round(totalCollection);
    const maxVal = Math.max(1, ...columns.map(d => Math.max(d.sales, d.collection)));

    return {
      days: columns,
      totalSales,
      totalCollection,
      dueAmount: Math.max(0, totalSales - totalCollection),
      collectionRatio: totalSales > 0 ? Math.min(100, Math.round((totalCollection / totalSales) * 100)) : (totalCollection > 0 ? 100 : 0),
      maxVal,
      timeframe: collectionTimeframe
    };
  }, [weeklyDaysList, salesRecords, statsData?.recentCollections, customerRecords, collectionTimeframe]);

  // ─── CARD 7: Leaflet Map Setup ─────────────────────────────────
  const hubsKey = useMemo(() => JSON.stringify(statsData?.logisticsHubs || []), [statsData?.logisticsHubs]);
  const devicesKey = useMemo(() => JSON.stringify(statsData?.trackedDevices || []), [statsData?.trackedDevices]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize Leaflet map centered over Bangladesh
      const map = L.map(mapContainerRef.current, {
        center: [23.6850, 90.3563],
        zoom: 7,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const markersLayer = markersLayerRef.current;
    if (markersLayer) {
      markersLayer.clearLayers();

      const hubs = statsData?.logisticsHubs || [];
      const devices = statsData?.trackedDevices || [];

      // Render logistics hubs markers
      if (mapTab === 'all' || mapTab === 'hubs') {
        hubs.forEach(hub => {
          const isPort = hub.type.includes('Port');
          const hubIcon = L.divIcon({
            className: 'custom-hub-icon',
            html: `
              <div style="background-color: ${isPort ? '#0284c7' : '#059669'}; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
                <span style="font-size: 13px;">${isPort ? '⚓' : '🏢'}</span>
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const m = L.marker([hub.lat, hub.lng], { icon: hubIcon });
          m.bindPopup(`
            <div style="padding: 10px; font-size: 12px; font-family: sans-serif; min-width: 140px;">
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${hub.name}</strong>
              <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-bottom: 4px;">${hub.type}</span>
              <p style="margin: 0; color: #64748b;">${hub.description}</p>
            </div>
          `);
          markersLayer.addLayer(m);
        });
      }

      // Render tracked MDM devices markers
      if (mapTab === 'all' || mapTab === 'devices') {
        devices.forEach(dev => {
          if (dev.lastLocation && dev.lastLocation.lat) {
            const isOnline = dev.isOnline;
            const devIcon = L.divIcon({
              className: 'custom-dev-icon',
              html: `
                <div style="position: relative;">
                  <div style="background-color: ${isOnline ? '#22c55e' : '#64748b'}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">
                    <span style="font-size: 11px;">📱</span>
                  </div>
                  ${isOnline ? '<span style="position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; border-radius: 50%; background-color: #22c55e; border: 1.5px solid white;"></span>' : ''}
                </div>
              `,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });

            const m = L.marker([dev.lastLocation.lat, dev.lastLocation.lng], { icon: devIcon });
            m.bindPopup(`
              <div style="padding: 10px; font-size: 12px; font-family: sans-serif; min-width: 150px;">
                <strong style="color: #0f172a; font-size: 13px;">${dev.employeeName || 'Staff Member'}</strong>
                <div style="margin-top: 3px; color: #475569;">Device: ${dev.deviceModel || 'Mobile'}</div>
                <div style="color: ${isOnline ? '#16a34a' : '#64748b'}; font-weight: bold; font-size: 11px; margin-top: 2px;">
                  ● ${isOnline ? 'Online / Active' : 'Offline'}
                </div>
              </div>
            `);
            markersLayer.addLayer(m);
          }
        });
      }
    }
  }, [hubsKey, devicesKey, mapTab]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ─── CARD 8: Filtered Recent Activity ──────────────────────────
  const filteredRecentLogs = useMemo(() => {
    const raw = statsData?.recentLogs || [];
    if (activityModuleFilter === 'ALL') return raw;
    return raw.filter(l => (l.module || '').toUpperCase() === activityModuleFilter.toUpperCase());
  }, [statsData, activityModuleFilter]);

  // Format relative time helper
  const getRelativeTime = (isoString) => {
    if (!isoString) return 'recently';
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const renderAttendanceSection = () => (
    <>
      <div>
        {/* Header with Attendance / Working Time Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
                {attendanceViewMode === 'attendance' ? 'Attendance & Biometrics' : 'Working Time Tracker'}
              </h2>
              <p className="text-[10px] text-gray-400">
                {attendanceViewMode === 'attendance' ? 'In/Out Times & Day Status' : 'Weekly Tracked Hours'}
              </p>
            </div>
          </div>

          {/* Attendance vs Working Time Toggle */}
          <div className="flex sm:inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAttendanceViewMode('attendance')}
              className={`flex-1 sm:flex-initial flex items-center justify-center px-2.5 py-1.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${attendanceViewMode === 'attendance'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              Attendance
            </button>
            <button
              type="button"
              onClick={() => setAttendanceViewMode('workingTime')}
              className={`flex-1 sm:flex-initial flex items-center justify-center px-2.5 py-1.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${attendanceViewMode === 'workingTime'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              Working Time
            </button>
          </div>
        </div>

        {/* ─── VIEW 1: ATTENDANCE (In Time, Out Time, Status from Attendance Module) ─── */}
        {isLoadingStats && !statsData ? (
          <div className="space-y-1 mt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1.5 grid grid-cols-12 gap-1 border-b border-gray-100">
              <span className="col-span-4">DAY (SAT - FRI)</span>
              <span className="col-span-3 text-center">IN TIME</span>
              <span className="col-span-3 text-center">OUT TIME</span>
              <span className="col-span-2 text-right">STATUS</span>
            </div>
            {[...Array(7)].map((_, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1 items-center py-2 px-2 rounded-xl min-h-[42px] animate-pulse">
                <div className="col-span-4 space-y-1">
                  <div className="h-3.5 bg-gray-200 rounded w-20"></div>
                  <div className="h-2.5 bg-gray-100 rounded w-14"></div>
                </div>
                <div className="col-span-3 flex justify-center">
                  <div className="h-3.5 bg-gray-100 rounded w-16"></div>
                </div>
                <div className="col-span-3 flex justify-center">
                  <div className="h-3.5 bg-gray-100 rounded w-16"></div>
                </div>
                <div className="col-span-2 flex justify-end">
                  <div className="h-5 bg-gray-100 rounded-full w-14"></div>
                </div>
              </div>
            ))}
          </div>
        ) : attendanceViewMode === 'attendance' ? (
          <div className="space-y-1 mt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1.5 grid grid-cols-12 gap-1 border-b border-gray-100">
              <span className="col-span-4">DAY (SAT - FRI)</span>
              <span className="col-span-3 text-center">IN TIME</span>
              <span className="col-span-3 text-center">OUT TIME</span>
              <span className="col-span-2 text-right">STATUS</span>
            </div>

            {weeklyDaysList.map((day) => {
              const isWeekend = day.dayName === 'Friday' || day.attendanceStatus === 'WEEKEND';
              const statusStr = (day.attendanceStatus || (isWeekend ? 'WEEKEND' : (day.isToday ? 'ACTIVE' : 'ABSENT'))).toUpperCase();

              const renderStatusBadge = () => {
                switch (statusStr) {
                  case 'PRESENT':
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">Present</span>;
                  case 'LATE':
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">Late</span>;
                  case 'HALF_DAY':
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">Half Day</span>;
                  case 'LEAVE':
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">Leave</span>;
                  case 'WEEKEND':
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">Weekend</span>;
                  case 'ACTIVE':
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">Active</span>;
                  default:
                    return <span className="inline-block px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 whitespace-nowrap">Absent</span>;
                }
              };

              return (
                <div
                  key={day.dayName}
                  className={`grid grid-cols-12 gap-1 items-center py-1.5 px-2 rounded-xl min-h-[42px] transition-all ${day.isToday ? 'bg-blue-50/70 border border-blue-200/80 shadow-2xs' : 'hover:bg-gray-50'
                    }`}
                >
                  {/* Day & Date */}
                  <div className="col-span-4 flex flex-col justify-center">
                    <span className={`text-xs sm:text-[13px] font-bold leading-tight ${day.isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                      {day.dayName}
                    </span>
                    <span className={`text-[11px] font-medium leading-normal ${day.isToday ? 'text-blue-600/80' : 'text-gray-500'}`}>
                      {day.formattedDate || formatDateDMY(day.date)}
                    </span>
                  </div>

                  {/* In Time */}
                  <div className="col-span-3 text-center">
                    <span className={`text-xs sm:text-[13px] ${day.inTime && day.inTime !== '--:--' ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'}`}>
                      {isWeekend ? '--:--' : (day.inTime || '--:--')}
                    </span>
                  </div>

                  {/* Out Time */}
                  <div className="col-span-3 text-center">
                    <span className={`text-xs sm:text-[13px] ${day.outTime && day.outTime !== '--:--' ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'}`}>
                      {isWeekend ? '--:--' : (day.outTime || '--:--')}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="col-span-2 text-right">
                    {renderStatusBadge()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── VIEW 2: WORKING TIME (Visual Progress Bar & Active Hours) ─── */
          <div className="space-y-1 mt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1.5 grid grid-cols-12 gap-1 border-b border-gray-100">
              <span className="col-span-4">DAY (SAT - FRI)</span>
              <span className="col-span-6 text-center">WORKING HOURS</span>
              <span className="col-span-2 text-right">STATUS</span>
            </div>

            {weeklyDaysList.map((day) => {
              const hours = parseFloat(day.attendanceHours !== undefined && day.attendanceHours !== null && day.attendanceHours > 0 ? day.attendanceHours : (day.activeHours || day.attendanceHours)) || 0;
              const maxHours = 8;
              const progressPct = Math.min(100, Math.round((hours / maxHours) * 100));
              const isWeekend = day.dayName === 'Friday' || day.attendanceStatus === 'WEEKEND';

              return (
                <div
                  key={day.dayName}
                  className={`grid grid-cols-12 gap-1 items-center py-1.5 px-2 rounded-xl min-h-[42px] transition-all ${day.isToday ? 'bg-blue-50/70 border border-blue-200/80 shadow-2xs' : 'hover:bg-gray-50'
                    }`}
                >
                  {/* Day & Date - IDENTICAL geometry & typography to Attendance view */}
                  <div className="col-span-4 flex flex-col justify-center">
                    <span className={`text-xs sm:text-[13px] font-bold leading-tight ${day.isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                      {day.dayName}
                    </span>
                    <span className={`text-[11px] font-medium leading-normal ${day.isToday ? 'text-blue-600/80' : 'text-gray-500'}`}>
                      {day.formattedDate || formatDateDMY(day.date)}
                    </span>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="col-span-6 px-1 flex items-center">
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isWeekend
                          ? 'bg-gray-300'
                          : day.isToday
                            ? 'bg-blue-600'
                            : hours > 0
                              ? 'bg-amber-400'
                              : 'bg-transparent'
                          }`}
                        style={{ width: `${isWeekend ? 0 : Math.max(hours > 0 ? 10 : 0, progressPct)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Hours Tag - Aligned to exact same position and width as Status badge */}
                  <div className="col-span-2 text-right">
                    <span className={`text-xs sm:text-[13px] font-bold ${isWeekend ? 'text-gray-400' : day.isToday ? 'text-blue-600' : 'text-gray-800'
                      }`}>
                      {isWeekend ? 'Weekend' : `${hours}h`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Total */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-gray-500 min-h-[34px]">
        {attendanceViewMode === 'attendance' ? (
          <>
            {isLoadingStats && !statsData ? (
              <div className="flex items-center justify-center sm:justify-start gap-2 animate-pulse w-full sm:w-auto">
                <div className="h-3.5 bg-gray-200 rounded w-44"></div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs w-full sm:w-auto">
                <span>Present: <strong className="text-emerald-600">{weeklyDaysList.filter(d => d.attendanceStatus === 'PRESENT' || d.attendanceStatus === 'LATE' || d.attendanceStatus === 'HALF_DAY').length}</strong></span>
                <span>Late: <strong className="text-amber-600">{weeklyDaysList.filter(d => d.attendanceStatus === 'LATE').length}</strong></span>
                <span>Absent: <strong className="text-rose-500">{weeklyDaysList.filter(d => (d.attendanceStatus === 'ABSENT' || !d.attendanceStatus) && d.dayName !== 'Friday' && (attendanceWeekOffset !== 0 || !d.isToday)).length}</strong></span>
              </div>
            )}

            {/* Previous Week / Current Week Button */}
            {attendanceWeekOffset === 0 ? (
              <button
                type="button"
                onClick={() => handleWeekChange(-1)}
                disabled={isLoadingStats}
                className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-gray-200/80 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                title="View previous week attendance"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-500" />
                <span>Previous Week</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleWeekChange(0)}
                disabled={isLoadingStats}
                className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                title="Return to current week"
              >
                <span>Current Week</span>
                <ChevronRightIcon className="w-3.5 h-3.5 text-blue-600" />
              </button>
            )}

            {canSyncAttendance ? (
              <button
                type="button"
                onClick={handleManualAttendanceSync}
                disabled={isSyncingAttendance}
                title="Click to re-process and sync today's attendance punches from biometric device"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto cursor-pointer transition-colors group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Attendance Module Synced</span>
                <RefreshIcon className={`w-3.5 h-3.5 text-blue-500 group-hover:rotate-180 transition-transform duration-500 ${isSyncingAttendance ? 'animate-spin' : ''}`} />
              </button>
            ) : (
              <div className="text-xs font-semibold text-gray-500 flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Attendance Module Synced</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
              <span className="text-xs font-medium text-gray-500">Total Weekly Time:</span>
              <span className="font-bold text-gray-900 text-sm sm:text-base">{weeklyTotalHours} Hours</span>
            </div>

            {/* Previous Week / Current Week Button (Working Time Mode) */}
            {attendanceWeekOffset === 0 ? (
              <button
                type="button"
                onClick={() => handleWeekChange(-1)}
                disabled={isLoadingStats}
                className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 border border-gray-200/80 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                title="View previous week working hours"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5 text-gray-500" />
                <span>Previous Week</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleWeekChange(0)}
                disabled={isLoadingStats}
                className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                title="Return to current week"
              >
                <span>Current Week</span>
                <ChevronRightIcon className="w-3.5 h-3.5 text-blue-600" />
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="dashboard-container space-y-6 pb-12 font-sans">
      {/* ─── ROW 1: Profile & Attendance (Left) | Bank Dollar Rates | Pie Chart ── */}
      {(canAccess('profile', 'attendance') || canAccess('bankDollarRates', 'bank') || canAccess('lcGraph', 'lcManagement') || canAccess('pieChart', 'product')) && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Card 1: Profile & Attendance (Left: Portrait Card, Right: Days List) */}
          {canAccess('profile', 'attendance') ? (
            <div className="dash-card xl:col-span-6 bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">

              {/* ─── DESKTOP VIEW (md: and above): EXACT ORIGINAL LAYOUT AND STYLING ─── */}
              <div className="hidden md:grid md:grid-cols-12 gap-5 h-full items-stretch">
                {/* LEFT SIDE: Profile Card */}
                <div className="md:col-span-5 relative rounded-2xl select-none md:bg-slate-900 p-4 sm:p-5 min-h-[380px] flex flex-col justify-end overflow-hidden border-none shadow-none">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={profileName}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex absolute inset-0 w-full h-full bg-slate-800 items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl">
                        {profileName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}

                  {/* Desktop Faded Effect overlay from bottom up */}
                  <div className="absolute inset-x-0 bottom-0 h-44 sm:h-52 pointer-events-none bg-gradient-to-t from-slate-950 via-slate-950/75 via-65% to-transparent"></div>

                  {/* Welcome Info Content: Welcome Name, Designation, Department */}
                  <div className="relative z-10 flex flex-col w-full py-1 md:py-0">
                    <p className="text-base md:text-lg font-bold text-white tracking-tight drop-shadow-sm">Welcome,</p>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md truncate">
                      {profileName}
                    </h2>
                    <p className="text-sm font-semibold text-blue-400 mt-0.5 sm:mt-1 drop-shadow-sm truncate">
                      {profileDesignation}
                    </p>
                    {profileDepartment && (
                      <p className="text-xs text-white/80 mt-0.5 drop-shadow-sm truncate">
                        {profileDepartment}
                      </p>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE: Saturday - Friday Attendance & Working Time Track */}
                <div className="md:col-span-7 flex flex-col justify-between">
                  {renderAttendanceSection()}
                </div>
              </div>

              {/* ─── MOBILE VIEW (< md): IMAGE 2 DESIGN WITH FADED OVERLAPPING ATTENDANCE ─── */}
              <div className="md:hidden flex flex-col">
                {/* Profile Card (Matching Image 2 Reference - Increased Height) */}
                <div className="relative rounded-2xl select-none bg-slate-900 h-[460px] sm:h-[500px] flex flex-col justify-end overflow-hidden shadow-lg border border-slate-800/80">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={profileName}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-slate-800 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl">
                        {profileName.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  )}

                  {/* Faded Effect overlay from bottom up */}
                  <div className="absolute inset-x-0 bottom-0 h-60 pointer-events-none bg-gradient-to-t from-slate-950 via-slate-950/80 via-60% to-transparent"></div>

                  {/* Welcome Info Content */}
                  <div className="relative z-10 flex flex-col w-full pb-4 px-4 sm:px-5">
                    <p className="text-xs font-bold text-blue-400 tracking-tight drop-shadow-sm uppercase">Welcome,</p>
                    <h2 className="text-xl font-extrabold text-white tracking-tight leading-tight drop-shadow-md truncate">
                      {profileName}
                    </h2>
                    <p className="text-xs font-semibold text-blue-300 mt-0.5 drop-shadow-sm truncate">
                      {profileDesignation}
                    </p>
                    {profileDepartment && (
                      <p className="text-[11px] text-white/80 mt-0.5 drop-shadow-sm truncate">
                        {profileDepartment}
                      </p>
                    )}
                  </div>
                </div>

                {/* Attendance Card */}
                <div className="mt-4 relative bg-white rounded-2xl border border-gray-100 shadow-xs p-3.5 flex flex-col justify-between">
                  {renderAttendanceSection()}
                </div>
              </div>

            </div>
          ) : null}

          {/* Card 2: Bank Dollar Rates (placed in Row 1) */}
          {canAccess('bankDollarRates', 'bank') ? (
            <BankDollarRatesWidget currentUser={currentUser} onNavigate={onNavigate} className="xl:col-span-3" />
          ) : null}

          {/* Card 3: LC / IP / Pie Chart (Product & Profit) */}
          {canAccess('pieChart', 'product') ? (
            <div className="dash-card xl:col-span-3 bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Header with Product / IP / LC Switch */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <BoxIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Distribution Pie</h2>
                      <p className="text-[11px] text-gray-400">Inventory & Volumes</p>
                    </div>
                  </div>

                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
                    {['product', 'ip', 'lc'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setPieTab(tab); setPieHoveredSlice(null); }}
                        className={`px-2 py-1 rounded-md text-[11px] uppercase font-semibold transition-all cursor-pointer ${pieTab === tab
                          ? 'bg-white text-amber-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metric Filter */}
                <div className="flex items-center justify-between my-3 px-1 text-xs text-gray-500">
                  <span>Metric Mode:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setPieMetric('quantity'); setPieHoveredSlice(null); }}
                      className={`text-[11px] font-semibold cursor-pointer ${pieMetric === 'quantity' ? 'text-amber-600 underline' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Volume / Qty
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => { setPieMetric('profit'); setPieHoveredSlice(null); }}
                      className={`text-[11px] font-semibold cursor-pointer ${pieMetric === 'profit' ? 'text-amber-600 underline' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Total Value
                    </button>
                  </div>
                </div>

                {/* Interactive SVG Pie / Donut Chart */}
                <div className="relative flex items-center justify-center h-44 sm:h-48 my-1">
                  <svg viewBox="0 0 180 180" className="w-44 h-44 sm:w-48 sm:h-48 transform -rotate-90">
                    {pieChartData.slices.map((slice, idx) => {
                      const r = 82;
                      const cx = 90;
                      const cy = 90;
                      const startAngleRad = (slice.startAngle * Math.PI) / 180;
                      const endAngleRad = (slice.endAngle * Math.PI) / 180;

                      const x1 = cx + r * Math.cos(startAngleRad);
                      const y1 = cy + r * Math.sin(startAngleRad);
                      const x2 = cx + r * Math.cos(endAngleRad);
                      const y2 = cy + r * Math.sin(endAngleRad);

                      const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
                      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

                      const isHovered = pieHoveredSlice?.name === slice.name;

                      return (
                        <path
                          key={idx}
                          d={d}
                          fill={slice.color}
                          stroke="#ffffff"
                          strokeWidth={isHovered ? "3.5" : "2"}
                          className="chart-slice transition-all duration-150 cursor-pointer"
                          style={{
                            transformOrigin: '90px 90px',
                            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                            filter: isHovered ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' : 'none'
                          }}
                          onMouseEnter={() => setPieHoveredSlice(slice)}
                          onMouseLeave={() => setPieHoveredSlice(null)}
                        />
                      );
                    })}
                    {/* Donut Hole */}
                    <circle cx="90" cy="90" r="50" fill="#ffffff" />
                  </svg>

                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                    {pieHoveredSlice ? (
                      <>
                        <span className="text-[11px] uppercase font-bold text-amber-600 max-w-[95px] truncate">
                          {pieHoveredSlice.name}
                        </span>
                        <span className="text-xl font-black text-gray-900 leading-tight">
                          {pieHoveredSlice.percentage}%
                        </span>
                        <span className="text-xs font-semibold text-gray-500">
                          {pieHoveredSlice.formattedValue}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          {pieMetric === 'profit' ? 'Total Value' : 'Total Qty'}
                        </span>
                        <span className="text-base font-black text-gray-900 leading-tight">
                          {pieChartData.formattedTotal}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400">
                          Top 5 {pieTab === 'product' ? (pieProductType === 'all' ? 'Products' : `${pieProductType} Products`) : pieTab === 'ip' ? 'Importers' : 'Ports'} ({pieTimeframe === 'monthly' ? 'Monthly' : pieTimeframe === 'yearly' ? 'Yearly' : 'All Time'})
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Breakdown Legend Table */}
                <div className="space-y-1 mt-1 max-h-32 overflow-y-auto dash-scrollbar pr-0.5">
                  {pieChartData.slices.map((slice, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between text-xs py-1 px-1.5 rounded-lg cursor-pointer transition-all ${pieHoveredSlice?.name === slice.name
                        ? 'bg-amber-50/80 shadow-xs ring-1 ring-amber-300'
                        : 'hover:bg-gray-50'
                        }`}
                      onMouseEnter={() => setPieHoveredSlice(slice)}
                      onMouseLeave={() => setPieHoveredSlice(null)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform"
                          style={{
                            backgroundColor: slice.color,
                            transform: pieHoveredSlice?.name === slice.name ? 'scale(1.25)' : 'scale(1)'
                          }}
                        ></span>
                        <span className="font-semibold text-gray-700 truncate text-[11px] sm:text-xs">{slice.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">{slice.formattedValue}</span>
                        <span className="font-bold text-gray-900 text-[11px] sm:text-xs">{slice.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Left Side: General & Border Product Switch */}
                {pieTab === 'product' ? (
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'General', label: 'General' },
                      { id: 'Border', label: 'Border' }
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setPieProductType(id); setPieHoveredSlice(null); }}
                        className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${pieProductType === id
                          ? 'bg-white text-amber-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {pieTab} Distribution
                  </span>
                )}

                {/* Right Side: Timeframe Switch (Monthly / Yearly / All Time) */}
                <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
                  {[
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly' },
                    { id: 'all', label: 'All Time' }
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setPieTimeframe(id); setPieHoveredSlice(null); }}
                      className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer ${pieTimeframe === id
                        ? 'bg-white text-amber-600 shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

        </div>
      )}

      {/* ─── ROW 2: 3 Columns (Order and Sales | Collection & Sales | Todolist) ── */}
      {(canAccess('orderSales', 'sales') || canAccess('collectionSales', 'paymentCollection') || canAccess('todoList')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Card 4: Order and Sales Donut */}
          {canAccess('orderSales', 'sales') ? (
            <div className="dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 min-h-[46px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <ShoppingCartIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-gray-900">Order & Sales</h2>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-200 shadow-xs">
                          {orderSalesData.fulfillmentRate}% Fulfilled
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">Fulfillment Pipeline</p>
                    </div>
                  </div>

                  {/* Timeframe Selector: Today | Weekly | Monthly | Yearly | All */}
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs flex-shrink-0 overflow-x-auto max-w-full">
                    {[
                      { id: 'today', label: 'Today' },
                      { id: 'weekly', label: 'Weekly' },
                      { id: 'monthly', label: 'Monthly' },
                      { id: 'yearly', label: 'Yearly' },
                      { id: 'all', label: 'All' }
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setOrderSalesTimeframe(id); setDonutHoveredSlice(null); }}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${orderSalesTimeframe === id
                          ? 'bg-white text-emerald-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Big Circular Donut Representation */}
                <div className="relative flex items-center justify-center h-52 sm:h-56 my-2">
                  <svg viewBox="0 0 200 200" className="w-52 h-52 sm:w-56 sm:h-56 transform -rotate-90">
                    {/* Background Track */}
                    <circle cx="100" cy="100" r="78" fill="none" stroke="#f1f5f9" strokeWidth="24" />

                    {/* Slices */}
                    {(() => {
                      let cumulativePct = 0;
                      const r = 78;
                      const circ = 2 * Math.PI * r;
                      const activeSegments = orderSalesData.segments.filter(s => s.count > 0);

                      return activeSegments.map((seg, idx) => {
                        const strokeDasharray = `${(seg.pct / 100) * circ} ${circ}`;
                        const strokeDashoffset = -((cumulativePct / 100) * circ);
                        cumulativePct += seg.pct;
                        const isHovered = donutHoveredSlice?.id === seg.id;

                        return (
                          <circle
                            key={seg.id || idx}
                            cx="100"
                            cy="100"
                            r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={isHovered ? "28" : "24"}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="cursor-pointer transition-all duration-200"
                            style={{
                              filter: isHovered ? 'drop-shadow(0 3px 8px rgba(0,0,0,0.28))' : 'none'
                            }}
                            onMouseEnter={() => setDonutHoveredSlice(seg)}
                            onMouseLeave={() => setDonutHoveredSlice(null)}
                          />
                        );
                      });
                    })()}
                  </svg>

                  {/* Center KPI */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                    {donutHoveredSlice ? (
                      <>
                        <span
                          className="text-[11px] sm:text-xs uppercase font-extrabold tracking-wider truncate max-w-[130px]"
                          style={{ color: donutHoveredSlice.color }}
                        >
                          {donutHoveredSlice.name}
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
                          {donutHoveredSlice.pct.toFixed(1)}%
                        </span>
                        <span className="text-[11px] sm:text-xs font-semibold text-gray-500">
                          {donutHoveredSlice.count.toLocaleString()} Records
                        </span>
                        <span className="text-[11px] sm:text-xs font-bold text-gray-800">
                          {formatCompactValue(donutHoveredSlice.amount, true)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] sm:text-xs uppercase font-bold text-gray-400 tracking-wider">
                          Sales Value
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
                          {formatCompactValue(orderSalesData.totalSalesAmount, true)}
                        </span>
                        <span className="text-[11px] sm:text-xs font-medium text-gray-400">
                          {orderSalesData.totalCount.toLocaleString()} Records ({orderSalesTimeframe === 'today' ? 'Today' : orderSalesTimeframe === 'weekly' ? 'Weekly' : orderSalesTimeframe === 'monthly' ? 'Monthly' : orderSalesTimeframe === 'yearly' ? 'Yearly' : 'All Time'})
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 3-Column Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div
                    onMouseEnter={() => setDonutHoveredSlice(orderSalesData.segments.find(s => s.id === 'general'))}
                    onMouseLeave={() => setDonutHoveredSlice(null)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${donutHoveredSlice?.id === 'general'
                      ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-200'
                      : 'bg-emerald-50/40 border-emerald-100/70 hover:bg-emerald-50/70'
                      }`}
                  >
                    <span className="text-[10px] text-emerald-700 uppercase font-bold block truncate">General</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">{orderSalesData.generalCount} Rec</span>
                    <span className="text-[10px] text-gray-500 font-semibold block truncate">{formatCompactValue(orderSalesData.generalAmount, true)}</span>
                  </div>

                  <div
                    onMouseEnter={() => setDonutHoveredSlice(orderSalesData.segments.find(s => s.id === 'border'))}
                    onMouseLeave={() => setDonutHoveredSlice(null)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${donutHoveredSlice?.id === 'border'
                      ? 'bg-purple-50/90 border-purple-300 ring-1 ring-purple-200'
                      : 'bg-purple-50/40 border-purple-100/70 hover:bg-purple-50/70'
                      }`}
                  >
                    <span className="text-[10px] text-purple-700 uppercase font-bold block truncate">Border</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">{orderSalesData.borderCount} Rec</span>
                    <span className="text-[10px] text-gray-500 font-semibold block truncate">{formatCompactValue(orderSalesData.borderAmount, true)}</span>
                  </div>

                  <div
                    onMouseEnter={() => setDonutHoveredSlice(orderSalesData.segments.find(s => s.id === 'order'))}
                    onMouseLeave={() => setDonutHoveredSlice(null)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${donutHoveredSlice?.id === 'order'
                      ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-200'
                      : 'bg-blue-50/40 border-blue-100/70 hover:bg-blue-50/70'
                      }`}
                  >
                    <span className="text-[10px] text-blue-700 uppercase font-bold block truncate">Orders</span>
                    <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">{orderSalesData.orderCount} Rec</span>
                    <span className="text-[10px] text-gray-500 font-semibold block truncate">{formatCompactValue(orderSalesData.orderAmount, true)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Legend */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                {orderSalesData.segments.map(seg => (
                  <button
                    key={seg.id}
                    type="button"
                    onMouseEnter={() => setDonutHoveredSlice(seg)}
                    onMouseLeave={() => setDonutHoveredSlice(null)}
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${donutHoveredSlice?.id === seg.id ? 'bg-gray-100 font-bold text-gray-900' : 'hover:text-gray-900'
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }}></span>
                    <span className="text-[11px] font-medium">{seg.name}</span>
                    <span className="text-[10px] text-gray-400 font-semibold hidden sm:inline">({seg.pct.toFixed(0)}%)</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Card 5: Collection | Sales (Column / Bar Chart) */}
          {canAccess('collectionSales', 'paymentCollection') ? (
            <div className="dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 min-h-[46px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <BarChartIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Collection & Sales</h2>
                      <p className="text-[11px] text-gray-400">Cash Flow Comparison</p>
                    </div>
                  </div>

                  {/* Timeframe Selector: Today | Weekly | Monthly | Yearly | All */}
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs flex-shrink-0 overflow-x-auto max-w-full">
                    {[
                      { id: 'today', label: 'Today' },
                      { id: 'weekly', label: 'Weekly' },
                      { id: 'monthly', label: 'Monthly' },
                      { id: 'yearly', label: 'Yearly' },
                      { id: 'all', label: 'All' }
                    ].map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setCollectionTimeframe(id); setBarHoveredIndex(null); }}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${collectionTimeframe === id
                          ? 'bg-white text-blue-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total KPI Row */}
                <div className="grid grid-cols-3 gap-2 my-3 text-center">
                  <div className="p-2 bg-blue-50/50 rounded-xl border border-blue-100/60">
                    <span className="text-[10px] text-blue-500 font-bold block uppercase">Sales</span>
                    <span className="text-xs font-bold text-blue-950">৳{Number(collectionSalesData.totalSales).toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-emerald-50/50 rounded-xl border border-emerald-100/60">
                    <span className="text-[10px] text-emerald-500 font-bold block uppercase">Collected</span>
                    <span className="text-xs font-bold text-emerald-950">৳{Number(collectionSalesData.totalCollection).toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-amber-50/50 rounded-xl border border-amber-100/60">
                    <span className="text-[10px] text-amber-600 font-bold block uppercase">Due Balance</span>
                    <span className="text-xs font-bold text-amber-950">৳{Number(collectionSalesData.dueAmount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Visual Bar / Column Chart - Flexibly fills available vertical height */}
              <div className="flex-1 flex flex-col justify-end pt-2 pb-1">
                <div className="relative w-full flex items-end justify-between gap-1 sm:gap-2 h-44 sm:h-52 px-1">
                  {collectionSalesData.days.map((d, idx) => {
                    const max = Math.max(1, collectionSalesData.maxVal);
                    const maxBarHeight = 152;
                    const salesHeight = d.sales > 0 ? Math.max(8, Math.round((d.sales / max) * maxBarHeight)) : 4;
                    const collectionHeight = d.collection > 0 ? Math.max(8, Math.round((d.collection / max) * maxBarHeight)) : 4;
                    const isYearly = collectionTimeframe === 'yearly';

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                        onMouseEnter={() => setBarHoveredIndex(idx)}
                        onMouseLeave={() => setBarHoveredIndex(null)}
                      >
                        <div className={`w-full flex items-end justify-center ${isYearly ? 'gap-0.5' : 'gap-1 sm:gap-1.5'} h-40`}>
                          {/* Sales Bar */}
                          <div
                            className={`w-1/2 ${isYearly ? 'max-w-[8px]' : 'max-w-[14px]'} rounded-t-sm transition-all duration-300 ${d.sales > 0
                              ? 'bg-blue-500 group-hover:bg-blue-600 shadow-2xs'
                              : 'bg-blue-200/60'
                              }`}
                            style={{ height: `${salesHeight}px` }}
                            title={`Sales: ৳${d.sales.toLocaleString()}`}
                          ></div>
                          {/* Collection Bar */}
                          <div
                            className={`w-1/2 ${isYearly ? 'max-w-[8px]' : 'max-w-[14px]'} rounded-t-sm transition-all duration-300 ${d.collection > 0
                              ? 'bg-emerald-500 group-hover:bg-emerald-600 shadow-2xs'
                              : 'bg-emerald-200/60'
                              }`}
                            style={{ height: `${collectionHeight}px` }}
                            title={`Collection: ৳${d.collection.toLocaleString()}`}
                          ></div>
                        </div>
                        <span className={`${isYearly ? 'text-[9px]' : 'text-[10px]'} font-semibold ${d.isHighlight ? 'text-blue-600 font-bold' : 'text-gray-500'} group-hover:text-gray-900 truncate max-w-full text-center`}>
                          {d.label}
                        </span>
                      </div>
                    );
                  })}

                  {/* Hover Tooltip */}
                  {barHoveredIndex !== null && collectionSalesData.days[barHoveredIndex] && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-lg pointer-events-none flex items-center gap-2.5 z-10 whitespace-nowrap">
                      <span className="font-bold">
                        {collectionSalesData.days[barHoveredIndex].label}
                        {collectionSalesData.days[barHoveredIndex].subLabel ? ` (${collectionSalesData.days[barHoveredIndex].subLabel})` : ''}:
                      </span>
                      <span className="text-blue-300 font-semibold">Sales: ৳{collectionSalesData.days[barHoveredIndex].sales.toLocaleString()}</span>
                      <span className="text-emerald-300 font-semibold">Coll: ৳{collectionSalesData.days[barHoveredIndex].collection.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recovery Rate Footer & Progress Bar */}
              <div className="mt-2 pt-2.5 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Collection Recovery Rate:</span>
                    <span className="font-bold text-emerald-600 text-sm">{collectionSalesData.collectionRatio}%</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold">
                    <span className="flex items-center gap-1 text-blue-600">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Sales
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Collection
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, collectionSalesData.collectionRatio))}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                  <span>৳{Number(collectionSalesData.totalCollection).toLocaleString()} Collected</span>
                  <span>Target: ৳{Number(collectionSalesData.totalSales).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Card 6: Todolist (Interactive & Synchronized) */}
          {canAccess('todoList') ? (
            <div className="dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <CheckCircle2Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Task Checklist</h2>
                      <p className="text-[11px] text-gray-400">Daily Operations & Todos</p>
                    </div>
                  </div>

                  {/* Filter */}
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
                    {['all', 'pending', 'completed'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setTodoFilter(f)}
                        className={`px-2 py-1 rounded-md text-[11px] capitalize font-semibold transition-all cursor-pointer ${todoFilter === f
                          ? 'bg-white text-purple-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Todo Input */}
                <form onSubmit={handleAddTodo} className="my-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="New operational task..."
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-sans focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isAddingTodo || !newTodoTitle.trim()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </form>

                {/* Todo Items List */}
                <div className="space-y-2 max-h-56 overflow-y-auto dash-scrollbar pr-1 mt-2">
                  {filteredTodos.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      No {todoFilter !== 'all' ? todoFilter : ''} tasks found.
                    </div>
                  ) : (
                    filteredTodos.map((todo) => (
                      <div
                        key={todo._id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${todo.completed
                          ? 'bg-gray-50/70 border-gray-200/60 opacity-60'
                          : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-xs'
                          }`}
                      >
                        <label className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={() => handleToggleTodo(todo._id, todo.completed)}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 cursor-pointer"
                          />
                          <span className={`text-xs font-medium truncate ${todo.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {todo.title}
                          </span>
                        </label>

                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {todo.priority === 'high' && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              High
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteTodo(todo._id)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Delete task"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Remaining Pending:</span>
                <span className="font-bold text-purple-600">
                  {todos.filter(t => !t.completed).length} Tasks
                </span>
              </div>
            </div>
          ) : null}

        </div>
      )}

      {/* ─── ROW 3: 3 Columns (Location Map [1 Col] | LC & PI Trends [1 Col] | Recent Activity [1 Col]) ── */}
      {(canAccess('locationMap', 'mdm') || canAccess('lcGraph', 'lcManagement') || canAccess('recentActivity', 'log')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Card 7: Location (Leaflet Map) */}
          {canAccess('locationMap', 'mdm') ? (
            <div className="dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 min-h-[46px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                      <MapPinIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Location & Hubs</h2>
                      <p className="text-[11px] text-gray-400">MDM GPS & Logistics Map</p>
                    </div>
                  </div>

                  {/* Filter */}
                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
                    {['all', 'devices', 'hubs'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setMapTab(t)}
                        className={`px-2 py-1 rounded-md text-[11px] capitalize font-semibold transition-all cursor-pointer ${mapTab === t
                          ? 'bg-white text-cyan-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map Container */}
                <div className="my-3 rounded-xl overflow-hidden border border-gray-200 h-64 dash-map-container relative">
                  <div ref={mapContainerRef} className="w-full h-full"></div>
                </div>

                {/* Map Legend */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> Sea/Land Port</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> Warehouse Hub</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Live GPS</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>National Coverage:</span>
                <span className="font-semibold text-gray-700">Bangladesh Grid</span>
              </div>
            </div>
          ) : null}

          {/* Card 8: LC & PI Trends */}
          {canAccess('lcGraph', 'lcManagement') ? (
            <div className="dash-card bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Header with Switch */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 min-h-[46px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <TrendingUpIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">LC & PI Trends</h2>
                      <p className="text-[11px] text-gray-400">Activity Over Days</p>
                    </div>
                  </div>

                  <div className="inline-flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/60 text-xs">
                    {['weekly', 'daily', 'all'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setLcGraphTimeframe(tab)}
                        className={`px-2 py-1 rounded-md text-[11px] capitalize font-semibold transition-all cursor-pointer ${lcGraphTimeframe === tab
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {tab === 'weekly' ? 'Weekly' : tab === 'daily' ? 'Daily' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KPI Chips */}
                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/80">
                    <span className="text-[11px] font-semibold text-indigo-600 block">Total LC Records</span>
                    <span className="text-xl font-bold text-indigo-950">{lineGraphData.totalLcs}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/80">
                    <span className="text-[11px] font-semibold text-emerald-600 block">Active PIs</span>
                    <span className="text-xl font-bold text-emerald-950">{lineGraphData.totalPis}</span>
                  </div>
                </div>

                {/* Interactive SVG Line Graph */}
                <div className="relative h-48 w-full mt-2">
                  <svg viewBox="0 0 320 160" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="lcGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="piGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Guide Lines */}
                    {[30, 65, 100, 135].map((y) => (
                      <line key={y} x1="15" y1={y} x2="310" y2={y} stroke="#f1f5f9" strokeDasharray="3 3" />
                    ))}

                    {/* ─── LC Curve & Area (Indigo) ─── */}
                    {(() => {
                      const pts = lineGraphData.points;
                      if (pts.length < 2) return null;
                      const step = 280 / (pts.length - 1);
                      const max = Math.max(6, Math.ceil(lineGraphData.maxVal * 1.25));

                      const coordinates = pts.map((p, idx) => {
                        const x = 20 + idx * step;
                        const y = 135 - ((p.lcCount || 0) / max) * 105;
                        return { x, y, p };
                      });

                      const pathD = coordinates.reduce((acc, c, idx) => {
                        return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
                      }, '');

                      const areaD = `${pathD} L ${coordinates[coordinates.length - 1].x} 135 L ${coordinates[0].x} 135 Z`;

                      return (
                        <g>
                          <path d={areaD} fill="url(#lcGradient)" />
                          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          {coordinates.map((c, idx) => (
                            <circle
                              key={`lc-${idx}`}
                              cx={c.x}
                              cy={c.y}
                              r="3.5"
                              fill="#6366f1"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="chart-dot cursor-pointer"
                              onMouseEnter={() => setLineHoveredPoint({ ...c.p, x: c.x, y: c.y, type: 'LC' })}
                              onMouseLeave={() => setLineHoveredPoint(null)}
                            />
                          ))}
                        </g>
                      );
                    })()}

                    {/* ─── PI Curve & Area (Emerald) ─── */}
                    {(() => {
                      const pts = lineGraphData.points;
                      if (pts.length < 2) return null;
                      const step = 280 / (pts.length - 1);
                      const max = Math.max(6, Math.ceil(lineGraphData.maxVal * 1.25));

                      const coordinates = pts.map((p, idx) => {
                        const x = 20 + idx * step;
                        const y = 135 - ((p.piCount || 0) / max) * 105;
                        return { x, y, p };
                      });

                      const pathD = coordinates.reduce((acc, c, idx) => {
                        return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
                      }, '');

                      const areaD = `${pathD} L ${coordinates[coordinates.length - 1].x} 135 L ${coordinates[0].x} 135 Z`;

                      return (
                        <g>
                          <path d={areaD} fill="url(#piGradient)" />
                          <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          {coordinates.map((c, idx) => (
                            <circle
                              key={`pi-${idx}`}
                              cx={c.x}
                              cy={c.y}
                              r="3.5"
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="chart-dot cursor-pointer"
                              onMouseEnter={() => setLineHoveredPoint({ ...c.p, x: c.x, y: c.y, type: 'PI' })}
                              onMouseLeave={() => setLineHoveredPoint(null)}
                            />
                          ))}
                        </g>
                      );
                    })()}

                    {/* X Axis Labels */}
                    {lineGraphData.points.map((p, idx) => {
                      const step = 280 / (lineGraphData.points.length - 1);
                      const x = 20 + idx * step;
                      return (
                        <text key={idx} x={x} y="152" textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontWeight="600">
                          {p.label}
                        </text>
                      );
                    })}
                  </svg>

                  {/* Hover Tooltip */}
                  {lineHoveredPoint && (
                    <div
                      className="absolute z-20 bg-gray-900/95 backdrop-blur-xs text-white text-[11px] p-2.5 rounded-xl shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full border border-gray-700/50 min-w-[130px]"
                      style={{ left: `${(lineHoveredPoint.x / 320) * 100}%`, top: `${(lineHoveredPoint.y / 160) * 100 - 8}%` }}
                    >
                      <div className="font-bold text-gray-200 border-b border-gray-800 pb-1 mb-1.5 flex items-center justify-between">
                        <span>{lineHoveredPoint.label}</span>
                        {lineHoveredPoint.subLabel && <span className="text-[10px] text-gray-400 font-normal">{lineHoveredPoint.subLabel}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-indigo-300 font-semibold">
                        <span>LC Records:</span>
                        <strong className="text-white text-xs">{lineHoveredPoint.lcCount}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-emerald-300 font-semibold mt-1">
                        <span>PI Records:</span>
                        <strong className="text-white text-xs">{lineHoveredPoint.piCount}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> LC Stream</span>
                  <span className="flex items-center gap-1.5 font-medium"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> PI Records</span>
                </div>
                <span className="font-semibold text-gray-700">
                  {lcGraphTimeframe === 'weekly' ? '8-Week Trend' : lcGraphTimeframe === 'all' ? 'Monthly Trend' : '7-Day Trend'}
                </span>
              </div>
            </div>
          ) : null}

          {/* Card 9: Recent Activity */}
          {canAccess('recentActivity', 'log') ? (
            <div className={`dash-card ${!canAccess('lcGraph', 'lcManagement') ? 'lg:col-span-2' : ''} bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs flex flex-col justify-between`}>
              <div>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 min-h-[46px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                      <ActivityLogIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900">Recent Activity</h2>
                      <p className="text-[11px] text-gray-400">Live System Operations & Audits</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={activityModuleFilter}
                      onChange={(e) => setActivityModuleFilter(e.target.value)}
                      className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none cursor-pointer"
                    >
                      <option value="ALL">All Modules</option>
                      <option value="SALES">Sales & Orders</option>
                      <option value="LC">LC Operations</option>
                      <option value="PAYMENT">Payments</option>
                      <option value="STOCK">Inventory</option>
                      <option value="AUTH">Authentication</option>
                    </select>

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('log-section')}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer whitespace-nowrap ml-1"
                      >
                        View All Logs →
                      </button>
                    )}
                  </div>
                </div>

                {/* Activity Log Feed */}
                <div className="space-y-2.5 my-3 max-h-64 overflow-y-auto dash-scrollbar pr-1">
                  {filteredRecentLogs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                      No recent activity logs recorded yet.
                    </div>
                  ) : (
                    filteredRecentLogs.map((log, idx) => {
                      const modUpper = (log.module || 'SYSTEM').toUpperCase();
                      const badgeColor =
                        modUpper.includes('SALE') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          modUpper.includes('LC') ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            modUpper.includes('PAY') || modUpper.includes('BANK') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              modUpper.includes('STOCK') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-gray-100 text-gray-700 border-gray-200';

                      return (
                        <div
                          key={log._id || idx}
                          className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition-all"
                        >
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                            {(log.displayName || log.username || 'S').charAt(0).toUpperCase()}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 truncate">
                                {log.displayName || log.username || 'System'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                {log.module || 'General'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-0.5 leading-snug break-words">
                              {log.description}
                            </p>
                          </div>

                          {/* Timestamp */}
                          <div className="text-right flex-shrink-0 text-[10px] text-gray-400 font-medium">
                            {getRelativeTime(log.timestamp)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>Synchronized via Real-time Socket</span>
                <span className="text-gray-500 font-semibold">{filteredRecentLogs.length} events logged</span>
              </div>
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
};

export default Dashboard;
