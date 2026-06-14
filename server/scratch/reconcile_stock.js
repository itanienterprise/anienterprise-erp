const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData, encryptData } = require('../src/utils/encryption');
const { calculateStockData } = require('../../client/src/utils/stockHelpers.js');

function decryptRecord(r) {
    if (!r) return null;
    let d = decryptData(r.data);
    if (d && d.data && typeof d.data === 'string' && !d.productName && !d.whName && !d.warehouse) {
        try { d = decryptData(d.data); } catch (e) {}
    }
    return { ...d, _id: r._id, createdAt: r.createdAt.toISOString() };
}

const expectedReport = {
    "HILI": {
        "BRAN": {
            "BRAND KING": { qty: 7075, size: 34 },
            "DOUBLE ROSE": { qty: 820, size: 34 }
        },
        "CHICK PEAS": {
            "BADSAH": { qty: 150, size: 30 },
            "DIAMOND": { qty: 10380, size: 30 }
        },
        "KHESHARI DAL": {
            "DIPOK 1": { qty: 48030, size: 30 },
            "HAFSHU": { qty: 32400, size: 30 },
            "KOILAS": { qty: 6630, size: 30 },
            "ROYEL KING": { qty: 91980, size: 30 }
        },
        "MOSUR DAL": {
            "KANGARU (50 kg)": { qty: 85950, size: 50 },
            "BHAI BHAI MED": { qty: 52923, size: 30 },
            "BROWN DIAMOND": { qty: 131435, size: 30 },
            "FIVE STAR MEDIUM": { qty: 128460, size: 30 },
            "HASINA MEDIUM": { qty: 242380, size: 30 },
            "PRAKASH MEDIUM": { qty: 161941, size: 30 },
            "RAPID MEDIUM": { qty: 37071, size: 30 },
            "SHIDDHART MEDIUM": { qty: 85921, size: 30 },
            "V D": { qty: 42980, size: 30 },
            "GREEN DIAMOND MIX": { qty: 41988, size: 30 },
            "HASINA MIX": { qty: 34409, size: 30 },
            "INDIA GOLD MIX": { qty: -30, size: 30 },
            "MERI DELHI MIX": { qty: 23, size: 30 },
            "PRAKASH MIX": { qty: 25797, size: 30 },
            "RANI MIX": { qty: 33851, size: 30 },
            "SHIDDHART MIX": { qty: 18, size: 30 }
        },
        "MOTH DAL": {
            "MASTANA MASTANI": { qty: 330, size: 30 }
        },
        "MUNG DAL": {
            "CHAPPAN": { qty: 42510, size: 30 },
            "MANPACHAND": { qty: 14550, size: 30 },
            "RAJDHANI": { qty: 47550, size: 30 },
            "5-STAR": { qty: 42495, size: 30 },
            "CRISTAL MUNG": { qty: 45420, size: 30 },
            "DESHI TATKA": { qty: 42987, size: 30 },
            "FIESTA": { qty: 26940, size: 30 },
            "J F I": { qty: 14168, size: 30 },
            "L D M": { qty: 42970, size: 30 },
            "M K": { qty: 68940, size: 30 },
            "SIGNATURE": { qty: 76890, size: 30 },
            "TAJ": { qty: 52940, size: 30 }
        },
        "RICE": {
            "DIDI BAHINI": { qty: 26, size: 26 }
        }
    },
    "BOGURA": {
        "CHICK PEAS": {
            "BADSAH": { qty: 9540, size: 30 }
        },
        "MOSUR DAL": {
            "BROWN DIAMOND": { qty: 14, size: 30 },
            "BHAI BHAI MIX": { qty: 5640, size: 30 },
            "GREEN DIAMOND MIX": { qty: 37830, size: 30 },
            "HASINA MIX": { qty: 10080, size: 30 },
            "L D M": { qty: 49500, size: 30 }
        },
        "MUNG DAL": {
            "DESHI TATKA": { qty: 13, size: 30 }
        }
    },
    "BHOMRA": {
        "BRAN": {
            "KHESHARI VUSI": { qty: 22050, size: 25 }
        }
    }
};

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    // 1. Delete previous inventory adjustments to make the run idempotent
    const allWh = await Warehouse.find({});
    let deletedCount = 0;
    for (const w of allWh) {
        const decrypted = decryptRecord(w);
        if (decrypted && decrypted.location === 'Inventory Adjustment') {
            await Warehouse.deleteOne({ _id: w._id });
            deletedCount++;
        }
    }
    console.log(`Deleted ${deletedCount} existing Inventory Adjustment warehouse records.`);

    // Reload database documents
    const rawSales = await Sale.find({});
    const salesRecords = rawSales.map(decryptRecord);
    
    const rawStock = await Stock.find({});
    const stockRecords = rawStock.map(decryptRecord);
    
    const rawWh = await Warehouse.find({});
    const warehouseData = rawWh.map(r => ({ ...decryptRecord(r), recordType: 'warehouse' }));
    
    const rawProd = await Product.find({});
    const products = rawProd.map(decryptRecord);

    const rawDamages = await Damage.find({});
    const damages = rawDamages.map(decryptRecord);

    console.log("=== CALCULATING DISCREPANCIES AND CREATING ADJUSTMENTS ===");

    let createdCount = 0;

    for (const [whName, productsMap] of Object.entries(expectedReport)) {
        // Calculate stock for this warehouse
        const res = calculateStockData(stockRecords, { warehouse: whName, endDate: '2026-06-11' }, '', warehouseData, salesRecords, products, damages);
        
        for (const [prodName, brandsMap] of Object.entries(productsMap)) {
            const dbGroup = res.displayRecords.find(g => g.productName.toUpperCase() === prodName.toUpperCase());
            
            for (const [brandName, info] of Object.entries(brandsMap)) {
                const expectedQty = info.qty;
                const packetSize = info.size;

                let dbQty = 0;
                if (dbGroup) {
                    const dbBrand = dbGroup.brandList.find(b => b.brand.trim().toUpperCase() === brandName.trim().toUpperCase());
                    if (dbBrand) {
                        dbQty = dbBrand.closingQuantity;
                    }
                }

                const diff = expectedQty - dbQty;
                if (Math.abs(diff) > 0.01) {
                    const adjustQty = Number(diff.toFixed(2));
                    const adjustPkt = Number((adjustQty / packetSize).toFixed(4));

                    const newEntry = {
                        whName: whName,
                        product: prodName,
                        productName: prodName, // set both
                        brand: brandName,
                        whQty: adjustQty,
                        whPkt: adjustPkt,
                        inHouseQuantity: adjustQty,
                        inHousePacket: adjustPkt,
                        inhouseQty: adjustQty, // set both
                        inhousePkt: adjustPkt, // set both
                        status: "Active",
                        manager: "-",
                        location: "Inventory Adjustment",
                        packetSize: packetSize,
                        recordType: "warehouse",
                        date: "2026-06-01" // within range
                    };

                    const encryptedData = encryptData(newEntry);
                    await new Warehouse({ data: encryptedData }).save();
                    console.log(`Created adjustment: WH=${whName} | Prod=${prodName} | Brand=${brandName} | Qty=${adjustQty} kg | Pkt=${adjustPkt} bags`);
                    createdCount++;
                }
            }
        }
    }

    console.log(`Successfully created ${createdCount} new adjustment warehouse records.`);
    process.exit(0);
});
