const LCManagement = require('../models/LCManagement');
const PackingList = require('../models/PackingList');
const Stock = require('../models/Stock');
const PI = require('../models/PI');
const Product = require('../models/Product');
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

let packingListRestoreMap = {};
try {
    const plPath = path.resolve(__dirname, './packingListRestoreMap.json');
    if (fs.existsSync(plPath)) {
        packingListRestoreMap = JSON.parse(fs.readFileSync(plPath, 'utf8'));
    }
} catch (e) {
    console.error('[Self-Healing] Error loading packingListRestoreMap.json:', e);
}

let stockRestoreMap = {};
try {
    const stockPath = path.resolve(__dirname, './stockRestoreMap.json');
    if (fs.existsSync(stockPath)) {
        stockRestoreMap = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
    }
} catch (e) {
    console.error('[Self-Healing] Error loading stockRestoreMap.json:', e);
}

const cleanLcDigits = (val) => String(val || '').replace(/\D/g, '');
const normalize = (val) => String(val || '').trim().toLowerCase();

/**
 * Universal self-healing migration to restore products that were incorrectly overwritten
 * with "GARLIC", or where Stock records were incorrectly set to IP trade names (e.g. "WHEAT BRAN")
 * instead of internal ERP catalog product names ("BRAN").
 */
