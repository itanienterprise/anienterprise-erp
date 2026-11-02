const express = require('express');
const router = express.Router();
const DeviceRegistry = require('../models/DeviceRegistry');
const DeviceLocationLog = require('../models/DeviceLocationLog');
const Employee = require('../models/Employee');
const { decryptData } = require('../utils/encryption');

// Helper to safely decrypt employee data
const decryptEmployee = (empDoc) => {
  if (!empDoc || !empDoc.data) return null;
  try {
    let d = decryptData(empDoc.data);
    if (d && typeof d === 'object' && d.data) {
      try { d = decryptData(d.data); } catch (_) {}
    }
    return d;
  } catch (err) {
    return null;
  }
};

module.exports = function createMdmRouter(io) {
  // Middleware to ensure user is authenticated for management endpoints
  const requireAdminAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Session required' });
    }
    next();
  };

  // 1. Register or update a mobile device
  router.post('/register', async (req, res) => {
    try {
      const {
        deviceId,
        deviceModel,
        manufacturer,
        osVersion,
        platform,
        appVersion,
        batteryLevel,
        isCharging,
        networkType,
        employeeId: explicitEmployeeId
      } = req.body;

      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId is required' });
      }

      // Check if device already exists with an admin-assigned employee in DB
      const existingDevice = await DeviceRegistry.findOne({ deviceId });

      let employeeId = explicitEmployeeId || (existingDevice?.employeeId ? existingDevice.employeeId : null);
      let employeeName = (existingDevice?.employeeId && existingDevice?.employeeName && existingDevice.employeeName !== 'Administrator' && existingDevice.employeeName !== 'Unassigned')
        ? existingDevice.employeeName
        : '';
      let employeeEmpId = (existingDevice?.employeeId && existingDevice?.employeeEmpId) ? existingDevice.employeeEmpId : '';

      // If not yet assigned, resolve employee from request body or session
      if (!employeeName) {
        const username = req.body.employeeEmpId || req.session?.user?.username || '';
        const userDispName = (req.body.employeeName || req.session?.user?.name || '').trim();

        const allEmps = await Employee.find();
        for (const emp of allEmps) {
          const dec = decryptEmployee(emp);
          if (dec && (
            (dec.employeeId && dec.employeeId === username) ||
            (dec.empId && dec.empId === username) ||
            (dec.name && userDispName && dec.name.toLowerCase() === userDispName.toLowerCase()) ||
            (dec.name && username && dec.name.toLowerCase() === username.toLowerCase()) ||
            (dec.email && req.session?.user?.email && dec.email.toLowerCase() === req.session.user.email.toLowerCase())
          )) {
            employeeId = emp._id;
            employeeName = dec.name;
            employeeEmpId = dec.employeeId || dec.empId || '';
            break;
          }
        }

        // If no Employee doc matches and explicit employeeId provided
        if (!employeeName && employeeId) {
          const emp = await Employee.findById(employeeId);
          if (emp) {
            const dec = decryptEmployee(emp);
            if (dec) {
              employeeName = dec.name || '';
              employeeEmpId = dec.employeeId || dec.empId || '';
            }
          }
        }

        // Fallback to logged-in user or default
        if (!employeeName) {
          employeeName = userDispName || username || 'Administrator';
          employeeEmpId = username || 'admin';
        }
      }

      const updateData = {
        employeeId: employeeId || null,
        employeeName,
        employeeEmpId,
        deviceModel: deviceModel || 'Unknown Device',
        manufacturer: manufacturer || '',
        osVersion: osVersion || '',
        platform: platform || 'android',
        appVersion: appVersion || '1.0.0',
        lastSeen: new Date(),
        isOnline: true
      };

      if (req.body.imei !== undefined) {
        updateData.imei = req.body.imei ? String(req.body.imei).trim() : '';
      }
      if (req.body.macAddress !== undefined) {
        updateData.macAddress = req.body.macAddress ? String(req.body.macAddress).trim() : '';
      }

      if (batteryLevel !== undefined && batteryLevel !== null) {
        updateData.batteryLevel = Number(batteryLevel);
      }
      if (isCharging !== undefined) {
        updateData.isCharging = Boolean(isCharging);
      }
      if (networkType) {
        updateData.networkType = networkType;
      }

      const device = await DeviceRegistry.findOneAndUpdate(
        { deviceId },
        { $set: updateData },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (io) {
        io.emit('mdm_device_registered', {
          deviceId: device.deviceId,
          employeeId: device.employeeId,
          employeeName: device.employeeName,
          deviceModel: device.deviceModel,
          status: device.status,
          isOnline: true
        });
      }

      return res.json({
        success: true,
        message: 'Device registered successfully',
        device
      });
    } catch (err) {
      console.error('[MDM] Register Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 2. Ingest telemetry (Location, Battery, Network, Speed)
  router.post('/ping', async (req, res) => {
    try {
      const {
        deviceId,
        batteryLevel,
        isCharging,
        networkType,
        isGpsEnabled,
        trackingPermission,
        location // { lat, lng, accuracy, speed, heading, altitude }
      } = req.body;

      if (!deviceId) {
        return res.status(400).json({ success: false, message: 'deviceId is required' });
      }

      let device = await DeviceRegistry.findOne({ deviceId });
      if (!device) {
        // Auto-provision device on initial ping
        let employeeName = 'Field Staff / Simulator';
        let employeeEmpId = 'STAFF-01';
        let employeeId = null;

        if (req.session && req.session.user) {
          employeeName = req.session.user.name || req.session.user.username || 'System User';
          employeeEmpId = req.session.user.username || 'STAFF';
        }

        device = new DeviceRegistry({
          deviceId,
          employeeId,
          employeeName,
          employeeEmpId,
          deviceModel: 'Android Mobile',
          platform: 'android',
          status: 'approved',
          lastSeen: new Date(),
          isOnline: true
        });
      }

      if (device.status === 'revoked' || device.status === 'suspended') {
        return res.status(403).json({
          success: false,
          status: device.status,
          message: `Device tracking is ${device.status}`
        });
      }

      const now = new Date();
      device.lastSeen = now;
      device.isOnline = true;

      if (req.body.imei) {
        device.imei = String(req.body.imei).trim();
      }
      if (req.body.macAddress) {
        device.macAddress = String(req.body.macAddress).trim();
      }

      if (batteryLevel !== undefined && batteryLevel !== null) {
        device.batteryLevel = Math.max(0, Math.min(100, Math.round(Number(batteryLevel))));
      }
      if (isCharging !== undefined) {
        device.isCharging = Boolean(isCharging);
      }
      if (networkType) {
        device.networkType = networkType;
      }
      if (isGpsEnabled !== undefined) {
        device.isGpsEnabled = Boolean(isGpsEnabled);
      }
      if (trackingPermission) {
        device.trackingPermission = trackingPermission;
      }

      let hasValidCoords = false;
      if (
        location &&
        typeof location.lat === 'number' &&
        typeof location.lng === 'number' &&
        !isNaN(location.lat) &&
        !isNaN(location.lng)
      ) {
        hasValidCoords = true;
        device.lastLocation = {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy || null,
          speed: location.speed || null,
          heading: location.heading || null,
          address: location.address || device.lastLocation?.address || '',
          updatedAt: now
        };

        // Create log entry for breadcrumbs
        await DeviceLocationLog.create({
          employeeId: device.employeeId,
          employeeName: device.employeeName,
          deviceId: device.deviceId,
          coordinates: {
            lat: location.lat,
            lng: location.lng
          },
          accuracy: location.accuracy || null,
          speed: location.speed || null,
          heading: location.heading || null,
          altitude: location.altitude || null,
          batteryLevel: device.batteryLevel,
          isCharging: device.isCharging,
          networkType: device.networkType,
          address: location.address || '',
          timestamp: now
        });
      }

      await device.save();

      // Real-time broadcast to all connected HR/Admin dashboards via Socket.IO
      if (io) {
        io.emit('mdm_telemetry', {
          deviceId: device.deviceId,
          employeeId: device.employeeId,
          employeeName: device.employeeName,
          employeeEmpId: device.employeeEmpId,
          deviceModel: device.deviceModel,
          batteryLevel: device.batteryLevel,
          isCharging: device.isCharging,
          networkType: device.networkType,
          isGpsEnabled: device.isGpsEnabled,
          isOnline: true,
          lastSeen: now,
          location: hasValidCoords ? device.lastLocation : null
        });
      }

      return res.json({
        success: true,
        recorded: true,
        status: device.status,
        timestamp: now
      });
    } catch (err) {
      console.error('[MDM] Ping Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 3. Get all registered devices with live status
  router.get('/devices', requireAdminAuth, async (req, res) => {
    try {
      const devices = await DeviceRegistry.find().sort({ lastSeen: -1 }).lean();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Enhance with dynamic online flag
      const enhanced = devices.map(d => ({
        ...d,
        isOnline: d.lastSeen ? new Date(d.lastSeen) >= fiveMinutesAgo : false
      }));

      return res.json({ success: true, count: enhanced.length, devices: enhanced });
    } catch (err) {
      console.error('[MDM] Fetch Devices Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Get current live locations for map view
  router.get('/live-locations', requireAdminAuth, async (req, res) => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const devices = await DeviceRegistry.find({
        status: 'approved',
        'lastLocation.lat': { $ne: null }
      }).lean();

      const liveLocations = devices.map(d => ({
        deviceId: d.deviceId,
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        employeeEmpId: d.employeeEmpId,
        deviceModel: d.deviceModel,
        batteryLevel: d.batteryLevel,
        isCharging: d.isCharging,
        networkType: d.networkType,
        isOnline: d.lastSeen ? new Date(d.lastSeen) >= fiveMinutesAgo : false,
        lastSeen: d.lastSeen,
        lat: d.lastLocation.lat,
        lng: d.lastLocation.lng,
        accuracy: d.lastLocation.accuracy,
        speed: d.lastLocation.speed,
        heading: d.lastLocation.heading,
        address: d.lastLocation.address,
        updatedAt: d.lastLocation.updatedAt
      }));

      return res.json({ success: true, count: liveLocations.length, locations: liveLocations });
    } catch (err) {
      console.error('[MDM] Fetch Live Locations Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Get historical location breadcrumbs for route playback
  router.get('/history', requireAdminAuth, async (req, res) => {
    try {
      const { employeeId, deviceId, startDate, endDate, limit = 1000 } = req.query;

      const query = {};
      if (employeeId) query.employeeId = employeeId;
      if (deviceId) query.deviceId = deviceId;

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      } else {
        // Default to today (last 24 hours)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        query.timestamp = { $gte: startOfDay };
      }

      const logs = await DeviceLocationLog.find(query)
        .sort({ timestamp: 1 })
        .limit(Math.min(2000, Number(limit)))
        .lean();

      return res.json({
        success: true,
        count: logs.length,
        logs: logs.map(l => ({
          id: l._id,
          employeeId: l.employeeId,
          employeeName: l.employeeName,
          deviceId: l.deviceId,
          lat: l.coordinates.lat,
          lng: l.coordinates.lng,
          accuracy: l.accuracy,
          speed: l.speed,
          heading: l.heading,
          batteryLevel: l.batteryLevel,
          isCharging: l.isCharging,
          timestamp: l.timestamp
        }))
      });
    } catch (err) {
      console.error('[MDM] Fetch History Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. Enroll / Add device and assign to employee manually by Admin
  router.post('/devices/enroll', requireAdminAuth, async (req, res) => {
    try {
      const {
        employeeId,
        deviceId,
        deviceModel,
        manufacturer,
        imei = '',
        macAddress = '',
        platform = 'android',
        notes = '',
        status = 'approved'
      } = req.body;

      if (!deviceId || !deviceId.trim()) {
        return res.status(400).json({ success: false, message: 'Device ID is required' });
      }

      const cleanDeviceId = deviceId.trim();

      // Check if deviceId already exists
      const existing = await DeviceRegistry.findOne({ deviceId: cleanDeviceId });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Device ID "${cleanDeviceId}" is already enrolled for ${existing.employeeName || 'another employee'}.`
        });
      }

      let employeeName = 'Unassigned';
      let employeeEmpId = '';

      if (employeeId) {
        const emp = await Employee.findById(employeeId);
        if (emp) {
          const dec = decryptEmployee(emp);
          if (dec) {
            employeeName = dec.name || '';
            employeeEmpId = dec.employeeId || dec.empId || '';
          }
        }
      }

      const newDevice = await DeviceRegistry.create({
        deviceId: cleanDeviceId,
        employeeId: employeeId || null,
        employeeName,
        employeeEmpId,
        deviceModel: deviceModel || 'Android Mobile',
        manufacturer: manufacturer || '',
        imei: imei ? String(imei).trim() : '',
        macAddress: macAddress ? String(macAddress).trim() : '',
        platform: platform || 'android',
        status: status || 'approved',
        notes: notes || '',
        lastSeen: null,
        isOnline: false
      });

      if (io) {
        io.emit('mdm_device_registered', {
          deviceId: newDevice.deviceId,
          employeeId: newDevice.employeeId,
          employeeName: newDevice.employeeName,
          deviceModel: newDevice.deviceModel,
          imei: newDevice.imei,
          macAddress: newDevice.macAddress,
          status: newDevice.status,
          isOnline: false
        });
      }

      return res.json({
        success: true,
        message: 'Device enrolled successfully',
        device: newDevice
      });
    } catch (err) {
      console.error('[MDM] Enroll Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. Update / Reassign device
  router.put('/devices/:id', requireAdminAuth, async (req, res) => {
    try {
      const { employeeId, deviceModel, manufacturer, imei, macAddress, platform, notes, status } = req.body;
      const device = await DeviceRegistry.findById(req.params.id);
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }

      if (employeeId !== undefined) {
        if (employeeId) {
          const emp = await Employee.findById(employeeId);
          if (emp) {
            const dec = decryptEmployee(emp);
            device.employeeId = emp._id;
            device.employeeName = dec?.name || '';
            device.employeeEmpId = dec?.employeeId || dec?.empId || '';
          }
        } else {
          device.employeeId = null;
          device.employeeName = 'Unassigned';
          device.employeeEmpId = '';
        }
      }

      if (deviceModel !== undefined) device.deviceModel = deviceModel;
      if (manufacturer !== undefined) device.manufacturer = manufacturer;
      if (imei !== undefined) device.imei = imei ? String(imei).trim() : '';
      if (macAddress !== undefined) device.macAddress = macAddress ? String(macAddress).trim() : '';
      if (platform !== undefined) device.platform = platform;
      if (notes !== undefined) device.notes = notes;
      if (status !== undefined) device.status = status;

      await device.save();

      if (io) {
        io.emit('mdm_device_status_changed', {
          deviceId: device.deviceId,
          status: device.status
        });
      }

      return res.json({
        success: true,
        message: 'Device updated successfully',
        device
      });
    } catch (err) {
      console.error('[MDM] Update Device Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 8. Update device status (approved, suspended, revoked)
  router.patch('/devices/:id/status', requireAdminAuth, async (req, res) => {
    try {
      const { status, notes } = req.body;
      if (!['approved', 'pending', 'suspended', 'revoked'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }

      const update = { status };
      if (notes !== undefined) update.notes = notes;

      const device = await DeviceRegistry.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }

      if (io) {
        io.emit('mdm_device_status_changed', {
          deviceId: device.deviceId,
          status: device.status
        });
      }

      return res.json({ success: true, message: `Device status changed to ${status}`, device });
    } catch (err) {
      console.error('[MDM] Update Status Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 9. Dispatch on-demand ping request to active device via Socket.IO
  router.post('/devices/:id/ping', requireAdminAuth, async (req, res) => {
    try {
      const device = await DeviceRegistry.findById(req.params.id);
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }

      if (io) {
        io.emit('mdm_ping_request', {
          deviceId: device.deviceId,
          timestamp: new Date()
        });
      }

      return res.json({
        success: true,
        message: `Ping signal dispatched to ${device.deviceModel || device.deviceId}`,
        device
      });
    } catch (err) {
      console.error('[MDM] Ping Request Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 10. Manual / forced telemetry update for a device
  router.post('/devices/:id/emit-ping', requireAdminAuth, async (req, res) => {
    try {
      const device = await DeviceRegistry.findById(req.params.id);
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }

      const now = new Date();
      device.lastSeen = now;
      device.isOnline = true;

      if (req.body.batteryLevel !== undefined && req.body.batteryLevel !== null) {
        device.batteryLevel = Math.max(0, Math.min(100, Math.round(Number(req.body.batteryLevel))));
      }
      if (req.body.isCharging !== undefined) {
        device.isCharging = Boolean(req.body.isCharging);
      }
      if (req.body.networkType) {
        device.networkType = req.body.networkType;
      }

      if (req.body.location && typeof req.body.location.lat === 'number' && typeof req.body.location.lng === 'number') {
        device.lastLocation = {
          lat: req.body.location.lat,
          lng: req.body.location.lng,
          accuracy: req.body.location.accuracy || null,
          speed: req.body.location.speed || 0,
          heading: req.body.location.heading || null,
          address: req.body.location.address || '',
          updatedAt: now
        };

        await DeviceLocationLog.create({
          employeeId: device.employeeId,
          employeeName: device.employeeName,
          deviceId: device.deviceId,
          coordinates: {
            lat: req.body.location.lat,
            lng: req.body.location.lng
          },
          accuracy: req.body.location.accuracy || null,
          speed: req.body.location.speed || 0,
          batteryLevel: device.batteryLevel,
          isCharging: device.isCharging,
          networkType: device.networkType,
          address: req.body.location.address || '',
          timestamp: now
        });
      }

      await device.save();

      if (io) {
        io.emit('mdm_telemetry', {
          deviceId: device.deviceId,
          employeeId: device.employeeId,
          employeeName: device.employeeName,
          employeeEmpId: device.employeeEmpId,
          deviceModel: device.deviceModel,
          batteryLevel: device.batteryLevel,
          isCharging: device.isCharging,
          networkType: device.networkType,
          isGpsEnabled: !!device.lastLocation?.lat,
          isOnline: true,
          lastSeen: device.lastSeen,
          location: device.lastLocation
        });
        io.emit('mdm_device_updated', device);
      }

      return res.json({
        success: true,
        message: 'Telemetry refreshed successfully',
        device
      });
    } catch (err) {
      console.error('[MDM] Emit Ping Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. Delete / Unbind device
  router.delete('/devices/:id', requireAdminAuth, async (req, res) => {
    try {
      const device = await DeviceRegistry.findByIdAndDelete(req.params.id);
      if (!device) {
        return res.status(404).json({ success: false, message: 'Device not found' });
      }

      if (io) {
        io.emit('mdm_device_unbound', { deviceId: device.deviceId });
      }

      return res.json({ success: true, message: 'Device unregistered successfully' });
    } catch (err) {
      console.error('[MDM] Delete Device Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  return router;
};
