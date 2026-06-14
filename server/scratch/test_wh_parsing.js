const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData } = require('../src/utils/encryption');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

const safeParse = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

// Helper for robust packet and weight remainder calculation (fixing 4,999 - 60 kg issue)
const calculatePktRemainder = (totalQty, pktSize) => {
    const qty = safeParse(totalQty);
    const size = safeParse(pktSize);
    if (size <= 0) return { whole: 0, remainder: qty };

    if (qty >= 0) {
        const rawPkt = qty / size;
        const whole = Math.floor(rawPkt + 1e-9);
        const remainder = Math.max(0, Math.round(qty - (whole * size)));
        if (remainder >= size) {
            return { whole: whole + 1, remainder: 0 };
        }
        return { whole, remainder };
    } else {
        const absQty = Math.abs(qty);
        const rawPkt = absQty / size;
        const whole = Math.floor(rawPkt + 1e-9);
        const remainder = Math.max(0, Math.round(absQty - (whole * size)));
        if (remainder >= size) {
            return { whole: -(whole + 1), remainder: 0 };
        }
        return { whole: -whole, remainder: -remainder };
    }
};

function debugCalculateStockData(stockRecords, stockFilters, stockSearchQuery = '', warehouseData = [], salesRecords = [], products = [], damages = []) {
    const isWhFilter = stockFilters.warehouse && stockFilters.warehouse.trim().toLowerCase() !== 'all warehouses';

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

    const rawExpanded = [];
    const seenRecords = new Set();
    const consumedSales = new Set();

    // 1. Process Primary Stock Records (LC Receive)
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
                inHouseQuantity: safeParse(item.inHouseQuantity ?? item.inhouseQty ?? item.quantity),
                inHousePacket: safeParse(item.inHousePacket ?? item.inhousePkt ?? item.packet)
            });
        }
    });

    // 2. Process Warehouse Records (Transfers)
    warehouseData.forEach(whItem => {
        if (!whItem || (whItem.location || '').trim().toLowerCase() === 'returned stock') {
            if (whItem && (whItem.brand || '').includes('G D P')) console.log('Dropped at location: returned stock');
            return;
        }
        if (whItem.recordType !== 'warehouse' && !whItem.productName && !whItem.product) {
            if ((whItem.brand || '').includes('G D P')) console.log('Dropped at recordType/product missing:', whItem);
            return;
        }
        if (seenRecords.has(whItem._id)) {
            if ((whItem.brand || '').includes('G D P')) console.log('Dropped because seenRecords has ID:', whItem._id);
            return;
        }
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

        const pushedItem = {
            ...whItem,
            date: whItem.date || whItem.createdAt || new Date().toISOString(),
            productName: whItem.productName || whItem.product || '',
            warehouse: whItem.whName || whItem.warehouse || '',
            quality: (() => {
                const rq = resolveQuality(whItem.productName || whItem.product, whItem.brand);
                return rq !== '-' ? rq : (whItem.quality || '-');
            })(),
            quantity: safeParse(whItem.whQty ?? whItem.quantity),
            packet: safeParse(whItem.whPkt ?? whItem.packet),
            inHouseQuantity: safeParse(whItem.whQty ?? whItem.inHouseQuantity),
            inHousePacket: safeParse(whItem.whPkt ?? whItem.inHousePacket),
            packetSize: resolvedPktSize || 30,
            unit: whItem.unit || 'kg',
            recordType: 'warehouse'
        };
        if ((whItem.brand || '').includes('G D P')) console.log('Pushed whItem to rawExpanded:', pushedItem);
        rawExpanded.push(pushedItem);
    });

    const startDate = stockFilters.startDate || '';
    const endDate = stockFilters.endDate || '';

    // 3. Filtering
    const filteredRecords = rawExpanded.filter(item => {
        const itemDateOnly = (item.date || '').split('T')[0];
        if (endDate && itemDateOnly > endDate) return false;

        if (stockFilters.lcNo && (item.lcNo || '').trim() !== stockFilters.lcNo) return false;
        if (isWhFilter) {
            const filterWH = stockFilters.warehouse.trim().toLowerCase();
            const itemWH = (item.whName || item.warehouse || '').trim().toLowerCase();
            if (!itemWH || (itemWH !== filterWH && !itemWH.includes(filterWH) && !filterWH.includes(itemWH))) return false;
        }
        if (stockFilters.brand && (item.brand || '').trim() !== stockFilters.brand) return false;
        if (stockFilters.productName) {
            const itemName = (item.productName || item.product || '').trim().toLowerCase();
            if (itemName !== stockFilters.productName.toLowerCase()) return false;
        }

        if (stockSearchQuery) {
            const q = stockSearchQuery.toLowerCase();
            return (item.brand || '').toLowerCase().includes(q) ||
                (item.productName || item.product || '').toLowerCase().includes(q) ||
                (item.lcNo || '').toLowerCase().includes(q);
        }
        return true;
    });

    if (filteredRecords.some(r => (r.brand || '').includes('G D P'))) {
        console.log('FilteredRecords contains GDP!');
    } else {
        console.log('FilteredRecords DOES NOT contain GDP!');
    }

    // 4. Aggregation
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
        const subKey = `${normQuality}_${normBrand}`;

        if ((item.brand || '').includes('G D P')) {
            console.log('Aggregating GDP: key=', key, 'subKey=', subKey);
        }

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
                lcNos: item.lcNo ? [item.lcNo] : []
            };
        } else {
            if (item.lcNo && !acc[key].brands[subKey].lcNos.includes(item.lcNo)) {
                acc[key].brands[subKey].lcNos.push(item.lcNo);
            }
        }

        const brandObj = acc[key].brands[subKey];

        // Resolve Sales for this brand if not already done
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

        // Resolve Damages for this brand if not already done
        if (!brandObj._damagesResolved) {
            damages.forEach(damage => {
                const dDate = (damage.date || damage.createdAt || '').split('T')[0];
                if (endDate && dDate > endDate) return;

                const isBeforeDamage = startDate && dDate < startDate;
                
                const dProdName = (damage.productName || damage.product || '').trim().toLowerCase();
                const dBrand = (damage.brand || 'No Brand').trim().toLowerCase();
                const dWh = (damage.warehouse || '').trim().toLowerCase();

                if (dProdName === keyLower && dBrand === normBrand) {
                    if (stockFilters.lcNo && (damage.lcNo || '').trim() !== stockFilters.lcNo) return;
                    if (isWhFilter) {
                        const filterWH = stockFilters.warehouse.toLowerCase();
                        if (!dWh || (dWh !== filterWH && !dWh.includes(filterWH) && !filterWH.includes(dWh))) return;
                    }

                    const dq = safeParse(damage.quantity);
                    let dp = safeParse(damage.packet);
                    if (dp <= 0 && dq > 0) {
                        const pSize = brandObj.packetSize || 30;
                        dp = dq / pSize;
                    }

                    if (isBeforeDamage) {
                        brandObj.openingQuantity -= dq;
                        brandObj.openingPacket -= dp;
                        acc[key].openingQuantity -= dq;
                        acc[key].openingPacket -= dp;
                    } else {
                        brandObj.damageQuantity += dq;
                        brandObj.damagePacket += dp;
                        acc[key].damageQuantity += dq;
                        acc[key].damagePacket += dp;
                    }
                }
            });
            brandObj._damagesResolved = true;
        }

        const arrivalQty = safeParse(item.inHouseQuantity);
        const arrivalPkt = safeParse(item.inHousePacket);

        if (isBefore) {
            brandObj.openingQuantity += arrivalQty;
            brandObj.openingPacket += arrivalPkt;
            acc[key].openingQuantity += arrivalQty;
        } else {
            brandObj.periodArrivalQuantity += arrivalQty;
            brandObj.periodArrivalPacket += arrivalPkt;
            acc[key].periodArrivalQuantity += arrivalQty;
        }

        brandObj.inHouseQuantity += safeParse(item.inHouseQuantity);
        brandObj.inHousePacket += safeParse(item.inHousePacket);
        acc[key].inHouseQuantity += safeParse(item.inHouseQuantity);

        brandObj.sweepedPacket += safeParse(item.sweepedPacket);
        brandObj.sweepedQuantity += safeParse(item.sweepedQuantity);
        acc[key].sweepedPacket += safeParse(item.sweepedPacket);
        acc[key].sweepedQuantity += safeParse(item.sweepedQuantity);

        acc[key].allIds.push(item._id);
        return acc;
    }, {});

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

            const resBrand = {
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
            if ((b.brand || '').includes('G D P')) {
                console.log('displayRecords mapping GDP:', resBrand);
            }
            return resBrand;
        }).sort((a, b) => {
            const qCmp = (a.quality || '-').localeCompare(b.quality || '-');
            if (qCmp !== 0) return qCmp;
            return a.brand.localeCompare(b.brand);
        }).filter(b => {
            const pass = Math.abs(b.totalInHouseQuantity) > 0.01 || 
                Math.abs(b.saleQuantity) > 0.01 || 
                Math.abs(b.inHouseQuantity) > 0.01 || 
                Math.abs(b.sweepedQuantity) > 0.01 ||
                Math.abs(b.damageQuantity || 0) > 0.01;
            if ((b.brand || '').includes('G D P')) console.log('GDP brand pass filter:', pass);
            return pass;
        });

        if (brandList.length === 0) return null;

        const openingQty = brandList.reduce((sum, b) => sum + b.openingQuantity, 0);
        const inHouseQty = brandList.reduce((sum, b) => sum + b.inHouseQuantity, 0);
        const saleQty = brandList.reduce((sum, b) => sum + b.saleQuantity, 0);
        const damageQty = brandList.reduce((sum, b) => sum + (b.damageQuantity || 0), 0);
        const openingPkt = brandList.reduce((sum, b) => sum + b.openingPacket, 0);
        const inHousePkt = brandList.reduce((sum, b) => sum + b.inHousePacket, 0);
        const salePkt = brandList.reduce((sum, b) => sum + b.salePacket, 0);
        const damagePkt = brandList.reduce((sum, b) => sum + (b.damagePacket || 0), 0);

        const groupPktSize = brandList.find(b => (b.packetSize || 0) > 0)?.packetSize || products.find(p => (p.name || p.productName || '').trim().toLowerCase() === group.productName.toLowerCase())?.packetSize || 30;

        return {
            ...group,
            brandList: brandList.map(b => ({ ...b, packetSize: b.packetSize || groupPktSize })),
            packetSize: groupPktSize,
            openingQuantity: openingQty,
            openingPacket: openingPkt,
            totalInHouseQuantity: openingQty,
            totalInHousePacket: openingPkt,
            inHouseQuantity: inHouseQty,
            inHousePacket: inHousePkt,
            saleQuantity: saleQty,
            salePacket: salePkt,
            damageQuantity: damageQty,
            damagePacket: damagePkt
        };
    }).filter(p => p !== null && p.productName && p.productName.trim() !== '-' && p.productName.trim() !== '').sort((a, b) => a.productName.localeCompare(b.productName));

    const filteredDisplayRecords = displayRecords.map(group => {
        let filteredBrands = group.brandList;
        if (stockFilters.brand) {
            filteredBrands = filteredBrands.filter(b => (b.brand || '').trim() === stockFilters.brand);
        } else {
            filteredBrands = filteredBrands.filter(b => Math.abs(b.inHouseQuantity) > 0.01);
            if (group.brandList.some(b => (b.brand || '').includes('G D P'))) {
                console.log('After inHouseQuantity filter, GDP passed:', filteredBrands.some(b => (b.brand || '').includes('G D P')));
            }
        }

        if (filteredBrands.length === 0 && (!stockFilters.brand || Math.abs(group.inHouseQuantity) <= 0.01)) {
            return null;
        }

        return {
            ...group,
            brandList: filteredBrands.length > 0 ? filteredBrands : group.brandList
        };
    }).filter(Boolean);

    return {
        displayRecords: filteredDisplayRecords
    };
}

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const rawSales = await Sale.find({});
    const sales = rawSales.map(decryptRecord);
    const rawStock = await Stock.find({});
    const stocks = rawStock.map(decryptRecord);
    const rawWh = await Warehouse.find({});
    const warehouses = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);
    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    debugCalculateStockData(stocks, {}, '', warehouses, sales, products, damages);
    process.exit(0);
});
