/**
 * MDM & Mobile Tracking Service (Web & Native APK Compatible)
 * 
 * - Handles device registration, GPS continuous/on-demand tracking, and battery telemetry.
 * - Supports native Capacitor APK environment with ES modules and web fallback.
 * - Listens for server-initiated 'mdm_ping_request' socket events to emit instant telemetry.
 */

import axios from './api';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';
import { getSocket } from './socket';

const DEVICE_ID_KEY = 'erp_mdm_device_id';
const TRACKING_ENABLED_KEY = 'erp_mdm_tracking_enabled';

// Get or generate a persistent unique device ID for this phone/app
export const getOrCreateDeviceId = () => {
  let deviceId = null;
  if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.getDeviceId === 'function') {
    try {
      const nativeId = window.AndroidBridge.getDeviceId();
      if (nativeId && nativeId.trim()) deviceId = nativeId.trim();
    } catch (_) {}
  }
  if (!deviceId && typeof localStorage !== 'undefined') {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
  }
  if (!deviceId) {
    // Generate UUID-like unique identifier
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  }
  if (typeof localStorage !== 'undefined' && deviceId) {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

class MdmService {
  constructor() {
    this.deviceId = getOrCreateDeviceId();
    this.isTracking = false;
    this.pingInterval = null;
    this.watchId = null;
    this.lastLocation = null;
    this.batteryInfo = { level: null, isCharging: false };
    this.currentUser = null;

    // Attach socket listener for on-demand ping requests from dashboard
    this.setupSocketListener();
  }

  get isNative() {
    return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && !!window.AndroidBridge);
  }

  setupSocketListener() {
    try {
      const socket = getSocket();
      if (socket) {
        socket.on('mdm_ping_request', async (data) => {
          if (!data?.deviceId || data.deviceId === this.deviceId) {
            console.log('[MDM] Received on-demand ping request from server');
            await this.sendPing();
          }
        });
      }
    } catch (_) {}
  }

  // Detect battery percentage and charging state via Capacitor Device or Web Battery API
  async getBatteryStatus() {
    try {
      if (this.isNative) {
        const info = await Device.getBatteryInfo();
        return {
          level: (info.batteryLevel !== undefined && info.batteryLevel !== null)
            ? Math.round(info.batteryLevel * 100)
            : null,
          isCharging: Boolean(info.isCharging)
        };
      } else if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
        const battery = await navigator.getBattery();
        return {
          level: Math.round(battery.level * 100),
          isCharging: Boolean(battery.charging)
        };
      }
    } catch (e) {
      console.warn('[MDM] Battery status detection:', e.message);
    }
    return { level: null, isCharging: false };
  }

  // Detect network connection type (cellular, wifi, none)
  async getNetworkType() {
    try {
      if (this.isNative) {
        const status = await Network.getStatus();
        return status.connectionType || (status.connected ? 'cellular' : 'none');
      }
    } catch (_) {}
    return (typeof navigator !== 'undefined' && navigator.onLine) ? 'cellular' : 'none';
  }

  // Request all permissions explicitly
  async requestPermissions() {
    if (this.isNative) {
      try {
        const status = await Geolocation.requestPermissions();
        return status;
      } catch (err) {
        console.warn('[MDM] Geolocation.requestPermissions error:', err);
      }
    }
    return null;
  }

  // Intelligently update location, preserving high-accuracy GPS fixes over coarse network approximations
  updateLocation(coords) {
    if (!coords || typeof coords.latitude !== 'number') return;
    const now = Date.now();
    const newLoc = {
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy || null,
      speed: coords.speed ? Math.round(coords.speed * 3.6) : 0,
      heading: coords.heading || null,
      altitude: coords.altitude || null,
      timestamp: now
    };

    if (!this.lastLocation) {
      this.lastLocation = newLoc;
      return;
    }

    const timeDiff = now - (this.lastLocation.timestamp || 0);
    const prevAcc = this.lastLocation.accuracy || 9999;
    const newAcc = newLoc.accuracy || 9999;

    // Favor high accuracy: never allow a coarse reading (e.g. 500m cell tower) to overwrite a pinpoint GPS fix (< 30m) within 3 minutes
    if (newAcc <= prevAcc || timeDiff > 180000 || (timeDiff > 30000 && newAcc <= 35)) {
      this.lastLocation = newLoc;
    }
  }

  // Actively query current GPS position (forces fresh satellite fix with maximumAge: 0)
  async acquireCurrentLocation() {
    if (this.isNative) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
        if (pos && pos.coords) {
          this.updateLocation(pos.coords);
        }
      } catch (e) {
        console.warn('[MDM] Native getCurrentPosition:', e.message);
      }
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (pos && pos.coords) {
                this.updateLocation(pos.coords);
              }
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
      } catch (_) {}
    }
    return this.lastLocation;
  }

  // Register device with ERP backend
  async registerDevice(user = null) {
    try {
      const activeUser = user || this.currentUser;
      const battery = await this.getBatteryStatus();
      const networkType = await this.getNetworkType();
      let deviceModel = 'Web Browser / Hybrid';
      let osVersion = 'Unknown';
      let platform = 'web';
      let manufacturer = '';

      if (this.isNative) {
        try {
          const info = await Device.getInfo();
          manufacturer = info.manufacturer || '';
          deviceModel = `${info.manufacturer || ''} ${info.model || ''}`.trim() || 'Android Device';
          osVersion = `${info.operatingSystem || 'Android'} ${info.osVersion || ''}`.trim();
          platform = info.platform || 'android';
        } catch (e) {
          console.warn('[MDM] Device.getInfo:', e.message);
        }
      } else if (typeof navigator !== 'undefined') {
        if (/android/i.test(navigator.userAgent)) {
          platform = 'android';
          deviceModel = 'Android Mobile';
        } else if (/iphone|ipad/i.test(navigator.userAgent)) {
          platform = 'ios';
          deviceModel = 'iOS Device';
        }
      }

      const payload = {
        deviceId: this.deviceId,
        deviceModel,
        manufacturer,
        osVersion,
        platform,
        appVersion: '1.0.0',
        batteryLevel: battery.level,
        isCharging: battery.isCharging,
        networkType,
        employeeId: activeUser?.id || activeUser?._id || null,
        employeeName: activeUser?.name || null,
        employeeEmpId: activeUser?.username || null
      };

      const res = await axios.post('/api/mdm/register', payload);
      return res.data;
    } catch (err) {
      console.warn('[MDM] Registration failed:', err.message);
      return null;
    }
  }

  // Send single telemetry ping
  async sendPing() {
    try {
      const [battery, networkType] = await Promise.all([
        this.getBatteryStatus(),
        this.getNetworkType()
      ]);

      // Acquire fresh location snapshot
      await this.acquireCurrentLocation();

      const payload = {
        deviceId: this.deviceId,
        batteryLevel: battery.level,
        isCharging: battery.isCharging,
        networkType,
        isGpsEnabled: !!this.lastLocation,
        trackingPermission: 'granted',
        location: this.lastLocation
      };

      console.log('[MDM] Sending ping for device:', this.deviceId, 'battery:', battery.level, 'hasLocation:', !!this.lastLocation);
      const res = await axios.post('/api/mdm/ping', payload);
      return res.data;
    } catch (err) {
      console.warn('[MDM] Ping error:', err.message);
      return null;
    }
  }

  // Start background location watching and periodic telemetry transmission
  async startTracking(intervalMs = 30000, enableGps = true, user = null) {
    if (user) {
      this.currentUser = user;
    }

    if (this.isTracking && this.pingInterval) {
      // Already running, just ensure ping
      this.sendPing();
      return;
    }

    this.isTracking = true;

    // Clear existing timer if any
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Configure native Android Foreground Service for 24/7 background tracking (works when screen is off / phone sleeping)
    const hasNativeBridge = typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.updateConfig === 'function';
    if (hasNativeBridge) {
      try {
        const serverUrl = localStorage.getItem('erp_server_url') || 'http://192.168.0.27:5000';
        window.AndroidBridge.updateConfig(
          serverUrl,
          this.deviceId,
          String(this.currentUser?.id || this.currentUser?._id || ''),
          String(this.currentUser?.name || ''),
          String(this.currentUser?.username || '')
        );
      } catch (err) {
        console.warn('[MDM] AndroidBridge.updateConfig error:', err);
      }
      // When native Android service is handling 24/7 background telemetry, avoid running duplicate
      // high-accuracy GPS watch loops in the WebView to keep the UI smooth and responsive.
      return;
    }

    // Web / non-bridge environment fallback:
    this.registerDevice(this.currentUser).finally(() => {
      if (this.isTracking) {
        this.sendPing();
      }
    });

    // Continuous watch position on native mobile
    if (this.isNative) {
      try {
        await Geolocation.requestPermissions();
        const watchCallback = (position, err) => {
          if (position && position.coords) {
            this.updateLocation(position.coords);
          } else if (err) {
            console.warn('[MDM] Native watch callback:', err);
          }
        };

        this.watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          watchCallback
        );
      } catch (e) {
        console.warn('[MDM] Native Geolocation setup failed:', e);
      }
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        this.watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (position && position.coords) {
              this.updateLocation(position.coords);
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
      } catch (_) {}
    }

    // Periodic Ping Timer (default: every 30 seconds)
    this.pingInterval = setInterval(() => {
      if (this.isTracking) {
        this.sendPing();
      }
    }, intervalMs);
  }

  // Stop tracking
  stopTracking() {
    this.isTracking = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TRACKING_ENABLED_KEY);
    }

    if (typeof window !== 'undefined' && window.AndroidBridge && typeof window.AndroidBridge.stopService === 'function') {
      try {
        window.AndroidBridge.stopService();
      } catch (_) {}
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.watchId !== null) {
      if (this.isNative) {
        try {
          Geolocation.clearWatch({ id: this.watchId });
        } catch (_) {}
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(this.watchId);
        } catch (_) {}
      }
      this.watchId = null;
    }
  }
}

export const mdmService = new MdmService();
export default mdmService;
