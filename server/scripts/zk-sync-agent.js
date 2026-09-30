/**
 * ZKTeco F8 Local Office Sync Agent
 * Runs on any computer connected to the same local network / Wi-Fi as your ZKTeco F8 device.
 * Automatically synchronizes attendance punches to your ANI Enterprise ERP server.
 *
 * Requirements:
 * 1. Node.js installed (https://nodejs.org)
 * 2. Run: npm install node-zklib axios
 * 3. Run: node zk-sync-agent.js
 */

const ZKLib = require('node-zklib');
const axios = require('axios');

// ── Configuration ─────────────────────────────────────────────────────────────
const DEVICE_IP      = process.env.DEVICE_IP      || '192.168.1.201';  // IP of your ZKTech F8
const DEVICE_PORT    = parseInt(process.env.DEVICE_PORT || '4370');    // Default ZK port
const ERP_SERVER_URL = process.env.ERP_SERVER_URL || 'http://localhost:5000'; // ERP Base URL
const SYNC_INTERVAL  = parseInt(process.env.SYNC_INTERVAL  || '60');   // Seconds between syncs

console.log('====================================================');
console.log('   ANI Enterprise ERP — ZKTeco Sync Agent');
console.log('====================================================');
console.log(`Device IP:        ${DEVICE_IP}:${DEVICE_PORT}`);
console.log(`ERP Endpoint:     ${ERP_SERVER_URL}/api/attendance/device/push-bulk`);
console.log(`Sync Interval:    Every ${SYNC_INTERVAL} seconds`);
console.log('----------------------------------------------------');

let isSyncing = false;

async function syncPunches() {
  if (isSyncing) return;
  isSyncing = true;

  const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
  const timeStr = new Date().toLocaleTimeString();

  try {
    process.stdout.write(`[${timeStr}] Connecting to F8 at ${DEVICE_IP}:${DEVICE_PORT}... `);
    await zk.createSocket();
    const res = await zk.getAttendances();
    await zk.disconnect();

    const records = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    console.log(`Connected! (${records.length} punches found on device)`);

    if (records.length === 0) {
      isSyncing = false;
      return;
    }

    // Format for ERP Bulk Ingestion
    const payload = {
      deviceId: `F8-${DEVICE_IP}`,
      punches: records.map(r => ({
        enrollId: r.deviceUserId || r.userSn,
        punchTime: r.recordTime,
        verifyMode: 'FINGERPRINT'
      }))
    };

    process.stdout.write(`       Sending to ERP... `);
    const erpRes = await axios.post(`${ERP_SERVER_URL}/api/attendance/device/push-bulk`, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Done! ${erpRes.data.message || 'Synced'}`);
  } catch (err) {
    try { await zk.disconnect(); } catch (_) {}
    console.log(`FAILED!`);
    console.error(`       Error: ${err.message || err}`);
  } finally {
    isSyncing = false;
  }
}

// Run immediately on launch
syncPunches();

// Recurring timer
setInterval(syncPunches, SYNC_INTERVAL * 1000);
