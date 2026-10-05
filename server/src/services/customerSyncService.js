const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const { encryptData, decryptData } = require('../utils/encryption');

function decryptDocData(data) {
  let d = decryptData(data);
  if (d && d.data && typeof d.data === 'string' && !d.invoiceNo && !d.companyName) {
    try { d = decryptData(d.data); } catch (e) {}
  }
  return d || {};
}

function buildSaleHistoryEntries(saleData, customerData = {}) {
  const entries = [];
  const sType = (saleData.saleType || '').toLowerCase();
  const invUpper = (saleData.invoiceNo || '').trim().toUpperCase();
  const isOrder = sType === 'order' || invUpper.startsWith('ORD') || saleData.isOrderEntry === true;
  if (isOrder) return entries; // Order bookings do not generate customer sales history entries

  const baseCustName = customerData.customerName || saleData.customerName || '';
  const baseCompName = customerData.companyName || saleData.companyName || '';
  const basePhone = customerData.phone || saleData.contact || saleData.customerPhone || '';
  const baseAddress = customerData.address || customerData.location || saleData.address || '';
  const baseCustType = customerData.customerType || saleData.customerType || 'General Customer';

  const items = saleData.items && Array.isArray(saleData.items) ? saleData.items : [];
  if (items.length > 0) {
    items.forEach((product, pIdx) => {
      const brandEntries = product.brandEntries && Array.isArray(product.brandEntries) ? product.brandEntries : [];
      if (brandEntries.length > 0) {
        brandEntries.forEach((entry, eIdx) => {
          const isFirstEntry = pIdx === 0 && eIdx === 0;
          const qty = parseFloat(entry.quantity) || 0;
          const rate = parseFloat(entry.unitPrice !== undefined && entry.unitPrice !== null && entry.unitPrice !== '' ? entry.unitPrice : (entry.rate || 0)) || 0;
          const amt = parseFloat(entry.totalAmount || entry.amount) || (qty * rate);
          const paid = isFirstEntry ? (parseFloat(saleData.paidAmount || saleData.paid) || 0) : 0;
          const discount = isFirstEntry ? (parseFloat(saleData.discount) || 0) : 0;
          const due = isFirstEntry ? (parseFloat(saleData.dueAmount || saleData.due) || Math.max(0, amt - paid - discount)) : amt;

          entries.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: saleData.date,
            invoiceNo: saleData.invoiceNo,
            orderNo: saleData.orderNo || '',
            lcNo: entry.lcNo || product.lcNo || saleData.lcNo || '',
            product: product.productName || product.product || '',
            brand: entry.brand || entry.brandName || '',
            quantity: qty,
            rate: rate,
            unitPrice: rate,
            truck: entry.truck || saleData.truck || '',
            amount: amt,
            totalAmount: amt,
            paid: paid,
            due: due,
            discount: discount,
            warehouse: entry.warehouseName || '',
            requestedBy: saleData.requestedBy || '',
            requestedByUsername: saleData.requestedByUsername || '',
            acceptedBy: saleData.acceptedBy || '',
            status: saleData.status || 'Pending',
            companyName: baseCompName,
            customerName: baseCustName,
            phone: basePhone,
            customerPhone: basePhone,
            address: baseAddress,
            location: baseAddress,
            customerType: baseCustType
          });
        });
      } else {
        const isFirstEntry = pIdx === 0;
        const qty = parseFloat(product.quantity || saleData.quantity) || 0;
        const rate = parseFloat(product.unitPrice || product.rate || saleData.unitPrice || 0) || 0;
        const amt = parseFloat(product.totalAmount || product.amount) || (qty * rate);
        const paid = isFirstEntry ? (parseFloat(saleData.paidAmount || saleData.paid) || 0) : 0;
        const discount = isFirstEntry ? (parseFloat(saleData.discount) || 0) : 0;
        const due = isFirstEntry ? (parseFloat(saleData.dueAmount || saleData.due) || Math.max(0, amt - paid - discount)) : amt;

        entries.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: saleData.date,
          invoiceNo: saleData.invoiceNo,
          orderNo: saleData.orderNo || '',
          lcNo: product.lcNo || saleData.lcNo || '',
          product: product.productName || product.product || '',
          brand: product.brand || '',
          quantity: qty,
          rate: rate,
          unitPrice: rate,
          truck: product.truck || saleData.truck || '',
          amount: amt,
          totalAmount: amt,
          paid: paid,
          due: due,
          discount: discount,
          warehouse: product.warehouseName || '',
          requestedBy: saleData.requestedBy || '',
          requestedByUsername: saleData.requestedByUsername || '',
          acceptedBy: saleData.acceptedBy || '',
          status: saleData.status || 'Pending',
          companyName: baseCompName,
          customerName: baseCustName,
          phone: basePhone,
          customerPhone: basePhone,
          address: baseAddress,
          location: baseAddress,
          customerType: baseCustType
        });
      }
    });
  } else {
    const qty = parseFloat(saleData.quantity) || 0;
    const rate = parseFloat(saleData.unitPrice || saleData.rate) || 0;
    const amt = parseFloat(saleData.totalAmount || saleData.amount) || (qty * rate);
    const paid = parseFloat(saleData.paidAmount || saleData.paid) || 0;
    const discount = parseFloat(saleData.discount) || 0;
    const due = parseFloat(saleData.dueAmount || saleData.due) || Math.max(0, amt - paid - discount);

    entries.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: saleData.date,
      invoiceNo: saleData.invoiceNo,
      orderNo: saleData.orderNo || '',
      lcNo: saleData.lcNo || '',
      product: saleData.productName || saleData.product || '',
      brand: saleData.brand || '',
      quantity: qty,
      rate: rate,
      unitPrice: rate,
      truck: saleData.truck || '',
      amount: amt,
      totalAmount: amt,
      paid: paid,
      due: due,
      discount: discount,
      warehouse: saleData.warehouseName || '',
      requestedBy: saleData.requestedBy || '',
      requestedByUsername: saleData.requestedByUsername || '',
      acceptedBy: saleData.acceptedBy || '',
      status: saleData.status || 'Pending',
      companyName: baseCompName,
      customerName: baseCustName,
      phone: basePhone,
      customerPhone: basePhone,
      address: baseAddress,
      location: baseAddress,
      customerType: baseCustType
    });
  }
  return entries;
}

