const mongoose = require('mongoose');
const { encryptData, decryptData } = require('../utils/encryption');
const IpRecord = require('../models/IpRecord');
const PI = require('../models/PI');
const LCManagement = require('../models/LCManagement');
const PackingList = require('../models/PackingList');
const Stock = require('../models/Stock');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const PurchaseReceive = require('../models/PurchaseReceive');

const normalize = (str) => (str || '').toString().trim().toLowerCase();
const cleanLc = (str) => (str || '').toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const getDecrypted = (doc) => {
    if (!doc) return null;
    if (doc.data) {
        const dec = decryptData(doc.data);
        if (dec) return { ...dec, _id: doc._id };
    }
    return doc.toObject ? doc.toObject() : doc;
};

const saveEncrypted = async (doc, data) => {
    const enc = encryptData(data);
    doc.data = enc;
    await doc.save();
};

/**
 * Cascades IP updates (productName, ipNumber) across PI, LC Management, Packing List, and Stock.
 */
async function cascadeIpUpdate({ oldIpNumber, newIpNumber, oldProductName, newProductName }) {
    const normOldProd = normalize(oldProductName);
    const normNewProd = normalize(newProductName);
    const trimmedNewProd = (newProductName || '').toString().trim();

    const normOldIp = normalize(oldIpNumber);
    const normNewIp = normalize(newIpNumber);
    const trimmedNewIp = (newIpNumber || '').toString().trim();

    const prodChanged = normOldProd && trimmedNewProd && normOldProd !== normNewProd;
    const ipChanged = normOldIp && trimmedNewIp && normOldIp !== normNewIp;

    if (!prodChanged && !ipChanged) {
        return { status: 'skipped', reason: 'No changes detected in IP product name or number' };
    }

    const counts = {
        pis: 0,
        lcs: 0,
        packingLists: 0,
        stocks: 0
    };

    const affectedPiNumbers = new Set();
    const affectedLcNumbers = new Set();

    // 1. UPDATE PIs
    try {
        const piDocs = await PI.find({});
        for (const doc of piDocs) {
            const pi = getDecrypted(doc);
            if (!pi) continue;

            let piModified = false;

            const piIps = [
                pi.ipNumber,
                ...(Array.isArray(pi.ipNumbers) ? pi.ipNumbers : [])
            ].filter(Boolean).map(normalize);

            const isLinkedToIp = normOldIp && (
                piIps.includes(normOldIp) ||
                (Array.isArray(pi.productsList) && pi.productsList.some(item => normalize(item._fromIp) === normOldIp))
            );

            // If IP number changed
            if (ipChanged && isLinkedToIp) {
                if (normalize(pi.ipNumber) === normOldIp) {
                    pi.ipNumber = trimmedNewIp;
                    piModified = true;
                }
                if (Array.isArray(pi.ipNumbers)) {
                    pi.ipNumbers = pi.ipNumbers.map(n => normalize(n) === normOldIp ? trimmedNewIp : n);
                    piModified = true;
                }
            }

            // Update product name in PI
            if (prodChanged) {
                if (isLinkedToIp || (!normOldIp && normalize(pi.productName) === normOldProd)) {
                    if (normalize(pi.productName) === normOldProd) {
                        pi.productName = trimmedNewProd;
                        piModified = true;
                    }

                    if (Array.isArray(pi.productsList)) {
                        pi.productsList.forEach(item => {
                            const itemFromThisIp = normOldIp ? (normalize(item._fromIp) === normOldIp) : false;
                            const itemNameMatches = normalize(item.productName) === normOldProd;
                            if (itemFromThisIp || itemNameMatches) {
                                item.productName = trimmedNewProd;
                                if (ipChanged && itemFromThisIp) {
                                    item._fromIp = trimmedNewIp;
                                }
                                piModified = true;
                            }
                        });
                    }

                    // Update revisions if present
                    if (Array.isArray(pi.revisions)) {
                        pi.revisions.forEach(rev => {
                            if (normalize(rev.productName) === normOldProd) {
                                rev.productName = trimmedNewProd;
                                piModified = true;
                            }
                            if (Array.isArray(rev.productsList)) {
                                rev.productsList.forEach(item => {
                                    const itemFromThisIp = normOldIp ? (normalize(item._fromIp) === normOldIp) : false;
                                    const itemNameMatches = normalize(item.productName) === normOldProd;
                                    if (itemFromThisIp || itemNameMatches) {
                                        item.productName = trimmedNewProd;
                                        if (ipChanged && itemFromThisIp) {
                                            item._fromIp = trimmedNewIp;
                                        }
                                        piModified = true;
                                    }
                                });
                            }
                        });
                    }
                }
            }

            if (piModified) {
                await saveEncrypted(doc, pi);
                counts.pis++;
                if (pi.piNumber) affectedPiNumbers.add(cleanLc(pi.piNumber));
            }
        }
    } catch (err) {
        console.error('Error cascading IP update to PI:', err);
    }

    // 2. UPDATE LC MANAGEMENT
    try {
        const lcDocs = await LCManagement.find({});
        for (const doc of lcDocs) {
            const lc = getDecrypted(doc);
            if (!lc) continue;

            let lcModified = false;

            const lcIps = [
                lc.ipNo,
                ...(Array.isArray(lc.ipNumbers) ? lc.ipNumbers : []),
                ...(typeof lc.ipNo === 'string' ? lc.ipNo.split(',').map(s => s.trim()) : [])
            ].filter(Boolean).map(normalize);

            const lcPiClean = cleanLc(lc.piNo);
            const isLinkedViaIp = normOldIp && lcIps.includes(normOldIp);
            const isLinkedViaPi = lcPiClean && affectedPiNumbers.has(lcPiClean);

            if (isLinkedViaIp || isLinkedViaPi) {
                // If IP number changed
                if (ipChanged && isLinkedViaIp) {
                    if (normalize(lc.ipNo) === normOldIp) {
                        lc.ipNo = trimmedNewIp;
                        lcModified = true;
                    }
                    if (Array.isArray(lc.ipNumbers)) {
                        lc.ipNumbers = lc.ipNumbers.map(n => normalize(n) === normOldIp ? trimmedNewIp : n);
                        lcModified = true;
                    }
                }

                // If product name changed
                if (prodChanged) {
                    if (normalize(lc.productName) === normOldProd) {
                        lc.productName = trimmedNewProd;
                        lcModified = true;
                    }
                    if (normalize(lc.product) === normOldProd) {
                        lc.product = trimmedNewProd;
                        lcModified = true;
                    }

                    if (Array.isArray(lc.productsList)) {
                        lc.productsList.forEach(item => {
                            if (normalize(item.productName) === normOldProd || (lc.productsList.length === 1 && !item.productName)) {
                                item.productName = trimmedNewProd;
                                lcModified = true;
                            }
                        });
                    }

                    // Update amendments if present
                    if (Array.isArray(lc.amendments)) {
                        lc.amendments.forEach(amd => {
                            if (normalize(amd.productName) === normOldProd) {
                                amd.productName = trimmedNewProd;
                                lcModified = true;
                            }
                            if (Array.isArray(amd.productsList)) {
                                amd.productsList.forEach(item => {
                                    if (normalize(item.productName) === normOldProd) {
                                        item.productName = trimmedNewProd;
                                        lcModified = true;
                                    }
                                });
                            }
                        });
                    }
                }
            }

            if (lcModified) {
                await saveEncrypted(doc, lc);
                counts.lcs++;
                if (lc.lcNo) affectedLcNumbers.add(cleanLc(lc.lcNo));
            }
        }
    } catch (err) {
        console.error('Error cascading IP update to LCManagement:', err);
    }

    // 3. UPDATE PACKING LISTS
    try {
        const plDocs = await PackingList.find({});
        for (const doc of plDocs) {
            const pl = getDecrypted(doc);
            if (!pl) continue;

            let plModified = false;

            const plLcClean = cleanLc(pl.lcNumber || pl.lcNo);
            const plPiClean = cleanLc(pl.piNumber || pl.piNo);
            const plIps = [
                pl.ipNo,
                ...(Array.isArray(pl.ipNumbers) ? pl.ipNumbers : [])
            ].filter(Boolean).map(normalize);

            const isLinked = (normOldIp && plIps.includes(normOldIp)) ||
                (plLcClean && affectedLcNumbers.has(plLcClean)) ||
                (plPiClean && affectedPiNumbers.has(plPiClean));

            if (isLinked) {
                if (ipChanged && normOldIp && plIps.includes(normOldIp)) {
                    if (normalize(pl.ipNo) === normOldIp) {
                        pl.ipNo = trimmedNewIp;
                        plModified = true;
                    }
                    if (Array.isArray(pl.ipNumbers)) {
                        pl.ipNumbers = pl.ipNumbers.map(n => normalize(n) === normOldIp ? trimmedNewIp : n);
                        plModified = true;
                    }
                }

                if (prodChanged) {
                    if (normalize(pl.productName) === normOldProd) {
                        pl.productName = trimmedNewProd;
                        plModified = true;
                    }

                    if (Array.isArray(pl.productsList)) {
                        pl.productsList.forEach(item => {
                            if (normalize(item.productName) === normOldProd || (pl.productsList.length === 1 && !item.productName)) {
                                item.productName = trimmedNewProd;
                                plModified = true;
                            }
                        });
                    }
                }
            }

            if (plModified) {
                await saveEncrypted(doc, pl);
                counts.packingLists++;
            }
        }
    } catch (err) {
        console.error('Error cascading IP update to PackingList:', err);
    }

    // 4. UPDATE STOCK RECORDS
    if (prodChanged && affectedLcNumbers.size > 0) {
        try {
            const stockDocs = await Stock.find({});
            for (const doc of stockDocs) {
                const stock = getDecrypted(doc);
                if (!stock) continue;

                const stockLcClean = cleanLc(stock.lcNo);
                if (stockLcClean && affectedLcNumbers.has(stockLcClean)) {
                    if (normalize(stock.productName || stock.product) === normOldProd) {
                        if (stock.productName) stock.productName = trimmedNewProd;
                        if (stock.product) stock.product = trimmedNewProd;
                        await saveEncrypted(doc, stock);
                        counts.stocks++;
                    }
                }
            }
        } catch (err) {
            console.error('Error cascading IP update to Stock:', err);
        }
    }

    return { status: 'success', counts };
}

