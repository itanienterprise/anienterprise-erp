const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'ani_enterprise_erp_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://mongo:27017/erp_db',
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
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




// Routes
app.get('/', (req, res) => {
  res.send('API is running...');
});

// IP Records APIs
app.post('/api/ip-records', async (req, res) => {
  try {
    const newRecord = new IpRecord(req.body);
    const savedRecord = await newRecord.save();
    res.status(201).json(savedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete IP Record
app.delete('/api/ip-records/:id', async (req, res) => {
  try {
    const deletedRecord = await IpRecord.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ message: 'Record not found' });
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update IP Record (for Edit functionality)
app.put('/api/ip-records/:id', async (req, res) => {
  try {
    const updatedRecord = await IpRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRecord) return res.status(404).json({ message: 'Record not found' });
    res.json(updatedRecord);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/ip-records', async (req, res) => {
  try {
    const records = await IpRecord.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Importer APIs
app.post('/api/importers', async (req, res) => {
  try {
    const newImporter = new Importer(req.body);
    const savedImporter = await newImporter.save();
    res.status(201).json(savedImporter);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete Importer
app.delete('/api/importers/:id', async (req, res) => {
  try {
    const deletedImporter = await Importer.findByIdAndDelete(req.params.id);
    if (!deletedImporter) return res.status(404).json({ message: 'Importer not found' });
    res.json({ message: 'Importer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Importer
app.put('/api/importers/:id', async (req, res) => {
  try {
    const updatedImporter = await Importer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedImporter) return res.status(404).json({ message: 'Importer not found' });
    res.json(updatedImporter);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/importers', async (req, res) => {
  try {
    const importers = await Importer.find().sort({ createdAt: -1 });
    res.json(importers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Port APIs
app.post('/api/ports', async (req, res) => {
  try {
    const newPort = new Port(req.body);
    const savedPort = await newPort.save();
    res.status(201).json(savedPort);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/ports/:id', async (req, res) => {
  try {
    const deletedPort = await Port.findByIdAndDelete(req.params.id);
    if (!deletedPort) return res.status(404).json({ message: 'Port not found' });
    res.json({ message: 'Port deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/ports/:id', async (req, res) => {
  try {
    const updatedPort = await Port.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedPort) return res.status(404).json({ message: 'Port not found' });
    res.json(updatedPort);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/ports', async (req, res) => {
  try {
    const ports = await Port.find().sort({ createdAt: -1 });
    res.json(ports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Stock APIs
app.post('/api/stock', async (req, res) => {
  try {
    const newStock = new Stock(req.body);
    const savedStock = await newStock.save();
    res.status(201).json(savedStock);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/stock/:id', async (req, res) => {
  try {
    const deletedStock = await Stock.findByIdAndDelete(req.params.id);
    if (!deletedStock) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const updatedStock = await Stock.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedStock) return res.status(404).json({ message: 'Item not found' });
    res.json(updatedStock);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/stock', async (req, res) => {
  try {
    const stock = await Stock.find().sort({ createdAt: -1 });
    res.json(stock);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Product APIs
app.post('/api/products', async (req, res) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Customer APIs
app.post('/api/customers', async (req, res) => {
  try {
    const newCustomer = new Customer(req.body);
    const savedCustomer = await newCustomer.save();
    res.status(201).json(savedCustomer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
    if (!deletedCustomer) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedCustomer) return res.status(404).json({ message: 'Customer not found' });
    res.json(updatedCustomer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Warehouse APIs
app.post('/api/warehouses', async (req, res) => {
  try {
    const newWarehouse = new Warehouse(req.body);
    const savedWarehouse = await newWarehouse.save();
    res.status(201).json(savedWarehouse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/warehouses/:id', async (req, res) => {
  try {
    const deletedWarehouse = await Warehouse.findByIdAndDelete(req.params.id);
    if (!deletedWarehouse) return res.status(404).json({ message: 'Warehouse not found' });
    res.json({ message: 'Warehouse deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/warehouses/:id', async (req, res) => {
  try {
    const updatedWarehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedWarehouse) return res.status(404).json({ message: 'Warehouse not found' });
    res.json(updatedWarehouse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/warehouses', async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });
    res.json(warehouses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Sale APIs
app.post('/api/sales', async (req, res) => {
  try {
    const newSale = new Sale(req.body);
    const savedSale = await newSale.save();
    res.status(201).json(savedSale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/sales/:id', async (req, res) => {
  try {
    const deletedSale = await Sale.findByIdAndDelete(req.params.id);
    if (!deletedSale) return res.status(404).json({ message: 'Sale not found' });
    res.json({ message: 'Sale deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/sales/:id', async (req, res) => {
  try {
    const updatedSale = await Sale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedSale) return res.status(404).json({ message: 'Sale not found' });
    res.json(updatedSale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/sales', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bank APIs
app.post('/api/banks', async (req, res) => {
  try {
    const newBank = new Bank(req.body);
    const savedBank = await newBank.save();
    res.status(201).json(savedBank);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/banks/:id', async (req, res) => {
  try {
    const deletedBank = await Bank.findByIdAndDelete(req.params.id);
    if (!deletedBank) return res.status(404).json({ message: 'Bank not found' });
    res.json({ message: 'Bank deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/banks/:id', async (req, res) => {
  try {
    const updatedBank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedBank) return res.status(404).json({ message: 'Bank not found' });
    res.json(updatedBank);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/banks', async (req, res) => {
  try {
    const banks = await Bank.find().sort({ createdAt: -1 });
    res.json(banks);
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
app.post('/api/employees', async (req, res) => {
  try {
    const { data } = req.body;
    const decryptedData = decryptData(data);
    const { role } = decryptedData;
    const empRole = role ? role.toLowerCase() : 'staff';

    // Auto-generate ID logic
    const prefix = empRole === 'admin' ? 'A-' : 'E-';
    const allEmployees = await Employee.find();

    let maxIdNum = 1000;
    for (const emp of allEmployees) {
      try {
        const dec = decryptData(emp.data);
        if (dec.employeeId && dec.employeeId.startsWith(prefix)) {
          const numPart = parseInt(dec.employeeId.substring(2));
          if (!isNaN(numPart) && numPart > maxIdNum) {
            maxIdNum = numPart;
          }
        }
      } catch (e) {
        // Suppress individual decryption errors to avoid breaking the entire loop
      }
    }

    const newEmployeeId = `${prefix}${maxIdNum + 1}`;
    decryptedData.employeeId = newEmployeeId;

    // Check if user already exists (just in case)
    const existingUser = await User.findOne({ username: newEmployeeId });
    if (existingUser) {
      return res.status(400).json({ message: 'Auto-generated Employee ID already exists as a username' });
    }

    // Generate password
    const plainPassword = generatePassword();
    const hashedPassword = CryptoJS.SHA256(plainPassword).toString(CryptoJS.enc.Hex);

    // Create User record
    const newUser = new User({
      username: newEmployeeId,
      password: hashedPassword,
      role: empRole
    });
    await newUser.save();

    // Add password to employee data (encrypted)
    decryptedData.password = plainPassword;
    const updatedEncryptedData = encryptData(decryptedData);

    const newEmployee = new Employee({ data: updatedEncryptedData });
    const savedEmployee = await newEmployee.save();

    // Return the saved employee along with the plain password for display once
    res.status(201).json({
      ...savedEmployee._doc,
      plainPassword // Only sent once during creation
    });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const decryptedData = decryptData(employee.data);
    const { employeeId } = decryptedData;

    // Delete associated User record
    await User.findOneAndDelete({ username: employeeId });

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee and associated user account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const oldEmployee = await Employee.findById(req.params.id);
    if (!oldEmployee) return res.status(404).json({ message: 'Employee not found' });

    const oldDecrypted = decryptData(oldEmployee.data);
    const { employeeId: oldId } = oldDecrypted;

    const { data } = req.body;
    const newDecrypted = decryptData(data);
    const { employeeId: newId, role } = newDecrypted;

    // Update associated User record if employeeId or role changed
    const user = await User.findOne({ username: oldId });
    if (user) {
      user.username = newId;
      if (role) user.role = role.toLowerCase();
      await user.save();
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Authentication APIs
app.post('/api/auth/login', async (req, res) => {
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
          const decrypted = decryptData(emp.data);
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
app.get('/api/auth/check', (req, res) => {
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
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('connect.sid'); // Default session cookie name
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

app.post('/api/auth/change-password', async (req, res) => {
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
app.post('/api/notifications', async (req, res) => {
  try {
    const newNotification = new Notification(req.body);
    const savedNotification = await newNotification.save();
    res.status(201).json(savedNotification);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/notifications/clear', async (req, res) => {
  try {
    await Notification.deleteMany({});
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/notifications/:id', async (req, res) => {
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
