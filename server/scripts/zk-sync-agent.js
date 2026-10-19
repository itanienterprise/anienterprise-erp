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
const { COMMANDS, REQUEST_DATA } = require('node-zklib/constants');
const { createTCPHeader, decodeRecordData40 } = require('node-zklib/utils');
const axios = require('axios');

// ── Configuration ─────────────────────────────────────────────────────────────
const DEVICE_IP      = process.env.DEVICE_IP      || '192.168.0.74';   // IP of your ZKTeco device
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

async function fetchAllLogs(ip, port) {
  const zk = new ZKLib(ip, port, 30000, 4000);
  await zk.createSocket();
  const z = zk.zklibTcp;

  z.replyId++;
  const buf = createTCPHeader(COMMANDS.CMD_DATA_WRRQ, z.sessionId, z.replyId, REQUEST_DATA.GET_ATTENDANCE_LOGS);
  const reply = await z.requestData(buf);
  const recvData = reply.subarray(16);
  const size = recvData.readUIntLE(1, 4);

  const MAX_CHUNK = 16 * 1024;
  let remain = size % MAX_CHUNK;
  let numberChunks = Math.floor(size / MAX_CHUNK);
  let totalChunks = numberChunks + (remain > 0 ? 1 : 0);

  let allPayload = Buffer.from([]);

  for (let c = 0; c < totalChunks; c++) {
    const start = c * MAX_CHUNK;
    const chunkSize = (c === totalChunks - 1 && remain > 0) ? remain : MAX_CHUNK;

    const chunkData = await new Promise((resolve, reject) => {
      z.replyId++;
      const reqData = Buffer.alloc(8);
      reqData.writeUInt32LE(start, 0);
      reqData.writeUInt32LE(chunkSize, 4);
      const chunkBuf = createTCPHeader(COMMANDS.CMD_DATA_RDY, z.sessionId, z.replyId, reqData);

      let bufferAcc = Buffer.from([]);
      let chunkTimer = setTimeout(() => {
        z.socket.off('data', onData);
        reject(new Error(`Timeout chunk ${c + 1}/${totalChunks}`));
      }, 8000);

      function onData(d) {
        bufferAcc = Buffer.concat([bufferAcc, d]);
        while (bufferAcc.length >= 8) {
          if (bufferAcc.compare(Buffer.from([0x50, 0x50, 0x82, 0x7d]), 0, 4, 0, 4) !== 0) {
            bufferAcc = bufferAcc.subarray(1);
            continue;
          }
          const packetLen = bufferAcc.readUInt16LE(4);
          const totalPacketLen = 8 + packetLen;
          if (bufferAcc.length < totalPacketLen) break;

          const packet = bufferAcc.subarray(0, totalPacketLen);
          bufferAcc = bufferAcc.subarray(totalPacketLen);

          const commandId = packet.readUInt16LE(8);
          if (commandId === COMMANDS.CMD_DATA) {
            clearTimeout(chunkTimer);
            z.socket.off('data', onData);
            resolve(packet.subarray(16));
            return;
          }
        }
      }
      z.socket.on('data', onData);
      z.socket.write(chunkBuf);
    });

    allPayload = Buffer.concat([allPayload, chunkData]);
  }

  await zk.disconnect();

  const logBuffer = allPayload.subarray(4);
  const records = [];
  for (let i = 0; i <= logBuffer.length - 40; i += 40) {
    const slice = logBuffer.subarray(i, i + 40);
    const userSn = slice.readUIntLE(0, 2);
    const deviceUserId = slice.subarray(2, 11).toString('ascii').replace(/\0.*$/, '').trim();

    // Decode 32-bit ZKTeco timestamp with explicit Asia/Dhaka (+06:00) UTC offset
    let t = slice.readUInt32LE(27);
    const second = t % 60; t = Math.floor(t / 60);
    const minute = t % 60; t = Math.floor(t / 60);
    const hour = t % 24; t = Math.floor(t / 24);
    const day = (t % 31) + 1; t = Math.floor(t / 31);
    const month = t % 12; t = Math.floor(t / 12);
    const year = t + 2000;
    const recordTime = new Date(Date.UTC(year, month, day, hour, minute, second) - (6 * 3600 * 1000));

    const verifyByte = slice[26];
    const stateByte = slice[31];

    let verifyMode = 'FINGERPRINT';
    if (verifyByte === 4) verifyMode = 'CARD';
    else if (verifyByte === 0) verifyMode = 'PASSWORD';
    else if (verifyByte === 15) verifyMode = 'FACE';
    else if (verifyByte === 1) verifyMode = 'FINGERPRINT';

    records.push({
      userSn,
      deviceUserId,
      recordTime,
      verifyMode,
      verifyByte,
      stateByte
    });
  }

  // Calculate intelligent punchType (IN / OUT / BREAK) per Dhaka calendar day
  const byUserDay = new Map();
  records.forEach(r => {
    const d = r.recordTime instanceof Date ? r.recordTime : new Date(r.recordTime);
    if (isNaN(d.getTime())) return;
    const dayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(d);
    const key = String(r.deviceUserId || r.userSn) + '_' + dayStr;
    if (!byUserDay.has(key)) byUserDay.set(key, []);
    byUserDay.get(key).push(r);
  });

  const stateMap = { 0: 'IN', 1: 'OUT', 2: 'BREAK_OUT', 3: 'BREAK_IN', 4: 'OT_IN', 5: 'OT_OUT' };

  byUserDay.forEach(punches => {
    punches.sort((a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime());
    punches.forEach((p, idx) => {
      if (p.stateByte === 0 || p.stateByte === undefined) {
        if (punches.length === 1) {
          p.punchType = 'IN';
        } else if (idx === 0) {
          p.punchType = 'IN';
        } else if (idx === punches.length - 1) {
          p.punchType = 'OUT';
        } else {
          p.punchType = (idx % 2 === 0) ? 'IN' : 'OUT';
        }
      } else {
        p.punchType = stateMap[p.stateByte] || 'IN';
      }
    });
  });

  return records;
}

async function syncPunches() {
  if (isSyncing) return;
  isSyncing = true;
  const timeStr = new Date().toLocaleTimeString();

  try {
    process.stdout.write(`[${timeStr}] Connecting to device at ${DEVICE_IP}:${DEVICE_PORT}... `);
    const records = await fetchAllLogs(DEVICE_IP, DEVICE_PORT);
    console.log(`Connected! (${records.length} total logs)`);

    if (records.length === 0) {
      isSyncing = false;
      return;
    }

    const payload = {
      deviceId: `F8-${DEVICE_IP}`,
      punches: records
        .map(r => ({
          enrollId: parseInt(r.deviceUserId || r.userSn || 0),
          punchTime: r.recordTime,
          punchType: r.punchType || 'IN',
          verifyMode: r.verifyMode || 'FINGERPRINT'
        }))
        .filter(p => p.enrollId > 0 && !isNaN(new Date(p.punchTime).getTime()))
    };

    process.stdout.write(`       Sending ${payload.punches.length} punches to ERP... `);
    const erpRes = await axios.post(`${ERP_SERVER_URL}/api/attendance/device/push-bulk`, payload, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`Done! ${erpRes.data.message || 'Synced'}`);
  } catch (err) {
    console.log(`FAILED! Error: ${err.message || err}`);
  } finally {
    isSyncing = false;
  }
}

// Run immediately on launch
syncPunches();

// Recurring timer
setInterval(syncPunches, SYNC_INTERVAL * 1000);