/**
 * When a Product (name, ipName, hsCode, hsCodeInd) is edited in Product Management,
 * cascade to all matching IP records, PIs, LCs, Packing Lists, Stock, Sales, Orders, Purchases, and Purchase Receives.
 */
async function cascadeProductUpdate({ productId, oldProduct = {}, newProduct = {} }) {
    const oldName = (oldProduct.name || '').trim();
    const newName = (newProduct.name || '').trim();
    const oldIpName = (oldProduct.ipName || '').trim();
    const newIpName = (newProduct.ipName || '').trim();
    const oldHsCode = (oldProduct.hsCode || '').trim();
    const newHsCode = (newProduct.hsCode || '').trim();
    const oldHsCodeInd = (oldProduct.hsCodeInd || '').trim();
    const newHsCodeInd = (newProduct.hsCodeInd || '').trim();

    const targetIpName = (newIpName || newName).trim();
    const oldNameCandidates = new Set([
        oldIpName,
        oldName,
        newProduct.name
    ].filter(Boolean).map(normalize));

    // Support root terms (e.g., BRAN <-> WHEAT BRAN)
    if (normalize(targetIpName).includes('wheat bran') || Array.from(oldNameCandidates).some(n => n.includes('wheat bran') || n === 'bran')) {
        oldNameCandidates.add('wheat bran');
        oldNameCandidates.add('bran');
    }

    const counts = {
        ips: 0,
        pis: 0,
        lcs: 0,
        packingLists: 0,
        stocks: 0,
        sales: 0,
        orders: 0,
        purchases: 0,
        purchaseReceives: 0
    };

    const affectedIpNumbers = new Set();
    const affectedPiNumbers = new Set();
    const affectedLcNumbers = new Set();

    // 1. UPDATE IP RECORDS
    if (targetIpName) {
        try {
            const ipDocs = await IpRecord.find({});
            for (const doc of ipDocs) {
                const ip = getDecrypted(doc);
                if (!ip) continue;

                let ipModified = false;
                const normIpProd = normalize(ip.productName);

                const matchesOldName = oldNameCandidates.has(normIpProd);
                const matchesHs = newHsCode && ip.hsCode === newHsCode;

                if ((matchesOldName || (matchesHs && normIpProd.includes(normalize(oldName)))) && normIpProd !== normalize(targetIpName)) {
                    ip.productName = targetIpName;
                    ipModified = true;
                }

                if (newHsCode && ip.hsCode && ip.hsCode !== newHsCode && (matchesOldName || normIpProd === normalize(targetIpName))) {
                    ip.hsCode = newHsCode;
                    ipModified = true;
                }

                if (ipModified) {
                    await saveEncrypted(doc, ip);
                    counts.ips++;
                    if (ip.ipNumber) affectedIpNumbers.add(normalize(ip.ipNumber));
                } else if (normIpProd === normalize(targetIpName) && ip.ipNumber) {
                    affectedIpNumbers.add(normalize(ip.ipNumber));
                }
            }
        } catch (err) {
            console.error('Error cascading product update to IP records:', err);
        }
    }

    // 2. UPDATE PIs
    try {
        const piDocs = await PI.find({});
        for (const doc of piDocs) {
            const pi = getDecrypted(doc);
            if (!pi) continue;

            let piModified = false;
            const piIps = [
                pi.ipNumber,
                ...(Array.isArray(pi.ipNumbers) ? pi.ipNumbers : [])
            ].filter(Boolean).map(normalize);

            const isLinkedToAffectedIp = piIps.some(ip => affectedIpNumbers.has(ip));
            const normPiProd = normalize(pi.productName);
            const matchesPiName = oldNameCandidates.has(normPiProd);

            if (targetIpName && (matchesPiName || isLinkedToAffectedIp) && normPiProd !== normalize(targetIpName)) {
                pi.productName = targetIpName;
                piModified = true;
            }

            if (Array.isArray(pi.productsList)) {
                pi.productsList.forEach(item => {
                    const normItemProd = normalize(item.productName);
                    const itemIp = normalize(item._fromIp || item.ipNumber);
                    const itemLinked = itemIp && affectedIpNumbers.has(itemIp);
                    const itemMatchesName = oldNameCandidates.has(normItemProd);
                    const itemMatchesHs = (newHsCode && item.hsCode === newHsCode) || (oldHsCode && item.hsCode === oldHsCode);

                    if (targetIpName && (itemLinked || itemMatchesName || (itemMatchesHs && (normItemProd.includes(normalize(oldName)) || normItemProd.includes('bran'))))) {
                        if (normItemProd !== normalize(targetIpName)) {
                            item.productName = targetIpName;
                            piModified = true;
                        }
                        if (newHsCode && item.hsCode !== newHsCode) {
                            item.hsCode = newHsCode;
                            piModified = true;
                        }
                        if (newHsCodeInd && item.hsCodeInd !== newHsCodeInd) {
                            item.hsCodeInd = newHsCodeInd;
                            piModified = true;
                        }
                    }
                });
            }

            if (Array.isArray(pi.revisions)) {
                pi.revisions.forEach(rev => {
                    const normRevProd = normalize(rev.productName);
                    if (targetIpName && (oldNameCandidates.has(normRevProd) || isLinkedToAffectedIp) && normRevProd !== normalize(targetIpName)) {
                        rev.productName = targetIpName;
                        piModified = true;
                    }
                    if (Array.isArray(rev.productsList)) {
                        rev.productsList.forEach(item => {
                            const normItemProd = normalize(item.productName);
                            const itemIp = normalize(item._fromIp || item.ipNumber);
                            const itemLinked = itemIp && affectedIpNumbers.has(itemIp);
                            const itemMatchesName = oldNameCandidates.has(normItemProd);
                            const itemMatchesHs = (newHsCode && item.hsCode === newHsCode) || (oldHsCode && item.hsCode === oldHsCode);

                            if (targetIpName && (itemLinked || itemMatchesName || (itemMatchesHs && (normItemProd.includes(normalize(oldName)) || normItemProd.includes('bran'))))) {
                                if (normItemProd !== normalize(targetIpName)) {
                                    item.productName = targetIpName;
                                    piModified = true;
                                }
                                if (newHsCode && item.hsCode !== newHsCode) {
                                    item.hsCode = newHsCode;
                                    piModified = true;
                                }
                                if (newHsCodeInd && item.hsCodeInd !== newHsCodeInd) {
                                    item.hsCodeInd = newHsCodeInd;
                                    piModified = true;
                                }
                            }
                        });
                    }
                });
            }

            if (piModified) {
                await saveEncrypted(doc, pi);
                counts.pis++;
            }
            if (pi.piNumber) {
                affectedPiNumbers.add(cleanLc(pi.piNumber));
            }
        }
    } catch (err) {
        console.error('Error cascading product update to PI:', err);
    }

    // 3. UPDATE LC MANAGEMENT
    try {
        const lcDocs = await LCManagement.find({});
        for (const doc of lcDocs) {
            const lc = getDecrypted(doc);
            if (!lc) continue;

            let lcModified = false;
            const lcIps = [
                lc.ipNo,
                ...(Array.isArray(lc.ipNumbers) ? lc.ipNumbers : []),
                ...(typeof lc.ipNo === 'string' ? lc.ipNo.split(',').map(s => s.trim()) : [])
            ].filter(Boolean).map(normalize);

            const lcPiClean = cleanLc(lc.piNo);
            const isLinkedViaIp = lcIps.some(ip => affectedIpNumbers.has(ip));
            const isLinkedViaPi = lcPiClean && affectedPiNumbers.has(lcPiClean);

            const normLcProd = normalize(lc.productName || lc.product);
            const matchesLcName = oldNameCandidates.has(normLcProd);

            if (targetIpName && (matchesLcName || isLinkedViaIp || isLinkedViaPi)) {
                if (lc.productName && normalize(lc.productName) !== normalize(targetIpName)) {
                    lc.productName = targetIpName;
                    lcModified = true;
                }
                if (lc.product && normalize(lc.product) !== normalize(targetIpName)) {
                    lc.product = targetIpName;
                    lcModified = true;
                }
            }

            if (Array.isArray(lc.productsList)) {
                lc.productsList.forEach(item => {
                    const normItemProd = normalize(item.productName);
                    const itemMatchesName = oldNameCandidates.has(normItemProd);
                    const itemMatchesHs = (newHsCode && item.hsCode === newHsCode) || (oldHsCode && item.hsCode === oldHsCode);

                    if (targetIpName && (isLinkedViaIp || isLinkedViaPi || itemMatchesName || (itemMatchesHs && (normItemProd.includes(normalize(oldName)) || normItemProd.includes('bran'))))) {
                        if (normItemProd !== normalize(targetIpName)) {
                            item.productName = targetIpName;
                            lcModified = true;
                        }
                        if (newHsCode && item.hsCode !== newHsCode) {
                            item.hsCode = newHsCode;
                            lcModified = true;
                        }
                    }
                });
            }

            if (Array.isArray(lc.amendments)) {
                lc.amendments.forEach(amd => {
                    const normAmdProd = normalize(amd.productName);
                    if (targetIpName && (oldNameCandidates.has(normAmdProd) || isLinkedViaIp || isLinkedViaPi) && normAmdProd !== normalize(targetIpName)) {
                        amd.productName = targetIpName;
                        lcModified = true;
                    }
                    if (Array.isArray(amd.productsList)) {
                        amd.productsList.forEach(item => {
                            const normItemProd = normalize(item.productName);
                            if (targetIpName && (oldNameCandidates.has(normItemProd) || isLinkedViaIp || isLinkedViaPi) && normItemProd !== normalize(targetIpName)) {
                                item.productName = targetIpName;
                                lcModified = true;
                            }
                        });
                    }
                });
            }

            if (lcModified) {
                await saveEncrypted(doc, lc);
                counts.lcs++;
            }
            if (lc.lcNo) {
                affectedLcNumbers.add(cleanLc(lc.lcNo));
            }
        }
    } catch (err) {
        console.error('Error cascading product update to LCManagement:', err);
    }

    // 4. UPDATE PACKING LISTS
    try {
        const plDocs = await PackingList.find({});
        for (const doc of plDocs) {
            const pl = getDecrypted(doc);
            if (!pl) continue;

            let plModified = false;
            const plLcClean = cleanLc(pl.lcNumber || pl.lcNo);
            const plPiClean = cleanLc(pl.piNumber || pl.piNo);
            const plIps = [
                pl.ipNo,
                ...(Array.isArray(pl.ipNumbers) ? pl.ipNumbers : [])
            ].filter(Boolean).map(normalize);

            const isLinked = plIps.some(ip => affectedIpNumbers.has(ip)) ||
                (plLcClean && affectedLcNumbers.has(plLcClean)) ||
                (plPiClean && affectedPiNumbers.has(plPiClean));

            const normPlProd = normalize(pl.productName);
            if (targetIpName && (isLinked || oldNameCandidates.has(normPlProd)) && normPlProd !== normalize(targetIpName)) {
                pl.productName = targetIpName;
                plModified = true;
            }

            if (Array.isArray(pl.productsList)) {
                pl.productsList.forEach(item => {
                    const normItemProd = normalize(item.productName);
                    if (targetIpName && (isLinked || oldNameCandidates.has(normItemProd)) && normItemProd !== normalize(targetIpName)) {
                        item.productName = targetIpName;
                        plModified = true;
                    }
                    if (newHsCode && (isLinked || oldNameCandidates.has(normItemProd)) && item.hsCode !== newHsCode) {
                        item.hsCode = newHsCode;
                        plModified = true;
                    }
                });
            }

            if (plModified) {
                await saveEncrypted(doc, pl);
                counts.packingLists++;
            }
        }
    } catch (err) {
        console.error('Error cascading product update to PackingList:', err);
    }

    // 5. UPDATE STOCK RECORDS
    try {
        const stockDocs = await Stock.find({});
        for (const doc of stockDocs) {
            const stock = getDecrypted(doc);
            if (!stock) continue;

            let stockModified = false;
            const stockLcClean = cleanLc(stock.lcNo);
            const isLinkedToLc = stockLcClean && affectedLcNumbers.has(stockLcClean);

            const normStockProd = normalize(stock.productName || stock.product);
            const matchesStockName = oldNameCandidates.has(normStockProd);

            if (targetIpName && (isLinkedToLc || matchesStockName)) {
                if (stock.productName && normalize(stock.productName) !== normalize(targetIpName)) {
                    stock.productName = targetIpName;
                    stockModified = true;
                }
                if (stock.product && normalize(stock.product) !== normalize(targetIpName)) {
                    stock.product = targetIpName;
                    stockModified = true;
                }
            }

            if (stockModified) {
                await saveEncrypted(doc, stock);
                counts.stocks++;
            }
        }
    } catch (err) {
        console.error('Error cascading product update to Stock:', err);
    }

    // 6. UPDATE SALES & ORDERS (if main ERP product `name` changed)
    if (oldName && newName && normalize(oldName) !== normalize(newName)) {
        try {
            const saleDocs = await Sale.find({});
            for (const doc of saleDocs) {
                const s = getDecrypted(doc);
                if (!s) continue;

                let saleModified = false;
                if (Array.isArray(s.items)) {
                    s.items.forEach(item => {
                        const itemProd = (item.productName || item.product || '').trim();
                        if (normalize(itemProd) === normalize(oldName)) {
                            if (item.productName !== undefined) item.productName = newName;
                            if (item.product !== undefined) item.product = newName;
                            if (newProduct.category) item.category = newProduct.category;
                            saleModified = true;
                        }
                    });
                }

                if (saleModified) {
                    await saveEncrypted(doc, s);
                    if (s.invoiceNo?.startsWith('ORD') || s.orderNo) {
                        counts.orders++;
                    } else {
                        counts.sales++;
                    }
                }
            }
        } catch (err) {
            console.error('Error cascading product name to Sales/Orders:', err);
        }

        // Purchases
        try {
            const purchaseDocs = await Purchase.find({});
            for (const doc of purchaseDocs) {
                const p = getDecrypted(doc);
                if (!p) continue;
                let purModified = false;
                if (Array.isArray(p.items)) {
                    p.items.forEach(item => {
                        const itemProd = (item.productName || item.product || '').trim();
                        if (normalize(itemProd) === normalize(oldName)) {
                            if (item.productName !== undefined) item.productName = newName;
                            if (item.product !== undefined) item.product = newName;
                            purModified = true;
                        }
                    });
                }
                if (purModified) {
                    await saveEncrypted(doc, p);
                    counts.purchases++;
                }
            }
        } catch (err) {
            console.error('Error cascading product name to Purchases:', err);
        }

        // Purchase Receives
        try {
            const prDocs = await PurchaseReceive.find({});
            for (const doc of prDocs) {
                const pr = getDecrypted(doc);
                if (!pr) continue;
                let prModified = false;
                if (Array.isArray(pr.items)) {
                    pr.items.forEach(item => {
                        const itemProd = (item.productName || item.product || '').trim();
                        if (normalize(itemProd) === normalize(oldName)) {
                            if (item.productName !== undefined) item.productName = newName;
                            if (item.product !== undefined) item.product = newName;
                            prModified = true;
                        }
                    });
                }
                if (prModified) {
                    await saveEncrypted(doc, pr);
                    counts.purchaseReceives++;
                }
            }
        } catch (err) {
            console.error('Error cascading product name to PurchaseReceives:', err);
        }
    }

    return { status: 'success', counts };
}

