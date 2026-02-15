const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/erp_db')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err));

const IpRecord = require('./models/IpRecord');
const Importer = require('./models/Importer');
const Port = require('./models/Port');
const Stock = require('./models/Stock');
const Product = require('./models/Product');
const Customer = require('./models/Customer');


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


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
