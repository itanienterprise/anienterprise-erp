const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const { encryptData, decryptData } = require('../utils/encryption');

/**
 * One-time standalone migration script to fix legacy corrupted records
 * (ORD0200/GS0522 Rising Star and ORD0189/GS0516 Chondon Bogura)
 *
 * Usage:
 *   NODE_PATH=./server/node_modules node server/src/scripts/repair_historical_orders_and_brands.js [MONGODB_URI]
 */
async function runOneTimeRepair() {
  const mongoUri = process.env.MONGODB_URI || process.argv[2] || 'mongodb://127.0.0.1:27017/erp_db';
  console.log(`[Migration] Connecting to ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  try {
    const allCustomers = await Customer.find({});
    let boguraDoc = null;
    let gobindDoc = null;
    let arjunDoc = null;

    for (const c of allCustomers) {
      const cd = decryptData(c.data);
      if (!cd) continue;
      const cComp = (cd.companyName || '').trim().toUpperCase();
      const cCust = (cd.customerName || '').trim().toUpperCase();
      const cId = c._id.toString();

      if (cId === '69d753c5ea95142dc0a88473' || (cComp.includes('CHONDON') && cComp.includes('BOGURA'))) {
        boguraDoc = c;
      } else if (cId === '6a563c673950cc376c180d9e' || (cComp.includes('CHONDON') && cComp.includes('GOBINDOGONJ'))) {
        gobindDoc = c;
      } else if (cId === '69f2eb5b54dfdf4e07d71d22' || cComp.includes('ARJUN') || cCust.includes('ARJUN')) {
        arjunDoc = c;
      }
    }

    const boguraId = boguraDoc ? boguraDoc._id.toString() : '69d753c5ea95142dc0a88473';
    const gobindId = gobindDoc ? gobindDoc._id.toString() : '6a563c673950cc376c180d9e';
    const arjunId = arjunDoc ? arjunDoc._id.toString() : '69f2eb5b54dfdf4e07d71d22';

    const salesDocs = await Sale.find({});
    for (const doc of salesDocs) {
      let d = decryptData(doc.data);
      if (!d) continue;
      const inv = (d.invoiceNo || '').trim().toUpperCase();
      const ord = (d.orderNo || '').trim().toUpperCase();

      if (inv === 'ORD0200' || ord === 'ORD0200' || inv === 'GS0522') {
        let modified = false;
        (d.items || []).forEach(item => {
          if ((item.productName || item.product || '').toUpperCase() === 'BRAN') {
            if ((item.brand || item.brandName || '').toUpperCase() === 'SHIB NONDI') {
              item.brand = 'RISING STAR';
              if (item.brandName) item.brandName = 'RISING STAR';
              modified = true;
            }
            (item.brandEntries || []).forEach(be => {
              if ((be.brand || be.brandName || '').toUpperCase() === 'SHIB NONDI') {
                be.brand = 'RISING STAR';
                be.brandName = 'RISING STAR';
                modified = true;
              }
              if (inv === 'GS0522' && (!be.lcNo || be.lcNo !== '087326010767')) {
                be.lcNo = '087326010767';
                modified = true;
              }
            });
          }
        });
        if (inv === 'GS0522') {
          if (!d.lcNo || d.lcNo !== '087326010767') { d.lcNo = '087326010767'; modified = true; }
          if (!d.importer) { d.importer = 'M/S. RAIHAN TRADERS'; modified = true; }
          if (!d.port) { d.port = 'HILI'; modified = true; }
          if (!d.exporter) { d.exporter = 'ALIF AGRO STAR PRIVATE LIMITED'; modified = true; }
        }
        if (arjunDoc && d.customerId !== arjunId) {
          d.customerId = arjunId;
          modified = true;
        }
        if (modified) {
          doc.data = encryptData(d);
          await doc.save();
          console.log(`[Migration] Restored ${inv || ord} to RISING STAR.`);
        }
      }

      if (inv === 'ORD0189' || ord === 'ORD0189' || inv === 'GS0516') {
        const curComp = (d.companyName || '').trim().toUpperCase();
        if (curComp.includes('GOBINDOGONJ') || d.customerId === gobindId || d.customerId !== boguraId) {
          d.companyName = 'CHONDON DAL MIL (BOGURA)';
          d.customerId = boguraId;
          d.customerName = 'CHONDON';
          d.address = 'BOGURA';
          d.customerAddress = 'BOGURA';
          d.location = 'BOGURA';
          if (d.customer && typeof d.customer === 'object') {
            d.customer._id = boguraId;
            d.customer.customerId = boguraId;
            d.customer.companyName = 'CHONDON DAL MIL (BOGURA)';
            d.customer.customerName = 'CHONDON';
            d.customer.address = 'BOGURA';
            d.customer.location = 'BOGURA';
          }
          doc.data = encryptData(d);
          await doc.save();
          console.log(`[Migration] Restored ${inv || ord} to CHONDON DAL MIL (BOGURA).`);
        }
      }
    }

    for (const c of allCustomers) {
      let cd = decryptData(c.data);
      if (!cd || !Array.isArray(cd.salesHistory)) continue;
      let dirty = false;
      const cId = c._id.toString();
      const isBogura = (cId === boguraId);

      if (!isBogura) {
        const had516 = cd.salesHistory.some(h => {
          const inv = (h.invoiceNo || '').trim().toUpperCase();
          const ord = (h.orderNo || '').trim().toUpperCase();
          return inv === 'GS0516' || ord === 'ORD0189';
        });
        if (had516) {
          cd.salesHistory = cd.salesHistory.filter(h => {
            const inv = (h.invoiceNo || '').trim().toUpperCase();
            const ord = (h.orderNo || '').trim().toUpperCase();
            return inv !== 'GS0516' && ord !== 'ORD0189';
          });
          dirty = true;
        }
      }

      cd.salesHistory.forEach(h => {
        const inv = (h.invoiceNo || '').trim().toUpperCase();
        const ord = (h.orderNo || '').trim().toUpperCase();
        if (inv === 'GS0522' || ord === 'ORD0200') {
          if (h.brand !== 'RISING STAR' || h.lcNo !== '087326010767') {
            h.brand = 'RISING STAR';
            h.lcNo = '087326010767';
            dirty = true;
          }
        }
      });

      if (dirty) {
        c.data = encryptData(cd);
        await c.save();
        console.log(`[Migration] Repaired salesHistory for customer ${cId} (${cd.companyName || ''}).`);
      }
    }

    console.log('[Migration] Historical records check and repair completed successfully.');
  } catch (err) {
    console.error('[Migration] Error during migration:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

if (require.main === module) {
  runOneTimeRepair();
}

module.exports = runOneTimeRepair;
