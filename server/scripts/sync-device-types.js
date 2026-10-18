const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/anienterprise';

const ZKLib = require('node-zklib');
const { COMMANDS, REQUEST_DATA } = require('node-zklib/constants');
const { createTCPHeader, decodeRecordData40 } = require('node-zklib/utils');

function decodeRecord40(buf) {
  const base = decodeRecordData40(buf);
  const verifyByte = buf[26];
  const stateByte = buf[31];

  let verifyMode = 'FINGERPRINT';
  if (verifyByte === 4) verifyMode = 'CARD';
  else if (verifyByte === 0) verifyMode = 'PASSWORD';
  else if (verifyByte === 15) verifyMode = 'FACE';
  else if (verifyByte === 1) verifyMode = 'FINGERPRINT';

  const stateMap = { 0: 'IN', 1: 'OUT', 2: 'BREAK_OUT', 3: 'BREAK_IN', 4: 'OT_IN', 5: 'OT_OUT' };
  const punchType = stateMap[stateByte] || 'IN';

  return {
    userSn: base.userSn,
    deviceUserId: base.deviceUserId,
    recordTime: base.recordTime,
    verifyMode,
    punchType,
    verifyByte,
    stateByte
  };
}

async function updateDbWithRealTypes() {
  await mongoose.connect(uri);
  const coll = mongoose.connection.collection('attendancepunches');

  console.log('Connecting to ZKTeco device at 192.168.0.74...');
  const zk = new ZKLib('192.168.0.74', 4370, 30000, 4000);
  await zk.createSocket();
  const z = zk.zklibTcp;

  z.replyId++;
  const buf = createTCPHeader(COMMANDS.CMD_DATA_WRRQ, z.sessionId, z.replyId, REQUEST_DATA.GET_ATTENDANCE_LOGS);
  const reply = await z.requestData(buf);
  const size = reply.subarray(16).readUIntLE(1, 4);

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
      let chunkTimer = setTimeout(() => { z.socket.off('data', onData); reject(new Error('Timeout chunk ' + c)); }, 6000);

      function onData(d) {
        bufferAcc = Buffer.concat([bufferAcc, d]);
        while (bufferAcc.length >= 8) {
          if (bufferAcc.compare(Buffer.from([0x50, 0x50, 0x82, 0x7d]), 0, 4, 0, 4) !== 0) {
            bufferAcc = bufferAcc.subarray(1);
            continue;
          }
          const packetLen = bufferAcc.readUInt16LE(4);
          if (bufferAcc.length < 8 + packetLen) break;
          const pkt = bufferAcc.subarray(0, 8 + packetLen);
          bufferAcc = bufferAcc.subarray(8 + packetLen);
          if (pkt.readUInt16LE(8) === COMMANDS.CMD_DATA) {
            clearTimeout(chunkTimer);
            z.socket.off('data', onData);
            resolve(pkt.subarray(16));
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
  console.log('Total raw logs:', Math.floor(logBuffer.length / 40));

  const records = [];
  for (let i = 0; i <= logBuffer.length - 40; i += 40) {
    const r = decodeRecord40(logBuffer.subarray(i, i + 40));
    if (parseInt(r.deviceUserId || 0) > 0 && r.recordTime instanceof Date && !isNaN(r.recordTime.getTime())) {
      records.push(r);
    }
  }
  console.log('Valid employee logs:', records.length);

  // Group by (enrollId + date) to calculate intelligent alternating IN / OUT
  const byUserDay = new Map();
  records.forEach(r => {
    const dayStr = r.recordTime.toISOString().split('T')[0];
    const key = r.deviceUserId + '_' + dayStr;
    if (!byUserDay.has(key)) byUserDay.set(key, []);
    byUserDay.get(key).push(r);
  });

  byUserDay.forEach(punches => {
    punches.sort((a, b) => a.recordTime.getTime() - b.recordTime.getTime());
    punches.forEach((p, idx) => {
      if (p.stateByte === 0) {
        if (punches.length === 1) {
          p.resolvedType = 'IN';
        } else if (idx === 0) {
          p.resolvedType = 'IN';
        } else if (idx === punches.length - 1) {
          p.resolvedType = 'OUT';
        } else {
          p.resolvedType = (idx % 2 === 0) ? 'IN' : 'OUT';
        }
      } else {
        const stateMap = { 0: 'IN', 1: 'OUT', 2: 'BREAK_OUT', 3: 'BREAK_IN', 4: 'OT_IN', 5: 'OT_OUT' };
        p.resolvedType = stateMap[p.stateByte] || 'IN';
      }
    });
  });

  records.reverse();

  console.log('Bulk updating MongoDB AttendancePunch records...');
  const BATCH = 1000;
  let updatedCount = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const ops = chunk.map(r => ({
      updateMany: {
        filter: {
          enrollId: Number(r.deviceUserId),
          punchTime: {
            $gte: new Date(r.recordTime.getTime() - 2000),
            $lte: new Date(r.recordTime.getTime() + 2000)
          }
        },
        update: {
          $set: {
            verifyMode: r.verifyMode,
            punchType: r.resolvedType
          }
        }
      }
    }));
    const res = await coll.bulkWrite(ops, { ordered: false });
    updatedCount += (res.modifiedCount || 0);
    if ((i + BATCH) % 5000 === 0 || i + BATCH >= records.length) {
      console.log(`Updated ${Math.min(i + BATCH, records.length)}/${records.length} records...`);
    }
  }

  console.log('DONE! Updated', updatedCount, 'records in MongoDB.');

  const todayLatest = await coll.find({ punchTime: { $gte: new Date('2026-10-18T00:00:00Z') } }).sort({ punchTime: -1 }).limit(10).toArray();
  console.log('Today punches sample:');
  todayLatest.forEach(p => {
    console.log(`Enroll: ${p.enrollId} | Time: ${p.punchTime.toISOString()} | Type: ${p.punchType} | Verify: ${p.verifyMode}`);
  });

  process.exit(0);
}

updateDbWithRealTypes().catch(e => { console.error('FAILED:', e); process.exit(1); });
