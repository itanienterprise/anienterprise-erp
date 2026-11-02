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
  let deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
  if (!deviceId) {
    // Generate UUID-like unique identifier
    deviceId = 'DEV-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
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

  // Actively query current GPS position (works even when stationary)
  async acquireCurrentLocation() {
    if (this.isNative) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        });
        if (pos && pos.coords) {
          this.lastLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || null,
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
            heading: pos.coords.heading || null,
            altitude: pos.coords.altitude || null
          };
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
                this.lastLocation = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy || null,
                  speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
                  heading: pos.coords.heading || null,
                  altitude: pos.coords.altitude || null
                };
              }
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
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

    // Register on start with active user, then send initial ping
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
            this.lastLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy || null,
              speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0,
              heading: position.coords.heading || null,
              altitude: position.coords.altitude || null
            };
          } else if (err) {
            console.warn('[MDM] Native watch callback:', err);
          }
        };

        this.watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
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
              this.lastLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy || null,
                speed: position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0,
                heading: position.coords.heading || null,
                altitude: position.coords.altitude || null
              };
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
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
