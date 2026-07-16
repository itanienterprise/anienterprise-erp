const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

const SECRET_KEY = 'ani1820';

function decryptData(ciphertext) {
    if (!ciphertext) return ciphertext;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;
    } catch (error) {
        return null;
    }
}

const backupPath = path.join(__dirname, '../../../server/backups/auto_backup_2026-07-15_19-00-14.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const stockRecords = (backup.data.Stock || []).map(s => decryptData(s.data)).filter(Boolean);
const warehouseData = (backup.data.Warehouse || []).map(w => decryptData(w.data)).filter(Boolean);
const salesRecords = (backup.data.Sale || []).map(s => decryptData(s.data)).filter(Boolean);
const products = (backup.data.Product || []).map(p => decryptData(p.data)).filter(Boolean);
const damages = (backup.data.Damage || []).map(d => decryptData(d.data)).filter(Boolean);

console.log(`Loaded and decrypted:
  Stocks: ${stockRecords.length}
  Warehouses: ${warehouseData.length}
  Sales: ${salesRecords.length}
  Products: ${products.length}
  Damages: ${damages.length}
`);

// Paste the calculateStockData function here
const safeParse = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

const resolveQuality = (pName, bName) => {
    if (!products || !Array.isArray(products)) return '-';
    const targetP = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === (pName || '').trim().toLowerCase());
    if (!targetP) return '-';
    if (bName) {
        const targetB = (targetP.brands || []).find(b => (b.brand || '').trim().toLowerCase() === (bName || '').trim().toLowerCase());
        if (targetB && targetB.quality && targetB.quality.trim() !== '') return targetB.quality.trim();
    }
    if (targetP.quality && targetP.quality.trim() !== '') return targetP.quality.trim();
    return '-';
};

const calculatePktRemainder = (qty, pktSize) => {
    const size = parseFloat(pktSize) || 30;
    if (size <= 0) return { whole: 0, remainder: 0 };
    const w = Math.trunc(qty / size);
    const r = Math.round(qty % size);
    return { whole: w, remainder: r };
};

const getGroupedBrandList = (brandList) => {
    if (!brandList) return [];
    return brandList;
};

