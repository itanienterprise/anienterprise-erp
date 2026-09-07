const mongoose = require('mongoose');
const { encryptData, decryptData } = require('../utils/encryption');
const Stock = require('../models/Stock');
const Warehouse = require('../models/Warehouse');
const Sale = require('../models/Sale');
const CostOfGoods = require('../models/CostOfGoods');
const Damage = require('../models/Damage');
const Purchase = require('../models/Purchase');
const PurchaseReceive = require('../models/PurchaseReceive');
const Customer = require('../models/Customer');
const StockBaseline = require('../models/StockBaseline');

const normalize = (str) => (str || '').toString().trim().toLowerCase();

/**
 * Cascades brand name updates across all collections where the brand is referenced for a specific product.
 * @param {string} productName - The name of the product
 * @param {string} oldBrand - The previous brand name
 * @param {string} newBrand - The updated brand name
 * @returns {Promise<Object>} Summary of documents updated in each collection
 */
async function updateBrandAcrossAllCollections(productName, oldBrand, newBrand) {
    const normProduct = normalize(productName);
    const normOldBrand = normalize(oldBrand);
    const trimmedNewBrand = (newBrand || '').toString().trim();

    if (!normProduct || !normOldBrand || !trimmedNewBrand || normOldBrand === normalize(trimmedNewBrand)) {
        return { status: 'skipped', reason: 'Invalid or identical brand names' };
    }

    const counts = {
        stocks: 0,
        legacyStock: 0,
        warehouses: 0,
        sales: 0,
        costOfGoods: 0,
        damages: 0,
        purchases: 0,
        purchaseReceives: 0,
        customers: 0,
        stockBaselines: 0
    };

    // Helper to decrypt doc data safely
    const getDecrypted = (doc) => {
        if (!doc) return null;
        if (doc.data) {
            const dec = decryptData(doc.data);
            if (dec) return { ...dec, _id: doc._id };
        }
        return doc.toObject ? doc.toObject() : doc;
    };

    // Helper to re-encrypt and save doc
    const saveEncrypted = async (doc, data) => {
        const enc = encryptData(data);
        doc.data = enc;
        await doc.save();
    };

    // 1. STOCKS Collection (Stock model)
    try {
        const stockDocs = await Stock.find({});
        for (const doc of stockDocs) {
            const data = getDecrypted(doc);
            if (!data) continue;
            const pName = normalize(data.productName || data.product);
            const bName = normalize(data.brand);
            if (pName === normProduct && bName === normOldBrand) {
                data.brand = trimmedNewBrand;
                await saveEncrypted(doc, data);
                counts.stocks++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to Stock:', err);
    }

    // 2. Legacy 'stock' collection (if exists in MongoDB)
    try {
        const db = mongoose.connection.db;
        if (db) {
            const legacyStockDocs = await db.collection('stock').find({}).toArray();
            for (const d of legacyStockDocs) {
                let data = d;
                let isEncrypted = false;
                if (d.data) {
                    const dec = decryptData(d.data);
                    if (dec) {
                        data = dec;
                        isEncrypted = true;
                    }
                }
                const pName = normalize(data.productName || data.product);
                const bName = normalize(data.brand);
                if (pName === normProduct && bName === normOldBrand) {
                    data.brand = trimmedNewBrand;
                    if (isEncrypted) {
                        await db.collection('stock').updateOne({ _id: d._id }, { $set: { data: encryptData(data) } });
                    } else {
                        await db.collection('stock').updateOne({ _id: d._id }, { $set: { brand: trimmedNewBrand } });
                    }
                    counts.legacyStock++;
                }
            }
        }
    } catch (err) {
        console.error('Error cascading brand to legacy stock:', err);
    }

    // 3. WAREHOUSES Collection (Warehouse model)
    try {
        const whDocs = await Warehouse.find({});
        for (const doc of whDocs) {
            const data = getDecrypted(doc);
            if (!data) continue;
            const pName = normalize(data.product || data.productName);
            const bName = normalize(data.brand);
            if (pName === normProduct && bName === normOldBrand) {
                data.brand = trimmedNewBrand;
                await saveEncrypted(doc, data);
                counts.warehouses++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to Warehouse:', err);
    }

    // 4. SALES Collection (Sale model)
    try {
        const saleDocs = await Sale.find({});
        for (const doc of saleDocs) {
            const data = getDecrypted(doc);
            if (!data || !Array.isArray(data.items)) continue;
            let modified = false;

            data.items.forEach(item => {
                const itemProd = normalize(item.productName || item.product);
                if (itemProd === normProduct) {
                    if (normalize(item.brand) === normOldBrand) {
                        item.brand = trimmedNewBrand;
                        modified = true;
                    }
                    if (normalize(item.brandName) === normOldBrand) {
                        item.brandName = trimmedNewBrand;
                        modified = true;
                    }
                    if (Array.isArray(item.brandEntries)) {
                        item.brandEntries.forEach(be => {
                            if (normalize(be.brand) === normOldBrand) {
                                be.brand = trimmedNewBrand;
                                modified = true;
                            }
                            if (normalize(be.brandName) === normOldBrand) {
                                be.brandName = trimmedNewBrand;
                                modified = true;
                            }
                        });
                    }
                }
            });

            if (modified) {
                await saveEncrypted(doc, data);
                counts.sales++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to Sale:', err);
    }

    // 5. COST OF GOODS Collection (CostOfGoods model)
    try {
        const cogDocs = await CostOfGoods.find({});
        for (const doc of cogDocs) {
            const data = getDecrypted(doc);
            if (!data) continue;
            const pName = normalize(data.product || data.productName);
            const bName = normalize(data.brand);
            if (pName === normProduct && bName === normOldBrand) {
                data.brand = trimmedNewBrand;
                await saveEncrypted(doc, data);
                counts.costOfGoods++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to CostOfGoods:', err);
    }

    // 6. DAMAGES Collection (Damage model)
    try {
        const dmgDocs = await Damage.find({});
        for (const doc of dmgDocs) {
            const data = getDecrypted(doc);
            if (!data) continue;
            const pName = normalize(data.productName || data.product);
            const bName = normalize(data.brand);
            if (pName === normProduct && bName === normOldBrand) {
                data.brand = trimmedNewBrand;
                await saveEncrypted(doc, data);
                counts.damages++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to Damage:', err);
    }

    // 7. PURCHASES Collection (Purchase model)
    try {
        const purchaseDocs = await Purchase.find({});
        for (const doc of purchaseDocs) {
            const data = getDecrypted(doc);
            if (!data || !Array.isArray(data.items)) continue;
            let modified = false;

            data.items.forEach(item => {
                const itemProd = normalize(item.productName || item.product);
                if (itemProd === normProduct) {
                    if (normalize(item.brand) === normOldBrand) {
                        item.brand = trimmedNewBrand;
                        modified = true;
                    }
                    if (Array.isArray(item.brandEntries)) {
                        item.brandEntries.forEach(be => {
                            if (normalize(be.brand) === normOldBrand) {
                                be.brand = trimmedNewBrand;
                                modified = true;
                            }
                        });
                    }
                }
            });

            if (modified) {
                await saveEncrypted(doc, data);
                counts.purchases++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to Purchase:', err);
    }

    // 8. PURCHASE RECEIVES Collection (PurchaseReceive model)
    try {
        const prDocs = await PurchaseReceive.find({});
        for (const doc of prDocs) {
            const data = getDecrypted(doc);
            if (!data || !Array.isArray(data.items)) continue;
            let modified = false;

            data.items.forEach(item => {
                const itemProd = normalize(item.productName || item.product);
                if (itemProd === normProduct) {
                    if (normalize(item.brand) === normOldBrand) {
                        item.brand = trimmedNewBrand;
                        modified = true;
                    }
                    if (Array.isArray(item.brandEntries)) {
                        item.brandEntries.forEach(be => {
                            if (normalize(be.brand) === normOldBrand) {
                                be.brand = trimmedNewBrand;
                                modified = true;
                            }
                        });
                    }
                }
            });

            if (modified) {
                await saveEncrypted(doc, data);
                counts.purchaseReceives++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to PurchaseReceive:', err);
    }

    // 9. CUSTOMERS Collection (Customer model: salesHistory)
    try {
        const custDocs = await Customer.find({});
        for (const doc of custDocs) {
            const data = getDecrypted(doc);
            if (!data || !Array.isArray(data.salesHistory)) continue;
            let modified = false;

            data.salesHistory.forEach(sh => {
                const pName = normalize(sh.product || sh.productName);
                const bName = normalize(sh.brand);
                if (pName === normProduct && bName === normOldBrand) {
                    sh.brand = trimmedNewBrand;
                    modified = true;
                }
            });

            if (modified) {
                await saveEncrypted(doc, data);
                counts.customers++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to Customer:', err);
    }

    // 10. STOCK BASELINES Collection (StockBaseline model)
    try {
        const sbDocs = await StockBaseline.find({});
        for (const doc of sbDocs) {
            const data = getDecrypted(doc);
            if (!data || !Array.isArray(data.snapshotRecords)) continue;
            let modified = false;

            data.snapshotRecords.forEach(rec => {
                const pName = normalize(rec.productName || rec.product);
                const bName = normalize(rec.brand);
                if (pName === normProduct && bName === normOldBrand) {
                    rec.brand = trimmedNewBrand;
                    modified = true;
                }
            });

            if (modified) {
                await saveEncrypted(doc, data);
                counts.stockBaselines++;
            }
        }
    } catch (err) {
        console.error('Error cascading brand to StockBaseline:', err);
    }

    return {
        status: 'success',
        productName,
        oldBrand,
        newBrand: trimmedNewBrand,
        counts
    };
}

module.exports = {
    updateBrandAcrossAllCollections
};
