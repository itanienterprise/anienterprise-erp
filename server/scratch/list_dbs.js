const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/admin').then(async () => {
    const admin = mongoose.connection.useDb('admin').db.admin();
    const dbs = await admin.listDatabases();
    console.log(dbs);

    for (let dbObj of dbs.databases) {
        const dbName = dbObj.name;
        if (dbName === 'admin' || dbName === 'config' || dbName === 'local') continue;
        const conn = mongoose.connection.useDb(dbName);
        const collections = await conn.db.listCollections().toArray();
        console.log(`DB: ${dbName} collections:`, collections.map(c => c.name));
    }
    process.exit(0);
});
