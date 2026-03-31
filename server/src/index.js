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
app.use(express.json());
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
const Sale = require('./models/Sale');
const User = require('./models/User');
const Employee = require('./models/Employee');
const Notification = require('./models/Notification');
const Bank = require('./models/Bank');
const Exporter = require('./models/Exporter');
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
    const updatedRecord = await IpRecord.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
apiRouter.delete('/api/importers/:id', async (req, res) => {
  try {
    const deletedImporter = await Importer.findByIdAndDelete(req.params.id);
    if (!deletedImporter) return res.status(404).json({ message: 'Importer not found' });
    res.json({ message: 'Importer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Importer
apiRouter.put('/api/importers/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedImporter = await Importer.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
apiRouter.delete('/api/exporters/:id', async (req, res) => {
  try {
    const deletedExporter = await Exporter.findByIdAndDelete(req.params.id);
    if (!deletedExporter) return res.status(404).json({ message: 'Exporter not found' });
    res.json({ message: 'Exporter deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Exporter
apiRouter.put('/api/exporters/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedExporter = await Exporter.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
    const updatedPort = await Port.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
    const deletedStock = await Stock.findByIdAndDelete(req.params.id);
    if (!deletedStock) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/stock/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedStock = await Stock.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
    if (!updatedStock) return res.status(404).json({ message: 'Item not found' });
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
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
    const updatedRecord = await Customer.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
    if (!updatedRecord) return res.status(404).json({ message: 'Customer not found' });

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
    const updatedWarehouse = await Warehouse.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
    const encryptedData = encryptData(req.body);
    const newSale = new Sale({ data: encryptedData });
    const savedSale = await newSale.save();
    res.status(201).json({ ...req.body, _id: savedSale._id, createdAt: savedSale.createdAt });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

apiRouter.delete('/api/sales/:id', async (req, res) => {
  try {
    const deletedSale = await Sale.findByIdAndDelete(req.params.id);
    if (!deletedSale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

apiRouter.put('/api/sales/:id', async (req, res) => {
  try {
    const encryptedData = encryptData(req.body);
    const updatedSale = await Sale.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
    if (!updatedSale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ ...req.body, _id: updatedSale._id, createdAt: updatedSale.createdAt });
  } catch (err) {
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
    const updatedBank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedBank) return res.status(404).json({ message: 'Bank not found' });
    res.json(updatedBank);
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
    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, { data: encryptedData }, { new: true });
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
    const { username, password } = req.body;

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
    const updated = await Notification.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