// Copy from client/src/utils/stockHelpers.js
const calculateStockData = (stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = [], products = [], damages = []) => {
    const isWhFilter = stockFilters.warehouse && stockFilters.warehouse.trim().toLowerCase() !== 'all warehouses';

    const rawExpanded = [];
    const seenRecords = new Set();
    const consumedSales = new Set(); 
    const consumedDamages = new Set(); 

    stockRecords.forEach(item => {
        const itemStatus = (item.status || '').toLowerCase();
        if (itemStatus.includes('requested') || itemStatus.includes('rejected')) return;

        if (item.brandEntries && item.brandEntries.length > 0) {
            item.brandEntries.forEach((entry, idx) => {
                const uniqueId = `${item._id}_brand_${idx}`;
                if (seenRecords.has(uniqueId)) return;
                seenRecords.add(uniqueId);

                rawExpanded.push({
                    ...item,
                    _id: uniqueId,
                    brand: entry.brand || item.brand || '',
                    quality: (() => {
                        const rq = resolveQuality(item.productName || item.product, entry.brand || item.brand);
                        return rq !== '-' ? rq : (entry.quality || item.quality || '-');
                    })(),
                    productName: item.productName || item.product || '',
                    warehouse: item.warehouse || item.whName || '',
                    quantity: safeParse(entry.quantity ?? item.quantity),
                    packet: safeParse(entry.packet ?? item.packet),
                    packetSize: safeParse(entry.packetSize ?? item.packetSize),
                    inHousePacket: safeParse(entry.inHousePacket ?? entry.inhousePkt ?? item.inHousePacket),
                    inHouseQuantity: safeParse(entry.inHouseQuantity ?? entry.inhouseQty ?? item.inHouseQuantity),
                    sweepedPacket: safeParse(entry.sweepedPacket) || safeParse(entry.shortagePkt) || safeParse(item.sweepedPacket),
                    sweepedQuantity: safeParse(entry.sweepedQuantity) || safeParse(entry.shortageQty) || safeParse(item.sweepedQuantity),
                    purchasedPrice: safeParse(entry.purchasedPrice ?? item.purchasedPrice ?? entry.rate ?? item.rate),
                    unit: entry.unit || item.unit,
                    recordType: 'stock'
                });
            });
        } else {
            if (seenRecords.has(item._id)) return;
            seenRecords.add(item._id);
            const q = (() => {
                const rq = resolveQuality(item.productName || item.product, item.brand);
                return rq !== '-' ? rq : (item.quality || '-');
            })();
            rawExpanded.push({
                ...item,
                recordType: 'stock',
                quality: q,
                purchasedPrice: safeParse(item.purchasedPrice ?? item.rate),
                inHouseQuantity: safeParse(item.inHouseQuantity ?? item.inhouseQty ?? item.quantity),
                inHousePacket: safeParse(item.inHousePacket ?? item.inhousePkt ?? item.packet)
            });
        }
    });

    warehouseData.forEach(whItem => {
        if (!whItem || whItem.isTransferLog) return;
        if ((whItem.location || '').trim().toLowerCase() === 'returned stock') return;
        if (whItem.recordType !== 'warehouse' && !whItem.productName && !whItem.product) return;
        if (seenRecords.has(whItem._id)) return;
        seenRecords.add(whItem._id);

        let resolvedPktSize = safeParse(whItem.packetSize ?? whItem.size);
        if (resolvedPktSize <= 0 && Array.isArray(products)) {
            const pName = (whItem.productName || whItem.product || '').trim().toLowerCase();
            const productMatch = products.find(p =>
                (p.name || '').trim().toLowerCase() === pName ||
                (p.productName || '').trim().toLowerCase() === pName
            );
            if (productMatch) resolvedPktSize = safeParse(productMatch.packetSize || productMatch.size);
        }

        rawExpanded.push({
            ...whItem,
            date: whItem.date || whItem.createdAt || new Date().toISOString(),
            productName: whItem.productName || whItem.product || '',
            warehouse: whItem.whName || whItem.warehouse || '',
            quality: (() => {
                const rq = resolveQuality(whItem.productName || whItem.product, whItem.brand);
                return rq !== '-' ? rq : (whItem.quality || '-');
            })(),
            purchasedPrice: safeParse(whItem.purchasedPrice ?? whItem.rate),
            quantity: safeParse(whItem.whQty ?? whItem.quantity),
            packet: safeParse(whItem.whPkt ?? whItem.packet),
            inHouseQuantity: safeParse(whItem.whQty ?? whItem.inHouseQuantity),
            inHousePacket: safeParse(whItem.whPkt ?? whItem.inHousePacket),
            packetSize: resolvedPktSize || 30,
            unit: whItem.unit || 'kg',
            recordType: 'warehouse'
        });
    });

    const startDate = stockFilters.startDate || '';
    const endDate = stockFilters.endDate || '';

    const filteredRecords = rawExpanded.filter(item => {
        const itemDateOnly = (item.date || '').split('T')[0];
        if (endDate && itemDateOnly > endDate) return false;
        if (stockFilters.lcNo && (item.lcNo || '').trim() !== stockFilters.lcNo) return false;
        if (isWhFilter) {
            const filterWH = stockFilters.warehouse.trim().toLowerCase();
            const itemWH = (item.whName || item.warehouse || '').trim().toLowerCase();
            if (!itemWH || (itemWH !== filterWH && !itemWH.includes(filterWH) && !filterWH.includes(itemWH))) return false;
        }
        if (stockFilters.brand) {
            const itemBrand = (item.brand || '').trim().toLowerCase();
            if (Array.isArray(stockFilters.brand)) {
                if (stockFilters.brand.length > 0 && !stockFilters.brand.map(b => b.toLowerCase().trim()).includes(itemBrand)) return false;
            } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                const selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase());
                if (!selectedBrands.includes(itemBrand)) return false;
            }
        }
        if (stockFilters.productName) {
            const itemName = (item.productName || item.product || '').trim().toLowerCase();
            if (Array.isArray(stockFilters.productName)) {
                if (stockFilters.productName.length > 0 && !stockFilters.productName.map(p => p.toLowerCase().trim()).includes(itemName)) return false;
            } else if (typeof stockFilters.productName === 'string' && stockFilters.productName.trim() !== '') {
                const selectedProds = stockFilters.productName.split(',').map(p => p.trim().toLowerCase());
                if (!selectedProds.includes(itemName)) return false;
            }
        }
        if (stockSearchQuery) {
            const q = stockSearchQuery.toLowerCase();
            return (item.brand || '').toLowerCase().includes(q) ||
                (item.productName || item.product || '').toLowerCase().includes(q) ||
                (item.lcNo || '').toLowerCase().includes(q);
        }
        return true;
    });

    const groupedStock = filteredRecords.reduce((acc, item) => {
        const key = (item.productName || item.product || 'Unknown').trim();
        const keyLower = key.toLowerCase();
        const itemDateOnly = (item.date || '').split('T')[0];
        const isBefore = startDate && itemDateOnly < startDate;

        if (!acc[key]) {
            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === keyLower);
            acc[key] = {
                productName: key,
                productRef: product,
                category: product ? product.category : '',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                damagePacket: 0, damageQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                unit: item.unit || 'kg',
                brands: {}, allIds: []
            };
        }

        const normBrand = (item.brand || 'No Brand').trim().toLowerCase();
        const normQuality = (item.quality || '-').trim().toLowerCase();
        const isPriceReport = stockFilters && stockFilters.reportType === 'price';
        const subKey = isPriceReport
            ? `${normQuality}_${normBrand}_${(item.lcNo || 'no-lc').trim().toLowerCase()}_${item.purchasedPrice || 0}`
            : `${normQuality}_${normBrand}`;

        if (!acc[key].brands[subKey]) {
            acc[key].brands[subKey] = {
                brand: item.brand || 'No Brand',
                quality: item.quality || '-',
                openingPacket: 0, openingQuantity: 0,
                periodArrivalPacket: 0, periodArrivalQuantity: 0,
                salePacket: 0, saleQuantity: 0,
                sweepedPacket: 0, sweepedQuantity: 0,
                damagePacket: 0, damageQuantity: 0,
                inHousePacket: 0, inHouseQuantity: 0,
                packetSize: safeParse(item.packetSize),
                _salesResolved: false,
                _damagesResolved: false,
                lcNos: item.lcNo ? [item.lcNo] : [],
                lcNo: item.lcNo || '',
                purchasedPrice: item.purchasedPrice || 0
            };
        } else {
            if (item.lcNo && !acc[key].brands[subKey].lcNos.includes(item.lcNo)) {
                acc[key].brands[subKey].lcNos.push(item.lcNo);
            }
        }

        const brandObj = acc[key].brands[subKey];

        if (!brandObj._salesResolved) {
            salesRecords.forEach(sale => {
                const sStatus = (sale.status || '').toLowerCase();
                if (sStatus !== 'accepted' && sStatus !== 'pending') return;
                const sDate = (sale.date || sale.createdAt || '').split('T')[0];
                if (endDate && sDate > endDate) return;
                const isBeforeSale = startDate && sDate < startDate;

                (sale.items || []).forEach((si, siIdx) => {
                    const siName = (si.productName || si.product || '').trim().toLowerCase();
                    if (siName === keyLower) {
                        (si.brandEntries || []).forEach((be, beIdx) => {
                            const beBrand = (be.brand || 'No Brand').trim().toLowerCase();
                            const rq = resolveQuality(siName, be.brand);
                            let beQualityRaw = rq !== '-' ? rq : (be.quality || '-');
                            let beQuality = beQualityRaw.trim().toLowerCase();

                            if (beBrand === normBrand && beQuality === '-' && normQuality !== '-') {
                                beQuality = normQuality;
                            }

                            if (beBrand === normBrand && beQuality === normQuality) {
                                const saleLc = ((be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '')).trim().toLowerCase();
                                if (isPriceReport) {
                                    const stockLc = (item.lcNo || '').trim().toLowerCase();
                                    if (saleLc !== stockLc) return;
                                }
                                if (stockFilters.lcNo && saleLc !== stockFilters.lcNo.toLowerCase()) return;

                                const saleEntryId = `${sale._id}_${siIdx}_${beIdx}`;
                                if (consumedSales.has(saleEntryId)) return;

                                const saleWH = (be.warehouseName || si.whName || si.warehouse || sale.warehouse || sale.whName || '').trim().toLowerCase();
                                if (isWhFilter && saleWH !== stockFilters.warehouse.toLowerCase()) return;

                                const sq = safeParse(be.quantity);
                                let sp = safeParse(be.packet);
                                if (sp <= 0 && sq > 0) {
                                    const pSize = brandObj.packetSize || 30;
                                    sp = sq / pSize;
                                }

                                consumedSales.add(saleEntryId);
                                if (isBeforeSale) {
                                    brandObj.openingQuantity -= sq;
                                    brandObj.openingPacket -= sp;
                                    acc[key].openingQuantity -= sq;
                                    acc[key].openingPacket -= sp;
                                } else {
                                    brandObj.saleQuantity += sq;
                                    brandObj.salePacket += sp;
                                    acc[key].saleQuantity += sq;
                                    acc[key].salePacket += sp;
                                }
                            }
                        });
                    }
                });
            });
            brandObj._salesResolved = true;
        }

        if (!brandObj._damagesResolved) {
            damages.forEach(damage => {
                const dDate = (damage.date || '').split('T')[0];
                if (endDate && dDate > endDate) return;
                const isBefore = startDate && dDate < startDate;
                const dProdName = (damage.productName || '').trim().toLowerCase();
                const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
                const dWh = (damage.warehouse || '').trim().toLowerCase();
                if (dProdName === keyLower && dBrand === normBrand) {
                    if (isPriceReport) {
                        const damageLc = (damage.lcNo || '').trim().toLowerCase();
                        const stockLc = (item.lcNo || '').trim().toLowerCase();
                        if (damageLc !== stockLc) return;
                    }
                    if (stockFilters.lcNo && (damage.lcNo || '').trim().toLowerCase() !== stockFilters.lcNo.toLowerCase()) return;
                    if (isWhFilter) {
                        const filterWH = stockFilters.warehouse.toLowerCase();
                        if (!dWh || (dWh !== filterWH && !dWh.includes(filterWH) && !filterWH.includes(dWh))) return;
                    }

                    const damageEntryId = `${damage._id}`;
                    if (consumedDamages.has(damageEntryId)) return;
                    consumedDamages.add(damageEntryId);

                    const dq = safeParse(damage.quantity);
                    let dp = safeParse(damage.packet) || (brandObj.packetSize > 0 ? dq / brandObj.packetSize : 0);
                    if (isBefore) {
                        brandObj.openingQuantity -= dq;
                        acc[key].openingQuantity -= dq;
                    } else {
                        brandObj.damageQuantity += dq;
                        brandObj.damagePacket += dp;
                        acc[key].damageQuantity += dq;
                    }
                }
            });
            brandObj._damagesResolved = true;
        }

        const qty = safeParse(item.quantity);
        const pkt = safeParse(item.packet);
        const inHouseQty = safeParse(item.inHouseQuantity);
        const inHousePkt = safeParse(item.inHousePacket);
        const sweepedQty = safeParse(item.sweepedQuantity);
        const sweepedPkt = safeParse(item.sweepedPacket);

        if (isBefore) {
            brandObj.openingQuantity += inHouseQty;
            brandObj.openingPacket += inHousePkt;
            acc[key].openingQuantity += inHouseQty;
            acc[key].openingPacket += inHousePkt;
        } else {
            brandObj.periodArrivalQuantity += qty;
            brandObj.periodArrivalPacket += pkt;
            brandObj.sweepedQuantity += sweepedQty;
            brandObj.sweepedPacket += sweepedPkt;

            acc[key].periodArrivalQuantity += qty;
            acc[key].periodArrivalPacket += pkt;
            acc[key].sweepedQuantity += sweepedQty;
            acc[key].sweepedPacket += sweepedPkt;
        }

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

    salesRecords.forEach(sale => {
        const sStatus = (sale.status || '').toLowerCase();
        if (sStatus !== 'accepted' && sStatus !== 'pending') return;
        if (endDate && (sale.date || '').split('T')[0] > endDate) return;

        (sale.items || []).forEach((si, siIdx) => {
            const sProdName = (si.productName || '').trim();
            if (!sProdName) return;

            const product = products.find(p => (p.name || p.productName || '').trim().toLowerCase() === sProdName.toLowerCase());
            if (product?.category?.toLowerCase() !== 'general') return;

            if (stockFilters.productName) {
                const searchName = sProdName.toLowerCase();
                if (Array.isArray(stockFilters.productName)) {
                    if (stockFilters.productName.length > 0 && !stockFilters.productName.map(p => p.toLowerCase().trim()).includes(searchName)) return;
                } else if (typeof stockFilters.productName === 'string' && stockFilters.productName.trim() !== '') {
                    const selectedProds = stockFilters.productName.split(',').map(p => p.trim().toLowerCase());
                    if (!selectedProds.includes(searchName)) return;
                }
            }

            if (!groupedStock[sProdName]) {
                groupedStock[sProdName] = {
                    productName: sProdName, productRef: product, category: 'General',
                    openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                    saleQuantity: 0, salePacket: 0, sweepedPacket: 0, sweepedQuantity: 0,
                    damageQuantity: 0, damagePacket: 0,
                    inHousePacket: 0, inHouseQuantity: 0,
                    unit: si.unit || 'kg', brands: {}, allIds: []
                };
            }
            const group = groupedStock[sProdName];
            (si.brandEntries || []).forEach((be, beIdx) => {
                const saleWH = (be.warehouseName || si.whName || si.warehouse || sale.warehouse || sale.whName || '').trim().toLowerCase();
                if (isWhFilter && saleWH !== stockFilters.warehouse.toLowerCase()) return;

                if (stockFilters.brand) {
                    const itemBrand = (be.brand || '').trim().toLowerCase();
                    if (Array.isArray(stockFilters.brand)) {
                        if (stockFilters.brand.length > 0 && !stockFilters.brand.map(b => b.toLowerCase().trim()).includes(itemBrand)) return;
                    } else if (typeof stockFilters.brand === 'string' && stockFilters.brand.trim() !== '') {
                        const selectedBrands = stockFilters.brand.split(',').map(b => b.trim().toLowerCase());
                        if (!selectedBrands.includes(itemBrand)) return;
                    }
                }

                const normBrand = (be.brand || 'No Brand').trim().toLowerCase();
                const rq = resolveQuality(sProdName, be.brand);
                const resolvedQ = rq !== '-' ? rq : (be.quality || '-');
                const normQuality = resolvedQ.trim().toLowerCase();
                const beLc = ((be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '')).trim();
                const bePrice = parseFloat(be.purchasedPrice) || 0;

                if (stockFilters.lcNo && beLc.toLowerCase() !== stockFilters.lcNo.toLowerCase()) return;

                const isPriceReport = stockFilters && stockFilters.reportType === 'price';
                const subKey = isPriceReport
                    ? `${normQuality}_${normBrand}_${beLc.toLowerCase()}_${bePrice}`
                    : `${normQuality}_${normBrand}`;

                if (!group.brands[subKey]) {
                    let resolvedPktSize = safeParse(be.packetSize);
                    if (resolvedPktSize <= 0 && Array.isArray(products)) {
                        const productMatch = products.find(p =>
                            (p.name || '').trim().toLowerCase() === sProdName.toLowerCase() ||
                            (p.productName || '').trim().toLowerCase() === sProdName.toLowerCase()
                        );
                        if (productMatch) resolvedPktSize = safeParse(productMatch.packetSize || productMatch.size);
                    }
                    if (resolvedPktSize <= 0) resolvedPktSize = 30;

                    group.brands[subKey] = {
                        brand: be.brand || 'No Brand',
                        quality: resolvedQ || '-',
                        openingPacket: 0, openingQuantity: 0, periodArrivalPacket: 0, periodArrivalQuantity: 0,
                        salePacket: 0, saleQuantity: 0, sweepedPacket: 0, sweepedQuantity: 0,
                        damagePacket: 0, damageQuantity: 0,
                        inHousePacket: 0, inHouseQuantity: 0, packetSize: resolvedPktSize,
                        _salesResolved: false,
                        _damagesResolved: false,
                        lcNos: beLc ? [beLc] : [],
                        lcNo: beLc,
                        purchasedPrice: bePrice
                    };
                } else {
                    const saleLC = (be.lcNo !== undefined && be.lcNo !== null) ? be.lcNo : (si.lcNo || sale.lcNo || '');
                    if (saleLC && !group.brands[subKey].lcNos.includes(saleLC)) {
                        group.brands[subKey].lcNos.push(saleLC);
                    }
                }
                const brandObj = group.brands[subKey];

                if (!brandObj._damagesResolved) {
                    damages.forEach(damage => {
                        const dDate = (damage.date || '').split('T')[0];
                        if (endDate && dDate > endDate) return;
                        const isBefore = startDate && dDate < startDate;
                        const dProdName = (damage.productName || '').trim().toLowerCase();
                        const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
                        const dWh = (damage.warehouse || '').trim().toLowerCase();
                        if (dProdName === sProdName.toLowerCase() && dBrand === normBrand) {
                            if (isPriceReport) {
                                const damageLc = (damage.lcNo || '').trim().toLowerCase();
                                const stockLc = beLc.toLowerCase();
                                if (damageLc !== stockLc) return;
                            }
                            if (stockFilters.lcNo && (damage.lcNo || '').trim().toLowerCase() !== stockFilters.lcNo.toLowerCase()) return;
                            if (isWhFilter) {
                                const filterWH = stockFilters.warehouse.toLowerCase();
                                if (!dWh || (dWh !== filterWH && !dWh.includes(filterWH) && !filterWH.includes(dWh))) return;
                            }

                            const damageEntryId = `${damage._id}`;
                            if (consumedDamages.has(damageEntryId)) return;
                            consumedDamages.add(damageEntryId);

                            const dq = safeParse(damage.quantity);
                            let dp = safeParse(damage.packet) || (brandObj.packetSize > 0 ? dq / brandObj.packetSize : 0);
                            if (isBefore) {
                                brandObj.openingQuantity -= dq;
                                group.openingQuantity -= dq;
                            } else {
                                brandObj.damageQuantity += dq;
                                brandObj.damagePacket += dp;
                                group.damageQuantity += dq;
                            }
                        }
                    });
                    brandObj._damagesResolved = true;
                }

                const saleEntryId = `${sale._id}_${siIdx}_${beIdx}`;
                if (!consumedSales.has(saleEntryId)) {
                    consumedSales.add(saleEntryId);
                    const sDate = (sale.date || '').split('T')[0];
                    const isBefore = startDate && sDate < startDate;
                    const sq = safeParse(be.quantity);
                    let sp = safeParse(be.packet);
                    if (sp <= 0 && sq > 0) {
                        const pSize = brandObj.packetSize || 30;
                        sp = sq / pSize;
                    }
                    if (isBefore) {
                        brandObj.openingQuantity -= sq;
                        brandObj.openingPacket -= sp;
                        group.openingQuantity -= sq;
                        group.openingPacket -= sp;
                    } else {
                        brandObj.saleQuantity += sq;
                        brandObj.salePacket += sp;
                        group.saleQuantity += sq;
                        group.salePacket += sp;
                    }
                }
            });
        });
    });

    const displayRecords = Object.values(groupedStock).map(group => {
        const brandList = Object.values(group.brands).map(b => {
            const totalIn = b.openingQuantity + b.periodArrivalQuantity;
            const saleQty = b.saleQuantity;
            const shortageQty = b.sweepedQuantity;
            const damageQty = b.damageQuantity || 0;
            const totalPkt = b.openingPacket + b.periodArrivalPacket;

            const isGrossArrival = false;
            const openingAfterShortage = isGrossArrival ? (totalIn - shortageQty) : totalIn;
            const openingPktAfterShortage = isGrossArrival ? (totalPkt - b.sweepedPacket) : totalPkt;

            const closingQty = openingAfterShortage - saleQty - damageQty;
            const closingPkt = openingPktAfterShortage - b.salePacket - (b.damagePacket || 0);

            return {
                ...b,
                openingQuantity: openingAfterShortage,
                openingPacket: openingPktAfterShortage,
                closingQuantity: closingQty,
                closingPacket: closingPkt,
                inHouseQuantity: closingQty,
                inHousePacket: closingPkt,
                totalInHouseQuantity: openingAfterShortage,
                totalInHousePacket: openingPktAfterShortage
            };
        }).sort((a, b) => {
            const qCmp = (a.quality || '-').localeCompare(b.quality || '-');
            if (qCmp !== 0) return qCmp;
            return (a.brand || '').localeCompare(b.brand || '');
        });

        return {
            ...group,
            brandList,
            openingQuantity: brandList.reduce((sum, b) => sum + b.openingQuantity, 0),
            openingPacket: brandList.reduce((sum, b) => sum + b.openingPacket, 0),
            periodArrivalQuantity: brandList.reduce((sum, b) => sum + b.periodArrivalQuantity, 0),
            periodArrivalPacket: brandList.reduce((sum, b) => sum + b.periodArrivalPacket, 0),
            saleQuantity: brandList.reduce((sum, b) => sum + b.saleQuantity, 0),
            salePacket: brandList.reduce((sum, b) => sum + b.salePacket, 0),
            sweepedQuantity: brandList.reduce((sum, b) => sum + b.sweepedQuantity, 0),
            sweepedPacket: brandList.reduce((sum, b) => sum + b.sweepedPacket, 0),
            damageQuantity: brandList.reduce((sum, b) => sum + b.damageQuantity, 0),
            damagePacket: brandList.reduce((sum, b) => sum + b.damagePacket, 0),
            inHouseQuantity: brandList.reduce((sum, b) => sum + b.inHouseQuantity, 0),
            inHousePacket: brandList.reduce((sum, b) => sum + b.inHousePacket, 0),
            totalInHouseQuantity: brandList.reduce((sum, b) => sum + b.totalInHouseQuantity, 0),
            totalInHousePacket: brandList.reduce((sum, b) => sum + b.totalInHousePacket, 0)
        };
    });

    return { displayRecords };
};

const result = calculateStockData(stockRecords, { reportType: 'price' }, '', warehouseData, salesRecords, products, damages);
const mosurDal = result.displayRecords.find(r => r.productName === 'MOSUR DAL');

if (mosurDal) {
    console.log("MOSUR DAL brands list:");
    mosurDal.brandList.forEach(b => {
        if (b.brand.toUpperCase() === 'HASINA MIX') {
            console.log(`Brand: ${b.brand}, Quality: ${b.quality}, LC No: ${b.lcNo}, Cost: ${b.purchasedPrice}, arrivalQty: ${b.periodArrivalQuantity}, saleQty: ${b.saleQuantity}, closingQty: ${b.closingQuantity}`);
        }
    });
} else {
    console.log("MOSUR DAL not found in displayRecords.");
}