function findCustomerForSale(customers, saleData) {
  const cId = (saleData.customerId || (saleData.customer && saleData.customer._id) || '').toString().trim();
  const cComp = (saleData.companyName || '').trim().toLowerCase();
  const cCust = (saleData.customerName || '').trim().toLowerCase();

  // 1. Direct ID match (verify companyName doesn't contradict if both are present)
  if (cId) {
    const found = customers.find(c => {
      const isId = c._id.toString() === cId || (c.decryptedData && (c.decryptedData.customerId === cId || c.decryptedData._id === cId));
      if (!isId) return false;
      if (cComp && c.decryptedData && c.decryptedData.companyName) {
        const custComp = c.decryptedData.companyName.trim().toLowerCase();
        if (custComp && cComp !== custComp && !custComp.includes(cComp) && !cComp.includes(custComp)) {
          return false;
        }
      }
      return true;
    });
    if (found) return found;
  }

  // 2. Both Company and Customer match
  if (cComp && cCust) {
    const found = customers.find(c => {
      let cd = c.decryptedData;
      if (!cd) return false;
      const compMatch = (cd.companyName || '').trim().toLowerCase() === cComp;
      const custMatch = (cd.customerName || '').trim().toLowerCase() === cCust;
      return compMatch && custMatch;
    });
    if (found) return found;
  }

  // 3. Company match (only when companyName is present)
  if (cComp) {
    const found = customers.find(c => {
      let cd = c.decryptedData;
      return cd && (cd.companyName || '').trim().toLowerCase() === cComp;
    });
    if (found) return found;
  }

  // NOTE: Never match by customerName (contact person name) alone,
  // as different companies frequently share contact names (e.g. Chondon, Sumon, etc.)

  return null;
}

/**
 * Synchronize customer salesHistory when a Sale or Order is created or updated
 */