async function repairCorruptedGarlicProducts() {
    let fixedLcs = 0;
    let fixedPls = 0;
    let fixedStocks = 0;

    try {
        // Build catalog product mappings (Name, IP Name, Brands, Aliases)
        const nameToCatalog = new Map();
        const ipToCatalog = new Map();
        const brandToCatalog = new Map();

        try {
            const productDocs = await Product.find({}).lean();
            for (const pDoc of productDocs) {
                const p = pDoc.data ? decryptData(pDoc.data) : pDoc;
                if (!p || !p.name) continue;
                const cName = p.name.trim();
                const normName = normalize(cName);
                nameToCatalog.set(normName, cName);
                if (normName.endsWith('s')) nameToCatalog.set(normName.slice(0, -1), cName);

                if (p.ipName) {
                    const normIp = normalize(p.ipName);
                    ipToCatalog.set(normIp, cName);
                    if (normIp.endsWith('s')) ipToCatalog.set(normIp.slice(0, -1), cName);
                    // Also strip parenthesis
                    const stripped = normalize(p.ipName.replace(/\(.*?\)/g, ''));
                    if (stripped && stripped !== normIp) {
                        ipToCatalog.set(stripped, cName);
                    }
                }

                if (Array.isArray(p.brands)) {
                    for (const b of p.brands) {
                        const bName = normalize(b.brand || b.name);
                        if (bName) {
                            brandToCatalog.set(bName, cName);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[Self-Healing] Error building product catalog maps:', e);
        }

        // Hardcoded known trade aliases for 100% guarantee
        const knownTradeAliases = {
            'wheat bran': 'BRAN',
            'wheat bran (feed grade)': 'BRAN',
            'bran': 'BRAN',
            'red whole lentils': 'MOSUR DAL',
            'red whole lentils (masur)': 'MOSUR DAL',
            'mosur dal': 'MOSUR DAL',
            'masur dal': 'MOSUR DAL',
            'grass pea': 'KHESHARI DAL',
            'grass pea (khesari dal)': 'KHESHARI DAL',
            'kheshari dal': 'KHESHARI DAL',
            'khesari dal': 'KHESHARI DAL',
            'groundnut (in shell)': 'GROUND NUT',
            'ground nut': 'GROUND NUT',
            'non basmati boiled rice': 'RICE',
            'rice': 'RICE',
            'fresh tomato': 'TOMATO',
            'tomato': 'TOMATO',
            'fresh valencia oranges (malta)': 'MALTA',
            'malta': 'MALTA',
            'fresh orange': 'ORANGE',
            'orange': 'ORANGE',
            'fresh anar (pomegranate)': 'ANAR (POMEGRANATE)',
            'anar': 'ANAR (POMEGRANATE)',
            'anar (pomegranate)': 'ANAR (POMEGRANATE)',
            'drum stick (sozna data)': 'DRUM STICK',
            'drum stick': 'DRUM STICK',
            'fresh ginger (non-seed)': 'GINGER',
            'ginger': 'GINGER',
            'fresh dates': 'FRESH DATES',
            'fresh apple': 'FRESH APPLE',
            'fresh grapes': 'FRESH GRAPES',
            'grapes grade b': 'FRESH GRAPES',
            'chick peas': 'CHICK PEAS',
            'moth dal': 'MOTH DAL',
            'mung dal': 'MUNG DAL',
            'maize': 'MAIZE',
            'wheat': 'WHEAT',
            'yellow pea bran': 'YELLOW PEA BRAN',
            'black matpe': 'BLACK MATPE'
        };

        const resolveToInternalCatalogName = (rawName, brand = '') => {
            if (!rawName && !brand) return null;
            const norm = normalize(rawName);

            // 1. Direct alias match
            if (norm && knownTradeAliases[norm]) return knownTradeAliases[norm];

            // 2. Exact catalog name
            if (norm && nameToCatalog.has(norm)) return nameToCatalog.get(norm);

            // 3. Exact IP name match
            if (norm && ipToCatalog.has(norm)) return ipToCatalog.get(norm);

            // 4. Match via brand
            const normBrand = normalize(brand);
            if (normBrand && brandToCatalog.has(normBrand)) return brandToCatalog.get(normBrand);

            // 5. Stripped parenthetical
            if (norm) {
                const stripped = normalize(norm.replace(/\(.*?\)/g, ''));
                if (stripped && knownTradeAliases[stripped]) return knownTradeAliases[stripped];
                if (stripped && nameToCatalog.has(stripped)) return nameToCatalog.get(stripped);
                if (stripped && ipToCatalog.has(stripped)) return ipToCatalog.get(stripped);
            }

            return null;
        };

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

                const docIdStr = String(doc._id);
                const plLcClean = cleanLcDigits(pl.lcNumber || pl.lcNo);
                const isAuthenticGarlic = (plLcClean === '087326010572');

                let shouldRepair = false;
                if (!isAuthenticGarlic) {
                    if (pl.productName === 'GARLIC') shouldRepair = true;
                    if (Array.isArray(pl.productsList) && pl.productsList.some(p => p.productName === 'GARLIC')) {
                        shouldRepair = true;
                    }
                }

                // Check exact baseline restore map for PackingList
                const mappedPl = packingListRestoreMap[docIdStr];
                if (mappedPl && mappedPl.productName && mappedPl.productName !== 'GARLIC') {
                    if (pl.productName !== mappedPl.productName || shouldRepair) {
                        pl.productName = mappedPl.productName;
                        if (Array.isArray(mappedPl.productsList)) {
                            pl.productsList = mappedPl.productsList;
                        }
                        doc.data = encryptData(pl);
                        await doc.save();
                        fixedPls++;
                        continue;
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

        // 3. REPAIR STOCK RECORDS (LC RECEIVE)
        // Ensure Stock.productName strictly matches internal ERP catalog product names (e.g. 'BRAN', 'MOSUR DAL')
        const stockDocs = await Stock.find({});
        for (const doc of stockDocs) {
            try {
                if (!doc.data) continue;
                const stock = decryptData(doc.data);
                if (!stock) continue;

                const docIdStr = String(doc._id);
                const stockLcClean = cleanLcDigits(stock.lcNo);
                const isAuthenticGarlic = (stockLcClean === '087326010572');

                let targetProduct = null;

                // Priority 1: Exact pre-corruption baseline map for this stock record _id
                if (stockRestoreMap[docIdStr] && stockRestoreMap[docIdStr].productName) {
                    targetProduct = stockRestoreMap[docIdStr].productName;
                }

                // Priority 2: If current productName is an IP trade name or alias (e.g. 'WHEAT BRAN', 'WHEAT BRAN (FEED GRADE)', 'RED WHOLE LENTILS')
                if (!targetProduct) {
                    targetProduct = resolveToInternalCatalogName(stock.productName || stock.product, stock.brand);
                }

                // Priority 3: If still GARLIC or unmapped
                if (!targetProduct && !isAuthenticGarlic && (stock.productName === 'GARLIC' || stock.product === 'GARLIC')) {
                    if (stockLcClean && resolvedLcProducts.has(stockLcClean)) {
                        const lcProd = resolvedLcProducts.get(stockLcClean);
                        targetProduct = resolveToInternalCatalogName(lcProd, stock.brand) || lcProd;
                    } else if (stockLcClean && garlicRestoreMap[stockLcClean]) {
                        const lcProd = garlicRestoreMap[stockLcClean].productName;
                        targetProduct = resolveToInternalCatalogName(lcProd, stock.brand) || lcProd;
                    }
                }

                // Check if Stock needs updating
                if (targetProduct && targetProduct !== 'GARLIC') {
                    const currentProd = (stock.productName || stock.product || '').trim();
                    const needsUpdate = (currentProd !== targetProduct) ||
                        (stock.product !== targetProduct) ||
                        (Array.isArray(stock.entries) && stock.entries.some(e => (e.productName || '').trim() !== targetProduct));

                    if (needsUpdate) {
                        stock.productName = targetProduct;
                        stock.product = targetProduct;

                        if (Array.isArray(stock.entries)) {
                            stock.entries.forEach(e => {
                                e.productName = targetProduct;
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
            console.log(`[Self-Healing] Successfully repaired product corruption: ${fixedLcs} LCs, ${fixedPls} Packing Lists, ${fixedStocks} Stocks.`);
        }
    } catch (err) {
        console.error('[Self-Healing] Error in repairCorruptedGarlicProducts:', err);
    }

    return { fixedLcs, fixedPls, fixedStocks };
}

module.exports = {
    repairCorruptedGarlicProducts
};
