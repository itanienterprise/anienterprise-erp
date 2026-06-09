const mongoose = require('mongoose');
const Port = require('./src/models/Port');
const Stock = require('./src/models/Stock');
const Sale = require('./src/models/Sale');
const { decryptData, encryptData } = require('./src/utils/encryption');

const DB_URI = 'mongodb://localhost:27017/erp_db';

mongoose.connect(DB_URI).then(async () => {
  console.log("Connected to MongoDB for testing port propagation...");

  const oldPortName = "TEST PORT NAME";
  const newPortName = "TEST PORT NAME UPDATED";
  const oldPortCode = "TPN";
  const newPortCode = "TPNU";

  // 1. Create/find port record
  let testPort = await Port.findOne({});
  let portOriginalData = null;
  if (testPort) {
    portOriginalData = JSON.parse(JSON.stringify(decryptData(testPort.data)));
    let d = decryptData(testPort.data);
    d.name = oldPortName;
    d.code = oldPortCode;
    testPort.data = encryptData(d);
    await testPort.save();
    console.log("Setup Port document with test values.");
  } else {
    const d = { name: oldPortName, code: oldPortCode };
    testPort = new Port({ data: encryptData(d) });
    await testPort.save();
    console.log("Created test Port document.");
  }

  // 2. Setup Stock record with port name
  let testStock = await Stock.findOne({});
  let stockOriginalData = null;
  if (testStock) {
    stockOriginalData = JSON.parse(JSON.stringify(decryptData(testStock.data)));
    let d = decryptData(testStock.data);
    d.port = oldPortName;
    testStock.data = encryptData(d);
    await testStock.save();
    console.log("Setup Stock record with test port.");
  }

  // 3. Setup Sale record with port name
  let testSale = await Sale.findOne({});
  let saleOriginalData = null;
  if (testSale) {
    saleOriginalData = JSON.parse(JSON.stringify(decryptData(testSale.data)));
    let d = decryptData(testSale.data);
    d.port = oldPortName;
    testSale.data = encryptData(d);
    await testSale.save();
    console.log("Setup Sale record with test port.");
  }

  // Helper from index.js
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const updateModelPorts = async (Model, oldPortName, newPortName, oldPortCode, newPortCode) => {
    const documents = await Model.find({});
    for (const doc of documents) {
      let rawDecrypted = decryptData(doc.data);
      if (!rawDecrypted) continue;
      
      // Auto-fallback check if there is double encryption
      let isDoubleEncrypted = false;
      if (rawDecrypted && rawDecrypted.data && typeof rawDecrypted.data === 'string') {
        try {
          const secondary = decryptData(rawDecrypted.data);
          if (secondary) {
            rawDecrypted = secondary;
            isDoubleEncrypted = true;
          }
        } catch (e) {}
      }

      let modified = false;
      
      const updateHelper = (obj) => {
        if (obj === null || obj === undefined) return obj;
        
        if (typeof obj === 'string') {
          let updatedStr = obj;
          if (oldPortName && newPortName && oldPortName.trim().length >= 3) {
            const regexName = new RegExp(escapeRegExp(oldPortName.trim()), 'gi');
            if (regexName.test(updatedStr)) {
              updatedStr = updatedStr.replace(regexName, newPortName.trim());
              modified = true;
            }
          }
          if (oldPortCode && newPortCode && oldPortCode.trim().length >= 2) {
            const regexCode = new RegExp(escapeRegExp(oldPortCode.trim()), 'gi');
            if (regexCode.test(updatedStr)) {
              updatedStr = updatedStr.replace(regexCode, newPortCode.trim());
              modified = true;
            }
          }
          return updatedStr;
        }
        
        if (Array.isArray(obj)) {
          let arrayModified = false;
          const mapped = obj.map(item => {
            const originalStr = JSON.stringify(item);
            const updatedItem = updateHelper(item);
            if (JSON.stringify(updatedItem) !== originalStr) {
              arrayModified = true;
            }
            return updatedItem;
          });
          if (arrayModified) modified = true;
          return mapped;
        }
        
        if (typeof obj === 'object') {
          const updatedObj = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              const originalValStr = JSON.stringify(obj[key]);
              updatedObj[key] = updateHelper(obj[key]);
              if (JSON.stringify(updatedObj[key]) !== originalValStr) {
                modified = true;
              }
            }
          }
          return updatedObj;
        }
        
        return obj;
      };

      const updatedData = updateHelper(rawDecrypted);
      
      if (modified) {
        let encrypted;
        if (isDoubleEncrypted) {
          encrypted = encryptData(encryptData(updatedData));
        } else {
          encrypted = encryptData(updatedData);
        }
        doc.data = encrypted;
        await doc.save();
      }
    }
  };

  console.log("Running port name propagation...");
  await updateModelPorts(Stock, oldPortName, newPortName, oldPortCode, newPortCode);
  await updateModelPorts(Sale, oldPortName, newPortName, oldPortCode, newPortCode);

  // Verify updates
  if (testStock) {
    const updatedStockDoc = await Stock.findById(testStock._id);
    const updatedStockData = decryptData(updatedStockDoc.data);
    console.log("Updated Stock Port:", updatedStockData.port);
  }
  if (testSale) {
    const updatedSaleDoc = await Sale.findById(testSale._id);
    const updatedSaleData = decryptData(updatedSaleDoc.data);
    console.log("Updated Sale Port:", updatedSaleData.port);
  }

  // Restore originals
  if (portOriginalData) {
    testPort.data = encryptData(portOriginalData);
    await testPort.save();
  }
  if (stockOriginalData && testStock) {
    testStock.data = encryptData(stockOriginalData);
    await testStock.save();
  }
  if (saleOriginalData && testSale) {
    testSale.data = encryptData(saleOriginalData);
    await testSale.save();
  }

  process.exit(0);
});
