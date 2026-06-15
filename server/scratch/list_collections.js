const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/erp_db').then(async () => {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    for (let coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`Collection: ${coll.name} | Count: ${count}`);
    }
    process.exit(0);
});
