const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const fs = require('fs');
const path = require('path');
let multer;
try {
  multer = require('multer');
} catch (e) {
  console.warn('[Server] multer not found in node_modules, falling back to direct JSON/stream parser');
}
const BackupSetting = require('./models/BackupSetting');

const uploadDir = path.resolve(__dirname, '../backups/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const backupUpload = multer ? multer({
  dest: uploadDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB limit
}) : {
  single: () => (req, res, next) => next()
};

const attUpload = multer ? multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB limit for USB attendance logs
}) : {
  single: () => (req, res, next) => next()
};

let ZKLib;
try {
  ZKLib = require('node-zklib');
} catch (e) {
  console.warn('[Attendance] node-zklib not loaded:', e.message);
}

dotenv.config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.set('trust proxy', 1);

// Restricted CORS Whitelisting
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow non-browser / same-origin requests
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return true;
    }
    if (process.env.CLIENT_URL && (origin === process.env.CLIENT_URL || origin.startsWith(process.env.CLIENT_URL))) {
      return true;
    }
  } catch (e) { }
  return false;
};

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // In internal ERP, allow all origins so LAN devices, hostnames, and reverse proxies connect without CORS rejection
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});
app.set('io', io);

io.on('connection', (socket) => {
  const count = io.engine ? io.engine.clientsCount : (io.sockets?.sockets ? io.sockets.sockets.size : 1);
  console.log(`[Socket] Client connected: id=${socket.id}, total clients=${count}`);

  socket.on('disconnect', (reason) => {
    const remaining = io.engine ? io.engine.clientsCount : 0;
    console.log(`[Socket] Client disconnected: id=${socket.id} (${reason}), remaining clients=${remaining}`);
  });
});

// In-Memory Fast Cache for frequent heavy read endpoints
const memoryCache = {
  stock: null,
  sales: null,
  purchases: null,
  purchaseReceives: null,
  customers: null,
  warehouses: null,
  insurancePayments: null,
  cnfPayments: null,
  returns: null,
  costOfGoods: null,
  tokens: null,
  products: null,
  pendingIndicators: null,
  pendingTimestamp: 0
};

const invalidateMemoryCache = (modName) => {
  const mod = (modName || '').toLowerCase().trim();
  memoryCache.pendingIndicators = null;
  if (!mod || mod === 'all') {
    Object.keys(memoryCache).forEach(k => { if (k !== 'pendingTimestamp') memoryCache[k] = null; });
    return;
  }
  if (['stock', 'stock-baseline'].includes(mod)) {
    memoryCache.stock = null;
    memoryCache.warehouses = null;
  }
  if (['sale', 'sales'].includes(mod)) memoryCache.sales = null;
  if (['purchase', 'purchases'].includes(mod)) memoryCache.purchases = null;
  if (['purchase-receive', 'purchase-receives', 'purchasereceive', 'purchasereceives'].includes(mod)) {
    memoryCache.purchaseReceives = null;
    memoryCache.stock = null;
    memoryCache.warehouses = null;
  }
  if (['customer', 'customers', 'payment-collection', 'paymentcollection', 'payments', 'pay-to-customer', 'paytocustomer'].includes(mod)) {
    memoryCache.customers = null;
    memoryCache.sales = null;
  }
  if (['warehouse', 'warehouses', 'transfer', 'transfers'].includes(mod)) {
    memoryCache.warehouses = null;
    memoryCache.stock = null;
  }
  if (['insurance-payment', 'insurance-payments'].includes(mod)) memoryCache.insurancePayments = null;
  if (['cnf-payment', 'cnf-payments'].includes(mod)) memoryCache.cnfPayments = null;
  if (['return', 'returns', 'return-product', 'return-products', 'returnproduct', 'returnproducts'].includes(mod)) {
    memoryCache.returns = null;
    memoryCache.stock = null;
    memoryCache.warehouses = null;
    memoryCache.customers = null;
    memoryCache.sales = null;
  }
  if (['cost-of-goods', 'costofgoods', 'cog'].includes(mod)) {
    memoryCache.costOfGoods = null;
  }
  if (['token', 'tokens'].includes(mod)) {
    memoryCache.tokens = null;
  }
  if (['product', 'products'].includes(mod)) {
    memoryCache.products = null;
  }
};

const broadcastUpdate = (moduleName, action = 'update', payload = {}) => {
  try {
    invalidateMemoryCache(moduleName);
    const clientsCount = io.engine ? io.engine.clientsCount : (io.sockets?.sockets ? io.sockets.sockets.size : 0);
    console.log(`[Socket] Broadcasting real-time update: module=${moduleName}, action=${action}, clientsCount=${clientsCount}`);
    io.emit('data_updated', {
      module: moduleName,
      action,
      payload,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('[Socket] Broadcast error:', err);
  }
};
app.set('broadcastUpdate', broadcastUpdate);

const apiRouter = express.Router();
const PORT = process.env.PORT || 5000;

// Security Packages
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

// Private & Local IP Helper
const isPrivateIP = (ip) => {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, '').trim();
  return (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === 'localhost' ||
    clean.startsWith('192.168.') ||
    clean.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean) ||
    clean.startsWith('169.254.')
  );
};

// Password Hashing & Verification Utilities
const hashPassword = async (plainPassword) => {
  return await bcrypt.hash(plainPassword, 10);
};

const verifyPassword = async (plainPassword, storedPasswordHash, userDoc = null) => {
  if (!storedPasswordHash || !plainPassword) return false;

  // 1. Bcrypt hash check ($2a$ or $2b$)
  if (storedPasswordHash.startsWith('$2a$') || storedPasswordHash.startsWith('$2b$')) {
    return await bcrypt.compare(plainPassword, storedPasswordHash);
  }

  // 2. Legacy SHA-256 fallback (auto-upgrades to bcrypt on match)
  const sha256Hash = CryptoJS.SHA256(plainPassword).toString(CryptoJS.enc.Hex);
  if (sha256Hash === storedPasswordHash) {
    if (userDoc) {
      try {
        userDoc.password = await hashPassword(plainPassword);
        await userDoc.save();
        console.log(`[Security] Upgraded password for '${userDoc.username}' to bcrypt.`);
      } catch (e) {
        console.error('Failed to auto-upgrade password hash:', e);
      }
    }
    return true;
  }

  return false;
};

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 attempts per username/IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const user = (req.body?.username || req.body?.d?.username || '').toLowerCase().trim();
    const cleanIp = (req.ip || req.connection?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    return `${cleanIp}_${user}`;
  },
  message: { message: 'Too many login attempts from this account. Please try again after 15 minutes.' }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000, // High ceiling for active ERP office sessions
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (isPrivateIP(ip)) return true;
    if (req.session && req.session.user) return true;
    const path = req.originalUrl || req.url || '';
    if (path.includes('/api/auth/login')) return true;
    return false;
  },
  message: { message: 'Too many requests from this IP. Please try again later.' }
});

// Middleware
// 1. HTTP Security Headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Keep disabled for dev HMR / inline styles
}));

// 2. Restricted CORS Whitelisting (already declared above)
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked: Unauthorized origin'));
    }
  },
  credentials: true
}));

// 3. Payload limits (Safe 15mb default to prevent memory-exhaustion DoS)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// 4. NoSQL injection sanitizer (Express 5 compatible)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  }
  if (req.params && typeof req.params === 'object') {
    mongoSanitize.sanitize(req.params, { replaceWith: '_' });
  }
  next();
});

// 5. Cookie parser
app.use(cookieParser());

// 6. General rate limit for direct API requests
app.use('/api', generalLimiter);

// Security Middleware (Decryption and Signature Verification)
const securityMiddleware = require('./middleware/securityMiddleware');
app.use(securityMiddleware);

// Session Configuration
app.use(session({
  name: 'erp_session',
  secret: process.env.SESSION_SECRET || 'ani_enterprise_erp_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://mongo:27017/erp_db',
    collectionName: 'sessions'
  }),
  cookie: {
    // maxAge removed for session-only cookies
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax'
  }
}));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/erp_db')
  .then(() => {
    console.log('MongoDB connected successfully');
    seedAdminUser();
  })
  .catch(err => console.log('MongoDB connection error:', err));

const IpRecord = require('./models/IpRecord');
const Importer = require('./models/Importer');
const Port = require('./models/Port');
const Stock = require('./models/Stock');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Warehouse = require('./models/Warehouse');
const Damage = require('./models/Damage');
const Sale = require('./models/Sale');
const Purchase = require('./models/Purchase');
const PurchaseReceive = require('./models/PurchaseReceive');
const Return = require('./models/Return');
const Token = require('./models/Token');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Notification = require('./models/Notification');
const Bank = require('./models/Bank');
const Exporter = require('./models/Exporter');
const Supplier = require('./models/Supplier');
const CostOfGoods = require('./models/CostOfGoods');
const CnF = require('./models/CnF');
const Insurance = require('./models/Insurance');
const LCManagement = require('./models/LCManagement');
const LCGatePass = require('./models/LCGatePass');
const LCExpense = require('./models/LCExpense');
const MarginReturn = require('./models/MarginReturn');
const PI = require('./models/PI');
const PackingList = require('./models/PackingList');
const TRSetup = require('./models/TRSetup');
const MetaData = require('./models/MetaData');
const CnFPayment = require('./models/CnFPayment');
const InsurancePayment = require('./models/InsurancePayment');
const StockBaseline = require('./models/StockBaseline');
const { encryptData, decryptData } = require('./utils/encryption');
const { updateBrandAcrossAllCollections } = require('./services/brandCascadeService');
const { syncSaleOnSave, syncSaleOnDelete, repairChondonEntities, repairAllCustomerSalesHistory } = require('./services/customerSyncService');
const CryptoJS = require('crypto-js');
const ActivityLog = require('./models/ActivityLog');
const UserDailyActivity = require('./models/UserDailyActivity');

// ─── Attendance Module Models ────────────────────────────────────────────────
const AttendancePunch = require('./models/AttendancePunch');
const AttendanceLog = require('./models/AttendanceLog');
const ShiftConfig = require('./models/ShiftConfig');
const LeaveRequest = require('./models/LeaveRequest');
const DeviceMapping = require('./models/DeviceMapping');
// ────────────────────────────────────────────────────────────────────────────

// Intelligent Cluster-based Calculation of Actual ERP Active Usage Time
const calculateActiveTimeFromTimestamps = (timestamps, isLive = false, idleThresholdMs = 5 * 60 * 1000, baseActionMs = 60 * 1000) => {
  if (!timestamps || timestamps.length === 0) return 0;
  const times = timestamps.map(t => new Date(t).getTime()).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (times.length === 0) return 0;

  let totalActiveMs = 0;
  let sessionStart = times[0];
  let sessionEnd = times[0];

  for (let i = 1; i < times.length; i++) {
    const diff = times[i] - times[i - 1];
    if (diff <= idleThresholdMs) {
      sessionEnd = times[i];
    } else {
      const sessionDuration = Math.max(baseActionMs, sessionEnd - sessionStart);
      totalActiveMs += sessionDuration;
      sessionStart = times[i];
      sessionEnd = times[i];
    }
  }

  let lastSessionDuration = Math.max(baseActionMs, sessionEnd - sessionStart);
  if (isLive) {
    const now = Date.now();
    const timeSinceLastAction = Math.max(0, now - sessionEnd);
    if (timeSinceLastAction <= idleThresholdMs) {
      lastSessionDuration += timeSinceLastAction;
    }
  }
  totalActiveMs += lastSessionDuration;
  return totalActiveMs;
};
const {
  logActivity,
  resolveModuleFromPath,
  sanitizePayload,
  generateOperationDescription,
  resolveActionDetails,
  extractFilledFields,
  computeUpdatedFields,
  resolvePayloadObject
} = require('./services/activityLogger');

