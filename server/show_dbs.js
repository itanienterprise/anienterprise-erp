const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/').then(async () => {
    const admin = new mongoose.mongo.Admin(mongoose.connection.db);
    const dbs = await admin.listDatabases();
    console.log("=== DATABASES ===");
    for (const db of dbs.databases) {
        console.log(db.name);
        const connection = mongoose.createConnection(`mongodb://127.0.0.1:27017/${db.name}`);
        await new Promise(resolve => connection.once('open', resolve));
        const collections = await connection.db.listCollections().toArray();
        for (const col of collections) {
            const count = await connection.collection(col.name).countDocuments({});
            console.log(`  - ${col.name}: ${count}`);
        }
        await connection.close();
    }
    process.exit(0);
});
