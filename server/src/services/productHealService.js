const LCManagement = require('../models/LCManagement');
const PackingList = require('../models/PackingList');
const Stock = require('../models/Stock');
const PI = require('../models/PI');
const { decryptData, encryptData } = require('../utils/encryption');
const path = require('path');
const fs = require('fs');

let garlicRestoreMap = {};
try {
    const mapPath = path.resolve(__dirname, './garlicRestoreMap.json');
    if (fs.existsSync(mapPath)) {
        garlicRestoreMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    }
} catch (e) {
    console.error('[Self-Healing] Error loading garlicRestoreMap.json:', e);
}

const cleanLcDigits = (val) => String(val || '').replace(/\D/g, '');

/**
 * Universal self-healing migration to restore products that were incorrectly overwritten with "GARLIC".
 * Authentically matches each LC, Packing List, and Stock against:
 * 1. The pre-corruption exact restore map (285 LCs)
 * 2. The linked PI (Proforma Invoice) in the database
 */
async function repairCorruptedGarlicProducts() {
    let fixedLcs = 0;
    let fixedPls = 0;
    let fixedStocks = 0;

    try {
        // Build an in-memory lookup of PI numbers to product names for dynamic resolution
        const piDocs = await PI.find({}).lean();
        const piLookup = new Map();
        for (const doc of piDocs) {
            try {
                const piData = doc.data ? decryptData(doc.data) : doc;
                if (piData && piData.piNumber) {
                    const cleanPi = cleanLcDigits(piData.piNumber);
                    if (cleanPi) {
                        piLookup.set(cleanPi, {
                            productName: piData.productName,
                            productsList: piData.productsList || []
                        });
                    }
                    piLookup.set(String(piData.piNumber).trim().toLowerCase(), {
                        productName: piData.productName,
                        productsList: piData.productsList || []
                    });
                }
            } catch (err) {
                // skip corrupted individual PI
            }
        }

        // 1. REPAIR LC MANAGEMENT
        const lcDocs = await LCManagement.find({});
        const resolvedLcProducts = new Map();

        for (const doc of lcDocs) {
            try {
                if (!doc.data) continue;
                const lc = decryptData(doc.data);
                if (!lc) continue;

                const lcClean = cleanLcDigits(lc.lcNo);
                const isAuthenticGarlic = (lcClean === '087326010572');

                let shouldRepair = false;
                if (!isAuthenticGarlic) {
                    if (lc.productName === 'GARLIC') shouldRepair = true;
                    if (Array.isArray(lc.productsList) && lc.productsList.some(p => p.productName === 'GARLIC')) {
                        shouldRepair = true;
                    }
                }

                if (shouldRepair) {
                    let targetProduct = null;
                    let targetProductsList = null;

                    // Option A: Check embedded clean baseline map
                    if (lcClean && garlicRestoreMap[lcClean]) {
                        targetProduct = garlicRestoreMap[lcClean].productName;
                        targetProductsList = garlicRestoreMap[lcClean].productsList;
                    }

                    // Option B: Dynamic lookup from linked PI
                    if (!targetProduct && lc.piNo) {
                        const cleanPi = cleanLcDigits(lc.piNo);
                        const piInfo = piLookup.get(cleanPi) || piLookup.get(String(lc.piNo).trim().toLowerCase());
                        if (piInfo && piInfo.productName && piInfo.productName !== 'GARLIC') {
                            targetProduct = piInfo.productName;
                            targetProductsList = piInfo.productsList;
                        }
                    }

                    if (targetProduct && targetProduct !== 'GARLIC') {
                        lc.productName = targetProduct;
                        if (lc.product) lc.product = targetProduct;

                        if (Array.isArray(lc.productsList)) {
                            if (Array.isArray(targetProductsList) && targetProductsList.length === lc.productsList.length) {
                                lc.productsList.forEach((item, idx) => {
                                    if (targetProductsList[idx]?.productName) {
                                        item.productName = targetProductsList[idx].productName;
                                    }
                                });
                            } else {
                                lc.productsList.forEach(item => {
                                    item.productName = targetProduct;
                                });
                            }
                        }

                        if (Array.isArray(lc.amendments)) {
                            lc.amendments.forEach(amd => {
                                if (amd.productName === 'GARLIC') amd.productName = targetProduct;
                                if (Array.isArray(amd.productsList)) {
                                    amd.productsList.forEach(p => {
                                        if (p.productName === 'GARLIC') p.productName = targetProduct;
                                    });
                                }
                            });
                        }

                        doc.data = encryptData(lc);
                        await doc.save();
                        fixedLcs++;
                        if (lcClean) resolvedLcProducts.set(lcClean, targetProduct);
                    }
                } else if (lcClean && lc.productName) {
                    resolvedLcProducts.set(lcClean, lc.productName);
                }
            } catch (err) {
                console.error('[Self-Healing] Error repairing LC:', doc._id, err);
            }
        }

        // 2. REPAIR PACKING LISTS
        const plDocs = await PackingList.find({});
        for (const doc of plDocs) {
            try {
                if (!doc.data) continue;
                const pl = decryptData(doc.data);
                if (!pl) continue;

                const plLcClean = cleanLcDigits(pl.lcNumber || pl.lcNo);
                const isAuthenticGarlic = (plLcClean === '087326010572');

                let shouldRepair = false;
                if (!isAuthenticGarlic) {
                    if (pl.productName === 'GARLIC') shouldRepair = true;
                    if (Array.isArray(pl.productsList) && pl.productsList.some(p => p.productName === 'GARLIC')) {
                        shouldRepair = true;
                    }
                }

                if (shouldRepair) {
                    let targetProduct = null;
                    if (plLcClean && resolvedLcProducts.has(plLcClean)) {
                        targetProduct = resolvedLcProducts.get(plLcClean);
                    } else if (plLcClean && garlicRestoreMap[plLcClean]) {
                        targetProduct = garlicRestoreMap[plLcClean].productName;
                    } else if (pl.piNumber || pl.piNo) {
                        const piClean = cleanLcDigits(pl.piNumber || pl.piNo);
                        const piInfo = piLookup.get(piClean);
                        if (piInfo && piInfo.productName && piInfo.productName !== 'GARLIC') {
                            targetProduct = piInfo.productName;
                        }
                    }

                    if (targetProduct && targetProduct !== 'GARLIC') {
                        pl.productName = targetProduct;
                        if (Array.isArray(pl.productsList)) {
                            pl.productsList.forEach(p => {
                                if (p.productName === 'GARLIC') p.productName = targetProduct;
                            });
                        }

                        doc.data = encryptData(pl);
                        await doc.save();
                        fixedPls++;
                    }
                }
            } catch (err) {
                console.error('[Self-Healing] Error repairing Packing List:', doc._id, err);
            }
        }

        // 3. REPAIR STOCK RECORDS
        const stockDocs = await Stock.find({});
        for (const doc of stockDocs) {
            try {
                if (!doc.data) continue;
                const stock = decryptData(doc.data);
                if (!stock) continue;

                const stockLcClean = cleanLcDigits(stock.lcNo);
                const isAuthenticGarlic = (stockLcClean === '087326010572');

                let shouldRepair = false;
                if (!isAuthenticGarlic) {
                    if (stock.productName === 'GARLIC' || stock.product === 'GARLIC') shouldRepair = true;
                    if (Array.isArray(stock.entries) && stock.entries.some(e => e.productName === 'GARLIC')) {
                        shouldRepair = true;
                    }
                }

                if (shouldRepair) {
                    let targetProduct = null;
                    if (stockLcClean && resolvedLcProducts.has(stockLcClean)) {
                        targetProduct = resolvedLcProducts.get(stockLcClean);
                    } else if (stockLcClean && garlicRestoreMap[stockLcClean]) {
                        targetProduct = garlicRestoreMap[stockLcClean].productName;
                    }

                    if (targetProduct && targetProduct !== 'GARLIC') {
                        if (stock.productName === 'GARLIC') stock.productName = targetProduct;
                        if (stock.product === 'GARLIC') stock.product = targetProduct;

                        if (Array.isArray(stock.entries)) {
                            stock.entries.forEach(e => {
                                if (e.productName === 'GARLIC') e.productName = targetProduct;
                            });
                        }

                        doc.data = encryptData(stock);
                        await doc.save();
                        fixedStocks++;
                    }
                }
            } catch (err) {
                console.error('[Self-Healing] Error repairing Stock:', doc._id, err);
            }
        }

        if (fixedLcs > 0 || fixedPls > 0 || fixedStocks > 0) {
            console.log(`[Self-Healing] Successfully repaired garlic product corruption: ${fixedLcs} LCs, ${fixedPls} Packing Lists, ${fixedStocks} Stocks.`);
        }
    } catch (err) {
        console.error('[Self-Healing] Error in repairCorruptedGarlicProducts:', err);
    }

    return { fixedLcs, fixedPls, fixedStocks };
}

module.exports = {
    repairCorruptedGarlicProducts
};
