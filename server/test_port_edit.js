const mongoose = require('mongoose');
const Port = require('./src/models/Port');
const PI = require('./src/models/PI');
const LCManagement = require('./src/models/LCManagement');
const Sale = require('./src/models/Sale');
const { encryptData, decryptData } = require('./src/utils/encryption');

// Helper to escape regex
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Copy helper function directly for isolated script testing
const updateModelPorts = async (Model, oldPortName, newPortName, oldPortCode, newPortCode) => {
  const documents = await Model.find({});
  for (const doc of documents) {
    let rawDecrypted = decryptData(doc.data);
    if (!rawDecrypted) continue;
    
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

const runTest = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect('mongodb://127.0.0.1:27017/erp_db');
    console.log('Connected successfully!');

    const oldPortName = 'Testport Name Original';
    const oldPortCode = 'TPORG';
    const newPortName = 'Testport Name Updated';
    const newPortCode = 'TPUPD';

    console.log('\nCreating seed documents...');
    // Seed Port
    const testPort = new Port({
      data: encryptData({ name: oldPortName, code: oldPortCode, type: 'Seaport', status: 'Active' })
    });
    await testPort.save();
    console.log(`Port created with ID: ${testPort._id}`);

    // Seed PI
    const testPI = new PI({
      piNumber: 'PI-TEST-' + Date.now(),
      data: encryptData({
        piNumber: 'PI-TEST',
        portOfLoading: oldPortName,
        portOfDischarge: 'Somewhere Else',
        termsDeliveryPayment: `CPT ${oldPortName} [${oldPortCode}], BANGLADESH...`
      })
    });
    await testPI.save();
    console.log(`PI created with ID: ${testPI._id}`);

    // Seed Sale
    const testSale = new Sale({
      invoiceNo: 'GS-TEST-' + Date.now(),
      saleType: 'General',
      data: encryptData({
        invoiceNo: 'GS-TEST',
        port: oldPortName,
        remarks: `Shipped via ${oldPortName} code ${oldPortCode}`
      })
    });
    await testSale.save();
    console.log(`Sale created with ID: ${testSale._id}`);

    // Seed LCManagement
    const testLC = new LCManagement({
      data: encryptData({
        lcNo: 'LC-TEST',
        port: oldPortName,
        milestones: [
          { name: 'Discharge', port: oldPortName }
        ]
      })
    });
    await testLC.save();
    console.log(`LCManagement created with ID: ${testLC._id}`);

    console.log('\nRunning propagation helper...');
    await updateModelPorts(PI, oldPortName, newPortName, oldPortCode, newPortCode);
    await updateModelPorts(Sale, oldPortName, newPortName, oldPortCode, newPortCode);
    await updateModelPorts(LCManagement, oldPortName, newPortName, oldPortCode, newPortCode);

    console.log('\nVerifying updates...');
    
    // Retrieve and verify PI
    const updatedPIDoc = await PI.findById(testPI._id);
    const updatedPIData = decryptData(updatedPIDoc.data);
    console.log('PI PortOfLoading (expected: Testport Name Updated):', updatedPIData.portOfLoading);
    console.log('PI termsDeliveryPayment (expected: TPT Testport Name Updated [TPUPD]...):', updatedPIData.termsDeliveryPayment);

    // Retrieve and verify Sale
    const updatedSaleDoc = await Sale.findById(testSale._id);
    const updatedSaleData = decryptData(updatedSaleDoc.data);
    console.log('Sale Port (expected: Testport Name Updated):', updatedSaleData.port);
    console.log('Sale Remarks (expected: Shipped via Testport Name Updated code TPUPD):', updatedSaleData.remarks);

    // Retrieve and verify LC
    const updatedLCDoc = await LCManagement.findById(testLC._id);
    const updatedLCData = decryptData(updatedLCDoc.data);
    console.log('LC Port (expected: Testport Name Updated):', updatedLCData.port);
    console.log('LC Milestone Port (expected: Testport Name Updated):', updatedLCData.milestones[0].port);

    const piSuccess = updatedPIData.portOfLoading === newPortName && updatedPIData.termsDeliveryPayment.includes(newPortCode);
    const saleSuccess = updatedSaleData.port === newPortName && updatedSaleData.remarks.includes(newPortCode);
    const lcSuccess = updatedLCData.port === newPortName && updatedLCData.milestones[0].port === newPortName;

    if (piSuccess && saleSuccess && lcSuccess) {
      console.log('\n>>> SUCCESS: All port name and code references were propagated correctly! <<<');
    } else {
      console.log('\n>>> FAILURE: Some references were not updated correctly! <<<');
    }

    console.log('\nCleaning up seed documents...');
    await Port.findByIdAndDelete(testPort._id);
    await PI.findByIdAndDelete(testPI._id);
    await Sale.findByIdAndDelete(testSale._id);
    await LCManagement.findByIdAndDelete(testLC._id);
    console.log('Cleanup complete.');

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
};

runTest();