async function syncSaleOnSave(saleDoc, reqBody, existingData = null) {
  try {
    const sType = (reqBody.saleType || saleDoc.saleType || '').toLowerCase();
    const invUpper = (reqBody.invoiceNo || saleDoc.invoiceNo || '').trim().toUpperCase();
    const isOrderEntry = sType === 'order' || invUpper.startsWith('ORD') || reqBody.isOrderEntry === true;

    // Load and decrypt all customers
    const allCustomerDocs = await Customer.find({});
    for (const cDoc of allCustomerDocs) {
      cDoc.decryptedData = decryptDocData(cDoc.data);
    }

    if (isOrderEntry) {
      const orderNo = (reqBody.orderNo || reqBody.invoiceNo || existingData?.orderNo || existingData?.invoiceNo || '').trim().toUpperCase();
      const orderId = (saleDoc._id || '').toString().trim().toUpperCase();
      const cleanOrderNo = orderNo.replace(/[^A-Z0-9]/g, '');
      const cleanOrderId = orderId.replace(/[^A-Z0-9]/g, '');

      const newCompName = (reqBody.companyName || '').trim();
      const newCustName = (reqBody.customerName || reqBody.companyName || '').trim();
      const newCustId = (reqBody.customerId || '').toString().trim();
      const newContact = (reqBody.contact || reqBody.phone || '').trim();
      const newAddress = (reqBody.address || '').trim();

      const oldCompName = (existingData?.companyName || '').trim();
      const oldCustName = (existingData?.customerName || '').trim();
      const oldCustId = (existingData?.customerId || '').toString().trim();

      const customerInfoChanged = Boolean(
        (newCompName && newCompName !== oldCompName) ||
        (newCustName && newCustName !== oldCustName) ||
        (newCustId && newCustId !== oldCustId)
      );

      // Build price map for order items
      const orderPriceMap = {};
      (reqBody.items || []).forEach(item => {
        const pName = (item.productName || item.product || '').trim().toLowerCase();
        if (item.brandEntries && item.brandEntries.length > 0) {
          item.brandEntries.forEach(be => {
            const bName = (be.brand || be.brandName || '').trim().toLowerCase();
            const rate = parseFloat(be.rate !== undefined && be.rate !== null && be.rate !== '' ? be.rate : (be.unitPrice || 0)) || 0;
            if (pName && rate > 0) {
              orderPriceMap[`${pName}_${bName}`] = rate;
              if (bName) orderPriceMap[pName] = orderPriceMap[pName] || rate;
            }
          });
        } else {
          const bName = (item.brand || item.brandName || '').trim().toLowerCase();
          const rate = parseFloat(item.rate !== undefined && item.rate !== null && item.rate !== '' ? item.rate : (item.unitPrice || 0)) || 0;
          if (pName && rate > 0) {
            orderPriceMap[`${pName}_${bName}`] = rate;
            orderPriceMap[pName] = orderPriceMap[pName] || rate;
          }
        }
      });
      const hasPriceChanges = Object.keys(orderPriceMap).length > 0;

      // Find target customer for this order
      const targetCustomerDoc = findCustomerForSale(allCustomerDocs, reqBody);
      const targetCustId = targetCustomerDoc ? targetCustomerDoc._id.toString() : newCustId;

      // Find all linked sales for this order
      const allSales = await Sale.find({ _id: { $ne: saleDoc._id } });
      const linkedSales = [];
      const linkedInvoices = new Set();
      if (orderNo) linkedInvoices.add(orderNo);
      if (orderId) linkedInvoices.add(orderId);

      for (const sDoc of allSales) {
        let sData = decryptDocData(sDoc.data);
        if (!sData) continue;
        const sTypeLow = (sData.saleType || '').toLowerCase().trim();
        const sInvUpper = (sData.invoiceNo || '').trim().toUpperCase();
        if (sTypeLow === 'order' || sInvUpper.startsWith('ORD') || sData.isOrderEntry === true) continue;

        const sOrdNo = (sData.orderNo || sData.orderRef || sData.orderId || '').trim().toUpperCase();
        const cleanSOrdNo = sOrdNo.replace(/[^A-Z0-9]/g, '');

        const isOrderMatch = (sOrdNo && (sOrdNo === orderNo || sOrdNo === orderId)) ||
                             (cleanSOrdNo && (cleanSOrdNo === cleanOrderNo || cleanSOrdNo === cleanOrderId));

        if (isOrderMatch) {
          if (sData.invoiceNo) linkedInvoices.add(sData.invoiceNo.trim().toUpperCase());
          let saleModified = false;

          if (customerInfoChanged) {
            if (targetCustId) sData.customerId = targetCustId;
            if (newCompName) sData.companyName = newCompName;
            if (newCustName) sData.customerName = newCustName;
            if (newContact) {
              sData.contact = newContact;
              sData.phone = newContact;
              sData.customerPhone = newContact;
            }
            if (newAddress) {
              sData.address = newAddress;
              sData.customerAddress = newAddress;
              sData.location = newAddress;
            }
            if (sData.customer && typeof sData.customer === 'object') {
              if (targetCustId) sData.customer.customerId = targetCustId;
              if (targetCustId) sData.customer._id = targetCustId;
              if (newCompName) sData.customer.companyName = newCompName;
              if (newCustName) sData.customer.customerName = newCustName;
              if (newContact) sData.customer.phone = newContact;
              if (newAddress) {
                sData.customer.address = newAddress;
                sData.customer.location = newAddress;
              }
            }
            saleModified = true;
          }

          if (hasPriceChanges) {
            (sData.items || []).forEach(sItem => {
              const pName = (sItem.productName || sItem.product || '').trim().toLowerCase();
              if (sItem.brandEntries && sItem.brandEntries.length > 0) {
                sItem.brandEntries.forEach(be => {
                  const bName = (be.brand || be.brandName || '').trim().toLowerCase();
                  const newRate = orderPriceMap[`${pName}_${bName}`] || orderPriceMap[pName];
                  if (newRate !== undefined && newRate > 0) {
                    const currentRate = parseFloat(be.rate !== undefined && be.rate !== null && be.rate !== '' ? be.rate : (be.unitPrice || 0)) || 0;
                    if (Math.abs(currentRate - newRate) > 0.001) {
                      be.rate = newRate;
                      be.unitPrice = newRate;
                      const qty = parseFloat(be.quantity) || 0;
                      const bag = parseFloat(be.bag || be.packet) || 0;
                      const isBagUom = (sData.uom || '').toLowerCase() === 'bag' || (sItem.uom || '').toLowerCase() === 'bag';
                      const entryAmt = isBagUom && bag > 0 ? (bag * newRate) : (qty * newRate);
                      be.amount = Number(entryAmt.toFixed(2));
                      be.totalAmount = Number(entryAmt.toFixed(2));
                      saleModified = true;
                    }
                  }
                });
              } else {
                const bName = (sItem.brand || sItem.brandName || '').trim().toLowerCase();
                const newRate = orderPriceMap[`${pName}_${bName}`] || orderPriceMap[pName];
                if (newRate !== undefined && newRate > 0) {
                  const currentRate = parseFloat(sItem.rate !== undefined && sItem.rate !== null && sItem.rate !== '' ? sItem.rate : (sItem.unitPrice || 0)) || 0;
                  if (Math.abs(currentRate - newRate) > 0.001) {
                    sItem.rate = newRate;
                    sItem.unitPrice = newRate;
                    const qty = parseFloat(sItem.quantity) || 0;
                    const bag = parseFloat(sItem.bag || sItem.packet) || 0;
                    const isBagUom = (sData.uom || '').toLowerCase() === 'bag' || (sItem.uom || '').toLowerCase() === 'bag';
                    const itemAmt = isBagUom && bag > 0 ? (bag * newRate) : (qty * newRate);
                    sItem.amount = Number(itemAmt.toFixed(2));
                    sItem.totalAmount = Number(itemAmt.toFixed(2));
                    saleModified = true;
                  }
                }
              }
            });

            if (saleModified) {
              const newSubtotal = (sData.items || []).reduce((sum, sItem) => {
                if (sItem.brandEntries && sItem.brandEntries.length > 0) {
                  return sum + sItem.brandEntries.reduce((bSum, be) => bSum + (parseFloat(be.totalAmount || be.amount) || 0), 0);
                }
                return sum + (parseFloat(sItem.totalAmount || sItem.amount) || 0);
              }, 0);

              const disc = parseFloat(sData.discount) || 0;
              const paid = parseFloat(sData.paidAmount) || 0;
              const newTotal = Math.max(0, newSubtotal - disc);
              const newDue = Math.max(0, newTotal - paid);

              sData.subtotal = Number(newSubtotal.toFixed(2));
              sData.totalAmount = Number(newTotal.toFixed(2));
              sData.dueAmount = Number(newDue.toFixed(2));
            }
          }

          if (saleModified) {
            await Sale.findByIdAndUpdate(sDoc._id, {
              data: encryptData(sData)
            });
          }

          linkedSales.push(sData);
        }
      }

      // Now sync customer salesHistory for linked sales
      for (const cDoc of allCustomerDocs) {
        let cData = cDoc.decryptedData;
        if (!cData || !Array.isArray(cData.salesHistory)) continue;
        const isTarget = targetCustomerDoc && cDoc._id.toString() === targetCustomerDoc._id.toString();

        if (isTarget) {
          // In target customer: ensure linked sales are present and updated
          let custModified = false;
          linkedSales.forEach(ls => {
            const lsInv = (ls.invoiceNo || '').trim().toUpperCase();
            const lsOrd = (ls.orderNo || '').trim().toUpperCase();
            // Remove existing entries for this linked sale
            const beforeLen = cData.salesHistory.length;
            cData.salesHistory = cData.salesHistory.filter(h => {
              const hInv = (h.invoiceNo || '').trim().toUpperCase();
              const hOrd = (h.orderNo || '').trim().toUpperCase();
              if (lsInv && hInv === lsInv) return false;
              if (lsOrd && (hOrd === lsOrd || hInv === lsOrd)) return false;
              return true;
            });
            if (cData.salesHistory.length !== beforeLen) custModified = true;

            // Generate fresh entries and prepend
            const newEntries = buildSaleHistoryEntries(ls, cData);
            if (newEntries.length > 0) {
              cData.salesHistory.unshift(...newEntries);
              custModified = true;
            }
          });

          if (custModified) {
            await Customer.findByIdAndUpdate(cDoc._id, { data: encryptData(cData) });
          }
        } else {
          // In non-target customers: REMOVE all entries matching linked sales or order
          const initialLen = cData.salesHistory.length;
          cData.salesHistory = cData.salesHistory.filter(entry => {
            const entryOrdNo = (entry.orderNo || entry.orderRef || entry.orderId || '').trim().toUpperCase();
            const entryInvNo = (entry.invoiceNo || '').trim().toUpperCase();
            const cleanEntryOrdNo = entryOrdNo.replace(/[^A-Z0-9]/g, '');

            if (entryOrdNo && (entryOrdNo === orderNo || entryOrdNo === orderId || linkedInvoices.has(entryOrdNo))) return false;
            if (cleanEntryOrdNo && (cleanEntryOrdNo === cleanOrderNo || cleanEntryOrdNo === cleanOrderId)) return false;
            if (entryInvNo && linkedInvoices.has(entryInvNo)) return false;
            return true;
          });

          if (cData.salesHistory.length !== initialLen) {
            await Customer.findByIdAndUpdate(cDoc._id, { data: encryptData(cData) });
          }
        }
      }

    } else {
      // General Sale or Border Sale
      const targetCustomerDoc = findCustomerForSale(allCustomerDocs, reqBody);
      const targetCustId = targetCustomerDoc ? targetCustomerDoc._id.toString() : (reqBody.customerId || '').toString().trim();
      const saleInv = (reqBody.invoiceNo || saleDoc.invoiceNo || '').trim().toUpperCase();
      const saleOrd = (reqBody.orderNo || '').trim().toUpperCase();

      // 1. Remove this sale's invoice from all non-target customers
      for (const cDoc of allCustomerDocs) {
        if (targetCustomerDoc && cDoc._id.toString() === targetCustomerDoc._id.toString()) continue;
        let cData = cDoc.decryptedData;
        if (!cData || !Array.isArray(cData.salesHistory)) continue;

        const initialLen = cData.salesHistory.length;
        cData.salesHistory = cData.salesHistory.filter(h => {
          const hInv = (h.invoiceNo || '').trim().toUpperCase();
          const hOrd = (h.orderNo || '').trim().toUpperCase();
          if (saleInv && hInv === saleInv) return false;
          if (saleOrd && (hOrd === saleOrd || hInv === saleOrd)) return false;
          return true;
        });

        if (cData.salesHistory.length !== initialLen) {
          await Customer.findByIdAndUpdate(cDoc._id, { data: encryptData(cData) });
        }
      }

      // 2. Add / Update in target customer
      if (targetCustomerDoc) {
        let cData = targetCustomerDoc.decryptedData;
        if (!cData.salesHistory || !Array.isArray(cData.salesHistory)) {
          cData.salesHistory = [];
        }

        // Filter out old entries for this invoice
        cData.salesHistory = cData.salesHistory.filter(h => {
          const hInv = (h.invoiceNo || '').trim().toUpperCase();
          const hOrd = (h.orderNo || '').trim().toUpperCase();
          if (saleInv && hInv === saleInv) return false;
          if (saleOrd && (hOrd === saleOrd || hInv === saleOrd)) return false;
          return true;
        });

        // Add new entries if not rejected
        const saleStatus = (reqBody.status || saleDoc.status || '').toLowerCase();
        if (saleStatus !== 'rejected') {
          const newEntries = buildSaleHistoryEntries(reqBody, cData);
          if (newEntries.length > 0) {
            cData.salesHistory.unshift(...newEntries);
          }
        }

        await Customer.findByIdAndUpdate(targetCustomerDoc._id, { data: encryptData(cData) });
      }
    }
  } catch (err) {
    console.error('Error in syncSaleOnSave:', err);
  }
}