// Auto-seed admin user if no users exist
const seedAdminUser = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hashedPassword = await hashPassword('admin123');
      const adminUser = new User({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      await adminUser.save();
      console.log('Default admin user created successfully.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
};

// Normalize stock baseline records (PUSKAR NANO, V D, RANI MIX, RAPID MEDIUM, SHIDDHART MEDIUM, and cleanup KHESHARI DAL ghost entries)
const normalizeBaselineSnapshot = (decrypted) => {
  if (!decrypted || !Array.isArray(decrypted.snapshotRecords)) return { changed: false, decrypted };

  let changed = false;

  // 1. Filter out zeroed historical ghost entries:
  // - DIPOK 1, KOILAS, ROYEL KING under KHESHARI DAL
  // - rangoli < 100 kg remainder
  const filtered = decrypted.snapshotRecords.filter(r => {
    const p = (r.productName || '').trim().toUpperCase();
    const b = (r.brand || '').trim().toLowerCase();
    const qty = parseFloat(r.inHouseQuantity ?? r.quantity) || 0;

    if (p === 'KHESHARI DAL' && ['dipok 1', 'koilas', 'royel king'].includes(b)) {
      changed = true;
      return false;
    }
    if (b === 'rangoli' && qty < 100) {
      changed = true;
      return false;
    }
    return true;
  });

  // 2. Renaming mappings in HILI & BOGURA:
  // - VD (59,830 kg in HILI, 600 kg in BOGURA) -> PUSKAR NANO
  // - SONPURI (42,680 kg in HILI) -> V D
  // - RANGOLI (41,990 kg in HILI) -> RANI MIX
  // - SEVEN STAR (41,566 kg + 17,475 kg in HILI) -> SHIDDHART MEDIUM
  // - 5,880 kg & 21,051 kg in HILI -> RAPID MEDIUM
  const normalized = filtered.map(r => {
    const b = (r.brand || '').trim().toLowerCase();
    const wh = (r.warehouse || '').trim().toUpperCase();
    const qty = parseFloat(r.inHouseQuantity ?? r.quantity) || 0;

    if (b === 'v d' && (r.lcNo === '087326010686' || r.lcNo === '087326010693')) {
      changed = true;
      return { ...r, brand: 'PUSKAR NANO' };
    }
    if (wh === 'HILI' && b === 'sonpuri' && r.lcNo === '0385') {
      changed = true;
      return { ...r, brand: 'V D' };
    }
    if (wh === 'HILI' && b === 'rangoli' && r.lcNo === '087326010693') {
      changed = true;
      return { ...r, brand: 'RANI MIX' };
    }
    if (wh === 'HILI' && b === 'seven star') {
      changed = true;
      return { ...r, brand: 'SHIDDHART MEDIUM' };
    }
    if (wh === 'HILI' && b === 'rani mix' && (Math.abs(qty - 5880) < 1 || Math.abs(qty - 21051) < 1)) {
      changed = true;
      return { ...r, brand: 'RAPID MEDIUM' };
    }
    if ((r.productName || '').trim().toUpperCase() === 'WHEAT' && (r.lcNo || '').trim() === '087326010665') {
      if ((r.brand || '').trim().toUpperCase() !== 'F C I') {
        changed = true;
        return { ...r, brand: 'F C I' };
      }
    }
    return r;
  });

  // 3. Explicitly ensure RAPID MEDIUM and SHIDDHART MEDIUM exist in HILI if missing
  const hasRapid1 = normalized.some(r => r.warehouse === 'HILI' && (r.brand || '').trim().toUpperCase() === 'RAPID MEDIUM' && r.lcNo === '0000');
  if (!hasRapid1) {
    normalized.push({
      warehouse: 'HILI',
      productName: 'MOSUR DAL',
      brand: 'RAPID MEDIUM',
      quality: 'MEDIUM',
      packetSize: 30,
      inHouseQuantity: 5880,
      inHousePacket: 196,
      quantity: 5880,
      packet: 196,
      purchasedPrice: 0,
      rate: 0,
      lcNo: '0000',
      unit: 'kg'
    });
    changed = true;
  }
  const hasRapid2 = normalized.some(r => r.warehouse === 'HILI' && (r.brand || '').trim().toUpperCase() === 'RAPID MEDIUM' && r.lcNo === '073926010073');
  if (!hasRapid2) {
    normalized.push({
      warehouse: 'HILI',
      productName: 'MOSUR DAL',
      brand: 'RAPID MEDIUM',
      quality: 'MEDIUM',
      packetSize: 30,
      inHouseQuantity: 21051,
      inHousePacket: 701.7,
      quantity: 21051,
      packet: 701.7,
      purchasedPrice: 0,
      rate: 0,
      lcNo: '073926010073',
      unit: 'kg'
    });
    changed = true;
  }

  const hasShiddhart1 = normalized.some(r => r.warehouse === 'HILI' && (r.brand || '').trim().toUpperCase() === 'SHIDDHART MEDIUM' && r.lcNo === '0000');
  if (!hasShiddhart1) {
    normalized.push({
      warehouse: 'HILI',
      productName: 'MOSUR DAL',
      brand: 'SHIDDHART MEDIUM',
      quality: 'MEDIUM',
      packetSize: 30,
      inHouseQuantity: 41566,
      inHousePacket: 1385.5333333333333,
      quantity: 41566,
      packet: 1385.5333333333333,
      purchasedPrice: 0,
      rate: 0,
      lcNo: '0000',
      unit: 'kg'
    });
    changed = true;
  }
  const hasShiddhart2 = normalized.some(r => r.warehouse === 'HILI' && (r.brand || '').trim().toUpperCase() === 'SHIDDHART MEDIUM' && r.lcNo === '073926010073');
  if (!hasShiddhart2) {
    normalized.push({
      warehouse: 'HILI',
      productName: 'MOSUR DAL',
      brand: 'SHIDDHART MEDIUM',
      quality: 'MEDIUM',
      packetSize: 30,
      inHouseQuantity: 17475,
      inHousePacket: 582.5,
      quantity: 17475,
      packet: 582.5,
      purchasedPrice: 0,
      rate: 0,
      lcNo: '073926010073',
      unit: 'kg'
    });
    changed = true;
  }

  if (changed || normalized.length !== decrypted.snapshotRecords.length) {
    let totalInHouseBags = 0;
    let totalInHouseKg = 0;
    let totalStockValuation = 0;

    normalized.forEach(r => {
      const qty = parseFloat(r.inHouseQuantity ?? r.quantity) || 0;
      const pkt = parseFloat(r.inHousePacket ?? r.packet) || 0;
      const rate = parseFloat(r.purchasedPrice ?? r.rate) || 0;
      totalInHouseKg += qty;
      totalInHouseBags += pkt;
      totalStockValuation += (qty * rate);
    });

    decrypted.snapshotRecords = normalized;
    if (decrypted.summary) {
      decrypted.summary.totalInHouseQuantity = totalInHouseKg;
      decrypted.summary.totalInHousePacket = totalInHouseBags;
      decrypted.summary.totalValuation = totalStockValuation;
      decrypted.summary.totalBrands = new Set(normalized.map(s => `${s.productName}|${s.brand}`)).size;
    }
  }

  return { changed, decrypted };
};

const cleanupZeroStockBaselineItems = async () => {
  try {
    const baselines = await StockBaseline.find({});
    for (const doc of baselines) {
      if (!doc.data) continue;
      let decrypted;
      try {
        decrypted = decryptData(doc.data);
      } catch (e) {
        continue;
      }
      if (!decrypted || !Array.isArray(decrypted.snapshotRecords)) continue;

      const { changed, decrypted: normalizedDecrypted } = normalizeBaselineSnapshot(decrypted);

      if (changed) {
        const encrypted = encryptData(normalizedDecrypted);
        await StockBaseline.updateOne({ _id: doc._id }, { $set: { data: encrypted } });
        console.log(`[Startup Migration] Normalized records in StockBaseline ${doc._id}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up baseline items on startup:', error);
  }
};

// Migration: Re-populate customerId on all PurchaseReceive documents.
// Runs automatically after every backup restore to prevent customer purchase history
// mismatches caused by old backups that didn't store the customerId on Purchase Receives.
const migratePurchaseReceiveCustomerIds = async () => {
  try {
    const PRModel = mongoose.models['PurchaseReceive'];
    const PModel = mongoose.models['Purchase'];
    const CModel = mongoose.models['Customer'];
    if (!PRModel || !PModel || !CModel) return;

    const prDocs = await PRModel.find({});
    const purchaseDocs = await PModel.find({});
    const customerDocs = await CModel.find({});

    const customers = customerDocs.map(c => {
      let data = {};
      try { data = c.data ? decryptData(c.data) : {}; } catch (e) { }
      return { _id: c._id.toString(), ...data };
    }).filter(c => c.companyName || c.customerName);

    const purchaseByNo = {};
    purchaseDocs.forEach(p => {
      let data = {};
      try { data = p.data ? decryptData(p.data) : {}; } catch (e) { }
      const pNo = (data.purchaseNo || data.invoiceNo || '').trim().toUpperCase();
      if (pNo && !purchaseByNo[pNo]) purchaseByNo[pNo] = data;
    });

    const isPRMatchForCustomer = (prData, cust) => {
      const cComp = (cust.companyName || '').trim().toLowerCase();
      const cCust = (cust.customerName || '').trim().toLowerCase();
      const prComp = (prData.companyName || '').trim().toLowerCase();
      const prSupp = (prData.supplierName || '').trim().toLowerCase();

      if (cComp && prComp && (prComp === cComp || prComp.includes(cComp) || cComp.includes(prComp))) return true;
      if (cComp && prSupp && (prSupp === cComp || prSupp.includes(cComp) || cComp.includes(prSupp))) return true;
      if (cCust && prSupp && (prSupp === cCust || prSupp.includes(cCust) || cCust.includes(prSupp))) {
        if (!prComp || !cComp || prComp === cComp || prComp.includes(cComp) || cComp.includes(prComp)) return true;
      }
      return false;
    };

    let updated = 0;
    for (const prDoc of prDocs) {
      let prData = {};
      try { prData = prDoc.data ? decryptData(prDoc.data) : {}; } catch (e) { continue; }

      if (prData.customerId) continue;

      const pNo = (prData.purchaseNo || prData.purchaseReceiveNo || '').trim().toUpperCase();
      let targetCustomerId = null;

      if (pNo && purchaseByNo[pNo] && purchaseByNo[pNo].customerId) {
        targetCustomerId = purchaseByNo[pNo].customerId;
      }

      if (!targetCustomerId) {
        const matchedCust = customers.find(c => isPRMatchForCustomer(prData, c));
        if (matchedCust) targetCustomerId = matchedCust._id;
      }

      if (targetCustomerId) {
        prData.customerId = targetCustomerId;
        try {
          await PRModel.findByIdAndUpdate(prDoc._id, { data: encryptData(prData) });
          updated++;
        } catch (e) {
          console.error(`[PR Migration] Error updating PR ${prDoc._id}:`, e.message);
        }
      }
    }

    if (updated > 0) {
      console.log(`[Post-Restore Migration] Populated customerId on ${updated} PurchaseReceive document(s).`);
      if (memoryCache) memoryCache.purchaseReceives = null;
    }
  } catch (err) {
    console.error('[Post-Restore Migration] migratePurchaseReceiveCustomerIds error:', err);
  }
};

// Aligns sale item rates when unitPrice is the true price matching totalAmount
const repairSaleItemRates = async () => {
  try {
    const sales = await Sale.find();
    let fixedCount = 0;
    for (const doc of sales) {
      let saleData = doc.data ? decryptData(doc.data) : doc;
      if (saleData && saleData.data && typeof saleData.data === 'string') {
        try { saleData = decryptData(saleData.data); } catch (e) { }
      }
      if (!saleData || !Array.isArray(saleData.items)) continue;
      let modified = false;

      saleData.items.forEach(item => {
        (item.brandEntries || []).forEach(be => {
          const up = parseFloat(be.unitPrice);
          const r = parseFloat(be.rate);
          const tot = parseFloat(be.totalAmount);
          const qty = parseFloat(be.quantity);
          if (up > 0 && r > 0 && Math.abs(up - r) > 0.001) {
            if (tot > 0 && qty > 0 && Math.abs(qty * up - tot) < 1) {
              be.rate = up;
              be.amount = tot;
              modified = true;
            }
          }
        });
      });

      if (modified) {
        doc.data = encryptData(saleData);
        await doc.save();
        fixedCount++;
      }
    }
    if (fixedCount > 0) {
      console.log(`[Self-Healing] Repaired item rates on ${fixedCount} sale document(s).`);
    }
  } catch (e) {
    console.error('[Self-Healing] Error repairing sale item rates:', e);
  }
};

// System Self-Healing Migrations:
// Runs automatically after every backup restore AND on server startup.
// 1. Cleans up obsolete zero-stock baseline records.
// 2. Re-populates customerId on PurchaseReceive documents.
// 3. Normalizes and fixes Chondon entities (Bogura, Dinajpur, Gobindogonj) so sales/orders are never cross-contaminated.
// 4. Synchronizes sale item rates where unitPrice is the agreed price.
// 5. Scans and repairs all customer sales history across the database.
// 6. Clears all memory caches so frontend receives clean, exact balances.
const runSystemSelfHealingMigrations = async () => {
  try {
    console.log('[Self-Healing] Running database normalization & migrations...');
    if (typeof cleanupZeroStockBaselineItems === 'function') {
      await cleanupZeroStockBaselineItems();
    }
    if (typeof migratePurchaseReceiveCustomerIds === 'function') {
      await migratePurchaseReceiveCustomerIds();
    }
    if (typeof repairChondonEntities === 'function') {
      await repairChondonEntities();
    }
    if (typeof repairSaleItemRates === 'function') {
      await repairSaleItemRates();
    }
    if (typeof repairAllCustomerSalesHistory === 'function') {
      await repairAllCustomerSalesHistory();
    }
    if (typeof memoryCache !== 'undefined' && memoryCache) {
      memoryCache.customers = null;
      memoryCache.sales = null;
      memoryCache.purchaseReceives = null;
      memoryCache.purchases = null;
      memoryCache.stock = null;
    }
    console.log('[Self-Healing] All migrations completed successfully.');
  } catch (err) {
    console.error('[Self-Healing] Error during migrations:', err);
  }
};

// Run self-healing migrations on server startup once DB is connected
if (mongoose.connection.readyState === 1) {
  runSystemSelfHealingMigrations();
} else {
  mongoose.connection.once('open', () => {
    runSystemSelfHealingMigrations();
  });
}

// Secure Gateway
app.post('/v', (req, res, next) => {
  const { p, m, d } = req.body;
  if (!p || !m) return res.status(400).json({ message: 'Invalid gateway request' });

  const executeDispatch = () => {
    // Internal dispatching
    req.targetApiPath = p;
    req.url = p;
    req.originalUrl = p;
    req.method = m;
    req.body = d;

    const methodUpper = String(m || '').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(methodUpper)) {
      const origSend = res.send;
      let broadcastSent = false;
      res.send = function (data) {
        if (!broadcastSent && res.statusCode >= 200 && res.statusCode < 300) {
          broadcastSent = true;
          req._broadcastDone = true;
          const match = String(p || '').match(/\/api\/([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            const mod = match[1].toLowerCase();
            if (!['logs', 'auth', 'health'].includes(mod)) {
              console.log(`[Gateway Mutation] ${methodUpper} ${p} succeeded -> broadcasting module '${mod}'`);
              broadcastUpdate(mod, methodUpper.toLowerCase(), {
                path: p.split('?')[0]
              });
            }
          }
        }
        return origSend.apply(this, arguments);
      };
    }

    // Extract and populate req.query from p so router handlers receive query parameters
    try {
      const qIndex = p.indexOf('?');
      if (qIndex !== -1) {
        const qs = p.slice(qIndex + 1);
        const searchParams = new URLSearchParams(qs);
        req.query = Object.fromEntries(searchParams.entries());
      } else {
        req.query = {};
      }
    } catch (e) {
      req.query = {};
    }

    // Pass to internal router
    apiRouter(req, res, next);
  };

  // If this gateway call is attempting to login, apply loginLimiter to stop brute force
  if (typeof p === 'string' && (p === '/api/auth/login' || p.startsWith('/api/auth/login'))) {
    return loginLimiter(req, res, executeDispatch);
  }

  executeDispatch();
});

// Universal Authentication Middleware for ERP API
const requireAuth = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  // Extract path without query parameters or trailing slashes
  const rawPath = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '') || '/';

  // Whitelisted public routes that do not require an active session
  const publicPaths = [
    '/',
    '/api/auth/login',
    '/api/auth/check',
    '/api/auth/logout',
    '/api/health',
    '/api/logs/client-action',
    '/api/logs/heartbeat'
  ];

  if (publicPaths.includes(rawPath)) {
    return next();
  }

  // Reject unauthenticated requests
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Unauthorized: Please log in to continue.' });
  }

  next();
};

// Protect all internal API routes with authentication
apiRouter.use(requireAuth);

// Real-time synchronization middleware for database mutations
apiRouter.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    res.on('finish', () => {
      if (!req._broadcastDone && res.statusCode >= 200 && res.statusCode < 300) {
        const fullUrl = req.targetApiPath || req.originalUrl || req.url || '';
        const match = fullUrl.match(/\/api\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const mod = match[1].toLowerCase();
          if (!['logs', 'auth', 'health'].includes(mod)) {
            console.log(`[Router Socket] Mutation completed: ${req.method} ${fullUrl} -> broadcasting module '${mod}'`);
            broadcastUpdate(mod, req.method.toLowerCase(), {
              path: fullUrl.split('?')[0]
            });
          }
        }
      }
    });
  }
  next();
});

// Mount apiRouter for direct API requests (e.g. backup & restore uploads/downloads)
app.use(apiRouter);

// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

apiRouter.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: Date.now() });
});

// Lightweight Pending Indicators Endpoint
apiRouter.get('/api/pending-indicators', async (req, res) => {
  try {
    const now = Date.now();
    if (memoryCache.pendingIndicators && (now - memoryCache.pendingTimestamp < 45000)) {
      return res.json(memoryCache.pendingIndicators);
    }

    const getCachedOrFetch = async (cacheKey, Model, decryptFn) => {
      if (memoryCache[cacheKey]) return memoryCache[cacheKey];
      const records = await Model.find().sort({ createdAt: -1 });
      const decrypted = records.map(r => {
        let d = decryptData(r.data);
        if (d && d.data && typeof d.data === 'string' && !d.invoiceNo && !d.productName) {
          try { d = decryptData(d.data); } catch (e) { }
        }
        return { ...d, _id: r._id, createdAt: d?.createdAt || r.createdAt, ...(decryptFn ? decryptFn(r, d) : {}) };
      });
      memoryCache[cacheKey] = decrypted;
      return decrypted;
    };

    const [stockData, salesData, purchasesData, purchaseReceivesData, customersData, whData, insPaymentsData, cnfPaymentsData] = await Promise.all([
      getCachedOrFetch('stock', Stock),
      getCachedOrFetch('sales', Sale, (r, d) => ({ saleType: d.saleType || r.saleType, invoiceNo: d.invoiceNo || r.invoiceNo })),
      getCachedOrFetch('purchases', Purchase),
      getCachedOrFetch('purchaseReceives', PurchaseReceive),
      getCachedOrFetch('customers', Customer),
      getCachedOrFetch('warehouses', Warehouse),
      getCachedOrFetch('insurancePayments', InsurancePayment),
      getCachedOrFetch('cnfPayments', CnFPayment)
    ]);

    const hasRequestedLC = stockData.some(item => (item.status || '').toLowerCase() === 'requested' && !!item.lcNo);
    const hasRequestedStockMgmt = stockData.some(item => (item.status || '').toLowerCase() === 'requested' && !item.lcNo);
    const hasRequestedTransfer = whData.some(item => {
      let dec = item.data ? decryptData(item.data) : item;
      if (typeof dec === 'string') { try { dec = decryptData(dec); } catch (e) { } }
      return (dec?.status || '').toLowerCase() === 'requested';
    });

    const hasRequestedPurchase = purchasesData.some(item => {
      const status = (item.status || '').toLowerCase();
      const isReq = status === 'requested' || status === 'pending';
      const isEditReq = item.isEdited === true && !isReq;
      return isReq || isEditReq;
    });

    const hasRequestedPurchaseReceive = purchaseReceivesData.some(item => {
      const status = (item.status || '').toLowerCase();
      const isReq = status === 'requested' || status === 'pending';
      const isEditReq = item.isEdited === true && !isReq;
      return isReq || isEditReq;
    });

    const hasRequestedOrder = salesData.some(item => {
      const status = (item.status || '').toLowerCase();
      const type = (item.saleType || '').toLowerCase();
      const isOrder = type === 'order' || (item.invoiceNo || item.orderNo || '').startsWith('ORD');
      const isReq = status === 'requested';
      const isEditReq = item.isEdited === true && !isReq;
      return isOrder && (isReq || isEditReq);
    });

    const hasRequestedGeneralSale = salesData.some(item => {
      const status = (item.status || '').toLowerCase();
      const type = (item.saleType || '').toLowerCase();
      const isGeneral = type === 'general' || (item.invoiceNo || '').startsWith('GS');
      const isReq = status === 'requested';
      const isEditReq = item.isEdited === true && !isReq;
      return isGeneral && (isReq || isEditReq);
    });

    const hasRequestedBorderSale = salesData.some(item => {
      const status = (item.status || '').toLowerCase();
      const type = (item.saleType || '').toLowerCase();
      const isBorder = type === 'border' || (item.invoiceNo || '').startsWith('BS');
      const isReq = status === 'requested';
      const isEditReq = item.isEdited === true && !isReq;
      return isBorder && (isReq || isEditReq);
    });

    const hasRequestedPaymentCollection = customersData.some(item => {
      const history = Array.isArray(item.paymentHistory) ? item.paymentHistory : [];
      return history.some(p => {
        const status = (p.status || '').toLowerCase();
        const isReq = status === 'requested';
        const isEditReq = (p.isEdited === true || p.isEdited === 'true') && !isReq;
        return isReq || isEditReq;
      });
    });

    const hasRequestedPayToCustomer = customersData.some(item => {
      const history = Array.isArray(item.payToCustomerHistory) ? item.payToCustomerHistory : [];
      return history.some(p => {
        const status = (p.status || '').toLowerCase();
        const isReq = status === 'requested';
        const isEditReq = (p.isEdited === true || p.isEdited === 'true') && !isReq;
        return isReq || isEditReq;
      });
    });

    const hasRequestedInsurancePayment = insPaymentsData.some(p => (p.status || '').toLowerCase() === 'requested');
    const hasRequestedCnfPayment = cnfPaymentsData.some(p => (p.status || '').toLowerCase() === 'requested');

    const result = {
      lc: hasRequestedLC,
      stock: hasRequestedStockMgmt || hasRequestedTransfer,
      transfer: hasRequestedTransfer,
      sale: hasRequestedGeneralSale || hasRequestedBorderSale || hasRequestedOrder || hasRequestedPurchase || hasRequestedPurchaseReceive,
      crm: false,
      paymentCollection: hasRequestedPaymentCollection,
      payToCustomer: hasRequestedPayToCustomer,
      lcReceive: hasRequestedLC,
      stockManagement: hasRequestedStockMgmt,
      order: hasRequestedOrder,
      generalSale: hasRequestedGeneralSale,
      borderSale: hasRequestedBorderSale,
      purchase: hasRequestedPurchase,
      purchaseReceive: hasRequestedPurchaseReceive,
      insurancePayment: hasRequestedInsurancePayment,
      insurance: hasRequestedInsurancePayment,
      cnfPayment: hasRequestedCnfPayment,
      cnf: hasRequestedCnfPayment
    };

    memoryCache.pendingIndicators = result;
    memoryCache.pendingTimestamp = Date.now();
    res.json(result);
  } catch (err) {
    console.error('Error computing pending indicators:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Authorization Helper & Middleware
const isUserAdmin = async (user) => {
  if (!user) return false;
  const usernameLower = (user.username || '').toLowerCase().trim();
  if (usernameLower === 'admin' || usernameLower === 'superadmin') return true;
  const roleLower = (user.role || '').toLowerCase().trim();
  if (roleLower === 'admin' || roleLower === 'superadmin' || roleLower === 'incharge') return true;

  // Check if role is an ID that resolves to Admin in MetaData
  if (/^[0-9a-fA-F]{24}$/.test(user.role)) {
    try {
      const MetaData = require('./models/MetaData');
      const rec = await MetaData.findById(user.role);
      if (rec) {
        const d = decryptData(rec.data);
        const name = (d?.name || '').toLowerCase().trim();
        if (['admin', 'superadmin', 'incharge'].includes(name)) return true;
      }
    } catch (e) { }
  }

  // Check custom permissions for backupRestore module
  if (user.permissions && user.permissions.backupRestore && (user.permissions.backupRestore.view || user.permissions.backupRestore.edit || user.permissions.backupRestore.add || user.permissions.backupRestore.special)) {
    return true;
  }

  // Check custom permissions for log module
  if (user.permissions && user.permissions.log && user.permissions.log.view) {
    return true;
  }

  return false;
};

const adminOnly = async (req, res, next) => {
  const user = req.session?.user;
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};

const adminOrLcManager = (req, res, next) => {
  return verifyPermission('importerExporter', 'edit')(req, res, next);
};

const adminOrSalesManager = async (req, res, next) => {
  const user = req.session?.user;
  const isAdmin = await isUserAdmin(user);
  const isAuthorized = isAdmin || ((user?.role || '').toLowerCase().trim() === 'sales manager');
  if (!isAuthorized) {
    return res.status(403).json({ message: 'Forbidden: Admin or Sales Manager access required' });
  }
  next();
};

const getDefaultPermissionsForRole = (role) => {
  const roleLower = (role || '').toLowerCase();
  const defaults = {};

  const modules = [
    'employees', 'attendance', 'port', 'importerExporter', 'cnf', 'cnfPayment', 'ipManagement', 'pi', 'packingList', 'trSetup',
    'product', 'customer', 'lcReceive', 'warehouse', 'stock', 'sales', 'borderSale', 'purchase', 'purchaseReceive', 'profitLoss', 'costOfGoods', 'paymentCollection', 'payToCustomer', 'bank',
    'insurance', 'insurancePayment', 'lcManagement', 'lcGp', 'lcExpense', 'returnProduct', 'backupRestore', 'log'
  ];

  modules.forEach(m => {
    defaults[m] = { view: false, add: false, edit: false, delete: false, special: false, showRate: false, approveLeave: false, editLeave: false };
  });

  if (roleLower === 'admin') {
    modules.forEach(m => {
      defaults[m] = { view: true, add: true, edit: true, delete: true, special: true, showRate: true, approveLeave: true, editLeave: true };
    });
  } else if (roleLower === 'incharge') {
    modules.forEach(m => {
      if (m !== 'backupRestore' && m !== 'log') {
        defaults[m] = { view: true, add: true, edit: true, delete: m !== 'employees', special: true, showRate: true, approveLeave: false, editLeave: false };
      }
    });
  } else if (roleLower === 'lc manager') {
    const lcModules = ['port', 'importerExporter', 'cnf', 'cnfPayment', 'ipManagement', 'pi', 'packingList', 'trSetup', 'lcReceive', 'warehouse', 'lcManagement', 'lcGp', 'lcExpense', 'costOfGoods', 'purchase', 'purchaseReceive'];
    lcModules.forEach(m => {
      defaults[m] = { view: true, add: true, edit: true, delete: true, special: true, showRate: false };
    });
  } else if (roleLower === 'sales manager') {
    const salesModules = ['product', 'customer', 'sales', 'borderSale', 'purchase', 'purchaseReceive', 'profitLoss', 'costOfGoods', 'paymentCollection', 'payToCustomer', 'bank', 'insurance', 'insurancePayment', 'returnProduct'];
    salesModules.forEach(m => {
      defaults[m] = { view: true, add: true, edit: true, delete: true, special: true, showRate: false };
    });
  } else if (roleLower === 'accounts manager') {
    const accModules = ['paymentCollection', 'payToCustomer', 'bank', 'insurance', 'insurancePayment', 'returnProduct', 'costOfGoods', 'purchase', 'purchaseReceive'];
    accModules.forEach(m => {
      defaults[m] = { view: true, add: true, edit: true, delete: true, special: true, showRate: false };
    });
    defaults['employees'] = { view: true, add: false, edit: true, delete: false, special: false, showRate: false };
  } else if (roleLower === 'border manager') {
    const borderModules = ['port', 'importerExporter', 'cnf', 'cnfPayment', 'ipManagement', 'lcReceive', 'warehouse', 'lcManagement', 'lcGp', 'lcExpense', 'purchase', 'purchaseReceive', 'borderSale'];
    borderModules.forEach(m => {
      defaults[m] = { view: true, add: true, edit: true, delete: true, special: true, showRate: false };
    });
  } else if (roleLower === 'data entry') {
    modules.forEach(m => {
      if (m !== 'backupRestore' && m !== 'log') {
        defaults[m] = { view: true, add: true, edit: true, delete: false, special: false, showRate: false };
      }
    });
  } else {
    const staffModules = ['product', 'customer', 'stock', 'sales'];
    staffModules.forEach(m => {
      defaults[m] = { view: true, add: false, edit: false, delete: false, special: false, showRate: false };
    });
  }

  return defaults;
};

const resolveRoleToStore = async (roleName) => {
  if (!roleName) return 'staff';
  try {
    const MetaData = require('./models/MetaData');
    const records = await MetaData.find({ category: 'roles' });
    const match = records.find(r => {
      try {
        const d = decryptData(r.data);
        return d && d.name && d.name.toLowerCase() === roleName.toLowerCase();
      } catch (e) {
        return false;
      }
    });
    return match ? match._id.toString() : roleName;
  } catch (e) {
    console.error('Error resolving role to store:', e);
    return roleName;
  }
};

const resolveRoleToDisplay = async (roleVal) => {
  if (!roleVal) return 'General Staff';
  if (/^[0-9a-fA-F]{24}$/.test(roleVal)) {
    try {
      const MetaData = require('./models/MetaData');
      const record = await MetaData.findById(roleVal);
      if (record) {
        const d = decryptData(record.data);
        if (d && d.name) {
          return d.name;
        }
      }
    } catch (e) {
      console.error('Error translating role ID to name:', e);
    }
  }
  return roleVal;
};

const resolveUserPermissions = async (role, customPermissions) => {
  // Build full role defaults (includes all known modules)
  const roleDefaults = getDefaultPermissionsForRole(role);

  // Check for a role-level override stored in MetaData (from RoleCreation)
  let roleOverridePermissions = null;
  try {
    const MetaData = require('./models/MetaData');
    const records = await MetaData.find({ category: 'roles' });
    const match = records.find(r => {
      try {
        const d = decryptData(r.data);
        const roleStr = (role || '').toString().toLowerCase();
        return d && (
          (r._id.toString() === role) ||
          (d.name && d.name.toLowerCase() === roleStr)
        );
      } catch (e) {
        return false;
      }
    });
    if (match) {
      const dec = decryptData(match.data);
      if (dec && dec.permissions) {
        roleOverridePermissions = dec.permissions;
      }
    }
  } catch (e) {
    console.error('Error resolving role override:', e);
  }

  if (customPermissions && Object.keys(customPermissions).length > 0) {
    // Merge: start with role defaults as base, overlay role-override, then apply custom permissions on top.
    // This ensures any newly added modules get their role-default values even if the
    // custom permissions object was saved before that module was added.
    const base = { ...roleDefaults, ...(roleOverridePermissions || {}) };
    return { ...base, ...customPermissions };
  }

  // No custom permissions — use role override if available, else role defaults
  return roleOverridePermissions || roleDefaults;
};

const verifyPermission = (moduleName, action = 'view') => {
  return async (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (user.username === 'admin' || (user.role || '').toLowerCase() === 'admin') {
      return next();
    }

    const resolvedPerms = await resolveUserPermissions(user.role, user.permissions);

    if (resolvedPerms && resolvedPerms[moduleName] && resolvedPerms[moduleName][action]) {
      return next();
    }

    // Fallback: If checking attendance, allow if user has employees permission for backwards compatibility
    if (moduleName === 'attendance' && resolvedPerms && resolvedPerms['employees'] && resolvedPerms['employees'][action]) {
      return next();
    }

    return res.status(403).json({ message: `Forbidden: You do not have permission to ${action} in ${moduleName}` });
  };
};

const ROUTE_MODEL_MAP = {
  'sales': Sale,
  'customers': Customer,
  'products': Product,
  'purchases': Purchase,
  'purchase-receives': PurchaseReceive,
  'employees': Employee,
  'importers': Importer,
  'exporters': Exporter,
  'suppliers': Supplier,
  'ports': Port,
  'warehouses': Warehouse,
  'stock': Stock,
  'damages': Damage,
  'returns': Return,
  'banks': Bank,
  'insurance': Insurance,
  'insurance-payments': InsurancePayment,
  'lc-management': LCManagement,
  'lc-gp': LCGatePass,
  'lc-expenses': LCExpense,
  'margin-returns': MarginReturn,
  'pi': PI,
  'packing-lists': PackingList,
  'tr-setups': TRSetup,
  'cost-of-goods': CostOfGoods,
  'cnfs': CnF,
  'cnf-payments': CnFPayment,
  'metadata': MetaData,
  'users': User,
  'ip-records': IpRecord,
  'stock-baseline': StockBaseline
};

// Global Activity / Audit Logging Middleware
apiRouter.use(async (req, res, next) => {
  const method = req.method;
  const url = req.originalUrl || req.url;

  // Only log state mutations, auth actions, or specific system operations
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  const isAuthOrBackup = url.includes('/login') || url.includes('/logout') || url.includes('/backup') || url.includes('/restore');
  const isExcluded = url.includes('/logs') || url.includes('/notifications');

  if (isExcluded || (!isMutating && !isAuthOrBackup)) {
    return next();
  }

  const reqBodySnapshot = sanitizePayload(req.body);
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
  const userAgent = req.headers['user-agent'] || '';

  let resBodyData = null;
  const originalJson = res.json;
  res.json = function (data) {
    resBodyData = data;
    return originalJson.apply(this, arguments);
  };
  const originalSend = res.send;
  res.send = function (data) {
    if (!resBodyData && data) {
      try {
        resBodyData = typeof data === 'string' ? JSON.parse(data) : data;
      } catch (e) { }
    }
    return originalSend.apply(this, arguments);
  };

  let previousDocSnapshot = null;
  if (method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    const match = url.match(/(?:\/api)?\/([a-zA-Z0-9_-]+)\/([a-f0-9]{24})/i);
    if (match) {
      const routeKey = match[1].toLowerCase();
      const docId = match[2];
      const model = ROUTE_MODEL_MAP[routeKey];
      if (model) {
        try {
          const doc = await model.findById(docId).lean();
          if (doc) {
            previousDocSnapshot = resolvePayloadObject(doc);
            if (doc.category && !previousDocSnapshot.category) {
              previousDocSnapshot.category = doc.category;
            }
          }
        } catch (e) { }
      }
    }
  }

  res.on('finish', () => {
    try {
      const user = req.session?.user;
      const username = user?.username || reqBodySnapshot?.username || reqBodySnapshot?.entryBy || reqBodySnapshot?.updatedBy || reqBodySnapshot?.userId || reqBodySnapshot?.user?.username || 'anonymous';
      const userRole = user?.role || reqBodySnapshot?.userRole || reqBodySnapshot?.createdRole || '';
      const displayName = user?.name || reqBodySnapshot?.entryByName || reqBodySnapshot?.updatedByName || username;
      const userId = user?.id || reqBodySnapshot?.userId || '';
      const status = res.statusCode < 400 ? 'SUCCESS' : 'FAILED';

      if (username === 'anonymous' && !url.includes('/login')) {
        return;
      }

      // Do not log notification operations
      if (url.includes('/notifications')) {
        return;
      }

      // Do not log operations explicitly marked to skip activity logging (e.g. automated background ledger syncs)
      const targetObj = resolvePayloadObject(reqBodySnapshot);
      if (targetObj && (targetObj._skipActivityLog === true || targetObj.isSaleSync === true || targetObj.isAutomatedSync === true)) {
        return;
      }

      // Skip read-only metadata/status/file listing queries for backup & restore so audit logs aren't spammed with fake backups
      if (
        method === 'GET' &&
        (url.includes('/backup-modules') || url.includes('/backup-settings') || url.includes('/backup-files'))
      ) {
        return;
      }

      // Explicitly log actual backup, restore, and optimize operations
      if (url.includes('/backup-database') || url.includes('/restore') || url.includes('/backup-files/optimize')) {
        const isRestore = url.includes('/restore');
        const isOptimize = url.includes('/optimize');
        logActivity({
          userId,
          username,
          userRole,
          displayName,
          module: 'Backup & Restore',
          action: isRestore ? 'RESTORE' : isOptimize ? 'OPTIMIZE' : 'BACKUP',
          actionCategory: 'SYSTEM',
          description: isRestore ? 'System database restore' : isOptimize ? 'Optimized backup storage archives' : 'System database backup exported',
          details: { message: isRestore ? 'Database restored from archive' : isOptimize ? 'Removed large base64 image bloat from backups' : 'Database backup generated and exported' },
          ip: clientIp,
          userAgent,
          method,
          path: url,
          status
        });
        return;
      }

      // Delete backup file
      if (method === 'DELETE' && url.includes('/backup-files/')) {
        const filename = decodeURIComponent(url.split('/backup-files/')[1] || '').split('?')[0];
        logActivity({
          userId,
          username,
          userRole,
          displayName,
          module: 'Backup & Restore',
          action: 'DELETE',
          actionCategory: 'SYSTEM',
          description: `Deleted backup file ${filename || ''}`.trim(),
          details: { filename },
          ip: clientIp,
          userAgent,
          method,
          path: url,
          status
        });
        return;
      }

      // Update backup settings
      if (method === 'POST' && url.includes('/backup-settings')) {
        logActivity({
          userId,
          username,
          userRole,
          displayName,
          module: 'Backup & Restore',
          action: 'UPDATE',
          actionCategory: 'SYSTEM',
          description: 'Updated auto-backup settings',
          details: req.body || {},
          ip: clientIp,
          userAgent,
          method,
          path: url,
          status
        });
        return;
      }

      const module = resolveModuleFromPath(url, reqBodySnapshot);
      const { action, category } = resolveActionDetails(method, url, reqBodySnapshot, previousDocSnapshot);

      let cleanSnapshot = resolvePayloadObject(reqBodySnapshot);
      if (method === 'DELETE' && previousDocSnapshot) {
        cleanSnapshot = { ...previousDocSnapshot };
      } else {
        const freshReq = sanitizePayload(req.body);
        const resolvedFresh = resolvePayloadObject(freshReq);
        const resolvedRes = resBodyData ? resolvePayloadObject(resBodyData) : {};
        cleanSnapshot = {
          ...cleanSnapshot,
          ...resolvedFresh,
          ...(resolvedRes.invoiceNo ? { invoiceNo: resolvedRes.invoiceNo } : {}),
          ...(resolvedRes.orderNo ? { orderNo: resolvedRes.orderNo } : {}),
          ...(resolvedRes.challanNo ? { challanNo: resolvedRes.challanNo } : {}),
          ...(resolvedRes._id ? { _id: resolvedRes._id } : {})
        };
      }

      let filledFields = [];
      if (action === 'UPDATE' || action === 'UPDATE_ORIGINAL' || action === 'REVISE' || method === 'PUT' || method === 'PATCH') {
        if (Array.isArray(cleanSnapshot._updatedFields) && cleanSnapshot._updatedFields.length > 0) {
          filledFields = cleanSnapshot._updatedFields;
        } else if (previousDocSnapshot) {
          filledFields = computeUpdatedFields(previousDocSnapshot, cleanSnapshot);
        } else {
          filledFields = [];
        }
      } else {
        filledFields = extractFilledFields(cleanSnapshot, action);
      }

      // Skip logging customer updates if no customer profile fields changed (e.g. background salesHistory/paymentHistory updates)
      if (/^\/api\/customers\//i.test(url) && (method === 'PUT' || method === 'PATCH') && (action === 'UPDATE' || action === 'EDIT')) {
        if (!filledFields || filledFields.length === 0) {
          return;
        }
      }

      const description = generateOperationDescription(method, url, module, cleanSnapshot, res.statusCode, filledFields, action, previousDocSnapshot);

      logActivity({
        userId,
        username,
        userRole,
        displayName,
        module,
        action,
        actionCategory: category,
        description,
        details: {
          ...cleanSnapshot,
          _filledFields: filledFields,
          _updatedFields: (action === 'UPDATE' || action === 'UPDATE_ORIGINAL' || action === 'REVISE') ? filledFields : undefined
        },
        ip: clientIp,
        userAgent,
        method,
        path: url,
        status
      });
    } catch (err) {
      console.error('[OperationLogger] Error logging request:', err.message);
    }
  });

  next();
});

// IP Records APIs
apiRouter.post('/api/ip-records', async (req, res) => {
  try {
    // Check for duplicate IP Number
    if (req.body.ipNumber) {
      const cleanIpNumber = req.body.ipNumber.trim().toLowerCase();
      const existingRecords = await IpRecord.find({});
      const isDuplicate = existingRecords.some(record => {
        try {
          const data = decryptData(record.data);
          return data.ipNumber && data.ipNumber.trim().toLowerCase() === cleanIpNumber;
        } catch (e) {
          return false;
        }
      });
      if (isDuplicate) {
        return res.status(400).json({ message: 'Duplicate IP Number detected! This IP Number already exists in the system.' });
      }
    }

    const encryptedData = encryptData(req.body);
    const newRecord = new IpRecord({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('ip-records', 'create', { id: savedRecord._id, ipRecord: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete IP Record
apiRouter.delete('/api/ip-records/:id', async (req, res) => {
  try {
    const deletedRecord = await IpRecord.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Record not found' });
    broadcastUpdate('ip-records', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update IP Record (for Edit functionality)
apiRouter.put('/api/ip-records/:id', async (req, res) => {
  try {
    // Check for duplicate IP Number
    if (req.body.ipNumber) {
      const cleanIpNumber = req.body.ipNumber.trim().toLowerCase();
      const existingRecords = await IpRecord.find({});
      const isDuplicate = existingRecords.some(record => {
        if (record._id.toString() === req.params.id) return false;
        try {
          const data = decryptData(record.data);
          return data.ipNumber && data.ipNumber.trim().toLowerCase() === cleanIpNumber;
        } catch (e) {
          return false;
        }
      });
      if (isDuplicate) {
        return res.status(400).json({ message: 'Duplicate IP Number detected! This IP Number already exists in the system.' });
      }
    }

    const encryptedData = encryptData(req.body);
    const updatedRecord = await IpRecord.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('ip-records', 'update', { id: req.params.id, ipRecord: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/ip-records', async (req, res) => {
  try {
    const records = await IpRecord.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Importer APIs
apiRouter.post('/api/importers', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newImporter = new Importer({ data: encryptedData });
    const savedImporter = await newImporter.save();
    const result = { ...req.body, _id: savedImporter._id, createdAt: savedImporter.createdAt };
    broadcastUpdate('importers', 'create', { id: savedImporter._id, importer: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete Importer
apiRouter.delete('/api/importers/:id', adminOnly, async (req, res) => {
  try {
    const deletedImporter = await Importer.findByIdAndDelete(req.params.id);
    if (!deletedImporter) return res.status(404).json({ message: 'Importer not found' });
    broadcastUpdate('importers', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Importer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Importer
apiRouter.put('/api/importers/:id', verifyPermission('importerExporter', 'edit'), async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedImporter = await Importer.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedImporter) return res.status(404).json({ message: 'Importer not found' });
    const result = { ...req.body, _id: updatedImporter._id, createdAt: updatedImporter.createdAt };
    broadcastUpdate('importers', 'update', { id: req.params.id, importer: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/importers', async (req, res) => {
  try {
    const records = await Importer.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Exporter APIs
apiRouter.post('/api/exporters', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newExporter = new Exporter({ data: encryptedData });
    const savedExporter = await newExporter.save();
    const result = { ...req.body, _id: savedExporter._id, createdAt: savedExporter.createdAt };
    broadcastUpdate('exporters', 'create', { id: savedExporter._id, exporter: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete Exporter
apiRouter.delete('/api/exporters/:id', adminOnly, async (req, res) => {
  try {
    const deletedExporter = await Exporter.findByIdAndDelete(req.params.id);
    if (!deletedExporter) return res.status(404).json({ message: 'Exporter not found' });
    broadcastUpdate('exporters', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Exporter deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Exporter
apiRouter.put('/api/exporters/:id', verifyPermission('importerExporter', 'edit'), async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedExporter = await Exporter.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedExporter) return res.status(404).json({ message: 'Exporter not found' });
    const result = { ...req.body, _id: updatedExporter._id, createdAt: updatedExporter.createdAt };
    broadcastUpdate('exporters', 'update', { id: req.params.id, exporter: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/exporters', async (req, res) => {
  try {
    const records = await Exporter.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Supplier APIs
apiRouter.post('/api/suppliers', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newSupplier = new Supplier({ data: encryptedData });
    const savedSupplier = await newSupplier.save();
    const result = { ...req.body, _id: savedSupplier._id, createdAt: savedSupplier.createdAt };
    broadcastUpdate('suppliers', 'create', { id: savedSupplier._id, supplier: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete Supplier
apiRouter.delete('/api/suppliers/:id', adminOnly, async (req, res) => {
  try {
    const deletedSupplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!deletedSupplier) return res.status(404).json({ message: 'Supplier not found' });
    broadcastUpdate('suppliers', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Supplier
apiRouter.put('/api/suppliers/:id', verifyPermission('importerExporter', 'edit'), async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedSupplier = await Supplier.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedSupplier) return res.status(404).json({ message: 'Supplier not found' });
    const result = { ...req.body, _id: updatedSupplier._id, createdAt: updatedSupplier.createdAt };
    broadcastUpdate('suppliers', 'update', { id: req.params.id, supplier: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/suppliers', async (req, res) => {
  try {
    const records = await Supplier.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cost of Goods APIs
apiRouter.post('/api/cost-of-goods', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new CostOfGoods({ data: encryptedData });
    const savedRecord = await newRecord.save();
    invalidateMemoryCache('cost-of-goods');
    broadcastUpdate('cost-of-goods', 'create', { _id: savedRecord._id });
    req._broadcastDone = true;
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/cost-of-goods/:id', async (req, res) => {
  try {
    const deletedRecord = await CostOfGoods.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Record not found' });
    invalidateMemoryCache('cost-of-goods');
    broadcastUpdate('cost-of-goods', 'delete', { _id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/cost-of-goods/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await CostOfGoods.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Record not found' });
    invalidateMemoryCache('cost-of-goods');
    broadcastUpdate('cost-of-goods', 'update', { _id: updatedRecord._id });
    req._broadcastDone = true;
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/cost-of-goods', async (req, res) => {
  try {
    if (memoryCache.costOfGoods && !req.query._t && !req.query._nocache) {
      return res.json(memoryCache.costOfGoods);
    }
    const records = await CostOfGoods.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.costOfGoods = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// C&F APIs
apiRouter.post('/api/cnfs', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newCnF = new CnF({ data: encryptedData });
    const savedCnF = await newCnF.save();
    const result = { ...req.body, _id: savedCnF._id, createdAt: savedCnF.createdAt };
    broadcastUpdate('cnfs', 'create', { id: savedCnF._id, cnf: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/cnfs/:id', adminOnly, async (req, res) => {
  try {
    const deletedCnF = await CnF.findByIdAndDelete(req.params.id);
    if (!deletedCnF) return res.status(404).json({ message: 'C&F not found' });
    broadcastUpdate('cnfs', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'C&F deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/cnfs/:id', adminOnly, async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedCnF = await CnF.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedCnF) return res.status(404).json({ message: 'C&F not found' });
    const result = { ...req.body, _id: updatedCnF._id, createdAt: updatedCnF.createdAt };
    broadcastUpdate('cnfs', 'update', { id: req.params.id, cnf: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/cnfs', async (req, res) => {
  try {
    const records = await CnF.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// C&F Payment APIs
apiRouter.post('/api/cnf-payments', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new CnFPayment({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('cnf-payments', 'create', { id: savedRecord._id, payment: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/cnf-payments/:id', async (req, res) => {
  try {
    const record = await CnFPayment.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Payment record not found' });

    const decData = decryptData(record.data);
    if (decData && decData.lcExpenseId) {
      await LCExpense.findByIdAndDelete(decData.lcExpenseId);
    }

    await CnFPayment.findByIdAndDelete(req.params.id);
    broadcastUpdate('cnf-payments', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Payment record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/cnf-payments/:id', async (req, res) => {
  try {
    const record = await CnFPayment.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Payment record not found' });

    const decData = decryptData(record.data);
    if (decData && decData.lcExpenseId) {
      const expense = await LCExpense.findById(decData.lcExpenseId);
      if (expense) {
        const decExpense = decryptData(expense.data);
        const updatedExpenseBody = {
          ...decExpense,
          amount: parseFloat(req.body.amount) || 0,
          date: req.body.date || decExpense.date,
          remarks: req.body.remarks || decExpense.remarks
        };
        const encExpenseData = encryptData(updatedExpenseBody);
        await LCExpense.findByIdAndUpdate(decData.lcExpenseId, { data: encExpenseData });
      }
    }

    const encryptedData = encryptData(req.body);
    const updatedRecord = await CnFPayment.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('cnf-payments', 'update', { id: req.params.id, payment: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/cnf-payments', async (req, res) => {
  try {
    if (memoryCache.cnfPayments) {
      return res.json(memoryCache.cnfPayments);
    }
    const records = await CnFPayment.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.cnfPayments = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Port APIs
apiRouter.post('/api/ports', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newPort = new Port({ data: encryptedData });
    const savedPort = await newPort.save();
    const result = { ...req.body, _id: savedPort._id, createdAt: savedPort.createdAt };
    broadcastUpdate('ports', 'create', { id: savedPort._id, port: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/ports/:id', async (req, res) => {
  try {
    const deletedPort = await Port.findByIdAndDelete(req.params.id);
    if (!deletedPort) return res.status(404).json({ message: 'Port not found' });
    broadcastUpdate('ports', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Port deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/ports/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedPort = await Port.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedPort) return res.status(404).json({ message: 'Port not found' });
    const result = { ...req.body, _id: updatedPort._id, createdAt: updatedPort.createdAt };
    broadcastUpdate('ports', 'update', { id: req.params.id, port: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/ports', async (req, res) => {
  try {
    const records = await Port.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Stock APIs
apiRouter.post('/api/stock', async (req, res) => {
  try {
    const userSession = req.session.user;
    const hasAddPermission = userSession && (
      userSession.username === 'admin' ||
      (userSession.role || '').toLowerCase() === 'admin' ||
      (userSession.permissions && (
        (userSession.permissions.lcReceive && userSession.permissions.lcReceive.add === true) ||
        (userSession.permissions.stock && userSession.permissions.stock.add === true) ||
        (userSession.permissions.purchaseReceive && userSession.permissions.purchaseReceive.add === true) ||
        (userSession.permissions.purchase && userSession.permissions.purchase.add === true)
      ))
    );

    if (!hasAddPermission) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to add stock/LC Receive records.' });
    }

    let finalData;
    let resolvedBody = req.body;
    if (req.body && typeof req.body.data === 'string' && req.body.data.startsWith('U2FsdGVk')) {
      finalData = req.body.data;
      try { resolvedBody = decryptData(req.body.data) || req.body; } catch (e) { }
    } else {
      finalData = encryptData(req.body);
    }
    const stockDoc = { data: finalData };
    if (resolvedBody.createdAt || req.body.createdAt) {
      stockDoc.createdAt = new Date(resolvedBody.createdAt || req.body.createdAt);
    }
    const newStock = new Stock(stockDoc);
    const savedStock = await newStock.save();
    const result = { ...resolvedBody, _id: savedStock._id, createdAt: resolvedBody.createdAt || savedStock.createdAt };
    broadcastUpdate('stock', 'create', { id: savedStock._id, stock: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/stock/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    const hasDeletePermission = userSession && (
      userSession.username === 'admin' ||
      (userSession.role || '').toLowerCase() === 'admin' ||
      (userSession.permissions && (
        (userSession.permissions.lcReceive && userSession.permissions.lcReceive.delete === true) ||
        (userSession.permissions.stock && userSession.permissions.stock.delete === true) ||
        (userSession.permissions.purchaseReceive && userSession.permissions.purchaseReceive.delete === true) ||
        (userSession.permissions.purchase && userSession.permissions.purchase.delete === true)
      ))
    );

    const existingStock = await Stock.findById(req.params.id);
    if (!existingStock) return res.status(404).json({ message: 'Item not found' });

    let existingData = decryptData(existingStock.data);
    if (existingData && existingData.data && typeof existingData.data === 'string' && !existingData.productName) {
      try { existingData = decryptData(existingData.data); } catch (e) { }
    }

    if (existingData && existingData.status === 'Requested') {
      const ownerUser = (existingData.requestedByUsername || '').trim().toLowerCase();
      const ownerName = (existingData.requestedBy || '').trim().toLowerCase();
      const curUser = (userSession?.username || '').trim().toLowerCase();
      const curName = (userSession?.name || '').trim().toLowerCase();
      const isOwner = (ownerUser && (ownerUser === curUser || (curName && ownerUser === curName))) ||
        (ownerName && (ownerName === curUser || (curName && ownerName === curName)));

      if (!hasDeletePermission && !isOwner) {
        return res.status(403).json({ message: 'Forbidden: Only the owner of the requested stock entry or an authorized user can delete it.' });
      }
    } else {
      if (!hasDeletePermission) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to delete accepted stock entries.' });
      }
    }

    const deletedStock = await Stock.findByIdAndDelete(req.params.id);
    broadcastUpdate('stock', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/stock/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    const hasEditPermission = userSession && (
      userSession.username === 'admin' ||
      (userSession.role || '').toLowerCase() === 'admin' ||
      (userSession.permissions && (
        (userSession.permissions.lcReceive && userSession.permissions.lcReceive.edit === true) ||
        (userSession.permissions.stock && userSession.permissions.stock.edit === true) ||
        (userSession.permissions.purchaseReceive && userSession.permissions.purchaseReceive.edit === true) ||
        (userSession.permissions.purchase && userSession.permissions.purchase.edit === true)
      ))
    );

    const existingStock = await Stock.findById(req.params.id);
    if (!existingStock) return res.status(404).json({ message: 'Item not found' });

    let existingData = decryptData(existingStock.data);
    if (existingData && existingData.data && typeof existingData.data === 'string' && !existingData.productName) {
      try { existingData = decryptData(existingData.data); } catch (e) { }
    }

    if (existingData && existingData.status === 'Requested') {
      const isStatusChange = req.body.status !== existingData.status;
      if (isStatusChange) {
        const canApprove = userSession && (
          ['admin', 'incharge', 'sales manager', 'purchase manager'].includes((userSession.role || '').toLowerCase()) ||
          userSession.username === 'admin' ||
          (userSession.permissions && (
            (userSession.permissions.lcReceive && userSession.permissions.lcReceive.special === true) ||
            (userSession.permissions.stock && userSession.permissions.stock.special === true) ||
            (userSession.permissions.purchaseReceive && userSession.permissions.purchaseReceive.special === true) ||
            (userSession.permissions.purchase && userSession.permissions.purchase.special === true)
          ))
        );
        if (!canApprove) {
          return res.status(403).json({ message: 'Forbidden: You do not have permission to approve/reject requested entries.' });
        }
      } else {
        const ownerUser = (existingData.requestedByUsername || '').trim().toLowerCase();
        const ownerName = (existingData.requestedBy || '').trim().toLowerCase();
        const curUser = (userSession?.username || '').trim().toLowerCase();
        const curName = (userSession?.name || '').trim().toLowerCase();
        const isOwner = (ownerUser && (ownerUser === curUser || (curName && ownerUser === curName))) ||
          (ownerName && (ownerName === curUser || (curName && ownerName === curName)));

        if (!hasEditPermission && !isOwner) {
          return res.status(403).json({ message: 'Forbidden: Only the owner of the requested stock entry can edit it.' });
        }
      }
    } else {
      if (!hasEditPermission) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to edit accepted stock entries.' });
      }
    }

    let finalData;
    let resolvedBody = req.body;
    if (req.body && typeof req.body.data === 'string' && req.body.data.startsWith('U2FsdGVk')) {
      finalData = req.body.data;
      try { resolvedBody = decryptData(req.body.data) || req.body; } catch (e) { }
    } else {
      finalData = encryptData(req.body);
    }
    const updateDoc = { data: finalData };
    if (resolvedBody.createdAt || req.body.createdAt) {
      updateDoc.createdAt = new Date(resolvedBody.createdAt || req.body.createdAt);
    }
    const updatedStock = await Stock.findByIdAndUpdate(req.params.id, updateDoc, { returnDocument: 'after' });
    const result = { ...resolvedBody, _id: req.params.id, createdAt: resolvedBody.createdAt || updatedStock?.createdAt };
    broadcastUpdate('stock', 'update', { id: req.params.id, stock: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/stock', async (req, res) => {
  try {
    if (req.query._t || req.query._nocache) {
      memoryCache.stock = null;
    }
    if (memoryCache.stock) {
      return res.json(memoryCache.stock);
    }
    const stock = await Stock.find().sort({ createdAt: -1 });
    const decrypted = stock.map(r => {
      let d = decryptData(r.data);
      // Auto-fallback for testing records that were double-encrypted by the bug
      if (d && d.data && typeof d.data === 'string' && !d.productName) {
        try { d = decryptData(d.data); } catch (e) { /* ignore */ }
      }
      return { ...d, _id: r._id, createdAt: d?.createdAt || r.createdAt };
    });
    memoryCache.stock = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper for automated snapshot backup (backups directory is ignored by nodemon)
const createStockBackupSnapshot = async (prefix = 'stock_baseline') => {
  try {
    const BACKUP_DIR = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const models = mongoose.connection.models;
    const backupData = {};
    for (const modelName in models) {
      const Model = models[modelName];
      const documents = await Model.find({}).lean();
      backupData[modelName] = documents;
    }
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${prefix}-${dateStr}.json`;
    const fullPath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(fullPath, JSON.stringify({
      version: '1.0',
      timestamp: now.toISOString(),
      reason: prefix,
      data: backupData
    }, null, 2));
    console.log(`[Backup] Automatic safety backup created at ${fullPath}`);
    return filename;
  } catch (err) {
    console.error('Failed to create automatic safety backup:', err);
    return null;
  }
};

// Stock Baseline APIs (Set Initial Stage & Rollover)
apiRouter.post('/api/stock-baseline', async (req, res) => {
  try {
    const userSession = req.session.user;
    const hasPermission = userSession && (
      userSession.username === 'admin' ||
      (userSession.role || '').toLowerCase() === 'admin' ||
      (userSession.permissions && userSession.permissions.stock && (
        userSession.permissions.stock.special === true ||
        userSession.permissions.stock.edit === true
      ))
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Admin or authorized Stock Manager permission required.' });
    }

    const { baselineDate, note, snapshotRecords, summary, setBy } = req.body;

    if (!Array.isArray(snapshotRecords) || snapshotRecords.length === 0) {
      return res.status(400).json({ message: 'Cannot set initial stock: No stock records found in preview.' });
    }

    // 1. Create an automated safety backup
    const backupFilename = await createStockBackupSnapshot('pre_stock_baseline');

    // 2. Archive any currently active baselines
    const existingBaselines = await StockBaseline.find();
    for (const eb of existingBaselines) {
      let ebData = decryptData(eb.data);
      if (ebData && ebData.status === 'active') {
        ebData.status = 'archived';
        ebData.archivedAt = new Date().toISOString();
        await StockBaseline.findByIdAndUpdate(eb._id, { data: encryptData(ebData) });
      }
    }

    // 3. Save new active baseline
    const payload = {
      baselineDate: baselineDate || new Date().toISOString(),
      note: note || 'Initial Stock Baseline',
      setBy: setBy || userSession.name || userSession.username || 'Admin',
      setByUsername: userSession.username || 'admin',
      summary: summary || {},
      snapshotRecords,
      status: 'active',
      backupFile: backupFilename,
      createdAt: new Date().toISOString()
    };

    const newBaseline = new StockBaseline({ data: encryptData(payload) });
    const saved = await newBaseline.save();

    res.status(201).json({
      ...payload,
      _id: saved._id,
      createdAt: saved.createdAt
    });
  } catch (err) {
    console.error('Error creating stock baseline:', err);
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/stock-baseline/active', async (req, res) => {
  try {
    const baselines = await StockBaseline.find().sort({ createdAt: -1 });
    let activeBaseline = null;

    for (const b of baselines) {
      let d = decryptData(b.data);
      if (d && d.status === 'active') {
        activeBaseline = { ...d, _id: b._id, createdAt: b.createdAt };
        break;
      }
    }

    // Auto-heal on deployment / server start: if no baseline is marked 'active',
    // find the most recent valid un-reverted baseline and automatically activate it.
    if (!activeBaseline) {
      for (const b of baselines) {
        let d = decryptData(b.data);
        if (d && d.status !== 'reverted') {
          d.status = 'active';
          delete d.archivedAt;
          await StockBaseline.findByIdAndUpdate(b._id, { data: encryptData(d) });
          activeBaseline = { ...d, _id: b._id, createdAt: b.createdAt };
          console.log(`[Baseline] Automatically activated most recent valid baseline on deployment: ${b._id}`);
          break;
        }
      }
    }

    if (activeBaseline) {
      const { changed, decrypted: normalizedActive } = normalizeBaselineSnapshot(activeBaseline);
      if (changed) {
        StockBaseline.findByIdAndUpdate(activeBaseline._id, { data: encryptData(normalizedActive) }).catch(e => console.error('Error auto-saving normalized active baseline:', e));
        activeBaseline = { ...normalizedActive, _id: activeBaseline._id, createdAt: activeBaseline.createdAt };
      }
    }

    res.json(activeBaseline);
  } catch (err) {
    console.error('Error fetching active stock baseline:', err);
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/stock-baseline/history', async (req, res) => {
  try {
    const baselines = await StockBaseline.find().sort({ createdAt: -1 });
    const history = baselines.map(b => {
      let d = decryptData(b.data);
      return { ...d, _id: b._id, createdAt: b.createdAt };
    });
    res.json(history);
  } catch (err) {
    console.error('Error fetching stock baseline history:', err);
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/stock-baseline/:id/revert', async (req, res) => {
  try {
    const userSession = req.session.user;
    const hasPermission = userSession && (
      userSession.username === 'admin' ||
      (userSession.role || '').toLowerCase() === 'admin' ||
      (userSession.permissions && userSession.permissions.stock && userSession.permissions.stock.special === true)
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Admin access required to revert baseline.' });
    }

    const baseline = await StockBaseline.findById(req.params.id);
    if (!baseline) return res.status(404).json({ message: 'Stock baseline not found.' });

    // Safety backup before reverting
    await createStockBackupSnapshot('pre_stock_baseline_revert');

    let d = decryptData(baseline.data);
    if (d) {
      d.status = 'reverted';
      d.revertedAt = new Date().toISOString();
      d.revertedBy = userSession.name || userSession.username || 'Admin';
      await StockBaseline.findByIdAndUpdate(baseline._id, { data: encryptData(d) });
    }

    // Automatically reactivate the most recent non-reverted baseline if one exists
    const remainingBaselines = await StockBaseline.find().sort({ createdAt: -1 });
    let reactivated = null;
    for (const rb of remainingBaselines) {
      if (rb._id.toString() === baseline._id.toString()) continue;
      let rbData = decryptData(rb.data);
      if (rbData && rbData.status !== 'reverted') {
        rbData.status = 'active';
        delete rbData.archivedAt;
        await StockBaseline.findByIdAndUpdate(rb._id, { data: encryptData(rbData) });
        reactivated = rbData;
        break;
      }
    }

    res.json({
      message: reactivated
        ? 'Stock baseline reverted. Previous baseline has been reactivated.'
        : 'Stock baseline reverted successfully. Stock calculations returned to standard historical mode.'
    });
  } catch (err) {
    console.error('Error reverting stock baseline:', err);
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/stock-baseline/:id/activate', async (req, res) => {
  try {
    const userSession = req.session.user;
    const hasPermission = userSession && (
      userSession.username === 'admin' ||
      (userSession.role || '').toLowerCase() === 'admin' ||
      (userSession.permissions && userSession.permissions.stock && (
        userSession.permissions.stock.special === true ||
        userSession.permissions.stock.edit === true
      ))
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Forbidden: Admin or authorized Stock Manager permission required.' });
    }

    const targetBaseline = await StockBaseline.findById(req.params.id);
    if (!targetBaseline) return res.status(404).json({ message: 'Stock baseline not found.' });

    // 1. Archive any other active baselines
    const allBaselines = await StockBaseline.find();
    for (const b of allBaselines) {
      if (b._id.toString() !== req.params.id) {
        let bData = decryptData(b.data);
        if (bData && bData.status === 'active') {
          bData.status = 'archived';
          bData.archivedAt = new Date().toISOString();
          await StockBaseline.findByIdAndUpdate(b._id, { data: encryptData(bData) });
        }
      }
    }

    // 2. Activate target baseline
    let targetData = decryptData(targetBaseline.data);
    if (targetData) {
      targetData.status = 'active';
      delete targetData.archivedAt;
      delete targetData.revertedAt;
      await StockBaseline.findByIdAndUpdate(targetBaseline._id, { data: encryptData(targetData) });
    }

    res.json({ message: 'Baseline activated successfully.', baseline: { ...targetData, _id: targetBaseline._id } });
  } catch (err) {
    console.error('Error activating stock baseline:', err);
    res.status(500).json({ message: err.message });
  }
});

// Product APIs
apiRouter.post('/api/products', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newProduct = new Product({ data: encryptedData });
    const savedProduct = await newProduct.save();
    invalidateMemoryCache('products');
    broadcastUpdate('products', 'create', { _id: savedProduct._id });
    req._broadcastDone = true;
    res.status(201).json({ ...req.body, _id: savedProduct._id, createdAt: savedProduct.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: 'Product not found' });
    invalidateMemoryCache('products');
    broadcastUpdate('products', 'delete', { _id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/products/:id', async (req, res) => {
  try {
    const existingProductDoc = await Product.findById(req.params.id);
    if (!existingProductDoc) return res.status(404).json({ message: 'Product not found' });

    let existingData = {};
    if (existingProductDoc.data) {
      existingData = decryptData(existingProductDoc.data) || {};
    }

    const { brandRenames = [], ...cleanBody } = req.body;

    // Detect brand renames if not explicitly provided or to supplement
    const renamesToProcess = Array.isArray(brandRenames) ? [...brandRenames] : [];
    const prodName = (cleanBody.name || existingData.name || '').trim();

    if (renamesToProcess.length === 0 && existingData.brands && cleanBody.brands) {
      existingData.brands.forEach((oldB, idx) => {
        const oldName = (oldB.brand || '').trim();
        const newB = cleanBody.brands[idx];
        const newName = (newB?.brand || '').trim();
        if (oldName && newName && oldName.toLowerCase() !== newName.toLowerCase()) {
          renamesToProcess.push({
            oldBrand: oldName,
            newBrand: newName,
            productName: prodName
          });
        }
      });
    }

    const encryptedData = encryptData(cleanBody);
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });

    // Execute cascading updates across all collections for each brand rename
    const cascadeResults = [];
    for (const rename of renamesToProcess) {
      if (rename.oldBrand && rename.newBrand && rename.oldBrand.trim().toLowerCase() !== rename.newBrand.trim().toLowerCase()) {
        const targetProduct = rename.productName || prodName;
        const result = await updateBrandAcrossAllCollections(targetProduct, rename.oldBrand, rename.newBrand);
        cascadeResults.push(result);
      }
    }

    invalidateMemoryCache('products');
    broadcastUpdate('products', 'update', { _id: updatedProduct._id });
    req._broadcastDone = true;

    res.json({
      ...cleanBody,
      _id: updatedProduct._id,
      createdAt: updatedProduct.createdAt,
      cascadeResults
    });
  } catch (err) {
    console.error('Error updating product with brand cascade:', err);
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/products', async (req, res) => {
  try {
    if (memoryCache.products && !req.query._t && !req.query._nocache) {
      return res.json(memoryCache.products);
    }
    const records = await Product.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.products = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Customer APIs
apiRouter.post('/api/customers', async (req, res) => {
  try {
    // req.body is already decrypted by the security middleware
    const encryptedData = encryptData(req.body);
    const newCustomer = new Customer({ data: encryptedData });
    const savedCustomer = await newCustomer.save();

    // Return decrypted record so middleware can re-encrypt it for transport
    const decrypted = { ...req.body, _id: savedCustomer._id, createdAt: savedCustomer.createdAt };
    broadcastUpdate('customers', 'create', { id: savedCustomer._id, customer: decrypted });
    req._broadcastDone = true;
    res.status(201).json(decrypted);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/customers/:id', async (req, res) => {
  try {
    const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
    if (!deletedCustomer) return res.status(404).json({ message: 'Customer not found' });
    broadcastUpdate('customers', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/customers/:id', async (req, res) => {
  try {
    // req.body is already decrypted by the security middleware
    const oldRecord = await Customer.findById(req.params.id);
    if (!oldRecord) return res.status(404).json({ message: 'Customer not found' });
    let oldData = {};
    try {
      oldData = decryptData(oldRecord.data) || {};
    } catch (e) { }

    const newCompanyName = (req.body.companyName || '').trim();
    const newCustomerName = (req.body.customerName || '').trim();
    const newPhone = (req.body.phone || '').trim();
    const newAddress = (req.body.address || req.body.location || '').trim();
    const newCustomerType = (req.body.customerType || '').trim();
    const newCustomerId = (req.body.customerId || '').trim();

    // Ensure customer's internal history records stay synchronized with new customer details
    if (req.body.salesHistory && Array.isArray(req.body.salesHistory)) {
      req.body.salesHistory = req.body.salesHistory.map(h => ({
        ...h,
        companyName: newCompanyName || h.companyName,
        customerName: newCustomerName || h.customerName,
        phone: newPhone || h.phone,
        customerPhone: newPhone || h.customerPhone,
        address: newAddress || h.address,
        location: newAddress || h.location,
        customerType: newCustomerType || h.customerType
      }));
    }

    const encryptedData = encryptData(req.body);
    const updatedRecord = await Customer.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Customer not found' });

    // Propagate companyName, customerName, phone, address, and customerType to related sales
    const sales = await Sale.find();
    for (const s of sales) {
      let d = decryptData(s.data);
      if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
        try { d = decryptData(d.data); } catch (e) { }
      }
      if (!d) continue;

      const saleCustId = (d.customerId || (d.customer && d.customer._id) || '').toString().trim();
      const isIdMatch =
        saleCustId === req.params.id ||
        (oldData && oldData.customerId && saleCustId === oldData.customerId) ||
        (newCustomerId && saleCustId === newCustomerId) ||
        (d.customer && (
          d.customer._id === req.params.id ||
          (oldData && oldData.customerId && d.customer.customerId === oldData.customerId) ||
          (newCustomerId && d.customer.customerId === newCustomerId)
        ));

      // Only match by company name if the sale has no explicit customerId or if its customerId already matches this customer.
      // NEVER match by customerName (contact person name) alone, as different companies often share contact names!
      const isCompanyMatch =
        (!saleCustId || saleCustId === req.params.id) &&
        Boolean(oldData && oldData.companyName && d.companyName && d.companyName.trim().toLowerCase() === oldData.companyName.trim().toLowerCase());

      const isMatch = isIdMatch || isCompanyMatch;

      if (isMatch) {
        let changed = false;
        if (newCompanyName && d.companyName !== newCompanyName) {
          d.companyName = newCompanyName;
          changed = true;
        }
        if (newCustomerName && d.customerName !== newCustomerName) {
          d.customerName = newCustomerName;
          changed = true;
        }
        if (newPhone && (d.phone !== newPhone || d.customerPhone !== newPhone)) {
          d.phone = newPhone;
          d.customerPhone = newPhone;
          changed = true;
        }
        if (newAddress && (d.address !== newAddress || d.customerAddress !== newAddress || d.location !== newAddress)) {
          d.address = newAddress;
          d.customerAddress = newAddress;
          d.location = newAddress;
          changed = true;
        }
        if (newCustomerType && d.customerType !== newCustomerType) {
          d.customerType = newCustomerType;
          changed = true;
        }
        if (req.body.uom && d.uom !== req.body.uom) {
          d.uom = req.body.uom;
          changed = true;
        }
        if (d.customer) {
          d.customer = {
            ...d.customer,
            _id: req.params.id,
            customerId: newCustomerId || d.customer.customerId,
            companyName: newCompanyName || d.customer.companyName,
            customerName: newCustomerName || d.customer.customerName,
            phone: newPhone || d.customer.phone,
            address: newAddress || d.customer.address,
            location: newAddress || d.customer.location,
            customerType: newCustomerType || d.customer.customerType
          };
          changed = true;
        }
        if (d.customerId !== req.params.id) {
          d.customerId = req.params.id;
          changed = true;
        }

        if (changed) {
          s.data = encryptData(d);
          await s.save();
        }
      }
    }

    // Propagate changes to related returns
    const returns = await Return.find();
    for (const r of returns) {
      let d = decryptData(r.data);
      if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) { }
      }
      if (!d) continue;

      const returnCustId = (d.customerId || '').toString().trim();
      const isIdMatch =
        returnCustId === req.params.id ||
        (oldData && oldData.customerId && returnCustId === oldData.customerId) ||
        (newCustomerId && returnCustId === newCustomerId);

      const isCompanyMatch =
        (!returnCustId || returnCustId === req.params.id) &&
        Boolean(oldData && oldData.companyName && d.companyName && d.companyName.trim().toLowerCase() === oldData.companyName.trim().toLowerCase());

      const isMatch = isIdMatch || isCompanyMatch;

      if (isMatch) {
        let changed = false;
        if (newCompanyName && d.companyName !== newCompanyName) {
          d.companyName = newCompanyName;
          changed = true;
        }
        if (newCustomerName && d.customerName !== newCustomerName) {
          d.customerName = newCustomerName;
          changed = true;
        }
        if (newPhone && (d.phone !== newPhone || d.customerPhone !== newPhone)) {
          d.phone = newPhone;
          d.customerPhone = newPhone;
          changed = true;
        }
        if (newAddress && (d.address !== newAddress || d.customerAddress !== newAddress)) {
          d.address = newAddress;
          d.customerAddress = newAddress;
          changed = true;
        }
        if (d.customerId !== req.params.id) {
          d.customerId = req.params.id;
          changed = true;
        }
        if (changed) {
          r.data = encryptData(d);
          await r.save();
        }
      }
    }

    // Propagate to LCGatePass
    const gatePasses = await LCGatePass.find();
    for (const gp of gatePasses) {
      let d = decryptData(gp.data);
      if (!d) continue;
      const isMatch =
        d.customerId === req.params.id ||
        (oldData && oldData.companyName && d.party && d.party.trim().toLowerCase() === oldData.companyName.trim().toLowerCase());

      if (isMatch && newCompanyName && d.party !== newCompanyName) {
        d.party = newCompanyName;
        gp.data = encryptData(d);
        await gp.save();
      }
    }

    // Return decrypted record so middleware can re-encrypt it for transport
    const decrypted = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('customers', 'update', { id: req.params.id, customer: decrypted });
    req._broadcastDone = true;
    res.json(decrypted);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/customers', async (req, res) => {
  try {
    if (req.query._t || req.query._nocache) {
      memoryCache.customers = null;
    }
    if (memoryCache.customers) {
      return res.json(memoryCache.customers);
    }
    const records = await Customer.find().sort({ createdAt: -1 });
    const decryptedCustomers = records.map(record => {
      const decrypted = decryptData(record.data);
      return { ...decrypted, _id: record._id, createdAt: record.createdAt };
    });
    memoryCache.customers = decryptedCustomers;
    res.json(decryptedCustomers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/customers/repair-sales-history', async (req, res) => {
  try {
    const result = await repairAllCustomerSalesHistory();
    res.json({ message: 'Customer sales history repaired successfully', ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/customers/:id', async (req, res) => {
  try {
    let record = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      record = await Customer.findById(req.params.id);
    }
    if (!record) {
      const records = await Customer.find();
      record = records.find(r => {
        try {
          const d = decryptData(r.data);
          return d.customerId === req.params.id || d._id === req.params.id;
        } catch (e) {
          return false;
        }
      });
    }
    if (!record) return res.status(404).json({ message: 'Customer not found' });

    const decrypted = decryptData(record.data);
    res.json({ ...decrypted, _id: record._id, createdAt: record.createdAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Damage APIs
apiRouter.post('/api/damages', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newDamage = new Damage({ data: encryptedData });
    const savedDamage = await newDamage.save();
    res.status(201).json({ ...req.body, _id: savedDamage._id, createdAt: savedDamage.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/damages/:id', async (req, res) => {
  try {
    const deletedDamage = await Damage.findByIdAndDelete(req.params.id);
    if (!deletedDamage) return res.status(404).json({ message: 'Damage record not found' });
    res.json({ message: 'Damage record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/damages/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedDamage = await Damage.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedDamage) return res.status(404).json({ message: 'Damage record not found' });
    res.json({ ...req.body, _id: updatedDamage._id, createdAt: updatedDamage.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/damages', async (req, res) => {
  try {
    const records = await Damage.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Warehouse APIs
apiRouter.post('/api/warehouses', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newWarehouse = new Warehouse({ data: encryptedData });
    const savedWarehouse = await newWarehouse.save();
    const result = { ...req.body, _id: savedWarehouse._id, createdAt: savedWarehouse.createdAt };
    broadcastUpdate('warehouses', 'create', { id: savedWarehouse._id, warehouse: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/warehouses/:id', async (req, res) => {
  try {
    const deletedWarehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!deletedWarehouse) return res.status(404).json({ message: 'Warehouse not found' });
    broadcastUpdate('warehouses', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Warehouse deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/warehouses/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedWarehouse = await Warehouse.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedWarehouse) return res.status(404).json({ message: 'Warehouse not found' });
    const result = { ...req.body, _id: updatedWarehouse._id, createdAt: updatedWarehouse.createdAt };
    broadcastUpdate('warehouses', 'update', { id: req.params.id, warehouse: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/warehouses', async (req, res) => {
  try {
    if (req.query._t || req.query._nocache) {
      memoryCache.warehouses = null;
    }
    if (memoryCache.warehouses) {
      return res.json(memoryCache.warehouses);
    }
    const records = await Warehouse.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      let attempts = 0;
      while (attempts < 5) {
        if (typeof d === 'string') {
          try {
            const sub = decryptData(d);
            if (sub) d = sub; else break;
          } catch (e) { break; }
        } else if (d && typeof d === 'object' && d.data && typeof d.data === 'string') {
          try {
            const sub = decryptData(d.data);
            if (sub) d = sub; else break;
          } catch (e) { break; }
        } else {
          break;
        }
        attempts++;
      }
      return { ...(typeof d === 'object' ? d : {}), _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.warehouses = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sale APIs
apiRouter.post('/api/sales', async (req, res) => {
  try {
    const saleData = req.body;
    let rateMissing = false;

    // Generate unique invoice number based on saleType
    const sType = saleData.saleType || 'General';
    const isOrderEntry = sType === 'Order' || sType === 'order' || saleData.isOrderEntry === true;

    let newInvoiceNo = isOrderEntry ? (saleData.orderNo || saleData.invoiceNo) : saleData.invoiceNo;

    if (!isOrderEntry) {
      const prefix = (sType === 'Border' || sType === 'Border Sale') ? 'BS' : 'GS';

      if (!newInvoiceNo || !newInvoiceNo.startsWith(prefix)) {
        const allSales = await Sale.find();
        const numbers = [];
        let maxDigits = 4;
        for (const s of allSales) {
          let d;
          try {
            d = decryptData(s.data);
            if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
              try { d = decryptData(d.data); } catch (e) { }
            }
          } catch (e) {
            console.error('Error decrypting sale during invoice generation:', e);
          }

          const invNo = s.invoiceNo || (d ? d.invoiceNo : '');
          if (invNo && invNo.toUpperCase().startsWith(prefix)) {
            const match = invNo.match(/\d+/);
            if (match) {
              numbers.push(parseInt(match[0], 10));
              if (match[0].length > maxDigits) maxDigits = match[0].length;
            }
          }
        }

        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        newInvoiceNo = `${prefix}${nextNum.toString().padStart(maxDigits, '0')}`;
      }
      saleData.invoiceNo = newInvoiceNo;
    } else {
      if (!newInvoiceNo) {
        const allSales = await Sale.find();
        const numbers = [];
        let maxDigits = 4;
        for (const s of allSales) {
          let d;
          try {
            d = decryptData(s.data);
            if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
              try { d = decryptData(d.data); } catch (e) { }
            }
          } catch (e) { }

          const invNo = s.invoiceNo || (d ? d.invoiceNo : '');
          if (invNo && invNo.toUpperCase().startsWith('ORD')) {
            const match = invNo.match(/\d+/);
            if (match) {
              numbers.push(parseInt(match[0], 10));
              if (match[0].length > maxDigits) maxDigits = match[0].length;
            }
          }
        }
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        newInvoiceNo = `ORD${nextNum.toString().padStart(maxDigits, '0')}`;
      }
      saleData.invoiceNo = newInvoiceNo;
      saleData.orderNo = newInvoiceNo;
    }

    // Detect if rate is missing
    if (saleData.items && Array.isArray(saleData.items)) {
      saleData.items.forEach(item => {
        if (item.brandEntries && Array.isArray(item.brandEntries)) {
          item.brandEntries.forEach(be => {
            const price = parseFloat(be.unitPrice);
            if (isNaN(price) || price === 0) rateMissing = true;
          });
        } else {
          const price = parseFloat(item.unitPrice);
          if (isNaN(price) || price === 0) rateMissing = true;
        }
      });
    } else {
      const price = parseFloat(saleData.unitPrice);
      if (isNaN(price) || price === 0) rateMissing = true;
    }

    if (rateMissing) saleData.rateMissing = true;

    const encryptedData = encryptData(saleData);
    const newSale = new Sale({
      invoiceNo: newInvoiceNo,
      saleType: sType,
      data: encryptedData
    });
    const savedSale = await newSale.save();
    try {
      await syncSaleOnSave(savedSale, saleData, null);
    } catch (syncErr) {
      console.error('Error synchronizing customer sales history on sale create:', syncErr);
    }
    res.status(201).json({ ...saleData, _id: savedSale._id, createdAt: savedSale.createdAt });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate Invoice Number! Please try again.' });
    }
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/sales/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    const isAdmin = userSession && (userSession.username === 'admin' || (userSession.role || '').toLowerCase() === 'admin');

    const existingSale = await Sale.findById(req.params.id);
    if (!existingSale) return res.status(404).json({ message: 'Sale not found' });

    let existingData = decryptData(existingSale.data);
    if (existingData && existingData.data && typeof existingData.data === 'string' && !existingData.invoiceNo) {
      try { existingData = decryptData(existingData.data); } catch (e) { }
    }

    if (existingData && existingData.status === 'Requested') {
      const ownerUsername = existingData.requestedByUsername;
      const currentUsername = userSession ? userSession.username : null;
      if (!isAdmin && currentUsername !== ownerUsername) {
        return res.status(403).json({ message: 'Forbidden: Only the owner of the requested sale can delete it.' });
      }
    } else {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Forbidden: Admin access required to delete accepted sales.' });
      }
    }

    // Clean up sales history entries across all customers for this invoice/order
    const invNo = (existingData?.invoiceNo || '').trim().toLowerCase();
    const ordNo = (existingData?.orderNo || '').trim().toLowerCase();

    if (invNo || ordNo) {
      try {
        await syncSaleOnDelete(invNo, ordNo);
      } catch (custErr) {
        console.error('Error cleaning up customer salesHistory on sale delete:', custErr);
      }
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/sales/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    const isAdmin = userSession && (userSession.username === 'admin' || (userSession.role || '').toLowerCase() === 'admin');

    const existingSale = await Sale.findById(req.params.id);
    if (!existingSale) return res.status(404).json({ message: 'Sale not found' });

    let existingData = decryptData(existingSale.data);
    if (existingData && existingData.data && typeof existingData.data === 'string' && !existingData.invoiceNo) {
      try { existingData = decryptData(existingData.data); } catch (e) { }
    }

    const existingStatus = (existingData?.status || '').toLowerCase();
    const isRequestedStatus = existingStatus === 'requested';

    if (existingData && isRequestedStatus) {
      const isStatusChange = (req.body.status || '').toLowerCase() !== existingStatus;
      if (isStatusChange) {
        const userRole = (userSession?.role || '').toLowerCase();
        const hasSpecialPerm = userSession && userSession.permissions && (
          (userSession.permissions.order && (userSession.permissions.order.special === true || userSession.permissions.order.approveEditRequest === true)) ||
          (userSession.permissions.sales && (userSession.permissions.sales.special === true || userSession.permissions.sales.approveEditRequest === true))
        );
        const canApprove = isAdmin || ['admin', 'incharge', 'sales manager'].includes(userRole) || hasSpecialPerm;
        if (!canApprove) {
          return res.status(403).json({ message: 'Forbidden: You do not have permission to approve/reject requested entries.' });
        }
      } else {
        const ownerUsername = (existingData.requestedByUsername || existingData.createdByName || existingData.createdByUsername || '').toString().toLowerCase();
        const currentUsername = userSession ? (userSession.username || '').toString().toLowerCase() : null;
        const hasEditPerm = isAdmin || (userSession && userSession.permissions && (
          (userSession.permissions.sales && userSession.permissions.sales.edit === true) ||
          (userSession.permissions.order && userSession.permissions.order.edit === true)
        ));
        if (!isAdmin && !hasEditPerm && ownerUsername && currentUsername !== ownerUsername) {
          return res.status(403).json({ message: 'Forbidden: Only the owner of the requested entry can edit it before acceptance.' });
        }
      }
    } else {
      const hasEditPerm = isAdmin || (userSession && userSession.permissions && (
        (userSession.permissions.sales && userSession.permissions.sales.edit === true) ||
        (userSession.permissions.order && userSession.permissions.order.edit === true)
      ));
      if (!hasEditPerm) {
        if (req.body.isCnfCommissionUpdate || req.body.isEdited === true) {
          // Allow C&F commission updates & edit request submissions to bypass strict edit locks
        } else {
          const wasRateMissing = existingData.rateMissing === true;
          const alreadyEdited = existingData.isEdited === true;

          if (!wasRateMissing) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to edit this sale entry.' });
          }
          if (alreadyEdited) {
            return res.status(403).json({ message: 'Forbidden: You have already edited this entry once.' });
          }

          // Mark as edited for non-admin
          req.body.isEdited = true;
          req.body.rateMissing = true; // Preserve the flag
        }
      }
    }

    const encryptedData = encryptData(req.body);
    const updatedSale = await Sale.findByIdAndUpdate(req.params.id, {
      invoiceNo: req.body.invoiceNo,
      saleType: req.body.saleType,
      data: encryptedData
    }, { returnDocument: 'after' });

    // Synchronize customer salesHistory across all customers (for both Orders and Sales)
    try {
      await syncSaleOnSave(updatedSale, req.body, existingData);
    } catch (cascadeErr) {
      console.error('Error auto-updating customer sales history on sale/order update:', cascadeErr);
    }

    res.json({ ...req.body, _id: updatedSale._id, createdAt: updatedSale.createdAt });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate Invoice Number detected!' });
    }
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/sales', async (req, res) => {
  try {
    if (memoryCache.sales) {
      return res.json(memoryCache.sales);
    }
    const records = await Sale.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      // Auto-fallback for testing records that were double-encrypted by the bug
      if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
        try { d = decryptData(d.data); } catch (e) { /* ignore */ }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt, saleType: d.saleType || r.saleType, invoiceNo: d.invoiceNo || r.invoiceNo };
    });
    memoryCache.sales = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Purchase APIs
apiRouter.post('/api/purchases', async (req, res) => {
  try {
    if (!req.body.purchaseNo) {
      const count = await Purchase.countDocuments();
      req.body.purchaseNo = `PUR-${String(count + 1).padStart(4, '0')}`;
    }
    const encryptedData = encryptData(req.body);
    const newPurchase = new Purchase({ data: encryptedData });
    await newPurchase.save();
    res.status(201).json({ ...req.body, _id: newPurchase._id, createdAt: newPurchase.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.put('/api/purchases/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedPurchase = await Purchase.findByIdAndUpdate(req.params.id, {
      data: encryptedData
    }, { returnDocument: 'after' });
    if (!updatedPurchase) return res.status(404).json({ message: 'Purchase record not found' });
    res.json({ ...req.body, _id: updatedPurchase._id, createdAt: updatedPurchase.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/purchases/:id', async (req, res) => {
  try {
    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: 'Purchase deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/purchases', async (req, res) => {
  try {
    if (memoryCache.purchases) {
      return res.json(memoryCache.purchases);
    }
    const records = await Purchase.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) { }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.purchases = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Purchase Receive APIs
apiRouter.post('/api/purchase-receives', async (req, res) => {
  try {
    if (!req.body.purchaseReceiveNo && !req.body.purchaseNo) {
      const count = await PurchaseReceive.countDocuments();
      req.body.purchaseReceiveNo = `PR-REC-${String(count + 1).padStart(4, '0')}`;
    } else if (req.body.purchaseNo && !req.body.purchaseReceiveNo) {
      req.body.purchaseReceiveNo = req.body.purchaseNo;
    }
    const encryptedData = encryptData(req.body);
    const newPurchaseReceive = new PurchaseReceive({ data: encryptedData });
    await newPurchaseReceive.save();
    invalidateMemoryCache('purchase-receives');
    broadcastUpdate('purchase-receives', 'create', { _id: newPurchaseReceive._id, purchaseReceiveNo: req.body.purchaseReceiveNo });
    req._broadcastDone = true;
    res.status(201).json({ ...req.body, _id: newPurchaseReceive._id, createdAt: newPurchaseReceive.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.put('/api/purchase-receives/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedPurchaseReceive = await PurchaseReceive.findByIdAndUpdate(req.params.id, {
      data: encryptedData
    }, { returnDocument: 'after' });
    if (!updatedPurchaseReceive) return res.status(404).json({ message: 'Purchase Receive record not found' });
    invalidateMemoryCache('purchase-receives');
    broadcastUpdate('purchase-receives', 'update', { _id: updatedPurchaseReceive._id, purchaseReceiveNo: req.body.purchaseReceiveNo });
    req._broadcastDone = true;
    res.json({ ...req.body, _id: updatedPurchaseReceive._id, createdAt: updatedPurchaseReceive.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/purchase-receives/:id', async (req, res) => {
  try {
    await PurchaseReceive.findByIdAndDelete(req.params.id);
    invalidateMemoryCache('purchase-receives');
    broadcastUpdate('purchase-receives', 'delete', { _id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Purchase Receive deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/purchase-receives', async (req, res) => {
  try {
    if (memoryCache.purchaseReceives && !req.query._t && !req.query._nocache) {
      return res.json(memoryCache.purchaseReceives);
    }
    const records = await PurchaseReceive.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      if (d && d.data && typeof d.data === 'string') {
        try { d = decryptData(d.data); } catch (e) { }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.purchaseReceives = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Return APIs
apiRouter.post('/api/returns', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newReturn = new Return({ data: encryptedData });
    const savedReturn = await newReturn.save();
    invalidateMemoryCache('returns');
    broadcastUpdate('returns', 'create', { _id: savedReturn._id });
    req._broadcastDone = true;
    res.status(201).json({ ...req.body, _id: savedReturn._id, createdAt: savedReturn.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/returns', async (req, res) => {
  try {
    if (memoryCache.returns && !req.query._t && !req.query._nocache) {
      return res.json(memoryCache.returns);
    }
    const records = await Return.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.returns = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/returns/:id', async (req, res) => {
  try {
    const record = await Return.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Return not found' });
    const d = decryptData(record.data);
    res.json({ ...d, _id: record._id, createdAt: record.createdAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/returns/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedReturn = await Return.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedReturn) return res.status(404).json({ message: 'Return not found' });
    invalidateMemoryCache('returns');
    broadcastUpdate('returns', 'update', { _id: updatedReturn._id });
    req._broadcastDone = true;
    res.json({ ...req.body, _id: updatedReturn._id, createdAt: updatedReturn.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/returns/:id', async (req, res) => {
  try {
    const deletedReturn = await Return.findByIdAndDelete(req.params.id);
    if (!deletedReturn) return res.status(404).json({ message: 'Return not found' });
    invalidateMemoryCache('returns');
    broadcastUpdate('returns', 'delete', { _id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Return deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Token APIs (Support & Service Requests)
apiRouter.post('/api/tokens', async (req, res) => {
  try {
    let payload = { ...req.body };
    if (!payload.tokenNo) {
      const now = new Date();
      const prefix = `TK-${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const records = await Token.find().sort({ createdAt: -1 });
      let maxSeq = 0;
      records.forEach(r => {
        try {
          const d = decryptData(r.data);
          if (d.tokenNo && d.tokenNo.startsWith(prefix)) {
            const parts = d.tokenNo.split('-');
            if (parts.length >= 3) {
              const num = parseInt(parts[2], 10);
              if (!isNaN(num) && num > maxSeq) maxSeq = num;
            }
          }
        } catch (_) { }
      });
      payload.tokenNo = `${prefix}-${String(maxSeq + 1).padStart(3, '0')}`;
    }
    const encryptedData = encryptData(payload);
    const newToken = new Token({ data: encryptedData });
    const savedToken = await newToken.save();
    invalidateMemoryCache('tokens');
    broadcastUpdate('tokens', 'create', { _id: savedToken._id, tokenNo: payload.tokenNo });
    req._broadcastDone = true;
    res.status(201).json({ ...payload, _id: savedToken._id, createdAt: savedToken.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/tokens', async (req, res) => {
  try {
    if (memoryCache.tokens && !req.query._t && !req.query._nocache) {
      return res.json(memoryCache.tokens);
    }
    const records = await Token.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.tokens = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/tokens/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedToken = await Token.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedToken) return res.status(404).json({ message: 'Token not found' });
    invalidateMemoryCache('tokens');
    broadcastUpdate('tokens', 'update', { _id: updatedToken._id, tokenNo: req.body.tokenNo });
    req._broadcastDone = true;
    res.json({ ...req.body, _id: updatedToken._id, createdAt: updatedToken.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/tokens/:id', async (req, res) => {
  try {
    const deletedToken = await Token.findByIdAndDelete(req.params.id);
    if (!deletedToken) return res.status(404).json({ message: 'Token not found' });
    invalidateMemoryCache('tokens');
    broadcastUpdate('tokens', 'delete', { _id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Token deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bank APIs
apiRouter.post('/api/banks', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newBank = new Bank({ data: encryptedData });
    const savedBank = await newBank.save();
    const result = { ...req.body, _id: savedBank._id, createdAt: savedBank.createdAt };
    broadcastUpdate('banks', 'create', { id: savedBank._id, bank: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/banks/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    if (userSession && ['incharge', 'lc manager', 'sales manager'].includes((userSession.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete banks' });
    }

    const deletedBank = await Bank.findByIdAndDelete(req.params.id);
    if (!deletedBank) return res.status(404).json({ message: 'Bank not found' });
    broadcastUpdate('banks', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Bank deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/banks/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedBank = await Bank.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedBank) return res.status(404).json({ message: 'Bank not found' });
    const result = { ...req.body, _id: updatedBank._id, createdAt: updatedBank.createdAt };
    broadcastUpdate('banks', 'update', { id: req.params.id, bank: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/banks', async (req, res) => {
  try {
    const records = await Bank.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Insurance APIs
apiRouter.post('/api/insurance', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new Insurance({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('insurance', 'create', { id: savedRecord._id, insurance: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/insurance/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    if (userSession && ['incharge', 'lc manager', 'sales manager'].includes((userSession.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete insurance records' });
    }

    const deletedRecord = await Insurance.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Insurance record not found' });
    broadcastUpdate('insurance', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Insurance record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/insurance/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await Insurance.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Insurance record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('insurance', 'update', { id: req.params.id, insurance: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/insurance', async (req, res) => {
  try {
    const records = await Insurance.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Insurance Payment APIs
apiRouter.post('/api/insurance-payments', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new InsurancePayment({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('insurance-payments', 'create', { id: savedRecord._id, payment: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/insurance-payments/:id', async (req, res) => {
  try {
    const deletedRecord = await InsurancePayment.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Payment record not found' });
    broadcastUpdate('insurance-payments', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Payment record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/insurance-payments/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await InsurancePayment.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Payment record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('insurance-payments', 'update', { id: req.params.id, payment: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/insurance-payments', async (req, res) => {
  try {
    if (req.query._t || req.query._nocache) {
      memoryCache.insurancePayments = null;
    }
    if (memoryCache.insurancePayments) {
      return res.json(memoryCache.insurancePayments);
    }
    const records = await InsurancePayment.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    memoryCache.insurancePayments = decrypted;
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LC Management APIs
apiRouter.post('/api/lc-management', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new LCManagement({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('lc-management', 'create', { id: savedRecord._id, lc: result });
    req._broadcastDone = true;
    res.status(201).json(result);
    checkLcExpiryNotifications().catch(err => console.error('[LCNotification] Error triggering check on save:', err));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/lc-management/:id', async (req, res) => {
  try {
    const deletedRecord = await LCManagement.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'LC record not found' });
    broadcastUpdate('lc-management', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'LC record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/lc-management/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await LCManagement.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'LC record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('lc-management', 'update', { id: req.params.id, lc: result });
    req._broadcastDone = true;
    res.json(result);
    checkLcExpiryNotifications().catch(err => console.error('[LCNotification] Error triggering check on update:', err));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// MetaData APIs (Generic Reference Values)
apiRouter.post('/api/metadata', async (req, res) => {
  try {
    const { category, ...rest } = req.body;
    if (!category) return res.status(400).json({ message: 'Category is required' });

    // Check if category + value already exists to prevent duplicates
    const newVal = (rest.value || '').toString().trim().toLowerCase();
    if (newVal) {
      const existing = await MetaData.find({ category });
      for (const rec of existing) {
        try {
          const dec = decryptData(rec.data);
          const exVal = (dec?.value || dec || '').toString().trim().toLowerCase();
          if (exVal === newVal) {
            return res.status(200).json({ ...dec, _id: rec._id, category: rec.category, createdAt: rec.createdAt });
          }
        } catch (e) { }
      }
    }

    const encryptedData = encryptData(rest);
    const newRecord = new MetaData({ category, data: encryptedData });
    const savedRecord = await newRecord.save();
    res.status(201).json({ ...rest, _id: savedRecord._id, category: savedRecord.category, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/metadata', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const records = await MetaData.find(filter).sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, category: r.category, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.delete('/api/metadata', async (req, res) => {
  try {
    const { category, value } = req.query;
    if (!category || !value) return res.status(400).json({ message: 'Category and value required' });
    const targetVal = value.toString().trim().toLowerCase();
    if (category === 'certification' && targetVal === 'safta') {
      return res.status(400).json({ message: 'SAFTA is a permanent certification and cannot be deleted' });
    }
    const records = await MetaData.find({ category });
    let deletedCount = 0;
    for (const rec of records) {
      try {
        const dec = decryptData(rec.data);
        const val = (dec?.value || dec || '').toString().trim().toLowerCase();
        if (val === targetVal) {
          await MetaData.findByIdAndDelete(rec._id);
          deletedCount++;
        }
      } catch (e) { }
    }
    res.json({ message: `Deleted ${deletedCount} record(s)` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.delete('/api/metadata/:id', async (req, res) => {
  try {
    const target = await MetaData.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Record not found' });

    let targetVal = '';
    const category = target.category;
    try {
      const dec = decryptData(target.data);
      targetVal = (dec?.value || dec || '').toString().trim().toLowerCase();
    } catch (e) { }

    if (category === 'certification' && targetVal === 'safta') {
      return res.status(400).json({ message: 'SAFTA is a permanent certification and cannot be deleted' });
    }

    // Delete targeted record
    await MetaData.findByIdAndDelete(req.params.id);

    // Also purge all duplicates with identical category and value
    if (category && targetVal) {
      const duplicates = await MetaData.find({ category });
      for (const item of duplicates) {
        try {
          const dec = decryptData(item.data);
          const val = (dec?.value || dec || '').toString().trim().toLowerCase();
          if (val === targetVal) {
            await MetaData.findByIdAndDelete(item._id);
          }
        } catch (e) { }
      }
    }

    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/metadata/:id', async (req, res) => {
  try {
    const { category, ...rest } = req.body;
    const encryptedData = encryptData(rest);
    const updated = await MetaData.findByIdAndUpdate(
      req.params.id,
      { category, data: encryptedData },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ message: 'Record not found' });
    res.json({ ...rest, _id: updated._id, category: updated.category, createdAt: updated.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/lc-management', async (req, res) => {
  try {
    const records = await LCManagement.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LC Gate Pass APIs
apiRouter.get('/api/lc-gp', async (req, res) => {
  try {
    const records = await LCGatePass.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/lc-gp', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new LCGatePass({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('lc-gp', 'create', { id: savedRecord._id, gatePass: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.put('/api/lc-gp/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await LCGatePass.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Gate Pass record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('lc-gp', 'update', { id: req.params.id, gatePass: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/lc-gp/:id', async (req, res) => {
  try {
    const deletedRecord = await LCGatePass.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Gate Pass record not found' });
    broadcastUpdate('lc-gp', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Gate Pass record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// LC Expense APIs
apiRouter.get('/api/lc-expenses', async (req, res) => {
  try {
    const records = await LCExpense.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/lc-expenses', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new LCExpense({ data: encryptedData });
    const savedRecord = await newRecord.save();

    // Sync to cnf-payments if head is C&F Commission and it is a payment (not a bill)
    if (req.body.expenseHead === 'C&F Commission' && req.body.type !== 'bill') {
      try {
        const cnfs = await CnF.find();
        const targetName = String(req.body.cnfAgent || '').toLowerCase().trim();
        const matchedCnf = cnfs.map(c => {
          const d = decryptData(c.data);
          return { ...d, _id: c._id };
        }).find(c => String(c.name || '').toLowerCase().trim() === targetName);

        if (matchedCnf) {
          const paymentBody = {
            cnfId: matchedCnf._id.toString(),
            cnfName: matchedCnf.name,
            cnfType: matchedCnf.type,
            date: req.body.date || new Date().toISOString().split('T')[0],
            method: 'Other',
            amount: parseFloat(req.body.amount) || 0,
            discount: 0,
            reference: req.body.lcNo || '',
            remarks: req.body.remarks || 'Paid from LC Expense',
            lcExpenseId: savedRecord._id.toString(),
            status: 'Completed',
            entryBy: req.body.entryBy || req.session?.user?.username || 'admin',
            entryByName: req.body.entryByName || req.session?.user?.name || 'Admin',
            createdBy: req.body.createdBy || req.session?.user?.username || 'admin',
            createdRole: req.body.createdRole || req.session?.user?.role || 'admin',
            approvedBy: req.body.approvedBy || req.session?.user?.username || 'admin',
            approvedByName: req.body.approvedByName || req.session?.user?.name || 'Admin'
          };
          const encPayData = encryptData(paymentBody);
          const newPayRecord = new CnFPayment({ data: encPayData });
          await newPayRecord.save();
          broadcastUpdate('cnf-payments', 'create', { id: newPayRecord._id });
        }
      } catch (syncErr) {
        console.error('Error syncing C&F Payment on LCExpense POST:', syncErr);
      }
    }

    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('lc-expenses', 'create', { id: savedRecord._id, expense: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.put('/api/lc-expenses/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await LCExpense.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'LC Expense record not found' });

    // Sync C&F Payment on LCExpense PUT
    try {
      const cnfPayments = await CnFPayment.find();
      const existingPay = cnfPayments.map(p => {
        const d = decryptData(p.data);
        return { ...d, _id: p._id };
      }).find(p => p.lcExpenseId === req.params.id);

      const isCnfCommPayment = req.body.expenseHead === 'C&F Commission' && req.body.type !== 'bill';

      if (existingPay) {
        if (isCnfCommPayment) {
          const cnfs = await CnF.find();
          const targetName = String(req.body.cnfAgent || '').toLowerCase().trim();
          const matchedCnf = cnfs.map(c => {
            const d = decryptData(c.data);
            return { ...d, _id: c._id };
          }).find(c => String(c.name || '').toLowerCase().trim() === targetName);

          const paymentBody = {
            cnfId: matchedCnf ? matchedCnf._id.toString() : existingPay.cnfId,
            cnfName: matchedCnf ? matchedCnf.name : existingPay.cnfName,
            cnfType: matchedCnf ? matchedCnf.type : existingPay.cnfType,
            date: req.body.date || new Date().toISOString().split('T')[0],
            method: 'Other',
            amount: parseFloat(req.body.amount) || 0,
            discount: 0,
            reference: req.body.lcNo || '',
            remarks: req.body.remarks || 'Paid from LC Expense',
            lcExpenseId: req.params.id,
            status: existingPay.status || 'Completed',
            entryBy: existingPay.entryBy || req.body.entryBy || req.session?.user?.username || 'admin',
            entryByName: existingPay.entryByName || req.body.entryByName || req.session?.user?.name || 'Admin',
            createdBy: existingPay.createdBy || req.body.createdBy || req.session?.user?.username || 'admin',
            createdRole: existingPay.createdRole || 'admin',
            approvedBy: existingPay.approvedBy || req.session?.user?.username || 'admin',
            approvedByName: existingPay.approvedByName || req.session?.user?.name || 'Admin'
          };
          const encPayData = encryptData(paymentBody);
          await CnFPayment.findByIdAndUpdate(existingPay._id, { data: encPayData });
          broadcastUpdate('cnf-payments', 'update', { id: existingPay._id });
        } else {
          await CnFPayment.findByIdAndDelete(existingPay._id);
          broadcastUpdate('cnf-payments', 'delete', { id: existingPay._id });
        }
      } else if (isCnfCommPayment) {
        const cnfs = await CnF.find();
        const targetName = String(req.body.cnfAgent || '').toLowerCase().trim();
        const matchedCnf = cnfs.map(c => {
          const d = decryptData(c.data);
          return { ...d, _id: c._id };
        }).find(c => String(c.name || '').toLowerCase().trim() === targetName);

        if (matchedCnf) {
          const paymentBody = {
            cnfId: matchedCnf._id.toString(),
            cnfName: matchedCnf.name,
            cnfType: matchedCnf.type,
            date: req.body.date || new Date().toISOString().split('T')[0],
            method: 'Other',
            amount: parseFloat(req.body.amount) || 0,
            discount: 0,
            reference: req.body.lcNo || '',
            remarks: req.body.remarks || 'Paid from LC Expense',
            lcExpenseId: req.params.id
          };
          const encPayData = encryptData(paymentBody);
          const newPayRecord = new CnFPayment({ data: encPayData });
          await newPayRecord.save();
          broadcastUpdate('cnf-payments', 'create', { id: newPayRecord._id });
        }
      }
    } catch (syncErr) {
      console.error('Error syncing C&F Payment on LCExpense PUT:', syncErr);
    }

    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('lc-expenses', 'update', { id: req.params.id, expense: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/lc-expenses/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    if (userSession && ['incharge', 'lc manager', 'sales manager'].includes((userSession.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete LC expenses' });
    }

    const deletedRecord = await LCExpense.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'LC Expense record not found' });

    // Sync delete associated CnFPayment
    try {
      const cnfPayments = await CnFPayment.find();
      const existingPay = cnfPayments.map(p => {
        const d = decryptData(p.data);
        return { ...d, _id: p._id };
      }).find(p => p.lcExpenseId === req.params.id);

      if (existingPay) {
        await CnFPayment.findByIdAndDelete(existingPay._id);
        broadcastUpdate('cnf-payments', 'delete', { id: existingPay._id });
      }
    } catch (syncErr) {
      console.error('Error deleting C&F Payment on LCExpense DELETE:', syncErr);
    }

    broadcastUpdate('lc-expenses', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'LC Expense record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Margin Return APIs
apiRouter.get('/api/margin-returns', async (req, res) => {
  try {
    const records = await MarginReturn.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/margin-returns', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new MarginReturn({ data: encryptedData });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('margin-returns', 'create', { id: savedRecord._id, marginReturn: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.put('/api/margin-returns/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await MarginReturn.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Margin Return record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('margin-returns', 'update', { id: req.params.id, marginReturn: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/margin-returns/:id', async (req, res) => {
  try {
    const deletedRecord = await MarginReturn.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Margin Return record not found' });
    broadcastUpdate('margin-returns', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Margin Return record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PI APIs
apiRouter.post('/api/pi', async (req, res) => {
  try {
    const { piNumber, piNumbers } = req.body;
    const finalPiNum = (piNumber && piNumber.trim()) || (Array.isArray(piNumbers) && piNumbers.length > 0 ? piNumbers.join(', ') : undefined);
    const encryptedData = encryptData(req.body);
    const newRecord = new PI({
      piNumber: finalPiNum,
      data: encryptedData
    });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('pi', 'create', { id: savedRecord._id, pi: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate PI Number detected! This number already exists in the system.' });
    }
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/pi/:id', async (req, res) => {
  try {
    const deletedRecord = await PI.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'PI record not found' });
    broadcastUpdate('pi', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'PI record deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/pi/:id', async (req, res) => {
  try {
    const { piNumber, piNumbers, revisions } = req.body;
    const finalPiNum = (piNumber && piNumber.trim()) || (Array.isArray(piNumbers) && piNumbers.length > 0 ? piNumbers.join(', ') : undefined);
    const encryptedData = encryptData(req.body);
    const updateData = { data: encryptedData };
    if (finalPiNum) updateData.piNumber = finalPiNum;

    const actualRevs = (revisions || []).filter(r => r.reviseNo !== 'Original PI');
    if (actualRevs.length > 0) {
      const lastRev = actualRevs[actualRevs.length - 1];
      const revDate = lastRev.createdAt || req.body.lastRevisedAt || new Date();
      updateData.createdAt = new Date(revDate);
    }

    const updatedRecord = await PI.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'PI record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('pi', 'update', { id: req.params.id, pi: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate PI Number detected! This number already exists in the system.' });
    }
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/pi', async (req, res) => {
  try {
    const records = await PI.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      const actualRevs = (d?.revisions || []).filter(rev => rev.reviseNo !== 'Original PI');
      let effectiveCreatedAt = r.createdAt;
      if (actualRevs.length > 0) {
        const lastRev = actualRevs[actualRevs.length - 1];
        effectiveCreatedAt = lastRev.createdAt || d.lastRevisedAt || lastRev.reviseDate || r.createdAt;
      }
      return {
        ...d,
        _id: r._id,
        createdAt: effectiveCreatedAt,
        originalCreatedAt: r.createdAt,
        piNumber: d?.piNumber || r.piNumber,
        piNumbers: d?.piNumbers || (d?.piNumber ? d.piNumber.split(',').map(s => s.trim()).filter(Boolean) : (r.piNumber ? r.piNumber.split(',').map(s => s.trim()).filter(Boolean) : []))
      };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Packing List APIs
apiRouter.post('/api/packing-lists', async (req, res) => {
  try {
    const { packingListNumber } = req.body;
    const encryptedData = encryptData(req.body);
    const newRecord = new PackingList({
      packingListNumber: packingListNumber ? packingListNumber.trim() : undefined,
      data: encryptedData
    });
    const savedRecord = await newRecord.save();
    const result = { ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt };
    broadcastUpdate('packing-lists', 'create', { id: savedRecord._id, packingList: result });
    req._broadcastDone = true;
    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate Packing List Number detected! This number already exists in the system.' });
    }
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/packing-lists/:id', async (req, res) => {
  try {
    const deletedRecord = await PackingList.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Packing List record not found' });
    broadcastUpdate('packing-lists', 'delete', { id: req.params.id });
    req._broadcastDone = true;
    res.json({ message: 'Packing List record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/packing-lists/:id', async (req, res) => {
  try {
    const { packingListNumber } = req.body;
    const encryptedData = encryptData(req.body);
    const updateData = { data: encryptedData };
    if (packingListNumber) updateData.packingListNumber = packingListNumber.trim();

    const updatedRecord = await PackingList.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Packing List record not found' });
    const result = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    broadcastUpdate('packing-lists', 'update', { id: req.params.id, packingList: result });
    req._broadcastDone = true;
    res.json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate Packing List Number detected! This number already exists in the system.' });
    }
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/packing-lists', async (req, res) => {
  try {
    const records = await PackingList.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// TR Setup APIs
apiRouter.post('/api/tr-setups', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new TRSetup({ data: encryptedData });
    const savedRecord = await newRecord.save();
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/tr-setups/:id', async (req, res) => {
  try {
    const deletedRecord = await TRSetup.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'TR Setup record not found' });
    res.json({ message: 'TR Setup record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/tr-setups/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await TRSetup.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'TR Setup record not found' });
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/tr-setups', async (req, res) => {
  try {
    const records = await TRSetup.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Function to generate random password
const generatePassword = (length = 8) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < n; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
    if (retVal.length === length) break;
  }
  return retVal;
};

// Employee APIs
apiRouter.post('/api/employees', verifyPermission('employees', 'add'), async (req, res) => {
  try {
    const userSession = req.session.user;
    if (userSession && (userSession.role || '').toLowerCase() === 'accounts manager') {
      return res.status(403).json({ message: 'Forbidden: Accounts manager cannot add employees' });
    }
    const employeeData = req.body; // Already decrypted by securityMiddleware
    const { role } = employeeData;
    const resolvedRole = await resolveRoleToStore(role);
    employeeData.role = resolvedRole;
    const empRole = resolvedRole ? resolvedRole.toLowerCase() : 'staff';

    // Auto-generate ID logic
    const prefix = empRole === 'admin' ? 'A-' : 'E-';
    const allEmployees = await Employee.find();

    let maxIdNum = 1000;
    for (const emp of allEmployees) {
      try {
        let d = decryptData(emp.data);
        // Fallback for double-encrypted in loop
        if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
          try { d = decryptData(d.data); } catch (e) { }
        }
        if (d.employeeId && d.employeeId.startsWith(prefix)) {
          const numPart = parseInt(d.employeeId.substring(2));
          if (!isNaN(numPart) && numPart > maxIdNum) {
            maxIdNum = numPart;
          }
        }
      } catch (e) { }
    }

    const newEmployeeId = `${prefix}${maxIdNum + 1}`;
    employeeData.employeeId = newEmployeeId;

    const existingUser = await User.findOne({ username: newEmployeeId });
    if (existingUser) {
      return res.status(400).json({ message: 'Auto-generated Employee ID already exists as a username' });
    }

    const plainPassword = generatePassword();
    const hashedPassword = await hashPassword(plainPassword);

    const newUser = new User({
      username: newEmployeeId,
      password: hashedPassword,
      role: empRole
    });
    await newUser.save();

    employeeData.password = plainPassword;
    const encryptedData = encryptData(employeeData);

    const newEmployee = new Employee({ data: encryptedData });
    const savedEmployee = await newEmployee.save();

    res.status(201).json({
      ...employeeData,
      _id: savedEmployee._id,
      createdAt: savedEmployee.createdAt,
      plainPassword
    });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/employees/:id', verifyPermission('employees', 'delete'), async (req, res) => {
  try {
    const userSession = req.session.user;
    if (userSession && ['incharge', 'accounts manager'].includes((userSession.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete employees' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    let d = decryptData(employee.data);
    // Fallback for double-encrypted in delete
    if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
      try { d = decryptData(d.data); } catch (e) { }
    }
    const { employeeId } = d;

    // Delete associated User record
    await User.findOneAndDelete({ username: employeeId });

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee and associated user account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/employees/:id', verifyPermission('employees', 'edit'), async (req, res) => {
  try {
    const userSession = req.session.user;
    if (userSession && (userSession.role || '').toLowerCase() === 'accounts manager') {
      return res.status(403).json({ message: 'Forbidden: Accounts manager cannot edit employees' });
    }
    const oldEmployee = await Employee.findById(req.params.id);
    if (!oldEmployee) return res.status(404).json({ message: 'Employee not found' });

    let oldDec = decryptData(oldEmployee.data);
    // Fallback for double-encrypted in old record
    if (oldDec && oldDec.data && typeof oldDec.data === 'string' && !oldDec.employeeId) {
      try { oldDec = decryptData(oldDec.data); } catch (e) { }
    }
    const { employeeId: oldId } = oldDec;

    const employeeData = req.body; // Already decrypted by securityMiddleware
    const { employeeId: newId, role } = employeeData;

    // Preserve permissions if they were not supplied in the request body
    if (!employeeData.hasOwnProperty('permissions') && oldDec.hasOwnProperty('permissions')) {
      employeeData.permissions = oldDec.permissions;
    }

    const resolvedRole = await resolveRoleToStore(role);
    employeeData.role = resolvedRole;

    if (userSession && (userSession.role || '').toLowerCase() === 'incharge') {
      const oldResolvedRole = await resolveRoleToStore(oldDec.role);
      if (resolvedRole && oldResolvedRole && resolvedRole.toLowerCase() !== oldResolvedRole.toLowerCase()) {
        return res.status(403).json({ message: 'Forbidden: Incharge users cannot edit employee roles' });
      }
    }

    const user = await User.findOne({ username: oldId });
    if (user) {
      user.username = newId;
      if (resolvedRole) user.role = resolvedRole.toLowerCase();
      await user.save();
    }

    const encryptedData = encryptData(employeeData);
    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    res.json({ ...employeeData, _id: updatedEmployee._id, createdAt: updatedEmployee.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.post('/api/employees/:id/reset-password', async (req, res) => {
  try {
    const userSession = req.session.user;
    if (!userSession) return res.status(401).json({ message: 'Unauthorized' });

    const isAdminUser = userSession.username === 'admin';
    const isAdminRole = (userSession.role || '').toLowerCase() === 'admin';
    if (!isAdminUser && !isAdminRole) {
      return res.status(403).json({ message: 'Forbidden: Only admins can reset passwords' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    let d = decryptData(employee.data);
    if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
      try { d = decryptData(d.data); } catch (e) { }
    }
    const { employeeId } = d;

    const user = await User.findOne({ username: employeeId });
    if (!user) return res.status(404).json({ message: 'User account not found' });

    const newPassword = generatePassword();
    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, newPassword });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

apiRouter.post('/api/employees/:id/change-password', async (req, res) => {
  try {
    const userSession = req.session.user;
    if (!userSession) return res.status(401).json({ message: 'Unauthorized' });

    const isAdminUser = userSession.username === 'admin';
    const isAdminRole = (userSession.role || '').toLowerCase() === 'admin';
    if (!isAdminUser && !isAdminRole) {
      return res.status(403).json({ message: 'Forbidden: Only admins can change passwords' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    let d = decryptData(employee.data);
    if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
      try { d = decryptData(d.data); } catch (e) { }
    }
    const { employeeId } = d;

    const user = await User.findOne({ username: employeeId });
    if (!user) return res.status(404).json({ message: 'User account not found' });

    const { newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long' });
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ message: 'Server error during password change' });
  }
});

apiRouter.get('/api/employees', async (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const isAdmin = user.username === 'admin' || (user.role || '').toLowerCase() === 'admin';
  let hasFullEmployeePerm = isAdmin;
  if (!hasFullEmployeePerm) {
    try {
      const resolvedPerms = await resolveUserPermissions(user.role, user.permissions);
      hasFullEmployeePerm = !!(resolvedPerms && resolvedPerms['employees'] && resolvedPerms['employees']['view']);
    } catch (e) {
      hasFullEmployeePerm = false;
    }
  }

  try {
    const records = await Employee.find().sort({ createdAt: -1 });

    // Fetch user profile photos to attach
    const usersWithPhotos = await User.find({ profilePhoto: { $exists: true, $ne: null } }, 'username profilePhoto');
    const userPhotoMap = {};
    usersWithPhotos.forEach(u => {
      if (u.username && u.profilePhoto) {
        userPhotoMap[u.username] = u.profilePhoto;
      }
    });

    const decrypted = await Promise.all(records.map(async (r) => {
      let d = decryptData(r.data);
      // Fallback for double-encrypted
      if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
        try { d = decryptData(d.data); } catch (e) { }
      }
      if (d && d.role) {
        d.role = await resolveRoleToDisplay(d.role);
      }
      const profilePhoto = (d && d.employeeId && userPhotoMap[d.employeeId]) || d?.profilePhoto || null;

      if (!hasFullEmployeePerm) {
        return {
          _id: r._id,
          employeeId: d?.employeeId || '',
          name: d?.name || '',
          nameEn: d?.nameEn || '',
          firstName: d?.firstName || '',
          fullName: d?.fullName || '',
          username: d?.username || '',
          role: d?.role || '',
          designation: d?.designation || '',
          department: d?.department || '',
          profilePhoto
        };
      }

      return { ...d, _id: r._id, createdAt: r.createdAt, profilePhoto };
    }));
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Upload / update photo for a specific employee
apiRouter.post('/api/employees/:id/photo', verifyPermission('employees', 'edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { photo } = req.body; // base64 data URL string or null

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    let decrypted = decryptData(employee.data);
    if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
      try { decrypted = decryptData(decrypted.data); } catch (e) { }
    }

    decrypted.profilePhoto = photo || null;
    employee.data = encryptData(decrypted);
    await employee.save();

    // Also sync to User document if an account exists for this employeeId
    if (decrypted.employeeId) {
      await User.findOneAndUpdate(
        { username: decrypted.employeeId },
        { profilePhoto: photo || null }
      );
    }

    res.json({ success: true, profilePhoto: photo || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Authentication APIs
apiRouter.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password (supports bcrypt and legacy SHA-256 with auto-upgrade)
    const isPasswordValid = await verifyPassword(password, user.password, user);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // For a production app, we would generate a JWT token here
    // Find employee name if exists
    let displayName = username === 'admin' ? 'Administrator' : username;
    let permissions = null;
    if (username !== 'admin') {
      const employees = await Employee.find();
      let isInactive = false;
      for (const emp of employees) {
        try {
          let decrypted = decryptData(emp.data);
          // Auto-fallback for testing records that were double-encrypted by the bug
          if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
            try { decrypted = decryptData(decrypted.data); } catch (e) { }
          }
          if (decrypted.employeeId === username) {
            displayName = decrypted.name;
            permissions = decrypted.permissions || null;
            if (decrypted.status === 'Inactive') {
              isInactive = true;
            }
            break;
          }
        } catch (e) {
          console.error('Error decrypting employee data during login:', e);
        }
      }
      if (isInactive) {
        return res.status(403).json({ message: 'Your account is deactivated. Please contact your system administrator.' });
      }
    }

    const displayRole = await resolveRoleToDisplay(user.role);
    const resolvedPerms = username === 'admin' ? null : await resolveUserPermissions(user.role, permissions);

    const userData = {
      id: user._id,
      username: user.username,
      role: displayRole,
      name: displayName,
      permissions: resolvedPerms,
      profilePhoto: user.profilePhoto || null,
      avatarPhoto: user.avatarPhoto || null
    };

    // Store user data in session
    req.session.user = userData;

    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    } else {
      req.session.cookie.maxAge = null; // Session-only cookie
    }

    res.json({
      success: true,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Check Session Status
apiRouter.get('/api/auth/check', async (req, res) => {
  if (req.session.user) {
    try {
      const userRecord = await User.findOne({ username: req.session.user.username });
      if (userRecord) {
        req.session.user.profilePhoto = userRecord.profilePhoto || null;
        req.session.user.avatarPhoto = userRecord.avatarPhoto || null;
      }

      if (req.session.user.username === 'admin') {
        return res.json({
          authenticated: true,
          user: req.session.user
        });
      }

      // Fetch all employees and find matching username (since employeeId is encrypted in data)
      const employees = await Employee.find();
      let matchedEmployee = null;
      let decryptedEmp = null;
      for (const emp of employees) {
        try {
          let decrypted = decryptData(emp.data);
          if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
            try { decrypted = decryptData(decrypted.data); } catch (e) { }
          }
          if (decrypted.employeeId === req.session.user.username) {
            matchedEmployee = emp;
            decryptedEmp = decrypted;
            break;
          }
        } catch (e) {
          console.error('Error decrypting employee in session check:', e);
        }
      }

      if (!matchedEmployee) {
        req.session.destroy();
        return res.status(401).json({ authenticated: false, message: 'User no longer exists' });
      }

      // If employee is deactivated, destroy session
      if (decryptedEmp.status === 'Inactive') {
        req.session.destroy();
        return res.status(403).json({ authenticated: false, message: 'Account deactivated' });
      }

      // Update session with fresh details
      const displayRole = await resolveRoleToDisplay(decryptedEmp.role);
      req.session.user.role = displayRole;
      req.session.user.permissions = await resolveUserPermissions(decryptedEmp.role, decryptedEmp.permissions);

      res.json({
        authenticated: true,
        user: req.session.user
      });
    } catch (err) {
      console.error('Session check error:', err);
      // Fallback to existing session user if DB lookup fails
      res.json({
        authenticated: true,
        user: req.session.user
      });
    }
  } else {
    res.status(401).json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }
});

apiRouter.get('/api/profile', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (user.username === 'admin') {
      const adminUserRecord = await User.findOne({ username: 'admin' });
      const phoneVal = (adminUserRecord?.phone && !adminUserRecord.phone.includes('X')) ? adminUserRecord.phone : '';
      return res.json({
        name: adminUserRecord?.name || 'Administrator',
        role: 'Admin',
        department: adminUserRecord?.department || 'Management',
        email: adminUserRecord?.email || '',
        phone: phoneVal,
        designation: adminUserRecord?.designation || 'System Administrator',
        employeeId: 'ADMIN-001',
        joiningDate: '2024-01-01',
        profilePhoto: adminUserRecord?.profilePhoto || null,
        avatarPhoto: adminUserRecord?.avatarPhoto || null
      });
    }

    const employees = await Employee.find();
    const matchedEmployee = employees.find(emp => {
      try {
        let decrypted = decryptData(emp.data);
        if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
          try { decrypted = decryptData(decrypted.data); } catch (e) { }
        }
        return decrypted.employeeId === user.username;
      } catch (e) { return false; }
    });

    if (!matchedEmployee) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Fetch profilePhoto and avatarPhoto from User document
    const userRecord = await User.findOne({ username: user.username });
    const profilePhoto = userRecord?.profilePhoto || null;
    const avatarPhoto = userRecord?.avatarPhoto || null;

    let decrypted = decryptData(matchedEmployee.data);
    if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
      try { decrypted = decryptData(decrypted.data); } catch (e) { }
    }
    const displayRole = await resolveRoleToDisplay(decrypted.role);
    if (decrypted.phone && decrypted.phone.includes('X')) {
      decrypted.phone = '';
    }

    res.json({ ...decrypted, role: displayRole, _id: matchedEmployee._id, createdAt: matchedEmployee.createdAt, profilePhoto, avatarPhoto });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update profile details (name, phone, email, designation, department)
apiRouter.put('/api/profile', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { phone, email, name, designation, department } = req.body;

    if (user.username === 'admin') {
      const updateFields = {};
      if (phone !== undefined) updateFields.phone = phone;
      if (email !== undefined) updateFields.email = email;
      if (name !== undefined) updateFields.name = name;
      if (designation !== undefined) updateFields.designation = designation;
      if (department !== undefined) updateFields.department = department;

      const updatedUser = await User.findOneAndUpdate(
        { username: 'admin' },
        updateFields,
        { returnDocument: 'after' }
      );

      if (req.session.user) {
        if (updatedUser.phone !== undefined) req.session.user.phone = updatedUser.phone;
        if (updatedUser.email !== undefined) req.session.user.email = updatedUser.email;
        if (updatedUser.name !== undefined) req.session.user.name = updatedUser.name;
        if (updatedUser.designation !== undefined) req.session.user.designation = updatedUser.designation;
        if (updatedUser.department !== undefined) req.session.user.department = updatedUser.department;
      }

      return res.json({
        success: true,
        message: 'Profile updated successfully',
        name: updatedUser.name || 'Administrator',
        phone: updatedUser.phone || '',
        email: updatedUser.email || '',
        designation: updatedUser.designation || 'System Administrator',
        department: updatedUser.department || 'Management'
      });
    }

    const employees = await Employee.find();
    const matchedEmployee = employees.find(emp => {
      try {
        let decrypted = decryptData(emp.data);
        if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
          try { decrypted = decryptData(decrypted.data); } catch (e) { }
        }
        return decrypted.employeeId === user.username;
      } catch (e) { return false; }
    });

    if (!matchedEmployee) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    let decrypted = decryptData(matchedEmployee.data);
    if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
      try { decrypted = decryptData(decrypted.data); } catch (e) { }
    }

    if (phone !== undefined) decrypted.phone = phone;
    if (email !== undefined) decrypted.email = email;
    if (name !== undefined) decrypted.name = name;
    if (designation !== undefined) decrypted.designation = designation;
    if (department !== undefined) decrypted.department = department;

    matchedEmployee.data = encryptData(decrypted);
    await matchedEmployee.save();

    await User.findOneAndUpdate(
      { username: user.username },
      {
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(designation !== undefined ? { designation } : {}),
        ...(department !== undefined ? { department } : {})
      }
    );

    if (req.session.user) {
      if (phone !== undefined) req.session.user.phone = phone;
      if (email !== undefined) req.session.user.email = email;
      if (name !== undefined) req.session.user.name = name;
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      name: decrypted.name,
      phone: decrypted.phone,
      email: decrypted.email,
      designation: decrypted.designation,
      department: decrypted.department
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: err.message });
  }
});
// Upload / update profile photo & navbar avatar (pass photo: null to remove)
apiRouter.post('/api/profile/photo', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { photo, avatarPhoto } = req.body;

    const updateObj = {};
    if ('photo' in req.body) {
      updateObj.profilePhoto = photo || null;
      if (photo === null) {
        updateObj.avatarPhoto = null;
      }
    }
    if ('avatarPhoto' in req.body) {
      updateObj.avatarPhoto = avatarPhoto || null;
    }

    if (Object.keys(updateObj).length === 0) {
      return res.status(400).json({ message: 'No photo field provided' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { username: user.username },
      updateObj,
      { returnDocument: 'after' }
    );

    if (!updatedUser) return res.status(404).json({ message: 'User not found' });

    if (req.session?.user) {
      if ('profilePhoto' in updateObj) req.session.user.profilePhoto = updatedUser.profilePhoto || null;
      if ('avatarPhoto' in updateObj) req.session.user.avatarPhoto = updatedUser.avatarPhoto || null;
    }

    res.json({
      success: true,
      profilePhoto: updatedUser.profilePhoto || null,
      avatarPhoto: updatedUser.avatarPhoto || null
    });
  } catch (err) {
    console.error('Error uploading profile photo:', err);
    res.status(500).json({ message: err.message });
  }
});



apiRouter.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('erp_session'); // Clear the custom named cookie
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

apiRouter.post('/api/auth/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ message: 'Server error during password change' });
  }
});

// Notification APIs
apiRouter.post('/api/notifications', async (req, res) => {
  try {
    const newNotification = new Notification(req.body);
    const savedNotification = await newNotification.save();
    res.status(201).json(savedNotification);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.delete('/api/notifications/clear', async (req, res) => {
  try {
    await Notification.deleteMany({});
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/notifications/:id', async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ message: 'Notification not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Business module to Mongoose model mappings
const ERP_MODULE_COLLECTIONS = {
  pi: { label: 'PI Management', models: ['PI', 'PackingList'], description: 'Proforma Invoices & Packing Lists' },
  ipManagement: { label: 'IP Management', models: ['IpRecord'], description: 'Import Permissions' },
  lcManagement: { label: 'LC Management', models: ['LCManagement', 'LCGatePass', 'LCExpense', 'MarginReturn'], description: 'LCs, Gate Passes, LC Expenses & Margin Returns' },
  sales: { label: 'Sales', models: ['Sale'], description: 'General & Border Sales records' },
  purchase: { label: 'Purchase & Receive', models: ['Purchase', 'PurchaseReceive'], description: 'Purchases & Goods Receipts' },
  stockWarehouse: { label: 'Stock & Warehouses', models: ['Stock', 'StockBaseline', 'Warehouse', 'Damage'], description: 'Stock, Baselines, Warehouses & Damage records' },
  customer: { label: 'Customers', models: ['Customer'], description: 'Customer profiles & balances' },
  supplier: { label: 'Suppliers', models: ['Supplier'], description: 'Supplier directory & balances' },
  port: { label: 'Ports', models: ['Port'], description: 'Ports of loading / discharge' },
  importerExporter: { label: 'Importers & Exporters', models: ['Importer', 'Exporter'], description: 'Registered Importers & Exporters' },
  product: { label: 'Products', models: ['Product'], description: 'Product catalog & categories' },
  bank: { label: 'Banks', models: ['Bank'], description: 'Bank accounts & configurations' },
  cnf: { label: 'C&F Management', models: ['CnF', 'CnFPayment'], description: 'C&F Agents & payment transactions' },
  insurance: { label: 'Insurance', models: ['Insurance', 'InsurancePayment'], description: 'Insurance policies & payments' },
  costOfGoods: { label: 'Cost of Goods', models: ['CostOfGoods'], description: 'COG sheets & cost calculations' },
  employees: { label: 'HRMS & Users', models: ['Employee', 'User'], description: 'Employees & system users' },
  returns: { label: 'Returns', models: ['Return'], description: 'Sales & purchase returns' },
  trSetup: { label: 'TR Setup', models: ['TRSetup'], description: 'TR setups & configurations' },
  activityLogs: { label: 'Activity & Notifications', models: ['ActivityLog', 'Notification'], description: 'Audit logs & notification history' },
  systemSettings: { label: 'System Settings', models: ['MetaData', 'BackupSetting'], description: 'Meta data & backup settings' }
};

// GET /api/backup-modules: Fetch all business modules with their collections & document counts
apiRouter.get('/api/backup-modules', adminOnly, async (req, res) => {
  try {
    const models = mongoose.connection.models;
    const modulesWithCounts = await Promise.all(
      Object.entries(ERP_MODULE_COLLECTIONS).map(async ([key, mod]) => {
        let totalRecords = 0;
        const modelCounts = {};
        for (const mName of mod.models) {
          const Model = models[mName];
          if (Model) {
            const count = await Model.estimatedDocumentCount().catch(() => Model.countDocuments({}));
            modelCounts[mName] = count;
            totalRecords += count;
          } else {
            modelCounts[mName] = 0;
          }
        }
        return {
          key,
          label: mod.label,
          description: mod.description,
          models: mod.models,
          modelCounts,
          totalRecords
        };
      })
    );
    res.json({ success: true, modules: modulesWithCounts });
  } catch (err) {
    console.error('Fetch backup modules error:', err);
    res.status(500).json({ message: 'Failed to fetch backup modules: ' + err.message });
  }
});

// Clean and optimize backup data (strips heavy base64 images and attachments to keep backups lightweight)
const cleanBackupDocuments = (modelName, docs, options = {}) => {
  const { excludeEmployeeImages = true, excludeAttachments = false } = options;
  if (!Array.isArray(docs) || docs.length === 0) return docs;

  if (excludeEmployeeImages) {
    if (modelName === 'User') {
      docs.forEach(u => {
        delete u.profilePhoto;
        delete u.avatarPhoto;
      });
    } else if (modelName === 'Employee') {
      docs.forEach(e => {
        if (e.data) {
          try {
            const dec = decryptData(e.data);
            if (dec && dec.profilePhoto) {
              delete dec.profilePhoto;
              e.data = encryptData(dec);
            }
          } catch (_err) { }
        }
      });
    }
  }

  if (excludeAttachments && modelName === 'IpRecord') {
    docs.forEach(ip => {
      if (ip.data) {
        try {
          const dec = decryptData(ip.data);
          if (dec && dec.ipAttachment) {
            delete dec.ipAttachment;
            ip.data = encryptData(dec);
          }
        } catch (_err) { }
      }
    });
  }

  // Cap old notifications in backups (> 45 days) if count exceeds 300 to prevent bloat
  if (modelName === 'Notification' && docs.length > 300) {
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    docs = docs.filter(n => new Date(n.createdAt || 0) >= cutoff);
  }

  return docs;
};

// Backup Database API (Supports full database or specific modules/models with optimization options)
apiRouter.get('/api/backup-database', adminOnly, async (req, res) => {
  try {
    const models = mongoose.connection.models;
    const backupData = {};
    const { modules: moduleQuery, models: modelsQuery, excludeEmployeeImages, excludeAttachments } = req.query;

    const shouldExcludePhotos = excludeEmployeeImages === undefined || excludeEmployeeImages === 'true' || excludeEmployeeImages === true;
    const shouldExcludeAttachments = excludeAttachments === 'true' || excludeAttachments === true;

    let targetModelNames = null;

    if (moduleQuery) {
      const selectedModuleKeys = moduleQuery.split(',').map(s => s.trim()).filter(Boolean);
      targetModelNames = new Set();
      for (const mKey of selectedModuleKeys) {
        if (ERP_MODULE_COLLECTIONS[mKey]) {
          ERP_MODULE_COLLECTIONS[mKey].models.forEach(m => targetModelNames.add(m));
        }
      }
    } else if (modelsQuery) {
      targetModelNames = new Set(modelsQuery.split(',').map(s => s.trim()).filter(Boolean));
    }

    for (const modelName in models) {
      if (targetModelNames && !targetModelNames.has(modelName)) {
        continue;
      }
      const Model = models[modelName];
      let documents = await Model.find({}).lean();
      documents = cleanBackupDocuments(modelName, documents, {
        excludeEmployeeImages: shouldExcludePhotos,
        excludeAttachments: shouldExcludeAttachments
      });
      backupData[modelName] = documents;
    }

    res.json({
      success: true,
      version: '1.0',
      backupType: targetModelNames ? 'module' : 'full',
      excludeEmployeeImages: shouldExcludePhotos,
      excludeAttachments: shouldExcludeAttachments,
      selectedModules: moduleQuery ? moduleQuery.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      selectedModels: targetModelNames ? Array.from(targetModelNames) : undefined,
      timestamp: new Date().toISOString(),
      data: backupData
    });
  } catch (err) {
    console.error('Backup database error:', err);
    res.status(500).json({ message: 'Backup failed: ' + err.message });
  }
});

// Helper function to perform robust, batch-chunked database restore (supports optional selectedModels filter)
const performDatabaseRestore = async (backupData, selectedModels = null) => {
  const { data } = backupData;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file structure: missing "data" object.');
  }

  const models = mongoose.connection.models;
  const restoredCollections = [];
  let totalDocsRestored = 0;

  for (const modelName in data) {
    // If selectedModels is provided, only restore those models
    if (Array.isArray(selectedModels) && selectedModels.length > 0 && !selectedModels.includes(modelName)) {
      continue;
    }

    let Model = models[modelName];
    if (!Model) {
      try {
        Model = mongoose.model(modelName, new mongoose.Schema({}, { strict: false }));
      } catch (e) {
        Model = mongoose.models[modelName];
      }
    }

    const documents = data[modelName];
    if (Array.isArray(documents)) {
      // Clear existing records in this collection
      await Model.deleteMany({});

      if (documents.length > 0) {
        // Insert in safe batches of 200 to prevent MongoDB BSON payload size limits and memory spikes
        const BATCH_SIZE = 200;
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
          const batch = documents.slice(i, i + BATCH_SIZE);
          await Model.insertMany(batch, { validateBeforeSave: false, ordered: false });
        }
      }
      restoredCollections.push(`${modelName} (${documents.length})`);
      totalDocsRestored += documents.length;
    }
  }

  // Run all self-healing migrations and database normalization after restore
  try {
    if (typeof runSystemSelfHealingMigrations === 'function') {
      await runSystemSelfHealingMigrations();
    }
  } catch (e) {
    console.error('Error running self-healing migrations after restore:', e);
  }

  return {
    success: true,
    message: `Database restored successfully (${totalDocsRestored} records restored across ${restoredCollections.length} collections).`,
    restoredCollections,
    totalDocsRestored
  };
};

// Restore Database via Upload (Multipart/form-data for large backup files, supports selective restore)
apiRouter.post('/api/restore-database-upload', adminOnly, backupUpload.single('backupFile'), async (req, res) => {
  let tempFilePath = null;
  try {
    let backupJson;
    if (req.file) {
      tempFilePath = req.file.path;
      const rawData = fs.readFileSync(tempFilePath, 'utf8');
      backupJson = JSON.parse(rawData);

      // Save a copy in BACKUP_DIR so it also appears under Saved Auto Backups on Server
      try {
        const BACKUP_DIR = await getBackupDir();
        const originalName = req.file.originalname || `uploaded_backup_${Date.now()}.json`;
        const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedPath = path.join(BACKUP_DIR, safeName);
        fs.writeFileSync(savedPath, rawData);
      } catch (saveErr) {
        console.warn('Could not save uploaded backup copy to backups directory:', saveErr);
      }
    } else if (req.body && req.body.data) {
      backupJson = req.body;
    } else {
      return res.status(400).json({ message: 'No backup file received. Please choose a valid JSON file.' });
    }

    let selectedModels = null;
    if (req.body && req.body.selectedModels) {
      try {
        selectedModels = typeof req.body.selectedModels === 'string' ? JSON.parse(req.body.selectedModels) : req.body.selectedModels;
      } catch (e) {
        selectedModels = null;
      }
    }

    const result = await performDatabaseRestore(backupJson, selectedModels);
    res.json(result);
  } catch (err) {
    console.error('Restore database upload error:', err);
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) { }
    }
  }
});

// Restore Database API (JSON body fallback)
apiRouter.post('/api/restore-database', adminOnly, express.json({ limit: '200mb' }), async (req, res) => {
  try {
    const backupJson = req.body.backupData || req.body;
    const selectedModels = req.body.selectedModels || null;
    const result = await performDatabaseRestore(backupJson, selectedModels);
    res.json(result);
  } catch (err) {
    console.error('Restore database error:', err);
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  }
});

// Auto-Backup Settings APIs
apiRouter.get('/api/backup-settings', adminOnly, async (req, res) => {
  try {
    let setting = await BackupSetting.findOne({});
    if (!setting) {
      setting = await BackupSetting.create({
        enabled: false,
        schedule: 'daily',
        time: '02:00',
        dayOfWeek: 0,
        dayOfMonth: 1
      });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper to resolve backup directory
const getBackupDir = async () => {
  return path.resolve(__dirname, '../backups');
};

apiRouter.get('/api/backup-settings', adminOnly, async (req, res) => {
  try {
    let setting = await BackupSetting.findOne({});
    if (!setting) {
      setting = await BackupSetting.create({
        enabled: false,
        schedule: 'daily',
        time: '02:00',
        dayOfWeek: 0,
        dayOfMonth: 1,
        backupDirectory: 'backups'
      });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/backup-settings', adminOnly, async (req, res) => {
  try {
    const { enabled, schedule, time, dayOfWeek, dayOfMonth, timezoneOffset, excludeEmployeeImages, excludeAttachments } = req.body;
    const setting = await BackupSetting.findOneAndUpdate(
      {},
      { enabled, schedule, time, dayOfWeek, dayOfMonth, timezoneOffset, excludeEmployeeImages, excludeAttachments },
      { returnDocument: 'after', upsert: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Run scheduled auto-backup immediately on-demand
apiRouter.post('/api/run-auto-backup-now', adminOnly, async (req, res) => {
  try {
    await runAutoBackup();
    res.json({ success: true, message: 'Automated backup completed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to run backup: ' + err.message });
  }
});

// Optimize existing backup files on server (strips heavy base64 employee photos and minifies JSON)
apiRouter.post('/api/backup-files/optimize', adminOnly, async (req, res) => {
  try {
    const BACKUP_DIR = await getBackupDir();
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({ success: true, message: 'No backup directory found', optimizedCount: 0 });
    }
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
    let optimizedCount = 0;
    let totalBytesSaved = 0;

    for (const f of files) {
      const filePath = path.join(BACKUP_DIR, f);
      const originalStat = fs.statSync(filePath);
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed && parsed.data && typeof parsed.data === 'object') {
          for (const mName in parsed.data) {
            parsed.data[mName] = cleanBackupDocuments(mName, parsed.data[mName], {
              excludeEmployeeImages: true,
              excludeAttachments: req.body.excludeAttachments === true
            });
          }
          parsed.isOptimized = true;
          const minified = JSON.stringify(parsed);
          fs.writeFileSync(filePath, minified, 'utf8');
          const newStat = fs.statSync(filePath);
          if (newStat.size < originalStat.size) {
            totalBytesSaved += (originalStat.size - newStat.size);
            optimizedCount++;
          }
        }
      } catch (_e) {
        // Skip any corrupted files
      }
    }

    res.json({
      success: true,
      optimizedCount,
      totalBytesSaved,
      savedMB: (totalBytesSaved / (1024 * 1024)).toFixed(2),
      message: `Successfully optimized ${optimizedCount} backup files, reclaiming ${(totalBytesSaved / (1024 * 1024)).toFixed(2)} MB of disk space.`
    });
  } catch (err) {
    res.status(500).json({ message: 'Optimization failed: ' + err.message });
  }
});

// Saved Backup Files APIs
apiRouter.get('/api/backup-files', adminOnly, async (req, res) => {
  try {
    const BACKUP_DIR = await getBackupDir();
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/backup-files/:filename', adminOnly, async (req, res) => {
  try {
    const BACKUP_DIR = await getBackupDir();
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!filePath.startsWith(BACKUP_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.post('/api/backup-files/:filename/restore', adminOnly, async (req, res) => {
  try {
    const BACKUP_DIR = await getBackupDir();
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!filePath.startsWith(BACKUP_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }
    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const selectedModels = req.body && Array.isArray(req.body.selectedModels) ? req.body.selectedModels : null;
    const result = await performDatabaseRestore(backupData, selectedModels);
    res.json(result);
  } catch (err) {
    console.error('Saved backup restore error:', err);
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  }
});

apiRouter.delete('/api/backup-files/:filename', adminOnly, async (req, res) => {
  try {
    const BACKUP_DIR = await getBackupDir();
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (!filePath.startsWith(BACKUP_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Backup file deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// System Operation & Activity Log APIs (Admin Only)
// ==========================================

// 1. Fetch paginated & filtered activity logs
apiRouter.get('/api/logs', adminOnly, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      user = '',
      module = '',
      category = '',
      action = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      module: { $ne: 'Notification' },
      path: { $not: /\/notifications/i }
    };

    if (user && user !== 'ALL') {
      query.username = new RegExp('^' + user.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    }
    if (module && module !== 'ALL') {
      query.module = new RegExp('^' + module.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    }
    if (category && category !== 'ALL') {
      query.actionCategory = category;
    }
    if (action === 'NO_CLICKS' || action === '!CLICK') {
      query.action = { $ne: 'CLICK' };
    } else if (action && action !== 'ALL') {
      const actionsList = typeof action === 'string'
        ? action.split(',').map(a => a.trim()).filter(Boolean)
        : Array.isArray(action) ? action : [action];
      if (actionsList.includes('NO_CLICKS') || actionsList.includes('!CLICK')) {
        query.action = { $ne: 'CLICK' };
      } else if (actionsList.length === 1) {
        query.action = actionsList[0];
      } else if (actionsList.length > 1) {
        query.action = { $in: actionsList };
      }
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        const startStr = startDate.includes('T') ? startDate : `${startDate}T00:00:00+06:00`;
        query.timestamp.$gte = new Date(startStr);
      }
      if (endDate) {
        const endStr = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999+06:00`;
        query.timestamp.$lte = new Date(endStr);
      }
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { description: searchRegex },
        { username: searchRegex },
        { displayName: searchRegex },
        { module: searchRegex },
        { action: searchRegex },
        { ip: searchRegex }
      ];
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
      ActivityLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ message: 'Failed to fetch logs: ' + err.message });
  }
});

// 2. Fetch log statistics for dashboard cards
apiRouter.get('/api/logs/stats', adminOnly, async (req, res) => {
  try {
    // Compute exact start of today in Asia/Dhaka (+06:00) so Docker containers & UTC servers match local business hours
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    const todayStart = new Date(`${todayStr}T00:00:00.000+06:00`);

    const baseFilter = {
      module: { $ne: 'Notification' },
      path: { $not: /\/notifications/i }
    };

    const [
      totalLogs,
      todayLogs,
      todayUsers,
      categoryStats,
      actionStats,
      distinctUsers,
      distinctModules
    ] = await Promise.all([
      ActivityLog.countDocuments(baseFilter),
      ActivityLog.countDocuments({ ...baseFilter, timestamp: { $gte: todayStart } }),
      ActivityLog.distinct('username', { ...baseFilter, timestamp: { $gte: todayStart } }),
      ActivityLog.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$actionCategory', count: { $sum: 1 } } }
      ]),
      ActivityLog.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]),
      ActivityLog.distinct('username', baseFilter),
      ActivityLog.distinct('module', baseFilter)
    ]);

    const categories = {};
    categoryStats.forEach(c => { if (c._id) categories[c._id] = c.count; });

    const actions = {};
    actionStats.forEach(a => { if (a._id) actions[a._id] = a.count; });

    let storageSizeFormatted = '0 B';
    let dataSizeFormatted = '0 B';
    try {
      const collStats = await mongoose.connection.db.command({ collStats: 'activitylogs', verbose: true });
      if (collStats) {
        const checkpointBytes = collStats.wiredTiger && collStats.wiredTiger['block-manager'] ? collStats.wiredTiger['block-manager']['checkpoint size'] : 0;
        const diskBytes = collStats.storageSize || 0;
        const logicalBytes = collStats.size || 0;

        // checkpointBytes in WiredTiger represents the exact physical compressed data footprint on disk
        const actualBytes = (checkpointBytes > 0 && checkpointBytes < diskBytes) ? checkpointBytes : (diskBytes > 0 ? diskBytes : logicalBytes);

        const formatDynamicBytes = (bytes) => {
          if (!bytes || bytes <= 0) return '0 B';
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };

        storageSizeFormatted = formatDynamicBytes(actualBytes);
        dataSizeFormatted = formatDynamicBytes(logicalBytes);
      }
    } catch (statErr) { }

    // Build user mapping (username -> full displayName)
    const userNamesMap = {
      admin: 'Administrator',
      System: 'System'
    };

    try {
      const employees = await Employee.find();
      for (const emp of employees) {
        try {
          let decrypted = decryptData(emp.data);
          if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
            try { decrypted = decryptData(decrypted.data); } catch (e) { }
          }
          if (decrypted && decrypted.employeeId && decrypted.name) {
            userNamesMap[decrypted.employeeId] = decrypted.name.trim();
          }
        } catch (e) { }
      }
    } catch (empErr) { }

    try {
      const logNames = await ActivityLog.aggregate([
        { $match: { displayName: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$username', displayName: { $first: '$displayName' } } }
      ]);
      logNames.forEach(l => {
        if (l._id && l.displayName && !userNamesMap[l._id]) {
          userNamesMap[l._id] = l.displayName.trim();
        }
      });
    } catch (logErr) { }

    // Fetch detailed activity for active users today
    let todayActiveUsersList = [];
    let todayLiveUsers = 0;

    // Fetch UserDailyActivity tracked engagement today safely
    let dailyMap = {};
    try {
      const dailyRecords = await UserDailyActivity.find({ date: todayStr }).lean();
      (dailyRecords || []).forEach(d => { if (d && d.username) dailyMap[d.username] = d; });
    } catch (dailyErr) {
      console.warn('UserDailyActivity fetch failed, using log-based active calculation:', dailyErr.message);
    }

    const currentUser = req.session?.user;
    const nowMs = Date.now();

    try {
      const activeAgg = await ActivityLog.aggregate([
        { $match: { ...baseFilter, timestamp: { $gte: todayStart } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$username',
            firstActive: { $last: '$timestamp' },
            lastActive: { $first: '$timestamp' },
            actionCount: { $sum: 1 },
            lastAction: { $first: '$action' },
            lastModule: { $first: '$module' },
            lastIp: { $first: '$ip' },
            displayName: { $first: '$displayName' },
            userRole: { $first: '$userRole' },
            timestamps: { $push: '$timestamp' }
          }
        },
        {
          $project: {
            _id: 1,
            firstActive: 1,
            lastActive: 1,
            actionCount: 1,
            lastAction: 1,
            lastModule: 1,
            lastIp: 1,
            displayName: 1,
            userRole: 1,
            timestamps: { $slice: ['$timestamps', 50] }
          }
        },
        { $sort: { lastActive: -1 } }
      ], { allowDiskUse: true });

      if (Array.isArray(activeAgg) && activeAgg.length > 0) {
        todayActiveUsersList = activeAgg.map(u => {
          try {
            const isCurrent = Boolean(currentUser && currentUser.username === u._id);
            const lastActiveDate = isCurrent ? new Date() : (u.lastActive || new Date());
            const lastMs = new Date(u.lastActive || lastActiveDate).getTime();
            const isLive = isCurrent || (nowMs - lastMs <= 15 * 60 * 1000);

            // Compute true active ERP usage time (clusters of interaction + heartbeat engagement)
            const logActiveMs = calculateActiveTimeFromTimestamps(u.timestamps || [u.lastActive], isLive);
            const trackedSeconds = dailyMap[u._id]?.activeSeconds || 0;
            const activeMs = trackedSeconds > 0 ? Math.max(trackedSeconds * 1000, 1000) : Math.max(logActiveMs, 60000);

            return {
              username: u._id,
              name: userNamesMap[u._id] || u.displayName || (u._id === 'admin' ? 'Administrator' : u._id),
              role: u.userRole || (u._id === 'admin' ? 'Administrator' : 'User'),
              firstActive: u.firstActive || u.lastActive,
              lastActive: lastActiveDate,
              actionCount: u.actionCount || 1,
              lastAction: u.lastAction || 'OPERATION',
              lastModule: u.lastModule || 'System',
              lastIp: u.lastIp || '127.0.0.1',
              isCurrent,
              isLive,
              activeMs
            };
          } catch (itemErr) {
            console.error('Error mapping single active user:', itemErr);
            return null;
          }
        }).filter(Boolean);
      }
    } catch (aggErr) {
      console.error('Error aggregating today active users:', aggErr);
    }

    // Robust Fallback: If aggregation failed or returned empty but todayUsers has users
    if ((!todayActiveUsersList || todayActiveUsersList.length === 0) && Array.isArray(todayUsers) && todayUsers.length > 0) {
      try {
        const fallbackUsers = await Promise.all(
          todayUsers.map(async (uname) => {
            try {
              const [latestLog, earliestLog, userActionCount] = await Promise.all([
                ActivityLog.findOne({ ...baseFilter, username: uname, timestamp: { $gte: todayStart } }).sort({ timestamp: -1 }).lean(),
                ActivityLog.findOne({ ...baseFilter, username: uname, timestamp: { $gte: todayStart } }).sort({ timestamp: 1 }).lean(),
                ActivityLog.countDocuments({ ...baseFilter, username: uname, timestamp: { $gte: todayStart } })
              ]);

              if (!latestLog) return null;

              const isCurrent = Boolean(currentUser && currentUser.username === uname);
              const lastActiveDate = isCurrent ? new Date() : (latestLog.timestamp || new Date());
              const lastMs = new Date(lastActiveDate).getTime();
              const isLive = isCurrent || (nowMs - lastMs <= 15 * 60 * 1000);
              const trackedSeconds = dailyMap[uname]?.activeSeconds || 0;
              const activeMs = trackedSeconds > 0 ? Math.max(trackedSeconds * 1000, 1000) : 60000;

              return {
                username: uname,
                name: userNamesMap[uname] || latestLog.displayName || (uname === 'admin' ? 'Administrator' : uname),
                role: latestLog.userRole || (uname === 'admin' ? 'Administrator' : 'User'),
                firstActive: earliestLog?.timestamp || latestLog.timestamp,
                lastActive: lastActiveDate,
                actionCount: userActionCount || 1,
                lastAction: latestLog.action || 'OPERATION',
                lastModule: latestLog.module || 'System',
                lastIp: latestLog.ip || '127.0.0.1',
                isCurrent,
                isLive,
                activeMs
              };
            } catch (err) {
              return null;
            }
          })
        );
        todayActiveUsersList = fallbackUsers.filter(Boolean);
      } catch (fbErr) {
        console.error('Fallback query for today active users failed:', fbErr);
      }
    }

    todayLiveUsers = (todayActiveUsersList || []).filter(u => u.isLive).length;

    res.json({
      success: true,
      totalLogs,
      todayLogs,
      todayActiveUsers: todayUsers.length,
      todayLiveUsers,
      todayActiveUsersList,
      storageSize: storageSizeFormatted,
      dataSize: dataSizeFormatted,
      categories,
      actions,
      distinctUsers: (distinctUsers || []).filter(Boolean).sort(),
      distinctModules: (distinctModules || []).filter(m => m && m !== 'Notification').sort(),
      distinctActions: Object.keys(actions).sort(),
      userNamesMap
    });
  } catch (err) {
    console.error('Error fetching log stats:', err);
    res.status(500).json({ message: 'Failed to fetch log statistics' });
  }
});

// 2.5. Fetch monthly user activity history for a specific user
apiRouter.get('/api/logs/user-history', adminOnly, async (req, res) => {
  try {
    const { username, month, tz = '+06:00' } = req.query;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // Determine year and month
    let yearNum, monthNum;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const parts = month.split('-');
      yearNum = parseInt(parts[0], 10);
      monthNum = parseInt(parts[1], 10);
    } else {
      const now = new Date();
      yearNum = now.getFullYear();
      monthNum = now.getMonth() + 1;
    }

    const queryStart = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    queryStart.setDate(queryStart.getDate() - 1);
    const queryEnd = new Date(yearNum, monthNum, 1, 0, 0, 0, 0);
    queryEnd.setDate(queryEnd.getDate() + 1);

    const currentUser = req.session?.user;
    const isCurrentLoggedInUser = Boolean(currentUser && currentUser.username === username);

    // Fetch user display info & full name
    let displayName = username === 'admin' ? 'Administrator' : username;
    let userRole = username === 'admin' ? 'Administrator' : 'User';

    try {
      const employees = await Employee.find();
      for (const emp of employees) {
        try {
          let decrypted = decryptData(emp.data);
          if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
            try { decrypted = decryptData(decrypted.data); } catch (e) { }
          }
          if (decrypted && (decrypted.employeeId === username || decrypted.username === username || decrypted.email === username)) {
            if (decrypted.name) displayName = decrypted.name.trim();
            if (decrypted.designation || decrypted.role) userRole = decrypted.designation || decrypted.role;
            break;
          }
        } catch (e) { }
      }
    } catch (e) { }

    // Group logs by day within the target month using timezone
    const targetMonthKey = `${yearNum}-${String(monthNum).padStart(2, '0')}`;
    const dayAgg = await ActivityLog.aggregate([
      {
        $match: {
          username: username,
          timestamp: { $gte: queryStart, $lte: queryEnd }
        }
      },
      {
        $project: {
          timestamp: 1,
          action: 1,
          module: 1,
          dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: tz } },
          monthStr: { $dateToString: { format: "%Y-%m", date: "$timestamp", timezone: tz } }
        }
      },
      {
        $match: {
          monthStr: targetMonthKey
        }
      },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: "$dateStr",
          startedTime: { $first: "$timestamp" },
          lastActive: { $last: "$timestamp" },
          activityCount: { $sum: 1 },
          lastAction: { $last: "$action" },
          lastModule: { $last: "$module" },
          timestamps: { $push: "$timestamp" }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz === '+06:00' ? 'Asia/Dhaka' : undefined
    }).format(new Date());

    // Fetch daily activity records for this user in target month
    const userDailyRecords = await UserDailyActivity.find({
      username: username,
      date: { $regex: `^${targetMonthKey}` }
    }).lean();
    const dailyMap = {};
    userDailyRecords.forEach(d => { dailyMap[d.date] = d; });

    const history = dayAgg.map(day => {
      const isToday = day._id === todayStr;
      let lastActiveDate = day.lastActive;
      if (isToday && isCurrentLoggedInUser) {
        lastActiveDate = new Date();
      }

      const logActiveMs = calculateActiveTimeFromTimestamps(day.timestamps || [day.lastActive], isToday && isCurrentLoggedInUser);
      const trackedSeconds = dailyMap[day._id]?.activeSeconds || 0;
      const durationMs = Math.max(logActiveMs, trackedSeconds * 1000, 60000);

      return {
        date: day._id,
        startedTime: day.startedTime,
        lastActive: lastActiveDate,
        totalActiveMs: durationMs,
        activityCount: day.activityCount,
        lastAction: day.lastAction,
        lastModule: day.lastModule,
        isToday,
        isLive: isToday && isCurrentLoggedInUser
      };
    });

    // Available months for this user
    const availableMonthsAgg = await ActivityLog.aggregate([
      { $match: { username: username } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$timestamp", timezone: tz } }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const availableMonths = availableMonthsAgg.map(m => m._id).filter(Boolean);
    if (!availableMonths.includes(targetMonthKey)) {
      availableMonths.unshift(targetMonthKey);
    }

    res.json({
      success: true,
      username,
      displayName,
      userRole,
      selectedMonth: targetMonthKey,
      availableMonths,
      history
    });
  } catch (err) {
    console.error('Error fetching user activity history:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user activity history' });
  }
});

// 3. Client-side user action & click logger (authenticated users only)
apiRouter.post('/api/logs/client-action', async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user || user.username === 'anonymous') {
      return res.json({ success: true, count: 0 });
    }

    const rawActions = Array.isArray(req.body.actions) ? req.body.actions : [req.body];
    const actions = rawActions.slice(0, 10);
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
    const rawUserAgent = req.headers['user-agent'] || '';

    // Simplify user agent
    let compactUserAgent = rawUserAgent;
    if (compactUserAgent.length > 25) {
      let browser = 'Browser';
      if (compactUserAgent.includes('Firefox/')) browser = 'Firefox';
      else if (compactUserAgent.includes('Edg/')) browser = 'Edge';
      else if (compactUserAgent.includes('Chrome/')) browser = 'Chrome';
      else if (compactUserAgent.includes('Safari/')) browser = 'Safari';
      else if (compactUserAgent.includes('Opera/') || compactUserAgent.includes('OPR/')) browser = 'Opera';

      let os = 'Device';
      if (compactUserAgent.includes('Macintosh') || compactUserAgent.includes('Mac OS X')) os = 'macOS';
      else if (compactUserAgent.includes('Windows')) os = 'Windows';
      else if (compactUserAgent.includes('iPhone') || compactUserAgent.includes('iPad')) os = 'iOS';
      else if (compactUserAgent.includes('Android')) os = 'Android';
      else if (compactUserAgent.includes('Linux')) os = 'Linux';

      compactUserAgent = `${browser} (${os})`;
    }

    const logsToInsert = actions.map(act => {
      let cleanDetails = sanitizePayload(act.details || {});
      const pruned = {};
      if (cleanDetails && typeof cleanDetails === 'object') {
        if (cleanDetails.view) pruned.view = cleanDetails.view;
        if (cleanDetails.tag && cleanDetails.tag !== 'button') pruned.tag = cleanDetails.tag;
        if (cleanDetails.targetId) pruned.targetId = cleanDetails.targetId;
        if (cleanDetails.targetName) pruned.targetName = cleanDetails.targetName;
        if (cleanDetails.receiptNo) pruned.receiptNo = cleanDetails.receiptNo;
        if (cleanDetails.piNumber) pruned.piNumber = cleanDetails.piNumber;
        if (cleanDetails.revisionNo) pruned.revisionNo = cleanDetails.revisionNo;
        if (cleanDetails.totalAmount) pruned.totalAmount = cleanDetails.totalAmount;
        if (cleanDetails.totalQuantity) pruned.totalQuantity = cleanDetails.totalQuantity;
        if (cleanDetails.partyName) pruned.partyName = cleanDetails.partyName;
      }

      const validCategories = ['MUTATION', 'APPROVAL', 'AUTH', 'UI_CLICK', 'UI_INTERACTION', 'SYSTEM'];
      const actionCategory = validCategories.includes(act.actionCategory) ? act.actionCategory : 'UI_CLICK';

      const doc = {
        timestamp: act.timestamp ? new Date(act.timestamp) : new Date(),
        username: user?.username || 'System',
        module: act.module || 'System',
        action: act.action || 'CLICK',
        actionCategory,
        description: act.description || `User clicked "${act.actionName || 'Button'}" in ${act.module || 'System'}`
      };

      if (user?.id) doc.userId = user.id;
      if (user?.role) doc.userRole = user.role;
      if (user?.name && user.name !== user.username) doc.displayName = user.name;
      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') doc.ip = clientIp;
      if (compactUserAgent) doc.userAgent = compactUserAgent;
      if (act.path && act.path !== '/') doc.path = act.path;
      if (Object.keys(pruned).length > 0) doc.details = pruned;

      return doc;
    });

    if (logsToInsert.length > 0) {
      await ActivityLog.insertMany(logsToInsert, { ordered: false });

      // Update UserDailyActivity action count
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: '+06:00'
      }).format(new Date());
      await UserDailyActivity.findOneAndUpdate(
        { username: user.username, date: todayStr },
        {
          $inc: { actionCount: logsToInsert.length },
          $set: { lastActive: new Date() },
          $setOnInsert: { firstActive: new Date() }
        },
        { upsert: true }
      ).catch(() => { });
    }

    res.json({ success: true, count: logsToInsert.length });
  } catch (err) {
    console.error('Error logging client actions:', err);
    res.status(500).json({ message: 'Failed to record action log' });
  }
});

// 3.5. User Active Engagement Heartbeat API
apiRouter.post('/api/logs/heartbeat', async (req, res) => {
  try {
    const user = req.session?.user;
    if (!user || !user.username || user.username === 'anonymous') {
      return res.json({ success: true, recordedSeconds: 0 });
    }

    const username = user.username;
    const { activeSeconds = 0, tz = '+06:00' } = req.body || {};
    const seconds = Math.min(Math.max(parseInt(activeSeconds, 10) || 0, 0), 120);

    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz === '+06:00' ? 'Asia/Dhaka' : undefined
    }).format(new Date());

    const now = new Date();

    if (seconds > 0) {
      await UserDailyActivity.findOneAndUpdate(
        { username, date: todayStr },
        {
          $inc: { activeSeconds: seconds },
          $set: { lastActive: now, lastHeartbeat: now },
          $setOnInsert: { firstActive: now }
        },
        { upsert: true, returnDocument: 'after' }
      );
    } else {
      await UserDailyActivity.findOneAndUpdate(
        { username, date: todayStr },
        {
          $set: { lastActive: now, lastHeartbeat: now },
          $setOnInsert: { firstActive: now }
        },
        { upsert: true }
      );
    }

    res.json({ success: true, recordedSeconds: seconds });
  } catch (err) {
    console.error('[Heartbeat] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Purge/clear logs (Admin only) with physical disk compaction
apiRouter.delete('/api/logs/clear', adminOnly, async (req, res) => {
  try {
    const { olderThanDays, all } = req.body;
    let query = {};

    if (!all) {
      const days = parseInt(olderThanDays) || 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query = { timestamp: { $lt: cutoff } };
    }

    const result = await ActivityLog.deleteMany(query);

    // Physically reclaim disk space in MongoDB
    try {
      await mongoose.connection.db.command({ compact: 'activitylogs' });
    } catch (compactErr) {
      console.warn('[ActivityLog] Compact warning:', compactErr.message);
    }

    // Record this clear action
    await logActivity({
      username: req.session?.user?.username || 'admin',
      userRole: 'admin',
      module: 'Log',
      action: 'DELETE',
      actionCategory: 'SYSTEM',
      description: all ? 'Admin purged all activity logs' : `Admin cleared logs older than ${olderThanDays || 30} days (${result.deletedCount} deleted)`,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '',
      method: 'DELETE',
      path: '/api/logs/clear',
      status: 'SUCCESS'
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} log entries and freed physical disk space`
    });
  } catch (err) {
    console.error('Error clearing logs:', err);
    res.status(500).json({ message: 'Failed to clear logs: ' + err.message });
  }
});

// Automated Activity Log & Notification Retention Housekeeping
const cleanupOldActivityLogs = async () => {
  try {
    const now = Date.now();
    // 1. Purge high-frequency UI_CLICK logs older than 7 days
    const clickCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const clickRes = await ActivityLog.deleteMany({
      actionCategory: 'UI_CLICK',
      timestamp: { $lt: clickCutoff }
    });

    // 2. Purge audit logs older than 90 days
    const generalCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const generalRes = await ActivityLog.deleteMany({
      timestamp: { $lt: generalCutoff }
    });

    // 3. Purge notifications older than 60 days to prevent ballooning database & backups
    const notifCutoff = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const notifRes = await Notification.deleteMany({
      createdAt: { $lt: notifCutoff }
    });

    const totalCleaned = (clickRes.deletedCount || 0) + (generalRes.deletedCount || 0) + (notifRes.deletedCount || 0);
    if (totalCleaned > 0) {
      console.log(`[LogHousekeeping] Pruned ${totalCleaned} old records (${clickRes.deletedCount || 0} UI clicks, ${generalRes.deletedCount || 0} audit logs, ${notifRes.deletedCount || 0} notifications). Reclaiming storage...`);
      try {
        await mongoose.connection.db.command({ compact: 'activitylogs' });
        await mongoose.connection.db.command({ compact: 'notifications' });
      } catch (ce) { }
    }
  } catch (e) {
    console.warn('[LogHousekeeping] Retention run failed:', e.message);
  }
};

// Run housekeeping once a day and 15 seconds after startup
setInterval(cleanupOldActivityLogs, 24 * 60 * 60 * 1000);
setTimeout(cleanupOldActivityLogs, 15000);


// Auto-Backup Scheduling Logic (Optimized without employee images & minified)
const runAutoBackup = async () => {
  try {
    const BACKUP_DIR = await getBackupDir();
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const setting = await BackupSetting.findOne({}).lean();
    const excludeEmployeeImages = setting ? setting.excludeEmployeeImages !== false : true;
    const excludeAttachments = setting ? setting.excludeAttachments === true : false;

    const models = mongoose.connection.models;
    const backupData = {};
    for (const modelName in models) {
      const Model = models[modelName];
      let documents = await Model.find({}).lean();
      documents = cleanBackupDocuments(modelName, documents, {
        excludeEmployeeImages,
        excludeAttachments
      });
      backupData[modelName] = documents;
    }

    const backupObj = {
      success: true,
      version: '1.0',
      timestamp: new Date().toISOString(),
      excludeEmployeeImages,
      excludeAttachments,
      data: backupData
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `auto_backup_${dateStr}_${timeStr}.json`;
    // Write minified JSON (without indentation) to eliminate megabytes of redundant whitespace
    fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(backupObj));
    console.log(`[AutoBackup] Successfully backed up database to ${filename} (excludeEmployeeImages: ${excludeEmployeeImages}, excludeAttachments: ${excludeAttachments})`);

    await BackupSetting.findOneAndUpdate({}, { lastRun: new Date() }, { upsert: true });

    // Keep only last 10 auto backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('auto_backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(path.join(BACKUP_DIR, files[i].name));
        console.log(`[AutoBackup] Deleted old backup file: ${files[i].name}`);
      }
    }
  } catch (err) {
    console.error('[AutoBackup] Error taking automated backup:', err);
  }
};

const checkIpExpiryNotifications = async () => {
  try {
    const records = await IpRecord.find();
    const targetRoles = ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Data Entry'];

    for (const record of records) {
      let data;
      try {
        data = decryptData(record.data);
        if (!data || typeof data !== 'object') continue;
      } catch (err) {
        continue;
      }

      if (!data.closeDate) continue;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const closeDate = new Date(data.closeDate);
      closeDate.setHours(0, 0, 0, 0);
      const diffMs = closeDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let isExtended = data.isExtended;
      if (!isExtended && data.openingDate) {
        const openDate = new Date(data.openingDate);
        if (!isNaN(openDate.getTime()) && !isNaN(closeDate.getTime())) {
          const openCloseDiffMs = closeDate.getTime() - openDate.getTime();
          const openCloseDiffDays = Math.round(openCloseDiffMs / (1000 * 60 * 60 * 24));
          if (openCloseDiffDays > 121) {
            isExtended = true;
          }
        }
      }

      let computedStatus = "Active";
      if (closeDate < today) {
        computedStatus = "Expired";
      } else if (diffDays <= 5) {
        computedStatus = "Expire Soon";
      } else if (isExtended) {
        computedStatus = "Extended";
      }

      const hasSentExpireSoon = data.notificationSent?.expireSoon;
      const hasSentExpired = data.notificationSent?.expired;
      let hasUpdated = false;

      const formattedCloseDate = new Date(data.closeDate).toLocaleDateString('en-GB');

      if (computedStatus === 'Expire Soon' && !hasSentExpireSoon) {
        const newNotif = {
          title: 'IP Expiring Soon',
          message: `IP No: ${data.ipNumber} (${data.ipParty}) is expiring soon on ${formattedCloseDate}.`,
          targetRoles,
          targetUsers: [],
          isSystemic: true,
          readByUsers: [],
          createdBy: 'system',
          createdByName: 'System Scheduler'
        };

        const notificationDoc = new Notification({
          data: encryptData(newNotif)
        });
        await notificationDoc.save();

        data.notificationSent = { ...(data.notificationSent || {}), expireSoon: true };
        hasUpdated = true;
      } else if (computedStatus === 'Expired' && !hasSentExpired) {
        const newNotif = {
          title: 'IP Expired',
          message: `IP No: ${data.ipNumber} (${data.ipParty}) has expired on ${formattedCloseDate}.`,
          targetRoles,
          targetUsers: [],
          isSystemic: true,
          readByUsers: [],
          createdBy: 'system',
          createdByName: 'System Scheduler'
        };

        const notificationDoc = new Notification({
          data: encryptData(newNotif)
        });
        await notificationDoc.save();

        data.notificationSent = { ...(data.notificationSent || {}), expired: true };
        hasUpdated = true;
      }

      if (hasUpdated) {
        const encryptedData = encryptData(data);
        await IpRecord.findByIdAndUpdate(record._id, { data: encryptedData });
        console.log(`[SystemScheduler] Triggered IP expiry notification for IP No: ${data.ipNumber}`);
      }
    }
  } catch (err) {
    console.error('[SystemScheduler] Error checking IP expiries:', err);
  }
};

const checkLcExpiryNotifications = async () => {
  try {
    const records = await LCManagement.find();
    const targetRoles = ['Admin', 'Incharge', 'LC Manager', 'Border Manager', 'Data Entry'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const record of records) {
      let data;
      try {
        data = decryptData(record.data);
        if (data && data.data && typeof data.data === 'string' && !data.lcNo && !data.lcNoVal) {
          try { data = decryptData(data.data); } catch (e) { }
        }
        if (!data || typeof data !== 'object') continue;
      } catch (err) {
        continue;
      }

      let hasUpdated = false;
      data.notificationSent = data.notificationSent || {};

      const lcNoStr = data.lcNo || data.lcNoVal || '';
      const importerStr = data.importerName || data.importer || '';

      // 1. LC Expiry Date Check
      if (data.expiryDate) {
        const expiry = new Date(data.expiryDate);
        if (!isNaN(expiry.getTime())) {
          expiry.setHours(0, 0, 0, 0);
          const diffMs = expiry.getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const formattedExpiryDate = expiry.toLocaleDateString('en-GB');

          if (diffDays >= 0 && diffDays <= 15) {
            if (!data.notificationSent.expireSoon) {
              const newNotif = {
                title: 'LC Expiring Soon',
                message: `LC No: ${lcNoStr}${importerStr ? ` (${importerStr})` : ''} is expiring soon on ${formattedExpiryDate}.`,
                targetRoles,
                targetUsers: [],
                isSystemic: true,
                link: 'lc-management-section',
                highlightId: lcNoStr,
                readByUsers: [],
                createdBy: 'system',
                createdByName: 'System Scheduler'
              };

              const notificationDoc = new Notification({
                data: encryptData(newNotif)
              });
              await notificationDoc.save();

              data.notificationSent.expireSoon = true;
              hasUpdated = true;
            }
          } else if (diffDays < 0) {
            if (!data.notificationSent.expired) {
              const newNotif = {
                title: 'LC Expired',
                message: `LC No: ${lcNoStr}${importerStr ? ` (${importerStr})` : ''} has expired on ${formattedExpiryDate}.`,
                targetRoles,
                targetUsers: [],
                isSystemic: true,
                link: 'lc-management-section',
                highlightId: lcNoStr,
                readByUsers: [],
                createdBy: 'system',
                createdByName: 'System Scheduler'
              };

              const notificationDoc = new Notification({
                data: encryptData(newNotif)
              });
              await notificationDoc.save();

              data.notificationSent.expired = true;
              hasUpdated = true;
            }
          } else if (diffDays > 15) {
            if (data.notificationSent.expireSoon || data.notificationSent.expired) {
              data.notificationSent.expireSoon = false;
              data.notificationSent.expired = false;
              hasUpdated = true;
            }
          }
        }
      }

      // 2. Latest Shipment Date Check
      const shipmentDateStr = data.latestShipmentDate || data.extendedShipmentDate;
      if (shipmentDateStr) {
        const shipment = new Date(shipmentDateStr);
        if (!isNaN(shipment.getTime())) {
          shipment.setHours(0, 0, 0, 0);
          const diffMs = shipment.getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const formattedShipmentDate = shipment.toLocaleDateString('en-GB');

          if (diffDays >= 0 && diffDays <= 7) {
            if (!data.notificationSent.shipmentExpireSoon) {
              const newNotif = {
                title: 'LC Latest Shipment Date Expiring Soon',
                message: `LC No: ${lcNoStr}${importerStr ? ` (${importerStr})` : ''} latest shipment date is expiring soon on ${formattedShipmentDate}.`,
                targetRoles,
                targetUsers: [],
                isSystemic: true,
                link: 'lc-management-section',
                highlightId: lcNoStr,
                readByUsers: [],
                createdBy: 'system',
                createdByName: 'System Scheduler'
              };

              const notificationDoc = new Notification({
                data: encryptData(newNotif)
              });
              await notificationDoc.save();

              data.notificationSent.shipmentExpireSoon = true;
              hasUpdated = true;
            }
          } else if (diffDays < 0) {
            if (!data.notificationSent.shipmentExpired) {
              const newNotif = {
                title: 'LC Latest Shipment Date Expired',
                message: `LC No: ${lcNoStr}${importerStr ? ` (${importerStr})` : ''} latest shipment date expired on ${formattedShipmentDate}.`,
                targetRoles,
                targetUsers: [],
                isSystemic: true,
                link: 'lc-management-section',
                highlightId: lcNoStr,
                readByUsers: [],
                createdBy: 'system',
                createdByName: 'System Scheduler'
              };

              const notificationDoc = new Notification({
                data: encryptData(newNotif)
              });
              await notificationDoc.save();

              data.notificationSent.shipmentExpired = true;
              hasUpdated = true;
            }
          } else if (diffDays > 7) {
            if (data.notificationSent.shipmentExpireSoon || data.notificationSent.shipmentExpired) {
              data.notificationSent.shipmentExpireSoon = false;
              data.notificationSent.shipmentExpired = false;
              hasUpdated = true;
            }
          }
        }
      }

      if (hasUpdated) {
        const encryptedData = encryptData(data);
        await LCManagement.findByIdAndUpdate(record._id, { data: encryptedData });
        console.log(`[SystemScheduler] Triggered LC notification update for LC No: ${lcNoStr}`);
      }
    }
  } catch (err) {
    console.error('[SystemScheduler] Error checking LC expiries:', err);
  }
};

const checkAndRunBackup = async () => {
  // Check IP Expiry Notifications
  await checkIpExpiryNotifications();
  // Check LC Expiry Notifications
  await checkLcExpiryNotifications();

  try {
    let setting = await BackupSetting.findOne({});
    if (!setting) {
      setting = await BackupSetting.create({
        enabled: false,
        schedule: 'daily',
        time: '02:00',
        dayOfWeek: 0,
        dayOfMonth: 1,
        backupDirectory: 'backups',
        timezoneOffset: 0
      });
    }

    if (!setting.enabled) return;

    const now = new Date();
    // Convert server time (UTC milliseconds) to user local time using saved offset
    const userOffset = setting.timezoneOffset !== undefined ? setting.timezoneOffset : 0;
    const userLocalTime = new Date(now.getTime() - (userOffset * 60 * 1000));

    const currentHour = String(userLocalTime.getUTCHours()).padStart(2, '0');
    const currentMinute = String(userLocalTime.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    if (currentTimeStr !== setting.time) return;

    if (setting.lastRun && (now.getTime() - new Date(setting.lastRun).getTime()) < 90 * 1000) {
      return;
    }

    let shouldBackup = false;
    if (setting.schedule === 'daily') {
      shouldBackup = true;
    } else if (setting.schedule === 'weekly') {
      if (userLocalTime.getUTCDay() === setting.dayOfWeek) {
        shouldBackup = true;
      }
    } else if (setting.schedule === 'monthly') {
      if (userLocalTime.getUTCDate() === setting.dayOfMonth) {
        shouldBackup = true;
      }
    }

    if (shouldBackup) {
      await runAutoBackup();
    }
  } catch (err) {
    console.error('[AutoBackup] Scheduler error:', err);
  }
};

// Run check immediately on start, then tick every 60 seconds
checkAndRunBackup();
setInterval(checkAndRunBackup, 60 * 1000);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE MODULE — ZKTech F8 Integration
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: day diff between two YYYY-MM-DD strings ─────────────────────────
const dayDiff = (from, to) => {
  const a = new Date(from), b = new Date(to);
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1);
};

// ─── Helper: compute AttendanceLog from punches for one employee on one date ──
const processEmployeeDay = async (employeeId, date) => {
  try {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const punches = await AttendancePunch.find({
      employeeId,
      punchTime: { $gte: dayStart, $lte: dayEnd }
    }).sort({ punchTime: 1 });

    if (punches.length === 0) return null;

    // Get shift for employee
    const shift = await ShiftConfig.findOne({
      $or: [{ applicableTo: employeeId }, { isDefault: true, applicableTo: { $size: 0 } }]
    }).sort({ isDefault: 1 });

    const inPunches = punches.filter(p => p.punchType === 'IN' || p.punchType === 'UNKNOWN');
    const outPunches = punches.filter(p => p.punchType === 'OUT');

    const firstIn = inPunches[0]?.punchTime || punches[0].punchTime;
    const lastOut = outPunches.length ? outPunches[outPunches.length - 1].punchTime : null;

    let totalHours = 0;
    let overtimeHours = 0;
    let status = 'PRESENT';

    if (firstIn && lastOut) {
      totalHours = Math.round(((lastOut - firstIn) / (1000 * 60 * 60)) * 100) / 100;
    }

    if (shift) {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const shiftStart = new Date(firstIn);
      shiftStart.setHours(sh, sm, 0, 0);

      const lateMs = firstIn - shiftStart;
      const lateMin = lateMs / (1000 * 60);

      if (lateMin > (shift.graceMinutes + 240)) {
        status = 'HALF_DAY';
      } else if (lateMin > shift.graceMinutes) {
        status = 'LATE';
      }

      const shiftHours = (() => {
        const [eh, em] = shift.endTime.split(':').map(Number);
        return eh + em / 60 - sh - sm / 60 - shift.breakMinutes / 60;
      })();

      if (totalHours > shiftHours) {
        overtimeHours = Math.round((totalHours - shiftHours) * 100) / 100;
      }
    }

    return { firstIn, lastOut, totalHours, overtimeHours, status, shiftId: shift?._id || null };
  } catch (e) {
    console.error('[Attendance] processEmployeeDay error:', e.message);
    return null;
  }
};

// ─── 1. ZKTech ADMS Device Push Receiver ─────────────────────────────────────
// The F8 device sends a POST with query params: sn, table, Stamp, PIN, Checked, Status, Verify
// GET is used for heartbeat / device registration check
app.get('/api/attendance/device/push', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('OK');
});

app.post('/api/attendance/device/push', async (req, res) => {
  try {
    // ADMS format: body may be urlencoded or JSON; query params also common
    const raw = { ...req.query, ...req.body };
    const deviceId = raw.sn || raw.DeviceSN || 'F8-DEFAULT';
    const enrollId = parseInt(raw.PIN || raw.pin || raw.UserId || 0);
    const stamp = raw.Stamp || raw.stamp || raw.DateTime || raw.datetime || new Date().toISOString();
    const checked = parseInt(raw.Checked || raw.checked || 0);
    const verify = raw.Verify || raw.verify || 'UNKNOWN';

    // Checked codes: 0=IN, 1=OUT, 2=BREAK_OUT, 3=BREAK_IN (ZK standard)
    const punchTypeMap = { 0: 'IN', 1: 'OUT', 2: 'BREAK_OUT', 3: 'BREAK_IN' };
    const punchType = punchTypeMap[checked] || 'UNKNOWN';

    const punchTime = new Date(stamp);
    if (isNaN(punchTime.getTime())) {
      return res.status(400).set('Content-Type', 'text/plain').send('ERR:Invalid timestamp');
    }

    // Lookup employee mapping
    const mapping = await DeviceMapping.findOne({ enrollId });
    const employeeId = mapping?.employeeId || null;

    const punch = new AttendancePunch({
      deviceId,
      enrollId,
      employeeId,
      punchTime,
      punchType,
      verifyMode: verify,
      rawPayload: JSON.stringify(raw),
      processed: false,
      unmatched: !mapping
    });
    await punch.save();

    // ZKTech expects plain text "OK" on success
    res.set('Content-Type', 'text/plain').send('OK');
  } catch (err) {
    console.error('[Attendance] Device push error:', err.message);
    res.set('Content-Type', 'text/plain').send('ERR:' + err.message);
  }
});

// ─── Multi-Method Ingestion Helper ──────────────────────────────────────────
async function ingestPunchRecords(punches, defaultDeviceId = 'F8-DEFAULT') {
  if (!punches || punches.length === 0) return { newInserted: 0, skippedDuplicates: 0 };

  const allMappings = await DeviceMapping.find().lean();
  const mappingMap = new Map();
  allMappings.forEach(m => mappingMap.set(Number(m.enrollId), m.employeeId));

  let newInserted = 0;
  let skippedDuplicates = 0;

  for (const p of punches) {
    const enrollId = Number(p.enrollId);
    const punchTime = new Date(p.punchTime);
    if (!enrollId || isNaN(punchTime.getTime())) continue;

    // Deduplicate: same enrollId within +/- 60 seconds
    const windowStart = new Date(punchTime.getTime() - 60000);
    const windowEnd = new Date(punchTime.getTime() + 60000);

    const exists = await AttendancePunch.findOne({
      enrollId,
      punchTime: { $gte: windowStart, $lte: windowEnd }
    });

    if (exists) {
      skippedDuplicates++;
      continue;
    }

    const employeeId = mappingMap.get(enrollId) || null;

    const newPunch = new AttendancePunch({
      deviceId: p.deviceId || defaultDeviceId,
      enrollId,
      employeeId,
      punchTime,
      punchType: p.punchType || 'UNKNOWN',
      verifyMode: p.verifyMode || 'UNKNOWN',
      rawPayload: p.rawPayload || '',
      processed: false,
      unmatched: !employeeId
    });

    await newPunch.save();
    newInserted++;
  }

  return { newInserted, skippedDuplicates };
}

// ─── Option 1: Direct LAN IP Sync (ZKTeco Protocol Port 4370) ────────────────
apiRouter.post('/api/attendance/device/sync-ip', verifyPermission('attendance', 'edit'), async (req, res) => {
  if (!ZKLib) {
    return res.status(500).json({ message: 'node-zklib is not installed or available on this server.' });
  }
  const { ip, port = 4370, timeout = 5000 } = req.body;
  if (!ip) return res.status(400).json({ message: 'Device IP address is required (e.g. 192.168.1.201).' });

  const zk = new ZKLib(ip, Number(port) || 4370, Number(timeout) || 5000, 4000);
  try {
    await zk.createSocket();
    const attendanceData = await zk.getAttendances();
    let records = [];
    if (attendanceData && Array.isArray(attendanceData.data)) {
      records = attendanceData.data;
    } else if (Array.isArray(attendanceData)) {
      records = attendanceData;
    }

    let users = [];
    try {
      const userData = await zk.getUsers();
      users = Array.isArray(userData?.data) ? userData.data : (Array.isArray(userData) ? userData : []);
    } catch (_) { }

    await zk.disconnect();

    const punchesToIngest = records.map(r => ({
      enrollId: parseInt(r.deviceUserId || r.userSn || 0),
      punchTime: new Date(r.recordTime),
      punchType: 'UNKNOWN',
      verifyMode: 'FINGERPRINT/CARD',
      deviceId: `F8-${ip}`,
      rawPayload: JSON.stringify(r)
    })).filter(p => p.enrollId > 0 && !isNaN(p.punchTime.getTime()));

    const result = await ingestPunchRecords(punchesToIngest, `F8-${ip}`);

    res.json({
      success: true,
      message: `Connected to ${ip}:${port}. Fetched ${records.length} logs (${result.newInserted} new, ${result.skippedDuplicates} existing).`,
      totalDeviceRecords: records.length,
      newInserted: result.newInserted,
      skippedDuplicates: result.skippedDuplicates,
      usersFound: users.length
    });
  } catch (err) {
    try { await zk.disconnect(); } catch (_) { }
    console.error('[Attendance] ZK direct IP sync error:', err.message);
    res.status(500).json({
      success: false,
      message: `Failed to connect to device at ${ip}:${port}. Error: ${err.message || 'Connection timeout. Check network cable and IP.'}`
    });
  }
});

// Test connection to Device IP on port 4370
apiRouter.post('/api/attendance/device/test-ip', verifyPermission('attendance', 'view'), async (req, res) => {
  const { ip, port = 4370, timeout = 4000 } = req.body;
  if (!ip) return res.status(400).json({ message: 'Device IP is required' });

  const net = require('net');
  const socket = new net.Socket();
  let status = 'closed';

  socket.setTimeout(Number(timeout) || 4000);
  socket.on('connect', () => {
    status = 'open';
    socket.destroy();
  });
  socket.on('timeout', () => {
    socket.destroy();
  });
  socket.on('error', () => {
    socket.destroy();
  });
  socket.on('close', () => {
    if (status === 'open') {
      res.json({ success: true, message: `Device is online and reachable at ${ip}:${port} (TCP port open).` });
    } else {
      res.status(400).json({ success: false, message: `Could not reach ${ip}:${port}. Please verify the device is powered on, connected to LAN, and IP is correct.` });
    }
  });

  socket.connect(Number(port) || 4370, ip);
});

// ─── Option 2: Local Sync Agent Bulk Push ─────────────────────────────────────
app.post('/api/attendance/device/push-bulk', async (req, res) => {
  try {
    const { deviceId = 'F8-AGENT', punches = [] } = req.body;
    if (!Array.isArray(punches) || punches.length === 0) {
      return res.status(400).json({ success: false, message: 'No punches array provided' });
    }

    const formatted = punches.map(p => ({
      enrollId: parseInt(p.enrollId || p.deviceUserId || p.userSn || p.PIN || 0),
      punchTime: new Date(p.punchTime || p.recordTime || p.DateTime || p.Stamp),
      punchType: p.punchType || 'UNKNOWN',
      verifyMode: p.verifyMode || 'FINGERPRINT',
      deviceId: deviceId,
      rawPayload: JSON.stringify(p)
    })).filter(p => p.enrollId > 0 && !isNaN(p.punchTime.getTime()));

    const result = await ingestPunchRecords(formatted, deviceId);
    res.json({
      success: true,
      message: `Processed ${formatted.length} punches from agent (${result.newInserted} new inserted, ${result.skippedDuplicates} skipped).`,
      ...result
    });
  } catch (err) {
    console.error('[Attendance] Push-bulk error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Download / View Local Sync Agent script
apiRouter.get('/api/attendance/device/agent-script', verifyPermission('attendance', 'view'), (req, res) => {
  const host = req.get('host') || 'localhost:5000';
  const proto = req.protocol || 'http';
  const scriptContent = `/**
 * ZKTeco F8 Local Office Sync Agent
 * Runs on any computer connected to the same LAN / Wi-Fi as your ZKTeco device.
 * Automatically synchronizes punch records to your ERP cloud server.
 *
 * Setup:
 * 1. Ensure Node.js is installed (https://nodejs.org)
 * 2. In a terminal:
 *      npm install node-zklib axios
 * 3. Run:
 *      node zk-sync-agent.js
 */

const ZKLib = require('node-zklib');
const axios = require('axios');

// Configuration
const DEVICE_IP     = process.env.DEVICE_IP || '192.168.1.201';
const DEVICE_PORT   = parseInt(process.env.DEVICE_PORT || '4370');
const ERP_SERVER_URL= process.env.ERP_SERVER_URL || '${proto}://${host}';
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '60'); // in seconds

console.log('--------------------------------------------------');
console.log(' ZKTeco F8 Sync Agent Started');
console.log(' Device:  ' + DEVICE_IP + ':' + DEVICE_PORT);
console.log(' ERP:     ' + ERP_SERVER_URL);
console.log(' Sync:    Every ' + SYNC_INTERVAL + 's');
console.log('--------------------------------------------------');

async function syncOnce() {
  const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 5000, 4000);
  try {
    process.stdout.write('[' + new Date().toLocaleTimeString() + '] Connecting to F8... ');
    await zk.createSocket();
    const res = await zk.getAttendances();
    await zk.disconnect();

    const records = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    console.log('Fetched ' + records.length + ' punches.');

    if (records.length === 0) return;

    // Send bulk to ERP
    const payload = {
      deviceId: 'F8-' + DEVICE_IP,
      punches: records.map(r => ({
        enrollId: r.deviceUserId || r.userSn,
        punchTime: r.recordTime,
        verifyMode: 'FINGERPRINT'
      }))
    };

    const erpRes = await axios.post(ERP_SERVER_URL + '/api/attendance/device/push-bulk', payload, { timeout: 10000 });
    console.log('     -> ERP Response: ' + erpRes.data.message);
  } catch (err) {
    try { await zk.disconnect(); } catch (_) {}
    console.error('     -> Sync Error: ' + err.message);
  }
}

// Initial sync and recurring loop
syncOnce();
setInterval(syncOnce, SYNC_INTERVAL * 1000);
`;

  res.setHeader('Content-Type', 'text/javascript');
  res.setHeader('Content-Disposition', 'attachment; filename="zk-sync-agent.js"');
  res.send(scriptContent);
});

// ─── Option 3: USB Attendance Log File Upload ─────────────────────────────────
apiRouter.post('/api/attendance/device/upload-usb', verifyPermission('attendance', 'edit'), attUpload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'No file uploaded. Please select an attlog.dat, .csv, or .txt file.' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const punchesToIngest = [];
    const punchTypeMap = { 0: 'IN', 1: 'OUT', 2: 'BREAK_OUT', 3: 'BREAK_IN', 4: 'OT_IN', 5: 'OT_OUT' };

    for (const line of lines) {
      let parts = line.split('\t');
      if (parts.length < 2) parts = line.split(',');
      if (parts.length < 2) parts = line.split(/\s{2,}/);
      if (parts.length < 2) continue;

      if (isNaN(parseInt(parts[0]))) continue;

      const enrollId = parseInt(parts[0]);
      let stampStr = (parts[1] || '').trim();
      if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && /^\d{2}:\d{2}(:\d{2})?$/.test(parts[2])) {
        stampStr = `${parts[1]} ${parts[2]}`;
      }

      const punchTime = new Date(stampStr);
      if (isNaN(punchTime.getTime()) || enrollId <= 0) continue;

      const verify = parts[2] || 'FINGERPRINT';
      const stateCode = parseInt(parts[3] || 0);
      const punchType = punchTypeMap[stateCode] || 'UNKNOWN';

      punchesToIngest.push({
        enrollId,
        punchTime,
        punchType,
        verifyMode: String(verify),
        deviceId: 'USB-IMPORT',
        rawPayload: line
      });
    }

    if (punchesToIngest.length === 0) {
      return res.status(400).json({ message: 'No valid attendance records found in file. Ensure file contains ZKTeco attlog format.' });
    }

    const result = await ingestPunchRecords(punchesToIngest, 'USB-IMPORT');

    res.json({
      success: true,
      message: `Parsed ${punchesToIngest.length} records from USB file (${result.newInserted} new punches added, ${result.skippedDuplicates} duplicates skipped).`,
      totalParsed: punchesToIngest.length,
      newInserted: result.newInserted,
      skippedDuplicates: result.skippedDuplicates
    });
  } catch (err) {
    console.error('[Attendance] USB upload error:', err.message);
    res.status(500).json({ message: 'Failed to process USB file: ' + err.message });
  }
});

// ─── 2. Device Mapping CRUD ───────────────────────────────────────────────────
apiRouter.get('/api/attendance/mappings', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const mappings = await DeviceMapping.find().sort({ enrollId: 1 });
    res.json(mappings);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.post('/api/attendance/mappings', verifyPermission('attendance', 'add'), async (req, res) => {
  try {
    const { enrollId, employeeId, employeeName, employeeEmpId, deviceId, notes } = req.body;
    if (!enrollId || !employeeId) return res.status(400).json({ message: 'enrollId and employeeId are required' });

    // Upsert: update if exists, create if not
    const mapping = await DeviceMapping.findOneAndUpdate(
      { enrollId: Number(enrollId) },
      { enrollId: Number(enrollId), employeeId, employeeName: employeeName || '', employeeEmpId: employeeEmpId || '', deviceId: deviceId || 'F8-DEFAULT', notes: notes || '' },
      { upsert: true, returnDocument: 'after' }
    );

    // Retroactively link any unmatched punches for this enrollId
    await AttendancePunch.updateMany({ enrollId: Number(enrollId), unmatched: true }, { employeeId, unmatched: false });

    res.json(mapping);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

apiRouter.delete('/api/attendance/mappings/:id', verifyPermission('attendance', 'delete'), async (req, res) => {
  try {
    await DeviceMapping.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mapping deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── Attendance Permission & Scope Helpers ────────────────────────────────────
const canUserViewAllAttendance = async (user) => {
  if (!user) return false;
  const username = (user.username || '').toLowerCase().trim();
  const role = (user.role || '').toLowerCase().trim();
  if (username === 'admin' || role === 'admin' || role === 'incharge') {
    return true;
  }
  try {
    const resolvedPerms = await resolveUserPermissions(user.role, user.permissions);
    if (!resolvedPerms) return false;
    const att = resolvedPerms.attendance || {};
    const emp = resolvedPerms.employees || {};
    if (att.viewAll || att.edit || att.delete || att.special || emp.view || emp.edit) {
      return true;
    }
  } catch (e) {
    console.error('canUserViewAllAttendance error:', e);
  }
  return false;
};

const getEmployeeForUser = async (user) => {
  if (!user) return null;
  const uId = (user.employeeId || user.username || '').toLowerCase().trim();
  const uName = (user.name || '').toLowerCase().trim();
  const uEmail = (user.email || '').toLowerCase().trim();

  try {
    const employees = await Employee.find();
    for (const emp of employees) {
      let d = decryptData(emp.data);
      if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
        try { d = decryptData(d.data); } catch (e) { }
      }
      if (!d) continue;
      const empId = (d.employeeId || '').toLowerCase().trim();
      const empName = (d.name || d.nameEn || '').toLowerCase().trim();
      const empEmail = (d.email || '').toLowerCase().trim();

      if ((uId && empId === uId) || (uEmail && empEmail === uEmail) || (uName && empName === uName)) {
        return {
          _id: emp._id,
          employeeId: d.employeeId || user.username,
          name: d.name || d.nameEn || user.name
        };
      }
    }
  } catch (err) {
    console.error('getEmployeeForUser error:', err);
  }
  return null;
};

const buildOwnEmployeeFilter = async (user) => {
  const username = user?.username || '';
  const orConditions = [
    { employeeEmpId: username },
    { employeeName: user?.name || username }
  ];
  if (user?.employeeId) {
    orConditions.push({ employeeEmpId: user.employeeId });
  }
  const myEmp = await getEmployeeForUser(user);
  if (myEmp) {
    orConditions.push({ employeeId: myEmp._id });
    if (myEmp.employeeId) orConditions.push({ employeeEmpId: myEmp.employeeId });
    if (myEmp.name) orConditions.push({ employeeName: myEmp.name });
  }
  return orConditions;
};

// ─── 3. Raw Punches ───────────────────────────────────────────────────────────
apiRouter.get('/api/attendance/punches', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const { date, employeeId, unmatched, limit = 200 } = req.query;
    const query = {};
    if (date) {
      query.punchTime = { $gte: new Date(`${date}T00:00:00.000Z`), $lte: new Date(`${date}T23:59:59.999Z`) };
    }
    const canViewAll = await canUserViewAllAttendance(req.session.user);
    if (!canViewAll) {
      query.$or = await buildOwnEmployeeFilter(req.session.user);
    } else {
      if (employeeId) query.employeeId = employeeId;
      if (unmatched === 'true') query.unmatched = true;
    }

    const punches = await AttendancePunch.find(query).sort({ punchTime: -1 }).limit(Number(limit));
    res.json(punches);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── 4. Process daily logs (manual trigger or scheduled) ──────────────────────
apiRouter.post('/api/attendance/process', verifyPermission('attendance', 'edit'), async (req, res) => {
  try {
    const { date } = req.body; // "YYYY-MM-DD", defaults to today
    const targetDate = date || new Date().toISOString().split('T')[0];

    const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

    // Get all unique employeeIds that punched on this date
    const uniqueEmployees = await AttendancePunch.distinct('employeeId', {
      punchTime: { $gte: dayStart, $lte: dayEnd },
      employeeId: { $ne: null }
    });

    let processed = 0;

    // Also ensure ABSENT records for all known employees
    const allEmployees = await Employee.find({});

    for (const emp of allEmployees) {
      let dec;
      try {
        dec = decryptData(emp.data);
        if (dec && dec.data && typeof dec.data === 'string' && !dec.employeeId) {
          try { dec = decryptData(dec.data); } catch (e) { }
        }
      } catch (e) { continue; }

      const empObjId = emp._id;
      const hasPunch = uniqueEmployees.some(id => id && id.toString() === empObjId.toString());

      if (hasPunch) {
        const result = await processEmployeeDay(empObjId, targetDate);
        if (result) {
          await AttendanceLog.findOneAndUpdate(
            { employeeId: empObjId, date: targetDate },
            {
              employeeId: empObjId,
              employeeName: dec?.name || dec?.firstName || '',
              employeeEmpId: dec?.employeeId || '',
              date: targetDate,
              shiftId: result.shiftId,
              firstPunchIn: result.firstIn,
              lastPunchOut: result.lastOut,
              totalHours: result.totalHours,
              overtimeHours: result.overtimeHours,
              status: result.status,
              manualOverride: false
            },
            { upsert: true, returnDocument: 'after' }
          );
          await AttendancePunch.updateMany(
            { employeeId: empObjId, punchTime: { $gte: dayStart, $lte: dayEnd } },
            { processed: true }
          );
          processed++;
        }
      } else {
        // Ensure ABSENT record exists (don't overwrite manual corrections)
        const existing = await AttendanceLog.findOne({ employeeId: empObjId, date: targetDate });
        if (!existing) {
          await AttendanceLog.create({
            employeeId: empObjId,
            employeeName: dec?.name || dec?.firstName || '',
            employeeEmpId: dec?.employeeId || '',
            date: targetDate,
            status: 'ABSENT'
          });
        }
      }
    }

    res.json({ message: `Processed ${processed} employees for ${targetDate}`, date: targetDate });
  } catch (err) {
    console.error('[Attendance] Process error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── 5. Attendance Logs ───────────────────────────────────────────────────────
apiRouter.get('/api/attendance/logs', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const { date, fromDate, toDate, employeeId, status, limit = 500 } = req.query;
    const query = {};

    if (date) {
      query.date = date;
    } else if (fromDate && toDate) {
      query.date = { $gte: fromDate, $lte: toDate };
    } else if (fromDate) {
      query.date = { $gte: fromDate };
    }

    const canViewAll = await canUserViewAllAttendance(req.session.user);
    if (!canViewAll) {
      query.$or = await buildOwnEmployeeFilter(req.session.user);
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (status) query.status = status;

    const logs = await AttendanceLog.find(query).sort({ date: -1, employeeName: 1 }).limit(Number(limit));
    res.json(logs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.put('/api/attendance/logs/:id', verifyPermission('attendance', 'edit'), async (req, res) => {
  try {
    const user = req.session.user;
    const update = {
      ...req.body,
      manualOverride: true,
      overriddenBy: user?.username || 'admin'
    };
    const log = await AttendanceLog.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!log) return res.status(404).json({ message: 'Log not found' });
    res.json(log);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Today's summary counts
apiRouter.get('/api/attendance/summary/today', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const canViewAll = await canUserViewAllAttendance(req.session.user);

    if (!canViewAll) {
      const ownFilter = await buildOwnEmployeeFilter(req.session.user);
      const myLog = await AttendanceLog.findOne({ date: today, $or: ownFilter });
      const status = myLog?.status || 'ABSENT';

      return res.json({
        date: today,
        present: (status === 'PRESENT' || status === 'LATE' || status === 'HALF_DAY') ? 1 : 0,
        absent: status === 'ABSENT' ? 1 : 0,
        late: status === 'LATE' ? 1 : 0,
        halfDay: status === 'HALF_DAY' ? 1 : 0,
        onLeave: status === 'LEAVE' ? 1 : 0,
        totalEmployees: 1,
        unmatchedPunches: 0,
        isOwnOnly: true,
        myStatus: status,
        firstPunchIn: myLog?.firstPunchIn || null,
        lastPunchOut: myLog?.lastPunchOut || null,
        totalHours: myLog?.totalHours || 0
      });
    }

    const [present, absent, late, halfDay, onLeave] = await Promise.all([
      AttendanceLog.countDocuments({ date: today, status: 'PRESENT' }),
      AttendanceLog.countDocuments({ date: today, status: 'ABSENT' }),
      AttendanceLog.countDocuments({ date: today, status: 'LATE' }),
      AttendanceLog.countDocuments({ date: today, status: 'HALF_DAY' }),
      AttendanceLog.countDocuments({ date: today, status: 'LEAVE' }),
    ]);
    const totalEmployees = await Employee.countDocuments({});
    const unmatchedPunches = await AttendancePunch.countDocuments({ unmatched: true });

    res.json({ date: today, present, absent, late, halfDay, onLeave, totalEmployees, unmatchedPunches, isOwnOnly: false });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Monthly summary per employee
apiRouter.get('/api/attendance/report/monthly', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const { month, year, employeeId } = req.query; // month: "01"-"12", year: "2026"
    const y = year || new Date().getFullYear();
    const m = (month || String(new Date().getMonth() + 1)).padStart(2, '0');
    const fromDate = `${y}-${m}-01`;
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    const toDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    const query = { date: { $gte: fromDate, $lte: toDate } };
    const canViewAll = await canUserViewAllAttendance(req.session.user);
    if (!canViewAll) {
      query.$or = await buildOwnEmployeeFilter(req.session.user);
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    const logs = await AttendanceLog.find(query).sort({ employeeName: 1, date: 1 });

    // Group by employee
    const byEmp = {};
    for (const log of logs) {
      const key = log.employeeEmpId || log.employeeId?.toString();
      if (!byEmp[key]) {
        byEmp[key] = {
          employeeId: log.employeeId,
          employeeName: log.employeeName,
          employeeEmpId: log.employeeEmpId,
          present: 0, absent: 0, late: 0, halfDay: 0, leave: 0,
          totalHours: 0, overtimeHours: 0, logs: []
        };
      }
      const s = log.status;
      if (s === 'PRESENT') byEmp[key].present++;
      else if (s === 'ABSENT') byEmp[key].absent++;
      else if (s === 'LATE') { byEmp[key].present++; byEmp[key].late++; }
      else if (s === 'HALF_DAY') byEmp[key].halfDay++;
      else if (s === 'LEAVE') byEmp[key].leave++;
      byEmp[key].totalHours = Math.round((byEmp[key].totalHours + (log.totalHours || 0)) * 100) / 100;
      byEmp[key].overtimeHours = Math.round((byEmp[key].overtimeHours + (log.overtimeHours || 0)) * 100) / 100;
      byEmp[key].logs.push({ date: log.date, status: log.status, firstPunchIn: log.firstPunchIn, lastPunchOut: log.lastPunchOut, totalHours: log.totalHours });
    }

    res.json({ month: m, year: y, fromDate, toDate, summary: Object.values(byEmp) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── 6. Shift Management ──────────────────────────────────────────────────────
apiRouter.get('/api/attendance/shifts', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const shifts = await ShiftConfig.find().sort({ createdAt: -1 });
    res.json(shifts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.post('/api/attendance/shifts', verifyPermission('attendance', 'add'), async (req, res) => {
  try {
    const shift = new ShiftConfig(req.body);
    const saved = await shift.save();
    res.status(201).json(saved);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

apiRouter.put('/api/attendance/shifts/:id', verifyPermission('attendance', 'edit'), async (req, res) => {
  try {
    const shift = await ShiftConfig.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!shift) return res.status(404).json({ message: 'Shift not found' });
    res.json(shift);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

apiRouter.delete('/api/attendance/shifts/:id', adminOnly, async (req, res) => {
  try {
    await ShiftConfig.findByIdAndDelete(req.params.id);
    res.json({ message: 'Shift deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── 7. Leave Management ──────────────────────────────────────────────────────
apiRouter.get('/api/attendance/leaves', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const query = {};
    if (status) query.status = status;

    const canViewAll = await canUserViewAllAttendance(req.session.user);
    if (!canViewAll) {
      query.$or = await buildOwnEmployeeFilter(req.session.user);
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    const leaves = await LeaveRequest.find(query).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

apiRouter.post('/api/attendance/leaves', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const canViewAll = await canUserViewAllAttendance(user);
    const resolvedPerms = await resolveUserPermissions(user.role, user.permissions);
    const canAdd = user.username === 'admin' || (user.role || '').toLowerCase() === 'admin' || !!(resolvedPerms?.attendance?.add) || !!(resolvedPerms?.attendance?.view);
    if (!canAdd) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to request leave' });
    }

    const myEmp = await getEmployeeForUser(user);
    const leaveData = { ...req.body };
    if (!canViewAll) {
      if (myEmp) {
        leaveData.employeeId = myEmp._id;
        leaveData.employeeEmpId = myEmp.employeeId || user.username;
        leaveData.employeeName = myEmp.name || user.name;
      } else {
        leaveData.employeeEmpId = user.username;
        leaveData.employeeName = user.name || user.username;
      }
    }

    const total = dayDiff(leaveData.fromDate, leaveData.toDate);
    const leave = new LeaveRequest({ ...leaveData, createdBy: user.username, totalDays: total });
    const saved = await leave.save();
    res.status(201).json(saved);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

apiRouter.put('/api/attendance/leaves/:id', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const existing = await LeaveRequest.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Leave request not found' });

    const isAdmin = user.username === 'admin' || (user.role || '').toLowerCase() === 'admin';
    const resolvedPerms = await resolveUserPermissions(user.role, user.permissions);
    const canApprove = isAdmin || !!(resolvedPerms?.attendance?.approveLeave);
    const canEditLeave = isAdmin || !!(resolvedPerms?.attendance?.editLeave) || !!(resolvedPerms?.attendance?.edit);

    const myEmp = await getEmployeeForUser(user);
    const isOwner = (existing.createdBy && existing.createdBy.toLowerCase() === user.username.toLowerCase()) ||
      (myEmp && existing.employeeId && existing.employeeId.toString() === myEmp._id.toString()) ||
      (myEmp && existing.employeeEmpId && (
        (myEmp.employeeId && existing.employeeEmpId.toLowerCase() === myEmp.employeeId.toLowerCase()) ||
        existing.employeeEmpId.toLowerCase() === user.username.toLowerCase()
      )) ||
      (existing.employeeEmpId && existing.employeeEmpId.toLowerCase() === user.username.toLowerCase());

    const isPending = existing.status === 'PENDING';
    const canEditThis = canEditLeave || (isOwner && isPending);

    const { status, approveNote, employeeId, employeeName, employeeEmpId, leaveType, fromDate, toDate, reason } = req.body;

    if (status === 'APPROVED' || status === 'REJECTED') {
      if (!canApprove) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to accept or reject leave requests' });
      }
    }

    const isEditingFields = employeeId !== undefined || employeeName !== undefined || employeeEmpId !== undefined ||
      leaveType !== undefined || fromDate !== undefined || toDate !== undefined || reason !== undefined ||
      (status !== undefined && status !== 'APPROVED' && status !== 'REJECTED');

    if (isEditingFields && !canEditThis) {
      if (isOwner && !isPending) {
        return res.status(403).json({ message: 'Forbidden: Leave request is already accepted and cannot be edited by applicant. Only authorized users can edit after accept.' });
      }
      return res.status(403).json({ message: 'Forbidden: You do not have permission to edit this leave request' });
    }

    const update = {};
    if (status !== undefined && (canApprove || canEditLeave)) update.status = status;
    if (canEditLeave) {
      if (employeeId !== undefined) update.employeeId = employeeId;
      if (employeeName !== undefined) update.employeeName = employeeName;
      if (employeeEmpId !== undefined) update.employeeEmpId = employeeEmpId;
    }
    if (leaveType !== undefined) update.leaveType = leaveType;
    if (fromDate !== undefined) update.fromDate = fromDate;
    if (toDate !== undefined) update.toDate = toDate;
    if (reason !== undefined) update.reason = reason;

    if (fromDate || toDate) {
      const fDate = fromDate || existing.fromDate;
      const tDate = toDate || existing.toDate;
      if (fDate && tDate) {
        update.totalDays = dayDiff(fDate, tDate);
      }
    }

    if (status === 'APPROVED' || status === 'REJECTED') {
      update.approvedBy = user?.username || 'admin';
      update.approvedAt = new Date();
      update.approveNote = approveNote || '';
    }
    const leave = await LeaveRequest.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    // If approved, update AttendanceLog for those dates
    if (leave.status === 'APPROVED') {
      if (existing.status === 'APPROVED' && (existing.fromDate !== leave.fromDate || existing.toDate !== leave.toDate)) {
        let oldD = new Date(existing.fromDate);
        const oldEnd = new Date(existing.toDate);
        while (oldD <= oldEnd) {
          const dStr = oldD.toISOString().split('T')[0];
          await AttendanceLog.deleteOne({ employeeId: existing.employeeId, date: dStr, status: 'LEAVE' });
          oldD.setDate(oldD.getDate() + 1);
        }
      }

      let d = new Date(leave.fromDate);
      const end = new Date(leave.toDate);
      while (d <= end) {
        const dateStr = d.toISOString().split('T')[0];
        await AttendanceLog.findOneAndUpdate(
          { employeeId: leave.employeeId, date: dateStr },
          {
            employeeId: leave.employeeId,
            employeeName: leave.employeeName,
            employeeEmpId: leave.employeeEmpId,
            date: dateStr,
            status: 'LEAVE',
            leaveType: leave.leaveType,
            remarks: `Leave: ${leave.leaveType}`,
            manualOverride: true,
            overriddenBy: user?.username || 'admin'
          },
          { upsert: true }
        );
        d.setDate(d.getDate() + 1);
      }
    }

    res.json(leave);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

apiRouter.delete('/api/attendance/leaves/:id', verifyPermission('attendance', 'delete'), async (req, res) => {
  try {
    const leave = await LeaveRequest.findByIdAndDelete(req.params.id);
    if (leave && leave.status === 'APPROVED') {
      let d = new Date(leave.fromDate);
      const end = new Date(leave.toDate);
      while (d <= end) {
        const dateStr = d.toISOString().split('T')[0];
        await AttendanceLog.deleteOne({ employeeId: leave.employeeId, date: dateStr, status: 'LEAVE' });
        d.setDate(d.getDate() + 1);
      }
    }
    res.json({ message: 'Leave request deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─── 8. Live punch feed (last N punches) ─────────────────────────────────────
apiRouter.get('/api/attendance/live', verifyPermission('attendance', 'view'), async (req, res) => {
  try {
    const canViewAll = await canUserViewAllAttendance(req.session.user);
    const filter = {};
    if (!canViewAll) {
      filter.$or = await buildOwnEmployeeFilter(req.session.user);
    }
    const punches = await AttendancePunch.find(filter).sort({ punchTime: -1 }).limit(30);
    res.json(punches);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

