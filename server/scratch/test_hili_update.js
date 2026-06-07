const mongoose = require('mongoose');
const Port = require('../src/models/Port');
const Sale = require('../src/models/Sale');
const { decryptData, encryptData } = require('../src/utils/encryption');

// Copy helper function directly for isolated script testing
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const updateModelPorts = async (Model, oldPortName, newPortName, oldPortCode, newPortCode) => {
  const documents = await Model.find({});
  let totalUpdated = 0;
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
      totalUpdated++;
    }
  }
  return totalUpdated;
};

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const oldName = 'HILI';
    const newName = 'HILI TEST';

    console.log(`Starting direct DB propagation test: "${oldName}" -> "${newName}"...`);
    const count = await updateModelPorts(Sale, oldName, newName, '', '');
    console.log(`Successfully updated ${count} Sale documents in the DB.`);

    console.log(`Reverting back: "${newName}" -> "${oldName}"...`);
    const revertCount = await updateModelPorts(Sale, newName, oldName, '', '');
    console.log(`Successfully reverted ${revertCount} Sale documents in the DB.`);

    process.exit(0);
});
