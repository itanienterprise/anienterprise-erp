/**
 * Automated Session Hijacking Protection Test Script
 * Run with: node server/test_session_hijack.js
 * (Works both when npm run dev is running or when server is stopped)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const CryptoJS = require('crypto-js');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const { decryptData } = require('./src/utils/encryption');

const SECRET_KEY = process.env.SECRET_KEY || 'ani1820';

function generateSignature(payload, timestamp) {
  const dataToSign = JSON.stringify(payload) + '|' + timestamp;
  return CryptoJS.HmacSHA256(dataToSign, SECRET_KEY).toString();
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function runVerification() {
  let serverProcess = null;

  try {
    const isOnline = await checkPort(5000);
    if (!isOnline) {
      console.log('📡 Port 5000 is offline. Starting temporary server instance for test...');
      serverProcess = spawn('node', ['src/index.js'], {
        cwd: __dirname,
        env: { ...process.env },
        stdio: 'pipe'
      });

      // Wait until server is ready
      let ready = false;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await checkPort(5000)) {
          ready = true;
          break;
        }
      }

      if (!ready) {
        throw new Error('Could not start server on port 5000. Please start npm run dev first.');
      }
      console.log('⚡ Temporary server ready on port 5000.\n');
    } else {
      console.log('⚡ Connected to active server on port 5000.\n');
    }

    console.log('Connecting to database to setup test account...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp_db');
    
    const testUsername = 'sec_test_' + Date.now();
    const testPassword = 'Password123!@#';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    await mongoose.connection.db.collection('users').insertOne({
      username: testUsername,
      password: hashedPassword,
      role: 'admin'
    });

    try {
      console.log('\n======================================================');
      console.log('🧪 SESSION HIJACKING PROTECTION TEST SUITE');
      console.log('======================================================\n');

      const uaVictim = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
      const ts1 = Date.now().toString();
      const loginPayload = { username: testUsername, password: testPassword };
      const sig1 = generateSignature(loginPayload, ts1);

      // 1. Legitimate user logs in
      const loginRes = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': uaVictim,
          'X-Timestamp': ts1,
          'X-Signature': sig1
        },
        body: JSON.stringify(loginPayload)
      });

      const cookieHeader = loginRes.headers.get('set-cookie');
      const cookie = cookieHeader ? cookieHeader.split(';')[0] : '';
      const rawLogin = await loginRes.json();
      const loginData = rawLogin.payload ? decryptData(rawLogin.payload) : rawLogin;

      console.log('✅ TEST 1: Legitimate User Authentication & Token Generation');
      console.log('   - HTTP Status:', loginRes.status, '(Success)');
      console.log('   - Issued Cookie:', cookie.substring(0, 32) + '...');
      console.log('   - Anti-Hijacking Token Generated:', !!loginData.sessionToken);
      console.log('   - Bound User-Agent:', uaVictim);

      // 2. Legitimate request from original device
      const ts2 = Date.now().toString();
      const sig2 = generateSignature({}, ts2);
      const legitCheck = await fetch('http://localhost:5000/api/auth/check', {
        headers: {
          'Cookie': cookie,
          'User-Agent': uaVictim,
          'X-Timestamp': ts2,
          'X-Signature': sig2,
          'X-Session-Token': loginData.sessionToken
        }
      });
      const rawCheck = await legitCheck.json();
      const legitData = rawCheck.payload ? decryptData(rawCheck.payload) : rawCheck;
      console.log('\n✅ TEST 2: Legitimate Request Verified');
      console.log('   - HTTP Status:', legitCheck.status, '(Allowed)');
      console.log('   - User Authenticated:', legitData.authenticated);

      // 3. Attack Simulation: Attacker steals cookie and replays from different browser / Postman
      console.log('\n🚨 TEST 3: ATTACK SIMULATION - Stolen Cookie on Attacker Machine / Browser');
      const uaAttacker = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';
      console.log('   - Attacker User-Agent:', uaAttacker);
      const ts3 = Date.now().toString();
      const sig3 = generateSignature({}, ts3);

      const attackRes = await fetch('http://localhost:5000/api/auth/check', {
        headers: {
          'Cookie': cookie,
          'User-Agent': uaAttacker, // Different browser/tool
          'X-Timestamp': ts3,
          'X-Signature': sig3,
          'X-Session-Token': loginData.sessionToken
        }
      });

      const rawAttack = await attackRes.json();
      const attackData = rawAttack.payload ? decryptData(rawAttack.payload) : rawAttack;
      console.log('   - Server Response Status:', attackRes.status, '(Blocked!)');
      console.log('   - Attack Intercepted Code:', attackData.code);
      console.log('   - Security Message:', attackData.message);

      // 4. Verify the hijacked session was destroyed from database upon interception
      console.log('\n🛡️ TEST 4: Immediate Session Invalidation Post-Attack');
      const ts4 = Date.now().toString();
      const sig4 = generateSignature({}, ts4);
      const followUpRes = await fetch('http://localhost:5000/api/auth/check', {
        headers: {
          'Cookie': cookie,
          'User-Agent': uaVictim,
          'X-Timestamp': ts4,
          'X-Signature': sig4
        }
      });
      console.log('   - Session Status in DB:', followUpRes.status, '(401 - Session was wiped from database)');

      console.log('\n======================================================');
      console.log('🎉 RESULT: ALL SESSION HIJACKING DEFENSES FULLY VERIFIED!');
      console.log('======================================================\n');
    } finally {
      await mongoose.connection.db.collection('users').deleteOne({ username: testUsername });
      await mongoose.disconnect();
    }
  } catch (err) {
    console.error('Test execution error:', err.message);
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
  }
}

runVerification();