/**
 * Backward-compatible wrapper for single IP name update
 */
async function cascadeProductIpNameUpdate({ oldIpName, newIpName }) {
    return cascadeProductUpdate({
        oldProduct: { ipName: oldIpName },
        newProduct: { ipName: newIpName }
    });
}

/**
 * One-time or on-demand repair/sync function that reconciles all PIs, LCs,
 * Packing Lists, and Stock records with the current productName of their linked IP.
 */
async function syncAllIpProductNames() {
    const counts = { pis: 0, lcs: 0, packingLists: 0, stocks: 0 };
    try {
        const ipDocs = await IpRecord.find({}).lean();
        const ipMap = {};
        ipDocs.forEach(r => {
            const d = getDecrypted(r);
            if (d && d.ipNumber) {
                ipMap[normalize(d.ipNumber)] = (d.productName || '').trim();
            }
        });

        // Sync PIs
        const piDocs = await PI.find({});
        for (const doc of piDocs) {
            const pi = getDecrypted(doc);
            if (!pi) continue;
            let modified = false;

            const ipNo = normalize(pi.ipNumber);
            const currentIpProd = ipMap[ipNo];
            if (ipNo && currentIpProd) {
                if (pi.productName && normalize(pi.productName) !== normalize(currentIpProd)) {
                    pi.productName = currentIpProd;
                    modified = true;
                }
            }

            if (Array.isArray(pi.productsList)) {
                pi.productsList.forEach(item => {
                    const itemIp = normalize(item._fromIp || pi.ipNumber);
                    if (itemIp && ipMap[itemIp]) {
                        const expected = ipMap[itemIp];
                        if (item.productName && normalize(item.productName) !== normalize(expected)) {
                            item.productName = expected;
                            modified = true;
                        }
                    }
                });
            }

            if (modified) {
                await saveEncrypted(doc, pi);
                counts.pis++;
            }
        }

        // Sync LCs
        const lcDocs = await LCManagement.find({});
        for (const doc of lcDocs) {
            const lc = getDecrypted(doc);
            if (!lc) continue;
            let modified = false;

            const ipNo = normalize(lc.ipNo || (Array.isArray(lc.ipNumbers) ? lc.ipNumbers[0] : ''));
            const currentIpProd = ipMap[ipNo];
            if (ipNo && currentIpProd) {
                if (lc.productName && normalize(lc.productName) !== normalize(currentIpProd)) {
                    lc.productName = currentIpProd;
                    modified = true;
                }
                if (lc.product && normalize(lc.product) !== normalize(currentIpProd)) {
                    lc.product = currentIpProd;
                    modified = true;
                }
                if (Array.isArray(lc.productsList)) {
                    lc.productsList.forEach(item => {
                        if (item.productName && normalize(item.productName) !== normalize(currentIpProd)) {
                            item.productName = currentIpProd;
                            modified = true;
                        }
                    });
                }
            }

            if (modified) {
                await saveEncrypted(doc, lc);
                counts.lcs++;
            }
        }

        // Sync PackingLists
        const plDocs = await PackingList.find({});
        for (const doc of plDocs) {
            const pl = getDecrypted(doc);
            if (!pl) continue;
            let modified = false;

            const ipNo = normalize(pl.ipNo || (Array.isArray(pl.ipNumbers) ? pl.ipNumbers[0] : ''));
            const currentIpProd = ipMap[ipNo];
            if (ipNo && currentIpProd) {
                if (pl.productName && normalize(pl.productName) !== normalize(currentIpProd)) {
                    pl.productName = currentIpProd;
                    modified = true;
                }
                if (Array.isArray(pl.productsList)) {
                    pl.productsList.forEach(item => {
                        if (item.productName && normalize(item.productName) !== normalize(currentIpProd)) {
                            item.productName = currentIpProd;
                            modified = true;
                        }
                    });
                }
            }

            if (modified) {
                await saveEncrypted(doc, pl);
                counts.packingLists++;
            }
        }

        // Sync Stocks
        const stockDocs = await Stock.find({});
        for (const doc of stockDocs) {
            const stock = getDecrypted(doc);
            if (!stock) continue;
            let modified = false;

            const ipNo = normalize(stock.ipNo || stock.ipNumber);
            const currentIpProd = ipMap[ipNo];
            if (ipNo && currentIpProd) {
                if (stock.productName && normalize(stock.productName) !== normalize(currentIpProd)) {
                    stock.productName = currentIpProd;
                    modified = true;
                }
                if (stock.product && normalize(stock.product) !== normalize(currentIpProd)) {
                    stock.product = currentIpProd;
                    modified = true;
                }
            }

            if (modified) {
                await saveEncrypted(doc, stock);
                counts.stocks++;
            }
        }
    } catch (err) {
        console.error('Error in syncAllIpProductNames:', err);
    }
    return { status: 'success', counts };
}

module.exports = {
    cascadeIpUpdate,
    cascadeProductUpdate,
    cascadeProductIpNameUpdate,
    syncAllIpProductNames
};
