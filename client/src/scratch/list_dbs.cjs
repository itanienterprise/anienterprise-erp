const mongoose = require('mongoose');

async function listDbs() {
    await mongoose.connect('mongodb://localhost:27017');
    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(d => d.name));

    for (const dbInfo of dbs.databases) {
        if (dbInfo.name === 'admin' || dbInfo.name === 'config' || dbInfo.name === 'local') continue;
        const conn = mongoose.createConnection(`mongodb://localhost:27017/${dbInfo.name}`);
        const cols = await conn.asPromise().then(c => c.db.listCollections().toArray());
        console.log(`\nDB ${dbInfo.name} collections:`, cols.map(c => c.name));
        const Stock = conn.model('Stock', new mongoose.Schema({}, { strict: false }), 'stocks');
        const sCount = await Stock.countDocuments();
        console.log(`  stocks count: ${sCount}`);
        const one = await Stock.findOne().lean();
        if (one) console.log(`  sample stock lcNo: ${one.lcNo}`);
    }
    await mongoose.disconnect();
}
listDbs();
