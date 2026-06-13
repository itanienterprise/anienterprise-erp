const mongoose = require('mongoose');
const Sale = require('../src/models/Sale');
const Stock = require('../src/models/Stock');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Damage = require('../src/models/Damage');
const { decryptData } = require('../src/utils/encryption');
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
            "BRAND KING": 7075,
            "DOUBLE ROSE": 820
        },
        "CHICK PEAS": {
            "BADSAH": 150,
            "DIAMOND": 10380
        },
        "KHESHARI DAL": {
            "DIPOK 1": 48030,
            "HAFSHU": 32400,
            "KOILAS": 6630,
            "ROYEL KING": 91980
        },
        "MOSUR DAL": {
            "KANGARU (50 kg)": 85950,
            "BHAI BHAI MED": 52923,
            "BROWN DIAMOND": 131435,
            "FIVE STAR MEDIUM": 128460,
            "HASINA MEDIUM": 242380,
            "PRAKASH MEDIUM": 161941,
            "RAPID MEDIUM": 37071,
            "SHIDDHART MEDIUM": 85921,
            "V D": 42980,
            "GREEN DIAMOND MIX": 41988,
            "HASINA MIX": 34409,
            "INDIA GOLD MIX": -30,
            "MERI DELHI MIX": 23,
            "PRAKASH MIX": 25797,
            "RANI MIX": 33851,
            "SHIDDHART MIX": 18
        },
        "MOTH DAL": {
            "MASTANA MASTANI": 330
        },
        "MUNG DAL": {
            "CHAPPAN": 42510,
            "MANPACHAND": 14550,
            "RAJDHANI": 47550,
            "5-STAR": 42495,
            "CRISTAL MUNG": 45420,
            "DESHI TATKA": 42987,
            "FIESTA": 26940,
            "J F I": 14168,
            "L D M": 42970,
            "M K": 68940,
            "SIGNATURE": 76890,
            "TAJ": 52940
        },
        "RICE": {
            "DIDI BAHINI": 26
        }
    },
    "BOGURA": {
        "CHICK PEAS": {
            "BADSAH": 9540
        },
        "MOSUR DAL": {
            "BROWN DIAMOND": 14,
            "BHAI BHAI MIX": 5640,
            "GREEN DIAMOND MIX": 37830,
            "HASINA MIX": 10080,
            "L D M": 49500
        },
        "MUNG DAL": {
            "DESHI TATKA": 13
        }
    },
    "BHOMRA": {
        "BRAN": {
            "KHESHARI VUSI": 22050
        }
    }
};

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
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

    console.log("=== COMPARING DB CLOSING STOCKS vs PRINTED REPORT (2026-06-11) ===");

    for (const [whName, productsMap] of Object.entries(expectedReport)) {
        console.log(`\n--- Warehouse: ${whName} ---`);
        const res = calculateStockData(stockRecords, { warehouse: whName, endDate: '2026-06-11' }, '', warehouseData, salesRecords, products, damages);
        
        for (const [prodName, brandsMap] of Object.entries(productsMap)) {
            const dbGroup = res.displayRecords.find(g => g.productName.toUpperCase() === prodName.toUpperCase());
            
            for (const [brandName, expectedQty] of Object.entries(brandsMap)) {
                // Find matching brand in DB group
                let dbQty = 0;
                if (dbGroup) {
                    const dbBrand = dbGroup.brandList.find(b => b.brand.trim().toUpperCase() === brandName.trim().toUpperCase());
                    if (dbBrand) {
                        dbQty = dbBrand.closingQuantity;
                    }
                }
                const diff = dbQty - expectedQty;
                if (Math.abs(diff) > 0.01) {
                    console.log(`❌ Diff: ${prodName.padEnd(12)} | ${brandName.padEnd(20)} | Expected: ${expectedQty.toString().padStart(8)} | DB: ${dbQty.toString().padStart(8)} | Diff: ${diff.toString().padStart(8)}`);
                } else {
                    console.log(`✅ Match: ${prodName.padEnd(12)} | ${brandName.padEnd(20)} | Expected: ${expectedQty.toString().padStart(8)} | DB: ${dbQty.toString().padStart(8)}`);
                }
            }
        }
    }

    process.exit(0);
});
