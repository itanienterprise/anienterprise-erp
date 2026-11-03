import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from '../../../utils/api';
import { getSocket } from '../../../utils/socket';
import mdmService from '../../../utils/mdmService';
import {
  MapPinIcon,
  UsersIcon,
  SearchIcon,
  RefreshIcon,
  CheckIcon,
  ShieldIcon,
  CalendarIcon,
  PhoneIcon,
  ChevronDownIcon,
  TrashIcon,
  ArrowUpRightIcon,
  PlusIcon,
  EditIcon,
  XIcon
} from '../../Icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MdmManagement.css';

// Fix for default Leaflet marker icon assets in Vite bundler
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// High-speed Google Maps & OSM Tile Layers
const MAP_LAYERS = {
  googleStreets: {
    id: 'googleStreets',
    name: 'Google Maps',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    options: {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    }
  },
  googleHybrid: {
    id: 'googleHybrid',
    name: 'Satellite',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    options: {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    }
  },
  osm: {
    id: 'osm',
    name: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenStreetMap contributors'
    }
  }
};

// Battery Badge Component
const BatteryIndicator = ({ level, isCharging }) => {
  if (level === null || level === undefined) {
    return <span className="text-gray-400 text-xs font-mono">N/A</span>;
  }
  let tone = 'high';
  if (level <= 20) tone = 'low';
  else if (level <= 50) tone = 'medium';

  return (
    <span className={`battery-badge ${tone}`} title={`Battery: ${level}% ${isCharging ? '(Charging)' : ''}`}>
      {isCharging ? (
        <svg className="w-3 h-3 text-amber-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="6" width="17" height="12" rx="2" strokeWidth="2" />
          <path d="M21 10v4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {level}%
    </span>
  );
};

// Calculate distance between two lat/lng points using Haversine formula
const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MdmManagement = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('live-map'); // 'live-map' | 'devices' | 'route-history' | 'simulator'
  const [devices, setDevices] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Employees List for Enrollment & Reassignment
  const [employees, setEmployees] = useState([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [enrollForm, setEnrollForm] = useState({
    employeeId: '',
    deviceId: '',
    deviceModel: '',
    imei: '',
    macAddress: '',
    platform: 'android',
    notes: ''
  });
  const [enrollError, setEnrollError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History State
  const [historyEmpId, setHistoryEmpId] = useState('');
  const [historyDate, setHistoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Simulator / Test State
  const [simLat, setSimLat] = useState('23.8103');
  const [simLng, setSimLng] = useState('90.4125');
  const [simBattery, setSimBattery] = useState('85');
  const [simCharging, setSimCharging] = useState(false);
  const [simDeviceId, setSimDeviceId] = useState('TEST-ANDROID-001');
  const [simMessage, setSimMessage] = useState(null);

  // Map Layer Style: 'googleStreets' | 'googleHybrid' | 'osm'
  const [mapLayerType, setMapLayerType] = useState('googleStreets');
  const [historyMapLayerType, setHistoryMapLayerType] = useState('googleStreets');

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const liveTileLayerRef = useRef(null);

  const historyMapContainerRef = useRef(null);
  const historyMapInstanceRef = useRef(null);
  const historyPolylineRef = useRef(null);
  const historyMarkersGroupRef = useRef(null);
  const historyTileLayerRef = useRef(null);

  // ─── Fetch Devices ──────────────────────────────────────────────────────────
  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/mdm/devices');
      if (res.data?.success) {
        const fetched = res.data.devices || [];
        setDevices(fetched);
        if (fetched.length > 0) {
          setSimDeviceId(prev => (prev === 'TEST-ANDROID-001' ? fetched[0].deviceId : prev));
        }
      }
    } catch (err) {
      console.error('[MDM] Error fetching devices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Fetch Live Locations ───────────────────────────────────────────────────
  const fetchLiveLocations = useCallback(async () => {
    try {
      const res = await axios.get('/api/mdm/live-locations');
      if (res.data?.success) {
        setLiveLocations(res.data.locations || []);
      }
    } catch (err) {
      console.error('[MDM] Error fetching live locations:', err);
    }
  }, []);

  // ─── Fetch Employees List ───────────────────────────────────────────────────
  const fetchEmployeesList = useCallback(async () => {
    try {
      const res = await axios.get('/api/employees');
      if (Array.isArray(res.data)) {
        setEmployees(res.data);
      }
    } catch (err) {
      console.warn('[MDM] Could not load employees list:', err.message);
    }
  }, []);

  const generateSuggestedDeviceId = (empId) => {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return empId ? `MDM-${empId.replace(/[^a-zA-Z0-9]/g, '')}-${randomHex}` : `MDM-DEV-${randomHex}`;
  };

  const openEnrollModal = (deviceToEdit = null) => {
    setEnrollError(null);
    if (deviceToEdit) {
      setEditingDevice(deviceToEdit);
      setEnrollForm({
        employeeId: deviceToEdit.employeeId || '',
        deviceId: deviceToEdit.deviceId || '',
        deviceModel: deviceToEdit.deviceModel || 'Android Mobile',
        imei: deviceToEdit.imei || '',
        macAddress: deviceToEdit.macAddress || '',
        platform: deviceToEdit.platform || 'android',
        notes: deviceToEdit.notes || ''
      });
    } else {
      setEditingDevice(null);
      setEnrollForm({
        employeeId: '',
        deviceId: generateSuggestedDeviceId(),
        deviceModel: 'Android Mobile',
        imei: '',
        macAddress: '',
        platform: 'android',
        notes: ''
      });
    }
    setShowEnrollModal(true);
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setEnrollError(null);
    if (!enrollForm.deviceId.trim()) {
      setEnrollError('Device ID is required');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingDevice) {
        const res = await axios.put(`/api/mdm/devices/${editingDevice._id}`, {
          employeeId: enrollForm.employeeId || null,
          deviceModel: enrollForm.deviceModel,
          imei: enrollForm.imei,
          macAddress: enrollForm.macAddress,
          platform: enrollForm.platform,
          notes: enrollForm.notes
        });
        if (res.data?.success) {
          setShowEnrollModal(false);
          await fetchDevices();
          await fetchLiveLocations();
        }
      } else {
        const res = await axios.post('/api/mdm/devices/enroll', {
          employeeId: enrollForm.employeeId || null,
          deviceId: enrollForm.deviceId.trim(),
          deviceModel: enrollForm.deviceModel,
          imei: enrollForm.imei,
          macAddress: enrollForm.macAddress,
          platform: enrollForm.platform,
          notes: enrollForm.notes,
          status: 'approved'
        });
        if (res.data?.success) {
          setShowEnrollModal(false);
          await fetchDevices();
        }
      }
    } catch (err) {
      setEnrollError(err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initial Data Load & Socket Listeners
  useEffect(() => {
    fetchDevices();
    fetchLiveLocations();
    fetchEmployeesList();

    const socket = getSocket();
    if (!socket) return;

    const handleTelemetry = (data) => {
      // Update live locations list
      setLiveLocations(prev => {
        const idx = prev.findIndex(item => item.deviceId === data.deviceId);
        const updatedItem = {
          deviceId: data.deviceId,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          employeeEmpId: data.employeeEmpId,
          deviceModel: data.deviceModel,
          batteryLevel: data.batteryLevel,
          isCharging: data.isCharging,
          networkType: data.networkType,
          isOnline: true,
          lastSeen: data.lastSeen,
          lat: data.location?.lat,
          lng: data.location?.lng,
          accuracy: data.location?.accuracy,
          speed: data.location?.speed,
          heading: data.location?.heading,
          address: data.location?.address,
          updatedAt: data.lastSeen
        };

        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedItem;
          return next;
        } else if (data.location?.lat) {
          return [updatedItem, ...prev];
        }
        return prev;
      });

      // Update devices list
      setDevices(prev =>
        prev.map(d => {
          if (d.deviceId === data.deviceId) {
            return {
              ...d,
              batteryLevel: data.batteryLevel,
              isCharging: data.isCharging,
              networkType: data.networkType,
              isOnline: true,
              lastSeen: data.lastSeen,
              lastLocation: data.location || d.lastLocation
            };
          }
          return d;
        })
      );
    };

    const handleDeviceRegistered = () => {
      fetchDevices();
      fetchLiveLocations();
    };

    const handleStatusChanged = ({ deviceId, status }) => {
      setDevices(prev => prev.map(d => d.deviceId === deviceId ? { ...d, status } : d));
    };

    const handleDeviceUnbound = ({ deviceId }) => {
      setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
      setLiveLocations(prev => prev.filter(l => l.deviceId !== deviceId));
    };

    socket.on('mdm_telemetry', handleTelemetry);
    socket.on('mdm_device_registered', handleDeviceRegistered);
    socket.on('mdm_device_status_changed', handleStatusChanged);
    socket.on('mdm_device_unbound', handleDeviceUnbound);

    return () => {
      socket.off('mdm_telemetry', handleTelemetry);
      socket.off('mdm_device_registered', handleDeviceRegistered);
      socket.off('mdm_device_status_changed', handleStatusChanged);
      socket.off('mdm_device_unbound', handleDeviceUnbound);
    };
  }, [fetchDevices, fetchLiveLocations]);

  // ─── Initialize Live Map ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Detect if container changed (e.g. remounted) and safely dispose detached instance
    if (mapInstanceRef.current && mapInstanceRef.current.getContainer() !== mapContainerRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (_) {}
      mapInstanceRef.current = null;
    }

    if (!mapInstanceRef.current) {
      if (mapContainerRef.current._leaflet_id) {
        delete mapContainerRef.current._leaflet_id;
      }

      // Default center: Dhaka, Bangladesh or center of locations
      const map = L.map(mapContainerRef.current, {
        center: [23.8103, 90.4125],
        zoom: 12,
        zoomControl: true
      });

      const layerConfig = MAP_LAYERS[mapLayerType] || MAP_LAYERS.googleStreets;
      liveTileLayerRef.current = L.tileLayer(layerConfig.url, layerConfig.options).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    // Force map size refresh at multiple paint checkpoints when active
    const timers = [50, 150, 300, 600, 1000].map(delay =>
      setTimeout(() => {
        if (mapInstanceRef.current && activeTab === 'live-map') {
          mapInstanceRef.current.invalidateSize();
        }
      }, delay)
    );

    // Watch container size changes so flex/grid resizes or sidebar toggles never leave blank tiles
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current && activeTab === 'live-map') {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      timers.forEach(t => clearTimeout(t));
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [activeTab]);

  // Dynamic Live Map Layer Switcher (Google Maps, Satellite, OSM)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (liveTileLayerRef.current) {
      try {
        mapInstanceRef.current.removeLayer(liveTileLayerRef.current);
      } catch (_) {}
    }
    const layerConfig = MAP_LAYERS[mapLayerType] || MAP_LAYERS.googleStreets;
    liveTileLayerRef.current = L.tileLayer(layerConfig.url, layerConfig.options).addTo(mapInstanceRef.current);
  }, [mapLayerType]);

  // Clean up all map instances on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (_) {}
        mapInstanceRef.current = null;
      }
      if (historyMapInstanceRef.current) {
        try {
          historyMapInstanceRef.current.remove();
        } catch (_) {}
        historyMapInstanceRef.current = null;
      }
    };
  }, []);

  // ─── Render Live Map Markers ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'live-map' || !mapInstanceRef.current || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    const bounds = [];

    liveLocations.forEach(loc => {
      if (!loc.lat || !loc.lng) return;

      const initials = (loc.employeeName || 'EM')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const isMoving = loc.speed && loc.speed > 1;
      const batteryTone = (loc.batteryLevel <= 20) ? '#dc2626' : (loc.batteryLevel <= 50) ? '#d97706' : '#10b981';

      const customHtml = `
        <div class="marker-pin-wrapper">
          <div class="marker-avatar ${isMoving ? 'moving' : ''}">
            ${initials}
            <span class="marker-badge" style="background-color: ${batteryTone}">
              ${loc.batteryLevel !== null && loc.batteryLevel !== undefined ? `${loc.batteryLevel}%` : '•'}
            </span>
          </div>
          <div class="marker-pointer"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-mdm-marker',
        html: customHtml,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

      const lastSeenText = loc.lastSeen ? new Date(loc.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const speedText = loc.speed ? `${Math.round(loc.speed)} km/h` : 'Stationary';
      const accuracyText = loc.accuracy ? `±${Math.round(loc.accuracy)}m ${loc.accuracy <= 25 ? '🎯 (Pinpoint GPS)' : '(Approximate)'}` : 'GPS Active';
      const googleMapsUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

      marker.bindPopup(`
        <div style="font-family: inherit; min-width: 190px;">
          <h3 style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #0f172a;">${loc.employeeName || 'Unknown Employee'}</h3>
          <p style="margin: 0 0 6px; font-size: 11px; color: #64748b;">ID: ${loc.employeeEmpId || 'N/A'} • ${loc.deviceModel || 'Mobile'}</p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
            <span>Battery:</span>
            <strong>${loc.batteryLevel !== null ? `${loc.batteryLevel}%` : 'N/A'} ${loc.isCharging ? '⚡' : ''}</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-top: 4px;">
            <span>Speed:</span>
            <strong>${speedText}</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-top: 4px;">
            <span>Accuracy:</span>
            <strong style="color: ${loc.accuracy && loc.accuracy <= 25 ? '#059669' : '#334155'};">${accuracyText}</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-top: 4px;">
            <span>Last Ping:</span>
            <span style="color: #64748b;">${lastSeenText}</span>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center;">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; width: 100%; box-sizing: border-box; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 11px; font-weight: 600; padding: 5px 8px; border-radius: 4px;">
              📍 Open in Google Maps
            </a>
          </div>
        </div>
      `);

      // Add high-precision accuracy radius circle around the device marker
      if (loc.accuracy && loc.accuracy > 0) {
        const isPrecise = loc.accuracy <= 25;
        const circleColor = isPrecise ? '#10b981' : loc.accuracy <= 75 ? '#3b82f6' : '#f59e0b';
        const accuracyCircle = L.circle([loc.lat, loc.lng], {
          radius: loc.accuracy,
          color: circleColor,
          fillColor: circleColor,
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: isPrecise ? null : '4, 4'
        });
        markersGroupRef.current.addLayer(accuracyCircle);
      }

      markersGroupRef.current.addLayer(marker);
      bounds.push([loc.lat, loc.lng]);
    });

    if (bounds.length > 0 && !selectedDevice) {
      try {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } catch (_) {}
    }
  }, [liveLocations, activeTab, selectedDevice]);

  // Center on selected employee in live map
  const handleSelectEmployeeMap = (loc) => {
    setSelectedDevice(loc);
    if (mapInstanceRef.current && loc.lat && loc.lng) {
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.setView([loc.lat, loc.lng], 18, { animate: true });
    }
  };

  // Recenter / force refresh live map view
  const handleRecenterLiveMap = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
    const bounds = liveLocations.filter(l => l.lat && l.lng).map(l => [l.lat, l.lng]);
    if (bounds.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (_) {}
    } else {
      mapInstanceRef.current.setView([23.8103, 90.4125], 12);
    }
  };

  // ─── Fetch Route History ────────────────────────────────────────────────────
  const handleFetchHistory = async () => {
    if (!historyEmpId) return;
    try {
      setIsHistoryLoading(true);
      const startOfDay = `${historyDate}T00:00:00.000Z`;
      const endOfDay = `${historyDate}T23:59:59.999Z`;

      const res = await axios.get('/api/mdm/history', {
        params: {
          employeeId: historyEmpId,
          startDate: startOfDay,
          endDate: endOfDay,
          limit: 1500
        }
      });

      if (res.data?.success) {
        setHistoryLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error('[MDM] Error fetching history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // ─── Render Route History Polyline Map ──────────────────────────────────────
  useEffect(() => {
    if (!historyMapContainerRef.current) return;

    if (historyMapInstanceRef.current && historyMapInstanceRef.current.getContainer() !== historyMapContainerRef.current) {
      try {
        historyMapInstanceRef.current.remove();
      } catch (_) {}
      historyMapInstanceRef.current = null;
    }

    if (!historyMapInstanceRef.current) {
      if (historyMapContainerRef.current._leaflet_id) {
        delete historyMapContainerRef.current._leaflet_id;
      }

      const map = L.map(historyMapContainerRef.current, {
        center: [23.8103, 90.4125],
        zoom: 13,
        zoomControl: true
      });

      const layerConfig = MAP_LAYERS[historyMapLayerType] || MAP_LAYERS.googleStreets;
      historyTileLayerRef.current = L.tileLayer(layerConfig.url, layerConfig.options).addTo(map);

      historyMarkersGroupRef.current = L.layerGroup().addTo(map);
      historyMapInstanceRef.current = map;
    }

    const timers = [50, 150, 300, 600, 1000].map(delay =>
      setTimeout(() => {
        if (historyMapInstanceRef.current && activeTab === 'route-history') {
          historyMapInstanceRef.current.invalidateSize();
        }
      }, delay)
    );

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && historyMapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (historyMapInstanceRef.current && activeTab === 'route-history') {
          historyMapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(historyMapContainerRef.current);
    }

    return () => {
      timers.forEach(t => clearTimeout(t));
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [activeTab]);

  // Dynamic Route History Map Layer Switcher
  useEffect(() => {
    if (!historyMapInstanceRef.current) return;
    if (historyTileLayerRef.current) {
      try {
        historyMapInstanceRef.current.removeLayer(historyTileLayerRef.current);
      } catch (_) {}
    }
    const layerConfig = MAP_LAYERS[historyMapLayerType] || MAP_LAYERS.googleStreets;
    historyTileLayerRef.current = L.tileLayer(layerConfig.url, layerConfig.options).addTo(historyMapInstanceRef.current);
    if (historyPolylineRef.current && typeof historyPolylineRef.current.bringToFront === 'function') {
      try { historyPolylineRef.current.bringToFront(); } catch (_) {}
    }
  }, [historyMapLayerType]);

  // Update History Polyline when historyLogs change
  useEffect(() => {
    if (activeTab !== 'route-history' || !historyMapInstanceRef.current || !historyMarkersGroupRef.current) return;

    historyMarkersGroupRef.current.clearLayers();
    if (historyPolylineRef.current) {
      historyPolylineRef.current.remove();
      historyPolylineRef.current = null;
    }

    if (historyLogs.length === 0) return;

    const latLngs = historyLogs.map(l => [l.lat, l.lng]);

    // Draw route path
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      dashArray: null,
      lineJoin: 'round'
    }).addTo(historyMapInstanceRef.current);

    historyPolylineRef.current = polyline;

    // Start point marker (Green)
    const startLog = historyLogs[0];
    const startMarker = L.circleMarker([startLog.lat, startLog.lng], {
      radius: 9,
      fillColor: '#10b981',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1
    }).bindPopup(`<strong>Trip Start:</strong> ${new Date(startLog.timestamp).toLocaleTimeString()}<br/>Battery: ${startLog.batteryLevel || 'N/A'}%`);
    historyMarkersGroupRef.current.addLayer(startMarker);

    // End point marker (Red)
    const endLog = historyLogs[historyLogs.length - 1];
    const endMarker = L.circleMarker([endLog.lat, endLog.lng], {
      radius: 9,
      fillColor: '#ef4444',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1
    }).bindPopup(`<strong>Trip End:</strong> ${new Date(endLog.timestamp).toLocaleTimeString()}<br/>Battery: ${endLog.batteryLevel || 'N/A'}%`);
    historyMarkersGroupRef.current.addLayer(endMarker);

    // Fit map bounds to polyline
    historyMapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }, [historyLogs, activeTab]);

  // Calculate history stats
  const historyStats = useMemo(() => {
    if (historyLogs.length < 2) {
      return { totalDistanceKm: 0, points: historyLogs.length, durationMin: 0, batteryDrain: 0 };
    }
    let totalKm = 0;
    for (let i = 1; i < historyLogs.length; i++) {
      totalKm += haversineDistanceKm(
        historyLogs[i - 1].lat,
        historyLogs[i - 1].lng,
        historyLogs[i].lat,
        historyLogs[i].lng
      );
    }
    const startTime = new Date(historyLogs[0].timestamp).getTime();
    const endTime = new Date(historyLogs[historyLogs.length - 1].timestamp).getTime();
    const durationMin = Math.round((endTime - startTime) / (1000 * 60));

    const startBattery = historyLogs[0].batteryLevel;
    const endBattery = historyLogs[historyLogs.length - 1].batteryLevel;
    const batteryDrain = (startBattery !== null && endBattery !== null) ? Math.max(0, startBattery - endBattery) : 0;

    return {
      totalDistanceKm: totalKm.toFixed(2),
      points: historyLogs.length,
      durationMin,
      batteryDrain
    };
  }, [historyLogs]);

  // ─── Device Status Updates ──────────────────────────────────────────────────
  const handleUpdateDeviceStatus = async (id, newStatus) => {
    try {
      const res = await axios.patch(`/api/mdm/devices/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        setDevices(prev => prev.map(d => d._id === id ? { ...d, status: newStatus } : d));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Are you sure you want to unbind this device?')) return;
    try {
      const res = await axios.delete(`/api/mdm/devices/${id}`);
      if (res.data?.success) {
        setDevices(prev => prev.filter(d => d._id !== id));
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  // ─── Simulator Ping Trigger ─────────────────────────────────────────────────
  const handleSendSimulatedPing = async () => {
    setSimMessage(null);
    try {
      const payload = {
        deviceId: simDeviceId,
        batteryLevel: Number(simBattery),
        isCharging: Boolean(simCharging),
        networkType: 'cellular',
        isGpsEnabled: true,
        location: {
          lat: parseFloat(simLat),
          lng: parseFloat(simLng),
          speed: 15,
          accuracy: 5
        }
      };

      const res = await axios.post('/api/mdm/ping', payload);
      if (res.data?.success) {
        setSimMessage({ type: 'success', text: `Ping accepted at ${new Date().toLocaleTimeString()}!` });
        await fetchLiveLocations();
        await fetchDevices();
      }
    } catch (err) {
      setSimMessage({
        type: 'error',
        text: err.response?.data?.message || err.message
      });
    }
  };

  const [isPingingSelf, setIsPingingSelf] = useState(false);
  const [pingStatusMap, setPingStatusMap] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePingMyDeviceNow = async () => {
    setIsPingingSelf(true);
    try {
      const res = await mdmService.sendPing();
      if (res?.success) {
        showToast('Telemetry ping successfully sent from this device!', 'success');
      } else {
        showToast('Ping submitted. Refreshing registry...', 'success');
      }
      await fetchDevices();
      await fetchLiveLocations();
    } catch (e) {
      showToast('Ping error: ' + e.message, 'error');
    } finally {
      setIsPingingSelf(false);
    }
  };

  const handleTriggerDevicePing = async (device) => {
    try {
      setPingStatusMap(prev => ({ ...prev, [device._id]: 'pinging' }));
      await axios.post(`/api/mdm/devices/${device._id}/ping`);
      showToast(`Ping signal dispatched to ${device.deviceModel || device.deviceId}! Fresh telemetry incoming.`, 'success');
      setPingStatusMap(prev => ({ ...prev, [device._id]: 'dispatched' }));
      setTimeout(() => setPingStatusMap(prev => ({ ...prev, [device._id]: null })), 3000);
    } catch (err) {
      showToast(err.response?.data?.message || err.message, 'error');
      setPingStatusMap(prev => ({ ...prev, [device._id]: null }));
    }
  };

  const handleForcePingWithBrowserGps = async (device) => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported in this browser', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        setPingStatusMap(prev => ({ ...prev, [device._id]: 'updating' }));
        const payload = {
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 10,
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0
          },
          batteryLevel: device.batteryLevel !== null ? device.batteryLevel : 85,
          isCharging: device.isCharging,
          networkType: 'cellular'
        };
        const res = await axios.post(`/api/mdm/devices/${device._id}/emit-ping`, payload);
        if (res.data?.success) {
          await fetchDevices();
          await fetchLiveLocations();
          showToast(`Successfully updated telemetry for ${device.deviceModel || device.deviceId}!`, 'success');
        }
      } catch (e) {
        showToast(e.response?.data?.message || e.message, 'error');
      } finally {
        setPingStatusMap(prev => ({ ...prev, [device._id]: null }));
      }
    }, (err) => {
      showToast('Could not acquire GPS: ' + err.message, 'error');
    }, { enableHighAccuracy: true });
  };

  // Auto-detect browser location for simulator
  const handleUseBrowserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSimLat(pos.coords.latitude.toFixed(6));
          setSimLng(pos.coords.longitude.toFixed(6));
          setSimMessage({ type: 'success', text: 'Browser GPS coordinates acquired!' });
        },
        (err) => {
          setSimMessage({ type: 'error', text: `GPS error: ${err.message}` });
        }
      );
    } else {
      setSimMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
    }
  };

  // Filter devices by search
  const filteredDevices = useMemo(() => {
    if (!searchQuery) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter(d =>
      (d.employeeName && d.employeeName.toLowerCase().includes(q)) ||
      (d.employeeEmpId && d.employeeEmpId.toLowerCase().includes(q)) ||
      (d.deviceModel && d.deviceModel.toLowerCase().includes(q)) ||
      (d.deviceId && d.deviceId.toLowerCase().includes(q)) ||
      (d.imei && d.imei.toLowerCase().includes(q)) ||
      (d.macAddress && d.macAddress.toLowerCase().includes(q))
    );
  }, [devices, searchQuery]);

  return (
    <div className="mdm-container">
      {/* ─── Modern ERP Header Banner ────────────────────────────────────────── */}
      <div className="mdm-header-banner">
        <div className="mdm-header-text">
          <h1 className="mdm-header-title">
            <span style={{ fontSize: '1.5rem' }}>📱</span>
            <span>Mobile Device Management (MDM)</span>
          </h1>
          <p className="mdm-header-sub">
            Field Employee Tracking · Live GPS & Battery Telemetry · Android APK Fleet Management
          </p>
        </div>

        <div className="mdm-header-status">
          <div className="mdm-status-pill-header" title="Socket.IO real-time telemetry stream is active">
            <span className="mdm-live-dot" />
            <span>Telemetry Stream: Active</span>
          </div>
        </div>
      </div>

      {/* ─── Dedicated Navigation Tabs Bar ───────────────────────────────────── */}
      <div className="mdm-nav-tabs">
        <button
          onClick={() => setActiveTab('live-map')}
          className={`mdm-nav-tab ${activeTab === 'live-map' ? 'active' : ''}`}
        >
          <MapPinIcon className="w-4 h-4" />
          <span>Live Map</span>
          <span className="mdm-nav-tab-badge">{liveLocations.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`mdm-nav-tab ${activeTab === 'devices' ? 'active' : ''}`}
        >
          <UsersIcon className="w-4 h-4" />
          <span>Device Inventory</span>
          <span className="mdm-nav-tab-badge">{devices.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('route-history')}
          className={`mdm-nav-tab ${activeTab === 'route-history' ? 'active' : ''}`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Route History</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`mdm-nav-tab ${activeTab === 'simulator' ? 'active' : ''}`}
        >
          <ArrowUpRightIcon className="w-4 h-4" />
          <span>APK Bridge & Test</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mdm-content">
        {/* ─── TAB 1: LIVE MAP ────────────────────────────────────────────── */}
        <div className="mdm-map-layout" style={{ display: activeTab === 'live-map' ? 'grid' : 'none' }}>
          {/* Sidebar list of active employees */}
          <div className="mdm-sidebar-card">
            <div className="mdm-sidebar-header">
              <div className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search active field staff..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mdm-sidebar-list">
              {liveLocations.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No active device telemetry received yet.<br />
                  Use the <strong>APK Bridge & Test</strong> tab to send a test ping.
                </div>
              ) : (
                liveLocations
                  .filter(loc => !searchQuery || (loc.employeeName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((loc) => {
                    const isSelected = selectedDevice?.deviceId === loc.deviceId;
                    return (
                      <div
                        key={loc.deviceId}
                        onClick={() => handleSelectEmployeeMap(loc)}
                        className={`mdm-emp-item ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                            {(loc.employeeName || 'E').charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs font-semibold text-gray-900 truncate m-0">{loc.employeeName || 'Unknown Employee'}</p>
                            <p className="text-[10px] text-gray-500 truncate m-0">
                              {loc.deviceModel || 'Mobile'} • {loc.speed ? `${Math.round(loc.speed)} km/h` : 'Stopped'}{loc.accuracy ? ` • ±${Math.round(loc.accuracy)}m` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <BatteryIndicator level={loc.batteryLevel} isCharging={loc.isCharging} />
                          <div className="status-pill">
                            <span className={`status-dot ${loc.isOnline ? 'online' : 'offline'}`} />
                            <span className="text-[10px] text-gray-500">{loc.isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Interactive Leaflet Map View */}
          <div className="mdm-map-wrapper">
            {/* Map Layer Switcher (Google Maps / Satellite / OSM) */}
            <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 p-0.5 rounded-lg shadow-sm flex items-center gap-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMapLayerType('googleStreets')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  mapLayerType === 'googleStreets'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Google Maps
              </button>
              <button
                type="button"
                onClick={() => setMapLayerType('googleHybrid')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  mapLayerType === 'googleHybrid'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setMapLayerType('osm')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  mapLayerType === 'osm'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                OSM
              </button>
            </div>

            <button
              type="button"
              onClick={handleRecenterLiveMap}
              title="Recenter & Refresh Map"
              className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Recenter</span>
            </button>
            <div ref={mapContainerRef} className="mdm-map-container" />
          </div>
        </div>

        {/* ─── TAB 2: DEVICE REGISTRY TABLE ────────────────────────────────── */}
        {activeTab === 'devices' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col w-full max-w-full min-w-0">
            <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px]">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by employee, model or device ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePingMyDeviceNow}
                  disabled={isPingingSelf}
                  title="Send a live telemetry ping from this device now"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <MapPinIcon className="w-3.5 h-3.5" />
                  <span>{isPingingSelf ? 'Pinging...' : 'Ping From This Device'}</span>
                </button>

                <button
                  onClick={() => openEnrollModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Enroll Device</span>
                </button>

                <button
                  onClick={fetchDevices}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 text-xs font-medium rounded-md border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <RefreshIcon className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto w-full min-w-0">
              <table className="mdm-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Device & Model</th>
                    <th>IMEI</th>
                    <th>MAC Address</th>
                    <th>OS & App Version</th>
                    <th>Battery & Power</th>
                    <th>Network & GPS</th>
                    <th>Last Ping</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-10 text-gray-400">
                        No registered devices found.
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map(device => {
                      const isOnline = device.isOnline;
                      return (
                        <tr key={device._id}>
                          <td>
                            <div className="font-semibold text-gray-900">{device.employeeName || 'Unassigned'}</div>
                            <div className="text-[11px] text-gray-500">ID: {device.employeeEmpId || 'N/A'}</div>
                          </td>
                          <td>
                            <div className="font-medium text-gray-800">{device.deviceModel || 'Unknown Device'}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{device.deviceId}</div>
                          </td>
                          <td>
                            <div className="font-mono text-xs text-gray-800">
                              {device.imei ? (
                                <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 tracking-wider">
                                  {device.imei}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="font-mono text-xs text-gray-700">
                              {device.macAddress ? (
                                <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-wide">
                                  {device.macAddress}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="text-xs text-gray-700">{device.osVersion || 'Android'}</div>
                            <div className="text-[11px] text-gray-400">v{device.appVersion || '1.0.0'}</div>
                          </td>
                          <td>
                            <BatteryIndicator level={device.batteryLevel} isCharging={device.isCharging} />
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs capitalize text-gray-700">{device.networkType || 'Cellular'}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${device.isGpsEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {device.isGpsEnabled ? 'GPS ON' : 'GPS OFF'}
                                {device.lastLocation?.accuracy ? ` ±${Math.round(device.lastLocation.accuracy)}m` : ''}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                              <span className="text-xs text-gray-600">
                                {device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Never'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              device.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              device.status === 'suspended' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {device.status}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="inline-flex items-center gap-1">
                              {device.lastLocation?.lat && device.lastLocation?.lng ? (
                                <a
                                  href={`https://www.google.com/maps?q=${device.lastLocation.lat},${device.lastLocation.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Open in Google Maps (${device.lastLocation.lat.toFixed(5)}, ${device.lastLocation.lng.toFixed(5)})`}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded inline-flex items-center"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                                    <line x1="9" y1="3" x2="9" y2="18" />
                                    <line x1="15" y1="6" x2="15" y2="21" />
                                  </svg>
                                </a>
                              ) : (
                                <span title="No GPS location available" className="p-1 text-gray-300 cursor-not-allowed inline-flex items-center">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 opacity-40">
                                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                                    <line x1="9" y1="3" x2="9" y2="18" />
                                    <line x1="15" y1="6" x2="15" y2="21" />
                                  </svg>
                                </span>
                              )}
                              <button
                                onClick={() => handleTriggerDevicePing(device)}
                                title="Request Instant Ping from Phone (Socket)"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              >
                                <MapPinIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleForcePingWithBrowserGps(device)}
                                title="Update Device Telemetry with Current GPS"
                                className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                              >
                                <RefreshIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEnrollModal(device)}
                                title="Edit / Reassign Device"
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <EditIcon className="w-4 h-4" />
                              </button>
                              {device.status === 'approved' ? (
                                <button
                                  onClick={() => handleUpdateDeviceStatus(device._id, 'suspended')}
                                  title="Suspend Tracking"
                                  className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                                >
                                  <ShieldIcon className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateDeviceStatus(device._id, 'approved')}
                                  title="Approve Device"
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteDevice(device._id)}
                                title="Unbind Device"
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 3: ROUTE HISTORY PLAYBACK ───────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ display: activeTab === 'route-history' ? 'flex' : 'none' }}>
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Employee</label>
              <select
                value={historyEmpId}
                onChange={(e) => setHistoryEmpId(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose Employee --</option>
                {devices.map(d => (
                  <option key={d._id} value={d.employeeId}>
                    {d.employeeName || 'Unknown'} ({d.employeeEmpId || d.deviceModel})
                  </option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
              </input>
            </div>

            <div className="pt-5">
              <button
                onClick={handleFetchHistory}
                disabled={!historyEmpId || isHistoryLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <SearchIcon className="w-4 h-4" />
                <span>{isHistoryLoading ? 'Loading Route...' : 'View Route'}</span>
              </button>
            </div>
          </div>

          {/* Route Stats Summary */}
          {historyLogs.length > 0 && (
            <div className="history-stats-bar">
              <div className="stat-box">
                <div className="stat-label">Total Distance</div>
                <div className="stat-value text-blue-600">{historyStats.totalDistanceKm} km</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Trip Duration</div>
                <div className="stat-value text-slate-700">{historyStats.durationMin} mins</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">GPS Checkpoints</div>
                <div className="stat-value text-emerald-600">{historyStats.points} pings</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Battery Drain</div>
                <div className="stat-value text-amber-600">{historyStats.batteryDrain}%</div>
              </div>
            </div>
          )}

          {/* History Leaflet Map */}
          <div className="mdm-map-wrapper" style={{ minHeight: '520px' }}>
            {/* Map Layer Switcher for Route History */}
            <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 p-0.5 rounded-lg shadow-sm flex items-center gap-0.5 text-xs">
              <button
                type="button"
                onClick={() => setHistoryMapLayerType('googleStreets')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  historyMapLayerType === 'googleStreets'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Google Maps
              </button>
              <button
                type="button"
                onClick={() => setHistoryMapLayerType('googleHybrid')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  historyMapLayerType === 'googleHybrid'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Satellite
              </button>
              <button
                type="button"
                onClick={() => setHistoryMapLayerType('osm')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  historyMapLayerType === 'osm'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                OSM
              </button>
            </div>
            <div ref={historyMapContainerRef} className="mdm-map-container" />
          </div>
        </div>

        {/* ─── TAB 4: APK BRIDGE & TEST SIMULATOR ──────────────────────────── */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Live Telemetry Ping Simulator */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-base font-bold text-gray-900 mb-1">Live Telemetry Simulator</h2>
              <p className="text-xs text-gray-500 mb-5">
                Test real-time location and battery telemetry right now without waiting for APK packaging.
              </p>

              {simMessage && (
                <div className={`p-3 rounded-lg text-xs mb-4 ${simMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {simMessage.text}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Target Device</label>
                  <select
                    value={simDeviceId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSimDeviceId(val);
                      const d = devices.find(x => x.deviceId === val);
                      if (d) {
                        if (d.lastLocation?.lat) {
                          setSimLat(String(d.lastLocation.lat));
                          setSimLng(String(d.lastLocation.lng));
                        }
                        if (d.batteryLevel !== null && d.batteryLevel !== undefined) {
                          setSimBattery(String(d.batteryLevel));
                        }
                        if (d.isCharging !== undefined) {
                          setSimCharging(Boolean(d.isCharging));
                        }
                      }
                    }}
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md bg-gray-50 mb-2 font-medium"
                  >
                    <option value="">-- Choose from Enrolled Devices --</option>
                    {devices.map(d => (
                      <option key={d._id} value={d.deviceId}>
                        {d.deviceModel || 'Mobile'} — {d.employeeName || 'Unassigned'} ({d.deviceId})
                      </option>
                    ))}
                  </select>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Device ID / Hardware Identifier</label>
                  <input
                    type="text"
                    value={simDeviceId}
                    onChange={(e) => setSimDeviceId(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md font-mono"
                  />
                  <span className="text-[10px] text-gray-400">Must match a registered device ID in the registry</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
                    <input
                      type="text"
                      value={simLat}
                      onChange={(e) => setSimLat(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
                    <input
                      type="text"
                      value={simLng}
                      onChange={(e) => setSimLng(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Battery Level (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={simBattery}
                      onChange={(e) => setSimBattery(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Charging State</label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 mt-2">
                      <input
                        type="checkbox"
                        checked={simCharging}
                        onChange={(e) => setSimCharging(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span>Is AC/USB Plugged In</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleUseBrowserLocation}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md"
                  >
                    Acquire My Current GPS
                  </button>
                  <button
                    type="button"
                    onClick={handleSendSimulatedPing}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm"
                  >
                    Emit Live Telemetry Ping
                  </button>
                </div>
              </div>
            </div>

            {/* Android APK Setup Guide & Instructions */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">Android APK Generation Guide</h2>
                <p className="text-xs text-gray-500 mb-4">
                  How the APK enables 24/7 background geolocation and battery monitoring.
                </p>

                <div className="space-y-3 text-xs text-gray-600">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800 mb-1">1. Capacitor Native Bridge</div>
                    Capacitor builds the Android Studio workspace from your `client/dist` directory using `@capacitor/android`.
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800 mb-1">2. Foreground Location Service</div>
                    Runs an unkillable Android foreground notification (*"Field Attendance Active"*) allowing GPS pings even when the screen is locked or asleep.
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800 mb-1">3. Native Battery API</div>
                    Android `BatteryManager` reports exact battery percentage (0-100%) and charging state to the ERP backend every 2-5 minutes.
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 text-[11px] text-gray-500">
                Ready to compile the APK? Next step configures Capacitor CLI & Android Manifest permissions.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── ENROLL / EDIT DEVICE MODAL ────────────────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                  <UsersIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 m-0">
                  {editingDevice ? 'Edit Device Assignment' : 'Enroll New Mobile Device'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200/60"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEnrollSubmit} className="p-5 space-y-4">
              {enrollError && (
                <div className="p-3 rounded-lg text-xs bg-rose-50 text-rose-700 border border-rose-200">
                  {enrollError}
                </div>
              )}

              {/* Select Employee */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign to Employee <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={enrollForm.employeeId}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const matched = employees.find(emp => (emp._id || emp.id) === empId);
                    setEnrollForm(prev => ({
                      ...prev,
                      employeeId: empId,
                      deviceId: (!editingDevice && (!prev.deviceId || prev.deviceId.startsWith('MDM-')))
                        ? generateSuggestedDeviceId(matched?.employeeId || matched?.empId || '')
                        : prev.deviceId
                    }));
                  }}
                  className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Standalone / Unassigned Device --</option>
                  {employees.map(emp => {
                    const id = emp._id || emp.id;
                    return (
                      <option key={id} value={id}>
                        {emp.name || 'Unnamed'} {emp.employeeId || emp.empId ? `(${emp.employeeId || emp.empId})` : ''} {emp.designation ? `• ${emp.designation}` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Links this hardware device to the chosen employee for GPS & battery reporting.
                </p>
              </div>

              {/* Device ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Device Identifier (ID / IMEI / Tag) <span className="text-rose-500">*</span>
                  </label>
                  {!editingDevice && (
                    <button
                      type="button"
                      onClick={() => setEnrollForm(prev => ({ ...prev, deviceId: generateSuggestedDeviceId() }))}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Generate Tag
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={!!editingDevice}
                  value={enrollForm.deviceId}
                  onChange={(e) => setEnrollForm({ ...enrollForm, deviceId: e.target.value })}
                  placeholder="e.g. MDM-EMP101-7A3 or Hardware IMEI"
                  className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Unique hardware tag used by the mobile APK to transmit telemetry.
                </p>
              </div>

              {/* Device Model & Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Device Model
                  </label>
                  <input
                    type="text"
                    value={enrollForm.deviceModel}
                    onChange={(e) => setEnrollForm({ ...enrollForm, deviceModel: e.target.value })}
                    placeholder="e.g. Samsung Galaxy A54"
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Platform
                  </label>
                  <select
                    value={enrollForm.platform}
                    onChange={(e) => setEnrollForm({ ...enrollForm, platform: e.target.value })}
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="android">Android</option>
                    <option value="ios">Apple iOS</option>
                    <option value="web">Web / Simulator</option>
                  </select>
                </div>
              </div>

              {/* Hardware Identifiers: IMEI & MAC Address */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    IMEI Number <span className="text-gray-400 font-normal">(15 digits)</span>
                  </label>
                  <input
                    type="text"
                    maxLength="18"
                    value={enrollForm.imei || ''}
                    onChange={(e) => setEnrollForm({ ...enrollForm, imei: e.target.value })}
                    placeholder="e.g. 860123456789012"
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    MAC Address
                  </label>
                  <input
                    type="text"
                    maxLength="20"
                    value={enrollForm.macAddress || ''}
                    onChange={(e) => setEnrollForm({ ...enrollForm, macAddress: e.target.value })}
                    placeholder="e.g. B4:F1:DA:22:9C:31"
                    className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Notes / Assignment Details */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Notes & Assignment Details <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={enrollForm.notes}
                  onChange={(e) => setEnrollForm({ ...enrollForm, notes: e.target.value })}
                  placeholder="e.g. Sales Officer - Chittagong Branch, Vehicle #2"
                  className="w-full text-xs py-2 px-3 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingDevice ? 'Save Changes' : 'Enroll Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Sleek Floating Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border transition-all pointer-events-none ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/20' : 'bg-rose-600 text-white border-rose-500 shadow-rose-900/20'
        }`}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default MdmManagement;