/**
 * Clean up deleted sale from all customers' salesHistory
 */
async function syncSaleOnDelete(saleInv, saleOrd) {
  try {
    const invUpper = (saleInv || '').trim().toUpperCase();
    const ordUpper = (saleOrd || '').trim().toUpperCase();
    if (!invUpper && !ordUpper) return;

    const allCustomers = await Customer.find({});
    for (const cDoc of allCustomers) {
      let cData = decryptDocData(cDoc.data);
      if (!cData || !Array.isArray(cData.salesHistory)) continue;

      const initialLen = cData.salesHistory.length;
      cData.salesHistory = cData.salesHistory.filter(h => {
        const hInv = (h.invoiceNo || '').trim().toUpperCase();
        const hOrd = (h.orderNo || '').trim().toUpperCase();
        if (invUpper && hInv === invUpper) return false;
        if (ordUpper && (hOrd === ordUpper || hInv === ordUpper)) return false;
        return true;
      });

      if (cData.salesHistory.length !== initialLen) {
        await Customer.findByIdAndUpdate(cDoc._id, { data: encryptData(cData) });
      }
    }
  } catch (err) {
    console.error('Error in syncSaleOnDelete:', err);
  }
}

/**
 * Ensures Chondon entities (Bogura, Dinajpur, Gobindogonj) have their sales and orders
 * correctly attributed and never cross-contaminated.
 */
