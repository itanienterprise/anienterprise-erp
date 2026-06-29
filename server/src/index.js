const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

dotenv.config();

const app = express();
const apiRouter = express.Router();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

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
    secure: false, // Set to true if using HTTPS
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
const Return = require('./models/Return');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Notification = require('./models/Notification');
const Bank = require('./models/Bank');
const Exporter = require('./models/Exporter');
const CnF = require('./models/CnF');
const Insurance = require('./models/Insurance');
const LCManagement = require('./models/LCManagement');
const LCGatePass = require('./models/LCGatePass');
const LCExpense = require('./models/LCExpense');
const PI = require('./models/PI');
const PackingList = require('./models/PackingList');
const TRSetup = require('./models/TRSetup');
const MetaData = require('./models/MetaData');
const CnFPayment = require('./models/CnFPayment');
const InsurancePayment = require('./models/InsurancePayment');
const { encryptData, decryptData } = require('./utils/encryption');
const CryptoJS = require('crypto-js');

// Auto-seed admin user if no users exist
const seedAdminUser = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const hashedPassword = CryptoJS.SHA256('admin123').toString(CryptoJS.enc.Hex);
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




// Secure Gateway
app.post('/v', (req, res, next) => {
  const { p, m, d } = req.body;
  if (!p || !m) return res.status(400).json({ message: 'Invalid gateway request' });

  // Internal dispatching
  req.url = p; 
  req.method = m;
  req.body = d;

  // Pass to internal router
  apiRouter(req, res, next);
});

// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Admin Authorization Middleware
const adminOnly = (req, res, next) => {
  const user = req.session.user;
  const isAdmin = user && (user.username === 'admin' || user.role === 'admin');
  if (!isAdmin) {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
  next();
};

// IP Records APIs
apiRouter.post('/api/ip-records', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newRecord = new IpRecord({ data: encryptedData });
    const savedRecord = await newRecord.save();
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete IP Record
apiRouter.delete('/api/ip-records/:id', async (req, res) => {
  try {
    const deletedRecord = await IpRecord.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update IP Record (for Edit functionality)
apiRouter.put('/api/ip-records/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await IpRecord.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Record not found' });
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
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
    res.status(201).json({ ...req.body, _id: savedImporter._id, createdAt: savedImporter.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete Importer
apiRouter.delete('/api/importers/:id', adminOnly, async (req, res) => {
  try {
    const deletedImporter = await Importer.findByIdAndDelete(req.params.id);
    if (!deletedImporter) return res.status(404).json({ message: 'Importer not found' });
    res.json({ message: 'Importer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Importer
apiRouter.put('/api/importers/:id', adminOnly, async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedImporter = await Importer.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedImporter) return res.status(404).json({ message: 'Importer not found' });
    res.json({ ...req.body, _id: updatedImporter._id, createdAt: updatedImporter.createdAt });
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
    res.status(201).json({ ...req.body, _id: savedExporter._id, createdAt: savedExporter.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete Exporter
apiRouter.delete('/api/exporters/:id', adminOnly, async (req, res) => {
  try {
    const deletedExporter = await Exporter.findByIdAndDelete(req.params.id);
    if (!deletedExporter) return res.status(404).json({ message: 'Exporter not found' });
    res.json({ message: 'Exporter deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Exporter
apiRouter.put('/api/exporters/:id', adminOnly, async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedExporter = await Exporter.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedExporter) return res.status(404).json({ message: 'Exporter not found' });
    res.json({ ...req.body, _id: updatedExporter._id, createdAt: updatedExporter.createdAt });
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

// C&F APIs
apiRouter.post('/api/cnfs', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newCnF = new CnF({ data: encryptedData });
    const savedCnF = await newCnF.save();
    res.status(201).json({ ...req.body, _id: savedCnF._id, createdAt: savedCnF.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/cnfs/:id', adminOnly, async (req, res) => {
  try {
    const deletedCnF = await CnF.findByIdAndDelete(req.params.id);
    if (!deletedCnF) return res.status(404).json({ message: 'C&F not found' });
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
    res.json({ ...req.body, _id: updatedCnF._id, createdAt: updatedCnF.createdAt });
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
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/cnf-payments/:id', adminOnly, async (req, res) => {
  try {
    const record = await CnFPayment.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Payment record not found' });

    const decData = decryptData(record.data);
    if (decData && decData.lcExpenseId) {
      await LCExpense.findByIdAndDelete(decData.lcExpenseId);
    }

    await CnFPayment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/cnf-payments/:id', adminOnly, async (req, res) => {
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
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/cnf-payments', async (req, res) => {
  try {
    const records = await CnFPayment.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
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
    res.status(201).json({ ...req.body, _id: savedPort._id, createdAt: savedPort.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/ports/:id', async (req, res) => {
  try {
    const deletedPort = await Port.findByIdAndDelete(req.params.id);
    if (!deletedPort) return res.status(404).json({ message: 'Port not found' });
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
    res.json({ ...req.body, _id: updatedPort._id, createdAt: updatedPort.createdAt });
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
    const encryptedData = encryptData(req.body);
    const newStock = new Stock({ data: encryptedData });
    const savedStock = await newStock.save();
    res.status(201).json({ ...req.body, _id: savedStock._id, createdAt: savedStock.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/stock/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    const isAdmin = userSession && (userSession.username === 'admin' || (userSession.role || '').toLowerCase() === 'admin');

    const existingStock = await Stock.findById(req.params.id);
    if (!existingStock) return res.status(404).json({ message: 'Item not found' });

    let existingData = decryptData(existingStock.data);
    if (existingData && existingData.data && typeof existingData.data === 'string' && !existingData.productName) {
      try { existingData = decryptData(existingData.data); } catch (e) { }
    }

    if (existingData && existingData.status === 'Requested') {
      const ownerUsername = existingData.requestedByUsername;
      const currentUsername = userSession ? userSession.username : null;
      if (!isAdmin && currentUsername !== ownerUsername) {
        return res.status(403).json({ message: 'Forbidden: Only the owner of the requested stock entry can delete it.' });
      }
    } else {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Forbidden: Admin access required to delete accepted stock entries.' });
      }
    }

    const deletedStock = await Stock.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/stock/:id', async (req, res) => {
  try {
    const userSession = req.session.user;
    const isAdmin = userSession && (userSession.username === 'admin' || (userSession.role || '').toLowerCase() === 'admin');

    const existingStock = await Stock.findById(req.params.id);
    if (!existingStock) return res.status(404).json({ message: 'Item not found' });

    let existingData = decryptData(existingStock.data);
    if (existingData && existingData.data && typeof existingData.data === 'string' && !existingData.productName) {
      try { existingData = decryptData(existingData.data); } catch (e) { }
    }

    if (existingData && existingData.status === 'Requested') {
      const isStatusChange = req.body.status !== existingData.status;
      if (isStatusChange) {
        const canApprove = userSession && (['admin', 'incharge', 'sales manager'].includes((userSession.role || '').toLowerCase()) || userSession.username === 'admin');
        if (!canApprove) {
          return res.status(403).json({ message: 'Forbidden: You do not have permission to approve/reject requested entries.' });
        }
      } else {
        const ownerUsername = existingData.requestedByUsername;
        const currentUsername = userSession ? userSession.username : null;
        if (!isAdmin && currentUsername !== ownerUsername) {
          return res.status(403).json({ message: 'Forbidden: Only the owner of the requested stock entry can edit it.' });
        }
      }
    }

    const encryptedData = encryptData(req.body);
    const updatedStock = await Stock.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    res.json(req.body);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/stock', async (req, res) => {
  try {
    const stock = await Stock.find().sort({ createdAt: -1 });
    const decrypted = stock.map(r => {
      let d = decryptData(r.data);
      // Auto-fallback for testing records that were double-encrypted by the bug
      if (d && d.data && typeof d.data === 'string' && !d.productName) {
        try { d = decryptData(d.data); } catch (e) { /* ignore */ }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Product APIs
apiRouter.post('/api/products', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const newProduct = new Product({ data: encryptedData });
    const savedProduct = await newProduct.save();
    res.status(201).json({ ...req.body, _id: savedProduct._id, createdAt: savedProduct.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/products/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
    res.json({ ...req.body, _id: updatedProduct._id, createdAt: updatedProduct.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/products', async (req, res) => {
  try {
    const records = await Product.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
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
    res.status(201).json(decrypted);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/customers/:id', async (req, res) => {
  try {
    const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
    if (!deletedCustomer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/customers/:id', async (req, res) => {
  try {
    // req.body is already decrypted by the security middleware
    const encryptedData = encryptData(req.body);
    const updatedRecord = await Customer.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Customer not found' });

    // Propagate companyName and customerName changes to related sales
    const sales = await Sale.find();
    for (const s of sales) {
      let d = decryptData(s.data);
      if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
        try { d = decryptData(d.data); } catch(e) {}
      }

      if (d.customerId === req.params.id || (d.customer && d.customer._id === req.params.id)) {
        if (d.companyName !== req.body.companyName || d.customerName !== req.body.customerName) {
          d.companyName = req.body.companyName;
          d.customerName = req.body.customerName;
          s.data = encryptData(d);
          await s.save();
        }
      }
    }

    // Return decrypted record so middleware can re-encrypt it for transport
    const decrypted = { ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt };
    res.json(decrypted);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/customers', async (req, res) => {
  try {
    const records = await Customer.find().sort({ createdAt: -1 });
    const decryptedCustomers = records.map(record => {
      const decrypted = decryptData(record.data);
      return { ...decrypted, _id: record._id, createdAt: record.createdAt };
    });
    res.json(decryptedCustomers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.get('/api/customers/:id', async (req, res) => {
  try {
    const record = await Customer.findById(req.params.id);
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
    res.status(201).json({ ...req.body, _id: savedWarehouse._id, createdAt: savedWarehouse.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/warehouses/:id', async (req, res) => {
  try {
    const deletedWarehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!deletedWarehouse) return res.status(404).json({ message: 'Warehouse not found' });
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
    res.json({ ...req.body, _id: updatedWarehouse._id, createdAt: updatedWarehouse.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/warehouses', async (req, res) => {
  try {
    const records = await Warehouse.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      // Auto-fallback for testing records that were double-encrypted by the bug
      if (d && d.data && typeof d.data === 'string' && !d.whName && !d.name) {
        try { d = decryptData(d.data); } catch (e) { /* ignore */ }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
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
    const prefix = (sType === 'Border' || sType === 'Border Sale') ? 'BS' : 'GS';

    const allSales = await Sale.find();
    const numbers = [];
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
      if (invNo && invNo.startsWith(prefix)) {
        const match = invNo.match(/\d+/);
        if (match) numbers.push(parseInt(match[0]));
      }
    }

    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    const newInvoiceNo = `${prefix}${nextNum.toString().padStart(4, '0')}`;
    saleData.invoiceNo = newInvoiceNo;

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

    if (existingData && existingData.status === 'Requested') {
      const isStatusChange = req.body.status !== existingData.status;
      if (isStatusChange) {
        const canApprove = userSession && (['admin', 'incharge', 'sales manager'].includes((userSession.role || '').toLowerCase()) || userSession.username === 'admin');
        if (!canApprove) {
          return res.status(403).json({ message: 'Forbidden: You do not have permission to approve/reject requested entries.' });
        }
      } else {
        const ownerUsername = existingData.requestedByUsername;
        const currentUsername = userSession ? userSession.username : null;
        if (!isAdmin && currentUsername !== ownerUsername) {
          return res.status(403).json({ message: 'Forbidden: Only the owner of the requested sale can edit it before acceptance.' });
        }
      }
    } else {
      if (!isAdmin) {
        if (req.body.isCnfCommissionUpdate) {
          // Allow C&F commission updates to bypass the general rate missing and edit locks
        } else {
          const wasRateMissing = existingData.rateMissing === true;
          const alreadyEdited = existingData.isEdited === true;

          if (!wasRateMissing) {
            return res.status(403).json({ message: 'Forbidden: You cannot edit a sale entry that already has a rate.' });
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
    const records = await Sale.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      // Auto-fallback for testing records that were double-encrypted by the bug
      if (d && d.data && typeof d.data === 'string' && !d.invoiceNo) {
        try { d = decryptData(d.data); } catch (e) { /* ignore */ }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
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
    res.status(201).json({ ...req.body, _id: savedReturn._id, createdAt: savedReturn.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/returns', async (req, res) => {
  try {
    const records = await Return.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/returns/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedReturn = await Return.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedReturn) return res.status(404).json({ message: 'Return not found' });
    res.json({ ...req.body, _id: updatedReturn._id, createdAt: updatedReturn.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/returns/:id', async (req, res) => {
  try {
    const deletedReturn = await Return.findByIdAndDelete(req.params.id);
    if (!deletedReturn) return res.status(404).json({ message: 'Return not found' });
    res.json({ message: 'Return deleted' });
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
    res.status(201).json({ ...req.body, _id: savedBank._id, createdAt: savedBank.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/banks/:id', async (req, res) => {
  try {
    const deletedBank = await Bank.findByIdAndDelete(req.params.id);
    if (!deletedBank) return res.status(404).json({ message: 'Bank not found' });
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
    res.json({ ...req.body, _id: updatedBank._id, createdAt: updatedBank.createdAt });
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
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/insurance/:id', async (req, res) => {
  try {
    const deletedRecord = await Insurance.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Insurance record not found' });
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
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
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
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/insurance-payments/:id', adminOnly, async (req, res) => {
  try {
    const deletedRecord = await InsurancePayment.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Payment record not found' });
    res.json({ message: 'Payment record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/insurance-payments/:id', adminOnly, async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await InsurancePayment.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Payment record not found' });
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.get('/api/insurance-payments', async (req, res) => {
  try {
    const records = await InsurancePayment.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      const d = decryptData(r.data);
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
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
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/lc-management/:id', async (req, res) => {
  try {
    const deletedRecord = await LCManagement.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'LC record not found' });
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
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
    }
});

// MetaData APIs (Generic Reference Values)
apiRouter.post('/api/metadata', async (req, res) => {
  try {
    const { category, ...rest } = req.body;
    if (!category) return res.status(400).json({ message: 'Category is required' });
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

apiRouter.delete('/api/metadata/:id', async (req, res) => {
  try {
    const deletedRecord = await MetaData.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.put('/api/lc-gp/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedRecord = await LCGatePass.findByIdAndUpdate(req.params.id, { data: encryptedData }, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'Gate Pass record not found' });
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/lc-gp/:id', async (req, res) => {
  try {
    const deletedRecord = await LCGatePass.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Gate Pass record not found' });
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
            lcExpenseId: savedRecord._id.toString()
          };
          const encPayData = encryptData(paymentBody);
          const newPayRecord = new CnFPayment({ data: encPayData });
          await newPayRecord.save();
        }
      } catch (syncErr) {
        console.error('Error syncing C&F Payment on LCExpense POST:', syncErr);
      }
    }

    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
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
            lcExpenseId: req.params.id
          };
          const encPayData = encryptData(paymentBody);
          await CnFPayment.findByIdAndUpdate(existingPay._id, { data: encPayData });
        } else {
          await CnFPayment.findByIdAndDelete(existingPay._id);
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
        }
      }
    } catch (syncErr) {
      console.error('Error syncing C&F Payment on LCExpense PUT:', syncErr);
    }

    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/lc-expenses/:id', async (req, res) => {
  try {
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
      }
    } catch (syncErr) {
      console.error('Error deleting C&F Payment on LCExpense DELETE:', syncErr);
    }

    res.json({ message: 'LC Expense record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PI APIs
apiRouter.post('/api/pi', async (req, res) => {
  try {
    const { piNumber } = req.body;
    const encryptedData = encryptData(req.body);
    const newRecord = new PI({ 
      piNumber: piNumber ? piNumber.trim() : undefined,
      data: encryptedData 
    });
    const savedRecord = await newRecord.save();
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
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
    res.json({ message: 'PI record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/pi/:id', async (req, res) => {
  try {
    const { piNumber } = req.body;
    const encryptedData = encryptData(req.body);
    const updateData = { data: encryptedData };
    if (piNumber) updateData.piNumber = piNumber.trim();

    const updatedRecord = await PI.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    if (!updatedRecord) return res.status(404).json({ message: 'PI record not found' });
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
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
      return { ...d, _id: r._id, createdAt: r.createdAt };
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
    res.status(201).json({ ...req.body, _id: savedRecord._id, createdAt: savedRecord.createdAt });
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
    res.json({ ...req.body, _id: updatedRecord._id, createdAt: updatedRecord.createdAt });
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
apiRouter.post('/api/employees', async (req, res) => {
  try {
    const employeeData = req.body; // Already decrypted by securityMiddleware
    const { role } = employeeData;
    const empRole = role ? role.toLowerCase() : 'staff';

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
    const hashedPassword = CryptoJS.SHA256(plainPassword).toString(CryptoJS.enc.Hex);

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

apiRouter.delete('/api/employees/:id', async (req, res) => {
  try {
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

apiRouter.put('/api/employees/:id', async (req, res) => {
  try {
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

    const user = await User.findOne({ username: oldId });
    if (user) {
      user.username = newId;
      if (role) user.role = role.toLowerCase();
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
    const hashedPassword = CryptoJS.SHA256(newPassword).toString(CryptoJS.enc.Hex);

    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, newPassword });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

apiRouter.get('/api/employees', async (req, res) => {
  try {
    const records = await Employee.find().sort({ createdAt: -1 });
    const decrypted = records.map(r => {
      let d = decryptData(r.data);
      // Fallback for double-encrypted
      if (d && d.data && typeof d.data === 'string' && !d.employeeId) {
        try { d = decryptData(d.data); } catch (e) { }
      }
      return { ...d, _id: r._id, createdAt: r.createdAt };
    });
    res.json(decrypted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Authentication APIs
apiRouter.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Verify password
    const hashedPassword = CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // For a production app, we would generate a JWT token here
    // Find employee name if exists
    let displayName = username === 'admin' ? 'Administrator' : username;
    if (username !== 'admin') {
      const employees = await Employee.find();
      for (const emp of employees) {
        try {
          let decrypted = decryptData(emp.data);
          // Auto-fallback for testing records that were double-encrypted by the bug
          if (decrypted && decrypted.data && typeof decrypted.data === 'string' && !decrypted.employeeId) {
            try { decrypted = decryptData(decrypted.data); } catch (e) { }
          }
          if (decrypted.employeeId === username) {
            displayName = decrypted.name;
            break;
          }
        } catch (e) {
          console.error('Error decrypting employee data during login:', e);
        }
      }
    }

    const userData = {
      id: user._id,
      username: user.username,
      role: user.role,
      name: displayName
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
apiRouter.get('/api/auth/check', (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user
    });
  } else {
    res.status(401).json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }
});

// Logout API
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

    const hashedCurrent = CryptoJS.SHA256(currentPassword).toString(CryptoJS.enc.Hex);
    if (user.password !== hashedCurrent) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedNew = CryptoJS.SHA256(newPassword).toString(CryptoJS.enc.Hex);
    user.password = hashedNew;
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

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