async function repairChondonEntities() {
  // Deprecated: No-op to avoid hardcoded customer overwrites
  return;
}

/**
 * Scan all sales and customers in database, repair misallocated sales
 */
async function repairAllCustomerSalesHistory() {

  const salesDocs = await Sale.find();
  const customerDocs = await Customer.find();

  for (const cDoc of customerDocs) {
    cDoc.decryptedData = decryptDocData(cDoc.data);
    if (!cDoc.decryptedData.salesHistory || !Array.isArray(cDoc.decryptedData.salesHistory)) {
      cDoc.decryptedData.salesHistory = [];
    }
  }

  const allSales = [];
  for (const sDoc of salesDocs) {
    let sData = decryptDocData(sDoc.data);
    if (!sData) continue;
    const sType = (sData.saleType || '').toLowerCase();
    const sInv = (sData.invoiceNo || '').trim().toUpperCase();
    if (sType === 'order' || sInv.startsWith('ORD') || sData.isOrderEntry === true) continue;
    allSales.push({ doc: sDoc, data: sData });
  }

  let repairedCount = 0;
  for (const { data: sale } of allSales) {
    const targetCustomer = findCustomerForSale(customerDocs, sale);
    const saleInv = (sale.invoiceNo || '').trim().toUpperCase();
    const saleOrd = (sale.orderNo || '').trim().toUpperCase();
    if (!saleInv) continue;

    // Check all customers
    for (const c of customerDocs) {
      const isTarget = targetCustomer && c._id.toString() === targetCustomer._id.toString();
      const hasSale = c.decryptedData.salesHistory.some(h => (h.invoiceNo || '').trim().toUpperCase() === saleInv);

      if (!isTarget && hasSale) {
        // Remove from wrong customer
        c.decryptedData.salesHistory = c.decryptedData.salesHistory.filter(h => (h.invoiceNo || '').trim().toUpperCase() !== saleInv);
        c.isDirty = true;
        repairedCount++;
      } else if (isTarget && !hasSale) {
        // Add to correct customer
        const newEntries = buildSaleHistoryEntries(sale, c.decryptedData);
        if (newEntries.length > 0) {
          c.decryptedData.salesHistory.unshift(...newEntries);
          c.isDirty = true;
          repairedCount++;
        }
      }
    }
  }

  // Save all dirty customers
  for (const c of customerDocs) {
    if (c.isDirty) {
      await Customer.findByIdAndUpdate(c._id, { data: encryptData(c.decryptedData) });
    }
  }

  return { repairedCount };
}

module.exports = {
  buildSaleHistoryEntries,
  findCustomerForSale,
  syncSaleOnSave,
  syncSaleOnDelete,
  repairChondonEntities,
  repairAllCustomerSalesHistory
};
